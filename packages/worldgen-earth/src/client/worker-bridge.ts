/**
 * Client side of the worker protocol: a `WorldgenGenerator` that ships each tile (semantics,
 * geometry, a transferable height grid) to a Worker and resolves with the transferred output.
 * The renderer accepts any generator, so the in-thread path and this bridge are interchangeable
 * and produce byte-identical tiles (both sample the ground through the same height grid).
 */

import {
  renderedGroundSampler,
  type TerrainSemanticTile,
  terrainSemanticTilePacket,
} from '@bendyline/molen-terrain/kernel';
import {
  type HeightGrid,
  type HeightSampler,
  heightGridFromSampler,
  type ResolvedStylePack,
  type WorldgenBudgets,
} from '@bendyline/molen-worldgen/kernel';
import { packPolygons } from '../kernel/packed-polygons';
import type { PlacesContentDocs } from '../kernel/places';
import type { RegionAtlasDoc } from '../kernel/region-atlas-types';
import type { RegionalEnvironmentDocs } from '../kernel/regional-environment';
import type { SemanticAdapterOptions, TileGeometry } from '../kernel/semantic-adapter';
import type { WorldgenTileOutput } from '../kernel/tile-generate';
import type {
  WorldgenWorkerConfigure,
  WorldgenWorkerGenerate,
  WorldgenWorkerResult,
} from '../kernel/worker-protocol';

export interface WorldgenGenerateRequest {
  buildingInfill?: SemanticAdapterOptions['buildingInfill'];
  buildingInfillExclusions?: SemanticAdapterOptions['buildingInfillExclusions'];
  /** Renderer requests compact cells instead of retaining a second canonical vertex copy. */
  renderCellsOnly?: boolean;
  tile: TerrainSemanticTile;
  geom: TileGeometry;
  /** World-space ground of the tile (a terrain heightfield). */
  ground: HeightSampler;
  /** Samples per tile edge for the transferable height grid (the terrain tile resolution). */
  resolution: number;
  /**
   * Vertices per edge of the ground the host draws for this tile (the terrain layer context's
   * `surfaceResolution`), when it draws `ground` as a coarser triangle mesh. Buildings, plants and
   * props then stand on those triangles, as everything else on the drawn ground does
   * (`renderedGroundSampler`). Fitted to `ground` itself, a hillside's buildings floated over a
   * coarse mesh or sank into it: 17 vertices across a 3.8 km tile left them up to 10 m in the
   * air over Alicante's hills, after a flight had lowered the quality tier.
   */
  surfaceResolution?: number;
  budgets?: Partial<WorldgenBudgets>;
  features?: { buildings?: boolean; scatter?: boolean; interiors?: boolean };
  tierOffset?: number;
  /** Extra keep multiplier on the plant scatter (default 1). */
  keep?: number;
  /** A viewer on the ground, in world X/Z: the buildings nearest it are detailed first. */
  focus?: readonly [number, number];
  /**
   * How soon the view needs the tile, lower first, read when a worker frees (the terrain
   * layer context's `priority`). A pool starts the most urgent waiting tile next.
   */
  priority?: () => number;
}

/** Produces tile output somewhere: in a worker, in-thread, or from a cache in front of either. */
export interface WorldgenGenerator {
  /**
   * Main-thread work `generate` would otherwise do first (the tile's ground grid), for a host
   * that meters main-thread work to run as its own step. Optional; `generate` works without it.
   */
  prepare?(request: WorldgenGenerateRequest): void;
  generate(
    request: WorldgenGenerateRequest,
    signal: AbortSignal,
  ): Promise<WorldgenTileOutput | undefined>;
  dispose(): void;
}

export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener?(type: 'message', listener: (event: { data: unknown }) => void): void;
  terminate?(): void;
}

export interface WorldgenWorkerBridgeOptions {
  pack: ResolvedStylePack;
  atlas?: RegionAtlasDoc;
  environment?: RegionalEnvironmentDocs;
  metersPerUnit: number;
  /**
   * Places content documents to generate with (none when omitted). Give the renderer the
   * same content as `places` so its tile cache keys match what the worker generates.
   */
  places?: PlacesContentDocs;
  /** Terminate the worker on dispose (default true). */
  ownsWorker?: boolean;
}

/**
 * Recently sampled grids. A tile's building and scatter passes sample the same ground, a few
 * milliseconds of main thread each for a full-resolution tile.
 */
const recentGrids: Array<{ ground: HeightSampler; key: string; grid: HeightGrid }> = [];
const RECENT_GRIDS = 8;

/**
 * Sample a tile's ground into the grid both generation paths use. Each call returns its own
 * heights, which the worker bridge transfers away; a recent tile's samples are reused. With
 * `surfaceResolution`, the grid follows the drawn triangle mesh of that many vertices per edge
 * (see `WorldgenGenerateRequest.surfaceResolution`) rather than `ground` between its vertices.
 */
export function tileHeightGrid(
  ground: HeightSampler,
  geom: TileGeometry,
  resolution: number,
  surfaceResolution?: number,
): HeightGrid {
  const grid = sampledTileGround(ground, geom, resolution, surfaceResolution);
  return { ...grid, heights: grid.heights.slice() };
}

/**
 * The ground a host draws as a mesh of `surfaceResolution` vertices per edge over the tile,
 * triangles split as the terrain mesh splits them. Only heights are read from it (the grid).
 */
function drawnTileGround(
  ground: HeightSampler,
  geom: TileGeometry,
  surfaceResolution: number,
): HeightSampler {
  const sampleHeight = renderedGroundSampler(
    { cols: surfaceResolution, sampleHeight: (x, z) => ground.sampleHeight(x, z) },
    [geom.originX, geom.originZ],
    geom.size,
    surfaceResolution,
  );
  return {
    sampleHeight,
    slopeAt: (x, z) => ground.slopeAt(x, z),
    normalAt: (x, z) => ground.normalAt(x, z),
  };
}

/** The shared grid behind `tileHeightGrid`: sampled once for a recent tile, never transferred. */
function sampledTileGround(
  ground: HeightSampler,
  geom: TileGeometry,
  resolution: number,
  surfaceResolution?: number,
): HeightGrid {
  const samples = Math.max(2, Math.min(1025, Math.floor(resolution)));
  const surface =
    surfaceResolution !== undefined && surfaceResolution >= 2
      ? Math.floor(surfaceResolution)
      : undefined;
  const key = `${geom.originX},${geom.originZ},${geom.size},${samples},${surface ?? '-'}`;
  let index = recentGrids.findIndex((entry) => entry.ground === ground && entry.key === key);
  if (index < 0) {
    const grid = heightGridFromSampler(
      surface === undefined ? ground : drawnTileGround(ground, geom, surface),
      geom.originX,
      geom.originZ,
      geom.size,
      geom.size,
      samples,
      samples,
    );
    recentGrids.unshift({ ground, key, grid });
    if (recentGrids.length > RECENT_GRIDS) recentGrids.pop();
    index = 0;
  }
  return (recentGrids[index] as { grid: HeightGrid }).grid;
}

/** Sample a tile's ground ahead of `tileHeightGrid`, which then finds it ready. */
export function prepareTileHeightGrid(
  ground: HeightSampler,
  geom: TileGeometry,
  resolution: number,
  surfaceResolution?: number,
): void {
  sampledTileGround(ground, geom, resolution, surfaceResolution);
}

export function createWorldgenWorkerBridge(
  worker: WorkerLike,
  options: WorldgenWorkerBridgeOptions,
): WorldgenGenerator {
  const pending = new Map<
    number,
    { resolve: (output: WorldgenTileOutput | undefined) => void; reject: (error: Error) => void }
  >();
  let nextId = 1;
  let disposed = false;
  const listener = (event: { data: unknown }): void => {
    const message = event.data as WorldgenWorkerResult | undefined;
    if (message === undefined || message.kind !== 'result') return;
    const waiter = pending.get(message.id);
    if (waiter === undefined) return;
    pending.delete(message.id);
    if (message.error !== undefined) waiter.reject(new Error(message.error));
    else waiter.resolve(message.cancelled === true ? undefined : message.output);
  };
  worker.addEventListener('message', listener);
  const configure: WorldgenWorkerConfigure = {
    kind: 'configure',
    pack: options.pack,
    ...(options.atlas !== undefined ? { atlas: options.atlas } : {}),
    ...(options.environment !== undefined ? { environment: options.environment } : {}),
    metersPerUnit: options.metersPerUnit,
    ...(options.places !== undefined ? { places: options.places } : {}),
  };
  worker.postMessage(configure);

  return {
    prepare(request): void {
      if (!disposed)
        prepareTileHeightGrid(
          request.ground,
          request.geom,
          request.resolution,
          request.surfaceResolution,
        );
    },
    generate(request, signal): Promise<WorldgenTileOutput | undefined> {
      if (disposed) return Promise.resolve(undefined);
      if (signal.aborted) return Promise.resolve(undefined);
      const id = nextId++;
      const ground = tileHeightGrid(
        request.ground,
        request.geom,
        request.resolution,
        request.surfaceResolution,
      );
      const exclusions =
        request.buildingInfillExclusions !== undefined
          ? packPolygons(request.buildingInfillExclusions)
          : undefined;
      const message: WorldgenWorkerGenerate = {
        ...(request.buildingInfill !== undefined ? { buildingInfill: request.buildingInfill } : {}),
        ...(exclusions !== undefined ? { packedInfillExclusions: exclusions } : {}),
        kind: 'generate',
        id,
        // A decoded tile goes as the packet it arrived in; one made here goes as itself.
        ...((packet) => (packet ? { packet } : { tile: request.tile }))(
          terrainSemanticTilePacket(request.tile),
        ),
        geom: request.geom,
        ground,
        ...(request.renderCellsOnly ? { renderCellsOnly: true } : {}),
        ...(request.budgets !== undefined ? { budgets: request.budgets } : {}),
        ...(request.features !== undefined ? { features: request.features } : {}),
        ...(request.tierOffset !== undefined ? { tierOffset: request.tierOffset } : {}),
        ...(request.keep !== undefined ? { keep: request.keep } : {}),
        ...(request.focus !== undefined ? { focus: request.focus } : {}),
      };
      return new Promise((resolve, reject) => {
        const onAbort = (): void => {
          if (!pending.has(id)) return;
          worker.postMessage({ kind: 'cancel', id });
        };
        signal.addEventListener('abort', onAbort, { once: true });
        pending.set(id, {
          resolve: (output) => {
            signal.removeEventListener('abort', onAbort);
            resolve(signal.aborted ? undefined : output);
          },
          reject: (error) => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
          },
        });
        worker.postMessage(message, [
          ground.heights.buffer,
          ...(exclusions !== undefined
            ? [exclusions.points.buffer, exclusions.rings.buffer, exclusions.polygons.buffer]
            : []),
        ]);
      });
    },
    dispose(): void {
      disposed = true;
      worker.removeEventListener?.('message', listener);
      for (const waiter of pending.values()) waiter.resolve(undefined);
      pending.clear();
      if (options.ownsWorker !== false) worker.terminate?.();
    },
  };
}

/**
 * Several identically configured workers behind one generator: each tile goes to the worker with
 * the fewest tiles in flight. Generation is deterministic per tile, so which worker builds it
 * does not change the output; a city's first view no longer waits on one worker's queue.
 *
 * Tiles wait here, not in the workers, and a free worker takes the most urgent (see
 * `WorldgenGenerateRequest.priority`; request order among equals). Posted at once, a jet's tiles
 * queued in each worker in request order: by their turn it had flown on, and the nearest ground
 * waited a second or more behind ground it had passed. Each worker keeps a second tile posted,
 * so it starts that one as soon as it finishes the first.
 *
 * The pool also bounds the footprints it has in flight (`POOL_FOOTPRINTS_IN_FLIGHT`). A worker's
 * heap grows with the footprints of the tile it is building, to about 500 MB for a 1.2 km tile
 * of 10,000 or a 2.4 km tile of 35,000 (central Bogotá), and every isolate of a tab shares one
 * 4 GB cage: five such tiles at once, with the page's and the other workers' heaps, ran the tab
 * out of memory. Past the bound the most urgent tile waits for room; an ordinary town's tiles
 * (a few thousand footprints each) never reach it.
 */
export function createWorldgenWorkerPool(
  workers: readonly WorkerLike[],
  options: WorldgenWorkerBridgeOptions,
): WorldgenGenerator {
  if (workers.length === 0) throw new Error('A worldgen worker pool needs at least one worker');
  const members = workers.map((worker) => ({
    bridge: createWorldgenWorkerBridge(worker, options),
    busy: 0,
  }));
  interface Waiting {
    request: WorldgenGenerateRequest;
    signal: AbortSignal;
    resolve: (output: WorldgenTileOutput | undefined) => void;
    reject: (error: unknown) => void;
    cleanup: () => void;
  }
  const waiting: Waiting[] = [];
  let disposed = false;
  let footprints = 0;
  const pump = (): void => {
    while (!disposed && waiting.length > 0) {
      let target = members[0] as (typeof members)[number];
      for (const member of members) if (member.busy < target.busy) target = member;
      if (target.busy >= POSTED_PER_WORKER) return;
      let best = 0;
      let bestPriority = Number.POSITIVE_INFINITY;
      for (let i = 0; i < waiting.length; i++) {
        const priority = waiting[i]?.request.priority?.() ?? 0;
        if (priority < bestPriority) {
          best = i;
          bestPriority = priority;
        }
      }
      // The most urgent tile waits for room rather than be passed by lighter ones, which would
      // keep a dense tile under the camera waiting behind the suburbs around it.
      const weight = (waiting[best] as Waiting).request.tile.buildings.length;
      if (footprints > 0 && footprints + weight > POOL_FOOTPRINTS_IN_FLIGHT) return;
      const job = waiting.splice(best, 1)[0] as Waiting;
      job.cleanup();
      const member = target;
      member.busy++;
      footprints += weight;
      member.bridge
        .generate(job.request, job.signal)
        .then(job.resolve, job.reject)
        .finally(() => {
          member.busy--;
          footprints -= weight;
          pump();
        });
    }
  };
  return {
    prepare(request): void {
      (members[0] as (typeof members)[number]).bridge.prepare?.(request);
    },
    generate(request, signal) {
      if (disposed || signal.aborted) return Promise.resolve(undefined);
      return new Promise((resolve, reject) => {
        // A tile abandoned while it waits settles at once, freeing its stream slot.
        const abort = (): void => {
          const index = waiting.indexOf(job);
          if (index >= 0) waiting.splice(index, 1);
          resolve(undefined);
        };
        const job: Waiting = {
          request,
          signal,
          resolve,
          reject,
          cleanup: () => signal.removeEventListener('abort', abort),
        };
        signal.addEventListener('abort', abort, { once: true });
        waiting.push(job);
        pump();
      });
    },
    dispose(): void {
      disposed = true;
      for (const job of waiting.splice(0)) {
        job.cleanup();
        job.resolve(undefined);
      }
      for (const member of members) member.bridge.dispose();
    },
  };
}

/**
 * Footprints the pool has in flight at most, unless a single tile holds more (it then runs
 * alone): three dense zoom-15 tiles, or one dense tile of the level behind them.
 */
export const POOL_FOOTPRINTS_IN_FLIGHT = 36_000;

/** Tiles posted to one worker at a time: the one it is building and the next. */
const POSTED_PER_WORKER = 2;
