/** Small original geometric lettering for permanent stadium signs and seat patterns. */
import { beam } from './authored-structure-mesh.mjs';

const shapes = {
  B: [
    [
      [0, 0],
      [0, 1],
      [0.7, 1],
      [1, 0.8],
      [0.7, 0.52],
      [0, 0.52],
    ],
    [
      [0.7, 0.52],
      [1, 0.3],
      [0.75, 0],
      [0, 0],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
      [0.65, 1],
      [1, 0.75],
      [1, 0.25],
      [0.65, 0],
      [0, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.5, 0.45],
      [1, 1],
      [1, 0],
    ],
  ],
  P: [
    [
      [0, 0],
      [0, 1],
      [0.8, 1],
      [1, 0.8],
      [1, 0.65],
      [0.8, 0.5],
      [0, 0.5],
    ],
  ],

  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.23, 0.45],
      [0.77, 0.45],
    ],
  ],
  C: [
    [
      [1, 0.9],
      [0.75, 1],
      [0.2, 1],
      [0, 0.8],
      [0, 0.2],
      [0.2, 0],
      [0.75, 0],
      [1, 0.1],
    ],
  ],
  E: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0.5],
      [0.8, 0.5],
    ],
  ],
  F: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    [
      [0, 0.5],
      [0.8, 0.5],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0.5],
      [1, 0.5],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
    [
      [0.15, 0],
      [0.85, 0],
    ],
    [
      [0.15, 1],
      [0.85, 1],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 1],
      [0, 0.5],
      [1, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.8, 1],
      [1, 0.8],
      [1, 0.65],
      [0.8, 0.5],
      [0, 0.5],
    ],
    [
      [0.5, 0.5],
      [1, 0],
    ],
  ],
  S: [
    [
      [1, 0.9],
      [0.8, 1],
      [0.2, 1],
      [0, 0.8],
      [0, 0.65],
      [0.2, 0.5],
      [0.8, 0.5],
      [1, 0.35],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
      [0, 0.1],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  V: [
    [
      [0, 1],
      [0.5, 0],
      [1, 1],
    ],
  ],
  0: [
    [
      [0.2, 0],
      [0, 0.2],
      [0, 0.8],
      [0.2, 1],
      [0.8, 1],
      [1, 0.8],
      [1, 0.2],
      [0.8, 0],
      [0.2, 0],
    ],
  ],
  4: [
    [
      [0.8, 0],
      [0.8, 1],
      [0, 0.3],
      [1, 0.3],
    ],
  ],
};
export function lettering(
  out,
  text,
  { width, height, y = 0, z = 0, color = [0.12, 0.19, 0.25], slot = 'metal', stroke = 0.14 } = {},
) {
  const advance = width / text.length,
    w = advance * 0.75;
  for (let i = 0; i < text.length; i++)
    for (const line of shapes[text[i]] ?? [])
      for (let j = 1; j < line.length; j++)
        beam(
          out,
          slot,
          [(i - text.length / 2) * advance + line[j - 1][0] * w, y + line[j - 1][1] * height, z],
          [(i - text.length / 2) * advance + line[j][0] * w, y + line[j][1] * height, z],
          stroke,
          stroke,
          color,
        );
}
export function letterAt(text, u, v, stroke = 0.15) {
  const i = Math.floor(u),
    x = (u - i) / 0.75;
  if (i < 0 || i >= text.length || x > 1 || v < 0 || v > 1) return false;
  for (const line of shapes[text[i]] ?? [])
    for (let j = 1; j < line.length; j++) {
      const a = line[j - 1],
        b = line[j],
        d = [b[0] - a[0], b[1] - a[1]],
        t = Math.max(
          0,
          Math.min(1, ((x - a[0]) * d[0] + (v - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1])),
        );
      if (Math.hypot(x - a[0] - t * d[0], v - a[1] - t * d[1]) < stroke) return true;
    }
  return false;
}
