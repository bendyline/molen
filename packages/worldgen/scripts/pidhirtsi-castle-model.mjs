/** Pidhirtsi palace: mapped facade, tiered roofs, courtyard, stairs and fortified wings. */
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
    '../../../content/worldgen/source/places/u8/u8c/n0324_pidhirtsi_castle/',
    import.meta.url,
  ),
  read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  floor = frame.reconstruction.palaceFloorY;
const palette = {
  plaster: '#e5d2bc',
  rose: '#ca9e90',
  trim: '#eee1ca',
  stone: '#c6bdab',
  roof: '#70808d',
  greenRoof: '#93af91',
  grayRoof: '#7b8a96',
  glass: '#526f7d',
  grass: '#84ad62',
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
];
const sign = (r) =>
  Math.sign(
    r.reduce((n, a, i) => {
      const b = r[(i + 1) % r.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
export function pidhirtsiGround(x, z) {
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

export const pidhirtsiWindows = [];
export const pidhirtsiArches = [];
const gate = {
  name: 'south-gate',
  center: [0, 44],
  axis: [1, 0],
  width: 3.8,
  bottom: floor,
  height: 4.5,
  spring: 3.0,
  depth: 20,
  shape: 'round',
};
const arcades = [-1, 1].flatMap((side) =>
  [15.5, 19.5].map((z) => ({
    name: `terrace-arcade-${side}-${z}`,
    center: [side * 19.0, z],
    axis: [0, 1],
    width: 3.3,
    bottom: floor,
    height: 4.8,
    spring: 3.2,
    depth: 5,
    shape: 'round',
  })),
);
const remember = (list, h, d) => {
  if (d >= 3 && !list.some((q) => q.name === h.name)) list.push(h);
  return h;
};
const box = (face, slot, p, w, depth, bottom, top) =>
  solid(face, rect(...p, w, depth), bottom, top, slot);
function roof(face, r, eave, ridgeA, ridgeB, top, slot = 'roof') {
  const center = lerp(ridgeA, ridgeB, 0.5),
    axis = unit(ridgeB.map((v, k) => v - ridgeA[k]));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      m = lerp(a, b, 0.5),
      along = (m[0] - center[0]) * axis[0] + (m[1] - center[1]) * axis[1],
      n = Math.abs((b[0] - a[0]) * axis[0] + (b[1] - a[1]) * axis[1]);
    if (n > Math.hypot(...b.map((v, k) => v - a[k])) * 0.6) {
      const forward = (b[0] - a[0]) * axis[0] + (b[1] - a[1]) * axis[1] > 0;
      face(
        slot,
        [
          at(a, eave),
          at(b, eave),
          at(forward ? ridgeB : ridgeA, top),
          at(forward ? ridgeA : ridgeB, top),
        ],
        [0, 1, 0],
      );
    } else face(slot, [at(a, eave), at(b, eave), at(along < 0 ? ridgeA : ridgeB, top)], [0, 1, 0]);
  }
}
function profile(face, p, levels, slot) {
  for (let i = 0; i < levels.length - 1; i++) {
    const [y, w, depth] = levels[i],
      [yy, ww, dd] = levels[i + 1],
      a = rect(...p, w, depth ?? w),
      b = rect(...p, ww, dd ?? ww);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      face(
        slot,
        [at(a[j], y), at(a[k], y), at(b[k], yy), at(b[j], yy)],
        [(a[k][1] - a[j][1]) * sign(a), 0.1, (a[j][0] - a[k][0]) * sign(a)],
      );
    }
  }
  const last = levels.at(-1);
  cap(face, rect(...p, last[1], last[2] ?? last[1]), last[0], slot);
}
function roofBay(face, points, center, d) {
  const r = points,
    top = 27.7;
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face('roof', [at(r[i], 23.5), at(r[j], 23.5), at(center, top)], [0, 1, 0]);
  }
  if (d) {
    box(face, 'trim', center, 0.32, 0.32, top, top + 1.5);
    if (d >= 2) box(face, 'rose', center, 0.8, 0.8, top + 1.1, top + 1.7);
  }
}
function roofs(face, d) {
  roof(face, rect(0.5, 1.9, 53.5, 19.4), 23.5, [-17.7, 1.9], [18.7, 1.9], 31);
  for (const f of frame.reconstruction.pavilions) {
    const p = f.center,
      levels =
        d === 0
          ? [
              [25, f.width, f.depth],
              [30.5, 5.5],
              [35.8, 0.8],
            ]
          : d === 1
            ? [
                [25, f.width, f.depth],
                [28.5, 9],
                [30, 5],
                [33.2, 3.2],
                [35.8, 0.8],
              ]
            : [
                [25, f.width, f.depth],
                [28.5, 9],
                [29.3, 8],
                [29.6, 5],
                [31, 5],
                [33.2, 3.2],
                [34, 3],
                [35.8, 0.8],
              ];
    profile(face, p, levels, f.color);
    box(face, 'trim', p, 0.36, 0.36, 35.8, 38.0);
    if (d >= 2) {
      box(face, 'trim', p, 0.8, 0.8, 37.0, 38.2);
      box(face, 'trim', p, 0.55, 0.55, 38.2, 38.8);
    }
  }
  roofBay(
    face,
    [
      [-4.01, -7.56],
      [-2.61, -8.59],
      [-1.05, -9.49],
      [0.48, -9.75],
      [2.25, -9.56],
      [3.68, -8.64],
      [4.53, -7.57],
      [4.53, -6.8],
      [-4.01, -6.8],
    ],
    [0.4, -7.65],
    d,
  );
  roofBay(
    face,
    [
      [-4.01, 10.6],
      [-4.01, 11.469],
      [-3.305, 12.341],
      [-2.251, 13.137],
      [-0.619, 13.396],
      [0.625, 13.486],
      [2.221, 13.377],
      [3.431, 13.209],
      [4.401, 12.353],
      [5.1, 11.476],
      [5.1, 10.6],
    ],
    [0.5, 11.3],
    d,
  );
  if (!d) return;
  for (const x of d === 1 ? [-15, 0, 15] : [-21, -8, 8, 21]) {
    box(face, 'stone', [x, 1.9], 1.3, 1.1, 29.0, 32.1);
    box(face, 'trim', [x, 1.9], 1.7, 1.4, 31.8, 32.5);
    if (d >= 2)
      for (const dx of [-0.4, 0.4]) box(face, 'stone', [x + dx, 1.9], 0.25, 0.5, 32.4, 33);
  }
  if (d >= 2)
    for (const side of [-1, 1])
      for (const x of [-11.5, 11.5]) {
        const z = 1.9 + side * 6.6,
          base = 25.0,
          p = [x, z];
        box(face, 'rose', p, 1.6, 1.3, base, base + 1.5);
        roof(face, rect(...p, 2.1, 1.9), base + 1.4, [x - 0.05, z], [x + 0.05, z], base + 2.7);
        const fz = z + side * 0.67;
        face(
          'glass',
          [
            [x - 0.45, base + 0.2, fz],
            [x + 0.45, base + 0.2, fz],
            [x + 0.45, base + 1.2, fz],
            [x - 0.45, base + 1.2, fz],
          ],
          [0, 0, side],
        );
      }
}
function windowDefinitions(d, r) {
  const holes = [];
  if (!d) return holes;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(...b.map((v, k) => v - a[k]));
    if (len < 1.4) continue;
    const u = unit(b.map((v, k) => v - a[k])),
      n = [u[1] * sign(r), -u[0] * sign(r)],
      bays = Math.max(1, Math.floor(len / (d === 1 ? 7 : d === 2 ? 5.0 : 3.9))),
      rows = d === 1 ? [8.8, 17.8] : d === 2 ? [7, 17.8] : [7, 12.4, 17.8];
    for (let j = 0; j < bays; j++)
      for (const y of rows) {
        const h = {
          name: `palace-window-${i}-${j}-${y}`,
          center: lerp(a, b, (j + 0.5) / bays),
          axis: u,
          normal: n,
          width: Math.min(1.65, len - 0.45),
          bottom: y,
          height: 2.75,
          depth: 2.6,
          shape: 'rectangle',
        };
        holes.push(remember(pidhirtsiWindows, h, d));
      }
  }
  // The retained curved southern bay contains a short central facade segment;
  // its single window is authored explicitly rather than disappearing at a bay-count threshold.
  for (const y of d === 1 ? [8.8, 17.8] : d === 2 ? [7, 17.8] : [7, 12.4, 17.8])
    holes.push(
      remember(
        pidhirtsiWindows,
        {
          name: `south-bay-central-window-${y}`,
          center: [0.625, 13.486],
          axis: [1, 0],
          normal: [0, 1],
          width: 1.0,
          bottom: y,
          height: 2.75,
          depth: 2.6,
          shape: 'rectangle',
        },
        d,
      ),
    );
  return holes;
}
function windowFrame(face, h, d) {
  const u = h.axis,
    n = h.normal,
    point = (x, y, depth) => [
      h.center[0] + u[0] * x + n[0] * depth,
      y,
      h.center[1] + u[1] * x + n[1] * depth,
    ],
    w = h.width / 2,
    b = h.bottom,
    t = b + h.height,
    offset = d === 1 ? 0.035 : -0.15;
  face(
    'glass',
    [
      point(-w + 0.07, b + 0.1, offset),
      point(w - 0.07, b + 0.1, offset),
      point(w - 0.07, t - 0.1, offset),
      point(-w + 0.07, t - 0.1, offset),
    ],
    [n[0], 0, n[1]],
  );
  const strip = (x0, x1, y0, y1, slot = 'trim') =>
    face(
      slot,
      [point(x0, y0, 0.07), point(x1, y0, 0.07), point(x1, y1, 0.07), point(x0, y1, 0.07)],
      [n[0], 0, n[1]],
    );
  strip(-w - 0.18, w + 0.18, b - 0.16, b + 0.04);
  strip(-w - 0.18, w + 0.18, t - 0.04, t + 0.2);
  if (d === 1) return;
  strip(-w - 0.18, -w + 0.03, b, t);
  strip(w - 0.03, w + 0.18, b, t);
  strip(-w, w, b + h.height * 0.54, b + h.height * 0.54 + 0.06);
  strip(-0.025, 0.025, b, t);
  if (d >= 3) {
    const peak = t + 0.85;
    face(
      'trim',
      [point(-w - 0.35, t + 0.2, 0.09), point(w + 0.35, t + 0.2, 0.09), point(0, peak, 0.09)],
      [n[0], 0, n[1]],
    );
    strip(-w - 0.33, w + 0.33, t + 0.13, t + 0.35, 'rose');
  }
}
function palace(out, d) {
  const r = simplify(frame.geometry.outline, d === 0 ? 0.6 : 0.12),
    face = writer(out, d),
    windows = windowDefinitions(d, r),
    top = (p) => (Math.abs(p[0]) > 17.6 && p[1] < 2.15 ? 25 : 23.5);
  wallLoop(
    out,
    d,
    r,
    1.2,
    true,
    (p) => Math.min(floor - 0.1, pidhirtsiGround(...p) - 0.35),
    top,
    d >= 2 ? windows : [],
  );
  for (const h of windows) windowFrame(face, h, d);
  if (d) {
    for (const y of [floor + 0.2, 10.5, 15.9, 23.4])
      for (let i = 0; i < r.length; i++)
        band(face, r[i], r[(i + 1) % r.length], 0.35, y, 'trim', 0.2);
    if (d >= 2)
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          len = Math.hypot(...b.map((v, k) => v - a[k]));
        if (len < 5) continue;
        const count = Math.max(1, Math.floor(len / (d === 2 ? 5 : 3.9)));
        for (let j = 0; j <= count; j++) {
          const p = lerp(a, b, j / count);
          box(face, 'rose', p, 0.35, 0.35, floor, 23.25);
        }
      }
  }
}
function rail(face, d, a, b, y) {
  if (!d) return;
  band(face, a, b, 0.35, y + 1.18, 'stone', 0.22);
  band(face, a, b, 0.4, y + 0.15, 'stone', 0.2);
  if (d === 1) return;
  const len = Math.hypot(...b.map((v, k) => v - a[k])),
    count = Math.max(1, Math.floor(len / (d === 1 ? 4 : d === 2 ? 2.2 : 1.3)));
  for (let i = 0; i <= count; i++)
    box(face, 'trim', lerp(a, b, i / count), 0.22, 0.22, y + 0.15, y + 1.15);
}
function fort(out, d) {
  const face = writer(out, d),
    r = frame.reconstruction.lowerWings.outline,
    holes = [
      remember(pidhirtsiArches, gate, d),
      ...arcades.map((h) => remember(pidhirtsiArches, h, d)),
    ];
  masonry(
    out,
    d,
    r,
    (p) => Math.min(floor - 0.2, pidhirtsiGround(...p) - 0.35),
    9.5,
    holes,
    'stone',
  );
  if (d) {
    for (let i = 0; i < r.length; i++) rail(face, d, r[i], r[(i + 1) % r.length], 9.5);
    const x0 = -3.4,
      x1 = 3.4,
      z = 50.02;
    face(
      'rose',
      [
        [x0, 8.2, z],
        [x1, 8.2, z],
        [x1, 10.1, z],
        [x0, 10.1, z],
      ],
      [0, 0, 1],
    );
    face(
      'trim',
      [
        [x0, 10.05, z + 0.05],
        [x1, 10.05, z + 0.05],
        [2.2, 11.5, z + 0.05],
        [-2.2, 11.5, z + 0.05],
      ],
      [0, 0, 1],
    );
    box(face, 'trim', [0, 49.6], 2.6, 0.8, 11.1, 12.2);
    box(face, 'rose', [0, 50.05], 1.7, 0.3, 11.25, 12.5);
    const g = { ...gate, center: [0, 50.04] },
      shape = openingShape(g, d),
      outer = shape.map((p) => [p[0] * 1.3, floor - 0.15 + (p[1] - floor) * 1.16]);
    for (let i = 0; i < shape.length; i++) {
      const j = (i + 1) % shape.length;
      face(
        'trim',
        [
          [shape[i][0], shape[i][1], 50.07],
          [shape[j][0], shape[j][1], 50.07],
          [outer[j][0], outer[j][1], 50.07],
          [outer[i][0], outer[i][1], 50.07],
        ],
        [0, 0, 1],
      );
    }
  }
  cap(face, frame.reconstruction.courtyard.outline, floor, 'stone');
  for (const r of frame.reconstruction.frontBelvederes) {
    solid(face, r, (p) => Math.min(floor - 1, pidhirtsiGround(...p) - 0.35), floor, 'stone');
    if (d) for (let i = 0; i < r.length; i++) rail(face, d, r[i], r[(i + 1) % r.length], floor);
  }
}
function staircase(face, d, side) {
  if (!d) return;
  const route = Array.from({ length: d === 1 ? 5 : d === 2 ? 8 : 12 }, (_, i) => {
    const t = i / (d === 1 ? 4 : d === 2 ? 7 : 11),
      angle = t * Math.PI * 0.6;
    return [
      side * (4.7 + 12.5 * Math.sin(angle)),
      14.0 + 14 * (1 - Math.cos(angle)),
      9.5 - (9.5 - floor) * t,
    ];
  });
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i],
      b = route[i + 1],
      steps = d === 1 ? 1 : Math.max(1, Math.ceil((a[2] - b[2]) / 0.24));
    for (let j = 0; j < steps; j++) {
      const aa = lerp(a, b, j / steps),
        bb = lerp(a, b, (j + 1) / steps),
        top = aa[2];
      band(
        face,
        aa.slice(0, 2),
        bb.slice(0, 2),
        2.15,
        top,
        'stone',
        Math.max(0.3, top - floor + 0.05),
      );
    }
    const u = unit(b.slice(0, 2).map((v, k) => v - a[k])),
      n = [-u[1], u[0]],
      edge = (p) => p.slice(0, 2).map((v, k) => v + n[k] * side * 1.14);
    band(
      face,
      edge(a),
      edge(b),
      0.22,
      (p) =>
        a[2] +
        (b[2] - a[2]) *
          Math.min(
            1,
            Math.max(
              0,
              Math.hypot(p[0] - a[0], p[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]),
            ),
          ) +
        1.0,
      'trim',
      0.2,
    );
  }
  box(face, 'stone', [side * 4.7, 14.0], 3.0, 3.0, 9.2, 9.5);
  band(face, [side * 4.7, 14.0], [side * 4.7, 11.2], 2.5, 9.5, 'stone', 0.3);
}
function bridge(face, d) {
  const points = frame.reconstruction.bridge.centerline,
    w = frame.reconstruction.bridge.width,
    target = pidhirtsiGround(...points.at(-1)) + 0.06,
    y = (p) => 3.58 + (target - 3.58) * Math.max(0, Math.min(1, (p[1] - 50) / 28));
  for (let i = 0; i < points.length - 1; i++) {
    band(face, points[i], points[i + 1], w, y, 'stone', 0.55);
    if (d)
      for (const side of [-1, 1])
        band(
          face,
          [side * (w / 2 - 0.12), points[i][1]],
          [side * (w / 2 - 0.12), points[i + 1][1]],
          0.25,
          (p) => y(p) + 0.8,
          'stone',
          0.8,
        );
  }
  if (d) {
    for (const z of [55, 63, 71])
      box(face, 'stone', [0, z], 4.0, 1.0, pidhirtsiGround(0, z) - 0.3, y([0, z]) - 0.5);
  }
}
function build(out, d) {
  const face = writer(out, d);
  fort(out, d);
  palace(out, d);
  roofs(face, d);
  staircase(face, d, -1);
  staircase(face, d, 1);
  bridge(face, d);
}
export const buildPidhirtsiSkyline = (out) => build(out, 0);
export const buildPidhirtsiDistrict = (out) => build(out, 1);
export const buildPidhirtsiStreet = (out) => build(out, 2);
export const buildPidhirtsiCloseup = (out) => build(out, 3);
export const pidhirtsiStudy = {
  id: 'N0324',
  key: 'pidhirtsi_castle',
  title: 'Pidhirtsi Castle',
  category: 'castle',
  wikidataId: 'Q943794',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual pale/rose palace: mapped twin pavilion/body plan, west green/east gray tiered roofs and finials, broad steep main roof, projecting central bays, framed windows, opposing stair arms, north belvederes and U-shaped lower fortified wings with open gate/arcades and south causeway.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID65.8x27m main palace plus current PMTiles polygon and north-garden/south-entry path controls. Lower rampart/bastion layout is a picture-led approximation against mapped perimeter paths.',
    architecturalHeights:
      'No architectural height tags. Court/palace floor3.5m clears coarse DEM. Facades, roofs, cupolas, stairs, lower wings and bridge levels are exterior-picture estimates; nativeY0 follows standardDEM387.1541m.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped main palace plan and signed garden/entry paths supply approximate exterior scale; outer compound and ornament use the two inspected aerial pictures.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing256-square graphs supply lime plaster, weathered limestone, slate and painted metal with linear tints and metric UVs. Glass uses a vertex-colored palette. No unique photographed facade, bitmap or embedded image.',
  importReason:
    'Retain palace roof/pavilion silhouette, mapped body, courtyard and fortified gate in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Main palace outline retains exact mapped identity and current polygon control; outer wings/bastions, untagged heights, stair curves, cupolas and damaged ornament are picture-led exterior estimates.',
    'NativeY0 follows coarse standardDEM387.1541m. Court/palace floor3.5m, foundations, belvederes, causeway levels, dry-moat attachment and terrain joins are approximate; no bare-earth/moat survey or certified walking collision.',
    'Skyline preserves roofs, body, gate/courtyard and belvederes, omitting windows/stair/rail detail. District uses sparse surface windows and simpler tiers; street/closeup add recessed glazing, frames, cornices, chimneys, arcade reveals, stair treads and sparse balusters. Full interiors and exact facade/sculpture/weathering reconstruction are excluded.',
    'The bridge-like approach follows an untagged mapped footway and the inspected picture; no bridge-specific road suppression is claimed. Separate church, estate, garden buildings, town, vegetation, visitors and current condition survey remain host responsibilities.',
    'Physical laptop and phone performance measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'north-garden-facade', position: [51, 46, -85], lookAt: [0, 16, -4], fov: 43 },
    { name: 'south-courtyard-and-stairs', position: [5, 50, 95], lookAt: [0, 13, 18], fov: 43 },
    { name: 'roof-tiers-and-dormers', position: [58, 65, 2], lookAt: [0, 28, 0], fov: 43 },
    { name: 'south-gate-and-causeway', position: [26, 15, 85], lookAt: [0, 7, 49], fov: 43 },
    { name: 'courtyard-arcades', position: [0, 13, 30], lookAt: [19, 7, 17], fov: 43 },
    { name: 'west-green-pavilion', position: [-72, 37, -39], lookAt: [-24, 23, -5], fov: 43 },
  ],
};
