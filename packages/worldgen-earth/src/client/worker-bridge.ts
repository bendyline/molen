/**
 * Client side of the worker protocol: a `WorldgenGenerator` that ships each tile (semantics,
 * geometry, a transferable height grid) to a Worker and resolves with the transferred output.
 * The renderer accepts any generator, so the in-thread path and this bridge are interchangeable
 * and produce byte-identical tiles (both sample the ground through the same height grid).
 */

import type { TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import {
  type HeightSampler,
  heightGridFromSampler,
  type ResolvedStylePack,
  type WorldgenBudgets,
} from '@bendyline/molen-worldgen/kernel';
import type { PlacesContentDocs } from '../kernel/places';
import type { RegionAtlasDoc } from '../kernel/region-atlas-types';
import type { TileGeometry } from '../kernel/semantic-adapter';
import type { WorldgenTileOutput } from '../kernel/tile-generate';
import type {
  WorldgenWorkerConfigure,
  WorldgenWorkerGenerate,
  WorldgenWorkerResult,
} from '../kernel/worker-protocol';

export interface WorldgenGenerateRequest {
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
}

/** Produces tile output somewhere: in a worker, in-thread, or from a cache in front of either. */
export interface WorldgenGenerator {
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
  metersPerUnit: number;
  /**
   * Places content documents to generate with (none when omitted). Give the renderer the
   * same content as `places` so its tile cache keys match what the worker generates.
   */
  places?: PlacesContentDocs;
  /** Terminate the worker on dispose (default true). */
  ownsWorker?: boolean;
}

/** Sample a tile's ground into the grid both generation paths use. */
export function tileHeightGrid(
  ground: HeightSampler,
  geom: TileGeometry,
  resolution: number,
): ReturnType<typeof heightGridFromSampler> {
  const samples = Math.max(2, Math.min(1025, Math.floor(resolution)));
  return heightGridFromSampler(
    ground,
    geom.originX,
    geom.originZ,
    geom.size,
    geom.size,
    samples,
    samples,
  );
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
    metersPerUnit: options.metersPerUnit,
    ...(options.places !== undefined ? { places: options.places } : {}),
  };
  worker.postMessage(configure);

  return {
    generate(request, signal): Promise<WorldgenTileOutput | undefined> {
      if (disposed) return Promise.resolve(undefined);
      if (signal.aborted) return Promise.resolve(undefined);
      const id = nextId++;
      const ground = tileHeightGrid(request.ground, request.geom, request.resolution);
      const message: WorldgenWorkerGenerate = {
        kind: 'generate',
        id,
        tile: request.tile,
        geom: request.geom,
        ground,
        ...(request.renderCellsOnly ? { renderCellsOnly: true } : {}),
        ...(request.budgets !== undefined ? { budgets: request.budgets } : {}),
        ...(request.features !== undefined ? { features: request.features } : {}),
        ...(request.tierOffset !== undefined ? { tierOffset: request.tierOffset } : {}),
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
