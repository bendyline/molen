/** Stonewall Inn: both 51–53 Christopher Street exteriors from local Qualla and official references. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/dr/dr5/stonewall_inn/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  brick = rgb('956955'),
  plaster = rgb('c4c1ad'),
  pale = rgb('d0d1c2'),
  iron = rgb('333934'),
  stone = rgb('9c998a'),
  roof = rgb('777774'),
  glass = rgb('3e504e'),
  neon = rgb('e14b52');
function facing(o, a, x = 0, z = 0) {
  const co = Math.cos(a),
    si = Math.sin(a),
    v = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, uv, c) => o.addTriangle(s, r, p.map(q), v(n), uv, c),
    addQuad: (s, r, p, n, uv, c) => o.addQuad(s, r, p.map(q), v(n), uv, c),
    addConvexPolygon: (s, r, p, n, uv, c) => {
      const pp = p.map(q),
        u = p.map(uv);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => u[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function prism(o, loops, low, high, color = brick, slot = 'wall') {
  const rings = loops.map((r, i) => {
    r = cleanRing(r);
    if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
    const a = r.reduce(
      (s, p, j) => s + p[0] * r[(j + 1) % r.length][1] - r[(j + 1) % r.length][0] * p[1],
      0,
    );
    if (a > 0 !== (i === 0)) r.reverse();
    return r;
  });
  const pts = rings.flat(),
    holes = [];
  let count = 0;
  for (let i = 0; i < rings.length; i++) {
    if (i) holes.push(count);
    count += rings[i].length;
  }
  const indices = earcut(pts.flat(), holes);
  for (const [y, n] of [
    [low, [0, -1, 0]],
    [high, [0, 1, 0]],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      quad(
        o,
        slot,
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        color,
      );
    }
}
function line(o, slot, a, b, w, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    ox = ((-dy / len) * w) / 2,
    oy = ((dx / len) * w) / 2;
  quad(
    o,
    slot,
    [
      [a[0] + ox, a[1] + oy, a[2]],
      [b[0] + ox, b[1] + oy, b[2]],
      [b[0] - ox, b[1] - oy, b[2]],
      [a[0] - ox, a[1] - oy, a[2]],
    ],
    [0, 0, 1],
    color,
  );
}
function clipRear(r, z) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      inside = a[1] >= z,
      next = b[1] >= z;
    if (inside) out.push(a);
    if (inside !== next) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), z]);
    }
  }
  return cleanRing(out);
}
function parapet(o, r, y, d) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const f = facing(o, Math.atan2(b[1] - a[1], a[0] - b[0]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    B(f, 'plaster', 0, y, 0, len, 0.48, 0.23, plaster);
    if (d > 0) B(f, 'stone', 0, y + 0.48, 0, len + 0.06, 0.1, 0.34, pale);
  }
}
function upperWindow(o, x, y, z, w, h, d, rows) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (d < 1) return;
  for (const xx of [-w / 2, w / 2])
    B(o, 'metal', x + xx, y - 0.035, z + 0.025, 0.065, h + 0.07, 0.09, iron);
  for (const yy of [y - 0.035, y + h]) B(o, 'metal', x, yy, z + 0.025, w + 0.08, 0.065, 0.09, iron);
  B(o, 'stone', x, y - 0.12, z + 0.06, w + 0.19, 0.11, 0.2, pale);
  if (d < 2) return;
  face(o, 'metal', x, y, z + 0.08, 0.055, h, iron);
  for (let j = 1; j < rows; j++) face(o, 'metal', x, y + (h * j) / rows, z + 0.085, w, 0.045, iron);
}
function basket(o, x, y, z, w, d) {
  const depth = 0.34,
    n = d > 2 ? 16 : 8;
  for (const yy of [y, y + 0.28]) {
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      beam(
        o,
        'metal',
        [x - (Math.cos(a) * w) / 2, yy, z + Math.sin(a) * depth],
        [x - (Math.cos(b) * w) / 2, yy, z + Math.sin(b) * depth],
        0.032,
        0.034,
        iron,
      );
    }
  }
  if (d > 1)
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI) / n;
      B(
        o,
        'metal',
        x - (Math.cos(a) * w) / 2,
        y,
        z + Math.sin(a) * depth,
        0.025,
        0.29,
        0.025,
        iron,
      );
    }
  for (const xx of [-w * 0.32, w * 0.32]) {
    beam(o, 'metal', [x + xx, y - 0.19, z], [x + xx, y, z + 0.28], 0.04, 0.04, iron);
    if (d > 1) beam(o, 'metal', [x + xx, y, z], [x + xx, y, z + 0.28], 0.035, 0.035, iron);
  }
}
function arch(o, x, y, z, w, stem, rise, d, col = iron) {
  const rr = w / 2,
    points = [
      [x - rr, y, z],
      [x + rr, y, z],
      [x + rr, y + stem, z],
    ],
    n = d > 1 ? 16 : 8;
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    points.push([x + Math.cos(a) * rr, y + stem + Math.sin(a) * rise, z]);
  }
  o.addConvexPolygon('metal', ref, points, [0, 0, 1], (p) => [p[0], p[1]], col);
  if (d < 1) return;
  // A shallow recessed panel with individual radial brick joints around the visible arch.
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    quad(
      o,
      'brick',
      [
        [x + Math.cos(a) * rr, y + stem + Math.sin(a) * rise, z + 0.015],
        [x + Math.cos(b) * rr, y + stem + Math.sin(b) * rise, z + 0.015],
        [x + Math.cos(b) * (rr + 0.17), y + stem + Math.sin(b) * (rise + 0.19), z + 0.015],
        [x + Math.cos(a) * (rr + 0.17), y + stem + Math.sin(a) * (rise + 0.19), z + 0.015],
      ],
      [0, 0, 1],
      brick,
    );
    if (d > 1)
      line(
        o,
        'stone',
        [x + Math.cos(a) * rr, y + stem + Math.sin(a) * rise, z + 0.022],
        [x + Math.cos(a) * (rr + 0.17), y + stem + Math.sin(a) * (rise + 0.19), z + 0.022],
        0.015,
        pale,
      );
  }
  for (const sg of [-1, 1])
    B(o, 'metal', x + sg * (rr - 0.045), y, z + 0.035, 0.075, stem, 0.075, col);
  B(o, 'metal', x, y + stem - 0.04, z + 0.035, w, 0.075, 0.075, col);
  if (d > 1)
    for (let i = 1; i < 5; i++) {
      const a = (i * Math.PI) / 5;
      line(
        o,
        'metal',
        [x, y + stem, z + 0.05],
        [x + Math.cos(a) * rr * 0.93, y + stem + Math.sin(a) * rise * 0.93, z + 0.05],
        0.035,
        iron,
      );
    }
}
function roundedStep(o, x, z, w, d) {
  const points = [
    [x - w / 2, z - 0.05],
    [x + w / 2, z - 0.05],
  ];
  const n = d > 1 ? 14 : 6;
  for (let i = 0; i <= n; i++) {
    const a = (i * Math.PI) / n;
    points.push([x + (Math.cos(a) * w) / 2, z + Math.sin(a) * 0.4]);
  }
  prism(o, [points], -0.15, 0.12, brick, 'brick');
}
function doorPanels(o, x, y, z, w, h, d, { double = false, light = false, solid = false } = {}) {
  const c = light ? pale : iron;
  const count = double ? 2 : 1,
    ww = w / count;
  for (let i = 0; i < count; i++) {
    const xx = x - w / 2 + ww * (i + 0.5);
    face(o, 'metal', xx, y + 0.08, z, ww - 0.08, h - 0.12, c);
    if (d > 1) {
      if (solid) {
        const p = [
          [xx, y + 0.7, z + 0.035],
          [xx + ww * 0.24, y + 1.2, z + 0.035],
          [xx, y + 1.7, z + 0.035],
          [xx - ww * 0.24, y + 1.2, z + 0.035],
        ];
        for (let k = 0; k < 4; k++) line(o, 'metal', p[k], p[(k + 1) % 4], 0.025, rgb('464b43'));
      } else if (light) {
        const ww2 = ww - 0.25,
          hh = h - 0.55;
        face(o, 'glass', xx, y + 0.35, z + 0.015, ww2, hh, glass);
        for (const xx2 of [-ww2 / 2, 0, ww2 / 2])
          face(o, 'metal', xx + xx2, y + 0.35, z + 0.035, 0.05, hh, pale);
        for (let j = 0; j <= 4; j++)
          face(o, 'metal', xx, y + 0.35 + (j * hh) / 4, z + 0.04, ww2, 0.045, pale);
      } else upperWindow(o, xx, y + 0.8, z + 0.015, ww - 0.22, h - 0.97, d, 3);
      face(o, 'metal', xx, y + 0.22, z + 0.025, ww - 0.24, 0.38, light ? stone : rgb('252b28'));
      B(
        o,
        'metal',
        xx + (i === 0 ? 0.2 : -0.2) * ww,
        y + 0.92,
        z + 0.055,
        0.025,
        0.24,
        0.04,
        stone,
      );
    }
  }
}
function display(o, x, y, z, w, h, d, visitor = false) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (d > 0) {
    for (const xx of [-w / 2, w / 2])
      B(o, 'metal', x + xx, y - 0.04, z + 0.02, 0.075, h + 0.08, 0.12, iron);
    for (const yy of [y - 0.04, y + h]) B(o, 'metal', x, yy, z + 0.02, w + 0.08, 0.08, 0.12, iron);
    B(o, 'brick', x, y - 0.17, z + 0.025, w + 0.2, 0.13, 0.25, brick);
  }
  if (d > 2) {
    if (visitor) {
      letters(o, 'STONEWALL', x - w * 0.4, y + h * 0.62, z + 0.09, w * 0.8, h * 0.1, pale);
      letters(o, 'VISITOR CENTER', x - w * 0.42, y + 0.18, z + 0.09, w * 0.84, h * 0.075, pale);
    } else {
      letters(o, 'THE', x - 0.4, y + h * 0.76, z + 0.09, 0.8, 0.19, neon);
      letters(o, 'STONEWALL', x - w * 0.44, y + h * 0.39, z + 0.09, w * 0.88, 0.32, neon);
      letters(o, 'INN', x - 0.35, y + 0.18, z + 0.09, 0.7, 0.21, neon);
    }
  }
}
const glyphs = {
  A: [
    [0, 0, 0.5, 1],
    [0.5, 1, 1, 0],
    [0.2, 0.4, 0.8, 0.4],
  ],
  C: [
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [0, 0.5, 0.8, 0.5],
    [0, 0, 1, 0],
  ],
  H: [
    [0, 0, 0, 1],
    [1, 0, 1, 1],
    [0, 0.5, 1, 0.5],
  ],
  I: [[0.5, 0, 0.5, 1]],
  L: [
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  N: [
    [0, 0, 0, 1],
    [0, 1, 1, 0],
    [1, 0, 1, 1],
  ],
  O: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0.5],
    [1, 0.5, 0, 0.5],
    [0.4, 0.5, 1, 0],
  ],
  S: [
    [1, 1, 0, 1],
    [0, 1, 0, 0.5],
    [0, 0.5, 1, 0.5],
    [1, 0.5, 1, 0],
    [1, 0, 0, 0],
  ],
  T: [
    [0, 1, 1, 1],
    [0.5, 1, 0.5, 0],
  ],
  V: [
    [0, 1, 0.5, 0],
    [0.5, 0, 1, 1],
  ],
  W: [
    [0, 1, 0.25, 0],
    [0.25, 0, 0.5, 0.6],
    [0.5, 0.6, 0.75, 0],
    [0.75, 0, 1, 1],
  ],
};
function letters(o, text, x, y, z, w, h, c) {
  const cw = w / text.length;
  for (let i = 0; i < text.length; i++)
    for (const [a, b, cc, dd] of glyphs[text[i]] ?? [])
      line(
        o,
        'metal',
        [x + i * cw + a * cw * 0.76, y + b * h, z],
        [x + i * cw + cc * cw * 0.76, y + dd * h, z],
        Math.max(0.012, h * 0.055),
        c,
      );
}
function flag(o, x, y, z, lean) {
  const top = [x + lean, y + 0.66, z + 0.16];
  beam(o, 'metal', [x, y - 0.15, z], top, 0.018, 0.018, iron);
  const colors = ['cc4d4e', 'd38b41', 'd6be53', '548957', '4b6fa0', '80608d'];
  for (let i = 0; i < 6; i++) {
    const yy = top[1] - i * 0.07,
      pts = [
        [top[0], yy, z + 0.17],
        [top[0] + 0.32, yy - 0.045, z + 0.23],
        [top[0] + 0.32, yy - 0.115, z + 0.23],
        [top[0], yy - 0.07, z + 0.17],
      ],
      n = normalFor(...pts);
    quad(o, 'flag', pts, n, rgb(colors[i]));
    quad(
      o,
      'flag',
      pts,
      n.map((v) => -v),
      rgb(colors[i]),
    );
  }
}
function lantern(o, x, y, z, d) {
  if (d < 2) return;
  B(o, 'metal', x, y, z + 0.13, 0.13, 0.21, 0.16, iron);
  face(o, 'glass', x, y + 0.025, z + 0.22, 0.09, 0.15, rgb('a9a88a'));
  B(o, 'metal', x, y + 0.21, z + 0.13, 0.2, 0.035, 0.21, iron);
  beam(o, 'metal', [x, y + 0.25, z], [x, y + 0.27, z + 0.15], 0.035, 0.035, iron);
}
function skylight(o, x, z, y, d) {
  B(o, 'metal', x, y, z, 1.12, 0.15, 1.8, iron);
  if (d < 1) return;
  for (const sg of [-1, 1]) {
    const pts = [
      [x + sg * 0.55, y + 0.15, z - 0.86],
      [x + sg * 0.55, y + 0.15, z + 0.86],
      [x, y + 0.45, z + 0.86],
      [x, y + 0.45, z - 0.86],
    ];
    let n = normalFor(...pts);
    if (n[1] < 0) n = n.map((v) => -v);
    quad(o, 'glass', pts, n, glass);
  }
  if (d > 1) beam(o, 'metal', [x, y + 0.45, z - 0.9], [x, y + 0.45, z + 0.9], 0.04, 0.04, iron);
}
function stonewall(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  const west = cleanRing(frame.features[0].rings[0]),
    east = cleanRing(frame.features[1].rings[0]),
    upper = clipRear(east, -7.5);
  prism(o, [west], -2.2, 6.5, brick, 'brick');
  prism(o, [west], 6.5, 6.58, roof, 'roof');
  parapet(o, west, 6.58, d);
  prism(o, [east], -2.2, 3.2, brick, 'brick');
  prism(o, [east], 3.2, 3.28, roof, 'roof');
  prism(o, [upper], 3.28, 7.02, brick, 'brick');
  prism(o, [upper], 7.02, 7.1, roof, 'roof');
  parapet(o, upper, 7.1, d);
  const z = 14.35;
  face(o, 'plaster', -4.621, 3.35, z, 8.3, 3.75, plaster);
  face(o, 'plaster', 3.1, 3.35, z, 7.145, 4.27, pale);
  // Narrow east residential entrance is stucco-faced down to the ground.
  face(o, 'plaster', 6.08, 0, z + 0.01, 1.18, 3.35, pale);
  if (d > 0) {
    B(o, 'stone', -4.621, 7.06, z, 8.4, 0.1, 0.28, pale);
    B(o, 'stone', 3.1, 7.58, z, 7.25, 0.1, 0.28, pale);
    for (const [cx, w] of [
      [-4.621, 8.3],
      [2.51, 5.97],
    ]) {
      B(o, 'stone', cx, -0.02, z, w, 0.1, 0.14, stone);
      B(o, 'brick', cx, 3.16, z + 0.025, w, 0.19, 0.12, brick);
      if (d > 2)
        for (let x = cx - w / 2 + 0.04; x < cx + w / 2; x += 0.09)
          face(o, 'stone', x, 3.17, z + 0.09, 0.012, 0.16, pale);
    }
    for (const x of [-7.15, -4.62, -2.09]) {
      upperWindow(o, x, 4.13, z + 0.025, 1.15, 1.86, d, 5);
      basket(o, x, 3.94, z + 0.1, 1.43, d);
      if (d > 1)
        for (const [off, lean] of [
          [-0.48, -0.16],
          [-0.13, -0.04],
          [0.24, 0.1],
        ])
          flag(o, x + off, 4.05, z + 0.35, lean, d);
    }
    for (const x of [0.48, 2.03, 3.58, 5.13]) {
      upperWindow(o, x, 4.54, z + 0.025, 1.0, 1.83, d, 3);
      basket(o, x, 4.15, z + 0.1, 1.32, d);
    }
    arch(o, -7.62, 0.12, z + 0.035, 1.15, 2.12, 0.55, d);
    doorPanels(o, -7.62, 0.12, z + 0.08, 1.1, 2.08, d, { solid: true });
    arch(o, -1.69, 0.12, z + 0.035, 1.6, 2.12, 0.38, d);
    doorPanels(o, -1.69, 0.12, z + 0.08, 1.52, 2.08, d, { double: true });
    for (const [x, w] of [
      [-7.62, 1.48],
      [-1.69, 1.9],
      [4.48, 1.63],
    ])
      roundedStep(o, x, z, w, d);
    display(o, -4.7, 0.88, z + 0.045, 3.55, 1.45, d);
    display(o, 1.65, 1.0, z + 0.045, 2.9, 1.28, d, true);
    arch(o, 4.48, 0.04, z + 0.035, 1.32, 2.2, 0.34, d);
    doorPanels(o, 4.48, 0.04, z + 0.08, 1.24, 2.16, d, { light: true });
    face(o, 'metal', 6.08, 0.06, z + 0.035, 0.83, 2.94, iron);
    doorPanels(o, 6.08, 0.06, z + 0.08, 0.8, 2.5, d);
    face(o, 'glass', 6.08, 2.67, z + 0.08, 0.66, 0.22, glass);
    if (d > 1) {
      for (const x of [-8.42, -6.74, -2.82, -0.61]) lantern(o, x, 2.65, z + 0.13, d);
      B(o, 'metal', -2.8, 2.08, z + 0.09, 0.42, 0.55, 0.04, iron);
      B(o, 'metal', -0.04, 2.79, z + 0.07, 0.38, 0.43, 0.05, rgb('b65547'));
      B(o, 'metal', -3.02, 0.45, z + 0.1, 0.3, 0.28, 0.16, rgb('527e68'));
      for (const x of [-3.12, -2.92]) B(o, 'metal', x, 0.55, z + 0.2, 0.07, 0.08, 0.09, stone);
      // Scored upper stucco at 51; the 53 surface is smoother in the local photographs.
      for (const y of [3.8, 4.45, 6.48, 7.1])
        face(o, 'plaster', 3.1, y, z + 0.012, 7.1, 0.012, rgb('aaa99a'));
    }
  }
  // Photograph and official report show a western chimney, skylights and modest roof plant.
  B(o, 'plaster', -0.4, 7.1, 8.5, 0.7, 1.25, 0.72, pale);
  B(o, 'metal', -0.4, 8.35, 8.5, 0.87, 0.09, 0.87, iron);
  B(o, 'metal', -0.4, 8.44, 8.5, 0.2, 0.3, 0.2, iron);
  if (d > 0) {
    for (const [x, z] of [
      [1.4, 4],
      [4.5, 1],
      [1.5, -2],
      [4.5, -5],
    ])
      skylight(o, x, z, 7.1, d);
    B(o, 'metal', -1.6, 6.6, 11, 0.9, 0.55, 1.25, stone);
    if (d > 1)
      for (let y = 6.72; y < 7.12; y += 0.07) face(o, 'metal', -1.6, y, 11.635, 0.75, 0.022, iron);
  }
  // Conservative unadorned party walls and a few rear openings; neighboring buildings excluded.
  if (d > 1) {
    const rear = facing(o, Math.PI, 0, -9.21);
    for (const x of [3, 6]) upperWindow(rear, x, 3.8, 0.035, 0.75, 1.45, d, 3);
  }
}
export function stonewallSkyline(o) {
  stonewall(o, undefined, 0);
}
export function stonewallDistrict(o) {
  stonewall(o, undefined, 1);
}
export function stonewallStreet(o) {
  stonewall(o, undefined, 2);
}
const surfaces = {
  brick: { ...landmarkSurfaces.brick },
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  stone: { ...landmarkSurfaces.stone },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.9, metallic: 0 },
  metal: { ...landmarkSurfaces.metal },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
  flag: { slot: 'trim', localRef: 'palette:#fefefe', roughness: 0.95, metallic: 0 },
};
export const stonewallModel = {
  id: 'stonewall_inn',
  recipe: 'structure-stonewall-inn.mjs',
  key: 'stonewall_inn',
  cell: 'dr/dr5',
  title: 'Stonewall Inn',
  brief:
    'Both former stable buildings at 51–53 Christopher Street: brick storefront arches, contrasting stucco upper facades, three/four casement bays, curved iron baskets, stepped parapets and current visitor-center entrance.',
  camera: [22, 15, 40],
  lookAt: [0, 3.5, 0],
  qaCameras: [
    { name: 'front', position: [0, 6, 40], lookAt: [0, 3.6, 8] },
    { name: 'back', position: [-22, 20, -34], lookAt: [0, 3, 0] },
  ],
  build: stonewall,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: 'Christopher Street sidewalk [-1.8,15.1], independent terrain unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-stonewall-inn.mjs',
    level: 'skyline',
    export: 'stonewallSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels: {
      district: { export: 'stonewallDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'stonewallStreet', errorMeters: 0.06, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior of 51–53 Christopher Street, using individually inspected local 2014/2016 photos, official city designation photo/map and current NPS visitor-center photograph. No exact 1969 reconstruction.',
    'Both individual mapped footprints are retained; taller neighboring buildings, interiors, crowds and temporary banners are excluded.',
    'Vertical dimensions and hidden rear/roof details are approximations. The 51 rear-wing upper-story termination, skylight spacing and equipment positions are interpreted from limited evidence.',
    'Small pride flags, window baskets, lanterns and storefront lettering are simplified original geometry. The red sign is colored geometry, not a physically simulated neon tube. No photo pixels or official visitor-center logos are embedded.',
    'Map heights are coarse controls, with parapets interpreted from facade photographs. Independent terrain is unchanged; exact contact can differ with another host DEM.',
  ],
};
