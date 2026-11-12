/** The 2008 Adams Building exterior from the original Lace Market footprint. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.93, metallic: 0 },
  ashlar: { slot: 'trim', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.86, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.13 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.35, metallic: 0.04 },
};
const colors = {
  brick: rgb('af6657'),
  ashlar: rgb('ddc1a5'),
  slate: rgb('5f6570'),
  base: rgb('b8a086'),
  iron: rgb('42433e'),
  glass: rgb('46535a'),
};
const { nativeRing, courtyard, foundationBottom, basementTop, eave, centralStair, roofSections } =
  plan;
const vec = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const block = (o, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(o, k, [x0, y0, z0], [x1, y1, z1], color);
function face(o, k, points, expected, color = colors[k]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(o, k, points, n, color);
  else o.addConvexPolygon(k, 'palette:#ffffff', points, n, ([x, y]) => [x, y], color);
}
function winding(ring) {
  return Math.sign(
    ring.reduce((sum, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return sum + x * b - z * a;
    }, 0),
  );
}
function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [(sign * (b[1] - a[1])) / length, 0, (sign * (a[0] - b[0])) / length];
  const at = (u, y, offset = 0) => {
    const [x, z] = mix(a, b, u / length);
    return [x + offset * normal[0], y, z + offset * normal[2]];
  };
  return { length, normal, at };
}
function walls(o, k, ring, low, high, inside = false) {
  const sign = winding(ring) * (inside ? -1 : 1);
  for (let i = 0; i < ring.length; i++) {
    const side = edge(ring[i], ring[(i + 1) % ring.length], sign);
    stripe(o, k, side, 0, low, side.length, high, 0);
  }
}
function cap(o, ring, holes, y, up, k) {
  const outline = winding(ring) > 0 ? ring : [...ring].reverse();
  const inner = holes.map((loop) => (winding(loop) < 0 ? loop : [...loop].reverse()));
  const raw = new MeshBufferBuilder();
  if (
    !raw.addCap(
      k,
      'palette:#ffffff',
      outline,
      inner,
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  ) {
    throw Error('Cannot triangulate the Adams Building roof and court');
  }
  const mesh = raw.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const triangle = Array.from(mesh.indices.slice(i, i + 3), (index) =>
      Array.from(mesh.positions.slice(index * 3, index * 3 + 3)),
    );
    face(o, k, triangle, [0, up, 0]);
  }
}
function stripe(o, k, side, u0, y0, u1, y1, offset = 0.07) {
  const { at, normal } = side;
  face(
    o,
    k,
    [at(u0, y0, offset), at(u1, y0, offset), at(u1, y1, offset), at(u0, y1, offset)],
    normal,
  );
}
function arched(o, k, side, u, y, width, height, offset, steps) {
  const r = width / 2,
    shoulder = y + height - r;
  const arc = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i * Math.PI) / steps;
    return side.at(u + Math.cos(t) * r, shoulder + Math.sin(t) * r, offset);
  });
  face(o, k, [side.at(u - r, y, offset), side.at(u + r, y, offset), ...arc], side.normal);
}
function window(o, side, u, y, w, h, lod, split = false) {
  if (lod < 2) {
    if (lod)
      stripe(o, 'ashlar', side, u - w / 2 - 0.09, y - 0.09, u + w / 2 + 0.09, y + h + 0.12, 0.065);
    stripe(o, 'glass', side, u - w / 2, y, u + w / 2, y + h, 0.08);
    return;
  }
  const steps = lod > 2 ? 8 : 6;
  arched(o, 'ashlar', side, u, y - 0.12, w + 0.22, h + 0.28, 0.105, steps);
  arched(o, 'glass', side, u, y, w, h, 0.119, steps);
  stripe(o, 'ashlar', side, u - w / 2 - 0.17, y - 0.15, u + w / 2 + 0.17, y - 0.06, 0.139);
  if (split || lod > 1) {
    stripe(o, 'ashlar', side, u - 0.045, y, u + 0.045, y + h - 0.06, 0.13);
    stripe(o, 'ashlar', side, u - w / 2, y + h * 0.46, u + w / 2, y + h * 0.46 + 0.065, 0.13);
  }
}
function exterior(o, ring, lod, inside = false) {
  const sign = winding(ring) * (inside ? -1 : 1);
  for (let i = 0; i < ring.length; i++) {
    const side = edge(ring[i], ring[(i + 1) % ring.length], sign);
    const span = side.length;
    const front = !inside && i <= 19;
    if (front) {
      stripe(o, 'ashlar', side, 0, basementTop, span, 5.95, 0.045);
      if (lod)
        for (const y of [2.08, 5.93, 9.55, 13.45, 17.35]) {
          stripe(o, 'ashlar', side, 0, y, span, y + 0.21, 0.145);
        }
    } else if (lod && span > 4.4) {
      for (const y of [5.98, 9.61, 13.28, 17.47]) {
        stripe(o, 'base', side, 0, y, span, y + 0.11, 0.075);
      }
    }
    if (span < (lod ? 1.7 : front ? 4.05 : 7.8)) continue;
    const gap = front ? 2.18 : 3.04;
    const count = Math.max(1, Math.round(span / (gap * [2.25, 1.21, 1, 1][lod])));
    const stories = front ? [3.05, 6.55, 10.1, 14.02] : [3.65, 6.64, 10.08, 13.66];
    const levels = lod ? stories : stories.filter((_, j) => j > 0);
    for (let bay = 0; bay < count; bay++) {
      const u = (span * (bay + 0.5)) / count;
      const w = Math.min(front ? 1.13 : 1.19, (span / count) * 0.61);
      for (const y of levels) window(o, side, u, y, w, front ? 2.48 : 2.52, lod, front);
      if (front && lod > 1 && span / count > 2.1) {
        stripe(o, 'brick', side, u - w / 2 - 0.1, 7.05, u - w / 2 - 0.04, 8.61, 0.145);
      }
    }
    if (lod > 1 && front && span > 3) {
      for (const u of [0.19, span - 0.19])
        for (let j = 0; j < 15; j++) {
          const y = 6.15 + j * 0.72;
          stripe(o, 'ashlar', side, u - 0.16, y, u + 0.16, y + 0.28, 0.165);
        }
    }
  }
}
function hip(o, { ring, eave: roofEave, rise }) {
  const [a, b, c, d] = ring;
  if (roofEave > eave) walls(o, 'brick', ring, eave, roofEave);
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    w = Math.hypot(d[0] - a[0], d[1] - a[1]);
  const start = l >= w ? mix(a, d, 0.5) : mix(a, b, 0.5);
  const end = l >= w ? mix(b, c, 0.5) : mix(d, c, 0.5);
  const r0 = vec(mix(start, end, 0.24), roofEave + rise);
  const r1 = vec(mix(start, end, 0.76), roofEave + rise);
  const [aa, bb, cc, dd] = ring.map((p) => vec(p, roofEave));
  const slopes =
    l >= w
      ? [
          [aa, bb, r1, r0],
          [bb, cc, r1],
          [cc, dd, r0, r1],
          [dd, aa, r0],
        ]
      : [
          [aa, bb, r0],
          [bb, cc, r1, r0],
          [cc, dd, r1],
          [dd, aa, r0, r1],
        ];
  for (const slope of slopes) face(o, 'slate', slope, [0, 1, 0]);
}
function stairAndRail(o, lod) {
  const { x, wallZ, low, landing, width } = centralStair;
  const count = lod > 1 ? 12 : lod ? 7 : 4;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count;
    const front = wallZ - 4.35 + (4.05 * i) / count;
    block(
      o,
      'ashlar',
      x - width / 2,
      foundationBottom,
      front,
      x + width / 2,
      low + (landing - low) * t,
      wallZ + 0.45,
    );
  }
  for (const sign of [-1, 1]) {
    const xx = x + sign * (width / 2 + 0.22),
      front = wallZ - 4.28,
      back = wallZ + 0.05;
    const a = [xx - 0.18, 0.81, front],
      b = [xx - 0.18, 2.93, back],
      c = [xx + 0.18, 2.93, back],
      d = [xx + 0.18, 0.81, front];
    face(o, 'ashlar', [a, b, c, d], [0, 1, 0]);
    face(o, 'ashlar', [a, b, [xx - 0.18, landing, back], [xx - 0.18, low, front]], [-1, 0, 0]);
    face(o, 'ashlar', [d, c, [xx + 0.18, landing, back], [xx + 0.18, low, front]], [1, 0, 0]);
    if (lod) {
      block(o, 'base', xx - 0.32, -0.2, front - 0.32, xx + 0.32, 1.04, front + 0.22);
      for (let i = 1; i < (lod > 1 ? 12 : 5); i++) {
        const t = i / (lod > 1 ? 12 : 5),
          z = front + (back - front) * t,
          y = 0.14 + 2.07 * t;
        block(o, 'ashlar', xx - 0.1, y, z - 0.08, xx + 0.1, y + 0.69, z + 0.08);
      }
    }
  }
  const gate = edge([-17.2, -25.65], [8.65, -25.65]);
  const centers = [
    [-16.9, -7.1],
    [-1.7, 8.4],
  ];
  for (const [left, right] of centers) {
    const shift = 17.2;
    stripe(o, 'base', gate, left + shift, -0.4, right + shift, 0.34, 0.005);
    stripe(o, 'iron', gate, left + shift, 1.18, right + shift, 1.24, 0.01);
    if (lod) {
      const count = Math.floor((right - left) / (lod > 1 ? 0.22 : 0.41));
      for (let i = 0; i <= count; i++) {
        const u = left + ((right - left) * i) / count + shift;
        stripe(o, 'iron', gate, u - 0.03, 0.25, u + 0.03, 1.3, 0.013);
      }
    }
  }
}
function centerpiece(o, lod) {
  const { x, wallZ, landing } = centralStair;
  const front = edge([x - 4.45, wallZ - 0.04], [x + 4.45, wallZ - 0.04]);
  arched(o, 'ashlar', front, 4.45, landing, 2.86, 3.55, 0.055, 8);
  arched(o, 'glass', front, 4.45, landing + 0.04, 2.15, 3.03, 0.085, 8);
  if (lod) {
    stripe(o, 'ashlar', front, 4.395, landing + 0.07, 4.505, landing + 2.52, 0.095);
    stripe(o, 'ashlar', front, 3.44, landing + 2.29, 5.46, landing + 2.38, 0.095);
  }
  const levels = [
    [17.8, 4.4],
    [19.45, 4.2],
    [20.0, 3.65],
    [21.35, 2.55],
    [22.08, 1.69],
    [23.7, 0.32],
  ];
  const z = -19.0,
    depth = 5.25;
  for (let i = 1; i < levels.length; i++) {
    const [[y0, w0], [y1, w1]] = levels.slice(i - 1, i + 1);
    const a = [x - w0, y0, z],
      b = [x + w0, y0, z],
      c = [x + w1, y1, z],
      d = [x - w1, y1, z];
    face(o, 'brick', [a, b, c, d], [0, 0, -1]);
    face(o, 'brick', [a, d, [x - w1, y1, z + depth], [x - w0, y0, z + depth]], [-1, 0, 0]);
    face(o, 'brick', [b, c, [x + w1, y1, z + depth], [x + w0, y0, z + depth]], [1, 0, 0]);
    face(
      o,
      'brick',
      [
        [x - w0, y0, z + depth],
        [x + w0, y0, z + depth],
        [x + w1, y1, z + depth],
        [x - w1, y1, z + depth],
      ],
      [0, 0, 1],
    );
  }
  if (lod) block(o, 'ashlar', x - 4.52, 17.73, z - 0.22, x + 4.52, 18.06, z + depth + 0.12);
  block(o, 'ashlar', x - 0.34, 23.69, z - 0.16, x + 0.34, 23.88, z + depth + 0.13);
  const gable = edge([x - 3.2, z], [x + 3.2, z]);
  for (const u of [2.28, 3.2, 4.12]) window(o, gable, u, 18.33, 0.69, 1.42, lod, true);
  const disc = (r, offset) => {
    const n = lod > 1 ? 24 : 10;
    return Array.from({ length: n }, (_, i) => {
      const t = (i * 2 * Math.PI) / n;
      return [x + r * Math.cos(t), 21.52 + r * Math.sin(t), z - offset];
    });
  };
  face(o, 'ashlar', disc(0.78, 0.08), [0, 0, -1]);
  face(o, 'glass', disc(0.62, 0.101), [0, 0, -1]);
  if (lod) {
    stripe(o, 'ashlar', gable, 3.15, 21.51, 3.25, 22.0, 0.123);
    stripe(o, 'ashlar', gable, 3.2, 21.47, 3.52, 21.55, 0.125);
  }
}
export function buildHouse(o, _frame, lod = 3) {
  for (const [ring, inside] of [
    [nativeRing, false],
    [courtyard, true],
  ]) {
    walls(o, 'base', ring, foundationBottom, basementTop, inside);
    walls(o, 'brick', ring, basementTop, eave, inside);
    exterior(o, ring, lod, inside);
  }
  cap(o, nativeRing, [courtyard], eave, 1, 'slate');
  if (lod) cap(o, nativeRing, [courtyard], foundationBottom, -1, 'base');
  for (const section of roofSections) hip(o, section);
  centerpiece(o, lod);
  stairAndRail(o, lod);
  if (lod) {
    for (const [x, z] of [
      [-30.18, -1.05],
      [-14.5, 18.0],
      [12.55, -7.8],
      [-23.4, -8.4],
      [35.9, 30.2],
    ]) {
      block(o, 'brick', x - 0.48, 18.6, z - 0.65, x + 0.48, 21.5, z + 0.65);
      block(o, 'ashlar', x - 0.57, 21.42, z - 0.74, x + 0.57, 21.62, z + 0.74);
    }
  }
}
export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [68, 46, -98],
  lookAt = [-5, 10, 3];
const modelPath = 'content/worldgen/source/places/gc/gcr/adams_building_nottingham';
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Red-brick Lace Market warehouse with projecting Italianate bays, pale ashlar dressings, a central staircase and clock gable, and a sequence of dark slate roof ranges around an open court.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick',
    'stone_limestone',
    'stone_sandstone',
    'slate',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'stoney-street-court-and-clock-gable',
      position: [22, 10, -70],
      lookAt: [-5.2, 10.2, -18],
    },
    { name: 'rear-ranges-and-open-courtyard', position: [-63, 44, 67], lookAt: [-10.2, 8.2, 11.4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-warehouse-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: modelPath + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.25,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.075, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.035, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic reconstruction under the repository license. The two published Qualla photos by Superhasn and Smashman were released into the public domain by their authors. The mapped geometry is attributed to OpenStreetMap contributors under ODbL.',
};
