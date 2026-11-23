import { readFileSync } from 'node:fs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const map = read('native-map/key-route-inn-historic-plan.json');
const { northHotel, southHotel, broadwayPortal, westTrainShed } = map.localRings;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  timber: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.89 },
  base: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.92 },
  canopy: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84 },
  iron: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.73, metallic: 0.17 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59 },
};

const infill = rgb('d7c4a0');
const pale = rgb('e0d2b3');
const beamColor = rgb('51443a');
const timberLight = rgb('71604d');
const dark = rgb('393e3a');
const base = rgb('816b58');
const glass = rgb('4c5f61');
const ground = rgb('8e8474');
const shingles = rgb('53534b');
const iron = rgb('55615c');
const mainEave = 11;
const groundFloor = 3.7;

function polygon(out, slot, shape, y0, y1, tint, capped = false) {
  extrude(out, slot, shape, y0, y1, tint, { top: false });
  if (capped) cap(out, slot, shape, y1, tint);
}
function faces(shape) {
  const ring = outwardRing(shape);
  return ring.map((a, i) => wallFace(a, ring[(i + 1) % ring.length]));
}
function panel(out, slot, f, l, r, b, t, d, tint) {
  quad4(out, slot, f.P(l, b, d), f.P(r, b, d), f.P(r, t, d), f.P(l, t, d), tint);
}
function wood(out, f, l, r, b, t, lod, tint = beamColor) {
  if (lod < 2) panel(out, 'timber', f, l, r, b, t, 0.071, tint);
  else fbox(out, 'timber', f, l, r, b, t, 0.042, lod === 3 ? 0.156 : 0.115, tint);
}
function brace(out, f, a, b, w, lod, tint = beamColor) {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const length = Math.hypot(x1 - x0, y1 - y0);
  const du = (-(y1 - y0) * w) / length / 2;
  const dy = ((x1 - x0) * w) / length / 2;
  const p = (x, y) => f.P(x, y, lod < 2 ? 0.075 : 0.169);
  quad4(
    out,
    'timber',
    p(x0 + du, y0 + dy),
    p(x0 - du, y0 - dy),
    p(x1 - du, y1 - dy),
    p(x1 + du, y1 + dy),
    tint,
  );
}
function window(out, f, l, r, b, t, lod, depth = 0.057) {
  panel(out, 'glass', f, l, r, b, t, depth, glass);
  if (!lod) return;
  const m = (l + r) / 2;
  panel(out, 'timber', f, m - 0.047, m + 0.047, b, t, depth + 0.025, timberLight);
  panel(out, 'timber', f, l, r, b - 0.075, b + 0.02, depth + 0.036, timberLight);
  if (lod > 1) {
    const y = b + (t - b) * 0.66;
    panel(out, 'timber', f, l, r, y - 0.04, y + 0.036, depth + 0.028, timberLight);
  }
}
function wallDetail(out, f, bottom, top, lod, front = false) {
  if (f.length < 2.25) return;
  const bays = Math.max(1, Math.round(f.length / (lod === 0 ? 8.15 : 3.35)));
  const w = f.length / bays;
  if (front || lod) {
    for (const y of [bottom, bottom + 3.16, bottom + 4.05, top - 0.17])
      wood(out, f, 0, f.length, y, y + 0.15, lod);
  }
  for (let i = 0; i < bays; i++) {
    const x = i * w;
    const end = x + w;
    if (x > 0.005) wood(out, f, x - 0.052, x + 0.052, bottom, top, lod);
    window(out, f, x + w * 0.19, end - w * 0.19, bottom + 0.78, bottom + 2.52, lod);
    if (lod || front) window(out, f, x + w * 0.21, end - w * 0.21, bottom + 4.52, top - 0.66, lod);
    if (lod > 1 && w < 5) {
      for (const fraction of [0.31, 0.66]) {
        const q = x + w * fraction;
        const dx = Math.min(0.38, w * 0.13);
        brace(out, f, [q - dx, bottom + 3.39], [q + dx, bottom + 3.95], 0.09, lod, pale);
        brace(out, f, [q - dx, bottom + 3.95], [q + dx, bottom + 3.39], 0.09, lod, pale);
      }
    }
    if (front && lod) window(out, f, x + w * 0.095, end - w * 0.095, 0.73, 3.31, lod);
    if (lod > 1) {
      const close = x + w * 0.15;
      wood(out, f, close - 0.044, close + 0.044, bottom + 0.18, bottom + 3.05, lod);
      const far = end - w * 0.15;
      wood(out, f, far - 0.044, far + 0.044, bottom + 4.14, top - 0.17, lod);
    }
  }
}
function gable(out, e0, e1, peak, depth, lod) {
  const f = wallFace(e0, e1);
  const mid = f.length / 2;
  const top = mainEave + peak;
  const inset = Math.hypot(depth[0], depth[1]);
  const center = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2];
  gableRoof(
    out,
    'roof',
    [center[0] + depth[0], center[1] + depth[1]],
    center,
    f.length,
    mainEave,
    top,
    shingles,
    { overhang: 0.3, endSlot: 'wall', endColor: infill, ends: [false, true] },
  );
  tri(
    out,
    'wall',
    f.P(0, mainEave, 0.022),
    f.P(f.length, mainEave, 0.022),
    f.P(mid, top, 0.022),
    pale,
  );
  const peakLine = [mid, top - 0.1];
  for (const [u, y] of [
    [0, mainEave + 0.12],
    [f.length, mainEave + 0.12],
    [mid, mainEave],
  ]) {
    brace(out, f, [u, y], peakLine, 0.23, lod);
  }
  wood(out, f, 0.12, f.length - 0.12, mainEave + 0.05, mainEave + 0.24, lod);
  if (!lod) return;
  const low = mainEave + peak * 0.36;
  const half = mid * 0.6;
  wood(out, f, mid - half, mid + half, low - 0.08, low + 0.08, lod);
  for (const dx of [-half * 0.68, half * 0.68]) {
    const center = mid + dx;
    const height = top - (peak * Math.abs(dx)) / mid - 0.22;
    wood(out, f, center - 0.062, center + 0.062, mainEave, height, lod);
    if (lod > 1)
      brace(out, f, [mid - signTo(dx) * half, mainEave + 0.22], [center, low], 0.14, lod);
  }
  if (lod > 1 && inset > 2) {
    window(out, f, mid - 0.67, mid + 0.67, mainEave + 0.32, low - 0.12, lod);
    brace(out, f, [mid - half, low], [mid, top - 0.61], 0.12, lod);
    brace(out, f, [mid + half, low], [mid, top - 0.61], 0.12, lod);
  }
}
const signTo = (value) => (value < 0 ? -1 : 1);

function hotelRange(out, shape, lod) {
  polygon(out, 'base', shape, -1.65, groundFloor, base);
  polygon(out, 'wall', shape, groundFloor, mainEave, infill, true);
  for (const f of faces(shape)) {
    const frontage = f.normal[1] > 0.58 || f.normal[0] < -0.93;
    if (lod || frontage) wallDetail(out, f, groundFloor, mainEave, lod, frontage);
  }
}
function roundTower(out, lod) {
  const center = [-20.05, 24.22];
  const rotation = Math.PI / 8;
  const r = 2.56;
  const shape = tower(out, 'wall', center, r, 8, 0.02, 16.25, pale, { rotation, top: false });
  for (const f of faces(shape)) {
    if (!lod && f.normal[1] < -0.2) continue;
    const u = f.length;
    for (const y of [3.66, 7.35, 11.52, 14.69, 15.37]) wood(out, f, 0, u, y, y + 0.14, lod);
    wood(out, f, 0.02, 0.135, 3.68, 15.34, lod);
    for (const y of [4.42, 8.38, 12.77]) window(out, f, u * 0.22, u * 0.79, y, y + 1.7, lod);
    if (lod > 1) brace(out, f, [u * 0.14, 14.64], [u * 0.5, 13.96], 0.1, lod);
  }
  lathe(
    out,
    'roof',
    center,
    [
      [16.15, 2.77, 2.77],
      [16.61, 2.61, 2.61],
      [18.08, 1.63, 1.63],
      [20.64, 0.075, 0.075],
    ],
    8,
    shingles,
    { rotation },
  );
  tower(out, 'iron', center, 0.12, 6, 20.47, 21.34, iron, { top: false });
}
function squareTower(out, lod) {
  const x = 11.65,
    z = 20.42;
  const corners = [
    [x - 2.55, z - 2.56],
    [x - 2.55, z + 2.56],
    [x + 2.55, z + 2.56],
    [x + 2.55, z - 2.56],
  ];
  polygon(out, 'wall', corners, 5.4, 19.27, pale);
  const top = 21.55;
  for (const f of faces(corners)) {
    wallDetail(out, f, 5.45, 12.58, lod, false);
    window(out, f, 1.28, 3.81, 13.02, 15.16, lod);
    const middle = f.length * 0.5;
    const spring = 17.64;
    const radius = 1.18;
    fan(
      out,
      'glass',
      [
        f.P(middle - radius, 16.44, 0.058),
        f.P(middle + radius, 16.44, 0.058),
        ...roundArch(radius, lod > 1 ? 10 : 4)
          .reverse()
          .map(([u, y]) => f.P(middle + u, spring + y, 0.058)),
      ],
      dark,
    );
    if (lod > 1) wood(out, f, middle - 0.043, middle + 0.043, 16.45, 17.48, lod);
    for (const y of [12.58, 15.79, 18.92]) wood(out, f, 0, f.length, y, y + 0.22, lod);
    if (lod > 1) {
      wood(out, f, 0, 0.18, 12.75, 18.93, lod);
      wood(out, f, f.length - 0.18, f.length, 12.75, 18.93, lod);
    }
  }
  lathe(
    out,
    'roof',
    [x, z],
    [
      [19.24, 4.04, 4.04],
      [19.75, 3.57, 3.57],
      [21.13, 0.42, 0.42],
      [top, 0.19, 0.19],
    ],
    4,
    shingles,
    { rotation: Math.PI / 4 },
  );
  beam(out, 'iron', [x, top - 0.08, z], [x, top + 2.85, z], 0.079, 0.079, iron);
}
function portal(out, lod) {
  polygon(out, 'wall', broadwayPortal, 4.87, mainEave, pale, true);
  const f = wallFace(broadwayPortal[2], broadwayPortal[1]);
  wallDetail(out, f, 4.87, mainEave, lod, false);
  for (const u of [0.03, f.length - 0.51]) {
    fbox(out, 'base', f, u, u + 0.48, -0.43, 4.87, -2.9, 0.02, base);
  }
  fbox(out, 'timber', f, 0, f.length, 4.55, 4.93, -1.3, 0.26, beamColor);
  const pos = (u, d) => {
    const p = f.P(u, 0, d);
    return [p[0], p[2]];
  };
  gableRoof(
    out,
    'roof',
    pos(f.length * 0.38, 0),
    pos(f.length * 0.38, 2.84),
    5.58,
    3.44,
    5.44,
    shingles,
    { overhang: 0.22, endSlot: 'timber', endColor: beamColor, ends: [false, true] },
  );
  for (const u of [f.length * 0.38 - 2.75, f.length * 0.38 + 2.75]) {
    fbox(out, 'timber', f, u - 0.12, u + 0.12, 0.14, 3.45, 2.43, 2.68, beamColor);
  }
}
function trainShed(out, lod) {
  const [a, b, c, d] = westTrainShed;
  const rear = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2];
  const front = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
  const axis = facade(rear, [front[0] - rear[0], front[1] - rear[1]]);
  const length = Math.hypot(front[0] - rear[0], front[1] - rear[1]);
  const width = 7.59;
  const middle = 5.03,
    rise = 2.43;
  const segments = [6, 8, 12, 16][lod];
  const bays = [3, 6, 9, 12][lod];
  const slope = (v) => Math.sin((Math.PI * v) / segments) * rise + middle;
  const pos = (u, i) => axis.P(u, slope(i), -width + (2 * i * width) / segments);
  for (let i = 0; i < segments; i++) {
    const p = pos(0, i),
      q = pos(0, i + 1),
      r = pos(length, i + 1),
      s = pos(length, i);
    quad4(out, 'canopy', p, q, r, s, shingles);
    quad4(
      out,
      'canopy',
      [q[0], q[1] - 0.075, q[2]],
      [p[0], p[1] - 0.075, p[2]],
      [s[0], s[1] - 0.075, s[2]],
      [r[0], r[1] - 0.075, r[2]],
      dark,
    );
  }
  for (let j = 0; j <= bays; j++) {
    const u = (j * length) / bays;
    for (const v of [-width + 0.14, width - 0.14]) {
      beam(out, 'iron', axis.P(u, -1.25, v), axis.P(u, middle, v), 0.17, 0.22, iron);
    }
    if (!lod || (j > 0 && j < bays && lod < 2)) continue;
    beam(out, 'iron', axis.P(u, middle, -width), axis.P(u, middle, width), 0.13, 0.17, iron);
    for (let i = 0; i < segments; i++) {
      beam(out, 'iron', pos(u, i), pos(u, i + 1), 0.12, 0.18, iron);
      if (lod > 1 && i % 2 === 1 && i < segments - 1) {
        beam(
          out,
          'iron',
          axis.P(u, middle, -width + (2 * (i - 1) * width) / segments),
          pos(u, i),
          0.11,
          0.13,
          iron,
        );
      }
    }
  }
  const floor = (u, v) => axis.P(u, -1.07 + (u / length) * 0.64, v);
  const start = lod === 0 ? 0 : -3;
  const end = length + 18;
  for (const center of [-2.46, 2.46]) {
    const v = center - 1.46;
    const w = center + 1.46;
    quad4(out, 'base', floor(start, v), floor(start, w), floor(end, w), floor(end, v), ground);
    for (const rail of [center - 0.72, center + 0.72]) {
      const p = floor(start, rail),
        q = floor(end, rail);
      beam(out, 'iron', [p[0], p[1] + 0.1, p[2]], [q[0], q[1] + 0.1, q[2]], 0.082, 0.068, iron);
    }
    if (lod > 1)
      for (let u = 0.2; u < end; u += lod === 3 ? 0.78 : 2.1) {
        const a = floor(u, center - 0.95),
          b = floor(u, center + 0.95);
        beam(
          out,
          'timber',
          [a[0], a[1] + 0.032, a[2]],
          [b[0], b[1] + 0.032, b[2]],
          0.17,
          0.06,
          beamColor,
        );
      }
  }
}
function build(out, lod) {
  hotelRange(out, northHotel, lod);
  hotelRange(out, southHotel, lod);
  const darkRoof = (start, end, width, peak) =>
    gableRoof(out, 'roof', start, end, width, mainEave, mainEave + peak, shingles, {
      overhang: 0.27,
      endSlot: 'wall',
      endColor: infill,
    });
  darkRoof([2.1, -61.1], [19.25, 7.3], 17.32, 5.77);
  darkRoof([17.75, 10.6], [41.27, 10.6], 31.25, 6.47);
  darkRoof([-29.3, -18.4], [-13.5, 24.18], 15.75, 6.15);
  darkRoof([-18.7, 16.7], [21.0, 16.7], 15.66, 6.15);
  gable(out, [-26.1, 24.9], [-11.6, 24.9], 6.34, [0, -8.8], lod);
  gable(out, [18.6, 25.08], [27.7, 26.34], 6.25, [0, -10.7], lod);
  gable(out, [32.2, 26.18], [42.74, 26.32], 6.03, [0, -15.8], lod);
  gable(out, [10.86, -62.91], [-7.08, -58.8], 5.98, [1.8, 9.0], lod);
  const southwest = wallFace(southHotel.at(-1), southHotel.at(-2));
  for (const along of [6.4, 19.0, 31.7]) {
    const frame = (distance) => {
      const point = southwest.P(distance, 0, 0.15);
      return [point[0], point[2]];
    };
    const towardRidge = [-southwest.normal[0] * 8.9, -southwest.normal[1] * 8.9];
    gable(out, frame(along - 5.4), frame(along + 5.4), 6.64, towardRidge, lod);
  }
  if (lod)
    for (const x of [-11.7, -4.49, 2.22])
      gable(out, [x - 1.64, 23.78], [x + 1.64, 23.78], 2.44, [0, -3.32], lod);
  portal(out, lod);
  roundTower(out, lod);
  squareTower(out, lod);
  trainShed(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'key-route-inn-model.mjs';
const camera = [-78, 26, 108];
const lookAt = [2, 7, -14];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'hotel-commercial',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '1912-01-01',
    validFrom: '1907-05-07',
    validUntil: '1930-09-08',
  },
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 1912 Key Route Inn in Oakland, a half-timbered hotel with a gabled Broadway frontage, mismatched towers and the open rail shed of the Key System terminus.',
  camera,
  lookAt,
  sunDirection: [-43, 82, 68],
  mediumFiContext: {
    scale: 1.49,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'wood_painted_lap',
    'brick_flemish',
    'shingle_cedar',
    'metal_standing_seam',
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'broadway-tudor-frontage', position: camera, lookAt },
    { name: 'entrance-and-flag-tower', position: [-15, 6, 54], lookAt: [3, 9, 23.3] },
    { name: 'valley-street-train-shed', position: [-26, 9, -105], lookAt: [-9, 5, -43] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'key-route-inn-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.85,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.066, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on the public-domain Qualla postcards, a 1911 published photograph and the 1912 Sanborn map, with OpenStreetMap roadway alignment and Mapzen elevation.',
};
