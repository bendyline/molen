import { vehicleSurface } from '@bendyline/molen-kernel/vehicles';
import { type SnowCoverData, snowCoverAt, snowWalkingPace } from '@bendyline/molen-schema';

/** Meters across a cell of remembered ground, and how long its answer stays fresh. */
const CELL = 2;
const FRESH_MS = 1500;

/**
 * Walking pace through the weather's lying snow, for `WalkController.paceAt`: 1 on bare ground,
 * less the deeper the snow lies at the walker's height (`snowWalkingPace`). A road or footway
 * the map knows (`surfaceAt`, a surface name such as `asphalt`) is ploughed and trodden, so it
 * keeps only its share of the depth; open and unmapped ground keeps all of it.
 */
export function createSnowPace(options: {
  /** The snow lying now; read on every call, so a change of weather applies at once. */
  snowCover(): SnowCoverData | undefined;
  surfaceAt?(x: number, z: number): string | undefined;
}): (x: number, y: number, z: number) => number {
  let cellX = Number.NaN;
  let cellZ = Number.NaN;
  let at = Number.NEGATIVE_INFINITY;
  let share = 1;
  return (x, y, z) => {
    const cover = options.snowCover();
    if (cover === undefined) return 1;
    const depth = snowCoverAt(cover, y).depth;
    if (depth <= 0) return 1;
    // The walker asks many times a step; the ground under it changes every couple of meters.
    const nextX = Math.floor(x / CELL);
    const nextZ = Math.floor(z / CELL);
    const now = performance.now();
    if (nextX !== cellX || nextZ !== cellZ || now - at > FRESH_MS) {
      cellX = nextX;
      cellZ = nextZ;
      at = now;
      share = vehicleSurface(options.surfaceAt?.(x, z))?.snow ?? 1;
    }
    return snowWalkingPace(depth * share);
  };
}
