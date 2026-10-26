/** Preserved postal palace envelope; contemporary main-cupola covering follows operator text. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, beamPath, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/69/69y/buenos_aires_central_post_office/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff';
const C = {
  wall: rgb('d2cbb9'),
  trim: rgb('ddd6c5'),
  roof: rgb('51575c'),
  glass: rgb('667a80'),
  frame: rgb('777b77'),
  clock: rgb('d6d0b9'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.3, metallic: 0.12 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.15 },
  clock: { slot: 'trim', localRef: ref, roughness: 0.92, metallic: 0 },
};
function T(o, s, ps, n, color = C[s]) {
  if (n && normalFor(...ps).reduce((sum, v, i) => sum + v * n[i], 0) < 0)
    ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), color);
}
function Q(o, s, ps, n, color = C[s]) {
  T(o, s, [ps[0], ps[1], ps[2]], n, color);
  T(o, s, [ps[0], ps[2], ps[3]], n, color);
}
const area = (r) =>
  r.reduce(
    (sum, p, i) => sum + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
    0,
  );
const clockwise = (r) => (area(r) < 0 ? r : [...r].reverse());
const outer = clockwise(plan.outline);
function cap(o, s, ring, y, up = true) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    n,
    p: (x, y, z = 0) => [a[0] + x * u[0] + z * n[0], y, a[1] + x * u[1] + z * n[1]],
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function arch(x, y, w, h, n) {
  const r = w / 2,
    cy = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => [
      x + r * Math.cos((i / n) * Math.PI),
      cy + r * Math.sin((i / n) * Math.PI),
    ]),
  ];
}
function panel(o, s, boundary, holes, f, depth = 0) {
  const pts = [boundary, ...holes].flat(),
    starts = holes.map(
      (_, i) => boundary.length + holes.slice(0, i).reduce((sum, h) => sum + h.length, 0),
    ),
    ids = earcut(pts.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((j) => f.p(...pts[j], depth)),
      [f.n[0], 0, f.n[1]],
    );
}
function block(o, s, f, x, y, w, h, front, back = 0) {
  const r = rect(x, y, w, h);
  panel(o, s, r, [], f, front);
  for (let j = 0; j < r.length; j++) {
    const a = r[j],
      b = r[(j + 1) % r.length];
    Q(o, s, [f.p(...a, front), f.p(...b, front), f.p(...b, back), f.p(...a, back)]);
  }
}
function band(o, f, y, h, depth = 0.3) {
  block(o, 'trim', f, f.len / 2, y, f.len, h, depth);
}
function glazed(o, f, hole, d) {
  const depth = d === 0 ? -0.15 : -0.32,
    r = hole.r;
  panel(o, 'glass', r, [], f, depth);
  for (let j = 0; j < r.length; j++) {
    const a = r[j],
      b = r[(j + 1) % r.length];
    Q(o, 'trim', [f.p(...a), f.p(...b), f.p(...b, depth), f.p(...a, depth)]);
  }
  if (d < 2) return;
  if (d === 2) {
    const { x, y, w, h } = hole;
    for (const sign of [-1, 1])
      panel(
        o,
        'trim',
        rect(x + sign * (w / 2 + 0.12), y, 0.2, h - (hole.arch ? w / 2 : 0)),
        [],
        f,
        0.13,
      );
    panel(o, 'trim', rect(x, y - 0.15, w + 0.4, 0.17), [], f, 0.23);
    panel(o, 'frame', rect(x, y + 0.12, 0.075, h - 0.22), [], f, -0.18);
    panel(o, 'frame', rect(x, y + h * 0.57, w - 0.12, 0.075), [], f, -0.18);
    return;
  }
  const { x, y, w, h } = hole;
  block(o, 'trim', f, x, y - 0.15, w + 0.4, 0.17, 0.23);
  for (const sign of [-1, 1])
    block(o, 'trim', f, x + sign * (w / 2 + 0.13), y, 0.22, h - (hole.arch ? w / 2 : 0), 0.13);
  block(o, 'frame', f, x, y + 0.12, 0.075, h - 0.22, -0.18, depth);
  block(o, 'frame', f, x, y + h * 0.57, w - 0.12, 0.075, -0.18, depth);
  if (d === 3) {
    if (!hole.arch) {
      block(o, 'trim', f, x, y + h + 0.03, w + 0.58, 0.23, 0.28);
      if (y > 18 && y < 25) {
        const p = [
          [x - w / 2 - 0.35, y + h + 0.35],
          [x + w / 2 + 0.35, y + h + 0.35],
          [x, y + h + 1.1],
        ];
        panel(o, 'trim', p, [], f, 0.32);
      }
    } else {
      const outside = arch(x, y - 0.12, w + 0.48, h + 0.36, 12);
      // Cut an actual architrave ring, retaining its aperture.
      panel(o, 'trim', outside, [r], f, 0.16);
    }
  }
}
function facade(o, a, b, d) {
  const f = frame(a, b),
    south = f.n[1] > 0.98,
    centerSouth = south && Math.abs((a[0] + b[0]) / 2) < 18 && f.len > 20,
    count =
      f.len < 4.5 ? 0 : centerSouth ? 3 : Math.max(1, Math.round(f.len / (south ? 6.1 : 5.7))),
    step = f.len / Math.max(1, count),
    holes = [];
  if (d === 0) {
    if (centerSouth)
      for (let i = 0; i < 3; i++) {
        const x = (i + 0.5) * step;
        holes.push({ x, y: 0.7, w: 4.1, h: 6.1, arch: true, r: arch(x, 0.7, 4.1, 6.1, 4) });
      }
  } else {
    const rows =
      d === 1
        ? [
            [0.8, 5.5],
            [20, 5],
          ]
        : [
            [0.8, 5.5],
            [9.3, 6],
            [16.1, 1.5],
            [20, 5],
            [27, 3],
            [33.1, 3.5],
          ];
    if (d === 2) rows.splice(2, 1);
    for (let i = 0; i < count; i++) {
      if (d === 1 && !centerSouth && i % 2) continue;
      const x = (i + 0.5) * step;
      for (const [y, h] of rows) {
        const arched = (south && y < 8) || (y > 8 && y < 15),
          w = Math.min(step * (centerSouth ? 0.46 : 0.42), y < 8 && south ? 4.1 : 2.65);
        holes.push({
          x,
          y,
          w,
          h,
          arch: arched,
          r: arched ? arch(x, y, w, h, [4, 5, 8, 12][d]) : rect(x, y, w, h),
        });
      }
    }
  }
  panel(
    o,
    'wall',
    rect(f.len / 2, -1.2, f.len, 39.2),
    holes.map((h) => h.r),
    f,
  );
  for (const h of holes) glazed(o, f, h, d);
  if (d === 0) return;
  for (const [y, h, depth] of [
    [7.2, 0.42, 0.3],
    [17.5, 0.48, 0.6],
    [31.5, 0.4, 0.48],
    [37.4, 0.6, 0.9],
  ]) {
    if (d < 3) {
      const r = rect(f.len / 2, y, f.len, h);
      panel(o, 'trim', r, [], f, depth);
      Q(
        o,
        'trim',
        [f.p(0, y + h, depth), f.p(f.len, y + h, depth), f.p(f.len, y + h), f.p(0, y + h)],
        [0, 1, 0],
      );
    } else band(o, f, y, h, depth);
  }
  if (d > 1 && f.len > 4.5) {
    for (let i = 0; i <= count; i++) {
      const x = Math.min(f.len - 0.25, Math.max(0.25, i * step));
      if (d === 2) {
        panel(o, 'trim', rect(x, 18.1, 0.58, 12.9), [], f, 0.21);
        panel(o, 'trim', rect(x, 30.65, 0.9, 0.55), [], f, 0.35);
      } else {
        block(o, 'trim', f, x, 18.1, 0.58, 12.9, 0.21);
        block(o, 'trim', f, x, 30.65, 0.9, 0.55, 0.35);
      }
      if (d === 3) {
        block(o, 'trim', f, x, 18.1, 0.92, 0.4, 0.3);
        block(o, 'trim', f, x, 35.8, 0.34, 1.4, 0.14);
      }
    }
    if (d === 3) {
      for (let y = 0; y < 17; y += 0.68) {
        // Course seams occupy solid piers, never the glazed openings.
        const occupied = holes
          .filter((h) => y > h.y && y < h.y + h.h)
          .map((h) => [h.x - h.w / 2 - 0.2, h.x + h.w / 2 + 0.2])
          .sort((a, b) => a[0] - b[0]);
        let x = 0;
        for (const [lo, hi] of [...occupied, [f.len, f.len]]) {
          if (lo - x > 0.08) panel(o, 'frame', rect((x + lo) / 2, y, lo - x, 0.025), [], f, 0.006);
          x = Math.max(x, hi);
        }
      }
      for (let i = 0; i < count * 3; i++)
        block(o, 'trim', f, ((i + 0.5) * f.len) / (count * 3), 36.95, 0.18, 0.35, 0.48);
    }
  }
}
function ringLoft(o, s, rings, center, capTop = true) {
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length,
        ps = [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        mid = ps.reduce((p, q) => p.map((v, a) => v + q[a] / 4), [0, 0, 0]);
      Q(o, s, ps, [mid[0] - center[0], 0, mid[2] - center[1]]);
    }
  if (capTop)
    cap(
      o,
      s,
      rings.at(-1).map((p) => [p[0], p[2]]),
      rings.at(-1)[0][1],
    );
}
function cylinder(o, x, z, radius, bottom, top, d, slot = 'trim') {
  const n = [4, 4, 10, 16][d],
    r = (y) =>
      Array.from({ length: n }, (_, i) => [
        x + radius * Math.cos((i / n) * 2 * Math.PI),
        y,
        z + radius * Math.sin((i / n) * 2 * Math.PI),
      ]);
  ringLoft(o, slot, [r(bottom), r(top)], [x, z]);
}
function column(o, f, x, bottom, top, d) {
  const p = f.p(x, 0, 0.82);
  cylinder(o, p[0], p[2], 0.61, bottom, top, d);
  if (d > 0) {
    block(o, 'trim', f, x, bottom - 0.25, 1.55, 0.4, 1.65, 0.1);
    block(o, 'trim', f, x, top - 0.18, 1.8, 0.55, 1.75, 0.1);
  }
  if (d === 3)
    for (const sign of [-1, 1]) {
      const q = f.p(x + sign * 0.65, top - 0.38, 1.02);
      cylinder(o, q[0], q[2], 0.22, top - 0.5, top + 0.05, 2);
    }
}
const bevel = (x, z, w, depth, y) => {
  const a = w / 2,
    b = depth / 2,
    r = Math.min(w, depth) * 0.14;
  return [
    [-a + r, -b],
    [a - r, -b],
    [a, -b + r],
    [a, b - r],
    [a - r, b],
    [-a + r, b],
    [-a, b - r],
    [-a, -b + r],
  ].map((p) => [x + p[0], y, z + p[1]]);
};
function cupola(o, x, z, w, depth, bottom, top, d, glazedCover = false) {
  const profiles = [
      [bottom, 1],
      [bottom + (top - bottom) * 0.27, 1.02],
      [bottom + (top - bottom) * 0.7, 0.84],
      [top, 0.63],
    ],
    rings = profiles.map(([y, scale]) => bevel(x, z, w * scale, depth * scale, y));
  ringLoft(o, glazedCover ? 'glass' : 'roof', rings, [x, z]);
  if (d > 0) {
    for (const [y, scale] of [profiles[0], profiles.at(-1)]) {
      const r = bevel(x, z, w * scale + 0.3, depth * scale + 0.3, y);
      ringLoft(o, 'trim', [r, r.map((p) => [p[0], p[1] + 0.27, p[2]])], [x, z], false);
    }
    if (d === 3 || (glazedCover && d > 1))
      for (let i = 0; i < 8; i++)
        for (let j = 1; j < rings.length; j++)
          beam(
            o,
            glazedCover ? 'frame' : 'trim',
            rings[j - 1][i],
            rings[j][i],
            d === 1 ? 0.14 : 0.22,
            0.17,
            C[glazedCover ? 'frame' : 'trim'],
          );
    if (glazedCover && d > 1) {
      for (let j = 1; j < rings.length; j++) {
        for (const t of d === 3 ? [0.25, 0.5, 0.75] : [0.5]) {
          const r = rings[j].map((p, i) => p.map((v, k) => v * t + rings[j - 1][i][k] * (1 - t)));
          beamPath(o, 'frame', r.slice(0, 8), 0.08, 0.1, C.frame, true);
        }
        if (d === 3)
          for (let i = 0; i < 8; i++) {
            const k = (i + 1) % 8,
              mid = (r) => r[i].map((v, a) => (v + r[k][a]) / 2);
            beam(o, 'frame', mid(rings[j - 1]), mid(rings[j]), 0.09, 0.1, C.frame);
          }
      }
    }
  }
  if (d > 1)
    for (const sign of [-1, 1]) {
      cylinder(o, x + sign * w * 0.315, z + depth * 0.315, 0.15, top + 0.2, top + 1.4, d, 'frame');
      cylinder(o, x + sign * w * 0.315, z - depth * 0.315, 0.15, top + 0.2, top + 1.4, d, 'frame');
    }
}
function dormer(o, f, x, d, big = false) {
  const w = big ? 4.1 : 2.5,
    y = big ? 46.8 : 39,
    h = big ? 8.5 : 3.3,
    r = big ? arch(x, y, w, h, 12) : rect(x, y, w, h),
    boundary = big
      ? arch(x, y - 0.35, w + 2.4, h + 1.45, 16)
      : [
          [x - w / 2 - 0.4, y - 0.25],
          [x + w / 2 + 0.4, y - 0.25],
          [x + w / 2 + 0.4, y + h + 0.15],
          [x, y + h + 1.25],
          [x - w / 2 - 0.4, y + h + 0.15],
        ];
  panel(o, 'trim', boundary, [r], f, 0.15);
  panel(o, 'glass', r, [], f, -0.25);
  for (let j = 0; j < boundary.length; j++) {
    const k = (j + 1) % boundary.length;
    Q(o, 'trim', [
      f.p(...boundary[j], 0.15),
      f.p(...boundary[k], 0.15),
      f.p(...boundary[k], -3.5),
      f.p(...boundary[j], -3.5),
    ]);
  }
  for (let j = 0; j < r.length; j++) {
    const k = (j + 1) % r.length;
    Q(o, 'trim', [
      f.p(...r[j], 0.15),
      f.p(...r[k], 0.15),
      f.p(...r[k], -0.25),
      f.p(...r[j], -0.25),
    ]);
  }
  if (d > 1 && !big) {
    block(o, 'frame', f, x, y + 0.1, 0.1, h - 0.2, -0.1, -0.25);
    block(o, 'frame', f, x, y + 1.7, w - 0.1, 0.1, -0.1, -0.25);
  }
  if (big) {
    const cy = y + h - 2.1,
      radius = 1.25,
      n = [8, 12, 24, 32][d],
      circle = Array.from({ length: n }, (_, i) => [
        x + radius * Math.cos((i / n) * 2 * Math.PI),
        cy + radius * Math.sin((i / n) * 2 * Math.PI),
      ]);
    panel(o, 'clock', circle, [], f, 0.23);
    if (d > 0) {
      if (d > 1)
        for (let i = 0; i < 12; i++) {
          const t = (i / 12) * Math.PI * 2,
            p = f.p(x + Math.sin(t) * 1.06, cy + Math.cos(t) * 1.06, 0.26),
            q = f.p(x + Math.sin(t) * 0.88, cy + Math.cos(t) * 0.88, 0.26);
          beam(o, 'frame', p, q, 0.07, 0.07, C.frame);
        }
      beam(o, 'frame', f.p(x, cy, 0.27), f.p(x - 0.18, cy + 0.69, 0.27), 0.1, 0.08, C.frame);
      beam(o, 'frame', f.p(x, cy, 0.28), f.p(x + 0.55, cy - 0.21, 0.28), 0.1, 0.08, C.frame);
    }
  }
}
function build(o, _frame, d = 3) {
  cap(o, 'wall', outer, -1.2, false);
  for (let i = 0; i < outer.length; i++) facade(o, outer[i], outer[(i + 1) % outer.length], d);
  // A continuous perimeter mansard folds down to a lower internal roof, not a full-height roof slab.
  const inset = (amount, y) =>
      outer.map(([x, z]) => [
        x - (Math.sign(x) * amount * Math.abs(x)) / 41,
        y,
        z - (Math.sign(z) * amount * Math.abs(z)) / 60,
      ]),
    roofRings = [inset(0, 38), inset(3.1, 44), inset(10, 36)];
  for (let j = 1; j < roofRings.length; j++)
    for (let i = 0; i < outer.length; i++) {
      const k = (i + 1) % outer.length;
      Q(
        o,
        'roof',
        [roofRings[j - 1][i], roofRings[j - 1][k], roofRings[j][k], roofRings[j][i]],
        [0, 1, 0],
      );
    }
  cap(
    o,
    'roof',
    roofRings.at(-1).map((p) => [p[0], p[2]]),
    36,
  );
  const southZ = plan.frontProjection.reduce((sum, p) => sum + p[1] / 2, 0),
    south = frame([-14.8, southZ], [14.8, southZ]);
  // Three-bay principal south portico and both long-side pavilions.
  if (d > 0) {
    for (const x of [0.75, 10.15, 19.45, 28.85]) column(o, south, x, 18.1, 37.25, d);
    band(o, south, 37.4, 1.1, 1.95);
    for (const sign of [-1, 1]) {
      const side =
        sign < 0 ? frame([-39.8, -10.8], [-39.8, 10.8]) : frame([39.4, 10.8], [39.4, -10.8]);
      for (const x of [0.6, 7.4, 14.2, 21]) column(o, side, x, 18.1, 37.3, d);
      band(o, side, 37.4, 1.0, 1.9);
    }
  }
  // Main historic roof form retained, modern faceted glass covering established by operator text.
  const drum = bevel(0, southZ - 10.7, 28.6, 21.4, 36);
  for (let i = 0; i < drum.length; i++) {
    const k = (i + 1) % drum.length;
    if (i === 4 && d > 0) {
      const f = frame([drum[k][0], drum[k][2]], [drum[i][0], drum[i][2]]),
        holes = [];
      for (const x of [f.len * 0.16, f.len * 0.5, f.len * 0.84]) {
        const offsets = d === 1 ? [0] : [-0.8, 0, 0.8];
        for (const off of offsets)
          for (const y of d === 1 ? [41.7] : [40.6, 42.7])
            holes.push({ x: x + off, y, w: 0.55, h: 1.15, r: rect(x + off, y, 0.55, 1.15) });
      }
      panel(
        o,
        'trim',
        rect(f.len / 2, 36, f.len, 13),
        holes.map((h) => h.r),
        f,
      );
      for (const h of holes) glazed(o, f, h, 1);
    } else {
      Q(
        o,
        'trim',
        [drum[i], drum[k], [drum[k][0], 49, drum[k][2]], [drum[i][0], 49, drum[i][2]]],
        [(drum[i][0] + drum[k][0]) / 2, 0, (drum[i][2] + drum[k][2]) / 2 - (southZ - 10.7)],
      );
    }
  }
  cap(
    o,
    'trim',
    drum.map((p) => [p[0], p[2]]),
    49,
  );
  cupola(o, 0, southZ - 10.7, 28.3, 21.2, 49, 62, d, true);
  dormer(o, frame([-14.5, southZ + 0.13], [14.5, southZ + 0.13]), 14.5, d, true);
  for (const sign of [-1, 1]) {
    const x = sign * 31.5,
      z = -0.8,
      ring = bevel(x, z, 16, 24, 36);
    ringLoft(o, 'trim', [ring, ring.map((p) => [p[0], 43, p[2]])], [x, z]);
    cupola(o, x, z, 15.8, 23.7, 43, 51, d);
    const side =
      sign < 0 ? frame([x - 8.1, -12], [x - 8.1, 12]) : frame([x + 8.1, 12], [x + 8.1, -12]);
    if (d > 0) dormer(o, side, 12, d);
  }
  // The native curved northern corners remain intact under their smaller roof towers.
  for (const sign of [-1, 1]) {
    const ring = bevel(sign * 32.2, -49.1, 12.7, 13.7, 36);
    ringLoft(o, 'trim', [ring, ring.map((p) => [p[0], 41.8, p[2]])], [sign * 32.2, -49.1]);
    cupola(o, sign * 32.2, -49.1, 12.7, 13.7, 41.8, 50, d);
  }
  if (d > 0) {
    for (let i = 0; i < outer.length; i++) {
      const f = frame(outer[i], outer[(i + 1) % outer.length]);
      if (f.len < 12) continue;
      const mid = (outer[i][1] + outer[(i + 1) % outer.length][1]) / 2,
        side = Math.abs(f.n[0]) > 0.9;
      if (
        (side && Math.abs(mid) < 13) ||
        (f.n[1] > 0.98 && Math.abs((outer[i][0] + outer[(i + 1) % outer.length][0]) / 2) < 18)
      )
        continue;
      const n = Math.max(1, Math.round(f.len / (d < 3 ? 11.4 : 5.7)));
      for (let k = 0; k < n; k++) dormer(o, f, ((k + 0.5) * f.len) / n, d);
    }
    if (d > 1) {
      for (let i = 0; i < 4; i++)
        block(o, 'trim', south, 14.8, -0.65 + i * 0.18, 23, 0.18, 1.9 - i * 0.42, 0);
      for (const x of [0, 29.6]) {
        block(o, 'trim', south, x, 38.1, 2, 1, 1.4);
        cylinder(o, ...[south.p(x, 0, 0.5)[0], south.p(x, 0, 0.5)[2]], 0.45, 39.1, 40.6, d);
      }
    }
  }
}
export const buenosAiresPostOfficeSkyline = (o, f) => build(o, f, 0);
export const buenosAiresPostOfficeDistrict = (o, f) => build(o, f, 1);
export const buenosAiresPostOfficeStreet = (o, f) => build(o, f, 2);
export const buenosAiresCentralPostOfficeModel = {
  id: 'buenos_aires_central_post_office',
  key: 'buenos_aires_central_post_office',
  recipe: 'structure-buenos-aires-central-post-office.mjs',
  cell: '69/69y',
  title: 'Buenos Aires Central Post Office',
  category: 'civic-institutional',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native postal palace envelope: arched entrances, rusticated lower stages, giant columned pavilions, cornices/recessed windows, perimeter mansard/dormers, northern corner cupolas, side cupolas and large south clock/glazed main cupola. Qualla-first exact public-domain originals and current primary operator facts; hidden roof sections and facade census approximate.',
  camera: [-134, 98, 175],
  lookAt: [0, 27, 2],
  portableGroundY: -1.5,
  mediumFiContext: { scale: 1.5, groundY: -1.5 },
  qaCameras: [
    {
      name: 'south-principal-three-bay-pavilion-and-glazed-cupola',
      position: [-8, 42, 139],
      lookAt: [0, 31, 50],
    },
    {
      name: 'arched-entry-recesses-rustication-and-colossal-columns',
      position: [-25, 18, 96],
      lookAt: [-1, 17, 59],
    },
    {
      name: 'west-long-facade-side-cupola-and-north-corner',
      position: [-127, 62, -35],
      lookAt: [-27, 29, -3],
    },
    {
      name: 'complete-roof-layout-low-inner-roof-and-clock-dormer',
      position: [99, 116, 146],
      lookAt: [0, 34, 5],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent raw256mfield frozen at original south dry entrance approach before geometry; street/threshold/basement elevations and native height tag scope approximate. No site slab or terrain fitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-buenos-aires-central-post-office.mjs',
    level: 'skyline',
    export: 'buenosAiresPostOfficeSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'buenosAiresPostOfficeDistrict', errorMeters: 1.1, surfaces },
      street: { export: 'buenosAiresPostOfficeStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    'Original46-vertex named nativeway17444532/Q19960845controls full envelope, south projection, small side offsets and rounded north corners without scaling. Original south edge/bounding midpoint set heading/anchor. Approximate vertical section reaches62m main cupola; native50mheight is ambiguous and retained as original metadata, not presented as a certified full roof bound.',
    'Exact Qualla2010ElsapucaiPD-user original inspected first; two supplemental2008south/west originals byClaudioElias have exact nativeSHA1and explicit own-workPD-self grants. Photographs establish preserved exterior/roof form, not a current unscaffolded image. Main-cupola faceted glass covering follows primary operator/city tourism restoration text. No non-PDphotograph/drawing/artwork, copied pixels or generated texture.',
    'Roof layout uses photo-controlled large south main cupola, west central pavilion and rounded north-corner forms; corresponding east/north roof details, counts/precise sections, modern glass tint/panel census and unobserved inner roof/service arrangement are bounded estimates. Main glass follows historic curved truncated roof form; no interior/concert hall/art installation or engineering survey claim.',
    'Pale Beaux-Arts facade includes true inset glazed apertures, representative arched entrances, rusticated lower stages, central columns/giant pilasters, cornice hierarchy, mansard dormers and clock dormer. Exact ornament/capital/window/baluster census and restored surface color estimated; simplified far levels retain dominant roof/pavilion arrangement and full envelope.',
    'Fixed dry south approach and raw independent Terrarium field remain unchanged. Composite urban DEM does not certify sidewalk/basement/threshold contact.1.2mdeep base and short own entrance steps are approximate. Exclude whole plaza, street, neighboring buildings, scenery/landscape, construction scaffolds/equipment, lettering/logos, antennas, vehicles and people.',
  ],
};
