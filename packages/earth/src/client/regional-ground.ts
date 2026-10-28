import type { TerrainSurfaceColor } from '@bendyline/molen-terrain/client';
import type { RegionalEnvironment } from '@bendyline/molen-worldgen-earth/kernel';
import { Color } from 'three';

/** Palette cells remembered at once (a few tiles' worth), then forgotten together. */
const MAX_CELLS = 16_384;

/** Coarse ecology also colors bare/distant ground before semantic detail arrives. */
export function createRegionalGroundColor(
  environment: RegionalEnvironment | undefined,
): TerrainSurfaceColor | undefined {
  if (environment?.hasEcology !== true) return undefined;
  const colors = new Map<string, readonly [number, number, number]>();
  const linear = (hex: string): readonly [number, number, number] => {
    let value = colors.get(hex);
    if (value === undefined) {
      const color = new Color(hex);
      value = [color.r, color.g, color.b];
      colors.set(hex, value);
    }
    return value;
  };
  // Ecoregions and their palettes change over kilometres, but every terrain vertex asked for its
  // own: most of the main-thread time of meshing a tile. One lookup per cell, at its centre, shared
  // by the vertices that follow in it. Cells are 32 m, or about two vertices of a coarse distant
  // tile (a power of two, so the grid stays aligned): a palette boundary moves by less than that.
  type Palette = {
    ground: readonly [number, number, number];
    rock: readonly [number, number, number];
  } | null;
  let previousX = Number.NaN;
  let previousZ = Number.NaN;
  let previousStep = Number.NaN;
  let size = 32;
  let sizeExponent = 5;
  let cellX = Number.NaN;
  let cellZ = Number.NaN;
  let cellSize = 0;
  let last: Palette = null;
  const cells = new Map<number, Palette>();
  const palette = (x: number, z: number): Palette => {
    const step = Math.max(Math.abs(x - previousX), Math.abs(z - previousZ));
    previousX = x;
    previousZ = z;
    // Steps along a row set the size; the jump to the next row keeps it.
    if (step !== previousStep) {
      previousStep = step;
      if (step < 2048) {
        sizeExponent = step > 16 ? Math.ceil(Math.log2(step * 2)) : 5;
        size = 2 ** sizeExponent;
      }
    }
    const cx = Math.floor(x / size);
    const cz = Math.floor(z / size);
    if (cx === cellX && cz === cellZ && size === cellSize) return last;
    cellX = cx;
    cellZ = cz;
    cellSize = size;
    // A tile's rows pass through each cell several times: remember the cells, not just the last.
    // A number key (exponent, then each cell index offset to be nonnegative) builds no string:
    // Web Mercator meters over a 32 m or larger cell stay within 2^20 cells each way.
    const key = (sizeExponent * 2_097_152 + cx + 1_048_576) * 4_194_304 + cz + 2_097_152;
    const known = cells.get(key);
    if (known !== undefined) {
      last = known;
      return last;
    }
    const px = (cx + 0.5) * size;
    const pz = (cz + 0.5) * size;
    const surface = environment.scatterAt(px, pz)?.surface;
    last =
      surface === undefined || environment.ecology?.resolve(px, pz) === undefined
        ? null
        : { ground: linear(surface.default), rock: linear(surface.colors.barren ?? '#aca28c') };
    if (cells.size >= MAX_CELLS) cells.clear();
    cells.set(key, last);
    return last;
  };
  const color: TerrainSurfaceColor = (x, _y, z, slope) => {
    const found = palette(x, z);
    if (found === null) return undefined;
    const { ground, rock } = found;
    const blend = Math.min(0.65, Math.max(0, slope - 0.65) * 0.45);
    if (blend === 0) return ground;
    return [
      ground[0] + (rock[0] - ground[0]) * blend,
      ground[1] + (rock[1] - ground[1]) * blend,
      ground[2] + (rock[2] - ground[2]) * blend,
    ];
  };
  // The same per vertex, over the tile's arrays in one loop (see TerrainSurfaceColor.colorTile).
  color.colorTile = (positions, normals, colors, originX, originZ) => {
    for (let i = 0; i + 2 < positions.length; i += 3) {
      const found = palette(
        originX + (positions[i] as number),
        originZ + (positions[i + 2] as number),
      );
      if (found === null) continue;
      const nx = normals[i] as number,
        ny = normals[i + 1] as number,
        nz = normals[i + 2] as number;
      const slope = Math.hypot(nx, nz) / Math.max(0.01, ny);
      const blend = Math.min(0.65, Math.max(0, slope - 0.65) * 0.45);
      const { ground, rock } = found;
      colors[i] = ground[0] + (rock[0] - ground[0]) * blend;
      colors[i + 1] = ground[1] + (rock[1] - ground[1]) * blend;
      colors[i + 2] = ground[2] + (rock[2] - ground[2]) * blend;
    }
  };
  return color;
}
