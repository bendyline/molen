/** Whole Frere Hall, author original published2009. Native frame, original field and main sections precede geometry. */
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
  brick: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_marble', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.87, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0.3 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.35, metallic: 0 },
};
const C = {
  brick: rgb('bfa467'),
  stone: rgb('f0e4c9'),
  roof: rgb('985c58'),
  iron: rgb('3b4240'),
  wood: rgb('a39c82'),
  glass: rgb('394742'),
};
const O = P.workingFrame.origin,
  U = P.workingFrame.alongFront,
  V = P.workingFrame.alongDepth;
export const toWorld = ([x, y, z]) => [O[0] + U[0] * x + V[0] * z, y, O[1] + U[1] * x + V[1] * z];
const rotate = ([x, y, z]) => [U[0] * x + V[0] * z, y, U[1] * x + V[1] * z];
export const partEvidence = [],
  soffitEvidence = [],
  roofEvidence = [],
  archEvidence = [],
  windowEvidence = [],
  stairEvidence = [],
  turretEvidence = [],
  postEvidence = [];
let activeLod = 3;
function face(o, k, ps, n, col = C[k]) {
  o.addConvexPolygon(k, ref, ps, n ?? normalFor(...ps), (p) => [p[0], p[1]], col);
}
function box(o, k, [x, y, z], [X, Y, Z], col = C[k]) {
  const sides = [
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
  ];
  for (const [ps, n] of sides) if (activeLod > 0 || n[1] >= 0) face(o, k, ps, n, col);
}
function _ring(r) {
  const q = r.map((p) => p.slice());
  if (
    q.reduce(
      (s, p, i) => s + p[0] * q[(i + 1) % q.length][1] - q[(i + 1) % q.length][0] * p[1],
      0,
    ) < 0
  )
    q.reverse();
  return q;
}
function _cap(o, k, r, holes, y, n) {
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
    throw Error('Hall roof/floor cap failed');
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
function _wall(o, k, a, b, y0, y1, inward = false) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L],
    n = inward ? [-u[2], 0, u[0]] : [u[2], 0, -u[0]],
    at = (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d];
  face(o, k, [at(0, y0), at(L, y0), at(L, y1), at(0, y1)], n);
  return { L, u, n, at };
}
function panel(o, k, E, t, y, w, h, d = 0.03) {
  face(
    o,
    k,
    [
      E.at(t - w / 2, y, d),
      E.at(t + w / 2, y, d),
      E.at(t + w / 2, y + h, d),
      E.at(t - w / 2, y + h, d),
    ],
    E.n,
  );
}
function _window(o, E, t, y, w, h, lod) {
  panel(o, 'glass', E, t, y, w, h);
  windowEvidence.push({ center: E.at(t, y + h / 2, 0.03), normal: E.n });
  if (lod >= 2) {
    for (const s of [-1, 1])
      beam(
        o,
        'wood',
        E.at(t + s * (w / 2 + 0.07), y, 0.07),
        E.at(t + s * (w / 2 + 0.07), y + h, 0.07),
        0.14,
        0.12,
        C.wood,
      );
    for (const Y of [y - 0.07, y + h + 0.07])
      beam(
        o,
        'wood',
        E.at(t - w / 2 - 0.14, Y, 0.07),
        E.at(t + w / 2 + 0.14, Y, 0.07),
        0.14,
        0.12,
        C.wood,
      );
    if (lod === 3) {
      beam(o, 'wood', E.at(t, y, 0.085), E.at(t, y + h, 0.085), 0.065, 0.07, C.wood);
      beam(
        o,
        'wood',
        E.at(t - w / 2, y + h * 0.6, 0.085),
        E.at(t + w / 2, y + h * 0.6, 0.085),
        0.07,
        0.07,
        C.wood,
      );
    }
  }
}
// Two-centre pointed arch; the round type is reserved for the tiny upper portal arcades.
function curve(cx, half, spring, rise, lod, round = false) {
  const count = [1, 1, 2, 5][lod];
  if (round)
    return Array.from({ length: count * 2 + 1 }, (_, i) => {
      const t = Math.PI - (i * Math.PI) / (count * 2);
      return [cx + half * Math.cos(t), spring + rise * Math.sin(t)];
    });
  const c = (rise * rise - half * half) / (2 * half),
    R = half + c,
    end = Math.atan2(rise, -c),
    left = Array.from({ length: count + 1 }, (_, i) => {
      const t = Math.PI + ((end - Math.PI) * i) / count;
      return [cx + c + R * Math.cos(t), spring + R * Math.sin(t)];
    });
  return [
    ...left,
    ...left
      .slice(0, -1)
      .reverse()
      .map(([x, y]) => [2 * cx - x, y]),
  ];
}
function arch(
  o,
  { id, cx, half, spring, rise, bottom, top, z0, z1, kind = 'pointed', round = false },
  lod,
) {
  const ps = curve(cx, half, spring, rise, lod, round);
  for (let i = 1; i < ps.length; i++) {
    const [a, b] = [ps[i - 1], ps[i]];
    face(
      o,
      'brick',
      [
        [a[0], a[1], z0],
        [b[0], b[1], z0],
        [b[0], top, z0],
        [a[0], top, z0],
      ],
      [0, 0, -1],
    );
    if (lod > 0) {
      face(
        o,
        'brick',
        [
          [b[0], b[1], z1],
          [a[0], a[1], z1],
          [a[0], top, z1],
          [b[0], top, z1],
        ],
        [0, 0, 1],
      );
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        toward = [cx - mid[0], spring - 0.1 - mid[1], 0];
      face(
        o,
        'stone',
        [
          [a[0], a[1], z0],
          [a[0], a[1], z1],
          [b[0], b[1], z1],
          [b[0], b[1], z0],
        ],
        toward,
      );
    }
  }
  if (lod >= 2) {
    for (const extra of lod === 3 ? [0.18] : []) {
      const q = curve(cx, half + extra, spring, rise + extra, lod, round);
      for (let i = 1; i < q.length; i++)
        beam(
          o,
          'stone',
          [q[i - 1][0], q[i - 1][1], z0 - 0.06 - extra * 0.04],
          [q[i][0], q[i][1], z0 - 0.06 - extra * 0.04],
          0.105,
          0.1,
          C.stone,
        );
      for (const s of [-1, 1])
        beam(
          o,
          'stone',
          [cx + s * (half + extra), bottom, z0 - 0.07],
          [cx + s * (half + extra), spring, z0 - 0.07],
          0.11,
          0.13,
          C.stone,
        );
    }
  }
  archEvidence.push({
    id,
    kind,
    center: [cx, bottom + (spring - bottom) * 0.6, z0],
    half,
    spring,
    rise,
    top,
    z0,
    z1,
    depth: z1 - z0,
    round,
    points: ps,
  });
}
function roofPatch(o, ps, lod, id) {
  const n0 = normalFor(...ps),
    n = n0[1] < 0 ? n0.map((x) => -x) : n0;
  if (ps.length === 3) {
    o.addTriangle(
      'roof',
      ref,
      ps,
      n,
      ps.map((p) => [p[0], p[2]]),
      C.roof,
    );
  } else {
    const nseg =
      lod === 3
        ? Math.max(1, Math.ceil(Math.hypot(...ps[1].map((x, i) => x - ps[0][i])) / 1.4))
        : 1;
    for (let j = 0; j < nseg; j++) {
      const a = j / nseg,
        b = (j + 1) / nseg,
        lerp = (p, q, t) => p.map((x, i) => x + (q[i] - x) * t),
        q = [
          lerp(ps[0], ps[1], a),
          lerp(ps[0], ps[1], b),
          lerp(ps[3], ps[2], b),
          lerp(ps[3], ps[2], a),
        ];
      face(o, 'roof', q, n, j % 4 === 0 ? C.roof.map((v) => v * 0.94) : C.roof);
    }
  }
  const tri = ps.slice(0, 3);
  roofEvidence.push({
    id,
    point: [0, 1, 2].map((i) => tri.reduce((s, p) => s + p[i] / 3, 0)),
    normal: n,
  });
}
function hip(o, s, lod) {
  const { x0, x1, z0, z1, eave: y, ridge: Y, id } = s,
    dx = x1 - x0,
    dz = z1 - z0;
  const k = Math.min(dx, dz) * 0.44,
    alongX = dx >= dz,
    r0 = alongX ? [x0 + k, Y, (z0 + z1) / 2] : [(x0 + x1) / 2, Y, z0 + k],
    r1 = alongX ? [x1 - k, Y, (z0 + z1) / 2] : [(x0 + x1) / 2, Y, z1 - k],
    a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1];
  if (alongX) {
    roofPatch(o, [a, b, r1, r0], lod, `${id}-front`);
    roofPatch(o, [b, c, r1], lod, `${id}-right`);
    roofPatch(o, [c, d, r0, r1], lod, `${id}-rear`);
    roofPatch(o, [d, a, r0], lod, `${id}-left`);
  } else {
    roofPatch(o, [a, b, r0], lod, `${id}-front`);
    roofPatch(o, [b, c, r1, r0], lod, `${id}-right`);
    roofPatch(o, [c, d, r1], lod, `${id}-rear`);
    roofPatch(o, [d, a, r0, r1], lod, `${id}-left`);
  }
}

function orient(o, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    v = [-u[1], u[0]],
    p = ([x, y, z]) => [a[0] + u[0] * x + v[0] * z, y, a[1] + u[1] * x + v[1] * z],
    n = ([x, y, z]) => [u[0] * x + v[0] * z, y, u[1] * x + v[1] * z];
  return {
    L,
    p,
    n,
    o: {
      addConvexPolygon: (k, r, ps, N, _uv, c) =>
        o.addConvexPolygon(k, r, ps.map(p), n(N), (q) => [q[0], q[1]], c),
      addTriangle: (k, r, ps, N, uv, c) => o.addTriangle(k, r, ps.map(p), n(N), uv, c),
      addQuad: (k, r, ps, N, uv, c) => o.addQuad(k, r, ps.map(p), n(N), uv, c),
    },
  };
}
function floor(o, k, x0, x1, z0, z1, y, thick = 0.2) {
  box(o, k, [x0, y - thick, z0], [x1, y, z1]);
  if (activeLod > 0)
    soffitEvidence.push({
      id: `floor-${x0}-${z0}-${y}`,
      point: [(x0 + x1) / 2, y - thick, (z0 + z1) / 2],
    });
}
function rectangleWindows(o, a, b, bottom, top, count, lod, id) {
  const E = orient(o, a, b),
    q = E.o,
    pitch = E.L / count,
    w = Math.min(1.35, pitch * 0.56),
    t = 0.42;
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5) * pitch,
      x0 = x - w / 2,
      x1 = x + w / 2,
      y = bottom + 1.35,
      h = Math.min(2.6, top - y - 0.55);
    box(q, 'brick', [cursor, bottom, 0], [x0, top, t]);
    box(q, 'brick', [x0, bottom, 0], [x1, y, t]);
    box(q, 'brick', [x0, y + h, 0], [x1, top, t]);
    face(
      q,
      'glass',
      [
        [x0, y, t * 0.65],
        [x1, y, t * 0.65],
        [x1, y + h, t * 0.65],
        [x0, y + h, t * 0.65],
      ],
      [0, 0, -1],
    );
    windowEvidence.push({
      id: `${id}-${i}`,
      center: E.p([x, y + h * 0.5, t * 0.65]),
      normal: E.n([0, 0, -1]),
    });
    if (lod === 3) {
      for (const s of [-1, 1])
        beam(
          q,
          'wood',
          [x + s * (w / 2 + 0.04), y, -0.04],
          [x + s * (w / 2 + 0.04), y + h, -0.04],
          0.09,
          0.09,
          C.wood,
        );
      beam(q, 'wood', [x, y, t * 0.65 - 0.03], [x, y + h, t * 0.65 - 0.03], 0.055, 0.055, C.wood);
      for (const Y of [y - 0.07, y + h + 0.07])
        beam(q, 'stone', [x0 - 0.12, Y, -0.05], [x1 + 0.12, Y, -0.05], 0.14, 0.15, C.stone);
    }
    cursor = x1;
  }
  box(q, 'brick', [cursor, bottom, 0], [E.L, top, t]);
}
function arches(
  o,
  a,
  b,
  bottom,
  spring,
  rise,
  top,
  count,
  lod,
  id,
  { closed = false, parapet = 0, pierWidth } = {},
) {
  const E = orient(o, a, b),
    q = E.o,
    pitch = E.L / count,
    pier = pierWidth ?? Math.min(0.42, pitch * 0.2),
    half = (pitch - pier) / 2,
    t = 0.45;
  for (let i = 0; i <= count; i++) {
    const x = i * pitch;
    box(q, 'brick', [Math.max(0, x - pier / 2), bottom, 0], [Math.min(E.L, x + pier / 2), top, t]);
    if (lod === 3) {
      box(
        q,
        'stone',
        [Math.max(0, x - pier * 0.7), spring - 0.14, -0.09],
        [Math.min(E.L, x + pier * 0.7), spring + 0.08, t + 0.04],
      );
      box(
        q,
        'stone',
        [Math.max(0, x - pier * 0.7), bottom, -0.09],
        [Math.min(E.L, x + pier * 0.7), bottom + 0.2, t + 0.04],
      );
    }
  }
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5) * pitch,
      first = archEvidence.length;
    arch(q, { id: `${id}-${i}`, cx: x, half, spring, rise, bottom, top, z0: 0, z1: t }, lod);
    const ev = archEvidence[first];
    ev.center = E.p([x, bottom + (spring - bottom) * 0.6, 0]);
    ev.normal = E.n([0, 0, -1]);
    ev.depth = closed ? 0.32 : t;
    ev.expected = closed ? 'glass' : 'open';
    if (closed) {
      const curvePoints = curve(x, half, spring, rise, lod);
      face(
        q,
        'glass',
        [
          [x - half, bottom, 0.32],
          ...curvePoints.map((p) => [...p, 0.32]),
          [x + half, bottom, 0.32],
        ],
        [0, 0, -1],
      );
      if (lod >= 2)
        beam(q, 'wood', [x, bottom, 0.29], [x, spring + rise - 0.07, 0.29], 0.075, 0.07, C.wood);
    }
    if (parapet) {
      box(q, 'brick', [x - half, bottom, 0], [x + half, bottom + parapet, t]);
      if (lod >= 2)
        box(
          q,
          'stone',
          [x - half - 0.03, bottom + parapet - 0.1, -0.1],
          [x + half + 0.03, bottom + parapet, t + 0.05],
        );
    }
  }
  box(q, 'stone', [-0.12, top, -0.15], [E.L + 0.12, top + 0.22, t + 0.1]);
}
function bands(o, a, b, ys, lod) {
  const E = orient(o, a, b);
  for (const y of ys) box(E.o, 'stone', [-0.08, y, -0.12], [E.L + 0.08, y + 0.16, 0.4]);
  if (lod === 3)
    for (let x = 0.3; x < E.L; x += 0.65) {
      box(E.o, 'stone', [x - 0.07, ys.at(-1) - 0.36, -0.11], [x + 0.07, ys.at(-1), 0.2]);
    }
}
function diamonds(o, a, b, y, rows, lod) {
  if (lod < 2) return;
  const E = orient(o, a, b),
    q = E.o;
  for (let row = 0; row < rows; row++)
    for (let x = 0.5 + (row % 2) * 0.38; x < E.L - 0.3; x += 0.76) {
      const Y = y + row * 0.68,
        h = 0.22;
      face(
        q,
        'stone',
        [
          [x - h, Y, -0.02],
          [x, Y + h, -0.02],
          [x + h, Y, -0.02],
          [x, Y - h, -0.02],
        ],
        [0, 0, -1],
      );
      if (lod === 3)
        face(
          q,
          'brick',
          [
            [x - 0.09, Y, -0.03],
            [x, Y + 0.09, -0.03],
            [x + 0.09, Y, -0.03],
            [x, Y - 0.09, -0.03],
          ],
          [0, 0, -1],
          rgb('985d53'),
        );
    }
}
function gable(o, lod) {
  const H = P.hall,
    z = H.roofRidgeZ;
  roofPatch(
    o,
    [
      [H.x0 - 0.2, H.wallTop, H.z0 - 0.3],
      [H.x1 + 0.3, H.wallTop, H.z0 - 0.3],
      [H.x1 + 0.3, H.roofRidge, z],
      [H.x0 - 0.2, H.roofRidge, z],
    ],
    lod,
    'whole-main-gable-front',
  );
  roofPatch(
    o,
    [
      [H.x1 + 0.3, H.wallTop, H.z1 + 0.3],
      [H.x0 - 0.2, H.wallTop, H.z1 + 0.3],
      [H.x0 - 0.2, H.roofRidge, z],
      [H.x1 + 0.3, H.roofRidge, z],
    ],
    lod,
    'whole-main-gable-rear',
  );
  for (const x of [H.x0, H.x1])
    face(
      o,
      'brick',
      [
        [x, H.wallTop, H.z0],
        [x, H.wallTop, H.z1],
        [x, H.roofRidge, z],
      ],
      [x === H.x0 ? -1 : 1, 0, 0],
    );
  if (lod >= 2) {
    for (let x = H.x0 + 0.2; x < H.x1; x += 0.75)
      for (const Z of [H.z0 - 0.3, H.z1 + 0.3])
        beam(
          o,
          'roof',
          [x, H.wallTop + 0.025, Z],
          [x, H.roofRidge + 0.025, z],
          0.033,
          0.045,
          C.roof.map((v) => v * 0.8),
        );
    beam(
      o,
      'roof',
      [H.x0 - 0.2, H.roofRidge + 0.03, z],
      [H.x1 + 0.3, H.roofRidge + 0.03, z],
      0.09,
      0.09,
      C.roof,
    );
  }
}
function wholeHall(o, lod) {
  const H = P.hall,
    V = P.veranda;
  floor(o, 'brick', H.x0, H.x1, H.z0, H.z1, P.baseFloorY, P.baseFloorY - P.foundationBottomY);
  floor(o, 'brick', H.x0, H.x1, H.z0, H.z1, P.upperFloorY, 0.32);
  floor(o, 'wood', H.x0, H.x1, H.z0, H.z1, H.wallTop, 0.18);
  for (const [id, a, b, count] of [
    ['front', [H.x0, H.z0], [H.x1, H.z0], 10],
    ['rear', [H.x1, H.z1], [H.x0, H.z1], 10],
    ['right', [H.x1, H.z0], [H.x1, H.z1], 5],
    ['left', [H.x0, H.z1], [H.x0, H.z0], 5],
  ]) {
    rectangleWindows(o, a, b, P.baseFloorY, P.upperFloorY, count, lod, `${id}-lower`);
    rectangleWindows(o, a, b, P.upperFloorY, H.wallTop, count, lod, `${id}-upper`);
    bands(o, a, b, [P.upperFloorY - 0.18, 14.3, H.wallTop - 0.25], lod);
  }
  gable(o, lod);
  for (const [a, b, id] of [
    [[V.x0, V.frontZ], [V.x1, V.frontZ], 'long-front'],
    [[V.x1, V.frontZ], [V.x1, V.backZ], 'southeast-return'],
  ]) {
    arches(
      o,
      a,
      b,
      P.baseFloorY,
      V.lowerSpring,
      V.lowerRise,
      V.lowerTop,
      id === 'long-front' ? V.bays : 2,
      lod,
      `${id}-ground`,
    );
    arches(
      o,
      a,
      b,
      P.upperFloorY,
      V.upperSpring,
      V.upperRise,
      V.upperTop,
      id === 'long-front' ? V.bays : 2,
      lod,
      `${id}-upper`,
      { parapet: 0.65 },
    );
    bands(o, a, b, [7.3, 14.2, 17.25], lod);
    const E = orient(o, a, b);
    box(E.o, 'brick', [0, V.upperTop + 0.22, 0], [E.L, V.clerestoryBottom, 0.45]);
    arches(
      o,
      a,
      b,
      V.clerestoryBottom,
      16.1,
      0.65,
      V.clerestoryTop,
      id === 'long-front' ? V.bays : 2,
      lod,
      `${id}-clerestory`,
      { closed: true },
    );
    diamonds(o, a, b, 13.5, 1, lod);
    diamonds(o, a, b, 16.7, 1, lod);
  }
  floor(
    o,
    'brick',
    V.x0,
    V.x1,
    V.frontZ,
    V.backZ,
    P.baseFloorY,
    P.baseFloorY - P.foundationBottomY,
  );
  floor(o, 'brick', V.x0, V.x1, V.frontZ, V.backZ, P.upperFloorY, 0.3);
  floor(o, 'wood', V.x0, V.x1, V.frontZ, V.backZ, 14.15, 0.18);
  // Veranda is roofed continuously into the main slope; a separate flat shelf cannot replace it.
  roofPatch(
    o,
    [
      [V.x0 - 0.15, 17.2, V.frontZ - 0.25],
      [V.x1 + 0.15, 17.2, V.frontZ - 0.25],
      [V.x1 + 0.15, H.wallTop + 0.03, H.z0],
      [V.x0 - 0.15, H.wallTop + 0.03, H.z0],
    ],
    lod,
    'whole-covered-veranda-roof',
  );
  partEvidence.push({
    id: 'whole-two-storey-mainhall-rear-envelope-and-long-two-level-veranda',
    bays: V.bays,
  });
}
function pavilion(o, Q, lod, id) {
  floor(o, 'brick', Q.x0, Q.x1, Q.z0, Q.z1, P.baseFloorY, P.baseFloorY - P.foundationBottomY);
  floor(o, 'wood', Q.x0, Q.x1, Q.z0, Q.z1, Q.eave, 0.2);
  const edges = [
    [
      [Q.x0, Q.z0],
      [Q.x1, Q.z0],
    ],
    [
      [Q.x1, Q.z0],
      [Q.x1, Q.z1],
    ],
    [
      [Q.x1, Q.z1],
      [Q.x0, Q.z1],
    ],
    [
      [Q.x0, Q.z1],
      [Q.x0, Q.z0],
    ],
  ];
  for (const [i, [a, b]] of edges.entries()) {
    const count = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
    rectangleWindows(o, a, b, P.baseFloorY, P.upperFloorY, count, lod, `${id}-${i}-lower`);
    const entry = id === 'whole-east-hipped-porch-pavilion' && i === 2;
    arches(
      o,
      a,
      b,
      entry ? 7.5 : 8.1,
      13,
      1.45,
      15.2,
      entry ? 1 : count,
      lod,
      `${id}-${i}-paired-lancets`,
      { closed: true },
    );
    const E = orient(o, a, b);
    if (entry) {
      box(E.o, 'wood', [E.L / 2 - 1, 7.5, 0.24], [E.L / 2 + 1, 11, 0.3]);
    } else box(E.o, 'brick', [0, 7.5, 0], [E.L, 8.1, 0.45]);
    box(E.o, 'brick', [0, 15.42, 0], [E.L, Q.eave, 0.45]);
    bands(o, a, b, [7.35, 15.35, Q.eave - 0.3], lod);
    diamonds(o, a, b, 16.05, 2, lod);
  }
  hip(o, { ...Q, eave: Q.eave, ridge: Q.ridge, id }, lod);
  partEvidence.push({ id, wholeHippedPavilion: true });
}
function polygonBand(o, c, r, y, h, n, rotation = 0, k = 'stone') {
  const a = Array.from({ length: n }, (_, i) => {
    const t = rotation + (Math.PI * 2 * i) / n;
    return [c[0] + r * Math.cos(t), y, c[1] + r * Math.sin(t)];
  });
  loft(o, k, [a, a.map((p) => [p[0], y + h, p[2]])], C[k], { cap: true });
}
function tower(o, lod) {
  const T = P.belfry,
    c = T.center,
    r = T.radius,
    N = 8,
    ring = Array.from({ length: N }, (_, i) => {
      const a = T.rotation + (i * Math.PI * 2) / N;
      return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    });
  polygonBand(
    o,
    c,
    r,
    P.foundationBottomY,
    P.baseFloorY - P.foundationBottomY,
    N,
    T.rotation,
    'brick',
  );
  polygonBand(o, c, r, P.baseFloorY, T.lowerLancetBottom - P.baseFloorY, N, T.rotation, 'brick');
  for (let i = 0; i < N; i++) {
    const a = ring[i],
      b = ring[(i + 1) % N],
      E = orient(o, a, b);
    arches(
      o,
      a,
      b,
      T.lowerLancetBottom,
      T.lowerLancetSpring,
      T.lowerLancetRise,
      15.1,
      1,
      lod,
      `belfry-lower-${i}`,
      { closed: true, pierWidth: E.L * 0.6 },
    );
    box(E.o, 'brick', [0, 15.32, 0], [E.L, T.upperLancetBottom, 0.45]);
    arches(
      o,
      a,
      b,
      T.upperLancetBottom,
      T.upperLancetSpring,
      T.upperLancetRise,
      T.shaftTop,
      1,
      lod,
      `open-belfry-lancet-${i}`,
      { pierWidth: E.L * 0.6 },
    );
    if (lod >= 2) {
      beam(
        E.o,
        'stone',
        [0.04, T.upperLancetBottom, -0.1],
        [0.04, T.shaftTop, -0.1],
        0.12,
        0.15,
        C.stone,
      );
      diamonds(o, a, b, 16.4, 1, lod);
      const x = E.L / 2,
        Y = 16.6;
      for (let j = 0; j < 12; j++) {
        const t = (j * Math.PI * 2) / 12,
          rr = 0.4;
        face(
          E.o,
          j % 2 ? 'brick' : 'stone',
          [
            [x, Y, -0.05],
            [x + rr * Math.cos(t), Y + rr * Math.sin(t), -0.05],
            [x + rr * Math.cos(t + Math.PI / 6), Y + rr * Math.sin(t + Math.PI / 6), -0.05],
          ],
          [0, 0, -1],
          j % 2 ? rgb('985d53') : C.stone,
        );
      }
    }
    // Broad pointed dormer-gables surround the octagonal spire base.
    if (lod >= 1) {
      face(
        E.o,
        'brick',
        [
          [0, T.spireBase, 0],
          [E.L, T.spireBase, 0],
          [E.L / 2, T.spireBase + 2.9, 0],
        ],
        [0, 0, -1],
      );
      beam(
        E.o,
        'stone',
        [0, T.spireBase, -0.06],
        [E.L / 2, T.spireBase + 2.9, -0.06],
        0.16,
        0.17,
        C.stone,
      );
      beam(
        E.o,
        'stone',
        [E.L, T.spireBase, -0.06],
        [E.L / 2, T.spireBase + 2.9, -0.06],
        0.16,
        0.17,
        C.stone,
      );
    }
  }
  for (const y of [T.shaftMidBelt, 15.2, T.upperBelt, T.shaftTop])
    polygonBand(o, c, r + 0.1, y, 0.22, N, T.rotation);
  const lower = Array.from({ length: N }, (_, i) => {
      const a = T.rotation + (i * Math.PI * 2) / N;
      return [c[0] + (r + 0.15) * Math.cos(a), T.spireBase, c[1] + (r + 0.15) * Math.sin(a)];
    }),
    upper = lower.map((_p, i) => {
      const a = T.rotation + (i * Math.PI * 2) / N;
      return [
        c[0] + T.spireTopRadius * Math.cos(a),
        T.spireTop,
        c[1] + T.spireTopRadius * Math.sin(a),
      ];
    });
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    roofPatch(o, [lower[i], lower[j], upper[j], upper[i]], lod, `belfry-whole-spire-${i}`);
  }
  face(o, 'roof', upper, [0, 1, 0]);
  if (lod >= 1) {
    for (let i = 0; i < N; i++) {
      const a = T.rotation + (i * Math.PI * 2) / N,
        p0 = [c[0] + 0.72 * Math.cos(a), T.spireTop, c[1] + 0.72 * Math.sin(a)],
        p1 = [c[0] + 0.77 * Math.cos(a), T.spireTop + 1.1, c[1] + 0.77 * Math.sin(a)],
        p2 = [c[0] + 0.5 * Math.cos(a), T.crownTop - 0.3, c[1] + 0.5 * Math.sin(a)];
      beam(o, 'iron', p0, p1, 0.065, 0.065, C.iron);
      beam(o, 'iron', p1, p2, 0.065, 0.065, C.iron);
      beam(o, 'iron', p2, [c[0], T.crownTop, c[1]], 0.065, 0.065, C.iron);
    }
    for (const y of [T.spireTop + 0.5, T.spireTop + 1.2]) {
      const rr = 0.76;
      for (let i = 0; i < N; i++) {
        const a = T.rotation + (i * Math.PI * 2) / N,
          b = a + (Math.PI * 2) / N;
        beam(
          o,
          'iron',
          [c[0] + rr * Math.cos(a), y, c[1] + rr * Math.sin(a)],
          [c[0] + rr * Math.cos(b), y, c[1] + rr * Math.sin(b)],
          0.055,
          0.055,
          C.iron,
        );
      }
    }
  } else beam(o, 'iron', [c[0], T.spireTop, c[1]], [c[0], T.crownTop, c[1]], 0.13, 0.13, C.iron);
  partEvidence.push({
    id: 'whole-octagonal-belfry-open-lancets-eight-sided-spire-and-open-iron-crown',
  });
}
function thinSpire(o, lod) {
  const S = P.roofSpire,
    c = S.center,
    N = 8;
  polygonBand(o, c, S.radius, 20.4, S.openBottom - 20.4, N, 0, 'roof');
  for (let i = 0; i < N; i++) {
    const a = (i * Math.PI * 2) / N,
      p = [c[0] + S.radius * Math.cos(a), S.openBottom, c[1] + S.radius * Math.sin(a)],
      q = [p[0], S.openTop, p[2]];
    beam(o, 'roof', p, q, lod < 2 ? 0.18 : 0.13, lod < 2 ? 0.18 : 0.13, C.roof);
    if (lod >= 2) {
      const b = a + (Math.PI * 2) / N;
      beam(
        o,
        'roof',
        [p[0], S.openTop - 1.1, p[2]],
        [c[0] + S.radius * Math.cos(b), S.openTop, c[1] + S.radius * Math.sin(b)],
        0.1,
        0.1,
        C.roof,
      );
    }
  }
  const lower = radialRing(S.openTop, S.radius, S.radius, N, c),
    upper = radialRing(S.spireTop, 0.04, 0.04, N, c);
  for (let i = 0; i < N; i++)
    roofPatch(
      o,
      [lower[i], lower[(i + 1) % N], upper[(i + 1) % N], upper[i]],
      lod,
      `thin-open-roofspire-${i}`,
    );
  beam(o, 'iron', [c[0], S.spireTop, c[1]], [c[0], S.tip, c[1]], 0.055, 0.055, C.iron);
  partEvidence.push({ id: 'whole-thin-open-roofstage-and-steep-spire' });
}
function stairs(o, lod) {
  const S = P.stairs,
    x = S.centerX,
    z = S.z0;
  floor(o, 'brick', x - S.landingWidth / 2, x + S.landingWidth / 2, z, z + 2.1, S.landingTop, 0.28);
  const n = lod === 0 ? 7 : S.steps;
  for (const side of [-1, 1]) {
    const cx = x + side * (S.landingWidth / 2 + S.flightWidth / 2);
    for (let i = 0; i < n; i++) {
      const top = S.approachY + ((i + 1) * (S.landingTop - S.approachY)) / n,
        Z = z + 2.1 + (1 - (i + 1) / n) * S.steps * S.run;
      box(
        o,
        'brick',
        [cx - S.flightWidth / 2, P.foundationBottomY, Z],
        [cx + S.flightWidth / 2, top, Z + (S.steps * S.run) / n],
      );
      stairEvidence.push({ id: `east-double-flight-${side}-${i}`, point: [cx, top, Z + 0.05] });
    }
    if (lod > 0) {
      const X = cx + (side * S.flightWidth) / 2;
      beam(
        o,
        'stone',
        [X, S.approachY + 0.95, z + 2.1 + S.steps * S.run],
        [X, S.landingTop + 0.95, z + 2.1],
        0.22,
        0.22,
        C.stone,
      );
      for (let i = 0; i <= 7; i++) {
        const t = i / 7;
        beam(
          o,
          'stone',
          [X, S.approachY + (S.landingTop - S.approachY) * t, z + 2.1 + S.steps * S.run * (1 - t)],
          [
            X,
            S.approachY + 0.95 + (S.landingTop - S.approachY) * t,
            z + 2.1 + S.steps * S.run * (1 - t),
          ],
          0.1,
          0.1,
          C.stone,
        );
      }
    }
  }
  partEvidence.push({ id: 'whole-east-porch-and-double-flight-stair', steps: 2 * n });
}
function coarseWhole(o, lod) {
  const H = P.hall,
    V = P.veranda;
  box(o, 'brick', [H.x0, P.foundationBottomY, H.z0], [H.x1, H.wallTop, H.z1]);
  gable(o, lod);
  for (const Q of [P.northPavilion, P.eastPavilion]) {
    box(o, 'brick', [Q.x0, P.foundationBottomY, Q.z0], [Q.x1, Q.eave, Q.z1]);
    hip(o, { ...Q, id: 'whole-coarse-pavilion' }, lod);
  }
  for (const [y, spring, rise, top, id] of [
    [P.baseFloorY, V.lowerSpring, V.lowerRise, V.lowerTop, 'ground'],
    [P.upperFloorY, V.upperSpring, V.upperRise, V.upperTop, 'upper'],
  ])
    arches(
      o,
      [V.x0, V.frontZ],
      [V.x1, V.frontZ],
      y,
      spring,
      rise,
      top,
      lod === 0 ? 5 : 10,
      lod,
      `coarse-long-veranda-${id}`,
      { parapet: id === 'upper' ? 0.65 : 0 },
    );
  floor(
    o,
    'brick',
    V.x0,
    V.x1,
    V.frontZ,
    V.backZ,
    P.baseFloorY,
    P.baseFloorY - P.foundationBottomY,
  );
  floor(o, 'brick', V.x0, V.x1, V.frontZ, V.backZ, P.upperFloorY, 0.3);
  box(o, 'brick', [V.x0, 14.37, V.frontZ], [V.x1, 17.2, V.backZ]);
  roofPatch(
    o,
    [
      [V.x0, 17.2, V.frontZ],
      [V.x1, 17.2, V.frontZ],
      [V.x1, H.wallTop, H.z0],
      [V.x0, H.wallTop, H.z0],
    ],
    lod,
    'covered-whole-veranda',
  );
  const T = P.belfry,
    c = T.center,
    N = 8;
  polygonBand(
    o,
    c,
    T.radius,
    P.foundationBottomY,
    T.shaftTop - P.foundationBottomY,
    N,
    T.rotation,
    'brick',
  );
  const low = Array.from({ length: N }, (_, i) => {
      const a = T.rotation + (i * Math.PI * 2) / N;
      return [
        c[0] + (T.radius + 0.15) * Math.cos(a),
        T.spireBase,
        c[1] + (T.radius + 0.15) * Math.sin(a),
      ];
    }),
    up = low.map((_p, i) => {
      const a = T.rotation + (i * Math.PI * 2) / N;
      return [
        c[0] + T.spireTopRadius * Math.cos(a),
        T.spireTop,
        c[1] + T.spireTopRadius * Math.sin(a),
      ];
    });
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    roofPatch(o, [low[i], low[j], up[j], up[i]], lod, `whole-coarse-belfry-spire-${i}`);
    if (lod === 1) {
      const E = orient(o, [low[i][0], low[i][2]], [low[j][0], low[j][2]]);
      panel(
        E.o,
        'glass',
        { at: (t, y, d) => [t, y, d], n: [0, 0, -1] },
        E.L / 2,
        19.5,
        E.L * 0.55,
        10,
        -0.03,
      );
    }
  }
  beam(o, 'iron', [c[0], T.spireTop, c[1]], [c[0], T.crownTop, c[1]], 0.1, 0.1, C.iron);
  thinSpire(o, lod);
  const S = P.stairs;
  floor(
    o,
    'brick',
    S.centerX - S.landingWidth / 2,
    S.centerX + S.landingWidth / 2,
    S.z0,
    S.z0 + 2.1,
    S.landingTop,
    0.28,
  );
  for (const side of [-1, 1]) {
    const cx = S.centerX + side * (S.landingWidth / 2 + S.flightWidth / 2),
      n = lod === 0 ? 3 : 12;
    for (let i = 0; i < n; i++) {
      const Y = S.approachY + ((i + 1) * (S.landingTop - S.approachY)) / n,
        Z = S.z0 + 2.1 + (1 - (i + 1) / n) * S.steps * S.run;
      box(
        o,
        'brick',
        [cx - S.flightWidth / 2, P.foundationBottomY, Z],
        [cx + S.flightWidth / 2, Y, Z + (S.steps * S.run) / n],
      );
      stairEvidence.push({ id: `coarse-step-${side}-${i}`, point: [cx, Y, Z + 0.06] });
    }
  }
  partEvidence.push({
    id: 'whole-mainhall-two-pavilions-two-level-verandas-belfry-roofspire-and-stairs-coarse',
  });
}
function eastConnectingBody(o, lod) {
  const H = P.hall,
    Q = P.eastPavilion,
    outline = P.nativeParts[0].outline,
    x1 = Math.max(...outline.map((p) => p[0])),
    z0 = -3.84,
    z1 = Q.z0;
  box(o, 'brick', [H.x1 - 0.2, P.foundationBottomY, z0], [x1, H.wallTop, z1]);
  hip(
    o,
    {
      x0: H.x1 - 0.2,
      x1,
      z0,
      z1,
      eave: H.wallTop,
      ridge: Q.ridge,
      id: 'whole-east-end-connecting-body',
    },
    lod,
  );
  partEvidence.push({ id: 'whole-east-end-connecting-body', nativeComponent: 'way/479793154' });
}
export function buildHouse(out, _frame, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    roofEvidence,
    archEvidence,
    windowEvidence,
    stairEvidence,
    turretEvidence,
    postEvidence,
    soffitEvidence,
  ])
    a.length = 0;
  const o = {
    addConvexPolygon: (k, r, p, n, _uv, col) =>
      out.addConvexPolygon(k, r, p.map(toWorld), rotate(n), (p) => [p[0], p[1]], col),
    addTriangle: (k, r, p, n, uv, col) => out.addTriangle(k, r, p.map(toWorld), rotate(n), uv, col),
    addQuad: (k, r, p, n, uv, col) => out.addQuad(k, r, p.map(toWorld), rotate(n), uv, col),
  };
  eastConnectingBody(o, lod);
  if (lod < 2) {
    coarseWhole(o, lod);
    return;
  }
  wholeHall(o, lod);
  pavilion(o, P.northPavilion, lod, 'whole-north-hipped-end-pavilion');
  pavilion(o, P.eastPavilion, lod, 'whole-east-hipped-porch-pavilion');
  tower(o, lod);
  thinSpire(o, lod);
  stairs(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tk/tkr/frere_hall',
  cam = (p) => toWorld(p),
  camera = cam([66, 41, -90]),
  look = cam([0, 16, 0]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Frere Hall (2009)',
  cell: 'tk/tkr',
  wikidataId: 'Q3924620',
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
  portableGroundY: -3,
  mediumFiContext: {
    scale: 1,
    groundY: -3,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_raw',
    'stone_marble',
    'metal_standing_seam',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'whole-hall-arcades-roofs-and-both-towers', position: camera, lookAt: look },
    {
      name: 'complete-rear-and-east-double-flight-stair',
      position: cam([-58, 37, 78]),
      lookAt: look,
    },
    {
      name: 'pointed-two-level-verandas-and-geometric-clerestory',
      position: cam([0, 9, -26]),
      lookAt: cam([2, 11, -8]),
    },
    {
      name: 'octagonal-open-belfry-spire-and-iron-crown',
      position: cam([36, 32, -33]),
      lookAt: cam([17.25, 29, -6.85]),
    },
    { name: 'whole-east-porch-and-stair', position: cam([37, 15, 38]), lookAt: cam([17, 7, 15]) },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-frere-hall-${reviewLod}`,
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
    'Original authored geometry/repository license. Qualla-first41families checked; native unmodified Kamranyosuf archived original369820bytes/SHA1/explicit PD-user-en namedgrant/originalauthor2009upload/nativeOgreBotoldversionbinding. Laterrecoloredversion neverused. OSMODbLsixintrinsicbuildingparts66controls/Q3924620, primarySindhgovernmenttextonly. Fullhiddenrear/sections/heights/registration/grade estimated; no photographictexture orcopiedinteriorart/lettering/garden. No rightsrepair.',
};
