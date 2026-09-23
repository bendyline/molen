/** One-call tile generation: adapter plus the world-agnostic batch generator. */

import type { Heightfield, TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import {
  generateWorldgenBatch,
  generateWorldgenBatchSteps,
  type HeightSampler,
  type PreparedBuildingCell,
  type WorldgenBatchOutput,
  type WorldgenProgress,
} from '@bendyline/molen-worldgen/kernel';
import {
  type SemanticAdapterOptions,
  type SemanticBatch,
  semanticTileToBatch,
  type TileGeometry,
} from './semantic-adapter';

export interface WorldgenTileInput extends SemanticAdapterOptions {
  tile: TerrainSemanticTile;
  geom: TileGeometry;
  /** World-space ground (a terrain heightfield); wrapped into tile-local meters. */
  ground: Pick<Heightfield, 'sampleHeight' | 'slopeAt' | 'normalAt'>;
}

export interface WorldgenTileOutput extends WorldgenBatchOutput {
  /** Optional renderer preparation returned by the worker; source geometry remains canonical. */
  buildingCells?: PreparedBuildingCell[];
  preparationMs?: number;
  generationMs?: number;
  regionId?: string;
  scatterId?: string;
  skippedByOwnership: number;
  clippedPieces: number;
}

/** Tile-local sampler over a world-space heightfield. */
export function tileGroundSampler(
  ground: WorldgenTileInput['ground'],
  geom: TileGeometry,
): HeightSampler {
  return {
    sampleHeight: (x, z) => ground.sampleHeight(geom.originX + x, geom.originZ + z),
    slopeAt: (x, z) => ground.slopeAt(geom.originX + x, geom.originZ + z),
    normalAt: (x, z) => ground.normalAt(geom.originX + x, geom.originZ + z),
  };
}

function finish(batch: SemanticBatch, output: WorldgenBatchOutput): WorldgenTileOutput {
  return {
    ...output,
    ...(batch.regionId !== undefined ? { regionId: batch.regionId } : {}),
    ...(batch.scatterId !== undefined ? { scatterId: batch.scatterId } : {}),
    skippedByOwnership: batch.skippedByOwnership,
    clippedPieces: batch.clippedPieces,
  };
}

export function* generateWorldgenTileSteps(
  input: WorldgenTileInput,
  step = 64,
): Generator<WorldgenProgress, WorldgenTileOutput, void> {
  const batch = semanticTileToBatch(input.tile, input.geom, input);
  const output = yield* generateWorldgenBatchSteps(
    { ...batch, ground: tileGroundSampler(input.ground, input.geom) },
    step,
  );
  return finish(batch, output);
}

export function generateWorldgenTile(input: WorldgenTileInput): WorldgenTileOutput {
  const batch = semanticTileToBatch(input.tile, input.geom, input);
  return finish(
    batch,
    generateWorldgenBatch({ ...batch, ground: tileGroundSampler(input.ground, input.geom) }),
  );
}
