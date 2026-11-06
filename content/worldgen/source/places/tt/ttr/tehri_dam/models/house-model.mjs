/** Complete Tehri Stage-I dam, five spillways and intrinsic intake/portal exteriors. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  rock: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.98, metallic: 0 },
  crown: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.25 },
  gate: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.3 },
  window: { slot: 'window', graph: 'window_punched', roughness: 0.4, metallic: 0.1 },
};
const colors = {
  concrete: rgb('b8b5a5'),
  rock: rgb('999477'),
  crown: rgb('8a8b80'),
  metal: rgb('95a5aa'),
  gate: rgb('4b6069'),
  window: rgb('354f55'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let a = normalFor(...p);
  if (n && a.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    a = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, a, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up, holes = []) {
  const temp = new MeshBufferBuilder();
  if (
    !temp.addCap(
      k,
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid full dam/plant cap');
  const m = temp.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3)).map((j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    face(o, k, p, [0, up, 0]);
  }
}

function outward(r, a, b, inward = false) {
  const area = r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
    sign = Math.sign(area) * (inward ? -1 : 1);
  return [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign];
}
function polygon(o, k, r, y0, y1) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      outward(r, a, b),
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
function block(o, k, c, U, V, w, d, y0, y1) {
  polygon(
    o,
    k,
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => [
      c[0] + (U[0] * u * w) / 2 + (V[0] * v * d) / 2,
      c[1] + (U[1] * u * w) / 2 + (V[1] * v * d) / 2,
    ]),
    y0,
    y1,
  );
}
export function crestAt(x) {
  const r = P.nativeCrest;
  for (let i = 1; i < r.length; i++)
    if (x >= r[i - 1][0] - 1e-7 && x <= r[i][0] + 1e-7) {
      const t = (x - r[i - 1][0]) / (r[i][0] - r[i - 1][0]);
      return [x, r[i - 1][1] * (1 - t) + r[i][1] * t];
    }
  return x < r[0][0] ? [...r[0]] : [...r.at(-1)];
}
function normals(r) {
  return r.map((_, i) => {
    const a = r[Math.max(0, i - 1)],
      b = r[Math.min(r.length - 1, i + 1)],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    return [-dz / l, dx / l];
  });
}
function earth(o, lod) {
  let r = P.nativeCrest;
  if (lod > 1) {
    const more = [],
      step = lod === 2 ? 35 : 18;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1],
        b = r[i],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
      for (let j = 0; j < n; j++) more.push(a.map((v, k) => v * (1 - j / n) + (b[k] * j) / n));
    }
    more.push(r.at(-1));
    r = more;
  }
  const ns = normals(r),
    half = P.dam.crownWidth / 2,
    up = half + P.dam.earthHeight * P.dam.upstreamSlope,
    down = half + P.dam.earthHeight * P.dam.downstreamSlope,
    profile = [
      [-up, P.floor],
      [-up, P.dam.earthBaseY],
      [-half, P.dam.crestY],
      [half, P.dam.crestY],
      [down, P.dam.earthBaseY],
      [down, P.floor],
    ],
    rings = r.map((p, i) => profile.map(([w, y]) => [p[0] + ns[i][0] * w, y, p[1] + ns[i][1] * w]));
  for (let i = 1; i < r.length; i++)
    for (let j = 0; j < 6; j++) {
      const k = (j + 1) % 6,
        n = ns[i],
        want =
          j === 0
            ? [-n[0], 0, -n[1]]
            : j === 1
              ? [-n[0], 1, -n[1]]
              : j === 2
                ? [0, 1, 0]
                : j === 3
                  ? [n[0], 1, n[1]]
                  : j === 4
                    ? [n[0], 0, n[1]]
                    : [0, -1, 0];
      face(
        o,
        j === 2 ? 'crown' : 'rock',
        [rings[i - 1][j], rings[i][j], rings[i][k], rings[i - 1][k]],
        want,
      );
    }
  face(o, 'rock', rings[0], [-(r[1][0] - r[0][0]), 0, -(r[1][1] - r[0][1])]);
  face(o, 'rock', rings.at(-1), [r.at(-1)[0] - r.at(-2)[0], 0, r.at(-1)[1] - r.at(-2)[1]]);
}
function crestRoad(o, lod) {
  const r = P.nativeCrest,
    ns = normals(r),
    y = P.dam.crestY + 0.015,
    w = P.dam.roadWidth / 2,
    p = (i, s, h) => [r[i][0] + ns[i][0] * s, h, r[i][1] + ns[i][1] * s];
  for (let i = 1; i < r.length; i++)
    face(
      o,
      'crown',
      [p(i - 1, -w, y), p(i, -w, y), p(i, w, y), p(i - 1, w, y)],
      [0, 1, 0],
      rgb('787d76'),
    );
  if (lod)
    for (const side of [-1, 1])
      for (let i = 1; i < r.length; i++) {
        const a = p(i - 1, side * (w + 0.35), y + 1.1),
          b = p(i, side * (w + 0.35), y + 1.1);
        beam(o, 'metal', a, b, 0.07, 0.08, colors.metal);
        const count = Math.ceil(
          Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]) / [1, 48, 18, 9][lod],
        );
        for (let j = 0; j < count; j++) {
          const t = j / count,
            q = a.map((v, k) => v * (1 - t) + b[k] * t);
          beam(o, 'metal', [q[0], y, q[2]], q, 0.07, 0.07, colors.metal);
        }
      }
}
const spoint = (u, v, y) => {
  const B = P.chute.basis;
  return [B.center[0] + B.U[0] * u + B.V[0] * v, y, B.center[1] + B.U[1] * u + B.V[1] * v];
};
function spillway(o, lod) {
  const S = P.chute,
    B = S.basis,
    bay = B.length / S.gates;
  block(o, 'concrete', B.center, B.U, B.V, B.length + 3, 15, S.sillY - 4, S.sillY - 0.3);
  // Every gate and supporting pier survives every authored level.
  for (let i = 0; i <= S.gates; i++) {
    const u = -B.length / 2 + i * bay,
      c = spoint(u, 0, 0);
    block(
      o,
      'concrete',
      [c[0], c[2]],
      B.U,
      B.V,
      bay - S.clearGateWidth,
      15,
      S.sillY - 0.3,
      S.pierTopY,
    );
  }
  block(o, 'crown', B.center, B.U, B.V, B.length + 3, 6, S.pierTopY, S.bridgeY);
  for (let i = 0; i < S.gates; i++) {
    const u = -B.length / 2 + (i + 0.5) * bay,
      w = S.clearGateWidth / 2,
      top = S.sillY + S.gateHeight;
    if (lod === 0) {
      const c = spoint(u, -2.5, 0);
      block(o, 'gate', [c[0], c[2]], B.U, B.V, S.clearGateWidth, 1.2, S.sillY, top);
    } else {
      const count = [1, 4, 8, 14][lod],
        radius = S.gateHeight / Math.sin(0.9),
        q = (side, t, thick) =>
          spoint(
            u + side * w,
            -radius * (1 - Math.cos(t * 0.9)) + thick,
            top - radius * Math.sin(t * 0.9),
          );
      for (let j = 1; j <= count; j++) {
        const a = (j - 1) / count,
          b = j / count;
        for (const thick of [0, 0.35])
          face(
            o,
            'gate',
            [q(-1, a, thick), q(1, a, thick), q(1, b, thick), q(-1, b, thick)],
            [B.V[0] * (thick === 0 ? -1 : 1), 0, B.V[1] * (thick === 0 ? -1 : 1)],
          );
        for (const side of [-1, 1])
          face(
            o,
            'gate',
            [q(side, a, 0), q(side, b, 0), q(side, b, 0.35), q(side, a, 0.35)],
            [side * B.U[0], 0, side * B.U[1]],
          );
      }
      for (const t of [0, 1])
        face(
          o,
          'gate',
          [q(-1, t, 0), q(1, t, 0), q(1, t, 0.35), q(-1, t, 0.35)],
          [0, t === 0 ? 1 : -1, 0],
        );
      for (const side of [-1, 1]) {
        const p = spoint(u + side * (bay / 2 - 0.5), 0, S.bridgeY);
        beam(o, 'metal', p, [p[0], S.hoistY - 1, p[2]], 0.22, 0.28, colors.metal);
      }
      beam(
        o,
        'metal',
        spoint(u - bay / 2 + 0.5, 0, S.hoistY - 1),
        spoint(u + bay / 2 - 0.5, 0, S.hoistY - 1),
        0.26,
        0.35,
        colors.metal,
      );
      const c = spoint(u, 0, 0);
      block(o, 'metal', [c[0], c[2]], B.U, B.V, 1.9, 1.4, S.hoistY - 1.4, S.hoistY);
      if (lod > 1) {
        for (const side of [-1, 1])
          beam(
            o,
            'metal',
            spoint(u + side * (w - 0.5), -3, top - 4),
            spoint(u + side * (w - 0.5), 4, S.sillY + 5),
            0.16,
            0.2,
            colors.metal,
          );
        for (const t of [0.25, 0.5, 0.75])
          beam(o, 'metal', q(-1, t, 0.38), q(1, t, 0.38), 0.12, 0.15, colors.metal);
      }
    }
  }
  const width = B.length + 3,
    v0 = 7.5,
    v1 = S.chuteLength;
  for (const down of [0, 1])
    face(
      o,
      'concrete',
      [
        spoint(-width / 2, v0, S.sillY - 0.3 - down),
        spoint(width / 2, v0, S.sillY - 0.3 - down),
        spoint(width / 2, v1, S.chuteEndY - down),
        spoint(-width / 2, v1, S.chuteEndY - down),
      ],
      [0, down ? -1 : 1, 0],
    );
  for (const side of [-1, 1]) {
    const u = (side * width) / 2;
    face(
      o,
      'concrete',
      [
        spoint(u, v0, S.sillY - 0.3),
        spoint(u, v1, S.chuteEndY),
        spoint(u, v1, S.chuteEndY + 2.4),
        spoint(u, v0, S.sillY + 2.1),
      ],
      [side * B.U[0], 0, side * B.U[1]],
    );
    face(
      o,
      'concrete',
      [
        spoint(u - side * 0.8, v0, S.sillY + 2.1),
        spoint(u - side * 0.8, v1, S.chuteEndY + 2.4),
        spoint(u, v1, S.chuteEndY + 2.4),
        spoint(u, v0, S.sillY + 2.1),
      ],
      [0, 1, 0],
    );
    face(
      o,
      'concrete',
      [
        spoint(u - side * 0.8, v0, S.sillY - 0.3),
        spoint(u - side * 0.8, v1, S.chuteEndY),
        spoint(u - side * 0.8, v1, S.chuteEndY + 2.4),
        spoint(u - side * 0.8, v0, S.sillY + 2.1),
      ],
      [-side * B.U[0], 0, -side * B.U[1]],
    );
  }
  const end = spoint(0, v1 + 8, 0);
  block(o, 'concrete', [end[0], end[2]], B.U, B.V, width, 16, S.chuteEndY - 1, S.chuteEndY);
  if (lod) {
    for (const side of [-1, 1])
      beam(
        o,
        'metal',
        spoint(-B.length / 2, side * 2.6, S.bridgeY + 1.05),
        spoint(B.length / 2, side * 2.6, S.bridgeY + 1.05),
        0.06,
        0.07,
        colors.metal,
      );
    for (let i = 0; i <= S.gates; i++)
      for (const side of [-1, 1])
        beam(
          o,
          'metal',
          spoint(-B.length / 2 + i * bay, side * 2.6, S.bridgeY),
          spoint(-B.length / 2 + i * bay, side * 2.6, S.bridgeY + 1.05),
          0.06,
          0.07,
          colors.metal,
        );
  }
}
function shaft(o, S, lod) {
  const n = [6, 10, 16, 24][lod],
    R = S.estimatedLipDiameter / 2,
    c = S.center,
    y = S.crestY,
    outer = [
      [R + 0.8, y + 0.5],
      [R + 0.8, y - 8],
      [7, y - 20],
      [7, y - 32],
    ],
    inner = [
      [R, y],
      [10, y - 5],
      [6, y - 14],
      [6, y - 32],
    ],
    point = (p, i) => [
      c[0] + p[0] * Math.cos((i * 2 * Math.PI) / n),
      p[1],
      c[1] + p[0] * Math.sin((i * 2 * Math.PI) / n),
    ];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      t = ((i + 0.5) * 2 * Math.PI) / n,
      N = [Math.cos(t), 0, Math.sin(t)];
    for (let k = 1; k < outer.length; k++)
      face(
        o,
        'concrete',
        [point(outer[k - 1], i), point(outer[k - 1], j), point(outer[k], j), point(outer[k], i)],
        N,
      );
    for (let k = 1; k < inner.length; k++)
      face(
        o,
        'concrete',
        [point(inner[k - 1], i), point(inner[k - 1], j), point(inner[k], j), point(inner[k], i)],
        [-N[0], 1, -N[2]],
      );
    face(
      o,
      'concrete',
      [point(outer[0], i), point(outer[0], j), point(inner[0], j), point(inner[0], i)],
      [0, 1, 0],
    );
    face(
      o,
      'concrete',
      [
        point(outer.at(-1), i),
        point(outer.at(-1), j),
        point(inner.at(-1), j),
        point(inner.at(-1), i),
      ],
      [0, -1, 0],
    );
  }
  if (S.gated) {
    for (const side of [-1, 1])
      block(o, 'concrete', [c[0] + side * 8, c[1]], [1, 0], [0, 1], 2.5, 6, y - 2, y + 18);
    block(o, 'crown', c, [1, 0], [0, 1], 20, 6, y + 18, y + 19);
    block(o, 'gate', [c[0], c[1] - 3], [1, 0], [0, 1], 12, 1, y + 1, y + 16);
    if (lod) {
      block(o, 'metal', c, [1, 0], [0, 1], 3, 2, y + 19, y + 20.5);
      for (const side of [-1, 1])
        beam(
          o,
          'metal',
          [c[0] - 9, y + 20, c[1] + side * 2.6],
          [c[0] + 9, y + 20, c[1] + side * 2.6],
          0.08,
          0.1,
          colors.metal,
        );
    }
  } else if (lod) {
    for (let i = 0; i < n; i++) {
      const t = (i * 2 * Math.PI) / n,
        a = [c[0] + (R + 1.1) * Math.cos(t), y + 0.5, c[1] + (R + 1.1) * Math.sin(t)],
        b = [a[0], y + 1.6, a[2]],
        T = ((i + 1) * 2 * Math.PI) / n;
      beam(o, 'metal', a, b, 0.07, 0.07, colors.metal);
      beam(
        o,
        'metal',
        b,
        [c[0] + (R + 1.1) * Math.cos(T), y + 1.6, c[1] + (R + 1.1) * Math.sin(T)],
        0.07,
        0.08,
        colors.metal,
      );
    }
  }
}
export const portalPoint = (S, u, v, y) => [S.center[0] + u, y, S.center[1] + v];
function portal(o, S, lod) {
  const w = S.diameter / 2,
    z = S.depth / 2,
    W = S.width / 2,
    y = S.floor,
    spring = y + w,
    top = y + S.wallHeight,
    n = [4, 7, 12, 18][lod],
    p = (u, v, Y) => portalPoint(S, u, v, Y);
  for (const side of [-1, 1]) {
    const v = side * z,
      N = [0, 0, side];
    for (const s of [-1, 1])
      face(o, 'concrete', [p(s * w, v, y), p(s * W, v, y), p(s * W, v, top), p(s * w, v, top)], N);
    for (let i = 1; i <= n; i++) {
      const a = ((i - 1) * Math.PI) / n,
        b = (i * Math.PI) / n,
        xa = -w * Math.cos(a),
        xb = -w * Math.cos(b),
        ya = spring + w * Math.sin(a),
        yb = spring + w * Math.sin(b);
      face(o, 'concrete', [p(xa, v, ya), p(xb, v, yb), p(xb, v, top), p(xa, v, top)], N);
    }
  }
  for (const side of [-1, 1]) {
    face(
      o,
      'concrete',
      [p(side * W, -z, y), p(side * W, z, y), p(side * W, z, top), p(side * W, -z, top)],
      [side, 0, 0],
    );
    face(
      o,
      'concrete',
      [p(side * w, -z, y), p(side * w, z, y), p(side * w, z, spring), p(side * w, -z, spring)],
      [-side, 0, 0],
    );
  }
  face(o, 'crown', [p(-W, -z, top), p(W, -z, top), p(W, z, top), p(-W, z, top)], [0, 1, 0]);
  face(o, 'concrete', [p(-W, -z, y), p(W, -z, y), p(W, z, y), p(-W, z, y)], [0, 1, 0]);
  for (let i = 1; i <= n; i++) {
    const a = ((i - 1) * Math.PI) / n,
      b = (i * Math.PI) / n,
      A = [-w * Math.cos(a), spring + w * Math.sin(a)],
      B = [-w * Math.cos(b), spring + w * Math.sin(b)],
      t = (a + b) / 2;
    face(
      o,
      'concrete',
      [p(A[0], -z, A[1]), p(B[0], -z, B[1]), p(B[0], z, B[1]), p(A[0], z, A[1])],
      [Math.cos(t), -Math.sin(t), 0],
    );
  }
  if (lod > 1)
    for (const side of [-1, 1])
      beam(
        o,
        'metal',
        p(side * (w + 0.2), z + 0.08, y),
        p(side * (w + 0.2), z + 0.08, spring),
        0.12,
        0.14,
        colors.metal,
      );
}
function intakes(o, lod) {
  for (const S of P.intakes) {
    portal(
      o,
      { ...S, diameter: P.powerhouse.headRaceDiameter, wallHeight: S.platformY - S.floor },
      lod,
    );
    block(
      o,
      'crown',
      S.center,
      [1, 0],
      [0, 1],
      S.width + 2,
      S.depth + 2,
      S.platformY,
      S.platformY + 0.8,
    );
    block(
      o,
      'concrete',
      S.center,
      [1, 0],
      [0, 1],
      S.width * 0.68,
      S.depth * 0.72,
      S.platformY + 0.8,
      S.platformY + S.houseHeight,
    );
    block(
      o,
      'crown',
      S.center,
      [1, 0],
      [0, 1],
      S.width * 0.68 + 0.4,
      S.depth * 0.72 + 0.4,
      S.platformY + S.houseHeight,
      S.platformY + S.houseHeight + 0.35,
    );
    for (const side of [-1, 1]) {
      const z = S.center[1] + side * (S.depth * 0.36 + 0.015),
        low = S.platformY + S.houseHeight - 3.8,
        high = S.platformY + S.houseHeight - 1.2;
      face(
        o,
        'window',
        [
          [S.center[0] - 6, low, z],
          [S.center[0] + 6, low, z],
          [S.center[0] + 6, high, z],
          [S.center[0] - 6, high, z],
        ],
        [0, 0, side],
      );
      if (lod)
        for (const x of [-6, -2, 2, 6])
          beam(
            o,
            'metal',
            [S.center[0] + x, low, z],
            [S.center[0] + x, high, z],
            0.09,
            0.12,
            colors.metal,
          );
    }
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  earth(o, lod);
  componentEvidence.push('whole-260point5m-earthrockfill-dam-both-slopes-and-buried-foundation');
  crestRoad(o, lod);
  componentEvidence.push('complete-original-four-control-crest-road');
  spillway(o, lod);
  componentEvidence.push('whole-rightbank-three-bay-chute-all-radial-gates-and-entire-apron');
  for (const S of P.shafts) shaft(o, S, lod);
  componentEvidence.push(
    'both-rightbank-free-overflow-and-both-leftbank-gated-twelve-metre-shaft-spillways',
  );
  intakes(o, lod);
  componentEvidence.push(
    'both-entire-leftbank-main-HPP-intake-shafts-platforms-and-control-houses',
  );
  for (const S of P.tailracePortals) portal(o, S, lod);
  portal(
    o,
    {
      center: [360, 420],
      diameter: 7,
      floor: P.tailracePortals[0].floor + 4,
      width: 14,
      depth: 8,
      wallHeight: 10,
    },
    lod,
  );
  componentEvidence.push(
    'both-whole-nine-metre-tailrace-mouths-and-intrinsic-leftbank-access-portal',
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/tt/ttr/tehri_dam',
  camera = [1100, 860, 1390],
  look = [0, P.dam.crestY - 100, 50];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Tehri Dam — Bhagirathi Stage-I',
  wikidataId: 'Q69091',
  cell: 'tt/ttr',
  category: 'dam',
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
  portableGroundY: P.floor - 0.02,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 14000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'stone_basalt_raw',
    'metal_painted',
    'window_punched',
  ],
  qaCameras: [
    {
      name: 'whole-dam-both-rockfill-slopes-and-all-five-spillways',
      position: camera,
      lookAt: look,
    },
    {
      name: 'complete-three-bay-rightbank-chute-and-two-ungated-shafts',
      position: [-650, P.dam.crestY + 270, 490],
      lookAt: [-345, P.dam.crestY - 70, 80],
    },
    {
      name: 'both-leftbank-gated-shafts-and-both-intake-headworks',
      position: [610, P.dam.crestY + 190, -455],
      lookAt: [375, P.dam.crestY - 15, -185],
    },
    {
      name: 'full-leftbank-tailrace-and-access-portals',
      position: [455, P.tailracePortals[0].floor + 70, 610],
      lookAt: [365, P.tailracePortals[0].floor + 4, 450],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-tehri-${reviewLod}`,
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
      district: { export: 'houseDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.16, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'OriginalproceduralwholeStage-Iearthrockfilldam/five-spillways/mainHPPintake-portalexteriors underrepositorylicense. OriginalnativewholeQ69091damcoordinatesODbL, primaryoperatorwrittenconstructionfacts only. Allphotos/figures/drawingsunused, no borrowedmesh/textures, Quallafirst38families allunused/questionablesourcesskipped. Exactcomponentplans/profiles/sections/finish/grade explicitlyestimated, originalfieldpreserved. Undergroundpowerhouse notinventedabovegroundhall; no newPSP/Koteshwar/campusproxy, survey/photo/currentreplacementclaim.',
};
