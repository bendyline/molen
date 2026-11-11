/**
 * The railway network of an Earth view, for trains that run on it: every streamed human-features
 * tile hands its live rail lines to a kernel {@link TrackNetwork} (one group per tile, ranked by
 * the tile's level so a finer tile's copy of a track wins), and its stations and platforms to a
 * list of places trains stop.
 */
import { type TrackLineInput, TrackNetwork } from '@bendyline/molen-kernel/vehicles';
import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/client';
import { TERRAIN_RAIL_HEIGHT, transportKind } from '@bendyline/molen-terrain/kernel';
import type * as THREE from 'three';
import type { SemanticTileObserver } from './ambient-tiles';

/** Mapped railways that carry no trains (or are not running track at all). */
const NOT_LIVE =
  /^(disused|abandoned|razed|dismantled|construction|proposed|planned|station|platform|miniature|historic)$/;
/** Station-like places trains stop at. */
const STOP_KINDS = /^(station|halt|train_station|tram_stop|stop_position|platform)$/;

/**
 * Rail-head height above the ballast surface the terrain draws on a track (what a vehicle's
 * support probe meets between the rails), meters: the terrain's own rail height.
 */
export const EARTH_RAIL_TOP: number = TERRAIN_RAIL_HEIGHT;

/** Tags each track line carries in the network. */
export interface EarthTrackTags {
  /** OSM railway kind: `rail`, `light_rail`, `tram`, `subway`, `narrow_gauge`... */
  detail: string;
  /** OSM service: `yard`, `siding`, `spur`, `crossover`, or empty for a running line. */
  service: string;
  name: string;
  ref: string;
  bridge: string;
}

/** A place on the network where passenger trains stop. */
export interface EarthRailStop {
  x: number;
  z: number;
  name: string;
}

/** Light rail and street running (electric, short trains), as opposed to heavy rail. */
export function isLightRailTrack(tags: Readonly<Record<string, string>>): boolean {
  return /^(light_rail|tram|subway|monorail|funicular)$/.test(tags.detail ?? '');
}
/** A running line (not a yard, siding, spur or crossover). */
export function isRunningTrack(tags: Readonly<Record<string, string>>): boolean {
  return !tags.service;
}

export class EarthRailNetwork implements SemanticTileObserver {
  /** The live tracks, as a track guide for rail vehicles. */
  readonly network: TrackNetwork & { readonly railTop: number };
  private readonly groups = new Map<THREE.Object3D, string>();
  private readonly stops = new Map<string, EarthRailStop[]>();
  private sequence = 0;

  constructor() {
    this.network = Object.assign(new TrackNetwork(), { railTop: EARTH_RAIL_TOP });
  }

  added(
    object: THREE.Object3D,
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): void {
    const group = this.groups.get(object) ?? `rail-${++this.sequence}`;
    this.groups.set(object, group);
    const [ox, oz] = context.origin;
    const size = context.tileSize;
    const lines: TrackLineInput[] = [];
    for (const feature of tile.transportation) {
      if (transportKind(feature) !== 'rail' || feature.tunnel) continue;
      const detail = feature.subclass ?? feature.class;
      if (NOT_LIVE.test(detail) || NOT_LIVE.test(feature.service ?? '')) continue;
      const tags: EarthTrackTags = {
        detail,
        service: feature.service ?? '',
        name: feature.name ?? '',
        ref: feature.ref ?? '',
        bridge: feature.bridge ? '1' : '',
      };
      for (const line of feature.lines)
        lines.push({
          points: line.map(([u, v]) => [ox + u * size, oz + v * size] as const),
          rank: context.address.level,
          tags: tags as unknown as Record<string, string>,
        });
    }
    this.network.set(group, lines);
    const stops: EarthRailStop[] = [];
    for (const poi of tile.pois ?? []) {
      if (!STOP_KINDS.test(poi.class)) continue;
      stops.push({
        x: ox + poi.point[0] * size,
        z: oz + poi.point[1] * size,
        name: poi.name ?? '',
      });
    }
    for (const cover of tile.landcover) {
      if ((cover.subclass ?? cover.class) !== 'platform' && cover.class !== 'platform') continue;
      for (const polygon of cover.polygons) {
        let x = 0,
          z = 0;
        for (const [u, v] of polygon.outer) {
          x += ox + u * size;
          z += oz + v * size;
        }
        const n = polygon.outer.length || 1;
        stops.push({ x: x / n, z: z / n, name: '' });
      }
    }
    if (stops.length) this.stops.set(group, stops);
    else this.stops.delete(group);
  }

  removed(object: THREE.Object3D): void {
    const group = this.groups.get(object);
    if (group === undefined) return;
    this.groups.delete(object);
    this.network.delete(group);
    this.stops.delete(group);
  }

  /** Stations and platforms within `radius` of X/Z, nearest first. */
  stopsNear(x: number, z: number, radius: number): EarthRailStop[] {
    const found: EarthRailStop[] = [];
    for (const list of this.stops.values())
      for (const stop of list)
        if (Math.hypot(stop.x - x, stop.z - z) <= radius && !found.some((s) => near(s, stop)))
          found.push(stop);
    return found.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  }

  /** Forget every tile. */
  clear(): void {
    this.network.clear();
    this.stops.clear();
    this.groups.clear();
  }
}

/** The same stop seen in two tiles (or as a node and a platform): within 30 m. */
function near(a: EarthRailStop, b: EarthRailStop): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) < 30;
}
