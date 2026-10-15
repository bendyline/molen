// Runways and aerodromes an Earth view knows about, as geographic places. `EarthAirfields` is a
// facade over the ambient layer's transport network: the network keeps mapped runways
// (`TransportRunway`, two world-metre endpoints and a surface height) and `aerodrome` points of
// interest for the tiles it has registered, and this class turns them into stable ids, compass
// headings, geodesic lengths and ready-made placements (a threshold to take off from, a spot
// beside it to park) that a host can hand to `EarthAircraft` or a figure spawner.
//
// Everything a host gets back is latitude/longitude plus a compass heading in radians: the view's
// metric world frame re-anchors as the camera travels, so world coordinates go stale, while ids
// and places do not. Ids hash the geographic endpoints rounded to 1e-5°, so a runway keeps its id
// when its tile is evicted and streams back in, or when the world origin moves.
//
// The class is built against injected callbacks (`EarthAirfieldsSource`) rather than a view, so
// `mountEarthView` wires it as `view.airfields` and tests drive it with a fake network. Runways
// exist only for tiles the ambient layer has registered: those within its activity radius plus a
// margin of the viewer. A host that wants an airport's runways moves the camera there first and
// waits with `whenNear`, which resolves as tiles arrive (the owner calls `tick()` on its sync).
// The network carries no aprons or taxiways, so `beside` is a parking approximation: a point a
// fixed distance to the right of the threshold.

import type { TransportRunway } from '@bendyline/molen-ambient/kernel';

/** A geographic place, optionally facing a compass heading (radians, 0 north, clockwise). */
export interface EarthPlace {
  latitude: number;
  longitude: number;
  heading?: number;
}

/** The aerodrome a runway belongs to: the nearest `aerodrome` point of interest. */
export interface EarthAerodrome {
  name?: string;
  latitude: number;
  longitude: number;
}

/** One mapped runway, in geographic terms. */
export interface EarthRunway {
  /**
   * Stable across tile reloads and re-anchors: `runway:<hash>` of the two endpoints rounded to
   * 1e-5° (about a metre), in mapped order. A runway crossing a tile edge appears once per tile,
   * each piece with its own id.
   */
  id: string;
  /** The mapped endpoints, `a` then `b`. */
  ends: [EarthPlace, EarthPlace];
  /** Compass bearing from `a` to `b`, radians. */
  heading: number;
  /** Geodesic length in metres. */
  length: number;
  /** Runway surface, metres above sea level. */
  elevation: number;
  /** The nearest aerodrome point of interest within 3 km of the midpoint, when one is mapped. */
  aerodrome?: EarthAerodrome;
  /** Surface material, only when the network exposes one (it does not today). */
  surface?: string;
}

/** An aerodrome point of interest in the network's world frame. */
export interface EarthAerodromePoi {
  x: number;
  z: number;
  name?: string;
}

/**
 * What `EarthAirfields` reads: the ambient network's runways and aerodromes as they are now, a
 * version that changes when they do, and the view's conversion between its metric world frame
 * and geographic coordinates.
 */
export interface EarthAirfieldsSource {
  /** Runways of the tiles registered now (`TransportNetwork.runways()`). */
  runways(): readonly (TransportRunway & { surface?: string })[];
  /** Aerodrome points of interest of the tiles registered now (`TransportNetwork.aerodromes()`). */
  aerodromes(): readonly EarthAerodromePoi[];
  /**
   * Changes whenever `runways()` may have changed: the network's `version`, or a counter the
   * owner bumps per tile registration. `tick()` re-checks `whenNear` waiters only when it moved.
   */
  version(): number;
  /** World X/Z (metres) to latitude/longitude, in the view's current anchoring. */
  toGeo(x: number, z: number): { latitude: number; longitude: number };
  /** Latitude/longitude to world X/Z (metres), the inverse of `toGeo`. */
  toWorld(latitude: number, longitude: number): [number, number];
  /**
   * Metres above sea level at world `(x, z)`, given the network's surface height `y` there.
   * Default: `y` itself. An owner whose world Y is offset from sea level, or who wants the
   * terrain sampled at a placement, supplies this.
   */
  toElevation?(x: number, z: number, y: number): number;
}

/** Where on a runway to place something. */
export type EarthRunwayPlacement = 'threshold' | 'midpoint' | 'beside';

export interface EarthRunwayPlacementOptions {
  /** Which end the threshold is measured from (default `a`). */
  end?: 'a' | 'b';
  /** For `beside`: metres to the right of the runway direction (default 40). */
  offsetM?: number;
}

export interface EarthWhenNearOptions {
  /** Runways whose midpoint lies within this many metres count. */
  radiusM: number;
  /** Resolve with `[]` after this long (default 20 000 ms; a non-finite value waits forever). */
  timeoutMs?: number;
  /** Rejects the wait. */
  signal?: AbortSignal;
}

/** Metres a threshold placement sits in from the runway end. */
export const RUNWAY_THRESHOLD_INSET_M = 60;
/** Default metres a `beside` placement sits to the right of the threshold. */
export const RUNWAY_BESIDE_OFFSET_M = 40;
/** How far from a runway's midpoint an aerodrome point of interest may be and still be its own. */
export const AERODROME_MATCH_RADIUS_M = 3_000;
const DEFAULT_WHEN_NEAR_TIMEOUT_MS = 20_000;

// --- geodesic helpers (spherical earth, metres and radians) ---

const EARTH_RADIUS_M = 6_371_008.8;
const RAD = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

/** Wrap a bearing into [0, 2π). */
export function normalizeBearing(radians: number): number {
  const wrapped = radians % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

/** Great-circle distance in metres between two places. */
export function haversineDistance(a: EarthPlace, b: EarthPlace): number {
  const lat1 = a.latitude * RAD;
  const lat2 = b.latitude * RAD;
  const dLat = lat2 - lat1;
  const dLng = (b.longitude - a.longitude) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from `from` toward `to`, radians in [0, 2π). */
export function compassBearing(from: EarthPlace, to: EarthPlace): number {
  const lat1 = from.latitude * RAD;
  const lat2 = to.latitude * RAD;
  const dLng = (to.longitude - from.longitude) * RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeBearing(Math.atan2(y, x));
}

/** The place `distance` metres from `from` along a compass `bearing` (radians). */
export function destinationPoint(from: EarthPlace, bearing: number, distance: number): EarthPlace {
  const delta = distance / EARTH_RADIUS_M;
  const lat1 = from.latitude * RAD;
  const lng1 = from.longitude * RAD;
  const sinLat2 =
    Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(bearing);
  const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * sinLat2,
    );
  const longitude = ((lng2 / RAD + 540) % 360) - 180;
  return { latitude: lat2 / RAD, longitude };
}

/** FNV-1a 32-bit hash of a string. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A runway's id from its geographic endpoints: `runway:<hash>` over both rounded to 1e-5°, in
 * the given order. Independent of the world frame, so it survives re-anchoring and tile reloads.
 */
export function runwayId(a: EarthPlace, b: EarthPlace): string {
  const text = [a.latitude, a.longitude, b.latitude, b.longitude]
    .map((value) => String(Math.round(value * 1e5)))
    .join(',');
  return `runway:${fnv1a(text).toString(36)}`;
}

/** The runway's centre, halfway from `a` toward `b`. */
export function runwayMidpoint(runway: EarthRunway): EarthPlace {
  return destinationPoint(runway.ends[0], runway.heading, runway.length / 2);
}

/**
 * A placement on `runway`, geographically. `threshold`: `RUNWAY_THRESHOLD_INSET_M` in from end
 * `a` (or `b`), facing down the runway toward the other end. `midpoint`: the centre, facing from
 * `a` to `b`. `beside`: the threshold moved `offsetM` to the right of the runway direction,
 * facing parallel to it (a parking approximation; the network has no aprons). The elevation is
 * the runway's unless `elevationAt` samples the spot.
 */
export function runwayPlacement(
  runway: EarthRunway,
  where: EarthRunwayPlacement,
  options: EarthRunwayPlacementOptions = {},
  elevationAt: (place: EarthPlace) => number = () => runway.elevation,
): EarthPlace & { elevation: number } {
  const [a, b] = runway.ends;
  if (where === 'midpoint') {
    const centre = runwayMidpoint(runway);
    return { ...centre, heading: runway.heading, elevation: elevationAt(centre) };
  }
  const fromA = (options.end ?? 'a') === 'a';
  const start = fromA ? a : b;
  const heading = fromA ? runway.heading : compassBearing(b, a);
  const inset = Math.min(RUNWAY_THRESHOLD_INSET_M, runway.length / 2);
  const threshold = destinationPoint(start, heading, inset);
  if (where === 'threshold') return { ...threshold, heading, elevation: elevationAt(threshold) };
  const offset = options.offsetM ?? RUNWAY_BESIDE_OFFSET_M;
  const beside = destinationPoint(threshold, heading + Math.PI / 2, offset);
  return { ...beside, heading, elevation: elevationAt(beside) };
}

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

interface Waiter {
  latitude: number;
  longitude: number;
  radiusM: number;
  resolve(runways: EarthRunway[]): void;
  reject(reason: unknown): void;
}

/**
 * Runways near a place, as the ambient network knows them now, and placements on them. See the
 * file comment for what is and is not stable. Construct one per view and `dispose()` with it.
 */
export class EarthAirfields {
  private readonly source: EarthAirfieldsSource;
  private readonly waiters = new Set<Waiter>();
  private seenVersion: number;
  private disposed = false;

  constructor(source: EarthAirfieldsSource) {
    this.source = source;
    this.seenVersion = source.version();
  }

  /**
   * Runways whose midpoint lies within `radiusM` of the place, nearest first, from the tiles the
   * ambient layer has registered now. Empty until the airport's tiles are in reach of the viewer.
   */
  near(latitude: number, longitude: number, radiusM: number): EarthRunway[] {
    return nearIn(this.runways(), latitude, longitude, radiusM);
  }

  /**
   * Resolves with `near(...)` as soon as it is non-empty: at once when it already is, otherwise
   * on a later `tick()` after the network changed. Resolves with `[]` after `timeoutMs` (default
   * 20 s). Rejects only when `signal` aborts (with its reason) or the facade is disposed.
   */
  whenNear(
    latitude: number,
    longitude: number,
    options: EarthWhenNearOptions,
  ): Promise<EarthRunway[]> {
    const { radiusM, signal } = options;
    const timeoutMs = options.timeoutMs ?? DEFAULT_WHEN_NEAR_TIMEOUT_MS;
    if (this.disposed) return Promise.reject(abortError('EarthAirfields is disposed'));
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    const found = this.near(latitude, longitude, radiusM);
    if (found.length > 0) return Promise.resolve(found);
    return new Promise<EarthRunway[]>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = (): void => waiter.reject(abortReason(signal as AbortSignal));
      const cleanup = (): void => {
        this.waiters.delete(waiter);
        if (timer !== undefined) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      const waiter: Waiter = {
        latitude,
        longitude,
        radiusM,
        resolve: (runways) => {
          cleanup();
          resolve(runways);
        },
        reject: (reason) => {
          cleanup();
          reject(reason);
        },
      };
      if (Number.isFinite(timeoutMs)) timer = setTimeout(() => waiter.resolve([]), timeoutMs);
      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiters.add(waiter);
    });
  }

  /**
   * A place on the runway with that id (see `runwayPlacement`), or undefined when no registered
   * tile carries it any more.
   */
  placement(
    runwayId: string,
    where: EarthRunwayPlacement,
    options: EarthRunwayPlacementOptions = {},
  ): (EarthPlace & { elevation: number }) | undefined {
    const entry = this.snapshot().find((candidate) => candidate.runway.id === runwayId);
    if (entry === undefined) return undefined;
    const { runway, surfaceY } = entry;
    const source = this.source;
    const elevationAt =
      source.toElevation === undefined
        ? undefined
        : (place: EarthPlace): number => {
            // The spot's own world position, so an owner can sample the terrain there.
            const [x, z] = source.toWorld(place.latitude, place.longitude);
            return source.toElevation?.(x, z, surfaceY) ?? runway.elevation;
          };
    return runwayPlacement(runway, where, options, elevationAt);
  }

  /**
   * Called by the owner on its periodic sync (about every 200 ms): when the source's version
   * moved, pending `whenNear` waiters are checked against the runways known now.
   */
  tick(): void {
    if (this.disposed) return;
    const version = this.source.version();
    if (version === this.seenVersion) return;
    this.seenVersion = version;
    if (this.waiters.size === 0) return;
    const runways = this.runways();
    for (const waiter of [...this.waiters]) {
      const found = nearIn(runways, waiter.latitude, waiter.longitude, waiter.radiusM);
      if (found.length > 0) waiter.resolve(found);
    }
  }

  /** Rejects every pending `whenNear` (an `AbortError`) and ignores later calls. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const waiter of [...this.waiters]) waiter.reject(abortError('EarthAirfields is disposed'));
    this.waiters.clear();
  }

  /** Every runway the network holds now, geographically, one per id. */
  private runways(): EarthRunway[] {
    return this.snapshot().map((entry) => entry.runway);
  }

  /** The runways with the network's surface height each was read with (its raw world Y). */
  private snapshot(): { runway: EarthRunway; surfaceY: number }[] {
    if (this.disposed) return [];
    const source = this.source;
    const aerodromes: EarthAerodrome[] = source.aerodromes().map((poi) => ({
      ...source.toGeo(poi.x, poi.z),
      ...(poi.name !== undefined ? { name: poi.name } : {}),
    }));
    const seen = new Set<string>();
    const out: { runway: EarthRunway; surfaceY: number }[] = [];
    for (const runway of source.runways()) {
      const a = source.toGeo(runway.ax, runway.az);
      const b = source.toGeo(runway.bx, runway.bz);
      const length = haversineDistance(a, b);
      if (!(length > 0)) continue;
      const id = runwayId(a, b);
      if (seen.has(id)) continue;
      seen.add(id);
      const heading = compassBearing(a, b);
      const midX = (runway.ax + runway.bx) / 2;
      const midZ = (runway.az + runway.bz) / 2;
      const elevation = source.toElevation?.(midX, midZ, runway.y) ?? runway.y;
      const entry: EarthRunway = { id, ends: [a, b], heading, length, elevation };
      const midpoint = runwayMidpoint(entry);
      let nearest: EarthAerodrome | undefined;
      let nearestDistance = AERODROME_MATCH_RADIUS_M;
      for (const aerodrome of aerodromes) {
        const distance = haversineDistance(midpoint, aerodrome);
        if (distance <= nearestDistance) {
          nearestDistance = distance;
          nearest = aerodrome;
        }
      }
      if (nearest !== undefined) entry.aerodrome = nearest;
      if (runway.surface !== undefined) entry.surface = runway.surface;
      out.push({ runway: entry, surfaceY: runway.y });
    }
    return out;
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? abortError('EarthAirfields.whenNear was aborted');
}

/** The runways whose midpoint is within `radiusM` of the place, nearest first. */
function nearIn(
  runways: readonly EarthRunway[],
  latitude: number,
  longitude: number,
  radiusM: number,
): EarthRunway[] {
  const here = { latitude, longitude };
  return runways
    .map((runway) => ({ runway, distance: haversineDistance(here, runwayMidpoint(runway)) }))
    .filter(({ distance }) => distance <= radiusM)
    .sort((p, q) => p.distance - q.distance)
    .map(({ runway }) => runway);
}
