/**
 * Worker protocol for tile generation, as a pure message handler so it runs behind a real
 * Worker (`../worker`), a MessagePort, or a test double. `configure` carries the pack and atlas
 * once; every `generate` carries one tile, its geometry, and a transferable height grid, and
 * answers with the tile output (typed arrays transferred, not copied). `cancel` drops a pending
 * generation between cooperative steps.
 */

import {
  type TerrainSemanticTile,
  type TerrainSemanticTilePacket,
  terrainSemanticTileFromPacket,
} from '@bendyline/molen-terrain/kernel';
import {
  buildingCellTransferables,
  createHeightSampler,
  type HeightGrid,
  prepareBuildingCells,
  type ResolvedStylePack,
  type WorldgenBudgets,
  worldgenTransferables,
} from '@bendyline/molen-worldgen/kernel';
import { type PackedPolygons, unpackPolygons } from './packed-polygons';
import { createPlacesContent, type PlacesContent, type PlacesContentDocs } from './places';
import { createRegionResolver, type RegionResolver } from './region';
import type { RegionAtlasDoc } from './region-atlas-types';
import {
  createRegionalEnvironment,
  type RegionalEnvironment,
  type RegionalEnvironmentDocs,
} from './regional-environment';
import type { SemanticAdapterOptions, TileGeometry } from './semantic-adapter';
import { worldgenBuildingCellSize } from './tile-budgets';
import { generateWorldgenTileSteps, type WorldgenTileOutput } from './tile-generate';

export interface WorldgenWorkerConfigure {
  kind: 'configure';
  pack: ResolvedStylePack;
  atlas?: RegionAtlasDoc;
  environment?: RegionalEnvironmentDocs;
  metersPerUnit: number;
  /** Places content as documents; the worker builds the libraries (none when omitted). */
  places?: PlacesContentDocs;
}

export interface WorldgenWorkerGenerate {
  buildingInfill?: SemanticAdapterOptions['buildingInfill'];
  buildingInfillExclusions?: SemanticAdapterOptions['buildingInfillExclusions'];
  /** The exclusions packed (see packPolygons), as a host thread sends them. */
  packedInfillExclusions?: PackedPolygons;
  renderCellsOnly?: boolean;
  kind: 'generate';
  id: number;
  /** The tile, or (from a host thread) its packet: cloning a town tile whole cost the host's
   * main thread 5-10 ms (see terrainSemanticTilePacket). */
  tile?: TerrainSemanticTile;
  packet?: TerrainSemanticTilePacket;
  geom: TileGeometry;
  /** Tile ground as a plain grid (transferable). */
  ground: HeightGrid;
  budgets?: Partial<WorldgenBudgets>;
  features?: { buildings?: boolean; scatter?: boolean; interiors?: boolean };
  tierOffset?: number;
  keep?: number;
}

export interface WorldgenWorkerCancel {
  kind: 'cancel';
  id: number;
}

export type WorldgenWorkerRequest =
  | WorldgenWorkerConfigure
  | WorldgenWorkerGenerate
  | WorldgenWorkerCancel;

export interface WorldgenWorkerResult {
  kind: 'result';
  id: number;
  output?: WorldgenTileOutput;
  cancelled?: boolean;
  error?: string;
}

export interface WorldgenWorkerPort {
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

export interface WorldgenWorkerHandler {
  /** Handle one request; generation runs cooperatively and resolves when its result was posted. */
  handle(message: WorldgenWorkerRequest): Promise<void>;
}

/** Buildings per generation step. */
const STEP_EVERY_BUILDINGS = 48;
/** Work (ms) between yields to the event loop, so `cancel` messages get through. */
const SLICE_MS = 8;

// Yields through a message channel. A zero `setTimeout` nested in timer callbacks waits at least
// 4 ms, and a worker yielding after every step that way idled most of a tile's time: a dense tile
// took a second of wall time for a fifth of a second of work, while a jet waited for its buildings.
const waiting: Array<() => void> = [];
let channel: MessageChannel | undefined;
function yieldToLoop(): Promise<void> {
  if (typeof MessageChannel === 'undefined')
    return new Promise((resolve) => setTimeout(resolve, 0));
  if (channel === undefined) {
    channel = new MessageChannel();
    channel.port1.onmessage = () => waiting.shift()?.();
    // Node (tests) keeps a listening port's process alive; browsers have no unref.
    (channel.port1 as MessagePort & { unref?: () => void }).unref?.();
  }
  const port = channel.port2;
  return new Promise((resolve) => {
    waiting.push(resolve);
    port.postMessage(0);
  });
}

export function createWorldgenWorkerHandler(port: WorldgenWorkerPort): WorldgenWorkerHandler {
  let pack: ResolvedStylePack | undefined;
  let atlas: RegionAtlasDoc | undefined;
  let regions: RegionResolver | undefined;
  let environment: RegionalEnvironment | undefined;
  let places: PlacesContent | undefined;
  const cancelled = new Set<number>();
  const active = new Set<number>();
  // One tile at a time, in the order posted (a pool posts the most urgent waiting tile next).
  // Interleaved, every tile in flight finished late, the nearest with the rest: a jet's
  // buildings appeared seconds after their ground.
  let queue: Promise<void> = Promise.resolve();

  async function generate(request: WorldgenWorkerGenerate): Promise<void> {
    if (pack === undefined) {
      port.postMessage({
        kind: 'result',
        id: request.id,
        error: 'worker not configured (send configure first)',
      } satisfies WorldgenWorkerResult);
      return;
    }
    active.add(request.id);
    try {
      if (cancelled.has(request.id)) {
        port.postMessage({
          kind: 'result',
          id: request.id,
          cancelled: true,
        } satisfies WorldgenWorkerResult);
        return;
      }
      const generationStart = performance.now();
      const steps = generateWorldgenTileSteps(
        {
          tile:
            request.tile ??
            terrainSemanticTileFromPacket(request.packet as TerrainSemanticTilePacket),
          ...(request.buildingInfill !== undefined
            ? { buildingInfill: request.buildingInfill }
            : {}),
          ...(request.buildingInfillExclusions !== undefined
            ? { buildingInfillExclusions: request.buildingInfillExclusions }
            : request.packedInfillExclusions !== undefined
              ? { buildingInfillExclusions: unpackPolygons(request.packedInfillExclusions) }
              : {}),
          geom: request.geom,
          ground: createHeightSampler(request.ground),
          // Streaming never reads the output hash.
          hashOutput: false,
          pack,
          ...(atlas !== undefined ? { atlas } : {}),
          ...(regions !== undefined ? { regions } : {}),
          ...(environment !== undefined ? { environment } : {}),
          ...(places !== undefined ? { places } : {}),
          ...(request.budgets !== undefined ? { budgets: request.budgets } : {}),
          ...(request.features !== undefined ? { features: request.features } : {}),
          ...(request.tierOffset !== undefined ? { tierOffset: request.tierOffset } : {}),
          ...(request.keep !== undefined ? { keep: request.keep } : {}),
        },
        STEP_EVERY_BUILDINGS,
      );
      let sliceStart = performance.now();
      for (;;) {
        const next = steps.next();
        if (next.done === true) {
          const output = next.value;
          output.generationMs = performance.now() - generationStart;
          const preparationStart = performance.now();
          if (output.buildings !== undefined)
            output.buildingCells = prepareBuildingCells(
              output.buildings,
              worldgenBuildingCellSize(request.geom.levelBelowMax),
            );
          if (request.renderCellsOnly) delete output.buildings;
          output.preparationMs = performance.now() - preparationStart;
          const result: WorldgenWorkerResult = {
            kind: 'result',
            id: request.id,
            output,
          };
          port.postMessage(result, [
            ...worldgenTransferables(output),
            ...buildingCellTransferables(output.buildingCells ?? []),
          ]);
          return;
        }
        if (performance.now() - sliceStart < SLICE_MS) continue;
        await yieldToLoop();
        sliceStart = performance.now();
        if (cancelled.has(request.id)) {
          cancelled.delete(request.id);
          port.postMessage({
            kind: 'result',
            id: request.id,
            cancelled: true,
          } satisfies WorldgenWorkerResult);
          return;
        }
      }
    } catch (error) {
      port.postMessage({
        kind: 'result',
        id: request.id,
        error: (error as Error).message,
      } satisfies WorldgenWorkerResult);
    } finally {
      active.delete(request.id);
      cancelled.delete(request.id);
    }
  }

  return {
    async handle(message: WorldgenWorkerRequest): Promise<void> {
      switch (message.kind) {
        case 'configure':
          pack = message.pack;
          atlas = message.atlas;
          regions =
            message.atlas !== undefined
              ? createRegionResolver(message.atlas, { metersPerUnit: message.metersPerUnit })
              : undefined;
          places = message.places !== undefined ? createPlacesContent(message.places) : undefined;
          environment =
            message.environment !== undefined
              ? createRegionalEnvironment(message.environment, message.metersPerUnit, regions)
              : undefined;
          return;
        case 'cancel':
          if (active.has(message.id)) cancelled.add(message.id);
          return;
        case 'generate': {
          // Queued work can be cancelled before it starts.
          active.add(message.id);
          const run = queue.then(() => generate(message));
          queue = run.catch(() => {});
          try {
            await run;
          } finally {
            active.delete(message.id);
            cancelled.delete(message.id);
          }
          return;
        }
        default:
          return;
      }
    },
  };
}
