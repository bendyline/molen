/** Ghent civic belfry, skeletal clocks, pierced gallery and attached eleven-bay Cloth Hall. */
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
  if (slot === 'metal' || slot === 'gold') {
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
    rod(
      o,
      ['trim', 'wall'].includes(slot) ? 0 : d === 3 ? 3 : 0,
      slot,
      [...a, z],
      [...b, z],
      w,
      col,
    );
  }
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
const root = new URL(
    '../../../content/worldgen/source/places/u1/u14/belfry_of_ghent/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff',
  stone = rgb('aaa99e'),
  pale = rgb('c6c6b8'),
  shade = rgb('83867e'),
  hallstone = rgb('c9c4af'),
  dark = rgb('282f2e'),
  slate = rgb('4c5c61'),
  gold = rgb('bda459'),
  red = rgb('714b3c'),
  glass = rgb('46534e'),
  joint = rgb('95968b');
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
if (
  frame.features.flatMap((f) => f.rings.flat()).some((p) => sample(...p) < -3 || sample(...p) > 0.9)
)
  throw Error('Native terrain exceeds Ghent footing envelope');
function rect(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
function ellipse(x, y, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * 2 * Math.PI) / n),
    y + ry * Math.sin((i * 2 * Math.PI) / n),
  ]);
}
function pointed(x, y, w, h, n = 6) {
  const r = w / 2,
    spring = y + h - w * 0.85;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [x + r * (1 - t), spring + (h + y - spring) * Math.sin((t * Math.PI) / 2)];
    }),
    ...Array.from({ length: n }, (_, i) => {
      const t = (i + 1) / n;
      return [x - r * t, y + h - (h + y - spring) * (1 - Math.cos((t * Math.PI) / 2))];
    }),
  ];
}
function surface(o, slot, ps, z, col) {
  flat(
    o,
    slot,
    ps.map((p) => [...p, z]),
    col,
  );
}
function wall(o, ps, z, holes, depth, col = stone) {
  for (const [zz, n] of [
    [z, [0, 0, 1]],
    [z - depth, [0, 0, -1]],
  ])
    flat(
      o,
      'wall',
      ps.map((p) => [...p, zz]),
      col,
      n,
      holes.map((h) => h.map((p) => [...p, zz])),
    );
  for (const h of holes)
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length],
        ps = [
          [...a, z],
          [...b, z],
          [...b, z - depth],
          [...a, z - depth],
        ];
      quad(o, 'trim', ps, normalFor(...ps), shade);
    }
}
function ring(
  o,
  d,
  x,
  y,
  z,
  r,
  w,
  col = gold,
  slot = 'gold',
  n = d === 0 ? 12 : d === 1 ? 20 : d === 2 ? 40 : 64,
) {
  const points = ellipse(x, y, r, r, n);
  line(o, d, points, z, col, w, slot, true);
}
function round(o, x, z, ys, n = 8, slot = 'trim', col = pale) {
  loft(
    o,
    slot,
    ys.map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8)),
    col,
  );
}
function pinnacle(o, d, x, z, y, h, col = hallstone) {
  round(
    o,
    x,
    z,
    [
      [y, 0.22 * h],
      [y + 0.12 * h, 0.23 * h],
      [y + 0.75 * h, 0.045 * h],
      [y + 0.82 * h, 0.045 * h],
    ],
    4,
    'trim',
    col,
  );
  if (d > 2)
    for (let k = 1; k <= 4; k++)
      for (const sign of [-1, 1]) {
        const yy = y + h * (0.2 + k * 0.12),
          r = h * (0.18 - k * 0.025);
        rod(o, d, 'trim', [x + sign * r, yy, z], [x + sign * (r + 0.13), yy + 0.16, z], 0.1, col);
      }
  rod(o, d, 'trim', [x, y + 0.78 * h, z], [x, y + h, z], 0.1, col);
}
function window(o, d, x, y, z, w, h, { col = stone, shutters = false, blind = false } = {}) {
  const p = pointed(x, y, w, h, d > 2 ? 8 : 3);
  surface(o, 'glass', p, z - 0.48, dark);
  if (blind && d > 1) {
    surface(
      o,
      'trim',
      pointed(x, y + h - w * 0.85, w, h - (h - w * 0.85), d > 2 ? 6 : 2),
      z - 0.09,
      col,
    );
    if (d > 2)
      for (const [dx, dy] of [
        [-0.18, -0.12],
        [0.18, -0.12],
        [0, 0.17],
      ])
        surface(
          o,
          'glass',
          ellipse(x + dx, y + h - w * 0.48 + dy, 0.23, 0.22, 12),
          z - 0.075,
          shade,
        );
  }

  if (d > 0) {
    line(o, d, p, z + 0.035, pale, 0.14, 'trim', true);
    if (d > 2)
      line(o, d, pointed(x, y - 0.08, w + 0.3, h + 0.25, 8), z + 0.055, col, 0.11, 'trim', true);
    B(o, 'trim', x, y, z - 0.15, 0.1, h - w * 0.65, 0.45, pale);
    if (d > 2) {
      const r = w * 0.18;
      ring(o, 0, x, y + h - w * 0.48, z - 0.1, r, 0.07, pale, 'trim', 16);
      for (const sign of [-1, 1])
        line(
          o,
          0,
          pointed(x + sign * w * 0.25, y, w * 0.43, h - w * 0.45, 6),
          z - 0.1,
          pale,
          0.06,
          'trim',
        );
    }
    if (shutters) {
      for (const sign of [-1, 1]) {
        surface(
          o,
          'wood',
          rect(x + sign * w * 0.24, y + 0.1, w * 0.43, h - w * 0.9),
          z - 0.37,
          shade,
        );
        for (let j = 0; j < (d > 1 ? 5 : 2); j++) {
          const yy = y + 0.3 + (j * (h - w * 1.25)) / (d > 1 ? 5 : 2);
          line(
            o,
            0,
            [
              [x + sign * 0.08, yy],
              [x + sign * w * 0.44, yy + 0.55],
            ],
            z - 0.32,
            gold,
            0.16,
            'gold',
          );
        }
      }
    } else if (!blind && d > 1) {
      for (let j = 0; j < (d > 2 ? 7 : 3); j++)
        B(
          o,
          'metal',
          x,
          y + 0.35 + (j * (h - w * 0.8)) / (d > 2 ? 7 : 3),
          z - 0.32,
          w * 0.88,
          0.055,
          0.05,
          dark,
        );
    }
  }
}
function shaft(o, d) {
  const tw = 15.45,
    td = 12.1;
  poly(o, 'wall', frame.authoredComponents.tower, -3, 51.4, stone);
  // The low skyline retains visible paired lancets; nearer levels use actual recessed shell below.
  if (d === 0) {
    for (let f = 0; f < 4; f++) {
      const q = transform(o, (f * Math.PI) / 2),
        w = f % 2 ? td : tw,
        z = f % 2 ? tw / 2 : td / 2;
      for (const y of [10, 24, 38])
        for (const x of [-w * 0.25, w * 0.25])
          surface(q, 'glass', pointed(x, y, 1.8, 9, 2), z + 0.015, dark);
    }
    return;
  }
}
function towerMasonry(o, d) {
  const tw = 15.45,
    td = 12.1;
  if (d === 0) {
    shaft(o, d);
    return;
  } // Hollow shell gives the lancets true .65m-deep reveals.
  if (d === 1) {
    shaft(o, 0);
    for (let f = 0; f < 4; f++) {
      const q = transform(o, (f * Math.PI) / 2),
        w = f % 2 ? 12.1 : 15.45,
        z = f % 2 ? 7.725 : 6.05;
      for (const y of [9.5, 20.1, 23.5, 34.1, 37.5, 48.1, 51])
        B(q, 'trim', 0, y, z + 0.07, w + 0.15, 0.16, 0.23, pale);
      for (const y of [10, 24, 38])
        for (const x of [-w * 0.25, w * 0.25])
          line(q, 0, pointed(x, y, 1.8, 9, 2), z + 0.04, pale, 0.13, 'trim', true);
    }
    return;
  }
  B(o, 'wall', 0, -3, 0, tw, 12.5, td, stone);
  B(o, 'wall', 0, 48.2, 0, tw, 3.2, td, stone);
  for (let f = 0; f < 4; f++) {
    const q = transform(o, (f * Math.PI) / 2),
      w = f % 2 ? td : tw,
      z = f % 2 ? tw / 2 : td / 2;
    const holes = [];
    for (const y of [10, 24, 38])
      for (const x of [-w * 0.25, w * 0.25]) holes.push(pointed(x, y, 2.1, 9.7, d > 2 ? 8 : 3));
    wall(q, rect(0, 9.5, w, 38.7), z, holes, 0.65);
    for (const y of [10, 24, 38])
      for (const x of [-w * 0.25, w * 0.25]) window(q, d, x, y, z, 2.1, 9.7, { shutters: y < 38 });
    for (const y of [9.5, 20.1, 23.5, 34.1, 37.5, 48.1, 51.0])
      B(q, 'trim', 0, y, z + 0.07, w + 0.15, 0.16, 0.23, pale);
    if (d > 2) {
      for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2])
        B(q, 'trim', x, 9.5, z + 0.035, 0.16, 41.5, 0.14, shade);
      for (let row = 0; row < 47; row++) {
        const y = 10 + row * 0.85;
        for (const x of [-w * 0.43, 0, w * 0.43]) {
          if ([10, 24, 38].some((a) => y > a && y < a + 10) && Math.abs(x) > w * 0.15) continue;
          surface(q, 'wall', rect(x + (row % 2 ? 0.3 : 0), y, 1.6, 0.035), z + 0.005, joint);
        }
      }
    }
  }
  // Surviving sealed southwest portal; no invented ground-level through entrance.
  const q = transform(o, -Math.PI / 2);
  surface(q, 'glass', pointed(0, 0.9, 2.5, 5.1, 8), 7.735, dark);
  line(q, d, pointed(0, 0.9, 2.65, 5.3, 8), 7.81, pale, 0.22, 'trim', true);
  if (d > 2) {
    B(q, 'wood', 0, 0.9, 7.78, 2.25, 3.5, 0.05, red);
    for (let k = 0; k < 7; k++) B(q, 'metal', -0.9 + k * 0.3, 0.9, 7.83, 0.03, 3.5, 0.04, dark);
  }
}
function clock(o, d, z) {
  const y = 60.3,
    r = 2.85;
  for (const rr of [r, r * 0.68]) ring(o, d, 0, y, z, rr, d === 0 ? 0.12 : 0.085);
  if (d === 0) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      line(
        o,
        0,
        [
          [Math.sin(a) * r * 0.73, y + Math.cos(a) * r * 0.73],
          [Math.sin(a) * r * 0.98, y + Math.cos(a) * r * 0.98],
        ],
        z,
        gold,
        0.11,
        'gold',
      );
    }
  } else {
    const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        ca = Math.cos(a),
        sa = Math.sin(a),
        glyphs = romans[i],
        scale = 0.28;
      const at = (x, y0) => [sa * r * 0.84 + ca * x, y + ca * r * 0.84 - sa * x + y0 * ca];
      const stroke = (a0, b0) => {
        const t = (p) => [
          sa * r * 0.84 + ca * p[0] + sa * p[1],
          y + ca * r * 0.84 - sa * p[0] + ca * p[1],
        ];
        line(o, d, [t(a0), t(b0)], z, gold, 0.06, 'gold');
      };
      for (let j = 0; j < glyphs.length; j++) {
        const x = (j - (glyphs.length - 1) / 2) * 0.2,
          g = glyphs[j];
        if (g === 'I') stroke([x, -scale], [x, scale]);
        else if (g === 'V') {
          stroke([x - 0.095, scale], [x, -scale]);
          stroke([x, -scale], [x + 0.095, scale]);
        } else {
          stroke([x - 0.1, -scale], [x + 0.1, scale]);
          stroke([x + 0.1, -scale], [x - 0.1, scale]);
        }
        if (d > 2) {
          stroke([x - 0.1, scale], [x + 0.1, scale]);
          stroke([x - 0.1, -scale], [x + 0.1, -scale]);
        }
      }
      void at;
    }
  }
  for (const [a, l, w] of [
    [Math.PI * 0.4, 2.5, 0.12],
    [-Math.PI * 0.29, 1.8, 0.16],
  ]) {
    const p = [Math.sin(a) * l, y + Math.cos(a) * l];
    line(o, d, [[0, y], p], z + 0.07, gold, w, 'gold');
    if (d > 2) {
      ring(o, 0, p[0], p[1], z + 0.08, 0.13, 0.06, gold, 'gold', 8);
      line(
        o,
        0,
        [
          [-Math.sin(a) * 0.45, y - Math.cos(a) * 0.45],
          [0, y],
        ],
        z + 0.07,
        gold,
        0.22,
        'gold',
      );
    }
  }
  if (d > 0) ring(o, d, 0, y, z + 0.1, 0.17, 0.11, gold, 'gold', 12);
}
function balcony(o, d) {
  B(o, 'trim', 0, 51.4, 0, 16.4, 0.35, 13.0, pale);
  B(o, 'trim', 0, 51.75, 0, 16.85, 0.26, 13.45, pale);
  B(o, 'trim', 0, 52.01, 0, 16.5, 0.24, 13.1, stone);
  for (let f = 0; f < 4; f++) {
    const q = transform(o, (f * Math.PI) / 2),
      w = f % 2 ? 12.5 : 15.9,
      z = f % 2 ? 8.1 : 6.4;
    B(q, 'trim', 0, 52.25, z, w, 0.18, 0.3, pale);
    B(q, 'trim', 0, 54.35, z, w, 0.23, 0.34, pale);
    if (d === 0) B(q, 'trim', 0, 52.43, z, w, 1.92, 0.15, shade);
    else {
      const count = f % 2 ? 6 : 8;
      for (let i = 0; i <= count; i++) {
        const x = -w / 2 + (i * w) / count;
        B(q, 'trim', x, 52.43, z, 0.15, 1.92, 0.3, pale);
      }
      if (d > 2)
        for (let i = 0; i < count; i++) {
          const x = -w / 2 + ((i + 0.5) * w) / count,
            cy = 53.78,
            rr = 0.23;
          ring(q, 0, x, cy, z + 0.025, rr, 0.08, pale, 'trim', 16);
          for (const sign of [-1, 1])
            ring(q, 0, x + sign * 0.18, cy - 0.18, z + 0.025, 0.18, 0.065, pale, 'trim', 12);
          B(q, 'trim', x, 52.55, z, 0.065, 0.78, 0.12, pale);
        }
    }
    if (d > 0)
      for (let i = 0; i < 5; i++) {
        const x = -w * 0.4 + i * w * 0.2;
        rod(q, d, 'trim', [x, 51.65, z + 0.05], [x, 51.35, z + 0.85], 0.18, shade);
        if (d > 1)
          round(
            q,
            x,
            z + 0.82,
            [
              [51.21, 0.15],
              [51.45, 0.22],
            ],
            6,
            'trim',
            shade,
          );
      }
  }
}
function upperTower(o, d) {
  if (d < 3) {
    B(o, 'trim', 0, 51.4, 0, 16.7, 0.8, 13.3, pale);
    for (let f = 0; f < 4; f++) {
      const q = transform(o, (f * Math.PI) / 2),
        w = f % 2 ? 8.3 : 11.8,
        z = f % 2 ? 5.9 : 4.15;
      wall(q, rect(0, 54.5, w, 13.7), z, [pointed(0, 54.7, 4.2, 10.9, 1)], 0.65);
      if (d < 2)
        for (const rr of [2.85, 1.94])
          line(q, 0, ellipse(0, 60.3, rr, rr, 8), z + 0.48, gold, 0.13, 'gold', true);
      if (d < 2)
        for (const a of [0.4 * Math.PI, -0.29 * Math.PI])
          line(
            q,
            0,
            [
              [0, 60.3],
              [Math.sin(a) * 2.4, 60.3 + Math.cos(a) * 2.4],
            ],
            z + 0.5,
            gold,
            0.13,
            'gold',
          );
    }
    if (d > 0) balcony(o, d);
    for (const r of frame.authoredComponents.cornerTurrets) {
      const x = r.reduce((s, p) => s + p[0], 0) / r.length,
        z = r.reduce((s, p) => s + p[1], 0) / r.length;
      round(
        o,
        x,
        z,
        [
          [52, 1.65],
          [68.85, 1.65],
        ],
        6,
        'trim',
        pale,
      );
      round(
        o,
        x,
        z,
        [
          [68.85, 1.72],
          [74.1, 0.08],
        ],
        6,
        'roof',
        slate,
      );
    }
    if (d === 2)
      for (let f = 0; f < 4; f++) {
        const q = transform(o, (f * Math.PI) / 2),
          z = f % 2 ? 5.9 : 4.15;
        clock(q, 1, z + 0.48);
        line(q, 0, pointed(0, 54.7, 4.2, 10.9, 6), z + 0.055, pale, 0.23, 'trim', true);
      }
    if (d > 0)
      for (const r of frame.authoredComponents.cornerTurrets) {
        const x = r.reduce((s, p) => s + p[0], 0) / r.length,
          z = r.reduce((s, p) => s + p[1], 0) / r.length;
        for (let f = 0; f < 4; f++) {
          const q = transform(o, (f * Math.PI) / 2, x, z);
          for (const y of [55.2, 62.2, 66.6]) {
            surface(q, 'glass', rect(0, y, 0.52, 0.9), 1.54, dark);
            surface(
              q,
              'trim',
              [
                [-0.26, y],
                [0.26, y],
                [0, y + 0.45],
              ],
              1.55,
              pale,
            );
            surface(
              q,
              'trim',
              [
                [-0.26, y + 0.9],
                [0.26, y + 0.9],
                [0, y + 0.45],
              ],
              1.55,
              pale,
            );
          }
        }
        for (const y of [58.6, 66.9]) {
          const n = Math.hypot(x, z);
          rod(o, 0, 'metal', [x, y, z], [x + (x / n) * 5, y + 0.35, z + (z / n) * 5], 0.06, dark);
        }
      }
    return;
  }
  balcony(o, d);
  const widths = [11.8, 8.3];
  for (let f = 0; f < 4; f++) {
    const q = transform(o, (f * Math.PI) / 2),
      w = widths[f % 2],
      z = widths[(f + 1) % 2] / 2;
    const h = pointed(0, 54.7, 4.2, 10.9, d === 0 ? 2 : d === 1 ? 4 : 10);
    wall(q, rect(0, 54.5, w, 13.7), z, [h], 0.65);
    if (d > 0) {
      line(q, d, h, z + 0.045, pale, 0.25, 'trim', true);
      line(q, 0, pointed(0, 54.65, 4.75, 11.4, 10), z + 0.065, shade, 0.12, 'trim', true);
      for (let j = 0; j < 6; j++)
        B(q, 'metal', 0, 55.0 + j * 1.6, z - 0.45, 3.8, 0.065, 0.07, dark);
      for (const x of [-1.6, -0.8, 0, 0.8, 1.6])
        B(q, 'metal', x, 54.8, z - 0.45, 0.05, 8, 0.06, dark);
    }
    clock(q, d, z + 0.48);
    if (d > 0)
      for (let i = 0; i < 7; i++) {
        const x = ((i - 3) * (w - 2.0)) / 7,
          arc = pointed(x, 66.05, 0.9, 1.8, d > 1 ? 6 : 2);
        line(q, 0, arc, z + 0.06, pale, 0.08, 'trim');
        if (d > 1) {
          B(q, 'trim', x, 66.0, z + 0.07, 0.1, 0.4, 0.12, pale);
          ring(q, 0, x, 67.65, z + 0.09, 0.16, 0.055, pale, 'trim', 12);
        }
      }
    B(q, 'trim', 0, 68.1, z, w, 0.22, 0.35, pale);
  }
  const turrets = frame.authoredComponents.cornerTurrets.map((r) => [
    r.reduce((s, p) => s + p[0], 0) / r.length,
    r.reduce((s, p) => s + p[1], 0) / r.length,
  ]);
  for (const [x, z] of turrets) {
    round(
      o,
      x,
      z,
      [
        [52.0, 1.65],
        [54.6, 1.65],
        [54.8, 1.86],
        [55.05, 1.6],
        [60.9, 1.6],
        [61.1, 1.85],
        [61.35, 1.6],
        [68.4, 1.6],
        [68.6, 1.85],
        [68.85, 1.7],
      ],
      8,
      'wall',
      pale,
    );
    round(
      o,
      x,
      z,
      [
        [68.85, 1.72],
        [74.0, 0.16],
        [74.15, 0.08],
      ],
      8,
      'roof',
      slate,
    );
    rod(o, d, 'gold', [x, 74.1, z], [x, 76.0, z], 0.08, gold);
    if (d > 0)
      for (let f = 0; f < 8; f += 2) {
        const a = (f * Math.PI) / 4,
          q = transform(o, a, x, z);
        for (const y of [55.2, 62.2, 66.6]) {
          surface(q, 'glass', rect(0, y, 0.52, 0.9), 1.54, dark);
          surface(
            q,
            'trim',
            [
              [-0.26, y],
              [0.26, y],
              [0, y + 0.45],
            ],
            1.55,
            pale,
          );
          surface(
            q,
            'trim',
            [
              [-0.26, y + 0.9],
              [0.26, y + 0.9],
              [0, y + 0.45],
            ],
            1.55,
            pale,
          );
        }
        if (d > 1) {
          for (let y = 55; y < 68; y += 1.05)
            surface(q, 'trim', rect(0, y, 0.95, 0.03), 1.54, joint);
          const yy = 70.2;
          surface(q, 'glass', rect(0, yy, 0.48, 0.62), 1.25, dark);
          line(q, 0, rect(0, yy, 0.48, 0.62), 1.27, pale, 0.08, 'trim', true);
        }
      }
    if (d > 1) {
      for (let y = 70; y < 74; y += 0.7)
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          const rr = (74 - y) * 0.235;
          rod(
            o,
            0,
            'gold',
            [x + Math.sin(a) * rr, y, z + Math.cos(a) * rr],
            [x + Math.sin(a) * (rr + 0.18), y + 0.1, z + Math.cos(a) * (rr + 0.18)],
            0.08,
            gold,
          );
        }
    }
    if (d > 0)
      for (const y of [58.6, 66.9]) {
        const n = Math.hypot(x, z);
        rod(o, d, 'metal', [x, y, z], [x + (x / n) * 5, y + 0.35, z + (z / n) * 5], 0.06, dark);
      }
    if (d > 1) {
      round(
        o,
        x,
        z,
        [
          [75.0, 0.18],
          [75.3, 0.18],
        ],
        8,
        'gold',
        gold,
      );
      const a = Math.atan2(x, z),
        q = transform(o, a, x, z);
      surface(q, 'gold', rect(0.22, 75.5, 0.45, 0.4), 0, gold);
    }
  }
  if (d > 0)
    for (const x of [-7.7, 7.7])
      for (const z of [-6, 6]) {
        const n = Math.hypot(x, z),
          xx = x + (x / n) * 0.48,
          zz = z + (z / n) * 0.48;
        round(
          o,
          xx,
          zz,
          [
            [54.3, 0.3],
            [54.5, 0.3],
            [56.5, 0.2],
          ],
          d > 1 ? 8 : 4,
          'trim',
          pale,
        );
        round(
          o,
          xx,
          zz,
          [
            [56.5, 0.23],
            [57.0, 0.1],
          ],
          d > 1 ? 8 : 4,
          'trim',
          pale,
        );
        if (d > 1) {
          rod(o, 0, 'metal', [xx + 0.3, 54.6, zz], [xx + 0.3, 57.6, zz], 0.09, dark);
          B(o, 'trim', xx, 53.8, zz, 0.7, 0.5, 0.65, pale);
        }
      }
  // Twenty cornice gargoyles retained at nearer levels, simplified original animal-like silhouettes.
  if (d > 1)
    for (let f = 0; f < 4; f++) {
      const q = transform(o, (f * Math.PI) / 2),
        w = f % 2 ? 8.3 : 11.8,
        z = f % 2 ? 5.9 : 4.15;
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * w * 0.18;
        rod(q, d, 'trim', [x, 51.1, z], [x, 50.85, z + 1.2], 0.17, shade);
        B(q, 'trim', x, 50.85, z + 1.13, 0.22, 0.22, 0.32, pale);
      }
    }
}
function spire(o, d) {
  if (d === 2) {
    spire(o, 1);
    for (let f = 0; f < 4; f++) {
      const q = transform(o, (f * Math.PI) / 2),
        r = f % 2 ? 7.8 : 6;
      for (const [yy, offs] of [
        [71, [-1.5, 1.5]],
        [76.5, [-0.65, 0.65]],
        [81.1, [0]],
      ])
        for (const x of offs) {
          const rr = r * (1 - (yy - 68.2) / (15.9 / 0.72));
          B(q, 'wood', x, yy, rr, 0.6, 0.95, 0.3, dark);
          surface(q, 'glass', rect(x, yy, 0.45, 0.76), rr + 0.2, dark);
          line(q, 0, rect(x, yy, 0.45, 0.76), rr + 0.22, pale, 0.08, 'trim', true);
          surface(
            q,
            'trim',
            [
              [x - 0.2, yy],
              [x + 0.2, yy],
              [x, yy + 0.38],
            ],
            rr + 0.24,
            pale,
          );
          surface(
            q,
            'trim',
            [
              [x - 0.2, yy + 0.76],
              [x + 0.2, yy + 0.76],
              [x, yy + 0.38],
            ],
            rr + 0.24,
            pale,
          );
          surface(
            q,
            'roof',
            [
              [x - 0.35, yy + 0.95],
              [x, yy + 1.6],
              [x + 0.35, yy + 0.95],
            ],
            rr + 0.2,
            slate,
          );
          line(
            q,
            0,
            [
              [x - 0.35, yy + 0.95],
              [x, yy + 1.6],
              [x + 0.35, yy + 0.95],
            ],
            rr + 0.23,
            gold,
            0.06,
            'gold',
          );
        }
    }
    return;
  }
  if (d === 1) {
    spire(o, 0);
    for (let f = 0; f < 4; f++) {
      const q = transform(o, (f * Math.PI) / 2),
        r = f % 2 ? 7.8 : 6;
      for (const [yy, offs] of [
        [71, [-1.5, 1.5]],
        [76.5, [-0.65, 0.65]],
        [81.1, [0]],
      ])
        for (const x of offs) {
          const rr = r * (1 - (yy - 68.2) / (15.9 / 0.72));
          surface(q, 'trim', rect(x, yy, 0.45, 0.76), rr + 0.18, pale);
        }
      line(
        q,
        0,
        [
          [-0.85, 85.6],
          [0, 88.1],
          [0.85, 85.6],
        ],
        2.35,
        gold,
        0.12,
        'gold',
      );
    }
    return;
  }
  const shape = frame.authoredComponents.spire;
  const scaled = (y, sc) => [...shape].reverse().map(([x, z]) => [x * sc, y, z * sc]);
  loft(o, 'roof', [scaled(68.2, 1), scaled(84.1, 0.28)], slate);
  round(
    o,
    0,
    0,
    d === 0
      ? [
          [84.1, 2.55],
          [85.5, 2.5],
        ]
      : [
          [84.1, 2.55],
          [84.3, 2.65],
          [84.6, 2.35],
          [84.9, 2.6],
          [85.2, 2.25],
          [85.5, 2.5],
        ],
    8,
    'roof',
    slate,
  );
  round(
    o,
    0,
    0,
    [
      [85.5, 1.85],
      [89.0, 1.45],
      [89.3, 1.65],
      [93.2, 0.1],
    ],
    8,
    'roof',
    slate,
  );
  rod(o, d, 'gold', [0, 93.1, 0], [0, 94.1, 0], 0.09, gold);
  if (d > 0) {
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2,
        q = transform(o, a),
        r = f % 2 ? 7.8 : 6.0;
      for (const [yy, offs] of [
        [71, [-1.5, 1.5]],
        [76.5, [-0.65, 0.65]],
        [81.1, [0]],
      ])
        for (const x of offs) {
          const rr = r * (1 - (yy - 68.2) / (15.9 / 0.72));
          B(q, 'wood', x, yy, rr, 0.6, 0.95, 0.3, dark);
          surface(
            q,
            'trim',
            [
              [-0.35 + x, yy + 0.95],
              [x, yy + 1.6],
              [0.35 + x, yy + 0.95],
            ],
            rr + 0.2,
            slate,
          );
          line(
            q,
            0,
            [
              [-0.35 + x, yy + 0.95],
              [x, yy + 1.6],
              [0.35 + x, yy + 0.95],
            ],
            rr + 0.22,
            gold,
            0.06,
            'gold',
          );
          line(q, 0, rect(x, yy, 0.45, 0.76), rr + 0.17, pale, 0.08, 'trim', true);
          surface(
            q,
            'trim',
            [
              [-0.2 + x, yy],
              [x + 0.2, yy],
              [x, yy + 0.38],
            ],
            rr + 0.18,
            pale,
          );
          surface(
            q,
            'trim',
            [
              [-0.2 + x, yy + 0.76],
              [x + 0.2, yy + 0.76],
              [x, yy + 0.38],
            ],
            rr + 0.18,
            pale,
          );
          if (d > 1)
            round(
              q,
              x,
              rr + 0.21,
              [
                [yy + 1.58, 0.09],
                [yy + 1.78, 0.06],
              ],
              6,
              'gold',
              gold,
            );
        }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        q = transform(o, a),
        rad = 2.35;
      line(
        q,
        d,
        [
          [-0.85, 85.6],
          [0, 88.1],
          [0.85, 85.6],
        ],
        rad,
        gold,
        0.12,
        'gold',
      );
      rod(q, d, 'gold', [0, 87.9, rad], [0, 89.1, rad], 0.09, gold);
      if (d > 1) {
        ring(q, 0, 0, 86.8, rad + 0.03, 0.16, 0.06, gold, 'gold', 12);
        for (const sign of [-1, 1])
          line(
            q,
            0,
            [
              [sign * 0.8, 85.7],
              [sign * 1.0, 86.0],
              [sign * 1.13, 86.0],
            ],
            rad,
            gold,
            0.09,
            'gold',
          );
      }
    }
    for (let y = 90; y < 93.2; y += d > 1 ? 0.38 : 0.8)
      for (let a = 0; a < 4; a++) {
        const r = (93.3 - y) * 0.3,
          ang = (a * Math.PI) / 2;
        rod(
          o,
          0,
          'gold',
          [Math.sin(ang) * r, y, Math.cos(ang) * r],
          [Math.sin(ang) * (r + 0.16), y + 0.05, Math.cos(ang) * (r + 0.16)],
          0.065,
          gold,
        );
      }
  }
  const dragon = [
    [-1.5, 94.8],
    [-1.3, 94.3],
    [-0.8, 94.1],
    [-0.2, 94.0],
    [0.55, 94.14],
    [1.0, 94.45],
    [1.42, 94.45],
    [1.5, 94.57],
    [1.14, 94.72],
    [0.92, 94.73],
    [0.8, 94.65],
    [0.3, 94.58],
    [-0.28, 94.65],
    [-0.95, 94.75],
    [-1.25, 95.0],
  ];
  panel(o, 'gold', dragon, -0.16, 0.16, gold);
  if (d > 0) {
    panel(
      o,
      'gold',
      [
        [-0.35, 94.5],
        [-0.65, 95],
        [-0.08, 94.97],
        [0.48, 94.76],
        [0.35, 94.58],
        [0.05, 94.72],
        [-0.2, 94.58],
      ],
      -0.3,
      -0.22,
      gold,
    );
    for (const x of [-0.2, 0.3])
      rod(o, d, 'gold', [x, 94.18, 0.12], [x - 0.12, 93.94, 0.18], 0.075, gold);
    surface(o, 'glass', ellipse(1.15, 94.64, 0.045, 0.04, 8), 0.171, dark);
  }
}
function hall(o, d) {
  const x0 = -7.94,
    x1 = 34.59,
    z0 = 6.06,
    z1 = 18.76,
    zc = (z0 + z1) / 2,
    L = x1 - x0,
    cx = (x0 + x1) / 2;
  if (d === 1) {
    hall(o, 0);
    for (const sign of [-1, 1]) {
      const q = transform(o, sign === 1 ? 0 : Math.PI),
        basecx = sign === 1 ? cx : -cx,
        zz = sign === 1 ? z1 : -z0;
      for (let i = 0; i < 11; i++) {
        const x = basecx + ((i - 5) * L) / 11;
        surface(q, 'glass', pointed(x, 3.75, 2.28, 6, 2), zz + 0.02, dark);
        surface(q, 'glass', rect(x, 11.4, 2.25, 2.1), zz + 0.02, dark);
        B(q, 'trim', x, 3.8, zz + 0.06, 0.12, 4.45, 0.12, hallstone);
        B(q, 'trim', x, 6.1, zz + 0.06, 2.1, 0.13, 0.12, hallstone);
      }
      for (const y of [3.2, 10.6, 15.85]) B(q, 'trim', basecx, y, zz + 0.07, L, 0.16, 0.3, pale);
      for (let i = 0; i <= 11; i++)
        B(q, 'trim', basecx + ((i - 5.5) * L) / 11, 0, zz + 0.16, 0.42, 15.7, 0.65, hallstone);
    }
    return;
  }
  poly(o, 'wall', frame.authoredComponents.hall, -3, 3.0, hallstone);
  if (d === 0) {
    B(o, 'wall', cx, 3, zc, L, 13, z1 - z0, hallstone);
  } else {
    for (const [a, zz] of [
      [0, z1],
      [Math.PI, -z0],
    ]) {
      const q = transform(o, a),
        basecx = a ? -cx : cx,
        holes = [];
      for (let i = 0; i < 11; i++) {
        const x = basecx + ((i - 5) * L) / 11;
        if (a && x > -8.0 && x < 8.0) continue;
        holes.push(pointed(x, 3.75, 2.28, 6.0, d > 2 ? 8 : 3));
        holes.push(rect(x, 11.4, 2.25, 2.1));
      }
      wall(q, rect(basecx, 3, L, 13), zz, holes, 0.65, hallstone);
      for (let i = 0; i < 11; i++) {
        const x = basecx + ((i - 5) * L) / 11;
        if (a && x > -8.0 && x < 8.0) continue;
        window(q, d, x, 3.75, zz, 2.28, 6, { col: hallstone, blind: true });
        surface(q, 'wood', rect(x, 3.85, 1.98, 4.15), zz - 0.4, glass);
        B(q, 'wood', x, 3.8, zz - 0.22, 0.12, 4.45, 0.16, red);
        B(q, 'wood', x, 6.1, zz - 0.22, 2.1, 0.13, 0.16, red);
        surface(q, 'glass', rect(x, 11.4, 2.25, 2.1), zz - 0.47, dark);
        B(q, 'wood', x, 11.4, zz - 0.16, 0.1, 2.1, 0.14, red);
        if (d > 2) {
          B(q, 'trim', x, 8.8, zz - 0.03, 1.0, 0.14, 0.15, hallstone);
          ring(q, 0, x, 9.0, zz + 0.03, 0.23, 0.07, hallstone, 'trim', 12);
          surface(q, 'glass', rect(x, 0.65, 1.8, 1.7), zz + 0.02, glass);
          B(q, 'wood', x, 0.7, zz + 0.045, 0.08, 1.55, 0.05, red);
        }
      }
      for (const y of [3.2, 10.6, 14.0, 15.85])
        B(q, 'trim', basecx, y, zz + 0.07, L, 0.16, 0.3, pale);
      for (let i = 0; i <= 11; i++) {
        const x = basecx + ((i - 5.5) * L) / 11;
        B(q, 'wall', x, 0.0, zz + 0.18, 0.42, 10.5, 0.65, hallstone);
        B(q, 'trim', x, 10.5, zz + 0.12, 0.34, 4.95, 0.47, pale);
        if (d > 2) {
          B(q, 'trim', x, 3.0, zz + 0.35, 0.48, 0.15, 0.85, pale);
          B(q, 'trim', x, 10.3, zz + 0.3, 0.42, 0.18, 0.72, pale);
        }
      }
      if (d > 2)
        for (let i = 0; i < 33; i++) {
          const x = basecx + ((i - 16) * L) / 33;
          ring(q, 0, x, 14.9, zz + 0.13, 0.37, 0.07, hallstone, 'trim', 12);
        }
    }
  }
  // Two continuous slate roof slopes, capped end gables; no inverted roof normals.
  for (const sign of [-1, 1]) {
    const za = zc + (sign * (z1 - z0)) / 2;
    const p = [
      [x0, 16, za],
      [x1, 16, za],
      [x1, 25, zc],
      [x0, 25, zc],
    ];
    quad(o, 'roof', p, [0, 1, sign], slate);
  }
  for (const [x, a] of [
    [x0, -Math.PI / 2],
    [x1, Math.PI / 2],
  ]) {
    const q = transform(o, a, x, zc),
      w = z1 - z0;
    wall(
      q,
      [
        [-w / 2, -3],
        [w / 2, -3],
        [w / 2, 16],
        [0, 25],
        [-w / 2, 16],
      ],
      0,
      d > 1
        ? [
            ...[-w * 0.3, w * 0.3].flatMap((xx) => [
              pointed(xx, 3.7, 1.8, 6, d > 2 ? 8 : 3),
              pointed(xx, 11.5, 1.8, 2.5, d > 2 ? 8 : 3),
            ]),
            pointed(0, 3.7, 2.6, 6.1, d > 2 ? 8 : 3),
            ellipse(0, 20.2, 0.65, 0.9, 16),
          ]
        : [],
      0.4,
      hallstone,
    );
    if (d > 0) {
      for (const y of [3.7, 11.5])
        for (const xx of [-w * 0.3, w * 0.3])
          window(q, d, xx, y, 0.015, 1.8, y < 5 ? 6 : 2.5, { col: hallstone, blind: true });
      window(q, d, 0, 3.7, 0.018, 2.6, 6.1, { col: hallstone });
      line(
        q,
        d,
        [
          [-w / 2, 16],
          [0, 25],
          [w / 2, 16],
        ],
        0.1,
        pale,
        0.23,
        'trim',
      );
      for (let k = 1; k < 5; k++)
        B(q, 'trim', 0, 15 + k * 1.7, 0.06, Math.max(1.2, w - k * 2), 0.16, 0.2, pale);
      surface(q, 'glass', ellipse(0, 20.2, 0.65, 0.9, 16), 0.025, dark);
      for (let i = 0; i < 5; i++)
        pinnacle(
          q,
          d,
          ((i - 2) * w) / 4,
          0.1,
          14.6 + (i === 2 ? 10.2 : i % 2 ? 3 : 0),
          i === 2 ? 1.6 : 2.1,
        );
    }
  }
  for (const sign of [-1, 1])
    for (let i = 0; i < 11; i++) {
      const x = cx + ((i - 5) * L) / 11,
        z = zc + (sign * (z1 - z0)) / 2,
        q = transform(o, sign === 1 ? 0 : Math.PI);
      const xx = sign === 1 ? x : -x,
        zz = sign === 1 ? z : -z;
      if (d === 0) {
        surface(
          q,
          'trim',
          [
            [xx - 0.95, 16],
            [xx + 0.95, 16],
            [xx, 19.8],
          ],
          zz + 0.03,
          hallstone,
        );
        continue;
      }
      const ps = [
        [xx - 1.1, 15.9],
        [xx + 1.1, 15.9],
        [xx + 1.1, 17.35],
        [xx + 0.85, 17.35],
        [xx + 0.85, 17.95],
        [xx + 0.52, 17.95],
        [xx + 0.52, 18.55],
        [xx + 0.25, 18.55],
        [xx + 0.25, 19.1],
        [xx - 0.25, 19.1],
        [xx - 0.25, 18.55],
        [xx - 0.52, 18.55],
        [xx - 0.52, 17.95],
        [xx - 0.85, 17.95],
        [xx - 0.85, 17.35],
        [xx - 1.1, 17.35],
      ];
      wall(q, ps, zz + 0.08, [rect(xx, 16.15, 1.2, 1.15)], 0.5, hallstone);
      surface(q, 'wood', rect(xx, 16.15, 1.2, 1.15), zz - 0.3, red);
      B(q, 'trim', xx, 16.15, zz + 0.02, 0.1, 1.15, 0.18, pale);
      for (const dx of [-0.26, 0.26])
        surface(
          q,
          'trim',
          [
            [xx + dx - 0.18, 16.28],
            [xx + dx + 0.18, 16.28],
            [xx + dx, 16.55],
            [xx + dx + 0.18, 16.95],
            [xx + dx - 0.18, 16.95],
            [xx + dx, 16.55],
          ],
          zz - 0.24,
          gold,
        );
      const zz2 = zz - sign * 0 + -3.85,
        yy = 21.1;
      B(q, 'wood', xx, yy, zz2, 0.55, 0.7, 0.7, red);
      surface(
        q,
        'roof',
        [
          [xx - 0.4, yy + 0.7],
          [xx + 0.4, yy + 0.7],
          [xx, yy + 1.35],
        ],
        zz2 + 0.4,
        slate,
      );
      line(
        q,
        0,
        [
          [xx - 0.4, yy + 0.7],
          [xx, yy + 1.35],
          [xx + 0.4, yy + 0.7],
        ],
        zz2 + 0.42,
        dark,
        0.07,
        'metal',
      );
    }
  if (d > 0)
    for (const x of [x0, x1])
      for (const z of [z0, z1]) {
        round(
          o,
          x,
          z,
          [
            [14.8, 0.48],
            [15.5, 0.75],
            [15.8, 0.8],
            [16.0, 0.55],
            [18.1, 0.55],
            [18.25, 0.73],
            [18.5, 0.6],
            [21.0, 0.13],
          ],
          8,
          'trim',
          hallstone,
        );
        pinnacle(o, d, x, z, 20.8, 3.2);
        if (d > 2)
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            rod(
              o,
              0,
              'trim',
              [x + Math.sin(a) * 0.6, 18.4, z + Math.cos(a) * 0.6],
              [x + Math.sin(a) * 0.6, 19.1, z + Math.cos(a) * 0.6],
              0.07,
              hallstone,
            );
          }
      }
  // Split south gable stair approaches, capped below grade independently of the terrain.
  if (d > 0) {
    const q = transform(o, -Math.PI / 2, x0, zc);
    B(q, 'trim', 0, 3.6, 0.7, 3.8, 0.25, 1.8, pale);
    for (const sign of [-1, 1])
      for (let i = 0; i < 13; i++) {
        const x = sign * (1.55 + (13 - i) * 0.27),
          top = 0.48 + i * 0.26;
        B(q, 'trim', x, -1.3, 0.8, 0.29, top + 1.3, 1.55, hallstone);
        if (d > 2)
          rod(q, 0, 'metal', [x, top + 0.7, 1.6], [x - sign * 0.28, top + 0.96, 1.6], 0.055, dark);
      }
    for (const sign of [-1, 1])
      rod(q, d, 'metal', [sign * 5.1, 1.1, 1.6], [sign * 1.55, 4.4, 1.6], 0.06, dark);
  }
}
function annex(o, d) {
  const ps = frame.authoredComponents.annex,
    cx = 16.87;
  if (d === 0) {
    poly(o, 'wall', ps, -3, 5, hallstone);
    const q = transform(o, Math.PI, cx, 0);
    surface(
      q,
      'trim',
      [
        [-2.65, 5],
        [2.65, 5],
        [1.3, 8],
        [0, 10.9],
        [-1.3, 8],
      ],
      3.82,
      hallstone,
    );
    return;
  }
  poly(o, 'wall', ps, -3, 0.65, hallstone);
  const cut = [
    ...ps.slice(0, 4),
    [15.75, -3.705],
    [15.75, -3.06],
    [17.95, -3.01],
    [17.95, -3.655],
    ...ps.slice(4),
  ];
  poly(o, 'wall', cut, 0.65, 4.3, hallstone);
  poly(o, 'wall', ps, 4.3, 5.0, hallstone);
  const q = transform(o, Math.PI, cx, 0),
    shape = curve(
      [
        [-2.65, 5],
        [-2.1, 5.5],
        [-1.65, 7.5],
        [-1.3, 8],
        [-0.9, 10],
        [0, 10.9],
        [0.9, 10],
        [1.3, 8],
        [1.65, 7.5],
        [2.1, 5.5],
        [2.65, 5],
      ],
      d > 2 ? 4 : 2,
    ),
    profile = [[-2.65, 4.9], [2.65, 4.9], ...shape.slice().reverse()];
  if (d > 1) wall(q, profile, 3.82, [ellipse(0, 9.25, 0.3, 0.4, 12)], 0.17, hallstone);
  else panel(q, 'trim', profile, 3.65, 3.82, hallstone);
  if (d > 0) {
    line(q, 0, shape, 3.85, pale, 0.18, 'trim');
    const inner = shape.map(([x, y]) => [x * 0.92, 5 + (y - 5) * 0.9]);
    line(q, 0, inner, 3.86, pale, 0.11, 'trim');
    surface(q, 'glass', ellipse(0, 9.25, 0.3, 0.4, 12), d > 1 ? 3.6 : 3.84, dark);
    for (const x of [-1.8, 1.8]) surface(q, 'glass', rect(x, 5.7, 0.11, 0.7), 3.84, dark);
    surface(q, 'wood', rect(0, 0.65, 2.2, 3.65), 3.03, dark);
    for (const x of [-0.95, -0.45, 0, 0.45, 0.95])
      B(q, 'metal', x, 0.65, 3.15, 0.055, 3.65, 0.06, dark);
    B(q, 'trim', 0, 4.35, 3.98, 2.65, 0.25, 0.48, pale);
    for (const [x, y] of [
      [-0.5, 7.5],
      [0.4, 6.85],
    ]) {
      round(
        q,
        x,
        4.04,
        [
          [y - 1.4, 0.27],
          [y - 0.4, 0.34],
          [y, 0.15],
        ],
        d > 2 ? 8 : 4,
        'trim',
        pale,
      );
      round(
        q,
        x,
        4.04,
        [
          [y, 0.18],
          [y + 0.34, 0.21],
          [y + 0.57, 0.08],
        ],
        d > 2 ? 8 : 4,
        'trim',
        pale,
      );
    }
    rod(q, 0, 'trim', [-0.45, 7.2, 4.15], [0.35, 6.6, 4.18], 0.19, pale);
  }
  for (let j = 0; j < ps.length; j++) {
    const a = ps[j],
      b = ps[(j + 1) % ps.length],
      pa = [
        [a[0], 5, a[1]],
        [b[0], 5, b[1]],
        [b[0], 5.1 + (b[1] + 3.74) * 0.29, b[1]],
        [a[0], 5.1 + (a[1] + 3.74) * 0.29, a[1]],
      ];
    quad(o, 'wall', pa, [b[1] - a[1], 0, a[0] - b[0]], hallstone);
  }
  const ids = earcut(ps.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const points = ids
      .slice(i, i + 3)
      .map((j) => [ps[j][0], 5.1 + (ps[j][1] + 3.74) * 0.29, ps[j][1]]);
    if (normalFor(...points)[1] < 0) points.reverse();
    o.addTriangle(
      'roof',
      ref,
      points,
      normalFor(...points),
      points.map((p) => [p[0], p[2]]),
      slate,
    );
  }
}
function build(o, d) {
  towerMasonry(o, d);
  hall(o, d);
  annex(o, d);
  upperTower(o, d);
  spire(o, d);
}
export const belfryOfGhent = (o) => build(o, 3),
  belfryOfGhentStreet = (o) => build(o, 2),
  belfryOfGhentDistrict = (o) => build(o, 1),
  belfryOfGhentSkyline = (o) => build(o, 0);
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', localRef: ref, roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.88, metallic: 0.05 },
  glass: { slot: 'window', localRef: ref, roughness: 0.65, metallic: 0 },
  wood: { slot: 'door', localRef: ref, roughness: 0.86, metallic: 0 },
  gold: { slot: 'trim', localRef: ref, roughness: 0.43, metallic: 0.65, doubleSided: true },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.72,
    metallic: 0.3,
    doubleSided: true,
  },
};
export const belfryOfGhentModel = {
  id: 'belfry_of_ghent',
  key: 'belfry_of_ghent',
  recipe: 'structure-belfry-of-ghent.mjs',
  cell: 'u1/u14',
  title: 'Belfry of Ghent',
  brief:
    'Native Gothic civic tower with three paired lancet stages/stringcourses, actual pointed clock-arch openings and skeletal gold Roman clock rings/hands, pierced gallery tracery, four polygonal corner turrets/hourglass shutters/slate spires, thin weather poles/watchmen/gargoyles, central dormered slate spire/open gilded crown and original copper-dragon silhouette. Attached eleven-bay Cloth Hall with stepped buttresses/Gothic cross windows/blind tracery/stepped and timber dormers, corner pinnacles and south stair/gable. Small attached Mammelokker entrance with curved gable/oculus/abstract paired-figure relief. No neighboring churches/market pavilion/square/interior.',
  camera: [108, 79, 116],
  lookAt: [6, 40, 5],
  qaCameras: [
    { name: 'front', position: [10, 35, 109], lookAt: [5, 40, 8] },
    { name: 'clock-detail', position: [22, 61, 25], lookAt: [0, 61, 0] },
    { name: 'balcony-detail', position: [0, 54, 20], lookAt: [0, 53.3, 6.4] },
    { name: 'spire-detail', position: [28, 87, 32], lookAt: [0, 81, 0] },
    { name: 'hall-detail', position: [18, 13, 45], lookAt: [16, 12, 18] },
    { name: 'annex-detail', position: [16, 9, -20], lookAt: [19, 6, -2] },
    { name: 'roof-detail', position: [42, 46, 50], lookAt: [15, 19, 12] },
    { name: 'back', position: [-50, 44, -64], lookAt: [4, 34, 4] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -3 },
  build: belfryOfGhent,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Two unchanged independent Terrariumtiles/2mgrid, dry tower west approach[0,-10]datum14.151m. Native footprint ground+.046..+.670m, buried-3m foundations and low portal+.9m. Threshold/stair engineering approximate; no terrain flattening/fitting. Host compatibility remains dataset-dependent.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-belfry-of-ghent.mjs',
    level: 'skyline',
    export: 'belfryOfGhentSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'belfryOfGhentDistrict', errorMeters: 1, surfaces },
      street: { export: 'belfryOfGhentStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: frame.limitations,
};
export { annex, balcony, clock, hall, spire, towerMasonry, upperTower };
