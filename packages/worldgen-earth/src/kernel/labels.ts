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
import { agricultureFieldLabel } from './agriculture';

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
  const base =
    subclass !== undefined && subclass.length > 0 && subclass !== feature.class
      ? `${feature.class} ${subclass}`
      : feature.class;
  return [
    base,
    feature.crop ? `crop:${feature.crop}` : '',
    feature.trees ? `trees:${feature.trees}` : '',
    feature.irrigated === true ? 'irrigated' : '',
    feature.cultivation
      ? `agricultural_field ${agricultureFieldLabel(feature.cultivation.fieldId)}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** A protection boundary does not describe the physical ground under it. */
export function isLandcoverDesignation(feature: TerrainLandcoverFeature): boolean {
  return (
    ['nature_reserve', 'national_park', 'protected_area'].includes(feature.class) &&
    (feature.subclass === undefined ||
      feature.subclass === feature.class ||
      ['nature_reserve', 'national_park', 'protected_area'].includes(feature.subclass))
  );
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

/** A landcover polygon as contextLabelAt weighs it, with its outer ring's bounds. */
interface ContextPolygon {
  polygon: TerrainSemanticPolygon;
  label: string;
  use: boolean;
  /** Measured when first hit. */
  area: number | undefined;
  minU: number;
  minV: number;
  maxU: number;
  maxV: number;
}

/** A tile's context polygons in landcover order, and which of them reach each grid cell. */
interface ContextIndex {
  count: number;
  polygons: ContextPolygon[];
  minU: number;
  minV: number;
  cellU: number;
  cellV: number;
  cells: number[][];
}

const CONTEXT_GRID = 16;
// Wider than any rounding in the even-odd test: a point beyond it is outside the ring for sure.
const CONTEXT_PAD = 1e-9;
const contextIndexes = new WeakMap<readonly TerrainLandcoverFeature[], ContextIndex>();

/**
 * Index a landcover list once. A coarse tile's district heights sample every footprint about
 * seventeen times, and testing each sample against every landcover ring held a frame 7 ms.
 */
function contextIndex(landcover: readonly TerrainLandcoverFeature[]): ContextIndex {
  const cached = contextIndexes.get(landcover);
  if (cached !== undefined && cached.count === landcover.length) return cached;
  const polygons: ContextPolygon[] = [];
  let minU = Infinity,
    minV = Infinity,
    maxU = -Infinity,
    maxV = -Infinity;
  for (const feature of landcover) {
    if (isLandcoverDesignation(feature)) continue;
    const label =
      feature.subclass !== undefined && LAND_USES.has(feature.subclass)
        ? feature.subclass
        : feature.class;
    const use = LAND_USES.has(label);
    for (const polygon of feature.polygons) {
      const entry: ContextPolygon = {
        polygon,
        label,
        use,
        area: undefined,
        minU: Infinity,
        minV: Infinity,
        maxU: -Infinity,
        maxV: -Infinity,
      };
      for (const p of polygon.outer) {
        entry.minU = Math.min(entry.minU, p[0]);
        entry.minV = Math.min(entry.minV, p[1]);
        entry.maxU = Math.max(entry.maxU, p[0]);
        entry.maxV = Math.max(entry.maxV, p[1]);
      }
      entry.minU -= CONTEXT_PAD;
      entry.minV -= CONTEXT_PAD;
      entry.maxU += CONTEXT_PAD;
      entry.maxV += CONTEXT_PAD;
      if (!(entry.minU <= entry.maxU && entry.minV <= entry.maxV)) continue;
      polygons.push(entry);
      minU = Math.min(minU, entry.minU);
      minV = Math.min(minV, entry.minV);
      maxU = Math.max(maxU, entry.maxU);
      maxV = Math.max(maxV, entry.maxV);
    }
  }
  const cellU = polygons.length ? Math.max((maxU - minU) / CONTEXT_GRID, 1e-12) : 1;
  const cellV = polygons.length ? Math.max((maxV - minV) / CONTEXT_GRID, 1e-12) : 1;
  const cells: number[][] = Array.from({ length: CONTEXT_GRID * CONTEXT_GRID }, () => []);
  const cell = (value: number, min: number, size: number): number =>
    Math.min(CONTEXT_GRID - 1, Math.max(0, Math.floor((value - min) / size)));
  polygons.forEach((entry, i) => {
    for (let v = cell(entry.minV, minV, cellV); v <= cell(entry.maxV, minV, cellV); v++)
      for (let u = cell(entry.minU, minU, cellU); u <= cell(entry.maxU, minU, cellU); u++)
        (cells[v * CONTEXT_GRID + u] as number[]).push(i);
  });
  const index = { count: landcover.length, polygons, minU, minV, cellU, cellV, cells };
  contextIndexes.set(landcover, index);
  return index;
}

/** Most specific mapped land use, then the smallest physical landcover polygon. */
export function contextLabelAt(
  point: TerrainSemanticPoint,
  landcover: readonly TerrainLandcoverFeature[],
): string | undefined {
  const index = contextIndex(landcover);
  const u = Math.floor((point[0] - index.minU) / index.cellU),
    v = Math.floor((point[1] - index.minV) / index.cellV);
  if (!(u >= 0 && u < CONTEXT_GRID && v >= 0 && v < CONTEXT_GRID)) return undefined;
  let best: { area: number; label: string; use: boolean } | undefined;
  // A cell's polygons are in landcover order, so ties resolve as a full scan resolves them.
  for (const i of index.cells[v * CONTEXT_GRID + u] as number[]) {
    const entry = index.polygons[i] as ContextPolygon;
    if (
      point[0] < entry.minU ||
      point[0] > entry.maxU ||
      point[1] < entry.minV ||
      point[1] > entry.maxV ||
      !pointInPolygon(point, entry.polygon)
    )
      continue;
    entry.area ??= polygonArea(entry.polygon);
    const { area, label, use } = entry;
    if (best === undefined || (use && !best.use) || (use === best.use && area < best.area))
      best = { area, label, use };
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
