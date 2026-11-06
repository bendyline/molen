/** Original Grand Lisboa exterior. Design U east,V south;exported in retained NE/SE frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
  torus,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  C0 = a.designFrame.origin,
  c = Math.cos(a.designFrame.angle),
  s = Math.sin(a.designFrame.angle);
const linear = (h) =>
    h.match(/\w\w/g).map((v) => {
      const n = parseInt(v, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }),
  C = {
    gold: linear('cbb77a'),
    glass: linear('c8b38a'),
    dark: linear('4a5054'),
    frame: linear('756d54'),
    stone: linear('b5ad98'),
    roof: linear('a9aaa3'),
    silver: linear('c1c5c1'),
    cyan: linear('76a6ac'),
    red: linear('a77e73'),
  };
export const lisboaSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.7, metallic: 0.15 },
  gold: { slot: 'wall', graph: 'metal_bronze_cast', roughness: 0.39, metallic: 0.65 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.2, metallic: 0.25 },
  // Mirrored cladding carries authored cell tints;the procedural window variant is intentionally untinted.
  shell: { slot: 'wall', graph: 'metal_stainless_polished', roughness: 0.21, metallic: 0.75 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.52, metallic: 0.45 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  sign: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.6, metallic: 0.15 },
};
export const lisboaControls = a;
export const lisboaLocal = (u, v) => [C0[0] + c * u - s * v, C0[1] + s * u + c * v];
export function lisboaGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
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
const G = (u, v) => lisboaGroundY(...lisboaLocal(u, v));
function designOut(o) {
  const P = (p) => {
      const [x, z] = lisboaLocal(p[0], p[2]);
      return [x, p[1], z];
    },
    N = (n) => [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]];
  return {
    addQuad: (k, r, p, n, u, col) => o.addQuad(k, r, p.map(P), N(n), u, col),
    addTriangle: (k, r, p, n, u, col) => o.addTriangle(k, r, p.map(P), N(n), u, col),
    addConvexPolygon: (k, r, p, n, u, col) => o.addConvexPolygon(k, r, p.map(P), N(n), u, col),
  };
}
const configs = {
  skyline: {
    far: true,
    sides: 8,
    bodySteps: 8,
    leafSteps: 2,
    shellSides: 12,
    shellRows: 4,
    crownSides: 8,
  },
  district: {
    sides: 12,
    bodySteps: 12,
    leafSteps: 3,
    aggregateLeaves: true,
    smallCrown: true,
    shellSides: 16,
    shellRows: 8,
    crownSides: 12,
    arches: 1,
    bands: 6,
  },
  street: {
    sides: 24,
    bodySteps: 24,
    leafSteps: 6,
    shellSides: 36,
    shellRows: 12,
    crownSides: 20,
    arches: 4,
    bands: 22,
    panes: true,
    entry: true,
  },
  closeup: {
    sides: 40,
    bodySteps: 44,
    leafSteps: 10,
    shellSides: 64,
    shellRows: 20,
    crownSides: 32,
    arches: 6,
    bands: 44,
    panes: true,
    entry: true,
    leafEdges: true,
    shellInset: true,
    detail: true,
  },
  master: {
    sides: 64,
    bodySteps: 66,
    leafSteps: 18,
    shellSides: 100,
    shellRows: 30,
    crownSides: 48,
    arches: 8,
    bands: 44,
    panes: true,
    entry: true,
    leafEdges: true,
    shellInset: true,
    shellReveals: true,
    detail: true,
    dense: true,
  },
};
const S = (c, n) => (c.far ? 'far' : n),
  ring = (r) =>
    r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r,
  area = (r) =>
    r.reduce((n, p, i) => {
      const q = r[(i + 1) % r.length];
      return n + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2,
  oriented = (polys) =>
    polys.map((poly) =>
      poly.map((raw, i) => {
        let r = ring(raw);
        if (area(r) > 0 !== (i === 0)) r = r.toReversed();
        return r;
      }),
    );
function cap(o, slot, polys, y, color, down = false) {
  for (const poly of polys) {
    const rs = poly.map(ring),
      ps = rs.flat(),
      holes = [];
    let n = rs[0].length;
    for (const r of rs.slice(1)) {
      holes.push(n);
      n += r.length;
    }
    const ids = earcut(ps.flat(), holes, 2);
    for (let i = 0; i < ids.length; i += 3) {
      let p = ids
        .slice(i, i + 3)
        .map((k) => [ps[k][0], typeof y === 'function' ? y(...ps[k]) : y, ps[k][1]]);
      const f = p.map((p) => {
          const [x, z] = lisboaLocal(p[0], p[2]);
          return [Math.fround(x), Math.fround(p[1]), Math.fround(z)];
        }),
        u = f[1].map((v, j) => v - f[0][j]),
        v = f[2].map(
          (v, j) => v - f[0][j],
        ); /* Boolean boundary noise can collapse at exported Float32 precision. */
      if (
        Math.hypot(
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ) < 1e-10
      )
        continue;
      if (normalFor(...p)[1] < 0 !== down) p = p.toReversed();
      o.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        normalFor(...p),
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  }
}
function walls(o, slot, polys, lo, hi, color) {
  for (const poly of oriented(polys))
    for (const r of poly)
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length];
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01) continue;
        const low = (p) => (typeof lo === 'function' ? lo(...p) : lo),
          ps = [
            [p[0], low(p), p[1]],
            [p[0], hi, p[1]],
            [q[0], hi, q[1]],
            [q[0], low(q), q[1]],
          ];
        quad(o, slot, ps, normalFor(...ps), color);
      }
}
function profile(y) {
  const ps = a.tower.profiles;
  let lo = ps[0],
    hi = ps.at(-1);
  for (let i = 1; i < ps.length; i++)
    if (y <= ps[i][0]) {
      lo = ps[i - 1];
      hi = ps[i];
      break;
    }
  const t = Math.max(0, Math.min(1, (y - lo[0]) / (hi[0] - lo[0])));
  return [lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t];
}
function bodyPoint(y, angle, d = 0) {
  const [w, v] = profile(y),
    p = Math.cos(angle),
    q = Math.sin(angle),
    pow = (n) => Math.sign(n) * Math.pow(Math.abs(n), 0.64);
  return [(w + d) * pow(p), y, (v + d) * pow(q)];
}
function towerBody(o, cfg) {
  const n = cfg.sides,
    lo = 48,
    hi = 220,
    ys = Array.from({ length: cfg.bodySteps + 1 }, (_, i) => lo + ((hi - lo) * i) / cfg.bodySteps);
  loft(
    o,
    S(cfg, 'gold'),
    ys.map((y) => Array.from({ length: n }, (_, i) => bodyPoint(y, (-i * Math.PI * 2) / n))),
    C.gold,
  );
  if (cfg.far) return;
  const rows = cfg.panes ? a.tower.rows : 12,
    dy = (a.tower.glazingMaxY - a.tower.glazingMinY) / rows;
  for (let j = 0; j < rows; j++) {
    const y0 = a.tower.glazingMinY + j * dy + 0.45,
      y1 = a.tower.glazingMinY + (j + 1) * dy - 0.48;
    for (let k = 0; k < n; k++) {
      const u0 = (-k * Math.PI * 2) / n,
        u1 = (-(k + 1) * Math.PI * 2) / n,
        p = [
          bodyPoint(y0, u0, 0.045),
          bodyPoint(y0, u1, 0.045),
          bodyPoint(y1, u1, 0.045),
          bodyPoint(y1, u0, 0.045),
        ];
      o.addQuad(
        'glass',
        'metric:uv',
        p,
        normalFor(...p),
        [
          [0, 0],
          [1, 0],
          [1, 44 / rows],
          [0, 44 / rows],
        ],
        C.glass,
      );
    }
  }
  for (let j = 0; j <= cfg.bands; j++) {
    const y = 52 + ((217 - 52) * j) / cfg.bands,
      r = Array.from({ length: n + 1 }, (_, i) => bodyPoint(y, (-i * Math.PI * 2) / n, 0.11));
    if (cfg.dense) beamPath(o, 'gold', r, 0.12, 0.14, C.gold);
    else
      for (let k = 1; k < r.length; k++) {
        const p = [
          r[k - 1],
          r[k],
          [r[k][0], r[k][1] + 0.12, r[k][2]],
          [r[k - 1][0], r[k - 1][1] + 0.12, r[k - 1][2]],
        ];
        quad(o, 'gold', p, normalFor(...p), C.gold);
      }
  }
  // Narrow center stripes provide the characteristic dark/gold vertical axis on both broad faces.
  for (const sign of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const u = (k - 1) * 1.25,
        ps = ys.map((y) => {
          const [w, v] = profile(y);
          return [u, y, sign * (v + 0.15)];
        });
      beamPath(o, 'frame', ps, 0.17, 0.12, k === 1 ? C.gold : C.dark);
    }
}
function leaves(o, cfg) {
  for (const side of [-1, 1])
    for (const [index, [endUHeight, endU]] of a.tower.leafTips.entries()) {
      const endY = endUHeight,
        startY = endY - 60,
        N = cfg.leafSteps,
        sets = cfg.far || cfg.aggregateLeaves ? [0] : [-1, 1];
      for (const face of sets) {
        const points = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N,
            y = startY + (endY - startY) * t,
            [w, d] = profile(y),
            start = profile(startY)[0] * 0.6,
            U = side * (start + (endU - start) * t * t),
            width = 0.04 + (2.4 + index * 0.12) * Math.sin(Math.PI * t),
            v = face === 0 ? 0 : face * (d * 0.83 * (1 - t) + 2 * t),
            depth = face === 0 ? d * 0.85 * (1 - t) + 2 * t : 0.32;
          points.push({ y, u: U, width, v, depth });
        }
        const rings = points.map((p) => [
          [p.u - p.width, p.y, p.v - p.depth],
          [p.u - p.width, p.y, p.v + p.depth],
          [p.u + p.width, p.y, p.v + p.depth],
          [p.u + p.width, p.y, p.v - p.depth],
        ]);
        loft(o, S(cfg, 'gold'), rings, C.gold);
        if (!cfg.far && face !== 0) {
          for (let i = 1; i < points.length; i++) {
            const p = points[i - 1],
              q = points[i],
              off = face * 0.335,
              ps = [
                [p.u - p.width * 0.8, p.y, p.v + off],
                [p.u + p.width * 0.8, p.y, p.v + off],
                [q.u + q.width * 0.8, q.y, q.v + off],
                [q.u - q.width * 0.8, q.y, q.v + off],
              ];
            if (face < 0) ps.reverse();
            o.addQuad(
              'glass',
              'metric:uv',
              ps,
              normalFor(...ps),
              [
                [0, p.y / 3.75],
                [1, p.y / 3.75],
                [1, q.y / 3.75],
                [0, q.y / 3.75],
              ],
              C.glass,
            );
          }
          if (cfg.leafEdges)
            for (const edge of [-1, 1])
              beamPath(
                o,
                'gold',
                points.map((p) => [p.u + edge * p.width, p.y, p.v + face * 0.38]),
                0.14,
                0.12,
                C.gold,
              );
        }
      }
    }
}
function cylinder(o, slot, center, r0, r1, y0, y1, N, color) {
  loft(o, slot, [radialRing(y0, r0, r0, N, center), radialRing(y1, r1, r1, N, center)], color);
}
function crown(o, cfg) {
  const N = cfg.crownSides;
  loft(
    o,
    S(cfg, 'gold'),
    a.tower.crown.map(([y, r]) => radialRing(y, r, r, N)),
    C.gold,
  );
  if (!cfg.far) {
    for (let k = 0; k < N; k++) {
      const u = (-k * Math.PI * 2) / N,
        v = (-(k + 1) * Math.PI * 2) / N,
        mid = (u + v) / 2,
        ps = [
          [9.8925 * Math.cos(mid), 226, 9.8925 * Math.sin(mid)],
          [8.955 * Math.cos(v), 231, 8.955 * Math.sin(v)],
          [7.455 * Math.cos(mid), 236, 7.455 * Math.sin(mid)],
          [8.955 * Math.cos(u), 231, 8.955 * Math.sin(u)],
        ];
      o.addQuad(
        'shell',
        'palette:#ffffff',
        ps,
        normalFor(...ps),
        [
          [0.5, 0],
          [1, 0.5],
          [0.5, 1],
          [0, 0.5],
        ],
        k % 2 ? C.dark : C.gold,
      );
    }
    if (cfg.detail) {
      for (let k = 0; k < 16; k++) {
        const u = (k * Math.PI * 2) / 16,
          ps = a.tower.crown.map(([y, r]) => [
            (r + 0.07) * Math.cos(u),
            y,
            (r + 0.07) * Math.sin(u),
          ]);
        beamPath(o, 'gold', ps, 0.08, 0.08, C.gold);
      }
    }
  }
  sphere(
    o,
    S(cfg, 'gold'),
    [0, 248.2, 0],
    [1.8, 1.8, 1.8],
    C.gold,
    cfg.far ? 8 : cfg.smallCrown ? 12 : 20,
    cfg.far ? 4 : cfg.smallCrown ? 6 : 10,
  );
  const curves = [
    [
      [0, 250, 0],
      [1.8, 253, 0],
      [1.3, 257, 0],
      [0, 261, 0],
    ],
    [
      [-0.2, 250, -0.7],
      [-1.6, 254, -0.4],
      [-0.6, 258, 0],
      [0, 261, 0],
    ],
    [
      [0, 250, 0.7],
      [1.1, 253, 0.6],
      [-0.9, 256, 0.2],
      [0, 261, 0],
    ],
  ];
  for (const ps of curves)
    beamPath(o, S(cfg, 'gold'), ps, cfg.far ? 0.25 : 0.16, cfg.far ? 0.25 : 0.16, C.gold);
}
function shellPoint(angle, y, offset = 0) {
  const d = a.dome,
    t = (y - d.centerY) / d.ry,
    r = Math.sqrt(Math.max(0, 1 - t * t));
  return [
    d.center[0] + (d.rx + offset) * r * Math.cos(angle),
    y,
    d.center[1] + (d.rz + offset) * r * Math.sin(angle),
  ];
}
const shellColors = [
  C.gold,
  C.gold,
  C.gold,
  C.silver,
  C.gold,
  C.dark,
  C.silver,
  C.cyan,
  C.gold,
  C.silver,
  C.gold,
  C.red,
];
function triangleCell(o, cfg, ps, seed) {
  const n = normalFor(...ps),
    color = shellColors[seed % shellColors.length];
  if (cfg.far) {
    o.addTriangle(
      'far',
      'palette:#ffffff',
      ps,
      n,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      C.gold,
    );
    return;
  }
  o.addTriangle(
    'frame',
    'palette:#ffffff',
    ps,
    n,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    C.dark,
  );
  const center = ps[0].map((_, j) => (ps[0][j] + ps[1][j] + ps[2][j]) / 3),
    inset = cfg.shellInset ? 0.025 : 0.018,
    inner = ps.map((p) => p.map((v, j) => v + (center[j] - v) * inset + n[j] * 0.035));
  o.addTriangle(
    'shell',
    'palette:#ffffff',
    inner,
    n,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    color,
  );
  if (cfg.shellReveals)
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3,
        p = [ps[i], ps[j], inner[j], inner[i]];
      quad(o, 'frame', p, normalFor(...p), C.frame);
    }
}
function casino(o, cfg) {
  const N = cfg.shellSides,
    rows = cfg.shellRows,
    d = a.dome,
    min = Math.asin((d.lowerY - d.centerY) / d.ry),
    max = Math.PI / 2 - 0.025;
  for (let j = 0; j < rows; j++) {
    const y0 = d.centerY + d.ry * Math.sin(min + ((max - min) * j) / rows),
      y1 = d.centerY + d.ry * Math.sin(min + ((max - min) * (j + 1)) / rows);
    for (let k = 0; k < N; k++) {
      const u0 = (-k * Math.PI * 2) / N,
        u1 = (-(k + 1) * Math.PI * 2) / N,
        p = shellPoint(u0, y0),
        q = shellPoint(u1, y0),
        r = shellPoint(u1, y1),
        t = shellPoint(u0, y1);
      triangleCell(o, cfg, [p, q, r], j * 31 + k * 7);
      triangleCell(o, cfg, [p, r, t], j * 31 + k * 7 + 3);
    }
  }
  const topY = d.centerY + d.ry * Math.sin(max),
    rTop = d.rx * Math.cos(max),
    zTop = d.rz * Math.cos(max),
    topRing = Array.from({ length: N }, (_, i) => [
      rTop * Math.cos((-i * Math.PI * 2) / N),
      topY,
      d.center[1] + zTop * Math.sin((-i * Math.PI * 2) / N),
    ]);
  o.addConvexPolygon(
    S(cfg, 'gold'),
    'palette:#ffffff',
    topRing,
    [0, 1, 0],
    (p) => [p[0], p[2]],
    C.gold,
  );
  // Recessed foyer is narrower than the ovoid;its central southern doorway remains an actual aperture.
  const E = a.entry,
    rx = E.foyerRx,
    rz = E.foyerRz;
  for (let k = 0; k < N; k++) {
    const u0 = (-k * Math.PI * 2) / N,
      u1 = (-(k + 1) * Math.PI * 2) / N,
      angle = (u0 + u1) / 2,
      p = [rx * Math.cos(u0), d.center[1] + rz * Math.sin(u0)],
      q = [rx * Math.cos(u1), d.center[1] + rz * Math.sin(u1)],
      lo0 = G(...p) + 0.2,
      lo1 = G(...q) + 0.2,
      open = cfg.entry && Math.sin(angle) > 0.96 && Math.abs(Math.cos(angle)) < 0.22,
      ps = [
        [p[0], open ? 10 : lo0, p[1]],
        [q[0], open ? 10 : lo1, q[1]],
        [q[0], 13, q[1]],
        [p[0], 13, p[1]],
      ];
    quad(o, S(cfg, 'glass'), ps, normalFor(...ps), C.glass);
  }
  if (cfg.entry)
    box(
      o,
      'frame',
      [-32, G(0, d.center[1] + 9) - 8, d.center[1] + 9],
      [32, 14, d.center[1] + 9.3],
      C.dark,
    );
  if (cfg.arches) {
    for (let i = 0; i < E.archCount; i++) {
      const theta0 = -Math.PI / 2 + (i * Math.PI) / E.archCount,
        theta1 = theta0 + Math.PI / E.archCount,
        mid = (theta0 + theta1) / 2,
        curve = [];
      for (let j = 0; j <= cfg.arches * 2; j++) {
        const t = j / (cfg.arches * 2),
          theta = theta0 + (theta1 - theta0) * t,
          u = d.rx * 1.035 * Math.sin(theta),
          v = d.center[1] + d.rz * 1.035 * Math.cos(theta),
          y = (G(u, v) + 0.25) * (1 - Math.sin(Math.PI * t)) + 24 * Math.sin(Math.PI * t);
        curve.push([u, y, v]);
      }
      beamPath(o, 'gold', curve, 1.25, 0.8, C.gold);
      if (cfg.detail)
        beamPath(
          o,
          'frame',
          curve.map((p) => [p[0], p[1] - 0.12, p[2] - 0.45]),
          0.12,
          0.12,
          C.dark,
        );
      if (cfg.entry)
        for (const theta of [theta0, theta1]) {
          const u = d.rx * 1.035 * Math.sin(theta),
            v = d.center[1] + d.rz * 1.035 * Math.cos(theta),
            y = G(u, v);
          box(o, 'stone', [u - 0.85, y - 0.55, v - 0.85], [u + 0.85, y + 0.35, v + 0.85], C.stone);
        }
    }
    if (cfg.detail)
      for (const r of [3, 8, 15, 24]) {
        const y = d.centerY + d.ry * Math.sqrt(1 - Math.pow(r / d.rx, 2)) + 0.08,
          ps = Array.from({ length: 49 }, (_, i) => [
            r * Math.cos((i * Math.PI * 2) / 48),
            y,
            d.center[1] + ((r * d.rz) / d.rx) * Math.sin((i * Math.PI * 2) / 48),
          ]);
        beamPath(o, 'gold', ps, 0.12, 0.12, C.gold);
      }
  }
}
const glyph = {
  G: [
    [
      [1, 0.85],
      [0.8, 1],
      [0.2, 1],
      [0, 0.8],
      [0, 0.2],
      [0.2, 0],
      [1, 0],
      [1, 0.5],
      [0.55, 0.5],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.8, 1],
      [1, 0.8],
      [0.8, 0.55],
      [0, 0.55],
    ],
    [
      [0.5, 0.55],
      [1, 0],
    ],
  ],
  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.23, 0.45],
      [0.77, 0.45],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
      [0.65, 1],
      [1, 0.75],
      [1, 0.25],
      [0.65, 0],
      [0, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  I: [
    [
      [0.15, 1],
      [0.85, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
    [
      [0.15, 0],
      [0.85, 0],
    ],
  ],
  S: [
    [
      [1, 0.9],
      [0.8, 1],
      [0.2, 1],
      [0, 0.8],
      [0.2, 0.55],
      [0.8, 0.45],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
      [0, 0.1],
    ],
  ],
  B: [
    [
      [0, 0],
      [0, 1],
      [0.7, 1],
      [1, 0.8],
      [0.7, 0.52],
      [0, 0.52],
    ],
    [
      [0.7, 0.52],
      [1, 0.3],
      [0.75, 0],
      [0, 0],
    ],
  ],
  O: [
    [
      [0.2, 0],
      [0, 0.2],
      [0, 0.8],
      [0.2, 1],
      [0.8, 1],
      [1, 0.8],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
    ],
  ],
};
function sign(o, text, u, y, v, w, h, color = C.gold) {
  const step = w / text.length;
  for (let i = 0; i < text.length; i++)
    for (const line of glyph[text[i]] ?? [])
      for (let j = 1; j < line.length; j++) {
        const P = (p) => [u + (i - text.length / 2) * step + p[0] * step * 0.75, y + p[1] * h, v];
        beam(o, 'gold', P(line[j - 1]), P(line[j]), h * 0.085, h * 0.085, color);
      }
}
function base(o, cfg) {
  const p = a.podium,
    polys = cfg.far ? p.polygons : p.remainder,
    lo = (u, v) => Math.min(-0.7, G(u, v) - 0.6);
  walls(o, S(cfg, 'stone'), polys, lo, p.topY, C.stone);
  cap(o, S(cfg, 'gold'), polys, p.topY, C.gold);
  cap(o, S(cfg, 'stone'), polys, lo, C.stone, true);
  const pedestal = a.tower.pedestal;
  walls(o, S(cfg, 'gold'), a.nativeMap.towerFootprint, pedestal.minY, pedestal.lowerTopY, C.gold);
  cap(o, S(cfg, 'gold'), a.nativeMap.towerFootprint, pedestal.lowerTopY, C.gold);
  loft(
    o,
    S(cfg, 'gold'),
    pedestal.profiles.map(([y, w, d]) => chamferedRectangle(0, y, 0, w * 2, d * 2, 1)),
    C.gold,
  );
  if (!cfg.far) {
    for (let y = 11; y < 24; y += 4)
      walls(o, 'glass', a.nativeMap.towerFootprint, y, y + 2, C.glass);
  }
  for (const annex of a.annexes) {
    const [x, z] = annex.center,
      y0 = Math.min(-0.7, G(x, z) - 0.6);
    cylinder(
      o,
      S(cfg, 'gold'),
      annex.center,
      annex.radius,
      annex.radius,
      y0,
      annex.topY,
      cfg.sides,
      C.gold,
    );
    if (!cfg.far) {
      for (let y = 10; y < annex.topY; y += 3.5)
        cylinder(
          o,
          'glass',
          annex.center,
          annex.radius + 0.035,
          annex.radius + 0.035,
          y,
          y + 2.2,
          cfg.sides,
          C.glass,
        );
      cylinder(
        o,
        'stone',
        annex.center,
        annex.radius - 0.5,
        annex.radius - 0.5,
        annex.topY,
        annex.topY + 0.35,
        cfg.sides,
        C.stone,
      );
      if (cfg.detail)
        torus(o, 'gold', [x, annex.topY + 1, z], annex.radius - 0.7, 0.08, C.gold, cfg.sides, 4);
    }
  }
  const e = a.entry.pylon,
    [x, z] = e.center;
  box(
    o,
    S(cfg, 'gold'),
    [x - e.width / 2, lo(x, z), z - e.depth / 2],
    [x + e.width / 2, e.height, z + e.depth / 2],
    C.gold,
  );
  if (cfg.entry) {
    box(
      o,
      'sign',
      [x - e.width * 0.43, 11, z + e.depth / 2 + 0.03],
      [x + e.width * 0.43, 19, z + e.depth / 2 + 0.18],
      C.dark,
    );
    sign(o, 'GRAND LISBOA', x, 21, z + e.depth / 2 + 0.2, 5.6, 0.8, C.silver);
    sign(o, 'GRAND LISBOA', 0, 215, 14.3, 48, 3, C.gold);
    if (cfg.detail) {
      for (let y = 2; y < 25; y += 1.8)
        box(
          o,
          'frame',
          [x - e.width / 2 - 0.08, y, z - e.depth / 2 - 0.08],
          [x + e.width / 2 + 0.08, y + 0.12, z + e.depth / 2 + 0.08],
          C.frame,
        );
    }
  }
}
export function buildLisboaLevel(builder, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw Error('Unknown Grand Lisboa level:' + level);
  const o = designOut(builder);
  base(o, cfg);
  towerBody(o, cfg);
  leaves(o, cfg);
  crown(o, cfg);
  casino(o, cfg);
}
export const buildLisboaSkyline = (o) => buildLisboaLevel(o, 'skyline');
export const buildLisboaDistrict = (o) => buildLisboaLevel(o, 'district');
export const buildLisboaStreet = (o) => buildLisboaLevel(o, 'street');
export const buildLisboaCloseup = (o) => buildLisboaLevel(o, 'closeup');
