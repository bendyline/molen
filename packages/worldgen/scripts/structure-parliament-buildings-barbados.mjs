/** Both original Barbados Parliament wing plans, pierced galleries and the surviving west clocktower. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, quad } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dd/ddm/parliament_buildings_barbados/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const colors = {
    stone: rgb('c3c4b7'),
    trim: rgb('d6d5c0'),
    roof: rgb('8d8d81'),
    wood: rgb('839f90'),
    metal: rgb('3b6958'),
    dark: rgb('2d3932'),
  },
  gold = rgb('c6b375'),
  hood = rgb('927b70');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.95, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.18 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
const area = (r) =>
  r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
  2;
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function tri(o, s, ps, target, col = colors[s]) {
  if (normalFor(...ps).reduce((v, n, i) => v + n * target[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  o.addTriangle(
    s,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    col,
  );
}
function Q(o, s, ps, target, col = colors[s]) {
  if (normalFor(...ps).reduce((v, n, i) => v + n * target[i], 0) < 0) ps = [...ps].reverse();
  quad(o, s, ps, normalFor(...ps), col);
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
function panel(o, r, holes, f, s = 'stone', depth = 0, col = colors[s]) {
  const ps = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0)),
    ix = earcut(ps.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => f.p(...ps[j], depth)),
      [f.n[0], 0, f.n[1]],
      col,
    );
}
function cap(o, r, y, s = 'stone', up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function localBox(o, f, s, x, y, z, w, h, depth, col = colors[s]) {
  const b = new Proxy(o, {
    get(t, k) {
      if (k === 'addQuad')
        return (slot, mat, ps, n, uv, c) => {
          const points = ps.map((p) => f.p(...p)),
            normal = [f.u[0] * n[0] + f.n[0] * n[2], n[1], f.u[1] * n[0] + f.n[1] * n[2]];
          t.addQuad(slot, mat, points, normal, uv, c);
        };
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  box(b, s, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], col);
}
function arch(x, y, w, spring, n = 6, pointed = false) {
  const r = [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, spring],
  ];
  if (pointed) {
    for (let i = 1; i <= n; i++) {
      const a = ((i / n) * Math.PI) / 3;
      r.push([x - w / 2 + Math.cos(a) * w, spring + Math.sin(a) * w]);
    }
    for (let i = 1; i <= n; i++) {
      const a = (Math.PI * 2) / 3 + ((i / n) * Math.PI) / 3;
      r.push([x + w / 2 + Math.cos(a) * w, spring + Math.sin(a) * w]);
    }
  } else
    for (let i = 1; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI;
      r.push([x + (Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2]);
    }
  // Exact shared jamb/peak coordinates keep vertically aligned holes stable in Float32.
  r[r.length - 1] = [x - w / 2, spring];
  if (pointed) r[2 + n] = [x, spring + (w * Math.sqrt(3)) / 2];
  return r;
}
function surround(o, r, f, width = 0.07) {
  const xs = r.map((p) => p[0]),
    ys = r.map((p) => p[1]),
    cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2,
    w = Math.max(...xs) - Math.min(...xs),
    h = Math.max(...ys) - Math.min(...ys),
    outer = r.map(([x, y]) => [
      cx + (x - cx) * (1 + (2 * width) / w),
      cy + (y - cy) * (1 + (2 * width) / h),
    ]);
  panel(o, outer, [r], f, 'trim', 0.03);
}
function flatRail(o, f, s, x, y, w, h, col = colors[s]) {
  const r = rect(x, y, w, h);
  panel(o, r, [], f, s, 0.07, col);
  panel(o, r, [], { ...f, n: f.n.map((v) => -v) }, s, 0.03, col);
}
function opening(o, r, f, d, back = -0.3, kind = 'dark') {
  panel(o, r, [], f, kind, back);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ps = [f.p(...a), f.p(...b), f.p(...b, back), f.p(...a, back)];
    quad(o, 'trim', ps, normalFor(...ps), colors.trim);
    if (d === 3)
      beam(
        o,
        'trim',
        f.p(...a, 0.035),
        f.p(...b, 0.035),
        d === 2 ? 0.065 : 0.09,
        0.09,
        colors.trim,
      );
  }
  if (d === 2) surround(o, r, f);
}
function cornice(o, f, d) {
  if (d === 0) return;
  for (const y of [5.35, 12.1, 12.68]) {
    if (d < 3) panel(o, rect(f.len / 2, y, f.len, 0.17), [], f, 'trim', 0.04);
    else localBox(o, f, 'trim', f.len / 2, y, 0.09, f.len + 0.04, 0.17, 0.22);
  }
  if (d < 2) return;
  const n = Math.max(1, Math.floor(f.len / (d === 2 ? 0.95 : 0.58)));
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * f.len) / n,
      w = Math.min(0.25, (f.len / n) * 0.4);
    panel(
      o,
      [
        [x - w, 12.1],
        [x + w, 12.1],
        [x + w * 0.55, 11.8],
        [x, 11.63],
        [x - w * 0.55, 11.8],
      ],
      [],
      f,
      'trim',
      0.055,
    );
  }
}
function oriel(o, f, d, x, y, w, h) {
  const r = rect(x, y, w, h);
  if (d === 0) {
    panel(o, r, [], f, 'wood', 0.035);
    return;
  }
  if (d === 1) {
    localBox(o, f, 'wood', x, y, 0.37, w, h, 0.72);
    panel(o, rect(x, y + 0.1, w - 0.16, h - 0.2), [], f, 'dark', 0.735);
    const ps = [
      f.p(x - w / 2 - 0.1, y + h + 0.95, 0.02),
      f.p(x + w / 2 + 0.1, y + h + 0.95, 0.02),
      f.p(x + w / 2 + 0.1, y + h, 1.02),
      f.p(x - w / 2 - 0.1, y + h, 1.02),
    ];
    Q(o, 'roof', ps, [0, 1, 0], hood);
    return;
  }
  localBox(o, f, 'wood', x, y - 0.12, 0.35, w + 0.22, 0.16, 0.95);
  localBox(o, f, 'wood', x - w / 2, y, 0.35, 0.12, h, 0.95);
  localBox(o, f, 'wood', x + w / 2, y, 0.35, 0.12, h, 0.95);
  panel(o, r, [], f, 'dark', 0.82);
  const columns = d === 1 ? 2 : 3,
    rows = d === 1 ? 3 : d === 2 ? 6 : 12;
  for (let c = 0; c <= columns; c++)
    localBox(o, f, 'wood', x - w / 2 + (w * c) / columns, y, 0.85, 0.08, h, 0.08);
  for (let rr = 0; rr < rows; rr++) {
    const yy = y + 0.15 + ((h - 0.3) * rr) / rows;
    localBox(o, f, 'wood', x, yy, 0.88, w, 0.055, 0.1);
  }
  for (const yy of [y + h * 0.35, y + h * 0.7]) localBox(o, f, 'wood', x, yy, 0.88, w, 0.09, 0.1);
  if (d > 1)
    for (const s of [-1, 1])
      beam(
        o,
        'trim',
        f.p(x + s * w * 0.3, y - 0.65, 0.05),
        f.p(x + s * w * 0.3, y - 0.12, 0.65),
        0.16,
        0.2,
        colors.trim,
      );
  const roof = [
    f.p(x - w / 2 - 0.1, y + h + 0.95, 0.02),
    f.p(x + w / 2 + 0.1, y + h + 0.95, 0.02),
    f.p(x + w / 2 + 0.1, y + h, 1.02),
    f.p(x - w / 2 - 0.1, y + h, 1.02),
  ];
  Q(o, 'roof', roof, [f.n[0] * 0.55, 0.8, f.n[1] * 0.55], hood);
  for (const s of [-1, 1])
    tri(
      o,
      'roof',
      [
        f.p(x + s * (w / 2 + 0.1), y + h, 0),
        f.p(x + s * (w / 2 + 0.1), y + h + 0.95, 0.02),
        f.p(x + s * (w / 2 + 0.1), y + h, 1.02),
      ],
      [f.u[0] * s, 0, f.u[1] * s],
      hood,
    );
}
function balustrade(o, f, x, w, d, y = 5.65) {
  if (d === 0) return;
  if (d < 3) {
    for (const yy of [y, y + 0.87]) flatRail(o, f, 'metal', x, yy, w, 0.1);
    const count = d === 1 ? 3 : 6;
    for (let i = 0; i <= count; i++)
      flatRail(o, f, 'metal', x - w / 2 + (w * i) / count, y, 0.055, 0.95);
    return;
  }
  localBox(o, f, 'metal', x, y, 0.04, w, 0.13, 0.2);
  localBox(o, f, 'metal', x, y + 0.87, 0.06, w, 0.1, 0.16);
  const n = d === 1 ? 3 : d === 2 ? 7 : 12;
  for (let j = 0; j <= n; j++)
    localBox(o, f, 'metal', x - w / 2 + (w * j) / n, y, 0.06, 0.05, 0.95, 0.06);
}
function facade(o, a, b, index, which, d) {
  const f = frame(a, b),
    { len } = f,
    holes = [],
    gallery = (which === 0 && [13, 17].includes(index)) || (which === 1 && [5, 11].includes(index)),
    roundEnd =
      (which === 0 && [2, 4, 6].includes(index)) || (which === 1 && [1, 3].includes(index)),
    n = [1, 1, 2, 8][d];
  if (gallery) {
    const count = Math.max(2, Math.round(len / 3.8));
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * len) / count,
        w = (len / count) * 0.79,
        upper = arch(x, 5.65, w, 11.55 - (w * Math.sqrt(3)) / 2, n, true),
        lower = arch(x, 0.1, w, 4.65 - w / 2, n, false);
      if (d === 0) {
        panel(o, upper, [], f, 'dark', 0.015);
        continue;
      }
      holes.push(upper, lower);
      for (const r of [upper, lower])
        for (let k = 0; k < r.length; k++) {
          const aa = r[k],
            bb = r[(k + 1) % r.length],
            ps = [f.p(...aa), f.p(...bb), f.p(...bb, -0.32), f.p(...aa, -0.32)];
          quad(o, 'trim', ps, normalFor(...ps), colors.trim);
          if (d === 3 && k > 0)
            beam(o, 'trim', f.p(...aa, 0.035), f.p(...bb, 0.035), 0.09, 0.11, colors.trim);
        }
      if (d === 2) for (const r of [upper, lower]) surround(o, r, f);
      balustrade(o, f, x, w, d);
    }
    if (d > 0) {
      panel(o, rect(len / 2, -0.3, len, 13.1), [], f, 'stone', -3.1);
      localBox(o, f, 'trim', len / 2, 5.42, -1.55, len, 0.23, 3.15);
      localBox(o, f, 'trim', len / 2, -0.3, -1.55, len, 0.25, 3.15);
    }
  } else if (roundEnd) {
    const w = Math.min(2.15, len * 0.8);
    for (const [y, h] of [
      [0.9, 3.3],
      [6.25, 4.0],
    ]) {
      const r = rect(len / 2, y, w, h);
      if (d > 0) holes.push(r);
      oriel(o, f, d, len / 2, y, w, h);
    }
  } else if (d > 0 && len > 4.8) {
    const count = Math.max(1, Math.floor(len / (d === 1 ? 13 : d === 2 ? 9 : 6.2)));
    for (let j = 0; j < count; j++)
      for (const y of [1.1, 7.4]) {
        const x = ((j + 0.5) * len) / count,
          r = arch(x, y, 0.98, y + 1.7, n, true);
        if (d === 1) panel(o, r, [], f, 'dark', 0.02);
        else {
          holes.push(r);
          opening(o, r, f, d, -0.25);
        }
        if (d > 1)
          beam(o, 'wood', f.p(x, y, -0.17), f.p(x, y + 1.95, -0.17), 0.065, 0.08, colors.wood);
      }
  }
  panel(o, rect(len / 2, -0.4, len, 13.2), holes, f);
  // Skyline's dark pointed panels sit just outside the simplified solid gallery wall.
  cornice(o, f, d);
  if (d > 1 && gallery)
    for (const x of [0.1, len - 0.1])
      for (let j = 0; j < 5; j++)
        localBox(o, f, 'trim', x, j * 0.34, 0.44 - j * 0.07, 1.25 - j * 0.12, 0.34, 0.95 - j * 0.1);
}
function hip(o, a, b, width, d) {
  const f = frame(a, b),
    p = f.p,
    h = 12.72,
    rise = 2.2,
    run = Math.min(7, f.len * 0.2),
    ps = [
      [
        p(0, h, -width / 2),
        p(f.len, h, -width / 2),
        p(f.len - run, h + rise, 0),
        p(run, h + rise, 0),
      ],
      [
        p(f.len, h, width / 2),
        p(0, h, width / 2),
        p(run, h + rise, 0),
        p(f.len - run, h + rise, 0),
      ],
    ];
  for (const r of ps) Q(o, 'roof', r, [0, 1, 0]);
  tri(o, 'roof', [p(0, h, width / 2), p(0, h, -width / 2), p(run, h + rise, 0)], [0, 1, 0]);
  tri(
    o,
    'roof',
    [p(f.len, h, -width / 2), p(f.len, h, width / 2), p(f.len - run, h + rise, 0)],
    [0, 1, 0],
  );
  if (d > 1)
    for (const x of [f.len * 0.25, f.len * 0.78])
      localBox(o, f, 'stone', x, 14.0, 0, 0.8, 1.65, 0.9);
}
function entrance(o, a, b, width, center, d) {
  const f = frame(a, b),
    x = center,
    top = 12.8,
    peak = 16.5,
    w = width;
  const r = [
    [x - w / 2, top],
    [x + w / 2, top],
    [x, peak],
  ];
  panel(o, r, [], f, 'stone', 0.04);
  for (const z of [0.06, -3.3])
    for (const s of [-1, 1])
      beam(o, 'trim', f.p(x + (s * w) / 2, top, z), f.p(x, peak, z), 0.18, 0.2, colors.trim);
  Q(
    o,
    'roof',
    [f.p(x - w / 2, top, -3.3), f.p(x - w / 2, top, 0), f.p(x, peak, 0), f.p(x, peak, -3.3)],
    [0, 1, 0],
  );
  Q(
    o,
    'roof',
    [f.p(x, peak, -3.3), f.p(x, peak, 0), f.p(x + w / 2, top, 0), f.p(x + w / 2, top, -3.3)],
    [0, 1, 0],
  );
  if (d > 0) {
    const r = arch(x, 0.1, Math.min(3.6, w * 0.6), 4.5, [2, 3, 5, 8][d], true);
    opening(o, r, f, d, 0.08, 'metal');
    if (d > 1)
      for (let y = 0.35; y < 4.3; y += 0.45)
        for (const s of [-1, 1])
          beam(
            o,
            'metal',
            f.p(x + s * 1.55, y, 0.12),
            f.p(x - s * 1.55, y + 0.65, 0.12),
            0.045,
            0.05,
            colors.metal,
          );
  }
}
const circle = (x, y, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
function clock(o, f, d) {
  const n = [12, 24, 40, 64][d],
    x = f.len / 2,
    y = 26.3,
    r = 1.72,
    ring = circle(x, y, r, n),
    inner = circle(x, y, r - 0.07, n);
  panel(o, ring, [], f, 'dark', 0.05);
  panel(o, ring, [inner], f, 'dark', 0.07, gold);
  if (d > 0)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        xx = x + Math.sin(a) * (r - 0.25),
        yy = y + Math.cos(a) * (r - 0.25),
        tx = Math.cos(a),
        ty = -Math.sin(a),
        ry = [Math.sin(a), Math.cos(a)],
        numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'],
        word = numerals[i],
        unit = d === 1 ? 0.035 : 0.028;
      if (d < 3) {
        Q(
          o,
          'dark',
          [
            f.p(xx - 0.035, yy - 0.12, 0.09),
            f.p(xx + 0.035, yy - 0.12, 0.09),
            f.p(xx + 0.035, yy + 0.12, 0.09),
            f.p(xx - 0.035, yy + 0.12, 0.09),
          ],
          [f.n[0], 0, f.n[1]],
          gold,
        );
        continue;
      }
      for (let j = 0; j < word.length; j++) {
        const offset = (j - (word.length - 1) / 2) * 0.13,
          cx = xx + tx * offset,
          cy = yy + ty * offset,
          point = (u, v) => f.p(cx + tx * u + ry[0] * v, cy + ty * u + ry[1] * v, 0.11),
          segments =
            word[j] === 'I'
              ? [[0, -0.12, 0, 0.12]]
              : word[j] === 'V'
                ? [
                    [-0.05, 0.12, 0, -0.12],
                    [0, -0.12, 0.05, 0.12],
                  ]
                : [
                    [-0.05, -0.12, 0.05, 0.12],
                    [-0.05, 0.12, 0.05, -0.12],
                  ];
        for (const [a, b, c, dd] of segments)
          beam(o, 'dark', point(a, b), point(c, dd), unit, unit, gold);
      }
    }
  for (const [angle, length, width] of [
    [0.05, 0.95, 0.11],
    [Math.PI / 2, 1.25, 0.075],
  ]) {
    const end = [x + Math.sin(angle) * length, y + Math.cos(angle) * length],
      v = [Math.cos(angle) * width, -Math.sin(angle) * width];
    tri(
      o,
      'dark',
      [f.p(x - v[0], y - v[1], 0.14), f.p(...end, 0.14), f.p(x + v[0], y + v[1], 0.14)],
      [f.n[0], 0, f.n[1]],
      gold,
    );
  }
}
function tower(o, d) {
  const [x, z] = plan.westClockTowerEstimate.center,
    w = 7,
    r = [
      [x - w / 2, z + w / 2],
      [x + w / 2, z + w / 2],
      [x + w / 2, z - w / 2],
      [x - w / 2, z - w / 2],
    ],
    n = [1, 1, 2, 8][d];
  for (let i = 0; i < 4; i++) {
    const f = frame(r[i], r[(i + 1) % 4]),
      holes = [];
    if (d > 0)
      for (const [y, width, spring, columns] of [
        [4.7, 0.62, 6.35, 2],
        [12.0, 0.67, 13.8, 2],
        [17.1, 0.88, 20.6, 3],
      ])
        for (let j = 0; j < columns; j++) {
          const xx = w / 2 + (j - (columns - 1) / 2) * (width + 0.38),
            rr = arch(xx, y, width, spring, n, true);
          holes.push(rr);
          opening(o, rr, f, d, -0.32);
          if (d > 1)
            for (let yy = y + 0.15; yy < spring; yy += d === 2 ? 0.42 : 0.22)
              localBox(o, f, 'metal', xx, yy, -0.18, width * 0.85, 0.06, 0.09);
        }
    panel(o, rect(w / 2, -0.4, w, 30.4), holes, f);
    clock(o, f, d);
    if (d > 0)
      for (const y of [3.1, 10.4, 15.5, 22.0, 29.2])
        localBox(o, f, 'trim', w / 2, y, 0.07, w + 0.12, 0.16, 0.2);
    for (const xx of [0.55, w / 2, w - 0.55]) localBox(o, f, 'stone', xx, 30, 0, 1.1, 0.85, 0.55);
  }
  cap(o, r, 30, 'stone');
  for (const [xx, zz] of r) {
    const lo = [
      [xx - 0.34, zz - 0.34],
      [xx - 0.34, zz + 0.34],
      [xx + 0.34, zz + 0.34],
      [xx + 0.34, zz - 0.34],
    ];
    box(o, 'trim', [xx - 0.36, 29.2, zz - 0.36], [xx + 0.36, 31.6, zz + 0.36], colors.trim);
    for (let i = 0; i < 4; i++)
      tri(
        o,
        'trim',
        [
          [...lo[i].slice(0, 1), 31.6, lo[i][1]],
          [lo[(i + 1) % 4][0], 31.6, lo[(i + 1) % 4][1]],
          [xx, 32.55, zz],
        ],
        [lo[i][0] - xx, 0, lo[i][1] - zz],
      );
  }
  beam(o, 'dark', [x, 30, z], [x, 40, z], d === 0 ? 0.13 : 0.075, 0.075, colors.trim);
  if (d > 1) {
    const blue = rgb('244d83'),
      yellow = rgb('d3bb53');
    for (let j = 0; j < 3; j++) {
      const xx0 = x + j * 0.72,
        xx1 = x + (j + 1) * 0.72,
        zz0 = z + Math.sin(j * 0.6) * 0.15,
        zz1 = z + Math.sin((j + 1) * 0.6) * 0.15,
        ps = [
          [xx0, 38.7, zz0],
          [xx1, 38.7, zz1],
          [xx1, 37.4, zz1],
          [xx0, 37.4, zz0],
        ];
      Q(o, 'dark', ps, [0, 0, 1], j === 1 ? yellow : blue);
      Q(o, 'dark', ps, [0, 0, -1], j === 1 ? yellow : blue);
    }
  }
}
function fence(o, d) {
  const f = frame([-22.5, 38.4], [25.7, 27]),
    { len } = f;
  for (const [a, b] of [
    [0, len / 2 - 3],
    [len / 2 + 3, len],
  ]) {
    for (const y of [0.3, 1.8]) localBox(o, f, 'metal', (a + b) / 2, y, 0, b - a, 0.1, 0.12);
    if (d === 0) continue;
    const n = Math.ceil((b - a) / (d === 1 ? 3 : d === 2 ? 0.9 : 0.5));
    for (let j = 0; j <= n; j++) {
      const x = a + ((b - a) * j) / n;
      localBox(o, f, 'metal', x, 0, 0, 0.055, 2, 0.07);
      if (d > 1) {
        beam(o, 'metal', f.p(x - 0.12, 1.8), f.p(x, 2.12), 0.05, 0.05, colors.metal);
        beam(o, 'metal', f.p(x, 2.12), f.p(x + 0.12, 1.8), 0.05, 0.05, colors.metal);
      }
    }
  }
}
function build(o, _f, d = 3) {
  for (const [which, c] of plan.components.entries()) {
    const r = c.outline,
      cw = area(r) < 0;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      facade(o, cw ? a : b, cw ? b : a, i, which, d);
    }
    cap(o, r, -0.4, 'stone', false);
    cap(o, r, 12.8);
  }
  hip(o, [-31, 34], [-30, -15], 10.5, d);
  hip(o, [31.1, 21], [9.2, -36], 11.4, d);
  const west = plan.components[0].outline,
    east = plan.components[1].outline;
  const wf = area(west) < 0 ? frame(west[15], west[16]) : frame(west[16], west[15]);
  entrance(
    o,
    wf.p(0, 0).filter((_, i) => i !== 1),
    wf.p(wf.len, 0).filter((_, i) => i !== 1),
    7.8,
    4.2,
    d,
  );
  const ef = area(east) < 0 ? frame(east[8], east[9]) : frame(east[9], east[8]);
  entrance(
    o,
    ef.p(0, 0).filter((_, i) => i !== 1),
    ef.p(ef.len, 0).filter((_, i) => i !== 1),
    ef.len,
    ef.len / 2,
    d,
  );
  tower(o, d);
  fence(o, d);
}
export const barbadosSkyline = (o, f) => build(o, f, 0);
export const barbadosDistrict = (o, f) => build(o, f, 1);
export const barbadosStreet = (o, f) => build(o, f, 2);
export const parliamentBarbadosModel = {
  id: 'parliament_buildings_barbados',
  key: 'parliament_buildings_barbados',
  recipe: 'structure-parliament-buildings-barbados.mjs',
  cell: 'dd/ddm',
  title: 'Parliament Buildings, Barbados',
  category: 'civic-institutional',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Both native coral-limestone neo-Gothic Parliament wings and open V-shaped courtyard: rounded/faceted ends with projecting green shuttered oriels/sloping red-brown hoods/brackets, genuinely open upper pointed galleries and lower round arcades with green balustrades, corbelled parapets, low hipped roofs/gabled courtyard entrances, stepped buttress feet and surviving west square clocktower with four black/gold Roman dials, pointed louvred lights, battlements, corner pinnacles and flagpole. Intrinsic front green iron railings; no vanished east tower or detached neighbors.',
  camera: [107, 61, 133],
  lookAt: [0, 11, 0],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 2.6 },
  qaCameras: [
    { name: 'west-clocktower-and-open-gallery', position: [10, 22, 52], lookAt: [-22, 18, 3] },
    { name: 'rounded-oriels-and-pointed-arcade', position: [-6, 13, 62], lookAt: [-29, 7, 29] },
    { name: 'east-gallery-gable-and-open-courtyard', position: [-22, 18, 38], lookAt: [18, 8, -2] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' A fixed open southern court approach defines approximate groundY0 before terrain acquisition.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-parliament-buildings-barbados.mjs',
    level: 'skyline',
    export: 'barbadosSkyline',
    errorMeters: 3.2,
    surfaces,
    authoredLevels: {
      district: { export: 'barbadosDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'barbadosStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Four exact cleared published QuallaPD-selfdaylight originals control persistent exterior form.13mwall/15mroof,30mclock battlement, tower position within the native west projection, hidden elevation openings, roof sections and fine joinery are photographic medium-fi estimates. No native architectural height/survey or independent tower polygon exists. Clock hands are an authored static display; minute-exact current time/clock mechanics are not claimed.',
    'Full signed wings remain separate; courtyard is open and not a building extrusion. The named east and unnamed government west footprints are associated by site/photographic form/local two-wing story, without inventing a native west name. The clocktower is on the WESTwing; demolished/sunken historical east tower is excluded. Detached Treasury/RBC/other buildings, interiors, roads, fountain, vegetation, people and vehicles are omitted.',
    'Upper pointed and lower round galleries have real openings/reveals, shallow closed backing and walking slabs from district detail onward, with green balustrades. Skyline uses dark pointed panels on a simplified wall and drops fine shutter/corbel/fence detail. Oriel/window recesses, gabled entry decorative gates and flag are closed visual detail, not a traversable interior or exact reproduction of stained-glass/artwork.',
    'Coral stone/trim, green timber/ironwork, muted roof/hood palette and geometric Roman numerals are original shared-surface/mesh authoring, not photographic texture. Small rear windows, buttress feet, fence alignment and flag bands are bounded interpretations; concealed roof additions and temporary work are excluded.',
    'Footings extend.4m below a fixed open southern court approach selected before terrain sampling. Exact stair/foundation/terrain attachment remains approximate and host-dependent. Source relief is retained without a whole-courtyard platform or terrain flattening.',
  ],
};
