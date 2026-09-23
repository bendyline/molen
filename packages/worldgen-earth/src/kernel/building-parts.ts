/** Spatially reconcile stock Protomaps outlines and parts, which lack parent relation IDs. */
import {
  polygonArea,
  polygonBounds,
  type TerrainBuildingFeature,
  type TerrainSemanticPolygon,
} from '@bendyline/molen-terrain/kernel';
import polygonClipping, { type Polygon } from 'polygon-clipping';
import { buildingLabels } from './labels';

export interface BuildingPiece {
  feature: TerrainBuildingFeature;
  polygon: TerrainSemanticPolygon;
  polygonIndex: number;
  remainder?: number;
  groundPolygon?: TerrainSemanticPolygon;
  labels: string[];
}

function coordinates(polygon: TerrainSemanticPolygon): Polygon {
  return [polygon.outer, ...(polygon.holes ?? [])];
}

function semantic(polygon: Polygon): TerrainSemanticPolygon {
  return {
    outer: (polygon[0] ?? []).slice(0, -1),
    holes: polygon.slice(1).map((ring) => ring.slice(0, -1)),
  };
}

function isPart(piece: BuildingPiece): boolean {
  return piece.feature.class === 'building_part';
}

export function buildingPieces(features: readonly TerrainBuildingFeature[]): BuildingPiece[] {
  const pieces = features.flatMap((feature) =>
    feature.polygons.map(
      (polygon, polygonIndex): BuildingPiece => ({
        feature,
        polygon,
        polygonIndex,
        labels: buildingLabels(feature),
      }),
    ),
  );
  const parts = pieces.filter(isPart);
  if (parts.length === 0) return pieces;
  const outlines = pieces.filter((piece) => !isPart(piece));
  const children = new Map<BuildingPiece, BuildingPiece[]>();
  for (const part of parts) {
    const partBounds = polygonBounds(part.polygon);
    let parent: BuildingPiece | undefined;
    let parentArea = Number.POSITIVE_INFINITY;
    const partArea = polygonArea(part.polygon);
    for (const outline of outlines) {
      const area = polygonArea(outline.polygon);
      if (area < partArea * 0.999 || area >= parentArea) continue;
      const bounds = polygonBounds(outline.polygon);
      if (
        partBounds[2] < bounds[0] ||
        partBounds[0] > bounds[2] ||
        partBounds[3] < bounds[1] ||
        partBounds[1] > bounds[3]
      )
        continue;
      // Intersection confirms containment, including coincident boundaries and courtyards.
      try {
        const overlap = polygonClipping.intersection(
          coordinates(part.polygon),
          coordinates(outline.polygon),
        );
        const overlapArea = overlap.reduce(
          (sum, polygon) => sum + polygonArea(semantic(polygon)),
          0,
        );
        if (overlapArea < partArea * 0.999) continue;
      } catch {
        // A malformed polygon must not discard the source outline.
        continue;
      }
      parent = outline;
      parentArea = area;
    }
    if (parent === undefined) continue;
    part.groundPolygon = parent.polygon;
    if (part.labels.length === 1 && part.labels[0] === 'building') part.labels = parent.labels;
    const group = children.get(parent) ?? [];
    group.push(part);
    children.set(parent, group);
  }
  return pieces.flatMap((piece): BuildingPiece[] => {
    const group = children.get(piece);
    if (group === undefined) return [piece];
    try {
      const remaining = polygonClipping.difference(
        coordinates(piece.polygon),
        ...group.map((part) => coordinates(part.polygon)),
      );
      return remaining.map((polygon, remainder) => ({
        ...piece,
        polygon: semantic(polygon),
        remainder,
        groundPolygon: piece.polygon,
      }));
    } catch {
      return [piece];
    }
  });
}
