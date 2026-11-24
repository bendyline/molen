import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const geometryRequire = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = geometryRequire('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const {
  raisedTerraceM: terrace,
  arcadeSpringM: spring,
  galleryDeckM: upper,
  lowerRoofEaveM: eave,
  atticRoofM: attic,
  westTowerM,
  eastTowerM,
} = plan.dimensions;

const shell = outwardRing(frame.geometry.outline);
const court = outwardRing(frame.geometry.holes[0]).reverse();
const paved = rgb('bfb9a6');
const foundation = rgb('c8beaa');
const cream = rgb('e2d4b1');
const inside = rgb('c6b99a');
const trim = rgb('eee2c5');
const shade = rgb('635a49');
const glass = rgb('4b5351');
const wood = rgb('88684d');
const shutter = rgb('655541');
const roof = rgb('746c64');
const seam = rgb('827b71');
const frontZ = 20.65;
const terraceZ = 23.494;
const front = facade([0, frontZ], [1, 0]);
const gallery = facade([0, frontZ - 0.23], [1, 0]);

const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.84 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.83 },
};

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function band(out, slot, f, a, b, y0, y1, d0, d1, color) {
  fbox(out, slot, f, a, b, y0, y1, d0, d1, color);
}

function cap(out, slot, ring, holes, y, color) {
  const all = [ring, ...holes].flat();
  const indices = earcut(all.flat(), holes.length ? [ring.length] : []);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => {
      const [x, z] = all[index];
      return [x, y, z];
    });
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (up > 0) tri(out, slot, a, b, c, color);
    else tri(out, slot, a, c, b, color);
  }
}

function window(out, face, u, y, w, h, level, head = 'flat') {
  if (level < 2) {
    const a = u - w / 2;
    const b = u + w / 2;
    quad4(
      out,
      'glass',
      face.P(a, y, 0.031),
      face.P(b, y, 0.031),
      face.P(b, y + h, 0.031),
      face.P(a, y + h, 0.031),
      glass,
    );
    return;
  }
  opening(out, face, u, y, w, h, {
    head,
    frameSlot: 'trim',
    glassSlot: 'glass',
    frame: trim,
    glass,
    frameWidth: 0.13,
    frameDepth: 0.135,
    d: 0.041,
    sill: head === 'flat',
    mullions: level > 1 ? 1 : 0,
    transoms: level === 3 ? 1 : 0,
    mullionColor: wood,
  });
}

function lowerWalls(out, level) {
  extrude(out, 'base', shell, -1.65, terrace, foundation, { holes: [court], top: false });
  cap(out, 'base', shell, [court], terrace, paved);
  cap(out, 'base', court, [], terrace - 0.08, paved);
  const upperShell = shell.map(([x, z]) => [x, Math.min(z, frontZ)]);
  for (const [loop, interior] of [
    [upperShell, false],
    [court, true],
  ]) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (a[1] === frontZ && b[1] === frontZ) continue;
      const f = wallFace(a, b);
      if (f.length < 0.05) continue;
      quad4(
        out,
        'wall',
        f.P(0, terrace),
        f.P(f.length, terrace),
        f.P(f.length, eave),
        f.P(0, eave),
        interior ? inside : cream,
      );
      if (level > 0 && f.length > 4.15) {
        band(out, 'trim', f, 0, f.length, upper - 0.22, upper + 0.05, -0.01, 0.16, trim);
        const count = Math.floor(f.length / (interior ? 4.1 : 4.65));
        for (let j = 1; j <= count; j++) {
          const u = (j * f.length) / (count + 1);
          window(out, f, u, terrace + 0.72, 1.43, 2.83, level, 'round');
          window(out, f, u, upper + 0.55, 1.52, 2.07, level);
        }
      }
    }
  }
  cap(out, 'roof', upperShell, [court], eave, roof);
}

const archBays = [
  [-18.55, 2.25],
  [-14.65, 2.6],
  [-10.75, 2.64],
  [-6.92, 2.5],
  [-2.49, 4.45],
  [3.19, 3.14],
  [8.32, 2.88],
  [13.23, 2.94],
];

function arch(out, center, width, level) {
  const f = front;
  const rim = roundArch(width / 2, level === 0 ? 4 : level < 3 ? 9 : 12);
  for (let i = 1; i < rim.length; i++) {
    const [a, h0] = rim[i - 1];
    const [b, h1] = rim[i];
    const u0 = center + a;
    const u1 = center + b;
    const p0 = f.P(u0, spring + h0, 0.025);
    const p1 = f.P(u1, spring + h1, 0.025);
    quad4(out, 'wall', p0, p1, f.P(u1, upper, 0.025), f.P(u0, upper, 0.025), cream);
    quad4(out, 'wall', p1, p0, f.P(u0, spring + h0, -0.62), f.P(u1, spring + h1, -0.62), inside);
    if (level > 0) {
      const outer = (u, h) => f.P(center + (u - center) * 1.13, spring + h * 1.13, 0.12);
      quad4(
        out,
        'trim',
        f.P(u0, spring + h0, 0.12),
        f.P(u1, spring + h1, 0.12),
        outer(u1, h1),
        outer(u0, h0),
        trim,
      );
    }
  }
}

function seaArcade(out, level) {
  let end = -21.69;
  const rear = facade([0, 15.05], [1, 0]);
  for (const [cx, width] of archBays) {
    const a = cx - width / 2;
    const b = cx + width / 2;
    band(out, 'wall', front, end, a, terrace, upper, -0.62, 0.025, cream);
    arch(out, cx, width, level);
    window(out, rear, cx, terrace + 0.11, width * 0.56, 3.1, level, 'round');
    end = b;
  }
  band(out, 'wall', front, end, 15.925, terrace, upper, -0.62, 0.025, cream);
  band(out, 'wall', rear, -21.68, 15.92, terrace, eave, -0.12, 0, shade);
  band(out, 'trim', front, -21.83, 16.04, upper - 0.21, upper + 0.12, -0.18, 0.2, trim);
}

function balustrade(out, f, x0, x1, y, level) {
  band(out, 'trim', f, x0, x1, y, y + 0.19, -0.36, 0.08, trim);
  band(out, 'trim', f, x0, x1, y + 0.9, y + 1.04, -0.34, 0.08, trim);
  if (level === 0) return;
  const step = [1.98, 0.9, 0.67, 0.53][level];
  for (let u = x0 + step * 0.49; u < x1 - 0.19; u += step) {
    band(out, 'trim', f, u - 0.071, u + 0.071, y + 0.16, y + 0.93, -0.26, 0.014, trim);
    if (level > 1)
      band(out, 'trim', f, u - 0.115, u + 0.115, y + 0.28, y + 0.59, -0.3, 0.053, trim);
  }
}

function terraceStairs(out, level) {
  const f = facade([0, terraceZ], [1, 0]);
  balustrade(out, f, -21.62, -6.2, terrace, level);
  balustrade(out, f, 1.25, 15.87, terrace, level);
  for (const [foot, top, start] of [
    [[-14.7, 27.38], [-6.0, 23.1], 1.35],
    [[9.35, 27.15], [1.05, 23.1], -0.47],
  ]) {
    const stair = wallFace(foot, top);
    const steps = [2, 7, 14, 16][level];
    const width = 2.38;
    const ground = Math.min(-0.55, start - 0.5);
    for (let i = 0; i < steps; i++) {
      const a = (i * stair.length) / steps;
      const b = ((i + 1) * stair.length) / steps;
      const y = start + ((terrace - start) * (i + 1)) / steps;
      band(out, 'base', stair, a, b, ground, y, -width / 2, width / 2, paved);
    }
    for (const d of [-1.3, 1.3]) {
      beam(
        out,
        'trim',
        stair.P(0, start + 0.28, d),
        stair.P(stair.length, terrace + 0.7, d),
        0.34,
        0.25,
        trim,
      );
      if (level > 1) {
        const side = Math.sign(d);
        for (const offset of [0.1, 0.35, 0.61, 0.89]) {
          const h = start + (terrace - start) * offset;
          const u = stair.length * offset;
          band(
            out,
            'trim',
            stair,
            u - 0.086,
            u + 0.086,
            h,
            h + 0.4,
            d - side * 0.13 - 0.095,
            d - side * 0.13 + 0.095,
            trim,
          );
        }
      }
    }
  }
}

function hip(out, bounds, y, peak, level) {
  const [x0, x1, z0, z1] = bounds;
  const z = (z0 + z1) / 2;
  const inset = Math.min((z1 - z0) * 0.42, (x1 - x0) * 0.42);
  const p0 = [x0 + inset, peak, z],
    p1 = [x1 - inset, peak, z];
  quad4(out, 'roof', [x0, y, z1], [x1, y, z1], p1, p0, roof);
  quad4(out, 'roof', [x1, y, z0], [x0, y, z0], p0, p1, roof);
  tri(out, 'roof', [x0, y, z0], [x0, y, z1], p0, roof);
  tri(out, 'roof', [x1, y, z1], [x1, y, z0], p1, roof);
  if (level > 1) beam(out, 'roof', p0, p1, 0.075, 0.07, seam);
}

function upperGallery(out, level) {
  const spans = [
    [-21.64, -5.35],
    [0.61, 15.91],
  ];
  for (const [a, b] of spans) {
    band(out, 'wood', gallery, a, b, upper + 0.16, eave - 0.08, -0.94, -0.78, shutter);
    band(out, 'wood', gallery, a, b, upper + 0.78, upper + 0.92, -0.01, 0.16, wood);
    band(out, 'wood', gallery, a, b, eave - 0.33, eave - 0.05, -0.02, 0.16, wood);
    const count = Math.ceil((b - a) / 2.64);
    for (let i = 0; i <= count; i++) {
      const x = a + (i * (b - a)) / count;
      const masonry = i === 0 || i === count || i % 3 === 0;
      if (level === 0 && !masonry) continue;
      const half = masonry ? 0.34 : 0.085;
      band(
        out,
        masonry ? 'wall' : 'wood',
        gallery,
        x - half,
        x + half,
        upper,
        eave,
        -0.12,
        0.12,
        masonry ? cream : wood,
      );
    }
    if (level > 1) {
      for (let u = a + 0.37; u < b - 0.25; u += 0.59)
        band(
          out,
          'wood',
          gallery,
          u - 0.026,
          u + 0.026,
          upper + 0.1,
          upper + 0.83,
          0.029,
          0.104,
          wood,
        );
      for (let n = 0; n < (level === 3 ? 9 : 5); n++) {
        const y = eave - 0.47 - n * (level === 3 ? 0.105 : 0.188);
        band(out, 'wood', gallery, a + 0.35, b - 0.3, y - 0.04, y + 0.017, -0.4, -0.15, wood);
      }
    }
  }
  for (const x of [-5.35, 0.61])
    band(out, 'wall', front, x - 0.4, x + 0.4, upper, eave + 0.45, -0.74, 0.38, cream);
  band(out, 'wood', front, -4.92, 0.21, upper + 0.27, eave + 0.37, -0.38, -0.25, shutter);
  band(out, 'trim', front, -5.45, 0.68, upper + 0.64, upper + 0.92, -0.07, 0.3, trim);
  hip(out, [-21.95, 16.23, 14.1, 20.94], eave - 0.02, eave + 1.0, level);
  hip(out, [-5.95, 1.14, 17.32, 21.32], eave + 0.48, eave + 1.87, level);
  box(out, 'wall', -18.18, 13.63, 9.0, 17.23, eave - 0.25, attic - 0.59, cream);
  const atticFace = facade([0, 17.23], [1, 0]);
  for (let x = -16.61; level > 0 && x < 12.4; x += 3.1)
    band(
      out,
      'wood',
      atticFace,
      x - 1.03,
      x + 1.03,
      eave + 0.57,
      attic - 0.67,
      0.016,
      0.071,
      shutter,
    );
  hip(out, [-18.53, 13.95, 8.7, 17.58], attic - 0.62, attic, level);
}

function tower(out, bounds, height, level, clock) {
  const [x0, x1, z0, z1] = bounds;
  box(out, 'wall', x0, x1, z0, z1, eave - 0.21, height - 0.56, cream);
  box(out, 'trim', x0 - 0.13, x1 + 0.13, z0 - 0.13, z1 + 0.13, height - 0.82, height - 0.51, trim);
  for (const [a, b] of [
    [
      [x0, z1],
      [x1, z1],
    ],
    [
      [x1, z1],
      [x1, z0],
    ],
    [
      [x1, z0],
      [x0, z0],
    ],
    [
      [x0, z0],
      [x0, z1],
    ],
  ]) {
    const f = wallFace(a, b);
    band(out, 'wall', f, 0, f.length, height - 0.53, height - 0.22, -0.35, 0.048, cream);
    const n = level === 0 ? 0 : 5;
    for (let i = 0; i <= n; i++) {
      const u = n === 0 ? f.length * 0.5 : 0.22 + ((f.length - 0.44) * i) / n;
      band(out, 'trim', f, u - 0.18, u + 0.18, height - 0.28, height + 0.1, -0.36, 0.076, trim);
    }
    if (level > 0) window(out, f, f.length * 0.46, eave + 1.13, 0.75, 1.66, level, 'round');
  }
  if (clock) {
    const f = facade([(x0 + x1) / 2, z1], [1, 0]);
    const y = height - 1.65;
    const n = level < 2 ? 10 : 18;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const b = (Math.PI * 2 * (i + 1)) / n;
      tri(
        out,
        'glass',
        f.P(0, y, 0.14),
        f.P(Math.cos(a) * 0.53, y + Math.sin(a) * 0.53, 0.14),
        f.P(Math.cos(b) * 0.53, y + Math.sin(b) * 0.53, 0.14),
        shade,
      );
    }
    if (level > 1) {
      beam(out, 'trim', f.P(0, y, 0.19), f.P(0.23, y + 0.17, 0.19), 0.042, 0.034, trim);
      beam(out, 'trim', f.P(0, y, 0.19), f.P(-0.04, y + 0.38, 0.19), 0.032, 0.029, trim);
    }
  }
}

function build(out, level) {
  lowerWalls(out, level);
  seaArcade(out, level);
  terraceStairs(out, level);
  upperGallery(out, level);
  tower(out, [-20.38, -15.3, 3.65, 9.18], westTowerM, level, true);
  tower(out, [10.06, 15.63, 5.0, 11.2], eastTowerM, level, false);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'palace-of-the-governors-togo-model.mjs';
const camera = [44, 22, 74];
const lookAt = [-2, 8, 2.9];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Palais de Lomé',
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
    'Togo’s former governor’s palace with twin unequal towers, cream arcades, teak galleries and terraced stairs overlooking the Atlantic.',
  camera,
  lookAt,
  sunDirection: [-31, 45, 50],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.88,
    basis:
      'Native building multipolygon of the Palais de Lomé within its independently mapped park.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'concrete_plain',
    'metal_painted',
    'wood_plain',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'seaward-arcades-and-stairs', position: [-2.9, 8.7, 71], lookAt: [-2.9, 7.6, 13.5] },
    { name: 'teak-gallery-and-west-tower', position: [-36, 14.2, 42], lookAt: [-8, 10.0, 16] },
    { name: 'court-and-east-tower', position: [36, 30, -39], lookAt: [-3, 5, -1.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'palace-of-the-governors-togo-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
