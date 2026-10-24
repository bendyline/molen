/** Original current São Jorge exterior; attributed controls and estimates remain separate. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/ey/eyc/castle_of_saint_george/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root))),
  frame = read('map-frame.json'),
  _refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = structuredClone(frame.controls);

export const saoJorgePalette = {
  stone: '#dbc9a9',
  tile: '#ae7656',
  metal: '#929b98',
  wood: '#985f4e',
  paving: '#d4c9b1',
  glass: '#4d6178',
  accent: '#e7ded0',
};
export const saoJorgeSurfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.96, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.12 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.34, metallic: 0.1 },
  accent: { slot: 'trim', roughness: 0.9, metallic: 0 },
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((v) => {
      const x = parseInt(v, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
const fitdata = read('pmtiles-fit.json');
function fitGround(x, z) {
  const g = fitdata.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - fitdata.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
const lowerRing = frame.geometry.rawFeatures.find((v) => v.id === k.hillsideTowerWay).points;
k.hillsideBaseY = Math.max(...lowerRing.map((p) => fitGround(...p))) + 0.2 + 17;
k.hillsideTopY = k.hillsideBaseY + 13;
k.hillsideStairBottomY = k.hillsideTopY - 1;
const colors = Object.fromEntries(Object.entries(saoJorgePalette).map(([s, h]) => [s, linear(h)]));
const clean = (p) =>
  Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001 ? p.slice(0, -1) : p;
export const saoJorgeRing = (id) =>
  clean(frame.geometry.rawFeatures.find((w) => w.id === id).points);
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0);
const ccw = (p) => (area(p) < 0 ? [...p].reverse() : p);
const center = (p) => p.reduce((s, q) => s.map((v, i) => v + q[i] / p.length), [0, 0]);
const value = (v, p) => (typeof v === 'function' ? v(p) : v);
function safe(out) {
  return {
    addTriangle(slot, ref, p, _n, uv, color) {
      p = p.map((v) => v.map(Math.fround));
      const n = cross(
        p[1].map((v, i) => v - p[0][i]),
        p[2].map((v, i) => v - p[0][i]),
      );
      if (Math.hypot(...n) < 1e-9) return;
      out.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
  };
}
function cut(out, holes) {
  return {
    addTriangle(slot, ref, p, n, uv, color) {
      const overlapping = holes.filter(
        (h) =>
          !h.planes.some((pl) =>
            p.every((v) => v.reduce((s, x, i) => s + x * pl[i], pl[3]) <= 1e-7),
          ),
      );
      (overlapping.length ? openingBuilder(out, overlapping) : out).addTriangle(
        slot,
        ref,
        p,
        n,
        uv,
        color,
      );
    },
  };
}
function face(o, p, slot, d, target, tint = colors[slot]) {
  p = p.map((q) => q.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) p = [...p].reverse();
    break;
  }
  const c = d === 0 && means[slot] ? tint.map((v, i) => v * means[slot][i]) : tint;
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[2]]),
      c,
    );
  }
}
function cap(o, p, y, slot, d, tint) {
  const ix = earcut(p.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((j) => [p[j][0], value(y, p[j]), p[j][1]]),
      slot,
      d,
      [0, 1, 0],
      tint,
    );
}
function clipPolygon(p, signedDistance) {
  const result = [];
  let a = p.at(-1),
    av = signedDistance(a);
  for (const b of p) {
    const bv = signedDistance(b);
    if (av >= -1e-7 !== bv >= -1e-7) {
      const t = av / (av - bv);
      result.push(a.map((v, i) => v + (b[i] - v) * t));
    }
    if (bv >= -1e-7) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function prism(o, p, lo, hi, slot, d, top = true, tint) {
  p = ccw(p);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], value(lo, a), a[1]],
        [b[0], value(lo, b), b[1]],
        [b[0], value(hi, b), b[1]],
        [a[0], value(hi, a), a[1]],
      ],
      slot,
      d,
      [b[1] - a[1], 0, a[0] - b[0]],
      tint,
    );
  }
  if (top) cap(o, p, hi, slot, d, tint);
}
function strip(a, b, width) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [((-(b[1] - a[1]) / len) * width) / 2, (((b[0] - a[0]) / len) * width) / 2];
  return [
    a.map((v, i) => v + n[i]),
    b.map((v, i) => v + n[i]),
    b.map((v, i) => v - n[i]),
    a.map((v, i) => v - n[i]),
  ];
}
function beam(o, a, b, lo, hi, width, slot, d, tint) {
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.01) return;
  prism(o, strip(a, b, width), lo, hi, slot, d, true, tint);
}
export function saoJorgePassages(d = 3) {
  return k.passages.map((h) => {
    // At skyline distance the small arch curves are below a pixel; keep the apertures.
    const shape = d === 0 ? 'rectangle' : h.shape;
    if (!h.way) return prepareOpening({ ...h, shape }, 0, d);
    const p = saoJorgeRing(h.way),
      a = p[0],
      b = p.at(-1),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return prepareOpening(
      {
        ...h,
        shape,
        center: a.map((v, i) => (v + b[i]) / 2),
        axis: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
      },
      0,
      d,
    );
  });
}
function reveals(o, p, lo, hi, holes, d) {
  if (d === 0) return;
  const tint = d === 0 ? colors.stone.map((v, i) => v * means.stone[i]) : colors.stone;
  openingReveals(
    {
      addTriangle(_slot, ref, q, n, uv, c) {
        o.addTriangle('stone', ref, q, n, uv, c);
      },
    },
    p,
    (q) => value(lo, q),
    (q) => value(hi, q),
    holes,
    tint,
  );
}
function blockedPrism(o, p, lo, hi, d, holes, top = true, tint) {
  prism(cut(o, holes), p, lo, hi, 'stone', d, top, tint);
  reveals(o, p, lo, hi, holes, d);
}
function parapet(o, a, b, base, height, width, d, teeth = true) {
  const y = (q) => value(base, q);
  beam(o, a, b, y, (q) => y(q) + 0.55, width, 'stone', d);
  if (!teeth) return;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    count = Math.max(1, Math.floor(length / (d === 0 ? 8 : d === 1 ? 7.2 : 2.5))),
    share = d === 1 ? 0.48 : 0.5;
  for (let i = 0; i < count; i++) {
    const t0 = (i + 0.5 - share / 2) / count,
      t1 = (i + 0.5 + share / 2) / count;
    beam(
      o,
      a.map((v, j) => v + (b[j] - v) * t0),
      a.map((v, j) => v + (b[j] - v) * t1),
      (q) => y(q) + 0.55,
      (q) => y(q) + height,
      width,
      'stone',
      d,
    );
  }
}
function slit(o, a, b, lo, d, round = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    h = prepareOpening(
      {
        center: a.map((v, i) => (v + b[i]) / 2 + n[i] * 0.015),
        axis: u,
        width: round ? 0.8 : 0.34,
        height: round ? 1.5 : 1.7,
        spring: round ? 1.05 : 1.7,
        depth: 0.35,
        bottom: lo,
        shape: round ? 'round' : 'rectangle',
      },
      0,
      d,
    );
  face(
    o,
    h.ring.map((q) => h.point(q[0], q[1], -0.025)),
    'glass',
    d,
    [n[0], 0, n[1]],
  );
}
function roof(o, p, lo, rise, d) {
  const c = center(p);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [c[0], lo + rise, c[1]],
      ],
      'tile',
      d,
      [0, 1, 0],
    );
  }
}
export function buildSaoJorgeTower(out, t, d = 3) {
  const o = safe(out),
    p = ccw(t.ring),
    top = k.courtY + t.height,
    holes = saoJorgePassages(d),
    lower = t.id === 'central' ? k.courtY : k.outerBaseY;
  if (t.roof === 'hipped') {
    const eaves = top - t.roofRise;
    blockedPrism(o, p, lower, eaves, d, holes);
    // The current two north houses have a pale ashlar upper storey, not a plaster overlay.
    prism(o, p, eaves - 3, eaves, 'stone', d, false, linear('#eee2c9'));
    roof(o, p, eaves, t.roofRise, d);
    if (d > 0)
      for (let i = 0; i < p.length; i++)
        if (Math.hypot(...p[(i + 1) % p.length].map((v, j) => v - p[i][j])) > 3)
          slit(o, p[i], p[(i + 1) % p.length], eaves - 2.6, d, true);
    return;
  }
  const terrace = top - 1.3;
  blockedPrism(o, p, lower, d === 0 ? top : terrace, d, holes, d === 0);
  if (d > 0) {
    cap(o, p, terrace, 'paving', d);
    const c = center(p),
      inner = p.map((q) => q.map((v, i) => v + (c[i] - v) * 0.075));
    for (let i = 0; i < inner.length; i++)
      parapet(o, inner[i], inner[(i + 1) % inner.length], terrace, 1.3, 0.38, d);
    if (d >= 2)
      for (let i = 0; i < p.length; i++)
        if (Math.hypot(...p[(i + 1) % p.length].map((v, j) => v - p[i][j])) > 4.2)
          slit(o, p[i], p[(i + 1) % p.length], k.courtY + 3.2, d);
  }
}
function fortress(o, d) {
  const holes = saoJorgePassages(d),
    p = ccw(k.mainRing);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.4) continue;
    const inward = [
        (-(b[1] - a[1]) / len) * k.innerWallWidth,
        ((b[0] - a[0]) / len) * k.innerWallWidth,
      ],
      ring = [a, b, b.map((v, j) => v + inward[j]), a.map((v, j) => v + inward[j])];
    blockedPrism(o, ring, k.outerBaseY, k.wallWalkY, d, holes);
    if (d > 0) parapet(o, a, b, k.wallWalkY, k.wallParapetY - k.wallWalkY, 0.45, d);
  }
  for (let i = 0; i < k.divider.length - 1; i++) {
    const a = k.divider[i],
      b = k.divider[i + 1],
      ring = strip(a, b, 2.0);
    blockedPrism(o, ring, k.courtY, k.wallWalkY, d, holes);
    if (d > 0) parapet(o, a, b, k.wallWalkY, 1.1, 0.4, d);
  }
  for (const t of k.towers) buildSaoJorgeTower(o, t, d);
  // Court slabs are bounded by the inner wall trace; no cap is put over either court's air.
  for (const q of k.courtyards) cap(o, q, k.courtY, 'paving', d);
  const inside = ccw(k.mainRing).map((q) => {
    const c = center(k.mainRing);
    return q.map((v, i) => v + (c[i] - v) * 0.075);
  });
  cap(o, inside, k.courtY - 0.015, 'paving', d);
  const bc = saoJorgeRing(k.barbicanWay);
  blockedPrism(o, bc, k.barbicanBaseY, k.barbicanWalkY, d, holes);
  if (d > 0) {
    // Only the long outer edges carry the lower crenellated defence; short notches remain solid.
    for (let i = 0; i < bc.length; i++) {
      const a = bc[i],
        b = bc[(i + 1) % bc.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 12)
        parapet(cut(o, holes), a, b, k.barbicanWalkY, 1.2, 0.35, d);
    }
  }
  const ruins = saoJorgeRing(k.innerRuinsWay);
  for (let i = 0; d > 0 && i < ruins.length - 1; i++)
    beam(o, ruins[i], ruins[i + 1], k.courtY, k.courtY + 1.2, 0.65, 'stone', d);
}
function stair(o, a, b, low, high, width, count, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    point = (t) => a.map((v, i) => v + (b[i] - v) * t),
    y = (q) => low + ((high - low) * ((q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1])) / len;
  const p = strip(a, b, width);
  prism(o, p, (q) => y(q) - 0.7, y, 'stone', d);
  if (d >= 2) {
    const side = [(-u[1] * width) / 2, (u[0] * width) / 2];
    for (let i = 0; i < count; i++) {
      const aa = point(i / count),
        bb = point((i + 1) / count),
        bottom = low + ((high - low) * i) / count,
        top = low + ((high - low) * (i + 1)) / count;
      face(
        o,
        [
          [aa[0] + side[0], top, aa[1] + side[1]],
          [bb[0] + side[0], top, bb[1] + side[1]],
          [bb[0] - side[0], top, bb[1] - side[1]],
          [aa[0] - side[0], top, aa[1] - side[1]],
        ],
        'paving',
        d,
        [0, 1, 0],
      );
      face(
        o,
        [
          [aa[0] + side[0], bottom, aa[1] + side[1]],
          [aa[0] - side[0], bottom, aa[1] - side[1]],
          [aa[0] - side[0], top, aa[1] - side[1]],
          [aa[0] + side[0], top, aa[1] + side[1]],
        ],
        'stone',
        d,
        [-u[0], 0, -u[1]],
      );
    }
  }
  if (d > 0)
    for (const side of [-1, 1]) {
      const n = [-u[1] * width * 0.6 * side, u[0] * width * 0.6 * side];
      beam(
        o,
        a.map((v, i) => v + n[i]),
        b.map((v, i) => v + n[i]),
        y,
        (q) => y(q) + 0.85,
        0.3,
        'stone',
        d,
      );
    }
}
function bridges(o, d) {
  const p = saoJorgeRing(169453294);
  beam(o, p[0], p[1], 24.5, 25, 3, 'stone', d);
  // Original segmental underside; no invented survey of bridge supports or hill foundations.
  if (d >= 1) {
    const a = p[0],
      b = p[1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [-u[1] * 1.45, u[0] * 1.45],
      c = a.map((v, i) => (v + b[i]) / 2);
    for (const side of [-1, 1]) {
      const q = (x, y) => [c[0] + u[0] * x + n[0] * side, y, c[1] + u[1] * x + n[1] * side];
      const arch = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8,
          x = -len * 0.5 + len * t;
        arch.push(q(x, 21.5 + 3.0 * Math.sin(t * Math.PI)));
      }
      // Each arch cell is convex; a fan across the concave whole would fill the opening.
      for (let i = 0; i < arch.length - 1; i++)
        face(
          o,
          [
            q(-len / 2 + (len * i) / 8, 25),
            q(-len / 2 + (len * (i + 1)) / 8, 25),
            arch[i + 1],
            arch[i],
          ],
          'stone',
          d,
          [n[0] * side, 0, n[1] * side],
        );
    }
  }
  for (const id of [1157208066, 1148351760]) {
    const q = saoJorgeRing(id);
    beam(o, q[0], q.at(-1), 24.8, 25, 2.4, 'metal', d);
    if (d > 0) {
      const a = q[0],
        b = q.at(-1),
        l = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [(-(b[1] - a[1]) / l) * 1.05, ((b[0] - a[0]) / l) * 1.05];
      for (const s of [-1, 1])
        beam(
          o,
          a.map((v, i) => v + n[i] * s),
          b.map((v, i) => v + n[i] * s),
          25.8,
          26.2,
          0.08,
          'metal',
          d,
        );
    }
  }
  if (d >= 2) {
    const h = saoJorgePassages(d).find((h) => h.id === 'main');
    for (const s of [-1, 1]) {
      const a = h.point(s * h.width * 0.5, 25, 0),
        b = h.point(s * h.width * 0.5, 25, -2.3);
      face(o, [a, b, [b[0], 28.7, b[2]], [a[0], 28.7, a[2]]], 'wood', d, [
        h.axis[0] * s,
        0,
        h.axis[1] * s,
      ]);
    }
  }
  for (const s of d === 0 ? [] : k.stairs) {
    const q = s.way ? saoJorgeRing(s.way) : [s.a, s.b];
    stair(o, q[0], q.at(-1), s.bottom, s.top, 1.5, s.steps, d);
  }
}
function hills(o, d) {
  const p = saoJorgeRing(k.hillsideTowerWay),
    top = k.hillsideTopY;
  prism(o, p, k.hillsideBaseY, d === 0 ? top : top - 1.1, 'stone', d);
  if (d > 0) {
    cap(o, p, top - 1.1, 'paving', d);
    for (let i = 0; i < p.length; i++)
      parapet(o, p[i], p[(i + 1) % p.length], top - 1.1, 1.1, 0.36, d);
  }
  const route = saoJorgeRing(k.hillsideStairsWay);
  stair(
    o,
    route.at(-1),
    route[0],
    k.hillsideStairBottomY,
    k.hillsideStairTopY,
    2.1,
    k.hillsideStepCount,
    d,
  );
  const path = saoJorgeRing(83388539).slice(0, 10),
    start = path[0],
    end = path[3],
    len = Math.hypot(end[0] - start[0], end[1] - start[1]),
    u = [(end[0] - start[0]) / len, (end[1] - start[1]) / len],
    y = (q) =>
      35 -
      (35 - (k.hillsideTopY - 1)) *
        Math.max(0, Math.min(1, ((q[0] - start[0]) * u[0] + (q[1] - start[1]) * u[1]) / len));
  for (let i = 0; i < 3; i++) {
    const a = path[i],
      b = path[i + 1];
    beam(o, a, b, (q) => fitGround(...q) + 17 - 0.4, y, 2.5, 'stone', d);
    if (d > 0) parapet(o, a, b, y, 0.9, 0.4, d, false);
  }
}
function museum(o, d) {
  const p = saoJorgeRing(k.museumWay);
  // A linear ridge follows the current long museum wing. Split both roof and facade
  // at every slope break, so no triangle spans the ridge or leaves a gable open.
  const across = (q) => q[0] + 45.5 + 0.07 * (q[1] - 35),
    rise = k.museumRidgeY - k.museumEavesY,
    y = (q) => k.museumEavesY + rise * Math.max(0, 1 - Math.abs(across(q)) / 7),
    ring = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      av = across(a),
      bv = across(b),
      cuts = [0];
    for (const threshold of [-7, 0, 7]) {
      const t = (threshold - av) / (bv - av);
      if (t > 1e-7 && t < 1 - 1e-7) cuts.push(t);
    }
    for (const t of cuts.sort((a, b) => a - b)) ring.push(a.map((v, j) => v + (b[j] - v) * t));
  }
  prism(o, ring, k.museumBaseY, y, 'stone', d, false);
  const ix = earcut(p.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const tri = ix.slice(i, i + 3).map((j) => p[j]);
    for (const [lo, hi] of [
      [-Infinity, -7],
      [-7, 0],
      [0, 7],
      [7, Infinity],
    ]) {
      let q = tri;
      if (Number.isFinite(lo)) q = clipPolygon(q, (v) => across(v) - lo);
      if (Number.isFinite(hi) && q.length > 2) q = clipPolygon(q, (v) => hi - across(v));
      if (q.length > 2)
        face(
          o,
          q.map((v) => [v[0], y(v), v[1]]),
          'tile',
          d,
          [0, 1, 0],
        );
    }
  }
  if (d > 0) {
    const east = p.filter((q) => q[0] > -51);
    for (let i = 0; i < east.length - 1; i++) {
      const a = east[i],
        b = east[i + 1],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 10 || length > 50) continue;
      const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
        n = [u[1], -u[0]],
        count = Math.floor(length / (d === 1 ? 14 : 7));
      for (let j = 0; j < count; j++) {
        const c = a.map((v, h) => v + ((b[h] - v) * (j + 0.5)) / count + n[h] * 0.04);
        const h = prepareOpening(
          {
            center: c,
            axis: u,
            depth: 0.3,
            width: 1.4,
            height: 2.1,
            spring: 1.5,
            bottom: 27,
            shape: 'pointed',
          },
          0,
          d,
        );
        face(
          o,
          h.ring.map((q) => h.point(...q, -0.01)),
          'glass',
          d,
          [n[0], 0, n[1]],
        );
      }
    }
    const ruins = [
        [-36.4, 40],
        [-31, 46],
        [-31, 65],
        [-35, 75],
      ],
      holes = [
        prepareOpening(
          {
            center: [-31, 53],
            axis: [0, 1],
            depth: 3,
            width: 3.8,
            height: 5,
            spring: 2.8,
            bottom: 25,
            shape: 'pointed',
          },
          0,
          d,
        ),
        prepareOpening(
          {
            center: [-31, 61],
            axis: [0, 1],
            depth: 3,
            width: 3.8,
            height: 5,
            spring: 2.8,
            bottom: 25,
            shape: 'pointed',
          },
          0,
          d,
        ),
      ];
    for (let i = 0; i < ruins.length - 1; i++) {
      const ring = strip(ruins[i], ruins[i + 1], 0.85);
      blockedPrism(o, ring, 25, 31, d, holes);
    }
  }
}
function furniture(o, d) {
  const p = k.periscope,
    n = d === 0 ? 6 : 12,
    ring = Array.from({ length: n }, (_, i) => [
      p.point[0] + 0.38 * Math.cos((i * Math.PI * 2) / n),
      p.point[1] + 0.38 * Math.sin((i * Math.PI * 2) / n),
    ]);
  prism(o, ring, p.baseY, p.baseY + p.height, 'metal', d);
  for (const flag of k.poles) {
    const [x, z] = flag.point,
      ring = Array.from({ length: d === 0 ? 4 : 8 }, (_, i) => [
        x + 0.09 * Math.cos((i * Math.PI * 2) / (d === 0 ? 4 : 8)),
        z + 0.09 * Math.sin((i * Math.PI * 2) / (d === 0 ? 4 : 8)),
      ]);
    prism(o, ring, flag.baseY, flag.baseY + flag.height, 'metal', d);
    const palette = flag.flag === 'portugal' ? ['#3c8059', '#ba4734'] : ['#e5ddcb', '#475352'],
      width = 3.3,
      height = 1.8;
    for (let i = 0; i < 2; i++) {
      const split = flag.flag === 'portugal' ? 0.4 : 0.5,
        x0 = x + 0.12 + width * (i === 0 ? 0 : split),
        x1 = x + 0.12 + width * (i === 0 ? split : 1),
        hi = flag.baseY + flag.height - 0.18,
        lo = hi - height,
        q = [
          [x0, lo, z],
          [x1, lo - 0.12, z],
          [x1, hi - 0.12, z],
          [x0, hi, z],
        ];
      face(o, q, 'accent', d, [0, 0, 1], linear(palette[i]));
      face(o, [...q].reverse(), 'accent', d, [0, 0, -1], linear(palette[i]));
    }
  }
}
export const saoJorgeParts = { fortress, bridges, hills, museum, furniture };
export function buildSaoJorgeRuntime(out, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3,
    makeSafe = (mode) => safe({ addTriangle: (...args) => out.addTriangle(...args, mode) });
  for (const [mode, fn] of Object.entries(saoJorgeParts)) fn(makeSafe(mode), d);
}
export const buildSaoJorgeSkyline = (o) => buildSaoJorgeRuntime(o, 'skyline');

/** Picture-based Castle of Saint George exterior fit to standard viewer PMTiles. */
const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ey/eyc/castle_of_saint_george/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    stone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    paving: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
  };
export function saoJorgeGround(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function reviewed(o, level) {
  const far = level === 'skyline';
  function emit(s, r, p, n, _uv, c, mode) {
    if (far && n[1] < -0.98) return;
    const ps = p.map(([x, y, z]) =>
        [
          x,
          n[1] < 0.98 &&
          ((mode === 'fortress' && Math.abs(y - 19) < 0.001) ||
            (mode === 'museum' && Math.abs(y - 25) < 0.001) ||
            (mode === 'hills' && Math.abs(y - k.hillsideBaseY) < 0.001))
            ? saoJorgeGround(x, z) - 0.4
            : y + -17,
          z,
        ].map(Math.fround),
      ),
      col = far ? c.map((v, i) => (v * (MEANS[s]?.[i] ?? 1)) / (means[s]?.[i] ?? 1)) : c;
    for (let i = 1; i < ps.length - 1; i++) {
      const t = [ps[0], ps[i], ps[i + 1]];
      if (Math.hypot(...normalFor(...t)) < 0.5) continue;
      o.addTriangle(
        s,
        r,
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        col,
      );
    }
  }
  buildSaoJorgeRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildSaoJorgeReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildSaoJorgeReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildSaoJorgeReviewedDistrict = (o) => reviewed(o, 'district');
export const buildSaoJorgeReviewedStreet = (o) => reviewed(o, 'street');
export const buildSaoJorgeReviewedCloseup = (o) => reviewed(o, 'closeup');
