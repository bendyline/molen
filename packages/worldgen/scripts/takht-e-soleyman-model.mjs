/** Takht-e Soleyman: mapped enclosure/lake and an individually authored ruin ensemble. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/tn/tn9/n0246_takht_e_soleyman/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.66, 0.6, 0.46],
  pale = [0.76, 0.7, 0.55],
  brick = [0.64, 0.47, 0.32];
const ground = [0.59, 0.55, 0.43],
  water = [0.08, 0.3, 0.32];
const base = 1.2;
const master = (o) => !o.detail,
  near = (o) => !['skyline', 'district'].includes(o.detail);
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const color = (c, t) => c.map((v) => v * t);
const face = (o, slot, p, c) => quad(o, slot, p, normalFor(...p), c);
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function ring(id) {
  const p = map.features.find((f) => f.id === `way/${id}`).points.map((p) => [...p]);
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop();
  return area(p) < 0 ? p.reverse() : p;
}
const enclosure = ring(203537193),
  lake = ring(314769016);
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b, y = base) =>
  frame(o, a[0], y, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
function cap(o, rings, y, slot, c) {
  const p = rings.flat(),
    holes = [];
  let count = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(count);
    count += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    o.addTriangle(
      slot,
      'palette:#ffffff',
      q,
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      c,
    );
  }
}
const rectangle = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function extrudeProfile(o, p, z0, z1, slot, c) {
  p = p.map((v) => [...v]);
  // Remove collinear samples before earcut: Float32 rotation can invert microscopic slivers.
  for (let changed = true; changed && p.length > 3; ) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-8) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (area(p) < 0) p = p.toReversed();
  const ix = earcut(p.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    for (const [z, sign] of [
      [z0, -1],
      [z1, 1],
    ]) {
      const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], z]);
      if (
        Math.abs(
          (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]),
        ) < 1e-7
      )
        continue;
      if (normalFor(...q)[2] * sign < 0) q.reverse();
      o.addTriangle(
        slot,
        'palette:#ffffff',
        q,
        [0, 0, sign],
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        c,
      );
    }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      slot,
      [
        [a[0], a[1], z0],
        [b[0], b[1], z0],
        [b[0], b[1], z1],
        [a[0], a[1], z1],
      ],
      c,
    );
  }
}
function heightAt(profile, x) {
  for (let i = 1; i < profile.length; i++)
    if (x <= profile[i][0]) {
      const a = profile[i - 1],
        b = profile[i];
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
  return profile.at(-1)[1];
}
/** Broken tops follow a reproducible profile; block skins add relief without embedded textures. */
function wall(o, a, b, h = 3, width = 2, seed = 0, slot = 'limestone', profile) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.05) return;
  const f = edgeFrame(o, a, b),
    n = Math.max(1, Math.ceil(len / (master(o) ? 2.5 : fine(o) ? 5 : near(o) ? 11 : 1000)));
  const top =
    profile ??
    Array.from({ length: n + 1 }, (_, i) => [
      (len * i) / n,
      h * (0.87 + (0.13 * ((i * 7 + seed * 3) % 11)) / 10),
    ]);
  extrudeProfile(
    f,
    [[0, 0], [len, 0], ...top.toReversed()],
    -width / 2,
    width / 2,
    slot,
    slot === 'brick' ? brick : stone,
  );
  if (!fine(o)) return;
  const course = slot === 'brick' ? 0.27 : 0.56,
    module = slot === 'brick' ? 0.56 : 1.18;
  // A subset of exposed stones remains at close-up; the source master has every course.
  for (let row = 0; row * course < h; row++)
    for (let k = 0; k < Math.ceil(len / module); k++) {
      if (!master(o) && (k + row * 3 + seed) % 20 !== 0) continue;
      const x0 = Math.max(0.04, (k - (row % 2) * 0.5) * module + 0.025),
        x1 = Math.min(len - 0.04, (k + 1 - (row % 2) * 0.5) * module - 0.025);
      if (x1 - x0 < 0.15) continue;
      const y0 = row * course + 0.035,
        y1 = Math.min(y0 + course - 0.065, heightAt(top, (x0 + x1) / 2) - 0.05);
      if (y1 - y0 < 0.08) continue;
      const c = color(
        slot === 'brick' ? brick : pale,
        0.91 + (0.13 * ((k * 3 + row * 7 + seed) % 17)) / 16,
      );
      for (const sign of [-1, 1]) {
        const z = sign * (width / 2 + 0.025),
          d = 0.06 + (0.08 * ((k * 5 + row + seed) % 7)) / 6;
        box(
          f,
          slot === 'brick' ? 'brick' : 'carved',
          [x0, y0, Math.min(z, z + sign * d)],
          [x1, y1, Math.max(z, z + sign * d)],
          c,
        );
      }
    }
}
function room(o, p, h = 2.5, width = 1.8, doors = [], seed = 0, slot = 'limestone') {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = doors.find((d) => d[0] === i);
    if (d) {
      const t = d[1] ?? 0.5,
        half = (d[2] ?? 2.2) / len / 2;
      const mix = (t) => a.map((v, j) => v + (b[j] - v) * t);
      wall(o, a, mix(t - half), h, width, seed + i, slot);
      wall(o, mix(t + half), b, h, width, seed + i + 1, slot);
    } else wall(o, a, b, h, width, seed + i, slot);
  }
}
function roughTop(o, ring, slot, c) {
  const center = ring.reduce((a, p) => a.map((v, i) => v + p[i] / ring.length), [0, 0, 0]);
  for (let i = 0; i < ring.length; i++) {
    const p = [center, ring[i], ring[(i + 1) % ring.length]];
    if (normalFor(...p)[1] < 0) p.reverse();
    o.addTriangle(
      slot,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      c,
    );
  }
}
function column(o, x, z, r, h, slot = 'carved', c = stone) {
  const sides = master(o) ? 20 : fine(o) ? 12 : near(o) ? 8 : 4;
  loft(
    o,
    slot,
    [
      radialRing(base, r, r, sides, [x, z]),
      radialRing(base + h, r * 0.96, r * 0.96, sides, [x, z]),
    ],
    c,
  );
  if (master(o))
    for (let y = 0.55; y < h - 0.25; y += 0.55)
      loft(
        o,
        slot,
        [
          radialRing(base + y, r * 1.008, r * 1.008, sides, [x, z]),
          radialRing(base + y + 0.045, r * 1.008, r * 1.008, sides, [x, z]),
        ],
        color(c, 0.85),
        { cap: false },
      );
}
function arch(o, width, spring, rise, thickness, depth, slot = 'brick') {
  const c = slot === 'brick' ? brick : pale,
    steps = master(o) ? 24 : fine(o) ? 16 : near(o) ? 10 : 6;
  box(o, slot, [-width / 2 - thickness, 0, -depth / 2], [-width / 2, spring, depth / 2], c);
  box(o, slot, [width / 2, 0, -depth / 2], [width / 2 + thickness, spring, depth / 2], c);
  for (let i = 0; i < steps; i++) {
    const gap = master(o) ? 0.007 : 0,
      a = Math.PI * (i / steps) + gap,
      b = Math.PI * ((i + 1) / steps) - gap;
    const point = (t, outer) => [
      (width / 2 + (outer ? thickness : 0)) * Math.cos(t),
      spring + (rise + (outer ? thickness : 0)) * Math.sin(t),
    ];
    extrudeProfile(
      o,
      [point(a, false), point(b, false), point(b, true), point(a, true)],
      -depth / 2,
      depth / 2,
      slot,
      color(c, 1 - (0.08 * (i % 3)) / 2),
    );
  }
}
const edges = enclosure.map((a, i) => {
  const b = enclosure[(i + 1) % enclosure.length];
  return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
});
const perimeter = edges.reduce((s, e) => s + e.len, 0);
function at(s) {
  s = ((s % perimeter) + perimeter) % perimeter;
  for (const e of edges) {
    if (s <= e.len)
      return {
        point: e.a.map((v, j) => v + ((e.b[j] - v) * s) / e.len),
        angle: Math.atan2(e.a[1] - e.b[1], e.b[0] - e.a[0]),
      };
    s -= e.len;
  }
  throw new Error('Invalid perimeter station');
}
function station(target) {
  let result = 0,
    best = Infinity,
    start = 0;
  for (const e of edges) {
    const t = Math.max(
      0,
      Math.min(
        1,
        ((target[0] - e.a[0]) * (e.b[0] - e.a[0]) + (target[1] - e.a[1]) * (e.b[1] - e.a[1])) /
          (e.len * e.len),
      ),
    );
    const p = e.a.map((v, j) => v + t * (e.b[j] - v)),
      d = Math.hypot(p[0] - target[0], p[1] - target[1]);
    if (d < best) {
      best = d;
      result = start + t * e.len;
    }
    start += e.len;
  }
  return result;
}
const gates = [
  { s: station([197, 18]), name: 'north', width: 6, h: 7.2 },
  { s: station([-199, 18]), name: 'new-south', width: 7, h: 3.6 },
  { s: station([-174, 108]), name: 'old-southeast', width: 5.6, h: 10.5 },
];
const distance = (a, b) => Math.min(Math.abs(a - b), perimeter - Math.abs(a - b));
// The tower count is documented; these perimeter stations are reconstructed, not surveyed.
const towers = [];
for (const g of gates) for (const sign of [-1, 1]) towers.push(g.s + sign * (g.width / 2 + 7));
for (let i = 0; towers.length < 38 && i < 80; i++) {
  const s = ((i + 0.42) * perimeter) / 38;
  if (s >= perimeter) continue;
  if (towers.every((v) => distance(((v % perimeter) + perimeter) % perimeter, s) > 18))
    towers.push(s);
}
if (towers.length !== 38) throw new Error('Takht enclosure must retain 38 tower stations');
function platform(o) {
  // Local contact slab, not the 60 m geological mound above the surrounding valley.
  for (const e of edges)
    face(
      o,
      'weathered',
      [
        [e.b[0], 0, e.b[1]],
        [e.a[0], 0, e.a[1]],
        [e.a[0], base, e.a[1]],
        [e.b[0], base, e.b[1]],
      ],
      ground,
    );
  cap(o, [enclosure, lake], base, 'weathered', ground);
  cap(o, [lake], base - 0.16, 'glass', water);
  if (o.detail === 'skyline') return;
  for (let i = 0; i < lake.length; i++) {
    const a = lake[i],
      b = lake[(i + 1) % lake.length];
    face(
      o,
      'travertine',
      [
        [a[0], base - 0.2, a[1]],
        [b[0], base - 0.2, b[1]],
        [b[0], base + 0.05, b[1]],
        [a[0], base + 0.05, a[1]],
      ],
      pale,
    );
  }
}
function fortification(o) {
  let start = 0;
  for (const [i, e] of edges.entries()) {
    const cuts = [
      start,
      start + e.len,
      ...gates
        .flatMap((g) => [g.s - g.width / 2, g.s + g.width / 2])
        .filter((s) => s > start && s < start + e.len),
    ].sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      const a = cuts[j - 1],
        b = cuts[j];
      if (gates.some((g) => distance((a + b) / 2, g.s) < g.width / 2)) continue;
      const point = (s) => e.a.map((v, k) => v + ((e.b[k] - v) * (s - start)) / e.len);
      const h = 4.6 + (2.1 * ((i * 3) % 7)) / 6;
      wall(o, point(a), point(b), h, 6.1, i);
    }
    start += e.len;
  }
  for (const [i, s] of towers.entries()) {
    const p = at(s).point,
      h = 5.3 + (2.8 * ((i * 7) % 13)) / 12,
      r = 5.7;
    const sides = master(o) ? 24 : fine(o) ? 16 : near(o) ? 8 : 4;
    const lower = radialRing(base, r, r, sides, p);
    const upper = radialRing(base + h, r * 0.91, r * 0.91, sides, p).map((v, j) => [
      v[0],
      v[1] - (near(o) ? (0.5 * ((j + i) % 4)) / 3 : 0),
      v[2],
    ]);
    loft(o, 'limestone', [lower, upper], color(stone, 0.94 + (0.09 * (i % 5)) / 4), { cap: false });
    roughTop(o, upper, 'limestone', stone);
    if (fine(o))
      for (let row = 0; row * 0.57 < h - 0.65; row++)
        for (let k = 0; k < sides; k++) {
          if (!master(o) && (row + k) % 4) continue;
          const a = (-2 * Math.PI * (k + (row % 2) * 0.5)) / sides,
            b = a - (2 * Math.PI) / sides + 0.012;
          const y = base + row * 0.57 + 0.025,
            rr = r * (1 - (0.09 * row * 0.57) / h) + 0.03;
          const p0 = [p[0] + rr * Math.cos(a), y, p[1] + rr * Math.sin(a)],
            p1 = [p[0] + rr * Math.cos(b), y, p[1] + rr * Math.sin(b)];
          face(
            o,
            'carved',
            [p0, p1, [p1[0], y + 0.5, p1[2]], [p0[0], y + 0.5, p0[2]]],
            color(pale, 0.91 + (0.1 * ((row + 3 * k) % 9)) / 8),
          );
        }
  }
  if (o.detail === 'skyline') return;
  for (const g of gates) {
    if (g.name === 'new-south') continue;
    const { point, angle } = at(g.s),
      f = frame(o, point[0], base, point[1], angle);
    arch(f, g.width, g.name === 'north' ? 1.9 : 2.6, g.width / 2, 1.05, 6.1, 'carved');
    const spring = g.name === 'north' ? 1.9 : 2.6,
      r = g.width / 2 + 1.05,
      steps = near(o) ? 12 : 6;
    const underside = Array.from({ length: steps + 1 }, (_, i) => {
      const t = Math.PI * (1 - i / steps);
      return [r * Math.cos(t), spring + r * Math.sin(t)];
    });
    extrudeProfile(f, [[-r, g.h], ...underside, [r, g.h]], -3.05, 3.05, 'limestone', stone);
    if (near(o) && g.name === 'old-southeast')
      for (let i = 0; i < 7; i++) {
        const ff = frame(f, (i - 3) * 0.92, 7.25, -3.13, Math.PI);
        arch(ff, 0.5, 0.7, 0.25, 0.15, 0.15, 'carved');
        face(
          ff,
          'recess',
          [
            [-0.24, 0, -0.025],
            [0.24, 0, -0.025],
            [0.24, 0.9, -0.025],
            [-0.24, 0.9, -0.025],
          ],
          [0.23, 0.21, 0.17],
        );
      }
  }
}
/** Coordinates reconstructed from Huff's phase plans; individual rooms remain roofless. */
function sanctuary(o) {
  const sky = o.detail === 'skyline';
  if (sky) {
    for (const [a, b, h, w] of [
      [[36, -46], [153, -46], 2.5, 3],
      [[153, -46], [153, 80], 2.7, 3],
      [[153, 80], [36, 80], 2.3, 3],
      [[36, -46], [36, -5], 3, 3],
      [[36, 6], [36, 80], 3.4, 3],
      [[75, 7], [75, 34], 6, 4],
      [[53, 7], [53, 34], 5, 4],
      [[53, 7], [75, 7], 5.5, 4],
      [[53, 34], [75, 34], 5, 4],
    ])
      wall(o, a, b, h, w);
    return;
  }
  // The large northern square and the smaller pilgrims' court (M) keep open centers.
  room(
    o,
    rectangle(36, -46, 153, 80),
    2.8,
    3.8,
    [
      [1, 0.48, 5],
      [3, 0.5, 9],
    ],
    11,
  );
  wall(o, [37, 1], [121, 1], 3.3, 3.7, 19);
  room(
    o,
    rectangle(80, 9, 117, 35),
    3.3,
    2.7,
    [
      [1, 0.5, 3.8],
      [3, 0.5, 5],
    ],
    30,
  );
  room(
    o,
    rectangle(117, 9, 124, 35),
    2.4,
    2.5,
    [
      [1, 0.5, 3.8],
      [3, 0.5, 3.8],
    ],
    34,
  );
  // Main cella A: four L-shaped corner piers, surrounding passage and open central square.
  const cx = 65,
    cz = 20,
    inner = 4.5,
    outer = 9.5;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx < 0 ? cx - outer : cx + inner,
        z = sz < 0 ? cz - outer : cz + inner;
      wall(o, [x, z], [x + 5, z], 5.4, 4, Math.round(x + z), 'brick');
      wall(o, [x + 2.5, z - 1.5], [x + 2.5, z + 3.5], 6.5, 4, Math.round(x + z) + 1, 'brick');
    }
  room(
    o,
    rectangle(51, 6, 79, 35),
    3.8,
    2.5,
    [
      [0, 0.5, 4.5],
      [1, 0.5, 4.5],
      [2, 0.5, 4.5],
      [3, 0.5, 4.5],
    ],
    42,
    'brick',
  );
  if (near(o))
    for (const a of [0, Math.PI / 2])
      arch(frame(o, cx, base, cz, a), 8, 2.4, 3.2, 1.05, 2.1, 'brick');
  // Royal approach / Ilkhanid stair, without a fictitious complete upper palace.
  wall(o, [36, 9], [51, 9], 4.1, 3, 54, 'brick');
  wall(o, [36, 31], [51, 31], 4.5, 3, 56, 'brick');
  if (near(o))
    for (let i = 0; i < 9; i++)
      box(
        o,
        'travertine',
        [36 + i * 1.25, base, 15],
        [37.25 + i * 1.25, base + 0.22 * (i + 1), 25],
        pale,
      );
  box(o, 'carved', [31, base, 13], [35, base + 1.5, 15.8], pale);
  if (near(o))
    for (let i = 0; i < 3; i++)
      box(
        o,
        'carved',
        [31 + i * 0.6, base, 12 - 1.0 + i * 0.3],
        [35, base + 0.4 * (i + 1), 12 + i * 0.3],
        pale,
      );
  // Cruciform chamber B and the eastern treasury/court group, not four repeated generic halls.
  const crossRoom = [
    [53, 43],
    [57, 43],
    [57, 39],
    [65, 39],
    [65, 43],
    [70, 43],
    [70, 52],
    [65, 52],
    [65, 57],
    [57, 57],
    [57, 52],
    [53, 52],
  ];
  room(o, crossRoom, 3.1, 2.1, [[0, 0.5, 2]], 64, 'brick');
  if (near(o)) {
    room(o, rectangle(59, 46, 60.73, 47.73), 0.33, 0.2, [[0, 0.5, 0.5]], 69, 'brick');
    for (const x of [58.5, 61.2])
      for (const z of [45.5, 48.3]) column(o, x, z, 0.16, 0.18, 'travertine', pale);
  }
  const rooms = [
    [39, 38, 50, 47, 2.1, 0],
    [39, 49, 50, 59, 2.6, 0],
    [39, 61, 51, 77, 2.3, 1],
    [53, 61, 70, 77, 3.0, 3],
    [73, 39, 80, 76, 2.0, 1],
    [82, 41, 96, 62, 3.5, 3],
    [82, 65, 96, 77, 2.3, 0],
    [99, 38, 108, 77, 2.7, 3],
    [111, 38, 119, 77, 2.0, 1],
    [121, 61, 131, 78, 1.8, 3],
    [133, 61, 145, 78, 1.2, 0],
  ];
  for (const [i, [x0, z0, x1, z1, h, door]] of rooms.entries())
    room(o, rectangle(x0, z0, x1, z1), h, 1.9, [[door, 0.5, 2.4]], 80 + i * 4);
  // PA/PB basilical halls west of the processional corridor: rectangular then round piers.
  room(
    o,
    rectangle(40, -30, 85, -4),
    3.3,
    2.4,
    [
      [0, 0.5, 4],
      [2, 0.5, 3],
    ],
    131,
  );
  wall(o, [64, -30], [64, -19], 2.6, 1.1, 136, 'brick');
  wall(o, [64, -15], [64, -4], 2.6, 1.1, 137, 'brick');
  if (near(o))
    for (const z of [-23, -11]) {
      for (const x of [46, 54, 61])
        box(o, 'carved', [x - 1, base, z - 1], [x + 1, base + 2.4 + (x % 3) * 0.3, z + 1], pale);
      for (const x of [70, 77, 83]) column(o, x, z, 1.25, 2.9 - (x % 3) * 0.4, 'carved', stone);
    }
  room(
    o,
    rectangle(88, -29, 98, -5),
    3,
    2.0,
    [
      [0, 0.5, 3],
      [2, 0.5, 3],
    ],
    141,
  );
  room(
    o,
    [
      [99, -26],
      [102, -26],
      [102, -29],
      [109, -29],
      [109, -25],
      [113, -25],
      [113, -16],
      [109, -16],
      [109, -12],
      [102, -12],
      [102, -16],
      [99, -16],
    ],
    3.5,
    2,
    [[0, 0.5, 2]],
    149,
  );
  if (near(o)) {
    box(o, 'brick', [104.5, base, -22.5], [106.13, base + 0.28, -20.87], brick);
    column(o, 105.3, -21.7, 0.325, 0.85, 'brick', brick);
  }
  // Distinct subsidiary chambers and western forecourt; heights are surviving-wall estimates.
  for (const [i, r] of [
    [40, -44, 61, -34],
    [64, -44, 82, -34],
    [86, -43, 95, -34],
    [99, -43, 112, -34],
    [117, -43, 127, -25],
    [118, -21, 131, -4],
    [135, -40, 148, -17],
  ].entries())
    room(o, rectangle(...r), 1.7 + (i % 3) * 0.4, 1.5, [[i % 4, 0.5, 2]], 167 + i * 4);
  if (fine(o)) {
    for (const [x, z] of [
      [91, 48],
      [91, 56],
      [86, 48],
      [86, 56],
    ])
      column(o, x, z, 0.45, 1.1, 'carved', pale);
    // Floor paving is source geometry; no photographic atlas or baked illumination.
    for (const [x0, z0, x1, z1] of [
      [55, 11, 74, 30],
      [42, -27, 84, -7],
      [83, 43, 94, 60],
    ])
      for (let x = x0; x < x1; x += 1.6)
        for (let z = z0; z < z1; z += 1.6)
          box(
            o,
            'travertine',
            [x, base + 0.005, z],
            [Math.min(x + 1.53, x1), base + 0.06, Math.min(z + 1.53, z1)],
            color(pale, 0.94 + (0.055 * (Math.round(x + z) % 5)) / 4),
          );
  }
}
function westIwan(o) {
  // UNESCO records the collapsed south wall; the surviving northern spine dominates the skyline.
  const a = [31, -67],
    b = [31, -40];
  const profile = [
    [0, 5.5],
    [2.5, 7],
    [5, 11],
    [8, 12],
    [10, 10],
    [12, 8],
    [14, 12],
    [17, 14],
    [19, 22],
    [23, 22],
    [25, 21],
    [27, 18.8],
  ];
  wall(
    o,
    a,
    b,
    22,
    4.0,
    205,
    'brick',
    o.detail === 'skyline'
      ? [
          [0, 5.5],
          [8, 12],
          [14, 12],
          [19, 22],
          [23, 22],
          [27, 18.8],
        ]
      : fine(o)
        ? Array.from({ length: 109 }, (_, i) => {
            const x = i / 4;
            return [x, heightAt(profile, x) - (0.34 * ((i * 7) % 9)) / 8];
          })
        : profile,
  );
  wall(o, [17, -67], [17, -40], 2.6, 4, 210, 'brick');
  wall(o, [17, -68], [31, -68], 3.5, 2.4, 213, 'brick');
  if (o.detail === 'skyline') return;
  for (const x of [8, 40]) {
    const p = radialRing(0, 6.3, 6.3, 8, [x, -69]).map(([x, _y, z]) => [x, z]);
    room(o, p, 3.3, 1.6, [[x === 8 ? 2 : 6, 0.5, 2.4]], 217 + x, 'brick');
  }
  // Partial vault springing clings to the northern side; no completed barrel vault.
  const steps = master(o) ? 18 : fine(o) ? 12 : 6;
  for (let i = 0; i < steps; i++) {
    const aa = 0.06 + (i * 0.7) / steps,
      bb = 0.06 + ((i + 1) * 0.7) / steps;
    const point = (t, z, outer) => [
      24 + (7 + (outer ? 0.8 : 0)) * Math.cos(t),
      base + 7.7 + (9 + (outer ? 0.8 : 0)) * Math.sin(t),
      z,
    ];
    const z0 = -57,
      z1 = -42;
    for (const outer of [false, true]) {
      let p = [
        point(aa, z0, outer),
        point(bb, z0, outer),
        point(bb, z1, outer),
        point(aa, z1, outer),
      ];
      if (!outer) p = p.toReversed();
      face(o, 'brick', p, brick);
    }
    for (const z of [z0, z1]) {
      const p = [point(aa, z, false), point(bb, z, false), point(bb, z, true), point(aa, z, true)];
      if (z === z0) p.reverse();
      face(o, 'brick', p, brick);
    }
  }
  if (near(o)) {
    // Surviving side-room foundations abut the back of the iwan.
    room(o, rectangle(1, -60, 13, -47), 1.8, 1.5, [[2, 0.5, 2]], 238);
    room(o, rectangle(37, -60, 47, -47), 2.4, 1.5, [[0, 0.5, 2]], 241);
    for (const z of [-61, -52, -43]) {
      const f = frame(o, 28.93, base + 0.2, z, -Math.PI / 2);
      arch(f, 2, 2.8, 1, 0.35, 0.15, 'brick');
    }
  }
}
function lakePalace(o) {
  if (o.detail === 'skyline') return;
  // Only foundations of the lake arcades remain: the phase plan is not a license to rebuild them.
  room(
    o,
    rectangle(-115, -44, 33, 87),
    1.05,
    1.7,
    [
      [0, 0.5, 5],
      [2, 0.5, 20],
    ],
    260,
  );
  room(
    o,
    rectangle(-195, 12, -154, 30),
    1.2,
    1.5,
    [
      [0, 0.5, 5],
      [2, 0.5, 5],
    ],
    266,
  );
  room(
    o,
    rectangle(-120, 10, -109, 32),
    2.1,
    1.6,
    [
      [0, 0.5, 4],
      [2, 0.5, 4],
    ],
    273,
  );
  room(
    o,
    rectangle(-111, -59, 13, -47),
    1.9,
    1.7,
    [
      [0, 0.5, 3],
      [2, 0.5, 3],
    ],
    280,
  );
  if (near(o)) {
    for (let x = -101; x < 7; x += 14) wall(o, [x, -59], [x, -47], 1.4, 1.1, 290 + Math.round(x));
    for (let x = -109; x < 30; x += 8)
      for (const z of [-42, 85])
        box(o, 'carved', [x - 0.55, base, z - 0.55], [x + 0.55, base + 0.65, z + 0.55], pale);
    for (let z = -38; z < 83; z += 8)
      box(o, 'carved', [-113.5, base, z - 0.55], [-112.4, base + 0.65, z + 0.55], pale);
    room(o, rectangle(-56, 91, -42, 102), 2.3, 1.4, [[3, 0.5, 3]], 305);
    room(o, rectangle(17, 75, 32, 87), 2.6, 1.8, [[3, 0.5, 3]], 309);
    room(o, rectangle(-24, -59, -12, -48), 2.6, 1.2, [[1, 0.5, 3]], 313);
  }
  // Isolated red-stone four-column hall, oblique to the main sanctuary grid.
  const f = frame(o, -43, 0, -106, 0.18);
  room(f, rectangle(-10.25, -10.25, 10.25, 10.25), 1.6, 1.8, [[0, 0.5, 3.2]], 321, 'sandstone');
  if (near(o))
    for (const x of [-4, 4])
      for (const z of [-4, 4]) {
        box(
          f,
          'sandstone',
          [x - 0.9, base, z - 0.9],
          [x + 0.9, base + 0.35, z + 0.9],
          [0.61, 0.4, 0.3],
        );
        column(f, x, z, 0.48, 1.5 + (x + z + 8) * 0.025, 'sandstone', [0.6, 0.39, 0.29]);
      }
}
function rubble(o) {
  if (!fine(o)) return;
  const count = master(o) ? 170 : 48;
  for (let i = 0; i < count; i++) {
    const s = ((i + 0.6) * perimeter) / count,
      { point, angle } = at(s),
      f = frame(o, point[0], 0, point[1], angle);
    // Reconstructed loose stones are decorative, not individually surveyed artifacts.
    const x = ((i * 13) % 11) - 5,
      z = (i % 2 ? 1 : -1) * (5.4 + (i % 5) * 0.3),
      r = 0.18 + (i % 7) * 0.06;
    const p = radialRing(base, r * 1.7, r, 5, [x, z]);
    const top = p.map(([x, y, z], j) => [x * 0.998, y + 0.17 + 0.1 * ((i + j) % 3), z]);
    loft(f, 'carved', [p, top], color(stone, 0.87 + 0.09 * (i % 3)), { cap: false });
    roughTop(f, top, 'carved', stone);
  }
  for (const pts of [
    [
      [-94, 8],
      [-119, 11],
      [-150, 20],
      [-188, 22],
    ],
    [
      [3, 43],
      [27, 68],
      [46, 102],
      [50, 149],
    ],
  ])
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      beam(o, 'travertine', [a[0], base + 0.07, a[1]], [b[0], base + 0.07, b[1]], 0.95, 0.1, pale);
      beam(o, 'glass', [a[0], base + 0.13, a[1]], [b[0], base + 0.13, b[1]], 0.45, 0.035, water);
    }
}
export function buildTakhtRuntime(out, detail) {
  const o = { ...out, detail };
  platform(o);
  fortification(o);
  sanctuary(o);
  westIwan(o);
  lakePalace(o);
  rubble(o);
}
export function buildTakhtSkyline(out) {
  buildTakhtRuntime(out, 'skyline');
}
export const takhtStudy = {
  id: 'N0246',
  key: 'takht_e_soleyman',
  title: 'Takht-e Soleyman',
  category: 'castle',
  wikidataId: 'Q115253',
  mapFrame: 'map-frame.json',
  build: (out) => buildTakhtRuntime(out),
  brief:
    'Oval stone enclosure with 38 bastions, mapped spring lake, roofless fire sanctuaries, columned western halls, tall broken west-iwan spine, octagonal foundations and the oblique four-column red-stone hall.',
  sourceFacts: {
    mapIdentity:
      'Named OSM way/203537193 matches English Wikipedia and UNESCO ref 1077; no Wikidata tag',
    mappedFeatures: 2,
    documentedBastions: 38,
    originalWallHeightMeters: 13,
    originalWallThicknessMeters: 6,
    westIwanInteriorMeters: [10, 27],
    redStoneHallSideMeters: 20.5,
    survivingTempleWallsUpToMeters: 7,
    surveyedVerticalDimensions: false,
  },
  reconstruction: {
    basis:
      'OSM enclosure and lake; Huff phase plans (figures 1 and 4); UNESCO nomination dossier and photographs of surviving ruins.',
    interiorRegistration:
      'Approximate visual alignment of the published plans to the mapped enclosure/lake; no surveyed interior coordinates.',
    westIwanTopAboveLocalFloorMeters: 22,
    localContactSlabMeters: 1.2,
    verticalDatum:
      'Provisional local plateau surface. The 60 m geological height above the valley is not an architectural pedestal.',
  },
  scaleBasis:
    'Mapped outer enclosure is about 398 by 315 m. The nomination describes a larger 550 by 350 m plateau; those extents are not assumed interchangeable. Native +X north and +Z east.',
  refs: [
    'https://www.openstreetmap.org/way/203537193',
    'https://www.openstreetmap.org/way/314769016',
    'https://whc.unesco.org/en/list/1077',
    'https://whc.unesco.org/uploads/nominations/1077.pdf',
    'https://www.iranicaonline.org/articles/takt-e-solayman/',
    'https://www.iranicaonline.org/uploads/files/takht_solayman_fig_1.jpg',
    'https://www.iranicaonline.org/uploads/files/takht_solayman_fig_4.jpg',
    'https://commons.wikimedia.org/wiki/File:Takht-i-Suleiman_20170812_18.jpg',
    'https://commons.wikimedia.org/wiki/File:Takht-e_Soleymān_overview.jpg',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Publications and photographs used as architectural references; no third-party mesh or image pixels distributed.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X north',
    front: '+Z east',
    origin: 'OSM enclosure anchor at provisional plateau contact',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus:
      'Draft map anchor and cardinal orientation; archaeological layout and terrain fit pending',
    notes:
      'The enclosing oval contains open ground and a lake; it is not an occupied building replacement footprint.',
  }),
  geographicNote:
    'Keep as a draft until terrain, enclosure and lake registration are visually verified in the world viewer.',
  limitations: [
    'Maximum fidelity remains pending. Interior plans are visually registered approximations, not a photogrammetric survey. Individual wall positions, present erosion profiles and archaeological phase boundaries need measured refinement.',
    'Thirty-eight bastions are documented, but the tower stations and surviving heights are reconstructed. The north, old southeast and newer south entrances need local measured alignment.',
    'The west iwan is modeled as a broken northern wall with partial vault springing. Its 22 m remaining peak, broken edges, side niches and octagonal foundations are proportional estimates. No complete ancient roof is asserted.',
    'Fire-temple corner piers, restored arches, basins and column stumps are interpreted from plans and photographs. Exact restoration dates and current condition are unverified; temporary scaffolding is excluded.',
    'Shared stone, travertine, brick and sandstone are used without embedded images. The spring uses local PBR color, without bathymetry or a bespoke water shader. Small stones and weathering are procedural details.',
    'The plateau slab is provisional. Full geological mound, distant Zendan/Belqeis sites, surrounding village and modern visitor structures are outside this asset. Terrain fit and hydrology remain pending.',
  ],
  camera: { position: [-430, 300, -370], lookAt: [0, 5, 0], fov: 43 },
  qaCameras: [
    { name: 'lake-and-fire-sanctuary', position: [-128, 37, 54], lookAt: [64, 4, 17] },
    { name: 'western-iwan-ruin', position: [-14, 22, 7], lookAt: [27, 10, -53] },
    { name: 'western-iwan-back', position: [60, 19, -106], lookAt: [28, 11, -55] },
    { name: 'fire-temple-open-cella', position: [47, 24, 1], lookAt: [65, 4, 20] },
    { name: 'second-temple-pillars', position: [35, 10, -19], lookAt: [83, 3, -18] },
    { name: 'southeast-historic-gate', position: [-217, 16, 163], lookAt: [-174, 5, 107] },
    { name: 'red-stone-column-hall', position: [-76, 21, -140], lookAt: [-43, 2, -106] },
    { name: 'northern-gate-and-bastions', position: [259, 27, 30], lookAt: [180, 4, 19] },
    { name: 'archaeological-plan', position: [0, 430, 5], lookAt: [0, 0, 0] },
  ],
};
