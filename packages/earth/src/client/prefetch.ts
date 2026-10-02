/**
 * Prefetch terrain bytes ahead of the camera, so travel reads ground it has already fetched.
 *
 * The Earth view's stream loads what the camera sees now. With a byte cache attached
 * (`mountEarthView({ byteCache })`), this module looks ahead: it estimates the camera's velocity
 * from its own track (so it follows whatever the camera follows: an orbit pan, a car, an
 * aircraft), places virtual views along that track (by default 20, 40 and 60 s out), runs the
 * stream's own tile selection for each, and reads the archive tiles those views would need into
 * the cache: elevation, landcover, features and the building-detail level, exactly the reads the
 * stream's layers make. Reads stop at the bytes; nothing is decoded or meshed, so prefetching
 * costs bandwidth and cache space, not frame time.
 *
 * Reads run at most two at a time, only while the stream has a free load slot of its own (what
 * the camera sees always comes first), the page is visible and the browser is online without
 * Save-Data. A host can also queue places it expects the viewer to
 * reach (`EarthView.prefetch`, for example a simulator's flight plan); those go first and do not
 * wait for the stream.
 */

import type {
  TerrainPyramidBudget,
  TerrainPyramidView,
  TerrainTileArchive,
} from '@bendyline/molen-terrain/client';
import { selectTerrainPyramidTiles } from '@bendyline/molen-terrain/client';
import {
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidAncestor,
  terrainPyramidTileKey,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from '@bendyline/molen-terrain/kernel';

export interface EarthPrefetchOptions {
  /** Seconds of travel to look ahead along the camera's track (default 60). */
  horizonSeconds?: number;
  /** Look-ahead times, in seconds (default a third, two thirds and all of the horizon). */
  stepsSeconds?: readonly number[];
  /** Archive reads in flight at once (default 2). */
  maxConcurrent?: number;
  /** Look ahead only when the horizon covers at least this many meters (default 300). */
  minDistanceMeters?: number;
  /**
   * Look at most this far ahead, in meters (default 15 000): at a speed that would cover more
   * over the horizon, the look-ahead times shrink to fit.
   */
  maxDistanceMeters?: number;
  /** Tile reads queued per look-ahead (default 64). */
  maxTilesPerUpdate?: number;
  /** How often the look-ahead is recomputed, in ms (default 1000). */
  intervalMs?: number;
}

/** A place a host expects the viewer to reach. */
export interface EarthPrefetchPoint {
  latitude: number;
  longitude: number;
  /** Camera height above sea level in meters (default the camera's current height). */
  altitude?: number;
}

export interface EarthPrefetchResult {
  /** Tile reads the points needed (after skipping what was resident or already read). */
  requested: number;
  warmed: number;
  failed: number;
}

export interface EarthPrefetchStats {
  queued: number;
  inFlight: number;
  warmed: number;
  failed: number;
  /** Look-aheads computed so far. */
  lookAheads: number;
  /** Why reads are on hold, when they are. */
  paused?: 'paused' | 'hidden' | 'offline' | 'saveData' | 'loading' | 'stationary' | 'animating';
}

/** Which archive a prefetch read goes to. */
export type EarthPrefetchRole = 'elevation' | 'landcover' | 'features' | 'buildingDetail';

/** One archive tile to read. `y` is the archive row (TMS packages are flipped). */
export interface EarthPrefetchTarget {
  role: EarthPrefetchRole;
  level: number;
  x: number;
  y: number;
}

/** The levels a stack's layers read from each archive. */
export interface EarthPrefetchLevels {
  /** Finest level the elevation archive holds (finer tiles crop its tiles). */
  elevation: { maxLevel: number };
  landcover?: { minLevel: number; maxLevel: number };
  features?: { minLevel: number; maxLevel: number };
  /** The building-detail level, read under feature tiles up to `maxDepth` levels coarser. */
  buildingDetail?: { level: number; maxDepth: number };
}

/** The archives a stack reads, with those levels. */
export interface EarthPrefetchArchives extends EarthPrefetchLevels {
  elevation: { archive: TerrainTileArchive; maxLevel: number };
  landcover?: { archive: TerrainTileArchive; minLevel: number; maxLevel: number };
  features?: { archive: TerrainTileArchive; minLevel: number; maxLevel: number };
  buildingDetail?: { archive: TerrainTileArchive; level: number; maxDepth: number };
}

type Vec3 = [number, number, number];

/**
 * Velocity of a moving point from its samples, smoothed over about `smoothingSeconds` (default
 * 1.5). A jump longer than `maxStep` world units (a teleport or re-anchor) restarts it.
 */
export function createMotionEstimator(
  options: { smoothingSeconds?: number; maxStep?: number } = {},
): { sample(nowMs: number, position: readonly number[]): Vec3 | undefined; reset(): void } {
  const tau = options.smoothingSeconds ?? 1.5;
  const maxStep = options.maxStep ?? Number.POSITIVE_INFINITY;
  let last: { time: number; position: Vec3 } | undefined;
  let velocity: Vec3 | undefined;
  return {
    sample(nowMs, position) {
      const point: Vec3 = [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0];
      if (last === undefined) {
        last = { time: nowMs, position: point };
        return velocity;
      }
      const dt = (nowMs - last.time) / 1000;
      if (dt <= 0) return velocity;
      const step = Math.hypot(
        point[0] - last.position[0],
        point[1] - last.position[1],
        point[2] - last.position[2],
      );
      if (step > maxStep) {
        last = { time: nowMs, position: point };
        velocity = undefined;
        return undefined;
      }
      const raw: Vec3 = [
        (point[0] - last.position[0]) / dt,
        (point[1] - last.position[1]) / dt,
        (point[2] - last.position[2]) / dt,
      ];
      const alpha = 1 - Math.exp(-dt / tau);
      velocity =
        velocity === undefined
          ? raw
          : [
              velocity[0] + alpha * (raw[0] - velocity[0]),
              velocity[1] + alpha * (raw[1] - velocity[1]),
              velocity[2] + alpha * (raw[2] - velocity[2]),
            ];
      last = { time: nowMs, position: point };
      return velocity;
    },
    reset() {
      last = undefined;
      velocity = undefined;
    },
  };
}

/**
 * Camera positions along a straight track: `position + velocity * t` for each time, never lower
 * than `minY`. The view direction stays the live one, since the camera looks where it travels.
 */
export function extrapolateTrack(
  position: readonly number[],
  velocity: readonly number[],
  seconds: readonly number[],
  options: { minY?: number } = {},
): Array<{ seconds: number; position: Vec3 }> {
  const minY = options.minY ?? Number.NEGATIVE_INFINITY;
  return seconds.map((t) => ({
    seconds: t,
    position: [
      (position[0] ?? 0) + (velocity[0] ?? 0) * t,
      Math.max(minY, (position[1] ?? 0) + (velocity[1] ?? 0) * t),
      (position[2] ?? 0) + (velocity[2] ?? 0) * t,
    ],
  }));
}

/**
 * The archive reads the stream's layers would make for these selected tiles: elevation at the
 * tile (or the finest level the archive has), landcover over its finest three levels, features
 * (water spans every level) at the tile or its finest-level ancestor, and the building-detail
 * level's tiles under a feature tile within `maxDepth` of it. Deduplicated, in input order.
 */
export function earthPrefetchTargets(
  tiles: readonly TerrainPyramidTileAddress[],
  archives: EarthPrefetchLevels,
  scheme: 'xyz' | 'tms' = 'xyz',
): EarthPrefetchTarget[] {
  const out: EarthPrefetchTarget[] = [];
  const seen = new Set<string>();
  const push = (role: EarthPrefetchRole, address: TerrainPyramidTileAddress): void => {
    const y = scheme === 'tms' ? 2 ** address.level - 1 - address.z : address.z;
    const key = `${role}:${address.level}/${address.x}/${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ role, level: address.level, x: address.x, y });
  };
  const at = (tile: TerrainPyramidTileAddress, level: number): TerrainPyramidTileAddress =>
    level >= tile.level ? tile : terrainPyramidAncestor(tile, level);
  for (const tile of tiles) {
    push('elevation', at(tile, archives.elevation.maxLevel));
    const landcover = archives.landcover;
    if (
      landcover !== undefined &&
      tile.level >= Math.max(landcover.minLevel, landcover.maxLevel - 2)
    )
      push('landcover', at(tile, landcover.maxLevel));
    const features = archives.features;
    if (features !== undefined && tile.level >= features.minLevel) {
      push('features', at(tile, features.maxLevel));
      const detail = archives.buildingDetail;
      if (
        detail !== undefined &&
        tile.level >= features.maxLevel - 1 &&
        tile.level >= detail.level - detail.maxDepth &&
        tile.level <= detail.level
      ) {
        const span = 2 ** (detail.level - tile.level);
        for (let dz = 0; dz < span; dz++) {
          for (let dx = 0; dx < span; dx++) {
            push('buildingDetail', {
              level: detail.level,
              x: tile.x * span + dx,
              z: tile.z * span + dz,
            });
          }
        }
      }
    }
  }
  return out;
}

export interface EarthPrefetcherDeps {
  descriptor: TerrainPyramidDescriptor;
  scheme: 'xyz' | 'tms';
  archives: EarthPrefetchArchives;
  /** World units per meter conversion: meters = units * metersPerUnit. */
  metersPerUnit: number;
  budget(): TerrainPyramidBudget;
  /** Keys (`level/x/z`) of tiles the stream already holds. */
  resident(): ReadonlySet<string>;
  /** Whether the stream is using all of its own load slots (then only host points are read). */
  busy(): boolean;
  groundHeight(x: number, z: number): number | undefined;
  /** The view parameters a virtual camera shares with the real one. */
  viewShape(): Pick<TerrainPyramidView, 'verticalFov' | 'viewportHeight' | 'aspect'>;
  options?: EarthPrefetchOptions;
  now?: () => number;
}

export interface EarthPrefetcher {
  /**
   * Feed the camera each frame. Pass `steady: false` while the camera is animating (a fly-to, an
   * entry tilt): its momentary speed says nothing about where the viewer is going, so the
   * look-ahead waits and starts its velocity estimate afresh.
   */
  frame(
    nowMs: number,
    position: readonly number[],
    direction: readonly number[],
    steady?: boolean,
  ): void;
  /** Queue world positions (`[x, y, z]`) a host expects to reach; resolves as they are read. */
  enqueue(
    positions: ReadonlyArray<readonly number[]>,
    signal?: AbortSignal,
  ): Promise<EarthPrefetchResult>;
  stats(): EarthPrefetchStats;
  setPaused(paused: boolean): void;
  dispose(): void;
}

interface Job {
  target: EarthPrefetchTarget;
  host: boolean;
  settle?: (ok: boolean) => void;
}

const WARMED_TTL_MS = 10 * 60 * 1000;
const WARMED_MAX = 8192;

function onHold(): EarthPrefetchStats['paused'] {
  const doc = (globalThis as { document?: { hidden?: boolean } }).document;
  if (doc?.hidden === true) return 'hidden';
  const nav = (
    globalThis as { navigator?: { onLine?: boolean; connection?: { saveData?: boolean } } }
  ).navigator;
  if (nav?.onLine === false) return 'offline';
  if (nav?.connection?.saveData === true) return 'saveData';
  return undefined;
}

/** A prefetcher for one terrain stack; dispose it with the stack. */
export function createEarthPrefetcher(deps: EarthPrefetcherDeps): EarthPrefetcher {
  const options = deps.options ?? {};
  const horizon = options.horizonSeconds ?? 60;
  const steps = options.stepsSeconds ?? [horizon / 3, (2 * horizon) / 3, horizon];
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 2);
  const minDistance = options.minDistanceMeters ?? 300;
  const maxDistance = options.maxDistanceMeters ?? 15_000;
  const maxTiles = options.maxTilesPerUpdate ?? 64;
  const interval = options.intervalMs ?? 1000;
  const now = deps.now ?? Date.now;
  const motion = createMotionEstimator({
    // A frame-to-frame jump past 2 km is a teleport, not travel.
    maxStep: 2000 / deps.metersPerUnit,
  });
  const warmed = new Map<string, number>();
  let auto: Job[] = [];
  const host: Job[] = [];
  let inFlight = 0;
  let paused = false;
  let disposed = false;
  let lastLookAhead = Number.NEGATIVE_INFINITY;
  let hold: EarthPrefetchStats['paused'];
  const controller = new AbortController();
  const counters = { warmed: 0, failed: 0, lookAheads: 0 };

  const jobKey = (target: EarthPrefetchTarget): string =>
    `${target.role}:${target.level}/${target.x}/${target.y}`;
  const archiveFor = (role: EarthPrefetchRole): TerrainTileArchive | undefined =>
    deps.archives[role]?.archive;

  const recentlyWarmed = (key: string, t: number): boolean => {
    const at = warmed.get(key);
    return at !== undefined && t - at < WARMED_TTL_MS;
  };
  const remember = (key: string, t: number): void => {
    warmed.delete(key);
    warmed.set(key, t);
    while (warmed.size > WARMED_MAX) warmed.delete(warmed.keys().next().value as string);
  };

  /** Archive reads for virtual views, minus resident tiles and recent reads. */
  const targetsFor = (views: TerrainPyramidView[], limit: number): EarthPrefetchTarget[] => {
    const budget = deps.budget();
    const selection: TerrainPyramidTileAddress[] = [];
    const picked = new Set<string>();
    const resident = deps.resident();
    for (const view of views) {
      const tiles = selectTerrainPyramidTiles(deps.descriptor, view, {
        maxScreenSpaceError: budget.maxScreenSpaceError,
        viewDistance: budget.viewDistance,
        maxSelectedTiles: Math.max(8, Math.ceil(budget.maxSelectedTiles / 2)),
        hysteresis: 0,
      }).tiles;
      // Nearest first within each view: those are needed soonest.
      const distance = (tile: TerrainPyramidTileAddress): number => {
        const [x, z] = terrainPyramidTileOrigin(deps.descriptor, tile);
        const half = terrainPyramidTileSize(deps.descriptor, tile.level) / 2;
        return Math.hypot(x + half - view.position[0], z + half - view.position[2]);
      };
      tiles.sort((a, b) => distance(a) - distance(b));
      for (const tile of tiles) {
        const key = terrainPyramidTileKey(tile);
        if (resident.has(key) || picked.has(key)) continue;
        picked.add(key);
        selection.push(tile);
      }
    }
    const t = now();
    const out: EarthPrefetchTarget[] = [];
    for (const target of earthPrefetchTargets(selection, deps.archives, deps.scheme)) {
      if (archiveFor(target.role) === undefined || recentlyWarmed(jobKey(target), t)) continue;
      out.push(target);
      if (out.length >= limit) break;
    }
    return out;
  };

  const viewAt = (
    position: readonly number[],
    direction: readonly number[],
  ): TerrainPyramidView => ({
    ...deps.viewShape(),
    position: [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0],
    direction: [direction[0] ?? 0, direction[1] ?? 0, direction[2] ?? 0],
  });

  const pump = (): void => {
    if (disposed) return;
    hold = paused ? 'paused' : onHold();
    while (inFlight < maxConcurrent && hold === undefined) {
      const fromHost = host.length > 0;
      if (!fromHost && deps.busy()) {
        hold = 'loading';
        break;
      }
      const job = fromHost ? host.shift() : auto.shift();
      if (job === undefined) break;
      const archive = archiveFor(job.target.role);
      const key = jobKey(job.target);
      if (archive === undefined || recentlyWarmed(key, now())) {
        job.settle?.(true);
        continue;
      }
      inFlight++;
      const { level, x, y } = job.target;
      Promise.resolve()
        .then(() => archive.getZxy(level, x, y, controller.signal))
        .then(
          () => {
            counters.warmed++;
            remember(key, now());
            job.settle?.(true);
          },
          () => {
            counters.failed++;
            job.settle?.(false);
          },
        )
        .finally(() => {
          inFlight--;
          pump();
        });
    }
  };

  return {
    frame(nowMs, position, direction, steady = true) {
      if (disposed) return;
      if (!steady) {
        motion.reset();
        auto = [];
        if (inFlight === 0 && host.length === 0) hold = 'animating';
        if (host.length > 0) pump();
        return;
      }
      const velocity = motion.sample(nowMs, position);
      if (nowMs - lastLookAhead < interval) {
        if (inFlight < maxConcurrent && (host.length > 0 || auto.length > 0)) pump();
        return;
      }
      lastLookAhead = nowMs;
      const speed = velocity === undefined ? 0 : Math.hypot(velocity[0], velocity[2]);
      if (speed * horizon * deps.metersPerUnit < minDistance || velocity === undefined) {
        auto = [];
        hold = host.length === 0 && inFlight === 0 ? 'stationary' : hold;
        if (host.length > 0) pump();
        return;
      }
      const ground = deps.groundHeight(position[0] ?? 0, position[2] ?? 0);
      // A fast camera looks no farther than maxDistance: the same steps, compressed in time.
      const reach = speed * horizon * deps.metersPerUnit;
      const scale = reach > maxDistance ? maxDistance / reach : 1;
      const track = extrapolateTrack(
        position,
        velocity,
        steps.map((t) => t * scale),
        {
          ...(ground !== undefined ? { minY: ground + 30 / deps.metersPerUnit } : {}),
        },
      );
      counters.lookAheads++;
      auto = targetsFor(
        track.map((point) => viewAt(point.position, direction)),
        maxTiles,
      ).map((target) => ({ target, host: false }));
      pump();
    },
    enqueue(positions, signal) {
      if (disposed || positions.length === 0) {
        return Promise.resolve({ requested: 0, warmed: 0, failed: 0 });
      }
      const views = positions.map((position, index) => {
        const next = positions[index + 1] ?? positions[index - 1] ?? position;
        const sign = index + 1 < positions.length ? 1 : -1;
        const dx = ((next[0] ?? 0) - (position[0] ?? 0)) * sign;
        const dz = ((next[2] ?? 0) - (position[2] ?? 0)) * sign;
        const length = Math.hypot(dx, dz);
        // Look along the route, slightly down; a lone point looks north.
        const direction = length > 0 ? [dx / length, -0.35, dz / length] : [0, -0.35, -1];
        return viewAt(position, direction);
      });
      const targets = targetsFor(views, Number.POSITIVE_INFINITY);
      const result: EarthPrefetchResult = { requested: targets.length, warmed: 0, failed: 0 };
      if (targets.length === 0) return Promise.resolve(result);
      return new Promise<EarthPrefetchResult>((resolve, reject) => {
        let left = targets.length;
        const jobs: Job[] = [];
        const finish = (): void => {
          signal?.removeEventListener('abort', abort);
          resolve(result);
        };
        const abort = (): void => {
          for (const job of jobs) {
            const index = host.indexOf(job);
            if (index >= 0) host.splice(index, 1);
          }
          reject(signal?.reason ?? new DOMException('Prefetch aborted', 'AbortError'));
        };
        if (signal?.aborted) {
          abort();
          return;
        }
        signal?.addEventListener('abort', abort, { once: true });
        for (const target of targets) {
          const job: Job = {
            target,
            host: true,
            settle: (ok) => {
              if (ok) result.warmed++;
              else result.failed++;
              left--;
              if (left === 0) finish();
            },
          };
          jobs.push(job);
          host.push(job);
        }
        pump();
      });
    },
    stats() {
      return {
        queued: auto.length + host.length,
        inFlight,
        ...counters,
        ...(hold !== undefined ? { paused: hold } : {}),
      };
    },
    setPaused(next) {
      paused = next;
      if (!paused) pump();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      // Pending host points resolve with what was read before the stack went away.
      for (const job of host.splice(0)) job.settle?.(false);
      auto = [];
    },
  };
}
