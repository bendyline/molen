/**
 * Canonical low-poly identity markers and street furniture. No bitmap or font download.
 * Signs are 4 x 1.35 m, centered on X, base Y=0, front +Z. Reuse through ModelLibrary
 * or encode the same buffers with encodeGlb for a static asset.
 */
import { dmath } from '@bendyline/molen-kernel/determinism';
import type { LandmarkDefinitions, SignDesign } from './landmark-types';
import { MeshBufferBuilder } from './mesh-buffers';
import { modelBox, modelStroke } from './model-primitives';
import { parseColor } from './schema-common';
import type { MeshBuffers, Vec2 } from './types';

export type { SignDesign } from './landmark-types';

// A tiny deterministic block-letter alphabet; contiguous runs are quads, not tiny cubes.
const FONT: Readonly<Record<string, string>> = {
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '11111/00100/00100/00100/00100/00100/11111',
  J: '00111/00010/00010/00010/10010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/11011/10001',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
};
function lettering(
  out: MeshBufferBuilder,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  z: number,
  color: string,
): void {
  const cell = Math.min(width / Math.max(1, text.length * 6 - 1), height / 7);
  let cursor = x - ((text.length * 6 - 1) * cell) / 2;
  for (const character of text) {
    const rows = FONT[character]?.split('/') ?? [];
    rows.forEach((row, r) => {
      for (let start = 0; start < 5; start++) {
        if (row[start] !== '1') continue;
        let end = start + 1;
        while (end < 5 && row[end] === '1') end++;
        const left = cursor + start * cell,
          right = cursor + end * cell,
          bottom = y + (2.5 - r) * cell,
          top = bottom + cell;
        out.addQuad(
          'trim',
          'palette:#ffffff',
          [
            [left, bottom, z],
            [right, bottom, z],
            [right, top, z],
            [left, top, z],
          ],
          [0, 0, 1],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          parseColor(color),
        );
        start = end - 1;
      }
    });
    cursor += 6 * cell;
  }
}
function disc(
  out: MeshBufferBuilder,
  x: number,
  y: number,
  r: number,
  z: number,
  color: string,
  segments: number,
): void {
  for (let i = 0; i < segments; i++) {
    const a = (i * dmath.TAU) / segments,
      b = ((i + 1) * dmath.TAU) / segments;
    out.addTriangle(
      'trim',
      'palette:#ffffff',
      [
        [x, y, z],
        [x + dmath.cos(a) * r, y + dmath.sin(a) * r, z],
        [x + dmath.cos(b) * r, y + dmath.sin(b) * r, z],
      ],
      [0, 0, 1],
      [
        [0.5, 0.5],
        [0, 0],
        [1, 0],
      ],
      parseColor(color),
    );
  }
}
export function generateSignModel(design: SignDesign, detail: 0 | 1 | 2 = 0): MeshBuffers {
  const out = new MeshBufferBuilder();
  modelBox(out, [0, 0.675, 0], [4, 1.35, 0.18], design.background);
  const x = -1.35,
    y = 0.675,
    z = 0.102,
    steps = detail === 0 ? 12 : 8;
  if (design.symbol === 'arches') {
    for (let wing = 0; wing < 2; wing++) {
      const points: Vec2[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        points.push([x - 0.47 + wing * 0.47 + t * 0.47, 0.25 + 0.84 * 4 * t * (1 - t)]);
      }
      modelStroke(out, points, 0.1, z, design.mark);
    }
  } else if (design.symbol === 'spark') {
    for (let i = 0; i < 6; i++) {
      const a = (i * dmath.TAU) / 6;
      modelStroke(
        out,
        [
          [x + dmath.cos(a) * 0.19, y + dmath.sin(a) * 0.19],
          [x + dmath.cos(a) * 0.48, y + dmath.sin(a) * 0.48],
        ],
        0.12,
        z,
        design.mark,
      );
    }
  } else if (design.symbol === 'target' || design.symbol === 'disc' || design.symbol === 'cup') {
    disc(out, x, y, 0.49, z, design.mark, steps * 2);
    if (design.symbol === 'target') {
      disc(out, x, y, 0.33, z + 0.005, design.background, steps * 2);
      disc(out, x, y, 0.17, z + 0.01, design.mark, steps * 2);
    }
    if (design.symbol === 'disc')
      lettering(out, design.letters ?? 'S', x, y, 0.5, 0.65, z + 0.005, design.background);
    if (design.symbol === 'cup') {
      disc(out, x, y, 0.4, z + 0.005, design.background, steps * 2);
      modelStroke(
        out,
        [
          [x - 0.19, y + 0.17],
          [x - 0.15, y - 0.18],
          [x + 0.15, y - 0.18],
          [x + 0.19, y + 0.17],
        ],
        0.07,
        z + 0.01,
        design.mark,
      );
      modelStroke(
        out,
        [
          [x - 0.27, y - 0.27],
          [x + 0.27, y - 0.27],
        ],
        0.06,
        z + 0.01,
        design.mark,
      );
    }
  } else if (
    ['tag', 'roofline', 'star', 'burger', 'bell', 'bucket', 'domino'].includes(design.symbol)
  ) {
    // Flat, front-facing emblems keep all identities in the shared material.
    // Coordinates use the same one-meter mark box as the original symbols.
    const polygon = (points: readonly Vec2[], color: string, depth = z): void => {
      for (let i = 0; i < points.length; i++) {
        const a = points[i] as Vec2,
          b = points[(i + 1) % points.length] as Vec2;
        out.addTriangle(
          'trim',
          'palette:#ffffff',
          [
            [x, y, depth],
            [x + a[0], y + a[1], depth],
            [x + b[0], y + b[1], depth],
          ],
          [0, 0, 1],
          [
            [0.5, 0.5],
            [0, 0],
            [1, 0],
          ],
          parseColor(color),
        );
      }
    };
    const stroke = (points: readonly Vec2[], width: number, color: string): void =>
      modelStroke(
        out,
        points.map(([u, v]): Vec2 => [x + u, y + v]),
        width,
        z + 0.005,
        color,
      );
    if (design.symbol === 'tag') {
      polygon(
        [
          [-0.48, -0.32],
          [0.2, -0.32],
          [0.48, 0],
          [0.2, 0.32],
          [-0.48, 0.32],
        ],
        design.mark,
      );
      disc(out, x + 0.25, y, 0.055, z + 0.005, design.background, 8);
    } else if (design.symbol === 'roofline') {
      polygon(
        [
          [-0.46, -0.36],
          [0.46, -0.36],
          [0.46, 0.13],
          [0, 0.47],
          [-0.46, 0.13],
        ],
        design.mark,
      );
      lettering(out, design.letters ?? '', x, y - 0.08, 0.58, 0.38, z + 0.005, design.background);
    } else if (design.symbol === 'star') {
      polygon(
        Array.from({ length: 10 }, (_, i): Vec2 => {
          const angle = dmath.PI / 2 + (i * dmath.TAU) / 10,
            radius = i % 2 === 0 ? 0.49 : 0.22;
          return [dmath.cos(angle) * radius, dmath.sin(angle) * radius];
        }),
        design.mark,
      );
    } else if (design.symbol === 'burger') {
      for (const side of [-1, 1]) {
        const arc = Array.from({ length: steps + 1 }, (_, i): Vec2 => {
          const t = i / steps;
          return [-0.4 + 0.8 * t, side * (0.16 + 0.2 * 4 * t * (1 - t))];
        });
        stroke(arc, 0.14, design.mark);
      }
      stroke(
        [
          [-0.42, 0],
          [0.42, 0],
        ],
        0.12,
        design.foreground,
      );
    } else if (design.symbol === 'bell') {
      polygon(
        [
          [-0.44, -0.25],
          [0.44, -0.25],
          [0.28, -0.02],
          [0.24, 0.24],
          [0.12, 0.4],
          [-0.12, 0.4],
          [-0.24, 0.24],
          [-0.28, -0.02],
        ],
        design.mark,
      );
      disc(out, x, y - 0.34, 0.1, z + 0.005, design.mark, 10);
    } else if (design.symbol === 'bucket') {
      polygon(
        [
          [-0.28, -0.42],
          [0.28, -0.42],
          [0.43, 0.4],
          [-0.43, 0.4],
        ],
        design.mark,
      );
      stroke(
        [
          [0, -0.34],
          [0, 0.32],
        ],
        0.17,
        design.background,
      );
      stroke(
        [
          [-0.44, 0.4],
          [0.44, 0.4],
        ],
        0.09,
        design.foreground,
      );
    } else {
      polygon(
        [
          [-0.45, -0.4],
          [0.45, -0.4],
          [0.45, 0.4],
          [-0.45, 0.4],
        ],
        design.mark,
      );
      stroke(
        [
          [-0.45, 0],
          [0.45, 0],
        ],
        0.06,
        design.foreground,
      );
      for (const [u, v] of [
        [0, 0.2],
        [-0.2, -0.2],
        [0.2, -0.2],
      ])
        disc(out, x + (u ?? 0), y + (v ?? 0), 0.08, z + 0.01, design.foreground, 8);
    }
  } else if (design.symbol === 'cross') {
    modelStroke(
      out,
      [
        [x - 0.4, y],
        [x + 0.4, y],
      ],
      0.22,
      z,
      design.mark,
    );
    modelStroke(
      out,
      [
        [x, y - 0.4],
        [x, y + 0.4],
      ],
      0.22,
      z,
      design.mark,
    );
  } else lettering(out, design.letters ?? '', x, y, 0.85, 0.8, z, design.mark);
  if (detail < 2) lettering(out, design.text, 0.54, 0.69, 2.68, 0.6, z + 0.015, design.foreground);
  else
    modelStroke(
      out,
      [
        [-0.72, 0.65],
        [1.75, 0.65],
      ],
      0.12,
      z,
      design.foreground,
    );
  return out.finalize();
}

/**
 * Generate a landmark's sign or metric box recipe from the loaded definitions (a landmark
 * library's `definitions`); undefined when `name` is not among them. Detail 2 retains the main
 * silhouette.
 */
export function generateLandmarkModel(
  name: string,
  definitions: LandmarkDefinitions,
  detail: 0 | 1 | 2 = 0,
): MeshBuffers | undefined {
  const doc = Object.hasOwn(definitions, name) ? definitions[name] : undefined;
  if (!doc) return undefined;
  if (doc.generator === 'sign') return generateSignModel(doc.sign, detail);
  const out = new MeshBufferBuilder();
  for (const part of doc.parts) {
    if (part.tiers && !part.tiers.includes(detail)) continue;
    modelBox(out, part.center, part.size, part.color, part.yaw ?? 0);
  }
  return out.finalize();
}
