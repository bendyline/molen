/** Kernavė: five surviving hillfort earthworks and the separate modern craft-yard reconstruction.
 * Retained authored hill shapes and OSM positions fit approximately to standard viewer PMTiles; no survey accuracy is claimed.
 */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u9/u9c/n0251_kernave/map-parts.json',
      import.meta.url,
    ),
  ),
);
const fit = JSON.parse(readFileSync(structureSourcePath('n0251_kernave', 'pmtiles-fit.json'))),
  MEANS = {
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    aggregate: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
    foliage: [1, 1, 1],
    recess: [1, 1, 1],
  };
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, r, p, n, u, c) {
      tri(s, p, c);
    },
    addQuad(s, r, p, n, u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, r, p, n, u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function pmHeight(x, z) {
  const g = fit.grid,
    ix = Math.max(0, Math.min(g.width - 1.00001, (x - g.origin[0]) / g.stepMeters)),
    iz = Math.max(0, Math.min(g.height - 1.00001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(ix),
    j = Math.floor(iz),
    u = ix - i,
    v = iz - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - fit.datumMeters;
  return (at(0, 0) * (1 - u) + at(1, 0) * u) * (1 - v) + (at(0, 1) * (1 - u) + at(1, 1) * u) * v;
}
const grass = [0.23, 0.37, 0.11],
  timber = [0.63, 0.56, 0.43],
  roof = [0.58, 0.55, 0.47],
  trail = [0.72, 0.66, 0.52];
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail),
  near = (o) => !['skyline', 'district'].includes(o.detail),
  master = (o) => !o.detail;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  tint = (c, t) => c.map((v) => v * t);
const clamp = (t) => Math.max(0, Math.min(1, t)),
  smooth = (t) => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  };
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
function triangle(o, s, p, c) {
  if (normalFor(...p)[1] < 0) p.reverse();
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
}
function frame(o, x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
// Width/length and surviving bank heights follow Vengalis & Velius (2019).
// Rounded, asymmetric contours are authored interpretations, not a sampled LiDAR surface.
const hills = [
  { i: 0, w: 70, d: 30, a: -0.18, h: 18, run: 33, bank: 0 },
  { i: 1, w: 24, d: 60, a: -0.18, h: 22, run: 31, bank: 5 },
  { i: 2, w: 183, d: 102, a: 0.7, h: 30, run: 43, bank: 4 },
  { i: 3, w: 12, d: 26, a: -0.28, h: 27, run: 32, bank: 4 },
  { i: 4, w: 12, d: 10, a: 0.74, h: 31, run: 38, bank: 1 },
].map((h) => ({ ...h, center: map.components[h.i].center }));
function hillY(h, x, z) {
  const dx = x - h.center[0],
    dz = z - h.center[1],
    c = Math.cos(h.a),
    s = Math.sin(h.a),
    u = dx * c + dz * s,
    v = -dx * s + dz * c;
  // Unequal crown corners retain the surviving asymmetric platforms and spurs.
  const shapes = [
    [
      [-0.5, -0.3],
      [0.4, -0.5],
      [0.5, -0.28],
      [0.47, 0.34],
      [-0.4, 0.5],
      [-0.5, 0.2],
    ],
    [
      [-0.48, -0.4],
      [0.4, -0.5],
      [0.5, -0.3],
      [0.25, 0.4],
      [-0.18, 0.5],
      [-0.3, 0.25],
    ],
    [
      [-0.5, -0.1],
      [-0.4, -0.39],
      [-0.15, -0.5],
      [0.25, -0.42],
      [0.48, -0.16],
      [0.5, 0.15],
      [0.28, 0.36],
      [0.14, 0.55],
      [-0.15, 0.32],
      [-0.4, 0.27],
    ],
    [
      [-0.5, -0.4],
      [0.45, -0.5],
      [0.45, -0.1],
      [0.1, 0.5],
      [-0.35, 0.22],
    ],
    [
      [-0.5, -0.1],
      [-0.35, -0.4],
      [0.15, -0.5],
      [0.48, -0.2],
      [0.5, 0.1],
      [0.2, 0.45],
      [-0.2, 0.5],
      [-0.4, 0.23],
    ],
  ];
  const p = shapes[h.i].map(([x, z]) => [x * h.w, z * h.d]);
  let distance = Infinity,
    inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j],
      b = p[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      t = clamp(((u - a[0]) * dx + (v - a[1]) * dz) / (dx * dx + dz * dz));
    distance = Math.min(distance, Math.hypot(u - a[0] - t * dx, v - a[1] - t * dz));
    if (a[1] > v !== b[1] > v && u < ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  const d = inside ? -distance : distance;
  const irregular =
    1 + 0.1 * Math.sin(u * 0.11 + v * 0.045) + 0.055 * Math.cos(u * 0.069 - v * 0.093);
  let y = h.h * (1 - smooth(Math.max(0, d) / (h.run * irregular)));
  if (h.bank) {
    const bx = h.i === 3 ? h.w * 0.32 : 0,
      bz = -h.d * 0.36;
    const r = ((u - bx) / (h.w * 0.53)) ** 2 + ((v - bz) / Math.max(4, h.d * 0.16)) ** 2;
    y += h.bank * Math.exp(-r * 2.8);
  }
  if (h.i === 0) {
    // Surviving narrow terrace and a shallow cut on the northern edge.
    y -= 1.15 * Math.exp(-(((u + 8) / 5) ** 2) - ((v + 12) / 9) ** 2);
  }
  return Math.max(0, y);
}
const mainBounds = [-166, -247, 176, 136],
  fifthBounds = [345, 407, 465, 525],
  museumBounds = [-338, -239, -237, -118];
function inBounds([x, z], b, margin = 0) {
  return x >= b[0] + margin && z >= b[1] + margin && x <= b[2] - margin && z <= b[3] - margin;
}
function boundaryFade(x, z, b) {
  return smooth(Math.min(x - b[0], b[2] - x, z - b[1], b[3] - z) / 13);
}
function fieldHeight(x, z) {
  let y = pmHeight(x, z);
  for (const h of hills) {
    const dx = x - h.center[0],
      dz = z - h.center[1],
      c = Math.cos(h.a),
      sn = Math.sin(h.a),
      u = dx * c + dz * sn,
      v = -dx * sn + dz * c;
    const broad =
      0.8 *
      h.h *
      Math.exp(
        -Math.pow(u / (h.w / 2 + h.run * 0.6), 2) - Math.pow(v / (h.d / 2 + h.run * 0.6), 2),
      );
    y += Math.max(0, hillY(h, x, z) - broad);
  }
  return y + 0.025;
}

let surfaceGrid;
function height(x, z) {
  if (!surfaceGrid) return fieldHeight(x, z);
  const { xs, zs, hs } = surfaceGrid;
  const find = (a, v) => {
      let i = 0;
      while (i < a.length - 2 && a[i + 1] < v) i++;
      return i;
    },
    i = find(xs, x),
    j = find(zs, z),
    u = Math.max(0, Math.min(1, (x - xs[i]) / (xs[i + 1] - xs[i]))),
    v = Math.max(0, Math.min(1, (z - zs[j]) / (zs[j + 1] - zs[j]))),
    h = (a, b) => hs[(j + b) * xs.length + i + a],
    a = h(0, 0),
    b = h(1, 0),
    c = h(1, 1),
    d = h(0, 1);
  return v <= u ? a + (b - a) * u + (c - b) * v : a + (c - d) * u + (d - a) * v;
}

function knots(lo, hi, n, special = []) {
  const k = Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  for (const p of special) {
    if (p <= lo || p >= hi) continue;
    k.push(p);
  }
  return [...new Set(k)].sort((a, b) => a - b);
}
function terrain(o, b, nx, nz, special = []) {
  let xs = knots(
      b[0],
      b[2],
      nx,
      special.map((p) => p[0]),
    ),
    zs = knots(
      b[1],
      b[3],
      nz,
      special.map((p) => p[1]),
    );
  if (b === museumBounds) {
    xs = [...new Set([...xs, b[0] + 13, b[2] - 13])].sort((a, b) => a - b);
    zs = [...new Set([...zs, b[1] + 13, b[3] - 13])].sort((a, b) => a - b);
  }
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const p = [
        [xs[i], zs[j]],
        [xs[i + 1], zs[j]],
        [xs[i + 1], zs[j + 1]],
        [xs[i], zs[j + 1]],
      ].map(([x, z]) => [x, height(x, z), z]);
      const c = tint(grass, 0.99 + 0.035 * Math.sin((xs[i] + zs[j]) * 0.036));
      triangle(o, 'foliage', [p[0], p[2], p[1]], c);
      triangle(o, 'foliage', [p[0], p[3], p[2]], c);
    }
}
function paths(o) {
  if (o.detail === 'skyline') return;
  for (const f of map.features.filter((f) => f.tags.highway)) {
    const steps = f.tags.highway === 'steps',
      wood = f.tags.surface === 'wood';
    for (let i = 0; i < f.points.length - 1; i++) {
      const a = f.points[i],
        b = f.points[i + 1],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 0.05) continue;
      const step = steps ? (master(o) ? 0.55 : fine(o) ? 0.7 : near(o) ? 1.6 : 5) : near(o) ? 2 : 8,
        n = Math.ceil(l / step),
        w = steps ? 1.45 : 1.8,
        dx = (-(b[1] - a[1]) * w) / (2 * l),
        dz = ((b[0] - a[0]) * w) / (2 * l);
      for (let j = 0; j < n; j++) {
        const p = mix(a, b, j / n),
          q = mix(a, b, (j + 1) / n),
          m = mix(p, q, 0.5);
        if (![mainBounds, museumBounds].some((b) => inBounds(m, b, 8))) continue;
        const corners = [
          [p[0] + dx, p[1] + dz],
          [q[0] + dx, q[1] + dz],
          [q[0] - dx, q[1] - dz],
          [p[0] - dx, p[1] - dz],
        ];
        // Each corner is draped independently to prevent trails cutting through slopes.
        const pp = corners.map(([x, z]) => [x, height(x, z) + 0.14, z]);
        if (steps && near(o)) {
          const y = Math.max(...pp.map((p) => p[1])) + 0.06,
            c = frame(o, m[0], y, m[1], Math.atan2(b[1] - a[1], b[0] - a[0]));
          box(
            c,
            wood ? 'wood' : 'aggregate',
            [-l / n / 2, -0.12, -w / 2],
            [l / n / 2, 0, w / 2],
            wood ? timber : trail,
          );
        } else {
          triangle(o, wood ? 'wood' : 'aggregate', [pp[0], pp[2], pp[1]], wood ? timber : trail);
          triangle(o, wood ? 'wood' : 'aggregate', [pp[0], pp[3], pp[2]], wood ? timber : trail);
        }
      }
    }
  }
}
function buildingFrame(f) {
  const p = f.points.slice(0, -1);
  let edge = 0;
  for (let i = 1; i < p.length; i++)
    if (
      Math.hypot(...p[(i + 1) % p.length].map((v, j) => v - p[i][j])) >
      Math.hypot(...p[(edge + 1) % p.length].map((v, j) => v - p[edge][j]))
    )
      edge = i;
  const a = Math.atan2(
      p[(edge + 1) % p.length][1] - p[edge][1],
      p[(edge + 1) % p.length][0] - p[edge][0],
    ),
    c = Math.cos(a),
    s = Math.sin(a),
    r = p.map(([x, z]) => [x * c + z * s, -x * s + z * c]),
    lo = [0, 1].map((i) => Math.min(...r.map((p) => p[i]))),
    hi = [0, 1].map((i) => Math.max(...r.map((p) => p[i]))),
    m = mix(lo, hi, 0.5);
  return { x: m[0] * c - m[1] * s, z: m[0] * s + m[1] * c, a, w: hi[0] - lo[0], d: hi[1] - lo[1] };
}
function timberBuilding(o, f) {
  const b = buildingFrame(f),
    y = height(b.x, b.z) + 0.05,
    w = b.w,
    d = b.d,
    h = w > 7 ? 2.6 : 2.2,
    r = d * 0.47,
    p = frame(o, b.x, y, b.z, b.a);
  box(p, 'wood', [-w / 2, -1.2, -d / 2], [w / 2, 0, d / 2], tint(timber, 0.75));
  if (near(o)) {
    box(p, 'wood', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], tint(timber, 0.83));
    const step = fine(o) ? 0.23 : 0.55;
    for (let z = -d / 2; z <= d / 2; z += d)
      for (let yy = 0.14; yy < h; yy += step) {
        const a = [-w / 2 - 0.18, yy, z],
          bb = [w / 2 + 0.18, yy, z];
        beam(
          p,
          'wood',
          a,
          bb,
          step * 0.91,
          step * 0.8,
          tint(timber, 0.88 + 0.03 * (Math.round(yy * 20) % 5)),
        );
      }
    for (let x = -w / 2; x <= w / 2; x += w)
      for (let yy = 0.25; yy < h; yy += step)
        beam(
          p,
          'wood',
          [x, yy, -d / 2 - 0.18],
          [x, yy, d / 2 + 0.18],
          step * 0.9,
          step * 0.85,
          timber,
        );
  } else box(p, 'wood', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], timber);
  for (const x of [-w / 2, w / 2]) {
    const q = [
      [x, h, -d / 2],
      [x, h, d / 2],
      [x, h + r, 0],
    ];
    let n = normalFor(...q);
    if (n[0] * x < 0) {
      q.reverse();
      n = normalFor(...q);
    }
    p.addTriangle(
      'wood',
      'palette:#ffffff',
      q,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      timber,
    );
  }
  for (const s of [-1, 1]) {
    const a = [-w / 2 - 0.32, h - 0.08, s * (d / 2 + 0.32)],
      b = [w / 2 + 0.32, h - 0.08, s * (d / 2 + 0.32)],
      c = [w / 2 + 0.32, h + r, 0],
      dd = [-w / 2 - 0.32, h + r, 0];
    const q = [a, b, c, dd];
    if (normalFor(...q)[1] < 0) q.reverse();
    face(p, 'wood', q, roof);
    if (near(o)) {
      const n = Math.ceil((w + 0.64) / (master(o) ? 0.19 : fine(o) ? 0.28 : 0.85));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          aa = mix(a, b, t),
          bb = mix(dd, c, t);
        aa[1] += 0.035;
        bb[1] += 0.035;
        beam(p, 'wood', aa, bb, 0.045, 0.06, tint(roof, 0.8 + 0.04 * (j % 5)));
      }
    }
  }
  if (near(o)) {
    // Door and small shutter locations are photographic interpretations, not measured openings.
    box(p, 'recess', [-0.53, 0, -d / 2 - 0.21], [0.53, 1.75, -d / 2 - 0.17], [0.22, 0.19, 0.13]);
    box(p, 'wood', [-0.48, 0.02, -d / 2 - 0.24], [0.48, 1.7, -d / 2 - 0.2], tint(timber, 0.62));
    if (w > 5)
      box(
        p,
        'wood',
        [w * 0.28 - 0.3, 1.1, -d / 2 - 0.24],
        [w * 0.28 + 0.3, 1.7, -d / 2 - 0.19],
        tint(timber, 0.57),
      );
    if (fine(o)) {
      for (let x = -0.4; x <= 0.4; x += 0.16)
        box(
          p,
          'wood',
          [x, 0.06, -d / 2 - 0.25],
          [x + 0.13, 1.67, -d / 2 - 0.22],
          tint(timber, 0.67),
        );
      for (const yy of [0.42, 1.35])
        beam(p, 'wood', [-0.42, yy, -d / 2 - 0.27], [0.42, yy, -d / 2 - 0.27], 0.08, 0.09, timber);
    }
  }
}
function fences(o) {
  for (const f of map.features.filter((f) => f.tags.barrier === 'fence'))
    for (let i = 0; i < f.points.length - 1; i++) {
      const a = f.points[i],
        b = f.points[i + 1],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 0.01) continue;
      const draped = {
          detail: o.detail,
          ...Object.fromEntries(
            ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
              k,
              (slot, ref, points, n, uv, color) =>
                o[k](
                  slot,
                  ref,
                  points.map((p) => [p[0], p[1] + height(p[0], p[2]) + 0.05, p[2]]),
                  n,
                  uv,
                  color,
                ),
            ]),
          ),
        },
        p = frame(draped, a[0], 0, a[1], Math.atan2(b[1] - a[1], b[0] - a[0]));
      if (!fine(o)) {
        const q = [
          [0, 0, 0],
          [l, 0, 0],
          [l, 1.8, 0],
          [0, 1.8, 0],
        ];
        face(p, 'wood', q, tint(timber, 0.8));
        face(p, 'wood', q.toReversed(), tint(timber, 0.8));
      } else {
        const n = Math.ceil(l / (master(o) ? 0.22 : 0.48));
        for (let j = 0; j < n; j++) {
          const x = ((j + 0.5) * l) / n,
            h = 1.8 + 0.1 * Math.sin(j * 1.7 + i);
          box(
            p,
            'wood',
            [x - (l / n) * 0.45, 0, -0.06],
            [x + (l / n) * 0.45, h, 0.06],
            tint(timber, 0.78 + 0.035 * (j % 7)),
          );
        }
        for (const y of [0.55, 1.4]) beam(p, 'wood', [0, y, 0.11], [l, y, 0.11], 0.12, 0.1, timber);
      }
    }
}
function build(out, detail) {
  const o = { ...writer(out, detail === 'skyline'), detail },
    tiers = { skyline: [12, 8], district: [28, 22], street: [55, 48], closeup: [90, 80] },
    n = tiers[detail];
  const xs = knots(
      -380,
      500,
      n[0],
      hills.map((h) => h.center[0]),
    ),
    zs = knots(
      -280,
      560,
      n[1],
      hills.map((h) => h.center[1]),
    );
  surfaceGrid = { xs, zs, hs: zs.flatMap((z) => xs.map((x) => fieldHeight(x, z))) };
  terrain(
    o,
    [-380, -280, 500, 560],
    n[0],
    n[1],
    hills.map((h) => h.center),
  );
  paths(o);
  for (const f of map.features.filter((f) => f.tags.building)) timberBuilding(o, f);
  fences(o);
}
export const buildKernaveFitSkyline = (o) => build(o, 'skyline'),
  buildKernaveFitDistrict = (o) => build(o, 'district'),
  buildKernaveFitStreet = (o) => build(o, 'street'),
  buildKernaveFitCloseup = (o) => build(o, 'closeup');
