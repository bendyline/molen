import { Transform, World } from '@bendyline/molen-kernel/world';
import { describe, expect, it } from 'vitest';
import { AmbientAgent, installAmbient } from '../src/kernel';
import { gridDocument } from './helpers';

function list(world: World, kind: string) {
  return [...world.query(AmbientAgent, Transform)]
    .filter(([, a]) => a.kind === kind)
    .map(([id, a, t]) => ({ id, a, t }));
}

describe('pedestrians', () => {
  it('walk the sidewalks and cross streets', () => {
    const world = new World({ tickRate: 30, seed: 'walk' });
    const ambient = installAmbient(world, {
      classes: ['pedestrian'],
      policy: { pedestrian: { near: 0, far: 200, keep: 300, perLaneKm: 15, max: 40 } },
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
    world.stepN(30 * 90);
    const walkers = list(world, 'pedestrian');
    expect(walkers.length).toBeGreaterThan(10);
    for (const { a } of walkers) {
      expect(a.speed).toBeLessThan(1.8);
      expect(ambient.network.lane(a.lane)?.class).toBe('walk');
    }
    expect(walkers.some(({ a }) => a.hops > 0)).toBe(true);
  });
});

describe('trains', () => {
  it('run consists that keep their spacing and dwell at stations', () => {
    const world = new World({ tickRate: 30, seed: 'rail' });
    const ambient = installAmbient(world, {
      classes: ['train'],
      policy: { train: { near: 0, far: 3000, keep: 5000, perLaneKm: 5, max: 1 } },
      types: { train: [{ id: 'lrv', length: 27, width: 2.65, cars: 3 }] },
    });
    ambient.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'rail',
          subclass: 'tram',
          points: [
            [-1500, 0],
            [1500, 0],
          ],
        },
      ],
      stations: [
        { id: 'west', at: [-600, 0], kind: 'rail' },
        { id: 'east', at: [600, 0], kind: 'rail' },
      ],
    });
    ambient.setObserver({ pos: [0, 0, 0] });
    let dwelt = false;
    for (let t = 0; t < 30 * 400; t++) {
      world.step();
      const cars = list(world, 'train');
      if (cars.length === 0) continue;
      expect(cars).toHaveLength(3);
      const lead = cars.find(({ a }) => a.consist === undefined);
      if (lead?.a.state === 'dwell') dwelt = true;
      for (const { a, t: tr } of cars) {
        if (a.consist === undefined) continue;
        const d = Math.hypot(tr.pos[0] - (lead?.t.pos[0] ?? 0), tr.pos[2] - (lead?.t.pos[2] ?? 0));
        expect(d).toBeGreaterThan((a.carIndex ?? 1) * 27);
        expect(d).toBeLessThan((a.carIndex ?? 1) * 29 + 2);
      }
    }
    expect(dwelt).toBe(true);
  });

  it('dwell at a station for the time the document gives', () => {
    const world = new World({ tickRate: 30, seed: 'rail-dwell' });
    const ambient = installAmbient(world, {
      classes: ['train'],
      policy: { train: { near: 0, far: 3000, keep: 5000, perLaneKm: 5, max: 1 } },
      types: { train: [{ id: 'lrv', length: 27, width: 2.65, cars: 1 }] },
    });
    ambient.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'rail',
          points: [
            [-1500, 0],
            [1500, 0],
          ],
        },
      ],
      stations: [
        { id: 'west', at: [-500, 0], kind: 'rail', dwell: 5 },
        { id: 'east', at: [500, 0], kind: 'rail', dwell: 5 },
      ],
    });
    ambient.setObserver({ pos: [0, 0, 0] });
    const dwells: number[] = [];
    let run = 0;
    for (let t = 0; t < 30 * 300; t++) {
      world.step();
      const lead = list(world, 'train')[0];
      const atStation = lead?.a.state === 'dwell' && lead.a.served?.startsWith('terminus') !== true;
      if (atStation) run++;
      else if (run > 0) {
        dwells.push(run);
        run = 0;
      }
    }
    expect(dwells.length).toBeGreaterThan(0);
    for (const ticks of dwells) expect(Math.abs(ticks - 5 * 30)).toBeLessThanOrEqual(2);
  });
});

describe('aircraft', () => {
  it('fly straight corridors at altitude and leave at the far end', () => {
    const world = new World({ tickRate: 30, seed: 'air' });
    const ambient = installAmbient(world, {
      classes: ['aircraft'],
      ground: () => 12,
      policy: { aircraft: { near: 500, far: 2000, keep: 3000, max: 2 } },
    });
    ambient.addDocument(gridDocument(1, 100));
    ambient.setObserver({ pos: [0, 0, 0] });
    world.stepN(60);
    const planes = list(world, 'aircraft');
    expect(planes).toHaveLength(2);
    for (const { t, a } of planes) {
      expect(t.pos[1]).toBeGreaterThan(12 + 400);
      expect(a.speed).toBeGreaterThan(60);
    }
    const first = planes[0]?.id;
    world.stepN(30 * 90);
    expect(list(world, 'aircraft').some(({ id }) => id === first)).toBe(false);
    expect(list(world, 'aircraft')).toHaveLength(2);
  });
});
