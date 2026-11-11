/** Einsiedeln Abbey exterior with mapped courts, shared materials and four authored LODs. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const abbeySurfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime' },
  stone: { slot: 'trim', graph: 'stone_limestone_raw' },
  tile: { slot: 'roof', graph: 'tile_flat' },
  copper: { slot: 'roof', graph: 'metal_copper' },
  window: { slot: 'window', graph: 'window_punched' },
  door: { slot: 'door', graph: 'wood_plain' },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast' },
};
const palette = {
  lime: 'ebe2ca',
  court: 'f2ebd9',
  base: 'b2a795',
  ashlar: 'cec4af',
  carved: 'e4d9be',
  pale: 'ddd2bb',
  brick: 'a96b4d',
  corner: 'a1664e',
  ridge: '995a44',
  verdigris: '637d73',
  copperShade: '506c63',
  pane: '747e7d',
  deep: '515a56',
  timber: '5c392a',
  gold: 'd3ac60',
  clock: '374a51',
  relief: 'b1a694',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((channel) => {
      const v = parseInt(channel, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff',
  levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { eave } = layout;
function face(out, slot, tint, points, expected) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, normal, undefined, color[tint]);
  else if (points.length === 4) out.addQuad(slot, ref, points, normal, undefined, color[tint]);
  else out.addConvexPolygon(slot, ref, points, normal, (p) => [p[0], p[2]], color[tint]);
}
function frame([x, z], [a, b]) {
  const length = Math.hypot(a - x, b - z),
    dx = (a - x) / length,
    dz = (b - z) / length;
  return {
    length,
    n: [dz, 0, -dx],
    p: (u, y, w = 0) => [x + dx * u + dz * w, y, z + dz * u - dx * w],
  };
}
function panel(out, f, slot, tint, a, b, y, h, w = 0) {
  face(out, slot, tint, [f.p(a, y, w), f.p(b, y, w), f.p(b, h, w), f.p(a, h, w)], f.n);
}
function extrude(out, f, slot, tint, a, b, y, h, inner, outer) {
  panel(out, f, slot, tint, a, b, y, h, outer);
  for (const [u, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    face(
      out,
      slot,
      tint,
      [f.p(u, y, inner), f.p(u, y, outer), f.p(u, h, outer), f.p(u, h, inner)],
      [-f.n[2] * sign, 0, f.n[0] * sign],
    );
  }
  for (const [level, sign] of [
    [y, -1],
    [h, 1],
  ]) {
    face(
      out,
      slot,
      tint,
      [f.p(a, level, inner), f.p(b, level, inner), f.p(b, level, outer), f.p(a, level, outer)],
      [0, sign, 0],
    );
  }
}
function block(out, slot, tint, x0, x1, z0, z1, y0, y1, cap = true) {
  const rect = (y) => [
    [x0, y, z0],
    [x0, y, z1],
    [x1, y, z1],
    [x1, y, z0],
  ];
  loft(out, slot, [rect(y0), rect(y1)], color[tint], { cap });
}
function arc(u, spring, r, rise, count) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [u + r * Math.cos(t), spring + rise * Math.sin(t)];
  });
}
function archedPanel(
  out,
  f,
  { u, y, w, h, depth, trim = 0.25, segments = 6, slot = 'window', tint = 'deep' },
) {
  const r = w / 2,
    spring = y + h * 0.67,
    rise = y + h - spring;
  const inside = arc(u, spring, r, rise, segments),
    outside = arc(u, spring, r + trim, rise + trim, segments);
  face(
    out,
    slot,
    tint,
    [[u - r, y], [u + r, y], ...inside].map(([a, b]) => f.p(a, b, depth)),
    f.n,
  );
  panel(out, f, 'stone', 'carved', u - r - trim, u - r, y, spring, depth + 0.07);
  panel(out, f, 'stone', 'carved', u + r, u + r + trim, y, spring, depth + 0.07);
  for (let i = 0; i < segments; i++)
    face(
      out,
      'stone',
      'carved',
      [inside[i], inside[i + 1], outside[i + 1], outside[i]].map(([a, b]) =>
        f.p(a, b, depth + 0.07),
      ),
      f.n,
    );
}
function disk(out, f, slot, tint, u, y, r, depth, segments) {
  const points = Array.from({ length: segments }, (_, i) => {
    const t = (i * Math.PI * 2) / segments;
    return f.p(u + Math.cos(t) * r, y + Math.sin(t) * r, depth);
  });
  face(out, slot, tint, points, f.n);
}
function line(out, f, slot, tint, a, b, width, depth) {
  const du = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(du, dy),
    u = (dy * width) / (2 * l),
    y = (-du * width) / (2 * l);
  face(
    out,
    slot,
    tint,
    [
      f.p(a[0] - u, a[1] - y, depth),
      f.p(b[0] - u, b[1] - y, depth),
      f.p(b[0] + u, b[1] + y, depth),
      f.p(a[0] + u, a[1] + y, depth),
    ],
    f.n,
  );
}
function wings(out, tier) {
  for (const [courtIndex, edges] of layout.walls.entries()) {
    for (const edge of edges) {
      const points = edge.points,
        start = points[0],
        end = points.at(-1),
        f = frame(start, end);
      const floor = Math.min(...points.map((p) => p[2])) - 0.85;
      const body = edge.frontChurch ? 'stone' : 'wall',
        tint = edge.frontChurch ? 'ashlar' : courtIndex ? 'court' : 'lime';
      panel(out, f, body, tint, 0, f.length, tier < 2 ? floor : 2.3, eave);
      if (tier >= 2) {
        for (let j = 1; j < points.length; j++) {
          const a = points[j - 1],
            b = points[j],
            u = (f.length * (j - 1)) / (points.length - 1),
            v = (f.length * j) / (points.length - 1);
          face(
            out,
            'stone',
            'base',
            [
              f.p(u, Math.min(a[2] - 0.85, 2.05)),
              f.p(v, Math.min(b[2] - 0.85, 2.05)),
              f.p(v, 2.3),
              f.p(u, 2.3),
            ],
            f.n,
          );
        }
        panel(out, f, 'stone', 'pale', 0, f.length, eave - 0.37, eave + 0.08, 0.13);
      }
      if (tier >= 1)
        for (const [a, b, y, h] of edge.flashings)
          face(
            out,
            f.length > 3 ? 'wall' : body,
            tint,
            [
              f.p(a, eave - 0.018, 0.009),
              f.p(b, eave - 0.018, 0.009),
              f.p(b, h, 0.009),
              f.p(a, y, 0.009),
            ],
            f.n,
          );
      if (tier === 0 || edge.frontChurch || f.length < 2.05) continue;
      const count = Math.max(1, Math.round(f.length / 3.37));
      const rows = tier === 1 ? (courtIndex ? [12.05] : [8.1, 12.05]) : [4.05, 8.1, 12.05, 15.65];
      for (let i = 0; i < count; i++) {
        const u = (f.length * (i + 0.5)) / count;
        for (const y of rows) {
          const w = y === 15.65 ? 0.53 : 0.71,
            h = y === 15.65 ? 1.51 : 2.14;
          if (y < start[2] + ((end[2] - start[2]) * (i + 0.5)) / count + 0.35) continue;
          panel(out, f, 'window', 'pane', u - w, u + w, y, y + h, 0.027);
          if (tier >= 2) {
            panel(out, f, 'stone', 'carved', u - w - 0.15, u + w + 0.15, y - 0.11, y, 0.095);
            if (tier >= 3 || !courtIndex)
              panel(
                out,
                f,
                'stone',
                'pale',
                u - w - 0.12,
                u + w + 0.12,
                y + h,
                y + h + 0.17,
                0.083,
              );
          }
          if (tier >= 3) {
            panel(out, f, 'stone', 'pale', u - w - 0.12, u - w, y, y + h, 0.075);
            panel(out, f, 'stone', 'pale', u + w, u + w + 0.12, y, y + h, 0.075);
            panel(out, f, 'stone', 'pale', u - 0.035, u + 0.035, y, y + h, 0.076);
            panel(out, f, 'stone', 'pale', u - w, u + w, y + h * 0.63, y + h * 0.63 + 0.06, 0.076);
          }
        }
      }
      if (tier >= 2 && f.length > 7) {
        panel(out, f, 'stone', 'ashlar', 0, f.length, 7.42, 7.58, 0.066);
        panel(out, f, 'stone', 'ashlar', 0, f.length, 11.37, 11.49, 0.059);
      }
    }
  }
}
function upperChurch(out, tier) {
  for (const { ring: exact, base, kind } of layout.upperRanges) {
    const ring =
      tier > 0
        ? exact
        : exact.filter(([x, z], i) => {
            const [a, b] = exact[(i + exact.length - 1) % exact.length],
              [c, d] = exact[(i + 1) % exact.length];
            return (
              Math.abs((x - a) * (d - b) - (z - b) * (c - a)) > 0.55 * Math.hypot(c - a, d - b)
            );
          });
    for (const [i, a] of ring.entries()) {
      const b = ring[(i + 1) % ring.length],
        f = frame(a, b);
      panel(out, f, 'wall', 'court', 0, f.length, eave - 0.04, base);
      if (tier < 2 || f.length < 5.3) continue;
      panel(out, f, 'stone', 'ashlar', 0, f.length, base - 0.34, base + 0.01, 0.064);
      const bays = Math.max(1, Math.floor(f.length / 7.5));
      for (let j = 0; j < bays; j++) {
        const u = (f.length * (j + 0.5)) / bays,
          y = base - (kind === 'church' ? 5.35 : 4.0),
          h = kind === 'church' ? 4.48 : 3.05;
        archedPanel(out, f, {
          u,
          y,
          w: kind === 'church' ? 2.05 : 1.63,
          h,
          depth: 0.032,
          trim: 0.22,
          segments: tier >= 3 ? 10 : 5,
        });
        if (tier >= 3) {
          panel(out, f, 'stone', 'carved', u - 1.18, u + 1.18, y - 0.1, y, 0.086);
          panel(out, f, 'stone', 'pale', u - 0.052, u + 0.052, y, y + h * 0.94, 0.081);
        }
      }
    }
  }
}
function roofs(out, tier) {
  for (const triangle of layout.ceiling) face(out, 'tile', 'ridge', triangle, [0, 1, 0]);
  for (const { kind, triangles, skylineTriangles } of layout.roofs)
    for (const triangle of tier === 0 && skylineTriangles ? skylineTriangles : triangles)
      face(out, 'tile', kind === 'pavilion' ? 'corner' : 'brick', triangle, [0, 1, 0]);
}
function dormer(out, f, base) {
  const w = f.length,
    m = w / 2,
    y = base + 0.74;
  const tip = f.p(m, y + 0.58, 0.13),
    a = f.p(0, y, 0.14),
    b = f.p(w, y, 0.14),
    c = f.p(0, y - 0.14, -1.1),
    d = f.p(w, y - 0.14, -1.1),
    back = f.p(m, y + 0.4, -1.1);
  panel(out, f, 'wall', 'court', 0, w, base - 0.6, y, 0.14);
  panel(out, f, 'window', 'deep', 0.25, w - 0.25, base - 0.27, y - 0.16, 0.16);
  face(out, 'wall', 'court', [a, b, tip], f.n);
  face(out, 'tile', 'corner', [a, tip, back, c], [0, 1, 0]);
  face(out, 'tile', 'corner', [tip, b, d, back], [0, 1, 0]);
  face(
    out,
    'wall',
    'lime',
    [a, c, f.p(0, base - 0.6, -1.1), f.p(0, base - 0.6, 0.14)],
    [f.n[2], 0, -f.n[0]],
  );
  face(
    out,
    'wall',
    'lime',
    [b, d, f.p(w, base - 0.6, -1.1), f.p(w, base - 0.6, 0.14)],
    [-f.n[2], 0, f.n[0]],
  );
}
function dormers(out, tier) {
  for (const [fixed, list, y, axis, sign] of [
    [1.4, [-45, -39, -33], 22.7, 'x', -1],
    [1.4, [29, 35, 41], 22.6, 'x', -1],
    [-63, [23, 34, 45, 56, 67, 78, 89, 100, 111], 22.05, 'z', -1],
    [54, [61, 72, 91, 102, 113], 23.0, 'z', 1],
  ])
    list.forEach((p, i) => {
      if (tier === 2 && i % 2 !== 0) return;
      const edge =
        axis === 'x'
          ? [
              [fixed, p - 0.67],
              [fixed, p + 0.67],
            ]
          : [
              [p - 0.67, fixed],
              [p + 0.67, fixed],
            ];
      dormer(
        out,
        frame(
          ...((axis === 'x' && sign < 0) || (axis === 'z' && sign > 0) ? edge.toReversed() : edge),
        ),
        y,
      );
    });
}
function steps(out, tier) {
  for (const [i, { x, half, top, foot }] of layout.steps.entries()) {
    const end = i === layout.steps.length - 1 ? -8.25 : layout.steps[i + 1].x;
    if (tier < 2) {
      face(
        out,
        'stone',
        'pale',
        [
          [x, top, -half],
          [x, top, half],
          [end, top, half],
          [end, top, -half],
        ],
        [0, 1, 0],
      );
      face(
        out,
        'stone',
        'base',
        [
          [x, foot, -half],
          [x, foot, half],
          [x, top, half],
          [x, top, -half],
        ],
        [-1, 0, 0],
      );
    } else block(out, 'stone', 'pale', x, end, -half, half, foot, top);
  }
}
function statue(out, f, u, y, tier, scale = 1) {
  if (tier < 2) {
    panel(out, f, 'stone', 'relief', u - 0.34 * scale, u + 0.34 * scale, y, y + 1.64 * scale, 0.54);
    return;
  }
  const p = (du, h, dep) => f.p(u + du * scale, y + h * scale, dep * scale);
  const sides = tier >= 3 ? 9 : 6;
  const rings = [
    [0.03, 0.32, 0.45],
    [0.37, 0.29, 0.41],
    [1.0, 0.22, 0.39],
    [1.33, 0.26, 0.5],
  ].map(([h, r, dep]) => {
    const [x, center, z] = p(0, h, dep);
    return radialRing(center, r * scale, r * scale, sides, [x, z]);
  });
  loft(out, 'stone', rings, color.relief);
  sphere(
    out,
    'stone',
    p(0.04, 1.54, 0.48),
    [0.15 * scale, 0.22 * scale, 0.16 * scale],
    color.carved,
    sides,
    5,
  );
  if (tier >= 3) {
    beam(
      out,
      'stone',
      p(-0.22, 1.22, 0.62),
      p(-0.37, 0.82, 0.8),
      0.19 * scale,
      0.19 * scale,
      color.relief,
    );
    beam(
      out,
      'stone',
      p(0.24, 1.24, 0.64),
      p(0.28, 1.02, 0.86),
      0.18 * scale,
      0.18 * scale,
      color.carved,
    );
  }
}
function church(out, tier) {
  const f = frame([-10.09, 11.3], [-10.09, -11.3]),
    m = f.length / 2;
  const profile = [
    [0, 22.2],
    [2.15, 23.5],
    [3.85, 26.6],
    [5.25, 27.2],
    [5.65, 32.9],
    [7.6, 33.0],
    [9.62, 36.4],
    [m, 38.1],
    [12.98, 36.4],
    [15, 33.0],
    [16.95, 32.9],
    [17.36, 27.2],
    [18.74, 26.6],
    [20.45, 23.5],
    [22.6, 22.2],
  ];
  for (let j = 1; j < profile.length; j++) {
    const [u, y] = profile[j - 1],
      [v, h] = profile[j];
    face(out, 'stone', 'ashlar', [f.p(u, 17.25), f.p(v, 17.25), f.p(v, h), f.p(u, y)], f.n);
    face(
      out,
      'stone',
      'ashlar',
      [f.p(u, y), f.p(v, h), f.p(v, h, -5.8), f.p(u, y, -5.8)],
      [0, 1, 0],
    );
    if (tier >= 1) line(out, f, 'stone', 'carved', [u, y], [v, h], 0.24, 0.18);
  }
  for (const [u, sign] of [
    [0, -1],
    [22.6, 1],
  ])
    face(
      out,
      'stone',
      'ashlar',
      [f.p(u, 17.25), f.p(u, 22.2), f.p(u, 22.2, -5.8), f.p(u, 17.25, -5.8)],
      [-f.n[2] * sign, 0, f.n[0] * sign],
    );
  const door = frame([-10.21, 2.8], [-10.33, -2.8]),
    u = door.length / 2;
  archedPanel(out, door, {
    u,
    y: layout.steps.at(-1).top,
    w: 3.1,
    h: 5.66,
    depth: 0.22,
    slot: 'door',
    tint: 'timber',
    trim: 0.41,
    segments: tier >= 3 ? 12 : 5,
  });
  if (tier >= 1) {
    for (const side of [
      frame([-8.98, 7.17], [-9.85, 2.81]),
      frame([-10.08, -2.75], [-9.61, -7.39]),
    ]) {
      const c = side.length / 2;
      archedPanel(out, side, {
        u: c,
        y: 2.3,
        w: 1.35,
        h: 3.35,
        depth: 0.25,
        slot: 'door',
        tint: 'timber',
        trim: 0.18,
      });
      archedPanel(out, side, {
        u: c,
        y: 9.6,
        w: 1.9,
        h: 5.7,
        depth: 0.27,
        segments: tier >= 2 ? 8 : 4,
      });
      if (tier >= 2) {
        extrude(out, side, 'stone', 'carved', c - 1.22, c + 1.22, 9.42, 9.67, 0.03, 0.45);
        for (const a of [c - 1.4, c + 1.4]) {
          extrude(out, side, 'stone', 'carved', a - 0.19, a + 0.19, 2.4, 16.8, 0.05, 0.5);
          extrude(out, side, 'stone', 'ashlar', a - 0.34, a + 0.34, 16.38, 17.1, 0.05, 0.61);
        }
      }
    }
    disk(out, f, 'stone', 'carved', m, 15.9, 1.41, 0.42, 16);
    disk(out, f, 'window', 'deep', m, 15.9, 1.13, 0.46, 16);
    archedPanel(out, f, { u: m, y: 24.1, w: 2.1, h: 5.3, depth: 0.14, trim: 0.28 });
    if (tier >= 2)
      for (const a of [2.4, 5.8, 8.5, 14.1, 16.8, 20.2]) {
        const h = a > 5.5 && a < 17 ? 32.65 : 23.1;
        extrude(out, f, 'stone', 'carved', a - 0.34, a + 0.34, 18.05, h, 0, 0.44);
        extrude(out, f, 'stone', 'carved', a - 0.59, a + 0.59, h - 0.59, h, 0.08, 0.65);
      }
    extrude(out, f, 'stone', 'pale', 0.1, 22.5, 17.66, 18.38, 0, 0.54);
    extrude(out, f, 'stone', 'carved', 5.55, 17.06, 31.87, 32.54, 0, 0.46);
    extrude(out, door, 'stone', 'carved', u - 2.06, u + 2.06, 6.83, 7.24, 0.06, 0.67);
    if (tier >= 2) {
      panel(out, door, 'stone', 'ashlar', u - 1.53, u + 1.53, 7.32, 8.42, 0.18);
      for (const t of [-1, 1]) {
        panel(
          out,
          door,
          'stone',
          'carved',
          u + t * 1.9 - 0.13,
          u + t * 1.9 + 0.13,
          1.15,
          6.75,
          0.36,
        );
        line(out, door, 'bronze', 'gold', [u + t * 0.31, 2.74], [u + t * 0.31, 3.18], 0.062, 0.33);
      }
      line(out, door, 'stone', 'carved', [u - 2.34, 7.36], [u, 8.71], 0.17, 0.54);
      line(out, door, 'stone', 'carved', [u, 8.71], [u + 2.34, 7.36], 0.17, 0.54);
      for (const side of [
        frame([-9.63, -7.32], [-8.39, -10.72]),
        frame([-8.92, 10.72], [-9.52, 7.04]),
      ]) {
        archedPanel(out, side, { u: side.length / 2, y: 8.4, w: 1.48, h: 4.8, depth: 0.33 });
        statue(out, side, side.length / 2, 9.17, tier, 1.32);
      }
    }
  }
  for (const [a, y, s] of [
    [3, 24.8, 0.92],
    [6.4, 32.93, 1.13],
    [m, 38.05, 1.08],
    [16.26, 32.93, 1.13],
    [19.55, 24.8, 0.92],
  ])
    if (tier > 0 || a === m) statue(out, f, a, y, tier, s);
}
function towerBase(out, tower, tier) {
  const ring = tower.footprint;
  const winding = ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
  const ordered = winding > 0 ? ring : ring.toReversed();
  for (let i = 0; i < ordered.length; i++) {
    const f = frame(ordered[i], ordered[(i + 1) % ordered.length]);
    panel(out, f, 'stone', 'ashlar', 0, f.length, -1.35, 19.5, 0.016);
    if (tier >= 2) {
      panel(out, f, 'stone', 'base', 0, f.length, -1.36, 1.8, 0.041);
      for (const y of [7.24, 13.1, 18.4])
        panel(out, f, 'stone', 'carved', 0, f.length, y, y + 0.41, 0.094);
      if (f.length > 4)
        archedPanel(out, f, {
          u: f.length / 2,
          y: 5.1,
          w: 1.62,
          h: 5.42,
          depth: 0.082,
          segments: tier >= 3 ? 8 : 5,
        });
    }
  }
}
function belfry(out, f, tier) {
  const l = f.length,
    r = Math.min(1.53, l * 0.24),
    u = l / 2,
    base = 39.62,
    spring = 44.2,
    high = 47.7;
  if (l < 1.05) {
    panel(out, f, 'stone', 'ashlar', 0, l, base, high);
    return;
  }
  panel(out, f, 'stone', 'ashlar', 0, u - r, base, high);
  panel(out, f, 'stone', 'ashlar', u + r, l, base, high);
  panel(out, f, 'stone', 'ashlar', u - r, u + r, base, base + 0.63);
  const curve = arc(u, spring, r, 1.95, tier >= 2 ? 10 : 4);
  for (let i = 1; i < curve.length; i++) {
    const [a, y] = curve[i - 1],
      [b, h] = curve[i];
    face(out, 'stone', 'ashlar', [f.p(a, y), f.p(b, h), f.p(b, high), f.p(a, high)], f.n);
    if (tier === 1) continue;
    line(out, f, 'stone', 'carved', [a, y], [b, h], 0.25, 0.12);
    const start = f.p(a, y),
      end = f.p(b, h),
      reveal = f.p(b, h, -0.52);
    face(
      out,
      'stone',
      'pale',
      [start, end, reveal, f.p(a, y, -0.52)],
      normalFor(start, end, reveal),
    );
  }
  if (tier >= 2)
    for (const a of [u - r, u + r]) {
      const sign = a < u ? 1 : -1;
      face(
        out,
        'stone',
        'pale',
        [f.p(a, base + 0.63), f.p(a, spring), f.p(a, spring, -0.57), f.p(a, base + 0.63, -0.57)],
        [-f.n[2] * sign, 0, f.n[0] * sign],
      );
      extrude(out, f, 'stone', 'carved', a - 0.13, a + 0.13, base + 0.52, spring, -0.02, 0.16);
    }
  if (tier >= 2)
    for (let i = 0; i < 9; i++)
      panel(
        out,
        f,
        'door',
        'timber',
        u - r + 0.16,
        u + r - 0.16,
        base + 0.96 + i * 0.46,
        base + 1.13 + i * 0.46,
        -0.42,
      );
}
function clock(out, f, tier) {
  const u = f.length / 2,
    y = 35.78,
    r = 1.49;
  if (tier > 0) disk(out, f, 'stone', 'carved', u, y, r + 0.22, 0.085, [8, 12, 18, 24, 24][tier]);
  disk(out, f, 'stone', 'clock', u, y, r, 0.12, tier === 0 ? 8 : 24);
  if (tier === 0) return;
  const marks = tier === 1 ? 4 : 12;
  for (let i = 0; i < marks; i++) {
    const a = (Math.PI * 2 * i) / marks,
      dx = Math.sin(a),
      dy = Math.cos(a);
    line(
      out,
      f,
      'bronze',
      'gold',
      [u + dx * 1.13, y + dy * 1.13],
      [u + dx * 1.38, y + dy * 1.38],
      i % 3 === 0 ? 0.17 : 0.11,
      0.177,
    );
  }
  line(out, f, 'bronze', 'gold', [u, y], [u + 0.63, y + 0.68], 0.167, 0.188);
  line(out, f, 'bronze', 'gold', [u, y], [u - 0.88, y + 0.62], 0.146, 0.191);
}
function tower(out, site, tier) {
  const [x, z] = site.center;
  if (tier > 0) towerBase(out, site, tier);
  const square = (y, w, ch) => chamferedRectangle(x, y, z, w, w, ch);
  if (tier === 0) {
    block(out, 'stone', 'ashlar', x - 4.15, x + 4.15, z - 4.15, z + 4.15, 17.98, 39.6, false);
    block(out, 'stone', 'carved', x - 3.92, x + 3.92, z - 3.92, z + 3.92, 46.9, 49.0, false);
    const f = frame([x - 4.16, z + 3.91], [x - 4.16, z - 3.91]);
    clock(out, f, tier);
    panel(out, f, 'window', 'deep', f.length / 2 - 1.36, f.length / 2 + 1.36, 40.13, 46.28);
    block(out, 'stone', 'ashlar', x - 3.8, x + 3.8, z - 3.8, z + 3.8, 39.46, 47.14, false);
  } else {
    loft(
      out,
      'stone',
      [
        square(18.8, 9, 0.41),
        square(24.5, 9, 0.55),
        square(25.05, 7.74, 0.65),
        square(39.62, 7.74, 0.65),
      ],
      color.ashlar,
    );
    const courses = [
      [19.1, 9.45, 0.51],
      [24.03, 9.65, 0.73],
      [30.85, 8.19, 0.45],
      [38.98, 8.7, 0.67],
      [47.46, 8.66, 0.67],
      [48.16, 8.03, 0.49],
    ];
    for (const [i, [y, w, h]] of courses.entries())
      if (tier >= 2 || i === 1 || i === 4)
        loft(out, 'stone', [square(y, w, 0.65), square(y + h, w - 0.14, 0.62)], color.carved);
    const perimeter = square(0, 7.7, 0.66);
    for (let i = 0; i < perimeter.length; i++) {
      const [a, , b] = perimeter[i],
        [c, , d] = perimeter[(i + 1) % perimeter.length];
      const f = frame([c, d], [a, b]);
      if (i % 2 === 0) {
        panel(out, f, 'stone', 'ashlar', 0, f.length, 39.62, 47.7);
        continue;
      }
      belfry(out, f, tier);
      clock(out, f, tier);
      if (tier === 1) continue;
      archedPanel(out, f, {
        u: f.length / 2,
        y: 26.05,
        w: 1.78,
        h: 4.33,
        depth: 0.065,
        segments: tier >= 3 ? 9 : 5,
      });
      for (const v of [0.34, f.length - 0.34]) {
        extrude(out, f, 'stone', 'carved', v - 0.21, v + 0.21, 25.17, 38.9, 0, 0.26);
        if (tier >= 2) {
          extrude(out, f, 'stone', 'carved', v - 0.32, v + 0.32, 38.36, 39.21, 0, 0.38);
          extrude(out, f, 'stone', 'pale', v - 0.25, v + 0.25, 39.62, 47.44, 0, 0.33);
        }
      }
    }
    if (tier >= 2) {
      const bell = [
        [41.05, 0.86],
        [41.24, 0.89],
        [41.48, 0.64],
        [42.66, 0.43],
        [42.93, 0.26],
      ];
      loft(
        out,
        'bronze',
        bell.map(([y, r]) => radialRing(y, r, r, 12, [x, z])),
        color.relief,
      );
    }
  }
  const facets = [7, 12, 16, 24, 28][tier];
  const dome =
    tier < 2
      ? [
          [48.6, 3.77],
          [51.78, 3.97],
          [55.8, 2.53],
          [57.14, 0.37],
        ]
      : [
          [48.64, 3.77],
          [49.12, 3.84],
          [50.43, 3.93],
          [51.94, 3.91],
          [53.59, 3.46],
          [55.0, 2.64],
          [56.18, 1.41],
          [57.03, 0.46],
        ];
  const rings = dome.map(([y, r]) => radialRing(y, r, r, facets, [x, z], Math.PI / 8));
  loft(out, 'copper', rings, color.verdigris, { cap: tier > 0 });
  if (tier >= 2)
    for (let i = 0; i < facets; i += tier >= 3 ? 2 : 4)
      for (let j = 1; j < rings.length; j++) {
        const grow = ([a, y, b]) => [x + (a - x) * 1.005, y, z + (b - z) * 1.005];
        beam(
          out,
          'copper',
          grow(rings[j - 1][i]),
          grow(rings[j][i]),
          0.084,
          0.086,
          color.copperShade,
        );
      }
  const finial =
    tier === 0
      ? [
          [56.98, 0.54],
          [57.75, 0.28],
          [57.99, 0.13],
        ]
      : [
          [56.98, 0.54],
          [57.4, 0.27],
          [57.75, 0.33],
          [57.99, 0.13],
        ];
  loft(
    out,
    'bronze',
    finial.map(([y, r]) => radialRing(y, r, r, tier === 0 ? 5 : 8, [x, z])),
    color.gold,
    { cap: tier > 0 },
  );
  beam(out, 'bronze', [x, 57.85, z], [x, site.height, z], 0.118, 0.118, color.gold);
  if (tier === 0) {
    const f = frame([x - 0.059, z + 0.6], [x - 0.059, z - 0.6]);
    panel(out, f, 'bronze', 'gold', 0, f.length, 59.19, 59.3);
  } else beam(out, 'bronze', [x, 59.24, z - 0.59], [x, 59.24, z + 0.59], 0.112, 0.108, color.gold);
}
export function buildAbbeyLevel(out, level) {
  const tier = levels[level];
  if (tier === undefined) throw new Error('Unknown abbey level ' + level);
  wings(out, tier);
  roofs(out, tier);
  upperChurch(out, tier);
  steps(out, tier);
  church(out, tier);
  for (const site of layout.towers) tower(out, site, tier);
  if (tier >= 2) dormers(out, tier);
}
export const buildAbbeySkyline = (out) => buildAbbeyLevel(out, 'skyline');
export const buildAbbeyDistrict = (out) => buildAbbeyLevel(out, 'district');
export const buildAbbeyStreet = (out) => buildAbbeyLevel(out, 'street');
export const buildAbbeyCloseup = (out) => buildAbbeyLevel(out, 'closeup');
