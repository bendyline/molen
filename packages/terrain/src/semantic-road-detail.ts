/**
 * Road detail: tiles at or finer than a building-detail level take their roads from that level.
 *
 * A basemap's regular zooms keep few roads: Protomaps' zoom 13 holds a city's main roads and
 * drops nearly every residential street, footway and stair (central Alicante: 125 roads in a zoom
 * 13 tile, about 1,270 across its sixteen zoom-15 tiles). A host that ships the basemap's last zoom
 * as a building-detail sidecar (`features.buildingDetail`) already has every street there. Where
 * the terrain pyramid reaches that level, this wraps the feature source so a tile at the level, or
 * finer, takes its `transportation` from the detail tile covering it (cut to the tile when finer).
 * Water, land use and the rest stay the feature tile's; buildings and places come from building
 * detail as before (semantic-building-detail.ts).
 *
 * How it fits in: package-semantic-client.ts applies it to the plain feature source, after
 * overzoom and before road grading, tunnels and building detail read it, so every reader of a
 * tile's roads sees the same lines: grading and tunnel caches stay keyed by tile, and neighbours
 * agree at their edges because they come from neighbouring detail tiles. Underpasses
 * (underpasses.ts) are inferred once per detail tile.
 *
 * Coarser tiles keep their own roads on purpose. Composing the streets of 4 or 16 detail tiles into
 * one coarser tile overran the per-tile budgets tuned for detail-sized tiles (`SurfaceNetwork`
 * finds at most 256 junctions a tile; one zoom-15 tile of Alicante's old town has hundreds of
 * crossings), and a coarser tile is drawn far enough off that its side streets are not missed.
 *
 * Related files: semantic-building-detail.ts (the same sidecar's buildings), package-client.ts
 * (`OpenTerrainPackageBuildingDetail.streets`, the roads-only decode), semantic-overzoom.ts.
 *
 * Gotchas:
 * - A detail tile the archive lacks, or one whose decode has no roads at all (a detail archive of
 *   buildings alone), leaves the feature tile's roads.
 * - Host edits to the native feature tiles (`transformFeatures`, e.g. road alignments) apply to
 *   their coarse roads only and do not reach detail roads.
 * - One answer per input tile: readers ask for a tile again and again and some keep what they
 *   derived by the tile object they were given, so a feature tile and its detail tile always
 *   yield the same object.
 * - The derived tile's content hash joins the feature tile's and the detail tile's when both have
 *   one; worldgen keys its caches by it (without one it serializes the tile, 5–15 ms each).
 */
import type { TerrainPyramidTileAddress } from './pyramid-types';
import { overzoomTerrainSemanticTile, type TerrainSemanticTileLoader } from './semantic-overzoom';
import {
  createEmptyTerrainSemanticTile,
  setTerrainSemanticTileContentHash,
  type TerrainSemanticTile,
  terrainSemanticTileContentHash,
} from './semantic-types';
import { withTerrainUnderpasses } from './underpasses';

export interface TerrainRoadDetailOptions {
  /** The level the detail sidecar serves (e.g. 15 for Protomaps). */
  level: number;
  /** World size of a tile at `level`, for inferring underpasses. */
  tileSize: number;
  /** Recently loaded detail tiles kept for overlapping requests (default 48). */
  cacheSize?: number;
}

interface DetailRoads {
  /** The detail tile with its underpasses inferred. */
  tile: TerrainSemanticTile;
  /** The decoded detail tile's content hash, if it has one. */
  hash: string | undefined;
}

/**
 * Wrap `base` (a feature source) so tiles at `options.level` and finer take their roads from
 * `detail` (a source of that level's roads). Coarser tiles load from `base` unchanged.
 */
export function createRoadDetailTerrainSemanticSource(
  base: TerrainSemanticTileLoader,
  detail: TerrainSemanticTileLoader,
  options: TerrainRoadDetailOptions,
): TerrainSemanticTileLoader {
  const { level, tileSize } = options;
  const cacheSize = options.cacheSize ?? 48;
  if (!Number.isSafeInteger(level) || level < 0)
    throw new RangeError('road detail level must be a whole level');
  if (!(tileSize > 0)) throw new RangeError('road detail tileSize must be positive');
  // A detail tile serves every tile it lies over, so no single caller's signal may cancel it.
  const shared = new AbortController().signal;
  const cache = new Map<string, Promise<DetailRoads | undefined>>();
  const roadsAt = (x: number, z: number): Promise<DetailRoads | undefined> => {
    const key = `${x}/${z}`;
    let request = cache.get(key);
    if (request !== undefined) {
      cache.delete(key);
      cache.set(key, request);
      return request;
    }
    request = detail.load({ level, x, z }, shared).then(
      (tile) =>
        tile !== undefined && tile.transportation.length > 0
          ? {
              tile: withTerrainUnderpasses(tile, tileSize),
              hash: terrainSemanticTileContentHash(tile),
            }
          : undefined,
      (error: unknown) => {
        cache.delete(key);
        throw error;
      },
    );
    cache.set(key, request);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value as string);
    return request;
  };
  // One derived tile per feature tile (and the detail tile it was derived with).
  const derived = new WeakMap<
    TerrainSemanticTile,
    { roads: TerrainSemanticTile; result: TerrainSemanticTile }
  >();
  return {
    async load(address, signal) {
      if (address.level < level) return base.load(address, signal);
      const scale = 2 ** (address.level - level);
      const from: TerrainPyramidTileAddress = {
        level,
        x: Math.floor(address.x / scale),
        z: Math.floor(address.z / scale),
      };
      const [tile, roads] = await Promise.all([
        base.load(address, signal),
        // A detail tile that fails to load leaves the feature tile's roads.
        roadsAt(from.x, from.z).catch(() => undefined),
      ]);
      if (signal.aborted) return undefined;
      if (tile === undefined || roads === undefined) return tile;
      const known = derived.get(tile);
      if (known !== undefined && known.roads === roads.tile) return known.result;
      const transportation =
        scale === 1
          ? roads.tile.transportation
          : overzoomTerrainSemanticTile(
              { ...createEmptyTerrainSemanticTile(), transportation: roads.tile.transportation },
              from,
              address,
            ).transportation;
      const result: TerrainSemanticTile = { ...tile, transportation };
      const baseHash = terrainSemanticTileContentHash(tile);
      if (baseHash !== undefined && roads.hash !== undefined)
        setTerrainSemanticTileContentHash(
          result,
          `${baseHash}|roads>${from.level}/${from.x}/${from.z}=${roads.hash}`,
        );
      derived.set(tile, { roads: roads.tile, result });
      return result;
    },
  };
}
