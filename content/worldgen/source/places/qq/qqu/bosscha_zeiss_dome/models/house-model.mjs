/** Whole main Zeiss dome building from owner dimensions and native base outline. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.2 },
  base: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.97, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#50666d', roughness: 0.24, metallic: 0.05 },
};
const colors = {
  wall: rgb('deded5'),
  roof: rgb('e1e3da'),
  base: rgb('777e74'),
  wood: rgb('5d6054'),
  glass: rgb('50666d'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let a = normalFor(...p);
  if (n && a.reduce((v, q, i) => v + q * n[i], 0) < 0) {
    p = [...p].reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], tint);
}
const circle = (r, n = 19) =>
  Array.from({ length: n }, (_, i) => [
    r * Math.cos((i * 2 * Math.PI) / n),
    r * Math.sin((i * 2 * Math.PI) / n),
  ]);
function shell(o, k, a, b, y0, y1, caps = true, tint = colors[k]) {
  const low = a.map((p) => [p[0], y0, p[1]]),
    high = b.map((p) => [p[0], y1, p[1]]);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      n = [(a[i][0] + a[j][0]) / 2, 0, (a[i][1] + a[j][1]) / 2];
    face(o, k, [low[i], low[j], high[j], high[i]], n, tint);
  }
  if (caps) {
    face(o, k, low, [0, -1, 0], tint);
    face(o, k, high, [0, 1, 0], tint);
  }
}
function tube(o, k, r, y0, y1, n = 19) {
  const p = circle(r, n);
  shell(o, k, p, p, y0, y1);
}
function beam(o, k, a, b, w) {
  const v = b.map((q, i) => q - a[i]),
    l = Math.hypot(...v),
    d = v.map((q) => q / l),
    up = Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    u = cross(d, up),
    ul = Math.hypot(...u);
  for (let i = 0; i < 3; i++) u[i] /= ul;
  const q = cross(d, u),
    end = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => p.map((v, i) => v + ((u[i] * s + q[i] * t) * w) / 2)),
    A = end(a),
    B = end(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(o, k, [A[i], A[j], B[j], B[i]]);
  }
  face(
    o,
    k,
    A,
    d.map((q) => -q),
  );
  face(o, k, B, d);
}
const dome = (a, b, offset = 0) => {
  const r = P.dome.diameter / 2 + offset;
  return [
    r * Math.cos(b) * Math.sin(a),
    P.dome.springY + r * Math.sin(b),
    r * Math.cos(b) * Math.cos(a),
  ];
};
function panel(o, k, a, y0, y1, w, offset = 0.035, tint = colors[k]) {
  const N = [Math.sin(a), Math.cos(a)],
    U = [N[1], -N[0]],
    r = P.wall.radius + offset,
    p = (u, y) => [N[0] * r + U[0] * u, y, N[1] * r + U[1] * u];
  face(o, k, [p(-w / 2, y0), p(w / 2, y0), p(w / 2, y1), p(-w / 2, y1)], [N[0], 0, N[1]], tint);
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const segments = [19, 24, 32, 48][lod],
    rows = [4, 7, 12, 20][lod],
    R = P.dome.diameter / 2;
  shell(o, 'base', P.nativeBaseRing, P.nativeBaseRing, P.base.bottom, P.base.top);
  componentEvidence.push('whole-original-native-base-envelope');
  tube(o, 'wall', P.wall.radius, P.wall.bottom, P.wall.top, segments);
  tube(o, 'wall', P.wall.radius + 0.12, 0.35, 0.58, segments);
  tube(o, 'roof', P.wall.radius + 0.15, P.wall.top - 0.16, P.wall.top, segments);
  componentEvidence.push('whole-cylindrical-main-building-and-rotation-band');
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < rows; j++) {
      const a0 = (2 * Math.PI * i) / segments,
        a1 = (2 * Math.PI * (i + 1)) / segments,
        b0 = (Math.PI * 0.5 * j) / rows,
        b1 = (Math.PI * 0.5 * (j + 1)) / rows,
        points =
          j === rows - 1
            ? [dome(a0, b0), dome(a1, b0), [0, P.dome.springY + P.dome.rise, 0]]
            : [dome(a0, b0), dome(a1, b0), dome(a1, b1), dome(a0, b1)],
        n = dome((a0 + a1) / 2, (b0 + b1) / 2).map((v, k) => v - (k === 1 ? P.dome.springY : 0));
      face(o, 'roof', points, n);
    }
  componentEvidence.push('whole-fourteen-point-five-metre-closed-steel-dome');
  if (lod > 0) {
    for (const a of [P.entrance.bearing, P.entrance.bearing + Math.PI]) {
      for (let j = 0; j < rows; j++) {
        const b0 = (Math.PI * 0.5 * j) / rows,
          b1 = (Math.PI * 0.5 * (j + 1)) / rows,
          az = 0.035;
        const p = [
          dome(a - az, b0, 0.022),
          dome(a + az, b0, 0.022),
          dome(a + az, b1, 0.022),
          dome(a - az, b1, 0.022),
        ];
        if (j === rows - 1) p.splice(2, 2, [0, P.dome.springY + R + 0.022, 0]);
        face(
          o,
          'roof',
          p,
          dome(a, (b0 + b1) / 2).map((v, k) => v - (k === 1 ? P.dome.springY : 0)),
          colors.roof.map((v) => v * 0.89),
        );
      }
    }
    if (lod > 1)
      for (let i = 0; i < [0, 0, 12, 24][lod]; i++) {
        const a = (i * 2 * Math.PI) / [1, 1, 12, 24][lod];
        for (let j = 0; j < rows - 1; j++) {
          const b0 = (Math.PI * 0.5 * j) / rows,
            b1 = (Math.PI * 0.5 * (j + 1)) / rows;
          beam(o, 'roof', dome(a, b0, 0.027), dome(a, b1, 0.027), 0.016);
        }
      }
  }
  componentEvidence.push('estimated-closed-meridional-shutter-and-roof-seams');
  panel(o, 'wood', P.entrance.bearing, P.entrance.bottom, P.entrance.top, P.entrance.width, 0.07);
  for (const y of P.windows.levels)
    for (let j = 0; j < P.windows.perLevel; j++) {
      const a = (2 * Math.PI * j) / P.windows.perLevel;
      if (
        y < 3 &&
        Math.abs(Math.atan2(Math.sin(a - P.entrance.bearing), Math.cos(a - P.entrance.bearing))) <
          0.35
      )
        continue;
      panel(
        o,
        'wall',
        a,
        y - 0.7,
        y + 0.7,
        P.windows.width + 0.18,
        0.07,
        colors.wall.map((v) => v * 0.82),
      );
      panel(
        o,
        'glass',
        a,
        y - P.windows.height / 2,
        y + P.windows.height / 2,
        P.windows.width,
        0.095,
      );
      if (lod > 0) panel(o, 'wall', a, y - 0.025, y + 0.025, P.windows.width, 0.11);
    }
  if (lod > 0) {
    const a = P.entrance.bearing,
      N = [Math.sin(a), Math.cos(a)],
      U = [N[1], -N[0]];
    for (let i = 0; i < 3; i++) {
      const r = 9.12 + i * 0.42,
        at = (u, v, y) => [N[0] * (r + v) + U[0] * u, y, N[1] * (r + v) + U[1] * u],
        A = [at(-1, -0.3, -0.1), at(1, -0.3, -0.1), at(1, 0.3, -0.1), at(-1, 0.3, -0.1)],
        B = A.map((p) => [p[0], 0.35 - i * 0.115, p[2]]);
      face(o, 'base', A, [0, -1, 0]);
      face(o, 'base', B, [0, 1, 0]);
      for (let k = 0; k < 4; k++) face(o, 'base', [A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]]);
    }
    for (const side of [-1, 1]) {
      const u = side * (P.entrance.width / 2 + 0.08),
        a0 = [
          N[0] * (P.wall.radius + 0.13) + U[0] * u,
          0.32,
          N[1] * (P.wall.radius + 0.13) + U[1] * u,
        ],
        a1 = [a0[0], 3.05, a0[2]];
      beam(o, 'wall', a0, a1, 0.12);
    }
  }
  componentEvidence.push('whole-entry-windows-and-intrinsic-apron-steps');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qq/qqu/bosscha_zeiss_dome',
  camera = [28, 18, 34],
  look = [0, 6, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Bosscha Zeiss Dome — Lembang',
  wikidataId: 'Q126583',
  cell: 'qq/qqu',
  category: 'observatory',
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
  portableGroundY: -0.21,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stucco', 'metal_painted', 'stone_basalt_raw', 'wood_plain'],
  qaCameras: [
    { name: 'whole-main-zeiss-dome-building-and-native-base', position: camera, lookAt: look },
    { name: 'closed-steel-dome-and-rotation-band', position: [17, 16, 19], lookAt: [0, 10, 0] },
    { name: 'rear-whole-building-and-all-native-outline', position: [-26, 17, -32], lookAt: look },
    { name: 'entry-apron-steps-and-window-details', position: [13, 5, 17], lookAt: [2, 3, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-bosscha-${reviewLod}`,
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
      district: { export: 'houseDistrict', errorMeters: 0.1, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.035, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license; exact native main-building outline under ODbL. Owner dimensional/construction facts used as facts. No source prose, photos, stamp/drawing/figure pixels, textures or borrowed meshes incorporated. Qualla searched first; conflicted and uncertain imagery unused and metadata unchanged. Full main building, explicit vertical/profile/fitting/finish estimates; no photographic-fidelity or surveyed-ground-contact claim.',
};
