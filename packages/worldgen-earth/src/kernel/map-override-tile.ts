/**
 * Map overrides applied to one semantic tile: what a host cleared is taken out of the tile, and
 * what it placed goes in as ordinary features, before anything reads the tile. Everything
 * downstream (buildings, land cover, plants, road surfaces, parked cars, traffic) then follows
 * the edited tile without knowing an override exists.
 *
 * The edit is pure: the tile it is given is never changed, a tile no override reaches comes back
 * as the same object, and untouched collections keep their identity so the result still crosses
 * to workers as its base packet and an edit.
 */

import {
  clipRoadLine,
  deriveTerrainSemanticTileContentHash,
  deriveTerrainSemanticTilePacket,
  isAeroway,
  pointInPolygon,
  polygonArea,
  polygonBounds,
  type TerrainBuildingFeature,
  type TerrainLandcoverFeature,
  type TerrainPoiFeature,
  type TerrainSemanticLine,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  transportKind,
} from '@bendyline/molen-terrain/kernel';
import { clipRingToRect } from '@bendyline/molen-worldgen/kernel';
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { isLandcoverDesignation } from './labels';
import {
  MAP_OVERRIDE_COLOR_TAG,
  MAP_OVERRIDE_COVER_CLASS,
  MAP_OVERRIDE_MODEL_TAG,
  MAP_OVERRIDE_SCALE_TAG,
  MAP_OVERRIDE_STYLE_TAG,
  MAP_OVERRIDE_TAG,
  MAP_OVERRIDE_TRIM_TAG,
  MAP_OVERRIDE_WALL_TAG,
  mapOverrideFeatureId,
} from './map-override-tags';
import type { ResolvedMapOverride } from './map-overrides';
import type { TileGeometry } from './semantic-adapter';
import { buildingClipBuffer, PROTOMAPS_TILE_BUFFER } from './tile-edges';

/** A mapped footprint goes whole when at least this share of it lies in a cleared rectangle. */
const WHOLE_BUILDING_COVERAGE = 0.5;
/** Pieces a cut leaves smaller than this (square meters) are dropped: slivers, not ground. */
const MIN_PIECE_AREA = 0.25;
/** A part belongs to the outline that holds this share of it (as building-parts.ts pairs them). */
const PART_OVERLAP = 0.999;
/** Road and rail controls are cleared with the roads, this far (meters) beyond the rectangle. */
const CONTROL_MARGIN = 15;
/** Slack for "this vertex lies on the tile's clip line", in tile units. */
const EPS = 1 / 8192;

const TREE_POIS = new Set(['tree']);
const PROP_POIS = new Set(['street_lamp', 'bench', 'bicycle_parking', 'charging_station']);
/** POIs that belong to the roads and rails they stand on, and stay while those do. */
const CONTROL_POIS = new Set([
  'crossing',
  'stop',
  'give_way',
  'traffic_signals',
  'signal',
  'station',
  'bus_stop',
  'tram_stop',
  'platform',
  'motorway_junction',
  'milepost',
  'derail',
]);

type Box = readonly [number, number, number, number];

interface Mask {
  override: ResolvedMapOverride;
  /** The rectangle in tile units. */
  ring: TerrainSemanticPoint[];
  bounds: Box;
}

function overlaps(a: Box, b: Box): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function boundsOfPolygons(polygons: readonly TerrainSemanticPolygon[]): Box {
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons) {
    const [minU, minV, maxU, maxV] = polygonBounds(polygon);
    if (minU < box[0]) box[0] = minU;
    if (minV < box[1]) box[1] = minV;
    if (maxU > box[2]) box[2] = maxU;
    if (maxV > box[3]) box[3] = maxV;
  }
  return box;
}

function coordinates(polygon: TerrainSemanticPolygon): Polygon {
  return [polygon.outer, ...(polygon.holes ?? [])];
}

function ringArea(ring: readonly (readonly [number, number])[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as readonly [number, number];
    const b = ring[(i + 1) % ring.length] as readonly [number, number];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

/** Clipper output as tile polygons, without the pieces and holes too small to draw. */
function semantic(result: MultiPolygon, minArea: number): TerrainSemanticPolygon[] {
  const polygons: TerrainSemanticPolygon[] = [];
  for (const polygon of result) {
    const outer = (polygon[0] ?? []).slice(0, -1);
    if (outer.length < 3 || ringArea(outer) < minArea) continue;
    const holes = polygon
      .slice(1)
      .map((ring) => ring.slice(0, -1))
      .filter((ring) => ring.length >= 3 && ringArea(ring) >= minArea);
    polygons.push(holes.length > 0 ? { outer, holes } : { outer });
  }
  return polygons;
}

/** `polygons` without the masks' rectangles, or undefined when they are untouched. */
function cut(
  polygons: readonly TerrainSemanticPolygon[],
  masks: readonly Mask[],
  minArea: number,
): TerrainSemanticPolygon[] | undefined {
  let changed = false;
  const result = polygons.flatMap((polygon) => {
    const bounds = polygonBounds(polygon);
    const near = masks.filter((mask) => overlaps(mask.bounds, bounds));
    if (near.length === 0) return [polygon];
    try {
      const remaining = semantic(
        polygonClipping.difference(
          coordinates(polygon),
          ...near.map((mask): Polygon => [mask.ring]),
        ),
        minArea,
      );
      const area = remaining.reduce((sum, piece) => sum + polygonArea(piece), 0);
      if (Math.abs(area - polygonArea(polygon)) <= 1e-12) return [polygon];
      changed = true;
      return remaining;
    } catch {
      // Malformed source data stays as mapped rather than taking unrelated ground with it.
      return [polygon];
    }
  });
  return changed ? result : undefined;
}

/** The share of `polygons`' area inside the masks' rectangles. */
function coverage(polygons: readonly TerrainSemanticPolygon[], masks: readonly Mask[]): number {
  const total = polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
  if (!(total > 1e-14)) return 0;
  const remaining = cut(polygons, masks, 0);
  if (remaining === undefined) return 0;
  return (total - remaining.reduce((sum, polygon) => sum + polygonArea(polygon), 0)) / total;
}

/** The share of `part` that lies in `outline`. */
function overlapShare(part: TerrainSemanticPolygon, outline: TerrainSemanticPolygon): number {
  const area = polygonArea(part);
  if (!(area > 1e-14)) return 0;
  try {
    const shared = polygonClipping.intersection(coordinates(part), coordinates(outline));
    return semantic(shared, 0).reduce((sum, polygon) => sum + polygonArea(polygon), 0) / area;
  } catch {
    return 0;
  }
}

function isParkingCover(feature: TerrainLandcoverFeature): boolean {
  return /parking|car_park/.test(`${feature.class} ${feature.subclass ?? ''}`);
}

/** Never cut: what is graded, bored or flown from, and what runs on rails. */
function fixedTransport(feature: TerrainTransportationFeature): boolean {
  return (
    feature.bridge === true ||
    feature.tunnel === true ||
    (feature.layer ?? 0) !== 0 ||
    feature.deckElevation !== undefined ||
    feature.bridgeConnections !== undefined ||
    feature.bridgeApproachProfile !== undefined ||
    isAeroway(feature) ||
    transportKind(feature) === 'rail'
  );
}

function isParkingAccess(feature: TerrainTransportationFeature): boolean {
  return (
    transportKind(feature) === 'service' &&
    /parking|driveway/.test(`${feature.subclass ?? ''} ${feature.service ?? ''}`)
  );
}

/**
 * The key of an edit: the tile's geometry and each override reaching it, by content. Two edits of
 * one tile with equal keys are equal.
 */
export function mapOverrideTileKey(
  geom: TileGeometry,
  overrides: readonly ResolvedMapOverride[],
): string {
  return `overrides>${geom.level}/${geom.x}/${geom.z}@${geom.originX},${geom.originZ},${geom.size},${geom.metersPerUnit}:${overrides
    .map((override) => `${override.id}@${override.hash}`)
    .join(';')}`;
}

/**
 * `tile` as the overrides leave it: mapped buildings, land cover, street furniture, parking and
 * (when asked) roads removed from each rectangle, and the host's buildings and props added.
 * `overrides` are those of `MapOverrideSet.forTile(geom)`; ones that do not reach the tile or
 * need a finer level are skipped. Returns `tile` itself when nothing changes.
 */
export function applyMapOverrides(
  tile: TerrainSemanticTile,
  geom: TileGeometry,
  overrides: readonly ResolvedMapOverride[],
): TerrainSemanticTile {
  if (overrides.length === 0) return tile;
  const { size, metersPerUnit } = geom;
  const toUv = (point: readonly [number, number]): TerrainSemanticPoint => [
    (point[0] * metersPerUnit - geom.originX) / size,
    (point[1] * metersPerUnit - geom.originZ) / size,
  ];
  const boxUv = (box: Box): Box => {
    const [minU, minV] = toUv([box[0], box[1]]);
    const [maxU, maxV] = toUv([box[2], box[3]]);
    return [minU, minV, maxU, maxV];
  };
  const reach = (box: Box, buffer: number): boolean =>
    overlaps(box, [-buffer, -buffer, 1 + buffer, 1 + buffer]);
  const active = overrides.filter(
    (override) =>
      geom.level >= override.minLevel && reach(boxUv(override.bounds), PROTOMAPS_TILE_BUFFER),
  );
  if (active.length === 0) return tile;
  const masks = active.flatMap((override): Mask[] => {
    const ring = override.ring.map(toUv);
    const bounds = boxUv(override.areaBounds);
    return reach(bounds, PROTOMAPS_TILE_BUFFER) ? [{ override, ring, bounds }] : [];
  });
  const minArea = MIN_PIECE_AREA / (size * size);
  const inside = (mask: Mask, point: TerrainSemanticPoint): boolean =>
    pointInPolygon(point, { outer: mask.ring });

  // Mapped buildings.
  let buildings = tile.buildings;
  const buildingMasks = masks.filter((mask) => mask.override.clear.buildings !== false);
  if (buildingMasks.length > 0 && tile.buildings.length > 0) {
    const buffer = buildingClipBuffer(tile, geom.level);
    const exact = tile.buildingsGeneralized !== true;
    // Decided per feature: 'keep', 'drop', or the polygons a cut left.
    const verdicts = new Map<number, 'drop' | TerrainSemanticPolygon[]>();
    const near = new Map<number, Mask[]>();
    tile.buildings.forEach((feature, index) => {
      const bounds = boundsOfPolygons(feature.polygons);
      const reached = buildingMasks.filter((mask) => overlaps(mask.bounds, bounds));
      if (reached.length === 0) return;
      near.set(index, reached);
      // A copy cut at the tile's clip line is not the whole footprint: its neighbor sees another
      // share of it, and each deciding by coverage could keep one half and drop the other.
      const partial =
        !exact ||
        bounds[0] <= -buffer + EPS ||
        bounds[1] <= -buffer + EPS ||
        bounds[2] >= 1 + buffer - EPS ||
        bounds[3] >= 1 + buffer - EPS;
      const trimming = reached.filter(
        (mask) => partial || mask.override.clear.buildings === 'clip',
      );
      const whole = reached.filter((mask) => !trimming.includes(mask));
      if (whole.length > 0 && coverage(feature.polygons, whole) >= WHOLE_BUILDING_COVERAGE) {
        verdicts.set(index, 'drop');
        return;
      }
      if (trimming.length === 0) return;
      const polygons = cut(feature.polygons, trimming, minArea);
      if (polygons !== undefined) verdicts.set(index, polygons.length > 0 ? polygons : 'drop');
    });
    if (exact && near.size > 0) {
      // Stock map data pairs a building's parts with its outline only by position. A part goes
      // or stays with its outline: a tower's shaft is not left standing on a cleared lot.
      const outlines = [...near.keys()]
        .filter((index) => tile.buildings[index]?.class !== 'building_part')
        .map((index) => ({
          index,
          bounds: boundsOfPolygons((tile.buildings[index] as TerrainBuildingFeature).polygons),
        }));
      // Every part, not only those the rectangle reaches: one beside it follows its outline too.
      for (const [index, part] of tile.buildings.entries()) {
        if (part.class !== 'building_part' || outlines.length === 0) continue;
        const partBounds = boundsOfPolygons(part.polygons);
        let parent: number | undefined;
        let parentArea = Infinity;
        for (const candidate of outlines) {
          if (!overlaps(candidate.bounds, partBounds)) continue;
          const outline = tile.buildings[candidate.index] as TerrainBuildingFeature;
          for (const polygon of outline.polygons) {
            const area = polygonArea(polygon);
            if (area >= parentArea) continue;
            if (
              part.polygons.every(
                (piece) =>
                  overlaps(polygonBounds(polygon), polygonBounds(piece)) &&
                  overlapShare(piece, polygon) >= PART_OVERLAP,
              )
            ) {
              parent = candidate.index;
              parentArea = area;
            }
          }
        }
        if (parent === undefined) continue;
        const verdict = verdicts.get(parent);
        if (verdict === undefined) verdicts.delete(index);
        else if (verdict === 'drop') verdicts.set(index, 'drop');
        else {
          const polygons = cut(part.polygons, near.get(parent) ?? [], minArea);
          if (polygons === undefined) verdicts.delete(index);
          else verdicts.set(index, polygons.length > 0 ? polygons : 'drop');
        }
      }
    }
    if (verdicts.size > 0)
      buildings = tile.buildings.flatMap((feature, index) => {
        const verdict = verdicts.get(index);
        if (verdict === undefined) return [feature];
        return verdict === 'drop' ? [] : [{ ...feature, polygons: verdict }];
      });
  }

  // Land cover: the rectangle is taken out of what lies across it, then covered.
  let landcover = tile.landcover;
  const coverMasks = masks.filter((mask) => mask.override.clear.vegetation);
  const parkingMasks = masks.filter(
    (mask) => mask.override.clear.parking && !mask.override.clear.vegetation,
  );
  if (coverMasks.length > 0 || parkingMasks.length > 0) {
    let changed = false;
    const remaining = tile.landcover.flatMap((feature) => {
      // A protection boundary or a named place's outline does not describe the ground.
      if (isLandcoverDesignation(feature)) return [feature];
      const reached = isParkingCover(feature) ? [...coverMasks, ...parkingMasks] : coverMasks;
      if (reached.length === 0) return [feature];
      const polygons = cut(feature.polygons, reached, minArea);
      if (polygons === undefined) return [feature];
      changed = true;
      return polygons.length > 0 ? [{ ...feature, polygons }] : [];
    });
    const covers = coverMasks.flatMap((mask): TerrainLandcoverFeature[] => {
      // As map data arrives: no further than the tile's own clip line.
      const outer = clipRingToRect(mask.ring, [
        -PROTOMAPS_TILE_BUFFER,
        -PROTOMAPS_TILE_BUFFER,
        1 + PROTOMAPS_TILE_BUFFER,
        1 + PROTOMAPS_TILE_BUFFER,
      ]);
      if (outer.length < 3 || ringArea(outer) < minArea) return [];
      return [
        {
          id: mapOverrideFeatureId(mask.override.id, 'ground'),
          class: MAP_OVERRIDE_COVER_CLASS,
          subclass: mask.override.cover,
          // No plants are scattered on ground a host cleared.
          density: 0,
          polygons: [{ outer }],
        },
      ];
    });
    if (changed || covers.length > 0) landcover = [...remaining, ...covers];
  }

  // Roads: parking access goes with the parking, the rest only when asked.
  let transportation = tile.transportation;
  const roadMasks = masks.filter(
    (mask) => mask.override.clear.roads || mask.override.clear.parking,
  );
  if (roadMasks.length > 0 && tile.transportation.length > 0) {
    let changed = false;
    const kept = tile.transportation.flatMap((feature) => {
      if (fixedTransport(feature)) return [feature];
      const parking = isParkingAccess(feature);
      const reached = roadMasks.filter(
        (mask) => mask.override.clear.roads || (parking && mask.override.clear.parking),
      );
      if (reached.length === 0) return [feature];
      let lines: TerrainSemanticLine[] = feature.lines;
      for (const mask of reached) {
        const next = withoutRectangle(lines, mask, geom);
        if (next !== undefined) lines = next;
      }
      if (lines === feature.lines) return [feature];
      changed = true;
      return lines.length > 0 ? [{ ...feature, lines }] : [];
    });
    if (changed) transportation = kept;
  }

  // Mapped points: trees, street furniture, the businesses of cleared buildings.
  let pois = tile.pois;
  if (pois !== undefined && pois.length > 0 && masks.length > 0) {
    const margin = (meters: number, mask: Mask, point: TerrainSemanticPoint): boolean => {
      // The rectangle grown by a margin, tested in the override's own frame.
      const x = (point[0] * size + geom.originX) / metersPerUnit - mask.override.origin[0];
      const z = (point[1] * size + geom.originZ) / metersPerUnit - mask.override.origin[1];
      const { axisX, axisZ, half } = mask.override;
      const k2 = axisX[0] * axisX[0] + axisX[1] * axisX[1];
      return (
        Math.abs((x * axisX[0] + z * axisX[1]) / k2) <= half[0] + meters &&
        Math.abs((x * axisZ[0] + z * axisZ[1]) / k2) <= half[1] + meters
      );
    };
    const kept = pois.filter((poi) => {
      for (const mask of masks) {
        const clear = mask.override.clear;
        if (CONTROL_POIS.has(poi.class)) {
          if (clear.roads && margin(CONTROL_MARGIN, mask, poi.point)) return false;
          continue;
        }
        const cleared = TREE_POIS.has(poi.class)
          ? clear.vegetation
          : PROP_POIS.has(poi.class)
            ? clear.props
            : clear.buildings !== false;
        if (cleared && inside(mask, poi.point)) return false;
      }
      return true;
    });
    if (kept.length !== pois.length) pois = kept;
  }

  // What the host placed.
  const buffer = buildingClipBuffer(tile, geom.level);
  const hostBuildings = active.flatMap((override) =>
    override.buildings.flatMap((building): TerrainBuildingFeature[] => {
      if (!reach(boxUv(building.bounds), buffer)) return [];
      const tags: Record<string, string> = { [MAP_OVERRIDE_TAG]: override.id };
      if (building.style !== undefined) tags[MAP_OVERRIDE_STYLE_TAG] = building.style;
      if (building.wall !== undefined) tags[MAP_OVERRIDE_WALL_TAG] = building.wall;
      if (building.trim !== undefined) tags[MAP_OVERRIDE_TRIM_TAG] = building.trim;
      return [
        {
          id: building.featureId,
          class: 'building',
          ...(building.use !== undefined ? { subclass: building.use } : {}),
          // Whole in every tile it reaches: the tile holding its center draws it.
          polygons: [{ outer: building.ring.map(toUv) }],
          ...(building.height !== undefined ? { height: building.height } : {}),
          ...(building.levels !== undefined ? { levels: building.levels } : {}),
          ...(building.minHeight !== undefined ? { minHeight: building.minHeight } : {}),
          ...(building.name !== undefined ? { name: building.name } : {}),
          tags,
        },
      ];
    }),
  );
  if (hostBuildings.length > 0) buildings = [...buildings, ...hostBuildings];
  // Props are drawn on the finest tiles and one level above; coarser tiles do not carry them.
  const hostProps =
    geom.levelBelowMax > 1
      ? []
      : active.flatMap((override) =>
          override.props.flatMap((prop): TerrainPoiFeature[] => {
            const point = toUv(prop.point);
            if (!reach([point[0], point[1], point[0], point[1]], PROTOMAPS_TILE_BUFFER)) return [];
            const tags: Record<string, string> = { [MAP_OVERRIDE_TAG]: override.id };
            if (prop.model !== undefined) tags[MAP_OVERRIDE_MODEL_TAG] = prop.model;
            if (prop.scale !== undefined) tags[MAP_OVERRIDE_SCALE_TAG] = prop.scale;
            if (prop.color !== undefined) tags[MAP_OVERRIDE_COLOR_TAG] = prop.color;
            return [
              {
                id: prop.featureId,
                class: prop.poiClass,
                point,
                // Always given: furniture without a heading turns to face the nearest road.
                heading: prop.rotation,
                ...(prop.height !== undefined ? { height: prop.height } : {}),
                ...(prop.crownDiameter !== undefined ? { crownDiameter: prop.crownDiameter } : {}),
                ...(prop.leafType !== undefined ? { leafType: prop.leafType } : {}),
                ...(prop.species !== undefined ? { species: prop.species } : {}),
                tags,
              },
            ];
          }),
        );
  if (hostProps.length > 0) pois = [...(pois ?? []), ...hostProps];

  if (
    buildings === tile.buildings &&
    landcover === tile.landcover &&
    transportation === tile.transportation &&
    pois === tile.pois
  )
    return tile;
  const derived: TerrainSemanticTile = {
    ...tile,
    buildings,
    landcover,
    transportation,
    ...(pois !== undefined ? { pois } : {}),
  };
  // The key names the edit completely, so a cache keyed by content need not read the tile; and
  // the tile crosses to workers as its base and this edit rather than cloned whole.
  deriveTerrainSemanticTileContentHash(tile, derived, mapOverrideTileKey(geom, active));
  deriveTerrainSemanticTilePacket(tile, derived);
  return derived;
}

/**
 * `lines` without the parts whose center line runs through a mask's rectangle, or undefined when
 * none does. Untouched lines and points keep their identity.
 */
function withoutRectangle(
  lines: TerrainSemanticLine[],
  mask: Mask,
  geom: TileGeometry,
): TerrainSemanticLine[] | undefined {
  const { override } = mask;
  const { axisX, axisZ, half, origin } = override;
  const k2 = axisX[0] * axisX[0] + axisX[1] * axisX[1];
  const box: Box = [-half[0], -half[1], half[0], half[1]];
  let changed = false;
  const result = lines.flatMap((line) => {
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    for (const [u, v] of line) {
      if (u < minU) minU = u;
      if (v < minV) minV = v;
      if (u > maxU) maxU = u;
      if (v > maxV) maxV = v;
    }
    if (!overlaps(mask.bounds, [minU, minV, maxU, maxV])) return [line];
    // The rectangle is a box in the override's frame, so the line is clipped there.
    const sources = new Map<TerrainSemanticPoint, TerrainSemanticPoint>();
    const local = line.map((point): TerrainSemanticPoint => {
      const x = (point[0] * geom.size + geom.originX) / geom.metersPerUnit - origin[0];
      const z = (point[1] * geom.size + geom.originZ) / geom.metersPerUnit - origin[1];
      const framed: TerrainSemanticPoint = [
        (x * axisX[0] + z * axisX[1]) / k2,
        (x * axisZ[0] + z * axisZ[1]) / k2,
      ];
      sources.set(framed, point);
      return framed;
    });
    if (clipRoadLine(local, box).length === 0) return [line];
    changed = true;
    return clipRoadLine(local, box, true)
      .filter((piece) => piece.length >= 2)
      .map((piece) =>
        piece.map((point): TerrainSemanticPoint => {
          const source = sources.get(point);
          if (source !== undefined) return source;
          const x = origin[0] + axisX[0] * point[0] + axisZ[0] * point[1];
          const z = origin[1] + axisX[1] * point[0] + axisZ[1] * point[1];
          return [
            (x * geom.metersPerUnit - geom.originX) / geom.size,
            (z * geom.metersPerUnit - geom.originZ) / geom.size,
          ];
        }),
      );
  });
  return changed ? result : undefined;
}
