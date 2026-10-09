/** Original Saint Michael's Castle exterior from attributed current map controls. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/ud/udt/n0300_saint_michael_s_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
const ca = Math.cos(k.planAngleRadians),
  sa = Math.sin(k.planAngleRadians);
const local = (p) => [ca * p[0] - sa * p[1], sa * p[0] + ca * p[1]];
const native = (p) => [ca * p[0] + sa * p[2], p[1], -sa * p[0] + ca * p[2]];
export const saintMichaelPalette = {
  wall: '#e9b283',
  court: '#e7b9a8',
  stone: '#e9e3d8',
  granite: '#a7aaa9',
  roof: '#679d7b',
  copper: '#89b69a',
  gold: '#dac278',
  glass: '#4d6178',
  frame: '#bdad83',
  paving: '#b9b2a6',
  frieze: '#ccab9b',
  pediment: '#d7cbb7',
};
export const saintMichaelSurfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.87, metallic: 0 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
  painted: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.1 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
};
const colors = Object.fromEntries(
  Object.entries(saintMichaelPalette).map(([key, h]) => [
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
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
const rect = (x, z, w, dep) => [
  [x - w / 2, z - dep / 2],
  [x + w / 2, z - dep / 2],
  [x + w / 2, z + dep / 2],
  [x - w / 2, z + dep / 2],
];
const circle = (c, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });
function face(o, p, color = 'wall', slot = 'plaster', target) {
  p = p.map((p) => p.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    const a = t[1].map((v, j) => v - t[0][j]),
      b = t[2].map((v, j) => v - t[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-8
    )
      continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) {
      t = [t[0], t[2], t[1]];
      n = normalFor(...t);
    }
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
function cap(o, outline, y, color = 'stone', slot = 'stone', holes = []) {
  const rings = [clean(outline), ...holes.map(clean)],
    points = rings.flat(),
    starts = [];
  let n = rings[0].length;
  for (const h of rings.slice(1)) {
    starts.push(n);
    n += h.length;
  }
  const ix = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
function prism(o, p, y0, y1, color = 'wall', slot = 'plaster', top = false) {
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
function band(o, a, b, y, width = 0.28, height = 0.22, color = 'stone', slot = 'stone') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.01) return;
  const n = [((b[1] - a[1]) * width) / (2 * len), (-(b[0] - a[0]) * width) / (2 * len)];
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
function profile(o, c, rings, n, color = 'copper', slot = 'copper') {
  for (let j = 1; j < rings.length; j++) {
    const [y0, r0] = rings[j - 1],
      [y1, r1] = rings[j],
      a = circle(c, r0, n),
      b = circle(c, r1, n);
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      face(
        o,
        [
          [a[i][0], y0, a[i][1]],
          [a[next][0], y0, a[next][1]],
          [b[next][0], y1, b[next][1]],
          [b[i][0], y1, b[i][1]],
        ],
        color,
        slot,
        [(a[i][0] + a[next][0]) / 2 - c[0], 0, (a[i][1] + a[next][1]) / 2 - c[1]],
      );
    }
  }
}
function simplify(ring, tolerance) {
  const p = clean(ring).map((p) => [...p]);
  let changed = true;
  while (changed && p.length > 8) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len > 0 && Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / len < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function gateHoles(d) {
  if (!d) return [];
  return k.gate.route.slice(1).map((b, i) => {
    const a = local(k.gate.route[i]),
      bb = local(b),
      len = Math.hypot(bb[0] - a[0], bb[1] - a[1]);
    return prepareOpening(
      {
        center: a.map((v, j) => (v + bb[j]) / 2),
        axis: [-(bb[1] - a[1]) / len, (bb[0] - a[0]) / len],
        width: k.gate.width,
        height: k.gate.height,
        depth: len + 0.9,
        bottom: 0,
        shape: 'rectangle',
      },
      k.gate.baseY,
      d,
    );
  });
}
function boundary(o, p, y0, y1, holes, inner = false, color = 'wall', slot = 'plaster') {
  const sign = Math.sign(area(p)) * (inner ? -1 : 1);
  const emit = (s, r, p, n, uv, c, target = n) => {
    let q = p.map((p) => p.map(Math.fround));
    const nn = normalFor(...q);
    if (nn.reduce((s, v, j) => s + v * target[j], 0) < 0) q = [q[0], q[2], q[1]];
    const a = q[1].map((v, j) => v - q[0][j]),
      b = q[2].map((v, j) => v - q[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-8
    )
      return;
    o.addTriangle(s, r, q, normalFor(...q), uv, c);
  };
  const clipped = {
    addTriangle: (s, r, p, n, uv, c) =>
      openingBuilder(
        { addTriangle: (s, r, q, nn, u, col) => emit(s, r, q, nn, u, col, n) },
        holes,
      ).addTriangle(s, r, p, n, uv, c),
  };
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      clipped,
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
  if (holes.length)
    openingReveals(
      {
        addTriangle: (_s, r, p, n, u, c) => {
          const plane = holes
            .flatMap((h) => h.planes.slice(2))
            .find((v) =>
              p.every((q) => Math.abs(q[0] * v[0] + q[1] * v[1] + q[2] * v[2] + v[3]) < 0.003),
            );
          emit(slot, r, p, n, u, c, plane?.slice(0, 3) ?? n);
        },
      },
      p,
      () => y0,
      () => y1,
      holes,
      colors[color],
    );
}
function distance(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    q = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - dx * q, p[1] - a[1] - dz * q);
}
function clip(p, axis, value, positive) {
  const result = [];
  let a = p.at(-1),
    av = (a[axis] - value) * (positive ? 1 : -1);
  for (const b of p) {
    const bv = (b[axis] - value) * (positive ? 1 : -1);
    if (av >= 0 !== bv >= 0) {
      const t = av / (av - bv);
      result.push(a.map((v, i) => v + (b[i] - v) * t));
    }
    if (bv >= 0) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
/** A constrained roof tessellation keeps all three courtyards empty; no fan crosses a hole. */
function roof(o, rings, d) {
  const points = rings.flat(),
    starts = [];
  let n = rings[0].length;
  for (const h of rings.slice(1)) {
    starts.push(n);
    n += h.length;
  }
  const ix = earcut(points.flat(), starts, 2),
    step = [30, 20, 6, 4][d],
    edges = rings.flatMap((p) => p.map((a, i) => [a, p[(i + 1) % p.length]]));
  const height = (p) =>
    k.eaveY + Math.min(k.roofRise, Math.min(...edges.map(([a, b]) => distance(p, a, b))) * 0.55);
  for (let i = 0; i < ix.length; i += 3) {
    let pieces = [ix.slice(i, i + 3).map((j) => points[j])];
    for (const axis of [0, 1])
      for (let v = -60; v < 70; v += step) {
        const next = [];
        for (const p of pieces) {
          if (
            Math.min(...p.map((p) => p[axis])) < v - 1e-7 &&
            Math.max(...p.map((p) => p[axis])) > v + 1e-7
          ) {
            for (const sign of [true, false]) {
              const q = clip(p, axis, v, sign);
              if (q.length >= 3) next.push(q);
            }
          } else next.push(p);
        }
        pieces = next;
      }
    for (const p of pieces)
      face(
        o,
        p.map((q) => [q[0], height(q), q[1]]),
        'roof',
        'painted',
        [0, 1, 0],
      );
  }
}
function pane(o, c, u, width, height, d, n, arched = false) {
  const at = (x, y) => [c[0] + u[0] * x, y, c[2] + u[1] * x];
  const p =
    arched && d >= 2
      ? [
          [-width / 2, c[1]],
          [width / 2, c[1]],
          ...Array.from({ length: 9 }, (_, i) => {
            const a = (i * Math.PI) / 8;
            return [
              (Math.cos(a) * width) / 2,
              c[1] + height - width / 2 + (Math.sin(a) * width) / 2,
            ];
          }),
        ]
      : [
          [-width / 2, c[1]],
          [width / 2, c[1]],
          [width / 2, c[1] + height],
          [-width / 2, c[1] + height],
        ];
  face(
    o,
    p.map(([x, y]) => at(x, y)),
    'glass',
    'glass',
    n,
  );
  if (d < 2) return;
  const edge = (x0, x1, y0, y1, color = 'stone') =>
    face(o, [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)], color, 'stone', n);
  const t = 0.16;
  edge(-width / 2 - t, -width / 2, c[1] - 0.18, c[1] + height);
  edge(width / 2, width / 2 + t, c[1] - 0.18, c[1] + height);
  edge(-width / 2, width / 2, c[1] - 0.18, c[1]);
  if (!arched) {
    edge(-width / 2 - t, width / 2 + t, c[1] + height, c[1] + height + 0.2);
    if (height > 3)
      edge(-width / 2 - 0.35, width / 2 + 0.35, c[1] + height + 0.3, c[1] + height + 0.5);
  }
  if (d >= 3) {
    edge(-0.06, 0.06, c[1], c[1] + height - (arched ? width / 2 : 0), 'frame');
    edge(-width / 2, width / 2, c[1] + height * 0.52 - 0.06, c[1] + height * 0.52 + 0.06, 'frame');
  }
}
function facades(o, p, d, inner = false, holes = []) {
  if (!d) return;
  const sign = Math.sign(area(p)) * (inner ? -1 : 1);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 4.4) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [sign * u[1], 0, -sign * u[0]],
      count = Math.max(1, Math.round(len / (d === 1 ? 12 : 5.25)));
    for (let j = 0; j < count; j++)
      for (const [floor, y, h] of d === 1
        ? [
            [0, 4, 4.6],
            [1, 11, 5],
            [2, 18.5, 2.4],
          ]
        : [
            [0, 3.7, 4.8],
            [1, 10.7, 5.2],
            [2, 18.4, 2.4],
          ]) {
        const x = ((j + 0.5) * len) / count,
          c = [a[0] + u[0] * x + n[0] * 0.045, y, a[1] + u[1] * x + n[2] * 0.045];
        if (!inner && Math.abs(c[2] - 58) < 0.2 && Math.abs(c[0] - 7.5) < 5) continue;
        if (!inner && c[2] < -51 && c[2] > -52 && c[0] > -6 && c[0] < 22 && floor === 0) continue;
        if (
          holes.some((hole) => {
            const q = hole.local(c),
              w = 2.2;
            return (
              Math.abs(q[0]) < hole.width / 2 + w &&
              Math.abs(q[2]) < hole.depth / 2 + 0.2 &&
              y < hole.height + hole.baseY
            );
          })
        )
          continue;
        pane(o, c, u, d === 1 ? 1.5 : 2.0, h, d, n, inner && floor === 1 && c[2] < -15);
      }
    if (d >= 2) {
      for (const y of [k.foundationTopY, 9.25, 17.4, 21.6, 22.95])
        band(o, a, b, y, y === 22.95 ? 0.75 : 0.3, y === 22.95 ? 0.35 : 0.2);
      if (inner && d === 3)
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / count,
            c = [
              a[0] + (b[0] - a[0]) * t + n[0] * 0.08,
              19.3,
              a[1] + (b[1] - a[1]) * t + n[2] * 0.08,
            ];
          if (c[2] < -15) continue;
          face(
            o,
            [
              [c[0] - u[0] * 1.1, 18.7, c[2] - u[1] * 1.1],
              [c[0] + u[0] * 1.1, 18.7, c[2] + u[1] * 1.1],
              [c[0] + u[0] * 1.1, 20.5, c[2] + u[1] * 1.1],
              [c[0] - u[0] * 1.1, 20.5, c[2] - u[1] * 1.1],
            ],
            'stone',
            'stone',
            n,
          );
        }
    }
  }
}
function main(o, d) {
  const tol = [0.75, 0.22, 0.01, 0.001][d],
    rings = [frame.geometry.outline, ...frame.geometry.holes].map((p) =>
      simplify(p.map(local), tol),
    ),
    holes = gateHoles(d);
  boundary(
    o,
    rings[0],
    0,
    d ? k.foundationTopY : k.eaveY,
    holes,
    false,
    d ? 'granite' : 'wall',
    d ? 'granite' : 'plaster',
  );
  if (d) boundary(o, rings[0], k.foundationTopY, k.eaveY, holes);
  for (const p of rings.slice(1)) {
    boundary(
      o,
      p,
      0,
      d ? k.foundationTopY : k.eaveY,
      holes,
      true,
      d ? 'granite' : 'court',
      d ? 'granite' : 'plaster',
    );
    if (d) boundary(o, p, k.foundationTopY, k.eaveY, holes, true, 'court');
  }
  roof(o, rings, d);
  facades(o, rings[0], d, false, holes);
  facades(o, rings[1], d, true, holes);
  if (d) cap(o, rings[1], k.courtFloorY, 'paving', 'paving');
}
function domes(o, d) {
  const n = [6, 10, 16, 20][d],
    c = k.church,
    r = k.river;
  for (const t of [c, r]) {
    const y = t.domeBaseY,
      h = t.domeRise,
      R = t.domeRadius;
    prism(o, circle(t.center, R, n), k.eaveY, y, 'wall', 'plaster');
    profile(
      o,
      t.center,
      [
        [y, R],
        [y + h * 0.3, R * 0.96],
        [y + h * 0.7, R * 0.76],
        [y + h, R * 0.33],
      ],
      n,
    );
    prism(o, circle(t.center, R * 0.33, n), y + h, t.drumTopY, 'court', 'plaster', true);
    if (d) {
      for (let i = 0; i < (d === 1 ? 4 : 8); i++) {
        const a = (i * Math.PI * 2) / (d === 1 ? 4 : 8),
          u = [-Math.sin(a), Math.cos(a)],
          n = [Math.cos(a), 0, Math.sin(a)];
        pane(
          o,
          [
            t.center[0] + n[0] * (R * 0.33 + 0.04),
            y + h + 0.6,
            t.center[1] + n[2] * (R * 0.33 + 0.04),
          ],
          u,
          d === 1 ? 0.7 : 1.15,
          t.drumTopY - y - h - 1,
          d,
          n,
          true,
        );
      }
    }
  }
  profile(
    o,
    c.center,
    [
      [c.drumTopY, 2.9],
      [c.drumTopY + 0.5, 2.9],
      [c.drumTopY + 1.2, 2.1],
      [c.spireTopY, 0.08],
    ],
    n,
    'gold',
    'painted',
  );
  prism(o, rect(...c.center, 0.2, 0.2), c.spireTopY, c.crossTopY, 'gold', 'painted', true);
  if (d >= 2)
    prism(
      o,
      rect(...c.center, 1.2, 0.2),
      c.crossTopY - 0.85,
      c.crossTopY - 0.65,
      'gold',
      'painted',
      true,
    );
  profile(
    o,
    r.center,
    [
      [r.drumTopY, 2.5],
      [r.drumTopY + 1.1, 0.35],
    ],
    n,
  );
  if (d)
    prism(
      o,
      rect(...r.center, 0.16, 0.16),
      r.drumTopY + 1.1,
      r.poleTopY,
      'granite',
      'painted',
      true,
    );
}
function column(o, x, z, y0, y1, d, r = 0.6) {
  prism(o, circle([x, z], r, [4, 6, 8, 10][d]), y0, y1, 'stone', 'stone');
  if (d >= 2) {
    prism(o, rect(x, z, r * 2.5, r * 2.5), y0, y0 + 0.28, 'stone', 'stone', true);
    prism(o, rect(x, z, r * 2.65, r * 2.65), y1 - 0.25, y1 + 0.1, 'stone', 'stone', true);
  }
}
function railing(o, a, b, y, d) {
  if (d < 2) return;
  band(o, a, b, y, 0.28, 0.18);
  band(o, a, b, y + 1.1, 0.3, 0.15);
  if (d === 2) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    count = Math.ceil(len / 0.75);
  for (let i = 0; i <= count; i++) {
    const c = a.map((v, j) => v + ((b[j] - v) * i) / count);
    prism(o, rect(...c, 0.19, 0.19), y + 0.18, y + 1.1, 'stone', 'stone');
  }
}
function entrances(o, d) {
  const s = k.south,
    n = k.north;
  prism(o, rect(s.centerX, 51.7, 29.5, 11), 25.1, s.atticTopY, 'stone', 'stone', true);
  const back = s.frontZ - 0.15,
    front = s.frontZ + 0.6,
    w = s.pedimentHalfWidth;
  face(
    o,
    [
      [s.centerX - w, s.pedimentBaseY, front],
      [s.centerX + w, s.pedimentBaseY, front],
      [s.centerX, s.pedimentTopY, front],
    ],
    'pediment',
    'stone',
    [0, 0, 1],
  );
  for (const side of [-1, 1])
    face(
      o,
      [
        [s.centerX + side * w, s.pedimentBaseY, front],
        [s.centerX, s.pedimentTopY, front],
        [s.centerX, s.pedimentTopY, back],
        [s.centerX + side * w, s.pedimentBaseY, back],
      ],
      'stone',
      'stone',
      [0, 1, 0],
    );
  prism(o, rect(n.centerX, -42.1, 28.8, 18), 25.6, n.atticTopY, 'court', 'plaster', true);
  cap(o, rect(n.centerX, -42.1, 27.6, 16.8), n.atticTopY + 0.02, 'roof', 'painted');
  const molding = (a, b, width) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = (-(b[1] - a[1]) * width) / (2 * len),
      ny = ((b[0] - a[0]) * width) / (2 * len);
    const p = [
      [a[0] + nx, a[1] + ny],
      [b[0] + nx, b[1] + ny],
      [b[0] - nx, b[1] - ny],
      [a[0] - nx, a[1] - ny],
    ];
    face(
      o,
      p.map((p) => [p[0], p[1], front + 0.28]),
      'stone',
      'stone',
      [0, 0, 1],
    );
    for (let j = 0; j < 4; j++) {
      const aa = p[j],
        bb = p[(j + 1) % 4];
      face(
        o,
        [
          [aa[0], aa[1], front],
          [bb[0], bb[1], front],
          [bb[0], bb[1], front + 0.28],
          [aa[0], aa[1], front + 0.28],
        ],
        'stone',
        'stone',
        [bb[1] - aa[1], aa[0] - bb[0], 0],
      );
    }
  };
  if (d) {
    molding([s.centerX - w, s.pedimentBaseY], [s.centerX, s.pedimentTopY], 0.62);
    molding([s.centerX, s.pedimentTopY], [s.centerX + w, s.pedimentBaseY], 0.62);
    molding([s.centerX - w, s.pedimentBaseY], [s.centerX + w, s.pedimentBaseY], 0.72);
  }
  for (const x of s.obeliskXs) {
    prism(o, rect(x, s.obeliskZ, 3.2, 3.2), 0, 2.6, 'granite', 'granite', true);
    prism(o, rect(x, s.obeliskZ, 2.2, 2.2), 2.6, s.obeliskTopY - 3.2, 'stone', 'stone');
    const p = rect(x, s.obeliskZ, 2.2, 2.2);
    for (let j = 0; j < 4; j++) {
      const a = p[j],
        b = p[(j + 1) % 4];
      face(
        o,
        [
          [a[0], s.obeliskTopY - 3.2, a[1]],
          [b[0], s.obeliskTopY - 3.2, b[1]],
          [x, s.obeliskTopY, s.obeliskZ],
        ],
        'stone',
        'stone',
        [a[0] + b[0] - x * 2, 0, a[1] + b[1] - s.obeliskZ * 2],
      );
    }
  }
  if (!d) {
    prism(
      o,
      rect(n.centerX, n.frontZ - 3.7 - n.stairDepth / 2, n.stairWidth, n.stairDepth),
      0,
      k.foundationTopY,
      'granite',
      'granite',
      true,
    );
    return;
  }
  for (const x of d === 1 ? [-9, -3, 18, 24] : [-33, -27, -21, -15, -9, -3, 18, 24, 30, 36, 42, 48])
    column(o, x, s.frontZ + 0.35, 9.7, 21.5, d, d === 1 ? 0.7 : 0.58);
  for (const x of n.columnXs) column(o, x, n.columnZ, n.columnBaseY, n.columnTopY, d);
  prism(
    o,
    rect(n.centerX, n.columnZ + 0.4, 29.5, 3.8),
    n.columnTopY,
    n.balconyTopY,
    'stone',
    'stone',
    true,
  );
  const steps = d === 1 ? 5 : d === 2 ? 9 : 13;
  for (let i = 0; i < steps; i++) {
    const depth = (n.stairDepth * (steps - i)) / steps,
      z = n.frontZ - 3.7 - depth / 2;
    prism(
      o,
      rect(n.centerX, z, n.stairWidth, depth),
      k.groundAttachmentY,
      (k.foundationTopY * (i + 1)) / steps,
      'granite',
      'granite',
      true,
    );
  }
  if (d >= 2) {
    railing(o, [-7.2, n.columnZ - 1.5], [22.2, n.columnZ - 1.5], n.balconyTopY, d);
    railing(o, [-11, s.frontZ + 1.0], [26, s.frontZ + 1.0], 9.5, d);
    for (const [x, z, w] of [
      [s.centerX, 51.7, 29.5],
      [n.centerX, -42.1, 28.8],
    ]) {
      for (const y of [31.2, 32.9])
        if (y < (z < 0 ? n.atticTopY : s.atticTopY))
          band(
            o,
            [x - w / 2, z + (z < 0 ? -9 : 5.5)],
            [x + w / 2, z + (z < 0 ? -9 : 5.5)],
            y,
            0.48,
            0.28,
          );
    }
    const frontHoles = gateHoles(d),
      p = rect(s.centerX, 56.9, 29.5, 2.6);
    boundary(o, p, 0, 23.1, frontHoles, false, 'stone', 'stone');
    pane(o, [s.centerX, 10.4, 58.28], [1, 0], 4.8, 8.2, d, [0, 0, 1], true);
    for (const x of [-5.4, 1, 14, 20.4]) column(o, x, 58.7, 10, 21.5, d, 0.62);
    for (let i = 0; i < 6; i++) {
      const x = n.centerX - 12 + i * 4.8;
      face(
        o,
        [
          [x - 1.8, 27.5, -51.2],
          [x + 1.8, 27.5, -51.2],
          [x + 1.8, 30.5, -51.2],
          [x - 1.8, 30.5, -51.2],
        ],
        'stone',
        'stone',
        [0, 0, -1],
      );
    }
    for (const x of n.columnXs) pane(o, [x, 3, -51.41], [1, 0], 1.85, 4.7, d, [0, 0, -1]);
    // The court-facing side is a separate upper pavilion, not a blank roof box.
    for (const x of [-2.5, 7.5, 17.5])
      pane(o, [x, 27.3, -33.02], [1, 0], 3.2, 3.1, d, [0, 0, 1], true);
    for (const x of [-6.9, -2.1, 2.7, 7.5, 12.3, 17.1, 21.9]) {
      prism(o, rect(x, -51.28, 0.52, 0.44), 27.2, 31.15, 'stone', 'stone', true);
    }
    for (const [z, top, w] of [
      [-51.1, n.atticTopY, 28.8],
      [57.2, s.atticTopY, 29.5],
    ]) {
      for (const y of [top - 0.28, top - 1.1])
        band(o, [7.5 - w / 2, z], [7.5 + w / 2, z], y, 0.62, 0.28);
    }
    // Large apse windows are distributed over the mapped curved church projection.
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI / 2 + ((i + 0.5) * Math.PI) / 5,
        cx = -58.98 + 5.27 * Math.cos(angle),
        cz = 1.6 + 6.47 * Math.sin(angle);
      const u = [-5.27 * Math.sin(angle), 6.47 * Math.cos(angle)],
        len = Math.hypot(...u);
      u[0] /= len;
      u[1] /= len;
      const nn = [u[1], 0, -u[0]];
      for (const [y, h] of [
        [3.7, 4.8],
        [10.7, 5.2],
        [18.4, 2.4],
      ])
        pane(o, [cx + nn[0] * 0.12, y, cz + nn[2] * 0.12], u, 1.65, h, d, nn);
    }
  }
}
function ornaments(o, d) {
  if (d < 2) return;
  const outer = clean(frame.geometry.outline.map(local));
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    band(o, a, b, 22.7, 0.65, 0.4);
  }
  const chimneyRows = [
    { a: [-35, -39], b: [46, -39], n: 12 },
    { a: [-35, 46], b: [48, 46], n: 11 },
    { a: [-35, -25], b: [-35, 36], n: 8 },
    { a: [49, -28], b: [49, 36], n: 8 },
  ];
  for (const row of chimneyRows)
    for (let i = 0; i < row.n; i++) {
      const c = row.a.map((v, j) => v + ((row.b[j] - v) * (i + 0.5)) / row.n);
      if (
        Math.hypot(c[0] - k.church.center[0], c[1] - k.church.center[1]) < 11 ||
        Math.hypot(c[0] - k.river.center[0], c[1] - k.river.center[1]) < 9
      )
        continue;
      prism(o, rect(...c, 1.35, 1.3), k.eaveY, k.eaveY + k.roofRise + 2.4, 'wall', 'plaster', true);
      prism(
        o,
        rect(...c, 1.6, 1.55),
        k.eaveY + k.roofRise + 2.35,
        k.eaveY + k.roofRise + 2.6,
        'roof',
        'painted',
        true,
      );
    }
  if (d === 3)
    for (const ring of [outer, clean(frame.geometry.holes[0].map(local))]) {
      const sign = Math.sign(area(ring)) * (ring === outer ? 1 : -1);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 7) continue;
        const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
          n = [sign * u[1], 0, -sign * u[0]],
          count = Math.round(len / 5.25);
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / count,
            c = [
              a[0] + (b[0] - a[0]) * t + n[0] * 0.1,
              21.85,
              a[1] + (b[1] - a[1]) * t + n[2] * 0.1,
            ];
          face(
            o,
            [
              [c[0] - u[0] * 0.65, 21.6, c[2] - u[1] * 0.65],
              [c[0] + u[0] * 0.65, 21.6, c[2] + u[1] * 0.65],
              [c[0] + u[0] * 0.65, 22.35, c[2] + u[1] * 0.65],
              [c[0] - u[0] * 0.65, 22.35, c[2] - u[1] * 0.65],
            ],
            'frieze',
            'stone',
            n,
          );
        }
      }
    }
}
const builders = { main, domes, entrances, ornaments };
function adapter(o) {
  return {
    addTriangle: (s, r, p, n, _uv, c) => {
      const q = p.map(native).map((p) => p.map(Math.fround)),
        nn = native(n);
      // All helper clipping takes place in the orthogonal authoring frame; bytes store East/South.
      let points = q;
      if (normalFor(...q).reduce((sum, v, i) => sum + v * nn[i], 0) < 0)
        points = [q[0], q[2], q[1]];
      o.addTriangle(
        s,
        r,
        points,
        normalFor(...points),
        points.map((p) => [p[0], p[2]]),
        c,
      );
    },
  };
}
export const saintMichaelParts = Object.fromEntries(
  Object.entries(builders).map(([key, build]) => [key, (o, d) => build(adapter(o), d)]),
);
export function buildSaintMichaelRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const build of Object.values(saintMichaelParts)) build(o, d);
}
export const buildSaintMichaelSkyline = (o) => buildSaintMichaelRuntime(o, 'skyline');
const camera = (name, p, look) => ({ name, position: native(p), lookAt: native(look) });
export const saintMichaelStudy = {
  id: 'N0300',
  key: 'saint_michael_s_castle',
  title: "Saint Michael's Castle",
  category: 'castle',
  wikidataId: 'Q2000542',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildSaintMichaelRuntime(o),
  surfaceOverrides: saintMichaelSurfaces,
  brief:
    'Current Saint Michael’s Castle: rounded near-square salmon exterior around an open octagonal court and two triangular service courts, low green roofs, gold church spire and separate river dome/lantern, monumental south pediment/obelisks, north colonnade/balcony/stair and physically open mapped south entrance.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: saintMichaelPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'Rounded salmon near-square castle enclosing an open octagonal courtyard',
      'Green church dome and tall gold spire with smaller river-side dome',
      'Distinct south pediment and north raised entrance pavilion',
    ],
  },
  sourceFacts: {
    exactCastleRelation: 238571,
    courtyardHoleWays: [40542341, 193109634, 193109636],
    mappedBuildingLevels: 3,
    exteriorFacadeCompositions: 4,
    numericPrimaryVerticalHeightVerified: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'surface-means.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own map traces © OpenStreetMap contributors, ODbL-1.0. Museum and photographers’ images are not redistributed.',
  sourceNotice:
    'Six existing shared256-square graphs, linear tints and central metric repeats. Flat glass. No embedded/new image, photo texture, downloaded mesh or printed drawing trace.',
  dataAttribution:
    '© OpenStreetMap contributors; State Russian Museum; Alex Florstein Fedorov, Andrew Shiva (Godot13), and Nadezhda Pivovarova/Wikimedia Commons.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus:
      'Inactive draft: actual local terrain, north stair and south entrance contacts remain unverified.',
  }),
  geographicNote:
    'Native East/South geometry preserves original mapped horizontal controls with heading0. Provisional attachmentY0 and all authored vertical sections require actual-site review.',
  limitations: refs.limitations,
  importReason:
    'Preserve open main/service courtyards, rounded salmon envelope, gold church spire and river dome, separate south pediment/obelisks and north colonnade through four source-authored levels.',
  mediumFiContext: { scale: '1.0', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: native([150, 110, 170]), lookAt: native([5, 23, 2]), fov: 42 },
  qaCameras: [
    camera('south-pediment-and-entry', [8, 30, 140], [7, 16, 55]),
    camera('north-colonnade', [7, 31, -142], [7, 17, -48]),
    camera('church-and-west-facade', [-136, 48, 2], [-40, 29, 2]),
    camera('river-dome', [145, 47, 6], [57, 23, 2]),
    camera('court-plan', [7, 190, 3], [7, 15, 3]),
    camera('open-courtyard', [7, 8, 26], [7, 14, -26]),
  ],
};
