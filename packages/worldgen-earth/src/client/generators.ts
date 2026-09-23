/**
 * Generators the renderer can be handed: the in-thread cooperative generator (default) and a
 * cache wrapper that serves repeat tiles from CPU buffers. Both paths (and the worker bridge)
 * sample the ground through the same transferable height grid, so their output is identical.
 */

import { createHeightSampler, type ResolvedStylePack } from '@bendyline/molen-worldgen/kernel';
import type { PlacesContent } from '../kernel/places';
import type { RegionResolver } from '../kernel/region';
import type { RegionAtlasDoc } from '../kernel/region-atlas-types';
import { generateWorldgenTileSteps, type WorldgenTileOutput } from '../kernel/tile-generate';
import type { WorldgenTileCache } from './cache';
import {
  tileHeightGrid,
  type WorldgenGenerateRequest,
  type WorldgenGenerator,
} from './worker-bridge';

export interface InThreadGeneratorOptions {
  atlas?: RegionAtlasDoc;
  regions?: RegionResolver;
  /** Landmarks and business identities for mapped places (none when omitted). */
  places?: PlacesContent;
  /** Buildings generated between cooperative yields (default 48). */
  yieldEveryBuildings?: number;
}

function yieldToHost(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Generate on the calling thread, yielding to the host between chunks and honouring aborts. */
export function createInThreadWorldgenGenerator(
  pack: ResolvedStylePack,
  options: InThreadGeneratorOptions = {},
): WorldgenGenerator {
  return {
    async generate(
      request: WorldgenGenerateRequest,
      signal: AbortSignal,
    ): Promise<WorldgenTileOutput | undefined> {
      if (signal.aborted) return undefined;
      const grid = tileHeightGrid(request.ground, request.geom, request.resolution);
      const steps = generateWorldgenTileSteps(
        {
          tile: request.tile,
          geom: request.geom,
          ground: createHeightSampler(grid),
          pack,
          ...(options.atlas !== undefined ? { atlas: options.atlas } : {}),
          ...(options.regions !== undefined ? { regions: options.regions } : {}),
          ...(options.places !== undefined ? { places: options.places } : {}),
          ...(request.budgets !== undefined ? { budgets: request.budgets } : {}),
          ...(request.features !== undefined ? { features: request.features } : {}),
          ...(request.tierOffset !== undefined ? { tierOffset: request.tierOffset } : {}),
        },
        options.yieldEveryBuildings ?? 48,
      );
      for (;;) {
        const next = steps.next();
        if (next.done === true) return next.value;
        await yieldToHost();
        if (signal.aborted) return undefined;
      }
    },
    dispose(): void {},
  };
}

/** Serve repeat tiles from the cache; generate (and remember) the rest. */
export function withWorldgenTileCache(
  generator: WorldgenGenerator,
  cache: WorldgenTileCache,
  keyOf: (request: WorldgenGenerateRequest) => string,
): WorldgenGenerator {
  return {
    async generate(request, signal): Promise<WorldgenTileOutput | undefined> {
      const key = keyOf(request);
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const output = await generator.generate(request, signal);
      if (output !== undefined) cache.set(key, output);
      return output;
    },
    dispose(): void {
      generator.dispose();
    },
  };
}
