import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const salamancaSurfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.83 },
  carved: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.77 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.69 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.82 },
  glass: { slot: 'trim', graph: 'metal_painted', roughness: 0.47 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.68 },
};
const palette = {
  buff: 'd1aa80',
  light: 'dfba91',
  ochre: 'c79c73',
  cream: 'e4c49e',
  shadow: '977457',
  dark: '493f38',
  gray: '52565c',
  ridge: '6c6e70',
  tile: '97614d',
  clay: 'a66c53',
  pane: '404b4c',
  paneBlue: '4d6263',
  amber: '806b54',
  wood: '765047',
  darkWood: '4b342b',
  metal: '494647',
  stoneShade: 'b29577',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([k, hex]) => [
    k,
    hex.match(/../g).map((v) => {
      const s = Number.parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  tau = Math.PI * 2;
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const raised = ([x, z], y) => [x, y, z];
function face(out, slot, tint, ps, normal) {
  let n = normalFor(...ps);
  if (dot(n, normal) < 0) {
    ps = ps.toReversed();
    n = normalFor(...ps);
  }
  if (ps.length === 3) out.addTriangle(slot, ref, ps, n, undefined, color[tint]);
  else if (ps.length === 4) out.addQuad(slot, ref, ps, n, undefined, color[tint]);
  else out.addConvexPolygon(slot, ref, ps, n, (p) => [p[0], p[1]], color[tint]);
}
function volume(out, slot, tint, x, z, rows, bevel = 0, cap = true) {
  const rect = (y, w, d) =>
    bevel
      ? chamferedRectangle(x, y, z, w, d, bevel)
      : [
          [x - w / 2, y, z - d / 2],
          [x - w / 2, y, z + d / 2],
          [x + w / 2, y, z + d / 2],
          [x + w / 2, y, z - d / 2],
        ];
  loft(
    out,
    slot,
    rows.map(([y, w, d]) => rect(y, w, d)),
    color[tint],
    { cap },
  );
}
function radial(out, slot, tint, x, z, profile, n, cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    color[tint],
    { cap },
  );
}
function shell(out, detail) {
  for (const [i, { regions, base, top, material }] of layout.forms.entries()) {
    for (const { rings, vertices, triangles, ground } of regions) {
      for (let ri = 0; ri < rings.length; ri++) {
        const ring = rings[ri];
        for (let j = 0; j < ring.length; j++) {
          const k = (j + 1) % ring.length,
            a = ring[j],
            b = ring[k];
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.025) continue;
          const n = [b[1] - a[1], 0, a[0] - b[0]];
          face(
            out,
            material,
            i === 0 ? 'buff' : i === 4 ? 'light' : 'ochre',
            [
              raised(a, base ?? ground[ri][j]),
              raised(b, base ?? ground[ri][k]),
              raised(b, top),
              raised(a, top),
            ],
            n,
          );
        }
      }
      if (i === 5) continue;
      for (const ids of triangles) {
        const ps = ids.map((j) => raised(vertices[j], top));
        if (Math.hypot(...normalFor(...ps)) > 0)
          face(
            out,
            i === 0 || i === 3 || i === 4 ? 'tile' : 'stone',
            i === 4 ? 'clay' : i === 0 || i === 3 ? 'tile' : 'ochre',
            ps,
            up,
          );
      }
    }
  }
  const edges = new Map();
  for (const [i, { vertices, triangles }] of layout.roofs.entries()) {
    for (const ids of triangles) {
      const [a, b, c] = ids.map((j) => vertices[j]);
      if (!Math.hypot(...normalFor(a, b, c))) continue;
      face(out, 'tile', i % 2 ? 'tile' : 'clay', [a, b, c], up);
      if (detail >= 1)
        for (const [p, q] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const key = [p.join(','), q.join(',')].sort().join(':');
          if (edges.has(key)) edges.delete(key);
          else edges.set(key, { p, q, base: i < 8 ? 40.6 : 20.62 });
        }
    }
  }
  for (const { p, q, base } of edges.values()) {
    if (Math.max(p[1], q[1]) < base + 0.03) continue;
    face(
      out,
      'tile',
      'tile',
      [[p[0], base - 0.015, p[2]], [q[0], base - 0.015, q[2]], q, p],
      [q[2] - p[2], 0, p[0] - q[0]],
    );
  }
}
function shape(w, bottom, top, rise, steps, pointed = true) {
  const radius = w * 0.5,
    spring = top - rise;
  return [
    [-radius, bottom],
    [radius, bottom],
    ...Array.from({ length: steps + 1 }, (_, i) => {
      const theta = (Math.PI * i) / steps,
        x = radius * Math.cos(theta);
      const height = pointed
        ? Math.pow(1 - Math.min(1, Math.abs(x) / radius), 0.73)
        : Math.sin(theta);
      return [x, spring + rise * height];
    }),
  ];
}
function plane(x, z, n) {
  const dir = [-n[2], 0, n[0]];
  return (u, y, o = 0) => [x + dir[0] * u + n[0] * o, y, z + dir[2] * u + n[2] * o];
}
function rectangular(out, p, n, slot, tint, left, right, y0, y1, d) {
  face(out, slot, tint, [p(left, y0, d), p(right, y0, d), p(right, y1, d), p(left, y1, d)], n);
}
function outline(out, p, ps, slot, tint, width, depth, o) {
  beamPath(
    out,
    slot,
    ps.map(([x, y]) => p(x, y, o)),
    width,
    depth,
    color[tint],
  );
}
function window(out, p, n, w, y, top, detail, kind = 'glass', pointed = true) {
  const steps = detail >= 3 ? 10 : detail >= 2 ? 8 : 4;
  if (!detail) {
    rectangular(
      out,
      p,
      n,
      kind,
      kind === 'wood' ? 'darkWood' : 'pane',
      -w / 2,
      w / 2,
      y,
      top,
      0.036,
    );
    return;
  }
  const rise = Math.min((top - y) * 0.38, w * (pointed ? 0.68 : 0.45)),
    ps = shape(w, y, top, rise, steps, pointed);
  face(
    out,
    detail === 1 ? kind : 'glass',
    detail === 1 && kind === 'wood' ? 'wood' : 'dark',
    ps.map(([u, t]) => p(u, t, 0.038)),
    n,
  );
  if (detail < 2) return;
  const inside = ps.map(([u, t]) => [u * 0.91, y + 0.06 + (t - y) * 0.963]);
  face(
    out,
    kind,
    kind === 'wood' ? 'wood' : 'paneBlue',
    inside.map(([u, t]) => p(u, t, 0.073)),
    n,
  );
  if (detail >= 3)
    outline(out, p, ps.slice(1).concat([ps[0]]), 'carved', 'light', 0.133, 0.09, 0.098);
  else {
    const edge = ps.slice(1).concat([ps[0]]);
    const outer = edge.map(([u, h]) => [u * 1.092, h + 0.105]);
    for (let i = 0; i < edge.length - 1; i++)
      face(
        out,
        'carved',
        'light',
        [edge[i], edge[i + 1], outer[i + 1], outer[i]].map(([u, h]) => p(u, h, 0.1)),
        n,
      );
  }
  rectangular(out, p, n, 'carved', 'cream', -w * 0.54, w * 0.54, y - 0.13, y, 0.11);
  if (kind === 'wood') {
    rectangular(out, p, n, 'wood', 'darkWood', -0.041, 0.041, y + 0.05, top - 0.075, 0.087);
    if (detail >= 3)
      for (const u of [-0.28, -0.16, 0.16, 0.28])
        rectangular(
          out,
          p,
          n,
          'wood',
          'darkWood',
          u * w,
          u * w + 0.018,
          y + 0.09,
          top - rise + 0.06,
          0.091,
        );
    return;
  }
  const topBar = top - rise * 0.55,
    div = detail >= 3 ? 2 : 1;
  for (let j = 0; j < div; j++) {
    const u = div === 1 ? 0 : (j - 0.5) * w * 0.28;
    rectangular(out, p, n, 'carved', 'cream', u - 0.04, u + 0.04, y + 0.05, topBar, 0.097);
  }
  if (detail >= 3) {
    const cy = top - rise * 0.79,
      r = Math.min(w * 0.154, rise * 0.44);
    outline(
      out,
      p,
      Array.from({ length: 9 }, (_, i) => [
        r * Math.cos((tau * i) / 8),
        cy + r * Math.sin((tau * i) / 8),
      ]),
      'carved',
      'light',
      0.075,
      0.053,
      0.104,
    );
  }
}
function band(out, p, n, w, y, h, s = 0.14, tint = 'light') {
  rectangular(out, p, n, 'carved', tint, -w / 2, w / 2, y, y + h, s);
  face(
    out,
    'carved',
    tint,
    [p(-w / 2, y + h, 0), p(w / 2, y + h, 0), p(w / 2, y + h, s), p(-w / 2, y + h, s)],
    up,
  );
}
function walls(out, detail) {
  for (const wall of layout.walls) {
    const {
        a,
        b,
        p: [x, z],
        n,
        length,
        count,
        top,
      } = wall,
      P = plane(x, z, n);
    if (!detail && top !== 40.6) continue;
    if (detail >= 1) band(out, P, n, length, top - 0.62, 0.33, detail >= 2 ? 0.22 : 0.12, 'light');
    if (detail >= 2 && top >= 26) band(out, P, n, length, top - 1.08, 0.12, 0.12, 'ochre');
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        c = a.map((v, j) => v + (b[j] - v) * t);
      if (top === 26.2 && c[0] > -3.5 && c[0] < 13.5 && c[1] < -35.65) continue;
      if (top === 26.2 && c[0] < -49 && c[1] > -34.5 && c[1] < 7.9 && n[0] < -0.38) continue;
      const p = plane(...c, n),
        width = Math.min((length / count) * 0.41, top === 40.6 ? 2.6 : 2.95);
      const y =
        top === 40.6
          ? 34.1
          : top === 33.45
            ? 28.1
            : top === 10.42
              ? 3.95
              : top === 20.62
                ? 8.1
                : 10.4;
      const h =
        top === 40.6
          ? 5.31
          : top === 33.45
            ? 3.8
            : top === 10.42
              ? 3.45
              : top === 20.62
                ? 6.2
                : 8.9;
      window(out, p, n, width, y, y + h, detail);
    }
  }
}
function pin(out, x, z, base, w, h, detail) {
  const rows =
    detail === 0
      ? [
          [base, w, w],
          [base + h, w * 0.072, w * 0.072],
        ]
      : detail === 1
        ? [
            [base, w, w],
            [base + h * 0.56, w * 0.59, w * 0.59],
            [base + h, w * 0.072, w * 0.072],
          ]
        : [
            [base, w, w],
            [base + h * 0.2, w * 0.92, w * 0.92],
            [base + h * 0.31, w * 0.78, w * 0.78],
            [base + h * 0.35, w * 0.85, w * 0.85],
            [base + h * 0.51, w * 0.62, w * 0.62],
            [base + h * 0.67, w * 0.48, w * 0.48],
            [base + h * 0.92, w * 0.17, w * 0.17],
            [base + h, w * 0.068, w * 0.068],
          ];
  volume(out, 'carved', 'light', x, z, rows, 0, false);
  if (detail >= 3) {
    for (const [u, v] of [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ]) {
      const px = x + u * w * 0.31,
        pz = z + v * w * 0.31;
      volume(
        out,
        'carved',
        'cream',
        px,
        pz,
        [
          [base + h * 0.17, w * 0.25, w * 0.25],
          [base + h * 0.49, w * 0.16, w * 0.16],
          [base + h * 0.58, w * 0.025, w * 0.025],
        ],
        0,
        false,
      );
    }
  }
}
function buttresses(out, detail) {
  for (const [i, b] of layout.buttresses.entries()) {
    if (!detail && (b.upper || i % 2 !== 0 || b.chevet)) continue;
    const { x, z, normal: n, height: y, base } = b,
      q = z + n[2] * 0.3,
      px = x + n[0] * 0.3;
    const w = b.upper ? 1.54 : 2.17,
      d = b.upper ? 1.9 : 2.66;
    const levels =
      detail < 2
        ? [
            [base, w, d],
            [y - 4.25, w * 0.76, d * 0.77],
          ]
        : [
            [base, w * 1.28, d * 1.17],
            [base + 0.78, w * 1.28, d * 1.17],
            [base + 1.23, w, d],
            [y - 10.1, w, d],
            [y - 9.5, w * 0.8, d * 0.83],
            [y - 5.3, w * 0.8, d * 0.83],
            [y - 4.25, w * 0.76, d * 0.77],
          ];
    volume(out, 'carved', 'buff', px, q, levels, detail >= 3 ? 0.125 : 0, false);
    pin(out, px, q, y - 4.27, w * 0.86, 4.27, detail);
    if (detail >= 2 && !b.upper && z < -29 && x > -54 && x < 51) {
      const p = [
        [x, y - 6.2, z + 0.78],
        [x, y - 5.54, z + 3.18],
        [x, y - 2.55, z + 6.78],
        [x, y + 3.28, z + 10.6],
      ];
      beamPath(out, 'carved', p, 0.85, 0.67, color.ochre);
      if (detail >= 3)
        beamPath(
          out,
          'carved',
          p.map((v) => [v[0], v[1] + 0.4, v[2]]),
          0.96,
          0.22,
          color.light,
        );
    }
  }
}
function crownCross(out, x, z, y, h, detail) {
  const r = detail === 0 ? 0.116 : 0.082;
  beam(out, 'glass', [x, y - h, z], [x, y, z], r, r, color.metal);
  beam(
    out,
    'glass',
    [x - h * 0.31, y - h * 0.36, z],
    [x + h * 0.31, y - h * 0.36, z],
    r,
    r,
    color.metal,
  );
}
function dome(out, detail) {
  const { x, z, base, drumTop, cupolaTop, top } = layout.dome,
    n = [8, 12, 20, 32, 40][detail];
  const shaft =
    detail === 0
      ? [
          [base, 7.97],
          [drumTop, 7.55],
        ]
      : [
          [base, 7.97],
          [base + 0.71, 8.18],
          [base + 1.1, 7.78],
          [drumTop - 0.69, 7.54],
          [drumTop - 0.33, 7.91],
          [drumTop, 7.91],
        ];
  radial(out, 'carved', 'light', x, z, shaft, n, false);
  const samples =
    detail === 0
      ? [
          [0, 7.54],
          [0.34, 7.15],
          [0.72, 5.3],
          [1, 1.45],
        ]
      : [
          [0, 7.78],
          [0.12, 7.72],
          [0.3, 7.43],
          [0.47, 6.91],
          [0.64, 6.1],
          [0.8, 4.9],
          [0.91, 3.53],
          [0.97, 2.38],
          [1, 1.44],
        ];
  const profiles = samples.map(([t, r]) => [drumTop + (cupolaTop - drumTop) * t, r]);
  radial(out, 'slate', 'gray', x, z, profiles, n, false);
  radial(
    out,
    'carved',
    'cream',
    x,
    z,
    [
      [cupolaTop - 0.06, 1.5],
      [cupolaTop + 2.55, 1.25],
      [top - 1.18, 0.62],
    ],
    detail === 0 ? 6 : 12,
    true,
  );
  crownCross(out, x, z, top, 1.39, detail);
  if (!detail) return;
  for (let i = 0; i < 8; i++) {
    const a = (tau * (i + 0.5)) / 8,
      ca = Math.cos(a),
      sa = Math.sin(a),
      P = plane(x + 7.66 * ca, z + 7.66 * sa, [ca, 0, sa]);
    window(out, P, [ca, 0, sa], 2.13, base + 3.05, drumTop - 1.55, detail);
    const col = radialRing(0, 7.93, 7.93, 8, [x, z])[i];
    pin(out, col[0], col[2], drumTop - 0.72, 0.84, 3.04, detail);
  }
  if (detail >= 2)
    for (let i = 0; i < (detail === 2 ? 8 : 16); i++) {
      const a = (tau * i) / (detail === 2 ? 8 : 16),
        ca = Math.cos(a),
        sa = Math.sin(a);
      beamPath(
        out,
        'slate',
        profiles.map(([y, r]) => [x + (r + 0.035) * ca, y, z + (r + 0.035) * sa]),
        0.14,
        0.1,
        color.ridge,
      );
    }
}
function belfryArch(out, p, n, base, top, half, span, depth, detail) {
  const w = span * 0.5,
    spring = base + 5.7,
    rise = 3.36,
    steps = detail >= 2 ? 10 : detail === 1 ? 6 : 4;
  const ps = shape(span, base, spring + rise, rise, steps, false).slice(2);
  for (const d of [0, -depth]) {
    const sign = d === 0 ? n : n.map((v) => -v);
    face(
      out,
      'stone',
      'light',
      [p(-half, base, d), p(-w, base, d), p(-w, top, d), p(-half, top, d)],
      sign,
    );
    face(
      out,
      'stone',
      'light',
      [p(w, base, d), p(half, base, d), p(half, top, d), p(w, top, d)],
      sign,
    );
    for (let i = 0; i < steps; i++) {
      const [a, y] = ps[i],
        [b, z] = ps[i + 1];
      face(out, 'stone', 'light', [p(a, y, d), p(b, z, d), p(b, top, d), p(a, top, d)], sign);
    }
  }
  for (const side of [-1, 1]) {
    const u = side * w;
    const nn = [-n[2] * -side, 0, n[0] * -side];
    face(
      out,
      'carved',
      'shadow',
      [p(u, base, 0), p(u, base, -depth), p(u, spring, -depth), p(u, spring, 0)],
      nn,
    );
  }
  for (let i = 0; i < steps; i++) {
    const [a, y] = ps[i],
      [b, z] = ps[i + 1];
    face(
      out,
      'carved',
      'shadow',
      [p(a, y, 0), p(b, z, 0), p(b, z, -depth), p(a, y, -depth)],
      [0, -1, 0],
    );
  }
  if (detail >= 2) outline(out, p, ps, 'carved', 'cream', 0.32, 0.23, 0.09);
}
function tower(out, detail) {
  const { x, z, w, d, ground: g, summit } = layout.tower,
    half = 6.43;
  const y = (h) => g + h,
    span = 5.72;
  const plinth =
    detail === 0
      ? [
          [g - 2.2, w + 0.44, d + 0.52],
          [y(9.82), w + 0.44, d + 0.52],
        ]
      : [
          [g - 2.2, w + 0.47, d + 0.56],
          [y(9.56), w + 0.47, d + 0.56],
          [y(9.87), w + 0.27, d + 0.36],
          [y(10.05), w - 0.01, d - 0.01],
        ];
  volume(out, 'carved', 'buff', x, z, plinth, 0, false);
  volume(
    out,
    'carved',
    'light',
    x,
    z,
    detail === 0
      ? [
          [45.42, 16.5, 16.5],
          [y(57), 13.05, 13.05],
        ]
      : [
          [45.43, 17.61, 17.61],
          [y(46), 17.55, 17.55],
          [y(47.1), 15.66, 15.66],
          [y(55.7), 15.35, 15.35],
          [y(56.38), 16.25, 16.25],
          [y(57), 13.05, 13.05],
        ],
    detail >= 2 ? 0.2 : 0,
    false,
  );
  for (const n of [
    [-1, 0, 0],
    [1, 0, 0],
    [0, 0, -1],
    [0, 0, 1],
  ]) {
    const p = plane(x + n[0] * half, z + n[2] * half, n);
    belfryArch(out, p, n, y(57), y(70.18), half, span, 1.05, detail);
    if (detail >= 1) {
      const lower = plane(x + n[0] * 8.91, z + n[2] * 8.76, n);
      for (const height of [y(11.3), y(28.72), y(42.94)])
        band(out, lower, n, 16.9, height, 0.32, 0.17, 'light');
      if (detail >= 2) {
        window(out, lower, n, 1.48, y(31), y(38.2), detail, 'glass', false);
        window(out, lower, n, 0.82, y(15.9), y(20.7), detail, 'glass', false);
        for (const side of [-1, 1]) {
          const u = side * 7.57;
          rectangular(out, lower, n, 'carved', 'light', u - 0.36, u + 0.36, y(4), y(42.77), 0.07);
        }
      }
      const e = plane(x + n[0] * 7.79, z + n[2] * 7.79, n);
      window(out, e, n, 2.1, y(48.6), y(54.3), detail, 'glass', false);
      if (detail >= 2) band(out, e, n, 14.6, y(47.6), 0.31, 0.21);
    }
  }
  volume(
    out,
    'carved',
    'cream',
    x,
    z,
    [
      [y(69.78), 13.16, 13.16],
      [y(70.24), 14.0, 14.0],
      [y(70.81), 13.46, 13.46],
    ],
    0,
    true,
  );
  const profiles =
    detail === 0
      ? [
          [y(70.8), 6.53],
          [y(75.4), 5.66],
          [y(79.4), 3.78],
          [y(81.65), 1.63],
        ]
      : [
          [y(70.8), 6.54],
          [y(72.28), 6.42],
          [y(74.47), 6.11],
          [y(76.54), 5.31],
          [y(78.63), 4.25],
          [y(80.56), 2.86],
          [y(81.66), 1.58],
        ];
  radial(out, 'carved', 'buff', x, z, profiles, detail === 0 ? 8 : detail === 1 ? 12 : 24, false);
  if (detail >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (tau * i) / 12;
      beamPath(
        out,
        'carved',
        profiles.map(([h, r]) => [x + (r + 0.043) * Math.cos(a), h, z + (r + 0.043) * Math.sin(a)]),
        0.18,
        0.14,
        color.light,
      );
    }
  radial(
    out,
    'carved',
    'light',
    x,
    z,
    [
      [y(81.6), 1.69],
      [y(84.45), 1.45],
      [y(86.2), 1.1],
      [y(89.05), 0.34],
    ],
    detail === 0 ? 6 : 10,
    true,
  );
  crownCross(out, x, z, y(summit), 2.18, detail);
  if (detail >= 1)
    for (const i of [-1, 1])
      for (const j of [-1, 1]) {
        const tx = x + i * 5.7,
          tz = z + j * 5.7;
        pin(out, tx, tz, y(70.15), 1.2, 4.61, detail);
      }
  if (detail >= 2) {
    beam(out, 'wood', [x - 4.5, y(64.91), z], [x + 4.5, y(64.91), z], 0.45, 0.45, color.darkWood);
    radial(
      out,
      'glass',
      'metal',
      x,
      z,
      [
        [y(61.6), 1.15],
        [y(61.92), 1.1],
        [y(62.7), 0.74],
        [y(64.7), 0.44],
      ],
      detail >= 3 ? 18 : 12,
      false,
    );
  }
}
function relief(out, p, u, y, h, detail) {
  const c = p(u, y + h * 0.74, 0.25);
  sphere(
    out,
    'carved',
    c,
    [h * 0.13, h * 0.14, h * 0.13],
    color.cream,
    detail >= 4 ? 9 : 7,
    detail >= 4 ? 5 : 4,
  );
  const a = p(u, y, 0.24),
    b = p(u, y + h * 0.68, 0.26);
  beam(out, 'carved', a, b, h * 0.33, h * 0.21, color.light);
  if (detail >= 4) {
    for (const s of [-1, 1])
      beam(
        out,
        'carved',
        p(u + s * h * 0.13, y + h * 0.62, 0.29),
        p(u + s * h * 0.18, y + h * 0.31, 0.31),
        h * 0.11,
        h * 0.1,
        color.cream,
      );
  }
}
function portal(out, p, n, width, y, high, detail, isCentral = false) {
  const doorTop = y + high * 0.5,
    steps = detail >= 3 ? 14 : detail >= 2 ? 10 : 4;
  const top = y + high;
  const arch = shape(width, y, top, high * 0.42, steps);
  face(
    out,
    'carved',
    'ochre',
    arch.map(([u, h]) => p(u, h, 0.058)),
    n,
  );
  if (!detail) {
    window(out, p, n, width * 0.6, y, doorTop, 0, 'wood');
    return;
  }
  if (isCentral && detail >= 2) {
    for (const side of [-1, 1]) {
      const q = (u, h, o) => p(u + side * width * 0.171, h, o);
      window(out, q, n, width * 0.292, y, doorTop, detail, 'wood', false);
    }
    rectangular(out, p, n, 'carved', 'light', -0.13, 0.13, y, doorTop, 0.29);
  } else window(out, p, n, width * 0.59, y, doorTop, detail, 'wood', false);
  const rings = detail >= 3 ? 4 : detail >= 2 ? 3 : 1;
  for (let i = 0; i < rings; i++) {
    const u = width * (1.016 + i * 0.045),
      highP = high * (1.005 + i * 0.032),
      ps = shape(u, y, y + highP, highP * 0.435, steps);
    const path = ps.slice(1).concat([ps[0]]);
    outline(
      out,
      p,
      path,
      'carved',
      i % 2 ? 'cream' : 'light',
      detail >= 3 ? 0.24 : 0.28,
      0.16 + i * 0.033,
      0.21 + i * 0.065,
    );
  }
  if (detail >= 2) {
    band(out, p, n, width * 0.73, doorTop + 0.28, 0.27, 0.29, 'cream');
    const r = width * 0.125,
      cy = top - high * 0.229;
    outline(
      out,
      p,
      Array.from({ length: 13 }, (_, i) => [
        r * Math.cos((tau * i) / 12),
        cy + r * Math.sin((tau * i) / 12),
      ]),
      'carved',
      'cream',
      0.16,
      0.13,
      0.16,
    );
    for (let i = 0; i < 6; i++) {
      const a = (tau * i) / 6;
      beam(
        out,
        'carved',
        p(0, cy, 0.19),
        p(r * 0.87 * Math.cos(a), cy + r * 0.87 * Math.sin(a), 0.19),
        0.084,
        0.08,
        color.light,
      );
    }
  }
  if (detail >= 3) {
    const tiers = isCentral ? 3 : 2;
    for (let row = 0; row < tiers; row++)
      for (let i = -1; i <= 1; i++) {
        const u = i * width * 0.175,
          h = high * 0.56 + row * 1.42 - (i === 0 ? 0 : 0.38);
        if (h > high * 0.82) continue;
        relief(out, p, u, y + h, Math.min(1.17, width * 0.145), detail);
      }
    const count = isCentral ? 6 : 4;
    for (const side of [-1, 1])
      for (let i = 0; i < count; i++) {
        const u = side * width * 0.55,
          Y = y + 1.2 + i * 1.48;
        relief(out, p, u, Y, 0.86, detail);
        band(out, (u2, v, o) => p(u + u2, v, o), n, 0.55, Y - 0.1, 0.13, 0.26, 'cream');
      }
  }
}
function facades(out, detail) {
  const { west: w, north: n } = layout;
  volume(
    out,
    'stone',
    'buff',
    -59.06,
    w.z,
    [
      [-1.37, 0.59, w.w + 0.66],
      [26.4, 0.59, w.w + 0.66],
    ],
    0,
    false,
  );
  const pw = plane(w.x, w.z, [-1, 0, 0]),
    nw = [-1, 0, 0];
  for (const [i, z] of w.portalCenters.entries()) {
    const q = plane(w.x, z, nw);
    portal(
      out,
      q,
      nw,
      i === 1 ? 10.42 : 7.55,
      w.base + 0.58,
      i === 1 ? 19.65 : 15.98,
      detail,
      i === 1,
    );
  }
  if (detail >= 1) {
    band(out, pw, nw, w.w, 26.1, 0.32, 0.31);
    band(out, pw, nw, w.w, 23.65, 0.24, 0.22, 'ochre');
  }
  const g = plane(-56.22, -8.45, nw);
  const profile = [
    [-8.8, 25.91],
    [8.8, 25.91],
    [8.8, 37.75],
    [0, w.crest],
    [-8.8, 37.75],
  ];
  const front = profile.map(([u, y]) => g(u, y, 0)),
    rear = profile.map(([u, y]) => g(u, y, -2.5));
  face(out, 'stone', 'light', front, nw);
  for (let i = 1; i < 5; i++) {
    const j = (i + 1) % 5;
    const outward = i === 1 ? [0, 0, -1] : i === 4 ? [0, 0, 1] : up;
    face(out, 'carved', 'cream', [front[i], front[j], rear[j], rear[i]], outward);
  }
  const z = -8.45;
  if (detail >= 1) {
    window(out, plane(-56.27, z, nw), nw, 6.26, 28.45, 39.48, detail);
    outline(out, g, profile.slice(2), 'carved', 'light', 0.29, 0.22, 0.16);
  }
  const pinXs = [-59.28, -59.29, -59.27, -59.24];
  for (const [i, pz] of [-33.2, -20.45, -5.75, 7.3].entries()) {
    if (!detail && i % 2 !== 0) continue;
    volume(
      out,
      'carved',
      'light',
      pinXs[i],
      pz,
      [
        [w.base, 1.5, 2.04],
        [26.14, 1.16, 1.45],
        [30.0, 1.04, 1.31],
      ],
      0,
      false,
    );
    pin(out, pinXs[i], pz, 29.93, 1.49, i === 1 || i === 2 ? 7.95 : 5.1, detail);
  }
  const nn = [0, 0, -1],
    pn = plane(n.x, n.z, nn);
  portal(out, pn, nn, n.w * 0.79, n.base + 0.76, 18.3, detail, true);
  if (detail >= 1) {
    band(out, pn, nn, n.w, 23.99, 0.33, 0.25);
    window(out, pn, nn, 5.9, 26.1, 37.26, detail);
  }
  for (const s of [-1, 1]) {
    volume(
      out,
      'carved',
      'light',
      n.x + s * 7.37,
      n.z,
      [
        [n.base, 1.79, 1.92],
        [29.85, 1.49, 1.58],
        [36.41, 1.18, 1.26],
      ],
      0,
      false,
    );
    pin(out, n.x + s * 7.37, n.z, 36.38, 1.62, 7.43, detail);
  }
}
function stairs(out, detail) {
  for (const { axis, a, b, center, w, y, bottom } of layout.steps) {
    const mid = (a + b) / 2,
      d = b - a;
    const [x, z, ww, dd] = axis === 'x' ? [mid, center, d, w] : [center, mid, w, d];
    if (detail === 0) {
      const point = (u, v, h) => (axis === 'x' ? [u, h, v] : [v, h, u]);
      const left = center - w / 2,
        right = center + w / 2;
      face(
        out,
        'carved',
        'stoneShade',
        [point(a, left, y), point(b, left, y), point(b, right, y), point(a, right, y)],
        up,
      );
      face(
        out,
        'carved',
        'stoneShade',
        [point(a, left, bottom), point(a, right, bottom), point(a, right, y), point(a, left, y)],
        axis === 'x' ? [-1, 0, 0] : [0, 0, -1],
      );
      continue;
    }
    volume(out, 'carved', 'stoneShade', x, z, [
      [bottom, ww, dd],
      [y, ww, dd],
    ]);
  }
}
export function buildSalamancaLevel(out, level) {
  const detail = levels[level];
  shell(out, detail);
  walls(out, detail);
  buttresses(out, detail);
  tower(out, detail);
  dome(out, detail);
  facades(out, detail);
  stairs(out, detail);
}
export const buildSalamancaSkyline = (out) => buildSalamancaLevel(out, 'skyline');
export const buildSalamancaDistrict = (out) => buildSalamancaLevel(out, 'district');
export const buildSalamancaStreet = (out) => buildSalamancaLevel(out, 'street');
export const buildSalamancaCloseup = (out) => buildSalamancaLevel(out, 'closeup');
