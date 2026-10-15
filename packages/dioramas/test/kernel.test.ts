import type { SceneManifest } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { createDiorama } from '../src/kernel';

const bounds = {
  min: [-2, 0, -2] as [number, number, number],
  max: [2, 4, 2] as [number, number, number],
};
function scene(code = ''): SceneManifest {
  return {
    format: 'molen/scene@3',
    name: 'test',
    seed: 'same',
    tickRate: 30,
    entities: [{ id: 'actor', components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } } }],
    scripts: [
      {
        id: 'move',
        checkpoint: 'state',
        code:
          code ||
          "molen.on('tick', () => molen.patch('actor', 'transform', {pos: [molen.tick * 0.1, 0, 0]}));",
      },
    ],
  };
}

describe('local scripted worlds', () => {
  it('isolates ids and RNG, and gives the same ticks for different frame splits', () => {
    const definition = {
      scene: scene(
        "molen.on('tick', () => molen.patch('actor', 'transform', {pos: [molen.rng(), 0, 0]}));",
      ),
      bounds,
    };
    const a = createDiorama(definition),
      b = createDiorama(definition);
    a.keyframe();
    b.keyframe();
    for (let i = 0; i < 120; i++) a.advance(1 / 60);
    for (let i = 0; i < 60; i++) b.advance(1 / 30);
    expect(a.tick).toBe(60);
    expect(a.keyframe()).toEqual(b.keyframe());
    a.dispose();
    expect(a.advance(1)).toBeUndefined();
    b.advance(1 / 30);
    expect(b.tick).toBe(61);
  });

  it('bounds every origin, caps catch-up and returns contiguous deltas', () => {
    const runtime = createDiorama({ scene: scene(), bounds });
    runtime.keyframe();
    expect(runtime.advance(10)).toMatchObject({ baseTick: 0, tick: 6 });
    expect(runtime.advance(0)).toBeUndefined();
    for (let i = 0; i < 10; i++) runtime.advance(0.2);
    expect(runtime.keyframe().entities.actor?.transform?.pos).toEqual([2, 0, 0]);
    expect(() => runtime.advance(Number.NaN)).toThrow('finite');
  });

  it('rejects bad budgets/bounds and catches runaway spawning', () => {
    expect(() => createDiorama({ scene: scene(), bounds, maxEntities: 0 })).toThrow('positive');
    expect(() =>
      createDiorama({ scene: scene(), bounds: { min: bounds.max, max: bounds.min } }),
    ).toThrow('bounds');
    const runtime = createDiorama({
      scene: scene("molen.on('tick', () => molen.spawn({}));"),
      bounds,
      maxEntities: 2,
    });
    runtime.advance(1 / 30);
    expect(() => runtime.advance(1 / 30)).toThrow('budget');
  });
});
