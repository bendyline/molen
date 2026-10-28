/** Whole Santa Catalina fort,1898–1900. Original independent field and main sections precede mesh. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
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
    roof: rgb('807964'),
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
  bastionEvidence = [],
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
    throw Error('Fort roof cap failed');
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
function edge(a, b) {
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
function archStrip(o, E, { id, cx, half, bottom, spring, rise, top, depth }, lod) {
  const N = [2, 4, 8, 14][lod],
    curve = Array.from({ length: N + 1 }, (_, i) => {
      const t = Math.PI - (Math.PI * i) / N;
      return [cx + Math.cos(t) * half, spring + Math.sin(t) * rise];
    });
  for (let i = 1; i < curve.length; i++) {
    const [a, b] = [curve[i - 1], curve[i]];
    face(o, 'plaster', [E.at(a[0], a[1]), E.at(b[0], b[1]), E.at(b[0], top), E.at(a[0], top)], E.n);
    if (lod > 0)
      face(
        o,
        'plaster',
        [
          E.at(b[0], b[1], -depth),
          E.at(a[0], a[1], -depth),
          E.at(a[0], top, -depth),
          E.at(b[0], top, -depth),
        ],
        E.n.map((v) => -v),
      );
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      toward = E.u.map((v, j) => v * (cx - mid[0]) + (j === 1 ? spring - 0.1 - mid[1] : 0));
    face(
      o,
      'stone',
      [E.at(a[0], a[1]), E.at(a[0], a[1], -depth), E.at(b[0], b[1], -depth), E.at(b[0], b[1])],
      toward,
    );
  }
  for (const k of [-1, 1])
    face(
      o,
      'stone',
      [
        E.at(cx + k * half, bottom),
        E.at(cx + k * half, bottom, -depth),
        E.at(cx + k * half, spring, -depth),
        E.at(cx + k * half, spring),
      ],
      E.u.map((v) => -k * v),
    );
  archEvidence.push({
    id,
    center: E.at(cx, bottom + (spring - bottom) * 0.5),
    normal: E.n,
    depth,
    bottom,
    spring,
    rise,
  });
}
function perimeter(o, lod) {
  const A = P.wall,
    r = P.outer;
  for (let i = 0; i < r.length; i++) {
    const E = edge(r[i], r[(i + 1) % r.length]),
      ranges =
        i === 0
          ? [
              [0, 14],
              [46, E.L],
            ]
          : [[0, E.L]];
    for (const [a, b] of ranges) {
      face(
        o,
        'plaster',
        [E.at(a, A.bottom, A.batter), E.at(b, A.bottom, A.batter), E.at(b, 3.2), E.at(a, 3.2)],
        E.n,
      );
      if (lod === 0) {
        panel(o, 'plaster', E, a, b, 3.2, A.top);
        continue;
      }
      const N = Math.max(1, Math.floor((b - a) / (lod === 1 ? 18 : lod === 2 ? 8 : A.slotPitch))),
        pitch = (b - a) / N;
      for (let j = 0; j < N; j++) {
        const t = a + (j + 0.5) * pitch,
          half = A.slotWidth / 2,
          left = t - half,
          right = t + half;
        panel(o, 'plaster', E, a + j * pitch, left, 3.2, A.top);
        panel(o, 'plaster', E, right, a + (j + 1) * pitch, 3.2, A.top);
        panel(o, 'plaster', E, left, right, 3.2, A.slotBottom);
        archStrip(
          o,
          E,
          {
            id: `perimeter-${i}-slot-${j}`,
            cx: t,
            half,
            bottom: A.slotBottom,
            spring: A.slotSpring,
            rise: A.slotRise,
            top: A.top,
            depth: A.thickness,
          },
          lod,
        );
      }
      const M = Math.max(1, Math.floor((b - a) / (lod === 3 ? A.merlonPitch : lod === 2 ? 8 : 28)));
      for (let j = 0; j < M; j++) {
        const t = a + ((j + 0.5) * (b - a)) / M,
          aa = E.at(t - A.merlonWidth / 2, A.top, 0.2),
          bb = E.at(t + A.merlonWidth / 2, A.merlonTop, -A.thickness);
        const p = [aa, bb];
        if (Math.abs(E.u[0]) > 0.99)
          box(
            o,
            'plaster',
            [Math.min(...p.map((p) => p[0])), A.top, Math.min(...p.map((p) => p[2]))],
            [Math.max(...p.map((p) => p[0])), A.merlonTop, Math.max(...p.map((p) => p[2]))],
          );
        else
          beam(
            o,
            'plaster',
            E.at(t, A.top + 0.225, 0.1),
            E.at(t, A.top + 0.225, -A.thickness),
            A.merlonWidth,
            0.45,
            C.plaster,
          );
      }
    }
    partEvidence.push({ id: `whole-old-enclosure-edge-${i}`, wholeExtent: true });
  }
}
function courtsAndRanges(o, lod) {
  const holes = P.courts.map(rectangle);
  cap(o, 'roof', P.outer, holes, P.rangeRoofY, [0, 1, 0]);
  if (lod > 0) cap(o, 'wood', P.outer, holes, P.rangeEaveY, [0, -1, 0]);
  for (const K of P.courts) {
    cap(o, 'stone', rectangle(K), [], P.baseFloorY, [0, 1, 0]);
    const r = rectangle(K).reverse();
    for (let i = 0; i < 4; i++) {
      const a = r[i],
        b = r[(i + 1) % 4],
        E = edge(a, b),
        W = [];
      const N = Math.max(1, Math.floor(E.L / (lod === 1 ? 35 : lod === 2 ? 20 : 6.5)));
      for (let j = 0; j < N; j++) {
        const t = (E.L * (j + 0.5)) / N,
          q = E.at(t, 0);
        if (
          K.id === 'main-front-parade-court' &&
          Math.abs(q[2] - P.chapel.z1) < 0.01 &&
          q[0] > P.chapel.x0 - 0.6 &&
          q[0] < P.chapel.x1 + 0.6
        )
          continue;
        W.push({ id: `court-pane-${j}`, t, y: 1.45, w: 1.2, h: 2.6 });
      }
      if (
        K.id === 'main-front-parade-court' &&
        Math.abs(a[1] - 10) < 0.01 &&
        Math.abs(b[1] - 10) < 0.01
      ) {
        const min = Math.min(a[0], b[0]),
          max = Math.max(a[0], b[0]);
        for (const [x0, x1] of [
          [min, 27.7],
          [32.3, max],
        ])
          wall(o, [x1, 10], [x0, 10], P.baseFloorY, P.rangeEaveY, [], lod, `${K.id}-gate-return`);
      } else wall(o, a, b, P.baseFloorY, P.rangeEaveY, W, lod, `${K.id}-${i}`);
    }
    partEvidence.push({ id: K.id, openCourt: true, completeRoofedSurround: true });
    roofEvidence.push({
      id: 'rear-complete-service-roof',
      point: [85, P.rangeRoofY, 165],
      normal: [0, 1, 0],
    });
  }
}
function gate(o, lod) {
  const A = P.gate,
    E = edge([A.x0, A.z0], [A.x1, A.z0]),
    half = A.width / 2,
    cx = A.entryX - A.x0;
  box(o, 'stone', [A.x0, 0.4, A.z0], [A.x1, 0.6, A.z1]);
  for (const [a, b] of [
    [0, cx - half],
    [cx + half, E.L],
  ]) {
    const mid = (a + b) / 2;
    wall(
      o,
      E.at(a, 0).filter((_, i) => i !== 1),
      E.at(b, 0).filter((_, i) => i !== 1),
      A.bottom,
      A.top,
      [
        {
          id: 'gate-side-pane',
          t: (b - a) / 2,
          y: A.windowBottom,
          w: A.windowWidth,
          h: A.windowHeight,
        },
      ],
      lod,
      `gate-front-${mid}`,
    );
  }
  archStrip(
    o,
    E,
    {
      id: 'main-gate-true-through-passage',
      cx,
      half,
      bottom: P.baseFloorY,
      spring: A.spring,
      rise: A.rise,
      top: A.top,
      depth: A.depth,
    },
    lod,
  );
  box(o, 'stone', [A.x0 - 0.35, 6.05, A.z0 - 0.3], [A.x1 + 0.35, 6.35, A.z1]);
  for (const x of [A.x0 + 0.4, 25.8, 34.2, A.x1 - 0.4]) {
    box(o, 'stone', [x - 0.25, P.baseFloorY, A.z0 - 0.2], [x + 0.25, 5.85, A.z0]);
    box(o, 'stone', [x - 0.42, 5.65, A.z0 - 0.32], [x + 0.42, 5.95, A.z0 + 0.1]);
  }
  for (const [side, x] of [
    ['left', A.x0],
    ['right', A.x1],
  ]) {
    wall(o, [x, A.z1], [x, A.z0], P.baseFloorY, A.top, [], lod, `${side}-whole-gatehouse-return`);
  }
  for (let i = 0; i < P.steps.count; i++) {
    const z = -0.2 - (P.steps.count - i) * P.steps.run,
      top = (i + 1) * P.steps.rise;
    box(
      o,
      'stone',
      [A.entryX - P.steps.width / 2, -0.2, z],
      [A.entryX + P.steps.width / 2, top, A.z0],
    );
    stairEvidence.push({ id: `gate-step-${i}`, point: [A.entryX, top, z + 0.18] });
  }
  entryEvidence.push({
    id: 'real-gate-passage',
    center: [A.entryX, 2.4, A.z0],
    normal: [0, 0, -1],
    depth: A.depth,
  });
  partEvidence.push({ id: A.id, fullGatehouse: true, throughPassage: true });
}
function ventWall(o, a, b, lo, hi, lod, id) {
  const E = edge(a, b),
    cx = E.L / 2,
    cy = P.tower.ventCenterY,
    R = P.tower.ventRadius,
    angles = [
      ...Array.from(
        { length: [4, 8, 12, 24][lod] },
        (_, i) => (i * 2 * Math.PI) / [4, 8, 12, 24][lod],
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
          inner: E.at(cx + R * u, cy + R * v),
          back: E.at(cx + R * u, cy + R * v, -0.3),
          outer: E.at(cx + k * u, cy + k * v),
        };
      };
    const x = q(aa),
      y = q(bb);
    if (Math.hypot(...sub(x.inner, y.inner)) < 0.00001) continue;
    face(o, 'plaster', [x.inner, y.inner, y.outer, x.outer], E.n);
    face(
      o,
      'stone',
      [x.inner, x.back, y.back, y.inner],
      E.u.map((v, j) => -v * Math.cos((aa + bb) / 2) - (j === 1 ? Math.sin((aa + bb) / 2) : 0)),
    );
  }
  const ring = Array.from({ length: 24 }, (_, i) =>
    E.at(
      cx + R * Math.cos((i * 2 * Math.PI) / 24),
      cy + R * Math.sin((i * 2 * Math.PI) / 24),
      -0.31,
    ),
  );
  face(o, 'iron', ring, E.n);
  windowEvidence.push({ id, center: E.at(cx, cy, -0.31), normal: E.n, recessDepth: 0.31 });
}
const sub = (a, b) => a.map((v, i) => v - b[i]);
function tower(o, lod) {
  const T = P.tower,
    s = { x0: T.x0, x1: T.x1, z0: T.z0, z1: T.z1 },
    r = rectangle(s);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    wall(
      o,
      a,
      b,
      T.firstBottom,
      T.firstTop,
      [{ id: 'lower-tower-sash', t: L / 2, y: 7.4, w: 1.65, h: 2.6 }],
      lod,
      `tower-lower-${i}`,
    );
  }
  box(o, 'stone', [T.x0 - 0.5, 10.8, T.z0 - 0.5], [T.x1 + 0.5, 11.15, T.z1 + 0.5]);
  box(o, 'plaster', [T.upperX0, T.firstTop, T.upperZ0], [T.upperX1, T.upperBottom, T.upperZ1]);
  cap(
    o,
    'plaster',
    rectangle({ x0: T.upperX0, x1: T.upperX1, z0: T.upperZ0, z1: T.upperZ1 }),
    [],
    T.upperTop,
    [0, 1, 0],
  );
  const u = rectangle({ x0: T.upperX0, x1: T.upperX1, z0: T.upperZ0, z1: T.upperZ1 });
  for (let i = 0; i < 4; i++)
    ventWall(
      o,
      u[i],
      u[(i + 1) % 4],
      T.upperBottom,
      T.upperTop,
      lod,
      `pre-clock-round-opening-${i}`,
    );
  box(
    o,
    'stone',
    [T.upperX0 - 0.35, 16.45, T.upperZ0 - 0.35],
    [T.upperX1 + 0.35, 16.7, T.upperZ1 + 0.35],
  );
  hip(
    o,
    {
      id: 'whole-pre-clock-tower-hip',
      x0: T.upperX0 - 0.4,
      x1: T.upperX1 + 0.4,
      z0: T.upperZ0 - 0.4,
      z1: T.upperZ1 + 0.4,
      eave: 16.7,
      ridge: T.roofTop,
    },
    lod,
  );
  if (lod > 0) {
    for (let i = 0; i < 4; i++) {
      const E = edge(r[i], r[(i + 1) % 4]);
      for (const y of [11.25, T.balustradeTop])
        beam(o, 'stone', E.at(0, y, 0.55), E.at(E.L, y, 0.55), 0.13, 0.13, C.stone);
      const N = lod === 1 ? 4 : Math.floor(E.L / 0.65);
      for (let j = 0; j <= N; j++)
        beam(
          o,
          'wood',
          E.at((E.L * j) / N, 11.25, 0.55),
          E.at((E.L * j) / N, T.balustradeTop, 0.55),
          0.1,
          0.1,
          C.wood,
        );
    }
  }
  partEvidence.push({ id: 'whole-two-tier-pre1903-clock-tower', blankRoundOpenings: true });
}
function bastion(o, A, lod) {
  const N = [6, 10, 16, 24][lod],
    c = [A.x, A.z];
  loft(
    o,
    'plaster',
    [
      radialRing(A.bottom, A.baseRadius, A.baseRadius, N, c),
      radialRing(P.baseFloorY, A.baseRadius, A.baseRadius, N, c),
      radialRing(A.shaftTop, A.shaftRadius, A.shaftRadius, N, c),
    ],
    C.plaster,
    { cap: true },
  );
  loft(
    o,
    'stone',
    [
      radialRing(5.9, A.shaftRadius + 0.22, A.shaftRadius + 0.22, N, c),
      radialRing(6.2, A.shaftRadius + 0.22, A.shaftRadius + 0.22, N, c),
    ],
    C.stone,
    { cap: true },
  );
  const posts = [4, 4, 8, 12][lod];
  for (let i = 0; i < posts; i++) {
    const t = (i * 2 * Math.PI) / posts,
      x = A.x + 4.3 * Math.cos(t),
      z = A.z + 4.3 * Math.sin(t);
    box(o, 'wood', [x - 0.075, 6.2, z - 0.075], [x + 0.075, A.galleryTop, z + 0.075]);
  }
  const ring = radialRing(A.galleryTop, A.roofRadius, A.roofRadius, N, c);
  for (let i = 0; i < N; i++)
    roofPatch(
      o,
      [ring[i], ring[(i + 1) % N], [A.x, A.roofTop, A.z]],
      `${A.id}-conic-roof-${i}`,
      lod,
    );
  if (lod > 0) {
    face(o, 'wood', ring, [0, -1, 0]);
    soffitEvidence.push({
      id: `${A.id}-gallery-roof-underside`,
      point: [A.x + 2, A.galleryTop, A.z],
    });
  }
  bastionEvidence.push({ id: A.id, center: [A.x, 7, A.z], radius: 4.3, galleryOpen: true });
  partEvidence.push({ id: A.id, wholeTaperedBastion: true, closedRoof: true });
}
function chapel(o, lod) {
  const A = P.chapel,
    r = rectangle(A);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      wins =
        i === 0
          ? [{ id: 'chapel-door', t: L / 2, y: P.baseFloorY, w: A.entryWidth, h: A.entryHeight }]
          : i === 2
            ? []
            : Array.from({ length: 3 }, (_, j) => ({
                id: `chapel-side-sash-${j}`,
                t: (L * (j + 0.5)) / 3,
                y: 2.5,
                w: 1.3,
                h: 2.5,
              }));
    wall(o, a, b, A.bottom, A.eave, wins, lod, `${A.id}-${i}`);
  }
  hip(o, { ...A, id: 'whole-chapel-closed-roof' }, lod);
  for (const x of [A.x0 + 0.5, A.x1 - 0.5])
    box(o, 'stone', [x - 0.22, 0.6, A.z0 - 0.2], [x + 0.22, A.eave, A.z0 + 0.03]);
  face(
    o,
    'plaster',
    [
      [A.x0, 8.3, A.z0 - 0.1],
      [A.x1, 8.3, A.z0 - 0.1],
      [(A.x0 + A.x1) / 2, A.frontTop, A.z0 - 0.1],
    ],
    [0, 0, -1],
  );
  partEvidence.push({
    id: A.id,
    wholeChapelBody: true,
    closedRoof: true,
    placementEstimated: true,
  });
}
export function buildHouse(out, _frame, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    windowEvidence,
    roofEvidence,
    soffitEvidence,
    bastionEvidence,
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
  courtsAndRanges(o, lod);
  perimeter(o, lod);
  gate(o, lod);
  tower(o, lod);
  for (const A of P.bastions) bastion(o, A, lod);
  chapel(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/6m/6mc/fort_of_santa_catalina_lima',
  cam = (p) => toWorld(p),
  camera = cam([-165, 130, -220]),
  look = cam([82, 6, 80]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Fort of Santa Catalina, Lima (whole fort,1898–1900)',
  cell: '6m/6mc',
  wikidataId: 'Q5870608',
  category: 'palace-castle-fort',
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
    far: 4000,
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
    { name: 'whole-old-fort-four-bastions-five-courts-and-chapel', position: camera, lookAt: look },
    {
      name: 'whole-rear-barrack-service-ranges-and-roofs',
      position: cam([270, 130, 275]),
      lookAt: look,
    },
    {
      name: 'published-gate-tower-and-covered-round-bastion',
      position: cam([-19, 14, -41]),
      lookAt: cam([21, 8, 0]),
    },
    {
      name: 'inside-parade-court-chapel-and-roofed-ranges',
      position: cam([30, 7, 35]),
      lookAt: cam([87, 5, 60]),
    },
    {
      name: 'inside-true-neoclassical-gate-passage',
      position: cam([30, 2.4, 2.4]),
      lookAt: cam([31, 3.8, 13]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-old-fort-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry/repository license. Exact already-cleared publishedGarreaud1262x9231898–1900original/nativeexplicitPD-old-70/namedcreator/originalSHA1andrevision bound; unchanged publishedPDpolicy. PrimaryBNPalbumcontext/INC1978textualhistoric topology only, no copyrightmodernplans/maps/photos. CurrentOSMODbLsurvivingNEbastion442262160/collegeboundary410089525 approximatehistoriccorner/sitecontext, notwholehistoricplan orcollegeextrusion. Wholehiddenoldfort/fourbastions/fivecourts/chapel/barrack-service roofs/sections/grade/registration estimated. No1903clockhands/currentstreetcut/neighboringoppositeshop/people/cannonbollards/artwork/interiors, photographictextures/generatedbitmaps orQuallamedia/rights edits.',
};
