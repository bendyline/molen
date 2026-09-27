/** Small deterministic mesh vocabulary for authored structure studies. Units are meters, +Y up. */

const uv = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const ref = 'palette:#ffffff';

export const colors = {
  stone: [0.67, 0.64, 0.57],
  paleStone: [0.82, 0.8, 0.73],
  concrete: [0.57, 0.59, 0.59],
  steel: [0.32, 0.38, 0.43],
  glass: [0.08, 0.19, 0.25],
  blueGlass: [0.16, 0.32, 0.39],
  copper: [0.34, 0.51, 0.48],
  brick: [0.55, 0.26, 0.2],
  white: [0.86, 0.87, 0.83],
  dark: [0.15, 0.19, 0.21],
  roof: [0.36, 0.39, 0.4],
  road: [0.18, 0.19, 0.2],
  orange: [0.77, 0.32, 0.14],
  gold: [0.72, 0.59, 0.29],
  green: [0.24, 0.4, 0.32],
};

export function quad(out, slot, points, normal, color) {
  out.addQuad(slot, ref, points, normal, uv, color);
}

export function box(out, slot, lo, hi, color) {
  const [x0, y0, z0] = lo;
  const [x1, y1, z1] = hi;
  quad(
    out,
    slot,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 0, 1],
    color,
  );
  quad(
    out,
    slot,
    [
      [x1, y0, z0],
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
    ],
    [0, 0, -1],
    color,
  );
  quad(
    out,
    slot,
    [
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
    ],
    [-1, 0, 0],
    color,
  );
  quad(
    out,
    slot,
    [
      [x1, y0, z1],
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
    ],
    [1, 0, 0],
    color,
  );
  quad(
    out,
    slot,
    [
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    [0, 1, 0],
    color,
  );
  quad(
    out,
    slot,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    [0, -1, 0],
    color,
  );
}

function norm(v) {
  const d = Math.hypot(...v) || 1;
  return v.map((n) => n / d);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function tube(out, slot, a, b, radius, color, sides = 6) {
  const axis = norm(b.map((v, i) => v - a[i]));
  const across = norm(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
  const other = norm(cross(axis, across));
  const ring = (center, angle) =>
    center.map((v, i) => v + radius * (Math.cos(angle) * across[i] + Math.sin(angle) * other[i]));
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    const normal = norm(across.map((v, k) => Math.cos(mid) * v + Math.sin(mid) * other[k]));
    quad(out, slot, [ring(a, a0), ring(a, a1), ring(b, a1), ring(b, a0)], normal, color);
  }
  out.addConvexPolygon(
    slot,
    ref,
    Array.from({ length: sides }, (_, i) => ring(a, (i / sides) * Math.PI * 2)),
    axis.map((v) => -v),
    (p) => [p[0], p[2]],
    color,
  );
  out.addConvexPolygon(
    slot,
    ref,
    Array.from({ length: sides }, (_, i) => ring(b, (i / sides) * Math.PI * 2)),
    axis,
    (p) => [p[0], p[2]],
    color,
  );
}

export function profile(out, layers, sides = 24, center = [0, 0]) {
  const point = (y, rx, rz, t) => [center[0] + rx * Math.cos(t), y, center[1] + rz * Math.sin(t)];
  for (let j = 0; j < layers.length - 1; j++) {
    const [y0, rx0, rz0] = layers[j];
    const [y1, rx1, rz1, slot, color] = layers[j + 1];
    for (let i = 0; i < sides; i++) {
      const t0 = (i / sides) * Math.PI * 2;
      const t1 = ((i + 1) / sides) * Math.PI * 2;
      const m = (t0 + t1) / 2;
      const normal = norm([
        ((y1 - y0) * Math.cos(m)) / Math.max(rx1, 0.01),
        (rx0 - rx1 + rz0 - rz1) / 2,
        ((y1 - y0) * Math.sin(m)) / Math.max(rz1, 0.01),
      ]);
      quad(
        out,
        slot,
        [
          point(y0, rx0, rz0, t0),
          point(y0, rx0, rz0, t1),
          point(y1, rx1, rz1, t1),
          point(y1, rx1, rz1, t0),
        ],
        normal,
        color,
      );
    }
  }
  for (const [layer, normal, slotIndex] of [
    [layers[0], [0, -1, 0], 1],
    [layers.at(-1), [0, 1, 0], layers.length - 1],
  ]) {
    const [y, rx, rz] = layer;
    const [, , , slot, color] = layers[slotIndex];
    out.addConvexPolygon(
      slot,
      ref,
      Array.from({ length: sides }, (_, i) => point(y, rx, rz, (i / sides) * Math.PI * 2)),
      normal,
      (p) => [p[0], p[2]],
      color,
    );
  }
}

export function prism(out, slot, footprint, y0, y1, color) {
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    const normal = norm([b[1] - a[1], 0, a[0] - b[0]]);
    quad(
      out,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      normal,
      color,
    );
  }
  out.addConvexPolygon(
    slot,
    ref,
    footprint.map(([x, z]) => [x, y0, z]),
    [0, -1, 0],
    (p) => [p[0], p[2]],
    color,
  );
  out.addConvexPolygon(
    slot,
    ref,
    footprint.map(([x, z]) => [x, y1, z]),
    [0, 1, 0],
    (p) => [p[0], p[2]],
    color,
  );
}

export function gable(out, x0, x1, z0, z1, y, rise, color) {
  const mid = (z0 + z1) / 2;
  quad(
    out,
    'roof',
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y + rise, mid],
      [x0, y + rise, mid],
    ],
    [0, 0.6, -0.8],
    color,
  );
  quad(
    out,
    'roof',
    [
      [x1, y, z1],
      [x0, y, z1],
      [x0, y + rise, mid],
      [x1, y + rise, mid],
    ],
    [0, 0.6, 0.8],
    color,
  );
  for (const x of [x0, x1]) {
    out.addConvexPolygon(
      'roof',
      ref,
      [
        [x, y, z0],
        [x, y, z1],
        [x, y + rise, mid],
      ],
      [x === x0 ? -1 : 1, 0, 0],
      (p) => [p[2], p[1]],
      color,
    );
  }
}

export function arch(out, cx, y0, halfWidth, rise, z, depth, radius, color, steps = 10) {
  for (let i = 0; i < steps; i++) {
    const t0 = Math.PI - (i / steps) * Math.PI;
    const t1 = Math.PI - ((i + 1) / steps) * Math.PI;
    const p = (t, zz) => [cx + halfWidth * Math.cos(t), y0 + rise * Math.sin(t), zz];
    tube(out, 'trim', p(t0, z), p(t1, z), radius, color, 5);
    if (depth > 0) tube(out, 'trim', p(t0, z + depth), p(t1, z + depth), radius, color, 5);
  }
}

export function facade(
  out,
  width,
  depth,
  height,
  color,
  { floors = 8, cols = 8, podium = 0, glass = colors.glass } = {},
) {
  box(out, 'wall', [-width / 2, 0, -depth / 2], [width / 2, height, depth / 2], color);
  const level = (height - podium) / (floors + 0.5);
  for (let f = 0; f < floors; f++) {
    const y = podium + (f + 0.5) * level;
    for (let c = 0; c < cols; c++) {
      const x = -width / 2 + ((c + 0.5) * width) / cols;
      const pane = Math.min((width / cols) * 0.66, 5);
      box(
        out,
        'window',
        [x - pane / 2, y - level * 0.25, depth / 2 + 0.015],
        [x + pane / 2, y + level * 0.25, depth / 2 + 0.06],
        glass,
      );
      box(
        out,
        'window',
        [x - pane / 2, y - level * 0.25, -depth / 2 - 0.06],
        [x + pane / 2, y + level * 0.25, -depth / 2 - 0.015],
        glass,
      );
    }
  }
  for (let f = 1; f < floors; f++) {
    const y = podium + f * level;
    box(
      out,
      'trim',
      [-width / 2 - 0.1, y, -depth / 2 - 0.1],
      [width / 2 + 0.1, y + 0.24, depth / 2 + 0.1],
      color,
    );
  }
}

export function framedDeck(out, length, width, height, deckColor = colors.road) {
  box(
    out,
    'foundation',
    [-length / 2, height - 2, -width / 2],
    [length / 2, height - 0.4, width / 2],
    colors.concrete,
  );
  box(
    out,
    'roof',
    [-length / 2, height - 0.4, -width / 2],
    [length / 2, height, width / 2],
    deckColor,
  );
  for (const z of [-width / 2, width / 2]) {
    box(
      out,
      'trim',
      [-length / 2, height, z - 0.35],
      [length / 2, height + 1.2, z + 0.35],
      colors.steel,
    );
  }
}
