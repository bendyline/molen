/** Bounded height priors for unmeasured buildings in dense commercial cores. */
import {
  polygonArea,
  sampleTerrainBuildingCoverage,
  type TerrainSemanticTile,
  terrainBuildingCoverage,
} from '@bendyline/molen-terrain/kernel';
import { hashString, ringCentroid, unit01 } from '@bendyline/molen-worldgen/kernel';
import { buildingLabels, contextLabelForPolygon } from './labels';

/** Uses a commercial core leaves unmeasured. Homes, flats and civic buildings keep their styles. */
const CORE_CLASSES = new Set(['building', 'commercial', 'office', 'retail', 'hotel', 'mixed_use']);
/** Land a generic building must stand in (or none mapped) to count as part of a core. */
const CORE_CONTEXTS = new Set(['commercial', 'retail']);
/** Footprint coverage of nearby ground: an inner suburb, and a built-out downtown block. */
const COVERAGE: [number, number] = [0.35, 0.7];

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Levels for a building with neither a height nor a level count. Basemaps carry heights for
 * some downtown towers and none for most of the blocks around them, which a style's one- or
 * two-level fallback then draws as a flat, shadowless core (matched Seattle orthophotos). As
 * footprints cover more of the nearby ground, an unmeasured commercial block's prior rises
 * from 3 to 10 levels, scaled by its footprint and a stable per-building draw. Undefined
 * leaves the style's own fallback.
 */
export function districtLevels(
  labels: readonly string[],
  context: string | undefined,
  areaM2: number,
  coverage: number,
  identity: string,
): number | undefined {
  if (coverage < COVERAGE[0] || areaM2 < 250) return undefined;
  if (!labels.every((label) => CORE_CLASSES.has(label))) return undefined;
  if (labels.includes('building') && context !== undefined && !CORE_CONTEXTS.has(context))
    return undefined;
  const t = smooth(COVERAGE[0], COVERAGE[1], coverage);
  const size = areaM2 < 600 ? 0.6 : areaM2 < 1500 ? 0.85 : 1;
  const draw = 0.7 + 0.6 * unit01(hashString(`district|${identity}`), 0);
  return Math.max(2, Math.min(16, Math.round((3 + 7 * t) * size * draw)));
}

/**
 * The tile with district priors filled in as `levels` (the same tile when none apply). The
 * per-building draw keys on the source id, else the footprint's world position, so a building
 * keeps its height as tiles change level.
 */
export function withDistrictLevels(
  tile: TerrainSemanticTile,
  origin: readonly [number, number],
  size: number,
): TerrainSemanticTile {
  if (tile.buildings.length === 0) return tile;
  let coverage: ReturnType<typeof terrainBuildingCoverage> | undefined;
  let changed = false;
  const buildings = tile.buildings.map((feature) => {
    if (
      feature.height !== undefined ||
      feature.levels !== undefined ||
      (feature.minHeight ?? 0) > 0 ||
      feature.class === 'building_part' ||
      feature.tags?.['molen:inferred'] !== undefined
    )
      return feature;
    const polygon = feature.polygons[0];
    if (polygon === undefined || polygon.outer.length < 3) return feature;
    coverage ??= terrainBuildingCoverage(tile);
    const centroid = ringCentroid(polygon.outer);
    const area = feature.polygons.reduce((sum, p) => sum + polygonArea(p), 0) * size * size;
    const levels = districtLevels(
      buildingLabels(feature),
      contextLabelForPolygon(polygon, centroid, tile.landcover),
      area,
      sampleTerrainBuildingCoverage(coverage, centroid[0], centroid[1]),
      feature.id !== undefined
        ? String(feature.id)
        : `${Math.round(origin[0] + centroid[0] * size)},${Math.round(origin[1] + centroid[1] * size)}`,
    );
    if (levels === undefined) return feature;
    changed = true;
    return { ...feature, levels };
  });
  return changed ? { ...tile, buildings } : tile;
}
