import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { features } = JSON.parse(
  fs.readFileSync(new URL('../native-map/carew-mill-causeway-native.json', import.meta.url)),
);
const mapped = new Map(features.map(({ way, local }) => [way.id, local]));
const { groundFloor, stoneToe, wallTop, ridge, wingWall, wingRidge, wingStart } = plan.dimensions;
const outline = frame.geometry.outline;
const xmin = Math.min(...outline.map(([x]) => x));
const xmax = Math.max(...outline.map(([x]) => x));
const halfWidth = Math.max(...outline.map(([, z]) => Math.abs(z)));
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95 },
  dam: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  gravel: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.99 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.93 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.7 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
};
const stone = rgb('9a9388');
const foundationStone = rgb('867e70');
const gravel = rgb('b2a691');
const slate = rgb('6e7075');
const wood = rgb('86765e');
const pale = rgb('b2a89a');
const iron = rgb('545550');
const glass = rgb('4d4f4d');

function crest(x) {
  return 0.9 + Math.min(1, Math.max(0, (x - 97) / 37)) * 1.94;
}

// Cut the mapped northern dam polygon at its mapped pedestrian bridge.
function sideOf(ring, boundary, sign) {
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const aInside = (a[0] - boundary) * sign >= 0;
    const bInside = (b[0] - boundary) * sign >= 0;
    const result = aInside ? [a] : [];
    if (aInside !== bInside) {
      const t = (boundary - a[0]) / (b[0] - a[0]);
      result.push([boundary, a[1] + t * (b[1] - a[1])]);
    }
    return result;
  });
}

const northDam = outwardRing(mapped.get('690064765'));
const bridges = ['690064764', '838536598'].map((id) => mapped.get(id));
const spillwayEnds = bridges[1].map(([x]) => x).sort((a, b) => a - b);
const damSections = [
  outwardRing(mapped.get('690064762')),
  sideOf(northDam, spillwayEnds[0], -1),
  sideOf(northDam, spillwayEnds[1], 1),
];

function section(out, ring) {
  const top = ring.map(([x, z]) => [x, crest(x), z]);
  const centerZ = ring.reduce((sum, [, z]) => sum + z, 0) / ring.length;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const foot = [i, j].map((k) => {
      const [x, z] = ring[k];
      return [x, stoneToe, z + Math.sign(z - centerZ) * 0.84];
    });
    quad4(out, 'dam', foot[0], foot[1], top[j], top[i], foundationStone);
  }
  const cuts = earcut(ring.flat(), [], 2);
  for (let i = 0; i < cuts.length; i += 3)
    tri(out, 'gravel', top[cuts[i]], top[cuts[i + 2]], top[cuts[i + 1]], gravel);
}

function sluices(out, lod) {
  for (const [index, bridge] of bridges.entries()) {
    const [a, b] = bridge;
    const f = wallFace(a, b);
    const deck = Math.max(crest(a[0]), crest(b[0])) + 0.1;
    fbox(out, 'trim', f, -0.11, f.length + 0.11, deck - 0.28, deck, -1.02, 1.04, wood);
    for (const offset of [-0.96, 0.96]) {
      for (const y of [0.46, 0.97])
        beam(
          out,
          'trim',
          f.P(0, deck + y, offset),
          f.P(f.length, deck + y, offset),
          0.08,
          0.12,
          wood,
        );
      if (lod > 0) {
        for (const u of [0.11, f.length * 0.49, f.length - 0.11])
          beam(
            out,
            'trim',
            f.P(u, deck - 0.02, offset),
            f.P(u, deck + 1.03, offset),
            0.115,
            0.115,
            wood,
          );
      }
    }
    const openingWidth = index === 0 ? 0.42 : 0.28;
    fbox(
      out,
      'trim',
      f,
      openingWidth,
      f.length - openingWidth,
      -1.75,
      deck - 0.39,
      -0.2,
      0.13,
      rgb('6d6151'),
    );
    if (lod >= 2 && index === 0) {
      for (let i = 1; i < 7; i++) {
        const u = (f.length * i) / 7;
        fbox(out, 'iron', f, u - 0.034, u + 0.034, -1.62, deck - 0.36, 0.135, 0.2, iron);
      }
    }
  }
}
function volume(out, a, b, width, eave, roof, endWalls) {
  const axis = wallFace(a, b);
  const point = (u, z) => {
    const [x, , h] = axis.P(u, 0, z);
    return [x, h];
  };
  const w = width / 2;
  const shape = [point(0, -w), point(0, w), point(axis.length, w), point(axis.length, -w)];
  extrude(out, 'stone', shape, groundFloor - 1.4, eave, stone, { top: false });
  gableRoof(out, 'roof', a, b, width, eave, roof, slate, {
    overhang: 0.16,
    endSlot: 'stone',
    endColor: stone,
    ends: endWalls,
  });
  return outwardRing(shape);
}
function smallWindow(out, face, u, y, lod, width = 0.8, height = 1.16) {
  opening(out, face, u, y, width, height, {
    head: 'round',
    rise: 0.14,
    glass,
    frame: pale,
    frameWidth: 0.075,
    frameDepth: 0.075,
    mullions: lod >= 3 ? 3 : lod === 2 ? 1 : 0,
    transoms: lod >= 3 ? 3 : lod === 2 ? 1 : 0,
    sill: lod >= 2,
  });
  if (lod >= 2) {
    fbox(
      out,
      'stone',
      face,
      u - width / 2 - 0.15,
      u + width / 2 + 0.15,
      y - 0.09,
      y + 0.02,
      0,
      0.2,
      rgb('b3aaa0'),
    );
  }
}
function gallery(out, ring, lod) {
  const [a, b, c, d] = ring;
  const front = wallFace(b, c);
  const rear = wallFace(d, a);
  for (const face of [front, rear]) {
    for (let bay = 0; bay < 5; bay++) {
      const u = ((bay + 0.5) * face.length) / 5;
      for (const y of [1.19, 3.46, 5.79])
        smallWindow(out, face, u, y, lod, 0.78, bay === 2 && y === 3.46 ? 1.52 : 1.08);
      if (lod > 1 && bay % 2 === 1) {
        fbox(out, 'iron', face, u + 0.65, u + 0.88, 4.68, 4.92, 0.027, 0.076, iron);
      }
    }
  }
  const south = wallFace(a, b);
  for (const u of [south.length * 0.29, south.length * 0.7])
    smallWindow(out, south, u, 5.27, lod, 0.66, 0.91);
  smallWindow(out, south, south.length / 2, 8.83, lod, 0.59, 0.72);
  const north = wallFace(c, d);
  for (const u of [north.length * 0.29, north.length * 0.7])
    smallWindow(out, north, u, 7.05, lod, 0.66, 0.89);
  smallWindow(out, north, north.length / 2, 8.83, lod, 0.59, 0.72);
}
function mill(out, lod) {
  const main = volume(out, [xmin, 0], [wingStart, 0], halfWidth * 2, wallTop, ridge, [true, true]);
  const wing = volume(out, [wingStart - 0.09, 0.07], [xmax, -0.13], 8.45, wingWall, wingRidge, [
    false,
    true,
  ]);
  if (lod >= 1) {
    gallery(out, main, lod);
    const entry = wallFace(wing[1], wing[2]);
    opening(out, entry, 5.04, 0.93, 1.16, 1.99, {
      glass: rgb('695f51'),
      frame: wood,
      frameWidth: 0.12,
      frameDepth: 0.11,
    });
    const gable = wallFace(wing[2], wing[3]);
    smallWindow(out, gable, gable.length / 2, 4.85, lod, 0.63, 0.76);
    const south = wallFace(main[0], main[1]);
    for (let i = 0; i < 5; i++) {
      fbox(
        out,
        'dam',
        south,
        2.8,
        4.1,
        -0.54,
        0.13 - i * 0.124,
        i * 0.3,
        (i + 1) * 0.3,
        foundationStone,
      );
    }
  }
  if (lod >= 2) {
    for (const side of [4.68, 5.81]) {
      const p0 = [wingStart + 1.57, 0.99, side];
      const p1 = [wingStart + 8.1, 0.57, side];
      beam(out, 'trim', p0, p1, 0.084, 0.08, wood);
      beam(
        out,
        'trim',
        [p0[0], p0[1] + 0.94, side],
        [p1[0], p1[1] + 0.94, side],
        0.086,
        0.11,
        wood,
      );
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const x = p0[0] + (p1[0] - p0[0]) * t;
        const y = p0[1] + (p1[1] - p0[1]) * t;
        beam(out, 'trim', [x, y - 0.1, side], [x, y + 0.97, side], 0.105, 0.105, wood);
      }
    }
  }
  if (lod === 3) {
    for (const [x0, x1, z, top] of [
      [xmin, wingStart, 0, ridge],
      [wingStart, xmax, -0.03, wingRidge],
    ]) {
      beam(
        out,
        'roof',
        [x0 - 0.16, top + 0.03, z],
        [x1 + 0.16, top + 0.03, z],
        0.17,
        0.13,
        rgb('575b63'),
      );
    }
    const sill = wallFace(wing[1], wing[2]);
    fbox(out, 'trim', sill, 0.92, 1.06, 0.97, 3.77, 0.12, 0.27, wood);
  }
}
function build(out, lod) {
  for (const ring of damSections) section(out, ring);
  sluices(out, lod);
  mill(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'carew-tidal-mill-model.mjs';
const camera = [29, 40, 127];
const lookAt = [38, 3.5, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'industrial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The limestone and slate Carew Tidal Mill, its lower wing and the stone causeway with two gated crossings.',
  camera,
  lookAt,
  sunDirection: [-31, 58, 50],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Mapped named mill and attached wing.',
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
    { name: 'mill-pond-and-whole-tidal-barrier', position: camera, lookAt },
    { name: 'pond-elevation-and-five-window-bays', position: [-9, 12, 39], lookAt: [-1, 5, 1] },
    { name: 'causeway-floodgate-and-entrance-wing', position: [38, 9, 24], lookAt: [14, 2.7, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'carew-tidal-mill-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.84,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.104, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.043, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
