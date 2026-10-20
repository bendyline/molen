/** Explicit site masks preserve the remainder of merged map buildings around a landmark. */
import {
  polygonArea,
  polygonBounds,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import type { StructurePlacement } from '../kernel/structure-index';

type Point = [number, number];
type Context = { origin: readonly [number, number]; tileSize: number };

/** Same scale/yaw/translation as the model, in absolute world coordinates. */
export function structureBuildingCutout(
  entry: StructurePlacement,
  metersPerUnit: number,
): Point[] | undefined {
  if (!entry.buildingCutout) return undefined;
  const [x, z] = wgs84ToWorld(metersPerUnit, ...entry.anchor);
  const c = Math.cos(entry.heading ?? 0),
    s = Math.sin(entry.heading ?? 0);
  const [sx, , sz] = entry.scale ?? [1, 1, 1];
  return entry.buildingCutout.outline.map(([px, pz]) => [
    x + px * sx * c + pz * sz * s,
    z - px * sx * s + pz * sz * c,
  ]);
}

function semantic(polygon: Polygon): TerrainSemanticPolygon {
  return {
    outer: (polygon[0] ?? []).slice(0, -1),
    holes: polygon.slice(1).map((r) => r.slice(0, -1)),
  };
}

/** Independent occupied masks preserve mapped buildings in the gaps between precincts. */
export function structureBuildingCutouts(
  entry: StructurePlacement,
  metersPerUnit: number,
): Point[][] {
  const cutout = entry.buildingCutout;
  if (!cutout) return [];
  return (cutout.outlines ?? [cutout.outline]).map(
    (outline) =>
      structureBuildingCutout(
        { ...entry, buildingCutout: { outline, basis: cutout.basis } },
        metersPerUnit,
      ) as Point[],
  );
}

/** Input tiles remain intact, allowing eviction to restore their original buildings. */
export function withoutBuildingCutouts(
  tile: TerrainSemanticTile,
  context: Context,
  worldOutlines: readonly (readonly Point[])[],
): TerrainSemanticTile {
  if (!worldOutlines.length) return tile;
  const masks = worldOutlines.map((outline) => {
    const outer = outline.map(
      ([x, z]): Point => [
        (x - context.origin[0]) / context.tileSize,
        (z - context.origin[1]) / context.tileSize,
      ],
    );
    return { polygon: [outer] as Polygon, bounds: polygonBounds({ outer }) };
  });
  let changed = false;
  const buildings = tile.buildings.flatMap((feature) => {
    let featureChanged = false;
    const polygons = feature.polygons.flatMap((polygon) => {
      const bounds = polygonBounds(polygon);
      const near = masks.filter(
        (m) =>
          m.bounds[0] < bounds[2] &&
          m.bounds[2] > bounds[0] &&
          m.bounds[1] < bounds[3] &&
          m.bounds[3] > bounds[1],
      );
      if (!near.length) return [polygon];
      try {
        const remaining: MultiPolygon = polygonClipping.difference(
          [polygon.outer, ...(polygon.holes ?? [])],
          ...near.map((m) => m.polygon),
        );
        const result = remaining.map(semantic);
        const area = result.reduce((sum, p) => sum + polygonArea(p), 0);
        if (Math.abs(area - polygonArea(polygon)) <= 1e-12) return [polygon];
        featureChanged = true;
        return result;
      } catch {
        // Preserve malformed source data rather than erasing an unrelated map feature.
        return [polygon];
      }
    });
    if (!featureChanged) return [feature];
    changed = true;
    return polygons.length ? [{ ...feature, polygons }] : [];
  });
  return changed ? { ...tile, buildings } : tile;
}
