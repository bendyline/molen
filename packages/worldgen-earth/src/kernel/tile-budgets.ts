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

const SCATTER_MODELS: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [3, 2, 0],
  balanced: [4, 3, 2],
  high: [6, 4, 3],
};

function byLevel(table: readonly number[], levelBelowMax: number): number {
  return table[Math.max(0, levelBelowMax)] ?? 0;
}

/**
 * Per-tile budgets by quality and detail level. The finest level keeps full geometry; the level
 * below it keeps a few hundred detailed buildings and boxes the rest; coarser levels carry no
 * buildings at all (the human-feature layer is level-bounded). Scatter shrinks with the level
 * (see SCATTER_INSTANCES) and stops three levels below the finest.
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
  };
  switch (quality) {
    case 'economy':
      return {
        maxBuildings: finest ? 400 : 8000,
        maxBuildingVertices: finest ? 70_000 : 20_000,
        detailedCount: finest ? 250 : 300,
        ...scatter,
        maxMaterialGroups: 6,
      };
    case 'high':
      return {
        maxBuildings: finest ? 1500 : 30_000,
        maxBuildingVertices: finest ? 260_000 : 80_000,
        detailedCount: finest ? 900 : 1200,
        ...scatter,
        // The shared default library must fit alongside the reserved flat slot materials.
        // Otherwise early roof variants evict wall/glass textures from most nearby buildings.
        maxMaterialGroups: finest ? 24 : 14,
      };
    default:
      return {
        maxBuildings: finest ? 900 : 20_000,
        maxBuildingVertices: finest ? 140_000 : 40_000,
        detailedCount: finest ? 500 : 600,
        ...scatter,
        maxMaterialGroups: 10,
      };
  }
}
