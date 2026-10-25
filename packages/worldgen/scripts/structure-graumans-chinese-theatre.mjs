/** Grauman’s Chinese Theatre: native auditorium, open court and single swept pagoda portal. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
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
    rod(o, d === 3 ? 3 : 0, slot, [...a, z], [...b, z], w, col);
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
        '../../../content/worldgen/source/places/9q/9q5/graumans_chinese_theatre/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  terrain = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9q/9q5/graumans_chinese_theatre/terrain-grid.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  pale = rgb('d9d9c5'),
  shadow = rgb('858b77'),
  red = rgb('c64c32'),
  orange = rgb('cf7446'),
  gold = rgb('b19454'),
  bronze = rgb('5d7566'),
  roofgreen = rgb('62794e'),
  dark = rgb('30382e'),
  concrete = rgb('aaa99b');
function grade(x, z) {
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
function face(o, s, ps, c, n = [0, 0, 1]) {
  flat(o, s, ps, c, n);
}
function ring(o, d, x, y, z, rx, ry, col, w = 0.06) {
  line(
    o,
    d,
    ellipse(x, y, rx, ry, d === 0 ? 6 : d === 1 ? 10 : d === 2 ? 20 : 32),
    z,
    col,
    w,
    'metal',
    true,
  );
}
function disc(o, x, y, z, rx, ry, col, n = 20) {
  face(
    o,
    'metal',
    ellipse(x, y, rx, ry, n).map((p) => [...p, z]),
    col,
  );
}
function taper(o, x, y, z, w, h, dep, col, slot = 'metal') {
  poly(
    o,
    slot,
    [
      [x - w / 2, z - dep / 2],
      [x + w / 2, z - dep / 2],
      [x + w / 2, z + dep / 2],
      [x - w / 2, z + dep / 2],
    ],
    y,
    y + 0.05,
    col,
  );
  const a = [
      [x - w / 2, y, z - dep / 2],
      [x + w / 2, y, z - dep / 2],
      [x + w / 2, y, z + dep / 2],
      [x - w / 2, y, z + dep / 2],
    ],
    b = [
      [x - w * 0.2, y + h, z - dep * 0.2],
      [x + w * 0.2, y + h, z - dep * 0.2],
      [x + w * 0.2, y + h, z + dep * 0.2],
      [x - w * 0.2, y + h, z + dep * 0.2],
    ];
  for (let i = 0; i < 4; i++) {
    const q = [a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]];
    quad(o, slot, q, normalFor(...q), col);
  }
  quad(o, slot, b, [0, 1, 0], col);
}
function flame(o, d, x, y, z, size, col = dark) {
  const ps = [
    [-0.28, 0],
    [-0.44, 0.2],
    [-0.35, 0.5],
    [-0.12, 0.77],
    [0, 1.2],
    [0.16, 0.82],
    [0.34, 0.55],
    [0.42, 0.2],
    [0.25, 0],
  ];
  panel(
    o,
    'metal',
    ps.map(([u, v]) => [x + u * size, y + v * size]),
    z - 0.035,
    z + 0.035,
    col,
  );
  if (d > 1)
    line(
      o,
      1,
      ps.slice(1, 7).map(([u, v]) => [x + u * size * 0.55, y + v * size * 0.8]),
      z + 0.045,
      gold,
      0.035,
    );
}
function spire(o, d, x, z, h = 23.7, base = 13.6, small = false) {
  const w = small ? 0.65 : 1.1;
  taper(o, x, base, z, w, h - base - (small ? 1.2 : 2), w, bronze);
  if (d > 1) {
    for (let y = base + 0.7; y < h - 2; y += 1.3)
      for (const a of [0, Math.PI / 2]) {
        const q = transform(o, a, x, z);
        B(q, 'metal', 0, y, w * 0.36, w * 0.77, 0.035, 0.035, gold);
      }
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const q = transform(o, a, x, z);
      panel(
        q,
        'metal',
        [
          [-w * 0.58, base + 0.5],
          [-w * 0.6, base + 2.6],
          [-w * 0.32, base + 2.2],
          [-w * 0.22, base + 0.5],
        ],
        w * 0.2,
        w * 0.25,
        bronze,
      );
    }
  }
  const a = small ? 1.05 : 1.7;
  rod(o, 0, 'metal', [x, h - a, z], [x, h + 0.5, z], 0.065, dark);
  for (const s of [-1, 1])
    line(
      o,
      0,
      [
        [x + s * 0.1, h - a],
        [x + s * 0.5, h - 0.6],
        [x + s * 0.42, h + 0.2],
      ],
      z,
      dark,
      0.065,
    );
  if (d > 1)
    for (const s of [-1, 1])
      line(
        o,
        0,
        [
          [x + s * 0.1, h - 1.25],
          [x + s * 0.7, h - 0.6],
          [x + s * 0.67, h - 0.2],
          [x + s * 0.4, h - 0.55],
        ],
        z,
        dark,
        0.045,
      );
}
function paving(o, d) {
  const n = [2, 7, 23, 39][d],
    x0 = -18.7,
    x1 = 20.5,
    z0 = -4.9,
    z1 = 18.1;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const xa = x0 + ((x1 - x0) * i) / n,
        xb = x0 + ((x1 - x0) * (i + 1)) / n,
        za = z0 + ((z1 - z0) * j) / n,
        zb = z0 + ((z1 - z0) * (j + 1)) / n,
        q = [
          [xa, grade(xa, za) + 0.08, za],
          [xb, grade(xb, za) + 0.08, za],
          [xb, grade(xb, zb) + 0.08, zb],
          [xa, grade(xa, zb) + 0.08, zb],
        ],
        c = [rgb('aaa394'), rgb('b3a99e'), rgb('bab1a2'), rgb('a4aaa0'), rgb('b6aa9c')][
          (i * 13 + j * 7 + ((i * j) % 11)) % 5
        ];
      quad(o, 'paving', q, [0, 1, 0], c);
    }
}
function shell(o, d) {
  const r = frame.geometry.outline,
    east = [...r.slice(0, 15), [5.81013, -4.69755], [22.62244, -4.69755]],
    west = [...r.slice(18, 39), [-18.6666, -4.69755], [-5.81013, -4.69755]],
    rear = [[r[38][0], -4.69755], ...r.slice(39), [r[43][0], -4.69755]];
  poly(o, 'wall', east, -3, 11.15, pale);
  poly(o, 'wall', west, -3, 11.15, pale);
  poly(o, 'wall', rear, -3, 18.1, concrete);
  poly(o, 'roof', rear, 18.1, 18.23, rgb('929688'));
  // Native central protrusion is an open portico: retain its posts and an inset back wall.
  B(o, 'wall', 0, 3.7, -3.08, 11.62, 14.5, 5.24, pale);
  for (const v of [-1, 1]) B(o, 'wall', v * 3.655, -3, -3.08, 4.31, 6.7, 5.24, pale);
  quad(
    o,
    'glass',
    [
      [-1.5, 0.1, -3],
      [1.5, 0.1, -3],
      [1.5, 3.7, -3],
      [-1.5, 3.7, -3],
    ],
    [0, 0, 1],
    dark,
  );
  B(o, 'wall', 0, 6.1, -0.41, 10.45, 11.55, 0.4, shadow);
  for (const s of [-1, 1]) {
    if (d > 0) B(o, 'wall', s * 5.95, 0.45, 1.9, 1.15, 17.75, 5.1, red);
    B(o, 'wall', s * 6.6, -3, 4, 1.5, 20.1, 1.5, red);
    B(o, 'stone', s * 6.6, 17.1, 3.9, 1.9, 0.75, 1.9, dark);
    for (let j = 0; j < (d === 0 ? 2 : 3); j++) {
      const k = d === 0 ? j * 2 : j,
        w = 2.05 + k * 0.45;
      B(o, 'stone', s * 6.6, 17.85 + k * 0.69, 3.85, w, 0.65, w, pale);
      if (d > 0) {
        const q = transform(o, 0, s * 6.6, 3.85 + w / 2 + 0.02);
        panel(
          q,
          'accent',
          [
            [-w * 0.43, 17.9 + k * 0.69],
            [w * 0.43, 17.9 + k * 0.69],
            [w * 0.36, 18.43 + k * 0.69],
            [-w * 0.36, 18.43 + k * 0.69],
          ],
          -0.01,
          0.025,
          orange,
        );
        if (d > 1)
          line(
            q,
            1,
            [
              [-w * 0.42, 17.94 + k * 0.69],
              [w * 0.42, 17.94 + k * 0.69],
              [w * 0.35, 18.4 + k * 0.69],
              [-w * 0.35, 18.4 + k * 0.69],
              [-w * 0.42, 17.94 + k * 0.69],
            ],
            0.04,
            gold,
            0.045,
          );
      }
    }
  }
  B(o, 'stone', 0, 18.1, 0.15, 10.6, 1.2, 10.4, pale);
  B(o, 'metal', 0, 18.07, 1.4, 11.3, 0.04, 5.4, gold);
  if (d > 1) {
    for (let x = -5; x <= 5; x += 1) B(o, 'metal', x, 17.99, 1.4, 0.06, 0.08, 5.4, dark);
    for (let z = -1.2; z < 4.2; z += 0.9) B(o, 'metal', 0, 17.98, z, 10.8, 0.08, 0.06, dark);
  }
  // Auditory roof equipment is low and independent of the pagoda silhouette.
  if (d > 0) {
    B(o, 'wall', 1.2, 18.23, -43, 29, 1, 4, shadow);
    for (const z of [-39, -43])
      for (let x = -12; x < 13; x += d === 1 ? 11 : 5.5) {
        line(
          o,
          0,
          [
            [x, 19.23],
            [x + 2.5, 21.15],
            [x + 5, 19.23],
          ],
          z,
          pale,
          0.17,
        );
        rod(o, 0, 'metal', [x + 2.5, 21.15, z], [x + 2.5, 21.15, z - 3.7], 0.15, pale);
      }
  }
  if (d > 1)
    for (const s of [-1, 1])
      for (let z = -9; z > -57; z -= 7)
        B(o, 'stone', s < 0 ? -18.7 : 22.61, 4, z, 0.22, 13.4, 0.4, shadow);
  paving(o, d);
}
function roofPoint(t, a, side) {
  const w = 9.25 * (1 - t) + 2.2 * t,
    dep = 6.85 * (1 - t) + 0.13 * t,
    y = 19.45 + 5.8 * Math.pow(t, 1.65) + 0.85 * Math.pow(1 - t, 4) * Math.pow(Math.abs(a), 5),
    x = side % 2 === 0 ? a * w : side === 1 ? w : -w,
    z = side % 2 === 0 ? (side === 0 ? dep : -dep) : a * dep;
  return [x, y, z - 1.1];
}
function pagoda(o, d) {
  const n = [1, 3, 7, 20][d],
    k = [2, 4, 7, 15][d];
  for (let side = 0; side < 4; side++)
    for (let j = 0; j < k; j++)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 - 1,
          b = ((i + 1) / n) * 2 - 1,
          q = [
            roofPoint(j / k, a, side),
            roofPoint(j / k, b, side),
            roofPoint((j + 1) / k, b, side),
            roofPoint((j + 1) / k, a, side),
          ];
        if (normalFor(...q)[1] < 0) q.reverse();
        quad(o, 'roof', q, normalFor(...q), roofgreen);
      }
  // White swept eave is a structural band below the single green roof.
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < n; i++) {
      const a = roofPoint(0, (i / n) * 2 - 1, side),
        b = roofPoint(0, ((i + 1) / n) * 2 - 1, side),
        q = [
          a,
          b,
          b.map((v, k) => (k === 1 ? v - 0.7 : v)),
          a.map((v, k) => (k === 1 ? v - 0.7 : v)),
        ];
      const inner = (p) => [p[0] * 0.69, 18.72, -1.1 + (p[2] + 1.1) * 0.69];
      quad(
        o,
        'stone',
        [
          a.map((v, k) => (k === 1 ? v - 0.7 : v)),
          b.map((v, k) => (k === 1 ? v - 0.7 : v)),
          inner(b),
          inner(a),
        ],
        [0, -1, 0],
        shadow,
      );
      const nn = [0, 0, 0];
      nn[side % 2 === 0 ? 2 : 0] = side < 2 ? 1 : -1;
      quad(o, 'stone', q, nn, pale);
    }
    const c = Array.from({ length: n + 1 }, (_, i) => roofPoint(0, (i / n) * 2 - 1, side));
    for (let i = 1; i < c.length; i++) rod(o, 0, 'metal', c[i - 1], c[i], 0.13, dark);
  }
  B(o, 'roof', 0, 25.15, -1.1, 4.5, 0.24, 0.35, bronze);
  for (const x of [-2.25, 2.25]) {
    line(
      o,
      0,
      [
        [x, 25.3],
        [x, 27.432],
      ],
      -1.1,
      dark,
      0.075,
    );
    for (const s of [-1, 1])
      line(
        o,
        0,
        [
          [x, 25.4],
          [x + s * 0.38, 26.1],
          [x + s * 0.35, 27.15],
        ],
        -1.1,
        dark,
        0.06,
      );
  }
  for (const x of [-8.85, 8.85])
    for (const z of [-7.7, 5.5]) {
      const q = transform(o, Math.sign(x) * 0.25, x, z);
      for (let i = 0; i < (d === 0 ? 1 : 3); i++) {
        const s = Math.sign(x),
          ps = [
            [0, 19.7],
            [s * (0.25 + i * 0.14), 20.6],
            [s * (0.7 + i * 0.14), 22.6 - i * 0.2],
            [s * (0.44 + i * 0.1), 21.3],
            [s * 0.06, 20.2],
          ];
        panel(q, 'metal', ps, -0.04, 0.04, dark);
      }
      if (d > 0)
        line(
          q,
          0,
          [
            [0, 20.4],
            [Math.sign(x) * 0.8, 21.5],
            [Math.sign(x) * 0.95, 23],
          ],
          0,
          bronze,
          0.055,
        );
    }
  if (d > 0) {
    const rows = [0, 5, 10, 24][d];
    for (let side = 0; side < 4; side++)
      for (let row = 1; row < rows; row++) {
        const t = row / rows;
        for (let i = 0; i < n; i++) {
          const a = roofPoint(t, (i / n) * 2 - 1, side),
            b = roofPoint(t, ((i + 1) / n) * 2 - 1, side);
          a[1] += 0.025;
          b[1] += 0.025;
          rod(o, 0, 'metal', a, b, 0.045, bronze);
        }
      }
  }
  if (d > 1)
    for (let side = 0; side < 4; side++)
      for (let i = 1; i <= (d === 2 ? 8 : 29); i++) {
        const a = (i / ((d === 2 ? 8 : 29) + 1)) * 2 - 1;
        for (let j = 0; j < k; j++) {
          const A = roofPoint(j / k, a, side),
            B = roofPoint((j + 1) / k, a, side);
          A[1] += 0.03;
          B[1] += 0.03;
          rod(o, 0, 'metal', A, B, 0.026, bronze);
        }
      }
}
function mask(o, d, x, z, angle = 0) {
  const q = transform(o, angle, x, z),
    y = 15.2;
  const outline = [
    [-0.9, -0.45],
    [-0.92, 0.35],
    [-0.65, 0.8],
    [-0.28, 0.88],
    [0, 1.05],
    [0.28, 0.88],
    [0.65, 0.8],
    [0.92, 0.35],
    [0.9, -0.45],
    [0.6, -1.1],
    [0.36, -1.6],
    [0, -1.83],
    [-0.36, -1.6],
    [-0.6, -1.1],
  ];
  if (d === 0) {
    face(
      q,
      'metal',
      outline.map(([u, v]) => [u, y + v, 0.1]),
      dark,
    );
    return;
  }
  if (d === 1) {
    const hole = ellipse(0, y - 0.6, 0.4, 0.45, 6);
    flat(
      q,
      'metal',
      outline.map(([u, v]) => [u, y + v, 0.1]),
      dark,
      [0, 0, 1],
      [hole.map((p) => [...p, 0.1])],
    );
    line(q, 0, hole, 0.13, gold, 0.07, 'metal', true);
    for (const v of [-1, 1]) {
      disc(q, v * 0.38, y + 0.35, 0.14, 0.13, 0.1, gold, 6);
      line(
        q,
        0,
        [
          [v * 0.3, y + 0.8],
          [v * 0.5, y + 2.25],
        ],
        0.05,
        dark,
        0.12,
      );
    }
    return;
  }
  const mouth = [
      [-0.5, y - 0.45],
      [-0.34, y - 0.12],
      [0, y - 0.04],
      [0.34, y - 0.12],
      [0.5, y - 0.45],
      [0.3, y - 0.95],
      [0, y - 1.15],
      [-0.3, y - 0.95],
    ],
    outer = outline.map(([u, v]) => [u, y + v]);
  flat(
    q,
    'metal',
    outer.map((p) => [...p, 0.1]),
    dark,
    [0, 0, 1],
    [mouth.map((p) => [...p, 0.1])],
  );
  line(q, 0, outer, 0.12, gold, 0.045, 'metal', true);
  face(
    q,
    'metal',
    mouth.map((p) => [...p, 0.025]),
    dark,
  );
  line(q, 0, mouth, 0.15, gold, 0.065, 'metal', true);
  for (const s of [-1, 1]) {
    disc(q, s * 0.39, y + 0.3, 0.16, 0.16, 0.1, gold, d === 1 ? 6 : 14);
    disc(q, s * 0.39, y + 0.31, 0.19, 0.065, 0.058, dark, 8);
    line(
      q,
      d,
      [
        [s * 0.74, y + 0.34],
        [s * 0.5, y + 0.58],
        [s * 0.16, y + 0.54],
      ],
      0.19,
      gold,
      0.1,
    );
    line(
      q,
      0,
      [
        [s * 0.58, y + 0.03],
        [s * 0.35, y - 0.25],
        [s * 0.26, y - 0.66],
      ],
      0.22,
      gold,
      0.11,
    );
    line(
      q,
      0,
      [
        [s * 0.6, y - 0.5],
        [s * 0.37, y - 1.2],
        [s * 0.7, y - 1.65],
      ],
      0.18,
      dark,
      0.12,
    );
    line(
      q,
      0,
      [
        [s * 0.7, y + 0.5],
        [s * 1.18, y + 0.87],
        [s * 1.28, y + 0.6],
        [s * 1.17, y + 0.08],
        [s * 0.8, y - 0.6],
      ],
      0.04,
      gold,
      0.065,
    );
    for (let j = 0; j < 2; j++)
      panel(
        q,
        'metal',
        [
          [s * (0.2 + j * 0.34), y + 0.6],
          [s * (0.45 + j * 0.3), y + 2.25],
          [s * (0.22 + j * 0.34), y + 1.95],
          [s * (0.08 + j * 0.33), y + 0.8],
        ],
        0,
        0.07,
        dark,
      );
  }
  sphere(q, 'metal', [0, y + 0.03, 0.18], [0.19, 0.29, 0.13], dark, d > 1 ? 12 : 6, d > 1 ? 6 : 3);
  if (d > 1) {
    for (const s of [-1, 1])
      for (let j = 0; j < 5; j++)
        line(
          q,
          0,
          [
            [s * (0.5 + j * 0.055), y + 0.04],
            [s * (0.55 + j * 0.06), y - 0.4],
            [s * (0.4 + j * 0.06), y - 0.7],
          ],
          0.125,
          gold,
          0.014,
        );
    for (let i = 0; i < 5; i++)
      line(
        q,
        0,
        [
          [i * 0.13 - 0.26, y - 0.6],
          [i * 0.16 - 0.32, y - 1.1],
          [i * 0.06 - 0.12, y - 1.6],
        ],
        0.17,
        dark,
        0.055,
      );
  }
}
function lion(o, d, x, z) {
  const y = grade(x, z) + 0.13;
  B(o, 'stone', x, y, z, 1.45, 0.6, 1.65, pale);
  if (d === 0) {
    B(o, 'stone', x, y + 0.6, z, 0.85, 1.15, 1, pale);
    return;
  }
  if (d === 1) {
    sphere(o, 'stone', [x, y + 1.25, z - 0.12], [0.49, 0.7, 0.58], pale, 5, 3);
    sphere(o, 'stone', [x, y + 2.05, z + 0.26], [0.63, 0.6, 0.48], pale, 6, 3);
    B(o, 'stone', x, y + 0.6, z + 0.4, 0.6, 0.7, 0.4, pale);
    return;
  }
  sphere(
    o,
    'stone',
    [x, y + 1.25, z - 0.12],
    [0.49, 0.7, 0.58],
    pale,
    d === 1 ? 5 : 12,
    d === 1 ? 3 : 7,
  );
  sphere(
    o,
    'stone',
    [x, y + 1.98, z + 0.24],
    [0.63, 0.6, 0.48],
    pale,
    d === 1 ? 6 : 14,
    d === 1 ? 3 : 7,
  );
  sphere(
    o,
    'stone',
    [x, y + 1.8, z + 0.59],
    [0.47, 0.25, 0.24],
    pale,
    d === 1 ? 5 : 10,
    d === 1 ? 3 : 5,
  );
  for (const s of [-1, 1]) {
    B(o, 'stone', x + s * 0.27, y + 0.6, z + 0.44, 0.24, 0.85, 0.35, pale);
    disc(o, x + s * 0.24, y + 2.02, z + 0.68, 0.09, 0.07, dark, 8);
    sphere(o, 'stone', [x + s * 0.43, y + 2.37, z + 0.18], [0.22, 0.23, 0.18], pale, 8, 4);
  }
  line(
    o,
    0,
    [
      [x - 0.31, y + 1.68],
      [x, y + 1.61],
      [x + 0.31, y + 1.68],
    ],
    z + 0.77,
    shadow,
    0.055,
  );
  if (d > 2) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ring(
        o,
        0,
        x + Math.cos(a) * 0.5,
        y + 2 + Math.sin(a) * 0.47,
        z + 0.62,
        0.09,
        0.075,
        shadow,
        0.025,
      );
    }
    ring(o, 0, x, y + 1.28, z + 0.48, 0.39, 0.3, shadow, 0.055);
  }
}
function dragonRelief(o, d, x, y, z, w, h, col = gold) {
  if (d === 0) {
    line(
      o,
      0,
      [
        [x + w * 0.3, y + h * 0.9],
        [x - w * 0.27, y + h * 0.73],
        [x + w * 0.26, y + h * 0.42],
        [x - w * 0.25, y + h * 0.16],
      ],
      z,
      col,
      0.25,
    );
    return;
  }
  const ps = curve(
    [
      [x + w * 0.32, y + h * 0.88],
      [x + w * 0.11, y + h * 0.96],
      [x - w * 0.22, y + h * 0.75],
      [x + w * 0.28, y + h * 0.59],
      [x + w * 0.12, y + h * 0.4],
      [x - w * 0.3, y + h * 0.24],
      [x - w * 0.14, y + h * 0.04],
    ],
    d === 1 ? 2 : 5,
  );
  line(o, d, ps, z, col, w > 3 ? 0.32 : 0.17);
  if (d > 1 && w > 3) {
    const hx = x + w * 0.29,
      hy = y + h * 0.88;
    sphere(o, 'stone', [hx, hy, z + 0.12], [0.27, 0.22, 0.13], col, 10, 4);
    B(o, 'stone', hx + 0.19, hy - 0.11, z + 0.18, 0.46, 0.16, 0.14, col);
    disc(o, hx + 0.06, hy + 0.07, z + 0.26, 0.045, 0.045, dark, 8);
    for (const v of [-1, 1])
      line(
        o,
        0,
        [
          [hx + v * 0.1, hy + 0.1],
          [hx + v * 0.25, hy + 0.48],
          [hx + v * 0.36, hy + 0.54],
        ],
        z + 0.12,
        col,
        0.065,
      );
    for (let i = 2; i < ps.length - 2; i += 3) {
      const a = ps[i],
        b = ps[i + 1],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy),
        vx = -dy / len,
        vy = dx / len;
      panel(
        o,
        'stone',
        [
          [a[0] + vx * 0.13, a[1] + vy * 0.13],
          [a[0] + vx * 0.39, a[1] + vy * 0.39],
          [b[0] + vx * 0.12, b[1] + vy * 0.12],
        ],
        z + 0.035,
        z + 0.09,
        col,
      );
    }
  }

  for (const s of [-1, 1])
    for (const k of [0.29, 0.58]) {
      const yy = y + h * k;
      line(
        o,
        0,
        [
          [x, yy],
          [x + s * w * 0.28, yy + h * 0.06],
          [x + s * w * 0.41, yy - h * 0.04],
        ],
        z + 0.035,
        col,
        0.11,
      );
      if (d > 1)
        for (let j = 0; j < 3; j++)
          line(
            o,
            0,
            [
              [x + s * w * 0.4, yy - h * 0.03],
              [x + s * (w * 0.43 + j * 0.06), yy - h * 0.1],
            ],
            z + 0.06,
            col,
            0.045,
          );
    }
  if (d > 1) {
    disc(o, x + w * 0.2, y + h * 0.87, z + 0.08, 0.24, 0.18, col, 16);
    disc(o, x + w * 0.24, y + h * 0.91, z + 0.1, 0.045, 0.045, dark, 8);
    for (let j = 1; j < ps.length; j += 2)
      ring(o, 0, ps[j][0], ps[j][1], z + 0.08, 0.12, 0.15, shadow, 0.025);
  }
}
function doors(o, d) {
  for (const s of [-1, 1]) {
    const x = s * 3.3,
      y = grade(x, -0.12) + 0.08;
    B(o, 'stone', x, y - 0.08, 0.15, 3.1, 0.14, 0.7, pale);
    B(o, 'metal', x, y, -0.12, 2.95, 3.16, 0.08, dark);
    if (d === 0) B(o, 'metal', x, y + 0.06, -0.04, 2.8, 3.03, 0.07, gold);
    for (const dx of d === 0 ? [] : [-1, 1]) {
      const xx = x + dx * 0.71;
      B(o, 'metal', xx, y + 0.06, -0.04, 1.38, 3.03, 0.07, gold);
      if (d > 0) {
        B(o, 'glass', xx, y + 1.35, 0.007, 0.49, 0.86, 0.035, dark);
        for (const v of [-1, 1])
          B(o, 'metal', xx + v * 0.28, y + 1.28, 0.05, 0.09, 1.12, 0.08, gold);
        B(o, 'metal', xx, y + 1.22, 0.05, 0.66, 0.14, 0.08, gold);
        if (d > 1)
          line(
            o,
            0,
            [
              [xx - 0.49, y + 2.43],
              [xx - 0.3, y + 2.22],
              [xx, y + 2.15],
              [xx + 0.3, y + 2.22],
              [xx + 0.49, y + 2.43],
            ],
            0.055,
            gold,
            0.09,
          );
        if (d > 1) {
          ring(o, 0, xx, y + 2.68, 0.055, 0.13, 0.1, gold, 0.04);
          for (let j = 0; j < 4; j++)
            B(o, 'metal', xx - 0.18 + j * 0.12, y + 2.26, 0.06, 0.025, 0.2, 0.03, gold);
          B(o, 'metal', xx, y + 0.1, 0.02, 1.36, 0.2, 0.04, orange);
        }
      }
    }
    if (d > 0) {
      disc(o, x, y + 1, 0.1, 0.23, 0.22, gold, 12);
      B(o, 'metal', x, y + 0.95, 0.17, 0.45, 0.08, 0.1, gold);
    }
  }
  B(o, 'stone', 0, 3.7, -0.2, 11.15, 0.46, 0.65, pale);
  if (d > 1) for (let x = -5; x < 5; x += 0.75) ring(o, 0, x, 3.91, 0.16, 0.25, 0.12, gold, 0.035);
  B(o, 'stone', 0, 4.15, -0.18, 5.65, 11.7, 0.25, gold);
  if (d > 0) {
    B(o, 'stone', 0, 4.4, -0.015, 5.18, 11.1, 0.05, pale);
    dragonRelief(o, d, 0, 4.6, 0.08, 4.6, 10.4, gold);
    for (const x of [-4.7, -4.1, 4.1, 4.7]) {
      B(o, 'metal', x, 4.3, 0.06, 0.14, 13.5, 0.18, bronze);
      if (d > 1) B(o, 'accent', x + 0.12, 4.3, 0.02, 0.065, 13.5, 0.06, red);
    }
  }
  // Small canopy and sun are separate from the tall main pagoda.
  for (let j = 0; j < 4; j++) {
    const u = j / 4,
      v = (j + 1) / 4,
      w = 1.65 * (1 - u) + 0.16 * u,
      ww = 1.65 * (1 - v) + 0.16 * v,
      y = 4.15 + 1.15 * u * u,
      yy = 4.15 + 1.15 * v * v;
    quad(
      o,
      'metal',
      [
        [-w, y, 1.2],
        [w, y, 1.2],
        [ww, yy, 0.12],
        [-ww, yy, 0.12],
      ],
      normalFor([-w, y, 1.2], [w, y, 1.2], [ww, yy, 0.12]),
      bronze,
    );
  }
  disc(o, 0, 5.75, 0.06, 0.77, 0.77, bronze, d === 0 ? 8 : 24);
  if (d > 0) {
    ring(o, 0, 0, 5.75, 0.1, 0.77, 0.77, gold, 0.055);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(
        o,
        0,
        [
          [Math.cos(a) * 0.8, 5.75 + Math.sin(a) * 0.8],
          [Math.cos(a) * 1.03, 5.75 + Math.sin(a) * 1.16],
          [Math.cos(a + 0.08) * 0.99, 5.75 + Math.sin(a + 0.08) * 1.22],
        ],
        0.04,
        dark,
        0.06,
      );
    }
  }
  disc(o, 0, 17.7, 4.2, 0.81, 0.88, bronze, d === 0 ? 8 : 24);
  if (d > 0) {
    ring(o, 0, 0, 17.7, 4.23, 0.81, 0.88, gold, 0.055);
    line(
      o,
      0,
      [
        [-0.3, 18.6],
        [0, 18.9],
        [0.3, 18.6],
      ],
      4.1,
      dark,
      0.07,
    );
    for (const x of [-3.9, 3.9]) {
      rod(o, 0, 'metal', [x, 18.05, 4], [x, 16.1, 4], 0.025, bronze);
      taper(o, x, 15.95, 4, 0.13, 0.26, 0.13, bronze);
    }
  }
  for (const s of [-1, 1]) {
    mask(o, d, s * 6.6, 4.85);
    if (d > 0) mask(o, d === 1 ? 0 : d === 2 ? 1 : d, s * 7.38, 4, (Math.sign(s) * Math.PI) / 2);
    lion(o, d, s * 6.6, 5.7);
  }
}
function glyph(o, letter, x, y, z, w, h) {
  const g = {
    C: [
      [
        [1, 0.9],
        [0.75, 1],
        [0.2, 1],
        [0, 0.75],
        [0, 0.2],
        [0.25, 0],
        [0.8, 0],
        [1, 0.15],
      ],
    ],
    H: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
    I: [
      [
        [0.15, 1],
        [0.85, 1],
      ],
      [
        [0.5, 1],
        [0.5, 0],
      ],
      [
        [0.15, 0],
        [0.85, 0],
      ],
    ],
    N: [
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    ],
    E: [
      [
        [1, 1],
        [0, 1],
        [0, 0],
        [1, 0],
      ],
      [
        [0, 0.5],
        [0.8, 0.5],
      ],
    ],
    S: [
      [
        [1, 0.85],
        [0.75, 1],
        [0.2, 1],
        [0, 0.75],
        [0.15, 0.55],
        [0.8, 0.4],
        [1, 0.2],
        [0.8, 0],
        [0.2, 0],
        [0, 0.15],
      ],
    ],
  };
  for (const ps of g[letter])
    line(
      o,
      0,
      ps.map(([u, v]) => [x + u * w, y + v * h]),
      z,
      gold,
      0.075,
    );
}
function wingWindow(o, d, x, z) {
  const q = transform(o, 0, x, z);
  if (d <= 1) {
    face(
      q,
      'glass',
      [
        [-1.75, 3.9, 0.03],
        [1.75, 3.9, 0.03],
        [1.75, 7.7, 0.03],
        [-1.75, 7.7, 0.03],
      ],
      dark,
    );
    if (d === 1) {
      for (const x of [-0.58, 0.58])
        line(
          q,
          0,
          [
            [x, 3.9],
            [x, 7.7],
          ],
          0.08,
          pale,
          0.15,
          'stone',
        );
      for (let y = 4.75; y < 7.7; y += 0.9)
        line(
          q,
          0,
          [
            [-1.75, y],
            [1.75, y],
          ],
          0.08,
          pale,
          0.15,
          'stone',
        );
    }
    return;
  }
  B(q, 'stone', 0, 3.9, -0.17, 3.5, 3.8, 0.3, shadow);
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 3; i++) {
      B(q, 'glass', -1.15 + i * 1.15, 4.05 + j * 0.88, 0.025, 0.8, 0.64, 0.025, dark);
    }
  if (d > 0) {
    B(q, 'stone', 0, 3.85, 0.055, 3.8, 0.14, 0.13, pale);
    B(q, 'stone', 0, 7.75, 0.055, 3.8, 0.14, 0.13, pale);
  }
}
function ornament(o, d, x, y, z) {
  if (d === 0) return;
  if (d === 1) {
    disc(o, x, y + 1, z, 0.5, 0.5, orange, 8);
    for (const v of [-1, 0, 1])
      line(
        o,
        0,
        [
          [x, y - 0.8],
          [x + v * 0.6, y + 0.9],
          [x + v * 0.4, y + 2.8],
        ],
        z,
        dark,
        0.09,
      );
    return;
  }
  disc(o, x, y + 1, z, 0.45, 0.45, orange, 12);
  ring(o, 0, x, y + 1, z + 0.02, 0.5, 0.5, gold, 0.06);
  for (const s of [-1, 1])
    for (let j = 0; j < 3; j++)
      line(
        o,
        0,
        [
          [x, y - 0.8],
          [x + s * (0.48 + j * 0.2), y + 0.2 + j * 0.27],
          [x + s * (0.6 + j * 0.24), y + 0.5 + j * 0.3],
        ],
        z,
        dark,
        0.075,
      );
  for (let j = -2; j <= 2; j++)
    line(
      o,
      0,
      [
        [x + j * 0.16, y + 1.4],
        [x + j * 0.27, y + 2.1],
        [x + j * 0.21, y + 2.7 + (0.4 - Math.abs(j) * 0.15)],
      ],
      z,
      dark,
      0.065,
    );
  for (const s of [-1, 1]) {
    line(
      o,
      0,
      [
        [x, y - 0.5],
        [x + s * 0.7, y - 0.5],
        [x + s * 0.7, y - 1.5],
      ],
      z,
      dark,
      0.045,
    );
    taper(o, x + s * 0.7, y - 1.55, z, 0.28, 0.28, 0.25, dark);
  }
  if (d > 1) {
    ring(o, 0, x, y + 1, z + 0.035, 0.3, 0.3, dark, 0.05);
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      disc(o, x + Math.cos(a) * 0.43, y + 1 + Math.sin(a) * 0.43, z + 0.05, 0.08, 0.08, gold, 6);
    }
  }
}
function court(o, d) {
  const r = frame.geometry.outline;
  for (const s of [-1, 1]) {
    const inds = s === 1 ? [4, 5, 6, 7, 8, 9, 10, 11, 12] : [21, 22, 23, 24, 25, 26, 27, 28, 29],
      ps = inds.map((i) => r[i]);
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i],
        mid = a.map((v, k) => (v + b[k]) / 2),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        angle = Math.atan2(a[1] - b[1], b[0] - a[0]) + Math.PI,
        q = transform(o, angle, ...mid);
      if (d > 0) B(q, 'stone', 0, 10.7, 0, len + 0.04, 0.32, 0.35, pale);
      else
        face(
          q,
          'stone',
          [
            [-len / 2, 10.7, 0.08],
            [len / 2, 10.7, 0.08],
            [len / 2, 11.02, 0.08],
            [-len / 2, 11.02, 0.08],
          ],
          pale,
        );
      if (d > 0) B(q, 'stone', 0, 2.4, 0.035, len + 0.04, 0.26, 0.12, shadow);
      if (d > 0 && i % 3 === 0) {
        B(q, 'stone', 0, 2.55, 0.04, 0.26, 8.25, 0.18, pale);
        spire(o, d, mid[0], mid[1], 13.3, 11.05, true);
      }
      if (d > 0 && i === 3) {
        const n = transform(o, angle, ...mid);
        ornament(n, d, 0, 5, 0.08);
      }
      if (d > 1 && i === 6) {
        const n = transform(o, angle, ...mid);
        const p = [
          [-1.3, 4],
          [1.3, 4],
          [1.3, 8.9],
          [0, 10.15],
          [-1.3, 8.9],
        ];
        flat(
          n,
          'stone',
          p.map((p) => [...p, 0.08]),
          shadow,
        );
        line(n, 0, p, 0.12, pale, 0.12, 'stone', true);
        B(n, 'stone', 0, 5.1, 0.45, 1.2, 0.5, 0.6, pale);
        flame(n, 2, 0, 7.7, 0.14, 0.65);
      }
    }
    // Rear low wings are shaped independently of the tall entry portal.
    wingWindow(o, d, s * 10, 0.6);
    if (d > 0) {
      const ps = curve(
        [
          [s * 7.5, 9.55],
          [s * 10, 9.6],
          [s * 13.6, 10.2],
        ],
        4,
      );
      line(o, 0, ps, 0.56, red, 0.37);
      if (d > 1)
        for (let i = 0; i < 6; i++)
          B(o, 'stone', s * (8 + i * 0.85), 8.5, 0.65, 0.16, 0.48, 0.09, shadow);
    }
    // Tall street gateway; actual pointed shop portal is cut through the local front overlay.
    const x = s === 1 ? 16.2 : -15.45,
      front = 18.09,
      w = s === 1 ? 12.35 : 11.9,
      op = [
        [-1.65, 0.4],
        [1.65, 0.4],
        [1.65, 4.7],
        [1.05, 5.8],
        [0, 6.5],
        [-1.05, 5.8],
        [-1.65, 4.7],
      ],
      outline = [
        [-w / 2, -3],
        [w / 2, -3],
        [w / 2, 13.1],
        [-w / 2, 13.1],
      ],
      q = transform(o, 0, x, front);
    face(
      q,
      'wall',
      outline.map((p) => [...p, 0.1]),
      pale,
      [0, 0, 1],
    );
    // A recessed dark arch face remains in front of the native solid wall, with real reveal depth.
    const zface = 0.31;
    flat(
      q,
      'stone',
      outline.map((p) => [...p, zface]),
      pale,
      [0, 0, 1],
      [op.map((p) => [...p, zface])],
    );
    face(
      q,
      'glass',
      op.map((p) => [...p, 0.125]),
      dark,
    );
    for (let i = 0; i < op.length; i++) {
      const a = op[i],
        b = op[(i + 1) % op.length];
      const vv = [
        [...a, 0.125],
        [...b, 0.125],
        [...b, zface],
        [...a, zface],
      ];
      quad(q, 'stone', vv, normalFor(...vv), shadow);
    }
    if (d > 0) line(q, 0, op, zface + 0.06, pale, 0.25, 'stone', true);
    const inner = x - s * w * 0.36,
      outer = x + s * w * 0.39;
    B(o, 'stone', inner, -3, front - 0.65, 1.6, 16.6, 2, pale);
    spire(o, d, inner, front - 0.65, 23.4, 13.6);
    spire(o, d, outer, front - 0.65, 17.4, 13.1, true);
    if (d > 0) {
      for (const yy of [2.3, 7.65, 12.3]) {
        B(o, 'stone', inner, yy, front + 0.02, 1.82, 0.65, 0.35, shadow);
        if (d > 1)
          for (let j = 0; j < 5; j++)
            line(
              o,
              0,
              [
                [inner - 0.75 + j * 0.34, yy + 0.08],
                [inner - 0.62 + j * 0.34, yy + 0.3],
                [inner - 0.7 + j * 0.34, yy + 0.52],
              ],
              front + 0.22,
              pale,
              0.075,
            );
      }
      B(q, 'metal', 0, 6.85, 0.55, w * 0.56, 1.15, 0.26, dark);
      B(q, 'glass', 0, 6.94, 0.7, w * 0.53, 0.96, 0.025, shadow);
      ornament(q, d, 0, 9, 0.42);
      const bx = s * (w / 2 - 0.55);
      B(q, 'metal', bx, 3.1, 0.59, 0.85, 8.9, 0.35, dark);
      for (let i = 0; i < 7; i++)
        glyph(q, 'CHINESE'[i], bx - 0.27, 10.75 - i * 1.15, 0.79, 0.52, 0.91);
      for (const v of [-1, 1]) B(q, 'metal', bx + v * 0.47, 3, 0.82, 0.05, 9.1, 0.05, gold);
      B(q, 'metal', bx, 12.1, 0.61, 1.25, 0.21, 0.75, gold);
      flame(q, 1, bx, 12.3, 0.65, 0.65, bronze);
    }
    if (d > 1) for (const v of [-1, 1]) dragonRelief(q, d, v * 2.65, 3.7, 0.43, 1.2, 2.3, pale);
  }
}
function build(o, d) {
  shell(o, d);
  pagoda(o, d);
  doors(o, d);
  court(o, d);
}
export const graumansChineseTheatre = (o) => build(o, 3),
  graumansChineseTheatreStreet = (o) => build(o, 2),
  graumansChineseTheatreDistrict = (o) => build(o, 1),
  graumansChineseTheatreSkyline = (o) => build(o, 0);
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'concrete_plain', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.78, metallic: 0.2 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.68,
    metallic: 0.25,
    doubleSided: true,
  },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0.1 },
  accent: { slot: 'trim', localRef: ref, roughness: 0.8, metallic: 0 },
  paving: { slot: 'foundation', localRef: ref, roughness: 0.94, metallic: 0 },
};
export const graumansChineseTheatreModel = {
  id: 'graumans_chinese_theatre',
  key: 'graumans_chinese_theatre',
  recipe: 'structure-graumans-chinese-theatre.mjs',
  cell: '9q/9q5',
  title: 'Grauman’s Chinese Theatre',
  brief:
    'Dated2012–2014Chinese Theatre: retained native rear auditorium/curved open forecourt with paired south street gateway blocks/faceted bronze spires and CHINESEblades. One swept hipped green-bronze pagoda roof/short ridge/trident finials/upturned bladed corners; tall coral square posts with original geometric open-mouth wrought masks/tusks/looped whiskers. Stepped pale corbels/coral gold panels, deep grid-ceiling portico/round gong/stone dragon panel/separate small canopy/sun disk, golden paired doors with tiny pagoda slot frames and pale seated guardian lions. Lower grid-window wings/curved red band, court piers/niches/abstract flame+bell plaques; neutral blank marquees. Native ground unchanged/graded paving, no handprint microdetail/ad artwork/photo pixels/modern neighbors/interior.',
  camera: [62, 46, 86],
  lookAt: [1, 10, -12],
  qaCameras: [
    { name: 'front', position: [0, 16, 57], lookAt: [0, 13, 0] },
    { name: 'pagoda-detail', position: [16, 27, 31], lookAt: [0, 22, 0] },
    { name: 'mask-detail', position: [11, 16, 12], lookAt: [6.6, 15.2, 4.8] },
    { name: 'entrance-detail', position: [0, 7.8, 14], lookAt: [0, 6.9, 0] },
    { name: 'gateway-detail', position: [30, 13, 38], lookAt: [16, 11, 18] },
    { name: 'court-detail', position: [-4, 8, 12], lookAt: [-19, 7, 6] },
    { name: 'roof-detail', position: [-40, 39, -17], lookAt: [0, 19, -26] },
    { name: 'back', position: [-43, 32, -84], lookAt: [0, 11, -42] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -3 },
  build: graumansChineseTheatre,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'One unmodified original Terrariumtile/2mgrid. Dry south sidewalk[0,19.5] datum118.5639m; buried foundation-3m, court paving follows independently sampled broad grade+.08m. Exact threshold/floor engineering not surveyed; no terrain flattening/model-fitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-graumans-chinese-theatre.mjs',
    level: 'skyline',
    export: 'graumansChineseTheatreSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'graumansChineseTheatreDistrict', errorMeters: 1, surfaces },
      street: { export: 'graumansChineseTheatreStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    'Native auditorium18.1m and nominal27.432mpagoda top; roof curvature/court wall11.15m/gateway and spire heights/fine relief are unmeasured proportional estimates. Roof services generalized from aerial, not architectural survey.',
    'Court paving follows broad independent urban elevation; actual handprint panels and door threshold/interior floor relationships omitted or estimated. Guardian/mask/dragon/niche relief is original simplified geometric interpretation, not a replica of every sculptural detail. Opaque glazing and neutral display panels; no temporary ad content.',
  ],
};

export { court, doors, lion, mask, ornament, pagoda, shell, spire, wingWindow };
