/**
 * How tall a building is drawn where its map does not say: a bounded prior for unmeasured blocks
 * in dense commercial cores, the ceiling a place's own measured buildings put on any guess, and
 * mapped heights that are shafts rather than floors.
 */
import {
  polygonArea,
  sampleTerrainBuildingCoverage,
  type TerrainSemanticTile,
  terrainBuildingCoverage,
} from '@bendyline/molen-terrain/kernel';
import { hashString, ringCentroid, unit01 } from '@bendyline/molen-worldgen/kernel';
import { buildingLabels, contextLabelForPolygon } from './labels';
import { isMapOverrideFeature } from './map-override-tags';

/**
 * Uses a commercial core leaves unmeasured. Homes, flats, civic buildings and shops keep their
 * styles: a store or restaurant is low even downtown, and big-box retail stands alone.
 */
const CORE_CLASSES = new Set(['building', 'commercial', 'office', 'hotel', 'mixed_use']);
/** Land a generic building must stand in (or none mapped) to count as part of a core. */
const CORE_CONTEXTS = new Set(['commercial', 'retail']);
/** Footprint coverage of nearby ground: an inner suburb, and a built-out downtown block. */
const COVERAGE: [number, number] = [0.35, 0.7];
/** Meters to a storey, to read a mapped height as storeys. */
const STOREY = 3.2;
/** Measured buildings it takes to say how tall a place is built. */
const MIN_EVIDENCE = 8;
/** A smaller footprint with a height is a mast, a chimney or a minaret, m². */
const MIN_EVIDENCE_AREA = 60;
/**
 * The most storeys guessed for a building where neither the map nor a region says more: an
 * ordinary block of flats. Most of the world's towns stay under it.
 */
export const DEFAULT_GUESS_STOREYS = 5;

/**
 * How tall a place is built, as far as its map says: the storeys four in five of its measured
 * buildings stay within (towers are what a map measures first, so the tail runs high).
 * Undefined where too few are measured to say, which is most towns: a basemap carries heights
 * for one building in ten, and in many towns for none.
 */
export function measuredStoreys(tile: TerrainSemanticTile, size: number): number | undefined {
  const storeys: number[] = [];
  for (const feature of tile.buildings) {
    if (
      feature.class === 'building_part' ||
      (feature.minHeight ?? 0) > 0 ||
      feature.tags?.['molen:inferred'] !== undefined ||
      isMapOverrideFeature(feature)
    )
      continue;
    const value =
      feature.levels ?? (feature.height !== undefined ? feature.height / STOREY : undefined);
    if (value === undefined || !(value > 0)) continue;
    const area = feature.polygons.reduce((sum, p) => sum + polygonArea(p), 0) * size * size;
    if (area >= MIN_EVIDENCE_AREA) storeys.push(Math.max(1, Math.round(value)));
  }
  if (storeys.length < MIN_EVIDENCE) return undefined;
  storeys.sort((a, b) => a - b);
  return storeys[Math.floor((storeys.length - 1) * 0.8)];
}

/** From this height a footprint can be a shaft rather than a building, meters. */
const SHAFT_HEIGHT = 20;
/**
 * Height over the footprint's side (the square root of its area) from which it is one: the
 * Torre del Mangia is 22, St Mark's campanile 8, Giotto's 5.9, a minaret more. The narrowest
 * inhabited buildings, nine floors on a 40 m² city lot, reach 5.
 */
const SHAFT_SLENDERNESS = 5.5;
/**
 * A floor plate from which a tall footprint is a tower block however slim, m²: the same plate a
 * regional profile asks of its tower style.
 */
const SHAFT_AREA = 250;
/** Wall between one tier of openings and the next up a shaft, meters. */
const SHAFT_TIER = 11;

/**
 * Tiers of openings for a mapped height that is a shaft: a bell tower, a tower house, a minaret,
 * a chimney, a lighthouse. A map gives such a thing its height and nothing else, and a height
 * divided into storeys draws the Torre del Mangia as 29 floors of flats on a 21 m² plot.
 * Undefined for anything a floor could be laid in. The caller asks only for a whole building
 * standing on the ground: a slender part of a larger tower is that tower's.
 */
export function shaftLevels(heightMeters: number, areaM2: number): number | undefined {
  if (!(heightMeters >= SHAFT_HEIGHT) || !(areaM2 > 0) || areaM2 >= SHAFT_AREA) return undefined;
  if (heightMeters / Math.sqrt(areaM2) < SHAFT_SLENDERNESS) return undefined;
  return Math.max(2, Math.round(heightMeters / SHAFT_TIER));
}

/**
 * The most storeys to guess for an unmeasured building of this tile: what its measured
 * neighbours reach, and never less than its region's ordinary block (`regional`).
 */
export function guessCeiling(
  tile: TerrainSemanticTile,
  size: number,
  regional: number = DEFAULT_GUESS_STOREYS,
): number {
  return Math.max(regional, measuredStoreys(tile, size) ?? 0);
}

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
 * leaves the style's own fallback. Dense ground alone is not a downtown: a medina and a hill
 * town cover as much of theirs at two and three storeys, so the prior stays within `ceiling`,
 * what the place's measured buildings reach.
 */
export function districtLevels(
  labels: readonly string[],
  context: string | undefined,
  areaM2: number,
  coverage: number,
  identity: string,
  ceiling = 16,
): number | undefined {
  if (coverage < COVERAGE[0] || areaM2 < 250) return undefined;
  if (!labels.every((label) => CORE_CLASSES.has(label))) return undefined;
  if (labels.includes('building') && context !== undefined && !CORE_CONTEXTS.has(context))
    return undefined;
  const t = smooth(COVERAGE[0], COVERAGE[1], coverage);
  const size = areaM2 < 600 ? 0.6 : areaM2 < 1500 ? 0.85 : 1;
  const draw = 0.7 + 0.6 * unit01(hashString(`district|${identity}`), 0);
  return Math.max(2, Math.min(16, ceiling, Math.round((3 + 7 * t) * size * draw)));
}

/**
 * The tile with district priors filled in as `levels` (the same tile when none apply). The
 * per-building draw keys on the source id, else the footprint's world position, so a building
 * keeps its height as tiles change level. Coverage leaves out the building's own footprint, so a
 * large building alone in its parking lot does not count as a dense block. `regional` is the
 * region's ordinary block in storeys (see `guessCeiling`).
 */
export function withDistrictLevels(
  tile: TerrainSemanticTile,
  origin: readonly [number, number],
  size: number,
  regional: number = DEFAULT_GUESS_STOREYS,
): TerrainSemanticTile {
  if (tile.buildings.length === 0) return tile;
  let ceiling: number | undefined;
  let coverage: ReturnType<typeof terrainBuildingCoverage> | undefined;
  let changed = false;
  const buildings = tile.buildings.map((feature) => {
    if (
      feature.height !== undefined ||
      feature.levels !== undefined ||
      (feature.minHeight ?? 0) > 0 ||
      feature.class === 'building_part' ||
      feature.tags?.['molen:inferred'] !== undefined ||
      // A host's building is as tall as its owner said, or one level: never a district's guess.
      isMapOverrideFeature(feature)
    )
      return feature;
    const polygon = feature.polygons[0];
    if (polygon === undefined || polygon.outer.length < 3) return feature;
    coverage ??= terrainBuildingCoverage(tile);
    ceiling ??= guessCeiling(tile, size, regional);
    const centroid = ringCentroid(polygon.outer);
    const share = feature.polygons.reduce((sum, p) => sum + polygonArea(p), 0);
    // The coverage grid blurs each cell over its 3 x 3 neighbors (see terrainBuildingCoverage).
    const own = (share * coverage.size * coverage.size) / 9;
    const levels = districtLevels(
      buildingLabels(feature),
      contextLabelForPolygon(polygon, centroid, tile.landcover),
      share * size * size,
      sampleTerrainBuildingCoverage(coverage, centroid[0], centroid[1]) - own,
      feature.id !== undefined
        ? String(feature.id)
        : `${Math.round(origin[0] + centroid[0] * size)},${Math.round(origin[1] + centroid[1] * size)}`,
      ceiling,
    );
    if (levels === undefined) return feature;
    changed = true;
    return { ...feature, levels };
  });
  return changed ? { ...tile, buildings } : tile;
}
