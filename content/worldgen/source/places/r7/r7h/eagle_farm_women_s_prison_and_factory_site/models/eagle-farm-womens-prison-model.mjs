/** Dated reconstruction of the late-1830s Eagle Farm stockade and slab buildings. */
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const ground = read('terrain-grid');
const ref = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    slab: '8d7458',
    plank: 'aa8f6e',
    pale: 'a18b70',
    bark: '7c624b',
    weathered: '8c795f',
    roof: '71695c',
    ridge: '867969',
    mortar: 'a89479',
    plaster: 'd3c5a9',
    iron: '4a4640',
    brick: '92715b',
    pier: '9b8770',
    shutter: '53483b',
    shade: '44443a',
    gate: '705a43',
  }).map(([name, tint]) => [name, rgb(tint)]),
);
const surfaces = {
  timber: { slot: 'wall', graph: 'wood_plain', roughness: 0.93 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'wood_plain', roughness: 0.99 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95 },
  metal: { slot: 'trim', localRef: ref, roughness: 0.92 },
};

function face(out, slot, points, facing, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * facing[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function roof(out, room, detail) {
  const [x, z] = room.center;
  const x0 = x - room.width / 2 - 0.26;
  const x1 = x + room.width / 2 + 0.26;
  const z0 = z - room.depth / 2 - 0.32;
  const z1 = z + room.depth / 2 + 0.32;
  const y = room.floor + room.eave;
  const high = y + room.rise;
  const hip = room.role === 'superintendent' ? 1.65 : 0;
  const left = x0 + hip,
    right = x1 - hip;
  for (const side of [z0, z1]) {
    const tint = side === z0 ? c.roof : c.weathered;
    face(
      out,
      'roof',
      [
        [x0, y, side],
        [x1, y, side],
        [right, high, z],
        [left, high, z],
      ],
      [0, 1, 0],
      tint,
    );
    if (detail) box(out, 'timber', x, y - 0.13, side, x1 - x0, 0.16, 0.11, c.ridge);
    if (detail < 2) continue;
    // Shingle edges follow the slope, with wider bands in the street tier.
    const rows = detail === 2 ? 5 : 9;
    for (let row = 1; row < rows; row++) {
      const t = row / rows;
      const near = side + (z - side) * t;
      const far = near + Math.sign(z - side) * 0.057;
      const low = y + room.rise * t + 0.013;
      const rise = (Math.abs(far - near) * room.rise) / Math.abs(z - side);
      const a = x0 + hip * t + 0.07;
      const b = x1 - hip * t - 0.07;
      face(
        out,
        'roof',
        [
          [a, low, near],
          [b, low, near],
          [b, low + rise, far],
          [a, low + rise, far],
        ],
        [0, 1, 0],
        row % 3 ? c.ridge : c.roof,
      );
    }
  }
  for (const [edge, ridge, sign] of [
    [x0, left, -1],
    [x1, right, 1],
  ]) {
    face(
      out,
      hip ? 'roof' : 'timber',
      [
        [edge, y, z0],
        [edge, y, z1],
        [ridge, high, z],
      ],
      hip ? [0, 1, 0] : [sign, 0, 0],
      hip ? c.roof : c.slab,
    );
  }
  if (detail)
    box(out, 'roof', (left + right) / 2, high - 0.025, z, right - left + 0.06, 0.09, 0.15, c.ridge);
}

function buildRoom(out, room, detail) {
  const [x, z] = room.center,
    y = room.floor;
  const front = z - room.depth / 2;
  const plaster = room.wall === 'plaster';
  box(
    out,
    'brick',
    x,
    room.foundation,
    z,
    room.width - 0.12,
    y - room.foundation + 0.02,
    room.depth - 0.15,
    c.pier,
  );
  box(
    out,
    plaster ? 'plaster' : 'timber',
    x,
    y,
    z,
    room.width,
    room.eave + 0.015,
    room.depth,
    plaster ? c.plaster : c.slab,
  );
  roof(out, room, detail);
  const prominent =
    room.role === 'superintendent' || room.role === 'barracks' || room.role === 'cells';
  for (const offset of detail || prominent ? room.doors : []) {
    box(out, 'timber', x + offset, y + 0.037, front - 0.029, 0.85, 1.87, 0.093, c.shutter);
    if (!detail) continue;
    box(out, 'timber', x + offset, y + 1.85, front - 0.044, 0.985, 0.092, 0.105, c.pale);
    box(out, 'brick', x + offset, y - 0.135, front - 0.188, 1.06, 0.19, 0.44, c.mortar);
    if (detail < 2) continue;
    for (const hinge of [0.34, 1.52]) {
      box(out, 'metal', x + offset - 0.24, y + hinge, front - 0.082, 0.27, 0.046, 0.024, c.iron);
    }
  }
  for (const offset of detail ? room.windows : []) {
    box(out, 'timber', x + offset, y + 1.32, front - 0.024, 0.59, 0.56, 0.076, c.shade);
    if (!detail) continue;
    box(out, 'timber', x + offset, y + 1.27, front - 0.059, 0.73, 0.077, 0.15, c.plank);
    if (detail >= 2)
      box(out, 'timber', x + offset, y + 1.33, front - 0.077, 0.069, 0.58, 0.046, c.pale);
  }
  for (const offset of room.chimneys) {
    const back = z + room.depth / 2 - 0.9;
    const high = y + room.eave + room.rise + 0.54;
    box(
      out,
      'brick',
      x + offset,
      y + room.eave - 0.12,
      back,
      0.66,
      high - y - room.eave + 0.12,
      0.78,
      c.brick,
    );
    if (detail) box(out, 'brick', x + offset, high, back, 0.74, 0.15, 0.86, c.brick);
    if (detail >= 2) box(out, 'metal', x + offset, high + 0.15, back, 0.45, 0.022, 0.57, c.iron);
  }
  if (detail < 2 || plaster) return;
  for (const sign of [-1, 1]) {
    const edge = z + (sign * room.depth) / 2;
    for (
      let dx = -room.width / 2 + 0.33;
      dx < room.width / 2 - 0.1;
      dx += detail === 2 ? 0.74 : 0.35
    ) {
      if (
        sign === -1 &&
        [...room.doors, ...room.windows].some((opening) => Math.abs(opening - dx) < 0.5)
      )
        continue;
      const sx = x + dx;
      face(
        out,
        'timber',
        [
          [sx, y + 0.1, edge + sign * 0.012],
          [sx + 0.035, y + 0.1, edge + sign * 0.012],
          [sx + 0.035, y + room.eave - 0.07, edge + sign * 0.012],
          [sx, y + room.eave - 0.07, edge + sign * 0.012],
        ],
        [0, 0, sign],
        c.bark,
      );
    }
  }
}

function heightAt(x, z) {
  const [u, v] = [
    (x - ground.origin[0]) / ground.stepMeters,
    (z - ground.origin[1]) / ground.stepMeters,
  ];
  const i = Math.floor(u),
    j = Math.floor(v);
  const blend = (row) => row[i] + (row[i + 1] - row[i]) * (u - i);
  return (
    blend(ground.heightsMeters[j]) * (1 - v + j) +
    blend(ground.heightsMeters[j + 1]) * (v - j) -
    ground.modelDatumElevationMeters
  );
}

function grade(x, z) {
  return (
    (heightAt(x, z) * 2 +
      heightAt(x - 2, z) +
      heightAt(x + 2, z) +
      heightAt(x, z - 2) +
      heightAt(x, z + 2)) /
    6
  );
}

function fenceRun(out, a, b, height, detail, outer) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const length = Math.hypot(dx, dz),
    sx = dx / length,
    sz = dz / length;
  const point = (d, y, n) => [a[0] + sx * d - sz * n, y, a[1] + sz * d + sx * n];
  const segment = [length, 5.2, outer ? 0.66 : 1.06, outer ? 0.34 : 0.63][detail];
  const posts = Math.ceil(length / segment);
  const pitch = length / posts;
  const depth = outer ? 0.142 : 0.096;
  const taper = outer ? 0.4 : 0.23;
  const stepped = detail >= 2;
  const sample = (d) => grade(a[0] + sx * d, a[1] + sz * d);
  for (let i = 0; i < posts; i++) {
    const start = i * pitch + (stepped ? 0.012 : 0);
    const end = (i + 1) * pitch - (stepped ? 0.012 : 0);
    const g0 = sample(start),
      g1 = sample(end);
    const clearance = Math.min(-0.44, g0, g1) - 0.32;
    const y0 = Math.max(-0.4, g0) + height;
    const y1 = Math.max(-0.4, g1) + height;
    const tint = detail
      ? [c.slab, c.weathered, c.bark, c.plank][(i * 7 + Math.floor(length)) % 4]
      : c.slab;
    for (const sign of [-1, 1]) {
      const n = sign * depth;
      const top0 = y0 - (stepped ? taper : 0);
      const top1 = y1 - (stepped ? taper : 0);
      const startTop = point(start, top0, n);
      const endTop = point(end, top1, n);
      face(
        out,
        'timber',
        [point(start, clearance, n), point(end, clearance, n), endTop, startTop],
        [-sz * sign, 0, sx * sign],
        tint,
      );
      if (stepped)
        face(
          out,
          'timber',
          [startTop, endTop, point((start + end) / 2, (y0 + y1) / 2, 0)],
          [-sz * sign, 0, sx * sign],
          tint,
        );
    }
    if (!stepped && i + 1 < posts) continue;
    for (const [d, y, sign] of [
      [start, y0, -1],
      [end, y1, 1],
    ]) {
      const top = y - (stepped ? taper : 0);
      face(
        out,
        'timber',
        [
          point(d, clearance, -depth),
          point(d, clearance, depth),
          point(d, top, depth),
          point(d, top, -depth),
        ],
        [sx * sign, 0, sz * sign],
        tint,
      );
      if (stepped)
        face(
          out,
          'timber',
          [point(d, top, -depth), point(d, top, depth), point((start + end) / 2, (y0 + y1) / 2, 0)],
          [sx * sign, 0, sz * sign],
          tint,
        );
    }
    if (!stepped)
      face(
        out,
        'timber',
        [
          point(start, y0, -depth),
          point(end, y1, -depth),
          point(end, y1, depth),
          point(start, y0, depth),
        ],
        [0, 1, 0],
        c.weathered,
      );
  }
}

function stockade(out, ring, height, detail, outer) {
  const [p, q, r, s] = ring;
  const gap = plan.dimensions.estimatedGateOpening / 2;
  const near = [-gap, p[1]],
    far = [gap, p[1]];
  const segments = [
    [p, near],
    [far, q],
    [q, r],
    [r, s],
    [s, p],
  ];
  for (const [a, b] of segments) fenceRun(out, a, b, height, detail, outer);
  for (const x of [-gap - 0.18, gap + 0.18]) {
    const z = p[1],
      local = grade(x, z),
      top = Math.max(-0.4, local) + height + 0.02;
    const base = Math.min(-0.68, local - 0.42);
    box(out, 'timber', x, base, z, outer ? 0.44 : 0.34, top - base, outer ? 0.54 : 0.39, c.gate);
    if (detail && outer) {
      for (const offset of [0.58, 2.14]) {
        box(out, 'metal', x, Math.max(0, local) + offset, z - 0.29, 0.38, 0.097, 0.058, c.iron);
      }
    }
  }
}

function draw(out, detail) {
  const ring = frame.geometry.proposedHistoricStockade;
  stockade(out, ring, plan.dimensions.outerStockadeHeight, detail, true);
  const inner = [
    [ring[0][0] + 3.1, ring[0][1] + 3.15],
    [ring[1][0] - 3.1, ring[1][1] + 3.15],
    [ring[2][0] - 3.1, ring[2][1] - 3.3],
    [ring[3][0] + 3.1, ring[3][1] - 3.3],
  ];
  stockade(out, inner, plan.dimensions.estimatedInnerFenceHeight, detail, false);
  for (const room of plan.structures) buildRoom(out, room, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const recipe = 'eagle-farm-womens-prison-model.mjs';
const camera = [-159, 110, -142];
const lookAt = [-3, 2.0, 2.4];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${recipe}`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe,
  surfaces,
  build: closeup,
  wikidataId: 'Q17003446',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Eagle Farm’s late-1830s women’s prison and factory, with a double timber enclosure, long slab barracks, plain work buildings and the superintendent’s cottage.',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
  },
  camera,
  lookAt,
  sunDirection: [-60, 92, -48],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['wood_plain', 'plaster_lime', 'brick'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.4,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'stockade-and-barracks', position: [-111, 69, -112], lookAt: [-4, 2, 1.8] },
    { name: 'single-stockade-gate', position: [2.9, 5.6, -42.9], lookAt: [0.3, 2.6, -15.6] },
    { name: 'slab-barracks-and-cells', position: [9.2, 10.8, -5.7], lookAt: [-8.4, 2.0, 21.3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `eagle-farm-womens-prison-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.3,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.19, surfaces },
      street: { export: 'street', errorMeters: 0.44, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry from date-bound government measurements, written excavation and inventory facts, current public mapping and original terrain. Exact CC0 Qualla photograph used for modern site context only.',
};
