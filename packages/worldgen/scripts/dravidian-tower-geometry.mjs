/** Receding Dravidian gateway vocabulary; current reviewed consumer: 'N0539'. */
import { box, loft } from './khmer-structure-geometry.mjs';

function diamond(f, role, x, y, z, w, h, d) {
  const top = [x, y + h, z],
    bottom = [x, y - h, z],
    ring = [
      [x - w, y, z],
      [x, y, z - d],
      [x + w, y, z],
      [x, y, z + d],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      normal = [(ring[i][0] + ring[j][0]) / 2 - x, 0, (ring[i][2] + ring[j][2]) / 2 - z];
    f(role, [ring[i], ring[j], top], [normal[0], 0.5, normal[2]]);
    f(role, [ring[j], ring[i], bottom], [normal[0], -0.5, normal[2]]);
  }
}
function figure(f, x, y, z, h, role, detail, pose) {
  const scale = h / 1.4;
  const at = (r, ps, n) =>
    f(
      r,
      ps.map(([u, v, w]) => [x + u * scale, y + v * scale, z + w * scale]),
      n,
    );
  loft(
    at,
    role,
    0,
    0,
    [
      [0, 0.45],
      [0.35, 0.35],
      [0.95, 0.46],
    ],
    false,
  );
  diamond(at, 'wall', 0, 1.14, 0, 0.22, 0.25, 0.2);
  if (detail >= 2) {
    loft(
      at,
      role,
      0,
      0,
      [
        [0, 0.55],
        [0.22, 0.33],
      ],
      false,
    );
    diamond(at, role, 0, 1.45, 0, 0.18, 0.18, 0.16);
    for (const side of [-1, 1]) {
      const arm = (r, ps, n) =>
        at(
          r,
          ps.map(([u, v, w]) => [u + side * 0.33, v + (pose % 2 ? u * side * 0.7 : 0), w]),
          n,
        );
      box(arm, 'wall', 0, 0.4, 0, 0.13, 0.5, 0.17);
    }
  }
  if (detail >= 3)
    for (const side of [-1, 1]) {
      diamond(at, role, side * 0.45, 0.98, 0.02, 0.13, 0.13, 0.12);
      box(at, 'gold', side * 0.21, 0.4, 0.2, 0.08, 0.11, 0.06);
    }
}
function barrel(f, role, width, depth, low, rise, detail) {
  const n = detail === 0 ? 3 : detail === 1 ? 5 : 8,
    points = Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [(depth / 2) * Math.cos(a), low + rise * Math.sin(a)];
    });
  for (let i = 0; i < n; i++) {
    const [v, y] = points[i],
      [w, z] = points[i + 1];
    f(
      role,
      [
        [-width / 2, y, v],
        [width / 2, y, v],
        [width / 2, z, w],
        [-width / 2, z, w],
      ],
      [0, 1, (v + w) / 2],
    );
  }
  for (const side of [-1, 1])
    f(
      role,
      points.map(([z, y]) => [(side * width) / 2, y, z]),
      [side, 0, 0],
    );
}
function miniFrame(f, x, y, z, w, h, detail) {
  for (const side of [-1, 1]) box(f, 'blue', x + (side * w) / 2, y, z - 0.04, 0.13, h, 0.2);
  const at = (r, ps, n) =>
    f(
      r,
      ps.map(([u, v, q]) => [x + u, v, z + q]),
      n,
    );
  barrel(at, 'rose', w + 0.3, 0.4, y + h, 0.35, detail);
}
export function buildDravidianTower(f, p, detail) {
  const w = p.width,
    d = p.depth,
    o = p.openingWidth,
    pier = (w - o) / 2,
    bottom = p.bottom ?? -0.6;
  for (const side of [-1, 1])
    box(f, 'stone', (side * (o + pier)) / 2, bottom, 0, pier, p.baseHeight - bottom, d);
  box(f, 'stone', 0, p.openingHeight, 0, o, p.baseHeight - p.openingHeight, d);
  if (detail >= 2)
    for (const side of [-1, 1])
      for (const u of [-w / 2 + 0.38, -o / 2 - 0.35, o / 2 + 0.35, w / 2 - 0.38]) {
        box(f, 'stone', u, 0, side * (d / 2 + 0.12), 0.42, p.baseHeight - 0.3, 0.3);
        for (const y of detail >= 2 ? [0.2, p.baseHeight - 0.8] : [])
          box(f, 'stone', u, y, side * (d / 2 + 0.2), 0.72, 0.23, 0.4);
      }
  for (let i = 0; i < p.tiers; i++) {
    const t = i / p.tiers,
      width = w * (1 - 0.65 * t),
      depth = d * (1 - 0.52 * t),
      y = p.baseHeight + i * p.tierHeight,
      role = ['blue', 'green', 'rose'][i % 3];
    box(f, role, 0, y, 0, width + 0.25, 0.32, depth + 0.25);
    loft(
      f,
      'wall',
      0,
      0,
      [
        [y + 0.32, width],
        [y + p.tierHeight - 0.28, width - (w * 0.65) / p.tiers],
      ],
      false,
      (k) => [
        [-k / 2, (-depth * k) / width / 2],
        [k / 2, (-depth * k) / width / 2],
        [k / 2, (depth * k) / width / 2],
        [-k / 2, (depth * k) / width / 2],
      ],
    );
    if (detail >= 1)
      for (const side of [-1, 1]) {
        const front = (r, ps, n) =>
          f(
            r,
            ps.map(([u, v, z]) => [u, v, side * (depth / 2 + 0.12 + z)]),
            [n[0], n[1], side * n[2]],
          );
        const count =
          detail === 1 ? 1 : Math.max(3, Math.round(width / (detail === 2 ? 3.6 : 2.1)));
        for (let j = 0; j < count; j++) {
          const x = -width / 2 + ((j + 0.5) * width) / count,
            hh = Math.min(2.15, p.tierHeight * 0.66);
          figure(front, x, y + 0.38, 0.12, hh, ['wall', 'rose', 'green'][(i + j) % 3], detail, j);
          if (detail >= 3)
            miniFrame(
              front,
              x,
              y + 0.38,
              0.12,
              Math.min(2.0, (width / count) * 0.82),
              hh * 1.28,
              detail,
            );
        }
        box(front, 'blue', 0, y + 0.42, 0, Math.max(1.1, width * 0.15), p.tierHeight - 0.75, 0.15);
        for (const u of detail >= 2 ? [-1, 1] : [])
          box(
            front,
            role,
            u * Math.max(0.65, width * 0.09),
            y + 0.45,
            0.2,
            0.25,
            p.tierHeight - 0.6,
            0.32,
          );
        if (detail >= 2)
          barrel(
            (r, ps, n) =>
              front(
                r,
                ps.map(([u, v, z]) => [u, v, z + 0.3]),
                n,
              ),
            'rose',
            Math.max(1.7, width * 0.21),
            0.55,
            y + p.tierHeight - 0.35,
            0.5,
            detail,
          );
        if (detail >= 3)
          for (const u of [-1, 1])
            diamond(
              front,
              'wall',
              u * (width / 2 - 0.3),
              y + p.tierHeight - 0.5,
              0.12,
              0.38,
              0.38,
              0.25,
            );
      }
    if (detail >= 3)
      for (const side of [-1, 1]) {
        const front = (r, ps, n) =>
            f(
              r,
              ps.map(([u, v, z]) => [side * (width / 2 + 0.1 + z), v, u]),
              [side * n[2], n[1], n[0]],
            ),
          count = Math.max(2, Math.round(depth / 2.7)),
          hh = Math.min(2.15, p.tierHeight * 0.66);
        for (let j = 0; j < count; j++) {
          const x = -depth / 2 + ((j + 0.5) * depth) / count;
          figure(
            front,
            x,
            y + 0.38,
            0.1,
            hh,
            ['wall', 'rose', 'green'][(i + j + 1) % 3],
            detail,
            j,
          );
          miniFrame(
            front,
            x,
            y + 0.38,
            0.1,
            Math.min(1.9, (depth / count) * 0.78),
            hh * 1.28,
            detail,
          );
        }
      }
  }
  const y = p.baseHeight + p.tiers * p.tierHeight,
    width = w * 0.39,
    depth = d * 0.48;
  box(f, 'blue', 0, y, 0, width + 0.4, 0.38, depth + 0.35);
  barrel(f, 'green', width, depth, y + 0.38, p.crestHeight * 0.57, detail);
  const count = detail === 0 ? 1 : 7;
  for (let i = 0; i < count; i++) {
    const x = ((i - (count - 1) / 2) * width) / (count + 1);
    diamond(f, 'gold', x, y + p.crestHeight * 0.66, 0, 0.13, p.crestHeight * 0.19, 0.13);
  }
  if (detail >= 1)
    for (const side of [-1, 1]) {
      const n = detail === 1 ? 3 : detail === 2 ? 5 : 9,
        at = (x, y) => [x, y, side * (depth / 2 + 0.14)],
        arc = (i, inner) => {
          const a = (i * Math.PI) / n;
          return at(
            Math.cos(a) * width * (inner ? 0.24 : 0.32),
            y + 0.6 + Math.sin(a) * p.crestHeight * (inner ? 0.58 : 0.75),
          );
        };
      for (let i = 0; i < n; i++)
        f('wall', [arc(i, false), arc(i + 1, false), arc(i + 1, true), arc(i, true)], [0, 0, side]);
      if (detail >= 3) {
        diamond(
          f,
          'blue',
          0,
          y + p.crestHeight * 0.4,
          side * (depth / 2 + 0.18),
          width * 0.09,
          p.crestHeight * 0.16,
          0.2,
        );
      }
    }
}
