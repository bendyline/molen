import type { WorldgenBudgets } from '@bendyline/molen-worldgen/kernel';

export type WorldgenQualityPreset = 'economy' | 'balanced' | 'high';

/**
 * Scatter instances per tile by quality and detail level. A tile one level below the finest
 * covers four times the area with a fraction of the instances; two levels below keeps a sparse
 * hint; anything coarser carries no props. Every resident tile draws its instances every frame,
 * so these numbers bound the scene, not just one tile: nearby procedural crowns can fill out
 * while distant coverage remains tightly capped.
 */
const SCATTER_INSTANCES: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [2200, 400, 0],
  balanced: [6000, 1200, 250],
  high: [9000, 1800, 350],
};

/**
 * Ground cover (tussocks, ferns, small stones) only near the camera: the finest level on
 * Balanced and High, none on Economy. Its own pool, so it never thins the canopy above.
 */
const GROUND_COVER_INSTANCES: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [0],
  balanced: [5000],
  high: [8000],
};
const GROUND_COVER_MODELS: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [0],
  balanced: [3],
  high: [4],
};

const SCATTER_MODELS: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [3, 2, 0],
  balanced: [4, 3, 2],
  high: [6, 4, 3],
};

function byLevel(table: readonly number[], levelBelowMax: number): number {
  return table[Math.max(0, levelBelowMax)] ?? 0;
}

/**
 * Per-tile budgets by quality and detail level. The finest level keeps every building: the
 * largest get full detail, the rest a simplified facade (a row of windows per floor), then walls
 * and roof alone, then an instanced stand-in once vertices run out. The level below it, which
 * covers four times the ground, draws a few hundred simplified buildings and stands in the rest
 * (pitched buildings as gabled boxes, so a neighbourhood seen from the air still reads as roofs).
 * Coarser levels carry no buildings at all (the human-feature layer is level-bounded). Scatter
 * shrinks with the level (see SCATTER_INSTANCES) and stops three levels below the finest.
 *
 * The counts are sized for real footprints: a zoom-15 suburb has 800-1,600 houses per
 * zoom-14 tile, and a downtown about 1,700 footprints and parts.
 */
export function worldgenTileBudgetForQuality(
  quality: WorldgenQualityPreset,
  levelBelowMax: number,
): WorldgenBudgets {
  const finest = levelBelowMax <= 0;
  const maxInstances = byLevel(SCATTER_INSTANCES[quality], levelBelowMax);
  const scatter = {
    maxInstancesPerRule: maxInstances,
    maxInstances,
    maxPropModels: byLevel(SCATTER_MODELS[quality], levelBelowMax),
    maxGroundCoverInstances: byLevel(GROUND_COVER_INSTANCES[quality], levelBelowMax),
    maxGroundCoverModels: byLevel(GROUND_COVER_MODELS[quality], levelBelowMax),
  };
  switch (quality) {
    case 'economy':
      return {
        maxBuildings: finest ? 2500 : 12_000,
        maxBuildingVertices: finest ? 120_000 : 30_000,
        detailedCount: finest ? 250 : 300,
        ...scatter,
        maxMaterialGroups: 8,
      };
    case 'high':
      return {
        maxBuildings: finest ? 6000 : 40_000,
        maxBuildingVertices: finest ? 420_000 : 140_000,
        detailedCount: finest ? 900 : 1200,
        ...scatter,
        // The shared default library must fit alongside the reserved flat slot materials.
        // Otherwise early roof variants evict wall/glass textures from most nearby buildings.
        maxMaterialGroups: finest ? 24 : 14,
      };
    default:
      return {
        maxBuildings: finest ? 4000 : 30_000,
        maxBuildingVertices: finest ? 280_000 : 90_000,
        detailedCount: finest ? 500 : 600,
        ...scatter,
        maxMaterialGroups: finest ? 16 : 10,
      };
  }
}

/**
 * Edge of the spatial cells a tile's buildings are batched into, meters. Each cell is a draw
 * (per material group up close), so the coarser levels, which cover four or sixteen times the
 * ground and only switch detail far from the camera, use cells four times the area.
 */
export function worldgenBuildingCellSize(levelBelowMax: number): number {
  return levelBelowMax <= 0 ? 512 : 1024;
}
