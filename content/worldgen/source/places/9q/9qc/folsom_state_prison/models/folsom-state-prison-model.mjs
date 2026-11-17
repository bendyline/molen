/** The granite entrance and green-roof sentry tower documented at Folsom in 2003. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, profile } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  cutStone: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.24 },
  copper: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.74, metallic: 0.16 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.09 },
};
const color = Object.fromEntries(
  Object.entries({
    granite: '777976',
    shadow: '575952',
    pale: 'a19d8c',
    coping: '93958e',
    green: '487269',
    greenDark: '39554f',
    greenLight: '69847b',
    glass: '374345',
    bars: '515a5a',
    seams: '647a71',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

function arch(out, dims, isMain, lod) {
  const { center, width, spring, rise } = dims;
  const segments = [7, 11, 19, 28][lod];
  const radius = width / 2;
  const rim = isMain ? 0.43 : 0.26;
  const front = 0.8;
  const rear = -2.4;
  const top = plan.dimensions.gatehouseHeight;
  const onArch = (angle, inset, z) => [
    center + (radius + inset) * Math.cos(angle),
    spring + (rise + inset) * Math.sin(angle),
    z,
  ];
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI) / segments,
      b = ((i + 1) * Math.PI) / segments;
    const p = onArch(a, 0, front),
      q = onArch(b, 0, front);
    const pa = onArch(a, rim, front),
      qa = onArch(b, rim, front);
    const cap = ([x, y, z]) => [x, top, z];
    face(out, 'granite', [pa, cap(pa), cap(qa), qa], color.granite);
    face(
      out,
      'granite',
      [onArch(b, 0, rear), cap(onArch(b, 0, rear)), cap(onArch(a, 0, rear)), onArch(a, 0, rear)],
      color.granite,
    );
    face(out, 'cutStone', [q, p, onArch(a, 0, rear), onArch(b, 0, rear)], color.shadow);
    face(out, 'cutStone', [p, pa, qa, q], i % 3 === 1 ? color.coping : color.pale);
    if (lod > 1) {
      beam(
        out,
        'cutStone',
        [qa[0], qa[1], front + 0.025],
        [q[0], q[1], front + 0.025],
        0.025,
        0.026,
        color.shadow,
      );
    }
  }
  // Dressed jambs project from the front, while the passage stays open behind the gate bars.
  for (const side of [-1, 1]) {
    const inner = center + side * radius;
    const outer = center + side * (radius + rim);
    box(
      out,
      'cutStone',
      [Math.min(inner, outer), -0.05, front - 0.21],
      [Math.max(inner, outer), spring, front + 0.035],
      color.pale,
    );
    if (lod > 1)
      for (let y = 0.42; y < spring; y += 0.36)
        box(
          out,
          'cutStone',
          [Math.min(inner, outer), y, front + 0.035],
          [Math.max(inner, outer), y + 0.016, front + 0.052],
          color.shadow,
        );
  }
  const grillDepth = front - 0.28;
  const slots = isMain ? [8, 13, 23, 31][lod] : [4, 6, 9, 10][lod];
  for (let i = 0; i < slots; i++) {
    const u = (2 * (i + 0.5)) / slots - 1,
      x = center + u * radius;
    const y = spring + rise * Math.sqrt(1 - u * u) - 0.12;
    box(
      out,
      'iron',
      [x - 0.023, 0.02, grillDepth - 0.043],
      [x + 0.023, y, grillDepth + 0.043],
      color.bars,
    );
  }
  for (const y of isMain ? [0.27, 1.88, 3.15] : [0.33, 1.69]) {
    const u = Math.max(0, (y - spring) / rise);
    const w = radius * Math.sqrt(1 - u * u) - 0.05;
    box(
      out,
      'iron',
      [center - w, y, grillDepth - 0.051],
      [center + w, y + 0.064, grillDepth + 0.055],
      color.bars,
    );
  }
}

function wall(out, a, b, ground, top, lod) {
  const [x, z] = a;
  const length = Math.hypot(b[0] - x, b[1] - z);
  const direction = -Math.atan2(b[1] - z, b[0] - x);
  const segment = transform(out, direction, [x, 0, z]);
  box(segment, 'granite', [0, ground, -0.82], [length, top, 0.21], color.granite);
  box(segment, 'cutStone', [0, top - 0.04, -0.91], [length, top + 0.14, 0.29], color.coping);
  if (lod > 1)
    for (let y = Math.max(0.05, ground + 0.35), row = 0; y < top - 0.15; y += 0.42, row++) {
      face(
        segment,
        'granite',
        [
          [0, y, 0.225],
          [length, y, 0.225],
          [length, y + 0.027, 0.225],
          [0, y + 0.027, 0.225],
        ],
        color.shadow,
      );
      if (lod === 3)
        for (let x = 0.31 + 0.6 * (row % 2); x < length - 0.05; x += 1.2) {
          face(
            segment,
            'granite',
            [
              [x, y, 0.228],
              [x + 0.025, y, 0.228],
              [x + 0.025, y + 0.42, 0.228],
              [x, y + 0.42, 0.228],
            ],
            color.shadow,
          );
        }
    }
}

function gatehouse(out, lod) {
  const {
    frontX: [left, right],
    gatehouseHeight: top,
    mainArch,
    sideArch,
  } = plan.dimensions;
  const plinths = [
    [left, mainArch.center - mainArch.width / 2 - 0.43],
    [mainArch.center + mainArch.width / 2 + 0.43, sideArch.center - sideArch.width / 2 - 0.26],
    [sideArch.center + sideArch.width / 2 + 0.26, right],
  ];
  for (const [x0, x1] of plinths) {
    box(out, 'granite', [x0, -1.2, -2.4], [x1, top, 0.8], color.granite);
    if (lod > 1)
      for (let y = 0.3; y < top - 0.15; y += 0.41) {
        face(
          out,
          'granite',
          [
            [x0, y, 0.819],
            [x1, y, 0.819],
            [x1, y + 0.027, 0.819],
            [x0, y + 0.027, 0.819],
          ],
          color.shadow,
        );
      }
  }
  box(
    out,
    'cutStone',
    [left - 0.16, top - 0.13, -2.55],
    [right + 0.15, top + 0.09, 0.99],
    color.coping,
  );
  arch(out, mainArch, true, lod);
  arch(out, sideArch, false, lod);
  wall(out, [left - 3.55, 0.55], [left + 0.04, 0.53], -1.46, 4.91, lod);
  wall(out, [left - 3.55, 0.54], [left - 4.48, -17.75], -1.52, 4.92, lod);
  wall(out, [right - 0.04, -0.33], [5.09, -0.45], -1.19, 4.98, lod);
  wall(out, [5.05, -0.43], [53.4, -25.58], -1.77, 4.97, lod);
  if (lod) {
    const mark = (inset, z) => {
      const x = 2.66,
        y = 4.21,
        w = 0.36 - inset;
      const points = [
        [x - w, y + 0.39 - inset, z],
        [x + w, y + 0.39 - inset, z],
        [x + w * 0.69, y - 0.18, z],
        [x, y - 0.47 + inset, z],
        [x - w * 0.69, y - 0.18, z],
      ];
      const slot = inset ? 'iron' : 'cutStone',
        tint = inset ? color.bars : color.pale;
      for (let i = 0; i < points.length; i++)
        triangle(out, slot, [[x, y, z], points[(i + 1) % points.length], points[i]], tint);
    };
    mark(0, 0.85);
    mark(0.065, 0.873);
  }
}

function tower(out, lod) {
  const {
    tower: [x, z],
    roofTop,
  } = plan.dimensions;
  const segments = 8;
  profile(
    out,
    [
      [5.24, 2.09, 2.09],
      [5.38, 2.09, 2.09, 'granite', color.granite],
      [6.66, 2.1, 2.1, 'granite', color.granite],
      [7.49, 2.32, 2.32, 'cutStone', color.pale],
      [7.71, 2.41, 2.41, 'cutStone', color.coping],
      [7.81, 2.41, 2.41, 'iron', color.greenDark],
      [7.99, 2.35, 2.35, 'iron', color.green],
      [9.36, 2.35, 2.35, 'glazing', color.glass],
      [9.53, 2.45, 2.45, 'iron', color.greenDark],
      [9.57, 2.86, 2.86, 'copper', color.greenDark],
      [9.74, 2.86, 2.86, 'copper', color.green],
      [10.18, 2.25, 2.25, 'copper', color.green],
      [roofTop - 0.31, 0.17, 0.17, 'copper', color.green],
      [roofTop, 0.1, 0.1, 'iron', color.greenDark],
    ],
    segments,
    [x, z],
  );
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI * 2) / segments;
    const b = ((i + 1) * Math.PI * 2) / segments;
    const p = (r, y, theta) => [x + Math.cos(theta) * r, y, z + Math.sin(theta) * r];
    beam(out, 'iron', p(2.37, 7.91, a), p(2.37, 9.51, a), 0.135, 0.135, color.greenDark);
    if (lod) {
      const m = p(2.19, 9.36, (a + b) / 2);
      beam(out, 'iron', [m[0], 7.98, m[2]], m, 0.05, 0.05, color.greenLight);
      beam(out, 'iron', p(2.36, 8.48, a), p(2.36, 8.48, b), 0.06, 0.06, color.greenDark);
      for (const u of [0.25, 0.75]) {
        const first = p(2.12, 6.68, a),
          last = p(2.12, 6.68, b);
        const upper0 = p(2.37, 7.51, a),
          upper1 = p(2.37, 7.51, b);
        const mix = (p, q) => p.map((v, k) => v + (q[k] - v) * u);
        beam(out, 'cutStone', mix(first, last), mix(upper0, upper1), 0.21, 0.15, color.pale);
      }
    }
    if (lod > 1) {
      for (const u of [0.23, 0.49, 0.75]) {
        const at = (r, y) => p(r, y, a).map((v, k) => v + (p(r, y, b)[k] - v) * u);
        beam(out, 'copper', at(2.87, 9.75), at(2.26, 10.19), 0.036, 0.032, color.seams);
        beam(out, 'copper', at(2.26, 10.19), at(0.18, roofTop - 0.31), 0.036, 0.032, color.seams);
      }
    }
  }
}

function build(out, lod) {
  gatehouse(out, lod);
  tower(out, lod);
}

export const gateSkyline = (out) => build(out, 0);
export const gateDistrict = (out) => build(out, 1);
export const gateStreet = (out) => build(out, 2);
export const gateCloseup = (out) => build(out, 3);

const recipe = 'folsom-state-prison-model.mjs';
const camera = [10, 17, 55];
const lookAt = [17, 5.6, -6];
export const gateModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: gateCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The early-2000s exterior of Folsom State Prison’s granite entrance, with twin barred arches, a corbelled tower and a steep green roof.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  sunDirection: [-9, 30, 50],
  camera,
  lookAt,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_granite',
    'stone_ashlar',
    'metal_painted',
    'metal_standing_seam',
  ],
  qaCameras: [
    {
      name: 'double-arched-granite-entry',
      position: [1.5, 4.4, 20.5],
      lookAt: [-0.15, 4.3, -0.45],
    },
    { name: 'corbels-and-green-roof', position: [-15, 11, 19], lookAt: [0.75, 9, -2.16] },
    { name: 'walls-and-guard-room', position: [36, 27, -22], lookAt: [2, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'folsom-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'gateSkyline',
    errorMeters: 0.5,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'gateDistrict', 0.23],
        ['street', 'gateStreet', 0.11],
        ['closeup', 'gateCloseup', 0.055],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap references under ODbL. Both exact Qualla photographs were placed in the public domain by their authors.',
};
