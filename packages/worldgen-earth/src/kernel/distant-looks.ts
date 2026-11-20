/**
 * Colors for the plain building shells of a coarse tile: each building as its style draws it up
 * close (its wall material and glass, its roof), so a district does not change color when its
 * finer tile replaces the shells. A shell without a style of its own took a pale wall from a
 * fixed palette, and a glass office tower turned white in the distance.
 */

import type {
  TerrainBuildingFeature,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  type BuildingMetrics,
  type BuildingRequest,
  type DistantLook,
  distantBuildingLook,
  hashString,
  packIdentity,
  type ResolvedStylePack,
  ringCentroid,
  type StyleRule,
  selectStyle,
  unit01,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import { identityFor } from './building-identity';
import { applyDeclaredBuildingUse } from './building-use';
import { buildingLabels, contextLabelAt } from './labels';
import { isMapOverrideFeature } from './map-override-tags';
import { type RegionResolver, regionStyleRules } from './region';
import type { RegionAtlasDoc } from './region-atlas-types';
import type { RegionalEnvironment } from './regional-environment';
import { hostBuildingChoices, type TileGeometry } from './semantic-adapter';

export interface DistantLookOptions {
  pack: ResolvedStylePack;
  atlas?: RegionAtlasDoc;
  regions?: RegionResolver;
  environment?: RegionalEnvironment;
  /**
   * Looks already worked out for each style, kept between calls (one map per pack, atlas and
   * environment): a host passes the same map for every tile it builds shells for. A slot is
   * empty until a shell first draws it.
   */
  samples?: Map<string, (DistantLook | undefined)[]>;
}

/** Looks drawn per style and size class; a shell takes one by its identity. */
const SAMPLES = 8;
/** Rules are looked up once per cell this wide (meters): regions do not change within one. */
const RULE_CELL = 500;

/** A rectangle of about the footprint's size class, and storeys of its height class. */
function sampleRequest(area: number, levels: number | undefined, index: number): BuildingRequest {
  const [w, d] = area < 200 ? [10, 14] : area < 2000 ? [30, 40] : [60, 70];
  const storeys = levels === undefined ? undefined : levels <= 2 ? 2 : levels <= 6 ? 5 : 20;
  return {
    identity: `distant:${index}`,
    labels: [],
    outline: [
      [0, 0],
      [w, 0],
      [w, d],
      [0, d],
    ],
    ...(storeys !== undefined ? { levels: storeys } : {}),
  };
}

function ringArea(ring: readonly (readonly [number, number])[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j] as readonly [number, number];
    const b = ring[i] as readonly [number, number];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

function footprintArea(polygon: TerrainSemanticPolygon, size: number): number {
  let area = ringArea(polygon.outer);
  for (const hole of polygon.holes ?? []) area -= ringArea(hole);
  return Math.max(0, area) * size * size;
}

/** The bounds a list of rules compares area, height, levels and vertex counts against. */
interface RuleBounds {
  area: number[];
  height: number[];
  levels: number[];
  vertices: number[];
}

function ruleBounds(rules: readonly StyleRule[]): RuleBounds {
  const sets = { area: new Set<number>(), height: new Set<number>(), levels: new Set<number>() };
  const vertices = new Set<number>();
  for (const { when } of rules) {
    if (when === undefined) continue;
    for (const value of [when.areaMin, when.areaMax]) if (value !== undefined) sets.area.add(value);
    for (const value of [when.heightMin, when.heightMax])
      if (value !== undefined) sets.height.add(value);
    for (const value of [when.levelsMin, when.levelsMax])
      if (value !== undefined) sets.levels.add(value);
    if (when.verticesMax !== undefined) vertices.add(when.verticesMax);
  }
  const sorted = (set: Set<number>): number[] => [...set].sort((a, b) => a - b);
  return {
    area: sorted(sets.area),
    height: sorted(sets.height),
    levels: sorted(sets.levels),
    vertices: sorted(vertices),
  };
}

/**
 * Which side of every bound a value is on, as rules compare it (`<` a minimum, `>` a maximum):
 * two values with the same band match exactly the same rules.
 */
function band(value: number | undefined, bounds: readonly number[]): string {
  if (value === undefined) return 'u';
  let below = 0;
  let atOrBelow = 0;
  for (const bound of bounds) {
    if (bound < value) below++;
    if (bound <= value) atOrBelow++;
  }
  return `${below}.${atOrBelow}`;
}

/**
 * Each building's look, from the style the adapter would choose for it where footprints are
 * generalized: the map's labels, the land use under it, its area and height and its region.
 * A coarse tile's polygons are merged and simplified, so none is the building that replaces it
 * and its palette pick cannot be that building's anyway. Its style's colors are what carry over:
 * each style's looks are worked out from its recipe once, for a few identities per size class,
 * and a polygon takes one by its own identity. Shape rules (elongation, rectangularity, wings)
 * see a plain rectangle. A host's building (a map override) is worked out whole, in the style
 * and colors its host gave it. `tile` is the one the buildings came from, land cover included.
 */
export function distantBuildingLooks(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  options: DistantLookOptions,
): (feature: TerrainBuildingFeature, polygonIndex: number) => DistantLook | undefined {
  const { pack, atlas, regions, environment } = options;
  const identity = packIdentity(pack);
  const packRules = pack.root.defaults.rules;
  const fallback = pack.root.defaults.style;
  const size = geom.size;
  const samples = options.samples ?? new Map<string, (DistantLook | undefined)[]>();
  interface Cell {
    rules: readonly StyleRule[];
    bounds: RuleBounds;
    /** The rule each kind of building matched (null: none, the fallback style). */
    chosen: Map<string, StyleRule | null>;
  }
  const cells = new Map<string, Cell>();
  const cellAt = (x: number, z: number): Cell => {
    const key = `${Math.floor(x / RULE_CELL)},${Math.floor(z / RULE_CELL)}`;
    let cell = cells.get(key);
    if (cell === undefined) {
      const rules = [
        ...(environment?.at(x, z).buildings ?? []),
        ...(atlas !== undefined ? regionStyleRules(atlas, regions?.resolve(x, z)) : []),
        ...packRules,
      ];
      cell = { rules, bounds: ruleBounds(rules), chosen: new Map() };
      cells.set(key, cell);
    }
    return cell;
  };
  /**
   * selectStyle, remembered: rules compare labels and land use as words and area, height,
   * levels and vertices against fixed bounds, so buildings alike in those match the same rule.
   * Only a rule's weighted variants are drawn per building.
   */
  const styleOf = (
    cell: Cell,
    labelKey: string,
    id: string,
    metrics: () => BuildingMetrics,
    context: string | undefined,
    area: number,
    polygon: TerrainSemanticPolygon,
    height: number | undefined,
    levels: number | undefined,
  ) => {
    const { bounds } = cell;
    // The metrics object is built only when a rule has to be found or a variant drawn.
    const key = `${labelKey}|${context ?? ''}|${band(area, bounds.area)}|${band(
      height,
      bounds.height,
    )}|${band(levels, bounds.levels)}|${band(polygon.outer.length, bounds.vertices)}|${
      (polygon.holes?.length ?? 0) > 0 ? 1 : 0
    }`;
    const rule = cell.chosen.get(key);
    if (rule === undefined) {
      const selection = selectStyle(cell.rules, metrics(), fallback, id);
      cell.chosen.set(key, cell.rules[selection.ruleIndex] ?? null);
      return selection.style;
    }
    if (rule === null) return fallback;
    return rule.variants !== undefined && rule.variants.length > 0
      ? selectStyle([rule], metrics(), fallback, id).style
      : rule.style;
  };
  /**
   * One of a style's looks for this size and height. Each is worked out the first time a shell
   * draws it: a whole set at once held a slice for tens of milliseconds in a busy page.
   */
  const lookOf = (
    styleId: string,
    area: number,
    levels: number | undefined,
    pick: number,
  ): DistantLook | undefined => {
    const style = pack.archstyles[styleId];
    if (style === undefined) return undefined;
    const key = `${styleId}|${area < 200 ? 0 : area < 2000 ? 1 : 2}|${
      levels === undefined ? '-' : levels <= 2 ? 0 : levels <= 6 ? 1 : 2
    }`;
    let looks = samples.get(key);
    if (looks === undefined) {
      looks = new Array<DistantLook | undefined>(SAMPLES).fill(undefined);
      samples.set(key, looks);
    }
    const index = Math.floor(pick * SAMPLES);
    let look = looks[index];
    if (look === undefined) {
      look = distantBuildingLook(style, identity, sampleRequest(area, levels, index));
      looks[index] = look;
    }
    return look;
  };
  // A coarse feature is often hundreds of merged footprints, asked for one after another.
  let last: TerrainBuildingFeature | undefined;
  let labels: string[] = [];
  let labelKey = '';
  return (feature, polygonIndex) => {
    const polygon = feature.polygons[polygonIndex];
    if (polygon === undefined || polygon.outer.length < 3) return undefined;
    const area = footprintArea(polygon, size);
    if (!(area > 0)) return undefined;
    if (feature !== last) {
      last = feature;
      labels = buildingLabels(feature);
      labelKey = labels.join('\u0001');
    }
    const centroid = ringCentroid(polygon.outer);
    const context = contextLabelAt(centroid, tile.landcover);
    const height =
      feature.height !== undefined && feature.height > (feature.minHeight ?? 0)
        ? feature.height
        : undefined;
    const levels = feature.levels !== undefined && feature.levels > 0 ? feature.levels : undefined;
    const meters = (): Vec2[] => polygon.outer.map((p): Vec2 => [p[0] * size, p[1] * size]);
    // The outline only names a building the map gave no id.
    const id = identityFor(feature, polygonIndex, feature.id === undefined ? meters() : [], geom);
    if (isMapOverrideFeature(feature)) {
      const outline = meters();
      // Few, and their owner's choices: the whole recipe, in the host's style and colors.
      const request: BuildingRequest = {
        identity: id,
        labels: [...labels],
        ...(context !== undefined ? { context } : {}),
        outline,
        ...(height !== undefined ? { height } : {}),
        ...(levels !== undefined ? { levels } : {}),
        ...hostBuildingChoices(feature, pack.archstyles),
      };
      if (feature.subclass !== undefined)
        applyDeclaredBuildingUse(request, feature.subclass, pack.archstyles);
      const style =
        pack.archstyles[
          request.style ??
            selectStyle(
              cellAt(geom.originX + centroid[0] * size, geom.originZ + centroid[1] * size).rules,
              metricsOf(request.labels, context, area, polygon, height, levels),
              fallback,
              id,
            ).style
        ];
      return style !== undefined ? distantBuildingLook(style, identity, request) : undefined;
    }
    const styleId = styleOf(
      cellAt(geom.originX + centroid[0] * size, geom.originZ + centroid[1] * size),
      labelKey,
      id,
      () => metricsOf(labels, context, area, polygon, height, levels),
      context,
      area,
      polygon,
      height,
      levels,
    );
    // Storeys pick the roof (some are pitched only so high): a mapped height counts too.
    return lookOf(
      pack.archstyles[styleId] !== undefined ? styleId : fallback,
      area,
      levels ?? (height !== undefined ? Math.max(1, Math.round(height / 3.2)) : undefined),
      unit01(hashString(`distant|${id}`), 0),
    );
  };
}

function metricsOf(
  labels: string[],
  context: string | undefined,
  area: number,
  polygon: TerrainSemanticPolygon,
  height: number | undefined,
  levels: number | undefined,
): BuildingMetrics {
  return {
    labels,
    ...(context !== undefined ? { context } : {}),
    areaM2: area,
    perimeterM: 4 * Math.sqrt(area),
    vertexCount: polygon.outer.length,
    hasHoles: (polygon.holes?.length ?? 0) > 0,
    elongation: 1,
    rectangularity: 1,
    ...(height !== undefined ? { height } : {}),
    ...(levels !== undefined ? { levels } : {}),
    wings: 1,
  };
}
