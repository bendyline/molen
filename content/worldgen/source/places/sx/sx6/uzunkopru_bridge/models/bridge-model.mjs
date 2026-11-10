/** Uzunköprü's 164 surviving arch bays follow the mapped bend and town-side causeway. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  masonry: { slot: 'wall', graph: 'stone_ashlar' },
  cut: { slot: 'trim', graph: 'stone_limestone' },
  paving: { slot: 'foundation', graph: 'stone_ashlar' },
};
const palette = {
  stone: 'a89e88',
  side: 'b5ab93',
  shadow: '978c76',
  moss: '8b886e',
  cut: 'c0b59b',
  light: 'c9bda3',
  warm: 'b5a789',
  paving: 'a7a194',
  band: 'bab29e',
  dark: '8b8579',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((h) => {
      const v = parseInt(h, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff',
  tierOf = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const clamp = (u) => Math.max(0, Math.min(1, u)),
  lerp = (a, b, u) => a + (b - a) * u;
function value(table, s, from, to) {
  for (let i = 1; i < table.length; i++)
    if (s <= table[i][from]) {
      const a = table[i - 1],
        b = table[i];
      return lerp(a[to], b[to], clamp((s - a[from]) / (b[from] - a[from])));
    }
  return table.at(-1)[to];
}
export const deckY = (s) => value(layout.gradeFit, s, 0, 1);
export const stationX = (x) => value(layout.controls, x, 0, 2);
export const position = (s) => [value(layout.controls, s, 2, 0), value(layout.controls, s, 2, 1)];
function transverse(s) {
  const a = position(s - 3.4),
    b = position(s + 3.4),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const end = s < 4.5 ? 0 : s > layout.length - 4.5 ? 1 : null;
  if (end === null) return [-dz / length, dx / length];
  const t = clamp(1 - (end === 0 ? s : layout.length - s) / 4.5),
    target = layout.endTangents[end];
  const x = lerp(dx / length, target[0], t),
    z = lerp(dz / length, target[1], t),
    n = Math.hypot(x, z);
  return [-z / n, x / n];
}
export function bridgePoint(s, y, z = 0) {
  const p = position(s),
    n = transverse(s);
  return [p[0] + n[0] * z, y, p[1] + n[1] * z];
}
const half = (s) =>
  layout.halfWidth + 0.64 * Math.max(1 - clamp(s / 6.6), 1 - clamp((layout.length - s) / 7.0));
const cuts = (a, b) =>
  [
    a,
    ...layout.controls.map((p) => p[2]).filter((s) => s > a + 0.018 && s < b - 0.018),
    ...layout.gradeFit.map((p) => p[0]).filter((s) => s > a + 0.018 && s < b - 0.018),
    b,
  ]
    .sort((x, y) => x - y)
    .filter((s, i, v) => i === 0 || s - v[i - 1] > 0.012);

function face(out, material, color, points, wanted) {
  let n = normalFor(...points);
  if (n.reduce((s, v, i) => s + v * wanted[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (
    points.length === 4 &&
    Math.abs(n.reduce((s, v, i) => s + v * (points[3][i] - points[0][i]), 0)) > 0.000001
  ) {
    out.addTriangle(material, ref, points.slice(0, 3), n, undefined, colors[color]);
    const tail = [points[0], points[2], points[3]];
    out.addTriangle(material, ref, tail, normalFor(...tail), undefined, colors[color]);
  } else out.addConvexPolygon(material, ref, points, n, (p) => [p[0], p[2]], colors[color]);
}
const at = (s, z, d = 0) => bridgePoint(s, deckY(s) + d, z);
const sideNormal = (s, sign) => {
  const n = transverse(s);
  return [sign * n[0], 0, sign * n[1]];
};
function deckStrip(out, material, color, a, b, lo, hi, y) {
  face(
    out,
    material,
    color,
    [at(a, lo(a), y(a)), at(b, lo(b), y(b)), at(b, hi(b), y(b)), at(a, hi(a), y(a))],
    [0, 1, 0],
  );
}
function deck(out, tier) {
  const xs = [...cuts(0, layout.length), 2.1, 6.6, layout.length - 7.0, layout.length - 2.2].sort(
    (a, b) => a - b,
  );
  const floor = () => 0;
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      w = half;
    deckStrip(out, 'paving', 'paving', a, b, (s) => -w(s), w, floor);
    for (const sign of [-1, 1]) {
      const outside = (s) => sign * w(s),
        inside = (s) => sign * (w(s) - 0.37);
      const wall = (s) => 0.54 * Math.min(1, s / 2.1, (layout.length - s) / 2.2) + 0.075;
      const n = sideNormal((a + b) / 2, sign);
      face(
        out,
        'masonry',
        'band',
        [
          at(a, outside(a), -0.11),
          at(b, outside(b), -0.11),
          at(b, outside(b), wall(b)),
          at(a, outside(a), wall(a)),
        ],
        n,
      );
      if (tier) {
        face(
          out,
          'masonry',
          'side',
          [
            at(a, inside(a)),
            at(b, inside(b)),
            at(b, inside(b), wall(b)),
            at(a, inside(a), wall(a)),
          ],
          n.map((n) => -n),
        );
        deckStrip(
          out,
          'cut',
          'light',
          a,
          b,
          sign < 0 ? outside : inside,
          sign < 0 ? inside : outside,
          wall,
        );
      }
      if (tier >= 2) {
        const u = (s) => sign * (w(s) - 0.6),
          v = (s) => sign * (w(s) - 0.41);
        deckStrip(out, 'cut', 'warm', a, b, sign < 0 ? v : u, sign < 0 ? u : v, () => 0.021);
      }
    }
  }
  for (const [s, direction] of [
    [0, -1],
    [layout.length, 1],
  ]) {
    const y = deckY(s),
      w = half(s),
      n = transverse(s);
    face(
      out,
      'masonry',
      'stone',
      [
        bridgePoint(s, y - 0.55, -w),
        bridgePoint(s, y - 0.55, w),
        bridgePoint(s, y, w),
        bridgePoint(s, y, -w),
      ],
      [direction * n[1], 0, -direction * n[0]],
    );
  }
}
function bodyStrip(out, a, b, floor, material, color) {
  for (let i = 1, ss = cuts(a, b); i < ss.length; i++) {
    const s = ss[i - 1],
      t = ss[i],
      p = [s, t],
      lower = p.map(floor);
    for (const sign of [-1, 1])
      face(
        out,
        material,
        color,
        [
          bridgePoint(s, lower[0], sign * half(s)),
          bridgePoint(t, lower[1], sign * half(t)),
          at(t, sign * half(t), -0.09),
          at(s, sign * half(s), -0.09),
        ],
        sideNormal((s + t) / 2, sign),
      );
  }
}
function pierReveal(out, s, bed, y, direction) {
  const w = half(s),
    n = transverse(s);
  face(
    out,
    'masonry',
    'shadow',
    [bridgePoint(s, bed, -w), bridgePoint(s, bed, w), bridgePoint(s, y, w), bridgePoint(s, y, -w)],
    [direction * n[1], 0, -direction * n[0]],
  );
}
function opening(out, bay, tier) {
  const [a, b] = bay.open,
    N = [2, 4, 5, 9, 12][tier],
    m = (a + b) / 2,
    w = (b - a) / 2,
    fall = bay.crownDepth,
    rise = bay.rise;
  const dx = (u) => m - w * Math.cos(Math.PI * u),
    depth = (u) => fall + rise * (1 - Math.pow(Math.sin(Math.PI * u), bay.pointed ? 0.72 : 1));
  const stages = Array.from({ length: N + 1 }, (_, i) => i / N);
  for (let i = 1; i <= N; i++) {
    const u = stages[i - 1],
      v = stages[i],
      p = dx(u),
      q = dx(v),
      h = depth(u),
      j = depth(v);
    for (const side of [-1, 1]) {
      const np = sideNormal((p + q) / 2, side),
        rim = bay.section === 'river' ? 0.42 : 0.29;
      if (tier >= 2) {
        const name =
          tier === 4 && i % 5 === 0 ? 'warm' : tier === 4 && i % 3 === 0 ? 'light' : 'cut';
        face(
          out,
          'cut',
          name,
          [
            at(p, side * half(p), -h),
            at(q, side * half(q), -j),
            at(q, side * half(q), -j + rim),
            at(p, side * half(p), -h + rim),
          ],
          np,
        );
        face(
          out,
          'masonry',
          'side',
          [
            at(p, side * half(p), -h + rim),
            at(q, side * half(q), -j + rim),
            at(q, side * half(q), -0.09),
            at(p, side * half(p), -0.09),
          ],
          np,
        );
      } else
        face(
          out,
          'masonry',
          'side',
          [
            at(p, side * half(p), -h),
            at(q, side * half(q), -j),
            at(q, side * half(q), -0.09),
            at(p, side * half(p), -0.09),
          ],
          np,
        );
    }
    if (tier >= 1 || bay.section === 'river')
      face(
        out,
        'masonry',
        'shadow',
        [at(p, -half(p), -h), at(p, half(p), -h), at(q, half(q), -j), at(q, -half(q), -j)],
        [0, -1, 0],
      );
  }
  pierReveal(out, a, bay.bed, deckY(a) - depth(0), 1);
  pierReveal(out, b, bay.bed, deckY(b) - depth(1), -1);
}
function farBay(bay, tier) {
  return bay.section === 'river' || tier >= 2 || bay.index % (tier === 0 ? 7 : 2) === 0;
}
function arches(out, tier) {
  let filled = [];
  const flush = () => {
    if (!filled.length) return;
    const a = filled[0],
      b = filled.at(-1),
      floor = (s) => lerp(a.bed, b.bed, clamp((s - a.left) / (b.right - a.left)));
    bodyStrip(out, a.left, b.right, floor, 'masonry', tier === 0 ? 'shadow' : 'stone');
    filled = [];
  };
  for (const bay of layout.arches) {
    if (!farBay(bay, tier)) {
      filled.push(bay);
      continue;
    }
    flush();
    bodyStrip(out, bay.left, bay.open[0], () => bay.bed, 'masonry', 'stone');
    bodyStrip(out, bay.open[1], bay.right, () => bay.bed, 'masonry', 'stone');
    opening(out, bay, tier);
  }
  flush();
  const first = layout.arches[0],
    last = layout.arches.at(-1);
  for (const [s, bay, d] of [
    [first.left, first, -1],
    [last.right, last, 1],
  ])
    pierReveal(out, s, bay.bed, deckY(s) - 0.1, d);
}
function cutwater(out, s, side, bed, river, tier) {
  const w = half(s),
    L = river ? 1.29 : 0.57,
    span = river ? 2.03 : 0.7,
    r = river ? 0.68 : 0.44;
  const outline = [
    [s - L, side * (w - 0.1)],
    [s + L, side * (w - 0.1)],
    [s, side * (w + span)],
  ];
  const y = deckY(s) - (river ? 2.32 : 2.5),
    tip = bridgePoint(s, y + r, side * (w + 0.1));
  const lower = outline.map(([s, z]) => bridgePoint(s, bed + 0.25, z)),
    upper = outline.map(([s, z]) => bridgePoint(s, y, z));
  for (let i = 1; i < 3; i++) {
    const j = (i + 1) % 3,
      n = sideNormal(s, side);
    face(out, 'masonry', river ? 'stone' : 'shadow', [lower[i], lower[j], upper[j], upper[i]], n);
    face(out, 'cut', 'light', [upper[i], upper[j], tip], [0, 1, 0]);
  }
  if (tier === 4 && river) {
    const p = outline.map(([s, z]) => bridgePoint(s, y - 0.4, z));
    const q = outline.map(([s, z]) => bridgePoint(s, y - 0.29, z + side * 0.025));
    for (let i = 1; i < 3; i++)
      face(out, 'cut', 'warm', [p[i], p[(i + 1) % 3], q[(i + 1) % 3], q[i]], sideNormal(s, side));
  }
}
function supports(out, tier) {
  for (let i = 1; i < layout.arches.length; i++) {
    const a = layout.arches[i - 1],
      b = layout.arches[i],
      river = a.section === 'river' || b.section === 'river';
    if (!river && (tier < 2 || i % (tier === 2 ? 3 : 1) !== 0)) continue;
    const s = (a.right + b.left) / 2;
    for (const side of [-1, 1]) cutwater(out, s, side, Math.min(a.bed, b.bed), river, tier);
  }
}
function riverPlatform(out, tier) {
  if (tier < 1) return;
  const s = layout.arches[24].right,
    a = s - 2.4,
    b = s + 2.7,
    w = half(s),
    y = deckY(s) - 5.3;
  const ring = [
    [a, w - 0.31],
    [b, w - 0.31],
    [b + 1.34, w + 3.2],
    [a - 0.58, w + 3.2],
  ];
  const top = ring.map(([s, z]) => bridgePoint(s, y, z));
  face(out, 'cut', 'warm', top, [0, 1, 0]);
  for (let i = 1; i < 4; i++) {
    const j = (i + 1) % 4,
      q = ring[i],
      r = ring[j];
    const d = [top[j][0] - top[i][0], top[j][2] - top[i][2]];
    face(
      out,
      'masonry',
      'moss',
      [bridgePoint(q[0], y - 1.7, q[1]), bridgePoint(r[0], y - 1.7, r[1]), top[j], top[i]],
      [d[1], 0, -d[0]],
    );
  }
}
export function buildBridgeLevel(out, level = 'master') {
  const tier = tierOf[level];
  if (tier === undefined) throw Error(`Unknown Uzunkopru level ${level}`);
  deck(out, tier);
  arches(out, tier);
  supports(out, tier);
  riverPlatform(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
