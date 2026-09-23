/** Ear-clipping triangulation (earcut) with a winding-independent, hole-aware contract. */

import earcut from 'earcut';
import { isSimpleRing, ringArea } from './geometry2d';
import type { Vec2 } from './types';

export interface Triangulation {
  /** Outer ring vertices followed by every hole's vertices, in input order. */
  vertices: Vec2[];
  /** Triangle vertex indices into `vertices`. */
  indices: number[];
}

/**
 * Triangulate a polygon with holes. Returns undefined when the triangulated area misses the
 * expected area (outer minus holes) by more than 10% in EITHER direction: too little means
 * self-intersecting or otherwise malformed input, and too much means a hole that is not inside
 * the outer ring — earcut happily emits the stray triangles, so covering more than the polygon
 * is just as wrong as covering less.
 */
export function triangulatePolygon(
  outer: readonly Vec2[],
  holes: readonly (readonly Vec2[])[] = [],
): Triangulation | undefined {
  if (outer.length < 3 || !isSimpleRing(outer)) return undefined;
  if (holes.some((hole) => hole.length >= 3 && !isSimpleRing(hole))) return undefined;
  const flat: number[] = [];
  const vertices: Vec2[] = [];
  const holeIndices: number[] = [];
  for (const point of outer) {
    flat.push(point[0], point[1]);
    vertices.push([point[0], point[1]]);
  }
  for (const hole of holes) {
    if (hole.length < 3) continue;
    holeIndices.push(vertices.length);
    for (const point of hole) {
      flat.push(point[0], point[1]);
      vertices.push([point[0], point[1]]);
    }
  }
  const indices = earcut(flat, holeIndices.length > 0 ? holeIndices : null, 2);
  if (indices.length < 3) return undefined;
  let covered = 0;
  for (let index = 0; index + 2 < indices.length; index += 3) {
    const a = vertices[indices[index] as number] as Vec2;
    const b = vertices[indices[index + 1] as number] as Vec2;
    const c = vertices[indices[index + 2] as number] as Vec2;
    covered += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  }
  let expected = ringArea(outer);
  for (const hole of holes) expected -= ringArea(hole);
  if (expected <= 0 || Math.abs(covered - expected) > 0.1 * expected) return undefined;
  return { vertices, indices: Array.from(indices) };
}
