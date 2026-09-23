import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { isDegenerateRing, polygonBounds, type TerrainSemanticBounds } from './polygon';
import type { TerrainLandcoverFeature, TerrainSemanticPolygon } from './semantic-types';

const TILE: Polygon = [
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
];

function overlaps(a: TerrainSemanticBounds, b: TerrainSemanticBounds): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

/** Resolve the existing last-feature-wins order in X/Z before draping. A bounded height stack
 * becomes nearly coplanar in dense tiles; hidden land-cover faces must not reach the GPU. */
export function visibleLandcoverPolygons(
  features: readonly TerrainLandcoverFeature[],
): TerrainSemanticPolygon[][] {
  const covered: { polygon: Polygon; bounds: TerrainSemanticBounds }[] = [];
  const result: TerrainSemanticPolygon[][] = features.map(() => []);
  for (let index = features.length - 1; index >= 0; index--) {
    const polygons = features[index]?.polygons
      .filter((polygon) => !isDegenerateRing(polygon.outer))
      .map(
        (polygon): Polygon => [
          polygon.outer,
          ...(polygon.holes ?? []).filter((ring) => !isDegenerateRing(ring)),
        ],
      );
    if (!polygons?.length) continue;
    const inside = polygonClipping.intersection(polygons, TILE);
    for (const polygon of inside) {
      const outer = polygon[0];
      if (!outer) continue;
      const bounds = polygonBounds({ outer });
      const cuts = covered.filter((candidate) => overlaps(bounds, candidate.bounds));
      const visible: MultiPolygon = cuts.length
        ? polygonClipping.difference(polygon, ...cuts.map((candidate) => candidate.polygon))
        : [polygon];
      for (const [outer, ...holes] of visible) {
        if (outer) result[index]?.push({ outer, ...(holes.length ? { holes } : {}) });
      }
      covered.push({ polygon, bounds });
    }
  }
  return result;
}
