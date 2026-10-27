/** Original photo-based Delal exterior. Five visible openings, not a generic bridge kit. */
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const delalControls = {
  width: 4.7,
  originMeters: 435.1,
  waterY: 1.2719482421875,
  route: [
    [-44.00513921038168, -6.625452747663273],
    [8.925914693978044, -7.118722752986502],
    [77.06082310517507, -6.625452747663256],
  ],
  // Standard-terrain endpoint levels with the native paving lift; central profile is photo-based.
  profile: [
    [-44.00513921038168, 6.46445564803613],
    [-32, 7.05],
    [-14, 10.1],
    [9.5, 13.6],
    [21, 12.7],
    [52, 8.1],
    [77.06082310517507, 6.0639240801689],
  ],
  // x/radius/spring/rise. Pictures determine the asymmetric sequence; dimensions are reconstructed.
  openings: [
    { id: 'south-bank-small', cx: -38.0, r: 2.5, spring: 2.2, rise: 2.0, point: 0.12 },
    { id: 'south-small', cx: -29.3, r: 5.2, spring: 1.5, rise: 4.05, point: 0.1 },
    { id: 'south-water-arch', cx: -13.8, r: 9.6, spring: 1.1, rise: 7.25, point: 0.12 },
    { id: 'main-pointed-arch', cx: 10, r: 12, spring: 0.85, rise: 11.25, point: 0.28 },
    { id: 'north-bank-arch', cx: 53, r: 6.8, spring: 1.6, rise: 4.5, point: 0.08 },
  ],
};
export const delalSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
  raw: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 1, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_drywall', roughness: 1, metallic: 0 },
};
const C = delalControls,
  lo = C.route[0][0],
  hi = C.route.at(-1)[0],
  linear = (hex) =>
    hex.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  colors = {
    stone: linear('b9a786'),
    rim: linear('c4b396'),
    base: linear('8e8c7e'),
    paving: linear('b9ae95'),
  };
export const delalExtent = [lo, hi];
export function delalDeckY(x) {
  for (let i = 1; i < C.profile.length; i++) {
    const a = C.profile[i - 1],
      b = C.profile[i];
    if (x <= b[0]) {
      const t = Math.max(0, (x - a[0]) / (b[0] - a[0]));
      return a[1] + t * (b[1] - a[1]);
    }
  }
  return C.profile.at(-1)[1];
}
export function delalPathZ(x) {
  for (let i = 1; i < C.route.length; i++) {
    const a = C.route[i - 1],
      b = C.route[i];
    if (x <= b[0]) return a[1] + Math.max(0, (x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return C.route.at(-1)[1];
}
// Small, explicit source thresholds fitted to the unchanged standard footway mesh. The
// south path bends at the bridge end; its crossfall cannot use the straight deck profile.
export function delalWalkY(x, z) {
  let y = delalDeckY(x) + 0.025;
  if (x < lo + 3) {
    const weight = Math.min(1, Math.max(0, (lo + 3 - x) / 3));
    y +=
      weight *
      (0.048 + Math.max(0, lo - x) * 0.145 + Math.max(0, -z) * 0.125 - Math.max(0, z) * 0.015);
  }
  if (x > hi) y += (x - hi) * 0.088;
  return y;
}
export function delalCrown(h, x, extra = 0) {
  const r = h.r + extra,
    d = h.r * h.point,
    q = Math.min(r, Math.abs(x - h.cx));
  return (
    h.spring +
    ((h.rise + extra) * Math.sqrt(Math.max(0, (r + d) ** 2 - (q + d) ** 2))) /
      Math.sqrt(r * r + 2 * r * d)
  );
}
const configs = {
  skyline: { curve: 5, parapet: 0, rims: 0, walk: 0, rock: 4 },
  district: { curve: 10, parapet: 0, rims: 8, walk: 0, rock: 5 },
  street: { curve: 24, parapet: 2.4, rims: 20, walk: 0, rock: 7 },
  closeup: { curve: 40, parapet: 1.1, rims: 32, walk: 0.8, rock: 9 },
  master: { curve: 72, parapet: 0.7, rims: 48, walk: 0.48, rock: 12 },
};
function writer(out, far) {
  const emit = (component, _ref, points, _normal, _uv, tint) => {
    const p = points.map(([x, y, z]) => [x, y, z + delalPathZ(x)].map(Math.fround));
    for (let i = 1; i + 1 < p.length; i++) {
      const tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      out.addTriangle(
        far ? 'far' : component,
        'metric:uv',
        tri,
        n,
        [points[0], points[i], points[i + 1]].map((q) => [
          q[0],
          Math.abs(n[1]) > 0.7 ? q[2] : q[1],
        ]),
        far ? tint.map((v, j) => v * [0.72, 0.69, 0.62][j]) : tint,
      );
    }
  };
  return Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit]));
}
function face(out, slot, p, tint) {
  out.addConvexPolygon(slot, 'metric:uv', p, normalFor(p[0], p[1], p[2]), [], tint);
}
function openingAt(x) {
  return C.openings.find((h) => x > h.cx - h.r - 1e-8 && x < h.cx + h.r + 1e-8);
}
function core(out, cfg) {
  const stations = new Set([lo, hi, ...C.profile.map((p) => p[0])]);
  for (const h of C.openings)
    for (let i = 0; i <= cfg.curve; i++)
      stations.add(h.cx - h.r * Math.cos((Math.PI * i) / cfg.curve));
  const xs = [...stations].sort((a, b) => a - b),
    w = C.width / 2;
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      h = openingAt((a + b) / 2),
      A = h ? delalCrown(h, a) : 0,
      B = h ? delalCrown(h, b) : 0,
      ta = delalDeckY(a),
      tb = delalDeckY(b);
    if (!(ta > A && tb > B))
      throw Error('Arch exceeds deck ' + JSON.stringify({ a, b, A, B, ta, tb }));
    for (const sign of [-1, 1]) {
      const p = [
        [a, A, sign * w],
        [b, B, sign * w],
        [b, tb, sign * w],
        [a, ta, sign * w],
      ];
      face(out, 'stone', sign > 0 ? p : p.toReversed(), colors.stone);
    }
    face(
      out,
      'stone',
      [
        [a, ta, -w],
        [a, ta, w],
        [b, tb, w],
        [b, tb, -w],
      ],
      colors.stone,
    );
    face(
      out,
      h ? 'raw' : 'stone',
      [
        [a, A, -w],
        [b, B, -w],
        [b, B, w],
        [a, A, w],
      ],
      h ? colors.rim : colors.base,
    );
  }
  for (const [x, reverse] of [
    [lo, false],
    [hi, true],
  ]) {
    const p = [
      [x, 0, -w],
      [x, 0, w],
      [x, delalDeckY(x), w],
      [x, delalDeckY(x), -w],
    ];
    face(out, 'stone', reverse ? p.toReversed() : p, colors.stone);
  }
}
function parapets(out, cfg) {
  const width = C.width / 2;
  let xs = cfg.parapet
    ? Array.from({ length: Math.ceil((hi - lo) / cfg.parapet) + 1 }, (_, i) =>
        Math.min(hi, lo + i * cfg.parapet),
      )
    : C.profile.map((p) => p[0]);
  if (xs.at(-1) !== hi) xs.push(hi);
  xs = [...new Set([...xs, ...C.profile.map((p) => p[0])])].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      h = 0.58 + (cfg.parapet ? Math.sin(i * 2.37) * 0.045 : 0);
    for (const sign of [-1, 1]) {
      const z0 = sign * (width - 0.43),
        z1 = sign * width,
        ring = (x) => {
          const y = delalDeckY(x);
          return [
            [x, y, z0],
            [x, y, z1],
            [x, y + h, z1],
            [x, y + h, z0],
          ];
        },
        A = ring(a),
        B = ring(b);
      for (let k = 0; k < 4; k++) {
        const p = [A[k], B[k], B[(k + 1) % 4], A[(k + 1) % 4]];
        face(out, 'stone', sign < 0 ? p.toReversed() : p, colors.stone);
      }
      if (cfg.parapet) {
        face(out, 'raw', sign > 0 ? A : A.toReversed(), colors.rim);
        face(out, 'raw', sign > 0 ? B.toReversed() : B, colors.rim);
      }
    }
  }
}
function rims(out, cfg) {
  if (!cfg.rims) return;
  for (const h of C.openings)
    for (let i = 0; i < cfg.rims; i++) {
      const a = h.cx - h.r * Math.cos((Math.PI * i) / cfg.rims),
        b = h.cx - h.r * Math.cos((Math.PI * (i + 0.96)) / cfg.rims),
        e = 0.52;
      for (const sign of [-1, 1]) {
        const z = sign * (C.width / 2 + 0.018),
          p = [
            [a, delalCrown(h, a), z],
            [b, delalCrown(h, b), z],
            [b, delalCrown(h, b, e), z],
            [a, delalCrown(h, a, e), z],
          ];
        face(out, 'raw', sign > 0 ? p : p.toReversed(), colors.rim);
      }
    }
}
function paving(out, cfg) {
  const w = C.width / 2 - 0.44;
  let xs = cfg.walk
    ? Array.from({ length: Math.ceil((hi - lo) / cfg.walk) + 1 }, (_, i) =>
        Math.min(hi, lo + i * cfg.walk),
      )
    : C.profile.map((p) => p[0]);
  xs = [...new Set([...xs, lo - 0.75, lo, lo + 3, hi, hi + 0.75])].sort((a, b) => a - b);
  const columns = cfg.walk ? 6 : 4;
  for (let i = 1; i < xs.length; i++)
    for (let k = 0; k < columns; k++) {
      const a = xs[i - 1] + (cfg.walk ? 0.014 : 0),
        b = xs[i] - (cfg.walk ? 0.014 : 0);
      if (b <= a) continue;
      const z0 = -w + (2 * w * k) / columns + (cfg.walk ? 0.012 : 0),
        z1 = -w + (2 * w * (k + 1)) / columns - (cfg.walk ? 0.012 : 0),
        bump = cfg.walk && a > lo + 3 && b < hi ? Math.sin(i * 7 + k * 3) * 0.008 : 0;
      face(
        out,
        'paving',
        [
          [a, delalWalkY(a, z0) + bump, z0],
          [a, delalWalkY(a, z1) + bump, z1],
          [b, delalWalkY(b, z1) + bump, z1],
          [b, delalWalkY(b, z0) + bump, z0],
        ],
        colors.paving,
      );
    }
}
function pierBeds(out, cfg) {
  const boundaries = [lo, ...C.openings.flatMap((h) => [h.cx - h.r, h.cx + h.r]), hi].sort(
      (a, b) => a - b,
    ),
    spans = [];
  for (let i = 1; i < boundaries.length; i++)
    if (!openingAt((boundaries[i - 1] + boundaries[i]) / 2))
      spans.push([boundaries[i - 1], boundaries[i]]);
  for (let j = 0; j < spans.length; j++) {
    const [a, b] = spans[j],
      cx = (a + b) / 2,
      r = Math.min(4, (b - a) / 2 + 0.8);
    if (b - a > 15) continue;
    const ring = (y, scale) =>
        Array.from({ length: cfg.rock }, (_, i) => {
          const ang = (-i * 2 * Math.PI) / cfg.rock,
            s = 1 + 0.09 * Math.sin(i * 3.1 + j);
          return [
            cx + Math.cos(ang) * r * scale * s,
            y,
            Math.sin(ang) * (C.width / 2 + 1.0) * scale * s,
          ];
        }),
      A = ring(0.1, 1.1),
      B = ring(1.55, 0.8),
      center = [cx, 2.0, 0];
    for (let i = 0; i < A.length; i++) {
      const k = (i + 1) % A.length;
      face(out, 'raw', [A[i], A[k], B[k], B[i]], colors.base);
      face(out, 'raw', [B[i], B[k], center], colors.base);
    }
  }
}
function channelBeds(out) {
  for (const h of C.openings) {
    const a = h.cx - h.r + 0.01,
      b = h.cx + h.r - 0.01,
      y = C.waterY - 0.18;
    face(
      out,
      'raw',
      [
        [a, y, -8],
        [a, y, 8],
        [b, y, 8],
        [b, y, -8],
      ],
      colors.base,
    );
  }
}
function thresholdBase(out) {
  const w = C.width / 2 - 0.44,
    zs = [-w, -1, 0, 1, w];
  for (const xs of [
    [lo - 0.75, lo, lo + 3],
    [hi, hi + 0.75],
  ])
    for (let i = 1; i < xs.length; i++)
      for (let k = 1; k < zs.length; k++) {
        const a = xs[i - 1],
          b = xs[i],
          u = zs[k - 1],
          v = zs[k];
        face(
          out,
          'paving',
          [
            [a, delalWalkY(a, u) - 0.012, u],
            [a, delalWalkY(a, v) - 0.012, v],
            [b, delalWalkY(b, v) - 0.012, v],
            [b, delalWalkY(b, u) - 0.012, u],
          ],
          colors.paving,
        );
      }
}
export function buildDelalLevel(target, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw Error('Unknown Delal level ' + level);
  const out = writer(target, level === 'skyline');
  core(out, cfg);
  parapets(out, cfg);
  rims(out, cfg);
  paving(out, cfg);
  thresholdBase(out);
  pierBeds(out, cfg);
  channelBeds(out);
}
export const buildDelalSkyline = (out) => buildDelalLevel(out, 'skyline');
export const buildDelalDistrict = (out) => buildDelalLevel(out, 'district');
export const buildDelalStreet = (out) => buildDelalLevel(out, 'street');
export const buildDelalCloseup = (out) => buildDelalLevel(out, 'closeup');
