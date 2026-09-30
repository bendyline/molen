import {
  applyKeyframeTo,
  buildWorld,
  stateHash,
  takeKeyframe,
  World,
} from '@bendyline/molen-kernel';
import { perTickHashes } from '@bendyline/molen-kernel/testing';
import type { Command, SceneManifest } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { ambientCapability, installAmbient, TRANSPORT_NETWORK_EXAMPLE } from '../src/kernel';
import { gridDocument } from './helpers';

function build(): World {
  const world = new World({ tickRate: 30, seed: 'det' });
  const ambient = installAmbient(world, {
    classes: ['car', 'pedestrian', 'train', 'aircraft'],
    policy: {
      car: { near: 20, far: 300, keep: 400, perLaneKm: 15, max: 80 },
      pedestrian: { near: 10, far: 150, keep: 200, perLaneKm: 20, max: 30 },
      train: { near: 50, far: 400, keep: 600, perLaneKm: 5, max: 1 },
      aircraft: { near: 500, far: 3000, keep: 4000, max: 2 },
    },
  });
  ambient.addDocument(gridDocument(4, 90));
  ambient.addDocument({
    format: 'molen/transport-network@1',
    ways: [
      {
        class: 'rail',
        points: [
          [-500, 45],
          [500, 45],
        ],
      },
    ],
    stations: [{ id: 'mid', at: [10, 45], kind: 'rail' }],
  });
  return world;
}

function observer(tick: number, x: number): Command {
  return {
    kind: 'command',
    seq: tick,
    source: 'host',
    tick,
    type: 'ambient.observer',
    payload: { pos: [x, 0, 0], forward: [1, 0] },
  };
}

const commands = [observer(0, 0), observer(200, 40), observer(400, 80)];

describe('ambient determinism', () => {
  it('produces identical per-tick hashes across builds', () => {
    const a = perTickHashes(build, commands, 600);
    const b = perTickHashes(build, commands, 600);
    expect(a).toEqual(b);
  });

  it('restores from a keyframe mid-run and continues identically', () => {
    const a = build();
    for (const c of commands) a.submitCommand(c);
    a.stepN(300);
    const keyframe = takeKeyframe(a);
    const b = build();
    applyKeyframeTo(b, keyframe);
    expect(stateHash(b)).toBe(stateHash(a));
    a.stepN(300);
    b.stepN(300);
    expect(stateHash(b)).toBe(stateHash(a));
  });

  it('installs from a scene block and exposes molen.ambient to scripts', () => {
    const scene: SceneManifest = {
      format: 'molen/scene@3',
      name: 'crossroads',
      seed: 7,
      tickRate: 30,
      lateCommands: 'rewrite',
      keyframeInterval: 60,
      prefabs: {
        'npc-car': { components: { renderable: { kind: 'primitive', ref: 'box' } } },
      },
      entities: [
        { id: 'player', components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } } },
      ],
      scripts: [
        {
          id: 'probe',
          code: "molen.on('tick', () => { if (molen.tick === 90) molen.setState({ cars: molen.ambient.stats().agents.car, lane: molen.ambient.laneAt(0, 60)?.lane ?? null }); });",
        },
      ],
      commands: {},
      components: {},
      ambient: {
        network: TRANSPORT_NETWORK_EXAMPLE as never,
        observer: 'player',
        density: { car: 20 },
        templates: { car: 'npc-car' },
        radius: 180,
      },
    };
    const world = buildWorld(scene, undefined, { capabilities: [ambientCapability()] });
    world.stepN(91);
    const agents = [...world.query({ name: 'ambientAgent' } as never)];
    expect(agents.length).toBeGreaterThan(0);
    const [, first] = [...world.query({ name: 'renderable' } as never)].find(([id]) =>
      String(id).startsWith('ambient:'),
    ) as [string, { kind: string }];
    expect(first.kind).toBe('primitive');
  });
});
