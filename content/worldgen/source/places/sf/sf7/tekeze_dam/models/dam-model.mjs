import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [38.74320566654205, 13.34681020953687],
  heading: -2.2466862872958413,
  datum: 1001.601962,
  crestElevation: 1145,
  foundationElevation: 957,
  normalPool: 1140,
  crest: [
    [-202.84295, 70.967071],
    [-195.83567, 66.92031],
    [-170, 52],
    [-141, 36.5],
    [-112, 22],
    [-82, 12.5],
    [-52, 6],
    [-18, 1.5],
    [14, -0.6],
    [45, 1],
    [77, 5.6],
    [109, 14.8],
    [142, 30],
    [174.61699, 64.045],
    [180.214947, 69.888042],
  ],
  stages: [
    [957, 0.21, 43, 27],
    [987, 0.33, 35, 25],
    [1023, 0.49, 25, 20.5],
    [1057, 0.63, 17, 16.5],
    [1095, 0.79, 8, 11],
    [1126, 0.925, 2, 7.4],
    [1145, 1, 0, 5.6],
  ],
  outlets: {
    span: [4, 89],
    count: 4,
    sill: 1057,
    height: 6,
    clearWidth: 5.6,
  },
  intake: {
    x: -161,
    z: 28,
    foundation: 1067,
    deck: 1141.5,
  },
  crestRimControl: [
    [42.2441, 2.991332],
    [18.6471, -0.429766],
    [0, 0],
    [-16.511049, 3.557925],
    [-17.135397, 12.995863],
    [-45.526167, 23.100878],
    [-80.395586, 41.380125],
    [-195.83567, 66.920309],
    [-212.968939, 42.303402],
    [-215.834111, 36.408435],
    [-218.513249, 34.460545],
    [-219.486174, 16.993768],
    [-214.19209, 4.556007],
    [-211.572855, -6.109217],
    [-209.124648, -7.700013],
    [-209.494569, -13.733955],
    [-206.685013, -16.731672],
    [-207.240964, -26.712692],
    [-210.16389, -43.360563],
    [-204.132098, -45.590666],
    [-203.007434, -53.940254],
    [-198.078963, -68.691542],
    [-202.162884, -69.140571],
    [165.438092, -66.750053],
    [164.080331, -63.799349],
    [160.272203, -61.118051],
    [162.228633, -56.35631],
    [164.090992, -54.498229],
    [169.220505, -52.280939],
    [172.21824, -49.471367],
    [176.088329, -37.679266],
    [172.86821, -36.586645],
    [171.645159, -34.861124],
    [166.430105, -32.541178],
    [162.12378, -29.087996],
    [161.037572, -26.727434],
    [168.3972, -18.47832],
    [168.993738, -12.626101],
    [171.181084, -4.32566],
    [161.657577, -0.41276],
    [152.811885, 1.094676],
    [148.636005, -0.397772],
    [142.238545, -0.481152],
    [139.473861, 2.108197],
    [132.849754, 2.206562],
    [125.325457, 8.612577],
    [124.057508, 10.746489],
    [119.569447, 13.973016],
    [131.684416, 14.68502],
    [129.058712, 19.769629],
    [132.963039, 21.852219],
    [157.55434, 21.869294],
    [159.784457, 27.901116],
    [174.77953, 47.52965],
    [175.557818, 53.608514],
    [174.110257, 57.376001],
    [174.616994, 64.045004],
    [108.003934, 57.134436],
    [78.753586, 29.945284],
    [48.156172, 15.007929],
    [47.326565, 3.756802],
    [18.6471, -0.429766],
    [0, 0],
    [-16.511049, 3.557925],
    [-17.135397, 12.995863],
    [-38.85932, 20.73392],
  ],
};
const surfaces = {
  pale: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.49, 0.459, 0.405] },
  wet: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.31, 0.296, 0.264] },
  warm: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.43, 0.405, 0.359] },
  slab: { slot: 'foundation', graph: 'concrete_plain', rgb: [0.51, 0.488, 0.435] },
  dark: { slot: 'trim', graph: 'metal_painted', rgb: [0.16, 0.192, 0.188] },
  red: { slot: 'trim', graph: 'metal_painted', rgb: [0.56, 0.193, 0.106] },
  door: { slot: 'door', graph: 'metal_painted', rgb: [0.23, 0.27, 0.27] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(surfaces).map(([k, { slot, graph }]) => [k, { slot, graph }]),
);
const { datum, crestElevation, foundationElevation, crest, stages, outlets, intake } = controls;
const first = crest[0][0],
  last = crest.at(-1)[0],
  center = 12;
const y = (h) => h - datum;
function interpolate(table, t) {
  const i = table.findIndex((row) => row[0] >= t);
  if (i <= 0) return table[i === 0 ? 0 : table.length - 1].slice(1);
  const a = table[i - 1],
    b = table[i],
    s = (t - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, k) => v + (b[k + 1] - v) * s);
}
const bow = interpolate(crest, center)[0];
export function sampleArchPoint(u, h, side = 1, extra = 0) {
  const [scale, sweep, thickness] = interpolate(stages, h),
    z = interpolate(crest, u)[0];
  return [
    center + (u - center) * scale,
    y(h),
    bow + sweep + (z - bow) * scale + (side * thickness) / 2 + extra,
  ];
}
const P = sampleArchPoint;
const levels = {
  skyline: {},
  district: { edges: true },
  street: { edges: true, rails: true },
  closeup: { edges: true, rails: true, details: true },
  master: { edges: true, rails: true, details: true, inspection: true },
};
function face(out, m, ps, expected) {
  let n = normalFor(...ps);
  if (n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    ps = ps.toReversed();
    n = normalFor(...ps);
  }
  const fn = ps.length === 3 ? out.addTriangle : out.addQuad;
  fn.call(out, m, 'palette:#ffffff', ps, n, undefined, surfaces[m].rgb);
}
const quad = (out, m, a, b, c, d, n) => face(out, m, [a, b, c, d], n);
const rod = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, surfaces[m].rgb);
function stations(a, b) {
  return [a, ...crest.filter(([x]) => x > a && x < b).map(([x]) => x), b];
}
function shell(out, a, b, h, k, side) {
  const rows = [h, ...stages.map(([v]) => v).filter((v) => v > h && v < k), k],
    xs = stations(a, b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < rows.length; j++) {
      const u = xs[i - 1],
        v = xs[i],
        l = rows[j - 1],
        r = rows[j];
      const m = side === 1 && r < 1095 ? 'wet' : i % 4 === 0 ? 'warm' : 'pale';
      quad(out, m, P(u, l, side), P(v, l, side), P(v, r, side), P(u, r, side), [0, 0, side]);
    }
}
const ports = Array.from({ length: outlets.count }, (_, i) => {
  const [a, b] = outlets.span,
    u = a + ((b - a) * (i + 0.5)) / outlets.count;
  const l = u - outlets.clearWidth / 2 / 0.63,
    r = u + outlets.clearWidth / 2 / 0.63;
  return { u, l, r };
});
function arch(out, d) {
  const sill = outlets.sill,
    top = sill + outlets.height;
  shell(out, first, last, foundationElevation, crestElevation, -1);
  shell(out, first, last, foundationElevation, sill, 1);
  shell(out, first, last, top, crestElevation, 1);
  let u = first;
  for (const { l, r } of ports) {
    shell(out, u, l, sill, top, 1);
    u = r;
  }
  shell(out, u, last, sill, top, 1);
  const xs = stations(first, last);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    for (const [h, n, m] of [
      [crestElevation, 1, 'slab'],
      [foundationElevation, -1, 'wet'],
    ])
      quad(out, m, P(a, h, -1), P(b, h, -1), P(b, h, 1), P(a, h, 1), [0, n, 0]);
    if (d.rails)
      for (const side of [-1, 1]) {
        const p = (x) => P(x, crestElevation + 0.39, side, -side * 0.12);
        rod(out, 'slab', p(a), p(b), 0.24, 0.78);
      }
  }
  for (const [u, s] of [
    [first, -1],
    [last, 1],
  ])
    for (let i = 1; i < stages.length; i++) {
      const [a] = stages[i - 1],
        [b] = stages[i];
      quad(out, 'warm', P(u, a, -1), P(u, b, -1), P(u, b, 1), P(u, a, 1), [s, 0, 0]);
    }
}
function outletsAndHeadworks(out, d) {
  const h = outlets.sill,
    k = h + outlets.height,
    front = 8.5,
    back = -3.1;
  for (const { u, l, r } of ports) {
    quad(
      out,
      'door',
      P(l, h, 1, back),
      P(r, h, 1, back),
      P(r, k, 1, back),
      P(l, k, 1, back),
      [0, 0, 1],
    );
    quad(
      out,
      'wet',
      P(l, h, 1, back),
      P(r, h, 1, back),
      P(r, h, 1, front),
      P(l, h, 1, front),
      [0, 1, 0],
    );
    quad(
      out,
      'slab',
      P(l, k, 1, back),
      P(r, k, 1, back),
      P(r, k, 1, front),
      P(l, k, 1, front),
      [0, -1, 0],
    );
    for (const [x, n] of [
      [l, 1],
      [r, -1],
    ]) {
      quad(out, 'warm', P(x, h, 1, back), P(x, h, 1, front), P(x, k, 1, front), P(x, k, 1, back), [
        n,
        0,
        0,
      ]);
      const w = x - n * 2.5;
      quad(
        out,
        'pale',
        P(x, h - 3, 1, front),
        P(w, h - 3, 1, front),
        P(w, k + 3.2, 1, front),
        P(x, k + 3.2, 1, front),
        [0, 0, 1],
      );
    }
    quad(
      out,
      'slab',
      P(l, h, 1, front),
      P(r, h, 1, front),
      P(r, h - 3.1, 1, front + 4),
      P(l, h - 3.1, 1, front + 4),
      [0, 1, 1],
    );
    const feet = 1135.4,
      head = 1147.5,
      lo = u - 6.3,
      hi = u + 6.3;
    for (const [x, n] of [
      [lo, -1],
      [hi, 1],
    ])
      quad(
        out,
        'pale',
        P(x, h - 1, -1, -2),
        P(x, head, -1, -3.4),
        P(x, head, -1, -6),
        P(x, h - 1, -1, -5),
        [n, 0, 0],
      );
    quad(
      out,
      'pale',
      P(lo, feet, -1, -5.7),
      P(hi, feet, -1, -5.7),
      P(hi, head, -1, -6),
      P(lo, head, -1, -6),
      [0, 0, -1],
    );
    quad(
      out,
      'slab',
      P(lo, head, -1, 1),
      P(hi, head, -1, 1),
      P(hi, head, -1, -6),
      P(lo, head, -1, -6),
      [0, 1, 0],
    );
    if (d.edges) {
      for (const x of [lo + 1.2, hi - 1.2])
        rod(out, 'red', P(x, head, -1, -3.8), P(x, head + 3.8, -1, -3.8), 0.35, 0.38);
      rod(
        out,
        'red',
        P(lo + 1.2, head + 3.8, -1, -3.8),
        P(hi - 1.2, head + 3.8, -1, -3.8),
        0.47,
        0.62,
      );
      rod(out, 'dark', P(l, k + 2.6, 1, front - 0.4), P(r, k + 2.6, 1, front - 0.4), 0.16, 0.18);
    }
  }
  if (d.rails) {
    const [a, b] = outlets.span;
    rod(out, 'slab', P(a, k + 1.8, 1, front), P(b, k + 1.8, 1, front), 2.7, 0.8);
    rod(out, 'dark', P(a, k + 3, 1, front + 0.8), P(b, k + 3, 1, front + 0.8), 0.13, 0.16);
  }
}
function block(out, m, x, X, h, H, z, Z) {
  const P = (x, h, z) => [x, y(h), z];
  quad(out, m, P(x, h, z), P(X, h, z), P(X, H, z), P(x, H, z), [0, 0, -1]);
  quad(out, m, P(x, h, Z), P(X, h, Z), P(X, H, Z), P(x, H, Z), [0, 0, 1]);
  quad(out, m, P(x, H, z), P(X, H, z), P(X, H, Z), P(x, H, Z), [0, 1, 0]);
  quad(out, m, P(x, h, z), P(x, h, Z), P(x, H, Z), P(x, H, z), [-1, 0, 0]);
  quad(out, m, P(X, h, z), P(X, h, Z), P(X, H, Z), P(X, H, z), [1, 0, 0]);
}
function powerIntake(out, d) {
  const { x, z, foundation: h, deck: k } = intake;
  block(out, 'pale', x - 10, x + 10, h, k, z - 7, z + 8);
  block(out, 'slab', x - 13, x + 12, k, k + 1.6, z - 9, z + 10);
  const path = (u, h) => [u, y(h), z + 9.5];
  quad(
    out,
    'slab',
    path(x - 4.5, k + 1.6),
    path(x + 4.5, k + 1.6),
    P(x + 4.5, 1144.8, -1, 0.15),
    P(x - 4.5, 1144.8, -1, 0.15),
    [0, 1, 0],
  );
  for (const u of [x - 8.6, x + 8.6]) {
    block(out, 'red', u - 0.53, u + 0.53, k + 1.6, k + 12, z - 6.7, z - 5.7);
    block(out, 'red', u - 0.53, u + 0.53, k + 1.6, k + 12, z + 6.7, z + 7.7);
  }
  for (const a of [z - 6.7, z + 6.7])
    block(out, 'red', x - 9.3, x + 9.3, k + 11, k + 12.6, a, a + 1);
  block(out, 'red', x - 5.5, x + 0.5, k + 12.6, k + 16.1, z - 7, z + 7.9);
  if (d.edges) {
    for (let i = 0; i < 5; i++) {
      const u = x - 8.8 + 4.1 * i;
      block(out, 'dark', u, u + 2.7, h + 8, k - 2, z - 7.16, z - 7.02);
    }
    for (const a of [z - 8.3, z + 9.3])
      rod(out, 'dark', [x - 12, y(k + 2.9), a], [x + 11, y(k + 2.9), a], 0.15, 0.13);
  }
}
function thrustBlock(out, d) {
  const [x, , z] = P(last - 9, 1145, 1);
  block(out, 'pale', x - 15, x + 6, 1116, 1145.2, z - 3, z + 13);
  const abutment = (u, h, v) => [x + u, y(h), z + v];
  quad(
    out,
    'warm',
    abutment(-15, 1116, 13),
    abutment(6, 1116, 13),
    abutment(12, 1104, 22),
    abutment(-22, 1104, 22),
    [0, 1, 1],
  );
  quad(
    out,
    'warm',
    abutment(-15, 1116, 13),
    abutment(-22, 1104, 22),
    abutment(-22, 1104, -4),
    abutment(-15, 1116, -3),
    [-1, 0, 0],
  );
  block(out, 'slab', x - 13, x + 8, 1145.2, 1146.2, z - 4, z + 14);
  if (d.details) {
    for (let i = 0; i < 5; i++)
      block(out, 'warm', x - 14 + i * 3.5, x - 13.2 + i * 3.5, 1116, 1145.2, z + 12.6, z + 14);
    if (d.inspection)
      rod(out, 'dark', [x - 13, y(1147), z + 13.3], [x + 7, y(1147), z + 13.3], 0.13, 0.14);
  }
}
export function buildDamLevel(out, level) {
  const d = levels[level];
  if (!d) throw Error('Unknown Tekezé Dam detail level: ' + level);
  arch(out, d);
  outletsAndHeadworks(out, d);
  powerIntake(out, d);
  thrustBlock(out, d);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
