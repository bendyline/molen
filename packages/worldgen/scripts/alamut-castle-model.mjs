/** Alamut: mapped surviving rooms, rock-cut reservoirs, broken walls and cliff contact. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/tn/tn7/n0249_alamut_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.55, 0.43, 0.34],
  pale = [0.67, 0.55, 0.43],
  brick = [0.61, 0.39, 0.26];
const ground = [0.53, 0.39, 0.3],
  water = [0.16, 0.21, 0.11];
const base = 0;
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
const enclosure = ring(590499418);
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
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[2][0] - q[0][0]) * (q[1][2] - q[0][2]),
      ) < 1e-6
    )
      continue;
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
function wall(o, a, b, h = 3, width = 2, seed = 0, slot = 'sandstone', profile) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.05) return;
  const f = edgeFrame(o, a, b),
    n = Math.max(1, Math.ceil(len / (master(o) ? 0.6 : fine(o) ? 1.6 : near(o) ? 4 : 1000)));
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
  const course = slot === 'brick' ? 0.23 : 0.38,
    module = slot === 'brick' ? 0.47 : 0.68;
  // A subset of exposed stones remains at close-up; the source master has every course.
  for (let row = 0; row * course < h; row++)
    for (let k = 0; k < Math.ceil(len / module); k++) {
      if (!master(o) && (k + row * 3 + seed) % 8 !== 0) continue;
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
        if (slot === 'brick')
          box(
            f,
            'brick',
            [x0, y0, Math.min(z, z + sign * d)],
            [x1, y1, Math.max(z, z + sign * d)],
            c,
          );
        else {
          // Irregular exposed stone faces, including chipped corners, instead of brick-like boxes.
          const w = x1 - x0,
            hh = y1 - y0,
            chip = 0.08 + ((k + row + seed) % 5) * 0.023;
          extrudeProfile(
            f,
            [
              [x0 + w * chip, y0],
              [x1 - w * 0.08, y0 + hh * 0.06],
              [x1, y0 + hh * 0.23],
              [x1 - w * chip, y1 - hh * 0.02],
              [x0 + w * 0.04, y1],
              [x0, y0 + hh * 0.67],
            ],
            Math.min(z, z + sign * d),
            Math.max(z, z + sign * d),
            slot === 'weathered' ? 'weathered' : 'sandstone',
            c,
          );
        }
      }
    }
}
function room(o, p, h = 2.5, width = 1.8, doors = [], seed = 0, slot = 'sandstone') {
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

// A short local rock contact, not the 220 m mountain. The common plane keeps wall bases
// and cut reservoirs aligned; its elevation and inclination still require a terrain survey.
const floor = (x, z) => 38 - 0.032 * x + 0.012 * z;
function plateauFrame(o) {
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, c) =>
          o[k](
            slot,
            ref,
            p.map(([x, y, z]) => [x, y + floor(x, z), z]),
            normalize([n[0] + 0.032 * n[1], n[1], n[2] - 0.012 * n[1]]),
            uv,
            c,
          ),
      ]),
    ),
  };
}
// Rock-cut reservoirs are real holes in the plateau, with separate lower floors.
// Positions inside the mapped ruin groups are photograph/plan interpretations, not surveys.
const reservoirs = [
  { p: rectangle(-78, -22, -70, -17), depth: 2.8 },
  { p: rectangle(-64, -19, -57, -14), depth: 2.6 },
  { p: rectangle(2, -3, 11.5, 2.8), depth: 3.1 },
  { p: rectangle(6, 11, 13.2, 16.4), depth: 2.8 },
  { p: rectangle(19.2, 4.1, 24.7, 7.5), depth: 2.2 },
];
function rock(o) {
  const step = master(o) ? 1.9 : fine(o) ? 4.2 : near(o) ? 8 : o.detail === 'district' ? 18 : 1000;
  const rim = [];
  let distance = 0;
  for (let i = 0; i < enclosure.length; i++) {
    const a = enclosure[i],
      b = enclosure[(i + 1) % enclosure.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < n; j++)
      rim.push([...a.map((v, k) => v + ((b[k] - v) * j) / n), distance + (len * j) / n]);
    distance += len;
  }
  const levels = master(o) ? 15 : fine(o) ? 8 : near(o) ? 5 : o.detail === 'district' ? 3 : 1;
  const rings = [];
  for (let level = 0; level <= levels; level++) {
    const t = level / levels;
    rings.push(
      rim.toReversed().map(([x, z, distance]) => {
        const radius = Math.hypot(x / 3, z) || 1;
        // Physical arc length keeps the same rock ribs when LOD sample counts change.
        const flute =
          1.1 + 1.6 * Math.sin(distance * 0.61) + 0.9 * Math.sin(distance * 0.23 + t * 3.3);
        const spread = (1 - t) * (5.5 + flute) + Math.sin(t * Math.PI) * flute;
        return [x + (x / (3 * radius)) * spread, floor(x, z) * t, z + (z / radius) * spread];
      }),
    );
  }
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j];
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length;
      // Split the non-planar facets so their normals agree at both triangles.
      for (const q of [
        [a[i], a[k], b[k]],
        [a[i], b[k], b[i]],
      ])
        o.addTriangle(
          'weathered',
          'palette:#ffffff',
          q,
          normalFor(...q),
          [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          color(ground, 0.86 + (0.18 * ((i * 7 + j * 3) % 19)) / 18),
        );
    }
  }
  const f = plateauFrame(o);
  cap(f, [enclosure, ...reservoirs.map((r) => r.p)], 0, 'weathered', color(ground, 1.1));
  for (const { p, depth } of reservoirs) {
    // Positive XZ order faces inward, as required for a cut in the plateau.
    loft(
      f,
      'weathered',
      [p.map(([x, z]) => [x, -depth, z]), p.map(([x, z]) => [x, 0, z])],
      color(ground, 0.93),
      { cap: false },
    );
    cap(f, [p], -depth + 0.03, 'recess', water);
  }
  if (!near(o)) return;
  // Eroded lips and sediment around the cisterns retain the openings.
  for (const [j, { p }] of reservoirs.entries()) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      wall(f, a, b, 0.28, 0.22, 47 + i + j, 'weathered');
    }
  }
  if (fine(o)) {
    const p = reservoirs[0].p,
      x = p[0][0] + 1.1,
      z = p[0][1] + 0.8;
    for (const dx of [-0.3, 0.3])
      beam(f, 'wood', [x + dx, -2.7, z + 0.75], [x + dx, 0.6, z], 0.07, 0.09, [0.39, 0.29, 0.17]);
    for (let i = 0; i < 11; i++) {
      const y = -2.55 + i * 0.28,
        zz = z + ((0.6 - y) / 3.3) * 0.75;
      beam(f, 'wood', [x - 0.31, y, zz], [x + 0.31, y, zz], 0.05, 0.08, [0.43, 0.31, 0.19]);
    }
  }
}
const ruinGroups = [
  [327113832, 4.3, 1.15],
  [590499424, 3.8, 1.1],
  [590499425, 2.1, 0.8],
  [590499426, 2.7, 0.9],
  [590499420, 1.3, 0.65],
  [590499421, 2.3, 0.8],
  [590499423, 3.6, 0.9],
  [590499427, 2.8, 1.2],
  [590499429, 2.1, 1],
  [590499431, 2.6, 1],
];
function mappedRuins(o) {
  const f = plateauFrame(o),
    segments = [];
  for (const [id, height, width] of ruinGroups) {
    const p = ring(id);
    for (let i = 0; i < p.length; i++)
      segments.push({ a: p[i], b: p[(i + 1) % p.length], height, width });
  }
  // Split shared and partially shared mapped boundaries at all collinear endpoints.
  // A single wall occupies each resulting segment; coincident skins would shimmer.
  const unique = new Map();
  for (const seg of segments) {
    const { a, b } = seg,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    const ts = [0, 1];
    for (const other of segments)
      for (const p of [other.a, other.b]) {
        const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (len * len);
        if (
          t > 0.001 &&
          t < 0.999 &&
          Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / len < 0.006
        )
          ts.push(t);
      }
    const sorted = [...new Set(ts.map((t) => Math.round(t * 1e6) / 1e6))].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const aa = [a[0] + dx * sorted[i - 1], a[1] + dz * sorted[i - 1]];
      const bb = [a[0] + dx * sorted[i], a[1] + dz * sorted[i]];
      if (Math.hypot(bb[0] - aa[0], bb[1] - aa[1]) < 0.03) continue;
      const key = [aa, bb]
        .map((p) => p.map((v) => v.toFixed(2)).join(','))
        .sort()
        .join('|');
      if (!unique.has(key) || unique.get(key).height < seg.height)
        unique.set(key, { ...seg, a: aa, b: bb });
    }
  }
  let seed = 0;
  for (const { a, b, height, width } of unique.values()) wall(f, a, b, height, width, seed++);
}
function ruinsDetail(o) {
  const f = plateauFrame(o);
  // Low exposed cells of the northwest ridge, following the surveyed outer envelope.
  // The interior divisions come from the published plan and remain approximate.
  wall(f, [-85, -23.5], [-31, -15.2], 1.1, 0.9, 64);
  wall(f, [-84, -13.5], [-32, 6.4], 1.35, 1, 71);
  for (const [x, za, zb] of [
    [-81, -23, -13],
    [-68, -21, -7.8],
    [-55, -19, -2.7],
    [-43, -17.3, 1.9],
  ])
    wall(f, [x, za], [x + 1.1, zb], 0.9, 0.65, 85 + x);
  if (o.detail === 'skyline') return;
  // Surviving eastern retaining curtain: interrupted, not a restored perimeter.
  wall(f, [29, 19], [71, 12], 2.6, 1.6, 38);
  wall(f, [84, 6], [78, -16], 3.5, 1.6, 54);
  // Central excavated rooms use genuine openings, brick piers and arch fragments.
  // No intact roofs or the temporary 2014 excavation canopy in this 2024 interpretation.
  const chamber = frame(f, -12.4, 0, -3.4, -0.205);
  room(
    chamber,
    rectangle(-3.5, -3.2, 3.5, 3.2),
    3.2,
    0.75,
    [
      [0, 0.5, 2.7],
      [2, 0.5, 2.7],
    ],
    91,
  );
  arch(frame(chamber, 0, 0, -3.2), 2.7, 1.65, 1.5, 0.44, 0.84);
  arch(frame(chamber, 0, 0, 3.2), 2.7, 1.65, 1.5, 0.38, 0.82);
  const south = frame(f, 0.1, 0, 3.1, -0.205);
  wall(south, [-3.2, -6], [-3.2, 1.4], 5.5, 1.1, 97);
  wall(south, [0.5, -5.2], [0.5, -0.8], 5.8, 1, 105);
  arch(frame(south, -1.3, 0, 1.3), 2.8, 2.25, 1.6, 0.48, 1.05);
  // One tall brick-faced pier and broken adjoining wall make the surviving high remnant.
  // Highest top is a consistent 47 m above the provisional local model base.
  const pier = frame(f, -7, 0, -3);
  wall(pier, [-0.65, 0], [0.65, 0], 8.812, 1.3, 113, 'brick', [
    [0, 8.812],
    [1.3, 8.812],
  ]);
  wall(f, [-7.1, -3], [-7.7, -7.7], 5.4, 1.35, 119);
  if (!near(o)) return;
  // Pale lime plaster survives as irregular patches on otherwise exposed masonry.
  for (const [x, z, w, h] of [
    [-3.17, -0.9, 1.4, 2.7],
    [0.46, -3.7, 1.2, 2.1],
  ]) {
    const patch = frame(south, x, 0.15, z, Math.PI / 2);
    extrudeProfile(
      patch,
      [
        [-w / 2, 0],
        [w / 2, 0],
        [w / 2, h * 0.8],
        [0.1, h],
        [-w / 2, h * 0.92],
      ],
      -0.64,
      -0.61,
      'plaster',
      [0.76, 0.66, 0.52],
    );
  }
  // Shallow excavated wall-footings, distinct from the taller surviving masonry.
  for (const [a, b] of [
    [
      [-14, 1.5],
      [-7.8, 2.8],
    ],
    [
      [-11.4, 2],
      [-12.2, 6.2],
    ],
    [
      [-24, -7.7],
      [-17, -6.2],
    ],
    [
      [-20.2, -7],
      [-21.2, -2],
    ],
    [
      [28, 4],
      [43, 1.9],
    ],
    [
      [34.5, 3],
      [35.8, 11],
    ],
    [
      [43, 1.9],
      [45, 14],
    ],
    [
      [48, 13.8],
      [59, 12],
    ],
    [
      [56, 12.5],
      [54.5, 4.1],
    ],
  ])
    wall(f, a, b, 0.65, 0.72, 123);
  if (fine(o)) {
    // Small irregular rubble fragments occupy already exposed foundation edges.
    for (let i = 0; i < 70; i++) {
      const x = -22 + i * 1.38,
        z = 19 - i * 0.105 + Math.sin(i * 2.1) * 0.6;
      const w = 0.24 + 0.16 * (i % 5),
        h = 0.15 + 0.12 * (i % 3);
      const r = frame(f, x, 0, z, i * 0.61);
      extrudeProfile(
        r,
        [
          [-w / 2, 0],
          [w / 2, 0],
          [w * 0.35, h * 0.8],
          [-w * 0.2, h],
        ],
        -0.17,
        0.22,
        'sandstone',
        color(pale, 0.88 + (i % 4) * 0.06),
      );
    }
  }
}
function approach(o) {
  if (o.detail === 'skyline') return;
  // Only the last mapped stair reaches the asset. Its lower flights belong to terrain.
  const p = [
    [18.642, -32.263],
    [30.156, -32.349],
    [50.634, -31.632],
    [74.5, -27.5],
    [79, -18],
  ];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ya = 23 + (i - 1) * 3.1,
      yb = 23 + i * 3.1,
      f = edgeFrame(o, a, b, ya);
    // A cut rock ledge ties the mapped stair to the cliff instead of leaving a floating flight.
    const ledge = (x, y) => [
      [x, y - 7, -0.62],
      [x, y - 0.22, -0.94],
      [x, y - 0.3, 13],
      [x, y - 9, 13],
    ];
    loft(f, 'weathered', [ledge(0, 0), ledge(len, yb - ya)], color(ground, 0.9));
    if (near(o)) {
      const n = Math.ceil((yb - ya) / 0.19);
      for (let k = 0; k < n; k++)
        box(
          f,
          'sandstone',
          [(k * len) / n, -1, -0.72],
          [((k + 1) * len) / n, ((yb - ya) * (k + 1)) / n, 0.72],
          stone,
        );
      if (fine(o))
        for (const side of [-1, 1]) {
          for (let k = 0; k <= Math.ceil(len / 2); k++) {
            const t = k / Math.ceil(len / 2),
              x = t * len,
              y = (yb - ya) * t;
            beam(
              f,
              'metal',
              [x, y, side * 0.78],
              [x, y + 0.95, side * 0.78],
              0.035,
              0.04,
              [0.31, 0.26, 0.22],
            );
          }
          beam(
            f,
            'metal',
            [0, 0.95, side * 0.78],
            [len, yb - ya + 0.95, side * 0.78],
            0.035,
            0.04,
            [0.31, 0.26, 0.22],
          );
        }
    } else
      extrudeProfile(
        f,
        [
          [0, -1],
          [len, -1],
          [len, yb - ya],
          [0, 0],
        ],
        -0.72,
        0.72,
        'sandstone',
        stone,
      );
  }
}
export function buildAlamutRuntime(out, detail) {
  const o = { ...out, detail };
  rock(o);
  mappedRuins(o);
  ruinsDetail(o);
  approach(o);
  if (detail === 'skyline') {
    const f = plateauFrame(o);
    // Preserve the highest surviving pier in the skyline tier as well.
    box(f, 'brick', [-7.65, 0, -3.65], [-6.35, 8.812, -2.35], brick);
  }
}
export function buildAlamutSkyline(out) {
  buildAlamutRuntime(out, 'skyline');
}
export const alamutStudy = {
  id: 'N0249',
  key: 'alamut_castle',
  title: 'Alamut Castle',
  category: 'castle',
  wikidataId: 'Q4706020',
  mapFrame: 'map-frame.json',
  build: (out) => buildAlamutRuntime(out),
  brief:
    'Roofless Alamut upper-castle ruins on a narrow fluted rock ridge, with ten mapped ruin groups, northwest cells, open rock-cut reservoirs, brick arch remnants, broken stone walls and eastern approach stairs.',
  sourceFacts: {
    identity: 'Exact Q4706020 on OSM way/590499418',
    mappedEnvelopeMeters: [176.148, 53.917],
    mappedRuinGroups: 10,
    currentReferenceDates: ['2024-01-01', '2024-12-22'],
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'OSM upper-castle outline and ruin groups; UNESCO 2024 aerial/ground photographs; published Willey ground plan and 2014 field photographs for cisterns and northwest ridge.',
    verticalDatum:
      'Local bedrock contact with plateau 38 - 0.032*x + 0.012*z meters. Ruin walls and cut depths are photographic estimates. The much larger mountain is not included.',
    state:
      'Surviving roofless archaeological remains. Temporary excavation shelters in older photographs are omitted in the 2024 interpretation.',
  },
  scaleBasis:
    'Map outlines in meters; +X 45.63 degrees south of east. Only the horizontal outer envelope and mapped ruin footprints are georeferenced; heights and chamber subdivisions remain approximate.',
  refs: [
    'https://whc.unesco.org/en/list/1770/',
    'https://whc.unesco.org/en/documents/220797',
    'https://whc.unesco.org/en/documents/220798',
    'https://www.openstreetmap.org/way/590499418',
    'https://www.burgenwelt.org/iran/alamut/object.php',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. UNESCO/ACHB photographs and published plan are references only; no pixels or third-party mesh copied.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X southeast, 45.63 degrees south of east',
    front: '+Z southwest',
    origin: 'Mapped upper castle anchor, provisional local rock contact',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus:
      'Map anchor and ten surviving footprints retained; vertical datum and terrain fit pending',
    notes:
      'Do not extrude the upper-castle boundary as a solid building. Ruin chambers and cisterns remain open.',
  }),
  geographicNote:
    'Draft until the cliff contact and upper/lower castle extent are checked on terrain.',
  limitations: [
    'Maximum fidelity pending: mapped ruin footprints are preserved, but heights, individual chamber divisions, arch positions, masonry profiles and cistern positions/depths need measured archaeological plans.',
    'Includes the mapped upper castle only. The lower/onion castle, passing zone and complete 220 m mountain require additional source coverage and terrain integration.',
    'Rock geometry is a provisional local contact. Geological strata, excavated floor levels and the approach stair vertical alignment are not surveyed.',
    'The roofless state follows 2024 UNESCO views. Protective scaffolding visible in 2014 field photos is not treated as permanent historic architecture.',
    'Shared procedural sandstone, weathered stone, brick, plaster, timber and metal contain no embedded photos. Exact rock and mortar appearance remain to refine.',
  ],
  camera: { position: [-173, 120, 194], lookAt: [0, 25, 0], fov: 43 },
  qaCameras: [
    { name: 'upper-castle-plan', position: [0, 230, 0.2], lookAt: [0, 0, 0] },
    { name: 'northwest-cells-and-cisterns', position: [-99, 67, 1], lookAt: [-58, 39, -12] },
    { name: 'rock-cut-reservoir', position: [-82, 49, -12], lookAt: [-74, 38, -19] },
    { name: 'central-excavation', position: [-39, 71, 37], lookAt: [-4, 39, 1] },
    { name: 'brick-arches-and-plaster', position: [-20, 47, 11], lookAt: [-10, 41, -3] },
    { name: 'three-central-cisterns', position: [42, 66, 25], lookAt: [12, 38, 7] },
    { name: 'eastern-gate-remains', position: [110, 55, 19], lookAt: [74, 37, -1] },
    { name: 'cliff-and-approach', position: [65, 41, -93], lookAt: [48, 24, -24] },
    { name: 'southern-retaining-wall', position: [21, 49, 72], lookAt: [42, 37, 16] },
  ],
};
