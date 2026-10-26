import { setBoostMode, World } from '@bendyline/molen-kernel/world';
import { describe, expect, it } from 'vitest';
import { AmbientAgent, type AmbientKind, installAmbient } from '../src/kernel';
import { stepAgents } from '../src/kernel/agents/step';
import { DEFAULT_POLICY } from '../src/kernel/spawn/policy';

it.each([
  'car',
  'pedestrian',
  'train',
  'boat',
  'aircraft',
] as AmbientKind[])('boosts ambient %s travel and can return to normal speed', (kind) => {
  const make = () => {
    const world = new World({ tickRate: 60, seed: 'boost' });
    const ambient = installAmbient(world, {
      classes: ['car', 'pedestrian', 'train', 'boat', 'aircraft'],
    });
    const laneClass =
      kind === 'pedestrian'
        ? 'walk'
        : kind === 'train'
          ? 'rail'
          : kind === 'boat'
            ? 'water'
            : 'road';
    ambient.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: laneClass === 'walk' ? 'path' : laneClass,
          oneway: true,
          speed: 10,
          width: 30,
          points: [
            [0, 0],
            [100_000, 0],
          ],
        },
      ],
    });
    const lane = [...ambient.network.laneIds()]
      .map((id) => ambient.network.lane(id))
      .find((l) => l?.class === laneClass);
    if (!lane) throw new Error('Missing test lane');
    world.spawnRaw(
      {
        ambientAgent: {
          kind,
          type: 'proxy',
          lane: kind === 'aircraft' ? '' : lane.id,
          s: 1000,
          speed: 10,
          seed: 1,
          length: 2,
          width: 1,
          state: 'move',
          since: 0,
          hops: 0,
          spawnedTick: 0,
          ...(kind === 'aircraft'
            ? { air: { x: 0, z: 0, dx: 1, dz: 0, y0: 1000, y1: 1000, length: 100_000 } }
            : {}),
        },
      },
      'agent',
    );
    return {
      world,
      env: {
        net: ambient.network,
        policy: DEFAULT_POLICY,
        tick: 0,
        tickRate: 60,
        dt: 1 / 60,
        solids: [],
      },
    };
  };
  const normal = make(),
    boosted = make();
  setBoostMode(boosted.world, true);
  for (let tick = 0; tick < 120; tick++) {
    stepAgents(normal.world, { ...normal.env, tick });
    stepAgents(boosted.world, { ...boosted.env, tick });
  }
  const a = normal.world.get('agent', AmbientAgent);
  const b = boosted.world.get('agent', AmbientAgent);
  if (!a || !b) throw new Error('Missing test agent');
  expect(b.speed / a.speed).toBeCloseTo(4, 2);
  expect((b.s - 1000) / (a.s - 1000)).toBeCloseTo(4, 2);
  setBoostMode(boosted.world, false);
  stepAgents(boosted.world, boosted.env);
  expect(boosted.world.get('agent', AmbientAgent)?.boosted).toBeUndefined();
  expect(boosted.world.get('agent', AmbientAgent)?.speed).toBeCloseTo(a.speed, 1);
});

describe('boosted traffic', () => {
  it('still respects a stopped leader', () => {
    const world = new World();
    const ambient = installAmbient(world, {
      classes: ['car', 'pedestrian', 'train', 'boat', 'aircraft'],
    });
    ambient.addDocument({
      format: 'molen/transport-network@1',
      ways: [
        {
          class: 'road',
          oneway: true,
          speed: 15,
          points: [
            [0, 0],
            [1000, 0],
          ],
        },
      ],
    });
    const lane = [...ambient.network.laneIds()]
      .map((id) => ambient.network.lane(id))
      .find((l) => l?.class === 'road');
    if (!lane) throw new Error('Missing test lane');
    const agent = {
      kind: 'car',
      type: 'proxy',
      lane: lane.id,
      s: 100,
      speed: 15,
      seed: 1,
      length: 4,
      width: 2,
      state: 'move',
      since: 0,
      hops: 0,
      spawnedTick: 0,
    };
    world.spawnRaw({ ambientAgent: agent }, 'follower');
    world.spawnRaw({ ambientAgent: { ...agent, s: 110, speed: 0 } }, 'leader');
    setBoostMode(world, true);
    stepAgents(world, {
      net: ambient.network,
      policy: DEFAULT_POLICY,
      tick: 0,
      tickRate: 60,
      dt: 1 / 60,
      solids: [],
    });
    expect(world.get('follower', AmbientAgent)?.s).toBeLessThan(106);
  });
});
