import type { Command } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../src/component';
import { installKinematics, KinematicBody } from '../src/kinematics';
import { stateHash } from '../src/snapshot';
import { ReplayPlayer, type WorldBuilder } from '../src/testing';
import { type System, World } from '../src/world';

const Counter = defineComponent<{ n: number }>('counter');

function builder(): WorldBuilder {
  return () => {
    const w = new World({ tickRate: 30, seed: 'scrub' });
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    const tick: System = (world) => {
      const v = world.get('c', Counter)?.n ?? 0;
      world.set('c', Counter, { n: v + 1 });
    };
    w.addSystem(tick, { name: 'tick' });
    w.registerCommand('set', (world, cmd) => {
      world.set('c', Counter, { n: (cmd.payload as { n: number }).n });
    });
    return w;
  };
}

describe('ReplayPlayer scrubbing', () => {
  it('seeks to any tick and reproduces the live state', () => {
    const player = new ReplayPlayer(builder(), [], { totalTicks: 100, keyframeInterval: 20 });
    expect(player.seek(0).get('c', Counter)?.n).toBe(0);
    expect(player.seek(5).get('c', Counter)?.n).toBe(5);
    expect(player.seek(50).get('c', Counter)?.n).toBe(50);
    expect(player.seek(100).get('c', Counter)?.n).toBe(100);
  });

  it('seeking is order-independent (forward then backward)', () => {
    const player = new ReplayPlayer(builder(), [], { totalTicks: 60, keyframeInterval: 15 });
    const forward = stateHash(player.seek(45));
    player.seek(60);
    const backward = stateHash(player.seek(45));
    expect(backward).toBe(forward);
  });

  it('replays commands when seeking past their tick', () => {
    const commands: Command[] = [
      {
        kind: 'command',
        seq: 0,
        source: 'local',
        tick: 10,
        tickExecuted: 10,
        type: 'set',
        payload: { n: 999 },
      },
    ];
    const player = new ReplayPlayer(builder(), commands, { totalTicks: 40, keyframeInterval: 20 });
    // before the command: plain count
    expect(player.seek(5).get('c', Counter)?.n).toBe(5);
    // tick 10 (boundary) is before the tick-10 command executes
    expect(player.seek(10).get('c', Counter)?.n).toBe(10);
    // processing tick 10: set n=999 (commands phase) then +1 (tick system) -> world at tick 11
    expect(player.seek(11).get('c', Counter)?.n).toBe(1000);
    // matches a fresh live run to the same tick
    expect(player.seek(20).get('c', Counter)?.n).toBe(1009);
  });

  it('replays a command scheduled exactly at a cached-keyframe boundary', () => {
    const commands: Command[] = [
      {
        kind: 'command',
        seq: 0,
        source: 'local',
        tick: 20,
        tickExecuted: 20,
        type: 'set',
        payload: { n: 500 },
      },
    ];
    const player = new ReplayPlayer(builder(), commands, { totalTicks: 40, keyframeInterval: 20 });
    expect(player.seek(20).get('c', Counter)?.n).toBe(20);
    expect(player.seek(21).get('c', Counter)?.n).toBe(501);
  });

  it('clamps out-of-range seeks', () => {
    const player = new ReplayPlayer(builder(), [], { totalTicks: 30 });
    expect(player.seek(-5).get('c', Counter)?.n).toBe(0);
    expect(player.seek(999).get('c', Counter)?.n).toBe(30);
  });
});

describe('ReplayPlayer scrubbing through kinematics', () => {
  // Bodies gain their kinematicBody in REVERSE creation order so per-store insertion order
  // differs from creation order; a restore must still resolve collisions in the same sequence.
  const kinematicBuilder = (): WorldBuilder => () => {
    const w = new World({ tickRate: 30, seed: 'kin' });
    installKinematics(w);
    w.spawnRaw(
      {
        transform: { pos: [8, 0, 0], rot: [0, 0, 0, 1] },
        collider: { shape: 'aabb', halfExtents: [0.5, 4], layer: 1, mask: 1, isStatic: true },
      },
      'wall',
    );
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0.3], rot: [0, 0, 0, 1] },
        collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
      },
      'a',
    );
    w.spawnRaw(
      {
        transform: { pos: [-1.5, 0, -0.3], rot: [0, 0, 0, 1] },
        collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
      },
      'b',
    );
    w.set('b', KinematicBody, { vel: [7, 0, 0], slide: true });
    w.set('a', KinematicBody, { vel: [6, 0, 0], slide: true });
    return w;
  };

  it('restore-and-continue matches a continuous run tick for tick', () => {
    const player = new ReplayPlayer(kinematicBuilder(), [], {
      totalTicks: 60,
      keyframeInterval: 7,
    });
    for (const t of [8, 15, 33, 60]) {
      const live = kinematicBuilder()();
      live.stepN(t);
      expect(stateHash(player.seek(t))).toBe(stateHash(live));
    }
  });
});
