/** Restored Narva convent, Tall Hermann and open forecourts under the medium-fi standard. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ud/uds/n0274_hermann_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
export const hermannPalette = {
  stone: '#cdb68c',
  render: '#e9e0cb',
  trim: '#d7c9ad',
  roof: '#b56449',
  slate: '#626971',
  wood: '#795b43',
  glass: '#4d6178',
  paving: '#b5afa1',
  grass: '#859f67',
};
const colors = Object.fromEntries(
  Object.entries(hermannPalette).map(([key, hex]) => [
    key,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const rect = (o, x, y, z, w, h, depth, col = 'stone', slot = 'limestone') =>
  box(o, slot, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], colors[col]);
function local(o, x, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rot = ([u, y, v]) => [c * u + s * v, y, -s * u + c * v];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, ref, p, n, uv, col) =>
        o[k](
          slot,
          ref,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + x, q[1], q[2] + z];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function face(o, points, col = 'stone', slot = 'limestone', target) {
  let p = points;
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const axis = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (axis === 1 ? [v[0], v[2]] : axis === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function slab(o, loops, heights, col = 'paving', slot = 'limestone') {
  const p = loops.flat(),
    holes = [];
  let total = loops[0].length;
  for (let i = 1; i < loops.length; i++) {
    holes.push(total);
    total += loops[i].length;
  }
  const ids = earcut(p.flat(), holes, 2),
    ys = loops.flatMap((l, i) => l.map(() => heights[i]));
  for (let i = 0; i < ids.length; i += 3)
    face(
      o,
      ids.slice(i, i + 3).map((j) => [p[j][0], ys[j], p[j][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function edgeFrame(o, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    length,
    q: local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], a[0] - b[0])),
  };
}
function pane(o, x, y, z, width, height, d, col = 'glass') {
  face(
    o,
    [
      [x - width / 2, y, z],
      [x + width / 2, y, z],
      [x + width / 2, y + height, z],
      [x - width / 2, y + height, z],
    ],
    col,
    'glass',
    [0, 0, 1],
  );
  if (d < 3) return;
  // Full-height strips, not a separate framed box per stone course or glazing cell.
  for (const s of [-1, 1])
    rect(o, x + s * (width / 2 + 0.17), y, z + 0.04, 0.34, height, 0.35, 'trim');
  rect(o, x, y - 0.34, z + 0.04, width + 0.68, 0.34, 0.45, 'trim');
  rect(o, x, y + height, z + 0.04, width + 0.68, 0.34, 0.35, 'trim');
}
function gable(o, w, depth, y, top, col = 'roof', wall = 'stone') {
  for (const s of [-1, 1]) {
    face(
      o,
      [
        [-w / 2, y, (s * depth) / 2],
        [w / 2, y, (s * depth) / 2],
        [0, top, (s * depth) / 2],
      ],
      wall,
      'limestone',
      [0, 0, s],
    );
    face(
      o,
      [
        [(s * w) / 2, y, -depth / 2],
        [(s * w) / 2, y, depth / 2],
        [0, top, depth / 2],
        [0, top, -depth / 2],
      ],
      col,
      'tile',
      [s, 1, 0],
    );
  }
}
function hip(o, radius, base, top, d, col = 'slate') {
  const n = d ? 8 : 6;
  for (let i = 0; i < n; i++)
    face(
      o,
      [
        [radius * Math.cos((i * 2 * Math.PI) / n), base, radius * Math.sin((i * 2 * Math.PI) / n)],
        [0, top, 0],
        [
          radius * Math.cos(((i + 1) * 2 * Math.PI) / n),
          base,
          radius * Math.sin(((i + 1) * 2 * Math.PI) / n),
        ],
      ],
      col,
      'tile',
      [0, 1, 0],
    );
}
function roundTower(o, t, d, roof = false) {
  const q = local(o, ...t.center),
    n = d >= 2 ? 16 : 8;
  const poly = Array.from({ length: n }, (_, i) => [
    Math.cos((i * 2 * Math.PI) / n) * t.radius,
    Math.sin((i * 2 * Math.PI) / n) * t.radius,
  ]);
  for (let i = 0; i < n; i++) {
    const a = poly[i],
      b = poly[(i + 1) % n];
    face(
      q,
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], t.top, b[1]],
        [a[0], t.top, a[1]],
      ],
      'stone',
      'limestone',
      [a[0] + b[0], 0, a[1] + b[1]],
    );
  }
  slab(q, [poly], [t.top], 'trim');
  if (roof) hip(q, t.radius + 0.3, t.top, t.top + 3.2, d, 'roof');
  if (d >= 2)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const f = local(q, Math.sin(a) * (t.radius + 0.02), Math.cos(a) * (t.radius + 0.02), a);
      pane(f, 0, t.top * 0.6, 0, 0.8, 1.6, d);
    }
}
function wallSheet(o, a, b, top, col = 'stone', gate = null, d = 0, inward = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [b[1] - a[1], 0, a[0] - b[0]];
  if (inward) for (let i = 0; i < 3; i++) n[i] = -n[i];
  const at = (u, y) => [a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u];
  const emit = (u, v, lo, hi) =>
    face(o, [at(u, lo), at(v, hi), at(v, top), at(u, top)], col, 'limestone', n);
  if (!gate) {
    emit(0, 1, 0, 0);
    return;
  }
  const left = gate.at - gate.width / len / 2,
    right = gate.at + gate.width / len / 2;
  emit(0, left, 0, 0);
  emit(right, 1, 0, 0);
  const count = d >= 2 ? 8 : 2;
  const profile = Array.from({ length: count + 1 }, (_, i) => {
    const u = -1 + (2 * i) / count;
    return [
      left + ((right - left) * i) / count,
      gate.spring + Math.sqrt(Math.max(0, 1 - u * u)) * (gate.top - gate.spring),
    ];
  });
  for (let i = 1; i < profile.length; i++)
    emit(profile[i - 1][0], profile[i][0], profile[i - 1][1], profile[i][1]);
}
function curtain(o, path, top, d, covered = false) {
  for (let i = 1; i < path.length; i++) {
    const { q, length } = edgeFrame(o, path[i - 1], path[i]);
    rect(q, 0, 0, 0, length, top, 1.6);
    rect(q, 0, top, 0, length, 0.5, 1.8, 'trim');
    if (covered) {
      rect(q, 0, top - 1.4, 0.35, length, 0.75, 1, 'wood', 'wood');
      gable(local(q, 0, 0, Math.PI / 2), 2.9, length + 0.7, top + 1.3, top + 1.95, 'roof');
      if (d)
        for (let u = -length / 2 + 1; u < length / 2; u += d === 1 ? 8 : 3.2)
          rect(q, u, top - 0.65, 0.3, 0.4, 2, 0.45, 'wood', 'wood');
    }
    if (d >= 2)
      for (let u = -length / 2 + 2; u < length / 2; u += 4.6)
        pane(q, u, top - 2.5, 0.82, 0.6, 1.2, 0);
  }
}
function tallHermann(o, d) {
  const t = frame.controls.tower,
    q = local(o, ...t.center, t.heading),
    [w, depth] = t.plan;
  rect(q, 0, 0, 0, w, t.wallTop, depth, 'render');
  rect(q, 0, t.wallTop, 0, w + 1.8, t.galleryTop - t.wallTop, depth + 1.8, 'wood', 'wood');
  gable(q, w + 2.25, depth + 2.25, t.galleryTop, t.roofTop, 'roof', 'render');
  // Broad ridge ends establish the documented51m overall height in every level.
  for (const z of [-depth / 2, depth / 2])
    rect(q, 0, t.roofTop, z, 0.75, t.finialTop - t.roofTop, 0.75, 'trim');
  if (!d) return;
  for (const [len, x, z, a] of [
    [w, 0, depth / 2 + 0.03, 0],
    [w, 0, -depth / 2 - 0.03, Math.PI],
    [depth, w / 2 + 0.03, 0, Math.PI / 2],
    [depth, -w / 2 - 0.03, 0, -Math.PI / 2],
  ]) {
    const f = local(q, x, z, a);
    for (const [i, y] of (d === 1 ? [13, 30, 36] : [5.5, 13, 21, 28.5, 35, 37]).entries())
      pane(f, i % 2 ? 0.8 : -0.6, y, 0, 0.9, 1.6, 0);
    for (let u = -len / 2 + 0.6; u < len / 2; u += d === 1 ? 4.5 : 2.1) {
      rect(f, u, t.wallTop - 0.8, 0.5, 0.5, 0.85, 1.9, 'wood', 'wood');
      if (d >= 2) pane(f, u, t.wallTop + 0.9, 1, 0.65, 1.25, 0);
    }
    if (d === 3)
      for (const u of [-len / 2 + 0.25, len / 2 - 0.25])
        rect(f, u, 0, 0.05, 0.5, t.wallTop, 0.35, 'trim');
  }
  // Current timber oriel on the western face; no claim of authentic medieval reconstruction.
  const west = local(q, -w / 2 - 0.9, -0.5, -Math.PI / 2);
  rect(west, 0, 28.8, 0, 2.6, 3.3, 1.6, 'wood', 'wood');
  gable(west, 3.1, 2.1, 32.1, 33.8, 'roof', 'wood');
  if (d >= 2) {
    pane(west, 0, 29.5, 0.82, 1.1, 1.8, d);
    rect(west, 0, 28.1, 0, 0.65, 0.7, 1.8, 'wood', 'wood');
  }
  if (d >= 2) {
    // Roof chimneys are conspicuous broad forms, not tiny gutter/antenna work.
    for (const z of [-3.8, 3.8]) rect(q, 4.5, 46.2, z, 1, 2.9, 1, 'render');
    for (const z of [-depth / 2 - 0.03, depth / 2 + 0.03])
      pane(local(q, 0, z, z < 0 ? Math.PI : 0), 0, 46.6, 0, 0.75, 1.1, 0);
  }
}
function convent(o, d) {
  const c = frame.controls.convent,
    outer = c.outer,
    court = c.court;
  slab(o, [outer, court], [0.06, 0.06]);
  slab(o, [court], [0.12]);
  for (let i = 0; i < 4; i++) {
    const a = outer[i],
      b = outer[(i + 1) % 4];
    wallSheet(
      o,
      a,
      b,
      c.wallTop,
      'stone',
      i === 0 ? { at: 0.7, width: 3.8, spring: 2.4, top: 4.2 } : null,
      d,
    );
    wallSheet(
      o,
      court[i],
      court[(i + 1) % 4],
      c.innerTop,
      'stone',
      i === 0 ? { at: 0.5, width: 3.4, spring: 2.4, top: 4.1 } : null,
      d,
      true,
    );
  }
  const roofOuter = outer.map((p) => lerp([47.5, 21.2], p, 0.94));
  slab(o, [roofOuter, court], [c.roofTop, c.innerTop], 'roof', 'tile');
  slab(o, [outer, roofOuter], [c.wallTop, c.wallTop], 'trim');
  for (let i = 0; i < 4; i++) {
    const { q, length } = edgeFrame(o, outer[i], outer[(i + 1) % 4]);
    if (i !== 2) {
      rect(q, 0, 24.8, -0.65, length, 0.75, 1.25, 'wood', 'wood');
      face(
        q,
        [
          [-length / 2, 27.4, -0.25],
          [length / 2, 27.4, -0.25],
          [length / 2, 26.6, -2.25],
          [-length / 2, 26.6, -2.25],
        ],
        'roof',
        'tile',
        [0, 1, 0],
      );
      if (d)
        for (let u = -length / 2 + 1.5; u < length / 2; u += d === 1 ? 6.5 : 3)
          rect(q, u, 25.55, -0.6, 0.4, 1.65, 0.45, 'wood', 'wood');
    }
    if (d) {
      const count = d === 1 ? 3 : Math.floor(length / 3.8);
      for (let j = 0; j < count; j++) {
        const u = -length / 2 + ((j + 0.5) * length) / count;
        pane(q, u, 21.8, 0.035, 0.8, 1.4, 0);
      }
      if (d >= 2) {
        // South/riverside walls retain broad bare fields; openings are local, not a window grid.
        const openings = [
          [
            [-0.27, 5.4, 1.15, 1.85],
            [0.08, 6.3, 0.85, 1.4],
            [0.3, 12.8, 1.2, 1.8],
          ],
          [
            [-0.3, 3.7, 0.65, 1.1],
            [0.28, 6.2, 1.1, 1.8],
            [0.28, 12.5, 1.4, 2.2],
          ],
          [
            [-0.32, 2.8, 0.6, 1.4],
            [-0.3, 9.2, 1.2, 1.8],
            [-0.25, 9.2, 1.2, 1.8],
            [0.29, 10.1, 0.65, 1.3],
          ],
          [
            [-0.3, 2.4, 0.6, 1.1],
            [-0.08, 8.1, 1.1, 1.8],
            [0.18, 8.1, 1.1, 1.8],
            [-0.05, 15.1, 1.4, 2.6],
            [0.18, 15.1, 1.4, 2.6],
          ],
        ][i];
        for (const [at, y, w, h] of openings) pane(q, at * length, y, 0.035, w, h, d);
        const inner = edgeFrame(o, court[(i + 1) % 4], court[i]);
        for (const u of [-inner.length * 0.25, inner.length * 0.25])
          pane(inner.q, u, 6.5, 0.025, 1.5, 2.8, d);
      }
    }
  }
  const t = frame.controls.octagon,
    q = local(o, ...t.center),
    poly = Array.from({ length: 8 }, (_, i) => [
      t.radius * Math.cos((i * Math.PI) / 4),
      t.radius * Math.sin((i * Math.PI) / 4),
    ]);
  for (let i = 0; i < 8; i++) {
    const a = poly[i],
      b = poly[(i + 1) % 8];
    face(
      q,
      [
        [a[0], 23.8, a[1]],
        [b[0], 23.8, b[1]],
        [b[0], t.wallTop, b[1]],
        [a[0], t.wallTop, a[1]],
      ],
      'stone',
      'limestone',
      [a[0] + b[0], 0, a[1] + b[1]],
    );
  }
  hip(q, t.radius + 0.35, t.wallTop, t.roofTop, d);
  if (d >= 2)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      pane(
        local(q, Math.sin(a) * (t.radius + 0.03), Math.cos(a) * (t.radius + 0.03), a),
        0,
        25.4,
        0,
        0.85,
        1.8,
        0,
      );
  const dk = frame.controls.dansker,
    dd = local(o, ...dk.center, dk.heading);
  rect(dd, 0, 0, 0, ...[dk.plan[0], dk.wallTop, dk.plan[1]]);
  rect(dd, 0, dk.wallTop - 1.6, 0, dk.plan[0] + 0.7, 1.6, dk.plan[1] + 0.7, 'trim');
  if (d >= 2) {
    const f = local(dd, 0, dk.plan[1] / 2 + 0.04);
    for (const y of [3.4, 10.8, 19.7]) for (const x of [-1.5, 1.5]) pane(f, x, y, 0, 0.8, 1.4, d);
    for (const x of [-2.5, -0.8, 0.8, 2.5])
      rect(dd, x, dk.wallTop - 2.1, dk.plan[1] / 2, 0.5, 0.6, 0.6, 'trim');
  }
  const well = frame.controls.well;
  for (let i = 0; i < well.outline.length; i++)
    wallSheet(o, well.outline[i], well.outline[(i + 1) % 4], well.top);
  slab(o, [well.outline], [well.top], 'roof', 'tile');
  tallHermann(o, d);
}
function stoneHall(o, d) {
  const h = frame.controls.stoneHall,
    q = local(o, ...h.center, h.heading),
    [w, depth] = h.plan;
  const gate = { at: 0.35, width: 4, spring: 2.5, top: 4.5 };
  for (const z of [-depth / 2, depth / 2])
    wallSheet(q, [-w / 2, z], [w / 2, z], h.wallTop, 'stone', gate, d, z < 0);
  for (const x of [-w / 2, w / 2])
    wallSheet(q, [x, -depth / 2], [x, depth / 2], h.wallTop, 'stone', null, d, x > 0);
  gable(local(q, 0, 0, Math.PI / 2), depth + 0.6, w + 0.6, h.wallTop, h.roofTop);
  if (d)
    for (const z of [-depth / 2 - 0.04, depth / 2 + 0.04]) {
      const f = local(q, 0, z, z < 0 ? Math.PI : 0);
      for (const x of [-12, -5, 3, 10]) pane(f, x, 5.5, 0, 1.35, 1.9, d);
    }
}
function grounds(o, d) {
  const c = frame.controls,
    outline = frame.geometry.outline.slice(0, -1);
  slab(o, [outline], [0], 'grass', 'foliage');
  if (!d) return;
  for (const lawn of [c.westernLawn, c.southernLawn]) {
    const center = lawn.reduce((s, p) => s.map((v, i) => v + p[i] / lawn.length), [0, 0]);
    const paved = lawn.map((p) => lerp(center, p, 1.035));
    slab(o, [paved, lawn], [0.035, 0.035]);
  }
  slab(o, [c.northYard], [0.055]);
  // The demolished arsenal is marked by slabs, never rebuilt as a roofed range.
  for (const [a, b] of [
    [
      [-90, 39],
      [-57, 39],
    ],
    [
      [-57, 39],
      [-57, 68],
    ],
    [
      [-57, 68],
      [-90, 68],
    ],
    [
      [-90, 68],
      [-90, 39],
    ],
  ]) {
    const { q, length } = edgeFrame(o, a, b);
    rect(q, 0, 0.025, 0, length, 0.04, 0.9, 'paving');
  }
  if (d >= 2) {
    // Representative modern craft shelters within the documented North Yard.
    for (const [x, z, a, len] of [
      [54, -39, -0.495, 12],
      [76, -25, Math.PI / 2 - 0.495, 10],
    ]) {
      const q = local(o, x, z, a);
      rect(q, 0, 0, -2, len, 4, 0.8);
      face(
        q,
        [
          [-len / 2, 4.9, -2.4],
          [len / 2, 4.9, -2.4],
          [len / 2, 3.8, 2.2],
          [-len / 2, 3.8, 2.2],
        ],
        'slate',
        'wood',
        [0, 1, 0],
      );
      for (const x of [-len / 2 + 0.5, len / 2 - 0.5])
        rect(q, x, 0, 1.8, 0.45, 3.8, 0.45, 'wood', 'wood');
    }
  }
  if (d === 3)
    for (const [x, z, a] of [
      [-48, 19, -0.11],
      [-66, -15, Math.PI / 2],
      [2, -46, -0.45],
      [39, -30, 1.9],
    ]) {
      const q = local(o, x, z, a);
      rect(q, 0, 0.4, 0, 5, 0.4, 0.8, 'paving');
      for (const u of [-1.8, 1.8]) rect(q, u, 0, 0, 0.5, 0.4, 0.7, 'paving');
    }
}
export function buildHermannRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level],
    c = frame.controls;
  grounds(o, d);
  convent(o, d);
  stoneHall(o, d);
  roundTower(o, c.northWestRondel, d);
  roundTower(o, c.southTower, d, true);
  curtain(o, c.westCurtain, 8.8, d);
  curtain(o, c.northCurtain, 9.4, d);
  curtain(o, c.southCurtain, 5.1, d);
  curtain(o, c.westGallery, 8.2, d, true);
  curtain(o, c.zwinger, 5.3, d);
  curtain(o, [c.northYard[0], c.northYard[1], c.northYard[2]], 14.2, d);
}
export const buildHermannSkyline = (o) =>
  buildHermannRuntime(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, c) =>
          o[k](
            s,
            r,
            p,
            n,
            uv,
            c.map((v) => v * (s === 'glass' || s === 'foliage' ? 1 : 0.65)),
          ),
      ]),
    ),
    'skyline',
  );
export const hermannStudy = {
  id: 'N0274',
  key: 'hermann_castle',
  title: 'Hermann Castle',
  category: 'castle',
  wikidataId: 'Q660001',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildHermannRuntime(o),
  brief:
    'Restored Narva castle: off-white Tall Hermann with projecting timber hoarding and red gable, inward red-roofed stone convent around an open court, southwest octagonal turret and broad western/northern yards.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: hermannPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    materialBudget: 5,
    identityFeatures: [
      'Off-white square Tall Hermann with dark projecting timber gallery and steep red gable',
      'Warm stone convent, inward red roof fields, open inner court and small southwest octagonal turret',
      'Large open Western Yard, separate North Yard, restored Stone Hall and perimeter walls',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/5434279 exact Q660001',
    mappedSitePlanMeters: [210.085, 177.077],
    publishedTallHermannHeightMeters: 51,
    publishedHistoricalCastellSideMeters: 40,
  },
  reconstruction: {
    basis: 'OSM site perimeter, operator Western Yard plan and current restored museum photographs',
    scope:
      'Convent exterior and open courts, abbreviated workshops, Stone Hall and curtain walls. Natural cliffs, moat/river and Ivangorod excluded.',
  },
  scaleBasis:
    'Mapped210.085×177.077m site fixes plan registration. Interpreted modern convent about45×43m; published40m refers to historical castell. Tall Hermann reaches published51m, datum unspecified. All lower elevations, gallery/eaves and component dimensions inferred, not surveyed.',
  refs: [
    'https://narvamuuseum.ee/en/muuseum/narva-castle/',
    'https://narvamuuseum.ee/en/muuseum/meie-ajalugu/',
    'https://narvamuuseum.ee/en/muuseum/projects/projektid/castle-development/',
    'https://narvamuuseum.ee/userfiles/files/LH-AS-1_Asendiplaan.pdf',
    'https://narvamuuseum.ee/en/muuseum/north-courtyard/',
    'https://bastion.visitnarva.ee/wp-content/uploads/2024/02/narva-bastions-route-booklet-en.pdf',
    frame.sourceUrl,
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  sourceLicense:
    'Original geometry under repository license. OSM geometry © OpenStreetMap contributors, ODbL-1.0. Museum/architect drawings and photographs linked as research references, not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors, ODbL-1.0. Narva Museum operator plan/photos and city bastion booklet used as research only.',
  nativeAxes: frame.nativeAxes,
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    notes:
      'Western Yard, eastern convent and northwest main tower resolve the signed site axis. Actual terrain/cliff and approach seating pending.',
    reviewStatus: 'Research frame only; terrain and approaches pending',
  }),
  geographicNote:
    'Site plan aligned to exact mapped perimeter. Geographic activation requires cliff-side seating and northern/western entry review; synthetic captures establish appearance only.',
  limitations: [
    'Original medium-fi reconstruction, not a conservation survey.',
    'Published51m tower datum unspecified; all other heights and plan components interpreted.',
    'Current restored hoarding modeled as seen; museum questions its historical authenticity.',
    'Fine joints, narrow loops, full interiors, tiny flags/fixtures and elaborate workshop equipment omitted.',
    'Ceramic roof graph supplies low-frequency seams for both red tiles and grey small turret roof, tinted separately.',
    'Actual terrain contact/approaches, continuous-motion shimmer and physical-device performance pending.',
  ],
  importReason:
    'Preserve white tower/red gable, timber gallery, open roof-ring court and broad forecourts in all levels; near levels add sparse openings, workshops and selected benches.',
  mediumFiContext: { scale: '1.2', neighborStyle: 'molen.worldgen.catalog.english_terrace' },
  camera: { position: [-200, 125, 200], lookAt: [0, 14, 0], fov: 43 },
  qaCameras: [
    { name: 'western-yard-and-white-tower', position: [-125, 53, 35], lookAt: [40, 19, 17] },
    { name: 'river-side-convent', position: [155, 60, 108], lookAt: [49, 18, 22] },
    { name: 'northern-yard-and-entry', position: [90, 64, -138], lookAt: [57, 13, -15] },
    { name: 'tower-gable-and-hoarding', position: [-25, 55, 62], lookAt: [42, 35, 11] },
    { name: 'inward-roofs-and-open-court', position: [85, 60, 54], lookAt: [50, 17, 27] },
    { name: 'three-courtyard-plan', position: [0, 330, 1], lookAt: [0, 0, 0] },
  ],
};
