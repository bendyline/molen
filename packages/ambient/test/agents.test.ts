import { Transform, World } from '@bendyline/molen-kernel/world';
import { describe, expect, it } from 'vitest';
import { AmbientAgent, installAmbient } from '../src/kernel';
import { gridDocument, loopDocument } from './helpers';

function agents(world: World) {
  return [...world.query(AmbientAgent, Transform)].map(([id, a, t]) => ({ id, a, t }));
}

describe('cars', () => {
  it('follow each other around a loop without overlapping or reversing', () => {
    const world = new World({ tickRate: 60, seed: 'loop' });
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

  it('never let two cars occupy the same spot on a street grid', () => {
    const world = new World({ tickRate: 30, seed: 'grid' });
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
  }, 30_000); // Steps 1800 ticks, checking every pair of cars each tick; ~4s on a loaded CI runner.
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
});
