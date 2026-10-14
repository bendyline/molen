/** Cardiff Castle: individual shell keep, western palace, clock tower and enclosure. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/gc/gcj/n0325_cardiff_castle/',
    import.meta.url,
  ),
  read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  floor = frame.reconstruction.palaceFloor;
const palette = {
  stone: '#c6bca5',
  oldStone: '#adad99',
  trim: '#d6c7aa',
  roof: '#69747b',
  green: '#879e80',
  glass: '#506d7d',
  grass: '#83a563',
  accent: '#d6b456',
  visitor: '#e7dcc5',
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
export function cardiffGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Cardiff footing outside retained DEM');
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
  for (const h of hs)
    openingReveals(
      openingBuilder(
        {
          addTriangle(_slot, ref, p, n, uv, c) {
            p = p.map((v) => v.map(Math.fround));
            if (
              Math.hypot(
                ...cross(
                  p[1].map((v, k) => v - p[0][k]),
                  p[2].map((v, k) => v - p[0][k]),
                ),
              ) < 1e-7
            )
              return;
            out.addTriangle(slot, ref, p, n, uv, c);
          },
        },
        hs.filter((q) => q !== h),
      ),
      r,
      (p) => (typeof b === 'function' ? b(p) : b),
      (p) => (typeof t === 'function' ? t(p) : t),
      [h],
      d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
    );
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

const components = frame.reconstruction.components;
const component = (id) => components.find((c) => c.id === id).polygons;
const box = (face, slot, p, w, dep, b, t) => solid(face, rect(...p, w, dep), b, t, slot);
export const cardiffOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !cardiffOpenings.some((q) => q.name === h.name)) cardiffOpenings.push(h);
  return h;
};
function regular(p, radius, n, angle = 0) {
  return Array.from({ length: n }, (_, i) => [
    p[0] + radius * Math.cos(angle + (i * Math.PI * 2) / n),
    p[1] + radius * Math.sin(angle + (i * Math.PI * 2) / n),
  ]);
}
function bounds(r) {
  return {
    x: Math.min(...r.map((p) => p[0])),
    z: Math.min(...r.map((p) => p[1])),
    xx: Math.max(...r.map((p) => p[0])),
    zz: Math.max(...r.map((p) => p[1])),
  };
}
function roof(face, r, eave, a, b, top, slot = 'roof') {
  const mid = lerp(a, b, 0.5),
    u = unit(b.map((v, k) => v - a[k]));
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length],
      m = lerp(p, q, 0.5),
      along = (m[0] - mid[0]) * u[0] + (m[1] - mid[1]) * u[1];
    if (
      Math.abs((q[0] - p[0]) * u[0] + (q[1] - p[1]) * u[1]) >
      Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.6
    ) {
      const f = (q[0] - p[0]) * u[0] + (q[1] - p[1]) * u[1] > 0;
      face(slot, [at(p, eave), at(q, eave), at(f ? b : a, top), at(f ? a : b, top)], [0, 1, 0]);
    } else face(slot, [at(p, eave), at(q, eave), at(along < 0 ? a : b, top)], [0, 1, 0]);
  }
}
function cone(face, p, radius, bottom, top, n, slot = 'roof') {
  const r = regular(p, radius, n);
  for (let i = 0; i < n; i++)
    face(
      slot,
      [at(r[i], bottom), at(r[(i + 1) % n], bottom), at(p, top)],
      [r[i][0] - p[0], 0.2, r[i][1] - p[1]],
    );
}
function crenels(face, r, y, d, slot = 'stone', stride = 4.5) {
  if (!d) return;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(...b.map((v, k) => v - a[k]));
    if (len < (d === 1 ? 5 : 2)) continue;
    const n = Math.max(1, Math.floor(len / (d === 1 ? stride * 2.8 : stride))),
      u = unit(b.map((v, k) => v - a[k]));
    for (let j = 0; j < n; j++) {
      const p = lerp(a, b, (j + 0.5) / n),
        l = Math.min((len / n) * 0.47, 2.3),
        t = typeof y === 'function' ? y(p) : y;
      band(
        face,
        p.map((v, k) => v - (u[k] * l) / 2),
        p.map((v, k) => v + (u[k] * l) / 2),
        0.95,
        t + 1.0,
        slot,
        1.0,
      );
    }
  }
}
function window(face, h, d, slot = 'trim') {
  const n = h.normal,
    u = h.axis,
    pt = (x, y, dep) => [
      h.center[0] + u[0] * x + n[0] * dep,
      y,
      h.center[1] + u[1] * x + n[1] * dep,
    ],
    w = h.width / 2,
    b = h.bottom,
    t = b + h.height,
    off = d === 1 ? 0.035 : -0.16;
  face(
    'glass',
    [
      pt(-w + 0.08, b + 0.08, off),
      pt(w - 0.08, b + 0.08, off),
      pt(w - 0.08, t - 0.08, off),
      pt(-w + 0.08, t - 0.08, off),
    ],
    [n[0], 0, n[1]],
  );
  if (d < 2) return;
  const strip = (x0, x1, y0, y1) =>
    face(
      slot,
      [pt(x0, y0, 0.06), pt(x1, y0, 0.06), pt(x1, y1, 0.06), pt(x0, y1, 0.06)],
      [n[0], 0, n[1]],
    );
  strip(-w - 0.18, w + 0.18, b - 0.16, b + 0.03);
  strip(-w - 0.18, w + 0.18, t - 0.03, t + 0.18);
  strip(-w - 0.16, -w + 0.03, b, t);
  strip(w - 0.03, w + 0.16, b, t);
  strip(-0.08, 0.08, b, t);
  if (d >= 3) strip(-w, w, b + h.height * 0.55, b + h.height * 0.55 + 0.12);
}
function windowRows(r, d, b, t, name, spacing = 4.5) {
  if (d === 2) spacing *= 1.4;
  if (!d) return [];
  const hs = [],
    s = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      q = r[(i + 1) % r.length],
      len = Math.hypot(...q.map((v, k) => v - a[k]));
    if (len < 2.3) continue;
    const u = unit(q.map((v, k) => v - a[k])),
      n = [u[1] * s, -u[0] * s],
      bays = Math.max(1, Math.floor(len / (d === 1 ? spacing * 2 : spacing))),
      rows =
        d === 1
          ? [b + (t - b) * 0.5]
          : d === 2
            ? [b + (t - b) * 0.66]
            : [b + 4.5, b + (t - b) * 0.66];
    for (let j = 0; j < bays; j++)
      for (const y of rows)
        hs.push(
          remember(
            {
              name: `${name}-${i}-${j}-${y}`,
              center: lerp(a, q, (j + 0.5) / bays),
              axis: u,
              normal: n,
              width: Math.min(1.7, len - 1),
              bottom: y,
              height: Math.min(2.6, t - y - 0.7),
              depth: 3.4,
              shape: 'rectangle',
            },
            d,
          ),
        );
  }
  return hs;
}
function hollow(out, d, r, inner, b, t, holes, slot = 'stone') {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d);
  sides(face, r, b, t, slot);
  sides(face, inner, b, t, slot, true);
  cap(face, r, t, slot, [inner]);
  for (const h of hs)
    openingReveals(
      openingBuilder(
        {
          addTriangle(_s, ref, p, n, uv, c) {
            p = p.map((v) => v.map(Math.fround));
            if (
              Math.hypot(
                ...cross(
                  p[1].map((v, k) => v - p[0][k]),
                  p[2].map((v, k) => v - p[0][k]),
                ),
              ) < 1e-7
            )
              return;
            out.addTriangle(slot, ref, p, n, uv, c);
          },
        },
        hs.filter((q) => q !== h),
      ),
      r,
      (p) => (typeof b === 'function' ? b(p) : b),
      (p) => (typeof t === 'function' ? t(p) : t),
      [h],
      d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
    );
}
function keep(out, d) {
  const face = writer(out, d),
    p = frame.reconstruction.motteCenter,
    r = component(frame.reconstruction.keepId)[0],
    outer = simplify(r.outline, d === 0 ? 0.45 : 0.05),
    inside = simplify(r.holes[0], d === 0 ? 0.45 : 0.05),
    f = frame.reconstruction.keepFloor;
  const n = d === 0 ? 12 : d === 1 ? 16 : 24,
    base = regular(p, 33, n),
    summit = regular(p, 15.1, n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(
      'grass',
      [
        at(base[i], (q) => cardiffGround(...q) - 0.15),
        at(base[j], (q) => cardiffGround(...q) - 0.15),
        at(summit[j], f - 0.3),
        at(summit[i], f - 0.3),
      ],
      [base[i][0] - p[0], 1, base[i][1] - p[1]],
    );
  }
  cap(face, summit, f - 0.3, 'grass');
  const gate = remember(
    {
      name: 'keep-entrance',
      center: [-43.4, -22.7],
      axis: [0.872, -0.489],
      normal: [0.489, 0.872],
      width: 2.1,
      bottom: f,
      height: 3.9,
      spring: 2.7,
      depth: 8,
      shape: 'round',
    },
    d,
  );
  const holes = [gate];
  if (d >= 2)
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i],
        b = outer[(i + 1) % outer.length],
        len = Math.hypot(...b.map((v, k) => v - a[k]));
      if (len < 5 || lerp(a, b, 0.5)[1] > -25) continue;
      const u = unit(b.map((v, k) => v - a[k])),
        nn = [u[1] * sign(outer), -u[0] * sign(outer)];
      holes.push(
        remember(
          {
            name: `keep-slit-${i}`,
            center: lerp(a, b, 0.5),
            axis: u,
            normal: nn,
            width: 0.75,
            bottom: 17.8,
            height: 1.7,
            depth: 5,
            shape: 'rectangle',
          },
          d,
        ),
      );
    }
  const top = (q) => (q[1] > -28 && q[0] > -47 ? 25 : 22);
  hollow(out, d, outer, inside, f, top, holes, 'oldStone');
  crenels(face, outer, top, d, 'oldStone', 3.5);
  cap(face, inside, f, 'stone');
  const turret = [-43.2, -24.2],
    rr = regular(turret, d === 0 ? 1.3 : 1.1, d === 0 ? 6 : 8);
  solid(face, rr, 24.8, 28.2, 'stone');
  crenels(face, rr, 28.2, d, 'stone', 2.0);
  // The mapped staircase starts at the southern foot of the motte and ends at the keep.
  const steps = frame.reconstruction.stairs,
    aa = steps[0],
    bb = steps.at(-1),
    landing = [-43.4, -22.7],
    start = cardiffGround(...aa) + 0.12;
  const run = (a, b, y0, y1, count) => {
    for (let j = 0; j < count; j++) {
      const l = lerp(a, b, j / count),
        q = lerp(a, b, (j + 1) / count),
        y = y0 + ((y1 - y0) * (j + 1)) / count;
      band(
        face,
        l,
        q,
        2.4,
        y,
        'stone',
        Math.max(0.5, y - Math.min(cardiffGround(...l), cardiffGround(...q)) + 0.15),
      );
    }
  };
  run(aa, bb, start, f, d === 0 ? 1 : d === 1 ? 3 : d === 2 ? 26 : 36);
  band(face, bb, landing, 2.4, f, 'stone', 0.55);
}
const gates = [
  {
    name: 'north-gate',
    center: [-22, -96.5],
    axis: [0.966, -0.258],
    normal: [-0.258, -0.966],
    width: 3.8,
    bottom: 2.0,
    height: 4.5,
    spring: 3.0,
    depth: 14,
    shape: 'round',
  },
  {
    name: 'west-gate',
    center: [-91.7, 69.7],
    axis: [0.198, -0.98],
    normal: [-0.98, -0.198],
    width: 4.0,
    bottom: 2.8,
    height: 4.7,
    spring: 3.2,
    depth: 22,
    shape: 'round',
  },
  {
    name: 'south-gate',
    center: [28.1, 98],
    axis: [0.97, -0.244],
    normal: [0.244, 0.97],
    width: 4.5,
    bottom: 2.6,
    height: 4.9,
    spring: 3.4,
    depth: 20,
    shape: 'round',
  },
  {
    name: 'inner-wall-gate',
    center: [-29, 7.5],
    axis: [0.88, -0.475],
    normal: [0.475, 0.88],
    width: 3.5,
    bottom: 0.8,
    height: 3.6,
    spring: 2.4,
    depth: 15,
    shape: 'round',
  },
];
function enclosure(out, d) {
  const face = writer(out, d);
  for (const h of gates) remember(h, d);
  for (const id of [35185182135596, 35185182135598, 35185182135603, 35185182135579])
    for (const p of component(id)) {
      const r = simplify(p.outline, d === 0 ? 1.2 : d === 1 ? 0.6 : d === 2 ? 0.25 : 0.08),
        b = (q) => cardiffGround(...q) - 0.45,
        t = (q) => cardiffGround(...q) + 5.0;
      masonry(out, d, r, b, t, gates, 'stone');
      crenels(face, r, t, d, 'stone', d === 1 ? 9 : d === 2 ? 9 : 6);
    }
  for (const p of component(35184471878357))
    masonry(
      out,
      d,
      simplify(p.outline, d === 0 ? 1 : 0.1),
      (q) => cardiffGround(...q) - 0.35,
      5,
      gates,
      'stone',
    );
  for (const [id, top] of [
    [35185182135597, 11],
    [35185182135599, 5],
    [35185645656470, 18.5],
  ])
    for (const p of component(id)) {
      const r = simplify(p.outline, d === 1 ? 0.4 : 0.06);
      masonry(out, d, r, (q) => cardiffGround(...q) - 0.4, top, gates, 'stone');
      if (d >= 2) crenels(face, r, top, d, 'stone', 5.0);
    }
  // The smaller inner gate/bastion and mapped southern gate towers remain distinct.
  for (const id of [
    35185181487797, 35185645656493, 35185645656474, 52776575618497, 52776575618498, 35185182135573,
    35185182135574,
  ])
    for (const p of component(id)) {
      const top =
          id === 35185181487797
            ? 10.0
            : id === 52776575618498
              ? 14.5
              : id === 35185645656474
                ? 11
                : 7.8,
        r = simplify(p.outline, d === 0 ? 0.6 : 0.05);
      masonry(out, d, r, (q) => cardiffGround(...q) - 0.4, top, gates, 'oldStone');
      crenels(face, r, top, d, 'stone', 4.5);
    }
}
function palace(out, d) {
  const face = writer(out, d),
    main = component(35185182135595)[0].outline,
    r = simplify(main, d === 0 ? 0.75 : d === 1 ? 0.4 : 0.06),
    windows = windowRows(r, d, floor, 16.8, 'palace');
  hollow(out, d, r, offsetRing(r, 1.3), floor, 16.8, d >= 2 ? windows : []);
  for (const h of windows) window(face, h, d);
  // A long mapped range with separate northern and southern gabled roof pieces.
  roof(
    face,
    [
      [-83, 34],
      [-71, 30],
      [-58, 74],
      [-71, 78],
    ],
    16.8,
    [-76.4, 35],
    [-64.4, 72],
    23.5,
  );
  for (const [id, wall, roofTop] of [
    [52776575618496, 25, 31],
    [52776575618494, 21.5, 27.5],
    [35185181463444, 18.5, 24],
    [35185182135588, 25.5, 31.5],
  ]) {
    for (const p of component(id)) {
      const rr = simplify(p.outline, d === 0 ? 0.5 : 0.04),
        ws = windowRows(rr, d, floor, wall, `tower-${id}`, 5.0),
        q = bounds(rr);
      masonry(out, d, rr, floor, wall, d >= 2 ? ws.concat(gates) : gates, 'stone');
      for (const h of ws) window(face, h, d);
      const center = [(q.x + q.xx) / 2, (q.z + q.zz) / 2];
      cone(face, center, Math.hypot(q.xx - q.x, q.zz - q.z) / 2, wall, roofTop, d === 0 ? 4 : 8);
      if (d)
        for (const c of rect(...center, (q.xx - q.x) * 0.8, (q.zz - q.z) * 0.8)) {
          solid(face, regular(c, 0.8, d === 1 ? 4 : 6), wall - 0.4, wall + 1.6, 'trim');
          cone(face, c, 1.0, wall + 1.6, wall + 4.3, d === 1 ? 4 : 6);
        }
    }
  }
  for (const p of component(52776575618495)) {
    const rr = simplify(p.outline, 0.04),
      q = bounds(rr),
      center = [(q.x + q.xx) / 2, (q.z + q.zz) / 2];
    solid(face, rr, floor, 22.5, 'stone');
    cone(face, center, 4.5, 22.5, 30.8, d === 0 ? 6 : 12, 'green');
  }
  // Selected square chimneys and roof dormers; omit below street distance.
  if (d >= 2)
    for (const [z, x] of [
      [38, -73.8],
      [52, -69.8],
      [66, -65.8],
    ]) {
      box(face, 'oldStone', [x, z], 1.7, 1.5, 21.2, 25.2);
      box(face, 'trim', [x, z], 2.0, 1.8, 25.2, 25.6);
      box(face, 'stone', [x + 4.2, z + 1.0], 1.7, 1.3, 18.3, 20.6);
      cone(face, [x + 4.2, z + 1.0], 1.5, 20.6, 22.0, 4);
    }
}
function clockTower(out, d) {
  const face = writer(out, d),
    r = component(35185181474148)[0].outline,
    rr = simplify(r, d === 0 ? 0.5 : 0.02),
    q = bounds(rr),
    p = [(q.x + q.xx) / 2, (q.z + q.zz) / 2],
    ws = windowRows(rr, d, 7, 31.5, 'clock-tower', 6);
  masonry(out, d, rr, cardiffGround(...p) - 0.4, 32.5, d >= 2 ? ws : [], 'stone');
  for (const h of ws) window(face, h, d);
  const upper = rect(...p, 13.2, 12.5);
  solid(face, upper, 32.5, 34.2, 'trim');
  roof(face, upper, 34.2, [p[0] - 2.3, p[1]], [p[0] + 2.3, p[1]], 39.5, 'green');
  if (d) {
    const corners = rect(...p, 12.7, 12.0);
    for (const c of corners) {
      solid(face, regular(c, 0.8, d === 1 ? 4 : 6), 32.3, 34.6, 'trim');
      cone(face, c, 1.2, 34.6, 37.2, d === 1 ? 4 : 6, 'roof');
    }
    // Four clock faces with simple hands and selected colored figure blocks.
    for (let i = 0; i < rr.length; i++) {
      const a = rr[i],
        b = rr[(i + 1) % rr.length],
        len = Math.hypot(...b.map((v, k) => v - a[k]));
      if (len < 6) continue;
      const u = unit(b.map((v, k) => v - a[k])),
        n = [u[1] * sign(rr), -u[0] * sign(rr)],
        center = lerp(a, b, 0.5),
        pt = (x, y, off = 0.065) => [
          center[0] + u[0] * x + n[0] * off,
          y,
          center[1] + u[1] * x + n[1] * off,
        ],
        n3 = [n[0], 0, n[1]];
      const circle = Array.from({ length: d === 1 ? 8 : 12 }, (_, j) =>
        pt(
          Math.cos((j * Math.PI * 2) / (d === 1 ? 8 : 12)) * 1.25,
          26.2 + Math.sin((j * Math.PI * 2) / (d === 1 ? 8 : 12)) * 1.25,
        ),
      );
      face('accent', circle, n3);
      face(
        'oldStone',
        [pt(-0.1, 26.05, 0.09), pt(0.1, 26.05, 0.09), pt(0.1, 27.1, 0.09), pt(-0.1, 27.1, 0.09)],
        n3,
      );
      face(
        'oldStone',
        [pt(0, 26.1, 0.09), pt(0.8, 25.8, 0.09), pt(0.86, 25.98, 0.09), pt(0, 26.3, 0.09)],
        n3,
      );
      if (d >= 2)
        for (const side of [-1, 1]) {
          face(
            'accent',
            [
              pt(side * 2.5 - 0.4, 28.0),
              pt(side * 2.5 + 0.4, 28.0),
              pt(side * 2.5 + 0.4, 30.1),
              pt(side * 2.5 - 0.4, 30.1),
            ],
            n3,
          );
          face(
            'trim',
            [
              pt(side * 2.5 - 0.28, 30.1),
              pt(side * 2.5 + 0.28, 30.1),
              pt(side * 2.5 + 0.28, 30.7),
              pt(side * 2.5 - 0.28, 30.7),
            ],
            n3,
          );
        }
    }
  }
}
function bridges(face, d) {
  for (const bridge of frame.reconstruction.bridges) {
    const gate = gates.find(
      (g) => g.name === (bridge.name === 'North Gate Bridge' ? 'north-gate' : 'west-gate'),
    );
    const points = [gate.center, ...bridge.line];
    for (let j = 0; j < points.length - 1; j++) {
      const a = points[j],
        b = points[j + 1],
        ya = j === 0 ? gate.bottom + 0.06 : cardiffGround(...a) + 0.28,
        yb = cardiffGround(...b) + 0.28,
        len = Math.hypot(...b.map((v, k) => v - a[k])),
        u = unit(b.map((v, k) => v - a[k])),
        n = [-u[1], u[0]],
        y = (p) =>
          ya +
          (yb - ya) * Math.max(0, Math.min(1, ((p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]) / len));
      band(face, a, b, 4.0, y, 'stone', 0.55);
      if (d && j > 0)
        for (const side of [-1, 1])
          band(
            face,
            a.map((v, k) => v + n[k] * side * 1.8),
            b.map((v, k) => v + n[k] * side * 1.8),
            0.3,
            (p) => y(p) + 0.8,
            'stone',
            0.8,
          );
      if (d >= 2 && j > 0)
        for (const t of [0.3, 0.7]) {
          const p = lerp(a, b, t);
          box(face, 'oldStone', p, 3.7, 1.0, cardiffGround(...p) - 1.3, y(p) - 0.45);
        }
    }
  }
}
function visitor(face, d) {
  for (const p of component(35185182135605)) {
    const r = simplify(p.outline, d === 0 ? 0.6 : 0.05);
    solid(face, r, (q) => cardiffGround(...q) - 0.3, 7.1, 'visitor');
    cap(face, r, 7.15, 'roof');
    if (d) for (const h of windowRows(r, 1, 2.8, 7.1, 'visitor', 6)) window(face, h, 1);
  }
}
function skylineEnclosure(out) {
  const face = writer(out, 0),
    points = [
      [-108, -77],
      [65, -118],
      [115, 74],
      [-54, 112],
    ];
  for (let i = 0; i < 4; i++) {
    const a = points[i],
      b = points[(i + 1) % 4],
      u = unit(b.map((v, k) => v - a[k])),
      n = [-u[1], u[0]],
      r = [
        a.map((v, k) => v - n[k] * 1.7),
        b.map((v, k) => v - n[k] * 1.7),
        b.map((v, k) => v + n[k] * 1.7),
        a.map((v, k) => v + n[k] * 1.7),
      ];
    masonry(
      out,
      0,
      r,
      (q) => cardiffGround(...q) - 0.4,
      (q) => cardiffGround(...q) + 5.0,
      gates,
      'stone',
    );
  }
  band(face, [-41, -20], [3, 70], 3.0, 5, 'stone', 5.2);
  for (const [p, w, dep, t] of [
    [[-22, -96], 12, 8, 11],
    [[28, 98], 15, 6, 14.5],
    [[0, 60], 8, 11, 10],
  ])
    masonry(out, 0, rect(...p, w, dep), (q) => cardiffGround(...q) - 0.4, t, gates, 'oldStone');
}
function skylinePalace(face) {
  const r = [
    [-83, 34],
    [-71, 30],
    [-58, 74],
    [-71, 78],
  ];
  solid(face, r, floor, 16.8, 'stone');
  roof(face, r, 16.8, [-76.4, 35], [-64.4, 72], 23.5);
  for (const [id, top, roofTop] of [
    [52776575618496, 25, 31],
    [52776575618494, 21.5, 27.5],
    [35185181463444, 18.5, 24],
    [35185182135588, 25.5, 31.5],
  ]) {
    const b = bounds(component(id)[0].outline),
      p = [(b.x + b.xx) / 2, (b.z + b.zz) / 2],
      rr = rect(...p, b.xx - b.x, b.zz - b.z);
    solid(face, rr, floor, top, 'stone');
    cone(face, p, Math.hypot(b.xx - b.x, b.zz - b.z) / 2, top, roofTop, 4);
  }
  solid(face, regular([-80.5, 56.5], 4.2, 6), floor, 22.5, 'stone');
  cone(face, [-80.5, 56.5], 4.5, 22.5, 30.8, 6, 'green');
}
function build(out, d) {
  // Author the mapped compound in cardinal coordinates, then rotate the exported frame.
  const target = out,
    c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  out = {
    addTriangle(slot, ref, p, n, uv, color) {
      p = p.map(([x, y, z]) => [Math.fround(x * c - z * s), y, Math.fround(x * s + z * c)]);
      if (
        Math.hypot(
          ...cross(
            p[1].map((v, k) => v - p[0][k]),
            p[2].map((v, k) => v - p[0][k]),
          ),
        ) < 1e-7
      )
        return;
      target.addTriangle(slot, ref, p, [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c], uv, color);
    },
  };
  const face = writer(out, d);
  keep(out, d);
  if (d === 0) skylineEnclosure(out);
  else enclosure(out, d);
  if (d === 0) skylinePalace(face);
  else palace(out, d);
  clockTower(out, d);
  bridges(face, d);
  if (d) visitor(face, d);
}
export const buildCardiffSkyline = (out) => build(out, 0);
export const buildCardiffDistrict = (out) => build(out, 1);
export const buildCardiffStreet = (out) => build(out, 2);
export const buildCardiffCloseup = (out) => build(out, 3);
export const cardiffStudy = {
  id: 'N0325',
  key: 'cardiff_castle',
  title: 'Cardiff Castle',
  category: 'castle',
  wikidataId: 'Q1035742',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual enclosed Cardiff exterior: open faceted Norman keep with gate/turret, grassy motte and mapped stairs; western palace and unequal towers/roof pieces, southwest clock tower, outer and inner curtains, gate passages, named north/west bridge approaches and simplified visitor range.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID enclosing site and24 selected current PMTiles component polygons, keep courtyard and gate/bridge/stair paths.',
    architecturalHeights:
      'Untagged architectural heights and roof profiles are picture-led estimates. Small motte omitted by coarse DEM is explicitly authored at10.8m; palacefloor2.8m clears retained western ground. NativeY0 follows standardDEM12.8751m.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Current mapped castle/keep/courtyard/component outlines and approach paths supply approximate exterior scale. Two inspected pictures guide the individual silhouette.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing 256-square graphs supply weathered limestone, slate, painted metal and lime plaster with metric UVs and linear tints. Glass, grass and clock accents use vertex colors. No unique photographed facade or embedded images.',
  importReason:
    'Retain individual shell keep/motte, western palace/towers, clock and enclosed compound in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Mapped castle/site/keep courtyard and24selected component polygons control the exterior. Component roles, wall/window arrangement, roof/gable/turret profiles and untagged heights are approximate picture-led interpretations.',
    'NativeY0 follows standardDEM12.8751m; the small motte is not represented in that DEM and uses an approximate10.8m plateau. Palace2.8m floor, moat/terrace levels, stairs, foundations and bridge/terrain joins are approximate, not surveyed or certified walking collision.',
    'Skyline keeps open keep/motte, simplified palace/tower/roof silhouette, clock and enclosure, omitting the modern visitor range and ornament. District adds sparse surface windows, crenellations, clocks and bridge rails. Street restores a single recessed facade row, slits, stair treads, chimneys and selected clock accents; closeup restores both facade rows and denser crenellations/trim. Full interiors, underground shelters, exact sculpture, heraldry, clock lettering and weathering are excluded.',
    'City, trees, visitors, exact animal wall sculptures and full gardens remain host content. Physical laptop and phone performance measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    { name: 'keep-motte-and-stairs', position: [14, 46, 32], lookAt: [-48, 16, -33], fov: 43 },
    { name: 'keep-courtyard', position: [-29, 40, -50], lookAt: [-48, 15, -36], fov: 43 },
    { name: 'palace-court-facade', position: [-6, 34, 90], lookAt: [-71, 15, 52], fov: 43 },
    { name: 'southwest-clock-tower', position: [-21, 47, 152], lookAt: [-56, 24, 111], fov: 43 },
    { name: 'south-entrance', position: [58, 21, 142], lookAt: [27, 8, 98], fov: 43 },
    { name: 'north-gate-and-bridge', position: [-13, 23, -155], lookAt: [-23, 6, -102], fov: 43 },
  ].map((q) => {
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading),
      rotate = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
    return { ...q, position: rotate(q.position), lookAt: rotate(q.lookAt) };
  }),
};
