/** Mir Castle: mapped five-tower enclosure, open court, palace, wall walks and approach bridge. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u9/u9d/n0250_mir_castle_complex/map-parts.json',
      import.meta.url,
    ),
  ),
);
const brick = [0.62, 0.28, 0.17],
  plaster = [0.89, 0.84, 0.72],
  trim = [0.8, 0.73, 0.59],
  stone = [0.53, 0.41, 0.29],
  wood = [0.22, 0.13, 0.08],
  tile = [0.61, 0.27, 0.13],
  glass = [0.095, 0.115, 0.105];
const master = (o) => !o.detail,
  near = (o) => !['skyline', 'district'].includes(o.detail),
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  color = (a, t) => a.map((v) => v * t);
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) =>
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
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
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
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function points(id) {
  return map.features.find((f) => f.id === `way/${id}`).points.map((p) => [...p]);
}
function ring(id) {
  const p = points(id);
  if (p[0].join() === p.at(-1).join()) p.pop();
  return clean(p);
}
function cap(o, p, y, slot = 'stone', c = stone) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[2][0] - q[0][0]) * (q[1][2] - q[0][2]),
      ) < 0.0001
    )
      continue;
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, c);
  }
}
const rectangle = (x, z, w, d) => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
];
function line(o, a, b, w = 0.12, slot = 'carved', c = trim) {
  if (Math.hypot(...b.map((v, i) => v - a[i])) < 0.001) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (master(o) || len < 0.001) {
    beam(o, slot, a, b, w, w, c);
    return;
  }
  const dx = ((b[1] - a[1]) * w) / (2 * len),
    dy = ((a[0] - b[0]) * w) / (2 * len),
    p = [
      [a[0] - dx, a[1] - dy, a[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [a[0] + dx, a[1] + dy, a[2]],
    ];
  if (normalFor(...p)[2] < 0) p.reverse();
  face(o, slot, p, c);
}
function opening(x, y, w, h, pointed = false, steps = 12) {
  const p = [
    [x - w / 2, y],
    [x + w / 2, y],
  ];
  if (!pointed) return [...p, [x + w / 2, y + h], [x - w / 2, y + h]];
  const spring = y + h - w / 2;
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * i) / steps;
    p.push([x + (Math.cos(angle) * w) / 2, spring + (Math.sin(angle) * w) / 2]);
  }
  return p;
}
function panel(o, w, lo, hi, windows = [], slot = 'plaster', c = plaster) {
  const valid = ['skyline', 'district'].includes(o.detail) ? [] : windows;
  const all = [
    [
      [0, lo],
      [w, lo],
      [w, hi],
      [0, hi],
    ],
    ...valid.map((v) => opening(v[0], v[1], v[2], v[3], v[4], o.detail === 'district' ? 6 : 12)),
  ];
  const p = all.flat(),
    holes = [];
  let n = 4;
  for (const r of all.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]),
      ) < 0.00001
    )
      continue;
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
  // At district distance retain each facade's contrast with flat window/niche cards.
  // Actual openings and recessed reveals are restored in the street and close-up tiers.
  if (o.detail === 'district') {
    for (const v of windows) {
      const p = opening(v[0], v[1], v[2], v[3], v[4], 4);
      const ix = earcut(p.flat());
      for (let k = 0; k < ix.length; k += 3) {
        const q = ix.slice(k, k + 3).map((j) => [p[j][0], p[j][1], 0.025]);
        if (normalFor(...q)[2] < 0) q.reverse();
        tri(o, v[6] ? 'plaster' : 'glass', q, v[6] ? plaster : glass);
      }
    }
  }
  for (let i = 0; i < valid.length; i++) {
    const v = valid[i],
      r = all[i + 1];
    const ix = earcut(r.flat());
    for (let k = 0; k < ix.length; k += 3) {
      const p = ix.slice(k, k + 3).map((j) => [r[j][0], r[j][1], -0.34]);
      if (normalFor(...p)[2] < 0) p.reverse();
      if (!v[5]) tri(o, v[6] ? 'plaster' : 'glass', p, v[6] ? plaster : glass);
    }
    if (fine(o)) {
      for (let j = 0; j < r.length; j++) {
        const a = r[j],
          b = r[(j + 1) % r.length];
        face(
          o,
          v[6] ? 'brick' : 'carved',
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -0.34],
            [a[0], a[1], -0.34],
          ],
          trim,
        );
        if (!v[6]) line(o, [a[0], a[1], 0.07], [b[0], b[1], 0.07], 0.16);
      }
      if (v[2] > 1.1 && !v[5] && !v[6]) {
        line(o, [v[0], v[1], -0.12], [v[0], v[1] + v[3] - 0.2, -0.12], 0.09, 'wood', wood);
        line(
          o,
          [v[0] - v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          [v[0] + v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          0.08,
          'wood',
          wood,
        );
      }
    }
    if (master(o) && !v[5] && !v[6])
      for (let y = v[1] + 0.28; y < v[1] + v[3] - (v[4] ? v[2] * 0.9 : 0.15); y += 0.42)
        line(
          o,
          [v[0] - v[2] * 0.42, y, -0.19],
          [v[0] + v[2] * 0.42, y, -0.19],
          0.025,
          'metal',
          [0.24, 0.23, 0.2],
        );
  }
}
function roofFacet(o, a, b, c, d) {
  const q = [a, b, c, d],
    collapsed = Math.hypot(...c.map((v, i) => v - d[i])) < 0.001;
  if (normalFor(...q)[1] < 0) q.reverse();
  if (collapsed) tri(o, 'tile', normalFor(a, b, c)[1] < 0 ? [c, b, a] : [a, b, c], tile);
  else face(o, 'tile', q, tile);
  if (!fine(o)) return;
  const rows = Math.ceil(Math.hypot(...d.map((v, i) => v - a[i])) / (master(o) ? 0.32 : 0.95));
  const n = normalFor(...q);
  for (let r = 0; r < rows; r++) {
    const t0 = (r + 0.03) / rows,
      t1 = (r + 0.97) / rows;
    const l0 = mix(a, d, t0),
      r0 = mix(b, c, t0),
      l1 = mix(a, d, t1),
      r1 = mix(b, c, t1);
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(...r0.map((v, i) => v - l0[i])) / (master(o) ? 0.28 : 0.95)),
    );
    for (let j = 0; j < count; j++) {
      const u0 = (j + 0.035) / count,
        u1 = (j + 0.965) / count;
      const p = [mix(l0, r0, u0), mix(l0, r0, u1), mix(l1, r1, u1), mix(l1, r1, u0)].map((p) =>
        p.map((v, i) => v + n[i] * 0.028),
      );
      if (normalFor(...p)[1] < 0) p.reverse();
      face(o, 'tile', p, color(tile, 0.81 + ((r * 7 + j * 11) % 13) * 0.027));
      if (master(o)) {
        const a = p[0],
          b = p[1],
          m = mix(a, b, 0.5),
          v = n.map((x) => x * 0.025);
        // Rounded lower tile lip catches grazing light without a separate texture image.
        tri(
          o,
          'tile',
          [a, b, m.map((x, i) => x + v[i] + (i === 1 ? -0.035 : 0))],
          color(tile, 1.06),
        );
      }
    }
  }
}
function polyRoof(o, p, eave, peak) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    roofFacet(o, [a[0], eave, a[1]], [b[0], eave, b[1]], peak, peak);
  }
}

function clean(input, tolerance = 0.1) {
  const p = input.map((v) => [...v]);
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop();
  for (let changed = true; changed && p.length > 3; ) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length];
      const d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return area(p) > 0 ? p.reverse() : p;
}
function edges(o, p, fn) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.04) fn(edgeFrame(o, a, b), len, i, a, b);
  }
}
function slab(o, p, lo, hi, slot = 'brick', c = brick) {
  loft(o, slot, [p.map(([x, z]) => [x, lo, z]), p.map(([x, z]) => [x, hi, z])], c, { cap: false });
  cap(o, p, hi, slot, c);
}
function band(o, p, y, h = 0.2, slot = 'plaster', c = plaster) {
  edges(o, p, (f, len) => box(f, slot, [0, y, -0.03], [len, y + h, 0.14], c));
}
function plaque(o, x, y, w, h, round = true, c = plaster) {
  const p = opening(x, y, w, h, round, near(o) ? 10 : 4),
    ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      'plaster',
      ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0.035]),
      c,
    );
  if (fine(o))
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      line(o, [a[0], a[1], 0.09], [b[0], b[1], 0.09], 0.07, 'brick', brick);
    }
}
function medallion(o, x, y, radius) {
  const n = master(o) ? 24 : near(o) ? 12 : 8;
  const p = Array.from({ length: n }, (_, i) => [
    x + Math.cos((i * Math.PI * 2) / n) * radius,
    y + Math.sin((i * Math.PI * 2) / n) * radius,
    0.04,
  ]);
  o.addConvexPolygon('plaster', 'palette:#ffffff', p, [0, 0, 1], (p) => [p[0], p[1]], plaster);
}
function masonry(o, len, lo, hi, openings = [], seed = 0) {
  if (!fine(o)) return;
  // Fieldstone patches in the brick plinth, with the windows and gate kept unobstructed.
  for (let row = 0; row < (hi - lo) / 0.47; row++)
    for (let j = 0; j < len / 0.67; j++) {
      if ((!master(o) && (row * 5 + j + seed) % 10 !== 0) || (row * 7 + j * 3 + seed) % 4 === 0)
        continue;
      const x = (j + 0.45 + (row % 2) * 0.4) * 0.67,
        y = lo + (row + 0.5) * 0.47;
      if (
        x > len - 0.4 ||
        openings.some(
          (v) => Math.abs(x - v[0]) < v[2] / 2 + 0.45 && y > v[1] - 0.3 && y < v[1] + v[3] + 0.3,
        )
      )
        continue;
      const w = 0.23 + (j % 3) * 0.065,
        h = 0.13 + (row % 2) * 0.04;
      const p = [
        [x - w, y - h, 0.012],
        [x + w * 0.8, y - h, 0.012],
        [x + w, y + h * 0.6, 0.025],
        [x, y + h, 0.06],
        [x - w, y + h * 0.4, 0.018],
      ];
      const c = color(stone, 0.65 + ((j * 3 + row + seed) % 9) * 0.05);
      for (let i = 1; i < p.length - 1; i++) tri(o, 'stone', [p[0], p[i], p[i + 1]], c);
    }
}
/** Arch spandrel and barrel soffit. Width runs along local X, depth extends into -Z. */
function archBarrel(o, w, spring, rise, top, depth, slot = 'brick', c = brick) {
  const n = master(o) ? 32 : fine(o) ? 20 : near(o) ? 12 : 6;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n;
    const x0 = (Math.cos(a) * w) / 2,
      x1 = (Math.cos(b) * w) / 2;
    const y0 = spring + Math.sin(a) * rise,
      y1 = spring + Math.sin(b) * rise;
    for (const z of [0, -depth]) {
      const p = [
        [x0, y0, z],
        [x1, y1, z],
        [x1, top, z],
        [x0, top, z],
      ];
      if (normalFor(...p)[2] > 0 !== (z === 0)) p.reverse();
      // The crown can meet the top exactly, leaving triangular end facets.
      for (const q of [
        [p[0], p[1], p[2]],
        [p[0], p[2], p[3]],
      ]) {
        const a = q[1].map((v, j) => v - q[0][j]),
          b = q[2].map((v, j) => v - q[0][j]);
        if (
          Math.hypot(
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
          ) > 1e-5
        )
          tri(o, slot, q, c);
      }
    }
    face(
      o,
      slot,
      [
        [x0, y0, 0],
        [x1, y1, 0],
        [x1, y1, -depth],
        [x0, y0, -depth],
      ],
      color(c, 0.85),
    );
  }
}
function dormer(o, x, y, z, angle = 0, eyebrow = false) {
  if (!near(o)) return;
  const f = frame(o, x, y, z, angle),
    w = eyebrow ? 1.25 : 0.95;
  panel(frame(f, -w, 0, 0), w * 2, 0, 1.05, [[w, 0.15, w * 1.4, 0.65, false]], 'wood', wood);
  if (eyebrow) {
    const n = fine(o) ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      const p = [
        [-w * Math.cos(a), 0.25 + Math.sin(a) * 1.18, 0.12],
        [-w * Math.cos(b), 0.25 + Math.sin(b) * 1.18, 0.12],
        [-w * Math.cos(b), 0.25 + Math.sin(b) * 1.18, -2],
        [-w * Math.cos(a), 0.25 + Math.sin(a) * 1.18, -2],
      ];
      if (normalFor(...p)[1] < 0) p.reverse();
      face(f, 'tile', p, tile);
    }
  } else {
    roofFacet(
      f,
      [-w - 0.1, 1.08, 0.2],
      [w + 0.1, 1.08, 0.2],
      [w + 0.1, 1.9, -2.1],
      [-w - 0.1, 1.9, -2.1],
    );
    for (const s of [-1, 1]) {
      const p = [
        [s * w, 0, 0],
        [s * w, 1.1, 0],
        [s * w, 1.9, -2.1],
      ];
      if (normalFor(...p)[0] * s < 0) p.reverse();
      tri(f, 'wood', p, wood);
    }
  }
}
function finial(o, x, y, z) {
  box(o, 'metal', [x - 0.035, y, z - 0.035], [x + 0.035, y + 0.75, z + 0.035], [0.18, 0.16, 0.13]);
  if (near(o))
    for (const yy of [y + 0.15, y + 0.44])
      loft(
        frame(o, x, 0, z),
        'metal',
        [
          radialRing(yy, 0.04, 0.04, 8),
          radialRing(yy + 0.07, 0.12, 0.12, 8),
          radialRing(yy + 0.14, 0.04, 0.04, 8),
        ],
        [0.18, 0.16, 0.13],
      );
}
const towerParts = [
  { kind: 'gate', upper: 229530949, base: null, top: 31 },
  { kind: 'southwest', upper: 229530952, base: 1116052228, top: 30 },
  { kind: 'northwest', upper: 229530951, base: 1116052229, top: 30 },
  { kind: 'northeast', upper: 229530955, base: 1116052231, top: 30 },
  { kind: 'southeast', upper: 229530950, base: 1116052232, top: 30 },
];
function tower(o, t) {
  const upper = ring(t.upper),
    light = ['northwest', 'southeast'].includes(t.kind);
  const xs = upper.map((p) => p[0]),
    zs = upper.map((p) => p[1]),
    cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  if (t.base) {
    const lower = ring(t.base);
    edges(o, lower, (f, len) => {
      const holes = [];
      if (len > 4 && o.detail !== 'skyline') {
        if (!light)
          for (let i = 0; i < Math.floor(len / 2.2); i++)
            holes.push([
              ((i + 0.5) * len) / Math.floor(len / 2.2),
              6.5,
              1.1,
              2.8,
              true,
              false,
              true,
            ]);
        else for (let i = 0; i < 2; i++) holes.push([((i + 1) * len) / 3, 8.2, 0.5, 1.1, false]);
      }
      panel(f, len, 0, 10, holes, 'brick', brick);
      masonry(f, len, 0.2, 4.7, holes, 13);
    });
    cap(o, lower, 10, 'brick', brick);
  }
  edges(o, upper, (f, len) => {
    const holes = [],
      style = t.kind;
    if (len > 2 && o.detail !== 'skyline') {
      if (light) {
        if (len > 4) {
          holes.push([len / 2, 11.4, 1.45, 2.8, false], [len / 2, 17.1, 1.25, 2.2, true]);
          if (style === 'southeast') holes.push([len * 0.22, 14.3, 0.36, 1.3, false]);
        }
      } else if (style === 'northeast') {
        if (len > 4) holes.push([len / 2, 11.9, 1.7, 2.5, false], [len / 2, 17.1, 1.7, 2.5, false]);
        else
          holes.push(
            [len / 2, 11.3, 0.55, 3.1, true, false, true],
            [len / 2, 17.3, 0.55, 3.3, true, false, true],
          );
      } else {
        const count = len > 4 ? 3 : 1;
        for (let j = 0; j < count; j++)
          holes.push([
            ((j + 0.5) * len) / count,
            11.2,
            len > 4 ? 0.72 : 0.58,
            3.7,
            true,
            false,
            true,
          ]);
        holes.push([len / 2, 16.1, Math.min(1.5, len * 0.45), 2.5, true, false, true]);
        for (let j = 0; j < count; j++)
          holes.push([
            ((j + 0.5) * len) / count,
            19.1,
            len > 4 ? 0.55 : 0.43,
            2.05,
            true,
            false,
            true,
          ]);
      }
    }
    panel(f, len, 10, 22, holes, light ? 'plaster' : 'brick', light ? plaster : brick);
    if (!near(o)) return;
    if (light) {
      if (len > 4)
        for (const x of [0.4, len - 0.4])
          box(f, 'plaster', [x - 0.16, 10, -0.01], [x + 0.16, 21.65, 0.11], color(plaster, 0.93));
      if (style === 'southeast') {
        // Broad scalloped white arcature at the eaves is distinctive to the pale southeast tower.
        for (let j = 0; j < Math.max(1, Math.round(len / 2.2)); j++) {
          const count = Math.max(1, Math.round(len / 2.2)),
            x = ((j + 0.5) * len) / count,
            w = (len / count) * 0.85;
          const p = opening(x, 20.3, w, 1.25, true, 10);
          for (let k = 2; k < p.length - 1; k++)
            line(
              f,
              [p[k][0], p[k][1], 0.12],
              [p[k + 1][0], p[k + 1][1], 0.12],
              0.12,
              'plaster',
              color(plaster, 1.02),
            );
        }
      }
    } else if (style === 'northeast') {
      for (let j = 0; j < Math.max(1, Math.floor(len / 1.6)); j++)
        medallion(f, ((j + 0.5) * len) / Math.max(1, Math.floor(len / 1.6)), 16.05, 0.32);
      for (const y of [10.2, 15.35, 21.15])
        box(f, 'plaster', [0, y, -0.02], [len, y + 0.19, 0.12], plaster);
    } else {
      // Small real lights inside selected taller blind niches.
      if (len > 4)
        for (const y of [12.1, 16.6])
          face(
            f,
            'glass',
            [
              [len / 2 - 0.24, y, -0.2],
              [len / 2 + 0.24, y, -0.2],
              [len / 2 + 0.24, y + 0.95, -0.2],
              [len / 2 - 0.24, y + 0.95, -0.2],
            ],
            glass,
          );
      for (const y of [10.3, 15.3, 18.7, 21.55])
        box(f, 'plaster', [0, y, -0.02], [len, y + 0.14, 0.13], plaster);
    }
    if (fine(o) && !light)
      for (let y = 10.45; y < 21.5; y += 0.21) {
        if (holes.some((h) => y > h[1] - 0.15 && y < h[1] + h[3] + 0.15)) continue;
        line(f, [0.03, y, 0.025], [len - 0.03, y, 0.025], 0.026, 'brick', color(brick, 0.7));
      }
  });
  cap(o, upper, 22, light ? 'plaster' : 'brick', light ? plaster : brick);
  if (o.detail !== 'skyline') {
    band(o, upper, 21.65, 0.2, light ? 'plaster' : 'brick', light ? plaster : brick);
    band(o, upper, 22, 0.17);
  }
  const roof = upper.map(([x, z]) => [cx + (x - cx) * 1.045, cz + (z - cz) * 1.045]);
  polyRoof(o, roof, 22.17, [cx, t.top, cz]);
  finial(o, cx, t.top, cz);
  if (fine(o))
    edges(o, upper, (f, len, i) => {
      if (len > 4 && i % 2 === 0) dormer(f, len / 2, 24, -0.9, 0, false);
    });
}

function gate(o) {
  for (const id of [1116041016, 1116041017]) slab(o, ring(id), 0, 10);
  slab(o, ring(1116044011), 5, 10);
  const f = frame(o, -38.99, 0, 1.35, -Math.PI / 2);
  archBarrel(f, 3.7, 3, 2, 5.2, 12.35);
  if (o.detail === 'skyline') return;
  for (const z of [0, -12.3]) {
    const ff = frame(f, 0, 0, z, z ? Math.PI : 0);
    for (const x of [-4.2, 4.2]) {
      plaque(ff, x, 0.3, 1.2, 3.9, true);
      plaque(ff, x, 6.35, 1.15, 2.85, true);
    }
    for (const x of [-3, -1.5, 0, 1.5, 3]) plaque(ff, x, 5.25, 0.65, 0.65, true);
    for (const [a, b] of [
      [-5.4, -1.9],
      [1.9, 5.4],
    ])
      box(ff, 'plaster', [a, 4.3, 0.03], [b, 4.46, 0.12], plaster);
    for (const y of [6, 9.6]) box(ff, 'plaster', [-5.4, y, 0.03], [5.4, y + 0.16, 0.12], plaster);
    if (fine(o)) {
      const p = opening(0, 0.03, 3.75, 4.95, true, 20);
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length];
        line(ff, [a[0], a[1], 0.06], [b[0], b[1], 0.06], 0.17, 'carved', trim);
      }
    }
  }
  cap(o, rectangle(-39.2, -0.5, 13, 3.7), 0.025, 'stone', color(stone, 1.2));
}
function palace(o) {
  const p = ring(229530954);
  edges(o, p, (f, len, _i, a, b) => {
    const low = [],
      upper = [];
    const count = Math.max(1, Math.floor(len / 5.2));
    const north = a[1] < -30 && b[1] < -30 && len > 20;
    // The south curtain wall covers the end of the east palace up to its roof.
    // Hidden window frames and drainpipes must not protrude through that wall.
    const south = a[1] > 34 && b[1] > 34;
    const entryX = north ? ((a[0] - 20.895) / (a[0] - b[0])) * len : null;
    if (len > 5 && o.detail !== 'skyline')
      for (let j = 0; j < count; j++) {
        const x = ((j + 0.5) * len) / count;
        if (!south) low.push([x, 0.55, 0.9, 2.7, true]);
        for (const y of south ? [12.2] : [6.2, 10.85]) {
          if (north && y < 9 && Math.abs(x - entryX) < 2.6) continue;
          upper.push([x, y, 1.45, south ? 1.8 : y < 9 ? 2.6 : 2.8, false]);
        }
      }
    if (north && o.detail !== 'skyline') upper.push([entryX, 5.25, 2.2, 2.9, true, true]);
    panel(f, len, 0, 5, low, 'brick', color(brick, 0.92));
    panel(f, len, 5, 15, upper, 'plaster', plaster);
    if (!south) masonry(f, len, 0.18, 4.7, low, 17);
    if (near(o)) {
      if (!south) box(f, 'plaster', [0, 5, -0.025], [len, 5.22, 0.1], color(plaster, 0.9));
      for (const y of [14.1, 14.72])
        box(f, 'plaster', [0, y, -0.03], [len, y + 0.18, 0.2], plaster);
      if (fine(o))
        for (let j = 0; j <= count; j++) {
          const x = (j * len) / count;
          beam(
            f,
            'metal',
            [x, south ? 12.1 : 0.4, 0.16],
            [x, 14.7, 0.16],
            0.065,
            0.065,
            [0.18, 0.17, 0.14],
          );
        }
    }
  });
  cap(o, p, 15, 'plaster', plaster);
  const a = [-29.1, 15, -31.2],
    b = [32.2, 15, -31.2],
    c = [32.2, 15, 34.7],
    d = [14.3, 15, 34.7],
    e = [14.3, 15, -12.1],
    f = [-29.1, 15, -12.1];
  const u = [-29.1, 22, -21.65],
    v = [23.3, 22, -21.65],
    w = [23.3, 22, 25.8];
  for (const q of [
    [a, b, v, u],
    [b, c, w, v],
    [c, d, w, w],
    [d, e, v, w],
    [e, f, u, v],
  ])
    roofFacet(o, ...q);
  const gable = [f, a, u];
  if (normalFor(...gable)[0] > 0) gable.reverse();
  tri(o, 'plaster', gable, plaster);
  if (near(o)) {
    const gg = frame(o, -29.13, 0, -31.2, -Math.PI / 2);
    for (const x of [6.7, 12.2]) {
      plaque(gg, x, 15.5, 1.6, 3.5, false, color(plaster, 0.93));
      face(
        gg,
        'glass',
        [
          [x - 0.5, 16, 0.08],
          [x + 0.5, 16, 0.08],
          [x + 0.5, 18.45, 0.08],
          [x - 0.5, 18.45, 0.08],
        ],
        glass,
      );
    }
    for (const [x, z] of [
      [-22, -21.65],
      [-12, -21.65],
      [-2, -21.65],
      [8, -21.65],
      [18, -21.65],
      [23.3, -9],
      [23.3, 2],
      [23.3, 13],
      [23.3, 23],
    ]) {
      box(o, 'brick', [x - 0.45, 20.3, z - 0.36], [x + 0.45, 23.6, z + 0.36], brick);
      box(o, 'brick', [x - 0.56, 23.5, z - 0.45], [x + 0.56, 23.77, z + 0.45], color(brick, 0.83));
      box(
        o,
        'recess',
        [x - 0.29, 23.771, z - 0.24],
        [x + 0.29, 23.79, z + 0.24],
        [0.12, 0.1, 0.08],
      );
    }
    for (const x of [-21, -10, 1, 12]) {
      dormer(o, x, 16.25, -29.4, Math.PI, true);
      dormer(o, x, 16.25, -13.9, 0, true);
    }
    for (const z of [-6, 5, 16, 26]) {
      dormer(o, 30.6, 16.25, z, Math.PI / 2, true);
      if (z < 24) dormer(o, 15.9, 16.25, z, -Math.PI / 2, true);
    }
  }
  // Projecting eastern stair bay, separately mapped, with its flat red cap.
  const bay = ring(549194787);
  slab(o, bay, 0, 8.8, 'plaster', color(plaster, 0.9));
  cap(o, bay, 9, 'tile', tile);
  if (near(o))
    edges(o, bay, (f, len) => {
      if (len > 4)
        for (const y of [2.3, 5.6])
          face(
            f,
            'glass',
            [
              [len / 2 - 0.45, y, 0.025],
              [len / 2 + 0.45, y, 0.025],
              [len / 2 + 0.45, y + 1.2, 0.025],
              [len / 2 - 0.45, y + 1.2, 0.025],
            ],
            glass,
          );
    });
  // Timber corner gallery faces into the court; the palace's open area stays uncovered.
  if (near(o)) {
    const g = frame(o, 9, 9.8, -11.85);
    box(g, 'wood', [-2.4, 0, -0.2], [2.4, 0.2, 1.65], wood);
    for (const x of [-2.2, 0, 2.2])
      box(g, 'wood', [x - 0.09, 0.2, 1.45], [x + 0.09, 4.6, 1.63], wood);
    for (let j = 0; j < 17; j++) {
      const x = -2.15 + j * 0.27;
      box(g, 'wood', [x - 0.035, 0.2, 1.5], [x + 0.035, 1.1, 1.59], wood);
    }
    box(g, 'wood', [-2.3, 1.1, 1.4], [2.3, 1.23, 1.69], wood);
    box(g, 'wood', [-2.5, 4.5, -0.15], [2.5, 4.7, 1.8], wood);
  }
}
function wallWalk(o, a, b, width) {
  const f = edgeFrame(o, a, b),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const holes = [];
  if (o.detail !== 'skyline')
    for (let i = 0; i < Math.floor(len / 2.8); i++)
      holes.push([((i + 0.5) * len) / Math.floor(len / 2.8), 9.7, 0.26, 0.72, false]);
  for (const side of [0, -width]) {
    const ff = side ? frame(f, len, 0, side, Math.PI) : f;
    panel(ff, len, 0, 7, [], 'brick', color(brick, 0.86));
    panel(ff, len, 7, 11, holes, 'brick', brick);
    masonry(ff, len, 0.18, 4.7, [], 31);
    if (near(o)) {
      box(ff, 'plaster', [0, 6.62, 0.03], [len, 6.83, 0.1], color(plaster, 0.9));
      box(ff, 'brick', [0, 8.38, 0.03], [len, 8.56, 0.15], color(brick, 0.9));
    }
  }
  cap(f, rectangle(0, -width, len, width), 11, 'brick', brick);
  roofFacet(f, [0, 11.08, 0.22], [len, 11.08, 0.22], [len, 12, -width / 2], [0, 12, -width / 2]);
  roofFacet(
    f,
    [len, 11.08, -width - 0.22],
    [0, 11.08, -width - 0.22],
    [0, 12, -width / 2],
    [len, 12, -width / 2],
  );
}
function curtainWalls(o) {
  wallWalk(o, [-28.5, 34.7], [26.9, 34.4], 6.5);
  wallWalk(o, [-30.5, 27.1], [-30.36, 7.06], 3.55);
  wallWalk(o, [-29.59, -4.36], [-29.47, -12.31], 3.02);
  // External stone balcony and corbels above the southern retaining wall.
  if (near(o)) {
    const f = frame(o, 11, 0, 34.55);
    box(f, 'carved', [-2, 5.15, -0.15], [2, 5.43, 1.5], trim);
    for (const x of [-1.3, 1.3]) beam(f, 'carved', [x, 4.1, 0], [x, 5.2, 1.1], 0.32, 0.35, trim);
    if (fine(o))
      for (let i = 0; i < 18; i++) {
        const x = -1.9 + i * 0.224;
        box(f, 'metal', [x - 0.02, 5.43, 1.35], [x + 0.02, 6.38, 1.4], [0.19, 0.18, 0.15]);
      }
    box(f, 'metal', [-2, 6.35, 1.3], [2, 6.43, 1.44], [0.19, 0.18, 0.15]);
  }
}
function approachBridge(o) {
  const p = points(128319139),
    a = p[0],
    b = p[1],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    f = edgeFrame(o, a, b);
  const n = 4,
    step = len / n,
    pier = 0.9;
  for (let i = 0; i <= n; i++) {
    const x = i * step;
    box(
      f,
      'sandstone',
      [Math.max(0, x - pier / 2), 0, -1.65],
      [Math.min(len, x + pier / 2), 4.6, 1.65],
      stone,
    );
  }
  for (let i = 0; i < n; i++)
    archBarrel(
      frame(f, (i + 0.5) * step, 0, 1.65),
      step - pier,
      0.9,
      3.5,
      4.7,
      3.3,
      'sandstone',
      stone,
    );
  box(f, 'stone', [0, 4.7, -1.72], [len, 5.15, 1.72], trim);
  for (const side of [-1, 1])
    box(
      f,
      'sandstone',
      [0, 5.15, side < 0 ? -1.75 : 1.45],
      [len, 5.8, side < 0 ? -1.45 : 1.75],
      stone,
    );
  if (fine(o))
    for (let x = 0.25; x < len; x += 0.5)
      for (const side of [-1, 1])
        line(
          frame(f, 0, 0, side * 1.755),
          [x, 5.15, 0],
          [x, 5.8, 0],
          0.035,
          'sandstone',
          color(stone, 0.7),
        );
}
function site(o) {
  // Castle court and narrow contact plinth only. Park, moat and landscape belong to terrain.
  const p = clean([
    [-40.1, -38.4],
    [40.1, -38.4],
    [40.1, 38.4],
    [-40.1, 38.4],
  ]);
  slab(o, p, 0, 0.12, 'stone', color(stone, 1.2));
  if (fine(o))
    for (let x = -26; x < 14; x += 1.1)
      for (let z = -11; z < 27; z += 1.1)
        if (master(o) || (Math.round(x * 10) + Math.round(z * 10)) % 3 === 0)
          cap(
            o,
            rectangle(x, z, 1.04, 1.04),
            0.125,
            'stone',
            color(stone, 1.01 + ((Math.round(x * 10) + Math.round(z * 10) + 1000) % 7) * 0.02),
          );
}
export function buildMirRuntime(out, detail) {
  const o = { ...out, detail };
  site(o);
  palace(o);
  curtainWalls(o);
  gate(o);
  for (const t of towerParts) tower(o, t);
  approachBridge(o);
}
export function buildMirSkyline(out) {
  buildMirRuntime(out, 'skyline');
}
export const mirStudy = {
  id: 'N0250',
  key: 'mir_castle_complex',
  title: 'Mir Castle Complex',
  category: 'castle',
  wikidataId: 'Q209643',
  mapFrame: 'map-frame.json',
  build: (out) => buildMirRuntime(out),
  brief:
    'Five individually ornamented brick and plaster towers around Mir’s open courtyard, L-shaped residential palace, covered curtain-wall walks, west gate passage and four-arched northern approach bridge.',
  sourceFacts: {
    identity: 'Exact Q209643 on OSM relation/1579104',
    mappedEnvelopeMeters: [78.855, 75.802],
    cornerTowers: 4,
    gateTowers: 1,
    palaceWings: 2,
    surveyedVerticalDatum: false,
    referenceState:
      'Restored castle shown in the museum’s undated photograph gallery; restoration completed in 2010.',
  },
  reconstruction: {
    basis:
      'OSM building-part polygons and bridge line; official Mir Castle museum photographs of west gate, courtyard, roof, south wall and northeast approach; ICOMOS 2000 evaluation.',
    verticalDatum:
      'Local courtyard level at zero. Map heights use 30/31 m tower roofs and 22 m palace roof. ICOMOS describes 22–26 m towers with a different or unspecified height datum; discrepancy remains unresolved.',
    state:
      'Restored castle with red ceramic roofs, red-brick west/gate/northeast towers and pale northwest/southeast upper towers.',
  },
  scaleBasis:
    'Mapped part footprints in meters. Native +X is 12.866 degrees south of east. Roof ridges, facade decoration and bridge elevations are photographic interpretations.',
  refs: [
    'https://mirzamak.by/',
    'https://mirzamak.by/best-photos',
    'https://whc.unesco.org/en/list/625/',
    'https://whc.unesco.org/document/169793',
    'https://www.openstreetmap.org/relation/1579104',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Museum photographs and ICOMOS text are research references only; no third-party images or meshes bundled.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east-southeast, 12.866 degrees south of east',
    front: '+Z south-southwest; entrance on west/-X',
    origin: 'Mapped castle anchor, provisional local courtyard level',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus:
      'Mapped castle and approach bridge retained; vertical datum, orientation and terrain contact need in-world review',
    notes:
      'Keep the courtyard open. The bridge meets the north palace above courtyard level and needs an approach bank supplied by terrain.',
  }),
  geographicNote:
    'Draft placement until restored tower height datum, bridge contact and facing are checked on terrain.',
  limitations: [
    'Maximum fidelity pending: facade proportions, blind-niche patterns, window counts, roof dormers and ridge/chimney positions are photographic interpretations rather than measured restoration drawings.',
    'The castle and northern arched bridge are modeled. The separate chapel-crypt, guardhouse, park, moat, earth ramparts and later palace remains of the wider complex still need authored geometry.',
    'Map tower roof heights of 30/31 m differ from the ICOMOS evaluation’s 22–26 m tower dimensions. Height datum and roof inclusion need resolution before geographic completion.',
    'Bridge arch count follows the museum view; pier geometry, deck elevation and contact with the approach embankment remain provisional. A narrow castle contact plinth is not a surveyed terrain model.',
    'Eight reusable procedural material graphs provide brick, lime plaster, granite, raw limestone, sandstone, timber, ceramic tile and painted metal. Glass is local PBR color; no embedded photographs.',
  ],
  camera: { position: [-127, 84, 146], lookAt: [0, 10, -7], fov: 43 },
  qaCameras: [
    { name: 'castle-courtyard-plan', position: [0, 190, 0.2], lookAt: [0, 0, 0] },
    { name: 'west-gate-and-blind-niches', position: [-79, 16, 1], lookAt: [-33, 12, 1] },
    { name: 'southwest-brick-tower', position: [-62, 25, 64], lookAt: [-33, 15, 32] },
    { name: 'northwest-pale-tower', position: [-64, 29, -57], lookAt: [-28, 17, -27] },
    { name: 'courtyard-palace-and-gallery', position: [-22, 14, 19], lookAt: [7, 13, -13] },
    { name: 'roof-tiles-and-dormers', position: [-7, 28, 14], lookAt: [8, 19, -17] },
    { name: 'northeast-tower-and-bridge', position: [67, 32, -78], lookAt: [26, 13, -40] },
    { name: 'southeast-pale-tower', position: [64, 26, 62], lookAt: [30, 15, 29] },
    { name: 'southern-wallwalk-and-balcony', position: [10, 16, 71], lookAt: [8, 8, 32] },
  ],
};
