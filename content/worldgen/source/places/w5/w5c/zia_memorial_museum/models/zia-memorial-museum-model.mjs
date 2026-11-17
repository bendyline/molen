/** Old Circuit House in Chittagong, now Zia Memorial Museum. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const map = read('map-frame');
const { outline } = map.geometry;
const { groundFloorY, firstFloorY, eavesY, naveRidgeY, pavilionRidgeY, facadeProjections } =
  plan.dimensions;
const up = [0, 1, 0];
const ref = 'palette:#ffffff';
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.86, metallic: 0 },
  detail: { slot: 'trim', localRef: 'palette:#f8f2df', roughness: 0.79, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    wall: 'dedbd0',
    white: 'eee8d9',
    softWhite: 'd0c9b5',
    plinth: 'a69f8f',
    clay: 'a35942',
    ridge: '874d3c',
    wood: '79634b',
    stone: 'aaa493',
    glazing: '57615d',
    sash: 'bdb9a7',
    slider: 'a9a694',
    shade: '646052',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

function elevation([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const row = (k) =>
    terrain.heightsMeters[k][i] * (1 - u + i) + terrain.heightsMeters[k][i + 1] * (u - i);
  return row(j) * (1 - v + j) + row(j + 1) * (v - j) - terrain.modelDatumElevationMeters;
}

function face(out, slot, points, direction, shade) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, shade);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      n,
      points.map(([x, , z]) => [x, z]),
      shade,
    );
}

function cap(out) {
  const triangulation = new MeshBufferBuilder();
  if (
    !triangulation.addCap(
      'roof',
      ref,
      outline,
      [],
      () => eavesY,
      up,
      (p) => p,
      color.clay,
    )
  )
    throw new Error('Cannot triangulate the Circuit House plan');
  const { positions, indices } = triangulation.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const vertices = Array.from(indices.slice(i, i + 3), (n) =>
      Array.from(positions.slice(n * 3, n * 3 + 3)),
    );
    face(out, 'roof', vertices, up, color.clay);
  }
}

function edge(a, b, winding) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length,
    tz = (b[1] - a[1]) / length;
  const n = [tz * winding, 0, -tx * winding];
  return {
    length,
    n,
    at(u, y, d = 0) {
      return [a[0] + tx * u + n[0] * d, y, a[1] + tz * u + n[2] * d];
    },
  };
}
function panel(out, f, slot, a, b, y0, y1, y2, y3, d, shade) {
  face(out, slot, [f.at(a, y0, d), f.at(b, y1, d), f.at(b, y2, d), f.at(a, y3, d)], f.n, shade);
}

function window(out, f, u, level, lod) {
  const bottom = level + 0.6,
    top = bottom + 2.06,
    half = 0.63;
  panel(
    out,
    f,
    'detail',
    u - half - 0.14,
    u + half + 0.14,
    bottom - 0.13,
    bottom - 0.13,
    top + 0.16,
    top + 0.16,
    0.044,
    color.softWhite,
  );
  panel(out, f, 'detail', u - half, u + half, bottom, bottom, top, top, 0.065, color.glazing);
  panel(
    out,
    f,
    'detail',
    u - half - 0.21,
    u + half + 0.21,
    bottom - 0.14,
    bottom - 0.14,
    bottom - 0.025,
    bottom - 0.025,
    0.101,
    color.white,
  );
  if (lod < 2) return;
  for (const x of [u - half + 0.042, u, u + half - 0.042])
    panel(out, f, 'detail', x - 0.036, x + 0.036, bottom, bottom, top, top, 0.086, color.sash);
  for (const y of [bottom + 0.64, bottom + 1.35, top - 0.03])
    panel(
      out,
      f,
      'detail',
      u - half,
      u + half,
      y - 0.032,
      y - 0.032,
      y + 0.032,
      y + 0.032,
      0.088,
      color.sash,
    );
  if (lod >= 3) {
    for (const x of [u - half - 0.28, u + half + 0.12])
      panel(
        out,
        f,
        'timber',
        x,
        x + 0.16,
        bottom - 0.03,
        bottom - 0.03,
        top + 0.035,
        top + 0.035,
        0.083,
        color.slider,
      );
  }
}

function envelope(out, lod) {
  const area = outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const f = edge(a, b, Math.sign(area));
    const g0 = Math.min(-0.18, elevation(a) - 0.34),
      g1 = Math.min(-0.18, elevation(b) - 0.34);
    panel(out, f, 'stone', 0, f.length, g0, g1, groundFloorY, groundFloorY, 0, color.plinth);
    panel(out, f, 'wall', 0, f.length, groundFloorY, groundFloorY, eavesY, eavesY, 0, color.wall);
    panel(
      out,
      f,
      'detail',
      0,
      f.length,
      eavesY - 0.25,
      eavesY - 0.25,
      eavesY,
      eavesY,
      0.043,
      color.white,
    );
    if (!lod) continue;
    panel(
      out,
      f,
      'detail',
      0,
      f.length,
      firstFloorY - 0.11,
      firstFloorY - 0.11,
      firstFloorY + 0.065,
      firstFloorY + 0.065,
      0.057,
      color.softWhite,
    );
    if (f.length < 3.4 || i === 4) continue;
    const count = Math.max(1, Math.round(f.length / (lod === 1 ? 5.4 : 4.42)));
    for (let j = 0; j < count; j++) {
      const u = (f.length * (j + 0.5)) / count;
      for (const base of [groundFloorY, firstFloorY]) window(out, f, u, base, lod);
    }
    if (lod >= 2) {
      for (const u of [0.24, f.length - 0.24])
        panel(
          out,
          f,
          'detail',
          u - 0.18,
          u + 0.18,
          groundFloorY,
          groundFloorY,
          eavesY - 0.13,
          eavesY - 0.13,
          0.08,
          color.white,
        );
    }
  }
  cap(out);
}

function roofSpan(out, x0, x1, z0, z1, ridge, lod, axis) {
  const eaves = eavesY - 0.016;
  const rotate = (x, y, z) => (axis === 'x' ? [x, y, z] : [z, y, x]);
  const pitch = (z0 + z1) / 2;
  const peak = [rotate(x0, ridge, pitch), rotate(x1, ridge, pitch)];
  for (const z of [z0, z1]) {
    const a = rotate(x0, eaves, z),
      b = rotate(x1, eaves, z);
    face(out, 'roof', [a, b, peak[1], peak[0]], up, color.clay);
    if (lod) beam(out, 'roof', a, b, 0.2, 0.16, color.ridge);
  }
  for (const [x, point, sign] of [
    [x0, peak[0], -1],
    [x1, peak[1], 1],
  ]) {
    const outward = axis === 'x' ? [sign, 0, 0] : [0, 0, sign];
    const a = rotate(x, eaves, z0),
      b = rotate(x, eaves, z1);
    face(out, 'wall', [a, b, point], outward, color.wall);
    if (lod >= 2) {
      for (const p of [a, b]) beam(out, 'detail', p, point, 0.13, 0.105, color.softWhite);
    }
  }
  if (lod >= 2) beam(out, 'roof', peak[0], peak[1], 0.15, 0.14, color.ridge);
}

function roofs(out, lod) {
  const rear = Math.min(...outline.map((p) => p[1]));
  const west = Math.min(...outline.map((p) => p[0])),
    east = Math.max(...outline.map((p) => p[0]));
  roofSpan(out, west - 0.14, east + 0.15, rear + 0.08, 3.3, naveRidgeY, lod, 'x');
  for (const [i, [a, b]] of facadeProjections.entries()) {
    const z = (a[1] + b[1]) / 2;
    const ridge = i === 1 ? pavilionRidgeY - 0.51 : pavilionRidgeY;
    roofSpan(out, -3.6, z + 0.18, a[0] + 0.16, b[0] - 0.17, ridge, lod, 'z');
  }
}

function entrance(out, lod) {
  const [a, b] = facadeProjections[1];
  const [x, z] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const f = edge(a, b, -1);
  const u = f.length / 2;
  panel(
    out,
    f,
    'detail',
    u - 1.15,
    u + 1.15,
    groundFloorY,
    groundFloorY,
    groundFloorY + 2.71,
    groundFloorY + 2.71,
    0.073,
    color.wood,
  );
  panel(
    out,
    f,
    'detail',
    u - 1.41,
    u + 1.41,
    groundFloorY + 2.69,
    groundFloorY + 2.69,
    groundFloorY + 2.9,
    groundFloorY + 2.9,
    0.12,
    color.softWhite,
  );
  const n = lod ? 4 : 1;
  const street = elevation([x, z + 2]);
  for (let i = 0; i < n; i++) {
    const zz = z + i * 0.39;
    box(
      out,
      'stone',
      [x - 2.17 - i * 0.08, Math.min(street - 0.36, -0.3), zz],
      [
        x + 2.17 + i * 0.08,
        groundFloorY - i * Math.max(0.13, (groundFloorY - street) / n),
        zz + 0.4,
      ],
      color.stone,
    );
  }
  if (!lod) return;
  for (const side of [-1, 1]) {
    const xx = x + side * 1.83;
    box(
      out,
      'wall',
      [xx - 0.25, groundFloorY, z - 0.05],
      [xx + 0.25, firstFloorY + 0.25, z + 0.61],
      color.white,
    );
  }
  window(out, f, u, firstFloorY, lod);
}

function veranda(out, lod) {
  for (const [left, right] of [
    [outline[2], outline[3]],
    [outline[6], outline[7]],
  ]) {
    const f = edge(left, right, -1);
    const length = f.length;
    const leftX = Math.min(left[0], right[0]),
      rightX = Math.max(left[0], right[0]);
    const z = (left[1] + right[1]) / 2;
    box(
      out,
      'stone',
      [leftX + 0.15, firstFloorY - 0.23, z - 0.04],
      [rightX - 0.15, firstFloorY + 0.02, z + 1.26],
      color.softWhite,
    );
    box(
      out,
      'wall',
      [leftX + 0.08, eavesY - 0.3, z - 0.04],
      [rightX - 0.08, eavesY + 0.09, z + 1.39],
      color.white,
    );
    const count = lod >= 2 ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const u = (length * (i + 0.38)) / (count - 0.25);
      const [x, , zz] = f.at(u, firstFloorY, 1.02);
      box(
        out,
        'wall',
        [x - 0.16, firstFloorY, zz - 0.16],
        [x + 0.16, eavesY - 0.16, zz + 0.16],
        color.white,
      );
    }
    if (!lod) continue;
    panel(
      out,
      f,
      'detail',
      0.17,
      length - 0.15,
      firstFloorY + 0.82,
      firstFloorY + 0.82,
      firstFloorY + 0.92,
      firstFloorY + 0.92,
      1.14,
      color.softWhite,
    );
    if (lod >= 2)
      for (let u = 0.28; u < length - 0.23; u += lod === 3 ? 0.46 : 0.89)
        panel(
          out,
          f,
          'detail',
          u - 0.037,
          u + 0.037,
          firstFloorY,
          firstFloorY,
          firstFloorY + 0.85,
          firstFloorY + 0.85,
          1.13,
          color.softWhite,
        );
  }
}

function build(out, lod) {
  envelope(out, lod);
  roofs(out, lod);
  entrance(out, lod);
  veranda(out, lod);
}
export const circuitHouseSkyline = (out) => build(out, 0);
export const circuitHouseDistrict = (out) => build(out, 1);
export const circuitHouseStreet = (out) => build(out, 2);
export const circuitHouseCloseup = (out) => build(out, 3);

const recipe = 'zia-memorial-museum-model.mjs';
const camera = [39, 24, 56];
const lookAt = [0, 4.4, 0];
export const circuitHouseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  build: circuitHouseCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'The mapped former Circuit House, intact national museum envelope.',
  },
  brief:
    'Chittagong’s Old Circuit House, a white two-storey brick residence with a red tiled roof, three projecting pavilions and an upper verandah.',
  camera,
  lookAt,
  sunDirection: [44, 87, 68],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.47,
    cameraYaw: 0.44,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'forecourt-pavilions-and-verandah', position: [2, 6.4, 38], lookAt: [0, 5, 4] },
    { name: 'circuit-house-entrance-and-steps', position: [9, 4.3, 20], lookAt: [-0.2, 3.7, 6.2] },
    { name: 'gabled-roofs-and-hill-plinth', position: [-35, 24, -39], lookAt: [2, 5.6, -3.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'zia-memorial-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'circuitHouseSkyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels: {
      district: { export: 'circuitHouseDistrict', errorMeters: 0.41, surfaces },
      street: { export: 'circuitHouseStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'circuitHouseCloseup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Independent exterior geometry from attributed OpenStreetMap and Terrarium data and firsthand written accounts of the historic Circuit House.',
};
