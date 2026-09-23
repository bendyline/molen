import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
  TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { afterPreparation } from './deferred-renderer';

const tile = {} as TerrainSemanticTile;
const context = (signal: AbortSignal) => ({ signal }) as TerrainPyramidTileLayerContext;

describe('background building material preparation', () => {
  it('does not prepare at construction and publishes tiles only after materials are ready', async () => {
    let finish = () => {};
    const ready = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const prepare = vi.fn(() => ready);
    const mesh = new Group();
    const renderer: TerrainSemanticTileRenderer = {
      createTile: vi.fn(() => mesh),
      disposeTile: vi.fn(),
    };
    const deferred = afterPreparation(renderer, prepare);
    expect(prepare).not.toHaveBeenCalled();
    const controller = new AbortController();
    const pending = deferred.createTile(tile, context(controller.signal));
    expect(renderer.createTile).not.toHaveBeenCalled();
    finish();
    expect(await pending).toBe(mesh);
    expect(renderer.createTile).toHaveBeenCalledWith(tile, context(controller.signal));
    deferred.disposeTile?.(mesh);
    expect(renderer.disposeTile).toHaveBeenCalledWith(mesh);
  });

  it('cancels an obsolete tile immediately without cancelling shared texture preparation', async () => {
    let finish = () => {};
    const ready = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const renderer = { createTile: vi.fn(() => new Group()) };
    const prepare = vi.fn(() => ready);
    const deferred = afterPreparation(renderer, prepare);
    const old = new AbortController();
    const obsolete = deferred.createTile(tile, context(old.signal));
    const current = deferred.createTile(tile, context(new AbortController().signal));
    old.abort();
    expect(await obsolete).toBeUndefined();
    expect(renderer.createTile).not.toHaveBeenCalled();
    finish();
    expect(await current).toBeInstanceOf(Group);
    expect(renderer.createTile).toHaveBeenCalledOnce();
    await deferred.createTile(tile, context(old.signal));
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it('reports preparation failure to the terrain streamer', async () => {
    const renderer = { createTile: vi.fn(() => new Group()) };
    const deferred = afterPreparation(renderer, async () => {
      throw new Error('unavailable');
    });
    await expect(deferred.createTile(tile, context(new AbortController().signal))).rejects.toThrow(
      'unavailable',
    );
    expect(renderer.createTile).not.toHaveBeenCalled();
  });
});
