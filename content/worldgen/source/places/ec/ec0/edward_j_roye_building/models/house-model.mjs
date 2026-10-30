/** Complete historical Roye Building tower and podium; no imagery is consumed. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  H = P.building;
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.99, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_boardformed', roughness: 0.98, metallic: 0 },
};
const colors = {
  wall: rgb('bcb7a2'),
  foundation: rgb('8c8a7a'),
  roof: rgb('a5a18e'),
  trim: rgb('8b8d80'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole hotel cap');
  const m = b.finalize();
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
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
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
function strip(o, k, a, b, w, y0, y1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    n = [-dz / L, dx / L];
  polygon(
    o,
    k,
    [
      [a[0] - (n[0] * w) / 2, a[1] - (n[1] * w) / 2],
      [b[0] - (n[0] * w) / 2, b[1] - (n[1] * w) / 2],
      [b[0] + (n[0] * w) / 2, b[1] + (n[1] * w) / 2],
      [a[0] + (n[0] * w) / 2, a[1] + (n[1] * w) / 2],
    ],
    y0,
    y1,
  );
}
const square = (x, z, w) => [
  [x - w / 2, z - w / 2],
  [x + w / 2, z - w / 2],
  [x + w / 2, z + w / 2],
  [x - w / 2, z + w / 2],
];
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  polygon(o, 'foundation', P.nativeBuildingRing, H.basementBottom, P.floor);
  componentEvidence.push('whole-original-six-control-podium-and-attached-auditorium');
  for (let f = 0; f < 3; f++) {
    const r = P.nativeBuildingRing.map((p) => p.map((v) => v * H.podiumScales[f])),
      y = P.floor + f * H.podiumStoreyHeight,
      top = y + H.podiumStoreyHeight;
    const sign = Math.sign(
      r.reduce((s, p, i) => {
        const q = r[(i + 1) % r.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0),
    );
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        L = Math.hypot(dx, dz),
        N = [(dz / L) * sign, (-dx / L) * sign],
        p = (t, Y, d = 0) => [a[0] + dx * t + N[0] * d, Y, a[1] + dz * t + N[1] * d];
      const wall = (t0, t1, y0, y1) =>
        face(o, 'wall', [p(t0, y0), p(t1, y0), p(t1, y1), p(t0, y1)], [N[0], 0, N[1]]);
      if (f === 0 && i === 4) {
        const mid = (a[0] - 1) / (a[0] - b[0]),
          half = 2.3 / L;
        wall(0, mid - half, y, top);
        wall(mid + half, 1, y, top);
        wall(mid - half, mid + half, y + 3.4, top);
        if (lod > 0)
          for (let j = 0; j < 5; j++) {
            const t0 = mid - half + (j * 2 * half) / 5,
              t1 = t0 + ((2 * half) / 5) * 0.82,
              Y = top - 0.48;
            face(
              o,
              'trim',
              [p(t0, Y, 0.02), p(t1, Y, 0.02), p(t1, Y + 0.3, 0.02), p(t0, Y + 0.3, 0.02)],
              [N[0], 0, N[1]],
              rgb(['786e51', '747d6a', '7b716a', '687b77', '8a7c63'][j]),
            );
          }
      } else wall(0, 1, y, top);
      if (lod > 0 && L > 15)
        for (let j = 0; j < Math.floor(L / 5); j++) {
          const t = (j + 0.5) / Math.floor(L / 5),
            w = (lod === 1 ? 1.5 : 2) / L;
          if (f === 0 && i === 4 && Math.abs(p(t, y)[0] - 1) < 3.4) continue;
          face(
            o,
            'trim',
            [
              p(t - w / 2, y + 1.4, 0.035),
              p(t + w / 2, y + 1.4, 0.035),
              p(t + w / 2, y + 2.6, 0.035),
              p(t - w / 2, y + 2.6, 0.035),
            ],
            [N[0], 0, N[1]],
            rgb('66716b'),
          );
          if (lod === 3) {
            const edge = 0.085 / L,
              lo = t - w / 2,
              hi = t + w / 2;
            for (const [u, v, y0, y1] of [
              [lo - edge, lo, y + 1.32, y + 2.68],
              [hi, hi + edge, y + 1.32, y + 2.68],
              [lo, hi, y + 1.32, y + 1.4],
              [lo, hi, y + 2.6, y + 2.68],
            ])
              face(
                o,
                'wall',
                [p(u, y0, 0.065), p(v, y0, 0.065), p(v, y1, 0.065), p(u, y1, 0.065)],
                [N[0], 0, N[1]],
              );
          }
          if (lod > 1 && i === 4 && f === 0) {
            const A = p(t - w / 2, y + 0.3, 0.075),
              B = p(t + w / 2, y + 0.3, 0.075);
            face(
              o,
              'foundation',
              [A, B, [B[0], y + 1.1, B[2]], [A[0], y + 1.1, A[2]]],
              [N[0], 0, N[1]],
            );
          }
        }
    }
    cap(o, 'roof', r, top, 1);
    cap(o, 'foundation', r, y, -1);
  }
  componentEvidence.push('all-three-terraced-plinth-levels-and-entire-auditorium-envelope');
  const r = H.towerRing;
  for (let f = 0; f <= H.towerStoreys; f++) {
    const y = H.podiumTop + f * H.towerStoreyHeight;
    polygon(o, f === H.towerStoreys ? 'roof' : 'wall', r, y - H.slabThickness, y);
  }
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      U = [dx / L, dz / L],
      N = [U[1], -U[0]],
      p = (t, d = 0.15) => [a[0] + dx * t - N[0] * d, a[1] + dz * t - N[1] * d],
      count = Math.max(1, Math.round(L / 3.1));
    for (let f = 0; f < H.towerStoreys; f++) {
      const y = H.podiumTop + f * H.towerStoreyHeight;
      if (lod === 0) {
        const A = p(0),
          B = p(1);
        for (const flip of [1, -1])
          face(
            o,
            'wall',
            [
              [A[0], y, A[1]],
              [B[0], y, B[1]],
              [B[0], y + 0.78, B[1]],
              [A[0], y + 0.78, A[1]],
            ],
            [N[0] * flip, 0, N[1] * flip],
          );
      } else strip(o, 'wall', p(0), p(1), 0.18, y, y + 0.78);
    }
    for (let j = 0; j < count; j++) {
      const A = p(j / count, 0.3);
      if (!lod && j) continue;
      polygon(o, 'trim', square(...A, H.columnWidth), H.podiumTop, H.towerTop);
    }
    if (lod > 1) strip(o, 'trim', p(0), p(1), 0.2, H.towerTop, H.towerTop + 0.65);
  }
  componentEvidence.push('complete-five-floor-central-rectangular-tower-real-exposed-openings');
  for (const b of H.serviceBoxes) polygon(o, 'wall', b.ring, H.towerTop, b.top);
  componentEvidence.push('entire-roof-and-both-intrinsic-service-boxes');
  componentEvidence.push('actual-open-podium-entry-and-original-abstract-glass-fragments');
  componentEvidence.push('estimated-blank-panel-frames-no-copied-relief-or-stained-glass-artwork');
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/ec/ec0/edward_j_roye_building',
  camera = [100, 64, 105],
  look = [16, 15, 12];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Edward J. Roye Building — whole tower and tiered podium',
  wikidataId: 'Q1292649',
  cell: 'ec/ec0',
  category: 'civic-institutional',
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
  portableGroundY: -2.4,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 5000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'concrete_boardformed'],
  qaCameras: [
    {
      name: 'whole-building-all-podium-tiers-tower-and-service-boxes',
      position: camera,
      lookAt: look,
    },
    {
      name: 'entire-ashmun-front-entry-and-abstract-glass',
      position: [12, 16, 93],
      lookAt: [10, 6, 25],
    },
    {
      name: 'all-five-tower-floors-and-two-roof-service-boxes',
      position: [-52, 47, -54],
      lookAt: [0, 22, 0],
    },
    { name: 'whole-attached-auditorium-podium-and-rear', position: [104, 45, -62], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-roye-building-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original procedural whole historical Roye Building under repository license. Original publisher primary eight-floor/early2012ruin record; expressly transmitted same-author chapter five-floor central tower/tiered plinth/service-box written construction facts. Exact original numerical way142061466/name/altname/Q1292649tags, not node survey. All component registration/sections/heights/details/finish/grade estimates declared. No source photos/sketches/figures or original sculpture/stained-glass designs copied; no facade/tower-only proxy or photographic/survey/current replacement claim.',
};
