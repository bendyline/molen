/**
 * Map features → edge drafts: world-metre polylines with a transport class, kind, width, lane
 * count and grade, clipped to their tile so neighbouring tiles never duplicate a road. Widths,
 * lane counts and surface lifts come from the terrain painter's rules, so simulated lanes sit on
 * painted lanes.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  groupTransportationFeatures,
  inferLaneCount,
  isTransportLink,
  joinTerrainLines,
  type TerrainPoiFeature,
  type TerrainSemanticLine,
  type TerrainTransportationFeature,
  transportKind,
  transportWidth,
} from '@bendyline/molen-terrain/kernel';
import type { RoadKind, TransportClass } from './types';

export type Point2 = [number, number];

/** A polyline awaiting the planar split, in world metres. */
export interface EdgeDraft {
  class: TransportClass;
  kind: RoadKind;
  points: Point2[];
  /** Absolute surface heights per point (documents); otherwise baked from the ground sampler. */
  heights?: number[];
  width: number;
  /** Total lanes across both directions (road), ignored for other classes. */
  lanes: number;
  oneway: boolean;
  layer: number;
  bridge: boolean;
  tunnel: boolean;
  link: boolean;
  speed?: number;
  name?: string;
  deckElevation?: number;
  bridgeConnections?: { point: Point2; elevation: number; radius: number }[];
}

/** Design speeds in m/s by kind. */
export const KIND_SPEED: Readonly<Record<RoadKind, number>> = {
  motorway: 27,
  trunk: 22,
  primary: 17,
  secondary: 15,
  tertiary: 13,
  street: 11,
  living: 5,
  service: 5.5,
  path: 1.4,
  crossing: 1.4,
  rail: 20,
  tram: 12,
};

export interface FeatureDraftOptions {
  /** Tunnels: keep them with hidden agents (default) or drop them. */
  tunnels: 'hidden' | 'skip';
}

/** Classify a mapped feature; `undefined` for features no agent uses. */
export function classifyFeature(
  feature: TerrainTransportationFeature,
): { class: TransportClass; kind: RoadKind } | 'runway' | undefined {
  const cls = feature.class.toLowerCase();
  const sub = (feature.subclass ?? '').toLowerCase();
  if (cls === 'aeroway' || /runway|taxiway|apron/.test(sub)) {
    return sub === 'runway' || cls === 'runway' ? 'runway' : undefined;
  }
  if (cls === 'ferry' || sub === 'ferry') return undefined;
  const kind = transportKind(feature);
  if (kind === 'rail') {
    if (/disused|abandoned|construction|proposed|platform|station|miniature|funicular/.test(sub))
      return undefined;
    // Yards, sidings and crossovers carry no through service.
    if (feature.service !== undefined && /yard|siding|spur|crossover/.test(feature.service))
      return undefined;
    return { class: 'rail', kind: /tram/.test(sub) ? 'tram' : 'rail' };
  }
  if (kind === 'path') {
    if (/cycleway|bridleway/.test(sub)) return undefined;
    return { class: 'walk', kind: 'path' };
  }
  if (sub === 'crossing') return { class: 'walk', kind: 'crossing' };
  if (sub === 'sidewalk' || sub === 'footway') return { class: 'walk', kind: 'path' };
  if (kind === 'motorway') return { class: 'road', kind: 'motorway' };
  if (kind === 'service') return { class: 'road', kind: 'service' };
  const bare = sub.replace(/_link$/, '');
  if (bare === 'trunk') return { class: 'road', kind: 'trunk' };
  if (bare === 'primary') return { class: 'road', kind: 'primary' };
  if (bare === 'secondary') return { class: 'road', kind: 'secondary' };
  if (bare === 'tertiary') return { class: 'road', kind: 'tertiary' };
  if (/living|pedestrian/.test(bare)) return { class: 'road', kind: 'living' };
  if (/track|construction|proposed|raceway/.test(bare)) return undefined;
  return { class: 'road', kind: 'street' };
}

/**
 * Clip a polyline to an axis-aligned rectangle, returning the visible pieces (a line that leaves
 * and re-enters the tile yields several pieces).
 */
export function clipPolyline(
  points: readonly Point2[],
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): Point2[][] {
  const pieces: Point2[][] = [];
  let current: Point2[] | undefined;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point2;
    const b = points[i] as Point2;
    const clipped = clipSegment(a, b, minX, minZ, maxX, maxZ);
    if (clipped === undefined) {
      current = undefined;
      continue;
    }
    const [p, q, enteredInside, leftInside] = clipped;
    if (current === undefined || !enteredInside) {
      current = [p];
      pieces.push(current);
    }
    const last = current[current.length - 1] as Point2;
    if (last[0] !== p[0] || last[1] !== p[1]) current.push(p);
    current.push(q);
    if (!leftInside) current = undefined;
  }
  return pieces.filter((piece) => piece.length >= 2);
}

/** Liang–Barsky: the visible part of a segment and whether it starts/ends at the original points. */
function clipSegment(
  a: Point2,
  b: Point2,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): [Point2, Point2, boolean, boolean] | undefined {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a[0] - minX],
    [dx, maxX - a[0]],
    [-dz, a[1] - minZ],
    [dz, maxZ - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return undefined;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return undefined;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return undefined;
      if (r < t1) t1 = r;
    }
  }
  if (t1 - t0 <= 0 && !(t0 === 0 && t1 === 0 && dx === 0 && dz === 0)) return undefined;
  const p: Point2 = t0 === 0 ? [a[0], a[1]] : [a[0] + dx * t0, a[1] + dz * t0];
  const q: Point2 = t1 === 1 ? [b[0], b[1]] : [a[0] + dx * t1, a[1] + dz * t1];
  // Snap cut points exactly onto the boundary so neighbouring tiles agree.
  if (t0 > 0) snapToBoundary(p, minX, minZ, maxX, maxZ);
  if (t1 < 1) snapToBoundary(q, minX, minZ, maxX, maxZ);
  return [p, q, t0 === 0, t1 === 1];
}

function snapToBoundary(p: Point2, minX: number, minZ: number, maxX: number, maxZ: number): void {
  const eps = 1e-6;
  if (dmath.abs(p[0] - minX) < eps) p[0] = minX;
  else if (dmath.abs(p[0] - maxX) < eps) p[0] = maxX;
  if (dmath.abs(p[1] - minZ) < eps) p[1] = minZ;
  else if (dmath.abs(p[1] - maxZ) < eps) p[1] = maxZ;
}

/** Road lanes per direction for a feature, clamped so no lane is narrower than 2.5 m. */
export function roadLanes(
  feature: { lanes?: number; oneway?: boolean },
  width: number,
): { total: number } {
  let total = inferLaneCount(feature as TerrainTransportationFeature, width);
  const minimum = feature.oneway === true ? 1 : 2;
  if (width / total < 2.5) total = dmath.max(minimum, dmath.floor(width / 2.5));
  if (feature.oneway === true && feature.lanes === undefined)
    total = dmath.max(1, dmath.min(total, dmath.round(width / 3.3)));
  return { total: dmath.max(minimum, total) };
}

export interface TileDraftInput {
  origin: readonly [number, number];
  tileSize: number;
  features: readonly TerrainTransportationFeature[];
}

export interface TileDrafts {
  drafts: EdgeDraft[];
  runways: { a: Point2; b: Point2 }[];
}

/** Convert a tile's transportation features to clipped world-metre drafts. */
export function featureDrafts(input: TileDraftInput, options: FeatureDraftOptions): TileDrafts {
  const { origin, tileSize } = input;
  const minX = origin[0];
  const minZ = origin[1];
  const maxX = origin[0] + tileSize;
  const maxZ = origin[1] + tileSize;
  const drafts: EdgeDraft[] = [];
  const runways: { a: Point2; b: Point2 }[] = [];
  const toWorld = (line: TerrainSemanticLine): Point2[] =>
    line.map((p) => [origin[0] + p[0] * tileSize, origin[1] + p[1] * tileSize] as Point2);
  for (const feature of groupTransportationFeatures(input.features)) {
    const classified = classifyFeature(feature);
    if (classified === undefined) continue;
    if (classified === 'runway') {
      for (const line of feature.lines) {
        const world = toWorld(line);
        if (world.length >= 2)
          runways.push({ a: world[0] as Point2, b: world[world.length - 1] as Point2 });
      }
      continue;
    }
    if (feature.tunnel === true && options.tunnels === 'skip') continue;
    const kind = transportKind(feature);
    const width =
      classified.class === 'walk'
        ? dmath.max(1.2, feature.width ?? 2.4)
        : classified.class === 'rail'
          ? 3
          : transportWidth(feature, kind);
    const lanes = classified.class === 'road' ? roadLanes(feature, width).total : 2;
    const link = isTransportLink(feature);
    for (const line of joinTerrainLines(feature.lines)) {
      for (const piece of clipPolyline(toWorld(line), minX, minZ, maxX, maxZ)) {
        const draft: EdgeDraft = {
          class: classified.class,
          kind: classified.kind,
          points: piece,
          width,
          lanes,
          oneway: feature.oneway === true && classified.class === 'road',
          layer: feature.layer ?? 0,
          bridge: feature.bridge === true,
          tunnel: feature.tunnel === true,
          link,
          ...(feature.name !== undefined ? { name: feature.name } : {}),
          ...(feature.deckElevation !== undefined ? { deckElevation: feature.deckElevation } : {}),
        };
        if (feature.bridgeConnections !== undefined && feature.bridgeConnections.length > 0)
          draft.bridgeConnections = feature.bridgeConnections.map((c) => ({
            point: [origin[0] + c.point[0] * tileSize, origin[1] + c.point[1] * tileSize],
            elevation: c.elevation,
            radius: c.radius,
          }));
        drafts.push(draft);
      }
    }
  }
  return { drafts, runways };
}

/** POIs in world metres, filtered to the kinds agents care about. */
export interface WorldPoi {
  kind:
    | 'station'
    | 'tram_stop'
    | 'bus_stop'
    | 'traffic_signals'
    | 'give_way'
    | 'crossing'
    | 'aerodrome';
  x: number;
  z: number;
  name?: string;
  /** Stations: dwell time in seconds. */
  dwell?: number;
}

const POI_KINDS: ReadonlySet<string> = new Set([
  'station',
  'tram_stop',
  'bus_stop',
  'traffic_signals',
  'crossing',
  'aerodrome',
]);

/** Convert a tile's POIs to world points (only those inside the tile). */
export function tilePois(
  pois: readonly TerrainPoiFeature[] | undefined,
  origin: readonly [number, number],
  tileSize: number,
): WorldPoi[] {
  const result: WorldPoi[] = [];
  for (const poi of pois ?? []) {
    const kind = (poi.subclass ?? poi.class).toLowerCase();
    const matched = POI_KINDS.has(kind) ? kind : POI_KINDS.has(poi.class) ? poi.class : undefined;
    if (matched === undefined) continue;
    const [u, v] = poi.point;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    result.push({
      kind: matched as WorldPoi['kind'],
      x: origin[0] + u * tileSize,
      z: origin[1] + v * tileSize,
      ...(poi.name !== undefined ? { name: poi.name } : {}),
    });
  }
  return result;
}
