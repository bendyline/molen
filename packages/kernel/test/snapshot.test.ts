import { readFile } from 'node:fs/promises';
import type { ComponentMap, Delta, EntityId, JsonValue } from '@bendyline/molen-schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defineComponent, Transform } from '../src/component';
import { hashJson } from '../src/hash';
import {
  applyDelta,
  applyKeyframeTo,
  captureEntities,
  keyframeStateFormat,
  stateHash,
  takeDelta,
  takeKeyframe,
  worldFromKeyframe,
} from '../src/snapshot';
import { ENGINE_VERSION, STATE_FORMAT, STATE_FORMAT_KEY } from '../src/version';
import { type System, World } from '../src/world';

const Velocity = defineComponent<{ v: [number, number, number] }>('velocity');

function movingWorld(seed: string): World {
  const w = new World({ tickRate: 10, seed });
  const move: System = (world, ctx) => {
    for (const [id, t, v] of world.query(Transform, Velocity)) {
      world.patch(id, Transform, {
        pos: [t.pos[0] + v.v[0] * ctx.dt, t.pos[1] + v.v[1] * ctx.dt, t.pos[2] + v.v[2] * ctx.dt],
      });
    }
  };
  w.addSystem(move, { name: 'move' });
  w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, velocity: { v: [1, 2, 3] } }, 'p');
  w.spawnRaw({ transform: { pos: [5, 0, 0], rot: [0, 0, 0, 1] }, velocity: { v: [-1, 0, 0] } });
  return w;
}

describe('keyframe save/load', () => {
  it('round-trips: load(keyframe) reproduces the same state and hash', () => {
    const w = movingWorld('kf');
    w.stepN(20);
    const kf = takeKeyframe(w);
    const restored = worldFromKeyframe(kf);
    expect(stateHash(restored)).toBe(stateHash(w));
    expect(restored.tick).toBe(w.tick);
  });

  it('resumed world continues identically to a continuous run', () => {
    const cont = movingWorld('resume');
    cont.addSystem(() => {}, { name: 'noop' });
    cont.stepN(10);
    const kf = takeKeyframe(cont);
    cont.stepN(10);

    const resumed = movingWorld('resume');
    // movingWorld already registered the move system; loading replaces state.
    const loaded = worldFromKeyframe(kf);
    loaded.addSystem(
      (world, ctx) => {
        for (const [id, t, v] of world.query(Transform, Velocity)) {
          world.patch(id, Transform, {
            pos: [
              t.pos[0] + v.v[0] * ctx.dt,
              t.pos[1] + v.v[1] * ctx.dt,
              t.pos[2] + v.v[2] * ctx.dt,
            ],
          });
        }
      },
      { name: 'move' },
    );
    loaded.stepN(10);
    expect(stateHash(loaded)).toBe(stateHash(cont));
    void resumed;
  });

  it('keeps query iteration order (creation order) across save/load', () => {
    const X = defineComponent<{ v: number }>('x');
    const w = new World();
    w.spawnRaw({}, 'A');
    w.spawnRaw({}, 'B');
    // Add the component in reverse creation order: per-store insertion order is B, A.
    w.set('B', X, { v: 2 });
    w.set('A', X, { v: 1 });
    expect(w.query(X).ids()).toEqual(['A', 'B']);
    const restored = worldFromKeyframe(takeKeyframe(w));
    expect(restored.query(X).ids()).toEqual(['A', 'B']);
  });

  it('drops in-flight tick events when loading a keyframe', () => {
    const w = new World();
    w.spawnRaw({ tag: { t: 'x' } }, 'e');
    const kf = takeKeyframe(w);
    let sawRestore = false;
    w.addSystem(
      (world) => {
        if (sawRestore) return;
        sawRestore = true;
        world.emit('stale', { from: 'before-restore' });
        applyKeyframeTo(world, kf);
      },
      { name: 'emit-then-restore' },
    );
    w.step();
    expect(takeDelta(w, 0).events).toEqual([]);
  });

  it('drops queued commands and sequence watermarks when loading a keyframe', () => {
    const w = new World();
    const Counter = defineComponent<{ n: number }>('counter');
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    w.registerCommand('inc', (world) => {
      const n = world.get('c', Counter)?.n ?? 0;
      world.set('c', Counter, { n: n + 1 });
    });
    const keyframe = takeKeyframe(w);
    expect(
      w.submitCommand({
        kind: 'command',
        seq: 7,
        source: 'remote',
        tick: 3,
        type: 'inc',
        payload: null,
      }).accepted,
    ).toBe(true);

    applyKeyframeTo(w, keyframe);
    w.stepN(5);
    expect(w.get('c', Counter)?.n).toBe(0);
    expect(
      w.submitCommand({
        kind: 'command',
        seq: 7,
        source: 'remote',
        tick: 7,
        type: 'inc',
        payload: null,
      }).accepted,
    ).toBe(true);
  });
});

describe('delta apply mirrors the world', () => {
  it('applying the per-tick delta stream reproduces the live world state', () => {
    const w = movingWorld('delta');
    const mirror: Record<EntityId, ComponentMap> = {};
    // seed the mirror from the initial keyframe
    const kf0 = takeKeyframe(w);
    for (const [id, comps] of Object.entries(kf0.entities)) mirror[id] = comps;

    let base = w.tick;
    for (let i = 0; i < 30; i++) {
      w.step();
      const d = takeDelta(w, base);
      applyDelta(mirror, d);
      base = w.tick;
    }
    // mirror should match a fresh keyframe of the world
    const kf = takeKeyframe(w);
    expect(mirror).toEqual(kf.entities);
  });

  it('captures spawns, changes, removals, and destroys', () => {
    const w = new World();
    const Tag = defineComponent<{ t: string }>('tag');
    w.spawnRaw({ tag: { t: 'keep' }, transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'keep');
    w.spawnRaw({ tag: { t: 'gone' } }, 'gone');
    // baseline mirror
    const mirror: Record<EntityId, ComponentMap> = {};
    for (const [id, c] of Object.entries(takeKeyframe(w).entities)) mirror[id] = c;

    w.addSystem(
      (world) => {
        world.spawnRaw({ tag: { t: 'new' } }, 'fresh');
        world.patch('keep', Transform, { pos: [9, 9, 9] });
        world.remove('keep', Tag);
        world.destroy('gone');
      },
      { name: 'mutate' },
    );
    const base = w.tick;
    w.step();
    const d = takeDelta(w, base);
    expect(d.spawned.fresh).toBeDefined();
    expect(d.destroyed).toContain('gone');
    expect(d.changed.keep?.transform).toEqual({ pos: [9, 9, 9], rot: [0, 0, 0, 1] });
    expect(d.removedComponents.keep).toContain('tag');

    applyDelta(mirror, d);
    expect(mirror).toEqual(takeKeyframe(w).entities);
  });

  it('keeps a component removed and re-set in the same delta window', () => {
    const Stunned = defineComponent<{ ticks: number }>('stunned');
    const w = new World();
    w.spawnRaw({ stunned: { ticks: 1 } }, 'hero');
    const mirror: Record<EntityId, ComponentMap> = {};
    for (const [id, c] of Object.entries(takeKeyframe(w).entities)) mirror[id] = c;

    // Two systems, one tick: A clears the status, B re-applies it. The removal is flushed
    // between them, so the write cannot cancel a pending op — it has to cancel the record.
    w.addSystem((world) => world.remove('hero', Stunned), { name: 'clear', priority: 0 });
    w.addSystem((world) => world.set('hero', Stunned, { ticks: 2 }), {
      name: 'apply',
      priority: 1,
    });
    const base = w.tick;
    w.step();
    const d = takeDelta(w, base);
    expect(d.changed.hero?.stunned).toEqual({ ticks: 2 });
    expect(d.removedComponents.hero).toBeUndefined();
    applyDelta(mirror, d);
    expect(mirror).toEqual(takeKeyframe(w).entities);
    expect(mirror.hero?.stunned).toEqual({ ticks: 2 });
  });

  it('keeps a component removed and re-set outside a tick (setup/tooling code)', () => {
    const Stunned = defineComponent<{ ticks: number }>('stunned');
    const w = new World();
    w.spawnRaw({ stunned: { ticks: 1 } }, 'hero');
    const mirror: Record<EntityId, ComponentMap> = {};
    for (const [id, c] of Object.entries(takeKeyframe(w).entities)) mirror[id] = c;
    w.remove('hero', Stunned);
    w.set('hero', Stunned, { ticks: 3 });
    applyDelta(mirror, takeDelta(w, w.tick));
    expect(mirror.hero?.stunned).toEqual({ ticks: 3 });
  });

  it('still reports a removal that is not superseded by a write', () => {
    const Stunned = defineComponent<{ ticks: number }>('stunned');
    const w = new World();
    w.spawnRaw({ stunned: { ticks: 1 }, transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'hero');
    const mirror: Record<EntityId, ComponentMap> = {};
    for (const [id, c] of Object.entries(takeKeyframe(w).entities)) mirror[id] = c;
    w.remove('hero', Stunned);
    w.patch('hero', Transform, { pos: [1, 1, 1] });
    const d = takeDelta(w, w.tick);
    expect(d.removedComponents.hero).toEqual(['stunned']);
    applyDelta(mirror, d);
    expect(mirror).toEqual(takeKeyframe(w).entities);
  });

  it('property: applyDelta(delta(a->b), a) === b over random mutations', () => {
    const Tag = defineComponent<{ t: string }>('tag');
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            op: fc.constantFrom('spawn', 'patch', 'remove', 'destroy'),
            n: fc.integer({ min: 0, max: 5 }),
            x: fc.integer({ min: -100, max: 100 }),
          }),
          { maxLength: 30 },
        ),
        (ops) => {
          const w = new World();
          for (let i = 0; i < 4; i++) {
            w.spawnRaw(
              { tag: { t: `t${i}` }, transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } },
              `e${i}`,
            );
          }
          const mirror: Record<EntityId, ComponentMap> = {};
          for (const [id, c] of Object.entries(takeKeyframe(w).entities)) mirror[id] = c;

          w.addSystem(
            (world) => {
              const spawnedThisTick = new Set<string>();
              for (const op of ops) {
                const id = `e${op.n % 4}`;
                const spawnId = `s${op.n}`;
                if (op.op === 'spawn' && !world.exists(spawnId) && !spawnedThisTick.has(spawnId)) {
                  world.spawnRaw({ tag: { t: 'x' } }, spawnId);
                  spawnedThisTick.add(spawnId);
                } else if (op.op === 'patch' && world.exists(id) && world.has(id, Transform))
                  world.patch(id, Transform, { pos: [op.x, 0, 0] });
                else if (op.op === 'remove' && world.exists(id) && world.has(id, Tag))
                  world.remove(id, Tag);
                else if (op.op === 'destroy' && world.exists(id)) world.destroy(id);
              }
            },
            { name: 'apply-ops' },
          );
          const base = w.tick;
          w.step();
          const d: Delta = takeDelta(w, base);
          applyDelta(mirror, d);
          expect(mirror).toEqual(takeKeyframe(w).entities);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('snapshot providers (plugin blobs)', () => {
  it('captures and restores an opaque blob via keyframe.plugins', () => {
    const w = new World();
    let pluginState = { warmStart: 42 };
    w.registerSnapshotProvider(
      'demo',
      () => ({ ...pluginState }),
      (v) => {
        pluginState = v as { warmStart: number };
      },
    );
    w.spawnRaw({ tag: { t: 'x' } }, 'e');
    const kf = takeKeyframe(w);
    expect((kf.plugins.demo as { warmStart: number }).warmStart).toBe(42);

    // mutate, then restore
    pluginState = { warmStart: 0 };
    worldFromKeyframe(kf); // standalone load doesn't touch this world's provider
    const w2 = new World();
    let restored = { warmStart: -1 };
    w2.registerSnapshotProvider(
      'demo',
      () => restored,
      (v) => {
        restored = v as { warmStart: number };
      },
    );
    // applyKeyframeTo runs providers' load
    applyKeyframeTo(w2, kf);
    expect(restored.warmStart).toBe(42);
  });
});

describe('canonical state hash', () => {
  it('is identical across 100 independent runs', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const w = movingWorld('stable-seed');
      w.stepN(50);
      hashes.add(stateHash(w));
    }
    expect(hashes.size).toBe(1);
  });

  it('is order-independent (component/entity insertion order does not matter)', () => {
    const a = new World();
    a.spawnRaw(
      { transform: { pos: [1, 2, 3], rot: [0, 0, 0, 1] }, velocity: { v: [1, 0, 0] } },
      'x',
    );
    const b = new World();
    // insert components in a different order
    b.spawnRaw({}, 'x');
    b.set('x', Velocity, { v: [1, 0, 0] });
    b.set('x', Transform, { pos: [1, 2, 3], rot: [0, 0, 0, 1] });
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('differs when state differs', () => {
    const a = movingWorld('h');
    a.stepN(10);
    const b = movingWorld('h');
    b.stepN(11);
    expect(stateHash(a)).not.toBe(stateHash(b));
  });

  it('covers the clock, RNG state, and entity allocator (not only entities)', () => {
    const empty = new World({ seed: 'clock' });
    const before = stateHash(empty);
    empty.step();
    expect(stateHash(empty)).not.toBe(before);

    const a = new World({ seed: 'one' });
    const b = new World({ seed: 'two' });
    a.spawnRaw({ tag: { t: 'x' } }, 'e');
    b.spawnRaw({ tag: { t: 'x' } }, 'e');
    expect(stateHash(a)).not.toBe(stateHash(b));

    const c = new World({ seed: 'seq' });
    const d = new World({ seed: 'seq' });
    c.spawnRaw({ tag: { t: 'x' } }); // e0
    d.spawnRaw({ tag: { t: 'x' } }); // e0
    d.destroy(d.spawnRaw({ tag: { t: 'y' } })); // advances the allocator only
    expect(stateHash(c)).not.toBe(stateHash(d));
  });
});

describe('state format vs engine version', () => {
  it('pins ENGINE_VERSION to the published package version', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(ENGINE_VERSION).toBe(pkg.version);
  });

  it('records the state format in the keyframe and the engine version as metadata only', () => {
    const w = movingWorld('fmt');
    w.stepN(3);
    const kf = takeKeyframe(w);
    expect(kf.plugins[STATE_FORMAT_KEY]).toBe(STATE_FORMAT);
    expect(keyframeStateFormat(kf)).toBe(STATE_FORMAT);
    expect(kf.engine).toBe(ENGINE_VERSION);
  });

  it('loads a keyframe written by a different engine version (same state format)', () => {
    const w = movingWorld('fmt');
    w.stepN(3);
    const hash = stateHash(w);
    // A save file from a later release of the same simulation: version bumped, layout identical.
    const kf = { ...takeKeyframe(w), engine: '9.9.9-from-the-future' };
    const restored = worldFromKeyframe(JSON.parse(JSON.stringify(kf)));
    expect(stateHash(restored)).toBe(hash);
  });

  it('rejects a keyframe from another state format, and reads a pre-format save as format 1', () => {
    const w = movingWorld('fmt');
    w.stepN(3);
    const kf = takeKeyframe(w);
    const older = {
      ...kf,
      plugins: { ...kf.plugins, [STATE_FORMAT_KEY]: STATE_FORMAT + 1 },
    };
    expect(() => worldFromKeyframe(older)).toThrow(/state format/);
    const { [STATE_FORMAT_KEY]: _dropped, ...withoutFormat } = kf.plugins;
    expect(keyframeStateFormat({ ...kf, plugins: withoutFormat })).toBe(1);
  });

  it('hashes the state format, not the engine version', () => {
    const w = movingWorld('fmt');
    w.stepN(3);
    // The hash is taken from the world, so the only way the version could reach it is via the
    // constant — assert directly that the format, not the version, is the hashed generation.
    expect(stateHash(w)).toBe(
      hashJson({
        hashVersion: 2,
        stateFormat: STATE_FORMAT,
        tickRate: w.tickRate,
        plugins: {},
        tick: w.tick,
        rng: w._internal().getRng().save(),
        nextEntitySeq: w._internal().getNextSeq(),
        entityOrder: [...w._internal().entities],
        commands: w._internal().saveCommands(),
        entities: captureEntities(w),
      } as unknown as JsonValue),
    );
  });
});
