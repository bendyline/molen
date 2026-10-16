/** Original Egeskov exterior, built from attributed map traces and editable controls. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u1/u1z/n0298_egeskov_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
const cosine = Math.cos(k.planAngleRadians),
  sine = Math.sin(k.planAngleRadians);
export const egeskovPlanPoint = (x, z) => [x * cosine + z * sine, -x * sine + z * cosine];
export const egeskovPalette = {
  wall: '#d29b80',
  roof: '#ba805c',
  stone: '#c3b49a',
  trim: '#e8d5b4',
  copper: '#9ac4b6',
  glass: '#4d6178',
  paving: '#b7b0a1',
  dark: '#73664f',
  clock: '#547b97',
  gold: '#ccb77d',
};
export const egeskovSurfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.88, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
};
const colors = Object.fromEntries(
  Object.entries(egeskovPalette).map(([key, h]) => [
    key,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const clean = (p) =>
  Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.002 ? p.slice(0, -1) : p;
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
const circle = (c, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });
function face(o, p, color = 'wall', slot = 'brick', target) {
  p = p.map((p) => p.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, v, k) => s + v * target[k], 0) < 0) p = [...p].reverse();
    break;
  }
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((p) => [p[0], p[2]]),
      colors[color],
    );
  }
}
function triangulate(p) {
  p = clean(p);
  const ix = earcut(p.flat(), null, 2),
    out = [];
  for (let i = 0; i < ix.length; i += 3) out.push(ix.slice(i, i + 3).map((j) => p[j]));
  return out;
}
function cap(o, p, y, color = 'wall', slot = 'brick') {
  for (const t of triangulate(p))
    face(
      o,
      t.map((p) => [p[0], y, p[1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
function prism(o, p, y0, y1, color = 'wall', slot = 'brick', top = false) {
  p = clean(p);
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      color,
      slot,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
  if (top) cap(o, p, y1, color, slot);
}
function nativeBuilder(o) {
  return {
    addTriangle(slot, ref, p, _n, uv, color) {
      const q = p.map(([x, y, z]) => {
        const a = egeskovPlanPoint(x, z);
        return [a[0], y, a[1]].map(Math.fround);
      });
      const n = normalFor(...q);
      if (Math.hypot(...n) < 0.5) return;
      o.addTriangle(slot, ref, q, n, uv, color);
    },
  };
}
function portal(control, d, depth) {
  const a = control.route[0],
    b = control.route.at(-1),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return prepareOpening(
    {
      center: a.map((v, i) => (v + b[i]) / 2),
      axis: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
      width: control.width,
      height: control.height,
      spring: control.height - control.width / 2,
      depth,
      bottom: 0,
      shape: 'round',
    },
    control.baseY,
    d,
  );
}
function cutPrism(o, p, y0, y1, h, color = 'wall', slot = 'brick') {
  // Preserve each construction face's exterior after clipping and Float32 rounding.
  // A nearly collinear fan vertex must not choose the winding of the remaining wall.
  const emit = (slot, ref, p, _n, uv, c, target) => {
    let q = p.map((p) => p.map(Math.fround));
    const a = q[1].map((v, i) => v - q[0][i]),
      b = q[2].map((v, i) => v - q[0][i]),
      cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    if (Math.hypot(...cross) < 1e-9) return;
    if (cross.reduce((s, v, i) => s + v * target[i], 0) < 0) q = [q[0], q[2], q[1]];
    o.addTriangle(slot, ref, q, normalFor(...q), uv, c);
  };
  const out = {
    addTriangle: (slot, ref, points, n, uv, c) =>
      openingBuilder({ addTriangle: (s, r, p, nn, u, v) => emit(s, r, p, nn, u, v, n) }, [
        h,
      ]).addTriangle(slot, ref, points, n, uv, c),
  };
  prism(out, p, y0, y1, color, slot);
  const adapter = {
    addTriangle: (_s, r, p, n, uv, c) => {
      const plane = h.planes
        .slice(2)
        .find((v) =>
          p.every((q) => Math.abs(q[0] * v[0] + q[1] * v[1] + q[2] * v[2] + v[3]) < 0.003),
        );
      emit(slot, r, p, n, uv, c, plane?.slice(0, 3) ?? n);
    },
  };
  openingReveals(
    adapter,
    clean(p),
    () => y0,
    () => y1,
    [h],
    colors[color],
  );
}
function band(o, a, b, y, width = 0.14, color = 'wall', slot = 'brick', height = 0.16) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  if (len < 0.01) return;
  const n = [(dz / len) * width, (-dx / len) * width];
  prism(
    o,
    [
      [a[0] + n[0], a[1] + n[1]],
      [b[0] + n[0], b[1] + n[1]],
      [b[0] - n[0], b[1] - n[1]],
      [a[0] - n[0], a[1] - n[1]],
    ],
    y,
    y + height,
    color,
    slot,
    true,
  );
}
function loft(o, c, profile, n, color = 'copper', slot = 'patina') {
  for (let j = 1; j < profile.length; j++) {
    const lo = circle(c, profile[j - 1][1], n),
      hi = circle(c, profile[j][1], n);
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n,
        mid = ((i + 0.5) * Math.PI * 2) / n;
      face(
        o,
        [
          [lo[i][0], profile[j - 1][0], lo[i][1]],
          [hi[i][0], profile[j][0], hi[i][1]],
          [hi[next][0], profile[j][0], hi[next][1]],
          [lo[next][0], profile[j - 1][0], lo[next][1]],
        ],
        color,
        slot,
        [Math.cos(mid), 0, Math.sin(mid)],
      );
    }
  }
}
function clipAxis(p, axis, value, high) {
  const out = [];
  let a = p.at(-1),
    av = (a[axis] - value) * (high ? 1 : -1);
  for (const b of p) {
    const bv = (b[axis] - value) * (high ? 1 : -1);
    if (av >= 0 !== bv >= 0) {
      const t = av / (av - bv);
      out.push(a.map((v, i) => v + t * (b[i] - v)));
    }
    if (bv >= 0) out.push(b);
    a = b;
    av = bv;
  }
  return out;
}
/** Split roofs and boundary walls at the ridge so every wing has continuous coverage. */
function gable(o, p, axis, ridge, min, max, eave, rise) {
  const h = (q) =>
    eave +
    rise *
      Math.max(
        0,
        Math.min(
          1,
          q[axis] < ridge ? (q[axis] - min) / (ridge - min) : (max - q[axis]) / (max - ridge),
        ),
      );
  for (const high of [false, true]) {
    const part = clipAxis(clean(p), axis, ridge, high);
    if (part.length < 3) continue;
    for (const t of triangulate(part))
      face(
        o,
        t.map((q) => [q[0], h(q), q[1]]),
        'roof',
        'tile',
        [0, 1, 0],
      );
  }
  const q = clean(p),
    sign = Math.sign(area(q));
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      points = [a];
    if ((a[axis] - ridge) * (b[axis] - ridge) < 0) {
      const t = (ridge - a[axis]) / (b[axis] - a[axis]);
      points.push(a.map((v, k) => v + t * (b[k] - v)));
    }
    points.push(b);
    for (let j = 1; j < points.length; j++) {
      const a = points[j - 1],
        b = points[j];
      face(
        o,
        [
          [a[0], eave, a[1]],
          [b[0], eave, b[1]],
          [b[0], h(b), b[1]],
          [a[0], h(a), a[1]],
        ],
        'wall',
        'brick',
        [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      );
    }
  }
}
function verticalShape(o, profile, origin, axis, depth, color = 'wall', slot = 'brick') {
  const n = [axis[1], -axis[0]],
    point = (q, v) => [
      origin[0] + q[0] * axis[0] + v * n[0],
      q[1],
      origin[1] + q[0] * axis[1] + v * n[1],
    ];
  for (const t of triangulate(profile)) {
    face(
      o,
      t.map((q) => point(q, depth / 2)),
      color,
      slot,
      [n[0], 0, n[1]],
    );
    face(
      o,
      t.map((q) => point(q, -depth / 2)),
      color,
      slot,
      [-n[0], 0, -n[1]],
    );
  }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    face(
      o,
      [point(a, -depth / 2), point(b, -depth / 2), point(b, depth / 2), point(a, depth / 2)],
      color,
      slot,
    );
  }
}
function window(o, c, axis, y, width, height, d, color = 'trim', mullions = true) {
  const n = [axis[1], -axis[0]],
    pt = (u, v, off) => [c[0] + axis[0] * u + n[0] * off, v, c[1] + axis[1] * u + n[1] * off];
  face(
    o,
    [
      pt(-width / 2, y, 0.07),
      pt(width / 2, y, 0.07),
      pt(width / 2, y + height, 0.07),
      pt(-width / 2, y + height, 0.07),
    ],
    'glass',
    'glass',
    [n[0], 0, n[1]],
  );
  if (d < 2) return;
  const rim = 0.12;
  for (const [x0, v0, x1, v1] of [
    [-width / 2 - rim, y - rim, width / 2 + rim, y],
    [-width / 2 - rim, y + height, width / 2 + rim, y + height + rim],
    [-width / 2 - rim, y, -width / 2, y + height],
    [width / 2, y, width / 2 + rim, y + height],
  ])
    face(
      o,
      [pt(x0, v0, 0.09), pt(x1, v0, 0.09), pt(x1, v1, 0.09), pt(x0, v1, 0.09)],
      color,
      'stone',
      [n[0], 0, n[1]],
    );
  if (d === 3 && mullions) {
    face(
      o,
      [pt(-0.07, y, 0.1), pt(0.07, y, 0.1), pt(0.07, y + height, 0.1), pt(-0.07, y + height, 0.1)],
      'trim',
      'stone',
      [n[0], 0, n[1]],
    );
    face(
      o,
      [
        pt(-width / 2, y + height * 0.5 - 0.055, 0.1),
        pt(width / 2, y + height * 0.5 - 0.055, 0.1),
        pt(width / 2, y + height * 0.5 + 0.055, 0.1),
        pt(-width / 2, y + height * 0.5 + 0.055, 0.1),
      ],
      'trim',
      'stone',
      [n[0], 0, n[1]],
    );
  }
  if (d >= 2) {
    const profile = [
      [-width / 2 - rim, y + height],
      [width / 2 + rim, y + height],
      ...Array.from({ length: 7 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return [Math.cos(a) * (width / 2 + rim), y + height + 0.38 * Math.sin(a)];
      }),
    ];
    verticalShape(
      o,
      profile,
      [c[0] + n[0] * 0.15, c[1] + n[1] * 0.15],
      axis,
      0.11,
      'trim',
      'stone',
    );
  }
}
function stepped(o, c, axis, width, eave, peak, d) {
  const n = d === 0 ? 3 : 4,
    w = width / (2 * n + 1),
    rise = (peak - eave) / (n + 1),
    profile = [[-width / 2, eave]];
  for (let j = -n; j <= n; j++) {
    const x0 = (j - 0.5) * w,
      x1 = (j + 0.5) * w,
      y = peak - Math.abs(j) * rise;
    profile.push([x0, y], [x1, y]);
  }
  profile.push([width / 2, eave]);
  verticalShape(o, profile, c, axis, 0.5);
  if (d > 0)
    for (let j = -n; j <= n; j++) {
      const x = j * w,
        y = peak - Math.abs(j) * rise;
      band(
        o,
        [c[0] + axis[0] * (x - w * 0.33), c[1] + axis[1] * (x - w * 0.33)],
        [c[0] + axis[0] * (x + w * 0.33), c[1] + axis[1] * (x + w * 0.33)],
        y,
        0.31,
        'stone',
        'stone',
        0.14,
      );
    }
  if (d >= 2)
    for (let j = -n; j <= n; j++) {
      const u = j * w,
        y = peak - Math.abs(j) * rise;
      for (let v = eave + 0.8; v < y - 0.7; v += 2.2)
        window(
          o,
          [c[0] + u * axis[0] + axis[1] * 0.3, c[1] + u * axis[1] - axis[0] * 0.3],
          axis,
          v,
          0.65,
          1.35,
          d,
          'wall',
          false,
        );
    }
}
function arcade(o, a, b, y, d) {
  if (d < 2) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    axis = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [axis[1], -axis[0]],
    count = Math.max(1, Math.floor(len / 1.5));
  for (let j = 0; j < count; j++) {
    const c = [
        a[0] + ((b[0] - a[0]) * (j + 0.5)) / count + n[0] * 0.16,
        a[1] + ((b[1] - a[1]) * (j + 0.5)) / count + n[1] * 0.16,
      ],
      r = 0.42;
    for (let i = 0; i < 4; i++) {
      const aa = (i * Math.PI) / 4,
        bb = ((i + 1) * Math.PI) / 4,
        pt = (v, r) => [
          c[0] + axis[0] * Math.cos(v) * r,
          y + Math.sin(v) * r,
          c[1] + axis[1] * Math.cos(v) * r,
        ];
      face(o, [pt(aa, r), pt(bb, r), pt(bb, r + 0.14), pt(aa, r + 0.14)], 'wall', 'brick', [
        n[0],
        0,
        n[1],
      ]);
    }
  }
}
function towerDetails(o, t, d) {
  if (d < 1) return;
  const n = d === 1 ? 8 : 16;
  for (const y of [7.9, 14.5, 19.6])
    loft(
      o,
      t.center,
      [
        [y, t.radius],
        [y + 0.15, t.radius + 0.2],
        [y + 0.3, t.radius],
      ],
      n,
      'wall',
      'brick',
    );
  for (let j = 0; j < 6; j++) {
    const a = (j * Math.PI) / 3,
      normal = [Math.cos(a), Math.sin(a)],
      c = [t.center[0] + t.radius * normal[0], t.center[1] + t.radius * normal[1]],
      axis = [-normal[1], normal[0]];
    if (c[0] < 8 && Math.abs(c[1]) < 19.7) continue;
    for (const [y, h, w] of [
      [2.7, 1.6, 1],
      [9.2, 2.6, 1.3],
      [15.6, 1.7, 1.15],
    ])
      window(o, c, axis, y, w, h, d);
  }
  if (d >= 2)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const r = t.radius * 0.7,
        c = [t.center[0] + r * Math.cos(a), t.center[1] + r * Math.sin(a)],
        axis = [-Math.sin(a), Math.cos(a)],
        n = [axis[1], -axis[0]],
        y = t.eaveY + 3.2;
      prism(
        o,
        rect(c[0] - 0.5, c[1] - 0.5, c[0] + 0.5, c[1] + 0.5),
        y,
        y + 1.6,
        'copper',
        'patina',
        true,
      );
      face(
        o,
        [
          [c[0] - axis[0] * 0.35 + n[0] * 0.53, y + 0.15, c[1] - axis[1] * 0.35 + n[1] * 0.53],
          [c[0] + axis[0] * 0.35 + n[0] * 0.53, y + 0.15, c[1] + axis[1] * 0.35 + n[1] * 0.53],
          [c[0] + axis[0] * 0.35 + n[0] * 0.53, y + 1.25, c[1] + axis[1] * 0.35 + n[1] * 0.53],
          [c[0] - axis[0] * 0.35 + n[0] * 0.53, y + 1.25, c[1] - axis[1] * 0.35 + n[1] * 0.53],
        ],
        'glass',
        'glass',
        [n[0], 0, n[1]],
      );
    }
}
function roofDormers(o, d) {
  if (d < 2) return;
  for (const z of [-12, 8, 14]) {
    const x = -8.1,
      depth = 1.45,
      base =
        k.mainEaveY +
        ((k.mainRidgeY - k.mainEaveY) * (x - k.roofBounds.x0)) / (k.ridgeX[0] - k.roofBounds.x0),
      p = rect(x - 0.65, z - depth / 2, x + 0.8, z + depth / 2);
    const roofY = (q) =>
      k.mainEaveY +
      ((k.mainRidgeY - k.mainEaveY) * (q[0] - k.roofBounds.x0)) / (k.ridgeX[0] - k.roofBounds.x0);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      face(
        o,
        [
          [a[0], roofY(a) - 0.08, a[1]],
          [b[0], roofY(b) - 0.08, b[1]],
          [b[0], base + 2.2, b[1]],
          [a[0], base + 2.2, a[1]],
        ],
        'wall',
        'brick',
        [b[1] - a[1], 0, -(b[0] - a[0])],
      );
    }
    gable(o, p, 1, z, z - depth / 2, z + depth / 2, base + 2.2, 1.1);
    window(o, [x - 0.65, z], [0, -1], roofY([x - 0.65, z]) + 0.35, 0.8, 1.25, d);
  }
}
function main(o, d) {
  const h = portal(k.castlePassage, d, 34);
  if (d === 0) {
    prism(o, k.castleOutline, 0, k.foundationTopY, 'stone', 'stone');
    prism(o, k.castleOutline, k.foundationTopY, k.mainEaveY);
  } else {
    cutPrism(o, k.castleOutline, 0, k.foundationTopY, h, 'stone', 'stone');
    cutPrism(o, k.castleOutline, k.foundationTopY, k.mainEaveY, h);
  }
  const b = k.roofBounds;
  for (const [x0, x1, ridge] of [
    [b.x0, 0, k.ridgeX[0]],
    [0, b.x1, k.ridgeX[1]],
  ]) {
    const p = clipAxis(clipAxis(k.mainRoofOutline, 0, x0, true), 0, x1, false);
    gable(o, p, 0, ridge, x0, x1, k.mainEaveY, k.mainRidgeY - k.mainEaveY);
    for (const z of [b.z0, b.z1])
      stepped(
        o,
        [(x0 + x1) / 2, z],
        z < 0 ? [1, 0] : [-1, 0],
        x1 - x0,
        k.mainEaveY,
        k.mainRidgeY + 1.25,
        d,
      );
  }
  if (d > 0) {
    for (const side of [-1, 1]) {
      const x = side < 0 ? b.x0 : b.x1,
        axis = [0, side];
      for (const y of [7.9, 14.5, 17.5]) {
        band(o, [x, b.z0], [x, b.z1], y, 0.15);
        arcade(o, side < 0 ? [x, b.z1] : [x, b.z0], side < 0 ? [x, b.z0] : [x, b.z1], y - 0.52, d);
      }
      for (const z of [-15, -10, -5, 5, 10, 15]) {
        if (side < 0 && z > -6 && z < 4) continue;
        for (const [y, h, w] of [
          [2.5, 1.7, 1.1],
          [9, 2.8, 1.65],
          [15.6, 1.55, 1.1],
        ])
          window(o, [x, z], axis, y, w, h, d);
      }
    }
    for (const z of [b.z0, b.z1]) {
      const axis = z < 0 ? [1, 0] : [-1, 0];
      for (const x of [-7.6, -2.5, 2.5, 7.6])
        for (const [y, h, w] of [
          [2.5, 1.7, 1.1],
          [9, 2.8, 1.5],
          [15.6, 1.45, 1.1],
        ])
          window(o, [x, z], axis, y, w, h, d);
      for (const y of [7.9, 14.5, 17.5]) {
        band(o, [b.x0, z], [b.x1, z], y, 0.15);
        arcade(o, z < 0 ? [b.x0, z] : [b.x1, z], z < 0 ? [b.x1, z] : [b.x0, z], y - 0.52, d);
      }
    }
  }
  roofDormers(o, d);
}
function towers(o, d) {
  for (const t of k.towers) {
    const n = d === 0 ? 8 : d === 1 ? 12 : 24;
    prism(o, circle(t.center, t.radius, n), k.mainEaveY, t.eaveY);
    const profile = [
      [t.eaveY, t.radius + 0.25],
      [t.eaveY + 0.4, t.radius + 0.32],
      ...(d === 0 ? [] : [[t.eaveY + 1.1, t.radius * 0.9]]),
      [t.eaveY + 4, t.radius * 0.55],
      [t.eaveY + t.helmRise, 0.07],
    ];
    loft(o, t.center, profile, n);
    if (d > 0)
      loft(
        o,
        t.center,
        [
          [31, 0.07],
          [32.1, 0.07],
        ],
        6,
        'gold',
        'plaster',
      );
    towerDetails(o, t, d);
  }
}
function stair(o, d) {
  const s = k.stair,
    h = portal(k.castlePassage, d, 34);
  cutPrism(o, s.outline, k.mainEaveY, s.eaveY, h);
  const xmin = Math.min(...s.outline.map((p) => p[0])),
    z0 = Math.min(...s.outline.map((p) => p[1])),
    z1 = Math.max(...s.outline.map((p) => p[1]));
  gable(o, s.outline, 1, (z0 + z1) / 2, z0, z1, s.eaveY, s.ridgeY - s.eaveY);
  stepped(o, [xmin, (z0 + z1) / 2], [0, -1], z1 - z0, s.eaveY, s.ridgeY + 1.25, d);
  loft(
    o,
    [-11.7, -1.23],
    [
      [25.9, 0.95],
      [27.3, 0.95],
      [28.3, 0.7],
      [s.spireTopY, 0.06],
    ],
    d === 0 ? 6 : 12,
  );
  if (d > 0) {
    for (const z of [-4.2, -1.2, 1.8])
      for (const y of [9.2, 15.6]) window(o, [xmin, z], [0, -1], y, 1.55, 2, d);
    face(
      o,
      [
        [xmin - 0.33, 23.4, -2.13],
        [xmin - 0.33, 23.4, -0.33],
        [xmin - 0.33, 25.2, -0.33],
        [xmin - 0.33, 25.2, -2.13],
      ],
      'clock',
      'glass',
      [-1, 0, 0],
    );
    if (d === 3) {
      face(
        o,
        [
          [xmin - 0.35, 24.25, -1.32],
          [xmin - 0.35, 24.25, -1.13],
          [xmin - 0.35, 24.98, -1.13],
          [xmin - 0.35, 24.98, -1.32],
        ],
        'gold',
        'plaster',
        [-1, 0, 0],
      );
      face(
        o,
        [
          [xmin - 0.35, 24.16, -1.23],
          [xmin - 0.35, 24.35, -1.23],
          [xmin - 0.35, 24.35, -0.54],
          [xmin - 0.35, 24.16, -0.54],
        ],
        'gold',
        'plaster',
        [-1, 0, 0],
      );
    }
    prism(
      o,
      rect(xmin - 0.28, -3.18, xmin - 0.1, 0.72),
      k.castlePassage.baseY,
      k.castlePassage.baseY + 0.28,
      'stone',
      'stone',
      true,
    );
    band(o, [xmin - 0.3, -3.18], [xmin - 0.3, 0.72], 7.4, 0.2, 'stone', 'stone', 0.5);
  }
}
function gate(o, d) {
  const g = k.gatehouse,
    h = portal(k.gatePassage, d, 16),
    p = g.outline;
  if (d === 0) {
    prism(o, p, 0, g.baseY, 'stone', 'stone');
    prism(o, p, g.baseY, g.eaveY);
  } else {
    cutPrism(o, p, 0, g.baseY, h, 'stone', 'stone');
    cutPrism(o, p, g.baseY, g.eaveY, h);
  }
  const a = p[4],
    b = p[5],
    axis = [b[0] - a[0], b[1] - a[1]],
    length = Math.hypot(...axis);
  axis[0] /= length;
  axis[1] /= length;
  const along = [-axis[1], axis[0]],
    project = (q) => [q[0] * along[0] + q[1] * along[1], q[0] * axis[0] + q[1] * axis[1]],
    inverse = ([u, v]) => [u * along[0] + v * axis[0], u * along[1] + v * axis[1]],
    roof = p.slice(1, 8).map(project),
    min = Math.min(...roof.map((q) => q[1])),
    max = Math.max(...roof.map((q) => q[1])),
    mid = (min + max) / 2;
  const adapter = {
    addTriangle: (s, r, points, _n, uv, c) => {
      const q = points.map(([u, y, v]) => {
        const p = inverse([u, v]);
        return [p[0], y, p[1]];
      });
      // This gate-frame basis reflects XZ; restore the authored exterior winding.
      q.reverse();
      o.addTriangle(s, r, q, normalFor(...q), uv, c);
    },
  };
  gable(adapter, roof, 1, mid, min, max, g.eaveY, g.roofRise);
  const umin = Math.min(...roof.map((q) => q[0])),
    umax = Math.max(...roof.map((q) => q[0]));
  for (const u of [umin, umax])
    stepped(
      o,
      inverse([u, mid]),
      u === umin ? axis : axis.map((v) => -v),
      max - min,
      g.eaveY,
      g.eaveY + g.roofRise + 1,
      d,
    );
  if (d >= 2)
    for (let j = 0; j < 4; j++) {
      const u = umin + ((umax - umin) * (j + 1)) / 5,
        v = min + (max - min) * 0.25,
        half = 0.7,
        depth = 1.15,
        outline = rect(u - half, v - depth / 2, u + half, v + depth / 2),
        roofY = (q) => g.eaveY + (g.roofRise * (q[1] - min)) / (mid - min),
        base = roofY([u, v]),
        top = base + 1.75;
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i],
          b = outline[(i + 1) % outline.length];
        face(
          adapter,
          [
            [a[0], roofY(a) - 0.08, a[1]],
            [b[0], roofY(b) - 0.08, b[1]],
            [b[0], top, b[1]],
            [a[0], top, a[1]],
          ],
          'wall',
          'brick',
          [b[1] - a[1], 0, -(b[0] - a[0])],
        );
      }
      gable(adapter, outline, 0, u, u - half, u + half, top, 1.05);
      window(
        o,
        inverse([u, v - depth / 2]),
        along.map((v) => -v),
        roofY([u, v - depth / 2]) + 0.3,
        0.8,
        1.15,
        d,
      );
    }
  const annex = k.gateAnnex;
  prism(o, annex.outline, 0, annex.eaveY, 'wall', 'brick');
  gable(o, annex.outline, 0, -58, -61, -55, annex.eaveY, annex.roofRise);
  if (d > 0) {
    const aa = p[2],
      bb = p[4],
      len = Math.hypot(bb[0] - aa[0], bb[1] - aa[1]),
      axis = [-(bb[0] - aa[0]) / len, -(bb[1] - aa[1]) / len];
    for (let j = 0; j < 6; j++) {
      const c = aa.map((v, i) => v + ((bb[i] - v) * (j + 0.5)) / 6);
      for (const y of [3.3, 7.2]) {
        const [u, , depth] = h.local([c[0], y, c[1]]);
        // Reject a complete window when its pane or trim would cross the arch.
        // Distance to the passage midpoint also includes wall depth and misses
        // windows on the entrance facade.
        if (
          Math.abs(u) < h.width / 2 + 0.7 &&
          Math.abs(depth) < h.depth / 2 &&
          y < k.gatePassage.baseY + h.height &&
          y + 1.65 > k.gatePassage.baseY
        )
          continue;
        window(o, c, axis, y, 1.1, 1.65, d);
      }
    }
    const turret = [-57.32, 31.4];
    loft(
      o,
      turret,
      [
        [g.eaveY, 1.45],
        [g.eaveY + 1, 1.25],
        [g.eaveY + 6, 0.04],
      ],
      d === 1 ? 8 : 16,
    );
  }
}
function routePrism(o, p, width, y0, y1, color, slot) {
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [((-(b[1] - a[1]) / len) * width) / 2, (((b[0] - a[0]) / len) * width) / 2];
    prism(
      o,
      [
        [a[0] + n[0], a[1] + n[1]],
        [b[0] + n[0], b[1] + n[1]],
        [b[0] - n[0], b[1] - n[1]],
        [a[0] - n[0], a[1] - n[1]],
      ],
      y0,
      y1,
      color,
      slot,
      true,
    );
  }
}
function approaches(o, d) {
  routePrism(
    o,
    k.castleApproach.points,
    k.castleApproach.width,
    0,
    k.castleApproach.deckY,
    'paving',
    'aggregate',
  );
  routePrism(
    o,
    k.westernDrive.points,
    k.westernDrive.width,
    k.westernDrive.y - 0.2,
    k.westernDrive.y,
    'paving',
    'aggregate',
  );
  const bridge = k.eastBridge,
    a = bridge.points[0],
    b = bridge.points.at(-1),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  routePrism(
    o,
    bridge.points,
    bridge.width,
    bridge.deckY - 0.32,
    bridge.deckY,
    'dark',
    'aggregate',
  );
  for (const t of [0.12, 0.93]) {
    const c = a.map((v, i) => v + (b[i] - v) * t);
    prism(
      o,
      rect(c[0] - 1, c[1] - 1.4, c[0] + 1, c[1] + 1.4),
      0,
      bridge.deckY - 0.31,
      'stone',
      'stone',
      true,
    );
  }
  if (d > 0)
    for (const side of [-1, 1]) {
      const aa = a.map((v, i) => v + ((n[i] * bridge.width) / 2) * side),
        bb = b.map((v, i) => v + ((n[i] * bridge.width) / 2) * side);
      band(o, aa, bb, bridge.deckY + 0.9, 0.08, 'dark', 'stone', 0.16);
      const count = d === 1 ? 5 : 12;
      for (let i = 0; i <= count; i++) {
        const c = aa.map((v, j) => v + ((bb[j] - v) * i) / count);
        prism(
          o,
          rect(c[0] - 0.08, c[1] - 0.08, c[0] + 0.08, c[1] + 0.08),
          bridge.deckY,
          bridge.deckY + 1.02,
          'dark',
          'stone',
          true,
        );
      }
    }
}
const parts = { main, towers, stair, gate, approaches };
export const buildEgeskovDormers = (o, d) => roofDormers(nativeBuilder(o), d);
export const egeskovParts = Object.fromEntries(
  Object.entries(parts).map(([name, fn]) => [name, (o, d) => fn(nativeBuilder(o), d)]),
);
export function buildEgeskovRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(egeskovParts)) fn(o, d);
}
export const buildEgeskovSkyline = (o) => buildEgeskovRuntime(o, 'skyline');
export const egeskovStudy = {
  id: 'N0298',
  key: 'egeskov_castle',
  title: 'Egeskov Castle',
  category: 'castle',
  wikidataId: 'Q857504',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildEgeskovRuntime(o),
  surfaceOverrides: egeskovSurfaces,
  brief:
    'Twin red-brick longhouses with parallel steep red roofs and four stepped gables,two copper-helmed eastern round towers,west square clock/stair tower,current gate wing with physical arched passage,west entrance approach and east footbridge.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: egeskovPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'Two parallel red roofs and four tall stepped gables',
      'Two round corner towers with flared copper spires',
      'Square west stair/clock tower and current low gate wing',
    ],
  },
  sourceFacts: {
    exactCastleWay: 96858366,
    longhouses: 2,
    mainGables: 4,
    roundTowers: 2,
    squareStairTowers: 1,
    physicalPassages: 2,
    numericVerticalHeightVerified: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Own attributed exact-QID map footprint and separate gate/bridge traces. All vertical dimensions and architectural section estimated from primary heritage-research exterior photos.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'surface-means.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own mapped traces © OpenStreetMap contributors,ODbL-1.0. Primary photographs are not redistributed.',
  sourceNotice:
    'Six existing shared256-square graphs,linear tints and central metric UV repeats. Flat glass. No embedded/new images,photo texture,downloaded model or traced printed drawing.',
  dataAttribution: '© OpenStreetMap contributors; Egeskov; Dansk Center for Herregårdsforskning.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: k.waterAttachmentY,
    reviewStatus: 'Inactive draft: actual lake/shore/bridge and current terrain fit unverified.',
  }),
  geographicNote:
    'Native East/South geometry bakes heading0. Exact-QID footprint reference anchor. Provisional visible water attachmentY0.3 and bottomY0 are not surveyed lake elevation. Separate current gatehouse and bridge traces remain attributed.',
  limitations: refs.limitations,
  importReason:
    'Preserve twin longhouses and stepped gables,copper-helmed towers,west stair tower,current gate passage and two approach spans through four source-authored detail levels.',
  mediumFiContext: { scale: '1.0', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: [105, 70, 90], lookAt: [-12, 14, 5], fov: 42 },
  qaCameras: [
    { name: 'twin-gables-south', position: [18, 24, 67], lookAt: [1, 17, 17] },
    { name: 'copper-spires-east', position: [70, 35, 23], lookAt: [11, 21, 0] },
    { name: 'west-clock-and-portal', position: [-65, 24, -4], lookAt: [-12, 16, -1] },
    { name: 'gatehouse-arch', position: [-27, 9, 55], lookAt: [-34, 7, 31] },
    { name: 'parallel-roof-plan', position: [10, 80, 5], lookAt: [0, 16, 0] },
    { name: 'east-footbridge', position: [38, 12, 21], lookAt: [28, 3, 1] },
    { name: 'west-entrance-approach', position: [-47, 16, 16], lookAt: [-24, 4, -1] },
  ],
};
