/** Allianz Arena: primary operator dimensions, mapped plan, original inflated-cushion geometry. */
import { beam, cross, normalize } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box } from './structure-mesh.mjs';

const outerPlan = [
  [113.05999, -16.9979],
  [113.28923, 0.54311],
  [112.95362, 17.56117],
  [111.6896, 35.30715],
  [109.25721, 53.08119],
  [106.25392, 68.77313],
  [100.84043, 85.66644],
  [91.85173, 100.19052],
  [79.46028, 112.53078],
  [64.77477, 121.21231],
  [47.91048, 126.65876],
  [31.58802, 128.87235],
  [15.66891, 130.16895],
  [-0.43944, 130.66413],
  [-16.32343, 129.93977],
  [-32.20074, 128.76728],
  [-49.077, 126.49219],
  [-65.46861, 121.2225],
  [-79.99891, 112.30616],
  [-92.94199, 100.07236],
  [-101.17786, 85.42809],
  [-106.29857, 68.82833],
  [-109.8778, 51.30989],
  [-111.84516, 34.19562],
  [-113.06171, 16.32816],
  [-113.73572, -0.59555],
  [-113.21349, -16.85905],
  [-111.86712, -34.45571],
  [-109.51482, -51.45549],
  [-106.15197, -68.72243],
  [-101.37871, -84.90166],
  [-91.81611, -100.06558],
  [-79.43658, -112.05143],
  [-65.54515, -121.00681],
  [-49.1639, -126.45785],
  [-33.5931, -128.56456],
  [-16.09538, -129.67371],
  [0.90123, -130.35395],
  [16.4297, -129.62253],
  [32.37111, -128.37491],
  [48.05337, -125.83646],
  [64.76556, -121.01021],
  [78.40233, -113.07547],
  [92.47959, -99.02157],
  [101.6906, -84.45797],
  [106.89105, -67.75574],
  [109.65241, -50.62146],
  [111.80323, -33.5034],
  [113.05999, -16.9979],
];
const openingPlan = [
  [-5.94021, -61.11358],
  [6.00447, -61.13853],
  [11.86051, -60.70965],
  [18.06731, -59.93147],
  [22.71351, -58.95511],
  [27.02614, -57.51579],
  [31.23698, -54.99661],
  [34.96089, -51.47936],
  [37.54105, -48.25038],
  [39.96922, -42.31696],
  [40.82498, -37.46919],
  [41.33843, -31.05328],
  [42.50268, -14.94215],
  [42.85462, 0.82095],
  [42.41687, 16.83056],
  [41.47927, 31.1466],
  [40.5809, 39.16256],
  [38.89602, 45.21079],
  [37.20992, 48.52441],
  [32.01792, 54.49476],
  [27.77428, 57.06602],
  [24.14608, 58.73188],
  [16.04984, 60.15056],
  [4.76875, 61.26758],
  [-7.6138, 61.15027],
  [-18.81146, 59.78646],
  [-26.90333, 57.68754],
  [-30.16278, 56.05035],
  [-32.54706, 53.99379],
  [-35.89429, 50.53292],
  [-38.51079, 46.5903],
  [-40.0317, 42.83053],
  [-41.02573, 35.94922],
  [-42.16295, 20.95301],
  [-42.76923, 1.2673],
  [-42.36242, -17.81958],
  [-41.88585, -26.57336],
  [-41.39689, -32.26646],
  [-40.02869, -41.83893],
  [-38.46952, -46.35235],
  [-34.78685, -51.52217],
  [-31.09897, -54.70621],
  [-25.97007, -57.70563],
  [-20.82151, -59.28066],
  [-13.10026, -60.53607],
  [-5.94021, -61.11358],
];
const TAU = Math.PI * 2,
  white = [0.91, 0.93, 0.91],
  concrete = [0.66, 0.68, 0.65],
  red = [0.7, 0.035, 0.04],
  gray = [0.63, 0.65, 0.65],
  dark = [0.045, 0.065, 0.075];
const native = (p, y) => [p[0], y, p[1]];
function boundary(poly, a) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let nearest = 1e9;
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      ex = q[0] - p[0],
      ez = q[1] - p[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (p[0] * ez - p[1] * ex) / den,
      u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) nearest = Math.min(t, nearest);
  }
  if (nearest === 1e9) throw Error('Allianz plan ray missed');
  return [dx * nearest, dz * nearest];
}
const outward = (a) => [Math.sin(a), 0, Math.cos(a)];
function rounded(a, hx, hz, r) {
  const x = Math.sin(a),
    z = Math.cos(a),
    ax = Math.abs(x),
    az = Math.abs(z);
  let t = Math.min(hx / (ax || 1e-12), hz / (az || 1e-12));
  if (t * ax > hx - r && t * az > hz - r) {
    const cx = hx - r,
      cz = hz - r,
      d = ax * cx + az * cz;
    t = d + Math.sqrt(Math.max(0, d * d - cx * cx - cz * cz + r * r));
  }
  return [x * t, z * t];
}
function loop(hx, hz, r) {
  const ps = Array.from({ length: 721 }, (_, i) => rounded((i * TAU) / 720, hx, hz, r)),
    ds = [0];
  for (let i = 1; i < ps.length; i++)
    ds.push(ds.at(-1) + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][1] - ps[i - 1][1]));
  return { ps, ds, total: ds.at(-1) };
}
function at(l, t) {
  const d = (((t % 1) + 1) % 1) * l.total;
  let i = 1;
  while (l.ds[i] < d) i++;
  const f = (d - l.ds[i - 1]) / (l.ds[i] - l.ds[i - 1]);
  return l.ps[i].map((v, k) => l.ps[i - 1][k] + f * (v - l.ps[i - 1][k]));
}
function ring(out, inner, outer, y, slot = 'concrete', color = concrete, n = 360) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    face(
      out,
      slot,
      [native(inner(a), y), native(inner(b), y), native(outer(b), y), native(outer(a), y)],
      color,
      [0, 1, 0],
    );
  }
}
function bowl(out) {
  const tiers = [
    { hx: 41.5, hz: 60, r: 11, rows: 24, run: 0.81, y: 1.3, angle: 24 },
    { hx: 62, hz: 79, r: 26, rows: 19, run: 0.84, y: 12.2, angle: 30 },
    { hx: 80.2, hz: 97.2, r: 41, rows: 27, run: 0.78, y: 25.5, angle: 34 },
  ];
  for (const [k, t] of tiers.entries()) {
    const rise = t.run * Math.tan((t.angle * Math.PI) / 180);
    for (let row = 0; row < t.rows; row++) {
      const x = t.hx + row * t.run,
        z = t.hz + row * t.run,
        r = t.r + row * t.run * 0.69,
        y = t.y + row * rise,
        p = (a) => rounded(a, x, z, r),
        q = (a) => rounded(a, x + t.run, z + t.run, r + t.run * 0.69);
      ring(out, p, q, y);
      for (let i = 0; i < 360; i++) {
        const a = (i * TAU) / 360,
          b = ((i + 1) * TAU) / 360;
        face(
          out,
          'concrete',
          [native(p(a), y - rise), native(p(b), y - rise), native(p(b), y), native(p(a), y)],
          concrete,
          outward(a).map((v) => -v),
        );
      }
      const l = loop(x + 0.32, z + 0.32, r + 0.2),
        count = Math.floor(l.total / 0.55),
        aisles = k === 0 ? 32 : 40;
      for (let i = 0; i < count; i++) {
        const u = i / count,
          p = at(l, u),
          q = at(l, u + 0.0001),
          gap = (Math.abs(u * aisles - Math.round(u * aisles)) * l.total) / aisles;
        if (gap < 0.9) continue;
        const color = k === 1 ? red : gray;
        chair(out, Math.atan2(-(q[1] - p[1]), q[0] - p[0]), native(p, y), color);
      }
      for (let i = 0; i < aisles; i++) {
        const p = at(l, i / aisles),
          q = at(l, i / aisles + 0.0001),
          o = transformed(out, Math.atan2(-(q[1] - p[1]), q[0] - p[0]), native(p, y));
        box(o, 'plastic', [-0.72, 0.012, -0.27], [0.72, 0.1, -0.01], red);
      }
    }
    const y = t.y + t.rows * rise,
      outer = (a) =>
        rounded(a, t.hx + t.rows * t.run, t.hz + t.rows * t.run, t.r + t.rows * t.run * 0.69),
      inner = (a) => rounded(a, t.hx - 0.4, t.hz - 0.4, t.r);
    for (let i = 0; i < 360; i++) {
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360;
      face(
        out,
        'concrete',
        [
          native(inner(a), t.y - 0.6),
          native(inner(b), t.y - 0.6),
          native(outer(b), y - 0.5),
          native(outer(a), y - 0.5),
        ],
        concrete,
        [0, -1, 0],
      );
    }
    const front = (a) => rounded(a, t.hx, t.hz, t.r);
    for (const yy of [t.y + 0.15, t.y + 1.05])
      curve(
        out,
        Array.from({ length: 361 }, (_, i) => native(front((i * TAU) / 360), yy)),
        0.055,
        white,
      );
    for (let i = 0; i < 80; i++) {
      const a = (i * TAU) / 80,
        p = front(a);
      beam(out, 'metal', native(p, t.y), native(p, t.y + 1.12), 0.045, 0.045, white);
    }
    // Recessed access mouths with concrete sides and roof; no invented fully dark missing seats.
    for (let i = 0; i < (k ? 20 : 16); i++) {
      const a = ((i + 0.5) * TAU) / (k ? 20 : 16),
        rr = t.rows * 0.55,
        p = rounded(a, t.hx + rr * t.run, t.hz + rr * t.run, t.r + rr * t.run * 0.69),
        yy = t.y + rr * rise,
        o = transformed(out, a, native(p, yy));
      box(o, 'glass', [-1.3, 0.02, -0.55], [1.3, 1.6, 0.1], dark);
      box(o, 'concrete', [-1.45, 1.6, -1], [1.45, 1.82, 0.15], white);
    }
  }
  // Balcony/VIP fascias close the transitions between bowls. The circulation stairs stay behind this envelope.
  for (let k = 1; k < tiers.length; k++) {
    const low = tiers[k - 1],
      high = tiers[k],
      rise = low.run * Math.tan((low.angle * Math.PI) / 180);
    const y0 = low.y + low.rows * rise,
      y1 = high.y;
    const lower = (a) =>
      rounded(
        a,
        low.hx + low.rows * low.run,
        low.hz + low.rows * low.run,
        low.r + low.rows * low.run * 0.69,
      );
    const upper = (a) => rounded(a, high.hx, high.hz, high.r);
    for (let i = 0; i < 360; i++) {
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360,
        p = lower(a),
        q = lower(b),
        r = upper(b),
        v = upper(a);
      face(
        out,
        'glass',
        [native(p, y0), native(q, y0), native(r, y1), native(v, y1)],
        [0.12, 0.18, 0.21],
        outward(a).map((n) => -n),
      );
      for (const y of [y0, y1 - 0.24])
        face(
          out,
          'concrete',
          [native(v, y), native(r, y), native(r, y + 0.23), native(v, y + 0.23)],
          white,
          outward(a).map((n) => -n),
        );
      if (i % 4 === 0) beam(out, 'metal', native(p, y0), native(v, y1), 0.12, 0.12, white);
    }
  }
  // Two goal-end displays, as installed in 2017: 21.6 by 9.2 m overall.
  for (const s of [-1, 1]) {
    const o = transformed(out, s > 0 ? Math.PI : 0, [0, 0, s * 68.2]);
    box(o, 'metal', [-10.9, 32.8, -0.4], [10.9, 42.2, 0.2], gray);
    box(o, 'glass', [-10.8, 32.9, 0.205], [10.8, 42.1, 0.25], [0.035, 0.045, 0.07]);
    for (const x of [-8, 8]) beam(o, 'metal', [x, 42, 0], [x, 47, 0], 0.18, 0.18, white);
  }
  // West-side team shelters and pitch-side display boards.
  for (const z of [-12, 12]) {
    box(out, 'glass', [-40.8, 0.2, z - 5], [-39.5, 2.2, z + 5], [0.16, 0.21, 0.22]);
    for (let i = 0; i < 12; i++) chair(out, Math.PI / 2, [-39.7, 0.15, z - 4.3 + i * 0.75], red);
  }
  for (const s of [-1, 1])
    box(
      out,
      'glass',
      [s < 0 ? -40.1 : 39.8, 0.03, -50],
      [s < 0 ? -39.8 : 40.1, 0.95, 50],
      [0.1, 0.12, 0.14],
    );
}
function skinPoint(a, t) {
  const p = boundary(outerPlan, a);
  if (t <= 12) {
    const v = t / 12,
      scale = 0.835 + 0.166 * Math.sin(v * Math.PI * 0.79);
    return [p[0] * scale, 10.1 + 41.2 * v, p[1] * scale];
  }
  const v = (t - 12) / 12,
    q = boundary(openingPlan, a),
    s = 0.835 + 0.166 * Math.sin(Math.PI * 0.79);
  return [
    p[0] * s * (1 - v) + q[0] * v,
    51.3 - 8.8 * v + 1.2 * Math.sin(Math.PI * v),
    p[1] * s * (1 - v) + q[1] * v,
  ];
}
function skinNormal(a, t) {
  const d = 0.0001,
    p = skinPoint(a - d, t),
    q = skinPoint(a + d, t),
    r = skinPoint(a, t - d),
    s = skinPoint(a, t + d);
  return normalize(
    cross(
      q.map((v, k) => v - p[k]),
      s.map((v, k) => v - r[k]),
    ),
  );
}
function pillows(out) {
  const cols = 116,
    rows = 24,
    nx = 6,
    ny = 4;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const point = (u, v, inflate = true) => {
          const aa = ((i + u + (j + v) * 0.56) * TAU) / cols,
            tt = j + v,
            p = skinPoint(aa, tt),
            n = skinNormal(aa, tt),
            bulge = inflate ? 0.5 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) : 0;
          return p.map((x, k) => x + n[k] * bulge);
        },
        slot = j >= 17 || j < 2 ? 'etfeClear' : 'etfe';
      for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++) {
          const u0 = 0.014 + (x * 0.972) / nx,
            u1 = 0.014 + ((x + 1) * 0.972) / nx,
            v0 = 0.012 + (y * 0.976) / ny,
            v1 = 0.012 + ((y + 1) * 0.976) / ny;
          face(
            out,
            slot,
            [point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1)],
            white,
            skinNormal(((i + 0.5 + (j + 0.5) * 0.56) * TAU) / cols, j + 0.5),
          );
        }
      // Weld/clamp seams: only two edges per panel to avoid doubled tubular seams.
      for (const edge of [0, 1])
        curve(
          out,
          Array.from({ length: 5 }, (_, k) => point(edge ? k / 4 : 0, edge ? 0 : k / 4, false)),
          0.038,
          [0.58, 0.62, 0.63],
          'metal',
          6,
        );
    }
}
function concourses(out) {
  for (let floor = 0; floor < 7; floor++) {
    const y = floor * 5.8,
      scale = 0.77 + floor * 0.023,
      pa = (a) => boundary(outerPlan, a).map((v) => v * scale),
      pi = (a) => boundary(outerPlan, a).map((v) => v * (scale - 0.07));
    ring(out, pi, pa, y + 0.3);
    for (let i = 0; i < 240; i++) {
      const a = (i * TAU) / 240,
        b = ((i + 1) * TAU) / 240;
      face(
        out,
        'concrete',
        [native(pa(a), y), native(pa(b), y), native(pa(b), y + 0.3), native(pa(a), y + 0.3)],
        concrete,
        outward(a),
      );
      if (floor > 1)
        face(
          out,
          'glass',
          [
            native(pi(a), y + 0.4),
            native(pi(b), y + 0.4),
            native(pi(b), y + 5.5),
            native(pi(a), y + 5.5),
          ],
          [0.15, 0.21, 0.23],
          outward(a),
        );
    }
    for (let i = 0; i < 50; i++) {
      const a = (i * TAU) / 50,
        p = boundary(outerPlan, a),
        p0 = p.map((v) => v * (scale - 0.01)),
        p1 = p.map((v) => v * (scale + 0.015));
      beam(out, 'concrete', native(p0, y + 0.3), native(p1, y + 5.8), 0.65, 0.65, concrete);
    }
  }
  for (let i = 0; i < 240; i++) {
    const a = (i * TAU) / 240,
      b = ((i + 1) * TAU) / 240,
      p = boundary(outerPlan, a).map((v) => v * 1.024),
      q = boundary(outerPlan, b).map((v) => v * 1.024);
    face(
      out,
      'glass',
      [native(p, 0.02), native(q, 0.02), native(q, 9.7), native(p, 9.7)],
      [0.075, 0.1, 0.105],
      outward(a),
    );
    if (i % 3 === 0) beam(out, 'concrete', native(p, 0), native(p, 9.7), 0.5, 0.5, concrete);
    face(
      out,
      'concrete',
      [
        native(
          p.map((v) => v * 1.001),
          4.65,
        ),
        native(
          q.map((v) => v * 1.001),
          4.65,
        ),
        native(
          q.map((v) => v * 1.001),
          5.0,
        ),
        native(
          p.map((v) => v * 1.001),
          5.0,
        ),
      ],
      concrete,
      outward(a),
    );
  }
  // Fifteen cascades sweep around the concourse as seen in Arup construction photographs.
  for (let i = 0; i < 15; i++)
    for (let floor = 1; floor < 6; floor++) {
      const a = (i * TAU) / 15,
        delta = 0.13,
        sc = 0.79 + floor * 0.023;
      const path = [];
      for (let k = 0; k <= 24; k++) {
        const u = k / 24,
          angle = a + u * delta,
          p = boundary(outerPlan, angle).map((v) => v * sc),
          y = floor * 5.8 + u * 5.8;
        path.push(native(p, y));
        const o = transformed(out, angle, native(p, y));
        box(o, 'concrete', [-0.65, -0.2, -1.1], [0.65, 0.02, 1.1], concrete);
        if (k % 2 === 0) beam(o, 'metal', [0, 0.03, 1.14], [0, 1.06, 1.14], 0.04, 0.04, red);
      }
      curve(
        out,
        path.map((p) => [p[0] * 1.011, p[1] + 1.06, p[2] * 1.011]),
        0.045,
        red,
      );
    }
  // Immediate raised public promenade and exposed two-level podium, not the whole remote esplanade.
  const outer = (a) => boundary(outerPlan, a).map((v) => v * 1.055),
    inner = (a) => boundary(outerPlan, a).map((v) => v * 0.76);
  ring(out, inner, outer, 10.05);
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360;
    face(
      out,
      'concrete',
      [
        native(outer(a), 9.3),
        native(outer(b), 9.3),
        native(outer(b), 10.05),
        native(outer(a), 10.05),
      ],
      concrete,
      outward(a),
    );
    if (i % 5 === 0)
      beam(
        out,
        'concrete',
        native(
          outer(a).map((v) => v * 0.985),
          0.02,
        ),
        native(
          outer(a).map((v) => v * 0.985),
          9.35,
        ),
        0.7,
        0.7,
        concrete,
      );
  }
  curve(
    out,
    Array.from({ length: 361 }, (_, i) => native(outer((i * TAU) / 360), 11.12)),
    0.052,
    gray,
  );
  for (let i = 0; i < 240; i++)
    beam(
      out,
      'metal',
      native(outer((i * TAU) / 240), 10.08),
      native(outer((i * TAU) / 240), 11.15),
      0.035,
      0.035,
      gray,
    );
  // South ceremonial broad stair joins the raised promenade to the pedestrian ground level.
  for (let i = 0; i < 50; i++) {
    const z = 139 + (49 - i) * 0.3,
      y = i * 0.2;
    box(out, 'concrete', [-24, y, z], [24, y + 0.2, z + 0.31], concrete);
  }
}
function roof(out) {
  for (let i = 0; i < 48; i++) {
    const a = (i * TAU) / 48;
    for (let k = 0; k < 12; k++) {
      const t = 12 + k,
        u = t + 1,
        top = skinPoint(a, t),
        next = skinPoint(a, u),
        depth = 3.6 - (2.2 * k) / 12,
        low = [top[0], top[1] - depth, top[2]],
        lowNext = [next[0], next[1] - (3.6 - (2.2 * (k + 1)) / 12), next[2]];
      beam(out, 'metal', top, next, 0.18, 0.18, white);
      beam(out, 'metal', low, lowNext, 0.18, 0.18, white);
      beam(out, 'metal', top, low, 0.18, 0.18, white);
      beam(out, 'metal', k % 2 ? top : low, k % 2 ? lowNext : next, 0.18, 0.18, white);
    }
    const p = skinPoint(a, 12),
      base = boundary(outerPlan, a).map((v) => v * 0.9);
    beam(out, 'metal', native(base, 36), [p[0], p[1] - 3.5, p[2]], 0.32, 0.32, white);
  }
  for (let j = 12; j <= 24; j++)
    curve(
      out,
      Array.from({ length: 233 }, (_, i) => {
        const p = skinPoint((i * TAU) / 232, j);
        return [p[0], p[1] - 0.16, p[2]];
      }),
      0.095,
      white,
    );
  for (let i = 0; i < 96; i++) {
    const a = (i * TAU) / 96,
      b = ((i + 1) * TAU) / 96;
    for (let j = 13; j < 24; j += 2) {
      const p = skinPoint(a, j),
        q = skinPoint(b, j + 2);
      beam(out, 'metal', [p[0], p[1] - 0.35, p[2]], [q[0], q[1] - 0.35, q[2]], 0.08, 0.08, white);
    }
  }
  for (let i = 0; i < 96; i++) {
    const a = (i * TAU) / 96,
      p = skinPoint(a, 23.6),
      o = transformed(out, a, p);
    box(o, 'metal', [-0.85, -1.7, -0.3], [0.85, -1.0, 0.2], gray);
    box(o, 'plastic', [-0.78, -1.72, -0.26], [0.78, -1.68, 0.18], [0.97, 0.96, 0.86]);
  }
}
export function buildAllianz(out) {
  soccerPitch(out);
  bowl(out);
  concourses(out);
  roof(out);
  pillows(out);
  facadeSign(out);
}
export const allianzStudy = {
  id: 'N0683',
  key: 'allianz_arena',
  title: 'Allianz Arena',
  wikidataId: 'Q127429',
  build: buildAllianz,
  metricTriangleUv: true,
  smoothNormalSlots: ['wall', 'window', 'trim', 'roof'],
  size: [242, 53, 288],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch center at ground playing-field datum. Native +Z points south-southwest along the pitch; +X points east-southeast.',
  },
  visualBrief:
    'Munich stadium with individually inflated diagonal ETFE cushions, continuous rounded white envelope, transparent inner-roof and lower facade film, forty-eight lattice roof trusses, exposed inclined concrete columns, fifteen circumferential cascade stairs, raised ring promenade, three steepening gray/red/gray seating tiers, two goal-end screens and a marked105Ã—68m field.',
  sourceFacts: {
    publishedEnvelopeMeters: [227, 258, 52],
    pitchMeters: [68, 105],
    tierAnglesDegrees: [24, 30, 34],
    radialRoofTrusses: 48,
    nominalPublishedCushions: 2784,
    authoredCushions: 2784,
    screenMeters: [21.6, 9.2],
    basis:
      'The operator publishes envelope dimensions, pitch, three tier gradients, roof truss count, film construction and display dimensions. Arup photographs establish pillow bulging, diagonal clamp seams, transparent roof, cascaded circulation and roof lattice. Operator2018 history establishes red middle-tier seats with gray retained upper/lower tiers. Exact mapped pitch and outer/opening polygons control plan and rotation; nominal258m published length differs slightly from current mapped261m envelope. Individual cushion schedule, circulation levels and seating row distribution are reconstructions, not panel fabrication inventory.',
  },
  referencePages: [
    'https://allianz-arena.com/en/arena/facts/general-information',
    'https://allianz-arena.com/en/arena/facts/history/the-history-of-the-allianz-arena',
    'https://allianz-arena.com/en/news/2018/04/allianz-arena-facelift-this-summer',
    'https://www.herzogdemeuron.com/projects/205-allianz-arena/',
    'https://www.arup.com/projects/allianz-arena/',
    'https://www.arup.com/globalassets/images/projects/a/allianz-arena/gallery1allianz-arena-munichc-ulrich-rossmannarupv2.jpg',
    'https://www.arup.com/globalassets/images/projects/a/allianz-arena/gallery4allianz-arena-munichc-allianz-arena.jpg',
    'https://www.arup.com/globalassets/images/projects/a/allianz-arena/gallery6allianz-arena-munichc-ulrich-rossmannarup1v2.jpg',
    'https://www.openstreetmap.org/way/123121774',
    'https://www.openstreetmap.org/way/1257847557',
    'https://www.openstreetmap.org/way/605825026',
  ],
  referenceRights:
    'Public primary photographs are used for architectural analysis only. No photograph, downloaded model or texture is included. All cushion, seat and structural geometry is authored here; shared surfaces are procedural. Mapped plans retain OpenStreetMap contributor attribution under ODbL1.0.',
  geographicProposal: {
    anchor: [11.624701997079471, 48.218793999470286],
    heading: 0.26577841384531603,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    status: 'preview-proposal',
    source: 'https://www.openstreetmap.org/way/123121774',
    notes:
      'Exact68Ã—105m pitch sets center and orientation; north-up mapped aperture and facade align independently. +Z faces the southern esplanade; west technical/team side is-X. GroundY0 is the playing-field/lower structural-foot datum; raised promenade is modeled at10m, consistent with the operator0â€“12m esplanade description. Host terrain supplies the long esplanade; no claim of survey-grade elevation.',
  },
  limitations: [
    'Static daylight unlit white-film exterior; the southern facade carries readable original geometric name lettering and circle mark, not a copied corporate font. Programmable colored illumination, changing commercial video and individual seat-mosaic artwork are not baked into the generic surface; seat colors and actual three-tier structure remain. Pillow clamps, inflation depth, individual seat count and staircase small members are reconstructed from primary photographs. Transparent ETFE roof and lower panels keep local alpha PBR because the shared surface replacement contract does not preserve opacity. No enclosed room or underground car-park inventory is claimed.',
  ],
  previewCamera: { position: [210, 145, 250], lookAt: [0, 24, 0], fov: 44 },
  qaCameras: [
    { name: 'near-inflated-film', position: [155, 29, 73], lookAt: [104, 29, 43] },
    { name: 'near-cascade-entrance', position: [132, 15, 89], lookAt: [88, 20, 57] },
    { name: 'near-south-name', position: [37, 32, 194], lookAt: [0, 34, 127] },
    { name: 'near-three-tiers', position: [0, 2, 0], lookAt: [85, 23, 7] },
    { name: 'near-transparent-roof', position: [75, 68, 79], lookAt: [63, 47, 72] },
    { name: 'near-goal-display', position: [0, 21, 3], lookAt: [0, 36, -68] },
    { name: 'far-open-roof', position: [195, 325, 220], lookAt: [0, 20, 0] },
  ],
};
/** Original simple stroke lettering, geometrically curved onto the south facade. */
function facadeSign(out) {
  const paths = {
    A: [
      [
        [0, 0],
        [0.5, 1],
        [1, 0],
      ],
      [
        [0.22, 0.42],
        [0.78, 0.42],
      ],
    ],
    l: [
      [
        [0.2, 0],
        [0.2, 1],
      ],
    ],
    i: [
      [
        [0.2, 0],
        [0.2, 0.66],
      ],
      [
        [0.2, 0.86],
        [0.2, 0.93],
      ],
    ],
    a: [
      [
        [0.1, 0.5],
        [0.3, 0.68],
        [0.8, 0.68],
        [0.95, 0.52],
        [0.95, 0],
      ],
      [
        [0.92, 0.4],
        [0.3, 0.4],
        [0.1, 0.25],
        [0.1, 0.1],
        [0.3, 0],
        [0.9, 0.12],
      ],
    ],
    n: [
      [
        [0.1, 0],
        [0.1, 0.67],
      ],
      [
        [0.1, 0.48],
        [0.32, 0.66],
        [0.75, 0.66],
        [0.92, 0.48],
        [0.92, 0],
      ],
    ],
    z: [
      [
        [0.1, 0.65],
        [0.95, 0.65],
        [0.1, 0],
        [0.95, 0],
      ],
    ],
    r: [
      [
        [0.1, 0],
        [0.1, 0.66],
      ],
      [
        [0.1, 0.47],
        [0.35, 0.65],
        [0.85, 0.65],
      ],
    ],
    e: [
      [
        [0.12, 0.35],
        [0.95, 0.35],
        [0.92, 0.52],
        [0.75, 0.68],
        [0.32, 0.68],
        [0.1, 0.48],
        [0.1, 0.2],
        [0.3, 0.02],
        [0.82, 0.02],
        [0.95, 0.15],
      ],
    ],
  };
  const widths = { A: 3, l: 1.05, i: 1.05, a: 2.65, n: 2.65, z: 2.55, r: 2.3, e: 2.6 };
  const local = (x, y) => {
    const t = ((y - 10.1) / 41.2) * 12,
      p = skinPoint(Math.atan2(x, 130), t);
    return [x, y, p[2] + 0.72];
  };
  let x = -20;
  for (const ch of 'Allianz@Arena') {
    if (ch === '@') {
      const cx = x + 2.2;
      curve(
        out,
        Array.from({ length: 65 }, (_, i) =>
          local(cx + 1.83 * Math.cos((i * TAU) / 64), 35.9 + 1.83 * Math.sin((i * TAU) / 64)),
        ),
        0.16,
        [0.04, 0.12, 0.32],
        'metal',
        8,
      );
      for (const [dx, h] of [
        [-0.9, 2.15],
        [0, 2.8],
        [0.9, 1.75],
      ])
        beam(
          out,
          'metal',
          local(cx + dx, 34.65),
          local(cx + dx, 34.65 + h),
          0.28,
          0.25,
          [0.04, 0.12, 0.32],
        );
      x += 4.65;
      continue;
    }
    const w = widths[ch];
    for (const path of paths[ch])
      for (let i = 1; i < path.length; i++)
        beam(
          out,
          'metal',
          local(x + path[i - 1][0] * w, 34 + path[i - 1][1] * 4),
          local(x + path[i][0] * w, 34 + path[i][1] * 4),
          0.32,
          0.25,
          [0.04, 0.12, 0.32],
        );
    x += w + 0.46;
  }
}
