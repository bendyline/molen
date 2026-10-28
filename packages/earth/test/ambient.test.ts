import { AmbientAgent, signalColor, signalTiming } from '@bendyline/molen-ambient/kernel';
import { World } from '@bendyline/molen-kernel/world';
import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
  TerrainSemanticTileRenderer,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { describe, expect, it, vi } from 'vitest';
import { EarthAmbient } from '../src/client/ambient';
import { observeSemanticTiles, SemanticTileBuffer } from '../src/client/ambient-tiles';
import { earthPerformanceTier } from '../src/client/performance';

const ORIGIN: [number, number] = [5000, -3000];
const SIZE = 400;

function tile(): TerrainSemanticTile {
  return {
    format: 'molen/terrain-semantics@1',
    landcover: [],
    water: [],
    buildings: [],
    transportation: [
      {
        class: 'major_road',
        subclass: 'secondary',
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
      {
        class: 'minor_road',
        subclass: 'residential',
        lines: [
          [
            [0.5, 0],
            [0.5, 1],
          ],
        ],
      },
    ],
  };
}

function context(level = 15): TerrainPyramidTileLayerContext {
  return {
    address: { level, x: 1, z: 2 },
    pyramid: { maxLevel: 15 } as TerrainPyramidTileLayerContext['pyramid'],
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(new Float32Array(9).fill(0.5), 3, 3, {
      origin: ORIGIN,
      worldSize: [SIZE, SIZE],
      height: { min: 0, max: 10 },
    }),
    surfaceResolution: 3,
    origin: ORIGIN,
    tileSize: SIZE,
    signal: new AbortController().signal,
  };
}

function agents(world: World): number {
  return world.query(AmbientAgent).count();
}

describe('semantic tile observation', () => {
  it('reports built tiles (not aborted ones) and their disposal', async () => {
    const built = new THREE.Group();
    const inner: TerrainSemanticTileRenderer = {
      createTile: vi.fn(() => built),
      disposeTile: vi.fn(),
    };
    const buffer = new SemanticTileBuffer();
    const observed = observeSemanticTiles(inner, buffer);
    const aborted = new AbortController();
    aborted.abort();
    await observed.createTile(tile(), { ...context(), signal: aborted.signal });
    expect(await observed.createTile(tile(), context())).toBe(built);
    const target = { added: vi.fn(), removed: vi.fn() };
    buffer.attach(target);
    expect(target.added).toHaveBeenCalledTimes(1);
    observed.disposeTile?.(built);
    expect(target.removed).toHaveBeenCalledWith(built);
    expect(inner.disposeTile).toHaveBeenCalledWith(built);
  });
});

describe('earth ambient life', () => {
  it.each([
    undefined,
    'right',
  ] as const)('resolves tile driving sides with explicit override %s', (override) => {
    const parent = new THREE.Group();
    const layer = new THREE.Group();
    parent.add(layer);
    const drivingSideAt = vi.fn(() => 'left' as const);
    const ambient = new EarthAmbient({
      parent,
      settings: override ? { drivingSide: override } : {},
      drivingSideAt,
    });
    ambient.added(layer, tile(), context());
    ambient.sync(0, { position: [5200, 2, -2800], direction: [0, 0, 1] });
    ambient.handle.flush();
    const roads = [...ambient.handle.network.edgeList()].filter((e) => e.class === 'road');
    expect(roads.length).toBeGreaterThan(0);
    expect(roads.every((e) => e.drivingSide === (override ?? 'left'))).toBe(true);
    if (!override) expect(drivingSideAt).toHaveBeenCalledWith(5200, -2800);
    else expect(drivingSideAt).not.toHaveBeenCalled();
    ambient.dispose();
  });
  // A full signal cycle steps a live traffic world: 6 s on CI, beyond Vitest's 5 s default.
  it('shows the same signal colour as NPC control and invalidates matches on tile unload', () => {
    const parent = new THREE.Group();
    const layer = new THREE.Group();
    parent.add(layer);
    const ambient = new EarthAmbient({ parent, settings: {} });
    const mapped = tile();
    mapped.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    ambient.added(layer, mapped, context());
    ambient.sync(0, { position: [5200, 2, -2800], direction: [0, 0, 1] });
    ambient.handle.flush();
    const junction = [...ambient.handle.network.junctionList()].find((j) => j.control === 'signal');
    expect(junction).toBeDefined();
    if (!junction) throw new Error('Fixture must contain a signalised junction');
    const timing = signalTiming(junction, ambient.world.tickRate);
    const heads = junction.arms.map((arm) => ({
      junction: [junction.x, junction.z] as const,
      direction: [arm.dx, arm.dz] as const,
      radius: junction.radius,
    }));
    const observed = new Set<string>();
    for (let tick = 0; tick <= timing.cycleTicks; tick += 60) {
      if (tick > 0) for (let step = 0; step < 60; step++) ambient.world.step();
      for (const [i, arm] of junction.arms.entries()) {
        const color = ambient.surfaceSignalColor(heads[i] as (typeof heads)[number]);
        expect(color).toBe(
          signalColor(junction, arm.group, ambient.world.tick, ambient.world.tickRate),
        );
        observed.add(color as string);
      }
    }
    expect(observed).toEqual(new Set(['red', 'amber', 'green']));
    const arm = junction.arms[0];
    if (!arm) throw new Error('Fixture must contain a road arm');
    const head = {
      junction: [junction.x, junction.z] as const,
      direction: [arm.dx, arm.dz] as const,
      radius: junction.radius,
    };
    expect(ambient.surfaceSignalColor(head)).toBeDefined();
    ambient.removed(layer);
    ambient.handle.flush();
    expect(ambient.surfaceSignalColor(head)).toBeUndefined();
    ambient.dispose();
  }, 60_000);
  it('spawns traffic on displayed tiles, drops it when the tile hides, and cleans up', () => {
    const parent = new THREE.Group();
    const layer = new THREE.Group();
    parent.add(layer);
    const ambient = new EarthAmbient({
      parent,
      settings: { density: 1, pedestrians: true, rail: false, aircraft: false },
    });
    ambient.setBudget(earthPerformanceTier(3).ambient);
    ambient.added(layer, tile(), context());
    const observer = {
      position: [ORIGIN[0] + SIZE / 2, 2, ORIGIN[1] + SIZE / 2] as [number, number, number],
      direction: [0, 0, 1] as [number, number, number],
    };
    let now = 0;
    for (let i = 0; i < 90; i++) {
      now += 1000 / 60;
      ambient.sync(now, observer);
      ambient.update(1 / 60);
    }
    ambient.render(observer.position, 1 / 60);
    const stats = ambient.stats();
    expect(stats.tiles).toBe(1);
    expect(stats.cars).toBeGreaterThan(0);
    expect(stats.pedestrians).toBeGreaterThan(0);
    // Agents sit on the rendered ground (0.5 × 10 m) plus the road surface lift.
    const [, , t] = [...ambient.world.query(AmbientAgent, { name: 'transform' } as never)][0] as [
      string,
      unknown,
      { pos: number[] },
    ];
    expect(t.pos[1]).toBeGreaterThan(5);
    expect(t.pos[1]).toBeLessThan(6);

    layer.visible = false;
    now += 1000;
    ambient.sync(now, observer);
    ambient.update(1 / 30);
    ambient.update(1 / 30);
    expect(agents(ambient.world)).toBe(0);
    expect(ambient.stats().tiles).toBe(0);

    // A tile object detached without a dispose stops counting and is eventually forgotten.
    layer.visible = true;
    layer.removeFromParent();
    now += 1000;
    ambient.sync(now, observer);
    ambient.update(1 / 30);
    expect(ambient.stats().tiles).toBe(0);

    ambient.dispose();
    expect(parent.children).toEqual([]);
  });

  it('never registers a tile and its parent together, and turns off cleanly', () => {
    const parent = new THREE.Group();
    const ambient = new EarthAmbient({ parent, settings: {} });
    const coarse = new THREE.Group();
    const fine = new THREE.Group();
    parent.add(coarse, fine);
    ambient.added(coarse, tile(), { ...context(14), tileSize: SIZE * 2 });
    ambient.added(fine, tile(), context(15));
    const at = {
      position: [ORIGIN[0] + SIZE / 2, 0, ORIGIN[1] + SIZE / 2] as [number, number, number],
      direction: [0, 0, 1] as [number, number, number],
    };
    // A tile wider than 500 m registers in parts, `<key>:<i>,<j>`, one a tick.
    const tiles = () => [...new Set(ambient.handle.network.tileKeys().map((k) => k.split(':')[0]))];
    ambient.sync(1000, at);
    ambient.sync(2000, at);
    ambient.update(0.1);
    expect(tiles()).toHaveLength(1);
    // The registered one hides (an LOD swap): the other registers on a later sync.
    const first = tiles()[0];
    (first === '15/1/2' ? fine : coarse).visible = false;
    ambient.sync(3000, at);
    ambient.update(0.1);
    expect(tiles()).toHaveLength(1);
    expect(tiles()[0]).not.toBe(first);
    ambient.setEnabled(false);
    expect(ambient.isEnabled).toBe(false);
    ambient.dispose();
  });

  it('registers a large tile in parts, nearest first, one a frame', () => {
    const parent = new THREE.Group();
    const ambient = new EarthAmbient({ parent, settings: {} });
    const coarse = new THREE.Group();
    parent.add(coarse);
    ambient.added(coarse, tile(), { ...context(14), tileSize: SIZE * 2 });
    // In the south-east quarter of the 800 m tile.
    const frame = (ticks = 1) => {
      ambient.sync(1000, {
        position: [ORIGIN[0] + SIZE * 1.5, 0, ORIGIN[1] + SIZE * 1.5],
        direction: [0, 0, 1],
      });
      ambient.update(ticks / 60);
    };
    // A late frame's three catch-up ticks still register one part.
    frame(3);
    // 6 x 6 parts of about 133 m; the observer stands in the fifth row and column.
    expect(ambient.handle.network.tileKeys()).toEqual(['14/1/2:4,4']);
    for (let tick = 1; tick < 36; tick++) frame();
    const parts = [0, 1, 2, 3, 4, 5].flatMap((i) =>
      [0, 1, 2, 3, 4, 5].map((j) => `14/1/2:${i},${j}`),
    );
    expect([...ambient.handle.network.tileKeys()].sort()).toEqual(parts.sort());
    ambient.removed(coarse);
    // The parts leave a few a tick.
    ambient.update(1 / 60);
    expect(ambient.handle.network.tileKeys()).toHaveLength(32);
    for (let tick = 1; tick < 9; tick++) ambient.update(1 / 60);
    expect(ambient.handle.network.tileKeys()).toHaveLength(0);
    ambient.dispose();
  });

  it('reports ambient cars as obstacles to a driven car', () => {
    const world = new World({ tickRate: 60, seed: 'shared' });
    const layer = new THREE.Group();
    const root = new THREE.Group();
    root.add(layer);
    const ambient = new EarthAmbient({
      world,
      parent: root,
      settings: { pedestrians: false, aircraft: false, rail: false },
    });
    ambient.setBudget(earthPerformanceTier(3).ambient);
    ambient.added(layer, tile(), context());
    ambient.sync(1000, {
      position: [ORIGIN[0] + SIZE / 2, 2, ORIGIN[1] + SIZE / 2],
      direction: [0, 0, 1],
    });
    for (let i = 0; i < 120; i++) world.step();
    const [id, , t] = [...world.query(AmbientAgent, { name: 'transform' } as never)][0] as [
      string,
      unknown,
      { pos: [number, number, number] },
    ];
    const box = new OBB(
      new THREE.Vector3(t.pos[0], t.pos[1] + 0.7, t.pos[2]),
      new THREE.Vector3(0.9, 0.7, 2.3),
      new THREE.Matrix3(),
    );
    expect(ambient.blocks(box)).toBe(true);
    expect(ambient.blocks(box, id)).toBe(false);
    box.center.x += 500;
    expect(ambient.blocks(box)).toBe(false);
    ambient.dispose();
  });
});
