/** Faro Cathedral, including its open Gothic porch and stone bell crown. */
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

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { church, tower, foundationBottom, porchFloor, towerBaseTop, towerWallTop } = plan;
export const surfaces = {
  white: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.83, metallic: 0.18 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
};
const colors = {
  white: rgb('eee4cf'),
  stone: rgb('b8986f'),
  trim: rgb('d4be98'),
  roof: rgb('a27962'),
  bronze: rgb('4e4940'),
  dark: rgb('52534a'),
};
const ash = rgb('b5a58a'),
  stucco = rgb('e2d4b8'),
  glass = rgb('5b625d');
const block = (out, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(out, k, [x0, y0, z0], [x1, y1, z1], color);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const atY = ([x, z], y) => [x, y, z];
function face(out, k, p, expected, color = colors[k]) {
  let n = normalFor(...p);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 4) quad(out, k, p, n, color);
  else out.addConvexPolygon(k, 'palette:#ffffff', p, n, ([x, y]) => [x, y], color);
}
function winding(loop) {
  return Math.sign(
    loop.reduce((sum, [x, z], i) => {
      const [u, v] = loop[(i + 1) % loop.length];
      return sum + x * v - z * u;
    }, 0),
  );
}
function side(a, b, sign) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const n = [(sign * dz) / length, 0, (-sign * dx) / length];
  return {
    length,
    n,
    p: (u, y, d = 0) => [
      a[0] + (dx * u) / length + d * n[0],
      y,
      a[1] + (dz * u) / length + d * n[2],
    ],
  };
}
function panel(out, k, s, x0, y0, x1, y1, d = 0, color = colors[k]) {
  face(out, k, [s.p(x0, y0, d), s.p(x1, y0, d), s.p(x1, y1, d), s.p(x0, y1, d)], s.n, color);
}
function shell(out, k, ring, y0, y1, color = colors[k]) {
  const b = new MeshBufferBuilder();
  poly(b, k, ring, y0, y1, color);
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3), (v) =>
      Array.from(m.positions.slice(v * 3, v * 3 + 3)),
    );
    face(out, k, p, normalFor(...p), color);
  }
}
function pointed(u, r, spring, rise, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (2 * i) / steps - 1;
    return [u + r * t, spring + rise * (1 - Math.pow(Math.abs(t), 1.52))];
  });
}
function frame(out, s, u, y, w, h, lod) {
  const r = w / 2,
    spring = y + h - w * 0.56,
    steps = lod === 3 ? 10 : 6;
  for (const [k, width, bottom, top, d, color] of [
    ['trim', r + 0.14, y - 0.12, 0.21, 0.06, colors.trim],
    ['dark', r, y, 0, 0.084, glass],
  ]) {
    const p = [
      s.p(u - width, bottom, d),
      s.p(u + width, bottom, d),
      ...pointed(u, width, spring, w * 0.56 + top, steps)
        .reverse()
        .map(([x, a]) => s.p(x, a, d)),
    ];
    face(out, k, p, s.n, color);
  }
}
function gothicOpening(out, s, u, r, bottom, spring, rise, top, depth, lod) {
  const steps = [4, 6, 8, 12][lod],
    arch = pointed(u, r, spring, rise, steps);
  const outer = pointed(u, r + 0.29, spring, rise + 0.27, steps);
  const rim = lod ? 0.096 : 0.045;
  panel(out, 'stone', s, 0, bottom, u - r, top);
  panel(out, 'stone', s, u + r, bottom, s.length, top);
  for (let i = 0; i < steps; i++) {
    const [x, y] = arch[i],
      [a, b] = arch[i + 1];
    const [c, d] = outer[i],
      [e, f] = outer[i + 1];
    face(out, 'stone', [s.p(x, y), s.p(a, b), s.p(a, top), s.p(x, top)], s.n);
    face(out, 'trim', [s.p(x, y, rim), s.p(a, b, rim), s.p(e, f, rim), s.p(c, d, rim)], s.n);
    const normal = s.p(u, spring - 0.1).map((v, j) => v - (s.p(x, y)[j] + s.p(a, b)[j]) / 2);
    face(out, 'trim', [s.p(x, y), s.p(a, b), s.p(a, b, -depth), s.p(x, y, -depth)], normal, ash);
  }
  for (const n of [-1, 1]) {
    const x = u + n * r,
      d = n < 0 ? -0.23 : 0;
    panel(out, 'trim', s, x + d, bottom, x + d + 0.23, spring, rim);
    const normal = s.p(u, spring).map((v, i) => v - s.p(x, spring)[i]);
    face(
      out,
      'trim',
      [s.p(x, bottom), s.p(x, spring), s.p(x, spring, -depth), s.p(x, bottom, -depth)],
      normal,
      ash,
    );
  }
}
function bell(out, x, z, y, r, lod) {
  const sides = [8, 10, 12, 16][lod];
  loft(
    out,
    'bronze',
    [
      [y - r * 0.65, r],
      [y - r * 0.46, r * 0.78],
      [y + r * 0.39, r * 0.51],
      [y + r * 0.68, r * 0.34],
    ].map(([h, v]) => radialRing(h, v, v, sides, [x, z])),
    colors.bronze,
  );
}
function crown(out, x0, x1, z, lod) {
  const depth = 0.83,
    y = towerWallTop + 0.4;
  const mid = (x0 + x1) / 2;
  const bays = [
    { x: mid - 2.57, r: 0.77, top: 18.88, base: 16.34, rise: 0.51 },
    { x: mid, r: 0.94, top: 20.19, base: 16.05, rise: 0.63 },
    { x: mid + 2.57, r: 0.77, top: 18.88, base: 16.34, rise: 0.51 },
  ];
  const pieces = [x0 + 0.58, mid - 1.53, mid + 1.53, x1 - 0.58];
  for (const [i, x] of pieces.entries()) {
    const top = i === 0 || i === 3 ? 18.83 : 19.52,
      w = i === 0 || i === 3 ? 0.61 : 0.38;
    block(out, 'stone', x - w, y, z - depth / 2, x + w, top, z + depth / 2);
    block(
      out,
      'trim',
      x - w - 0.055,
      top - 0.08,
      z - depth / 2 - 0.055,
      x + w + 0.055,
      top + 0.095,
      z + depth / 2 + 0.055,
    );
  }
  for (const { x, r, top, base, rise } of bays) {
    const left = x - r - 0.27,
      right = x + r + 0.27,
      spring = top - rise - 0.52;
    block(out, 'stone', left, y, z - depth / 2, right, base, z + depth / 2);
    for (const dir of [-1, 1]) {
      const oz = z + (dir * depth) / 2;
      const s = side(
        dir === 1 ? [left, oz] : [right, oz],
        dir === 1 ? [right, oz] : [left, oz],
        -1,
      );
      gothicOpening(
        out,
        s,
        s.length / 2,
        r,
        base,
        spring,
        rise,
        top,
        dir === 1 ? depth : 0.085,
        lod,
      );
    }
    face(
      out,
      'trim',
      [
        [left, top, z - depth / 2],
        [right, top, z - depth / 2],
        [right, top, z + depth / 2],
        [left, top, z + depth / 2],
      ],
      [0, 1, 0],
    );
    const t = top - 0.91;
    block(out, 'bronze', x - r, t - 0.045, z - 0.074, x + r, t + 0.05, z + 0.074);
    bell(out, x, z, t - 0.42, r * 0.67, lod);
    if (x === mid && lod) bell(out, x, z, base + 1.33, r * 0.51, lod);
  }
  block(out, 'bronze', mid - 0.042, 20.17, z - 0.039, mid + 0.042, 20.84, z + 0.039);
  block(out, 'bronze', mid - 0.21, 20.58, z - 0.038, mid + 0.21, 20.66, z + 0.038);
}
function towerMesh(out, lod) {
  const front = side(tower[4], tower[0], winding(tower));
  const right = side(tower[3], tower[4], winding(tower));
  const x0 = tower[0][0],
    x1 = tower[4][0],
    z = tower[0][1],
    m = (x0 + x1) / 2;
  shell(out, 'trim', tower, foundationBottom, porchFloor, ash);
  for (let i = 0; i < tower.length; i++) {
    if (i === 3 || i === 4) continue;
    const s = side(tower[i], tower[(i + 1) % tower.length], winding(tower));
    panel(out, 'stone', s, 0, porchFloor, s.length, towerBaseTop);
  }
  gothicOpening(out, front, front.length / 2, 2.22, porchFloor, 3.6, 1.61, towerBaseTop, 1.05, lod);
  gothicOpening(
    out,
    right,
    right.length * 0.5,
    1.49,
    porchFloor,
    3.48,
    1.42,
    towerBaseTop,
    0.91,
    lod,
  );
  const back = side(tower[1], tower[2], -winding(tower));
  const door = back.length / 2;
  const innerDoor = [
    back.p(door - 1.91, porchFloor, 0.13),
    back.p(door + 1.91, porchFloor, 0.13),
    ...pointed(door, 1.91, 3.32, 1.41, lod > 1 ? 10 : 6)
      .reverse()
      .map(([u, y]) => back.p(u, y, 0.13)),
  ];
  face(out, 'dark', innerDoor, back.n, rgb('45433a'));
  if (lod > 1) {
    for (const x of [-1.53, -1.02, -0.51, 0, 0.51, 1.02, 1.53]) {
      panel(out, 'bronze', back, door + x - 0.026, porchFloor, door + x + 0.026, 3.41, 0.148);
    }
  }
  shell(out, 'stone', tower, towerBaseTop, towerWallTop);
  const ring = tower.map(([x, d]) => [m + (x - m) * 1.045, 21.55 + (d - 21.55) * 1.055]);
  shell(out, 'trim', ring, towerWallTop - 0.27, towerWallTop + 0.4, colors.trim);
  if (lod)
    for (const s of [front, right]) {
      const n = Math.round(s.length / 0.54);
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * s.length) / n;
        panel(
          out,
          'stone',
          s,
          u - 0.11,
          towerWallTop - 0.46,
          u + 0.11,
          towerWallTop - 0.14,
          0.21,
          ash,
        );
      }
      panel(out, 'trim', s, 0, towerBaseTop - 0.11, s.length, towerBaseTop + 0.1, 0.092);
      frame(out, s, s.length * 0.5, 8.83, 0.91, 2.5, lod);
    }
  if (lod > 1) {
    const center = [m, 15.94, z - 0.28];
    const dial = Array.from({ length: 16 }, (_, i) => [
      center[0] + 0.39 * Math.cos((i * Math.PI) / 8),
      center[1] + 0.39 * Math.sin((i * Math.PI) / 8),
      center[2],
    ]);
    face(out, 'trim', dial, [0, 0, 1]);
    block(out, 'bronze', m - 0.025, 15.9, z - 0.277, m + 0.025, 16.17, z - 0.265);
  }
  const count = lod > 1 ? 6 : 3;
  for (let i = 0; i < count; i++) {
    const start = z + 0.28 + (2.02 * i) / count,
      end = z + 0.28 + (2.02 * (i + 1)) / count;
    const height = porchFloor - (i * (porchFloor - 0.16)) / count;
    block(out, 'trim', x0 - 0.38, foundationBottom, start, x1 + 0.28, height, end, ash);
  }
  crown(out, x0 + 0.16, x1 - 0.16, z - 0.78, lod);
}
function gable(out, x0, x1, z0, z1, eave, peak, wallColor = colors.white) {
  const m = (x0 + x1) / 2;
  face(
    out,
    'white',
    [
      [x0, eave, z0],
      [x1, eave, z0],
      [m, peak, z0],
    ],
    [0, 0, -1],
    wallColor,
  );
  face(
    out,
    'white',
    [
      [x0, eave, z1],
      [x1, eave, z1],
      [m, peak, z1],
    ],
    [0, 0, 1],
    wallColor,
  );
  for (const x of [x0 - 0.15, x1 + 0.15])
    face(
      out,
      'roof',
      [
        [x, eave, z0 - 0.18],
        [x, eave, z1 + 0.18],
        [m, peak + 0.06, z1 + 0.18],
        [m, peak + 0.06, z0 - 0.18],
      ],
      [0, 1, 0],
    );
}
function churchMesh(out, lod) {
  shell(out, 'white', church, foundationBottom, 8.87);
  const tiers = [
    [-11.14, 10.8, -22.92, 16.85, 11.31, 13.47],
    [-18.15, -11.63, -19.62, -4.46, 10.31, 11.51],
    [-15.85, -10.83, 9.27, 14.47, 10.43, 11.68],
    [7.0, 18.64, 0.15, 18.98, 10.65, 12.12],
  ];
  for (const [x0, x1, z0, z1, eave, peak] of tiers) {
    block(out, 'white', x0, 8.82, z0, x1, eave, z1);
    gable(out, x0, x1, z0, z1, eave, peak);
  }
  const chapel = church.slice(25, 29);
  shell(out, 'white', chapel, 8.76, 9.85, stucco);
  const [left, right] = [church[26][0], church[25][0]];
  gable(
    out,
    left + 0.11,
    right - 0.2,
    church[27][1] + 0.12,
    church[26][1] - 0.08,
    9.85,
    10.56,
    stucco,
  );
  if (!lod) return;
  for (let i = 0; i < church.length; i++) {
    const s = side(church[i], church[(i + 1) % church.length], winding(church));
    if (s.length < 4.8 || i === 20 || i === 21) continue;
    panel(out, 'trim', s, 0, foundationBottom, s.length, 0.85, 0.022, ash);
    if (lod > 1 && (i === 25 || i === 26 || i === 32))
      panel(out, 'trim', s, 0, 1.22, 0.36, 8.67, 0.05);
    const n = Math.max(1, Math.round(s.length / 5.7));
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * s.length) / n;
      frame(out, s, u, i === 26 ? 4.36 : 4.9, i === 26 ? 1.32 : 0.75, i === 26 ? 2.91 : 1.72, lod);
    }
  }
}
export function buildCathedral(out, _frame, lod = 3) {
  churchMesh(out, lod);
  towerMesh(out, lod);
}
export const cathedralSkyline = (out, frame) => buildCathedral(out, frame, 0);
export const cathedralDistrict = (out, frame) => buildCathedral(out, frame, 1);
export const cathedralStreet = (out, frame) => buildCathedral(out, frame, 2);
export const cathedralCloseup = (out, frame) => buildCathedral(out, frame, 3);
const camera = [-57, 30, 65],
  lookAt = [0, 7, 2];
export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'cathedral-model.mjs',
  surfaces,
  build: buildCathedral,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'White Faro Cathedral ranges and the stone bell tower with a double Gothic porch and three open bell bays.',
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
    'stone_limestone_weathered',
    'stone_limestone',
    'tile_ceramic',
    'metal_bronze_cast',
  ],
  qaCameras: [
    { name: 'plaza-portal-and-bell-crown', position: [24, 9, 58], lookAt: [1, 9, 18] },
    { name: 'north-range-and-side-chapel', position: [-56, 18, 24], lookAt: [-7, 6, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-faro-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/ey/eyd/faro_cathedral/models/cathedral-model.mjs',
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.23,
    surfaces,
    authoredLevels: {
      district: { export: 'cathedralDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'cathedralStreet', errorMeters: 0.058, surfaces },
      closeup: { export: 'cathedralCloseup', errorMeters: 0.022, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Two exterior photographs by Benoît Prieur are under CC0. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
