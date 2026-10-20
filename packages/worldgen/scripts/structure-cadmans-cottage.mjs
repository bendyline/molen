/** Cadmans Cottage: whitewashed original, lower sandstone annex and broken-back shingle roof. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { decodePng16 } from '../../terrain/dist/kernel.mjs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('c4b18a'),
  light = rgb('d3c29e'),
  shadow = rgb('867c65'),
  lead = rgb('5e6968'),
  cedar = rgb('777269'),
  white = rgb('ece8dc'),
  wood = rgb('b5a477'),
  glass = rgb('6a7e7b'),
  iron = rgb('504f48');
const sitePath = new URL(
  '../../../content/worldgen/source/places/r3/r3g/cadmans_cottage/site-construction-controls.json',
  import.meta.url,
);
function siteControls() {
  return JSON.parse(fs.readFileSync(sitePath));
}
function originalGround() {
  const grid = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', sitePath))),
    desc = JSON.parse(fs.readFileSync(new URL('terrain-review.terrain.json', sitePath))),
    png = decodePng16(fs.readFileSync(new URL('terrain-review.height.png', sitePath))),
    heights = Array.from(png.data, (v) =>
      Math.fround(desc.height.min + v * (desc.height.max - desc.height.min)),
    );
  return (x, z) => {
    const fx = (x - grid.origin[0]) / grid.stepMeters,
      fz = (z - grid.origin[1]) / grid.stepMeters,
      ix = Math.floor(fx),
      iz = Math.floor(fz),
      u = fx - ix,
      v = fz - iz,
      n = grid.size[0],
      a = heights[iz * n + ix],
      b = heights[iz * n + ix + 1],
      d = heights[(iz + 1) * n + ix],
      e = heights[(iz + 1) * n + ix + 1];
    return u + v <= 1 ? a + (b - a) * u + (d - a) * v : e + (d - e) * (1 - u) + (b - e) * (1 - v);
  };
}
function horizontal(o, slot, ring, y, color) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]);
    o.addTriangle(
      slot,
      ref,
      p,
      [0, 1, 0],
      p.map(([x, , z]) => [x, z]),
      color,
    );
  }
}
function siteConstruction(o, detail) {
  const s = siteControls(),
    ground = originalGround(),
    floor = s.levels.rearCourt,
    court = s.court.outline,
    front = s.frontCourt.outline,
    level = s.levels.frontForecourt;
  horizontal(o, 'stone', court, floor, stone);
  horizontal(o, 'gravel', front, level, rgb('afa590'));
  const area = (ring) =>
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
  const join = (a, b, top, outward = 1, slot = 'stone') => {
    const normal = [outward * (b[1] - a[1]), 0, outward * (a[0] - b[0])],
      length = Math.hypot(...normal);
    for (let k = 0; k < 3; k++) normal[k] /= length;
    const count =
      detail > 1 ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5)) : 1;
    for (let j = 0; j < count; j++) {
      const p = a.map((v, k) => v + ((b[k] - v) * j) / count),
        q = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / count),
        ps = [
          [p[0], top, p[1]],
          [q[0], top, q[1]],
          [q[0], ground(...q) - 0.08, q[1]],
          [p[0], ground(...p) - 0.08, p[1]],
        ];
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const tri = ids.map((i) => ps[i]),
          n = normalFor(...tri);
        if (Math.hypot(...n) < 0.5) continue;
        o.addTriangle(
          slot,
          ref,
          tri,
          normal,
          tri.map(([x, , z]) => [x, z]),
          stone,
        );
      }
    }
  };
  // Only the exposed court boundary gets foundations; no slab runs under the cottage.
  for (const edge of [3, 4, 5])
    join(court[edge], court[(edge + 1) % court.length], floor, Math.sign(area(court)));
  join([5.8, -3.4], [s.northStair.x0, -3.4], floor, Math.sign(area(court)));
  for (const edge of s.frontCourt.terrainJoinEdges)
    join(front[edge], front[(edge + 1) % front.length], level, Math.sign(area(front)));
  const [a, b] = s.court.backEdge,
    wallTop = floor + s.levels.rearRetainingWallAboveCourt;
  beam(
    o,
    'stone',
    [a[0], floor + 0.6, a[1]],
    [b[0], floor + 0.6, b[1]],
    s.court.retainingWallWidth,
    1.2,
    stone,
  );
  beam(o, 'stone', [a[0], wallTop + 0.04, a[1]], [b[0], wallTop + 0.04, b[1]], 0.4, 0.08, light);
  const stair = s.northStair,
    count = detail > 1 ? stair.risers : detail ? 10 : 5,
    width = stair.x1 - stair.x0,
    center = (stair.x1 + stair.x0) / 2;
  for (let i = 0; i < count; i++) {
    const z0 = stair.frontZ + ((stair.rearZ - stair.frontZ) * i) / count,
      z1 = stair.frontZ + ((stair.rearZ - stair.frontZ) * (i + 1)) / count,
      y = level + ((floor - level) * (i + 1)) / count,
      bottom = Math.min(y - 0.18, ground(center, (z0 + z1) / 2) - 0.1);
    B(
      o,
      'stone',
      center,
      bottom,
      (z0 + z1) / 2,
      width,
      y - bottom,
      Math.abs(z1 - z0) + 0.015,
      stone,
    );
    // A shallow retained cut closes the lower steps where the sampled ground is higher.
    for (const x of [stair.x0, stair.x1]) {
      const g0 = ground(x, z0),
        g1 = ground(x, z1);
      if (Math.max(g0, g1) <= y) continue;
      const ps = [
        [x, y, z0],
        [x, y, z1],
        [x, Math.max(y + 0.015, g1), z1],
        [x, Math.max(y + 0.015, g0), z0],
      ];
      quad(o, 'stone', ps, [x === stair.x0 ? 1 : -1, 0, 0], stone);
    }
  }
  if (detail) {
    for (const x of [stair.x0 + 0.05, stair.x1 - 0.05]) {
      beam(
        o,
        'metal',
        [x, level + 0.95, stair.frontZ],
        [x, floor + 0.95, stair.rearZ],
        0.04,
        0.04,
        iron,
      );
      const posts = detail > 1 ? 5 : 2;
      for (let j = 0; j <= posts; j++) {
        const t = j / posts,
          z = stair.frontZ + (stair.rearZ - stair.frontZ) * t,
          y = level + (floor - level) * t;
        beam(o, 'metal', [x, y, z], [x, y + 0.95, z], 0.035, 0.035, iron);
      }
    }
    // Sparse flagging joints are geometry, with no photographic texture pixels.
    if (detail > 1)
      for (let x = -10.8; x < 7.5; x += 1.15) {
        const t = (x - a[0]) / (b[0] - a[0]),
          back = a[1] + (b[1] - a[1]) * t;
        beam(
          o,
          'stone',
          [x, floor + 0.003, -3.45],
          [x + 0.12, floor + 0.003, back + 0.18],
          0.014,
          0.006,
          shadow,
        );
      }
  }
}
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function roof(o, x, z, w, l, y, rise, d) {
  const h = Math.min(w, l) * 0.38;
  const p = [
    [-w / 2, -l / 2],
    [w / 2, -l / 2],
    [w / 2, l / 2],
    [-w / 2, l / 2],
  ].map((p) => [p[0] + x, y, p[1] + z]);
  const r =
    w < l
      ? [
          [x, y + rise, z - l / 2 + h],
          [x, y + rise, z + l / 2 - h],
        ]
      : [
          [x - w / 2 + h, y + rise, z],
          [x + w / 2 - h, y + rise, z],
        ];
  const faces =
    w < l
      ? [
          [p[0], p[1], r[0]],
          [p[1], p[2], r[1], r[0]],
          [p[2], p[3], r[1]],
          [p[3], p[0], r[0], r[1]],
        ]
      : [
          [p[0], p[1], r[1], r[0]],
          [p[1], p[2], r[1]],
          [p[2], p[3], r[0], r[1]],
          [p[3], p[0], r[0]],
        ];
  for (const f of faces) {
    let n = normalFor(...f);
    if (n[1] < 0) n = n.map((v) => -v);
    o.addConvexPolygon('annex_roof', ref, f, n, (p) => [p[0], p[2]], lead);
  }
  if (d > 2) {
    for (const f of faces) {
      const a = f[0],
        b = f[1],
        n = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.4);
      for (let i = 1; i < n; i++) {
        const t = i / n,
          p = a.map((v, j) => v + (b[j] - v) * t),
          q = f.length === 4 ? f[3].map((v, j) => v + (f[2][j] - v) * t) : f[2];
        beam(
          o,
          'annex_roof',
          p.map((v, j) => v + (j === 1 ? 0.028 : 0)),
          q.map((v, j) => v + (j === 1 ? 0.028 : 0)),
          0.035,
          0.025,
          shadow,
        );
      }
    }
  }
}
function window(o, x, y, w, h, d, columns = 3, rows = 4) {
  if (!d) return;
  B(o, 'stone', x, y - 0.12, 0.09, w + 0.25, 0.14, 0.3, stone);
  face(o, 'wood', x, y - 0.05, 0.055, w + 0.14, h + 0.12, wood);
  face(o, 'glass', x, y, 0.08, w, h, glass);
  if (d > 1) {
    for (const xx of [x - w / 2, x + w / 2]) B(o, 'wood', xx, y, 0.12, 0.065, h, 0.075, wood);
    for (let i = 0; i <= rows; i++) face(o, 'wood', x, y + (h * i) / rows, 0.18, w, 0.045, wood);
    for (let i = 1; i < columns; i++)
      face(o, 'wood', x - w / 2 + (w * i) / columns, y, 0.19, 0.04, h, wood);
    B(o, 'stone', x, y + h + 0.06, 0.09, w + 0.35, 0.19, 0.22, light);
    if (d > 2) {
      const y0 = y + h + 0.02,
        y1 = y + h + 0.4,
        p = [
          [x - w / 2, y0],
          [x + w / 2, y0],
          [x + w * 0.7, y1],
          [x - w * 0.7, y1],
        ];
      quad(
        o,
        'stone',
        p.map((v) => [...v, 0.13]),
        [0, 0, 1],
        light,
      );
      for (const t of [-0.25, 0.25])
        quad(
          o,
          'stone',
          [
            [x + t * w, y0, 0.14],
            [x + t * w + 0.018, y0, 0.14],
            [x + t * w * 1.3 + 0.018, y1, 0.14],
            [x + t * w * 1.3, y1, 0.14],
          ],
          [0, 0, 1],
          shadow,
        );
    }
  }
}
function door(o, x, y, w, h, d) {
  if (!d) return;
  face(o, 'stone', x, y - 0.07, 0.055, w + 0.4, h + 0.2, stone);
  face(o, 'wood', x, y, 0.08, w, h, wood);
  if (d > 1) {
    for (const xx of [x - w / 2, x + w / 2]) B(o, 'wood', xx, y, 0.13, 0.08, h, 0.12, wood);
    for (const yy of [y + h * 0.25, y + h * 0.6, y + h * 0.9])
      face(o, 'wood', x, yy, 0.15, w - 0.2, 0.045, light);
    for (const yy of [y + h * 0.05, y + h * 0.3, y + h * 0.65])
      face(o, 'wood', x, yy, 0.14, w - 0.25, h * 0.18, wood);
    B(o, 'stone', x, y + h, 0.13, w + 0.48, 0.18, 0.3, light);
    B(o, 'stone', x, y - 0.1, 0.25, w + 0.4, 0.15, 0.5, stone);
    B(o, 'metal', x + w * 0.34, y + h * 0.45, 0.18, 0.045, 0.12, 0.045, iron);
  }
}
function mainShell(o, d) {
  const profile = [
    [-1.8, -3.4],
    [-1.8, 3.35],
    [6.05, 3.35],
    [8.1, 0.55],
    [6.65, -1.5],
    [5.8, -3.4],
  ];
  for (const x of [-5.95, 5.8]) {
    const p = profile.map(([y, z]) => [x, y, z]),
      indices = earcut(profile.flat());
    for (let i = 0; i < indices.length; i += 3) {
      const q = indices.slice(i, i + 3).map((j) => p[j]);
      o.addTriangle(
        'plaster',
        ref,
        q,
        [Math.sign(x), 0, 0],
        q.map((p) => [p[2], p[1]]),
        white,
      );
    }
  }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      p = [
        [-5.95, a[0], a[1]],
        [5.8, a[0], a[1]],
        [5.8, b[0], b[1]],
        [-5.95, b[0], b[1]],
      ],
      isRoof = i > 1 && i < 5;
    quad(o, isRoof ? 'roof' : 'plaster', p, normalFor(...p), isRoof ? cedar : white);
  }
  for (const sign of [-1, 1]) {
    const x = sign < 0 ? -5.95 : 5.8;
    B(o, 'stone', x - 0.01, -1.8, 3.35, 0.42, 7.88, 0.28, light);
    B(o, 'stone', x - 0.01, -1.8, -3.4, 0.42, 7.6, 0.28, stone);
  }
  for (const [z, y] of [
    [3.35, 6.0],
    [-3.4, 5.75],
  ]) {
    B(o, 'wood', -0.075, y, z, 12.25, 0.18, 0.3, wood);
    B(o, 'stone', -0.075, 3.0, z, 11.75, 0.15, 0.11, light);
  }
  // Shingle roof overhang and visible weathered ridge, repeated finer detail only nearby.
  for (const sign of [-1, 1]) {
    const x = sign < 0 ? -6.15 : 6;
    for (const [a, b] of [
      [
        [3.7, 5.96],
        [0.55, 8.1],
      ],
      [
        [0.55, 8.1],
        [-1.5, 6.65],
      ],
      [
        [-1.5, 6.65],
        [-3.7, 5.7],
      ],
    ])
      beam(o, 'wood', [x, a[1], a[0]], [x, b[1], b[0]], 0.16, 0.16, wood);
  }
  beam(o, 'roof', [-6.2, 8.13, 0.55], [6.05, 8.13, 0.55], 0.16, 0.18, cedar);
  if (d > 1) {
    for (const [x, z, y] of [
      [-5.25, 3.45, 5.8],
      [5.1, 3.45, 5.8],
      [-5.25, -3.5, 5.65],
    ]) {
      beam(o, 'metal', [x, y, z], [x, 1.0, z], 0.075, 0.075, iron);
      beam(o, 'metal', [x, y, z], [x, y + 0.25, z - 0.15], 0.075, 0.075, iron);
    }
    if (d > 2)
      for (const z of [3.35, -3.4])
        for (let x = -5.4; x < 5.7; x += 0.7) B(o, 'wood', x, 5.7, z, 0.1, 0.3, 0.36, wood);
  }
  for (const x of [-4.9, 4.75]) {
    B(o, 'stone', x, 6.95, 0.55, 0.65, 1.8, 0.7, stone);
    B(o, 'stone', x, 8.52, 0.55, 0.83, 0.18, 0.88, light);
    if (d > 1) {
      B(o, 'stone', x, 8.72, 0.55, 0.76, 0.15, 0.82, light);
      B(o, 'metal', x, 8.87, 0.55, 0.5, 0.035, 0.55, iron);
    }
  }
  const front = facing(o, 0, 0, 3.36);
  for (const x of [-3.55, 0, 3.45]) window(front, x, 3.7, 1.03, 1.72, d);
  for (const x of [-3.55, 3.45]) window(front, x, 0.35, 1.04, 2.0, d, 4, 4);
  door(front, 0, 0.18, 1.08, 2.25, d);
  const rear = facing(o, Math.PI, -0.075, -3.41);
  for (const x of [-3.5, 3.5]) window(rear, x, 4.25, 1.75, 0.95, d, 3, 2);
  door(rear, 0, 3.35, 1.12, 2.15, d);
  // North gable has two upper openings; service-side masonry continues below the raised path.
  const north = facing(o, Math.PI / 2, 5.82, 0);
  for (const z of [-1.65, 1.65]) window(north, z, 3.7, 1.02, 1.65, d);
  if (d > 2)
    for (const [z, y] of [
      [3.37, 0.9],
      [-3.42, 1.5],
    ]) {
      const f = facing(o, z > 0 ? 0 : Math.PI, 0, z);
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 8; i++) {
          const xx = -5.8 + i * 1.48 + (j % 2) * 0.3;
          if (Math.abs(xx) < 0.8) continue;
          face(f, 'plaster', xx, y + j * 0.4, 0.01, 0.75, 0.07, rgb(j % 2 ? 'dedacf' : 'e2ded3'));
        }
    }
}
function annex(o, d) {
  B(o, 'stone', -8.72, -1.8, -0.25, 5.5, 5.8, 5.0, stone);
  roof(o, -8.72, -0.25, 5.5, 5.0, 3.95, 0.8, 0);
  for (const [a, x, z, w] of [
    [0, -8.72, 2.25, 5.5],
    [Math.PI, -8.72, -2.75, 5.5],
    [-Math.PI / 2, -11.47, -0.25, 5],
  ]) {
    const f = facing(o, a, x, z);
    B(f, 'stone', 0, 3.95, 0, w, 0.36, 0.25, light);
    B(f, 'stone', 0, 4.31, 0.03, w + 0.2, 0.16, 0.42, stone);
    B(f, 'stone', 0, 3.15, 0.04, w, 0.15, 0.18, light);
  }
  if (!d) return;
  const f = facing(o, 0, 0, 2.26);
  for (const x of [-10.1, -7.35]) {
    const w = 1.35,
      h = 3.2,
      r = w / 2,
      ys = 0.05 + h - r,
      p = [
        [x - r, 0.05, 0.09],
        [x + r, 0.05, 0.09],
        [x + r, ys, 0.09],
      ];
    const n = d > 1 ? 12 : 6;
    for (let i = 1; i <= n; i++) {
      const a = (i / n) * Math.PI;
      p.push([x + r * Math.cos(a), ys + r * Math.sin(a), 0.09]);
    }
    f.addConvexPolygon('wood', ref, p, [0, 0, 1], (p) => [p[0], p[1]], rgb('e0e4da'));
    face(f, 'wood', x, 0.05, 0.11, w, 2.45, rgb('625d52'));
    if (d > 1) {
      for (const xx of [x - r, x + r]) B(f, 'stone', xx, 0.05, 0.13, 0.15, 2.5, 0.25, light);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI,
          b = ((i + 1) / n) * Math.PI,
          q = [
            [x + r * Math.cos(a), ys + r * Math.sin(a), 0.14],
            [x + r * Math.cos(b), ys + r * Math.sin(b), 0.14],
            [x + (r + 0.15) * Math.cos(b), ys + (r + 0.15) * Math.sin(b), 0.14],
            [x + (r + 0.15) * Math.cos(a), ys + (r + 0.15) * Math.sin(a), 0.14],
          ];
        quad(f, 'stone', q, [0, 0, 1], light);
      }
      for (let i = 1; i < 6; i++)
        face(f, 'wood', x - r + (w * i) / 6, 0.05, 0.12, 0.025, 2.43, iron);
      B(f, 'metal', x + 0.35, 1.4, 0.17, 0.07, 0.07, 0.07, iron);
    }
  }
}
export function cadmans(o, _frame, d = 3) {
  mainShell(o, d);
  annex(o, d);
  siteConstruction(o, d);
  // Verified original2009public-domain front image shows a low, dark stone plinth
  // and a narrow flagging edge. The raised rear court is a separate retained
  // structure; all source terrain and original doorway levels remain fixed.
  for (const [x0, x1, z] of [
    [-5.95, -0.8, 3.4],
    [0.8, 5.8, 3.4],
    [-11.47, -5.95, 2.3],
  ]) {
    B(o, 'stone', (x0 + x1) / 2, -0.08, z, x1 - x0, 0.18, 0.22, shadow);
    B(o, 'stone', (x0 + x1) / 2, -0.16, z + 0.3, x1 - x0, 0.14, 0.62, stone);
  }
}
export function cadmansSkyline(o) {
  cadmans(o, undefined, 0);
}
export function cadmansDistrict(o) {
  cadmans(o, undefined, 1);
}
export function cadmansStreet(o) {
  cadmans(o, undefined, 2);
}
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.96, metallic: 0 },
  annex_roof: { slot: 'roof', graph: 'slate', roughness: 0.93, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.25 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
  gravel: { slot: 'wall', graph: 'gravel', roughness: 0.96, metallic: 0 },
};
export const cadmansModel = {
  id: 'cadmans_cottage',
  key: 'cadmans_cottage',
  recipe: 'structure-cadmans-cottage.mjs',
  cell: 'r3/r3g',
  title: 'Cadmans Cottage',
  brief:
    'Small whitewashed Georgian sandstone cottage with three-bay two-storey east facade, raised west doorway under a broken-back shingle roof, two end chimneys, ochre sash frames and a lower bare-sandstone southern annex with two tall arched doors.',
  camera: [23, 17, 27],
  lookAt: [-2.7, 3.3, 0],
  qaCameras: [
    { name: 'front', position: [-5, 8, 29], lookAt: [-2.6, 3.3, 0] },
    { name: 'back', position: [-14, 12, -24], lookAt: [-2.6, 3.5, 0] },
    { name: 'lower-window-sashes', position: [4.8, 2, 8.5], lookAt: [3.45, 1.4, 3.4] },
    { name: 'rear-window-sashes', position: [-4, 5.5, -8], lookAt: [-3.575, 4.75, -3.5] },
    { name: 'rear-court-detail', position: [-17, 10, -15], lookAt: [-2.5, 3.5, -4.6] },
    { name: 'north-stair-detail', position: [17, 6, 10], lookAt: [7.4, 1.7, 0] },
    { name: 'front-paving-detail', position: [-7, 2.2, 11], lookAt: [-3, 0, 4.1] },
  ],
  build: cadmans,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Bounded exterior placement on the preserved east-approach datum. Physical front paving and solid north stairs cover two separate ground openings; the rear doorway is reached by a sandstone courtyard and documented 1.2m retaining wall. Native heights, anchor, heading and cottage floor levels are unchanged. Court/stair extents and foundation burial are medium-fi interpretations, not civil survey.',
  groundCutout: {
    outline: siteControls().frontCourt.outline,
    additionalOutlines: [
      (() => {
        const s = siteControls().northStair;
        return [
          [s.x0, s.frontZ],
          [s.x1, s.frontZ],
          [s.x1, s.rearZ],
          [s.x0, s.rearZ],
        ];
      })(),
    ],
    basis:
      'Physical gravel/flagged forecourt and masonry north stair only. Source native heights remain unchanged. Every opening is covered by modeled paving or solid stair geometry; rear court is raised on its own retaining structure, not a whole-building pad.',
  },
  mediumFiContext: { scale: 0.3 },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cadmans-cottage.mjs',
    level: 'skyline',
    export: 'cadmansSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'cadmansDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'cadmansStreet', errorMeters: 0.06, surfaces },
    },
  },
  limitations: [
    'Front construction uses the exact archived 2009 Julioenrekei original and its contemporaneous uploader-authored public-domain release: muted weathered shingles, separate dark annex slate, front sash patterns, stone plinth and narrow flagging edge. The mismatched 2013 Qualla overwrite, earlier attribution-licensed front/rear photographs and copyrighted plan illustrations are excluded. Dimensions, concealed details and rear elevations remain estimates.',
    'Cottage, southern annex, rear court and immediate paving/stair only. Neighboring Sailors Home, public stair farther north, historic shoreline, interiors, trees and furnishings excluded.',
    'Rear sandstone paving and 1.2m retaining-wall height follow conservation-report text; court depth follows an interpreted offset from the independently mapped rear footpath. The 20-riser private connector, paving levels and wall foundations are interpreted exterior construction. Native terrain is coarse and cannot establish exact terrace or AHD doorway levels. No terrain values or original floor levels are changed. Footprint replacement disabled; source photos are not redistributed.',
    'Fine stone wear, lintel inscriptions and plaque lettering omitted; glazing bars, stone bands, chimneys and timber roof details simplified by distance.',
  ],
};
