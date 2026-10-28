/** Complete1877publication-depicted shrine; independent original field and sections are immutable. */
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
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.92, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.3 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0 },
};
const C = {
    wall: rgb('ddd6bf'),
    brick: rgb('98755b'),
    trim: rgb('e3d9bb'),
    roof: rgb(P.roof.green),
    green: rgb(P.roof.green),
    yellow: rgb(P.roof.yellow),
    iron: rgb('48483f'),
    glass: rgb('39433d'),
  },
  lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  pt = ([x, z], y) => [x, y, z];
export const toWorld = (p) => p;
export const partEvidence = [],
  roofEvidence = [],
  archEvidence = [],
  pierEvidence = [],
  domeEvidence = [],
  crossEvidence = [],
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
    if (activeLod > 0 || n[1] >= 0) face(o, k, ps, n, col);
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
      face(o, 'roof', ps, n, i % 4 < 2 ? C.green : C.yellow);
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
let activeLod = 3;
const church = ring(P.church.outer),
  cloister = ring(P.cloister.outer),
  courtRings = P.cloister.courts.map((c) =>
    ring([
      [c.x0, c.z0],
      [c.x1, c.z0],
      [c.x1, c.z1],
      [c.x0, c.z1],
    ]),
  );
function poly(o, k, r, y0, y1, { holes = [] } = {}) {
  const q = ring(r);
  for (let i = 0; i < q.length; i++) wall(o, k, q[i], q[(i + 1) % q.length], y0, y1);
  for (const hole of holes) {
    const h = ring(hole);
    for (let i = 0; i < h.length; i++) wall(o, k, h[i], h[(i + 1) % h.length], y0, y1, true);
  }
  if (activeLod > 0) cap(o, k, q, holes, y0, [0, -1, 0]);
  cap(o, k, q, holes, y1, [0, 1, 0]);
}
function cylinder(o, k, center, r, y0, y1, lod, col = C[k]) {
  if (y1 - y0 < 0.00001) return;
  const n = lod >= 3 ? 24 : lod >= 2 ? 16 : lod >= 1 ? 10 : 6;
  loft(o, k, [radialRing(y0, r, r, n, center), radialRing(y1, r, r, n, center)], col);
}
function pinnacle(o, x, z, base, top, lod) {
  const w = 0.6;
  if (lod === 0) {
    const p = [
      [x - w, base, z - w],
      [x + w, base, z - w],
      [x, base, z + w],
    ];
    for (let i = 0; i < 3; i++)
      face(
        o,
        'trim',
        [p[i], p[(i + 1) % 3], [x, top, z]],
        normalFor(p[i], p[(i + 1) % 3], [x, top, z]),
      );
    return;
  }
  if (lod > 0) {
    box(o, 'trim', [x - w, base, z - w], [x + w, base + 0.35, z + w]);
    box(
      o,
      'trim',
      [x - w * 0.62, base + 0.35, z - w * 0.62],
      [x + w * 0.62, base + 0.9, z + w * 0.62],
    );
  }
  const y = lod ? base + 0.9 : base;
  for (const [a, b] of [
    [
      [-w, -w],
      [w, -w],
    ],
    [
      [w, -w],
      [w, w],
    ],
    [
      [w, w],
      [-w, w],
    ],
    [
      [-w, w],
      [-w, -w],
    ],
  ]) {
    const ps = [
      [x + a[0], y, z + a[1]],
      [x + b[0], y, z + b[1]],
      [x, top, z],
    ];
    face(o, 'trim', ps, normalFor(...ps));
  }
}
function dome(o, D, lod, id, { inner = false, openBase = false } = {}) {
  const [x, z] = D.center,
    n = lod >= 3 ? 32 : lod >= 2 ? 20 : lod >= 1 ? 12 : 6,
    levels = lod >= 3 ? 10 : lod >= 2 ? 6 : lod >= 1 ? 4 : 2,
    radius = D.radius,
    base = D.base,
    rise = D.rise,
    small = D.lanternRadius * 0.72,
    at = (j, i) => {
      const t = ((j / levels) * Math.PI) / 2,
        r = small + (radius - small) * Math.cos(t),
        a = (-i / n) * Math.PI * 2;
      return [x + r * Math.cos(a), base + rise * Math.sin(t), z + r * Math.sin(a)];
    };
  for (let j = 0; j < levels; j++)
    for (let i = 0; i < n; i++) {
      const ps = [at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j + 1, i)],
        normal = normalFor(...ps).map((v) => (inner ? -v : v)),
        color = inner ? C.trim : Math.floor(i / (lod >= 2 ? 2 : 1)) % 2 ? C.green : C.yellow;
      face(o, inner ? 'trim' : 'roof', ps, normal, color);
    }
  const bottom = Array.from({ length: n }, (_, i) => [at(0, i)[0], at(0, i)[2]]),
    top = Array.from({ length: n }, (_, i) => [at(levels, i)[0], at(levels, i)[2]]);
  if (!openBase && (lod > 0 || inner))
    cap(o, inner ? 'trim' : 'roof', bottom, [], base, [0, -1, 0]);
  if (lod > 0 || inner)
    cap(o, inner ? 'trim' : 'roof', top, [], base + rise, [0, inner ? -1 : 1, 0]);
  domeEvidence.push({
    id,
    center: D.center,
    radius,
    base,
    rise,
    inner,
    apex: base + rise,
    sides: n,
    levels,
  });
  if (inner) return;
  const ly = base + rise,
    lt = ly + D.lanternHeight,
    lr = D.lanternRadius,
    ln = lod >= 2 ? 8 : 6,
    lrings = [
      radialRing(ly, lr, lr, ln, D.center),
      radialRing(lt - 0.3, lr, lr, ln, D.center),
      radialRing(lt, 0.08, 0.08, ln, D.center),
    ];
  loft(o, 'trim', lod === 0 ? [lrings[0], lrings[2]] : lrings, C.trim);
  if (lod > 0) {
    const rings = radialRing(ly, lr * 1.02, lr * 1.02, ln, D.center);
    for (let i = 0; i < ln; i++) {
      const E = edge([rings[i][0], rings[i][2]], [rings[(i + 1) % ln][0], rings[(i + 1) % ln][2]]);
      window(
        o,
        E,
        E.L / 2,
        ly + 0.22,
        E.L * 0.42,
        Math.max(0.35, D.lanternHeight - 0.9),
        lod,
        true,
      );
    }
  } else if (id === 'whole-church-main-dome') {
    const E = edge([x - lr, z - lr], [x + lr, z - lr]);
    window(o, E, E.L / 2, ly + 0.2, lr * 0.7, Math.max(0.3, D.lanternHeight - 0.8), lod);
  }
  if (lod > 0) beam(o, 'iron', [x, lt, z], [x, D.tip, z], 0.07, 0.07, C.iron);
  else
    for (const [a, b] of [
      [
        [-0.07, -0.07],
        [0.07, -0.07],
      ],
      [
        [0.07, -0.07],
        [0.07, 0.07],
      ],
      [
        [0.07, 0.07],
        [-0.07, 0.07],
      ],
      [
        [-0.07, 0.07],
        [-0.07, -0.07],
      ],
    ]) {
      const ps = [
        [x + a[0], lt, z + a[1]],
        [x + b[0], lt, z + b[1]],
        [x, D.tip, z],
      ];
      face(o, 'iron', ps, normalFor(...ps));
    }
  if (lod > 0)
    beam(o, 'iron', [x - 0.35, D.tip - 0.3, z], [x + 0.35, D.tip - 0.3, z], 0.07, 0.07, C.iron);
  if (lod >= 3) {
    const ribs = 12,
      stops = 7;
    for (let i = 0; i < ribs; i++)
      for (let j = 0; j < stops; j++) {
        const a = at((j / stops) * levels, (i / ribs) * n),
          b = at(((j + 1) / stops) * levels, (i / ribs) * n);
        beam(o, 'trim', a, b, 0.09, 0.09, C.trim);
      }
  }
}
function archedWall(o, E, bottom, top, openings, depth, lod, id, k = 'trim') {
  const N = lod >= 3 ? 12 : lod >= 2 ? 6 : lod >= 1 ? 4 : 2;
  for (const back of [false, true]) {
    if (back && lod === 0) continue;
    const d = back ? -depth : 0,
      F = { ...E, at: (t, y, q = 0) => E.at(t, y, d + q), n: back ? E.n.map((v) => -v) : E.n };
    let previous = 0;
    for (const [index, A] of openings.entries()) {
      const left = A.center - A.radius,
        right = A.center + A.radius;
      if (left > previous + 0.00001) panel(o, k, F, previous, left, bottom, top);
      if (A.bottom > bottom + 0.00001) panel(o, k, F, left, right, bottom, A.bottom);
      const curve = Array.from({ length: N + 1 }, (_, j) => [
        A.center + A.radius * Math.cos(Math.PI - (j * Math.PI) / N),
        A.spring + A.radius * Math.sin(Math.PI - (j * Math.PI) / N),
      ]);
      for (let i = 1; i < curve.length; i++) {
        const a = curve[i - 1],
          b = curve[i],
          ps = [F.at(a[0], a[1]), F.at(b[0], b[1]), F.at(b[0], top), F.at(a[0], top)];
        face(o, k, ps, F.n);
        if (!back && lod > 0) {
          const reveal = [
            E.at(a[0], a[1]),
            E.at(a[0], a[1], -depth),
            E.at(b[0], b[1], -depth),
            E.at(b[0], b[1]),
          ];
          face(
            o,
            'trim',
            reveal,
            normalFor(...reveal).map((v) => -v),
          );
          if (lod >= 2)
            beam(
              o,
              'trim',
              E.at(a[0], a[1], 0.09),
              E.at(b[0], b[1], 0.09),
              0.22,
              0.18,
              i % 2 ? C.trim : C.brick,
            );
        }
      }
      if (!back) {
        for (const t of [left, right]) {
          const ps = [
              E.at(t, A.bottom),
              E.at(t, A.spring),
              E.at(t, A.spring, -depth),
              E.at(t, A.bottom, -depth),
            ],
            sign = t === left ? 1 : -1;
          face(
            o,
            'trim',
            ps,
            E.u.map((v) => v * sign),
          );
        }
        archEvidence.push({
          id: `${id}-${index}`,
          center: E.at(A.center, A.spring - 0.7),
          normal: E.n,
          soffit: E.at(A.center, A.spring + A.radius, -depth / 2),
          radius: A.radius,
          spring: A.spring,
          segments: N,
          depth,
          bottom: A.bottom,
          kind: id.startsWith('canopy') ? 'canopy' : id.startsWith('belfry') ? 'belfry' : 'gateway',
        });
      }
      previous = right;
    }
    if (previous < E.L - 0.00001) panel(o, k, F, previous, E.L, bottom, top);
  }
  face(
    o,
    k,
    [E.at(0, top), E.at(E.L, top), E.at(E.L, top, -depth), E.at(0, top, -depth)],
    [0, 1, 0],
  );
}
function canopy(o, lod) {
  const A = P.canopy,
    [x, z] = A.center,
    w = A.width / 2,
    d = A.depth / 2,
    r = [
      [x - w, z - d],
      [x + w, z - d],
      [x + w, z + d],
      [x - w, z + d],
    ];
  for (let i = 0; i < 4; i++) {
    const E = edge(r[i], r[(i + 1) % 4]);
    archedWall(
      o,
      E,
      P.foundationBottomY,
      A.cornice,
      [{ center: E.L / 2, radius: A.archRadius, bottom: A.archBottom, spring: A.archSpring }],
      A.wallThickness,
      lod,
      `canopy-open-arch-${i}`,
    );
    if (lod > 0) {
      if (lod >= 2) {
        for (const t of [0.43, E.L - 0.43])
          for (let j = 0; j < 15; j++)
            panel(o, 'trim', E, t - 0.16, t + 0.16, 2 + j * 1.02, 2.4 + j * 1.02, 0.19);
        for (let j = 0; j < 18; j++)
          if (j % 2 === 0)
            panel(
              o,
              'brick',
              E,
              0.4 + (j * (E.L - 0.8)) / 18,
              0.4 + ((j + 0.6) * (E.L - 0.8)) / 18,
              A.cornice - 0.6,
              A.cornice - 0.18,
              0.035,
            );
      }
      beam(
        o,
        'trim',
        E.at(0, A.cornice + 0.15, 0.22),
        E.at(E.L, A.cornice + 0.15, 0.22),
        0.45,
        0.55,
        C.trim,
      );
      for (const t of [0.5, E.L - 0.5]) {
        beam(o, 'trim', E.at(t, A.baseY, 0.08), E.at(t, A.cornice, 0.08), 0.33, 0.3, C.trim);
        pierEvidence.push({ id: `canopy-pier-${i}-${t}`, point: E.at(t, 8, 0.1), normal: E.n });
      }
    }
  }
  const n = lod >= 3 ? 32 : lod >= 2 ? 20 : lod >= 1 ? 12 : 6,
    circle = Array.from({ length: n }, (_, i) => [
      x + 6.2 * Math.cos((-i / n) * Math.PI * 2),
      z + 6.2 * Math.sin((-i / n) * Math.PI * 2),
    ]);
  cap(o, 'trim', r, [circle], A.domeBase - 0.25, [0, -1, 0]);
  cap(o, 'trim', r, [circle], A.domeBase, [0, 1, 0]);
  dome(
    o,
    {
      center: A.center,
      radius: A.domeRadius,
      base: A.domeBase,
      rise: A.domeRise,
      lanternRadius: A.lanternRadius,
      lanternHeight: A.lanternHeight,
      tip: A.topY,
    },
    lod,
    'independent90foot-stone-court-canopy',
    { openBase: true },
  );
  dome(
    o,
    {
      center: A.center,
      radius: 6.2,
      base: A.domeBase - 0.25,
      rise: A.domeRise - 0.25,
      lanternRadius: A.lanternRadius,
      lanternHeight: 0,
      tip: A.topY,
    },
    lod,
    'real-curved-canopy-underside',
    { inner: true, openBase: true },
  );
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    pinnacle(
      o,
      x + dx * (w - 0.55),
      z + dz * (d - 0.55),
      A.cornerPinnacleBase,
      A.cornerPinnacleTop,
      lod,
    );
  box(o, 'trim', [x - w, A.baseY - 0.22, z - d], [x + w, A.baseY, z + d]);
  for (const [i, S] of A.baseSteps.entries()) {
    box(
      o,
      'trim',
      [x - S.width / 2, A.baseY, z - S.depth / 2],
      [x + S.width / 2, S.y, z + S.depth / 2],
    );
    stairEvidence.push({
      id: `graduated-cross-base-${i}`,
      point: [x + S.width / 2 - 0.15, S.y, z],
      height: S.y,
    });
  }
  const base = A.baseSteps.at(-1).y;
  for (const [i, K] of A.crosses.entries()) {
    const cx = x + K.x,
      top = base + K.height,
      arm = top - K.height * 0.28;
    if (lod > 0) {
      beam(o, 'trim', [cx, base, z], [cx, top, z], 0.33, 0.38, C.trim);
      beam(o, 'trim', [cx - K.width / 2, arm, z], [cx + K.width / 2, arm, z], 0.33, 0.38, C.trim);
    } else {
      const planes = [
        [
          [cx - 0.165, base, z],
          [cx + 0.165, base, z],
          [cx + 0.165, top, z],
          [cx - 0.165, top, z],
        ],
        [
          [cx, base, z - 0.19],
          [cx, base, z + 0.19],
          [cx, top, z + 0.19],
          [cx, top, z - 0.19],
        ],
        [
          [cx - K.width / 2, arm - 0.165, z],
          [cx + K.width / 2, arm - 0.165, z],
          [cx + K.width / 2, arm + 0.165, z],
          [cx - K.width / 2, arm + 0.165, z],
        ],
      ];
      for (const ps of planes) {
        const n = normalFor(...ps);
        face(o, 'trim', ps, n);
        face(
          o,
          'trim',
          ps,
          n.map((v) => -v),
        );
      }
    }
    crossEvidence.push({
      id: `primary-alabaster-cross-${i}`,
      center: [cx, base + K.height * 0.5, z],
      top,
      width: K.width,
    });
  }
  partEvidence.push({
    id: 'separate90foot-open-stone-court-canopy',
    baseY: A.baseY,
    topY: A.topY,
    primaryHeightMeters: A.heightFromBaseMeters,
    realArches: 4,
    primaryCrosses: 3,
  });
}
function belfry(o, lod) {
  const T = P.tower,
    [x, z] = T.center,
    w = T.baseWidth / 2;
  box(o, 'wall', [x - w, P.foundationBottomY, z - w], [x + w, T.bellBottom, z + w]);
  for (const y of [T.shaftTop, T.bellBottom, T.bellTop])
    box(o, 'trim', [x - w - 0.24, y - 0.25, z - w - 0.24], [x + w + 0.24, y + 0.15, z + w + 0.24]);
  const r = [
    [x - w, z - w],
    [x + w, z - w],
    [x + w, z + w],
    [x - w, z + w],
  ];
  for (let i = 0; i < 4; i++) {
    const E = edge(r[i], r[(i + 1) % 4]),
      open =
        lod === 0
          ? [{ center: E.L / 2, radius: 0.85, bottom: T.openingBottom, spring: T.archSpring }]
          : [-1, 1].map((side) => ({
              center: E.L / 2 + side * 1.55,
              radius: T.archRadius,
              bottom: T.openingBottom,
              spring: T.archSpring,
            }));
    archedWall(
      o,
      E,
      T.bellBottom,
      T.bellTop,
      open,
      0.45,
      lod,
      `belfry-open-bell-face-${i}`,
      'wall',
    );
    if (lod >= 1) {
      for (const a of [0.25, E.L - 0.25])
        beam(o, 'trim', E.at(a, P.baseFloorY, 0.04), E.at(a, T.bellTop, 0.04), 0.24, 0.24, C.trim);
      window(o, E, E.L / 2, 11.5, 0.8, 2.5, lod, true);
    }
  }
  box(o, 'trim', [x - w - 0.3, T.bellTop, z - w - 0.3], [x + w + 0.3, T.roofBase, z + w + 0.3]);
  dome(
    o,
    {
      center: T.center,
      radius: T.roofRadius,
      base: T.roofBase,
      rise: T.roofRise,
      lanternRadius: T.lanternRadius,
      lanternHeight: T.lanternHeight,
      tip: T.tip,
    },
    lod,
    'whole-independent-belfry-dome',
  );
  if (lod > 0) {
    cylinder(o, 'iron', T.center, 0.48, 23.4, 24.6, lod);
    beam(o, 'iron', [x - w + 0.5, 25.1, z], [x + w - 0.5, 25.1, z], 0.2, 0.2, C.iron);
  }
  partEvidence.push({
    id: 'whole-independent-belfry-and-bell-chamber',
    center: T.center,
    bellOpenings: lod ? 8 : 4,
    tip: T.tip,
  });
}
function gateway(o, lod) {
  const C0 = P.court,
    G = C0.gate,
    [x, z] = C0.gateCenter,
    w = G.width / 2,
    E = edge([x - w, z - G.depth / 2], [x + w, z - G.depth / 2]);
  archedWall(
    o,
    E,
    P.foundationBottomY,
    G.cornice,
    [{ center: w, radius: G.archRadius, bottom: P.baseFloorY, spring: G.archSpring }],
    G.depth,
    lod,
    'gateway-real-arched-passage',
    'brick',
  );
  const a = [x - w, G.cornice, z - G.depth / 2],
    b = [x + w, G.cornice, z - G.depth / 2],
    c = [x, G.pedimentTop, z - G.depth / 2],
    back = [a, b, c].map((p) => [p[0], p[1], p[2] + G.depth]);
  face(o, 'brick', [a, b, c], [0, 0, -1]);
  face(o, 'brick', back, [0, 0, 1]);
  for (let i = 0; i < 3; i++)
    face(
      o,
      'brick',
      [[a, b, c][i], [a, b, c][(i + 1) % 3], back[(i + 1) % 3], back[i]],
      normalFor([a, b, c][i], [a, b, c][(i + 1) % 3], back[(i + 1) % 3]),
    );
  for (const dx of [-1, 0, 1])
    pinnacle(o, x + dx * (w - 0.35), z, dx === 0 ? G.pedimentTop : G.cornice, G.finialTop, lod);
  if (lod > 0) {
    for (const dx of [-1, 1]) {
      beam(
        o,
        'trim',
        [x + dx * (w - 0.45), P.baseFloorY, z - 0.8],
        [x + dx * (w - 0.45), G.cornice, z - 0.8],
        0.44,
        0.36,
        C.trim,
      );
      const count = lod >= 3 ? 9 : lod >= 2 ? 5 : 3;
      for (let j = 0; j < count; j++) {
        const xx = x + dx * (((j + 0.5) * G.opening) / 2 / count);
        beam(o, 'iron', [xx, P.baseFloorY, z], [xx, G.ironTop, z], 0.065, 0.065, C.iron);
      }
      for (const y of [0.8, 4.1, G.ironTop])
        beam(o, 'iron', [x, y, z], [x + (dx * G.opening) / 2, y, z], 0.08, 0.08, C.iron);
    }
  } else {
    for (const dx of [-1, 1])
      beam(
        o,
        'iron',
        [x + dx * 1.3, P.baseFloorY, z],
        [x + dx * 1.3, G.ironTop, z],
        0.08,
        0.08,
        C.iron,
      );
  }
  partEvidence.push({
    id: 'whole-carved-arched-forecourt-gateway-and-iron-gates',
    center: C0.gateCenter,
  });
}
function boundary(o, lod) {
  const C0 = P.court,
    B = C0.bounds,
    G = C0.gate,
    [gx, _gz] = C0.gateCenter,
    W = C0.wallWidth;
  for (const [a, b] of [
    [
      [B.x0, B.z0],
      [gx - G.width / 2, B.z0],
    ],
    [
      [gx + G.width / 2, B.z0],
      [B.x1, B.z0],
    ],
    [
      [B.x1, B.z0],
      [B.x1, B.z1],
    ],
    [
      [B.x1, B.z1],
      [B.x0, B.z1],
    ],
    [
      [B.x0, B.z1],
      [B.x0, B.z0],
    ],
  ])
    beam(
      o,
      'brick',
      [...a.slice(0, 1), C0.wallHeight / 2, a[1]],
      [b[0], C0.wallHeight / 2, b[1]],
      W,
      C0.wallHeight,
      C.brick,
    );
  for (const [i, K] of C0.chambers.entries()) {
    const [x, z] = K.center,
      w = K.width / 2,
      d = K.depth / 2;
    box(o, 'brick', [x - w, P.foundationBottomY, z - d], [x + w, K.eave, z + d]);
    gable(
      o,
      [x - w, z - d],
      [x + w, z - d],
      [x + w, z + d],
      [x - w, z + d],
      K.eave,
      K.ridge,
      lod,
      `primary-corner-brick-chamber-${i}`,
    );
    const E = edge([x - w, z - d - 0.02], [x + w, z - d - 0.02]);
    panel(o, 'iron', E, w - 0.62, w + 0.62, P.baseFloorY, P.baseFloorY + 2.3);
    if (lod > 0) window(o, E, w, K.eave - 1.0, 0.22, 0.55, lod);
    partEvidence.push({ id: `primary-corner-brick-chamber-${i}`, center: K.center });
  }
}
function churchBody(o, lod) {
  poly(o, 'wall', church, P.foundationBottomY, P.church.eave);
  for (const [i, R] of P.church.roofSections.entries())
    gable(
      o,
      [R.x0, R.z0],
      [R.x1, R.z0],
      [R.x1, R.z1],
      [R.x0, R.z1],
      R.eave,
      R.ridge,
      lod,
      `whole-church-roof-${i}`,
    );
  for (const [id, D] of [
    ['main', P.church.mainDome],
    ['east-chapel', P.church.chapelDome],
    ...P.church.chapels.map((d, i) => [`side-chapel-${i}`, d]),
  ]) {
    cylinder(o, 'wall', D.center, D.radius, P.church.eave, D.base, lod);
    dome(o, D, lod, `whole-church-${id}-dome`);
  }
  for (const [x, z] of P.church.pinnacles)
    pinnacle(o, x, z, P.church.pinnacleBase, P.church.pinnacleTop, lod);
  for (let i = 0; i < church.length; i++) {
    const E = edge(church[i], church[(i + 1) % church.length]);
    if (E.L > 5 && (lod > 0 || i === 0)) {
      const count = lod === 0 ? 1 : Math.floor(E.L / P.church.windows.pitch);
      for (let j = 0; j < count; j++)
        window(
          o,
          E,
          ((j + 0.5) * E.L) / count,
          P.church.windows.bottom,
          P.church.windows.width,
          P.church.windows.height,
          lod,
          true,
        );
    }
  }
  const R = P.church.door,
    nearby = church
      .map((a, i) => edge(a, church[(i + 1) % church.length]))
      .map((E) => {
        const t = Math.max(
          R.width / 2 + 0.1,
          Math.min(
            E.L - R.width / 2 - 0.1,
            (R.center[0] - E.a[0]) * E.u[0] + (R.center[1] - E.a[1]) * E.u[2],
          ),
        );
        const p = E.at(t, P.baseFloorY);
        return { E, t, distance: Math.hypot(p[0] - R.center[0], p[2] - R.center[1]) };
      })
      .filter((q) => q.E.L > R.width + 0.2)
      .sort((a, b) => a.distance - b.distance)[0],
    { E, t } = nearby;
  panel(
    o,
    'iron',
    E,
    t - R.width / 2,
    t + R.width / 2,
    P.baseFloorY,
    P.baseFloorY + R.height,
    0.045,
  );
  if (lod > 0)
    for (const x of [t - R.width / 2 - 0.14, t + R.width / 2 + 0.14])
      beam(
        o,
        'trim',
        E.at(x, P.baseFloorY, 0.1),
        E.at(x, P.baseFloorY + R.height + 0.15, 0.1),
        0.24,
        0.25,
        C.trim,
      );
  for (let j = 0; j < 3; j++) {
    const y = (P.baseFloorY * (j + 1)) / 3,
      a = (2 - j) * 0.35,
      b = (3 - j) * 0.35,
      w = R.width / 2 + 0.3,
      top = [E.at(t - w, y, a), E.at(t + w, y, a), E.at(t + w, y, b), E.at(t - w, y, b)];
    face(o, 'trim', top, [0, 1, 0]);
    face(
      o,
      'trim',
      [top[2], top[3], E.at(t - w, y - P.baseFloorY / 3, b), E.at(t + w, y - P.baseFloorY / 3, b)],
      E.n,
    );
    stairEvidence.push({
      id: `intrinsic-church-entry-step-${j}`,
      point: E.at(t, y, (a + b) / 2),
      height: y,
    });
  }
  partEvidence.push({
    id: 'whole-native-context-nave-transept-apse-rear-camarin-and-chapels',
    controls: church.length,
  });
}
function cloisterBody(o, lod) {
  const C0 = P.cloister;
  poly(o, 'brick', cloister, P.foundationBottomY, C0.eave, { holes: courtRings });
  for (const R of C0.connections) {
    box(o, 'brick', [R.x0, P.foundationBottomY, R.z0], [R.x1, R.eave, R.z1]);
    gable(
      o,
      [R.x0, R.z0],
      [R.x1, R.z0],
      [R.x1, R.z1],
      [R.x0, R.z1],
      R.eave,
      R.ridge,
      lod,
      'whole-cloister-connection',
    );
  }
  const roofs = [
    ['west-servicewing', [-73, 25], [-75, 68], [-63, 58], [-63, 34]],
    ['north-servicewing', [-73, 25], [39, 25], [24, 35], [-63, 34]],
    ['east-servicewing', [39, 25], [36, 79], [24, 65], [24, 35]],
    ['south-servicewing', [-75, 68], [36, 79], [24, 65], [-63, 58]],
    ['central-servicewing', [-34, 34], [-34, 58], [-22, 65], [-22, 35]],
  ];
  for (const [id, a, b, c, d] of roofs) gable(o, a, b, c, d, C0.eave, C0.ridge, lod, id);
  if (lod > 0)
    for (let i = 0; i < cloister.length; i++) {
      const E = edge(cloister[i], cloister[(i + 1) % cloister.length]),
        count = Math.floor(E.L / 7);
      for (let j = 0; j < count; j++) window(o, E, ((j + 0.5) * E.L) / count, 2.4, 1.1, 1.6, lod);
    }
  for (const [_ci, r] of courtRings.entries())
    for (let i = 0; i < r.length; i++) {
      const E = edge(r[i], r[(i + 1) % r.length], true);
      if (lod > 0) {
        const count = Math.max(1, Math.floor(E.L / 7));
        for (let j = 0; j < count; j++) {
          const t = ((j + 0.5) * E.L) / count;
          panel(
            o,
            'iron',
            E,
            t - 0.65,
            t + 0.65,
            P.baseFloorY,
            P.baseFloorY + C0.doorHeight,
            0.035,
          );
          window(o, E, t, 4.1, 1.05, 1.3, lod);
        }
      }
    }
  partEvidence.push({
    id: 'whole-connected-two-court-cloister-and-service-ranges',
    outer: cloister.length,
    courts: 2,
    hiddenHistoricPlanEstimated: true,
  });
}
export function buildHouse(o, _f, lod = 3) {
  activeLod = lod;
  for (const a of [
    partEvidence,
    roofEvidence,
    archEvidence,
    pierEvidence,
    domeEvidence,
    crossEvidence,
    windowEvidence,
    stairEvidence,
  ])
    a.length = 0;
  churchBody(o, lod);
  cloisterBody(o, lod);
  canopy(o, lod);
  belfry(o, lod);
  gateway(o, lod);
  boundary(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/6m/6mn/basilica_of_our_lady_of_copacabana';
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Basilica of Our Lady of Copacabana (depicted1877)',
  cell: '6m/6mn',
  wikidataId: 'Q4867361',
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
  camera: [145, 88, -165],
  lookAt: [0, 10, 0],
  portableGroundY: -2.2,
  mediumFiContext: {
    scale: 1,
    groundY: -2.2,
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'brick',
    'stone_limestone_raw',
    'tile_glazed',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-shrine-church-belfry-separate-canopy-gate-and-courts',
      position: [145, 88, -165],
      lookAt: [0, 10, 0],
    },
    {
      name: 'whole-rear-camarin-two-court-cloisters-and-closed-roofs',
      position: [-150, 105, 145],
      lookAt: [0, 8, 5],
    },
    {
      name: 'separate-ninety-foot-court-canopy-and-three-crosses',
      position: [41, 15, -68],
      lookAt: [17, 12, -39],
    },
    {
      name: 'three-actual-stone-crosses-and-graduated-base',
      position: [17, 8, -65],
      lookAt: [17, 4.5, -39],
    },
    {
      name: 'inside-real-open-canopy-curved-dome-and-alabaster-crosses',
      position: [20, 3.8, -43],
      lookAt: [17, 17, -39],
    },
    {
      name: 'historic-gateway-bell-chamber-and-glazed-church-domes',
      position: [72, 32, -88],
      lookAt: [27, 18, -22],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-shrine-${reviewLod}`,
    position: [145, 88, -165],
    lookAt: [0, 10, 0],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry/repository license. Qualla-first31families/1unrelatedconflictedpathunused precedes exact1877NewYorkHarperoriginal666pagepublicdomainvolume/nativePD-old-100-expired/bytes/title/copyright/plate319/architecture321–322 personallyinspected. BookauthorSquier1821–1888notassumeduncreditedengraver. Mainchurchmainlybrick with estimatedplasteredfinish, primarygreen-yellowtile palette. Independent90footstonecourtcanopy/threestonecrosses distinguished fromchurch. OSMODbL18controlcurrentchurch/16controlopencourt as historicalcontextonly, neverbroadestateextrusion. Noquestionablephotos/copyrightwaivers/Quallamedia-rightsrepairs/copiedfigurativeart/phototextures/generatedbitmaps.',
};
