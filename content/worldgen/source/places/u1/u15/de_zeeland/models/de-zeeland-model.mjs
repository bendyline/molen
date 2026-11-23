import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  fan,
  fbox,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const sections = read('native-map/de-zeeland-hall-controls');
const tone = {
  brick: rgb('975f4c'),
  darkBrick: rgb('785446'),
  trim: rgb('a46a51'),
  footing: rgb('92877a'),
  glazing: rgb('4b5655'),
  shade: rgb('5b5148'),
  roof: rgb('666d67'),
  seam: rgb('72796f'),
  iron: rgb('4d5551'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86 },
  footing: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.85 },
};

function panel(out, slot, face, left, right, bottom, top, depth, tint) {
  quad4(
    out,
    slot,
    face.P(left, bottom, depth),
    face.P(right, bottom, depth),
    face.P(right, top, depth),
    face.P(left, top, depth),
    tint,
  );
}

function arch(out, face, u, base, spring, half, rise, level, glazed) {
  if (level === 0) {
    panel(
      out,
      glazed ? 'detail' : 'brick',
      face,
      u - half,
      u + half,
      base,
      spring,
      0.034,
      glazed ? tone.glazing : tone.darkBrick,
    );
    return;
  }
  const sections = [4, 6, 8, 12][level];
  const sample = (i, d = 0) => {
    const a = (2 * i) / sections - 1;
    return [u + a * (half + d), spring + rise * (1 - a * a) + d];
  };
  const top = Array.from({ length: sections + 1 }, (_, i) => sample(i));
  const ring = [[u - half, base], [u + half, base], ...top.slice().reverse()];
  fan(
    out,
    glazed ? 'detail' : 'brick',
    ring.map(([x, h]) => face.P(x, h, 0.034)),
    glazed ? tone.glazing : tone.darkBrick,
  );
  for (let i = 0; i < sections; i++) {
    const at = ([x, h]) => face.P(x, h, 0.087);
    quad4(
      out,
      'brick',
      at(sample(i, 0.097)),
      at(top[i]),
      at(top[i + 1]),
      at(sample(i + 1, 0.097)),
      tone.trim,
    );
  }
  panel(out, 'brick', face, u - half - 0.098, u - half, base, spring + 0.098, 0.086, tone.trim);
  panel(out, 'brick', face, u + half, u + half + 0.098, base, spring + 0.098, 0.086, tone.trim);
  if (level < 2 || !glazed) return;
  panel(out, 'detail', face, u - 0.035, u + 0.035, base, spring + rise - 0.035, 0.056, tone.iron);
  panel(out, 'detail', face, u - half, u + half, spring - 0.055, spring + 0.035, 0.054, tone.iron);
  if (level > 2) {
    const y = base + (spring - base) * 0.46;
    panel(out, 'detail', face, u - half, u + half, y - 0.036, y + 0.036, 0.056, tone.iron);
    fbox(
      out,
      'footing',
      face,
      u - half - 0.1,
      u + half + 0.1,
      base - 0.085,
      base - 0.014,
      0,
      0.14,
      tone.footing,
    );
  }
}

function bays(out, face, eave, level, front) {
  const count = Math.round(face.length / 5.55);
  const width = face.length / count;
  panel(out, 'brick', face, 0, face.length, eave - 0.46, eave - 0.22, 0.071, tone.trim);
  for (let i = 0; i < count; i++) {
    const u = width * (i + 0.5);
    const high = eave - 2.04;
    arch(out, face, u, eave * 0.54, high, Math.min(width * 0.32, 1.57), 0.35, level, front);
    const doorBay = front && i % 7 === Math.floor(count / 2) % 7;
    arch(
      out,
      face,
      u,
      doorBay ? 0.18 : 1.14,
      eave * 0.4,
      Math.min(width * 0.27, 1.36),
      0.22,
      level,
      true,
    );
    if (i === 0) continue;
    const jamb = width * i;
    const depth = level > 0 ? 0.24 : 0.12;
    fbox(out, 'brick', face, jamb - 0.14, jamb + 0.14, 0.08, eave - 0.1, 0, depth, tone.trim);
    if (level > 1) {
      for (const y of [eave - 0.95, eave - 0.74]) {
        panel(
          out,
          'brick',
          face,
          jamb - 0.36,
          jamb + 0.36,
          y,
          y + 0.097,
          depth + 0.012,
          tone.darkBrick,
        );
      }
    }
  }
}

const faceOutline = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];

function gabled(out, d, visible, level, tall) {
  const [x, X, z, Z] = d.range;
  const e = d.eaveM;
  const r = d.ridgeM;
  const c = d.ridgeZ;
  const corners = faceOutline(x, X, z, Z);
  for (let i = 0; i < corners.length; i++) {
    const f = wallFace(corners[i], corners[(i + 1) % corners.length]);
    panel(out, 'brick', f, 0, f.length, -0.4, e, 0, tone.brick);
    panel(out, 'footing', f, 0, f.length, -0.38, 0.42, 0.025, tone.footing);
    if (!visible.includes(i)) continue;
    if (tall) bays(out, f, e, level, i === 0 || i === 1);
    else {
      panel(
        out,
        'detail',
        f,
        0.62,
        f.length - 0.62,
        1.32,
        Math.min(3.63, e - 0.44),
        0.078,
        tone.glazing,
      );
      if (level > 0) {
        for (let u = 2.5; u < f.length - 1.1; u += 2.65) {
          panel(out, 'detail', f, u, u + 0.088, 1.32, Math.min(3.63, e - 0.44), 0.091, tone.iron);
        }
      }
    }
  }
  tri(out, 'brick', [x, e, z], [x, e, Z], [x, r, c], tone.brick);
  tri(out, 'brick', [X, e, Z], [X, e, z], [X, r, c], tone.brick);
  const northWest = [x - 0.3, e + 0.035, z - 0.23];
  const southWest = [x - 0.3, e + 0.035, Z + 0.23];
  const northEast = [X + 0.3, e + 0.035, z - 0.23];
  const southEast = [X + 0.3, e + 0.035, Z + 0.23];
  const ridgeWest = [x - 0.3, r + 0.035, c];
  const ridgeEast = [X + 0.3, r + 0.035, c];
  quad4(out, 'roof', northWest, ridgeWest, ridgeEast, northEast, tone.roof);
  quad4(out, 'roof', ridgeWest, southWest, southEast, ridgeEast, tone.roof);
  if (level === 0) return;
  beam(out, 'roof', northWest, northEast, 0.09, 0.16, tone.iron);
  beam(out, 'roof', southWest, southEast, 0.09, 0.16, tone.iron);
  if (level < 2 || !tall) return;
  for (let u = x + 1; u < X; u += level === 2 ? 4.35 : 2.17) {
    const peak = [u, r + 0.08, c];
    beam(out, 'roof', [u, e + 0.066, z - 0.14], peak, 0.024, 0.025, tone.seam);
    beam(out, 'roof', [u, e + 0.066, Z + 0.14], peak, 0.024, 0.025, tone.seam);
  }
}

function build(out, level) {
  const p = sections.parts;
  gabled(out, p.northeastHall, [0, 2, 3], level, true);
  gabled(out, p.middleHall, [0, 2], level, true);
  gabled(out, p.southwestHall, [0, 1, 3], level, true);
  gabled(out, p.southeastLink, [1, 2], level, false);
  gabled(out, p.northEntry, [0, 2, 3], level, false);
  abox(out, 'brick', [-3.66, -0.38, 52.54], [-0.03, 8.52, 56.83], tone.darkBrick);
  abox(out, 'roof', [-3.67, 8.52, 52.54], [-0.02, 8.65, 56.84], tone.roof);
  if (level > 0) {
    for (const [x, z, e] of [
      [-57.85, 27.15, 12.05],
      [-35.12, 17.16, 11.93],
      [-18.16, -23.38, 13.12],
    ]) {
      abox(out, 'detail', [x - 0.106, 0.47, z - 0.083], [x - 0.026, e - 0.18, z], tone.iron);
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'de-zeeland-model.mjs';
const camera = [-151, 63, 139];
const lookAt = [-5, 7, 12];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'De Zeeland Sugar Factory',
  wikidataId: plan.wikidataId,
  category: 'historic-industrial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The preserved De Zeeland sugar factory halls with industrial brick bays, stepped connections and shallow ridged metal roofs.',
  camera,
  lookAt,
  sunDirection: [-51, 73, 55],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: sections.nativeEnvelopeSimplifiedXZ,
    minimumCoverage: 0.91,
    basis:
      'Simplified native BAG-backed building polygon for the three persistent halls and their links.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'metal_painted', 'concrete_plain'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'markiezaatsweg-brick-halls', position: [-135, 13, 91], lookAt: [-14, 6, 12] },
    { name: 'roof-survey-and-links', position: [-95, 64, -99], lookAt: [-4, 8, 13] },
    { name: 'southwest-masonry-and-openings', position: [-101, 9, 13], lookAt: [-29, 6, 29] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'de-zeeland-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. OpenStreetMap geometry under ODbL. Dutch AHN altitude survey under its published terms.',
};
