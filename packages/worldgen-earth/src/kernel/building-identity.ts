/** Shared identity for building geometry and its inferred surroundings. */
import type { TerrainBuildingFeature } from '@bendyline/molen-terrain/kernel';
import { quantizedIdentity, ringCentroid, type Vec2 } from '@bendyline/molen-worldgen/kernel';
import type { TileGeometry } from './semantic-adapter';

export function identityFor(
  feature: TerrainBuildingFeature,
  polygonIndex: number,
  outline: Vec2[],
  geom: TileGeometry,
): string {
  if (feature.id !== undefined) {
    return polygonIndex === 0 ? `f:${feature.id}` : `f:${feature.id}|poly:${polygonIndex}`;
  }
  const centroid = ringCentroid(outline);
  return quantizedIdentity(
    (geom.originX + centroid[0]) / geom.metersPerUnit,
    (geom.originZ + centroid[1]) / geom.metersPerUnit,
  );
}
