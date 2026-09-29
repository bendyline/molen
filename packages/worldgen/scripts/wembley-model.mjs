/** Wembley: mapped current stadium, operator dimensions and Aurecon roof/arch construction. */
import { beam, cross, normalize } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const outerPlan = [
  [-54.70776, -142.93134],
  [-71.91332, -133.79984],
  [-85.49628, -125.41194],
  [-97.41365, -116.36109],
  [-108.31321, -105.5365],
  [-118.75246, -93.78624],
  [-124.32022, -87.35024],
  [-127.98324, -81.28568],
  [-135.34937, -67.67616],
  [-138.362, -61.55354],
  [-142.96616, -46.16383],
  [-147.20762, -29.65957],
  [-149.20939, -14.26024],
  [-149.46415, 4.11779],
  [-147.03309, 24.27574],
  [-143.19675, 40.62059],
  [-138.5192, 55.95553],
  [-133.5723, 65.82565],
  [-128.25366, 76.2426],
  [-121.73442, 83.91439],
  [-113.61134, 92.10417],
  [-103.507, 101.69277],
  [-92.05344, 109.52749],
  [-80.90257, 116.86016],
  [-68.72375, 121.34682],
  [-54.42922, 124.56112],
  [-38.99965, 127.79074],
  [-20.12685, 130.12025],
  [-0.25634, 130.29384],
  [21.63225, 129.39507],
  [46.26669, 125.26703],
  [64.70826, 120.67083],
  [73.07494, 117.25081],
  [81.44451, 113.05156],
  [96.09563, 102.17403],
  [111.55106, 87.15835],
  [116.85508, 80.92175],
  [121.44424, 75.21684],
  [126.33465, 66.65211],
  [130.70123, 57.49545],
  [136.71693, 38.47078],
  [140.09814, 24.37899],
  [142.46827, 8.56914],
  [144.14757, -9.46967],
  [143.21844, -25.88171],
  [139.9884, -45.21883],
  [136.17192, -61.31871],
  [129.38698, -75.75974],
  [120.75959, -89.82909],
  [110.26365, -102.07969],
  [100.3152, -112.64734],
  [87.78381, -122.8683],
  [74.87316, -131.59897],
  [62.15673, -138.57006],
  [52.73186, -142.8573],
  [33.02742, -148.64082],
  [22.73819, -151.27259],
  [5.48348, -153.19537],
  [-1.47891, -153.32128],
  [-9.9103, -152.9962],
  [-26.0856, -151.08558],
  [-34.35709, -149.07897],
  [-46.80656, -145.8744],
  [-54.70776, -142.93134],
];
const openingPlan = [
  [-64.79048, -44.07167],
  [-55.99353, -42.18013],
  [-53.28878, -43.6507],
  [-45.47475, -45.48088],
  [-32.8243, -46.88132],
  [-18.92357, -47.60921],
  [-6.66605, -47.56394],
  [6.69887, -47.51457],
  [19.50317, -47.46727],
  [32.4573, -46.76263],
  [45.43658, -45.36771],
  [54.0001, -43.98911],
  [59.01674, -41.7553],
  [65.39156, -43.70212],
  [69.59937, -39.85716],
  [66.57587, -32.66591],
  [68.07365, -27.79569],
  [68.97573, -20.92389],
  [69.85243, -7.18374],
  [69.4314, 5.61654],
  [68.6442, 18.23735],
  [67.57131, 27.62881],
  [65.70945, 33.25474],
  [67.77506, 38.04914],
  [65.84405, 39.91219],
  [61.26078, 38.40357],
  [58.74109, 40.36463],
  [53.63158, 42.66121],
  [44.59929, 44.52029],
  [31.37409, 45.99653],
  [18.85048, 46.78517],
  [6.34779, 47.52936],
  [-7.39017, 47.28937],
  [-20.26146, 46.6407],
  [-33.20003, 45.46857],
  [-46.28135, 43.5946],
  [-54.15254, 42.16289],
  [-61.738, 38.32772],
  [-65.54714, 40.85175],
  [-67.87591, 37.97109],
  [-64.81934, 34.94333],
  [-66.37145, 31.66479],
  [-67.65063, 27.57461],
  [-68.92169, 19.41014],
  [-69.60465, 3.81165],
  [-69.37531, -9.55707],
  [-68.77493, -20.31952],
  [-68.10149, -28.37662],
  [-66.68378, -33.68135],
  [-68.69948, -40.7465],
  [-64.79048, -44.07167],
];
const TAU = Math.PI * 2,
  white = [0.88, 0.9, 0.87],
  concrete = [0.65, 0.67, 0.64],
  gray = [0.48, 0.54, 0.57],
  red = [0.63, 0.035, 0.035],
  dark = [0.065, 0.085, 0.11];
const native = (p, y) => [p[0], y, p[1]],
  outward = (a) => [Math.sin(a), 0, Math.cos(a)];
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
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * ez - p[1] * ex) / den,
      u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) nearest = Math.min(nearest, t);
  }
  if (nearest === 1e9) throw Error('Wembley plan ray missed');
  return [dx * nearest, dz * nearest];
}
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
    { hx: 60, hz: 42, r: 12, rows: 31, run: 0.81, rise: 0.37, y: 1.2 },
    { hx: 86, hz: 68, r: 28, rows: 16, run: 0.8, rise: 0.45, y: 15.3 },
    { hx: 102, hz: 84, r: 40, rows: 34, run: 0.78, rise: 0.53, y: 26 },
  ];
  for (const [k, t] of tiers.entries()) {
    for (let row = 0; row < t.rows; row++) {
      const hx = t.hx + row * t.run,
        hz = t.hz + row * t.run,
        r = t.r + row * t.run * 0.67,
        y = t.y + row * t.rise,
        pa = (a) => rounded(a, hx, hz, r),
        pb = (a) => rounded(a, hx + t.run, hz + t.run, r + t.run * 0.67);
      ring(out, pa, pb, y);
      for (let i = 0; i < 360; i++) {
        const a = (i * TAU) / 360,
          b = ((i + 1) * TAU) / 360;
        face(
          out,
          'concrete',
          [
            native(pa(a), y - t.rise),
            native(pa(b), y - t.rise),
            native(pa(b), y),
            native(pa(a), y),
          ],
          concrete,
          outward(a).map((x) => -x),
        );
      }
      const l = loop(hx + 0.32, hz + 0.32, r + 0.2),
        count = Math.floor(l.total / 0.56),
        aisles = k === 0 ? 36 : 44;
      for (let i = 0; i < count; i++) {
        const u = i / count,
          p = at(l, u),
          q = at(l, u + 0.0001),
          gap = (Math.abs(u * aisles - Math.round(u * aisles)) * l.total) / aisles;
        if (gap < 1) continue;
        if (k === 1 && p[1] < -67 && Math.abs(p[0]) < 18 && row < 10) continue;
        chair(out, Math.atan2(-(q[1] - p[1]), q[0] - p[0]), native(p, y), red);
      }
      for (let i = 0; i < aisles; i++) {
        const p = at(l, i / aisles),
          q = at(l, i / aisles + 0.0001),
          o = transformed(out, Math.atan2(-(q[1] - p[1]), q[0] - p[0]), native(p, y));
        box(o, 'concrete', [-0.8, 0.012, -0.26], [0.8, 0.09, 0.02], white);
      }
    }
    const y = t.y + t.rows * t.rise,
      pa = (a) => rounded(a, t.hx, t.hz, t.r),
      pb = (a) =>
        rounded(a, t.hx + t.rows * t.run, t.hz + t.rows * t.run, t.r + t.rows * t.run * 0.67);
    for (let i = 0; i < 360; i++) {
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360;
      face(
        out,
        'concrete',
        [
          native(pa(a), t.y - 0.6),
          native(pa(b), t.y - 0.6),
          native(pb(b), y - 0.5),
          native(pb(a), y - 0.5),
        ],
        concrete,
        [0, -1, 0],
      );
      if (k) {
        const low = tiers[k - 1],
          pl = (a) =>
            rounded(
              a,
              low.hx + low.rows * low.run,
              low.hz + low.rows * low.run,
              low.r + low.rows * low.run * 0.67,
            ),
          loY = low.y + low.rows * low.rise;
        face(
          out,
          'glass',
          [native(pl(a), loY), native(pl(b), loY), native(pa(b), t.y), native(pa(a), t.y)],
          dark,
          outward(a).map((x) => -x),
        );
      }
    }
    for (const yy of [t.y + 0.08, t.y + 1])
      curve(
        out,
        Array.from({ length: 361 }, (_, i) => native(pa((i * TAU) / 360), yy)),
        0.045,
        white,
      );
    for (let i = 0; i < 96; i++)
      beam(
        out,
        'metal',
        native(pa((i * TAU) / 96), t.y),
        native(pa((i * TAU) / 96), t.y + 1.08),
        0.04,
        0.04,
        white,
      );
    for (let i = 0; i < 22; i++) {
      const a = ((i + 0.5) * TAU) / 22,
        row = t.rows * 0.6,
        p = rounded(a, t.hx + row * t.run, t.hz + row * t.run, t.r + row * t.run * 0.67),
        o = transformed(out, a, native(p, t.y + row * t.rise));
      box(o, 'glass', [-1.4, 0.02, -0.7], [1.4, 1.6, 0.1], dark);
      box(o, 'concrete', [-1.55, 1.6, -0.9], [1.55, 1.86, 0.2], white);
    }
  }
  // Royal box and its central presentation stair are in the north stand, confirmed by the operator photos.
  box(out, 'glass', [-18, 15.2, -75.8], [18, 18.3, -68.3], [0.11, 0.13, 0.16]);
  for (let row = 0; row < 8; row++)
    for (let seat = 0; seat < 45; seat++)
      chair(
        out,
        Math.PI,
        [-15.4 + seat * 0.7, 15.4 + row * 0.4, -69 - row * 0.78],
        [0.32, 0.02, 0.03],
      );
  for (const x of [-19, 19])
    for (let i = 0; i < 15; i++)
      box(
        out,
        'concrete',
        [x - 0.8, 12 + i * 0.23, -66 - i * 0.52],
        [x + 0.8, 12 + i * 0.23 + 0.23, -65.47 - i * 0.52],
        white,
      );
  // Two east/west goal-end display enclosures face the playing field.
  for (const side of [-1, 1]) {
    const o = transformed(out, side > 0 ? -Math.PI / 2 : Math.PI / 2, [side * 107, 0, 0]);
    box(o, 'metal', [-10, 33, -0.4], [10, 42, 0.2], gray);
    box(o, 'glass', [-9.7, 33.3, 0.21], [9.7, 41.7, 0.3], dark);
  }
  for (const x of [-12, 12]) {
    box(out, 'glass', [x - 5, 0.1, -40.7], [x + 5, 2.1, -39.4], [0.18, 0.23, 0.26]);
    for (let j = 0; j < 12; j++) chair(out, Math.PI, [x - 4.3 + j * 0.75, 0.15, -39.7], red);
  }
}
function roofY(a, t) {
  return 51.6 - 2.2 * t + Math.sin(a) * 0.4;
}
function roofPoint(a, t) {
  const p = boundary(openingPlan, a),
    q = boundary(outerPlan, a);
  return [p[0] * (1 - t) + q[0] * t, roofY(a, t), p[1] * (1 - t) + q[1] * t];
}
function facade(out) {
  const pa = (a) => boundary(outerPlan, a).map((v) => v * 0.968);
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360,
      b = ((i + 1) * TAU) / 360,
      p = pa(a),
      q = pa(b);
    for (let j = 0; j < 8; j++) {
      const y = j * 5.4,
        color = j < 2 ? concrete : [0.68, 0.72, 0.72];
      face(
        out,
        j < 2 ? 'concrete' : 'glass',
        [native(p, y), native(q, y), native(q, y + 5.4), native(p, y + 5.4)],
        j < 2 ? color : [0.24, 0.32, 0.37],
        outward(a),
      );
      face(
        out,
        'metal',
        [native(p, y + 4.75), native(q, y + 4.75), native(q, y + 5.4), native(p, y + 5.4)],
        white,
        outward(a),
      );
    }
    beam(out, 'metal', native(p, 10.8), native(p, 43.1), 0.12, 0.12, white);
    if (i % 4 === 0) {
      const rr = boundary(outerPlan, a);
      beam(out, 'concrete', native(p, 0), native(p, 42.8), 0.7, 0.8, concrete);
      beam(out, 'metal', native(p, 43), native(rr, 49.3), 0.4, 0.4, white);
    }
  }
  // Dark doors and individual piers at street level.
  for (let i = 0; i < 100; i++) {
    const a = ((i + 0.5) * TAU) / 100,
      p = pa(a),
      o = transformed(out, a, native(p, 0));
    box(o, 'glass', [-1.3, 0.18, -0.05], [1.3, 3.55, 0.04], dark);
    for (const x of [-0.75, 0, 0.75])
      box(o, 'metal', [x - 0.035, 0.18, 0.05], [x + 0.035, 3.55, 0.14], gray);
  }
  // The large north entrance projects toward Olympic Way; blue glazed hall under the broad canopy.
  box(out, 'concrete', [-38, 0, -153.5], [38, 10.2, -140], concrete);
  box(out, 'glass', [-36.8, 10.3, -153.7], [36.8, 27.6, -151.4], [0.12, 0.25, 0.39]);
  for (let x = -36; x <= 36; x += 4.5)
    box(out, 'metal', [x - 0.085, 10.25, -153.92], [x + 0.085, 27.7, -153.68], white);
  for (const y of [10.3, 18.8, 27.7])
    box(out, 'metal', [-37, y, -154.1], [37, y + 0.22, -153.6], white);
  box(out, 'metal', [-39, 28, -155.7], [39, 28.65, -141], gray);
  for (let i = 0; i < 40; i++)
    box(
      out,
      'concrete',
      [-36, i * 0.24, -171.5 + i * 0.4],
      [36, i * 0.24 + 0.24, -171.1 + i * 0.4],
      concrete,
    );
  ring(
    out,
    (a) => boundary(outerPlan, a).map((v) => v * 0.94),
    (a) => boundary(outerPlan, a).map((v) => v * 1.025),
    0.025,
    'concrete',
    concrete,
  );
}
// Segment clipping protects the true roof edge, including the narrower southern corners.
function roofContains(x, z, margin = 0.5) {
  const edge = boundary(outerPlan, Math.atan2(x, z));
  return Math.hypot(x, z) <= Math.hypot(...edge) - margin;
}
function clippedRoof(a, b) {
  const p = (t) => a.map((v, i) => v + (b[i] - v) * t);
  let first = -1,
    last = -1;
  for (let i = 0; i <= 100; i++) {
    const q = p(i / 100);
    if (roofContains(q[0], q[2])) {
      if (first < 0) first = i / 100;
      last = i / 100;
    }
  }
  if (last - first < 0.001) return null;
  return [p(first), p(last)];
}
function roofBeam(out, a, b, w, h, color) {
  const q = clippedRoof(a, b);
  if (q) beam(out, 'metal', q[0], q[1], w, h, color);
}
function roofTube(out, a, b, r, color, sides) {
  const q = clippedRoof(a, b);
  if (q) tube(out, 'metal', q[0], q[1], r, color, sides);
}
function roofCurve(out, points, radius, color) {
  for (let i = 1; i < points.length; i++) roofTube(out, points[i - 1], points[i], radius, color, 8);
}
function roof(out) {
  const n = 420;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    for (let j = 0; j < 9; j++) {
      const t = j / 9,
        u = (j + 1) / 9,
        p = roofPoint(a, t),
        q = roofPoint(b, t),
        r = roofPoint(b, u),
        v = roofPoint(a, u),
        isClear = p[2] < -45 && p[2] > -72 && Math.abs(p[0]) < 110;
      face(
        out,
        isClear ? 'translucentRoof' : 'seam',
        [p, q, r, v],
        isClear ? white : [0.72, 0.75, 0.75],
        [0, 1, 0],
      );
    }
  }
  // Prismatic perimeter roof truss has a continuous top/bottom ring and triangular radial bracing.
  for (const [scale, y] of [
    [1, 49.3],
    [0.975, 43.5],
    [0.945, 48.8],
  ])
    curve(
      out,
      Array.from({ length: 361 }, (_, i) =>
        native(
          boundary(outerPlan, (i * TAU) / 360).map((v) => v * scale),
          y,
        ),
      ),
      0.22,
      white,
    );
  for (let i = 0; i < 120; i++) {
    const a = (i * TAU) / 120,
      b = ((i + 1) * TAU) / 120,
      p = boundary(outerPlan, a),
      q = boundary(outerPlan, b);
    beam(
      out,
      'metal',
      native(p, 49.3),
      native(
        q.map((v) => v * 0.975),
        43.5,
      ),
      0.21,
      0.21,
      white,
    );
    beam(
      out,
      'metal',
      native(
        p.map((v) => v * 0.975),
        43.5,
      ),
      native(q, 49.3),
      0.21,
      0.21,
      white,
    );
  }
  // North-south semi-Vierendeel roof members, published15.5m transverse spacing.
  for (let x = -139.5; x <= 139.5; x += 15.5) {
    const zmax = 117 * Math.sqrt(Math.max(0, 1 - (x / 150) ** 2)),
      zmin = -128 * Math.sqrt(Math.max(0, 1 - (x / 150) ** 2));
    for (let z = zmin; z < zmax - 1; z += 10) {
      const next = Math.min(z + 10, zmax);
      if (Math.abs(x) < 70 && z > -48 && z < 48) continue;
      if (Math.abs(x) < 70 && next > -48 && z < -48) continue;
      const top = [x, 50.8, z],
        end = [x, 50.8, next],
        mid = [x, 46.3, (z + next) / 2];
      roofBeam(out, top, end, 0.3, 0.4, white);
      roofTube(out, top, mid, 0.13, white, 10);
      roofTube(out, mid, end, 0.13, white, 10);
      roofTube(out, [x, 46.3, z], [x, 46.3, next], 0.07, white, 8);
    }
  }
  // Four primary runway trusses. Their exposed northern ends remain outside the pitch aperture.
  for (const x of [-105, -70.6, 70.6, 105]) {
    for (let z = -48; z < 111; z += 13) {
      const end = Math.min(z + 13, 111),
        depth = 8 + 4 * Math.sin((Math.PI * (z + 48)) / 159);
      roofBeam(out, [x, 51.9, z], [x, 51.9, end], 0.38, 0.5, white);
      roofBeam(out, [x, 51.9, z], [x, 51.9 - depth, (z + end) / 2], 0.23, 0.23, white);
      roofBeam(out, [x, 51.9 - depth, (z + end) / 2], [x, 51.9, end], 0.23, 0.23, white);
      roofTube(out, [x, 51.9 - depth, z], [x, 51.9 - depth, end], 0.09, white, 8);
    }
  }
  // Long bowstring chord along the southern aperture; a15m central structural depth.
  const bow = (x) => [x, 50.8 - 13.9 * (1 - (x / 140) ** 2), 48 + 8 * (x / 140) ** 2];
  roofCurve(
    out,
    Array.from({ length: 85 }, (_, i) => bow(-140 + (i * 280) / 84)),
    0.2,
    white,
  );
  roofCurve(
    out,
    Array.from({ length: 85 }, (_, i) => {
      const p = bow(-140 + (i * 280) / 84);
      return [p[0], 51.8, p[2]];
    }),
    0.26,
    white,
  );
  for (let x = -140; x < 140; x += 10) {
    roofBeam(out, [x, 51.8, bow(x)[2]], bow(x), 0.17, 0.17, white);
    roofBeam(out, bow(x), [x + 10, 51.8, bow(x + 10)[2]], 0.13, 0.13, white);
  }
  // Visible sliding panel edges and separate elevated bogie rails, static covered-seating configuration.
  for (const x of [-121.8, -96, -70.5, 70.5, 96, 121.8]) {
    roofBeam(out, [x, 52.0, -45], [x, 52.0, 100], 0.25, 0.3, gray);
    for (let z = -42; z < 98; z += 20)
      if (roofContains(x, z, 1))
        box(out, 'metal', [x - 0.6, 51.6, z - 0.4], [x + 0.6, 52.4, z + 0.4], gray);
  }
  for (const z of [47.8, 73.5, 98]) {
    for (const s of [-1, 1])
      roofBeam(out, [s * 70.5, 52.1, z], [s * 122, 52.1, z], 0.19, 0.21, white);
  }
  // Suspended inward light bank follows the aperture.
  for (let i = 0; i < 96; i++) {
    const a = (i * TAU) / 96,
      p = boundary(openingPlan, a),
      o = transformed(out, a, native(p, 49.3));
    box(o, 'metal', [-0.65, -0.35, -0.1], [0.65, 0.2, 0.42], gray);
    box(o, 'plastic', [-0.57, -0.3, -0.14], [0.57, 0.15, -0.11], [0.96, 0.95, 0.85]);
  }
}
function arch(out) {
  const tilt = (22 * Math.PI) / 180,
    B = [0, Math.sin(tilt), Math.cos(tilt)],
    C = (t) => [
      -157.5 * Math.cos(t),
      3 + 126.6 * Math.sin(t),
      -50 - 126.6 * Math.sin(t) * Math.tan(tilt),
    ],
    point = (t, a) => {
      const center = C(t),
        T = normalize([
          157.5 * Math.sin(t),
          126.6 * Math.cos(t),
          -126.6 * Math.cos(t) * Math.tan(tilt),
        ]),
        N = normalize(cross(T, B)),
        r = Math.min(3.5, 0.19 + Math.sin(t) * 25);
      return center.map((v, k) => v + r * (Math.cos(a) * N[k] + Math.sin(a) * B[k]));
    };
  for (let chord = 0; chord < 12; chord++)
    curve(
      out,
      Array.from({ length: 161 }, (_, i) => point((i * Math.PI) / 160, (chord * TAU) / 12)),
      0.2285,
      white,
      'metal',
      10,
    );
  for (let j = 1; j < 43; j++) {
    const t = (j * Math.PI) / 43,
      u = ((j + 1) * Math.PI) / 43;
    for (let k = 0; k < 12; k++) {
      const a = (k * TAU) / 12,
        b = ((k + 1) * TAU) / 12;
      beam(out, 'metal', point(t, a), point(t, b), 0.3, 0.3, white);
      if (j < 42)
        tube(out, 'metal', point(t, a), point(u, j % 2 ? b : ((k - 1) * TAU) / 12), 0.13, white, 8);
    }
  }
  for (const x of [-157.5, 157.5]) {
    box(out, 'concrete', [x - 3.2, 0, -53.2], [x + 3.2, 1.7, -46.8], concrete);
    box(out, 'metal', [x - 1.3, 1.7, -51.2], [x + 1.3, 3.3, -48.8], gray);
  }
  // Diagonal Warren-pattern forestays and shorter backstays attach to actual arch diaphragm stations.
  for (let j = 4; j < 40; j += 3) {
    const t = (j * Math.PI) / 43,
      p = C(t),
      x = p[0];
    for (const d of [-15.5, 15.5]) {
      const xx = Math.max(-141, Math.min(141, x + d)),
        z = -47 - 10 * (xx / 141) ** 2;
      curve(out, [p, [xx, 53, z]], 0.065, white, 'metal', 10);
      const o = [xx, 51.7, z];
      for (const dd of [-2, 2])
        beam(out, 'metal', [xx, 53, z], [xx + dd, 49, z + 3.5], 0.17, 0.17, white);
      void o;
    }
    const z = -126 * Math.sqrt(Math.max(0, 1 - (x / 160) ** 2));
    curve(out, [p, [x * 0.97, 49.3, z]], 0.06, white, 'metal', 10);
  }
  for (const dz of [-0.15, 0.15])
    curve(
      out,
      Array.from({ length: 101 }, (_, i) => {
        const x = -145 + i * 2.9;
        return [x, 52.4 + 4.5 * (x / 145) ** 2, -47 - 10 * (x / 145) ** 2 + dz];
      }),
      0.06,
      white,
      'metal',
      8,
    );
}
export function buildWembley(out) {
  soccerPitch(transformed(out, Math.PI / 2, [0, 0, 0]));
  bowl(out);
  facade(out);
  roof(out);
  arch(out);
}
export const wembleyStudy = {
  id: 'N0684',
  key: 'wembley_stadium',
  title: 'Wembley Stadium',
  wikidataId: 'Q128468',
  build: buildWembley,
  metricTriangleUv: true,
  smoothNormalSlots: ['trim', 'foundation', 'wall', 'roof'],
  size: [323, 133, 309],
  nativeAxes: {
    up: '+Y',
    front: '-Z',
    origin:
      'Mapped pitch center at playing-field/structural-foot gradeY0. Native+X east along the goal axis; +Zsouth. The inclined arch stands on the northern side.',
  },
  visualBrief:
    'Current Wembley with its315m span,133m high inclined tubular lattice arch; twelve physical457mm chords, square diaphragm rings and pencil ends, triangulated forestays and backstays, semi-Vierendeel roof trusses and bowstring chord, seven sliding-panel roof regions around an open central aperture, translucent north roof strip, glazed and pale precast stadium envelope, north Olympic Way entrance, royal box and three deep red seating tiers.',
  sourceFacts: {
    archSpanMeters: 315,
    archHeightMeters: 133,
    archInclinationDegrees: 22,
    archNominalOuterDiameterMeters: 7.4,
    archChordCount: 12,
    archChordDiameterMeters: 0.457,
    archDiaphragmSectionMeters: 0.3,
    roofHeightMeters: 52,
    movingRoofPanels: 7,
    fieldMeters: [105, 68],
    basis:
      'Current operator publishes133m arch height,315m span,7.4m diameter and52m roof. Structural designer Kourosh Kayvani publishes12×457mm chords,300mm square diaphragms at approximately11m centers,22degree inclination, cable arrangement, roof truss details and seven movable panels; paper diagrams and four pages were visually examined. Architect photos control north entrance, glaze/precast color, red tiers and exposed members. Exact pitch and joined current roof polygons determine axis and outline. Mapped114.5×69.2m pitch polygon includes grass margins; marked field remains105×68m. Engineer paper135m/7m figures are preserved as differing design-datum/internal-diameter descriptions rather than silently overriding operator dimensions.',
  },
  referencePages: [
    'https://www.wembleystadium.com/about/stadium-facts-and-features',
    'https://help.wembleystadium.com/support/solutions/articles/7000028145-stats-and-facts',
    'https://help.wembleystadium.com/support/solutions/articles/7000028144-wembley-stadium-roof',
    'https://populous.com/showcases/wembley-stadium',
    'https://populous.com/uploads/2024/05/Wembley_2.jpg',
    'https://populous.com/uploads/2018/01/Wembley_7-e1715865066701.jpg',
    'https://populous.com/uploads/2018/01/Wembley_5.jpg',
    'https://lsaa.org/images/pdf_files/projects/Wembley_Reduced_2025.pdf',
    'https://techrete.com/wp-content/uploads/2020/03/Wembley-Stadium-Fact-Sheet.pdf',
    'https://www.openstreetmap.org/relation/912489',
    'https://www.openstreetmap.org/way/116539074',
    'https://www.openstreetmap.org/way/27784957',
  ],
  referenceRights:
    'Published primary pictures and engineering figures inform an original component-authored model only. No photograph, drawing texture, manufacturer mesh or font is embedded. OpenStreetMap-derived plans retain contributor attribution, ODbL1.0.',
  geographicProposal: {
    anchor: [-0.27956525, 51.55596295],
    heading: 0.003693795533106074,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    status: 'preview-proposal',
    source: 'https://www.openstreetmap.org/way/116539074',
    notes:
      'Pitch goal axis is east-west, so native+X follows it and native-Z is the north Olympic Way entrance and arch. Footprint and aperture are independently mapped. Arch map itself records artistic plan interpolation, therefore only its approximately315m feet and north-side position are used; the22degree geometry comes from the designer. Ground contactY0 preserves feet and playing field, with north stair/entrance grade reconstructed from published views.',
  },
  limitations: [
    'Static roof covering all seats while keeping the pitch open; movable panel motion, bogie internals, ticket-seat count and event advertisements are outside this exterior model. Structural connection plate schedules, field margins and smaller mullion dimensions are reconstructed from published photographs. The visible arch and roof structure preserve published section dimensions, but no structural analysis certification or engineering survey is claimed.',
  ],
  previewCamera: { position: [290, 195, -330], lookAt: [0, 53, -10], fov: 45 },
  qaCameras: [
    { name: 'near-north-entrance', position: [76, 33, -223], lookAt: [0, 24, -140] },
    { name: 'near-arch-lattice', position: [25, 157, -148], lookAt: [0, 124, -101] },
    { name: 'near-pencil-bearing', position: [182, 18, -76], lookAt: [151, 12, -54] },
    { name: 'near-roof-cables', position: [22, 86, -128], lookAt: [0, 66, -66] },
    { name: 'near-bowl-royal-box', position: [0, 4, 5], lookAt: [0, 22, -88] },
    { name: 'far-open-roof', position: [230, 305, 250], lookAt: [0, 33, 0] },
  ],
};
