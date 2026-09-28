/** Pivnichnyi: an asymmetric eight-span crossing, three cable tiers and pierced wall piers. */

import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import {
  beam,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0030_pivnichnyi_bridge', 'map-frame.json')),
);
const concrete = [0.54, 0.52, 0.46],
  edge = [0.66, 0.64, 0.58],
  iron = [0.31, 0.34, 0.32],
  cable = [0.16, 0.18, 0.17],
  blue = [0.35, 0.57, 0.65];
const px = frame.geometry.pylonStation,
  ends = [-394.975, 394.975],
  half = 15.7;
const stations = [
  px - 658.3,
  px - 616.3,
  px - 553.3,
  px - 490.3,
  px - 427.3,
  px - 363.65,
  px - 300,
  px,
  px + 84.51,
];
// Provisional exposed structure profile, to be tested against independent terrain.
const road = (x) => 30.6 - 2.5 * ((x - 100) / 475) ** 2;
const archedCrown = road(px) + 53;
const samples = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
function transform(out, angle, center) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    rot = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    pt = (p) => rot(p).map((v, i) => v + center[i]);
  return {
    addQuad: (k, r, p, n, u, t) => out.addQuad(k, r, p.map(pt), rot(n), u, t),
    addTriangle: (k, r, p, n, u, t) => out.addTriangle(k, r, p.map(pt), rot(n), u, t),
    addConvexPolygon: (k, r, p, n, u, t) => out.addConvexPolygon(k, r, p.map(pt), rot(n), u, t),
  };
}
function extrusion(out, slot, outline, z0, z1, color, holes = []) {
  const area = (p) =>
    p.reduce((s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1], 0);
  const outer = area(outline) > 0 ? outline : outline.toReversed(),
    rings = [outer, ...holes.map((p) => (area(p) < 0 ? p : p.toReversed()))];
  const points = rings.flat(),
    cuts = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, p) => s + p.length, 0)),
    ids = earcut(points.flat(), cuts);
  for (let i = 0; i < ids.length; i += 3)
    for (const [z, reverse] of [
      [z0, true],
      [z1, false],
    ]) {
      const p = ids.slice(i, i + 3).map((k) => [...points[k], z]);
      if (reverse) p.reverse();
      out.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        normalFor(...p),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        p = [
          [...a, z0],
          [...b, z0],
          [...b, z1],
          [...a, z1],
        ];
      quad(out, slot, p, normalFor(...p), color);
    }
}
function rounded(out, slot, points, r, color, sides = 12) {
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      axis = normalize(b.map((v, j) => v - a[j])),
      u = normalize(cross(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0])),
      v = cross(axis, u);
    return Array.from({ length: sides }, (_, j) =>
      p.map(
        (n, k) =>
          n +
          r *
            (u[k] * Math.cos((j / sides) * Math.PI * 2) +
              v[k] * Math.sin((j / sides) * Math.PI * 2)),
      ),
    );
  });
  loft(out, slot, rings, color);
}
const line = (out, slot, a, b, r, color = iron, sides = 12) =>
  rounded(out, slot, [a, b], r, color, sides);
const cylinder = (out, slot, x, y, z, r, h, color, n = 32) =>
  loft(out, slot, [radialRing(y, r, r, n, [x, z]), radialRing(y + h, r, r, n, [x, z])], color);
function roadStrip(out, slot, x0, x1, z0, z1, lo, hi, color) {
  const ring = (x) => [
    [x, road(x) + hi, z0],
    [x, road(x) + hi, z1],
    [x, road(x) + lo, z1],
    [x, road(x) + lo, z0],
  ];
  loft(out, slot, [ring(x0), ring(x1)], color);
}
function iBeam(out, a, b, w, h, color = iron) {
  const d = normalize(b.map((n, i) => n - a[i])),
    z = normalize(cross(d, [0, 1, 0])),
    y = cross(z, d);
  const part = (width, height, offset) => {
    const ring = (p) =>
      [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ].map(([u, v]) =>
        p.map((n, i) => n + (z[i] * u * width) / 2 + y[i] * (offset + (v * height) / 2)),
      );
    loft(out, 'iron', [ring(a), ring(b)], color);
  };
  part(0.035, h, 0);
  part(w, 0.065, -h / 2);
  part(w, 0.065, h / 2);
}
function deck(out) {
  for (let x = ends[0]; x < ends[1]; x += 2) {
    const xx = Math.min(x + 2, ends[1]);
    roadStrip(out, 'road', x, xx, -12.55, 12.55, -0.22, 0, [0.18, 0.19, 0.18]);
    for (const sign of [-1, 1]) {
      const zs = [sign * 12.55, sign * half].sort((a, b) => a - b);
      roadStrip(out, 'concrete', x, xx, ...zs, -0.46, 0.18, edge);
      roadStrip(out, 'road', x, xx, zs[0] + 0.1, zs[1] - 0.1, 0.18, 0.22, [0.25, 0.26, 0.245]);
      const boxz = [sign * 6.7, sign * 10.9].sort((a, b) => a - b);
      roadStrip(out, 'iron', x, xx, ...boxz, -3.05, -0.32, iron);
      iBeam(out, [x, road(x) - 0.3, sign * 15.5], [xx, road(xx) - 0.3, sign * 15.5], 0.3, 0.55);
    }
  }
  for (let x = ends[0] + 1; x < ends[1]; x += 3.15) {
    iBeam(out, [x, road(x) - 1.45, -15.4], [x, road(x) - 1.45, 15.4], 0.25, 1.8);
    for (const z of [-9.1, 9.1]) {
      for (const side of [-1, 1])
        box(
          out,
          'iron',
          [x - 0.055, road(x) - 3.03, z + side * 2.1 - 0.045],
          [x + 0.055, road(x) - 0.4, z + side * 2.1 + 0.045],
          edge,
        );
    }
  }
  for (const sign of [-1, 1]) {
    for (let x = ends[0] + 0.4; x < ends[1]; x += 2) {
      const xx = Math.min(x + 2, ends[1]),
        z = sign * 15.53,
        y = road(x);
      box(out, 'iron', [x - 0.055, y + 0.2, z - 0.045], [x + 0.055, y + 1.43, z + 0.045], edge);
      beam(out, 'iron', [x, y + 1.43, z], [xx, road(xx) + 1.43, z], 0.22, 0.11, blue);
      beam(out, 'iron', [x, y + 0.32, z], [xx, road(xx) + 0.32, z], 0.065, 0.05, edge);
      for (let u = x + 0.22; u < xx; u += 0.19)
        beam(out, 'iron', [u, road(u) + 0.3, z], [u, road(u) + 1.38, z], 0.028, 0.028, edge);
      // Blue ornamental brackets stand outside the parapet and carry small service loops.
      if (Math.floor((x - ends[0]) / 2) % 8 === 0) {
        rounded(
          out,
          'iron',
          samples(30, (t) => [
            x + 0.32 * Math.sin(t * Math.PI),
            y + 1.43 + 0.48 * Math.sin(t * Math.PI),
            z + sign * 0.85 * t,
          ]),
          0.023,
          blue,
        );
        rounded(
          out,
          'iron',
          samples(48, (t) => [
            x + 0.27 * Math.cos(t * Math.PI * 2),
            y + 1.13,
            z + sign * (0.62 + 0.17 * Math.sin(t * Math.PI * 2)),
          ]),
          0.018,
          blue,
        );
      }
    }
    guardrail(out, sign * 12.45, ends[0], ends[1]);
  }
  guardrail(out, 0, ends[0], ends[1], true);
  for (const z of [-12.0, -9.1, -6.15, -3.18, 3.18, 6.15, 9.1, 12.0])
    for (let x = ends[0] + 2; x < ends[1] - 2; x += Math.abs(z) > 11 ? 4 : 9) {
      const len = Math.abs(z) > 11 ? 3.98 : 3;
      roadStrip(
        out,
        'marking',
        x,
        Math.min(ends[1], x + len),
        z - 0.075,
        z + 0.075,
        0.008,
        0.016,
        [0.83, 0.83, 0.76],
      );
    }
  for (const x of [stations[0], stations[5]])
    for (let j = -2; j <= 2; j++)
      beam(
        out,
        'iron',
        [x + j * 0.055, road(x) + 0.018, -12.5],
        [x + j * 0.055, road(x) + 0.018, 12.5],
        0.025,
        0.017,
        cable,
      );
  // Open cable anchor boxes occur beside the sidewalk, not in the traffic lanes.
  for (const x of [px - 80, px - 145, px - 210, px + 84.51])
    for (const side of [-1, 1]) {
      const z = side * 14.1,
        y = road(x);
      box(out, 'concrete', [x - 2.1, y, z - 1.1], [x + 2.1, y + 0.7, z + 1.1], [0.64, 0.57, 0.28]);
      for (const dz of [-0.94, 0.94])
        box(
          out,
          'iron',
          [x - 2.1, y + 0.7, z + dz - 0.055],
          [x + 2.1, y + 2.25, z + dz + 0.055],
          iron,
        );
      for (let xx = x - 1.8; xx <= x + 1.8; xx += 0.6)
        beam(out, 'iron', [xx, y + 0.75, z - 0.93], [xx, y + 1.9, z + 0.93], 0.055, 0.065, edge);
    }
}
function guardrail(out, z, x0, x1, double = false) {
  for (let x = x0; x < x1; x += 2) {
    const y = road(x),
      xx = Math.min(x + 2, x1);
    box(out, 'iron', [x - 0.055, y, z - 0.07], [x + 0.055, y + 0.91, z + 0.07], iron);
    box(out, 'iron', [x - 0.14, y + 0.42, z - 0.09], [x + 0.14, y + 0.85, z + 0.09], iron);
    for (const side of double ? [-1, 1] : [z < 0 ? 1 : -1]) {
      const zz = z + side * 0.15,
        profile = [
          [zz, 0.36],
          [zz + side * 0.06, 0.41],
          [zz + side * 0.01, 0.49],
          [zz + side * 0.065, 0.57],
          [zz, 0.66],
        ],
        rings = [x, xx].map((u) => profile.map(([v, h]) => [u, road(u) + h, v]));
      loft(out, 'iron', rings, edge, { cap: false });
      for (const h of [0.45, 0.62])
        sphere(out, 'iron', [x, road(x) + h, zz + side * 0.066], [0.03, 0.03, 0.017], cable, 12, 6);
    }
    if (double && Math.floor((x - x0) / 2) % 4 === 0)
      sphere(out, 'marking', [x, y + 0.94, 0], [0.09, 0.09, 0.09], [0.9, 0.75, 0.13], 16, 8);
  }
}
function piers(out) {
  for (let i = 1; i <= 6; i++) {
    const x = stations[i],
      top = road(x) - 3.2,
      cy = top - 7.2,
      plane = transform(out, Math.PI / 2, [x, 0, 0]);
    const outline = [
        [-11, 0],
        [11, 0],
        [11, top - 1.1],
        [12.8, top - 0.9],
        [12.8, top],
        [-12.8, top],
        [-12.8, top - 0.9],
        [-11, top - 1.1],
      ],
      hole = Array.from({ length: 128 }, (_, j) => [
        4.5 * Math.cos((j / 128) * Math.PI * 2),
        cy + 4.5 * Math.sin((j / 128) * Math.PI * 2),
      ]);
    extrusion(plane, 'concrete', outline, -1.25, 1.25, concrete, [hole]);
    // Split cast panels and the circular reveal retain depth from both river sides.
    for (const side of [-1, 1]) {
      for (let y = 1.6; y < top - 1; y += 1.9) {
        const dy = y - cy,
          cut = Math.abs(dy) < 4.5 ? Math.sqrt(4.5 ** 2 - dy ** 2) + 0.03 : 0;
        for (const s of [-1, 1])
          if (11 - cut > 0.1)
            beam(
              plane,
              'concrete',
              [s * cut, y, side * 1.257],
              [s * 10.98, y, side * 1.257],
              0.015,
              0.012,
              [0.41, 0.4, 0.36],
            );
      }
      rounded(
        plane,
        'concrete',
        samples(128, (t) => [
          4.54 * Math.cos(t * Math.PI * 2),
          cy + 4.54 * Math.sin(t * Math.PI * 2),
          side * 1.26,
        ]),
        0.045,
        edge,
        10,
      );
    }
    for (const z of [-9, 9]) {
      box(out, 'iron', [x - 0.85, top, z - 1], [x + 0.85, top + 0.27, z + 1], cable);
      box(out, 'iron', [x - 0.72, top + 0.27, z - 0.8], [x + 0.72, top + 0.37, z + 0.8], edge);
    }
  }
  for (const x of [stations[0], stations.at(-1)]) {
    box(out, 'concrete', [x - 2.4, 0, -15.8], [x + 2.4, road(x) - 0.28, 15.8], concrete);
    const sign = x < 0 ? -1 : 1;
    for (const z of [-15.35, 15.35])
      box(
        out,
        'concrete',
        [Math.min(x, x + sign * 18), 0, z - 0.36],
        [Math.max(x, x + sign * 18), road(x) + 0.25, z + 0.36],
        edge,
      );
  }
}
function pylon(out) {
  const local = transform(out, Math.PI / 2, [px, 0, 0]);
  const crown = archedCrown;
  const outline = [
    [-24.8, 0],
    [-18.65, 0],
    [-3.12, crown - 7.7],
    ...samples(48, (t) => [
      -3.12 * Math.cos(t * Math.PI),
      crown - 7.7 + 7.7 * Math.sin(t * Math.PI),
    ]).slice(1),
    [18.65, 0],
    [24.8, 0],
    [5.35, 88],
    [3.85, 119],
    [-3.85, 119],
    [-5.35, 88],
  ];
  const levels = [87.2, 98.2, 109.2],
    holes = levels.map((y) => [
      [-2.65, y - 1.3],
      [2.65, y - 1.3],
      [2.65, y + 1.3],
      [-2.65, y + 1.3],
    ]);
  extrusion(local, 'concrete', outline, -2.65, 2.65, concrete, holes);
  // Recessed anchor galleries and overhanging rain hoods on both pylon faces.
  for (const side of [-1, 1])
    for (const y of levels) {
      box(
        local,
        'iron',
        [-2.6, y - 1.24, side * 0.75 - 0.04],
        [2.6, y + 1.24, side * 0.75 + 0.04],
        cable,
      );
      box(
        local,
        'concrete',
        [-3.13, y + 1.3, Math.min(side * 2.6, side * 3.25)],
        [3.13, y + 1.66, Math.max(side * 2.6, side * 3.25)],
        edge,
      );
      for (const u of [-2.75, 2.75])
        line(local, 'iron', [u, y - 1.1, side * 2.73], [u, y + 1.2, side * 2.73], 0.045);
    }
  const outer = (y) =>
    y < 88 ? 24.8 - ((24.8 - 5.35) * y) / 88 : 5.35 - ((5.35 - 3.85) * (y - 88)) / 31;
  const inner = (y) =>
    y < crown - 7.7
      ? 18.65 - ((18.65 - 3.12) * y) / (crown - 7.7)
      : y < crown
        ? 3.12 * Math.sqrt(1 - ((y - (crown - 7.7)) / 7.7) ** 2)
        : 0;
  for (let y = 2.3; y < 118; y += 2.3)
    for (const side of [-1, 1]) {
      const o = outer(y),
        inset = inner(y);
      for (const s of [-1, 1]) {
        let a = inset + 0.015,
          b = o - 0.015;
        if (levels.some((h) => Math.abs(y - h) < 1.37)) a = Math.max(a, 2.7);
        if (b > a)
          beam(
            local,
            'concrete',
            [s * a, y, side * 2.657],
            [s * b, y, side * 2.657],
            0.015,
            0.012,
            [0.43, 0.42, 0.38],
          );
      }
    }
  for (const side of [-1, 1]) {
    box(out, 'concrete', [px - 5.3, 0, side * 21.2 - 7], [px + 5.3, 1.0, side * 21.2 + 7], edge);
    // Current summit retains the shield's rim and exposed mounting frame.
    const face = transform(out, side > 0 ? Math.PI / 2 : -Math.PI / 2, [px + side * 2.7, 114.0, 0]);
    const shield = [
      [-2.2, 4.4],
      [2.2, 4.4],
      [2.0, 1.4],
      [1.3, 0.2],
      [0, -0.7],
      [-1.3, 0.2],
      [-2.0, 1.4],
      [-2.2, 4.4],
    ];
    rounded(
      face,
      'copper',
      shield.map((p) => [...p, 0.04]),
      0.13,
      [0.29, 0.28, 0.19],
      18,
    );
    for (const x of [-1.2, 1.2]) beam(face, 'iron', [x, 0.8, 0], [x, 4.0, 0], 0.06, 0.065, cable);
    for (const y of [1.1, 2.6, 3.9])
      beam(face, 'iron', [-1.6, y, 0], [1.6, y, 0], 0.055, 0.06, cable);
    // Summit inspection balcony along the roof edge.
    for (const z of [-3.9, 3.9]) {
      line(out, 'iron', [px + side * 2.6, 119, z], [px + side * 2.6, 120.15, z], 0.035);
      line(out, 'iron', [px + side * 2.6, 120.15, -3.9], [px + side * 2.6, 120.15, 3.9], 0.035);
    }
    for (let z = -3; z <= 3; z += 1.5)
      line(out, 'iron', [px + side * 2.6, 119, z], [px + side * 2.6, 120.15, z], 0.026);
    sphere(
      out,
      'iron',
      [px + side * 2.6, 120.42, 3.6],
      [0.16, 0.22, 0.16],
      [0.58, 0.025, 0.02],
      20,
      12,
    );
  }
  // A concrete crossbeam supports the deck between the two legs.
  box(out, 'concrete', [px - 3.4, road(px) - 4.7, -17.8], [px + 3.4, road(px) - 3.0, 17.8], edge);
  line(out, 'iron', [px, 119, 0], [px, 126, 0], 0.055, edge);
  for (const [j, color] of [
    [0, [0.97, 0.77, 0.05]],
    [1, [0.03, 0.31, 0.7]],
  ]) {
    const p = samples(24, (t) => [
      px + 0.08 + 3.6 * t,
      123.4 + j * 1.1,
      Math.sin(t * Math.PI * 2) * 0.22,
    ]);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        q = [a, b, [b[0], b[1] + 1.1, b[2]], [a[0], a[1] + 1.1, a[2]]];
      quad(out, 'marking', q, normalFor(...q), color);
      quad(
        out,
        'marking',
        q.toReversed(),
        normalFor(...q).map((v) => -v),
        color,
      );
    }
  }
}
function stays(out) {
  for (const side of [-1, 1])
    for (let tier = 0; tier < 3; tier++)
      for (const direction of [-1, 1]) {
        const endX = direction < 0 ? px - [80, 145, 210][tier] : px + 84.51,
          upper = 87.2 + tier * 11,
          lower = road(endX) + 1.05;
        const ropes = [24, 32, 40][tier];
        for (let j = 0; j < ropes; j++) {
          const row = Math.floor(j / 8),
            col = j % 8,
            spread = (col - 3.5) * 0.105;
          const a = [
              px + direction * 2.79,
              upper + (row - (Math.ceil(ropes / 8) - 1) / 2) * 0.11,
              side * (1.45 + spread),
            ],
            b = [endX, lower + (row - 1) * 0.095, side * (14.05 + spread * 0.72)];
          const path = samples(72, (t) =>
            a.map((v, k) => v + (b[k] - v) * t - (k === 1 ? 0.45 * 4 * t * (1 - t) : 0)),
          );
          rounded(out, 'iron', path, 0.034, cable, 12);
          const d = normalize(b.map((v, k) => v - a[k]));
          line(
            out,
            'iron',
            b.map((v, k) => v - d[k] * 1.8),
            b,
            0.072,
            iron,
            16,
          );
        }
        // Clamp plates keep the individual ropes legible as a flat bundle.
        for (const t of [0.32, 0.63, 0.88]) {
          const x = px + (endX - px) * t,
            y = upper + (lower - upper) * t - 0.45 * 4 * t * (1 - t),
            z = side * (1.45 + (14.05 - 1.45) * t);
          beam(out, 'iron', [x, y - 0.32, z - 0.55], [x, y + 0.32, z + 0.55], 0.09, 0.075, edge);
        }
      }
}
function lights(out) {
  const poles = [];
  for (let x = ends[0] + 12; x < ends[1]; x += 31.5) poles.push(x);
  for (const x of poles)
    for (const side of [-1, 1]) {
      const y = road(x),
        z = side * 13.7;
      cylinder(out, 'iron', x, y, z, 0.21, 0.38, iron);
      cylinder(out, 'iron', x, y + 0.38, z, 0.13, 11.4, [0.62, 0.65, 0.6], 20);
      // The original split curved arm resembles an open crescent viewed along the deck.
      const arm = samples(40, (t) => [x, y + 10.35 + 1.1 * t * t, z - side * (0.1 + 2.7 * t)]);
      rounded(out, 'iron', arm, 0.047, edge);
      line(out, 'iron', [x, y + 11.48, z], [x, y + 10.43, z - side * 0.28], 0.022, edge);
      sphere(out, 'iron', [x, y + 11.59, z - side * 2.8], [0.15, 0.1, 0.43], iron, 24, 12);
      box(
        out,
        'marking',
        [x - 0.12, y + 11.43, z - side * 2.8 - 0.34],
        [x + 0.12, y + 11.45, z - side * 2.8 + 0.34],
        [0.79, 0.79, 0.65],
      );
      for (const h of [5.7, 7.9]) {
        line(out, 'iron', [x, y + h, z], [x, y + h - 0.1, z - side * 1.2], 0.032);
        for (let j = 0; j < 4; j++)
          sphere(
            out,
            'iron',
            [x, y + h - 0.1, z - side * (0.7 + j * 0.095)],
            [0.05, 0.05, 0.068],
            [0.34, 0.28, 0.22],
            12,
            6,
          );
      }
    }
  for (let i = 1; i < poles.length; i++) {
    const a = poles[i - 1],
      b = poles[i];
    for (const z of [-11.8, -11.2, 11.2, 11.8])
      rounded(
        out,
        'iron',
        samples(20, (t) => {
          const x = a + (b - a) * t;
          return [x, road(x) + 6.15 - 0.23 * 4 * t * (1 - t), z];
        }),
        0.011,
        cable,
        8,
      );
    for (const z of [-12.9, 12.9])
      line(out, 'iron', [a, road(a) + 8.0, z], [b, road(b) + 8.0, z], 0.011, cable, 8);
  }
  for (const x of poles)
    line(out, 'iron', [x, road(x) + 7.82, -13.5], [x, road(x) + 7.82, 13.5], 0.012, cable, 8);
}
function lettering(out, text, x, y, z, width, height) {
  const glyphs = {
    П: [
      [
        [0, 0],
        [0, 1],
        [0.65, 1],
        [0.65, 0],
      ],
    ],
    І: [
      [
        [0.32, 0],
        [0.32, 1],
      ],
    ],
    В: [
      [
        [0, 0],
        [0, 1],
      ],
      samples(18, (t) => [0.34 + 0.32 * Math.sin(t * Math.PI), 1 - 0.48 * t]),
      samples(18, (t) => [0.34 + 0.32 * Math.sin(t * Math.PI), 0.52 - 0.52 * t]),
      [
        [0, 1],
        [0.34, 1],
      ],
      [
        [0, 0.52],
        [0.34, 0.52],
      ],
      [
        [0, 0],
        [0.34, 0],
      ],
    ],
    Н: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0.65, 0],
        [0.65, 1],
      ],
      [
        [0, 0.5],
        [0.65, 0.5],
      ],
    ],
    И: [
      [
        [0, 1],
        [0, 0],
        [0.65, 1],
        [0.65, 0],
      ],
    ],
    Ч: [
      [
        [0, 1],
        [0, 0.55],
        [0.65, 0.55],
      ],
      [
        [0.65, 0],
        [0.65, 1],
      ],
    ],
    Й: [
      [
        [0, 1],
        [0, 0],
        [0.65, 1],
        [0.65, 0],
      ],
      samples(18, (t) => [0.15 + 0.35 * t, 1.22 - 0.12 * Math.sin(t * Math.PI)]),
    ],
    М: [
      [
        [0, 0],
        [0, 1],
        [0.325, 0.45],
        [0.65, 1],
        [0.65, 0],
      ],
    ],
    С: [
      samples(36, (t) => [
        0.37 + 0.35 * Math.cos((0.2 + 1.6 * t) * Math.PI),
        0.5 + 0.5 * Math.sin((0.2 + 1.6 * t) * Math.PI),
      ]),
    ],
    Т: [
      [
        [0, 1],
        [0.65, 1],
      ],
      [
        [0.325, 0],
        [0.325, 1],
      ],
    ],
  };
  const pitch = width / text.length;
  for (let i = 0; i < text.length; i++)
    for (const stroke of glyphs[text[i]] ?? [])
      rounded(
        out,
        'marking',
        stroke.map((p) => [
          x - width / 2 + i * pitch + (p[0] / 0.65) * pitch * 0.77,
          y + p[1] * height,
          z,
        ]),
        0.027,
        [0.1, 0.115, 0.11],
        10,
      );
}
function plaques(out) {
  for (const side of [-1, 1]) {
    const y = road(px),
      z = side * 17.1,
      local = transform(out, side > 0 ? 0 : Math.PI, [px, y, z]);
    box(local, 'iron', [-2.13, 1.0, -0.025], [2.13, 2.68, 0.025], [0.82, 0.83, 0.78]);
    lettering(local, 'ПІВНІЧНИЙ', 0, 1.83, 0.062, 3.8, 0.39);
    lettering(local, 'МІСТ', 0, 1.2, 0.062, 1.9, 0.42);
    for (const x of [-1.98, 1.98])
      for (const yy of [1.13, 2.56])
        sphere(local, 'iron', [x, yy, 0.058], [0.04, 0.04, 0.025], iron, 12, 6);
  }
}
export function buildPivnichnyi(out) {
  deck(out);
  piers(out);
  pylon(out);
  stays(out);
  lights(out);
  plaques(out);
}
export const pivnichnyiStudy = {
  id: 'N0030',
  key: 'pivnichnyi_bridge',
  title: 'Pivnichnyi Bridge',
  wikidataId: 'Q2467654',
  mapFrameDocument: 'map-frame.json',
  build: buildPivnichnyi,
  normalSmoothing: { slots: ['foundation'], angle: 32 },
  brief:
    'Kyiv’s asymmetric Dnipro crossing with an open A pylon, three tiers of individual stay ropes in two planes, eight spans, six circularly pierced wall piers, twin steel box girders, eight road lanes, narrow sidewalks, crescent lamps, trolley wires and current Ukrainian bridge-name plates.',
  refs: [
    'https://urdisc.com.ua/media/21-22%272018.pdf',
    'https://urdisc.com.ua/media/Shymanovsky_Narisi_pozaklasnih_mostiv_2020.pdf',
    'https://guide.kyivcity.gov.ua/places/pivnichnyy-mist',
    'https://desn.kyivcity.gov.ua/news/pivnichniy-mist-otrimav-imennu-tablichku',
    'https://commons.wikimedia.org/wiki/Category:Pivnichnyi_Bridge',
    'https://www.openstreetmap.org/way/227851465',
  ],
  sourceFacts: {
    nominalLengthMeters: 816,
    widthMeters: 31.4,
    structuralSpanChainWestToEastMeters: [42, 63, 63, 63, 63.65, 63.65, 300, 84.51],
    pylonPublishedHeightMeters: [119, 125],
    deckToPylonArchCrownMeters: 53,
    pierHoleDiameterMeters: 9,
    stayTiers: 3,
    stayPlanes: 2,
    ropesPerStay: [20, 40],
    openingYear: 1976,
  },
  reconstruction: {
    mappedDeckLengthMeters: 789.95,
    structuralChainLengthMeters: 742.81,
    pylonStationMeters: px,
    roadProfile: 'Convex photographic reconstruction; independent terrain verification pending.',
    pylonTopMeters: 119,
    riverReferenceAboveOriginMeters: 6,
    notes:
      'The eight published spans are retained at their actual lengths around the mapped pylon leg flares. The mapped deck includes short approach portions beyond the structural abutments. The nominal816m extent differs.119m city/contractor height and125m institute height are conflicting references; foundation datum and road profile require independent review. Visible pylon summit retains the stripped shield perimeter and mounting frame documented in direct2019/2024 photographs, not the complete historical copper emblem.',
  },
  nativeAxes: {
    x: 'east-northeast toward the left-bank pylon and Troieshchyna',
    y: 'up from provisional foundation reference',
    z: 'south-southeast/downstream',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    elevationMode: 'terrain',
    elevationMeters: 0,
    notes:
      'Directed pylon-at-east alignment from current map plan and photographs. This provisional transform has no terrain approval until water datum and approach elevations are independently tested.',
  }),
  limitations: [
    'Provisional vertical datum and convex road profile require independent terrain and approach review.',
    'Published816m nominal extent and119/125m pylon heights have unresolved scope/datum differences, preserved in spec.json.',
    'Pylon cross sections, visible connection details, individual rope diameters and superficial wear are original photographic reconstructions, not fabrication geometry.',
    'The separate Desenka bridge and western overpass are outside this asset.',
  ],
  camera: { position: [470, 320, 530], lookAt: [0, 45, 0], fov: 45 },
  qaCameras: [
    { name: 'complete-eight-span-elevation', position: [0, 65, 850], lookAt: [0, 50, 0] },
    { name: 'reverse-river-elevation', position: [0, 70, -850], lookAt: [0, 50, 0] },
    { name: 'open-a-pylon', position: [380, 70, 65], lookAt: [px, 69, 0] },
    { name: 'pylon-foundation-and-crossbeam', position: [310, 17, 53], lookAt: [px, 17, 0] },
    { name: 'three-stay-galleries', position: [345, 107, 19], lookAt: [px, 102, 0] },
    {
      name: 'individual-stay-ropes',
      position: [px - 93, 38, 27],
      lookAt: [px - 80, road(px - 80) + 2, 14],
    },
    {
      name: 'stay-anchor-box',
      position: [px - 71, 34, 22],
      lookAt: [px - 80, road(px - 80) + 1, 14],
    },
    {
      name: 'nine-meter-pier-opening',
      position: [stations[3] + 37, 18, 24],
      lookAt: [stations[3], 17, 0],
    },
    { name: 'steel-box-soffit', position: [-120, 7, 4], lookAt: [-90, 28, 0] },
    {
      name: 'current-name-plate',
      position: [px + 2, road(px) + 2, 24],
      lookAt: [px, road(px) + 1.8, 17.1],
    },
    { name: 'summit-and-shield-frame', position: [px + 22, 120, 12], lookAt: [px, 116, 0] },
    {
      name: 'parapet-and-service-bracket',
      position: [70, road(70) + 2, 19],
      lookAt: [68, road(68) + 0.9, 15.5],
    },
    {
      name: 'crescent-lamp',
      position: [ends[0] + 18, 43, 20],
      lookAt: [ends[0] + 12, road(ends[0] + 12) + 10.7, 13],
    },
    { name: 'eight-lanes-and-trolley-wire', position: [-300, 34, 9], lookAt: [px, 48, 0] },
    { name: 'western-girder-approach', position: [-410, 40, 55], lookAt: [-320, 20, 0] },
    { name: 'east-backstay-and-abutment', position: [430, 54, -60], lookAt: [340, 35, 0] },
    { name: 'deck-and-cable-plan', position: [0, 950, 0.01], lookAt: [0, 0, 0] },
  ],
};
