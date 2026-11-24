import fs from 'node:fs';
import {
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, coreSide, mainWallTop, upperSpireBase, summit, porchRoof } = plan.dimensions;
const outline = frame.geometry.outline;
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'stone_limestone_weathered', roughness: 0.97 },
  brick: { slot: 'foundation', graph: 'brick', roughness: 0.97 },
  plaque: { slot: 'trim', graph: 'tile_glazed', roughness: 0.88 },
  gold: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.55, metallic: 0.22 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91 },
};
const cream = rgb('ccc4b0');
const bright = rgb('d6cdb9');
const weathered = rgb('a59a86');
const lightStone = rgb('bcaf9b');
const brick = rgb('9b7460');
const plaque = rgb('9f8e70');
const dark = rgb('5d554a');
const gold = rgb('c5a058');
const paleGold = rgb('d7af5c');
const tau = 2 * Math.PI;

const square = (radius, y, x = 0, z = 0) => [
  [x - radius, y, z + radius],
  [x + radius, y, z + radius],
  [x + radius, y, z - radius],
  [x - radius, y, z - radius],
];
const diamond = (x, z, r, y, n, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (tau * i) / n;
    return [x + r * Math.sin(a), y, z + r * Math.cos(a)];
  });
function lathe(out, slot, x, z, sections, n, color, offset = 0) {
  const rings = sections.map(([y, r]) => diamond(x, z, r, y, n, offset));
  loft(out, slot, rings, color, { cap: false });
}
function cap(out, slot, shape, y, color) {
  const ids = earcut(shape.flat(), [], 2);
  const points = shape.map(([x, z]) => [x, y, z]);
  for (let i = 0; i < ids.length; i += 3)
    tri(out, slot, points[ids[i]], points[ids[i + 2]], points[ids[i + 1]], color);
}
function molding(out, f, x0, x1, y, height, width, color) {
  fbox(out, 'stone', f, x0, x1, y - height / 2, y + height / 2, -0.19, width, color);
}
function slit(out, f, u, y, w, height, depth, lod, trim = true) {
  const p = (x, v, front) => f.P(u + w * x, y + height * v, front);
  const steps =
    lod >= 2
      ? [
          [0.5, 0],
          [0.5, 0.6],
          [0.37, 0.81],
          [0.19, 0.93],
          [0, 1],
          [-0.19, 0.93],
          [-0.37, 0.81],
          [-0.5, 0.6],
        ]
      : [
          [0.5, 0],
          [0.5, 0.6],
          [0, 1],
          [-0.5, 0.6],
        ];
  const ring = [[-0.5, 0], ...steps];
  fan(
    out,
    'shade',
    ring.map(([x, y]) => p(x, y, depth)),
    dark,
  );
  if (trim && lod >= 1) {
    const inside = ring.map(([x, y]) => p(x, y, depth + 0.005));
    const edge = ring.map(([x, y]) => p(x * 1.19, y * 1.09 - 0.027, depth + 0.205));
    for (let i = 1; i < edge.length; i++)
      quad4(out, 'stone', inside[i - 1], inside[i], edge[i], edge[i - 1], lightStone);
  }
}

const arms = [
  { origin: [0, 43.75], direction: [1, 0] },
  { origin: [43.44, -0.28], direction: [0, -1] },
  { origin: [-0.39, -43.87], direction: [-1, 0] },
  { origin: [-43.31, 0], direction: [0, 1] },
];
function frontGable(out, f, lod) {
  const portalDepth = 0.05;
  const sill = 0.94;
  const eave = 9.8;
  const [north, , west] = f.P(0, 0, -7.55);
  const [south, , east] = f.P(0, 0, 0.047);
  gableRoof(out, 'roof', [north, west], [south, east], 14.81, eave, porchRoof, weathered, {
    overhang: 0.3,
    endSlot: 'plaster',
    endColor: cream,
  });
  const top = 8.04;
  const fullArch = [
    [-3, 5.1],
    [-2.82, 5.85],
    [-2.36, 6.59],
    [-1.65, 7.2],
    [-0.83, 7.72],
    [0, top],
    [0.83, 7.72],
    [1.65, 7.2],
    [2.36, 6.59],
    [2.82, 5.85],
    [3, 5.1],
  ];
  const archPoints = lod === 1 ? fullArch.filter((_, i) => i % 2 === 0 || i === 5) : fullArch;
  for (const [a, b] of [
    [-5.76, -3],
    [3, 5.76],
  ])
    fbox(out, 'plaster', f, a, b, sill, eave, -3.0, portalDepth, cream);
  // The crown above the doorway bridges the arch, leaving a real shaded opening.
  for (let i = 1; i < archPoints.length; i++) {
    const [u0, y0] = archPoints[i - 1],
      [u1, y1] = archPoints[i];
    quad4(
      out,
      'plaster',
      f.P(u0, y0, portalDepth),
      f.P(u1, y1, portalDepth),
      f.P(u1, eave, portalDepth),
      f.P(u0, eave, portalDepth),
      cream,
    );
    if (lod >= 1)
      quad4(
        out,
        'stone',
        f.P(u0, y0, portalDepth + 0.028),
        f.P(u1, y1, portalDepth + 0.028),
        f.P(u1 * 1.13, y1 + 0.43, portalDepth + 0.22),
        f.P(u0 * 1.13, y0 + 0.43, portalDepth + 0.22),
        lightStone,
      );
  }
  fbox(out, 'shade', f, -3.24, 3.24, sill, top + 0.2, -2.14, -2.055, rgb('746451'));
  for (const y of [1.1, 2.03, 8.62, 9.45]) molding(out, f, -5.81, 5.81, y, 0.19, 0.23, lightStone);
  if (lod > 0) {
    const decoration = [
      [-7.48, 9.67],
      [-5.33, 11.02],
      [-4.3, 12.3],
      [-3.33, 13.35],
      [-2.5, 13.88],
      [-1.23, 15.26],
      [0, porchRoof + 0.14],
      [1.23, 15.26],
      [2.5, 13.88],
      [3.33, 13.35],
      [4.3, 12.3],
      [5.33, 11.02],
      [7.48, 9.67],
    ];
    beamPath(
      out,
      'stone',
      decoration.map(([x, y]) => f.P(x, y, 0.102)),
      0.36,
      0.32,
      bright,
    );
    for (const u of [-4.68, 4.68]) {
      for (const y of [1.4, 8.39]) molding(out, f, u - 0.69, u + 0.69, y, 0.34, 0.67, bright);
      fbox(out, 'stone', f, u - 0.45, u + 0.45, 1.44, 8.38, -0.13, 0.43, bright);
    }
  }
}
function entrances(out, lod) {
  for (const { origin, direction } of arms) {
    const f = facade(origin, direction);
    fbox(out, 'plaster', f, -12.08, 12.07, 0.52, 9.26, -17.25, -2.1, cream);
    const tip = f.P(0, 0, -1.9);
    const join = f.P(0, 0, -17.2);
    gableRoof(out, 'roof', [join[0], join[2]], [tip[0], tip[2]], 24.2, 9.26, 13.98, weathered, {
      overhang: 0.37,
      endSlot: 'plaster',
      endColor: cream,
    });
    const plane = facade([f.P(0, 0, -2.09)[0], f.P(0, 0, -2.09)[2]], direction);
    for (const y of [1.07, 8.73, 9.19])
      molding(out, plane, -12.18, 12.18, y, 0.23, 0.23, lightStone);
    if (lod > 0) {
      for (const u of [-9.13, -6.78, 6.78, 9.13]) slit(out, plane, u, 3.7, 1.15, 2.56, 0.084, lod);
      for (const u of [-11.02, -8.04, 8.04, 11.02])
        fbox(out, 'stone', plane, u - 0.25, u + 0.25, 1.53, 8.69, -0.06, 0.38, bright);
    }
    frontGable(out, f, lod);
  }
}
function templeBody(out, lod) {
  extrude(out, 'brick', outline, foundation, 0.73, brick, { top: false });
  cap(out, 'stone', outline, 0.73, lightStone);
  const r = coreSide / 2 + 0.57;
  loft(out, 'plaster', [square(r, 0.78), square(r, mainWallTop)], cream);
  for (const rise of [
    [
      [0.73, r],
      [0.93, r + 0.18],
      [1.44, r + 0.29],
      [1.7, r - 0.02],
    ],
    [
      [8.37, r],
      [8.55, r + 0.14],
      [8.72, r + 0.42],
      [9.24, r + 0.42],
      [9.78, r - 0.03],
    ],
  ])
    loft(
      out,
      'stone',
      rise.map(([y, w]) => square(w, y)),
      lightStone,
      { cap: false },
    );
  if (lod < 1) return;
  const faces = [
    facade([0, r], [1, 0]),
    facade([r, 0], [0, -1]),
    facade([0, -r], [-1, 0]),
    facade([-r, 0], [0, 1]),
  ];
  for (const f of faces) {
    for (const side of [-1, 1]) {
      for (const offset of [13.25, 17.25, 21.27, 25.48]) {
        const u = offset * side;
        if (lod >= 2) fbox(out, 'stone', f, u - 0.41, u + 0.41, 1.56, 8.52, -0.09, 0.43, bright);
        slit(out, f, u + side * 1.54, 3.02, 0.97, 3.03, 0.09, lod);
        if (lod >= 2) {
          slit(out, f, u + side * 1.54, 6.49, 0.74, 1.55, 0.09, lod, false);
          molding(out, f, u - 0.62, u + 0.62, 1.52, 0.31, 0.51, lightStone);
        }
      }
    }
  }
}

const terraceProfiles = [
  [
    [9.57, 27.21],
    [10.16, 27.03],
    [10.55, 26.01],
    [11.33, 25.7],
    [12.19, 24.43],
  ],
  [
    [12.19, 24.43],
    [12.48, 24.42],
    [12.77, 23.52],
    [14.55, 22.15],
    [15.58, 21.76],
  ],
  [
    [15.58, 21.76],
    [16.29, 20.83],
    [16.69, 19.98],
    [17.97, 18.72],
    [19.16, 17.74],
  ],
  [
    [19.16, 17.74],
    [19.68, 17.48],
    [20.29, 16.2],
    [21.37, 15.65],
    [22.39, 14.77],
  ],
  [
    [22.39, 14.77],
    [22.86, 14.62],
    [23.22, 13.44],
    [24.39, 12.76],
    [25.71, 11.94],
  ],
  [
    [25.71, 11.94],
    [26.08, 11.89],
    [26.59, 11.08],
    [27.48, 10.48],
    [28.55, 9.43],
  ],
];
function terraces(out, lod) {
  for (const [tier, profile] of terraceProfiles.entries()) {
    const blank = lod === 0 ? [profile[0], profile[2], profile[4]] : profile;
    loft(
      out,
      tier % 2 === 0 ? 'stone' : 'roof',
      blank.map(([y, r]) => square(r, y)),
      tier % 2 === 0 ? lightStone : weathered,
      { cap: false },
    );
    const [y, r] = profile[2];
    if (lod < 2) continue;
    loft(out, 'stone', [square(r + 0.16, y - 0.15), square(r + 0.13, y + 0.1)], bright, {
      cap: false,
    });
    const panels = lod === 3 ? 18 : 10;
    for (const f of [
      facade([0, r], [1, 0]),
      facade([r, 0], [0, -1]),
      facade([0, -r], [-1, 0]),
      facade([-r, 0], [0, 1]),
    ]) {
      for (let i = 0; i < panels; i++) {
        const u = ((i + 0.5) / panels - 0.5) * 2 * (r - 0.9);
        fbox(out, 'plaque', f, u - 0.105, u + 0.105, y - 0.57, y - 0.22, -0.005, 0.054, plaque);
      }
    }
  }
}
function stupa(out, x, z, floor, height, radius, lod, gilded) {
  const n = lod === 0 ? 6 : lod === 1 ? 8 : 14;
  const slot = gilded ? 'gold' : 'stone';
  const color = gilded ? paleGold : bright;
  const profile =
    lod === 0
      ? [
          [0, 1],
          [0.25, 0.93],
          [0.48, 0.66],
          [1, 0.026],
        ]
      : [
          [0, 1],
          [0.13, 1],
          [0.2, 0.84],
          [0.29, 0.9],
          [0.39, 0.78],
          [0.57, 0.52],
          [0.71, 0.41],
          [0.75, 0.47],
          [0.83, 0.25],
          [1, 0.017],
        ];
  const section = lod === 1 ? profile.filter((_, i) => [0, 1, 3, 6, 9].includes(i)) : profile;
  lathe(
    out,
    slot,
    x,
    z,
    section.map(([y, r]) => [floor + y * height, radius * r]),
    n,
    color,
  );
}
function finials(out, lod) {
  const lower = [
    [23.1, 10.68, 5.85, 2.12, false],
    [15.35, 19.76, 5.52, 1.58, false],
    [10.02, 26.28, 7.5, 1.52, true],
  ];
  for (const [offset, y, height, r, gilded] of lower) {
    for (const x of [-offset, offset])
      for (const z of [-offset, offset]) stupa(out, x, z, y, height, r, lod, gilded);
  }
  if (lod < 2) return;
  for (const x of [-1, 1]) {
    for (const u of [-1, 1]) {
      stupa(out, x * 19.31, u * 19.31, 16.35, 4.7, 1.23, lod, false);
      stupa(out, x * 7.28, u * 33.16, 11.11, 3.68, 0.92, lod, false);
      stupa(out, x * 33.16, u * 7.28, 11.11, 3.68, 0.92, lod, false);
    }
  }
}
function shikhara(out, lod) {
  loft(
    out,
    'stone',
    [
      square(9.5, 28.49),
      square(8.59, 29.33),
      square(8.23, 30.82),
      square(7.33, 31.36),
      square(7.03, upperSpireBase),
    ],
    lightStone,
  );
  const n = lod === 0 ? 12 : lod === 1 ? 20 : 32;
  const head = [
    [upperSpireBase - 0.12, 8.38],
    [34.41, 8.31],
    [36.1, 7.58],
    [37.6, 6.93],
    [39.15, 6.31],
    [40.67, 5.64],
    [42.08, 4.71],
    [43.52, 3.51],
    [44.24, 2.58],
    [44.85, 1.81],
    [45.13, 1.78],
    [45.52, 2.27],
    [45.88, 2.01],
    [46.18, 1.65],
    [47.12, 1.41],
    [47.41, 1.58],
    [47.7, 1.16],
    [48.54, 0.86],
    [49.68, 0.51],
    [summit, 0.038],
  ];
  const simple = lod === 0 ? head.filter((_, i) => [0, 3, 6, 9, 11, 16, 19].includes(i)) : head;
  lathe(out, 'gold', 0, 0, simple, n, gold, Math.PI / 8);
  if (lod < 2) return;
  const rows = lod === 3 ? 12 : 7;
  for (let i = 0; i < rows; i++) {
    const y = 34.91 + (i * 8.82) / rows;
    const upper = head.findIndex(([h]) => h > y);
    const [[y0, a], [y1, b]] = [head[upper - 1], head[upper]];
    const r = a + ((y - y0) / (y1 - y0)) * (b - a);
    lathe(
      out,
      'gold',
      0,
      0,
      [
        [y, r + 0.074],
        [y + 0.104, r + 0.095],
        [y + 0.16, r - 0.021],
      ],
      n,
      i % 2 ? gold : paleGold,
      Math.PI / 8,
    );
  }
  const dirs = [
    facade([0, 1], [1, 0]),
    facade([1, 0], [0, -1]),
    facade([0, -1], [-1, 0]),
    facade([-1, 0], [0, 1]),
  ];
  for (const f of dirs) {
    for (const [y, d, w] of [
      [35.0, 7.29, 0.52],
      [36.96, 6.1, 0.48],
      [38.94, 5.39, 0.42],
      [40.7, 4.56, 0.37],
    ])
      slit(out, f, 0, y, w, 0.61, d, lod, false);
  }
}
function build(out, lod) {
  templeBody(out, lod);
  entrances(out, lod);
  terraces(out, lod);
  finials(out, lod);
  shikhara(out, lod);
}
export function skyline(out) {
  extrude(out, 'plaster', outline, foundation, 9.26, cream, { top: false });
  cap(out, 'stone', outline, 9.26, lightStone);
  for (const { origin, direction } of arms) {
    const f = facade(origin, direction);
    const [x0, , z0] = f.P(0, 0, -16.95);
    const [x1, , z1] = f.P(0, 0, -0.62);
    gableRoof(out, 'roof', [x0, z0], [x1, z1], 23.85, 9.24, porchRoof - 0.62, weathered, {
      overhang: 0.18,
      endSlot: 'plaster',
      endColor: cream,
    });
  }
  terraces(out, 0);
  finials(out, 0);
  shikhara(out, 0);
}
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'ananda-temple-model.mjs';
const camera = [110, 68, 112];
const lookAt = [0, 20.3, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Bagan’s Ananda Temple, with four gabled porticoes, stepped stupas and the gilded central shikhara.',
  camera,
  lookAt,
  sunDirection: [57, 60, 44],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'The named cruciform temple building and all attached porticoes.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'four-porches-and-gilded-shikhara', position: camera, lookAt },
    { name: 'carved-porch-over-deep-arch', position: [27, 14, 72], lookAt: [0, 12, 36] },
    { name: 'terraced-roofs-and-corner-stupas', position: [49, 47, 43], lookAt: [7, 27, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ananda-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.33, surfaces },
      street: { export: 'street', errorMeters: 0.108, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.044, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
