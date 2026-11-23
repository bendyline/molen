import fs from 'node:fs';
import {
  abox,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = frame.geometry.outline;
const { foundation, raisedFloor, eave, ridge, porchTop } = plan.dimensions;

const rose = rgb('d29b91');
const pinkTrim = rgb('dfafa3');
const roseShade = rgb('b98075');
const limestone = rgb('d3c6af');
const base = rgb('b59987');
const slate = rgb('595950');
const metal = rgb('474640');
const windowTone = rgb('53574d');
const timber = rgb('524c40');
const surfaces = {
  pink: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'plaster_lime', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.87 },
};

const frontX = 13.787;
const backX = -5.36;
const southZ = 10.398;
const northZ = -7.95;
const eaveCenter = (frontX + backX) / 2;
const front = facade([frontX, 0], [0, -1]);
const center = -(southZ + northZ) / 2;

function capGable(out, x0, x1, z0, z1, y, crown, color, d = 0) {
  const centerX = (x0 + x1) / 2;
  const a = [x0 - d, y, z0 - d];
  const b = [x0 - d, y, z1 + d];
  const c = [x1 + d, y, z0 - d];
  const e = [x1 + d, y, z1 + d];
  const highNear = [centerX, crown, z0 - d];
  const highFar = [centerX, crown, z1 + d];
  quad4(out, 'roof', a, b, highFar, highNear, slate);
  quad4(out, 'roof', highNear, highFar, e, c, slate);
  tri(out, 'pink', c, a, highNear, color);
  tri(out, 'pink', b, e, highFar, color);
}

function house(out, lod) {
  abox(out, 'base', [backX, foundation, northZ], [frontX, raisedFloor - 0.04, southZ], base, {
    bottom: false,
  });
  abox(out, 'pink', [backX, raisedFloor - 0.07, northZ], [frontX, eave, southZ], rose, {
    bottom: false,
  });
  capGable(out, backX, frontX, northZ, southZ, eave - 0.04, ridge, rose, 0.14);
  for (const z of [northZ + 0.24, southZ - 0.22]) {
    const shape = [
      [backX, eave - 0.05, z],
      [frontX, eave - 0.05, z],
      [eaveCenter, ridge + 0.32, z],
    ];
    tri(out, 'pink', ...shape, roseShade);
    tri(out, 'pink', ...shape.reverse(), pinkTrim);
    abox(
      out,
      'pink',
      [eaveCenter - 0.82, ridge - 0.57, z - 0.51],
      [eaveCenter + 0.61, ridge + 1.08, z + 0.51],
      rose,
      { bottom: false },
    );
    abox(
      out,
      'trim',
      [eaveCenter - 0.89, ridge + 0.98, z - 0.58],
      [eaveCenter + 0.69, ridge + 1.13, z + 0.58],
      pinkTrim,
      { bottom: false },
    );
  }
  abox(out, 'pink', [-13.773, foundation, -10.327], [backX + 0.042, eave - 1.36, southZ], rose, {
    bottom: false,
  });
  capGable(out, -13.773, backX + 0.02, -10.328, southZ, eave - 1.43, eave + 0.37, rose);
  abox(
    out,
    'pink',
    [backX, foundation, -10.36],
    [frontX - 0.176, eave - 1.07, northZ + 0.05],
    roseShade,
    { bottom: false },
  );
  capGable(out, backX, frontX - 0.14, -10.366, northZ, eave - 1.1, eave - 0.29, roseShade);
  const belts = lod === 0 ? [eave - 0.25] : [raisedFloor - 0.22, 5.01, eave - 0.24];
  for (const y of belts)
    fbox(out, 'trim', front, -southZ, -northZ, y, y + 0.127, -0.06, 0.17, pinkTrim);
  if (lod === 0) return;
  for (const u of [-southZ + 0.03, -northZ - 0.08]) {
    const direction = u < 0 ? 1 : -1;
    const end = facade([frontX, -u], [direction, 0]);
    for (let i = 0; i < 15; i++) {
      const width = i % 2 ? 0.47 : 0.72;
      const y = 1.42 + i * 0.475;
      const signed = direction * width;
      fbox(
        out,
        'trim',
        front,
        u + Math.min(0, signed) - 0.035,
        u + Math.max(0, signed) + 0.035,
        y,
        y + 0.35,
        -0.02,
        0.092,
        pinkTrim,
      );
      fbox(
        out,
        'trim',
        end,
        Math.min(0, -signed),
        Math.max(0, -signed),
        y,
        y + 0.35,
        -0.041,
        0.091,
        pinkTrim,
      );
    }
  }
}

function sash(out, F, u, y, w, h, lod, arch = false, door = false) {
  opening(out, F, u, y, w, h, {
    glassSlot: door ? 'timber' : 'window',
    frameSlot: 'trim',
    glass: door ? timber : windowTone,
    frame: limestone,
    d: 0.046,
    frameWidth: lod > 1 ? 0.069 : 0,
    head: arch ? 'round' : 'flat',
    mullions: lod > 1 ? 2 : lod,
    transoms: lod === 3 && !door ? 3 : lod > 1 ? 1 : 0,
    sill: lod > 1 && !door,
  });
}

function windowHood(out, F, u, y, width, lod) {
  const half = width * 0.57;
  const crown = lod === 1 ? 0.26 : 0.32;
  const a = F.P(u - half, y, 0.17);
  const b = F.P(u + half, y, 0.17);
  const c = F.P(u, y + crown, 0.17);
  tri(out, 'trim', a, b, c, roseShade);
  fbox(out, 'trim', F, u - half - 0.035, u + half + 0.035, y - 0.11, y, 0.022, 0.189, pinkTrim);
  if (lod > 1) {
    const outer = ([a, b, c]) => [a, b + 0.066, c];
    quad4(out, 'trim', a, c, outer(c), outer(a), pinkTrim);
    quad4(out, 'trim', c, b, outer(b), outer(c), pinkTrim);
  }
}

function windows(out, lod) {
  sash(out, front, center, 5.2, 1.57, 3.03, lod, true);
  if (lod === 0) return;
  for (const offset of [-1.09, 1.09]) sash(out, front, center + offset, 5.21, 0.65, 2.3, lod);
  fbox(out, 'trim', front, center - 1.52, center + 1.52, 5.11, 5.25, -0.012, 0.202, limestone);
  sash(out, front, center, raisedFloor, 1.48, 2.93, lod, true, true);
  for (const side of [-1, 1]) {
    for (const k of [3.33, 6.29]) {
      const u = center + side * k;
      for (const y of [1.79, 5.32]) {
        sash(out, front, u, y, 1.46, 2.34, lod);
        windowHood(out, front, u, y + 2.49, 1.64, lod);
      }
      if (lod > 1) sash(out, front, u, 0.22, 1.01, 0.54, lod);
    }
  }
  const annexFront = facade([frontX - 0.16, 0], [0, -1]);
  sash(out, annexFront, 9.05, 2.01, 1.36, 2.16, lod);
  sash(out, annexFront, 9.05, 5.12, 1.36, 2.15, lod);
  for (const edge of [
    facade([backX, southZ], [1, 0]),
    facade([frontX - 0.17, -10.36], [-1, 0]),
    facade([-13.773, -10.36], [0, 1]),
  ]) {
    for (const u of [2.15, 5.76, 9.42, 13.23, 16.58]) {
      for (const y of [2.08, 5.17]) {
        sash(out, edge, u, y, 1.3, 2.12, lod === 2 ? 1 : lod);
        windowHood(out, edge, u, y + 2.31, 1.4, lod);
      }
    }
  }
}

function portico(out, lod) {
  const width = 2.3;
  const deckEdge = 2.7;
  fbox(
    out,
    'base',
    front,
    center - width,
    center + width,
    -0.93,
    raisedFloor,
    -0.06,
    deckEdge,
    base,
  );
  fbox(
    out,
    'trim',
    front,
    center - width - 0.079,
    center + width + 0.079,
    raisedFloor - 0.14,
    raisedFloor + 0.027,
    -0.052,
    deckEdge + 0.065,
    limestone,
  );
  fbox(
    out,
    'trim',
    front,
    center - width + 0.03,
    center + width - 0.03,
    porchTop - 0.6,
    porchTop - 0.16,
    -0.02,
    deckEdge - 0.07,
    pinkTrim,
  );
  fbox(
    out,
    'trim',
    front,
    center - width - 0.12,
    center + width + 0.12,
    porchTop - 0.18,
    porchTop,
    -0.032,
    deckEdge + 0.08,
    limestone,
    { bottom: true },
  );
  const n = [4, 6, 8, 9][lod];
  for (let i = 0; i < n; i++) {
    const stride = 1.82 / n;
    const y = raisedFloor - ((i + 1) * (raisedFloor - 0.045)) / n;
    fbox(
      out,
      'trim',
      front,
      center - 1.61,
      center + 1.61,
      -0.43,
      y,
      deckEdge + stride * i,
      deckEdge + stride * (i + 1),
      limestone,
    );
  }
  for (const side of [-1, 1]) {
    for (const offset of [1.44, 2.0]) {
      const u = center + side * offset;
      const depth = 2.22;
      const steps = [5, 7, 10, 14][lod];
      const profile = [
        [raisedFloor + 0.04, 0.206],
        [raisedFloor + 0.18, 0.185],
        [porchTop - 0.83, 0.157],
        [porchTop - 0.65, 0.207],
      ];
      const rings = profile.map(([y, radius]) =>
        Array.from({ length: steps }, (_, i) => {
          const angle = (-2 * Math.PI * i) / steps;
          return front.P(u + radius * Math.cos(angle), y, depth + radius * Math.sin(angle));
        }),
      );
      loft(out, 'trim', rings, limestone, { cap: false });
      fbox(
        out,
        'trim',
        front,
        u - 0.23,
        u + 0.23,
        porchTop - 0.66,
        porchTop - 0.57,
        depth - 0.23,
        depth + 0.23,
        limestone,
      );
    }
    if (lod === 0) continue;
    const u = center + side * 2.19;
    fbox(
      out,
      'iron',
      front,
      u - 0.031,
      u + 0.031,
      raisedFloor + 0.81,
      raisedFloor + 0.88,
      0.24,
      2.31,
      metal,
    );
    const count = lod === 3 ? 13 : lod === 2 ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const d = 0.32 + (1.92 * i) / count;
      fbox(
        out,
        'iron',
        front,
        u - 0.025,
        u + 0.025,
        raisedFloor + 0.05,
        raisedFloor + 0.85,
        d,
        d + 0.045,
        metal,
      );
    }
  }
}

function build(out, lod) {
  house(out, lod);
  windows(out, lod);
  portico(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'olde-pink-house-model.mjs';
const camera = [41, 9.7, 26];
const lookAt = [5.6, 5, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Olde Pink House in Savannah, with its stuccoed Georgian exterior, slate gable, Palladian window and four-column Doric porch.',
  camera,
  lookAt,
  sunDirection: [57, 64, 26],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outwardRing(outline),
    minimumCoverage: 0.92,
    basis: 'The individually named mapped house on Abercorn Street.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'abercorn-front-corner', position: camera, lookAt },
    {
      name: 'doric-porch-and-palladian-window',
      position: [29, 3.4, 9],
      lookAt: [14.45, 4.58, 0.9],
    },
    { name: 'gable-and-attached-wing', position: [-20, 19, -30], lookAt: [1, 5.8, -1.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'olde-pink-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.93,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.41, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
