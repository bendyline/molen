/** Browser exterior and reconstructed rock supports; the detailed original remains separate. */
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildMesBridge, mesStudy } from './mes-bridge-model.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(readFileSync(structureSourcePath('n0011_mes_bridge', 'map-frame.json')));
const relief = JSON.parse(
  readFileSync(structureSourcePath('n0011_mes_bridge', 'terrain-grid.json')),
);
const surfaceMeans = JSON.parse(
  readFileSync(structureSourcePath('n0011_mes_bridge', 'surface-means.json')),
);
const { arches, deckProfile, baseProfile } = mesStudy.reconstruction;
const grey = [0.57, 0.568, 0.517],
  pale = [0.69, 0.679, 0.605];
const means = surfaceMeans;
export const mesCurrentSurfaces = {
  roughstone: { graph: 'stone_drywall', slot: 'foundation', roughness: 0.98, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'wall', roughness: 0.9, metallic: 0 },
  paving: { graph: 'stone_drywall', slot: 'wall', roughness: 0.98, metallic: 0 },
};
function profile(points, x) {
  for (let i = 1; i < points.length; i++)
    if (x <= points[i][0]) {
      const a = points[i - 1],
        b = points[i],
        t = Math.max(0, (x - a[0]) / (b[0] - a[0]));
      return a[1] + (b[1] - a[1]) * t;
    }
  return points.at(-1)[1];
}
const center = (x) => profile(frame.centerline, x);
export function mesDeckDelta(x) {
  if (x < -54) return Math.min(1, (-54 - x) / 8.361) * (relief.reconstruction.westOuterDeck - 7.75);
  if (x > 54) return Math.min(1, (x - 54) / 8.361) * (relief.reconstruction.eastOuterDeck - 7.45);
  return 0;
}
const deck = (x) => profile(deckProfile, x) + mesDeckDelta(x),
  base = (x) => profile(baseProfile, x) + mesDeckDelta(x);
export function mesGround(x, z) {
  const xx = Math.max(0, Math.min(127.999999, (x - relief.origin[0]) / relief.step)),
    zz = Math.max(0, Math.min(127.999999, (z - relief.origin[1]) / relief.step));
  const ix = Math.floor(xx),
    iz = Math.floor(zz),
    tx = xx - ix,
    tz = zz - iz;
  const h = (a, b) => relief.heights[b * 129 + a] - relief.datum;
  return (
    (h(ix, iz) * (1 - tx) + h(ix + 1, iz) * tx) * (1 - tz) +
    (h(ix, iz + 1) * (1 - tx) + h(ix + 1, iz + 1) * tx) * tz
  );
}
function quad(out, component, points, color, flat) {
  const p = points.toReversed();
  for (const indices of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    const triangle = indices.map((i) => p[i]);
    out.addTriangle(
      flat ? 'flat' : component,
      'palette:#ffffff',
      triangle,
      normalFor(...triangle),
      triangle.map((p) => [p[0], p[2]]),
      flat ? color.map((v, i) => v * means[component][i]) : color,
    );
  }
}
// Join adjacent strips without invisible cross-section faces. Top can be omitted under paving.
function strip(out, a, b, lowA, lowB, highA, highB, za, zb, component, color, flat, top = true) {
  if (b - a < 1e-7 || Math.max(highA - lowA, highB - lowB) < 1e-7) return;
  const p = (x, y, z) => [x, y, center(x) + z];
  quad(
    out,
    component,
    [p(a, lowA, za), p(b, lowB, za), p(b, highB, za), p(a, highA, za)],
    color,
    flat,
  );
  quad(
    out,
    component,
    [p(a, lowA, zb), p(a, highA, zb), p(b, highB, zb), p(b, lowB, zb)],
    color,
    flat,
  );
  quad(
    out,
    component,
    [p(a, lowA, za), p(a, lowA, zb), p(b, lowB, zb), p(b, lowB, za)],
    color,
    flat,
  );
  if (top)
    quad(
      out,
      component,
      [p(a, highA, za), p(b, highB, za), p(b, highB, zb), p(a, highA, zb)],
      color,
      flat,
    );
}
function archPoint(a, t, extra = 0) {
  const half = a.span / 2 + extra,
    rise = a.rise + extra,
    x = -half * Math.cos(Math.PI * t);
  const radius = (half * half + rise * rise) / (2 * half);
  return [
    a.x + x,
    a.spring +
      (a.pointed
        ? Math.sqrt(Math.max(0, radius * radius - Math.pow(Math.abs(x) + radius - half, 2)))
        : rise * Math.sin(Math.PI * t)),
  ];
}
function band(out, a, n, flat) {
  for (let i = 0; i < n; i++) {
    const p = archPoint(a, i / n),
      q = archPoint(a, (i + 1) / n),
      r = archPoint(a, (i + 1) / n, a.ring),
      s = archPoint(a, i / n, a.ring);
    for (const side of [-1, 1]) {
      const points = [p, q, r, s].map(([x, y]) => [x, y, center(x) + side * 1.725]);
      if (side > 0) points.reverse();
      quad(out, 'stone', points, pale, flat);
      if (a.span === 21.5) {
        const stripe = [
          archPoint(a, i / n, a.ring * 0.71),
          archPoint(a, (i + 1) / n, a.ring * 0.71),
          archPoint(a, (i + 1) / n, a.ring * 0.8),
          archPoint(a, i / n, a.ring * 0.8),
        ].map(([x, y]) => [x, y, center(x) + side * 1.75]);
        if (side > 0) stripe.reverse();
        quad(out, 'stone', stripe, grey, flat);
      }
    }
  }
}
/** Rock tops follow the original photo-scaled support profile, not a measured DTM. */
function banks(out, flat) {
  for (const [left, right] of [
    [-62.361, -17.15],
    [4.35, 62.361],
  ]) {
    const stops = [
      left,
      ...baseProfile.map((p) => p[0]).filter((x) => x > left && x < right),
      right,
    ];
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1],
        b = stops[i],
        ya = base(a) + 0.04,
        yb = base(b) + 0.04;
      // Faceted shoulders extend from the bridge foot to the common riverbed datum.
      for (const side of [-1, 1]) {
        const inside = side * 1.66,
          outside = side * 5.6;
        const p = [
          [a, ya, center(a) + inside],
          [b, yb, center(b) + inside],
          [b, mesGround(b, center(b) + outside) - 0.03, center(b) + outside],
          [a, mesGround(a, center(a) + outside) - 0.03, center(a) + outside],
        ];
        if (side < 0) p.reverse();
        quad(out, 'roughstone', p, [0.52, 0.52, 0.47], flat);
      }
      strip(
        out,
        a,
        b,
        Math.min(mesGround(a, center(a)) - 0.25, ya - 0.25),
        Math.min(mesGround(b, center(b)) - 0.25, yb - 0.25),
        ya,
        yb,
        -1.66,
        1.66,
        'roughstone',
        [0.5, 0.5, 0.45],
        flat,
      );
    }
    for (const x of [left, right]) {
      const y = base(x) + 0.04,
        w = 5.6;
      const top = [
        [-w, mesGround(x, center(x) - w) - 0.03],
        [-1.66, y],
        [1.66, y],
        [w, mesGround(x, center(x) + w) - 0.03],
      ];
      const bottom = Math.min(...top.map((p) => p[1])) - 0.25;
      for (let i = 1; i < top.length; i++) {
        const [za, ya] = top[i - 1],
          [zb, yb] = top[i];
        const points = [
          [x, bottom, center(x) + za],
          [x, ya, center(x) + za],
          [x, yb, center(x) + zb],
          [x, bottom, center(x) + zb],
        ];
        if (x === right) points.reverse();
        quad(out, 'roughstone', points, [0.52, 0.52, 0.47], flat);
      }
    }
  }
}
export function buildMesCurrent(out) {
  const map = (points) => points.map(([x, y, z]) => [x, y + mesDeckDelta(x), z].map(Math.fround));
  buildMesBridge({
    addTriangle(slot, ref, points, _normal, uv, color) {
      const p = map(points);
      out.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
    addQuad(slot, ref, points, _normal, uv, color) {
      const p = map(points);
      out.addQuad(slot, ref, p, normalFor(...p), uv, color);
    },
    addConvexPolygon(slot, ref, points, _normal, uv, color) {
      const p = map(points);
      out.addConvexPolygon(slot, ref, p, normalFor(...p), uv, color);
    },
  });
  banks(out, false);
}
function buildBrowser(
  out,
  { flat = false, segments = 10, mainSegments = 24, bands = true, steps = false } = {},
) {
  const first = -62.361,
    last = 62.361;
  const edges = [first, ...arches.flatMap((a) => [a.x - a.span / 2, a.x + a.span / 2]), last];
  for (let i = 0; i < edges.length - 1; i += 2) {
    const left = edges[i],
      right = edges[i + 1],
      stops = [
        left,
        ...baseProfile.map((p) => p[0]).filter((x) => x > left && x < right),
        ...deckProfile.map((p) => p[0]).filter((x) => x > left && x < right),
        right,
      ].sort((a, b) => a - b);
    for (let j = 1; j < stops.length; j++)
      strip(
        out,
        stops[j - 1],
        stops[j],
        base(stops[j - 1]),
        base(stops[j]),
        deck(stops[j - 1]) - 0.04,
        deck(stops[j]) - 0.04,
        -1.68,
        1.68,
        'roughstone',
        grey,
        flat,
        false,
      );
  }
  for (const [index, a] of arches.entries()) {
    const n = index === 5 ? mainSegments : segments;
    for (let i = 0; i < n; i++) {
      const [x, y] = archPoint(a, i / n),
        [xx, yy] = archPoint(a, (i + 1) / n);
      strip(
        out,
        x,
        xx,
        y,
        yy,
        deck(x) - 0.04,
        deck(xx) - 0.04,
        -1.68,
        1.68,
        'roughstone',
        grey,
        flat,
        false,
      );
      if (a.bottom > Math.max(base(x), base(xx)) + 0.05)
        strip(
          out,
          x,
          xx,
          base(x),
          base(xx),
          a.bottom,
          a.bottom,
          -1.68,
          1.68,
          'roughstone',
          grey,
          flat,
        );
    }
    if (bands) band(out, a, n, flat);
  }
  const stops = [
    ...new Set([
      first,
      last,
      ...deckProfile.map((p) => p[0]),
      ...(flat ? [-21.506] : frame.centerline.map((p) => p[0])),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1],
      b = stops[i];
    strip(
      out,
      a,
      b,
      deck(a) - 0.13,
      deck(b) - 0.13,
      deck(a),
      deck(b),
      -1.7,
      1.7,
      'paving',
      pale,
      flat,
    );
    for (const side of [-1, 1])
      strip(
        out,
        a,
        b,
        deck(a),
        deck(b),
        deck(a) + 0.64,
        deck(b) + 0.64,
        side < 0 ? -1.71 : 1.27,
        side < 0 ? -1.27 : 1.71,
        'roughstone',
        grey,
        flat,
      );
  }
  for (const x of [first, last])
    for (const [za, zb, low, high] of [
      [-1.68, 1.68, base(x), deck(x)],
      [-1.71, -1.27, deck(x), deck(x) + 0.64],
      [1.27, 1.71, deck(x), deck(x) + 0.64],
    ]) {
      const points = [
        [x, low, center(x) + za],
        [x, high, center(x) + za],
        [x, high, center(x) + zb],
        [x, low, center(x) + zb],
      ];
      if (x === last) points.reverse();
      quad(out, 'roughstone', points, grey, flat);
    }
  if (steps)
    for (let x = -25; x < 13; x += 1.08)
      strip(
        out,
        x,
        x + 0.105,
        deck(x),
        deck(x + 0.105),
        deck(x) + 0.085,
        deck(x + 0.105) + 0.085,
        -1.2,
        1.2,
        'paving',
        pale,
        false,
      );
  banks(out, flat);
}
export const buildMesSkyline = (out) =>
  buildBrowser(out, { flat: true, segments: 2, mainSegments: 6, bands: false });
export const buildMesDistrict = (out) => buildBrowser(out, { segments: 6, mainSegments: 16 });
export const buildMesStreet = (out) =>
  buildBrowser(out, { segments: 12, mainSegments: 32, steps: true });
export const buildMesCloseup = (out) =>
  buildBrowser(out, { segments: 20, mainSegments: 48, steps: true });
