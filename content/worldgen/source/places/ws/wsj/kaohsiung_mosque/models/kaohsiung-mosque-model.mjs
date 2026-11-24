import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');
const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const roof = plan.dimensions.roofHeightEstimateM;
const floor = 1.08;
const jade = rgb('647876');
const darkJade = rgb('576d6c');
const joint = rgb('778886');
const trim = rgb('819493');
const sand = rgb('d3bf9e');
const gold = rgb('c0a474');
const stone = rgb('b6ab91');
const domeTone = rgb('d4dacd');
const concrete = rgb('9c9d8b');
const glass = rgb('819ea7');
const dark = rgb('575d57');

const surfaces = {
  tile: { slot: 'wall', graph: 'tile_glazed', roughness: 0.82 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.11 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
};

const outline = frame.geometry.outline;
const arcadeFace = wallFace(outline[8], outline[7]);
const rearEastFace = wallFace(outline[10], outline[9]);
const northEastFace = wallFace(outline[6], outline[5]);

function panel(out, slot, face, a, b, y0, y1, color, depth = 0) {
  if (b - a <= 0.001 || y1 - y0 <= 0.001) return;
  quad4(
    out,
    slot,
    face.P(a, y0, depth),
    face.P(b, y0, depth),
    face.P(b, y1, depth),
    face.P(a, y1, depth),
    color,
  );
}

function enclosure(out, footprint, base, top, color, level) {
  const ring = outwardRing(footprint);
  const cap = earcut(ring.flat());
  for (let i = 0; i < cap.length; i += 3) {
    const [a, b, c] = cap.slice(i, i + 3).map((n) => ring[n]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 0.00001) continue;
    const point = (p) => [p[0], top, p[1]];
    tri(out, 'roof', point(a), point(area < 0 ? b : c), point(area < 0 ? c : b), concrete);
  }
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    panel(out, 'tile', F, 0, F.length, base, top, color);
    if (level === 0 || F.length < 0.4) continue;
    panel(out, 'stone', F, 0, F.length, top - 1.16, top - 0.26, sand, 0.06);
    panel(out, 'trim', F, 0, F.length, top - 0.23, top, trim, 0.068);
    if (level >= 2 && F.length > 7) {
      for (let u = 2.1; u < F.length - 1; u += 3.6) {
        panel(out, 'trim', F, u - 0.08, u + 0.08, base + 0.5, top - 1.33, joint, 0.023);
      }
    }
  }
}

function archedWindow(out, F, u, y, w, h, level, depth = 0, small = false) {
  opening(out, F, u, y, w, h, {
    head: small ? 'pointed' : 'round',
    rise: w * 0.45,
    d: depth + 0.035,
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: small ? dark : glass,
    frame: trim,
    frameWidth: level >= 1 ? 0.082 : 0,
    frameDepth: depth + 0.071,
    sill: false,
  });
  if (level < 2) return;
  const spring = y + h - w / 2;
  const parts = small ? 2 : 7;
  for (let line = 1; line <= parts; line++) {
    const v = y + ((spring - y) * line) / (parts + 1);
    panel(out, 'trim', F, u - w * 0.49, u + w * 0.49, v, v + 0.065, trim, depth + 0.078);
  }
  if (!small) panel(out, 'trim', F, u - 0.045, u + 0.045, y, y + h - 0.11, trim, depth + 0.079);
}

function archedBand(out, F, u, width, spring, rise, level) {
  const depth = -1.05;
  const count = level ? 12 : 6;
  const top = 10.87;
  const y = (t) => spring + rise * Math.sin(Math.PI * t);
  for (let i = 0; i < count; i++) {
    const a = i / count;
    const b = (i + 1) / count;
    const x0 = u + (a - 0.5) * width;
    const x1 = u + (b - 0.5) * width;
    const y0 = y(a);
    const y1 = y(b);
    quad4(out, 'tile', F.P(x0, y0), F.P(x1, y1), F.P(x1, top), F.P(x0, top), jade);
    quad4(
      out,
      'stone',
      F.P(x1, y1, depth),
      F.P(x0, y0, depth),
      F.P(x0, top, depth),
      F.P(x1, top, depth),
      sand,
    );
    quad4(out, 'trim', F.P(x1, y1), F.P(x0, y0), F.P(x0, y0, depth), F.P(x1, y1, depth), trim);
    if (level >= 2) {
      quad4(
        out,
        'trim',
        F.P(x0, y0, 0.025),
        F.P(x1, y1, 0.025),
        F.P(x1, y1 + 0.15, 0.025),
        F.P(x0, y0 + 0.15, 0.025),
        darkJade,
      );
    }
  }
}

function entrance(out, level) {
  const F = arcadeFace;
  const width = F.length;
  fbox(out, 'stone', F, -0.02, width + 0.02, 10.72, 11.7, -1.18, 0.1, sand, { bottom: true });
  fbox(out, 'tile', F, -0.11, width + 0.11, 11.63, 11.93, -1.25, 0.19, jade);
  fbox(out, 'stone', F, 0, width, 10.8, 11.31, -4.12, -0.4, sand, { bottom: true });
  fbox(out, 'base', F, -0.34, width + 0.34, -1.18, floor, -4.2, 1.36, stone);
  const back = facade([F.P(0, 0, -4.19)[0], F.P(0, 0, -4.19)[2]], F.along);
  panel(out, 'stone', back, 0, width, floor, 10.75, sand, 0.047);

  for (let col = 0; col <= 3; col++) {
    const u = 0.28 + (col * (width - 0.56)) / 3;
    fbox(out, 'tile', F, u - 0.27, u + 0.27, floor, 12.19, -0.56, 0.07, darkJade);
    if (level >= 1) {
      fbox(out, 'stone', F, u - 0.31, u + 0.31, 12.13, 12.62, -0.6, 0.15, sand);
      panel(out, 'trim', F, u - 0.17, u + 0.17, 12.23, 12.53, gold, 0.18);
    }
    if (col === 3) continue;
    const bay = (width - 0.56) / 3;
    const center = u + bay / 2;
    archedBand(out, F, center, bay - 0.48, 8.45, 1.39, level);
    archedWindow(out, back, center, floor + 0.12, 1.75, 3.18, level, 0.061, true);
    panel(out, 'glass', back, center - 0.91, center + 0.91, 5.68, 7.06, glass, 0.094);
    if (level >= 2) {
      for (const x of [center - 0.87, center, center + 0.87]) {
        panel(out, 'trim', back, x - 0.039, x + 0.039, 5.62, 7.1, trim, 0.11);
      }
    }
  }

  const center = width * 0.5;
  const steps = level >= 2 ? 6 : 3;
  for (let i = 0; i < steps; i++) {
    const r = 2.46 - (1.13 * i) / steps;
    fbox(
      out,
      'base',
      F,
      center - 2.58,
      center + 2.58,
      -0.3,
      (floor * (i + 1)) / steps,
      r - 1.18 / steps,
      r,
      sand,
    );
  }
  for (const [start, end] of [
    [-0.39, center - 2.59],
    [center + 2.59, width + 0.39],
  ]) {
    fbox(out, 'stone', F, start, end, -0.35, 0.78, 1.2, 2.62, sand);
    fbox(out, 'base', F, start + 0.11, end - 0.11, 0.76, 0.82, 1.3, 2.51, darkJade);
  }
  if (level >= 2) {
    for (const u of [0.3, width - 0.28]) {
      beam(out, 'trim', F.P(u, 1.08, 2.48), F.P(u, 2.08, 1.54), 0.06, 0.06, trim);
    }
  }
}

function towers(out, level) {
  const domeCenter = [-3.4, -2.17];
  const sides = [8, 12, 20, 28][level];
  lathe(
    out,
    'tile',
    domeCenter,
    [
      [roof - 0.06, 4.63, 4.63],
      [roof + 0.69, 4.63, 4.63],
    ],
    sides,
    darkJade,
  );
  lathe(
    out,
    'roof',
    domeCenter,
    [
      [roof + 0.62, 4.51, 4.51],
      [roof + 1.34, 4.42, 4.42],
      [roof + 2.7, 3.94, 3.94],
      [roof + 3.91, 2.77, 2.77],
      [roof + 4.86, 1.39, 1.39],
      [roof + 5.26, 0.49, 0.49],
      [roof + 5.34, 0, 0],
    ],
    sides,
    domeTone,
  );
  for (const [x, z] of [
    [8.8, -12.7],
    [8.7, 10.9],
  ]) {
    abox(
      out,
      'tile',
      [x - 0.85, roof - 0.06, z - 0.85],
      [x + 0.85, roof + 1.2, z + 0.85],
      darkJade,
    );
    const crown = roof + 3.43;
    lathe(
      out,
      'stone',
      [x, z],
      [
        [roof + 0.94, 0.78, 0.78],
        [roof + 1.14, 0.84, 0.84],
        [crown - 0.31, 0.61, 0.61],
        [crown, 0.79, 0.79],
      ],
      level > 1 ? 8 : 6,
      sand,
    );
    lathe(
      out,
      'roof',
      [x, z],
      [
        [crown - 0.016, 0.78, 0.78],
        [crown + 0.32, 0.61, 0.61],
        [crown + 0.78, 0.276, 0.276],
        [crown + 1.35, 0, 0],
      ],
      level > 1 ? 8 : 6,
      domeTone,
    );
    if (level >= 2) {
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const tangent = [-Math.sin(angle), Math.cos(angle)];
        const f = facade([x - 0.689 * Math.cos(angle), z - 0.689 * Math.sin(angle)], tangent);
        archedWindow(out, f, 0, roof + 1.53, 0.41, 1.04, 1, 0, true);
      }
    }
    if (level === 3) {
      beam(out, 'trim', [x, crown + 1.32, z], [x, crown + 1.72, z], 0.053, 0.053, gold);
    }
  }
  if (level >= 1) {
    beam(
      out,
      'trim',
      [domeCenter[0], roof + 5.3, domeCenter[1]],
      [domeCenter[0], roof + 5.6, domeCenter[1]],
      0.072,
      0.072,
      gold,
    );
  }
}

function build(out, level) {
  const body = [
    [-15.47, -11.91],
    outline[3],
    outline[4],
    outline[5],
    outline[6],
    outline[9],
    outline[10],
    [-8.05, 20.39],
    [-8.05, 7.72],
    outline[15],
  ];
  const westAnnex = [outline[0], outline[1], outline[2], [-10.4, 7.63], outline[15]];
  const southAnnex = [[-7.93, 10.88], [-7.9, 20.39], outline[11], outline[12]];
  enclosure(out, body, -1.95, roof, jade, level);
  enclosure(out, westAnnex, -2.09, 7.3, darkJade, level);
  enclosure(out, southAnnex, -1.95, 6.4, trim, level);
  for (const u of [3.75, 6.7, 9.73, 12.73, 15.75]) {
    archedWindow(out, rearEastFace, u, floor + 0.55, 2.35, 8.53, level);
  }
  for (const u of [1.76, 5.3]) archedWindow(out, northEastFace, u, floor + 0.46, 2.35, 8.53, level);
  if (level >= 2) {
    for (const z of [-8.2, -2.95, 2.3]) {
      const rear = facade([-15.51, z], [0, 1]);
      for (const y of [2.9, 6.8]) {
        panel(out, 'glass', rear, 0, 1.48, y, y + 1.45, glass, 0.051);
      }
    }
  }
  entrance(out, level);
  towers(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kaohsiung-mosque-model.mjs';
const camera = [49, 25, 28];
const lookAt = [1, 7.1, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Kaohsiung Mosque',
  wikidataId: plan.wikidataId,
  category: 'mosque',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The mosque on Jianjyun Road with a dark green glazed-tile portico, tall arched windows, and pale dome and minaret crowns.',
  camera,
  lookAt,
  sunDirection: [35, 42, 23],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.89,
    basis: 'Named Kaohsiung Mosque site with the building limit traced from Taiwan e-Map linework.',
  },
  embeddedCanonicalGraphs: ['tile_glazed', 'stone_limestone', 'concrete_plain', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'east-steps-and-portico', position: [45, 5.5, 11], lookAt: [11, 7.5, -1] },
    { name: 'arched-glazing-and-tile', position: [32, 8.4, 30], lookAt: [11, 7.2, 8] },
    { name: 'dome-minarets-and-service-wings', position: [22, 36, -26], lookAt: [0, 7.5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kaohsiung-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.28,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.13, surfaces },
      street: { export: 'street', errorMeters: 0.062, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.018, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Taiwan National Land Surveying and Mapping Center. © OpenStreetMap contributors. Mapzen open terrain.',
};
