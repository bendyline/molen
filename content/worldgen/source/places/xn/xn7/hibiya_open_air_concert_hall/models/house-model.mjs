/** Whole first Hibiya large outdoor concert hall,1937. Original field/frame/sections precede mesh. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  ref = 'palette:#ffffff';
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  glass: { slot: 'window', localRef: ref, roughness: 0.35, metallic: 0 },
};
const C = {
    plaster: rgb('ddd7c5'),
    stone: rgb('d6cfb9'),
    roof: rgb('6b716c'),
    wood: rgb('9c815e'),
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
  terraceEvidence = [],
  seatEvidence = [],
  archEvidence = [],
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
function cap(o, k, r, holes, y, n) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      ref,
      r,
      holes,
      () => y,
      n,
      (p) => p,
      C[k],
    )
  )
    throw Error('Hall cap failed');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const ps = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    o.addTriangle(
      k,
      ref,
      ps,
      n,
      ps.map((p) => [p[0], p[2]]),
      C[k],
    );
  }
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  radians = (x) => (x * Math.PI) / 180;
function makeEdge(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L],
    n = [u[2], 0, -u[0]];
  return {
    L,
    u,
    n,
    at: (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d],
  };
}
function closedBody(o, s, lod, id, windows = true) {
  const r = rectangle(s);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      N = Math.max(1, Math.floor(L / (lod === 1 ? 10 : 5.2))),
      wins = [];
    if (windows)
      for (let j = 0; j < N; j++)
        for (const y of P.stage.rearWindowBottoms)
          wins.push({ id: `rear-sash-${j}-${y}`, t: (L * (j + 0.5)) / N, y, w: 1.3, h: 2.3 });
    wall(o, a, b, s.bottom, s.top, wins, lod, `${id}-${i}`);
  }
  box(o, 'roof', [s.x0, s.top - 0.05, s.z0], [s.x1, s.top + 0.25, s.z1]);
  roofEvidence.push({
    id: `${id}-closed-roof`,
    point: [(s.x0 + s.x1) / 2, s.top + 0.25, (s.z0 + s.z1) / 2],
  });
  partEvidence.push({ id, wholeRearServiceBody: true, closedRoof: true });
}
function circlePanel(o, E, { id, cx, cy, radius, lo, hi, depth }, lod) {
  const angles = [
    ...Array.from(
      { length: [4, 8, 16, 24][lod] },
      (_, i) => (i * 2 * Math.PI) / [4, 8, 16, 24][lod],
    ),
    ...[
      [E.L - cx, hi - cy],
      [-cx, hi - cy],
      [-cx, lo - cy],
      [E.L - cx, lo - cy],
    ].map(([x, y]) => (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI)),
  ].sort((a, b) => a - b);
  for (let i = 0; i < angles.length; i++) {
    const aa = angles[i],
      bb = angles[(i + 1) % angles.length],
      q = (t) => {
        const u = Math.cos(t),
          v = Math.sin(t),
          k = Math.min(
            u > 0 ? (E.L - cx) / u : u < 0 ? -cx / u : Infinity,
            v > 0 ? (hi - cy) / v : v < 0 ? (lo - cy) / v : Infinity,
          );
        return {
          inner: E.at(cx + radius * u, cy + radius * v),
          back: E.at(cx + radius * u, cy + radius * v, -depth),
          outer: E.at(cx + k * u, cy + k * v),
        };
      };
    const x = q(aa),
      y = q(bb);
    if (Math.hypot(...x.inner.map((v, i) => v - y.inner[i])) < 0.00001) continue;
    face(o, 'plaster', [x.inner, y.inner, y.outer, x.outer], E.n);
    face(
      o,
      'stone',
      [x.inner, x.back, y.back, y.inner],
      E.u.map((v, j) => -v * Math.cos((aa + bb) / 2) - (j === 1 ? Math.sin((aa + bb) / 2) : 0)),
    );
  }
  const ps = Array.from({ length: [8, 12, 20, 28][lod] }, (_, i) =>
    E.at(
      cx + radius * Math.cos((i * 2 * Math.PI) / [8, 12, 20, 28][lod]),
      cy + radius * Math.sin((i * 2 * Math.PI) / [8, 12, 20, 28][lod]),
      -depth - 0.01,
    ),
  );
  face(o, 'glass', ps, E.n);
  windowEvidence.push({ id, center: E.at(cx, cy, -depth - 0.01), normal: E.n });
  if (lod >= 2)
    for (let i = 0; i < 24; i++) {
      const a = (i * 2 * Math.PI) / 24,
        b = ((i + 1) * 2 * Math.PI) / 24;
      beam(
        o,
        'iron',
        E.at(cx + (radius + 0.06) * Math.cos(a), cy + (radius + 0.06) * Math.sin(a), 0.02),
        E.at(cx + (radius + 0.06) * Math.cos(b), cy + (radius + 0.06) * Math.sin(b), 0.08),
        0.09,
        0.08,
        C.iron,
      );
    }
}
function archDoor(o, E, D, lod, id) {
  const half = D.width / 2,
    N = [2, 4, 8, 14][lod],
    curve = Array.from({ length: N + 1 }, (_, i) => {
      const t = Math.PI - (Math.PI * i) / N;
      return [D.x + half * Math.cos(t), D.spring + D.rise * Math.sin(t)];
    });
  for (let i = 1; i < curve.length; i++) {
    const [a, b] = [curve[i - 1], curve[i]],
      dx = D.x - (a[0] + b[0]) / 2,
      n = [E.u[0] * dx, D.spring - (a[1] + b[1]) / 2, E.u[2] * dx];
    face(o, 'plaster', [E.at(a[0], a[1]), E.at(b[0], b[1]), E.at(b[0], 3), E.at(a[0], 3)], E.n);
    face(
      o,
      'stone',
      [E.at(a[0], a[1]), E.at(a[0], a[1], -D.depth), E.at(b[0], b[1], -D.depth), E.at(b[0], b[1])],
      n,
    );
  }
  for (const k of [-1, 1])
    face(
      o,
      'stone',
      [
        E.at(D.x + k * half, D.bottom),
        E.at(D.x + k * half, D.bottom, -D.depth),
        E.at(D.x + k * half, D.spring, -D.depth),
        E.at(D.x + k * half, D.spring),
      ],
      E.u.map((v) => -k * v),
    );
  face(
    o,
    'wood',
    [
      E.at(D.x - half, D.bottom, -D.depth),
      E.at(D.x + half, D.bottom, -D.depth),
      ...curve
        .slice()
        .reverse()
        .map(([x, y]) => E.at(x, y, -D.depth)),
    ],
    E.n,
  );
  archEvidence.push({ id, center: E.at(D.x + 0.25, D.bottom + 1.3), normal: E.n, depth: D.depth });
  if (lod >= 2) {
    beam(
      o,
      'iron',
      E.at(D.x, D.bottom, -D.depth + 0.03),
      E.at(D.x, D.spring + D.rise - 0.12, -D.depth + 0.03),
      0.055,
      0.06,
      C.iron,
    );
  }
}
function stage(o, lod) {
  const S = P.stage,
    W = S.width / 2;
  closedBody(
    o,
    { x0: -W, x1: W, z0: S.backWallZ + 0.45, z1: S.bodyBackZ, bottom: P.foundationBottomY, top: 9 },
    lod,
    'whole-hidden-rear-and-service-range',
  );
  for (const side of [-1, 1]) {
    const s = {
        x0: side < 0 ? -W : S.openingWidth / 2,
        x1: side < 0 ? -S.openingWidth / 2 : W,
        z0: 0,
        z1: S.backWallZ + 0.45,
      },
      r = rectangle(s);
    for (let i = 0; i < 4; i++) {
      const E = makeEdge(r[i], r[(i + 1) % 4]),
        outer = i === (side < 0 ? 3 : 1),
        wins = outer
          ? [
              {
                id: 'high-side-pylon-window',
                t: E.L * 0.56,
                y: S.sidePylonWindowBottom,
                w: 0.7,
                h: S.sidePylonWindowHeight,
              },
            ]
          : [];
      wall(
        o,
        r[i],
        r[(i + 1) % 4],
        P.foundationBottomY,
        S.prosceniumTop,
        wins,
        lod,
        `whole-side-pylon-${side}-${i}`,
      );
    }
    cap(o, 'plaster', r, [], S.prosceniumTop, [0, 1, 0]);
  }
  box(o, 'plaster', [-W, S.openingTop, -0.4], [W, S.prosceniumTop, 0.9]);
  box(o, 'roof', [-W, S.roofUnderside, 0.9], [W, S.roofTop, S.bodyBackZ]);
  roofEvidence.push({ id: 'whole-main-stage-and-rear-closed-roof', point: [0, S.roofTop, 5] });
  soffitEvidence.push({ id: 'stage-closed-inner-ceiling', point: [0, S.roofUnderside, 4.5] });
  const E = makeEdge([-12.5, S.backWallZ], [12.5, S.backWallZ]),
    at = (x) => x + 12.5,
    cuts = [-12.5, ...S.doors.flatMap((d) => [d.x - d.width / 2, d.x + d.width / 2]), 12.5];
  for (let i = 1; i < cuts.length; i++) {
    const x = (cuts[i] + cuts[i - 1]) / 2;
    if (!S.doors.some((d) => Math.abs(x - d.x) < d.width / 2))
      panel(o, 'plaster', E, at(cuts[i - 1]), at(cuts[i]), P.stageFloorY, 3);
  }
  for (const D of S.doors)
    archDoor(o, E, { ...D, x: at(D.x) }, lod, `backstage-arched-door-${D.x}`);
  const cw = makeEdge([-12.5, S.backWallZ], [-3, S.backWallZ]);
  circlePanel(
    o,
    cw,
    {
      id: 'actual-left-round-backstage-window',
      cx: S.roundWindow.x + 12.5,
      cy: S.roundWindow.y,
      radius: S.roundWindow.radius,
      lo: 3,
      hi: S.coveWallTop,
      depth: S.roundWindow.depth,
    },
    lod,
  );
  panel(o, 'plaster', E, at(-3), at(12.5), 3, S.coveWallTop);
  const N = [2, 3, 5, 9][lod];
  for (let i = 0; i < N; i++) {
    const a = (i * Math.PI) / 2 / N,
      b = ((i + 1) * Math.PI) / 2 / N,
      p = (t) => [
        S.coveWallTop + S.coveRadius * Math.sin(t),
        S.backWallZ - S.coveRadius + S.coveRadius * Math.cos(t),
      ];
    const y = p(a),
      z = p(b);
    face(
      o,
      'plaster',
      [
        [-12.5, y[0], y[1]],
        [12.5, y[0], y[1]],
        [12.5, z[0], z[1]],
        [-12.5, z[0], z[1]],
      ],
      [0, -Math.sin((a + b) / 2), -Math.cos((a + b) / 2)],
    );
  }
  partEvidence.push({
    id: 'whole-open-first-large-hall-stage-proscenium-and-acoustic-cove',
    wholeBody: true,
    originalFirstHall: true,
  });
}
function apron(o, lod) {
  const A = P.apron,
    N = [4, 8, 16, 32][lod],
    front = Array.from({ length: N + 1 }, (_, i) => {
      const x = -A.halfWidth + (2 * A.halfWidth * i) / N;
      return [x, -A.frontDepth * (1 - (x * x) / (A.halfWidth * A.halfWidth))];
    }),
    r = [...front, [A.halfWidth, A.backZ], [-A.halfWidth, A.backZ]];
  cap(o, 'stone', r, [], A.top, [0, 1, 0]);
  for (let i = 1; i < front.length; i++) {
    const a = front[i - 1],
      b = front[i];
    face(
      o,
      'plaster',
      [
        [a[0], A.bottom, a[1]],
        [b[0], A.bottom, b[1]],
        [b[0], A.top, b[1]],
        [a[0], A.top, a[1]],
      ],
      [b[1] - a[1], 0, -(b[0] - a[0])],
    );
  }
  partEvidence.push({ id: 'whole-curved-forestage-and-intrinsic-platform' });
}
function forecourt(o, lod) {
  const A = P.auditorium,
    N = [4, 8, 16, 32][lod],
    arc = Array.from({ length: N + 1 }, (_, i) => {
      const t = ((-60 + (120 * i) / N) * Math.PI) / 180;
      return [A.innerRadius * Math.sin(t), A.center[1] - A.innerRadius * Math.cos(t)];
    });
  cap(o, 'stone', [...arc, [17, 0], [-17, 0]], [], P.baseFloorY, [0, 1, 0]);
  partEvidence.push({ id: 'whole-intrinsic-forestage-audience-forecourt' });
}
function canopy(o, lod) {
  const A = P.canopy,
    h = A.halfWidth,
    p = [
      [-h, A.frontTop, A.frontZ],
      [h, A.frontTop, A.frontZ],
      [h, A.backTop, A.backZ],
      [-h, A.backTop, A.backZ],
    ],
    q = p.map((p) => p.map((v, i) => v - (i === 1 ? A.thickness : 0))),
    n = normalFor(...p);
  face(o, 'roof', p, n[1] > 0 ? n : n.map((v) => -v));
  face(o, 'wood', q, n[1] > 0 ? n.map((v) => -v) : n);
  for (let i = 0; i < 4; i++)
    face(
      o,
      'iron',
      [p[i], q[i], q[(i + 1) % 4], p[(i + 1) % 4]],
      normalFor(p[i], q[i], q[(i + 1) % 4]),
    );
  for (const x of A.bracketXs) {
    beam(
      o,
      'iron',
      [x, A.bracketHighY, -0.48],
      [x, A.bracketFrontY, A.frontZ + 0.35],
      0.18,
      0.18,
      C.iron,
    );
    if (lod >= 2)
      beam(
        o,
        'iron',
        [x, A.bracketFrontY, A.frontZ + 0.35],
        [x, A.frontTop + 0.35, -0.45],
        0.14,
        0.14,
        C.iron,
      );
  }
  const c = mix(p[0], p[2], 0.5),
    d = mix(q[0], q[2], 0.5);
  roofEvidence.push({ id: 'true-projecting-canopy-cover', point: c });
  soffitEvidence.push({ id: 'projecting-canopy-underside', point: d });
  partEvidence.push({ id: 'whole-cantilevered-canopy-and-five-diagonal-brackets' });
}
const at = (r, t, y) => [
  P.auditorium.center[0] + r * Math.sin(t),
  y,
  P.auditorium.center[1] - r * Math.cos(t),
];
function sector(o, k, r0, r1, a0, a1, y0, y1, N, { bottom = false } = {}) {
  for (let i = 0; i < N; i++) {
    const a = a0 + ((a1 - a0) * i) / N,
      b = a0 + ((a1 - a0) * (i + 1)) / N,
      m = (a + b) / 2,
      A = at(r0, a, y1),
      B = at(r1, a, y1),
      C0 = at(r1, b, y1),
      D = at(r0, b, y1);
    face(o, k, [A, B, C0, D], [0, 1, 0]);
    face(o, k, [at(r0, b, y0), at(r0, a, y0), A, D], [-Math.sin(m), 0, Math.cos(m)]);
    face(o, k, [at(r1, a, y0), at(r1, b, y0), C0, B], [Math.sin(m), 0, -Math.cos(m)]);
    if (bottom)
      face(o, k, [at(r0, a, y0), at(r0, b, y0), at(r1, b, y0), at(r1, a, y0)], [0, -1, 0]);
  }
  for (const [t, n] of [
    [a0, [-Math.cos(a0), 0, -Math.sin(a0)]],
    [a1, [Math.cos(a1), 0, Math.sin(a1)]],
  ])
    face(o, k, [at(r0, t, y0), at(r1, t, y0), at(r1, t, y1), at(r0, t, y1)], n);
}
function auditorium(o, lod) {
  const A = P.auditorium,
    group = [4, 3, 1, 1][lod],
    segments = [8, 16, 32, 48][lod],
    half = radians(A.halfAngleDegrees);
  for (let i = 0; i < A.rows; i += group) {
    const end = Math.min(A.rows, i + group),
      r0 = A.innerRadius + i * A.rowRun,
      r1 = A.innerRadius + end * A.rowRun,
      y = A.startFloor + end * A.rowRise;
    for (let k = 0; k < 4; k++)
      sector(
        o,
        'stone',
        r0,
        r1,
        radians(-60 + k * 30) + A.aisleHalfAngle,
        radians(-30 + k * 30) - A.aisleHalfAngle,
        P.foundationBottomY,
        y,
        Math.max(1, segments / 4),
        { bottom: lod === 3 },
      );
    terraceEvidence.push({
      id: `whole-terrace-${i}`,
      rowStart: i,
      rowEnd: end,
      inner: r0,
      outer: r1,
      top: y,
      point: at((r0 + r1) / 2, 0.21, y),
    });
    if (lod > 0) {
      const ym = A.startFloor + end * A.rowRise,
        rad = A.innerRadius + (i + 0.58) * A.rowRun,
        N = Math.max(1, Math.round(segments / 4));
      for (let k = 0; k < 4; k++) {
        const a = radians(-60 + k * 30) + A.aisleHalfAngle,
          b = radians(-30 + k * 30) - A.aisleHalfAngle;
        if (lod === 3) {
          sector(
            o,
            'wood',
            rad - A.seatWidth / 2,
            rad + A.seatWidth / 2,
            a,
            b,
            ym + A.seatHeight,
            ym + A.seatHeight + A.seatThickness,
            N,
            { bottom: true },
          );
          sector(
            o,
            'wood',
            rad + 0.22,
            rad + 0.3,
            a,
            b,
            ym + A.backHeight - A.backBoardHeight,
            ym + A.backHeight,
            N,
            { bottom: true },
          );
          const legs = Math.max(1, Math.floor(((b - a) * rad) / A.legPitch));
          for (let j = 0; j <= legs; j++) {
            const t = a + ((b - a) * j) / legs,
              p = at(rad + 0.12, t, ym);
            beam(o, 'iron', p, at(rad + 0.12, t, ym + A.backHeight), 0.07, 0.08, C.iron);
          }
        } else
          for (const [radial, y] of [
            [rad, ym + A.seatHeight],
            [rad + 0.26, ym + A.backHeight],
          ]) {
            for (let j = 0; j < N; j++) {
              const t = a + ((b - a) * j) / N,
                T = a + ((b - a) * (j + 1)) / N;
              if (y === ym + A.seatHeight)
                face(
                  o,
                  'wood',
                  [
                    at(radial - 0.21, t, y),
                    at(radial + 0.21, t, y),
                    at(radial + 0.21, T, y),
                    at(radial - 0.21, T, y),
                  ],
                  [0, 1, 0],
                );
              else
                face(
                  o,
                  'wood',
                  [
                    at(radial, t, y - 0.18),
                    at(radial, T, y - 0.18),
                    at(radial, T, y),
                    at(radial, t, y),
                  ],
                  [-Math.sin((t + T) / 2), 0, Math.cos((t + T) / 2)],
                );
            }
          }
        seatEvidence.push({
          id: `whole-bench-row-${i}-block-${k}`,
          point: at(rad, 0.5 * (a + b), ym + A.seatHeight + A.seatThickness),
          top: ym + A.seatHeight + A.seatThickness,
          solid: lod === 3,
        });
      }
    }
  }
  for (const [a, b] of [
    [-half - A.aisleHalfAngle, -P.backEntry.openingHalfAngle],
    [P.backEntry.openingHalfAngle, half + A.aisleHalfAngle],
  ])
    sector(
      o,
      'plaster',
      A.outerWallRadius,
      A.outerWallRadius + A.outerWallThickness,
      a,
      b,
      P.foundationBottomY,
      A.outerWallTop,
      Math.max(2, segments / 2),
      { bottom: lod === 3 },
    );
  for (const side of [-1, 1]) {
    const t = side * (half + A.aisleHalfAngle),
      a = at(A.innerRadius, t, P.foundationBottomY),
      b = at(A.outerRadius, t, P.foundationBottomY),
      c = at(A.outerRadius, t, A.topFloor + 0.4),
      d = at(A.innerRadius, t, A.startFloor + 0.4),
      n = [side * Math.cos(t), 0, side * Math.sin(t)];
    face(o, 'plaster', [a, b, c, d], n);
    face(
      o,
      'plaster',
      [d, c, b, a],
      n.map((v) => -v),
    );
  }
  for (const degree of A.aisleAnglesDegrees) {
    const t = radians(degree);
    if (lod === 0) {
      const h = 0.023,
        p = [
          at(A.innerRadius, t - h, A.startFloor),
          at(A.outerRadius, t - h, A.topFloor),
          at(A.outerRadius, t + h, A.topFloor),
          at(A.innerRadius, t + h, A.startFloor),
        ];
      face(o, 'stone', p, [0, 1, 0]);
      continue;
    }
    const divisions = lod === 1 ? 1 : 2;
    for (let i = 0; i < A.rows * divisions; i++) {
      const r0 = A.innerRadius + (i * A.rowRun) / divisions,
        r1 = r0 + A.rowRun / divisions,
        top = A.startFloor + ((i + 1) * A.rowRise) / divisions;
      sector(
        o,
        'stone',
        r0,
        r1,
        t - A.aisleHalfAngle * 0.9,
        t + A.aisleHalfAngle * 0.9,
        P.foundationBottomY,
        top,
        1,
        { bottom: lod === 3 },
      );
      stairEvidence.push({
        id: `radial-aisle-${degree}-step-${i}`,
        point: at((r0 + r1) / 2, t, top),
        kind: 'radial-aisle',
      });
    }
  }
  partEvidence.push({
    id: 'entire-four-block-fan-auditorium',
    rows: 24,
    completeTerraces: true,
    aisles: 5,
    fullOuterAndSideRetainingWalls: true,
  });
}
function stageStairs(o, lod) {
  const A = P.stageStairs;
  for (const x of A.centers) {
    if (lod === 0) {
      const p = [
        [x - A.width / 2, P.baseFloorY, -A.count * A.run],
        [x + A.width / 2, P.baseFloorY, -A.count * A.run],
        [x + A.width / 2, P.stageFloorY, 0],
        [x - A.width / 2, P.stageFloorY, 0],
      ];
      face(o, 'stone', p, [0, 1, 0]);
      continue;
    }
    for (let i = 0; i < A.count; i++) {
      const z = -(A.count - i) * A.run,
        top = P.baseFloorY + (i + 1) * A.rise;
      box(o, 'stone', [x - A.width / 2, P.foundationBottomY, z], [x + A.width / 2, top, z + A.run]);
      stairEvidence.push({
        id: `stage-flight-${x}-step-${i}`,
        point: [x, top, z + 0.17],
        kind: 'stage-flight',
      });
    }
  }
  const B = P.backEntry,
    Z = P.auditorium.center[1] - B.radius;
  box(
    o,
    'stone',
    [-B.width / 2, B.landingTop - 0.25, Z - B.landingDepth],
    [B.width / 2, B.landingTop, Z + P.auditorium.outerWallRadius - P.auditorium.outerRadius],
  );
  for (let i = 0; i < B.steps; i++) {
    const top = B.approachY + ((i + 1) * (B.landingTop - B.approachY)) / B.steps,
      z = Z - B.landingDepth - (B.steps - i) * B.stepRun;
    box(o, 'stone', [-B.width / 2, P.foundationBottomY, z], [B.width / 2, top, z + B.stepRun]);
    stairEvidence.push({
      id: `back-entry-step-${i}`,
      point: [0, top, z + 0.17],
      kind: 'back-entry',
    });
  }
  partEvidence.push({ id: 'whole-two-stage-flights-and-rear-auditorium-access' });
}
export function buildHouse(out, _frame, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    windowEvidence,
    roofEvidence,
    soffitEvidence,
    terraceEvidence,
    seatEvidence,
    archEvidence,
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
  stage(o, lod);
  apron(o, lod);
  forecourt(o, lod);
  canopy(o, lod);
  auditorium(o, lod);
  stageStairs(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/xn/xn7/hibiya_open_air_concert_hall',
  cam = (p) => toWorld(p),
  camera = cam([83, 62, -109]),
  look = cam([0, 1, -8]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Hibiya Open-Air Concert Hall (first large hall,1937)',
  cell: 'xn/xn7',
  wikidataId: 'Q11509589',
  category: 'performance-sport',
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
  portableGroundY: -7.2,
  mediumFiContext: {
    scale: 1,
    groundY: -7.2,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'concrete_plain',
    'metal_standing_seam',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-first-large-stage-rear-and-complete-fan-auditorium',
      position: camera,
      lookAt: look,
    },
    {
      name: 'whole-hidden-rear-service-range-and-auditorium-returns',
      position: cam([-73, 42, 78]),
      lookAt: look,
    },
    {
      name: '1937-proscenium-canopy-brackets-and-acoustic-backwall',
      position: cam([-29, 7, -31]),
      lookAt: cam([0, 4, 4]),
    },
    {
      name: 'whole-24-terraces-benches-five-stair-aisles-and-retaining-walls',
      position: cam([-41, 23, -13]),
      lookAt: cam([0, -0.1, -21]),
    },
    {
      name: 'inside-covered-stage-arched-doors-round-window-and-ceiling',
      position: cam([1, 0.5, -1]),
      lookAt: cam([-6, 4, 8.2]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-first-large-hall-${reviewLod}`,
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
    'Original authored geometry/repository license. Exactalready-clearedpublishedSeikaido1937firstlargehall832x577original/nativePD-Japan-oldphoto+PD-1996/SHA1/revision/publisher bound; primaryNDLbook000000657703/pid1112028explicitcopyrightpdm. NormalpublishedPDpolicy unchanged. Showakantextseparates1905smallbandstand/1923largefirsthall/1954rebuild. CurrentOSMODbL4controlstage145409065/15controlbleachers391741587/namednode1588276702/Q11509589 onlyapproximateoldsitecontext, nothistoricplan. Entirehiddenrear/roof/fan/terraces/census/sections/grade/registration estimated. No current1983stage/brickPublicHall/1905bandstand/crowds/performers/lettering/copiedart/trees/neighbors, photographictextures/generatedbitmap orQuallamedia/rights edits.',
};
