/** Porto Alegre's restored 1858 Theatro São Pedro. All dimensions are metres. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const { frontPlazaLocalZ: front, porticoThreeBays, projection } = plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'plaster_tadelakt', roughness: 0.86 },
  roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.91 },
  timber: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.89 },
  enamel: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.76 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'ddd4ba',
    trim: 'eee8d6',
    recess: 'bcb195',
    cornice: 'd0c6ad',
    stone: '8b8677',
    roof: '8c5142',
    tile: 'a16b55',
    glass: '3a4847',
    dark: '383a35',
    timber: 'd7d4c1',
    bronze: '726051',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

const eaves = 12.78;
const mix = (a, b, t) => a + (b - a) * t;
function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = mix(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i);
  const b = mix(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i);
  return mix(a, b, v - j) - terrain.modelDatumElevationMeters;
}

function wallStrip(out, material, x, width, y, height, z, depth, tint) {
  box(out, material, [x - width / 2, y, z - depth], [x + width / 2, y + height, z], tint);
}

function rect(out, mat, x, y, halfWidth, h, z, tint) {
  face(
    out,
    mat,
    [
      [x - halfWidth, y, z],
      [x + halfWidth, y, z],
      [x + halfWidth, y + h, z],
      [x - halfWidth, y + h, z],
    ],
    tint,
  );
}

function archPoint(x, spring, r, rise, z, t) {
  return [x + r * Math.cos(t), spring + rise * Math.sin(t), z];
}

function archTrim(out, x, spring, r, rise, z, n, band, isPortal) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    const innerA = archPoint(x, spring, r, rise, z, a),
      innerB = archPoint(x, spring, r, rise, z, b);
    const outerA = archPoint(x, spring, r + band, rise + band, z, a);
    const outerB = archPoint(x, spring, r + band, rise + band, z, b);
    face(out, 'trim', [outerA, outerB, innerB, innerA], c.trim);
    if (isPortal) {
      const backA = [innerA[0], innerA[1], z - 0.56],
        backB = [innerB[0], innerB[1], z - 0.56];
      face(out, 'trim', [innerA, innerB, backB, backA], c.recess);
    }
  }
}

function bars(out, x, spring, width, y, z, rows, lod) {
  wallStrip(out, 'timber', x, 0.065, y, spring - y, z, 0.035, c.timber);
  if (lod < 2) return;
  for (let i = 1; i <= rows; i++)
    wallStrip(
      out,
      'timber',
      x,
      width,
      y + (i * (spring - y)) / (rows + 1),
      0.051,
      z + 0.015,
      0.039,
      c.timber,
    );
}

function archedWindow(out, x, y, z, width, spring, lod, doors = false) {
  const r = width / 2,
    rise = r * 0.93;
  const n = lod === 3 ? 16 : lod === 2 ? 7 : 6;
  rect(out, 'enamel', x, y, r, spring - y, z, c.dark);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    triangle(
      out,
      'enamel',
      [[x, spring, z], archPoint(x, spring, r, rise, z, a), archPoint(x, spring, r, rise, z, b)],
      c.glass,
    );
  }
  archTrim(out, x, spring, r, rise, z + 0.032, n, 0.155, false);
  for (const s of [-1, 1])
    wallStrip(out, 'trim', x + s * (r + 0.075), 0.15, y, spring - y, z + 0.055, 0.11, c.trim);
  wallStrip(out, 'trim', x, width + 0.43, y - 0.19, 0.16, z + 0.15, 0.26, c.cornice);
  if (doors) {
    wallStrip(out, 'timber', x, width - 0.08, y, 0.68, z + 0.041, 0.08, c.timber);
  }
  if (lod >= 1) bars(out, x, spring, width, y, z + 0.034, 2, lod);
}

function upperWindow(out, x, z, lod, balconyDoor = false) {
  const w = balconyDoor ? 1.7 : 1.48,
    bottom = balconyDoor ? 6.33 : 6.94;
  const top = 10.44;
  rect(out, 'enamel', x, bottom, w / 2, top - bottom, z, c.glass);
  for (const s of [-1, 1])
    wallStrip(
      out,
      'trim',
      x + s * (w / 2 + 0.095),
      0.19,
      bottom,
      top - bottom + 0.12,
      z + 0.13,
      0.23,
      c.trim,
    );
  wallStrip(out, 'trim', x, w + 0.53, bottom - 0.17, 0.18, z + 0.19, 0.27, c.cornice);
  wallStrip(out, 'trim', x, w + 0.47, top, 0.16, z + 0.2, 0.26, c.trim);
  const low = top + 0.16,
    peak = low + 0.49;
  const left = [x - w * 0.6 - 0.21, low, z + 0.095];
  const right = [x + w * 0.6 + 0.21, low, z + 0.095];
  const crest = [x, peak, z + 0.095];
  triangle(out, 'trim', [left, right, crest], c.recess);
  beam(out, 'trim', left, crest, 0.13, 0.18, c.trim);
  beam(out, 'trim', crest, right, 0.13, 0.18, c.trim);
  if (lod >= 1) bars(out, x, top, w, bottom, z + 0.031, 2, lod);
  if (lod >= 2 && !balconyDoor)
    for (const d of [-0.48, -0.24, 0, 0.24, 0.48])
      wallStrip(out, 'trim', x + d, 0.09, bottom + 0.16, 0.63, z + 0.18, 0.11, c.trim);
}

function balustrade(out, width, z, lod, rotate = 0, offset = [0, 0, 0]) {
  const rail = transform(out, rotate, offset);
  for (const [y, h, depth] of [
    [6.31, 0.16, 0.26],
    [7.25, 0.14, 0.3],
  ])
    wallStrip(rail, 'trim', 0, width, y, h, z, depth, c.trim);
  if (lod === 0) {
    wallStrip(rail, 'trim', 0, width, 6.47, 0.72, z - 0.024, 0.13, c.cornice);
    return;
  }
  const count = Math.round(width / (lod === 1 ? 0.61 : 0.32));
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) / count - 0.5) * width;
    const sides = lod === 3 ? 7 : 5;
    if (lod === 1) {
      wallStrip(rail, 'trim', x, 0.12, 6.47, 0.8, z - 0.027, 0.15, c.trim);
      continue;
    }
    const r = (y, a) => radialRing(y, a, a, sides, [x, z - 0.14]);
    loft(
      rail,
      'trim',
      [r(6.47, 0.095), r(6.65, 0.092), r(6.93, 0.046), r(7.17, 0.072), r(7.28, 0.093)],
      c.trim,
      { cap: false },
    );
  }
  for (const x of [-width / 2, 0, width / 2])
    wallStrip(rail, 'trim', x, 0.29, 6.38, 1.03, z + 0.06, 0.33, c.trim);
}

function portico(out, lod) {
  const z = front + projection,
    floor = 0.43,
    spring = 3.37,
    r = 1.31,
    rise = 1.44,
    top = 5.46;
  for (const x of [-5.23, -1.75, 1.75, 5.23]) {
    wallStrip(out, 'wall', x, 0.86, floor, top - floor + 0.1, z, 0.59, c.wall);
    wallStrip(out, 'trim', x, 1.04, floor, 0.51, z + 0.09, 0.72, c.cornice);
    wallStrip(out, 'trim', x, 1.0, spring - 0.16, 0.25, z + 0.1, 0.74, c.trim);
  }
  for (const x of porticoThreeBays) {
    const n = [5, 9, 14, 20][lod];
    for (let i = 0; i < n; i++) {
      const a = archPoint(x, spring, r, rise, z, ((i + 1) * Math.PI) / n);
      const b = archPoint(x, spring, r, rise, z, (i * Math.PI) / n);
      const capA = [a[0], top, z],
        capB = [b[0], top, z];
      face(out, 'wall', [a, b, capB, capA], c.wall);
      face(
        out,
        'wall',
        [capA, capB, b, a].map((p) => [p[0], p[1], p[2] - 0.54]),
        c.wall,
      );
    }
    archTrim(out, x, spring, r, rise, z + 0.02, n, 0.16, true);
  }
  for (const x of [-5.23, 5.23]) {
    wallStrip(out, 'wall', x, 0.72, 4.78, 0.8, z, projection, c.wall);
    wallStrip(out, 'wall', x, 0.63, floor, 0.91, z - 0.43, projection - 0.41, c.wall);
  }
  for (const [y, h, d, w, tint] of [
    [5.39, 0.34, 3.08, 11.69, c.recess],
    [5.73, 0.37, 3.23, 11.94, c.trim],
    [6.1, 0.22, 3.28, 12.02, c.cornice],
  ]) {
    wallStrip(out, 'trim', 0, w, y, h, z + d - 2.94, d, tint);
  }
  balustrade(out, 11.76, z + 0.26, lod);
  for (const side of [-1, 1])
    balustrade(out, 2.56, 0.12, lod, (side * Math.PI) / 2, [side * 5.82, 0, z - 1.02]);
  for (let i = 0; i < 3; i++) {
    const tread = floor - 0.146 * i;
    wallStrip(
      out,
      'stone',
      0,
      11.44 + i * 0.28,
      -0.73,
      tread + 0.73,
      z + 0.28 + i * 0.34,
      projection + 0.51 + i * 0.34,
      c.stone,
    );
  }
  if (lod === 3) {
    const letters = 'THEATRO SAO PEDRO';
    const width = 7.85,
      height = 0.26,
      baseline = 5.768,
      inkZ = z + 0.318;
    lettering(out, letters, {
      width,
      height,
      y: baseline,
      z: inkZ,
      stroke: 0.028,
      color: c.bronze,
      slot: 'enamel',
    });
    const advance = width / letters.length;
    const letterX = (index) => (index - letters.length / 2) * advance;
    for (const index of [6, 10, 16]) {
      const x = letterX(index) + advance * 0.375;
      const points = Array.from({ length: 9 }, (_, i) => {
        const a = (Math.PI * i) / 4;
        return [
          x + advance * 0.375 * Math.cos(a),
          baseline + height * (0.5 + 0.5 * Math.sin(a)),
          inkZ,
        ];
      });
      for (let i = 0; i < 8; i++)
        beam(out, 'enamel', points[i], points[i + 1], 0.026, 0.027, c.bronze);
    }
    const x = letterX(9);
    const tilde = [
      [x + 0.075, 6.061, inkZ],
      [x + 0.13, 6.079, inkZ],
      [x + 0.192, 6.064, inkZ],
      [x + 0.244, 6.082, inkZ],
    ];
    for (let i = 0; i < tilde.length - 1; i++)
      beam(out, 'enamel', tilde[i], tilde[i + 1], 0.016, 0.018, c.bronze);
  }
}

function wallEnvelope(out, lod) {
  // The native ring is positive in the X/Z plane. Reverse each wall edge for exterior normals.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const p = ([x, z], y) => [x, y, z];
    const ga = ground(...a),
      gb = ground(...b);
    const base = (v) => Math.max(0.46, v + 0.16);
    face(out, 'stone', [p(b, gb - 0.55), p(a, ga - 0.55), p(a, base(ga)), p(b, base(gb))], c.stone);
    face(out, 'wall', [p(b, base(gb)), p(a, base(ga)), p(a, eaves), p(b, eaves)], c.wall);
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const wall = transform(out, Math.atan2(b[1] - a[1], a[0] - b[0]), [b[0], 0, b[1]]);
    const bands = [
      [5.53, 0.31, 0.21, c.cornice],
      [11.92, 0.22, 0.35, c.cornice],
      [12.16, 0.24, 0.46, c.trim],
      [12.4, 0.32, 0.34, c.wall],
      [12.73, 0.2, 0.5, c.trim],
    ];
    for (const [y, h, depth, tint] of lod === 0 ? [bands[0], [12.13, 0.78, 0.46, c.trim]] : bands)
      wallStrip(wall, 'trim', l / 2, l + 0.03, y, h, depth - 0.06, depth, tint);
    if (lod < 2 || l < 4) continue;
    const n = Math.round(l / (lod === 3 ? 0.43 : 0.73));
    for (let k = 0; k < n; k++)
      wallStrip(wall, 'trim', ((k + 0.5) * l) / n, 0.169, 11.64, 0.32, 0.24, 0.25, c.cornice);
  }
  const roof = earcut(outline.flat());
  for (let i = 0; i < roof.length; i += 3) {
    const p = [roof[i + 2], roof[i + 1], roof[i]].map((j) => [
      outline[j][0],
      eaves + 0.07,
      outline[j][1],
    ]);
    triangle(out, 'roof', p, c.roof);
  }
}

function roof(out, lod) {
  const frontX = 12.43,
    frontZ = 20.94;
  const y = eaves + 0.06,
    peak = y + 5.27;
  const a = [-frontX, y, -21.8],
    b = [-frontX, y, frontZ];
  const d = [frontX, y, -21.8],
    c0 = [frontX, y, frontZ];
  const p = [0, peak, -12.23],
    q = [0, peak, 11.14];
  face(out, 'roof', [a, b, q, p], c.roof);
  face(out, 'roof', [c0, d, p, q], c.roof);
  triangle(out, 'roof', [b, c0, q], c.tile);
  triangle(out, 'roof', [d, a, p], c.roof);
  if (lod >= 1) {
    for (const [u, v] of [
      [p, q],
      [p, a],
      [p, d],
      [q, b],
      [q, c0],
    ])
      beam(out, 'roof', u, v, 0.18, 0.16, c.tile);
  }
  if (lod === 3) {
    for (const z of [-9.13, 3.65])
      wallStrip(out, 'wall', -5.34, 0.67, y + 2.86, 1.21, z, 0.58, c.wall);
  }
}

function wallAtZ(z, side) {
  const xs = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    if (a[1] < z === b[1] < z) continue;
    xs.push(mix(a[0], b[0], (z - a[1]) / (b[1] - a[1])));
  }
  return side === 1 ? Math.max(...xs) : Math.min(...xs);
}

function simpleBay(out, y, z) {
  rect(out, 'trim', 0, y - 0.15, 0.85, 4.6 - y, z, c.trim);
  rect(out, 'enamel', 0, y, 0.66, 4.29 - y, z + 0.021, c.dark);
  rect(out, 'trim', 0, 6.88, 0.83, 3.72, z, c.trim);
  rect(out, 'enamel', 0, 7.08, 0.65, 3.31, z + 0.021, c.glass);
}
function elevations(out, lod) {
  for (const x of [-10.5, -7, -3.5, 0, 3.5, 7, 10.5]) {
    const door = Math.abs(x) < 4;
    archedWindow(out, x, door ? 0.45 : 1.32, front + 0.018, door ? 1.55 : 1.42, 3.69, lod, door);
    upperWindow(out, x, front + 0.018, lod, door);
  }
  // The side range returns out at both ends of the recessed lateral elevations.
  for (const s of [-1, 1]) {
    const side = (z) => transform(out, (s * Math.PI) / 2, [wallAtZ(z, s), 0, z]);
    const distances = [-19.55, -15.82, -12.05, -7.94, -4.1, 0, 4.2, 8.24, 12.25, 16.36, 20.25];
    for (const z of distances) {
      const facade = side(z);
      const floor = Math.max(1.35, ground(s * 13.2, z) + 0.49);
      if (lod === 1) simpleBay(facade, floor, 0.065);
      else {
        archedWindow(facade, 0, floor, 0.065, 1.56, 3.85, lod);
        upperWindow(facade, 0, 0.065, lod);
      }
    }
    if (lod < 2) continue;
    const y = ground(s * 13.35, 0);
    const ramp = transform(out, (s * Math.PI) / 2, [s * 12.18, 0, -0.68]);
    for (let i = 0; i < 5; i++) {
      const h = mix(0.94, y + 0.12, i / 4);
      wallStrip(
        ramp,
        'stone',
        0,
        2.5,
        Math.min(h - 0.12, y - 0.18),
        Math.max(0.12, h - y + 0.18),
        0.63 + i * 0.36,
        0.63 + i * 0.36,
        c.stone,
      );
    }
  }
  const rear = transform(out, Math.PI, [0, 0, -22.69]);
  for (const x of [-8.43, -4.21, 0, 4.21, 8.43]) {
    if (lod === 1) simpleBay(transform(rear, 0, [x, 0, 0]), 1.05, 0.064);
    else {
      archedWindow(rear, x, 1.05, 0.064, 1.62, 3.82, lod);
      upperWindow(rear, x, 0.064, lod);
    }
  }
}

function build(out, lod) {
  wallEnvelope(out, lod);
  roof(out, lod);
  if (lod === 0) {
    for (const x of [-10.5, -7, -3.5, 0, 3.5, 7, 10.5]) {
      rect(out, 'enamel', x, 1.35, 0.71, 3.23, front + 0.024, c.glass);
      rect(out, 'enamel', x, 6.94, 0.72, 3.54, front + 0.024, c.glass);
    }
  } else {
    elevations(out, lod);
  }
  portico(out, lod);
}

export const saoPedroSkyline = (out) => build(out, 0);
export const saoPedroDistrict = (out) => build(out, 1);
export const saoPedroStreet = (out) => build(out, 2);
export const saoPedroCloseup = (out) => build(out, 3);

const recipe = 'sao-pedro-theatre-model.mjs';
const camera = [42, 25, 76],
  lookAt = [0, 6.6, 4.3];
const facade = { position: [0.3, 5.25, 55], lookAt: [0.1, 7.45, 22.7] };
export const saoPedroModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: [
    'heritage-tower-detail-mesh.mjs',
    'polygon-triangulation.mjs',
    'stadium-lettering.mjs',
  ],
  surfaces,
  category: 'landmark',
  build: saoPedroCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'Native footprint of the historic theatre and its recessed lateral elevations.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The restored neoclassical theatre on Praça Marechal Deodoro with a three-arch portico, balustraded balcony, pale seven-bay facade, bracketed cornice and hipped roof.',
  camera,
  lookAt,
  sunDirection: [-18, 26, 34],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.87,
    cameraYaw: 0.16,
    focus: { center: [0, 5.9, 4.3] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'square-facing-arcade-and-balcony', ...facade },
    { name: 'side-recess-and-hipped-roof', position: [54, 24, 21], lookAt: [0, 6.4, 1.2] },
    { name: 'original-range-from-the-rear', position: [-45, 28, -62], lookAt: [0, 7, -8.7] },
    { name: 'three-open-portico-arches', position: [-15, 3.5, 41], lookAt: [0, 3.2, 24.3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'arcade-' + reviewLod,
    ...facade,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'saoPedroSkyline',
    errorMeters: 1.65,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'saoPedroDistrict', 0.64],
        ['street', 'saoPedroStreet', 0.2],
        ['closeup', 'saoPedroCloseup', 0.052],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry with OpenStreetMap ODbL 1.0 controls and the public-domain photograph by Luigi Terragno.',
  limitations: plan.limitations,
};
