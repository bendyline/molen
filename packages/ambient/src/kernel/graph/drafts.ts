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
  drivingSide?: 'right' | 'left';
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
  bridgeApproachProfile?: { point: Point2; elevation: number; flatness: number }[];
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
  ferry: 8,
  channel: 7,
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
  if (
    /^(aeroway|runway|taxiway|taxilane|parking_position)$/.test(cls) ||
    /^(runway|taxiway|taxilane|apron|parking_position)$/.test(sub)
  ) {
    return sub === 'runway' || cls === 'runway' ? 'runway' : undefined;
  }
  if (cls === 'ferry' || sub === 'ferry') return { class: 'water', kind: 'ferry' };
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
  /** World X/Z part of the tile to keep (see AmbientTileInput.bounds); default the whole tile. */
  bounds?: readonly [number, number, number, number];
}

/** Whether a point belongs to a tile part: half-open, so a point on a shared border has one. */
function inPart(bounds: readonly [number, number, number, number], x: number, z: number): boolean {
  return x >= bounds[0] && x < bounds[2] && z >= bounds[1] && z < bounds[3];
}

export interface TileDrafts {
  drafts: EdgeDraft[];
  runways: { a: Point2; b: Point2 }[];
}

/** A feature's draft fields and its joined lines in world metres, before any clipping. */
interface PreparedFeature {
  draft: Omit<EdgeDraft, 'points'>;
  /**
   * World bounds of each source line (4 numbers a line) and of them all, made when a part first
   * asks. A group of like features (every unnamed street) spans the tile; a part joins only the
   * lines that reach it, where joining all of them was most of a dense tile's first part.
   */
  boxes?: Float64Array;
  box?: [number, number, number, number];
  source: TerrainTransportationFeature;
}

function worldBox(
  points: readonly (readonly [number, number])[],
): [number, number, number, number] {
  const box: [number, number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const [x, z] of points) {
    box[0] = dmath.min(box[0], x);
    box[1] = dmath.min(box[1], z);
    box[2] = dmath.max(box[2], x);
    box[3] = dmath.max(box[3], z);
  }
  return box;
}

interface PreparedTile {
  origin: readonly [number, number];
  tileSize: number;
  tunnels: FeatureDraftOptions['tunnels'];
  features: PreparedFeature[];
  runways: { a: Point2; b: Point2 }[];
  /**
   * Feature positions by cell of a PART_CELLS x PART_CELLS grid over the tile (by their boxes,
   * edges clamped), made when a part first asks: every part of a dense tile tested every one of
   * its features against its bounds.
   */
  cells?: number[][];
}

const PART_CELLS = 16;

/**
 * Joined world lines per features list: a tile registered in parts (AmbientTileInput.bounds)
 * grouped and joined all its lines again for every part, most of a part's drafting time.
 */
const preparedTiles = new WeakMap<readonly TerrainTransportationFeature[], PreparedTile>();

function prepareTile(input: TileDraftInput, options: FeatureDraftOptions): PreparedTile {
  const { origin, tileSize } = input;
  const cached = preparedTiles.get(input.features);
  if (
    cached !== undefined &&
    cached.origin[0] === origin[0] &&
    cached.origin[1] === origin[1] &&
    cached.tileSize === tileSize &&
    cached.tunnels === options.tunnels
  )
    return cached;
  const toWorld = (line: TerrainSemanticLine): Point2[] =>
    line.map((p) => [origin[0] + p[0] * tileSize, origin[1] + p[1] * tileSize] as Point2);
  const features: PreparedFeature[] = [];
  const runways: { a: Point2; b: Point2 }[] = [];
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
      classified.class === 'water'
        ? (feature.width ?? 60)
        : classified.class === 'walk'
          ? dmath.max(1.2, feature.width ?? 2.4)
          : classified.class === 'rail'
            ? 3
            : transportWidth(feature, kind);
    const lanes = classified.class === 'road' ? roadLanes(feature, width).total : 2;
    const draft: Omit<EdgeDraft, 'points'> = {
      class: classified.class,
      kind: classified.kind,
      width,
      lanes,
      oneway:
        feature.oneway === true && (classified.class === 'road' || classified.class === 'water'),
      layer: feature.layer ?? 0,
      bridge: feature.bridge === true,
      tunnel: feature.tunnel === true,
      link: isTransportLink(feature),
      ...(feature.name !== undefined ? { name: feature.name } : {}),
      ...(feature.deckElevation !== undefined ? { deckElevation: feature.deckElevation } : {}),
    };
    if (feature.bridgeConnections !== undefined && feature.bridgeConnections.length > 0)
      draft.bridgeConnections = feature.bridgeConnections.map((c) => ({
        point: [origin[0] + c.point[0] * tileSize, origin[1] + c.point[1] * tileSize],
        elevation: c.elevation,
        radius: c.radius,
      }));
    if (feature.bridgeApproachProfile?.length)
      draft.bridgeApproachProfile = feature.bridgeApproachProfile.map((sample) => ({
        ...sample,
        point: [origin[0] + sample.point[0] * tileSize, origin[1] + sample.point[1] * tileSize],
      }));
    features.push({ draft, source: feature });
  }
  const prepared = { origin, tileSize, tunnels: options.tunnels, features, runways };
  preparedTiles.set(input.features, prepared);
  return prepared;
}

/** World bounds of each of a feature's source lines and of them all (see PreparedFeature). */
function lineBoxes(feature: PreparedFeature, origin: readonly [number, number], tileSize: number) {
  if (feature.boxes !== undefined) return;
  const source = feature.source.lines;
  const boxes = new Float64Array(source.length * 4);
  const all: [number, number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  source.forEach((line, i) => {
    const box = worldBox(line);
    boxes[i * 4] = origin[0] + box[0] * tileSize;
    boxes[i * 4 + 1] = origin[1] + box[1] * tileSize;
    boxes[i * 4 + 2] = origin[0] + box[2] * tileSize;
    boxes[i * 4 + 3] = origin[1] + box[3] * tileSize;
    all[0] = dmath.min(all[0], boxes[i * 4] as number);
    all[1] = dmath.min(all[1], boxes[i * 4 + 1] as number);
    all[2] = dmath.max(all[2], boxes[i * 4 + 2] as number);
    all[3] = dmath.max(all[3], boxes[i * 4 + 3] as number);
  });
  feature.boxes = boxes;
  feature.box = all;
}

/**
 * The prepared features whose boxes may reach a part, in their order (every one for a whole
 * tile), boxes made. Each still checks its own box against the part.
 */
function partFeatures(
  prepared: PreparedTile,
  origin: readonly [number, number],
  tileSize: number,
  bounds: readonly [number, number, number, number] | undefined,
): PreparedFeature[] {
  const cell = (value: number, start: number): number =>
    dmath.clamp(dmath.floor(((value - start) / tileSize) * PART_CELLS), 0, PART_CELLS - 1);
  if (bounds === undefined) {
    for (const feature of prepared.features) lineBoxes(feature, origin, tileSize);
    return prepared.features;
  }
  let cells = prepared.cells;
  if (cells === undefined) {
    const made: number[][] = Array.from({ length: PART_CELLS * PART_CELLS }, () => []);
    prepared.features.forEach((feature, index) => {
      lineBoxes(feature, origin, tileSize);
      const [x0, z0, x1, z1] = feature.box as [number, number, number, number];
      for (let row = cell(z0, origin[1]); row <= cell(z1, origin[1]); row++)
        for (let col = cell(x0, origin[0]); col <= cell(x1, origin[0]); col++)
          (made[row * PART_CELLS + col] as number[]).push(index);
    });
    prepared.cells = made;
    cells = made;
  }
  const picked = new Set<number>();
  for (let row = cell(bounds[1], origin[1]); row <= cell(bounds[3], origin[1]); row++)
    for (let col = cell(bounds[0], origin[0]); col <= cell(bounds[2], origin[0]); col++)
      for (const index of cells[row * PART_CELLS + col] as number[]) picked.add(index);
  return [...picked]
    .sort((a, b) => a - b)
    .map((index) => prepared.features[index] as PreparedFeature);
}

/** Convert a tile's transportation features to clipped world-metre drafts. */
export function featureDrafts(input: TileDraftInput, options: FeatureDraftOptions): TileDrafts {
  const { origin, tileSize, bounds } = input;
  const minX = bounds?.[0] ?? origin[0];
  const minZ = bounds?.[1] ?? origin[1];
  const maxX = bounds?.[2] ?? origin[0] + tileSize;
  const maxZ = bounds?.[3] ?? origin[1] + tileSize;
  const prepared = prepareTile(input, options);
  const drafts: EdgeDraft[] = [];
  // Unclipped: a part keeps the runways whose midpoint it holds.
  const runways = prepared.runways
    .filter(({ a, b }) => !bounds || inPart(bounds, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
    .map(({ a, b }) => ({ a: [a[0], a[1]] as Point2, b: [b[0], b[1]] as Point2 }));
  for (const feature of partFeatures(prepared, origin, tileSize, bounds)) {
    const source = feature.source.lines;
    const reach = feature.box as [number, number, number, number];
    if (reach[2] < minX || reach[0] > maxX || reach[3] < minZ || reach[1] > maxZ) continue;
    const boxes = feature.boxes as Float64Array;
    const reaching = source.filter(
      (_, i) =>
        !(
          (boxes[i * 4 + 2] as number) < minX ||
          (boxes[i * 4] as number) > maxX ||
          (boxes[i * 4 + 3] as number) < minZ ||
          (boxes[i * 4 + 1] as number) > maxZ
        ),
    );
    if (!reaching.length) continue;
    const draft = feature.draft;
    for (const line of joinTerrainLines(reaching, feature.source.oneway === true)) {
      const points = line.map(
        (p) => [origin[0] + p[0] * tileSize, origin[1] + p[1] * tileSize] as Point2,
      );
      for (const piece of clipPolyline(points, minX, minZ, maxX, maxZ))
        drafts.push({
          ...draft,
          // Fresh points and connections: the prepared lines are shared by every part.
          points: piece.map((p) => [p[0], p[1]] as Point2),
          ...(draft.bridgeConnections !== undefined
            ? {
                bridgeConnections: draft.bridgeConnections.map((c) => ({
                  ...c,
                  point: [c.point[0], c.point[1]] as Point2,
                })),
              }
            : {}),
          ...(draft.bridgeApproachProfile !== undefined
            ? {
                bridgeApproachProfile: draft.bridgeApproachProfile.map((sample) => ({
                  ...sample,
                  point: [sample.point[0], sample.point[1]] as Point2,
                })),
              }
            : {}),
        });
    }
  }
  return { drafts, runways };
}

/** POIs in world metres, filtered to the kinds agents care about. */
export interface WorldPoi {
  kind:
    | 'ferry_terminal'
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
  allWay?: boolean;
  layer?: number;
}

const POI_KINDS: ReadonlySet<string> = new Set([
  'ferry_terminal',
  'station',
  'tram_stop',
  'bus_stop',
  'traffic_signals',
  'give_way',
  'stop',
  'crossing',
  'aerodrome',
]);

/** Convert a tile's POIs to world points (only those inside the tile). */
/**
 * A tile's POIs matched and placed once: a tile registered in parts read and matched every one of
 * them again for each part.
 */
const placedPois = new WeakMap<
  readonly TerrainPoiFeature[],
  { origin: [number, number]; tileSize: number; pois: WorldPoi[] }
>();

export function tilePois(
  pois: readonly TerrainPoiFeature[] | undefined,
  origin: readonly [number, number],
  tileSize: number,
  bounds?: readonly [number, number, number, number],
): WorldPoi[] {
  if (pois === undefined) return [];
  let placed = placedPois.get(pois);
  if (
    placed === undefined ||
    placed.origin[0] !== origin[0] ||
    placed.origin[1] !== origin[1] ||
    placed.tileSize !== tileSize
  ) {
    const all: WorldPoi[] = [];
    for (const poi of pois) {
      const kind = (poi.subclass ?? poi.class).toLowerCase();
      const matched = POI_KINDS.has(kind) ? kind : POI_KINDS.has(poi.class) ? poi.class : undefined;
      if (matched === undefined) continue;
      if (['traffic_signals', 'stop', 'give_way'].includes(matched) && (poi.bridge || poi.tunnel))
        continue;
      const [u, v] = poi.point;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      all.push({
        kind: (matched === 'stop' ? 'give_way' : matched) as WorldPoi['kind'],
        x: origin[0] + u * tileSize,
        z: origin[1] + v * tileSize,
        ...(poi.name !== undefined ? { name: poi.name } : {}),
        ...(poi.stop === 'all' ? { allWay: true } : {}),
        layer: poi.layer ?? 0,
      });
    }
    placed = { origin: [origin[0], origin[1]], tileSize, pois: all };
    placedPois.set(pois, placed);
  }
  // Copies: the network forgets a part's signals by identity.
  const result: WorldPoi[] = [];
  for (const poi of placed.pois)
    if (!bounds || inPart(bounds, poi.x, poi.z)) result.push({ ...poi });
  return result;
}
