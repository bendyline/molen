/** Sintra National Palace: native palace ranges, four courts and paired kitchen chimneys. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/ey/eyc/sintra_national_palace/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff',
  cream = rgb('e4e0d4'),
  trim = rgb('bcb8a6'),
  darkStone = rgb('8d8878'),
  glass = rgb('46584c'),
  slate = rgb('ac5636'),
  iron = rgb('363d3a'),
  oak = rgb('7d3f31'),
  ochre = rgb('cda450'),
  pale = rgb('e5dfcb');
const area = (r) =>
  r.reduce((v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
  2;
function quad(o, slot, ps, n, col) {
  for (const ids of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    let q = ids.map((i) => ps[i]);
    const a = q[1].map((v, i) => v - q[0][i]),
      b = q[2].map((v, i) => v - q[0][i]);
    const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    if (Math.hypot(...cross) < 1e-7) continue;
    const target = Math.hypot(...n) > 0.1 ? n : normalFor(...q);
    if (normalFor(...q).reduce((v, a, i) => v + a * target[i], 0) < 0) q = q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      target,
      q.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addCap: (s, r, p, h, y, n, u, c) => o.addCap(s, r, p, h, y, n, u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function flat(o, slot, ps, col, holes = [], n = [0, 0, 1]) {
  const all = [...ps, ...holes.flat()],
    starts = holes.map((_, i) => ps.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0)),
    idx = earcut(
      all.flatMap((p) => [p[0], p[1]]),
      starts,
    );
  for (let i = 0; i < idx.length; i += 3) {
    const p = idx.slice(i, i + 3).map((j) => all[j]);
    if (normalFor(...p).reduce((v, a, j) => v + a * n[j], 0) < 0) p.reverse();
    o.addTriangle(
      slot,
      ref,
      p,
      n,
      p.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
const surface = (o, s, p, z, c) =>
  flat(
    o,
    s,
    p.map((v) => [...v, z]),
    c,
  );
function panel(o, s, ps, z0, z1, c) {
  surface(o, s, ps, z1, c);
  flat(
    o,
    s,
    ps.map((v) => [...v, z0]),
    c,
    [],
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      p = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, s, p, normalFor(...p), c);
  }
}
function wall(o, ps, holes, z, depth, col = cream, slot = 'stone') {
  const xmin = Math.min(...ps.map((p) => p[0])),
    xmax = Math.max(...ps.map((p) => p[0])),
    ymin = Math.min(...ps.map((p) => p[1])),
    ymax = Math.max(...ps.map((p) => p[1]));
  const partial = holes.some((r) =>
    r.some(
      ([x, y]) =>
        x <= xmin + 0.00001 || x >= xmax - 0.00001 || y <= ymin + 0.00001 || y >= ymax - 0.00001,
    ),
  );
  if (partial) slicedWall(o, slot, ps, holes, z, col);
  else
    flat(
      o,
      slot,
      ps.map((v) => [...v, z]),
      col,
      holes.map((r) => r.map((v) => [...v, z])),
    );
  if (depth <= 0) return;
  for (const r of holes)
    for (let i = 0; i < r.length; i++) {
      let a = r[i],
        b = r[(i + 1) % r.length];
      if (partial) {
        let t0 = 0,
          t1 = 1;
        const dx = b[0] - a[0],
          dy = b[1] - a[1];
        for (const [p, q] of [
          [-dx, a[0] - xmin],
          [dx, xmax - a[0]],
          [-dy, a[1] - ymin],
          [dy, ymax - a[1]],
        ]) {
          if (Math.abs(p) < 1e-10) {
            if (q < 0) t1 = -1;
            continue;
          }
          const t = q / p;
          if (p < 0) t0 = Math.max(t0, t);
          else t1 = Math.min(t1, t);
        }
        if (t1 - t0 < 1e-7) continue;
        const aa = a;
        a = [aa[0] + dx * t0, aa[1] + dy * t0];
        b = [aa[0] + dx * t1, aa[1] + dy * t1];
      }
      const p = [
        [...a, z],
        [...a, z - depth],
        [...b, z - depth],
        [...b, z],
      ];
      quad(o, slot, p, normalFor(...p), darkStone);
    }
}
function outline(o, slot, ps, z, width, col, closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++) {
    const a = ps[i - 1],
      b = ps[i % ps.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const u = [(-(b[1] - a[1]) * width) / l / 2, ((b[0] - a[0]) * width) / l / 2],
      p = [
        [a[0] - u[0], a[1] - u[1], z],
        [b[0] - u[0], b[1] - u[1], z],
        [b[0] + u[0], b[1] + u[1], z],
        [a[0] + u[0], a[1] + u[1], z],
      ];
    quad(o, slot, p, [0, 0, 1], col);
  }
}
function slicedWall(o, slot, outer, holes, z, col) {
  const xmin = Math.min(...outer.map((p) => p[0])),
    xmax = Math.max(...outer.map((p) => p[0])),
    ymin = Math.min(...outer.map((p) => p[1])),
    ymax = Math.max(...outer.map((p) => p[1]));
  const xs = [xmin, xmax],
    edges = holes.map((r) => r.map((a, i) => [a, r[(i + 1) % r.length]]));
  for (const es of edges)
    for (const [a, b] of es) {
      xs.push(Math.max(xmin, Math.min(xmax, a[0])));
      for (const y of [ymin, ymax])
        if ((a[1] - y) * (b[1] - y) < 0)
          xs.push(
            Math.max(xmin, Math.min(xmax, a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]))),
          );
    }
  const xx = [...new Set(xs.map((x) => Number(x.toFixed(8))))].sort((a, b) => a - b),
    at = (edge, x) =>
      edge
        ? edge[0][1] + ((edge[1][1] - edge[0][1]) * (x - edge[0][0])) / (edge[1][0] - edge[0][0])
        : ymin;
  for (let k = 1; k < xx.length; k++) {
    const l = xx[k - 1],
      r = xx[k],
      m = (l + r) / 2;
    if (r - l < 1e-6) continue;
    const intervals = [];
    for (const es of edges) {
      const crosses = es
        .filter(([a, b]) => a[0] > m !== b[0] > m)
        .sort((a, b) => at(a, m) - at(b, m));
      for (let j = 1; j < crosses.length; j += 2) intervals.push([crosses[j - 1], crosses[j]]);
    }
    intervals.sort((a, b) => at(a[0], m) - at(b[0], m));
    const gaps = [];
    let lower = null,
      height = ymin;
    for (const [lo, hi] of intervals) {
      const low = at(lo, m),
        high = at(hi, m);
      if (high <= height || low >= ymax) continue;
      if (low > height) gaps.push([lower, lo]);
      if (high > height) {
        lower = hi;
        height = high;
      }
    }
    if (height < ymax)
      gaps.push([
        lower,
        [
          [xmin, ymax],
          [xmax, ymax],
        ],
      ]);
    for (const [a, b] of gaps) {
      const ys = (x) => [
          Math.max(ymin, Math.min(ymax, at(a, x))),
          Math.max(ymin, Math.min(ymax, at(b, x))),
        ],
        yl = ys(l),
        yr = ys(r),
        p = [
          [l, yl[0], z],
          [r, yr[0], z],
          [r, yr[1], z],
          [l, yl[1], z],
        ];
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const q = ids.map((i) => p[i]);
        if (
          Math.abs(
            (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]),
          ) < 1e-6
        )
          continue;
        o.addTriangle(
          slot,
          ref,
          q,
          [0, 0, 1],
          q.map((p) => [p[0], p[1]]),
          col,
        );
      }
    }
  }
}
function arch(x, bottom, w, spring, rise, segments = 12) {
  return [
    [x - w / 2, bottom],
    [x + w / 2, bottom],
    ...Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i / segments) * Math.PI;
      return [x + (w / 2) * Math.cos(a), spring + rise * Math.sin(a)];
    }),
  ];
}
function cylinder(o, slot, x, z, y0, y1, r0, r1, col, n = 24, cap = true) {
  loft(o, slot, [radialRing(y0, r0, r0, n, [x, z]), radialRing(y1, r1, r1, n, [x, z])], col, {
    cap,
  });
}
function clean(r, tolerance) {
  r = r.filter(
    (p, i) => Math.hypot(p[0] - r[(i + 1) % r.length][0], p[1] - r[(i + 1) % r.length][1]) > 0.002,
  );
  const original = [...r],
    indices = new Map(original.map((p, i) => [p, i]));
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        p = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz),
        t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (l * l) : -1,
        err = l ? Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / l : Infinity;
      let chainError = 0;
      for (
        let j = (indices.get(a) + 1) % original.length;
        j !== indices.get(b);
        j = (j + 1) % original.length
      ) {
        const q = original[j],
          u = l ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (l * l))) : 0;
        chainError = Math.max(chainError, Math.hypot(q[0] - a[0] - u * dx, q[1] - a[1] - u * dz));
      }
      if (t >= 0 && t <= 1 && err < tolerance && chainError < tolerance) {
        r = r.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function faces(r, hole = false) {
  r = area(r) > 0 !== hole ? r : [...r].reverse();
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      dx = a[0] - b[0],
      dz = a[1] - b[1];
    return {
      a,
      b,
      w: Math.hypot(dx, dz),
      x: (a[0] + b[0]) / 2,
      z: (a[1] + b[1]) / 2,
      angle: Math.atan2(-dz, dx),
      normal: [-dz / Math.hypot(dx, dz), dx / Math.hypot(dx, dz)],
    };
  });
}
function cap(o, rings, y, col = lead, slot = 'roof', normalY = 1) {
  const p = rings.flat(),
    idx = earcut(
      p.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, r) => s + r.length, 0)),
    );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]),
      ) < 0.0001
    )
      continue;
    if (normalFor(...q)[1] * normalY < 0) q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      [0, normalY, 0],
      q.map((v) => [v[0], v[2]]),
      col,
    );
  }
}

function ledge(o, x, y, z, w, h, depth, col) {
  quad(
    o,
    'trim',
    [
      [x - w / 2, y, z + depth / 2],
      [x + w / 2, y, z + depth / 2],
      [x + w / 2, y + h, z + depth / 2],
      [x - w / 2, y + h, z + depth / 2],
    ],
    [0, 0, 1],
    col,
  );
  quad(
    o,
    'trim',
    [
      [x - w / 2, y + h, z - depth / 2],
      [x + w / 2, y + h, z - depth / 2],
      [x + w / 2, y + h, z + depth / 2],
      [x - w / 2, y + h, z + depth / 2],
    ],
    [0, 1, 0],
    col,
  );
}

const c = Math.cos(frame.heading),
  s = Math.sin(frame.heading),
  datum = terrain.modelDatumElevationMeters;
const local = ([E, S]) => [c * (E - 12) - s * (S - 3), s * (E - 12) + c * (S - 3)];
const north = ([x, z]) => [12 + c * x + s * z, 3 - s * x + c * z];
const Y = (absolute) => absolute - datum;
const main = frame.authoredComponents.main;
const courts = frame.authoredComponents.courts;
const ownRings = [main[0], ...courts];
const tolerances = [2.5, 0.85, 0.12, 0.025];
const nativeOutline = main[0].map(north);
function inside(p, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
}
function sample(x, z) {
  const gx = (x - terrain.origin[0]) / terrain.stepMeters,
    gz = (z - terrain.origin[1]) / terrain.stepMeters,
    ix = Math.max(0, Math.min(terrain.size[0] - 2, Math.floor(gx))),
    iz = Math.max(0, Math.min(terrain.size[1] - 2, Math.floor(gz))),
    u = Math.max(0, Math.min(1, gx - ix)),
    v = Math.max(0, Math.min(1, gz - iz)),
    h = terrain.heightsMeters;
  return (
    h[iz][ix] * (1 - u) * (1 - v) +
    h[iz][ix + 1] * u * (1 - v) +
    h[iz + 1][ix] * (1 - u) * v +
    h[iz + 1][ix + 1] * u * v -
    datum
  );
}

const pointAt = (f, x, z = 0) => [
  f.x + Math.cos(f.angle) * x + Math.sin(f.angle) * z,
  f.z - Math.sin(f.angle) * x + Math.cos(f.angle) * z,
];
const nativeAt = (i) => nativeOutline[i];
const frontA = main[0][14],
  frontB = main[0][13];
function faceBetween(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz);
  return {
    a,
    b,
    w,
    x: (a[0] + b[0]) / 2,
    z: (a[1] + b[1]) / 2,
    angle: Math.atan2(-dz, dx),
    normal: [dz / w, -dx / w],
  };
}
const front = faceBetween(frontA, frontB),
  manu = faceBetween(main[0][6], main[0][5]);
const polygon = (indices) => indices.map((i) => nativeAt(i));
const patch = (name, zone, eave, rise, roof) => ({ name, zone, eave: Y(eave), rise, roof });
const frontZone = [
  nativeAt(14),
  nativeAt(13),
  [nativeAt(13)[0] - 4.53, nativeAt(13)[1] - 9.47],
  [nativeAt(14)[0] - 4.53, nativeAt(14)[1] - 9.47],
];
function flankHip(zone, edgeA, edgeB) {
  const a = local(edgeA),
    b = local(edgeB),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    v = [-u[1], u[0]],
    ps = zone.map(local),
    us = ps.map((p) => u[0] * p[0] + u[1] * p[1]),
    vs = ps.map((p) => v[0] * p[0] + v[1] * p[1]),
    lo = Math.min(...us),
    hi = Math.max(...us),
    min = Math.min(...vs),
    max = Math.max(...vs);
  return {
    model: true,
    u,
    v,
    lo,
    hi,
    mid: (min + max) / 2,
    half: (max - min) / 2,
    hip: Math.min((max - min) / 2, (hi - lo) / 2),
  };
}
const westernFlankZone = [...polygon([17, 18, 19, 20, 21, 22, 23, 24]), [5.5, 34.2]],
  easternFlankZone = [...polygon([14, 15, 16, 17]), [5.5, 34.2], nativeAt(24)];
const regions = [
  patch('Coats-of-Arms tower', polygon([44, 45, 46, 47]), 240.3, 6.6, {
    u: [1, 0],
    v: [0, 1],
    lo: -43.2,
    hi: -26.5,
    mid: -30.7,
    half: 8.2,
    hip: 8.2,
  }),
  patch(
    'upper royal ranges',
    [
      [-28, -29],
      [8, -20],
      [9, -6],
      [-4, -3],
      [-24, -12],
    ],
    235.7,
    4.8,
    { u: [1, 0], v: [0, 1], lo: -29, hi: 10, mid: -16, half: 13, hip: 7 },
  ),
  patch(
    'kitchen range',
    [
      [6, -21],
      [44, -21],
      [44, 2],
      [30, 7],
      [6, 0],
    ],
    232.3,
    4.0,
    { u: [1, 0], v: [0, 1], lo: 5, hi: 45, mid: -10, half: 12, hip: 5 },
  ),
  patch('main four-arch hall', frontZone, 228.5, 4.3, {
    model: true,
    u: [1, 0],
    v: [0, 1],
    lo: frontA[0] - 0.1,
    hi: frontB[0] + 0.1,
    mid: frontA[1] - 5.25,
    half: 5.4,
    hip: 4.2,
  }),
  patch(
    'northeast open loggias',
    [
      [56, -26],
      [75, -12],
      [75, 6],
      [57, 8],
      [49, -8],
    ],
    225.4,
    4.4,
    { u: [1, 0], v: [0, 1], lo: 49, hi: 72, mid: -7, half: 16, hip: 9 },
  ),
  patch(
    'Manueline wing',
    [
      [38, -22],
      [57, -26],
      [66, 3],
      [43, 16],
      [38, 10],
    ],
    225.4,
    5.1,
    { model: true, u: [1, 0], v: [0, 1], lo: 22, hi: 51, mid: 8, half: 15, hip: 7 },
  ),
  patch(
    'front right porch',
    [...polygon([6, 7, 8, 9, 10, 11, 12, 13]), [29, 17], [29, 7], [38, 5]],
    222.4,
    4.2,
    { model: true, u: [0, 1], v: [1, 0], lo: 6, hi: 33, mid: 17, half: 9, hip: 5 },
  ),
  patch(
    'front left eastern pavilion',
    easternFlankZone,
    221.8,
    3.7,
    flankHip(easternFlankZone, nativeAt(15), nativeAt(16)),
  ),
  patch(
    'front left western pavilion',
    westernFlankZone,
    221.8,
    3.9,
    flankHip(westernFlankZone, nativeAt(22), nativeAt(21)),
  ),
  patch(
    'central connecting hall',
    [
      [-7, -7],
      [14, -3],
      [13, 14],
      [-1, 22],
      [-7, 8],
    ],
    230.9,
    4.2,
    { u: [1, 0], v: [0, 1], lo: -9, hi: 14, mid: 3, half: 12, hip: 7 },
  ),
  patch(
    'west low range',
    [
      [-34, -23],
      [-23, -23],
      [-23, -13],
      [-6, -6],
      [-6, 5],
      [-34, 5],
    ],
    225.4,
    3.9,
    { u: [1, 0], v: [0, 1], lo: -34, hi: -2, mid: -6, half: 11, hip: 6 },
  ),
  patch('minor connecting ranges', null, 225.4, 3.4, {
    u: [1, 0],
    v: [0, 1],
    lo: -33,
    hi: 45,
    mid: 10,
    half: 22,
    hip: 8,
  }),
];
function regionAt(p) {
  const n = north(p);
  return regions.find(
    (r) =>
      !r.zone ||
      inside(n, r.zone) ||
      r.zone.some((a, i) => {
        const b = r.zone[(i + 1) % r.zone.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = ((n[0] - a[0]) * dx + (n[1] - a[1]) * dz) / (dx * dx + dz * dz);
        return (
          t >= 0 && t <= 1 && Math.hypot(n[0] - a[0] - t * dx, n[1] - a[1] - t * dz) < 0.000001
        );
      }),
  );
}
function roofY(p, r) {
  const q = r.roof.model ? p : north(p),
    u = r.roof.u[0] * q[0] + r.roof.u[1] * q[1],
    v = r.roof.v[0] * q[0] + r.roof.v[1] * q[1];
  return (
    r.eave +
    r.rise *
      Math.max(
        0,
        Math.min(
          1 - Math.abs(v - r.roof.mid) / r.roof.half,
          (u - r.roof.lo) / r.roof.hip,
          (r.roof.hi - u) / r.roof.hip,
        ),
      )
  );
}
const roofLines = [];
function addLine(a, b, k) {
  const l = Math.hypot(a, b);
  if (l < 1e-8) return;
  let t = [a / l, b / l, k / l];
  if (t[0] < -1e-8 || (Math.abs(t[0]) < 1e-8 && t[1] < 0)) t = t.map((v) => -v);
  if (!roofLines.some((l) => l.every((v, i) => Math.abs(v - t[i]) < 1e-6))) roofLines.push(t);
}
for (const r of regions) {
  if (r.zone)
    for (let i = 0; i < r.zone.length; i++) {
      const a = local(r.zone[i]),
        b = local(r.zone[(i + 1) % r.zone.length]);
      addLine(b[1] - a[1], a[0] - b[0], (b[1] - a[1]) * a[0] + (a[0] - b[0]) * a[1]);
    }
  const v = r.roof.v;
  if (r.roof.model) addLine(v[0], v[1], r.roof.mid);
  else addLine(v[0] * c - v[1] * s, v[0] * s + v[1] * c, r.roof.mid - v[0] * 12 - v[1] * 3);
}
function clip(p, [a, b, k], sign = 1) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const q = p[i],
      r = p[(i + 1) % p.length],
      v = (a * q[0] + b * q[1] - k) * sign,
      w = (a * r[0] + b * r[1] - k) * sign;
    if (v >= -1e-8) out.push(q);
    if ((v > 1e-8 && w < -1e-8) || (v < -1e-8 && w > 1e-8)) {
      const t = v / (v - w);
      out.push([q[0] + t * (r[0] - q[0]), q[1] + t * (r[1] - q[1])]);
    }
  }
  return out.filter(
    (p, i) =>
      Math.hypot(p[0] - out[(i + 1) % out.length][0], p[1] - out[(i + 1) % out.length][1]) > 1e-7,
  );
}
function roofPieces(d) {
  const rings = ownRings.map((r) => clean(r, tolerances[d])),
    ps = rings.flat(),
    ids = earcut(
      ps.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ),
    out = [];
  for (let i = 0; i < ids.length; i += 3) {
    let pieces = [ids.slice(i, i + 3).map((j) => ps[j])];
    if (d > 0)
      for (const l of roofLines) {
        const next = [];
        for (const p of pieces)
          for (const sign of [-1, 1]) {
            const q = clip(p, l, sign);
            if (q.length >= 3 && Math.abs(area(q)) > 1e-7) next.push(q);
          }
        pieces = next;
      }
    for (let p of pieces) {
      if (area(p) < 0) p = [...p].reverse();
      const center = p.reduce((v, q) => [v[0] + q[0] / p.length, v[1] + q[1] / p.length], [0, 0]);
      out.push({ p, region: regionAt(center) });
    }
  }
  return out;
}
function roofTriangle(o, ps) {
  let q = ps.map((p) => p.map(Math.fround));
  const a = q[1].map((v, i) => v - q[0][i]),
    b = q[2].map((v, i) => v - q[0][i]);
  if (Math.abs(a[2] * b[0] - a[0] * b[2]) < 0.00001) return;
  if (normalFor(...q)[1] < 0) q = q.reverse();
  o.addTriangle(
    'roof',
    ref,
    q,
    normalFor(...q),
    q.map((p) => [p[0], p[2]]),
    slate,
  );
}
function boundaryRings(polygons) {
  const edges = new Map(),
    key = (p) => p.map((v) => v.toFixed(6)).join(',');
  for (const p of polygons)
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        ka = key(a),
        kb = key(b);
      if (ka === kb) continue;
      const reverse = `${kb}|${ka}`,
        direct = `${ka}|${kb}`;
      if (edges.has(reverse)) edges.delete(reverse);
      else edges.set(direct, { a, b, ka, kb });
    }
  const out = [];
  while (edges.size) {
    const first = edges.values().next().value,
      ring = [first.a];
    let edge = first;
    let limit = edges.size + 1;
    while (limit-- > 0) {
      edges.delete(`${edge.ka}|${edge.kb}`);
      if (edge.kb === first.ka) break;
      ring.push(edge.b);
      const candidates = [...edges.values()].filter((e) => e.ka === edge.kb);
      if (!candidates.length) throw Error('Open roof-plane boundary');
      const dx = edge.b[0] - edge.a[0],
        dz = edge.b[1] - edge.a[1];
      candidates.sort(
        (a, b) =>
          Math.atan2(
            dx * (b.b[1] - b.a[1]) - dz * (b.b[0] - b.a[0]),
            dx * (b.b[0] - b.a[0]) + dz * (b.b[1] - b.a[1]),
          ) -
          Math.atan2(
            dx * (a.b[1] - a.a[1]) - dz * (a.b[0] - a.a[0]),
            dx * (a.b[0] - a.a[0]) + dz * (a.b[1] - a.a[1]),
          ),
      );
      edge = candidates[0];
    }
    if (limit < 0) throw Error('Roof-plane boundary cycle failed');
    if (ring.length >= 3 && Math.abs(area(ring)) > 1e-6) out.push(clean(ring, 0.00001));
  }
  return out;
}
function roofPlanes(r) {
  const { u, v, model, lo, hi, mid, half, hip } = r.roof;
  const U = model ? [...u, 0] : [u[0] * c - u[1] * s, u[0] * s + u[1] * c, u[0] * 12 + u[1] * 3];
  const V = model ? [...v, 0] : [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[0] * 12 + v[1] * 3];
  return [
    [V[0] / half, V[1] / half, 1 + (V[2] - mid) / half],
    [-V[0] / half, -V[1] / half, 1 - (V[2] - mid) / half],
    [U[0] / hip, U[1] / hip, (U[2] - lo) / hip],
    [-U[0] / hip, -U[1] / hip, (hi - U[2]) / hip],
  ];
}
function roofs(o, d) {
  const pieces = roofPieces(d),
    edges = new Map(),
    key = (p) => p.map((v) => v.toFixed(6)).join(',');
  if (d === 0) {
    for (const { p, region: r } of pieces)
      for (let i = 1; i < p.length - 1; i++) {
        let q = [p[0], p[i], p[i + 1]].map((p) => [p[0], roofY(p, r), p[1]]);
        if (normalFor(...q)[1] < 0) q = q.reverse();
        roofTriangle(o, q);
      }
    return;
  }
  // Merge every coplanar roof field before triangulating; intermediate clipping lines are not mesh detail.
  for (const r of regions) {
    const planes = roofPlanes(r),
      lines = [];
    for (let i = 0; i < planes.length; i++) {
      const a = planes[i];
      lines.push([a[0], a[1], -a[2]]);
      for (let j = 0; j < i; j++) {
        const b = planes[j];
        lines.push([a[0] - b[0], a[1] - b[1], b[2] - a[2]]);
      }
    }
    const groups = new Map();
    for (const piece of pieces.filter((p) => p.region === r)) {
      let parts = [piece.p];
      for (const line of lines) {
        const next = [];
        if (Math.hypot(line[0], line[1]) < 1e-8) continue;
        for (const p of parts)
          for (const sign of [-1, 1]) {
            const q = clip(p, line, sign);
            if (q.length >= 3 && Math.abs(area(q)) > 1e-7) next.push(q);
          }
        parts = next;
      }
      for (const p of parts) {
        const center = p.reduce((v, a) => [v[0] + a[0] / p.length, v[1] + a[1] / p.length], [0, 0]),
          values = planes.map((a) => a[0] * center[0] + a[1] * center[1] + a[2]),
          min = Math.min(...values),
          which = min <= 0 ? -1 : values.indexOf(min);
        if (!groups.has(which)) groups.set(which, []);
        groups.get(which).push(p);
      }
    }
    for (const polys of groups.values()) {
      const rings = boundaryRings(polys),
        outers = rings.filter((r) => area(r) > 0),
        holes = rings.filter((r) => area(r) < 0);
      for (const outer of outers) {
        const rr = [outer, ...holes.filter((h) => inside(h[0], outer))],
          ps = rr.flat(),
          ids = earcut(
            ps.flat(),
            rr.slice(1).map((_, i) => rr.slice(0, i + 1).reduce((v, r) => v + r.length, 0)),
          );
        for (let i = 0; i < ids.length; i += 3) {
          let q = ids.slice(i, i + 3).map((j) => [ps[j][0], roofY(ps[j], r), ps[j][1]]);
          if (normalFor(...q)[1] < 0) q = q.reverse();
          roofTriangle(o, q);
        }
      }
    }
  }
  for (const { p, region: r } of pieces)
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        ka = key(a),
        kb = key(b),
        k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`,
        prev = edges.get(k);
      if (!prev) edges.set(k, { a, b, r });
      else {
        edges.delete(k);
        if (prev.r !== r) {
          const ay = roofY(a, r),
            by = roofY(b, r),
            py = roofY(a, prev.r),
            qy = roofY(b, prev.r);
          if (Math.max(Math.abs(ay - py), Math.abs(by - qy)) > 0.015) {
            const q = [
              [a[0], Math.min(ay, py), a[1]],
              [b[0], Math.min(by, qy), b[1]],
              [b[0], Math.max(by, qy), b[1]],
              [a[0], Math.max(ay, py), a[1]],
            ];
            const sign = ay + by > py + qy ? 1 : -1,
              nn = [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
              ll = Math.hypot(...nn);
            quad(
              o,
              'stone',
              q,
              nn.map((v) => v / ll),
              cream,
            );
          }
        }
      }
    }
}
function cusp(x, bottom, w, h, n = 12) {
  const out = [
      [x - w / 2, bottom],
      [x + w / 2, bottom],
    ],
    spring = bottom + h - w * 0.47;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI;
    out.push([
      x + (w / 2) * Math.cos(t),
      spring + w * 0.47 * Math.sin(t) * (1 - 0.13 * Math.cos(6 * t)),
    ]);
  }
  return out;
}
function pointed(x, bottom, w, spring, rise, n = 12) {
  const p = [
    [x - w / 2, bottom],
    [x + w / 2, bottom],
  ];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    p.push([x + w / 2 - w * t, spring + rise * (1 - Math.pow(Math.abs(2 * t - 1), 1.45))]);
  }
  return p;
}
function pairedWindow(o, d, x, y, w = 2.6, h = 3.2, z = 0, ornate = false) {
  const outer = rect(x, y, w, h),
    gap = 0.19,
    ww = (w - gap - 0.36) / 2,
    holes = [-1, 1].map((sign) =>
      cusp(x + (sign * (ww + gap)) / 2, y + 0.16, ww, h - 0.35, d === 3 ? 16 : d >= 2 ? 8 : 4),
    );
  wall(o, outer, holes, z + 0.055, 0.28, trim, 'trim');
  for (const p of holes) surface(o, 'glass', p, z - 0.24, glass);
  if (d >= 2)
    for (const p of holes) {
      outline(o, 'wood', p, z - 0.2, 0.075, oak, true);
      const cx = (Math.min(...p.map((q) => q[0])) + Math.max(...p.map((q) => q[0]))) / 2;
      for (const yy of [y + h * 0.36, y + h * 0.68])
        outline(
          o,
          'wood',
          [
            [cx - ww * 0.43, yy],
            [cx + ww * 0.43, yy],
          ],
          z - 0.195,
          0.045,
          oak,
        );
    }
  if (d >= 2) {
    outline(o, 'trim', rect(x, y - 0.05, w + 0.18, h + 0.1), z + 0.09, 0.15, trim, true);
    for (const p of holes) outline(o, 'trim', p.slice(1), z + 0.12, 0.1, pale);
    for (const dx of [-w * 0.49, 0, w * 0.49]) {
      if (d === 3) {
        const pts = Array.from({ length: 18 }, (_, i) => [
          x + dx + 0.055 * Math.sin(i * Math.PI * 0.8),
          y + 0.1 + (i * (h - 0.2)) / 17,
          z + 0.15 + 0.045 * Math.cos(i * Math.PI * 0.8),
        ]);
        for (let i = 1; i < pts.length; i++) beam(o, 'trim', pts[i - 1], pts[i], 0.1, 0.1, trim);
      } else
        beam(
          o,
          'trim',
          [x + dx, y + 0.1, z + 0.15],
          [x + dx, y + h - 0.1, z + 0.15],
          0.12,
          0.12,
          trim,
        );
    }
    if (ornate && d === 3) {
      for (const dx of [-w * 0.42, w * 0.42]) {
        beam(
          o,
          'trim',
          [x + dx, y + h, z + 0.12],
          [x + dx, y + h + 0.7, z + 0.12],
          0.1,
          0.12,
          trim,
        );
        sphere(o, 'trim', [x + dx, y + h + 0.55, z + 0.12], [0.16, 0.2, 0.11], trim, 6, 4);
      }
      outline(
        o,
        'trim',
        [
          [x - w * 0.4, y + h + 0.1],
          [x - w * 0.2, y + h + 0.45],
          [x, y + h + 0.3],
          [x + w * 0.2, y + h + 0.45],
          [x + w * 0.4, y + h + 0.1],
        ],
        z + 0.15,
        0.11,
        trim,
      );
    }
  }
}
function plainWindow(o, d, x, y, w, h, z = 0, door = false) {
  const p = rect(x, y, w, h);
  surface(o, door ? 'wood' : 'glass', p, z - 0.23, door ? oak : glass);
  if (d >= 2) {
    outline(o, 'trim', p, z + 0.07, 0.12, trim, true);
    if (!door)
      for (const dx of [-w / 4, w / 4])
        outline(
          o,
          'wood',
          [
            [x + dx, y + 0.05],
            [x + dx, y + h - 0.05],
          ],
          z - 0.2,
          0.055,
          oak,
        );
  }
}
function openings(f, d) {
  const out = [];
  const n = north([f.x, f.z]);
  const same = (g) =>
    Math.abs(Math.cos(f.angle - g.angle)) > 0.99 &&
    Math.abs(f.normal[0] * (g.x - f.x) + f.normal[1] * (g.z - f.z)) < 0.18;
  if (same(front) && f.w > 14) {
    for (let i = 0; i < 4; i++) {
      const x = ((i + 0.5) / 4 - 0.5) * front.w;
      out.push({
        kind: 'front-arch',
        x,
        y: Y(212.65),
        w: 5.05,
        h: 5.0,
        p: pointed(x, Y(212.65), 5.05, Y(215.2), 2.3, d === 3 ? 18 : d >= 2 ? 8 : 4),
        depth: 2.8,
      });
    }
    for (let i = 0; i < 5; i++) {
      const x = ((i + 0.5) / 5 - 0.5) * f.w;
      out.push({ kind: 'paired', x, y: Y(220.1), w: 2.8, h: 3.4, p: rect(x, Y(220.1), 2.8, 3.4) });
    }
    return out;
  }
  if (same(manu) && f.w > 22) {
    for (const y of [214.9, 220.0]) {
      for (let i = 0; i < 3; i++) {
        const x = -f.w / 2 + 3.0 + i * 5.9;
        out.push({ kind: 'ornate', x, y: Y(y), w: 2.55, h: 3.0, p: rect(x, Y(y), 2.55, 3.0) });
      }
      for (let i = 0; i < 3; i++) {
        const x = f.w / 2 - 7.0 + i * 2.7;
        out.push({
          kind: 'loggia',
          x,
          y: Y(y - 0.15),
          w: 2.25,
          h: 3.4,
          p: arch(x, Y(y - 0.15), 2.25, Y(y + 1.75), 1.15, d === 3 ? 16 : d >= 2 ? 8 : 4),
          depth: 2.4,
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      const x = -f.w / 2 + 5.6 + i * 5.9,
        p = pointAt(f, x);
      out.push({
        kind: 'door',
        x,
        y: Math.max(Y(210.6), sample(...p) + 0.15),
        w: 1.2,
        h: 2.1,
        p: null,
      });
    }
    for (let i = 0; i < 3; i++) {
      const x = -f.w / 2 + 3 + i * 5.9;
      out.push({
        kind: 'window',
        x,
        y: Y(213.0),
        w: 0.95,
        h: 0.85,
        p: rect(x, Y(213.0), 0.95, 0.85),
      });
    }
    {
      const x = f.w / 2 - 4.3;
      out.push({
        kind: 'paired',
        x,
        y: Y(218.2),
        w: 1.35,
        h: 1.4,
        p: rect(x, Y(218.2), 1.35, 1.4),
      });
    }
    for (const w of out) if (!w.p) w.p = arch(w.x, w.y, w.w, w.y + w.h - 0.6, 0.6, 8);
    return out;
  }
  if (d > 0 && regionAt([f.x, f.z]).name === 'Coats-of-Arms tower') {
    for (let i = 0; i < 3; i++) {
      const x = ((i + 0.5) / 3 - 0.5) * f.w;
      out.push({
        kind: 'window',
        x,
        y: Y(230.6),
        w: 1.25,
        h: 3.2,
        p: rect(x, Y(230.6), 1.25, 3.2),
      });
    }
    return out;
  }
  if (
    d > 0 &&
    f.w >= 3 &&
    ['front left eastern pavilion', 'front left western pavilion', 'front right porch'].includes(
      regionAt([f.x, f.z]).name,
    )
  ) {
    const count = Math.max(1, Math.floor(f.w / 4.5));
    for (let i = 0; i < count; i++)
      for (const absY of [214.1, 218.5]) {
        const x = ((i + 0.5) / count - 0.5) * f.w;
        out.push({
          kind: 'window',
          x,
          y: Y(absY),
          w: 1.25,
          h: 2.05,
          p: rect(x, Y(absY), 1.25, 2.05),
        });
      }
    return out;
  }
  if (d === 0 || f.w < 3) return out;
  const top = regionAt([f.x, f.z]).eave,
    bottom = Math.max(Y(213), sample(f.x, f.z) + 1.0),
    count = Math.max(1, Math.floor(f.w / (d === 1 ? 8.2 : 4.8)));
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) / count - 0.5) * f.w;
    for (let y = d === 1 ? Math.max(bottom, top - 3.6) : bottom; y + 2.5 < top - 0.9; y += 5.6) {
      const w = Math.min(1.65, f.w * 0.65);
      out.push({ kind: 'window', x, y, w, h: 2.5, p: rect(x, y, w, 2.5) });
    }
  }
  if (n[0] < -22 && n[1] < -20) return out.filter((w) => w.y > Y(225));
  return out;
}
const facadeControls = [];
function walls(o, d) {
  const rings = ownRings.map((r) => clean(r, tolerances[d]));
  for (const [ri, r] of rings.entries())
    for (const f of faces(r, ri > 0)) {
      const q = facing(o, f.angle, f.x, f.z),
        ops = openings(f, d),
        holes = d > 0 ? ops.filter((w) => d >= 2 || w.kind !== 'window').map((w) => w.p) : [],
        ts = [0, 1];
      if (d > 0)
        for (const [a, b, k] of roofLines) {
          const den = a * (f.b[0] - f.a[0]) + b * (f.b[1] - f.a[1]);
          if (Math.abs(den) > 1e-9) {
            const t = (k - a * f.a[0] - b * f.a[1]) / den;
            if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
          }
        }
      ts.sort((a, b) => a - b);
      let bottom = Infinity;
      for (let i = 0; i <= Math.ceil(f.w); i++) {
        const p = [
          f.a[0] + ((f.b[0] - f.a[0]) * i) / Math.ceil(f.w),
          f.a[1] + ((f.b[1] - f.a[1]) * i) / Math.ceil(f.w),
        ];
        bottom = Math.min(bottom, sample(...p) - 0.5);
      }
      if (ri > 0) bottom = Math.min(bottom, Y([219.15, 224.5, 213.55, 223.4][ri - 1]) - 0.2);
      const bodyRuns = [];
      for (let k = 1; k < ts.length; k++) {
        const l = ts[k - 1],
          r = ts[k],
          center = (l + r) / 2,
          pp = [f.a[0] + (f.b[0] - f.a[0]) * center, f.a[1] + (f.b[1] - f.a[1]) * center],
          region = regionAt(pp),
          x0 = f.w / 2 - f.w * r,
          x1 = f.w / 2 - f.w * l;
        const previous = bodyRuns.at(-1);
        if (previous?.region === region) previous.to = r;
        else bodyRuns.push({ from: l, to: r, region });
        const pts = [l, r].map((t) => [
            f.a[0] + (f.b[0] - f.a[0]) * t,
            f.a[1] + (f.b[1] - f.a[1]) * t,
          ]),
          ys = pts.map((p) => roofY(p, region));
        quad(
          q,
          'stone',
          [
            [x1, region.eave, 0],
            [x0, region.eave, 0],
            [x0, ys[1], 0],
            [x1, ys[0], 0],
          ],
          [0, 0, 1],
          cream,
        );
      }
      for (const run of bodyRuns) {
        const x0 = f.w / 2 - f.w * run.to,
          x1 = f.w / 2 - f.w * run.from;
        wall(
          q,
          rect((x0 + x1) / 2, bottom, x1 - x0, run.region.eave - bottom),
          holes,
          0,
          d >= 2 ? 0.25 : 0,
          cream,
        );
      }
      if (d > 0)
        for (const w of ops) {
          if (w.kind === 'paired' || w.kind === 'ornate')
            pairedWindow(q, d, w.x, w.y, w.w, w.h, 0, w.kind === 'ornate');
          else if (w.kind === 'front-arch' || w.kind === 'loggia') {
            outline(q, 'trim', w.p.slice(1), 0.1, w.kind === 'front-arch' ? 0.2 : 0.14, trim);
            const back = rect(w.x, w.y, w.w, w.h);
            surface(q, 'stone', back, -w.depth, cream);
            for (let i = 0; i < w.p.length; i++) {
              const a = w.p[i],
                b = w.p[(i + 1) % w.p.length],
                nn = [a[1] - b[1], b[0] - a[0], 0],
                ll = Math.hypot(...nn);
              quad(
                q,
                'stone',
                [
                  [...a, -0.23],
                  [...a, -w.depth],
                  [...b, -w.depth],
                  [...b, -0.23],
                ],
                nn.map((v) => v / ll),
                cream,
              );
            }
            cap(
              facing(q, 0, w.x, 0),
              [
                [
                  [-w.w / 2, -w.depth],
                  [w.w / 2, -w.depth],
                  [w.w / 2, 0],
                  [-w.w / 2, 0],
                ],
              ],
              w.y,
              darkStone,
              'trim',
            );
            if (d >= 2 && w.kind === 'front-arch')
              plainWindow(q, d, w.x, w.y + 0.2, 1.15, 2.4, -w.depth + 0.27, true);
            facadeControls.push({ name: w.kind, face: f, opening: w });
          } else
            plainWindow(
              q,
              d,
              w.x,
              w.y,
              w.w,
              w.h,
              d === 1 && w.kind === 'window' ? 0.26 : 0,
              w.kind === 'door',
            );
        }
      if (d >= 2 && f.w > 2) {
        const top = regionAt([f.x, f.z]).eave;
        ledge(q, 0, top - 0.25, 0.05, f.w, 0.22, 0.4, pale);
        for (const x of [-f.w / 2 + 0.16, f.w / 2 - 0.16])
          if (ri === 0 && f.w > 5)
            B(
              q,
              'stone',
              x,
              Math.max(bottom, Y(210)),
              0.025,
              0.3,
              top - Math.max(bottom, Y(210)),
              0.06,
              ochre,
            );
      }
    }
}
function chimney(o, d, rings) {
  const r = rings[0],
    center = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]),
    radius = Math.max(...r.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1]))),
    n = [8, 8, 24, 40][d],
    base = Y(216.85),
    levels = [
      [0, radius],
      [27.4, 1.05],
      [27.6, 1.28],
      [27.9, 1.28],
      [28.1, 1.0],
      [30.8, 0.66],
      [31, 0.84],
      [31.25, 0.84],
      [31.45, 0.63],
      [33, 0.48],
    ],
    rr = (
      d === 0
        ? [
            [0, radius],
            [28, 1.1],
            [31, 0.78],
            [33, 0.48],
          ]
        : levels
    ).map(([y, r]) => radialRing(base + y, r, r, n, center));
  loft(o, 'stone', rr, cream, { cap: false });
  if (d >= 2) {
    loft(
      o,
      'trim',
      [radialRing(base + 33, 0.48, 0.48, n, center), radialRing(base + 33, 0.33, 0.33, n, center)],
      pale,
      { cap: false },
    );
    loft(
      o,
      'stone',
      [
        radialRing(base + 33, 0.33, 0.33, n, center),
        radialRing(base + 31.9, 0.33, 0.33, n, center),
      ],
      darkStone,
      { cap: false },
    );
  }
  cap(
    o,
    [radialRing(base + 31.85, 0.32, 0.32, n, center).map((p) => [p[0], p[2]])],
    base + 31.85,
    iron,
    'iron',
  );
}
function hip(o, rings, eave, rise, d) {
  const r = clean(rings[0], tolerances[d]),
    xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]),
    min = [Math.min(...xs), Math.min(...zs)],
    max = [Math.max(...xs), Math.max(...zs)],
    mid = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  for (const f of faces(r)) {
    const q = facing(o, f.angle, f.x, f.z),
      lo = Math.min(sample(...f.a), sample(...f.b)) - 0.5;
    wall(
      q,
      rect(0, lo, f.w, eave - lo),
      d >= 2 ? openings(f, d).map((w) => w.p) : [],
      0,
      d >= 2 ? 0.23 : 0,
      cream,
    );
    if (d)
      for (const w of openings(f, d)) plainWindow(q, d, w.x, w.y, w.w, w.h, d === 1 ? 0.26 : 0);
  }
  const edge = [];
  for (const f of faces(r))
    edge.push([
      [f.a[0], eave, f.a[1]],
      [f.b[0], eave, f.b[1]],
      [mid[0], eave + rise, mid[1]],
    ]);
  for (let q of edge) {
    if (normalFor(...q)[1] < 0) q = q.reverse();
    o.addTriangle(
      'roof',
      ref,
      q,
      normalFor(...q),
      q.map((p) => [p[0], p[2]]),
      slate,
    );
  }
}
function loggiaColumns(o, d) {
  if (d < 2) return;
  const q = facing(o, manu.angle, manu.x, manu.z);
  for (const y of [214.75, 219.85])
    for (const i of [0, 1, 2, 3]) {
      const x = manu.w / 2 - 8.35 + i * 2.7,
        b = Y(y);
      cylinder(q, 'trim', x, 0.06, b, b + 1.9, 0.105, 0.1, trim, d === 3 ? 12 : 8);
      B(q, 'trim', x, b, 0.06, 0.32, 0.15, 0.32, trim);
      B(q, 'trim', x, b + 1.8, 0.06, 0.35, 0.17, 0.35, trim);
    }
}
function battlements(o, d) {
  if (d < 2) return;
  for (const f of [front, manu]) {
    const q = facing(o, f.angle, f.x, f.z),
      top = regionAt([f.x, f.z]).eave,
      count = Math.floor(f.w / 0.75);
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count - 0.5) * f.w;
      panel(
        q,
        'stone',
        d === 3
          ? [
              [x - 0.34, top],
              [x + 0.34, top],
              [x + 0.34, top + 0.12],
              [x + 0.25, top + 0.12],
              [x + 0.25, top + 0.25],
              [x + 0.16, top + 0.25],
              [x + 0.16, top + 0.39],
              [x + 0.07, top + 0.39],
              [x + 0.07, top + 0.57],
              [x - 0.07, top + 0.57],
              [x - 0.07, top + 0.39],
              [x - 0.16, top + 0.39],
              [x - 0.16, top + 0.25],
              [x - 0.25, top + 0.25],
              [x - 0.25, top + 0.12],
              [x - 0.34, top + 0.12],
            ]
          : [
              [x - 0.34, top],
              [x + 0.34, top],
              [x, top + 0.62],
            ],
        -0.08,
        0.14,
        pale,
      );
    }
  }
}
function paving(o, d) {
  for (const [i, r] of courts.entries())
    cap(o, [r], Y([219.15, 224.5, 213.55, 223.4][i]), trim, 'trim');
  if (d === 0) return;
  const floor = Y(212.65),
    z = front.z,
    pad = [
      [frontA[0], z],
      [frontB[0], z],
      [frontB[0] + 1, z + 3.2],
      [frontA[0] - 0.4, z + 3.2],
    ];
  cap(o, [pad], floor, trim, 'trim');
  const n = d === 1 ? 7 : 13,
    run = 3.3,
    span = 10.2,
    x = -2.5;
  for (let i = 0; i < n; i++) {
    const zz = z + 3.2 + (run * i) / n,
      top = floor - ((floor - 0.03) * i) / n;
    B(
      o,
      'trim',
      x,
      Math.min(sample(x, zz) - 0.3, -0.3),
      zz + run / n / 2,
      span,
      top - Math.min(sample(x, zz) - 0.3, -0.3),
      run / n + 0.015,
      trim,
    );
  }
  for (const side of [-1, 1]) {
    const xx = x + side * (span / 2 + 0.3);
    beam(o, 'stone', [xx, floor + 0.2, z + 3.2], [xx, 0.25, z + 6.5], 0.38, 0.45, cream);
  }
  // Only bounded palace courts receive slabs; source terrain is never edited.

  if (d >= 2) {
    const q = facing(o, front.angle, front.x, front.z);
    for (const [a, b] of [
      [-front.w / 2, -8],
      [3, front.w / 2],
    ]) {
      if (b <= a) continue;
      B(q, 'stone', (a + b) / 2, floor, 2.8, b - a, 0.25, 0.36, cream);
      B(q, 'trim', (a + b) / 2, floor + 1.02, 2.8, b - a, 0.16, 0.4, trim);
      for (let xx = a + 0.3; xx < b; xx += 0.55)
        cylinder(q, 'trim', xx, 2.8, floor + 0.25, floor + 1.05, 0.065, 0.09, trim, 6);
    }
  }
  // Two-tier fountain on its own raised exterior landing.
  if (d >= 2) {
    const p = pointAt(front, -1.4, 1.65);
    cylinder(o, 'trim', p[0], p[1], floor + 0.03, floor + 0.28, 1.12, 1.12, trim, 24);
    cylinder(o, 'trim', p[0], p[1], floor + 0.28, floor + 0.65, 0.23, 0.16, trim, 12);
    cylinder(o, 'trim', p[0], p[1], floor + 0.65, floor + 0.8, 0.7, 0.7, trim, 20);
    cylinder(o, 'trim', p[0], p[1], floor + 0.8, floor + 1.35, 0.12, 0.1, trim, 12);
    cylinder(o, 'trim', p[0], p[1], floor + 1.35, floor + 1.48, 0.36, 0.36, trim, 16);
  }
}
function terraces(o, d) {
  if (d < 2) return;
  const zones = [
    {
      r: [
        [-42, -23],
        [-25, -21],
        [-27, -8],
        [-38, -8],
      ],
      floor: 220.2,
    },
    {
      r: [
        [-39, -7],
        [-25, -5],
        [-14, 1],
        [-17, 7],
        [-34, 3],
      ],
      floor: 219.65,
    },
    {
      r: [
        [-31, 5],
        [-14, 8],
        [-14, 12],
        [-29, 10],
      ],
      floor: 219.6,
    },
  ];
  for (const t of zones) {
    const r = t.r.map(local),
      top = Math.max(Y(t.floor), ...r.map((p) => sample(...p) + 0.12));
    cap(o, [r], top, darkStone, 'trim');
    for (const f of faces(r)) {
      const q = facing(o, f.angle, f.x, f.z),
        bottom = Math.min(sample(...f.a), sample(...f.b)) - 0.3;
      wall(q, rect(0, bottom, f.w, Math.max(0.1, top - bottom)), [], 0, 0, cream);
      B(q, 'stone', 0, top, 0, f.w, 0.68, 0.25, cream);
      B(q, 'trim', 0, top + 0.68, 0, f.w, 0.12, 0.38, trim);
    }
  }
  // Straight Patim landing/flight and two-column porch are distinct from the Central Patio stair.
  const p = local([-3, 11]),
    q = facing(o, 0.445, p[0], p[1]),
    top = Y(223.4);
  B(q, 'trim', 0, top - 0.25, 0, 3.1, 0.25, 2.3, trim);
  for (const xx of [-1.25, 1.25]) cylinder(q, 'trim', xx, 0.7, top, top + 3, 0.1, 0.1, trim, 10);
  B(q, 'roof', 0, top + 3, 0, 3.4, 0.2, 2.6, slate);
  for (let i = 0; i < 14; i++) {
    const yy = top - i * 0.22,
      zz = 1.15 + i * 0.24;
    B(q, 'trim', 0, yy - 0.22, zz, 1.7, 0.22, 0.25, trim);
  }
  for (const xx of [-0.9, 0.9])
    beam(q, 'iron', [xx, top + 1, 1.15], [xx, top - 2.08, 4.27], 0.05, 0.06, iron);
}
function details(o, d) {
  if (d < 2) return;
  const r = main[0];
  for (const i of [45, 46]) {
    const p = r[i],
      next = r[(i + 1) % r.length],
      prev = r[(i + r.length - 1) % r.length];
    for (const q of [next, prev]) {
      const f = faceBetween(p, q),
        out = facing(o, f.angle, f.x, f.z);
      B(out, 'stone', f.w / 2 - 0.18, Y(219), 0.025, 0.36, Y(240.3) - Y(219), 0.08, ochre);
    }
  }
  if (d === 3) {
    const r = regions[0],
      rr = r.zone.map(local);
    for (const f of faces(rr)) {
      const q = facing(o, f.angle, f.x, f.z);
      B(q, 'trim', 0, Y(239.2), 0.12, f.w, 0.7, 0.28, pale);
      for (let x = -f.w / 2 + 0.5; x < f.w / 2; x += 0.7)
        surface(q, 'inlay', rect(x, Y(239.45), 0.26, 0.27), 0.285, cream);
    }
  }
}
function build(o, d) {
  facadeControls.length = 0;
  roofs(o, d);
  walls(o, d);
  hip(o, frame.authoredComponents.westernEntry, Y(221.8), 3.7, d);
  chimney(o, d, frame.authoredComponents.southChimney);
  chimney(o, d, frame.authoredComponents.northChimney);
  loggiaColumns(o, d);
  battlements(o, d);
  paving(o, d);
  terraces(o, d);
  details(o, d);
}
export const sintraClose = (o) => build(o, 3),
  sintraStreet = (o) => build(o, 2),
  sintraDistrict = (o) => build(o, 1),
  sintraSkyline = (o) => build(o, 0);
const surfaces = {
  stone: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.93, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0.02 },
  wood: { slot: 'door', localRef: ref, roughness: 0.83, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.15 },
  inlay: { slot: 'trim', localRef: ref, roughness: 0.85, metallic: 0 },
};
export const sintraNationalPalaceModel = {
  id: 'sintra_national_palace',
  key: 'sintra_national_palace',
  recipe: 'structure-sintra-national-palace.mjs',
  cell: 'ey/eyc',
  title: 'Sintra National Palace',
  brief:
    'Native irregular palace ranges and four open courts/lightwells, two33m kitchen-floor-to-top open-mouthed white conical chimneys, tall northwest Coats-of-Arms tower with hipped red roof and stone fret cornice, stepped upper royal ranges and kitchen. Southeast main hall has four real pointed exterior arcade recesses, five deep paired cusp-headed upper window groups, serrated pale parapet, raised stone landing, broad13-tread stair, balustrades and two-tier fountain. Lower front flanking masses and porch connection, eastern Manueline wing with six original abstract carved paired window groups and two three-arch open loggias, low basement lights/doors, yellow corner bands and red tiled roofs. Separate native western entry range, own retaining/terrace walls and Patim porch/straight stair. Town buildings, interiors, literal heraldry, temporary works and vegetation excluded.',
  camera: [105, 82, 123],
  lookAt: [5, 18, -8],
  qaCameras: [
    { name: 'main-arcade', position: [-3, 10, 70], lookAt: [-3, 10, 28] },
    { name: 'manueline-wing', position: [65, 15, 65], lookAt: [38, 12, 20] },
    { name: 'kitchen-chimneys', position: [67, 39, 40], lookAt: [25, 28, -2] },
    { name: 'raised-courts', position: [-3, 32, 12], lookAt: [6, 12, 14] },
    { name: 'rear-tower', position: [-77, 37, -85], lookAt: [-25, 24, -53] },
    { name: 'west-terraces', position: [-75, 24, 25], lookAt: [-29, 14, -1] },
    { name: 'window-recess', position: [-1, 12, 42], lookAt: [-1, 12, 31] },
    { name: 'loggia-openings', position: [63, 15, 38], lookAt: [50, 12, 21] },
  ],
  mediumFiContext: { scale: 2.1, cameraYaw: 0, groundY: -8 },
  build: sintraClose,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent public DGT July2024 classified LiDAR:127 original byte chunks,911745 unchanged decoded class2 ground points preserved before geometry. Fixed12-neighbor inverse squared distance derivative on2m125x125grid;210.5518m Cascais dry forecourt datum at[-6,38]. Maximum nearest ground gap22.123m under covered areas; hidden-ground interpolation uncertain. No source terrain fitting/flattening. Compatible host required; default coarse terrain not certified. Roof/terrace class6 observations remain separate structural controls.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-sintra-national-palace.mjs',
    level: 'skyline',
    export: 'sintraSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'sintraDistrict', errorMeters: 3, surfaces },
      street: { export: 'sintraStreet', errorMeters: 1.5, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    'Dated local2011–2019 photos and public2024 LiDAR describe permanent exterior features; current2026 chapel restoration finish not asserted. Intermediate roof ridges/eaves, unknown back-face bay counts, carved details, terraces, Patim/stair placement and construction thresholds are interpretations. Four front arches are exterior recesses with back walls, not four through-gateways. Original abstract carving/geometry replaces exact heraldry/inscriptions. This model remains in review until current geometry, all detail levels, terrain/placement and actual renders pass.',
  ],
};
export {
  build,
  clean,
  courts,
  facadeControls,
  faces,
  frame,
  front,
  local,
  manu,
  north,
  openings,
  paving,
  pointAt,
  regionAt,
  regions,
  roofLines,
  roofPieces,
  roofs,
  roofY,
  sample,
  terraces,
  terrain,
  tolerances,
  walls,
};
