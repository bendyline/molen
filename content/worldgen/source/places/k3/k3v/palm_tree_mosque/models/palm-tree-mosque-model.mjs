/** The converted Cape Georgian house and its lowered Long Street entrance. */
import fs from 'node:fs';
import {
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const [front] = outline[0];
const endZ = outline[0][1];
const startZ = outline[1][1];
const span = endZ - startZ;
const center = d.historicFrontCenterZ;
const colors = Object.fromEntries(
  Object.entries({
    lime: 'c0beab',
    return: 'b0ae9e',
    pale: 'd6d1be',
    base: 'a39c8b',
    roof: '79776d',
    trim: 'bbb7a3',
    frame: '4a574b',
    glass: '485453',
    door: '475247',
    dark: '343a34',
    plaque: '24343c',
    bark: '806e55',
    leaf: '4f6650',
    lightLeaf: '607653',
    oldLeaf: '81836a',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const c = colors;
const surfaces = {
  walls: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  roofs: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.89, metallic: 0.09 },
  dark: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.91 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88 },
  soft: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.93, doubleSided: true },
};
const up = [0, 1, 0];
const west = [-1, 0, 0];

function face(out, slot, points, direction, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * direction[i], 0) < 0) {
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

function mass(out, ring, bottom, top, tint, cap = 'roofs') {
  const area = ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [nx, nz] = ring[(i + 1) % ring.length];
    face(
      out,
      'walls',
      [
        [x, bottom, z],
        [nx, bottom, nz],
        [nx, top, nz],
        [x, top, z],
      ],
      [(nz - z) * Math.sign(area), 0, (x - nx) * Math.sign(area)],
      tint,
    );
  }
  const idx = earcut(ring.flat());
  for (let i = 0; i < idx.length; i += 3) {
    const corners = idx.slice(i, i + 3).map((j) => ring[j]);
    face(
      out,
      cap,
      corners.map(([x, z]) => [x, top, z]),
      up,
      c.roof,
    );
    face(
      out,
      'stone',
      corners.map(([x, z]) => [x, bottom, z]),
      [0, -1, 0],
      c.base,
    );
  }
}

function sash(out, z, bottom, width, height, detail, x = front) {
  box(out, 'walls', x - 0.034, bottom - 0.065, z, 0.13, height + 0.13, width + 0.14, c.pale);
  box(out, 'dark', x - 0.095, bottom, z, 0.035, height, width, c.glass);
  box(out, 'wood', x - 0.151, bottom + height * 0.49, z, 0.085, 0.073, width, c.frame);
  box(out, 'stone', x - 0.106, bottom - 0.11, z, 0.22, 0.092, width + 0.17, c.base);
  if (detail < 1) return;
  const muntins = detail >= 2 ? 3 : 1;
  for (let i = 1; i <= muntins; i++) {
    const position = z + width * (i / (muntins + 1) - 0.5);
    box(out, 'wood', x - 0.159, bottom + 0.021, position, 0.074, height - 0.04, 0.035, c.trim);
  }
  const rails = detail === 3 ? 7 : 3;
  for (let i = 1; i <= rails; i++) {
    const y = bottom + (height * i) / (rails + 1);
    if (i * 2 === rails + 1) continue;
    box(out, 'wood', x - 0.159, y, z, 0.074, 0.031, width - 0.04, c.trim);
  }
  for (const side of [-1, 1])
    box(
      out,
      'wood',
      x - 0.14,
      bottom,
      z + side * (width / 2 - 0.028),
      0.081,
      height,
      0.06,
      c.frame,
    );
}

function mainFront(out, detail) {
  box(out, 'walls', front + 0.07, d.roofY - 0.22, center, 0.31, 0.22, span + 0.06, c.pale);
  box(out, 'walls', front + 0.05, d.roofY - 0.05, center, 0.44, 0.16, span + 0.22, c.pale);
  box(
    out,
    'walls',
    front + 0.17,
    d.roofY + 0.11,
    center,
    0.37,
    d.mainParapetY - d.roofY - 0.11,
    span + 0.1,
    c.lime,
  );
  box(out, 'stone', front + 0.1, d.mainParapetY - 0.06, center, 0.46, 0.105, span + 0.1, c.trim);
  for (const z of [center - 3.56, center + 0.06, center + 3.56])
    sash(out, z, d.upperSillY, 1.41, 2.44, detail);
  for (const z of [center - 3.56, center + 3.56]) sash(out, z, d.lowerSillY, 1.22, 2.28, detail);
  const threshold = d.thresholdY;
  box(out, 'stone', front - 0.24, threshold - 0.12, center, 0.53, 0.13, 1.66, c.base);
  box(out, 'dark', front - 0.056, threshold, center, 0.045, 2.48, 1.54, c.dark);
  box(out, 'wood', front - 0.098, threshold, center, 0.05, 1.93, 1.41, c.door);
  for (const side of [-1, 1])
    box(out, 'wood', front - 0.107, threshold, center + side * 0.78, 0.095, 2.52, 0.095, c.frame);
  box(out, 'walls', front - 0.063, 2.34, center, 0.24, 0.13, 1.7, c.pale);
  if (detail > 0) {
    box(out, 'wood', front - 0.133, 1.79, center, 0.07, 0.066, 1.51, c.frame);
    for (const i of [-1, 0, 1])
      box(out, 'wood', front - 0.134, 1.85, center + i * 0.35, 0.075, 0.46, 0.045, c.trim);
    box(out, 'dark', front - 0.111, 2.72, center, 0.075, 0.27, 1.13, c.plaque);
  }
  if (detail >= 2) {
    box(out, 'wood', front - 0.138, 0.13, center, 0.045, 1.56, 0.048, c.frame);
    for (const side of [-1, 1]) {
      for (const y of [0.19, 0.93])
        box(out, 'wood', front - 0.126, y, center + side * 0.33, 0.031, 0.6, 0.52, c.door);
    }
  }
}

function ancillary(out, detail) {
  const lowEnd = outline.at(-1)[1];
  const mid = (endZ + lowEnd) / 2;
  box(out, 'walls', front + 0.08, d.returnHeight - 0.16, mid, 0.34, 0.19, lowEnd - endZ, c.trim);
  box(out, 'walls', front + 0.16, d.returnHeight, mid, 0.39, 0.35, lowEnd - endZ, c.return);
  if (detail >= 1) {
    sash(out, mid, 0.59, 0.91, 1.86, detail);
    const cols = [5.76, 5.77];
    for (let i = 0; i < cols.length; i++) {
      box(out, 'walls', cols[i] + 0.023, 3.75, -3.68 - i * 4.35, 0.13, 1.46, 0.99, c.pale);
      box(out, 'dark', cols[i] + 0.102, 3.84, -3.68 - i * 4.35, 0.055, 1.27, 0.86, c.glass);
    }
  }
}

function palm(out, detail) {
  const x = front - 1.53;
  const z = endZ - 0.15;
  const top = 9.3;
  const barkTint = detail > 0 ? c.bark : c.oldLeaf;
  box(out, 'stone', x, -0.63, z, 1.56, 0.41, 1.58, c.base);
  profile(
    out,
    [
      [-0.38, 0.28, 0.28],
      [0.26, 0.24, 0.24, 'soft', barkTint],
      [top - 0.7, 0.17, 0.17, 'soft', barkTint],
      [top + 0.12, 0.23, 0.23, 'soft', barkTint],
    ],
    detail <= 1 ? 6 : 10,
    [x, z],
  );
  const fronds = [6, 10, 17, 21][detail];
  const segments = [2, 3, 5, 7][detail];
  for (let i = 0; i < fronds; i++) {
    const angle = i * 2.3999632297;
    const u = [Math.cos(angle), 0, Math.sin(angle)];
    const side = [-u[2], 0, u[0]];
    const length = 2.08 + (i % 5) * 0.19;
    const tier = (i % 3) - 1;
    const edge = (t, sign) => {
      const width = (0.014 + 0.28 * Math.sin(t * Math.PI)) * sign;
      const y = top + (0.96 + 0.21 * tier) * Math.sin(t * Math.PI) - t * (0.68 - 0.31 * tier);
      return [x + u[0] * length * t + side[0] * width, y, z + u[2] * length * t + side[2] * width];
    };
    for (let j = 0; j < segments; j++) {
      const start = j / segments;
      const end = (j + 1) / segments;
      face(
        out,
        'soft',
        [edge(start, -1), edge(end, -1), edge(end, 1), edge(start, 1)],
        up,
        tier === -1 ? c.oldLeaf : j % 2 ? c.leaf : c.lightLeaf,
      );
    }
    if (detail >= 2)
      beamPath(
        out,
        'soft',
        Array.from({ length: segments + 1 }, (_, j) => edge(j / segments, 0)),
        0.026,
        0.03,
        c.lightLeaf,
      );
  }
}

const high = [outline[0], ...outline.slice(1, 7), [-1.087, endZ]];
function draw(out, detail) {
  mass(out, outline, -1.25, d.returnHeight, c.return);
  mass(out, high, d.returnHeight - 0.03, d.roofY, c.lime);
  mainFront(out, detail);
  ancillary(out, detail);
  palm(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-27, 13, -25];
const lookAt = [-2, 4.2, -2.7];
const module =
  'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs';

export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q7128085',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'A Cape Georgian house turned mosque with a simple parapet, multi-light sash windows, a low Long Street threshold and one date palm.',
  camera,
  lookAt,
  sunDirection: [-63, 104, -34],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'metal_standing_seam', 'wood_plain'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.1,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'long-street-sashes-and-cornice', position: [-25, 5.7, -13], lookAt: [-5, 4.13, -3.7] },
    { name: 'lowered-door-and-palm', position: [-17, 2.65, -7.4], lookAt: [-6.2, 1.95, -3.2] },
    { name: 'mapped-rear-and-roof', position: [21, 17, 15], lookAt: [-1, 4.3, -2] },
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
    errorMeters: 0.38,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.15, surfaces },
      street: { export: 'street', errorMeters: 0.062, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.021, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural geometry based on the exact public-domain Qualla photograph by Arthur Elliott, local heritage accounts, the surveyed plan and original terrain.',
};
