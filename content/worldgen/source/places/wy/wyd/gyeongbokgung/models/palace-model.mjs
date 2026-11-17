/** Gyeongbokgung's axial palace courts and two waterfront pavilions. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  wood: { slot: 'door', graph: 'wood_plain' },
  paint: { slot: 'trim', graph: 'metal_painted' },
  pier: { slot: 'foundation', graph: 'stone_granite' },
  rail: { slot: 'foundation', graph: 'stone_limestone_weathered' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  court: { slot: 'foundation', graph: 'gravel' },
};
const tile = [0.115, 0.145, 0.191],
  red = [0.54, 0.17, 0.095],
  green = [0.22, 0.43, 0.31];
const dark = [0.29, 0.33, 0.28],
  paper = [0.67, 0.71, 0.54],
  white = [0.79, 0.75, 0.64];
const ochre = [0.79, 0.58, 0.27],
  blue = [0.18, 0.33, 0.55],
  stone = [0.63, 0.61, 0.55];

function face(out, slot, points, color, outside) {
  const n = normalFor(...points);
  const p = n.reduce((a, v, i) => a + v * outside[i], 0) < 0 ? [...points].reverse() : points;
  const normal = normalFor(...p);
  if (p.length === 3) out.addTriangle(slot, '', p, normal, [], color);
  else out.addQuad(slot, '', p, normal, [], color);
}
const block = (out, slot, x, y, z, w, h, d, c) =>
  box(out, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], c);
function frame(out, [x, z], y, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    n = ([u, v, w]) => [u * c - w * s, v, u * s + w * c];
  const point = (p) => n(p).map((v, i) => v + [x, y, z][i]);
  return {
    addTriangle: (k, r, p, v, uv, t) => out.addTriangle(k, r, p.map(point), n(v), uv, t),
    addQuad: (k, r, p, v, uv, t) => out.addQuad(k, r, p.map(point), n(v), uv, t),
    addConvexPolygon: (k, r, p, v, uv, t) => out.addConvexPolygon(k, r, p.map(point), n(v), uv, t),
  };
}
const mix = (a, b, t) => a + (b - a) * t;
const majorKinds = new Set(['stoneGate', 'doubleGate', 'throne', 'banquet', 'state', 'residence']);
function wallSides(out, slot, w, d, y, h, tone) {
  const corners = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    face(
      out,
      slot,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], h, b[1]],
        [a[0], h, a[1]],
      ],
      tone,
      [a[0] + b[0], 0, a[1] + b[1]],
    );
  }
}
function hipRoof(out, width, depth, y, rise, level, { longRidge = false, plain = false } = {}) {
  const w = width / 2,
    d = depth / 2,
    end = longRidge ? w * 0.82 : Math.max(w * 0.28, w - depth * 0.28);
  const tip = Math.min(0.96, depth * 0.069),
    gable = depth * 0.19;
  const xs = [-1, 1, 1, -1],
    zs = [-1, -1, 1, 1];
  function point(side, u, t) {
    const j = (side + 1) % 4;
    const x = mix(xs[side], xs[j], u),
      z = mix(zs[side], zs[j], u);
    const shoulder = Math.min(t / 0.71, 1);
    const height = t * t * 0.8 + t * 0.2;
    const corner = Math.pow(Math.abs(x * z), 3);
    return [
      x * mix(w, end, shoulder),
      y + rise * height + tip * corner * Math.pow(1 - t, 2),
      z * (t < 0.71 ? mix(d, gable, shoulder) : mix(gable, 0, (t - 0.71) / 0.29)),
    ];
  }
  if (level === 0) {
    const a = [-w, y + 0.28, -d],
      b = [w, y + 0.28, -d],
      c = [w, y + 0.28, d],
      d0 = [-w, y + 0.28, d];
    const u = [-end, y + rise, 0],
      v = [end, y + rise, 0];
    face(out, 'tile', [a, b, v, u], tile, [0, 1, -1]);
    face(out, 'tile', [d0, c, v, u], tile, [0, 1, 1]);
    face(out, 'tile', [a, d0, u], tile, [-1, 1, 0]);
    face(out, 'tile', [b, c, v], tile, [1, 1, 0]);
    return;
  }
  const folds =
    level === 1 ? [0, 0.71] : level === 2 ? [0, 0.35, 0.71] : [0, 0.24, 0.48, 0.71, 0.86];
  const segments = level < 3 ? 1 : plain ? 2 : 3;
  for (let side = 0; side < 4; side++) {
    const isEnd = side % 2 === 1,
      j = (side + 1) % 4,
      sideN = [xs[side] + xs[j], 0, zs[side] + zs[j]];
    const outward = [sideN[0], 1, sideN[2]];
    const rows = isEnd ? folds.filter((t) => t <= 0.71) : [...folds, 1];
    for (let i = 0; i < segments; i++) {
      const a = i / segments,
        b = (i + 1) / segments;
      for (let k = 1; k < rows.length; k++)
        face(
          out,
          'tile',
          [
            point(side, a, rows[k - 1]),
            point(side, b, rows[k - 1]),
            point(side, b, rows[k]),
            point(side, a, rows[k]),
          ],
          tile,
          outward,
        );
      if (level >= 2) {
        const a0 = point(side, a, 0),
          b0 = point(side, b, 0);
        face(out, 'tile', [a0, b0, [b0[0], y - 0.1, b0[2]], [a0[0], y - 0.1, a0[2]]], tile, sideN);
      }
    }
    if (isEnd)
      face(
        out,
        'wood',
        [point(side, 0, 0.71), point(side, 1, 0.71), point(side, 0, 1)],
        red,
        sideN,
      );
    if (level >= 2) {
      beam(out, 'tile', point(side, 0, 0), point(side, 0, 0.71), 0.13, 0.14, tile);
      if (level >= 3 && !isEnd && !plain) {
        const rolls = Math.min(55, Math.floor(width / (level === 4 ? 0.76 : 1.67)));
        for (let i = 1; i < rolls; i++) {
          const t = i / rolls;
          const p = [0, 0.38, 0.71, 1].map((v) => {
            const pt = point(side, t, v);
            pt[1] += 0.05;
            return pt;
          });
          for (let j = 1; j < p.length; j++) beam(out, 'tile', p[j - 1], p[j], 0.086, 0.075, tile);
        }
      }
    }
  }
  if (level >= 2) {
    block(out, 'tile', 0, y - 0.17, 0, width, 0.13, depth, tile);
    if (!plain) {
      block(out, 'rail', 0, y + rise - 0.05, 0, end * 2, 0.165, 0.17, stone);
      for (const sign of [-1, 1]) {
        beam(
          out,
          'tile',
          [sign * end * 0.88, y + rise + 0.025, 0],
          [sign * (end + 0.16), y + rise + 0.37, 0],
          0.16,
          0.16,
          tile,
        );
        if (level >= 3)
          for (let j = 0; j < (level === 4 ? 6 : 3); j++) {
            const p = point(sign > 0 ? 1 : 3, 0.07, 0.14 + j * 0.074);
            block(out, 'tile', p[0], p[1], p[2], 0.15, 0.23, 0.2, tile);
          }
      }
    }
  }
}
function front(out, w, z, y, h, side, bays, level, kind) {
  const open = ['gate', 'doubleGate', 'courtway', 'banquet'].includes(kind);
  const facing = kind === 'wall' ? red : green;
  const step = w / bays;
  const panel = (slot, x, dy, width, height, tone, offset) => {
    const zz = z + side * offset;
    face(
      out,
      slot,
      [
        [x - width / 2, dy, zz],
        [x + width / 2, dy, zz],
        [x + width / 2, dy + height, zz],
        [x - width / 2, dy + height, zz],
      ],
      tone,
      [0, 0, side],
    );
  };
  if (level >= 1) block(out, 'paint', 0, y + h - 0.21, z, w + 0.22, 0.21, 0.26, green);
  for (let i = 0; i <= bays; i++) {
    const x = step * (i - bays / 2),
      post = Math.min(0.43, step * 0.088);
    if (open || level >= 2) block(out, 'wood', x, y, z, post * 2, h - 0.08, post * 2, red);
    if (level >= 2) {
      block(out, 'pier', x, y - 0.01, z, post * 2.4, 0.15, post * 2.45, stone);
      block(out, 'paint', x, y + h - 0.36, z + side * 0.14, post * 2.15, 0.25, post * 2.78, green);
    }
    if (level >= 3) {
      block(out, 'paint', x, y + h - 0.13, z + side * 0.36, post * 2.98, 0.13, post * 3.79, ochre);
      if (i < bays)
        for (const n of [0.27, 0.58, 0.81]) {
          block(
            out,
            'paint',
            x + step * n,
            y + h - 0.16,
            z + side * 0.23,
            0.17,
            0.16,
            0.53,
            n === 0.58 ? blue : green,
          );
        }
    }
    if (i === bays || open || level < 2) continue;
    const xx = x + step / 2,
      ww = step * 0.77,
      hy = h * 0.61,
      offset = 0.026;
    panel('paint', xx, y + 0.18, ww, hy, facing, offset);
    if (kind === 'wall') continue;
    panel('plaster', xx, y + h * 0.31, ww * 0.86, h * 0.5, paper, 0.048);
    const cells = level >= 3 ? 5 : 3;
    for (let k = 1; k < cells; k++)
      panel(
        'paint',
        xx + ww * 0.86 * (k / cells - 0.5),
        y + h * 0.31,
        0.073,
        h * 0.5,
        facing,
        0.082,
      );
    panel('paint', xx, y + h * 0.54, ww * 0.86, 0.076, facing, 0.083);
    if (level >= 3) panel('paint', xx, y + h * 0.68, ww * 0.86, 0.066, facing, 0.083);
  }
}
function storey(out, w, d, y, h, bays, level, kind) {
  const open = ['gate', 'doubleGate', 'courtway', 'banquet'].includes(kind);
  const plastered = kind === 'wall';
  if (!open)
    wallSides(out, plastered ? 'plaster' : 'wood', w, d, y, y + h, plastered ? white : red);
  if (level === 0 && open) {
    for (let i = 0; i <= bays; i++) {
      const x = (i / bays - 0.5) * w;
      for (const side of [-1, 1])
        face(
          out,
          'wood',
          [
            [x - 0.28, y, (side * d) / 2],
            [x + 0.28, y, (side * d) / 2],
            [x + 0.28, y + h, (side * d) / 2],
            [x - 0.28, y + h, (side * d) / 2],
          ],
          red,
          [0, 0, side],
        );
    }
  } else if (level > 0) {
    for (const side of [-1, 1]) front(out, w, (side * d) / 2, y, h, side, bays, level, kind);
  }
  if (level >= 3 && kind !== 'wall' && kind !== 'banquet')
    for (const sign of [-1, 1])
      front(frame(out, [(sign * w) / 2, 0], 0, (sign * Math.PI) / 2), d, 0, y, h, 1, 3, 2, kind);
}
function stair(out, x, z, w, y, drop, run, direction, level) {
  const n = level < 2 ? 2 : level === 2 ? 9 : Math.min(29, Math.ceil(drop / 0.25));
  for (let i = 0; i < n; i++) {
    const step = drop / n + 0.1;
    block(
      out,
      'pier',
      x,
      y - (drop * (i + 1)) / n - step,
      z + (direction * run * (i + 0.5)) / n,
      w,
      step,
      run / n + 0.02,
      stone,
    );
  }
}
function balustrade(out, x0, x1, z0, z1, y, level, color = stone) {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const tips = (t, h) => [mix(x0, x1, t), y + h, mix(z0, z1, t)];
  beam(out, 'rail', tips(0, 0.69), tips(1, 0.69), 0.23, 0.19, color);
  if (level >= 2) {
    beam(out, 'rail', tips(0, 0.24), tips(1, 0.24), 0.19, 0.13, color);
    for (let i = 0, n = Math.max(2, Math.round(length / (level >= 3 ? 1.86 : 3.65))); i <= n; i++) {
      const [x, , z] = tips(i / n, 0);
      block(out, 'pier', x, y, z, 0.27, 0.91, 0.27, color);
    }
  }
}
function throne(out, b, p, level) {
  const { width: w, depth: d, floor, bottom } = p;
  block(out, 'pier', 0, bottom - floor, 0, w * 1.08, floor - bottom + 0.48, d * 1.15, stone);
  block(out, 'pier', 0, 0.48, 0, w * 1.01, 0.95, d * 1.04, stone);
  block(out, 'rail', 0, 1.43, 0, w * 0.94, 0.26, d * 0.92, stone);
  for (const [i, x] of [-w * 0.17, 0, w * 0.17].entries()) {
    const y = 1.69,
      run = d * 0.41,
      drop = y - p.stairContact[i];
    stair(out, x, d * 0.5, w * 0.13, y, drop, run, 1, level);
    if (level >= 2) {
      for (const side of [-1, 1]) {
        const a = x + side * w * 0.078,
          z = d * 0.5;
        beam(
          out,
          'rail',
          [a, y + 0.04, z],
          [a, p.stairContact[i] + 0.04, z + run],
          0.29,
          0.21,
          stone,
        );
      }
      const z = d * 0.54;
      if (i === 1)
        beam(
          out,
          'rail',
          [x, y - 0.34, z],
          [x, p.stairContact[i] + 0.27, d * 0.88],
          w * 0.065,
          0.15,
          stone,
        );
    }
  }
  if (level >= 3) {
    for (const sign of [-1, 1]) {
      balustrade(out, sign * w * 0.22, sign * w * 0.47, d * 0.48, d * 0.48, 1.42, level);
      balustrade(out, sign * w * 0.48, sign * w * 0.48, -d * 0.44, d * 0.46, 1.42, level);
    }
    for (const [x, z, y] of p.courtMarkers) {
      const marker = frame(out, [x, z], y - 0.1, 0);
      block(marker, 'pier', 0, 0, 0, 0.47, 0.24, 0.4, stone);
      block(marker, 'rail', 0, 0.24, 0, 0.31, 0.55, 0.29, stone);
      block(marker, 'pier', 0, 0.78, 0, 0.39, 0.12, 0.35, stone);
    }
  }
  const y = 1.69 + b.height;
  storey(out, w * 0.77, d * 0.67, 1.69, b.height, b.bays, level, 'state');
  hipRoof(out, w, d, y, d * 0.197, level);
  const upperY = y + d * 0.144;
  storey(out, w * 0.64, d * 0.54, upperY - 1.09, 3.76, b.bays, level, 'state');
  hipRoof(out, w * 0.86, d * 0.76, upperY + 2.67, d * 0.161, level);
  if (level >= 2) {
    block(out, 'wood', 0, upperY + 1.74, d * 0.282, 3.62, 0.64, 0.2, dark);
    block(out, 'paint', 0, upperY + 1.94, d * 0.3, 3.12, 0.095, 0.13, ochre);
  }
}

function gateArch(out, x, w, d, spring, rise, level) {
  const n = level === 0 ? 4 : level === 1 ? 9 : 14;
  const arch = (t) => [x - w * Math.cos(Math.PI * t), spring + rise * Math.sin(Math.PI * t)];
  for (let i = 0; i < n; i++) {
    const a = arch(i / n),
      b = arch((i + 1) / n),
      rib = 0.27;
    const height = spring + rise + 0.58;
    for (const side of [-1, 1]) {
      const z = (side * d) / 2;
      const tint = stone.map((v) => v * (1 + ((i % 4) - 1.5) * 0.028));
      face(
        out,
        'pier',
        [
          [a[0], a[1], z],
          [b[0], b[1], z],
          [b[0], height, z],
          [a[0], height, z],
        ],
        tint,
        [0, 0, side],
      );
      if (level >= 2)
        face(
          out,
          'rail',
          [
            [a[0], a[1] + 0.012, z + side * 0.03],
            [b[0], b[1] + 0.012, z + side * 0.03],
            [b[0], b[1] + rib, z + side * 0.03],
            [a[0], a[1] + rib, z + side * 0.03],
          ],
          stone,
          [0, 0, side],
        );
    }
    face(
      out,
      'pier',
      [
        [a[0], a[1], -d / 2],
        [a[0], a[1], d / 2],
        [b[0], b[1], d / 2],
        [b[0], b[1], -d / 2],
      ],
      stone,
      [0, -1, 0],
    );
  }
}
function gwanghwamun(out, b, p, level) {
  const { width: w, depth: d } = p,
    gateWidth = w * 0.69;
  const spring = 2.07,
    rise = 2.35,
    deck = spring + rise + 0.58;
  const opening = gateWidth * 0.073;
  const spacings = [-gateWidth * 0.273, 0, gateWidth * 0.273];
  for (const x of spacings) gateArch(out, x, opening, d * 0.91, spring, rise, level);
  const gaps = [-w / 2, ...spacings.flatMap((x) => [x - opening, x + opening]), w / 2];
  for (let i = 1; i < gaps.length; i += 2) {
    const a = gaps[i - 1],
      b = gaps[i];
    block(out, 'pier', (a + b) / 2, -1.17, 0, b - a, deck + 1.17, d * 0.91, stone);
  }
  block(out, 'rail', 0, deck, 0, w, 0.31, d * 0.95, stone);
  storey(out, gateWidth * 0.82, d * 0.63, deck + 0.31, b.height, b.bays, level, 'state');
  const y = deck + b.height + 0.32;
  hipRoof(out, gateWidth * 1.04, d, y, d * 0.205, level);
  const y2 = y + d * 0.13;
  storey(out, gateWidth * 0.69, d * 0.55, y2 - 0.75, 2.65, b.bays, level, 'state');
  hipRoof(out, gateWidth * 0.9, d * 0.87, y2 + 1.9, d * 0.214, level);
  if (level >= 2) {
    block(out, 'wood', 0, y2 + 0.85, d * 0.29, 3.04, 0.53, 0.19, dark);
    block(out, 'paint', 0, y2 + 1.04, d * 0.3, 2.54, 0.066, 0.18, ochre);
    const apron = frame(out, [0, d * 0.55], -0.24, 0);
    block(apron, 'court', 0, 0, 5.7, w * 0.79, 0.23, 12.0, [0.62, 0.57, 0.47]);
    for (const side of [-1, 1])
      balustrade(apron, side * w * 0.42, side * w * 0.42, 0, 11.8, 0.22, level);
  }
}
function banquet(out, b, p, level) {
  const { width: w, depth: d } = p;
  const baseY = -1.0;
  block(out, 'pier', 0, baseY - 1.4, 0, w * 0.98, 1.42, d * 0.99, stone);
  const count = level === 0 ? 3 : level === 1 ? 5 : 8;
  const rows = level === 0 ? 2 : level === 1 ? 4 : 6;
  for (let i = 0; i < count; i++)
    for (let j = 0; j < rows; j++) {
      const x = w * 0.81 * (i / (count - 1) - 0.5),
        z = d * 0.84 * (j / (rows - 1) - 0.5);
      const p = level >= 2 && i !== 0 && i !== count - 1 && j !== 0 && j !== rows - 1 ? 0.55 : 0.69;
      if (level === 0 && i !== 0 && i !== count - 1 && j !== 0 && j !== rows - 1) continue;
      block(out, 'pier', x, baseY, z, p, 3.67, p, stone);
      if (level >= 3) block(out, 'rail', x, 2.79, z, p * 1.33, 0.26, p * 1.33, stone);
    }
  const upper = 3.0,
    h = 3.42;
  block(out, 'wood', 0, upper, 0, w * 0.86, 0.3, d * 0.86, red);
  storey(out, w * 0.82, d * 0.77, upper + 0.32, h, b.bays, level, 'banquet');
  if (level >= 3)
    for (const side of [-1, 1])
      balustrade(
        out,
        -w * 0.413,
        w * 0.413,
        side * d * 0.407,
        side * d * 0.407,
        upper + 0.3,
        level,
        red,
      );
  hipRoof(out, w, d, upper + 0.32 + h, d * 0.199, level);
}
function island(out, p, level) {
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI * (i / 3 + 1 / 6);
    return [Math.cos(a) * p.width * 0.51, Math.sin(a) * p.depth * 0.52];
  });
  const step = (a, b, t, y) => [mix(a[0], b[0], t), y, mix(a[1], b[1], t)];
  for (let i = 0; i < 6; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 6],
      n = [a[0] + b[0], 1, a[1] + b[1]];
    const at = (p, k, y) => [p[0] * k, y, p[1] * k];
    face(
      out,
      'pier',
      [at(a, 0.86, -1), at(b, 0.86, -1), at(b, 0.86, 0.28), at(a, 0.86, 0.28)],
      stone,
      [n[0], 0, n[2]],
    );
    face(out, 'pier', [[0, 0.28, 0], at(a, 0.86, 0.28), at(b, 0.86, 0.28)], stone, [0, 1, 0]);
    for (const [y, scale, height] of [
      [0.29, 1, 2.36],
      [2.67, 0.83, 2.39],
    ]) {
      const u = at(a, scale * 0.68, y),
        v = at(b, scale * 0.68, y);
      face(out, 'wood', [u, v, [v[0], y + height, v[2]], [u[0], y + height, u[2]]], red, n);
      const mid = step(u, v, 0.5, y + 0.77);
      const dx = v[0] - u[0],
        dz = v[2] - u[2],
        norm = Math.hypot(dx, dz);
      const pane = frame(
        out,
        [mid[0] + n[0] * 0.011, mid[2] + n[2] * 0.011],
        mid[1],
        Math.atan2(dz, dx),
      );
      for (let j = 0; j < (level >= 2 ? 5 : 1); j++) {
        const count = level >= 2 ? 5 : 1,
          x = norm * 0.8 * ((j + 0.5) / count - 0.5);
        face(
          pane,
          'plaster',
          [
            [x - (norm * 0.35) / count, 0, 0],
            [x + (norm * 0.35) / count, 0, 0],
            [x + (norm * 0.35) / count, 1.04, 0],
            [x - (norm * 0.35) / count, 1.04, 0],
          ],
          paper,
          [0, 0, -1],
        );
      }
      const y0 = y + height;
      if (level >= 2)
        beam(
          out,
          'paint',
          at(a, scale * 0.7, y0 - 0.11),
          at(b, scale * 0.7, y0 - 0.11),
          0.23,
          0.15,
          green,
        );
      const crest = y > 1 ? 7.44 : 3.88;
      const p0 = at(a, scale, y0 + 0.39),
        p1 = at(b, scale, y0 + 0.39);
      if (level >= 1) {
        const q = at(a, scale * 0.54, mix(y0, crest, 0.24)),
          r = at(b, scale * 0.54, mix(y0, crest, 0.24));
        const mid = step(p0, p1, 0.5, y0 + 0.04);
        const rim = step(q, r, 0.5, q[1]);
        face(out, 'tile', [p0, mid, q], tile, n);
        face(out, 'tile', [mid, rim, q], tile, n);
        face(out, 'tile', [mid, p1, r], tile, n);
        face(out, 'tile', [mid, r, rim], tile, n);
        face(
          out,
          'tile',
          y > 1
            ? [q, r, [0, crest, 0]]
            : [q, r, at(b, scale * 0.22, crest), at(a, scale * 0.22, crest)],
          tile,
          n,
        );
      } else face(out, 'tile', [p0, p1, [0, crest, 0]], tile, n);
    }
  }
  if (level >= 2) block(out, 'paint', 0, 7.38, 0, 0.17, 0.67, 0.17, green);
}
function hall(out, b, p, level) {
  const { width: w, depth: d, floor, bottom } = p,
    kind = b.kind;
  if (kind === 'throne') return throne(out, b, p, level);
  if (kind === 'stoneGate') return gwanghwamun(out, b, p, level);
  if (kind === 'banquet') return banquet(out, b, p, level);
  if (kind === 'island') return island(out, p, level);
  const major = majorKinds.has(kind),
    detail = major
      ? kind === 'state' || kind === 'residence'
        ? Math.min(level, 2)
        : level
      : Math.min(Math.max(0, level - 2), 1);
  const open = kind === 'gate' || kind === 'doubleGate';
  const h = Math.min(b.height, d * 0.44 + 0.77);
  const floorsHeight = Math.max(floor - bottom, 0.33);
  if (!open) {
    if (detail > 0)
      block(out, 'pier', 0, -floorsHeight, 0, w * 0.88, floorsHeight, d * 0.81, stone);
    else if (floorsHeight > 1.2)
      wallSides(out, 'pier', w * 0.84, d * 0.79, -floorsHeight, 0, stone);
  } else if (detail > 0) {
    block(out, 'pier', 0, -0.44, 0, w * 0.88, 0.4, d * 0.82, stone);
  }
  const bays = Math.max(2, Math.min(b.bays, Math.round(w / 3.2)));
  storey(out, w * 0.82, d * 0.69, 0, h, bays, detail, kind);
  hipRoof(out, w, d, h, Math.min(4.8, d * 0.234), detail, {
    longRidge: kind === 'wall' || kind === 'residence',
    plain: kind === 'residence' || !major,
  });
  if (kind === 'doubleGate') {
    const y = h + d * 0.14;
    storey(out, w * 0.59, d * 0.5, y - 0.77, 2.56, bays, detail, 'state');
    hipRoof(out, w * 0.82, d * 0.77, y + 1.79, d * 0.203, detail);
  }
  if (level >= 3 && detail >= 2 && !open && w > 10)
    stair(out, 0, d * 0.4, Math.min(w * 0.52, 10), 0, 0.68, 1.47, 1, detail);
}

function footbridge(out, level) {
  const { start, end, heights, width } = layout.bridge;
  const dx = end[0] - start[0],
    dz = end[1] - start[1],
    length = Math.hypot(dx, dz);
  const local = frame(out, start, 0, Math.atan2(dz, dx));
  const y = (t) => mix(...heights, t) + 5.1 * t * (1 - t);
  const n = level === 0 ? 3 : level <= 2 ? 6 : 18;
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n,
      x = length * a,
      xx = length * b,
      z = width / 2;
    face(
      local,
      'wood',
      [
        [x, y(a), -z],
        [xx, y(b), -z],
        [xx, y(b), z],
        [x, y(a), z],
      ],
      white,
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      face(
        local,
        'wood',
        [
          [x, y(a) - 0.25, side * z],
          [xx, y(b) - 0.25, side * z],
          [xx, y(b), side * z],
          [x, y(a), side * z],
        ],
        green,
        [0, 0, side],
      );
      if (level > 0)
        beam(
          local,
          'paint',
          [x, y(a) + 1.04, side * z],
          [xx, y(b) + 1.04, side * z],
          0.11,
          0.14,
          green,
        );
      if (level >= 3)
        beam(
          local,
          'paint',
          [x, y(a) + 0.48, side * z],
          [xx, y(b) + 0.48, side * z],
          0.088,
          0.089,
          green,
        );
    }
  }
  if (level >= 3)
    for (const side of [-1, 1])
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        block(local, 'wood', length * t, y(t), (side * width) / 2, 0.12, 1.16, 0.14, green);
      }
}
function build(out, level) {
  for (const b of layout.buildings)
    for (const p of b.parts) {
      if (level === 0 && !majorKinds.has(b.kind) && b.kind !== 'island' && p.width * p.depth < 302)
        continue;
      if (level === 0 && !majorKinds.has(b.kind) && b.kind !== 'island') {
        const o = frame(out, p.center, p.floor, p.angle);
        wallSides(
          o,
          'plaster',
          p.width * 0.81,
          p.depth * 0.73,
          p.bottom - p.floor,
          b.height,
          white,
        );
        hipRoof(o, p.width, p.depth, b.height, p.depth * 0.23, 0);
        continue;
      }
      hall(frame(out, p.center, p.floor, p.angle), b, p, level);
    }
  footbridge(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
