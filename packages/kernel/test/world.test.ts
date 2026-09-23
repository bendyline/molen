import type { JsonObject } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { defineComponent, Transform } from '../src/component';
import { stateHash, takeDelta, takeKeyframe, worldFromKeyframe } from '../src/snapshot';
import { type System, World } from '../src/world';

interface Vel extends JsonObject {
  v: [number, number, number];
}
const Velocity = defineComponent<Vel>('velocity');
interface Tag extends JsonObject {
  t: string;
}
const TagC = defineComponent<Tag>('tag');

describe('entity ids', () => {
  it('allocates "e"+seq and never reuses', () => {
    const w = new World();
    const a = w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } });
    const b = w.spawnRaw({ transform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] } });
    expect(a).toBe('e0');
    expect(b).toBe('e1');
    w.destroy(a);
    const c = w.spawnRaw({ transform: { pos: [2, 0, 0], rot: [0, 0, 0, 1] } });
    expect(c).toBe('e2'); // counter advances; never reuses e0
  });

  it('is allocation-order independent under interleaved create/destroy', () => {
    const run = (): string[] => {
      const w = new World();
      const ids: string[] = [];
      ids.push(w.spawnRaw({ tag: { t: 'a' } }));
      ids.push(w.spawnRaw({ tag: { t: 'b' } }));
      w.destroy(ids[0] as string);
      ids.push(w.spawnRaw({ tag: { t: 'c' } }));
      w.destroy(ids[2] as string);
      ids.push(w.spawnRaw({ tag: { t: 'd' } }));
      return ids;
    };
    expect(run()).toEqual(run());
    expect(run()).toEqual(['e0', 'e1', 'e2', 'e3']);
  });

  it('accepts authored ids', () => {
    const w = new World();
    const id = w.spawnRaw({ tag: { t: 'p' } }, 'player');
    expect(id).toBe('player');
    expect(w.get('player', TagC)?.t).toBe('p');
  });

  it('rejects duplicate ids instead of merging component maps', () => {
    const w = new World();
    w.spawnRaw({ tag: { t: 'original' } }, 'same');
    expect(() => w.spawnRaw({ velocity: { v: [1, 2, 3] } }, 'same')).toThrow(/duplicate/);
    expect(w.get('same', TagC)?.t).toBe('original');
    expect(w.has('same', Velocity)).toBe(false);
  });

  it('tracks empty entities through deltas, hashes, and keyframes', () => {
    const w = new World();
    const before = stateHash(w);
    w.spawnRaw({}, 'empty');
    expect(w.exists('empty')).toBe(true);
    expect(stateHash(w)).not.toBe(before);
    expect(takeDelta(w, 0).spawned).toEqual({ empty: {} });
    const restored = worldFromKeyframe(takeKeyframe(w));
    expect(restored.exists('empty')).toBe(true);
  });
});

describe('component access', () => {
  it('set/get/has/remove', () => {
    const w = new World();
    w.spawnRaw({ tag: { t: 'x' } }, 'e');
    expect(w.has('e', Velocity)).toBe(false);
    w.set('e', Velocity, { v: [1, 2, 3] });
    expect(w.has('e', Velocity)).toBe(true);
    expect(w.get('e', Velocity)?.v).toEqual([1, 2, 3]);
    w.remove('e', Velocity);
    expect(w.has('e', Velocity)).toBe(false);
  });

  it('patch merges at top level', () => {
    const w = new World();
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'e');
    w.patch('e', Transform, { pos: [5, 0, 0] });
    expect(w.get('e', Transform)).toEqual({ pos: [5, 0, 0], rot: [0, 0, 0, 1] });
  });

  it('patch on a missing component throws', () => {
    const w = new World();
    w.spawnRaw({ tag: { t: 'x' } }, 'e');
    expect(() => w.patch('e', Transform, { pos: [1, 1, 1] })).toThrow(/missing component/);
  });

  it('frozen reads in dev mode cannot be mutated to corrupt state', () => {
    const w = new World();
    w.spawnRaw({ transform: { pos: [1, 2, 3], rot: [0, 0, 0, 1] } }, 'e');
    const t = w.get('e', Transform);
    expect(() => {
      (t as { pos: number[] }).pos[0] = 99;
    }).toThrow();
    // underlying store is unaffected
    expect(w.get('e', Transform)?.pos[0]).toBe(1);
  });

  it('stored components do not alias caller data', () => {
    const w = new World();
    const data = { v: [1, 1, 1] as [number, number, number] };
    w.spawnRaw({}, 'e');
    w.set('e', Velocity, data);
    data.v[0] = 99;
    expect(w.get('e', Velocity)?.v[0]).toBe(1);
  });

  it('reference identity is the change signal: same object until a write installs a new one', () => {
    const w = new World();
    w.spawnRaw({ velocity: { v: [1, 2, 3] } }, 'e');
    const first = w.get('e', Velocity);
    expect(w.get('e', Velocity)).toBe(first);
    expect((w.query(Velocity).first() as [string, Vel])[1]).toBe(first);
    w.patch('e', Velocity, { v: [4, 5, 6] });
    const second = w.get('e', Velocity);
    expect(second).not.toBe(first);
    expect(first?.v).toEqual([1, 2, 3]); // a held reference goes stale, never corrupted
    w.set('e', Velocity, { v: [7, 8, 9] });
    expect(w.get('e', Velocity)).not.toBe(second);
  });

  it('with devFreeze off, reads share the stored object and writes still replace it', () => {
    const w = new World({ devFreeze: false });
    w.spawnRaw({ velocity: { v: [1, 2, 3] } }, 'e');
    const read = w.get('e', Velocity) as Vel;
    expect(Object.isFrozen(read)).toBe(false);
    expect(w.get('e', Velocity)).toBe(read);
    w.patch('e', Velocity, { v: [9, 9, 9] });
    expect(w.get('e', Velocity)).not.toBe(read);
    expect(read.v).toEqual([1, 2, 3]);
  });

  it('query ids() are frozen so callers cannot corrupt the query cache', () => {
    const w = new World();
    w.spawnRaw({ velocity: { v: [1, 2, 3] } }, 'a');
    const ids = w.query(Velocity).ids();
    expect(Object.isFrozen(ids)).toBe(true);
    expect(() => (ids as string[]).push('zzz')).toThrow();
    expect(w.query(Velocity).ids()).toEqual(['a']);
  });

  it('deferred spawns inside a tick do not alias caller data', () => {
    const w = new World();
    const data = { velocity: { v: [1, 1, 1] as [number, number, number] } };
    w.addSystem(
      (world) => {
        if (!world.exists('late')) {
          world.spawnRaw(data, 'late');
          data.velocity.v[0] = 99; // mutate after the (deferred) spawn call
        }
      },
      { name: 'spawner' },
    );
    w.step();
    expect(w.get('late', Velocity)?.v[0]).toBe(1);
  });

  it('configures an entity spawned earlier in the same system (spawn then set/patch)', () => {
    const w = new World();
    w.addSystem(
      (world) => {
        if (world.exists('hero')) return;
        const id = world.spawnRaw({ velocity: { v: [1, 0, 0] }, tag: { t: 'draft' } }, 'hero');
        // The spawn is deferred, but the components are readable and writable right away;
        // the flush must not replay the original map over these writes.
        expect(world.get(id, Velocity)?.v).toEqual([1, 0, 0]);
        world.set(id, Velocity, { v: [2, 0, 0] });
        world.patch(id, Velocity, { v: [3, 0, 0] });
        world.patch(id, TagC, { t: 'final' });
      },
      { name: 'spawner' },
    );
    const base = w.tick;
    w.step();
    expect(w.get('hero', Velocity)?.v).toEqual([3, 0, 0]);
    expect(w.get('hero', TagC)?.t).toBe('final');
    // The delta reports it as a spawn carrying the configured values, not the draft ones.
    expect(takeDelta(w, base).spawned.hero).toEqual({
      velocity: { v: [3, 0, 0] },
      tag: { t: 'final' },
    });
  });

  it('leaves no component data behind when a tick faults before a spawn is published', () => {
    const w = new World();
    w.addSystem((world) => {
      world.spawnRaw({ velocity: { v: [1, 0, 0] } }, 'ghost');
      throw new Error('boom');
    });
    expect(() => w.step()).toThrow(/boom/);
    expect(w.exists('ghost')).toBe(false);
    expect(w.get('ghost', Velocity)).toBeUndefined();
    expect(takeKeyframe(w).entities.ghost).toBeUndefined();
  });

  it('rejects non-finite numbers instead of storing a value JSON cannot carry', () => {
    const w = new World();
    w.spawnRaw({ tag: { t: 'x' } }, 'e');
    expect(() => w.set('e', Velocity, { v: [Number.NaN, 0, 0] })).toThrow(
      /component "velocity" on entity "e".*non-finite number \(NaN\) at \/v\/0/s,
    );
    expect(w.has('e', Velocity)).toBe(false);
    w.set('e', Velocity, { v: [1, 2, 3] });
    expect(() => w.patch('e', Velocity, { v: [0, Number.POSITIVE_INFINITY, 0] })).toThrow(
      /non-finite number \(Infinity\)/,
    );
    expect(w.get('e', Velocity)?.v).toEqual([1, 2, 3]);
    expect(() => w.spawnRaw({ velocity: { v: [0, 0, Number.NEGATIVE_INFINITY] } }, 'bad')).toThrow(
      /component "velocity" on entity "bad"/,
    );
    // The fast (non-dev) path keeps its no-walk write; the check is a dev-mode guard.
    const fast = new World({ devFreeze: false });
    fast.spawnRaw({}, 'e');
    expect(() => fast.set('e', Velocity, { v: [Number.NaN, 0, 0] })).not.toThrow();
  });
});

describe('queries', () => {
  it('returns entities having all components, in creation order', () => {
    const w = new World();
    w.spawnRaw(
      { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, velocity: { v: [1, 0, 0] } },
      'a',
    );
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'b');
    w.spawnRaw(
      { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, velocity: { v: [0, 1, 0] } },
      'c',
    );
    const ids = w.query(Transform, Velocity).ids();
    expect(ids).toEqual(['a', 'c']);
  });

  it('iterates [id, ...components]', () => {
    const w = new World();
    w.spawnRaw(
      { transform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] }, velocity: { v: [2, 0, 0] } },
      'a',
    );
    const rows = [...w.query(Transform, Velocity)];
    expect(rows).toHaveLength(1);
    const [id, t, v] = rows[0] as [string, { pos: number[] }, Vel];
    expect(id).toBe('a');
    expect(t.pos[0]).toBe(1);
    expect(v.v[0]).toBe(2);
  });

  it('returns empty for a never-seen component', () => {
    const w = new World();
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'a');
    expect(w.query(Transform, Velocity).count()).toBe(0);
  });

  it('cache invalidates when structure changes', () => {
    const w = new World();
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'a');
    expect(w.query(Transform).count()).toBe(1);
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'b');
    expect(w.query(Transform).count()).toBe(2);
    w.destroy('a');
    expect(w.query(Transform).count()).toBe(1);
  });

  it('cache survives value writes (no structure change) but reflects new values', () => {
    const w = new World();
    w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'a');
    expect(w.query(Transform).count()).toBe(1);
    w.patch('a', Transform, { pos: [9, 9, 9] });
    const [, t] = [...w.query(Transform)][0] as [string, { pos: number[] }];
    expect(t.pos).toEqual([9, 9, 9]);
  });

  it('skips rows that went away mid-iteration (destroy/remove apply at once outside a tick)', () => {
    const w = new World();
    for (const id of ['a', 'b', 'c', 'd']) w.spawnRaw({ tag: { t: id } }, id);
    const seen: [string, Tag][] = [];
    for (const row of w.query(TagC)) {
      const [id] = row;
      if (id === 'a') {
        w.destroy('b'); // immediate: not executing a tick
        w.remove('c', TagC);
      }
      seen.push(row as [string, Tag]);
    }
    expect(seen.map(([id]) => id)).toEqual(['a', 'd']);
    expect(seen.every(([, tag]) => tag !== undefined)).toBe(true);
  });

  it('first() skips a destroyed head instead of returning an undefined row', () => {
    const w = new World();
    w.spawnRaw({ tag: { t: 'a' } }, 'a');
    w.spawnRaw({ tag: { t: 'b' } }, 'b');
    const q = w.query(TagC);
    w.destroy('a');
    expect(q.first()).toEqual(['b', { t: 'b' }]);
    w.destroy('b');
    expect(q.first()).toBeUndefined();
  });

  it('keys the cache on names and excludes separately (no separator collision)', () => {
    const w = new World();
    const Bang = defineComponent<Tag>('!');
    const Weird = defineComponent<Tag>('a!');
    w.spawnRaw({ a: { t: 'plain' } }, 'plain');
    w.spawnRaw({ a: { t: 'bang' }, '!': { t: 'bang' } }, 'bang');
    w.spawnRaw({ 'a!': { t: 'weird' } }, 'weird');
    const A = defineComponent<Tag>('a');
    // query('a!') and query('a').without('!') used to share the key "a!!".
    expect(w.query(Weird).ids()).toEqual(['weird']);
    expect(w.query(A).without(Bang).ids()).toEqual(['plain']);
    expect(w.query(Weird).ids()).toEqual(['weird']);
  });
});

describe('systems and tick', () => {
  it('runs systems in phase then registration order', () => {
    const w = new World();
    const log: string[] = [];
    w.addSystem(() => log.push('update-1'), { phase: 'update', name: 'u1' });
    w.addSystem(() => log.push('late-1'), { phase: 'late', name: 'l1' });
    w.addSystem(() => log.push('commands-1'), { phase: 'commands', name: 'c1' });
    w.addSystem(() => log.push('update-2'), { phase: 'update', name: 'u2' });
    w.step();
    expect(log).toEqual(['commands-1', 'update-1', 'update-2', 'late-1']);
  });

  it('advances tick and dt is 1/tickRate', () => {
    const w = new World({ tickRate: 30 });
    expect(w.dt).toBeCloseTo(1 / 30);
    w.stepN(5);
    expect(w.tick).toBe(5);
  });

  it('moves entities deterministically via a velocity system', () => {
    const mkWorld = (): World => {
      const w = new World({ tickRate: 10 });
      const move: System = (world, ctx) => {
        for (const [id, t, v] of world.query(Transform, Velocity)) {
          world.patch(id, Transform, {
            pos: [
              t.pos[0] + v.v[0] * ctx.dt,
              t.pos[1] + v.v[1] * ctx.dt,
              t.pos[2] + v.v[2] * ctx.dt,
            ],
          });
        }
      };
      w.addSystem(move, { name: 'move' });
      w.spawnRaw(
        { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, velocity: { v: [10, 0, 0] } },
        'p',
      );
      return w;
    };
    const w1 = mkWorld();
    w1.stepN(10);
    const w2 = mkWorld();
    w2.stepN(10);
    expect(w1.get('p', Transform)?.pos).toEqual(w2.get('p', Transform)?.pos);
    expect(w1.get('p', Transform)?.pos[0]).toBeCloseTo(10);
  });

  it('defers spawn/destroy during iteration (iterate-and-destroy is safe)', () => {
    const w = new World();
    for (let i = 0; i < 5; i++) {
      w.spawnRaw({ lifetime: { ticksLeft: i }, transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } });
    }
    const Lifetime = defineComponent<{ ticksLeft: number } & JsonObject>('lifetime');
    const reaper: System = (world) => {
      for (const [id, life] of world.query(Lifetime)) {
        if (life.ticksLeft === 0) world.destroy(id);
        else world.patch(id, Lifetime, { ticksLeft: life.ticksLeft - 1 });
      }
    };
    w.addSystem(reaper, { name: 'reaper' });
    expect(() => w.step()).not.toThrow();
    // one entity (ticksLeft 0) destroyed this tick
    expect(w.query(Lifetime).count()).toBe(4);
  });

  it('fails closed after a command or system throws', () => {
    const w = new World();
    w.addSystem(() => {
      throw new Error('boom');
    });
    expect(() => w.step()).toThrow(/tick 0 failed: boom/);
    expect(w.tick).toBe(0);
    expect(() => w.step()).toThrow(/cannot continue/);
  });
});

describe('capability teardown', () => {
  it('removeSystem and unregisterSnapshotProvider let a plugin dispose cleanly', () => {
    const w = new World();
    let runs = 0;
    w.addSystem(
      () => {
        runs++;
      },
      { name: 'plugin' },
    );
    w.registerSnapshotProvider(
      'plugin',
      () => ({ x: 1 }),
      () => {},
    );
    w.step();
    expect(runs).toBe(1);
    expect(takeKeyframe(w).plugins.plugin).toEqual({ x: 1 });
    expect(w.removeSystem('plugin')).toBe(true);
    expect(w.removeSystem('plugin')).toBe(false);
    expect(w.unregisterSnapshotProvider('plugin')).toBe(true);
    expect(w.unregisterSnapshotProvider('plugin')).toBe(false);
    w.step();
    expect(runs).toBe(1);
    expect(w.describeSystems().some((s) => s.name === 'plugin')).toBe(false);
    expect(takeKeyframe(w).plugins.plugin).toBeUndefined();
  });
});
