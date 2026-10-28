/** Full historical prefire Empire Theatre. Hidden roof/back are bounded estimates, never current1933 architecture. */
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
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.83, metallic: 0.45 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.3 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0 },
};
const C = {
  brick: rgb('a46e53'),
  trim: rgb('d8cdb6'),
  roof: rgb('777c72'),
  wood: rgb('504e3b'),
  iron: rgb('444a40'),
  glass: rgb('303b34'),
};
export const toWorld = ([u, y, v]) => [
  W.origin[0] + W.alongDepth[0] * u + W.alongFront[0] * v,
  y,
  W.origin[1] + W.alongDepth[1] * u + W.alongFront[1] * v,
];
const vector = ([u, y, v]) => [
    W.alongDepth[0] * u + W.alongFront[0] * v,
    y,
    W.alongDepth[1] * u + W.alongFront[1] * v,
  ],
  inverse = ([x, y, z]) => [
    (x - W.origin[0]) * W.alongDepth[0] + (z - W.origin[1]) * W.alongDepth[1],
    y,
    (x - W.origin[0]) * W.alongFront[0] + (z - W.origin[1]) * W.alongFront[1],
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
  finialEvidence = [],
  pierEvidence = [];
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
    waves = lod >= 2 ? Math.max(1, Math.ceil(L / (lod >= 3 ? P.roof.corrugationPitch : 1.3))) : 1,
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
function gable(o, b, lod, id) {
  box(o, 'brick', [b.u0, P.baseFloorY, b.v0], [b.u1, b.eave, b.v1]);
  const m = (b.v0 + b.v1) / 2;
  for (const [u, n] of [
    [b.u0, [-1, 0, 0]],
    [b.u1, [1, 0, 0]],
  ])
    face(
      o,
      'brick',
      [
        [u, b.eave, b.v0],
        [u, b.eave, b.v1],
        [u, b.ridge, m],
      ],
      n,
    );
  roof(o, [b.u0, b.v0], [b.u1, b.v0], [b.u0, m], [b.u1, m], b.eave, b.ridge, lod, `${id}-north`);
  roof(o, [b.u1, b.v1], [b.u0, b.v1], [b.u1, m], [b.u0, m], b.eave, b.ridge, lod, `${id}-south`);
  if (lod >= 1)
    beam(o, 'roof', [b.u0, b.ridge + 0.035, m], [b.u1, b.ridge + 0.035, m], 0.16, 0.14, C.roof);
}
function archWindow(o, center, normal, bottom, width, height, lod, id) {
  const [u, v] = center,
    t = [normal[2], 0, -normal[0]],
    at = (x, y, d = 0.04) => [u + t[0] * x + normal[0] * d, y, v + t[2] * x + normal[2] * d],
    r = width / 2,
    rise = Math.min(r, height * 0.4),
    spring = bottom + height - rise,
    N = lod >= 3 ? 18 : lod >= 2 ? 12 : lod >= 1 ? 6 : 4,
    ps = [at(-r, bottom), at(r, bottom)];
  for (let i = 0; i <= N; i++) {
    const a = (Math.PI * i) / N;
    ps.push(at(Math.cos(a) * r, spring + Math.sin(a) * rise));
  }
  face(o, 'glass', ps, normal);
  windowEvidence.push({ id, center, normal, bottom, width, height });
  if (lod >= 1) {
    const border = id.startsWith('front') ? P.frontWindows.whiteBorder : 0.21;
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
function curvedCap(o, center, lod) {
  const F = P.facade,
    N = lod >= 3 ? 24 : lod >= 2 ? 16 : lod >= 1 ? 8 : 4;
  for (let i = 0; i < N; i++) {
    const a = center - F.curveHalfWidth + (2 * F.curveHalfWidth * i) / N,
      b = center - F.curveHalfWidth + (2 * F.curveHalfWidth * (i + 1)) / N,
      ya = F.parapet + F.curveRise * Math.sin((Math.PI * i) / N),
      yb = F.parapet + F.curveRise * Math.sin((Math.PI * (i + 1)) / N);
    face(
      o,
      'brick',
      [
        [F.u, F.parapet - 0.2, a],
        [F.u, F.parapet - 0.2, b],
        [F.u, yb, b],
        [F.u, ya, a],
      ],
      [-1, 0, 0],
    );
    face(
      o,
      'brick',
      [
        [F.u + F.thickness, ya, a],
        [F.u + F.thickness, yb, b],
        [F.u + F.thickness, F.parapet - 0.2, b],
        [F.u + F.thickness, F.parapet - 0.2, a],
      ],
      [1, 0, 0],
    );
    face(
      o,
      'trim',
      [
        [F.u, ya, a],
        [F.u, yb, b],
        [F.u + F.thickness, yb, b],
        [F.u + F.thickness, ya, a],
      ],
      [0, 1, 0],
    );
    if (lod >= 1)
      beam(o, 'trim', [F.u - 0.04, ya + 0.035, a], [F.u - 0.04, yb + 0.035, b], 0.15, 0.15, C.trim);
  }
}
function finial(o, v, lod) {
  const F = P.finials,
    u = P.facade.u + 0.15;
  box(o, 'trim', [u - 0.53, F.base, v - 0.53], [u + 0.53, F.pedestalTop, v + 0.53]);
  box(o, 'trim', [u - 0.76, F.pedestalTop - 0.08, v - 0.76], [u + 0.76, F.bulbBase, v + 0.76]);
  const ys = [F.bulbBase, F.bulbBase + 0.3, F.bulbBase + 0.8, F.bulbTop - 0.4, F.bulbTop],
    rs = [0.48, 0.78, F.radius, 0.48, 0.12],
    rings = ys.map((y, i) =>
      radialRing(
        y,
        rs[i],
        rs[i],
        lod >= 3 ? 20 : lod >= 2 ? 12 : lod >= 1 ? 8 : 4,
        [u, v],
        Math.PI / 4,
      ),
    );
  loft(o, 'trim', rings, C.trim);
  box(o, 'trim', [u - 0.13, F.bulbTop, v - 0.13], [u + 0.13, F.stemTop, v + 0.13]);
  box(o, 'trim', [u - 0.42, F.stemTop - 0.08, v - 0.42], [u + 0.42, F.capTop, v + 0.42]);
  finialEvidence.push({
    v,
    u,
    top: F.capTop,
    base: F.base,
    bulbBase: F.bulbBase,
    bulbTop: F.bulbTop,
  });
}
function rectangularDoor(o, u, v, bottom, w, h, lod, id, outward = -1) {
  face(
    o,
    'wood',
    [
      [u + outward * 0.05, bottom, v - w / 2],
      [u + outward * 0.05, bottom, v + w / 2],
      [u + outward * 0.05, bottom + h, v + w / 2],
      [u + outward * 0.05, bottom + h, v - w / 2],
    ],
    [outward, 0, 0],
  );
  if (lod >= 1) {
    for (const vv of [v - w / 2, v, v + w / 2])
      beam(
        o,
        'wood',
        [u + outward * 0.09, bottom, vv],
        [u + outward * 0.09, bottom + h, vv],
        0.08,
        0.08,
        C.wood,
      );
    if (lod >= 2)
      for (const yy of [bottom + 0.5, bottom + 1.8])
        beam(
          o,
          'wood',
          [u + outward * 0.11, yy, v - w / 2],
          [u + outward * 0.11, yy, v + w / 2],
          0.06,
          0.06,
          C.wood,
        );
  }
  beam(
    o,
    'iron',
    [u + outward * 0.15, bottom + 1.1, v - 0.12],
    [u + outward * 0.15, bottom + 1.35, v - 0.12],
    0.035,
    0.035,
    C.iron,
  );
  return { id, u, v, bottom, width: w, height: h };
}
export function buildHouse(out, _frame, lod = 3) {
  const o = workingOut(out);
  for (const a of [
    partEvidence,
    windowEvidence,
    roofEvidence,
    stairEvidence,
    finialEvidence,
    pierEvidence,
  ])
    a.length = 0;
  const M = P.main,
    S = P.stage,
    F = P.facade;
  box(o, 'brick', [M.u0, P.foundationBottomY, M.v0], [S.u1, P.baseFloorY, M.v1]);
  gable(o, M, lod, 'whole-auditorium-roof');
  gable(o, S, lod, 'whole-original-stage-roof');
  box(o, 'brick', [F.u, P.baseFloorY, M.v0], [F.u + F.thickness, F.parapet, M.v1]);
  box(
    o,
    'brick',
    [F.u - 0.2, F.parapet, -F.centralHalfWidth],
    [F.u + F.thickness, F.centerTop, F.centralHalfWidth],
  );
  for (const c of F.curveCenters) curvedCap(o, c, lod);
  for (const v of F.pilasters) {
    // Preserve the fixed pier positions while keeping the actual covered door openings clear.
    const spansEntry = P.entry.centers.some(
      (c) => Math.abs(c - v) < P.entry.width / 2 + F.pilasterWidth / 2,
    );
    const lower = spansEntry ? P.baseFloorY + P.entry.height + 0.12 : P.baseFloorY;
    box(
      o,
      'brick',
      [F.u - F.pilasterProjection, lower, v - F.pilasterWidth / 2],
      [F.u + 0.1, F.parapet + 0.1, v + F.pilasterWidth / 2],
    );
    if (lod >= 1)
      for (const y of [P.baseFloorY + 0.3, 7.6, F.parapet - 0.15].filter((y) => y - 0.09 >= lower))
        box(
          o,
          'trim',
          [F.u - F.pilasterProjection - 0.06, y - 0.09, v - 0.45],
          [F.u + 0.16, y + 0.09, v + 0.45],
        );
    finial(o, v, lod);
  }
  for (const v of P.frontWindows.centers)
    for (const y of P.frontWindows.levels)
      archWindow(
        o,
        [F.u - 0.03, v],
        [-1, 0, 0],
        y,
        P.frontWindows.width,
        P.frontWindows.height,
        lod,
        `front-${v}-${y}`,
      );
  if (lod >= 1) {
    for (const v of [M.v0, M.v1])
      for (let i = 0; i < 7; i++)
        for (const y of [3.1, 8.6])
          archWindow(
            o,
            [4.8 + i * P.sideWindowPitchEstimate, v],
            [0, 0, v < 0 ? -1 : 1],
            y,
            1.5,
            2.4,
            lod,
            `estimated-side-${v}-${i}-${y}`,
          );
    for (const v of [-10, 0, 10])
      archWindow(o, [S.u1, v], [1, 0, 0], 8.4, 1.6, 2.5, lod, `estimated-stage-rear-${v}`);
    for (const v of [-10, 10])
      rectangularDoor(o, S.u1 + 0.1, v, P.baseFloorY, 1.8, 3, lod, 'rear-exit', 1);
  }
  const pr = P.porch,
    u = (pr.u0 + pr.u1) / 2,
    hip = 3.5;
  roof(
    o,
    [pr.u0, pr.v0],
    [pr.u0, pr.v1],
    [u, pr.v0 + hip],
    [u, pr.v1 - hip],
    pr.eave,
    pr.ridge,
    lod,
    'entry-porch-front-hip',
  );
  roof(
    o,
    [pr.u1, pr.v1],
    [pr.u1, pr.v0],
    [u, pr.v1 - hip],
    [u, pr.v0 + hip],
    pr.eave,
    pr.ridge,
    lod,
    'entry-porch-back-hip',
  );
  roof(
    o,
    [pr.u1, pr.v0],
    [pr.u0, pr.v0],
    [u, pr.v0 + hip],
    [u, pr.v0 + hip],
    pr.eave,
    pr.ridge,
    lod,
    'entry-porch-north-hip',
  );
  roof(
    o,
    [pr.u0, pr.v1],
    [pr.u1, pr.v1],
    [u, pr.v1 - hip],
    [u, pr.v1 - hip],
    pr.eave,
    pr.ridge,
    lod,
    'entry-porch-south-hip',
  );
  face(
    o,
    'wood',
    [
      [pr.u0, pr.eave - 0.08, pr.v0],
      [pr.u1, pr.eave - 0.08, pr.v0],
      [pr.u1, pr.eave - 0.08, pr.v1],
      [pr.u0, pr.eave - 0.08, pr.v1],
    ],
    [0, -1, 0],
  );
  for (const v of pr.piers) {
    box(
      o,
      'brick',
      [pr.pierU - pr.pierWidth / 2, P.baseFloorY, v - pr.pierWidth / 2],
      [pr.pierU + pr.pierWidth / 2, pr.eave - 0.1, v + pr.pierWidth / 2],
    );
    pierEvidence.push({ u: pr.pierU, v, width: pr.pierWidth, top: pr.eave - 0.1 });
    if (lod >= 1) {
      box(
        o,
        'trim',
        [pr.pierU - 0.4, pr.eave - 0.32, v - 0.4],
        [pr.pierU + 0.4, pr.eave - 0.1, v + 0.4],
      );
      beam(o, 'wood', [pr.u0, pr.eave - 0.12, v], [0, pr.eave - 0.12, v], 0.12, 0.2, C.wood);
    }
  }
  box(o, 'trim', [pr.u0, P.baseFloorY - 0.18, pr.v0], [pr.u1, P.baseFloorY, pr.v1]);
  const T = P.ticketBox;
  box(o, 'brick', [T.u0, P.baseFloorY, T.v0], [T.u1, T.top, T.v1]);
  box(o, 'roof', [T.u0 - 0.08, T.top, T.v0 - 0.08], [T.u1 + 0.08, T.top + 0.12, T.v1 + 0.08]);
  archWindow(
    o,
    [T.u0 - 0.025, 0],
    [-1, 0, 0],
    P.baseFloorY + 1.1,
    2.2,
    1.3,
    lod,
    'ticket-box-front',
  );
  for (const v of [T.v0, T.v1])
    archWindow(
      o,
      [(T.u0 + T.u1) / 2, v],
      [0, 0, v < 0 ? -1 : 1],
      P.baseFloorY + 1.1,
      1.3,
      1.3,
      lod,
      `ticket-box-side-${v}`,
    );
  for (const v of P.entry.centers) {
    rectangularDoor(
      o,
      F.u - 0.05,
      v,
      P.baseFloorY,
      P.entry.width,
      P.entry.height,
      lod,
      'covered-front-entry',
    );
    for (let j = 0; j < P.entry.steps; j++) {
      const u = pr.u0 - (P.entry.steps - j - 0.5) * P.entry.tread,
        y = (j + 1) * P.entry.rise;
      box(
        o,
        'trim',
        [u - P.entry.tread / 2, y - 0.15, v - 1.5],
        [u + P.entry.tread / 2, y, v + 1.5],
      );
      stairEvidence.push({ entry: v, index: j + 1, u, v, y });
    }
  }
  if (lod >= 1) {
    for (const sign of [-1, 1])
      beam(o, 'trim', [F.u - 0.25, 13.1, sign * 5.6], [F.u - 0.25, 14.7, 0], 0.25, 0.3, C.trim);
    face(
      o,
      'brick',
      [
        [F.u - 0.2, 13.1, -5.6],
        [F.u - 0.2, 13.1, 5.6],
        [F.u - 0.2, 14.7, 0],
      ],
      [-1, 0, 0],
    );
    roof(
      o,
      [F.u - 1, -5.7],
      [F.u + 0.5, -5.7],
      [F.u - 1, 0],
      [F.u + 0.5, 0],
      13.1,
      14.7,
      lod,
      'central-front-pediment-north',
    );
    roof(
      o,
      [F.u + 0.5, 5.7],
      [F.u - 1, 5.7],
      [F.u + 0.5, 0],
      [F.u - 1, 0],
      13.1,
      14.7,
      lod,
      'central-front-pediment-south',
    );
    if (lod >= 2) {
      for (const v of [-F.centralHalfWidth, F.centralHalfWidth])
        beam(o, 'brick', [F.u - 0.38, 13.2, v], [F.u - 0.38, F.centerTop, v], 0.32, 0.4, C.brick);
      for (const y of [13.15, F.centerTop - 0.1])
        beam(
          o,
          'trim',
          [F.u - 0.3, y, -F.centralHalfWidth],
          [F.u - 0.3, y, F.centralHalfWidth],
          0.18,
          0.22,
          C.trim,
        );
    }
  }
  partEvidence.push(
    { id: 'whole-prefire-masonry-auditorium', body: M },
    { id: 'whole-original-proscenium-stage-and-closed-roof', body: S, no1933Flytower: true },
    {
      id: 'complete-photo-led-brick-streetfront',
      curvedParapets: 2,
      finials: 4,
      pilasters: 4,
      centralTop: F.centerTop,
    },
    { id: 'intrinsic-low-hipped-entry-porch-and-ticket-box', porch: pr, ticketBox: T, piers: 4 },
    { id: 'two-covered-entries-and-six-steps', doors: 2, steps: 6 },
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r7/r7h/empire_theatre_toowoomba',
  camera = (u, y, v) => toWorld([u, y, v]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Empire Theatre, Toowoomba (pre-fire1911–1933)',
  cell: 'r7/r7h',
  wikidataId: 'Q7731948',
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
  camera: camera(-85, 50, 75),
  lookAt: camera(22, 6, 0),
  portableGroundY: -1.7,
  mediumFiContext: {
    scale: 1,
    groundY: -1.7,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick',
    'stone_limestone_raw',
    'metal_corrugated',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-prefire-theatre-brick-front-and-original-body',
      position: camera(-85, 50, 75),
      lookAt: camera(22, 6, 0),
    },
    {
      name: 'whole-estimated-original-stage-and-rear',
      position: camera(125, 50, -75),
      lookAt: camera(26, 6, 0),
    },
    {
      name: 'curved-parapets-and-four-onion-finials',
      position: camera(-27, 23, 18),
      lookAt: camera(0, 15, 0),
    },
    {
      name: 'low-entry-porch-ticketbox-and-brick-piers',
      position: camera(-18, 3.4, 14),
      lookAt: camera(-3, 2.5, 1),
    },
    {
      name: 'arched-white-window-dressings-and-pilasters',
      position: camera(-10, 11, -13),
      lookAt: camera(0, 11.3, -12),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-prefire-theatre-${reviewLod}`,
    position: camera(-85, 50, 75),
    lookAt: camera(22, 6, 0),
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
    'Original authored geometry under repository license. Exactly one already-cleared published Qualla named SirJohnRobertKemp native PD-Australia original4000x2340, exact native SHA1/revision/local SHA256 and unchanged published inventory pass. OSM ODbL whole current theatre site context/Q7731948 and primary QHR600978 historical scalar facts only. Full historical geometry/rear/roof estimated, not current1933replacement. No questionable/supplemental protected imagery, policy/media/rights metadata repairs, copied photographic textures or generated bitmaps.',
};
