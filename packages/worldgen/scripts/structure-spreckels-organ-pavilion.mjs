/** Spreckels Organ Pavilion: pierced organ arch, open paired-row peristyle and terminal pavilions. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

function quad(o, slot, p, n, c) {
  if (normalFor(...p).reduce((v, a, i) => v + a * n[i], 0) < 0) p = [...p].reverse();
  rawQuad(o, slot, p, n, c);
}
function transform(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function poly(o, slot, ps, y0, y1, col) {
  const p = ps.map((v) => v.slice());
  if (
    p.reduce(
      (a, v, i) => a + v[0] * p[(i + 1) % p.length][1] - v[1] * p[(i + 1) % p.length][0],
      0,
    ) < 0
  )
    p.reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  const ids = earcut(p.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const ps = ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
      if (normalFor(...ps)[1] * n[1] < 0) ps.reverse();
      o.addTriangle(
        slot,
        ref,
        ps,
        n,
        ps.map((p) => [p[0], p[2]]),
        col,
      );
    }
}
function strip(o, slot, a, b, w, col, n = [0, 0, 1]) {
  const v = b.map((p, i) => p - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    l = Math.hypot(...q);
  if (l < 1e-8) return;
  const u = q.map((v) => (v * w) / l / 2),
    ps = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  quad(o, slot, ps, normalFor(...ps), col);
  if (slot === 'metal' || slot === 'stone') {
    const back = [...ps].reverse();
    quad(o, slot, back, normalFor(...back), col);
  }
}
function rod(o, d, slot, a, b, w, col, n) {
  if (d > 1) beam(o, slot, a, b, w, w, col);
  else strip(o, slot, a, b, w, col, n);
}
function flat(o, slot, ps, col, n = [0, 0, 1], holes = []) {
  const p = [...ps, ...holes.flat()],
    starts = holes.map((_, i) => ps.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    idx = earcut(
      p.flatMap((v) => [v[0], v[1]]),
      starts,
    );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => p[j]);
    if (normalFor(...q).reduce((s, v, k) => s + v * n[k], 0) < 0) q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      n,
      q.map((v) => [v[0], v[1]]),
      col,
    );
  }
}
function panel(o, slot, ps, z0, z1, col) {
  flat(
    o,
    slot,
    ps.map((p) => [...p, z1]),
    col,
  );
  flat(
    o,
    slot,
    ps.map((p) => [...p, z0]),
    col,
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      q = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, slot, q, normalFor(...q), col);
  }
}
function line(o, d, ps, z, col = pale, w = 0.06, slot = 'metal', closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++) {
    const a = ps[i - 1],
      b = ps[i % ps.length];
    rod(o, slot === 'relief' ? 0 : d === 3 ? 3 : 0, slot, [...a, z], [...b, z], w, col);
  }
}
function ellipse(x, y, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * Math.PI * 2) / n),
    y + ry * Math.sin((i * Math.PI * 2) / n),
  ]);
}
function curve(ps, n) {
  const result = [];
  for (let i = 0; i < ps.length - 1; i++)
    for (let j = 0; j < n; j++) {
      const a = ps[Math.max(0, i - 1)],
        b = ps[i],
        c = ps[i + 1],
        e = ps[Math.min(ps.length - 1, i + 2)],
        t = j / n;
      result.push(
        [0, 1].map(
          (k) =>
            0.5 *
            (2 * b[k] +
              (-a[k] + c[k]) * t +
              (2 * a[k] - 5 * b[k] + 4 * c[k] - e[k]) * t * t +
              (-a[k] + 3 * b[k] - 3 * c[k] + e[k]) * t * t * t),
        ),
      );
    }
  return [...result, ps.at(-1)];
}
const frame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9m/9mu/spreckels_organ_pavilion/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  terrain = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9m/9mu/spreckels_organ_pavilion/terrain-grid.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  pale = rgb('e2ddcc'),
  white = rgb('ede9dc'),
  cream = rgb('c8bfa9'),
  shade = rgb('918c7e'),
  shutter = rgb('b9b7aa'),
  dark = rgb('353c37'),
  glass = rgb('52625d'),
  roofcolor = rgb('a6aba5'),
  steel = rgb('545c57'),
  stoneblue = rgb('8b9c9e'),
  F = 0.55,
  W = 23.1086,
  D = 11.8054;
function sample(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrain.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    terrain.modelDatumElevationMeters
  );
}
if (frame.geometry.outline.some((p) => sample(...p) > F || sample(...p) < -4))
  throw Error('Native terrain exceeds the pavilion footing envelope');
function arch(x, y, w, h, n) {
  const r = w / 2;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI;
      return [x + r * Math.cos(a), y + h - r + r * Math.sin(a)];
    }),
  ];
}
function rect(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
function disk(o, x, y, z, r, c, n = 16) {
  flat(
    o,
    'relief',
    ellipse(x, y, r, r, n).map((p) => [...p, z]),
    c,
  );
}
function annulus(o, d, x, y, z, r, thick, col = cream, start = 0, end = Math.PI, slot = 'trim') {
  const n = [5, 8, 15, 40][d];
  if (d <= 1) {
    for (let i = 0; i < n; i++) {
      const a = start + ((end - start) * i) / n,
        b = start + ((end - start) * (i + 1)) / n;
      flat(
        o,
        slot,
        [
          [x + (r - thick) * Math.cos(a), y + (r - thick) * Math.sin(a), z],
          [x + r * Math.cos(a), y + r * Math.sin(a), z],
          [x + r * Math.cos(b), y + r * Math.sin(b), z],
          [x + (r - thick) * Math.cos(b), y + (r - thick) * Math.sin(b), z],
        ],
        col,
      );
    }
    return;
  }
  for (let i = 0; i < n; i++) {
    const a = start + ((end - start) * i) / n,
      b = start + ((end - start) * (i + 1)) / n;
    panel(
      o,
      slot,
      [
        [x + (r - thick) * Math.cos(a), y + (r - thick) * Math.sin(a)],
        [x + r * Math.cos(a), y + r * Math.sin(a)],
        [x + r * Math.cos(b), y + r * Math.sin(b)],
        [x + (r - thick) * Math.cos(b), y + (r - thick) * Math.sin(b)],
      ],
      z - 0.045,
      z + 0.045,
      col,
    );
  }
}
function turned(o, x, z, ys, n = 12, slot = 'trim', col = pale, cap = true) {
  loft(
    o,
    slot,
    ys.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    col,
    { cap },
  );
}
function urn(o, d, x, y, z, h = 1.3) {
  if (d <= 2) {
    turned(
      o,
      x,
      z,
      [
        [y, 0.22],
        [y + h * 0.45, 0.27],
        [y + h, 0.05],
      ],
      4,
      'trim',
      pale,
      false,
    );
    return;
  }
  turned(
    o,
    x,
    z,
    [
      [y, 0.22],
      [y + 0.12 * h, 0.22],
      [y + 0.23 * h, 0.12],
      [y + 0.48 * h, 0.28],
      [y + 0.66 * h, 0.22],
      [y + 0.75 * h, 0.12],
      [y + 0.91 * h, 0.15],
      [y + h, 0.035],
    ],
    d === 1 ? 4 : d === 2 ? 5 : 8,
  );
}
function scroll(o, d, x, y, z, scale = 1) {
  const n = d === 1 ? 6 : d === 2 ? 11 : 18,
    ps = Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI * 2.1,
        r = scale * (0.35 - (0.25 * i) / n);
      return [x + Math.cos(a) * r, y + Math.sin(a) * r];
    });
  line(o, d, ps, z, pale, d === 1 ? 0.07 : 0.055, 'relief');
}
function leaf(o, d, x, y, z, w, h, a = 0) {
  const p = [
    [-w * 0.4, 0],
    [-w * 0.5, h * 0.5],
    [0, h],
    [w * 0.5, h * 0.5],
    [w * 0.4, 0],
    [0, h * 0.15],
  ].map(([u, v]) => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)]);
  panel(o, 'relief', p, z, z + 0.045, pale);
  if (d > 2)
    line(
      o,
      0,
      [
        [x, y],
        [x - h * 0.7 * Math.sin(a), y + h * 0.7 * Math.cos(a)],
      ],
      z + 0.055,
      cream,
      0.025,
      'relief',
    );
}
function shellMotif(o, d, x, y, z, w = 1) {
  if (d === 0) return;
  panel(
    o,
    'relief',
    [
      [x - w * 0.5, y],
      [x - w * 0.6, y + w * 0.45],
      [x - w * 0.4, y + w * 0.8],
      [x, y + w * 0.9],
      [x + w * 0.4, y + w * 0.8],
      [x + w * 0.6, y + w * 0.45],
      [x + w * 0.5, y],
    ],
    z,
    z + 0.08,
    pale,
  );
  for (let j = 0; j < (d === 1 ? 3 : 7); j++) {
    const a = Math.PI * 0.12 + (j / ((d === 1 ? 3 : 7) - 1)) * Math.PI * 0.76;
    line(
      o,
      0,
      [
        [x, y + 0.06],
        [x + Math.cos(a) * w * 0.5, y + Math.sin(a) * w * 0.8],
      ],
      z + 0.1,
      cream,
      0.04,
      'relief',
    );
  }
}
function flower(o, d, x, y, z, r = 0.42) {
  if (d === 0) return;
  if (d === 1 && r >= 0.5) {
    const ps = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2,
          rr = r * (i % 2 ? 0.78 : 1);
        return [x + Math.cos(a) * rr, y + Math.sin(a) * rr, z + 0.1];
      }),
      hole = ellipse(x, y, r * 0.43, r * 0.43, 6).map((p) => [...p, z + 0.1]);
    flat(o, 'relief', ps, pale, [0, 0, 1], [hole]);
    return;
  }
  if (r < 0.5) {
    const n = d === 1 ? 6 : 10,
      ps = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2,
          rr = r * (i % 2 ? 0.72 : 1);
        return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
      });
    flat(
      o,
      'relief',
      ps.map((p) => [...p, z + 0.06]),
      pale,
    );
    if (d > 1) disk(o, x, y, z + 0.08, r * 0.22, cream, 6);
    return;
  }
  const n = d === 1 ? 6 : d === 2 ? 10 : 16,
    holes = Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI) / 3;
      return ellipse(0, 0, r * 0.26, r * 0.15, d === 1 ? 4 : 8).map(([u, v]) => [
        x + Math.cos(a) * (r * 0.57 + u) - Math.sin(a) * v,
        y + Math.sin(a) * (r * 0.57 + u) + Math.cos(a) * v,
        z + 0.1,
      ]);
    }),
    outer = ellipse(x, y, r, r, n).map((p) => [...p, z + 0.1]);
  flat(o, 'relief', outer, pale, [0, 0, 1], holes);
  if (d > 2) {
    flat(
      o,
      'relief',
      outer.map((p) => [p[0], p[1], z]),
      pale,
      [0, 0, -1],
      holes.map((h) => h.map((p) => [p[0], p[1], z])),
    );
    for (const h of holes)
      for (let j = 0; j < h.length; j++) {
        const a = h[j],
          b = h[(j + 1) % h.length],
          q = [a, b, [b[0], b[1], z], [a[0], a[1], z]];
        quad(o, 'relief', q, normalFor(...q), cream);
      }
  }
  disk(o, x, y, z + 0.12, r * 0.13, cream, d === 1 ? 4 : 8);
}
function capital(o, d, x, y, z, r = 0.35) {
  if (d < 2) return;
  turned(
    o,
    x,
    z,
    [
      [y, r],
      [y + 0.55, r * 1.46],
    ],
    d === 2 ? 5 : 8,
    'trim',
    cream,
  );
  B(o, 'trim', x, y + 0.54, z, r * 3.15, 0.15, r * 3.15, pale);
  for (const a of d === 2 ? [] : [0, Math.PI]) {
    const q = transform(o, a, x, z);
    if (d > 2) for (const v of [-1, 1]) scroll(q, d, v * r * 0.95, y + 0.45, r * 1.05, 0.45);
    leaf(q, d, 0, y + 0.02, r * 0.92, r * 0.8, 0.48, 0);
  }
}
function column(o, d, x, z, y0 = F, y1 = 7.05, r = 0.33) {
  if (d === 0) {
    turned(
      o,
      x,
      z,
      [
        [y0, r * 1.1],
        [y1, r],
      ],
      4,
      'trim',
      pale,
      false,
    );
    return;
  }
  if (d === 1) {
    turned(
      o,
      x,
      z,
      [
        [y0, r * 1.15],
        [y1, r * 0.9],
      ],
      4,
      'trim',
      pale,
      false,
    );
    return;
  }
  B(o, 'trim', x, y0, z, r * 2.7, 0.22, r * 2.7, pale);
  turned(
    o,
    x,
    z,
    [
      [y0 + 0.22, r * 1.15],
      [y0 + 0.42, r],
      [y1 - 0.76, r * 0.82],
    ],
    d === 2 ? 5 : 12,
  );
  capital(o, d, x, y1 - 0.76, z, r);
}
function pathAt(ps, t) {
  let total = 0;
  const lens = ps.slice(1).map((p, i) => {
    const l = Math.hypot(p[0] - ps[i][0], p[1] - ps[i][1]);
    total += l;
    return l;
  });
  let remaining = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (remaining <= lens[i] || i === lens.length - 1) {
      const u = remaining / lens[i];
      return ps[i].map((v, k) => v + (ps[i + 1][k] - v) * u);
    }
    remaining -= lens[i];
  }
}
function simplify(ps) {
  return ps.filter((_p, i) => i === 0 || i === ps.length - 1 || i % 2 === 0);
}
function wingRing(side) {
  const a = frame.authoredComponents;
  return a[`${side}Wing`];
}
function railRun(o, d, points, y) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (d < 3) {
      const p = [
        [a[0], y - 0.1, a[1]],
        [b[0], y - 0.1, b[1]],
        [b[0], y + 0.1, b[1]],
        [a[0], y + 0.1, a[1]],
      ];
      quad(o, 'trim', p, normalFor(...p), pale);
      const q = [...p].reverse();
      quad(o, 'trim', q, normalFor(...q), pale);
    } else beam(o, 'trim', [a[0], y, a[1]], [b[0], y, b[1]], 0.18, 0.25, pale);
  }
  if (d === 0) return;
  let len = 0;
  for (let i = 1; i < points.length; i++)
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  for (let i = 1; i < len / (d === 1 ? 0.85 : d === 2 ? 0.72 : 0.52); i++) {
    const p = pathAt(points, i / (len / (d === 1 ? 0.85 : d === 2 ? 0.72 : 0.52)));
    if (d === 1) {
      const v = 0.12;
      quad(
        o,
        'trim',
        [
          [p[0] - v, y - 0.9, p[1]],
          [p[0] + v, y - 0.9, p[1]],
          [p[0] + v, y - 0.08, p[1]],
          [p[0] - v, y - 0.08, p[1]],
        ],
        [0, 0, 1],
        pale,
      );
      quad(
        o,
        'trim',
        [
          [p[0], y - 0.9, p[1] - v],
          [p[0], y - 0.9, p[1] + v],
          [p[0], y - 0.08, p[1] + v],
          [p[0], y - 0.08, p[1] - v],
        ],
        [1, 0, 0],
        pale,
      );
      continue;
    }
    turned(
      o,
      p[0],
      p[1],
      d < 3
        ? [
            [y - 0.9, 0.12],
            [y - 0.46, 0.15],
            [y - 0.08, 0.1],
          ]
        : [
            [y - 0.9, 0.12],
            [y - 0.76, 0.12],
            [y - 0.56, 0.095],
            [y - 0.4, 0.15],
            [y - 0.22, 0.09],
            [y - 0.08, 0.13],
          ],
      d === 1 ? 3 : d === 2 ? 3 : 4,
    );
  }
}
function colonnades(o, d) {
  for (const side of ['west', 'east']) {
    const a = frame.authoredComponents,
      inner = a[`${side}Inner`],
      outer = a[`${side}Outer`],
      native = wingRing(side),
      ring = d === 0 ? simplify(native) : native;
    poly(o, 'wall', ring, -4, F, pale);
    poly(o, 'roof', ring, 7.05, 7.65, cream);
    for (const edge of [inner, outer]) {
      if (d > 0) {
        railRun(o, d, edge, 8.75);
        railRun(o, 0, edge, 7.84);
      }
      for (let j = 1; j < 13; j++) {
        const p = pathAt(edge, j / 13);
        column(o, d, p[0], p[1]);
        if (d > 0 && j % 2 === 0) urn(o, d, p[0], 8.78, p[1], 1.1);
      }
      if (d > 2) {
        for (let j = 0; j < 26; j++) {
          const p = pathAt(edge, (j + 0.5) / 26),
            p1 = pathAt(edge, Math.min(1, (j + 0.55) / 26)),
            angle = Math.atan2(p[1] - p1[1], p1[0] - p[0]);
          const q = transform(o, angle, ...p);
          flower(q, d, 0, 7.4, 0.12, 0.11);
        }
      }
    }
    if (d > 1)
      for (let j = 0; j <= 13; j++) {
        const p = pathAt(inner, j / 13),
          q = pathAt(outer, j / 13);
        beam(o, 'trim', [p[0], 7.02, p[1]], [q[0], 7.02, q[1]], 0.15, 0.2, pale);
      }
    if (d > 1)
      for (let j = 1; j < 13; j++) {
        const p = pathAt(inner, j / 13),
          q = pathAt(outer, j / 13);
        beam(o, 'trim', [p[0], F + 0.02, p[1]], [q[0], F + 0.02, q[1]], 0.08, 0.07, cream);
      }
  }
}
function frontProfile() {
  return [
    [-W / 2, -4],
    [W / 2, -4],
    [W / 2, 18.55],
    [W * 0.4, 18.7],
    [W * 0.24, 19.6],
    [0, 21.2],
    [-W * 0.24, 19.6],
    [-W * 0.4, 18.7],
    [-W / 2, 18.55],
  ];
}
function wallWithHoles(o, d, ps, z, holes, depth = 0.6) {
  flat(
    o,
    'wall',
    ps.map((p) => [...p, z - depth]),
    white,
    [0, 0, -1],
    holes.map((h) => h.map((p) => [...p, z - depth])),
  );
  flat(
    o,
    'wall',
    ps.map((p) => [...p, z]),
    white,
    [0, 0, 1],
    holes.map((h) => h.map((p) => [...p, z])),
  );
  for (const h of holes)
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length],
        q = [
          [...a, z],
          [...b, z],
          [...b, z - depth],
          [...a, z - depth],
        ];
      quad(o, 'trim', q, normalFor(...q), cream);
    }
  if (d > 1) for (const h of holes) line(o, 0, h, z + 0.055, pale, 0.08, 'trim', true);
}
function mainShell(o, d) {
  if (d <= 1) {
    B(o, 'wall', 0, -4, -D / 2, W, 22.5, D, pale);
    const h = arch(0, F, 12.7, 12.9 - F, 8);
    flat(
      o,
      'shutter',
      h.map((p) => [...p, 0.015]),
      shutter,
    );
    const ps = frontProfile();
    panel(o, 'wall', ps, 0, 0.04, white);
    flat(
      o,
      'shutter',
      h.map((p) => [...p, 0.055]),
      shutter,
    );
    B(o, 'trim', 0, -4, 0.92, W + 0.7, 4 + F, 1.84, pale);
    for (const v of [-1, 1]) {
      const x = v * (W / 2 + 1.3),
        a = [
          [x - 1.15, -4, 1.65],
          [x + 1.15, -4, 1.65],
          [x + 1.15, -4, 4.95],
          [x - 1.15, -4, 4.95],
        ],
        b = a.map((p) => [p[0], p[2] < 2 ? F : F - 1.6, p[2]]);
      quad(o, 'trim', b, [0, 1, 0], stoneblue);
      quad(o, 'trim', a, [0, -1, 0], pale);
      for (let i = 0; i < 4; i++) {
        const q = [a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]];
        quad(o, 'trim', q, normalFor(...q), pale);
      }
    }

    if (d === 1)
      for (const v of [-1, 1]) {
        const q = transform(o, (v * Math.PI) / 2, (v * W) / 2, -D / 2);
        for (const h of [
          rect(-1.18, 9.25, 1.95, 3.4),
          rect(1.18, 9.25, 1.95, 3.4),
          ellipse(0, 15.1, 0.67, 0.8, 8),
        ])
          flat(
            q,
            'glass',
            h.map((p) => [...p, 0.02]),
            dark,
          );
      }
    return;
  }
  const r = frame.authoredComponents.centralOutline;
  poly(o, 'wall', r, -4, F, pale);
  B(o, 'wall', 0, F, -D + 0.28, W, 18.55 - F, 0.56, white);
  B(o, 'roof', 0, 18.5, -D / 2, W - 0.3, 0.2, D - 0.3, roofcolor);
  const outer = arch(0, F, 17.2, 14.85 - F, [8, 16, 32, 64][d]);
  wallWithHoles(o, d, frontProfile(), 0, [outer], 1.15);
  // Both large side elevations have actual paired upper lights and an oculus.
  for (const s of [-1, 1]) {
    const q = transform(o, (s * Math.PI) / 2, (s * W) / 2, -D / 2),
      base = rect(0, -4, D, 22.55),
      holes = [
        rect(0, F, 2.5, 4.3),
        ...[-1, 1].map((v) => rect(v * 1.18, 9.25, 1.95, 3.4)),
        ellipse(0, 15.1, 0.67, 0.8, d === 0 ? 6 : d === 1 ? 10 : 20),
      ];
    wallWithHoles(q, d, base, 0, holes, 0.55);
    for (const h of holes)
      flat(
        q,
        'glass',
        h.map((p) => [...p, -0.56]),
        dark,
      );
    if (d > 0) {
      for (const v of [-1, 1]) {
        B(q, 'trim', v * 2.45, 9.0, 0.14, 0.38, 4.0, 0.24, pale);
        B(q, 'trim', v * 0.16, 9.0, 0.14, 0.25, 4, 0.24, pale);
      }
      if (d > 1)
        for (const v of [-1, 1]) B(q, 'trim', v * 1.18, 10.65, -0.32, 1.95, 0.12, 0.1, pale);
      B(q, 'trim', 0, 12.72, 0.22, 5.6, 0.32, 0.6, pale);
      const crest = curve(
        [
          [-2.8, 13.05],
          [-1.9, 13.25],
          [-1.7, 14.5],
          [-1.1, 14.6],
          [-0.8, 16.25],
          [0, 17],
          [0.8, 16.25],
          [1.1, 14.6],
          [1.7, 14.5],
          [1.9, 13.25],
          [2.8, 13.05],
        ],
        d === 1 ? 1 : 3,
      );
      line(q, d, crest, 0.15, pale, 0.16, 'relief');
      annulus(q, d, 0, 15.1, 0.13, 0.94, 0.14, pale, 0, Math.PI * 2);
      for (let y = 14.5; y < 15.8; y += 0.2)
        line(
          q,
          0,
          [
            [-0.55, y],
            [0.55, y],
          ],
          -0.35,
          steel,
          0.035,
          'metal',
        );
    }
    if (d > 1) {
      for (const v of [-1, 1]) {
        scroll(q, d, v * 1.9, 14.3, 0.2, 0.85);
        leaf(q, d, v * 0.8, 16.0, 0.2, 0.6, 0.75, -v * 0.5);
      }
      shellMotif(q, d, 0, 13.1, 0.25, 1.2);
    }
    // Lower side entry remains a recessed barred gate behind the peristyle.
    B(q, 'metal', 0, F, -0.53, 2.5, 4.3, 0.04, dark);
    if (d > 0)
      for (let x = -1.1; x < 1.2; x += 0.24) B(q, 'metal', x, F, -0.2, 0.035, 4.3, 0.035, steel);
  }
  for (const s of [-1, 1])
    for (const x of [s * 7.5, s * 10.85]) B(o, 'trim', x, F, 0.18, 0.48, 6.35, 0.5, pale);
  B(o, 'wall', -7.57, F, -0.15, 2.55, 5.7, 0.5, pale);
  B(o, 'wall', 7.57, F, -0.15, 2.55, 5.7, 0.5, pale);
  // Separate stage apron and paired stair flights; no audience plaza slab.
  B(o, 'trim', 0, -4, 0.92, W + 0.7, 4 + F, 1.84, pale);
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 1.3),
      z = 1.65;
    for (let j = 0; j < 9; j++) {
      const zz = z + 3.24 - j * 0.36,
        top = F - (8 - j) * 0.2;
      B(o, 'trim', x, -4, zz, 2.3, 4 + top, 0.37, stoneblue);
    }
    if (d > 0) {
      for (const v of [-1, 1]) {
        const xx = x + v * 1.03;
        line(
          o,
          0,
          [
            [xx, F + 1],
            [xx, F - 0.05],
          ],
          1.45,
          steel,
          0.05,
          'metal',
        );
        rod(o, 0, 'metal', [xx, F + 1, 1.45], [xx, F + 0.2, 3.4], 0.05, steel);
      }
    }
  }
}
function mainArch(o, d) {
  const n = [8, 16, 32, 64][d],
    hole = arch(0, F, 12.7, 12.9 - F, n);
  flat(
    o,
    'shutter',
    hole.map((p) => [...p, -0.8]),
    shutter,
  );
  if (d > 0) {
    for (let y = F + 0.12; y < 12.8; y += d === 1 ? 0.32 : d === 2 ? 0.15 : 0.07) {
      const dy = Math.max(0, y - 6.55),
        half = dy ? Math.sqrt(Math.max(0, 6.35 * 6.35 - dy * dy)) : 6.35;
      line(
        o,
        0,
        [
          [-half, y],
          [half, y],
        ],
        -0.785,
        cream,
        d === 3 ? 0.015 : 0.023,
        'shutter',
      );
    }
  }
  annulus(o, d, 0, 6.3, 0.1, 6.73, 0.3, pale);
  annulus(o, d, 0, 6.3, 0.1, 8.65, 0.23, pale);
  if (d === 0) {
    annulus(o, 0, 0, 6.3, -0.3, 8.3, 1.1, shade);
    return;
  }
  // Deep dark backing is behind open pierced rosette/petal tracery, never across the front holes.
  annulus(o, d, 0, 6.3, -0.95, 8.4, 1.72, dark, 0, Math.PI, 'shutter');
  const flowers = 11;
  for (let i = 0; i < flowers; i++) {
    const a = ((i + 0.5) / flowers) * Math.PI,
      x = Math.cos(a) * 7.63,
      y = 6.3 + Math.sin(a) * 7.63;
    flower(o, d, x, y, 0.15, d === 1 ? 0.69 : 0.73);
    if (d > 1) {
      for (const rr of [
        [8.26, 8.51],
        [6.65, 6.98],
      ])
        line(
          o,
          0,
          rr.map((r) => [Math.cos(a) * r, 6.3 + Math.sin(a) * r]),
          0.18,
          pale,
          0.07,
          'relief',
        );
    }
  }
  if (d > 1)
    for (let i = 1; i < flowers; i++) {
      const a = (i / flowers) * Math.PI,
        point = (u, v, z) => [
          Math.cos(a) * (7.63 + u) - Math.sin(a) * v,
          6.3 + Math.sin(a) * (7.63 + u) + Math.cos(a) * v,
          z,
        ],
        outer = ellipse(0, 0, 0.22, 0.4, 12).map(([u, v]) => point(u, v, 0.24)),
        hole = ellipse(0, 0, 0.1, 0.25, 8).map(([u, v]) => point(u, v, 0.24));
      flat(o, 'relief', outer, pale, [0, 0, 1], [hole]);
      if (d > 2) {
        flat(
          o,
          'relief',
          outer.map((p) => [p[0], p[1], 0.14]),
          pale,
          [0, 0, -1],
          [hole.map((p) => [p[0], p[1], 0.14])],
        );
        for (const ring of [outer, hole])
          for (let j = 0; j < ring.length; j++) {
            const a = ring[j],
              b = ring[(j + 1) % ring.length],
              p = [a, b, [b[0], b[1], 0.14], [a[0], a[1], 0.14]];
            quad(o, 'relief', p, normalFor(...p), cream);
          }
      }
    }
  for (const s of [-1, 1]) {
    const x = s * 9.6;
    B(o, 'shutter', x, 1.55, 0.06, 1.25, 2.55, 0.07, dark);
    if (d > 0) {
      line(o, 0, rect(x, 1.45, 1.55, 2.75), 0.15, pale, 0.11, 'trim', true);
      shellMotif(o, d, x, 4.2, 0.18, 1.25);
      for (const v of [-1, 1]) {
        B(o, 'trim', x + v * 1.04, 1.3, 0.3, 0.22, 4.65, 0.25, pale);
        if (d > 1)
          for (let y = 1.5; y < 5.6; y += 0.65) {
            flower(o, d, x + v * 1.04, y, 0.45, 0.16);
            leaf(o, d, x + v * 1.04, y + 0.15, 0.44, 0.2, 0.35);
          }
      }
    }
    B(o, 'glass', s * 7.5, 1.5, 0.12, 0.95, 2.7, 0.04, glass);
    B(o, 'glass', s * 7.5, 4.45, 0.12, 0.95, 0.75, 0.04, dark);
    if (d > 0) {
      line(o, 0, rect(s * 7.5, 1.4, 1.2, 4.0), 0.18, pale, 0.13, 'trim', true);
      capital(o, d, s * 8.5, 5.65, 0.28, 0.26);
      capital(o, d, s * 10.7, 5.65, 0.28, 0.26);
    }
  }
}
function crest(o, d, x, y, z, w = 1.4) {
  const ps = curve(
    [
      [-w * 0.8, 0],
      [-w * 0.8, 0.3],
      [-w * 0.5, 0.4],
      [-w * 0.4, 0.9],
      [0, 1.15],
      [w * 0.4, 0.9],
      [w * 0.5, 0.4],
      [w * 0.8, 0.3],
      [w * 0.8, 0],
    ],
    d === 0 ? 1 : d === 1 ? 1 : 4,
  ).map(([u, v]) => [x + u, y + v]);
  panel(o, 'trim', ps, z - 0.08, z + 0.08, pale);
  if (d > 1) {
    line(o, d, ps, z + 0.13, cream, 0.08, 'relief');
    shellMotif(o, d, x, y + 0.18, z + 0.16, w * 0.55);
    for (const v of [-1, 1]) scroll(o, d, x + v * w * 0.45, y + 0.55, z + 0.14, w * 0.65);
  }
}
function mainCornice(o, d) {
  if (d === 0) {
    const top = frontProfile().slice(2, 9);
    line(o, 0, top, 0.12, pale, 0.35, 'trim');
    for (const x of [-W / 2, 0, W / 2])
      urn(o, 0, x, x === 0 ? 21.3 : 18.8, 0.1, x === 0 ? 1.7 : 1.4);
    return;
  }
  const top = frontProfile().slice(2, 9),
    segments = [
      top,
      [
        [-W / 2, 18.55],
        [W / 2, 18.55],
      ],
    ];
  for (const [j, ps] of segments.entries()) {
    const q = j === 0 ? o : transform(o, Math.PI, 0, -D);
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i],
        p = [
          [a[0], a[1] - 0.3],
          [b[0], b[1] - 0.3],
          [b[0], b[1] + 0.2],
          [a[0], a[1] + 0.2],
        ];
      panel(q, 'trim', p, -0.03, 0.25, pale);
      if (d > 0) {
        line(
          q,
          0,
          [
            [a[0], a[1] - 0.65],
            [b[0], b[1] - 0.65],
          ],
          0.15,
          cream,
          0.15,
          'trim',
        );
        if (d > 2) {
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
            N = Math.ceil(len / 0.45);
          for (let k = 0; k < N; k++) {
            const t = (k + 0.5) / N,
              x = a[0] + (b[0] - a[0]) * t,
              y = a[1] + (b[1] - a[1]) * t;
            shellMotif(q, d, x, y - 0.78, 0.2, 0.25);
          }
        }
      }
    }
  }
  for (const s of [-1, 1]) {
    B(o, 'trim', s * (W / 2 + 0.02), 18.16, -D / 2, 0.4, 0.4, D + 0.4, pale);
    urn(o, d, s * (W / 2 - 0.08), 18.8, 0.1, 1.4);
    if (d > 0) {
      crest(o, d, s * 9.5, 6.55, 0.15, 1.25);
      crest(o, d, (s * W) / 2, 18.48, -D, 0.55);
    }
  }
  crest(o, d, 0, 21.0, 0.1, 1.1);
  urn(o, d, 0, 22.05, 0.1, 0.95);
}
function terminals(o, d) {
  if (d === 0) {
    for (const p of frame.authoredComponents.terminals)
      for (const zz of [-2.5, 2.5])
        for (const xx of [-1.85, 1.85]) column(o, 0, p.x + xx, p.z + zz);
    return;
  }
  for (const p of frame.authoredComponents.terminals) {
    const { x, z } = p,
      w = 6.65,
      dep = 5.05;
    for (const xx of [-w / 2 + 0.33, w / 2 - 0.33])
      for (const zz of [-dep / 2 + 0.28, dep / 2 - 0.28]) {
        B(o, 'wall', x + xx, F, z + zz, 0.66, 6.5, 0.66, pale);
        if (d > 2) {
          const q = transform(o, 0, x + xx, z + zz + 0.35);
          for (let y = F + 0.4; y < 6.5; y += 0.7) {
            leaf(q, d, 0, y, 0.01, 0.2, 0.5);
            flower(q, d, 0, y + 0.3, 0.02, 0.15);
          }
        }
      }
    for (const zz of [-dep / 2, dep / 2]) {
      for (const xx of [-1.85, 1.85]) column(o, d, x + xx, z + zz, F, 7.05, 0.36);
      const q = transform(o, zz > 0 ? 0 : Math.PI, x, z + zz);
      if (d > 0) {
        const n = [4, 4, 12, 24][d],
          p = [
            [-2.15, 6.1],
            ...Array.from({ length: n + 1 }, (_, i) => {
              const a = Math.PI - (i / n) * Math.PI;
              return [2.1 * Math.cos(a), 6.1 + 0.85 * Math.sin(a)];
            }),
            [2.15, 6.1],
            [2.15, 7.6],
            [-2.15, 7.6],
          ];
        panel(q, 'trim', p, 0.05, 0.2, pale);
      }
      crest(q, d, 0, 7.65, 0.05, 2.6);
      for (const v of [-1, 0, 1]) urn(q, d, v * 2.6, 8.15 + (v === 0 ? 1.05 : 0.1), 0, 0.95);
    }
    // North steps are in the actual open portal, with the native base buried under the lower terrain.
    for (let j = 0; j < 8; j++) {
      const zz = z + dep / 2 + 2.72 - j * 0.34,
        top = F - (7 - j) * 0.2;
      B(o, 'trim', x, -4, zz, 4.0, 4 + top, 0.35, stoneblue);
    }
  }
}
function build(o, d) {
  colonnades(o, d);
  mainShell(o, d);
  mainArch(o, d);
  mainCornice(o, d === 2 ? 1 : d);
  terminals(o, d);
}
export const spreckelsOrganPavilion = (o) => build(o, 3),
  spreckelsOrganPavilionStreet = (o) => build(o, 2),
  spreckelsOrganPavilionDistrict = (o) => build(o, 1),
  spreckelsOrganPavilionSkyline = (o) => build(o, 0);
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  relief: { slot: 'trim', localRef: ref, roughness: 0.82, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.35, metallic: 0.1 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.2, doubleSided: true },
  shutter: { slot: 'door', localRef: ref, roughness: 0.78, metallic: 0.1 },
};
export const spreckelsOrganPavilionModel = {
  id: 'spreckels_organ_pavilion',
  key: 'spreckels_organ_pavilion',
  recipe: 'structure-spreckels-organ-pavilion.mjs',
  cell: '9m/9mu',
  title: 'Spreckels Organ Pavilion',
  brief:
    'Closed-shutter Spreckels Organ Pavilion: native central rectangular organ house and U-shaped paired-row Corinthian colonnades/terminal portals. Giant round arch with true pierced original floral rosettes/petal tracery and raised moldings, inset ribbed shutter, decorated lower pilasters/plain inset plaques/door+transom bays and shell pediments. Curved triangular central parapet/shell cornice/urns, twin side window recesses/round louver/curved crest and lower barred side entry. Open colonnade bays/coffered ceiling/turned-baluster parapets/urn piers; free terminal columns/flanking relief piers/segmental portal crest/urns and north stairs. Stage apron/paired side stair flights retain independent ground, no plaza seating/fountain/neighbors/interior/organ pipes/flags/art text.',
  camera: [77, 42, 79],
  lookAt: [0, 8, 0],
  qaCameras: [
    { name: 'front', position: [0, 12, 50], lookAt: [0, 10, 0] },
    { name: 'arch-detail', position: [13, 12, 23], lookAt: [0, 10, 0.1] },
    { name: 'plaque-detail', position: [14, 4, 10], lookAt: [9.6, 3.2, 0.2] },
    { name: 'colonnade-detail', position: [23, 4, 15], lookAt: [25, 4, -2] },
    { name: 'terminal-detail', position: [52, 7, 35], lookAt: [38, 5, 18] },
    { name: 'side-detail', position: [28, 13, -3], lookAt: [W / 2, 12, -D / 2] },
    { name: 'roof-detail', position: [-36, 32, -22], lookAt: [0, 13, -6] },
    { name: 'back', position: [24, 23, -38], lookAt: [0, 9, -8] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -4 },
  build: spreckelsOrganPavilion,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Unchanged original Terrariumtile/independent review grid; dry audience approach[0,4] datum80.7054m. Main/colonnade floor+.55m, buried-4m foundation and separate stairs follow photographed raised walkway. Urban elevation/actual threshold engineering and host terrain compatibility unmeasured. No terrain flattening/model-fitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-spreckels-organ-pavilion.mjs',
    level: 'skyline',
    export: 'spreckelsOrganPavilionSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'spreckelsOrganPavilionDistrict', errorMeters: 1, surfaces },
      street: { export: 'spreckelsOrganPavilionStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    '13baywing rhythm with12free columns per row is photo-counted approximation; actual irregular native outline controls floor/roof strip. Native23mcentralpart/top used nominally; facade profile/cornice/column7.05m/roof7.65m/balustrade8.75m/steps and relief are not surveyed.',
    'Chosen closed shutter omits performance interior/organ pipes; inset plain plaques omit actual text. Fine Corinthian/shell/flower forms are original abstractions. Closed-shutter/side appearance follows the verified creator-CC0 oblique; hidden rear facade and roof service details remain conservative interpretations of native mapped massing, not photographic replicas. Earlier CC/aerial/plan/report imagery is excluded.',
  ],
};
export { colonnades, mainArch, mainCornice, mainShell, terminals };
