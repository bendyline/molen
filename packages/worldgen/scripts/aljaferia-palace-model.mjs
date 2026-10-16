/** Aljafería: mapped open courts and east towers, Taifa arcades and distinct later wings. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/ez/ezr/n0294_aljaferia/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json');
const control = frame.controls,
  c = Math.cos(control.planAngleRadians),
  s = Math.sin(control.planAngleRadians);
export const aljaferiaPlanPoint = (x, z) => [x * c + z * s, -x * s + z * c];
export const aljaferiaPalette = {
  stone: '#d9c3a0',
  plaster: '#eddbbb',
  brick: '#d1b38c',
  tile: '#a5644b',
  wood: '#94734f',
  paving: '#b6b0a3',
  glass: '#4d6178',
  water: '#448ba0',
  foliage: '#839d60',
};
export const aljaferiaSurfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
  foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries(aljaferiaPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const area = (p) =>
  p.reduce((v, a, i) => {
    const b = p[(i + 1) % p.length];
    return v + a[0] * b[1] - b[0] * a[1];
  }, 0);
const clean = (p) =>
  Math.hypot(...p[0].map((v, k) => v - p.at(-1)[k])) < 0.002 ? p.slice(0, -1) : p;
function face(o, points, color = 'stone', slot = 'limestone', target) {
  let p = points.map(([x, y, z]) => {
    const q = aljaferiaPlanPoint(x, z);
    return [q[0], y, q[1]].map(Math.fround);
  });
  const aim = target
    ? (() => {
        const q = aljaferiaPlanPoint(target[0], target[2]);
        return [q[0], target[1], q[1]];
      })()
    : null;
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (aim && n.reduce((v, x, k) => v + x * aim[k], 0) < 0) p = [...p].reverse();
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
function cap(o, rings, y, color = 'stone', slot = 'limestone') {
  const points = rings.flatMap(clean),
    holes = [];
  let j = clean(rings[0]).length;
  for (const r of rings.slice(1)) {
    holes.push(j);
    j += clean(r).length;
  }
  const ix = earcut(points.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [points[k][0], y, points[k][1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function prism(o, p, y0, y1, color = 'stone', slot = 'limestone') {
  const ring = clean(p),
    sign = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
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
  cap(o, [ring], y1, color, slot);
}
const box = (o, x0, z0, x1, z1, y0, y1, color = 'stone', slot = 'limestone') =>
  prism(o, rect(x0, z0, x1, z1), y0, y1, color, slot);
function opening(h, d) {
  const n = h.shape === 'lobed' ? [6, 4, 24, 44][d] : [4, 4, 12, 20][d],
    r = h.width / 2,
    p = [
      [-r, h.base],
      [r, h.base],
      [r, h.spring],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (Math.PI * i) / n;
    let x = r * Math.cos(a),
      y = h.spring + (h.top - h.spring) * Math.sin(a);
    if (h.shape === 'pointed') y = h.spring + (h.top - h.spring) * (1 - Math.abs(Math.cos(a)));
    if (h.shape === 'horseshoe') {
      x *= 1 + 0.14 * Math.sin(a);
      y = h.spring + (h.top - h.spring) * Math.sin(a);
    }
    if (h.shape === 'lobed' && d >= 2) {
      const ripple = 0.2 * Math.abs(Math.sin(a * 7));
      x += (x < 0 ? -1 : 1) * ripple * Math.abs(Math.cos(a));
      y += ripple * Math.sin(a);
    }
    p.push([x, y]);
  }
  return p;
}
/** Earcut apertures include real front/back faces and returns; blind niches have an inset backing. */
function panel(
  o,
  a,
  b,
  y0,
  y1,
  depth,
  normal,
  holes,
  d,
  color = 'stone',
  slot = 'limestone',
  blind = false,
) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    axis = [dx / len, dz / len],
    nlen = Math.hypot(...normal),
    n = normal.map((v) => v / nlen);
  const at = (u, y, z = 0) => [a[0] + u * axis[0] - n[0] * z, y, a[1] + u * axis[1] - n[1] * z];
  const outer = [
      [0, y0],
      [len, y0],
      [len, y1],
      [0, y1],
    ],
    inner = holes.map((h) => opening(h, d).map((p) => [p[0] + h.u, p[1]])),
    points = [...outer, ...inner.flat()],
    starts = [];
  let i = 4;
  for (const h of inner) {
    starts.push(i);
    i += h.length;
  }
  const ix = earcut(points.flat(), starts, 2);
  for (let k = 0; k < ix.length; k += 3) {
    const t = ix.slice(k, k + 3).map((i) => points[i]);
    face(
      o,
      t.map((p) => at(...p)),
      color,
      slot,
      [n[0], 0, n[1]],
    );
    if (depth)
      face(
        o,
        t.map((p) => at(...p, depth)),
        color,
        slot,
        [-n[0], 0, -n[1]],
      );
  }
  if (depth)
    for (const ring of [outer, ...inner])
      for (let j = 0; j < ring.length; j++) {
        const p = ring[j],
          q = ring[(j + 1) % ring.length],
          isInner = ring !== outer,
          sign = Math.sign(area(ring)) * (isInner ? -1 : 1),
          normalLocal = [sign * (q[1] - p[1]), -sign * (q[0] - p[0])];
        face(o, [at(...p), at(...q), at(...q, depth), at(...p, depth)], color, slot, [
          axis[0] * normalLocal[0],
          normalLocal[1],
          axis[1] * normalLocal[0],
        ]);
      }
  if (blind)
    for (const ring of inner) {
      const ix = earcut(ring.flat(), null, 2);
      for (let k = 0; k < ix.length; k += 3)
        face(
          o,
          ix.slice(k, k + 3).map((i) => at(...ring[i], depth + 0.002)),
          color,
          slot,
          [n[0], 0, n[1]],
        );
    }
}
function gable(o, x0, z0, x1, z1, eave, rise, axis = 'z') {
  if (axis === 'z') {
    const m = (x0 + x1) / 2;
    face(
      o,
      [
        [x0, eave, z0],
        [x1, eave, z0],
        [m, eave + rise, z0],
      ],
      'brick',
      'brick',
      [0, 0, -1],
    );
    face(
      o,
      [
        [x0, eave, z1],
        [x1, eave, z1],
        [m, eave + rise, z1],
      ],
      'brick',
      'brick',
      [0, 0, 1],
    );
    face(
      o,
      [
        [x0 - 0.3, eave, z0 - 0.25],
        [m, eave + rise, z0 - 0.25],
        [m, eave + rise, z1 + 0.25],
        [x0 - 0.3, eave, z1 + 0.25],
      ],
      'tile',
      'tile',
      [-1, 1, 0],
    );
    face(
      o,
      [
        [m, eave + rise, z0 - 0.25],
        [x1 + 0.3, eave, z0 - 0.25],
        [x1 + 0.3, eave, z1 + 0.25],
        [m, eave + rise, z1 + 0.25],
      ],
      'tile',
      'tile',
      [1, 1, 0],
    );
  } else {
    const m = (z0 + z1) / 2;
    face(
      o,
      [
        [x0, eave, z0],
        [x0, eave, z1],
        [x0, eave + rise, m],
      ],
      'brick',
      'brick',
      [-1, 0, 0],
    );
    face(
      o,
      [
        [x1, eave, z0],
        [x1, eave, z1],
        [x1, eave + rise, m],
      ],
      'brick',
      'brick',
      [1, 0, 0],
    );
    face(
      o,
      [
        [x0 - 0.25, eave, z0 - 0.3],
        [x1 + 0.25, eave, z0 - 0.3],
        [x1 + 0.25, eave + rise, m],
        [x0 - 0.25, eave + rise, m],
      ],
      'tile',
      'tile',
      [0, 1, -1],
    );
    face(
      o,
      [
        [x0 - 0.25, eave + rise, m],
        [x1 + 0.25, eave + rise, m],
        [x1 + 0.25, eave, z1 + 0.3],
        [x0 - 0.25, eave, z1 + 0.3],
      ],
      'tile',
      'tile',
      [0, 1, 1],
    );
  }
}
function circle(center, r, n) {
  return Array.from({ length: n }, (_, i) => [
    center[0] + r * Math.cos((2 * Math.PI * i) / n),
    center[1] + r * Math.sin((2 * Math.PI * i) / n),
  ]);
}
function roundTower(o, t, d) {
  const n = [6, 8, 16, 24][d],
    floor = t.height - 2.2,
    top = d === 0 ? t.height : t.height - 1.05,
    r = t.radius,
    ring = circle(t.center, r, n),
    inside = circle(t.center, r - 0.65, n);
  prism(o, ring, 0, floor);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = ring[i],
      b = ring[j],
      aa = inside[i],
      bb = inside[j],
      q = ((i + 0.5) * Math.PI * 2) / n;
    face(
      o,
      [
        [a[0], floor, a[1]],
        [b[0], floor, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      'stone',
      'limestone',
      [Math.cos(q), 0, Math.sin(q)],
    );
    face(
      o,
      [
        [aa[0], floor, aa[1]],
        [bb[0], floor, bb[1]],
        [bb[0], top, bb[1]],
        [aa[0], top, aa[1]],
      ],
      'stone',
      'limestone',
      [-Math.cos(q), 0, -Math.sin(q)],
    );
    face(
      o,
      [
        [a[0], top, a[1]],
        [b[0], top, b[1]],
        [bb[0], top, bb[1]],
        [aa[0], top, aa[1]],
      ],
      'stone',
      'limestone',
      [0, 1, 0],
    );
    if (d >= 1 && i % 2 === 0) {
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        width = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.52,
        u = [
          (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]),
          (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]),
        ],
        nn = [Math.cos(q), Math.sin(q)],
        p = [
          [-0.5, 0],
          [0.5, 0],
          [0.5, -0.65],
          [-0.5, -0.65],
        ].map(([x, z]) => [
          mid[0] + u[0] * width * x + nn[0] * z,
          mid[1] + u[1] * width * x + nn[1] * z,
        ]);
      prism(o, p, top, t.height);
    }
  }
  // Selected recessed arrow slits. Do not duplicate a textured wall mesh or append micro-bevels.
  if (d >= 2)
    for (const y of [5.5, 10])
      if (y < t.height - 3) {
        const q = t.center;
        panel(
          o,
          [q[0] + r + 0.005, q[1] - 0.16],
          [q[0] + r + 0.005, q[1] + 0.16],
          y,
          y + 1.35,
          0.14,
          [1, 0],
          [
            {
              u: 0.16,
              width: 0.12,
              base: y + 0.05,
              spring: y + 1.15,
              top: y + 1.25,
              shape: 'pointed',
            },
          ],
          d,
          'stone',
          'limestone',
          true,
        );
      }
}
function trovador(o, d) {
  const t = control.trovador,
    x0 = t.center[0] - t.width / 2,
    x1 = t.center[0] + t.width / 2,
    z0 = t.center[1] - t.depth / 2,
    z1 = t.center[1] + t.depth / 2;
  box(o, x0, z0, x1, z1, 0, 5.2);
  box(o, x0, z0, x1, z1, 5.2, 23.8, 'brick', 'brick');
  box(o, x0, z0, x1, z0 + 0.65, 23.8, 24.9);
  box(o, x0, z1 - 0.65, x1, z1, 23.8, 24.9);
  box(o, x0, z0 + 0.65, x0 + 0.65, z1 - 0.65, 23.8, 24.9);
  box(o, x1 - 0.65, z0 + 0.65, x1, z1 - 0.65, 23.8, 24.9);
  const steps = d <= 1 ? 2 : 6;
  for (let i = 0; i < steps; i++) {
    const x = x0 + ((t.width - 1.1) * i) / (steps - 1);
    box(o, x, z0, x + 0.95, z0 + 0.65, 24.9, 26);
    box(o, x, z1 - 0.65, x + 0.95, z1, 24.9, 26);
  }
  if (d >= 2)
    for (let i = 1; i < 4; i++) {
      const z = z0 + ((t.depth - 1) * i) / 4;
      box(o, x0, z, x0 + 0.65, z + 0.9, 24.9, 26);
      box(o, x1 - 0.65, z, x1, z + 0.9, 24.9, 26);
    }
  if (d >= 2)
    for (const side of [0, 1, 2, 3]) {
      const ring = rect(x0, z0, x1, z1),
        a = ring[side],
        b = ring[(side + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
      for (const y of [7, 12, 17, 21]) {
        const count = side % 2 === 0 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const u = (len * (i + 1)) / (count + 1),
            center = [a[0] + ((b[0] - a[0]) * u) / len, a[1] + ((b[1] - a[1]) * u) / len],
            half = 0.38,
            ax = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
          face(
            o,
            [
              [center[0] - ax[0] * half + n[0] * 0.015, y, center[1] - ax[1] * half + n[1] * 0.015],
              [center[0] + ax[0] * half + n[0] * 0.015, y, center[1] + ax[1] * half + n[1] * 0.015],
              [
                center[0] + ax[0] * half + n[0] * 0.015,
                y + 1.2,
                center[1] + ax[1] * half + n[1] * 0.015,
              ],
              [
                center[0] - ax[0] * half + n[0] * 0.015,
                y + 1.2,
                center[1] - ax[1] * half + n[1] * 0.015,
              ],
            ],
            'wood',
            'wood',
            [n[0], 0, n[1]],
          );
        }
      }
    }
}
function hull(o, d) {
  const p = control.outline,
    curves = control.roundTowers.map((t) => t.mapVertexRange),
    skip = new Set([47, 48]),
    front = control.eastCurtainSegments;
  const ring = clean(p).filter((_, i) => !skip.has(i) && !curves.some(([a, b]) => i > a && i < b)),
    sign = Math.sign(area(ring)),
    courts = control.courts.map((q, i) => clean(q.points).filter((_, j) => i !== 2 || j !== 4));
  cap(o, [ring, ...courts], 8.7, 'paving', 'aggregate');
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (front.some(([j, k]) => a === p[j] && b === p[k])) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [(sign * (b[1] - a[1])) / len, (-sign * (b[0] - a[0])) / len];
    panel(o, a, b, 0, 8.7, 0, normal, [], d);
  }
  for (const [j, k] of front) {
    const a = p[j],
      b = p[k],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [(sign * (b[1] - a[1])) / len, (-sign * (b[0] - a[0])) / len],
      gate = j === 46;
    if (gate && d >= 1) {
      const g = control.entrance,
        u = ((g.center[0] - a[0]) * (b[0] - a[0]) + (g.center[1] - a[1]) * (b[1] - a[1])) / len;
      panel(
        o,
        a,
        b,
        0,
        8.7,
        2.7,
        normal,
        [{ u, width: g.width, base: 0.02, spring: g.spring, top: g.height, shape: 'horseshoe' }],
        d,
      );
    } else {
      const count = Math.max(1, Math.round(len / 5.5)),
        holes = d
          ? Array.from({ length: count }, (_, i) => ({
              u: (len * (i + 0.5)) / count,
              width: (len / count) * 0.7,
              base: 0.4,
              spring: 5.7,
              top: 7.9,
              shape: 'pointed',
            }))
          : [];
      panel(o, a, b, 0, 8.7, d ? 0.34 : 0, normal, holes, d, 'stone', 'limestone', true);
    }
    const count = Math.max(1, Math.round(len / 2.7)),
      holes = d
        ? Array.from({ length: count }, (_, i) => ({
            u: (len * (i + 0.5)) / count,
            width: (len / count) * 0.65,
            base: 9.05,
            spring: 10.7,
            top: 11.7,
            shape: 'round',
          }))
        : [];
    panel(o, a, b, 8.7, 12.3, 1.2, normal, holes, d, 'brick', 'brick');
  }
  // Court retaining walls are separate from Taifa colonnades. Their roof holes remain in all levels.
  for (let courtIndex = 0; courtIndex < courts.length; courtIndex++) {
    const q = courts[courtIndex];
    cap(o, [q], 0.02, 'paving', 'aggregate');
    if (courtIndex === 1 && d >= 1) continue;
    for (let j = 0; j < q.length; j++) {
      const a = q[j],
        b = q[(j + 1) % q.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        sg = -Math.sign(area(q)),
        n = [(sg * (b[1] - a[1])) / len, (-sg * (b[0] - a[0])) / len];
      if (courtIndex === 2 && (j === 2 || j === 4)) continue;
      if (courtIndex === 2 && j === 3) {
        const g = control.entrance,
          u = ((g.center[0] - a[0]) * (b[0] - a[0]) + (g.center[1] - a[1]) * (b[1] - a[1])) / len;
        panel(
          o,
          a,
          b,
          0,
          8.7,
          0,
          n,
          [{ u, width: g.width, base: 0.02, spring: g.spring, top: g.height, shape: 'horseshoe' }],
          d,
        );
      } else panel(o, a, b, 0, 8.7, 0, n, [], d, 'brick', 'brick');
    }
  }
}
function windows(o, a, b, n, d, y, width = 1.15, height = 1.55, spacing = 3.3) {
  if (d < 1) return;
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    count = Math.max(1, Math.floor(len / spacing)),
    ax = [dx / len, dz / len];
  for (let i = 0; i < count; i++) {
    const u = (len * (i + 0.5)) / count,
      q = [a[0] + ax[0] * u + n[0] * 0.025, a[1] + ax[1] * u + n[1] * 0.025],
      p = [
        [-width / 2, 0],
        [width / 2, 0],
        [width / 2, height],
        [-width / 2, height],
      ].map(([x, h]) => [q[0] + ax[0] * x, y + h, q[1] + ax[1] * x]);
    face(o, p, 'glass', 'glass', [n[0], 0, n[1]]);
    if (d >= 2) {
      const aa = [q[0] - ax[0] * width * 0.6, q[1] - ax[1] * width * 0.6],
        bb = [q[0] + ax[0] * width * 0.6, q[1] + ax[1] * width * 0.6];
      panel(o, aa, bb, y - 0.12, y, 0.15, n, [], d, 'stone', 'limestone');
    }
  }
}
function wings(o, d) {
  const wings = [
    [-51.8, -30, -42, 43.2, 'z'],
    [-42, 28, -5.6, 44.4, 'x'],
    [-45, -43, -17.2, -29.6, 'x'],
    [-17.2, -29.6, -5.5, 28, 'z'],
  ];
  for (const [x0, z0, x1, z1, axis] of wings) {
    box(o, x0, z0, x1, z1, 8.7, 10.8, 'brick', 'brick');
    gable(o, x0, z0, x1, z1, 10.8, 3.5, axis);
    const r = rect(x0, z0, x1, z1);
    for (let i = 0; i < 4; i++) {
      const a = r[i],
        b = r[(i + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
      for (const y of d === 1 ? [4.7] : [1.4, 4.7, 8.1]) windows(o, a, b, n, d, y);
    }
  }
  // Historic northern reception range and throne-gallery roof, beyond the open Santa Isabel court.
  box(o, -1.5, -28, 22, -11, 8.7, 11.3, 'brick', 'brick');
  gable(o, -1.5, -28, 22, -11, 11.3, 3.2, 'x');
  box(o, -5.3, 20.4, 20, 29, 8.7, 11.2, 'brick', 'brick');
  gable(o, -5.3, 20.4, 20, 29, 11.2, 2.5, 'x');
  // Chapel/library north of San Martín: deep pointed glazing, brick gable.
  box(o, 23, -41.1, 45, -25.3, 8.7, 10.6, 'brick', 'brick');
  gable(o, 23, -41.1, 45, -25.3, 10.6, 3.2, 'x');
  if (d >= 1) {
    const a = [23, -25.2],
      b = [43.8, -25.2],
      len = b[0] - a[0],
      holes = [0, 1, 2].map((i) => ({
        u: (len * (i + 0.5)) / 3,
        width: 3.2,
        base: 0.65,
        spring: 5.5,
        top: 7.4,
        shape: 'pointed',
      }));
    panel(o, a, b, 0, 8.7, 0.55, [0, 1], holes, d, 'brick', 'brick');
    for (const h of holes) {
      const p = opening(h, d).map(([u, y]) => [a[0] + h.u + u, y, -25.76]);
      face(o, p, 'glass', 'glass', [0, 0, 1]);
    }
  }
  // Modern Cortes hemiciclo, expressly flat and stepped rather than another historic tiled wing.
  box(o, 24, -2.8, 43.3, 17, 0, 8.9, 'brick', 'brick');
  box(o, 25.5, 2.5, 41.8, 16, 8.9, 11.2, 'brick', 'brick');
  box(o, 23.7, -3.15, 43.6, -1.8, 8.4, 8.95, 'stone', 'limestone');
  cap(o, [rect(25.5, 2.5, 41.8, 16)], 11.21, 'paving', 'aggregate');
  if (d >= 1) {
    face(
      o,
      [
        [26.2, 0.45, -2.83],
        [30.8, 0.45, -2.83],
        [30.8, 7.9, -2.83],
        [26.2, 7.9, -2.83],
      ],
      'wood',
      'wood',
      [0, 0, -1],
    );
    face(
      o,
      [
        [34, 3.1, -2.84],
        [40.9, 3.1, -2.84],
        [40.9, 7.6, -2.84],
        [34, 7.6, -2.84],
      ],
      'glass',
      'glass',
      [0, 0, -1],
    );
    box(o, 33.5, -4.6, 41.4, -2.8, 2.5, 2.85, 'stone', 'limestone');
    box(o, 33.5, -4.6, 41.4, -4.32, 2.85, 3.85, 'stone', 'limestone');
    for (let i = 0; i < 5; i++)
      box(
        o,
        25.6,
        -5.9 + i * 0.43,
        31.3,
        -5.9 + (i + 1) * 0.43,
        0,
        0.15 * (i + 1),
        'stone',
        'limestone',
      );
  }
  // Oratory's small octagonal cap; rich internal dome is outside this exterior draft.
  const oct = circle([18, -10.5], 3.1, 8);
  prism(o, oct, 8.7, 9.4, 'plaster', 'plaster');
  const inner = circle([18, -10.5], 0.6, 8);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    face(
      o,
      [
        [oct[i][0], 9.4, oct[i][1]],
        [oct[j][0], 9.4, oct[j][1]],
        [inner[j][0], 10.8, inner[j][1]],
        [inner[i][0], 10.8, inner[i][1]],
      ],
      'tile',
      'tile',
      [0, 1, 0],
    );
  }
  cap(o, [inner], 10.8, 'tile', 'tile');
}
function colonnade(o, a, b, normal, count, d, lobed = true) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = normal,
    axis = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    spacing = len / count,
    holes = [];
  for (let i = 0; i < count; i++)
    holes.push({
      u: spacing * (i + 0.5),
      width: spacing - 0.55,
      base: 0.04,
      spring: 3.3,
      top: 5.65,
      shape: lobed ? 'lobed' : 'pointed',
    });
  panel(o, a, b, 0, 6.5, 0.62, n, holes, d, 'plaster', 'plaster');
  const aa = a.map((v, k) => v - n[k] * 2.7),
    bb = b.map((v, k) => v - n[k] * 2.7);
  const doors = lobed
    ? Array.from({ length: count }, (_, i) => ({
        u: spacing * (i + 0.5),
        width: Math.min(3.4, spacing * 0.55),
        base: 0.05,
        spring: 2.9,
        top: 4.45,
        shape: 'horseshoe',
      }))
    : [];
  panel(o, aa, bb, 0, 6.5, 0.28, n, doors, d, 'plaster', 'plaster');
  if (lobed && n[1] < 0) {
    const upperA = [-5.3, 20.4],
      upperB = [20, 20.4];
    panel(o, upperA, upperB, 6.5, 8.7, 0.2, n, [], d, 'brick', 'brick');
    windows(o, upperA, upperB, n, d, 7.1, 1.4, 1.15, 3.6);
  }
  for (const h of doors)
    face(
      o,
      opening(h, d).map(([u, y]) => [
        aa[0] + axis[0] * (h.u + u) - n[0] * 0.85,
        y,
        aa[1] + axis[1] * (h.u + u) - n[1] * 0.85,
      ]),
      'wood',
      'wood',
      [n[0], 0, n[1]],
    );
  face(
    o,
    [
      [a[0], 6.5, a[1]],
      [b[0], 6.5, b[1]],
      [bb[0], 6.5, bb[1]],
      [aa[0], 6.5, aa[1]],
    ],
    'tile',
    'tile',
    [0, 1, 0],
  );
  if (d >= 2)
    for (let i = 0; i <= count; i++) {
      const u = spacing * i + 0.04,
        q = [a[0] + axis[0] * u, a[1] + axis[1] * u];
      for (const offset of d >= 2 ? [-0.19, 0.19] : [0]) {
        const center = [
          q[0] + axis[0] * offset + n[0] * 0.18,
          q[1] + axis[1] * offset + n[1] * 0.18,
        ];
        prism(o, circle(center, 0.17, d === 1 ? 4 : 8), 0.2, 3.28, 'stone', 'limestone');
        box(
          o,
          center[0] - 0.24,
          center[1] - 0.24,
          center[0] + 0.24,
          center[1] + 0.24,
          3.28,
          3.55,
          'plaster',
          'plaster',
        );
      }
    }
  if (d >= 3 && lobed)
    for (let i = 0; i < count; i++) {
      const u = spacing * (i + 0.5);
      for (const j of [-1, 1]) {
        const q = [
          a[0] + axis[0] * (u + j * 0.85) + n[0] * 0.02,
          a[1] + axis[1] * (u + j * 0.85) + n[1] * 0.02,
        ];
        panel(
          o,
          [q[0] - axis[0] * 0.1, q[1] - axis[1] * 0.1],
          [q[0] + axis[0] * 0.1, q[1] + axis[1] * 0.1],
          5.9,
          6.45,
          0.08,
          n,
          [],
          d,
          'stone',
          'plaster',
        );
      }
    }
}
function taifa(o, d) {
  if (d === 0) return;
  colonnade(o, [-1.328, -6.07], [15.448, -6.532], [0, 1], 3, d);
  colonnade(o, [19.747, 19.688], [-5.24, 20.151], [0, -1], 3, d);
  colonnade(o, [-0.906, 15.09], [-1.328, -6.07], [1, 0], 4, d, false);
  colonnade(o, [15.494, -4.705], [15.612, 15.767], [-1, 0], 4, d, false);
  // Timber upper north gallery and small clerestory below its tiled reception roof.
  panel(o, [-1.5, -8.8], [15.5, -8.8], 6.5, 9.0, 0.5, [0, 1], [], d, 'wood', 'wood');
  windows(o, [-1.5, -8.78], [15.5, -8.78], [0, 1], d, 6.9, 1.8, 1.5, 2.8);
  box(o, -1.5, -11.1, 15.5, -8.8, 9, 10.9, 'brick', 'brick');
  windows(o, [-1.5, -8.77], [15.5, -8.77], [0, 1], d, 9.5, 0.7, 0.55, 2.5);
  gable(o, -1.5, -11.1, 15.5, -8.8, 10.9, 1.2, 'x');
  // Long formal beds and crosswalks; selected four orange-tree silhouettes only at closeup.
  box(o, 5.8, -4.8, 8.2, 15.0, 0.03, 0.08, 'paving', 'aggregate');
  for (const [x0, x1] of [
    [0.3, 4.9],
    [9.1, 14.3],
  ]) {
    box(o, x0, -3.8, x1, 13.5, 0.03, 0.2, 'foliage', 'foliage');
    for (const z of [-3.8, 13.1]) box(o, x0, z, x1, z + 0.4, 0.2, 0.55, 'foliage', 'foliage');
    for (const x of [x0, x1 - 0.35])
      box(o, x, -3.8, x + 0.35, 13.5, 0.2, 0.55, 'foliage', 'foliage');
  }
  for (const z of [-5.5, 15.25]) {
    box(o, 5.45, z, 8.55, z + 0.9, 0.03, 0.22, 'stone', 'limestone');
    cap(o, [rect(5.7, z + 0.18, 8.3, z + 0.73)], 0.23, 'water', 'glass');
  }
  if (d === 3)
    for (const x of [2.2, 11.8])
      for (const z of [1.0, 9.0]) {
        prism(o, circle([x, z], 0.14, 6), 0.2, 2.1, 'wood', 'wood');
        const ring = circle([x, z], 1.05, 8);
        prism(o, ring, 1.55, 2.55, 'foliage', 'foliage');
        for (let i = 0; i < 8; i++) {
          const j = (i + 1) % 8;
          face(
            o,
            [
              [ring[i][0], 2.55, ring[i][1]],
              [ring[j][0], 2.55, ring[j][1]],
              [x, 3.25, z],
            ],
            'foliage',
            'foliage',
          );
        }
      }
}
function moat(o, d) {
  const { inner, outer, depth } = control.moat;
  cap(o, [outer, inner], -depth, 'foliage', 'foliage');
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = inner[i],
      b = inner[j],
      aa = outer[i],
      bb = outer[j];
    face(
      o,
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], -depth, b[1]],
        [a[0], -depth, a[1]],
      ],
      'stone',
      'limestone',
    );
    face(
      o,
      [
        [aa[0], 0, aa[1]],
        [bb[0], 0, bb[1]],
        [bb[0], -depth, bb[1]],
        [aa[0], -depth, aa[1]],
      ],
      'foliage',
      'foliage',
    );
  }
  cap(o, [inner, clean(control.outline)], -0.06, 'paving', 'aggregate');
  for (const id of [27064735, 459631719, 459631730]) {
    const f = frame.geometry.rawFeatures.find((f) => f.id === id),
      p = f.planPoints;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = (b[1] - a[1]) / len,
        nz = -(b[0] - a[0]) / len,
        width = id === 459631730 ? 2.7 : 3.8,
        ring = [
          [a[0] + (nx * width) / 2, a[1] + (nz * width) / 2],
          [b[0] + (nx * width) / 2, b[1] + (nz * width) / 2],
          [b[0] - (nx * width) / 2, b[1] - (nz * width) / 2],
          [a[0] - (nx * width) / 2, a[1] - (nz * width) / 2],
        ];
      prism(o, ring, -0.32, 0.02, 'paving', 'aggregate');
      if (d >= 1 && id !== 459631730)
        for (const sign of [-1, 1]) {
          const q = ring.slice(sign === 1 ? 0 : 2, sign === 1 ? 2 : 4);
          panel(o, q[0], q[1], 0.02, 0.9, 0.15, [nx * sign, nz * sign], [], d);
        }
    }
  }
}
export const aljaferiaParts = {
  hull,
  roundTowers: (o, d) => {
    for (const t of control.roundTowers) roundTower(o, t, d);
  },
  trovador,
  wings,
  taifa,
  moat,
};
function build(o, d) {
  for (const p of Object.values(aljaferiaParts)) p(o, d);
}
export const buildAljaferiaRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildAljaferiaSkyline = (o) =>
  build(
    {
      addTriangle: (slot, ref, p, n, uv, color) =>
        o.addTriangle(
          'silhouette',
          ref,
          p,
          n,
          uv,
          color.map((v, i) => v * (means[slot]?.[i] ?? 1)),
        ),
    },
    0,
  );
const camera = (name, position, lookAt) => ({
  name,
  position: (() => {
    const p = aljaferiaPlanPoint(position[0], position[2]);
    return [p[0], position[1], p[1]];
  })(),
  lookAt: (() => {
    const p = aljaferiaPlanPoint(lookAt[0], lookAt[2]);
    return [p[0], lookAt[1], p[1]];
  })(),
});
export const aljaferiaStudy = {
  id: 'N0294',
  key: 'aljaferia',
  title: 'Aljafería',
  category: 'castle',
  wikidataId: 'Q1354033',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildAljaferiaRuntime(o),
  brief:
    'Six round east towers and26m rectangular Trovador, three physically open roof courts, selected lobed Taifa colonnades and formal garden, tiled barracks and throne-gallery wings, distinct flat contemporary hemiciclo, chapel glazing and mapped access bridges over an estimated moat.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: aljaferiaPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 8,
    identityFeatures: [
      'Six round fortified east towers and tall rectangular Trovador',
      'Three open courtyards with different palace/barracks wings',
      'Taifa arcades, tiled historic roofs and distinct flat contemporary parliament volume',
    ],
  },
  sourceFacts: {
    trovadorHeightMeters: 26,
    publishedTrovadorPlanMeters: [16.5, 12],
    mappedTrovadorSpanMeters: control.trovador.width,
    roundEastTowers: 6,
    openCourtyards: 3,
    surveyedVerticalDatum: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Own exact-QID map relation, court holes, circle arc fits and entrance/bridge paths. Published26m Trovador height/12m depth; mapped18.317m width explicitly differs from published16.5m. Other dimensions are photographic estimates.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'surface-means.json', 'reference-metadata.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own mapped traces © OpenStreetMap contributors,ODbL-1.0. Reference photographs/plans/sections are not redistributed.',
  sourceNotice:
    'Six existing shared material graphs, linear palette and metric UVs; no new or embedded textures or imported meshes. Three mapped courtyards remain roof holes at every level. Estimated moat requires real host terrain cutout.',
  dataAttribution:
    '© OpenStreetMap contributors; Gobierno de Aragón; Ayuntamiento de Zaragoza; SIPCA; Museum With No Frontiers; Pemán y Franco; Pedro I.Sobradiel Valenzuela.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus:
      'Inactive draft; real terrain cutout/datum, dimension conflict and current-state fidelity pending',
  }),
  geographicNote:
    'Native East/South coordinates determine orientation including the mapped east entry. Internal plan rotation never becomes placement heading. Estimated moat descends below attachmentY0; current dimensions and real site fit require review before activation.',
  limitations: refs.limitations,
  importReason:
    'Preserve distinct Aljafería courtyard voids, six round towers, tall Trovador, Taifa arches and contrasting historic/contemporary roof masses with four authored levels.',
  mediumFiContext: {
    scale: '3.0',
    neighborStyle: 'molen.worldgen.regional.mediterranean.detached',
  },
  camera: { position: [155, 118, 165], lookAt: [10, 7, 0], fov: 43 },
  qaCameras: [
    camera('six-tower-east-front', [118, 29, 5], [45, 7, -6]),
    camera('trovador-north', [21, 45, -95], [13, 17, -35]),
    camera('open-three-court-plan', [0, 205, 1], [0, 0, 0]),
    camera('taifa-north-portico', [7, 3.4, 11], [7, 3.4, -7]),
    camera('taifa-south-portico', [7, 3.4, -1], [7, 3.4, 20]),
    camera('modern-hemiciclo', [35, 5.5, -20], [34, 4.7, -2]),
    camera('mapped-east-portal', [68, 3.2, -12], [46.8, 3.2, -18.6]),
  ],
};
