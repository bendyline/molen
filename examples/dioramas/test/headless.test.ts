import { createDiorama } from '@bendyline/molen-dioramas/kernel';
import { figuresScriptApi, installFigures } from '@bendyline/molen-figures/kernel';
import { applyKeyframeTo, buildWorld, stateHash } from '@bendyline/molen-kernel';
import { runSimulation } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';
import { football } from '../src/football';

describe('football diorama', () => {
  it('pins its normal CLI simulation and produces the cheer cue', async () => {
    const run = await runSimulation({ scene: football().scene, ticks: 420 });
    expect(run.ok, run.error).toBe(true);
    expect(run.stateHash).toBe(
      'sha256:4c114b8be21428d56b69efba71789f0fb5adf523fc422144f3e2bd5580461507',
    );
    expect(run.events.some((event) => event.event.type === 'diorama.cue')).toBe(true);
  });

  it('moves players, changes the display, seats spectators and stays within its footprint for two loops', () => {
    const definition = football();
    const runtime = createDiorama(definition);
    const initial = runtime.keyframe();
    const start = initial.entities['player-0-0']?.transform?.pos;
    expect(Object.keys(initial.entities).filter((id) => id.startsWith('fan-'))).toHaveLength(60);
    for (let n = 0; n < 40; n++) runtime.advance(0.2);
    const running = runtime.keyframe();
    expect(running.entities['player-0-0']?.transform?.pos).not.toEqual(start);
    expect(running.entities['player-0-0']?.figureState?.mode).toBe('run');
    expect(running.entities['digit-2-0']?.renderable).not.toEqual(
      initial.entities['digit-2-0']?.renderable,
    );
    for (let n = 0; n < 200; n++) {
      runtime.advance(0.2);
      if (n % 5 !== 0) continue;
      for (const components of Object.values(runtime.keyframe().entities)) {
        const pos = components.transform?.pos as number[] | undefined;
        pos?.forEach((value, axis) => {
          expect(value).toBeGreaterThanOrEqual(definition.bounds.min[axis] as number);
          expect(value).toBeLessThanOrEqual(definition.bounds.max[axis] as number);
        });
      }
    }
    runtime.dispose();
  }, 30_000);

  it('continues identically after restoring script and figure state', () => {
    const definition = football();
    const runtime = createDiorama(definition);
    for (let n = 0; n < 60; n++) runtime.advance(0.2);
    const restored = buildWorld(definition.scene, undefined, {
      capabilities: [(world) => ({ figures: figuresScriptApi(installFigures(world)) })],
    });
    applyKeyframeTo(restored, runtime.keyframe());
    for (let n = 0; n < 30; n++) {
      runtime.advance(1 / 30);
      restored.step();
    }
    const again = buildWorld(definition.scene, undefined, {
      capabilities: [(world) => ({ figures: figuresScriptApi(installFigures(world)) })],
    });
    applyKeyframeTo(again, runtime.keyframe());
    expect(stateHash(restored)).toBe(stateHash(again));
  });
});
