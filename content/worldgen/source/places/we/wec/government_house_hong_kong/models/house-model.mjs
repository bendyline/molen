/** Whole original Government House in the 1870s. Frozen original field/frame/sections precede mesh. */
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
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  glass: { slot: 'window', localRef: ref, roughness: 0.35, metallic: 0 },
};
const C = {
    plaster: rgb('ddd7c5'),
    stone: rgb('d6cfb9'),
    roof: rgb(P.roof.color),
    wood: rgb('aaa798'),
    iron: rgb('5b625e'),
    glass: rgb('384a4c'),
  },
  O = P.workingFrame.origin,
  U = P.workingFrame.alongFront,
  V = P.workingFrame.alongDepth;
export const toWorld = ([x, y, z]) => [O[0] + x * U[0] + z * V[0], y, O[1] + x * U[1] + z * V[1]];
const rotate = ([x, y, z]) => [x * U[0] + z * V[0], y, x * U[1] + z * V[1]];
export const partEvidence = [],
  windowEvidence = [],
  roofEvidence = [],
  soffitEvidence = [],
  columnEvidence = [],
  stairEvidence = [],
  entryEvidence = [];
let activeLod = 3;
function face(o, k, p, n = normalFor(...p), col = C[k]) {
  o.addConvexPolygon(k, ref, p, n, (p) => [p[0], p[1]], col);
}
function box(o, k, [x, y, z], [X, Y, Z], col = C[k]) {
  if (!(X > x && Y > y && Z > z)) throw Error('Invalid box');
  for (const [p, n] of [
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
    if (activeLod > 0 || n[1] >= 0) face(o, k, p, n, col);
}
function panel(o, k, E, t0, t1, y0, y1, d = 0) {
  face(o, k, [E.at(t0, y0, d), E.at(t1, y0, d), E.at(t1, y1, d), E.at(t0, y1, d)], E.n);
}
function window(o, E, q, lod) {
  const { t, y, w, h, id } = q,
    d = 0.3;
  panel(o, 'glass', E, t - w / 2, t + w / 2, y, y + h, -d);
  for (const s of [-1, 1])
    face(
      o,
      'stone',
      [
        E.at(t + (s * w) / 2, y),
        E.at(t + (s * w) / 2, y, -d),
        E.at(t + (s * w) / 2, y + h, -d),
        E.at(t + (s * w) / 2, y + h),
      ],
      E.u.map((v) => -s * v),
    );
  for (const [Y, n] of [
    [y, [0, 1, 0]],
    [y + h, [0, -1, 0]],
  ])
    face(
      o,
      'stone',
      [E.at(t - w / 2, Y), E.at(t + w / 2, Y), E.at(t + w / 2, Y, -d), E.at(t - w / 2, Y, -d)],
      n,
    );
  windowEvidence.push({
    id,
    center: E.at(t + w * 0.19, y + h * 0.36, -d),
    normal: E.n,
    recessDepth: d,
  });
  if (lod >= 2) {
    for (const s of [-1, 1])
      beam(
        o,
        'wood',
        E.at(t + s * (w / 2 - 0.065), y, -d + 0.05),
        E.at(t + s * (w / 2 - 0.065), y + h, -d + 0.05),
        0.09,
        0.09,
        C.wood,
      );
    for (const Y of [y + 0.05, y + h - 0.05, y + h * 0.6])
      beam(
        o,
        'wood',
        E.at(t - w / 2, Y, -d + 0.05),
        E.at(t + w / 2, Y, -d + 0.05),
        0.075,
        0.075,
        C.wood,
      );
    if (lod === 3) {
      beam(o, 'wood', E.at(t, y, -d + 0.06), E.at(t, y + h, -d + 0.06), 0.055, 0.06, C.wood);
      for (const Y of [y + h * 0.3, y + h * 0.8])
        beam(
          o,
          'wood',
          E.at(t - w / 2, Y, -d + 0.06),
          E.at(t + w / 2, Y, -d + 0.06),
          0.045,
          0.05,
          C.wood,
        );
    }
    beam(
      o,
      'stone',
      E.at(t - w / 2 - 0.18, y - 0.1, 0.12),
      E.at(t + w / 2 + 0.18, y - 0.1, 0.12),
      0.15,
      0.26,
      C.stone,
    );
  }
}
function wall(o, a, b, bottom, top, windows, lod, id) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L],
    n = [u[2], 0, -u[0]],
    E = {
      L,
      u,
      n,
      at: (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d],
    },
    W = (lod === 0 ? [] : windows).filter((q) => q.t - q.w / 2 > 0.15 && q.t + q.w / 2 < L - 0.15);
  const xs = [0, L, ...W.flatMap((q) => [q.t - q.w / 2, q.t + q.w / 2])].sort((a, b) => a - b),
    ys = [bottom, top, ...W.flatMap((q) => [q.y, q.y + q.h])]
      .filter((y) => y >= bottom && y <= top)
      .sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      if (xs[i] - xs[i - 1] < 1e-6 || ys[j] - ys[j - 1] < 1e-6) continue;
      const x = (xs[i] + xs[i - 1]) / 2,
        y = (ys[j] + ys[j - 1]) / 2;
      if (!W.some((q) => x > q.t - q.w / 2 && x < q.t + q.w / 2 && y > q.y && y < q.y + q.h))
        panel(o, 'plaster', E, xs[i - 1], xs[i], ys[j - 1], ys[j]);
    }
  for (const q of W) window(o, E, { ...q, id: `${id}-${q.id}` }, lod);
  return E;
}
function rectangle(s) {
  return [
    [s.x0, s.z0],
    [s.x1, s.z0],
    [s.x1, s.z1],
    [s.x0, s.z1],
  ];
}
function body(o, s, lod, { main = false, pavilion = false } = {}) {
  const r = rectangle(s);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      N = Math.max(1, Math.floor(L / (lod === 0 ? 7 : 3.7))),
      wins = [];
    for (let j = 0; j < N; j++)
      for (const y of [1.5, 6.3]) {
        if (y + 2.65 > s.eave - 0.15) continue;
        const t = (L * (j + 0.5)) / N;
        if (main && i === 0 && Math.abs(t - P.entry.x) < 2) continue;
        wins.push({ id: `window-${j}-${y}`, t, y, w: pavilion ? 1.6 : 1.45, h: 2.65 });
      }
    if (main && i === 0)
      wins.push({
        id: 'original-entrance',
        t: P.entry.x,
        y: P.entry.bottom,
        w: P.entry.width,
        h: P.entry.top - P.entry.bottom,
      });
    const E = wall(o, a, b, s.bottom, s.eave, wins, lod, `${s.id}-edge-${i}`);
    if (main && i === 0)
      entryEvidence.push({
        id: 'whole-main-lower-entrance',
        center: E.at(P.entry.x, 2.2),
        normal: E.n,
        depth: 0.3,
      });
  }
  box(o, 'stone', [s.x0, P.baseFloorY - 0.22, s.z0], [s.x1, P.baseFloorY, s.z1]);
  box(o, 'plaster', [s.x0, s.eave - 0.2, s.z0], [s.x1, s.eave, s.z1]);
  partEvidence.push({
    id: s.id,
    wholeBody: true,
    lowerFloor: true,
    closedRoof: true,
    extent: [s.x0, s.x1, s.z0, s.z1],
  });
}
function roofPatch(o, p, id, lod) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  if (p.length === 4 && lod === 3) {
    const N = Math.max(1, Math.ceil(Math.hypot(...p[1].map((v, i) => v - p[0][i])) / 0.8)),
      mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    for (let j = 0; j < N; j++) {
      face(
        o,
        'roof',
        [
          mix(p[0], p[1], j / N),
          mix(p[0], p[1], (j + 1) / N),
          mix(p[3], p[2], (j + 1) / N),
          mix(p[3], p[2], j / N),
        ],
        n,
        j % 4 === 0 ? C.roof.map((v) => v * 0.94) : C.roof,
      );
    }
  } else face(o, 'roof', p, n);
  roofEvidence.push({
    id,
    point: p.slice(0, 3).reduce((a, p) => a.map((v, i) => v + p[i] / 3), [0, 0, 0]),
    normal: n,
  });
}
function hip(o, s, lod) {
  const { x0, x1, z0, z1, eave: y, ridge: Y, id = 'main-hip' } = s,
    dx = x1 - x0,
    dz = z1 - z0,
    k = Math.min(dx, dz) * 0.45,
    a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1],
    r0 = dx >= dz ? [x0 + k, Y, (z0 + z1) / 2] : [(x0 + x1) / 2, Y, z0 + k],
    r1 = dx >= dz ? [x1 - k, Y, (z0 + z1) / 2] : [(x0 + x1) / 2, Y, z1 - k];
  const ps =
    dx >= dz
      ? [
          [a, b, r1, r0],
          [b, c, r1],
          [c, d, r0, r1],
          [d, a, r0],
        ]
      : [
          [a, b, r0],
          [b, c, r1, r0],
          [c, d, r1],
          [d, a, r0, r1],
        ];
  for (const [i, p] of ps.entries()) roofPatch(o, p, `${id}-${i}`, lod);
  if (lod >= 2) beam(o, 'iron', r0, r1, 0.12, 0.1, C.iron);
}
function column(o, x, z, lod, id) {
  const A = P.colonnade,
    N = [4, 6, 10, 16][lod],
    c = [x, z];
  if (lod === 0) {
    box(o, 'stone', [x - 0.26, A.upperFloor, z - 0.26], [x + 0.26, A.capitalTop, z + 0.26]);
    columnEvidence.push({
      id,
      center: [x, (A.shaftTop + A.shaftBottom) / 2, z],
      radius: A.radius,
      shaftBottom: A.shaftBottom,
      shaftTop: A.shaftTop,
    });
    return;
  }
  box(
    o,
    'stone',
    [x - A.baseWidth / 2, A.upperFloor, z - A.baseWidth / 2],
    [x + A.baseWidth / 2, A.shaftBottom, z + A.baseWidth / 2],
  );
  loft(
    o,
    'stone',
    [
      radialRing(A.shaftBottom, A.radius * 1.08, A.radius * 1.08, N, c),
      radialRing(A.shaftBottom + 0.22, A.radius, A.radius, N, c),
      radialRing(A.shaftTop, A.radius * 0.85, A.radius * 0.85, N, c),
    ],
    C.stone,
    { cap: true },
  );
  box(o, 'stone', [x - 0.34, A.shaftTop, z - 0.34], [x + 0.34, A.capitalTop, z + 0.34]);
  if (lod >= 2) {
    loft(
      o,
      'stone',
      [
        radialRing(A.shaftTop - 0.14, 0.2, 0.2, N, c),
        radialRing(A.shaftTop + 0.08, 0.31, 0.31, N, c),
      ],
      C.stone,
      { cap: true },
    );
    box(o, 'stone', [x - 0.37, A.capitalTop - 0.1, z - 0.37], [x + 0.37, A.capitalTop, z + 0.37]);
  }
  columnEvidence.push({
    id,
    center: [x, (A.shaftTop + A.shaftBottom) / 2, z],
    radius: A.radius,
    shaftBottom: A.shaftBottom,
    shaftTop: A.shaftTop,
  });
}
function veranda(o, lod) {
  const A = P.colonnade,
    S = P.sideVeranda;
  box(o, 'stone', [A.x0, 5.1, 0], [A.x1, 5.5, 4.5]);
  box(o, 'stone', [S.x0, 5.1, 0], [0, 5.5, S.z1]);
  for (let i = 0; i < A.columns; i++) {
    const x = A.x0 + ((A.x1 - A.x0) * i) / (A.columns - 1);
    column(o, x, A.frontZ, lod, `front-column-${i}`);
    box(o, 'plaster', [x - 0.325, P.baseFloorY, 0], [x + 0.325, 5.1, 0.65]);
  }
  for (let i = 0; i < S.columns; i++) {
    const z = S.z0 + ((S.z1 - S.z0) * i) / (S.columns - 1);
    column(o, S.x0 + 0.18, z, lod, `west-return-column-${i}`);
    box(o, 'plaster', [S.x0, P.baseFloorY, z - 0.325], [S.x0 + 0.65, 5.1, z + 0.325]);
  }
  box(o, 'plaster', [A.x0, 10.2, -0.18], [A.x1, 10.55, 4.5]);
  box(o, 'plaster', [-3.85, 10.2, -0.18], [0, 10.5, 21.25]);
  soffitEvidence.push(
    { id: 'front-colonnade-ceiling', point: [22, 10.2, 2.2] },
    { id: 'west-return-ceiling', point: [-1.5, 10.2, 10] },
  );
  face(
    o,
    'roof',
    [
      [-4.05, 10.6, -0.2],
      [0, 11, -0.2],
      [0, 11, 21.3],
      [-4.05, 10.6, 21.3],
    ],
    [-0.1, 1, 0],
  );
  if (lod > 0) {
    for (const z of [0, 0.18])
      beam(o, 'stone', [5.5, 5.62, z], [38.5, 5.62, z], 0.12, 0.12, C.stone);
    for (let i = 0; i < 4; i++) {
      const top = (i + 1) * 0.15,
        z = -4 * 0.38 + i * 0.38;
      box(o, 'stone', [20.35, Math.min(-0.15, top - 0.2), z], [23.65, top, 0]);
      stairEvidence.push({ id: `entry-step-${i}`, point: [22, top, z + 0.17] });
    }
  }
  partEvidence.push({
    id: 'whole-open-front-and-west-return-verandas',
    openUpperBays: 8,
    upperColumns: 15,
    lowerPiers: 15,
  });
}
function cornices(o, lod) {
  for (const [y, h, p] of lod === 0
    ? [[10.6, 0.6, 0.5]]
    : [
        [10.2, 0.22, 0.22],
        [10.42, 0.22, 0.35],
        [10.64, 0.3, 0.52],
        [10.94, 0.26, 0.7],
      ]) {
    for (const [a, b] of [
      [
        [-p, -p],
        [44 + p, -p],
      ],
      [
        [44 + p, -p],
        [44 + p, 25 + p],
      ],
      [
        [44 + p, 25 + p],
        [-p, 25 + p],
      ],
      [
        [-p, 25 + p],
        [-p, -p],
      ],
    ])
      beam(o, 'stone', [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]], h, p * 0.5 + 0.2, C.stone);
  }
  if (lod >= 2)
    for (let i = 0; i < 63; i++) {
      const x = 0.4 + (i * 43.2) / 62;
      box(o, 'stone', [x - 0.1, 10.51, -0.55], [x + 0.1, 10.69, -0.15]);
    }
  partEvidence.push({ id: 'projecting-square-cornice-all-four-main-sides' });
}
function roofDetails(o, lod) {
  for (const v of P.roof.vents) {
    const x0 = v.x - v.width / 2,
      x1 = v.x + v.width / 2,
      z0 = v.z - v.depth / 2,
      z1 = v.z + v.depth / 2;
    box(o, 'wood', [x0, v.bottom, z0], [x1, v.top - 0.32, z1]);
    hip(
      o,
      {
        id: v.id,
        x0: x0 - 0.13,
        x1: x1 + 0.13,
        z0: z0 - 0.13,
        z1: z1 + 0.13,
        eave: v.top - 0.3,
        ridge: v.top,
      },
      lod,
    );
    if (lod > 0) {
      for (let i = 0; i < (lod === 3 ? 9 : 4); i++) {
        const x = x0 + 0.14 + ((v.width - 0.28) * i) / (lod === 3 ? 8 : 3);
        beam(
          o,
          'iron',
          [x, v.bottom + 0.1, z0 - 0.025],
          [x, v.top - 0.4, z0 - 0.025],
          0.065,
          0.06,
          C.iron,
        );
      }
    }
    partEvidence.push({ id: v.id, closedRooflight: true });
  }
  for (const [c, i] of P.roof.chimneys.map((c, i) => [c, i])) {
    box(o, 'plaster', [c.x - 0.4, c.bottom, c.z - 0.38], [c.x + 0.4, c.top - 0.15, c.z + 0.38]);
    box(o, 'stone', [c.x - 0.55, c.top - 0.15, c.z - 0.5], [c.x + 0.55, c.top, c.z + 0.5]);
    if (lod >= 2)
      box(
        o,
        'iron',
        [c.x - 0.32, c.top + 0.001, c.z - 0.26],
        [c.x + 0.32, c.top + 0.04, c.z + 0.26],
      );
    partEvidence.push({ id: `chimney-${i}` });
  }
  if (lod >= 2) {
    for (const x of [0.4, 43.6])
      beam(o, 'iron', [x, 0.7, -0.1], [x, 10.35, -0.1], 0.1, 0.1, C.iron);
  }
}
export function buildHouse(out, _frame, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    windowEvidence,
    roofEvidence,
    soffitEvidence,
    columnEvidence,
    stairEvidence,
    entryEvidence,
  ])
    a.length = 0;
  const o = {
    addConvexPolygon: (k, r, p, n, _uv, col) =>
      out.addConvexPolygon(k, r, p.map(toWorld), rotate(n), (p) => [p[0], p[1]], col),
    addTriangle: (k, r, p, n, uv, col) => out.addTriangle(k, r, p.map(toWorld), rotate(n), uv, col),
    addQuad: (k, r, p, n, uv, col) => out.addQuad(k, r, p.map(toWorld), rotate(n), uv, col),
  };
  body(o, P.body, lod, { main: true });
  for (const s of P.endPavilions) body(o, s, lod, { pavilion: true });
  for (const s of P.rearRanges) {
    body(o, s, lod);
    hip(o, { ...s, x0: s.x0 - 0.35, x1: s.x1 + 0.35, z0: s.z0 - 0.35, z1: s.z1 + 0.35 }, lod);
  }
  veranda(o, lod);
  cornices(o, lod);
  hip(o, P.roof, lod);
  roofDetails(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/we/wec/government_house_hong_kong',
  cam = (p) => toWorld(p),
  camera = cam([70, 38, -75]),
  look = cam([20, 6, 14]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Government House, Hong Kong (original house,1870s)',
  cell: 'we/wec',
  wikidataId: 'Q838415',
  category: 'residence',
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
  portableGroundY: -5.4,
  mediumFiContext: {
    scale: 1,
    groundY: -5.4,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'tile_flat',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'whole-original-house-colonnade-end-bays-and-rear', position: camera, lookAt: look },
    {
      name: 'whole-hidden-rear-service-returns-and-closed-roofs',
      position: cam([-56, 43, 82]),
      lookAt: look,
    },
    {
      name: 'upper-eight-bay-open-colonnade-and-simple-capitals',
      position: cam([22, 9.8, -34]),
      lookAt: cam([22, 8, 2]),
    },
    {
      name: 'west-side-veranda-whole-lower-floor-and-rear-range',
      position: cam([-38, 18, -22]),
      lookAt: cam([0, 6, 17]),
    },
    {
      name: 'inside-open-colonnade-floor-ceiling-recessed-windows',
      position: cam([9, 7.4, 1.6]),
      lookAt: cam([26, 8, 4.2]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-original-house-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry/repository license. Exact already-cleared published2081x1483LaiAfong1870soriginal/nativePD-old-70/creator1839–1890/hash/revision and specificGettyalbumleaf bound under unchanged publishedpublicdomainpolicy. CurrentOSMODbL27controlphysicalhouse42258038/separate23controlopenestate392192459 only approximate historicalsitecontext, never extruded modernplan. AMOtext separates1855original/1889annex/1941–45tower. Whole hiddenlower/rear/roof/sections/registration/grade are bounded estimates. No questionableimagery, officialcopyright photos, photographictextures/generatedbitmaps, copiedstatue/fountain/garden/interiorart, signs/people/boats/neighbors or Quallamedia/rights edits.',
};
