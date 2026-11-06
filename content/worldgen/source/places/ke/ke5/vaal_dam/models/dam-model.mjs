import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [28.115205724, -26.882373292],
  heading: 0.26824185814,
  datum: 1485.9885203750002,
  crest: 1493.3,
  foundation: 1430.3,
  extent: [-357, 357],
  gateBanks: [
    { from: -163, to: 108, count: 34 },
    { from: 127, to: 342, count: 26 },
  ],
  outletX: 117.5,
  upstreamCrestEdge: 24,
  bridgeId: 35184507540458,
};
const palette = {
  wall: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.56, 0.516, 0.443] },
  deck: { slot: 'trim', graph: 'concrete_plain', rgb: [0.65, 0.606, 0.535] },
  apron: { slot: 'foundation', graph: 'concrete_panel', rgb: [0.474, 0.444, 0.392] },
  earth: { slot: 'foundation', graph: 'earth_rammed', rgb: [0.393, 0.412, 0.295] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.286, 0.327, 0.343] },
  gate: { slot: 'door', graph: 'metal_painted', rgb: [0.204, 0.222, 0.232] },
  service: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.35, 0.448, 0.493] },
  machinery: { slot: 'trim', graph: 'metal_painted', rgb: [0.623, 0.444, 0.206] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([name, { rgb, ...surface }]) => [name, surface]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { datum, crest, foundation, extent, gateBanks, outletX } = controls;
const p = (x, y, z) => [x, y - datum, z];

function face(out, m, pts, direction, shade = 1) {
  let normal = normalFor(...pts);
  if (normal.reduce((sum, value, i) => sum + value * direction[i], 0) < 0) {
    pts = pts.toReversed();
    normal = normalFor(...pts);
  }
  const add = pts.length === 3 ? out.addTriangle : out.addQuad;
  add.call(
    out,
    m,
    'palette:#ffffff',
    pts,
    normal,
    undefined,
    palette[m].rgb.map((v) => v * shade),
  );
}
const rod = (out, m, a, b, width, depth) => beam(out, m, a, b, width, depth, palette[m].rgb);
const box = (out, m, x, y, z, width, height, depth) =>
  rod(out, m, p(x, y - height / 2, z), p(x, y + height / 2, z), depth, width);

function span(out, a, b, section, materials) {
  const mid = section
    .reduce((sum, v) => [sum[0] + v[0], sum[1] + v[1]], [0, 0])
    .map((v) => v / section.length);
  for (let i = 0; i < section.length; i++) {
    const [y, z] = section[i],
      [h, k] = section[(i + 1) % section.length];
    face(
      out,
      materials[i],
      [p(a, y, z), p(b, y, z), p(b, h, k), p(a, h, k)],
      [0, (y + h) / 2 - mid[0], (z + k) / 2 - mid[1]],
    );
  }
  for (const [x, side] of [
    [a, -1],
    [b, 1],
  ])
    for (let i = 1; i < section.length - 1; i++) {
      face(
        out,
        materials[0],
        [section[0], section[i], section[i + 1]].map(([y, z]) => p(x, y, z)),
        [side, 0, 0],
      );
    }
}
const bankHeight = [
  [-163, 1478],
  [-125, 1473],
  [-64, 1464],
  [0, 1458],
  [54, 1455],
  [108, 1454.8],
  [127, 1454.8],
  [155, 1460],
  [205, 1471],
  [255, 1479],
  [342, 1483],
];
export function toe(x) {
  const i = bankHeight.findIndex(([a]) => a >= x);
  if (i < 1) return bankHeight[i < 0 ? bankHeight.length - 1 : 0][1];
  const [a, y] = bankHeight[i - 1],
    [b, h] = bankHeight[i];
  return y + ((h - y) * (x - a)) / (b - a);
}

function body(out, tier) {
  const cutoff = 1482;
  for (let i = 1; i < bankHeight.length; i++) {
    const [a, y] = bankHeight[i - 1],
      [b, h] = bankHeight[i];
    const lip = (x) => p(x, cutoff, 11.6);
    const foot = (x, grade) => p(x, grade, -14 - (cutoff - grade) * 0.88);
    const bottom = (x, grade) => p(x, grade - 0.1, -34 - (cutoff - grade) * 0.92);
    const shade = 1 + 0.04 * Math.sin(i * 2);
    if (a !== 108) {
      face(out, 'wall', [lip(a), lip(b), foot(b, h), foot(a, y)], [0, 0, -1], shade);
    }
    if (tier > 1 && a !== 108) {
      for (let x = a + 2.2; x + 0.11 < b; x += 8.1) {
        const grade = toe(x);
        const seam = [lip(x), lip(x + 0.09), foot(x + 0.09, toe(x + 0.09)), foot(x, grade)].map(
          ([x, y, z]) => [x, y + 0.021, z - 0.045],
        );
        face(out, 'wall', seam, [0, 0, -1], 0.81);
      }
    }
    face(out, 'apron', [foot(a, y), foot(b, h), bottom(b, h), bottom(a, y)], [0, 1, 0], shade);
    face(
      out,
      'wall',
      [bottom(a, y), bottom(b, h), p(b, foundation, -3), p(a, foundation, -3)],
      [0, 0, -1],
      0.86,
    );
    face(
      out,
      'wall',
      [p(a, foundation, 25), p(b, foundation, 25), p(b, cutoff, 24), p(a, cutoff, 24)],
      [0, 0, 1],
    );
    face(
      out,
      'deck',
      [p(a, cutoff, 11.6), p(b, cutoff, 11.6), p(b, cutoff, 24), p(a, cutoff, 24)],
      [0, 1, 0],
    );
  }
  for (const [a, b] of [
    [extent[0], -163],
    [342, extent[1]],
  ]) {
    span(
      out,
      a,
      b,
      [
        [1468, -42],
        [crest - 0.3, 7],
        [crest - 0.3, 24],
        [1477, 47],
        [1468, 47],
      ],
      ['earth', 'earth', 'earth', 'earth', 'earth'],
    );
  }
  for (const [a, b] of [
    [extent[0], -163],
    [-163, 342],
    [342, extent[1]],
  ]) {
    box(out, 'deck', (a + b) / 2, crest - 0.37, 17.6, b - a, 0.74, 7.6);
  }
  for (const z of [14, 21.2]) {
    rod(out, 'steel', p(extent[0], crest + 1.03, z), p(extent[1], crest + 1.03, z), 0.135, 0.14);
    if (tier < 2) continue;
    const spacing = tier >= 3 ? 4.1 : 8;
    for (let x = -354; x < 356; x += spacing)
      box(out, 'steel', x, crest + 0.49, z, 0.09, 0.99, 0.11);
  }
  if (tier > 1)
    for (const z of [16.1, 18.75]) {
      rod(out, 'steel', p(-165, crest + 0.034, z), p(344, crest + 0.034, z), 0.11, 0.065);
    }
}

function gates(out, tier) {
  const skip = tier === 0 ? 3 : 1;
  for (const { from, to, count } of gateBanks) {
    const spacing = (to - from) / count;
    for (let i = 0; i < count; i += skip) {
      const a = from + i * spacing,
        b = from + Math.min(i + skip, count) * spacing;
      // Gate plate is set back underneath the open crest deck and its concrete fins.
      face(
        out,
        'gate',
        [
          p(a + 0.45, 1482.12, 23.65),
          p(b - 0.45, 1482.12, 23.65),
          p(b - 0.45, crest - 0.8, 21.4),
          p(a + 0.45, crest - 0.8, 21.4),
        ],
        [0, 0, -1],
        0.95 + 0.08 * Math.sin(i),
      );
      face(
        out,
        'gate',
        [
          p(a + 0.45, 1482.12, 23.7),
          p(b - 0.45, 1482.12, 23.7),
          p(b - 0.45, crest - 0.8, 21.45),
          p(a + 0.45, crest - 0.8, 21.45),
        ],
        [0, 0, 1],
      );
      span(
        out,
        a - 0.54,
        a + 0.54,
        [
          [1482, 8.8],
          [crest - 0.7, 14.35],
          [crest - 0.7, 23.2],
          [1482, 24],
        ],
        ['wall', 'deck', 'wall', 'wall'],
      );
      if (tier < 2) continue;
      const x = (a + b) / 2;
      box(out, 'machinery', x, crest + 0.42, 20.3, 0.69, 0.84, 0.71);
      if (tier >= 3) {
        for (const y of [1485, 1488.4]) {
          const z = 23.65 - ((y - 1482.12) * 2.25) / (crest - 0.8 - 1482.12);
          rod(out, 'steel', p(a + 0.56, y, z - 0.17), p(b - 0.56, y, z - 0.17), 0.29, 0.19);
        }
      }
    }
    span(
      out,
      to - 0.54,
      to + 0.54,
      [
        [1482, 8.8],
        [crest - 0.7, 14.35],
        [crest - 0.7, 23.2],
        [1482, 24],
      ],
      ['wall', 'deck', 'wall', 'wall'],
    );
  }
}

function outlet(out, tier) {
  const x = outletX;
  const section = [
    [1454, -26],
    [1489, -15.4],
    [1493.3, 3.4],
    [1493.3, 25],
    [1454, 25],
  ];
  const skin = ['wall', 'wall', 'deck', 'wall', 'wall'];
  span(out, 108, 112.4, section, skin);
  span(out, 122.6, 127, section, skin);
  span(out, 112.4, 122.6, [[1463.7, -23.0623], ...section.slice(1, 4), [1463.7, 25]], skin);
  box(out, 'gate', x, 1458.9, -16.6, 10.2, 9.55, 0.4);
  box(out, 'deck', x, 1454.1, -20.6, 10.2, 0.37, 10.9);
  box(out, 'deck', x, 1493.12, 5.7, 19.8, 0.85, 11);
  box(out, 'service', x, 1496.1, 8.4, 9.6, 3.5, 5.4);
  if (tier > 0) {
    box(out, 'steel', x, 1496.46, 5.65, 7.2, 1.1, 0.17);
    box(out, 'deck', x, 1498.0, 8.4, 10.1, 0.32, 5.8);
  }
  for (const xx of [83.5, 104]) {
    const top = 1493.3 + (xx < 100 ? 5.8 : 8.8);
    for (const z of [14.4, 21.5])
      box(out, 'steel', xx, (top + crest) / 2, z, 0.64, top - crest, 0.72);
    box(out, 'service', xx, top, 18, 3, 1.52, 9.4);
    if (tier >= 3)
      for (const z of [15.6, 18, 20.4]) {
        box(out, 'steel', xx - 1.53, top + 0.16, z, 0.13, 0.51, 1.07);
      }
  }
  const steps = [6, 10, 16, 23, 28][tier];
  for (let i = 0; i < steps; i++) {
    const a = i / steps,
      b = (i + 1) / steps;
    const z = -48 + (45 * (a + b)) / 2;
    const height = 1454.9 + 26 * b;
    box(
      out,
      'apron',
      145.5,
      height - (height - 1454) / 2,
      z,
      32.8,
      height - 1454,
      45 / steps + 0.018,
    );
  }
  const wall = [
    [-61, 1457.5],
    [-48, 1459],
    [-22, 1476.5],
    [-1, 1484],
  ];
  for (let i = 1; i < wall.length; i++) {
    const [a, y] = wall[i - 1],
      [b, h] = wall[i];
    for (const [wx, sign] of [
      [162, -1],
      [164, 1],
    ]) {
      face(out, 'wall', [p(wx, 1453, a), p(wx, 1453, b), p(wx, h, b), p(wx, y, a)], [sign, 0, 0]);
    }
    face(out, 'deck', [p(162, y, a), p(164, y, a), p(164, h, b), p(162, h, b)], [0, 1, 0]);
  }
}

export function buildDamLevel(out, name) {
  const tier = tiers[name];
  if (tier === undefined) throw Error('Unknown Vaal Dam tier: ' + name);
  body(out, tier);
  gates(out, tier);
  outlet(out, tier);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
