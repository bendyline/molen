import fs from 'node:fs';
import {
  extrude,
  fbox,
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
const { parts } = JSON.parse(
  fs.readFileSync(new URL('../native-map/national-theatre-building-parts.json', import.meta.url)),
);
const { outline, holes } = frame.geometry;
const partsById = new Map(parts.map((part) => [part.way.id, part]));
const concrete = rgb('a7a69b');
const exposed = rgb('b6b2a6');
const soffit = rgb('837e72');
const glazing = rgb('495959');
const mullion = rgb('777870');
const membrane = rgb('77766d');
const railing = rgb('969890');
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'concrete_boardformed', roughness: 0.91 },
  ground: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  flatRoof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95 },
  glazed: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.51 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.64 },
};

const opticalInset = (ring, inset) => {
  const center = ring.reduce(
    ([x, z], p) => [x + p[0] / ring.length, z + p[1] / ring.length],
    [0, 0],
  );
  return ring.map(([x, z]) => [x + (center[0] - x) * inset, z + (center[1] - z) * inset]);
};
const outerWalls = (ring) => {
  const r = outwardRing(ring);
  return r.map((a, i) => wallFace(a, r[(i + 1) % r.length]));
};

function prism(out, slot, ring, low, high, color, holes, underside, roofColor = membrane) {
  extrude(out, slot, ring, low, high, color, { holes, top: false });
  const coordinates = ring.concat(...holes);
  const holeStarts = [];
  let offset = ring.length;
  for (const hole of holes) {
    holeStarts.push(offset);
    offset += hole.length;
  }
  const points = earcut(coordinates.flat(), holeStarts, 2);
  const vertex = (index, height) => [coordinates[index][0], height, coordinates[index][1]];
  for (let i = 0; i < points.length; i += 3) {
    const [a, b, c] = points.slice(i, i + 3);
    tri(out, 'flatRoof', vertex(a, high), vertex(c, high), vertex(b, high), roofColor);
    if (underside) tri(out, slot, vertex(a, low), vertex(b, low), vertex(c, low), soffit);
  }
}

function podium(out, lod) {
  extrude(out, 'ground', opticalInset(outline, 0.007), plan.dimensions.foundation, 0.34, soffit, {
    holes,
    top: false,
  });
  const envelope = opticalInset(outline, 0.043);
  extrude(out, 'concrete', envelope, 0.34, 4.77, concrete, { holes, top: false });
  prism(out, 'trim', outline, 4.77, 6.5, exposed, holes, true);
  if (lod === 0) return;
  for (const face of outerWalls(envelope)) {
    if (face.length < 5 || face.normal[1] > 0.8) continue;
    facadeWindows(out, face, 0.51, 4.14, lod, face.normal[0] < -0.45 ? 0.91 : 0.54);
  }
}

function facadeWindows(out, face, bottom, height, lod, glazedFraction) {
  const bays = Math.max(1, Math.round(face.length / 5.9));
  const spacing = face.length / bays;
  const width = spacing * glazedFraction;
  for (let bay = 0; bay < bays; bay++) {
    const u = (bay + 0.5) * spacing;
    opening(out, face, u, bottom, width, height, {
      glassSlot: 'glazed',
      frameSlot: 'metal',
      glass: glazing,
      frame: mullion,
      d: 0.013,
      frameWidth: lod === 1 ? 0 : 0.065,
      mullions: lod === 3 ? Math.floor(width / 1.3) : 0,
      frameDepth: 0.05,
      sill: false,
    });
  }
}

function terrace(out, id, low, high, lod) {
  const ring = partsById.get(id).local;
  const court = id === '150143254' || id === '319342619' ? holes : [];
  const core = opticalInset(ring, 0.048);
  extrude(out, 'concrete', core, low, high - 1.55, concrete, { holes: court, top: false });
  prism(out, 'trim', ring, high - 1.55, high, exposed, court, true);
  if (lod === 0) return;
  for (const face of outerWalls(core)) {
    if (face.length > 8 && face.normal[1] < 0.73)
      facadeWindows(out, face, low + 0.37, high - low - 2.09, lod, 0.76);
  }
  if (lod < 2) return;
  for (const face of outerWalls(ring)) {
    if (face.length <= 8 || face.normal[1] > 0.34) continue;
    const steps = Math.ceil(face.length / 3.35);
    const spacing = face.length / steps;
    const d = -0.2;
    fbox(
      out,
      'metal',
      face,
      0.13,
      face.length - 0.14,
      high + 0.84,
      high + 0.905,
      d - 0.045,
      d,
      railing,
    );
    if (lod !== 3) continue;
    for (let i = 1; i < steps; i++) {
      const u = i * spacing;
      fbox(out, 'metal', face, u - 0.027, u + 0.027, high, high + 0.87, d - 0.045, d, railing);
    }
  }
}

function towers(out, lod) {
  for (const [id, bottom] of [
    ['150143253', 19.05],
    ['150143258', 15.46],
    ['319343600', 21.45],
    ['319343601', 21.45],
    ['319343644', 21.45],
    ['319343599', 17.9],
  ]) {
    const { local, height } = partsById.get(id);
    const top = Number(height);
    const ring = opticalInset(local, 0.001);
    prism(out, 'concrete', ring, bottom, top, concrete, [], false);
    if (lod < 2) continue;
    for (const face of outerWalls(ring)) {
      if (face.length < 5.3 || face.length > 20 || face.normal[0] > 0.8) continue;
      const w = Math.min(1.45, face.length * 0.15);
      for (const proportion of [0.2, 0.8]) {
        const u = face.length * proportion;
        quad4(
          out,
          'trim',
          face.P(u - w / 2, bottom + 0.05, 0.012),
          face.P(u + w / 2, bottom + 0.05, 0.012),
          face.P(u + w / 2, top - 0.72, 0.012),
          face.P(u - w / 2, top - 0.72, 0.012),
          exposed,
        );
      }
    }
  }
}

function build(out, lod) {
  podium(out, lod);
  for (const [id, low] of [
    ['319342620', 6.5],
    ['319342621', 6.5],
    ['319343598', 6.5],
    ['150143254', 6.5],
    ['150143262', 10.5],
    ['319342619', 13.98],
    ['150143259', 14.01],
  ]) {
    terrace(out, id, low, Number(partsById.get(id).height), lod);
  }
  towers(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'royal-national-theatre-model.mjs';
const camera = [-182, 83, -188];
const lookAt = [0, 14, -4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Royal National Theatre on the South Bank, with board-marked fly towers, glazed foyers and stepped concrete terraces.',
  camera,
  lookAt,
  sunDirection: [-57, 45, -32],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    holes,
    minimumCoverage: 0.92,
    basis: 'The mapped theatre perimeter and service light court.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-bank-fly-towers', position: camera, lookAt },
    { name: 'foyer-terraces-and-glazing', position: [-104, 17, -50], lookAt: [-24, 15, -28] },
    { name: 'inland-stage-volumes', position: [139, 58, 133], lookAt: [0, 18, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'royal-national-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.62, surfaces },
      street: { export: 'street', errorMeters: 0.2, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.072, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
