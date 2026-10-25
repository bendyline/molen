/** Arkadi's double-aisle church and surrounding wings on their original signed plans. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { cleanRing, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sw/sw3/arkadi_monastery/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  colors = {
    rubble: rgb('af9976'),
    church: rgb('c7bba0'),
    trim: rgb('d2c4a7'),
    roof: rgb('a39b84'),
    dark: rgb('49483c'),
    metal: rgb('535247'),
  };
const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.99, metallic: 0 },
  church: { slot: 'wall', graph: 'stone_limestone', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_limestone_weathered', roughness: 0.99, metallic: 0 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.92, metallic: 0.16 },
};
const area = (r) =>
  r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
  2;
const clockwise = (r) => {
  r = cleanRing(r);
  return area(r) < 0 ? r : [...r].reverse();
};
function tri(out, slot, ps, target = null) {
  if (target && normalFor(...ps).reduce((s, v, i) => s + v * target[i], 0) < 0)
    ps = [ps[0], ps[2], ps[1]];
  out.addTriangle(
    slot,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    colors[slot],
  );
}
function cap(out, r, y, slot, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function wall(out, a, b, y0, y1, slot) {
  const ps = [
    [a[0], y0, a[1]],
    [b[0], y0, b[1]],
    [b[0], y1, b[1]],
    [a[0], y1, a[1]],
  ];
  quad(out, slot, ps, normalFor(...ps), colors[slot]);
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function circle(x, y, r, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
}
function arch(x, bottom, w, spring, n) {
  const r = [
    [x - w / 2, bottom],
    [x + w / 2, bottom],
    [x + w / 2, spring],
  ];
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI;
    r.push([x + (Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2]);
  }
  return r;
}
function panel(out, profile, holes, f, slot, depth = 0) {
  const pts = [profile, ...holes].flat(),
    starts = holes.map(
      (_, i) => profile.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => f.p(...pts[j], depth)),
      [f.n[0], 0, f.n[1]],
    );
}
function relief(out, r, f, slot, front = 0.14, back = -0.3, holes = []) {
  panel(out, r, holes, f, slot, front);
  const reverse = { ...f, n: f.n.map((v) => -v), p: f.p };
  panel(out, r, holes, reverse, slot, back);
  for (let k = 0; k < 1 + holes.length; k++) {
    let ring = k === 0 ? r : holes[k - 1];
    if (area(ring) > 0 !== (k === 0)) ring = [...ring].reverse();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        ps = [f.p(...a, front), f.p(...a, back), f.p(...b, back), f.p(...b, front)];
      quad(out, slot, ps, normalFor(...ps), colors[slot]);
    }
  }
}
function opening(out, r, f, d, { slot = 'trim', width = 0.12, depth = -0.22, back = 'dark' } = {}) {
  panel(out, r, [], f, back, depth);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ps = [f.p(...a), f.p(...b), f.p(...b, depth), f.p(...a, depth)];
    quad(out, slot, ps, normalFor(...ps), colors[slot]);
    if (d === 3 || (d === 2 && (r.length === 4 ? i % 2 === 0 : i === 0 || i === r.length - 1)))
      beam(out, slot, f.p(a[0], a[1], 0.035), f.p(b[0], b[1], 0.035), width, width, colors[slot]);
  }
}
function wingFace(out, a, b, h, d, isWestWing = false) {
  const f = frame(a, b),
    { len, p } = f,
    holes = [];
  if (d > 0 && len > 5) {
    const count = Math.max(1, Math.floor(len / (d === 1 ? 14 : 6.4)));
    for (let i = 0; i < count; i++) {
      const x = (len * (i + 0.5)) / count;
      holes.push({ r: rect(x, h - 2.55, 0.88, 1.34), kind: 'window' });
      if (d > 1) {
        const door = i % 2 === 0;
        holes.push({
          r: door ? arch(x, 0.15, 1.3, 2.0, d === 2 ? 7 : 12) : rect(x, 1.15, 0.65, 0.7),
          kind: door ? 'door' : 'window',
        });
      }
    }
    if (isWestWing && f.n[0] < -0.8) {
      const gateX = (plan.westGate[0] - a[0]) * f.u[0] + (plan.westGate[1] - a[1]) * f.u[1];
      if (gateX > 2 && gateX < len - 2) {
        const r = arch(gateX, 0.15, 2.5, 2.85, d === 1 ? 5 : d === 2 ? 9 : 14);
        for (let i = holes.length - 1; i >= 0; i--)
          if (Math.abs((holes[i].r[0][0] + holes[i].r[1][0]) / 2 - gateX) < 2.2) holes.splice(i, 1);
        holes.push({ r, kind: 'gate' });
      }
    }
  }
  panel(
    out,
    [
      [0, -0.4],
      [len, -0.4],
      [len, h],
      [0, h],
    ],
    holes.map((o) => o.r),
    f,
    'rubble',
  );
  for (const o of holes) {
    opening(out, o.r, f, d, { width: o.kind === 'gate' ? 0.2 : 0.13 });
    if (d === 3) {
      const x = (o.r[0][0] + o.r[1][0]) / 2,
        y = o.r[0][1];
      if (o.kind === 'window')
        beam(out, 'dark', p(x, y, -0.16), p(x, o.r[2][1], -0.16), 0.045, 0.06, colors.dark);
      else {
        beam(out, 'dark', p(x, y, -0.15), p(x, o.r[2][1], -0.15), 0.05, 0.07, colors.dark);
        for (const sign of [-1, 1])
          beam(
            out,
            'metal',
            p(x + sign * 0.12, 1.0, -0.12),
            p(x + sign * 0.12, 1.2, -0.12),
            0.035,
            0.045,
            colors.metal,
          );
      }
    }
  }
  if (d > 0 && (d > 1 || len > 3))
    beam(out, 'trim', p(0, h + 0.18, -0.08), p(len, h + 0.18, -0.08), 0.32, 0.4, colors.trim);
}
const churchPlan = plan.buildings.find((b) => b.tags.building === 'church').outline,
  frontA = churchPlan[2],
  frontB = churchPlan[0],
  front = frame(frontA, frontB),
  facade = { ...front, p: (x, y, z = 0) => front.p(x + front.len / 2, y, z) };
function column(out, x, base, h, r, d, f = facade) {
  const c = f.p(x, 0, 0.2),
    n = d === 1 ? 6 : d === 2 ? 10 : 16,
    rings = [
      radialRing(base, r * 1.25, r * 1.25, n, [c[0], c[2]]),
      radialRing(base + 0.2, r, r, n, [c[0], c[2]]),
      radialRing(base + h - 0.25, r * 0.88, r * 0.88, n, [c[0], c[2]]),
      radialRing(base + h, r * 1.25, r * 1.25, n, [c[0], c[2]]),
    ];
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        ps = [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]];
      quad(out, 'trim', ps, normalFor(...ps), colors.trim);
    }
  cap(
    out,
    rings[0].map((p) => [p[0], p[2]]),
    base,
    'trim',
    false,
  );
  cap(
    out,
    rings.at(-1).map((p) => [p[0], p[2]]),
    base + h,
    'trim',
  );
  if (d === 3)
    for (let i = 0; i < n; i += 2) {
      const a = (i / n) * Math.PI * 2;
      beam(
        out,
        'trim',
        [c[0] + Math.cos(a) * r, base + 0.45, c[2] + Math.sin(a) * r],
        [c[0] + Math.cos(a) * r * 0.88, base + h - 0.4, c[2] + Math.sin(a) * r * 0.88],
        0.025,
        0.025,
        colors.trim,
      );
    }
}
function molding(out, r, f, d, slot = 'trim', width = 0.12, depth = 0.12, closed = false) {
  if (d === 0) return;
  for (let i = 0; i < r.length - (closed ? 0 : 1); i++)
    beam(
      out,
      slot,
      f.p(...r[i], depth),
      f.p(...r[(i + 1) % r.length], depth),
      width,
      width,
      colors[slot],
    );
}
function lowerFront(out, d) {
  const half = front.len / 2,
    holes = [],
    f = facade,
    n = [6, 10, 16, 24][d];
  for (const x of [-3.1, 3.1]) {
    holes.push(rect(x, 0.35, 1.5, 2.45));
    if (d > 0) holes.push(circle(x, 4.25, 0.49, n));
  }
  panel(
    out,
    [
      [-half, -0.4],
      [half, -0.4],
      [half, 5.8],
      [-half, 5.8],
    ],
    holes,
    f,
    'church',
  );
  for (const r of holes) opening(out, r, f, d, { width: 0.15 });
  if (d > 0) {
    for (const x of [-5.1, -1.5, 1.5, 5.1]) column(out, x, 0.5, 4.8, 0.23, d);
    for (const y of [0.25, 0.6, 5.3, 5.72])
      beam(
        out,
        'trim',
        f.p(-half, y, 0.08),
        f.p(half, y, 0.08),
        y > 5 ? 0.24 : 0.16,
        0.24,
        colors.trim,
      );
    for (const x of [-3.1, 0, 3.1]) {
      const r = arch(x, 0.45, 3.1, 3.8, n);
      molding(out, r.slice(2), f, d, 'trim', 0.18, 0.13);
      beam(out, 'trim', f.p(x - 1.1, 3.12, 0.14), f.p(x + 1.1, 3.12, 0.14), 0.16, 0.3, colors.trim);
    }
    // The middle bay is blind masonry; the source photograph has only two open doors.
    panel(out, rect(0, 0.65, 1.5, 2.3), [], f, 'rubble', 0.025);
    if (d > 1) {
      molding(
        out,
        [
          [-1, 3.25],
          [-0.65, 3.43],
          [-0.3, 3.39],
          [0, 3.75],
          [0.3, 3.39],
          [0.65, 3.43],
          [1, 3.25],
        ],
        f,
        d,
        'trim',
        0.13,
        0.27,
      );
      for (const x of [-3.1, 3.1]) {
        beam(
          out,
          'dark',
          f.p(x - 0.42, 4.25, -0.15),
          f.p(x + 0.42, 4.25, -0.15),
          0.04,
          0.055,
          colors.dark,
        );
        beam(out, 'dark', f.p(x, 3.84, -0.15), f.p(x, 4.66, -0.15), 0.04, 0.055, colors.dark);
      }
    }
  }
}
function frontGables(out, d) {
  const f = facade,
    half = front.len / 2;
  for (const side of [-1, 1]) {
    const cx = side * 3.1,
      profile = [
        [-3.3, 5.8],
        [-3.3, 6.0],
        [-2.75, 6.25],
        [-2.35, 6.65],
        [-2.15, 7.22],
        [-1.7, 7.28],
        [-1.25, 7.65],
        [-0.75, 7.85],
        [0, 8.25],
        [0.75, 7.85],
        [1.25, 7.65],
        [1.7, 7.28],
        [2.15, 7.22],
        [2.35, 6.65],
        [2.75, 6.25],
        [3.3, 6.0],
        [3.3, 5.8],
      ].map(([x, y]) => [x + cx, y]);
    const r = profile.filter((p) => Math.abs(p[0]) <= half + 0.05);
    relief(out, r, f, 'church', 0.12, -0.4);
    molding(out, r.slice(1, -1), f, d, 'trim', 0.16, 0.18);
    if (d > 0) {
      beam(
        out,
        'trim',
        f.p(cx - 1.3, 7.35, 0.22),
        f.p(cx + 1.3, 7.35, 0.22),
        0.16,
        0.2,
        colors.trim,
      );
      const o = circle(cx, 6.7, 0.16, [6, 8, 12, 16][d]);
      panel(out, o, [], f, 'dark', 0.15);
      molding(out, o, f, d, 'trim', 0.08, 0.22, true);
      // Corner obelisks and paired scroll panels keep the recognizable Renaissance skyline.
      const x = side * 4.9;
      relief(out, rect(x, 7.05, 0.54, 0.65), f, 'trim', 0.28, -0.25);
      relief(
        out,
        [
          [x - 0.31, 7.65],
          [x + 0.31, 7.65],
          [x, 8.85],
        ],
        f,
        'trim',
        0.21,
        -0.2,
      );
    }
  }
}
function bell(out, c, d, scale = 1) {
  const n = d === 1 ? 8 : d === 2 ? 12 : 18,
    rows = [
      [0, 0.17],
      [0.15, 0.19],
      [0.4, 0.22],
      [0.55, 0.32],
      [0.65, 0.36],
    ].map(([y, r]) => radialRing(c[1] - y * scale, r * scale, r * scale, n, [c[0], c[2]]));
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        ps = [rows[j - 1][i], rows[j - 1][k], rows[j][k], rows[j][i]];
      ps.reverse();
      quad(out, 'metal', ps, normalFor(...ps), colors.metal);
    }
  cap(
    out,
    rows[0].map((p) => [p[0], p[2]]),
    c[1],
    'metal',
  );
  cap(
    out,
    rows.at(-1).map((p) => [p[0], p[2]]),
    c[1] - 0.65 * scale,
    'metal',
    false,
  );
  if (d > 1)
    beam(
      out,
      'metal',
      [c[0], c[1] - 0.65 * scale, c[2]],
      [c[0], c[1] - 0.83 * scale, c[2]],
      0.055 * scale,
      0.055 * scale,
      colors.metal,
    );
}
function belfry(out, d) {
  const f = facade,
    n = [5, 8, 14, 20][d],
    profile = [
      [-1.95, 7.2],
      [1.95, 7.2],
      [1.95, 10.6],
      [1.7, 10.7],
      [1.3, 10.9],
      [0.95, 11.45],
      [0.85, 11.75],
      [0.85, 12.25],
      [0.67, 12.75],
      [0.35, 13.0],
      [0, 13.08],
      [-0.35, 13.0],
      [-0.67, 12.75],
      [-0.85, 12.25],
      [-0.85, 11.75],
      [-0.95, 11.45],
      [-1.3, 10.9],
      [-1.7, 10.7],
      [-1.95, 10.6],
    ],
    holes = [
      arch(-0.88, 7.45, 1.2, 9.5, n),
      arch(0.88, 7.45, 1.2, 9.5, n),
      circle(0, 10.8, 0.34, n),
      arch(0, 11.65, 0.74, 12.25, n),
    ];
  relief(out, profile, f, 'church', 0.32, -0.48, holes);
  molding(out, profile.slice(2), f, d, 'trim', 0.12, 0.39);
  for (const h of holes) molding(out, h.slice(2), f, d, 'trim', 0.1, 0.39);
  if (d > 0) {
    for (const x of [-1.75, 0, 1.75]) {
      beam(out, 'trim', f.p(x, 7.25, 0.4), f.p(x, 9.55, 0.4), 0.28, 0.24, colors.trim);
      beam(out, 'trim', f.p(x - 0.23, 9.55, 0.4), f.p(x + 0.23, 9.55, 0.4), 0.2, 0.3, colors.trim);
    }
    for (const y of [7.28, 10.15, 11.65])
      beam(
        out,
        'trim',
        f.p(y === 11.65 ? -0.95 : -1.95, y, 0.42),
        f.p(y === 11.65 ? 0.95 : 1.95, y, 0.42),
        0.18,
        0.24,
        colors.trim,
      );
    for (const x of [-0.88, 0.88]) bell(out, f.p(x, 9.55, -0.05), d, 0.8);
    bell(out, f.p(0, 12.25, -0.05), d, 0.65);
  }
  beam(out, 'trim', f.p(0, 13.0, 0.05), f.p(0, 13.6, 0.05), 0.14, 0.14, colors.trim);
  beam(out, 'trim', f.p(-0.21, 13.38, 0.05), f.p(0.21, 13.38, 0.05), 0.14, 0.14, colors.trim);
}
function vaults(out, d) {
  const f = facade,
    bands = [4, 7, 12, 20][d],
    depth = 18.3;
  for (const cx of [-3.25, 3.25]) {
    for (let i = 0; i < bands; i++) {
      const a = (i / bands) * Math.PI,
        b = ((i + 1) / bands) * Math.PI,
        q = [
          [cx + Math.cos(a) * 3.25, 5.8 + Math.sin(a) * 2.15],
          [cx + Math.cos(b) * 3.25, 5.8 + Math.sin(b) * 2.15],
        ],
        ps = [f.p(...q[0], -0.35), f.p(...q[1], -0.35), f.p(...q[1], -depth), f.p(...q[0], -depth)];
      ps.reverse();
      quad(out, 'roof', ps, normalFor(...ps), colors.roof);
    }
    const end = [
      [cx - 3.25, 5.8],
      ...Array.from({ length: bands + 1 }, (_, i) => {
        const a = (i / bands) * Math.PI;
        return [cx + Math.cos(a) * 3.25, 5.8 + Math.sin(a) * 2.15];
      }),
    ];
    panel(out, end, [], { ...f, n: f.n.map((v) => -v) }, 'church', -depth);
    if (d > 1)
      for (const depthOffset of [2.8, 8.4, 14.0]) {
        const r = Array.from({ length: bands + 1 }, (_, i) => {
          const a = (i / bands) * Math.PI;
          return [cx + Math.cos(a) * 3.28, 5.8 + Math.sin(a) * 2.18];
        });
        for (let i = 0; i < bands; i++)
          beam(
            out,
            'roof',
            f.p(...r[i], -depthOffset),
            f.p(...r[i + 1], -depthOffset),
            0.07,
            0.08,
            colors.roof,
          );
      }
  }
}
function church(out, d) {
  const r = clockwise(churchPlan),
    h = 5.8;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      da = (a[0] - frontA[0]) * front.n[0] + (a[1] - frontA[1]) * front.n[1],
      db = (b[0] - frontA[0]) * front.n[0] + (b[1] - frontA[1]) * front.n[1];
    if (Math.abs(da) < 0.04 && Math.abs(db) < 0.04) continue;
    wall(out, a, b, -0.4, h, 'church');
    if (d > 0 && Math.hypot(b[0] - a[0], b[1] - a[1]) > 3)
      beam(out, 'trim', [a[0], h, a[1]], [b[0], h, b[1]], 0.2, 0.24, colors.trim);
  }
  cap(out, r, -0.4, 'church', false);
  cap(out, r, h, 'roof');
  lowerFront(out, d);
  vaults(out, d);
  frontGables(out, d);
  belfry(out, d);
}
function coveredWalk(out, b, d) {
  const r = clockwise(b.outline);
  cap(out, r, 3.35, 'roof');
  cap(out, r, 3.18, 'roof', false);
  for (let i = 0; i < r.length; i++) wall(out, r[i], r[(i + 1) % r.length], 3.18, 3.35, 'roof');
  const xs = r.map((p) => p[0]),
    zs = r.map((p) => p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    longX = x1 - x0 > z1 - z0,
    len = longX ? x1 - x0 : z1 - z0,
    count = Math.max(1, Math.floor(len / (d === 0 ? 9 : 5.5)));
  for (let i = 0; i <= count; i++) {
    const x = longX ? x0 + (len * i) / count : (x0 + x1) / 2,
      z = longX ? (z0 + z1) / 2 : z0 + (len * i) / count;
    beam(out, 'trim', [x, 0, z], [x, 3.18, z], 0.4, 0.4, colors.trim);
  }
}
function build(out, _frame, d = 3) {
  for (const b of plan.buildings) {
    if (b.tags.building === 'church') continue;
    if (b.tags.building === 'roof' || b.tags.wall === 'no') {
      coveredWalk(out, b, d);
      continue;
    }
    const r = clockwise(b.outline),
      h =
        b.id === 'way/361128302'
          ? 5.3
          : b.id === 'way/362357324'
            ? 5.6
            : b.id === 'way/180851998'
              ? 6.7
              : 7.0;
    for (let i = 0; i < r.length; i++)
      wingFace(out, r[i], r[(i + 1) % r.length], h, d, b.id === 'way/180852002');
    cap(out, r, h, 'roof');
    cap(out, r, -0.4, 'rubble', false);
    if (d > 1 && b.id === 'way/180852002')
      for (const t of [0.23, 0.62, 0.88]) {
        const z =
            Math.min(...r.map((p) => p[1])) +
            t * (Math.max(...r.map((p) => p[1])) - Math.min(...r.map((p) => p[1]))),
          x = (Math.min(...r.map((p) => p[0])) + Math.max(...r.map((p) => p[0]))) / 2;
        beam(out, 'trim', [x, h, z], [x, h + 1, z], 0.5, 0.65, colors.trim);
        beam(out, 'roof', [x - 0.5, h + 1, z], [x + 0.5, h + 1, z], 0.12, 0.9, colors.roof);
      }
  }
  church(out, d);
}
export const arkadiSkyline = (o, f) => build(o, f, 0);
export const arkadiDistrict = (o, f) => build(o, f, 1);
export const arkadiStreet = (o, f) => build(o, f, 2);
export const arkadiMonasteryModel = {
  id: 'arkadi_monastery',
  key: 'arkadi_monastery',
  recipe: 'structure-arkadi-monastery.mjs',
  cell: 'sw/sw3',
  title: 'Arkadi Monastery',
  category: 'religious-structure',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Surviving Arkadi monastery on ten distinct native building/roof plans around a genuinely open court: warm rubble enclosing cell/gate/museum wings with recessed dressed openings and parapets, open southern covered walk, and pale limestone double-aisle church with twin vault roofs, two west doors/oculi and blind central niche, engaged columns/cornices, curved paired gables/pinnacles and a genuinely open2+1bell crown with its circular void.',
  camera: [-115, 82, 100],
  lookAt: [-2, 4, -1],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 1.0 },
  qaCameras: [
    { name: 'double-aisle-west-front', position: [-33, 9, 3.8], lookAt: [-8.4, 6.7, 3.8] },
    { name: 'open-bell-gable-and-twin-roofs', position: [-24, 16, 19], lookAt: [-6, 9, 3.5] },
    { name: 'west-gate-and-rubble-wing', position: [-68, 12, -14], lookAt: [-40, 3.5, -12] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Named native monastery envelope establishes site identity; individual church/wing/roof ways define geometry. A fixed dry western approach six metres outside the original named West Gate defines approximateY0 before terrain sampling.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-arkadi-monastery.mjs',
    level: 'skyline',
    export: 'arkadiSkyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'arkadiDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'arkadiStreet', errorMeters: 0.13, surfaces },
    },
  },
  limitations: [
    'Named original monastery way361128301/Q541696 is a site identity envelope, not an extruded building. Ten separate original building/roof ways retain their signed position, including Katholikon, surrounding wings and explicit open covered roofs; the large court remains unmeshed. Detached ossuary/memorial, restaurant, other detached buildings and landscape excluded.',
    'Exact public-domain Klaas1978church-front and CC0Cmessierwest-wing originals provide exterior controls after a Qualla-first search; each has an explicit own-work creator release and matching pinned primary/native-file hash. No battle/old engraving, source with uncertain authorship, attribution/share-alike photo, unrelated Preveli/Phaistos image or street sign was used. Source photos are references, not textures.',
    'Church body5.8m, twin roof rise2.15m and bell/cross crown13.6m, main wings5.3–7m and the open walk3.35m are medium-fi photographic estimates, not surveyed heights. Paired vault curvature, engaged column sections, arch/window rhythm, hidden roofs/apse caps, wing chimneys and sculptural mouldings are simplified; no lettering, portrait sculpture or precise surviving ruin reconstruction is claimed.',
    'Exterior assembly only: two recessed church doors and blind center niche match the photographed west front; bell-gable openings and southern covered walk are physically open, while ordinary dark door/window recesses are closed. No religious interiors, people, vegetation, signage,1866battle reconstruction or historical vanished structures.',
    'Foundations extend.4m below a fixed dry west-gate approach datum. Actual courtyard, ruin-edge and local wing ground contact are approximate; source terrain remains unchanged, with no whole-site platform or blanket terrain opening.',
  ],
};
