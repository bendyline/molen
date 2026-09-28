/** Menara Telekom: primary engineer's curved-strip plan and HIJJAS exterior drawings. */
import { beam, loft, normalFor, radialRing, sphere, torus } from './authored-structure-mesh.mjs';
import {
  clockwise,
  commonLimit,
  face,
  grid,
  mappedCap,
  mappedSolid,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

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
    ? [0, Math.max(0.025, Math.sqrt(Math.max(0, 1 - (y / 310) ** 1.25)))]
    : [0.49 * (y / 222) ** 1.65, 1];
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
function wing(out, w) {
  const pitch = 3.5,
    rows = Math.ceil(w.high / pitch),
    columns = 56;
  for (let j = 0; j < rows; j++) {
    const y0 = j * pitch,
      y1 = Math.min(w.high, y0 + pitch);
    if (y1 - y0 < 0.03) continue;
    const glazed = y0 >= 7 && y1 <= 243;
    for (const side of ['outer', 'inner'])
      for (let i = 0; i < columns; i++) {
        const u0 = i / columns,
          u1 = (i + 1) / columns;
        if (glazed) {
          const lo = y0 + 0.95,
            hi = Math.min(y1 - 0.35, y0 + 2.45);
          patch(out, w, side, u0, u1, y0, lo, silver);
          patch(out, w, side, u0, u1, hi, y1, silver);
          patch(out, w, side, u0, u1, lo, hi, glass, 'glass', -0.1);
          for (const y of [lo, lo + 0.49, lo + 0.98, hi])
            beam(
              out,
              'metal',
              wp(w, side, u0, y, 0.11),
              wp(w, side, u1, y, 0.11),
              0.045,
              0.26,
              edge,
            );
          beam(
            out,
            'metal',
            wp(w, side, u0, lo, -0.05),
            wp(w, side, u0, hi, -0.05),
            0.045,
            0.07,
            edge,
          );
        } else patch(out, w, side, u0, u1, y0, y1, silver);
        // Narrow recessed panel joints follow the actual bent facade, not a flat decal.
        beam(
          out,
          'metal',
          wp(w, side, u0, y0 + 0.015, 0.015),
          wp(w, side, u1, y0 + 0.015, 0.015),
          0.025,
          0.025,
          edge,
        );
        if (i % 2 === 0)
          beam(
            out,
            'metal',
            wp(w, side, u0, y0 + 0.015, 0.015),
            wp(w, side, u0, y1, 0.015),
            0.018,
            0.02,
            edge,
          );
      }
    for (const u of [0, 1]) {
      let p = [
        wp(w, 'outer', u, y0),
        wp(w, 'inner', u, y0),
        wp(w, 'inner', u, y1),
        wp(w, 'outer', u, y1),
      ];
      const outward =
        u === 0
          ? mix(wp(w, 'outer', 0, y0), wp(w, 'inner', 0, y0), 0.5).map(
              (v, k) => v - mix(wp(w, 'outer', 0.02, y0), wp(w, 'inner', 0.02, y0), 0.5)[k],
            )
          : mix(wp(w, 'outer', 1, y0), wp(w, 'inner', 1, y0), 0.5).map(
              (v, k) => v - mix(wp(w, 'outer', 0.98, y0), wp(w, 'inner', 0.98, y0), 0.5)[k],
            );
      if (normalFor(...p.slice(0, 3)).reduce((s, v, k) => s + v * outward[k], 0) < 0)
        p = p.toReversed();
      const fixed = (w.tall && u === 0) || (!w.tall && u === 1);
      const endPatch = (t0, t1, lo, hi, color, slot = 'metal', inset = 0) => {
        let q = [
          mix(wp(w, 'outer', u, lo), wp(w, 'inner', u, lo), t0),
          mix(wp(w, 'outer', u, lo), wp(w, 'inner', u, lo), t1),
          mix(wp(w, 'outer', u, hi), wp(w, 'inner', u, hi), t1),
          mix(wp(w, 'outer', u, hi), wp(w, 'inner', u, hi), t0),
        ];
        if (normalFor(...q.slice(0, 3)).reduce((s, v, k) => s + v * outward[k], 0) < 0)
          q = q.toReversed();
        const n = normalFor(...q.slice(0, 3));
        if (inset) q = q.map((a) => a.map((v, k) => v + n[k] * inset));
        face(out, slot, q, color);
      };
      if (fixed && y0 >= 7 && (y1 <= 273 || (w.tall && y0 >= 290 && y0 < 294))) {
        const lo = y0 + 0.95,
          hi = Math.min(y1 - 0.35, y0 + 2.45);
        endPatch(0, 1, y0, lo, silver);
        endPatch(0, 1, hi, y1, silver);
        endPatch(0, 0.055, lo, hi, silver);
        endPatch(0.945, 1, lo, hi, silver);
        endPatch(0.055, 0.945, lo, hi, glass, 'glass', -0.08);
        if (y0 >= 290) endPatch(0.46, 0.54, lo, hi, silver, 'metal', 0.005);
        for (let k = 1; k < 10 && y0 < 290; k++) {
          const a = mix(wp(w, 'outer', u, lo), wp(w, 'inner', u, lo), k / 10),
            b = mix(wp(w, 'outer', u, hi), wp(w, 'inner', u, hi), k / 10);
          beam(out, 'metal', a, b, 0.065, 0.1, edge);
        }
        if (y0 < 232)
          for (const y of [lo + 0.49, lo + 0.98])
            beam(
              out,
              'metal',
              mix(wp(w, 'outer', u, y), wp(w, 'inner', u, y), 0.055),
              mix(wp(w, 'outer', u, y), wp(w, 'inner', u, y), 0.945),
              0.045,
              0.25,
              edge,
            );
      } else {
        face(out, 'metal', p, silver);
        for (let k = 1; k < 5; k++)
          beam(out, 'metal', mix(p[0], p[1], k / 5), mix(p[3], p[2], k / 5), 0.035, 0.04, edge);
      }
    }
  }
  for (const y of [0, w.high]) {
    const r = [];
    for (let i = 0; i <= 56; i++) r.push(wp(w, 'outer', i / 56, y));
    for (let i = 56; i >= 0; i--) r.push(wp(w, 'inner', i / 56, y));
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
const corePlan = clockwise(
  [
    [724, 355],
    [837, 355],
    [838, 427],
    [724, 427],
  ].map(plan),
);
function core(out) {
  for (let i = 0; i < corePlan.length; i++) {
    const a = corePlan[i],
      b = corePlan[(i + 1) % corePlan.length];
    for (let y = 0; y < 226; y += 3.5) {
      const top = Math.min(226, y + 3.5),
        lo = Math.min(top, y + 0.95),
        hi = Math.min(top, y + 2.45);
      face(out, 'metal', [at(a, y), at(b, y), at(b, lo), at(a, lo)], silver);
      if (top > hi) face(out, 'metal', [at(a, hi), at(b, hi), at(b, top), at(a, top)], silver);
      if (hi > lo)
        grid(out, [at(a, lo), at(b, lo), at(b, hi), at(a, hi)], glass, 2.3, 3.5, 0.07, silver);
    }
  }
  mappedCap(out, 'metal', corePlan, 226, silver);
  mappedCap(out, 'concrete', corePlan, 0, silver, [], true);
}
function palm(out, p, y, index) {
  const h = 3.8 + (index % 3) * 0.28;
  beam(out, 'wood', at(p, y), [p[0] + 0.12, y + h, p[1] - 0.1], 0.2, 0.19, [0.37, 0.3, 0.23]);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + index * 0.7,
      points = [];
    for (let j = 0; j <= 7; j++) {
      const t = j / 7;
      points.push([
        p[0] + Math.cos(a) * 2.5 * t,
        y + h + Math.sin(t * Math.PI) * 0.9 - t * 0.5,
        p[1] + Math.sin(a) * 2.5 * t,
      ]);
    }
    for (let j = 0; j < 7; j++) {
      const a0 = points[j],
        b = points[j + 1],
        w = 0.3 * Math.sin(((j + 0.5) / 7) * Math.PI),
        dx = -Math.sin(a) * w,
        dz = Math.cos(a) * w;
      beam(out, 'foliage', a0, b, 0.023, 0.023, [0.22, 0.3, 0.13]);
      // Each frond carries separate tapered pinnae, rather than a broad polygon leaf.
      for (let k = 0; k < 3; k++)
        for (const sign of [-1, 1]) {
          const t = (k + 0.5) / 3,
            c = mix(a0, b, t),
            span = 0.5 * Math.sin(((j + t) / 7) * Math.PI),
            tip = [
              c[0] + sign * -Math.sin(a) * span + Math.cos(a) * 0.24,
              c[1] - 0.14,
              c[2] + sign * Math.cos(a) * span + Math.sin(a) * 0.24,
            ];
          const q = [
            [c[0] - dx * 0.06, c[1], c[2] - dz * 0.06],
            tip,
            [c[0] + dx * 0.06, c[1] + 0.025, c[2] + dz * 0.06],
          ];
          tri(out, 'foliage', q, [0.16, 0.3, 0.11]);
          tri(out, 'foliage', q.toReversed(), [0.12, 0.24, 0.08]);
        }
    }
  }
}
function terrace(out, p, y, index) {
  const ring = clockwise(p);
  mappedSolid(out, 'stone', ring, y - 0.42, y, [0.51, 0.53, 0.49]);
  // The exposed diagonal edge has the characteristic cyan bowstring truss below.
  const a = p[0],
    b = p[2];
  let last = at(a, y - 0.6);
  const n = 16;
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      q = mix(a, b, t),
      lower = [q[0], y - 0.6 - 2.9 * Math.sin(t * Math.PI), q[1]];
    beam(out, 'metal', last, lower, 0.2, 0.22, cyan);
    beam(out, 'metal', at(mix(a, b, (i - 1) / n), y - 0.55), at(q, y - 0.55), 0.22, 0.24, cyan);
    beam(out, 'metal', last, at(q, y - 0.55), 0.1, 0.12, cyan);
    if (i < n) beam(out, 'metal', lower, at(q, y - 0.55), 0.1, 0.12, cyan);
    last = lower;
  }
  for (let i = 0; i < n; i++) {
    const q = mix(a, b, i / n),
      r = mix(a, b, (i + 1) / n);
    beam(out, 'metal', at(q, y), at(q, y + 1.12), 0.055, 0.055, silver);
    beam(out, 'metal', at(q, y + 1.12), at(r, y + 1.12), 0.07, 0.07, silver);
  }
  const mid = mix(a, b, 0.5),
    c = mix(mid, p[1], 0.3),
    length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const shrubPlan = clockwise([
    mix(a, p[1], 0.13),
    mix(b, p[1], 0.13),
    mix(b, p[1], 0.31),
    mix(a, p[1], 0.31),
  ]);
  mappedSolid(out, 'stone', shrubPlan, y, y + 0.58, [0.48, 0.51, 0.47]);
  const count = Math.max(2, Math.floor(length / 1.4));
  for (let i = 0; i < count; i++) {
    const q = mix(mix(a, p[1], 0.22), mix(b, p[1], 0.22), (i + 0.5) / count);
    sphere(out, 'foliage', [q[0], y + 0.76, q[1]], [0.76, 0.48, 0.72], [0.17, 0.28, 0.12], 16, 8);
  }
  if (length > 10) {
    loft(
      out,
      'stone',
      [radialRing(y, 1.15, 1.15, 24, c), radialRing(y + 0.7, 1.25, 1.25, 24, c)],
      [0.57, 0.57, 0.51],
    );
    palm(out, c, y + 0.7, index);
  }
}
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
function helipad(out) {
  const c = [-1.5, 18],
    ring = (r, y) => radialRing(y, r, r, 144, c);
  loft(
    out,
    'metal',
    [
      ring(5.7, 226),
      ring(6.4, 227.2),
      ring(12.4, 229.5),
      ring(17.5, 232.1),
      ring(20.0, 234.9),
      ring(20, 235.72),
    ],
    silver,
    { cap: false },
  );
  // Only the main disk is filled. Its outer fall-protection annulus is real open grating.
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
  for (let i = 0; i < 72; i++) {
    const a = (i * Math.PI) / 36,
      p = (r, y) => [c[0] + r * Math.cos(a), y, c[1] + r * Math.sin(a)];
    beam(out, 'metal', p(19.9, 235.91), p(21.2, 235.91), 0.055, 0.07, edge);
    if (i % 3 === 0) {
      let prev = p(5.8, 226.2);
      for (const [r, y] of [
        [6.4, 227.1],
        [12.4, 229.3],
        [17.5, 231.9],
        [20, 234.8],
      ]) {
        const q = p(r, y);
        beam(out, 'metal', prev, q, 0.12, 0.2, edge);
        prev = q;
      }
    }
  }
  for (const r of [20.2, 20.5, 20.8, 21.2])
    torus(out, 'metal', [c[0], 235.91, c[1]], r, 0.035, edge, 144, 6);
  torus(out, 'metal', [c[0], 236.025, c[1]], 14.4, 0.075, [0.83, 0.83, 0.67], 144, 6);
  box(
    out,
    'metal',
    [c[0] - 3.6, 236.01, c[1] - 5],
    [c[0] - 2.6, 236.05, c[1] + 5],
    [0.89, 0.89, 0.75],
  );
  box(
    out,
    'metal',
    [c[0] + 2.6, 236.01, c[1] - 5],
    [c[0] + 3.6, 236.05, c[1] + 5],
    [0.89, 0.89, 0.75],
  );
  box(
    out,
    'metal',
    [c[0] - 2.6, 236.01, c[1] - 0.55],
    [c[0] + 2.6, 236.05, c[1] + 0.55],
    [0.89, 0.89, 0.75],
  );
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
export function buildTelekom(out) {
  ground(out);
  core(out);
  wing(out, upper);
  wing(out, lower);
  gardens(out);
  helipad(out);
  antenna(out);
}
export const telekomStudy = {
  id: 'N0201',
  key: 'telekom_tower',
  title: 'Telekom Tower',
  wikidataId: 'Q118214',
  height: 310,
  build: buildTelekom,
  brief:
    '310m Menara Telekom with two separately curved and tapered office wings, central core,22 planted open sky gardens, bowed cyan transfer trusses, recessed ribbon glazing with three metal sunshade blades, clad antenna sail and the236m bowl-supported helipad.',
  sourceFacts: {
    architect: 'HIJJAS',
    structuralEngineers: 'Peter Gabor and Kribanandan Gurusamy',
    heightMeters: 310,
    highestOccupiedMeters: 243,
    helipadMeters: 236,
    officeClearSpanMeters: 16,
    nominalFloors: 55,
    antennaStoreys: 21,
    skyGardens: 22,
  },
  reconstruction: {
    plan: 'Gabor/Gurusamy1997 Figure1 and Figure3 establish two opposing16m curved office strips and rectangular core; the map roof projection is retained as evidence, not extruded into an incorrect solid.',
    facade:
      'Primary HIJJAS elevation and completed photographs control the curved taper, repeated recessed glass ribbons, three projecting louver blades, ACP end walls, garden bowstrings and helipad bowl. Intermediate module dimensions are photo reconstruction.',
  },
  refs: [
    'https://www.hijjas.com/menara-telekom/',
    'https://www.hijjas.com/beginnings/',
    'https://www.skyscrapercenter.com/building/menara-tm/453',
    'https://jtkconsult.com.my/the-practice/publications-2/',
    'https://www.scribd.com/document/1062607466/KGN-Joint-Paper-Oct-Telekom-HQ-1997',
    'https://www.openstreetmap.org/way/154443873',
    'https://www.openstreetmap.org/way/594858890',
  ],
  nativeAxes: {
    up: '+Y',
    longAxis: '+X southeast in mapped envelope frame',
    shortAxis: '+Z southwest; antenna north-northwest of helipad',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Mapped anchor and signed roof frame retain real236m helipad at its mapped center. The engineer plan is rigidly registered to the mapped core/roof projection; antenna is NNW of helipad, corroborated by architect tm-img1 with KL Tower backdrop. Exact lower-wing outer feet are reconstructed because the OSM envelope follows roof boundaries. SourceY0 is the tower entrance apron.',
  }),
  limitations: [
    commonLimit,
    'Wing taper control points, facade ribbon counts, sky-garden elevations and planting, TM sign strokes, entry canopy and fine service details are exterior reconstructions from primary plans/photos. Adjacent conference pavilions, buried basements and interiors are excluded. Map roof outline does not survey the lower curved wing feet.',
  ],
  camera: { position: [-300, 204, 328], lookAt: [-7, 153, 0], fov: 42 },
  qaCameras: [
    { name: 'opposed-curved-wings', position: [250, 177, -292], lookAt: [-7, 142, 0] },
    { name: 'open-sky-gardens', position: [-90, 128, -20], lookAt: [-23, 119, 15] },
    { name: 'bowstring-garden-truss', position: [-63, 98, -8], lookAt: [-27, 91, 19] },
    { name: 'ribbon-sunshades', position: [28, 85, -95], lookAt: [10, 80, -31] },
    { name: 'helipad-bowl', position: [79, 237, 90], lookAt: [-1.5, 232, 18] },
    { name: 'helipad-open-grating', position: [28, 257, 44], lookAt: [-1.5, 236, 18] },
    { name: 'antenna-sail', position: [-109, 286, 39], lookAt: [-35, 278, -13] },
    { name: 'tall-wing-taper', position: [116, 252, -141], lookAt: [-21, 261, -17] },
    { name: 'planted-terrace', position: [-60, 82, -5], lookAt: [-24, 73, 15] },
    { name: 'ground-entrance', position: [-79, 14, 28], lookAt: [-24, 4, 10] },
    { name: 'far-bamboo-silhouette', position: [-599, 249, 608], lookAt: [-7, 156, 0] },
  ],
};
