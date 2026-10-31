/** Whole historic masonry dam: original section, native plan, estimated hidden details. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const toWorld = (p) => p;
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.75, metallic: 0.65 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.2 },
  glass: {
    slot: 'window',
    localRef: 'palette:#334247',
    roughness: 0.4,
    metallic: 0.05,
    alphaMode: 'OPAQUE',
  },
  door: { slot: 'door', localRef: 'palette:#393b36', roughness: 0.92, metallic: 0 },
};
const C = {
    stone: rgb('a5a195'),
    trim: rgb('c3bcaa'),
    roof: rgb('65756b'),
    iron: rgb('414944'),
    glass: rgb('334247'),
    door: rgb('393b36'),
  },
  ref = 'palette:#ffffff';
export const partEvidence = [],
  windowEvidence = [];
function face(o, k, p, n) {
  const actual = normalFor(...p);
  if (n && actual.reduce((s, v, i) => s + v * n[i], 0) < 0) p = [...p].reverse();
  o.addConvexPolygon(k, ref, p, n ?? normalFor(...p), (q) => [q[0], q[1]], C[k]);
}
function cap(o, k, ring, y, up = true) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      k,
      ref,
      ring,
      [],
      () => y,
      [0, up ? 1 : -1, 0],
      (q) => q,
      C[k],
    )
  )
    throw Error('Complete dam cap failed');
  const m = builder.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    o.addTriangle(
      k,
      ref,
      p,
      [0, up ? 1 : -1, 0],
      p.map((q) => [q[0], q[2]]),
      C[k],
    );
  }
}
function prism(o, k, ring, lo, hi) {
  const area = ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  cap(o, k, ring, lo, false);
  cap(o, k, ring, hi);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      d = [b[0] - a[0], b[1] - a[1]],
      n = area > 0 ? [d[1], 0, -d[0]] : [-d[1], 0, d[0]],
      L = Math.hypot(n[0], n[2]);
    face(
      o,
      k,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      n.map((v) => v / L),
    );
  }
}
export function radial(a, r, y) {
  return [P.curve.center[0] + Math.cos(a) * r, y, P.curve.center[1] + Math.sin(a) * r];
}
function curvedStrip(o, k, a0, a1, r0, r1, y0, y1, n) {
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const p = radial(a0 + ((a1 - a0) * i) / n, r0, 0);
    ring.push([p[0], p[2]]);
  }
  for (let i = n; i >= 0; i--) {
    const p = radial(a0 + ((a1 - a0) * i) / n, r1, 0);
    ring.push([p[0], p[2]]);
  }
  prism(o, k, ring, y0, y1);
}
function cylinder(o, k, c, r, lo, hi, n = 8) {
  prism(
    o,
    k,
    Array.from({ length: n }, (_, i) => [
      c[0] + Math.cos((i * 2 * Math.PI) / n) * r,
      c[1] + Math.sin((i * 2 * Math.PI) / n) * r,
    ]),
    lo,
    hi,
  );
}
function cone(o, k, c, r0, y0, r1, y1, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      p = [
        [c[0] + Math.cos(a) * r0, y0, c[1] + Math.sin(a) * r0],
        [c[0] + Math.cos(b) * r0, y0, c[1] + Math.sin(b) * r0],
        [c[0] + Math.cos(b) * r1, y1, c[1] + Math.sin(b) * r1],
        [c[0] + Math.cos(a) * r1, y1, c[1] + Math.sin(a) * r1],
      ];
    face(
      o,
      k,
      p,
      [Math.cos((a + b) / 2), Math.max(0, (r0 - r1) / (y1 - y0)), Math.sin((a + b) / 2)].map(
        (v, _, arr) => v / Math.hypot(...arr),
      ),
    );
  }
}
function body(o, lod) {
  prism(o, 'stone', P.outline, P.baseY, P.baseY + 0.65);
  const n = [10, 28, 42, 64][lod],
    bands = lod === 0 ? [0, 1] : lod === 1 ? [0, 0.58, 1] : P.profileBands,
    R = P.curve.radius,
    a0 = P.curve.angle0,
    a1 = P.curve.angle1;
  const ring = (t, outer) => {
    const y = P.baseY + (P.crestY - P.baseY) * t;
    const r = outer ? R + 7.4 - 5.4 * t : R - 8.4 + 6.4 * (1 - Math.pow(1 - t, 2));
    return Array.from({ length: n + 1 }, (_, i) => radial(a0 + ((a1 - a0) * i) / n, r, y));
  };
  for (let j = 1; j < bands.length; j++)
    for (const outer of [false, true]) {
      const prev = ring(bands[j - 1], outer),
        next = ring(bands[j], outer);
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n,
          sign = outer ? 1 : -1;
        face(
          o,
          'stone',
          [prev[i], prev[i + 1], next[i + 1], next[i]],
          [Math.cos(a) * sign, outer ? 0.2 : 1, Math.sin(a) * sign].map(
            (v, _, arr) => v / Math.hypot(...arr),
          ),
        );
      }
    }
  for (const t of [0, 1]) {
    const left = ring(t, false),
      right = ring(t, true);
    for (let i = 0; i < n; i++)
      face(
        o,
        t ? 'trim' : 'stone',
        [left[i], left[i + 1], right[i + 1], right[i]],
        [0, t ? 1 : -1, 0],
      );
  }
  for (const idx of [0, n]) {
    for (let j = 1; j < bands.length; j++) {
      const t0 = bands[j - 1],
        t1 = bands[j];
      face(
        o,
        'stone',
        [ring(t0, false)[idx], ring(t0, true)[idx], ring(t1, true)[idx], ring(t1, false)[idx]],
        [idx === 0 ? Math.sin(a0) : -Math.sin(a1), 0, idx === 0 ? -Math.cos(a0) : Math.cos(a1)],
      );
    }
  }
  if (lod > 1)
    for (let i = 1; i < 20; i++) {
      const t = i / 20,
        y = P.baseY + 25 * t,
        r = R - 8.4 + 6.4 * (1 - Math.pow(1 - t, 2));
      curvedStrip(o, 'trim', a0, a1, r - 0.045, r + 0.025, y, y + 0.055, n);
    }
  partEvidence.push({
    part: 'whole-curved-gravity-dam',
    nativeBaseControls: 54,
    height: 25,
    crestWidth: 4,
    bodyBands: bands.length - 1,
  });
}
function crest(o, lod) {
  const R = P.curve.radius,
    n = [10, 28, 42, 64][lod],
    a0 = P.curve.angle0,
    a1 = P.curve.angle1;
  for (const r of [R - 2, R + 2]) {
    curvedStrip(
      o,
      'stone',
      a0,
      a1,
      r - P.parapetWidth / 2,
      r + P.parapetWidth / 2,
      P.crestY,
      P.parapetY,
      n,
    );
    if (lod > 0)
      curvedStrip(o, 'trim', a0, a1, r - 0.27, r + 0.27, P.parapetY, P.parapetY + 0.15, n);
  }
  if (lod > 0) {
    const count = Math.floor(((a1 - a0) * R) / P.arcade.pitch),
      segments = [0, 4, 7, 10][lod];
    for (let j = 0; j < count; j++) {
      const a = a0 + ((a1 - a0) * (j + 0.5)) / count,
        ca = Math.cos(a),
        sa = Math.sin(a),
        center = radial(a, R - 2.7, 0),
        point = (x, y, depth = 0) => [
          center[0] - sa * x + ca * depth,
          y,
          center[2] + ca * x + sa * depth,
        ],
        w = P.arcade.pitch * 0.44,
        h = P.arcade.apex - P.arcade.spring;
      for (let k = 0; k < segments; k++) {
        const u = (Math.PI * k) / segments,
          v = (Math.PI * (k + 1)) / segments,
          inner = (t) => [Math.cos(t) * w, P.arcade.spring + Math.sin(t) * h],
          outer = (t) => [Math.cos(t) * (w + 0.28), P.arcade.spring + Math.sin(t) * (h + 0.3)],
          i0 = inner(u),
          i1 = inner(v),
          o0 = outer(u),
          o1 = outer(v);
        face(o, 'trim', [point(...i0), point(...i1), point(...o1), point(...o0)], [-ca, 0, -sa]);
        face(o, 'trim', [point(...i0), point(...i1), point(...i1, 0.75), point(...i0, 0.75)]);
      }
      const p = radial(a + ((a1 - a0) / count) * 0.5, R - 2.65, 21.3);
      cylinder(o, 'trim', [p[0], p[2]], 0.26, 20.3, 23, 4);
    }
  }
  for (const a of [a0, a1]) {
    const p = radial(a, R, 0),
      c = [p[0], p[2]];
    cylinder(o, 'stone', c, 0.9, P.crestY, P.endTurrets.wallTop, 8);
    cone(o, 'trim', c, 1.1, P.endTurrets.wallTop, 0.15, P.endTurrets.capTop, 8);
    if (lod > 0) beam(o, 'iron', [p[0], 27, p[2]], [p[0], 28.1, p[2]], 0.08, 0.08, C.iron);
  }
  partEvidence.push({
    part: 'whole-crest-parapets-corbel-arcade-and-end-turrets',
    closedWalkway: true,
  });
}
function pavilion(o, lod) {
  const A = P.pavilion,
    p = radial(A.angle, P.curve.radius + A.radialOffset, 0),
    c = [p[0], p[2]],
    n = 8;
  cylinder(o, 'stone', c, 2.1, P.baseY, A.baseY, n);
  cylinder(o, 'trim', c, 2.7, A.baseY - 0.35, A.baseY + 0.2, n);
  const back = radial(A.angle, P.curve.radius, 23.15);
  beam(o, 'trim', back, [p[0], 23.15, p[2]], 2.8, 0.5, C.trim);
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      mid = (a + b) / 2,
      N = [Math.cos(mid), 0, Math.sin(mid)],
      a0 = [c[0] + Math.cos(a) * A.radius, c[1] + Math.sin(a) * A.radius],
      b0 = [c[0] + Math.cos(b) * A.radius, c[1] + Math.sin(b) * A.radius],
      L = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]),
      U = [(b0[0] - a0[0]) / L, (b0[1] - a0[1]) / L],
      q = (x, y, depth = 0) => [
        a0[0] + U[0] * x - N[0] * depth,
        y,
        a0[1] + U[1] * x - N[2] * depth,
      ],
      panel = (x0, x1, y0, y1, depth = 0, k = 'stone') =>
        face(o, k, [q(x0, y0, depth), q(x1, y0, depth), q(x1, y1, depth), q(x0, y1, depth)], N);
    if (lod === 0) {
      panel(0, L, A.baseY, A.wallTop);
      continue;
    }
    const x0 = L * 0.22,
      x1 = L * 0.78,
      y0 = 24.3,
      y1 = 27.25;
    panel(0, L, A.baseY, y0);
    panel(0, L, y1, A.wallTop);
    panel(0, x0, y0, y1);
    panel(x1, L, y0, y1);
    panel(x0, x1, y0, y1, 0.2, i === 5 ? 'door' : 'glass');
    for (const [xs, ys] of [
      [
        [x0, y0],
        [x1, y0],
      ],
      [
        [x1, y0],
        [x1, y1],
      ],
      [
        [x1, y1],
        [x0, y1],
      ],
      [
        [x0, y1],
        [x0, y0],
      ],
    ])
      face(o, 'trim', [q(...xs), q(...ys), q(...ys, 0.2), q(...xs, 0.2)]);
    if (lod > 1)
      beam(o, 'iron', q((x0 + x1) / 2, y0, 0.14), q((x0 + x1) / 2, y1, 0.14), 0.045, 0.045, C.iron);
    windowEvidence.push({ center: q((x0 + x1) / 2, (y0 + y1) / 2), outward: N, recess: 0.2 });
  }
  cylinder(o, 'trim', c, 2.62, A.wallTop - 0.2, A.roofSpring, n);
  cone(o, 'roof', c, 2.85, A.roofSpring, 1.9, A.roofShoulder, n);
  cone(o, 'roof', c, 1.9, A.roofShoulder, 0.15, A.roofApex, n);
  cap(
    o,
    'roof',
    Array.from({ length: n }, (_, i) => [
      c[0] + Math.cos((i * 2 * Math.PI) / n) * 2.85,
      c[1] + Math.sin((i * 2 * Math.PI) / n) * 2.85,
    ]),
    A.roofSpring,
    false,
  );
  beam(
    o,
    'iron',
    [c[0], A.roofApex, c[1]],
    [c[0], A.finialTop, c[1]],
    lod === 0 ? 0.13 : 0.08,
    lod === 0 ? 0.13 : 0.08,
    C.iron,
  );
  partEvidence.push({
    part: 'whole-octagonal-intake-pier-valve-pavilion-and-closed-metal-roof',
    sides: 8,
  });
}
function channel(o, k, a, b, width, y0, y1, thickness) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    nx = -dz / L,
    nz = dx / L,
    ring = [
      [a[0] + (nx * width) / 2, a[1] + (nz * width) / 2],
      [b[0] + (nx * width) / 2, b[1] + (nz * width) / 2],
      [b[0] - (nx * width) / 2, b[1] - (nz * width) / 2],
      [a[0] - (nx * width) / 2, a[1] - (nz * width) / 2],
    ];
  for (const side of [-1, 1]) {
    const offset = side * (width / 2 - 0.15),
      aa = [a[0] + nx * offset, a[1] + nz * offset],
      bb = [b[0] + nx * offset, b[1] + nz * offset];
    beam(o, 'stone', [aa[0], y0 + 0.52, aa[1]], [bb[0], y1 + 0.52, bb[1]], 0.45, 1.05, C.stone);
  }
  face(
    o,
    k,
    [
      [ring[0][0], y0, ring[0][1]],
      [ring[1][0], y1, ring[1][1]],
      [ring[2][0], y1, ring[2][1]],
      [ring[3][0], y0, ring[3][1]],
    ],
    [0, 1, 0],
  );
  face(
    o,
    k,
    [
      [ring[0][0], y0 - thickness, ring[0][1]],
      [ring[1][0], y1 - thickness, ring[1][1]],
      [ring[2][0], y1 - thickness, ring[2][1]],
      [ring[3][0], y0 - thickness, ring[3][1]],
    ],
    [0, -1, 0],
  );
}
function spillway(o, lod) {
  const A = P.spillway,
    path = A.path,
    lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1])),
    total = lengths.reduce((s, v) => s + v, 0),
    at = (t) => {
      let d = t * total;
      for (let i = 0; i < lengths.length; i++) {
        if (d <= lengths[i] || i === lengths.length - 1) {
          const u = d / lengths[i];
          return path[i].map((v, k) => v + (path[i + 1][k] - v) * u);
        }
        d -= lengths[i];
      }
    },
    n = [4, 12, 24, A.steps][lod];
  for (let i = 0; i < n; i++) {
    const a = at(i / n),
      b = at((i + 1) / n),
      y = A.topY + ((A.bottomY - A.topY) * i) / n,
      yn = A.topY + ((A.bottomY - A.topY) * (i + 1)) / n;
    channel(o, 'stone', a, b, A.width, y, y, 0.45);
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      nx = -dz / L,
      nz = dx / L;
    face(o, 'stone', [
      [b[0] + (nx * A.width) / 2, yn, b[1] + (nz * A.width) / 2],
      [b[0] - (nx * A.width) / 2, yn, b[1] - (nz * A.width) / 2],
      [b[0] - (nx * A.width) / 2, y, b[1] - (nz * A.width) / 2],
      [b[0] + (nx * A.width) / 2, y, b[1] + (nz * A.width) / 2],
    ]);
  }
  const first = path[0];
  channel(
    o,
    'trim',
    [first[0] - 9, first[1] - 2],
    [first[0] + 11, first[1] - 2],
    2,
    A.topY + 0.5,
    A.topY + 0.5,
    0.65,
  );
  const p = radial(P.curve.angle0, P.curve.radius, P.crestY);
  channel(o, 'stone', [p[0], p[2]], first, 6, P.crestY, A.topY, 0.6);
  const O = P.outlet,
    exit = O.path[1],
    entrance = O.path[0],
    dx = exit[0] - entrance[0],
    dz = exit[1] - entrance[1],
    L = Math.hypot(dx, dz),
    u = [dx / L, dz / L],
    v = [-u[1], u[0]],
    c = exit,
    q = (x, y, s = 0) => [c[0] + v[0] * x + u[0] * s, y, c[1] + v[1] * x + u[1] * s];
  for (const side of [-1, 1])
    prism(
      o,
      'stone',
      [
        [q(side * 1.45, 0)[0], q(side * 1.45, 0)[2]],
        [q(side * 2.15, 0)[0], q(side * 2.15, 0)[2]],
        [q(side * 2.15, 0, -3)[0], q(side * 2.15, 0, -3)[2]],
        [q(side * 1.45, 0, -3)[0], q(side * 1.45, 0, -3)[2]],
      ],
      -1,
      4.6,
    );
  const seg = lod === 0 ? 4 : 10;
  for (let i = 0; i < seg; i++) {
    const a = (Math.PI * i) / seg,
      b = (Math.PI * (i + 1)) / seg,
      inn = (t) => [Math.cos(t) * 1.45, 1.5 + Math.sin(t) * 1.3],
      out = (t) => [Math.cos(t) * 2.15, 1.5 + Math.sin(t) * 2],
      ia = inn(a),
      ib = inn(b),
      oa = out(a),
      ob = out(b);
    face(o, 'trim', [q(...ia), q(...ib), q(...ob), q(...oa)], [u[0], 0, u[1]]);
    face(o, 'stone', [q(...ia), q(...ib), q(...ib, -3), q(...ia, -3)]);
  }
  channel(o, 'stone', exit, O.path.at(-1), 2.9, 0.3, 0.3, 0.4);
  partEvidence.push({
    part: 'whole-intrinsic-overflow-stepped-spillway-and-low-level-outlet',
    weirWidth: 20,
    steps: n,
    nativeDrainageControls: path.length,
  });
}
export function buildHouse(o, _frame, lod = 3) {
  partEvidence.length = 0;
  windowEvidence.length = 0;
  body(o, lod);
  crest(o, lod);
  pavilion(o, lod);
  spillway(o, lod);
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/u1/u1j/eschbach_dam',
  camera = [-145, 95, -155],
  look = [0, 12, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Eschbach Dam, Remscheid (original design circa1892)',
  wikidataId: 'Q896077',
  cell: 'u1/u1j',
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
  portableGroundY: -2.1,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    far: 2500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_limestone_raw',
    'metal_copper',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'whole-curved-dam-pavilion-spillway-and-outlet', position: camera, lookAt: look },
    {
      name: 'corbel-crest-arcade-and-octagonal-valve-pavilion',
      position: [-30, 34, -17],
      lookAt: [4, 24, 14],
    },
    {
      name: 'upstream-batter-pavilion-pier-and-full-crest',
      position: [110, 80, 130],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-eschbach-dam-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry under repository license. Sole imagery exact original1891Prometheus issue71 PDF, primary Silesian Digital Library explicit item-specific publicdomain statement, original title/section/siteplan/proposed Remscheid view personally inspected. Editor credited aseditor; individual illustrator not invented. Qualla40families screened first; questionable postcards and attribution-only modern photographs unused. Original25mgravity-section and full native54control OSMdam106995946/Q896077 plan underODbL, intrinsic spillway/outlet alignments. All historic grade/registration/hidden sections/asbuilt continuity/ornament/finish estimates explicit. No reservoir/remoteworks/landscape/photo textures; source field and all mainparameters fixed before geometry.',
};
