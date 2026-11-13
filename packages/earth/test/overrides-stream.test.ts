// Map overrides end to end, without the Earth view around them: a real terrain pyramid stream
// with a real semantic layer over tiles held in memory, its renderer wrapped by the real
// `withMapOverrides` over a real override set, bound by the real `bindMapOverrides`. Only the
// innermost renderer is a stand-in: it records the tile it is handed and returns a named group.

import {
  createTerrainPyramidStream,
  createTerrainSemanticPyramidLayer,
  type TerrainSemanticTile,
  type TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidTileKey,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import { withMapOverrides } from '@bendyline/molen-worldgen-earth/client';
import {
  createMapOverrideSet,
  type MapOverride,
  mapOverridePoint,
} from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { bindMapOverrides, type MapOverrideBindingChange } from '../src/client/overrides';

// On the equator a frame meter is a projected meter, and with `metersPerUnit` 1 a world unit too.
// The pyramid is one 1600 m root over four 800 m tiles; the override stands in the middle of the
// north-west one, far enough from its edges that the rebuild margin stays inside it.
const ORIGIN: [number, number] = [10, 0];
const [CX] = wgs84ToWorld(1, ORIGIN[0], ORIGIN[1]);
const TILE = 800;
const descriptor: TerrainPyramidDescriptor = {
  name: 'override-stream-test',
  origin: [CX - TILE, -TILE],
  rootSize: TILE * 2,
  minLevel: 0,
  maxLevel: 1,
  tileResolution: 3,
  height: { min: 0, max: 100 },
  layers: [{ name: 'ground', color: '#668855', tiling: 1 }],
  skirts: true,
};
const REACHED = '1/0/0';
const UNREACHED = ['1/1/0', '1/0/1', '1/1/1'];
const HIGH = {
  position: [CX - TILE / 2, 2_000_000, -TILE / 2] as [number, number, number],
  verticalFov: Math.PI / 2,
  viewportHeight: 1_000,
};
const NEAR = { ...HIGH, position: [CX - 600, 1_000, -600] as [number, number, number] };

function lot(height = 9): MapOverride {
  const center = mapOverridePoint({ center: ORIGIN, heading: 0 }, [-TILE / 2, -TILE / 2]);
  return {
    id: 'lot',
    // The pyramid's levels are 0 and 1: far coarser than an override edits by default.
    minLevel: 0,
    area: { center, size: [80, 60] },
    buildings: [{ id: 'shed', rect: { size: [48, 30] }, height }],
  };
}

function flatTile(address: TerrainPyramidTileAddress): Heightfield {
  const size = terrainPyramidTileSize(descriptor, address.level);
  return new Heightfield(new Float32Array(9).fill(address.level / 4), 3, 3, {
    origin: terrainPyramidTileOrigin(descriptor, address),
    worldSize: [size, size],
    height: descriptor.height,
  });
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
async function until(done: () => boolean, limit = 200): Promise<void> {
  for (let i = 0; i < limit && !done(); i++) await tick();
}

interface Build {
  key: string;
  version: number;
  tile: TerrainSemanticTile;
  object: THREE.Object3D;
}

/** The four fine tiles on screen with the root resident behind them, bound to an empty set. */
async function setup() {
  // One tile object per address for the life of the test, as a decoded-tile cache hands them out.
  const sources = new Map<string, TerrainSemanticTile>();
  const source = {
    load: async (address: TerrainPyramidTileAddress): Promise<TerrainSemanticTile> => {
      const key = terrainPyramidTileKey(address);
      let tile = sources.get(key);
      if (tile === undefined) {
        tile = createEmptyTerrainSemanticTile();
        // A mapped building in a corner the override never comes near.
        tile.buildings.push({
          id: `mapped:${key}`,
          polygons: [
            {
              outer: [
                [0.9, 0.9],
                [0.95, 0.9],
                [0.95, 0.95],
                [0.9, 0.95],
              ],
            },
          ],
        });
        sources.set(key, tile);
      }
      return tile;
    },
  };
  const builds: Build[] = [];
  const disposed: THREE.Object3D[] = [];
  const held: Array<{ key: string; finish(): void }> = [];
  const state: { hold: boolean } = { hold: false };
  const inner: TerrainSemanticTileRenderer = {
    createTile(tile, context) {
      const key = terrainPyramidTileKey(context.address);
      const version = builds.filter((build) => build.key === key).length + 1;
      const object = new THREE.Group();
      object.name = `features:${key}:v${version}`;
      builds.push({ key, version, tile, object });
      if (!state.hold) return object;
      return new Promise<THREE.Object3D>((resolve) =>
        held.push({ key, finish: () => resolve(object) }),
      );
    },
    disposeTile(object) {
      disposed.push(object);
    },
  };
  const set = createMapOverrideSet<MapOverride>();
  const layer = createTerrainSemanticPyramidLayer({
    id: 'human-features',
    category: 'human-feature',
    source,
    renderer: withMapOverrides(inner, set, { metersPerUnit: 1 }),
  });
  const stream = createTerrainPyramidStream(
    descriptor,
    { load: async (address) => flatTile(address) },
    {
      initialView: HIGH,
      maxScreenSpaceError: 1,
      viewDistance: 3_000_000,
      maxSelectedTiles: 8,
      maxConcurrentLoads: 4,
      maxConcurrentLayerLoads: 8,
      maxResidentTiles: 16,
      retryDelayMs: 1,
      layers: [layer],
    },
  );
  await stream.whenIdle();
  stream.update(NEAR);
  await stream.whenIdle();
  const changes: MapOverrideBindingChange[] = [];
  const refreshLayers = vi.fn((refresh: Parameters<typeof stream.refreshLayers>[0]) =>
    stream.refreshLayers(refresh),
  );
  const binding = bindMapOverrides(set, {
    stream: { refreshLayers },
    metersPerUnit: 1,
    layers: [layer],
    onChange: (change) => changes.push(change),
  });
  const versions = (key: string): number => builds.filter((build) => build.key === key).length;
  const latest = (key: string): Build | undefined =>
    builds.filter((build) => build.key === key).at(-1);
  const drawn = (name: string): boolean => stream.object.getObjectByName(name)?.visible === true;
  return {
    set,
    stream,
    binding,
    sources,
    builds,
    disposed,
    held,
    state,
    changes,
    refreshLayers,
    versions,
    latest,
    drawn,
  };
}

describe('map overrides over a terrain stream', () => {
  it('rebuilds the tile an override reaches, in one step, and leaves the others alone', async () => {
    const t = await setup();
    try {
      expect(t.stream.displayedTiles().map(terrainPyramidTileKey).sort()).toEqual(
        [REACHED, ...UNREACHED].sort(),
      );
      for (const key of [REACHED, ...UNREACHED]) expect(t.versions(key)).toBe(1);
      expect(t.latest(REACHED)?.tile).toBe(t.sources.get(REACHED));
      expect(t.drawn(`features:${REACHED}:v1`)).toBe(true);

      t.state.hold = true;
      t.set.set(lot());
      let applied = false;
      void t.binding.whenApplied().then(() => {
        applied = true;
      });
      // Nothing is asked of the stream until the task that changed the set is over.
      expect(t.refreshLayers).not.toHaveBeenCalled();
      await until(() => t.held.length > 0);
      // One rebuild, of the one tile on screen the override reaches, from the edited map: the
      // host's building is in it beside what was mapped there, and the source tile is untouched.
      expect(t.held.map((build) => build.key)).toEqual([REACHED]);
      expect(t.refreshLayers).toHaveBeenCalledTimes(1);
      expect(t.refreshLayers.mock.calls[0]?.[0].layers).toEqual(['human-features']);
      const rebuilt = t.latest(REACHED);
      expect(rebuilt?.version).toBe(2);
      expect(rebuilt?.tile).not.toBe(t.sources.get(REACHED));
      expect(rebuilt?.tile.buildings.map((feature) => feature.id)).toEqual([
        `mapped:${REACHED}`,
        'override:lot:shed',
      ]);
      expect(t.sources.get(REACHED)?.buildings.map((feature) => feature.id)).toEqual([
        `mapped:${REACHED}`,
      ]);
      for (const key of UNREACHED) expect(t.versions(key)).toBe(1);
      // Meanwhile the view goes on showing what stood there, and nobody is told it is done.
      expect(t.drawn(`features:${REACHED}:v1`)).toBe(true);
      expect(t.disposed.map((object) => object.name)).not.toContain(`features:${REACHED}:v1`);
      expect(applied).toBe(false);
      expect(t.binding.pending).toBe(1);
      expect(t.changes.map((change) => change.state)).toEqual(['pending']);

      // What the scene held at the moment the old object was handed back.
      const old = t.stream.object.getObjectByName(`features:${REACHED}:v1`);
      t.held[0]?.finish();
      await t.binding.whenApplied();
      await tick();
      expect(applied).toBe(true);
      expect(t.binding.pending).toBe(0);
      expect(t.drawn(`features:${REACHED}:v2`)).toBe(true);
      expect(t.stream.object.getObjectByName(`features:${REACHED}:v1`)).toBeUndefined();
      expect(old?.parent).toBeNull();
      expect(t.disposed.filter((object) => object === old)).toHaveLength(1);
      for (const key of UNREACHED) {
        expect(t.versions(key)).toBe(1);
        expect(t.drawn(`features:${key}:v1`)).toBe(true);
      }
      expect(t.changes.map((change) => [change.state, change.ids, change.revision])).toEqual([
        ['pending', ['lot'], 1],
        ['applied', ['lot'], 1],
      ]);
    } finally {
      t.binding.dispose();
      t.stream.dispose();
    }
  });

  it('applies the changes of one task as one rebuild, and gives the mapped tile back on delete', async () => {
    const t = await setup();
    try {
      // Set, and set again taller, before the task ends.
      t.set.set(lot(9));
      t.set.set(lot(12));
      expect(t.binding.pending).toBe(1);
      await t.binding.whenApplied();
      await t.stream.whenIdle();
      // One round: the ground of both changes asked for together, one tile built once, with the
      // override as it stood at the end of the task.
      expect(t.changes.map((change) => change.state)).toEqual(['pending', 'applied']);
      expect(t.changes[0]?.revision).toBe(2);
      expect(t.refreshLayers).toHaveBeenCalledTimes(t.changes[0]?.bounds.length ?? 0);
      expect(t.versions(REACHED)).toBe(2);
      expect(
        t.latest(REACHED)?.tile.buildings.find((feature) => feature.id === 'override:lot:shed')
          ?.height,
      ).toBe(12);
      expect(t.drawn(`features:${REACHED}:v2`)).toBe(true);
      for (const key of UNREACHED) expect(t.versions(key)).toBe(1);

      // Removed: the tile is built again from the very object the source holds.
      expect(t.set.delete('lot')).toBe(true);
      await t.binding.whenApplied();
      await t.stream.whenIdle();
      expect(t.versions(REACHED)).toBe(3);
      expect(t.latest(REACHED)?.tile).toBe(t.sources.get(REACHED));
      expect(t.drawn(`features:${REACHED}:v3`)).toBe(true);
      expect(t.stream.object.getObjectByName(`features:${REACHED}:v2`)).toBeUndefined();
      expect(
        t.disposed.filter((object) => object.name.startsWith(`features:${REACHED}:`)),
      ).toHaveLength(2);
      for (const key of UNREACHED) expect(t.versions(key)).toBe(1);
    } finally {
      t.binding.dispose();
      t.stream.dispose();
    }
  });

  it('follows the set no more once disposed, and settles whoever was waiting', async () => {
    const t = await setup();
    try {
      // Disposed with a rebuild under way: the wait ends, and no "applied" is announced by a
      // binding that is gone (a view that re-anchors builds its next stream already edited).
      t.state.hold = true;
      t.set.set(lot());
      await until(() => t.held.length > 0);
      const waiting = t.binding.whenApplied();
      t.binding.dispose();
      t.held[0]?.finish();
      await waiting;
      await t.stream.whenIdle();
      expect(t.changes.map((change) => change.state)).toEqual(['pending']);
      t.state.hold = false;
      const calls = t.refreshLayers.mock.calls.length;
      const built = t.builds.length;
      t.set.set(lot(20));
      t.set.delete('lot');
      await tick();
      await tick();
      await t.stream.whenIdle();
      expect(t.refreshLayers).toHaveBeenCalledTimes(calls);
      expect(t.builds).toHaveLength(built);
      expect(t.changes.map((change) => change.state)).toEqual(['pending']);
    } finally {
      t.stream.dispose();
    }
  });
});
