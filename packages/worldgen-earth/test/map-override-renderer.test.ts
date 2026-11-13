import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { withMapOverrides } from '../src/client/map-overrides';
import { createMapOverrideSet, type MapOverride } from '../src/kernel/map-overrides';

/** A finest-level 200 m tile at the world origin; world meters are projected meters. */
function context(metersPerUnit?: number): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 0, z: 0 },
    tileSize: 200,
    origin: [0, 0],
    pyramid: {
      name: 'map-override-test',
      origin: [0, 0],
      rootSize: 1600,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 3,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
      ...(metersPerUnit !== undefined ? { metersPerUnit } : {}),
    },
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(new Float32Array(9), 3, 3, {
      origin: [0, 0],
      worldSize: [200, 200],
      height: { min: 0, max: 20 },
    }),
    signal: new AbortController().signal,
  };
}

/** A renderer that records the tiles it is handed. */
function recorder(withEmpty = true) {
  const object = new THREE.Group();
  const empty = new THREE.Group();
  const createTile = vi.fn(
    (_tile: TerrainSemanticTile, _context: TerrainPyramidTileLayerContext) => object,
  );
  const createEmptyTile = vi.fn((_context: TerrainPyramidTileLayerContext) => empty);
  const disposeTile = vi.fn();
  const renderer: TerrainSemanticTileRenderer = {
    createTile,
    disposeTile,
    ...(withEmpty ? { createEmptyTile } : {}),
  };
  const handed = (call = createTile.mock.calls.length - 1): TerrainSemanticTile =>
    createTile.mock.calls[call]?.[0] as TerrainSemanticTile;
  return { renderer, object, empty, createTile, createEmptyTile, disposeTile, handed };
}

/** An 80 m by 60 m rectangle around world (100, 100): u 0.3..0.7, v 0.35..0.65 of the tile. */
const lot = (extra: Partial<MapOverride> = {}): MapOverride => ({
  id: 'lot',
  area: { center: worldToWgs84(1, 100, 100), size: [80, 60] },
  // The test pyramid's finest level is 3.
  minLevel: 0,
  ...extra,
});
const box = (minX: number, minZ: number, maxX: number, maxZ: number): TerrainSemanticPolygon => ({
  outer: [
    [minX / 200, minZ / 200],
    [maxX / 200, minZ / 200],
    [maxX / 200, maxZ / 200],
    [minX / 200, maxZ / 200],
  ],
});
const mapped = (): TerrainSemanticTile => ({
  ...createEmptyTerrainSemanticTile(),
  buildings: [
    { id: 'inside', polygons: [box(90, 90, 110, 110)] },
    { id: 'outside', polygons: [box(10, 10, 30, 30)] },
  ],
});

describe('map overrides in a tile renderer', () => {
  it('is the renderer itself without a set', () => {
    const { renderer } = recorder();
    expect(withMapOverrides(renderer, undefined)).toBe(renderer);
  });

  it('passes a tile no override reaches through as it is', async () => {
    const r = recorder();
    const set = createMapOverrideSet<MapOverride>();
    const wrapped = withMapOverrides(r.renderer, set);
    const tile = mapped();
    expect(await wrapped.createTile(tile, context())).toBe(r.object);
    expect(r.handed()).toBe(tile);
    // Elsewhere on the map, and one that only edits finer tiles than this pyramid has.
    set.set(lot({ id: 'far', area: { center: [1, 0], size: [80, 60] } }));
    set.set(lot({ id: 'fine', minLevel: 10 }));
    await wrapped.createTile(tile, context());
    expect(r.handed()).toBe(tile);
    expect(r.createTile).toHaveBeenCalledTimes(2);
    expect(r.createTile.mock.calls[1]?.[1]).toMatchObject({ tileSize: 200 });
  });

  it('edits a reached tile once per edit', async () => {
    const r = recorder();
    const set = createMapOverrideSet<MapOverride>([lot()]);
    const wrapped = withMapOverrides(r.renderer, set);
    const tile = mapped();
    const tileContext = context();
    expect(await wrapped.createTile(tile, tileContext)).toBe(r.object);
    const first = r.handed();
    expect(first).not.toBe(tile);
    expect(first.buildings.map((feature) => feature.id)).toEqual(['outside']);
    expect(first.landcover.at(-1)).toMatchObject({ class: 'cleared', density: 0 });
    // The source tile is never changed.
    expect(tile.buildings).toHaveLength(2);
    expect(tile.landcover).toEqual([]);
    // The same tile under the same overrides: the object the caches downstream already know.
    await wrapped.createTile(tile, context());
    expect(r.handed()).toBe(first);
    // Another tile object is edited on its own.
    await wrapped.createTile(mapped(), tileContext);
    expect(r.handed()).not.toBe(first);
    expect(r.handed().buildings.map((feature) => feature.id)).toEqual(['outside']);
    // A changed override is another edit of the same tile.
    set.set(lot({ surface: 'plaza', buildings: [{ id: 'shed', rect: { size: [20, 10] } }] }));
    await wrapped.createTile(tile, tileContext);
    const second = r.handed();
    expect(second).not.toBe(first);
    expect(second.buildings.map((feature) => feature.id)).toEqual(['outside', 'override:lot:shed']);
    expect(second.landcover.at(-1)).toMatchObject({ class: 'cleared', subclass: 'pedestrian' });
    await wrapped.createTile(tile, tileContext);
    expect(r.handed()).toBe(second);
    // Removed: the tile as mapped again.
    set.delete('lot');
    await wrapped.createTile(tile, tileContext);
    expect(r.handed()).toBe(tile);
  });

  it('builds what a host placed where the map has no tile, over an open-ground base', async () => {
    const r = recorder();
    const set = createMapOverrideSet<MapOverride>([
      lot({ buildings: [{ id: 'shed', rect: { size: [20, 10] }, height: 6 }] }),
    ]);
    const wrapped = withMapOverrides(r.renderer, set);
    expect(await wrapped.createEmptyTile?.(context())).toBe(r.object);
    expect(r.createEmptyTile).not.toHaveBeenCalled();
    expect(r.createTile).toHaveBeenCalledOnce();
    const tile = r.handed();
    expect(tile.buildings.map((feature) => feature.id)).toEqual(['override:lot:shed']);
    // No map data is not evidence of open country: the base keeps the tile from being scattered.
    expect(tile.landcover[0]).toEqual({
      class: 'open_ground',
      density: 0,
      polygons: [
        {
          outer: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        },
      ],
    });
    expect(tile.landcover.map((feature) => feature.class)).toEqual(['open_ground', 'cleared']);
    // The host's building alone, with nothing cleared, still gets the base.
    set.set(
      lot({
        clear: { vegetation: false },
        buildings: [{ id: 'shed', rect: { size: [20, 10] }, height: 6 }],
      }),
    );
    await wrapped.createEmptyTile?.(context());
    expect(r.handed().landcover.map((feature) => feature.class)).toEqual(['open_ground']);
    expect(r.handed().buildings).toHaveLength(1);
  });

  it('leaves an empty tile nothing reaches to the wrapped renderer', async () => {
    const r = recorder();
    const set = createMapOverrideSet<MapOverride>([
      lot({ id: 'far', area: { center: [1, 0], size: [80, 60] } }),
      // Reaches the tile, and has nothing to clear from it or place on it.
      lot({ id: 'idle', clear: { vegetation: false } }),
    ]);
    expect(await withMapOverrides(r.renderer, set).createEmptyTile?.(context())).toBe(r.empty);
    expect(r.createEmptyTile).toHaveBeenCalledOnce();
    expect(r.createTile).not.toHaveBeenCalled();
    // A wrapped renderer that draws nothing for a missing tile still draws nothing.
    const bare = recorder(false);
    expect(await withMapOverrides(bare.renderer, set).createEmptyTile?.(context())).toBeUndefined();
    expect(bare.createTile).not.toHaveBeenCalled();
  });

  it('forwards the disposal of a tile', () => {
    const r = recorder();
    const wrapped = withMapOverrides(r.renderer, createMapOverrideSet<MapOverride>([lot()]));
    wrapped.disposeTile?.(r.object);
    expect(r.disposeTile).toHaveBeenCalledExactlyOnceWith(r.object);
    // A renderer without one is not asked.
    const { disposeTile: _disposeTile, ...rest } = recorder().renderer;
    expect(() =>
      withMapOverrides(rest, createMapOverrideSet<MapOverride>()).disposeTile?.(r.object),
    ).not.toThrow();
  });

  it("places overrides by the tile pyramid's world scale, or the one it is given", async () => {
    // World meters at half the projected scale: the rectangle around projected (200, 200)
    // stands around world (100, 100).
    const set = createMapOverrideSet<MapOverride>([
      lot({ area: { center: worldToWgs84(1, 200, 200), size: [80, 60] } }),
    ]);
    const scaled = recorder();
    await withMapOverrides(scaled.renderer, set).createTile(mapped(), context(0.5));
    expect(scaled.handed().buildings.map((feature) => feature.id)).toEqual(['outside']);
    // Told the scale is 1, the same rectangle stands at the tile's far corner instead.
    const told = recorder();
    await withMapOverrides(told.renderer, set, { metersPerUnit: 1 }).createTile(
      mapped(),
      context(0.5),
    );
    expect(told.handed().buildings.map((feature) => feature.id)).toEqual(['inside', 'outside']);
  });
});
