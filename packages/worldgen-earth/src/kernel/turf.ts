/**
 * The grass a tile's ground grows, for the tufts a host stands round its camera
 * (`WorldgenBatchOutput.turf`): which land cover is a lawn, a meadow or a verge, how tall and how
 * thick, and what no grass grows on. The generator makes the mask; this is the one place that
 * knows what a map class means for it.
 */

import {
  landcoverAppearance,
  orderLandcover,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  transportKind,
  transportWidth,
} from '@bendyline/molen-terrain/kernel';
import type {
  ScatterExclusion,
  TurfRequest,
  TurfSward,
  Vec2,
} from '@bendyline/molen-worldgen/kernel';
import { isLandcoverDesignation } from './labels';

type Sward = Pick<TurfSward, 'height' | 'density'>;

/** Mown turf: lawns, parks, gardens. Short and close. */
const LAWN: Sward = { height: 0.15, density: 2.6 };
/** An airfield's grass: cut, but to a hand's height rather than a lawn's. */
const AIRFIELD: Sward = { height: 0.26, density: 2.2 };
/** Unmown ground between other things: verges, vacant land, the edge of a town. */
const ROUGH: Sward = { height: 0.34, density: 1.7 };
/** Standing grass: meadows and open grassland. */
const MEADOW: Sward = { height: 0.5, density: 1.9 };
/** Grass between shrubs. */
const SPARSE: Sward = { height: 0.36, density: 0.7 };
/** Sedge and rush tussocks on wet ground. */
const MARSH: Sward = { height: 0.6, density: 1.3 };

/**
 * Ground that is grass whatever its color, by the appearance the ground paints it with
 * (`landcoverAppearance`): mapped as grass, so a dry region's is straw-colored, not absent.
 * Mown sports turf, greens and fairways are not here: a tuft is taller than their grass.
 */
const GRASS: Readonly<Record<string, Sward>> = {
  grass: LAWN,
  park: LAWN,
  garden: LAWN,
  cemetery: LAWN,
  aerodrome: AIRFIELD,
  meadow: MEADOW,
  grassland: MEADOW,
  orchard: ROUGH,
  wetland: MARSH,
};

/**
 * Ground that grows grass only where the region paints it green: unmapped land is a verge in a
 * temperate town and bare sand in a desert, and the palette is what says which.
 */
const WHERE_GREEN: Readonly<Record<string, Sward>> = {
  open_ground: ROUGH,
  residential: LAWN,
  scrub: SPARSE,
  heath: SPARSE,
};

/**
 * How far green must lead red in a ground color for it to count as grass: by this much of 255
 * (as encoded) and by this share of the green itself. The temperate and tropical palettes' open
 * ground leads by 18 to 21 (a seventh to a quarter of its green); rock, sand, paving and the dry
 * regions' olive-tan do not lead at all, and ice and snow lead by a twentieth. Blue may match
 * green (the Pacific coast's rough ground is a dark teal) but not pass it.
 */
const GREEN_LEAD = 8;
const GREEN_LEAD_SHARE = 0.08;
const BLUE_LEAD = 4;

function green(color: string | undefined): boolean {
  if (color === undefined || !/^#[0-9a-f]{6}$/i.test(color)) return false;
  const r = Number.parseInt(color.slice(1, 3), 16),
    g = Number.parseInt(color.slice(3, 5), 16),
    b = Number.parseInt(color.slice(5, 7), 16);
  return g - r >= GREEN_LEAD && g - r >= GREEN_LEAD_SHARE * g && b - g <= BLUE_LEAD;
}

/** Meters kept clear round a building's walls, a fence line, water, and an inferred drive. */
const CLEAR_BUILDING = 0.6;
const CLEAR_FENCE = 0.25;
const CLEAR_WATER = 0.8;
const CLEAR_DRIVE = 0.3;
/**
 * Meters past a carriageway's edge that are paved or worn by its kind: a street's sidewalk and
 * curb, a motorway's shoulder, a track's ballast, and the trodden edge of a service road or path.
 */
const CLEAR_BESIDE: Readonly<Record<ReturnType<typeof transportKind>, number>> = {
  street: 2.4,
  motorway: 3,
  rail: 1.8,
  service: 0.8,
  path: 0.5,
};
/** A runway's and a taxiway's width where the map gives none, as the airside painter draws them. */
const RUNWAY_WIDTH = 30;
const TAXIWAY_WIDTH = 18;
const CLEAR_AIRSIDE = 1.5;

function airside(feature: TerrainTransportationFeature): 'runway' | 'taxiway' | undefined {
  const kind = /^(runway|taxiway|taxilane|parking_position)$/.test(feature.subclass ?? '')
    ? (feature.subclass as string)
    : feature.class;
  if (kind === 'runway') return 'runway';
  if (/^(aeroway|taxiway|taxilane|parking_position)$/.test(kind)) return 'taxiway';
  return feature.tags?.aeroway !== undefined ? 'taxiway' : undefined;
}

/**
 * The turf request for a tile, or undefined when none of its ground grows grass. `size` is the
 * tile's edge in the request's local meters. `colors` is the palette the ground is painted with
 * (class to `#rrggbb`), which decides the classes that are grass only where it is green.
 * `exclusions` are the scatter request's: its buildings, water, fences and inferred drives are
 * kept clear with the margins grass needs, and its roads are measured again from the map, to
 * the edge of what is paved beside them. `openGround`: the ground paints land no polygon covers
 * as `open_ground` (a host with regional ecology does).
 */
export function turfRequestFromTile(
  tile: TerrainSemanticTile,
  size: number,
  colors: Readonly<Record<string, string>> | undefined,
  exclusions: readonly ScatterExclusion[],
  openGround: boolean,
): TurfRequest | undefined {
  const swards: TurfSward[] = [];
  const indexOf = new Map<string, number | undefined>();
  const swardFor = (appearance: string): number | undefined => {
    if (indexOf.has(appearance)) return indexOf.get(appearance);
    const sward =
      GRASS[appearance] ?? (green(colors?.[appearance]) ? WHERE_GREEN[appearance] : undefined);
    const index =
      sward === undefined ? undefined : swards.push({ label: appearance, ...sward }) - 1;
    indexOf.set(appearance, index);
    return index;
  };
  const ground: TurfRequest['ground'] = [];
  if (openGround) {
    const sward = swardFor('open_ground');
    ground.push({
      ring: [
        [0, 0],
        [size, 0],
        [size, size],
        [0, size],
      ],
      ...(sward !== undefined ? { sward } : {}),
    });
  }
  // A host with regional ecology leaves place and protection outlines out of its ground.
  const drawn = openGround
    ? tile.landcover.filter((feature) => !isLandcoverDesignation(feature))
    : tile.landcover;
  for (const feature of orderLandcover(drawn)) {
    // A cultivated field carries its crop's rows, not grass.
    const sward =
      feature.cultivation !== undefined || isLandcoverDesignation(feature)
        ? undefined
        : swardFor(landcoverAppearance(feature));
    for (const polygon of feature.polygons)
      ground.push({
        ring: polygon.outer.map((point): Vec2 => [point[0] * size, point[1] * size]),
        ...(polygon.holes !== undefined && polygon.holes.length > 0
          ? {
              holes: polygon.holes.map((hole) => hole.map((p): Vec2 => [p[0] * size, p[1] * size])),
            }
          : {}),
        ...(sward !== undefined ? { sward } : {}),
      });
  }
  if (swards.length === 0) return undefined;
  const clear: ScatterExclusion[] = [];
  for (const exclusion of exclusions) {
    if (exclusion.kind === undefined) clear.push(exclusion);
    else if (exclusion.kind === 'water') clear.push({ ...exclusion, radius: CLEAR_WATER });
    else if (exclusion.kind === 'buildings')
      clear.push({
        ...exclusion,
        radius: exclusion.ring !== undefined ? CLEAR_BUILDING : CLEAR_FENCE,
      });
    // A road's line is measured below; a ring of that kind is an inferred lot's drive or path.
    else if (exclusion.ring !== undefined) clear.push({ ...exclusion, radius: CLEAR_DRIVE });
  }
  for (const feature of tile.transportation) {
    if (feature.tunnel === true) continue;
    const air = airside(feature);
    const kind = transportKind(feature);
    const width =
      air !== undefined
        ? (feature.width ?? (air === 'runway' ? RUNWAY_WIDTH : TAXIWAY_WIDTH))
        : transportWidth(feature, kind);
    const radius = air !== undefined ? CLEAR_AIRSIDE : CLEAR_BESIDE[kind];
    for (const line of feature.lines)
      clear.push({
        polyline: line.map((point): Vec2 => [point[0] * size, point[1] * size]),
        width,
        radius,
      });
  }
  return { swards, ground, clear };
}
