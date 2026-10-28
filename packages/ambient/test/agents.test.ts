import { setBoostMode, Transform, World } from '@bendyline/molen-kernel/world';
import { describe, expect, it } from 'vitest';
import { AmbientAgent, installAmbient } from '../src/kernel';
import { gridDocument, loopDocument } from './helpers';

function agents(world: World) {
  return [...world.query(AmbientAgent, Transform)].map(([id, a, t]) => ({ id, a, t }));
}

describe('cars', () => {
  it.each([
    false,
    true,
  ])('follows a loop without overlapping or reversing (boost=%s)', (boosted) => {
    const world = new World({ tickRate: 60, seed: 'loop' });
    setBoostMode(world, boosted);
    const ambient = installAmbient(world, {
      policy: {
        spawnBudget: 20,
        car: { near: 0, far: 500, keep: 1000, perLaneKm: 60, max: 18 },
      },
    });
    ambient.addDocument(loopDocument(75));
    ambient.setObserver({ pos: [0, 0, 0] });
    let maxCount = 0;
    for (let tick = 0; tick < 3000; tick++) {
      world.step();
      const byLane = new Map<string, { s: number; length: number }[]>();
      for (const { a } of agents(world)) {
        expect(a.speed).toBeGreaterThanOrEqual(0);
        const list = byLane.get(a.lane) ?? [];
        list.push({ s: a.s, length: a.length });
        byLane.set(a.lane, list);
      }
      for (const list of byLane.values()) {
        list.sort((x, y) => x.s - y.s);
        for (let i = 1; i < list.length; i++) {
          const gap =
            (list[i]?.s ?? 0) -
            (list[i - 1]?.s ?? 0) -
            ((list[i]?.length ?? 0) + (list[i - 1]?.length ?? 0)) / 2;
          expect(gap).toBeGreaterThan(-0.05);
        }
      }
      maxCount = Math.max(maxCount, agents(world).length);
    }
    expect(maxCount).toBeGreaterThanOrEqual(15);
    expect(maxCount).toBeLessThanOrEqual(18);
    // Traffic keeps moving.
    const moving = agents(world).filter(({ a }) => a.speed > 1).length;
    expect(moving).toBeGreaterThan(0);
  });

  it.each([false, true])('keeps cars apart on a street grid (boost=%s)', (boosted) => {
    const world = new World({ tickRate: 30, seed: 'grid' });
    setBoostMode(world, boosted);
    const ambient = installAmbient(world, {
      policy: { spawnBudget: 8, car: { near: 0, far: 400, keep: 800, perLaneKm: 30, max: 60 } },
    });
    ambient.addDocument(gridDocument(3, 90));
    ambient.setObserver({ pos: [0, 0, 0] });
    let passed = 0;
    for (let tick = 0; tick < 1800; tick++) {
      world.step();
      const list = agents(world);
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const p = list[i]?.t.pos ?? [0, 0, 0];
          const q = list[j]?.t.pos ?? [0, 0, 0];
          const distance = Math.hypot(p[0] - q[0], p[2] - q[2]);
          if (distance < 1.2)
            throw new Error(
              `tick ${tick}: ${list[i]?.id} and ${list[j]?.id} overlap (${distance.toFixed(2)} m) on ${list[i]?.a.lane} / ${list[j]?.a.lane}`,
            );
        }
      passed += list.filter(({ a }) => a.hops > 0).length;
    }
    expect(agents(world).length).toBeGreaterThan(20);
    expect(passed).toBeGreaterThan(0);
  });
});

describe('spawning around the observer', () => {
  it('fills the ring, avoids the near zone and cleans up behind a moving observer', () => {
    const world = new World({ tickRate: 30, seed: 'ring' });
    const ambient = installAmbient(world, {
      policy: { car: { near: 80, far: 300, keep: 380, perLaneKm: 10, max: 500 } },
    });
    ambient.addDocument(gridDocument(12, 100));
    ambient.setObserver({ pos: [0, 0, 0], forward: [1, 0] });
    world.stepN(20);
    const early = agents(world);
    expect(early.length).toBeGreaterThan(0);
    for (const { t } of early) {
      const d = Math.hypot(t.pos[0], t.pos[2]);
      expect(d).toBeGreaterThan(79);
      expect(d).toBeLessThan(381);
      // Nothing pops in ahead of the viewer close by.
      if (d < 150) expect(t.pos[0] / d).toBeLessThan(0.83);
    }
    world.stepN(600);
    const settled = agents(world).length;
    const target = Math.round((ambient.network.grid.laneMeters(0, 0, 300, 'road') / 1000) * 10);
    expect(settled).toBeGreaterThan(target * 0.6);
    expect(settled).toBeLessThanOrEqual(target + 4);
    // Move the observer far away: everything near the old spot goes.
    ambient.setObserver({ pos: [520, 0, 520] });
    world.stepN(5);
    for (const { t } of agents(world))
      expect(Math.hypot(t.pos[0] - 520, t.pos[2] - 520)).toBeLessThanOrEqual(381);
  });

  it('takes its radius and density from the observer entity', () => {
    const world = new World({ tickRate: 30, seed: 'observer' });
    const ambient = installAmbient(world, { policy: { car: { perLaneKm: 10, max: 500 } } });
    ambient.addDocument(gridDocument(12, 100));
    world.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        ambientObserver: { radius: 150, despawnRadius: 200, density: 2 },
      },
      'watcher',
    );
    world.stepN(600);
    const cars = agents(world);
    for (const { t } of cars) expect(Math.hypot(t.pos[0], t.pos[2])).toBeLessThanOrEqual(201);
    const target = Math.round((ambient.network.grid.laneMeters(0, 0, 150, 'road') / 1000) * 20);
    expect(cars.length).toBeGreaterThan(target * 0.6);
    expect(cars.length).toBeLessThanOrEqual(target + 4);
  });

  it('trims to a lowered cap, farthest first', () => {
    const world = new World({ tickRate: 30, seed: 'trim' });
    const ambient = installAmbient(world, {
      policy: { spawnBudget: 20, car: { near: 0, far: 400, keep: 800, perLaneKm: 30, max: 80 } },
    });
    ambient.addDocument(gridDocument(6, 100));
    ambient.setObserver({ pos: [0, 0, 0] });
    world.stepN(300);
    expect(agents(world).length).toBeGreaterThan(40);
    ambient.setBudget({ cars: 10 });
    world.stepN(60);
    expect(agents(world).length).toBe(10);
    ambient.setBudget({ cars: 0 });
    world.stepN(10);
    expect(agents(world)).toHaveLength(0);
  });

  it('removes agents whose tile is unregistered', () => {
    const world = new World({ tickRate: 30, seed: 'tiles' });
    const ambient = installAmbient(world, {
      policy: { car: { near: 0, far: 400, keep: 800, perLaneKm: 20, max: 100 } },
    });
    ambient.registerTile({
      key: 'T',
      origin: [-200, -200],
      tileSize: 400,
      features: [
        {
          class: 'minor_road',
          subclass: 'residential',
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
    });
    ambient.setObserver({ pos: [0, 0, 0] });
    world.stepN(120);
    expect(agents(world).length).toBeGreaterThan(0);
    ambient.unregisterTile('T');
    world.stepN(2);
    expect(agents(world)).toHaveLength(0);
  });

  it('applies queued tile registrations at the paced rate, removals first', () => {
    const world = new World({ tickRate: 30, seed: 'paced' });
    const ambient = installAmbient(world, { registrationsPerTick: 1 });
    const tile = (key: string, x: number) => ({
      key,
      origin: [x, 0] as [number, number],
      tileSize: 100,
      features: [
        {
          class: 'minor_road',
          subclass: 'residential',
          lines: [
            [
              [0, 0.5],
              [1, 0.5],
            ],
          ],
        },
      ],
    });
    ambient.registerTile(tile('A', 0));
    ambient.registerTile(tile('B', 100));
    ambient.registerTile(tile('C', 200));
    world.step();
    expect(ambient.network.tileKeys()).toEqual(['A']);
    expect(ambient.stats().pendingTiles).toBe(2);
    // A leaves at once; C, still queued, never registers.
    ambient.unregisterTile('A');
    ambient.unregisterTile('C');
    world.step();
    expect(ambient.network.tileKeys()).toEqual(['B']);
    expect(ambient.stats().pendingTiles).toBe(0);
  });

  it('paces removals, and a returning tile waits behind its own removal', () => {
    const world = new World({ tickRate: 30, seed: 'paced-removals' });
    const ambient = installAmbient(world, { registrationsPerTick: 1, removalsPerTick: 1 });
    const tile = (key: string, x: number, y = 0.5) => ({
      key,
      origin: [x, 0] as [number, number],
      tileSize: 100,
      features: [
        {
          class: 'minor_road',
          subclass: 'residential',
          lines: [
            [
              [0, y],
              [1, y],
            ],
          ],
        },
      ],
    });
    ambient.registerTile(tile('A', 0));
    ambient.registerTile(tile('B', 100));
    ambient.flush();
    expect(ambient.network.tileKeys().sort()).toEqual(['A', 'B']);
    ambient.unregisterTile('A');
    ambient.unregisterTile('B');
    // A returns, with another road, before either removal has been applied.
    ambient.registerTile(tile('A', 0, 0.25));
    world.step();
    // One removal (A's), then A's registration after it; B's removal waits for the next tick.
    expect(ambient.network.tileKeys().sort()).toEqual(['A', 'B']);
    expect(ambient.stats().pendingTiles).toBe(1);
    world.step();
    expect(ambient.network.tileKeys()).toEqual(['A']);
    expect(ambient.stats().pendingTiles).toBe(0);
  });

  it('holds a registration behind its own removal left for a later tick', () => {
    const world = new World({ tickRate: 30, seed: 'held' });
    const ambient = installAmbient(world, { registrationsPerTick: 4, removalsPerTick: 1 });
    const tile = (key: string, x: number) => ({
      key,
      origin: [x, 0] as [number, number],
      tileSize: 100,
      features: [
        {
          class: 'minor_road',
          subclass: 'residential',
          lines: [
            [
              [0, 0.5],
              [1, 0.5],
            ],
          ],
        },
      ],
    });
    ambient.registerTile(tile('A', 0));
    ambient.registerTile(tile('B', 100));
    ambient.flush();
    const removedVersion = (): number => ambient.network.version;
    ambient.unregisterTile('A');
    ambient.unregisterTile('B');
    ambient.registerTile(tile('B', 100));
    const before = removedVersion();
    world.step();
    // A's removal spent the tick's one; B's removal and its registration both wait.
    expect(ambient.network.tileKeys()).toEqual(['B']);
    expect(ambient.stats().pendingTiles).toBe(2);
    expect(removedVersion()).toBeGreaterThan(before);
    world.step();
    // B's removal, then its registration: B stands again, rebuilt.
    expect(ambient.network.tileKeys()).toEqual(['B']);
    expect(ambient.stats().pendingTiles).toBe(0);
  });
});
