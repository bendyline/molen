/** Stade de France: architect plan, Ministry heritage survey and mapped structural axes. */
import { beam } from './authored-structure-mesh.mjs';
import { lathe, transformed } from './lighthouse-models.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const outerPlan = [
  [-126.83706, 83.11546],
  [-125.67179, 85.9646],
  [-122.97279, 91.80061],
  [-119.15745, 98.93565],
  [-115.86415, 104.30637],
  [-113.05877, 108.4404],
  [-110.0099, 112.50724],
  [-106.86626, 116.38809],
  [-103.5756, 120.16082],
  [-99.55337, 124.35531],
  [-95.90994, 127.7983],
  [-90.7297, 132.24604],
  [-86.91099, 135.23503],
  [-80.77443, 139.54661],
  [-76.53206, 142.18529],
  [-69.16074, 146.26614],
  [-64.6393, 148.41384],
  [-60.04879, 150.39333],
  [-55.39945, 152.18003],
  [-52.62604, 153.10169],
  [-43.53818, 155.54752],
  [-38.65665, 156.61909],
  [-28.83866, 158.43274],
  [-24.52743, 159.05643],
  [-17.08844, 159.90979],
  [-12.11652, 160.30736],
  [-2.65783, 160.71607],
  [0.50624, 160.71469],
  [5.49632, 160.66251],
  [13.8009, 160.28621],
  [18.78124, 159.89229],
  [25.97434, 159.05628],
  [31.82428, 158.15856],
  [40.32073, 156.57232],
  [50.11128, 154.24542],
  [57.15886, 151.89766],
  [61.81693, 150.0605],
  [66.2348, 148.15519],
  [70.7394, 145.94908],
  [79.19256, 141.17098],
  [83.37036, 138.4498],
  [90.06036, 133.58712],
  [94.8923, 129.57357],
  [98.62637, 126.24721],
  [102.32501, 122.5969],
  [105.73508, 118.93727],
  [109.25162, 114.83329],
  [112.32222, 110.88279],
  [115.37675, 106.70265],
  [118.10167, 102.4941],
  [120.3966, 98.74795],
  [122.80239, 94.377],
  [124.25378, 91.54747],
  [127.11943, 85.33753],
  [128.96394, 80.6677],
  [130.61952, 75.97343],
  [132.54884, 69.59754],
  [133.78054, 64.74371],
  [134.86608, 59.44299],
  [136.52067, 50.11467],
  [138.02081, 40.38323],
  [138.90991, 33.28921],
  [139.51701, 27.25211],
  [139.97255, 22.25132],
  [140.42766, 14.89385],
  [140.78622, 5.56939],
  [140.84638, 0.57304],
  [140.78481, -8.02656],
  [140.62108, -13.01998],
  [139.90732, -25.5272],
  [138.69682, -37.57332],
  [137.32694, -47.51962],
  [135.21178, -59.62373],
  [133.86656, -66.27973],
  [132.71266, -71.15474],
  [131.24597, -76.30423],
  [129.68109, -81.05312],
  [128.186, -85.109],
  [124.28909, -93.93629],
  [120.35913, -101.33095],
  [115.17958, -109.51737],
  [111.52937, -114.53648],
  [107.72872, -119.23284],
  [102.00598, -125.49409],
  [97.54537, -129.77158],
  [93.81035, -133.08462],
  [90.57337, -135.72554],
  [85.50506, -139.5063],
  [81.38511, -142.28041],
  [77.08525, -144.92998],
  [72.73471, -147.35121],
  [68.30073, -149.60697],
  [65.76912, -150.82275],
  [59.79404, -153.31365],
  [55.09633, -155.04153],
  [51.37344, -156.25627],
  [44.50185, -158.10119],
  [35.53846, -160.02493],
  [30.6227, -160.87639],
  [23.77947, -161.80956],
  [17.85076, -162.42228],
  [12.87263, -162.78703],
  [7.88097, -163.04105],
  [1.91863, -163.16163],
  [-9.04768, -162.88144],
  [-18.9868, -162.08953],
  [-29.52158, -160.62864],
  [-39.33405, -158.73642],
  [-49.96313, -156.06978],
  [-54.39962, -154.73449],
  [-59.10677, -153.03124],
  [-63.72185, -151.10663],
  [-69.9621, -148.18681],
  [-75.08062, -145.45114],
  [-79.35988, -142.86247],
  [-83.53769, -140.14129],
  [-87.62134, -137.20968],
  [-91.56552, -134.14969],
  [-95.3806, -130.90664],
  [-99.13745, -127.45996],
  [-104.14372, -122.2898],
  [-107.47486, -118.53592],
  [-110.00292, -115.44572],
  [-114.09466, -109.95512],
  [-118.96382, -102.48173],
  [-122.06978, -96.9291],
  [-124.33196, -92.45165],
  [-126.43628, -87.7857],
  [-128.69837, -82.05063],
  [-130.19316, -77.73379],
  [-131.63424, -72.95358],
  [-133.1181, -67.0825],
  [-134.09827, -62.18103],
  [-137.14362, -42.79465],
  [-138.32573, -32.8557],
  [-139.21259, -22.58894],
  [-139.81898, -9.75386],
  [-139.89095, 0.84847],
  [-139.48439, 13.44481],
  [-138.83572, 22.91466],
  [-137.79656, 32.87765],
  [-136.23073, 44.26594],
  [-134.2086, 55.44606],
  [-132.09802, 65.21537],
  [-129.11448, 76.94007],
  [-126.83706, 83.11546],
];
const glassOuterPlan = [
  [76.41873, 40.97809],
  [75.82494, 45.72612],
  [71.02602, 60.84905],
  [63.26124, 74.65133],
  [52.79935, 85.35975],
  [40.56159, 92.27635],
  [25.3955, 97.51685],
  [8.88669, 99.11553],
  [-7.74415, 99.27488],
  [-24.03437, 97.67464],
  [-39.28514, 92.66836],
  [-51.29324, 85.98744],
  [-61.84735, 74.81201],
  [-64.60375, 70.22273],
  [-69.83579, 61.44855],
  [-74.78779, 46.28078],
  [-76.92291, 27.87356],
  [-78.38358, 8.9709],
  [-78.33431, -10.79016],
  [-77.04884, -29.72801],
  [-74.65043, -47.82066],
  [-70.08305, -63.29334],
  [-62.31852, -76.93705],
  [-51.61387, -87.90541],
  [-39.69134, -94.84771],
  [-24.65486, -99.95413],
  [-8.16651, -101.602],
  [8.50099, -101.56181],
  [24.99877, -100.03556],
  [40.37999, -95.0499],
  [52.33218, -88.07367],
  [62.91895, -77.42455],
  [70.75805, -63.78346],
  [75.64609, -48.4352],
  [78.0157, -30.24416],
  [79.34177, -11.29901],
  [79.22575, 8.46074],
  [78.10569, 27.3506],
  [76.41873, 40.97809],
];
const openingPlan = [
  [-32.6538, -78.23139],
  [-40.06968, -72.16923],
  [-45.33386, -64.92925],
  [-48.88023, -55.51727],
  [-50.14472, -44.12105],
  [-50.80966, -27.32033],
  [-51.4746, -10.5196],
  [-51.39254, 7.9974],
  [-50.63841, 24.2624],
  [-49.84177, 40.26354],
  [-48.4628, 51.61645],
  [-45.3707, 62.2174],
  [-39.93596, 70.07826],
  [-32.71436, 75.34305],
  [-20.53579, 79.39375],
  [-6.05502, 80.95729],
  [7.12806, 80.96087],
  [20.93045, 78.95172],
  [32.66921, 75.26025],
  [40.45963, 70.05076],
  [46.58292, 62.44095],
  [49.64101, 51.36168],
  [50.00593, 40.58822],
  [50.92241, 23.83512],
  [51.53972, 7.28596],
  [51.40795, -10.96853],
  [50.91254, -27.18455],
  [49.80955, -42.98311],
  [49.08786, -55.01598],
  [46.36824, -64.75333],
  [40.7224, -72.91474],
  [31.3676, -78.03961],
  [20.92575, -81.51222],
  [7.20675, -82.93152],
  [-7.45433, -83.4642],
  [-20.45035, -81.58562],
  [-32.6538, -78.23139],
];
const mastsPlan = [
  [-113.95986, -22.21272],
  [-43.5712, -132.12279],
  [83.74055, -108.34167],
  [114.99189, 20.24878],
  [44.74094, 129.6102],
  [-106.94642, 64.64958],
  [-107.42386, -66.6577],
  [-82.5687, 105.85728],
  [0.23452, -138.2976],
  [107.87723, -67.20123],
  [108.05451, 63.92562],
  [0.7823, 135.9672],
  [-113.91026, 21.0948],
  [-83.2996, -107.67256],
  [44.31951, -132.32966],
  [114.90229, -23.51229],
  [-43.29696, 129.91177],
  [84.28532, 105.58862],
];

const TAU = Math.PI * 2,
  white = [0.84, 0.86, 0.83],
  gray = [0.43, 0.48, 0.49],
  concrete = [0.62, 0.64, 0.6],
  dark = [0.055, 0.075, 0.085],
  seat = [0.53, 0.59, 0.58];
const native = (p, y) => [p[0], y, p[1]],
  outward = (a) => [Math.sin(a), 0, Math.cos(a)];
function boundary(poly, a) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let nearest = Infinity;
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
  if (!Number.isFinite(nearest)) throw Error('missing plan ray');
  return [dx * nearest, dz * nearest];
}
function rounded(a, hx, hz, r) {
  const sx = Math.sign(Math.sin(a)) || 1,
    sz = Math.sign(Math.cos(a)) || 1,
    dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const qx = hx - r,
      qz = hz - r,
      d = qx * dx + qz * dz;
    t = d + Math.sqrt(Math.max(0, d * d - qx * qx - qz * qz + r * r));
  }
  return [sx * t * dx, sz * t * dz];
}
function pathLoop(fn) {
  const points = Array.from({ length: 721 }, (_, i) => fn((i * TAU) / 720)),
    dist = [0];
  for (let i = 1; i < points.length; i++)
    dist.push(
      dist[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  return { points, dist, total: dist.at(-1) };
}
function at(l, u) {
  const d = (((u % 1) + 1) % 1) * l.total;
  let i = 1;
  while (l.dist[i] < d) i++;
  const t = (d - l.dist[i - 1]) / (l.dist[i] - l.dist[i - 1]);
  return l.points[i - 1].map((v, k) => v + (l.points[i][k] - v) * t);
}
function band(out, p, q, y, slot = 'concrete', color = concrete, n = 360) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    face(
      out,
      slot,
      [native(p(a), y), native(p(b), y), native(q(b), y), native(q(a), y)],
      color,
      [0, 1, 0],
    );
  }
}
function wall(out, p, y0, y1, slot = 'concrete', color = concrete, n = 360, inside = false) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    face(
      out,
      slot,
      [native(p(a), y0), native(p(b), y0), native(p(b), y1), native(p(a), y1)],
      color,
      outward(a).map((v) => (inside ? -v : v)),
    );
  }
}
function rail(out, p, y) {
  curve(
    out,
    Array.from({ length: 361 }, (_, i) => native(p((i * TAU) / 360), y + 1.02)),
    0.043,
    gray,
  );
  for (let i = 0; i < 120; i++)
    beam(
      out,
      'metal',
      native(p((i * TAU) / 120), y),
      native(p((i * TAU) / 120), y + 1.04),
      0.037,
      0.037,
      gray,
    );
}
function seating(out) {
  const tiers = [
    { hx: 46, hz: 66, r: 18, rows: 26, run: 0.82, rise: 0.35, y: -10.3 },
    { hx: 69, hz: 89, r: 34, rows: 24, run: 0.82, rise: 0.49, y: 2.3 },
    { hx: 91, hz: 112, r: 49, rows: 23, run: 0.79, rise: 0.55, y: 15.5 },
  ];
  for (const [k, t] of tiers.entries()) {
    for (let row = 0; row < t.rows; row++) {
      const h = t.hx + row * t.run,
        z = t.hz + row * t.run,
        r = t.r + row * t.run * 0.65,
        y = t.y + row * t.rise,
        p = (a) => rounded(a, h, z, r),
        q = (a) => rounded(a, h + t.run, z + t.run, r + t.run * 0.65);
      band(out, p, q, y);
      wall(out, p, y - t.rise, y, 'concrete', concrete, 360, true);
      const l = pathLoop((a) => rounded(a, h + 0.32, z + 0.32, r + 0.2)),
        count = Math.floor(l.total / 0.55),
        aisles = k === 0 ? 36 : 42;
      for (let i = 0; i < count; i++) {
        const u = i / count,
          p0 = at(l, u),
          p1 = at(l, u + 0.0001),
          gap = (Math.abs(u * aisles - Math.round(u * aisles)) * l.total) / aisles;
        if (gap < 0.92) continue;
        if (k === 2 && Math.abs(p0[0]) < 11 && Math.abs(p0[1]) > 122 && row > 12) continue;
        chair(out, Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]), native(p0, y), seat);
      }
      for (let i = 0; i < aisles; i++) {
        const p0 = at(l, i / aisles),
          p1 = at(l, i / aisles + 0.0001),
          o = transformed(out, Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]), native(p0, y));
        box(o, 'concrete', [-0.75, 0.01, -0.3], [0.75, 0.12, 0.02], white);
      }
    }
    const p = (a) => rounded(a, t.hx, t.hz, t.r),
      q = (a) =>
        rounded(a, t.hx + t.rows * t.run, t.hz + t.rows * t.run, t.r + t.rows * t.run * 0.65),
      top = t.y + t.rows * t.rise;
    rail(out, p, t.y);
    rail(out, q, top);
    for (let i = 0; i < 360; i++) {
      const a = (i * TAU) / 360,
        b = ((i + 1) * TAU) / 360;
      face(
        out,
        'concrete',
        [
          native(p(a), t.y - 0.7),
          native(p(b), t.y - 0.7),
          native(q(b), top - 0.6),
          native(q(a), top - 0.6),
        ],
        concrete,
        [0, -1, 0],
      );
    }
    if (k) {
      const low = tiers[k - 1],
        pl = (a) =>
          rounded(
            a,
            low.hx + low.rows * low.run,
            low.hz + low.rows * low.run,
            low.r + low.rows * low.run * 0.65,
          ),
        loY = low.y + low.rows * low.rise;
      for (let i = 0; i < 360; i++) {
        const a = (i * TAU) / 360,
          b = ((i + 1) * TAU) / 360;
        face(
          out,
          'glass',
          [native(pl(a), loY), native(pl(b), loY), native(p(b), t.y), native(p(a), t.y)],
          dark,
          outward(a).map((v) => -v),
        );
      }
      wall(out, p, t.y - 0.8, t.y - 0.12, 'metal', [0.1, 0.15, 0.17], 360, true);
    }
    for (let i = 0; i < 24; i++) {
      const a = ((i + 0.5) * TAU) / 24,
        row = t.rows * 0.57,
        p0 = rounded(a, t.hx + row * t.run, t.hz + row * t.run, t.r + row * t.run * 0.65),
        o = transformed(out, a, native(p0, t.y + row * t.rise));
      box(o, 'glass', [-1.6, 0.02, -0.9], [1.6, 1.5, 0.1], dark);
      box(o, 'concrete', [-1.7, 1.5, -1], [1.7, 1.76, 0.2], white);
    }
  }
  for (const side of [-1, 1]) {
    const o = transformed(out, side < 0 ? 0 : Math.PI, [0, 0, side * 131]);
    box(o, 'metal', [-10.4, 22, -0.55], [10.4, 34.5, 0.4], gray);
    box(o, 'glass', [-10, 22.4, 0.41], [10, 34.1, 0.5], [0.025, 0.035, 0.04]);
    for (const x of [-10.7, 10.7]) beam(o, 'metal', [x, 14, 0], [x, 34.5, 0], 0.3, 0.3, gray);
  }
  // Static football configuration: the retractable lower bowl covers the running track.
  wall(out, (a) => rounded(a, 46, 66, 18), -11.02, -10.3, 'concrete', concrete, 360, true);
  for (let i = 0; i < 360; i++)
    out.addTriangle(
      'concrete',
      'palette:#ffffff',
      [
        [0, -11.02, 0],
        native(rounded((i * TAU) / 360, 46, 66, 18), -11.02),
        native(rounded(((i + 1) * TAU) / 360, 46, 66, 18), -11.02),
      ],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      [0.47, 0.5, 0.48],
    );
  soccerPitch(transformed(out, 0, [0, -11, 0]));
  for (const x of [-14, 14]) {
    const o = transformed(out, Math.PI / 2, [-43, -10.9, x]);
    box(o, 'glass', [-5, 0, -0.8], [5, 2, 0.4], [0.2, 0.28, 0.3]);
    for (let k = 0; k < 13; k++) chair(o, 0, [-4.5 + k * 0.73, 0.1, 0], [0.42, 0.48, 0.5]);
  }
}
function shell(out) {
  const body = (a) => boundary(outerPlan, a).map((v) => v * 0.815),
    bodyOuter = (a) => boundary(outerPlan, a).map((v) => v * 0.85),
    bottom = (a) => boundary(outerPlan, a).map((v) => v * 0.76);
  wall(out, body, -11, 0, 'concrete', concrete, 360, true);
  for (const floor of [0, 4.5, 9.5, 15, 20.5]) {
    band(out, bottom, bodyOuter, floor);
    wall(out, bodyOuter, floor - 0.28, floor + 0.05);
  }
  for (let i = 0; i < 144; i++) {
    const a = (i * TAU) / 144,
      b = ((i + 1) * TAU) / 144,
      p = body(a),
      q = body(b);
    for (let level = 0; level < 4; level++) {
      const y = level * 5.1;
      face(
        out,
        'glass',
        [native(p, y + 0.2), native(q, y + 0.2), native(q, y + 4.85), native(p, y + 4.85)],
        level === 0 ? [0.14, 0.21, 0.23] : [0.23, 0.29, 0.3],
        outward(a),
      );
    }
    beam(out, 'concrete', native(p, 0), native(p, 21.7), 0.54, 0.65, concrete);
    for (const y of [5.1, 10.2, 15.3, 20.4]) {
      const pr = p.map((v) => v * 1.003),
        qr = q.map((v) => v * 1.003);
      face(
        out,
        'metal',
        [native(pr, y - 0.3), native(qr, y - 0.3), native(qr, y + 0.3), native(pr, y + 0.3)],
        gray,
        outward(a),
      );
    }
  }
  rail(out, bodyOuter, 21);
  const baseMasts = [...mastsPlan].sort((a, b) => Math.atan2(a[0], a[1]) - Math.atan2(b[0], b[1]));
  for (let i = 0; i < 18; i++) {
    const mp = baseMasts[i],
      a = Math.atan2(mp[0], mp[1]) + TAU / 36,
      edge = boundary(outerPlan, a),
      end = edge.map((v) => v * 0.835),
      start = edge.map((v) => v * 1.055),
      dx = start[0] - end[0],
      dz = start[1] - end[1],
      len = Math.hypot(dx, dz),
      angle = Math.atan2(dx, dz),
      o = transformed(out, angle, native(end, 0)),
      steps = 90;
    // Wide straight concrete access flights, exposed stringers and three handrails.
    for (let s = 0; s < steps; s++) {
      const u = s / steps,
        y = 19.8 * (1 - u),
        z = len * u;
      box(o, 'concrete', [-4.6, y - 0.24, z], [4.6, y, z + len / steps + 0.005], white);
    }
    for (const x of [-4.65, 0, 4.65]) {
      tube(o, 'metal', [x, 20.85, 0], [x, 1.05, len], 0.052, gray, 10);
      for (let s = 0; s <= 36; s++) {
        const u = s / 36;
        beam(
          o,
          'metal',
          [x, 19.8 * (1 - u), len * u],
          [x, 19.8 * (1 - u) + 1.05, len * u],
          0.045,
          0.045,
          gray,
        );
      }
    }
    for (const x of [-4.3, 4.3])
      beam(o, 'concrete', [x, 19.2, 0], [x, 0.05, len], 0.55, 1.05, concrete);
    box(o, 'concrete', [-4.65, 19.35, -4], [4.65, 19.8, 0], white);
    // Gate piers and ticket frontage face the surrounding forecourt.
    const gate = transformed(
      out,
      a,
      native(
        edge.map((v) => v * 1.045),
        0,
      ),
    );
    for (const x of [-7, 7])
      box(gate, 'brick', [x - 0.75, 0, -1.1], [x + 0.75, 5.3, 1.1], [0.48, 0.34, 0.24]);
    for (let j = 0; j < 7; j++) {
      const x = -5.8 + j * 1.9;
      box(gate, 'metal', [x - 0.08, 0, 1.2], [x + 0.08, 2.5, 1.35], gray);
      box(gate, 'metal', [x - 0.6, 0.9, 1.24], [x + 0.6, 1.02, 1.34], gray);
    }
    box(gate, 'metal', [-7.8, 5.1, -0.15], [7.8, 5.6, 0.15], gray);
  }
  // Twenty-two intermediate circulation bridges from the outer promenade to the middle ring.
  for (let i = 0; i < 22; i++) {
    const a = ((i + 0.42) * TAU) / 22,
      p = boundary(outerPlan, a).map((v) => v * 0.86),
      o = transformed(out, a, native(p, 4.65));
    box(o, 'concrete', [-2.2, -0.4, -7], [2.2, 0, 7], concrete);
    for (const x of [-2.25, 2.25]) {
      beam(o, 'metal', [x, 1.04, -7], [x, 1.04, 7], 0.045, 0.045, gray);
      for (let z = -7; z <= 7; z += 1.4)
        beam(o, 'metal', [x, 0, z], [x, 1.05, z], 0.04, 0.04, gray);
    }
  }
}
function roof(out) {
  const n = 360;
  // Metal suspended annulus and its independently mapped glass inner halo.
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      ao = boundary(outerPlan, a),
      bo = boundary(outerPlan, b),
      ai = boundary(glassOuterPlan, a),
      bi = boundary(glassOuterPlan, b),
      ah = boundary(openingPlan, a),
      bh = boundary(openingPlan, b);
    for (let j = 0; j < 10; j++) {
      const t = j / 10,
        u = (j + 1) / 10,
        p = ai.map((v, k) => v + (ao[k] - v) * t),
        q = bi.map((v, k) => v + (bo[k] - v) * t),
        r = bi.map((v, k) => v + (bo[k] - v) * u),
        s = ai.map((v, k) => v + (ao[k] - v) * u),
        yt = 35 - 0.9 * t,
        yu = 35 - 0.9 * u;
      face(
        out,
        'seam',
        [native(p, yt), native(q, yt), native(r, yu), native(s, yu)],
        [0.74, 0.77, 0.75],
        [0, 1, 0],
      );
      face(
        out,
        'metal',
        [
          native(p, 31 + 0.8 * t),
          native(q, 31 + 0.8 * t),
          native(r, 31 + 0.8 * u),
          native(s, 31 + 0.8 * u),
        ],
        [0.63, 0.67, 0.65],
        [0, -1, 0],
      );
    }
    face(
      out,
      'metal',
      [native(ao, 31.8), native(bo, 31.8), native(bo, 34.1), native(ao, 34.1)],
      white,
      outward(a),
    );
    // The deep roof disc has a closed inner fascia beneath the glass halo.
    face(
      out,
      'metal',
      [native(ai, 31), native(bi, 31), native(bi, 35), native(ai, 35)],
      white,
      outward(a).map((v) => -v),
    );
    for (let j = 0; j < 4; j++) {
      const t = j / 4,
        u = (j + 1) / 4,
        p = ah.map((v, k) => v + (ai[k] - v) * t),
        q = bh.map((v, k) => v + (bi[k] - v) * t),
        r = bh.map((v, k) => v + (bi[k] - v) * u),
        s = ah.map((v, k) => v + (ai[k] - v) * u);
      face(
        out,
        'glassClear',
        [
          native(p, 34.5 + 0.5 * t),
          native(q, 34.5 + 0.5 * t),
          native(r, 34.5 + 0.5 * u),
          native(s, 34.5 + 0.5 * u),
        ],
        [0.87, 0.95, 0.95],
        [0, 1, 0],
      );
    }
    if (i % 3 === 0) {
      beam(out, 'metal', native(ah, 34.4), native(ai, 34.9), 0.1, 0.17, gray);
      for (const t of [0.25, 0.5, 0.75]) {
        const p = ah.map((v, k) => v + (ai[k] - v) * t),
          q = bh.map((v, k) => v + (bi[k] - v) * t);
        beam(out, 'metal', native(p, 34.5), native(q, 34.5), 0.1, 0.12, gray);
      }
    }
  }
  // Continuous concentric underside channel joints are a major visual feature in the heritage close views.
  for (let j = 0; j < 11; j++) {
    const t = j / 10;
    curve(
      out,
      Array.from({ length: 361 }, (_, i) => {
        const a = (i * TAU) / 360,
          p = boundary(glassOuterPlan, a),
          q = boundary(outerPlan, a);
        return [p[0] + (q[0] - p[0]) * t, 30.97 + 0.8 * t, p[1] + (q[1] - p[1]) * t];
      }),
      0.045,
      [0.28, 0.33, 0.34],
    );
  }
  for (const mp of mastsPlan) {
    const a = Math.atan2(mp[0], mp[1]),
      o = transformed(out, a, native(mp, 0));
    // Slender1.6m main shafts, flanged deck connections, pointed upper ten metres and cables.
    tube(o, 'metal', [0, 0, 0], [0, 51, 0], 0.8, white, 32);
    for (const y of [1, 20.5, 31, 35, 49.2])
      tube(o, 'metal', [0, y, 0], [0, y + 0.24, 0], 0.94, gray, 32);
    lathe(
      o,
      'metal',
      [
        [51, 0.8],
        [53, 0.68],
        [56, 0.46],
        [59, 0.2],
        [61, 0.025],
      ],
      white,
      48,
    );
    for (const da of [-0.065, 0.065]) {
      const inner = boundary(glassOuterPlan, a + da),
        outer = boundary(outerPlan, a + da),
        top = native(mp, 50.8);
      tube(out, 'metal', top, native(inner, 35.2), 0.075, gray, 10);
      tube(out, 'metal', top, native(outer, 34.5), 0.075, gray, 10);
    }
    // Two side braces create the mast anchorage fan rather than a generic single stay.
    for (const da of [-0.13, 0.13]) {
      const p = boundary(outerPlan, a + da).map((v) => v * 0.93);
      tube(out, 'metal', native(mp, 49.4), native(p, 34.8), 0.057, gray, 8);
    }
  }
  for (let i = 0; i < 54; i++) {
    const a = (i * TAU) / 54,
      p = boundary(outerPlan, a);
    tube(out, 'metal', native(p, 0.1), native(p, 31.8), 0.068, gray, 10);
  }
  // Lighting banks and acoustic clusters around the glass halo.
  for (let i = 0; i < 108; i++) {
    const a = (i * TAU) / 108,
      p = boundary(openingPlan, a),
      o = transformed(out, a, native(p, 32.4));
    box(o, 'metal', [-0.65, -0.25, -0.12], [0.65, 0.3, 0.35], gray);
    box(o, 'plastic', [-0.55, -0.19, -0.16], [0.55, 0.24, -0.13], [0.93, 0.94, 0.85]);
    if (i % 3 === 0)
      for (let j = 0; j < 5; j++)
        box(o, 'glass', [-0.45, -0.9 - j * 0.42, 0.1], [0.45, -0.53 - j * 0.42, 0.6], dark);
  }
}
export function buildStadeFrance(out) {
  seating(out);
  shell(out);
  roof(out);
}
export const stadeFranceStudy = {
  id: 'N0685',
  key: 'stade_de_france',
  title: 'Stade de France',
  wikidataId: 'Q13205',
  build: buildStadeFrance,
  metricTriangleUv: true,
  smoothNormalSlots: ['trim'],
  previewGroundless: true,
  previewCamera: { position: [245, 150, 285], lookAt: [0, 16, 0] },
  visualBrief:
    'French national stadium with the true rounded elliptical suspended disc roof, eighteen mapped slender pointed masts and cable fans, concentric underside joints, transparent inner halo, eighteen monumental external stairs, intermediate access bridges, glazed concourses, three pale blue-gray seating tiers, opposite giant screens and the actual sunken football pitch.',
  dimensionsMeters: {
    roofLength: 324,
    roofWidth: 280,
    mastHeight: 61,
    mastDiameter: 1.6,
    roofSoffitAbovePitch: 42,
    pitchBelowForecourt: 11,
    pitchLength: 105,
    pitchWidth: 68,
  },
  sourceFacts: {
    basis:
      'The current operator describes18masts61m high,18 monumental stairs and three-tier modular seating. The French Ministry heritage survey directly records1.6m mast diameter, three-tier capacities and pitch11m below natural ground; its42m roof-over-pitch datum yields a31m soffit. The6ha metal roof, glass inner halo and photographed concentric underside are modeled independently. Exact OSM pitch, metal/glass polygons and18mapped mast centers determine plan. Stairs, seat rows, gates and concourse intervals are proportioned from architect and heritage photographs.',
  },
  references: [
    {
      url: 'https://www.stadefrance.com/en/stadium/our-history',
      use: 'Current operator mast count/height, stairs, movable lower bowl and architectural identity.',
    },
    {
      url: 'https://pop.culture.gouv.fr/notice/merimee/ACR0001671',
      use: 'French Ministry heritage survey:1.6m masts, pitch11m below ground,42m roof-over-pitch; photographs13/14/16 inspected for stairs, soffit and gray seating.',
    },
    {
      url: 'https://www.scau.com/fr/project/stade-de-france',
      use: 'Original architect project, southern facade photographs and large site plan directly inspected.',
    },
    {
      url: 'https://www.scau.com/administration/storage/uploads/projets/plans%20masses/plan_masse_StadeDeFrance.jpg',
      use: 'Architect site plan confirms rounded disc form, pitch orientation and18mast arrangement.',
    },
    {
      url: 'https://www.openstreetmap.org/way/64003104',
      use: 'ExactQ13205stadium outer footprint; roofrelations3009844/3009845, glass boundary64003105, aperture86922720, pitch23608423 and18mast footprints226371204..226371221.',
    },
  ],
  size: [296, 72, 342],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch center; nativeY0 is natural forecourt and the field liesY-11. Native+Z follows the mapped south-southeast goal axis.',
  },
  portableReviewBasis:
    'Portable capture is intentionally ground-free to inspect the sunken field. Geographic shared review must exercise the declared terrain cutout and restoration.',
  referencePages: [
    'https://www.stadefrance.com/en/stadium/our-history',
    'https://pop.culture.gouv.fr/notice/merimee/ACR0001671',
    'https://www.scau.com/fr/project/stade-de-france',
    'https://www.openstreetmap.org/way/64003104',
    'https://www.openstreetmap.org/way/23608423',
  ],
  referenceRights:
    'Primary photographs and plans inform original mesh geometry only. No reference pixels or downloaded model are embedded. OpenStreetMap derived geometry is attributed to contributors, ODbL1.0.',
  geographicProposal: {
    elevationMode: 'terrain-contact',
    source: 'https://www.openstreetmap.org/way/64003104',
    status: 'preview-proposal',
    anchor: [2.360129925, 48.924457475],
    heading: 0.18712760259944397,
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'NativeY0 is the published natural forecourt datum. The Ministry survey explicitly places the field11m below that ground. Ground cutter preserves the bowl while roof masts, gates and staircase feet meetY0.',
    groundCutout: {
      outline: outerPlan.map((p) => p.map((v) => v * 0.85)),
      basis:
        'Cut the body envelope beneath the three-tier bowl, not the overhanging disc. The authored perimeter contact ring covers the cut boundary while the pitch remains11m below local ground.',
    },
    featureIds: [
      'way/64003104',
      'relation/3009843',
      'relation/3009844',
      'relation/3009845',
      'way/23608423',
    ],
    notes:
      'Exact mapped pitch center and long axis control+Z south-southeast; eighteen mapped mast centers and separately mapped metal/glass roof loops establish north/south exterior placement. The architect site plan corroborates the axis. Terrain contact uses the published relative forecourt/pitch datum, not a geodetic survey.',
  },
  limitations: [
    'Static football configuration: lower retractable tier covers the track; event seating motion and changing advertisements are not modeled. The published61m mast dimension and1.6m shaft diameter are preserved; taper and connection rings are photo reconstructions. Roof top at35m and soffit31m reconcile published46m/42m roof-to-pitch descriptions; detailed metal fabrication and exact spectator inventory are not claimed. Stairs, gates and concourse bay sizes follow references but are not shop drawings. Current pale seating is modeled without transient event color overlays.',
  ],

  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-south-stairs', position: [40, 16, 177], lookAt: [6, 15, 119] },
    { name: 'near-mast-stays', position: [138, 54, 40], lookAt: [111, 42, 21] },
    { name: 'near-concentric-soffit', position: [120, 15, 53], lookAt: [114, 31, 25] },
    { name: 'near-three-tiers', position: [0, -7, 26], lookAt: [96, 13, 0] },
    { name: 'near-glass-halo', position: [63, 54, 60], lookAt: [34, 23, 53] },
    { name: 'far-open-bowl', position: [-170, 290, 250], lookAt: [0, 15, 0] },
  ],
};
