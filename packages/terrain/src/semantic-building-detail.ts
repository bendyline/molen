/**
 * Building detail: take a semantic tile's buildings and places from a finer vector level.
 *
 * Basemaps generalize buildings below their last zoom. Protomaps keeps almost none below zoom 15,
 * so a terrain tile that reads zoom 13 or 14 shows streets and trees but no houses. A host can ship
 * that last zoom separately, only where people look, as a building-detail sidecar. A feature tile
 * up to `maxDepth` levels coarser than the detail level then takes its buildings and places from
 * its descendants at that level; roads, water and land use stay as the tile had them.
 *
 * The composed tile keeps the contract of a real tile at the coarser level, drawn at the detail
 * level's precision. Every footprint appears once: whole, or, when it runs past the descendants'
 * clip buffers, as the union of its clipped copies, which ends exactly where a real tile at the
 * coarser level with a proportionally narrower buffer would end it. `buildingSourceLevel` on the
 * result names the level the footprints came from, so a renderer applying tile-edge ownership can
 * narrow its buffer by the same factor and neighbouring tiles still reach the same verdict.
 * Footprints without a source id cannot be matched across copies; each belongs to the descendant
 * holding its center. Descendants the sidecar lacks keep the coarse tile's own buildings in their
 * part of the tile, so coverage fades from detailed to generalized instead of leaving holes.
 */

import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { polygonBounds } from './polygon';
import type { TerrainPyramidTileAddress } from './pyramid-types';
import { overzoomTerrainSemanticTile, type TerrainSemanticTileLoader } from './semantic-overzoom';
import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
  type TerrainPoiFeature,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticRing,
  type TerrainSemanticTile,
} from './semantic-types';

export interface TerrainBuildingDetailOptions {
  /** The level the detail sidecar serves (e.g. 15 for Protomaps). */
  level: number;
  /**
   * How many levels coarser than `level` a tile may be and still be composed from it (default 2:
   * a tile two levels up reads 16 detail tiles). Coarser tiles keep their own buildings.
   */
  maxDepth?: number;
  /** Recently loaded detail tiles kept for overlapping requests (default 48). */
  cacheSize?: number;
}

/** One descendant at the detail level and its tile, or undefined where the sidecar has none. */
export interface TerrainBuildingDetailChild {
  x: number;
  z: number;
  tile: TerrainSemanticTile | undefined;
}

type Transform = (point: TerrainSemanticPoint) => TerrainSemanticPoint;

function transformRing(ring: TerrainSemanticRing, map: Transform): TerrainSemanticRing {
  return ring.map(map);
}

function transformPolygon(polygon: TerrainSemanticPolygon, map: Transform): TerrainSemanticPolygon {
  return polygon.holes !== undefined
    ? {
        outer: transformRing(polygon.outer, map),
        holes: polygon.holes.map((h) => transformRing(h, map)),
      }
    : { outer: transformRing(polygon.outer, map) };
}

function center(polygon: TerrainSemanticPolygon): TerrainSemanticPoint {
  const [minU, minV, maxU, maxV] = polygonBounds(polygon);
  return [(minU + maxU) / 2, (minV + maxV) / 2];
}

function inUnitSquare(point: TerrainSemanticPoint): boolean {
  return point[0] >= 0 && point[0] < 1 && point[1] >= 0 && point[1] < 1;
}

function sameRing(a: TerrainSemanticRing, b: TerrainSemanticRing): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) {
    const p = a[index] as TerrainSemanticPoint;
    const q = b[index] as TerrainSemanticPoint;
    if (p[0] !== q[0] || p[1] !== q[1]) return false;
  }
  return true;
}

function samePolygons(
  a: readonly TerrainSemanticPolygon[],
  b: readonly TerrainSemanticPolygon[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((polygon, index) => {
    const other = b[index] as TerrainSemanticPolygon;
    const holes = polygon.holes ?? [];
    const otherHoles = other.holes ?? [];
    return (
      sameRing(polygon.outer, other.outer) &&
      holes.length === otherHoles.length &&
      holes.every((hole, hi) => sameRing(hole, otherHoles[hi] as TerrainSemanticRing))
    );
  });
}

function toClipping(polygons: readonly TerrainSemanticPolygon[]): MultiPolygon {
  return polygons.map(
    (polygon): Polygon => [
      polygon.outer.map((p): [number, number] => [p[0], p[1]]),
      ...(polygon.holes ?? []).map((hole) => hole.map((p): [number, number] => [p[0], p[1]])),
    ],
  );
}

function openRing(ring: ReadonlyArray<readonly [number, number]>): TerrainSemanticRing {
  const points = ring.map((p): TerrainSemanticPoint => [p[0], p[1]]);
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first && last && first[0] === last[0] && first[1] === last[1])
    points.pop();
  return points;
}

/** The union of one footprint's clipped copies; the first copy alone if the union fails. */
function unionCopies(copies: readonly TerrainSemanticPolygon[][]): TerrainSemanticPolygon[] {
  const first = copies[0] as TerrainSemanticPolygon[];
  if (copies.every((copy) => samePolygons(copy, first))) return first;
  try {
    const [head, ...rest] = copies.map(toClipping);
    const merged = polygonClipping.union(head as MultiPolygon, ...rest);
    const polygons = merged
      .map((polygon): TerrainSemanticPolygon => {
        const [outer, ...holes] = polygon.map(openRing);
        return holes.length > 0
          ? { outer: outer as TerrainSemanticRing, holes }
          : { outer: outer as TerrainSemanticRing };
      })
      .filter((polygon) => polygon.outer.length >= 3);
    return polygons.length > 0 ? polygons : first;
  } catch {
    // A malformed copy must not lose the building.
    return first;
  }
}

/**
 * Compose `base`'s buildings and places from its descendants at `detailLevel`. `children` lists
 * every descendant of `address` at that level (missing tiles as `tile: undefined`). With no
 * descendant present, `base` is returned unchanged.
 */
export function composeTerrainBuildingDetail(
  base: TerrainSemanticTile | undefined,
  address: TerrainPyramidTileAddress,
  detailLevel: number,
  children: readonly TerrainBuildingDetailChild[],
): TerrainSemanticTile | undefined {
  const depth = detailLevel - address.level;
  if (!Number.isSafeInteger(depth) || depth < 1) {
    throw new Error('building detail composes tiles coarser than the detail level');
  }
  const scale = 2 ** depth;
  const present = children.filter((child) => child.tile !== undefined);
  if (present.length === 0) return base;
  const covered = new Set<number>();
  for (const child of present) {
    const ox = child.x - address.x * scale;
    const oz = child.z - address.z * scale;
    if (ox < 0 || oz < 0 || ox >= scale || oz >= scale) {
      throw new Error('building detail child is not a descendant of the composed tile');
    }
    covered.add(oz * scale + ox);
  }
  // A coarse footprint or place stays where no detail tile covers its center.
  const uncovered = (point: TerrainSemanticPoint): boolean => {
    const ox = Math.min(scale - 1, Math.max(0, Math.floor(point[0] * scale)));
    const oz = Math.min(scale - 1, Math.max(0, Math.floor(point[1] * scale)));
    return !covered.has(oz * scale + ox);
  };

  const matched = new Map<
    string,
    { feature: TerrainBuildingFeature; copies: TerrainSemanticPolygon[][] }
  >();
  const buildings: TerrainBuildingFeature[] = [];
  const pois: TerrainPoiFeature[] = [];
  for (const child of present) {
    const tile = child.tile as TerrainSemanticTile;
    const ox = child.x - address.x * scale;
    const oz = child.z - address.z * scale;
    const toParent: Transform = (p) => [(p[0] + ox) / scale, (p[1] + oz) / scale];
    for (const feature of tile.buildings) {
      const first = feature.polygons[0];
      if (first === undefined) continue;
      const polygons = feature.polygons.map((polygon) => transformPolygon(polygon, toParent));
      if (feature.id === undefined) {
        if (inUnitSquare(center(first))) buildings.push({ ...feature, polygons });
        continue;
      }
      const key = `${feature.class ?? ''}|${feature.id}`;
      const entry = matched.get(key);
      if (entry === undefined) matched.set(key, { feature, copies: [polygons] });
      else entry.copies.push(polygons);
    }
    for (const poi of tile.pois ?? []) {
      if (inUnitSquare(poi.point)) pois.push({ ...poi, point: toParent(poi.point) });
    }
  }
  for (const { feature, copies } of matched.values()) {
    buildings.push({ ...feature, polygons: unionCopies(copies) });
  }

  const tile = base ?? createEmptyTerrainSemanticTile();
  for (const feature of tile.buildings) {
    const first = feature.polygons[0];
    if (first !== undefined && uncovered(center(first))) buildings.push(feature);
  }
  for (const poi of tile.pois ?? []) {
    if (uncovered(poi.point)) pois.push(poi);
  }
  const complete = present.length === scale * scale;
  return {
    ...tile,
    buildings,
    ...(pois.length > 0 || tile.pois !== undefined ? { pois } : {}),
    buildingsGeneralized: complete ? false : tile.buildingsGeneralized === true,
    buildingSourceLevel: detailLevel,
  };
}

/** Replace a tile's buildings and places with those of a detail tile covering it (an ancestor or itself). */
function withDetailFrom(
  base: TerrainSemanticTile | undefined,
  detail: TerrainSemanticTile,
  from: TerrainPyramidTileAddress,
  to: TerrainPyramidTileAddress,
): TerrainSemanticTile {
  const rescaled = overzoomTerrainSemanticTile(detail, from, to);
  const tile = base ?? createEmptyTerrainSemanticTile();
  const { buildingSourceLevel: _level, ...rest } = tile;
  return {
    ...rest,
    buildings: rescaled.buildings,
    ...(rescaled.pois !== undefined ? { pois: rescaled.pois } : {}),
    buildingsGeneralized: false,
  };
}

/**
 * Wrap a feature source so tiles within `maxDepth` levels of the detail level take their buildings
 * and places from `detail` (see the module comment). Tiles at or finer than the detail level take
 * them from the covering detail tile; coarser tiles, and tiles the sidecar does not cover, are
 * served by `base` unchanged.
 */
export function createBuildingDetailTerrainSemanticSource(
  base: TerrainSemanticTileLoader,
  detail: TerrainSemanticTileLoader,
  options: TerrainBuildingDetailOptions,
): TerrainSemanticTileLoader {
  const level = options.level;
  const maxDepth = options.maxDepth ?? 2;
  const cacheSize = options.cacheSize ?? 48;
  if (!Number.isSafeInteger(level) || level < 0)
    throw new RangeError('detail level must be a whole level');
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0)
    throw new RangeError('maxDepth must be a whole number of levels');
  // A detail tile serves every tile it lies under, so no single caller's signal may cancel it.
  const shared = new AbortController().signal;
  const cache = new Map<string, Promise<TerrainSemanticTile | undefined>>();
  const detailTile = (x: number, z: number): Promise<TerrainSemanticTile | undefined> => {
    const key = `${x}/${z}`;
    let request = cache.get(key);
    if (request !== undefined) {
      cache.delete(key);
      cache.set(key, request);
      return request;
    }
    request = detail.load({ level, x, z }, shared).catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, request);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value as string);
    return request;
  };
  return {
    async load(address, signal) {
      const depth = level - address.level;
      if (depth > maxDepth) return base.load(address, signal);
      if (depth <= 0) {
        const scale = 2 ** -depth;
        const from = { level, x: Math.floor(address.x / scale), z: Math.floor(address.z / scale) };
        const [tile, covering] = await Promise.all([
          base.load(address, signal),
          detailTile(from.x, from.z),
        ]);
        if (signal.aborted) return undefined;
        return covering !== undefined ? withDetailFrom(tile, covering, from, address) : tile;
      }
      const scale = 2 ** depth;
      const requests: Array<Promise<TerrainBuildingDetailChild>> = [];
      for (let dz = 0; dz < scale; dz++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = address.x * scale + dx;
          const z = address.z * scale + dz;
          requests.push(detailTile(x, z).then((tile) => ({ x, z, tile })));
        }
      }
      const [tile, children] = await Promise.all([
        base.load(address, signal),
        Promise.all(requests),
      ]);
      if (signal.aborted) return undefined;
      return composeTerrainBuildingDetail(tile, address, level, children);
    },
  };
}
