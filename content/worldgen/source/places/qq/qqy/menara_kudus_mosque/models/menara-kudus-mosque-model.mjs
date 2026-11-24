import fs from 'node:fs';
import {
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const controls = JSON.parse(
  fs.readFileSync(new URL('../native-map/menara-kudus-site-controls.json', import.meta.url)),
);
const outline = outwardRing(frame.geometry.outline);
const {
  foundation,
  towerCenter,
  towerHeight,
  towerFoot,
  entryFront,
  entryCenterZ,
  mosqueDomeBase,
  gateHeight,
} = plan.dimensions;
const link = outwardRing(controls.roofControls[0].polygon);
const brick = rgb('a5664e');
const deepBrick = rgb('855141');
const brightBrick = rgb('ad755c');
const tile = rgb('8b5a49');
const shingle = rgb('674e42');
const wood = rgb('86694f');
const cream = rgb('dedbcc');
const green = rgb('6b7b55');
const pearl = rgb('dad5bb');
const cobalt = rgb('88919f');
const silver = rgb('a6adb0');
const stone = rgb('928575');
const dark = rgb('505653');
const gold = rgb('baa473');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  paint: { slot: 'wall', graph: 'stucco', roughness: 0.91 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.61, metallic: 0.22 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59 },
  ceramic: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.72 },
};

function box(out, slot, x, z, y0, y1, w, d, color) {
  abox(out, slot, [x - w / 2, y0, z - d / 2], [x + w / 2, y1, z + d / 2], color);
}

function square([x, z], y, w, d = w) {
  return [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ];
}

function shaped(out, slot, center, profile, color, cap = false) {
  loft(
    out,
    slot,
    profile.map(([y, width, depth]) => square(center, y, width, depth)),
    color,
    { cap },
  );
}

function volume(out, slot, profile, y0, y1, tint, roofSlot, roofTint) {
  extrude(out, slot, profile, y0, y1, tint, { top: false });
  const indices = earcut(profile.flat(), [], 2);
  const point = (i) => [profile[i][0], y1, profile[i][1]];
  for (let i = 0; i < indices.length; i += 3)
    tri(out, roofSlot, point(indices[i]), point(indices[i + 2]), point(indices[i + 1]), roofTint);
}

function disk(out, f, u, y, depth, radius, color, sides) {
  const c = f.P(u, y, depth);
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * 2 * Math.PI;
    const b = ((i + 1) / sides) * 2 * Math.PI;
    tri(
      out,
      'ceramic',
      c,
      f.P(u + radius * Math.cos(a), y + radius * Math.sin(a), depth),
      f.P(u + radius * Math.cos(b), y + radius * Math.sin(b), depth),
      color,
    );
  }
}

function niche(out, f, u, y, w, h, lod, door = false) {
  opening(out, f, u, y, w, h, {
    head: 'pointed',
    rise: w * 0.5,
    glassSlot: door ? 'wood' : 'brick',
    frameSlot: 'brick',
    glass: door ? wood : deepBrick,
    frame: brightBrick,
    d: 0.065,
    frameDepth: 0.13,
    frameWidth: lod > 1 ? 0.14 : 0.055,
    sill: false,
  });
}

const masonrySection = [
  [0.42, 9.1],
  [0.58, 8.95],
  [1.32, 8.95],
  [1.58, 8.52],
  [1.83, 8.46],
  [2.69, 8.46],
  [2.75, 8.61],
  [2.98, 8.61],
  [3.22, 8.37],
  [3.38, 8.04],
  [3.58, 7.83],
  [4.46, 7.83],
  [4.58, 8.04],
  [4.72, 8.04],
  [4.8, 8.67],
  [5.04, 8.67],
  [5.23, 8.5],
  [5.39, 8.14],
  [5.55, 8.06],
  [6.34, 8.06],
  [6.53, 8.49],
  [6.72, 8.49],
  [7.02, 7.9],
  [7.42, 7.15],
  [7.87, 6.42],
  [8.14, 6.0],
  [8.4, 5.68],
  [10.22, 5.68],
  [10.28, 5.93],
  [10.56, 5.93],
  [10.76, 5.62],
  [12.34, 5.62],
  [12.56, 5.97],
  [12.83, 6.33],
  [13.02, 6.75],
  [13.29, 6.92],
  [13.52, 7.16],
  [13.7, 7.16],
];
const skylineSection = new Set([0, 5, 8, 11, 14, 16, 19, 20, 26, 29, 31, 35, 36]);

function menara(out, lod) {
  const [x, z] = towerCenter;
  box(out, 'stone', x, z, foundation, 0.42, towerFoot, towerFoot, stone);
  shaped(
    out,
    'brick',
    towerCenter,
    lod === 0 ? masonrySection.filter((_, i) => skylineSection.has(i)) : masonrySection,
    brick,
  );
  box(out, 'wood', x, z, 13.67, 14.06, 7.25, 7.25, wood);
  // Open-sided timber bedug pavilion with a deep first roof and a smaller upper roof.
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      box(out, 'wood', x + 2.8 * a, z + 2.8 * b, 13.93, 15.75, 0.23, 0.23, wood);
  for (const [height, span, rise] of [
    [15.66, 9.34, 1.17],
    [16.83, 5.39, 0.86],
  ]) {
    shaped(
      out,
      'tile',
      towerCenter,
      [
        [height - 0.15, span * 0.97],
        [height, span],
        [height + rise * 0.3, span * 0.71],
        [height + rise, span * 0.24],
      ],
      shingle,
      true,
    );
  }
  lathe(
    out,
    'metal',
    towerCenter,
    [
      [17.48, 0.46, 0.46],
      [17.58, 0.51, 0.51],
      [17.79, 0.13, 0.13],
      [towerHeight, 0, 0],
    ],
    lod > 1 ? 12 : 6,
    silver,
  );
  const clock = facade([x + 3.48, z], [0, -1]);
  fbox(out, 'wood', clock, -0.89, 0.89, 13.96, 15.51, -0.19, 0.15, wood);
  disk(out, clock, 0, 14.74, 0.157, 0.61, pearl, lod > 1 ? 24 : 12);
  if (lod === 0) return;
  beamPath(
    out,
    'wood',
    [clock.P(-0.32, 14.51, 0.175), clock.P(0, 14.74, 0.175), clock.P(0.11, 15.13, 0.175)],
    0.063,
    0.06,
    dark,
  );
  for (const p of [
    [1, 0, 0, -1],
    [-1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, -1, -1, 0],
  ]) {
    const [dx, dz, u, v] = p;
    const panel = facade([x + 4.03 * dx, z + 4.03 * dz], [u, v]);
    const upper = facade([x + 2.82 * dx, z + 2.82 * dz], [u, v]);
    niche(out, upper, 0, 8.65, dx === -1 ? 1.24 : 1.02, 1.64, lod, dx === -1);
    for (const y of [3.75, 5.74]) {
      const panelCount = y > 5 ? 9 : 5;
      for (let a = 0; a < panelCount; a++) {
        const loc = (a - (panelCount - 1) / 2) * (y > 5 ? 0.78 : 1.46);
        if (lod > 1)
          fbox(
            out,
            'brick',
            panel,
            loc - 0.32,
            loc + 0.32,
            y - 0.05,
            y + 0.57,
            -0.04,
            0.08,
            brightBrick,
          );
        if (y > 5 || a % 2 === 1)
          disk(
            out,
            panel,
            loc,
            y + 0.24,
            0.105,
            y > 5 ? 0.2 : 0.139,
            (a + Math.abs(dx)) % 3 === 0 ? cobalt : pearl,
            lod > 1 ? 14 : 6,
          );
      }
    }
    if (lod < 2) continue;
    for (const y of [3.22, 3.46, 4.5, 5.38, 6.48]) {
      const outer = y === 3.22 ? 4.21 : y === 6.48 ? 4.19 : 4.07;
      const edge = facade([x + outer * dx, z + outer * dz], [u, v]);
      fbox(
        out,
        'brick',
        edge,
        -outer + 0.018,
        outer - 0.018,
        y,
        y + 0.087,
        -0.06,
        0.075,
        deepBrick,
      );
    }
  }
  if (lod < 3) return;
  for (const t of [-1, 1]) {
    for (const [roofY, span] of [
      [15.66, 9.34],
      [16.83, 5.39],
    ]) {
      const n = roofY < 16 ? 13 : 7;
      for (let i = 1; i < n; i++) {
        const delta = (i / n - 0.5) * span;
        box(
          out,
          'tile',
          x + delta,
          z + t * (span * 0.49),
          roofY - 0.03,
          roofY + 0.14,
          0.093,
          0.17,
          tile,
        );
        box(
          out,
          'tile',
          x + t * (span * 0.49),
          z + delta,
          roofY - 0.03,
          roofY + 0.14,
          0.17,
          0.093,
          tile,
        );
      }
    }
  }
}

function ogeeDome(out, center, y, radius, height, lod) {
  const sections = [
    [0, 1],
    [0.14, 1.03],
    [0.31, 0.99],
    [0.51, 0.86],
    [0.7, 0.68],
    [0.85, 0.45],
    [0.96, 0.2],
    [1, 0.035],
  ];
  const small = radius < 1;
  const slices = lod === 0 && small ? 5 : [8, 16, 24, 32][lod];
  const profile =
    lod === 0 ? sections.filter((_, i) => i % (small ? 3 : 2) === 0 || i === 7) : sections;
  lathe(
    out,
    'metal',
    center,
    profile.map(([h, r]) => [y + h * height, radius * r, radius * r]),
    slices,
    silver,
  );
  if (lod === 0 && small) return;
  lathe(
    out,
    'metal',
    center,
    [
      [y + height - 0.04, radius * 0.08, radius * 0.08],
      [y + height + radius * 0.22, radius * 0.11, radius * 0.11],
      [y + height + radius * 0.34, radius * 0.042, radius * 0.042],
      [y + height + radius * 0.63, 0, 0],
    ],
    lod > 0 ? 10 : 6,
    silver,
  );
  if (lod < 2) return;
  const count = lod === 3 ? 16 : 12;
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const rib = sections.map(([h, r]) => [
      center[0] + (r * radius + 0.04) * Math.cos(angle),
      y + h * height,
      center[1] + (r * radius + 0.04) * Math.sin(angle),
    ]);
    beamPath(out, 'metal', rib, 0.068, 0.054, silver);
  }
}

function mosque(out, lod) {
  const floor = 0.67;
  volume(out, 'stone', outline, foundation, floor, stone, 'stone', stone);
  volume(out, 'paint', outline, floor - 0.01, 4.93, cream, 'tile', tile);
  const rear = [-34.05, -2.83];
  shaped(
    out,
    'tile',
    rear,
    [
      [4.88, 25.2, 22.3],
      [5.9, 18.4, 16.2],
      [7.33, 11.81, 10.5],
    ],
    tile,
    true,
  );
  shaped(
    out,
    'tile',
    rear,
    [
      [7.29, 13.2, 11.64],
      [8.55, 8.65, 7.92],
      [10.2, 3.2, 3.05],
    ],
    tile,
    true,
  );
  shaped(
    out,
    'tile',
    rear,
    [
      [10.13, 4.35, 4.12],
      [11.35, 1.68, 1.6],
      [11.95, 0.52, 0.51],
    ],
    tile,
    true,
  );
  box(out, 'paint', -18.3, -4.5, foundation, 4.33, 8.2, 8.1, cream);
  volume(out, 'paint', link, foundation, 4.74, cream, 'metal', silver);
  box(out, 'paint', -2.25, entryCenterZ, foundation, 6.02, 12.1, 13.4, cream);
  box(out, 'paint', 3.95, entryCenterZ, foundation, mosqueDomeBase, 6.3, 8.78, cream);
  box(out, 'paint', 3.95, entryCenterZ, 7.08, mosqueDomeBase + 0.12, 6.37, 8.89, green);
  box(out, 'paint', -2.25, entryCenterZ, 5.62, 6.16, 12.25, 13.55, green);
  ogeeDome(out, [2.22, entryCenterZ], mosqueDomeBase - 0.01, 3.42, 4.28, lod);
  const front = facade([entryFront, entryCenterZ], [0, -1]);
  for (const s of [-1, 1]) {
    const center = [entryFront - 0.04, entryCenterZ + s * 4.05];
    lathe(
      out,
      'paint',
      center,
      [
        [0.72, 0.62, 0.62],
        [7.95, 0.5, 0.5],
        [8.58, 0.42, 0.42],
        [9.36, 0.44, 0.44],
      ],
      [5, 8, 12, 12][lod],
      cream,
    );
    for (const y of lod === 0 ? [8.06] : [3.09, 8.06, 9.27])
      lathe(
        out,
        'paint',
        center,
        [
          [y, 0.56, 0.56],
          [y + 0.22, 0.56, 0.56],
        ],
        lod > 1 ? 12 : 8,
        green,
      );
    ogeeDome(out, center, 9.53, 0.62, 0.82, lod);
  }
  opening(out, front, 0, floor, 3.28, 4.65, {
    head: 'pointed',
    rise: 0.94,
    glassSlot: 'glass',
    frameSlot: 'stone',
    glass: dark,
    frame: stone,
    frameWidth: lod > 0 ? 0.21 : 0,
    frameDepth: 0.26,
    sill: false,
  });
  fbox(out, 'paint', front, -3.31, 3.31, 5.54, 6.97, 0.028, 0.17, green);
  if (lod === 0) return;
  fbox(out, 'ceramic', front, -3.41, 3.41, 5.45, 5.54, 0.04, 0.195, gold);
  fbox(out, 'ceramic', front, -3.41, 3.41, 6.96, 7.05, 0.04, 0.195, gold);
  for (const sign of [-1, 1]) {
    const side = facade([-2.27, entryCenterZ + 6.7 * sign], [sign, 0]);
    for (const u of [-4.45, -1.49, 1.49, 4.45]) {
      opening(out, side, u, 1.14, 1.87, 3.29, {
        head: 'pointed',
        rise: 0.65,
        glassSlot: 'glass',
        frameSlot: 'stone',
        glass: dark,
        frame: stone,
        frameWidth: 0.12,
        frameDepth: 0.14,
        sill: false,
        mullions: lod > 2 ? 1 : 0,
      });
    }
    if (lod < 2) continue;
    for (const F of [side, front]) {
      const y = F === front ? mosqueDomeBase + 0.12 : 6.16;
      const count = F === front ? 8 : 13;
      for (let i = 0; i < count; i++) {
        const u = (i - (count - 1) / 2) * 0.78;
        const d = F === front ? 0.09 : -0.06;
        beamPath(
          out,
          'paint',
          [
            F.P(u - 0.29, y - 0.055, d),
            F.P(u - 0.15, y + 0.18, d),
            F.P(u, y + 0.25, d),
            F.P(u + 0.15, y + 0.18, d),
            F.P(u + 0.29, y - 0.055, d),
          ],
          0.1,
          0.17,
          green,
        );
      }
    }
  }
}

function splitGate(out, lod) {
  const front = facade([10.1, entryCenterZ], [0, -1]);
  const steps = [
    [0.2, 1.37, 4.18],
    [0.73, 1.39, 4.14],
    [1.16, 1.44, 3.83],
    [1.8, 1.49, 3.55],
    [2.56, 1.55, 2.99],
    [3.27, 1.61, 2.69],
    [3.69, 1.69, 2.66],
    [4.23, 1.84, 2.64],
    [4.74, 1.89, 2.59],
    [5.17, 1.92, 2.49],
    [5.62, 1.98, 2.43],
    [6.04, 2.05, 2.36],
  ];
  for (const s of [-1, 1]) {
    for (let i = 0; i < steps.length; i++) {
      const [y, inner, outer] = steps[i];
      const upper = steps[i + 1]?.[0] ?? gateHeight;
      if (lod === 0 && i % 2 === 1 && i < steps.length - 1) continue;
      const top = lod === 0 && i % 2 === 0 ? (steps[i + 2]?.[0] ?? gateHeight) : upper;
      const span = [s * inner, s * outer].sort((a, b) => a - b);
      fbox(out, 'brick', front, ...span, y, top, -1.69 + y * 0.084, 0.58 - y * 0.063, brick);
      if (lod > 1)
        fbox(
          out,
          'brick',
          front,
          span[0] - 0.045,
          span[1] + 0.045,
          y,
          y + 0.1,
          -1.71 + y * 0.084,
          0.65 - y * 0.063,
          i % 3 === 0 ? deepBrick : brightBrick,
        );
    }
    fbox(
      out,
      'brick',
      front,
      ...[s * 3.88, s * 7.1].sort((a, b) => a - b),
      0.15,
      1.57,
      -0.96,
      0.35,
      deepBrick,
    );
  }
  const courtyard = facade([6.54, 9.35], [0, -1]);
  fbox(out, 'brick', courtyard, -6.74, 5.28, 0.12, 1.62, -0.29, 0.35, brick);
  fbox(out, 'brick', courtyard, -6.78, 5.32, 1.62, 1.79, -0.37, 0.47, deepBrick);
  if (lod > 1) {
    for (const pier of [-6.54, -2.34, 5.09]) {
      fbox(out, 'brick', courtyard, pier - 0.26, pier + 0.26, 0.12, 2.02, -0.41, 0.51, brick);
      fbox(out, 'brick', courtyard, pier - 0.33, pier + 0.33, 1.92, 2.12, -0.49, 0.59, deepBrick);
    }
  }
  for (let i = 0; i < 4; i++) {
    const r = 0.82 - i * 0.18;
    fbox(out, 'stone', front, -1.31, 1.31, -0.06, 0.22 + i * 0.165, -3.37, r, stone);
  }
}

function build(out, lod) {
  menara(out, lod);
  mosque(out, lod);
  splitGate(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'menara-kudus-mosque-model.mjs';
const camera = [55, 18, 34];
const lookAt = [-10, 7, 0];

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
    'The stepped red brick Menara Kudus beside the mosque’s silver dome, white entrance and red split gate.',
  camera,
  lookAt,
  sunDirection: [58, 62, 24],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis:
      'The OSM outline of the rear roof control. Detached mosque structures are placed using the cited precinct controls.',
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
    { name: 'jalan-menara-mosque-and-minaret', position: camera, lookAt },
    { name: 'brick-minaret-and-clock', position: [31, 11.6, 25], lookAt: [0.5, 9.5, 10.4] },
    { name: 'split-gate-and-domed-front', position: [34, 7.5, -10], lookAt: [5.4, 6.59, -5.9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'menara-kudus-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.95,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.37, surfaces },
      street: { export: 'street', errorMeters: 0.135, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.053, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Overture Maps ODbL. Mapzen open elevation.',
};
