/** Current Bernabéu exterior, researched against architect plans/sections and engineer photographs. */

import { beam } from './authored-structure-mesh.mjs';

import { lathe, transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  silver = [0.78, 0.8, 0.8],
  white = [0.84, 0.86, 0.84],
  concrete = [0.6, 0.62, 0.61],
  dark = [0.04, 0.05, 0.055],
  blue = [0.055, 0.22, 0.46];

export const bernabeuGroundOutline = [
  [-106.7406, -67.861],
  [-107.3485, -60.8736],
  [-108.0483, -43.3426],
  [-108.074, -35.4827],
  [-107.9474, -29.0181],
  [-107.8428, -19.9623],
  [-107.2979, 11.1618],
  [-107.2862, 11.5516],
  [-106.6448, 42.6017],
  [-106.0858, 65.4761],
  [-105.6393, 72.3637],
  [-105.1788, 76.7835],
  [-104.0028, 80.8828],
  [-102.4351, 85.3441],
  [-100.4076, 88.4321],
  [-97.5492, 92.5418],
  [-95.6028, 94.9884],
  [-91.3248, 98.5362],
  [-88.7044, 100.3306],
  [-84.4057, 102.7718],
  [-77.3035, 105.4536],
  [-70.8136, 106.5061],
  [-63.9342, 107.5412],
  [-57.6943, 107.9646],
  [-49.3468, 108.2891],
  [-41.843, 108.5751],
  [-19.3094, 109.0407],
  [17.3007, 109.5439],
  [73.4416, 109.2934],
  [79.3299, 108.8609],
  [83.4166, 108.0696],
  [87.2159, 106.719],
  [90.8475, 104.9343],
  [94.1829, 102.7024],
  [96.9033, 100.1921],
  [99.5486, 97.0064],
  [101.8034, 93.5926],
  [103.4596, 89.7764],
  [104.407, 86.3694],
  [105.1888, 82.3272],
  [106.0428, 78.1122],
  [106.9163, 72.8912],
  [107.8133, 66.4853],
  [108.8093, 57.7282],
  [112.2971, 43.1178],
  [115.4854, 32.2909],
  [118.6001, 26.5928],
  [124.3318, 22.4102],
  [127.2168, 18.3251],
  [128.6495, 15.0499],
  [130.0456, 11.8554],
  [132.0134, 4.5338],
  [133.5683, -3.7844],
  [134.3959, -11.134],
  [131.8742, -22.2223],
  [130.1344, -26.1352],
  [124.3441, -39.1711],
  [115.7467, -56.8899],
  [107.4242, -74.4502],
  [99.2432, -91.2396],
  [95.5415, -98.7364],
  [94.1677, -101.4818],
  [91.9581, -104.043],
  [89.319, -106.4387],
  [87.9501, -107.499],
  [85.5544, -108.3165],
  [80.0733, -109.51],
  [66.347, -110.0979],
  [45.0299, -110.6529],
  [18.9308, -110.9794],
  [-4.337, -111.034],
  [-31.2534, -110.2289],
  [-52.1841, -108.9929],
  [-69.3115, -107.0874],
  [-72.7486, -106.355],
  [-76.5094, -105.1746],
  [-81.019, -103.2026],
  [-86.5797, -100.1599],
  [-91.8728, -96.3668],
  [-95.3216, -92.7872],
  [-98.6248, -88.9616],
  [-101.6302, -84.0863],
  [-104.8204, -76.9874],
  [-106.2773, -70.9199],
  [-106.7406, -67.861],
];

// Smooth rounded rectangles maintain the long straight grandstands and rounded corner blocks.
function rounded(a, hx, hz, r) {
  const x = Math.sin(a),
    z = Math.cos(a),
    ax = Math.abs(x),
    az = Math.abs(z);
  const tx = hx / (ax || 1e-12),
    tz = hz / (az || 1e-12);
  let t = Math.min(tx, tz);
  if (t * ax > hx - r && t * az > hz - r) {
    const cx = hx - r,
      cz = hz - r,
      d = ax * cx + az * cz;
    t = d + Math.sqrt(Math.max(0, d * d - cx * cx - cz * cz + r * r));
  }
  return [x * t, z * t];
}
function boundary(a) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let closest = 1e9;
  for (let i = 1; i < bernabeuGroundOutline.length; i++) {
    const p = bernabeuGroundOutline[i - 1],
      q = bernabeuGroundOutline[i],
      ex = q[0] - p[0],
      ez = q[1] - p[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * ez - p[1] * ex) / den,
      u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) closest = Math.min(closest, t);
  }
  if (closest === 1e9) throw Error('Bernabeu footprint ray missed');
  return [closest * dx, closest * dz];
}
function native(p, y) {
  return [p[0], y, p[1]];
}
function outward(a) {
  return [Math.sin(a), 0, Math.cos(a)];
}
function bandHeight(a, t) {
  return (
    7.0 +
    t * 38.5 +
    Math.sin(a * 2 + 0.55) * 3.7 * Math.sin(Math.PI * t) +
    Math.sin(a - 0.3) * 1.65 * t
  );
}
function facadePoint(a, t, offset = 0) {
  const p = boundary(a),
    s = 0.936 + 0.061 * Math.sin(Math.PI * t * 0.85),
    L = Math.hypot(...p),
    d = offset / L;
  return [p[0] * (s + d), bandHeight(a, t), p[1] * (s + d)];
}
function facade(out) {
  // Individual bowed louvres, each with front, lower return and upper return. Gaps remain real openings.
  const rows = 60,
    n = 520;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        b = ((i + 0.987) * TAU) / n,
        t = (j + 0.07) / rows,
        u = (j + 0.83) / rows;
      const p = facadePoint(a, t, 0.09),
        q = facadePoint(b, t, 0.09),
        r = facadePoint(b, u, 0.32),
        s = facadePoint(a, u, 0.32),
        e = outward((a + b) / 2);
      face(out, 'stainless', [p, q, r, s], silver, e);
      face(
        out,
        'stainless',
        [
          p.map((v, k) => (k === 1 ? v + 0.13 : v * 0.996)),
          q.map((v, k) => (k === 1 ? v + 0.13 : v * 0.996)),
          q,
          p,
        ],
        silver,
        [0, -1, 0],
      );
      face(
        out,
        'stainless',
        [
          s,
          r,
          r.map((v, k) => (k === 1 ? v - 0.12 : v * 0.996)),
          s.map((v, k) => (k === 1 ? v - 0.12 : v * 0.996)),
        ],
        silver,
        [0, 1, 0],
      );
    }
  // Recessed dark museum/concourse enclosure behind the ventilated skin, with concrete floors and supports.
  for (let i = 0; i < 260; i++) {
    const a = (i * TAU) / 260,
      b = ((i + 1) * TAU) / 260,
      p = boundary(a),
      q = boundary(b),
      pa = p.map((x) => x * 0.902),
      pb = q.map((x) => x * 0.902);
    face(
      out,
      'glass',
      [native(pa, 0.05), native(pb, 0.05), native(pb, 43.4), native(pa, 43.4)],
      [0.09, 0.13, 0.15],
      outward((a + b) / 2),
    );
    if (i % 2 === 0) beam(out, 'metal', native(pa, 0.03), native(pa, 45.5), 0.18, 0.23, white);
    for (const y of [0.02, 6.5, 12.7, 19.2, 26, 32.4, 39.1]) {
      const pi = p.map((x) => x * 0.84),
        qi = q.map((x) => x * 0.84);
      face(
        out,
        'concrete',
        [native(pi, y), native(qi, y), native(pb, y), native(pa, y)],
        concrete,
        [0, 1, 0],
      );
      face(
        out,
        'concrete',
        [native(pa, y), native(pb, y), native(pb, y + 0.24), native(pa, y + 0.24)],
        white,
        outward((a + b) / 2),
      );
    }
  }
  // Exposed lower entry level: actual door bays and vertical mullions between solid piers.
  for (let i = 0; i < 116; i++) {
    const a = ((i + 0.5) * TAU) / 116,
      p = boundary(a),
      o = transformed(out, a, [p[0] * 0.938, 0, p[1] * 0.938]);
    box(o, 'concrete', [-2.5, 0.01, -1], [2.5, 0.45, 0.4], concrete);
    for (const x of [-2.43, 2.43])
      box(o, 'concrete', [x - 0.16, 0.4, -0.75], [x + 0.16, 6.45, 0.25], white);
    face(
      o,
      'glass',
      [
        [-2.27, 0.45, -0.2],
        [2.27, 0.45, -0.2],
        [2.27, 6.3, -0.2],
        [-2.27, 6.3, -0.2],
      ],
      dark,
      [0, 0, 1],
    );
    for (const x of [-1.13, 0, 1.13])
      box(o, 'metal', [x - 0.038, 0.45, -0.14], [x + 0.038, 6.3, -0.07], silver);
    box(o, 'metal', [-2.28, 3.65, -0.12], [2.28, 3.74, -0.04], silver);
  }
  // Two relocated circulation towers on Castellana side; nested into the western skin, not detached silos.
  for (const z of [-71, 71]) {
    const o = transformed(out, 0, [-91, 0, z]);
    lathe(
      o,
      'concrete',
      [
        [0, 10.3],
        [42.4, 10.3],
      ],
      concrete,
      96,
    );
    for (let k = 0; k < 12; k++) {
      const y = k * 3.52;
      lathe(
        o,
        'metal',
        [
          [y + 2.85, 10.4],
          [y + 3.13, 10.4],
        ],
        white,
        96,
      );
    }
  }
}
function loopPoints(hx, hz, r, n = 600) {
  const pts = Array.from({ length: n + 1 }, (_, i) => rounded((i * TAU) / n, hx, hz, r));
  const lengths = [0];
  for (let i = 1; i < pts.length; i++)
    lengths.push(lengths.at(-1) + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, lengths, total: lengths.at(-1) };
}
function sampleLoop(l, t) {
  const d = (((t % 1) + 1) % 1) * l.total;
  let i = 1;
  while (l.lengths[i] < d) i++;
  const f = (d - l.lengths[i - 1]) / (l.lengths[i] - l.lengths[i - 1]),
    a = l.pts[i - 1],
    b = l.pts[i];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
function stadiumBowl(out) {
  const tiers = [
    { rows: 28, hx: 41.5, hz: 59.6, r: 9.3, y: -8.6, step: 0.38, run: 0.82 },
    { rows: 13, hx: 63.0, hz: 77.6, r: 24, y: 5.3, step: 0.44, run: 0.72 },
    { rows: 18, hx: 72.1, hz: 84.9, r: 31, y: 15.1, step: 0.49, run: 0.71 },
    { rows: 23, hx: 86.2, hz: 96.0, r: 39, y: 29.0, step: 0.55, run: 0.7 },
  ];
  for (let k = 0; k < tiers.length; k++) {
    const t = tiers[k];
    for (let row = 0; row < t.rows; row++) {
      const hx = t.hx + row * t.run,
        hz = t.hz + row * t.run * 0.72,
        r = t.r + row * t.run * 0.5,
        y = t.y + row * t.step;
      for (let i = 0; i < 400; i++) {
        const a = (i * TAU) / 400,
          b = ((i + 1) * TAU) / 400,
          p = rounded(a, hx, hz, r),
          q = rounded(b, hx, hz, r),
          s = rounded(a, hx + t.run, hz + t.run * 0.72, r + t.run * 0.5),
          v = rounded(b, hx + t.run, hz + t.run * 0.72, r + t.run * 0.5);
        face(
          out,
          'concrete',
          [native(p, y), native(q, y), native(v, y), native(s, y)],
          concrete,
          [0, 1, 0],
        );
        face(
          out,
          'concrete',
          [native(p, y - t.step), native(q, y - t.step), native(q, y), native(p, y)],
          concrete,
          outward(a).map((x) => -x),
        );
      }
      const loop = loopPoints(hx + 0.33, hz + 0.25, r + 0.2),
        count = Math.floor(loop.total / 0.56),
        aisles = k < 2 ? 36 : 44;
      for (let i = 0; i < count; i++) {
        const t1 = i / count,
          p = sampleLoop(loop, t1),
          near = (Math.abs(t1 * aisles - Math.round(t1 * aisles)) * loop.total) / aisles;
        if (near < 0.98) continue;
        // Western lower-tier VIP grouping interrupts the ordinary blue seats.
        if (k === 1 && p[0] < -61 && Math.abs(p[1]) < 35) continue;
        const p1 = sampleLoop(loop, t1 + 0.0001),
          dx = p1[0] - p[0],
          dz = p1[1] - p[1],
          angle = Math.atan2(-dz, dx);
        const c = row % 7 === 0 && i % 11 === 0 ? [0.14, 0.29, 0.53] : blue;
        chair(out, angle, [p[0], y, p[1]], c);
      }
      for (let i = 0; i < aisles; i++) {
        const p = sampleLoop(loop, i / aisles),
          q = sampleLoop(loop, i / aisles + 0.0001),
          o = transformed(out, Math.atan2(-(q[1] - p[1]), q[0] - p[0]), [
            p[0],
            y - t.step / 2,
            p[1],
          ]);
        box(o, 'concrete', [-0.92, 0, -0.19], [0.92, t.step / 2, 0.18], [0.67, 0.6, 0.43]);
      }
    }
    const hx = t.hx + t.rows * t.run,
      hz = t.hz + t.rows * t.run * 0.72,
      r = t.r + t.rows * t.run * 0.5,
      y = t.y + (t.rows - 1) * t.step;
    for (let i = 0; i < 360; i++) {
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360,
        p = rounded(a, t.hx, t.hz, t.r),
        q = rounded(b, t.hx, t.hz, t.r),
        u = rounded(a, hx, hz, r),
        v = rounded(b, hx, hz, r);
      face(
        out,
        'concrete',
        [native(p, t.y - 0.5), native(q, t.y - 0.5), native(v, y - 0.38), native(u, y - 0.38)],
        concrete,
        [Math.sin(a), -1, Math.cos(a)],
      );
      // Tier ribbon boards and balcony fascia, each remains separate from the seating rows.
      face(
        out,
        'metal',
        [
          native(p, t.y - 0.48),
          native(q, t.y - 0.48),
          native(q, t.y + 0.18),
          native(p, t.y + 0.18),
        ],
        [0.09, 0.2, 0.36],
        outward(a).map((x) => -x),
      );
    }
    for (let i = 0; i < (k < 2 ? 18 : 22); i++) {
      const a = ((i + 0.5) * TAU) / (k < 2 ? 18 : 22),
        p = rounded(a, t.hx + 5.4, t.hz + 4, t.r + 3),
        o = transformed(out, a, [p[0], t.y + 2.1, p[1]]);
      box(o, 'concrete', [-1.75, 0, -0.5], [1.75, 2.45, 2.2], concrete);
      face(
        o,
        'glass',
        [
          [-1.47, 0.1, -0.52],
          [1.47, 0.1, -0.52],
          [1.47, 2.15, -0.52],
          [-1.47, 2.15, -0.52],
        ],
        dark,
        [0, 0, -1],
      );
    }
  }
  // Western VIP boxes, close-pitch benches and press desk line.
  for (let i = 0; i < 16; i++) {
    const z = -34 + i * 4.5,
      o = transformed(out, -Math.PI / 2, [-65.1, 5.7, z]);
    box(o, 'metal', [-2.16, 0, -0.4], [2.16, 3.8, 3.2], white);
    face(
      o,
      'glass',
      [
        [-2, 0.16, -0.43],
        [2, 0.16, -0.43],
        [2, 3.57, -0.43],
        [-2, 3.57, -0.43],
      ],
      [0.105, 0.18, 0.22],
      [0, 0, -1],
    );
  }
  for (const z of [-13.3, 13.3]) {
    const o = transformed(out, -Math.PI / 2, [-39.0, -8.8, z]);
    box(o, 'metal', [-5.5, 0, -0.55], [5.5, 2.05, 1.05], dark);
    for (let i = 0; i < 16; i++) chair(o, Math.PI, [i * 0.64 - 4.8, 0.08, 0.05], blue);
  }
}
function roofOuter(a) {
  const p = boundary(a);
  return [p[0] * 0.951, p[1] * 0.963];
}
function roofPoint(a, t) {
  const p = rounded(a, 37.5, 55, 5.8),
    q = roofOuter(a),
    rise = 1 - t ** 4,
    y = 48.1 + 7.3 * rise + 1.25 * Math.sin(a - 0.3) * t;
  return [p[0] + (q[0] - p[0]) * t, y, p[1] + (q[1] - p[1]) * t];
}
function bernabeuRoof(out) {
  // Static open-roof match-day state: continuous fixed canopy, actual open75×110m center.
  for (let i = 0; i < 440; i++)
    for (let j = 0; j < 24; j++) {
      const a = (i * TAU) / 440,
        b = ((i + 1) * TAU) / 440,
        t = j / 24,
        u = (j + 1) / 24,
        ps = [roofPoint(a, t), roofPoint(b, t), roofPoint(b, u), roofPoint(a, u)];
      face(out, 'stainless', ps, silver, [0, 1, 0]);
      face(
        out,
        'metal',
        ps.map((p) => [p[0], p[1] - 0.28, p[2]]),
        white,
        [0, -1, 0],
      );
    }
  // Thin metal standing joints following the outer shell and radial roof panels.
  for (let j = 1; j <= 42; j++)
    curve(
      out,
      Array.from({ length: 361 }, (_, i) => {
        const p = roofPoint((i * TAU) / 360, j / 43);
        p[1] += 0.065;
        return p;
      }),
      0.032,
      silver,
      'stainless',
      6,
    );
  for (let i = 0; i < 88; i++)
    curve(
      out,
      Array.from({ length: 25 }, (_, j) => {
        const p = roofPoint((i * TAU) / 88, j / 24);
        p[1] += 0.06;
        return p;
      }),
      0.025,
      [0.62, 0.64, 0.64],
      'stainless',
      6,
    );
  // Engineer's44 radial cable/steel support units, including V columns below the fixed roof.
  for (let i = 0; i < 44; i++) {
    const a = (i * TAU) / 44,
      p = roofPoint(a, 0),
      q = roofPoint(a, 1),
      m = roofPoint(a, 0.48),
      foot = rounded(a, 86, 99, 34),
      f = native(foot, 40.9);
    beam(out, 'metal', [p[0], p[1] - 0.8, p[2]], [q[0], q[1] - 0.8, q[2]], 0.43, 0.64, white);
    const b = a + 0.018,
      c = a - 0.018,
      v = roofPoint(b, 0.43),
      w = roofPoint(c, 0.73);
    beam(out, 'metal', f, [v[0], v[1] - 0.9, v[2]], 0.47, 0.47, white);
    beam(out, 'metal', f, [w[0], w[1] - 0.9, w[2]], 0.47, 0.47, white);
    curve(
      out,
      [
        [q[0], q[1] - 0.5, q[2]],
        [m[0], m[1] - 3.0, m[2]],
        [p[0], p[1] - 0.9, p[2]],
      ],
      0.09,
      [0.38, 0.4, 0.4],
    );
    for (let j = 1; j < 6; j++) {
      const u = j / 6,
        top = roofPoint(a, u),
        down = [top[0], top[1] - 2.6, top[2]];
      beam(out, 'metal', top, down, 0.16, 0.16, white);
    }
  }
  // Inner box truss and continuous360degree scoreboard, with inward-facing display glass.
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      p = rounded(a, 39.2, 56.8, 7),
      q = rounded(b, 39.2, 56.8, 7),
      pi = rounded(a, 38.5, 56.1, 6.3),
      qi = rounded(b, 38.5, 56.1, 6.3);
    face(
      out,
      'glass',
      [native(pi, 44.6), native(qi, 44.6), native(qi, 49.5), native(pi, 49.5)],
      [0.04, 0.055, 0.085],
      outward(a).map((x) => -x),
    );
    face(
      out,
      'metal',
      [native(p, 44.6), native(q, 44.6), native(q, 49.5), native(p, 49.5)],
      dark,
      outward(a),
    );
    if (i % 3 === 0) {
      beam(out, 'metal', native(p, 49.55), native(p, 55.1), 0.15, 0.15, white);
    }
  }
  for (const y of [49.8, 54.9])
    curve(
      out,
      Array.from({ length: 361 }, (_, i) => native(rounded((i * TAU) / 360, 38.8, 56.4, 6.6), y)),
      0.22,
      white,
    );
  for (let i = 0; i < 88; i++) {
    const a = (i * TAU) / 88,
      b = ((i + 1) * TAU) / 88;
    beam(
      out,
      'metal',
      native(rounded(a, 38.8, 56.4, 6.6), 49.85),
      native(rounded(b, 38.8, 56.4, 6.6), 54.85),
      0.16,
      0.16,
      white,
    );
  }
  // Folded PTFE strips stowed over the two long sides; machinery housing and visible tracks.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = side * (39.6 + i * 0.75),
        dy = i % 2 ? 0.4 : 1.12;
      face(
        out,
        'membrane',
        [
          [x, 55.7, -53.9],
          [x, 55.7, 53.9],
          [x + side * 0.72, 55.7 + dy, 53.9],
          [x + side * 0.72, 55.7 + dy, -53.9],
        ],
        white,
        [0, 1, 0],
      );
    }
    for (const z of [-55.8, 55.8])
      beam(out, 'metal', [side * 37.5, 55.55, z], [side * 50, 55.55, z], 0.22, 0.28, white);
  }
  // Open high-level circulation slit: slender supports, skywalk guard rail and accessible deck.
  for (let i = 0; i < 180; i++) {
    const a = (i * TAU) / 180,
      p = roofOuter(a),
      o = transformed(out, a, [p[0], 0, p[1]]);
    beam(
      out,
      'metal',
      [p[0] * 0.965, 44.8, p[1] * 0.965],
      [p[0], 48.1 + 1.25 * Math.sin(a - 0.3), p[1]],
      0.19,
      0.19,
      white,
    );
    box(o, 'metal', [-0.05, 45.65, -3.0], [0.05, 46.8, -2.9], white);
  }
  curve(
    out,
    Array.from({ length: 361 }, (_, i) => {
      const p = roofOuter((i * TAU) / 360);
      return [p[0] * 0.974, 46.7, p[1] * 0.974];
    }),
    0.04,
    white,
  );
}
export function buildBernabeu(out) {
  soccerPitch(transformed(out, 0, [0, -9.2, 0]));
  stadiumBowl(out);
  facade(out);
  bernabeuRoof(out);
  // Street-level ring seals the edge of the terrain cutout, while the playing field retains its real lower datum.
  for (let i = 0; i < 420; i++) {
    const a = (i * TAU) / 420,
      b = ((i + 1) * TAU) / 420,
      p = boundary(a),
      q = boundary(b),
      u = rounded(a, 62, 75, 23),
      v = rounded(b, 62, 75, 23);
    face(
      out,
      'concrete',
      [native(u, 0.01), native(v, 0.01), native(q, 0.01), native(p, 0.01)],
      concrete,
      [0, 1, 0],
    );
  }
}
export const bernabeuStudy = {
  id: 'N0682',
  key: 'santiago_bernabeu_stadium',
  title: 'Santiago Bernabéu Stadium',
  wikidataId: 'Q164027',
  build: buildBernabeu,
  metricTriangleUv: true,
  smoothNormalSlots: ['trim', 'foundation', 'wall', 'roof'],
  size: [243, 66, 222],
  previewGroundless: true,
  portableReviewBasis:
    'Portable preview intentionally has no ground primitive: asset-only geometry review exposes the complete depressed bowl. Shared world-viewer geographic review must render the actual terrain cutout, not a raised or low flat substitute.',
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch center projected to street gradeY=0. Native+Z south-slightlywest, +X east-slightlysouth; playing surface isY=-9.2m, reconstructed from the architect section scale.',
  },
  visualBrief:
    'Current rebuilt Bernabéu: asymmetrical stainless-steel horizontal louvres wrapped around the old bowl, east-side bulge, recessed museum/entry level, relocated western circulation towers, elevated open skywalk slit, sculpted fixed metal roof with open75×110m center, folded textile roof stacks,44radial roof units, V supports and box-truss ring, suspended360degree monitor, four blue seating tiers, west VIP enclosure and marked lower-level football field.',
  sourceFacts: {
    envelopeMeters: [220, 240],
    roofOpeningMeters: [75, 110],
    fixedRoofAreaSquareMeters: 29000,
    facadeAreaSquareMeters: 35000,
    radialRoofUnits: 44,
    pitchBelowStreetReconstructedMeters: 9.2,
    roofAboveStreetReconstructedMeters: 56.8,
    basis:
      'sbp publishes overall220×240m dimensions,75×110m opening,44radial roof units and roof construction. gmp publishes current exterior photographs, ground/terrace plans and a scaled cross section; the latter gives the approximate9.2m pitch depression and57m roof elevation relative to the street. Exact OSM pitch and current facade outline resolve the asymmetric plan and map axis. Louvre section, bowing, opening variations, seat distribution and small members are photograph-based reconstruction, not shop drawings.',
  },
  referencePages: [
    'https://www.sbp.de/en/project/santiago-bernabeu-stadium/',
    'https://www.gmp.de/en/16240/a-legend-santiago-bernabeu-stadium',
    'https://www.gmp.de/images/2795_Bernabeu_Schnitt_3000x2000.jpg?w=1600',
    'https://www.gmp.de/images/2795_Estadio_Bernabeu_EG_mit_Umgebung_schwarzrot_3000x2000.jpg?w=1600',
    'https://www.gmp.de/images/2795_Estadio_Bernabeu_Terassenebene_schwarzrot_3000x2000.jpg?w=1600',
    'https://www.gmp.de/images/gmp_2795_2795_240623_MB_9262.jpg?w=1600',
    'https://www.gmp.de/images/gmp_2795_2795_240622_MB_8164.jpg?w=1600',
    'https://www.sbp.de/app/uploads/2025/07/Miguel-de-Guzman_MAX.jpg',
    'https://bernabeu.realmadrid.com/en-US/news/bernabeu-documentary',
    'https://www.openstreetmap.org/way/1507411898',
    'https://www.openstreetmap.org/way/1446479375',
  ],
  referenceRights:
    'Primary published photos and drawings are used only for dimensional and visual analysis; no reference image, drawing, texture or third-party mesh is embedded. Original authored geometry uses shared procedural materials. OpenStreetMap-derived outline and alignment retain contributor attribution under ODbL1.0.',
  geographicProposal: {
    anchor: [-3.688354759398062, 40.45305269079727],
    heading: -0.07332041354862007,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Architect scaled section shows street-grade contact atY0 with playing surface about9.2m below; native negative bowl is intentional and requires terrain cutout. Roof/street contact is not shifted to pitch datum.',
    groundCutout: {
      outline: bernabeuGroundOutline,
      basis:
        'Exact current outer facade way1507411898 in local nativeXZ, transformed about the pitch-derived center/axis. Remove terrain inside the envelope so the lower bowl remains visible; authored concourse ring closes the boundary at street grade.',
    },
    status: 'preview-proposal',
    source: 'https://www.openstreetmap.org/way/1446479375',
    notes:
      'Pitch-derived heading fixes +Zsouth-slightlywest and +Xeast-slightlysouth. Current facade polygon rather than an old symmetric bowl controls the eastern bulge. Western museum/relocated circulation towers face Castellana. NativeY0street, lower pitchY-9.2 require the supplied full-envelope terrain cutout; geography must not be approved against filled flat terrain.',
  },
  limitations: [
    'Static match-day open-roof exterior; underground grass-storage mechanics and private rooms are not visible architecture. Folded roof membrane sections and small louvre support members are reconstructed from public roof photos. Individual ticket-seat counts and advertising/video content are not reproduced. Primary scaled section sets approximate grade relationships; no geodetic survey is claimed. Exterior wall height/bowing and facade section are photo reconstructions constrained by the mapped footprint and published overall dimensions.',
  ],
  previewCamera: { position: [240, 150, 270], lookAt: [6, 22, 0], fov: 44 },
  qaCameras: [
    { name: 'near-steel-louvres', position: [166, 25, 71], lookAt: [110, 27, 30] },
    { name: 'near-west-entrance', position: [-138, 7, 48], lookAt: [-99, 10, 33] },
    { name: 'near-roof-skywalk', position: [139, 70, 120], lookAt: [75, 48, 69] },
    { name: 'near-four-tiers', position: [0, 0, 6], lookAt: [-90, 23, -5] },
    { name: 'near-roof-truss', position: [0, 32, 0], lookAt: [39, 51, 18] },
    { name: 'far-open-roof', position: [180, 285, 245], lookAt: [3, 20, 0] },
  ],
};
