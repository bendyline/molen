/**
 * Bridge outlines the map files as paved land.
 *
 * OpenStreetMap draws many bridges twice: the ways that cross it (`bridge=yes`) and the
 * structure's own outline (`man_made=bridge`). The Protomaps basemap puts that outline in its
 * land-use layer as `kind: pedestrian`, the class of a plaza. Read as land, it was paved at
 * ground level beneath the deck, over whatever the bridge crosses: a pale strip lay across I-5
 * under nearly every Seattle overpass, over the freeway's asphalt and paint, with plaza-colored
 * ground in its medians (MLK Jr Way S at 47.4994, -122.2735).
 *
 * The outline is the deck's footprint, which the bridge structure draws itself. A plaza does not
 * lie along a deck: Seattle's mapped pedestrian areas are either almost wholly within a few
 * meters of a bridge way's carriageway or almost wholly clear of one. Those that are are dropped
 * from the land cover, for every reader alike: the ground colors, the paved areas the surface
 * painter lays, the sidewalks and fringes that stop at paving, and scatter.
 */
import { landcoverAppearance } from './landcover-appearance';
import { terrainLinePath } from './line-path';
import { polygonBounds } from './polygon';
import {
  deriveTerrainSemanticTileContentHash,
  deriveTerrainSemanticTilePacket,
} from './semantic-packet';
import type {
  TerrainLandcoverFeature,
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
  TerrainTransportationFeature,
} from './semantic-types';
import { transportWidth } from './transport-features';

/**
 * World units past a bridge way's carriageway edge that its outline still covers: sidewalks,
 * barriers and the outline's own slack. Outlines are surveyed, carriageways drawn at a nominal
 * width, and a meter is 1/cos(latitude) world units (1.5 in Seattle), so outlines run wider.
 */
export const TERRAIN_BRIDGE_OUTLINE_MARGIN = 8;
/** Share of a paved area within reach of bridge decks from which it is taken as their outline. */
export const TERRAIN_BRIDGE_OUTLINE_SHARE = 0.5;
/** Most points sampled inside one area, and the coarsest spacing (world units) for small ones. */
const MAX_SAMPLES = 1600;
const MAX_STEP_SMALL = 1.5;

/** A straight piece of a bridge way, world units, with how far from it its outline reaches. */
interface Deck {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  reach: number;
}

/** The land-cover classes an outline arrives as (Protomaps: `man_made=bridge` → pedestrian). */
function pavedLand(feature: TerrainLandcoverFeature): boolean {
  return landcoverAppearance(feature) === 'pedestrian';
}

/** Every straight piece of the tile's bridge ways, in world units. */
function decksOf(tile: TerrainSemanticTile, tileSize: number, margin: number): Deck[] {
  const decks: Deck[] = [];
  for (const feature of tile.transportation) {
    if (feature.bridge !== true || feature.tunnel === true) continue;
    const reach = transportWidth(feature) / 2 + margin;
    for (const line of feature.lines) {
      if (line.length < 2) continue;
      const path = terrainLinePath(line, tileSize);
      for (let i = 1; i < path.points.length; i++) {
        const [ax, az] = path.points[i - 1] as TerrainSemanticPoint,
          [bx, bz] = path.points[i] as TerrainSemanticPoint;
        decks.push({ ax, az, bx, bz, reach });
      }
    }
  }
  return decks;
}

function within(deck: Deck, x: number, z: number): boolean {
  const dx = deck.bx - deck.ax,
    dz = deck.bz - deck.az;
  const length = dx * dx + dz * dz;
  const t =
    length > 0 ? Math.max(0, Math.min(1, ((x - deck.ax) * dx + (z - deck.az) * dz) / length)) : 0;
  return Math.hypot(x - deck.ax - t * dx, z - deck.az - t * dz) <= deck.reach;
}

/** Where the row at `z` (world units) crosses the polygon's rings, sorted: inside runs pairwise. */
function rowCrossings(polygon: TerrainSemanticPolygon, z: number, tileSize: number): number[] {
  const v = z / tileSize;
  const out: number[] = [];
  for (const ring of [polygon.outer, ...(polygon.holes ?? [])])
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ua, va] = ring[i] as TerrainSemanticPoint,
        [ub, vb] = ring[j] as TerrainSemanticPoint;
      if (va > v !== vb > v) out.push((ua + ((v - va) / (vb - va)) * (ub - ua)) * tileSize);
    }
  return out.sort((a, b) => a - b);
}

/**
 * The share of `polygon` (tile units) within reach of `decks` (world units), from points on a
 * grid inside it, row by row; undefined when no deck comes near it or no point falls inside it.
 * Rows rather than a containment test per point, and per row only the decks reaching it: a
 * dense Sydney tile took 13 ms point by point.
 */
function deckShare(
  polygon: TerrainSemanticPolygon,
  decks: readonly Deck[],
  tileSize: number,
): number | undefined {
  const [minU, minV, maxU, maxV] = polygonBounds(polygon);
  const minX = minU * tileSize,
    minZ = minV * tileSize,
    maxX = maxU * tileSize,
    maxZ = maxV * tileSize;
  const near = decks.filter(
    (deck) =>
      Math.min(deck.ax, deck.bx) - deck.reach <= maxX &&
      Math.max(deck.ax, deck.bx) + deck.reach >= minX &&
      Math.min(deck.az, deck.bz) - deck.reach <= maxZ &&
      Math.max(deck.az, deck.bz) + deck.reach >= minZ,
  );
  if (!near.length) return undefined;
  const width = maxX - minX,
    depth = maxZ - minZ;
  const step = Math.max(
    Math.sqrt((width * depth) / MAX_SAMPLES),
    Math.min(MAX_STEP_SMALL, Math.min(width, depth) / 4),
  );
  if (!(step > 0)) return undefined;
  let inside = 0,
    along = 0;
  for (let z = minZ + step / 2; z < maxZ; z += step) {
    const row = near.filter(
      (deck) =>
        Math.min(deck.az, deck.bz) - deck.reach <= z &&
        Math.max(deck.az, deck.bz) + deck.reach >= z,
    );
    const crossings = rowCrossings(polygon, z, tileSize);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = crossings[k] as number,
        to = crossings[k + 1] as number;
      // The grid's own columns, so a polygon samples the same points whatever its rings.
      for (let x = minX + step / 2 + Math.ceil((from - minX - step / 2) / step) * step; x < to; ) {
        inside++;
        if (
          row.some(
            (deck) =>
              Math.min(deck.ax, deck.bx) - deck.reach <= x &&
              Math.max(deck.ax, deck.bx) + deck.reach >= x &&
              within(deck, x, z),
          )
        )
          along++;
        x += step;
      }
    }
  }
  return inside > 0 ? along / inside : undefined;
}

/**
 * The share of each paved-land polygon of `tile` within reach of its bridge decks (only those
 * a deck comes near). `tileSize` is the tile's edge in world units. For tests and surveys.
 */
export function terrainBridgeDeckShares(
  tile: TerrainSemanticTile,
  tileSize: number,
  margin: number = TERRAIN_BRIDGE_OUTLINE_MARGIN,
): Map<TerrainSemanticPolygon, number> {
  const shares = new Map<TerrainSemanticPolygon, number>();
  if (!tile.landcover.some(pavedLand)) return shares;
  const decks = decksOf(tile, tileSize, margin);
  if (!decks.length) return shares;
  for (const feature of tile.landcover) {
    if (!pavedLand(feature)) continue;
    for (const polygon of feature.polygons) {
      const share = deckShare(polygon, decks, tileSize);
      if (share !== undefined) shares.set(polygon, share);
    }
  }
  return shares;
}

/**
 * Land cover worked out for a tile's land-cover and road lists at a tile size (undefined: it has
 * no outline). The land-cover layer and the surface layer each load a tile made of the same two
 * lists, and the second asks again.
 */
const settled = new WeakMap<
  readonly TerrainLandcoverFeature[],
  {
    transportation: readonly TerrainTransportationFeature[];
    tileSize: number;
    landcover: TerrainLandcoverFeature[] | undefined;
  }
>();

function landcoverWithoutOutlines(
  tile: TerrainSemanticTile,
  tileSize: number,
): TerrainLandcoverFeature[] | undefined {
  const known = settled.get(tile.landcover);
  if (known?.transportation === tile.transportation && known.tileSize === tileSize)
    return known.landcover;
  const shares = terrainBridgeDeckShares(tile, tileSize);
  const outline = (polygon: TerrainSemanticPolygon): boolean =>
    (shares.get(polygon) ?? 0) >= TERRAIN_BRIDGE_OUTLINE_SHARE;
  const landcover = [...shares.keys()].some(outline)
    ? tile.landcover.flatMap((feature) => {
        // Features can share polygons: a parking lot drawn on the outline's ring stays.
        if (!pavedLand(feature) || !feature.polygons.some(outline)) return [feature];
        const polygons = feature.polygons.filter((polygon) => !outline(polygon));
        return polygons.length ? [{ ...feature, polygons }] : [];
      })
    : undefined;
  settled.set(tile.landcover, { transportation: tile.transportation, tileSize, landcover });
  return landcover;
}

/**
 * The tile without the paved-land polygons that are its bridges' outlines (see above). Returns
 * the tile itself when it has none. The result keeps the tile's packet and content hash, with
 * the edit, so it still crosses to workers and keys caches without being cloned whole.
 */
export function withoutTerrainBridgeOutlines(
  tile: TerrainSemanticTile,
  tileSize: number,
): TerrainSemanticTile {
  const landcover = landcoverWithoutOutlines(tile, tileSize);
  if (landcover === undefined) return tile;
  const derived: TerrainSemanticTile = { ...tile, landcover };
  deriveTerrainSemanticTileContentHash(tile, derived, `bridge-outlines@1:${tileSize}`);
  deriveTerrainSemanticTilePacket(tile, derived);
  return derived;
}
