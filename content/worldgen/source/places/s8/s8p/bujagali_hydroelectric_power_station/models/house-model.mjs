/** Full composite Bujagali dam, native crest, open-air five-unit powerhouse and both spillways. */
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
};
const colors = {
  concrete: rgb('b8b5a5'),
  rock: rgb('858075'),
  crown: rgb('8a8b80'),
  metal: rgb('95a5aa'),
  gate: rgb('4b6069'),
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
function tube(o, k, c, r, y0, y1, n) {
  polygon(
    o,
    k,
    Array.from({ length: n }, (_, i) => [
      c[0] + r * Math.cos((i * 2 * Math.PI) / n),
      c[1] + r * Math.sin((i * 2 * Math.PI) / n),
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
const route = (x0, x1) => [
  crestAt(x0),
  ...P.nativeCrest.filter((p) => p[0] > x0 + 1e-6 && p[0] < x1 - 1e-6),
  crestAt(x1),
];
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
function earth(o, section, lod) {
  let r = route(...section.x);
  if (lod > 1) {
    const step = lod === 2 ? 35 : 18,
      more = [];
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1],
        b = r[i],
        n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < n; j++) more.push(a.map((v, k) => v * (1 - j / n) + (b[k] * j) / n));
    }
    more.push(r.at(-1));
    r = more;
  }
  const ns = normals(r),
    half = P.rockfill.crownWidth / 2,
    foot = half + P.dam.nominalHeight * P.rockfill.sideSlope,
    ring = (p, n) =>
      [
        [-foot, P.floor],
        [-half, P.dam.crestY],
        [half, P.dam.crestY],
        [foot, P.floor],
      ].map(([w, y]) => [p[0] + n[0] * w, y, p[1] + n[1] * w]);
  const rings = r.map((p, i) => ring(p, ns[i]));
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1],
      b = rings[i];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      face(
        o,
        j === 1 ? 'crown' : 'rock',
        [a[j], b[j], b[k], a[k]],
        j === 3 ? [0, -1, 0] : [0, 1, 0],
      );
    }
  }
  face(o, 'rock', rings[0], [-(r[1][0] - r[0][0]), 0, -(r[1][1] - r[0][1])]);
  face(o, 'rock', rings.at(-1), [r.at(-1)[0] - r.at(-2)[0], 0, r.at(-1)[1] - r.at(-2)[1]]);
}
function clip(r, x, keep) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      A = (a[0] - x) * keep >= -1e-7,
      B = (b[0] - x) * keep >= -1e-7;
    if (A) out.push(a);
    if (A !== B) {
      const t = (x - a[0]) / (b[0] - a[0]);
      out.push([x, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
export const gravityRing = () =>
  clip(clip(P.nativeDamRing, P.dam.gravityX[0], 1), P.dam.gravityX[1], -1);
function powerhouse(o, lod) {
  const H = P.powerhouse,
    B = H.basis,
    outer = gravityRing(),
    inner = P.nativePowerhouseRing,
    floor = H.workingFloor;
  polygon(o, 'concrete', outer, P.floor, floor);
  cap(o, 'concrete', outer, P.dam.crestY, 1, [inner]);
  cap(o, 'concrete', outer, P.dam.crestY - 0.8, -1, [inner]);
  for (const [r, inward] of [
    [outer, false],
    [inner, true],
  ])
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        n = outward(r, a, b, inward);
      face(
        o,
        'concrete',
        [
          [a[0], floor, a[1]],
          [b[0], floor, b[1]],
          [b[0], P.dam.crestY, b[1]],
          [a[0], P.dam.crestY, a[1]],
        ],
        n,
      );
    }
  const place = (u, v) => [
      B.center[0] + B.U[0] * u + B.V[0] * v,
      B.center[1] + B.U[1] * u + B.V[1] * v,
    ],
    width = B.length * (1 - H.serviceFraction),
    bay = width / H.units,
    start = -B.length / 2 + B.length * H.serviceFraction;
  for (let i = 0; i < H.units; i++) {
    const u = start + (i + 0.5) * bay,
      c = place(u, 0);
    block(o, 'concrete', c, B.U, B.V, bay - 1.5, B.depth - 4, floor, floor + 1.1);
    tube(o, 'gate', c, H.coverRadius, floor + 1.1, H.coverTop, [6, 10, 16, 24][lod]);
    if (lod) {
      tube(
        o,
        'metal',
        c,
        H.coverRadius + 0.22,
        H.coverTop,
        H.coverTop + 0.24,
        [6, 10, 16, 24][lod],
      );
      for (const s of [-1, 1]) {
        const a = place(u - bay / 2, s * (B.depth / 2 - 2));
        beam(
          o,
          'concrete',
          [a[0], floor, a[1]],
          [a[0], P.dam.crestY, a[1]],
          1,
          1.1,
          colors.concrete,
        );
      }
    }
    const a = place(u - 5, B.depth / 2 - 0.05),
      b = place(u + 5, B.depth / 2 - 0.05);
    face(
      o,
      'gate',
      [
        [a[0], P.dam.crestY - 10, a[1]],
        [b[0], P.dam.crestY - 10, b[1]],
        [b[0], P.dam.crestY - 1, b[1]],
        [a[0], P.dam.crestY - 1, a[1]],
      ],
      [B.V[0], 0, B.V[1]],
    );
    if (lod > 1)
      for (let j = 0; j < 9; j++) {
        const q = place(u - 4 + j, B.depth / 2 + 0.02);
        beam(
          o,
          'metal',
          [q[0], P.dam.crestY - 10, q[1]],
          [q[0], P.dam.crestY - 1, q[1]],
          0.12,
          0.12,
          colors.metal,
        );
      }
  }
  const railY = P.dam.crestY + 0.25;
  for (const v of [-1, 1]) {
    const a = place(-B.length / 2, v * (B.depth / 2 - H.railInset)),
      b = place(B.length / 2, v * (B.depth / 2 - H.railInset));
    beam(
      o,
      'metal',
      [a[0], railY, a[1]],
      [b[0], railY, b[1]],
      lod ? 0.16 : 0.35,
      lod ? 0.18 : 0.35,
      colors.metal,
    );
  }
  const craneU = B.length * 0.1,
    top = railY + H.gantryHeight;
  for (const v of [-1, 1])
    for (const u of [-3, 3]) {
      const q = place(craneU + u, v * (B.depth / 2 - H.railInset));
      beam(
        o,
        'metal',
        [q[0], railY, q[1]],
        [q[0], top, q[1]],
        lod ? 0.35 : 0.6,
        lod ? 0.45 : 0.6,
        colors.metal,
      );
    }
  const a = place(craneU, -B.depth / 2 + H.railInset),
    b = place(craneU, B.depth / 2 - H.railInset);
  beam(o, 'metal', [a[0], top, a[1]], [b[0], top, b[1]], 1.5, 1.1, colors.metal);
  if (lod) {
    const c = place(craneU + 1, 0);
    block(o, 'gate', c, B.U, B.V, 2.1, 3, top - 2.4, top - 0.5);
    beam(o, 'metal', [c[0], top - 0.5, c[1]], [c[0], floor + 6, c[1]], 0.08, 0.1, colors.metal);
    for (const side of [-1, 1]) {
      const q = place(-B.length / 2 + 8, side * 6);
      block(o, 'gate', q, B.U, B.V, 1, 10, P.dam.crestY, P.dam.crestY + 9);
    }
  }
}
function spillway(o, lod) {
  const S = P.spillway,
    a = P.nativeWeir[0],
    b = P.nativeWeir[1],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    N = [-U[1], U[0]];
  if (N[1] > 0) {
    N[0] *= -1;
    N[1] *= -1;
  }
  const point = (u, v, y) => [a[0] + U[0] * u + N[0] * v, y, a[1] + U[1] * u + N[1] * v],
    bay = L / 3;
  for (let i = 0; i < 3; i++) {
    const u0 = i * bay + 2,
      u1 = (i + 1) * bay - 2,
      w = (u1 - u0) * 0.5,
      mid = (u0 + u1) / 2,
      head = P.dam.crestY - 2,
      tail = P.dam.crestY - S.downstreamDrop;
    face(
      o,
      'concrete',
      [
        point(u0, 0, head),
        point(u1, 0, head),
        point(u1, S.estimatedDownstreamLength, tail),
        point(u0, S.estimatedDownstreamLength, tail),
      ],
      [0, 1, 0],
    );
    face(
      o,
      'concrete',
      [
        point(u0, 0, P.floor),
        point(u0, S.estimatedDownstreamLength, P.floor),
        point(u1, S.estimatedDownstreamLength, P.floor),
        point(u1, 0, P.floor),
      ],
      [0, -1, 0],
    );
    for (const u of [u0, u1]) {
      face(
        o,
        'concrete',
        [
          point(u, 0, P.floor),
          point(u, 0, head + 1.5),
          point(u, S.estimatedDownstreamLength, tail + 1.5),
          point(u, S.estimatedDownstreamLength, P.floor),
        ],
        [u === u0 ? -U[0] : U[0], 0, u === u0 ? -U[1] : U[1]],
      );
    }
    const gw = Math.min(S.gateClearWidthEstimate, w * 2),
      n = i < 2 ? [2, 4, 7, 10][lod] : 1;
    for (let j = 0; j < n; j++) {
      const t = j / n,
        q = (j + 1) / n,
        y0 = head + S.gateHeightEstimate * t,
        y1 = head + S.gateHeightEstimate * q,
        off = (t) => (i < 2 ? 2 * Math.sin((t * Math.PI) / 2) : 0),
        ps = [
          point(mid - gw / 2, off(t), y0),
          point(mid + gw / 2, off(t), y0),
          point(mid + gw / 2, off(q), y1),
          point(mid - gw / 2, off(q), y1),
        ];
      face(o, 'gate', ps, [-N[0], 0, -N[1]]);
      face(o, 'gate', [...ps].reverse(), [N[0], 0, N[1]]);
    }
    // Estimated raised static gate pose; original chute floors and main sections remain fixed.
    for (const [lo, hi] of [
      [u0, mid - gw / 2],
      [mid + gw / 2, u1],
    ]) {
      const c = point((lo + hi) / 2, 0, 0);
      block(o, 'concrete', [c[0], c[2]], U, N, hi - lo, 4, P.floor, P.dam.crestY);
    }
    if (lod)
      for (const u of [mid - gw / 2, mid + gw / 2]) {
        const c = point(u, -1, head + S.gateHeightEstimate + 0.6);
        beam(o, 'metal', [c[0], head - S.gateHeightEstimate, c[2]], c, 0.18, 0.22, colors.metal);
      }
  }
  for (let i = 0; i <= 3; i++) {
    const c = point(i * bay, 2, 0);
    block(o, 'concrete', [c[0], c[2]], U, N, 3.5, 8, P.floor, P.dam.crestY + 1);
  } // Four estimated bridge piers support the original crest deck behind the gate headworks.
  for (let i = 0; i <= 3; i++) {
    const q = point(i * bay, 0, 0),
      r = crestAt(q[0]),
      c = [(q[0] + r[0]) / 2, (q[2] + r[1]) / 2],
      depth = Math.hypot(q[0] - r[0], q[2] - r[1]) + 4;
    block(o, 'concrete', c, U, N, 3.5, depth, P.floor, P.dam.crestY + 0.05);
  }
}
function emergency(o, lod) {
  const E = P.emergencySpillway,
    c = crestAt(E.x),
    i = P.nativeCrest.findIndex((p) => p[0] >= E.x),
    r = P.nativeCrest,
    U0 = r[Math.max(0, i - 1)],
    U1 = r[Math.min(r.length - 1, i + 1)],
    len = Math.hypot(U1[0] - U0[0], U1[1] - U0[1]),
    U = [(U1[0] - U0[0]) / len, (U1[1] - U0[1]) / len],
    N = [-U[1], U[0]];
  if (N[1] > 0) {
    N[0] *= -1;
    N[1] *= -1;
  }
  // Estimated siphon housing sits beside the original crest road; chutes pass underneath.
  c[0] -= N[0] * 12;
  c[1] -= N[1] * 12;
  const cell = E.estimatedHousingLength / E.estimatedCells;
  for (let j = 0; j < E.estimatedCells; j++) {
    const u = -E.estimatedHousingLength / 2 + (j + 0.5) * cell,
      cc = [c[0] + U[0] * u, c[1] + U[1] * u];
    block(o, 'concrete', cc, U, N, cell - 0.4, 12, E.baseY, E.topY);
    const p = (du, v, y) => [cc[0] + U[0] * du + N[0] * v, y, cc[1] + U[1] * du + N[1] * v];
    face(
      o,
      'gate',
      [
        p(-cell * 0.32, 6.02, E.baseY + 0.7),
        p(cell * 0.32, 6.02, E.baseY + 0.7),
        p(cell * 0.32, 6.02, E.topY - 0.7),
        p(-cell * 0.32, 6.02, E.topY - 0.7),
      ],
      [N[0], 0, N[1]],
    );
    face(
      o,
      'concrete',
      [
        p(-cell * 0.4, 6, E.baseY),
        p(cell * 0.4, 6, E.baseY),
        p(cell * 0.4, 76, P.dam.crestY - E.downstreamDrop),
        p(-cell * 0.4, 76, P.dam.crestY - E.downstreamDrop),
      ],
      [0, 1, 0],
    );
    for (const side of [-1, 1])
      face(
        o,
        'concrete',
        [
          p(side * cell * 0.4, 6, E.baseY),
          p(side * cell * 0.4, 76, P.dam.crestY - E.downstreamDrop),
          p(side * cell * 0.4, 76, P.dam.crestY - E.downstreamDrop + 1),
          p(side * cell * 0.4, 6, E.baseY + 1),
        ],
        [side * U[0], 0, side * U[1]],
      );
    if (lod) {
      const a = p(0, -6, E.topY + 0.2),
        b = p(0, 6, E.topY + 0.2);
      beam(o, 'metal', a, b, 0.15, 0.18, colors.metal);
    }
  }
}
function road(o, lod) {
  const r = P.nativeCrest,
    ns = normals(r),
    Y = P.dam.crestY + 0.12,
    w = P.dam.roadWidth / 2,
    point = (i, s, y) => [r[i][0] + ns[i][0] * s, y, r[i][1] + ns[i][1] * s];
  for (let i = 1; i < r.length; i++)
    for (const side of [-1, 1])
      face(
        o,
        'crown',
        [point(i - 1, 0, Y), point(i, 0, Y), point(i, w * side, Y), point(i - 1, w * side, Y)],
        [0, 1, 0],
      );
  // Continuous closed deck, including the native bridge sections; no unsupported single plane.
  for (let i = 1; i < r.length; i++) {
    face(
      o,
      'crown',
      [
        point(i - 1, -w, Y - 0.7),
        point(i, -w, Y - 0.7),
        point(i, w, Y - 0.7),
        point(i - 1, w, Y - 0.7),
      ],
      [0, -1, 0],
    );
    for (const side of [-1, 1])
      face(
        o,
        'concrete',
        [
          point(i - 1, side * w, Y - 0.7),
          point(i, side * w, Y - 0.7),
          point(i, side * w, Y),
          point(i - 1, side * w, Y),
        ],
        [ns[i][0] * side, 0, ns[i][1] * side],
      );
  }
  for (const i of [0, r.length - 1])
    face(
      o,
      'concrete',
      [point(i, -w, Y - 0.7), point(i, w, Y - 0.7), point(i, w, Y), point(i, -w, Y)],
      i === 0
        ? [r[0][0] - r[1][0], 0, r[0][1] - r[1][1]]
        : [r.at(-1)[0] - r.at(-2)[0], 0, r.at(-1)[1] - r.at(-2)[1]],
    );
  if (lod) {
    for (const s of [-1, 1]) {
      for (let i = 1; i < r.length; i++) {
        beam(
          o,
          'metal',
          point(i - 1, s * (w + 0.3), Y + 1.1),
          point(i, s * (w + 0.3), Y + 1.1),
          0.07,
          0.08,
          colors.metal,
        );
        const a = r[i - 1],
          b = r[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          n = Math.ceil(len / [1, 30, 16, 9][lod]);
        for (let j = 0; j < n; j++) {
          const t = j / n,
            p = point(i - 1, s * (w + 0.3), Y).map(
              (v, k) => v * (1 - t) + point(i, s * (w + 0.3), Y)[k] * t,
            );
          beam(o, 'metal', p, [p[0], Y + 1.1, p[2]], 0.07, 0.08, colors.metal);
        }
      }
    }
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  for (const section of P.rockfill.sections) earth(o, section, lod);
  componentEvidence.push('three-whole-thirty-metre-clay-core-rockfill-sections-on-original-crest');
  powerhouse(o, lod);
  componentEvidence.push(
    'whole-concrete-gravity-body-and-original-plan-open-air-five-unit-powerhouse-intake',
  );
  componentEvidence.push(
    'five-open-unit-bays-external-covers-two-stored-wheel-gates-and-supported-gantry',
  );
  spillway(o, lod);
  componentEvidence.push('whole-original-main-weir-spillway-two-radial-and-one-flap-gate');
  emergency(o, lod);
  componentEvidence.push('whole-estimated-emergency-siphon-spillway-and-connected-chutes');
  road(o, lod);
  componentEvidence.push(
    'complete-eight-hundred-ninety-nine-metre-native-crest-route-and-intrinsic-safety-rails',
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/s8/s8p/bujagali_hydroelectric_power_station',
  camera = [710, 500, 790],
  look = [0, 0, 0],
  B = P.powerhouse.basis,
  pc = B.center,
  sy = crestAt((P.spillway.x[0] + P.spillway.x[1]) / 2),
  ec = crestAt(P.emergencySpillway.x);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Bujagali Dam and Powerhouse — Victoria Nile',
  wikidataId: 'Q4986717',
  cell: 's8/s8p',
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
    far: 10000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'stone_basalt_raw', 'metal_painted'],
  qaCameras: [
    { name: 'whole-composite-dam-and-full-native-crest', position: camera, lookAt: look },
    {
      name: 'complete-open-air-five-unit-powerhouse-intake-and-crane',
      position: [pc[0] + 60, 135, pc[1] + 145],
      lookAt: [pc[0], -4, pc[1]],
    },
    {
      name: 'whole-main-three-gate-spillway-and-chutes',
      position: [sy[0] + 100, 75, sy[1] - 135],
      lookAt: [sy[0], -2, sy[1]],
    },
    {
      name: 'emergency-siphon-and-eastern-rockfill-sections',
      position: [ec[0] + 145, 95, ec[1] - 155],
      lookAt: [ec[0], -2, ec[1]],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-bujagali-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    ...P.limitations,
    'Gates use an estimated raised static equipment pose so the full panel/hoist forms are readable; no operating state or hydrological flow is certified. Original upstream and downstream chute floor heights and all frozen dam/foundation/crest/powerhouse parameters remain unchanged. Closed crest deck and local support piers are structural details. Emergency outlet alignment is estimated, including a buried conduit segment through the embankment.',
  ],
  sourceLicense:
    'Original procedural whole composite dam/open-air powerhouse/spillways under repository license. Exact native full crest/dam/plant/weir data under ODbL; primary construction text facts only. No source photo/plan/figure pixels, borrowed meshes or textures used; Qualla searched first, all imagery unused/unrepaired. Functional partitions/edge roles/vertical sections/grade/finish are explicit estimates. Original provider field and severe distant DEM artifact preserved. No photographic/survey or current-world replacement certification.',
};
