/**
 * Client side of the worker protocol: a `WorldgenGenerator` that ships each tile (semantics,
 * geometry, a transferable height grid) to a Worker and resolves with the transferred output.
 * The renderer accepts any generator, so the in-thread path and this bridge are interchangeable
 * and produce byte-identical tiles (both sample the ground through the same height grid).
 */

import type { TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import {
  type HeightGrid,
  type HeightSampler,
  heightGridFromSampler,
  type ResolvedStylePack,
  type WorldgenBudgets,
} from '@bendyline/molen-worldgen/kernel';
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
  budgets?: Partial<WorldgenBudgets>;
  features?: { buildings?: boolean; scatter?: boolean; interiors?: boolean };
  tierOffset?: number;
  /** Extra keep multiplier on the plant scatter (default 1). */
  keep?: number;
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
 * heights, which the worker bridge transfers away; a recent tile's samples are reused.
 */
export function tileHeightGrid(
  ground: HeightSampler,
  geom: TileGeometry,
  resolution: number,
): HeightGrid {
  const grid = sampledTileGround(ground, geom, resolution);
  return { ...grid, heights: grid.heights.slice() };
}

/** The shared grid behind `tileHeightGrid`: sampled once for a recent tile, never transferred. */
function sampledTileGround(
  ground: HeightSampler,
  geom: TileGeometry,
  resolution: number,
): HeightGrid {
  const samples = Math.max(2, Math.min(1025, Math.floor(resolution)));
  const key = `${geom.originX},${geom.originZ},${geom.size},${samples}`;
  let index = recentGrids.findIndex((entry) => entry.ground === ground && entry.key === key);
  if (index < 0) {
    const grid = heightGridFromSampler(
      ground,
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
): void {
  sampledTileGround(ground, geom, resolution);
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
      if (!disposed) prepareTileHeightGrid(request.ground, request.geom, request.resolution);
    },
    generate(request, signal): Promise<WorldgenTileOutput | undefined> {
      if (disposed) return Promise.resolve(undefined);
      if (signal.aborted) return Promise.resolve(undefined);
      const id = nextId++;
      const ground = tileHeightGrid(request.ground, request.geom, request.resolution);
      const message: WorldgenWorkerGenerate = {
        ...(request.buildingInfill !== undefined ? { buildingInfill: request.buildingInfill } : {}),
        ...(request.buildingInfillExclusions !== undefined
          ? { buildingInfillExclusions: request.buildingInfillExclusions }
          : {}),
        kind: 'generate',
        id,
        tile: request.tile,
        geom: request.geom,
        ground,
        ...(request.renderCellsOnly ? { renderCellsOnly: true } : {}),
        ...(request.budgets !== undefined ? { budgets: request.budgets } : {}),
        ...(request.features !== undefined ? { features: request.features } : {}),
        ...(request.tierOffset !== undefined ? { tierOffset: request.tierOffset } : {}),
        ...(request.keep !== undefined ? { keep: request.keep } : {}),
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
        worker.postMessage(message, [ground.heights.buffer]);
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
  return {
    prepare(request): void {
      (members[0] as (typeof members)[number]).bridge.prepare?.(request);
    },
    generate(request, signal) {
      let target = members[0] as (typeof members)[number];
      for (const member of members) if (member.busy < target.busy) target = member;
      target.busy++;
      return target.bridge.generate(request, signal).finally(() => {
        target.busy--;
      });
    },
    dispose(): void {
      for (const member of members) member.bridge.dispose();
    },
  };
}
