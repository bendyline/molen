/** Matakohe's gabled public entrance and connected kauri museum ranges. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const c = Object.fromEntries(
  Object.entries({
    cream: 'd9d5c6',
    white: 'eae4d6',
    pale: 'b9b4a4',
    wall: 'bcb7a8',
    wood: '785040',
    darkWood: '684636',
    lightWood: '8b6350',
    red: '9c4e45',
    fadedRed: 'a55b50',
    darkRed: '88433c',
    metal: '7d817e',
    darkMetal: '626767',
    glass: '444c49',
    glassLight: '646f69',
    trim: 'd2cbbc',
    base: 'aba495',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.94 },
  cedar: { slot: 'wall', graph: 'wood_plain', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.85, metallic: 0.1 },
  plinth: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.89 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.91 },
};
const up = [0, 1, 0];
const west = [-1, 0, 0];

function face(out, slot, points, direction, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
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

function mappedWall(out) {
  const floor = d.frontFloorY;
  const eaves = d.frontEaveY;
  const base = -1.45;
  const tris = earcut(outline.flat());
  const signedArea = outline.reduce((sum, [x, z], i) => {
    const [nx, nz] = outline[(i + 1) % outline.length];
    return sum + x * nz - nx * z;
  }, 0);
  for (let i = 0; i < outline.length; i++) {
    const [x, z] = outline[i];
    const [nx, nz] = outline[(i + 1) % outline.length];
    const n = [(nz - z) * Math.sign(signedArea), 0, (x - nx) * Math.sign(signedArea)];
    face(
      out,
      'plinth',
      [
        [x, base, z],
        [nx, base, nz],
        [nx, floor, nz],
        [x, floor, z],
      ],
      n,
      c.base,
    );
    if (i >= 2) {
      face(
        out,
        'wall',
        [
          [x, floor, z],
          [nx, floor, nz],
          [nx, eaves, nz],
          [x, eaves, z],
        ],
        n,
        c.wall,
      );
      continue;
    }
    const openingHalf = d.entranceHalfWidth - 0.15;
    const at = (localZ, y) => [x + ((nx - x) * (localZ - z)) / (nz - z), y, localZ];
    for (const [start, end] of [
      [z, Math.max(nz, d.entranceZ + openingHalf)],
      [Math.min(z, d.entranceZ - openingHalf), nz],
    ]) {
      if (start - end > 0.01)
        face(
          out,
          'wall',
          [at(start, floor), at(end, floor), at(end, eaves), at(start, eaves)],
          n,
          c.cream,
        );
    }
  }
  for (let i = 0; i < tris.length; i += 3) {
    const p = tris.slice(i, i + 3).map((k) => outline[k]);
    face(
      out,
      'roof',
      p.map(([x, z]) => [x, eaves, z]),
      up,
      c.metal,
    );
    face(
      out,
      'plinth',
      p.map(([x, z]) => [x, base, z]),
      [0, -1, 0],
      c.base,
    );
  }
}

function roofRange(out, x0, x1, z0, z1, eaves, ridge, tint, detail) {
  const floor = d.frontEaveY - 0.12;
  if (eaves > floor + 0.25)
    box(
      out,
      'wall',
      (x0 + x1) / 2,
      floor,
      (z0 + z1) / 2,
      x1 - x0 - 0.16,
      eaves - floor,
      z1 - z0 - 0.17,
      c.wall,
    );
  const center = (x0 + x1) / 2;
  for (const [x, n] of [
    [x0, west],
    [x1, [1, 0, 0]],
  ]) {
    face(
      out,
      'roof',
      [
        [x, eaves, z0],
        [center, ridge, z0],
        [center, ridge, z1],
        [x, eaves, z1],
      ],
      up,
      tint,
    );
    if (detail >= 1)
      beam(
        out,
        'trim',
        [x, eaves, z0],
        [x, eaves, z1],
        0.15,
        0.22,
        tint === c.red ? c.white : c.trim,
      );
    if (detail >= 3) {
      for (let z = z0 + 0.19; z < z1 - 0.15; z += 1.05)
        beam(out, 'roof', [x, eaves + 0.024, z], [center, ridge + 0.024, z], 0.03, 0.035, tint);
    }
  }
  for (const [z, n] of [
    [z0, [0, 0, -1]],
    [z1, [0, 0, 1]],
  ])
    face(
      out,
      'wall',
      [
        [x0, eaves, z],
        [center, ridge, z],
        [x1, eaves, z],
      ],
      n,
      c.pale,
    );
}

function wings(out, detail) {
  roofRange(out, -37.18, -19.33, -4.28, 54.98, 3.75, 6.44, c.red, detail);
  roofRange(out, -19.17, -6.28, 36.46, 41.27, 3.82, 5.37, c.fadedRed, detail);
  roofRange(out, -19.16, 13.38, 4.32, 36.35, 4.6, 7.72, c.darkRed, detail);
  roofRange(out, -9.12, 13.42, -1.72, 4.25, 4.05, 5.25, c.metal, detail);
  roofRange(out, -0.09, 17.29, -34.17, -1.8, 4.19, 7.3, c.metal, detail);
  roofRange(out, 17.41, 36.4, -54.54, -34.23, 4.21, 7.53, c.darkMetal, detail);
  roofRange(out, 17.41, 44.39, -49.54, -2.46, 4.1, 7.08, c.metal, detail);
  if (detail >= 1) {
    for (const z of [-0.2, 6.32, 10.5, 30.75, 36.31, 41.88, 47.45, 51.5]) {
      box(out, 'trim', d.frontX - 0.031, 1.12, z, 0.13, 1.73, 2.08, c.white);
      box(out, 'glass', d.frontX - 0.099, 1.21, z, 0.031, 1.58, 1.91, c.glass);
      if (detail >= 2) box(out, 'trim', d.frontX - 0.133, 1.22, z, 0.042, 1.56, 0.078, c.pale);
    }
  }
}

const signStrokes = {
  K: [
    [0, 0, 0, 1],
    [0, 0.53, 0.9, 1],
    [0, 0.53, 0.9, 0],
  ],
  A: [
    [0, 0, 0.45, 1],
    [0.45, 1, 0.9, 0],
    [0.18, 0.42, 0.72, 0.42],
  ],
  U: [
    [0, 1, 0, 0.16],
    [0, 0.16, 0.18, 0],
    [0.18, 0, 0.72, 0],
    [0.72, 0, 0.9, 0.16],
    [0.9, 0.16, 0.9, 1],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 0.69, 1],
    [0.69, 1, 0.88, 0.8],
    [0.88, 0.8, 0.88, 0.68],
    [0.88, 0.68, 0.68, 0.5],
    [0, 0.5, 0.68, 0.5],
    [0.49, 0.5, 0.92, 0],
  ],
  I: [
    [0.45, 0, 0.45, 1],
    [0.15, 1, 0.75, 1],
    [0.15, 0, 0.75, 0],
  ],
  M: [
    [0, 0, 0, 1],
    [0, 1, 0.45, 0.43],
    [0.45, 0.43, 0.9, 1],
    [0.9, 1, 0.9, 0],
  ],
  S: [
    [0.89, 1, 0.18, 1],
    [0.18, 1, 0.02, 0.8],
    [0.02, 0.8, 0.19, 0.54],
    [0.19, 0.54, 0.71, 0.48],
    [0.71, 0.48, 0.88, 0.26],
    [0.88, 0.26, 0.73, 0],
    [0.73, 0, 0.02, 0],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 0.88, 1],
    [0, 0.53, 0.7, 0.53],
    [0, 0, 0.85, 0],
  ],
};

function letters(out, text, x, y, z, size) {
  const step = size * 1.08;
  const first = z - (text.length * step - (step - size * 0.9)) / 2;
  for (const [index, letter] of [...text].entries())
    for (const [ax, ay, bx, by] of signStrokes[letter]) {
      const offset = first + index * step;
      beam(
        out,
        'trim',
        [x, y + ay * size, offset + ax * size],
        [x, y + by * size, offset + bx * size],
        0.052,
        0.041,
        c.white,
      );
    }
}

function entry(out, detail) {
  const x = d.frontX - 0.85;
  const z = d.entranceZ;
  const half = d.entranceHalfWidth;
  const back = -27.95;
  const floor = d.frontFloorY;
  const doors = floor + 2.97;
  const board = doors + 0.28;
  const eave = d.entryEaveY;
  const ridge = d.entryApexY;
  box(out, 'plinth', x - 0.06, -0.16, z, 2.05, floor + 0.16, 2 * half + 0.32, c.base);
  box(out, 'cedar', x + 1.65, board, z, 3.25, eave - board, 2 * half, c.wood);
  box(out, 'cedar', x + 2.05, floor, z, 1.1, board - floor, 2 * half - 0.2, c.darkWood);
  box(out, 'glass', x + 1.39, floor, z, 0.06, 2.59, 4.19, c.glass);
  box(out, 'glass', x + 1.31, floor + 0.29, z + 1.17, 0.045, 2.17, 1.61, c.glassLight);
  for (const side of [-1, 1]) {
    const end = z + side * half;
    box(out, 'trim', x + 0.18, floor, end, 0.97, eave - floor, 0.68, c.white);
    box(out, 'trim', x + 1.32, floor, z + side * 2.14, 0.15, 2.64, 0.11, c.white);
    const peak0 = [x - 0.43, ridge, z];
    const peak1 = [back, ridge, z];
    const e0 = [x - 0.43, eave, z + side * (half + 0.71)];
    const e1 = [back, eave, z + side * (half + 0.71)];
    face(out, 'roof', [e0, e1, peak1, peak0], up, c.red);
    beam(out, 'trim', e0, peak0, 0.24, 0.31, c.white);
    face(
      out,
      'cedar',
      [
        [x + 0.01, eave - 0.12, z + side * (half + 0.74)],
        [x + 0.01, ridge + 0.01, z],
        [x + 0.01, eave - 0.12, z],
      ],
      west,
      c.wood,
    );
    face(
      out,
      'wall',
      [
        [back, eave - 0.12, z + side * (half + 0.71)],
        [back, ridge, z],
        [back, eave - 0.12, z],
      ],
      [1, 0, 0],
      c.cream,
    );
  }
  box(out, 'trim', x - 0.068, board - 0.04, z, 0.22, 0.17, 2 * half, c.white);
  box(out, 'trim', x - 0.068, eave - 0.1, z, 0.22, 0.16, 2 * half, c.white);
  if (detail > 0) {
    letters(out, 'KAURI', x - 0.036, board + 1.25, z, 0.58);
    letters(out, 'MUSEUM', x - 0.036, board + 0.51, z, 0.53);
    const courses = detail === 1 ? 6 : 11;
    for (let i = 1; i < courses; i++) {
      const t = i / courses;
      box(
        out,
        'cedar',
        x - 0.001,
        eave + t * (ridge - eave - 0.19),
        z,
        0.05,
        0.025,
        (1 - t) * 2 * half - 0.05,
        i % 2 ? c.darkWood : c.lightWood,
      );
    }
  }
  if (detail >= 2) {
    for (const col of [z - half, z + half])
      for (let y = floor + 0.29; y < eave - 0.21; y += 0.29)
        box(out, 'trim', x - 0.306, y, col, 0.045, 0.022, 0.67, c.pale);
    for (const u of [-1.94, -0.67, 0.67, 1.94])
      box(out, 'trim', x + 1.25, floor, z + u, 0.055, 2.63, 0.065, c.trim);
  }
}

function draw(out, detail) {
  mappedWall(out);
  wings(out, detail);
  entry(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-100, 42, 60];
const lookAt = [-2, 4.4, 3];
const module =
  'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs';

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q6378891',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Kauri Museum at Matakohe has a tall cream-and-cedar gabled entrance under red metal, among connected low gallery buildings.',
  camera,
  lookAt,
  sunDirection: [-70, 110, 52],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: [
    'wood_weatherboard',
    'wood_plain',
    'metal_corrugated',
    'concrete_plain',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.1,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'gable-entrance-and-cedar-sign',
      position: [-56, 5.6, 22.5],
      lookAt: [-35, 4.55, 20.2],
    },
    { name: 'church-road-range-and-roof', position: [-108, 35, 42], lookAt: [-22, 3.8, 25] },
    { name: 'connected-galleries-and-rear-wings', position: [101, 47, -57], lookAt: [4, 4.0, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architecture based on the exact creator-released public-domain photo, the museum’s redevelopment records, native mapping and original terrain.',
};
