/** Full pavilion and open upper loggias in the fixed native geographic frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = {
    brick: rgb('d1c0ae'),
    wall: rgb('e8e0d3'),
    stone: rgb('e7e0d3'),
    dark: rgb('18252d'),
    metal: rgb('303c4d'),
  },
  railColor = rgb('aaa28c');
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.9, metallic: 0 },
  dark: { slot: 'trim', graph: 'wood_plain', roughness: 0.65, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.3 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  columnEvidence = [],
  roofEvidence = [],
  stairEvidence = [],
  railEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  triangulate = (r, holes = []) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      holes.map((r) => r.map((q) => new Vector2(...q))),
    );
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]],
  native = frame.features[0].outline.slice(0, -1).map((q) => [dot(q, U), dot(q, V)]);
function T(o, k, q, n, col = C[k]) {
  q = q.map((q) => toWorld(q).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, a, b, w, d, col = C[k]) {
  if (Math.hypot(...sub(b, a)) > 1e-6) beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function cap(o, k, r, y, up = true, col = C[k]) {
  for (const ix of triangulate(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, { top = true, bottom = false, col = C[k] } = {}) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
      col,
    );
  }
  if (top) cap(o, k, r, Y, true, col);
  if (bottom) cap(o, k, r, y, false, col);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  center = (r) => [0, 1].map((k) => r.reduce((s, q) => s + q[k], 0) / r.length);
function clip(r, k, value, greater) {
  const out = [],
    inside = (q) => (greater ? q[k] >= value : q[k] <= value);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      I = inside(a),
      J = inside(b);
    if (I) out.push(a);
    if (I !== J) {
      const t = (value - a[k]) / (b[k] - a[k]);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out.filter((q, i, a) => !i || Math.hypot(...sub(q, a[i - 1])) > 1e-7);
}
export const lowerBody = [
    ...native.slice(0, 10),
    [native[9][0], A.upperBodyFront],
    [native[10][0], A.upperBodyFront],
    ...native.slice(10),
  ],
  upperBody = clip(native, 1, A.upperBodyFront, false);
function panel(a, b, r) {
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    s = area(r) > 0 ? 1 : -1,
    n = [s * u[1], -s * u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    P: (t, y, v = 0) => [a[0] + u[0] * t + n[0] * v, y, a[1] + u[1] * t + n[1] * v],
  };
}
function plane(o, k, f, l, r, y, Y, v = 0, col = C[k]) {
  Q(o, k, [f.P(l, y, v), f.P(r, y, v), f.P(r, Y, v), f.P(l, Y, v)], [f.n[0], 0, f.n[1]], col);
}
function bar(o, k, f, l, r, y, Y, v, depth, col = C[k]) {
  const points = [f.P(l, 0, v), f.P(r, 0, v), f.P(r, 0, v - depth), f.P(l, 0, v - depth)];
  solid(
    o,
    k,
    points.map((q) => [q[0], q[2]]),
    y,
    Y,
    { col },
  );
}
function decoration(o, f, h, lod, upper) {
  if (lod < 2) return;
  const l = h.center - h.radius - 0.18,
    r = h.center + h.radius + 0.18,
    y = h.top + 0.13;
  if (!upper) {
    const peak = Math.min(y + 0.34, A.groundWallTop - 0.08);
    for (const [a, b] of [
      [
        [l, y],
        [h.center, peak],
      ],
      [
        [h.center, peak],
        [r, y],
      ],
      [
        [l, y],
        [r, y],
      ],
    ])
      B(o, 'stone', f.P(...a, 0.08), f.P(...b, 0.08), 0.09, 0.1);
  } else {
    for (const s of [-1, 1]) {
      const q = f.P(h.center + s * 0.22, y + 0.18, 0.065),
        r = f.P(h.center + s * 0.48, y + 0.1, 0.065),
        t = f.P(h.center + s * 0.3, y + 0.32, 0.065);
      T(o, 'stone', [q, r, t], [f.n[0], 0, f.n[1]], rgb('b6ac99'));
    }
    T(
      o,
      'stone',
      [
        f.P(h.center - 0.1, y + 0.12, 0.07),
        f.P(h.center + 0.1, y + 0.12, 0.07),
        f.P(h.center, y + 0.4, 0.07),
      ],
      [f.n[0], 0, f.n[1]],
    );
  }
}
function facade(o, k, f, holes, y, Y, lod, upper, index) {
  if (lod === 0) {
    plane(o, k, f, 0, f.L, y, Y);
    for (const h of holes)
      plane(o, 'dark', f, h.center - h.radius, h.center + h.radius, h.bottom, h.top, 0.012);
    return;
  }
  const outer = [
      [0, y],
      [f.L, y],
      [f.L, Y],
      [0, Y],
    ],
    cuts = holes.map((h) => [
      [h.center - h.radius, h.bottom],
      [h.center - h.radius, h.top],
      [h.center + h.radius, h.top],
      [h.center + h.radius, h.bottom],
    ]),
    all = [...outer, ...cuts.flat()];
  for (const ix of triangulate(outer, cuts))
    for (const v of [0, -A.wallDepth])
      T(
        o,
        k,
        ix.map((i) => f.P(all[i][0], all[i][1], v)),
        [f.n[0] * (v === 0 ? 1 : -1), 0, f.n[1] * (v === 0 ? 1 : -1)],
      );
  for (const h of holes) {
    const l = h.center - h.radius,
      r = h.center + h.radius,
      y = h.bottom,
      Y = h.top,
      D = -A.windowDepth;
    Q(o, k, [f.P(l, y), f.P(l, Y), f.P(l, Y, D), f.P(l, y, D)], [f.u[0], 0, f.u[1]]);
    Q(o, k, [f.P(r, y), f.P(r, y, D), f.P(r, Y, D), f.P(r, Y)], [-f.u[0], 0, -f.u[1]]);
    Q(o, k, [f.P(l, y), f.P(l, y, D), f.P(r, y, D), f.P(r, y)], [0, 1, 0]);
    Q(o, k, [f.P(l, Y), f.P(r, Y), f.P(r, Y, D), f.P(l, Y, D)], [0, -1, 0]);
    plane(o, 'dark', f, l, r, y, Y, D);
    if (lod === 1) {
      for (const [a, b] of [
        [l - 0.1, l],
        [r, r + 0.1],
      ])
        plane(o, 'stone', f, a, b, y - 0.1, Y + 0.1, 0.03);
      plane(o, 'stone', f, l, r, Y, Y + 0.12, 0.03);
      plane(o, 'stone', f, l, r, y - 0.1, y, 0.03);
    } else {
      for (const [a, b] of [
        [l - 0.1, l],
        [r, r + 0.1],
      ])
        bar(o, 'dark', f, a, b, y - 0.07, Y + 0.1, 0.025, 0.08);
      bar(o, 'dark', f, l, r, Y, Y + 0.13, 0.03, 0.1);
      bar(o, 'stone', f, l - 0.16, r + 0.16, y - 0.15, y - 0.05, 0.1, 0.2);
      bar(o, 'dark', f, h.center - 0.025, h.center + 0.025, y, Y, D + 0.04, 0.05);
      for (let yy = y + 0.5; yy < Y - 0.2; yy += 0.55)
        bar(o, 'dark', f, l, r, yy - 0.025, yy + 0.025, D + 0.04, 0.05);
      if (lod > 2 && h.kind === 'window')
        for (const t of [l + 0.16, r - 0.16])
          B(o, 'metal', f.P(t, y, D + 0.07), f.P(t, Y, D + 0.07), 0.025, 0.025);
    }
    decoration(o, f, h, lod, upper);
    openingEvidence.push({
      index,
      upper,
      a: f.a,
      b: f.b,
      u: f.u,
      normal: f.n,
      ...h,
      depth: A.windowDepth,
    });
  }
}
function body(o, lod, r, upper) {
  const y = upper ? A.upperFloor : A.platformTop,
    Y = upper ? A.upperWallTop : A.groundWallTop;
  for (let i = 0; i < r.length; i++) {
    const f = panel(r[i], r[(i + 1) % r.length], r),
      front =
        Math.abs(f.a[1] - A.upperBodyFront) < 1e-5 && Math.abs(f.b[1] - A.upperBodyFront) < 1e-5,
      holes = [];
    if (f.L > 1.8) {
      const N = front ? (upper ? 7 : 3) : Math.max(1, Math.floor(f.L / 3.3));
      for (let j = 0; j < N; j++) {
        const door = front && j === Math.floor(N / 2);
        holes.push({
          center: (f.L * (j + 0.5)) / N,
          radius: door ? A.doorWidth / 2 : Math.min(A.windowWidth / 2, (f.L / N) * 0.32),
          bottom: door ? y : upper ? A.upperWindowBottom : A.groundWindowBottom,
          top: door
            ? upper
              ? A.upperDoorTop
              : A.groundDoorTop
            : upper
              ? A.upperWindowTop
              : A.groundWindowTop,
          kind: door ? 'door' : 'window',
        });
      }
    }
    facade(o, upper ? 'wall' : 'brick', f, holes, y, Y, lod, upper, i);
  }
  cap(o, upper ? 'wall' : 'brick', r, Y);
}
function round(o, x, z, y, Y, r, R, N) {
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N,
      b = (2 * Math.PI * (i + 1)) / N,
      t = (a + b) / 2;
    Q(
      o,
      'stone',
      [
        [x + r * Math.cos(a), y, z + r * Math.sin(a)],
        [x + r * Math.cos(b), y, z + r * Math.sin(b)],
        [x + R * Math.cos(b), Y, z + R * Math.sin(b)],
        [x + R * Math.cos(a), Y, z + R * Math.sin(a)],
      ],
      [Math.cos(t), 0, Math.sin(t)],
    );
  }
}
function column(o, x, z, y, Y, lod, role) {
  if (lod === 0) {
    B(o, 'stone', [x, y, z], [x, Y, z], 0.28, 0.28);
    solid(o, 'stone', rect(x - 0.25, x + 0.25, z - 0.25, z + 0.25), Y - 0.15, Y);
  } else {
    const N = [4, 8, 12, 24][lod];
    solid(o, 'stone', rect(x - 0.24, x + 0.24, z - 0.24, z + 0.24), y, y + 0.22);
    round(o, x, z, y + 0.22, y + 0.34, 0.23, 0.16, N);
    round(o, x, z, y + 0.34, Y - 0.22, 0.16, 0.12, N);
    round(o, x, z, Y - 0.22, Y - 0.1, 0.13, 0.25, N);
    solid(o, 'stone', rect(x - 0.26, x + 0.26, z - 0.26, z + 0.26), Y - 0.1, Y);
    if (lod > 1)
      for (let j = 0; j < (lod === 2 ? 4 : 8); j++) {
        const a = (2 * Math.PI * j) / (lod === 2 ? 4 : 8);
        T(
          o,
          'stone',
          [
            [x + 0.15 * Math.cos(a), Y - 0.32, z + 0.15 * Math.sin(a)],
            [x + 0.25 * Math.cos(a + 0.25), Y - 0.12, z + 0.25 * Math.sin(a + 0.25)],
            [x + 0.25 * Math.cos(a - 0.25), Y - 0.12, z + 0.25 * Math.sin(a - 0.25)],
          ],
          [Math.cos(a), 0, Math.sin(a)],
        );
      }
  }
  columnEvidence.push({ point: [x, z], bottom: y, top: Y, role });
}
function roofs(o) {
  const front = clip(native, 1, A.roofPartitionFront, true),
    back = clip(native, 1, A.roofPartitionFront, false),
    left = clip(front, 0, native[10][0], false),
    right = clip(front, 0, native[9][0], true),
    central = clip(clip(front, 0, native[10][0], true), 0, native[9][0], false);
  for (const [label, r, bay] of [
    ['main-rear-low-roof', back, false],
    ['central-portico-low-roof', central, false],
    ['raised-left-polygonal-bay-roof', left, true],
    ['raised-right-polygonal-bay-roof', right, true],
  ]) {
    const y = bay ? A.bayFasciaBottom : A.centralFasciaBottom,
      Y = bay ? A.bayRoofTop : A.centralRoofTop;
    solid(o, 'stone', r, A.upperWallTop, y, { bottom: true });
    solid(o, 'metal', r, y, Y);
    roofEvidence.push({ label, boundary: r, ceiling: A.upperWallTop, top: Y, center: center(r) });
  }
}
function rails(o, lod) {
  const sign = area(native) > 0 ? 1 : -1;
  for (let i = 0; i < native.length; i++) {
    let a = native[i],
      b = native[(i + 1) % native.length];
    if (a[1] < A.upperBodyFront && b[1] < A.upperBodyFront) continue;
    if (a[1] < A.upperBodyFront || b[1] < A.upperBodyFront) {
      const t = (A.upperBodyFront - a[1]) / (b[1] - a[1]),
        q = a.map((v, k) => v + (b[k] - v) * t);
      if (a[1] < A.upperBodyFront) a = q;
      else b = q;
    }
    const f = panel(a, b, native),
      y = A.upperFloor + 0.12,
      Y = A.upperFloor + A.railingHeight;
    if (lod === 0) {
      plane(o, 'metal', f, 0, f.L, Y - 0.1, Y, 0.03, railColor);
      railEvidence.push({ index: i, a, b, height: Y, open: true });
      continue;
    }
    for (const yy of [y, Y])
      B(o, 'metal', f.P(0, yy, 0.025), f.P(f.L, yy, 0.025), 0.045, 0.055, railColor);
    const N = Math.max(1, Math.ceil(f.L / (lod === 1 ? 1.35 : 0.65)));
    for (let j = 0; j <= N; j++)
      B(
        o,
        'metal',
        f.P((f.L * j) / N, y, 0.025),
        f.P((f.L * j) / N, Y, 0.025),
        0.035,
        0.035,
        railColor,
      );
    if (lod === 2)
      for (let j = 0; j < N; j++)
        for (const s of [-1, 1])
          B(
            o,
            'metal',
            f.P((f.L * (j + (s < 0 ? 0 : 1))) / N, y + 0.1, 0.025),
            f.P((f.L * (j + (s < 0 ? 1 : 0))) / N, Y - 0.1, 0.025),
            0.025,
            0.025,
            railColor,
          );
    if (lod > 2)
      for (let j = 0; j < N; j++) {
        const c = (f.L * (j + 0.5)) / N,
          R = (f.L / N) * 0.36,
          ry = (Y - y) * 0.36;
        for (let k = 0; k < 12; k++) {
          const a = (2 * Math.PI * k) / 12,
            b = (2 * Math.PI * (k + 1)) / 12;
          B(
            o,
            'metal',
            f.P(c + R * Math.cos(a), (Y + y) / 2 + ry * Math.sin(a), 0.025),
            f.P(c + R * Math.cos(b), (Y + y) / 2 + ry * Math.sin(b), 0.025),
            0.025,
            0.025,
            railColor,
          );
        }
      }
    railEvidence.push({
      index: i,
      a,
      b,
      height: Y,
      open: true,
      panels: N,
      normal: [sign * f.u[1], -sign * f.u[0]],
    });
  }
}
export function buildAhmadShahiPavilion(target, _frame, lod = 3) {
  for (const a of [
    partEvidence,
    nativeEvidence,
    openingEvidence,
    columnEvidence,
    roofEvidence,
    stairEvidence,
    railEvidence,
  ])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(...a) {
        count += 2;
        target.addQuad(...a);
      },
      addConvexPolygon(...a) {
        count += a[2].length - 2;
        target.addConvexPolygon(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-twelve-control-foundation-and-upper-balcony-slab', () => {
    solid(o, 'stone', native, A.foundationBottom, A.platformTop);
    solid(o, 'stone', native, A.groundWallTop, A.upperFloor, { bottom: true });
    for (const q of native)
      nativeEvidence.push({ id: 330356349, point: toWorld([q[0], A.platformTop, q[1]]) });
  });
  part('whole-lower-brick-corner-bays-inset-entry-and-upper-loggia-body', () => {
    body(o, lod, lowerBody, false);
    body(o, lod, upperBody, true);
  });
  part('two-ground-and-nine-upper-classical-columns', () => {
    for (const x of [-2.8, 2.0])
      column(
        o,
        x,
        (native[9][1] + native[10][1]) / 2,
        A.platformTop,
        A.groundWallTop,
        lod,
        'ground-central-porch',
      );
    for (const i of [0, 1, 4, 6, 7, 8, 11])
      column(
        o,
        ...[native[i][0], native[i][1]],
        A.upperFloor,
        A.upperWallTop,
        lod,
        i === 4 ? 'upper-engaged-rear-corner' : 'upper-free-corner-bay',
      );
    for (const x of [-2.8, 2.0])
      column(
        o,
        x,
        (native[9][1] + native[10][1]) / 2,
        A.upperFloor,
        A.upperWallTop,
        lod,
        'upper-central-loggia',
      );
  });
  part('complete-low-central-and-raised-polygonal-bay-roofs', () => roofs(o));
  part('open-upper-loggia-lattice-and-oval-metal-railings', () => rails(o, lod));
  part('intrinsic-centered-front-stair-flight', () => {
    const center = (native[9][0] + native[10][0]) / 2,
      front = (native[9][1] + native[10][1]) / 2,
      N = A.stairCount;
    for (let j = 0; j < N; j++) {
      const z = front + j * A.stairTread,
        y = (A.platformTop * (N - j)) / N;
      solid(
        o,
        'stone',
        rect(center - A.stairWidth / 2, center + A.stairWidth / 2, z, z + A.stairTread),
        A.foundationBottom,
        y,
      );
      stairEvidence.push({ center, width: A.stairWidth, z, Z: z + A.stairTread, top: y });
    }
  });
}
export const ahmadShahiPavilionSkyline = (o) => buildAhmadShahiPavilion(o, null, 0),
  ahmadShahiPavilionDistrict = (o) => buildAhmadShahiPavilion(o, null, 1),
  ahmadShahiPavilionStreet = (o) => buildAhmadShahiPavilion(o, null, 2),
  ahmadShahiPavilionCloseup = (o) => buildAhmadShahiPavilion(o, null, 3);
export const ahmadShahiPavilionModel = {
  id: 'ahmad_shahi_pavilion',
  key: 'ahmad_shahi_pavilion',
  cell: 'tn/tnk',
  title: 'Ahmad Shahi Pavilion',
  wikidataId: 'Q5949128',
  category: p.category,
  recipe: 'ahmad-shahi-pavilion-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildAhmadShahiPavilion,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole AhmadShahiPavilion on actual12-control nativebuilding plan: two storeys, lowerbrick/polygonalcornerbays and insetcentralentry, pale upperbody behind openloggias, two ground/nine upperclassicalcolumns, dark recesseddoors/sash, patterned metalrailing, lowcentralroof and raisedpolygonalbayroofs, lowstoneplatform and centeredentrancesteps. ExactclearedpublishedDatabot2005PDoriginal first/only, nativecaption explicitlypavilion despiteSaabgheraniehPalace filename. Hiddenrear/currentcondition/roofdivisions/census/ornament are originalboundedestimates, notsurvey.',
  camera: toWorld([35, 22, 57]),
  lookAt: toWorld([0, 4.8, 0]),
  portableGroundY: F - 0.45,
  mediumFiContext: { cameraYaw: 0.25, groundY: F - 0.3 },
  embeddedCanonicalGraphs: [
    'brick',
    'plaster_lime',
    'stone_limestone_raw',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-principal-facade-corner-bays-and-two-storeys',
      position: toWorld([28, 17, 44]),
      lookAt: toWorld([0, 4.8, 0]),
    },
    {
      name: 'whole-twelve-control-pavilion-roof-and-loggia-plan',
      position: toWorld([0, 75, 0.1]),
      lookAt: toWorld([0, 3, 0]),
    },
    {
      name: 'upper-open-loggias-classical-columns-and-patterned-railing',
      position: toWorld([14, 8.5, 22]),
      lookAt: toWorld([2, 6.5, 7.5]),
    },
    {
      name: 'inset-central-ground-entry-brick-bays-and-entrance-stairs',
      position: toWorld([0, 4.3, 20]),
      lookAt: toWorld([-0.4, 2.6, 6]),
    },
    {
      name: 'whole-rear-and-bounded-hidden-roof-sections',
      position: toWorld([-34, 20, -40]),
      lookAt: toWorld([0, 4, 0]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/ahmad-shahi-pavilion-runtime-overlay.mjs',
    level: 'skyline',
    export: 'ahmadShahiPavilionSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'ahmadShahiPavilionDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'ahmadShahiPavilionStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'ahmadShahiPavilionCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.dimensionBasis,
    p.sectionBasis,
    'Sole exactpublished2005Databotoriginal519x370/93243bytes, matching nativeSHA1/namedEnglishDatabotPD-user-w grant and publishedclearance. Nativecaption identifies AhmadShahiPavilion north ofSaabgheraniehPalace; the inheritedfilename is not subjectidentity. No neighboringpalace photo substituted, no external/questionablepixels, no source metadatarepair or policychange, no imagepixels embedded.',
    'Whole actual12control building/foundation/upperfloor; lowerfrontbody insetbehind porch and upperfrontbody clippedbehindopenloggias. Cornerbay/roofsubdivisions, rearwindowcensus/currentfinish/heights/finecapitals/motifs/railpattern/stepdimensions are originalboundedestimates from a singleold lowresolutionfrontview. No measured currentrear/interior survey. Oneuppercornercolumn is engaged with upperbody.',
    'Decorative pediments/floral motifs/capitals and oval/diagonal railing are original simplified geometry. Glass is closed opaque dark material. EntireNiavarangardens/trees/hedges/neighboringpalaces/interiors/landscape/sitepad excluded.',
    'Originalindependent256m129field/2rawtiles/nativeframe/floor/mainsections fixed beforegeometry. Exactfoundation/street/staircontactunverified; geographicpreview/replacementfalse. Flatstage andsyntheticneighbors are reviewfixtures.',
  ],
};
