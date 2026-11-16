/** Amber Fort and its stepped palace courts in the surveyed map frame, in meters. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  base: { slot: 'foundation', graph: 'stone_sandstone_raw' },
  wall: { slot: 'wall', graph: 'stone_sandstone' },
  trim: { slot: 'trim', graph: 'plaster_lime' },
  marble: { slot: 'foundation', graph: 'stone_marble' },
  screen: { slot: 'window', graph: 'stone_checker_fine' },
  paint: { slot: 'door', graph: 'tile_mosaic' },
  roof: { slot: 'roof', graph: 'stone_ashlar' },
  gravel: { slot: 'foundation', graph: 'gravel' },
};
const gold = [0.69, 0.45, 0.22],
  pale = [0.76, 0.56, 0.3],
  cream = [0.72, 0.66, 0.48];
const red = [0.56, 0.25, 0.14],
  teal = [0.21, 0.4, 0.33];
const shadow = [0.25, 0.19, 0.13],
  verdigris = [0.38, 0.46, 0.29];
function emit(out, slot, p, n, color) {
  const normal = normalFor(...p);
  const q = normal.reduce((s, v, i) => s + v * n[i], 0) < 0 ? [...p].reverse() : p;
  const ns = normalFor(...q);
  if (q.length === 3) out.addTriangle(slot, '', q, ns, [], color);
  else out.addQuad(slot, '', q, ns, [], color);
}
const solid = (out, slot, footprint, low, high, color) =>
  prism((k, p, n) => emit(out, k, p, n, color), slot, footprint, low, high, false);
const block = (out, k, x, y, z, w, h, d, color) =>
  box(out, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color);
function frame(out, x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  const normal = ([u, v, w]) => [c * u - s * w, v, s * u + c * w];
  const point = (p) => normal(p).map((v, i) => v + [x, y, z][i]);
  return {
    addTriangle: (k, r, p, n, uv, t) => out.addTriangle(k, r, p.map(point), normal(n), uv, t),
    addQuad: (k, r, p, n, uv, t) => out.addQuad(k, r, p.map(point), normal(n), uv, t),
    addConvexPolygon: (k, r, p, n, uv, t) =>
      out.addConvexPolygon(k, r, p.map(point), normal(n), uv, t),
  };
}
function facade(out, slot, x, y, z, w, h, color) {
  emit(
    out,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    color,
  );
}
// Each piece is constructed as voussoirs and an open intrados. There is no fill across the passage.
function arch(
  out,
  x,
  y,
  z,
  w,
  h,
  depth,
  level,
  { pointed = false, slot = 'wall', color = gold } = {},
) {
  const spring = h * 0.58,
    rise = h * 0.42,
    radius = w / 2,
    n = level === 0 ? 3 : level === 1 ? 5 : level === 2 ? 7 : level === 3 ? 10 : 13;
  const sill = h + 0.48;
  const opening = (t) => {
    const xOff = radius * (2 * t - 1);
    const curve = pointed
      ? Math.sin(Math.PI * t) * (0.8 + 0.2 * (1 - Math.abs(2 * t - 1)))
      : Math.sin(Math.PI * t);
    return [x + xOff, y + spring + rise * curve];
  };
  for (let k = 0; k < n; k++) {
    const a = opening(k / n),
      b = opening((k + 1) / n);
    const light = color.map((v) => v * (1 + ((k % 3) - 1) * 0.065));
    for (const side of [-1, 1]) {
      const p = z + (side * depth) / 2;
      emit(
        out,
        slot,
        [
          [a[0], a[1], p],
          [b[0], b[1], p],
          [b[0], y + sill, p],
          [a[0], y + sill, p],
        ],
        [0, 0, side],
        light,
      );
      if (level >= 2) {
        const q = p + side * 0.026;
        emit(
          out,
          'trim',
          [
            [a[0], a[1] + 0.018, q],
            [b[0], b[1] + 0.018, q],
            [b[0], b[1] + 0.22, q],
            [a[0], a[1] + 0.22, q],
          ],
          [0, 0, side],
          cream,
        );
      }
    }
    emit(
      out,
      slot,
      [
        [a[0], a[1], z - depth / 2],
        [b[0], b[1], z - depth / 2],
        [b[0], b[1], z + depth / 2],
        [a[0], a[1], z + depth / 2],
      ],
      [0, -1, 0],
      light,
    );
  }
  if (level > 0)
    for (const side of [-1, 1])
      block(out, slot, x + side * (radius + 0.21), y, z, 0.43, spring + 0.48, depth, color);
}
function band(out, w, d, y, color) {
  block(out, 'trim', 0, y, 0, w, 0.22, d, color);
}
function parapet(out, w, d, y, level, color) {
  if (level === 0) return;
  const count = Math.max(2, Math.floor(w / (level >= 3 ? 1.22 : 2.28)));
  for (const sign of [-1, 1]) {
    block(out, 'wall', 0, y, (sign * d) / 2, w, 0.49, 0.39, color);
    if (level >= 2)
      for (let i = 0; i < count; i++)
        block(
          out,
          'wall',
          w * ((i + 0.5) / count - 0.5),
          y + 0.48,
          (sign * d) / 2,
          0.54,
          0.36,
          0.46,
          color,
        );
  }
}
function chhatri(out, x, y, z, r, h, level, closed = false) {
  const n = level === 0 ? 5 : level === 1 ? 6 : level === 4 ? 16 : 10;
  const rings = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [Math.cos(a), Math.sin(a)];
  });
  if (closed) block(out, 'wall', x, y, z, r * 1.38, h * 0.63, r * 1.38, pale);
  else {
    for (const [u, v] of rings) {
      const xx = x + u * r * 0.71,
        zz = z + v * r * 0.71,
        w = r * 0.125;
      if (level === 0) facade(out, 'trim', xx, y, zz, w, h * 0.61, cream);
      else block(out, 'trim', xx, y, zz, w, h * 0.61, w, cream);
    }
    if (level > 0) block(out, 'wall', x, y, z, r * 1.67, 0.21, r * 1.67, pale);
  }
  const rows =
    level === 0
      ? [
          [0.62, 1],
          [0.98, 0.17],
        ]
      : [
          [0.61, 1],
          [0.69, 0.92],
          [0.82, 0.65],
          [0.94, 0.28],
          [0.99, 0.095],
        ];
  for (let j = 1; j < rows.length; j++) {
    const [a, ra] = rows[j - 1],
      [b, rb] = rows[j];
    for (let i = 0; i < n; i++) {
      const p = rings[i],
        q = rings[(i + 1) % n];
      const pt = ([u, v], e, k) => [x + u * k * r, y + e * h, z + v * k * r];
      emit(
        out,
        'roof',
        [pt(p, a, ra), pt(q, a, ra), pt(q, b, rb), pt(p, b, rb)],
        [p[0] + q[0], 1, p[1] + q[1]],
        pale,
      );
    }
  }
  if (level >= 2) {
    block(out, 'trim', x, y + h * 0.6, z, 1.8 * r, 0.135, 1.8 * r, cream);
    block(out, 'roof', x, y + h * 0.975, z, r * 0.12, h * 0.16, r * 0.12, pale);
  }
}
function jali(out, x, y, z, w, h, level, color = cream) {
  facade(out, 'screen', x, y, z, w, h, shadow);
  if (level >= 2) {
    facade(out, 'trim', x, y + h, z + 0.018, w + 0.2, 0.16, color);
    facade(out, 'trim', x, y - 0.16, z + 0.018, w + 0.2, 0.16, color);
    facade(out, 'trim', x - w / 2 - 0.07, y, z + 0.018, 0.14, h, color);
    facade(out, 'trim', x + w / 2 + 0.07, y, z + 0.018, 0.14, h, color);
  }
  if (level >= 3) {
    const count = level === 4 ? 7 : 4;
    for (let j = 1; j < count; j++)
      facade(out, 'trim', x + w * (j / count - 0.5), y, z + 0.036, 0.062, h, color);
    if (level === 4)
      for (let j = 1; j < 5; j++)
        facade(out, 'trim', x, y + (h * j) / 5, z + 0.036, w, 0.048, color);
  }
}
function stair(out, x, y, z, w, rise, run, level) {
  const steps = level === 0 ? 2 : level === 1 ? 5 : Math.ceil(rise / (level === 4 ? 0.156 : 0.215));
  for (let i = 0; i < steps; i++)
    block(
      out,
      'marble',
      x,
      y + (i * rise) / steps - 0.16,
      z + run * ((i + 0.5) / steps - 0.5),
      w,
      rise / steps + 0.16,
      run / steps + 0.014,
      cream,
    );
}
function arcade(out, b, level) {
  const { w, d, h, kind } = b;
  const count = Math.max(3, Math.min(15, Math.round(w / (kind === 'audience' ? 3.4 : 4.5))));
  const bay = w / count,
    front = d / 2 - 0.53,
    soffit = h * (kind === 'audience' ? 0.68 : 0.53);
  const back = kind !== 'audience';
  if (back) block(out, 'wall', 0, -0.05, -d * 0.37, w, h, d * 0.21, pale);
  block(out, 'roof', 0, soffit + 0.37, 0, w + 0.78, 0.41, d + 0.83, pale);
  if (back && h > soffit + 1)
    block(out, 'wall', 0, soffit + 0.78, 0, w, h - soffit - 0.78, d * 0.96, gold);
  if (level > 0) band(out, w + 0.83, d + 0.94, soffit + 0.22, cream);
  for (let i = 0; i < count; i++) {
    if ((level === 0 && i % 3 !== 0) || (level === 1 && kind !== 'audience' && i % 2 === 1))
      continue;
    const x = bay * (i + 0.5 - count / 2);
    if (kind === 'audience') {
      for (const z of level >= 2 ? [-front, 0, front] : [-front, front]) {
        if (level === 0) facade(out, 'trim', x - bay * 0.4, 0, z, 0.52, soffit + 0.42, cream);
        else block(out, 'trim', x - bay * 0.4, 0, z, 0.52, soffit + 0.42, 0.52, cream);
        if (level >= 2)
          for (const y of [0.11, soffit - 0.32])
            block(out, 'marble', x - bay * 0.4, y, z, 0.7, 0.21, 0.7, cream);
      }
    } else {
      if (level >= 3) arch(out, x, 0, front, bay * 0.7, soffit, 0.6, 1, { color: pale });
      else {
        const span = bay * 0.75;
        for (const sign of [-1, 1])
          block(out, 'wall', x + sign * span * 0.51, 0, front, 0.46, soffit, 0.62, pale);
        facade(out, 'wall', x, soffit - 0.4, front + 0.29, span, 0.39, pale);
      }
      if (level >= 2)
        jali(
          out,
          x,
          soffit + 0.99,
          front + 0.66,
          bay * 0.52,
          Math.max(0.28, (h - soffit - 1.17) * 0.72),
          level,
        );
    }
  }
  if (level >= 3 && back) parapet(out, w + 0.14, d * 0.94, h, level, gold);
}
function ganesh(out, b, level) {
  const { w, d, h } = b,
    door = w * 0.31,
    base = h * 0.12;
  arch(out, 0, base, 0, door, h * 0.47, d * 0.95, level, { pointed: true, color: red });
  for (const sign of [-1, 1]) {
    block(out, 'wall', (sign * (w + door)) / 4, 0, 0, (w - door) / 2, base + h * 0.49, d, pale);
    if (level >= 1) {
      const x = sign * w * 0.297;
      facade(out, 'paint', x, 0.42, d * 0.506, w * 0.245, h * 0.49, red);
      for (const [yy, hh] of [
        [0.88, h * 0.17],
        [h * 0.31, h * 0.18],
      ]) {
        arch(out, x, yy, d * 0.51, w * 0.15, hh, 0.17, level, {
          pointed: true,
          slot: 'trim',
          color: cream,
        });
        jali(out, x, yy + 0.12, d * 0.529, w * 0.132, hh * 0.83, level, cream);
      }
      facade(out, 'paint', x, h * 0.069, d * 0.531, w * 0.175, h * 0.05, teal);
    }
  }
  const top = h * 0.61;
  block(out, 'wall', 0, top, 0, w, h - top, d, pale);
  band(out, w + 0.54, d + 0.55, top - 0.12, cream);
  band(out, w + 1.22, d + 0.93, h - 0.23, cream);
  if (level >= 1) {
    for (let i = 0; i < 5; i++) {
      const x = w * 0.165 * (i - 2);
      facade(out, 'paint', x, top + 0.51, d * 0.505, w * 0.141, h * 0.29, red);
      jali(out, x, top + 0.87, d * 0.523, w * 0.104, h * 0.195, level, cream);
      facade(out, 'paint', x, top + 0.27, d * 0.53, w * 0.108, 0.31, teal);
    }
    for (const sign of [-1, 1]) {
      const x = sign * (w * 0.205);
      facade(out, 'paint', x, base, d * 0.515, 0.39, h * 0.425, teal);
      if (level >= 3)
        for (let j = 0; j < 7; j++)
          block(out, 'trim', x, base + (j + 0.35) * 0.7, d * 0.53, 0.2, 0.27, 0.13, cream);
    }
  }
  chhatri(out, -w * 0.335, h, -0.06, d * 0.32, h * 0.22, level, true);
  chhatri(out, w * 0.335, h, -0.06, d * 0.32, h * 0.22, level, true);
  if (level > 0) {
    const span = w * 0.43;
    const rows = level >= 3 ? 8 : 4;
    for (let i = 0; i < rows; i++) {
      const v = (i / rows - 0.5) * Math.PI,
        u = ((i + 1) / rows - 0.5) * Math.PI;
      const roof = (t) => [Math.sin(t) * d * 0.38, h + 1.42 * Math.cos(t)];
      const [a, y] = roof(v),
        [b, yy] = roof(u);
      emit(
        out,
        'roof',
        [
          [-span / 2, y, a],
          [span / 2, y, a],
          [span / 2, yy, b],
          [-span / 2, yy, b],
        ],
        [0, 1, 0],
        red,
      );
      for (const side of [-1, 1])
        emit(
          out,
          'roof',
          [
            [(side * span) / 2, h, 0],
            [(side * span) / 2, y, a],
            [(side * span) / 2, yy, b],
          ],
          [side, 0, 0],
          red,
        );
    }
  }
  block(out, 'marble', 0, base - 0.26, 0, door * 0.97, 0.26, d * 1.01, cream);
  if (level >= 2) stair(frame(out, 0, 0, d * 0.725, Math.PI), 0, 0, 0, w * 0.33, base, 3.0, level);
}
function gateway(out, b, level) {
  const { w, d, h } = b,
    ww = w * 0.41;
  arch(out, 0, 0, 0, ww, h * 0.68, d, level, { color: b.kind === 'sunGate' ? red : pale });
  const width = (w - ww) / 2;
  for (const sign of [-1, 1]) {
    block(out, 'wall', (sign * (ww + width)) / 2, -0.64, 0, width, h + 0.64, d, pale);
    if (level >= 2) jali(out, sign * w * 0.36, h * 0.53, d * 0.512, w * 0.125, h * 0.21, level);
  }
  block(out, 'wall', 0, h * 0.68 + 0.49, 0, w, h * 0.32 - 0.49, d, pale);
  band(out, w + 0.76, d + 0.76, h, cream);
  parapet(out, w + 0.41, d, h + 0.22, level, gold);
  if (level >= 2)
    for (const sign of [-1, 1])
      chhatri(out, sign * w * 0.32, h + 0.26, 0, w * 0.145, h * 0.45, Math.min(level, 2), false);
}
function hall(out, b, level) {
  const { w, d, h } = b;
  const marble = b.kind === 'mirror';
  block(out, marble ? 'marble' : 'wall', 0, -0.04, 0, w, h, d, marble ? cream : pale);
  block(out, 'roof', 0, h - 0.09, 0, w + 0.75, 0.31, d + 0.79, marble ? cream : pale);
  if (level < 2) return;
  const bays = Math.min(12, Math.max(2, Math.floor(w / 3.6)));
  for (const side of [-1, 1]) {
    const front = frame(out, 0, 0, side * d * 0.506, side === 1 ? 0 : Math.PI);
    for (let i = 0; i < bays; i++) {
      const x = w * ((i + 0.5) / bays - 0.5),
        y = h * (marble ? 0.18 : 0.41),
        height = h * (marble ? 0.61 : 0.26);
      if (level >= 2 || marble) jali(front, x, y, 0, (w / bays) * 0.62, height, level, cream);
      if (level >= 3 && marble) {
        arch(front, x, y, 0.12, (w / bays) * 0.69, height, 0.16, level, {
          pointed: true,
          slot: 'trim',
          color: cream,
        });
        facade(front, 'paint', x, y - 0.23, 0.049, (w / bays) * 0.81, 0.22, red);
      }
    }
    if (level >= 2) {
      facade(front, 'trim', 0, h * 0.84, 0.04, w, 0.16, cream);
      facade(front, 'trim', 0, h * 0.28, 0.04, w, 0.18, cream);
    }
  }
  if (level >= 3) parapet(out, w, d, h + 0.17, level, pale);
  if (level >= 3 && b.kind === 'palace')
    for (let i = 0; i < bays; i++) {
      const x = w * ((i + 0.5) / bays - 0.5);
      block(out, 'trim', x, h * 0.42, d * 0.55, (w / bays) * 0.57, 0.22, 0.72, cream);
    }
}
function gardens(out, level) {
  const c = layout.courts.find((c) => c.name === 'Charbagh court');
  const ring = layout.garden;
  solid(out, 'gravel', { outline: ring }, c.y + 0.05, c.y + 0.29, [0.53, 0.47, 0.23]);
  if (level === 0) return;
  for (const x of [-36.4, -25.2])
    for (const z of [9, 27.4]) {
      block(out, 'marble', x, c.y + 0.26, z, 9.9, 0.3, 16.9, cream);
      block(out, 'gravel', x, c.y + 0.555, z, 8.91, 0.12, 15.91, verdigris);
      if (level >= 2)
        for (const sign of [-1, 1])
          block(out, 'gravel', x + sign * 2.55, c.y + 0.67, z, 0.64, 0.3, 14.8, verdigris);
    }
  block(out, 'marble', -30.8, c.y + 0.28, 18.35, 1.51, 0.24, 35.75, cream);
  block(out, 'marble', -30.7, c.y + 0.28, 18.35, 22.39, 0.24, 1.54, cream);
  chhatri(out, -30.7, c.y + 0.45, 18.35, 0.92, 1.45, level, false);
}
function build(out, level) {
  for (const t of layout.terraces) solid(out, 'base', t, t.bottom, t.y, gold);
  for (const court of layout.courts) {
    if (level > 0)
      solid(
        out,
        'gravel',
        { outline: court.ring },
        court.y - 0.46,
        court.y - 0.025,
        [0.66, 0.58, 0.49],
      );
    else {
      const r = court.ring,
        p = [court.x, court.y - 0.025, court.z];
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        emit(
          out,
          'gravel',
          [p, [a[0], p[1], a[1]], [b[0], p[1], b[1]]],
          [0, 1, 0],
          [0.66, 0.58, 0.49],
        );
      }
    }
  }
  for (const b of layout.details) {
    const local = frame(out, b.x, b.y, b.z, b.angle);
    if (
      level === 0 &&
      !['ganesh', 'sunGate', 'moonGate', 'audience', 'pavilion'].includes(b.kind)
    ) {
      if (b.w < 21) continue;
      const { w, d, h } = b;
      facade(local, 'wall', 0, 0, d / 2, w, h, pale);
      facade(frame(local, 0, 0, 0, Math.PI), 'wall', 0, 0, d / 2, w, h, gold);
      emit(
        local,
        'roof',
        [
          [-w / 2, h, -d / 2],
          [w / 2, h, -d / 2],
          [w / 2, h, d / 2],
          [-w / 2, h, d / 2],
        ],
        [0, 1, 0],
        pale,
      );
      continue;
    }
    switch (b.kind) {
      case 'ganesh':
        ganesh(local, b, level);
        break;
      case 'sunGate':
      case 'moonGate':
        gateway(local, b, level);
        break;
      case 'arcade':
      case 'audience':
        arcade(local, b, level);
        break;
      case 'pavilion':
        chhatri(
          local,
          0,
          0,
          0,
          b.w * 0.48,
          b.h,
          Math.min(level, b.name === 'Mahal roof pavilion' ? 2 : 3),
          b.name === 'Mahal roof pavilion',
        );
        break;
      default:
        hall(local, b, level);
    }
  }
  gardens(out, level);
  if (level >= 2) {
    for (const { x, y, z, w, rise, run } of layout.stairs) stair(out, x, y, z, w, rise, run, level);
  }
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
