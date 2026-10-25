/** Fort Worth's Exchange Building: full T plan, two open courts and Mission front arcade. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/9v/9vf/fort_worth_livestock_exchange/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff';
const C = {
  wall: rgb('d9cfb0'),
  trim: rgb('e2d5b8'),
  roof: rgb('ab6e50'),
  wood: rgb('8b5849'),
  metal: rgb('82958a'),
  glass: rgb('627673'),
  dark: rgb('705a48'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  wood: { slot: 'wall', graph: 'shingle_cedar', roughness: 0.94, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.87, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.04 },
  dark: { slot: 'trim', localRef: ref, roughness: 0.96, metallic: 0 },
};
function tri(o, s, ps, n, col = C[s]) {
  const v = ps.map((p) => p.map(Math.fround));
  if (
    Math.hypot(
      ...cross(
        v[1].map((x, i) => x - v[0][i]),
        v[2].map((x, i) => x - v[0][i]),
      ),
    ) < 1e-8
  )
    return;
  if (n && normalFor(...ps).reduce((a, v, i) => a + v * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), col);
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
const area = (r) =>
    r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0),
  cw = (r) => (area(r) < 0 ? r : [...r].reverse()),
  ccw = (r) => (area(r) > 0 ? r : [...r].reverse());
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], 0, u[0]];
  return {
    len,
    n,
    u,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, outer, holes, f, depth = 0) {
  const pts = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((a, r) => a + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => f.P(...pts[k], depth)),
      f.n,
    );
}
function strip(o, s, f, x, y, w, h, depth = 0.02) {
  panel(o, s, rect(x, y, w, h), [], f, depth);
}
function block(o, s, f, x, y, w, h, front, back = 0) {
  const r = rect(x, y, w, h);
  panel(o, s, r, [], f, front);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      ps = [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)];
    Q(o, s, ps, normalFor(...ps));
  }
}
function cap(o, s, rings, y, up = true) {
  const pts = rings.flat(),
    holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(pts.flat(), holes);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => [pts[k][0], y, pts[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, r, lo, hi) {
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]);
    strip(o, s, f, f.len / 2, lo, f.len, hi - lo, 0);
  }
  cap(o, s, [r], hi);
  cap(o, s, [r], lo, false);
}
function arch(x, bottom, width, spring, rise, n) {
  return [
    [x - width / 2, bottom],
    [x + width / 2, bottom],
    ...Array.from({ length: n + 1 }, (_, i) => [
      x + (width / 2) * Math.cos((i / n) * Math.PI),
      spring + rise * Math.sin((i / n) * Math.PI),
    ]),
  ];
}
function reveal(o, s, f, ring, depth, backSurface = 'glass') {
  panel(o, backSurface, ring, [], f, -depth);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      ps = [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)];
    Q(o, s, ps, normalFor(...ps));
  }
}
function window(o, f, h, d) {
  const r = h.r ?? rect(h.x, h.y, h.w, h.h);
  panel(o, 'glass', r, [], f, d === 0 ? 0.015 : -0.18);
  if (!d) return;
  reveal(o, 'trim', f, r, 0.18);
  if (d > 1) {
    for (const sg of [-1, 1])
      strip(o, 'trim', f, h.x + sg * (h.w / 2 + 0.04), h.y - 0.05, 0.095, h.h + 0.1, 0.045);
    strip(o, 'trim', f, h.x, h.y + h.h, h.w + 0.15, 0.12, 0.06);
    block(o, 'trim', f, h.x, h.y - 0.12, h.w + 0.2, 0.13, 0.17, 0);
    strip(o, 'trim', f, h.x, h.y + h.h * 0.5, h.w, 0.055, -0.12);
    if (h.w > 1.0) strip(o, 'trim', f, h.x, h.y, 0.055, h.h, -0.12);
  }
}
const outer = cw(plan.outline),
  courts = plan.courtyards.map(ccw),
  frontA = plan.outline[13],
  frontB = plan.outline[12],
  front = frame(frontA, frontB),
  highOutline = cw(
    plan.outline.map((p, i) => (i === 12 ? [p[0], 28.25] : i === 13 ? [p[0], 28.02] : p)),
  );
function wall(o, f, top, d, holes = []) {
  panel(
    o,
    'wall',
    rect(f.len / 2, -0.25, f.len, top + 0.25),
    d ? holes.map((h) => h.r ?? rect(h.x, h.y, h.w, h.h)) : [],
    f,
  );
  for (const h of holes) window(o, f, h, d);
  if (d > 0) {
    strip(o, 'trim', f, f.len / 2, 0.38, f.len, 0.22, 0.035);
    if (d === 1) strip(o, 'dark', f, f.len / 2, top - 0.16, f.len, 0.16, 0.08);
    else block(o, 'dark', f, f.len / 2, top - 0.16, f.len, 0.16, 0.26, -0.03);
  }
}
function body(o, d) {
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      f = frame(a, b),
      isArcade =
        (a === frontA && b === frontB) ||
        (Math.abs(a[0] - frontA[0]) < 1e-6 && Math.abs(b[0] - frontB[0]) < 1e-6);
    if (isArcade) continue;
    const hs = [];
    if (f.len > 3) {
      const count = Math.max(1, Math.floor(f.len / 4.4));
      for (let j = 0; j < count; j++) {
        const x = ((j + 0.5) / count) * f.len;
        for (const y of d === 0 ? [4.9] : [1.2, 5.0]) hs.push({ x, y, w: 1.2, h: 2.05 });
      }
    }
    wall(o, f, 8.1, d, hs);
  }
  for (const r of courts)
    for (let i = 0; i < r.length; i++) {
      const f = frame(r[i], r[(i + 1) % r.length]),
        hs = [];
      if (f.len > 3.8)
        for (let j = 0; j < Math.floor(f.len / 3.5); j++)
          for (const y of d === 0 ? [] : [1.2, 5.0])
            hs.push({ x: (f.len * (j + 0.5)) / Math.floor(f.len / 3.5), y, w: 1.05, h: 2.0 });
      wall(o, f, 8.1, d, hs);
    }
  cap(o, 'wall', [outer, ...courts], -0.25, false);
  cap(o, 'trim', [outer, ...courts], 0.65);
  const back = frame(
      front.P(0, 0, -3.45).filter((_, i) => i !== 1),
      front.P(front.len, 0, -3.45).filter((_, i) => i !== 1),
    ),
    hs = [];
  for (let j = 0; j < 8; j++)
    hs.push({
      x: (back.len * (j + 0.5)) / 8,
      y: 0.65,
      w: j === 3 || j === 4 ? 1.65 : 1.05,
      h: j === 3 || j === 4 ? 2.8 : 2.2,
    });
  wall(o, back, 8.1, d, hs);
  const topWindows = [-12, -8, 8, 12];
  for (const x of topWindows) {
    const f = frame([-16.84, 28.0], [16.57, 28.25]);
    strip(o, 'dark', f, x + 16.84, 6.6, 1.4, 0.62, 0.04);
    if (d > 1) strip(o, 'trim', f, x + 16.84, 6.6, 0.06, 0.62, 0.06);
  }
}
function arcade(o, d) {
  const n = [4, 6, 10, 16][d],
    openings = Array.from({ length: 8 }, (_, j) =>
      arch((front.len * (j + 0.5)) / 8, 0.65, 3.12, 2.5, 1.56, n),
    );
  panel(o, 'wall', rect(front.len / 2, -0.25, front.len, 5.0), openings, front);
  for (const r of openings)
    for (let i = 1; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        ps = [front.P(...a), front.P(...b), front.P(...b, -3.45), front.P(...a, -3.45)];
      Q(o, 'wall', ps, normalFor(...ps));
    }
  for (let j = 0; j <= 8; j++) {
    const x = (front.len * j) / 8;
    if (d > 0) block(o, 'trim', front, x, 2.36, 0.95, 0.16, 0.11, -0.08);
    if (d > 1) block(o, 'trim', front, x, 0.7, 0.86, 0.15, 0.13, -0.06);
  }
  cap(
    o,
    'trim',
    [
      [
        front.P(0, 0).filter((_, i) => i !== 1),
        front.P(front.len, 0).filter((_, i) => i !== 1),
        front.P(front.len, 0, -3.45).filter((_, i) => i !== 1),
        front.P(0, 0, -3.45).filter((_, i) => i !== 1),
      ],
    ],
    4.75,
    false,
  );
  const zfront = (x) => front.P(x, 0)[2],
    backz = (x) => front.P(x, 0, -3.45)[2];
  Q(
    o,
    'roof',
    [
      [frontA[0] - 0.65, 4.75, zfront(0) + 0.65],
      [frontB[0] + 0.65, 4.75, zfront(front.len) + 0.65],
      [frontB[0] + 0.3, 5.9, backz(front.len) - 0.4],
      [frontA[0] - 0.3, 5.9, backz(0) - 0.4],
    ],
    [0, 1, 0.5],
  );
  block(o, 'dark', front, front.len / 2, 4.55, front.len + 1.3, 0.2, 0.65, -0.02);
  if (d > 1)
    for (let x = 1.1; x < front.len; x += 1.45) {
      const a = front.P(x, 4.5, 0.45),
        b = front.P(x, 4.07, 0.04);
      beam(o, 'dark', a, b, 0.12, 0.12, C.dark);
    }
  const sx = -0.2,
    sz = front.P(front.len / 2, 0)[2] + 0.65;
  for (let j = 0; j < 4; j++)
    box(
      o,
      'trim',
      [sx - 2.6, 0.65 - (j + 1) * 0.17, sz + j * 0.32],
      [sx + 2.6, 0.65 - j * 0.17, sz + (j + 1) * 0.32],
      C.trim,
    );
}
function distance(p, a, b) {
  const v = [b[0] - a[0], b[1] - a[1]],
    t = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1])),
    );
  return Math.hypot(p[0] - a[0] - t * v[0], p[1] - a[1] - t * v[1]);
}
function roof(o, d) {
  const rings = [highOutline, ...courts],
    pts = rings.flat(),
    holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(pts.flat(), holes),
    height = (p) =>
      8.1 +
      Math.min(
        2.1,
        Math.min(...rings.flatMap((r) => r.map((a, i) => distance(p, a, r[(i + 1) % r.length])))) *
          0.4,
      ),
    P = (p) => [p[0], height(p), p[1]],
    mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
  function sub(a, b, c, n) {
    if (n === 0) {
      tri(o, 'roof', [P(a), P(b), P(c)], [0, 1, 0]);
      return;
    }
    const ab = mid(a, b),
      bc = mid(b, c),
      ca = mid(c, a);
    sub(a, ab, ca, n - 1);
    sub(ab, b, bc, n - 1);
    sub(ca, bc, c, n - 1);
    sub(ab, bc, ca, n - 1);
  }
  if (d === 0) {
    for (let j = 0; j < ix.length; j += 3) sub(...ix.slice(j, j + 3).map((k) => pts[k]), 1);
  } else {
    // Clip the original perforated plan to explicit planar hip sections. Internal
    // triangulation diagonals must never become arbitrary folds in a tiled roof.
    const zones = [
      { clip: [-100, 100, -100, -26.8], roof: [-13, -1.9, -32.4, -26.8], rise: 1.15 },
      { clip: [-100, 100, -26.8, 0], roof: [-13, 12.35, -26.8, 0], rise: 2.1 },
      { clip: [-100, -17, 0, 100], roof: [-35.1, -16.7, 0, 32.4], rise: 2.1 },
      { clip: [17, 100, 0, 100], roof: [16.57, 35.1, 0, 32.4], rise: 2.1 },
      { clip: [-17, 17, 0, 15.6], roof: [-17, 17, 0, 15.6], rise: 2.1 },
      { clip: [-17, 17, 15.6, 24.6], roof: [-17, 17, 15.6, 24.6], rise: 1.3 },
      { clip: [-17, 17, 24.6, 100], roof: [-17, 17, 24.6, 28.3], rise: 0.95 },
    ];
    const value = (p, plane) => p[0] * plane[0] + p[1] * plane[1] + plane[2];
    function clip(poly, plane) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length],
          u = value(a, plane),
          v = value(b, plane);
        if (u >= -1e-9) out.push(a);
        if ((u > 1e-9 && v < -1e-9) || (u < -1e-9 && v > 1e-9)) {
          const t = u / (u - v);
          out.push(a.map((x, k) => x + t * (b[k] - x)));
        }
      }
      return out.filter(
        (p, i) =>
          Math.hypot(
            p[0] - out[(i + out.length - 1) % out.length][0],
            p[1] - out[(i + out.length - 1) % out.length][1],
          ) > 1e-6,
      );
    }
    for (const zone of zones) {
      const [x0, x1, z0, z1] = zone.clip,
        [a, b, c, e] = zone.roof,
        slope = zone.rise / (Math.min(b - a, e - c) / 2),
        planes = [
          [slope, 0, -slope * a],
          [-slope, 0, slope * b],
          [0, slope, -slope * c],
          [0, -slope, slope * e],
        ];
      for (let j = 0; j < ix.length; j += 3) {
        let cell = ix.slice(j, j + 3).map((k) => pts[k]);
        for (const h of [
          [1, 0, -x0],
          [-1, 0, x1],
          [0, 1, -z0],
          [0, -1, z1],
        ])
          cell = clip(cell, h);
        if (cell.length < 3) continue;
        for (let k = 0; k < 4; k++) {
          let face = cell;
          for (let l = 0; l < 4; l++)
            if (l !== k)
              face = clip(
                face,
                planes[l].map((x, i) => x - planes[k][i]),
              );
          if (face.length < 3) continue;
          const P = (p) => [p[0], 8.1 + Math.max(0, value(p, planes[k])), p[1]];
          for (let t = 1; t < face.length - 1; t++)
            tri(o, 'roof', [P(face[0]), P(face[t]), P(face[t + 1])], [0, 1, 0]);
          for (let t = 0; t < face.length; t++) {
            const a = face[t],
              b = face[(t + 1) % face.length],
              mid = a.map((x, i) => (x + b[i]) / 2),
              onBoundary = rings.some((r) =>
                r.some((p, i) => distance(mid, p, r[(i + 1) % r.length]) < 1e-5),
              );
            if (onBoundary && Math.max(P(a)[1], P(b)[1]) > 8.1001) {
              const f = frame(a, b),
                ps = [[a[0], 8.1, a[1]], [b[0], 8.1, b[1]], P(b), P(a)];
              Q(o, 'wall', ps, f.n);
            }
          }
        }
      }
    }
  }
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const f = frame(r[i], r[(i + 1) % r.length]);
      if (d < 2) strip(o, 'dark', f, f.len / 2, 7.91, f.len, 0.19, 0.08);
      else block(o, 'dark', f, f.len / 2, 7.91, f.len, 0.19, 0.38, -0.02);
      if (d > 1 && f.len > 3)
        for (let x = 0.65; x < f.len; x += 1.8) {
          const p = f.P(x, 7.9, 0.3),
            q = f.P(x, 7.55, 0.04);
          beam(o, 'dark', p, q, 0.11, 0.11, C.dark);
        }
    }
}
function mission(o, d) {
  const f = frame([-0.4, 28.25], [0.6, 28.25]),
    n = [5, 8, 14, 20][d],
    right = [
      [6.2, 8.0],
      [6.2, 9.0],
      [5.6, 9.0],
      [5.1, 9.05],
      [4.55, 9.25],
      [4.15, 9.55],
      [3.5, 9.55],
      [3.5, 10.0],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const a = ((i / n) * Math.PI) / 2;
        return [2.9 * Math.cos(a), 10 + 1.7 * Math.sin(a)];
      }),
    ],
    outline = [
      ...right,
      ...right
        .slice(0, -1)
        .reverse()
        .map(([x, y]) => [-x, y]),
    ];
  panel(o, 'wall', outline, [], f, 0.15);
  panel(o, 'wall', outline, [], { ...f, n: f.n.map((v) => -v) }, -0.3);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      ps = [f.P(...a, 0.15), f.P(...b, 0.15), f.P(...b, -0.3), f.P(...a, -0.3)];
    Q(o, 'trim', ps, normalFor(...ps));
    if (d > 1 && i > 1 && i < outline.length - 1)
      beam(o, 'trim', f.P(...a, 0.19), f.P(...b, 0.19), 0.13, 0.13, C.trim);
  }
  if (d > 0)
    for (const x of [-5.6, 5.6])
      sphere(
        o,
        'trim',
        f.P(x, 9.35, 0.02),
        [0.36, 0.36, 0.36],
        C.trim,
        d > 1 ? 12 : 8,
        d > 1 ? 6 : 4,
      );
}
function squareLoft(o, s, c, layers) {
  for (let j = 0; j < layers.length - 1; j++) {
    const [y, r] = layers[j],
      [Y, R] = layers[j + 1],
      a = [
        [-r, -r],
        [r, -r],
        [r, r],
        [-r, r],
      ],
      b = [
        [-R, -R],
        [R, -R],
        [R, R],
        [-R, R],
      ];
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4,
        ps = [
          [c[0] + a[i][0], y, c[1] + a[i][1]],
          [c[0] + a[k][0], y, c[1] + a[k][1]],
          [c[0] + b[k][0], Y, c[1] + b[k][1]],
          [c[0] + b[i][0], Y, c[1] + b[i][1]],
        ],
        n = [(a[i][0] + a[k][0]) / 2, 0, (a[i][1] + a[k][1]) / 2];
      Q(o, s, ps, n);
    }
  }
  const [y, r] = layers.at(-1);
  cap(
    o,
    s,
    [
      [
        [c[0] - r, c[1] - r],
        [c[0] + r, c[1] - r],
        [c[0] + r, c[1] + r],
        [c[0] - r, c[1] + r],
      ],
    ],
    y,
  );
}
function cupola(o, d) {
  const c = [-0.4, 20.5],
    r = cw([
      [c[0] - 2.6, c[1] - 2.6],
      [c[0] + 2.6, c[1] - 2.6],
      [c[0] + 2.6, c[1] + 2.6],
      [c[0] - 2.6, c[1] + 2.6],
    ]);
  for (let i = 0; i < 4; i++) {
    const f = frame(r[i], r[(i + 1) % 4]),
      h = {
        x: f.len / 2,
        y: 10.45,
        w: 1.45,
        h: 1.6,
        r: arch(f.len / 2, 10.45, 1.45, 11.3, 0.725, [4, 6, 10, 14][d]),
      };
    panel(o, 'wood', rect(f.len / 2, 10.0, f.len, 2.7), [h.r], f);
    window(o, f, h, d);
    block(o, 'dark', f, f.len / 2, 9.86, f.len + 0.25, 0.15, 0.15, -0.02);
    block(o, 'dark', f, f.len / 2, 12.58, f.len + 0.65, 0.2, 0.32, -0.02);
    if (d > 1) {
      for (const x of [0.3, f.len - 0.3]) strip(o, 'dark', f, x, 10.0, 0.1, 2.6, 0.04);
      for (let x = 0.25; x < f.len; x += 0.65)
        beam(o, 'dark', f.P(x, 12.5, 0.28), f.P(x, 12.27, 0.02), 0.08, 0.08, C.dark);
    }
    if (d === 3)
      for (let row = 0; row < 11; row++)
        for (let j = 0; j < 12; j++) {
          const x = 0.22 + j * 0.42 + (row % 2) * 0.21,
            y = 10.06 + row * 0.23;
          if (x > f.len - 0.1 || (x > f.len / 2 - 0.85 && x < f.len / 2 + 0.85)) continue;
          const w = 0.38,
            n = 6,
            shape = [
              [x - w / 2, y + 0.2],
              [x + w / 2, y + 0.2],
              ...Array.from({ length: n + 1 }, (_, k) => [
                x + (w / 2) * Math.cos((k / n) * Math.PI),
                y + 0.09 - 0.09 * Math.sin((k / n) * Math.PI),
              ]),
            ];
          panel(o, 'wood', shape, [], f, 0.025);
        }
  }
  squareLoft(o, 'metal', c, [
    [12.75, 3.0],
    [12.95, 2.7],
    [13.45, 2.32],
    [13.95, 1.72],
    [14.24, 1.15],
    [14.3, 0.62],
  ]);
  prism(
    o,
    'wood',
    [
      [c[0] - 0.65, c[1] - 0.65],
      [c[0] + 0.65, c[1] - 0.65],
      [c[0] + 0.65, c[1] + 0.65],
      [c[0] - 0.65, c[1] + 0.65],
    ],
    14.3,
    15.7,
  );
  if (d > 0)
    for (const [a, b] of [
      [
        [c[0] - 0.65, c[1] - 0.65],
        [c[0] + 0.65, c[1] - 0.65],
      ],
      [
        [c[0] + 0.65, c[1] - 0.65],
        [c[0] + 0.65, c[1] + 0.65],
      ],
      [
        [c[0] + 0.65, c[1] + 0.65],
        [c[0] - 0.65, c[1] + 0.65],
      ],
      [
        [c[0] - 0.65, c[1] + 0.65],
        [c[0] - 0.65, c[1] - 0.65],
      ],
    ]) {
      const f = frame(b, a);
      strip(o, 'dark', f, 0.65, 14.5, 0.8, 1.0, 0.025);
      if (d > 1)
        for (let y = 14.55; y < 15.5; y += 0.13)
          block(o, 'wood', f, 0.65, y, 0.85, 0.055, 0.08, 0.03);
    }
  squareLoft(o, 'metal', c, [
    [15.7, 0.85],
    [15.9, 0.62],
    [16.3, 0.22],
  ]);
  if (d > 0) sphere(o, 'metal', [c[0], 16.47, c[1]], [0.14, 0.17, 0.14], C.metal, 8, 4);
}
function build(o, _f, d = 3) {
  body(o, d);
  arcade(o, d);
  roof(o, d);
  mission(o, d);
  cupola(o, d);
}
export const exchangeSkyline = (o, f) => build(o, f, 0);
export const exchangeDistrict = (o, f) => build(o, f, 1);
export const exchangeStreet = (o, f) => build(o, f, 2);
export const exchangeModel = {
  id: 'fort_worth_livestock_exchange',
  key: 'fort_worth_livestock_exchange',
  recipe: 'structure-fort-worth-livestock-exchange.mjs',
  cell: '9v/9vf',
  title: 'Fort Worth Livestock Exchange Building',
  category: 'civic-cultural',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Whole originalT-shaped LivestockExchangeBuilding and BOTHopeninnercourtyards: creamstucco/terracotta hippedroofs/broad eaves, genuineeight-bay southfront arcade and recessedclosedentries, centraltallMissioncurvedsteppedparapet/ballfinials, shingledsquarecupola/archedlights/bellcastpatinatedroof/louvredlantern/cap/finial; connectedrearwing. No district slab/pens/detachedlandmarks/artwork/lettering/interiors.',
  camera: [-83, 57, 106],
  lookAt: [0, 5, 2],
  portableGroundY: -0.3,
  mediumFiContext: { scale: 1.55, groundY: -0.3 },
  qaCameras: [
    {
      name: 'southfront-open-arcade-mission-parapet-and-cupola',
      position: [-32, 15, 62],
      lookAt: [0, 7, 23],
    },
    {
      name: 'both-open-native-courtyards-and-complete-roof-plan',
      position: [29, 54, 47],
      lookAt: [0, 5, 16],
    },
    {
      name: 'arcade-eye-level-through-open-arch-to-recessed-entry',
      position: [-6.8, 1.8, 36],
      lookAt: [-6.8, 2, 25],
    },
    {
      name: 'cupola-arched-lights-shingles-bellcast-roof-and-louvred-lantern',
      position: [12, 21, 37],
      lookAt: [-0.4, 13.1, 20.5],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Original independent160mfield frozen at fixed southfront[0,36]before geometry; own entry steps/arcadefloor/hostcontact approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-fort-worth-livestock-exchange.mjs',
    level: 'skyline',
    export: 'exchangeSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'exchangeDistrict', errorMeters: 1.3, surfaces },
      street: { export: 'exchangeStreet', errorMeters: 0.65, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Whole survivingExchangeBuilding only, originalT-shaped21vertexouterenvelope and both6vertexcourtyardholes preserved. Mainfrontarcade modeled as eight genuinely open bays with coveredrecesses/closedentries; exactbaycensus/roofpartitions/hiddenrear elevations/courtyardsash/sections/heights are bounded interpretations of two frontHighsmithphotos and native plan. Nearer roofs use explicit planar hip sections clipped to the full original perforated plan, with genuinecourtyardholes and closed boundary faces. Skyline approximates these roof sections within2.2m. No rooforcampusslab fills courts.',
    'Two exact primaryHighsmithnativeJP2photographs actually inspected via lossless full-sizeddecodes, bound to individualLOCcatalog/photographer public-domain dedication. Qualla inventory inspected first; oldstockpen/packingplant postcards do not establish this Exchangeexterior and are unused. No copied image pixels or generatedbitmap. Source wall/roof/shingle/metal hues support exterior; moderncosmetics/hiddenchanges unverified.',
    'Missioncurvedparapet/ballfinials, paleopenarcade/raisedentry and shingledarched-windowcupola/bellcastgreenroof/louvredlantern represented. Lettering/mountedlonghorn-headartwork/flags/flagpole omitted. Sharedproceduralstucco/terracottatile/cedarshingle/paintedmetal, muted glazing and original geometric relief only; no engineeringreplica claim.',
    'No entireStockyardsdistrict/cattlepens, detachedCowtownColiseum/StockyardsHotel/station/barns, roads/plazas/parking/landscape/statues, interiors/animals/people/cars or demolishedpackingplant. Original160mterrain/rawtile/grid/PNG frozen unchanged at fixed[0,36]. Exact sill/arcadefloor/hostcontact unverified; replaceFootprint=false.',
  ],
};
