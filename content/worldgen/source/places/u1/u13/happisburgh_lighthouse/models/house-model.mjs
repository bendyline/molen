/** Complete Happisburgh Lighthouse. Original frame/field and all main sections precede geometry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  ref = 'palette:#ffffff';
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.2 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.3 },
  glass: {
    slot: 'window',
    localRef: ref,
    roughness: 0.24,
    metallic: 0.1,
    baseColorFactor: [1, 1, 1, 0.55],
    alphaMode: 'BLEND',
    doubleSided: false,
  },
};
const C = {
  wall: rgb('e8e5d9'),
  red: rgb('a0232e'),
  stone: rgb('d2cbbc'),
  roof: rgb('96212c'),
  iron: rgb('e6e2d3'),
  dark: rgb('292c2b'),
  glass: rgb('748b8f'),
};
export const toWorld = (p) => p.slice();
export const partEvidence = [],
  openingEvidence = [],
  roofEvidence = [],
  stairEvidence = [],
  galleryEvidence = [],
  railEvidence = [];
let activeLod = 3;
const wrap = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
  point = (a, y, r) => [r * Math.cos(a), y, r * Math.sin(a)],
  normal = (a) => [Math.cos(a), 0, Math.sin(a)],
  radius = (y) =>
    P.tower.baseRadius +
    ((P.tower.topRadius - P.tower.baseRadius) * (y - P.tower.bottom)) /
      (P.tower.top - P.tower.bottom);
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function box(o, k, a, b, col = C[k]) {
  const [x, y, z] = a,
    [X, Y, Z] = b;
  for (const [ps, n] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [X, y, Z],
        [x, y, Z],
        [x, Y, Z],
        [X, Y, Z],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x, y, Z],
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x, y, Z],
        [X, y, Z],
        [X, y, z],
        [x, y, z],
      ],
      [0, -1, 0],
    ],
  ])
    if (activeLod > 0 || n[1] >= 0) face(o, k, ps, n, col);
}
function drum(o, k, r0, r1, y0, y1, N, col = C[k], cap = true) {
  loft(o, k, [radialRing(y0, r0, r0, N), radialRing(y1, r1, r1, N)], col, { cap });
}
function hoop(o, k, r, y, N, w = 0.065, col = C[k]) {
  for (let i = 0; i < N; i++) {
    const a = (i * Math.PI * 2) / N,
      b = ((i + 1) * Math.PI * 2) / N;
    beam(o, k, point(a, y, r), point(b, y, r), w, w, col);
    railEvidence.push({ point: point((a + b) / 2, y, r * Math.cos((b - a) / 2)), kind: k });
  }
}
function color(y) {
  return P.tower.redBands.some(([a, b]) => y >= a && y <= b) ? C.red : C.wall;
}
function shaft(o, lod) {
  const T = P.tower,
    N = [12, 24, 48, 96][lod],
    holes = [{ ...P.entry, id: 'entry', door: true }, ...(lod === 0 ? [] : P.windows)],
    cuts = [
      ...Array.from({ length: N }, (_, i) => (Math.PI * 2 * i) / N),
      ...holes.flatMap((q) => [wrap(q.angle - q.halfAngle), wrap(q.angle + q.halfAngle)]),
    ].sort((a, b) => a - b),
    ys = [
      ...new Set([T.bottom, T.top, ...T.belts, ...holes.flatMap((q) => [q.bottom, q.top])]),
    ].sort((a, b) => a - b),
    angles = [...new Set(cuts.map((v) => +v.toFixed(12)))];
  for (let j = 1; j < ys.length; j++)
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i],
        b = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * Math.PI,
        y0 = ys[j - 1],
        y1 = ys[j],
        m = (a + b) / 2,
        inside = holes.some(
          (q) =>
            Math.abs(Math.atan2(Math.sin(m - q.angle), Math.cos(m - q.angle))) <
              q.halfAngle - 1e-8 &&
            (y0 + y1) / 2 > q.bottom &&
            (y0 + y1) / 2 < q.top,
        );
      if (inside) continue;
      const outer = [
        point(a, y0, radius(y0)),
        point(b, y0, radius(y0)),
        point(b, y1, radius(y1)),
        point(a, y1, radius(y1)),
      ];
      face(
        o,
        'wall',
        outer,
        [Math.cos(m), -(T.topRadius - T.baseRadius) / (T.top - T.bottom), Math.sin(m)],
        color((y0 + y1) / 2),
      );
      if (lod > 0)
        face(
          o,
          'wall',
          [
            point(b, y0, radius(y0) - T.wallThickness),
            point(a, y0, radius(y0) - T.wallThickness),
            point(a, y1, radius(y1) - T.wallThickness),
            point(b, y1, radius(y1) - T.wallThickness),
          ],
          normal(m).map((v) => -v),
          C.wall,
        );
    }
  for (const q of holes) {
    const a = q.angle - q.halfAngle,
      b = q.angle + q.halfAngle,
      inner = (y) => radius(y) - T.wallThickness;
    for (const [ang, sign] of [
      [a, 1],
      [b, -1],
    ])
      face(
        o,
        'wall',
        [
          point(ang, q.bottom, radius(q.bottom)),
          point(ang, q.bottom, inner(q.bottom)),
          point(ang, q.top, inner(q.top)),
          point(ang, q.top, radius(q.top)),
        ],
        [-Math.sin(ang) * sign, 0, Math.cos(ang) * sign],
        C.wall,
      );
    for (const [y, n] of [
      [q.bottom, [0, 1, 0]],
      [q.top, [0, -1, 0]],
    ])
      face(
        o,
        'wall',
        [
          point(a, y, radius(y)),
          point(b, y, radius(y)),
          point(b, y, inner(y)),
          point(a, y, inner(y)),
        ],
        n,
        C.wall,
      );
    const depth = q.door ? P.entry.doorRecess : 0.25,
      mid = (q.bottom + q.top) / 2,
      ps = [
        point(a, q.bottom, radius(q.bottom) - depth),
        point(b, q.bottom, radius(q.bottom) - depth),
        point(b, q.top, radius(q.top) - depth),
        point(a, q.top, radius(q.top) - depth),
      ];
    face(o, q.door ? 'iron' : 'glass', ps, normal(q.angle), q.door ? C.dark : C.glass);
    const paneRadius = (radius(mid) - depth) * Math.cos(q.halfAngle);
    openingEvidence.push({
      ...q,
      center: point(q.angle, mid, radius(mid)),
      normal: normal(q.angle),
      actualRecess: radius(mid) - paneRadius,
      panePoint: point(q.angle, mid, paneRadius),
    });
    if (lod >= 2) {
      for (const ang of [a, b])
        beam(
          o,
          'wall',
          point(ang, q.bottom - 0.08, radius(q.bottom) + 0.035),
          point(ang, q.top + 0.08, radius(q.top) + 0.035),
          0.095,
          0.09,
          C.wall,
        );
      for (const y of [q.bottom - 0.06, q.top + 0.06])
        beam(
          o,
          'wall',
          point(a - 0.018, y, radius(y) + 0.045),
          point(b + 0.018, y, radius(y) + 0.045),
          0.12,
          0.1,
          C.wall,
        );
      if (!q.door) {
        beam(
          o,
          'iron',
          point(q.angle, q.bottom, radius(q.bottom) - depth - 0.01),
          point(q.angle, q.top, radius(q.top) - depth - 0.01),
          0.04,
          0.04,
          C.iron,
        );
      } else {
        const H = point(q.angle - 0.1, 1.6, radius(1.6) - depth + 0.03);
        beam(
          o,
          'iron',
          H,
          H.map((v, i) => v + (i === 1 ? 0.18 : 0)),
          0.035,
          0.035,
          C.iron,
        );
      }
    }
  }
  drum(o, 'stone', T.baseRadius, T.baseRadius, P.foundationBottomY, T.bottom, N, C.stone);
  if (lod > 0) {
    for (const y of [T.bottom, 7.4, 14.4, 20.4])
      drum(
        o,
        'stone',
        radius(y) - T.wallThickness,
        radius(y) - T.wallThickness,
        y - 0.12,
        y,
        N,
        C.stone,
      );
  }
  if (lod >= 1)
    for (const y of T.belts) {
      drum(
        o,
        'wall',
        radius(y) + T.beltWidth,
        radius(y + 0.14) + T.beltWidth,
        y,
        y + 0.14,
        N,
        C.wall,
      );
    }
  partEvidence.push({
    id: 'whole-tapered-tower-all-three-red-bands-and-two-white-bands',
    physicalHeight: 26,
    openings: holes.length,
  });
}
function gallery(o, lod) {
  const G = P.gallery,
    N = [12, 24, 48, 96][lod];
  drum(o, 'wall', P.tower.topRadius, G.radius, G.bottom, G.shoulderTop, N, C.red);
  drum(o, 'wall', G.radius, G.radius, G.floor - G.slabThickness, G.floor, N, C.red);
  galleryEvidence.push({
    id: 'full-circular-gallery-floor',
    point: point(-Math.PI / 3, G.floor, 3),
  });
  if (lod > 0)
    galleryEvidence.push({
      id: 'full-circular-gallery-underside',
      point: point(-Math.PI / 3, G.floor - G.slabThickness, 3),
      underside: true,
    });
  const posts = lod === 0 ? 8 : lod === 1 ? 12 : G.posts;
  for (let i = 0; i < posts; i++) {
    const a = (i * Math.PI * 2) / posts;
    beam(
      o,
      'iron',
      point(a, G.floor, G.railRadius),
      point(a, G.railingTop, G.railRadius),
      lod < 2 ? 0.1 : 0.055,
      lod < 2 ? 0.1 : 0.055,
      C.iron,
    );
  }
  hoop(
    o,
    'iron',
    G.railRadius,
    G.railingTop,
    lod === 0 ? 12 : lod === 1 ? 24 : 48,
    lod < 2 ? 0.08 : 0.055,
    C.iron,
  );
  if (lod >= 2) hoop(o, 'iron', G.railRadius, (G.floor + G.railingTop) / 2, 48, 0.045, C.iron);
  partEvidence.push({ id: 'whole-gallery-projecting-cornice-slab-and-circular-railing', posts });
}
function lantern(o, lod) {
  const L = P.lantern,
    N = L.panels;
  drum(o, 'iron', L.radius, L.radius, L.bottom, L.glassBottom, N, C.iron);
  drum(o, 'iron', L.radius, L.radius, L.glassTop, L.roofEave, N, C.iron);
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 4 - Math.PI / 2 + (i * Math.PI * 2) / N,
      b = a + (Math.PI * 2) / N,
      m = (a + b) / 2,
      sea =
        Math.abs(Math.atan2(Math.sin(m - L.seaFacingAngle), Math.cos(m - L.seaFacingAngle))) <
        L.glazedHalfAngle,
      ps = [
        point(a, L.glassBottom, L.radius),
        point(b, L.glassBottom, L.radius),
        point(b, L.glassTop, L.radius),
        point(a, L.glassTop, L.radius),
      ];
    face(o, sea ? 'glass' : 'iron', ps, normal(m), sea ? C.glass : C.iron);
    if (!sea && lod > 0)
      face(
        o,
        'iron',
        ps.map((p) => {
          const rr = Math.hypot(p[0], p[2]);
          return [(p[0] * (rr - 0.035)) / rr, p[1], (p[2] * (rr - 0.035)) / rr];
        }),
        normal(m).map((v) => -v),
        C.dark,
      );
    if (lod >= 1) {
      beam(
        o,
        'iron',
        point(a, L.glassBottom, L.radius + 0.03),
        point(a, L.glassTop, L.radius + 0.03),
        0.065,
        0.065,
        C.iron,
      );
      if (sea && lod >= 2) {
        beam(
          o,
          'iron',
          point(a, L.glassBottom, L.radius + 0.04),
          point(b, L.glassTop, L.radius + 0.04),
          0.045,
          0.045,
          C.iron,
        );
        beam(
          o,
          'iron',
          point(b, L.glassBottom, L.radius + 0.04),
          point(a, L.glassTop, L.radius + 0.04),
          0.045,
          0.045,
          C.iron,
        );
      }
    }
  }
  if (lod > 0) {
    drum(o, 'iron', 0.22, 0.22, L.bottom, L.centralOpticBottom, 12, C.dark);
    drum(
      o,
      'glass',
      L.centralOpticRadius,
      L.centralOpticRadius,
      L.centralOpticBottom,
      L.centralOpticTop,
      24,
      rgb('cbd7cd'),
    );
    if (lod >= 2)
      for (let y = L.centralOpticBottom; y < L.centralOpticTop; y += 0.15)
        hoop(o, 'glass', L.centralOpticRadius + 0.025, y, 24, 0.035, rgb('ced9ce'));
  }
  const roofN = [12, 24, 48, 96][lod],
    r0 = radialRing(L.roofEave, L.roofRadius, L.roofRadius, roofN),
    r1 = radialRing(L.roofTip, 0.075, 0.075, roofN);
  for (let i = 0; i < roofN; i++) {
    const j = (i + 1) % roofN,
      ps = [r0[i], r0[j], r1[j], r1[i]],
      n = normalFor(...ps);
    if (n[1] < 0)
      n.forEach((_, i) => {
        n[i] *= -1;
      });
    face(o, 'roof', ps, n, C.roof);
    roofEvidence.push({
      id: `closed-conical-roof-${i}`,
      point: [0, 1, 2].map((k) => (ps[0][k] + ps[1][k] + ps[2][k]) / 3),
    });
  }
  face(o, 'roof', r0, [0, -1, 0], C.roof);
  face(o, 'roof', r1, [0, 1, 0], C.roof);
  beam(
    o,
    'iron',
    [0, L.roofTip, 0],
    [0, L.finialTop - 0.04, 0],
    lod === 0 ? 0.16 : 0.08,
    lod === 0 ? 0.16 : 0.08,
    C.dark,
  );
  if (lod > 0) drum(o, 'iron', 0.13, 0.08, L.finialTop - 0.27, L.finialTop, 12, C.dark);
  partEvidence.push({
    id: 'whole-lantern-glazed-sea-facing-half-black-interior-back-closed-red-roof-and-finial',
  });
}
function entryStairs(o, lod) {
  const E = P.entry,
    a = E.angle,
    n = normal(a),
    u = [-n[2], 0, n[0]],
    base = P.tower.baseRadius,
    r = base + 0.01,
    count = lod === 0 ? 1 : E.stepCount;
  for (let i = 0; i < count; i++) {
    const top = ((i + 1) * P.baseFloorY) / count,
      near = r + ((count - i - 1) * E.stepRun * E.stepCount) / count,
      far = near + (E.stepRun * E.stepCount) / count,
      local = {
        addConvexPolygon: (k, ref, ps, N, _uv, col) =>
          o.addConvexPolygon(
            k,
            ref,
            ps.map(([x, y, z]) => [u[0] * x + n[0] * z, y, u[2] * x + n[2] * z]),
            [u[0] * N[0] + n[0] * N[2], N[1], u[2] * N[0] + n[2] * N[2]],
            (p) => [p[0], p[1]],
            col,
          ),
      };
    box(
      local,
      'stone',
      [-E.stepWidth / 2, P.foundationBottomY, near],
      [E.stepWidth / 2, top, far],
      C.stone,
    );
    stairEvidence.push({ id: `entry-step-${i}`, point: point(a, top, (near + far) / 2) });
  }
  partEvidence.push({ id: 'complete-recessed-entry-and-intrinsic-approach-treads', treads: count });
}
export function buildHouse(o, _frame, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    openingEvidence,
    roofEvidence,
    stairEvidence,
    galleryEvidence,
    railEvidence,
  ])
    a.length = 0;
  shaft(o, lod);
  gallery(o, lod);
  lantern(o, lod);
  entryStairs(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/u1/u13/happisburgh_lighthouse',
  cam = (p) => toWorld(p),
  camera = cam([37, 23, -45]),
  look = cam([0, 13, 0]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Happisburgh Lighthouse (2007)',
  cell: 'u1/u13',
  wikidataId: 'Q5652375',
  category: 'lighthouse',
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
  portableGroundY: -3,
  mediumFiContext: {
    scale: 1,
    groundY: -3,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'concrete_plain',
    'metal_standing_seam',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-tapered-lighthouse-all-bands-gallery-lantern-roof',
      position: camera,
      lookAt: look,
    },
    { name: 'whole-landward-back-and-recessed-entry', position: cam([-34, 21, 35]), lookAt: look },
    {
      name: 'glazed-sea-facing-lantern-gallery-braces-and-roof',
      position: cam([15, 25, -16]),
      lookAt: cam([0, 22.8, 0]),
    },
    {
      name: 'recessed-entry-masonry-taper-and-steps',
      position: cam([-11, 4, 12]),
      lookAt: cam([-3, 2.6, 3]),
    },
    {
      name: 'whole-upper-tower-belts-gallery-and-landward-lantern',
      position: cam([-14, 21, 14]),
      lookAt: cam([0, 19, 0]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-happisburgh-lighthouse-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.16, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry/repository license. Qualla-first36families; exact native single-version SiJa2007 author-account PD-user-en grant/original uploader/photographer caption and2007uploadrow/720x960/459910bytes/SHA1 bound. Native account grant, no fabricated profile-alias or Own metadata. OSMODbL whole18controltower212790843/Q5652375; primarylocaltechnicaltext26m tower versus41m light above tide, native45m notused. Complete tapered tower/bands/gallery/railing/lantern/closedroof/finial/realrecessedopenings/entrytreads; hiddenentry/windowbearings/sections/radii/grade estimated. Separatekeepercottages/trees/field/pillbox excluded, no protectedwebsitephotos/maps/diagrams/photographictextures/generatedbitmap orrightsrepair.',
};
