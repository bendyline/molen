/** Historic1913hotel ensemble: full three-block scope with explicit reconstructed secondary sections. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/69/69p/bristol_hotel_mar_del_plata/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  wall: rgb('d7cfb9'),
  trim: rgb('c6bdab'),
  wood: rgb('51483f'),
  roof: rgb('50575a'),
  metal: rgb('70756f'),
  glass: rgb('647678'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.96, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.34, metallic: 0.07 },
};
function T(o, s, p, n, color = C[s]) {
  if (n && normalFor(...p).reduce((a, v, i) => a + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  const normal = normalFor(...p),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, p, normal, p.map(uv), color);
}
function Q(o, s, p, n, color = C[s]) {
  T(o, s, [p[0], p[1], p[2]], n, color);
  T(o, s, [p[0], p[2], p[3]], n, color);
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
const outline = (x, z, w, depth) => [
  [x - w / 2, z - depth / 2],
  [x - w / 2, z + depth / 2],
  [x + w / 2, z + depth / 2],
  [x + w / 2, z - depth / 2],
];
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
function panel(o, s, boundary, holes, f, depth = 0) {
  const pts = [boundary, ...holes].flat(),
    starts = holes.map(
      (_, i) => boundary.length + holes.slice(0, i).reduce((a, h) => a + h.length, 0),
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
function cap(o, s, r, y, up = true) {
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function solid(o, s, x, y, z, w, h, depth, color = C[s]) {
  const r = outline(x, z, w, depth);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4,
      f = frame(r[i], r[k]);
    Q(
      o,
      s,
      [f.p(0, y), f.p(f.len, y), f.p(f.len, y + h), f.p(0, y + h)],
      [f.n[0], 0, f.n[1]],
      color,
    );
  }
  const q = r.map((p) => [p[0], y + h, p[1]]);
  Q(o, s, q, [0, 1, 0], color);
  Q(
    o,
    s,
    q.map((p) => [p[0], y, p[2]]),
    [0, -1, 0],
    color,
  );
}
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
function glazed(o, f, h, d) {
  if (h.physical === false) {
    panel(o, 'glass', h.r, [], f, 0.015);
    return;
  }
  const depth = d ? -0.24 : -0.12;
  panel(o, 'glass', h.r, [], f, depth);
  for (let i = 0; i < h.r.length; i++) {
    const k = (i + 1) % h.r.length;
    Q(o, 'trim', [f.p(...h.r[i]), f.p(...h.r[k]), f.p(...h.r[k], depth), f.p(...h.r[i], depth)]);
  }
  if (d > 1) {
    for (const sign of [-1, 1])
      panel(
        o,
        'trim',
        rect(h.x + sign * (h.w / 2 + 0.1), h.y, 0.18, h.h - (h.arch ? h.w / 2 : 0)),
        [],
        f,
        0.09,
      );
    panel(o, 'trim', rect(h.x, h.y - 0.13, h.w + 0.35, 0.17), [], f, 0.13);
    panel(o, 'metal', rect(h.x, h.y + 0.1, 0.075, h.h - 0.2), [], f, -0.12);
    panel(o, 'metal', rect(h.x, h.y + h.h * 0.55, h.w - 0.1, 0.07), [], f, -0.12);
  }
}
function building(o, x, z, w, depth, height, kind, d) {
  const ring = outline(x, z, w, depth);
  cap(o, kind === 'tudor' ? 'trim' : 'wall', ring, -1, false);
  cap(o, 'roof', ring, height);
  for (let j = 0; j < 4; j++) {
    const f = frame(ring[j], ring[(j + 1) % 4]),
      front = f.n[1] > 0.9,
      holes = [],
      count = Math.max(1, Math.round(f.len / (kind === 'tudor' ? 5.6 : 5.8))),
      step = f.len / count;
    const rows =
      kind === 'tudor'
        ? [
            [0.6, 2.8],
            [4.8, 2.3],
            [8.5, 2.2],
          ].filter((r) => r[0] + r[1] < height - 0.3)
        : kind === 'public'
          ? [
              [0.7, 3.1],
              [5.2, 2.7],
            ]
          : [
              [0.7, 2.7],
              [4.6, 2.7],
              [8.5, 2.7],
              [12.4, 2.3],
            ];
    if (d === 0) {
      if (front && kind === 'tudor' && w > 40)
        for (const xx of [f.len * 0.3, f.len * 0.5, f.len * 0.7])
          holes.push({ x: xx, y: 0.6, w: 2.3, h: 2.8, arch: true, r: arch(xx, 0.6, 2.3, 2.8, 4) });
    } else
      for (let i = 0; i < count; i++) {
        if (d === 1 && i % 2) continue;
        for (const [y, h] of rows) {
          if (d === 1 && y > 3 && y < 8) continue;
          const xx = (i + 0.5) * step,
            ww = Math.min(step * 0.47, kind === 'public' ? 2.8 : 2.1),
            ar = y < 3 && (front || kind === 'public');
          holes.push({
            x: xx,
            y,
            w: ww,
            h,
            arch: ar,
            r: ar ? arch(xx, y, ww, h, [4, 4, 6, 10][d]) : rect(xx, y, ww, h),
          });
        }
      }
    if (kind === 'annex' && depth > 80 && f.n[0] > 0.9) {
      for (let i = holes.length - 1; i >= 0; i--)
        if (holes[i].y < 4 && Math.abs(holes[i].x - f.len / 2) < 4) holes.splice(i, 1);
      holes.push({
        x: f.len / 2,
        y: 0.1,
        w: 3,
        h: 4,
        arch: true,
        doorway: true,
        r: arch(f.len / 2, 0.1, 3, 4, 10),
      });
    }
    for (const h of holes)
      h.physical =
        d === 0 ||
        d === 3 ||
        h.doorway ||
        (d === 1 ? kind === 'tudor' && w > 40 && front && h.arch : kind !== 'annex');
    if (kind === 'tudor') {
      panel(
        o,
        'trim',
        rect(f.len / 2, -1, f.len, 5.2),
        holes.filter((h) => h.physical && h.y < 4.2).map((h) => h.r),
        f,
      );
      panel(
        o,
        'wall',
        rect(f.len / 2, 4.2, f.len, height - 4.2),
        holes.filter((h) => h.physical && h.y >= 4.2).map((h) => h.r),
        f,
      );
    } else
      panel(
        o,
        'wall',
        rect(f.len / 2, -1, f.len, height + 1),
        holes.filter((h) => h.physical).map((h) => h.r),
        f,
      );
    for (const h of holes) glazed(o, f, h, d);
    if (d > 0) {
      for (const y of kind === 'tudor'
        ? [4.2, 7.9, height - 0.15]
        : kind === 'public'
          ? [4.5, height - 0.25]
          : [3.9, 7.8, 11.7, height - 0.3])
        panel(o, kind === 'tudor' ? 'wood' : 'trim', rect(f.len / 2, y, f.len, 0.17), [], f, 0.11);
      if (d > 1) {
        for (let i = 0; i <= count; i++) {
          const xx = Math.min(f.len - 0.12, Math.max(0.12, i * step));
          if (kind === 'tudor') {
            panel(o, 'wood', rect(xx, 4.2, 0.15, height - 4.2), [], f, 0.12);
            if (d === 3 && i < count) {
              const a = f.p(xx, 4.4, 0.13),
                b = f.p(Math.min(f.len - 0.1, xx + step * 0.5), 7.65, 0.13);
              beam(o, 'wood', a, b, 0.11, 0.1, C.wood);
            }
          } else {
            panel(o, 'trim', rect(xx, 0.1, 0.23, height - 0.5), [], f, 0.1);
            if (d === 3)
              for (const y of [0.1, height - 0.65])
                panel(o, 'trim', rect(xx, y, 0.5, 0.4), [], f, 0.16);
          }
        }
        if (d === 3 && kind === 'public')
          for (let i = 0; i < count; i++) {
            const xx = (i + 0.5) * step;
            panel(
              o,
              'trim',
              [
                [xx - 1.9, 8.4],
                [xx + 1.9, 8.4],
                [xx, 9.1],
              ],
              [],
              f,
              0.16,
            );
          }
      }
    }
  }
  return ring;
}
function gableRoof(o, x, z, w, depth, eave, ridge) {
  const a = [x - w / 2, z - depth / 2],
    b = [x - w / 2, z + depth / 2],
    c = [x + w / 2, z + depth / 2],
    dd = [x + w / 2, z - depth / 2],
    l = [x - w / 2, ridge, z],
    r = [x + w / 2, ridge, z];
  Q(o, 'roof', [[a[0], eave, a[1]], [dd[0], eave, dd[1]], r, l], [0, 1, 0]);
  Q(o, 'roof', [[b[0], eave, b[1]], l, r, [c[0], eave, c[1]]], [0, 1, 0]);
  T(o, 'wall', [[a[0], eave, a[1]], l, [b[0], eave, b[1]]], [-1, 0, 0]);
  T(o, 'wall', [[dd[0], eave, dd[1]], [c[0], eave, c[1]], r], [1, 0, 0]);
}
function flatFrontBeam(o, slot, a, b, width, _depth, color) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = ((-(b[1] - a[1]) / len) * width) / 2,
    dy = (((b[0] - a[0]) / len) * width) / 2;
  Q(
    o,
    slot,
    [
      [a[0] + dx, a[1] + dy, a[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [a[0] - dx, a[1] - dy, a[2]],
    ],
    [0, 0, 1],
    color,
  );
}
function crossGable(o, x, z, w, length, eave, ridge, d) {
  const frontBeam = d === 3 ? beam : flatFrontBeam;
  const front = z + length / 2,
    back = z - length / 2;
  T(
    o,
    'wall',
    [
      [x - w / 2, eave, front],
      [x + w / 2, eave, front],
      [x, ridge, front],
    ],
    [0, 0, 1],
  );
  T(
    o,
    'wall',
    [
      [x + w / 2, eave, back],
      [x - w / 2, eave, back],
      [x, ridge, back],
    ],
    [0, 0, -1],
  );
  Q(
    o,
    'roof',
    [
      [x - w / 2, eave, back],
      [x - w / 2, eave, front],
      [x, ridge, front],
      [x, ridge, back],
    ],
    [0, 1, 0],
  );
  Q(
    o,
    'roof',
    [
      [x + w / 2, eave, front],
      [x + w / 2, eave, back],
      [x, ridge, back],
      [x, ridge, front],
    ],
    [0, 1, 0],
  );
  if (d > 0) {
    for (const [a, b] of [
      [
        [-w / 2, eave],
        [0, ridge],
      ],
      [
        [0, ridge],
        [w / 2, eave],
      ],
      [
        [-w / 2, eave],
        [w / 2, eave],
      ],
      [
        [0, eave],
        [0, ridge],
      ],
    ])
      frontBeam(
        o,
        'wood',
        [x + a[0], a[1], front + 0.06],
        [x + b[0], b[1], front + 0.06],
        d === 1 ? 0.2 : 0.16,
        0.12,
        C.wood,
      );
    if (d > 1) {
      const y = eave + (ridge - eave) * 0.45;
      for (const sg of [-1, 1]) {
        frontBeam(
          o,
          'wood',
          [x + sg * w * 0.3, eave + 0.2, front + 0.06],
          [x, y, front + 0.06],
          0.12,
          0.1,
          C.wood,
        );
        frontBeam(
          o,
          'wood',
          [x, y, front + 0.06],
          [x + sg * w * 0.15, ridge - 1, front + 0.06],
          0.12,
          0.1,
          C.wood,
        );
      }
      frontBeam(
        o,
        'wood',
        [x - w * 0.31, y, front + 0.06],
        [x + w * 0.31, y, front + 0.06],
        0.14,
        0.12,
        C.wood,
      );
    }
  }
}
function hip(o, x, z, w, depth, bottom, top, ratio = 0.64) {
  const a = outline(x, z, w, depth),
    b = outline(x, z, w * ratio, depth * ratio);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    Q(
      o,
      'roof',
      [
        [...a[i].slice(0, 1), bottom, a[i][1]],
        [a[k][0], bottom, a[k][1]],
        [b[k][0], top, b[k][1]],
        [b[i][0], top, b[i][1]],
      ],
      [0, 1, 0],
    );
  }
  cap(o, 'roof', b, top);
}
function pyramid(o, x, z, w, depth, bottom, top) {
  const r = outline(x, z, w, depth);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    T(
      o,
      'roof',
      [
        [r[i][0], bottom, r[i][1]],
        [r[k][0], bottom, r[k][1]],
        [x, top, z],
      ],
      [0, 1, 0],
    );
  }
}
function rails(o, a, b, y, d, slot = 'wood') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.max(1, Math.round(len / [9, 5, 4.5, 1.35][d]));
  beam(o, slot, [a[0], y + 1.05, a[1]], [b[0], y + 1.05, b[1]], 0.09, 0.09, C[slot]);
  if (d > 1) beam(o, slot, [a[0], y + 0.18, a[1]], [b[0], y + 0.18, b[1]], 0.07, 0.07, C[slot]);
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = a[0] + t * (b[0] - a[0]),
      z = a[1] + t * (b[1] - a[1]);
    beam(o, slot, [x, y, z], [x, y + 1.05, z], 0.075, 0.075, C[slot]);
  }
}
function tudor(o, v, d, main = false) {
  const [x, z] = v.center,
    { width: w, depth, eave, ridge, frontGables: n } = v;
  building(o, x, z, w, depth, eave, 'tudor', d);
  gableRoof(o, x, z, w + 0.5, depth + 0.6, eave, ridge);
  for (let i = 0; i < n; i++)
    crossGable(
      o,
      x - w / 2 + ((i + 0.5) * w) / n,
      z + depth / 2 - 3,
      (w / n) * 0.94,
      7.1,
      eave,
      ridge,
      d,
    );
  if (d > 0)
    for (const y of main ? [4.3, 8.1] : [4.3]) {
      solid(o, 'wood', x, y, z + depth / 2 + 0.48, w - 0.8, 0.17, 1.4);
      rails(
        o,
        [x - w / 2 + 0.4, z + depth / 2 + 1.15],
        [x + w / 2 - 0.4, z + depth / 2 + 1.15],
        y + 0.17,
        d,
      );
      if (d > 1) {
        for (let i = 0; i <= n * 2; i++) {
          if (d === 2 && i !== 0 && i !== n * 2) continue;
          const xx = x - w / 2 + 0.6 + (i * (w - 1.2)) / (n * 2);
          beam(
            o,
            'wood',
            [xx, y - 0.9, z + depth / 2],
            [xx, y, z + depth / 2 + 1.12],
            0.13,
            0.13,
            C.wood,
          );
        }
      }
    }
  if (main) {
    for (const off of [-10, 10]) {
      solid(o, 'wall', x + off, 11.6, z - 3, 3.6, 5.1, 3.6);
      pyramid(o, x + off, z - 3, 4.5, 4.5, 16.7, 21.6);
      if (d > 1) {
        solid(o, 'metal', x + off, 21.6, z - 3, 0.12, 1.0, 0.12);
        for (const sg of [-1, 1]) {
          const f = frame([x + off + sg * 1.81, z - 4.8], [x + off + sg * 1.81, z - 1.2]);
          panel(o, 'glass', rect(1.8, 14.6, 1, 1.1), [], f, sg < 0 ? 0.025 : -0.025);
        }
      }
    }
    const door = frame(
      [x - w / 2 + 0.9, z + depth / 2 + 2.6],
      [x - w / 2 + 6.6, z + depth / 2 + 2.6],
    );
    const r = arch(2.85, 0.1, 2.25, 3.9, [4, 5, 8, 12][d]);
    panel(o, 'trim', rect(2.85, -0.3, 5.7, 4.6), [r], door);
    glazed(o, door, { x: 2.85, y: 0.1, w: 2.25, h: 3.9, r, arch: true }, d);
    pyramid(o, x - w / 2 + 3.75, z + depth / 2 + 1.2, 6.4, 3.4, 4.3, 5.9);
  }
  if (d > 1)
    for (const off of [-w * 0.31, w * 0.31]) {
      solid(o, 'trim', x + off, ridge - 1.1, z - 2, 0.9, 2.3, 1.2);
      solid(o, 'trim', x + off, ridge + 1.2, z - 2, 1.1, 0.23, 1.4);
    }
}
function veranda(o, x, z, w, depth, d) {
  const y = 0.13;
  solid(o, 'trim', x, y - 0.23, z, w, 0.23, depth);
  solid(o, 'metal', x, 3.55, z, w + 0.3, 0.18, depth + 0.25, rgb('c5c1ac'));
  const r = outline(x, z, w, depth);
  for (let j = 0; j < 4; j++) {
    const f = frame(r[j], r[(j + 1) % 4]);
    if (d === 0) {
      beam(o, 'metal', f.p(0, y, 0.06), f.p(0, 3.55, 0.06), 0.12, 0.12, C.metal);
      continue;
    }
    const count = Math.max(1, Math.ceil(f.len / [12, 8, 3.6, 2.4][d])),
      step = f.len / count;
    for (let i = 0; i < count; i++) {
      panel(o, 'glass', rect((i + 0.5) * step, 0.35, step - 0.15, 2.95), [], f);
      if (d > 1) panel(o, 'metal', rect((i + 0.5) * step, 1.78, step - 0.1, 0.09), [], f, 0.08);
    }
    for (let i = 0; i <= count; i++) {
      const a = f.p(i * step, y, 0.06),
        b = f.p(i * step, 3.55, 0.06);
      beam(o, 'metal', a, b, 0.12, 0.12, C.metal);
    }
  }
}
function publicHalls(o, d) {
  const v = plan.components.publicHalls,
    [x, z] = v.center;
  for (const [a, b, w, depth] of [
    [x, z - 36, 84, 16],
    [x - 34, z, 16, 56],
    [x + 34, z, 16, 56],
  ]) {
    building(o, a, b, w, depth, 9, 'public', d);
    solid(o, 'trim', a, 9, b, w + 0.5, 0.55, depth + 0.5);
    hip(o, a, b, w + 0.4, depth + 0.4, 9.55, 11, 0.76);
  }
  for (const xx of [-34, 0, 34]) {
    solid(o, 'wall', x + xx, 9, z - 36, 13, 4.4, 14);
    hip(o, x + xx, z - 36, 13.4, 14.4, 13.4, 16.2, 0.62);
    if (d > 0) {
      const f = frame([x + xx - 6.5, z - 28.9], [x + xx + 6.5, z - 28.9]);
      const ar = arch(6.5, 10, 4, 3, [4, 5, 8, 12][d]);
      panel(o, 'glass', ar, [], f, 0.04);
      panel(o, 'trim', arch(6.5, 9.8, 4.6, 3.5, [4, 5, 8, 12][d]), [ar], f, 0.12);
    }
  }
  veranda(o, x, z + 33, 84, 10, d);
  veranda(o, x - 44, z + 2, 4, 54, d);
  veranda(o, x + 44, z + 2, 4, 54, d);
  if (d > 0) {
    rails(o, [x - 39, z + 39], [x - 7, z + 39], 0.13, d, 'metal');
    rails(o, [x + 7, z + 39], [x + 39, z + 39], 0.13, d, 'metal');
  }
  if (d > 1) {
    for (const sg of [-1, 1]) {
      solid(o, 'trim', x + sg * 6.6, -0.3, z + 39, 1.2, 2.2, 1.2);
      solid(o, 'trim', x + sg * 6.6, 1.9, z + 39, 1.55, 0.3, 1.55);
    }
    for (let i = 0; i < 3; i++)
      solid(o, 'trim', x, -0.4 + i * 0.14, z + 38.8 - i * 0.35, 11, 0.14, 2.1 - i * 0.35);
  }
}
function annex(o, d) {
  const v = plan.components.guestAnnex;
  for (const name of ['eastBar', 'northReturn', 'southReturn']) {
    const a = v[name],
      [x, z] = a.center;
    building(o, x, z, a.width, a.depth, 15.6, 'annex', d);
    hip(o, x, z, a.width + 0.4, a.depth + 0.4, 15.6, 21, 0.68);
    if (d > 0) {
      const r = outline(x, z, a.width, a.depth);
      for (let j = 0; j < 4; j++) {
        const f = frame(r[j], r[(j + 1) % 4]);
        if (f.len < 30) continue;
        const count = Math.max(1, Math.round(f.len / [16, 14, 10, 6.4][d]));
        for (let i = 0; i < count; i++) {
          const xx = ((i + 0.5) * f.len) / count,
            face = rect(xx, 16.2, 1.8, 2.5);
          panel(
            o,
            'trim',
            [
              [xx - 1.2, 16],
              [xx + 1.2, 16],
              [xx + 1.2, 18.8],
              [xx, 19.9],
              [xx - 1.2, 18.8],
            ],
            [face],
            f,
            0.2,
          );
          panel(o, 'glass', face, [], f, 0.04);
        }
      }
    }
  }
  for (const z of [81, 119, 157]) {
    solid(o, 'wall', -66, 15, z, 15, 3.8, 13);
    hip(o, -66, z, 15.5, 13.5, 18.8, 23.5, 0.63);
    if (d > 1) solid(o, 'metal', -66, 23.5, z, 0.16, 1, 0.16);
  }
  const f = frame([-59.8, 126], [-59.8, 112]),
    ar = arch(7, 0.1, 3, 4, 10);
  panel(o, 'trim', rect(7, -0.3, 6, 4.7), [ar], f, 0.12);
  glazed(o, f, { x: 7, y: 0.1, w: 3, h: 4, arch: true, r: ar }, d);
}
function build(o, _frame, d = 3) {
  tudor(o, plan.components.lodgingHouse, d, true);
  tudor(o, plan.components.rivadaviaLodgingWing, d);
  tudor(o, plan.components.sanMartinLodgingWing, d);
  publicHalls(o, d);
  annex(o, d);
}
export const bristolHotelSkyline = (o, f) => build(o, f, 0);
export const bristolHotelDistrict = (o, f) => build(o, f, 1);
export const bristolHotelStreet = (o, f) => build(o, f, 2);
export const bristolHotelMarDelPlataModel = {
  id: 'bristol_hotel_mar_del_plata',
  key: 'bristol_hotel_mar_del_plata',
  recipe: 'structure-bristol-hotel-mar-del-plata.mjs',
  cell: '69/69p',
  title: 'Bristol Hotel, Mar del Plata',
  category: 'hotel-commercial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief:
    'Full historical1913three-block hotel ensemble: original four-gable timber-grid lodging house/two pyramidal turrets/open balconies and related lodging wings; separate ItalianateUpublic halls/real open high courtyard/low glazed veranda/pavilions; separate four-floor academicistUguest annex/mansard/three frontal pavilions. Three exact published Qualla1899/1913PDoriginals, current street-vector registration and archival text; counterpart wings/annex details and metric positions/section approximate.',
  camera: [260, 165, 340],
  lookAt: [-35, 8, 65],
  portableGroundY: -1.5,
  mediumFiContext: { scale: 1.4, groundY: -1.5 },
  qaCameras: [
    {
      name: 'original-tudor-lodging-house-four-gables-balconies-and-two-turrets',
      position: [52, 29, 72],
      lookAt: [0, 8, 21],
    },
    {
      name: 'half-timber-tracery-real-arched-base-and-open-balconies',
      position: [27, 14, 49],
      lookAt: [8, 8, 34],
    },
    {
      name: 'separate-public-u-halls-open-courtyard-and-low-glazed-terrace',
      position: [85, 62, 218],
      lookAt: [0, 7, 119],
    },
    {
      name: 'third-block-academicist-guest-annex-mansard-and-three-pavilions',
      position: [-18, 43, 186],
      lookAt: [-92, 9, 123],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    'Independent512mraw urban field frozen before geometry at fixed reconstructed old-house dry approach. Current original street intersections register approximate historic blocks; building corners/1913thresholds/relative floors/shoreline not surveyed or fitted.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bristol-hotel-mar-del-plata.mjs',
    level: 'skyline',
    export: 'bristolHotelSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'bristolHotelDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'bristolHotelStreet', errorMeters: 0.55, surfaces },
    },
  },
  limitations: [
    'Historical1913only; no default current eligibility. Full three-block scope retained: original mainTudorhouse/related1904and1908lodging wings, separate pre1920sUpublic/dining block and separate post1910four-floor academicist guest annex. No modern Bristol Center or same-name modern hotel. Exact additional-wing/annex details/census are bounded reconstructions, not photographically verified replicas.',
    'Three exact already-published Qualla mechanical originals inspected:1899Carnaghi y Moodypublic overview/terrace, and uncredited original-house plate in WJHolland1913NewYorkbook. Exact nativeSHA1s, named periodical/BNEissue/PD-AR-Photo/PD-US-expired grants and UC-library1913USNOT_IN_COPYRIGHTbook metadata/plate caption bound. No creator invented, media metadata untouched, questionable circa1930Kohlmann/anonymous web photos unused, no supplemental photo/copied pixels/generated bitmap.',
    'Photo-established main-house four front gables, timber grid/representative geometric tracery, three floors over arched masonry base, upper projecting balconies, steep slate roofs/two text-documented pyramidal turrets retained. Main45x28mcomes from secondary description; exact floor heights, turret positions, return roof junctions, exposed back/extra lodging houses and neutral historic colors estimated.',
    'PublicUblock preserves clear high courtyard, long low glazed own terrace/verandas and distinct pale Italianate two-level halls/roof pavilions. Selected1899form represents pre1920sinfill;1909minor alterations not individually surveyed. Annex French academicist facade, four guest floors after1910, mansard and three principal pavilion masses follow historical text; its own photographic exterior and metric corners unavailable. No claim of full-period photographic coverage.',
    'Current original native lodging-block intersections and EntreRios vector set signed placement frame; modern roads/shoreline cannot certify historic demolished footprints. Dining/annex block geometry, native text conflicts about triangular third block, component separations and exact1913relative floors explicit estimates. No parcel extrusion, streets/plaza/beach/terrain scenery or underground tunnel interiors.',
    'Independent raw terrain/approach remain unchanged without clipping, fitting or flattening. Composite urban heights do not certify historic sidewalk/basement/threshold contact;1mdeep intrinsic bases/short own steps approximate. Review ground/synthetic context are fixtures. No flags/signs/logos, people/carriages/cars/trees/fences or site platforms.',
  ],
};
