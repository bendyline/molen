/**
 * Map overrides in a tile stream: a semantic tile renderer that edits each tile as a view's
 * overrides say before handing it on, so everything inside it (buildings, land cover, plants,
 * road surfaces, traffic) sees one map.
 */

import {
  createEmptyTerrainSemanticTile,
  type TerrainPyramidTileLayerContext,
  type TerrainSemanticTile,
  type TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import { applyMapOverrides, mapOverrideTileKey } from '../kernel/map-override-tile';
import type { MapOverride, MapOverrideSet } from '../kernel/map-overrides';
import type { TileGeometry } from '../kernel/semantic-adapter';

export interface MapOverrideRendererOptions {
  /** cos(center latitude) factor of the terrain package (default: the tile pyramid's, else 1). */
  metersPerUnit?: number;
}

/**
 * Wrap a semantic tile renderer so each tile is built as `set`'s overrides leave it. Put it
 * outside whatever observes tiles (traffic, sound, wildlife), so they read the edited tile, and
 * inside a wrapper that adds its own features over the map, such as airports. The set is read
 * when a tile is built: after it changes, the tiles its change names must be built again (the
 * terrain stream's `refreshLayers`). Without a set the renderer is returned as it is.
 */
export function withMapOverrides<T extends MapOverride>(
  renderer: TerrainSemanticTileRenderer,
  set: MapOverrideSet<T> | undefined,
  options: MapOverrideRendererOptions = {},
): TerrainSemanticTileRenderer {
  if (set === undefined) return renderer;
  const geometryFor = (context: TerrainPyramidTileLayerContext): TileGeometry => ({
    level: context.address.level,
    x: context.address.x,
    z: context.address.z,
    originX: context.origin[0],
    originZ: context.origin[1],
    size: context.tileSize,
    metersPerUnit: options.metersPerUnit ?? context.pyramid.metersPerUnit ?? 1,
    levelBelowMax: Math.max(0, context.pyramid.maxLevel - context.address.level),
  });
  // One edited tile per source tile and edit: a rebuild of the same tile under the same
  // overrides, and each quality pass over it, gets the object the caches already know.
  const edited = new WeakMap<TerrainSemanticTile, { key: string; tile: TerrainSemanticTile }>();
  const edit = (
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): TerrainSemanticTile => {
    const geom = geometryFor(context);
    const overrides = set.forTile(geom);
    if (overrides.length === 0) return tile;
    const key = mapOverrideTileKey(geom, overrides);
    const known = edited.get(tile);
    if (known?.key === key) return known.tile;
    const result = applyMapOverrides(tile, geom, overrides);
    edited.set(tile, { key, tile: result });
    return result;
  };
  return {
    createTile(tile, context) {
      return renderer.createTile(edit(tile, context), context);
    },
    createEmptyTile(context) {
      const empty = createEmptyTerrainSemanticTile();
      const tile = edit(empty, context);
      if (tile === empty) return renderer.createEmptyTile?.(context);
      // No map data here is not evidence of open country around what the host placed: without
      // this base the whole tile would be scattered as unmapped ground.
      return renderer.createTile(
        {
          ...tile,
          landcover: [
            {
              class: 'open_ground',
              density: 0,
              polygons: [
                {
                  outer: [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                  ],
                },
              ],
            },
            ...tile.landcover,
          ],
        },
        context,
      );
    },
    disposeTile: (object) => renderer.disposeTile?.(object),
  };
}
