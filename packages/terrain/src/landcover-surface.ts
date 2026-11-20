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

/**
 * Grids, in steps to a tile edge, a clip that throws is tried again on. The sweep in
 * polygon-clipping gives up on some nearly coincident edges ("Unable to pop() left SweepEvent",
 * "Unable to complete output ring"): land-site layouts and overzoomed tiles put vertices a few
 * ulps off the source grid, and two such tiles south of Bellevue threw on every attempt. Every
 * operation that threw there ran on the first grid, which moves a vertex by under 2 cm on a
 * zoom-10 tile and 1 mm on a zoom-14 one.
 */
const SNAP_GRIDS = [2 ** 20, 2 ** 16, 2 ** 12];

function overlaps(a: TerrainSemanticBounds, b: TerrainSemanticBounds): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

/** `polygon` with every vertex on the grid, without the rings that collapses. */
function snapped(polygon: Polygon, grid: number): Polygon | undefined {
  const rings = polygon.map((ring) =>
    ring.map(([x, z]): [number, number] => [
      Math.round(x * grid) / grid,
      Math.round(z * grid) / grid,
    ]),
  );
  const outer = rings[0];
  if (outer === undefined || isDegenerateRing(outer)) return undefined;
  return [outer, ...rings.slice(1).filter((ring) => !isDegenerateRing(ring))];
}

/**
 * One clip of `subject` by `clips`, tried again on each of SNAP_GRIDS when the exact coordinates
 * make the sweep throw. `undefined` when it throws on all of them.
 */
function clip(
  operation: (subject: Polygon[], ...clips: Polygon[]) => MultiPolygon,
  subject: readonly Polygon[],
  clips: readonly Polygon[],
): MultiPolygon | undefined {
  try {
    return operation([...subject], ...clips);
  } catch {
    for (const grid of SNAP_GRIDS) {
      const onGrid = (polygons: readonly Polygon[]): Polygon[] =>
        polygons.flatMap((polygon) => {
          // Wrapped: a polygon is itself an array, of rings, which flatMap would spread.
          const moved = snapped(polygon, grid);
          return moved === undefined ? [] : [moved];
        });
      const subjectOnGrid = onGrid(subject);
      if (subjectOnGrid.length === 0) return [];
      try {
        return operation(subjectOnGrid, ...onGrid(clips));
      } catch {
        // The next, coarser grid.
      }
    }
    return undefined;
  }
}

/** Clip an area to the tile, including when the cut separates it into several pieces. */
export function clipTerrainPolygonToTile(
  polygon: TerrainSemanticPolygon,
): TerrainSemanticPolygon[] {
  if (isDegenerateRing(polygon.outer)) return [];
  const rings = [polygon.outer, ...(polygon.holes ?? []).filter((ring) => !isDegenerateRing(ring))];
  const inside = clip(polygonClipping.intersection, [rings], [TILE]) ?? [];
  return inside.flatMap(([outer, ...holes]) =>
    outer ? [{ outer, ...(holes.length ? { holes } : {}) }] : [],
  );
}

/** Join adjacent areas before creating shoreline geometry. On clipping failure, keep the input areas. */
export function unionTerrainPolygons(
  polygons: readonly TerrainSemanticPolygon[],
): TerrainSemanticPolygon[] {
  const rings = polygons.map(({ outer, holes }): Polygon => [outer, ...(holes ?? [])]);
  const merged = clip(polygonClipping.union, rings, []);
  return merged
    ? merged.flatMap(([outer, ...holes]) => (outer ? [{ outer, holes }] : []))
    : [...polygons];
}

/** Remove a local area from a polygon, keeping the original if clipping fails. */
export function subtractTerrainPolygon(
  polygon: TerrainSemanticPolygon,
  mask: TerrainSemanticPolygon,
): TerrainSemanticPolygon[] {
  if (!overlaps(polygonBounds(polygon), polygonBounds(mask))) return [polygon];
  const result = clip(
    polygonClipping.difference,
    [[polygon.outer, ...(polygon.holes ?? [])]],
    [[mask.outer, ...(mask.holes ?? [])]],
  );
  return result
    ? result.flatMap(([outer, ...holes]) => (outer ? [{ outer, holes }] : []))
    : [polygon];
}

/** Split an area at a local boundary. If either clip fails, keep the input area intact. */
export function partitionTerrainPolygon(
  polygon: TerrainSemanticPolygon,
  mask: TerrainSemanticPolygon,
): { inside: TerrainSemanticPolygon[]; outside: TerrainSemanticPolygon[] } {
  const uncut = { inside: [], outside: [polygon] };
  if (!overlaps(polygonBounds(polygon), polygonBounds(mask))) return uncut;
  const subject = [[polygon.outer, ...(polygon.holes ?? [])]];
  const boundary = [[mask.outer, ...(mask.holes ?? [])]];
  const inside = clip(polygonClipping.intersection, subject, boundary);
  if (!inside?.length) return uncut;
  const outside = clip(polygonClipping.difference, subject, boundary);
  if (!outside) return uncut;
  const areas = (result: MultiPolygon): TerrainSemanticPolygon[] =>
    result.flatMap(([outer, ...holes]) => (outer ? [{ outer, holes }] : []));
  return { inside: areas(inside), outside: areas(outside) };
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
    // A feature that cannot be cut to the tile on any grid is left out: drawn whole it would
    // lie over the neighboring tiles' land cover.
    const inside = clip(polygonClipping.intersection, polygons, [TILE]) ?? [];
    for (const polygon of inside) {
      const outer = polygon[0];
      if (!outer) continue;
      const bounds = polygonBounds({ outer });
      const cuts = covered.filter((candidate) => overlaps(bounds, candidate.bounds));
      // A polygon that cannot be cut on any grid is drawn whole, under what covers it: faces
      // that fight for depth there, rather than a tile with no land cover at all.
      const visible: MultiPolygon = cuts.length
        ? (clip(
            polygonClipping.difference,
            [polygon],
            cuts.map((candidate) => candidate.polygon),
          ) ?? [polygon])
        : [polygon];
      for (const [outer, ...holes] of visible) {
        if (outer) result[index]?.push({ outer, ...(holes.length ? { holes } : {}) });
      }
      covered.push({ polygon, bounds });
    }
  }
  return result;
}
