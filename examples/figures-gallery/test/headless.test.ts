import type { Command, SceneManifest } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { runSimulation } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';
import sceneDoc from '../scene.json';

function scene(): SceneManifest {
  const r = validate('scene', sceneDoc);
  if (!r.ok) throw new Error(r.formatted);
  return r.value;
}

const FIGURES = 17;

function gait(mode: 'idle' | 'walk' | 'run', tick: number, seq = 0): Command {
  return {
    kind: 'command',
    seq,
    source: 'local',
    tick,
    tickExecuted: tick,
    type: 'set_gait',
    payload: { mode },
  };
}

describe('figures gallery headless', () => {
  // Pinned, so a rig, gait or pose-evaluation change has to be an intentional edit here.
  it('matches the pinned state hash across engine versions', async () => {
    const r = await runSimulation({ scene: scene(), ticks: 240 });
    expect(r.stateHash).toBe(
      'sha256:f2565a0cba6e85f16c44ec40a5dbede0c6d7cd4ef704174854a81c69a05f4ab2',
    );
  });

  it('runs 240 ticks deterministically (identical hash across runs)', async () => {
    const a = await runSimulation({ scene: scene(), ticks: 240 });
    const b = await runSimulation({ scene: scene(), ticks: 240 });
    expect(a.tick).toBe(240);
    expect(a.stateHash).toBe(b.stateHash);
  });

  it('gives every figure a locomotion state, seats the rider, and resolves every socket', async () => {
    const r = await runSimulation({
      scene: scene(),
      ticks: 30,
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          { select: 'has:figure', op: 'count', value: FIGURES },
          { select: 'has:figureState', op: 'count', value: FIGURES },
          { select: '#rider .figureState.mode', op: 'eq', value: 'sit' },
          { select: '#adult .figureState.mode', op: 'eq', value: 'idle' },
          { select: '#adult-hat .localTransform', op: 'exists' },
          { select: '#heavy-pack .localTransform', op: 'exists' },
          { event: 'figures-error', op: 'never' },
        ],
      },
    });
    expect(r.ok, r.assertionsFormatted ?? r.error).toBe(true);
  });

  it('walks and runs in place on the set_gait command and returns to idle', async () => {
    const r = await runSimulation({
      scene: scene(),
      ticks: 90,
      commands: [gait('walk', 5, 0), gait('run', 40, 1)],
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          { select: '#adult .figureState.mode', op: 'eq', value: 'run' },
          { select: '#adult .figureState.prevMode', op: 'eq', value: 'walk' },
          { select: '#horse .figureState.mode', op: 'eq', value: 'run' },
          { select: '#rider .figureState.mode', op: 'eq', value: 'sit' },
        ],
      },
    });
    expect(r.ok, r.assertionsFormatted ?? r.error).toBe(true);
    const back = await runSimulation({
      scene: scene(),
      ticks: 60,
      commands: [gait('walk', 5, 0), gait('idle', 30, 1)],
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [{ select: '#adult .figureState.mode', op: 'eq', value: 'idle' }],
      },
    });
    expect(back.ok, back.assertionsFormatted ?? back.error).toBe(true);
  });
});
