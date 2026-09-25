/**
 * Semantic overzoom: serve a terrain tile finer than its semantic sidecar from the nearest
 * ancestor semantic tile, rescaled and clipped to the finer tile.
 *
 * Vector sidecars commonly stop short of the terrain's finest level (Protomaps planet builds end
 * at zoom 15, many hosts' archives at 13 or 14), while the terrain keeps refining near the
 * camera. Without overzoom the finest terrain tiles carry no water, roads or buildings. Semantic
 * geometry is normalized tile-local `[u, v]`, so an ancestor `d` levels up maps onto a descendant
 * by `u' = u·2^d − ox`, `v' = v·2^d − oy`. Lines and areas are then clipped to the descendant
 * (plus a small buffer, as decoders keep); buildings and points are kept by the descendant that
 * holds their anchor, so each appears exactly once.
 */

import { polygonBounds } from './polygon';
import type { TerrainPyramidTileAddress } from './pyramid-types';
import type {
  TerrainSemanticLine,
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
  TerrainSemanticRing,
  TerrainSemanticTile,
} from './semantic-types';

export interface TerrainSemanticOverzoomOptions {
  /** Clip margin around the descendant in tile units (default 1/64, about one road width). */
  buffer?: number;
}

type Box = [minU: number, minV: number, maxU: number, maxV: number];

function transformPoint(point: TerrainSemanticPoint, scale: number, ox: number, oy: number) {
  return [point[0] * scale - ox, point[1] * scale - oy] as TerrainSemanticPoint;
}

/** Liang–Barsky clip of every segment; consecutive kept segments join into one line. */
function clipLine(line: TerrainSemanticLine, box: Box): TerrainSemanticLine[] {
  const out: TerrainSemanticLine[] = [];
  let current: TerrainSemanticLine | undefined;
  for (let index = 0; index + 1 < line.length; index++) {
    const [ax, ay] = line[index] as TerrainSemanticPoint;
    const [bx, by] = line[index + 1] as TerrainSemanticPoint;
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;
    let inside = true;
    for (const [p, q] of [
      [-dx, ax - box[0]],
      [dx, box[2] - ax],
      [-dy, ay - box[1]],
      [dy, box[3] - ay],
    ] as const) {
      if (p === 0) {
        if (q < 0) inside = false;
      } else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (!inside || t0 > t1) {
      current = undefined;
      continue;
    }
    const start: TerrainSemanticPoint = [ax + dx * t0, ay + dy * t0];
    const end: TerrainSemanticPoint = [ax + dx * t1, ay + dy * t1];
    if (current === undefined || t0 > 0) {
      current = [start];
      out.push(current);
    }
    current.push(end);
    if (t1 < 1) current = undefined;
  }
  return out.filter((piece) => piece.length >= 2);
}

/** Sutherland–Hodgman clip of a ring against an axis-aligned box. */
function clipRing(ring: TerrainSemanticRing, box: Box): TerrainSemanticRing {
  let points = ring;
  const edges: Array<[axis: 0 | 1, limit: number, keepAbove: boolean]> = [
    [0, box[0], true],
    [0, box[2], false],
    [1, box[1], true],
    [1, box[3], false],
  ];
  for (const [axis, limit, keepAbove] of edges) {
    if (points.length === 0) break;
    const inside = (point: TerrainSemanticPoint) =>
      keepAbove ? point[axis] >= limit : point[axis] <= limit;
    const next: TerrainSemanticRing = [];
    for (let index = 0; index < points.length; index++) {
      const a = points[index] as TerrainSemanticPoint;
      const b = points[(index + 1) % points.length] as TerrainSemanticPoint;
      const aIn = inside(a);
      const bIn = inside(b);
      if (aIn) next.push(a);
      if (aIn !== bIn) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    points = next;
  }
  return points;
}

function ringArea(ring: TerrainSemanticRing): number {
  let area = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as TerrainSemanticPoint;
    const b = ring[(index + 1) % ring.length] as TerrainSemanticPoint;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

const MIN_AREA = 1e-9;

function clipPolygon(
  polygon: TerrainSemanticPolygon,
  box: Box,
): TerrainSemanticPolygon | undefined {
  const outer = clipRing(polygon.outer, box);
  if (outer.length < 3 || ringArea(outer) < MIN_AREA) return undefined;
  const holes = (polygon.holes ?? [])
    .map((hole) => clipRing(hole, box))
    .filter((hole) => hole.length >= 3 && ringArea(hole) >= MIN_AREA);
  return holes.length > 0 ? { outer, holes } : { outer };
}

function transformPolygon(
  polygon: TerrainSemanticPolygon,
  scale: number,
  ox: number,
  oy: number,
): TerrainSemanticPolygon {
  const map = (ring: TerrainSemanticRing) => ring.map((p) => transformPoint(p, scale, ox, oy));
  return polygon.holes !== undefined
    ? { outer: map(polygon.outer), holes: polygon.holes.map(map) }
    : { outer: map(polygon.outer) };
}

function holds(point: TerrainSemanticPoint): boolean {
  return point[0] >= 0 && point[0] < 1 && point[1] >= 0 && point[1] < 1;
}

/**
 * Re-express an ancestor's semantic tile for one of its descendants. `from` must be an ancestor of
 * (or equal to) `to`.
 */
export function overzoomTerrainSemanticTile(
  tile: TerrainSemanticTile,
  from: TerrainPyramidTileAddress,
  to: TerrainPyramidTileAddress,
  options: TerrainSemanticOverzoomOptions = {},
): TerrainSemanticTile {
  const depth = to.level - from.level;
  if (!Number.isSafeInteger(depth) || depth < 0) {
    throw new Error('semantic overzoom needs an ancestor tile at or above the requested level');
  }
  const scale = 2 ** depth;
  const ox = to.x - from.x * scale;
  const oy = to.z - from.z * scale;
  if (ox < 0 || oy < 0 || ox >= scale || oy >= scale) {
    throw new Error('semantic overzoom source is not an ancestor of the requested tile');
  }
  if (depth === 0) return tile;
  const buffer = options.buffer ?? 1 / 64;
  const box: Box = [-buffer, -buffer, 1 + buffer, 1 + buffer];
  const areas = (polygons: readonly TerrainSemanticPolygon[]) =>
    polygons
      .map((polygon) => clipPolygon(transformPolygon(polygon, scale, ox, oy), box))
      .filter((polygon): polygon is TerrainSemanticPolygon => polygon !== undefined);
  const lines = (list: readonly TerrainSemanticLine[]) =>
    list.flatMap((line) =>
      clipLine(
        line.map((point) => transformPoint(point, scale, ox, oy)),
        box,
      ),
    );

  const landcover = tile.landcover.flatMap((feature) => {
    const polygons = areas(feature.polygons);
    return polygons.length > 0 ? [{ ...feature, polygons }] : [];
  });
  const water = tile.water.flatMap((feature) => {
    const polygons = feature.polygons !== undefined ? areas(feature.polygons) : undefined;
    const waterLines = feature.lines !== undefined ? lines(feature.lines) : undefined;
    if ((polygons?.length ?? 0) === 0 && (waterLines?.length ?? 0) === 0) return [];
    const { polygons: _polygons, lines: _lines, ...rest } = feature;
    return [
      {
        ...rest,
        ...(polygons !== undefined && polygons.length > 0 ? { polygons } : {}),
        ...(waterLines !== undefined && waterLines.length > 0 ? { lines: waterLines } : {}),
      },
    ];
  });
  const transportation = tile.transportation.flatMap((feature) => {
    const clipped = lines(feature.lines);
    return clipped.length > 0 ? [{ ...feature, lines: clipped }] : [];
  });
  // A building belongs to the one descendant holding its footprint's center: never cut, never
  // drawn twice.
  const buildings = tile.buildings.flatMap((feature) => {
    const polygons = feature.polygons.map((polygon) => transformPolygon(polygon, scale, ox, oy));
    const first = polygons[0];
    if (first === undefined) return [];
    const [minU, minV, maxU, maxV] = polygonBounds(first);
    return holds([(minU + maxU) / 2, (minV + maxV) / 2]) ? [{ ...feature, polygons }] : [];
  });
  const pois = tile.pois?.flatMap((feature) => {
    const point = transformPoint(feature.point, scale, ox, oy);
    return holds(point) ? [{ ...feature, point }] : [];
  });
  return {
    format: tile.format,
    landcover,
    water,
    transportation,
    buildings,
    ...(pois !== undefined ? { pois } : {}),
    ...(tile.buildingsGeneralized !== undefined
      ? { buildingsGeneralized: tile.buildingsGeneralized }
      : {}),
  };
}

/** Anything that loads semantic tiles by pyramid address. */
export interface TerrainSemanticTileLoader {
  load(
    address: TerrainPyramidTileAddress,
    signal: AbortSignal,
  ): Promise<TerrainSemanticTile | undefined>;
}

/**
 * Wrap a semantic source so levels above `maxLevel` load their `maxLevel` ancestor and overzoom
 * it. Recently decoded ancestors are kept (`cacheSize`, default 32), since a camera refining one
 * ancestor asks for its descendants within moments of each other.
 */
export function createOverzoomTerrainSemanticSource(
  source: TerrainSemanticTileLoader,
  maxLevel: number,
  options: TerrainSemanticOverzoomOptions & { cacheSize?: number } = {},
): TerrainSemanticTileLoader {
  const cacheSize = options.cacheSize ?? 32;
  // Ancestors are shared by several descendants, so no single caller's signal may cancel them.
  const shared = new AbortController().signal;
  const cache = new Map<string, Promise<TerrainSemanticTile | undefined>>();
  const ancestorTile = (address: TerrainPyramidTileAddress) => {
    const key = `${address.level}/${address.x}/${address.z}`;
    let request = cache.get(key);
    if (request !== undefined) {
      cache.delete(key);
      cache.set(key, request);
      return request;
    }
    request = source.load(address, shared).catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, request);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value as string);
    return request;
  };
  return {
    async load(address, signal) {
      if (address.level <= maxLevel) return source.load(address, signal);
      const scale = 2 ** (address.level - maxLevel);
      const ancestor = {
        level: maxLevel,
        x: Math.floor(address.x / scale),
        z: Math.floor(address.z / scale),
      };
      const tile = await ancestorTile(ancestor);
      if (tile === undefined || signal.aborted) return undefined;
      return overzoomTerrainSemanticTile(tile, ancestor, address, options);
    },
  };
}
