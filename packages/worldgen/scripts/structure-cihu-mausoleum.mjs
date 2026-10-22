/** Complete native stepped courtyard residence, with a genuinely open court. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ws/wsq/cihu_mausoleum/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  outer = plan.outline,
  hole = plan.holes[0],
  ref = 'palette:#ffffff';
const C = {
  brick: rgb('813d32'),
  white: rgb('e5e4d7'),
  roof: rgb('965447'),
  tile: rgb('b08470'),
  blue: rgb('6194aa'),
  glass: rgb('263d40'),
  stone: rgb('95998d'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.99, metallic: 0 },
  white: { slot: 'trim', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.99, metallic: 0 },
  tile: { slot: 'roof', localRef: ref, roughness: 0.99, metallic: 0 },
  blue: { slot: 'trim', localRef: ref, roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.52, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
};
function tri(o, s, p, h, col = C[s]) {
  const q = p.map((v) => v.map(Math.fround)),
    n = cross(
      q[1].map((v, i) => v - q[0][i]),
      q[2].map((v, i) => v - q[0][i]),
    );
  if (Math.hypot(...n) < 1e-9) return;
  if (normalFor(...p).reduce((v, x, i) => v + x * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((v) => [v[0], v[2]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
const B = (o, s, x, y, z, w, h, d) =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], C[s]);
function inside(p, ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
const building = (p) => inside(p, outer) && !inside(p, hole);
const footprintPoints = [...outer, ...hole],
  footprintIndices = earcut(footprintPoints.flat(), [outer.length]);
function floor(o, y) {
  for (let i = 0; i < footprintIndices.length; i += 3)
    tri(
      o,
      'stone',
      footprintIndices
        .slice(i, i + 3)
        .map((j) => [footprintPoints[j][0], y, footprintPoints[j][1]]),
      [0, 1, 0],
    );
  for (const ring of [outer, [...hole].reverse()])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        h = [b[1] - a[1], 0, a[0] - b[0]];
      Q(
        o,
        'stone',
        [
          [a[0], 0, a[1]],
          [b[0], 0, b[1]],
          [b[0], y, b[1]],
          [a[0], y, a[1]],
        ],
        h,
      );
    }
}
function clip(poly, axis, value, less) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      a = less ? p[axis] <= value : p[axis] >= value,
      b = less ? q[axis] <= value : q[axis] >= value;
    if (a) out.push(p);
    if (a !== b) {
      const t = (value - p[axis]) / (q[axis] - p[axis]);
      out.push(p.map((v, j) => v + t * (q[j] - v)));
    }
  }
  return out;
}
const regions = [
  {
    name: 'south-front-range',
    bounds: [-40, 40, 6.75, 14.1],
    axis: 1,
    center: 10.4,
    half: 3.7,
    eave: 4.6,
    ridge: 6.5,
  },
  {
    name: 'projecting-entrance',
    bounds: [-40, 40, 14.1, 30],
    axis: 1,
    center: 16.65,
    half: 2.8,
    eave: 5.1,
    ridge: 7,
  },
  {
    name: 'west-courtyard-wing',
    bounds: [-40, 0, -6.75, 6.75],
    axis: 0,
    center: -13.2,
    half: 6.5,
    eave: 4.6,
    ridge: 6.4,
  },
  {
    name: 'east-courtyard-wing',
    bounds: [0, 40, -6.75, 6.75],
    axis: 0,
    center: 12.5,
    half: 5.8,
    eave: 4.6,
    ridge: 6.4,
  },
  {
    name: 'north-main-hall-and-west-extension',
    bounds: [-40, 40, -17.7, -6.75],
    axis: 1,
    center: -12.2,
    half: 5.5,
    eave: 4.6,
    ridge: 6.6,
  },
  {
    name: 'north-west-edge',
    bounds: [-40, 10.65, -40, -17.7],
    axis: 1,
    center: -12.2,
    half: 5.5,
    eave: 4.6,
    ridge: 6.6,
  },
  {
    name: 'north-east-service-extension',
    bounds: [10.65, 40, -40, -17.7],
    axis: 0,
    center: 15.85,
    half: 5.3,
    eave: 4.6,
    ridge: 6.4,
  },
];
function region(p) {
  return (
    regions.find(
      (r) =>
        p[0] >= r.bounds[0] - 1e-6 &&
        p[0] <= r.bounds[1] + 1e-6 &&
        p[1] >= r.bounds[2] - 1e-6 &&
        p[1] <= r.bounds[3] + 1e-6,
    ) ?? regions[4]
  );
}
function roofY(r, p) {
  const t = Math.min(1, Math.abs(p[r.axis] - r.center) / r.half);
  return r.eave + (r.ridge - r.eave) * (1 - 1.32 * t + 0.32 * t * t);
}
function roof(o, d) {
  for (const r of regions) {
    const n = [2, 4, 8, 12][d],
      lo = r.center - r.half,
      hi = r.center + r.half,
      levels = [-50, ...Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n), 50];
    for (let i = 0; i < footprintIndices.length; i += 3) {
      let p = footprintIndices.slice(i, i + 3).map((j) => footprintPoints[j]);
      for (const [ax, v, less] of [
        [0, r.bounds[0], false],
        [0, r.bounds[1], true],
        [1, r.bounds[2], false],
        [1, r.bounds[3], true],
      ])
        p = clip(p, ax, v, less);
      if (p.length < 3) continue;
      for (let k = 1; k < levels.length; k++) {
        const q = clip(clip(p, r.axis, levels[k - 1], false), r.axis, levels[k], true);
        for (let j = 1; j < q.length - 1; j++)
          tri(
            o,
            'roof',
            [q[0], q[j], q[j + 1]].map((v) => [v[0], roofY(r, v), v[1]]),
            [0, 1, 0],
          );
      }
    }
    if (d >= 2) {
      const along = 1 - r.axis,
        amin = r.bounds[along === 0 ? 0 : 2],
        amax = r.bounds[along === 0 ? 1 : 3],
        step = d === 1 ? 3 : d === 2 ? 1.4 : 0.65;
      for (let a = Math.ceil(amin / step) * step; a < amax; a += step) {
        const segments = d === 1 ? 2 : d === 2 ? 4 : 6;
        for (let k = 0; k < segments; k++) {
          const t0 = lo + ((hi - lo) * k) / segments,
            t1 = lo + ((hi - lo) * (k + 1)) / segments,
            p0 = r.axis === 1 ? [a, t0] : [t0, a],
            p1 = r.axis === 1 ? [a, t1] : [t1, a],
            mid = p0.map((v, i) => (v + p1[i]) / 2);
          if (!building(mid) || region(mid) !== r) continue;
          beam(
            o,
            'tile',
            [p0[0], roofY(r, p0) + 0.035, p0[1]],
            [p1[0], roofY(r, p1) + 0.035, p1[1]],
            d === 1 ? 0.12 : 0.09,
            0.075,
            C.tile,
          );
        }
      }
    }
  }
  // Pale raised edge copings follow each actual native boundary, including the court.
  for (const ring of [outer, hole])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        count = d === 0 ? 1 : d === 1 ? 2 : 6;
      for (let j = 0; j < count; j++) {
        const p = a.map((v, k) => v + ((b[k] - v) * j) / count),
          q = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / count),
          m = p.map((v, k) => (v + q[k]) / 2),
          r = region(m);
        beam(
          o,
          'white',
          [p[0], roofY(r, p) + 0.05, p[1]],
          [q[0], roofY(r, q) + 0.05, q[1]],
          0.19,
          0.19,
          C.white,
        );
      }
    }
  // Main transverse ridges and bounded upturned capped ends; no generic pagoda spires.
  for (const [z, x0, x1, y] of [
    [10.4, -19, 18.2, 6.5],
    [-12.2, -26, 21, 6.6],
    [16.65, -4.45, 4.45, 7],
  ]) {
    beam(o, 'white', [x0, y + 0.1, z], [x1, y + 0.1, z], 0.22, 0.32, C.white);
    if (d >= 1)
      for (const x of [x0, x1]) {
        beam(o, 'white', [x, y, z], [x, y + 0.55, z], 0.32, 0.35, C.white);
        B(o, 'white', x, y + 0.53, z, 0.4, 0.12, 0.4);
      }
  }
}
function roofJoins(o, d) {
  // Close height changes at inferred range junctions; keep the native court open.
  for (const [axis, value] of [
    [1, 6.75],
    [1, 14.1],
    [1, -6.75],
    [1, -17.7],
    [0, 10.65],
  ]) {
    const along = 1 - axis,
      stops = [-45, 45];
    for (const ring of [outer, hole])
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if (Math.abs(a[axis] - b[axis]) < 1e-8) continue;
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        if (t >= 0 && t <= 1) stops.push(a[along] + t * (b[along] - a[along]));
      }
    for (const r of regions)
      stops.push(r.bounds[along === 0 ? 0 : 2], r.bounds[along === 0 ? 1 : 3]);
    const sorted = [...new Set(stops)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const mid = (sorted[i - 1] + sorted[i]) / 2,
        p = axis === 0 ? [value, mid] : [mid, value];
      const a = [...p],
        b = [...p];
      a[axis] -= 0.001;
      b[axis] += 0.001;
      if (!building(a) || !building(b)) continue;
      const ra = region(a),
        rb = region(b);
      if (ra === rb) continue;
      const n = d < 2 ? 1 : 4,
        hint = [0, 0, 0];
      hint[axis === 0 ? 0 : 2] = roofY(ra, p) > roofY(rb, p) ? 1 : -1;
      for (let j = 0; j < n; j++) {
        const p0 = [...p],
          p1 = [...p];
        p0[along] = sorted[i - 1] + ((sorted[i] - sorted[i - 1]) * j) / n;
        p1[along] = sorted[i - 1] + ((sorted[i] - sorted[i - 1]) * (j + 1)) / n;
        Q(
          o,
          'roof',
          [
            [p0[0], roofY(ra, p0), p0[1]],
            [p1[0], roofY(ra, p1), p1[1]],
            [p1[0], roofY(rb, p1), p1[1]],
            [p0[0], roofY(rb, p0), p0[1]],
          ],
          hint,
        );
      }
    }
  }
}
function wallPanel(o, a, b, bottom, top, holes = [], slot = 'brick') {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    u = [dx / len, dz / len],
    n = [dz / len, -dx / len],
    p = (v, depth = 0) => [
      a[0] + u[0] * v[0] + n[0] * depth,
      v[1],
      a[1] + u[1] * v[0] + n[1] * depth,
    ],
    polys = [
      [
        [0, bottom],
        [len, bottom],
        [len, top],
        [0, top],
      ],
      ...holes,
    ],
    pts = polys.flat(),
    ids = earcut(
      pts.flat(),
      holes.map((_, i) => 4 + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    );
  for (const dep of [0, -0.2])
    for (let j = 0; j < ids.length; j += 3)
      tri(
        o,
        slot,
        ids.slice(j, j + 3).map((k) => p(pts[k], dep)),
        [n[0] * (dep === 0 ? 1 : -1), 0, n[1] * (dep === 0 ? 1 : -1)],
      );
  for (const h of holes)
    for (let j = 0; j < h.length; j++) {
      const v = h[j],
        w = h[(j + 1) % h.length];
      Q(o, 'white', [p(v), p(w), p(w, -0.2), p(v, -0.2)], [(v[0] + w[0]) / 2 - len / 2, 0, 1]);
    }
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
const circle = (x, y, r, n) =>
  Array.from({ length: n }, (_, i) => [
    x + Math.cos((i / n) * Math.PI * 2) * r,
    y + Math.sin((i / n) * Math.PI * 2) * r,
  ]);
function exterior(o, d) {
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      front = i === 8,
      sideFront = i === 6 || i === 10,
      holes = [];
    if (front) {
      holes.push(rect(len / 2, 1.2, 4.2, 3.8));
      if (d >= 2) for (const t of [0.14, 0.86]) holes.push(rect(len * t, 1.8, 1.45, 2.5));
    } else if (sideFront) {
      holes.push(circle(len * 0.5, 2.7, 1.12, [8, 12, 24, 32][d]));
    } else if (d >= 2 && len > 5) {
      const count = Math.floor(len / 4.8);
      for (let k = 0; k < count; k++) holes.push(rect((len * (k + 0.5)) / count, 2.1, 1.15, 1.55));
    }
    wallPanel(o, a, b, 1.2, front ? 5.1 : 4.6, holes);
    if (d >= 1 && !front) {
      const dx = (b[0] - a[0]) / len,
        dz = (b[1] - a[1]) / len,
        n = [dz, -dx];
      for (const h of holes) {
        if (sideFront) continue;
        const cx = h.reduce((s, p) => s + p[0], 0) / h.length,
          cy = (h[0][1] + h[2][1]) / 2,
          p = [a[0] + dx * cx - n[0] * 0.23, cy, a[1] + dz * cx - n[1] * 0.23];
        beam(
          o,
          'glass',
          [p[0] - dx * 0.56, p[1], p[2] - dz * 0.56],
          [p[0] + dx * 0.56, p[1], p[2] + dz * 0.56],
          0.025,
          1.5,
          C.glass,
        );
        for (const t of [-0.36, 0, 0.36])
          B(
            o,
            'white',
            p[0] + dx * t + n[0] * 0.05,
            cy - 0.75,
            p[2] + dz * t + n[1] * 0.05,
            0.05,
            1.5,
            0.05,
          );
      }
    }
    if (d >= 1) {
      const count = Math.max(1, Math.ceil(len / 3));
      for (let j = 0; j < count; j++) {
        const p = a.map((v, k) => v + ((b[k] - v) * j) / count),
          q = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / count),
          m = p.map((v, k) => (v + q[k]) / 2),
          r = region(m),
          h = [b[1] - a[1], 0, a[0] - b[0]];
        Q(
          o,
          'brick',
          [
            [p[0], front ? 5.1 : 4.6, p[1]],
            [q[0], front ? 5.1 : 4.6, q[1]],
            [q[0], roofY(r, q) - 0.06, q[1]],
            [p[0], roofY(r, p) - 0.06, p[1]],
          ],
          h,
        );
      }
    }
  }
}
function column(o, x, z, y, h, r, d, slot = 'white') {
  const n = [4, 8, 12, 16][d];
  loft(
    o,
    slot,
    [
      radialRing(y, r * 1.2, r * 1.2, n, [x, z]),
      radialRing(y + 0.14, r, r, n, [x, z]),
      radialRing(y + h - 0.18, r, r, n, [x, z]),
      radialRing(y + h, r * 1.18, r * 1.18, n, [x, z]),
    ],
    C[slot],
  );
}
function screen(o, x, z, w, h, d) {
  if (d < 2) {
    B(o, 'white', x, 1.65, z, w, h, 0.12);
    if (d === 1)
      for (let k = 0; k < 4; k++)
        B(o, 'glass', x - w * 0.37 + k * w * 0.25, 2, z + 0.075, 0.09, h - 0.65, 0.025);
    return;
  }
  const nx = 3,
    ny = 5,
    sx = w / nx,
    sy = h / ny;
  for (let row = 0; row < ny; row++)
    for (let col = 0; col < nx; col++) {
      const xx = x - w / 2 + sx * col,
        yy = 1.65 + sy * row,
        base = [
          [xx, yy],
          [xx + sx, yy],
          [xx + sx, yy + sy],
          [xx, yy + sy],
        ],
        diamond = [
          [xx + sx * 0.5, yy + sy * 0.12],
          [xx + sx * 0.87, yy + sy * 0.5],
          [xx + sx * 0.5, yy + sy * 0.88],
          [xx + sx * 0.13, yy + sy * 0.5],
        ],
        ps = [...base, ...diamond],
        ix = earcut(ps.flat(), [4]);
      for (let j = 0; j < ix.length; j += 3)
        for (const dz of [-0.065, 0.065])
          tri(
            o,
            'white',
            ix.slice(j, j + 3).map((k) => [ps[k][0], ps[k][1], z + dz]),
            [0, 0, dz > 0 ? 1 : -1],
          );
      for (let j = 0; j < 4; j++) {
        const a = diamond[j],
          b = diamond[(j + 1) % 4];
        Q(
          o,
          'white',
          [
            [a[0], a[1], z - 0.065],
            [b[0], b[1], z - 0.065],
            [b[0], b[1], z + 0.065],
            [a[0], a[1], z + 0.065],
          ],
          [0, 1, 0],
        );
      }
    }
}
function entrance(o, d) {
  const z = 19.15;
  for (const x of [-2.38, 2.38]) column(o, x, z, 1.2, 3.8, 0.27, d);
  if (d >= 1) {
    for (const x of [-3.25, 3.25]) screen(o, x, z, 1.42, 2.65, d);
    B(o, 'white', 0, 4.7, z, 8.6, 0.35, 0.35);
    B(o, 'white', 0, 4.25, z, 4.5, 0.22, 0.28);
    for (const x of [-4.33, 4.33]) {
      B(o, 'brick', x, 1.2, z, 0.42, 3.9, 0.52);
      if (d >= 2)
        for (let y = 1.4; y < 5; y += 0.19) B(o, 'white', x, y, z + 0.275, 0.45, 0.035, 0.025);
    }
  }
  for (let i = 0; i < 6; i++) B(o, 'stone', 0, 0.2 * i, 20.95 - i * 0.32, 5.8, 0.2, 2.5 - i * 0.32);
  if (d >= 1) {
    for (const x of [-3.2, 3.2]) {
      for (let i = 0; i < 4; i++) {
        const z = 19.45 + i * 0.6,
          y = 0.28 + (3 - i) * 0.2;
        column(o, x, z, y, 1.0, 0.12, d, 'stone');
      }
      beam(o, 'stone', [x, 2.15, 19.3], [x, 0.95, 21.8], 0.19, 0.19, C.stone);
    }
    for (const x of [-4.1, 4.1]) {
      B(o, 'white', x, 4.6, 16.65, 0.3, 0.22, 5.4);
    }
  }
}
function courtyard(o, d) {
  for (let i = 0; i < hole.length; i++) {
    const a = hole[i],
      b = hole[(i + 1) % hole.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [-u[1], u[0]],
      count = d === 0 ? 2 : 6;
    beam(o, 'blue', [a[0], 4.35, a[1]], [b[0], 4.35, b[1]], 0.25, 0.3, C.blue);
    for (let j = 0; j <= count; j++) {
      const x = a[0] + (u[0] * len * j) / count,
        z = a[1] + (u[1] * len * j) / count;
      B(o, 'blue', x, 1.2, z, 0.19, 3.15, 0.19);
    }
    if (d >= 1) {
      const backa = a.map((v, k) => v - n[k] * 1.65),
        backb = b.map((v, k) => v - n[k] * 1.65);
      wallPanel(o, backa, backb, 1.2, 4.4, [], 'blue');
      for (let j = 0; j < 6; j++) {
        const t = (j + 0.5) / 6,
          x = backa[0] + u[0] * len * t + n[0] * 0.24,
          z = backa[1] + u[1] * len * t + n[1] * 0.24;
        beam(
          o,
          'glass',
          [x - u[0] * 0.5, 2.6, z - u[1] * 0.5],
          [x + u[0] * 0.5, 2.6, z + u[1] * 0.5],
          0.04,
          1.9,
          C.glass,
        );
        if (d >= 2) {
          for (const y of [1.65, 3.6])
            beam(
              o,
              'white',
              [x - u[0] * 0.54, y, z - u[1] * 0.54],
              [x + u[0] * 0.54, y, z + u[1] * 0.54],
              0.07,
              0.07,
              C.white,
            );
        }
      }
      for (const y of [1.38, 2.1])
        beam(o, 'white', [a[0], y, a[1]], [b[0], y, b[1]], 0.07, 0.075, C.white);
      for (let j = 0; j < 12; j++) {
        if ((i === 0 || i === 2) && j >= 5 && j <= 6) continue;
        const x = a[0] + (u[0] * len * (j + 0.5)) / 12,
          z = a[1] + (u[1] * len * (j + 0.5)) / 12;
        B(o, 'white', x, 1.38, z, 0.055, 0.72, 0.055);
        if (d >= 2)
          beam(
            o,
            'white',
            [x - u[0] * 0.3, 1.75, z - u[1] * 0.3],
            [x + u[0] * 0.3, 1.75, z + u[1] * 0.3],
            0.045,
            0.045,
            C.white,
          );
      }
    }
  }
}
function build(o, _frame, d = 3) {
  floor(o, 1.2);
  exterior(o, d);
  roof(o, d);
  roofJoins(o, d);
  entrance(o, d);
  courtyard(o, d);
}
export const cihuSkyline = (o, f) => build(o, f, 0);
export const cihuDistrict = (o, f) => build(o, f, 1);
export const cihuStreet = (o, f) => build(o, f, 2);
export const cihuMausoleumModel = {
  id: 'cihu_mausoleum',
  key: 'cihu_mausoleum',
  recipe: 'structure-cihu-mausoleum.mjs',
  cell: 'ws/wsq',
  title: 'Cihu Mausoleum',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native stepped brick courtyard residence/mausoleum: all14outer/4inner vertices, genuinely open court, projecting round-column entrance and pierced screens, pale-coped red tile roofs, bounded stairs/stone rails, blue courtyard colonnades/doors and white open railing, plus complete mapped west/rear/northeast extensions. Photographic roof partitions/heights/concealed details are approximate; detached paifang/visitor center/sculpture park/tomb interiors excluded.',
  camera: [57, 42, 65],
  lookAt: [-1, 3, -4],
  portableGroundY: -0.3,
  mediumFiContext: { scale: 1.4, groundY: -0.3 },
  qaCameras: [
    {
      name: 'raised-round-column-entrance-pierced-screens-and-tiled-roof',
      position: [13, 9, 33],
      lookAt: [0, 3.6, 17],
    },
    {
      name: 'genuinely-open-courtyard-blue-colonnades-and-doors',
      position: [3, 16, 14],
      lookAt: [0, 2.7, -3],
    },
    {
      name: 'complete-native-north-east-and-west-stepped-building-ranges',
      position: [-46, 32, -48],
      lookAt: [-2, 3, -8],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed front approach before terrain; bounded raised native building base/stairs only. No filled court/lake/compound slab.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cihu-mausoleum.mjs',
    level: 'skyline',
    export: 'cihuSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: {
      district: { export: 'cihuDistrict', errorMeters: 0.18, surfaces },
      street: { export: 'cihuStreet', errorMeters: 0.05, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'All native outer/courtyard corners are retained. Native mapping gives no height or roof/room partition survey. Base1.2m/eaves4.6m/mainridge6.6m/entranceridge7m, subdivided roof ridges/curves and service-extension elevations are photographic estimates; concealed rear room openings/paint/trim and precise host-terrain contact unverified. No hidden courtyard filled for a simpler roof or model.',
    'Three exact cleared Qualla originals: March2024京都東CC0front and June2005JiangPD-userfront/courtyard. Same creator original courtyard upload/release/sole native bytes verify missing artist metadata, filled asJiang on matching local media records without changing license/bytes/story text. Older courtyard supports blue painted timber and white rails with explicit current-persistence limitation. Other licensed views, assumed-author garden/exit images, detached ceremonialgate, sculpturepark and tomb/interior collection not used. No additional image source/photographic texture.',
    'Native parent partitions are complete, but exact roof-tile/white coping sections, white floral/plaque/calligraphic relief, pierced-screen petal motifs and circular ancillary entry counts/sections are representative medium-fi. Door panes and lattice are shallow/recessed geometry, gallery is open. No reproduced indoorart/sarcophagus, guards/visitors, flags, chimes, planters/signage, trees/lake/park or detached visitor facility. Terrain remains raw/unfitted; building step/contact details are approximations.',
  ],
};
