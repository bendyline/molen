/** San Carlos Borromeo convent and the attached east-facing church at San Lorenzo. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93, metallic: 0 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.12 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
const colors = {
  wall: rgb('e7dbc0'),
  trim: rgb('cbb481'),
  roof: rgb('a57b60'),
  base: rgb('b9ad91'),
  iron: rgb('685f49'),
  dark: rgb('4b4c41'),
};
const ochre = rgb('c0a471'),
  wood = rgb('675341');
const {
  nativeRing: ring,
  courts,
  church,
  foundationBottom,
  floor,
  conventEave,
  churchEave,
  bellTowerTop,
} = plan;
const v = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const block = (o, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(o, k, [x0, y0, z0], [x1, y1, z1], color);
function face(o, k, points, expected, color = colors[k]) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(o, k, points, n, color);
  else o.addConvexPolygon(k, 'palette:#ffffff', points, n, ([x, y]) => [x, y], color);
}
function winding(loop) {
  return Math.sign(
    loop.reduce((sum, [x, z], i) => {
      const [a, b] = loop[(i + 1) % loop.length];
      return sum + x * b - z * a;
    }, 0),
  );
}
function edge(a, b, sign) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [(sign * (b[1] - a[1])) / length, 0, (sign * (a[0] - b[0])) / length];
  const point = (u, y, d = 0) => {
    const [x, z] = mix(a, b, u / length);
    return [x + normal[0] * d, y, z + normal[2] * d];
  };
  return { normal, length, point };
}
function panel(o, k, side, u0, y0, u1, y1, d = 0, color = colors[k]) {
  const { point: p, normal } = side;
  face(o, k, [p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d)], normal, color);
}
function wallBand(o, k, loop, low, high, inward = false, color = colors[k]) {
  const sign = winding(loop) * (inward ? -1 : 1);
  for (let i = 0; i < loop.length; i++) {
    const s = edge(loop[i], loop[(i + 1) % loop.length], sign);
    panel(o, k, s, 0, low, s.length, high, 0, color);
  }
}
function cap(o, k, loop, inner, y, up) {
  const outline = winding(loop) > 0 ? loop : [...loop].reverse();
  const holes = inner.map((h) => (winding(h) < 0 ? h : [...h].reverse()));
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      outline,
      holes,
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Cannot cap the convent and its mapped courts');
  const mesh = b.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    face(o, k, points, [0, up, 0]);
  }
}
function arches(o, k, s, u, y, w, h, d, steps, color = colors[k]) {
  const r = w / 2,
    shoulder = y + h - r;
  const arc = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (Math.PI * i) / steps;
    return s.point(u + r * Math.cos(t), shoulder + r * Math.sin(t), d);
  });
  face(o, k, [s.point(u - r, y, d), s.point(u + r, y, d), ...arc], s.normal, color);
}
function cloister(o, court, lod) {
  const center = court[0].map((_, i) => court.reduce((sum, p) => sum + p[i], 0) / court.length);
  const offset = (p, n) => p.map((value, i) => value + Math.sign(value - center[i]) * n);
  const outer = court.map((p) => offset(p, 3.0)),
    ridge = court.map((p) => offset(p, 1.54));
  const sign = -winding(court);
  for (let i = 0; i < court.length; i++) {
    const j = (i + 1) % court.length;
    face(
      o,
      'roof',
      [
        v(court[i], conventEave),
        v(court[j], conventEave),
        v(ridge[j], conventEave + 1.55),
        v(ridge[i], conventEave + 1.55),
      ],
      [0, 1, 0],
    );
    face(
      o,
      'roof',
      [
        v(ridge[i], conventEave + 1.55),
        v(ridge[j], conventEave + 1.55),
        v(outer[j], conventEave),
        v(outer[i], conventEave),
      ],
      [0, 1, 0],
    );
    const s = edge(court[i], court[j], sign);
    panel(o, 'wall', s, 0, floor, s.length, conventEave);
    if (!lod) continue;
    const bays = Math.max(2, Math.round(s.length / (lod > 1 ? 3.0 : 4.4)));
    const spacing = s.length / bays;
    const steps = lod === 3 ? 9 : 6;
    for (let n = 0; n < bays; n++) {
      const u = spacing * (n + 0.5),
        width = Math.min(2.07, spacing * 0.76);
      arches(o, 'trim', s, u, floor + 0.12, width + 0.2, 2.96, 0.055, steps);
      arches(o, 'dark', s, u, floor + 0.19, width, 2.78, 0.072, steps, rgb('777060'));
      if (lod > 1) {
        const x = spacing * n + 0.16;
        panel(o, 'wall', s, x - 0.13, floor + 0.11, x + 0.13, 3.08, 0.105);
      }
    }
  }
}
function squareTier(o, k, x, z, layers, color = colors[k]) {
  const rings = layers.map(([y, w, d = w]) => [
    [x - w, y, z - d],
    [x - w, y, z + d],
    [x + w, y, z + d],
    [x + w, y, z - d],
  ]);
  loft(o, k, rings, color);
}
function tower(o, lod) {
  const x = (church[3][0] + church[4][0]) / 2,
    z = (church[2][1] + church[3][1]) / 2;
  const width = (church[4][0] - church[3][0]) / 2,
    depth = (church[3][1] - church[2][1]) / 2,
    front = z + depth;
  const trimHeight = [10.1, 15.35, 20.05];
  squareTier(o, 'wall', x, z, [
    [floor, width, depth],
    [10.18, width, depth],
    [15.26, width - 0.19, depth - 0.1],
    [20.08, width - 0.36, depth - 0.27],
  ]);
  for (const y of trimHeight)
    squareTier(o, 'trim', x, z, [
      [y - 0.2, width + 0.12 - (y - 10) * 0.025, depth + 0.12 - (y - 10) * 0.025],
      [y + 0.14, width + 0.12 - (y - 10) * 0.025, depth + 0.12 - (y - 10) * 0.025],
    ]);
  squareTier(o, 'wall', x, z, [
    [20.06, 2.48, 2.18],
    [21.2, 2.34, 2.03],
    [23.95, 0.55, 0.47],
    [24.47, 0.16, 0.15],
  ]);
  const frontSide = edge([x - width, front], [x + width, front], -1);
  arches(o, 'trim', frontSide, width, 2.3, 1.96, 3.14, 0.075, 8);
  arches(o, 'dark', frontSide, width, 2.44, 1.53, 2.82, 0.093, 8);
  for (const [low, top, yz] of [
    [11.1, 14.12, front - 0.05],
    [16.03, 19.04, front - 0.19],
  ]) {
    const side = edge([x - width, yz], [x + width, yz], -1);
    arches(o, 'trim', side, width, low - 0.13, 2.01, top - low + 0.26, 0.11, 8);
    arches(o, 'dark', side, width, low, 1.57, top - low, 0.13, 8);
    if (lod)
      for (const dx of [-2.17, 2.17]) {
        panel(o, 'trim', side, width + dx - 0.22, low - 0.29, width + dx + 0.22, top + 0.61, 0.12);
      }
  }
  const points = Array.from({ length: lod > 1 ? 18 : 10 }, (_, i) => {
    const t = (i * 2 * Math.PI) / (lod > 1 ? 18 : 10);
    return [x + 0.54 * Math.cos(t), 18.41 + 0.54 * Math.sin(t), front + 0.021];
  });
  face(o, 'iron', points, [0, 0, 1]);
  if (lod) {
    block(o, 'trim', x - 0.02, 18.43, front + 0.024, x + 0.02, 18.76, front + 0.045);
    block(o, 'trim', x - 0.18, 18.38, front + 0.024, x + 0.03, 18.44, front + 0.045);
  }
  block(o, 'iron', x - 0.031, 24.46, z - 0.03, x + 0.031, bellTowerTop, z + 0.03);
  block(o, 'iron', x - 0.24, 24.7, z - 0.03, x + 0.24, 24.77, z + 0.03);
}
function nave(o, lod) {
  const x0 = church[0][0],
    x1 = church[6][0],
    back = church[0][1],
    front = (church[4][1] + church[5][1]) / 2;
  const center = (x0 + x1) / 2,
    ridge = 13.4;
  wallBand(o, 'base', church, foundationBottom, floor);
  wallBand(o, 'wall', church, floor, churchEave);
  const a = [x0, churchEave, front],
    b = [x1, churchEave, front],
    c = [x1, churchEave, back],
    d = [x0, churchEave, back];
  const p = [center, ridge, front + 0.09],
    q = [center, ridge, back];
  face(o, 'roof', [a, d, q, p], [0, 1, 0]);
  face(o, 'roof', [b, p, q, c], [0, 1, 0]);
  face(o, 'wall', [a, b, p], [0, 0, 1]);
  face(o, 'wall', [c, d, q], [0, 0, -1]);
  const s = edge([x0, front], [x1, front], -1);
  const w = s.length;
  panel(o, 'trim', s, 0, 4.71, w, 5.02, 0.1, ochre);
  panel(o, 'trim', s, 0, churchEave - 0.33, w, churchEave + 0.035, 0.18, ochre);
  panel(o, 'trim', s, 0, 0.38, w, 0.71, 0.09);
  const apex = [center, ridge, front + 0.15];
  for (const [start, end] of [
    [a, apex],
    [b, apex],
  ]) {
    const u = [start[0], start[1] + 0.04, front + 0.17],
      t = [end[0], end[1] + 0.04, front + 0.17];
    face(o, 'trim', [u, t, [t[0], t[1] - 0.25, t[2]], [u[0], u[1] - 0.25, u[2]]], [0, 0, 1], ochre);
  }
  for (const t of [0.17, 0.5, 0.83]) {
    const u = w * t;
    arches(o, 'trim', s, u, 0.62, 3.27, 3.96, 0.035, 8);
    arches(o, 'wall', s, u, 0.66, 3.02, 3.72, 0.048, 8);
    panel(o, 'dark', s, u - 1.09, 0.66, u + 1.09, 3.38, 0.063, wood);
    arches(o, 'trim', s, u, 5.66, 2.42, 3.51, 0.073, 8);
    arches(o, 'dark', s, u, 5.79, 1.71, 3.18, 0.091, 8);
    if (lod) {
      panel(o, 'iron', s, u - 0.03, 0.66, u + 0.03, 3.38, 0.079);
      panel(o, 'trim', s, u - 0.037, 5.79, u + 0.037, 8.5, 0.104);
    }
  }
  for (const t of [0.02, 0.334, 0.666, 0.98]) {
    const u = w * t;
    panel(o, 'trim', s, u - 0.24, 0.71, u + 0.24, churchEave - 0.35, 0.11, ochre);
    if (lod) panel(o, 'trim', s, u - 0.35, churchEave - 0.77, u + 0.35, churchEave - 0.43, 0.14);
  }
  const badge = Array.from({ length: lod > 1 ? 16 : 8 }, (_, i) => {
    const t = (i * 2 * Math.PI) / (lod > 1 ? 16 : 8);
    return [center + Math.cos(t) * 0.72, 11.24 + Math.sin(t) * 0.81, front + 0.046];
  });
  face(o, 'iron', badge, [0, 0, 1]);
  block(o, 'iron', center - 0.035, ridge, front + 0.06, center + 0.035, ridge + 0.81, front + 0.12);
  block(
    o,
    'iron',
    center - 0.25,
    ridge + 0.49,
    front + 0.06,
    center + 0.25,
    ridge + 0.56,
    front + 0.12,
  );
  if (lod) {
    for (const side of [edge(church[0], church[1], 1), edge(church[5], church[6], 1)]) {
      for (const t of [0.14, 0.3, 0.48, 0.65, 0.82]) {
        const u = side.length * t;
        arches(o, 'trim', side, u, 5.07, 1.39, 3.42, 0.032, 6);
        arches(o, 'dark', side, u, 5.19, 1.05, 3.15, 0.049, 6);
      }
    }
  }
}
export function buildHouse(o, _frame, lod = 3) {
  wallBand(o, 'base', ring, foundationBottom, floor);
  wallBand(o, 'wall', ring, floor, conventEave);
  for (const court of courts) {
    wallBand(o, 'base', court, foundationBottom, floor, true);
    cloister(o, court, lod);
  }
  cap(o, 'roof', ring, courts, conventEave, 1);
  if (lod) cap(o, 'base', ring, courts, foundationBottom, -1);
  if (lod)
    for (let i = 0; i < ring.length; i++) {
      const s = edge(ring[i], ring[(i + 1) % ring.length], winding(ring));
      if (s.length < 6) continue;
      const n = Math.round(s.length / 4.7);
      for (let j = 0; j < n; j++) {
        const u = (s.length * (j + 0.5)) / n;
        panel(o, 'trim', s, u - 0.56, 1.74, u + 0.56, 3.62, 0.026);
        panel(o, 'dark', s, u - 0.42, 1.87, u + 0.42, 3.43, 0.044, wood);
      }
    }
  nave(o, lod);
  tower(o, lod);
}
export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [-104, 62, 135],
  lookAt = [-3, 8, 5];
const modelPath = 'content/worldgen/source/places/6d/6dh/san_carlos_convent';
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
    'Franciscan convent complex with four open courtyards, a cream-and-ochre church front and a tall square bell tower.',
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
    'plaster_lime',
    'stone_sandstone',
    'tile_ceramic',
    'concrete_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'east-church-front-and-south-bell-tower',
      position: [-49, 9, 93],
      lookAt: [-46, 10, 54],
    },
    { name: 'four-convent-courtyards', position: [77, 92, 12], lookAt: [0, 4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-convent-' + reviewLod,
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
      district: { export: 'houseDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.061, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.023, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The published Qualla exterior photograph by Belgrano was released into the public domain. Map geometry attributed to OpenStreetMap contributors under ODbL.',
};
