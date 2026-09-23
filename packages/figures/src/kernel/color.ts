/**
 * Palette colors: "#rrggbb" (sRGB) to linear RGB in 0..1, converted once per figure. Vertex
 * colors are stored linear so the client's `vertexColors` material lights them correctly.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';

/** Linear RGB, each channel 0..1. */
export type RGB = [r: number, g: number, b: number];

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : dmath.pow((c + 0.055) / 1.055, 2.4);
}

/** Parse "#rrggbb" into linear RGB; invalid input yields mid grey. */
export function parseColor(hex: string): RGB {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (m === null) return [0.5, 0.5, 0.5];
  const value = Number.parseInt(m[1] as string, 16);
  return [
    srgbToLinear(((value >> 16) & 0xff) / 255),
    srgbToLinear(((value >> 8) & 0xff) / 255),
    srgbToLinear((value & 0xff) / 255),
  ];
}

/** Scale a linear color (for shading variation such as darker hooves or a lighter belly). */
export function scaleColor(color: RGB, factor: number): RGB {
  return [
    dmath.clamp(color[0] * factor, 0, 1),
    dmath.clamp(color[1] * factor, 0, 1),
    dmath.clamp(color[2] * factor, 0, 1),
  ];
}
