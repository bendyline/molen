import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [22.52227, 44.40661],
  heading: 0.7554201405014385,
  datum: 35,
  crest: 11,
  deckZ: 1.03,
  bays: [
    [-79.7, -57.6],
    [-51.32, -30.42],
    [-24.1, -1.93],
    [4.32, 26.43],
    [32.65, 54.22],
    [60.73, 82.55],
    [88.78, 109.86],
  ],
  bridge: [-113.77, 117.71],
  plant: [
    [-338.81, -40.93],
    [-253.61, -37.75],
    [-254.51, -12.52],
    [-339.56, -15.55],
  ],
  // Stations along each mapped crest approach, with approximate vertical transitions at the banks.
  island: [
    [-435, 7.0, 8.5],
    [-338, 5.5, 10.0],
    [-254, 4.1, 10.7],
    [-113.77, 1.06, 11],
  ],
  mainland: [
    [117.71, 1.06, 11],
    [171.38, -0.54, 10.8],
    [204.56, -5.92, 10.5],
    [231.3, -15.02, 10.0],
    [264.1, -33.35, 9.15],
    [294.02, -52.05, 8.15],
  ],
};

const palette = {
  body: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.43, 0.45, 0.426] },
  coping: { slot: 'trim', graph: 'concrete_plain', rgb: [0.68, 0.674, 0.602] },
  deck: { slot: 'foundation', graph: 'concrete_panel', rgb: [0.3, 0.31, 0.299] },
  stone: { slot: 'foundation', graph: 'stone_granite', rgb: [0.48, 0.482, 0.425] },
  gate: { slot: 'door', graph: 'metal_painted', rgb: [0.16, 0.33, 0.29] },
  amber: { slot: 'trim', graph: 'metal_painted', rgb: [0.74, 0.56, 0.13] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.31, 0.397, 0.42] },
  window: { slot: 'window', graph: 'window_grid', rgb: [0.191, 0.257, 0.273] },
};
export const surfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...v }]) => [k, v]),
);
const { bays, bridge, crest, deckZ, plant, island, mainland } = controls;
const tiers = ['skyline', 'district', 'street', 'closeup', 'master'];
const rod = (out, material, a, b, width, depth = width) =>
  beam(out, material, a, b, width, depth, palette[material].rgb);

function face(out, material, points, toward, shade = 1) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, axis) => sum + value * toward[axis], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  const emit = points.length === 3 ? out.addTriangle : out.addQuad;
  emit.call(
    out,
    material,
    'palette:#ffffff',
    points,
    n,
    undefined,
    palette[material].rgb.map((v) => v * shade),
  );
}

function slab(out, material, r, bottom, top) {
  const at = (p, y) => [p[0], y, p[1]];
  face(
    out,
    material,
    r.map((p) => at(p, top)),
    [0, 1, 0],
  );
  face(
    out,
    material,
    r.map((p) => at(p, bottom)),
    [0, -1, 0],
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      out,
      material,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
}

function box(out, m, a, b, h, H, z, Z) {
  slab(
    out,
    m,
    [
      [a, z],
      [b, z],
      [b, Z],
      [a, Z],
    ],
    h,
    H,
  );
}

function pier(out, a, b, detail, index) {
  const section =
    detail < 2
      ? [
          [-6, -35, 14],
          [9.2, -24, 6.4],
          [9.8, -13, 6.4],
        ]
      : [
          [-6, -35, 14],
          [-1.4, -35, 12.9],
          [2.4, -31.5, 10.3],
          [6.2, -27.3, 8.15],
          [9.2, -24, 6.4],
          [9.8, -13, 6.4],
        ];
  for (const [x, side] of [
    [a, -1],
    [b, 1],
  ]) {
    const at = (h, z) => [x, h, z];
    for (let i = 1; i < section.length; i++) {
      const [y, u, v] = section[i - 1],
        [Y, U, V] = section[i];
      const shade = detail < 2 ? 0.85 : 0.64 + i * 0.065 + (index % 3) * 0.018;
      face(out, 'body', [at(y, u), at(y, v), at(Y, V), at(Y, U)], [side, 0, 0], shade);
    }
  }
  for (let i = 1; i < section.length; i++) {
    const [y, u, v] = section[i - 1],
      [Y, U, V] = section[i];
    face(
      out,
      'body',
      [
        [a, y, u],
        [b, y, u],
        [b, Y, U],
        [a, Y, U],
      ],
      [0, 0, -1],
    );
    face(
      out,
      'body',
      [
        [a, y, v],
        [b, y, v],
        [b, Y, V],
        [a, Y, V],
      ],
      [0, 0, 1],
      detail < 2 ? 0.87 : 0.64 + i * 0.065,
    );
  }
  const [top, north, south] = section.at(-1);
  face(
    out,
    'body',
    [
      [a, top, north],
      [b, top, north],
      [b, top, south],
      [a, top, south],
    ],
    [0, 1, 0],
  );
  face(
    out,
    'body',
    [
      [a, -6, -35],
      [b, -6, -35],
      [b, -6, 14],
      [a, -6, 14],
    ],
    [0, -1, 0],
  );
}

function spillway(out, detail) {
  const [begin, end] = bridge;
  box(out, 'body', begin, end, -6.42, -5.72, -36, 17);
  box(out, 'coping', begin, end, 9.6, crest - 0.28, deckZ - 6.2, deckZ + 5.4);
  box(out, 'deck', begin, end, crest - 0.28, crest, deckZ - 5.25, deckZ + 5.2);
  const cheeks = [
    [begin, bays[0][0]],
    ...bays.slice(1).map(([x], i) => [bays[i][1], x]),
    [bays.at(-1)[1], end],
  ];
  for (const [index, [a, b]] of cheeks.entries()) {
    pier(out, a, b, detail, index);
    if (detail > 0)
      box(
        out,
        'coping',
        a - 0.15,
        b + 0.15,
        crest - 0.24,
        crest + 0.62,
        deckZ + 4.85,
        deckZ + 5.55,
      );
  }
  for (const [index, [a, b]] of bays.entries()) {
    const panel =
      detail < 2
        ? [
            [-3, -14],
            [8.4, -18],
          ]
        : [
            [-3, -14],
            [-0.1, -15.8],
            [2.8, -17.1],
            [5.6, -17.8],
            [8.4, -18],
          ];
    for (let i = 1; i < panel.length; i++) {
      const [y, z] = panel[i - 1],
        [Y, Z] = panel[i];
      const shade = (index === 4 ? 1.065 : 0.87) + i * 0.015;
      for (const shift of [0, 0.39])
        face(
          out,
          'gate',
          [
            [a, y, z + shift],
            [b, y, z + shift],
            [b, Y, Z + shift],
            [a, Y, Z + shift],
          ],
          [0, 0, shift === 0 ? -1 : 1],
          shade,
        );
    }
    if (detail > 1) {
      for (const [h, z] of panel.slice(1, -1))
        rod(out, 'gate', [a, h, z + 0.51], [b, h, z + 0.51], 0.26, 0.31);
      for (const a1 of [a + 0.24, b - 0.24])
        rod(out, 'gate', [a1, -2.7, -13.95], [a1, 8.31, -17.54], 0.45, 0.52);
      const x = (a + b) / 2;
      box(out, 'amber', x - 1.46, x + 1.46, crest, crest + 0.76, deckZ - 5.22, deckZ - 2.9);
      rod(out, 'coping', [x, crest + 0.76, deckZ - 4.3], [x, crest + 1.8, deckZ - 4.3], 0.16);
    }
  }
  if (detail === 0) return;
  for (const z of [deckZ - 5.27, deckZ + 5.23]) {
    rod(out, 'amber', [begin, crest + 0.85, z], [end, crest + 0.85, z], 0.14, 0.13);
    if (detail > 1)
      for (let x = begin + 1; x < end; x += detail === 2 ? 7 : 3.6)
        rod(out, 'amber', [x, crest, z], [x, crest + 0.86, z], 0.088);
  }
}

function powerhouse(out, detail) {
  slab(out, 'body', plant, -4.1, 8);
  slab(out, 'coping', plant, 8, 15.15);
  slab(out, 'roof', plant, 15.15, 15.63);
  const [a, b] = [-339.56, -254.51],
    z = -15.53;
  // Two shaded downstream recesses sit beneath the broad station roof.
  box(out, 'body', a, b, -4.02, 8.3, -14.1, -8.3);
  for (const [from, to] of [
    [-337, -331],
    [-306.5, -299.7],
    [-272.3, -266.6],
  ])
    box(out, 'coping', from, to, -2.7, 9.4, -10.7, 19.6);
  box(out, 'coping', -337.5, -266, 8.3, 9.45, -11.5, 20.2);
  box(out, 'body', -337.5, -266, -4.15, -3.35, -8.6, 20.2);
  if (detail > 0) {
    const front = (x) => z + (x - a) * 0.03563;
    face(
      out,
      'window',
      [
        [a + 3, 9.1, front(a + 3)],
        [b - 2, 9.1, front(b - 2)],
        [b - 2, 12.2, front(b - 2)],
        [a + 3, 12.2, front(a + 3)],
      ],
      [0, 0, 1],
    );
    if (detail > 1)
      for (let x = a + 5; x < b - 1; x += 5.8)
        rod(out, 'coping', [x, 8.6, front(x) + 0.05], [x, 12.28, front(x) + 0.05], 0.38, 0.21);
  }
  const gantry = [-297, -278],
    crossing = [-34, -19];
  for (const x of gantry)
    for (const Z of crossing) rod(out, 'amber', [x, 15.63, Z], [x, 25.15, Z], 0.87, 0.93);
  for (const Z of crossing)
    rod(out, 'amber', [gantry[0] - 1, 25.1, Z], [gantry[1] + 1, 25.1, Z], 1.34, 1.52);
  if (detail > 1) {
    const center = (gantry[0] + gantry[1]) / 2;
    rod(out, 'amber', [center, 24.93, crossing[0]], [center, 24.93, crossing[1]], 1.5, 1.4);
    box(out, 'amber', center - 1.1, center + 1.1, 23.2, 24.5, -29, -24);
    for (const x of gantry)
      for (const z of crossing)
        rod(out, 'amber', [x, 18.9, z], [x + (x < center ? 3.2 : -3.2), 24.55, z], 0.31, 0.39);
  }
}

// Primary-road paving is 12 m wide in the terrain renderer. At each outer joint,
// meet its perpendicular end section using the outgoing DN56B centerline.
const bankSections = {
  '-435': [148.577, -1.89],
  294.02: [14.175, -10.385],
};

function approachSection([x, z], halfWidth, side) {
  const direction = bankSections[x];
  if (!direction) return [x, z + side * halfWidth];
  const [dx, dz] = direction;
  const offset = (side * halfWidth) / Math.hypot(dx, dz);
  return [x - dz * offset, z + dx * offset];
}

export function approachDeckEdge(station, side) {
  return approachSection(station, bankSections[station[0]] ? 6 : 5.1, side);
}

function approach(out, profile, detail) {
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    const top = (station, side) => {
      const [x, z] = approachDeckEdge(station, side);
      return [x, station[2], z];
    };
    const foot = (station, index, side) => {
      const [x, z] = approachSection(station, slopeWidth(index, profile.length), side);
      return [x, -2.8, z];
    };
    face(out, 'deck', [top(a, -1), top(b, -1), top(b, 1), top(a, 1)], [0, 1, 0]);
    for (const side of [-1, 1]) {
      const from = top(a, side),
        to = top(b, side);
      face(out, 'stone', [from, to, foot(b, i, side), foot(a, i - 1, side)], [0, 1, side]);
      if (detail > 1)
        rod(
          out,
          'amber',
          [from[0], from[1] + 0.74, from[2]],
          [to[0], to[1] + 0.74, to[2]],
          0.1,
          0.1,
        );
    }
    for (const [station, index, side] of [
      [a, i - 1, -1],
      [b, i, 1],
    ]) {
      if (!bankSections[station[0]]) continue;
      const [dx, dz] = bankSections[station[0]];
      face(
        out,
        'stone',
        [top(station, -1), top(station, 1), foot(station, index, 1), foot(station, index, -1)],
        [side * dx, 0, side * dz],
      );
    }
  }
}

const slopeWidth = (station, count) => (station === 0 || station === count - 1 ? 22 : 28.5);

export function buildGogosu(out, level) {
  const detail = tiers.indexOf(level);
  if (detail < 0) throw new Error(`Unknown Gogoșu detail level ${level}`);
  spillway(out, detail);
  powerhouse(out, detail);
  approach(out, island, detail);
  approach(out, mainland, detail);
}

export const buildSkyline = (out) => buildGogosu(out, 'skyline');
export const buildDistrict = (out) => buildGogosu(out, 'district');
export const buildStreet = (out) => buildGogosu(out, 'street');
export const buildCloseup = (out) => buildGogosu(out, 'closeup');
