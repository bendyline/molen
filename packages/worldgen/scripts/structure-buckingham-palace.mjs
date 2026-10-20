/** Buckingham Palace: individual quadrangle, east balcony, garden bow and attached palace courts. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/gc/gcp/buckingham_palace/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff';
const pale = rgb('d4d0c5'),
  edge = rgb('c4c1b7'),
  shadow = rgb('a9a79f'),
  bath = rgb('b8a17a'),
  bathTrim = rgb('c8b38e'),
  glass = rgb('50656b'),
  glassLight = rgb('68777a'),
  iron = rgb('414b48'),
  lead = rgb('787c7d'),
  copper = rgb('8faba0'),
  gold = rgb('a58c52');
function quad(o, slot, ps, n, col) {
  if (normalFor(...ps).reduce((s, v, i) => s + v * n[i], 0) < 0) ps = [...ps].reverse();
  rawQuad(o, slot, ps, n, col);
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
function flat(o, slot, ps, col, holes = [], n = [0, 0, 1]) {
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
const rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ],
  surface = (o, s, p, z, c) =>
    flat(
      o,
      s,
      p.map((v) => [...v, z]),
      c,
    );
function panel(o, slot, ps, z0, z1, col) {
  surface(o, slot, ps, z1, col);
  flat(
    o,
    slot,
    ps.map((p) => [...p, z0]),
    col,
    [],
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      p = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, slot, p, normalFor(...p), col);
  }
}
function wall(o, ps, holes, z, depth, col) {
  flat(
    o,
    'stone',
    ps.map((p) => [...p, z]),
    col,
    holes.map((r) => r.map((p) => [...p, z])),
  );
  for (const r of holes)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        p = [
          [...a, z],
          [...a, z - depth],
          [...b, z - depth],
          [...b, z],
        ];
      quad(o, 'trim', p, normalFor(...p), shadow);
    }
}
function strip(o, d, slot, x, y, z, w, h, depth, col) {
  surface(o, slot, rect(x, y, w, h), z + depth / 2, col);
  if (d >= 2)
    for (const yy of d === 2 ? [y + h] : [y, y + h])
      quad(
        o,
        slot,
        [
          [x - w / 2, yy, z - depth / 2],
          [x + w / 2, yy, z - depth / 2],
          [x + w / 2, yy, z + depth / 2],
          [x - w / 2, yy, z + depth / 2],
        ],
        [0, yy === y ? -1 : 1, 0],
        col,
      );
}
function line(o, _d, slot, ps, z, w, col, closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++) {
    const a = ps[i - 1],
      b = ps[i % ps.length];
    {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = Math.hypot(dx, dy);
      if (l < 1e-6) continue;
      const u = [(-dy * w) / l / 2, (dx * w) / l / 2],
        q = [
          [a[0] - u[0], a[1] - u[1], z],
          [b[0] - u[0], b[1] - u[1], z],
          [b[0] + u[0], b[1] + u[1], z],
          [a[0] + u[0], a[1] + u[1], z],
        ];
      quad(o, slot, q, normalFor(...q), col);
    }
  }
}
function arch(x, y, w, h, n = 12) {
  const r = w / 2,
    s = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [x + r * Math.cos(a), s + r * Math.sin(a)];
    }),
  ];
}
const area = (r) =>
  r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
  2;
function clean(r, tolerance) {
  r = r.filter(
    (p, i) => Math.hypot(p[0] - r[(i + 1) % r.length][0], p[1] - r[(i + 1) % r.length][1]) > 0.002,
  );
  const original = [...r],
    indices = new Map(original.map((p, i) => [p, i]));
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        p = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz),
        t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (l * l) : -1,
        err = l ? Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / l : Infinity;
      let chainError = 0;
      for (
        let j = (indices.get(a) + 1) % original.length;
        j !== indices.get(b);
        j = (j + 1) % original.length
      ) {
        const q = original[j],
          u = l ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (l * l))) : 0;
        chainError = Math.max(chainError, Math.hypot(q[0] - a[0] - u * dx, q[1] - a[1] - u * dz));
      }
      if (t >= 0 && t <= 1 && err < tolerance && chainError < tolerance) {
        r = r.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function faces(r, hole = false) {
  r = area(r) > 0 !== hole ? r : [...r].reverse();
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      dx = a[0] - b[0],
      dz = a[1] - b[1];
    return {
      a,
      b,
      w: Math.hypot(dx, dz),
      x: (a[0] + b[0]) / 2,
      z: (a[1] + b[1]) / 2,
      angle: Math.atan2(-dz, dx),
      normal: [-dz / Math.hypot(dx, dz), dx / Math.hypot(dx, dz)],
    };
  });
}
function cap(o, rings, y, col = lead, slot = 'roof') {
  const p = rings.flat(),
    idx = earcut(
      p.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, r) => s + r.length, 0)),
    );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      [0, 1, 0],
      q.map((v) => [v[0], v[2]]),
      col,
    );
  }
}
const nativeRings = frame.features[0].rings,
  baseRings = nativeRings.map((r, i) => (i === 0 ? r.filter((_, j) => j !== 60 && j !== 61) : r)),
  frontXs = Array.from({ length: 23 }, (_, i) => (i - 11) * 4.5),
  portalXs = [-25.5, 0, 25.5];
function base(o, d) {
  if (nativeRings[0][60][0] > -65 || nativeRings[0][61][0] > -65)
    throw Error(
      'Re-review the Ambassadors’ Court porch plan before changing this native snapshot.',
    );
  const rings = baseRings.map((r) =>
    clean(r, d === 0 ? 2.2 : d === 1 ? 0.85 : d === 2 ? 0.08 : 0.005),
  );
  for (let ri = 0; ri < rings.length; ri++)
    for (const f of faces(rings[ri], ri > 0)) {
      if (f.w < 0.002) continue;
      const local = transform(o, f.angle, f.x, f.z),
        holes = [];
      if (
        d > 0 &&
        Math.abs(f.normal[1]) > 0.98 &&
        ((ri === 0 && f.z > 58) || (ri === 1 && (f.z > 27 || (f.z < -10 && Math.abs(f.x) < 10))))
      ) {
        for (const x of f.z < 0 ? [0] : portalXs) {
          const u = (x - f.x) / Math.cos(f.angle);
          if (Math.abs(u) + 3.1 < f.w / 2) holes.push(arch(u, 0.08, 6.05, 5.95, d > 1 ? 14 : 8));
        }
      }
      wall(local, rect(0, -4, f.w, 10), holes, 0, 0.22, ri === 0 && f.z > 50 ? pale : bath);
    }
  cap(o, rings, 6);
}
const componentTop = new Map([
  ['35185598843734', 20.7],
  ['35185598843730', 18],
  ['35185598843733', 18],
  ['35185598843731', 23.7],
  ['35185409884873', 20.5],
  ['35185598843719', 18],
  ['35185598994021', 20.2],
  ['35185598843732', 24],
  ['35185598843727', 12],
]);
function masses(o, d) {
  for (const f of frame.features.slice(1)) {
    const id = f.id.split('/')[1],
      top = componentTop.get(id) ?? 6;
    if (top <= 6) continue;
    const r = clean(f.rings[0], d === 0 ? 2.2 : d === 1 ? 0.65 : 0.005),
      col = id === '35185598843734' ? pale : bath;
    for (const face of faces(r)) {
      if (face.w < 0.002) continue;
      const local = transform(o, face.angle, face.x, face.z);
      wall(local, rect(0, 6, face.w, top - 6), [], 0, 0.15, col);
    }
    cap(o, [r], top);
  }
}
function window(
  o,
  d,
  x,
  y,
  z,
  w,
  h,
  { col = glass, pediment = false, arched = false, warm = false, mezz = false } = {},
) {
  const trim = warm ? bathTrim : pale,
    p = arched ? arch(x, y, w, h, d === 3 ? 14 : 8) : rect(x, y, w, h);
  surface(o, 'glass', p, z + (d > 1 ? -0.26 : 0.015), col);
  if (d < 2) return;
  line(o, d, 'trim', p, z + 0.035, mezz ? 0.11 : 0.16, trim, true);
  strip(o, d, 'trim', x, y - 0.18, z + 0.13, w + 0.42, 0.15, 0.28, trim);
  if (!mezz) {
    strip(o, d, 'trim', x, y + h + 0.04, z + 0.15, w + 0.45, 0.17, 0.34, trim);
    if (pediment) {
      const q = [
        [x - w * 0.7, y + h + 0.32],
        [x + w * 0.7, y + h + 0.32],
        [x, y + h + 1.05],
      ];
      panel(o, 'trim', q, z - 0.04, z + 0.18, trim);
      if (d === 3)
        line(
          o,
          d,
          'stone',
          [
            [x - w * 0.44, y + h + 0.43],
            [x + w * 0.44, y + h + 0.43],
            [x, y + h + 0.8],
          ],
          z + 0.2,
          0.07,
          shadow,
          true,
        );
    }
  }
  if (d === 3 && !mezz) {
    strip(o, 1, 'metal', x, y, z - 0.2, 0.045, h, 0.045, iron);
    for (let j = 1; j < Math.round(h / 0.65); j++)
      strip(o, 1, 'metal', x, y + (j * h) / Math.round(h / 0.65), z - 0.2, w, 0.035, 0.045, iron);
  } else if (!mezz) strip(o, 1, 'metal', x, y, z - 0.2, 0.06, h, 0.05, iron);
}
function capital(o, d, x, y, z, r, col = pale) {
  if (d === 2) {
    loft(
      o,
      'trim',
      [
        radialRing(y, r * 1.1, r * 1.1, 4, [x, z]),
        radialRing(y + 0.68, r * 1.55, r * 1.55, 4, [x, z]),
      ],
      col,
    );
    B(o, 'trim', x, y + 0.64, z, r * 3.6, 0.22, r * 3.6, col);
    return;
  }
  const n = d === 3 ? 8 : 6;
  loft(
    o,
    'trim',
    [
      radialRing(y, r * 1.15, r * 1.15, n, [x, z]),
      radialRing(y + 0.14, r * 1.28, r * 1.28, n, [x, z]),
      radialRing(y + 0.52, r * 1.52, r * 1.52, n, [x, z]),
      radialRing(y + 0.68, r * 1.58, r * 1.58, n, [x, z]),
    ],
    col,
  );
  B(o, 'trim', x, y + 0.64, z, r * 3.6, 0.22, r * 3.6, col);
  if (d === 3)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        xx = x + Math.cos(a) * r * 1.3,
        zz = z + Math.sin(a) * r * 1.3;
      loft(
        o,
        'trim',
        [
          radialRing(y + 0.12, r * 0.18, r * 0.18, 4, [xx, zz]),
          radialRing(y + 0.46, r * 0.3, r * 0.3, 4, [xx, zz]),
          radialRing(y + 0.58, r * 0.05, r * 0.05, 4, [xx, zz]),
        ],
        col,
      );
    }
}
function column(o, d, x, y, z, h, r, col = pale) {
  if (d === 3) B(o, 'trim', x, y - 0.65, z, r * 3.1, 0.65, r * 3.1, col);
  else if (d === 2) strip(o, 2, 'trim', x, y - 0.65, z, r * 3.1, 0.65, r * 3.1, col);
  if (d < 2) {
    surface(o, 'trim', rect(x, y, r * 2, h), z + r, col);
    if (d === 1) {
      surface(o, 'trim', rect(x, y, r * 2.8, 0.28), z + r, col);
      surface(
        o,
        'trim',
        [
          [x - r * 1.1, y + h - 0.8],
          [x + r * 1.1, y + h - 0.8],
          [x + r * 1.6, y + h - 0.1],
          [x - r * 1.6, y + h - 0.1],
        ],
        z + r,
        col,
      );
    }
    return;
  }
  const n = d === 3 ? 12 : 6,
    pts = [
      radialRing(y, r * 1.45, r * 1.45, n, [x, z]),
      radialRing(y + 0.18, r * 1.45, r * 1.45, n, [x, z]),
      radialRing(y + 0.36, r * 1.1, r * 1.1, n, [x, z]),
      radialRing(y + 0.5, r, r, n, [x, z]),
      radialRing(y + h - 0.9, r * 0.82, r * 0.82, n, [x, z]),
    ];
  loft(o, 'trim', d === 2 ? [pts[0], pts[2], pts[4]] : pts, col);
  capital(o, d, x, y + h - 0.9, z, r, col);
  if (d === 3)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        o,
        'stone',
        [x + Math.cos(a) * r * 1.005, y + 0.65, z + Math.sin(a) * r * 1.005],
        [x + Math.cos(a) * r * 0.84, y + h - 1.15, z + Math.sin(a) * r * 0.84],
        0.027,
        0.027,
        shadow,
      );
    }
}
function balustrade(o, d, a, b, y, { warm = false, spacing = 0.65, height = 1 } = {}) {
  const col = warm ? bathTrim : pale,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  if (length < 0.1) return;
  beam(o, 'trim', [a[0], y + 0.08, a[1]], [b[0], y + 0.08, b[1]], 0.18, 0.2, col);
  beam(o, 'trim', [a[0], y + height, a[1]], [b[0], y + height, b[1]], 0.18, 0.24, col);
  if (d === 0) return;
  const count = Math.max(2, Math.round(length / (d === 1 ? spacing * 2.9 : spacing)));
  for (let i = 0; i <= count; i++) {
    const x = a[0] + (dx * i) / count,
      z = a[1] + (dz * i) / count;
    if (d === 3)
      loft(
        o,
        'trim',
        [
          radialRing(y + 0.15, 0.09, 0.09, 4, [x, z]),
          radialRing(y + 0.43, 0.07, 0.07, 4, [x, z]),
          radialRing(y + 0.64, 0.13, 0.13, 4, [x, z]),
          radialRing(y + height - 0.08, 0.07, 0.07, 4, [x, z]),
        ],
        col,
      );
    else {
      const ux = (dx / length) * 0.045,
        uz = (dz / length) * 0.045;
      const p = [
        [x - ux, y + 0.18, z - uz],
        [x + ux, y + 0.18, z + uz],
        [x + ux, y + height - 0.12, z + uz],
        [x - ux, y + height - 0.12, z - uz],
      ];
      quad(o, 'trim', p, normalFor(...p), col);
    }
  }
}
function pediment(o, d, x, z, w, baseY, peak, { warm = false } = {}) {
  const col = warm ? bathTrim : pale,
    ps = [
      [x - w / 2, baseY],
      [x + w / 2, baseY],
      [x, peak],
    ];
  panel(o, 'trim', ps, z - 0.25, z + 0.1, col);
  if (d > 0) {
    line(o, d, 'trim', ps, z + 0.18, 0.22, col, true);
    if (d > 1) {
      const inner = [
        [x - w * 0.39, baseY + 0.22],
        [x + w * 0.39, baseY + 0.22],
        [x, peak - 0.38],
      ];
      line(o, d, 'stone', inner, z + 0.21, 0.09, shadow, true);
    }
  }
  if (d === 3) {
    const q = [
      [x - w * 0.2, baseY + 0.4],
      [x + w * 0.2, baseY + 0.4],
      [x + w * 0.1, baseY + 0.7],
      [x + 0.5, baseY + 0.77],
      [x, peak - 0.53],
      [x - 0.5, baseY + 0.77],
      [x - w * 0.1, baseY + 0.7],
    ];
    panel(o, 'trim', q, z + 0.2, z + 0.32, col);
    for (const s of [-1, 1]) {
      sphere(o, 'trim', [x + s * w * 0.22, baseY + 0.58, z + 0.3], [0.24, 0.24, 0.24], col, 6, 4);
      beam(
        o,
        'trim',
        [x + s * w * 0.22, baseY + 0.4, z + 0.3],
        [x + s * w * 0.1, baseY + 0.72, z + 0.3],
        0.2,
        0.18,
        col,
      );
    }
  }
}
function gate(o, d, x, z, y, w, h) {
  const p = arch(x, y, w, h, d > 1 ? 16 : 8);
  if (d > 0) {
    line(o, d, 'trim', p, z + 0.15, 0.22, pale, true);
    if (d > 1) {
      const outer = arch(x, y - 0.05, w + 0.7, h + 0.45, 18);
      line(o, d, 'trim', outer, z + 0.12, 0.12, pale);
    }
  }
  if (d > 1) {
    for (let i = -5; i <= 5; i++) {
      const xx = x + (i * w) / 12,
        head = y + h - w / 2 + Math.sqrt(Math.max(0, (w * w) / 4 - (xx - x) * (xx - x)));
      beam(o, 'metal', [xx, y + 0.1, z - 0.08], [xx, head - 0.08, z - 0.08], 0.045, 0.045, iron);
    }
    for (const yy of [y + 0.8, y + 2.5])
      beam(
        o,
        'metal',
        [x - w / 2 + 0.1, yy, z - 0.08],
        [x + w / 2 - 0.1, yy, z - 0.08],
        0.06,
        0.06,
        iron,
      );
  }
}
const facadeGroups = [
  { x: -46.125, w: 15.75, z: 62.0, pavilion: true },
  { x: -22.875, w: 30.75, z: 61.55 },
  { x: 0, w: 15, z: 62.35, pavilion: true },
  { x: 22.875, w: 30.75, z: 61.55 },
  { x: 46.125, w: 15.75, z: 62.0, pavilion: true },
];
const frontRows = [
  { y: 0.9, h: 3.25, w: 1.75 },
  { y: 4.9, h: 0.67, w: 1.35, mezz: true },
  { y: 7.3, h: 4.3, w: 1.85, pediment: true },
  { y: 13.7, h: 3.4, w: 1.85 },
  { y: 18.9, h: 0.67, w: 1.35, mezz: true },
];
function eastFront(o, d) {
  for (const group of facadeGroups) {
    const local = transform(o, 0, 0, group.z),
      xs = frontXs.filter((x) => Math.abs(x - group.x) < group.w / 2),
      holes = [];
    for (const x of xs)
      for (const r of frontRows) {
        if (r.y < 6 && portalXs.some((p) => Math.abs(x - p) < 3.7)) continue;
        if (r.mezz && d < 2) continue;
        if (d > 1) holes.push(rect(x, r.y, r.w, r.h));
      }
    for (const x of portalXs)
      if (Math.abs(x - group.x) + 3 < group.w / 2)
        holes.push(arch(x, 0.08, 5.4, 5.7, d > 1 ? 16 : 8));
    if (d > 0) wall(local, rect(group.x, -4, group.w, 24.7), holes, 0, 0.3, pale);
    for (const x of xs)
      for (const r of frontRows) {
        if (r.y < 6 && portalXs.some((p) => Math.abs(x - p) < 3.7)) continue;
        if (r.mezz && d < 2) continue;
        window(local, d, x, r.y, 0, r.w, r.h, {
          ...r,
          col: xs.indexOf(x) % 3 === 0 ? glassLight : glass,
        });
      }
    if (d > 0) {
      for (const y of [0.25, 6.25, 12.7, 20.3])
        strip(
          local,
          d,
          'trim',
          group.x,
          y,
          0.15,
          group.w + 0.3,
          y === 20.3 ? 0.35 : 0.2,
          0.45,
          pale,
        );
      if (d > 1) {
        for (let y = 0.5; y < 6; y += 0.56) {
          const intervals = [];
          for (const ring of holes) {
            const crosses = [];
            for (let j = 0; j < ring.length; j++) {
              const a = ring[j],
                b = ring[(j + 1) % ring.length],
                yy = y + 0.0175;
              if (a[1] > yy !== b[1] > yy)
                crosses.push(a[0] + ((b[0] - a[0]) * (yy - a[1])) / (b[1] - a[1]));
            }
            crosses.sort((a, b) => a - b);
            for (let j = 0; j + 1 < crosses.length; j += 2)
              intervals.push([crosses[j] - 0.04, crosses[j + 1] + 0.04]);
          }
          intervals.sort((a, b) => a[0] - b[0]);
          let cursor = group.x - group.w / 2;
          for (const [a, b] of [...intervals, [group.x + group.w / 2, group.x + group.w / 2]]) {
            const end = Math.min(a, group.x + group.w / 2);
            if (end > cursor + 0.01)
              strip(
                local,
                1,
                'stone',
                (cursor + end) / 2,
                y,
                0.015,
                end - cursor,
                0.035,
                0.02,
                shadow,
              );
            cursor = Math.max(cursor, b);
          }
        }
        for (const x of xs)
          if (!portalXs.some((p) => Math.abs(x - p) < 3.7)) {
            strip(local, d, 'trim', x, 4.3, 0.12, 2.1, 0.15, 0.3, edge);
          }
      }
    }
    if (group.pavilion) {
      if (d > 0) B(local, 'stone', group.x, 20.7, -0.15, group.w, 2.4, 0.8, pale);
      pediment(local, d, group.x, 0.4, group.w + 1.1, 21.0, 24);
      const colXs = group.x === 0 ? [-6.75, -2.25, 2.25, 6.75] : [group.x - 2.25, group.x + 2.25];
      for (const x of colXs) column(local, d, x, 7.0, 0.55, 13.3, 0.36);
      for (const x of [group.x - group.w / 2 + 0.35, group.x + group.w / 2 - 0.35])
        strip(local, d, 'trim', x, 6.8, 0.22, 0.65, 13.6, 0.55, pale);
    } else {
      if (d > 0)
        balustrade(local, d, [group.x - group.w / 2, 0], [group.x + group.w / 2, 0], 21.1, {
          spacing: 0.55,
          height: 1,
        });
      for (let x = group.x - group.w / 2 + 0.25; x < group.x + group.w / 2; x += 4.5) {
        if (d === 0) continue;
        strip(local, d, 'trim', x, 6.7, 0.14, 0.35, 13.5, 0.4, pale);
        if (d === 3) {
          B(local, 'trim', x, 19.5, 0.2, 0.67, 0.5, 0.55, pale);
          for (const dx of [-0.1, 0.1])
            strip(local, 2, 'stone', x + dx, 7.1, 0.36, 0.022, 12.1, 0.02, shadow);
        }
      }
    }
    for (const x of portalXs)
      if (Math.abs(x - group.x) + 3 < group.w / 2) gate(local, d, x, 0, 0.08, 5.4, 5.7);
    if (d > 0) {
      strip(local, d, 'trim', group.x, 6.15, 0.58, group.w, 0.28, 1.15, pale);
      balustrade(local, d, [group.x - group.w / 2, 0.95], [group.x + group.w / 2, 0.95], 6.35, {
        spacing: 0.55,
        height: 0.85,
      });
    }
  }
  if (d > 0) {
    B(o, 'trim', 0, 6.1, 64.1, 12, 0.35, 3.6, pale);
    balustrade(o, d, [-6, 65.85], [6, 65.85], 6.45, { spacing: 0.5, height: 1 });
    for (const x of [-6, 6])
      balustrade(o, d, [x, 62.5], [x, 65.85], 6.45, { spacing: 0.5, height: 1 });
  } else {
    surface(o, 'trim', rect(0, 6.1, 12, 0.3), 64.8, pale);
  }
  if (d > 1)
    for (const x of portalXs) {
      const p = arch(x, 0.08, 5.4, 5.7, 16);
      for (let i = 1; i < p.length - 1; i++) {
        const a = p[i],
          b = p[i + 1],
          q = [
            [...a, 61.5],
            [...b, 61.5],
            [...b, 36],
            [...a, 36],
          ];
        quad(o, 'trim', q, normalFor(...q), edge);
      }
      for (const s of [-1, 1])
        quad(
          o,
          'trim',
          [
            [x + s * 2.7, 0.08, 36],
            [x + s * 2.7, 3, 36],
            [x + s * 2.7, 3, 61.5],
            [x + s * 2.7, 0.08, 61.5],
          ],
          [s, 0, 0],
          edge,
        );
    }
  beam(o, 'metal', [0, 23.15, 57.5], [0, 34, 57.5], d > 1 ? 0.11 : 0.18, d > 1 ? 0.11 : 0.18, iron);
  if (d > 0) sphere(o, 'metal', [0, 34.12, 57.5], [0.16, 0.16, 0.16], gold, 6, 4);
}
function inRing(p, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function occluded(x, z, y) {
  const p = [x, z];
  if (y < 6 && inRing(p, nativeRings[0]) && !nativeRings.slice(1).some((r) => inRing(p, r)))
    return true;
  return frame.features
    .slice(1)
    .some((f) => (componentTop.get(f.id.split('/')[1]) ?? 6) > y && inRing(p, f.rings[0]));
}
function facadeOnFace(
  o,
  d,
  f,
  y0,
  top,
  { warm = true, spacing = 4.5, rows = [1.1, 7.3, 13.3], height = 3.2 } = {},
) {
  if (f.w < spacing * 0.8) return;
  const local = transform(o, f.angle, f.x, f.z),
    n = Math.max(1, Math.floor((f.w - 0.8) / spacing));
  for (let i = 0; i < n; i++) {
    const x = ((i - (n - 1) / 2) * f.w) / n;
    for (const y of rows) {
      if (y + height > top - 1.2 || y < y0 || (d === 1 && y !== rows[1] && rows.length > 1))
        continue;
      const wx = f.x + Math.cos(f.angle) * x + Math.sin(f.angle) * 0.7,
        wz = f.z - Math.sin(f.angle) * x + Math.cos(f.angle) * 0.7;
      if (occluded(wx, wz, y + height / 2)) continue;
      const ww = Math.min(1.8, (f.w / n) * 0.5),
        zz = 0.37,
        p = rect(x, y, ww, height);
      if (d > 1) {
        wall(
          local,
          rect(x, y - 0.15, ww + 0.4, height + 0.4),
          [p],
          zz,
          0.25,
          warm ? bath : bathTrim,
        );
      }
      window(local, d, x, y, zz, ww, height, { warm, col: i % 3 === 0 ? glassLight : glass });
    }
  }
  if (d > 0)
    for (const y of [6.25, top - 0.7])
      strip(local, d, 'trim', 0, y, 0.28, f.w, 0.18, 0.65, warm ? bathTrim : pale);
}
function surroundingFacades(o, d) {
  if (d === 0) return;
  for (const id of [
    '35185598843730',
    '35185598843733',
    '35185598843731',
    '35185598843732',
    '35185598843727',
  ]) {
    const f = frame.features.find((f) => f.id === `buildings/${id}`),
      top = componentTop.get(id),
      r = clean(f.rings[0], 0.1);
    for (const face of faces(r)) {
      if (face.w < 4.0) continue;
      if (id === '35185598843731' && face.z < -55) continue;
      facadeOnFace(o, d, face, 0, top, {
        rows: id === '35185598843731' ? [1.2, 7.4, 14.3] : [1.1, 7, 12.5],
        height: id === '35185598843731' ? 3.7 : 3.2,
      });
    }
  }
}
function garden(o, d) {
  const z = -62.0,
    main = transform(o, Math.PI, 0, z);
  if (d > 0)
    for (const [x0, x1, top] of [
      [-54, -27, 18.9],
      [-27, -7.3, 23.7],
      [7.3, 27, 23.7],
      [27, 54, 18.9],
    ]) {
      const holes = [];
      if (d > 1)
        for (const side of [-1, 1])
          for (const x of [11.3, 15.8, 20.3, 29, 33.7, 38.4, 43.1, 48.2])
            for (const [y, h] of [
              [1, 3.4],
              [7.4, 5.8],
              [16, 2.5],
            ])
              if (x * side > x0 && x * side < x1) holes.push(rect(x * side, y, 1.9, h));
      wall(main, rect((x0 + x1) / 2, -4, x1 - x0, top + 4), holes, 0.45, 0.26, bath);
      for (const x of [x0, x1])
        quad(
          main,
          'stone',
          [
            [x, -4, -1.4],
            [x, top, -1.4],
            [x, top, 0.45],
            [x, -4, 0.45],
          ],
          [x === x0 ? -1 : 1, 0, 0],
          bath,
        );
      quad(
        main,
        'roof',
        [
          [x0, top, -1.4],
          [x1, top, -1.4],
          [x1, top, 0.45],
          [x0, top, 0.45],
        ],
        [0, 1, 0],
        lead,
      );
    }
  for (const side of [-1, 1]) {
    for (const x of [11.3, 15.8, 20.3, 29, 33.7, 38.4, 43.1, 48.2]) {
      const xx = x * side;
      for (const [y, h] of [
        [1.0, 3.4],
        [7.4, 5.8],
        [16, 2.5],
      ]) {
        if (d === 0 && y !== 7.4) continue;
        const _p = rect(xx, y, 1.9, h);

        window(main, d, xx, y, 0.45, 1.9, h, { warm: true });
      }
    }
    for (const x of [25, 51]) {
      column(main, d, side * (x - 0.8), 6.9, 1.15, 11.7, 0.43, bathTrim);
      column(main, d, side * (x + 0.8), 6.9, 1.15, 11.7, 0.43, bathTrim);
      if (d > 0) {
        B(main, 'trim', side * x, 18.5, 0.3, 5.1, 0.6, 2.0, bathTrim);
        B(main, 'stone', side * x, 19.1, -0.4, 5.1, 2.3, 1.0, bath);
      }
    }
  }
  if (d > 0)
    for (const y of [6.4, 18.5, 22.9]) strip(main, d, 'trim', 0, y, 0.25, 55, 0.32, 0.7, bathTrim);
  if (d > 1) {
    for (const side of [-1, 1]) {
      const x = side * 16.4;
      line(main, d, 'trim', rect(x, 19.7, 15.8, 2.0), 0.57, 0.1, bathTrim, true);
      if (d === 3)
        for (let i = -3; i <= 3; i++) {
          const xx = x + i * 1.9;
          panel(
            main,
            'trim',
            [
              [xx - 0.52, 20.2],
              [xx - 0.2, 20.05],
              [xx + 0.46, 20.25],
              [xx + 0.32, 20.6],
              [xx, 21.15],
              [xx - 0.3, 20.65],
            ],
            0.56,
            0.66,
            bathTrim,
          );
        }
    }
  }
  // Five-window bowed garden front is derived from the actual native bow component.
  const bow = frame.authoredComponents.gardenBow,
    cx = bow.reduce((s, p) => s + p[0], 0) / bow.length,
    centerZ = -59.9,
    rx = 7.25,
    rz = 7.25,
    segments = d === 0 ? 6 : d === 1 ? 10 : 20;
  for (let j = 0; j < segments; j++) {
    const a = (Math.PI * j) / segments,
      b = (Math.PI * (j + 1)) / segments,
      p = [cx + rx * Math.cos(a), centerZ - rz * Math.sin(a)],
      q = [cx + rx * Math.cos(b), centerZ - rz * Math.sin(b)],
      dx = p[0] - q[0],
      dz = p[1] - q[1],
      face = {
        w: Math.hypot(dx, dz),
        x: (p[0] + q[0]) / 2,
        z: (p[1] + q[1]) / 2,
        angle: Math.atan2(-dz, dx),
      };
    if (d > 0) {
      const local = transform(o, face.angle, face.x, face.z);
      strip(local, d, 'trim', 0, 6.4, 0.16, face.w + 0.03, 0.3, 0.4, bathTrim);
      strip(local, d, 'trim', 0, 18.4, 0.14, face.w + 0.03, 0.55, 0.4, bathTrim);
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) * Math.PI) / 5,
      x = cx + rx * Math.cos(a),
      zz = centerZ - rz * Math.sin(a),
      nx = Math.cos(a) / rx,
      nz = -Math.sin(a) / rz,
      len = Math.hypot(nx, nz),
      local = transform(o, Math.atan2(nx, nz), x + (nx / len) * 0.3, zz + (nz / len) * 0.3);
    for (const [y, h] of [
      [1, 3.4],
      [7.4, 5.8],
    ]) {
      if (d === 0 && y < 7) continue;
      const p = rect(0, y, 1.9, h);
      if (d > 1) wall(local, rect(0, y - 0.15, 2.25, h + 0.4), [p], 0.05, 0.26, bath);
      window(local, d, 0, y, 0.05, 1.9, h, { warm: true });
    }
    if (d > 1) {
      const ps = Array.from({ length: 17 }, (_, j) => [
        0.6 * Math.cos((j * Math.PI) / 8),
        15.5 + 0.75 * Math.sin((j * Math.PI) / 8),
      ]);
      line(local, d, 'trim', ps, 0.14, 0.1, bathTrim);
    }
  }
  for (let i = 0; i <= 5; i++) {
    const a = (i * Math.PI) / 5;
    column(
      o,
      d,
      cx + (rx + 0.3) * Math.cos(a),
      6.9,
      centerZ - (rz + 0.3) * Math.sin(a),
      11.5,
      0.38,
      bathTrim,
    );
  }
  const domeRings = Array.from({ length: d === 3 ? 8 : 5 }, (_, j) => {
    const n = d === 3 ? 7 : 4,
      t = ((j / n) * Math.PI) / 2,
      rr = Math.max(0.01, Math.cos(t));
    return Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i * Math.PI) / segments;
      return [
        cx + rx * rr * Math.cos(a),
        20.2 + 1.6 * Math.sin(t),
        centerZ - rz * rr * Math.sin(a),
      ];
    });
  });
  loft(o, 'copper', domeRings, copper);
  if (d > 0) {
    const bowEdge = Array.from({ length: segments + 1 }, (_, i) => [
      cx + (rx + 0.15) * Math.cos((i * Math.PI) / segments),
      centerZ - (rz + 0.15) * Math.sin((i * Math.PI) / segments),
    ]);
    for (let i = 1; i < bowEdge.length; i++)
      balustrade(o, d, bowEdge[i - 1], bowEdge[i], 19.0, {
        warm: true,
        spacing: 0.62,
        height: 0.9,
      });
  }
  // The palace-owned raised garden terrace follows its own footprint; surrounding ground is unchanged.
  const terrace = [
    [-54, -62.0],
    [-54, -74],
    [54, -74],
    [54, -62.0],
  ];
  for (const f of faces(terrace)) {
    const local = transform(o, f.angle, f.x, f.z);
    wall(local, rect(0, -4, f.w, 5.15), [], 0, 0.2, bath);
  }
  cap(o, [terrace], 1.15, bathTrim, 'trim');
  if (d > 0) {
    balustrade(o, d, [-54, -73.8], [-5.3, -73.8], 1.15, { warm: true, spacing: 0.8, height: 1.05 });
    balustrade(o, d, [5.3, -73.8], [54, -73.8], 1.15, { warm: true, spacing: 0.8, height: 1.05 });
    for (const x of [-54, 54])
      balustrade(o, d, [x, -73.8], [x, -62], 1.15, { warm: true, spacing: 0.8, height: 1.05 });
  }
  if (d > 1) {
    for (let i = 0; i < 8; i++) {
      const zz = -74.1 - i * 0.34,
        y = 1.15 - i * 0.17;
      B(o, 'trim', 0, -4, zz, 10, y + 4, 0.35, bathTrim);
    }
    for (const x of [-5, 5]) beam(o, 'metal', [x, 2.1, -73.9], [x, 1.0, -76.45], 0.06, 0.06, iron);
  }
}
function courtyardPorticoes(o, d) {
  if (d === 0) {
    const porch = transform(o, -Math.PI / 2, -61.5, 6.8);
    B(porch, 'trim', 0, -4, 2.6, 10.2, 4.35, 5.3, bathTrim);
    for (const x of [-3.6, -1.2, 1.2, 3.6]) column(porch, 0, x, 0.35, 4.9, 6.7, 0.3, bathTrim);
    B(porch, 'trim', 0, 7.05, 2.6, 10.4, 0.55, 5.4, bathTrim);
    pediment(porch, 0, 0, 5.35, 10.7, 7.6, 9.8, { warm: true });
    for (const side of [-1, 1]) {
      const ps = [
          [0, 9.75, 0],
          [side * 5.2, 7.65, 0],
          [side * 5.2, 7.65, 5.2],
          [0, 9.75, 5.2],
        ],
        n = normalFor(...ps);
      quad(porch, 'roof', ps, n[1] > 0 ? n : n.map((v) => -v), lead);
    }
    return;
  }

  const western = transform(o, 0, 0, -15.5);
  for (const x of [-6.6, -2.2, 2.2, 6.6]) column(western, d, x, 6.1, 0.5, 13.2, 0.42, bathTrim);
  B(western, 'trim', 0, 19.3, 0.15, 17.6, 0.7, 2.2, bathTrim);
  pediment(western, d, 0, 1.3, 18.4, 20, 23, { warm: true });
  gate(western, d, 0, 0, 0.08, 5.2, 5.5);
  for (const x of [-6.6, -2.2, 2.2, 6.6]) column(western, d, x, 0.2, 0.6, 5.8, 0.3, iron);
  const eastern = transform(o, Math.PI, 0, 34.9);
  for (const x of [-7.0, -2.3, 2.3, 7]) column(eastern, d, x, 6.1, 0.7, 13.0, 0.42, bathTrim);
  B(eastern, 'trim', 0, 19.1, 0.6, 18.2, 0.7, 2.5, bathTrim);
  pediment(eastern, d, 0, 1.9, 19.0, 19.8, 22.8, { warm: true });
  gate(eastern, d, 0, 0, 0.08, 5.4, 5.7);
  // Ambassadors' Court: a south-facing temple porch with exposed columns.
  const porch = transform(o, -Math.PI / 2, -61.5, 6.8);
  B(porch, 'trim', 0, -4, 2.6, 10.2, 4.35, 5.3, bathTrim);
  if (d > 1)
    for (let i = 0; i < 8; i++)
      B(porch, 'trim', 0, -4, 5.4 + i * 0.28, 8.7, 0.35 - i * 0.17 + 4, 0.29, bathTrim);
  for (const x of [-3.6, -1.2, 1.2, 3.6])
    column(porch, d === 3 ? 2 : 1, x, 0.35, 4.9, 6.7, 0.3, bathTrim);
  B(porch, 'trim', 0, 7.05, 2.6, 10.4, 0.55, 5.4, bathTrim);
  pediment(porch, d, 0, 5.35, 10.7, 7.6, 9.8, { warm: true });
  for (const side of [-1, 1]) {
    const ps = [
        [0, 9.75, 0],
        [side * 5.2, 7.65, 0],
        [side * 5.2, 7.65, 5.2],
        [0, 9.75, 5.2],
      ],
      n = normalFor(...ps);
    quad(porch, 'roof', ps, n[1] > 0 ? n : n.map((v) => -v), lead);
  }
  const door = rect(0, 0.65, 2.3, 4.9);
  if (d > 1) wall(porch, rect(0, -0.3, 8.7, 6.35), [door], 0.4, 0.25, bath);
  surface(porch, 'glass', door, d > 1 ? 0.15 : 0.45, glass);
  line(porch, d, 'trim', door, 0.45, 0.13, bathTrim, true);
  for (const f of faces(baseRings[0]).filter(
    (f) =>
      f.x < -58 && f.x > -96 && f.z > -14 && f.z < 28 && Math.abs(f.normal[1]) > 0.98 && f.w > 4,
  )) {
    facadeOnFace(o, d === 3 ? 2 : 1, f, 0, 6, { rows: [0.7], height: 4.3, spacing: 3.2 });
    if (d === 3) {
      const local = transform(o, f.angle, f.x, f.z),
        n = Math.floor(f.w / 3.2);
      for (let j = 0; j <= n; j++)
        column(local, 2, ((j - n / 2) * f.w) / n, 0.35, 0.75, 5.2, 0.2, bathTrim);
    }
  }
}
function conservatory(o, d) {
  const native = frame.features.find((f) => f.id === 'buildings/35185598843728').rings[0],
    x0 = Math.min(...native.map((p) => p[0])),
    x1 = Math.max(...native.map((p) => p[0])),
    z0 = Math.min(...native.map((p) => p[1])),
    z1 = Math.max(...native.map((p) => p[1])),
    xc = (x0 + x1) / 2;
  const front = transform(o, Math.PI, 0, z0 - 0.4);
  if (d > 0) {
    for (let i = 0; i < 6; i++)
      column(front, d, -xc + (i - 2.5) * 1.9, 1.2, 0.6, 6.5, 0.22, bathTrim);
    B(front, 'trim', -xc, 7.6, 0.15, x1 - x0, 0.45, 1.2, bathTrim);
  }
  pediment(front, d, -xc, 0.6, x1 - x0 + 0.7, 8.05, 10.7, { warm: true });
  for (const f of faces([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ])) {
    if (f.w < 5) continue;
    facadeOnFace(o, d, f, 1, 7.7, { rows: [1.6], height: 4.9, spacing: 2.7 });
  }
  const ridge = (x0 + x1) / 2;
  for (const s of [-1, 1]) {
    const p = [
      [ridge, 10.5, z0],
      [s < 0 ? x0 : x1, 7.8, z0],
      [s < 0 ? x0 : x1, 7.8, z1],
      [ridge, 10.5, z1],
    ];
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    quad(o, 'roof', p, n, lead);
  }
}
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
function clipCell(r, x0, z0, x1, z1) {
  let points = r;
  for (const [axis, value, sign] of [
    [0, x0, 1],
    [0, x1, -1],
    [1, z0, 1],
    [1, z1, -1],
  ]) {
    const next = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        ia = sign * (a[axis] - value) >= -1e-8,
        ib = sign * (b[axis] - value) >= -1e-8;
      if (ia) next.push(a);
      if (ia !== ib) {
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        next.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    points = next;
    if (points.length < 3) return [];
  }
  return points.filter(
    (p, i) =>
      Math.hypot(
        p[0] - points[(i + 1) % points.length][0],
        p[1] - points[(i + 1) % points.length][1],
      ) > 1e-7,
  );
}
function pavingTriangles() {
  const triangles = [],
    step = 3;
  for (const r of nativeRings.slice(1)) {
    const xs = r.map((p) => p[0]),
      zs = r.map((p) => p[1]),
      x0 = Math.floor(Math.min(...xs) / step) * step,
      x1 = Math.max(...xs),
      z0 = Math.floor(Math.min(...zs) / step) * step,
      z1 = Math.max(...zs);
    for (let z = z0; z < z1; z += step)
      for (let x = x0; x < x1; x += step) {
        const polygon = clipCell(r, x, z, x + step, z + step);
        if (polygon.length < 3) continue;
        const ids = earcut(polygon.flat());
        for (let i = 0; i < ids.length; i += 3) {
          const ps = ids.slice(i, i + 3).map((j) => polygon[j]),
            center = [ps.reduce((s, p) => s + p[0], 0) / 3, ps.reduce((s, p) => s + p[1], 0) / 3];
          if (Math.abs(area(ps)) < 1e-8 || !inRing(center, r)) continue;
          triangles.push(ps);
        }
      }
  }
  return triangles;
}
const courtyardPaving = pavingTriangles();
let pavingLift = 0.045;
for (const ps of courtyardPaving)
  for (const weights of [
    [1 / 3, 1 / 3, 1 / 3],
    [0.5, 0.5, 0],
    [0.5, 0, 0.5],
    [0, 0.5, 0.5],
    [0.75, 0.125, 0.125],
    [0.125, 0.75, 0.125],
    [0.125, 0.125, 0.75],
  ]) {
    const x = ps.reduce((s, p, i) => s + p[0] * weights[i], 0),
      z = ps.reduce((s, p, i) => s + p[1] * weights[i], 0),
      interpolated = ps.reduce((s, p, i) => s + sample(...p) * weights[i], 0);
    pavingLift = Math.max(pavingLift, sample(x, z) - interpolated + 0.025);
  }
function paving(o, d) {
  if (d < 3) return;
  for (const ps of courtyardPaving) {
    let p = ps.map((v) => [v[0], sample(...v) + pavingLift, v[1]]),
      n = normalFor(...p);
    if (n[1] < 0) {
      p.reverse();
      n = n.map((v) => -v);
    }
    o.addTriangle(
      'paving',
      ref,
      p,
      n,
      p.map((v) => [v[0], v[2]]),
      rgb('aaa18f'),
    );
  }
}

function build(o, d) {
  base(o, d);
  masses(o, d);
  eastFront(o, d);
  surroundingFacades(o, d === 2 ? 1 : d === 3 ? 2 : d);
  garden(o, d);
  courtyardPorticoes(o, d);
  conservatory(o, d);
  paving(o, d);
}
export const buckinghamPalace = (o) => build(o, 3),
  buckinghamPalaceStreet = (o) => build(o, 2),
  buckinghamPalaceDistrict = (o) => build(o, 1),
  buckinghamPalaceSkyline = (o) => build(o, 0);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.34, metallic: 0.05 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.7,
    metallic: 0.35,
    doubleSided: true,
  },
  roof: { slot: 'roof', localRef: ref, roughness: 0.87, metallic: 0.2 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.66, metallic: 0.45 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
};
export const buckinghamPalaceModel = {
  id: 'buckingham_palace',
  key: 'buckingham_palace',
  recipe: 'structure-buckingham-palace.mjs',
  cell: 'gc/gcp',
  title: 'Buckingham Palace',
  brief:
    'Individual palace quadrangle with native courtyard voids, pale Portland-stone three-pediment east facade in 3:7:3:7:3 bay rhythm, rusticated low storey/mezzanines, real arched carriage passages, divided sash glazing and giant Corinthian orders. Continuous first-floor balustrade and ceremonial balcony, pierced rooftop balustrade, original simplified pediment relief and bare flagstaff. Distinct warm Bath-stone garden front with engaged-column five-window bow, shallow green copper half dome, tall attic, giant-column pavilions, raised terrace/balustrades and conservatory. Attached palace wings/ballroom, courtyard porticoes and Ambassadors’ Court temple porch. Separate Royal Mews, memorial, gates, neighbors, people, interiors and photo textures excluded.',
  camera: [173, 100, 213],
  lookAt: [-12, 10, -7],
  qaCameras: [
    { name: 'front', position: [0, 15, 166], lookAt: [0, 12, 60] },
    { name: 'balcony-detail', position: [20, 16, 92], lookAt: [0, 11, 62] },
    { name: 'east-pavilion', position: [65, 19, 92], lookAt: [45, 13, 62] },
    { name: 'quadrangle', position: [12, 91, 22], lookAt: [0, 4, 0] },
    { name: 'court-portico', position: [25, 21, 5], lookAt: [0, 11, -17] },
    { name: 'garden-bow', position: [23, 26, -107], lookAt: [0, 13, -62] },
    { name: 'garden-terrace', position: [65, 19, -114], lookAt: [23, 8, -63] },
    { name: 'ambassadors-court', position: [-93, 14, 15], lookAt: [-65, 5, 7] },
  ],
  mediumFiContext: { scale: 1.3, cameraYaw: 0, groundY: -4 },
  build: buckinghamPalace,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Four unchanged original Terrarium tiles, 2m/193×193 review grid, source pixels 2.974m. Dry main east forecourt [0,65] datum 6.4092m. Native outline ground −1.174..+0.470m; buried −4m foundation, own raised garden terrace and steps. Ground remains unchanged; threshold engineering is approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-buckingham-palace.mjs',
    level: 'skyline',
    export: 'buckinghamPalaceSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'buckinghamPalaceDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'buckinghamPalaceStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: frame.limitations,
};
export {
  base,
  baseRings,
  build,
  clean,
  courtyardPaving,
  eastFront,
  facadeGroups,
  faces,
  frontRows,
  frontXs,
  garden,
  masses,
  nativeRings,
  pavingLift,
  portalXs,
  sample,
};
