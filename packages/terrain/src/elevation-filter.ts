import type { TerrainTileArchive } from './package-types';
import { decodePng16, type Gray16 } from './png16';

const RADIUS = 3;

interface Candidate {
  column: number;
  row: number;
}

/** A closed ring must surround an extreme value on every side. Slopes, ridges and cliffs
 * reach the ring themselves, so they are not mistaken for isolated impulses. Work in the
 * archive's native resolution, before overzoom can spread one bad sample across a tile.
 */
function isOutlier(value: number, low: number, high: number, margin: number): boolean {
  const tolerance = Math.max(margin, 2 * (high - low));
  return value > high + tolerance || value < low - tolerance;
}

/** Shared by fixed-grid, pyramid and worker package loaders. Raw tiles are kept separate
 * from corrected tiles: a neighbour's result must never depend on request order.
 */
export function createElevationTileDecoder(options: {
  archive: TerrainTileArchive;
  scheme: 'xyz' | 'tms';
  heightRange: number;
  tileSize: (level: number) => number;
  filter: boolean;
  maxTiles: number;
  onDecode?: (milliseconds: number) => void;
}): (level: number, x: number, z: number) => Promise<Gray16 | undefined> {
  const raw = new Map<string, Gray16>();
  const corrected = new Map<string, Gray16>();
  const pendingRaw = new Map<string, Promise<Gray16 | undefined>>();
  const pendingCorrected = new Map<string, Promise<Gray16 | undefined>>();
  const remember = <T>(cache: Map<string, T>, key: string, value: T, limit: number): T => {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > limit) cache.delete(cache.keys().next().value as string);
    return value;
  };
  const missing = new Map<string, true>();
  const loadRaw = (level: number, x: number, z: number): Promise<Gray16 | undefined> => {
    const count = 2 ** level;
    if (x < 0 || z < 0 || x >= count || z >= count) return Promise.resolve(undefined);
    const key = `${level}/${x}/${z}`;
    if (missing.has(key)) {
      remember(missing, key, true, options.maxTiles * 8);
      return Promise.resolve(undefined);
    }
    const cached = raw.get(key);
    if (cached) return Promise.resolve(remember(raw, key, cached, options.maxTiles));
    const pending = pendingRaw.get(key);
    if (pending) return pending;
    const request = options.archive
      .getZxy(level, x, options.scheme === 'tms' ? count - 1 - z : z)
      .then((tile) => {
        if (!tile) {
          remember(missing, key, true, options.maxTiles * 8);
          return undefined;
        }
        const begin = performance.now();
        const grid = decodePng16(new Uint8Array(tile.data));
        options.onDecode?.(performance.now() - begin);
        return remember(raw, key, grid, options.maxTiles);
      })
      .finally(() => pendingRaw.delete(key));
    pendingRaw.set(key, request);
    return request;
  };
  const filter = async (level: number, x: number, z: number): Promise<Gray16 | undefined> => {
    const grid = await loadRaw(level, x, z);
    if (!grid || !options.filter || Math.min(grid.width, grid.height) < 2 * RADIUS + 1) return grid;
    const { width, height, data } = grid;
    // Require at least 100 m of excess relief and a rise/fall steeper than 2 m/m
    // over one native sample. Coarse DEMs must not lose real mountain summits.
    const spacing = options.tileSize(level) / Math.min(width - 1, height - 1);
    const margin = Math.max(100, 2 * spacing) / options.heightRange;
    const candidates: Candidate[] = [];
    const neighbours = new Map<string, Promise<Gray16 | undefined>>();
    const neighbourAddress = (column: number, row: number): [number, number] => [
      column < 0 ? -1 : column >= width ? 1 : 0,
      row < 0 ? -1 : row >= height ? 1 : 0,
    ];
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        let low = Infinity;
        let high = -Infinity;
        for (let dz = -RADIUS; dz <= RADIUS; dz++) {
          for (let dx = -RADIUS; dx <= RADIUS; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== RADIUS) continue;
            const c = column + dx;
            const r = row + dz;
            if (c < 0 || r < 0 || c >= width || r >= height) continue;
            const value = data[r * width + c] as number;
            low = Math.min(low, value);
            high = Math.max(high, value);
          }
        }
        if (!isOutlier(data[row * width + column] as number, low, high, margin)) continue;
        candidates.push({ column, row });
        // Only suspicious edge samples need halo I/O. A full-ring outlier also passes
        // this partial-ring test, since adding samples can only widen its envelope.
        for (let dz = -RADIUS; dz <= RADIUS; dz++) {
          for (let dx = -RADIUS; dx <= RADIUS; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== RADIUS) continue;
            const [nx, nz] = neighbourAddress(column + dx, row + dz);
            if (nx === 0 && nz === 0) continue;
            const key = `${nx}/${nz}`;
            if (!neighbours.has(key)) neighbours.set(key, loadRaw(level, x + nx, z + nz));
          }
        }
      }
    }
    if (candidates.length === 0) return grid;
    const halo = new Map(
      await Promise.all(
        [...neighbours].map(async ([key, pending]) => [key, await pending] as const),
      ),
    );
    let output: Float32Array | undefined;
    for (const { column, row } of candidates) {
      const ring: number[] = [];
      for (let dz = -RADIUS; dz <= RADIUS; dz++) {
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== RADIUS) continue;
          const c = column + dx;
          const r = row + dz;
          const [nx, nz] = neighbourAddress(c, r);
          const source = nx === 0 && nz === 0 ? grid : halo.get(`${nx}/${nz}`);
          if (!source || source.width !== width || source.height !== height) continue;
          ring.push(source.data[(r - nz * (height - 1)) * width + c - nx * (width - 1)] as number);
        }
      }
      // Incomplete coverage is not evidence of a spike: preserve it, including world edges.
      if (ring.length !== 8 * RADIUS) continue;
      ring.sort((a, b) => a - b);
      if (
        !isOutlier(
          data[row * width + column] as number,
          ring[0] as number,
          ring[ring.length - 1] as number,
          margin,
        )
      )
        continue;
      output ??= data.slice();
      output[row * width + column] =
        ((ring[ring.length / 2 - 1] as number) + (ring[ring.length / 2] as number)) / 2;
    }
    return output ? { width, height, data: output } : grid;
  };
  return (level, x, z) => {
    const key = `${level}/${x}/${z}`;
    const cached = corrected.get(key);
    if (cached) return Promise.resolve(remember(corrected, key, cached, options.maxTiles));
    const pending = pendingCorrected.get(key);
    if (pending) return pending;
    const request = filter(level, x, z)
      .then((grid) => grid && remember(corrected, key, grid, options.maxTiles))
      .finally(() => pendingCorrected.delete(key));
    pendingCorrected.set(key, request);
    return request;
  };
}
