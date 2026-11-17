/** Geographic exterior of the beylical palace and the connected Bardo Museum extension. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const ring = frame.geometry.outline;
const d = plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.84, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.35, metallic: 0 },
  green: { slot: 'roof', graph: 'tile_glazed', roughness: 0.89, metallic: 0 },
};
const c = {
  plaster: rgb('e5e1ce'),
  extension: rgb('d9cdb5'),
  paving: rgb('a79e8c'),
  roof: rgb('b9b3a2'),
  trim: rgb('cabaa0'),
  blue: rgb('367c9b'),
  glass: rgb('40555e'),
  glazing: rgb('72858a'),
  green: rgb('3b625c'),
  shadow: rgb('443f38'),
};
const northSeam = [-42.0273, -31.5];
const southSeam = ring[6];
const oldOutline = [
  northSeam,
  ...ring.slice(0, 2).reverse(),
  ...ring.slice(16).reverse(),
  ...ring.slice(7, 14).reverse(),
  southSeam,
];
const addition = [northSeam, ring[2], ring[3], ring[4], ring[5], southSeam];
const oldUpper = [
  [-37.7, -27.8],
  [16.51, -29.53],
  [18.93, -1.06],
  [20.96, 25.7],
  [21.98, 42.5],
  [-35.4, 44.98],
];

function facade(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  return {
    length,
    at(u, y, o) {
      return [a[0] + (dx * u + dz * o) / length, y, a[1] + (dz * u - dx * o) / length];
    },
  };
}

function face(out, slot, corners, color) {
  quad(out, slot, corners, normalFor(...corners), color);
}

// Triangulate mapped rings with the base builder before applying runtime surface mapping.
function mass(out, slot, outline, lower, upper, color) {
  const base = new MeshBufferBuilder();
  poly(base, slot, outline, lower, upper, color);
  const mesh = base.finalize();
  for (let triangle = 0; triangle < mesh.indices.length; triangle += 3) {
    const vertices = Array.from(mesh.indices.slice(triangle, triangle + 3), (index) =>
      Array.from(mesh.positions.slice(index * 3, index * 3 + 3)),
    );
    out.addTriangle(
      slot,
      'palette:#ffffff',
      vertices,
      normalFor(...vertices),
      vertices.map(([x, , z]) => [x, z]),
      color,
    );
  }
}

function place(out, slot, f, u0, u1, y0, y1, o0, o1, color) {
  const { at } = f;
  const p = [at(u0, y0, o0), at(u1, y0, o0), at(u1, y0, o1), at(u0, y0, o1)];
  const q = [at(u0, y1, o0), at(u1, y1, o0), at(u1, y1, o1), at(u0, y1, o1)];
  face(out, slot, [...p].reverse(), color);
  face(out, slot, q, color);
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    face(out, slot, [p[i], p[next], q[next], q[i]], color);
  }
}

function sillAndWindow(out, f, center, lower, width, height, level, projecting) {
  const left = center - width / 2,
    right = center + width / 2;
  const deep = projecting ? 0.72 : 0.12;
  place(out, 'timber', f, left, right, lower, lower + height, -0.03, deep, c.blue);
  place(
    out,
    'glass',
    f,
    left + 0.11,
    right - 0.11,
    lower + 0.14,
    lower + height - 0.13,
    deep,
    deep + 0.019,
    c.glass,
  );
  if (projecting) {
    place(
      out,
      'timber',
      f,
      left - 0.15,
      right + 0.15,
      lower - 0.2,
      lower - 0.02,
      0,
      deep + 0.13,
      c.blue,
    );
    place(
      out,
      'timber',
      f,
      left - 0.13,
      right + 0.13,
      lower + height - 0.01,
      lower + height + 0.16,
      0,
      deep + 0.15,
      c.blue,
    );
  }
  if (level < 2) return;
  for (const i of [1, 2, 3]) {
    const u = left + (width * i) / 4;
    place(
      out,
      'timber',
      f,
      u - 0.035,
      u + 0.035,
      lower + 0.1,
      lower + height - 0.09,
      deep + 0.018,
      deep + 0.061,
      c.blue,
    );
  }
  place(
    out,
    'timber',
    f,
    left + 0.09,
    right - 0.09,
    lower + height * 0.65,
    lower + height * 0.65 + 0.07,
    deep + 0.018,
    deep + 0.065,
    c.blue,
  );
  if (projecting && level === 3)
    for (const sign of [-1, 1]) {
      const u = center + sign * width * 0.38;
      place(out, 'timber', f, u - 0.08, u + 0.08, lower - 0.66, lower - 0.2, 0.1, 0.39, c.blue);
    }
}

function roofedPalace(out, level) {
  mass(out, 'wall', oldOutline, d.foundationY, d.lowerWingY, c.plaster);
  mass(out, 'wall', oldUpper, d.lowerWingY, d.oldParapetY, c.plaster);
  mass(out, 'roof', oldUpper, d.oldParapetY - 0.04, d.oldParapetY + 0.06, c.roof);
  for (let i = 0; i < oldUpper.length; i++) {
    const f = facade(oldUpper[i], oldUpper[(i + 1) % oldUpper.length]);
    place(out, 'trim', f, 0, f.length, d.oldParapetY - 0.45, d.oldParapetY - 0.23, 0, 0.12, c.trim);
    if (level === 0 || f.length < 11 || i === oldUpper.length - 1) continue;
    const count = Math.floor(f.length / [0, 6.9, 5.8, 5.35][level]);
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) / count) * f.length;
      sillAndWindow(out, f, u, 12.2, 1.24, 1.61, level, i === 1 || i === 2);
    }
  }
  if (level > 0) {
    for (const [i, count] of [
      [16, 6],
      [10, 3],
      [8, 5],
      [17, 3],
    ]) {
      const f = facade(ring[(i + 1) % ring.length], ring[i]);
      for (let j = 0; j < count; j++) {
        const u = (f.length * (j + 0.5)) / count;
        sillAndWindow(out, f, u, 7.14, 1.63, 2.13, level, i === 16);
      }
    }
  }
  if (level > 0) {
    const garden = facade(ring[16], ring[13]);
    for (const fraction of [0.22, 0.42, 0.61, 0.79])
      sillAndWindow(out, garden, garden.length * fraction, 7.14, 1.63, 2.13, level, true);
  }
  box(out, 'wall', [-21.5, 14.98, -13], [-6.2, 16.15, 6], c.plaster);
  box(out, 'roof', [-21.65, 16.15, -13.15], [-6.05, 16.35, 6.15], c.roof);
}

function arcade(out, level) {
  const f = facade(ring[15], ring[14]);
  const bayCount = 6,
    width = f.length / bayCount;
  const top = d.arcadeRoofY,
    floor = 0.22,
    spring = 2.31,
    rise = 1.45;
  place(out, 'trim', f, -0.1, f.length + 0.1, -0.22, floor, -d.arcadeDepth, 0.31, c.paving);
  place(out, 'wall', f, -0.12, f.length + 0.12, top - 0.57, top, -d.arcadeDepth, 0.21, c.plaster);
  place(
    out,
    'green',
    f,
    -0.25,
    f.length + 0.25,
    top,
    top + 0.19,
    -d.arcadeDepth - 0.07,
    0.3,
    c.green,
  );
  const columns = level === 0 ? 1 : bayCount;
  for (let i = 0; i <= columns; i++) {
    const u = (f.length * i) / columns;
    const half = level === 0 ? 0.23 : 0.17;
    place(out, 'trim', f, u - half, u + half, floor, spring + 0.05, -half, half, c.trim);
    if (level > 1)
      place(out, 'trim', f, u - 0.25, u + 0.25, spring - 0.14, spring + 0.1, -0.26, 0.25, c.trim);
  }
  if (level === 0) return;
  for (let i = 0; i < bayCount; i++) {
    const center = (i + 0.5) * width;
    const segments = [0, 6, 9, 12][level];
    const radius = width * 0.5;
    const at = (theta, offset) =>
      f.at(center - radius * Math.cos(theta), spring + rise * Math.sin(theta), offset);
    for (let j = 0; j < segments; j++) {
      const a = (j * Math.PI) / segments,
        b = ((j + 1) * Math.PI) / segments;
      const p = at(a, 0.14),
        q = at(b, 0.14);
      const pa = at(a, -0.17),
        qa = at(b, -0.17);
      face(out, 'wall', [q, p, [p[0], top - 0.49, p[2]], [q[0], top - 0.49, q[2]]], c.plaster);
      face(out, 'wall', [p, q, qa, pa], c.plaster);
    }
  }
}

function extension(out, level) {
  mass(out, 'wall', addition, d.foundationY, d.modernParapetY, c.extension);
  mass(out, 'roof', addition, d.modernParapetY - 0.09, d.modernParapetY + 0.035, c.roof);
  const f = facade(ring[4], ring[3]);
  const u = f.length * 0.55,
    width = 12.5,
    top = 10.17;
  place(
    out,
    'wall',
    f,
    u - width / 2 - 1.1,
    u + width / 2 + 1.1,
    -0.3,
    top + 1.3,
    0.01,
    0.51,
    c.extension,
  );
  place(out, 'roof', f, u - width / 2, u + width / 2, 0.07, top, 0.515, 0.573, c.shadow);
  place(
    out,
    'glass',
    f,
    u - width / 2 + 0.5,
    u + width / 2 - 0.5,
    0.43,
    top - 0.49,
    0.575,
    0.62,
    c.glass,
  );
  place(
    out,
    'trim',
    f,
    u - width / 2 - 0.9,
    u + width / 2 + 0.9,
    top,
    top + 0.28,
    0.5,
    1.02,
    c.trim,
  );
  if (level > 0) {
    const lines = level > 1 ? 6 : 3;
    for (let i = 1; i < lines; i++) {
      const x = u - width / 2 + (width * i) / lines;
      place(out, 'timber', f, x - 0.048, x + 0.05, 0.38, top - 0.51, 0.62, 0.69, c.shadow);
    }
    for (const x of [-61.5, -49.1])
      for (const z of [-22, -3, 17]) {
        box(
          out,
          'trim',
          [x - 3.3, d.modernParapetY, z - 5],
          [x + 3.3, d.modernParapetY + 0.39, z + 5],
          c.trim,
        );
        box(
          out,
          'glass',
          [x - 3.1, d.modernParapetY + 0.38, z - 4.83],
          [x + 3.1, d.modernParapetY + 0.43, z + 4.83],
          c.glazing,
        );
      }
  }
  if (level < 2) return;
  for (const z of [-24, -12, 0, 12, 24, 36]) {
    const lo = z + 36;
    place(out, 'trim', f, lo, lo + 0.36, 12.62, 15.29, 0.02, 0.102, c.trim);
  }
}

function draw(out, level) {
  roofedPalace(out, level);
  arcade(out, level);
  extension(out, level);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [118, 51, 97];
const lookAt = [-22, 6.7, 7];
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
    'Bardo National Museum in Tunis with the white historic palace and blue projecting bays, open garden arcade and attached contemporary wing.',
  camera,
  lookAt,
  sunDirection: [42, 103, 55],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: [
    'stucco',
    'stone_limestone',
    'concrete_plain',
    'wood_painted_lap',
    'tile_glazed',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.73,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'palace-and-attached-museum-wing', position: [81, 38, 84], lookAt },
    { name: 'garden-arcade-and-blue-bays', position: [53, 6, 50], lookAt: [16, 6.2, 13] },
    { name: 'west-museum-entry', position: [-118, 14, 30], lookAt: [-63, 7, 5] },
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
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.91, surfaces },
      street: { export: 'street', errorMeters: 0.32, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.12, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original reconstruction using a verified public-domain garden photograph, the named mapped museum perimeter, original terrain and institutional written descriptions.',
};
