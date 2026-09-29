import type { TerrainSemanticTileRenderer } from '@bendyline/molen-terrain/client';

// Defer tiles that need shared preparation (e.g. baked building materials) without delaying
// startup: terrain, water and navigation run while preparation finishes, and cancellation stays
// prompt because an aborted tile never waits on it.

/** Keep shared preparation off startup; only tiles that need it wait, and cancellation stays prompt. */
export function afterPreparation(
  renderer: TerrainSemanticTileRenderer,
  prepare: () => Promise<void>,
): TerrainSemanticTileRenderer {
  return {
    ...renderer,
    async createTile(tile, context) {
      if (context.signal.aborted) return undefined;
      let onAbort = (): void => {};
      const cancelled = new Promise<false>((resolve) => {
        onAbort = () => resolve(false);
        context.signal.addEventListener('abort', onAbort, { once: true });
      });
      try {
        const ready = await Promise.race([prepare().then(() => true), cancelled]);
        if (!ready || context.signal.aborted) return undefined;
        return await renderer.createTile(tile, context);
      } finally {
        context.signal.removeEventListener('abort', onAbort);
      }
    },
  };
}
