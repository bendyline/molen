/** Original complete Bellevue Palace exterior. Meters,+Y up,+X NE,+Z SE court. */
import { readFileSync } from 'node:fs';
import {
  beam as beamMesh,
  loft as loftMesh,
  normalFor,
  radialRing,
  sphere as sphereMesh,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const bellevueControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = bellevueControls,
  H = a.geometryControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  parts = JSON.parse(readFileSync(new URL('../mapped-parts.json', import.meta.url))).parts;
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('eee9de'),
  trim: lin('eeeae1'),
  stone: lin('c9c6bc'),
  roof: lin('655f5b'),
  glass: lin('60788e'),
  door: lin('665243'),
  metal: lin('707a7a'),
  gold: lin('c7ab64'),
};
const loft = (o, s, r, color, cap = true) => loftMesh(o, s, r, color, { cap }),
  beam = (o, s, A, Z, w, color) => beamMesh(o, s, A, Z, w, w, color),
  sphere = (o, s, p, r, n, l, color) => sphereMesh(o, s, p, [r, r, r], color, n, l);
export const bellevueSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.86, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.83, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.38, metallic: 0.04 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.15 },
  door: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, oval: 6, roofLines: 0 },
  district: { flat: true, n: 4, oval: 8, roofLines: 0 },
  street: { frames: true, flatFrames: true, n: 8, oval: 12, roofLines: 0 },
  closeup: { frames: true, detail: true, n: 12, oval: 20, roofLines: 8 },
  master: { frames: true, detail: true, fine: true, n: 24, oval: 48, roofLines: 24 },
};
export function bellevueGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.max(0, Math.min(127, Math.floor(u))),
    j = Math.max(0, Math.min(127, Math.floor(v))),
    p = Math.max(0, Math.min(1, u - i)),
    q = Math.max(0, Math.min(1, v - j)),
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const S = (c, s) => (c.far ? 'far' : s),
  clean = (r) => {
    const p = r.slice();
    if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001) p.pop();
    return p;
  },
  area = (r) =>
    r.reduce((v, p, i) => {
      const q = r[(i + 1) % r.length];
      return v + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => {
    const p = clean(r);
    return area(p) > 0 ? p.reverse() : p;
  };
function B(o, c, lo, hi, s = 'wall', color = C.wall) {
  if (hi.some((v, i) => v <= lo[i])) return;
  box(o, S(c, s), lo, hi, color);
}
function Q(o, c, p, s = 'wall', color = C.wall) {
  o.addQuad(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function T(o, c, p, s = 'wall', color = C.wall) {
  o.addTriangle(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    color,
  );
}
function cap(o, c, r, y, s, color, down = false) {
  const p = cw(r),
    ids = earcut(p.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const t = ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (normalFor(...t)[1] < 0 !== down) t.reverse();
    T(o, c, t, s, color);
  }
}
function body(o, c, index, eave) {
  const p = cw(parts[index].polygons[0][0]),
    low = p.map(([x, z]) => [x, Math.min(H.floor - 0.3, bellevueGroundY(x, z) - 0.3), z]),
    base = p.map(([x, z]) => [x, H.floor, z]),
    top = p.map(([x, z]) => [x, eave, z]);
  loft(o, S(c, 'stone'), [low, base], C.stone, false);
  loft(o, S(c, 'wall'), [base, top], C.wall, false);
  cap(o, c, p, eave, 'wall', C.wall);
  cap(o, c, p, Math.min(...low.map((p) => p[1])), 'stone', C.stone, true);
}
function hip(o, c, b, eave, ridge) {
  const [x0, z0, x1, z1] = b,
    alongX = x1 - x0 > z1 - z0,
    short = alongX ? z1 - z0 : x1 - x0,
    cut = short * 0.48,
    base = [
      [x0 - 0.3, eave, z0 - 0.3],
      [x0 - 0.3, eave, z1 + 0.3],
      [x1 + 0.3, eave, z1 + 0.3],
      [x1 + 0.3, eave, z0 - 0.3],
    ],
    r0 = alongX ? [x0 + cut, ridge, (z0 + z1) / 2] : [(x0 + x1) / 2, ridge, z0 + cut],
    r1 = alongX ? [x1 - cut, ridge, (z0 + z1) / 2] : [(x0 + x1) / 2, ridge, z1 - cut];
  const rq = (p) => {
      if (normalFor(...p)[1] < 0) p.reverse();
      Q(o, c, p, 'roof', C.roof);
    },
    rt = (p) => {
      if (normalFor(...p)[1] < 0) p.reverse();
      T(o, c, p, 'roof', C.roof);
    };
  if (alongX) {
    rq([base[0], base[3], r1, r0]);
    rq([base[1], r0, r1, base[2]]);
    rt([base[0], r0, base[1]]);
    rt([base[3], base[2], r1]);
  } else {
    rq([base[0], r0, r1, base[1]]);
    rq([base[3], base[2], r1, r0]);
    rt([base[0], base[3], r0]);
    rt([base[1], r1, base[2]]);
  }
  // Solid opaque roof underside,with original shallow eaves trim.
  Q(o, c, [base[3], base[2], base[1], base[0]], 'roof', C.roof);
  B(o, c, [x0 - 0.28, eave - 0.25, z0 - 0.28], [x1 + 0.28, eave, z1 + 0.28], 'stone', C.trim);
  if (c.roofLines)
    for (let j = 1; j < c.roofLines; j++) {
      const t = j / c.roofLines,
        Y = eave + (ridge - eave) * t + 0.03;
      if (alongX) {
        const X0 = x0 - 0.3 + (cut + 0.3) * t,
          X1 = x1 + 0.3 - (cut + 0.3) * t;
        for (const side of [-1, 1]) {
          const Z = (z0 + z1) / 2 + side * ((z1 - z0) / 2 + 0.3) * (1 - t);
          beam(o, S(c, 'roof'), [X0, Y, Z], [X1, Y, Z], 0.025, C.roof);
        }
      } else {
        const Z0 = z0 - 0.3 + (cut + 0.3) * t,
          Z1 = z1 + 0.3 - (cut + 0.3) * t;
        for (const side of [-1, 1]) {
          const X = (x0 + x1) / 2 + side * ((x1 - x0) / 2 + 0.3) * (1 - t);
          beam(o, S(c, 'roof'), [X, Y, Z0], [X, Y, Z1], 0.025, C.roof);
        }
      }
    }
}
function patch(o, c, x, z, y, w, h, axis = 'front', s = 'glass', color = C.glass) {
  const v = (u, Y) =>
    axis === 'front'
      ? [x + u, Y, z]
      : axis === 'rear'
        ? [x - u, Y, z]
        : axis === 'east'
          ? [x, Y, z - u]
          : [x, Y, z + u];
  Q(o, c, [v(-w / 2, y), v(w / 2, y), v(w / 2, y + h), v(-w / 2, y + h)], s, color);
  return v;
}
function window(o, c, x, z, y, w, h, axis = 'front', crown = false) {
  const v = patch(o, c, x, z, y, w, h, axis),
    normal = { front: [0, 0, 1], rear: [0, 0, -1], east: [1, 0, 0], west: [-1, 0, 0] }[axis],
    out = (p) => p.map((n, i) => n + normal[i] * 0.045);
  if (c.flatFrames) {
    for (const [u, U, Y, V] of [
      [-w / 2 - 0.1, -w / 2, y - 0.1, y + h + 0.1],
      [w / 2, w / 2 + 0.1, y - 0.1, y + h + 0.1],
      [-w / 2, w / 2, y - 0.1, y],
      [-w / 2, w / 2, y + h, y + h + 0.1],
    ])
      Q(o, c, [out(v(u, Y)), out(v(U, Y)), out(v(U, V)), out(v(u, V))], 'stone', C.trim);
  } else if (c.frames) {
    for (const u of [-w / 2, w / 2])
      beam(
        o,
        S(c, 'stone'),
        out(v(u, y - 0.07)),
        out(v(u, y + h + 0.07)),
        c.detail ? 0.075 : 0.1,
        C.trim,
      );
    for (const Y of [y, y + h])
      beam(o, S(c, 'stone'), out(v(-w / 2 - 0.1, Y)), out(v(w / 2 + 0.1, Y)), 0.08, C.trim);
    if (c.detail) {
      beam(o, S(c, 'stone'), out(v(0, y)), out(v(0, y + h)), 0.035, C.trim);
      for (let j = 1; j < 4; j++)
        beam(
          o,
          S(c, 'stone'),
          out(v(-w / 2, y + (h * j) / 4)),
          out(v(w / 2, y + (h * j) / 4)),
          0.035,
          C.trim,
        );
    }
  }
  if (crown && !c.far) {
    const W = w + 0.45,
      Y = y + h + 0.32;
    beam(o, S(c, 'stone'), out(v(-W / 2, Y)), out(v(W / 2, Y)), 0.12, C.trim);
    if (crown === 'round') {
      const n = c.detail ? 12 : 4;
      let p;
      for (let j = 0; j <= n; j++) {
        const t = (Math.PI * j) / n,
          q = out(v((W / 2) * Math.cos(t), Y + 0.45 * Math.sin(t)));
        if (p) beam(o, S(c, 'stone'), p, q, 0.09, C.trim);
        p = q;
      }
    } else {
      beam(o, S(c, 'stone'), out(v(-W / 2, Y)), out(v(0, Y + 0.55)), 0.1, C.trim);
      beam(o, S(c, 'stone'), out(v(0, Y + 0.55)), out(v(W / 2, Y)), 0.1, C.trim);
    }
  }
}
function oval(o, c, x, z, y, rx, ry, axis = 'front') {
  const n = c.oval,
    normal = axis === 'front' ? 1 : -1,
    P = (u, Y, Z = 0) => [x + u, Y, z + normal * Z];
  for (let j = 0; j < n; j++) {
    const t = (j * 2 * Math.PI) / n,
      Tt = ((j + 1) * 2 * Math.PI) / n;
    let ps = [
      P(0, y),
      P(rx * Math.cos(t), y + ry * Math.sin(t)),
      P(rx * Math.cos(Tt), y + ry * Math.sin(Tt)),
    ];
    if (normalFor(...ps)[2] * normal < 0) ps.reverse();
    T(o, c, ps, 'glass', C.glass);
    if (c.frames)
      beam(
        o,
        S(c, 'stone'),
        P(rx * Math.cos(t), y + ry * Math.sin(t), 0.04),
        P(rx * Math.cos(Tt), y + ry * Math.sin(Tt), 0.04),
        0.08,
        C.trim,
      );
  }
  if (c.detail) {
    beam(o, S(c, 'stone'), P(-rx, y, 0.04), P(rx, y, 0.04), 0.025, C.trim);
    beam(o, S(c, 'stone'), P(0, y - ry, 0.04), P(0, y + ry, 0.04), 0.025, C.trim);
  }
}
function pilaster(o, c, x, z) {
  B(o, c, [x - 0.3, H.floor, z], [x + 0.3, 14.65, z + 0.32], 'stone', C.trim);
  B(o, c, [x - 0.5, H.floor, z - 0.03], [x + 0.5, H.floor + 0.35, z + 0.4], 'stone', C.trim);
  B(o, c, [x - 0.5, 14.15, z - 0.03], [x + 0.5, 14.65, z + 0.4], 'stone', C.trim);
  if (c.detail)
    for (let j = -2; j <= 2; j++)
      beam(
        o,
        S(c, 'stone'),
        [x + j * 0.1, H.floor + 0.5, z + 0.34],
        [x + j * 0.1, 14.05, z + 0.34],
        0.022,
        C.stone,
      );
}
function statue(o, c, x, z, y) {
  B(o, c, [x - 0.35, y, z - 0.3], [x + 0.35, y + 0.25, z + 0.3], 'stone', C.trim);
  const s = c.far ? 4 : c.n;
  loft(
    o,
    S(c, 'stone'),
    [
      [y + 0.25, 0.3],
      [y + 0.9, 0.23],
      [y + 1.55, 0.3],
      [y + 1.85, 0.18],
    ].map(([Y, r]) => radialRing(Y, r, r * 0.8, s, [x, z])),
    C.trim,
    true,
  );
  sphere(
    o,
    S(c, 'stone'),
    [x, y + 2.05, z],
    0.19,
    Math.min(s, 12),
    c.far ? 2 : c.detail ? 6 : 3,
    C.trim,
  );
  if (!c.far) {
    beam(o, S(c, 'stone'), [x - 0.22, y + 1.65, z], [x - 0.48, y + 1.05, z + 0.07], 0.085, C.trim);
    beam(o, S(c, 'stone'), [x + 0.22, y + 1.65, z], [x + 0.4, y + 1.9, z + 0.1], 0.085, C.trim);
  }
}
function pediment(o, c) {
  const x = H.mainCenterX,
    z = H.frontZ + 0.5,
    W = 14.2,
    y = H.pedimentBase,
    top = H.pedimentTop,
    front = z + 0.25,
    rear = z - 0.35;
  for (const Z of [front, rear]) {
    const p = [
      [x - W / 2, y, Z],
      [x + W / 2, y, Z],
      [x, top, Z],
    ];
    if (normalFor(...p)[2] * (Z === front ? 1 : -1) < 0) p.reverse();
    T(o, c, p, 'wall', C.wall);
  }
  Q(
    o,
    c,
    [
      [x - W / 2, y, rear],
      [x - W / 2, y, front],
      [x, top, front],
      [x, top, rear],
    ],
    'stone',
    C.trim,
  );
  Q(
    o,
    c,
    [
      [x, top, rear],
      [x, top, front],
      [x + W / 2, y, front],
      [x + W / 2, y, rear],
    ],
    'stone',
    C.trim,
  );
  B(o, c, [x - W / 2 - 0.2, y - 0.7, rear], [x + W / 2 + 0.2, y, front + 0.12], 'stone', C.trim);
  for (const X of [x - 6.5, x - 2.16, x + 2.16, x + 6.5]) pilaster(o, c, X, z - 0.15);
  // Original round clock dial and simplified figures;no lettering or copied relief.
  if (!c.far) {
    const n = c.oval,
      cy = y + 1.8;
    for (let j = 0; j < n; j++) {
      const t = (j * 2 * Math.PI) / n,
        Tt = ((j + 1) * 2 * Math.PI) / n;
      T(
        o,
        c,
        [
          [x, cy, front + 0.05],
          [x + 0.62 * Math.cos(t), cy + 0.62 * Math.sin(t), front + 0.05],
          [x + 0.62 * Math.cos(Tt), cy + 0.62 * Math.sin(Tt), front + 0.05],
        ],
        'glass',
        C.glass,
      );
    }
    beam(
      o,
      S(c, 'metal'),
      [x, cy, front + 0.08],
      [x - 0.28, cy + 0.24, front + 0.08],
      0.025,
      C.gold,
    );
    beam(
      o,
      S(c, 'metal'),
      [x, cy, front + 0.08],
      [x + 0.03, cy + 0.42, front + 0.08],
      0.025,
      C.gold,
    );
  }
  for (const [X, Y] of [
    [x, H.pedimentTop],
    [x - 6.7, H.pedimentBase + 0.4],
    [x + 6.7, H.pedimentBase + 0.4],
  ])
    statue(o, c, X, z + 0.1, Y);
  if (c.detail) {
    for (const side of [-1, 1]) {
      const X = x + side * 1.9;
      statue(o, c, X, front + 0.15, y + 0.1);
      for (let k = 0; k < 5; k++)
        beam(
          o,
          S(c, 'stone'),
          [x + side * (3 + k * 0.45), y + 0.5, front + 0.05],
          [x + side * (3.4 + k * 0.45), y + 0.8, front + 0.05],
          0.07,
          C.trim,
        );
    }
    for (let j = -13; j <= 13; j++)
      B(
        o,
        c,
        [x + j * 0.48 - 0.07, y - 0.55, front],
        [x + j * 0.48 + 0.07, y - 0.3, front + 0.13],
        'stone',
        C.trim,
      );
  }
}
function stairs(o, c, x, z, axis = 'front', width = 14, depth = 5) {
  const sign = axis === 'front' ? 1 : -1,
    n = c.far ? 3 : 12,
    ground = bellevueGroundY(x, z + sign * depth);
  for (let j = 0; j < n; j++) {
    const near = z + (sign * depth * j) / n,
      far = z + (sign * depth * (j + 1)) / n,
      top = H.floor - (H.floor - ground) * (j / n);
    B(
      o,
      c,
      [x - width / 2, Math.min(ground, bellevueGroundY(x, far)) - 0.25, Math.min(near, far)],
      [x + width / 2, top, Math.max(near, far)],
      'stone',
      C.stone,
    );
  }
}
function rearTerrace(o, c) {
  const x = H.mainCenterX,
    z = H.rearZ - 0.05,
    n = c.far ? 6 : c.oval,
    steps = c.far ? 2 : c.flat ? 3 : c.detail ? 8 : 5,
    end = bellevueGroundY(x, z - 8.3);
  for (let j = steps; j >= 0; j--) {
    const r = 6.5 + (1.8 * j) / steps,
      y = H.floor - ((H.floor - end) * j) / (steps + 1),
      p = Array.from({ length: n + 1 }, (_, i) => [
        x + r * Math.cos((Math.PI * i) / n),
        z - r * Math.sin((Math.PI * i) / n),
      ]),
      ring = cw(p),
      base = ring.map(([X, Z]) => [X, Math.min(y - 0.2, bellevueGroundY(X, Z) - 0.3), Z]),
      top = ring.map(([X, Z]) => [X, y, Z]);
    loft(o, S(c, 'stone'), [base, top], C.stone, true);
  }
}
function facade(o, c) {
  if (c.far) return;
  const x = H.mainCenterX;
  for (let j = -9; j <= 9; j++) {
    const X = x + j * 3.75,
      central = Math.abs(j) <= 1,
      front = (central ? H.frontZ : -25.5) + 0.04,
      rear = (central ? H.rearZ : -41.5) - 0.05;
    window(
      o,
      c,
      X,
      front,
      3.1,
      1.55,
      3.6,
      'front',
      central ? 'round' : j % 2 ? 'triangle' : 'round',
    );
    window(o, c, X, front, 8.9, 1.55, 3.7, 'front');
    if (!central) oval(o, c, X, front, 14, 0.62, 0.45);
    window(o, c, X, rear, 3.1, 1.55, 3.6, 'rear', false);
    window(o, c, X, rear, 8.9, 1.55, 3.7, 'rear');
    oval(o, c, X, rear, 14, 0.62, 0.45, 'rear');
  }
  patch(o, c, x, H.frontZ + 0.12, H.floor, 2.1, 4.5, 'front', 'door', C.door);
  patch(o, c, x, H.rearZ - 0.12, H.floor, 2.1, 4.4, 'rear', 'door', C.door);
  for (const [X, axis] of [
    [-21.3, 'east'],
    [51.55, 'west'],
    [-34.18, 'west'],
    [63.65, 'east'],
  ]) {
    for (let j = 0; j < 16; j++) {
      const Z = -38.4 + j * 3.2;
      for (const Y of [3, 7, 11]) window(o, c, X, Z, Y, 1.2, 2.1, axis);
    }
  }
  for (const [X, Z, W] of [
    [-27.7, 22.65, 8.2],
    [57.25, 22.55, 8.2],
  ])
    for (const Y of [3, 7])
      for (const off of [-2.6, 0, 2.6]) window(o, c, X + off, Z + 0.06, Y, 1.2, 2.1);
  for (const X of [-57, -50.5, -44, -37.5]) window(o, c, X, 42.55, 3, 1.4, 2.3);
  for (const X of [-27.8, 59.2]) window(o, c, X, 35.8, 2.7, 2.0, 3.2);
  for (const [X, axis] of [
    [-34.05, 'west'],
    [-21.65, 'east'],
    [51.75, 'west'],
    [62.9, 'east'],
  ])
    for (const Z of [16.4, 20.1]) for (const Y of [3, 7]) window(o, c, X, Z, Y, 1.15, 2.1, axis);
  // Rear central range has plain giant-order cues rather than the front triangular gable.
  if (c.frames)
    for (const X of [x - 6.5, x + 6.5])
      B(o, c, [X - 0.28, H.floor, H.rearZ - 0.32], [X + 0.28, 14.6, H.rearZ], 'stone', C.trim);
}
function fittings(o, c) {
  if (c.far) return;
  for (const X of [9.6, 20.8]) {
    B(o, c, [X - 0.65, 20.3, -35.4], [X + 0.65, 23, -34.3], 'wall', C.wall);
    B(o, c, [X - 0.8, 22.75, -35.55], [X + 0.8, 23.1, -34.15], 'stone', C.trim);
    if (c.detail) B(o, c, [X - 0.5, 23.11, -35.2], [X + 0.5, 23.14, -34.5], 'metal', C.metal);
  }
  for (const X of [-15, 2, 29, 46]) {
    const y = (z) => H.mainEave + ((H.mainRidge - H.mainEave) * (z + 41.3)) / 8.475 + 0.035,
      p = [
        [X - 0.55, y(-39.2), -39.2],
        [X - 0.55, y(-38.2), -38.2],
        [X + 0.55, y(-38.2), -38.2],
        [X + 0.55, y(-39.2), -39.2],
      ];
    Q(o, c, p, 'glass', C.glass);
    if (c.frames)
      for (let j = 0; j < 4; j++) beam(o, S(c, 'metal'), p[j], p[(j + 1) % 4], 0.05, C.metal);
  }
  if (c.detail) {
    for (const j of [0, 1, 2, 3]) {
      const X = 9 + j * 4;
      beam(o, S(c, 'metal'), [X, 22.15, -33.55], [X, 23.05, -33.55], 0.025, C.metal);
      if (j < 3) beam(o, S(c, 'metal'), [X, 23, -33.55], [X + 4, 23, -33.55], 0.025, C.metal);
    }
  }
}
export function buildBellevueLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Bellevue level:' + level);
  for (const i of [1, 7]) body(o, c, i, H.wingEave);
  body(o, c, 8, H.mainEave);
  for (const [x0, x1] of [
    [-34.15, -21.35],
    [51.6, 63.6],
  ])
    B(o, c, [x0, H.wingEave, -40.8], [x1, H.mainEave, -24.65]);
  for (const i of [5, 6]) body(o, c, i, 11.5);
  for (const i of [2, 3, 4]) body(o, c, i, H.linkEave);
  hip(o, c, [-34.15, -41, 63.6, -24.65], H.mainEave, H.mainRidge);
  for (const b of [
    [-34.15, -40.9, -21.35, 14.1],
    [51.6, -40.8, 63.6, 14.4],
  ])
    hip(o, c, b, H.wingEave, H.wingRidge);
  for (const b of [
    [-34, 14.05, -21.7, 22.6],
    [51.8, 14.4, 62.85, 22.5],
  ])
    hip(o, c, b, 11.5, 16.7);
  for (const b of [
    [-63.6, 34.95, -21.8, 42.5],
    [-34, 22.6, -27.05, 35.4],
    [55.9, 22.5, 62.85, 42.35],
  ])
    hip(o, c, b, H.linkEave, H.linkRidge);
  facade(o, c);
  pediment(o, c);
  fittings(o, c);
  stairs(o, c, H.mainCenterX, H.frontZ + 0.05);
  rearTerrace(o, c);
}
export const buildBellevueSkyline = (o) => buildBellevueLevel(o, 'skyline');
export const buildBellevueDistrict = (o) => buildBellevueLevel(o, 'district');
export const buildBellevueStreet = (o) => buildBellevueLevel(o, 'street');
export const buildBellevueCloseup = (o) => buildBellevueLevel(o, 'closeup');
