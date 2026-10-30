/** Whole Serpentine Main Dam, enlarged ungated canal and intrinsic control assembly. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  earth: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.98, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  road: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.22 },
  window: { slot: 'window', graph: 'metal_painted', roughness: 0.5, metallic: 0.2 },
};
const colors = {
  earth: rgb('9b927b'),
  concrete: rgb('b9b7a9'),
  road: rgb('82867e'),
  metal: rgb('82968e'),
  window: rgb('394f53'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let a = normalFor(...p);
  if (n && a.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up, holes = []) {
  const t = new MeshBufferBuilder();
  if (
    !t.addCap(
      k,
      'palette:#ffffff',
      r,
      holes,
      typeof y === 'function' ? y : () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid complete dam cap');
  const m = t.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function polygon(o, k, r, y0, y1) {
  const area = r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
    sign = Math.sign(area);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
function block(o, k, c, w, d, y0, y1) {
  polygon(
    o,
    k,
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => [c[0] + (u * w) / 2, c[1] + (v * d) / 2]),
    y0,
    y1,
  );
}
function cylinder(o, k, c, r, y0, y1, n) {
  polygon(
    o,
    k,
    Array.from({ length: n }, (_, i) => [
      c[0] + r * Math.cos((i * 2 * Math.PI) / n),
      c[1] + r * Math.sin((i * 2 * Math.PI) / n),
    ]),
    y0,
    y1,
  );
}
const pathNormals = (r) =>
  r.map((_, i) => {
    const a = r[Math.max(0, i - 1)],
      b = r[Math.min(r.length - 1, i + 1)],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  });
const pathCum = (r) => {
  const result = [0];
  for (let i = 1; i < r.length; i++)
    result.push(result.at(-1) + Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]));
  return result;
};
export const mainCrest = P.nativeCrest.slice(0, -1),
  crestCum = pathCum(mainCrest),
  crestNormals = pathNormals(mainCrest);
export function projectCrest(p) {
  let best = { distance: Infinity };
  for (let i = 1; i < mainCrest.length; i++) {
    const a = mainCrest[i - 1],
      b = mainCrest[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz),
      t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (l * l))),
      q = [a[0] + t * dx, a[1] + t * dz],
      distance = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (distance < best.distance) best = { distance, station: crestCum[i - 1] + t * l, point: q };
  }
  return best;
}
export function toeY(p) {
  const s = projectCrest(p).station,
    L = crestCum.at(-1),
    phase = Math.max(0, Math.sin((Math.PI * s) / L));
  return P.dam.crestY - P.dam.height * Math.pow(phase, 0.6);
}
function clip(r, sign) {
  const a = P.nativeCanal[0],
    b = P.nativeCanal[1],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    n = [-dz / len, dx / len],
    distance = (p) => ((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]) * sign - P.canal.width / 2,
    out = [];
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length],
      A = distance(p),
      B = distance(q);
    if (A >= -1e-8) out.push(p);
    if (A >= 0 !== B >= 0) {
      const t = A / (A - B);
      out.push(p.map((v, k) => v + t * (q[k] - v)));
    }
  }
  return out;
}
export const mainRing = clip(P.nativeDamRing, -1),
  spillwayBankRing = clip(P.nativeDamRing, 1),
  crownRing = [
    ...mainCrest.map((p, i) => p.map((v, k) => v + (crestNormals[i][k] * P.dam.crownWidth) / 2)),
    ...mainCrest
      .map((p, i) => p.map((v, k) => v - (crestNormals[i][k] * P.dam.crownWidth) / 2))
      .reverse(),
  ];
function earthfill(o, lod) {
  for (const [ring, holes] of [
    [mainRing, [crownRing]],
    [spillwayBankRing, []],
  ]) {
    if (ring.length < 3) continue;
    const top = (p) => {
      if (crownRing.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.001)) return P.dam.crestY;
      return toeY(p);
    };
    cap(o, 'earth', ring, top, 1, holes);
    // Close the solid embankment at the originally frozen foundation floor.
    cap(o, 'earth', ring, P.floor, -1);
    const sign = Math.sign(
      ring.reduce((sum, p, i) => {
        const q = ring[(i + 1) % ring.length];
        return sum + p[0] * q[1] - p[1] * q[0];
      }, 0),
    );
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      face(
        o,
        'earth',
        [
          [a[0], P.floor, a[1]],
          [b[0], P.floor, b[1]],
          [b[0], toeY(b), b[1]],
          [a[0], toeY(a), a[1]],
        ],
        [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
      );
    }
  }
  cap(o, 'road', crownRing, P.dam.crestY, 1);
  // Sparse original subdivision seams are estimates, not a stone census.
  if (lod > 1)
    for (let i = 1; i < mainCrest.length; i++) {
      const a = mainCrest[i - 1],
        b = mainCrest[i];
      for (const side of [-1, 1]) {
        const q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          n = crestNormals[i],
          foot = [q[0] + n[0] * side * 35, q[1] + n[1] * side * 35];
        beam(
          o,
          'earth',
          [q[0] + n[0] * side * 5, P.dam.crestY - 0.3, q[1] + n[1] * side * 5],
          [foot[0], toeY(foot) + 12, foot[1]],
          0.22,
          0.22,
          colors.earth,
        );
      }
    }
}
function deck(o, lod) {
  const r = P.nativeCrest,
    ns = pathNormals(r),
    y = P.dam.crestY + 0.14,
    w = P.dam.roadWidth / 2,
    p = (i, s, Y) => [r[i][0] + ns[i][0] * s, Y, r[i][1] + ns[i][1] * s];
  for (let i = 1; i < r.length; i++) {
    for (const side of [-1, 1])
      face(
        o,
        'road',
        [p(i - 1, 0, y), p(i, 0, y), p(i, side * w, y), p(i - 1, side * w, y)],
        [0, 1, 0],
      );
    face(
      o,
      'road',
      [p(i - 1, -w, y - 0.65), p(i, -w, y - 0.65), p(i, w, y - 0.65), p(i - 1, w, y - 0.65)],
      [0, -1, 0],
    );
    for (const side of [-1, 1]) {
      face(
        o,
        'concrete',
        [
          p(i - 1, side * w, y - 0.65),
          p(i, side * w, y - 0.65),
          p(i, side * w, y),
          p(i - 1, side * w, y),
        ],
        [ns[i][0] * side, 0, ns[i][1] * side],
      );
      if (lod) {
        beam(
          o,
          'metal',
          p(i - 1, side * (w + 0.2), y + 1.05),
          p(i, side * (w + 0.2), y + 1.05),
          0.07,
          0.08,
          colors.metal,
        );
        const l = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]),
          n = Math.ceil(l / [1, 24, 12, 6][lod]);
        for (let j = 0; j < n; j++) {
          const t = j / n,
            a = p(i - 1, side * (w + 0.2), y).map(
              (v, k) => v * (1 - t) + p(i, side * (w + 0.2), y)[k] * t,
            );
          beam(o, 'metal', a, [a[0], y + 1.05, a[2]], 0.07, 0.08, colors.metal);
        }
      }
    }
  }
  for (const i of [0, r.length - 1])
    face(
      o,
      'road',
      [p(i, -w, y - 0.65), p(i, w, y - 0.65), p(i, w, y), p(i, -w, y)],
      [i ? 1 : -1, 0, i ? -1 : 1],
    );
  // Intrinsic bridge has bank abutments; the enlarged channel remains open.
  for (const i of [3, 4]) {
    const q = r[i];
    block(o, 'concrete', q, 4, 5, P.canal.headY - 1, P.dam.crestY + 0.1);
  }
}
export const canalFloor = (i) => {
  const s = P.canal.stations[i],
    h = P.canal.headLength;
  return s <= h
    ? P.canal.headY
    : P.canal.headY + ((P.canal.tailY - P.canal.headY) * (s - h)) / (P.canal.stations.at(-1) - h);
};
function spillway(o, lod) {
  const r = P.nativeCanal,
    ns = pathNormals(r),
    L = P.canal.stations.at(-1),
    p = (i, side, Y, outer = 0) => {
      const w =
        (P.canal.width + ((P.canal.downstreamWidth - P.canal.width) * P.canal.stations[i]) / L) /
          2 +
        outer;
      return [r[i][0] + ns[i][0] * side * w, Y, r[i][1] + ns[i][1] * side * w];
    };
  for (let i = 1; i < r.length; i++) {
    const y0 = canalFloor(i - 1),
      y1 = canalFloor(i);
    face(o, 'concrete', [p(i - 1, -1, y0), p(i, -1, y1), p(i, 1, y1), p(i - 1, 1, y0)], [0, 1, 0]);
    face(
      o,
      'concrete',
      [
        p(i - 1, -1, y0 - P.canal.floorThickness),
        p(i - 1, 1, y0 - P.canal.floorThickness),
        p(i, 1, y1 - P.canal.floorThickness),
        p(i, -1, y1 - P.canal.floorThickness),
      ],
      [0, -1, 0],
    );
    for (const side of [-1, 1]) {
      const h = P.canal.wallHeight;
      face(
        o,
        'concrete',
        [
          p(i - 1, side, y0 - P.canal.floorThickness),
          p(i, side, y1 - P.canal.floorThickness),
          p(i, side, y1 + h),
          p(i - 1, side, y0 + h),
        ],
        [-side * ns[i][0], 0, -side * ns[i][1]],
      );
      face(
        o,
        'concrete',
        [
          p(i - 1, side, y0 + h),
          p(i, side, y1 + h),
          p(i, side, y1 + h, P.canal.wallThickness),
          p(i - 1, side, y0 + h, P.canal.wallThickness),
        ],
        [0, 1, 0],
      );
      face(
        o,
        'concrete',
        [
          p(i - 1, side, y0 - P.canal.floorThickness, P.canal.wallThickness),
          p(i - 1, side, y0 + h, P.canal.wallThickness),
          p(i, side, y1 + h, P.canal.wallThickness),
          p(i, side, y1 - P.canal.floorThickness, P.canal.wallThickness),
        ],
        [side * ns[i][0], 0, side * ns[i][1]],
      );
    }
    if (lod > 1) {
      const mid = r[i].map((v, k) => (v + r[i - 1][k]) / 2),
        y = (y0 + y1) / 2;
      beam(
        o,
        'road',
        [
          mid[0] + ns[i][0] * P.canal.width * 0.35,
          y + 0.02,
          mid[1] + ns[i][1] * P.canal.width * 0.35,
        ],
        [
          mid[0] - ns[i][0] * P.canal.width * 0.35,
          y + 0.02,
          mid[1] - ns[i][1] * P.canal.width * 0.35,
        ],
        0.1,
        0.025,
        colors.road,
      );
    }
  }
}
function control(o, lod) {
  const T = P.tower,
    c = T.location,
    n = [8, 12, 24, 36][lod];
  cylinder(o, 'concrete', c, T.radius, T.shaftBottom, T.shaftTop, n);
  cylinder(o, 'concrete', c, T.radius + 0.5, T.shaftTop - 0.4, T.shaftTop + 0.15, n);
  block(o, 'concrete', c, T.cabinWidth, T.cabinDepth, T.cabinFloor, T.cabinWallTop);
  const roof = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => [
      c[0] + x * (T.cabinWidth / 2 + 0.45),
      T.cabinWallTop,
      c[1] + z * (T.cabinDepth / 2 + 0.45),
    ]),
    apex = [c[0], T.roofTop, c[1]];
  for (let i = 0; i < 4; i++) face(o, 'metal', [roof[i], roof[(i + 1) % 4], apex], [0, 1, 0]);
  if (lod)
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? -1 : 1,
        axis = i < 2 ? 0 : 2,
        other = axis === 0 ? 2 : 0,
        a = [c[0], T.cabinFloor + 1, c[1]],
        b = [...a];
      a[axis] += side * (T.cabinWidth / 2 + 0.02);
      b[axis] = a[axis];
      a[other] -= 1.8;
      b[other] += 1.8;
      const hi = 1.6;
      face(
        o,
        'window',
        [a, b, [b[0], b[1] + hi, b[2]], [a[0], a[1] + hi, a[2]]],
        [axis === 0 ? side : 0, 0, axis === 2 ? side : 0],
      );
    }
  const q = projectCrest(c).point,
    y = T.bridgeFloor,
    dx = c[0] - q[0],
    dz = c[1] - q[1],
    l = Math.hypot(dx, dz),
    U = [dx / l, dz / l],
    N = [-U[1], U[0]],
    start = [q[0], y, q[1]],
    end = [c[0], y, c[1]];
  beam(o, 'concrete', start, end, T.bridgeWidth, 0.45, colors.concrete);
  for (const side of [-1, 1])
    if (lod) {
      const a = [
          q[0] + (N[0] * side * T.bridgeWidth) / 2,
          y + 1.1,
          q[1] + (N[1] * side * T.bridgeWidth) / 2,
        ],
        b = [
          c[0] + (N[0] * side * T.bridgeWidth) / 2,
          y + 1.1,
          c[1] + (N[1] * side * T.bridgeWidth) / 2,
        ];
      beam(o, 'metal', a, b, 0.06, 0.07, colors.metal);
      const count = Math.ceil(l / [1, 12, 6, 3][lod]);
      for (let i = 0; i < count; i++) {
        const t = i / count,
          p = a.map((v, k) => v * (1 - t) + b[k] * t);
        beam(o, 'metal', [p[0], y, p[2]], p, 0.06, 0.07, colors.metal);
      }
    }
  const O = P.outlet,
    v = O.location;
  block(o, 'concrete', v, O.width + 2, 5, O.floor - 1, O.floor + O.height + 1);
  face(
    o,
    'window',
    [
      [v[0] - O.width / 2, O.floor, v[1] - 2.51],
      [v[0] + O.width / 2, O.floor, v[1] - 2.51],
      [v[0] + O.width / 2, O.floor + O.height, v[1] - 2.51],
      [v[0] - O.width / 2, O.floor + O.height, v[1] - 2.51],
    ],
    [0, 0, -1],
  );
  if (lod > 1)
    for (let j = 0; j < 6; j++)
      beam(
        o,
        'metal',
        [v[0] - 2.5 + j, O.floor, v[1] - 2.54],
        [v[0] - 2.5 + j, O.floor + O.height, v[1] - 2.54],
        0.09,
        0.1,
        colors.metal,
      );
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  earthfill(o, lod);
  componentEvidence.push(
    'whole-main-rolled-earth-embankment-original23control-plan-and-fiftyfive-metre-section',
  );
  deck(o, lod);
  componentEvidence.push('all-five-original-crest-road-controls-and-intrinsic-spillway-bridge');
  spillway(o, lod);
  componentEvidence.push('whole-ten-control-post2001-enlarged-ungated-spillway-canal');
  control(o, lod);
  componentEvidence.push(
    'whole-estimated-control-tower-and-access-bridge-registered-to-original-upstream-conduit-endpoint',
  );
  componentEvidence.push(
    'original-downstream-conduit-outlet-separate-pipehead-and-visitor-buildings-excluded',
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qd/qd4/serpentine_dam_western_australia',
  camera = [620, 430, 690],
  look = [-30, 0, 10];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Serpentine Main Dam — Western Australia',
  wikidataId: 'Q7455118',
  cell: 'qd/qd4',
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
  portableGroundY: P.floor - 0.02,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 20000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_basalt_raw', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'whole-main-dam-crest-bridge-and-enlarged-spillway', position: camera, lookAt: look },
    {
      name: 'whole-downstream-embankment-and-spillway',
      position: [-570, 310, -640],
      lookAt: [-45, -5, -40],
    },
    { name: 'whole-control-tower-intake-and-access', position: [85, 90, 155], lookAt: [2, 3, 45] },
    {
      name: 'full-post2001-enlarged-ungated-canal',
      position: [210, 280, -380],
      lookAt: [-50, -5, -130],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-serpentine-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural whole main dam/crest/spillway/control assembly under repository license. Exact original native map data ODbL; government and heritage construction facts text only. All imagery/figures/architectural plans unused after Qualla-first search. Tower geometry/registration, sections/floors/finish/grade explicit estimates. Original provider field including severe low void unchanged. No photographic, surveyed alignment or current-world replacement approval.',
};
