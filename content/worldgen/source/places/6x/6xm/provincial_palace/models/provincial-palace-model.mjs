import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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

const packageRequire = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = packageRequire('earcut');
const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const {
  nominalParapetM: parapet,
  hipRidgeM: ridge,
  stringCourseM: belt,
  balconyFloorM,
} = plan.dimensions;
const ring = outwardRing(frame.geometry.outline);
const walls = ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
const front = walls.find((f) => f.normal[0] < -0.98 && f.length > 50);

const coral = rgb('ae5a48');
const trim = rgb('dfc99e');
const stair = rgb('b5a28a');
const capstone = rgb('ebe0c7');
const bandRed = rgb('ac6148');
const plinth = rgb('957b65');
const glass = rgb('404849');
const mullion = rgb('cec4a9');
const iron = rgb('ece3cf');
const tile = rgb('886255');
const tileTrim = rgb('79564a');

const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88 },
};

function cap(out, slot, loop, y, color) {
  const faces = earcut(loop.flat());
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = faces.slice(i, i + 3).map((index) => {
      const [x, z] = loop[index];
      return [x, y, z];
    });
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (up > 0) tri(out, slot, a, b, c, color);
    else tri(out, slot, a, c, b, color);
  }
}

function trimBand(out, F, low, high, depth, color = trim) {
  fbox(out, 'trim', F, 0, F.length, low, high, -0.07, depth, color);
}

function arch(out, F, u, y, width, height, level, kind = 'window') {
  if (level === 0) {
    const a = u - width / 2;
    const b = u + width / 2;
    quad4(
      out,
      'detail',
      F.P(a, y, 0.03),
      F.P(b, y, 0.03),
      F.P(b, y + height, 0.03),
      F.P(a, y + height, 0.03),
      glass,
    );
    return;
  }
  const door = kind === 'door';
  opening(out, F, u, y, width, height, {
    head: 'round',
    frameSlot: 'trim',
    glassSlot: 'detail',
    frame: trim,
    glass,
    d: 0.045,
    frameWidth: door ? 0.24 : 0.15,
    frameDepth: door ? 0.24 : 0.14,
    sill: !door,
    mullions: level > 1 ? 1 : 0,
    transoms: level > 1 && kind !== 'vent' ? 1 : 0,
    mullionColor: mullion,
  });
  if (level === 3 && kind !== 'vent') {
    const low = y + height - width / 2;
    for (const v of [-1, 1]) {
      const start = F.P(u, low + 0.045, 0.096);
      const end = F.P(u + v * width * 0.33, low + width * 0.29, 0.096);
      beam(out, 'detail', start, end, 0.05, 0.042, mullion);
    }
  }
}

function windowBay(out, F, u, level, middle = false) {
  const width = middle ? 2.12 : 1.6;
  arch(
    out,
    F,
    u,
    middle ? 1.04 : 3.62,
    width,
    middle ? 5.78 : 3.1,
    level,
    middle ? 'door' : 'window',
  );
  arch(
    out,
    F,
    u,
    middle ? 8.82 : 9.25,
    width + 0.15,
    middle ? 4.1 : 3.78,
    level,
    middle ? 'door' : 'window',
  );
  if (!middle && level > 0) {
    const y = 1.24;
    arch(out, F, u, y, 1.08, 1.2, level < 2 ? 0 : 1, 'vent');
  }
}

function storeys(out, level) {
  extrude(out, 'base', ring, -3.2, 2.75, plinth, { top: false });
  extrude(out, 'wall', ring, 2.74, parapet - 0.43, coral, { top: false });
  cap(out, 'roof', ring, parapet - 0.61, tile);
  for (const F of walls) {
    trimBand(out, F, 2.59, 2.88, 0.23);
    trimBand(out, F, belt - 0.21, belt + 0.12, 0.22);
    trimBand(out, F, parapet - 1.12, parapet - 0.9, 0.28);
    trimBand(out, F, parapet - 0.55, parapet - 0.25, 0.37, capstone);
    if (level > 0) trimBand(out, F, parapet - 0.245, parapet, 0.26, bandRed);
    if (F === front || F.length < 4.2) continue;
    const n = Math.round(F.length / 5.0);
    if (n === 0) continue;
    for (let i = 0; i < n; i++) {
      if (level === 0 && i % 2) continue;
      const u = ((i + 0.5) * F.length) / n;
      if (F.normal[0] > 0.88 && F.length > 30) {
        arch(out, F, u, 3.6, 2.11, 2.7, level < 2 ? 0 : 1);
        arch(out, F, u, 9.13, 2.24, 3.32, level < 2 ? 0 : 1);
      } else windowBay(out, F, u, level >= 2 ? level - 1 : 0);
    }
    if (level > 0) {
      fbox(out, 'trim', F, 0, 0.41, 2.76, parapet - 0.45, -0.04, 0.13, trim);
      fbox(out, 'trim', F, F.length - 0.41, F.length, 2.76, parapet - 0.45, -0.04, 0.13, trim);
    }
  }
}

function pilaster(out, u, level, width = 0.48) {
  const F = front;
  fbox(out, 'trim', F, u - width / 2, u + width / 2, 2.78, parapet - 1.03, -0.04, 0.175, trim);
  if (level > 0) {
    for (const y of [2.78, belt - 0.38, parapet - 1.56]) {
      fbox(out, 'trim', F, u - width * 0.7, u + width * 0.7, y, y + 0.24, -0.04, 0.26, capstone);
    }
  }
}

function balcony(out, midpoint, level) {
  const F = front;
  const a = midpoint - 5.12;
  const b = midpoint + 5.12;
  fbox(out, 'trim', F, a, b, balconyFloorM - 0.34, balconyFloorM + 0.07, 0.03, 1.93, capstone);
  for (const z of [0.06, 1.78]) {
    for (const u of [a, midpoint - 1.8, midpoint + 1.8, b])
      fbox(
        out,
        'trim',
        F,
        u - 0.105,
        u + 0.105,
        balconyFloorM + 0.06,
        balconyFloorM + 1.12,
        z,
        z + 0.15,
        capstone,
      );
  }
  const y = balconyFloorM + 1.07;
  beam(out, 'detail', F.P(a, y, 1.87), F.P(b, y, 1.87), 0.085, 0.078, iron);
  for (const u of [a, b]) beam(out, 'detail', F.P(u, y, 0.11), F.P(u, y, 1.87), 0.085, 0.078, iron);
  if (level > 0)
    for (let u = a + 0.3; u < b - 0.21; u += level > 1 ? 0.23 : 0.51) {
      const point = F.P(u, balconyFloorM + 0.1, 1.87);
      beam(out, 'detail', point, F.P(u, y, 1.87), 0.045, 0.044, iron);
    }
  if (level > 1) {
    for (const u of [a + 0.65, midpoint - 1.55, midpoint + 1.55, b - 0.65])
      beam(
        out,
        'trim',
        F.P(u, balconyFloorM - 1.19, 0.11),
        F.P(u, balconyFloorM - 0.3, 1.66),
        0.25,
        0.21,
        trim,
      );
  }
}

function plazaFront(out, level) {
  const F = front;
  const mid = F.length / 2;
  const pitch = (F.length - 7.3) / 12;
  for (let i = -6; i <= 6; i++) {
    const u = mid + i * pitch;
    windowBay(out, F, u, level, i === 0);
    if (level === 3 && i !== 0) {
      fbox(out, 'trim', F, u - 1.03, u + 1.03, 13.44, 13.62, -0.02, 0.1, trim);
    }
  }
  for (const u of [0.29, mid - 16.2, mid - 6.6, mid + 6.6, mid + 16.2, F.length - 0.29])
    pilaster(out, u, level, Math.abs(mid - u) < 8 ? 0.55 : 0.44);
  balcony(out, mid, level);
  const steps = level === 0 ? 3 : 6;
  for (let i = 0; i < steps; i++) {
    const d = 1.9 - (1.75 * i) / steps;
    const y = (1.07 * (i + 1)) / steps;
    fbox(out, 'base', F, mid - 2.04, mid + 2.04, -0.18, y, 0, d, stair);
  }
}

function roofHip(out, steps, p, q, level) {
  for (const [a, b, pa, pb] of [
    [steps[0], steps[1], p, p],
    [steps[1], steps[2], p, q],
    [steps[2], steps[3], q, q],
    [steps[3], steps[0], q, p],
  ]) {
    if (pa === pb) tri(out, 'roof', a, b, pa, tile);
    else {
      tri(out, 'roof', a, b, pb, tile);
      tri(out, 'roof', a, pb, pa, tile);
    }
  }
  if (level > 1) beam(out, 'roof', p, q, 0.16, 0.12, tileTrim);
}

function roofs(out, level) {
  const y = parapet - 0.16;
  roofHip(
    out,
    [
      [-29.0, y, 32.16],
      [-2.05, y, 32.16],
      [0.47, y, -29.75],
      [-25.66, y, -28.95],
    ],
    [-15.1, ridge, 21.3],
    [-12.5, ridge, -18.5],
    level,
  );
  roofHip(
    out,
    [
      [-3.7, y, 21.55],
      [-3.8, y, 32.23],
      [17.57, y, 32.23],
      [17.02, y, 21.98],
    ],
    [0.05, ridge - 0.85, 27.0],
    [13.06, ridge - 0.85, 27.0],
    level,
  );
}

function build(out, level) {
  storeys(out, level);
  plazaFront(out, level);
  roofs(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'provincial-palace-model.mjs';
const camera = [-70, 27, 57];
const lookAt = [-11, 7, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Provincial Palace',
  wikidataId: plan.wikidataId,
  category: 'palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Manaus’s Palacete Provincial, with a long red and cream elevation, rows of arched windows and a central wrought-iron balcony.',
  camera,
  lookAt,
  sunDirection: [-53, 49, 29],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.89,
    basis: 'Mapped Palacete Provincial building and its connected rear wing.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'stone_sandstone', 'tile_ceramic'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'praca-heliodoro-balbi-front', position: [-112, 13.5, 3], lookAt: [-26, 6.5, 2] },
    { name: 'ornament-and-central-balcony', position: [-51, 11.0, 27], lookAt: [-26, 8.9, 6] },
    { name: 'rear-wing-and-roof', position: [51, 24, 69], lookAt: [-4, 8, 9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'provincial-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.79,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
