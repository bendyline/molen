/** Valley-facing masonry and the limestone contact of Bsharri’s former Mar Sarkis monastery. */
import { readFileSync } from 'node:fs';
import {
  beam,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const native = frame.geometry.outline;
const { floorY, baseY, mainCeiling, eastCeiling, tallWestHeight, eastUpperHeight } = plan.section;

const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  dressed: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  cliff: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.12 },
  mortar: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  accent: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    stone: 'c7a878',
    annex: 'c2a278',
    trim: 'd6b98b',
    darkStone: 'a38b6d',
    rock: 'bd9b74',
    rockShade: 'aa8a6b',
    seam: '927458',
    roof: '8f846f',
    paving: 'b9a385',
    glass: '3e3c34',
    timber: '67513d',
    iron: '504639',
    deep: '312c25',
    leaves: '586844',
    youngLeaf: '718057',
  }).map(([name, value]) => [name, rgb(value)]),
);

function plane(out, slot, x0, x1, y0, y1, z, tint) {
  if (x1 - x0 < 0.002 || y1 - y0 < 0.002) return;
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );
}

function sill(out, x, y, z, span) {
  box(out, 'dressed', [x - span / 2, y - 0.115, z - 0.1], [x + span / 2, y, z + 0.14], color.trim);
}

function opening(out, x, width, y, top, trimCurve, lod, entry) {
  const a = x - width / 2,
    b = x + width / 2,
    depth = entry ? 0.71 : 0.32;
  const sillY = trimCurve.open ? top - trimCurve.rise : top;
  const recess = -depth;
  const w = entry ? color.deep : color.glass;
  plane(out, 'accent', a, b, y, sillY, recess, w);
  face(
    out,
    'masonry',
    [
      [a, y, 0],
      [a, y, recess],
      [a, sillY, recess],
      [a, sillY, 0],
    ],
    color.darkStone,
  );
  face(
    out,
    'masonry',
    [
      [b, y, recess],
      [b, y, 0],
      [b, sillY, 0],
      [b, sillY, recess],
    ],
    color.stone,
  );
  if (!entry) sill(out, x, y, 0, width + 0.23);
  const arch = (s, span, crown, raise) => {
    const t = Math.PI * s;
    return [x - (span * Math.cos(t)) / 2, crown + Math.sin(t) * raise];
  };
  if (trimCurve.open) {
    const segments = [5, 9, 14, 18][lod];
    for (let i = 0; i < segments; i++) {
      const [p, py] = arch(i / segments, width, sillY, trimCurve.rise);
      const [q, qy] = arch((i + 1) / segments, width, sillY, trimCurve.rise);
      face(
        out,
        'masonry',
        [
          [p, py, 0],
          [q, qy, 0],
          [q, qy, recess],
          [p, py, recess],
        ],
        color.darkStone,
      );
      if (i === 0)
        triangle(
          out,
          'accent',
          [
            [p, sillY, recess],
            [q, sillY, recess],
            [q, qy, recess],
          ],
          w,
        );
      else if (i === segments - 1)
        triangle(
          out,
          'accent',
          [
            [p, sillY, recess],
            [q, sillY, recess],
            [p, py, recess],
          ],
          w,
        );
      else
        face(
          out,
          'accent',
          [
            [p, sillY, recess],
            [q, sillY, recess],
            [q, qy, recess],
            [p, py, recess],
          ],
          w,
        );
    }
  } else {
    face(
      out,
      'masonry',
      [
        [a, top, recess],
        [b, top, recess],
        [b, top, 0],
        [a, top, 0],
      ],
      color.darkStone,
    );
  }

  if (lod > 0) {
    const relief = width + (entry ? 0.22 : 0.49),
      bottom = top - (entry ? trimCurve.rise : 0.42);
    const pieces = lod < 2 ? (entry ? 5 : 0) : entry ? 11 : 7;
    for (let i = 0; i < pieces; i++) {
      const [p, py] = arch((i + 0.05) / pieces, relief, bottom, trimCurve.relief);
      const [q, qy] = arch((i + 0.95) / pieces, relief, bottom, trimCurve.relief);
      beam(
        out,
        'dressed',
        [p, py, 0.055],
        [q, qy, 0.055],
        entry ? 0.29 : 0.16,
        0.13,
        i % 3 ? color.trim : color.stone,
      );
    }
    const bars = entry ? 2 : Math.max(2, Math.ceil(width / 0.24));
    for (let i = 1; i <= bars; i++) {
      const s = a + (i * width) / (bars + 1);
      box(
        out,
        'iron',
        [s - 0.023, y, recess + 0.075],
        [s + 0.023, sillY, recess + 0.13],
        color.iron,
      );
    }
    const divisions = entry ? 3 : 5;
    for (let i = 1; i < divisions; i++) {
      const sy = y + ((sillY - y) * i) / divisions;
      box(out, 'iron', [a, sy - 0.022, recess + 0.065], [b, sy + 0.022, recess + 0.12], color.iron);
    }
  }
}

function facade(out, from, to, bottom, top, bays, lod, tint) {
  const dx = to[0] - from[0],
    dz = to[1] - from[1],
    length = Math.hypot(dx, dz);
  const local = transform(out, Math.atan2(-dz, dx), [from[0], 0, from[1]]);
  let start = 0;
  for (const [center, width, y, openingTop, kind] of bays) {
    const x = length * center,
      a = x - width / 2,
      b = x + width / 2;
    const arch =
      kind === 'arch'
        ? { open: true, rise: 0.92, relief: 1.1 }
        : kind === 'round'
          ? { open: true, rise: 0.25, relief: 0.41 }
          : { open: false, rise: 0, relief: 0.58 };
    plane(local, 'masonry', start, a, bottom, top, 0, tint);
    plane(local, 'masonry', a, b, bottom, y, 0, tint);
    if (arch.open) {
      const segments = [5, 9, 14, 18][lod];
      const spring = openingTop - arch.rise;
      for (let i = 0; i < segments; i++) {
        const t = (Math.PI * i) / segments,
          u = (Math.PI * (i + 1)) / segments;
        const px = x - (width * Math.cos(t)) / 2,
          qx = x - (width * Math.cos(u)) / 2;
        const py = spring + arch.rise * Math.sin(t),
          qy = spring + arch.rise * Math.sin(u);
        face(
          local,
          'masonry',
          [
            [px, py, 0],
            [qx, qy, 0],
            [qx, top, 0],
            [px, top, 0],
          ],
          tint,
        );
      }
    } else plane(local, 'masonry', a, b, openingTop, top, 0, tint);
    opening(local, x, width, y, openingTop, arch, lod, kind === 'arch');
    start = b;
  }
  plane(local, 'masonry', start, length, bottom, top, 0, tint);
  if (lod > 0) {
    beam(
      local,
      'dressed',
      [0, top - 0.09, 0.012],
      [length, top - 0.09, 0.012],
      0.17,
      0.21,
      color.trim,
    );
  }
}

function deck(out, ring, y) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const [a, b, c] = ids.slice(i, i + 3).map((j) => ring[j]);
    const [p, q, r] =
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0 ? [a, b, c] : [a, c, b];
    triangle(
      out,
      'mortar',
      [p, q, r].map(([x, z]) => [x, y, z]),
      color.roof,
    );
  }
}

function wallsAndDeck(out, lod) {
  const plan = [native[4], native[3], native[2], native[1], native[0], native[5]];
  const fronts = [
    [[0.57, 0.67, 1.34, 2.84, 'slot']],
    [
      [0.14, 2.8, floorY, 3.45, 'arch'],
      [0.37, 0.57, 1.16, 2.87, 'round'],
      [0.465, 0.54, 1.19, 2.52, 'slot'],
      [0.56, 0.58, 1.13, 2.94, 'slot'],
      [0.75, 0.64, 1.21, 3.12, 'slot'],
      [0.9, 0.65, 1.24, 3.14, 'slot'],
    ],
    [],
    [
      [0.32, 0.6, 1.16, 3.05, 'slot'],
      [0.75, 0.58, 1.19, 3.09, 'slot'],
    ],
    [[0.48, 0.62, 1.39, 3.23, 'slot']],
    [],
  ];
  for (let i = 0; i < plan.length; i++) {
    facade(
      out,
      plan[i],
      plan[(i + 1) % plan.length],
      baseY,
      mainCeiling,
      fronts[i],
      lod,
      i <= 2 ? color.stone : color.annex,
    );
  }
  deck(out, plan, mainCeiling - 0.04);
  const low = 4.28,
    top = eastCeiling;
  const eastSegment = [native[1], native[0]];
  beam(
    out,
    'dressed',
    [eastSegment[0][0], top, eastSegment[0][1] + 0.09],
    [eastSegment[1][0], top, eastSegment[1][1] + 0.09],
    0.29,
    0.25,
    color.trim,
  );
  if (lod > 0) {
    beam(
      out,
      'masonry',
      [native[2][0] - 0.04, low, native[2][1] + 0.03],
      [native[3][0] + 0.03, low, native[3][1] + 0.03],
      0.23,
      0.17,
      color.stone,
    );
  }
}

function upperBlock(out, lod, bounds, lo, hi, bays) {
  const [left, right, back, front] = bounds;
  const ring = [
    [left, back],
    [left, front],
    [right, front],
    [right, back],
  ];
  for (let i = 0; i < ring.length; i++) {
    facade(out, ring[i], ring[(i + 1) % ring.length], lo, hi, bays[i] ?? [], lod, color.annex);
  }
  deck(out, ring, hi - 0.12);
  const rail = 0.23;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    beam(
      out,
      'masonry',
      [a[0], hi + rail * 0.35, a[1]],
      [b[0], hi + rail * 0.35, b[1]],
      0.21,
      0.21,
      color.trim,
    );
  }
}

function terrace(out, lod) {
  const z = native[3][1] + 0.035,
    a = native[3][0] - 0.27,
    b = native[2][0] + 0.25;
  box(out, 'masonry', [a, baseY, z - 0.08], [b, floorY - 0.16, z + 1.98], color.darkStone);
  box(out, 'dressed', [a, floorY - 0.17, z - 0.09], [b, floorY, z + 2.03], color.paving);
  const edge = z + 1.81;
  beam(out, 'iron', [a + 0.45, 1.4, edge], [b - 0.3, 1.4, edge], 0.087, 0.078, color.timber);
  if (lod === 0) return;
  beam(out, 'iron', [a + 0.47, 0.62, edge], [b - 0.28, 0.62, edge], 0.045, 0.044, color.iron);
  const rails = lod === 1 ? 15 : lod === 2 ? 30 : 51;
  for (let i = 0; i <= rails; i++) {
    const x = a + 0.48 + (i / rails) * (b - a - 0.9);
    const post = i % Math.round(rails / 7) === 0;
    const w = post ? 0.069 : 0.022;
    box(
      out,
      'iron',
      [x - w, floorY, edge - w],
      [x + w, post ? 1.46 : 1.4, edge + w],
      post ? color.timber : color.iron,
    );
  }
  for (let i = 0; i < 3; i++) {
    box(
      out,
      'dressed',
      [b - 0.22, -0.36, edge - 1.58],
      [b + 0.41 + 0.42 * i, 0.39 - i * 0.19, edge + 0.14],
      color.paving,
    );
  }
}

const rocks = [
  {
    location: [-19.9, -8.4],
    height: 20.6,
    width: 6.6,
    depth: 5.4,
    shift: [2.15, -1.38],
    tint: 'rockShade',
  },
  {
    location: [-11.7, -11.9],
    height: 12.4,
    width: 6.8,
    depth: 4.7,
    shift: [-0.7, 0.6],
    tint: 'rock',
  },
  {
    location: [1.4, -12.8],
    height: 16.8,
    width: 8.3,
    depth: 6.6,
    shift: [-1.48, -0.7],
    tint: 'rock',
  },
  {
    location: [10.9, -9.3],
    height: 26.2,
    width: 8.1,
    depth: 6.1,
    shift: [-2.16, -2.55],
    tint: 'rock',
  },
  {
    location: [19.4, -10.1],
    height: 19.7,
    width: 6.5,
    depth: 7.8,
    shift: [-0.78, -0.72],
    tint: 'rockShade',
  },
];

function rock(out, record, lod, index) {
  const [x, z] = record.location;
  const layers = [
    [-1.8, 1.03],
    [record.height * 0.13, 1.06],
    [record.height * 0.24, 0.92],
    [record.height * 0.36, 0.94],
    [record.height * 0.51, 0.76],
    [record.height * 0.67, 0.77],
    [record.height * 0.83, 0.61],
    [record.height * 0.92, 0.58],
    [record.height, 0.48],
  ];
  const profile =
    lod === 0
      ? [layers[0], layers[4], layers.at(-1)]
      : lod === 1
        ? [layers[0], layers[2], layers[4], layers[6], layers.at(-1)]
        : layers;
  const unique = profile.filter(([y], i) => i === 0 || y > profile[i - 1][0] + 0.8);
  const sides = [6, 10, 14, 18][lod];
  const located = unique.map(([y, r], j) =>
    Array.from({ length: sides }, (_, k) => {
      const angle = (2 * Math.PI * k) / sides;
      const jitter =
        1 + Math.sin(k * 3.21 + j * 2.4 + index) * 0.15 + 0.065 * Math.cos(k * 2.0 - j * 1.4);
      return [
        x + (y / record.height) * record.shift[0] + Math.cos(angle) * record.width * r * jitter,
        y + Math.sin(k * 2.2 + j * 0.9) * (j === unique.length - 1 ? 0.76 : 0.38),
        z + (y / record.height) * record.shift[1] + Math.sin(angle) * record.depth * r * jitter,
      ];
    }),
  );
  const tint = color[record.tint];
  for (let layer = 0; layer < located.length - 1; layer++) {
    const bottom = located[layer],
      top = located[layer + 1];
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      triangle(out, 'cliff', [bottom[j], bottom[i], top[i]], tint);
      triangle(out, 'cliff', [bottom[j], top[i], top[j]], tint);
    }
  }
  const cap = located.at(-1);
  const center = [0, 1, 2].map((i) => cap.reduce((sum, p) => sum + p[i] / sides, 0));
  for (let i = 0; i < sides; i++)
    triangle(out, 'cliff', [center, cap[(i + 1) % sides], cap[i]], tint);
}

function ivy(out, lod) {
  if (lod < 2) return;
  const patches = [
    [-12.21, 4.8, 4.11, 0.62],
    [-11.58, 5.14, 4.09, 0.7],
    [-10.83, 4.8, 4.06, 0.7],
    [-12.36, 5.55, 3.2, 0.68],
    [-11.69, 5.78, 3.11, 0.55],
    [-10.98, 5.93, 3.3, 0.58],
    [-9.71, 5.28, 3.72, 0.65],
    [-12.7, 3.91, 4.24, 0.46],
    [-12.66, 3.16, 4.24, 0.42],
    [-12.55, 2.63, 4.3, 0.35],
    [-12.41, 2.11, 4.27, 0.29],
  ];
  for (const [i, [x, y, z, w]] of patches.entries()) {
    sphere(
      out,
      'accent',
      [x + 2.05, y, z],
      [w, 0.52, 0.17],
      i % 3 ? color.leaves : color.youngLeaf,
      7,
      4,
    );
  }
}

function build(out, lod) {
  wallsAndDeck(out, lod);
  upperBlock(out, lod, [-12.82, -2.1, -4.29, 2.98], mainCeiling - 0.08, tallWestHeight, [
    [[0.54, 0.58, 6.64, 8.13, 'slot']],
    [
      [0.38, 0.61, 6.43, 8.12, 'slot'],
      [0.74, 0.61, 6.4, 7.97, 'slot'],
    ],
    [[0.57, 0.64, 6.75, 8.15, 'slot']],
  ]);
  upperBlock(out, lod, [-2.21, 7.8, -4.33, -0.68], mainCeiling - 0.08, eastUpperHeight, [
    [],
    [[0.42, 0.57, 5.63, 6.83, 'round']],
    [[0.4, 0.57, 5.63, 6.84, 'slot']],
  ]);
  upperBlock(out, lod, [-15.31, -12.86, -4.25, 1.78], mainCeiling - 0.07, 6.57, [
    [],
    [[0.5, 0.49, 5.53, 6.3, 'slot']],
    [],
  ]);
  terrace(out, lod);
  ivy(out, lod);
  rocks.forEach((r, index) => {
    rock(out, r, lod, index);
  });
}

export const gibranSkyline = (out) => build(out, 0);
export const gibranDistrict = (out) => build(out, 1);
export const gibranStreet = (out) => build(out, 2);
export const gibranCloseup = (out) => build(out, 3);
const recipe = 'gibran-museum-model.mjs';
const camera = [31, 13, 54],
  lookAt = [-2, 7, -2];
export const gibranModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: gibranCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'reviewed-source-map-frame',
  progressLedger: 'qualla-003.PROGRESS.md',
  appearance: { kind: 'standing', representedDate: plan.representedDate },
  brief:
    'Bsharri’s Gibran Museum, with the golden stepped Mar Sarkis masonry pressed into exposed limestone and set above a narrow valley-facing terrace.',
  camera,
  lookAt,
  sunDirection: [-29, 45, 40],
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_limestone_raw',
    'stone_limestone_weathered',
    'metal_painted',
    'concrete_plain',
  ],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'southwest-masonry-and-terrace',
      position: [20.2, 5.7, 30.5],
      lookAt: [-1.15, 4.97, 0.65],
    },
    { name: 'old-arched-entry', position: [-22.3, 4.6, 20.3], lookAt: [-12.9, 3.9, 3.7] },
    { name: 'rear-limestone-contact', position: [42, 31, 4], lookAt: [3, 6.8, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'mar-sarkis-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'gibranSkyline',
    errorMeters: 0.54,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'gibranDistrict', 0.3],
        ['street', 'gibranStreet', 0.13],
        ['closeup', 'gibranCloseup', 0.055],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Exact southwestern Qualla original was released to the public domain by Xtcrider. Native OpenStreetMap outline under ODbL 1.0.',
};
