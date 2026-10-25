/** Original Lisboa complex: native parent plans, white tracery and three open roof crowns. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import {
  beam,
  cross,
  loft,
  normalFor,
  radialRing,
  sphere,
  torus,
} from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/we/web/casino_lisboa_macau/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
    orange: rgb('d59d3d'),
    white: rgb('e8e8de'),
    roof: rgb('e5e6dc'),
    glass: rgb('4b6068'),
    gold: rgb('c6a448'),
    aqua: rgb('8ecac3'),
    dark: rgb('3f4846'),
    stone: rgb('bbb9a7'),
  },
  cream = rgb('d7cfb6'),
  curtain = rgb('aab4b1');
const surfaces = {
  orange: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  white: { slot: 'trim', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.08 },
  glass: { slot: 'window', localRef: ref, roughness: 0.62, metallic: 0.1 },
  gold: { slot: 'trim', localRef: ref, roughness: 0.62, metallic: 0.1 },
  aqua: { slot: 'roof', localRef: ref, roughness: 0.62, metallic: 0.1 },
  dark: { slot: 'door', localRef: ref, roughness: 0.62, metallic: 0.1 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
};
function tri(o, s, p, h, col = C[s]) {
  const q = p.map((p) => p.map(Math.fround)),
    n = cross(
      q[1].map((v, i) => v - q[0][i]),
      q[2].map((v, i) => v - q[0][i]),
    );
  if (Math.hypot(...n) < 1e-10) return;
  if (n.reduce((v, x, i) => v + x * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[1] + p[2]]),
    col,
  );
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
const B = (o, s, x, y, z, w, h, d, col = C[s]) =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], col);
const area = (q) =>
  q.reduce((s, p, i) => {
    const b = q[(i + 1) % q.length];
    return s + p[0] * b[1] - b[0] * p[1];
  }, 0) / 2;
const canonical = (q) => (area(q) < 0 ? q.toReversed() : q);
function face(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
function panel(o, f, s, r, holes = [], z = 0, col = C[s]) {
  const ps = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0)),
    ix = earcut(ps.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => f.p(...ps[j], z)),
      [f.n[0], 0, f.n[1]],
      col,
    );
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function oct(x, y, w, h, c = 0.22) {
  const a = Math.min(c, w * 0.22, h * 0.22),
    l = x - w / 2,
    r = x + w / 2,
    t = y + h;
  return [
    [l + a, y],
    [r - a, y],
    [r, y + a],
    [r, t - a],
    [r - a, t],
    [l + a, t],
    [l, t - a],
    [l, y + a],
  ];
}
function cap(o, s, q, y, up = true, col = C[s]) {
  const ix = earcut(q.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [q[j][0], y, q[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, poly, y0, y1, d, wall = null) {
  const q = canonical(poly);
  for (let j = 0; j < q.length; j++) {
    const f = face(q[j], q[(j + 1) % q.length]);
    if (wall) wall(f, j);
    else panel(o, f, s, rect(f.len / 2, y0, f.len, y1 - y0));
  }
  cap(o, s, q, y1);
  if (d === 3) cap(o, s, q, y0, false);
}
function localBox(o, f, s, x, y, z, w, h, depth, col = C[s]) {
  const p = [
      f.p(x - w / 2, y, z - depth / 2),
      f.p(x + w / 2, y, z - depth / 2),
      f.p(x + w / 2, y, z + depth / 2),
      f.p(x - w / 2, y, z + depth / 2),
    ],
    top = p.map((p) => [p[0], p[1] + h, p[2]]);
  for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4;
    const a = [p[j], p[k], top[k], top[j]],
      hint = [a[0][0] + a[1][0] - 2 * f.p(x, y, z)[0], 0, a[0][2] + a[1][2] - 2 * f.p(x, y, z)[2]];
    Q(o, s, a, hint, col);
  }
  Q(o, s, top, [0, 1, 0], col);
  Q(o, s, p, [0, -1, 0], col);
}
function stroke(o, f, ps, w, z, s = 'white', col = C[s]) {
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1],
      b = ps[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const n = [(-(b[1] - a[1]) * w) / 2 / len, ((b[0] - a[0]) * w) / 2 / len];
    Q(
      o,
      s,
      [
        f.p(a[0] + n[0], a[1] + n[1], z),
        f.p(a[0] - n[0], a[1] - n[1], z),
        f.p(b[0] - n[0], b[1] - n[1], z),
        f.p(b[0] + n[0], b[1] + n[1], z),
      ],
      [f.n[0], 0, f.n[1]],
      col,
    );
  }
}
function frame(o, f, q, w, d, z = 0.15, s = 'white') {
  const outer = q.map((p) => p),
    cx = q.reduce((s, p) => s + p[0], 0) / q.length,
    cy = q.reduce((s, p) => s + p[1], 0) / q.length,
    inner = q.map((p) => {
      const dx = p[0] - cx,
        dy = p[1] - cy;
      return [p[0] - Math.sign(dx) * w, p[1] - Math.sign(dy) * w];
    });
  for (let j = 0; j < q.length; j++) {
    const k = (j + 1) % q.length;
    Q(
      o,
      s,
      [f.p(...outer[j], z), f.p(...outer[k], z), f.p(...inner[k], z), f.p(...inner[j], z)],
      [f.n[0], 0, f.n[1]],
    );
    if (d === 3) {
      const p = [
        f.p(...inner[j], z),
        f.p(...inner[k], z),
        f.p(...inner[k], -0.22),
        f.p(...inner[j], -0.22),
      ];
      Q(o, s, p, normalFor(...p), cream);
    }
  }
  return inner;
}
function windows(
  o,
  f,
  { base, rows, pitch, bays, style = 'oct', wall = 'orange', height, round = false },
  d,
) {
  const cols = Math.max(1, bays),
    dx = f.len / cols,
    ww = Math.min(dx * 0.78, round ? 2.6 : 3.25),
    hh = Math.min(2.55, pitch * 0.74),
    ys = Array.from({ length: rows }, (_, j) => base + j * pitch),
    holes = [];
  for (const y of ys)
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * dx;
      holes.push(style === 'oct' && d > 1 ? oct(x, y, ww, hh, 0.34) : rect(x, y, ww, hh));
    }
  const recessed = d === 3 && wall === 'orange';
  panel(o, f, wall, rect(f.len / 2, 0, f.len, height), recessed ? holes : []);
  if (d === 0) return;
  let k = 0;
  for (const y of ys)
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * dx,
        q = holes[k++];
      if (d === 2) {
        panel(o, f, 'white', q, [], 0.04);
        panel(o, f, 'glass', rect(x, y + 0.13, ww - 0.28, hh - 0.26), [], 0.06);
        continue;
      }
      panel(o, f, 'glass', q, [], recessed ? -0.23 : 0.025);
      if (d === 1) {
        stroke(
          o,
          f,
          [
            [x - ww / 2, y + hh],
            [x + ww / 2, y + hh],
          ],
          0.2,
          0.06,
        );
      } else {
        frame(o, f, q, 0.24, recessed ? d : 2, 0.15);
        if (round) {
          stroke(
            o,
            f,
            [
              [x - ww / 2, y + hh * 0.63],
              [x + ww / 2, y + hh * 0.63],
            ],
            0.07,
            0.17,
            'dark',
          );
          if (d === 3) {
            panel(o, f, 'glass', rect(x, y + 0.07, ww * 0.8, hh * 0.5), [], -0.2, curtain);
            for (const sign of [-1, 1]) {
              const line = Array.from({ length: 4 }, (_, j) => {
                const a = -Math.PI / 2 + (j * Math.PI) / 3;
                return [
                  x + sign * (ww * 0.65 + 0.26 * Math.cos(a)),
                  y + hh * 0.5 + 0.55 * Math.sin(a),
                ];
              });
              stroke(o, f, line, 0.1, 0.22);
            }
          }
        } else if (d === 3) {
          if (wall === 'orange')
            panel(
              o,
              f,
              'gold',
              [
                [x + dx / 2 - 0.27, y + hh + 0.28],
                [x + dx / 2, y + hh + 0.55],
                [x + dx / 2 + 0.27, y + hh + 0.28],
                [x + dx / 2, y + hh + 0.01],
              ],
              [],
              0.04,
            );
        }
      }
    }
}
function clipZ(poly, z, less) {
  const out = [];
  for (let j = 0; j < poly.length; j++) {
    const a = poly[j],
      b = poly[(j + 1) % poly.length],
      ia = less ? a[1] <= z : a[1] >= z,
      ib = less ? b[1] <= z : b[1] >= z;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, z]);
    }
  }
  return out;
}
function ellipse(cx, cz, rx, rz, n) {
  return Array.from({ length: n }, (_, i) => [
    cx + rx * Math.cos((i / n) * Math.PI * 2),
    cz + rz * Math.sin((i / n) * Math.PI * 2),
  ]);
}
const main = canonical(plan.components[0].outline),
  rear = canonical(plan.components[1].outline),
  wing = canonical(plan.components[2].outline),
  annexCenter = [-24, -13],
  annex = ellipse(...annexCenter, 16, 22, 32);
function fin(o, f, x, y, z, w, h, depth, d) {
  if (d < 3) panel(o, f, 'white', rect(x, y, w, h), [], z + depth / 2);
  else localBox(o, f, 'white', x, y, z, w, h, depth);
}
function mainTower(o, d) {
  const div = d === 3 || d === 2 ? 2 : 1;
  prism(o, 'orange', main, 0, 35.6, d, (f) => {
    if (d === 0) {
      panel(o, f, 'orange', rect(f.len / 2, 0, f.len, 35.6));
      return;
    }
    windows(
      o,
      f,
      {
        base: 5.8,
        rows: d === 1 ? 5 : 9,
        pitch: d === 1 ? 6.4 : 3.2,
        bays: div,
        style: 'rect',
        height: 35.6,
        round: true,
      },
      d,
    );
    for (let j = 0; j <= div; j++) {
      const x = (j * f.len) / div;
      fin(o, f, x, 4.9, 0.29, d === 1 ? 0.45 : 0.65, 30.7, 0.8, d);
    }
    if (d > 1) {
      for (const sign of [-1, 1]) {
        const x = f.len * (sign < 0 ? 0.16 : 0.84);
        panel(o, f, 'dark', rect(x, 0.5, Math.min(1.5, f.len * 0.25), 3.4), [], 0.04);
      }
      localBox(o, f, 'white', f.len / 2, 3.9, 0.08, f.len, 0.32, 0.25);
    }
  });
  const inset = main.map((p) => p.map((v) => v * 0.93));
  prism(o, 'dark', inset, 35.6, 37.4, d);
  for (let j = 0; j < main.length; j++) {
    const f = face(main[j], main[(j + 1) % main.length]);
    if (d > 0) {
      for (const x of [f.len * 0.15, f.len * 0.85]) fin(o, f, x, 35.6, 0.1, 0.22, 1.8, 0.35, d);
      const wave = Array.from({ length: 7 }, (_, i) => [
        (i * f.len) / 6,
        35.7 + 0.2 * Math.cos((i * Math.PI * 2) / 6),
      ]);
      stroke(o, f, wave, 0.28, 0.32);
    } else panel(o, f, 'white', rect(f.len / 2, 35.6, f.len, 0.4));
  }
  crown(o, 0, 0, 37.4, 21.7, 21.7, 1, d);
}
function rearTower(o, d) {
  const h = 76.8;
  prism(o, 'orange', rear, 0, h, d, (f) => {
    const grid = Math.abs(f.n[1]) > 0.9;
    if (!grid) {
      panel(o, f, 'white', rect(f.len / 2, 0, f.len, h));
      if (d > 0) {
        const rows = d === 1 ? 8 : 16;
        for (let j = 0; j < rows; j++) {
          const y = 7 + j * (d === 1 ? 7.2 : 3.6);
          for (const x of [f.len * 0.3, f.len * 0.7])
            panel(o, f, 'glass', rect(x, y, Math.min(1.4, f.len * 0.15), 1.2), [], 0.02);
        }
      }
      return;
    }
    if (d === 0) {
      panel(o, f, 'orange', rect(f.len / 2, 0, f.len, h));
      return;
    }
    windows(
      o,
      f,
      {
        base: 5.8,
        rows: d === 1 ? 10 : 19,
        pitch: d === 1 ? 6.9 : 3.45,
        bays: Math.max(2, Math.floor(f.len / (d === 1 ? 7.8 : 4.1))),
        style: d === 1 ? 'rect' : 'oct',
        height: h,
      },
      d,
    );
    if (d === 3) {
      const n = Math.max(2, Math.floor(f.len / 4.1));
      for (let i = 0; i <= n; i++)
        panel(o, f, 'white', rect((i * f.len) / n, 5.3, 0.16, 66.3), [], 0.035);
      for (let j = 0; j < 19; j++)
        panel(o, f, 'white', rect(f.len / 2, 5.8 + j * 3.45 + 2.95, f.len, 0.14), [], 0.035);
    }
    localBox(o, f, 'white', f.len / 2, 71.6, 0.05, f.len, 5.2, 0.16);
    if (d > 1) {
      const n = Math.ceil(f.len / 3.8);
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) * f.len) / n;
        panel(o, f, 'orange', rect(x, 72.2, f.len / n - 0.28, 2.3), [], 0.16);
        stroke(
          o,
          f,
          [
            [x - (f.len / n) * 0.45, 72],
            [x - (f.len / n) * 0.35, 72.3],
            [x + (f.len / n) * 0.35, 72.3],
            [x + (f.len / n) * 0.45, 72],
          ],
          0.16,
          0.22,
        );
      }
    }
  });
  crown(o, -18, -42, 76.8, 11.0, 12.0, 0.67, d, true);
  if (d > 0) B(o, 'orange', -23, 76.8, -51, 6, 4.8, 7);
}
function wingPart(o, poly, h, d, high) {
  prism(o, high ? 'white' : 'orange', poly, 0, h, d, (f) => {
    if (d === 0) {
      panel(o, f, high ? 'white' : 'orange', rect(f.len / 2, 0, f.len, h));
      return;
    }
    const count = Math.max(1, Math.floor(f.len / (d === 1 ? 8 : 4.0)));
    windows(
      o,
      f,
      {
        base: high ? 5.3 : 4.2,
        rows: high ? (d === 1 ? 5 : 9) : 2,
        pitch: high ? (d === 1 ? 6.4 : 3.3) : 6.0,
        bays: count,
        style: high ? 'oct' : 'rect',
        height: h,
        wall: high ? 'white' : 'orange',
      },
      d,
    );
    if (!high && d > 1) {
      for (let i = 0; i <= count; i++)
        fin(o, f, (i * f.len) / count, 1, 0.12, 0.34, h - 1, 0.38, d);
    }
    localBox(o, f, 'white', f.len / 2, h - 0.55, 0.04, f.len, 0.55, 0.24);
  });
}
function sideBuildings(o, d) {
  const back = clipZ(wing, -53, true),
    front = clipZ(wing, -53, false);
  wingPart(o, back, 37.3, d, true);
  wingPart(o, front, 17.8, d, false);
  const links = [
    [
      [13, -11],
      [47, -14],
      [64, -5.7],
      [56, 10],
      [16, 11],
    ],
    [
      [5, -20],
      [13, -13],
      [24, -33.5],
      [9, -33.5],
    ],
  ];
  for (const q of links)
    prism(o, 'orange', q, 0, 12.3, d, (f) => {
      panel(o, f, 'orange', rect(f.len / 2, 0, f.len, 12.3));
      if (d > 0) {
        const n = Math.max(2, Math.floor(f.len / 3.1));
        for (let j = 0; j < n; j++) {
          const x = ((j + 0.5) * f.len) / n;
          panel(o, f, 'glass', rect(x, 4.8, Math.min(2, (f.len / n) * 0.6), 4.7), [], 0.03);
          if (d > 1) fin(o, f, x, 1, 0.12, 0.16, 10.8, 0.3, d);
        }
      }
    });
  prism(o, 'orange', annex, 0, 17.8, d, (f) => {
    panel(o, f, 'orange', rect(f.len / 2, 0, f.len, 17.8));
    if (d > 0) {
      const count = d === 1 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) * f.len) / count;
        panel(o, f, 'glass', rect(x, 3.5, Math.min(0.8, f.len * 0.3), 10.4), [], 0.03);
        if (d > 1) fin(o, f, x, 2, 0.18, 0.3, 12.9, 0.52, d);
      }
    }
    if (d > 0) localBox(o, f, 'white', f.len / 2, 15.9, 0.08, f.len, 0.3, 0.25);
  });
  crown(o, ...annexCenter, 17.8, 16, 22, 0.72, d);
  if (d > 1) {
    const q = ellipse(57, -14, 7.5, 5.2, 24);
    prism(o, 'gold', q, 17.8, 18.8, d);
    cap(o, 'dark', q, 18.82);
  }
}
function roofPoint(cx, cz, rx, rz, r, y, a, square = false) {
  let x = Math.cos(a),
    z = Math.sin(a);
  if (square) {
    x = Math.sign(x) * Math.pow(Math.abs(x), 0.5);
    z = Math.sign(z) * Math.pow(Math.abs(z), 0.5);
  }
  return [cx + x * rx * r, y, cz + z * rz * r];
}
function crown(o, cx, cz, base, rx, rz, scale, d, square = false) {
  const n = [8, 12, 16, 48][d],
    prof =
      d === 0
        ? [
            [0.3, 1.13],
            [3.6, 0.28],
          ]
        : [
            [0.3, 1.13],
            [0, 1.03],
            [1.8, 0.75],
            [3.6, 0.28],
          ],
    p = (r, y, a) => roofPoint(cx, cz, rx, rz, r, base + y * scale, a, square);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    for (let j = 1; j < prof.length; j++) {
      const [y0, r0] = prof[j - 1],
        [y1, r1] = prof[j],
        q = [p(r0, y0, a), p(r0, y0, b), p(r1, y1, b), p(r1, y1, a)];
      Q(o, 'roof', q, [0, 1, 0]);
      if (d > 0)
        Q(
          o,
          'roof',
          q.map((p) => [p[0], p[1] - 0.18 * scale, p[2]]),
          [0, -1, 0],
          cream,
        );
    }
    if (d > 1) {
      const eps = 0.007;
      for (let j = 1; j < prof.length; j++) {
        const [y0, r0] = prof[j - 1],
          [y1, r1] = prof[j];
        Q(
          o,
          'white',
          [
            p(r0, y0 + 0.13, a - eps),
            p(r0, y0 + 0.13, a + eps),
            p(r1, y1 + 0.13, a + eps),
            p(r1, y1 + 0.13, a - eps),
          ],
          [0, 1, 0],
        );
      }
    }
  }
  const fins = [6, 8, 8, 16][d],
    steps = d < 2 ? 2 : 4;
  for (let i = 0; i < fins; i++) {
    const a = (i / fins) * Math.PI * 2,
      w = d < 2 ? 0.045 : 0.075;
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        u = (j + 1) / steps,
        r = (t) => 0.18 + 0.55 * Math.pow(1 - t, 2.2),
        y = (t) => 3.7 + 8.3 * t,
        q = [
          p(r(t), y(t), a - w),
          p(r(t), y(t), a + w),
          p(r(u), y(u), a + w),
          p(r(u), y(u), a - w),
        ];
      Q(o, 'roof', q, [Math.cos(a), 0.2, Math.sin(a)]);
      if (d > 1) {
        const back = q.map((v) => [cx + (v[0] - cx) * 0.97, v[1], cz + (v[2] - cz) * 0.97]);
        Q(o, 'roof', back, [-Math.cos(a), 0, -Math.sin(a)], cream);
        for (const side of [
          [0, 3],
          [1, 2],
        ]) {
          const [l, r] = side,
            v = [q[l], q[r], back[r], back[l]];
          Q(o, 'roof', v, normalFor(...v));
        }
      }
    }
  }
  if (d > 0) {
    const r = 0.07 * Math.min(rx, rz);
    loft(
      o,
      'white',
      [
        radialRing(base + 3.6 * scale, r, r, 8, [cx, cz]),
        radialRing(base + 12 * scale, r, r, 8, [cx, cz]),
      ],
      C.white,
    );
  }
  finial(o, cx, cz, base + 12 * scale, scale, d);
}
function finial(o, cx, cz, y, k, d) {
  const r = 3.15 * k,
    n = d === 0 ? 6 : d === 1 || d === 2 ? 8 : 12;
  if (d < 2) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2;
      Q(
        o,
        'gold',
        [
          [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r],
          [cx + Math.cos(b) * r, y, cz + Math.sin(b) * r],
          [cx + Math.cos(b) * r * 1.3, y + 3 * k, cz + Math.sin(b) * r * 1.3],
          [cx + Math.cos(a) * r * 1.3, y + 3 * k, cz + Math.sin(a) * r * 1.3],
        ],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      );
    }
    B(o, 'gold', cx, y + 3 * k, cz, 0.6 * k, 5 * k, 0.6 * k);
    return;
  }
  const bottom = radialRing(y, r * 0.56, r * 0.56, n, [cx, cz]);
  loft(o, 'gold', [bottom, radialRing(y + 1.5 * k, r * 0.65, r * 0.65, n, [cx, cz])], C.gold);
  torus(o, 'gold', [cx, y + 4 * k, cz], r * 1.3, 0.13 * k, C.gold, n, 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2,
      start = [cx + Math.cos(a) * r * 0.6, y + 1.5 * k, cz + Math.sin(a) * r * 0.6],
      end = [cx + Math.cos(a) * r * 1.3, y + 4 * k, cz + Math.sin(a) * r * 1.3];
    beam(o, 'gold', start, end, 0.15 * k, 0.15 * k, C.gold);
    if (d > 1)
      beam(
        o,
        'gold',
        start,
        [cx + Math.cos(b) * r * 1.3, y + 4 * k, cz + Math.sin(b) * r * 1.3],
        0.09 * k,
        0.09 * k,
        C.gold,
      );
    const high = i % 3 === 0 ? 8.4 : i % 3 === 1 ? 6.3 : 4.8,
      rad = i % 3 === 0 ? 1.05 : 1.8,
      tip = [cx + Math.cos(a) * r * rad, y + high * k, cz + Math.sin(a) * r * rad];
    beam(o, 'gold', end, tip, 0.09 * k, 0.09 * k, C.gold);
    sphere(o, 'gold', tip, [0.24 * k, 0.24 * k, 0.24 * k], C.gold, d === 2 ? 4 : 6, 3);
  }
  beam(o, 'gold', [cx, y + 3 * k, cz], [cx, y + 10.2 * k, cz], 0.14 * k, 0.14 * k, C.gold);
  sphere(
    o,
    'gold',
    [cx, y + 10.5 * k, cz],
    [0.38 * k, 0.42 * k, 0.38 * k],
    C.gold,
    d === 2 ? 4 : 8,
    3,
  );
}
function canopy(o, d) {
  const n = [12, 20, 32, 48][d],
    q = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2,
        r = 1 + 0.09 * Math.cos(a * 6);
      return [Math.cos(a) * 18 * r, 23 + Math.sin(a) * 6 * r];
    });
  prism(o, 'aqua', q, 4.8, 5.1, d);
  const rim = q.map((p) => [p[0], 5.25 + 0.18 * Math.cos(Math.atan2(p[1] - 23, p[0]) * 6), p[1]]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      'white',
      [
        rim[i],
        rim[j],
        [q[j][0] * 0.96, rim[j][1], 23 + (q[j][1] - 23) * 0.93],
        [q[i][0] * 0.96, rim[i][1], 23 + (q[i][1] - 23) * 0.93],
      ],
      [0, 1, 0],
    );
    if (d > 1) tri(o, 'aqua', [[0, 5.5, 23], rim[i], rim[j]], [0, 1, 0]);
  }
  for (const x of [-13, 0, 13]) B(o, 'dark', x, 0.3, 26, 0.35, 4.5, 0.35);
  const platform = [
    [-17, 22],
    [17, 22],
    [18, 29],
    [8, 32],
    [-8, 32],
    [-18, 29],
  ];
  prism(o, 'stone', platform, -0.2, 0.3, d);
  for (let i = 0; i < (d === 0 ? 1 : 3); i++)
    B(o, 'stone', 0, 0, 31.5 + i * 0.5, 13, 0.3 - i * 0.1, 0.9);
}
const font = {
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
};
function sign(o, d) {
  B(o, 'white', -28, 21, -19, 12.8, 33, 0.65);
  if (d < 2) return;
  const f = {
    n: [0, 1],
    p: (x, y, z = 0) => [-34.4 + x, y, -18.66 + z],
  };
  for (const [word, y] of [
    ['CASINO', 49.9],
    ['LISBOA', 45.8],
  ]) {
    const step = 1.92,
      px = 0.29;
    for (let k = 0; k < word.length; k++) {
      const glyph = font[word[k]];
      for (let r = 0; r < 7; r++) {
        const row = glyph[r];
        let first = -1;
        for (let j = 0; j <= 5; j++) {
          if (j < 5 && row[j] === '1') {
            if (first < 0) first = j;
          } else if (first >= 0) {
            panel(
              o,
              f,
              'gold',
              rect(
                1.1 + k * step + (first + (j - first) / 2) * px,
                y + (6 - r) * 0.43,
                (j - first) * px,
                0.37,
              ),
              [],
              0.03,
            );
            first = -1;
          }
        }
      }
    }
  }
}
function build(o, _frame, d = 3) {
  mainTower(o, d);
  rearTower(o, d);
  sideBuildings(o, d);
  canopy(o, d);
  sign(o, d);
}
export const lisboaSkyline = (o, f) => build(o, f, 0);
export const lisboaDistrict = (o, f) => build(o, f, 1);
export const lisboaStreet = (o, f) => build(o, f, 2);
export const casinoLisboaMacauModel = {
  id: 'casino_lisboa_macau',
  key: 'casino_lisboa_macau',
  recipe: 'structure-casino-lisboa-macau.mjs',
  cell: 'we/web',
  title: 'Casino Lisboa (Macau)',
  category: 'hospitality-entertainment',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete original Hotel/Casino Lisboa from native circular front tower/T-shaped rear tower/bent eastern wing, plus bounded inferred low connectors/west domed annex, aqua scalloped entrance canopy and signboard. Ochre walls, dark recessed glazing, strong white vertical/curving and octagonal relief window tracery, stepped wing heights, three flared white ribbed roof/open-fin crowns with genuinely pierced gold radial finials, intrinsic entry platforms/stairs and original geometric name lettering. Native site boundary is not a building slab. Separate GrandLisboa/BankofChina/Wynn/roundabout/transit pavilion and landscape excluded; hidden layout/sections/height conventions/contact are estimates.',
  camera: [170, 135, 225],
  lookAt: [20, 38, -24],
  portableGroundY: -0.3,
  mediumFiContext: { scale: 2.2, groundY: -0.3 },
  qaCameras: [
    {
      name: 'round-front-tracery-flared-crown-and-entrance-canopy',
      position: [43, 40, 91],
      lookAt: [0, 27, 0],
    },
    {
      name: 'rear-geometric-window-grid-and-open-gilt-finial',
      position: [40, 89, 7],
      lookAt: [-10, 69, -40],
    },
    {
      name: 'west-annex-roof-crowns-and-name-board',
      position: [-78, 47, 23],
      lookAt: [-20, 32, -10],
    },
    {
      name: 'complete-original-lisboa-three-native-masses',
      position: [-170, 118, -172],
      lookAt: [20, 35, -39],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed main-front reference[0,68.86629456734734]/Y0selected before terrain; intrinsic entry platform only, no forecourt/roundabout/site flattening.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-casino-lisboa-macau.mjs',
    level: 'skyline',
    export: 'lisboaSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'lisboaDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'lisboaStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Main circular body37.4m with9interpreted room tiers/low entrance level/open upper belt; native rear T-body76.8m with19interpreted room tiers; rear eastern wing37.3m and front wing17.8m use an inferred stepped split. White flared crowns/open upper fins/gold finials extend above these parent body heights. Native source height tags are retained separately and are not claimed verified roof-tip heights. West elliptical drum/low connectors/canopy are photographically inferred inside the named complex, with no separately surveyed footprint. Concealed rear elevations, room/floor counts, exact roof sections, podium boundaries and host grade/contact remain estimates.',
    'Three exact published Qualla originals inspected first: two4080x3060March2026own-workCC0frontage/canopy views byNuMezzaliaOK LA R0316and one2304x3072Cdip150own-workPD-selfview used only for its visible old-Lisboa cylindrical white tracery/crown/finial. Native imageSHA1and primary same-author dedications match local originals. Neighboring BankofChina in the latter image is unused. An older640x480PDnight view was inspected for discovery but not adopted; other licensed/unrelatedGrandLisboa images unused. No additional image source or photographic texture.',
    'White vertical fins, rounded and octagonal geometric window surrounds/recesses, lower flared sheet-roof ribs, genuinely open upper roof fins and gold basket/firework finials are original medium-fi geometry. Fine pattern census, particular decorative motifs, individual roof corrugations/bolts, signage font, exact gold sculpture and weathering are simplified. Plain original geometric CASINO/LISBOAname lettering is included; decorative billboard mural, logos/brands, character artwork and fine roof sculpture are not reproduced.',
    'Main cylindrical and rear T-tower windows have genuine close-detail recesses. Fine wing windows use shallow relief frames with progressively simpler panes at distance. Columns, roof ribs/finials and small window ornament retire progressively; all native parent outlines remain. ',
    'Only intrinsic connected buildings, small entry platform/steps and scalloped canopy are included. No entire resort slab/filled forecourt, roundabout/transit glass pavilion, roads, planting/people/vehicles, separate GrandLisboa/BankofChina/Wynn or surrounding towers. Fixed main-front reference was selected before terrain; source relief is retained and exact thresholds/foundation/host contact remain unverified.',
  ],
};
