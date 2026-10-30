/** Whole engineered embankment and connected stepped spillway, from primary facts. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  turf: { slot: 'wall', localRef: 'palette:#82906b', roughness: 0.98, metallic: 0 },
  rock: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.97, metallic: 0 },
  masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96, metallic: 0, doubleSided: true },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.18 },
  road: { slot: 'roof', localRef: 'palette:#646a64', roughness: 0.95, metallic: 0 },
};
const colors = {
  turf: rgb('82906b'),
  rock: rgb('9a9d90'),
  masonry: rgb('aaa89b'),
  concrete: rgb('b2b1a8'),
  metal: rgb('68726a'),
  road: rgb('646a64'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  for (let i = 1; i < p.length - 1; i++) {
    let a = [p[0], p[i], p[i + 1]],
      normal = normalFor(...a);
    if (Math.hypot(...normal) < 0.5) continue;
    if (n && normal.reduce((s, v, j) => s + v * n[j], 0) < 0) {
      a = [a[0], a[2], a[1]];
      normal = normalFor(...a);
    }
    o.addTriangle(
      k,
      'palette:#ffffff',
      a,
      normal,
      a.map((q) => [q[0], q[2]]),
      tint,
    );
  }
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  pos = (p, y) => [p[0], y, p[1]],
  offset = (s, w, y = P.dam.crestY) => [
    s.center[0] + s.normal[0] * w,
    y,
    s.center[1] + s.normal[1] * w,
  ];
function box(o, k, x, z, y0, y1, w, d) {
  const a = [
      [x - w / 2, y0, z - d / 2],
      [x + w / 2, y0, z - d / 2],
      [x + w / 2, y0, z + d / 2],
      [x - w / 2, y0, z + d / 2],
    ],
    b = a.map((p) => [p[0], y1, p[2]]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      o,
      k,
      [a[i], a[j], b[j], b[i]],
      [(a[i][0] + a[j][0]) / 2 - x, 0, (a[i][2] + a[j][2]) / 2 - z],
    );
  }
  face(o, k, a, [0, -1, 0]);
  face(o, k, b, [0, 1, 0]);
}
function embankment(o, lod) {
  const S = P.sections,
    rows = [1, 2, 5, 10][lod],
    at = (s, side, t) => {
      const a = offset(s, side * 5),
        b = pos(side > 0 ? s.downstream : s.upstream, s.footY);
      return mix(a, b, t);
    };
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i],
      b = S[i + 1];
    for (const side of [-1, 1])
      for (let j = 0; j < rows; j++) {
        const t0 = j / rows,
          t1 = (j + 1) / rows,
          noise = ((i * 31 + j * 13) % 11) / 10,
          tint = (side > 0 ? colors.turf : colors.rock).map((v) => v * (0.95 + noise * 0.1));
        face(
          o,
          side > 0 ? 'turf' : 'rock',
          [at(a, side, t0), at(b, side, t0), at(b, side, t1), at(a, side, t1)],
          [0, 1, 0],
          tint,
        );
      }
    face(o, 'turf', [offset(a, -5), offset(b, -5), offset(b, 5), offset(a, 5)], [0, 1, 0]);
    face(
      o,
      'road',
      [
        offset(a, -2, P.floor + 0.035),
        offset(b, -2, P.floor + 0.035),
        offset(b, 2, P.floor + 0.035),
        offset(a, 2, P.floor + 0.035),
      ],
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const foot = (s) => pos(side > 0 ? s.downstream : s.upstream, s.footY),
        bottom = (s) => pos(side > 0 ? s.downstream : s.upstream, s.foundationY),
        n = a.normal.map((v) => v * side);
      face(o, 'rock', [foot(a), foot(b), bottom(b), bottom(a)], [n[0], 0, n[1]]);
    }
    face(
      o,
      'rock',
      [
        pos(a.upstream, a.foundationY),
        pos(b.upstream, b.foundationY),
        pos(b.downstream, b.foundationY),
        pos(a.downstream, a.foundationY),
      ],
      [0, -1, 0],
    );
    if (lod > 0) {
      for (const side of [-1, 1]) {
        const r = side * 4.8,
          n = [a.normal[0] * side, 0, a.normal[1] * side];
        face(
          o,
          'metal',
          [
            offset(a, r, P.floor + 0.7),
            offset(b, r, P.floor + 0.7),
            offset(b, r, P.floor + 0.78),
            offset(a, r, P.floor + 0.78),
          ],
          n,
        );
        if (lod > 1) {
          const count = Math.max(1, Math.ceil((b.station - a.station) / [1, 1, 7, 3.5][lod]));
          for (let k = 0; k < count; k++) {
            const t = k / count,
              p = mix(offset(a, r), offset(b, r), t);
            box(o, 'metal', p[0], p[2], P.floor, P.floor + 0.77, 0.05, 0.05);
          }
        }
      }
    }
  }
  for (const [end, idx] of [
    [S[0], 0],
    [S.at(-1), S.length - 1],
  ]) {
    const other = S[idx ? idx - 1 : 1],
      u = end.center.map((v, k) => v - other.center[k]);
    face(
      o,
      'rock',
      [
        offset(end, -5),
        offset(end, 5),
        pos(end.downstream, end.footY),
        pos(end.downstream, end.foundationY),
        pos(end.upstream, end.foundationY),
        pos(end.upstream, end.footY),
      ],
      [u[0], 0, u[1]],
    );
  }
  componentEvidence.push('whole-native-land-side-dam-and-estimated-submerged-upstream-closure');
  componentEvidence.push('full-original-crest-and-ten-metre-crown');
  // The narrow concrete core is internal and extends nine metres below the valley datum.
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i],
      b = S[i + 1];
    for (const side of [-1, 1])
      face(
        o,
        'concrete',
        [
          offset(a, side * 0.45, P.floor - 0.2),
          offset(b, side * 0.45, P.floor - 0.2),
          offset(b, side * 0.45, b.foundationY),
          offset(a, side * 0.45, a.foundationY),
        ],
        [a.normal[0] * side, 0, a.normal[1] * side],
      );
    face(
      o,
      'concrete',
      [
        offset(a, -0.45, a.foundationY),
        offset(b, -0.45, b.foundationY),
        offset(b, 0.45, b.foundationY),
        offset(a, 0.45, a.foundationY),
      ],
      [0, -1, 0],
    );
  }
  componentEvidence.push('whole-buried-concrete-core');
}
export function cascadePlan() {
  const A = P.cascade.path,
    cum = [0];
  for (let i = 1; i < A.length; i++)
    cum.push(cum.at(-1) + Math.hypot(...A[i].map((v, k) => v - A[i - 1][k])));
  const length = cum.at(-1),
    cuts = [...new Set([...cum, ...Array.from({ length: 38 }, (_, i) => (length * i) / 37)])].sort(
      (a, b) => a - b,
    ),
    at = (s) => {
      let j = cum.findIndex((v, i) => i && v >= s);
      if (j < 0) j = cum.length - 1;
      const a = A[j - 1],
        u = A[j].map((v, k) => v - a[k]),
        l = cum[j] - cum[j - 1],
        t = (s - cum[j - 1]) / l;
      return { point: a.map((v, k) => v + t * u[k]), normal: [u[1] / l, -u[0] / l] };
    };
  return { length, cuts, at };
}
function cascade(o, lod) {
  const C = P.cascade,
    plan = cascadePlan(),
    crossSection = (s, y) => {
      const q = plan.at(s),
        w = C.topWidth + ((C.bottomWidth - C.topWidth) * s) / plan.length,
        at = (u, h) => [q.point[0] + q.normal[0] * u, h, q.point[1] + q.normal[1] * u];
      return { q, w, at, y };
    },
    flat = (a, b, w0, w1, y0, y1, k) => {
      const N = [b[1] - a[1], 0, -(b[0] - a[0])],
        l = Math.hypot(N[0], N[2]),
        n = N.map((v) => v / l),
        p = (q, w, y) => [q[0] + n[0] * w, y, q[1] + n[2] * w];
      face(o, k, [p(a, -w0, y0), p(b, -w1, y1), p(b, w1, y1), p(a, w0, y0)], [0, 1, 0]);
    };
  for (let i = 0; i < plan.cuts.length - 1; i++) {
    const s0 = plan.cuts[i],
      s1 = plan.cuts[i + 1],
      index = Math.min(36, Math.floor(((s0 + s1) / 2 / plan.length) * 37)),
      floor = C.topY - (C.drop * index) / 36,
      a = crossSection(s0, floor),
      b = crossSection(s1, floor),
      n = a.q.normal;
    face(
      o,
      'masonry',
      [a.at(-a.w / 2, floor), b.at(-b.w / 2, floor), b.at(b.w / 2, floor), a.at(a.w / 2, floor)],
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const aa = (side * a.w) / 2,
        bb = (side * b.w) / 2;
      face(
        o,
        'masonry',
        [
          a.at(aa, floor),
          b.at(bb, floor),
          b.at(bb, floor + C.wallHeight),
          a.at(aa, floor + C.wallHeight),
        ],
        [-n[0] * side, 0, -n[1] * side],
      );
      if (lod > 0) {
        const ao = aa + side * C.wallThickness,
          bo = bb + side * C.wallThickness;
        face(
          o,
          'masonry',
          [
            a.at(ao, floor - C.baseThickness),
            b.at(bo, floor - C.baseThickness),
            b.at(bo, floor + C.wallHeight),
            a.at(ao, floor + C.wallHeight),
          ],
          [n[0] * side, 0, n[1] * side],
        );
        face(
          o,
          'masonry',
          [
            a.at(aa, floor + C.wallHeight),
            b.at(bb, floor + C.wallHeight),
            b.at(bo, floor + C.wallHeight),
            a.at(ao, floor + C.wallHeight),
          ],
          [0, 1, 0],
        );
      }
    }
    if (lod > 0) {
      face(
        o,
        'masonry',
        [
          a.at(-a.w / 2 - C.wallThickness, floor - C.baseThickness),
          b.at(-b.w / 2 - C.wallThickness, floor - C.baseThickness),
          b.at(b.w / 2 + C.wallThickness, floor - C.baseThickness),
          a.at(a.w / 2 + C.wallThickness, floor - C.baseThickness),
        ],
        [0, -1, 0],
      );
    }
    if (i && index !== Math.min(36, Math.floor(((plan.cuts[i - 1] + s0) / 2 / plan.length) * 37))) {
      const prev = C.topY - (C.drop * (index - 1)) / 36;
      face(
        o,
        'masonry',
        [a.at(-a.w / 2, floor), a.at(a.w / 2, floor), a.at(a.w / 2, prev), a.at(-a.w / 2, prev)],
        [n[1], 0, -n[0]],
      );
    }
    if (lod > 1) {
      const h = C.wallHeight,
        divisions = [1, 1, 3, 7][lod];
      for (const side of [-1, 1])
        for (let j = 1; j < divisions; j++) {
          const t = j / divisions,
            aa = side * (a.w / 2 + C.wallThickness + 0.006),
            bb = side * (b.w / 2 + C.wallThickness + 0.006),
            y = floor + h * t;
          face(
            o,
            'masonry',
            [a.at(aa, y), b.at(bb, y), b.at(bb, y + 0.025), a.at(aa, y + 0.025)],
            [n[0] * side, 0, n[1] * side],
            colors.masonry.map((v) => v * 0.76),
          );
        }
    }
  }
  const A = C.intakePath;
  for (let i = 1; i < A.length; i++)
    flat(A[i - 1], A[i], 1.5, 1.5, C.topY + 0.2, C.topY + 0.2, 'concrete');
  componentEvidence.push('all-thirty-seven-stepped-masonry-basin-floors-and-curved-walls');
  componentEvidence.push('native-intake-link-and-complete-cascade-to-stilling-termination');
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  embankment(o, lod);
  cascade(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/u1/u1j/sorpe_dam',
  camera = [670, 370, 620],
  look = [0, -25, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Sorpe Dam — Sundern',
  wikidataId: 'Q32744446',
  cell: 'u1/u1j',
  category: 'dam',
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
  portableGroundY: P.floor - 69 - 0.12,
  mediumFiContext: {
    scale: 1,
    groundY: P.floor - 69 - 0.12,
    far: 7000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_basalt_raw', 'stone_ashlar', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'whole-dam-full-crest-and-connected-cascade', position: camera, lookAt: look },
    {
      name: 'complete-downstream-embankment-and-crown',
      position: [530, 140, -520],
      lookAt: [0, -22, 0],
    },
    { name: 'whole-upstream-riprap-and-original-crest', position: [-570, 180, 470], lookAt: look },
    {
      name: 'entire-thirty-seven-basin-curved-cascade',
      position: [550, 95, 80],
      lookAt: [290, -39, -10],
    },
    {
      name: 'stepped-masonry-channel-and-basin-details',
      position: [350, -13, -45],
      lookAt: [300, -27, -35],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-sorpe-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.4,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.07, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural geometry under repository license, native physical dam/path/cascade controls under ODbL. Primary engineering facts used as facts, all source imagery unused after Qualla-first search. No photographs, diagrams, drawings, borrowed meshes or source text incorporated in model. Submerged/abutment profile, grades, fittings, basin partitions and surface finish explicitly estimated; no photographic-fidelity, survey or precise terrain-registration claim.',
};
