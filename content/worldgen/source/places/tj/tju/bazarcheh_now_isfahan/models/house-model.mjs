/** Entire continuous Bazarcheh Now covered market; original 19-control route, estimated sections. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  R = P.nativeCenterline;
export const surfaces = {
    wall: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
    roof: { slot: 'roof', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
    base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
    trim: { slot: 'trim', graph: 'tile_ceramic', roughness: 0.74, metallic: 0 },
    door: { slot: 'door', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  },
  colors = {
    wall: rgb('b18b5d'),
    roof: rgb('bdab89'),
    base: rgb('a59b82'),
    trim: rgb('718d96'),
    door: rgb('65503b'),
  };
const norm = (p) => {
    const d = Math.hypot(...p);
    return p.map((v) => v / d);
  },
  ts = R.slice(1).map((p, i) => norm([p[0] - R[i][0], p[1] - R[i][1]])),
  ms = R.map((p, i) => {
    const a = ts[Math.max(0, i - 1)],
      b = ts[Math.min(i, ts.length - 1)],
      n = norm([-a[1] - b[1], a[0] + b[0]]),
      factor = n[0] * -b[1] + n[1] * b[0];
    return n.map((v) => v / factor);
  });
export function sectionAt(s) {
  s = Math.min(P.lengthMeters, Math.max(0, s));
  let i = P.distances.findIndex((v) => v >= s) - 1;
  if (i < 0) i = 0;
  if (i >= ts.length) i = ts.length - 1;
  const u = (s - P.distances[i]) / (P.distances[i + 1] - P.distances[i]),
    c = R[i].map((v, k) => v + (R[i + 1][k] - v) * u),
    m = ms[i].map((v, k) => v + (ms[i + 1][k] - v) * u),
    floor = P.floorControls[i] + (P.floorControls[i + 1] - P.floorControls[i]) * u;
  return {
    s,
    c,
    m,
    t: ts[i],
    floor,
    point: (n, y = 0) => [c[0] + m[0] * n, floor + y, c[1] + m[1] * n],
  };
}
const cache = new Map();
function floorAt(p) {
  const key = p.join(',');
  if (cache.has(key)) return cache.get(key);
  let best = Infinity,
    y = 0;
  for (let i = 0; i < ts.length; i++) {
    const a = R[i],
      b = R[i + 1],
      u = Math.min(
        1,
        Math.max(
          0,
          ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) /
            ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2),
        ),
      ),
      q = a.map((v, k) => v + (b[k] - v) * u),
      dd = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
    if (dd < best) {
      best = dd;
      y = P.floorControls[i] + (P.floorControls[i + 1] - P.floorControls[i]) * u;
    }
  }
  cache.set(key, y);
  return y;
}
export const planEdges = R.map((p, i) =>
    [-1, 1].map((side) => [
      p[0] + ms[i][0] * P.halfWidth * side,
      p[1] + ms[i][1] * P.halfWidth * side,
    ]),
  ),
  outer = [...planEdges.map((e) => e[0]), ...planEdges.map((e) => e[1]).reverse()],
  componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let no = normalFor(...p);
  if (n && no.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    no = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, no, (q) => [q[0], q[1]], tint);
}
function cap(o, k, holes, offset, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      outer,
      holes,
      (p) => floorAt(p) + offset,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole covered market cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const points = Array.from(m.indices.slice(i, i + 3)).map((j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    const area = cross(
      points[1].map((v, k) => v - points[0][k]),
      points[2].map((v, k) => v - points[0][k]),
    );
    if (Math.hypot(...area) === 0) continue;
    face(o, k, points, [0, up, 0]);
  }
}
function floorStrip(o, offset, up) {
  for (let i = 0; i < R.length - 1; i++) {
    const a = sectionAt(P.distances[i]),
      b = sectionAt(P.distances[i + 1]);
    face(
      o,
      'base',
      [
        a.point(-P.halfWidth, offset),
        b.point(-P.halfWidth, offset),
        b.point(P.halfWidth, offset),
        a.point(P.halfWidth, offset),
      ],
      [0, up, 0],
    );
  }
}
function longFace(o, k, side, a, b, y0, y1, n = P.halfWidth) {
  const aa = sectionAt(a),
    bb = sectionAt(b);
  face(
    o,
    k,
    [
      aa.point(side * n, y0),
      bb.point(side * n, y0),
      bb.point(side * n, y1),
      aa.point(side * n, y1),
    ],
    [side * aa.m[0], 0, side * aa.m[1]],
  );
}
const arch = (u, w, spring, crown) =>
  spring +
  (crown - spring) * (0.55 * (1 - Math.abs((u * 2) / w)) + 0.45 * Math.cos((Math.PI * u) / w));
const gaps = P.junctions.map((j) => [j.distance - 2, j.distance + 2]),
  wallCuts = [...new Set([0, P.lengthMeters, ...P.distances, ...gaps.flat()])].sort(
    (a, b) => a - b,
  );
function sidePortals(o, lod) {
  for (const j of P.junctions) {
    const a = j.distance - 2,
      b = j.distance + 2,
      N = [2, 3, 5, 7][lod];
    for (const side of [-1, 1])
      for (let i = 0; i < N; i++) {
        const sa = a + ((b - a) * i) / N,
          sb = a + ((b - a) * (i + 1)) / N,
          aa = sectionAt(sa),
          bb = sectionAt(sb),
          ya = arch(sa - j.distance, 4, 3, 4.8),
          yb = arch(sb - j.distance, 4, 3, 4.8);
        face(
          o,
          'wall',
          [
            aa.point(side * P.halfWidth, ya),
            bb.point(side * P.halfWidth, yb),
            bb.point(side * P.halfWidth, P.roofHeight),
            aa.point(side * P.halfWidth, P.roofHeight),
          ],
          [side * aa.m[0], 0, side * aa.m[1]],
        );
        if (lod > 1)
          beam(
            o,
            'trim',
            aa.point(side * (P.halfWidth + 0.03), ya + 0.08),
            bb.point(side * (P.halfWidth + 0.03), yb + 0.08),
            0.15,
            0.14,
            colors.trim,
          );
      }
  }
}
function dome(o, c, lod) {
  const N = [0, 6, 8, 16][lod],
    K = [0, 1, 3, 5][lod],
    limit = Math.acos(P.oculusRadius / P.hallHalfWidth),
    point = (j, i, inner = false) => {
      const t = (limit * j) / K,
        a = (2 * Math.PI * i) / N,
        r = P.hallHalfWidth * Math.cos(t),
        p = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
      return [
        p[0],
        floorAt(p) + P.roofHeight + P.vaultRise * Math.sin(t) - (inner ? 0.12 : 0),
        p[1],
      ];
    };
  for (let j = 0; j < K; j++)
    for (let i = 0; i < N; i++) {
      const p = [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)],
        n = [(p[0][0] + p[2][0]) / 2 - c[0], 1, (p[0][2] + p[2][2]) / 2 - c[1]];
      face(o, 'roof', p, n);
      if (lod === 3)
        face(
          o,
          'wall',
          [
            point(j, i, true),
            point(j + 1, i, true),
            point(j + 1, i + 1, true),
            point(j, i + 1, true),
          ],
          n.map((v) => -v),
        );
    }
  for (let i = 0; i < N; i++)
    face(
      o,
      'base',
      [point(K, i), point(K, i + 1), point(K, i + 1, true), point(K, i, true)],
      [0, 1, 0],
    );
}
function continuousFarVault(o) {
  const count = 6;
  for (let j = 0; j < R.length - 1; j++)
    for (let i = 0; i < count; i++) {
      const a = sectionAt(P.distances[j]),
        b = sectionAt(P.distances[j + 1]),
        n = -P.hallHalfWidth + (2 * P.hallHalfWidth * i) / count,
        nn = -P.hallHalfWidth + (2 * P.hallHalfWidth * (i + 1)) / count,
        y = P.roofHeight + P.vaultRise * Math.cos((Math.PI * n) / (2 * P.hallHalfWidth)),
        yy = P.roofHeight + P.vaultRise * Math.cos((Math.PI * nn) / (2 * P.hallHalfWidth));
      face(o, 'roof', [a.point(n, y), b.point(n, y), b.point(nn, yy), a.point(nn, yy)], [0, 1, 0]);
    }
}
export const bayCentres = Array.from(
  { length: P.bayCount },
  (_, i) => sectionAt((P.lengthMeters * (i + 0.5)) / P.bayCount).c,
);
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  cache.clear();
  for (const [i, pair] of planEdges.entries())
    for (const p of pair) cache.set(p.join(','), P.floorControls[i]);
  const N = [0, 6, 8, 16][lod],
    holes = lod
      ? bayCentres.map((c) =>
          Array.from({ length: N }, (_, i) => [
            c[0] + P.hallHalfWidth * Math.cos((2 * Math.PI * i) / N),
            c[1] + P.hallHalfWidth * Math.sin((2 * Math.PI * i) / N),
          ]),
        )
      : [];
  floorStrip(o, -P.foundationDepth, -1);
  floorStrip(o, 0, 1);
  cap(o, 'roof', holes, P.roofHeight, 1);
  for (const side of [-1, 1]) {
    for (let i = 0; i < P.distances.length - 1; i++)
      longFace(o, 'base', side, P.distances[i], P.distances[i + 1], -P.foundationDepth, 0);
    for (let i = 0; i < wallCuts.length - 1; i++) {
      const a = wallCuts[i],
        b = wallCuts[i + 1];
      if (gaps.some(([lo, hi]) => (a + b) / 2 > lo && (a + b) / 2 < hi)) continue;
      longFace(o, 'wall', side, a, b, 0, P.roofHeight);
    }
  }
  sidePortals(o, lod);
  for (const s of [0, P.lengthMeters]) {
    const a = sectionAt(s),
      n = s === 0 ? a.t.map((v) => -v) : a.t;
    face(
      o,
      'base',
      [
        a.point(-P.halfWidth, -P.foundationDepth),
        a.point(P.halfWidth, -P.foundationDepth),
        a.point(P.halfWidth, 0),
        a.point(-P.halfWidth, 0),
      ],
      [n[0], 0, n[1]],
    );
    for (const side of [-1, 1])
      face(
        o,
        'wall',
        [
          a.point(side * P.hallHalfWidth),
          a.point(side * P.halfWidth),
          a.point(side * P.halfWidth, P.roofHeight),
          a.point(side * P.hallHalfWidth, P.roofHeight),
        ],
        [n[0], 0, n[1]],
      );
  }
  if (lod === 0) continuousFarVault(o);
  else for (const c of bayCentres) dome(o, c, lod);
  if (lod > 1) {
    for (const side of [-1, 1])
      for (let i = 0; i < P.distances.length - 1; i++) {
        const a = sectionAt(P.distances[i]),
          b = sectionAt(P.distances[i + 1]);
        beam(
          o,
          'roof',
          a.point(side * P.halfWidth, P.roofHeight + 0.08),
          b.point(side * P.halfWidth, P.roofHeight + 0.08),
          0.18,
          0.16,
          colors.roof,
        );
      }
    for (let i = 0; i < P.bayCount; i++) {
      const s = (P.lengthMeters * (i + 0.5)) / P.bayCount;
      if (gaps.some(([a, b]) => s > a - 1.7 && s < b + 1.7)) continue;
      const half = 1.65,
        aa = sectionAt(s - half),
        bb = sectionAt(s + half),
        mid = sectionAt(s);
      for (const side of [-1, 1]) {
        const n = side * (P.hallHalfWidth + 0.18),
          pts = [
            aa.point(n, 0.12),
            aa.point(n, 2.9),
            mid.point(n, 4.75),
            bb.point(n, 2.9),
            bb.point(n, 0.12),
          ];
        face(o, 'door', pts, [-side * mid.m[0], 0, -side * mid.m[1]]);
        if (lod === 3) {
          beam(
            o,
            'base',
            aa.point(n - 0.04 * side, 2.98),
            mid.point(n - 0.04 * side, 4.83),
            0.13,
            0.12,
            colors.base,
          );
          beam(
            o,
            'base',
            mid.point(n - 0.04 * side, 4.83),
            bb.point(n - 0.04 * side, 2.98),
            0.13,
            0.12,
            colors.base,
          );
          for (const a of [aa, bb])
            beam(
              o,
              'base',
              a.point(n - 0.04 * side, 0.12),
              a.point(n - 0.04 * side, 2.98),
              0.13,
              0.12,
              colors.base,
            );
        }
      }
    }
  }
  componentEvidence.push({
    lod,
    nativeCentrelineControls: R.length,
    wholeOriginalCoveredRoute: true,
    fullOuterWalls: true,
    completeHallAndSideGalleryRoofs: true,
    bothEndsOpen: true,
    mappedJunctionPortals: P.junctions.length * 2,
    roofOculi: lod ? P.bayCount : 0,
    originalFloorProfile: true,
    notWholeGrandBazaarProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tj/tju/bazarcheh_now_isfahan',
  camera = [440, 360, 510],
  look = [0, 3, 0],
  west = sectionAt(0),
  east = sectionAt(P.lengthMeters),
  j = sectionAt(P.junctions[3]?.distance ?? P.lengthMeters / 2);
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'tj/tju',
  title: 'Bazarcheh Now, Isfahan',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Whole629.49m continuousBazarchehNowcoveredmarket, bothoriginalways/all19nativecontrols/bends, completeouterwalls/sidegalleryroofs/vaultedmainhall, bothendsopen andmappedjunctionsideportals. Originalfield-informedfloorprofile fixedbeforegeometry. Width/sections/roofbaycensus/oculi/facadefinishestimated fromclearCostevaultvocabulary; no currentwholewingphotosurvey. NotwholeGrandBazaarproxy.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: Math.min(...P.floorControls) - P.foundationDepth - 0.03,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick',
    'plaster_lime',
    'stone_sandstone',
    'tile_ceramic',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'western-end-opening-and-whole-covered-roof',
      position: [west.c[0] - 50, west.floor + 26, west.c[1] + 65],
      lookAt: [west.c[0] + 30, west.floor + 4, west.c[1]],
    },
    {
      name: 'whole-covered-market-original-bends-and-junctions',
      position: [0, 480, 610],
      lookAt: look,
    },
    {
      name: 'mapped-crossstreet-portals-and-oculus-vaults',
      position: [j.c[0] + 30, j.floor + 18, j.c[1] + 36],
      lookAt: [j.c[0], j.floor + 4, j.c[1]],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-covered-market-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.01, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Originaldeterministicgeometry/repositorylicense. OriginalOSMwholecoveredmarketcentreline/type/name/ODbLattributionretained. ExactclearedQuallaCoste1840engraving/1867publication/death1879/publicdomain. Width/height/sections/floorprofile/baycensus/finishboundedestimates; no commercialimagepixelsorcurrentphotographicfidelityclaim.',
};
