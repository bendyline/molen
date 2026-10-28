/** Polygons as transferable arrays, for worker messages. */

import type { TerrainSemanticPoint, TerrainSemanticPolygon } from '@bendyline/molen-terrain/kernel';

/**
 * Polygons as transferable arrays: every ring's points (u, v pairs), each ring's point count, and
 * each polygon's ring count (0 for an outer ring with no hole list, else one more than its holes).
 */
export interface PackedPolygons {
  points: Float64Array;
  rings: Uint32Array;
  polygons: Uint32Array;
}

/**
 * Pack polygons for a worker message. Infill exclusions are every footprint of a tile, and as
 * objects their structured clone held the main thread up to 18 ms a request.
 */
export function packPolygons(polygons: readonly TerrainSemanticPolygon[]): PackedPolygons {
  let points = 0;
  let rings = 0;
  for (const polygon of polygons) {
    rings += 1 + (polygon.holes?.length ?? 0);
    points += polygon.outer.length;
    for (const hole of polygon.holes ?? []) points += hole.length;
  }
  const packed: PackedPolygons = {
    points: new Float64Array(points * 2),
    rings: new Uint32Array(rings),
    polygons: new Uint32Array(polygons.length),
  };
  let at = 0;
  let ring = 0;
  const write = (points: readonly TerrainSemanticPoint[]): void => {
    packed.rings[ring++] = points.length;
    for (const point of points) {
      packed.points[at++] = point[0];
      packed.points[at++] = point[1];
    }
  };
  for (const [index, polygon] of polygons.entries()) {
    packed.polygons[index] = polygon.holes === undefined ? 0 : 1 + polygon.holes.length;
    write(polygon.outer);
    for (const hole of polygon.holes ?? []) write(hole);
  }
  return packed;
}

/** The polygons packPolygons packed. */
export function unpackPolygons(packed: PackedPolygons): TerrainSemanticPolygon[] {
  let at = 0;
  let ring = 0;
  const read = (): TerrainSemanticPoint[] => {
    const points: TerrainSemanticPoint[] = [];
    const count = packed.rings[ring++] as number;
    for (let i = 0; i < count; i++, at += 2)
      points.push([packed.points[at] as number, packed.points[at + 1] as number]);
    return points;
  };
  return Array.from(packed.polygons, (rings) => {
    const outer = read();
    if (rings === 0) return { outer };
    const holes: TerrainSemanticPoint[][] = [];
    for (let i = 1; i < rings; i++) holes.push(read());
    return { outer, holes };
  });
}
