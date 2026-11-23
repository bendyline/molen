/**
 * Which rendered feature tiles are fine enough for the ground-level readers (ambient traffic, the
 * street and surface sounds underfoot, wildlife habitat) to take roads and land cover from.
 *
 * Each reader has a size limit, so the coarse tiles shown far off or under a climbing aircraft (a
 * whole town's roads, generalized) stay out. A package's finest tiles always count, whatever their
 * size: one whose feature tiles end at a basemap's zoom 13 (Protomaps; 3.3 km a side in Seattle,
 * 4.9 km at the equator) has nothing smaller, and a size limit alone left traffic, footsteps and
 * animals without a single road anywhere south of about 52° there.
 *
 * Related files: ambient.ts, audio-terrain.ts, wildlife-habitat.ts (the readers), locator.ts
 * (which picks the finest tile holding a place by level instead).
 */
import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';

/**
 * True when the tile is at most `maxSize` meters on a side, or at the finest level of its pyramid
 * (`pyramid.maxLevel`), where no finer tile can follow.
 */
export function isFineTile(
  context: Pick<TerrainPyramidTileLayerContext, 'tileSize' | 'address' | 'pyramid'>,
  maxSize: number,
): boolean {
  if (context.tileSize <= maxSize) return true;
  const finest = (context.pyramid as Partial<TerrainPyramidTileLayerContext['pyramid']> | undefined)
    ?.maxLevel;
  return finest !== undefined && context.address.level >= finest;
}
