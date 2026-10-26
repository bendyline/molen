/** Aachen's surviving multipart church: current dome/spire, Gothic glass choir and native chapel footprints. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, beamPath, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u1/u1h/aachen_cathedral/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = {
    wall: rgb('a4aaa6'),
    trim: rgb('c3bba5'),
    roof: rgb('71818b'),
    glass: rgb('4c6673'),
    metal: rgb('596666'),
    door: rgb('635640'),
  };
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', localRef: 'palette:#fefffe', roughness: 0.84, metallic: 0.08 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.37, metallic: 0.08 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.35 },
  door: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
};
const centroid = (p) => [0, 1].map((k) => p.reduce((s, p) => s + p[k], 0) / p.length),
  area = (p) =>
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
function tri(o, s, p, h, col = C[s]) {
  if (h && normalFor(...p).reduce((a, v, i) => a + v * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  const n = normalFor(...p),
    a = n.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, p, n, p.map(uv), col);
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, p, y, up = true, col = C[s]) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function walls(o, s, p, y0, y1, col = C[s]) {
  if (y1 - y0 < 0.001) return;
  const sign = area(p) > 0 ? 1 : -1;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
}
const rect = (x, z, w, l) => [
  [x - w / 2, z - l / 2],
  [x + w / 2, z - l / 2],
  [x + w / 2, z + l / 2],
  [x - w / 2, z + l / 2],
];
function prism(o, s, p, y0, y1, d, col = C[s]) {
  walls(o, s, p, y0, y1, col);
  cap(o, s, p, y1, true, col);
  if (d > 0) cap(o, s, p, y0, false, col);
}
function inside(q, p) {
  let b = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if (
      p[i][1] > q[1] !== p[j][1] > q[1] &&
      q[0] < ((p[j][0] - p[i][0]) * (q[1] - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]
    )
      b = !b;
  return b;
}
function clip(p, k, value, less) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      ai = less ? a[k] <= value : a[k] >= value,
      bi = less ? b[k] <= value : b[k] >= value;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (value - a[k]) / (b[k] - a[k]);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
}
function face(a, b, sign) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [sign * t[1], -sign * t[0]];
  return {
    len,
    t,
    n: [n[0], 0, n[1]],
    P: (u, y, dep = 0) => [a[0] + t[0] * u + n[0] * dep, y, a[1] + t[1] * u + n[1] * dep],
  };
}
function panel(o, s, f, u, y, w, h, dep = 0, col = C[s]) {
  Q(
    o,
    s,
    [
      f.P(u - w / 2, y, dep),
      f.P(u + w / 2, y, dep),
      f.P(u + w / 2, y + h, dep),
      f.P(u - w / 2, y + h, dep),
    ],
    f.n,
    col,
  );
}
function F(o, s, f, a, b, depth, w, h = w, col = C[s]) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 1e-7) return;
  const n = [((-(b[1] - a[1]) / length) * w) / 2, (((b[0] - a[0]) / length) * w) / 2];
  const points = [
    a.map((v, i) => v + n[i]),
    b.map((v, i) => v + n[i]),
    b.map((v, i) => v - n[i]),
    a.map((v, i) => v - n[i]),
  ];
  Q(
    o,
    s,
    points.map((p) => f.P(...p, depth)),
    f.n,
    col,
  );
  // Large carved mouldings retain actual side reveals; fine lead bars use a front strip.
  if (s === 'trim' && w > 0.12) {
    for (const [i, j, sign] of [
      [0, 1, 1],
      [3, 2, -1],
    ])
      Q(
        o,
        s,
        [
          f.P(...points[i], depth),
          f.P(...points[j], depth),
          f.P(...points[j], depth - Math.min(h, 0.12)),
          f.P(...points[i], depth - Math.min(h, 0.12)),
        ],
        [sign * f.t[0] * n[0], sign * n[1], sign * f.t[1] * n[0]],
        col,
      );
  }
}
function sampleRing(p, n) {
  const lengths = p.map((a, i) =>
      Math.hypot(p[(i + 1) % p.length][0] - a[0], p[(i + 1) % p.length][1] - a[1]),
    ),
    sum = lengths.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, (_, i) => {
    let q = (i * sum) / n,
      j = 0;
    while (q > lengths[j] && j < lengths.length - 1) {
      q -= lengths[j];
      j++;
    }
    return p[j].map((v, k) => v + ((p[(j + 1) % p.length][k] - v) * q) / lengths[j]);
  });
}
function dimensions(r) {
  const p = r.outline,
    c = centroid(p),
    bounds = {
      min: [0, 1].map((k) => Math.min(...p.map((p) => p[k]))),
      max: [0, 1].map((k) => Math.max(...p.map((p) => p[k]))),
    };
  return { c, bounds };
}
function data(r) {
  const e = plan.sectionEstimates.unknownSouthChoirConnector,
    h = r.heightMeters ?? e.heightMeters,
    rise =
      r.id === 'way/734807753'
        ? 0.6
        : r.roofHeightMeters || (!r.heightMeters ? e.roofHeightMeters : 0);
  return {
    height: h,
    eave: h - rise,
    min: r.minHeightMeters,
    shape: r.roofShape ?? e.roofShape,
    rise,
  };
}
function pyramidHeight(q, p, c, eave, rise) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      den = (a[1] - b[1]) * (c[0] - b[0]) + (b[0] - a[0]) * (c[1] - b[1]);
    if (Math.abs(den) < 1e-9) continue;
    const u = ((a[1] - b[1]) * (q[0] - b[0]) + (b[0] - a[0]) * (q[1] - b[1])) / den,
      v = ((b[1] - c[1]) * (q[0] - b[0]) + (c[0] - b[0]) * (q[1] - b[1])) / den;
    if (u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001) return eave + rise * u;
  }
  return eave;
}
function gableAxis(r) {
  const { bounds } = dimensions(r),
    x = bounds.max[0] - bounds.min[0],
    z = bounds.max[1] - bounds.min[1];
  return x > z ? 1 : 0;
}
function heightAt(r, q) {
  const d = data(r),
    { c, bounds } = dimensions(r);
  if (!inside(q, r.outline)) return -Infinity;
  if (d.shape === 'flat') return d.height;
  if (d.shape === 'pyramidal') return pyramidHeight(q, r.outline, c, d.eave, d.rise);
  if (d.shape === 'gabled') {
    const k = gableAxis(r),
      half = (bounds.max[k] - bounds.min[k]) / 2;
    return (
      d.eave + d.rise * Math.max(0, 1 - Math.abs(q[k] - (bounds.min[k] + bounds.max[k]) / 2) / half)
    );
  }
  return d.height;
}
function dome(o, r, d) {
  const { c } = dimensions(r),
    isMain = r.id === 'way/505513553',
    base = data(r).eave,
    n = [8, 16, 32, 64][d],
    poly = sampleRing(r.outline, n),
    top = isMain ? 38.7 : data(r).height,
    ys =
      d === 0
        ? [
            [0, 1],
            [0.65, 0.72],
            [1, 0.15],
          ]
        : d === 1
          ? [
              [0, 1],
              [0.35, 1.02],
              [0.72, 0.62],
              [1, 0.15],
            ]
          : [
              [0, 1],
              [0.15, 1.015],
              [0.36, 0.98],
              [0.58, 0.85],
              [0.78, 0.59],
              [0.92, 0.27],
              [1, 0.15],
            ];
  const rings = ys.map(([t, scale]) =>
    poly.map((p) => [
      c[0] + (p[0] - c[0]) * scale,
      base + (top - base) * t,
      c[1] + (p[1] - c[1]) * scale,
    ]),
  );
  if (area(poly) > 0) for (const ring of rings) ring.reverse();
  loft(o, 'roof', rings, C.roof, { cap: false });
  // Center fans close resampled rings without collinear triangle fans at their rim.
  for (const [ring, up] of [
    [rings[0], false],
    [rings.at(-1), true],
  ])
    for (let i = 0; i < ring.length; i++)
      tri(
        o,
        'roof',
        [[c[0], ring[0][1], c[1]], ring[i], ring[(i + 1) % ring.length]],
        [0, up ? 1 : -1, 0],
      );
  if (d >= 2)
    for (let i = 0; i < n; i += d === 2 ? 8 : 4) {
      for (let j = 1; j < rings.length; j++)
        beam(o, 'metal', rings[j - 1][i], rings[j][i], 0.045, 0.055, C.metal);
    }
  if (isMain) {
    const posts = d === 0 ? 4 : 8,
      phase = Math.PI / 8,
      rr = 1.05;
    cap(
      o,
      'roof',
      radialRing(0, rr * 1.2, rr * 1.2, 8, [c[0], c[1]], phase).map((p) => [p[0], p[2]]),
      38.8,
    );
    for (let i = 0; i < posts; i++) {
      const a = phase + (i * tau) / posts,
        x = c[0] + Math.cos(a) * rr,
        z = c[1] + Math.sin(a) * rr;
      beam(o, 'trim', [x, 38.8, z], [x, 41.15, z], d === 0 ? 0.17 : 0.13, 0.16, C.trim);
    }
    const a = radialRing(41.2, 1.26, 1.26, 8, c, phase),
      b = radialRing(42, 0.16, 0.16, 8, c, phase);
    loft(o, 'roof', [a, b], C.roof);
    if (d >= 1)
      for (const y of [38.85, 41.15]) {
        const ring = radialRing(y, rr, rr, 8, c, phase);
        beamPath(o, 'metal', ring.slice(0, 8), 0.1, 0.12, C.metal, true);
      }
    if (d >= 2) {
      beam(o, 'metal', [c[0], 42, c[1]], [c[0], 43.25, c[1]], 0.055, 0.055, C.metal);
      beam(o, 'metal', [c[0] - 0.36, 42.82, c[1]], [c[0] + 0.36, 42.82, c[1]], 0.05, 0.05, C.metal);
    }
  }
}
function roof(o, r, d, p) {
  const q = data(r),
    { c, bounds } = dimensions(r);
  if (q.shape === 'dome') {
    dome(o, r, d);
    return;
  }
  if (q.shape === 'flat' || q.rise === 0) {
    cap(o, 'wall', p, q.height);
    return;
  }
  if (q.shape === 'gabled') {
    const k = gableAxis(r),
      mid = (bounds.min[k] + bounds.max[k]) / 2,
      half = (bounds.max[k] - bounds.min[k]) / 2,
      height = (p) => q.eave + q.rise * Math.max(0, 1 - Math.abs(p[k] - mid) / half);
    for (const less of [true, false]) {
      const poly = clip(p, k, mid, less),
        ix = earcut(poly.flat());
      for (let i = 0; i < ix.length; i += 3)
        tri(
          o,
          'roof',
          ix.slice(i, i + 3).map((j) => [poly[j][0], height(poly[j]), poly[j][1]]),
          [0, 1, 0],
        );
    }
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        f = face(a, b, area(p) > 0 ? 1 : -1),
        split =
          (a[k] - mid) * (b[k] - mid) < 0
            ? [a, a.map((v, j) => v + ((b[j] - v) * (mid - a[k])) / (b[k] - a[k])), b]
            : [a, b];
      for (let j = 1; j < split.length; j++) {
        const u = split[j - 1],
          v = split[j];
        if (Math.max(height(u), height(v)) <= q.eave + 0.001) continue;
        const a0 = [u[0], q.eave, u[1]],
          b0 = [v[0], q.eave, v[1]],
          a1 = [u[0], height(u), u[1]],
          b1 = [v[0], height(v), v[1]];
        if (height(u) <= q.eave + 1e-6) tri(o, 'wall', [a0, b0, b1], f.n);
        else if (height(v) <= q.eave + 1e-6) tri(o, 'wall', [a0, b0, a1], f.n);
        else Q(o, 'wall', [a0, b0, b1, a1], f.n);
      }
    }
  } else
    for (let i = 0; i < p.length; i++)
      tri(
        o,
        'roof',
        [
          [p[i][0], q.eave, p[i][1]],
          [p[(i + 1) % p.length][0], q.eave, p[(i + 1) % p.length][1]],
          [c[0], q.height, c[1]],
        ],
        [0, 1, 0],
      );
  if (d >= 2) {
    const z = (bounds.min[1] + bounds.max[1]) / 2;
    if (r.id === 'way/306573602') {
      beam(o, 'metal', [c[0], q.height, c[1]], [c[0], q.height + 1.2, c[1]], 0.05, 0.05, C.metal);
      beam(
        o,
        'metal',
        [c[0] - 0.38, q.height + 0.8, c[1]],
        [c[0] + 0.38, q.height + 0.8, c[1]],
        0.045,
        0.045,
        C.metal,
      );
    } else if (q.shape === 'gabled')
      beam(
        o,
        'metal',
        [bounds.min[0], q.height, z],
        [bounds.max[0], q.height, z],
        0.06,
        0.08,
        C.metal,
      );
  }
}
function massing(o, d) {
  for (const r of plan.parts) {
    const q = data(r),
      p = d === 0 && r.outline.length > 11 ? r.outline.filter((_, i) => i % 2 === 0) : r.outline;
    walls(o, 'wall', p, q.min === 0 ? -0.35 : q.min, q.eave);
    if (d > 0 && q.min > 0) cap(o, 'wall', p, q.min, false);
    roof(o, r, d, p);
  }
  let p = clip(plan.outline, 0, -22, true);
  p = clip(p, 1, -10, true);
  if (d === 0) {
    let changed = true;
    while (changed && p.length > 5) {
      changed = false;
      for (let i = 0; i < p.length; i++) {
        const a = p[(i + p.length - 1) % p.length],
          b = p[i],
          c = p[(i + 1) % p.length],
          len = Math.hypot(c[0] - a[0], c[1] - a[1]),
          distance = Math.abs((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / len;
        if (distance < 0.8) {
          p.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
  }
  const extra = {
    id: 'estimated-northwest-infill',
    outline: p,
    minHeightMeters: 0,
    heightMeters: 20,
    roofHeightMeters: 7,
    roofShape: 'gabled',
  };
  walls(o, 'wall', p, -0.35, 13);
  roof(o, extra, d, p);
}
function archPath(u, y, w, h, n) {
  const half = w / 2,
    rise = Math.min(h * 0.27, w * 1.05),
    spring = y + h - rise;
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = -half + (w * i) / n;
    return [u + x, spring + rise * Math.sqrt(Math.max(0, 1 - Math.abs(x / half)))];
  });
}
function curve(o, s, f, p, depth, width, col = C[s]) {
  for (let i = 1; i < p.length; i++) F(o, s, f, p[i - 1], p[i], depth, width, width, col);
}
function rose(o, f, u, y, r, d) {
  const n = d === 2 ? 6 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n;
    F(
      o,
      'trim',
      f,
      [u + Math.cos(a) * r, y + Math.sin(a) * r],
      [u + Math.cos(b) * r, y + Math.sin(b) * r],
      0.11,
      0.065,
      0.065,
      C.trim,
    );
  }
  if (d === 3)
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      F(
        o,
        'trim',
        f,
        [u + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2],
        [u + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95],
        0.11,
        0.045,
        0.05,
        C.trim,
      );
    }
}
function gothic(o, f, u, y, w, h, d, kind = 'window') {
  const path = archPath(u, y, w, h, [2, 2, 6, 10][d]),
    poly = [[u - w / 2, y], [u + w / 2, y], ...path.slice().reverse()],
    ix = earcut(poly.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      kind === 'door' ? 'door' : 'glass',
      ix.slice(i, i + 3).map((j) => f.P(poly[j][0], poly[j][1], 0.04)),
      f.n,
    );
  if (d === 0) return;
  if (d === 1) {
    for (const dx of [-w / 2, w / 2])
      panel(o, 'trim', f, u + dx, y, 0.16, h - Math.min(h * 0.27, w * 1.05), 0.07);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      Q(
        o,
        'trim',
        [
          f.P(...a, 0.07),
          f.P(...b, 0.07),
          f.P(b[0], b[1] + 0.14, 0.07),
          f.P(a[0], a[1] + 0.14, 0.07),
        ],
        f.n,
      );
    }
    return;
  }
  const spring = path[0][1];
  for (const dx of [-w / 2, w / 2])
    F(o, 'trim', f, [u + dx, y - 0.05], [u + dx, spring + 0.05], 0.1, 0.16, 0.2);
  curve(o, 'trim', f, path, 0.1, 0.17);
  if (d === 3) {
    const outer = archPath(u, y - 0.08, w + 0.48, h + 0.39, 10);
    curve(o, 'trim', f, outer, 0.08, 0.09);
  }
  F(o, 'trim', f, [u - w / 2 - 0.1, y - 0.05], [u + w / 2 + 0.1, y - 0.05], 0.11, 0.2, 0.23);
  const columns = h > 12 ? 3 : 2,
    step = w / columns;
  for (let j = 1; j < columns; j++)
    F(
      o,
      'trim',
      f,
      [u - w / 2 + j * step, y],
      [u - w / 2 + j * step, spring - 0.3],
      0.1,
      0.075,
      0.095,
    );
  const rows = h > 12 ? 6 : h > 5 ? 3 : 2;
  for (let j = 1; j < rows; j++)
    F(
      o,
      'metal',
      f,
      [u - w / 2, y + ((spring - y) * j) / rows],
      [u + w / 2, y + ((spring - y) * j) / rows],
      0.095,
      0.035,
      0.045,
    );
  if (kind === 'door') {
    if (d === 3)
      for (let j = 1; j < 6; j++)
        F(
          o,
          'metal',
          f,
          [u - w / 2, y + (h * j) / 7],
          [u + w / 2, y + (h * j) / 7],
          0.09,
          0.04,
          0.05,
        );
    return;
  }
  if (d === 3) {
    for (let j = 0; j < columns; j++)
      for (let k = 0; k < rows; k++) {
        const xx = u - w / 2 + (j + 0.5) * step,
          yy = y + ((k + 0.5) * (spring - y)) / rows;
        panel(
          o,
          'glass',
          f,
          xx,
          yy,
          step * 0.57,
          ((spring - y) / rows) * 0.41,
          0.055,
          (j + k) % 3 === 0 ? rgb('5b6e78') : (j + k) % 3 === 1 ? rgb('6a7772') : rgb('4b6378'),
        );
      }
    // Original restrained lead grid; this is not a copied stained-glass image.
    for (let j = 1; j < columns * 3; j++)
      F(
        o,
        'metal',
        f,
        [u - w / 2 + (j * w) / (columns * 3), y],
        [u - w / 2 + (j * w) / (columns * 3), spring - 0.4],
        0.065,
        0.018,
        0.021,
      );
  }
  const r = Math.min(w * 0.19, (h - (spring - y)) * 0.2);
  rose(o, f, u, spring + r * 0.3, r, d);
  if (d === 3)
    for (const dx of [-0.8 * r, 0.8 * r]) rose(o, f, u + dx, spring - r * 1.4, r * 0.68, d);
}
function exposedBottom(r, q, top) {
  let h = 0;
  for (const other of plan.parts) {
    if (other.id === r.id || data(other).min >= top - 0.1) continue;
    h = Math.max(h, heightAt(other, q));
  }
  return h;
}
function details(o, d) {
  for (const r of plan.parts) {
    const q = data(r),
      p = r.outline;
    if (q.eave - q.min < 3 || q.shape === 'dome') continue;
    const sign = area(p) > 0 ? 1 : -1,
      choir = ['way/505513555', 'way/505513556', 'way/505513557'].includes(r.id),
      west = r.id === 'way/505623457',
      drum = r.id === 'way/211100408';
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        f = face(a, b, sign);
      if (f.len < 1.6) continue;
      const count = choir
        ? Math.max(1, Math.round(f.len / 6.6))
        : west
          ? Math.max(1, Math.floor(f.len / 4))
          : drum
            ? 1
            : Math.max(1, Math.floor(f.len / 5.5));
      if (d === 0 && !choir && !west && !drum) continue;
      for (let j = 0; j < count; j++) {
        const u = (f.len * (j + 0.5)) / count,
          point = f.P(u, 0, 0.15),
          cover = exposedBottom(r, [point[0], point[2]], q.eave);
        if (west) {
          for (const [y, h] of d === 0
            ? [[32, 9]]
            : [
                [6, 8],
                [19, 9],
                [33, 10],
              ])
            if (cover < y + h * 0.5)
              gothic(
                o,
                f,
                u,
                Math.max(y, cover + 0.15),
                Math.min(1.8, (f.len / count) * 0.54),
                Math.max(1, h - Math.max(0, cover - y)),
                d,
              );
        } else {
          const y = Math.max(q.min + 0.6, choir ? 1.6 : 2.2, cover + 0.15),
            h = q.eave - 0.65 - y,
            w = Math.min(choir ? 4.4 : drum ? 3.1 : 2.5, (f.len / count) * 0.72);
          if (h < 1.8) continue;
          gothic(o, f, u, y, w, h, d);
        }
      }
      if (d > 0 && coveringFacade(r, f)) {
        for (const yy of [q.eave - 0.14, Math.max(q.min + 0.3, 0.4)])
          F(o, 'trim', f, [0, yy], [f.len, yy], 0.04, 0.12, 0.17);
      }
    }
  }
}
function coveringFacade(r, f) {
  const p = f.P(f.len / 2, 0, 0.2);
  return exposedBottom(r, [p[0], p[2]], data(r).eave) < data(r).eave - 0.5;
}
function figure(o, f, u, y, d) {
  const x = f.P(u, y, 0.45),
    n = d === 2 ? 4 : 8;
  loft(
    o,
    'trim',
    [
      radialRing(y, 0.32, 0.22, n, [x[0], x[2]]),
      radialRing(y + 1.25, 0.2, 0.16, n, [x[0], x[2]]),
      radialRing(y + 1.65, 0.31, 0.19, n, [x[0], x[2]]),
    ],
    C.trim,
  );
  sphere(
    o,
    'trim',
    [x[0], y + 1.91, x[2]],
    [0.18, 0.23, 0.17],
    C.trim,
    d === 2 ? 6 : 10,
    d === 2 ? 3 : 5,
  );
  beam(o, 'trim', f.P(u - 0.27, y + 1.5, 0.45), f.P(u - 0.37, y + 0.92, 0.65), 0.15, 0.15, C.trim);
  beam(o, 'trim', f.P(u + 0.27, y + 1.5, 0.45), f.P(u + 0.16, y + 1.12, 0.72), 0.15, 0.15, C.trim);
  if (d === 3)
    for (const dx of [-0.14, 0, 0.14])
      beam(
        o,
        'trim',
        f.P(u + dx, y + 0.08, 0.64),
        f.P(u + dx * 0.55, y + 1.3, 0.59),
        0.025,
        0.03,
        rgb('a59e8d'),
      );
}
function pinnacle(o, point, y, d, size = 0.62, height = 5) {
  const [x, z] = point,
    p = rect(x, z, size, size);
  if (d === 0) {
    for (let i = 0; i < p.length; i++)
      tri(
        o,
        'trim',
        [
          [p[i][0], y, p[i][1]],
          [p[(i + 1) % p.length][0], y, p[(i + 1) % p.length][1]],
          [x, y + height, z],
        ],
        [p[i][0] - x, 0, p[i][1] - z],
      );
    return;
  }
  prism(o, 'trim', p, y, y + 0.85, d);
  const ring = [...p].reverse().map((p) => [p[0], y + 0.85, p[1]]),
    tip = [...p]
      .reverse()
      .map((p) => [x + (p[0] - x) * 0.02, y + height, p[1] + (z - p[1]) * 0.98]);
  loft(o, 'wall', [ring, tip], C.wall);
  if (d === 3) {
    for (const dx of [-1, 1])
      for (const dz of [-1, 1]) {
        const a = [x + dx * size * 0.5, y + 0.8, z + dz * size * 0.5],
          b = [x + dx * size * 0.32, y + height * 0.65, z + dz * size * 0.32];
        beam(o, 'trim', a, b, 0.07, 0.08, C.trim);
      }
    if (d === 3)
      for (let j = 0; j < 4; j++)
        for (const s of [-1, 1])
          box(
            o,
            'trim',
            [x + s * size * 0.45 - 0.1, y + 1.3 + j * 0.8, z - 0.08],
            [x + s * size * 0.45 + 0.1, y + 1.43 + j * 0.8, z + 0.08],
            C.trim,
          );
  }
}
function buttresses(o, d) {
  for (const b of plan.choirButtresses.controls) {
    const [x, z] = b.front,
      n = b.normal,
      t = b.tangent,
      w = b.width,
      point = (u, dep) => [x + t[0] * u - n[0] * dep, z + t[1] * u - n[1] * dep],
      poly = (width, dep, front = 0) => [
        point(-width / 2, front),
        point(width / 2, front),
        point(width / 2, dep),
        point(-width / 2, dep),
      ];
    if (d === 0) {
      prism(o, 'wall', poly(w, 2.05), 0, 27, d);
      pinnacle(o, point(0, 0.75), 27, d, 0.65, 7.2);
      continue;
    }
    for (const [y0, y1, width, dep] of d === 1
      ? [
          [0, 17, w, 2.05],
          [17, 27.2, w * 0.78, 1.6],
        ]
      : [
          [0, 9, w, 2.05],
          [9, 17, w * 0.94, 1.9],
          [17, 24, w * 0.81, 1.65],
          [24, 27.2, w * 0.7, 1.4],
        ])
      prism(o, 'wall', poly(width, 2.05, 2.05 - dep), y0, y1, d);
    const f = face(point(-w / 2, 0), point(w / 2, 0), area(poly(w, 2.05)) > 0 ? 1 : -1); // face normal is explicitly the native outward normal below.
    f.n = [n[0], 0, n[1]];
    f.P = (u, y, dep = 0) => [
      x + t[0] * (u - w / 2) + n[0] * dep,
      y,
      z + t[1] * (u - w / 2) + n[1] * dep,
    ];
    for (const yy of d === 1 ? [16.9, 27.1] : [8.9, 16.9, 23.9, 27.1])
      prism(o, 'trim', poly(w * 1.06, 2.12, -0.08), yy, yy + 0.18, d);
    if (d >= 2) {
      for (let j = 0; j < 11; j++) {
        const yy = 1.4 + j * 2.1;
        panel(o, 'trim', f, w / 2, yy, w * 0.78, 0.58, 0.015);
      }
      prism(o, 'trim', poly(w * 0.85, 0.65, -0.7), 12.78, 13, d);
      figure(o, f, w / 2, 13, d);
      const canopy = point(0, -0.25);
      pinnacle(o, canopy, 15.4, d, w * 0.76, 2.2);
    }
    pinnacle(o, point(0, 1.3), 27.2, d, w * 0.62, 7);
  }
}
function parapet(o, d) {
  if (d === 0) return;
  const parts = plan.parts.filter((r) => ['way/505513556', 'way/505513557'].includes(r.id));
  for (const r of parts) {
    const p = r.outline,
      sign = area(p) > 0 ? 1 : -1;
    for (let i = 0; i < p.length; i++) {
      const f = face(p[i], p[(i + 1) % p.length], sign),
        q = f.P(f.len / 2, 0, 0.4);
      if (exposedBottom(r, [q[0], q[2]], 26) > 25.9) continue;
      for (const yy of [26.3, 27.15]) F(o, 'trim', f, [0, yy], [f.len, yy], 0.1, 0.12, 0.17);
      const n = Math.max(1, Math.round(f.len / (d === 1 ? 2 : 0.8)));
      for (let j = 0; j <= n; j++) {
        const u = (f.len * j) / n;
        F(o, 'trim', f, [u, 26.3], [u, 27.15], 0.1, 0.09, 0.1);
      }
      if (d === 3)
        for (let j = 0; j < n; j++) {
          const u = (f.len * (j + 0.5)) / n;
          curve(o, 'trim', f, archPath(u, 26.4, (f.len / n) * 0.65, 0.65, 4), 0.1, 0.05);
        }
    }
  }
}
function exterior(o, d) {
  if (d === 0) return;
  const f = face([-28.65, 1.2], [-28.5, -3.5], 1);
  gothic(o, f, 2.35, 0.5, 2.6, 5.4, d, 'door');
  for (let j = 0; j < 3; j++)
    box(o, 'trim', [-30.0 - j * 0.3, j * 0.12, -3.05], [-28.4, (j + 1) * 0.12, 1.15], C.trim);
  if (d >= 2) {
    for (const dx of [-1.65, 1.65])
      F(o, 'trim', f, [2.35 + dx, 0.4], [2.35 + dx, 6.5], 0.2, 0.23, 0.27);
    curve(
      o,
      'trim',
      f,
      [
        [0.35, 6.3],
        [2.35, 8.9],
        [4.35, 6.3],
      ],
      0.2,
      0.17,
    );
  }
  if (d >= 2) {
    const west = plan.parts.find((r) => r.id === 'way/505623457'),
      p = west.outline,
      sign = area(p) > 0 ? 1 : -1;
    for (let i = 0; i < p.length; i++) {
      const f = face(p[i], p[(i + 1) % p.length], sign);
      for (const y of [10.5, 17.2, 28.5, 38.5, 48.6])
        F(o, 'trim', f, [0, y], [f.len, y], 0.12, 0.19, 0.15);
      beam(o, 'trim', [p[i][0], 0.5, p[i][1]], [p[i][0], 48.7, p[i][1]], 0.22, 0.24, C.trim);
    }
  }
  // Representative chapel corner pinnacles follow exposed native corners, never a site-wide fence.
  if (d >= 2)
    for (const r of plan.parts.filter((r) =>
      ['way/505597426', 'way/505597429', 'way/505597432'].includes(r.id),
    )) {
      const y = data(r).eave;
      for (let i = 0; i < r.outline.length; i += 2)
        pinnacle(o, r.outline[i], y - 0.1, d, 0.42, 3.2);
    }
  if (d === 3)
    for (const r of plan.parts.filter((r) => r.roofShape === 'gabled')) {
      const q = data(r),
        { bounds } = dimensions(r);
      if (q.rise < 2) continue;
      const n = 8;
      for (let j = 1; j < n; j++) {
        const x = bounds.min[0] + ((bounds.max[0] - bounds.min[0]) * j) / n,
          z = (bounds.min[1] + bounds.max[1]) / 2;
        beam(o, 'metal', [x, q.height + 0.015, z], [x, q.height + 0.12, z], 0.035, 0.04, C.metal);
      }
    }
}
function build(o, _frame, d = 3) {
  massing(o, d);
  details(o, d);
  buttresses(o, d);
  parapet(o, d);
  exterior(o, d);
}
export const aachenSkyline = (o, f) => build(o, f, 0),
  aachenDistrict = (o, f) => build(o, f, 1),
  aachenStreet = (o, f) => build(o, f, 2);
export const aachenCathedralModel = {
  id: 'aachen_cathedral',
  key: 'aachen_cathedral',
  recipe: 'structure-aachen-cathedral.mjs',
  cell: 'u1/u1h',
  title: 'Aachen Cathedral',
  category: 'cathedral',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete intrinsic surviving cathedral from21native building parts:74mwesternspire/49mwestwork/flanking turrets,16-sidedambulatory/octagonalupperdrum/currentcurveddome/openlantern, tallglazedGothicchoir/apse withstone tracery/buttress-pinnacle systems/representativestatues/openparapets, allnamedsidechapels/entryvestibule/upperlink and boundednorthwestinfill. Current QuallaCC0exterior plus primary historical plan relationship only. No separatecloister/treasury/townhall/houses/siteplaza/ground/interiors/copiedphoto/signage.',
  camera: [112, 86, 126],
  lookAt: [4, 23, 0],
  portableGroundY: -0.52,
  mediumFiContext: { scale: 1.7, groundY: -0.52 },
  qaCameras: [
    {
      name: 'complete-native-cathedral-spire-dome-choir-and-side-chapels',
      position: [106, 104, 105],
      lookAt: [3, 24, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'gothic-choir-glass-tracery-buttresses-figures-and-pinnacles',
      position: [70, 27, 37],
      lookAt: [32, 15, 3],
    },
    {
      name: 'westwork-spire-entrance-and-open-dome-lantern',
      position: [-67, 43, 36],
      lookAt: [-10, 28, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixedwesternentranceapproach[-34,0]before independent rawterrain. Thresholds/hiddenfootings and compatible hostgrade remain approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-aachen-cathedral.mjs',
    level: 'skyline',
    export: 'aachenSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'aachenDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'aachenStreet', errorMeters: 0.24, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Exactly two native published Qualla originals: current2026KaapbijSneeuw creatorCC0east exterior and Dehio/Bezoldplate40/1887-1901primaryPD-old-auto-expired/deathyear1934. Both nativeSHA1matched/actually inspected. Historical lower-left floorplan only; its upper conjectural Carolingian reconstruction is NOT used for surviving roofs. Indooraltar/artifacts/uncertain or attributionimages excluded. No external image/generatedbitmap/copiedphototexture.',
    'All21native component footprints and their sourceheight/min-height/roofshape/roofheight controls retained in the master. Completecompound church, not an overall footprintblock. Unknown small south-choirconnector is estimated10m/gable2m; unassigned thin northweststrip follows original mainperimeter with estimated13meave/20mridge. Separatecloister/treasury dependencies excluded.',
    'Photo-informed detailed characteristic forms include closed pointed stained-glass interpretations/originalleadgrid, carvedmouldings/rose-tracery,13native-front choirbuttresses with interpretedstagedsections/creamquoinbands, pinnacles/representativeoriginalrobedstonefigures and openupperparapets. Exact tracery/artwork, statue identity/pose/census, concealedfacades, windowcounts and currentconservation are not a measured replica. Closed portable glazing uses a colored opaque approximation.',
    'Current centralcurvedroof and openlantern are interpreted within nominal42msourceheight; smallcrosses extend slightlyabove nominalroofheights. Domecurve/lanternsections, leadseams, finials and roofjoins are not surveyed. Nativeupperbridge retains25mminimumheight and smallestimated.6mgable; supporting adjacent architecture remains separate.',
    'Independent180mrawTerrariumfield frozenbeforegeometry atwesternapproach. Source grid/PNG/originaltile unchanged; no groundflattening/fitting. Thresholds/hidden foundations/host contact approximate; flatviewerstage is not gradecertification. No naturalground/publicsquare included. Detaillevels simplifycurvefacets/tracery/sculpture while compound massing/choir/dome/spire and openlanternpersist.',
  ],
};
