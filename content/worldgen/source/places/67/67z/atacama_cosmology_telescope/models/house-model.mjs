/** Whole ACT instrument and both screens; primary numerical off-axis conic optics, no imagery. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
  torus,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  screen: { slot: 'wall', graph: 'metal_painted', roughness: 0.71, metallic: 0.28 },
  mirror: { slot: 'roof', graph: 'metal_painted', roughness: 0.24, metallic: 0.72 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.35 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
const colors = {
  screen: rgb('e0e3df'),
  mirror: rgb('b9c8cf'),
  frame: rgb('68757c'),
  base: rgb('a4a39b'),
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
function shell(o, k, a, b) {
  const c = a[0].map((_, i) => a.reduce((s, p) => s + p[i], 0) / a.length);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    face(
      o,
      k,
      [a[i], a[j], b[j], b[i]],
      [(a[i][0] + a[j][0]) / 2 - c[0], 0, (a[i][2] + a[j][2]) / 2 - c[2]],
    );
  }
  face(o, k, a, [0, -1, 0]);
  face(o, k, b, [0, 1, 0]);
}
function box(o, k, x, z, w, d, y0, y1) {
  const r = (y) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => [x + (u * w) / 2, y, z + (v * d) / 2]);
  shell(o, k, r(y0), r(y1));
}
function tube(o, k, x, z, r, y0, y1, n) {
  const ring = (y) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
    });
  shell(o, k, ring(y0), ring(y1));
}
export function mirrorSag(p, x, y) {
  const r = x * x + y * y;
  return p.vertex + r / p.R / (1 + Math.sqrt(1 - ((1 + p.K) * r) / (p.R * p.R)));
}
export function opticalPoint(x, y, z) {
  const a = (P.instrument.staticElevationDegrees * Math.PI) / 180;
  return [
    x,
    P.instrument.opticalTranslationY + y * Math.cos(a) - z * Math.sin(a),
    y * Math.sin(a) + z * Math.cos(a),
  ];
}
export const mirrorPoint = (p, r, a) => {
  const x = p.apertureA * r * Math.cos(a),
    y = p.y0 + p.apertureB * r * Math.sin(a);
  return opticalPoint(x, y, mirrorSag(p, x, y));
};
function optic(o, p, lod) {
  const n = [12, 20, 36, 56][lod],
    rows = [2, 4, 8, 14][lod],
    point = (r, a, back = false) => {
      const q = mirrorPoint(p, r, a);
      if (back) q[1] -= 0.1;
      return q;
    };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const r0 = j / rows,
        r1 = (j + 1) / rows,
        a0 = (i * 2 * Math.PI) / n,
        a1 = ((i + 1) * 2 * Math.PI) / n;
      for (const back of [false, true]) {
        const ps = j
          ? [point(r0, a0, back), point(r1, a0, back), point(r1, a1, back), point(r0, a1, back)]
          : [point(0, 0, back), point(r1, a0, back), point(r1, a1, back)];
        face(o, back ? 'frame' : 'mirror', ps, [0, back ? -1 : 1, 0]);
      }
      if (j === rows - 1) {
        const q = [point(1, a0), point(1, a1), point(1, a1, true), point(1, a0, true)],
          m = point(1, (a0 + a1) / 2);
        face(o, 'frame', q, [m[0], 0, m[2]]);
      }
    }
  if (lod > 1) {
    for (let i = 0; i < n; i += lod === 3 ? 2 : 3) {
      const a = (i * 2 * Math.PI) / n;
      for (let j = 1; j <= rows; j++) {
        const q0 = point((j - 1) / rows, a),
          q1 = point(j / rows, a);
        q0[1] += 0.012;
        q1[1] += 0.012;
        beam(o, 'mirror', q0, q1, 0.012, 0.016, colors.mirror);
      }
    }
  }
}
function guardRing(o, lod) {
  const p = P.optics.primary,
    n = [12, 20, 36, 56][lod];
  for (let i = 0; i < n; i++) {
    const a0 = (i * 2 * Math.PI) / n,
      a1 = ((i + 1) * 2 * Math.PI) / n,
      point = (a, r) => {
        const x = r * Math.cos(a),
          y = p.y0 + r * Math.sin(a);
        return opticalPoint(x, y, mirrorSag(p, x, y));
      },
      q = [point(a0, 3), point(a1, 3), point(a1, 3.5), point(a0, 3.5)];
    face(o, 'screen', q, [0, 1, 0]);
    face(o, 'screen', [...q].reverse(), [0, -1, 0]);
  }
}
function enclosure(o, lod) {
  const r = P.nativeScreenRing,
    lower = r.map((p, i) => [
      p[0] * P.screen.lowerScale,
      P.screen.originalBottomElevations[i] - 0.15,
      p[1] * P.screen.lowerScale,
    ]),
    upper = r.map((p) => [p[0], P.screen.top, p[1]]),
    th = P.screen.panelThickness;
  for (let i = 0; i < r.length; i++) {
    let j = (i + 1) % r.length,
      a = lower[i],
      b = lower[j],
      c = upper[j],
      d = upper[i],
      dx = c[0] - d[0],
      dz = c[2] - d[2],
      len = Math.hypot(dx, dz),
      n = [dz / len, 0, -dx / len],
      mid = [(c[0] + d[0]) / 2, 0, (c[2] + d[2]) / 2];
    if (n[0] * mid[0] + n[2] * mid[2] < 0) n = n.map((v) => -v);
    const ins = (p) => p.map((v, k) => v - n[k] * th);
    face(o, 'screen', [a, b, c, d], n);
    face(
      o,
      'screen',
      [ins(a), ins(d), ins(c), ins(b)],
      n.map((v) => -v),
    );
    face(o, 'screen', [d, c, ins(c), ins(d)], [0, 1, 0]);
    face(o, 'screen', [a, ins(a), ins(b), b], [0, -1, 0]);
    beam(
      o,
      'frame',
      a.map((v, k) => (k === 1 ? Math.min(-3.5, v - 2.5) : v)),
      d,
      0.17,
      0.17,
      colors.frame,
    );
    if (lod) {
      beam(o, 'frame', d, c, 0.17, 0.17, colors.frame);
      const div = [1, 3, 6, 10][lod];
      for (let q = 1; q < div; q++) {
        const t = q / div,
          m = a.map((v, k) => v * (1 - t) + b[k] * t),
          h = d.map((v, k) => v * (1 - t) + c[k] * t);
        beam(o, 'frame', m, h, 0.065, 0.08, colors.frame);
      }
      if (lod > 1) {
        for (let q = 0; q < div; q++) {
          const t0 = q / div,
            t1 = (q + 1) / div,
            L = a.map((v, k) => v * (1 - t0) + b[k] * t0),
            H = d.map((v, k) => v * (1 - t1) + c[k] * t1);
          beam(o, 'frame', L, H, 0.065, 0.065, colors.frame);
        }
      }
    }
  }
}
function innerScreen(o) {
  const a = mirrorPoint(P.optics.primary, 1, 0),
    b = mirrorPoint(P.optics.primary, 1, Math.PI),
    c = mirrorPoint(P.optics.secondary, 1, Math.PI),
    d = mirrorPoint(P.optics.secondary, 1, 0);
  for (const [A, B] of [
    [a, d],
    [b, c],
  ]) {
    const C = [B[0], B[1] - 1.9, B[2]],
      D = [A[0], A[1] - 3.8, A[2]],
      n = [Math.sign(A[0]), 0, 0];
    face(o, 'screen', [A, B, C, D], n);
    face(
      o,
      'screen',
      [D, C, B, A],
      n.map((v) => -v),
    );
    beam(o, 'screen', A, B, 0.16, 0.18, colors.screen);
    beam(o, 'frame', D, C, 0.12, 0.14, colors.frame);
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  enclosure(o, lod);
  componentEvidence.push('complete-original-eight-control-thirteen-metre-stationary-ground-screen');
  const M = P.mount,
    C = P.receiverCabin;
  box(o, 'base', 0, 0, P.pad.halfWidth * 2, P.pad.halfDepth * 2, P.pad.bottom, P.floor);
  tube(o, 'base', 0, 0, M.pedestalRadius, P.floor, M.pedestalTop, [8, 12, 20, 32][lod]);
  tube(
    o,
    'frame',
    0,
    0,
    M.rotationRingRadius,
    M.rotationRingY - 0.24,
    M.rotationRingY + 0.12,
    [8, 12, 20, 32][lod],
  );
  for (const s of [-1, 1]) {
    box(o, 'frame', s * M.sideX, 0, 0.45, 1.0, M.rotationRingY, M.bearingY);
    beam(
      o,
      'frame',
      [s * M.sideX, M.rotationRingY, 2.9],
      [s * M.sideX, M.bearingY, -0.5],
      0.3,
      0.35,
      colors.frame,
    );
  }
  componentEvidence.push('whole-concrete-instrument-pad-pedestal-rotating-mount-and-bearings');
  box(
    o,
    'screen',
    C.center[0],
    C.center[2],
    C.width,
    C.depth,
    C.center[1] - C.height / 2,
    C.center[1] + C.height / 2,
  );
  if (lod) {
    box(
      o,
      'frame',
      0,
      C.center[2] + C.depth / 2 + 0.035,
      1.2,
      0.06,
      C.center[1] - C.height / 2 + 0.05,
      C.center[1] - C.height / 2 + 2.1,
    );
    box(
      o,
      'screen',
      0,
      C.center[2],
      C.width + 0.16,
      C.depth + 0.16,
      C.center[1] + C.height / 2,
      C.center[1] + C.height / 2 + 0.14,
    );
    for (const s of [-1, 1])
      beam(
        o,
        'frame',
        [s * 1.4, M.rotationRingY, 1.6],
        [s * 1.4, C.center[1] - C.height / 2, 1.2],
        0.19,
        0.2,
        colors.frame,
      );
  }
  componentEvidence.push('complete-three-point-three-metre-wide-climate-controlled-receiver-cabin');
  optic(o, P.optics.primary, lod);
  guardRing(o, lod);
  optic(o, P.optics.secondary, lod);
  componentEvidence.push('both-whole-off-axis-ellipsoidal-mirror-patches-and-primary-guard-ring');
  const bottom = mirrorPoint(P.optics.primary, 0.65, Math.PI * 1.5),
    secondary = mirrorPoint(P.optics.secondary, 0, 0);
  for (const s of [-1, 1]) {
    beam(
      o,
      'frame',
      [s * M.sideX, M.bearingY, 0],
      [s * 2, bottom[1] - 0.22, bottom[2]],
      0.18,
      0.2,
      colors.frame,
    );
    beam(
      o,
      'frame',
      [s * M.sideX, M.bearingY, -0.5],
      [s * 0.75, secondary[1] - 0.15, secondary[2]],
      0.19,
      0.22,
      colors.frame,
    );
  }
  innerScreen(o);
  componentEvidence.push('whole-co-moving-inner-ground-screen-sides-and-instrument-supports');
  if (lod) {
    const steps = lod === 1 ? 8 : 12;
    for (let i = 0; i < steps; i++)
      box(
        o,
        'base',
        0,
        C.center[2] + C.depth / 2 + i * 0.3,
        1.15,
        0.32,
        P.floor,
        P.floor + ((steps - i) / steps) * (C.center[1] - C.height / 2 - P.floor),
      );
    if (lod > 1) {
      for (const s of [-1, 1])
        beam(
          o,
          'frame',
          [s * 1.7, C.center[1] - 0.2, C.center[2] + 2.8],
          [s * 1.7, C.center[1] - 0.2, C.center[2] - 2.8],
          0.055,
          0.055,
          colors.frame,
        );
      torus(
        o,
        'frame',
        [0, M.rotationRingY + 0.16, 0],
        M.rotationRingRadius,
        0.065,
        colors.frame,
        [0, 0, 32, 48][lod],
        6,
      );
    }
  }
  componentEvidence.push('bounded-estimated-service-access-steps-and-fittings');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/67/67z/atacama_cosmology_telescope',
  camera = [47, 37, 49],
  look = [0, 5, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Atacama Cosmology Telescope — Cerro Toco',
  wikidataId: 'Q753067',
  cell: '67/67z',
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
  portableGroundY: -1.21,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    {
      name: 'whole-original-enclosure-and-complete-gregorian-instrument',
      position: camera,
      lookAt: look,
    },
    {
      name: 'whole-open-screen-and-both-mirrors-from-above',
      position: [18, 39, 23],
      lookAt: [0, 6, 0],
    },
    {
      name: 'off-axis-mirrors-inner-screens-receiver-and-mount',
      position: [8, 13, 13],
      lookAt: [0, 7, 0],
    },
    {
      name: 'whole-rear-ground-screen-and-native-eight-control-envelope',
      position: [-43, 33, -48],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-act-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.25,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural full instrument/enclosure geometry under repository license; exact native eight-control ACT enclosure under ODbL. Primary numerical/descriptive instrument and optical-design facts only. No source figures, drawings, photos, texture pixels or borrowed meshes; NASA hosting does not imply public-domain source figures. Qualla first, every image unused/unrepaired. Pose, vertical screen profile/assembly/support/cabin/finish estimates explicit, no photographic/survey/metrological fidelity.',
};
