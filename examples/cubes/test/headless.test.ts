import type { Command, SceneManifest } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { runSimulation } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';
import sceneDoc from '../scene.json';
import { setup } from '../src/cubes';

function scene(): SceneManifest {
  const r = validate('scene', sceneDoc);
  if (!r.ok) throw new Error(r.formatted);
  return r.value;
}

describe('cubes headless', () => {
  // A pinned hash, not just run-to-run equality: comparing a run with itself proves the engine
  // is reproducible, never that its behaviour is unchanged. Only a literal moves when a refactor
  // alters system order, float sequencing or the broad phase. Refresh it deliberately.
  it('matches the pinned state hash across engine versions', async () => {
    const r = await runSimulation({ scene: scene(), ticks: 300, setup });
    expect(r.stateHash).toBe(
      'sha256:e707c63c138d69cb2d044ca67f0157b092887c41a4c631f729350381db5d46c5',
    );
  });

  it('runs 300 ticks deterministically (identical hash across runs)', async () => {
    const a = await runSimulation({ scene: scene(), ticks: 300, setup });
    const b = await runSimulation({ scene: scene(), ticks: 300, setup });
    expect(a.tick).toBe(300);
    expect(a.stateHash).toBe(b.stateHash);
  });

  it('seeds ~50 cubes and they all have transform + renderable', async () => {
    const r = await runSimulation({
      scene: scene(),
      ticks: 1,
      setup,
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          { select: 'has:spin', op: 'count', value: 50 },
          { select: 'has:renderable', op: 'count', value: 50 },
          { select: 'has:transform', op: 'count', value: 50 },
        ],
      },
    });
    expect(r.ok).toBe(true);
  });

  it('spawn_cube commands add cubes at their adjudicated tick', async () => {
    const commands: Command[] = [
      {
        kind: 'command',
        seq: 0,
        source: 'local',
        tick: 5,
        tickExecuted: 5,
        type: 'spawn_cube',
        payload: {},
      },
      {
        kind: 'command',
        seq: 1,
        source: 'local',
        tick: 5,
        tickExecuted: 5,
        type: 'spawn_cube',
        payload: {},
      },
      {
        kind: 'command',
        seq: 2,
        source: 'local',
        tick: 8,
        tickExecuted: 8,
        type: 'spawn_cube',
        payload: {},
      },
    ];
    const r = await runSimulation({
      scene: scene(),
      ticks: 20,
      setup,
      commands,
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [{ select: 'has:spin', op: 'count', value: 53 }], // 50 + 3 spawned
      },
    });
    expect(r.ok).toBe(true);
  });

  it('cubes move over time (drift changes positions)', async () => {
    const t0 = await runSimulation({ scene: scene(), ticks: 1, setup });
    const t100 = await runSimulation({ scene: scene(), ticks: 100, setup });
    // different ticks -> different state hash (cubes spinning/drifting)
    expect(t0.stateHash).not.toBe(t100.stateHash);
  });
});
