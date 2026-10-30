/** Whole independent square Markar clock tower: primary written facts, explicit section estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  T = P.tower;
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.15 },
  dial: { slot: 'window', graph: 'plaster_lime', roughness: 0.85, metallic: 0 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.85, metallic: 0.1 },
};
const colors = {
  wall: rgb('dbc79e'),
  base: rgb('baaa89'),
  roof: rgb('b2a07b'),
  trim: rgb('625746'),
  dial: rgb('e6e0c9'),
  door: rgb('8d7d5f'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let a = normalFor(...p);
  if (n && a.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], tint);
}
export function frustum(o, k, y0, y1, w0, w1 = w0) {
  const ring = (w, y) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => [(x * w) / 2, y, (z * w) / 2]),
    a = ring(w0, y0),
    b = ring(w1, y1);
  face(o, k, a, [0, -1, 0]);
  face(o, k, b, [0, 1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(o, k, [a[i], a[j], b[j], b[i]], [(a[i][0] + a[j][0]) / 2, 0, (a[i][2] + a[j][2]) / 2]);
  }
}
function basis(side) {
  const theta = (side * Math.PI) / 2,
    n = [Math.sin(theta), 0, Math.cos(theta)],
    u = [Math.cos(theta), 0, -Math.sin(theta)];
  return { n, u, at: (x, y, depth) => [u[0] * x + n[0] * depth, y, u[2] * x + n[2] * depth] };
}
export function shaftHalf(y) {
  return (
    (T.shaftBottomWidth +
      ((T.shaftTopWidth - T.shaftBottomWidth) * (y - T.shaftBottom)) /
        (T.shaftTop - T.shaftBottom)) /
    2
  );
}
function band(o, y, width, depth, lod) {
  if (lod) {
    frustum(o, 'wall', y - depth / 2, y, width - 0.2, width);
    frustum(o, 'wall', y, y + depth * 0.45, width);
    frustum(o, 'wall', y + depth * 0.45, y + depth / 2, width, width - 0.15);
  } else frustum(o, 'wall', y - depth / 2, y + depth / 2, width);
}
function panel(o, side, y0, y1, width, lod) {
  const B = basis(side),
    at = (x, y, extra = 0.015) => B.at(x, y, shaftHalf(y) + extra),
    low = [at(-width / 2, y0), at(width / 2, y0)],
    spring = y1 - width * 0.28,
    n = [1, 4, 8, 12][lod],
    ring = [
      ...low,
      ...Array.from({ length: n + 1 }, (_, i) => {
        const theta = (i * Math.PI) / n;
        return at((width / 2) * Math.cos(theta), spring + width * 0.28 * Math.sin(theta));
      }),
    ];
  face(o, 'base', ring, B.n, rgb('c3af87'));
  if (lod) {
    const outline = [...ring, ring[0]];
    for (let i = 1; i < outline.length; i++)
      beam(
        o,
        'wall',
        outline[i - 1].map((v, k) => v + B.n[k] * 0.025),
        outline[i].map((v, k) => v + B.n[k] * 0.025),
        0.12,
        0.1,
        colors.wall,
      );
  }
  if (lod > 1) {
    for (let row = 0; row < [0, 0, 4, 7][lod]; row++) {
      const Y = y0 + 0.5 + row * 0.43;
      for (let col = 0; col < 5; col++) {
        const x = (col - 2) * width * 0.145,
          j = ((row * 3 + col * 7) % 5) * 0.015,
          a = at(x - width * 0.055, Y, 0.045),
          b = at(x + width * 0.055, Y + j, 0.045);
        beam(o, 'trim', a, b, 0.025, 0.025, colors.trim);
        if ((row + col) % 2 === 0)
          beam(o, 'trim', b, at(x + width * 0.025, Y + 0.12, 0.045), 0.023, 0.023, colors.trim);
      }
    }
  }
}
function clock(o, side, lod) {
  const B = basis(side),
    N = [8, 16, 32, 48][lod],
    D = T.clockWidth / 2 + 0.045,
    R = T.clockRadius,
    y = T.clockCenter,
    point = (theta, r, d) => B.at(Math.cos(theta) * r, y + Math.sin(theta) * r, d),
    center = B.at(0, y, D);
  for (let i = 0; i < N; i++) {
    const a = (i * 2 * Math.PI) / N,
      b = ((i + 1) * 2 * Math.PI) / N;
    face(o, 'dial', [center, point(a, R, D), point(b, R, D)], B.n);
    face(
      o,
      'trim',
      [
        point(a, R, D + 0.025),
        point(a, R + 0.11, D + 0.025),
        point(b, R + 0.11, D + 0.025),
        point(b, R, D + 0.025),
      ],
      B.n,
    );
    face(
      o,
      'trim',
      [
        point(a, R + 0.11, D - 0.03),
        point(a, R + 0.11, D + 0.025),
        point(b, R + 0.11, D + 0.025),
        point(b, R + 0.11, D - 0.03),
      ],
      [Math.cos((a + b) / 2) * B.u[0], Math.sin((a + b) / 2), Math.cos((a + b) / 2) * B.u[2]],
    );
  }
  if (lod)
    for (let i = 0; i < 12; i++) {
      const theta = (i * 2 * Math.PI) / 12;
      beam(
        o,
        'trim',
        point(theta, R * 0.75, D + 0.04),
        point(theta, R * 0.91, D + 0.04),
        i % 3 ? 0.035 : 0.06,
        0.025,
        colors.trim,
      );
    }
  // Static estimated10:10; every face shares the same non-operational pose.
  for (const [angle, length, width] of [
    [Math.PI / 2 + Math.PI / 3, R * 0.55, 0.065],
    [Math.PI / 2 - Math.PI / 3, R * 0.78, 0.045],
  ])
    beam(
      o,
      'trim',
      B.at(0, y, D + 0.075),
      point(angle, length, D + 0.075),
      width,
      0.04,
      colors.trim,
    );
  if (lod > 1)
    for (let i = 0; i < 12; i++) {
      const theta = (i * Math.PI) / 6;
      beam(
        o,
        'trim',
        point(theta, R * 0.65, D + 0.045),
        point(theta + 0.035, R * 0.66, D + 0.045),
        0.025,
        0.025,
        colors.trim,
      );
    }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  for (const s of T.steps) frustum(o, 'base', s.y0, s.y1, s.width);
  componentEvidence.push('whole-independent-square-stepped-base');
  frustum(o, 'wall', T.shaftBottom, T.shaftTop, T.shaftBottomWidth, T.shaftTopWidth);
  componentEvidence.push(
    'whole-tapered-square-body-with-estimated-corner-piers-and-inscription-panels',
  );
  // Corner pilasters follow the same frozen tapered shaft section, with slight relief.
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const a = [
          x * (T.shaftBottomWidth / 2 - 0.18),
          T.shaftBottom,
          z * (T.shaftBottomWidth / 2 - 0.18),
        ],
        b = [x * (T.shaftTopWidth / 2 - 0.18), T.shaftTop, z * (T.shaftTopWidth / 2 - 0.18)];
      beam(o, 'wall', a, b, 0.4, 0.4, colors.wall);
    }
  band(o, T.shaftBottom + 0.25, T.shaftBottomWidth + 0.35, 0.32, lod);
  band(o, T.shaftTop - 0.1, T.shaftTopWidth + 0.45, 0.32, lod);
  frustum(o, 'wall', T.shaftTop, T.clockBottom, T.shaftTopWidth + 0.3, T.clockWidth);
  frustum(o, 'wall', T.clockBottom, T.clockTop, T.clockWidth);
  band(o, T.clockBottom + 0.03, T.clockWidth + 0.16, 0.25, lod);
  band(o, T.clockTop - 0.02, T.roofWidth, 0.3, lod);
  frustum(o, 'wall', T.clockTop, T.roofEave, T.roofWidth);
  for (let side = 0; side < 4; side++) {
    panel(o, side, T.shaftBottom + 1.2, T.shaftTop - 1.1, 2.2, lod);
    clock(o, side, lod);
  }
  componentEvidence.push('all-four-complete-clock-faces-with-dials-rims-and-static-hands');
  componentEvidence.push(
    'whole-intrinsic-cornices-pilasters-and-original-abstract-inscription-panels',
  );
  const B = basis(2),
    y0 = T.shaftBottom + 0.12,
    y1 = y0 + 2,
    at = (u, y) => B.at(u, y, shaftHalf(y) + 0.035);
  face(o, 'door', [at(-0.48, y0), at(0.48, y0), at(0.48, y1), at(-0.48, y1)], B.n);
  if (lod) beam(o, 'trim', at(0.26, y0 + 0.9), at(0.26, y0 + 1.12), 0.04, 0.04, colors.trim);
  const r = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => [(x * T.roofWidth) / 2, T.roofEave, (z * T.roofWidth) / 2]),
    apex = [0, T.roofTop, 0];
  for (let i = 0; i < 4; i++) face(o, 'roof', [r[i], r[(i + 1) % 4], apex], [0, 1, 0]);
  face(o, 'roof', r, [0, -1, 0]);
  if (lod > 1) for (const q of r) beam(o, 'roof', q, apex, 0.07, 0.07, colors.roof);
  componentEvidence.push(
    'whole-plain-sloped-square-hip-roof-and-reported-eighteen-metre-total-height',
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tj/tjw/markar_clock_tower',
  camera = [26, 23, 34],
  look = [0, 8.5, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Markar Clock Tower — Yazd',
  wikidataId: 'Q5902355',
  cell: 'tj/tjw',
  category: 'clock-tower',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: P.floor - 0.24,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'whole-independent-markar-clock-tower-and-base', position: camera, lookAt: look },
    { name: 'upper-clock-faces-and-plain-hip-roof', position: [12, 19, 15], lookAt: [0, 15.2, 0] },
    {
      name: 'shaft-cornices-and-abstract-inscription-panels',
      position: [-11, 9, -14],
      lookAt: [0, 6.8, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-markar-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.08, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.03, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural complete independent clock tower under repository license. Native exact namedQ5902355point ODbL; primary historian/museum written height/form facts only, all images/video/figures unused. Widths/tier/roof/dial/inscription/fittings/finish/azimuth/grade explicitly estimated. No copied calligraphy, readable source verse, photographic appearance, borrowed meshes/texture pixels or surveyed/current-world approval.',
};
