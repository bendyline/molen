// Tileable noise for the cloud renderer, generated once per page on the CPU. Every field repeats
// exactly across its edges, so the textures wrap without seams. Seeds pick offsets into these
// fields (see clouds.ts) rather than regenerating them; no simulation random numbers are used.
// The whole set is about a quarter of a second of work, so it is built a slice at a time within
// a per-frame budget (`CloudNoise.build`), never in one frame.

function hash(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const wrap = (i: number, period: number): number => ((i % period) + period) % period;
const remap = (v: number, a: number, b: number): number =>
  Math.max(0, Math.min(1, (v - a) / (b - a)));

/** Random values on a `px` by `py` by `pz` lattice that wraps on every axis. */
interface Lattice {
  values: Float32Array;
  px: number;
  py: number;
  pz: number;
}

function lattice(px: number, py: number, pz: number, seed: number): Lattice {
  const values = new Float32Array(px * py * pz);
  for (let z = 0; z < pz; z++)
    for (let y = 0; y < py; y++)
      for (let x = 0; x < px; x++) values[(z * py + y) * px + x] = hash(x, y, z, seed);
  return { values, px, py, pz };
}

function bilinear(
  v: Float32Array,
  plane: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  fx: number,
  fy: number,
): number {
  const a = v[plane + y0 + x0] as number,
    b = v[plane + y0 + x1] as number,
    c = v[plane + y1 + x0] as number,
    d = v[plane + y1 + x1] as number;
  const top = a + (b - a) * fx;
  return top + (c + (d - c) * fx - top) * fy;
}

/** Value noise in 0–1 at (x, y, z) lattice units; z is ignored on a flat lattice. */
function value(l: Lattice, x: number, y: number, z: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = fade(x - ix),
    fy = fade(y - iy);
  const x0 = wrap(ix, l.px),
    x1 = wrap(ix + 1, l.px),
    y0 = wrap(iy, l.py) * l.px,
    y1 = wrap(iy + 1, l.py) * l.px;
  if (l.pz === 1) return bilinear(l.values, 0, x0, x1, y0, y1, fx, fy);
  const iz = Math.floor(z);
  const area = l.px * l.py;
  const near = bilinear(l.values, wrap(iz, l.pz) * area, x0, x1, y0, y1, fx, fy);
  const far = bilinear(l.values, wrap(iz + 1, l.pz) * area, x0, x1, y0, y1, fx, fy);
  return near + (far - near) * fade(z - iz);
}

/** fBm of value noise, octave `o` on a lattice `2^o` times finer, normalized to 0–1. */
function octaves(base: number, count: number, seed: number, flat: boolean): Lattice[] {
  return Array.from({ length: count }, (_, o) => {
    const p = base * 2 ** o;
    return lattice(p, p, flat ? 1 : p, seed + o * 17);
  });
}

function fbm(layers: readonly Lattice[], u: number, v: number, w: number): number {
  let sum = 0,
    total = 0,
    amplitude = 1;
  for (const l of layers) {
    sum += value(l, u * l.px, v * l.py, w * l.pz) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  return sum / total;
}

/** Jittered feature points, one per cell of a wrapping `cells`-per-axis grid. */
interface Cells {
  points: Float32Array;
  cells: number;
  flat: boolean;
  /** Candidate points around the current cell (27, or 9 when flat), in cell units. */
  near: Float32Array;
  count: number;
  key: number;
}

function cells(count: number, seed: number, flat: boolean): Cells {
  const depth = flat ? 1 : count;
  const points = new Float32Array(count * count * depth * 3);
  for (let z = 0; z < depth; z++)
    for (let y = 0; y < count; y++)
      for (let x = 0; x < count; x++) {
        const i = ((z * count + y) * count + x) * 3;
        points[i] = x + hash(x, y, z, seed);
        points[i + 1] = y + hash(x, y, z, seed + 1);
        points[i + 2] = flat ? 0 : z + hash(x, y, z, seed + 2);
      }
  return { points, cells: count, flat, near: new Float32Array(27 * 3), count: 0, key: -1 };
}

/**
 * Inverted Worley distance at (u, v, w) in 0–1 texture units: 1 on a feature point, 0 a cell
 * away. Candidates are cached per cell, and fields are visited in texel order, so each cell's
 * 27 neighbours are gathered once per row rather than per texel.
 */
function worley(c: Cells, u: number, v: number, w: number): number {
  const n = c.cells;
  const px = u * n,
    py = v * n,
    pz = c.flat ? 0 : w * n;
  const cx = Math.floor(px),
    cy = Math.floor(py),
    cz = c.flat ? 0 : Math.floor(pz);
  const key = (cz * n + cy) * n + cx;
  if (key !== c.key) {
    c.key = key;
    let k = 0;
    const zr = c.flat ? 0 : 1;
    for (let dz = -zr; dz <= zr; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx,
            ny = cy + dy,
            nz = cz + dz;
          const wx = wrap(nx, n),
            wy = wrap(ny, n),
            wz = c.flat ? 0 : wrap(nz, n);
          const i = ((wz * n + wy) * n + wx) * 3;
          c.near[k++] = (c.points[i] as number) + (nx - wx);
          c.near[k++] = (c.points[i + 1] as number) + (ny - wy);
          c.near[k++] = (c.points[i + 2] as number) + (nz - wz);
        }
    c.count = k;
  }
  let best = 9;
  const near = c.near;
  for (let k = 0; k < c.count; k += 3) {
    const ox = (near[k] as number) - px,
      oy = (near[k + 1] as number) - py,
      oz = (near[k + 2] as number) - pz;
    const d = ox * ox + oy * oy + oz * oz;
    if (d < best) best = d;
  }
  return 1 - Math.min(1, Math.sqrt(best));
}

/** Texels per side of the 3D shape noise. */
export const CLOUD_SHAPE_SIZE = 64;
/** Texels per side of the 3D erosion noise. */
export const CLOUD_DETAIL_SIZE = 32;
/** Texels per side of the 2D weather map. */
export const CLOUD_WEATHER_SIZE = 256;
/** Texels per side of the cirrus streak texture. */
export const CIRRUS_SIZE = 256;

/**
 * Cloud body noise, one channel: value-noise fBm eroded by inverted Worley cells, the
 * "Perlin-Worley" shape that gives cumulus their rounded, cauliflower billows.
 */
function* shapeNoise(out: Uint8Array): Generator<void> {
  const n = CLOUD_SHAPE_SIZE;
  const base = octaves(4, 3, 11, false);
  const w = [cells(4, 23, false), cells(8, 29, false), cells(16, 31, false)] as const;
  for (let z = 0; z < n; z++) {
    const sw = (z + 0.5) / n;
    for (let y = 0; y < n; y++) {
      const sv = (y + 0.5) / n;
      for (let x = 0; x < n; x++) {
        const su = (x + 0.5) / n;
        const cellular =
          worley(w[0], su, sv, sw) * 0.625 +
          worley(w[1], su, sv, sw) * 0.25 +
          worley(w[2], su, sv, sw) * 0.125;
        out[(z * n + y) * n + x] = Math.round(
          remap(fbm(base, su, sv, sw), cellular - 1, 1) ** 1.2 * 255,
        );
      }
    }
    yield;
  }
}

/** Finer Worley fBm, one channel, that wears wisps out of cloud edges. */
function* detailNoise(out: Uint8Array): Generator<void> {
  const n = CLOUD_DETAIL_SIZE;
  const w = [cells(4, 41, false), cells(8, 43, false), cells(16, 47, false)] as const;
  for (let z = 0; z < n; z++) {
    const sw = (z + 0.5) / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const su = (x + 0.5) / n,
          sv = (y + 0.5) / n;
        out[(z * n + y) * n + x] = Math.round(
          (worley(w[0], su, sv, sw) * 0.625 +
            worley(w[1], su, sv, sw) * 0.25 +
            worley(w[2], su, sv, sw) * 0.125) *
            255,
        );
      }
    if (z % 8 === 7) yield;
  }
}

/**
 * The 2D weather map, RGBA: R where fair-weather cumulus form (separate cells), G how tall each
 * column grows, B a tighter cellular field for stratocumulus, A broad storm cells.
 */
function* weatherMap(out: Uint8Array): Generator<void> {
  const n = CLOUD_WEATHER_SIZE;
  const cumulus = octaves(6, 5, 53, true);
  const cumulusCells = cells(12, 59, true);
  const height = octaves(4, 3, 61, true);
  const strato = cells(24, 67, true);
  const stratoBase = octaves(8, 4, 71, true);
  const storms = cells(3, 73, true);
  const stormBase = octaves(4, 4, 79, true);
  for (let y = 0; y < n; y++) {
    const v = (y + 0.5) / n;
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const i = (y * n + x) * 4;
      out[i] = Math.round(
        remap(fbm(cumulus, u, v, 0), 1 - worley(cumulusCells, u, v, 0) * 1.1, 1) * 255,
      );
      out[i + 1] = Math.round(fbm(height, u, v, 0) * 255);
      out[i + 2] = Math.round(
        (worley(strato, u, v, 0) * 0.55 + fbm(stratoBase, u, v, 0) * 0.45) * 255,
      );
      out[i + 3] = Math.round(
        remap(fbm(stormBase, u, v, 0), 1.05 - worley(storms, u, v, 0), 1) * 255,
      );
    }
    if (y % 16 === 15) yield;
  }
  // Equalize each channel, so that a fraction c of the map lies above 1 - c: `clouds.coverage`
  // is then the share of the sky the layer covers, whatever shape each field has.
  for (let channel = 0; channel < 4; channel++) {
    const counts = new Float64Array(256);
    for (let i = channel; i < out.length; i += 4) {
      const v = out[i] as number;
      counts[v] = (counts[v] as number) + 1;
    }
    const level = new Uint8Array(256);
    let below = 0;
    for (let v = 0; v < 256; v++) {
      const count = counts[v] as number;
      level[v] = Math.round(((below + count / 2) / (n * n)) * 255);
      below += count;
    }
    for (let i = channel; i < out.length; i += 4) out[i] = level[out[i] as number] as number;
  }
}

/** Wispy, wind-combed cirrus, one channel: fBm stretched eight to one along +X. */
function* cirrusNoise(out: Uint8Array): Generator<void> {
  const n = CIRRUS_SIZE;
  // Per-axis periods keep the stretched lattices tileable: 4 by 32 cells is eight to one.
  const patches = [lattice(4, 4, 1, 83), lattice(8, 8, 1, 89)] as const;
  const strands = [lattice(4, 32, 1, 97), lattice(8, 64, 1, 101)] as const;
  const warp = lattice(8, 8, 1, 103);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      // Bend the strands a little, as jet-stream shear does.
      const v = y / n + (value(warp, u * 8, (y / n) * 8, 0) * 2 - 1) * 0.04;
      // Broad patches decide where cirrus are; fine strands run along the stretched axis.
      const patch =
        value(patches[0], u * 4, v * 4, 0) * 0.65 + value(patches[1], u * 8, v * 8, 0) * 0.35;
      const strand =
        value(strands[0], u * 4, v * 32, 0) * 0.6 + value(strands[1], u * 8, v * 64, 0) * 0.4;
      out[y * n + x] = Math.round(remap(patch * 0.6 + strand * 0.55, 0.42, 0.95) * 255);
    }
    if (y % 32 === 31) yield;
  }
}

type NoiseName = 'weather' | 'shape' | 'detail' | 'cirrus';

/** The page's cloud noise, filled in as `build` is given time. */
export class CloudNoise {
  readonly weather: Uint8Array = new Uint8Array(CLOUD_WEATHER_SIZE ** 2 * 4);
  readonly shape: Uint8Array = new Uint8Array(CLOUD_SHAPE_SIZE ** 3);
  readonly detail: Uint8Array = new Uint8Array(CLOUD_DETAIL_SIZE ** 3);
  readonly cirrus: Uint8Array = new Uint8Array(CIRRUS_SIZE ** 2);
  private readonly ready = new Set<NoiseName>();
  private readonly jobs = new Map<NoiseName, Generator<void>>();

  has(name: NoiseName): boolean {
    return this.ready.has(name);
  }

  /**
   * Work on `wanted`, in order, for about `budgetMs` (Infinity finishes them). Returns whether all
   * of them are ready.
   */
  build(wanted: readonly NoiseName[], budgetMs: number): boolean {
    const start = performance.now();
    for (const name of wanted) {
      if (this.ready.has(name)) continue;
      let job = this.jobs.get(name);
      if (!job) {
        job =
          name === 'weather'
            ? weatherMap(this.weather)
            : name === 'shape'
              ? shapeNoise(this.shape)
              : name === 'detail'
                ? detailNoise(this.detail)
                : cirrusNoise(this.cirrus);
        this.jobs.set(name, job);
      }
      while (true) {
        if (job.next().done) {
          this.ready.add(name);
          this.jobs.delete(name);
          break;
        }
        if (performance.now() - start >= budgetMs) return false;
      }
    }
    return true;
  }
}

let shared: CloudNoise | undefined;

/** One set per page: the fields depend on nothing but these constants. */
export function cloudNoise(): CloudNoise {
  shared ??= new CloudNoise();
  return shared;
}
