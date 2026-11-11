/** Canterbury Museum on Rolleston Avenue before the redevelopment. */
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
const { footprint, foundationBottom, wallTop, towerCenter } = plan;
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.95, metallic: 0 },
  deck: { slot: 'roof', graph: 'membrane', roughness: 0.96, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.08 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
const colors = {
  stone: rgb('817970'),
  trim: rgb('ded1b1'),
  slate: rgb('7b7770'),
  deck: rgb('8a8880'),
  iron: rgb('646055'),
  dark: rgb('50594f'),
};
const earth = rgb('928a7c'),
  pale = rgb('e3d7ba'),
  shadow = rgb('786e5e'),
  slate = rgb('6b675e');
const block = (out, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(out, k, [x0, y0, z0], [x1, y1, z1], color);
function face(out, k, p, expected, color = colors[k]) {
  let n = normalFor(...p);
  if (n.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 4) quad(out, k, p, n, color);
  else out.addConvexPolygon(k, 'palette:#ffffff', p, n, ([x, y]) => [x, y], color);
}
function shell(out, k, ring, y0, y1, color = colors[k]) {
  const b = new MeshBufferBuilder();
  poly(b, k, ring, y0, y1, color);
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, k, p, normalFor(...p), color);
  }
}
const front = (z) => ({
  n: [0, 0, 1],
  p: (x, y, d = 0) => [x, y, z + d],
});
function panel(out, k, s, x0, y0, x1, y1, d = 0, color = colors[k]) {
  face(out, k, [s.p(x0, y0, d), s.p(x1, y0, d), s.p(x1, y1, d), s.p(x0, y1, d)], s.n, color);
}
function pointed(x, r, spring, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (2 * i) / n - 1;
    return [x + r * t, spring + rise * (1 - Math.pow(Math.abs(t), 1.54))];
  });
}
function traceriedWindow(out, s, x, y, width, height, lod) {
  const r = width / 2,
    spring = y + height - r * 1.04,
    n = [4, 6, 8, 10][lod];
  for (const [k, span, low, peak, d, color] of [
    ['trim', r + 0.22, y - 0.13, r * 1.04 + 0.22, 0.04, pale],
    ['dark', r, y, r * 1.04, 0.065, colors.dark],
  ]) {
    const p = [
      s.p(x - span, low, d),
      s.p(x + span, low, d),
      ...pointed(x, span, spring, peak, n)
        .reverse()
        .map(([u, v]) => s.p(u, v, d)),
    ];
    face(out, k, p, s.n, color);
  }
  if (lod) {
    for (const w of [r - 0.14, r - 0.37]) {
      const shape = pointed(x, w, spring - 0.46, r * 0.94, n);
      const outer = pointed(x, w + 0.09, spring - 0.46, r * 0.94 + 0.08, n);
      for (let i = 0; i < n; i++) {
        const [a, b] = shape[i],
          [c, d] = shape[i + 1],
          [e, f] = outer[i + 1],
          [g, h] = outer[i];
        face(
          out,
          'trim',
          [s.p(a, b, 0.077), s.p(c, d, 0.077), s.p(e, f, 0.077), s.p(g, h, 0.077)],
          s.n,
        );
      }
    }
    panel(out, 'trim', s, x - 0.058, y, x + 0.058, y + height * 0.65, 0.084);
    panel(
      out,
      'iron',
      s,
      x - r + 0.055,
      y + height * 0.34,
      x + r - 0.055,
      y + height * 0.34 + 0.057,
      0.085,
    );
  }
  if (lod === 3) {
    panel(
      out,
      'iron',
      s,
      x - r + 0.055,
      y + height * 0.55,
      x + r - 0.055,
      y + height * 0.55 + 0.045,
      0.086,
    );
    for (const k of [-0.46, 0.46])
      panel(out, 'iron', s, x + r * k - 0.019, y, x + r * k + 0.019, y + height * 0.65, 0.089);
  }
}
function gable(out, x0, x1, z0, z1, eave, ridge, axis = 'x') {
  const a = (x, y, z) => (axis === 'x' ? [x, y, z] : [z, y, x]),
    mid = (z0 + z1) / 2;
  face(out, 'stone', [a(x0, eave, z0), a(x0, eave, z1), a(x0, ridge, mid)], a(-1, 0, 0));
  face(out, 'stone', [a(x1, eave, z0), a(x1, eave, z1), a(x1, ridge, mid)], a(1, 0, 0));
  for (const z of [z0 - 0.22, z1 + 0.22])
    face(
      out,
      'slate',
      [
        a(x0 - 0.19, eave, z),
        a(x1 + 0.19, eave, z),
        a(x1 + 0.19, ridge + 0.04, mid),
        a(x0 - 0.19, ridge + 0.04, mid),
      ],
      [0, 1, 0],
    );
}
function galleries(out, lod) {
  shell(out, 'stone', footprint, foundationBottom, wallTop);
  const rear = [
    [-29.2, -35.6],
    [29.3, -35.6],
    [29.15, 13.13],
    [-29.45, 12.89],
  ];
  shell(out, 'stone', rear, wallTop - 0.07, 11.29, earth);
  shell(out, 'deck', rear, 11.24, 11.46);
  block(out, 'stone', -28.9, 11.35, -31.7, 18.2, 12.57, -9.3, earth);
  block(out, 'deck', -28.9, 12.53, -31.7, 18.2, 12.66, -9.3);
  const streetRange = [
    footprint[3],
    footprint[2],
    footprint[1],
    footprint[0],
    [28.51, 12.13],
    [-22.2, 12.13],
  ];
  shell(out, 'stone', streetRange, wallTop - 0.03, 11.83);
  gable(out, -22.3, 28.88, 12.05, 35.45, 11.81, 17.42);
  gable(out, 12.41, 35.67, 10.08, 16.77, 11.84, 17.78, 'z');
  traceriedWindow(out, front(35.67), 13.42, 12.55, 1.56, 2.51, lod);
  const streetSide = ([x0, z0], [x1, z1]) => ({
    n: [0, 0, 1],
    p: (x, y, d = 0) => [x, y, z0 + ((z1 - z0) * (x - x0)) / (x1 - x0) + d],
  });
  const southern = streetSide(footprint[3], footprint[2]);
  const northern = streetSide(footprint[1], footprint[0]);
  const frontage = (x) => (x < 7.18 ? southern : northern);
  for (const [side, a, b] of [
    [southern, -14.64, 7.14],
    [northern, 7.23, 28.64],
  ]) {
    panel(out, 'trim', side, a, 0.63, b, 1.11, 0.053);
    panel(out, 'trim', side, a, 11.2, b, 11.62, 0.054);
  }
  for (const x of [-6.72, -0.48, 5.74, 12.91, 20.12, 25.56]) {
    const s = frontage(x);
    traceriedWindow(out, s, x, 1.67, 2.77, 8.09, lod);
    if (lod > 1)
      for (let j = 0; j < 8; j++) {
        const y = 1.87 + j * 0.57;
        for (const side of [-1, 1]) {
          const a = x + side * (1.49 + 0.06 * (j % 2));
          panel(out, 'trim', s, a - 0.12, y, a + 0.12, y + 0.42, 0.062);
        }
      }
  }
  if (lod)
    for (let i = 0; i < 31; i++) {
      const x = -8.95 + i * 1.2;
      panel(out, 'trim', frontage(x), x, 10.93, x + 0.22, 11.24, 0.089, pale);
    }
}
function tower(out, lod) {
  const [x, z] = towerCenter,
    w = 3.65,
    d = 3.73;
  const rect = (y, t) => [
    [x - w * t, y, z - d * t],
    [x - w * t, y, z + d * t],
    [x + w * t, y, z + d * t],
    [x + w * t, y, z - d * t],
  ];
  block(out, 'stone', x - w, foundationBottom, z - d, x + w, 17.13, z + d);
  loft(out, 'trim', [rect(16.77, 1.02), rect(17.28, 1.09)], pale);
  loft(
    out,
    'slate',
    [rect(17.19, 1.1), rect(18.62, 0.83), rect(22.18, 0.41), rect(23.18, 0.31)],
    slate,
  );
  const s = front(z + d);
  traceriedWindow(out, s, x - 1.08, 1.43, 1.92, 6.0, lod);
  traceriedWindow(out, s, x + 1.08, 1.43, 1.92, 6.0, lod);
  if (lod) {
    for (let i = 0; i < 22; i++) {
      const y = 0.72 + i * 0.71;
      const w = i % 2 ? 0.52 : 0.35;
      for (const side of [-1, 1])
        panel(
          out,
          'trim',
          s,
          x + side * 3.42 - w / 2,
          y,
          x + side * 3.42 + w / 2,
          y + 0.42,
          0.059,
          pale,
        );
    }
    for (let i = 0; i < 8; i++) {
      const u = x - 3.11 + 0.88 * i;
      panel(out, 'trim', s, u - 0.18, 16.35, u + 0.18, 16.8, 0.075, pale);
    }
    block(out, 'iron', x - 1.22, 23.17, z - 0.037, x + 1.22, 23.23, z + 0.037);
    for (let i = 0; i < 7; i++) {
      const u = x - 1.16 + i * 0.3867;
      block(
        out,
        'iron',
        u - 0.021,
        23.2,
        z - 0.027,
        u + 0.021,
        23.54 + (i % 3 === 0 ? 0.26 : 0),
        z + 0.027,
      );
    }
    block(out, 'iron', x - 1.2, 23.43, z - 0.029, x + 1.2, 23.47, z + 0.029);
  }
}
function roseWindow(out, s, x, y, lod) {
  const disc = (k, cx, cy, r, d, color) => {
    const n = lod > 1 ? 18 : 12;
    face(
      out,
      k,
      Array.from({ length: n }, (_, i) => {
        const a = (2 * Math.PI * i) / n;
        return s.p(cx + r * Math.cos(a), cy + r * Math.sin(a), d);
      }),
      s.n,
      color,
    );
  };
  disc('trim', x, y, 1.8, 0.06, pale);
  disc('dark', x, y, 0.42, 0.082, colors.dark);
  for (let i = 0; i < 6; i++) {
    const t = (i * Math.PI) / 3;
    disc('dark', x + 1.04 * Math.cos(t), y + 1.04 * Math.sin(t), 0.4, 0.086, colors.dark);
  }
}
function porch(out, lod) {
  const x0 = -31.15,
    x1 = -22.22,
    z0 = 29.95,
    z1 = 33.57,
    y0 = 0.39,
    top = 4.26;
  const zBack = front(z0);
  block(out, 'stone', x0, foundationBottom, z0 - 6.4, x1, 9.84, z0);
  gable(out, 19.9, z0, x0, x1, 9.84, 14.58, 'z');
  roseWindow(out, zBack, -26.7, 9.44, lod);
  block(out, 'trim', x0 - 0.18, foundationBottom, z0 - 0.1, x1 + 0.08, y0, z1 + 0.33);
  const s = front(z1);
  const step = (x1 - x0) / 3;
  for (let j = 0; j <= 3; j++) {
    const x = x0 + step * j;
    const v = (levels) => levels.map(([y, r]) => radialRing(y, r, r, lod > 1 ? 8 : 5, [x, z1]));
    loft(
      out,
      'trim',
      v([
        [y0, 0.31],
        [y0 + 0.18, 0.28],
        [2.82, 0.22],
        [3.02, 0.32],
      ]),
      pale,
    );
  }
  for (let j = 0; j < 3; j++) {
    const x = x0 + step * (j + 0.5),
      width = step / 2 - 0.08;
    const p = pointed(x, width, 2.93, 0.96, lod > 1 ? 10 : 6);
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = p[i],
        [c, d] = p[i + 1];
      face(out, 'trim', [s.p(a, b), s.p(c, d), s.p(c, top), s.p(a, top)], s.n);
      face(out, 'trim', [s.p(a, b), s.p(c, d), s.p(c, d, -0.37), s.p(a, b, -0.37)], [0, -1, 0]);
    }
    traceriedWindow(out, zBack, x, 0.44, 1.91, 2.85, lod);
  }
  face(
    out,
    'slate',
    [
      [x0 - 0.31, top, z1 + 0.29],
      [x1 + 0.22, top, z1 + 0.29],
      [x1 + 0.22, 6.31, z0 - 0.09],
      [x0 - 0.31, 6.31, z0 - 0.09],
    ],
    [0, 1, 0],
  );
  panel(out, 'trim', s, x0 - 0.12, top - 0.19, x1 + 0.12, top + 0.1, 0.065, pale);
}
export function buildMuseum(out, _frame, lod = 3) {
  galleries(out, lod);
  tower(out, lod);
  porch(out, lod);
}
export const museumSkyline = (out, frame) => buildMuseum(out, frame, 0);
export const museumDistrict = (out, frame) => buildMuseum(out, frame, 1);
export const museumStreet = (out, frame) => buildMuseum(out, frame, 2);
export const museumCloseup = (out, frame) => buildMuseum(out, frame, 3);
const camera = [-64, 34, 107],
  lookAt = [1, 9, 4];
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'museum-model.mjs',
  surfaces,
  build: buildMuseum,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Pre-redevelopment Canterbury Museum, with a dark Gothic stone frontage, pale window tracery and a steep roof tower.',
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
    'stone_ashlar',
    'stone_limestone',
    'slate',
    'membrane',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'rolleston-avenue-gothic-frontage', position: [-10, 9, 94], lookAt: [-2, 10, 32] },
    { name: 'tower-porch-and-rose-window', position: [-34, 14, 62], lookAt: [-16, 10, 32] },
    { name: 'historic-range-and-rear-galleries', position: [65, 61, -82], lookAt: [0, 7, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-canterbury-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/rb/rb6/canterbury_museum_christchurch/models/museum-model.mjs',
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.27,
    surfaces,
    authoredLevels: {
      district: { export: 'museumDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'museumStreet', errorMeters: 0.063, surfaces },
      closeup: { export: 'museumCloseup', errorMeters: 0.024, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The January 2016 exterior photograph by Szilas is public domain. OpenStreetMap contributors supply the archived footprint under ODbL.',
};
