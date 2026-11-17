/**
 * The shrub crowns the terrain ground material paints over one batch, for scatter's `crowns`
 * rules: the pattern lies in world meters and repeats with the ground's lattice, the batch in
 * local meters from its corner, so a plant lands on the crown seen from the air.
 */
import {
  sampleTerrainBuildingCoverage,
  TERRAIN_GROUND_CROWNS,
  TERRAIN_URBAN_GROUND_CLASSES,
  type TerrainBuildingCoverage,
  type TerrainSemanticTile,
  terrainBuildingCoverage,
  terrainGroundCrown,
  terrainUrbanGroundPaved,
} from '@bendyline/molen-terrain/kernel';
import type { ScatterGroundCrowns } from '@bendyline/molen-worldgen/kernel';

const URBAN = new Set(TERRAIN_URBAN_GROUND_CLASSES);

/**
 * `geom` places the batch: its corner in world meters and its edge. Built-up ground paves over
 * its brush as the land cover does (the terrain's default `urbanGround`), from the coverage of
 * the batch's own footprints.
 */
export function batchGroundCrowns(
  tile: TerrainSemanticTile,
  geom: { originX: number; originZ: number; size: number },
): ScatterGroundCrowns {
  const { cell } = TERRAIN_GROUND_CROWNS;
  let coverage: TerrainBuildingCoverage | undefined;
  return {
    cells: ([minX, minZ, maxX, maxZ]) => [
      Math.floor((geom.originX + minX) / cell),
      Math.floor((geom.originZ + minZ) / cell),
      Math.floor((geom.originX + maxX) / cell),
      Math.floor((geom.originZ + maxZ) / cell),
    ],
    crown(i, j) {
      const crown = terrainGroundCrown(i, j);
      return { ...crown, x: crown.x - geom.originX, z: crown.z - geom.originZ };
    },
    open(x, z, appearance) {
      if (!URBAN.has(appearance)) return 1;
      coverage ??= terrainBuildingCoverage(tile);
      return (
        1 -
        terrainUrbanGroundPaved(
          sampleTerrainBuildingCoverage(coverage, x / geom.size, z / geom.size),
        )
      );
    },
  };
}
