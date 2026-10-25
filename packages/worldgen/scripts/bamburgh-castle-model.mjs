/** Bamburgh's mapped keep, palace, two bailey levels, gateways and western windmill. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/gc/gcy/bamburgh_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const palette = {
  stone: '#c9ab84',
  trim: '#e0cfb1',
  rock: '#b7aa91',
  paving: '#b4ada0',
  roof: '#657079',
  metal: '#737c70',
  windmill: '#e6dcc1',
  glass: '#4d6178',
  lawn: '#8aa065',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const court = frame.reconstruction.innerCourtY;
const part = (id, i = 0) =>
  frame.reconstruction.components.find((f) => f.id === id).polygons[i].outline;
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const unit = (v) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const center = (r) =>
  [0, 1].map((k) => (Math.min(...r.map((p) => p[k])) + Math.max(...r.map((p) => p[k]))) / 2);
const rectangle = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
    p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
  ]);
export function bamburghGround(x, z) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Bamburgh footing outside retained standard DEM');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, detail) {
  return (slot, polygon, direction) => {
    let p = polygon.map((v) => v.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((n, v, i) => n + v * direction[i], 0) < 0)
      p = p.toReversed();
    const color = detail === 0 ? colors[slot].map((v, i) => v * means[slot][i]) : colors[slot];
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function cap(face, r, y, s, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const hole of holes) {
    starts.push(offset);
    offset += hole.length;
  }
  const indices = earcut(p.flat(), starts, 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      s,
      indices.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, s, inward = false) {
  const sign =
    Math.sign(
      r.reduce((sum, a, i) => {
        const q = r[(i + 1) % r.length];
        return sum + a[0] * q[1] - q[0] * a[1];
      }, 0),
    ) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      q = r[(i + 1) % r.length];
    face(
      s,
      [at(a, b), at(q, b), at(q, t), at(a, t)],
      [(q[1] - a[1]) * sign, 0, (a[0] - q[0]) * sign],
    );
  }
}
function solid(face, r, b, t, s = 'stone', holes = []) {
  sides(face, r, b, t, s);
  for (const h of holes) sides(face, h, b, t, s, true);
  cap(face, r, t, s, holes);
}
function masonry(out, d, r, b, t, holes = [], topSurface = 'stone') {
  const hs = holes.map((h) => prepareOpening(h, 0, d));
  const face = writer(openingBuilder(out, hs), d);
  sides(face, r, b, t, 'stone');
  cap(face, r, t, topSurface);
  const target = {
    addTriangle(slot, ref, p, n, uv, c) {
      out.addTriangle(slot === 'rubble' ? 'stone' : slot, ref, p, n, uv, c);
    },
  };
  openingReveals(
    target,
    r,
    (p) => (typeof b === 'function' ? b(p) : b),
    (p) => (typeof t === 'function' ? t(p) : t),
    hs,
    colors.stone,
  );
}
function band(face, a, b, w, y, s = 'paving', depth = 0) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    r = [
      a.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v + (n[k] * w) / 2),
      a.map((v, k) => v + (n[k] * w) / 2),
    ];
  if (depth) solid(face, r, (p) => (typeof y === 'function' ? y(p) : y) - depth, y, s);
  else cap(face, r, y, s);
}
function clip(r, k, value, positive) {
  const result = [];
  let a = r.at(-1),
    av = (a[k] - value) * (positive ? 1 : -1);
  for (const b of r) {
    const bv = (b[k] - value) * (positive ? 1 : -1);
    if (av >= 0 !== bv >= 0) result.push(lerp(a, b, av / (av - bv)));
    if (bv >= 0) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function slicedRoof(face, r, k, ridge, eave, rise, halfWidth) {
  const breaks = [-Infinity, ridge - halfWidth, ridge, ridge + halfWidth, Infinity];
  for (let j = 1; j < breaks.length; j++) {
    let p = r;
    if (Number.isFinite(breaks[j - 1])) p = clip(p, k, breaks[j - 1], true);
    if (p.length && Number.isFinite(breaks[j])) p = clip(p, k, breaks[j], false);
    if (p.length >= 3)
      cap(
        face,
        p,
        (q) => eave + Math.max(0, 1 - Math.abs(q[k] - ridge) / halfWidth) * rise,
        'roof',
      );
  }
}
function crown(face, r, y, d, spacing = 3.4) {
  if (d === 0) return;
  if (d === 1 && r.length > 4) {
    solid(face, r, y, y + 0.8, 'trim');
    return;
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(...b.map((v, k) => v - a[k]));
    band(face, a, b, 0.7, y + 0.8, 'trim', 0.8);
    const n = Math.max(1, Math.floor(len / (d === 1 ? spacing * 2 : spacing)));
    for (let j = 0; j < n; j++)
      band(face, lerp(a, b, j / n), lerp(a, b, (j + 0.48) / n), 0.72, y + 1.65, 'trim', 0.85);
  }
}
function window(face, d, a, b, u, y, w, h, { arch = false, paired = false } = {}) {
  const axis = unit(b.map((v, k) => v - a[k])),
    normal = [axis[1], -axis[0]],
    m = lerp(a, b, u),
    pane = openingShape(
      { width: w, bottom: y, height: h, spring: h * 0.69, shape: arch ? 'round' : 'rectangle' },
      d,
    );
  const point = (p, offset) => [
    m[0] + axis[0] * p[0] + normal[0] * offset,
    p[1],
    m[1] + axis[1] * p[0] + normal[1] * offset,
  ];
  face(
    'glass',
    pane.map((p) => point(p, 0.11)),
    [normal[0], 0, normal[1]],
  );
  if (d >= 2) {
    const outer = pane.map((p) => [(p[0] * (w + 1)) / w, y - 0.5 + ((p[1] - y) * (h + 1)) / h]);
    for (let i = 0; i < pane.length; i++) {
      const k = (i + 1) % pane.length;
      face(
        'trim',
        [point(pane[i], 0.14), point(pane[k], 0.14), point(outer[k], 0.14), point(outer[i], 0.14)],
        [normal[0], 0, normal[1]],
      );
    }
    if (paired || d >= 3) {
      face(
        'metal',
        [
          [m[0] - 0.22 * axis[0] + normal[0] * 0.16, y, m[1] - 0.22 * axis[1] + normal[1] * 0.16],
          [m[0] + 0.22 * axis[0] + normal[0] * 0.16, y, m[1] + 0.22 * axis[1] + normal[1] * 0.16],
          [
            m[0] + 0.22 * axis[0] + normal[0] * 0.16,
            y + h,
            m[1] + 0.22 * axis[1] + normal[1] * 0.16,
          ],
          [
            m[0] - 0.22 * axis[0] + normal[0] * 0.16,
            y + h,
            m[1] - 0.22 * axis[1] + normal[1] * 0.16,
          ],
        ],
        [normal[0], 0, normal[1]],
      );
    }
  }
}
function facade(face, d, r, base, top, { arch = false, step = 5.6, rows = 2 } = {}) {
  if (d === 0) return;
  // Make exterior normals independent of the map ring winding.
  let plan = r;
  const signed = r.reduce((n, a, i) => {
    const b = r[(i + 1) % r.length];
    return n + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (signed < 0) plan = r.toReversed();
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      len = Math.hypot(...b.map((v, k) => v - a[k]));
    if (len < 5.1) continue;
    const count = Math.max(1, Math.floor(len / (d === 1 ? step * 1.7 : step)));
    for (let j = 0; j < count; j++)
      for (let row = 0; row < rows; row++)
        window(
          face,
          d,
          a,
          b,
          (j + 0.5) / count,
          base + 3.2 + (row * (top - base - 5.5)) / Math.max(1, rows - 1),
          arch ? 1.75 : 1.6,
          arch ? 2.7 : 2.3,
          { arch },
        );
  }
}
const lowerGate = {
  name: 'lower-west-gate',
  center: [-53.8, 29.5],
  axis: [-0.917, -0.396],
  width: 4.2,
  height: 4.8,
  spring: 3,
  bottom: -10.5,
  depth: 15,
  shape: 'round',
};
const upperGate = {
  name: 'north-upper-passage',
  center: [21.2, -22],
  axis: [0.81, -0.59],
  width: 4.5,
  height: 4.9,
  spring: 3.2,
  bottom: court,
  depth: 30,
  shape: 'round',
};
const eastGate = {
  name: 'northeast-passage',
  center: [114.8, -32.5],
  axis: [0.88, 0.47],
  width: 3.4,
  height: 4.5,
  spring: 2.8,
  bottom: court,
  depth: 30,
  shape: 'round',
};
const keepDoor = {
  name: 'keep-west-door',
  center: [26.7, 20.8],
  axis: [0, 1],
  width: 2.9,
  height: 3.9,
  spring: 2.5,
  bottom: court,
  depth: 9,
  shape: 'round',
};
export const bamburghApertures = [lowerGate, upperGate, eastGate, keepDoor];
const base = (p) => Math.min(court, bamburghGround(...p) - 0.35);
const forecourt = (p) => -9.5 + ((Math.max(-62, Math.min(10, p[0])) + 62) / 72) * (court + 9.5);
function platforms(out, d) {
  const face = writer(openingBuilder(out, d ? [prepareOpening(lowerGate, 0, d)] : []), d);
  // Open courtyards stay open; the cap supplies an approximate terrace above the coarse DEM.
  const r = frame.geometry.outline;
  const inner = clip(r, 0, 10, true),
    fore = clip(clip(r, 0, -62, true), 0, 10, false);
  sides(face, inner, (p) => Math.min(court - 0.7, bamburghGround(...p) - 0.4), court, 'rock');
  cap(face, inner, court, 'lawn');
  sides(
    face,
    fore,
    (p) => Math.min(forecourt(p) - 0.6, bamburghGround(...p) - 0.4),
    forecourt,
    'rock',
  );
  cap(face, fore, forecourt, 'lawn');
  if (d >= 1) {
    band(face, [-54, 21], [8, -1], 5.1, (p) => forecourt(p) + 0.075);
    band(face, [11, 0], [100, 0], 5.1, court + 0.08);
    band(face, [100, 0], [118, -21], 4.7, court + 0.08);
    band(face, [12, 2], [23, 18], 3.4, court + 0.09);
    band(face, [48, 18], [97, 7], 3.2, court + 0.09);
    const landing = writer(out, d);
    band(landing, [-56.7, 36.2], [-50.9, 22.8], 4.2, -10.55, 'paving', 0.6);
    const a = [-50.9, 22.8],
      b = [-44.5, 14],
      length = Math.hypot(...b.map((v, k) => v - a[k])),
      u = unit(b.map((v, k) => v - a[k]));
    const rise = forecourt(b) + 10.55;
    if (d === 1)
      band(
        landing,
        a,
        b,
        4.2,
        (p) => -10.55 + (rise * ((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1])) / length,
        'paving',
        0.6,
      );
    else
      for (let i = 0; i < 12; i++)
        band(
          landing,
          lerp(a, b, i / 12),
          lerp(a, b, (i + 1) / 12),
          4.2,
          -10.55 + (rise * (i + 1)) / 12,
          'paving',
          rise / 12 + 0.6,
        );
  }
}
function rockBase(face, r, top, d) {
  const sign = Math.sign(
    r.reduce((v, a, i) => {
      const b = r[(i + 1) % r.length];
      return v + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = unit(b.map((v, k) => v - a[k])),
      normal = [u[1] * sign, -u[0] * sign];
    const lower = (p) => p.map((v, k) => v + normal[k] * (d ? 1.7 : 1.3));
    const aa = lower(a),
      bb = lower(b);
    face(
      'rock',
      [
        at(a, top),
        at(b, top),
        at(bb, Math.min(top - 0.4, bamburghGround(...bb) - 0.35)),
        at(aa, Math.min(top - 0.4, bamburghGround(...aa) - 0.35)),
      ],
      [normal[0], 0.25, normal[1]],
    );
  }
}
function enclosure(out, d) {
  const face = writer(out, d),
    r = frame.geometry.outline;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      m = lerp(a, b, 0.5);
    // Mapped gate and palace masses already carry the landward forecourt edge.
    // Adding the enclosure band there produced thin overlapping ramp walls at the entrance.
    if (m[0] > 17 || (m[0] > -62 && m[1] > 10)) continue;
    const top = (p) => (p[0] < -62 ? bamburghGround(...p) + 5.7 : forecourt(p) + 5.7);
    const gates = d
      ? [lowerGate, upperGate].filter(
          (h) =>
            Math.min(a[0], b[0]) < h.center[0] + h.depth / 2 + 3 &&
            Math.max(a[0], b[0]) > h.center[0] - h.depth / 2 - 3 &&
            Math.min(a[1], b[1]) < h.center[1] + h.depth / 2 + 3 &&
            Math.max(a[1], b[1]) > h.center[1] - h.depth / 2 - 3,
        )
      : [];
    const wallFace = gates.length
      ? writer(
          openingBuilder(
            out,
            gates.map((h) => prepareOpening(h, 0, d)),
          ),
          d,
        )
      : face;
    band(wallFace, a, b, d === 0 ? 2.2 : 2.6, top, 'stone', 5.9);
    if (d >= 1) {
      band(face, a, b, 0.72, (p) => top(p) + 0.85, 'trim', 0.85);
      if (d >= 2) {
        const n = Math.floor(Math.hypot(...b.map((v, k) => v - a[k])) / 4);
        for (let j = 0; j < n; j++)
          band(
            face,
            lerp(a, b, j / n),
            lerp(a, b, (j + 0.43) / n),
            0.8,
            (p) => top(p) + 1.55,
            'trim',
            0.7,
          );
      }
    }
  }
  const north = part(35184464227040, 1);
  masonry(
    out,
    d,
    north,
    base,
    (p) => (p[0] > 108 ? court + 12 : court + 7),
    d === 0 ? [] : [upperGate, eastGate],
  );
  if (d >= 1) {
    for (let i = 0; i < north.length; i++) {
      const a = north[i],
        b = north[(i + 1) % north.length];
      if (Math.hypot(...b.map((v, k) => v - a[k])) > 5)
        band(face, a, b, 0.6, (p) => (p[0] > 108 ? court + 12 : court + 7) + 0.65, 'trim', 0.65);
    }
  }
  const gate = part(35184464227040, 0);
  masonry(
    out,
    d,
    gate,
    (p) => Math.min(-5.5, bamburghGround(...p) - 0.35),
    court + 6,
    d === 0 ? [] : [lowerGate],
  );
  if (d >= 1) crown(face, gate, court + 6, d, 4.7);
}
function keep(out, d) {
  const face = writer(out, d),
    r = part(35184673736335),
    top = court + 25.5;
  masonry(out, d, r, court - 1.4, top, d === 0 ? [] : [keepDoor], 'roof');
  if (d >= 1) rockBase(face, r, court - 1.4, d);
  const m = center(r);
  for (const p of r) {
    const q = p.map((v, k) => v + (v - m[k] > 0 ? 0.5 : -0.5)),
      box = rectangle(...q, d === 0 ? 3.1 : 4.2, d === 0 ? 3.1 : 4.2);
    solid(face, box, court + 19.7, top + 2.7);
    if (d >= 1) crown(face, box, top + 2.7, d, 2.5);
  }
  if (d >= 1) {
    crown(face, r, top, d, 3.5);
    facade(face, d, r, court + 4, top - 2, { arch: true, step: 5.6, rows: 3 });
  }
  if (d >= 2) {
    // Selected broad buttresses, rather than a stone-joint mesh on every face.
    for (const p of r) solid(face, rectangle(...p, 1.3, 1.3), court + 0.1, court + 21, 'trim');
    const flag = rectangle(m[0], m[1], 0.6, 0.6);
    solid(face, flag, top, top + 7.2, 'metal');
    face(
      'roof',
      [
        [m[0], top + 7.2, m[1]],
        [m[0] + 3.1, top + 6.9, m[1]],
        [m[0] + 2.8, top + 5.2, m[1]],
        [m[0], top + 5.1, m[1]],
      ],
      [0, 0, 1],
    );
  }
}
function palace(out, d) {
  const face = writer(out, d),
    r = part(35184464227038),
    eave = court + 13;
  solid(face, r, d === 0 ? base : court - 1.4, eave);
  if (d >= 1) rockBase(face, r, court - 1.4, d);
  slicedRoof(face, r, 1, 34, eave, 3.8, 7.4);
  facade(face, d, r, court, eave, { step: 5.6, rows: 2 });
  const hall = part(35184464227042);
  solid(face, hall, d === 0 ? base : court - 1.4, court + 17.3);
  if (d >= 1) rockBase(face, hall, court - 1.4, d);
  slicedRoof(face, hall, 0, 125.5, court + 17.3, 4.6, 14);
  facade(face, d, hall, court, court + 17.3, { arch: true, step: 5.8, rows: 2 });
  // The hall's unequal corner crowns and the rounded eastern return identify the palace end.
  for (const p of [
    [113.3, 15.6],
    [123.1, 27.3],
    [139.7, 17.4],
  ]) {
    const r = rectangle(...p, d === 0 ? 3.8 : 4.8, d === 0 ? 3.8 : 4.8);
    solid(face, r, d === 0 ? base : court - 1.4, court + 21.5);
    if (d >= 1) rockBase(face, r, court - 1.4, d);
    if (d >= 1) crown(face, r, court + 21.5, d, 2.6);
  }
  const east = part(35184464227045);
  solid(face, east, d === 0 ? base : court - 1.4, court + 15.5);
  if (d >= 1) rockBase(face, east, court - 1.4, d);
  slicedRoof(face, east, 1, -5.5, court + 15.5, 2.1, 14);
  facade(face, d, east, court, court + 15.5, { step: 5.5 });
  if (d >= 1) {
    for (const p of [
      [-45.2, 39],
      [27.3, 40.2],
      [52.2, 39],
      [96.4, 37],
    ]) {
      const n = d === 1 ? 8 : d === 2 ? 12 : 16,
        r = circle(p, 2.8, n);
      solid(face, r, court - 1.4, eave + 0.5);
      rockBase(face, r, court - 1.4, d);
      crown(face, r, eave + 0.5, d, 3.8);
    }
  }
  if (d >= 2) {
    for (const x of [-24, 0, 73, 90]) {
      const r = rectangle(x, 34, 1.3, 1.5);
      solid(face, r, eave + 2.3, eave + 5.5, 'trim');
    }
    // Selected tall hall windows get stone crosses; the wall itself is still drawn once.
    for (const x of [118, 127]) {
      const r = rectangle(x, 28.4, 1.1, 0.65);
      solid(face, r, court + 7, court + 17.2, 'trim');
    }
  }
}
function windmill(face, d) {
  const p = center(part(35184673734152)),
    y = bamburghGround(...p) + 0.4,
    n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 16;
  const lower = circle(p, 2.8, n),
    upper = circle(p, 2.05, n);
  for (let i = 0; i < n; i++)
    face(
      'windmill',
      [
        at(lower[i], y),
        at(lower[(i + 1) % n], y),
        at(upper[(i + 1) % n], y + 8.1),
        at(upper[i], y + 8.1),
      ],
      [lower[i][0] - p[0], 0, lower[i][1] - p[1]],
    );
  const top = [p[0], y + 9.5, p[1]];
  for (let i = 0; i < n; i++)
    face(
      'roof',
      [at(upper[i], y + 8.1), at(upper[(i + 1) % n], y + 8.1), top],
      [upper[i][0] - p[0], 1, upper[i][1] - p[1]],
    );
  if (d >= 1) {
    const a = [p[0] - 2.2, p[1] + 2.2],
      b = [p[0] + 2.2, p[1] + 2.2];
    window(face, d, a, b, 0.5, y + 0.8, 1.1, 2.1);
    window(face, d, a, b, 0.5, y + 4.9, 0.7, 1.2);
  }
}
function build(out, d) {
  const face = writer(out, d);
  platforms(out, d);
  enclosure(out, d);
  palace(out, d);
  keep(out, d);
  windmill(face, d);
}
export const buildBamburghSkyline = (out) => build(out, 0);
export const buildBamburghDistrict = (out) => build(out, 1);
export const buildBamburghStreet = (out) => build(out, 2);
export const buildBamburghCloseup = (out) => build(out, 3);
export const bamburghStudy = {
  id: 'bamburgh_castle',
  key: 'bamburgh_castle',
  title: 'Bamburgh Castle',
  category: 'castle',
  wikidataId: 'Q2026185',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual elongated coastal castle: freestanding square keep with four corner crowns and paired arched windows; long roofed palace, unequal eastern hall towers and rounded return; separate north curtain and lower west gate, open stepped courts, rocky foundations and a low western windmill.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID340x87m enclosure and six current PMTiles featureIDs, preserving seven independent polygons including the disjoint curtain/gate pieces.',
    architecturalHeights:
      'No current component height tags. Keep25.5m above an approximate inner court, relative palace/tower profiles, windmill9.5m and terrace/foundation levels are inferred from two oblique pictures and standard viewer DEM.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Exact-QID enclosure and individual keep/palace/curtain/windmill plans establish approximate horizontal scale. Seven polygons remain separate; no uniform full-height enclosure extrusion.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square shared material graphs provide sandstone, weathered limestone, slate, painted metal and lime plaster. Glass/lawn use linear vertex colors. Metric UVs and shared-tint compensation; no unique bitmap or embedded photo.',
  importReason:
    'Preserve square keep/corner crowns, connected palace silhouette and elongated stepped bailey with its western windmill in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Mapped enclosure and seven component polygons provide approximate exterior horizontal fit; no component height tags, so tower heights, roof profiles, window rhythm and gate openings are picture-led estimates.',
    'Standard viewer DEM gives a working41.1229m datum. The western bailey slope, inner courtY6.5m, foundations, rock skirts, paths and gate joins are approximate; coarse terrain is not a bare-earth survey or certified navigable surface.',
    'The north-curtain/west-gate MultiPolygon is preserved as independent masses. Village, dunes, separate southwest building, full interiors and hidden archaeological plans are excluded.',
    'Windmill reconstruction is its present exterior tower/cone; no historical sails or mechanism are invented.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'keep-and-long-palace', position: [18, 56, 128], lookAt: [37, 15, 24], fov: 43 },
    {
      name: 'eastern-hall-and-rounded-return',
      position: [222, 55, 54],
      lookAt: [132, 15, 7],
      fov: 43,
    },
    {
      name: 'seaward-curtain-and-upper-passage',
      position: [79, 43, -127],
      lookAt: [58, 10, -25],
      fov: 43,
    },
    { name: 'lower-west-gate', position: [-64, -6, 50], lookAt: [-54, -8.5, 29.5], fov: 43 },
    {
      name: 'western-bailey-and-windmill',
      position: [-218, 38, 61],
      lookAt: [-102, -8, -2],
      fov: 43,
    },
    { name: 'whole-mapped-castle-plan', position: [0, 290, 0.1], lookAt: [0, 0, 0], fov: 53 },
  ],
};
