/** Original curved-shell Pakistan Monument, fitted to the mapped hilltop complex. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone' },
  limestone: { slot: 'trim', graph: 'stone_limestone' },
  granite: { slot: 'foundation', graph: 'stone_granite' },
  metal: { slot: 'trim', graph: 'metal_painted' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
  glass: { slot: 'window', graph: 'window_grid' },
  turf: { slot: 'foundation', localRef: 'palette:#7b8963', roughness: 1 },
};
const palette = {
  sand: 'b78660',
  pale: 'd2b795',
  edge: 'ac7350',
  relief: 'b49c7b',
  carving: 'c3ab89',
  shade: '927b61',
  paving: 'c2b29b',
  dark: '3e4140',
  gold: 'b9a16c',
  white: 'dedbcf',
  roof: 'c2c6c4',
  glass: '506271',
  steel: '77786e',
  water: '609493',
  hedge: '78895d',
  grass: '94a278',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([name, hex]) => [
    name,
    hex.match(/../g).map((value) => {
      const v = parseInt(value, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const up = [0, 1, 0],
  down = [0, -1, 0],
  tier = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const tessellation = [
  { h: 3, w: 2, n: 8 },
  { h: 7, w: 4, n: 12 },
  { h: 14, w: 8, n: 20 },
  { h: 26, w: 14, n: 32 },
  { h: 40, w: 20, n: 48 },
];
const mix = (a, b, t) => a + (b - a) * t;
function face(out, slot, tint, points, wanted) {
  for (let i = 1; i + 1 < points.length; i++) {
    let tri = [points[0], points[i], points[i + 1]],
      n = normalFor(...tri);
    if (Math.hypot(...n) < 0.9) continue;
    if (n.reduce((s, v, j) => s + v * wanted[j], 0) < 0) {
      tri = tri.toReversed();
      n = n.map((v) => -v);
    }
    const uv = tri.map(([x, y, z]) =>
      Math.abs(n[1]) > 0.65 ? [x, z] : Math.abs(n[2]) > 0.65 ? [x, y] : [z, y],
    );
    out.addTriangle(slot, 'metric:uv', tri, n, uv, colors[tint]);
  }
}
function cap(out, slot, tint, outline, y, holes = []) {
  const rings = [outline, ...holes],
    points = rings.flat(),
    starts = [];
  let k = outline.length;
  for (const h of holes) {
    starts.push(k);
    k += h.length;
  }
  const idx = earcut(
    points.flatMap((p) => p.slice(0, 2)),
    starts,
  );
  for (let i = 0; i < idx.length; i += 3)
    face(
      out,
      slot,
      tint,
      idx.slice(i, i + 3).map((j) => {
        const p = points[j];
        return [p[0], typeof y === 'function' ? y(p) : y, p[1]];
      }),
      up,
    );
}
function box(out, slot, tint, x0, y0, z0, x1, y1, z1) {
  const a = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    b = a.map(([x, , z]) => [x, y1, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      slot,
      tint,
      [a[i], a[j], b[j], b[i]],
      [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i],
    );
  }
  face(out, slot, tint, b, up);
  face(out, slot, tint, a, down);
}
function cylinder(out, slot, tint, center, radius, height, n) {
  const ring = (r, y) =>
    Array.from({ length: n }, (_, i) => [
      center[0] + r * Math.cos((i * Math.PI * 2) / n),
      y,
      center[1] + r * Math.sin((i * Math.PI * 2) / n),
    ]);
  const A = ring(radius, center[2]),
    B = ring(radius, center[2] + height);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(out, slot, tint, [A[i], A[j], B[j], B[i]], [A[i][0] - center[0], 0, A[i][2] - center[1]]);
  }
  face(out, slot, tint, B, up);
}
export function petalPoint(p, u, t, depth = 0) {
  const middle = p.a.map((v, i) => (v + p.b[i]) / 2),
    R = Math.hypot(...middle),
    normal = middle.map((v) => v / R);
  const across = p.b.map((v, i) => (v - p.a[i]) / 2),
    width = Math.hypot(...across);
  const weight = Math.pow(t, 1.62),
    taper = Math.pow(1 - t, 0.77) * (1 + 0.12 * Math.sin(Math.PI * t)) + 0.006 * t;
  const bulge = width * 0.11 * (1 - u * u) * Math.sin(Math.PI * t);
  const xz = middle.map(
    (v, i) => mix(v, p.tip[i], weight) + across[i] * u * taper + normal[i] * (bulge + depth),
  );
  return [xz[0], layout.deck + p.height * t + 0.19 * (1 - u * u) * Math.sin(Math.PI * t), xz[1]];
}
function shell(out, p, detail) {
  const config = tessellation[detail],
    hs = p.small ? Math.max(2, Math.round(config.h * 0.65)) : config.h,
    ws = p.small ? Math.max(2, Math.round(config.w * 0.75)) : config.w;
  const n = p.a.map((v, i) => (v + p.b[i]) / 2),
    L = Math.hypot(...n),
    outside = [n[0] / L, 0, n[1] / L],
    inside = outside.map((v) => -v);
  const thickness = (t) => p.thickness * (1 - 0.49 * t);
  for (let j = 0; j < hs; j++)
    for (let i = 0; i < ws; i++) {
      const a = -1 + (2 * i) / ws,
        b = -1 + (2 * (i + 1)) / ws,
        t = j / hs,
        v = (j + 1) / hs;
      face(
        out,
        'sandstone',
        'sand',
        [petalPoint(p, a, t), petalPoint(p, b, t), petalPoint(p, b, v), petalPoint(p, a, v)],
        outside,
      );
      face(
        out,
        'limestone',
        'pale',
        [
          petalPoint(p, a, t, -thickness(t)),
          petalPoint(p, a, v, -thickness(v)),
          petalPoint(p, b, v, -thickness(v)),
          petalPoint(p, b, t, -thickness(t)),
        ],
        inside,
      );
    }
  for (const u of [-1, 1])
    for (let j = 0; j < hs; j++) {
      const a = j / hs,
        b = (j + 1) / hs;
      face(
        out,
        'sandstone',
        'edge',
        [
          petalPoint(p, u, a),
          petalPoint(p, u, b),
          petalPoint(p, u, b, -thickness(b)),
          petalPoint(p, u, a, -thickness(a)),
        ],
        [u * outside[2], 0, -u * outside[0]],
      );
    }
  for (const t of [0, 1])
    for (let i = 0; i < ws; i++) {
      const a = -1 + (2 * i) / ws,
        b = -1 + (2 * (i + 1)) / ws;
      face(
        out,
        'sandstone',
        'edge',
        [
          petalPoint(p, a, t),
          petalPoint(p, b, t),
          petalPoint(p, b, t, -thickness(t)),
          petalPoint(p, a, t, -thickness(t)),
        ],
        t ? up : down,
      );
    }
  if (detail === 0) return;
  for (const side of [-1, 1])
    for (const border of [0.85, 0.98]) {
      const width = border === 0.85 ? 0.028 : 0.05;
      for (let j = 0; j < hs; j++) {
        const a = j / hs,
          b = (j + 1) / hs,
          u = side * (border - width),
          v = side * border;
        face(
          out,
          'sandstone',
          border === 0.85 ? 'edge' : 'sand',
          [
            petalPoint(p, u, a, 0.027),
            petalPoint(p, v, a, 0.027),
            petalPoint(p, v, b, 0.027),
            petalPoint(p, u, b, 0.027),
          ],
          outside,
        );
      }
    }
  if (p.small || detail < 2) return;
  // Relief faces follow the curved inner surface. The shared stone carries fine grain.
  const point = ([u, t], depth = 0.048) =>
    petalPoint(p, u, t, -p.thickness * (1 - 0.49 * t) - depth);
  const relief = (points, tint = 'carving', depth = 0.048) =>
    face(
      out,
      'limestone',
      tint,
      points.map((q) => point(q, depth)),
      inside,
    );
  const rect = (u, t, w, h, tint = 'carving') =>
    relief(
      [
        [u, t],
        [u + w, t],
        [u + w, t + h],
        [u, t + h],
      ],
      tint,
    );
  const arch = (u, t, w, h, tint = 'shade') => {
    const N = detail > 2 ? 12 : 7;
    const pts = [
      [u - w / 2, t],
      [u + w / 2, t],
    ];
    for (let i = 0; i <= N; i++) {
      const a = (i * Math.PI) / N;
      pts.push([u + (w / 2) * Math.cos(a), t + h * 0.58 + h * 0.42 * Math.sin(a)]);
    }
    relief(pts, tint, 0.065);
  };
  const dome = (u, t, w, h) => {
    const count = detail > 2 ? 13 : 7;
    const pts = Array.from({ length: count }, (_, i) => [
      u - (w / 2) * Math.cos((i * Math.PI) / (count - 1)),
      t + h * Math.sin((i * Math.PI) / (count - 1)),
    ]);
    relief(pts, 'carving', 0.064);
  };
  for (const side of [-1, 1]) {
    const u = side * 0.73;
    rect(u - 0.015, 0.1, 0.03, 0.57, 'shade');
    rect(u - 0.055, 0.1, 0.025, 0.61, 'carving');
  }
  rect(-0.67, 0.12, 1.34, 0.022, 'shade');
  rect(-0.64, 0.15, 1.28, 0.016, 'carving');
  if (p.scene === 'minaret-and-mosque' || p.scene === 'tomb-and-domes') {
    rect(-0.48, 0.19, 0.97, 0.17);
    for (const u of [-0.3, 0, 0.3]) {
      dome(u, 0.36, 0.33, 0.074);
      rect(u - 0.012, 0.425, 0.024, 0.042, 'shade');
      arch(u, 0.21, 0.18, 0.11);
    }
    for (const u of [-0.57, 0.57]) {
      rect(u - 0.028, 0.18, 0.056, 0.3);
      rect(u - 0.05, 0.46, 0.1, 0.022);
      relief([
        [u - 0.046, 0.49],
        [u, 0.545],
        [u + 0.046, 0.49],
      ]);
    }
    if (detail > 2)
      for (let i = 0; i < 7; i++) arch(-0.43 + i * 0.145, 0.23, 0.072, 0.07, 'relief');
    if (p.scene === 'minaret-and-mosque') {
      rect(0.39, 0.43, 0.06, 0.21);
      relief([
        [0.37, 0.64],
        [0.42, 0.72],
        [0.47, 0.64],
      ]);
    } else {
      rect(-0.39, 0.47, 0.34, 0.095);
      dome(-0.22, 0.565, 0.38, 0.07);
    }
  } else if (p.scene === 'pass-and-fort') {
    relief(
      [
        [-0.61, 0.25],
        [-0.45, 0.39],
        [-0.28, 0.3],
        [-0.13, 0.44],
        [0.05, 0.35],
        [0.27, 0.5],
        [0.55, 0.36],
        [0.62, 0.2],
      ],
      'relief',
    );
    rect(-0.56, 0.19, 1.13, 0.11);
    rect(-0.33, 0.3, 0.13, 0.22);
    rect(0.16, 0.3, 0.13, 0.24);
    rect(-0.4, 0.48, 0.28, 0.035);
    rect(0.09, 0.5, 0.28, 0.035);
    arch(-0.025, 0.195, 0.33, 0.22);
  } else {
    rect(-0.5, 0.18, 1.0, 0.12);
    arch(0, 0.26, 0.62, 0.25);
    for (const u of [-0.49, 0.49]) {
      rect(u - 0.065, 0.29, 0.13, 0.23);
      dome(u, 0.52, 0.2, 0.045);
      for (let i = 0; i < 3; i++) rect(u - 0.05 + i * 0.04, 0.31, 0.016, 0.16, 'shade');
    }
    dome(0, 0.52, 0.4, 0.062);
  }
  if (detail > 2) {
    if (p.scene === 'minaret-and-mosque') {
      // The reference relief has two busts in front of the architectural panorama.
      relief(
        [
          [-0.39, 0.15],
          [-0.43, 0.25],
          [-0.34, 0.3],
          [-0.29, 0.33],
          [-0.25, 0.36],
          [-0.19, 0.36],
          [-0.16, 0.32],
          [-0.13, 0.28],
          [-0.12, 0.22],
          [-0.02, 0.18],
          [0.02, 0.15],
        ],
        'carving',
        0.11,
      );
      relief(
        [
          [0.01, 0.15],
          [0.06, 0.25],
          [0.13, 0.27],
          [0.14, 0.32],
          [0.22, 0.345],
          [0.3, 0.33],
          [0.34, 0.29],
          [0.32, 0.25],
          [0.42, 0.21],
          [0.51, 0.15],
        ],
        'carving',
        0.13,
      );
      relief(
        [
          [0.115, 0.325],
          [0.115, 0.358],
          [0.28, 0.365],
          [0.318, 0.338],
          [0.29, 0.324],
        ],
        'relief',
        0.146,
      );
      relief(
        [
          [-0.34, 0.3],
          [-0.29, 0.355],
          [-0.22, 0.38],
          [-0.16, 0.36],
          [-0.13, 0.31],
          [-0.18, 0.325],
          [-0.22, 0.351],
          [-0.28, 0.328],
        ],
        'relief',
        0.145,
      );
      rect(-0.285, 0.301, 0.054, 0.0035, 'shade');
      rect(0.163, 0.3, 0.05, 0.0035, 'shade');
      rect(-0.254, 0.275, 0.044, 0.0028, 'relief');
      rect(0.185, 0.275, 0.044, 0.0028, 'relief');
      for (let i = 0; i < 6; i++) {
        const u = -0.48 + i * 0.18;
        relief(
          [
            [u, 0.125],
            [u + 0.025, 0.15],
            [u + 0.08, 0.15],
            [u + 0.12, 0.125],
          ],
          'relief',
          0.09,
        );
      }
    }
    // Shallow border rosettes and masonry joints stay geometric and share the stone texture.
    for (const side of [-1, 1])
      for (let j = 0; j < 9; j++) {
        const u = side * 0.62,
          t = 0.2 + j * 0.044,
          r = 0.024;
        const points = Array.from({ length: 8 }, (_, i) => [
          u + r * Math.cos((i * Math.PI) / 4),
          t + r * 0.37 * Math.sin((i * Math.PI) / 4),
        ]);
        relief(points, j % 2 ? 'carving' : 'shade', 0.076);
      }
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 5; i++) {
        const u = -0.47 + (i + (j % 2) * 0.5) * 0.18,
          t = 0.18 + j * 0.019;
        if (u < 0.5) rect(u, t, 0.135, 0.0024, 'relief');
      }
  }
}
function podium(out, detail) {
  const points = layout.outline,
    deck = layout.deck,
    base = layout.footing;
  cap(out, 'granite', 'paving', points, deck);
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      y0 = base[i] - 0.65,
      y1 = base[(i + 1) % points.length] - 0.65,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      normal = [dz, 0, -dx],
      length = Math.hypot(dx, dz);
    face(
      out,
      'sandstone',
      'sand',
      [
        [a[0], y0, a[1]],
        [b[0], y1, b[1]],
        [b[0], deck, b[1]],
        [a[0], deck, a[1]],
      ],
      normal,
    );
    if (detail === 0) continue;
    const edge = ([x, z], y, d) => [x + (dz / length) * d, y, z - (dx / length) * d];
    const A = edge(a, deck - 0.38, 0.09),
      B = edge(b, deck - 0.38, 0.09),
      C = edge(b, deck - 0.18, 0.09),
      D = edge(a, deck - 0.18, 0.09);
    face(out, 'sandstone', 'edge', [A, B, C, D], normal);
    if (detail < 2) continue;
    const count = Math.max(2, Math.floor(length / 2.3));
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) / count,
        p = [mix(a[0], b[0], u), mix(a[1], b[1], u)];
      const e = (length / count) * 0.26,
        low = mix(y0, y1, u) + 0.6,
        high = Math.min(deck - 0.68, low + 1.2);
      if (high < low + 0.1) continue;
      const p0 = [p[0] - (dx / length) * e, p[1] - (dz / length) * e],
        p1 = [p[0] + (dx / length) * e, p[1] + (dz / length) * e];
      face(
        out,
        'metal',
        'dark',
        [edge(p0, low, 0.015), edge(p1, low, 0.015), edge(p1, high, 0.015), edge(p0, high, 0.015)],
        normal,
      );
    }
  }
}
function stairPoint(s, distance, offset, y) {
  return [
    s.top[0] + s.axis[0] * distance + s.across[0] * offset,
    y,
    s.top[1] + s.axis[1] * distance + s.across[1] * offset,
  ];
}
function stairs(out, detail) {
  const s = layout.stairs,
    count = detail === 0 ? 3 : detail === 1 ? 9 : s.treads,
    run = s.length - s.upperLanding - s.lowerLanding;
  const bands = [
    [-s.width / 2, -s.width / 6 - 0.12],
    [-s.width / 6 + 0.12, s.width / 6 - 0.12],
    [s.width / 6 + 0.12, s.width / 2],
  ];
  const top = layout.deck,
    bottom = s.low;
  for (const [left, right] of detail === 0 ? [[-s.width / 2, s.width / 2]] : bands) {
    const upper = [
      stairPoint(s, -0.14, left, top),
      stairPoint(s, s.upperLanding, left, top),
      stairPoint(s, s.upperLanding, right, top),
      stairPoint(s, -0.14, right, top),
    ];
    face(out, 'granite', 'paving', upper, up);
    for (let i = 0; i < count; i++) {
      const a = s.upperLanding + (run * i) / count,
        b = s.upperLanding + (run * (i + 1)) / count,
        y = mix(top, bottom, (i + 1) / count),
        prev = mix(top, bottom, i / count);
      face(
        out,
        'granite',
        'paving',
        [
          stairPoint(s, a, left, y),
          stairPoint(s, b, left, y),
          stairPoint(s, b, right, y),
          stairPoint(s, a, right, y),
        ],
        up,
      );
      face(
        out,
        'sandstone',
        'edge',
        [
          stairPoint(s, a, left, y),
          stairPoint(s, a, right, y),
          stairPoint(s, a, right, prev),
          stairPoint(s, a, left, prev),
        ],
        [s.axis[0], 0, s.axis[1]],
      );
      for (const o of [left, right])
        face(
          out,
          'sandstone',
          'sand',
          [
            stairPoint(s, a, o, s.footing),
            stairPoint(s, b, o, s.footing),
            stairPoint(s, b, o, y),
            stairPoint(s, a, o, y),
          ],
          [s.across[0] * o, 0, s.across[1] * o],
        );
    }
  }
  const row = [-0.5, -0.25, 0, 0.25, 0.5];
  for (let i = 1; i < row.length; i++) {
    const a = row[i - 1] * s.width,
      b = row[i] * s.width,
      from = s.length - s.lowerLanding;
    face(
      out,
      'granite',
      'paving',
      [
        stairPoint(s, from, a, bottom),
        stairPoint(s, s.length, a, s.endCross[i - 1]),
        stairPoint(s, s.length, b, s.endCross[i]),
        stairPoint(s, from, b, bottom),
      ],
      up,
    );
  }
  if (detail < 1) return;
  for (const offset of [-s.width / 2, s.width / 2, -s.width / 6, s.width / 6]) {
    const start = s.upperLanding * 0.5,
      end = s.length - s.lowerLanding * 0.7;
    const path = Array.from({ length: 5 }, (_, i) => {
      const d = mix(start, end, i / 4),
        t = Math.max(0, Math.min(1, (d - s.upperLanding) / run));
      return stairPoint(s, d, offset, mix(top, bottom, t) + 0.96);
    });
    for (let i = 1; i < path.length; i++)
      beam(out, 'metal', path[i - 1], path[i], 0.071, 0.071, colors.steel);
    for (const p of path)
      beam(out, 'metal', [p[0], p[1] - 0.94, p[2]], p, 0.07, 0.07, colors.steel);
  }
}
function star(out, detail) {
  const c = layout.centerFeature,
    y = layout.deck + 0.14,
    N = 10,
    points = Array.from({ length: N }, (_, i) => {
      const a = (i * Math.PI) / 5 - 0.27,
        r = i % 2 ? c.starRadius * 0.4 : c.starRadius;
      return [c.x + r * Math.cos(a), c.z + r * Math.sin(a)];
    });
  cap(out, 'metal', 'dark', points, y + 0.13);
  const peak = [c.x, y + c.starHeight, c.z];
  for (let i = 0; i < N; i++) {
    const a = points[i],
      b = points[(i + 1) % N];
    face(
      out,
      'metal',
      i % 2 ? 'dark' : 'gold',
      [[a[0], y + 0.13, a[1]], [b[0], y + 0.13, b[1]], peak],
      [a[0] - c.x, 0.3, a[1] - c.z],
    );
  }
  const count = detail === 0 ? 10 : detail === 1 ? 20 : detail === 2 ? 36 : 64;
  for (let i = 0; i < count; i++) {
    const a = -0.44 + (Math.PI * 1.63 * i) / count,
      b = -0.44 + (Math.PI * 1.63 * (i + 1)) / count;
    const point = (t, r, h) => [c.x + Math.cos(t) * r, y + h, c.z + Math.sin(t) * r];
    const r = c.crescentRadius;
    face(
      out,
      'granite',
      'dark',
      [point(a, r, 0.12), point(b, r, 0.12), point(b, r - 0.83, 0.12), point(a, r - 0.83, 0.12)],
      up,
    );
    if (detail > 0)
      face(
        out,
        'sandstone',
        'edge',
        [point(a, r, 0), point(b, r, 0), point(b, r, 0.12), point(a, r, 0.12)],
        [Math.cos(a), 0, Math.sin(a)],
      );
  }
  if (detail > 1)
    for (const side of [-1, 1])
      box(
        out,
        'sandstone',
        'sand',
        12.9,
        layout.deck,
        8.5 + side * 1.0,
        16.9,
        layout.deck + 0.7,
        9.18 + side * 1.0,
      );
}
function museum(out, detail) {
  const m = layout.museum,
    P = m.outline;
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      n = [dz, 0, -dx],
      floor = m.footing[i],
      bottom = m.footing[(i + 1) % P.length];
    face(
      out,
      'limestone',
      'white',
      [
        [a[0], floor, a[1]],
        [b[0], bottom, b[1]],
        [b[0], m.eaves, b[1]],
        [a[0], m.eaves, a[1]],
      ],
      n,
    );
    if (detail === 0 || L < 4) continue;
    const count = Math.max(1, Math.round(L / (detail === 1 ? 9 : 4.3)));
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) / count,
        w = Math.min(1.6, (L / count) * 0.53),
        e = [dx / L, dz / L],
        center = [mix(a[0], b[0], u) + (dz / L) * 0.025, mix(a[1], b[1], u) - (dx / L) * 0.025];
      const point = (s, y) => [center[0] + e[0] * s, y, center[1] + e[1] * s];
      face(
        out,
        'glass',
        'glass',
        [
          point(-w / 2, m.y + 1.25),
          point(w / 2, m.y + 1.25),
          point(w / 2, m.eaves - 1.2),
          point(-w / 2, m.eaves - 1.2),
        ],
        n,
      );
      if (detail > 1)
        face(
          out,
          'limestone',
          'pale',
          [
            point(-w * 0.62, m.y + 1.11),
            point(w * 0.62, m.y + 1.11),
            point(w * 0.62, m.y + 1.25),
            point(-w * 0.62, m.y + 1.25),
          ],
          up,
        );
    }
  }
  cap(out, 'roof', 'roof', P, m.eaves);
  if (detail === 0) return;
  for (const r of m.roof)
    for (const p of r.polys) {
      cap(out, 'roof', 'white', p, r.y);
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length];
        face(
          out,
          'limestone',
          'white',
          [
            [a[0], m.eaves, a[1]],
            [b[0], m.eaves, b[1]],
            [b[0], r.y, b[1]],
            [a[0], r.y, a[1]],
          ],
          [b[1] - a[1], 0, a[0] - b[0]],
        );
      }
    }
  const [a, b] = m.front,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    n = [dz / L, -dx / L];
  const point = (u, depth, y) => [
    m.entry[0] + (dx / L) * u + n[0] * depth,
    y,
    m.entry[1] + (dz / L) * u + n[1] * depth,
  ];
  const entryY = m.entryGround[1] + 0.65;
  for (const u of [-3.9, 3.9])
    beam(
      out,
      'limestone',
      point(u, 3.9, entryY - 0.12),
      point(u, 3.9, 5.8),
      0.5,
      0.54,
      colors.white,
    );
  beam(out, 'limestone', point(-4.4, 4.03, 5.96), point(4.4, 4.03, 5.96), 0.37, 0.56, colors.white);
  face(
    out,
    'limestone',
    'white',
    [
      point(-4.45, 4.23, 6.14),
      point(4.45, 4.23, 6.14),
      point(4.45, -0.2, 6.14),
      point(-4.45, -0.2, 6.14),
    ],
    up,
  );
  face(
    out,
    'glass',
    'glass',
    [
      point(-2.85, 0.46, entryY),
      point(2.85, 0.46, entryY),
      point(2.85, 0.46, 4.6),
      point(-2.85, 0.46, 4.6),
    ],
    [n[0], 0, n[1]],
  );
  for (let i = 0; i < 4; i++) {
    const a = i === 0 ? 0 : 4 + (i - 1) * 0.58,
      b = 4 + i * 0.58;
    const y = mix(entryY, m.entryGround[3] + 0.13, i / 3);
    face(
      out,
      'granite',
      'paving',
      [point(-4.25, a, y), point(4.25, a, y), point(4.25, b, y), point(-4.25, b, y)],
      up,
    );
    face(
      out,
      'limestone',
      'white',
      [point(-4.25, b, y - 0.2), point(4.25, b, y - 0.2), point(4.25, b, y), point(-4.25, b, y)],
      [n[0], 0, n[1]],
    );
  }
  // The museum has a raised barrel skylight running along the central roof strip.
  const roofPoint = (x, angle) => {
    const z = -1.45 + 1.78 * Math.cos(angle);
    return [
      m.center[0] + Math.cos(m.angle) * x - Math.sin(m.angle) * z,
      9.1 + 1.03 * Math.sin(angle),
      m.center[1] + Math.sin(m.angle) * x + Math.cos(m.angle) * z,
    ];
  };
  const sections = detail === 1 ? 4 : 17,
    bands = detail === 1 ? 4 : 8;
  for (let i = 0; i < sections; i++)
    for (let j = 0; j < bands; j++) {
      const a = mix(-19, 19, i / sections),
        b = mix(-19, 19, (i + 1) / sections);
      const r = (j * Math.PI) / bands,
        s = ((j + 1) * Math.PI) / bands;
      face(
        out,
        'roof',
        i % 3 === 0 ? 'steel' : 'white',
        [roofPoint(a, r), roofPoint(b, r), roofPoint(b, s), roofPoint(a, s)],
        up,
      );
    }
}
function surroundings(out, detail) {
  const N = tessellation[detail].n,
    L = layout.lookout,
    [cx, cz] = L.center;
  const outer = Array.from({ length: N }, (_, i) => [
    cx + Math.cos((i * Math.PI * 2) / N) * L.radius,
    cz + Math.sin((i * Math.PI * 2) / N) * L.radius,
  ]);
  cap(out, 'granite', 'paving', outer, L.y);
  for (let i = 0; i < N; i++) {
    const a = outer[i],
      b = outer[(i + 1) % N],
      ground0 = L.footing[Math.floor((i / N) * 32)],
      ground1 = L.footing[Math.floor((((i + 1) % N) / N) * 32)];
    face(
      out,
      'sandstone',
      'sand',
      [
        [a[0], ground0 - 0.3, a[1]],
        [b[0], ground1 - 0.3, b[1]],
        [b[0], L.y, b[1]],
        [a[0], L.y, a[1]],
      ],
      [a[0] - cx, 0, a[1] - cz],
    );
  }
  if (detail > 0)
    for (let i = 0; i < 22; i++) {
      const a = (i * Math.PI * 2) / 22;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < L.openingAngle) continue;
      const x = cx + Math.cos(a) * L.radius,
        z = cz + Math.sin(a) * L.radius;
      cylinder(out, 'sandstone', 'edge', [x, z, L.y], 0.2, 1.48, detail > 2 ? 8 : 5);
      const next = a + (Math.PI * 2) / 22,
        segments = detail > 2 ? 7 : detail === 1 ? 2 : 4;
      for (let j = 0; j < segments; j++) {
        const t0 = j / segments,
          t1 = (j + 1) / segments;
        const point = (t) => {
          const k = mix(a, next, t);
          return [
            cx + Math.cos(k) * L.radius,
            L.y + 0.88 + 0.54 * Math.sin(Math.PI * t),
            cz + Math.sin(k) * L.radius,
          ];
        };
        beam(out, 'sandstone', point(t0), point(t1), 0.15, 0.17, colors.edge);
      }
    }
  for (const p of layout.pillars) {
    cylinder(
      out,
      'granite',
      'dark',
      [...p.center, p.base - 0.35],
      p.radius * 1.16,
      0.35,
      detail === 0 ? 6 : 12,
    );
    cylinder(
      out,
      'sandstone',
      'sand',
      [...p.center, p.base],
      p.radius,
      p.height,
      detail === 0 ? 6 : detail < 3 ? 12 : 20,
    );
    cylinder(
      out,
      'sandstone',
      'edge',
      [...p.center, p.base + p.height],
      p.radius * 1.17,
      0.28,
      detail === 0 ? 6 : 12,
    );
  }
  if (detail === 0) return;
  for (const p of layout.paths)
    for (const patch of p.patches)
      cap(out, 'granite', 'paving', patch.outline, (p) => p[2], patch.holes);
  if (detail > 1)
    for (const patch of layout.gardens)
      cap(out, 'turf', 'grass', patch.outline, (p) => p[2], patch.holes);
}
export function buildMonument(out, level = 'master') {
  const detail = tier[level];
  if (detail === undefined) throw Error('Unknown Pakistan Monument level');
  podium(out, detail);
  for (const p of layout.petals) shell(out, p, detail);
  stairs(out, detail);
  star(out, detail);
  museum(out, detail);
  surroundings(out, detail);
}
export const buildMonumentSkyline = (out) => buildMonument(out, 'skyline');
export const buildMonumentDistrict = (out) => buildMonument(out, 'district');
export const buildMonumentStreet = (out) => buildMonument(out, 'street');
export const buildMonumentCloseup = (out) => buildMonument(out, 'closeup');
