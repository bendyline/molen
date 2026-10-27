/** Old Molino de Osada museum house: complete bounded exterior, photographed2009 phase. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  B = P.body,
  ref = 'palette:#ffffff';
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.94, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.22 },
  glass: { slot: 'window', localRef: ref, roughness: 0.45, metallic: 0 },
};
const C = {
  wall: rgb('eee9db'),
  stone: rgb('98835f'),
  roof: rgb('b07c53'),
  brick: rgb('9c7f53'),
  wood: rgb('38352a'),
  iron: rgb('393e32'),
  glass: rgb('272f28'),
};
export const partEvidence = [],
  windowEvidence = [],
  roofEvidence = [],
  stairEvidence = [];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  pt = ([x, z], y) => [x, y, z];
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function box(o, k, min, max, col = C[k]) {
  const [x, y, z] = min,
    [X, Y, Z] = max;
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
    face(o, k, ps, n, col);
}
function roof(o, a, b, c, d, y0, y1, lod, id, { hood = false } = {}) {
  const L = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(d[0] - c[0], d[1] - c[1])),
    slope = Math.hypot(
      ...[
        lerp(c, d, 0.5)[0] - lerp(a, b, 0.5)[0],
        lerp(c, d, 0.5)[1] - lerp(a, b, 0.5)[1],
        y1 - y0,
      ],
    ),
    waves = lod >= 2 ? Math.max(1, Math.ceil(L / (lod >= 3 ? P.roof.tilePitch : 1.05))) : 1,
    ns = lod >= 2 ? waves * 2 : 1,
    rows = Math.max(1, Math.ceil(slope / P.roof.rowPitch)),
    nt = lod >= 3 ? (hood ? 2 : rows * 2) : lod >= 2 ? 4 : 1;
  const at = (s, t) => {
    const q = lerp(lerp(a, b, s), lerp(c, d, s), t),
      relief =
        lod >= 2
          ? P.roof.barrelRelief * Math.sin(s * waves * Math.PI) ** 2 * Math.sin(t * Math.PI) +
            (lod >= 3 ? P.roof.rowRelief * Math.sin(t * rows * Math.PI) ** 2 : 0)
          : 0;
    return [q[0], y0 + (y1 - y0) * t + relief, q[1]];
  };
  for (let i = 0; i < ns; i++)
    for (let j = 0; j < nt; j++) {
      const q = [
          at(i / ns, j / nt),
          at((i + 1) / ns, j / nt),
          at((i + 1) / ns, (j + 1) / nt),
          at(i / ns, (j + 1) / nt),
        ],
        col =
          lod >= 3 && (Math.floor(i / 2) * 7 + Math.floor(j / 2) * 3) % 19 < 3
            ? rgb('a48f70')
            : C.roof;
      for (const ps of [
        [q[0], q[1], q[2]],
        [q[0], q[2], q[3]],
      ]) {
        const A = ps[1].map((v, i) => v - ps[0][i]),
          D = ps[2].map((v, i) => v - ps[0][i]);
        if (
          Math.hypot(
            A[1] * D[2] - A[2] * D[1],
            A[2] * D[0] - A[0] * D[2],
            A[0] * D[1] - A[1] * D[0],
          ) < 1e-8
        )
          continue;
        let n = normalFor(...ps);
        if (n[1] < 0) n = n.map((v) => -v);
        face(o, 'roof', ps, n, col);
      }
    }
  roofEvidence.push({ id, a, b, c, d, y0, y1, waves, ns, nt, rows, hood });
}
function opening(o, x, z, normal, width, bottom, height, lod, id) {
  const u = [normal[2], 0, -normal[0]],
    at = (X, Y, D = 0.035) => [x + u[0] * X + normal[0] * D, Y, z + u[2] * X + normal[2] * D];
  face(
    o,
    'glass',
    [
      at(-width / 2, bottom),
      at(width / 2, bottom),
      at(width / 2, bottom + height),
      at(-width / 2, bottom + height),
    ],
    normal,
  );
  windowEvidence.push({ id, center: [x, z], normal, width, bottom, height });
  if (lod >= 1) {
    for (const s of [-1, 1])
      beam(
        o,
        'wood',
        at(s * (width / 2 + 0.04), bottom - 0.04),
        at(s * (width / 2 + 0.04), bottom + height + 0.04),
        0.07,
        0.08,
        C.wood,
      );
    for (const Y of [bottom - 0.04, bottom + height + 0.04])
      beam(o, 'wood', at(-width / 2 - 0.08, Y), at(width / 2 + 0.08, Y), 0.09, 0.09, C.wood);
    for (let i = 0; i <= (lod >= 2 ? 6 : 2); i++) {
      const X = -width / 2 + (width * i) / (lod >= 2 ? 6 : 2);
      beam(o, 'iron', at(X, bottom, 0.08), at(X, bottom + height, 0.08), 0.025, 0.025, C.iron);
    }
    if (lod >= 2)
      for (const t of [0.25, 0.5, 0.75])
        beam(
          o,
          'iron',
          at(-width / 2, bottom + height * t, 0.08),
          at(width / 2, bottom + height * t, 0.08),
          0.028,
          0.028,
          C.iron,
        );
    const w = width / 2 + 0.25,
      h = P.baseFloorY + P.window.hoodTopAboveFloor,
      pa = [
        at(-w, h, 0.08),
        at(w, h, 0.08),
        at(w, h - 0.18, P.window.hoodProjection),
        at(-w, h - 0.18, P.window.hoodProjection),
      ];
    face(o, 'wood', [pa[3], pa[2], pa[1], pa[0]], [0, -1, 0]);
    roof(
      o,
      [pa[3][0], pa[3][2]],
      [pa[2][0], pa[2][2]],
      [pa[0][0], pa[0][2]],
      [pa[1][0], pa[1][2]],
      h - 0.18,
      h,
      lod,
      `hood-${id}`,
      { hood: true },
    );
  }
}
function entry(o, lod) {
  const E = P.entrance,
    spring = P.baseFloorY + E.springAboveFloor,
    N = lod >= 3 ? 28 : lod >= 2 ? 18 : lod >= 1 ? 12 : 8,
    outline = [
      [-E.archInnerRadius, P.baseFloorY, -0.055],
      [E.archInnerRadius, P.baseFloorY, -0.055],
    ];
  for (let j = 0; j <= N; j++) {
    const t = (Math.PI * j) / N;
    outline.push([
      Math.cos(t) * E.archInnerRadius,
      spring + Math.sin(t) * E.archInnerRadius,
      -0.055,
    ]);
  }
  face(o, 'wood', outline, [0, 0, -1]);
  for (let j = 0; j < N; j++) {
    const gap = lod >= 2 ? 0.008 : 0,
      a = (Math.PI * j) / N + gap,
      b = (Math.PI * (j + 1)) / N - gap,
      at = (r, t, z) => [Math.cos(t) * r, spring + Math.sin(t) * r, z];
    face(
      o,
      'roof',
      [
        at(E.archInnerRadius, a, -E.depth),
        at(E.archOuterRadius, a, -E.depth),
        at(E.archOuterRadius, b, -E.depth),
        at(E.archInnerRadius, b, -E.depth),
      ],
      [0, 0, -1],
      C.brick,
    );
    face(
      o,
      'roof',
      [
        at(E.archInnerRadius, a, -0.04),
        at(E.archInnerRadius, b, -0.04),
        at(E.archInnerRadius, b, -E.depth),
        at(E.archInnerRadius, a, -E.depth),
      ],
      undefined,
      C.brick,
    );
    face(
      o,
      'roof',
      [
        at(E.archOuterRadius, a, -E.depth),
        at(E.archOuterRadius, b, -E.depth),
        at(E.archOuterRadius, b, -0.04),
        at(E.archOuterRadius, a, -0.04),
      ],
      undefined,
      C.brick,
    );
  }
  for (const sign of [-1, 1]) {
    box(
      o,
      'stone',
      [sign < 0 ? -E.archOuterRadius : E.archInnerRadius, P.baseFloorY, -E.depth],
      [sign < 0 ? -E.archInnerRadius : E.archOuterRadius, spring, 0.02],
    );
    if (lod >= 2)
      for (let j = 1; j < 7; j++)
        beam(
          o,
          'roof',
          [
            sign * (E.archInnerRadius + 0.01),
            P.baseFloorY + ((spring - P.baseFloorY) * j) / 7,
            -E.depth - 0.015,
          ],
          [
            sign * (E.archOuterRadius - 0.01),
            P.baseFloorY + ((spring - P.baseFloorY) * j) / 7,
            -E.depth - 0.015,
          ],
          0.018,
          0.018,
          C.brick,
        );
  }
  if (lod >= 1) {
    beam(o, 'wood', [0, P.baseFloorY, -0.09], [0, spring, -0.09], 0.07, 0.07, C.wood);
    beam(
      o,
      'wood',
      [-E.archInnerRadius, spring, -0.09],
      [E.archInnerRadius, spring, -0.09],
      0.1,
      0.1,
      C.wood,
    );
    if (lod >= 2) {
      for (let j = -5; j <= 5; j++) {
        const x = j * 0.2,
          top = spring + Math.sqrt(E.archInnerRadius ** 2 - x ** 2) - 0.04;
        beam(o, 'iron', [x, spring + 0.04, -0.105], [x, top, -0.105], 0.035, 0.035, C.iron);
      }
      for (const sign of [-1, 1])
        for (const y of [P.baseFloorY + 0.45, P.baseFloorY + 1.2]) {
          const x = sign * 0.62;
          for (const dx of [-0.4, 0.4])
            beam(
              o,
              'wood',
              [x + dx, y - 0.27, -0.1],
              [x + dx, y + 0.27, -0.1],
              0.035,
              0.035,
              C.wood,
            );
          for (const dy of [-0.27, 0.27])
            beam(o, 'wood', [x - 0.4, y + dy, -0.1], [x + 0.4, y + dy, -0.1], 0.04, 0.04, C.wood);
        }
    }
  }
  for (let j = 0; j < E.steps; j++) {
    const z = -(E.steps - j - 0.5) * E.tread,
      y = (j + 1) * E.rise;
    box(o, 'stone', [-1.5, y - 0.18, z - E.tread / 2], [1.5, y, z + E.tread / 2]);
    stairEvidence.push({ index: j + 1, x: 0, z, y });
  }
}
export function buildHouse(o, _f, lod = 3) {
  partEvidence.length = 0;
  windowEvidence.length = 0;
  roofEvidence.length = 0;
  stairEvidence.length = 0;
  box(o, 'stone', [B.xmin, P.foundationBottomY, B.zmin], [B.xmax, P.baseFloorY, B.zmax]);
  box(o, 'wall', [B.xmin, P.baseFloorY, B.zmin], [B.xmax, B.eave, B.zmax]);
  box(
    o,
    'stone',
    [B.xmin - 0.015, P.baseFloorY, B.zmin - 0.02],
    [B.xmax + 0.015, P.stonePlinthTop, B.zmax + 0.02],
  );
  const x = B.xmin - B.overhang,
    X = B.xmax + B.overhang,
    z = B.zmin - B.overhang,
    Z = B.zmax + B.overhang,
    mid = (z + Z) / 2,
    r0 = B.xmin + B.hipEndInset,
    r1 = B.xmax - B.hipEndInset;
  roof(o, [x, z], [X, z], [r0, mid], [r1, mid], B.eave, B.ridge, lod, 'main-front');
  roof(o, [X, Z], [x, Z], [r1, mid], [r0, mid], B.eave, B.ridge, lod, 'main-rear');
  roof(o, [x, Z], [x, z], [r0, mid], [r0, mid], B.eave, B.ridge, lod, 'west-hip');
  roof(o, [X, z], [X, Z], [r1, mid], [r1, mid], B.eave, B.ridge, lod, 'east-hip');
  face(
    o,
    'wood',
    [
      [x, B.eave - 0.08, z],
      [X, B.eave - 0.08, z],
      [X, B.eave - 0.08, Z],
      [x, B.eave - 0.08, Z],
    ],
    [0, -1, 0],
  );
  if (lod >= 1) {
    for (const [a, b] of [
      [
        [x, z],
        [X, z],
      ],
      [
        [X, z],
        [X, Z],
      ],
      [
        [X, Z],
        [x, Z],
      ],
      [
        [x, Z],
        [x, z],
      ],
    ])
      beam(o, 'wood', pt(a, B.eave - 0.04), pt(b, B.eave - 0.04), 0.13, 0.15, C.wood);
    beam(o, 'roof', [r0, B.ridge + 0.035, mid], [r1, B.ridge + 0.035, mid], 0.15, 0.12, C.roof);
  }
  for (const x of P.frontWindows)
    opening(
      o,
      x,
      0,
      [0, 0, -1],
      P.window.width,
      P.baseFloorY + P.window.bottomAboveFloor,
      P.window.height,
      lod,
      `front-${x}`,
    );
  if (lod >= 1) {
    for (let j = 0; j < P.rearWindowCountEstimate; j++)
      opening(
        o,
        B.xmin + 3 + ((B.xmax - B.xmin - 6) * j) / (P.rearWindowCountEstimate - 1),
        B.zmax,
        [0, 0, 1],
        P.window.width,
        P.baseFloorY + 1,
        P.window.height,
        lod,
        `estimated-rear-${j}`,
      );
    for (const [x, n] of [
      [B.xmin, [-1, 0, 0]],
      [B.xmax, [1, 0, 0]],
    ])
      for (let j = 0; j < P.sideWindowCountEstimate; j++)
        opening(
          o,
          x,
          2.8 + j * 4.4,
          n,
          P.window.width,
          P.baseFloorY + 1,
          P.window.height,
          lod,
          `estimated-side-${x}-${j}`,
        );
  }
  entry(o, lod);
  if (lod >= 2)
    for (let row = 0; row < 2; row++)
      for (let j = 0; j < 22; j++) {
        const x = B.xmin + ((j + 0.5) * (B.xmax - B.xmin)) / 22;
        if (Math.abs(x) < 1.7) continue;
        const Y = P.baseFloorY + 0.15 + row * 0.3,
          col = (j + row) % 3 === 0 ? rgb('a28a62') : C.stone;
        beam(
          o,
          'stone',
          [x - 0.46, Y, -0.055],
          [x + 0.46, Y + 0.025 * Math.sin(j), -0.055],
          0.06,
          0.24,
          col,
        );
      }
  partEvidence.push(
    {
      id: 'whole-single-storey-old-mill-house',
      envelope: [B.xmin, B.xmax, B.zmin, B.zmax],
      floor: P.baseFloorY,
      completeRearAndBothSides: true,
      hiddenPlanEstimated: true,
    },
    { id: 'complete-four-slope-clay-hip-roof', eave: B.eave, ridge: B.ridge },
    {
      id: 'brick-round-arch-dark-timber-door-and-iron-transom',
      spring: P.baseFloorY + P.entrance.springAboveFloor,
      radius: P.entrance.archInnerRadius,
    },
    {
      id: 'white-plaster-stone-base-iron-grilles-and-tile-hoods',
      frontWindows: P.frontWindows.length,
    },
    { id: 'two-intrinsic-entry-steps', count: P.entrance.steps },
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/d3/d35/paleontological_museum_villa_de_leyva';
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Paleontological Museum, Villa de Leyva (2009)',
  cell: 'd3/d35',
  wikidataId: 'Q6033652',
  category: 'museum',
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
  camera: [32, 17, -35],
  lookAt: [0, 2, 4],
  portableGroundY: -1.4,
  mediumFiContext: {
    scale: 1,
    groundY: -1.4,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'clay_fired',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-old-mill-house-and-complete-hip-roof',
      position: [32, 17, -35],
      lookAt: [0, 2, 4],
    },
    { name: 'whole-estimated-rear-and-both-ends', position: [-33, 17, 40], lookAt: [0, 2, 4] },
    { name: 'brick-arch-timber-entry-and-two-steps', position: [3, 3.8, -8], lookAt: [0, 1.9, 0] },
    {
      name: 'iron-window-grille-and-barrel-tile-hood',
      position: [-7, 3.3, -4],
      lookAt: [-5, 2.2, 0],
    },
    { name: 'complete-hip-roof-grouped-clay-tiles', position: [11, 10, -9], lookAt: [1, 5, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-old-house-${reviewLod}`,
    position: [32, 17, -35],
    lookAt: [0, 2, 4],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry under repository license. One already-cleared published Qualla Petruss2009 Own/PD-self photograph, exact native SHA1/revision/local SHA256 bound and unchanged published inventory passes. OSM ODbL named point/road only; Wikidata CC0 exact specific museum identity. Primary owning university text confirms old mill-house subject and separate later proposed campus; no protected website pictures adopted, copied photographic textures, questionable images, generated bitmaps or policy/metadata repairs.',
};
