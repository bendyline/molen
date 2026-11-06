import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [38.747195011, 35.885219106],
  heading: 2.782194682538,
  datum: 253.04405774999998,
  crest: [
    [-1117.06247, 0, 260],
    [-1080, 0.08, 262.2],
    [-1035, 0.19, 263.35],
    [-990, 0.32, 261.6],
    [-945, 0.46, 259.2],
    [-865, 1, 259.4],
    [-705, -1, 259.4],
    [-354, -2, 259.2],
    [-171, -4, 259.1],
    [34, -3, 259],
    [415, -4, 259.2],
    [888, -2, 259.7],
    [1006, -2, 260],
    [1175, -5, 260],
    [1447.75481, 0, 258.35],
  ],
  spillway: {
    span: [-415, -318],
    gates: 5,
    apronEnd: 77,
    gateCountStatus: 'exterior interpretation',
  },
  plant: [
    [-1083.18451, 23.45208],
    [-980.09567, 22.70918],
    [-979.76828, 47.65379],
    [-1082.85709, 48.39678],
  ],
  plantApron: {
    facadeGrade: 256.05,
    outerEdge: [
      [-1088, 70, 257.9],
      [-1050, 69, 258.9],
      [-1010, 69, 256.6],
      [-976, 68, 255.6],
    ],
    sideTies: [
      [
        [-1090, 47, 259.53],
        [-1094, 71, 257.42],
      ],
      [
        [-972, 46, 256.52],
        [-969, 68, 255.34],
      ],
    ],
    rearTies: [
      [-1090, 23, 259.66],
      [-972, 22, 257.84],
    ],
  },
  tailrace: { span: [-973, -842], mouth: 34 },
};
const C = {
  wall: [0.43, 0.39, 0.33],
  trim: [0.61, 0.55, 0.45],
  dark: [0.19, 0.21, 0.19],
  road: [0.29, 0.29, 0.27],
  rock: [0.45, 0.39, 0.29],
  roof: [0.35, 0.39, 0.4],
  rust: [0.46, 0.19, 0.1],
  steel: [0.42, 0.42, 0.38],
  glass: [0.23, 0.3, 0.32],
  green: [0.3, 0.34, 0.31],
};
export const damSurfaces = {
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  trim: { slot: 'wall', graph: 'concrete_plain' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  rock: { slot: 'foundation', graph: 'gravel' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
  rust: { slot: 'door', graph: 'metal_painted' },
  steel: { slot: 'door', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
  green: { slot: 'door', graph: 'metal_painted' },
};
const quality = {
  skyline: {},
  district: { gates: true },
  street: { gates: true, details: true, lamps: 76 },
  closeup: { gates: true, details: true, fine: true, lamps: 50 },
  master: { gates: true, details: true, fine: true, lamps: 44 },
};
const { crest, datum, plant, spillway, tailrace } = controls;
const y = (v) => v - datum,
  foot = y(244),
  roadHalfWidth = 4.6;
const lerp = (a, b, t) => a + (b - a) * t;
function station(x) {
  const i = crest.findIndex(([u]) => u >= x);
  if (i < 1)
    return [
      x,
      y(crest[i === 0 ? 0 : crest.length - 1][2]),
      crest[i === 0 ? 0 : crest.length - 1][1],
    ];
  const [a, z, h] = crest[i - 1],
    [b, w, k] = crest[i],
    t = (x - a) / (b - a);
  return [x, y(lerp(h, k, t)), lerp(z, w, t)];
}
function face(out, points, m, dir) {
  let normal = normalFor(...points);
  if (normal.reduce((v, n, i) => v + n * dir[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(m, 'palette:#ffffff', points, normal, undefined, C[m]);
  else out.addQuad(m, 'palette:#ffffff', points, normal, undefined, C[m]);
}
const rod = (out, m, a, b, w = 0.21, d = 0.21) => beam(out, m, a, b, w, d, C[m]);
function box(out, a, b, lo, hi, z, w, m) {
  face(
    out,
    [
      [a, lo, z],
      [b, lo, z],
      [b, hi, z],
      [a, hi, z],
    ],
    m,
    [0, 0, -1],
  );
  face(
    out,
    [
      [a, lo, w],
      [b, lo, w],
      [b, hi, w],
      [a, hi, w],
    ],
    m,
    [0, 0, 1],
  );
  face(
    out,
    [
      [a, hi, z],
      [b, hi, z],
      [b, hi, w],
      [a, hi, w],
    ],
    m,
    [0, 1, 0],
  );
  face(
    out,
    [
      [a, lo, z],
      [b, lo, z],
      [b, lo, w],
      [a, lo, w],
    ],
    m,
    [0, -1, 0],
  );
  face(
    out,
    [
      [a, lo, z],
      [a, hi, z],
      [a, hi, w],
      [a, lo, w],
    ],
    m,
    [-1, 0, 0],
  );
  face(
    out,
    [
      [b, lo, z],
      [b, hi, z],
      [b, hi, w],
      [b, lo, w],
    ],
    m,
    [1, 0, 0],
  );
}
const stations = [...crest.map(([x]) => x), ...spillway.span, ...tailrace.span].sort(
  (a, b) => a - b,
);
function deck(out, detail) {
  for (let i = 1; i < stations.length; i++) {
    const [x, h, z] = station(stations[i - 1]),
      [u, k, w] = station(stations[i]),
      half = roadHalfWidth;
    face(
      out,
      [
        [x, h, z - half],
        [u, k, w - half],
        [u, k, w + half],
        [x, h, z + half],
      ],
      'road',
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const a = z + side * half,
        b = w + side * half;
      face(
        out,
        [
          [x, h - 0.65, a],
          [u, k - 0.65, b],
          [u, k, b],
          [x, h, a],
        ],
        'wall',
        [0, 0, side],
      );
      if (detail.gates) rod(out, 'trim', [x, h + 0.16, a], [u, k + 0.16, b], 0.32, 0.36);
    }
    const controlled =
      (spillway.span[0] <= x && u <= spillway.span[1]) ||
      (tailrace.span[0] <= x && u <= tailrace.span[1]);
    const rear = controlled ? 9 : 23;
    face(
      out,
      [
        [x, foot, z - 22],
        [u, foot, w - 22],
        [u, k - 0.65, w - half],
        [x, h - 0.65, z - half],
      ],
      'rock',
      [0, 1, -1],
    );
    face(
      out,
      [
        [x, h - 0.65, z + half],
        [u, k - 0.65, w + half],
        [u, foot, w + rear],
        [x, foot, z + rear],
      ],
      controlled ? 'wall' : 'rock',
      [0, 1, 1],
    );
  }
  for (const [end, side] of [
    [stations[0], -1],
    [stations.at(-1), 1],
  ]) {
    const [x, h, z] = station(end);
    face(
      out,
      [
        [x, foot, z - 22],
        [x, h, z - roadHalfWidth],
        [x, h, z + roadHalfWidth],
        [x, foot, z + 23],
      ],
      'rock',
      [side, 0, 0],
    );
  }
  if (detail.lamps)
    for (let x = stations[0] + 31; x < stations.at(-1) - 17; x += detail.lamps) {
      const [u, h, z] = station(x),
        a = [u, h, z - 4.2],
        b = [u, h + 5.7, z - 4.2],
        c = [u, h + 6.35, z - 3.65],
        d = [u, h + 6.51, z - 2.68];
      rod(out, 'steel', a, b, 0.12, 0.13);
      rod(out, 'steel', b, c, 0.105, 0.1);
      rod(out, 'steel', c, d, 0.1, 0.1);
      rod(out, 'trim', d, [u + 0.34, d[1] - 0.08, d[2] + 0.15], 0.18, 0.16);
    }
}
function gateWorks(out, detail) {
  const [a, b] = spillway.span,
    bay = (b - a) / spillway.gates;
  const sill = y(248),
    head = y(256.9),
    crown = y(259.0),
    toe = y(246.1);
  box(out, a, b, foot, sill, 8, 25, 'wall');
  box(out, a, b, head, crown, 10, 18.5, 'wall');
  box(out, a, b, foot, toe, 25, spillway.apronEnd, 'wall');
  for (let i = 0; i < spillway.gates; i++) {
    const x = a + i * bay,
      u = x + 2.5,
      v = x + bay;
    box(out, x, u, sill, head, 10.2, 28.6, 'wall');
    box(out, u, v, sill + 0.18, head - 0.2, 11.2, 11.65, 'rust');
    face(
      out,
      [
        [u, sill, 25],
        [v, sill, 25],
        [v, toe, 76],
        [u, toe, 76],
      ],
      'trim',
      [0, 1, 1],
    );
    if (detail.gates) {
      const hi = y(257.3),
        lo = toe + 0.2;
      face(
        out,
        [
          [x, hi, 18.4],
          [u, hi, 18.4],
          [u, lo, 47],
          [x, lo, 47],
        ],
        'trim',
        [0, 1, 1],
      );
      for (const [p, side] of [
        [x, -1],
        [u, 1],
      ])
        face(
          out,
          [
            [p, hi, 18.4],
            [p, lo, 47],
            [p, lo, 18.4],
          ],
          'wall',
          [side, 0, 0],
        );
      box(out, x + 0.38, u - 0.4, head - 0.15, head + 2.4, 17.7, 22.5, 'rust');
      rod(out, 'steel', [u, sill + 0.18, 11.9], [v - 0.25, sill + 0.18, 11.9], 0.35, 0.35);
    }
  }
  box(out, b - 2.2, b, foot, head, 10, 45, 'wall');
  for (const [x, side] of [
    [a, -1],
    [b, 1],
  ]) {
    const e = x + side * 2.65;
    box(out, Math.min(x, e), Math.max(x, e), foot, y(252), 21, 78, 'wall');
  }
  if (detail.gates) {
    const x = a + 69,
      z = 20,
      crown = y(269.2);
    for (const d of [-5.4, 5.4])
      for (const v of [-2.25, 2.25])
        rod(out, 'green', [x + d, y(257.9), z + v], [x + d, crown - 0.92, z + v], 0.45, 0.53);
    box(out, x - 6.4, x + 6.4, crown - 1.2, crown, z - 2.9, z + 2.9, 'green');
    box(out, x - 2.6, x + 2.6, crown, crown + 1.45, z - 1.4, z + 1.4, 'roof');
    if (detail.fine)
      for (let x = a + 2; x < b - 1; x += 2.45)
        rod(out, 'steel', [x, y(259.1), 4.6], [x, y(260.75), 4.6], 0.1, 0.1);
  }
}
function stationHouse(out, detail) {
  const quad = (h) => plant.map(([x, z]) => [x, h, z]);
  const base = quad(foot),
    eaves = quad(y(261.1)),
    roof = quad(y(261.65));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      dx = base[j][0] - base[i][0],
      dz = base[j][2] - base[i][2],
      dir = [dz, 0, -dx];
    face(out, [base[i], base[j], eaves[j], eaves[i]], 'wall', dir);
    face(out, [eaves[i], eaves[j], roof[j], roof[i]], 'trim', dir);
  }
  face(out, base, 'wall', [0, -1, 0]);
  face(out, roof, 'roof', [0, 1, 0]);
  const [q, r] = [plant[3], plant[2]];
  const apron = controls.plantApron;
  const inner = ([x, z]) => [x, y(apron.facadeGrade), z - 0.03];
  const edge = apron.outerEdge.map(([x, z, h]) => [x, y(h), z]);
  const [a0, a1, a2, a3] = edge;
  const [v0, v3] = [inner(q), inner(r)];
  const v1 = v0.map((v, i) => lerp(v, v3[i], 0.32)),
    v2 = v0.map((v, i) => lerp(v, v3[i], 0.69));
  for (const [a, b, c, d] of [
    [v0, v1, a1, a0],
    [v1, v2, a2, a1],
    [v2, v3, a3, a2],
  ]) {
    face(out, [a, b, c], 'road', [0, 1, 0]);
    face(out, [a, c, d], 'road', [0, 1, 0]);
    const floor = (p) => [p[0], foot, p[2]];
    face(out, [floor(a), floor(b), floor(c)], 'wall', [0, -1, 0]);
    face(out, [floor(a), floor(c), floor(d)], 'wall', [0, -1, 0]);
    face(out, [d, c, floor(c), floor(d)], 'wall', [0, 0, 1]);
  }
  for (const [a, b, i] of [
    [v0, a0, 0],
    [v3, a3, 1],
  ]) {
    const [c, d] = apron.sideTies[i].map(([x, z, h]) => [x, y(h), z]);
    const [x, z, h] = apron.rearTies[i];
    const e = [x, y(h), z],
      f = [plant[i][0], y(h), plant[i][1]];
    face(out, [a, b, d], 'rock', [0, 1, 0]);
    face(out, [a, d, c], 'rock', [0, 1, 0]);
    face(out, [a, c, e], 'rock', [0, 1, 0]);
    face(out, [a, e, f], 'rock', [0, 1, 0]);
    face(out, [c, d, [d[0], foot, d[2]], [c[0], foot, c[2]]], 'wall', [i === 0 ? -1 : 1, 0, 0]);
  }
  if (detail.gates) {
    for (let i = 0; i < 12; i++) {
      const p = (i + 0.5) / 12,
        u = p - 0.029,
        v = p + 0.029;
      const g = (t, h) => [lerp(q[0], r[0], t), y(h), lerp(q[1], r[1], t) + 0.047];
      face(out, [g(u, 257.25), g(v, 257.25), g(v, 260.05), g(u, 260.05)], 'glass', [0, 0, 1]);
      if (detail.details) rod(out, 'trim', g(p, 257.25), g(p, 260.05), 0.14, 0.16);
    }
  }
  const [a, b] = tailrace.span,
    bay = (b - a) / 3;
  box(out, a, b, foot, y(246.7), 14, tailrace.mouth, 'wall');
  box(out, a, b, y(251.3), y(256.4), 10, tailrace.mouth, 'wall');
  for (let i = 0; i < 3; i++) {
    const x = a + i * bay;
    box(out, x, x + 3.2, y(246.7), y(251.3), 10, tailrace.mouth, 'wall');
    box(out, x + 3.2, x + bay, y(246.7), y(251.3), 13, 13.45, 'dark');
  }
  box(out, b - 3, b, foot, y(251.3), 10, tailrace.mouth, 'wall');
}
export function buildDamLevel(out, level) {
  const detail = quality[level];
  if (!detail) throw Error('Unknown Kadiran Dam detail level: ' + level);
  deck(out, detail);
  gateWorks(out, detail);
  stationHouse(out, detail);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
