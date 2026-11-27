/**
 * Floating homes: house-sized buildings the map draws out on open water, moored in a row along
 * a dock (Lake Union's houseboats, Portland's floating homes, Amsterdam's woonboten). Protomaps
 * keeps no building type, so a floating home arrives as a plain footprint whose outline lies in a
 * lake's, a river's or the sea's polygon. Drawn as an ordinary house it stands on the bed below
 * the drawn water; read here, it rides on a float at the water's surface in a houseboat's style.
 *
 * A building on a pier is not afloat (a pier-top shed, a ferry terminal), and neither is one much
 * larger than a house (a covered moorage, a boathouse hall). A lone small building over water is
 * most often a boat lift's canopy or a private boathouse at the end of a jetty: floating homes
 * are moored together, so one counts only with neighbours that are afloat too.
 */

import {
  pointInPolygon,
  polygonArea,
  polygonBounds,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import type { HeightSampler } from '@bendyline/molen-worldgen/kernel';
import type { BuildingPiece } from './building-parts';
import { isMapOverrideFeature } from './map-override-tags';

/** Label put first on a floating home's request; style rules can name it like any class. */
export const FLOATING_HOME_LABEL = 'floating_home';
/** The houseboat exterior a pack offers for floating homes; packs without it keep their own. */
export const FLOATING_HOME_STYLE = 'molen.worldgen.use.floating_home';

/** Smallest floating home, m²: a boat lift's canopy or a dock box is smaller. */
const MIN_HOME_AREA = 30;
/**
 * Largest, m². Lake Union's floating homes are 40 to 300 m² (median 106); past this a building
 * over water is a covered moorage or a boathouse hall (Seattle's run from 450 to 5,600 m²).
 */
const MAX_HOME_AREA = 450;
/** Share of an outline's points (its corners and middle) that lie in the water. */
const MIN_WET_SHARE = 0.75;
/** Share of them on a pier from which the building stands on the pier instead. */
const PIER_SHARE = 0.3;
/** Water smaller than this holds no floating home, m²: a garden pond's pavilion stands. */
const MIN_WATER_AREA = 2000;
/** Meters between floating homes' middles that moors them together. */
const NEIGHBOUR_REACH = 40;
/** Neighbours afloat within reach a floating home needs: a row's two sides. */
const MIN_NEIGHBOURS = 2;
/** Water classes no house floats on. */
const STILL_WATER = /pool|fountain|basin_reflect/;

/**
 * How the drawn water is placed, for the level a floating home rides at: the host's water mesh
 * offset above its surface samples, and its sea level (water whose lower samples lie within 2 m
 * of it is the sea, drawn flat at 1.5 m above it). The defaults are the Earth view's.
 */
export interface FloatingHomeWater {
  offset?: number;
  seaLevel?: number;
}

const EARTH_WATER_OFFSET = 0.65;
const SEA_BAND = 2;
const SEA_MARGIN = 1.5;

/** Where a floating home rides: the height of the water surface it floats on. */
export interface FloatingHome {
  waterline: number;
}

/**
 * The height the terrain draws a water polygon at, as `terrainWaterSurfaceHeight` works it out
 * (a lower quartile of the ground inside it, or the sea's one level), so a float rides on the
 * surface a viewer sees rather than on the bed or a bank. `ground` is in tile-local meters.
 */
export function floatingWaterLevel(
  polygon: TerrainSemanticPolygon,
  ground: HeightSampler,
  size: number,
  water: FloatingHomeWater = {},
): number {
  const offset = water.offset ?? EARTH_WATER_OFFSET;
  const [minU, minV, maxU, maxV] = polygonBounds(polygon);
  const u0 = Math.max(0, Math.min(1, minU)),
    v0 = Math.max(0, Math.min(1, minV)),
    u1 = Math.max(0, Math.min(1, maxU)),
    v1 = Math.max(0, Math.min(1, maxV));
  const samples: number[] = [];
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const p: TerrainSemanticPoint = [
        u0 + ((u1 - u0) * (x + 0.5)) / 9,
        v0 + ((v1 - v0) * (y + 0.5)) / 9,
      ];
      if (pointInPolygon(p, polygon)) samples.push(ground.sampleHeight(p[0] * size, p[1] * size));
    }
  if (samples.length === 0)
    for (const p of polygon.outer) samples.push(ground.sampleHeight(p[0] * size, p[1] * size));
  samples.sort((a, b) => a - b);
  const low = samples[Math.floor((samples.length - 1) * 0.25)] ?? 0;
  const sea = water.seaLevel ?? 0;
  return low < sea + SEA_BAND ? sea + SEA_MARGIN + offset : low + offset;
}

interface Water {
  polygon: TerrainSemanticPolygon;
  bounds: [number, number, number, number];
  level?: number;
}

const within = (bounds: readonly number[], p: TerrainSemanticPoint): boolean =>
  p[0] >= (bounds[0] as number) &&
  p[0] <= (bounds[2] as number) &&
  p[1] >= (bounds[1] as number) &&
  p[1] <= (bounds[3] as number);

/** An outline's corners and the middle of its bounds: what is tested against water and piers. */
function probes(polygon: TerrainSemanticPolygon): TerrainSemanticPoint[] {
  const [minU, minV, maxU, maxV] = polygonBounds(polygon);
  return [...polygon.outer, [(minU + maxU) / 2, (minV + maxV) / 2]];
}

/**
 * The tile's floating homes among `pieces`, with the water level each rides at. Empty where the
 * footprints are merged (`buildingsGeneralized`) or there is no ground to read the water from.
 */
export function associateFloatingHomes(
  tile: TerrainSemanticTile,
  pieces: readonly BuildingPiece[],
  size: number,
  ground: HeightSampler | undefined,
  water?: FloatingHomeWater,
): Map<BuildingPiece, FloatingHome> {
  const homes = new Map<BuildingPiece, FloatingHome>();
  if (ground === undefined || tile.buildingsGeneralized === true || pieces.length === 0)
    return homes;
  const waters: Water[] = [];
  for (const feature of tile.water) {
    if (STILL_WATER.test(feature.class ?? '')) continue;
    for (const polygon of feature.polygons ?? [])
      if (polygonArea(polygon) * size * size >= MIN_WATER_AREA)
        waters.push({ polygon, bounds: polygonBounds(polygon) });
  }
  if (waters.length === 0) return homes;
  const piers: { polygon: TerrainSemanticPolygon; bounds: number[] }[] = [];
  for (const feature of tile.landcover)
    if (feature.class === 'pier')
      for (const polygon of feature.polygons)
        piers.push({ polygon, bounds: polygonBounds(polygon) });
  const afloat: { piece: BuildingPiece; water: Water; x: number; z: number }[] = [];
  for (const piece of pieces) {
    const { feature, polygon } = piece;
    if (
      isMapOverrideFeature(feature) ||
      feature.class === 'building_part' ||
      feature.tags?.['molen:inferred'] !== undefined ||
      (feature.minHeight ?? 0) > 0
    )
      continue;
    const area = polygonArea(polygon) * size * size;
    if (area < MIN_HOME_AREA || area > MAX_HOME_AREA) continue;
    const points = probes(polygon);
    const middle = points[points.length - 1] as TerrainSemanticPoint;
    const home = waters.find(
      (candidate) => within(candidate.bounds, middle) && pointInPolygon(middle, candidate.polygon),
    );
    if (home === undefined) continue;
    const wet = points.filter((p) => pointInPolygon(p, home.polygon)).length;
    if (wet < MIN_WET_SHARE * points.length) continue;
    const onPier = points.filter((p) =>
      piers.some((pier) => within(pier.bounds, p) && pointInPolygon(p, pier.polygon)),
    ).length;
    if (onPier >= PIER_SHARE * points.length) continue;
    afloat.push({ piece, water: home, x: middle[0] * size, z: middle[1] * size });
  }
  for (const entry of afloat) {
    let neighbours = 0;
    for (const other of afloat)
      if (
        other !== entry &&
        Math.hypot(other.x - entry.x, other.z - entry.z) <= NEIGHBOUR_REACH &&
        ++neighbours >= MIN_NEIGHBOURS
      )
        break;
    if (neighbours < MIN_NEIGHBOURS) continue;
    entry.water.level ??= floatingWaterLevel(entry.water.polygon, ground, size, water);
    homes.set(entry.piece, { waterline: entry.water.level });
  }
  return homes;
}
