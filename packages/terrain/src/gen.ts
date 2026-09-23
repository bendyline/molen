import { encodePng16, type Gray16 } from './png16';

// Seeded procedural heightmap generator (no embedded assets ship with the engine; examples
// generate their own). Deterministic fbm value noise, normalized to [0,1].

function hash(ix: number, iy: number, seed: number): number {
  let h = (ix | 0) * 374761393 + (iy | 0) * 668265263 + (seed | 0) * 2147483647;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const v00 = hash(ix, iy, seed);
  const v10 = hash(ix + 1, iy, seed);
  const v01 = hash(ix, iy + 1, seed);
  const v11 = hash(ix + 1, iy + 1, seed);
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

export interface HeightmapGenOptions {
  size: number;
  seed: number;
  octaves?: number;
  /** Base noise frequency across the map. */
  frequency?: number;
  /** Radial island falloff: heights taper to 0 at the edges. */
  island?: boolean;
}

/** Generate a normalized heightmap grid. */
export function generateHeightmap(opts: HeightmapGenOptions): Gray16 {
  const { size, seed } = opts;
  const octaves = opts.octaves ?? 5;
  const frequency = opts.frequency ?? 3;
  const island = opts.island ?? true;
  const data = new Float32Array(size * size);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let amp = 1;
      let freq = frequency;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amp * valueNoise(u * freq, v * freq, seed + o * 1013);
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      let h = sum / norm;
      if (island) {
        const dx = u - 0.5;
        const dy = v - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2; // 0 center .. 1 edge
        const falloff = Math.max(0, 1 - d * d);
        h *= falloff;
      }
      data[y * size + x] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  // Normalize to [0,1].
  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) data[i] = ((data[i] as number) - min) / range;
  return { width: size, height: size, data };
}

/** Generate a heightmap and encode it as a 16-bit grayscale PNG. */
export function generateHeightmapPng(opts: HeightmapGenOptions): Uint8Array {
  return encodePng16(generateHeightmap(opts));
}
