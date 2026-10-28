/** Original1857–1870 theatre: primary old dimensions, complete exterior, bounded hidden topology. */
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
  W = P.workingFrame,
  ref = 'palette:#ffffff';
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84, metallic: 0.45 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.25 },
  glass: { slot: 'window', localRef: ref, roughness: 0.42, metallic: 0 },
};
const C = {
  wall: rgb('cfc9b9'),
  trim: rgb('e3ddcf'),
  roof: rgb('777b76'),
  wood: rgb('4c514a'),
  iron: rgb('434a45'),
  glass: rgb('34423f'),
};
export const toWorld = ([u, y, v]) => [
  W.origin[0] + W.alongFront[0] * u + W.alongDepth[0] * v,
  y,
  W.origin[1] + W.alongFront[1] * u + W.alongDepth[1] * v,
];
const vector = ([u, y, v]) => [
    W.alongFront[0] * u + W.alongDepth[0] * v,
    y,
    W.alongFront[1] * u + W.alongDepth[1] * v,
  ],
  inverse = ([x, y, z]) => [
    (x - W.origin[0]) * W.alongFront[0] + (z - W.origin[1]) * W.alongFront[1],
    y,
    (x - W.origin[0]) * W.alongDepth[0] + (z - W.origin[1]) * W.alongDepth[1],
  ],
  lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  _pt = ([u, v], y) => [u, y, v];
function workingOut(o) {
  return {
    addTriangle: (s, r, ps, n, uv, c) => o.addTriangle(s, r, ps.map(toWorld), vector(n), uv, c),
    addQuad: (s, r, ps, n, uv, c) => o.addQuad(s, r, ps.map(toWorld), vector(n), uv, c),
    addConvexPolygon: (s, r, ps, n, uv, c) =>
      o.addConvexPolygon(s, r, ps.map(toWorld), vector(n), (p) => uv(inverse(p)), c),
  };
}
export const partEvidence = [],
  windowEvidence = [],
  roofEvidence = [],
  stairEvidence = [],
  columnEvidence = [],
  pilasterEvidence = [],
  archEvidence = [];
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
    face(o, k, ps, n, col);
}
function roof(o, a, b, c, d, y0, y1, lod, id) {
  const L = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(d[0] - c[0], d[1] - c[1])),
    waves = lod >= 2 ? Math.max(1, Math.ceil(L / (lod >= 3 ? P.roof.pitch : 1.3))) : 1,
    ns = lod >= 2 ? waves * 2 : 1,
    nt = lod >= 3 ? 4 : lod >= 2 ? 2 : 1,
    at = (s, t) => {
      const p = lerp(lerp(a, b, s), lerp(c, d, s), t);
      return [
        p[0],
        y0 +
          (y1 - y0) * t +
          (lod >= 2
            ? P.roof.relief * Math.sin(s * waves * Math.PI) ** 2 * Math.sin(t * Math.PI)
            : 0),
        p[1],
      ];
    };
  for (let i = 0; i < ns; i++)
    for (let j = 0; j < nt; j++) {
      const ps = [
        at(i / ns, j / nt),
        at((i + 1) / ns, j / nt),
        at((i + 1) / ns, (j + 1) / nt),
        at(i / ns, (j + 1) / nt),
      ];
      for (const q of [
        [ps[0], ps[1], ps[2]],
        [ps[0], ps[2], ps[3]],
      ]) {
        const A = q[1].map((v, i) => v - q[0][i]),
          B = q[2].map((v, i) => v - q[0][i]);
        if (
          Math.hypot(
            A[1] * B[2] - A[2] * B[1],
            A[2] * B[0] - A[0] * B[2],
            A[0] * B[1] - A[1] * B[0],
          ) < 1e-8
        )
          continue;
        let n = normalFor(...q);
        if (n[1] < 0) n = n.map((v) => -v);
        face(o, 'roof', q, n);
      }
    }
  roofEvidence.push({ id, a, b, c, d, y0, y1, waves, ns, nt });
}
function archWindow(o, center, normal, bottom, width, height, lod, id) {
  const [u, v] = center,
    t = [normal[2], 0, -normal[0]],
    at = (x, y, d = 0.04) => [u + t[0] * x + normal[0] * d, y, v + t[2] * x + normal[2] * d],
    r = width / 2,
    rise = Math.min(r, height * 0.4),
    spring = bottom + height - rise,
    N = lod >= 3 ? 18 : lod >= 2 ? 12 : lod >= 1 ? 6 : 3,
    ps = [at(-r, bottom), at(r, bottom)];
  for (let i = 0; i <= N; i++) {
    const a = (Math.PI * i) / N;
    ps.push(at(Math.cos(a) * r, spring + Math.sin(a) * rise));
  }
  face(o, 'glass', ps, normal);
  windowEvidence.push({ id, center, normal, bottom, width, height });
  if (lod >= 1) {
    const border = id.startsWith('front') ? P.frontWindows.border : 0.21;
    for (const sign of [-1, 1])
      beam(
        o,
        'trim',
        at(sign * (r + border * 0.5), bottom),
        at(sign * (r + border * 0.5), spring),
        border,
        0.18,
        C.trim,
      );
    for (let i = 0; i < N; i++) {
      const a = (Math.PI * i) / N,
        b = (Math.PI * (i + 1)) / N,
        pp = (R, H, t) => at(Math.cos(t) * R, spring + Math.sin(t) * H, 0.09);
      face(
        o,
        'trim',
        [
          pp(r, rise, a),
          pp(r + border, rise + border, a),
          pp(r + border, rise + border, b),
          pp(r, rise, b),
        ],
        normal,
      );
    }
    beam(o, 'trim', at(-r - border, bottom), at(r + border, bottom), 0.14, 0.22, C.trim);
    if (lod >= 2) {
      beam(o, 'wood', at(0, bottom, 0.1), at(0, spring + rise, 0.1), 0.06, 0.06, C.wood);
      beam(
        o,
        'wood',
        at(-r, bottom + height * 0.45, 0.1),
        at(r, bottom + height * 0.45, 0.1),
        0.07,
        0.07,
        C.wood,
      );
    }
  }
}
function gabledBlock(o, b, lod, id, bottom = P.baseFloorY) {
  box(o, 'wall', [b.u0, bottom, b.v0], [b.u1, b.eave, b.v1]);
  const mid = (b.u0 + b.u1) / 2;
  for (const [v, n] of [
    [b.v0, [0, 0, -1]],
    [b.v1, [0, 0, 1]],
  ])
    face(
      o,
      'wall',
      [
        [b.u0, b.eave, v],
        [b.u1, b.eave, v],
        [mid, b.ridge, v],
      ],
      n,
    );
  roof(o, [b.u0, b.v0], [b.u0, b.v1], [mid, b.v0], [mid, b.v1], b.eave, b.ridge, lod, `${id}-west`);
  roof(o, [b.u1, b.v1], [b.u1, b.v0], [mid, b.v1], [mid, b.v0], b.eave, b.ridge, lod, `${id}-east`);
  if (lod >= 1)
    beam(o, 'roof', [mid, b.ridge + 0.025, b.v0], [mid, b.ridge + 0.025, b.v1], 0.13, 0.1, C.roof);
}
function foundation(o, b) {
  box(o, 'trim', [b.u0, P.foundationBottomY, b.v0], [b.u1, P.baseFloorY, b.v1]);
}
function column(o, u, v, lod, index) {
  const A = P.portico,
    y0 = P.baseFloorY,
    y1 = P.portico.upperFloor - 0.18;
  if (lod === 0)
    box(
      o,
      'trim',
      [u - A.columnRadius, y0, v - A.columnRadius],
      [u + A.columnRadius, y1, v + A.columnRadius],
    );
  else {
    const ys = [y0, y0 + 0.25, y0 + 0.4, y1 - 0.5, y1 - 0.25, y1],
      rs = [0.43, 0.43, A.columnRadius, A.columnRadius * 0.92, 0.38, 0.46];
    loft(
      o,
      'trim',
      ys.map((y, i) => radialRing(y, rs[i], rs[i], lod >= 3 ? 20 : lod >= 2 ? 12 : 6, [u, v])),
      C.trim,
    );
    box(o, 'trim', [u - 0.47, y1 - 0.08, v - 0.47], [u + 0.47, y1 + 0.08, v + 0.47]);
    if (lod >= 3)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          r = A.columnRadius + 0.005;
        beam(
          o,
          'trim',
          [u + Math.cos(a) * r, y0 + 0.5, v + Math.sin(a) * r],
          [u + Math.cos(a) * r, y1 - 0.55, v + Math.sin(a) * r],
          0.018,
          0.018,
          C.trim,
        );
      }
  }
  columnEvidence.push({ index, u, v, radius: A.columnRadius, bottom: y0, top: y1 });
}
function openArch(o, center, lod, index) {
  const A = P.portico,
    N = lod >= 3 ? 24 : lod >= 2 ? 16 : lod >= 1 ? 8 : 4,
    r = A.archRadius,
    spring = A.springY,
    top = A.upperFloor - 0.18,
    front = 0,
    back = A.archDepth;
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * i) / N,
      b = (Math.PI * (i + 1)) / N,
      ua = center + Math.cos(a) * r,
      ub = center + Math.cos(b) * r,
      ya = spring + Math.sin(a) * r,
      yb = spring + Math.sin(b) * r;
    for (const [v, n] of [
      [front, [0, 0, -1]],
      [back, [0, 0, 1]],
    ])
      face(
        o,
        'wall',
        [
          [ua, ya, v],
          [ub, yb, v],
          [ub, top, v],
          [ua, top, v],
        ],
        n,
      );
    const ps = [
        [ua, ya, front],
        [ua, ya, back],
        [ub, yb, back],
        [ub, yb, front],
      ],
      normal = [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0];
    face(o, 'trim', ps, normal);
    if (lod >= 1) {
      const at = (R, t) => [center + Math.cos(t) * R, spring + Math.sin(t) * R, -0.035];
      face(o, 'trim', [at(r, a), at(r + 0.19, a), at(r + 0.19, b), at(r, b)], [0, 0, -1]);
    }
  }
  archEvidence.push({ index, center, spring, radius: r, front, back, top });
}
function door(o, u, v, lod) {
  box(o, 'wood', [u - 1.05, P.baseFloorY, v - 0.04], [u + 1.05, P.baseFloorY + 3.7, v + 0.03]);
  if (lod >= 1) {
    for (const x of [u - 1, u, u + 1])
      beam(
        o,
        'wood',
        [x, P.baseFloorY, v - 0.08],
        [x, P.baseFloorY + 3.7, v - 0.08],
        0.08,
        0.08,
        C.wood,
      );
    beam(
      o,
      'iron',
      [u - 0.12, P.baseFloorY + 1.3, v - 0.14],
      [u - 0.12, P.baseFloorY + 1.6, v - 0.14],
      0.035,
      0.035,
      C.iron,
    );
  } else if (Math.abs(u) < 1e-6)
    beam(
      o,
      'iron',
      [u - 0.12, P.baseFloorY + 1.3, v - 0.14],
      [u - 0.12, P.baseFloorY + 1.6, v - 0.14],
      0.035,
      0.035,
      C.iron,
    );
}
function panelPilaster(o, u, y0, y1, lod, index) {
  if (lod === 0)
    face(
      o,
      'trim',
      [
        [u - 0.225, y0, -0.035],
        [u + 0.225, y0, -0.035],
        [u + 0.225, y1, -0.035],
        [u - 0.225, y1, -0.035],
      ],
      [0, 0, -1],
    );
  else {
    box(o, 'trim', [u - 0.225, y0, -0.12], [u + 0.225, y1, 0.22]);
    for (const y of [y0 + 0.15, y1 - 0.15])
      box(o, 'trim', [u - 0.34, y - 0.12, -0.17], [u + 0.34, y + 0.12, 0.28]);
  }
  pilasterEvidence.push({ index, u, y0, y1 });
}
export function buildHouse(out, _frame, lod = 3) {
  const o = workingOut(out);
  for (const a of [
    partEvidence,
    windowEvidence,
    roofEvidence,
    stairEvidence,
    columnEvidence,
    pilasterEvidence,
    archEvidence,
  ])
    a.length = 0;
  const F = P.frontBlock,
    A = P.portico;
  for (const b of [F, P.main, P.stage, ...P.wings, ...P.frontConnections, ...P.rearConnections])
    foundation(o, b);
  // Ground vestibule envelope behind the open portico; upper philharmonic envelope is complete.
  box(o, 'wall', [F.u0, P.baseFloorY, A.depth], [F.u1, A.upperFloor, F.v1]);
  gabledBlock(o, F, lod, 'whole-front-philharmonic-roof', A.upperFloor);
  box(o, 'trim', [F.u0, P.baseFloorY - 0.18, 0], [F.u1, P.baseFloorY, A.depth]);
  for (const u of [-15, 15])
    box(o, 'wall', [u < 0 ? u : u - 0.45, P.baseFloorY, 0], [u < 0 ? u + 0.45 : u, F.eave, F.v1]);
  const bay = A.length / A.bays;
  for (let i = 0; i < A.bays; i++) {
    const c = -15 + bay * (i + 0.5);
    openArch(o, c, lod, i);
    door(o, c, A.depth - 0.03, lod);
    archWindow(
      o,
      [c, 0],
      [0, 0, -1],
      P.frontWindows.bottom,
      P.frontWindows.width,
      P.frontWindows.height,
      lod,
      `front-${i}`,
    );
  }
  for (let i = 0; i < A.pilasterStations.length; i++) {
    const u = A.pilasterStations[i],
      half = (bay - 2 * A.archRadius) / 2;
    box(
      o,
      'wall',
      [u - (i === 0 ? 0 : half), P.baseFloorY, 0],
      [u + (i === 7 ? 0 : half), A.springY, A.archDepth],
    );
    panelPilaster(o, u, P.baseFloorY, A.upperFloor - 0.3, lod, i);
    panelPilaster(o, u, A.upperFloor, F.eave - 0.2, lod, 8 + i);
  }
  let ci = 0;
  for (const u of A.columnStations)
    for (const v of A.pairedColumnDepths) column(o, u, v, lod, ci++);
  box(o, 'trim', [-15, A.upperFloor - 0.2, -0.22], [15, A.upperFloor, 0.28]);
  box(o, 'trim', [-15, F.eave - 0.22, -0.25], [15, F.eave + 0.06, 0.35]);
  box(o, 'wall', [-15, P.frontParapet.base, -0.05], [15, P.frontParapet.top, 0.55]);
  box(o, 'trim', [-15, P.frontParapet.top - 0.12, -0.2], [15, P.frontParapet.top + 0.05, 0.68]);
  const G = P.pediment;
  face(
    o,
    'wall',
    [
      [-G.halfWidth, G.base, -0.22],
      [G.halfWidth, G.base, -0.22],
      [0, G.top, -0.22],
    ],
    [0, 0, -1],
  );
  face(
    o,
    'wall',
    [
      [G.halfWidth, G.base, G.depth],
      [-G.halfWidth, G.base, G.depth],
      [0, G.top, G.depth],
    ],
    [0, 0, 1],
  );
  for (const sign of [-1, 1]) {
    face(
      o,
      'roof',
      [
        [sign * G.halfWidth, G.base, -0.22],
        [0, G.top, -0.22],
        [0, G.top, G.depth],
        [sign * G.halfWidth, G.base, G.depth],
      ],
      [0, 1, 0],
    );
    if (lod >= 1)
      beam(o, 'trim', [sign * G.halfWidth, G.base, -0.31], [0, G.top, -0.31], 0.23, 0.23, C.trim);
  }
  for (const [b, id] of [
    [P.main, 'whole-original-auditorium'],
    [P.stage, 'whole-original-stage'],
    ...P.wings.map((b, i) => [b, `estimated-side-wing-${i}`]),
    ...P.frontConnections.map((b, i) => [b, `estimated-front-service-return-${i}`]),
    ...P.rearConnections.map((b, i) => [b, `estimated-rear-service-return-${i}`]),
  ])
    gabledBlock(o, b, lod, id);
  for (const c of P.courts)
    box(o, 'trim', [c.u0, P.baseFloorY - 0.15, c.v0], [c.u1, P.baseFloorY, c.v1]);
  if (lod >= 1) {
    for (const [w, wi] of P.wings.map((b, i) => [b, i])) {
      for (const u of [w.u0, w.u1])
        for (let j = 0; j < 8; j++)
          for (const y of [1.8, 8.0])
            archWindow(
              o,
              [u, 10 + j * 6.5],
              [u === w.u0 ? -1 : 1, 0, 0],
              y,
              1.25,
              2.8,
              lod >= 3 ? 2 : 0,
              `estimated-wing-${wi}-${u}-${j}-${y}`,
            );
      for (let j = 0; j < 2; j++)
        for (const y of [1.8, 8])
          archWindow(
            o,
            [w.u0 + 2.5 + j * 4, w.v0],
            [0, 0, -1],
            y,
            1.25,
            2.8,
            lod >= 3 ? 2 : 0,
            `estimated-wing-front-${wi}-${j}-${y}`,
          );
      if (lod >= 2)
        for (const y of [P.floorLevels[1], w.eave - 0.1])
          for (const u of [w.u0, w.u1])
            beam(o, 'trim', [u, y, w.v0], [u, y, w.v1], 0.16, 0.18, C.trim);
    }
    for (const u of [-14, 14])
      for (let j = 0; j < 4; j++)
        archWindow(
          o,
          [u, 22 + j * 7],
          [u < 0 ? -1 : 1, 0, 0],
          8.0,
          1.35,
          3.0,
          lod >= 3 ? 2 : 0,
          `estimated-auditorium-court-${u}-${j}`,
        );
    for (const u of [-9, 0, 9])
      archWindow(
        o,
        [u, P.stage.v1],
        [0, 0, 1],
        7.7,
        1.6,
        3.1,
        lod >= 3 ? 2 : 0,
        `estimated-stage-rear-${u}`,
      );
  }
  for (let j = 0; j < P.entry.steps; j++) {
    const v = -(P.entry.steps - j - 0.5) * P.entry.tread,
      y = (j + 1) * P.entry.rise;
    box(
      o,
      'trim',
      [-P.entry.width / 2, y - 0.2, v - P.entry.tread / 2],
      [P.entry.width / 2, y, v + P.entry.tread / 2],
    );
    stairEvidence.push({ index: j + 1, u: 0, v, y });
  }
  partEvidence.push(
    {
      id: 'complete-original-classical-front-and-open-portico',
      frontLength: 30,
      arches: 7,
      columns: 12,
      pilasters: 16,
    },
    { id: 'whole-primary-vestibule-and-upper-philharmonic-envelope', vestibule: P.vestibule },
    { id: 'whole-original-auditorium-stage-and-closed-roofs', auditorium: P.main, stage: P.stage },
    {
      id: 'complete-estimated-side-and-rear-service-wings',
      wings: P.wings,
      frontConnections: P.frontConnections,
      rearConnections: P.rearConnections,
    },
    { id: 'two-open-estimated-intrinsic-courts', courts: P.courts },
    { id: 'whole-original-entry-and-three-steps', steps: 3, frontWidth: 30 },
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/66/66j/municipal_theatre_of_santiago',
  camera = (u, y, v) => toWorld([u, y, v]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Municipal Theatre, Santiago (original1857–1870)',
  cell: '66/66j',
  wikidataId: 'Q6936293',
  category: 'theatre',
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
  camera: camera(90, 55, -90),
  lookAt: camera(0, 6, 27),
  portableGroundY: -1.7,
  mediumFiContext: {
    scale: 1,
    groundY: -1.7,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'metal_standing_seam',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-original-theatre-classical-portico-and-all-wings',
      position: camera(90, 55, -90),
      lookAt: camera(0, 6, 27),
    },
    {
      name: 'whole-estimated-rear-stage-and-open-courts',
      position: camera(-95, 60, 120),
      lookAt: camera(0, 6, 28),
    },
    {
      name: 'seven-open-arches-twelve-columns-and-sixteen-pilasters',
      position: camera(24, 9, -24),
      lookAt: camera(0, 7, 0),
    },
    {
      name: 'inside-original-open-portico-and-vestibule-doors',
      position: camera(8, 2.3, 2.3),
      lookAt: camera(-8, 3.8, 1),
    },
    {
      name: 'upper-arched-bays-and-classical-pediment',
      position: camera(13, 17, -14),
      lookAt: camera(0, 13.5, 0),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-original-theatre-${reviewLod}`,
    position: camera(90, 55, -90),
    lookAt: camera(0, 6, 27),
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
    'Original authored geometry/repository license. Qualla-first45families/zero conflicts precedes exact original1872ChileIlustrado public-domainbook/nativePD-old100/SHA1/SHA256/revision, actual title/oldtheatreplate/pasttensetext/newplan distinction personally inspected. Book authorTornero1842–1902not assumed uncredited woodengraver. OSM ODbL actual current theatre site context/Q6936293. No attribution-only/current images, questionable sources, source/media/rights repairs, proposednew measurements as oldsurvey, copied photographic textures or generated bitmaps.',
};
