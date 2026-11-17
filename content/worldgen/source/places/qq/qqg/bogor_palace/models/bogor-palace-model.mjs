/** Bogor Palace in West Java, with the central portico, cupola and two connected wing ranges. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const ring = read('map-frame.json').geometry.outline;
const d = plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  plinth: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.79, metallic: 0.22 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    white: 'eeeae0',
    trim: 'e4ded1',
    stone: 'cac4b5',
    shadow: '747971',
    terracotta: 'a36349',
    darkTile: '8f523d',
    copper: 'ba8c55',
    glass: '718280',
    sash: 'e8e4d9',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

function facing(out, slot, points, desired, color) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * desired[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      points.map(([x, , z]) => [x, z]),
      color,
    );
}

function polygon(out, slot, outline, floor, ceiling, color) {
  const base = new MeshBufferBuilder();
  poly(base, slot, outline, floor, ceiling, color);
  const m = base.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const points = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normalFor(...points),
      points.map(([x, , z]) => [x, z]),
      color,
    );
  }
}

function block(out, s, x, z, w, l, y0, y1, color) {
  box(out, s, [x - w / 2, y0, z - l / 2], [x + w / 2, y1, z + l / 2], color);
}

function roof(out, x, z, width, depth, eaves, apex, level) {
  const x0 = x - width / 2,
    x1 = x + width / 2,
    z0 = z - depth / 2,
    z1 = z + depth / 2;
  const axis = width >= depth;
  const ridgeLength = Math.max(0.2, Math.abs(width - depth) * 0.95);
  const [rx, rz] = axis ? [ridgeLength / 2, 0] : [0, ridgeLength / 2];
  const one = [x - rx, apex, z - rz],
    two = [x + rx, apex, z + rz];
  const ring = [
    [x0, eaves, z0],
    [x1, eaves, z0],
    [x1, eaves, z1],
    [x0, eaves, z1],
  ];
  const faces = axis
    ? [
        [ring[0], ring[1], two, one],
        [ring[1], ring[2], two],
        [ring[2], ring[3], one, two],
        [ring[3], ring[0], one],
      ]
    : [
        [ring[0], ring[1], one],
        [ring[1], ring[2], two, one],
        [ring[2], ring[3], two],
        [ring[3], ring[0], one, two],
      ];
  for (const p of faces) facing(out, 'roof', p, [0, 1, 0], c.terracotta);
  if (level === 0) return;
  block(
    out,
    'roof',
    x,
    z,
    Math.max(0.16, rx * 2 + 0.14),
    Math.max(0.16, rz * 2 + 0.14),
    apex - 0.05,
    apex + 0.095,
    c.darkTile,
  );
}

function gardenWindow(out, axis, u, plane, y0, width, height, side, level) {
  const p = (t, h, offset) =>
    axis ? [u + t, h, plane + side * offset] : [plane + side * offset, h, u + t];
  const n = axis ? [0, 0, side] : [side, 0, 0];
  const plate = (slot, lo, hi, bottom, top, s, color) =>
    facing(out, slot, [p(lo, bottom, s), p(hi, bottom, s), p(hi, top, s), p(lo, top, s)], n, color);
  plate('trim', -width / 2 - 0.11, width / 2 + 0.11, y0 - 0.12, y0 + height + 0.13, 0.065, c.trim);
  plate('window', -width / 2, width / 2, y0, y0 + height, 0.082, c.glass);
  if (level < 2) return;
  plate('trim', -0.035, 0.035, y0, y0 + height, 0.098, c.sash);
  plate(
    'trim',
    -width / 2,
    width / 2,
    y0 + height * 0.59,
    y0 + height * 0.59 + 0.076,
    0.101,
    c.sash,
  );
  if (level === 3)
    plate('trim', -width / 2 - 0.22, width / 2 + 0.22, y0 - 0.17, y0 - 0.1, 0.14, c.stone);
}

function hallBlock(out, bounds, floor, eaves, ridge, level) {
  const [left, back, right, front] = bounds;
  const width = right - left,
    depth = front - back;
  const x = (left + right) / 2,
    z = (back + front) / 2;
  block(out, 'plinth', x, z, width + 0.14, depth + 0.14, d.foundationY, floor + 0.13, c.stone);
  block(out, 'wall', x, z, width, depth, floor, eaves, c.white);
  block(out, 'trim', x, z, width + 0.4, depth + 0.4, eaves - 0.42, eaves + 0.1, c.trim);
  roof(out, x, z, width + 0.76, depth + 0.76, eaves + 0.05, ridge, level);
  if (level === 0) return;
  for (const [line, axis, count, side] of [
    [front, true, Math.max(3, Math.round(width / 5.8)), 1],
    [back, true, Math.max(3, Math.round(width / 6)), -1],
    [right, false, Math.max(2, Math.round(depth / 5.6)), 1],
    [left, false, Math.max(2, Math.round(depth / 5.6)), -1],
  ]) {
    const from = axis ? left : back,
      span = axis ? width : depth;
    for (let i = 0; i < count; i++) {
      const u = from + ((i + 0.5) * span) / count;
      gardenWindow(
        out,
        axis,
        u,
        line,
        floor + 1.24,
        1.52,
        Math.min(2.95, (eaves - floor) * 0.54),
        side,
        level,
      );
    }
  }
}

function classicalColumn(out, x, z, base, head, diameter, level) {
  const h = head - base;
  if (level === 0) {
    block(out, 'trim', x, z, diameter, diameter, base, head, c.white);
    return;
  }
  const r = diameter / 2;
  const n = [0, 6, 10, 14][level];
  block(out, 'trim', x, z, diameter * 1.18, diameter * 1.18, base, base + 0.17, c.trim);
  const silhouette = [
    [base + 0.17, 1.07],
    [base + 0.38, 1],
    [head - 0.55, 0.77],
    [head - 0.37, 0.94],
    [head - 0.14, 1.03],
  ];
  loft(
    out,
    'trim',
    silhouette.map(([y, q]) => radialRing(y, r * q, r * q, n, [x, z])),
    c.white,
  );
  block(out, 'trim', x, z, diameter * 1.33, diameter * 1.33, head - 0.14, head, c.trim);
}

function gardenPortico(out, level) {
  const left = ring[26][0],
    right = ring[31][0];
  const center = (left + right) / 2,
    span = right - left;
  const floor = d.mainTerraceY,
    top = d.mainEavesY - 0.33;
  const back = ring[25][1] - 0.13;
  const front = Math.min(ring[26][1], ring[31][1]) - 0.28;
  const inner = front - 0.97;
  block(
    out,
    'plinth',
    center,
    (back + front) / 2,
    span + 0.18,
    front - back + 0.21,
    d.foundationY,
    floor,
    c.stone,
  );
  block(
    out,
    'trim',
    center,
    (back + front) / 2,
    span + 0.1,
    front - back + 0.42,
    floor - 0.17,
    floor + 0.1,
    c.trim,
  );
  const steps = [1, 6, 9, 12][level];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const length = 1.86 * (1 - t);
    block(
      out,
      'plinth',
      center,
      front + length * 0.5,
      span - 0.66,
      length,
      0.02,
      (floor * (i + 1)) / steps,
      c.stone,
    );
  }
  for (let i = 0; i < 6; i++) {
    const x = left + 0.89 + ((span - 1.78) * i) / 5;
    classicalColumn(out, x, inner, floor + 0.09, top, 0.97, level);
  }
  if (level > 0)
    for (const x of [left + 0.86, right - 0.86])
      for (const z of [back + 0.6, back + 4.04, back + 7.7, back + 11.25, back + 14.68])
        classicalColumn(out, x, z, floor + 0.09, top, 0.93, level);
  block(
    out,
    'wall',
    center,
    (front + back) / 2,
    span + 0.24,
    front - back + 0.46,
    top,
    top + 0.77,
    c.white,
  );
  block(
    out,
    'trim',
    center,
    (front + back) / 2,
    span + 0.64,
    front - back + 0.74,
    top + 0.65,
    top + 1.04,
    c.trim,
  );
  const eaveY = top + 1.03,
    roofEdge = front + 0.34;
  const peak = d.southPedimentY;
  facing(
    out,
    'wall',
    [
      [left - 0.22, eaveY, roofEdge],
      [right + 0.22, eaveY, roofEdge],
      [center, peak, roofEdge],
    ],
    [0, 0, 1],
    c.white,
  );
  for (const side of [-1, 1]) {
    const end = center + side * (span / 2 + 0.52);
    facing(
      out,
      'roof',
      [
        [center, peak + 0.12, back - 0.63],
        [center, peak + 0.12, roofEdge + 0.1],
        [end, eaveY + 0.015, roofEdge + 0.1],
        [end, eaveY + 0.015, back - 0.63],
      ],
      [0, 1, 0],
      c.terracotta,
    );
    facing(
      out,
      'trim',
      [
        [center, peak + 0.1, roofEdge + 0.13],
        [end, eaveY + 0.015, roofEdge + 0.13],
        [end, eaveY - 0.18, roofEdge + 0.13],
        [center, peak - 0.12, roofEdge + 0.13],
      ],
      [0, 0, 1],
      c.trim,
    );
  }
}

function northernPortico(out, level) {
  const left = ring[67][0] + 0.38,
    right = ring[66][0] - 0.38;
  const front = Math.min(ring[66][1], ring[67][1]) + 0.42,
    back = ring[68][1] + 0.47;
  const center = (left + right) / 2,
    floor = d.mainTerraceY,
    top = d.mainEavesY - 0.52;
  block(
    out,
    'plinth',
    center,
    (front + back) / 2,
    right - left,
    back - front,
    d.foundationY,
    floor,
    c.stone,
  );
  const columns = level === 0 ? 6 : 8;
  for (let i = 0; i < columns; i++)
    classicalColumn(
      out,
      left + 0.67 + ((right - left - 1.34) * i) / (columns - 1),
      front + 0.71,
      floor + 0.03,
      top,
      0.89,
      level,
    );
  if (level > 1)
    for (const x of [left + 0.67, right - 0.67])
      for (const t of [0.28, 0.52, 0.76])
        classicalColumn(out, x, front + (back - front) * t, floor + 0.03, top, 0.89, level);
  block(
    out,
    'wall',
    center,
    (front + back) / 2,
    right - left + 0.27,
    back - front + 0.43,
    top,
    top + 0.65,
    c.white,
  );
  block(
    out,
    'trim',
    center,
    (front + back) / 2,
    right - left + 0.64,
    back - front + 0.86,
    top + 0.57,
    top + 0.82,
    c.trim,
  );
  roof(
    out,
    center,
    (front + back) / 2,
    right - left + 0.62,
    back - front + 0.9,
    top + 0.79,
    top + 2.51,
    level,
  );
}

function cupola(out, level) {
  const [x, z] = d.cupolaCenter;
  const n = [8, 12, 18, 26][level];
  const drumBottom = d.cupolaBaseY,
    spring = d.cupolaSpringY,
    top = d.cupolaTopY;
  const form = (slot, control, color) =>
    loft(
      out,
      slot,
      control.map(([h, r]) => radialRing(h, r, r, n, [x, z])),
      color,
    );
  form(
    'wall',
    [
      [drumBottom, 3.63],
      [drumBottom + 0.38, 3.63],
      [spring - 0.45, 3.06],
      [spring, 3.2],
    ],
    c.white,
  );
  form(
    'trim',
    [
      [spring - 0.31, 3.28],
      [spring - 0.08, 3.4],
      [spring + 0.13, 3.29],
    ],
    c.trim,
  );
  const dome = [
    [spring, 3.23],
    [spring + 0.87, 2.96],
    [spring + 1.63, 2.48],
    [spring + 2.31, 1.73],
    [spring + 2.72, 0.89],
    [spring + 2.92, 0.38],
    [top, 0.155],
  ];
  form('copper', level === 0 ? [dome[0], dome[2], dome[4], dome[6]] : dome, c.copper);
  if (level === 0) return;
  for (let i = 0; i < 8; i++) {
    const t = (i * Math.PI) / 4;
    const n = [Math.sin(t), 0, Math.cos(t)];
    const w = [n[2], 0, -n[0]];
    const p = (u, h) => [x + n[0] * 3.34 + w[0] * u, h, z + n[2] * 3.34 + w[2] * u];
    facing(
      out,
      'window',
      [
        p(-0.39, drumBottom + 1.11),
        p(0.39, drumBottom + 1.11),
        p(0.39, spring - 0.64),
        p(-0.39, spring - 0.64),
      ],
      n,
      c.glass,
    );
  }
  if (level > 1)
    form(
      'copper',
      [
        [top - 0.27, 0.29],
        [top + 0.27, 0.16],
        [top + 1.33, 0.056],
      ],
      c.copper,
    );
}

function wingEnds(out, level) {
  const ends = [
    {
      outline: [...ring.slice(2, 14)],
      center: [-87.35, 1.98],
      w: 30.73,
      l: 25.09,
      floor: -0.83,
      eaves: 6.65,
      ridge: 8.81,
    },
    {
      outline: [...ring.slice(39, 55)],
      center: [97.12, 2.42],
      w: 32.04,
      l: 27.04,
      floor: 4.02,
      eaves: 10.01,
      ridge: 12.14,
    },
  ];
  for (const end of ends) {
    polygon(out, 'plinth', end.outline, -6.5, end.floor, c.stone);
    polygon(out, 'wall', end.outline, end.floor, end.eaves, c.white);
    roof(out, ...end.center, end.w, end.l, end.eaves, end.ridge, level);
    if (level === 0) continue;
    const winding = Math.sign(
      end.outline.reduce((sum, p, i) => {
        const q = end.outline[(i + 1) % end.outline.length];
        return sum + p[0] * q[1] - p[1] * q[0];
      }, 0),
    );
    for (const [i, p] of end.outline.entries()) {
      const q = end.outline[(i + 1) % end.outline.length];
      const width = Math.abs(q[0] - p[0]),
        depth = Math.abs(q[1] - p[1]);
      const axis = width > depth,
        length = Math.max(width, depth);
      if (length < 7.0) continue;
      const count = Math.round(length / 5.2);
      for (let j = 0; j < count; j++) {
        const u = ((axis ? q[0] - p[0] : q[1] - p[1]) * (j + 0.5)) / count + (axis ? p[0] : p[1]);
        const plane = axis ? (p[1] + q[1]) / 2 : (p[0] + q[0]) / 2;
        const outward = winding * (axis ? Math.sign(p[0] - q[0]) : Math.sign(q[1] - p[1]));
        gardenWindow(out, axis, u, plane, end.floor + 1.45, 1.54, 2.46, outward, level);
      }
    }
  }
}

function draw(out, level) {
  wingEnds(out, level);
  hallBlock(out, [-24.8, -17.23, 33.24, 19.44], d.mainTerraceY, d.mainEavesY, d.mainRidgeY, level);
  hallBlock(out, [-73.8, -1.05, -24.5, 6.62], 0.63, 5.82, 7.03, level);
  hallBlock(out, [33.08, -3.84, 82.6, 4.22], 2.52, 7.37, 8.68, level);
  hallBlock(out, [-63.22, -28.78, -37.43, 6.69], 0.58, d.wingEavesY, d.wingRidgeY, level);
  hallBlock(out, [43.73, -31.48, 69.27, 3.53], 2.58, 8.4, 10.69, level);
  hallBlock(out, [-55.62, 5.97, -42.42, 10.93], 1.2, 5.84, 7.02, level);
  hallBlock(out, [-56.18, -30.77, -44.15, -26.67], 0.62, 5.15, 6.3, level);
  hallBlock(out, [49.55, -38.59, 62.21, -30.09], 1.72, 6.6, 8.08, level);
  gardenPortico(out, level);
  northernPortico(out, level);
  cupola(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [107, 62, 174];
const lookAt = [5, 6, 4];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The present Bogor Palace with white ceremonial colonnades, red roof ranges, two connected wings and the gold-topped central cupola.',
  camera,
  lookAt,
  sunDirection: [110, 136, 125],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_weathered',
    'stone_limestone',
    'tile_ceramic',
    'metal_copper',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.47,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'garden-portico-and-two-wings', position: [118, 43, 121], lookAt },
    { name: 'garden-columns-and-gold-cupola', position: [31, 12, 69], lookAt: [4, 10.6, 20] },
    { name: 'northern-colonnade-and-roofs', position: [43, 24, -116], lookAt: [1, 8, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.45,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.99, surfaces },
      street: { export: 'street', errorMeters: 0.32, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.11, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original reconstruction from the exact photographer-dedicated public-domain Qualla exterior, mapped palace extent, original terrain and Indonesian institutional history.',
};
