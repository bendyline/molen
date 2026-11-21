import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const C = palette({
  brick: '777573',
  skirt: 'a29d8f',
  roof: '6b6861',
  tile: '858077',
  ridge: '55534e',
  eave: '585652',
  wood: '804021',
  red: '984936',
  black: '302d29',
  gold: 'b6a072',
  sash: '453a2b',
  paper: '8a9184',
  glass: '6a7774',
  highlight: 'a7b0ab',
  slate: '85817a',
  joint: '7d7871',
  planters: '8d877a',
  bark: '5e5240',
  leaf: '647352',
  youngLeaf: '82906a',
  blue: '3b537e',
  white: 'd9d8cf',
});
const surfaces = {
  brick: surface('wall', 'brick_stack', 0.88),
  skirt: surface('foundation', 'stone_ashlar', 0.88),
  roof: surface('roof', 'slate', 0.86),
  tile: surface('roof', 'slate', 0.86),
  wood: surface('door', 'wood_plain', 0.79),
  sash: surface('door', 'wood_plain', 0.79),
  glass: surface('window', 'window_punched', 0.55, 0.024),
  slate: surface('foundation', 'stone_ashlar', 0.85),
  leaf: surface('wall', 'plaster_lime', 0.93),
  plate: surface('trim', 'metal_painted', 0.67, 0.18),
};
const masonry = { wall: 'brick', color: C.brick, roof: 'slate', roofColor: C.slate };

function roof(out, bounds, eave, rise, lod, transverse = false, exhibition = false) {
  const [x0, z0, x1, z1] = bounds;
  const [u0, u1] = transverse ? [z0, z1] : [x0, x1];
  const [v0, v1] = transverse ? [x0, x1] : [z0, z1];
  const center = (v0 + v1) / 2,
    half = (v1 - v0) / 2 + 0.33;
  const extra = exhibition ? 0.51 : 0.21;
  const point = (u, v, y) => (transverse ? [v, y, u] : [u, y, v]);
  const cross =
    lod === 0
      ? [
          [0, 1],
          [1, -0.065],
        ]
      : [
          [0, 1],
          [0.31, 0.58],
          [0.66, 0.236],
          [1, -0.065],
        ];
  const ends = exhibition
    ? [
        [u0 - extra, 0.31],
        [u0 + 0.84, 0],
        [u1 - 0.84, 0],
        [u1 + extra, 0.31],
      ]
    : [
        [u0 - extra, 0],
        [u1 + extra, 0],
      ];
  const section = (u, lift, v, h) => point(u, center + v * half, eave + h * rise + lift);
  for (const sign of [-1, 1]) {
    for (const [[a, lift], [b, endLift]] of pairs(ends))
      for (const [[v, h], [w, k]] of pairs(cross))
        face(
          out,
          'roof',
          [
            section(a, lift, v * sign, h),
            section(b, endLift, v * sign, h),
            section(b, endLift, w * sign, k),
            section(a, lift, w * sign, k),
          ],
          up,
          C.roof,
        );
    for (const [u, lift, normal] of [
      [ends[0][0], ends[0][1], -1],
      [ends.at(-1)[0], ends.at(-1)[1], 1],
    ]) {
      const target = transverse ? [0, 0, normal] : [normal, 0, 0];
      for (const [[v, h], [w, k]] of pairs(cross))
        face(
          out,
          'brick',
          [
            section(u, lift, v * sign, h),
            section(u, lift, w * sign, k),
            point(u, center + w * half * sign, eave - 0.16),
            point(u, center + v * half * sign, eave - 0.16),
          ],
          target,
          C.brick,
        );
    }
    if (lod < 2) continue;
    const pitch = exhibition ? 0.29 : 0.32;
    const n = Math.max(2, Math.round((u1 - u0) / pitch));
    for (let j = 0; j <= n; j++) {
      if (lod === 2 && j % 2) continue;
      const u = mix(u0 - extra + 0.03, u1 + extra - 0.03, j / n);
      const lift = exhibition
        ? 0.31 * Math.max(0, 1 - Math.min(u - u0 + extra, u1 + extra - u) / (extra + 0.84))
        : 0;
      const path = cross.map(([v, h]) => section(u, lift + 0.037, v * sign, h));
      beamPath(out, 'tile', path, exhibition ? 0.095 : 0.068, 0.057, j % 4 === 0 ? C.eave : C.tile);
    }
  }
  beamPath(
    out,
    'tile',
    ends.map(([u, lift]) => section(u, lift + 0.08, 0, 1)),
    exhibition ? 0.26 : 0.16,
    exhibition ? 0.22 : 0.14,
    C.ridge,
  );
  if (lod > 0)
    for (const sign of [-1, 1]) {
      const line = ends.map(([u, lift]) => section(u, lift, sign, -0.071));
      beamPath(out, 'wood', line, 0.123, 0.121, C.eave);
    }
}

function domesticFront(out, wall, y, eave, bays, lod) {
  const width = wall.length / bays;
  for (let i = 0; i < bays; i++) {
    const x = (i + 0.5) * width,
      span = Math.min(width * 0.37, 1.28),
      door = bays === 3 && i === 1;
    const base = y + (door ? 0.04 : 0.84),
      top = y + (door ? 2.25 : 2.13);
    opening(
      out,
      wall,
      x - span,
      x + span,
      base,
      top,
      'wood',
      door ? C.sash : C.paper,
      'glass',
      C.red,
      lod,
      0.035,
    );
    if (lod < 1) continue;
    const stile = door ? 7 : 5;
    for (let k = 0; k <= stile; k++) {
      if (lod === 1 && k % 2) continue;
      const u = x + mix(-span, span, k / stile);
      panel(out, 'wood', wall, u - 0.028, u + 0.028, base, top, 0.079, C.red);
    }
    panel(out, 'wood', wall, x - span, x + span, top - 0.4, top - 0.335, 0.1, C.red);
    if (lod > 1) {
      trimBlock(
        out,
        'skirt',
        wall,
        x - span - 0.09,
        x + span + 0.09,
        base - 0.15,
        base - 0.04,
        0.016,
        0.25,
        C.skirt,
      );
      panel(out, 'wood', wall, x - span, x + span, top - 0.21, top - 0.153, 0.093, C.wood);
      if (door) panel(out, 'wood', wall, x - span, x + span, base, base + 0.54, 0.09, C.wood);
    }
  }
  if (lod < 1) return;
  panel(out, 'wood', wall, 0, wall.length, eave - 0.29, eave - 0.07, 0.036, C.eave);
}

function house(out, bounds, y, grade, eaveHeight, ridgeHeight, front, bays, lod) {
  const polygon = rect(...bounds);
  const bottom = (p) => Math.min(y - 0.22, grade(p) - 0.18);
  const top = y + eaveHeight;
  shell(out, polygon, bottom, top, masonry);
  const walls = pairs(closed(polygon));
  const facade = edge(...walls[front]);
  domesticFront(out, facade, y, top, bays, lod);
  if (lod > 0)
    for (const [a, b] of walls) {
      const w = edge(a, b);
      panel(out, 'skirt', w, 0, w.length, y - 0.12, y + 0.37, 0.019, C.skirt);
    }
  roof(out, bounds, top, ridgeHeight, lod, front === 1 || front === 3);
}

function gate(out, bounds, y, grade, lod) {
  const [l, a, r, b] = bounds,
    span = r - l,
    base = Math.min(grade([l, b]), grade([r, b]), y - 0.26) - 0.16;
  const wall = edge([r, b], [l, b]),
    openingLeft = 0.61,
    openingRight = span - 0.6;
  for (const [x0, x1] of [
    [l, l + 0.6],
    [r - 0.61, r],
  ])
    block(out, 'brick', x0, base, a, x1 - x0, y + 2.49 - base, b - a, C.brick);
  trimBlock(
    out,
    'wood',
    wall,
    openingLeft - 0.02,
    openingRight + 0.02,
    y + 2.08,
    y + 2.49,
    0,
    0.16,
    C.black,
  );
  trimBlock(
    out,
    'wood',
    wall,
    openingLeft,
    openingRight,
    y + 0.075,
    y + 2.085,
    -0.39,
    -0.24,
    C.black,
  );
  trimBlock(out, 'skirt', wall, openingLeft, openingRight, base, y + 0.09, -0.38, 0.22, C.skirt);
  roof(out, bounds, y + 2.51, 0.78, lod);
  if (lod === 0) return;
  const center = (openingLeft + openingRight) / 2;
  for (const u of [openingLeft, center, openingRight])
    panel(out, 'wood', wall, u - 0.022, u + 0.022, y + 0.12, y + 2.14, -0.223, C.gold);
  panel(out, 'wood', wall, openingLeft, openingRight, y + 2.149, y + 2.18, -0.204, C.gold);
  if (lod < 2) return;
  const mark = span * 0.64;
  panel(out, 'plate', wall, mark - 0.22, mark + 0.22, y + 2.269, y + 2.453, 0.179, C.blue);
  const numX = mark + 0.03;
  const digits = [
    [
      [numX - 0.12, 2.405],
      [numX - 0.034, 2.405],
      [numX - 0.034, 2.369],
      [numX - 0.12, 2.34],
      [numX - 0.12, 2.31],
      [numX - 0.034, 2.31],
    ],
    [
      [numX + 0.046, 2.396],
      [numX + 0.09, 2.411],
      [numX + 0.09, 2.31],
    ],
  ];
  for (const stroke of digits)
    beamPath(
      out,
      'plate',
      stroke.map(([u, h]) => wall.p(u, y + h, 0.188)),
      0.012,
      0.012,
      C.white,
    );
}

function enclosure(out, court, y, ground, lod) {
  const [l, n, r, s] = court;
  const fence = [
    [l, s],
    [l, n],
    [r, n],
    [r, s - 1.68],
  ];
  for (const [a, b] of pairs(fence)) {
    const w = edge(a, b);
    const end = l === a[0] && l === b[0] ? 2.07 : 1.96;
    face(
      out,
      'brick',
      [at(a, ground(a) - 0.18), at(b, ground(b) - 0.18), at(b, y + end), at(a, y + end)],
      w.normal,
      C.brick,
    );
    face(
      out,
      'brick',
      [at(a, ground(a) - 0.18), at(b, ground(b) - 0.18), at(b, y + end), at(a, y + end)],
      w.normal.map((x) => -x),
      C.brick,
    );
    trimBlock(out, 'tile', w, 0, w.length, y + end - 0.08, y + end + 0.057, -0.1, 0.1, C.ridge);
  }
  // Paving follows the low terrace between the two domestic ranges.
  const paving = rect(l + 0.24, -9.57, r - 0.16, 6.88);
  cap(out, 'slate', paving, y, C.slate);
  cap(out, 'slate', rect(l + 0.21, n + 0.11, r - 0.24, -14.21), y - 0.026, C.skirt);
  if (lod < 1) return;
  const seamSize = lod === 3 ? 0.65 : 1.3;
  for (let x = -5.4; x < 3.0; x += seamSize)
    block(out, 'slate', x, y + 0.003, -9.46, 0.017, 0.006, 16.24, C.joint);
  if (lod >= 2)
    for (let z = -8.8; z < 6.3; z += seamSize)
      block(out, 'slate', -5.4, y + 0.004, z, 8.43, 0.006, 0.015, C.joint);
}

function lilac(out, x, z, y, lod) {
  const sides = lod === 3 ? 10 : 6;
  ring(
    out,
    'slate',
    [x, z],
    [
      [y, 0.67],
      [y + 0.16, 0.67],
      [y + 0.21, 0.55],
    ],
    sides,
    C.planters,
  );
  ring(
    out,
    'wood',
    [x, z],
    [
      [y + 0.15, 0.105],
      [y + 2.38, 0.048],
    ],
    sides,
    C.bark,
  );
  const branches = [
    [0.05, -0.3, 2.92],
    [-0.69, 0.25, 2.52],
    [0.59, 0.33, 2.72],
  ];
  for (const [dx, dz, high] of branches) {
    const center = [x + dx, z + dz];
    beamPath(
      out,
      'wood',
      [
        [x, y + 1.1, z],
        [x + dx, y + high - 0.21, z + dz],
      ],
      0.075,
      0.075,
      C.bark,
    );
    ring(
      out,
      'leaf',
      center,
      [
        [y + high - 0.68, 0.12],
        [y + high - 0.39, 0.69],
        [y + high + 0.12, 0.81],
        [y + high + 0.47, 0.075],
      ],
      sides,
      C.leaf,
    );
    if (lod === 3)
      ring(
        out,
        'leaf',
        [center[0] - 0.18, center[1] + 0.15],
        [
          [y + high + 0.13, 0.21],
          [y + high + 0.28, 0.48],
          [y + high + 0.59, 0.05],
        ],
        sides,
        C.youngLeaf,
      );
  }
}

function exhibition(out, bounds, deck, grade, lod) {
  const [l, a, r, b] = bounds,
    polygon = rect(l + 0.08, a + 0.19, r - 0.08, b - 0.15),
    bottom = (p) => Math.min(deck - 0.33, grade(p) - 0.24);
  const roofHeight = deck + 4.25,
    front = edge([r - 0.08, b - 0.15], [l + 0.08, b - 0.15]);
  shell(out, polygon, bottom, deck, masonry);
  shell(
    out,
    polygon,
    () => deck,
    roofHeight,
    masonry,
    (i) => i !== 2,
  );
  panel(out, 'sash', front, 0, front.length, deck, roofHeight, -0.44, C.sash);
  const width = front.length / 3;
  for (let i = 0; i < 3; i++) {
    const start = i * width + 0.14,
      end = (i + 1) * width - 0.14;
    const mid = (start + end) / 2;
    panel(
      out,
      'glass',
      front,
      start,
      end,
      deck + 0.05,
      deck + 3.08,
      -0.408,
      i === 1 ? C.highlight : C.glass,
    );
    if (lod > 0)
      for (const u of [start, mid, end])
        panel(out, 'sash', front, u - 0.047, u + 0.047, deck + 0.07, deck + 3.08, -0.385, C.sash);
    if (lod > 1)
      for (let j = 1; j < 9; j++) {
        const u = mix(start, end, j / 9);
        panel(out, 'sash', front, u - 0.027, u + 0.027, deck + 3.23, deck + 3.53, -0.373, C.red);
      }
  }
  for (let i = 0; i <= 3; i++) {
    const u = 0.12 + ((front.length - 0.24) * i) / 3;
    trimBlock(out, 'wood', front, u - 0.128, u + 0.128, deck, roofHeight, 0.001, 0.26, C.red);
    if (lod > 0)
      trimBlock(
        out,
        'wood',
        front,
        u - 0.19,
        u + 0.19,
        deck + 3.51,
        deck + 3.89,
        0.003,
        0.32,
        C.wood,
      );
  }
  trimBlock(out, 'wood', front, 0, front.length, deck + 3.55, roofHeight, 0, 0.16, C.wood);
  if (lod > 0)
    panel(
      out,
      'wood',
      front,
      width + 0.26,
      2 * width - 0.26,
      deck + 3.43,
      deck + 3.87,
      0.18,
      C.sash,
    );
  if (lod > 1)
    for (let i = 0; i < 28; i++) {
      const u = ((i + 0.5) * front.length) / 28;
      trimBlock(
        out,
        'wood',
        front,
        u - 0.041,
        u + 0.041,
        roofHeight - 0.22,
        roofHeight - 0.05,
        0.005,
        0.19,
        i % 4 ? C.red : C.eave,
      );
    }
  roof(out, bounds, roofHeight, 1.49, lod, false, true);
  const center = (l + r) / 2;
  const startZ = b + 1.61,
    lowest = Math.min(grade([center, startZ]) - 0.13, deck - 0.36);
  for (let i = 0; i < 5; i++) {
    const z = startZ - 0.29 * (i + 1),
      step = deck - ((deck - lowest) * (4 - i)) / 5;
    block(
      out,
      'skirt',
      center - 1.85 + i * 0.045,
      lowest,
      z,
      3.7 - i * 0.09,
      step - lowest,
      0.295,
      C.skirt,
    );
  }
}

function draw(out, lod, d, grade) {
  const { court, ranges, pavilionBox, houseY, pavilionY } = d;
  enclosure(out, court, houseY, grade, lod);
  for (const [name, eave, ridge, front, bays] of [
    ['north', 2.72, 1.61, 2, 3],
    ['south', 2.43, 1.29, 0, 3],
    ['west', 2.24, 0.75, 1, 2],
    ['east', 2.37, 1.01, 3, 2],
  ])
    house(out, ranges[name], houseY, grade, eave, ridge, front, bays, lod);
  shell(
    out,
    rect(...ranges.study),
    (p) => Math.min(houseY - 0.19, grade(p) - 0.16),
    houseY + 2.43,
    masonry,
  );
  if (lod > 0) {
    const [l, a, r] = ranges.study;
    opening(
      out,
      edge([l, a], [r, a]),
      0.38,
      r - l - 0.35,
      houseY + 1.02,
      houseY + 2.03,
      'wood',
      C.paper,
      'glass',
      C.red,
      lod,
      0.025,
    );
  }
  gate(out, ranges.gate, houseY, grade, lod);
  if (lod > 0) {
    lilac(out, -3.72, 2.12, houseY, lod);
    lilac(out, 1.57, 2.5, houseY, lod);
  }
  exhibition(out, pavilionBox, pavilionY, grade, lod);
}

const site = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [42, 35, 75],
    lookAt: [24, 1.5, 0],
    yaw: 0.43,
    sun: [-320, 690, 530],
    brief:
      'The historic west siheyuan, black No. 21 entrance, short rear study and three-bay tiled entrance pavilion at Beijing Lu Xun Museum.',
    views: [
      {
        name: 'historic-courtyard-and-north-rooms',
        position: [0.8, 5.7, 4.4],
        lookAt: [-0.7, 2.05, -8.7],
      },
      { name: 'number-21-gate', position: [9.6, 4.3, 19.5], lookAt: [4.5, 1.85, 9.8] },
      {
        name: 'rear-study-and-four-domestic-ranges',
        position: [-18, 24, -20],
        lookAt: [-1, 1.25, -4.7],
      },
      {
        name: 'red-column-exhibition-entrance',
        position: [50.2, 4.7, 20.8],
        lookAt: [51.55, 2.76, 4.9],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = site;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { ranges, pavilion: pavilionFootprint } = plan.dimensions;
export const model = {
  ...site.model,
  recipeDependencies: [...site.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Independent architectural geometry grounded in the named OSM site and Overture’s roofprints, the original Terrarium elevation field, and public-domain or CC0 appearance references.',
  buildingCutout: {
    outline: pavilionFootprint,
    outlines: [...Object.values(ranges).map((bounds) => rect(...bounds)), pavilionFootprint],
    minimumCoverage: 0.91,
    basis:
      'Only closely coincident buildings are replaced in the two separate groups, retaining the rest of the museum grounds and hutong.',
  },
};
