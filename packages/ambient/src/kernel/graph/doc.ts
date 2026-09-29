/**
 * molen/transport-network@1 documents: hand-authored or baked networks for scenes without
 * streamed map tiles. A document is a list of ways (polylines with a class and tags); ways that
 * share a vertex, cross at the same grade or end on one another connect automatically.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import { roadWidth } from '@bendyline/molen-terrain/kernel';
import { type EdgeDraft, type Point2, roadLanes, type WorldPoi } from './drafts';
import type { RoadKind } from './types';

export const TRANSPORT_NETWORK_FORMAT: 'molen/transport-network@1' = 'molen/transport-network@1';

/** A way's point: `[x, z]` or `[x, y, z]` in scene metres. */
export type TransportNetworkPoint = [number, number] | [number, number, number];

export interface TransportNetworkWay {
  id?: string;
  class: 'road' | 'rail' | 'path' | 'air';
  subclass?: string;
  points: TransportNetworkPoint[];
  oneway?: boolean;
  lanes?: number;
  width?: number;
  layer?: number;
  speed?: number;
  bridge?: boolean;
  tunnel?: boolean;
  name?: string;
}

export interface TransportNetworkStation {
  id: string;
  at: [number, number];
  kind: 'rail' | 'bus';
  dwell?: number;
}

export interface TransportNetworkSignal {
  at: [number, number];
  kind: 'stop' | 'yield' | 'light';
}

export interface TransportNetworkAerodrome {
  id: string;
  at: [number, number];
  /** Runway heading in radians about +Y (0 = +Z). */
  heading?: number;
  /** Runway length in metres (default 2500). */
  length?: number;
}

export interface TransportNetworkDocument {
  format: 'molen/transport-network@1';
  name?: string;
  origin?: { latitude: number; longitude: number } | { x: number; z: number };
  drivingSide?: 'right' | 'left';
  /** Infer sidewalks (walk lanes) along streets without mapped paths (default false). */
  sidewalks?: boolean;
  ways: TransportNetworkWay[];
  stations?: TransportNetworkStation[];
  signals?: TransportNetworkSignal[];
  aerodromes?: TransportNetworkAerodrome[];
}

const ROAD_KINDS: ReadonlySet<string> = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'street',
  'living',
  'service',
]);

function roadKindOf(subclass: string | undefined): RoadKind {
  const bare = (subclass ?? '').replace(/_link$/, '');
  if (ROAD_KINDS.has(bare)) return bare as RoadKind;
  if (bare === 'living_street') return 'living';
  return 'street';
}

/** One way → one draft (air ways are skipped: aircraft fly corridors, not lanes). */
export function wayDraft(way: TransportNetworkWay): EdgeDraft | undefined {
  if (way.class === 'air' || way.points.length < 2) return undefined;
  const points: Point2[] = way.points.map((p) => (p.length === 3 ? [p[0], p[2]] : [p[0], p[1]]));
  const heights = way.points.every((p) => p.length === 3)
    ? way.points.map((p) => (p as [number, number, number])[1])
    : undefined;
  const common = {
    points,
    ...(heights !== undefined ? { heights } : {}),
    layer: way.layer ?? 0,
    bridge: way.bridge === true,
    tunnel: way.tunnel === true,
    link: /_link$/.test(way.subclass ?? ''),
    ...(way.speed !== undefined ? { speed: way.speed } : {}),
    ...(way.name !== undefined ? { name: way.name } : {}),
  };
  if (way.class === 'rail')
    return {
      ...common,
      class: 'rail',
      kind: way.subclass === 'tram' ? 'tram' : 'rail',
      width: way.width ?? 3,
      lanes: 2,
      oneway: false,
    };
  if (way.class === 'path')
    return {
      ...common,
      class: 'walk',
      kind: way.subclass === 'crossing' ? 'crossing' : 'path',
      width: way.width ?? 2.4,
      lanes: 2,
      oneway: false,
    };
  const kind = roadKindOf(way.subclass);
  const width = dmath.min(80, way.width ?? roadWidth(way.subclass ?? 'residential'));
  const lanes = roadLanes(
    { ...(way.lanes !== undefined ? { lanes: way.lanes } : {}), oneway: way.oneway === true },
    width,
  ).total;
  return { ...common, class: 'road', kind, width, lanes, oneway: way.oneway === true };
}

/** Stations and signals as points of interest. */
export function documentPois(doc: TransportNetworkDocument): WorldPoi[] {
  const pois: WorldPoi[] = [];
  for (const station of doc.stations ?? [])
    pois.push({
      kind: station.kind === 'rail' ? 'station' : 'bus_stop',
      x: station.at[0],
      z: station.at[1],
      name: station.id,
      ...(station.dwell !== undefined ? { dwell: station.dwell } : {}),
    });
  for (const signal of doc.signals ?? [])
    pois.push({
      kind: signal.kind === 'light' ? 'traffic_signals' : 'give_way',
      x: signal.at[0],
      z: signal.at[1],
    });
  for (const aerodrome of doc.aerodromes ?? [])
    pois.push({ kind: 'aerodrome', x: aerodrome.at[0], z: aerodrome.at[1], name: aerodrome.id });
  return pois;
}

/** Aerodrome runways as segments. */
export function documentRunways(doc: TransportNetworkDocument): { a: Point2; b: Point2 }[] {
  return (doc.aerodromes ?? []).map((aerodrome) => {
    const heading = aerodrome.heading ?? 0;
    const half = (aerodrome.length ?? 2500) / 2;
    const dx = dmath.sin(heading) * half;
    const dz = dmath.cos(heading) * half;
    return {
      a: [aerodrome.at[0] - dx, aerodrome.at[1] - dz],
      b: [aerodrome.at[0] + dx, aerodrome.at[1] + dz],
    };
  });
}

export const TRANSPORT_NETWORK_EXAMPLE: TransportNetworkDocument = {
  format: TRANSPORT_NETWORK_FORMAT,
  name: 'crossroads',
  drivingSide: 'right',
  ways: [
    {
      id: 'main',
      class: 'road',
      subclass: 'primary',
      points: [
        [-200, 0],
        [200, 0],
      ],
      lanes: 4,
    },
    {
      id: 'cross',
      class: 'road',
      subclass: 'residential',
      points: [
        [0, -200],
        [0, 200],
      ],
    },
    {
      id: 'tram',
      class: 'rail',
      subclass: 'tram',
      points: [
        [-200, 30],
        [200, 30],
      ],
    },
  ],
  stations: [{ id: 'central', at: [0, 30], kind: 'rail' }],
  signals: [{ at: [0, 0], kind: 'light' }],
};
