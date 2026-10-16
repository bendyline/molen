/** Independent reviewed Telekom derivatives. Original buildTelekom remains unchanged. */
/** Menara Telekom: primary engineer's curved-strip plan and HIJJAS exterior drawings. */
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
// `**` rounds differently on Windows and Linux builds of Node, which changed this tower's bytes.
import { pow } from './deterministic-math.mjs';
import {
  clockwise,
  face,
  grid,
  mappedCap,
  mappedSolid,
} from './signature-tower-expansion-models.mjs';

const silver = [0.66, 0.7, 0.71],
  edge = [0.53, 0.59, 0.61],
  glass = [0.16, 0.28, 0.32],
  cyan = [0.18, 0.4, 0.44];
// Figure 1 (Gabor/Gurusamy,1997) traced in its published image plane. The 16m
// office width sets scale; a rigid frame preserves both opposing curved wings.
const scale = 0.278,
  angle = -0.56,
  center = [-8, 0];
const upper = {
  outer: [
    [708, 293],
    [800, 277],
    [900, 302],
    [982, 349],
  ],
  inner: [
    [724, 355],
    [800, 344],
    [885, 364],
    [951, 399],
  ],
  high: 308,
  tall: true,
};
const lower = {
  outer: [
    [578, 433],
    [665, 483],
    [763, 503],
    [854, 483],
  ],
  inner: [
    [611, 381],
    [684, 420],
    [766, 440],
    [839, 427],
  ],
  high: 222,
  tall: false,
};
const plan = (p) => {
  const x = (p[0] - 781) * scale,
    z = (p[1] - 391) * scale;
  return [
    center[0] + x * Math.cos(angle) - z * Math.sin(angle),
    x * Math.sin(angle) + z * Math.cos(angle),
  ];
};
const at = (p, y) => [p[0], y, p[1]];
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function bez(c, t) {
  const s = 1 - t;
  return c[0].map(
    (_, i) =>
      s * s * s * c[0][i] + 3 * s * s * t * c[1][i] + 3 * s * t * t * c[2][i] + t * t * t * c[3][i],
  );
}
function limits(w, y) {
  return w.tall
    ? [0, Math.max(0.025, Math.sqrt(Math.max(0, 1 - pow(y / 310, 1.25))))]
    : [0.49 * pow(y / 222, 1.65), 1];
}
function wp(w, side, u, y, offset = 0) {
  const [a, b] = limits(w, y),
    t = a + (b - a) * u,
    p = plan(bez(w[side], t));
  if (offset) {
    const q = plan(bez(w[side], Math.min(1, t + 0.0001))),
      r = plan(bez(w[side], Math.max(0, t - 0.0001))),
      dx = q[0] - r[0],
      dz = q[1] - r[1],
      n = Math.hypot(dx, dz),
      sign = (w.tall ? 1 : -1) * (side === 'outer' ? 1 : -1);
    p[0] += ((sign * dz) / n) * offset;
    p[1] -= ((sign * dx) / n) * offset;
  }
  return at(p, y);
}
function patch(out, w, side, u0, u1, y0, y1, color, slot = 'metal', offset = 0) {
  let p = [
    wp(w, side, u0, y0, offset),
    wp(w, side, u1, y0, offset),
    wp(w, side, u1, y1, offset),
    wp(w, side, u0, y1, offset),
  ];
  if ((w.tall && side === 'outer') || (!w.tall && side === 'inner')) p = p.toReversed();
  face(out, slot, p, color);
}
const corePlan = clockwise(
  [
    [724, 355],
    [837, 355],
    [838, 427],
    [724, 427],
  ].map(plan),
);
function gardens(out) {
  for (let side = 0; side < 2; side++)
    for (let i = 0; i < 11; i++) {
      const y = 13 + i * 19.7 + side * 9.85;
      if (y > 222) continue;
      const p =
        side === 0
          ? [
              plan(bez(upper.inner, 0)),
              plan([724, 427]),
              plan(bez(lower.inner, limits(lower, y)[0])),
            ]
          : [
              plan(bez(lower.inner, 1)),
              plan([837, 355]),
              plan(bez(upper.inner, limits(upper, y)[1])),
            ];
      terrace(out, p, y, i + side * 11);
    }
}
function antenna(out) {
  // Narrow end of the tall wing remains straight; the 21-storey sail is closed cladding.
  for (const side of ['outer', 'inner']) {
    const u0 = 0.09,
      u1 = 0.54,
      y = 273;
    // Individually modeled original TM glyph strokes on each broad sail face.
    const letter = (u, v) =>
        wp(upper, side, 0.06 + (u - 0.09) * 1.65 + v * 0.002, y + v * 1.4, 0.16),
      col = [0.05, 0.14, 0.38];
    const paths = [
      [
        [u0, 0],
        [u0 + 0.1, 0],
      ],
      [
        [u0 + 0.05, 0],
        [u0 + 0.025, -5.6],
      ],
      [
        [u0 + 0.15, -5.6],
        [u0 + 0.19, 0],
        [u0 + 0.245, -3.6],
        [u0 + 0.32, 0],
        [u0 + 0.3, -5.6],
      ],
    ];
    for (const path of paths)
      for (let i = 1; i < path.length; i++)
        beam(out, 'metal', letter(...path[i - 1]), letter(...path[i]), 1.2, 0.2, col);
    for (let i = 0; i < 20; i++) {
      const t = i / 20,
        s = (i + 1) / 20;
      beam(
        out,
        'metal',
        letter(u1 - 0.24 + t * 0.14, 2.2 + Math.sin(t * Math.PI) * 1.4),
        letter(u1 - 0.24 + s * 0.14, 2.2 + Math.sin(s * Math.PI) * 1.4),
        0.75,
        0.18,
        [0.7, 0.13, 0.16],
      );
    }
  }
  for (const u of [0, 0.018]) {
    const a = wp(upper, 'outer', u, 307),
      b = wp(upper, 'inner', u, 307);
    beam(out, 'metal', a, [a[0], 310, a[2]], 0.2, 0.2, silver);
    beam(out, 'metal', b, [b[0], 310, b[2]], 0.2, 0.2, silver);
  }
}
function ground(out) {
  const apron = clockwise(
    [
      [578, 433],
      [607, 377],
      [708, 293],
      [801, 281],
      [982, 349],
      [955, 401],
      [854, 483],
      [755, 500],
    ].map(plan),
  );
  mappedSolid(out, 'stone', apron, 0, 0.12, [0.48, 0.49, 0.47]);
  // Closed glazed entrance at the central core, reached directly from the ground apron.
  const a = plan([724, 373]),
    b = plan([724, 411]),
    dir = [-0.86, 0.52],
    front = [mix(a, b, 0), mix(a, b, 1)].map((p) => [p[0] + dir[0] * 4, p[1] + dir[1] * 4]);
  const canopy = clockwise([a, b, front[1], front[0]]);
  mappedSolid(out, 'metal', canopy, 4.6, 4.95, silver);
  for (const p of front) beam(out, 'metal', at(p, 0.12), at(p, 4.6), 0.17, 0.17, silver);
  for (let i = 0; i < 6; i++) {
    const p = mix(front[0], front[1], i / 6),
      q = mix(front[0], front[1], (i + 1) / 6);
    grid(out, [at(p, 0.12), at(q, 0.12), at(q, 3.5), at(p, 3.5)], glass, 1.2, 3.4, 0.06, silver);
  }
  for (let i = 0; i < 2; i++)
    face(
      out,
      'clear_glass',
      [at(i ? b : a, 0.12), at(front[i], 0.12), at(front[i], 4.6), at(i ? b : a, 4.6)],
      glass,
    );
}

function stripe(out, w, side, u0, u1, y, width, color = edge, offset = 0.11) {
  patch(out, w, side, u0, u1, y - width / 2, y + width / 2, color, 'metal', offset);
}
function wing(out, w) {
  const d = out.detail,
    n = d.columns;
  const ys = d.skyline
    ? [0, 40, 80, 120, 160, 200, 243, 273, 294, w.high].filter((y) => y < w.high).concat(w.high)
    : Array.from({ length: Math.ceil(w.high / d.pitch) + 1 }, (_, i) =>
        Math.min(w.high, i * d.pitch),
      );
  for (let j = 1; j < ys.length; j++) {
    const y0 = ys[j - 1],
      y1 = ys[j],
      glazed = y0 >= 7 && y1 <= 243;
    for (const side of ['outer', 'inner'])
      for (let i = 0; i < n; i++) {
        const u0 = i / n,
          u1 = (i + 1) / n;
        if (glazed && !d.skyline) {
          const lo = y0 + 0.95,
            hi = Math.min(y1 - 0.35, y0 + (d.pitch === 3.5 ? 2.45 : d.pitch * 0.7));
          patch(out, w, side, u0, u1, y0, lo, silver);
          patch(out, w, side, u0, u1, hi, y1, silver);
          patch(out, w, side, u0, u1, lo, hi, glass, 'glass', -0.1);
          if (d.shades && i % 2 === 0)
            for (const y of [lo, lo + 0.49, hi])
              stripe(out, w, side, u0, Math.min(1, u0 + 2 / n), y, 0.045, edge, 0.24);
          if (d.mullions)
            patch(out, w, side, u0, Math.min(u1, u0 + 0.0009), lo, hi, edge, 'metal', -0.05);
        } else
          patch(out, w, side, u0, u1, y0, y1, glazed ? glass : silver, glazed ? 'glass' : 'metal');
      }
    for (const u of [0, 1]) {
      let p = [
        wp(w, 'outer', u, y0),
        wp(w, 'inner', u, y0),
        wp(w, 'inner', u, y1),
        wp(w, 'outer', u, y1),
      ];
      const outward = mix(wp(w, 'outer', u, y0), wp(w, 'inner', u, y0), 0.5).map(
        (v, k) =>
          v -
          mix(
            wp(w, 'outer', u === 0 ? 0.02 : 0.98, y0),
            wp(w, 'inner', u === 0 ? 0.02 : 0.98, y0),
            0.5,
          )[k],
      );
      if (normalFor(...p.slice(0, 3)).reduce((sum, v, k) => sum + v * outward[k], 0) < 0)
        p = p.toReversed();
      const fixed = (w.tall && u === 0) || (!w.tall && u === 1);
      if (!d.skyline && fixed && y0 >= 7 && y1 <= 273) {
        const lo = y0 + 0.95,
          hi = Math.min(y1 - 0.35, y0 + (d.pitch === 3.5 ? 2.45 : d.pitch * 0.7));
        const end = (a, b, color, slot = 'metal') => {
          let q = [
            wp(w, 'outer', u, a),
            wp(w, 'inner', u, a),
            wp(w, 'inner', u, b),
            wp(w, 'outer', u, b),
          ];
          if (normalFor(...q.slice(0, 3)).reduce((sum, v, k) => sum + v * outward[k], 0) < 0)
            q = q.toReversed();
          face(out, slot, q, color);
        };
        end(y0, lo, silver);
        end(lo, hi, glass, 'glass');
        end(hi, y1, silver);
      } else face(out, 'metal', p, silver);
    }
  }
  for (const y of [0, w.high]) {
    const r = [];
    for (let i = 0; i <= n; i++) r.push(wp(w, 'outer', i / n, y));
    for (let i = n; i >= 0; i--) r.push(wp(w, 'inner', i / n, y));
    mappedCap(
      out,
      'metal',
      r.map((p) => [p[0], p[2]]),
      y,
      silver,
      [],
      y === 0,
    );
  }
}
function core(out) {
  const d = out.detail;
  if (d.skyline) {
    mappedSolid(out, 'metal', corePlan, 0, 226, silver);
    return;
  }
  for (let i = 0; i < 4; i++) {
    const a = corePlan[i],
      b = corePlan[(i + 1) % 4];
    for (let y = 0; y < 226; y += d.pitch) {
      const top = Math.min(226, y + d.pitch),
        lo = Math.min(top, y + 0.95),
        hi = Math.min(top, y + (d.pitch === 3.5 ? 2.45 : d.pitch * 0.7));
      face(out, 'metal', [at(a, y), at(b, y), at(b, lo), at(a, lo)], silver);
      if (top > hi) face(out, 'metal', [at(a, hi), at(b, hi), at(b, top), at(a, top)], silver);
      if (hi > lo) face(out, 'glass', [at(a, lo), at(b, lo), at(b, hi), at(a, hi)], glass);
    }
  }
  mappedCap(out, 'metal', corePlan, 226, silver);
  mappedCap(out, 'stone', corePlan, 0, silver, [], true);
}
// Open bowstrings use two crossed strip faces instead of closed micro-beam shells.
function bar(out, slot, a, b, width, color) {
  const v = b.map((x, i) => x - a[i]),
    l = Math.hypot(v[0], v[2]),
    n = l < 1e-6 ? [width / 2, 0, 0] : [0, width / 2, 0];
  const p = [
    a.map((x, i) => x + n[i]),
    b.map((x, i) => x + n[i]),
    b.map((x, i) => x - n[i]),
    a.map((x, i) => x - n[i]),
  ];
  face(out, slot, p, color);
  face(out, slot, p.toReversed(), color);
}
function palm(out, p, y, index) {
  const h = 3.8 + (index % 3) * 0.28;
  beam(out, 'stone', at(p, y), [p[0] + 0.12, y + h, p[1] - 0.1], 0.2, 0.19, [0.37, 0.3, 0.23]);
  for (let i = 0; i < out.detail.fronds; i++) {
    const a = (i * Math.PI * 2) / out.detail.fronds + index * 0.7;
    for (let j = 0; j < 3; j++) {
      const t = j / 3,
        s = (j + 1) / 3,
        point = (q) => [
          p[0] + Math.cos(a) * 2.5 * q,
          y + h + Math.sin(q * Math.PI) * 0.9 - q * 0.5,
          p[1] + Math.sin(a) * 2.5 * q,
        ],
        u = point(t),
        v = point(s),
        w = 0.34 * Math.sin(((t + s) / 2) * Math.PI),
        n = [-Math.sin(a) * w, 0, Math.cos(a) * w];
      const q = [
        u.map((x, k) => x + n[k]),
        v.map((x, k) => x + n[k] * 0.5),
        v.map((x, k) => x - n[k] * 0.5),
        u.map((x, k) => x - n[k]),
      ];
      face(out, 'stone', q, [0.17, 0.28, 0.12]);
      face(out, 'stone', q.toReversed(), [0.12, 0.24, 0.08]);
    }
  }
}
function terrace(out, p, y, index) {
  const d = out.detail,
    a = p[0],
    b = p[2],
    ring = clockwise(p);
  mappedSolid(out, 'stone', ring, y - 0.42, y, [0.51, 0.53, 0.49]);
  const shrubPlan = clockwise([
    mix(a, p[1], 0.13),
    mix(b, p[1], 0.13),
    mix(b, p[1], 0.31),
    mix(a, p[1], 0.31),
  ]);
  if (d.skyline) {
    mappedCap(out, 'stone', shrubPlan, y + 0.76, [0.17, 0.28, 0.12]);
    return;
  }
  const n = d.truss;
  let last = at(a, y - 0.6);
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      q = mix(a, b, t),
      lower = [q[0], y - 0.6 - 2.9 * Math.sin(t * Math.PI), q[1]],
      top = at(q, y - 0.55),
      prev = at(mix(a, b, (i - 1) / n), y - 0.55);
    bar(out, 'metal', last, lower, 0.2, cyan);
    bar(out, 'metal', prev, top, 0.22, cyan);
    bar(out, 'metal', last, top, 0.1, cyan);
    if (i < n) bar(out, 'metal', lower, top, 0.1, cyan);
    if (d.rails) {
      bar(out, 'metal', at(q, y), at(q, y + 1.12), 0.055, silver);
      bar(out, 'metal', at(mix(a, b, (i - 1) / n), y + 1.12), at(q, y + 1.12), 0.07, silver);
    }
    last = lower;
  }
  mappedSolid(out, 'stone', shrubPlan, y, y + 0.58, [0.48, 0.51, 0.47]);
  mappedSolid(out, 'stone', shrubPlan, y + 0.58, y + 1.12, [0.17, 0.28, 0.12]);
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (d.fronds && length > 10) {
    const c = mix(mix(a, b, 0.5), p[1], 0.3);
    loft(
      out,
      'stone',
      [radialRing(y, 1.15, 1.15, 8, c), radialRing(y + 0.7, 1.25, 1.25, 8, c)],
      [0.57, 0.57, 0.51],
    );
    palm(out, c, y + 0.7, index);
  }
}
function helipad(out) {
  const d = out.detail,
    c = [-1.5, 18],
    n = d.helipad,
    ring = (r, y) => radialRing(y, r, r, n, c);
  loft(
    out,
    'metal',
    [
      ring(5.7, 226),
      ring(6.4, 227.2),
      ring(12.4, 229.5),
      ring(17.5, 232.1),
      ring(20, 234.9),
      ring(20, 235.72),
    ],
    silver,
    { cap: false },
  );
  mappedCap(
    out,
    'metal',
    ring(20, 236).map((p) => [p[0], p[2]]),
    236,
    [0.31, 0.37, 0.36],
  );
  loft(out, 'metal', [ring(20, 235.72), ring(20, 236)], edge, { cap: false });
  mappedCap(
    out,
    'metal',
    ring(5.7, 226).map((p) => [p[0], p[2]]),
    226,
    silver,
    [],
    true,
  );
  const annulus = (r, y, width, color) => {
    const a = ring(r - width / 2, y),
      b = ring(r + width / 2, y);
    for (let i = 0; i < n; i++)
      face(out, 'metal', [a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]], color);
  };
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      p = (r, y) => [c[0] + r * Math.cos(a), y, c[1] + r * Math.sin(a)];
    if (!d.skyline) bar(out, 'metal', p(19.9, 235.91), p(21.2, 235.91), 0.055, edge);
    if (d.ribs && i % 4 === 0) {
      let prev = p(5.8, 226.2);
      for (const [r, y] of [
        [6.4, 227.1],
        [12.4, 229.3],
        [17.5, 231.9],
        [20, 234.8],
      ]) {
        bar(out, 'metal', prev, p(r, y), 0.12, edge);
        prev = p(r, y);
      }
    }
  }
  if (!d.skyline) {
    for (const r of [20.2, 20.5, 20.8, 21.2]) annulus(r, 235.91, 0.07, edge);
    annulus(14.4, 236.025, 0.15, [0.83, 0.83, 0.67]);
  }
  for (const [lo, hi] of [
    [
      [-3.6, -5],
      [-2.6, 5],
    ],
    [
      [2.6, -5],
      [3.6, 5],
    ],
    [
      [-2.6, -0.55],
      [2.6, 0.55],
    ],
  ])
    face(
      out,
      'metal',
      [
        [c[0] + lo[0], 236.03, c[1] + lo[1]],
        [c[0] + lo[0], 236.03, c[1] + hi[1]],
        [c[0] + hi[0], 236.03, c[1] + hi[1]],
        [c[0] + hi[0], 236.03, c[1] + lo[1]],
      ],
      [0.89, 0.89, 0.75],
    );
}
const settings = {
  skyline: { skyline: true, columns: 5, pitch: 35, helipad: 12 },
  district: { columns: 5, pitch: 35, truss: 2, helipad: 16 },
  street: { columns: 10, pitch: 7, truss: 4, helipad: 32, fronds: 2 },
  closeup: {
    columns: 16,
    pitch: 3.5,
    truss: 12,
    helipad: 72,
    rails: true,
    fronds: 8,
    shades: true,
    mullions: true,
    ribs: true,
  },
};
function build(out, name) {
  const d = settings[name],
    means = { metal: [0.908889, 0.908889, 0.908889], stone: [0.701109, 0.701109, 0.701109] };
  const target = {
    detail: d,
    ...Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
        k,
        (slot, r, p, n, uv, c) =>
          name === 'skyline'
            ? out[k](
                'silhouette',
                'palette:#ffffff',
                p,
                n,
                uv,
                means[slot] ? c.map((v, i) => v * means[slot][i]) : c,
              )
            : out[k](slot, r, p, n, uv, c),
      ]),
    ),
  };
  if (d.skyline) {
    const apron = clockwise(
      [
        [578, 433],
        [607, 377],
        [708, 293],
        [801, 281],
        [982, 349],
        [955, 401],
        [854, 483],
        [755, 500],
      ].map(plan),
    );
    mappedSolid(target, 'stone', apron, 0, 0.12, [0.48, 0.49, 0.47]);
  } else ground(target);
  core(target);
  wing(target, upper);
  wing(target, lower);
  gardens(target);
  helipad(target);
  if (!d.skyline) antenna(target);
  else
    for (const u of [0, 0.018])
      for (const side of ['outer', 'inner']) {
        const a = wp(upper, side, u, 307);
        beam(target, 'metal', a, [a[0], 310, a[2]], 0.2, 0.2, silver);
      }
}
export const buildTelekomReviewedMaster = (out) => build(out, 'closeup');
export const buildTelekomSkyline = (out) => build(out, 'skyline');
export const buildTelekomDistrict = (out) => build(out, 'district');
export const buildTelekomStreet = (out) => build(out, 'street');
export const buildTelekomCloseup = (out) => build(out, 'closeup');
