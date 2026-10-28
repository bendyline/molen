/** Complete1892drawing-led abbey, intrinsic church and two open courts. */
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
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.92, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.3 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0 },
};
const C = {
    wall: rgb('b9a17c'),
    trim: rgb('c7b18a'),
    roof: rgb('9e7252'),
    wood: rgb('514638'),
    iron: rgb('48483f'),
    glass: rgb('39433d'),
  },
  lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  pt = ([x, z], y) => [x, y, z];
export const toWorld = (p) => p;
export const partEvidence = [],
  roofEvidence = [],
  archEvidence = [],
  columnEvidence = [],
  windowEvidence = [],
  stairEvidence = [];
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
const outer = ring(P.outer),
  church = ring(P.church),
  service = ring(P.service),
  courts = P.courts.map(ring),
  cloister = ring(P.courts[0].filter((_, i) => i % 2 === 0));
function face(o, k, ps, n, col = C[k]) {
  const nn = n ?? normalFor(...ps);
  o.addConvexPolygon(k, ref, ps, nn, (p) => [p[0], p[1]], col);
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
    throw Error('Abbey cap failed');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const ps = Array.from(m.indices.slice(i, i + 3), (ix) =>
      Array.from(m.positions.slice(ix * 3, ix * 3 + 3)),
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
function edge(a, b, inward = false) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L],
    n = inward ? [-u[2], 0, u[0]] : [u[2], 0, -u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    at: (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d],
  };
}
function wall(o, k, a, b, y0, y1, inward = false) {
  const E = edge(a, b, inward);
  face(o, k, [E.at(0, y0), E.at(E.L, y0), E.at(E.L, y1), E.at(0, y1)], E.n);
  return E;
}
function panel(o, k, E, x0, x1, y0, y1, d = 0) {
  face(o, k, [E.at(x0, y0, d), E.at(x1, y0, d), E.at(x1, y1, d), E.at(x0, y1, d)], E.n);
}
function window(o, E, t, y, w, h, lod, arched = false) {
  const z = 0.035;
  if (arched) {
    const r = w / 2,
      s = y + h - r,
      segments = lod >= 3 ? 8 : lod >= 1 ? 4 : 2,
      curve = Array.from({ length: segments + 1 }, (_, i) =>
        E.at(
          t + r * Math.cos(Math.PI - (i * Math.PI) / segments),
          s + r * Math.sin(Math.PI - (i * Math.PI) / segments),
          z,
        ),
      );
    face(o, 'glass', [E.at(t - r, y, z), ...curve, E.at(t + r, y, z)], E.n);
    if (lod >= 3)
      for (let i = 1; i < curve.length; i++)
        beam(o, 'trim', curve[i - 1], curve[i], 0.18, 0.16, C.trim);
    windowEvidence.push({
      center: E.at(t, y + h * 0.45, z),
      normal: E.n,
      arched: true,
      width: w,
      height: h,
    });
  } else {
    panel(o, 'glass', E, t - w / 2, t + w / 2, y, y + h, z);
    windowEvidence.push({
      center: E.at(t, y + h / 2, z),
      normal: E.n,
      arched: false,
      width: w,
      height: h,
    });
  }
  if (lod < 3) {
    if (lod === 2) {
      panel(o, 'trim', E, t - w / 2 - 0.13, t - w / 2, y, y + h - (arched ? w / 2 : 0), z + 0.02);
      panel(o, 'trim', E, t + w / 2, t + w / 2 + 0.13, y, y + h - (arched ? w / 2 : 0), z + 0.02);
      panel(o, 'trim', E, t - w / 2 - 0.13, t + w / 2 + 0.13, y - 0.13, y, z + 0.02);
      if (!arched)
        panel(o, 'trim', E, t - w / 2 - 0.13, t + w / 2 + 0.13, y + h, y + h + 0.13, z + 0.02);
    }
    return;
  }
  if (lod >= 3) {
    for (const x of [t - w / 2 - 0.08, t + w / 2 + 0.08])
      beam(
        o,
        'trim',
        E.at(x, y, z + 0.03),
        E.at(x, y + h - (arched ? w / 2 : 0), z + 0.03),
        0.15,
        0.18,
        C.trim,
      );
    beam(
      o,
      'trim',
      E.at(t - w / 2 - 0.16, y - 0.08, z + 0.05),
      E.at(t + w / 2 + 0.16, y - 0.08, z + 0.05),
      0.18,
      0.23,
      C.trim,
    );
    if (!arched)
      beam(
        o,
        'trim',
        E.at(t - w / 2 - 0.16, y + h + 0.08, z + 0.05),
        E.at(t + w / 2 + 0.16, y + h + 0.08, z + 0.05),
        0.18,
        0.23,
        C.trim,
      );
  }
}
function shell(o, r, y0, y1, { windows = false, lod = 3, holes = [] } = {}) {
  for (let i = 0; i < r.length; i++) {
    const E = wall(o, 'wall', r[i], r[(i + 1) % r.length], y0, y1);
    if (windows && lod > 0 && E.L > 3) {
      const bays = Math.floor(E.L / P.monastery.windowPitch);
      for (let j = 0; j < bays; j++)
        for (const y of P.monastery.outerWindowBottoms)
          window(
            o,
            E,
            ((j + 0.5) * E.L) / bays,
            y,
            P.monastery.windowWidth,
            P.monastery.windowHeight,
            lod,
          );
    }
  }
  cap(o, 'trim', r, holes, y0, [0, -1, 0]);
  cap(o, 'roof', r, holes, y1, [0, 1, 0]);
}
function patch(o, a, b, c, d, y0, y1, lod, id) {
  const L = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(d[0] - c[0], d[1] - c[1])),
    width = Math.max(Math.hypot(c[0] - a[0], c[1] - a[1]), Math.hypot(d[0] - b[0], d[1] - b[1])),
    ns = lod >= 3 ? Math.max(1, Math.ceil(L / 1.2)) : lod >= 2 ? Math.max(1, Math.ceil(L / 3)) : 1,
    nt = lod >= 3 ? Math.max(1, Math.ceil(width / 1.4)) : 1,
    at = (s, t) => {
      const p = lerp(lerp(a, b, s), lerp(c, d, s), t);
      return [
        p[0],
        y0 +
          (y1 - y0) * t +
          (lod >= 3 ? P.roof.relief * Math.sin(s * ns * Math.PI) ** 2 * Math.sin(t * Math.PI) : 0),
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
      let n = normalFor(...ps);
      if (n[1] < 0) n = n.map((v) => -v);
      face(o, 'roof', ps, n);
    }
  const i = Math.floor(ns * 0.57),
    j = Math.floor(nt * 0.41),
    triangle = [at(i / ns, j / nt), at((i + 1) / ns, j / nt), at((i + 1) / ns, (j + 1) / nt)];
  roofEvidence.push({
    id,
    point: [0, 1, 2].map((axis) => triangle.reduce((sum, p) => sum + p[axis] / 3, 0)),
    normal: normalFor(...triangle).map((v, _i, a) => (a[1] < 0 ? -v : v)),
  });
}
function gable(o, a, b, c, d, eave, ridge, lod, id) {
  const ra = lerp(a, d, 0.5),
    rb = lerp(b, c, 0.5);
  patch(o, a, b, ra, rb, eave, ridge, lod, `${id}-outer-slope`);
  patch(o, d, c, ra, rb, eave, ridge, lod, `${id}-inner-slope`);
  for (const [ps, n] of [
    [[pt(a, eave), pt(d, eave), pt(ra, ridge)], normalFor(pt(a, eave), pt(d, eave), pt(ra, ridge))],
    [[pt(c, eave), pt(b, eave), pt(rb, ridge)], normalFor(pt(c, eave), pt(b, eave), pt(rb, ridge))],
  ])
    face(o, 'wall', ps, n);
}
function column(o, E, t, bottom, spring, lod, twisted, id) {
  const p = E.at(t, bottom + 0.25),
    top = spring - 0.28,
    n = E.n,
    u = E.u;
  if (lod === 0) {
    beam(o, 'trim', [p[0], bottom, p[2]], [p[0], spring, p[2]], 0.48, 0.48, C.trim);
  } else if (lod === 1) {
    for (const side of [-1, 1]) {
      const q = E.at(t, bottom + 0.12, (side * P.cloister.pairSpacing) / 2);
      beam(o, 'trim', q, [q[0], spring - 0.15, q[2]], 0.25, 0.25, C.trim);
    }
    box(o, 'trim', [p[0] - 0.36, spring - 0.15, p[2] - 0.36], [p[0] + 0.36, spring, p[2] + 0.36]);
  } else {
    for (const side of [-1, 1]) {
      const center = [
          p[0] + (n[0] * P.cloister.pairSpacing * side) / 2,
          p[2] + (n[2] * P.cloister.pairSpacing * side) / 2,
        ],
        sides = lod >= 3 ? 10 : 4,
        levels = twisted && lod >= 2 ? 9 : 1,
        rings = Array.from({ length: levels + 1 }, (_, j) => {
          const y = p[1] + ((top - p[1]) * j) / levels,
            turn = twisted ? (j / levels) * Math.PI : 0,
            off = twisted ? 0.11 : 0;
          return radialRing(y, P.cloister.shaftRadius, P.cloister.shaftRadius, sides, [
            center[0] + u[0] * Math.sin(turn) * off,
            center[1] + u[2] * Math.sin(turn) * off,
          ]);
        });
      loft(o, 'trim', rings, C.trim);
      box(
        o,
        'trim',
        [center[0] - 0.23, bottom, center[1] - 0.23],
        [center[0] + 0.23, bottom + 0.25, center[1] + 0.23],
      );
    }
    const center = [p[0], p[2]],
      r1 = radialRing(top, 0.24, 0.4, 4, center, Math.PI / 4),
      r2 = radialRing(spring - 0.08, 0.39, 0.49, 4, center, Math.PI / 4);
    loft(o, 'trim', [r1, r2], C.trim);
    box(o, 'trim', [p[0] - 0.41, spring - 0.08, p[2] - 0.41], [p[0] + 0.41, spring, p[2] + 0.41]);
  }
  columnEvidence.push({
    id,
    center: [p[0], (p[1] + top) / 2, p[2]],
    normal: E.n,
    paired: lod > 0,
    twisted: twisted && lod >= 2,
    bottom,
    spring,
  });
}
function archSpandrel(o, E, t0, t1, spring, top, lod, id) {
  const radius = (t1 - t0) / 2,
    mid = (t0 + t1) / 2,
    rise = Math.min(radius, 1.05),
    N = lod >= 3 ? 8 : lod >= 2 ? 4 : lod >= 1 ? 3 : 2,
    depth = P.cloister.archDepth,
    curve = Array.from({ length: N + 1 }, (_, j) => [
      mid + radius * Math.cos(Math.PI - (j * Math.PI) / N),
      spring + rise * Math.sin(Math.PI - (j * Math.PI) / N),
    ]);
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1],
      b = curve[i],
      front = [
        E.at(a[0], a[1], depth / 2),
        E.at(b[0], b[1], depth / 2),
        E.at(b[0], top, depth / 2),
        E.at(a[0], top, depth / 2),
      ],
      back = [
        E.at(a[0], a[1], -depth / 2),
        E.at(b[0], b[1], -depth / 2),
        E.at(b[0], top, -depth / 2),
        E.at(a[0], top, -depth / 2),
      ];
    face(o, 'wall', front, E.n);
    if (lod > 0) {
      face(
        o,
        'wall',
        back,
        E.n.map((v) => -v),
      );
      face(
        o,
        'trim',
        [front[0], back[0], back[1], front[1]],
        normalFor(front[0], back[0], back[1]),
      );
      if (lod >= 3) beam(o, 'trim', front[0], front[1], P.cloister.archBorder, 0.13, C.trim);
    }
  }
  archEvidence.push({
    id,
    opening: E.at(mid, spring - 0.6),
    normal: E.n,
    soffit: E.at(mid, spring + rise - 0.01),
    radius,
    rise,
    spring,
    top,
  });
}
function gallery(o, lod) {
  const back = cloister.map((p, i) => {
    const a = edge(cloister[(i + cloister.length - 1) % cloister.length], p, true).n,
      b = edge(p, cloister[(i + 1) % cloister.length], true).n,
      scale = -P.cloister.galleryDepth / (1 + a[0] * b[0] + a[2] * b[2]);
    return [p[0] + (a[0] + b[0]) * scale, p[1] + (a[2] + b[2]) * scale];
  });
  for (let i = 0; i < cloister.length; i++) {
    const a = cloister[i],
      b = cloister[(i + 1) % cloister.length],
      E = edge(a, b, true),
      count = lod === 0 ? 2 : lod === 1 ? 3 : P.cloister.lowerBays[i],
      pitch = E.L / count,
      backA = back[i],
      backB = back[(i + 1) % back.length];
    wall(o, 'wall', backA, backB, P.baseFloorY, P.cloister.top, true);
    for (let level = 0; level < 2; level++) {
      const bottom = P.cloister.levels[level],
        spring = level ? P.cloister.upperSpring : P.cloister.lowerSpring,
        top = level ? P.cloister.top : P.floorLevels[1] - 0.18;
      for (let j = 0; j < count; j++)
        archSpandrel(
          o,
          E,
          j * pitch,
          (j + 1) * pitch,
          spring,
          top,
          lod,
          `cloister-${i}-level-${level}-arch-${j}`,
        );
      for (let j = 0; j < count + (lod > 0 ? 1 : 0); j++)
        column(
          o,
          E,
          j * pitch,
          bottom,
          spring,
          lod,
          i === 1 && j === Math.floor(count / 2) && level === 0,
          `cloister-${i}-level-${level}-column-${j}`,
        );
    }
    if (lod > 0) {
      beam(
        o,
        'trim',
        E.at(0, P.baseFloorY + 0.12),
        E.at(E.L, P.baseFloorY + 0.12),
        0.24,
        0.65,
        C.trim,
      );
      beam(
        o,
        'trim',
        E.at(0, P.floorLevels[1] - 0.09, 0.12),
        E.at(E.L, P.floorLevels[1] - 0.09, 0.12),
        0.25,
        0.35,
        C.trim,
      );
    }
  }
}
function bellWall(o, a, b, lod, id) {
  const T = P.tower,
    E = edge(a, b),
    mid = E.L / 2,
    x0 = mid - T.bellRadius,
    x1 = mid + T.bellRadius,
    depth = 0.45,
    N = lod >= 3 ? 10 : lod >= 2 ? 5 : 3;
  for (const d of [0, -depth]) {
    const F = {
      ...E,
      at: (t, y, q = 0) => E.at(t, y, d + q),
      n: d === 0 ? E.n : E.n.map((v) => -v),
    };
    panel(o, 'wall', F, 0, x0, T.bellBottom, T.bellTop);
    panel(o, 'wall', F, x1, E.L, T.bellBottom, T.bellTop);
    panel(o, 'wall', F, x0, x1, T.bellBottom, T.bellOpeningBottom);
    for (let j = 0; j < N; j++) {
      const a = Math.PI - (j * Math.PI) / N,
        b = Math.PI - ((j + 1) * Math.PI) / N,
        xa = mid + T.bellRadius * Math.cos(a),
        xb = mid + T.bellRadius * Math.cos(b),
        ya = T.bellSpring + T.bellRadius * Math.sin(a),
        yb = T.bellSpring + T.bellRadius * Math.sin(b);
      face(o, 'wall', [F.at(xa, ya), F.at(xb, yb), F.at(xb, T.bellTop), F.at(xa, T.bellTop)], F.n);
      if (d === 0) {
        const ps = [E.at(xa, ya), E.at(xa, ya, -depth), E.at(xb, yb, -depth), E.at(xb, yb)];
        face(o, 'trim', ps, normalFor(...ps));
        if (lod >= 1) beam(o, 'trim', F.at(xa, ya, 0.07), F.at(xb, yb, 0.07), 0.2, 0.2, C.trim);
      }
    }
  }
  for (const x of [x0, x1]) {
    const ps = [
      E.at(x, T.bellOpeningBottom),
      E.at(x, T.bellSpring),
      E.at(x, T.bellSpring, -depth),
      E.at(x, T.bellOpeningBottom, -depth),
    ];
    const sign = x === x0 ? 1 : -1;
    face(
      o,
      'trim',
      ps,
      E.u.map((v) => v * sign),
    );
  }
  archEvidence.push({
    id,
    opening: E.at(mid, (T.bellOpeningBottom + T.bellSpring) / 2),
    normal: E.n,
    bell: true,
    spring: T.bellSpring,
    radius: T.bellRadius,
  });
  return E;
}
function tower(o, lod) {
  const T = P.tower,
    [x, z] = T.center,
    w = T.baseWidth / 2,
    b = T.bellWidth / 2;
  box(o, 'wall', [x - w, P.foundationBottomY, z - w], [x + w, T.shoulder, z + w]);
  for (const y of [12.2, T.shoulder, T.bellBottom, T.bellTop]) {
    const half = y < T.bellBottom ? w + 0.25 : b + 0.4;
    box(o, 'trim', [x - half, y - 0.25, z - half], [x + half, y + 0.05, z + half]);
  }
  box(o, 'wall', [x - b, T.shoulder, z - b], [x + b, T.bellBottom, z + b]);
  const r = [
    [x - b, z - b],
    [x + b, z - b],
    [x + b, z + b],
    [x - b, z + b],
  ];
  for (let i = 0; i < 4; i++) bellWall(o, r[i], r[(i + 1) % 4], lod, `abbey-bell-opening-${i}`);
  cap(o, 'trim', r, [], T.bellBottom, [0, 1, 0]);
  cap(o, 'trim', r, [], T.bellTop, [0, -1, 0]);
  if (lod >= 1)
    for (const dx of [-1, 1])
      for (const dz of [-1, 1]) {
        box(
          o,
          'trim',
          [x + dx * (w - 0.2) - 0.25, P.baseFloorY, z + dz * (w - 0.2) - 0.25],
          [x + dx * (w - 0.2) + 0.25, T.shoulder, z + dz * (w - 0.2) + 0.25],
        );
        box(
          o,
          'trim',
          [x + dx * (b - 0.2) - 0.24, T.bellBottom, z + dz * (b - 0.2) - 0.24],
          [x + dx * (b - 0.2) + 0.24, T.bellTop, z + dz * (b - 0.2) + 0.24],
        );
      }
  loft(
    o,
    'trim',
    T.capRings.map(([y, r]) => radialRing(y, r, r, lod >= 2 ? 12 : 8, [x, z], Math.PI / 8)),
    C.trim,
  );
  beam(o, 'iron', [x, 34.4, z], [x, T.tip, z], 0.09, 0.09, C.iron);
  beam(
    o,
    'iron',
    [x - T.crossWidth / 2, T.tip - 0.5, z],
    [x + T.crossWidth / 2, T.tip - 0.5, z],
    0.09,
    0.09,
    C.iron,
  );
  if (lod >= 1) {
    loft(
      o,
      'iron',
      [
        radialRing(24.1, 0.65, 0.65, 8, [x, z]),
        radialRing(24.6, 0.43, 0.43, 8, [x, z]),
        radialRing(25.3, 0.28, 0.28, 8, [x, z]),
      ],
      C.iron,
    );
    beam(o, 'wood', [x - b + 0.5, 25.5, z], [x + b - 0.5, 25.5, z], 0.3, 0.3, C.wood);
  }
  partEvidence.push({
    id: 'whole-baroque-abbey-tower-with-four-real-bell-openings',
    center: T.center,
    tip: T.tip,
    notSanPedro: true,
  });
}
export function buildHouse(o, _f, lod = 3) {
  for (const a of [
    partEvidence,
    roofEvidence,
    archEvidence,
    columnEvidence,
    windowEvidence,
    stairEvidence,
  ])
    a.length = 0;
  // Whole connected envelope, with both native courtyard voids kept open at every LOD.
  for (let i = 0; i < outer.length; i++) {
    const E = wall(
      o,
      'wall',
      outer[i],
      outer[(i + 1) % outer.length],
      P.foundationBottomY,
      P.monastery.eave,
    );
    if (lod > 0 && E.L > 3) {
      const count = Math.floor(E.L / P.monastery.windowPitch);
      for (let j = 0; j < count; j++)
        for (const y of P.monastery.outerWindowBottoms)
          window(
            o,
            E,
            ((j + 0.5) * E.L) / count,
            y,
            P.monastery.windowWidth,
            P.monastery.windowHeight,
            lod,
          );
    }
  }
  cap(o, 'trim', outer, courts, P.foundationBottomY, [0, -1, 0]);
  cap(o, 'trim', outer, courts, P.baseFloorY, [0, 1, 0]);
  if (lod > 0) cap(o, 'trim', outer, courts, P.floorLevels[1] - 0.18, [0, -1, 0]);
  cap(o, 'trim', outer, courts, P.floorLevels[1], [0, 1, 0]);
  if (lod > 0) cap(o, 'trim', outer, courts, P.monastery.eave - 0.18, [0, -1, 0]);
  cap(o, 'roof', outer, courts, P.monastery.eave, [0, 1, 0]);
  // Court surfaces are intrinsic floors, never a broad terrain pad.
  for (const r of courts) cap(o, 'trim', r, [], P.baseFloorY - 0.1, [0, 1, 0]);
  gallery(o, lod);
  const serviceCourt = courts[1];
  for (let i = 0; i < serviceCourt.length; i++) {
    const E = wall(
      o,
      'wall',
      serviceCourt[i],
      serviceCourt[(i + 1) % serviceCourt.length],
      P.baseFloorY,
      P.monastery.eave,
      true,
    );
    if (lod > 0 && E.L > 4) for (const y of [2, 6.8]) window(o, E, E.L / 2, y, 1.05, 1.8, lod);
  }
  shell(o, church, P.foundationBottomY, P.churchSections.eave, { lod });
  shell(o, service, P.foundationBottomY, P.monastery.eave, { windows: true, lod });
  const native = P.church,
    roofN = [native[6], native[7]],
    roofS = [native[4], native[0]];
  gable(
    o,
    roofN[0],
    roofN[1],
    roofS[1],
    roofS[0],
    P.churchSections.eave,
    P.churchSections.ridge,
    lod,
    'whole-monastic-church',
  );
  const coords = (x, z) => [x + (P.outer[0][0] - 40.61), z + (P.outer[0][1] + 16.13)],
    Q = (a) => coords(...a),
    roofs = [
      ['westwing', [-62.7, -44.08], [-79.74, 19.58], [-60.76, 2.04], [-53.02, -26.69]],
      ['northwestwing', [-62.7, -44.08], [-15.04, -31.94], [-28.99, -20.2], [-53.02, -26.69]],
      ['southwestwing', [-79.74, 19.58], [-28, 31.7], [-36.73, 8.53], [-60.76, 2.04]],
      ['southcentralwing', [-28, 31.7], [-10, 36], [-11.11, 9.02], [-36.73, 8.53]],
      ['southeastwing', [-10, 36], [20.36, 43.05], [12.99, 13.38], [-11.11, 9.02]],
      ['eastwing', [20.36, 43.05], [45.83, -15.83], [16.55, -6.31], [12.99, 13.38]],
      ['centralrange', [-28.99, -20.2], [-36.73, 8.53], [-11.11, 9.02], [-7.55, -10.66]],
      ['northcloisterrange', [-10.48, -15.56], [28.63, -10.6], [16.55, -6.31], [-7.55, -10.66]],
    ];
  for (const [id, a, b, c, d] of roofs)
    gable(o, Q(a), Q(b), Q(c), Q(d), P.monastery.eave, P.monastery.ridge, lod, id);
  gable(
    o,
    service[0],
    service[1],
    service[2],
    service[3],
    P.monastery.eave,
    P.monastery.ridge,
    lod,
    'connected-northwest-servicewing',
  );
  const E = edge(roofN[0], roofN[1]),
    churchWindows = lod === 0 ? 2 : 7;
  for (let i = 0; i < churchWindows; i++)
    window(
      o,
      E,
      ((i + 0.5) * E.L) / churchWindows,
      P.churchSections.windowBottom,
      P.churchSections.windowWidth,
      P.churchSections.windowHeight,
      lod,
      true,
    );
  if (lod > 0) {
    const S = edge(roofS[1], roofS[0]);
    for (let i = 0; i < 6; i++)
      window(o, S, ((i + 0.5) * S.L) / 6, P.churchSections.windowBottom, 2.1, 4.8, lod, true);
  }
  // Entry is projected onto the actual north church wall; fixed floor and stair sections remain unchanged.
  const t = Math.max(
    3,
    Math.min(
      E.L - 3,
      (P.entry.center[0] - E.a[0]) * E.u[0] + (P.entry.center[1] - E.a[1]) * E.u[2],
    ),
  );
  panel(
    o,
    'wood',
    E,
    t - P.entry.width / 2,
    t + P.entry.width / 2,
    P.baseFloorY,
    P.baseFloorY + P.entry.height,
    0.045,
  );
  if (lod >= 1) {
    beam(
      o,
      'trim',
      E.at(t - P.entry.width / 2 - 0.18, P.baseFloorY, 0.13),
      E.at(t - P.entry.width / 2 - 0.18, P.baseFloorY + P.entry.height + 0.2, 0.13),
      0.3,
      0.3,
      C.trim,
    );
    beam(
      o,
      'trim',
      E.at(t + P.entry.width / 2 + 0.18, P.baseFloorY, 0.13),
      E.at(t + P.entry.width / 2 + 0.18, P.baseFloorY + P.entry.height + 0.2, 0.13),
      0.3,
      0.3,
      C.trim,
    );
    beam(
      o,
      'trim',
      E.at(t - P.entry.width / 2 - 0.32, P.baseFloorY + P.entry.height + 0.2, 0.13),
      E.at(t + P.entry.width / 2 + 0.32, P.baseFloorY + P.entry.height + 0.2, 0.13),
      0.4,
      0.4,
      C.trim,
    );
    beam(o, 'iron', E.at(t + 0.2, 1.6, 0.15), E.at(t + 0.2, 1.9, 0.15), 0.06, 0.06, C.iron);
  }
  for (let j = 0; j < P.entry.steps; j++) {
    const y = (j + 1) * P.entry.rise,
      d0 = (P.entry.steps - j - 1) * P.entry.tread,
      d1 = (P.entry.steps - j) * P.entry.tread,
      points = [
        E.at(t - P.entry.width / 2 - 0.3, y, d0),
        E.at(t + P.entry.width / 2 + 0.3, y, d0),
        E.at(t + P.entry.width / 2 + 0.3, y, d1),
        E.at(t - P.entry.width / 2 - 0.3, y, d1),
      ];
    face(o, 'trim', points, [0, 1, 0]);
    face(
      o,
      'trim',
      [
        points[2],
        points[3],
        E.at(t - P.entry.width / 2 - 0.3, y - P.entry.rise, d1),
        E.at(t + P.entry.width / 2 + 0.3, y - P.entry.rise, d1),
      ],
      E.n,
    );
    stairEvidence.push({ point: E.at(t, y, (d0 + d1) / 2), index: j + 1 });
  }
  tower(o, lod);
  partEvidence.push(
    {
      id: 'whole-monastery-and-two-open-native-courts',
      outerControls: outer.length,
      courtControls: courts.map((r) => r.length),
    },
    {
      id: 'whole-intrinsic-monastic-church-and-closed-pitched-roof',
      controls: church.length,
      notSeparateSanPedro: true,
    },
    { id: 'connected-northwest-servicewing', controls: service.length },
    {
      id: 'complete-two-level-covered-Romanesque-cloister',
      arches: archEvidence.filter((e) => !e.bell).length,
      columns: columnEvidence.length,
    },
    { id: 'whole-native-exterior-rear-and-sides', floors: P.floorLevels },
  );
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/ez/ezm/abbey_of_santo_domingo_de_silos',
  clCenter = cloister.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Abbey of Santo Domingo de Silos (1892)',
  cell: 'ez/ezm',
  wikidataId: 'Q1340405',
  category: 'religious',
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
  camera: [145, 95, -145],
  lookAt: [0, 9, 0],
  portableGroundY: -2.4,
  mediumFiContext: {
    scale: 1,
    groundY: -2.4,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'stone_limestone_raw',
    'tile_flat',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-abbey-monastic-church-baroque-tower-and-two-courts',
      position: [145, 95, -145],
      lookAt: [0, 9, 0],
    },
    { name: 'whole-rear-all-wings-two-open-courts', position: [-145, 110, 145], lookAt: [0, 8, 0] },
    {
      name: 'baroque-abbey-bell-tower-openings-and-curved-cap',
      position: [35, 33, -75],
      lookAt: [8, 25, -31],
    },
    {
      name: 'two-level-open-romanesque-cloister',
      position: [clCenter[0], 11.5, clCenter[1]],
      lookAt: [cloister[0][0], 5.3, cloister[0][1]],
    },
    {
      name: 'inside-covered-lower-cloister-paired-and-twisted-shafts',
      position: [clCenter[0] + 11, 2.3, clCenter[1] + 4],
      lookAt: [clCenter[0], 2.8, clCenter[1] + 10],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-abbey-${reviewLod}`,
    position: [145, 95, -145],
    lookAt: [0, 9, 0],
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
    'Original authored geometry/repository license. Qualla-first14families/0conflicts; exact already-published signed1892MarianoPedrero1865–1927original, nativePD-Scan/PD-old-auto-expired/exactbytes bound without modifying Qualla images/media/rights. NamedRayet ownPD-self exact2007original for retainedmedieval lower-cloisterform only. OSM ODbL actualphysicalmonastery/intrinsicmonasticchurch/connectedservicewing/twocourts as bounded1892context. No questionable/attributiononly photos, inventedcopyright waivers, copiedsculpture/phototextures/generatedbitmaps, separateSanPedro or detachedannex.',
};
