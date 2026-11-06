/** Original complete current Rosenborg principal castle,gatehouse and structural entry exterior. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const rosenborgControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = rosenborgControls,
  H = a.geometryControls.levels,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  parts = JSON.parse(readFileSync(new URL('../mapped-parts.json', import.meta.url))).parts;
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    brick: lin('a17462'),
    stone: lin('d0c5b2'),
    copper: lin('709b90'),
    glass: lin('718592'),
    tile: lin('5d6465'),
    metal: lin('444e4d'),
    gold: lin('c4ac70'),
    dark: lin('656057'),
  };
export const rosenborgSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
  wall: { slot: 'wall', graph: 'brick_flemish', roughness: 0.84, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.57, metallic: 0.55 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.35, metallic: 0.08 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.63, metallic: 0.2 },
};
const cfg = {
  skyline: { far: true, sides: 4, roof: 2, bays: 5 },
  district: { sides: 8, roof: 3, bays: 10, flat: true },
  street: {
    sides: 12,
    roof: 5,
    bays: 12,
    flatFrames: true,
    frames: true,
    bands: true,
    scrolls: true,
  },
  closeup: {
    sides: 24,
    roof: 10,
    bays: 12,
    frames: true,
    bands: true,
    scrolls: true,
    detail: true,
  },
  master: {
    sides: 48,
    roof: 20,
    bays: 12,
    frames: true,
    bands: true,
    scrolls: true,
    detail: true,
    fine: true,
  },
};
export function rosenborgGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.max(0, Math.min(127, Math.floor(u))),
    j = Math.max(0, Math.min(127, Math.floor(v))),
    p = Math.max(0, Math.min(1, u - i)),
    q = Math.max(0, Math.min(1, v - j)),
    h = g.elevationsMeters,
    n = g.size[0];
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const S = (c, s) => (c.far ? 'far' : s),
  rect = (x, z, w, d, y) => [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ];
function B(o, c, lo, hi, s = 'wall', color = C.brick) {
  if (hi.some((v, i) => v <= lo[i])) return;
  box(o, S(c, s), lo, hi, color);
}
function Q(o, c, p, s, color) {
  o.addQuad(
    S(c, s),
    s === 'wall' ? 'palette:#ffffff' : 'metric:uv',
    p,
    normalFor(...p),
    [
      [0, 0],
      [Math.hypot(...p[1].map((v, i) => v - p[0][i])), 0],
      [
        Math.hypot(...p[1].map((v, i) => v - p[0][i])),
        Math.hypot(...p[3].map((v, i) => v - p[0][i])),
      ],
      [0, Math.hypot(...p[3].map((v, i) => v - p[0][i]))],
    ],
    color,
  );
}
function L(o, c, r, s = 'wall', color = C.brick, cap = true) {
  loft(o, S(c, s), r, color, { cap });
}
function polygon(o, c, rings, y, s = 'wall', color = C.brick, up = true) {
  const flat = rings.flat(),
    ids = earcut(
      flat.flat(),
      rings.length > 1 ? rings.slice(0, -1).map((_, i) => rings.slice(0, i + 1).flat().length) : [],
      2,
    );
  for (let k = 0; k < ids.length; k += 3) {
    let p = ids.slice(k, k + 3).map((i) => [flat[i][0], y, flat[i][1]]);
    if (normalFor(...p)[1] > 0 !== up) p = [p[0], p[2], p[1]];
    o.addTriangle(
      S(c, s),
      'metric:uv',
      p,
      up ? [0, 1, 0] : [0, -1, 0],
      p.map((p) => [p[0], p[2]]),
      color,
    );
  }
}
function extrude(o, c, r, lo, hi, s = 'wall', color = C.brick) {
  let ring = r.slice();
  if (ring.length > 2 && Math.hypot(...ring[0].map((v, i) => v - ring.at(-1)[i])) < 0.001)
    ring.pop();
  const area = ring.reduce((t, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return t + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area > 0) ring.reverse();
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length];
    Q(
      o,
      c,
      [
        [p[0], lo, p[1]],
        [q[0], lo, q[1]],
        [q[0], hi, q[1]],
        [p[0], hi, p[1]],
      ],
      s,
      color,
    );
  }
  polygon(o, c, [ring], hi, s, color);
  polygon(o, c, [ring], lo, s, color, false);
}
function footing(o, c, r, top = 0.35) {
  const xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]);
  let base = -0.6;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2)
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 2)
      base = Math.min(base, rosenborgGroundY(x, z) - 0.35);
  extrude(o, c, r, base, top, 'stone', C.stone);
}
function roof(o, c, x, z, w, d, eave, ridge, s = 'copper', color = C.copper) {
  L(o, c, [rect(x, z, w, d, eave), rect(x, z, w, 0.06, ridge)], s, color);
  if (c.detail)
    for (let u = x - w / 2 + 0.8; u < x + w / 2; u += 0.9)
      for (const sign of [-1, 1])
        beam(
          o,
          S(c, s),
          [u, eave + 0.035, z + (sign * d) / 2],
          [u, ridge + 0.035, z],
          0.028,
          0.028,
          color,
        );
}
function window(o, c, center, axis, w, h, pediment = false, faceSign = 1) {
  const [x, y, z] = center,
    n = axis === 0 ? [1, 0, 0] : [0, 0, 1],
    u = axis === 0 ? [0, 0, 1] : [1, 0, 0],
    p = (t, v, d = 0) => [x + u[0] * t + n[0] * d, y + v, z + u[2] * t + n[2] * d];
  const glass = [
    p(-w / 2, 0, 0.025 * faceSign),
    p(w / 2, 0, 0.025 * faceSign),
    p(w / 2, h, 0.025 * faceSign),
    p(-w / 2, h, 0.025 * faceSign),
  ];
  if ((axis === 0 ? -1 : 1) !== faceSign) glass.reverse();
  Q(o, c, glass, 'glass', C.glass);
  if (!c.frames) return;
  if (c.flatFrames) {
    const strip = (u0, u1, v0, v1) => {
      const q = [
        p(u0, v0, 0.06 * faceSign),
        p(u1, v0, 0.06 * faceSign),
        p(u1, v1, 0.06 * faceSign),
        p(u0, v1, 0.06 * faceSign),
      ];
      if ((axis === 0 ? -1 : 1) !== faceSign) q.reverse();
      Q(o, c, q, 'stone', C.stone);
    };
    for (const t of [-w / 2, 0, w / 2]) strip(t - 0.055, t + 0.055, -0.1, h + 0.1);
    for (const v of [0, h * 0.52, h]) strip(-w / 2 - 0.12, w / 2 + 0.12, v - 0.055, v + 0.055);
    return;
  }
  for (const t of [-w / 2, 0, w / 2])
    beam(
      o,
      S(c, 'stone'),
      p(t, -0.1, 0.06 * faceSign),
      p(t, h + 0.1, 0.06 * faceSign),
      0.1,
      0.13,
      C.stone,
    );
  for (const v of [0, h * 0.52, h])
    beam(
      o,
      S(c, 'stone'),
      p(-w / 2 - 0.15, v, 0.06 * faceSign),
      p(w / 2 + 0.15, v, 0.06 * faceSign),
      0.11,
      0.14,
      C.stone,
    );
  if (pediment) {
    beam(
      o,
      S(c, 'stone'),
      p(-w / 2 - 0.2, h + 0.2, 0.09 * faceSign),
      p(0, h + 0.65, 0.09 * faceSign),
      0.14,
      0.18,
      C.stone,
    );
    beam(
      o,
      S(c, 'stone'),
      p(0, h + 0.65, 0.09 * faceSign),
      p(w / 2 + 0.2, h + 0.2, 0.09 * faceSign),
      0.14,
      0.18,
      C.stone,
    );
  }
}
function bands(o, c, x, z, w, d, height) {
  if (!c.bands) return;
  for (let y = 0.45; y < height; y += 4.4) {
    B(
      o,
      c,
      [x - w / 2 - 0.06, y, z - d / 2 - 0.06],
      [x + w / 2 + 0.06, y + 0.16, z + d / 2 + 0.06],
      'stone',
      C.stone,
    );
    for (const dx of [-w / 2, w / 2])
      for (const dz of [-d / 2, d / 2])
        for (let yy = y + 0.3; yy < Math.min(y + 4.4, height); yy += c.flatFrames ? 1.3 : 0.65)
          B(
            o,
            c,
            [x + dx - 0.13, yy, z + dz - 0.13],
            [x + dx + 0.13, yy + 0.4, z + dz + 0.13],
            'stone',
            C.stone,
          );
  }
}
function lantern(o, c, x, z, base, r, height, stages = 2) {
  const stageH = height / stages;
  for (let j = 0; j < stages; j++) {
    const y = base + j * stageH,
      R = r * (1 - j * 0.24),
      ceil = y + stageH * 0.55;
    L(
      o,
      c,
      [
        radialRing(y, R * 1.22, R * 1.22, c.sides, [x, z]),
        radialRing(y + 0.2, R * 1.22, R * 1.22, c.sides, [x, z]),
      ],
      'copper',
      C.copper,
    );
    const posts = c.far ? 4 : 8;
    for (let i = 0; i < posts; i++) {
      const angle = (i / posts) * Math.PI * 2,
        px = x + Math.cos(angle) * R * 0.91,
        pz = z + Math.sin(angle) * R * 0.91;
      if (c.far) {
        const tx = -Math.sin(angle) * 0.14,
          tz = Math.cos(angle) * 0.14,
          q = [
            [px - tx, y + 0.2, pz - tz],
            [px + tx, y + 0.2, pz + tz],
            [px + tx, ceil, pz + tz],
            [px - tx, ceil, pz - tz],
          ];
        Q(o, c, q, 'copper', C.copper);
        Q(o, c, [...q].reverse(), 'copper', C.copper);
      } else
        B(o, c, [px - 0.09, y + 0.2, pz - 0.09], [px + 0.09, ceil, pz + 0.09], 'copper', C.copper);
    }
    L(
      o,
      c,
      [
        radialRing(ceil, R * 1.23, R * 1.23, c.sides, [x, z]),
        radialRing(ceil + 0.18, R * 1.26, R * 1.26, c.sides, [x, z]),
        radialRing(y + stageH, R * 0.63, R * 0.63, c.sides, [x, z]),
      ],
      'copper',
      C.copper,
    );
  }
  const tip = base + height;
  L(
    o,
    c,
    [
      radialRing(tip, r * 0.3, r * 0.3, c.sides, [x, z]),
      radialRing(tip + 1.2, 0.035, 0.035, c.sides, [x, z]),
    ],
    'copper',
    C.copper,
  );
  if (c.frames) {
    beam(o, S(c, 'metal'), [x, tip + 1.2, z], [x, tip + 2.4, z], 0.045, 0.045, C.gold);
    B(o, c, [x - 0.45, tip + 1.9, z - 0.025], [x + 0.4, tip + 2.12, z + 0.025], 'metal', C.gold);
  }
}
function tower(o, c, x, z, w, d, top, great = false) {
  B(o, c, [x - w / 2, 0.35, z - d / 2], [x + w / 2, top, z + d / 2]);
  bands(o, c, x, z, w, d, top);
  if (!c.far) {
    for (let y = 1.4; y < top - 2; y += 4.4) {
      window(o, c, [x, y, z - d / 2 - 0.035], 1, 1.55, 2.65, true, -1);
      window(o, c, [x, y, z + d / 2 + 0.035], 1, 1.55, 2.65, true);
      for (const dx of [-w / 2, w / 2])
        window(
          o,
          c,
          [x + dx + (dx > 0 ? 0.035 : -0.035), y, z],
          0,
          1.55,
          2.65,
          true,
          Math.sign(dx),
        );
    }
  }
  const r = Math.max(w, d) / 2,
    rings = [];
  for (let i = 0; i <= c.roof; i++) {
    const t = i / c.roof,
      R = r * (1 - 0.32 * Math.sin((t * Math.PI) / 2));
    if (great) rings.push(radialRing(top + t * 2.7, R, R, c.sides, [x, z], Math.PI / 8));
    else
      rings.push(
        rect(
          x,
          z,
          w * (1 - 0.3 * Math.sin((t * Math.PI) / 2)),
          d * (1 - 0.3 * Math.sin((t * Math.PI) / 2)),
          top + t * 2.7,
        ),
      );
  }
  L(o, c, rings, 'copper', C.copper);
  lantern(o, c, x, z, top + 2.7, great ? 2.4 : 1.65, great ? 15.6 : 7.2, great ? 3 : 2);
}
function stair(o, c) {
  const x = 0.28,
    z = -8.5,
    r = 3.1,
    wall = H.stairWall;
  L(o, c, [
    radialRing(0.35, r, r, 8, [x, z], Math.PI / 8),
    radialRing(wall, r, r, 8, [x, z], Math.PI / 8),
  ]);
  for (let y = 1; y < wall - 1; y += 3.4)
    if (!c.far) window(o, c, [x, y, z - r - 0.03], 1, 1.2, 1.8, false, -1);
  const rings = [];
  for (let i = 0; i <= c.roof; i++) {
    const t = i / c.roof,
      R = r * (0.1 + 0.99 * Math.cos((t * Math.PI) / 2));
    rings.push(radialRing(wall + t * 3.3, R, R, c.sides, [x, z], Math.PI / 8));
  }
  L(o, c, rings, 'copper', C.copper);
  L(
    o,
    c,
    [
      radialRing(wall + 3.3, 0.34, 0.34, c.sides, [x, z]),
      radialRing(21.6, 0.02, 0.02, c.sides, [x, z]),
    ],
    'copper',
    C.copper,
  );
}
function gable(o, c, axis, plane, center, base, width, height) {
  const pts = [
      [-width / 2, 0],
      [-width / 2, 0.2],
      [-width * 0.43, 0.65],
      [-width * 0.35, height * 0.3],
      [-width * 0.32, height * 0.45],
      [-width * 0.2, height * 0.48],
      [-width * 0.2, height * 0.7],
      [-width * 0.12, height * 0.72],
      [-width * 0.12, height * 0.88],
      [0, height],
      [width * 0.12, height * 0.88],
      [width * 0.12, height * 0.72],
      [width * 0.2, height * 0.7],
      [width * 0.2, height * 0.48],
      [width * 0.32, height * 0.45],
      [width * 0.35, height * 0.3],
      [width * 0.43, 0.65],
      [width / 2, 0.2],
      [width / 2, 0],
    ],
    P = (u, v, d = 0) =>
      axis === 0 ? [plane + d, base + v, center + u] : [center + u, base + v, plane + d],
    shape = c.far
      ? [
          [-width / 2, 0],
          [-width * 0.3, height * 0.4],
          [-width * 0.12, height * 0.72],
          [0, height],
          [width * 0.12, height * 0.72],
          [width * 0.3, height * 0.4],
          [width / 2, 0],
        ]
      : pts,
    flat = shape.flat(),
    idx = earcut(flat, [], 2);
  for (const d of [-0.2, 0.2])
    for (let k = 0; k < idx.length; k += 3) {
      let p = idx.slice(k, k + 3).map((i) => P(...shape[i], d));
      if (Math.sign(normalFor(...p)[axis === 0 ? 0 : 2]) !== Math.sign(d)) p.reverse();
      o.addTriangle(
        S(c, 'wall'),
        'metric:uv',
        p,
        normalFor(...p),
        idx.slice(k, k + 3).map((i) => shape[i]),
        C.brick,
      );
    }
  for (let i = 0; i < shape.length; i++) {
    const p = shape[i],
      q = shape[(i + 1) % shape.length];
    Q(o, c, [P(...p, -0.2), P(...q, -0.2), P(...q, 0.2), P(...p, 0.2)], 'stone', C.stone);
    if (c.frames && i < pts.length - 1)
      beam(o, S(c, 'stone'), P(...p, 0.24), P(...q, 0.24), 0.12, 0.18, C.stone);
  }
  if (c.scrolls)
    for (const sign of [-1, 1]) {
      let previous;
      const count = c.fine ? 36 : c.detail ? 20 : 10;
      for (let j = 0; j <= count; j++) {
        const t = (j / count) * 2.7 * Math.PI,
          R = 0.85 * (1 - (j / count) * 0.7),
          p = P(sign * (width * 0.25 + Math.cos(t) * R), height * 0.3 + Math.sin(t) * R, 0.28);
        if (previous) beam(o, S(c, 'stone'), previous, p, 0.1, 0.1, C.stone);
        previous = p;
      }
    }
}
function main(o, c) {
  B(o, c, [-22.85, 0.35, -5.5], [22.65, H.bodyEave, 5.1]);
  roof(o, c, -0.1, -0.2, 45.2, 11.8, H.bodyEave, H.mainRidge);
  bands(o, c, -0.1, -0.2, 45.5, 10.6, H.bodyEave);
  for (const sign of [-1, 1]) {
    gable(o, c, 0, sign * 22.9, -0.2, 13.5, 10.8, 10.6);
    for (const z of [-2.8, 2.4]) {
      const x = sign * 23.03;
      B(o, c, [x - 0.4, 0.8, z - 0.9], [x + 0.4, 13.7, z + 0.9]);
      if (!c.far)
        for (const y of [1.5, 5.7, 10])
          window(o, c, [x + sign * 0.43, y, z], 0, 1.4, 2.7, true, sign);
      if (!c.far)
        L(
          o,
          c,
          [rect(x, z, 0.95, 2, 13.7), rect(x, z, 0.85, 1.8, 14.15), rect(x, z, 0.08, 0.12, 15.2)],
          'stone',
          C.stone,
        );
    }
  }
  if (!c.far)
    for (const sign of [-1, 1])
      for (let i = 0; i < c.bays; i++) {
        const x = -21.2 + (42.4 * i) / (c.bays - 1);
        if (sign > 0 && Math.abs(x) < 4) continue;
        if (sign < 0 && ((x > -16.5 && x < -9) || (x > 7.9 && x < 15.5) || Math.abs(x) < 3.5))
          continue;
        for (const y of [1.4, 5.7, 10])
          window(o, c, [x, y, sign > 0 ? 5.135 : -5.535], 1, 1.45, 2.75, true, sign);
      }
  if (!c.far)
    for (const x of [-12.7, 11.75]) {
      gable(o, c, 1, 5.6, x, 13.5, 5.8, 6.3);
      window(o, c, [x, 14.1, 5.86], 1, 1.55, 2.1, true);
    }
  for (const x of c.far ? [-18, 6] : [-18, -9, 6, 17])
    for (const z of [-2.7, 2.3]) {
      B(o, c, [x - 0.32, 17, z - 0.32], [x + 0.32, 22, z + 0.32]);
      if (c.frames)
        B(o, c, [x - 0.43, 21.7, z - 0.43], [x + 0.43, 22.1, z + 0.43], 'stone', C.dark);
    }
}

function gatehouse(o, c) {
  const cos = 0.98853,
    sin = 0.15102,
    cx = -36.2,
    cz = -7.05,
    P = ([x, y, z]) => [cx + cos * x - sin * z, y + 0.45, cz + sin * x + cos * z],
    N = ([x, y, z]) => [cos * x - sin * z, y, sin * x + cos * z],
    go = new Proxy(o, {
      get(target, key) {
        if (['addQuad', 'addTriangle', 'addConvexPolygon'].includes(key))
          return (...args) => {
            args[2] = args[2].map(P);
            args[3] = N(args[3]);
            return target[key](...args);
          };
        return target[key];
      },
    });
  const y = H.gatehouseEave,
    r = 1.45,
    spring = 2.35;
  for (const [lo, hi] of [
    [-12.5, -r],
    [r, 12.5],
  ])
    B(go, c, [-4.2, 0.35, lo], [4.2, y, hi]);
  const seg = c.far ? 2 : c.flat ? 4 : c.detail ? 14 : 8;
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI,
      T = ((i + 1) / seg) * Math.PI,
      z0 = -r * Math.cos(t),
      z1 = -r * Math.cos(T),
      y0 = spring + r * Math.sin(t),
      y1 = spring + r * Math.sin(T);
    for (const x of [-4.2, 4.2]) {
      let ps = [
        [x, y0, z0],
        [x, y1, z1],
        [x, y, z1],
        [x, y, z0],
      ];
      if (x > 0) ps.reverse();
      Q(go, c, ps, 'wall', C.brick);
    }
    Q(
      go,
      c,
      [
        [-4.2, y0, z0],
        [4.2, y0, z0],
        [4.2, y1, z1],
        [-4.2, y1, z1],
      ],
      'stone',
      C.stone,
    );
  }
  B(go, c, [-4.2, y - 0.05, -r], [4.2, y, r]);
  L(go, c, [rect(0, 0, 9, 26.5, y), rect(0, 0, 0.08, 21, H.gatehouseRidge)], 'tile', C.tile);
  gable(go, c, 0, -4.35, 0, 6.9, 7, 4.3);
  if (!c.far)
    for (const sign of [-1, 1])
      for (const z of [-10.3, -7, -3.7, 3.7, 7, 10.3])
        for (const yy of [1.4, 4.6]) window(go, c, [sign * 4.24, yy, z], 0, 1.1, 1.9, false, sign);
  const actual = parts[15].polygons[0][0];
  footing(o, c, actual, 0.8);
  entryApproach(o, c, [-32.05, -6.42], [-26.74, -6.58]);
  if (!c.far) {
    for (const z of [-1.12, 1.12]) window(go, c, [-4.6, 7.3, z], 0, 1.45, 1.65, false, -1);
    archBorder(go, c, 0, -4.5, 0, 0.35, 1.55, 2.35);
    for (const yy of [0.4, 4.25, 6.8])
      B(go, c, [-4.55, yy, -4.1], [-4.21, yy + 0.18, 4.1], 'stone', C.stone);
    if (c.detail) for (const z of [-3.5, 3.5]) statue(go, c, [-4.47, 8.7, z], 1.2);
  }
}

function gableDetails(o, c) {
  if (c.far) return;
  for (const sign of [-1, 1]) {
    const x = sign * 23.15;
    for (const [z, y, w, h] of [
      [-2.1, 14.2, 1.4, 2],
      [2.1, 14.2, 1.4, 2],
      [-1.1, 18, 1.1, 1.6],
      [1.1, 18, 1.1, 1.6],
      [0, 21, 1, 1.25],
    ])
      window(o, c, [x, y, z - 0.2], 0, w, h, false, sign);
    if (c.frames) {
      for (const y of [13.65, 17.5, 20.4])
        B(o, c, [x - 0.07, y, -3.4], [x + 0.07, y + 0.16, 3], 'stone', C.stone);
      for (const z of [-3.4, 3]) statue(o, c, [x, 15.1, z], 1.5);
    }
  }
}
function archBorder(o, c, axis, plane, u, base, r, spring) {
  if (!c.frames) return;
  const P = (v, h) => (axis === 0 ? [plane, base + h, u + v] : [u + v, base + h, plane]),
    n = c.flatFrames ? 5 : c.detail ? 14 : 8;
  for (const v of [-r, r]) beam(o, S(c, 'stone'), P(v, 0), P(v, spring), 0.24, 0.2, C.stone);
  let prev = P(-r, spring);
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * Math.PI,
      p = P(-r * Math.cos(t), spring + r * Math.sin(t));
    beam(o, S(c, 'stone'), prev, p, 0.25, 0.2, C.stone);
    prev = p;
  }
}
function closedDoor(o, c, axis, plane, u, base, width, height, face) {
  if (c.far) return;
  const r = width / 2,
    spring = height - r,
    P = (v, h) => (axis === 0 ? [plane, base + h, u + v] : [u + v, base + h, plane]),
    ps = [
      P(-r, 0),
      P(r, 0),
      ...Array.from({ length: c.detail ? 15 : 7 }, (_, i) => {
        const n = c.detail ? 14 : 6,
          t = (i / n) * Math.PI;
        return P(r * Math.cos(t), spring + r * Math.sin(t));
      }),
    ],
    flat = ps.map((p) => (axis === 0 ? [p[2], p[1]] : [p[0], p[1]])),
    ids = earcut(flat.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3) {
    let q = ids.slice(i, i + 3).map((i) => ps[i]);
    if (Math.sign(normalFor(...q)[axis === 0 ? 0 : 2]) !== face) q.reverse();
    o.addTriangle(
      S(c, 'metal'),
      'metric:uv',
      q,
      normalFor(...q),
      ids.slice(i, i + 3).map((j) => flat[j]),
      C.dark,
    );
  }
  archBorder(o, c, axis, plane + face * 0.02, u, base, r + 0.12, spring);
  if (c.detail) {
    const p = P(0, 0.1),
      q = P(0, spring + r - 0.1);
    beam(o, S(c, 'metal'), p, q, 0.05, 0.07, C.metal);
  }
}
function statue(o, c, p, height) {
  if (!c.detail) return;
  const [x, y, z] = p;
  B(o, c, [x - 0.27, y, z - 0.27], [x + 0.27, y + 0.2, z + 0.27], 'stone', C.stone);
  L(
    o,
    c,
    [
      radialRing(y + 0.2, 0.2, 0.2, 6, [x, z]),
      radialRing(y + height * 0.7, 0.25, 0.17, 6, [x, z]),
      radialRing(y + height * 0.82, 0.13, 0.14, 6, [x, z]),
    ],
    'stone',
    C.stone,
  );
  sphere(o, S(c, 'stone'), [x, y + height * 0.95, z], [0.15, 0.18, 0.15], C.stone, 8, 4);
}
function lanternDetails(o, c, x, z, base, r, height, stages) {
  if (!c.detail) return;
  for (let j = 0; j < stages; j++) {
    const step = height / stages,
      y = base + j * step,
      R = r * (1 - j * 0.24),
      ceil = y + step * 0.55;
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2,
        T = ((i + 1) / 8) * Math.PI * 2,
        A = [x + Math.cos(t) * R * 0.91, ceil - 0.5, z + Math.sin(t) * R * 0.91],
        M = [
          x + Math.cos((t + T) / 2) * R * 0.86,
          ceil - 0.03,
          z + Math.sin((t + T) / 2) * R * 0.86,
        ],
        B = [x + Math.cos(T) * R * 0.91, ceil - 0.5, z + Math.sin(T) * R * 0.91];
      beam(o, S(c, 'copper'), A, M, 0.13, 0.13, C.copper);
      beam(o, S(c, 'copper'), M, B, 0.13, 0.13, C.copper);
    }
    L(
      o,
      c,
      [
        radialRing(ceil - 0.05, R * 1.25, R * 1.25, c.sides, [x, z]),
        radialRing(ceil + 0.12, R * 1.25, R * 1.25, c.sides, [x, z]),
      ],
      'copper',
      C.copper,
    );
  }
}
function entryApproach(o, c, A, Bb) {
  const y0 = 0.8,
    y1 = rosenborgGroundY(...Bb) + 0.1,
    n = c.far ? 1 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / n,
      T = (i + 1) / n,
      P = (t, y) => [A[0] + (Bb[0] - A[0]) * t, y, A[1] + (Bb[1] - A[1]) * t];
    beam(
      o,
      S(c, 'stone'),
      P(t, y0 + (y1 - y0) * t - 0.12),
      P(T, y0 + (y1 - y0) * T - 0.12),
      2.6,
      0.24,
      C.stone,
    );
  }
}
function site(o, c) {
  const A = [25.03, -0.36],
    bridgeEnd = [37.15, -0.74],
    P = (t, y, z = 0) => {
      const dx = bridgeEnd[0] - A[0],
        dz = bridgeEnd[1] - A[1],
        l = Math.hypot(dx, dz);
      return [A[0] + t * dx - (dz / l) * z, y, A[1] + t * dz + (dx / l) * z];
    };
  beam(o, S(c, 'stone'), P(0, 0.3), P(1, 0.3), 2.6, 0.3, C.stone);
  for (const t of [0, 1]) {
    const p = P(t, 0.2);
    B(
      o,
      c,
      [p[0] - 1.7, Math.min(-0.1, rosenborgGroundY(p[0], p[2]) - 0.4), p[2] - 1.9],
      [p[0] + 1.7, 0.5, p[2] + 1.9],
      'stone',
      C.stone,
    );
  }
  if (!c.far) {
    for (const side of [-1, 1]) {
      beam(o, S(c, 'metal'), P(0, 1.35, side * 1.35), P(1, 1.35, side * 1.35), 0.09, 0.09, C.metal);
      const n = c.detail ? 9 : 4;
      for (let i = 0; i <= n; i++)
        beam(
          o,
          S(c, 'metal'),
          P(i / n, 0.45, side * 1.35),
          P(i / n, 1.35, side * 1.35),
          0.075,
          0.075,
          C.metal,
        );
    }
  }
  if (!c.far) {
    for (const [x0, z0, x1, z1] of [
      [-27, -15.5, 26, -15.5],
      [-27, 16, 26, 16],
      [26, -15.5, 26, -2],
      [26, 1.4, 26, 16],
    ]) {
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 5);
      for (let i = 0; i < n; i++) {
        const t = i / n,
          T = (i + 1) / n,
          x = x0 + (x1 - x0) * t,
          z = z0 + (z1 - z0) * t,
          X = x0 + (x1 - x0) * T,
          Z = z0 + (z1 - z0) * T,
          h0 = rosenborgGroundY(x, z),
          h1 = rosenborgGroundY(X, Z);
        beam(o, S(c, 'wall'), [x, h0 + 0.5, z], [X, h1 + 0.5, Z], 0.55, 1.2, C.brick);
        beam(o, S(c, 'stone'), [x, h0 + 1.14, z], [X, h1 + 1.14, Z], 0.65, 0.18, C.stone);
      }
    }
  }
  if (c.detail)
    for (const z of [-2.6, 1.2]) {
      const x = 37.3;
      B(
        o,
        c,
        [x - 1.05, rosenborgGroundY(x, z) - 0.4, z - 0.8],
        [x + 1.05, 1.15, z + 0.8],
        'stone',
        C.stone,
      );
      const col = C.copper;
      sphere(o, S(c, 'copper'), [x, 1.5, z], [0.75, 0.35, 0.4], col, c.fine ? 20 : 12, 6);
      sphere(o, S(c, 'copper'), [x + 0.45, 1.87, z], [0.28, 0.34, 0.27], col, c.fine ? 16 : 10, 6);
      sphere(o, S(c, 'copper'), [x + 0.6, 1.96, z], [0.2, 0.2, 0.18], col, 10, 5);
      for (const side of [-1, 1]) {
        Bbox(o, c, [x + 0.45, 1.3, z + side * 0.27], 0.75, 0.2, 0.18, 'copper', col);
        sphere(o, S(c, 'copper'), [x + 0.56, 2.18, z + side * 0.15], [0.07, 0.11, 0.07], col, 6, 3);
      }
    }
}
function Bbox(o, c, p, w, h, d, s, color) {
  B(
    o,
    c,
    [p[0] - w / 2, p[1] - h / 2, p[2] - d / 2],
    [p[0] + w / 2, p[1] + h / 2, p[2] + d / 2],
    s,
    color,
  );
}
export function buildRosenborgLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error(level);
  if (c.far) {
    for (const [x0, z0, x1, z1] of [
      [-23.6, -5.6, 23.6, 5.2],
      [-16, -10.3, -9.5, -5.6],
      [8.3, -10.3, 15.2, -5.6],
      [-3.3, 5.2, 3.4, 11.7],
      [-2.9, -11.7, 3.1, -5.6],
    ])
      footing(o, c, [
        [x0, z0],
        [x0, z1],
        [x1, z1],
        [x1, z0],
      ]);
  } else footing(o, c, a.geometryControls.principalOutline);
  main(o, c);
  tower(o, c, -12.75, -7.9, 6.35, 4.7, H.pairedTowerWall);
  tower(o, c, 11.75, -7.85, 6.8, 4.8, H.pairedTowerWall);
  tower(o, c, 0.03, 8.37, 6.6, 6.55, H.greatTowerWall, true);
  stair(o, c);
  gatehouse(o, c);
  gableDetails(o, c);
  site(o, c);
  closedDoor(o, c, 1, -11.46, 0.28, 0.35, 1.3, 2.4, -1);
  closedDoor(o, c, 0, 23.08, -0.2, 0.35, 1.4, 2.6, 1);
  for (const [x, z] of [
    [-12.75, -7.9],
    [11.75, -7.85],
  ])
    lanternDetails(o, c, x, z, 25.2, 1.65, 7.2, 2);
  lanternDetails(o, c, 0.03, 8.37, 31.2, 2.4, 15.6, 3);
}
export const buildRosenborgSkyline = (o) => buildRosenborgLevel(o, 'skyline');
export const buildRosenborgDistrict = (o) => buildRosenborgLevel(o, 'district');
export const buildRosenborgStreet = (o) => buildRosenborgLevel(o, 'street');
export const buildRosenborgCloseup = (o) => buildRosenborgLevel(o, 'closeup');
