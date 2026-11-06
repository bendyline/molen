import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [22.565018087625504, 44.30433277435297],
  heading: 0.9712059653285182,
  datum: 34.99451425,
  crest: 46,
  foundation: 22,
  pool: 41,
  road: [
    [-569.83, -0.42, 43.1],
    [-531.79, 4.12, 45.1],
    [-483, 3.93, 46],
    [102.71, 1.62, 46],
    [565.14, 0, 46],
  ],
  roadIds: [35184497785129, 35184409064137],
  powerhouse: [195.3, 525],
  annexEnd: 604.7,
  auxiliary: [-390.4, -305.7],
  spillway: [-2.5, 195.3],
  spillwayBays: 7,
  lock: { center: -201, width: 34, gates: [-43, 267] },
};

const palette = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.57, 0.563, 0.527] },
  fascia: { slot: 'trim', graph: 'concrete_plain', rgb: [0.73, 0.719, 0.668] },
  deck: { slot: 'foundation', graph: 'concrete_panel', rgb: [0.37, 0.373, 0.359] },
  gate: { slot: 'door', graph: 'metal_painted', rgb: [0.19, 0.298, 0.335] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.25, 0.292, 0.31] },
  amber: { slot: 'trim', graph: 'metal_painted', rgb: [0.72, 0.489, 0.158] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.428, 0.261, 0.243] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.18, 0.251, 0.276] },
  earth: { slot: 'foundation', graph: 'earth_rammed', rgb: [0.396, 0.423, 0.321] },
  joints: { slot: 'foundation', graph: 'concrete_panel', rgb: [0.75, 0.748, 0.697] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([key, { rgb, ...surface }]) => [key, surface]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { crest, foundation, datum, road, lock } = controls;
const p = (x, y, z) => [x, y - datum, z];
const r = (out, m, a, b, width, depth) => beam(out, m, a, b, width, depth, palette[m].rgb);
function box(out, m, x, y, z, width, height, depth) {
  r(out, m, p(x, y - height / 2, z), p(x, y + height / 2, z), depth, width);
}

function panel(out, m, pts, toward, shade = 1) {
  let n = normalFor(...pts);
  if (n.reduce((sum, v, i) => sum + v * toward[i], 0) < 0) {
    pts = pts.toReversed();
    n = normalFor(...pts);
  }
  out.addQuad(
    m,
    'palette:#ffffff',
    pts,
    n,
    undefined,
    palette[m].rgb.map((v) => v * shade),
  );
}

export function roadAt(x) {
  const j = road.findIndex(([v]) => v >= x);
  if (j <= 0) return road[j < 0 ? road.length - 1 : 0].slice(1);
  const [a, z, y] = road[j - 1],
    [b, w, h] = road[j];
  const t = (x - a) / (b - a);
  return [z + (w - z) * t, y + (h - y) * t];
}

function roadDeck(out, tier) {
  for (let i = 1; i < road.length; i++) {
    const [a, az, ay] = road[i - 1],
      [b, bz, by] = road[i];
    const point = (x, z, y, lateral, high) => p(x, y + high, z + lateral);
    const at = (z, h) => [point(a, az, ay, z, h), point(b, bz, by, z, h)];
    const top = [...at(-5.15, 0), ...at(5.15, 0).reverse()];
    panel(out, 'deck', top, [0, 1, 0]);
    panel(out, 'fascia', [...at(-5.15, -1.3), ...at(5.15, -1.3).reverse()], [0, -1, 0]);
    for (const side of [-1, 1]) {
      const z = side * 5.15;
      panel(out, 'fascia', [...at(z, -1.3), ...at(z, 0).reverse()], [0, 0, side]);
      if (tier > 0) {
        r(out, 'amber', ...at(z * 0.94, 1.12), 0.095, 0.12);
        r(out, 'steel', ...at(z * 0.91, 0.58), 0.16, 0.17);
      }
    }
    if (tier > 1) r(out, 'joints', ...at(0, 0.021), 0.085, 0.024);
  }
  if (tier >= 2) {
    for (let x = -561; x < 561; x += tier > 2 ? 7.8 : 14) {
      const [z, y] = roadAt(x);
      for (const side of [-1, 1]) box(out, 'amber', x, y + 0.55, z + side * 4.85, 0.095, 1.1, 0.1);
    }
    for (let x = -522; x < 550; x += 55) {
      const [z, y] = roadAt(x);
      r(out, 'steel', p(x, y, z + 4.7), p(x, y + 6.5, z + 4.7), 0.13, 0.13);
      r(out, 'steel', p(x, y + 6.5, z + 4.7), p(x, y + 6.8, z + 3), 0.092, 0.095);
    }
  }
}

function foundations(out) {
  // The three dry crest spans are separated at the navigation chamber.
  const sections = [
    [-565, -531.79, 45],
    [-531.79, -483, 45],
    [-483, -390, 45],
    [-306, -221, 37],
    [-180, -2.5, 43],
  ];
  for (const [a, b, depth] of sections) {
    const [az, ay] = roadAt(a),
      [bz, by] = roadAt(b);
    const top = Math.min(ay, by) - 1.35;
    box(out, 'concrete', (a + b) / 2, (22.4 + top) / 2, (az + bz) / 2, b - a, top - 22.4, 17);
    for (const side of [-1, 1]) {
      panel(
        out,
        'earth',
        [
          p(a, ay - 1.36, az + side * 8.5),
          p(b, by - 1.36, bz + side * 8.5),
          p(b, 30, bz + side * depth),
          p(a, 30, az + side * depth),
        ],
        [0, 1, side],
      );
    }
    panel(
      out,
      'fascia',
      [
        p(a, ay - 1.36, az - 8.5),
        p(b, by - 1.36, bz - 8.5),
        p(b, by - 1.36, bz + 8.5),
        p(a, ay - 1.36, az + 8.5),
      ],
      [0, 1, 0],
    );
  }
}

function spillway(out, tier) {
  const [a, b] = controls.spillway,
    pitch = (b - a) / controls.spillwayBays;
  box(out, 'concrete', (a + b) / 2, 25.8, -6, b - a, 7.6, 53);
  box(out, 'fascia', (a + b) / 2, 48.5, -19, b - a, 2.4, 3.2);
  for (let i = 0; i <= controls.spillwayBays; i++) {
    const x = a + i * pitch;
    box(out, 'concrete', x, 39.6, -13.1, 5.4, 26.4, 48.6);
    if (tier > 0) box(out, 'fascia', x, 52.8, -12.8, 6.6, 1.15, 48.2);
    if (i === controls.spillwayBays) continue;
    const left = x + 3,
      right = x + pitch - 3;
    const slats = tier > 1 ? 4 : 2;
    for (let j = 0; j < slats; j++) {
      const y = 30 + (14 * j) / slats,
        h = 30 + (14 * (j + 1)) / slats;
      const z = (height) => -15.8 + 4.5 * Math.sin((((height - 30) / 14) * Math.PI) / 2);
      for (const side of [-1, 1]) {
        panel(
          out,
          'gate',
          [
            p(left, y, z(y) + side * 0.1),
            p(right, y, z(y) + side * 0.1),
            p(right, h, z(h) + side * 0.1),
            p(left, h, z(h) + side * 0.1),
          ],
          [0, 0, side],
          0.93 + 0.04 * j,
        );
      }
      if (tier > 2) r(out, 'steel', p(left, h, z(h) + 0.26), p(right, h, z(h) + 0.26), 0.38, 0.24);
    }
    if (tier >= 2) {
      for (const x0 of [left + 2, right - 2])
        r(out, 'steel', p(x0, 36, -12.9), p(x0, 49, -18.6), 0.29, 0.29);
    }
  }
}

function crane(out, x, z, y, width, tier) {
  for (const side of [-1, 1]) {
    box(out, 'amber', x + (side * width) / 2, y + 4.2, z, 1.36, 8.4, 1.45);
    if (tier > 1)
      r(
        out,
        'amber',
        p(x + (side * width) / 2, y + 3.5, z),
        p(x + side * (width / 2 - 3.3), y + 8.4, z),
        0.42,
        0.39,
      );
  }
  box(out, 'amber', x, y + 8.7, z, width + 5.5, 1.13, 1.35);
  if (tier > 0) {
    box(out, 'steel', x + width * 0.17, y + 7.93, z, 2, 0.72, 1.45);
    r(out, 'steel', p(x + width * 0.17, y + 7.7, z), p(x + width * 0.17, y + 4.8, z), 0.066, 0.064);
  }
}

function facade(out, a, b, z, front, y, rows, tier) {
  const pitch = (b - a) / rows;
  for (let i = 0; i < rows; i++) {
    const x = a + i * pitch,
      pad = tier === 0 ? 1.8 : 0.92,
      sign = Math.sign(front);
    panel(
      out,
      'glass',
      [
        p(x + pad, y + 1.65, z),
        p(x + pitch - pad, y + 1.65, z),
        p(x + pitch - pad, y + 7.4, z),
        p(x + pad, y + 7.4, z),
      ],
      [0, 0, sign],
    );
    if (tier > 0) box(out, 'fascia', x + 0.52, y + 4.85, z + sign * 0.24, 0.83, 9.72, 1.17);
    if (tier > 1) {
      for (const f of [0.36, 0.67])
        box(out, 'steel', x + pitch * f, y + 4.5, z + sign * 0.028, 0.12, 5.75, 0.13);
      box(out, 'steel', x + pitch * 0.5, y + 4.15, z + sign * 0.04, pitch - pad * 2, 0.115, 0.14);
    }
  }
}

function powerhouse(out, a, b, z1, z2, rows, tier) {
  const x = (a + b) / 2,
    z = (z1 + z2) / 2,
    w = b - a,
    d = z2 - z1;
  box(out, 'concrete', x, 34, z, w, 24, d + 4.4);
  box(out, 'concrete', x, 50.7, z, w, 9.4, d);
  box(out, 'fascia', x, 56.0, z, w + 0.76, 0.95, d + 1.15);
  box(out, 'roof', x, 56.8, z - 2.1, w - 1.4, 0.72, d - 6.6);
  facade(out, a, b, z1 - 0.05, -1, 46, rows, tier);
  facade(out, a, b, z2 + 0.05, 1, 46, tier === 0 ? Math.max(2, rows / 2) : rows, tier);
  if (tier > 0) {
    for (let i = 0; i < rows; i++) {
      const xx = a + ((i + 0.5) * w) / rows;
      box(out, 'concrete', xx, 36.6, z1 - 6.2, Math.min(6, (w / rows) * 0.39), 12.4, 14);
      if (tier > 1)
        box(out, 'gate', xx, 37.5, z1 - 13.26, Math.min(5.5, (w / rows) * 0.36), 5.1, 0.14);
      if (tier === 4)
        for (const offset of [-1.55, -0.78, 0, 0.78, 1.55])
          box(out, 'steel', xx + offset, 37.5, z1 - 13.38, 0.095, 4.85, 0.13);
    }
  }
}

function transmissionMast(out, x, z, tier) {
  const heights = tier < 2 ? [47, 74] : [47, 53, 59, 65, 70, 74];
  const at = (side, y) => p(x + side * (1.05 + (74 - y) * 0.082), y, z);
  for (let i = 1; i < heights.length; i++) {
    const a = heights[i - 1],
      b = heights[i];
    for (const side of [-1, 1]) {
      r(out, 'steel', at(side, a), at(side, b), 0.23, 0.24);
      if (tier >= 2) r(out, 'steel', at(side, a), at(-side, b), 0.085, 0.1);
    }
  }
  for (const [y, span] of [
    [61, 11],
    [67, 8.5],
    [72, 6.8],
  ]) {
    r(out, 'steel', p(x - span / 2, y, z), p(x + span / 2, y, z), 0.23, 0.21);
    if (tier >= 3)
      for (const side of [-1, 1])
        r(
          out,
          'steel',
          p(x + (side * span) / 2, y, z),
          p(x + (side * span) / 2, y - 1.2, z),
          0.095,
          0.11,
        );
  }
}

function plants(out, tier) {
  powerhouse(out, ...controls.powerhouse, -44, -5.6, 16, tier);
  const [a, b] = controls.auxiliary;
  powerhouse(out, a, b, -46.2, -13.5, 4, tier);
  powerhouse(out, 525, controls.annexEnd, -45.5, -7, 6, tier);
  for (const [x, z, y, w] of [
    [247, -52, 47, 24],
    [339, -55, 47, 28],
    [463, -53, 47, 25],
    [-354, -53, 47, 20],
  ])
    crane(out, x, z, y, w, tier);
  if (tier > 0) {
    for (const x of [282, 398, 511]) transmissionMast(out, x, -61.4, tier);
    box(out, 'fascia', 355, 58.6, -24, 22, 4.2, 16);
    facade(out, 345, 365, -15.98, 1, 54.8, 4, tier > 2 ? 2 : 0);
    for (const z of [-65.7, -57.6]) {
      r(out, 'steel', p(195.5, 51, z), p(523, 51, z), 0.52, 1.85);
      for (let x = 197; x < 524; x += tier > 2 ? 18.8 : 37.6)
        box(out, 'concrete', x, 43.4, z, 1.8, 17.2, 1.9);
    }
  }
}

function lockWorks(out, tier) {
  const {
    center,
    width,
    gates: [upper, lower],
  } = lock;
  const wall = width / 2 + 3.65;
  for (const side of [-1, 1]) {
    const x = center + side * wall;
    box(out, 'concrete', x, 33.2, (upper + lower) / 2, 7.2, 22.4, lower - upper + 9);
    box(out, 'fascia', x, 44.45, (upper + lower) / 2, 7.4, 0.6, lower - upper + 10);
    for (const z of [-43, 268]) {
      box(out, 'concrete', x, 33.8, z, 10.5, 23.6, 16);
      if (tier > 0) {
        box(out, 'fascia', x, 46.9, z, 6.7, 3.8, 7.2);
        box(out, 'glass', x, 47.4, z - 3.62, 5.5, 1.65, 0.09);
      }
    }
    if (tier > 1) {
      r(out, 'steel', p(x, 45.8, upper), p(x, 45.8, lower), 0.09, 0.11);
      for (let z = upper + 5; z < lower; z += 10) box(out, 'steel', x, 45.25, z, 0.13, 1.14, 0.13);
    }
  }
  box(out, 'concrete', center, 22.5, (lower + upper) / 2, 34, 1.1, lower - upper);
  box(out, 'gate', center, 33.6, upper, width, 21.5, 1.95);
  for (const side of [-1, 1])
    r(
      out,
      'gate',
      p(center + side * 17, 33.4, lower - 3.2),
      p(center, 33.4, lower + 2.6),
      1.4,
      21.1,
    );
  for (const [a, b] of [
    [
      [-220, -45],
      [-220, -338],
    ],
    [
      [-181, -46],
      [-116, -210],
    ],
    [
      [-116, -210],
      [-96, -205],
    ],
    [
      [-220, 267],
      [-220, 400],
    ],
    [
      [-183, 267],
      [-183, 348],
    ],
    [
      [-183, 348],
      [-117, 477],
    ],
    [
      [-117, 477],
      [-87, 472],
    ],
  ]) {
    const [x, z] = a,
      [u, v] = b;
    r(out, 'concrete', p(x, 35.5, z), p(u, 35.5, v), 4.1, 13.4);
    if (tier > 0) r(out, 'fascia', p(x, 42.3, z), p(u, 42.3, v), 4.45, 0.57);
  }
  if (tier > 0)
    for (const z of [-455, -425, -395, -365, 433, 461, 490])
      box(out, 'concrete', -220, 35.8, z, 5.8, 12.4, 5.8);
}

export function buildDamLevel(out, name) {
  const tier = tiers[name];
  if (tier === undefined) throw Error('Unknown Iron Gate II tier: ' + name);
  roadDeck(out, tier);
  foundations(out);
  spillway(out, tier);
  plants(out, tier);
  lockWorks(out, tier);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
