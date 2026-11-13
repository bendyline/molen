/** The Khilwat Mubarak Durbar Hall at Chowmahalla Palace in May 2020. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const footprint = read('map-frame').geometry.polygons[0];
const { foundationBottom, plinth, arcadeSpring, arcadeCrown, mainEaves, parapet, mainPavilionTop } =
  plan.section;
const frontZ = footprint[0][1];
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  marble: { slot: 'foundation', graph: 'stone_marble', roughness: 0.86, metallic: 0 },
  detail: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.86, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.57, metallic: 0.03 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.13 },
};
const color = Object.fromEntries(
  Object.entries({
    plaster: 'd5ad73',
    shade: 'c49b6a',
    marble: 'c9c7bb',
    detail: 'eee7d7',
    roof: 'b1a58c',
    dark: '564c3b',
    metal: '987d5d',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const B = (out, slot, x, y, z, width, height, depth, tone = color[slot]) =>
  box(out, slot, x, y, z, width, height, depth, tone);

function face(out, slot, points, orientation, tone = color[slot]) {
  let n = normalFor(...points);
  if (n.reduce((dot, value, i) => dot + value * orientation[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tone);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tone,
    );
}
function slab(out, slot, x0, x1, z0, z1, low, high, tone = color[slot]) {
  B(out, slot, (x0 + x1) / 2, low, (z0 + z1) / 2, x1 - x0, high - low, z1 - z0, tone);
}
function capAndWalls(out, slot, outline, low, high, tone = color[slot]) {
  const temporary = new MeshBufferBuilder();
  poly(temporary, slot, outline, low, high, tone);
  const { positions, normals, indices } = temporary.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    const normal = Array.from(normals.slice(indices[i] * 3, indices[i] * 3 + 3));
    face(out, slot, points, normal, tone);
  }
}

function elevation([x, z], [xEnd, zEnd], nx, nz) {
  const length = Math.hypot(xEnd - x, zEnd - z);
  return {
    length,
    normal: [nx, 0, nz],
    at: (u, y, d = 0) => [
      x + ((xEnd - x) * u) / length + d * nx,
      y,
      z + ((zEnd - z) * u) / length + d * nz,
    ],
  };
}
const front = (z, x0 = -27, x1 = 27) => elevation([x0, z], [x1, z], 0, 1);
function panel(out, slot, side, left, right, bottom, top, depth, tone = color[slot]) {
  face(
    out,
    slot,
    [
      side.at(left, bottom, depth),
      side.at(right, bottom, depth),
      side.at(right, top, depth),
      side.at(left, top, depth),
    ],
    side.normal,
    tone,
  );
}

function archLine(half, spring, peak, segments, lobes) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const theta = (i * Math.PI) / segments;
    const sine = Math.sin(theta);
    const x = -half * Math.cos(theta);
    const curve = sine * 0.85 + (1 - Math.abs(Math.cos(theta))) * 0.15;
    const scallop = 0.22 * sine * Math.abs(Math.sin(lobes * theta));
    return [x, spring + (peak - spring) * curve - scallop];
  });
}
function archRelief(out, side, center, line, thickness, depth) {
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const edge = (p, t) => side.at(center + p[0] * (1 + t), p[1] + t * 3.1, depth);
    face(
      out,
      'detail',
      [edge(a, 0), edge(b, 0), edge(b, thickness), edge(a, thickness)],
      side.normal,
    );
  }
}
function insetArch(out, side, center, half, base, spring, peak, lod) {
  if (lod === 0) {
    panel(out, 'dark', side, center - half, center + half, base, spring + 0.4, 0.052);
    return;
  }
  const line = archLine(half, spring, peak, lod >= 3 ? 14 : 6, 0);
  panel(out, 'dark', side, center - half, center + half, base, spring, 0.052);
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    face(
      out,
      'dark',
      [
        side.at(center, spring, 0.052),
        side.at(center + a[0], a[1], 0.052),
        side.at(center + b[0], b[1], 0.052),
      ],
      side.normal,
    );
  }
  archRelief(out, side, center, line, 0.071, 0.076);
  for (const sign of [-1, 1]) {
    const x = center + sign * (half + 0.048);
    panel(out, 'detail', side, x - 0.054, x + 0.054, base, spring, 0.077);
  }
  panel(out, 'detail', side, center - half - 0.25, center + half + 0.25, base - 0.18, base, 0.108);
  if (lod >= 2) {
    for (const v of [-0.64, -0.32, 0, 0.32, 0.64]) {
      const x = center + half * v;
      panel(out, 'metal', side, x - 0.025, x + 0.025, base, spring, 0.067);
    }
    for (const y of [base + (spring - base) * 0.33, base + (spring - base) * 0.66])
      panel(out, 'metal', side, center - half, center + half, y, y + 0.045, 0.069);
  }
}
function rosette(out, side, center, y, radius, lod) {
  const n = lod >= 3 ? 12 : 6;
  const rim = (i) => {
    const a = (i * Math.PI * 2) / n;
    const r = lod >= 3 && i % 2 ? radius * 0.69 : radius;
    return side.at(center + Math.cos(a) * r, y + Math.sin(a) * r, 0.096);
  };
  for (let i = 0; i < n; i++)
    face(out, 'detail', [side.at(center, y, 0.104), rim(i), rim(i + 1)], side.normal);
}

function arcade(out, lod) {
  const z = frontZ - 0.21,
    start = -17.62,
    end = 17.62,
    centers = [-13.56, -6.78, 0, 6.78, 13.56];
  const half = 2.7,
    frontFace = front(z, start, end);
  let left = start;
  for (const x of centers) {
    slab(out, 'plaster', left, x - half, z - 1.06, z, plinth, mainEaves);
    const line = archLine(half, arcadeSpring, arcadeCrown, [6, 10, 24, 24][lod], 5);
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]].map(([dx, y]) => [dx + x, y]);
      for (const [sideZ, sign] of [
        [z, 1],
        [z - 1.06, -1],
      ]) {
        if (sign === -1 && lod === 0) continue;
        face(
          out,
          'plaster',
          [
            [a[0], a[1], sideZ],
            [b[0], b[1], sideZ],
            [b[0], mainEaves, sideZ],
            [a[0], mainEaves, sideZ],
          ],
          [0, 0, sign],
        );
      }
      face(
        out,
        'detail',
        [
          [a[0], a[1], z],
          [a[0], a[1], z - 1.06],
          [b[0], b[1], z - 1.06],
          [b[0], b[1], z],
        ],
        [0, -1, 0],
      );
    }
    archRelief(out, frontFace, x - start, line, 0.083, 0.085);
    for (const sign of [-1, 1]) {
      const offset = x - start + sign * (half + 0.085);
      panel(out, 'detail', frontFace, offset - 0.092, offset + 0.092, plinth, arcadeSpring, 0.094);
    }
    if (lod >= 1) {
      rosette(out, frontFace, x - start, 12.01, 0.31, lod);
      for (const v of [-0.4, 0.4])
        B(out, 'detail', x + v * (2 * half), arcadeSpring - 0.13, z + 0.045, 0.39, 0.17, 0.2);
    }
    left = x + half;
  }
  slab(out, 'plaster', left, end, z - 1.06, z, plinth, mainEaves);
  const inside = front(16.4, -18, 18);
  for (const x of centers) insetArch(out, inside, x + 18, 1.57, plinth + 0.11, 6.9, 8.95, lod);
  if (lod)
    for (const x of [-16.77, -10.18, -3.39, 3.39, 10.18, 16.77]) {
      B(out, 'detail', x, plinth, frontZ - 0.04, 0.43, arcadeSpring - plinth - 0.08, 0.48);
      B(out, 'detail', x, plinth, frontZ - 0.02, 0.74, 0.23, 0.74);
      B(out, 'detail', x, arcadeSpring - 0.27, frontZ - 0.01, 0.65, 0.31, 0.61);
    }
}

function shell(out, lod) {
  capAndWalls(out, 'marble', footprint, foundationBottom, plinth);
  slab(out, 'plaster', -25.45, 25.45, -22.95, 16.4, plinth, mainEaves);
  for (const [x0, x1] of [
    [-26.45, -17.61],
    [17.61, 26.45],
  ])
    slab(out, 'plaster', x0, x1, 16.35, frontZ - 0.16, plinth, mainEaves);
  slab(out, 'roof', -26.25, 26.25, -23.2, frontZ - 0.29, mainEaves - 0.085, mainEaves + 0.21);
  slab(out, 'plaster', -19.6, 19.6, -16.75, 12.45, mainEaves, mainEaves + 1.47, color.shade);
  slab(out, 'roof', -19.92, 19.92, -17.03, 12.78, mainEaves + 1.45, mainEaves + 1.68);
  const number = lod === 0 ? 2 : 10,
    maxProjection = 3.72,
    height = (plinth - 0.09) / number;
  for (let step = 0; step < number; step++) {
    const z = frontZ + maxProjection - (step * 3.24) / (number - 1);
    slab(out, 'marble', -15.84, 15.84, frontZ - 0.08, z, -0.54, 0.09 + (step + 1) * height);
  }

  const sides = [
    {
      face: elevation([25.45, -22.95], [25.45, 16.37], 1, 0),
      bays: [4.4, 12.01, 19.67, 27.33, 35.0],
      main: true,
    },
    {
      face: elevation([-25.45, -22.95], [-25.45, 16.37], -1, 0),
      bays: [4.4, 12.01, 19.67, 27.33, 35.0],
      main: true,
    },
    {
      face: elevation([-25.45, -22.95], [25.45, -22.95], 0, -1),
      bays: [4.7, 13, 21.3, 29.6, 37.9, 46.2],
      main: false,
    },
  ];
  for (const { face: side, bays, main } of sides) {
    for (const bay of bays) {
      insetArch(out, side, bay, main ? 2.02 : 1.63, main ? 6.76 : 6.96, 9.5, 11.62, lod);
      if (lod)
        panel(out, 'detail', side, bay - 0.76, bay + 0.76, plinth + 1.45, plinth + 3.19, 0.06);
      panel(out, 'dark', side, bay - 0.62, bay + 0.62, plinth + 1.58, plinth + 3.06, 0.082);
      if (lod >= 1)
        for (const x of [bay - 1.18, bay, bay + 1.18]) rosette(out, side, x, 12.39, 0.27, lod);
      if (lod >= 2) {
        const x = bay + (main ? 3.68 : 2.95);
        if (x < side.length - 1) {
          panel(out, 'detail', side, x - 0.082, x + 0.082, plinth + 0.2, 13.55, 0.087);
          panel(out, 'detail', side, x - 0.28, x + 0.28, plinth + 0.2, plinth + 0.39, 0.092);
        }
      }
    }
  }
}
function cornices(out, lod) {
  for (const [x0, x1, z0, z1, y, h, tone] of [
    [-26.6, 26.6, -23.32, frontZ + 0.04, 13.52, 0.31, color.detail],
    [-27.0, 27.0, -23.66, frontZ + 0.36, 14.02, 0.43, color.detail],
    [-26.33, 26.33, -23.14, frontZ - 0.12, 14.44, 0.35, color.plaster],
  ])
    slab(out, 'detail', x0, x1, z0, z1, y, y + h, tone);
  for (const z of [-23.04, frontZ - 0.02]) B(out, 'detail', 0, 14.77, z, 52.7, 1.08, 0.55);
  for (const x of [-26.29, 26.29]) B(out, 'detail', x, 14.77, 0, 0.54, 1.08, 45.61);
  for (const z of [-23.05, frontZ - 0.015])
    B(out, 'detail', 0, parapet - 0.12, z, 53.12, 0.19, 0.68);
  if (lod >= 1) {
    const fascia = front(frontZ + 0.31);
    for (let i = 1; i < 34; i += lod === 1 ? 2 : 1) {
      const x = -26.4 + 1.56 * i;
      B(out, 'detail', x, 13.72, frontZ + 0.045, 0.25, 0.29, 0.42);
      if (lod >= 2) rosette(out, fascia, x + 27, 15.33, 0.265, lod);
    }
    for (const x of [-26.3, 26.3])
      for (let i = 0; i < 23; i += lod === 1 ? 3 : 1)
        B(out, 'detail', x, 13.75, -21.0 + i * 1.95, 0.43, 0.27, 0.23);
  }
}

function radialProfile(out, x, z, profile, count, slot, tone = color[slot]) {
  const p = (i, y, r) => {
    const a = Math.PI / 8 + (i * Math.PI * 2) / count;
    return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  };
  for (let j = 1; j < profile.length; j++) {
    const [[low, r0], [high, r1]] = [profile[j - 1], profile[j]];
    for (let i = 0; i < count; i++) {
      const a = p(i, low, r0),
        b = p(i + 1, low, r0),
        c = p(i + 1, high, r1);
      const vertices = r1 === 0 ? [a, b, c] : [a, b, c, p(i, high, r1)];
      face(out, slot, vertices, [(a[0] + b[0]) / 2 - x, 0, (a[2] + b[2]) / 2 - z], tone);
    }
  }
}
function pavilion(out, x, z, base, scale, lod) {
  const y = (v) => base + scale * v;
  const b = (slot, width, depth, low, high, tone = color[slot]) =>
    B(out, slot, x, y(low), z, width * scale, (high - low) * scale, depth * scale, tone);
  if (lod === 0) {
    b('plaster', 6.56, 6.45, 0, 2.45);
    b('detail', 6.91, 6.87, 2.43, 3.39);
    b('detail', 5.57, 5.57, 6.04, 6.55);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      const dx = x + Math.cos(a) * 2.09 * scale;
      const dz = z + Math.sin(a) * 2.09 * scale;
      const r = 0.19 * scale;
      face(
        out,
        'detail',
        [
          [dx - r, y(3.38), dz],
          [dx + r, y(3.38), dz],
          [dx + r, y(6.04), dz],
          [dx - r, y(6.04), dz],
        ],
        [0, 0, 1],
      );
      face(
        out,
        'detail',
        [
          [dx, y(3.38), dz - r],
          [dx, y(3.38), dz + r],
          [dx, y(6.04), dz + r],
          [dx, y(6.04), dz - r],
        ],
        [1, 0, 0],
      );
    }
    radialProfile(
      out,
      x,
      z,
      [
        [y(6.54), 2.4 * scale],
        [y(7.32), 1.71 * scale],
        [y(7.86), 0.37 * scale],
        [y(8.97), 0],
      ],
      6,
      'detail',
    );
    return;
  }
  b('plaster', 6.56, 6.45, 0, 2.45);
  b('detail', 6.85, 6.73, 2.32, 2.58);
  b('detail', 7.2, 7.1, 2.75, 3.07);
  b('detail', 5.1, 5.1, 3.05, 3.39);
  const profileTop = y(6.56);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    const radius = 2.09 * scale;
    B(
      out,
      'detail',
      x + Math.cos(a) * radius,
      y(3.38),
      z + Math.sin(a) * radius,
      0.38 * scale,
      2.69 * scale,
      0.38 * scale,
    );
    if (lod >= 2) {
      B(
        out,
        'detail',
        x + Math.cos(a) * radius,
        y(3.38),
        z + Math.sin(a) * radius,
        0.61 * scale,
        0.18 * scale,
        0.61 * scale,
      );
      B(
        out,
        'detail',
        x + Math.cos(a) * radius,
        y(5.84),
        z + Math.sin(a) * radius,
        0.62 * scale,
        0.23 * scale,
        0.62 * scale,
      );
    }
  }
  b('detail', 5.13, 5.13, 6.04, 6.33);
  b('detail', 5.57, 5.57, 6.31, 6.55);
  const peak = base + 8.97 * scale;
  radialProfile(
    out,
    x,
    z,
    [
      [profileTop, 2.4 * scale],
      [y(7.02), 2.3 * scale],
      [y(7.46), 1.77 * scale],
      [y(7.79), 1.05 * scale],
      [y(7.91), 0.37 * scale],
    ],
    lod >= 2 ? 12 : 8,
    'detail',
  );
  radialProfile(
    out,
    x,
    z,
    [
      [y(7.89), 0.35 * scale],
      [y(8.15), 0.25 * scale],
      [y(8.37), 0.33 * scale],
      [y(8.61), 0.18 * scale],
      [peak, 0],
    ],
    8,
    'metal',
    color.dark,
  );
}
function roofline(out, lod) {
  for (const x of [-20.58, 20.58]) {
    B(out, 'plaster', x, plinth, 19.49, 6.3, mainEaves - plinth + 0.33, 7.98);
    const facade = front(23.51, x - 3.15, x + 3.15);
    if (lod) {
      insetArch(out, facade, 3.15, 1.58, 5.3, 9.65, 11.36, lod);
      for (const edge of [0.32, 5.99])
        panel(out, 'detail', facade, edge - 0.096, edge + 0.096, plinth + 0.17, 13.9, 0.075);
    }
    pavilion(out, x, 19.48, mainPavilionTop - 8.97, 1, lod);
    pavilion(out, x, -17.23, mainEaves + 0.37, 0.72, lod);
  }
  if (lod)
    for (const x of [-15.2, -7.6, 0, 7.6, 15.2])
      radialProfile(
        out,
        x,
        frontZ - 0.015,
        [
          [parapet + 0.05, 0.38],
          [parapet + 0.27, 0.43],
          [parapet + 0.57, 0.31],
          [parapet + 0.87, 0],
        ],
        lod >= 2 ? 8 : 4,
        'detail',
      );
}
function build(out, _frame, lod = 3) {
  shell(out, lod);
  arcade(out, lod);
  cornices(out, lod);
  roofline(out, lod);
}
export const khilwatSkyline = (out) => build(out, undefined, 0);
export const khilwatDistrict = (out) => build(out, undefined, 1);
export const khilwatStreet = (out) => build(out, undefined, 2);
export const khilwatCloseup = (out) => build(out, undefined, 3);

const recipe = 'khilwat-model.mjs',
  camera = [-66, 40, 91],
  lookAt = [0, 10, 0];
export const khilwatModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The ochre Durbar Hall with five cusped court arches, pale marble stairs, layered cornices and open rooftop pavilions.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: footprint,
    minimumCoverage: 0.96,
    basis:
      'The mapped hall envelope fixes the dated building independently of the wider palace site.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_marble',
    'stone_limestone_raw',
    'concrete_plain',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'north-arcade-and-marble-stairs', position: [-22, 12, 71], lookAt: [0, 9.1, 19] },
    { name: 'open-rooftop-pavilions', position: [-41, 26, 55], lookAt: [0, 18, 13] },
    { name: 'side-screened-arches-and-cornice', position: [61, 15, -19], lookAt: [20, 10, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-khilwat-mubarak-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'khilwatSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'khilwatDistrict', 0.14],
        ['street', 'khilwatStreet', 0.058],
        ['closeup', 'khilwatCloseup', 0.021],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Kavali Chandrakanth KCK dedicated the exact May 2020 references under CC0. OpenStreetMap contributors supply the mapped envelope under ODbL.',
};
