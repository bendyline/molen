/** Columbus Circle, built from the mapped monument and three fountain arcs. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const circleSurfaces = {
  stone: { slot: 'wall', graph: 'stone_granite' },
  marble: { slot: 'trim', graph: 'stone_marble' },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', metallic: 0.68, roughness: 0.52 },
  water: {
    slot: 'trim',
    localRef: 'palette:#4b6d69',
    name: 'Fountain water',
    roughness: 0.22,
    metallic: 0.21,
  },
  jet: {
    slot: 'trim',
    localRef: 'palette:#e6f1e9',
    name: 'Fountain jet',
    roughness: 0.29,
    metallic: 0.05,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.53],
    doubleSided: true,
  },
};
const colors = {
  paved: 'b7b6ae',
  inset: 'c7c0af',
  mold: 'cfbda3',
  granite: 'bcaa91',
  shadow: 'a99780',
  ledge: 'd5c8b6',
  marble: 'e9e2d5',
  feather: 'e2dbca',
  chalk: 'f2eadf',
  face: 'ded4c5',
  bronze: '565b4d',
  green: '697469',
  dark: '404940',
  high: '818672',
  water: '557a74',
  jet: 'd9efec',
  seam: 'a9a59a',
};
const color = Object.fromEntries(
  Object.entries(colors).map(([k, hex]) => [
    k,
    hex.match(/../g).map((h) => {
      const s = parseInt(h, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const [cx, cz] = layout.shaftCenter,
  ref = 'palette:#ffffff',
  up = [0, 1, 0],
  tau = Math.PI * 2;
const point = ([x, z], y) => [x, y, z],
  v = (x, y, z) => [cx + x, y, cz + z];
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function face(out, slot, tint, points, wanted) {
  if (points.length === 4) {
    face(out, slot, tint, points.slice(0, 3), wanted);
    face(out, slot, tint, [points[0], points[2], points[3]], wanted);
    return;
  }
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.9) return;
  if (n.reduce((sum, x, i) => sum + x * wanted[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, color[tint]);
  else out.addConvexPolygon(slot, ref, points, n, (p) => [p[0], p[2]], color[tint]);
}
function profile(out, slot, tint, rings, cap = false) {
  loft(out, slot, rings, color[tint], { cap });
}
function disk(out, slot, tint, center, rows, sides, cap = false) {
  profile(
    out,
    slot,
    tint,
    rows.map(([y, r]) => radialRing(y, r, r, sides, center)),
    cap,
  );
}
function edge([x, , z], [a, , b]) {
  return normalize([b - z, 0, x - a]);
}
function horizontal(out, slot, tint, triangles) {
  for (const t of triangles) face(out, slot, tint, t, up);
}
function pool(out, p, tier) {
  for (let i = 0; i < p.rim.length; i++) {
    const a = p.rim[i],
      b = p.rim[(i + 1) % p.rim.length],
      normal = edge(a.outer, b.outer);
    const rim = [a.outer, b.outer, b.inner, a.inner];
    if (tier > 0) face(out, 'stone', 'ledge', rim, up);
    const below = (p, y) => [p[0], y, p[2]];
    face(
      out,
      'stone',
      'shadow',
      [
        a.inner,
        b.inner,
        below(b.inner, layout.waterY - 0.045),
        below(a.inner, layout.waterY - 0.045),
      ],
      normal.map((v) => -v),
    );
    face(
      out,
      'stone',
      'paved',
      [
        tier === 0 ? a.inner : a.outer,
        tier === 0 ? b.inner : b.outer,
        below(b.outer, b.bottom),
        below(a.outer, a.bottom),
      ],
      normal,
    );
    if (tier >= 2) {
      const trim = (p, y) => [p[0] * 1.001, y, p[2] * 1.001];
      face(
        out,
        'stone',
        'mold',
        [
          trim(a.outer, a.outer[1] - 0.082),
          trim(b.outer, b.outer[1] - 0.082),
          trim(b.outer, b.outer[1] - 0.027),
          trim(a.outer, a.outer[1] - 0.027),
        ],
        normal,
      );
    }
  }
  horizontal(out, 'water', 'water', p.liquid);
  if (tier === 0) return;
  const bench =
    tier === 1 ? p.bench.filter((_, i) => i % 2 === 0 || i === p.bench.length - 1) : p.bench;
  const station = ([x, y, z], delta, lift) => {
    const r = Math.hypot(x, z);
    return [(x * (r + delta)) / r, y + lift, (z * (r + delta)) / r];
  };
  for (let i = 1; i < bench.length; i++) {
    const a = bench[i - 1],
      b = bench[i],
      at = station(a, -0.43, 0.48),
      bt = station(b, -0.43, 0.48),
      ao = station(a, 0.43, 0.48),
      bo = station(b, 0.43, 0.48);
    face(out, 'stone', 'ledge', [at, bt, bo, ao], up);
    for (const offset of [-0.43, 0.43]) {
      const p = station(a, offset, 0.48),
        q = station(b, offset, 0.48);
      face(
        out,
        'stone',
        'mold',
        [p, q, station(b, offset, 0.026), station(a, offset, 0.026)],
        normalize([p[0] * offset, 0, p[2] * offset]),
      );
    }
    if (tier >= 3 && i % 3 === 1) {
      for (const t of [0, 0.92]) {
        const a0 = mix(at, bt, t),
          b0 = mix(ao, bo, t),
          u = mix(at, bt, t + 0.06),
          v = mix(ao, bo, t + 0.06);
        face(
          out,
          'stone',
          'inset',
          [a0, b0, v, u].map((p) => [p[0], p[1] + 0.002, p[2]]),
          up,
        );
      }
    }
  }
  for (const [i, datum] of p.arc.entries()) {
    if (tier === 1 || (tier === 2 && i % 2 !== 0)) continue;
    const { from, to } = datum,
      steps = tier === 2 ? 7 : 12,
      height = 1.1 + 0.1 * Math.cos(i * 0.47);
    const path = Array.from({ length: steps + 1 }, (_, j) => {
      const t = j / steps,
        [x, z] = mix(from, to, t);
      return [x, layout.waterY + 0.032 + 4 * t * (1 - t) * height, z];
    });
    for (let j = 1; j < path.length; j++) {
      const a = path[j - 1],
        b = path[j],
        w = 0.023 - (j / steps) * 0.01;
      const n = normalize([a[2], 0, -a[0]]),
        m = [0, 1, 0];
      for (const offset of [n, m]) {
        const side = (p, s) => p.map((x, k) => x + offset[k] * w * s);
        face(out, 'jet', 'jet', [side(a, -1), side(a, 1), side(b, 1), side(b, -1)], n);
      }
    }
    if (tier >= 3) {
      const [x, z] = to;
      disk(
        out,
        'jet',
        'jet',
        [x, z],
        [
          [layout.waterY + 0.012, 0.1],
          [layout.waterY + 0.013, 0.162],
        ],
        10,
      );
    }
  }
}
function terrace(out, route, tier) {
  const count = route.length;
  for (let i = 1; i < count; i++) {
    const a = route[i - 1],
      b = route[i],
      normal = normalize([-a[0] - b[0], 0, -a[2] - b[2]]);
    const lift = ([x, y, z], offset, raise) => {
      const r = Math.hypot(x, z);
      return [(x * (r + offset)) / r, y + raise, (z * (r + offset)) / r];
    };
    const low = [lift(a, 0, -0.38), lift(b, 0, -0.38)],
      top = [lift(a, 0, 0.16), lift(b, 0, 0.16)];
    const back = [lift(a, 0.22, 0.16), lift(b, 0.22, 0.16)];
    face(out, 'stone', 'shadow', [...low, top[1], top[0]], normal);
    face(out, 'stone', 'ledge', [...top, back[1], back[0]], up);
    if (tier >= 3)
      face(
        out,
        'stone',
        'mold',
        [...back, lift(b, 0.22, -0.26), lift(a, 0.22, -0.26)],
        normal.map((v) => -v),
      );
  }
}
function plaza(out, tier) {
  horizontal(out, 'stone', 'paved', tier === 0 ? layout.broad : layout.paving);
  for (const p of layout.pools) {
    pool(out, p, tier);
    if (tier >= 2) for (const route of p.terraces) terrace(out, route, tier);
  }
}
function stoneSteps(out, tier) {
  for (const [i, s] of layout.baseSteps.entries()) {
    horizontal(out, 'stone', i === 0 ? 'inset' : 'ledge', s.surface);
    for (let j = 0; j < s.ring.length; j++) {
      const a = s.ring[j],
        b = s.ring[(j + 1) % s.ring.length],
        y0 = i === 0 ? s.foot : layout.baseSteps[i - 1].top - 0.018;
      const top = point(a, s.top),
        next = point(b, s.top);
      face(
        out,
        'stone',
        i === 0 ? 'mold' : 'granite',
        [point(a, y0), point(b, y0), next, top],
        edge(top, next),
      );
      if (tier >= 3) {
        const t = ([x, z]) => [cx + (x - cx) * 1.002, cz + (z - cz) * 1.002];
        face(
          out,
          'stone',
          'ledge',
          [
            point(t(a), s.top - 0.059),
            point(t(b), s.top - 0.059),
            point(t(b), s.top - 0.015),
            point(t(a), s.top - 0.015),
          ],
          edge(top, next),
        );
      }
    }
  }
}
function molding(out, tier, rows) {
  const section = (y, w, d) =>
    tier === 0
      ? [v(-w / 2, y, -d / 2), v(-w / 2, y, d / 2), v(w / 2, y, d / 2), v(w / 2, y, -d / 2)]
      : chamferedRectangle(cx, y, cz, w, d, 0.085);
  for (let i = 1; i < rows.length; i++)
    profile(out, 'stone', i % 3 === 0 ? 'ledge' : 'granite', [
      section(...rows[i - 1]),
      section(...rows[i]),
    ]);
}
function pedestal(out, tier) {
  stoneSteps(out, tier);
  const rows =
    tier === 0
      ? [
          [1.54, 3.61, 3.49],
          [2.91, 3.53, 3.46],
          [3.18, 3.82, 3.68],
          [3.39, 2.95, 2.91],
          [6.92, 2.5, 2.36],
          [7.35, 2.85, 2.69],
          [7.67, 2.18, 2.07],
        ]
      : [
          [1.54, 3.62, 3.5],
          [1.72, 3.63, 3.51],
          [1.89, 3.43, 3.39],
          [2.79, 3.43, 3.39],
          [2.91, 3.53, 3.46],
          [3.05, 3.81, 3.66],
          [3.18, 3.84, 3.68],
          [3.29, 3.59, 3.46],
          [3.44, 2.95, 2.91],
          [3.62, 2.78, 2.75],
          [6.79, 2.43, 2.34],
          [6.92, 2.52, 2.39],
          [7.06, 2.74, 2.59],
          [7.24, 2.79, 2.66],
          [7.35, 2.86, 2.7],
          [7.51, 2.41, 2.28],
          [7.67, 2.18, 2.07],
        ];
  molding(out, tier, rows);
  if (tier >= 1) {
    for (const direction of [-1, 1]) {
      for (const sign of [-1, 1]) {
        const d = direction * 1.294;
        beam(
          out,
          'stone',
          v(sign * 1.16, 3.48, d),
          v(sign * 1.1, 6.81, d * 0.885),
          0.125,
          0.153,
          color.ledge,
        );
      }
    }
  }
}
function shaft(out, tier) {
  const n = [7, 14, 24, 36, 44][tier];
  const rows =
    tier === 0
      ? [
          [7.52, 0.98],
          [8.24, 0.62],
          [16.74, 0.55],
          [17.31, 0.84],
        ]
      : [
          [7.49, 1.01],
          [7.74, 0.92],
          [7.98, 0.84],
          [8.1, 0.78],
          [8.25, 0.67],
          [8.53, 0.63],
          [10.2, 0.625],
          [13.17, 0.591],
          [15.89, 0.552],
          [16.68, 0.548],
          [16.83, 0.599],
          [17.06, 0.68],
          [17.24, 0.72],
          [17.31, 0.84],
        ];
  disk(out, 'stone', 'granite', [cx, cz], rows, n);
  molding(out, tier, [
    [17.25, 1.62, 1.62],
    [17.44, 1.98, 1.89],
    [17.63, 2.07, 1.96],
    [17.76, 1.68, 1.58],
    [17.88, 1.38, 1.31],
  ]);
  disk(
    out,
    'stone',
    'mold',
    [cx, cz],
    tier === 0
      ? [
          [17.8, 0.6],
          [19.18, 0.52],
        ]
      : [
          [17.79, 0.62],
          [17.91, 0.61],
          [18.06, 0.47],
          [18.7, 0.475],
          [18.88, 0.53],
          [19.01, 0.56],
          [19.12, 0.49],
          [19.18, 0.49],
        ],
    n,
    true,
  );
}
function prow(out, sign, y, tier, index) {
  const p = (r, h, u) => v(sign * r, y + h, u);
  const rings = [
    [0.51, -0.08, 0.25, 0.29],
    [0.75, -0.02, 0.28, 0.32],
    [1.03, 0.045, 0.2, 0.24],
    [1.27, 0.22, 0.068, 0.17],
    [1.4, 0.28, 0.019, 0.1],
  ].map(([x, mid, w, h]) => [
    p(x, mid - h, 0),
    p(x, mid - h * 0.48, -w),
    p(x, mid + h, -w * 0.8),
    p(x, mid + h, w * 0.8),
    p(x, mid - h * 0.48, w),
  ]);
  const facets = tier === 0 ? [rings[0], rings[4]] : rings;
  for (let i = 1; i < facets.length; i++) {
    const a = facets[i - 1],
      b = facets[i];
    for (let k = 0; k < a.length; k++) {
      const j = (k + 1) % a.length,
        expected =
          k === 2 ? up : k === 0 || k === 4 ? [0, -1, k === 0 ? -1 : 1] : [0, 0, k < 3 ? -1 : 1];
      face(out, 'bronze', k === 2 ? 'dark' : 'bronze', [a[k], a[j], b[j], b[k]], expected);
    }
  }
  if (tier >= 2) {
    for (const a of [-1, 1]) {
      beamPath(
        out,
        'bronze',
        [
          p(0.54, 0.196, a * 0.2),
          p(0.75, 0.282, a * 0.21),
          p(1.03, 0.267, a * 0.16),
          p(1.38, 0.36, 0),
        ],
        0.055,
        0.053,
        color.high,
      );
      for (let j = 0; j < 4; j++) {
        const x = 0.64 + j * 0.127,
          yy = 0.16 + 0.024 * j;
        beam(
          out,
          'bronze',
          p(x, yy, a * 0.205),
          p(x + 0.14, yy + 0.12, a * 0.231),
          0.024,
          0.022,
          color.green,
        );
      }
    }
    beam(
      out,
      'bronze',
      p(1.25, 0.29, 0),
      p(1.41, 0.68 + (index % 2) * 0.064, 0),
      0.079,
      0.087,
      color.high,
    );
    sphere(out, 'bronze', p(1.4, 0.64, 0), [0.083, 0.121, 0.069], color.bronze, 8, 6);
    if (tier >= 3) {
      for (const side of [-1, 1]) {
        const x = 0.95 + (index % 2) * 0.076;
        beamPath(
          out,
          'bronze',
          [p(x, 0.36, 0), p(x - 0.18, 0.32, side * 0.15), p(x - 0.31, 0.27, side * 0.19)],
          0.03,
          0.027,
          color.high,
        );
      }
    }
  }
}
function anchors(out, tier) {
  for (const [i, y] of [10.89, 13.31, 15.68].entries()) {
    for (const sign of [-1, 1]) prow(out, sign, y, tier, i);
    if (tier < 1) continue;
    const ringY = y + 0.55,
      r = 0.58 + (2 - i) * 0.024,
      p = (u, h, w = 0.09) => v(u, h, r + w),
      center = y - 0.6;
    const arched = Array.from({ length: tier >= 3 ? 17 : 9 }, (_, j) => {
      const a = Math.PI + (j * Math.PI) / (tier >= 3 ? 16 : 8);
      return p(0.39 * Math.cos(a), y - 0.22 + 0.4 * Math.sin(a), 0.11);
    });
    beamPath(out, 'bronze', arched, 0.07, 0.067, color.green);
    beam(out, 'bronze', p(0, center), p(0, ringY), 0.071, 0.072, color.green);
    beam(out, 'bronze', p(-0.215, y + 0.26), p(0.215, y + 0.26), 0.059, 0.061, color.high);
    if (tier >= 2) {
      const curve = Array.from({ length: 12 }, (_, j) => {
        const a = (j * tau) / 12;
        return p(0.08 * Math.cos(a), ringY + 0.083 + 0.091 * Math.sin(a));
      });
      beamPath(out, 'bronze', curve, 0.032, 0.03, color.high, true);
    }
  }
}
function reliefs(out, tier) {
  if (tier === 0) return;
  for (const sign of [-1, 1]) {
    const f = (x, y, z = 0) => v(x, y, sign * (1.735 + z));
    const n = [0, 0, sign],
      y = 2.29;
    face(
      out,
      'bronze',
      'dark',
      [
        f(-1.23, y - 0.335, 0.02),
        f(1.23, y - 0.335, 0.02),
        f(1.23, y + 0.335, 0.02),
        f(-1.23, y + 0.335, 0.02),
      ],
      n,
    );
    beamPath(
      out,
      'stone',
      [
        f(-1.28, y - 0.39, 0.055),
        f(1.28, y - 0.39, 0.055),
        f(1.28, y + 0.39, 0.055),
        f(-1.28, y + 0.39, 0.055),
      ],
      0.083,
      0.078,
      color.ledge,
      true,
    );
    if (tier < 2) continue;
    for (let j = 0; j < 5; j++) {
      const x = -0.92 + j * 0.36,
        y0 = y - 0.21 + 0.032 * (j % 3),
        h = 0.26 + 0.061 * (j % 3);
      const body = [
        f(x - 0.076, y0, 0.04),
        f(x + 0.07, y0, 0.04),
        f(x + 0.063, y0 + h * 0.67, 0.072),
        f(x - 0.07, y0 + h, 0.073),
      ];
      face(out, 'bronze', j % 2 ? 'green' : 'bronze', body, n);
      sphere(
        out,
        'bronze',
        f(x - 0.012, y0 + h + 0.027, 0.069),
        [0.04, 0.055, 0.029],
        color.high,
        7,
        5,
      );
      beam(
        out,
        'bronze',
        f(x + 0.037, y0 + h * 0.72, 0.062),
        f(x + 0.17, y0 + h * 0.56, 0.064),
        0.028,
        0.028,
        color.green,
      );
    }
    const sail =
      sign > 0
        ? [f(0.52, y - 0.01, 0.052), f(1.01, y - 0.03, 0.052), f(0.84, y + 0.27, 0.061)]
        : [f(0.48, y - 0.02, 0.051), f(1.07, y + 0.02, 0.051), f(0.58, y + 0.23, 0.064)];
    face(out, 'bronze', 'high', sail, n);
    beam(
      out,
      'bronze',
      f(0.82, y - 0.23, 0.057),
      f(0.82, y + 0.29, 0.057),
      0.029,
      0.027,
      color.green,
    );
    if (tier >= 3) {
      for (let j = 0; j < 16; j++) {
        const x = -1.13 + j * 0.143,
          y0 = y - 0.235 + 0.013 * Math.cos(j * 0.9);
        beam(
          out,
          'bronze',
          f(x, y0, 0.057),
          f(x + 0.12, y0 - 0.013, 0.06),
          0.022,
          0.018,
          color.green,
        );
      }
    }
  }
}
function limb(out, slot, tint, sections, n) {
  const centers = sections.map((p) => p.slice(0, 3));
  const major = normalize(centers.at(-1).map((v, k) => v - centers[0][k])),
    guide = Math.abs(major[2]) < 0.84 ? [0, 0, 1] : [1, 0, 0];
  const rings = sections.map(([x, y, z, w, d], i) => {
    const a = centers[Math.max(i - 1, 0)],
      b = centers[Math.min(i + 1, centers.length - 1)];
    const axis = normalize(b.map((v, k) => v - a[k])),
      s = normalize(cross(axis, guide)),
      t = cross(axis, s);
    return Array.from({ length: n }, (_, j) => {
      const h = (j * tau) / n;
      return [x, y, z].map((v, k) => v + w * s[k] * Math.cos(h) + d * t[k] * Math.sin(h));
    });
  });
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j],
      center = mix(centers[j - 1], centers[j], 0.5);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      for (const tri of [
        [a[i], a[k], b[k]],
        [a[i], b[k], b[i]],
      ]) {
        const expected = tri[0].map((v, l) => v + tri[1][l] + tri[2][l] - 3 * center[l]);
        face(out, slot, tint, tri, expected);
      }
    }
  }
  const d = centers.at(-1).map((v, k) => v - centers[0][k]);
  face(
    out,
    slot,
    tint,
    rings[0],
    d.map((x) => -x),
  );
  face(out, slot, tint, rings.at(-1), d);
}
function cloth(out, tint, rows, n, fold) {
  const rings = rows.map(([x, y, z, w, d], i) =>
    Array.from({ length: n }, (_, j) => {
      const a = (-tau * j) / n,
        f = 1 + fold * Math.sin(5 * a + i * 0.48) + fold * 0.54 * Math.cos(8 * a - i * 0.65);
      return v(x + w * f * Math.cos(a), y, z + d * f * Math.sin(a));
    }),
  );
  profile(out, 'marble', tint, rings, true);
}
function head(out, tier, [x, y, z], scale, bowed = false) {
  const n = [7, 9, 12, 19, 23][tier],
    m = [4, 6, 8, 11, 13][tier],
    S = (a, b, c) => v(x + a * scale, y + b * scale, z + c * scale);
  const ball = (p, r, tint = 'face', segs = n, lat = m) =>
    sphere(
      out,
      'marble',
      S(...p),
      r.map((x) => x * scale),
      color[tint],
      segs,
      lat,
    );
  ball([0, 0, 0], [0.237, 0.32, 0.239]);
  if (tier < 2) return;
  const f = bowed ? 0.076 : 0;
  ball([0, -0.096, 0.181], [0.153, 0.154, 0.088], 'marble', 12, 7);
  ball([-0.015, -0.019 - f, 0.251], [0.051, 0.071, 0.063], 'chalk', 8, 6);
  for (const side of [-1, 1]) {
    ball([side * 0.227, -0.042, -0.006], [0.044, 0.082, 0.046], 'marble', 8, 6);
    ball([side * 0.082, 0.026 - f, 0.216], [0.05, 0.015, 0.021], 'shadow', 7, 5);
    if (tier >= 3) ball([side * 0.118, 0.105 - f, 0.177], [0.077, 0.026, 0.052], 'marble', 8, 6);
  }
  ball([-0.009, -0.131, 0.242], [0.059, 0.012, 0.013], 'shadow', 8, 5);
}
function skylineStatue(out) {
  const legs = [
    [-0.26, 19.16, 0.19, -0.19, 20.32, 0.1],
    [0.27, 19.16, -0.04, 0.2, 20.34, -0.07],
  ];
  for (const [a, b, c, d, e, f] of legs)
    beam(out, 'marble', v(a, b, c), v(d, e, f), 0.22, 0.25, color.marble);
  cloth(
    out,
    'marble',
    [
      [0, 20.15, -0.08, 0.41, 0.27],
      [0.04, 21.2, 0.01, 0.34, 0.27],
      [0, 21.86, -0.01, 0.44, 0.25],
      [0.01, 22.26, 0.01, 0.16, 0.14],
    ],
    5,
    0.048,
  );
  beam(out, 'marble', v(0.36, 21.88, 0.015), v(0.63, 21.39, 0.15), 0.24, 0.24, color.feather);
  beam(out, 'marble', v(0.63, 21.39, 0.15), v(0.41, 21.15, 0.29), 0.17, 0.17, color.marble);
  beam(out, 'marble', v(-0.33, 21.85, -0.03), v(-0.44, 20.55, 0.045), 0.27, 0.22, color.feather);
  disk(
    out,
    'marble',
    'face',
    [cx + 0.014, cz + 0.058],
    [
      [22.24, 0.124],
      [22.57, 0.221],
      [22.84, 0.25],
      [layout.totalHeight, 0.165],
    ],
    5,
    true,
  );
}
function statue(out, tier) {
  if (tier === 0) {
    skylineStatue(out);
    return;
  }
  const n = [5, 8, 12, 18, 24][tier],
    y = 19.16;
  const p = (x, h, z, w, d) => [...v(x, y + h, z), w, d];
  for (const [x, z, lean] of [
    [-0.22, 0.102, -0.07],
    [0.245, -0.083, 0.086],
  ]) {
    limb(
      out,
      'marble',
      'marble',
      [
        p(x + lean, 0, z + 0.15, 0.144, 0.22),
        p(x, 0.24, z, 0.128, 0.13),
        p(x, 0.61, z - 0.06, 0.152, 0.14),
        p(x * 0.87, 1.37, z - 0.044, 0.178, 0.18),
      ],
      n,
    );
  }
  const rows =
    tier < 2
      ? [
          [-0.015, 1.02, -0.06, 0.4, 0.27],
          [0.018, 1.77, 0, 0.35, 0.29],
          [0, 2.6, 0, 0.44, 0.25],
          [0.018, 3.2, 0.015, 0.163, 0.145],
        ]
      : [
          [-0.04, 0.93, -0.08, 0.44, 0.29],
          [-0.065, 1.21, -0.075, 0.47, 0.32],
          [0, 1.56, -0.035, 0.38, 0.33],
          [0.014, 1.91, 0, 0.32, 0.29],
          [0.01, 2.18, 0.014, 0.327, 0.295],
          [0.008, 2.43, 0.006, 0.415, 0.264],
          [0.01, 2.68, -0.017, 0.446, 0.244],
          [0.018, 2.94, 0.013, 0.267, 0.191],
          [0.018, 3.11, 0.015, 0.155, 0.143],
        ];
  cloth(
    out,
    'marble',
    rows.map(([x, h, z, w, d]) => [x, y + h, z, w, d]),
    n,
    tier >= 2 ? 0.135 : 0.058,
  );
  const cloak = [
    [0.06, -0.39, -0.045, 0.081, 0.115],
    [0.39, -0.4, -0.068, 0.119, 0.142],
    [0.89, -0.4, -0.09, 0.133, 0.167],
    [1.52, -0.35, -0.098, 0.12, 0.21],
    [2.21, -0.32, -0.094, 0.144, 0.217],
    [2.74, -0.31, -0.081, 0.161, 0.195],
  ];
  cloth(
    out,
    'feather',
    cloak
      .filter((_, i) => tier >= 2 || i % 2 !== 0)
      .map(([h, x, z, w, d]) => [x, y + 0.34 + h * 0.89, z, w, d]),
    n,
    0.128,
  );
  const armA = [
    p(0.39, 2.69, 0.016, 0.172, 0.166),
    p(0.58, 2.43, 0.057, 0.139, 0.128),
    p(0.64, 2.19, 0.199, 0.106, 0.102),
    p(0.4, 1.99, 0.318, 0.068, 0.072),
  ];
  const armB = [
    p(-0.355, 2.68, 0.012, 0.163, 0.167),
    p(-0.46, 2.19, -0.026, 0.12, 0.137),
    p(-0.43, 1.7, 0.038, 0.086, 0.08),
    p(-0.42, 1.59, 0.089, 0.068, 0.069),
  ];
  limb(out, 'marble', 'feather', armA, n);
  limb(out, 'marble', 'marble', armB, n);
  const faceY = y + 3.51;
  head(out, tier, [0.017, faceY, 0.072], 1.02);
  disk(
    out,
    'marble',
    'feather',
    [cx + 0.014, cz + 0.058],
    [
      [faceY + 0.175, 0.242],
      [faceY + 0.218, 0.267],
      [faceY + 0.283, 0.259],
      [layout.totalHeight, 0.195],
    ],
    n,
    true,
  );
  if (tier >= 2) {
    sphere(out, 'marble', v(0.398, y + 1.98, 0.347), [0.091, 0.111, 0.067], color.chalk, n, 7);
    sphere(out, 'marble', v(-0.42, y + 1.54, 0.089), [0.084, 0.118, 0.069], color.marble, n, 7);
    const hem = [
      [0.3, 2.73, 0.19],
      [0.18, 2.44, 0.26],
      [0.17, 1.97, 0.327],
      [0.04, 1.47, 0.352],
      [-0.082, 1.06, 0.32],
    ];
    beamPath(
      out,
      'marble',
      hem.map(([x, h, z]) => v(x, y + h, z)),
      0.045,
      0.038,
      color.chalk,
    );
    if (tier >= 3)
      for (let j = 0; j < 5; j++) {
        const x = 0.347 + j * 0.023;
        beam(
          out,
          'marble',
          v(x, y + 2.01, 0.386),
          v(x - 0.032, y + 1.91 - (j % 2) * 0.012, 0.384),
          0.019,
          0.024,
          color.face,
        );
      }
  }
}
function feather(out, slot, tint, a, b, width, normal) {
  const side = normalize(
    cross(
      normal,
      b.map((v, i) => v - a[i]),
    ),
  ).map((v) => v * width);
  const c = mix(a, b, 0.61),
    l = c.map((v, i) => v - side[i]),
    r = c.map((v, i) => v + side[i]),
    top = c.map((v, i) => v + normal[i] * width * 0.31);
  for (const tri of [
    [a, l, top],
    [l, b, top],
    [a, top, r],
    [top, b, r],
  ])
    face(out, slot, tint, tri, normal);
}
function genius(out, tier) {
  const n = [6, 8, 12, 17, 22][tier],
    s = [cx + 0.075, cz + 2.01];
  const plinth =
    tier === 0
      ? [
          [3.12, 1.62, 1.1],
          [3.33, 1.77, 1.18],
        ]
      : [
          [3.09, 1.58, 1.08],
          [3.19, 1.63, 1.14],
          [3.34, 1.76, 1.23],
        ];
  profile(
    out,
    'marble',
    'marble',
    plinth.map(([y, w, d]) => chamferedRectangle(s[0], y, s[1], w, d, 0.17)),
    true,
  );
  cloth(
    out,
    'marble',
    [
      [0.08, 3.31, 1.99, 0.48, 0.39],
      [0.13, 3.6, 2.12, 0.52, 0.38],
      [0.175, 4.03, 2.04, 0.416, 0.35],
      [0.21, 4.63, 1.67, 0.29, 0.24],
      [0.22, 5.07, 1.76, 0.35, 0.225],
      [0.2, 5.25, 1.94, 0.154, 0.153],
    ],
    n,
    tier >= 2 ? 0.157 : 0.08,
  );
  head(out, tier, [0.14, 5.42, 2.035], 0.9, true);
  const globe = v(-0.28, 4.57, 2.42);
  sphere(out, 'marble', globe, [0.405, 0.405, 0.405], color.chalk, n, tier >= 2 ? 12 : 6);
  limb(
    out,
    'marble',
    'marble',
    [
      [...v(-0.092, 5.04, 1.8), 0.139, 0.143],
      [...v(-0.36, 4.75, 1.92), 0.105, 0.108],
      [...v(-0.55, 4.6, 2.38), 0.069, 0.065],
    ],
    n,
  );
  limb(
    out,
    'marble',
    'feather',
    [
      [...v(0.44, 5.03, 1.81), 0.138, 0.146],
      [...v(0.37, 4.79, 2.1), 0.099, 0.099],
      [...v(0.018, 4.76, 2.48), 0.064, 0.061],
    ],
    n,
  );
  for (const sign of [-1, 1]) {
    const p = (x, y, z) => v(x * sign + 0.12, y, z),
      normal = normalize([sign * 0.26, 0.16, 1]);
    const wing = [
      p(0.2, 4.66, 1.52),
      p(0.52, 5.21, 1.45),
      p(0.93, 5.88, 1.52),
      p(0.98, 5.02, 1.73),
      p(0.72, 4.36, 1.88),
    ];
    for (let i = 1; i < wing.length - 1; i++)
      face(out, 'marble', 'feather', [wing[0], wing[i], wing[i + 1]], normal);
    if (tier < 1) continue;
    const count = tier === 1 ? 6 : tier === 2 ? 11 : 18;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      feather(
        out,
        'marble',
        i % 3 ? 'marble' : 'chalk',
        p(0.35 + t * 0.48, 4.85 + t * 0.69, 1.57),
        p(0.67 + t * 0.34, 4.37 + t * 1.46, 1.89 - t * 0.34),
        0.105 - t * 0.032,
        normal,
      );
    }
  }
  if (tier >= 3) {
    for (const pitch of [-0.64, 0, 0.64]) {
      const r = 0.406 * Math.cos(pitch),
        y = globe[1] + 0.404 * Math.sin(pitch);
      const line = Array.from({ length: 21 }, (_, i) => [
        globe[0] + r * Math.cos((i * tau) / 20),
        y,
        globe[2] + r * Math.sin((i * tau) / 20),
      ]);
      beamPath(out, 'marble', line.slice(0, -1), 0.012, 0.013, color.feather, true);
    }
  }
}
function eagle(out, tier) {
  const n = [6, 8, 12, 18, 22][tier],
    center = v(0, 4.16, -1.47),
    normal = [0, 0.19, -1];
  sphere(out, 'bronze', center, [0.35, 0.56, 0.29], color.bronze, n, Math.max(5, n - 7));
  sphere(
    out,
    'bronze',
    v(0.117, 4.72, -1.61),
    [0.194, 0.208, 0.174],
    color.high,
    n,
    Math.max(5, n - 7),
  );
  face(
    out,
    'bronze',
    'green',
    [v(0.19, 4.76, -1.71), v(0.39, 4.68, -1.68), v(0.18, 4.58, -1.7)],
    normal,
  );
  for (const sign of [-1, 1]) {
    const p = (x, y, z) => v(x * sign, y, z);
    const root = p(0.16, 4.18, -1.52),
      tip = p(1.04, 5.24, -1.36),
      tail = p(0.71, 4.51, -1.49);
    face(out, 'bronze', 'bronze', [root, tip, tail], normal);
    const count = [2, 4, 7, 12, 15][tier];
    for (let j = 0; j < count; j++) {
      const t = j / (count - 1);
      feather(
        out,
        'bronze',
        j % 2 ? 'bronze' : 'high',
        p(0.19 + t * 0.51, 4.28 + t * 0.61, -1.54),
        p(0.33 + t * 0.73, 3.99 + t * 1.26, -1.56 + t * 0.17),
        0.084,
        normal,
      );
    }
  }
}
export function buildCircleLevel(out, level) {
  const tier = levels[level];
  if (tier === undefined) throw new Error(`Unknown Columbus Circle level ${level}`);
  plaza(out, tier);
  pedestal(out, tier);
  shaft(out, tier);
  anchors(out, tier);
  reliefs(out, tier);
  if (tier === 0) {
    const n = 5;
    cloth(
      out,
      'marble',
      [
        [0.09, 3.25, 1.89, 0.49, 0.35],
        [0.15, 4.3, 1.83, 0.41, 0.31],
        [0.12, 5.06, 1.7, 0.29, 0.22],
      ],
      n,
      0.05,
    );
    sphere(out, 'marble', v(0.12, 5.31, 1.93), [0.2, 0.24, 0.2], color.marble, n, 4);
    sphere(out, 'bronze', v(0, 4.57, -1.43), [0.64, 0.57, 0.19], color.bronze, 6, 4);
  } else {
    genius(out, tier);
    eagle(out, tier);
  }
  statue(out, tier);
}
export const buildCircleSkyline = (out) => buildCircleLevel(out, 'skyline');
export const buildCircleDistrict = (out) => buildCircleLevel(out, 'district');
export const buildCircleStreet = (out) => buildCircleLevel(out, 'street');
export const buildCircleCloseup = (out) => buildCircleLevel(out, 'closeup');
