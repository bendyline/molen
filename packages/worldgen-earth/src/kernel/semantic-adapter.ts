/**
 * Adapter from a normalized terrain semantic tile to a world-agnostic worldgen batch: tile-edge
 * ownership, `[u, v]` to local meters, identities, labels and context, region style rules, and
 * scatter polygons/exclusions with a world-anchored frame.
 */

import {
  polygonArea,
  roadWidth,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  waterwayWidth,
} from '@bendyline/molen-terrain/kernel';
import {
  analyzeFootprint,
  type BuildingRequest,
  buildingMetrics,
  type ResolvedStylePack,
  ringCentroid,
  type ScatterExclusion,
  type ScatterPolygon,
  type ScatterRequest,
  type StyleRule,
  selectStyle,
  type Vec2,
  type WorldgenBatchInput,
  type WorldgenBudgets,
} from '@bendyline/molen-worldgen/kernel';
import { identityFor } from './building-identity';
import { buildingPieces } from './building-parts';
import { applyBusinessAppearance, associateBusinesses } from './businesses';
import { contextLabelForPolygon, landcoverLabel } from './labels';
import { mappedPropExclusions, mappedPropRequests } from './mapped-props';
import { type RegionResolver, regionScatterId, regionStyleRules } from './region';
import type { RegionAtlasDoc } from './region-atlas-types';
import { residentialTreePolygons } from './residential-trees';
import { analyzeTileEdge, PROTOMAPS_TILE_BUFFER } from './tile-edges';

export interface TileGeometry {
  level: number;
  x: number;
  z: number;
  /** World XZ of the tile corner (local (0, 0)). */
  originX: number;
  originZ: number;
  /** Tile edge in world meters. */
  size: number;
  /** cos(center latitude) factor between projected units and world meters. */
  metersPerUnit: number;
  /** 0 at the finest level, 1 one level coarser, ... */
  levelBelowMax: number;
}

export interface SemanticAdapterOptions {
  pack: ResolvedStylePack;
  atlas?: RegionAtlasDoc;
  regions?: RegionResolver;
  budgets?: Partial<WorldgenBudgets>;
  features?: { buildings?: boolean; scatter?: boolean; interiors?: boolean };
  /** Source clip buffer in tile units (default: the Protomaps basemap buffer). */
  buffer?: number;
  /** Extra keep multiplier on top of the scatter tiers (default 1). */
  keep?: number;
  /** Added to the detail tier derived from the level (economy quality starts one tier lower). */
  tierOffset?: number;
}

export interface SemanticBatch extends WorldgenBatchInput {
  regionId?: string;
  scatterId?: string;
  /** Building polygons this tile skipped because a neighbour owns them. */
  skippedByOwnership: number;
  clippedPieces: number;
}

function toMeters(
  polygon: TerrainSemanticPolygon,
  size: number,
): { outline: Vec2[]; holes: Vec2[][] } {
  return {
    outline: polygon.outer.map((point): Vec2 => [point[0] * size, point[1] * size]),
    holes: (polygon.holes ?? []).map((hole) =>
      hole.map((point): Vec2 => [point[0] * size, point[1] * size]),
    ),
  };
}

/** Build the scatter request: land polygons with labels plus road, water, and building exclusions. */
export function scatterRequestFromTile(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  avoid: { roads: number; buildings: number; water: number },
  keep: number,
): ScatterRequest {
  const size = geom.size;
  const polygons: ScatterPolygon[] = [];
  for (const feature of tile.landcover) {
    const label = landcoverLabel(feature);
    for (const polygon of feature.polygons) {
      const { outline, holes } = toMeters(polygon, size);
      polygons.push({
        label,
        ring: outline,
        ...(holes.length > 0 ? { holes } : {}),
        ...(feature.density !== undefined ? { density: feature.density } : {}),
      });
    }
  }
  const exclusions: ScatterExclusion[] =
    geom.levelBelowMax === 0 ? mappedPropExclusions(tile, size) : [];
  for (const feature of tile.buildings) {
    for (const polygon of feature.polygons) {
      exclusions.push({
        ring: toMeters(polygon, size).outline,
        radius: avoid.buildings,
        kind: 'buildings',
      });
    }
  }
  for (const feature of tile.water) {
    for (const polygon of feature.polygons ?? []) {
      exclusions.push({
        ring: toMeters(polygon, size).outline,
        radius: avoid.water,
        kind: 'water',
      });
    }
    for (const line of feature.lines ?? []) {
      exclusions.push({
        polyline: line.map((point): Vec2 => [point[0] * size, point[1] * size]),
        width: waterwayWidth(feature.class, feature.width),
        radius: avoid.water,
        kind: 'water',
      });
    }
  }
  for (const feature of tile.transportation) {
    if (feature.tunnel === true) continue;
    for (const line of feature.lines) {
      exclusions.push({
        polyline: line.map((point): Vec2 => [point[0] * size, point[1] * size]),
        width: roadWidth(feature.class, feature.width),
        radius: avoid.roads,
        kind: 'roads',
      });
    }
  }
  return {
    polygons,
    exclusions,
    emitBounds: [0, 0, size, size],
    // global = (local - origin) * unitsPerMeter puts cells on the projected world grid.
    frame: {
      originX: -geom.originX,
      originZ: -geom.originZ,
      unitsPerMeter: 1 / geom.metersPerUnit,
    },
    keep,
  };
}

/** Turn a semantic tile into a batch input (without ground; the caller supplies the sampler). */
export function semanticTileToBatch(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  options: SemanticAdapterOptions,
): SemanticBatch {
  const buffer = options.buffer ?? PROTOMAPS_TILE_BUFFER;
  const size = geom.size;
  const tileBounds: [number, number, number, number] = [
    geom.originX,
    geom.originZ,
    geom.originX + size,
    geom.originZ + size,
  ];
  const centreRegion = options.regions?.resolve(geom.originX + size / 2, geom.originZ + size / 2);
  const straddles = (options.regions?.intersecting(tileBounds).length ?? 0) > 1;
  const atlas = options.atlas;
  const tileRules: StyleRule[] = atlas !== undefined ? regionStyleRules(atlas, centreRegion) : [];
  const packRules = options.pack.root.defaults.rules;
  const packFallback = options.pack.root.defaults.style;
  const buildings: BuildingRequest[] = [];
  let skippedByOwnership = 0;
  let clippedPieces = 0;
  if (options.features?.buildings !== false) {
    const pieces = buildingPieces(tile.buildings);
    const businesses =
      geom.levelBelowMax === 0 && !tile.buildingsGeneralized
        ? associateBusinesses(tile, pieces)
        : new Map();
    for (const piece of pieces) {
      const { feature, labels, polygon: source, polygonIndex } = piece;
      const decision = analyzeTileEdge(source, buffer);
      if (decision.mode === 'skip') {
        skippedByOwnership++;
        continue;
      }
      const polygon = decision.mode === 'clipped' ? decision.polygon : source;
      if (decision.mode === 'clipped') clippedPieces++;
      const { outline, holes } = toMeters(polygon, size);
      if (outline.length < 3) continue;
      const centroidUv = ringCentroid(polygon.outer);
      const context = contextLabelForPolygon(polygon, centroidUv, tile.landcover);
      const request: BuildingRequest = {
        identity:
          identityFor(feature, polygonIndex, toMeters(source, size).outline, geom) +
          (piece.remainder !== undefined ? `|remainder:${piece.remainder}` : ''),
        labels,
        ...(context !== undefined ? { context } : {}),
        outline,
        ...(piece.groundPolygon !== undefined
          ? { groundOutline: toMeters(piece.groundPolygon, size).outline }
          : {}),
        ...(holes.length > 0 ? { holes } : {}),
        ...(feature.height !== undefined && feature.height > (feature.minHeight ?? 0)
          ? { height: feature.height }
          : {}),
        ...(feature.levels !== undefined && feature.levels > 0 ? { levels: feature.levels } : {}),
        ...(feature.minHeight !== undefined ? { minHeight: feature.minHeight } : {}),
        ...(decision.mode === 'clipped'
          ? {
              clipped: true,
              ...(decision.seamEdges.length > 0 ? { seamEdges: decision.seamEdges } : {}),
            }
          : {}),
      };
      if (straddles && atlas !== undefined && options.regions !== undefined) {
        const world: Vec2 = [
          geom.originX + centroidUv[0] * size,
          geom.originZ + centroidUv[1] * size,
        ];
        const region = options.regions.resolve(world[0], world[1]);
        const rules = [...regionStyleRules(atlas, region), ...packRules];
        const analysis = analyzeFootprint(outline, holes);
        request.style = selectStyle(
          rules,
          buildingMetrics(request, analysis),
          packFallback,
          request.identity,
        ).style;
      }
      const occupants = businesses.get(piece);
      if (occupants !== undefined)
        applyBusinessAppearance(request, piece, occupants, tile, size, options.pack.archstyles);
      buildings.push(request);
    }
  }
  const scatterId =
    (atlas !== undefined ? regionScatterId(atlas, centreRegion) : undefined) ??
    options.pack.root.defaults.scatter;
  const scatterDoc = scatterId !== undefined ? options.pack.scatters[scatterId] : undefined;
  let scatter: ScatterRequest | undefined;
  if (options.features?.scatter !== false && scatterDoc !== undefined) {
    scatter = scatterRequestFromTile(tile, geom, scatterDoc.defaults.avoid, options.keep ?? 1);
    scatter.polygons.push(...residentialTreePolygons(tile, geom, options));
  }
  return {
    buildings,
    props: mappedPropRequests(
      tile,
      geom,
      options.features?.scatter !== false,
      options.features?.buildings !== false,
    ),
    ...(scatter !== undefined ? { scatter } : {}),
    pack: options.pack,
    rules: tileRules,
    ...(scatterId !== undefined ? { scatterId } : {}),
    ...(options.budgets !== undefined ? { budgets: options.budgets } : {}),
    tier: geom.levelBelowMax + Math.max(0, options.tierOffset ?? 0),
    interiors: options.features?.interiors === true && geom.levelBelowMax === 0,
    ...(centreRegion !== undefined ? { regionId: centreRegion.id } : {}),
    skippedByOwnership,
    clippedPieces,
  };
}

/** Total land polygon area in the tile, in m² (diagnostics). */
export function landcoverAreaOf(tile: TerrainSemanticTile, geom: TileGeometry): number {
  let area = 0;
  for (const feature of tile.landcover) {
    for (const polygon of feature.polygons) area += polygonArea(polygon) * geom.size * geom.size;
  }
  return area;
}
