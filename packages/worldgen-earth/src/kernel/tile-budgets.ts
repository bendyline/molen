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
  economy: [2200, 800, 200],
  balanced: [6000, 2400, 800],
  high: [9000, 3600, 1200],
};
// The coarser levels were 1,200 and 250 at Balanced (400 and none at Economy): a twentieth of the
// finest level's density, then a four-hundredth, so a wood ended on the straight edge of a tile
// and the land beyond read as lawn. Trees are not what a frame spends its triangles on (at
// Balanced from 900 m, 8,400 instances drew 4% of them; the ground under them drew 43%), and a
// distant crown is 12-20 triangles, so the far levels can afford to thin by tens, not hundreds.

/**
 * Ground cover (tussocks, ferns, small stones) only near the camera: the finest level on
 * Balanced and High, none on Economy. Its own pool, so it never thins the canopy above.
 */
const GROUND_COVER_INSTANCES: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [0],
  balanced: [6500],
  high: [10_000],
};
// A model is a draw per quarter tile in view, and what a walker reads as variety: a tile shows
// only its commonest species, so seven left a meadow, a wood's floor and a verge sharing them.
const GROUND_COVER_MODELS: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [0],
  balanced: [7],
  high: [10],
};

// Broad shrub masses survive Economy and one coarser tile; blades and litter remain near-only.
const UNDERSTORY_INSTANCES: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [450, 80],
  balanced: [1800, 250],
  high: [2800, 400],
};
const UNDERSTORY_MODELS: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [2, 1],
  balanced: [4, 2],
  high: [6, 2],
};

/**
 * Planted ground (the `garden` layer): yard shrubs and beds, hedges, small ornamental trees, park
 * borders. Its own pool, so a wood in the same tile cannot thin a neighborhood's planting. Most
 * of it is near-detail-only beds, which a coarser tile does not draw at all, so that level keeps
 * only a hint of the shrubs.
 */
const GARDEN_INSTANCES: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [700, 100],
  balanced: [5000, 300],
  high: [9000, 500],
};
const GARDEN_MODELS: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [3, 1],
  balanced: [9, 2],
  high: [14, 3],
};

const SCATTER_MODELS: Record<WorldgenQualityPreset, readonly number[]> = {
  economy: [3, 2, 0],
  balanced: [4, 3, 2],
  high: [6, 4, 3],
};

/**
 * Plants on the ground's painted crowns a finest tile keeps for the near layer
 * (`WorldgenBatchOutput.near`), the same at every quality: only those around the camera are drawn,
 * and the ground paints its crowns at every quality. A zoom-13 tile of the densest scrub, 4.9 km
 * across at the equator, paints about 190,000, 42 bytes each (about 8 MB); a larger tile keeps a
 * uniform subset. Coarser tiles keep none: the camera stands in a finest one wherever the crowns
 * resolve.
 */
const NEAR_INSTANCES = 250_000;

/**
 * Cells of a finest tile's turf cover (`WorldgenBatchOutput.turf`), the mask of where its ground
 * grows grass: 768 a side, so a meter a cell on a tile up to 768 m across and 1.3 m on a
 * kilometer one. Its rows are stored as runs (tens of kilobytes for a suburb). None at Economy,
 * which draws no tufts, nor on coarser tiles: a camera near enough to see a tuft is over a
 * finest one.
 */
const TURF_CELLS: Record<WorldgenQualityPreset, number> = {
  economy: 0,
  balanced: 768 * 768,
  high: 768 * 768,
};

function byLevel(table: readonly number[], levelBelowMax: number): number {
  return table[Math.max(0, levelBelowMax)] ?? 0;
}

/**
 * Per-tile budgets by quality and detail level. The finest level keeps every building: the
 * largest get full detail, the rest a simplified facade (a row of windows per floor), then walls
 * and roof alone, then an instanced stand-in once vertices or the building count run out
 * (`maxStandIns`: a 1.2 km tile of central Bogotá holds 10,600 footprints against 6,000
 * buildings at High, and the 4,600 smallest were simply missing). The level below it, which
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
  options: { compactBuildings?: boolean } = {},
): WorldgenBudgets {
  const finest = levelBelowMax <= 0;
  const maxInstances = byLevel(SCATTER_INSTANCES[quality], levelBelowMax);
  const scatter = {
    maxInstancesPerRule: maxInstances,
    maxInstances,
    maxPropModels: byLevel(SCATTER_MODELS[quality], levelBelowMax),
    maxGroundCoverInstances: byLevel(GROUND_COVER_INSTANCES[quality], levelBelowMax),
    maxGroundCoverModels: byLevel(GROUND_COVER_MODELS[quality], levelBelowMax),
    maxUnderstoryInstances: byLevel(UNDERSTORY_INSTANCES[quality], levelBelowMax),
    maxUnderstoryModels: byLevel(UNDERSTORY_MODELS[quality], levelBelowMax),
    maxGardenInstances: byLevel(GARDEN_INSTANCES[quality], levelBelowMax),
    maxGardenModels: byLevel(GARDEN_MODELS[quality], levelBelowMax),
    maxAgricultureInstances: byLevel(
      quality === 'economy' ? [500, 100] : quality === 'balanced' ? [3500, 600] : [6500, 1000],
      levelBelowMax,
    ),
    maxAgricultureModels: byLevel(
      quality === 'economy' ? [2, 1] : quality === 'balanced' ? [5, 3] : [8, 4],
      levelBelowMax,
    ),
    maxNearInstances: finest ? NEAR_INSTANCES : 0,
    maxTurfCells: finest ? TURF_CELLS[quality] : 0,
  };
  switch (quality) {
    case 'economy':
      return {
        maxBuildings: finest ? 2500 : 12_000,
        maxStandIns: finest ? 8000 : 24_000,
        maxBuildingVertices: finest ? 120_000 : 30_000,
        detailedCount: finest ? 250 : 300,
        ...scatter,
        maxMaterialGroups: 8,
      };
    case 'high':
      return {
        maxBuildings: finest ? 6000 : 40_000,
        maxStandIns: finest ? 24_000 : 60_000,
        // Houses with shutters, dormers and chimneys run about twice the vertices of a plain box;
        // this keeps a dense suburban block fully detailed near the camera. Compact keeps under
        // half, for renderers that pay full price for every building in both the shadow and
        // main passes (WebGL), where the larger budget costs a quarter of the frame rate.
        maxBuildingVertices:
          options.compactBuildings === true
            ? finest
              ? 320_000
              : 120_000
            : finest
              ? 900_000
              : 200_000,
        detailedCount: finest ? 900 : 1200,
        ...scatter,
        // The shared default library must fit alongside the reserved flat slot materials.
        // Otherwise early roof variants evict wall/glass textures from most nearby buildings.
        maxMaterialGroups: finest ? 24 : 14,
      };
    default:
      return {
        maxBuildings: finest ? 4000 : 30_000,
        maxStandIns: finest ? 16_000 : 40_000,
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
