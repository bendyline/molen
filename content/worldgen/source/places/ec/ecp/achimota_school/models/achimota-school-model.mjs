/** Standing administration building with its offset clock tower and stepped forecourt. */
import { readFileSync } from 'node:fs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const [outline] = frame.geometry.polygons;
const { floorY, eavesY, towerX, towerZ, towerTipY, archX } = plan.section;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.92, metallic: 0.12 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.72, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    plaster: 'e3deca',
    shade: 'd2cfbc',
    trim: 'eee5ce',
    stone: 'bbae91',
    roof: '777d76',
    copper: '778375',
    clock: '4a5c57',
    face: 'd6d9c3',
    ornament: '677772',
    shutter: '50635a',
    recess: '45554f',
    pale: 'aebfb2',
    walk: 'c2ad8c',
  }).map(([name, value]) => [name, rgb(value)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const tone = (color, value) => color.map((c) => Math.min(1, c * value));

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters,
    v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = field.heightsMeters[j],
    b = field.heightsMeters[j + 1];
  return (
    lerp(lerp(a[i], a[i + 1], u - i), lerp(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

const wingEaves = (x) => (x < 0 ? 10.3 : 11.86);
const backEaves = 11.47;

function body(out) {
  const area = outline.reduce((sum, a, i) => {
    const b = outline[(i + 1) % outline.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
  const ring = area > 0 ? outline : outline.toReversed();
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, v] = ring[(i + 1) % ring.length];
    const middle = (x + u) / 2;
    let roof = wingEaves(middle);
    if (z >= -0.01 && v >= -0.01) roof = eavesY;
    if (Math.min(z, v) < -17 && Math.abs(middle) < 10) roof = backEaves;
    const base = Math.min(floorY, ground(x, z) - 0.45);
    const end = Math.min(floorY, ground(u, v) - 0.45);
    const plinth = floorY + 0.28;
    face(
      out,
      'stone',
      [
        [u, end, v],
        [x, base, z],
        [x, plinth, z],
        [u, plinth, v],
      ],
      tint.stone,
    );
    face(
      out,
      'plaster',
      [
        [u, plinth, v],
        [x, plinth, z],
        [x, roof, z],
        [u, roof, v],
      ],
      tone(tint.plaster, 0.95 + 0.045 * Math.cos(i * 4.1)),
    );
  }
  // High center and the roof-facing return of the central hall sit above the adjoining ranges.
  box(out, 'plaster', [-17.12, eavesY - 4.22, -10.35], [17.12, eavesY, 0.002], tint.plaster);
  for (const y of [floorY + 0.14, 6.62, 10.56, eavesY - 0.28]) {
    box(out, 'plaster', [-17.35, y, -0.055], [17.34, y + 0.19, 0.18], tint.trim);
  }
}

function hip(out, x0, x1, z0, z1, y, crest, axis = 'x') {
  const a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1];
  const n = (z0 + z1) / 2,
    m = (x0 + x1) / 2;
  const inset = Math.min(2.63, (x1 - x0) * 0.27, (z1 - z0) * 0.32);
  if (axis === 'x') {
    const q = [x0 + inset, crest, n],
      p = [x1 - inset, crest, n];
    face(out, 'slate', [d, c, p, q], tint.roof);
    face(out, 'slate', [b, a, q, p], tone(tint.roof, 0.94));
    triangle(out, 'slate', [a, d, q], tint.roof);
    triangle(out, 'slate', [c, b, p], tint.roof);
  } else {
    const q = [m, crest, z0 + inset],
      p = [m, crest, z1 - inset];
    face(out, 'slate', [d, p, q, a], tint.roof);
    face(out, 'slate', [b, q, p, c], tone(tint.roof, 0.96));
    triangle(out, 'slate', [a, q, b], tint.roof);
    triangle(out, 'slate', [c, p, d], tint.roof);
  }
}

function roofSystem(out, lod) {
  hip(out, -17.6, 17.8, -10.83, 0.46, eavesY - 0.02, 17.65);
  hip(out, -39.08, -16.79, -15.81, -4.79, wingEaves(-1) - 0.02, 12.49);
  hip(out, 16.81, 38.24, -11.75, -4.66, wingEaves(1) - 0.02, 14.08);
  hip(out, -32.1, -25.62, -25.89, -14.51, wingEaves(-1) - 0.23, 11.88, 'z');
  hip(out, 26.96, 34.99, -23.9, -10.28, wingEaves(1) - 0.36, 13.48, 'z');
  hip(out, -5.97, 4.26, -34.65, -10.01, backEaves - 0.04, 14.16, 'z');
  if (lod > 0) {
    box(out, 'plaster', [-0.68, 16.21, -4.5], [0.62, 20.08, -3.21], tint.shade);
    box(out, 'metal', [-0.79, 19.87, -4.61], [0.73, 20.21, -3.08], tint.copper);
    hip(out, -0.92, 0.83, -4.69, -2.96, 20.08, 20.85);
  }
}
function panel(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}
function arch(out, x, bottom, wide, top, z, lod) {
  const r = wide / 2;
  const rise = r * 0.91;
  const spring = top - rise;
  panel(out, 'wood', x - r, x + r, bottom, spring, z, tint.recess);
  const segments = [5, 8, 11, 16][lod];
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI) / segments,
      b = ((i + 1) * Math.PI) / segments;
    const curve = (angle, outer) => [
      x + (r + (outer ? 0.21 : 0)) * Math.cos(angle),
      spring + (rise + (outer ? 0.2 : 0)) * Math.sin(angle),
      z + (outer ? 0.004 : 0.009),
    ];
    triangle(out, 'wood', [[x, spring, z + 0.009], curve(a, false), curve(b, false)], tint.recess);
    if (lod > 0)
      face(
        out,
        'plaster',
        [curve(a, false), curve(a, true), curve(b, true), curve(b, false)],
        tint.trim,
      );
  }
  if (lod > 1) {
    panel(out, 'plaster', x - r - 0.21, x - r, bottom, spring, z + 0.013, tint.trim);
    panel(out, 'plaster', x + r, x + r + 0.21, bottom, spring, z + 0.013, tint.trim);
    panel(
      out,
      'window',
      x - r + 0.11,
      x + r - 0.11,
      bottom + 0.65,
      bottom + 0.71,
      z + 0.019,
      tint.ornament,
    );
  }
}

function shutter(out, x, y, w, h, z, lod) {
  const r = w / 2;
  panel(out, 'wood', x - r, x + r, y, y + h, z, tint.shutter);
  if (lod < 1) return;
  panel(out, 'plaster', x - r - 0.08, x + r + 0.08, y - 0.07, y - 0.016, z + 0.032, tint.trim);
  panel(out, 'window', x - 0.029, x + 0.029, y, y + h, z + 0.03, tint.recess);
  if (lod > 1) {
    for (let i = 1; i < 5; i++) {
      const at = y + (h * i) / 5;
      panel(out, 'window', x - r + 0.05, x + r - 0.05, at, at + 0.036, z + 0.036, tint.pale);
    }
  }
}

function windows(out, lod) {
  arch(out, archX, floorY, 4.85, 9.34, 0.205, lod);
  for (const x of [-7.95, -4.71, 6.14, 9.59, 13.16]) arch(out, x, floorY, 1.9, 6.08, 0.21, lod);
  const main = [-8.24, -5.77, 0.75, 3.09, 6.73, 10.26, 13.54];
  for (const y of [7.44, 11.42])
    for (const x of main) {
      if (y < 8 && Math.abs(x - archX) < 3.1) continue;
      shutter(out, x, y, 1.53, 2.21, 0.207, lod);
    }
  for (const [x, z, y] of [
    [-35.2, -5.85, 2.31],
    [-31.88, -5.64, 2.31],
    [-27.97, -5.38, 2.42],
    [-24.24, -5.09, 2.46],
    [23.18, -5.63, 4.48],
    [26.67, -5.34, 4.5],
    [30.2, -4.43, 4.68],
    [34.78, -5.13, 4.85],
  ]) {
    arch(out, x, y, 1.86, y + 3.05, z + 0.36, lod);
    shutter(out, x, y + 4.15, 1.56, 2.05, z + 0.34, lod);
  }
  if (lod > 1) {
    box(out, 'metal', [archX - 3.17, 9.89, 0.2], [archX + 3.17, 10.18, 0.401], tint.ornament);
    for (const x of [archX - 1.68, archX - 0.53, archX + 0.63, archX + 1.76]) {
      box(out, 'plaster', [x - 0.16, 10.12, 0.23], [x + 0.16, 10.58, 0.498], tint.trim);
    }
    const back = transform(out, Math.PI, [0, 0, -10.42]);
    for (const x of [-14.8, -10.97, -7.89, 7.54, 11.6, 15.12])
      for (const y of [7.25, 11.14]) shutter(back, x, y, 1.31, 1.83, 0.082, lod);
  }
}
const tau = 2 * Math.PI;

function dial(out, cx, y, z, lod) {
  const count = [10, 16, 22, 28][lod];
  const center = [cx, y, z + 0.02];
  const at = (r, a, project) => [cx + r * Math.cos(a), y + r * Math.sin(a), z + project];
  for (let i = 0; i < count; i++) {
    const a = (tau * i) / count,
      b = (tau * (i + 1)) / count;
    triangle(out, 'metal', [center, at(1.67, a, 0.02), at(1.67, b, 0.02)], tint.clock);
    triangle(
      out,
      'plaster',
      [[cx, y, z + 0.045], at(1.36, a, 0.045), at(1.36, b, 0.045)],
      tint.face,
    );
  }
  for (const [angle, length] of [
    [Math.PI * 0.83, 0.93],
    [Math.PI * 0.212, 1.2],
  ]) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const x = cx + length * dx;
    const h = y + length * dy;
    const px = -dy * 0.06;
    const py = dx * 0.06;
    face(
      out,
      'metal',
      [
        [cx - px, y - py, z + 0.077],
        [x - px, h - py, z + 0.077],
        [x + px, h + py, z + 0.077],
        [cx + px, y + py, z + 0.077],
      ],
      tint.clock,
    );
  }
  if (lod > 1)
    for (let i = 0; i < 12; i++) {
      const a = (tau * i) / 12;
      const x = cx + 1.12 * Math.cos(a),
        h = y + 1.12 * Math.sin(a);
      panel(out, 'metal', x - 0.058, x + 0.058, h - 0.06, h + 0.06, z + 0.073, tint.clock);
    }
}

function clockTower(out, lod) {
  const x = towerX,
    z = towerZ,
    d = 2.8;
  box(out, 'plaster', [x - d, floorY - 0.62, z - d], [x + d, 25.12, z + d], tint.plaster);
  for (const [y, width, h] of [
    [6.54, 0.19, 0.2],
    [10.43, 0.13, 0.22],
    [14.14, 0.11, 0.23],
    [19.26, 0.42, 0.73],
    [25.03, 0.38, 0.38],
  ]) {
    box(
      out,
      'plaster',
      [x - d - width, y, z - d - width],
      [x + d + width, y + h, z + d + width],
      tint.trim,
    );
  }
  const faceZ = z + d + 0.026;
  arch(out, x, floorY, 2.13, 5.83, faceZ, lod);
  for (const y of [7.4, 11.4]) shutter(out, x, y, 2.68, 2.23, faceZ, lod);
  arch(out, x, 16.11, 2.52, 18.81, faceZ, lod);
  dial(out, x, 22.61, faceZ, lod);
  const ring = (y, r) => [
    [x - r, y, z - r],
    [x - r, y, z + r],
    [x + r, y, z + r],
    [x + r, y, z - r],
  ];
  const profile = [
    [25.36, 3.79],
    [25.65, 3.51],
    [26.36, 2.83],
    [27.42, 2.18],
    [28.53, 1.67],
    [29.62, 1.24],
    [30.74, 0.93],
    [towerTipY, 0.91],
  ];
  for (let j = 1; j < profile.length; j++) {
    const a = ring(...profile[j - 1]),
      b = ring(...profile[j]);
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      face(out, 'metal', [a[i], a[k], b[k], b[i]], tone(tint.copper, 0.86 + i * 0.041 + j * 0.015));
    }
  }
  box(
    out,
    'metal',
    [x - 0.94, towerTipY - 0.03, z - 0.94],
    [x + 0.94, towerTipY + 0.13, z + 0.94],
    tint.copper,
  );
  if (lod > 1) {
    for (const a of [-0.71, 0.71])
      for (const b of [-0.71, 0.71])
        box(
          out,
          'metal',
          [x + a - 0.057, towerTipY, z + b - 0.057],
          [x + a + 0.057, towerTipY + 0.85, z + b + 0.057],
          tint.clock,
        );
    box(
      out,
      'metal',
      [x - 0.79, towerTipY + 0.76, z - 0.765],
      [x + 0.79, towerTipY + 0.84, z - 0.678],
      tint.clock,
    );
    box(
      out,
      'metal',
      [x - 0.79, towerTipY + 0.76, z + 0.678],
      [x + 0.79, towerTipY + 0.84, z + 0.765],
      tint.clock,
    );
  }
}

function forecourt(out, lod) {
  const start = 0.08,
    end = 7.08;
  const first = ground(archX, end);
  const count = [3, 5, 9, 11][lod];
  for (let i = 0; i < count; i++) {
    const a = lerp(start, end, i / count),
      b = lerp(start, end, (i + 1) / count);
    const y = lerp(floorY, first + 0.13, i / count);
    box(out, 'stone', [archX - 3.83, first - 0.22, a], [archX + 3.83, y, b], tint.walk);
  }
  if (lod > 0) {
    const ends = [7.01, 13.88, 22.34];
    for (let i = 1; i < ends.length; i++) {
      const a = ends[i - 1],
        b = ends[i];
      const x0 = archX - 3.75,
        x1 = archX + 3.75;
      face(
        out,
        'stone',
        [
          [x0, ground(x0, a) + 0.18, a],
          [x0, ground(x0, b) + 0.18, b],
          [x1, ground(x1, b) + 0.18, b],
          [x1, ground(x1, a) + 0.18, a],
        ],
        tint.walk,
      );
    }
  }
}

function build(out, lod) {
  body(out);
  roofSystem(out, lod);
  windows(out, lod);
  clockTower(out, lod);
  forecourt(out, lod);
}
export const achimotaSkyline = (out) => build(out, 0);
export const achimotaDistrict = (out) => build(out, 1);
export const achimotaStreet = (out) => build(out, 2);
export const achimotaCloseup = (out) => build(out, 3);
const recipe = 'achimota-school-model.mjs';
const camera = [45, 27, 103];
const lookAt = [-2, 8, 0];
export const achimotaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: achimotaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.997,
    basis:
      'Suppress only native footprints whose area is effectively contained by the probable administration block.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Achimota School’s administration building, with a square offset clock tower, bell-shaped crown, white arched frontage and formal stairs.',
  camera,
  lookAt,
  sunDirection: [-39, 66, 69],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.98,
    cameraYaw: -0.43,
    focus: { center: [-4, 2, -4] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'main-administration-exterior-and-clock-tower', position: camera, lookAt },
    { name: 'forecourt-stairs-and-arched-entry', position: [3, 5, 53], lookAt: [0, 9, -2] },
    { name: 'clock-dial-and-flared-metal-crown', position: [-17, 24, 22], lookAt: [-12, 22, -2] },
    { name: 'connected-back-ranges-and-hip-roofs', position: [31, 41, -61], lookAt: [-5, 9, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `achimota-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'achimotaSkyline',
    errorMeters: 1.88,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'achimotaDistrict', 0.54],
        ['street', 'achimotaStreet', 0.16],
        ['closeup', 'achimotaCloseup', 0.054],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Exact reference already in Qualla with a native creator public-domain release. OpenStreetMap campus data is ODbL 1.0.',
};
