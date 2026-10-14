/** Budgeted Lusail vessel and roof tiers; detailed source master stays separate. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, loft, normalFor, normalize, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const TAU = 2 * Math.PI,
  gold = [1, 0.69, 0.26],
  pale = [0.79, 0.78, 0.71],
  white = [0.94, 0.93, 0.86],
  steel = [0.61, 0.64, 0.62],
  dark = [0.025, 0.03, 0.035],
  MEANS = {
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    membrane: [0.7380356292847077, 0.7380356292847077, 0.7194874484523931],
  };
const point = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)],
  rim = (a) => 66 - 8 * Math.cos(2 * a),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const fit = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/th/ths/n0691_lusail_stadium/pmtiles-fit.json',
      import.meta.url,
    ),
  ),
);
function ground(x, z) {
  const g = fit.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - fit.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function shell(a, t) {
  return point(
    a,
    137.5 + 18.5 * Math.pow(Math.sin((t * Math.PI) / 2), 0.58),
    7.2 + (rim(a) - 7.2) * t,
  );
}
function roof(a, t) {
  const r0 = 1 / Math.hypot(Math.sin(a) / 54, Math.cos(a) / 68),
    r = r0 + (153.5 - r0) * t;
  return point(a, r, 66 - 8 * (r / 153.5) ** 2 * Math.cos(2 * a) - 1.5 * Math.sin(Math.PI * t));
}
function rounded(a, hx, hz, r, y) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const x = hx - r,
      z = hz - r,
      d = x * dx + z * dz;
    t = d + Math.sqrt(Math.max(0, d * d - x * x - z * z + r * r));
  }
  return point(a, t, y);
}
function build(destination, d) {
  const far = d === 0;
  function emit(s, r, p, hint, uv, c) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (hint && n.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      destination.addTriangle(
        s,
        r,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        far ? c.map((v, j) => v * (MEANS[s]?.[j] ?? 1)) : c,
      );
    }
  }
  const o = Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]),
    ),
    face = (s, p, c, h) => emit(s, 'palette:#ffffff', p, h, null, c);
  const cols = [24, 32, 64, 128][d],
    rows = [3, 4, 8, 12][d];
  function panel(p, j) {
    const n = normalFor(...p),
      center = p[0].map((v, k) => (v + p[1][k] + p[2][k]) / 3),
      fold = p.map((q) => mix(center, q, 0.985)),
      hole = p.map((q) =>
        mix(center, q, j / rows > 0.83 ? 0.055 : 0.32).map((v, k) => v - n[k] * 0.22),
      );
    if (far) {
      face('metal', p, gold, n);
      return;
    }
    for (let i = 0; i < 3; i++) {
      const k = (i + 1) % 3;
      face('metal', [fold[i], fold[k], hole[k], hole[i]], gold, n);
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = ((i + (j % 2) * 0.5) * TAU) / cols,
        b = a + TAU / cols,
        m = (a + b) / 2,
        p = shell(a, j / rows),
        q = shell(b, j / rows),
        r = shell(m, (j + 1) / rows),
        s = shell(m - TAU / cols, (j + 1) / rows);
      panel([p, q, r], j);
      panel([p, r, s], j);
    }
  const roofCols = [24, 32, 48, 120][d],
    roofRows = [2, 4, 3, 8][d];
  for (let i = 0; i < roofCols; i++)
    for (let j = 0; j < roofRows; j++) {
      const a = (i * TAU) / roofCols,
        b = ((i + 1) * TAU) / roofCols,
        t = j / roofRows,
        u = (j + 1) / roofRows,
        c = roof((a + b) / 2, (t + u) / 2);
      c[1] += (d >= 2 ? 1.5 : 0) * Math.sin((Math.PI * (t + u)) / 2);
      const p = [roof(a, t), roof(b, t), roof(b, u), roof(a, u)];
      const underside = (ps) => ps.map((v) => [v[0], v[1] - 0.04, v[2]]);
      if (d === 3) {
        for (let k = 0; k < 4; k++) {
          const tri = [p[k], p[(k + 1) % 4], c];
          face('membrane', tri, white, [0, 1, 0]);
          face('membrane', underside(tri), white, [0, -1, 0]);
        }
      } else {
        face('membrane', p, white, [0, 1, 0]);
        face('membrane', underside(p), white, [0, -1, 0]);
      }
    }
  const supports = far ? 8 : 24;
  for (let i = 0; i < supports; i++) {
    const a = (i * TAU) / supports,
      base = point(a, 136, 2.2);
    if (d === 3)
      loft(
        o,
        'concrete',
        [
          radialRing(2.2, 1.8, 2.25, 12, [base[0], base[2]]),
          radialRing(5.2, 1.5, 1.75, 12, [base[0], base[2]]),
          radialRing(10.2, 0.85, 1.1, 12, [base[0], base[2]]),
        ],
        pale,
      );
    else
      box(
        o,
        'concrete',
        [base[0] - 1.5, 2.2, base[2] - 1.5],
        [base[0] + 1.5, 10.2, base[2] + 1.5],
        pale,
      );
    for (const side of [-1, 1]) {
      const steps = [1, 1, 3, 8][d],
        ps = Array.from({ length: steps + 1 }, (_, j) => {
          const t = j / steps,
            ang = a + (side * t * TAU) / 48,
            p = shell(ang, t);
          return point(ang, Math.hypot(p[0], p[2]) - 1.9, p[1] + 2 * (1 - t));
        });
      if (d >= 2) {
        const rings = ps.map((p, j) => {
          const before = ps[Math.max(0, j - 1)],
            after = ps[Math.min(ps.length - 1, j + 1)],
            axis = normalize(after.map((v, k) => v - before[k])),
            u = normalize(cross(axis, [0, 1, 0])),
            v = cross(axis, u);
          return Array.from({ length: 8 }, (_, k) =>
            p.map(
              (n, i) =>
                n + 0.58 * (u[i] * Math.cos((k * TAU) / 8) + v[i] * Math.sin((k * TAU) / 8)),
            ),
          );
        });
        loft(o, 'metal', rings, steel);
      } else beam(o, 'metal', ps[0], ps.at(-1), 1.16, 1.16, steel);
    }
  }
  const tiers = [
      { hx: 40, hz: 62, r: 18, y: -1.4, rows: 32, run: 0.82, rise: 0.37 },
      { hx: 70, hz: 92, r: 40, y: 14.9, rows: 22, run: 0.83, rise: 0.46 },
      { hx: 92, hz: 114, r: 64, y: 30.3, rows: 36, run: 0.77, rise: 0.6 },
    ],
    bowlCols = [24, 32, 32, 48][d];
  for (const t of tiers) {
    const count = d === 3 ? t.rows : d === 2 ? 8 : 1;
    for (let row = 0; row < count; row++) {
      const q = (row * t.rows) / count,
        next = ((row + 1) * t.rows) / count,
        low = t.y + q * t.rise,
        high = t.y + next * t.rise;
      for (let i = 0; i < bowlCols; i++) {
        const a = (i * TAU) / bowlCols,
          b = ((i + 1) * TAU) / bowlCols,
          split = a + (b - a) * 0.12,
          cells =
            d >= 2 && i % 4 === 0
              ? [
                  [a, split, pale],
                  [split, b, [0.71, 0.62, 0.4]],
                ]
              : [[a, b, [0.71, 0.62, 0.4]]],
          p = (a, k, y) => rounded(a, t.hx + k * t.run, t.hz + k * t.run, t.r + k * t.run * 0.6, y);
        for (const [aa, bb, c] of cells) {
          face(
            'plastic',
            [
              p(aa, q, low),
              p(bb, q, low),
              p(bb, next, d >= 2 ? low : high),
              p(aa, next, d >= 2 ? low : high),
            ],
            c,
            [0, 1, 0],
          );
          if (d >= 2)
            face(
              'plastic',
              [p(aa, next, low), p(bb, next, low), p(bb, next, high), p(aa, next, high)],
              c,
              [-Math.sin(aa), 0, -Math.cos(aa)],
            );
        }
      }
    }
  }
  const n = [24, 32, 32, 64][d];
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    face('concrete', [[0, -1.85, 0], point(a, 132, -1.85), point(b, 132, -1.85)], pale, [0, 1, 0]);
    face(
      'concrete',
      [point(a, 132, 2.2), point(b, 132, 2.2), point(b, 161, 2.2), point(a, 161, 2.2)],
      pale,
      [0, 1, 0],
    );
    face(
      'concrete',
      [point(a, 132, -2), point(b, 132, -2), point(b, 132, 7.2), point(a, 132, 7.2)],
      pale,
      [-Math.sin(a), 0, -Math.cos(a)],
    );
    face(
      'concrete',
      [point(a, 132.02, 2.2), point(b, 132.02, 2.2), point(b, 132.02, 7.2), point(a, 132.02, 7.2)],
      pale,
      [Math.sin(a), 0, Math.cos(a)],
    );
    const p = point(a, 172, 0),
      q = point(b, 172, 0);
    p[1] = ground(p[0], p[2]) - 0.2;
    q[1] = ground(q[0], q[2]) - 0.2;
    face('concrete', [point(a, 161, 2.2), point(b, 161, 2.2), q, p], pale, [0, 1, 0]);
  }
  face(
    'turf',
    [
      [-34, -1.8, -52.5],
      [34, -1.8, -52.5],
      [34, -1.8, 52.5],
      [-34, -1.8, 52.5],
    ],
    [0.09, 0.23, 0.08],
    [0, 1, 0],
  );
  if (d >= 2) {
    for (const h of [0.28, 0.57])
      for (let i = 0; i < cols; i++) {
        const a = (i * TAU) / cols,
          b = ((i + 1) * TAU) / cols;
        beam(o, 'metal', shell(a, h), shell(b, h), 0.12, 0.12, gold);
      }
    for (const z of [-52.5, 52.5]) {
      for (const x of [-3.66, 3.66])
        beam(o, 'metal', [x, -1.8, z], [x, 0.64, z], 0.08, 0.08, white);
      beam(o, 'metal', [-3.66, 0.64, z], [3.66, 0.64, z], 0.08, 0.08, white);
    }
    for (const [x, y] of [
      [-76, 14.7],
      [-94, 30.1],
    ])
      box(o, 'glass', [x - 0.2, y, -72], [x, y + 1.8, 72], [0.15, 0.19, 0.19]);
  }
  if (d >= 2) {
    for (let i = 0; i < cols; i++) {
      const a = (i * TAU) / cols,
        b = ((i + 1) * TAU) / cols;
      face(
        'metal',
        [
          point(a, 153.5, rim(a)),
          point(b, 153.5, rim(b)),
          point(b, 156, rim(b)),
          point(a, 156, rim(a)),
        ],
        gold,
        [0, 1, 0],
      );
    }
    const line = (x0, z0, x1, z1, w = 0.12) =>
      face(
        'plastic',
        [
          [x0, -1.785, z0],
          [x1, -1.785, z1],
          [x1 + w, -1.785, z1 + w],
          [x0 + w, -1.785, z0 + w],
        ],
        white,
        [0, 1, 0],
      );
    for (const x of [-34, 34]) line(x, -52.5, x, 52.5);
    for (const z of [-52.5, 0, 52.5]) line(-34, z, 34, z);
    for (const side of [-1, 1]) {
      const z = side * 52.5,
        v = side * 36;
      line(-20.15, z, -20.15, v);
      line(20.15, z, 20.15, v);
      line(-20.15, v, 20.15, v);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i * TAU) / 24,
        b = ((i + 1) * TAU) / 24;
      face(
        'plastic',
        [
          point(a, 9.15, -1.785),
          point(b, 9.15, -1.785),
          point(b, 9.27, -1.785),
          point(a, 9.27, -1.785),
        ],
        white,
        [0, 1, 0],
      );
    }
  }
  if (d === 3) {
    for (let i = 0; i < 96; i++) {
      const a = (i * TAU) / 96,
        b = ((i + 1) * TAU) / 96;
      for (const t of [0, 1]) beam(o, 'metal', roof(a, t), roof(b, t), 0.14, 0.14, steel);
      beam(o, 'metal', roof(a, 0), roof(a, 1), 0.045, 0.045, steel);
    }
    for (const z of [-80, 80])
      box(o, 'glass', [-12, 42, z - 0.2], [12, 49, z], [0.025, 0.03, 0.035]);
    for (let i = 0; i < 24; i++) {
      const p = roof((i * TAU) / 24, 0.065);
      box(o, 'metal', [p[0] - 1, p[1] - 6, p[2] - 0.3], [p[0] + 1, p[1] - 5.5, p[2] + 0.3], dark);
    }
  }
}
export const buildLusailSkyline = (o) => build(o, 0);
export const buildLusailDistrict = (o) => build(o, 1);
export const buildLusailStreet = (o) => build(o, 2);
export const buildLusailCloseup = (o) => build(o, 3);
