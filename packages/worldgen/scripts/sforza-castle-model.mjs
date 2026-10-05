/** Castello Sforzesco: mapped compound with researched, source-authored exterior details. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u0n/n0258_sforza_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const brick = [0.57, 0.32, 0.22],
  stone = [0.47, 0.48, 0.45],
  cream = [0.79, 0.73, 0.61],
  tile = [0.5, 0.27, 0.18],
  dark = [0.075, 0.085, 0.082];
const low = (o) => o.detail === 'skyline',
  near = (o) => !['skyline', 'district'].includes(o.detail),
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail),
  master = (o) => !o.detail;
const tint = (c, n) => c.map((v) => v * n);
function face(o, s, p, c) {
  // A roof edge meeting the eave collapses one end of its gable to a triangle.
  const q = p.filter(
    (v, i) => !p.slice(0, i).some((w) => Math.hypot(...v.map((n, k) => n - w[k])) < 1e-5),
  );
  if (q.length === 3) tri(o, s, q, c);
  else if (q.length === 4) quad(o, s, q, normalFor(...q), c);
}
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
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function polygon(p) {
  p = p.map((v) => [...v]);
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop();
  return area(p) < 0 ? p.reverse() : p;
}
const part = (id) => polygon(map.parts.find((v) => v.id === `relation/${id}`).outlines[0]);
const feature = (id) => polygon(map.features.find((v) => v.id === `way/${id}`).points);
const bounds = (p) =>
  [0, 1].map((k) => [Math.min(...p.map((v) => v[k])), Math.max(...p.map((v) => v[k]))]);
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
const edge = (o, a, b, y = 0) => frame(o, a[0], y, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
function cap(o, p, y, s = 'brick', c = brick) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, s, q, c);
  }
}
function solid(o, p, lo, hi, s = 'brick', c = brick) {
  p = polygon(p);
  cap(o, p, hi, s, c);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [a[0], hi, a[1]],
        [b[0], hi, b[1]],
        [b[0], lo, b[1]],
      ],
      c,
    );
  }
}
function rect(o, x, z, w, d, lo, hi, s = 'brick', c = brick) {
  box(o, s, [x - w / 2, lo, z - d / 2], [x + w / 2, hi, z + d / 2], c);
}
function cylinder(o, x, z, r, lo, hi, s, c, n) {
  loft(o, s, [radialRing(lo, r, r, n, [x, z]), radialRing(hi, r, r, n, [x, z])], c);
}
function arch(o, x, y, w, rise, thickness, depth, s = 'brick', c = brick) {
  const n = master(o) ? 16 : fine(o) ? 10 : near(o) ? 6 : 4,
    r = w / 2;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    const p = [
      [x + Math.cos(a) * r, y + Math.sin(a) * rise],
      [x + Math.cos(b) * r, y + Math.sin(b) * rise],
      [x + Math.cos(b) * (r + thickness), y + Math.sin(b) * (rise + thickness)],
      [x + Math.cos(a) * (r + thickness), y + Math.sin(a) * (rise + thickness)],
    ];
    for (const z of [0, -depth]) {
      const q = p.map(([x, y]) => [x, y, z]);
      if (normalFor(...q)[2] * (z === 0 ? 1 : -1) < 0) q.reverse();
      face(o, s, q, tint(c, 1 - (master(o) ? (i % 3) * 0.025 : 0)));
    }
    for (let j = 0; j < 4; j++) {
      const a = p[j],
        b = p[(j + 1) % 4];
      face(
        o,
        s,
        [
          [a[0], a[1], 0],
          [b[0], b[1], 0],
          [b[0], b[1], -depth],
          [a[0], a[1], -depth],
        ],
        c,
      );
    }
  }
}
function archPanel(o, x, y, w, h, z, s = 'recess', c = dark) {
  const n = near(o) ? 12 : 5,
    r = w / 2,
    sy = y + h - r;
  const pts = [
    [x - r, y, z],
    [x + r, y, z],
    [x + r, sy, z],
  ];
  for (let i = 1; i <= n; i++)
    pts.push([x + Math.cos((i * Math.PI) / n) * r, sy + Math.sin((i * Math.PI) / n) * r, z]);
  o.addConvexPolygon(s, 'palette:#ffffff', pts, [0, 0, 1], (p) => [p[0], p[1]], c);
}
function window(o, x, y, w, h, z = 0, { triple = false } = {}) {
  const f = frame(o, 0, 0, z + 0.055);
  archPanel(f, x, y, w, h, 0);
  if (!near(o)) return;
  arch(f, x, y + h - w / 2, w, w / 2, 0.16, 0.16, 'tile', tint(tile, 1.35));
  for (const s of [-1, 1])
    rect(f, x + s * (w / 2 + 0.1), -0.075, 0.18, 0.2, y, y + h - w / 2, 'tile', tint(tile, 1.35));
  rect(f, x, 0.035, w + 0.5, 0.35, y - 0.2, y, 'limestone', cream);
  if (triple) {
    for (const s of [-1, 1])
      cylinder(f, x + (s * w) / 6, 0.08, 0.08, y, y + h - w / 3, 'limestone', cream, 6);
    for (let i = 0; i < 3; i++)
      arch(
        f,
        x + ((i - 1) * w) / 3,
        y + h - w / 2,
        w / 3,
        w / 5,
        0.11,
        0.14,
        'tile',
        tint(tile, 1.35),
      );
  } else if (fine(o)) {
    rect(f, x, 0.075, 0.065, 0.08, y, y + h - 0.2, 'metal', stone);
    rect(f, x, 0.075, w - 0.1, 0.08, y + h * 0.45, y + h * 0.45 + 0.065, 'metal', stone);
  }
}
function masonry(o, l, y, h, s = 'brick', c = brick, z = 0.02) {
  if (!master(o)) return;
  const row = s === 'stone' ? 0.64 : 0.3,
    pitch = s === 'stone' ? 1.12 : 0.95;
  for (let j = 0, yy = y + 0.03; yy + row < h + y; yy += row, j++)
    for (let x = 0.12 + ((j % 2) * pitch) / 2; x + pitch < l; x += pitch) {
      // Thin authored chips retain the shared metric material rather than embedding photographs.
      if (s === 'brick' && (j + Math.floor(x / pitch)) % 4 !== 0) continue;
      rect(
        o,
        x + pitch * 0.45,
        z,
        pitch * 0.85,
        0.025,
        yy,
        yy + row * 0.82,
        s,
        tint(c, 0.87 + ((j * 7 + Math.floor(x)) % 9) * 0.023),
      );
    }
}
function pitchedRoof(o, p, y, rise) {
  const b = bounds(p),
    axis = b[0][1] - b[0][0] > b[1][1] - b[1][0] ? 0 : 1,
    k = 1 - axis,
    mid = (b[k][0] + b[k][1]) / 2;
  // Clip the actual footprint on its roof ridge; no rectangular roofs spanning open courts.
  for (const sign of [-1, 1]) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        da = (a[k] - mid) * sign,
        db = (b[k] - mid) * sign;
      if (da >= -1e-7) q.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
        const t = da / (da - db);
        q.push(a.map((v, j) => v + (b[j] - v) * t));
      }
    }
    if (q.length < 3) continue;
    const height = (v) =>
      y + rise * (1 - Math.abs(v[k] - mid) / Math.max(mid - b[k][0], b[k][1] - mid));
    const ix = earcut(q.flat());
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix.slice(i, i + 3).map((j) => [q[j][0], height(q[j]), q[j][1]]);
      if (normalFor(...t)[1] < 0) t.reverse();
      tri(o, 'tile', t, tile);
    }
    for (let i = 0; i < q.length; i++) {
      const a = q[i],
        b = q[(i + 1) % q.length];
      if (Math.max(height(a), height(b)) < y + 0.001) continue;
      face(
        o,
        'brick',
        [
          [a[0], y, a[1]],
          [a[0], height(a), a[1]],
          [b[0], height(b), b[1]],
          [b[0], y, b[1]],
        ],
        brick,
      );
    }
  }
}
function hip(o, x, z, w, d, y, rise) {
  const p = [
      [x - w / 2, y, z - d / 2],
      [x - w / 2, y, z + d / 2],
      [x + w / 2, y, z + d / 2],
      [x + w / 2, y, z - d / 2],
    ],
    c = [x, y + rise, z];
  for (let i = 0; i < 4; i++) tri(o, 'tile', [p[i], p[(i + 1) % 4], c], tile);
}
function corbels(o, l, y, spacing = 1.7) {
  if (!near(o)) return;
  const n = Math.max(1, Math.round(l / spacing)),
    step = l / n;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * step;
    rect(o, x, 0.25, 0.3, 0.7, y - 1.6, y, 'limestone', cream);
    if (fine(o)) {
      rect(o, x, 0.05, 0.46, 0.3, y - 1.95, y - 1.6, 'stone', stone);
      arch(
        frame(o, 0, 0, 0.6),
        x + step / 2,
        y - 0.65,
        step - 0.32,
        0.65,
        0.18,
        0.32,
        'brick',
        brick,
      );
    }
  }
  rect(o, l / 2, 0.36, l, 0.85, y, y + 0.24, 'limestone', cream);
}
function gallery(o, l, depth, y, h) {
  if (low(o)) {
    rect(o, l / 2, -depth / 2, l, depth, y, y + h);
    return;
  }
  rect(o, l / 2, -depth / 2, l, depth, y, y + 0.6);
  rect(o, l / 2, -depth / 2, l, depth, y + h - 0.35, y + h);
  const n = Math.max(2, Math.round(l / (near(o) ? 2.3 : 5))),
    step = l / n;
  for (let i = 0; i <= n; i++)
    rect(o, i * step, -depth / 2, Math.min(step * 0.44, 0.75), depth, y + 0.6, y + h - 0.35);
}
function merlons(o, x, z, w, d, y) {
  if (low(o)) return;
  for (const [a, b] of [
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
    ],
    [
      [w / 2, -d / 2],
      [w / 2, d / 2],
    ],
    [
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ],
    [
      [-w / 2, d / 2],
      [-w / 2, -d / 2],
    ],
  ]) {
    const f = edge(o, [a[0] + x, a[1] + z], [b[0] + x, b[1] + z]),
      l = Math.hypot(a[0] - b[0], a[1] - b[1]),
      n = Math.max(3, Math.round(l / 2));
    for (let i = 0; i < n; i++) {
      const xx = ((i + 0.5) * l) / n;
      rect(f, xx, 0, 0.95, 0.65, y, y + 1.25);
      if (fine(o)) {
        rect(f, xx - 0.32, 0, 0.3, 0.65, y + 1.25, y + 1.7);
        rect(f, xx + 0.32, 0, 0.3, 0.65, y + 1.25, y + 1.7);
      }
    }
  }
}
function spandrel(o, x, y, r, rise, top, z) {
  const n = master(o) ? 16 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      xa = x + Math.cos(a) * r,
      xb = x + Math.cos(b) * r,
      ya = y + Math.sin(a) * rise,
      yb = y + Math.sin(b) * rise;
    face(
      o,
      'plaster',
      [
        [xb, yb, z],
        [xa, ya, z],
        [xa, top, z],
        [xb, top, z],
      ],
      cream,
    );
  }
}
function arcade(o, a, b, depth, bays) {
  const f = edge(o, a, b, 3),
    l = Math.hypot(a[0] - b[0], a[1] - b[1]),
    step = l / bays,
    h = 3.5,
    rise = step * 0.45;
  // Local +Z faces the court. Real voids continue behind the columns to a recessed back wall.
  rect(f, l / 2, -depth, l, 0.35, 0, 7.4, 'plaster', cream);
  rect(f, l / 2, -depth / 2, l, depth, 0.03, 0.2, 'limestone', cream);
  if (low(o)) return;
  for (let i = 0; i <= bays; i++) {
    const x = i * step;
    cylinder(f, x, 0, 0.23, 0.2, h, 'limestone', cream, near(o) ? 10 : 4);
    rect(f, x, 0, 0.7, 0.7, h, h + 0.27, 'limestone', cream);
    if (fine(o)) {
      rect(f, x, 0, 0.7, 0.7, 0.2, 0.4, 'limestone', cream);
      for (const s of [-1, 1])
        rect(f, x + s * 0.23, 0, 0.22, 0.55, h - 0.16, h + 0.1, 'carved', cream);
    }
  }
  for (let i = 0; i < bays; i++) {
    const x = (i + 0.5) * step;
    arch(f, x, h + 0.27, step - 0.48, rise, 0.25, 0.45, 'plaster', cream);
    spandrel(f, x, h + 0.27, (step - 0.48) / 2 + 0.25, rise + 0.25, 7.4, 0);
    rect(f, x, -0.22, step, 0.45, h + rise + 0.38, 7.4, 'plaster', cream);
    if (fine(o)) {
      beam(
        f,
        'metal',
        [i * step, h + 0.2, 0.03],
        [(i + 1) * step, h + 0.2, 0.03],
        0.055,
        0.055,
        dark,
      );
      window(f, x, 0.4, 1.1, 2.8, -depth + 0.22);
    }
  }
}
function clipX(p, x, sign) {
  const q = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      da = (a[0] - x) * sign,
      db = (b[0] - x) * sign;
    if (da >= 0) q.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      q.push([x, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return q;
}
function wingBody(o, p, e, id) {
  if (id === 18241935) {
    // Porta del Barchio remains a real opening in the mapped rear range.
    solid(o, clipX(p, -9.65, -1), 0, 9.3);
    solid(o, clipX(p, -5.05, 1), 0, 9.3);
    solid(o, p, 9.3, e);
    if (near(o))
      arch(frame(o, -7.35, 0, -96.66, Math.PI), 0, 6.6, 4.6, 2.3, 0.4, 5.3, 'limestone', cream);
    return;
  }
  const arcs = map.arcades.filter((a) =>
    p.some((v) => Math.hypot(v[0] - a.a[0], v[1] - a.a[1]) < 0.5),
  );
  solid(o, p, arcs.length ? 10.4 : 0, e);
  if (arcs.length) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        l = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (l < 0.1) continue;
      const isArc = arcs.some((q) => {
        const mx = (a[0] + b[0]) / 2,
          mz = (a[1] + b[1]) / 2;
        return (
          Math.abs((q.b[0] - q.a[0]) * (mz - q.a[1]) - (q.b[1] - q.a[1]) * (mx - q.a[0])) /
            Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) <
          0.4
        );
      });
      if (!isArc) rect(edge(o, a, b), l / 2, -0.3, l, 0.6, 0, 10.4);
    }
  }
}
function wing(o, w) {
  const p = part(w.relation),
    e = 3 + w.eaves;
  wingBody(o, p, e, w.relation);
  pitchedRoof(o, p, e, w.rise);
  if (!near(o)) return;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      l = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (l < 5) continue;
    const f = edge(o, b, a),
      n = Math.floor(l / 5.3);
    for (let j = 0; j < n; j++) window(f, ((j + 0.5) * l) / n, 12.3, 1.8, 3.5);
    rect(f, l / 2, 0.1, l, 0.28, e - 0.55, e - 0.3, 'tile', tile);
    masonry(f, l, 11, e - 11);
  }
}
function squareTower(o, id, top, roofRise) {
  const p = part(id),
    b = bounds(p),
    x = (b[0][0] + b[0][1]) / 2,
    z = (b[1][0] + b[1][1]) / 2,
    w = b[0][1] - b[0][0],
    d = b[1][1] - b[1][0];
  solid(o, p, 0, top + 3);
  hip(o, x, z, w + 1, d + 1, top + 3, roofRise);
  if (!near(o)) return;
  for (let i = 0; i < 4; i++) {
    const a = [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ][i],
      b = [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ][(i + 1) % 4],
      f = edge(o, [x + b[0], z + b[1]], [x + a[0], z + a[1]]),
      l = Math.hypot(a[0] - b[0], a[1] - b[1]);
    corbels(f, l, top + 1);
    for (let yy = 9; yy < top - 3; yy += 7)
      for (let j = 0; j < 2; j++) window(f, ((j + 1) * l) / 3, yy, 1.7, 3.1);
    masonry(f, l, 3, top - 3);
  }
}
function roundTower(o, x, z, r) {
  const n = low(o) ? 10 : near(o) ? 48 : 16;
  loft(
    o,
    'stone',
    [
      [0, r + 1],
      [3, r],
      [24, r],
    ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    stone,
  );
  loft(
    o,
    'brick',
    [
      [24, r],
      [26, r + 2],
      [31, r + 2],
    ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    brick,
  );
  loft(
    o,
    'tile',
    [
      [31, r + 2.45],
      [34.6, 1.3],
      [35.8, 0.5],
    ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    tile,
  );
  cylinder(o, x, z, 0.17, 35.5, 38, 'metal', stone, low(o) ? 4 : 8);
  if (!near(o)) return;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      f = frame(o, x + Math.sin(a) * (r + 2.015), 0, z + Math.cos(a) * (r + 2.015), a);
    rect(f, 0, 0, 0.5, 0.04, 27, 30.2, 'recess', dark);
    if (fine(o)) {
      rect(f, 0, -0.45, 0.35, 1.1, 24.2, 26, 'limestone', cream);
      arch(frame(f, 0, 0, 0.1), 0, 25, 0.94, 0.75, 0.18, 0.3);
    }
  }
  for (const y of [23.6, 26.2])
    loft(
      o,
      'limestone',
      [
        radialRing(y, r + (y > 24 ? 2.08 : 0.08), r + (y > 24 ? 2.08 : 0.08), n, [x, z]),
        radialRing(y + 0.16, r + (y > 24 ? 2.08 : 0.08), r + (y > 24 ? 2.08 : 0.08), n, [x, z]),
      ],
      cream,
    );
  if (master(o))
    for (let j = 0, yy = 0.25; yy < 23.4; yy += 0.6, j++)
      for (let i = 0; i < 64; i++) {
        const a = ((i + (j % 2) * 0.5) * Math.PI * 2) / 64,
          b = a + (Math.PI * 2) / 64 - 0.01,
          rr = r + (yy < 3 ? (3 - yy) / 3 : 0);
        const p = [
            [x + Math.sin(a) * rr, yy, z + Math.cos(a) * rr],
            [x + Math.sin(b) * rr, yy, z + Math.cos(b) * rr],
            [x + Math.sin(b) * rr, yy + 0.53, z + Math.cos(b) * rr],
            [x + Math.sin(a) * rr, yy + 0.53, z + Math.cos(a) * rr],
          ],
          center = [
            x + Math.sin((a + b) / 2) * (rr + 0.21),
            yy + 0.27,
            z + Math.cos((a + b) / 2) * (rr + 0.21),
          ];
        for (let k = 0; k < 4; k++)
          tri(
            o,
            'stone',
            [p[k], p[(k + 1) % 4], center],
            tint(stone, 0.9 + ((j + i * 3) % 8) * 0.023),
          );
      }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const f = frame(o, x + Math.sin(a) * (r + 0.25), 0, z + Math.cos(a) * (r + 0.25), a);
    for (const yy of [7, 13.5, 20]) {
      rect(f, 0, 0, 1.1, 0.05, yy, yy + 1.4, 'recess', dark);
      if (fine(o))
        for (let i = -2; i <= 2; i++) {
          rect(f, i * 0.22, 0.08, 0.035, 0.06, yy, yy + 1.4, 'metal', stone);
          rect(f, 0, 0.08, 1.1, 0.06, yy + 0.7 + i * 0.22, yy + 0.735 + i * 0.22, 'metal', stone);
        }
    }
  }
}
function curtain(o, a, b, { gate, rooms = false } = {}) {
  const f = edge(o, a, b),
    l = Math.hypot(a[0] - b[0], a[1] - b[1]),
    d = rooms ? 9 : 5;
  if (gate !== undefined && !low(o)) {
    rect(f, gate / 2, -d / 2, gate - 2.2, d, 0, 16);
    rect(f, (gate + 2.2 + l) / 2, -d / 2, l - gate - 2.2, d, 0, 16);
    rect(f, gate, -d / 2, 4.4, d, 9.4, 16);
    arch(f, gate, 6.2, 4.4, 3, 0.6, d, 'limestone', cream);
  } else rect(f, l / 2, -d / 2, l, d, 0, 16);
  gallery(f, l, d, 16, 3.1);
  pitchedRoof(
    f,
    [
      [0, 0.55],
      [l, 0.55],
      [l, -d - 0.6],
      [0, -d - 0.6],
    ],
    19.1,
    1.15,
  );
  corbels(f, l, 16);
  if (near(o)) {
    for (let x = 7; x < l - 4; x += 10) {
      if (gate !== undefined && Math.abs(x - gate) < 5) continue;
      window(f, x, 6.5, 2.6, 5, 0, { triple: true });
    }
    if (gate === undefined) masonry(f, l, 3, 11);
    else {
      masonry(f, gate - 2.7, 3, 11);
      masonry(frame(f, gate + 2.7), l - gate - 2.7, 3, 11);
      masonry(frame(f, gate - 2.7), 5.4, 9.4, 4.6);
    }
    if (master(o))
      for (let y = 5; y < 15; y += 1.8)
        for (let x = 1; x < l - 1; x += 2.5) {
          if (gate !== undefined && Math.abs(x - gate) < 3) continue;
          rect(f, x, 0.04, 0.17, 0.03, y, y + 0.18, 'recess', dark);
        }
  }
}
function clock(o, x, y, z, r) {
  if (!near(o)) return;
  const f = frame(o, x, y, z);
  const n = master(o) ? 64 : 24,
    p = [];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n;
    p.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  f.addConvexPolygon('limestone', 'palette:#ffffff', p, [0, 0, 1], (p) => [p[0], p[1]], cream);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    beam(
      f,
      'metal',
      [Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.8, 0.06],
      [Math.sin(a) * r * 0.95, Math.cos(a) * r * 0.95, 0.06],
      0.09,
      0.06,
      stone,
    );
  }
  beam(f, 'metal', [0, 0, 0.09], [r * 0.5, r * 0.22, 0.09], 0.13, 0.08, dark);
  beam(f, 'metal', [0, 0, 0.1], [-r * 0.3, r * 0.66, 0.1], 0.09, 0.08, dark);
  if (fine(o))
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      beam(
        f,
        'tile',
        [Math.sin(a) * r * 0.3, Math.cos(a) * r * 0.3, 0.04],
        [Math.sin(a + 0.05) * r * 0.59, Math.cos(a + 0.05) * r * 0.59, 0.04],
        0.055,
        0.04,
        tile,
      );
    }
}
function filarete(o) {
  const f = frame(o, -6.7, 3, 82),
    w = 23.4,
    d = 17.1;
  // Large gateway, corbelled roofed first stage, clock stage, open belfry and octagonal crown.
  if (low(o)) rect(f, 0, 0, w, d, 0, 29);
  else {
    rect(f, -7, 0, 9.4, d, 0, 24);
    rect(f, 7, 0, 9.4, d, 0, 24);
    rect(f, 0, 0, 4.6, d, 8, 24);
    arch(frame(f, 0, 0, d / 2), 0, 4.8, 4.6, 3, 0.4, d);
  }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const front = a % Math.PI === 0,
      span = front ? w : d,
      deep = front ? d : w,
      g = frame(f, (Math.sin(a) * deep) / 2, 0, (Math.cos(a) * deep) / 2, a);
    corbels(frame(g, -span / 2, 0, 0), span, 26);
    if (near(o)) {
      for (const x of [-6, -3, 0, 3, 6]) {
        if (Math.abs(x) > span / 2 - 1) continue;
        window(g, x, 19.5, 0.7, 1.5);
      }
      if (front) {
        masonry(frame(g, -span / 2), (span - 5) / 2, 0, 8.5);
        masonry(frame(g, 2.5), (span - 5) / 2, 0, 8.5);
        masonry(frame(g, -span / 2), span, 8.5, 15.5);
      } else masonry(frame(g, -span / 2, 0, 0), span, 0, 24);
    }
  }
  rect(f, 0, 0, w + 1.8, d + 1.8, 24, 26);
  for (const a of [0, Math.PI])
    gallery(
      frame(f, -Math.cos(a) * (w / 2 + 1), 0, Math.cos(a) * (d / 2 + 1), a),
      w + 2,
      1,
      26,
      3.7,
    );
  rect(f, -w / 2 - 0.4, 0, 1, d + 1, 26, 29.7);
  rect(f, w / 2 + 0.4, 0, 1, d + 1, 26, 29.7);
  hip(f, 0, 0, w + 4, d + 4, 29.7, 2.1);
  rect(f, 0, 0, 12.2, 12.2, 31.8, 45);
  merlons(f, 0, 0, 13.1, 13.1, 45);
  rect(f, 0, 0, 13.4, 13.4, 44.3, 45);
  clock(f, 0, 39.4, 6.14, 2.6);
  rect(f, 0, 0, 8.8, 8.8, 47, 48.4);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const g = frame(f, Math.sin(a) * 4.2, 0, Math.cos(a) * 4.2, a);
    if (low(o)) rect(g, 0, -0.3, 8.4, 0.6, 48.4, 57);
    else {
      for (const s of [-1, 1]) rect(g, s * 3, -0.35, 2.4, 0.7, 48.4, 56.3);
      arch(g, 0, 53, 3.6, 2, 0.5, 0.7);
      rect(g, 0, -0.35, 3.6, 0.7, 55.5, 57);
    }
  }
  rect(f, 0, 0, 9.8, 9.8, 57, 57.7, 'limestone', cream);
  hip(f, 0, 0, 10.6, 10.6, 57.7, 1.3);
  cylinder(f, 0, 0, 2.9, 59, 62, 'brick', brick, 8);
  loft(
    f,
    'copper',
    [
      [62, 3.25],
      [63.2, 3.2],
      [65.1, 2.45],
      [65.9, 1.15],
      [66.2, 0.4],
    ].map(([y, r]) => radialRing(y, r, r, low(o) ? 8 : 16)),
    [0.28, 0.37, 0.3],
  );
  cylinder(f, 0, 0, 0.15, 66.2, 70, 'metal', stone, low(o) ? 4 : 8);
  if (near(o)) {
    window(f, 0, 50.5, 3.5, 4.3, 4.25);
    const back = frame(f, 0, 0, -d / 2, Math.PI);
    window(back, 0, 12.8, 5.5, 6.5, 0, { triple: true });
    rect(back, 0, 0.2, 7.5, 0.55, 12, 12.6, 'limestone', cream);
    for (const x of [-2.8, -1.4, 0, 1.4, 2.8])
      arch(frame(back, 0, 0, 0.16), x, 10.6, 1.2, 0.75, 0.16, 0.35, 'tile', tile);
    // Panels record architectural surrounds only; no invented figurative relief or writing.
    const front = frame(f, 0, 0, d / 2 + 0.12);
    rect(front, 0, 0, 5, 0.22, 8.5, 17, 'limestone', cream);
    archPanel(front, 0, 8.7, 4.3, 8, 0.16, 'limestone', tint(cream, 0.91));
    for (const x of [-6.5, 6.5]) rect(front, x, 0, 4.5, 0.2, 21.4, 23.7, 'limestone', cream);
    window(front, 0, 22.2, 2, 3.7, 0.2);
    if (fine(o))
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          g = frame(f, Math.sin(a) * 2.91, 0, Math.cos(a) * 2.91, a);
        window(g, 0, 59.4, 1.1, 1.8);
      }
  }
}
function site(o) {
  // Relative moat datum avoids a solid plinth masking the dry ditch and bridge spans.
  rect(o, -7, 0, 221, 235, 0, 0.08, 'foliage', [0.25, 0.3, 0.19]);
  rect(o, -7, -2, 182, 182, 0.08, 3, 'aggregate', [0.48, 0.46, 0.4]);
  for (const [a, b] of [
    [
      [-117, -117],
      [103, -117],
    ],
    [
      [103, -117],
      [103, 111],
    ],
    [
      [-117, 111],
      [-117, -117],
    ],
  ]) {
    const f = edge(o, a, b),
      l = Math.hypot(a[0] - b[0], a[1] - b[1]);
    rect(f, l / 2, 0, l, 0.8, 0.1, 3, 'brick', brick);
  }
  // Rear quarters and three genuinely open courts.
  for (const w of map.rearWings) wing(o, w);
  for (const a of map.arcades) arcade(o, a.a, a.b, a.depth, a.bays);
  squareTower(o, 18241943, 25, 5);
  squareTower(o, 18241948, 29, 5);
  squareTower(o, 18241950, 31, 5);
  curtain(o, [-100.5, -23], [-100.5, 80.4], { gate: 65.3 });
  curtain(o, [85.96, 80], [85.96, -26], { gate: 41.2 });
  curtain(o, [-90.5, 90.5], [-18.4, 90.5], { rooms: true });
  curtain(o, [5.1, 90.4], [75, 90.4], { rooms: true });
  // Courtyard side museum roofs, including the former Spanish hospital range.
  for (const id of [18241946, 18241952, 18241953]) {
    const p = part(id);
    solid(o, p, 3, 11);
    pitchedRoof(o, p, 11, 3);
    if (near(o)) {
      const b = bounds(p),
        horizontal = b[0][1] - b[0][0] > b[1][1] - b[1][0],
        a = horizontal ? [b[0][1], b[1][0]] : [b[0][1], b[1][1]],
        c = horizontal ? [b[0][0], b[1][0]] : [b[0][1], b[1][0]],
        f = edge(o, a, c),
        l = Math.hypot(a[0] - c[0], a[1] - c[1]);
      for (let x = 4; x < l; x += 5.6) window(f, x, 5.3, 2, 3.8);
    }
  }
  roundTower(o, -100.1, 90.3, 9.8);
  roundTower(o, 85.2, 89.7, 10.4);
  filarete(o);
  if (!low(o)) {
    const pool = feature(561440127);
    solid(o, pool, 3, 3.16, 'limestone', cream);
    const b = bounds(pool);
    rect(
      o,
      (b[0][0] + b[0][1]) / 2,
      (b[1][0] + b[1][1]) / 2,
      b[0][1] - b[0][0] - 0.5,
      b[1][1] - b[1][0] - 0.5,
      3.16,
      3.19,
      'glass',
      [0.24, 0.36, 0.32],
    );
    for (const [x, z, w, d] of [
      [29, -65, 57, 5],
      [29, -46, 57, 5],
      [-52, 20, 65, 63],
      [33, 20, 67, 63],
    ])
      rect(o, x, z, w, d, 3.015, 3.035, 'foliage', [0.27, 0.35, 0.2]);
  }
  // Ponticella is a covered projecting gallery with an exposed masonry arcade underneath.
  const pont = frame(o, 88, 0, -78.9);
  rect(pont, 10, 0, 22, 10.9, 7.4, 11.1);
  pitchedRoof(
    pont,
    [
      [0, -5.5],
      [22, -5.5],
      [22, 5.5],
      [0, 5.5],
    ],
    11.1,
    2.2,
  );
  for (const sign of [-1, 1]) {
    const f = frame(pont, sign === 1 ? 0 : 22, 0, sign * 5.45, sign === 1 ? 0 : Math.PI);
    if (!low(o))
      for (let i = 0; i < 4; i++) {
        rect(f, i * 7.33, -0.45, 0.8, 0.9, 0, 5.3);
        if (i < 3) arch(f, (i + 0.5) * 7.33, 3, 6.5, 3.7, 0.5, 0.9);
      }
    if (near(o)) for (let i = 0; i < 5; i++) window(f, ((i + 0.5) * 22) / 5, 8.1, 1.8, 2.6);
  }
  for (const id of [471850366, 471850368, 471850522, 471850604]) {
    const p = feature(id);
    solid(o, p, 2.7, 3.05, 'stone', stone);
    if (fine(o))
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length],
          l = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (l < 2) continue;
        const f = edge(o, a, b);
        rect(f, l / 2, 0, l, 0.08, 4, 4.07, 'metal', dark);
        for (let x = 0.5; x < l; x += 1.1) rect(f, x, 0, 0.055, 0.055, 3, 4, 'metal', dark);
      }
  }
  rect(o, -6.7, 104, 5, 29, 2.7, 3, 'stone', stone);
  if (near(o)) {
    const p = feature(121498331);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        l = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (l < 0.1) continue;
      rect(edge(o, a, b), l / 2, -0.65, l, 1.3, 0, 5 + (i % 3) * 0.4);
    }
  }
}
/** Runtime architecture is authored independently; repeated micro-masonry stays in the master. */
function runtimeSite(o) {
  const level = o.detail,
    skyline = low(o),
    close = level === 'closeup',
    street = near(o);
  const lite = { ...o, detail: 'district' };
  const flatWindow = (f, x, y, w, h, z = 0.06) =>
    face(
      f,
      'recess',
      [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h, z],
        [x - w / 2, y + h, z],
      ],
      dark,
    );
  const volume = (p, lo, hi, rise = 0) => {
    if (skyline) {
      const b = bounds(p),
        x = (b[0][0] + b[0][1]) / 2,
        z = (b[1][0] + b[1][1]) / 2,
        w = b[0][1] - b[0][0],
        d = b[1][1] - b[1][0];
      rect(o, x, z, w, d, lo, hi);
      if (rise) hip(o, x, z, w, d, hi, rise);
    } else {
      solid(o, p, lo, hi);
      if (rise) pitchedRoof(o, p, hi, rise);
    }
  };
  rect(o, -7, 0, 221, 235, 0, 0.08, 'foliage', [0.25, 0.3, 0.19]);
  rect(o, -7, -2, 182, 182, 0.08, 3, 'aggregate', [0.48, 0.46, 0.4]);
  for (const w of map.rearWings) {
    const p = part(w.relation);
    if (street) {
      wingBody(o, p, 3 + w.eaves, w.relation);
      pitchedRoof(o, p, 3 + w.eaves, w.rise);
    } else volume(p, 0, 3 + w.eaves, w.rise);
    if (!skyline)
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length],
          l = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (l < 5) continue;
        const f = edge(o, b, a);
        for (let x = 3; x < l - 1; x += 5.6) {
          flatWindow(f, x, 12.3, 1.8, 3.2);
          if (close) window({ ...f, detail: 'street' }, x, 12.3, 1.8, 3.2);
        }
      }
  }
  for (const [id, h, r] of [
    [18241943, 28, 5],
    [18241948, 32, 5],
    [18241950, 34, 5],
  ]) {
    const p = part(id);
    volume(p, 0, h, r);
    if (street)
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length],
          l = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (l < 5) continue;
        const f = edge(o, b, a);
        for (const y of [9, 16, 23]) for (let x = 4; x < l - 2; x += 6) flatWindow(f, x, y, 1.7, 3);
        if (close) corbels({ ...f, detail: 'street' }, l, h - 1);
      }
  }
  const wall = (a, b, d, gate) => {
    const f = edge(o, a, b),
      l = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (gate === undefined || skyline) rect(f, l / 2, -d / 2, l, d, 0, 19.1);
    else {
      rect(f, (gate - 2.2) / 2, -d / 2, gate - 2.2, d, 0, 19.1);
      rect(f, (gate + 2.2 + l) / 2, -d / 2, l - gate - 2.2, d, 0, 19.1);
      rect(f, gate, -d / 2, 4.4, d, 8.5, 19.1);
      if (street) arch(liteFrame(f), gate, 6, 4.4, 2, 0.4, d);
    }
    pitchedRoof(
      f,
      [
        [0, 0.5],
        [l, 0.5],
        [l, -d - 0.5],
        [0, -d - 0.5],
      ],
      19.1,
      1.15,
    );
    if (!skyline) for (let x = 2; x < l; x += street ? 2.3 : 4.6) flatWindow(f, x, 16.6, 0.9, 2.1);
    if (street) {
      for (let x = 7; x < l - 4; x += 10) {
        if (gate !== undefined && Math.abs(x - gate) < 4) continue;
        flatWindow(f, x, 6.5, 2.6, 5);
        if (close) window({ ...f, detail: 'street' }, x, 6.5, 2.6, 5, 0, { triple: true });
      }
      if (close) corbels({ ...f, detail: 'street' }, l, 16);
    }
  };
  function liteFrame(f) {
    return { ...f, detail: 'district' };
  }
  wall([-100.5, -23], [-100.5, 80.4], 5, 65.3);
  wall([85.96, 80], [85.96, -26], 5, 41.2);
  wall([-90.5, 90.5], [-18.4, 90.5], 9);
  wall([5.1, 90.4], [75, 90.4], 9);
  for (const id of [18241946, 18241952, 18241953]) volume(part(id), 3, 11, 3);
  for (const [x, z, r] of [
    [-100.1, 90.3, 9.8],
    [85.2, 89.7, 10.4],
  ]) {
    const n = skyline ? 8 : street ? 24 : 12;
    loft(
      o,
      'stone',
      [
        [0, r + 1],
        [3, r],
        [24, r],
      ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      stone,
    );
    loft(
      o,
      'brick',
      [
        [24, r],
        [26, r + 2],
        [31, r + 2],
      ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      brick,
    );
    loft(
      o,
      'tile',
      [
        [31, r + 2.45],
        [35.8, 0.5],
      ].map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      tile,
    );
    if (!skyline) cylinder(o, x, z, 0.17, 35.5, 38, 'metal', stone, 4);
    if (street)
      for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16,
          f = frame(o, x + Math.sin(a) * (r + 2.05), 0, z + Math.cos(a) * (r + 2.05), a);
        flatWindow(f, 0, 27, 0.6, 3.2);
        if (close) rect(f, 0, -0.5, 0.3, 1.1, 24.3, 26, 'limestone', cream);
      }
    if (close)
      for (let j = 0, yy = 3; yy < 24; yy += 1.05, j++)
        for (let i = 0; i < 40; i++) {
          const a = ((i + (j % 2) * 0.5) * Math.PI) / 20,
            b = a + Math.PI / 20 - 0.015,
            rr = r + 0.025;
          face(
            o,
            'stone',
            [
              [x + Math.sin(a) * rr, yy, z + Math.cos(a) * rr],
              [x + Math.sin(b) * rr, yy, z + Math.cos(b) * rr],
              [x + Math.sin(b) * rr, yy + 0.93, z + Math.cos(b) * rr],
              [x + Math.sin(a) * rr, yy + 0.93, z + Math.cos(a) * rr],
            ],
            tint(stone, 0.86 + ((i + j) % 7) * 0.03),
          );
        }
  }
  const f = frame(o, -6.7, 3, 82);
  for (const [w, d, lo, hi, r] of [
    [23.4, 17.1, 0, 29.7, 2.1],
    [12.2, 12.2, 31.8, 45, 0],
    [8.8, 8.8, 47, 57.7, 1.3],
  ]) {
    if (lo === 47 && !skyline) {
      for (const x of [-3.5, 3.5]) for (const z of [-3.5, 3.5]) rect(f, x, z, 1.8, 1.8, 47, 57.7);
      rect(f, 0, 0, w, d, 56.7, 57.7);
    } else if (lo === 0 && !skyline) {
      rect(f, -7, 0, 9.4, d, 0, hi);
      rect(f, 7, 0, 9.4, d, 0, hi);
      rect(f, 0, 0, 4.6, d, 8, hi);
    } else rect(f, 0, 0, w, d, lo, hi);
    if (r) hip(f, 0, 0, w + 2, d + 2, hi, r);
  }
  cylinder(f, 0, 0, 2.9, 59, 62, 'brick', brick, 8);
  loft(
    f,
    'copper',
    [
      [62, 3.25],
      [65.1, 2.45],
      [66.2, 0.4],
    ].map(([y, r]) => radialRing(y, r, r, 8)),
    [0.28, 0.37, 0.3],
  );
  cylinder(f, 0, 0, 0.15, 66.2, 70, 'metal', stone, 4);
  if (!skyline) {
    for (const a of [0, Math.PI]) {
      const g = frame(f, -Math.cos(a) * 12, 0, Math.cos(a) * 9, a);
      for (let x = 1; x < 24; x += 2) flatWindow(g, x, 26.6, 0.8, 2.6);
      if (street) corbels({ ...g, detail: 'street' }, 24, 26);
    }
    merlons(lite, -6.7, 82, 13.1, 13.1, 48);
    if (street) {
      clock(f, 0, 39.4, 6.15, 2.6);
      window(lite, -6.7, 16, 5.5, 6.5, 73.4);
      if (close)
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
          arch(
            frame(lite, -6.7 + Math.sin(a) * 4.2, 3, 82 + Math.cos(a) * 4.2, a),
            0,
            53,
            3.6,
            2,
            0.5,
            0.7,
          );
    }
  }
  volume(part(18241949), 7.4, 11.1, 2.2);
  if (street)
    for (const sign of [-1, 1]) {
      const g = frame(o, sign === 1 ? 88 : 110, 0, -78.9 + sign * 5.45, sign === 1 ? 0 : Math.PI);
      for (let i = 0; i < 4; i++) {
        rect(g, i * 7.33, -0.4, 0.8, 0.8, 0, 5.3);
        if (i < 3) arch(liteFrame(g), (i + 0.5) * 7.33, 3, 6.5, 3.7, 0.5, 0.8);
      }
      for (let i = 0; i < 5; i++) flatWindow(g, ((i + 0.5) * 22) / 5, 8.1, 1.8, 2.6);
    }
  rect(o, -6.7, 104, 5, 29, 2.7, 3, 'stone', stone);
  if (!skyline) {
    for (const id of [471850366, 471850368, 471850522, 471850604])
      solid(o, feature(id), 2.7, 3.05, 'stone', stone);
    const pool = feature(561440127);
    cap(o, pool, 3.18, 'glass', [0.24, 0.36, 0.32]);
    for (const [x, z, w, d] of [
      [29, -65, 57, 5],
      [29, -46, 57, 5],
      [-52, 20, 65, 63],
      [33, 20, 67, 63],
    ])
      rect(o, x, z, w, d, 3.015, 3.035, 'foliage', [0.27, 0.35, 0.2]);
  }
  if (street)
    for (const a of map.arcades) {
      const f = edge(o, a.a, a.b, 3),
        l = Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]),
        step = l / a.bays;
      rect(f, l / 2, -a.depth, l, 0.35, 0, 7.4, 'plaster', cream);
      rect(f, l / 2, -a.depth / 2, l, a.depth, 0.03, 0.2, 'limestone', cream);
      for (let i = 0; i <= a.bays; i++) {
        cylinder(f, i * step, 0.2, 0.24, 0.2, 3.5, 'limestone', cream, close ? 8 : 4);
        if (close) rect(f, i * step, 0.2, 0.7, 0.7, 3.5, 3.77, 'limestone', cream);
      }
      for (let i = 0; i < a.bays; i++) {
        const x = (i + 0.5) * step;
        archPanel(f, x, 0.4, 1.1, 2.8, -a.depth + 0.2);
        spandrel(f, x, 3.77, (step - 0.55) / 2 + 0.25, step * 0.45 + 0.25, 7.4, 0.25);
        arch(
          liteFrame(frame(f, 0, 0, 0.25)),
          x,
          3.77,
          step - 0.55,
          step * 0.45,
          0.25,
          0.25,
          'plaster',
          cream,
        );
      }
    }
}
export function buildSforzaRuntime(out, detail) {
  const o = {
    detail,
    addQuad: (...v) => out.addQuad(...v),
    addTriangle: (...v) => out.addTriangle(...v),
    addConvexPolygon: (...v) => out.addConvexPolygon(...v),
  };
  if (detail) runtimeSite(o);
  else site(o);
}
export const buildSforzaSkyline = (o) => buildSforzaRuntime(o, 'skyline');
export const sforzaStudy = {
  id: 'N0258',
  key: 'sforza_castle',
  title: 'Sforza Castle',
  category: 'castle',
  wikidataId: 'Q23354',
  mapFrame: 'map-frame.json',
  build: (o) => buildSforzaRuntime(o),
  brief:
    'Mapped Milan castle compound: Filarete clock tower and lantern, rough stone round city towers, square park towers, Torre di Bona, three open courts, column arcades, tiled museum ranges, wall walks, dry moat and Ponticella.',
  sourceFacts: {
    identity: 'Q23354, exact OSM relation/1918',
    mappedEnvelopeMeters: [219.957, 200.243],
    filareteApproximateHeightAboveCourtMeters: 70,
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'Mapped building-part footprints with exterior proportions interpreted from the regional heritage inventory and restoration contractor photographs.',
    referenceState:
      'Conserved present compound with reconstructed Filarete; not a medieval reconstruction.',
  },
  scaleBasis:
    'Horizontal meters from OSM. Approximate photographic vertical dimensions; courtyard sits 3 m above dry moat datum.',
  refs: [
    'https://www.openstreetmap.org/relation/1918',
    'https://www.lombardiabeniculturali.it/architetture/schede/LMD80-00374/',
    'https://operanavarra.it/en/project/castello-sforzesco-milano/',
    'https://www.milanocastello.it/scopri-il-castello/torri-merlate-e-sotterranei',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map data © OpenStreetMap contributors, ODbL-1.0. Original authored geometry; no reference images or third-party meshes embedded.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X toward northeast',
    front: '+Z toward city and Filarete gate; -Z toward park',
    origin: 'Mapped compound anchor, dry moat Y=0, courts Y=3',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft: terrain contact and in-world orientation pending',
    notes:
      'Includes relative dry moat and projecting Ponticella; nearby public fountain, civic sculpture and park omitted.',
  }),
  geographicNote:
    'Signed native map frame keeps the Filarete entrance on the southeast front. Precise terrain fit pending.',
  limitations: [
    'Maximum exterior fidelity pending: carved heraldry, equestrian relief, Saint Ambrose statue, frescoes, inscriptions and individual conservation scars are not reproduced.',
    'Heights, roof pitches, moat depth and arcade proportions are inferred from photographs, not a measured elevation survey. In-world placement remains draft; replaceFootprint=false.',
    'Gallery openings and gateways have geometry; enclosed museum interiors, collections and room circulation are outside this exterior model.',
    'Detailed master and four runtime levels share central procedural materials. Physical laptop/phone measurements remain pending.',
  ],
  camera: { position: [260, 175, 330], lookAt: [-7, 22, 0], fov: 43 },
  qaCameras: [
    { name: 'three-courtyards-and-roof-plan', position: [-8, 360, 20], lookAt: [-8, 10, 0] },
    { name: 'filarete-clock-and-lantern', position: [-69, 62, 160], lookAt: [-7, 42, 82] },
    { name: 'city-front-and-round-towers', position: [-5, 42, 266], lookAt: [-7, 24, 82] },
    { name: 'rusticated-carmine-tower', position: [132, 33, 134], lookAt: [85, 19, 89] },
    { name: 'rocchetta-courtyard-arcades', position: [-69, 24, -46], lookAt: [-52, 8, -68] },
    { name: 'ducal-court-and-pool', position: [22, 14, -48], lookAt: [32, 9, -68] },
    { name: 'park-front-square-towers', position: [-8, 53, -245], lookAt: [-8, 20, -90] },
    { name: 'ponticella-and-falconiera', position: [149, 31, -118], lookAt: [88, 17, -80] },
    { name: 'arms-court-and-bona-tower', position: [35, 23, 27], lookAt: [-33, 20, -24] },
  ],
};
