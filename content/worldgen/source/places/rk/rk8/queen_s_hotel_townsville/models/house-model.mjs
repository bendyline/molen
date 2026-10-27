/** Whole circa1932 Queens Hotel. Native frame, original field and main sections precede geometry. */
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
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.87, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0.3 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.35, metallic: 0 },
};
const C = {
  brick: rgb('805e50'),
  stone: rgb('d5ccae'),
  roof: rgb(P.roof.color),
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
function ring(r) {
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
    throw Error('Hotel roof/floor cap failed');
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
function wall(o, k, a, b, y0, y1, inward = false) {
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
function window(o, E, t, y, w, h, lod) {
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
  const count = [1, 2, 4, 8][lod];
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
    for (const extra of lod === 3 ? [0.07, 0.22, 0.38] : [0.1]) {
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
function body(o, lod) {
  const B = P.body,
    outer = ring(B.outer),
    holes = B.courts.map((q) =>
      ring([
        [q.x0, q.z0],
        [q.x1, q.z0],
        [q.x1, q.z1],
        [q.x0, q.z1],
      ]),
    );
  cap(o, 'stone', outer, holes, P.baseFloorY, [0, 1, 0]);
  cap(o, 'roof', outer, holes, B.eave, [0, 1, 0]);
  for (const [h, r] of [outer, ...holes].entries())
    for (let i = 0; i < r.length; i++) {
      const E = wall(o, 'brick', r[i], r[(i + 1) % r.length], P.foundationBottomY, B.eave, h > 0);
      if (lod > 0) {
        const N = Math.max(1, Math.floor(E.L / B.rearWindows.pitch));
        for (let j = 0; j < N; j++) {
          const t = (E.L * (j + 0.5)) / N;
          if (h === 0 && i === 3 && Math.abs(t - 24) < 1) continue;
          for (const y of B.rearWindows.bottoms)
            window(o, E, t, y, B.rearWindows.width, B.rearWindows.height, lod);
        }
      }
    }
  for (const q of B.courts) {
    cap(
      o,
      'stone',
      ring([
        [q.x0, q.z0],
        [q.x1, q.z0],
        [q.x1, q.z1],
        [q.x0, q.z1],
      ]),
      [],
      P.baseFloorY,
      [0, 1, 0],
    );
  }
  for (const s of B.roofSections) hip(o, s, lod);
  partEvidence.push({
    id: 'whole-native-context-derived-hotel-body',
    controls: B.outer.length,
    courts: 2,
    hiddenPlanEstimated: true,
  });
}
function rail(o, a, b, y, lod, id) {
  if (lod === 0) return;
  const z = -0.055;
  for (const Y of [y + 0.12, y + P.arcade.railHeight])
    if (lod === 3) beam(o, 'iron', [a, Y, z], [b, Y, z], 0.06, 0.07, C.iron);
    else
      face(
        o,
        'iron',
        [
          [a, Y - 0.035, z],
          [b, Y - 0.035, z],
          [b, Y + 0.035, z],
          [a, Y + 0.035, z],
        ],
        [0, 0, -1],
      );
  const N = Math.ceil((b - a) / (lod === 3 ? 0.23 : lod === 2 ? 0.65 : 1.1));
  for (let i = 0; i <= N; i++) {
    const x = a + ((b - a) * i) / N;
    if (lod === 3)
      beam(o, 'iron', [x, y + 0.1, z], [x, y + P.arcade.railHeight, z], 0.045, 0.045, C.iron);
    else
      face(
        o,
        'iron',
        [
          [x - 0.025, y + 0.1, z],
          [x + 0.025, y + 0.1, z],
          [x + 0.025, y + P.arcade.railHeight, z],
          [x - 0.025, y + P.arcade.railHeight, z],
        ],
        [0, 0, -1],
      );
    if (lod === 3 && i < N) {
      const xx = a + ((b - a) * (i + 0.5)) / N;
      beam(o, 'iron', [x, y + 0.25, z], [xx, y + 0.75, z], 0.028, 0.028, C.iron);
      beam(
        o,
        'iron',
        [xx, y + 0.75, z],
        [a + ((b - a) * (i + 1)) / N, y + 0.25, z],
        0.028,
        0.028,
        C.iron,
      );
    }
  }
  postEvidence.push({ id, center: [(a + b) / 2, y + 0.6, z] });
}
function arcade(o, lod) {
  const A = P.arcade;
  for (const [j, [a, b]] of A.ranges.entries()) {
    const N = (lod === 0 ? A.farBayCounts : A.nearBayCounts)[j],
      pitch = (b - a) / N;
    for (let i = 0; i <= N; i++) {
      const x = a + i * pitch,
        w = A.pierWidth;
      box(o, 'brick', [x - w / 2, P.baseFloorY, 0], [x + w / 2, A.spring, 0.72]);
      if (lod >= 2) {
        box(o, 'stone', [x - w * 0.7, P.baseFloorY, -0.1], [x + w * 0.7, 1.1, 0.82]);
        box(
          o,
          'stone',
          [x - w * 0.75, A.spring - 0.12, -0.12],
          [x + w * 0.75, A.spring + 0.12, 0.84],
        );
      }
      if (lod > 0) {
        box(o, 'iron', [x - 0.06, A.upperFloor, -0.01], [x + 0.06, A.upperRoofEave, 0.11]);
        if (lod === 3) {
          for (const h of [5.9, 7.5]) {
            box(o, 'stone', [x - 0.09, h, -0.04], [x + 0.09, h + 0.13, 0.14]);
          }
        }
        postEvidence.push({ id: `veranda-post-${j}-${i}`, center: [x, 7, 0.05] });
      }
    }
    for (let i = 0; i < N; i++) {
      const x = a + (i + 0.5) * pitch,
        half = (pitch - A.pierWidth) / 2;
      arch(
        o,
        {
          id: `ground-${j}-${i}`,
          cx: x,
          half,
          spring: A.spring,
          rise: A.rise,
          bottom: A.openingBottom,
          top: A.top,
          z0: 0,
          z1: 0.72,
          kind: 'ground-pointed',
        },
        lod,
      );
      if (lod > 0 && x > 0) {
        const q = curve(x, half - 0.19, A.spring, A.rise - 0.18, lod);
        face(
          o,
          'glass',
          [
            [x - half + 0.19, 1.1, 0.2],
            ...q.map(([u, y]) => [u, y, 0.2]),
            [x + half - 0.19, 1.1, 0.2],
          ],
          [0, 0, -1],
        );
        windowEvidence.push({ center: [x, 2.1, 0.2], normal: [0, 0, -1] });
        if (lod >= 2) {
          box(o, 'stone', [x - half, 1.0, -0.13], [x + half, 1.15, 0.34]);
          box(o, 'wood', [x - 0.055, 1.1, 0.1], [x + 0.055, A.spring + A.rise - 0.25, 0.22]);
          box(o, 'wood', [x - half + 0.2, 2.72, 0.09], [x + half - 0.2, 2.82, 0.22]);
        }
      }
      rail(
        o,
        x - pitch / 2 + 0.09,
        x + pitch / 2 - 0.09,
        A.upperFloor,
        lod,
        `veranda-rail-${j}-${i}`,
      );
    }
    box(o, 'stone', [a - 0.3, A.top, -0.22], [b + 0.3, A.upperFloor, 0.95]);
    cap(
      o,
      'wood',
      ring([
        [a, 0],
        [b, 0],
        [b, A.bodyFrontZ],
        [a, A.bodyFrontZ],
      ]),
      [],
      A.upperFloor,
      [0, 1, 0],
    );
    face(
      o,
      'wood',
      [
        [a, A.upperRoofEave, -0.4],
        [b, A.upperRoofEave, -0.4],
        [b, A.upperRoofBack, 4.4],
        [a, A.upperRoofBack, 4.4],
      ],
      [0, -1, 0],
    );
    roofPatch(
      o,
      [
        [a - 0.35, A.upperRoofEave + 0.09, -0.5],
        [b + 0.35, A.upperRoofEave + 0.09, -0.5],
        [b + 0.35, A.upperRoofBack + 0.09, 4.5],
        [a - 0.35, A.upperRoofBack + 0.09, 4.5],
      ],
      lod,
      `veranda-cover-${j}`,
    );
    if (lod > 0)
      beam(
        o,
        'iron',
        [a - 0.4, A.upperRoofEave, -0.45],
        [b + 0.4, A.upperRoofEave, -0.45],
        0.14,
        0.14,
        C.iron,
      );
    partEvidence.push({ id: `whole-covered-veranda-range-${j}`, bays: N });
  }
}
function dome(o, c, lod, id) {
  const N = [5, 8, 12, 20][lod],
    cx = c[0],
    z = c[1],
    K = P.portals[0];
  const nr = lod === 0 ? 2 : lod === 1 ? 3 : lod === 2 ? 5 : 9,
    rings = Array.from({ length: nr }, (_, i) => {
      const t = ((i / nr) * Math.PI) / 2;
      return radialRing(
        K.cupolaBase + Math.sin(t) * K.cupolaRise,
        K.cupolaRadius * Math.cos(t),
        K.cupolaRadius * Math.cos(t),
        N,
        [cx, z],
      );
    });
  loft(o, 'roof', rings, C.roof, { cap: false });
  const last = rings.at(-1),
    apex = [cx, K.cupolaBase + K.cupolaRise, z];
  for (let i = 0; i < N; i++) {
    const ps = [last[i], last[(i + 1) % N], apex];
    face(o, 'roof', ps, normalFor(...ps));
  }
  turretEvidence.push({
    id,
    center: c,
    base: K.cupolaBase,
    radius: K.cupolaRadius,
    rise: K.cupolaRise,
  });
  if (lod === 0) {
    face(
      o,
      'stone',
      [
        [cx - 0.13, K.cupolaBase + K.cupolaRise, z],
        [cx + 0.13, K.cupolaBase + K.cupolaRise, z],
        [cx, K.tip, z],
      ],
      [0, 0, -1],
    );
  } else beam(o, 'stone', apex, [cx, K.tip, z], 0.17, 0.17, C.stone);
}
function portal(o, K, lod) {
  const cx = K.center[0],
    z = K.center[1],
    half = K.openingWidth / 2,
    side = K.width / 2 - half;
  for (const s of [-1, 1]) {
    const x = cx + s * (half + side / 2);
    box(o, 'brick', [x - side / 2, P.foundationBottomY, z], [x + side / 2, K.spring, z + 0.9]);
    if (lod >= 2) {
      box(
        o,
        'stone',
        [x - side / 2 - 0.08, P.baseFloorY, z - 0.12],
        [x + side / 2 + 0.08, 1.2, z + 1.02],
      );
      box(
        o,
        'stone',
        [x - side / 2 - 0.1, K.spring - 0.16, z - 0.15],
        [x + side / 2 + 0.1, K.spring + 0.14, z + 1.05],
      );
    }
  }
  arch(
    o,
    {
      id: K.id,
      cx,
      half,
      spring: K.spring,
      rise: K.rise,
      bottom: P.baseFloorY,
      top: K.entryTop,
      z0: z,
      z1: z + 0.9,
      kind: 'entry-pointed',
    },
    lod,
  );
  box(o, 'stone', [cx - K.width / 2, 8, z - 0.08], [cx + K.width / 2, 8.25, z + 0.95]);
  if (lod > 0) {
    const N = K.upperArcadeCount,
      pitch = 1.05;
    for (let i = 0; i <= N; i++) {
      const x = cx + (i - N / 2) * pitch;
      box(o, 'stone', [x - 0.12, 8.25, z], [x + 0.12, K.upperArcadeSpring, z + 0.7]);
    }
    for (let i = 0; i < N; i++) {
      const x = cx + (i + 0.5 - N / 2) * pitch;
      arch(
        o,
        {
          id: `${K.id}-upper-${i}`,
          cx: x,
          half: K.upperArcadeRadius,
          spring: K.upperArcadeSpring,
          rise: K.upperArcadeRadius,
          bottom: 8.25,
          top: K.upperTop,
          z0: z,
          z1: z + 0.7,
          kind: 'upper-round',
          round: true,
        },
        lod,
      );
    }
    box(o, 'brick', [cx - K.width / 2, 8.25, z + 0.8], [cx + K.width / 2, 8.75, z + 1.1]);
  } else box(o, 'brick', [cx - K.width / 2, 8.25, z], [cx + K.width / 2, K.upperTop, z + 0.8]);
  box(
    o,
    'stone',
    [cx - K.width / 2 - 0.15, K.upperTop, z - 0.2],
    [cx + K.width / 2 + 0.15, K.upperTop + 0.23, z + 1.1],
  );
  for (const [i, c] of K.turretCenters.entries()) {
    const N = [5, 8, 12, 20][lod];
    loft(
      o,
      'brick',
      [
        radialRing(K.turretShaftBottom, K.turretRadius, K.turretRadius, N, c),
        radialRing(K.turretShaftTop, K.turretRadius, K.turretRadius, N, c),
      ],
      C.brick,
      { cap: false },
    );
    if (lod > 0)
      for (const y of [5, 9.7, 12.3])
        loft(
          o,
          'stone',
          [
            radialRing(y, K.turretRadius + 0.13, K.turretRadius + 0.13, N, c),
            radialRing(y + 0.22, K.turretRadius + 0.13, K.turretRadius + 0.13, N, c),
          ],
          C.stone,
          { cap: false },
        );
    loft(
      o,
      'stone',
      [
        radialRing(K.turretShaftTop, K.turretRadius, K.turretRadius, N, c),
        radialRing(K.cupolaBase, K.cupolaRadius, K.cupolaRadius, N, c),
      ],
      C.stone,
      { cap: false },
    );
    dome(o, c, lod, `${K.id}-cupola-${i}`);
  }
  const M = K.mansard,
    r0 = [
      [M.x0, M.eave, M.z0],
      [M.x1, M.eave, M.z0],
      [M.x1, M.eave, M.z1],
      [M.x0, M.eave, M.z1],
    ],
    r1 = [
      [M.x0 + M.shoulderInset, M.shoulder, M.z0 + M.shoulderInset],
      [M.x1 - M.shoulderInset, M.shoulder, M.z0 + M.shoulderInset],
      [M.x1 - M.shoulderInset, M.shoulder, M.z1 - M.shoulderInset],
      [M.x0 + M.shoulderInset, M.shoulder, M.z1 - M.shoulderInset],
    ];
  for (let i = 0; i < 4; i++)
    roofPatch(o, [r0[i], r0[(i + 1) % 4], r1[(i + 1) % 4], r1[i]], lod, `${K.id}-mansard-${i}`);
  hip(
    o,
    {
      id: `${K.id}-mansard-cap`,
      x0: r1[0][0],
      x1: r1[1][0],
      z0: r1[0][2],
      z1: r1[2][2],
      eave: M.shoulder,
      ridge: M.top,
    },
    lod,
  );
  if (lod === 3) {
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        A = r0[i],
        B = r0[j],
        D = r1[i],
        E = r1[j];
      for (let row = 1; row < 7; row++)
        for (let k = 0; k < 8; k++) {
          const s = (k + 0.5 * (row % 2)) / 8,
            t = row / 8,
            lerp = (p, q, f) => p.map((x, l) => x + (q[l] - x) * f),
            at = (s, t) => lerp(lerp(A, B, s), lerp(D, E, s), t),
            ps = [at(s - 0.037, t), at(s, t - 0.025), at(s + 0.037, t), at(s, t + 0.025)],
            n = normalFor(...ps);
          if (n[1] < 0)
            n.forEach((_, k) => {
              n[k] *= -1;
            });
          face(
            o,
            'roof',
            ps.map((p) => p.map((x, k) => x + n[k] * 0.015)),
            n,
            C.roof.map((x) => x * 0.85),
          );
        }
    }
  }
  // Visible entrance recess terminates at a real door in the complete hotel body.
  box(o, 'wood', [cx - 1.65, P.baseFloorY, 4.22], [cx + 1.65, 3.9, 4.3]);
  if (lod >= 2) {
    box(o, 'iron', [cx - 0.04, P.baseFloorY, 4.19], [cx + 0.04, 3.9, 4.22]);
  }
  for (const [i, s] of P.entrySteps.entries()) {
    box(
      o,
      'stone',
      [cx - half - 0.3, P.foundationBottomY, z - s.depth],
      [cx + half + 0.3, s.top, z],
    );
    stairEvidence.push({
      id: `${K.id}-step-${i}`,
      point: [cx, s.top, z - s.depth + (i === P.entrySteps.length - 1 ? 0.3 : 0.12)],
    });
  }
  partEvidence.push({ id: K.id, wholeMansard: true, roundTurrets: 2 });
}
function parapet(o, lod) {
  const Q = P.centralParapet,
    w = Q.width / 2,
    [cx, z] = Q.center,
    N = lod === 0 ? 4 : lod === 1 ? 6 : lod === 2 ? 12 : 24,
    ps = Array.from({ length: N + 1 }, (_, i) => {
      const x = -w + (2 * w * i) / N,
        y = Q.base + (Q.top - Q.base) * Math.sqrt(Math.max(0, 1 - (x / w) ** 2));
      return [cx + x, y, z];
    });
  face(o, 'brick', [[cx - w, Q.base, z], ...ps.slice(1, -1), [cx + w, Q.base, z]], [0, 0, -1]);
  face(
    o,
    'brick',
    [
      [cx + w, Q.base, z + Q.depth],
      ...ps
        .slice(1, -1)
        .reverse()
        .map((p) => [p[0], p[1], z + Q.depth]),
      [cx - w, Q.base, z + Q.depth],
    ],
    [0, 0, 1],
  );
  for (let i = 1; i < ps.length; i++) {
    face(
      o,
      'brick',
      [
        ps[i - 1],
        ps[i],
        [ps[i][0], ps[i][1], z + Q.depth],
        [ps[i - 1][0], ps[i - 1][1], z + Q.depth],
      ],
      [0, 1, 0],
    );
    if (lod >= 2)
      beam(
        o,
        'stone',
        ps[i - 1].map((x, k) => x + (k === 2 ? -0.06 : 0)),
        ps[i].map((x, k) => x + (k === 2 ? -0.06 : 0)),
        0.18,
        0.19,
        C.stone,
      );
  }
  if (lod >= 2)
    for (const x of [-2.5, -1.25, 0, 1.25, 2.5])
      box(
        o,
        'wood',
        [cx + x - 0.16, Q.base + 0.3, z - 0.04],
        [cx + x + 0.16, Q.base + 1.1, z + 0.01],
      );
  partEvidence.push({ id: 'central-curved-parapet' });
}
export function buildHouse(out, _f, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    roofEvidence,
    archEvidence,
    windowEvidence,
    stairEvidence,
    turretEvidence,
    postEvidence,
  ])
    a.length = 0;
  const o = {
    addTriangle: (k, r, ps, n, uv, col) =>
      out.addTriangle(k, r, ps.map(toWorld), rotate(n), uv, col),
    addQuad: (k, r, ps, n, uv, col) => out.addQuad(k, r, ps.map(toWorld), rotate(n), uv, col),
    addConvexPolygon: (k, r, ps, n, _uv, col) =>
      out.addConvexPolygon(k, r, ps.map(toWorld), rotate(n), (p) => [p[0], p[2]], col),
  };
  body(o, lod);
  arcade(o, lod);
  for (const K of P.portals) portal(o, K, lod);
  parapet(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/rk/rk8/queen_s_hotel_townsville',
  cam = (p) => toWorld(p),
  look = cam([0, 6, 11]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Queen’s Hotel, Townsville (circa1932)',
  cell: 'rk/rk8',
  wikidataId: 'Q24189521',
  category: 'hotel-commercial',
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
  camera: cam([105, 57, -125]),
  lookAt: look,
  portableGroundY: -1.8,
  mediumFiContext: {
    scale: 1,
    groundY: -1.8,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick',
    'stone_limestone_raw',
    'tile_flat',
    'metal_painted',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'whole-long-brick-hotel-veranda-twin-portals-and-four-cupolas',
      position: cam([105, 57, -125]),
      lookAt: look,
    },
    {
      name: 'whole-estimated-rear-service-ranges-two-open-courts-and-closed-roofs',
      position: cam([-100, 77, 125]),
      lookAt: cam([0, 6, 22]),
    },
    {
      name: 'pointed-ground-loggia-and-covered-upper-veranda',
      position: cam([-17, 6, -14]),
      lookAt: cam([-34, 4, 1]),
    },
    {
      name: 'projecting-entry-pointed-soffit-round-upper-arcade-turrets-and-mansard',
      position: cam([40, 16, -28]),
      lookAt: cam([24, 8, 1]),
    },
    {
      name: 'inside-real-covered-loggia-and-masonry-piers',
      position: cam([-35, 2, 2.3]),
      lookAt: cam([-25, 3, -3]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-hotel-${reviewLod}`,
    position: cam([105, 57, -125]),
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.9,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry/repository license. Exact cleared published Qualla1932 StateLibraryQueensland/JohnOxleyLibrary10462/deriv/139807 original/nativePD-Australia/StateLibQld expired archival release/SHA1 bound. Unrecorded photographer preserved, no attribution invention. Six Qualla families checked, earlier timber hotel/interior/context and modern attribution photos excluded. OSM ODbL native15control retained hotel context for estimated complete old physical hotel, not exact1932 survey/currentstudio. No questionable photos, copied signs/figures, photographic textures, generated bitmaps, Qualla rights/media repairs or waivers.',
};
