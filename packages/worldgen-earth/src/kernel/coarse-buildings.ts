import { polygonArea, type TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';

/** Bounded distant massing; surveyed heights and footprints survive, detail does not. */
export function coarseBuildingTile(tile: TerrainSemanticTile, limit = 256): TerrainSemanticTile {
  const buildings = tile.buildings
    .map((feature, index) => ({
      feature,
      index,
      score:
        feature.polygons.reduce((a, p) => a + polygonArea(p), 0) *
        Math.max(3, feature.height ?? (feature.levels ?? 2) * 3.2),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map(({ feature }) => feature);
  return { ...tile, buildings, transportation: [], landcover: [], water: [], pois: [] };
}
