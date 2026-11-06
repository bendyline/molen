import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [-68.755375264, -39.26844115],
  heading: -1.08311936681,
  datum: 369.79602450000004,
  crest: 386,
  foundation: 300,
  crestLength: 2103.655,
  roadIds: [35184560449412, 35185554482137, 35185045751704],
  stages: {
    normalMax: 380.31,
    normalMin: 372,
    extraordinaryMin: 367,
  },
  stations: [
    [-938.19, 310.18, 382.8257, 0.96, 0.2801, 14, 379.5257, 12, 380],
    [-930.52, 283.89, 386, 0.9629, 0.2697, 178, 380.369, 115, 380],
    [-874.96, 84.41, 386, 0.9627, 0.2705, 36.5424, 372.3835, 28.9862, 377.5788],
    [-869.47, 66.65, 386, 0.9353, 0.3537, 39.7312, 371.6145, 29.5571, 377.2065],
    [-857.4, 37.98, 386, 0.8916, 0.4528, 46.9592, 368.4482, 30.0928, 377.2743],
    [-840.05, 8.72, 386, 0.8355, 0.5496, 52.0814, 363.4428, 29.9704, 376.9258],
    [-824.99, -11.29, 386, 0.7819, 0.6235, 55.3517, 359.762, 29.4314, 376.9068],
    [-816.59, -20.7, 386, 0.7094, 0.7048, 57.504, 358.5935, 29.1581, 377.2091],
    [-798.6, -37.85, 386, 0.6553, 0.7554, 59.0138, 359.0763, 28.9682, 378.5164],
    [-778.78, -53.5, 386, 0.6003, 0.7998, 57.4262, 359.3648, 29.2705, 378.497],
    [-768.17, -60.69, 386, 0.5255, 0.8508, 55.9578, 360.0514, 29.1862, 378.1488],
    [-746.87, -73.21, 386, 0.4828, 0.8757, 55.0035, 360.538, 29.7508, 378.9308],
    [-735.99, -78.43, 386, 0.3825, 0.924, 55.8949, 359.7136, 29.7026, 379.2838],
    [-713.34, -87.09, 386, 0.3395, 0.9406, 59.4326, 359.8604, 29.5975, 380],
    [-701.36, -90.93, 386, 0.2509, 0.968, 62.8994, 359.8429, 29.4911, 380],
    [-677.23, -96.45, 386, 0.2003, 0.9797, 66.9291, 357.5951, 28.4775, 380],
    [-664.67, -98.43, 386, 0.1019, 0.9948, 68.5139, 357.4211, 28.0831, 380],
    [-638.77, -100.39, 386, 0.0547, 0.9985, 70.0381, 359.0243, 27.1056, 379.6392],
    [-626.67, -100.51, 386, -0.0482, 0.9988, 70.016, 360.2488, 26.9073, 379.2465],
    [-600.24, -98.53, 386, -0.1349, 0.9909, 69.3565, 362.2377, 26.2084, 379.1091],
    [-572.25, -93.1, 386, -0.2412, 0.9705, 69.5365, 362.2544, 26.2463, 377.7953],
    [-547.3, -85.37, 386, -0.3509, 0.9364, 70.5534, 360.5371, 27.476, 371.5722],
    [-521.82, -74.2, 386, -0.4238, 0.9058, 72.0774, 359.4449, 28.9936, 371.664],
    [-509.77, -67.81, 386, -0.4899, 0.8718, 72.8684, 358.4715, 29.2982, 371.7135],
    [-497.03, -60.27, 386, -0.5478, 0.8366, 73.1537, 357.016, 29.6859, 371.7706],
    [-485.595, -51.98, 386, -0.587, 0.8096, 73.0965, 355.7327, 29.1358, 373.0441],
    [-474.16, -43.69, 386, -0.6061, 0.7954, 178, 338.6763, 29.2424, 372.8302],
    [-457.7967, -30.7956, 386, -0.6189, 0.7854, 127.4561, 325.3, 28.8725, 371.9819],
    [-441.4333, -17.9011, 386, -0.6189, 0.7854, 127.4397, 325.3, 28.5898, 370.927],
    [-425.07, -5.0067, 386, -0.6189, 0.7854, 127.4233, 325.3, 28.3265, 371.2517],
    [-408.7067, 7.8878, 386, -0.6189, 0.7854, 127.4069, 325.3, 28.4794, 373.5708],
    [-392.3433, 20.7822, 386, -0.6189, 0.7854, 127.3905, 325.3, 28.6323, 377.1769],
    [-375.98, 33.6767, 386, -0.6189, 0.7854, 127.3741, 325.3, 28.7851, 379.0345],
    [-359.6167, 46.5711, 386, -0.6189, 0.7854, 127.3577, 325.3, 28.938, 380],
    [-343.2533, 59.4656, 386, -0.6189, 0.7854, 127.3413, 325.3, 29.0939, 380],
    [-326.89, 72.36, 386, -0.6172, 0.7868, 127.3254, 325.3, 29.2461, 380],
    [-310.4225, 85.2175, 386, -0.6154, 0.7882, 127.2167, 325.3, 29.4924, 380],
    [-293.955, 98.075, 386, -0.6154, 0.7882, 127.1067, 325.3, 29.738, 379.4739],
    [-277.4875, 110.9325, 386, -0.6154, 0.7882, 126.9968, 325.3, 29.9836, 374.938],
    [-261.02, 123.79, 386, -0.5883, 0.8086, 129.4084, 336.9366, 29.9965, 373.5222],
    [-238.03, 139.64, 386, -0.5403, 0.8415, 131.3941, 332.1475, 30.286, 369.962],
    [-214.17, 153.87, 386, -0.4752, 0.8799, 133.3244, 327.3738, 30.0903, 369.9422],
    [-183.72, 168.97, 386, -0.4243, 0.9055, 134.8704, 321.3588, 29.1794, 369.9883],
    [-167.65, 175.67, 386, -0.3623, 0.9321, 135.2204, 320.7696, 28.6519, 370.0269],
    [-150.53, 181.87, 386, -0.3131, 0.9497, 135.3989, 320.604, 28.241, 370.0532],
    [-132.46, 187.27, 386, -0.2658, 0.964, 135.4802, 321.3848, 28.2579, 370.3859],
    [-113.54, 192.07, 386, -0.2248, 0.9744, 135.3438, 322.9257, 28.355, 371.1328],
    [-94.92, 195.93, 386, -0.1843, 0.9829, 134.9093, 324.3229, 28.6992, 371.6918],
    [-76.9, 198.94, 386, -0.1445, 0.9895, 134.6995, 325.5112, 28.5971, 373.0003],
    [-60.19, 201, 386, -0.0723, 0.9974, 134.4581, 326.1317, 28.4787, 372.6561],
    [-27.76, 202.5, 386, 0.0095, 1, 134.0735, 327.6499, 28.7832, 372.9746],
    [189.9, 198.63, 386, 0.0168, 0.9999, 134.8446, 327.9814, 28.9254, 372.5224],
    [615.36, 191.68, 386, 0.0185, 0.9998, 137.5109, 339.5025, 28.3986, 371.7986],
    [642.8, 190.27, 386, 0.0849, 0.9964, 112.6804, 356.0273, 27.7701, 371.6189],
    [674.01, 186.68, 386, 0.1351, 0.9908, 36.2917, 372.3298, 36.3641, 370.4972],
    [687.92, 184.12, 386, 0.2188, 0.9758, 108, 363.4893, 69.8118, 369.1773],
    [723.6, 175.56, 386, 0.2302, 0.9731, 108, 362.1529, 50.7813, 368.981],
    [816.87, 153.61, 386, 0.2291, 0.9734, 20.0631, 365.5805, 34.641, 376.8758],
  ],
  embankmentStop: 56,
  spillway: {
    a: [723.6, 175.56],
    b: [816.87, 153.61],
    bays: 4,
  },
  plant: {
    a: [-340.6, -162.2],
    b: [-172.6, -29.6],
    depth: 41,
    units: 6,
  },
  intake: {
    a: [-463.64, 69.69],
    b: [-337.93, 170.13],
    width: 13,
    walk: [
      [-400.94, 119.7],
      [-349.43, 54.65],
    ],
  },
};
const palette = {
  rock: { slot: 'foundation', graph: 'stone_basalt_raw', rgb: [0.305, 0.254, 0.215] },
  earth: { slot: 'foundation', graph: 'earth_rammed', rgb: [0.532, 0.405, 0.32] },
  deck: { slot: 'trim', graph: 'concrete_plain', rgb: [0.456, 0.442, 0.416] },
  concrete: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.582, 0.553, 0.504] },
  apron: { slot: 'foundation', graph: 'concrete_panel', rgb: [0.438, 0.407, 0.363] },
  rail: { slot: 'trim', graph: 'metal_painted', rgb: [0.224, 0.324, 0.312] },
  gate: { slot: 'trim', graph: 'metal_painted', rgb: [0.185, 0.255, 0.286] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.54, 0.558, 0.535] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.196, 0.293, 0.321] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...v }]) => [k, v]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { datum, stations, spillway, plant, intake } = controls;
const p = (x, y, z) => [x, y - datum, z];
const rod = (o, m, a, b, w, h) => beam(o, m, a, b, w, h, palette[m].rgb);
function face(o, m, pts, direction, shade = 1) {
  let n = normalFor(...pts);
  if (n.reduce((v, a, i) => v + a * direction[i], 0) < 0) {
    pts = pts.toReversed();
    n = normalFor(...pts);
  }
  const add = pts.length === 3 ? o.addTriangle : o.addQuad;
  add.call(
    o,
    m,
    'palette:#ffffff',
    pts,
    n,
    undefined,
    palette[m].rgb.map((v) => v * shade),
  );
}
function quad(o, m, a, b, c, d, n, shade) {
  // The swept profile can twist through a crest bend. Give each triangle its own normal.
  face(o, m, [a, b, c], n, shade);
  face(o, m, [a, c, d], n, shade);
}
export function stationPoint(i, lateral, elevation) {
  const [x, z, , nx, nz] = stations[i];
  return p(x + lateral * nx, elevation, z + lateral * nz);
}
function embankment(o, tier) {
  const end = controls.embankmentStop;
  const skip = [4, 2, 1, 1, 1][tier];
  const ids = [...Array.from({ length: end }, (_, i) => i).filter((i) => i % skip === 0), end];
  const section = (i) => {
    const [, , h, , , down, dy, up, uy] = stations[i];
    const benchWidth = Math.max(0, down - 10.3),
      benchY = h + (dy - h) * 0.52;
    const buried = uy - 43;
    return [
      [-down, dy],
      [-10.3 - benchWidth * 0.52, benchY],
      [-8.3 - benchWidth * 0.52, benchY],
      [-7.2, h - 0.25],
      [7.2, h - 0.25],
      [up, uy],
      [up + 67, buried],
    ];
  };
  for (let k = 1; k < ids.length; k++) {
    const a = ids[k - 1],
      b = ids[k],
      A = section(a),
      B = section(b);
    for (let j = 1; j < A.length; j++) {
      const m = j === 2 ? 'earth' : j === 4 ? 'deck' : 'rock';
      const toward = [0, 1, 0],
        shade = 0.96 + (k % 5) * 0.019;
      quad(
        o,
        m,
        stationPoint(a, ...A[j - 1]),
        stationPoint(b, ...B[j - 1]),
        stationPoint(b, ...B[j]),
        stationPoint(a, ...A[j]),
        toward,
        shade,
      );
    }
  }
  // Low terrain skirt is concealed in the ground or under the reservoir.
  for (const i of [ids[0], ids.at(-1)]) {
    const S = section(i),
      direction = i === 0 ? [-1, 0, 0] : [1, 0, 0];
    for (let j = 1; j < S.length; j++) {
      const [a, h] = S[j - 1],
        [b, k] = S[j];
      quad(
        o,
        'rock',
        stationPoint(i, a, 300),
        stationPoint(i, b, 300),
        stationPoint(i, b, k),
        stationPoint(i, a, h),
        direction,
      );
    }
  }
}
function crestRoad(o, tier) {
  for (let i = 1; i < stations.length; i++) {
    const a = i - 1,
      b = i,
      ay = stations[a][2],
      by = stations[b][2];
    const point = (j, z, h) => stationPoint(j, z, stations[j][2] + h);
    quad(
      o,
      'deck',
      point(a, -5.8, 0),
      point(b, -5.8, 0),
      point(b, 5.8, 0),
      point(a, 5.8, 0),
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const z = side * 5.8;
      if (tier > 0)
        quad(
          o,
          'concrete',
          point(a, z, -0.65),
          point(b, z, -0.65),
          point(b, z, 0.15),
          point(a, z, 0.15),
          [0, 0, side],
        );
      if (tier > 0) rod(o, 'rail', point(a, z, 1.13), point(b, z, 1.13), 0.105, 0.122);
      if (tier > 1) {
        const [x, s] = stations[a],
          [X, S] = stations[b],
          n = Math.ceil(Math.hypot(X - x, S - s) / (tier > 2 ? 8 : 19));
        const A = point(a, z, 0.12),
          B = point(b, z, 0.12);
        for (let j = 0; j < n; j++) {
          const q = A.map((v, k) => v + ((B[k] - v) * j) / n);
          rod(o, 'rail', q, [q[0], q[1] + 1.01, q[2]], 0.088, 0.09);
        }
      }
    }
    if (tier >= 3 && Math.abs(ay - by) < 1.1) {
      const A = point(a, 0, 0.027),
        B = point(b, 0, 0.027);
      rod(o, 'concrete', A, B, 0.091, 0.027);
    }
  }
}
function frame(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    at: (x, y, z) => p(a[0] + dx * x - dz * z, y, a[1] + dz * x + dx * z),
    along: [dx, 0, dz],
    normal: [-dz, 0, dx],
  };
}
function block(o, m, f, a, b, y, h, z, w) {
  const at = (x, v) => f.at(x, y, v),
    top = (x, v) => f.at(x, y + h, v);
  const { along, normal } = f,
    opposite = (n) => n.map((v) => -v);
  quad(o, m, top(a, z), top(b, z), top(b, z + w), top(a, z + w), [0, 1, 0]);
  quad(o, m, at(a, z), at(b, z), at(b, z + w), at(a, z + w), [0, -1, 0]);
  quad(o, m, at(a, z), at(b, z), top(b, z), top(a, z), opposite(normal));
  quad(o, m, at(a, z + w), at(b, z + w), top(b, z + w), top(a, z + w), normal);
  quad(o, m, at(a, z), at(a, z + w), top(a, z + w), top(a, z), opposite(along));
  quad(o, m, at(b, z), at(b, z + w), top(b, z + w), top(b, z), along);
}
const chuteRows = [
  [0, 365, 0],
  [-22, 351, -0.9],
  [-49, 335, -1.5],
  [-86, 326, -2],
  [-129, 323, -3.4],
  [-175, 321, -4.9],
  [-219, 319, -6.3],
  [-257, 318, -8.2],
];
export function spillwayFrame() {
  return frame(spillway.a, spillway.b);
}
function gates(o, tier) {
  const f = spillwayFrame(),
    pitch = f.length / spillway.bays;
  const at = f.at;
  block(o, 'concrete', f, -3, f.length + 4, 382.8, 3.1, -6.7, 13.4);
  const path = tier === 0 ? chuteRows.filter((_, i) => [0, 2, 4, 7].includes(i)) : chuteRows;
  for (let i = 0; i <= spillway.bays; i++) {
    const x = i * pitch;
    block(o, 'concrete', f, x - 1.8, x + 1.8, 351, 35, -16, 32);
    for (let j = 1; j < path.length; j++) {
      const [z, y, s] = path[j - 1],
        [Z, Y, S] = path[j],
        h = j > 4 ? 1.5 : 7.3 - j * 0.67;
      if (i < spillway.bays) {
        quad(
          o,
          'apron',
          at(x + 1.45 + s, y, z),
          at(x + pitch - 1.45 + s, y, z),
          at(x + pitch - 1.45 + S, Y, Z),
          at(x + 1.45 + S, Y, Z),
          [0, 1, 0],
          0.95 + (i % 3) * 0.04,
        );
      }
      const top = (u, H, v) => at(u, H + h, v);
      for (const sign of [-1, 1]) {
        const shift = sign * 1.4;
        quad(
          o,
          'concrete',
          at(x + shift + s, y, z),
          at(x + shift + S, Y, Z),
          top(x + shift + S, Y, Z),
          top(x + shift + s, y, z),
          f.along.map((v) => v * sign),
        );
      }
      quad(
        o,
        'deck',
        top(x + s - 1.4, y, z),
        top(x + s + 1.4, y, z),
        top(x + S + 1.4, Y, Z),
        top(x + S - 1.4, Y, Z),
        [0, 1, 0],
      );
    }
    if (i === spillway.bays) continue;
    const left = x + 1.65,
      right = x + pitch - 1.65;
    const bands = tier < 2 ? 2 : 5;
    for (let j = 0; j < bands; j++) {
      const y = 365 + (j * 17) / bands,
        Y = 365 + ((j + 1) * 17) / bands;
      const curve = (h) => 2.5 + 5.1 * Math.sin(((h - 365) / 17) * Math.PI * 0.61);
      for (const sign of [-1, 1])
        quad(
          o,
          'gate',
          at(left, y, curve(y) + sign * 0.09),
          at(right, y, curve(y) + sign * 0.09),
          at(right, Y, curve(Y) + sign * 0.09),
          at(left, Y, curve(Y) + sign * 0.09),
          f.normal.map((v) => v * sign),
        );
      if (tier > 1)
        rod(o, 'rail', at(left, Y, curve(Y) - 0.18), at(right, Y, curve(Y) - 0.18), 0.34, 0.36);
    }
    if (tier > 1)
      for (const x0 of [left + 1.15, right - 1.15]) {
        rod(o, 'rail', at(x0, 365, 2.3), at(x0, 372, -12), 0.47, 0.52);
        rod(o, 'rail', at(x0, 381, 7.2), at(x0, 372, -12), 0.39, 0.43);
      }
  }
  for (const side of [-1, 1]) {
    const x = side < 0 ? -4.6 : f.length + 4.6;
    block(o, 'concrete', f, x - 2, x + 2, 342, 43, -27, 41);
    if (tier > 0) block(o, 'roof', f, x - 3.1, x + 3.1, 385.1, 5.8, -7.9, 8.1);
  }
}
function powerhouse(o, tier) {
  const f = frame(plant.a, plant.b),
    L = f.length,
    at = f.at;
  block(o, 'concrete', f, 0, L, 310, 12, -2, plant.depth + 3);
  block(o, 'concrete', f, 0.9, L - 1, 322, 12, 0, plant.depth);
  block(o, 'roof', f, -0.2, L + 0.2, 334, 1.15, -0.45, plant.depth + 1);
  const units = tier === 0 ? 3 : plant.units;
  for (let i = 0; i < units; i++) {
    const a = (i * L) / units,
      b = ((i + 1) * L) / units;
    for (const [z, n] of [
      [-0.045, -1],
      [plant.depth + 0.05, 1],
    ]) {
      quad(
        o,
        'glass',
        at(a + 1.2, 325, z),
        at(b - 1.2, 325, z),
        at(b - 1.2, 332.2, z),
        at(a + 1.2, 332.2, z),
        f.normal.map((v) => v * n),
      );
    }
    block(o, 'apron', f, a + 2.2, b - 2.2, 312.2, 6.2, -4.3, 2.4);
    if (tier > 1)
      for (const t of [0.25, 0.5, 0.75])
        rod(
          o,
          'rail',
          at(a + (b - a) * t, 324.9, -0.13),
          at(a + (b - a) * t, 332.25, -0.13),
          0.095,
          0.106,
        );
  }
  for (const t of [0.2, 0.48, 0.76]) {
    const x = L * t,
      w = 23,
      z = 15;
    for (const side of [-1, 1]) {
      rod(o, 'deck', at(x + (side * w) / 2, 335, z), at(x + (side * w) / 2, 356, z), 0.8, 0.74);
      if (tier > 0)
        rod(o, 'deck', at(x + (side * w) / 2, 336, z), at(x - side * w * 0.22, 350, z), 0.47, 0.52);
    }
    rod(o, 'deck', at(x - w / 2, 350, z), at(x + w / 2, 350, z), 0.65, 0.71);
    if (tier === 4)
      for (const side of [-1, 1]) {
        rod(o, 'rail', at(x + side * 8.2, 350.3, z), at(x + side * 8.2, 348.2, z), 0.12, 0.13);
        rod(o, 'rail', at(x + side * 4.7, 350.3, z), at(x + side * 4.7, 347.8, z), 0.12, 0.13);
      }
  }
  quad(
    o,
    'apron',
    at(0, 312.85, 0),
    at(L, 312.85, 0),
    at(L, 312.85, -52),
    at(0, 312.85, -52),
    [0, 1, 0],
  );
  for (const x of [0, L]) rod(o, 'concrete', at(x, 320, -1), at(x, 320, -52), 4.6, 7.2);
}
function intakeWorks(o, tier) {
  const f = frame(intake.a, intake.b),
    L = f.length,
    at = f.at;
  block(o, 'concrete', f, 0, L, 357, 26.9, 0, intake.width);
  block(o, 'deck', f, -0.4, L + 0.4, 383.8, 1.1, -0.4, intake.width + 0.8);
  for (let i = 0; i < 6; i++) {
    const w = L / 6,
      a = (i + 0.12) * w,
      b = (i + 0.89) * w;
    block(o, 'gate', f, a, b, 368.2, 10.6, intake.width - 0.04, 0.27);
    if (tier > 1)
      for (let j = 1; j < 5; j++) {
        const x = a + ((b - a) * j) / 5;
        rod(
          o,
          'rail',
          at(x, 368.5, intake.width + 0.26),
          at(x, 378.4, intake.width + 0.26),
          0.12,
          0.15,
        );
      }
  }
  for (const x of [9, L * 0.57, L - 10]) {
    for (const sign of [-1, 1])
      rod(o, 'deck', at(x + sign * 2.05, 384.8, 5), at(x + sign * 2.05, 391.8, 5), 0.55, 0.62);
    rod(o, 'deck', at(x - 2.7, 391.8, 5), at(x + 2.7, 391.8, 5), 2.7, 0.81);
  }
  const [[a, z], [b, Z]] = intake.walk;
  const route = frame(intake.walk[0], intake.walk[1]);
  rod(o, 'concrete', p(a, 384.7, z), p(b, 385.75, Z), 6.3, 1.45);
  if (tier > 0)
    for (const side of [-1, 1]) {
      rod(
        o,
        'rail',
        route.at(0, 386.5, side * 2.9),
        route.at(route.length, 387.1, side * 2.9),
        0.08,
        0.1,
      );
    }
}
export function buildDamLevel(o, name) {
  const tier = levels[name];
  if (tier === undefined) throw Error('Unknown El Chocon tier: ' + name);
  embankment(o, tier);
  crestRoad(o, tier);
  gates(o, tier);
  powerhouse(o, tier);
  intakeWorks(o, tier);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');
