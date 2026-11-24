import fs from 'node:fs';
import {
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const d = plan.dimensions;
const ring = outwardRing(frame.geometry.outline);
const setback = ring.map(([x, z]) => [x * 0.965, z * 0.85]);
const stone = rgb('995c49');
const accent = rgb('95604e');
const granite = rgb('ada091');
const dark = rgb('344247');
const fittings = rgb('63554c');
const terrace = rgb('a09784');
const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.97 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93 },
  soffit: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.9 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55 },
  deck: { slot: 'roof', graph: 'concrete_plain', roughness: 0.92 },
};
function deck(out, polygon, y, slot, color) {
  const indices = earcut(polygon.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices
      .slice(i, i + 3)
      .map((index) => [polygon[index][0], y, polygon[index][1]]);
    tri(out, slot, a, c, b, color);
  }
}
function streetBase(out, lod) {
  extrude(out, 'foundation', setback, d.foundation, d.plinth, granite, { top: false });
  extrude(out, 'foundation', setback, d.plinth - 0.02, d.base, granite, { top: false });
  extrude(out, 'soffit', ring, d.base - 0.7, d.base, granite, { top: false });
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const point = ([x, z], y) => [x, y, z];
    quad4(
      out,
      'soffit',
      point(ring[j], d.base - 0.7),
      point(ring[i], d.base - 0.7),
      point(setback[i], d.base - 0.7),
      point(setback[j], d.base - 0.7),
      granite,
    );
    const F = wallFace(setback[i], setback[j]);
    if (F.length < 7.5 || (F.normal[1] < 0.66 && Math.abs(F.normal[0]) < 0.8)) continue;
    const front = F.normal[1] > 0.66;
    const west = F.normal[0] < -0.8;
    const east = F.normal[0] > 0.8;
    const count = front
      ? Math.round(F.length / (lod > 0 ? 4.3 : 8.0))
      : Math.max(2, Math.round(F.length / 7.8));
    const bay = F.length / count;
    for (let k = 0; k < count; k++) {
      if (west && k > 1) continue;
      const u = k * bay;
      const low = east ? 1.25 : 0.22;
      const accentWidth = east ? 0.67 : 0.33;
      fbox(out, 'glass', F, u + accentWidth, u + bay - 0.11, low, 3.48, 0.013, 0.041, dark);
      if (lod > 0) {
        fbox(
          out,
          'soffit',
          F,
          u + 0.08,
          u + accentWidth + 0.15,
          low - 0.04,
          3.54,
          0.002,
          0.25,
          granite,
        );
        if (lod > 1)
          for (const offset of [bay * 0.33, bay * 0.66])
            fbox(
              out,
              'soffit',
              F,
              u + offset - 0.035,
              u + offset + 0.035,
              low,
              3.5,
              0.019,
              0.067,
              fittings,
            );
      }
    }
  }
  if (lod > 0) {
    const ent = facade([57.25, 9.58], [0, -1]);
    for (let k = 0; k < 4; k++)
      fbox(
        out,
        'foundation',
        ent,
        -5.22 + k * 0.18,
        5.22 - k * 0.18,
        -0.14,
        0.18 * (k + 1),
        0.01,
        4.36 - k * 0.71,
        granite,
      );
  }
}
function stoneVolume(out, lod) {
  extrude(out, 'sandstone', ring, d.base - 0.03, d.wallTop, stone, { top: false });
  deck(out, ring, d.terraceLevel, 'deck', terrace);
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    fbox(out, 'sandstone', F, 0, F.length, d.terraceLevel, d.wallTop, -0.36, -0.015, accent);
    if (F.length < 7.0) continue;
    fbox(out, 'sandstone', F, 0, F.length, d.wallTop - 0.08, d.wallTop + 0.08, -0.43, 0.05, accent);
    if (Math.abs(F.normal[0]) > 0.7 && F.length > 38) {
      for (const [s, w, y] of [
        [0.29, 0.59, 7.29],
        [0.54, 0.49, 10.29],
        [0.79, 0.4, 9.4],
      ]) {
        const u = s * F.length;
        fbox(out, 'glass', F, u - w / 2, u + w / 2, y, y + 1.1, 0.02, 0.053, dark);
        if (lod > 1)
          fbox(
            out,
            'soffit',
            F,
            u - w * 0.65,
            u + w * 0.65,
            y - 0.11,
            y - 0.03,
            0.02,
            0.14,
            accent,
          );
      }
    } else if (F.normal[1] > 0.47) {
      for (const [s, y] of [
        [0.08, 11.0],
        [0.19, 7.4],
        [0.32, 9.32],
        [0.54, 9.98],
        [0.75, 9.66],
        [0.91, 10.39],
      ]) {
        const u = s * F.length;
        fbox(out, 'glass', F, u - 0.22, u + 0.22, y, y + 1.03, 0.018, 0.045, dark);
        if (lod > 1)
          fbox(out, 'soffit', F, u - 0.31, u + 0.31, y - 0.1, y - 0.02, 0.014, 0.09, accent);
      }
    }
  }
  if (lod > 0) {
    const terraceEdge = facade([8.9, -8.62], [1, 0]);
    fbox(
      out,
      'soffit',
      terraceEdge,
      -38.0,
      38.0,
      d.terraceLevel - 0.04,
      d.terraceLevel + 0.54,
      -0.23,
      0.12,
      granite,
    );
    if (lod > 1) {
      fbox(
        out,
        'soffit',
        terraceEdge,
        -38.0,
        38.0,
        d.terraceLevel + 0.81,
        d.terraceLevel + 0.88,
        -0.07,
        0.018,
        fittings,
      );
      for (let x = -37; x <= 37; x += 2.6)
        fbox(
          out,
          'soffit',
          terraceEdge,
          x - 0.035,
          x + 0.035,
          d.terraceLevel + 0.53,
          d.terraceLevel + 0.82,
          -0.04,
          0.028,
          fittings,
        );
    }
    if (lod === 3) {
      // Low stone curb marks the outdoor display area while leaving the deck open.
      const curb = facade([-20, -0.47], [1, 0]);
      fbox(
        out,
        'soffit',
        curb,
        -18.0,
        19.0,
        d.terraceLevel - 0.006,
        d.terraceLevel + 0.19,
        -0.33,
        0.24,
        granite,
      );
    }
  }
}
function build(out, lod) {
  streetBase(out, lod);
  stoneVolume(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'nanyue-king-museum-model.mjs';
const camera = [-116, 43, 112];
const lookAt = [0, 6.0, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Nanyue Palace Garden Hall',
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The red sandstone Palace Garden Hall in Guangzhou, built above the ancient garden watercourse with a shaded public base and open-air upper terrace.',
  camera,
  lookAt,
  sunDirection: [-35, 48, 26],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis:
      'Named street-edge Palace Garden Hall outline within the Palace and Garden exhibition site.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'sandstone-front-and-west-corner', position: camera, lookAt },
    { name: 'east-gate-and-colonnade', position: [103, 22, 63], lookAt: [38, 5, 11] },
    { name: 'street-level-west-corner', position: [-90, 8, 71], lookAt: [-48, 7, 17] },
    { name: 'upper-open-terrace', position: [9, 103, -70], lookAt: [0, 9, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'palace-garden-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.54, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Copernicus DEM GLO-30 © ESA and the European Union.',
};
