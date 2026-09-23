// Deterministic 2D noise primitives (no Math.random ever). Integer-hash lattice with
// smoothstep interpolation; fbm sums octaves. The graph seed + per-node seedOffset feed the
// hash, so identical docs produce identical textures across Node and the browser.

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix | 0) * 374761393 + (iy | 0) * 668265263 + (seed | 0) * 2147483647;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function hashUnit(ix: number, iy: number, seed: number): number {
  return hash2(ix, iy, seed) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Value noise in [0,1]. */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const v00 = hashUnit(ix, iy, seed);
  const v10 = hashUnit(ix + 1, iy, seed);
  const v01 = hashUnit(ix, iy + 1, seed);
  const v11 = hashUnit(ix + 1, iy + 1, seed);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

/** Gradient (Perlin-style) noise remapped to [0,1]; used for the "simplex" node kind. */
export function gradientNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const grad = (gx: number, gy: number, dx: number, dy: number): number => {
    const a = hashUnit(gx, gy, seed) * Math.PI * 2;
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };
  const u = smoothstep(fx);
  const v = smoothstep(fy);
  const n = lerp(
    lerp(grad(ix, iy, fx, fy), grad(ix + 1, iy, fx - 1, fy), u),
    lerp(grad(ix, iy + 1, fx, fy - 1), grad(ix + 1, iy + 1, fx - 1, fy - 1), u),
    v,
  );
  return n * 0.5 + 0.5;
}

/** Fractal Brownian motion over a base noise. */
export function fbm(
  base: (x: number, y: number, seed: number) => number,
  x: number,
  y: number,
  seed: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * base(x * freq, y * freq, seed + o * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Worley/cellular noise: distance to the nearest jittered feature point. */
export function worley(
  x: number,
  y: number,
  seed: number,
  jitter: number,
  output: 'f1' | 'f2' | 'f2-f1',
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = Number.POSITIVE_INFINITY;
  let f2 = Number.POSITIVE_INFINITY;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox;
      const cy = iy + oy;
      const px = cx + jitter * hashUnit(cx, cy, seed);
      const py = cy + jitter * hashUnit(cx, cy, seed + 7919);
      const dx = px - x;
      const dy = py - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  const v = output === 'f1' ? f1 : output === 'f2' ? f2 : f2 - f1;
  return Math.min(1, v);
}
