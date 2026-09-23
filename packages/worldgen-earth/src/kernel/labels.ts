/**
 * The one place that knows what a map feature class means to the generator: building classes and
 * subclasses become opaque labels, and the land-use polygon under a footprint becomes its context.
 */

import type {
  TerrainBuildingFeature,
  TerrainLandcoverFeature,
  TerrainSemanticPoint,
  TerrainSemanticPolygon,
} from '@bendyline/molen-terrain/kernel';
import { pointInPolygon, polygonArea } from '@bendyline/molen-terrain/kernel';

/** Specific building use when present; generic outline/part tags never override that use. */
export function buildingLabels(feature: TerrainBuildingFeature): string[] {
  const labels: string[] = [];
  for (const value of [feature.subclass, feature.class]) {
    const trimmed = value?.trim();
    if (trimmed !== undefined && trimmed.length > 0 && !labels.includes(trimmed))
      labels.push(trimmed);
  }
  const specific = labels.filter(
    (label) => !['yes', 'building', 'building_part', 'no'].includes(label),
  );
  return specific.length > 0 ? specific : ['building'];
}

/** Land label for scatter rules: class plus subclass so word matching sees both. */
export function landcoverLabel(feature: TerrainLandcoverFeature): string {
  const subclass = feature.subclass?.trim();
  return subclass !== undefined && subclass.length > 0 && subclass !== feature.class
    ? `${feature.class} ${subclass}`
    : feature.class;
}

// Land use is stronger evidence of building use than a lawn or tree canopy polygon.
const LAND_USES = new Set([
  'residential',
  'commercial',
  'retail',
  'industrial',
  'school',
  'hospital',
  'university',
  'college',
  'kindergarten',
  'education',
  'civic',
  'government',
  'religious',
  'military',
  'airport',
  'aerodrome',
  'farmyard',
]);

/** Most specific mapped land use, then the smallest physical landcover polygon. */
export function contextLabelAt(
  point: TerrainSemanticPoint,
  landcover: readonly TerrainLandcoverFeature[],
): string | undefined {
  let best: { area: number; label: string; use: boolean } | undefined;
  for (const feature of landcover) {
    const label =
      feature.subclass !== undefined && LAND_USES.has(feature.subclass)
        ? feature.subclass
        : feature.class;
    const use = LAND_USES.has(label);
    for (const polygon of feature.polygons) {
      if (!pointInPolygon(point, polygon)) continue;
      const area = polygonArea(polygon);
      if (best === undefined || (use && !best.use) || (use === best.use && area < best.area))
        best = { area, label, use };
    }
  }
  return best?.label;
}

/** Vote across the footprint so concave outlines and context boundaries do not rely on one centroid. */
export function contextLabelForPolygon(
  polygon: TerrainSemanticPolygon,
  centroid: TerrainSemanticPoint,
  landcover: readonly TerrainLandcoverFeature[],
): string | undefined {
  const points: TerrainSemanticPoint[] = [];
  if (pointInPolygon(centroid, polygon)) points.push(centroid);
  const stride = Math.max(1, Math.ceil(polygon.outer.length / 16));
  for (let i = 0; i < polygon.outer.length; i += stride) {
    const a = polygon.outer[i] as TerrainSemanticPoint;
    const b = polygon.outer[(i + 1) % polygon.outer.length] as TerrainSemanticPoint;
    const mid: TerrainSemanticPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const inset: TerrainSemanticPoint = [
      mid[0] * 0.99 + centroid[0] * 0.01,
      mid[1] * 0.99 + centroid[1] * 0.01,
    ];
    points.push(pointInPolygon(inset, polygon) ? inset : mid);
  }
  const votes = new Map<string, number>();
  for (const point of points) {
    const label = contextLabelAt(point, landcover);
    if (label !== undefined) votes.set(label, (votes.get(label) ?? 0) + 1);
  }
  return [...votes].sort(
    (a, b) =>
      b[1] - a[1] ||
      Number(LAND_USES.has(b[0])) - Number(LAND_USES.has(a[0])) ||
      (a[0] < b[0] ? -1 : 1),
  )[0]?.[0];
}
