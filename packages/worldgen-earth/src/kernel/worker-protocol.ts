/**
 * Worker protocol for tile generation, as a pure message handler so it runs behind a real
 * Worker (`../worker`), a MessagePort, or a test double. `configure` carries the pack and atlas
 * once; every `generate` carries one tile, its geometry, and a transferable height grid, and
 * answers with the tile output (typed arrays transferred, not copied). `cancel` drops a pending
 * generation between cooperative steps.
 */

import type { TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import {
  buildingCellTransferables,
  createHeightSampler,
  type HeightGrid,
  prepareBuildingCells,
  type ResolvedStylePack,
  type WorldgenBudgets,
  worldgenTransferables,
} from '@bendyline/molen-worldgen/kernel';
import { createPlacesContent, type PlacesContent, type PlacesContentDocs } from './places';
import { createRegionResolver, type RegionResolver } from './region';
import type { RegionAtlasDoc } from './region-atlas-types';
import type { TileGeometry } from './semantic-adapter';
import { generateWorldgenTileSteps, type WorldgenTileOutput } from './tile-generate';

export interface WorldgenWorkerConfigure {
  kind: 'configure';
  pack: ResolvedStylePack;
  atlas?: RegionAtlasDoc;
  metersPerUnit: number;
  /** Places content as documents; the worker builds the libraries (none when omitted). */
  places?: PlacesContentDocs;
}

export interface WorldgenWorkerGenerate {
  renderCellsOnly?: boolean;
  kind: 'generate';
  id: number;
  tile: TerrainSemanticTile;
  geom: TileGeometry;
  /** Tile ground as a plain grid (transferable). */
  ground: HeightGrid;
  budgets?: Partial<WorldgenBudgets>;
  features?: { buildings?: boolean; scatter?: boolean; interiors?: boolean };
  tierOffset?: number;
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

/** Steps run between yields to the event loop (so `cancel` messages get through). */
const STEP_EVERY_BUILDINGS = 48;

function yieldToLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function createWorldgenWorkerHandler(port: WorldgenWorkerPort): WorldgenWorkerHandler {
  let pack: ResolvedStylePack | undefined;
  let atlas: RegionAtlasDoc | undefined;
  let regions: RegionResolver | undefined;
  let places: PlacesContent | undefined;
  const cancelled = new Set<number>();
  const active = new Set<number>();

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
      const generationStart = performance.now();
      const steps = generateWorldgenTileSteps(
        {
          tile: request.tile,
          geom: request.geom,
          ground: createHeightSampler(request.ground),
          pack,
          ...(atlas !== undefined ? { atlas } : {}),
          ...(regions !== undefined ? { regions } : {}),
          ...(places !== undefined ? { places } : {}),
          ...(request.budgets !== undefined ? { budgets: request.budgets } : {}),
          ...(request.features !== undefined ? { features: request.features } : {}),
          ...(request.tierOffset !== undefined ? { tierOffset: request.tierOffset } : {}),
        },
        STEP_EVERY_BUILDINGS,
      );
      for (;;) {
        const next = steps.next();
        if (next.done === true) {
          const output = next.value;
          output.generationMs = performance.now() - generationStart;
          const preparationStart = performance.now();
          if (output.buildings !== undefined)
            output.buildingCells = prepareBuildingCells(output.buildings);
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
        await yieldToLoop();
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
          return;
        case 'cancel':
          if (active.has(message.id)) cancelled.add(message.id);
          return;
        case 'generate':
          await generate(message);
          return;
        default:
          return;
      }
    },
  };
}
