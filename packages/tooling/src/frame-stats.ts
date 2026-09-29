import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

/** A rectangle as fractions of the frame (0 to 1), so a check reads the same at any size. */
export interface FrameRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameStatsOptions {
  /** Measure only this part of the frame. The background is still the whole frame's. */
  region?: FrameRegion;
  /** Channel difference above which a pixel counts as content, not background (default 24). */
  tolerance?: number;
}

export interface FrameStats {
  width: number;
  height: number;
  /** The frame's most common color, taken as its backdrop: the clear color or an even sky. */
  background: [number, number, number];
  /** Fraction of the measured pixels that differ from the background by more than `tolerance`. */
  coverage: number;
  /** Distinct colors among the measured pixels, each channel quantized to 32 levels. */
  colors: number;
  /** Mean color of the measured pixels. */
  mean: [number, number, number];
  /** Mean of (r + g + b) / 3 over the measured pixels, 0-255. */
  luminance: number;
}

const quantize = (r: number, g: number, b: number): number =>
  ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/**
 * Measure a rendered frame without a reference image: how much of it is content, how varied it
 * is, and its mean color, for the whole frame or a region. Checks built on these (the frame is not
 * blank, the model covers its part of the view, a lit room is brighter than an unlit one) hold on
 * any machine, where a pixel comparison needs a reference recorded on the machine that compares.
 */
export async function frameStats(
  path: string,
  options: FrameStatsOptions = {},
): Promise<FrameStats> {
  const png = PNG.sync.read(await readFile(path));
  const { width, height, data } = png;
  const histogram = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    const key = quantize(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }
  let backgroundKey = 0;
  let best = -1;
  for (const [key, count] of histogram) {
    if (count > best) {
      best = count;
      backgroundKey = key;
    }
  }
  // The center of the background's quantization bucket.
  const background: [number, number, number] = [
    ((backgroundKey >> 10) << 3) + 4,
    (((backgroundKey >> 5) & 31) << 3) + 4,
    ((backgroundKey & 31) << 3) + 4,
  ];
  const region = options.region ?? { x: 0, y: 0, width: 1, height: 1 };
  const x0 = Math.max(0, Math.floor(region.x * width));
  const y0 = Math.max(0, Math.floor(region.y * height));
  const x1 = Math.min(width, Math.ceil((region.x + region.width) * width));
  const y1 = Math.min(height, Math.ceil((region.y + region.height) * height));
  const tolerance = options.tolerance ?? 24;
  const colors = new Set<number>();
  let content = 0;
  let count = 0;
  const sum: [number, number, number] = [0, 0, 0];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
      colors.add(quantize(r, g, b));
      if (
        Math.max(
          Math.abs(r - background[0]),
          Math.abs(g - background[1]),
          Math.abs(b - background[2]),
        ) > tolerance
      )
        content++;
      count++;
    }
  }
  const mean: [number, number, number] =
    count === 0 ? [0, 0, 0] : [sum[0] / count, sum[1] / count, sum[2] / count];
  return {
    width,
    height,
    background,
    coverage: count === 0 ? 0 : content / count,
    colors: colors.size,
    mean,
    luminance: (mean[0] + mean[1] + mean[2]) / 3,
  };
}
