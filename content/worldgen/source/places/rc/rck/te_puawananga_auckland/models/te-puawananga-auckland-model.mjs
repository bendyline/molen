import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (filename) => JSON.parse(readFileSync(new URL('../' + filename, import.meta.url)));
const plan = read('plan-controls.json');
const outline = read('map-frame.json').geometry.outline;
const section = plan.section;
const surfaces = {
  siding: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.83, metallic: 0.24 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.7, metallic: 0.26 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.77 },
  glass: { slot: 'window', localRef: 'palette:#deedf2', roughness: 0.31, metallic: 0.18 },
};
const c = {
  siding: rgb('7a797b'),
  plum: rgb('59465b'),
  side: rgb('6e6772'),
  roof: rgb('aaa9a6'),
  roofBay: rgb('888b89'),
  flashing: rgb('57575a'),
  trim: rgb('3a393d'),
  foundation: rgb('72736a'),
  orange: rgb('a95939'),
  glass: rgb('536d72'),
  door: rgb('2d434d'),
  accent: rgb('ede4d7'),
  steel: rgb('767d7b'),
};
const lerp = (a, b, t) => a + (b - a) * t;
function clip(ring, axis, boundary, positive) {
  const output = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const aKept = a[axis] >= boundary === positive,
      bKept = b[axis] >= boundary === positive;
    if (aKept) output.push(a);
    if (aKept !== bKept) {
      const t = (boundary - a[axis]) / (b[axis] - a[axis]);
      output.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
    }
  }
  return output;
}
const east = clip(outline, 0, section.eastBayEdgeX, true);
const core = clip(outline, 0, section.eastBayEdgeX, false);
const main = clip(core, 1, section.mainSouthSeam, false);
const apron = clip(core, 1, section.mainSouthSeam, true);
const mainRoof = (z) => section.mainEaveNorth + section.mainSlope * (z - section.mainNorthZ);
const eastRoof = (z) => section.eastBayHeight + 0.045 * z;
const apronRoof = (z) => section.southApronHeight + 0.1 * (25 - z);

function face(out, slot, points, tint) {
  quad(out, slot, points, normalFor(...points), tint);
}
function edgeFrame(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
  const at = (t, y, offset = 0) => [
    lerp(a[0], b[0], t) + n[0] * offset,
    y,
    lerp(a[1], b[1], t) + n[1] * offset,
  ];
  return { length, at };
}
function faceBand(out, slot, at, a, b, y0, y1, offset, tint) {
  face(
    out,
    slot,
    [at(b, y0, offset), at(a, y0, offset), at(a, y1, offset), at(b, y1, offset)],
    tint,
  );
}

function warehouse(out, ring, top, tint, roofTint, detail) {
  const center = ring.reduce(
    (sum, p) => [sum[0] + p[0] / ring.length, sum[1] + p[1] / ring.length],
    [0, 0],
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const { length, at } = edgeFrame(a, b);
    const y0 = top(a[1]),
      y1 = top(b[1]);
    faceBand(out, 'concrete', at, 0, 1, section.foundationBase, section.floor, 0, c.foundation);
    face(
      out,
      'siding',
      [at(1, section.floor), at(0, section.floor), at(0, y0 - 0.08), at(1, y1 - 0.08)],
      tint,
    );
    face(
      out,
      'trim',
      [at(1, y1 - 0.25, 0.035), at(0, y0 - 0.25, 0.035), at(0, y0, 0.035), at(1, y1, 0.035)],
      c.flashing,
    );
    const points = [[center[0], top(center[1]), center[1]], at(1, y1), at(0, y0)];
    out.addTriangle(
      'roof',
      'palette:#ffffff',
      points,
      normalFor(...points),
      points.map((p) => [p[0], p[2]]),
      roofTint,
    );
    if (detail > 0 && length > 9) {
      const bays = detail === 1 ? 3 : Math.ceil(length / 5);
      for (let j = 1; j < bays; j++) {
        const f = j / bays,
          g = 0.032 / length;
        const eave = lerp(y0, y1, f) - 0.26;
        faceBand(out, 'trim', at, f - g, f + g, section.floor + 0.06, eave, 0.014, c.flashing);
      }
    }
  }
}

const patterns = {
  T: ['11111', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  P: ['11110', '10001', '11110', '10000', '10000'],
  U: ['10001', '10001', '10001', '10001', '01110'],
  A: ['01110', '10001', '11111', '10001', '10001'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  G: ['01111', '10000', '10111', '10001', '01110'],
};
function entranceSign(out, at, length) {
  const text = 'TE PUAWĀNANGA';
  const cell = 0.103 / length;
  const base = 0.5 - (text.length * 6 * cell) / 2;
  for (const [i, letter] of [...text].entries()) {
    const rows = patterns[letter.normalize('NFD')[0]];
    if (!rows) continue;
    for (const [row, pattern] of rows.entries())
      for (const [col, pixel] of [...pattern].entries()) {
        if (pixel === '0') continue;
        const from = base + (i * 6 + col) * cell;
        const bottom = 4.48 + (4 - row) * 0.103;
        // The south edge is described right to left in local X.
        faceBand(
          out,
          'trim',
          at,
          1 - from - cell,
          1 - from,
          bottom,
          bottom + 0.102,
          0.144,
          c.accent,
        );
      }
    if (letter === 'Ā') {
      const start = base + (i * 6 + 0.9) * cell;
      faceBand(out, 'trim', at, 1 - start - 3.2 * cell, 1 - start, 5.07, 5.13, 0.145, c.accent);
    }
  }
}

function southApproach(out, detail) {
  const a = outline[10],
    b = outline[11];
  const { at, length } = edgeFrame(a, b);
  const start = 0.305,
    end = 0.695;
  faceBand(out, 'trim', at, start, end, section.floor, 5.6, 0.09, c.plum);
  faceBand(out, 'trim', at, start + 0.11, end - 0.11, section.floor, 3.83, 0.116, c.orange);
  faceBand(out, 'glass', at, start + 0.137, end - 0.137, section.floor + 0.04, 3.56, 0.136, c.door);
  for (const [l, r] of [
    [0.18, 0.291],
    [0.708, 0.823],
  ]) {
    faceBand(out, 'trim', at, l, r, 1.23, 3.82, 0.04, c.trim);
    faceBand(out, 'glass', at, l + 0.005, r - 0.005, 1.31, 3.69, 0.054, c.glass);
    if (detail > 0)
      faceBand(
        out,
        'trim',
        at,
        (l + r) * 0.5 - 0.0015,
        (l + r) * 0.5 + 0.0015,
        1.31,
        3.69,
        0.069,
        c.steel,
      );
  }
  const capY = 3.96;
  const points = [at(end, capY, 1.77), at(start, capY, 1.77), at(start, capY), at(end, capY)];
  face(out, 'roof', points, c.roofBay);
  face(
    out,
    'trim',
    [
      at(start, capY - 0.18),
      at(end, capY - 0.18),
      at(end, capY - 0.18, 1.77),
      at(start, capY - 0.18, 1.77),
    ],
    c.trim,
  );
  faceBand(out, 'trim', at, start, end, capY - 0.18, capY, 1.77, c.flashing);
  const y = section.floor - 0.015;
  face(
    out,
    'concrete',
    [at(end, y, 1.53), at(start, y, 1.53), at(start, y, 0), at(end, y, 0)],
    c.foundation,
  );
  faceBand(out, 'concrete', at, start, end, -0.29, y, 1.53, c.foundation);
  if (detail > 0) {
    for (const f of [start + 0.025, end - 0.025])
      beam(out, 'trim', at(f, section.floor, 1.56), at(f, capY - 0.18, 1.56), 0.11, 0.1, c.steel);
    faceBand(out, 'trim', at, 0.498, 0.502, section.floor + 0.04, 3.56, 0.151, c.trim);
    faceBand(out, 'trim', at, start + 0.137, end - 0.137, 2.51, 2.58, 0.152, c.trim);
  }
  if (detail >= 2) entranceSign(out, at, length);
  if (detail === 3)
    for (const f of [0.457, 0.543])
      beam(out, 'trim', at(f, 1.22, 0.188), at(f, 1.73, 0.188), 0.035, 0.039, c.steel);
}

function equipment(out, detail) {
  if (detail === 0) return;
  for (const [x, z] of [
    [-13, 7],
    [-11, 7],
    [-20, -15],
  ]) {
    const y = mainRoof(z);
    box(out, 'trim', [x - 0.65, y - 0.05, z - 0.48], [x + 0.64, y + 0.48, z + 0.48], c.flashing);
    if (detail >= 2)
      box(out, 'trim', [x - 0.71, y + 0.48, z - 0.55], [x + 0.71, y + 0.56, z + 0.55], c.steel);
  }
}

function draw(out, detail) {
  warehouse(out, main, mainRoof, c.siding, c.roof, detail);
  warehouse(out, east, eastRoof, c.side, c.roofBay, detail);
  warehouse(out, apron, apronRoof, c.plum, c.roofBay, detail);
  southApproach(out, detail);
  equipment(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const camera = [56, 26, 72],
  lookAt = [-2, 4, 3];
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.floorBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: plan.sectionBasis,
  camera,
  lookAt,
  sunDirection: [-42, 75, 58],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['metal_corrugated', 'metal_standing_seam', 'concrete_plain'],
  mediumFiContext: {
    scale: 0.91,
    cameraYaw: 0.72,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'south-entry-and-display', position: [-10, 6.5, 53], lookAt: [-5, 3.4, 23] },
    { name: 'measured-roof-and-east-bay', position: [53, 28, -31], lookAt: [0, 4, 0] },
    { name: 'warehouse-north-and-west', position: [-55, 13, -43], lookAt: [-1, 4, -1] },
    { name: 'entrance-sign-and-door', position: [-5, 4.3, 38], lookAt: [-5, 3.25, 25] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.56,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry with numerical Auckland LiDAR measurements, attributed OpenStreetMap alignment, original terrain, and primary written records.',
};
