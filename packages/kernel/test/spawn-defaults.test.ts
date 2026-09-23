import { describe, expect, it } from 'vitest';
import { defineComponent, Transform, World } from '../src/index';
import { runHeadless } from '../src/testing';

const Tag = defineComponent<{ name: string }>('tag');

describe('world.spawn (defaults + validation)', () => {
  it('merges registered defaults under authored data (authored wins)', () => {
    const w = new World();
    const id = w.spawn({ transform: { pos: [1, 2, 3] } });
    expect(w.get(id, Transform)).toEqual({ pos: [1, 2, 3], rot: [0, 0, 0, 1] });
    const explicit = w.spawn({ transform: { pos: [0, 0, 0], rot: [0, 1, 0, 0] } });
    expect(w.get(explicit, Transform)?.rot).toEqual([0, 1, 0, 0]);
  });

  it('never adds components you did not ask for', () => {
    const w = new World();
    const id = w.spawn({ tag: { name: 'x' } });
    expect(w.has(id, Transform)).toBe(false);
  });

  it('validates known component shapes (devFreeze default) with pinpoint errors', () => {
    const w = new World();
    expect(() => w.spawn({ tag: { nam: 'typo' } })).toThrow(/tag/);
    expect(() => w.spawn({ tag: { nam: 'typo' } }, { validate: false })).not.toThrow();
  });

  it('spawn vs spawnRaw+manual defaults are hash-identical (determinism)', () => {
    const viaSpawn = runHeadless(
      () => {
        const w = new World({ seed: 's' });
        w.spawn({ transform: { pos: [1, 0, 0] } }, { id: 'a' });
        return w;
      },
      { ticks: 5 },
    );
    const viaRaw = runHeadless(
      () => {
        const w = new World({ seed: 's' });
        w.spawnRaw({ transform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] } }, 'a');
        return w;
      },
      { ticks: 5 },
    );
    expect(viaSpawn.finalHash).toBe(viaRaw.finalHash);
  });

  it('deferred spawn (inside a system) applies the same defaults', () => {
    const w = new World();
    w.addSystem((world) => {
      if (world.tick === 0) world.spawn({ transform: { pos: [5, 0, 0] } }, { id: 'later' });
    });
    w.step();
    expect(w.get('later', Transform)).toEqual({ pos: [5, 0, 0], rot: [0, 0, 0, 1] });
  });
});

describe('query(...).without(...)', () => {
  const Burning = defineComponent<{ heat: number }>('burning');

  it('excludes entities carrying any excluded component', () => {
    const w = new World();
    w.spawnRaw({ tag: { name: 'a' } }, 'a');
    w.spawnRaw({ tag: { name: 'b' }, burning: { heat: 3 } }, 'b');
    w.spawnRaw({ tag: { name: 'c' } }, 'c');
    expect(w.query(Tag).count()).toBe(3);
    expect(w.query(Tag).without(Burning).ids()).toEqual(['a', 'c']);
  });

  it('invalidates on structure change and preserves creation order', () => {
    const w = new World();
    w.spawnRaw({ tag: { name: 'a' } }, 'a');
    w.spawnRaw({ tag: { name: 'b' } }, 'b');
    const q1 = w.query(Tag).without(Burning);
    expect(q1.ids()).toEqual(['a', 'b']);
    w.set('a', Burning, { heat: 1 });
    expect(w.query(Tag).without(Burning).ids()).toEqual(['b']);
    w.remove('a', Burning);
    expect(w.query(Tag).without(Burning).ids()).toEqual(['a', 'b']);
  });
});
