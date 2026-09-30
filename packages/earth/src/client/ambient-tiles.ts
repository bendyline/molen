import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
  TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import type * as THREE from 'three';

/** Told when a human-features tile is built (with its decoded data) and when it is disposed. */
export interface SemanticTileObserver {
  added(
    object: THREE.Object3D,
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): void;
  removed(object: THREE.Object3D): void;
}

/**
 * Wrap a semantic tile renderer so an observer sees each decoded tile and its context (origin,
 * size, heightfield) on the main thread, whether or not its surfaces were built in a worker, and
 * learns when the stream evicts it. The decoded tile is otherwise dropped after rendering.
 */
export function observeSemanticTiles(
  renderer: TerrainSemanticTileRenderer,
  observer: SemanticTileObserver,
): TerrainSemanticTileRenderer {
  return {
    async createTile(tile, context) {
      const object = await renderer.createTile(tile, context);
      if (object !== undefined && !context.signal.aborted) observer.added(object, tile, context);
      return object;
    },
    disposeTile(object) {
      observer.removed(object);
      renderer.disposeTile?.(object);
    },
  };
}

/** Buffers observations until a consumer attaches (the tile layer is built before it). */
export class SemanticTileBuffer implements SemanticTileObserver {
  private target: SemanticTileObserver | undefined;
  private readonly queued = new Map<
    THREE.Object3D,
    { tile: TerrainSemanticTile; context: TerrainPyramidTileLayerContext }
  >();

  added(
    object: THREE.Object3D,
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): void {
    if (this.target !== undefined) this.target.added(object, tile, context);
    else this.queued.set(object, { tile, context });
  }

  removed(object: THREE.Object3D): void {
    if (this.target !== undefined) this.target.removed(object);
    else this.queued.delete(object);
  }

  attach(target: SemanticTileObserver): void {
    this.target = target;
    for (const [object, { tile, context }] of this.queued) target.added(object, tile, context);
    this.queued.clear();
  }

  detach(): void {
    this.target = undefined;
  }
}
