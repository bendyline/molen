/** Roofless Linlithgow: mapped courtyard, hollow stairs, gables, entrances and fountain. */
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
    '../../../content/worldgen/source/places/gc/gcv/n0322_linlithgow_palace/',
    import.meta.url,
  ),
  read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  floor = frame.reconstruction.courtFloorY;
const palette = {
  stone: '#c6b69a',
  trim: '#dfcfb4',
  foundation: '#b4aa92',
  paving: '#b4ada0',
  water: '#286d83',
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
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]],
  lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  unit = (v) => {
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
const rect = (x, z, w, d) => [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
      p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
    ]);
const sign = (r) =>
  Math.sign(
    r.reduce((n, a, i) => {
      const b = r[(i + 1) % r.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
export function linlithgowGround(x, z) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Linlithgow footing outside retained DEM');
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
function writer(out, d) {
  return (slot, polygon, direction) => {
    let p = polygon.map((v) => v.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((n, v, k) => n + v * direction[k], 0) < 0)
      p = p.toReversed();
    const color = d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot];
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
function simplify(r, tol) {
  if (!tol) return r;
  const p = [...r];
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < p.length && p.length > 4; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        q = p[(i + 1) % p.length],
        dx = q[0] - a[0],
        dz = q[1] - a[1],
        len = Math.hypot(dx, dz),
        along = len ? ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (len * len) : 0,
        dist = len ? Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / len : 0;
      if (dist <= tol && along >= 0 && along <= 1) {
        p.splice(i, 1);
        i--;
      }
    }
  return p;
}
function cap(face, r, y, slot, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(a, b), at(q, b), at(q, t), at(a, t)], [(q[1] - a[1]) * s, 0, (a[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function offsetRing(r, width, inward = true) {
  const s = sign(r) * (inward ? 1 : -1);
  return r.map((p, i) => {
    const a = unit(p.map((v, k) => v - r[(i + r.length - 1) % r.length][k])),
      b = unit(r[(i + 1) % r.length].map((v, k) => v - p[k])),
      n = [-a[1] * s, a[0] * s],
      m = [-b[1] * s, b[0] * s],
      den = Math.max(0.3, 1 + n[0] * m[0] + n[1] * m[1]);
    return p.map(
      (v, k) => v + Math.max(-2 * width, Math.min(2 * width, (width * (n[k] + m[k])) / den)),
    );
  });
}
function nearby(h, r) {
  const n = [-h.axis[1], h.axis[0]],
    ext = [0, 1].map(
      (k) => (Math.abs(h.axis[k]) * h.width) / 2 + (Math.abs(n[k]) * h.depth) / 2 + 0.15,
    );
  return [0, 1].every(
    (k) =>
      Math.min(...r.map((p) => p[k])) <= h.center[k] + ext[k] &&
      Math.max(...r.map((p) => p[k])) >= h.center[k] - ext[k],
  );
}
function masonry(out, d, r, b, t, holes = [], slot = 'stone') {
  const hs = holes.filter((h) => nearby(h, r)).map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d);
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
  openingReveals(
    {
      addTriangle(_slot, ref, p, n, uv, c) {
        out.addTriangle(slot, ref, p, n, uv, c);
      },
    },
    r,
    (p) => (typeof b === 'function' ? b(p) : b),
    (p) => (typeof t === 'function' ? t(p) : t),
    hs,
    d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
  );
}
function wallLoop(out, d, r, width, inward, b, t, holes) {
  const inner = offsetRing(r, width, inward);
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    masonry(out, d, [r[i], r[j], inner[j], inner[i]], b, t, holes);
  }
  return inner;
}
function band(face, a, b, w, y, slot, depth = 0) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    r = [
      a.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v + (n[k] * w) / 2),
      a.map((v, k) => v + (n[k] * w) / 2),
    ];
  if (depth) solid(face, r, (p) => (typeof y === 'function' ? y(p) : y) - depth, y, slot);
  else cap(face, r, y, slot);
}
const southGate = {
    name: 'mapped-south-entrance',
    center: [19.4, 8],
    axis: [0, 1],
    width: 3.8,
    height: 5.8,
    spring: 4.1,
    bottom: floor,
    depth: 21,
    shape: 'round',
  },
  eastGate = {
    name: 'mapped-east-passage',
    center: [0.26, -18.55],
    axis: [1, 0],
    width: 3,
    height: 4.2,
    spring: 2.8,
    bottom: floor,
    depth: 19,
    shape: 'round',
  };
export function linlithgowFacadeOpenings(d) {
  const out = [southGate, eastGate];
  if (!d) return out;
  const add = (name, c, axis, width, y, height, shape = 'rectangle') => {
    if (
      frame.reconstruction.towers.some(
        (t) => Math.hypot(c[0] - t.center[0], c[1] - t.center[1]) < t.radius + width * 0.6,
      )
    )
      return;
    out.push({
      name,
      center: c,
      axis,
      width,
      height,
      spring: height * 0.7,
      bottom: floor + y,
      depth: 3.1,
      shape,
    });
  };
  for (const side of ['north', 'south'])
    for (let i = 0; i < 10; i++) {
      if ((d === 1 && i % 4) || (d === 2 && i % 3 === 2)) continue;
      const z = -21.5 + i * 4.7;
      for (let row = 0; row < 4; row++) {
        if ((d === 1 && row !== 2) || (d === 2 && row === 3)) continue;
        if (side === 'south' && Math.abs(z - 8) < 3.8 && row < 2) continue;
        add(
          `${side}-exterior-${i}-${row}`,
          [side === 'north' ? -27.9 : 26.05, z],
          [0, 1],
          row === 3 ? 1.7 : 1.4,
          2.4 + 4.2 * row,
          2.3,
        );
      }
    }
  // A basement rhythm on the lower loch-facing facade prevents an invented blank cliff wall.
  if (d >= 2)
    for (let i = 0; i < 8; i++)
      add(`north-basement-${i}`, [-27.9, -20 + i * 5.8], [0, 1], 1.0, -2.2, 1.8);
  for (const side of ['east', 'west'])
    for (let i = 0; i < 8; i++) {
      if ((d === 1 && i % 4) || (d === 2 && i % 3 === 2)) continue;
      const x = -22 + i * 6.25;
      for (let row = 0; row < 3; row++) {
        if (d === 1 && row !== 2) continue;
        const y = row === 2 ? 12 : 2.5 + 4.2 * row;
        add(
          `${side}-exterior-${i}-${row}`,
          [x, side === 'east' ? -25.55 : 26.05],
          [1, 0],
          row === 2 ? 2.0 : 1.4,
          y,
          row === 2 ? 4.6 : 2.3,
          row === 2 ? 'pointed' : 'rectangle',
        );
      }
    }
  for (const side of ['north', 'south', 'east', 'west'])
    for (let i = 0; i < 7; i++) {
      if ((d === 1 && i % 4) || (d === 2 && i % 3 === 2)) continue;
      const along = -9 + i * 3.5,
        center =
          side === 'north'
            ? [-15.45, along]
            : side === 'south'
              ? [11.0, along]
              : [along, side === 'east' ? -11.55 : 16.1],
        axis = ['north', 'south'].includes(side) ? [0, 1] : [1, 0];
      for (let row = 0; row < 3; row++) {
        if (d === 1 && row !== 2) continue;
        if (side === 'south' && Math.abs(along - 8) < 3.8 && row < 2) continue;
        if (side === 'east' && Math.abs(along - 0.26) < 2.4 && row === 0) continue;
        add(
          `${side}-court-${i}-${row}`,
          center,
          axis,
          0.95,
          3 + 4.1 * row,
          2.4,
          row === 2 ? 'round' : 'rectangle',
        );
      }
    }
  return out;
}
export const linlithgowDoors = [southGate, eastGate];
function jambFrame(face, h, d, normal) {
  if (!d) return;
  const shape = openingShape(h, d),
    outer = shape.map((p) => [
      (p[0] * (h.width + 1.0)) / h.width,
      h.bottom - 0.45 + ((p[1] - h.bottom) * (h.height + 0.9)) / h.height,
    ]),
    u = unit(h.axis),
    n = normal,
    point = (p) => [
      h.center[0] + u[0] * p[0] + n[0] * 0.09,
      p[1],
      h.center[1] + u[1] * p[0] + n[1] * 0.09,
    ];
  for (let i = 0; i < shape.length; i++) {
    const j = (i + 1) % shape.length;
    face(
      'trim',
      [point(shape[i]), point(shape[j]), point(outer[j]), point(outer[i])],
      [n[0], 0, n[1]],
    );
  }
}
function gates(face, d) {
  jambFrame(face, { ...southGate, center: [27.65, 8] }, d, [1, 0]);
  jambFrame(face, { ...southGate, center: [10.9, 8] }, d, [-1, 0]);
  jambFrame(face, { ...eastGate, center: [0.26, -25.7] }, d, [0, -1]);
  if (d >= 2) {
    const x = 10.73,
      z = 8;
    face(
      'trim',
      [
        [x, floor + 6.7, z - 3.1],
        [x, floor + 6.7, z + 3.1],
        [x, floor + 9.4, z + 2.5],
        [x, floor + 9.4, z - 2.5],
      ],
      [-1, 0, 0],
    );
    for (const dz of [-1.6, 0, 1.6])
      face(
        'stone',
        [
          [x - 0.08, floor + 7.1, z + dz - 0.6],
          [x - 0.08, floor + 7.1, z + dz + 0.6],
          [x - 0.08, floor + 8.5, z + dz + 0.55],
          [x - 0.08, floor + 8.5, z + dz - 0.55],
        ],
        [-1, 0, 0],
      );
  }
  band(face, [29, 8], [10.7, 8], 3.8, floor + 0.05, 'paving');
  band(face, [0.26, -28], [0.26, -10.8], 3.0, floor + 0.05, 'paving');
  // The outside approach is a short estimate against the retained standard DEM.
  if (d >= 1)
    band(
      face,
      [30, 8],
      [35, 8],
      3.8,
      (p) => floor + 0.05 + ((linlithgowGround(35, 8) + 0.08 - floor - 0.05) * (p[0] - 30)) / 5,
      'paving',
      0.35,
    );
}
function gable(out, d, f, outerHoles) {
  const face = writer(out, d),
    p = f.center,
    [x, z] = p,
    base = floor + (x < 0 ? 20.5 : 18.5),
    eave = floor + f.height,
    top = eave + f.rise;
  // Surviving parallel gable walls; no restored roof across the corner room.
  for (const xx of [x - f.width / 2, x + f.width / 2]) {
    const outer = x < 0 ? xx < x : xx > x,
      rr = rect(xx, z, 1.0, f.depth);
    masonry(out, d, rr, outer ? base : floor, eave, outerHoles);
    const g = [
        [xx - 0.5, eave, z - f.depth / 2],
        [xx + 0.5, eave, z - f.depth / 2],
        [xx + 0.5, top, z],
        [xx - 0.5, top, z],
      ],
      h = [
        [xx - 0.5, top, z],
        [xx + 0.5, top, z],
        [xx + 0.5, eave, z + f.depth / 2],
        [xx - 0.5, eave, z + f.depth / 2],
      ];
    face('stone', g, [0, 1, 0]);
    face('stone', h, [0, 1, 0]);
    for (const side of [-1, 1])
      face(
        'stone',
        [
          [xx + side * 0.5, eave, z - f.depth / 2],
          [xx + side * 0.5, eave, z + f.depth / 2],
          [xx + side * 0.5, top, z],
        ],
        [side, 0, 0],
      );
  }
  if (d >= 1) {
    const sideX = x < 0 ? x - f.width / 2 : x + f.width / 2,
      profile = (p) => eave + f.rise * Math.max(0, 1 - Math.abs(p[1] - z) / (f.depth / 2)) + 0.12;
    band(face, [sideX, z - f.depth / 2], [sideX, z], 0.5, profile, 'trim', 0.3);
    band(face, [sideX, z], [sideX, z + f.depth / 2], 0.5, profile, 'trim', 0.3);
  }
}
function roomPartitions(out, d, holes) {
  const face = writer(out, d),
    outer = simplify(frame.geometry.outline, d === 0 ? 0.6 : 0.025),
    inner = simplify(frame.geometry.holes[0], d === 0 ? 0.35 : 0.025);
  cap(face, outer, floor - 0.06, 'paving', [inner]);
  if (!d) return;
  const segments = [
    { a: [-26.4, -7.0], b: [-16.2, -7], height: 12.5 },
    { a: [-26.4, 16.2], b: [-16.2, 16.2], height: 19.2 },
    { a: [-16, 17.6], b: [-16, 24.7], height: 12 },
    { a: [-4.45, 17.6], b: [-4.45, 24.7], height: 9 },
    { a: [13.1, 17.6], b: [13.1, 24.7], height: 13 },
    { a: [-16.6, -24.3], b: [-16.6, -13.2], height: 18.2 },
    { a: [17, -24.3], b: [17, -13.2], height: 14 },
  ];
  for (const s of segments) {
    const u = unit(s.b.map((v, k) => v - s.a[k])),
      n = [-u[1], u[0]],
      w = 0.75,
      r = [
        s.a.map((v, k) => v - (n[k] * w) / 2),
        s.b.map((v, k) => v - (n[k] * w) / 2),
        s.b.map((v, k) => v + (n[k] * w) / 2),
        s.a.map((v, k) => v + (n[k] * w) / 2),
      ];
    masonry(out, d, r, floor - 0.06, floor + s.height, holes);
  }
  if (d >= 2) {
    for (const p of [
      [-21, 7],
      [-8, 21],
      [6, 21],
      [4, -18],
    ]) {
      const r = rect(...p, 4, 3);
      solid(face, r, floor - 0.04, floor + 0.6, 'foundation');
    }
  }
}
export const linlithgowStairOpenings = [];
function stair(out, d, t) {
  const face = writer(out, d),
    p = t.center,
    n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 16,
    outer = circle(p, t.radius, n),
    inner = circle(p, t.radius - 0.72, n),
    holes = [];
  if (d >= 1)
    for (let i = 0; i < 4; i++) {
      const forward = p[0] < 0 ? 0 : 2,
        facingCourt = [forward, p[1] > 8 ? 3 : 1];
      if (!facingCourt.includes(i) || (d <= 2 && i !== forward)) continue;
      const a = (i * Math.PI) / 2,
        u = [Math.cos(a), Math.sin(a)],
        v = [-u[1], u[0]],
        center = p.map((q, k) => q + u[k] * t.radius);
      for (const y of d === 1 ? [12] : d === 2 ? [6, 14] : [5, 11, 17])
        holes.push({
          name: `${t.name}-slit-${i}-${y}`,
          center,
          axis: v,
          width: 0.75,
          height: 1.9,
          spring: 1.35,
          bottom: floor + y,
          depth: 2.3,
          shape: 'rectangle',
        });
    }
  if (d === 0) {
    // Skyline retains the hollow crowns above the common wall silhouette;
    // district and closer levels reconstruct the full-depth stair wells.
    sides(face, outer, floor + 20.5, floor + t.height, 'stone');
    sides(face, inner, floor + 20.5, floor + t.height, 'stone', true);
    cap(face, outer, floor + t.height, 'stone', [inner]);
  } else
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      masonry(out, d, [outer[i], outer[j], inner[j], inner[i]], floor, floor + t.height, holes);
    }
  if (d) cap(face, inner, floor + 0.03, 'paving');
  if (d >= 1) {
    const top = floor + t.height,
      copingOuter = circle(p, t.radius + 0.325, n),
      copingInner = circle(p, t.radius - 0.325, n);
    sides(face, copingOuter, top, top + 0.7, 'trim');
    sides(face, copingInner, top, top + 0.7, 'trim', true);
    cap(face, copingOuter, top + 0.7, 'trim', [copingInner]);
    for (let i = 0; i < n; i++) {
      const a = outer[i],
        b = outer[(i + 1) % n],
        top = floor + t.height;
      if (d >= 2) band(face, a, lerp(a, b, 0.45), 0.65, top + 1.25, 'trim', 0.55);
    }
  }
  if (d >= 3)
    for (const h of holes)
      if (!linlithgowStairOpenings.some((q) => q.name === h.name)) linlithgowStairOpenings.push(h);
}
function fountain(face, d) {
  const p = frame.reconstruction.fountain.point,
    n = d === 0 ? 4 : d === 1 ? 6 : 12,
    r = 3.1;
  const bowl = circle(p, r, n),
    inset = circle(p, r - 0.48, n);
  solid(face, bowl, floor + 0.02, floor + 0.5, 'stone');
  if (!d) {
    solid(face, circle(p, 0.8, n), floor + 0.5, floor + 5.1, 'trim');
    return;
  }
  cap(face, inset, floor + 0.53, 'water');
  for (const [y, rad, h] of [
    [0.5, 1.25, 1.35],
    [1.85, 1.8, 0.4],
    [2.25, 0.55, 1.2],
    [3.45, 1.15, 0.32],
    [3.77, 0.32, 0.75],
  ]) {
    const q = circle(p, rad, n);
    solid(face, q, floor + y, floor + y + h, 'trim');
  }
  const crown = circle(p, 0.58, n);
  solid(face, crown, floor + 4.52, floor + 5.1, 'stone');
  if (d >= 2)
    for (let i = 0; i < n; i += 2) {
      const a = (i * 2 * Math.PI) / n,
        q = [p[0] + 2.2 * Math.cos(a), p[1] + 2.2 * Math.sin(a)];
      solid(face, rect(...q, 0.45, 0.45), floor + 0.5, floor + 1.45, 'trim');
    }
}
function build(out, d) {
  const towerOut = out;
  // Mapped court-wall bays already bend around stairs. Remove those overlapping
  // wall sections so the independently authored hollow tower is their boundary.
  const bays = frame.reconstruction.towers.map((t) => {
    const r = circle(t.center, t.radius + 0.15, d <= 1 ? 4 : d === 2 ? 12 : 16);
    return {
      planes: [
        [0, 1, 0, -floor - 0.06],
        [0, -1, 0, 100],
        ...r.map((a, i) => {
          const b = r[(i + 1) % r.length],
            dx = b[0] - a[0],
            dz = b[1] - a[1];
          return [-dz, 0, dx, dz * a[0] - dx * a[1]];
        }),
      ],
    };
  });
  out = {
    addTriangle(slot, ref, points, ...attributes) {
      const intersections = !d
        ? []
        : bays.filter(
            (bay) =>
              !bay.planes.some((plane) =>
                points.every((p) => p.reduce((n, v, k) => n + v * plane[k], plane[3]) < -1e-7),
              ),
          );
      openingBuilder(towerOut, intersections).addTriangle(slot, ref, points, ...attributes);
    },
  };
  const face = writer(out, d),
    holes = linlithgowFacadeOpenings(d),
    outer = simplify(frame.geometry.outline, d === 0 ? 0.6 : 0.025),
    court = simplify(frame.geometry.holes[0], d === 0 ? 0.35 : 0.025);
  const outerTop = (p) => floor + (p[0] < -24.5 ? 20.5 : 18.5),
    courtTop = (p) => floor + (p[0] < -12.8 ? 19.2 : 18.5);
  wallLoop(
    out,
    d,
    outer,
    1.25,
    true,
    (p) => Math.min(floor - 0.2, linlithgowGround(...p) - 0.35),
    outerTop,
    holes,
  );
  wallLoop(out, d, court, 1.05, false, floor - 0.05, courtTop, holes);
  cap(face, court, floor, 'paving');
  roomPartitions(out, d, holes);
  for (const t of frame.reconstruction.towers) stair(towerOut, d, t);
  for (const f of frame.reconstruction.cornerBlocks) gable(out, d, f, holes);
  gates(face, d);
  fountain(face, d);
}
export const buildLinlithgowSkyline = (out) => build(out, 0);
export const buildLinlithgowDistrict = (out) => build(out, 1);
export const buildLinlithgowStreet = (out) => build(out, 2);
export const buildLinlithgowCloseup = (out) => build(out, 3);
export const linlithgowStudy = {
  id: 'N0322',
  key: 'linlithgow_palace',
  title: 'Linlithgow Palace',
  category: 'castle',
  wikidataId: 'Q564868',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual roofless palace: mapped square courtyard and fountain, separate outer/court walls with real rectangular/Gothic openings, five unequal hollow stair towers, four surviving corner gable pairs, mapped south/east entrance tunnels and selected open room partitions/wall walks. No restored roof slab or adjacent church.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID56x52m relation envelope/courtyard plus nine current palace/part controls, mapped fountain position and actual south/east tunnel route.',
    architecturalHeights:
      'No height tags. Wall/gable/stair levels, fountain tiers, window rhythm and selected room remnants are estimates from two inspected pictures. Raised courtyard3.9m clears the coarse south approach while north foundations follow the slope.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Exact palace/courtyard plan and current part/tunnel/fountain controls provide approximate exterior scale and signed facing.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Two existing256-square shared graphs provide sandstone and weathered limestone with linear tints/metric UVs; small fountain water uses a vertex-colored palette. No unique bitmap, photographed masonry or embedded image.',
  importReason:
    'Preserve the roofless courtyard, hollow stair silhouettes, gables and courtyard fountain in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Main registered palace and courtyard retain the exact mapped identity; nine current palace/part polygons, fountain and tunnel provide approximate fit. Component heights are untagged, so all elevations, damage and opening profiles are picture-led estimates.',
    'Coarse standard DEM supplies a working51.3701m anchor datum. Raised courtyard3.9m, foundations, approach ramp, wall walks and terrain joins are approximate; no bare-earth survey, terrain carving or certified walking collision.',
    'Roofless ranges and hollow stair wells remain open; selected partitions and gables do not claim complete historical room/stair plans. Fountain tiers and door decorations are simplified geometric interpretations, not exact heraldry or sculpture.',
    'Adjacent church, separate eastern mapped building, park, town, crowds, visitor fixtures and complete interiors are outside the palace asset and remain host content.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'north-loch-facade-and-gables',
      position: [-84, 44, -18],
      lookAt: [-24, 13, 0],
      fov: 43,
    },
    { name: 'open-courtyard-and-stair-wells', position: [4, 71, 7], lookAt: [0, 12, 0], fov: 43 },
    { name: 'mapped-south-entrance', position: [62, 22, 8], lookAt: [24, 8, 8], fov: 43 },
    {
      name: 'east-tunnel-and-gothic-windows',
      position: [7, 33, -65],
      lookAt: [0, 13, -24],
      fov: 43,
    },
    {
      name: 'courtyard-fountain-and-doorway',
      position: [4, 17, 16],
      lookAt: [-2.38, 6, 1.84],
      fov: 43,
    },
    { name: 'northwest-gables-and-stair', position: [-51, 38, 47], lookAt: [-20, 24, 20], fov: 43 },
  ],
};
