/** Whole four-bastion fortress from native outer/courtyard/range controls. */
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
  n = JSON.parse(fs.readFileSync(new URL('../native-controls.json', import.meta.url))),
  { floorY: F, architecturalSections: A } = p.parameters;
const C = {
  stone: rgb('8c8873'),
  cordon: rgb('c5bba0'),
  lime: rgb('e2dfd0'),
  roof: rgb('c5bba7'),
  earth: rgb('b6a88b'),
  iron: rgb('353b3a'),
};
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
  cordon: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.93, metallic: 0 },
  earth: { slot: 'wall', graph: 'earth_rammed', roughness: 1, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.35 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  norm = (v) => {
    const l = Math.hypot(...v);
    return v.map((x) => x / l);
  },
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  lift = (q, y) => [q[0], y, q[1]],
  rect = (c, u, w, l) => {
    const v = [-u[1], u[0]];
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => c.map((x, k) => x + (u[k] * a * l) / 2 + (v[k] * b * w) / 2));
  };
export const partEvidence = [],
  doorEvidence = [],
  stairEvidence = [],
  cannonEvidence = [];
function T(o, k, q, v, col = C[k]) {
  q = q.map((a) => [a[0], a[1] + F, a[2]].map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (v && dot(cr, v) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
}
function Q(o, k, q, v, col) {
  T(o, k, q.slice(0, 3), v, col);
  T(o, k, [q[0], q[2], q[3]], v, col);
}
function cap(o, k, r, y, holes = [], up = 1) {
  const rs = [r, ...holes],
    points = rs.flat(),
    tri = ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      holes.map((h) => h.map((q) => new Vector2(...q))),
    );
  for (const t of tri)
    T(
      o,
      k,
      t.map((i) => lift(points[i], typeof y === 'function' ? y(points[i]) : y)),
      [0, up, 0],
    );
}
function solid(o, k, r, y, Y) {
  const s = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [lift(a, y), lift(b, y), lift(b, Y), lift(a, Y)],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
    );
  }
  cap(o, k, r, Y);
  cap(o, k, r, y, [], -1);
}
export function inset(r, d) {
  const s = Math.sign(area(r));
  return r.map((q, i) => {
    const a = norm(sub(q, r[(i + r.length - 1) % r.length])),
      b = norm(sub(r[(i + 1) % r.length], q)),
      u = [-a[1] * s, a[0] * s],
      v = [-b[1] * s, b[0] * s],
      h = d / (1 + dot(u, v));
    return q.map((x, k) => x + (u[k] + v[k]) * h);
  });
}
const top = inset(n.outer, A.batter),
  parapetInner = inset(n.outer, A.batter + A.parapetWidth),
  H = A.rampartHeight,
  entryU = norm(sub(n.inner[5], n.inner[4])),
  entryIn = n.northEntryInner.map((v, k) => v + entryU[k] * A.entryInnerOffset),
  entryMid = mix(n.northEntryOuter, entryIn, 0.5).map((v, k) => v + entryU[k] * 1.2),
  entryPath = [n.northEntryOuter, entryMid, entryIn];
export const fortProfiles = { outer: n.outer, top, inner: n.inner, parapetInner, entryPath };
function localBeam(o, k, a, b, w, d = w) {
  beam(
    o,
    k,
    a.map((x, i) => (i === 1 ? x + F : x)),
    b.map((x, i) => (i === 1 ? x + F : x)),
    w,
    d,
    C[k],
  );
}
function ringWalls(o, k, base, roof, y, Y, inner = false, gate = -1, lod = 3) {
  const sign = Math.sign(area(base)) * (inner ? -1 : 1);
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length,
      a = base[i],
      b = base[j],
      u = norm(sub(b, a)),
      L = Math.hypot(...sub(b, a)),
      v = [sign * u[1], 0, -sign * u[0]],
      point = (t, h) => lift(mix(mix(a, b, t), mix(roof[i], roof[j], t), (h - y) / (Y - y)), h),
      gateCenter = inner ? 0.5 + A.entryInnerOffset / L : 0.5,
      half = A.entryWidth / L / 2;
    if (i !== gate) {
      Q(o, k, [point(0, y), point(1, y), point(1, Y), point(0, Y)], v);
      continue;
    }
    Q(
      o,
      k,
      [point(0, y), point(gateCenter - half, y), point(gateCenter - half, Y), point(0, Y)],
      v,
    );
    Q(
      o,
      k,
      [point(gateCenter + half, y), point(1, y), point(1, Y), point(gateCenter + half, Y)],
      v,
    );
    const segments = [4, 8, 12, 16][lod];
    for (let z = 0; z < segments; z++) {
      const a = z / segments,
        b = (z + 1) / segments,
        low = (t) =>
          A.entryArchSpring + A.entryArchRise * Math.sqrt(Math.max(0, 1 - Math.pow(t * 2 - 1, 2))),
        s = gateCenter - half + 2 * half * a,
        t = gateCenter - half + 2 * half * b;
      Q(o, k, [point(s, low(a)), point(t, low(b)), point(t, Y), point(s, Y)], v);
    }
  }
}
function entryTunnel(o, lod) {
  const sides = [4, 8, 12, 16][lod],
    w = A.entryWidth / 2;
  for (let i = 0; i < entryPath.length - 1; i++) {
    const a = entryPath[i],
      b = entryPath[i + 1],
      u = norm(sub(b, a)),
      v = [u[1], -u[0]],
      at = (q, x, y) => [q[0] + v[0] * x, y, q[1] + v[1] * x];
    for (const s of [-1, 1])
      Q(
        o,
        'stone',
        [
          at(a, s * w, 0),
          at(b, s * w, 0),
          at(b, s * w, A.entryArchSpring),
          at(a, s * w, A.entryArchSpring),
        ],
        [-v[0] * s, 0, -v[1] * s],
      );
    for (let j = 0; j < sides; j++) {
      const t0 = (j * Math.PI) / sides,
        t1 = ((j + 1) * Math.PI) / sides,
        x0 = -w * Math.cos(t0),
        x1 = -w * Math.cos(t1),
        y0 = A.entryArchSpring + A.entryArchRise * Math.sin(t0),
        y1 = A.entryArchSpring + A.entryArchRise * Math.sin(t1);
      Q(o, 'stone', [at(a, x0, y0), at(b, x0, y0), at(b, x1, y1), at(a, x1, y1)], [0, -1, 0]);
    }
    Q(
      o,
      'earth',
      [at(a, -w, 0.015), at(b, -w, 0.015), at(b, w, 0.015), at(a, w, 0.015)],
      [0, 1, 0],
    );
  }
  const a = n.outer[17],
    b = n.outer[18],
    u = norm(sub(b, a)),
    v = norm(sub(n.northEntryOuter, entryMid)),
    c = n.northEntryOuter;
  for (const s of [-1, 1])
    localBeam(
      o,
      'cordon',
      [c[0] + u[0] * s * (w + 0.2) + v[0] * 0.09, 0, c[1] + u[1] * s * (w + 0.2) + v[1] * 0.09],
      [
        c[0] + u[0] * s * (w + 0.2) + v[0] * 0.09,
        A.entryArchSpring,
        c[1] + u[1] * s * (w + 0.2) + v[1] * 0.09,
      ],
      0.3,
    );
  for (let j = 0; j < sides; j++) {
    const t0 = (j * Math.PI) / sides,
      t1 = ((j + 1) * Math.PI) / sides,
      at = (t) => [
        c[0] - u[0] * (w + 0.18) * Math.cos(t) + v[0] * 0.1,
        A.entryArchSpring + (A.entryArchRise + 0.15) * Math.sin(t),
        c[1] - u[1] * (w + 0.18) * Math.cos(t) + v[1] * 0.1,
      ];
    localBeam(o, 'cordon', at(t0), at(t1), 0.3);
  }
}
function cordon(o, lod) {
  if (lod === 0) return;
  const q = inset(n.outer, (A.batter * (A.cordonY - A.baseY)) / (H - A.baseY) - 0.1),
    segments = [0, 4, 6, 8][lod];
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      u = norm(sub(b, a)),
      v = [u[1], -u[0]],
      at = (r, t) => [
        r[0] + v[0] * A.cordonRadius * Math.cos(t),
        A.cordonY + A.cordonRadius * Math.sin(t),
        r[1] + v[1] * A.cordonRadius * Math.cos(t),
      ];
    for (let j = 0; j < segments; j++) {
      const t = (j * 2 * Math.PI) / segments,
        T = ((j + 1) * 2 * Math.PI) / segments;
      Q(
        o,
        'cordon',
        [at(a, t), at(b, t), at(b, T), at(a, T)],
        [v[0] * Math.cos(t), Math.sin(t), v[1] * Math.cos(t)],
      );
    }
  }
}
function wallPatch(o, a, b, i) {
  const u = norm(sub(b, a)),
    s = Math.sign(area(n.outer)),
    v = [s * u[1], -s * u[0]],
    L = Math.hypot(...sub(b, a));
  if (L < 9) return;
  const start = 0.13 + 0.07 * Math.sin(i * 3),
    end = 0.72 + 0.1 * Math.cos(i * 2),
    low = 0.4 + 0.2 * Math.sin(i),
    high = 3.2 + 0.18 * Math.cos(i * 3),
    at = (t, y) => {
      const q = mix(a, b, t),
        insetAt = (A.batter * (y - A.baseY)) / (H - A.baseY);
      return [q[0] - v[0] * insetAt + v[0] * 0.025, y, q[1] - v[1] * insetAt + v[1] * 0.025];
    };
  if (i !== 17)
    Q(
      o,
      'lime',
      [at(start, low), at(end, low + 0.16), at(end - 0.04, high), at(start + 0.03, high - 0.15)],
      [v[0], 0, v[1]],
      rgb('a7a18d'),
    );
}
function rampart(o, lod) {
  ringWalls(o, 'stone', n.outer, top, A.baseY, H, false, 17, lod);
  ringWalls(o, 'stone', n.inner, n.inner, A.baseY, H, true, 4, lod);
  cap(o, 'earth', top, H, [n.inner]);
  cap(o, 'stone', n.outer, A.baseY, [n.inner], -1);
  ringWalls(o, 'stone', top, top, H, H + A.parapetHeight);
  ringWalls(o, 'stone', parapetInner, parapetInner, H, H + A.parapetHeight, true);
  cap(o, 'stone', top, H + A.parapetHeight, [parapetInner]);
  cordon(o, lod);
  if (lod >= 2)
    for (let i = 0; i < n.outer.length; i++)
      wallPatch(o, n.outer[i], n.outer[(i + 1) % n.outer.length], i);
}
function range(o, house, index, lod) {
  const r = house.outline,
    rear = [r[0], r[1]],
    u = norm(sub(rear[1], rear[0])),
    distance = (q) => Math.abs((q[0] - rear[0][0]) * u[1] - (q[1] - rear[0][1]) * u[0]),
    D = Math.max(...r.map(distance)),
    height = (q) => A.rangeRear - ((A.rangeRear - A.rangeFront) * distance(q)) / D,
    s = Math.sign(area(r)),
    frontEdges = index === 0 ? [2, 4, 6] : [2];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      v = [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
      len = Math.hypot(...sub(b, a)),
      at = (t, y) => lift(mix(a, b, t), y),
      count = frontEdges.includes(i) ? Math.max(1, Math.floor(len / 7.5)) : 0;
    if (!count || !lod) {
      Q(o, 'lime', [at(0, 0), at(1, 0), at(1, height(b)), at(0, height(a))], v);
      continue;
    }
    const centers = Array.from({ length: count }, (_, j) => (j + 0.5) / count),
      half = 0.6 / len;
    let last = 0;
    for (const t of centers) {
      const left = t - half,
        right = t + half;
      Q(
        o,
        'lime',
        [
          at(last, 0),
          at(left, 0),
          at(left, height(mix(a, b, left))),
          at(last, height(mix(a, b, last))),
        ],
        v,
      );
      Q(
        o,
        'lime',
        [
          at(left, 2.25),
          at(right, 2.25),
          at(right, height(mix(a, b, right))),
          at(left, height(mix(a, b, left))),
        ],
        v,
      );
      const V = norm(v),
        c = mix(a, b, t),
        back = c.map((x, k) => x - V[k === 0 ? 0 : 2] * 0.22),
        q0 = mix(a, b, left),
        q1 = mix(a, b, right),
        b0 = q0.map((x, k) => x - V[k === 0 ? 0 : 2] * 0.22),
        b1 = q1.map((x, k) => x - V[k === 0 ? 0 : 2] * 0.22);
      Q(o, 'iron', [lift(b0, 0), lift(b1, 0), lift(b1, 2.25), lift(b0, 2.25)], v, rgb('3c443c'));
      for (const [x, y] of [
        [q0, b0],
        [b1, q1],
      ])
        Q(o, 'lime', [lift(x, 0), lift(y, 0), lift(y, 2.25), lift(x, 2.25)], null);
      Q(o, 'lime', [lift(q0, 2.25), lift(q1, 2.25), lift(b1, 2.25), lift(b0, 2.25)], [0, -1, 0]);
      doorEvidence.push({ range: house.id, edge: i, center: c, recess: 0.22, height: 2.25 });
      last = right;
      void back;
    }
    Q(o, 'lime', [at(last, 0), at(1, 0), at(1, height(b)), at(last, height(mix(a, b, last)))], v);
  }
  cap(o, 'roof', r, (q) => height(q) + 0.08);
  cap(o, 'lime', r, 0, [], -1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    localBeam(o, 'cordon', lift(a, height(a) + 0.04), lift(b, height(b) + 0.04), 0.12);
  }
}
const courtCenter = n.inner.reduce((s, q) => s.map((v, k) => v + q[k] / n.inner.length), [0, 0]);
function well(o, lod) {
  const sides = [6, 8, 12, 16][lod],
    r = A.wellRadius,
    R = A.wellInnerRadius,
    at = (s, y, i) => [
      courtCenter[0] + s * Math.cos((i * 2 * Math.PI) / sides),
      y,
      courtCenter[1] + s * Math.sin((i * 2 * Math.PI) / sides),
    ];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides,
      v = [
        Math.cos(((i + 0.5) * 2 * Math.PI) / sides),
        0,
        Math.sin(((i + 0.5) * 2 * Math.PI) / sides),
      ];
    Q(o, 'cordon', [at(r, 0, i), at(r, 0, j), at(r, A.wellHeight, j), at(r, A.wellHeight, i)], v);
    Q(
      o,
      'stone',
      [at(R, -0.35, i), at(R, A.wellHeight, i), at(R, A.wellHeight, j), at(R, -0.35, j)],
      v.map((x) => -x),
    );
    Q(
      o,
      'cordon',
      [
        at(R, A.wellHeight, i),
        at(r, A.wellHeight, i),
        at(r, A.wellHeight, j),
        at(R, A.wellHeight, j),
      ],
      [0, 1, 0],
    );
  }
  cap(
    o,
    'iron',
    Array.from({ length: sides }, (_, i) => [
      courtCenter[0] + R * Math.cos((i * 2 * Math.PI) / sides),
      courtCenter[1] + R * Math.sin((i * 2 * Math.PI) / sides),
    ]),
    -0.35,
  );
}
// Flights finish on the actual courtyard retaining edge and start inside the court.
// This attaches their fixed rise/run to the rampart without changing either datum.
export const stairPaths = [
  [7, 8, 0.36],
  [4, 5, 0.82],
].map(([i, j, t]) => {
  const edge = norm(sub(n.inner[j], n.inner[i])),
    s = Math.sign(area(n.inner)),
    u = [s * edge[1], -s * edge[0]],
    boundary = mix(n.inner[i], n.inner[j], t),
    end = boundary.map((v, k) => v + u[k] * 0.25);
  return {
    a: end.map((v, k) => v - u[k] * A.stairRun * A.stairCount),
    u,
    boundary,
    end,
  };
});
function stairs(o, lod) {
  for (let s = 0; s < stairPaths.length; s++) {
    const a = stairPaths[s].a,
      u = stairPaths[s].u,
      count = [6, 12, 24, 24][lod],
      run = (A.stairRun * A.stairCount) / count;
    for (let j = 0; j < count; j++) {
      const c = a.map((v, k) => v + u[k] * (j + 0.5) * run);
      solid(o, 'cordon', rect(c, u, A.stairWidth, run + 0.008), -0.02, ((j + 1) * H) / count);
    }
    stairEvidence.push({
      index: s,
      count,
      totalRise: H,
      run: A.stairRun * A.stairCount,
      first: a,
      last: a.map((v, k) => v + u[k] * A.stairRun * A.stairCount),
    });
  }
}
function cannon(o, c, lod) {
  let best = { d: Infinity, u: [1, 0] };
  for (let i = 0; i < n.outer.length; i++) {
    const a = n.outer[i],
      b = n.outer[(i + 1) % n.outer.length],
      v = sub(b, a),
      t = Math.max(0, Math.min(1, dot(sub(c.point, a), v) / dot(v, v))),
      q = mix(a, b, t),
      d = Math.hypot(...sub(c.point, q));
    if (d < best.d) best = { d, u: norm(sub(q, c.point)) };
  }
  const u = best.u,
    v = [-u[1], u[0]],
    at = (x, y, z) => [c.point[0] + u[0] * x + v[0] * z, H + y, c.point[1] + u[1] * x + v[1] * z];
  if (!lod) {
    localBeam(o, 'iron', at(-1.1, 0.65, 0), at(1.5, 0.78, 0), 0.3);
    solid(o, 'iron', rect(c.point, u, 0.62, 1.4), H + 0.05, H + 0.4);
  } else {
    const sides = [6, 8, 12, 16][lod],
      rings = [
        [-1.05, 0.2],
        [0.25, 0.2],
        [1.4, 0.16],
      ],
      point = (j, i, inner = false) => {
        const [x, r] = rings[j],
          t = (i * 2 * Math.PI) / sides,
          R = inner ? 0.08 : r;
        return at(x, 0.72 + x * 0.045 + R * Math.sin(t), R * Math.cos(t));
      };
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < sides; i++)
        Q(
          o,
          'iron',
          [point(j - 1, i), point(j - 1, (i + 1) % sides), point(j, (i + 1) % sides), point(j, i)],
          [
            v[0] * Math.cos(((i + 0.5) * 2 * Math.PI) / sides),
            Math.sin(((i + 0.5) * 2 * Math.PI) / sides),
            v[1] * Math.cos(((i + 0.5) * 2 * Math.PI) / sides),
          ],
        );
    for (let i = 1; i < sides - 1; i++)
      T(o, 'iron', [point(0, 0), point(0, i), point(0, i + 1)], [-u[0], -0.045, -u[1]]);
    for (let i = 0; i < sides; i++) {
      Q(
        o,
        'iron',
        [
          point(2, i),
          point(2, (i + 1) % sides),
          point(2, (i + 1) % sides, true),
          point(2, i, true),
        ],
        lift(u, 0),
      );
      const q = point(2, i, true),
        Q1 = point(2, (i + 1) % sides, true),
        b = q.map((x, k) => x - (k === 0 ? u[0] : k === 2 ? u[1] : 0) * 0.25),
        B = Q1.map((x, k) => x - (k === 0 ? u[0] : k === 2 ? u[1] : 0) * 0.25);
      Q(
        o,
        'iron',
        [q, Q1, B, b],
        [
          -v[0] * Math.cos(((i + 0.5) * 2 * Math.PI) / sides),
          -Math.sin(((i + 0.5) * 2 * Math.PI) / sides),
          -v[1] * Math.cos(((i + 0.5) * 2 * Math.PI) / sides),
        ],
      );
    }
    for (const z of [-0.31, 0.31]) {
      const cc = c.point.map((x, k) => x + v[k] * z);
      solid(o, 'iron', rect(cc, u, 0.12, 1.4), H + 0.06, H + 0.45);
    }
    localBeam(o, 'iron', at(0, 0.4, -0.38), at(0, 0.4, 0.38), 0.12);
  }
  cannonEvidence.push({ id: c.id, point: c.point, baseY: H, axis: u });
}
export function buildFortOrange(target, _frame, lod = 3) {
  for (const a of [partEvidence, doorEvidence, stairEvidence, cannonEvidence]) a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...args) {
        count++;
        target.addTriangle(...args);
      },
      addQuad(k, ref, q, v, uv, col) {
        o.addTriangle(k, ref, q.slice(0, 3), v, uv.slice(0, 3), col);
        o.addTriangle(k, ref, [q[0], q[2], q[3]], v, [uv[0], uv[2], uv[3]], col);
      },
      addConvexPolygon(k, ref, q, v, uv, col) {
        for (let i = 1; i < q.length - 1; i++) {
          const r = [q[0], q[i], q[i + 1]];
          o.addTriangle(k, ref, r, v, r.map(uv), col);
        }
      },
    },
    part = (name, fn) => {
      const k = count;
      fn();
      partEvidence.push({ name, triangles: count - k });
    };
  part(
    'whole-native20-control-four-bastion-scarp-open10-control-courtyard-and-continuous-parapet',
    () => rampart(o, lod),
  );
  part('estimated-open-curved-north-entry-and-recessed-barrel-vault', () => entryTunnel(o, lod));
  for (let i = 0; i < n.houses.length; i++)
    part(`whole-native-intrinsic-one-storey-range-${n.houses[i].id}`, () =>
      range(o, n.houses[i], i, lod),
    );
  part('intrinsic-courtyard-floor-and-open-well-original-section', () => {
    solid(o, 'earth', n.inner, -0.12, 0);
    well(o, lod);
  });
  part('two-original-rampart-access-flights', () => stairs(o, lod));
  for (const c of n.cannons) part(`survey-native-cannon-${c.id}`, () => cannon(o, c, lod));
}
export const fortOrangeSkyline = (o) => buildFortOrange(o, null, 0),
  fortOrangeDistrict = (o) => buildFortOrange(o, null, 1),
  fortOrangeStreet = (o) => buildFortOrange(o, null, 2),
  fortOrangeCloseup = (o) => buildFortOrange(o, null, 3);
export const fortOrangeModel = {
  id: 'fort_orange_dutch_brazil',
  key: 'fort_orange_dutch_brazil',
  cell: '7n/7nx',
  title: 'Fort Orange — Forte de Santa Cruz de Itamaracá',
  wikidataId: 'Q1438646',
  category: 'fort',
  recipe: 'fort-orange-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildFortOrange,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole surviving native four-bastion fortress:20outer/10courtyard controls, both8/4controlintrinsic one-storey ranges, battered masonry scarp/roundedcordon/plainparapet, open estimated northentry/barrelvault, courtyard/well/two accessflights and six actual survey-mapped cannon positions. Exact cleared published Qualla closewall original and preserved samephotographerPD-self release; no source pixels embedded. Whole native plan retained; unobserved roof/door/section/contact details are explicit original medium-fi estimates.',
  camera: [-185, 115, -190],
  lookAt: [0, F + 2, 0],
  portableGroundY: F - 0.35,
  mediumFiContext: {
    scale: 1.65,
    groundY: F - 0.35,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    far: 2500,
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_limestone_raw',
    'plaster_lime',
    'tile_flat',
    'earth_rammed',
    'metal_painted',
  ],
  groundCutout: {
    outline: [...n.outer, n.outer[0]],
    basis:
      'Exact physical fort envelope including modeled intrinsic courtyardfloor and manmade rampartfill, never surrounding roads/beach/hotel/naturalterrain. Every original source elevation byte retained.',
  },
  qaCameras: [
    {
      name: 'whole-four-bastion-envelope-and-open-courtyard',
      position: [-155, 130, -165],
      lookAt: [0, F + 1, 0],
    },
    { name: 'exact-native-whole-plan-and-two-ranges', position: [0, 245, 0.1], lookAt: [0, F, 0] },
    {
      name: 'north-open-entry-cordon-and-scarp',
      position: [n.northEntryOuter[0] - 7, F + 5, n.northEntryOuter[1] - 19],
      lookAt: [n.northEntryOuter[0], F + 1.8, n.northEntryOuter[1]],
    },
    {
      name: 'courtyard-well-and-intrinsic-ranges',
      position: [courtCenter[0] - 27, F + 13, courtCenter[1] - 32],
      lookAt: [courtCenter[0] + 8, F + 1.5, courtCenter[1] + 5],
    },
    {
      name: 'six-survey-mapped-artillery-and-bastion',
      position: [n.cannons[2].point[0] - 5, F + H + 3.8, n.cannons[2].point[1] - 7],
      lookAt: [n.cannons[2].point[0], F + H + 0.5, n.cannons[2].point[1]],
    },
    {
      name: 'two-access-flights-treads-and-rampart-landings',
      position: [-4, F + 20, 9],
      lookAt: [-29, F + 2, -13],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-fort-${reviewLod}`,
    position: [-155, 130, -165],
    lookAt: [0, F + 1, 0],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/fort-orange-runtime-overlay.mjs',
    level: 'skyline',
    export: 'fortOrangeSkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: {
      district: { export: 'fortOrangeDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'fortOrangeStreet', errorMeters: 0.06, surfaces },
      closeup: { export: 'fortOrangeCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Whole native fort footprint and both ranges are retained, with true open courtyard/entry/well and six mapped cannons. Accepted photo is only a close exteriorwall view. Hidden roof form/material, inner doors, well/steps/entrance locations, repairedplaster pattern and cannon orientation are explicit original medium-fi estimates, not photogrammetry or a complete photographic survey. No invented inscriptions/sign art/heraldic relief or unobserved sentry towers. Inner partitions/dungeons/chapel fixtures and movable extra artillery not represented as exterior structures.',
    'Original sourcefield/frame/floor/mainsections frozen before geometry. Source heights are unclassified and include possible fort/canopy signals; exact terrain/entry threshold/contact/current repairs remain unverified. Only physical fort envelope masked, geographicpreview/replacementfalse. Source imagery remains provenance only, no photographicpixels embedded.',
  ],
};
