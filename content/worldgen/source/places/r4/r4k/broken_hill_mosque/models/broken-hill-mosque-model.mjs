/** The principal timber and corrugated-iron mosque at North Camel Camp. */
import fs from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) =>
  JSON.parse(fs.readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const d = plan.dimensions;
const bounds = map.geometry.outline;
const x0 = Math.min(...bounds.map((p) => p[0])),
  x1 = Math.max(...bounds.map((p) => p[0]));
const z0 = Math.min(...bounds.map((p) => p[1])),
  z1 = Math.max(...bounds.map((p) => p[1]));
const split = d.anteroomSplitX;
const c = Object.fromEntries(
  Object.entries({
    sheet: '8b5248',
    shelter: '805047',
    cap: '985c51',
    angle: '704139',
    roof: 'a06358',
    roofShade: '94584b',
    ridge: 'a56b60',
    plank: '80594b',
    frame: '6c4c41',
    glass: '585454',
    pad: '9e9690',
    trough: '8b8074',
  }).map(([key, tint]) => [key, rgb(tint)]),
);
const surfaces = {
  sheet: { slot: 'wall', graph: 'metal_painted', roughness: 0.89, metallic: 0.19 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.19 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.1 },
  wood: { slot: 'door', localRef: 'palette:#fffffe', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#fefffe', roughness: 0.79, metallic: 0.02 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98 },
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const yUp = [0, 1, 0];

function face(out, slot, points, target, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * target[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function edge([x, z], [u, v]) {
  const meters = Math.hypot(u - x, v - z);
  const dx = (u - x) / meters;
  const dz = (v - z) / meters;
  const n = [dz, 0, -dx];
  return { meters, n, p: (s, y, f = 0) => [x + dx * s + n[0] * f, y, z + dz * s + n[2] * f] };
}

function frontage(out, a, b, high, detail, tint) {
  const e = edge(a, b);
  const pitch = d.claddingPitch;
  const layers = detail >= 2 ? Math.ceil((high - d.floorY) / pitch) : detail === 1 ? 9 : 1;
  const perPeriod = detail === 3 ? 6 : detail === 2 ? 4 : detail === 1 ? 2 : 1;
  const lines = layers * perPeriod;
  for (let i = 0; i < lines; i++) {
    const t = i / lines;
    const add = (i) => (1 - Math.cos((i * 2 * Math.PI) / perPeriod)) * 0.0082;
    const y0 = d.floorY + (high - d.floorY) * t;
    const y1 = d.floorY + ((high - d.floorY) * (i + 1)) / lines;
    const p = e.p(0, y0, add(i)),
      q = e.p(e.meters, y0, add(i));
    const s = e.p(e.meters, y1, add(i + 1)),
      r = e.p(0, y1, add(i + 1));
    face(out, 'sheet', [p, q, s, r], e.n, tint);
  }
  return e;
}

function glazing(out, e, u, y, w, h, detail, door = false) {
  const left = u - w / 2,
    right = u + w / 2,
    top = y + h;
  const depth = 0.033;
  const rect = (slot, x1, x2, y1, y2, lift, color) =>
    face(
      out,
      slot,
      [e.p(x1, y1, lift), e.p(x2, y1, lift), e.p(x2, y2, lift), e.p(x1, y2, lift)],
      e.n,
      color,
    );
  rect(door ? 'wood' : 'glass', left, right, y, top, depth, door ? c.plank : c.glass);
  if (detail === 0) return;
  const corners = [
    e.p(left - 0.045, y - 0.042, depth + 0.014),
    e.p(right + 0.045, y - 0.042, depth + 0.014),
    e.p(right + 0.045, top + 0.042, depth + 0.014),
    e.p(left - 0.045, top + 0.042, depth + 0.014),
  ];
  beamPath(out, 'trim', corners, 0.073, 0.036, c.frame, true);
  if (detail >= 2) {
    rect(
      'wood',
      left + 0.07,
      right - 0.07,
      y + h * 0.51,
      y + h * 0.51 + 0.034,
      depth + 0.012,
      c.frame,
    );
    if (!door) rect('wood', u - 0.022, u + 0.022, y + 0.028, top - 0.028, depth + 0.013, c.frame);
    else
      for (const t of [0.24, 0.47, 0.7])
        rect(
          'wood',
          left + t * w,
          left + t * w + 0.012,
          y + 0.055,
          top - 0.055,
          depth + 0.009,
          c.angle,
        );
  }
  if (detail === 3 && door) {
    beam(
      out,
      'trim',
      e.p(right - 0.15, y + 0.91, depth + 0.039),
      e.p(right - 0.1, y + 0.91, depth + 0.055),
      0.024,
      0.022,
      c.pad,
    );
  }
}

function shed(out, detail) {
  const h = d.annexeEaveY;
  const backHigh = h + 0.48;
  const eave = 0.105;
  const a = [x0 - eave, h, z0 - eave],
    b = [x0 - eave, h, z1 + eave];
  const q = [split + 0.023, backHigh, z0 - eave],
    r = [split + 0.023, backHigh, z1 + eave];
  const west = frontage(out, [x0, z1], [x0, z0], h, detail, c.shelter);
  const front = frontage(out, [split, z1], [x0, z1], h, detail, c.shelter);
  const north = frontage(out, [x0, z0], [split, z0], h, detail, c.shelter);
  for (const [z, sign] of [
    [z0, -1],
    [z1, 1],
  ])
    face(
      out,
      'sheet',
      [
        [x0, h, z],
        [split, h, z],
        [split, backHigh, z],
      ],
      [0, 0, sign],
      c.shelter,
    );
  face(out, 'roof', [a, q, r, b], yUp, c.roofShade);
  glazing(out, front, front.meters * 0.49, d.floorY + 0.018, 0.89, 1.87, detail, true);
  if (detail >= 1) {
    for (const z of [z0, z1]) {
      beam(out, 'trim', [x0, d.floorY, z], [x0, h + 0.015, z], 0.057, 0.057, c.angle);
    }
    glazing(out, west, west.meters * 0.64, 0.94, 0.48, 0.72, detail);
    glazing(out, north, north.meters * 0.52, 0.97, 0.43, 0.69, detail);
  }
}

function prayerRoom(out, detail) {
  const y = d.mainEaveY;
  const front = frontage(out, [x1, z1], [split, z1], y, detail, c.sheet);
  const north = frontage(out, [split, z0], [x1, z0], y, detail, c.sheet);
  const east = frontage(out, [x1, z0], [x1, z1], y, detail, c.sheet);
  // Exposed prayer-room sheet above the attached anteroom.
  face(
    out,
    'sheet',
    [
      [split, d.annexeEaveY, z1],
      [split, d.annexeEaveY, z0],
      [split, y, z0],
      [split, y, z1],
    ],
    [-1, 0, 0],
    c.shelter,
  );
  glazing(out, front, front.meters * 0.45, 0.91, 0.77, 0.97, detail);
  if (detail >= 1) {
    glazing(out, east, east.meters * 0.45, 0.98, 0.74, 0.92, detail);
    glazing(out, north, north.meters * 0.55, 1.01, 0.65, 0.88, detail);
  }

  const border = 0.17;
  const northZ = z0 - border,
    southZ = z1 + border;
  const westX = split - border,
    eastX = x1 + border;
  const mid = (z0 + z1) / 2;
  const ridgeLeft = [split + 1.38, d.mainRidgeY, mid];
  const ridgeRight = [x1 - 1.59, d.mainRidgeY, mid];
  const n1 = [westX, y, northZ],
    n2 = [eastX, y, northZ];
  const s1 = [westX, y, southZ],
    s2 = [eastX, y, southZ];
  const slopes = [
    { outer: [n1, n2], inner: [ridgeLeft, ridgeRight], shade: c.roof },
    { outer: [s1, s2], inner: [ridgeLeft, ridgeRight], shade: c.roofShade },
    { outer: [n1, s1], inner: [ridgeLeft], shade: c.roof },
    { outer: [n2, s2], inner: [ridgeRight], shade: c.roofShade },
  ];
  for (const {
    outer: [a, b],
    inner,
    shade,
  } of slopes) {
    face(out, 'roof', [a, b, ...[...inner].reverse()], yUp, shade);
    if (detail === 3) {
      const n = Math.ceil(Math.hypot(a[0] - b[0], a[2] - b[2]) / 0.188);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const lo = mix(a, b, t),
          hi = inner.length === 1 ? mix(lo, inner[0], 0.95) : mix(inner[0], inner[1], t);
        lo[1] += 0.019;
        hi[1] += 0.025;
        beam(out, 'roof', lo, hi, 0.014, 0.017, c.ridge);
      }
    }
  }
  if (detail >= 1) {
    for (const [a, b] of [
      [n1, n2],
      [n2, s2],
      [s2, s1],
      [s1, n1],
      [n1, ridgeLeft],
      [s1, ridgeLeft],
      [n2, ridgeRight],
      [s2, ridgeRight],
      [ridgeLeft, ridgeRight],
    ])
      beam(out, 'trim', a, b, 0.07, 0.077, c.cap);
  }
  if (detail >= 2) {
    for (const x of [split, x1])
      for (const z of [z0, z1]) {
        beam(out, 'trim', [x, d.floorY, z], [x, y - 0.06, z], 0.069, 0.069, c.angle);
      }
    beamPath(
      out,
      'trim',
      [
        [x1 + 0.045, y - 0.13, z1 + 0.05],
        [x1 + 0.045, 0.37, z1 + 0.05],
        [x1 + 0.045, 0.19, z1 + 0.14],
      ],
      0.064,
      0.067,
      c.angle,
    );
  }
}

function draw(out, detail) {
  box(out, 'base', 0, -0.49, 0, x1 - x0, d.floorY + 0.49, z1 - z0, c.trough);
  prayerRoom(out, detail);
  shed(out, detail);
  box(out, 'base', -2.98, -0.09, z1 + 0.23, 1.12, 0.21, 0.46, c.pad);
  if (detail >= 1) {
    box(out, 'base', -2.63, -0.13, z1 + 0.91, 2.03, 0.13, 0.39, c.trough);
    const guide = 0.082;
    for (const z of [z1 + 0.74, z1 + 1.08])
      box(out, 'base', -2.63, -0.015, z, 2.03, 0.085, guide, c.pad);
  }
  if (detail >= 2) {
    box(out, 'base', -2.97, -0.11, z1 + 1.62, 0.66, 0.116, 0.48, c.pad);
    box(out, 'base', -2.94, -0.12, z1 + 2.2, 0.63, 0.102, 0.43, c.trough);
  }
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model,
  slug = id.replaceAll('_', '-');
const camera = [13, 8, 16];
const lookAt = [-0.2, 1.75, 0];
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q55605999',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Broken Hill Mosque is a low rust-red corrugated-iron mosque with a hipped prayer-room roof, attached anteroom and simple washing approach.',
  camera,
  lookAt,
  sunDirection: [1, 3, 5],
  recipeDependencies: ['generate-motat-building.mjs', 'joined-path.mjs'],
  embeddedCanonicalGraphs: ['metal_corrugated', 'metal_painted', 'concrete_plain'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.54,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'anteroom-and-washing-channel', position: [-6.6, 2.55, 8.0], lookAt: [-1.2, 1.47, 1] },
    { name: 'painted-iron-and-roof-hip', position: [7, 4.3, 7.1], lookAt: [1.72, 2.05, 1.04] },
    { name: 'north-and-rear-walls', position: [7.1, 4.2, -7.9], lookAt: [0.45, 1.67, -0.76] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs',
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.26,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.14, surfaces },
      street: { export: 'street', errorMeters: 0.083, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.035, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural geometry informed by the exact public-domain Qualla photograph, native map, original terrain, and heritage records.',
};
