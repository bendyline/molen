import type { Command, SceneManifest } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { defineComponent, Transform } from '../src/component';
import { createWorldFromScene } from '../src/scene';
import { stateHash } from '../src/snapshot';
import { firstDivergentTick, perTickHashes, runReplay, type WorldBuilder } from '../src/testing';
import type { System } from '../src/world';

const Counter = defineComponent<{ n: number }>('counter');

function scene(): SceneManifest {
  const r = validate('scene', {
    format: 'molen/scene@3',
    name: 'replay-demo',
    seed: 'replay-1',
    tickRate: 30,
    prefabs: {
      mover: {
        components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, counter: { n: 0 } },
      },
    },
    entities: [
      { id: 'a', prefab: 'mover' },
      { id: 'b', prefab: 'mover', components: { transform: { pos: [10, 0, 0] } } },
    ],
  });
  if (!r.ok) throw new Error(r.formatted);
  return r.value;
}

function builder(): WorldBuilder {
  return () => {
    const world = createWorldFromScene(scene());
    // tick system: increment every counter
    const tickUp: System = (w) => {
      for (const [id, c] of w.query(Counter)) w.patch(id, Counter, { n: c.n + 1 });
    };
    world.addSystem(tickUp, { name: 'tickUp' });
    world.registerCommand('bump', (w, command) => {
      const target = (command.payload as { id: string }).id;
      const cur = w.get(target, Counter)?.n ?? 0;
      w.set(target, Counter, { n: cur + 100 });
    });
    return world;
  };
}

describe('scene instantiation', () => {
  it('instantiates prefabs with layered components (deep-merged)', () => {
    const world = createWorldFromScene(scene());
    expect(world.get('a', Transform)?.pos).toEqual([0, 0, 0]);
    // override replaced pos but kept rot from the prefab
    expect(world.get('b', Transform)).toEqual({ pos: [10, 0, 0], rot: [0, 0, 0, 1] });
  });

  it('throws on unknown prefab references', () => {
    const bad = { ...scene(), entities: [{ id: 'x', prefab: 'ghost' }] };
    expect(() => createWorldFromScene(bad)).toThrow(/unknown prefab/);
  });

  it('composes prefabs via extends (parent <- child, deep-merged)', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'compose',
      prefabs: {
        unit: {
          components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, health: { hp: 10 } },
        },
        goblin: { extends: 'unit', components: { health: { hp: 5 }, tag: { name: 'goblin' } } },
      },
      entities: [{ id: 'g', prefab: 'goblin' }],
    });
    if (!r.ok) throw new Error(r.formatted);
    const world = createWorldFromScene(r.value);
    const Health = defineComponent<{ hp: number } & import('@bendyline/molen-schema').JsonObject>(
      'health',
    );
    // child overrides hp, inherits transform from parent, adds its own tag
    expect(world.get('g', Health)?.hp).toBe(5);
    expect(world.get('g', Transform)?.pos).toEqual([0, 0, 0]);
  });

  it('detects prefab inheritance cycles (validation first, kernel as the last line)', () => {
    const doc = {
      format: 'molen/scene@3',
      name: 'cyc',
      prefabs: { a: { extends: 'b', components: {} }, b: { extends: 'a', components: {} } },
      entities: [{ id: 'x', prefab: 'a' }],
    };
    const r = validate('scene', doc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === 'prefab_extends_cycle')).toBe(true);
    // A hand-built (unvalidated) manifest still fails loudly in the kernel.
    const manifest = {
      ...doc,
      seed: 0,
      tickRate: 30,
      lateCommands: 'rewrite',
      keyframeInterval: 60,
      scripts: [],
      commands: {},
      components: {},
    } as unknown as Parameters<typeof createWorldFromScene>[0];
    expect(() => createWorldFromScene(manifest)).toThrow(/cycle/);
  });
});

describe('replay', () => {
  const commands: Command[] = [
    {
      kind: 'command',
      seq: 0,
      source: 'local',
      tick: 3,
      tickExecuted: 3,
      type: 'bump',
      payload: { id: 'a' },
    },
  ];

  it('records then replays to the same final hash', () => {
    // record a reference run
    const ref = builder()();
    for (const c of commands) ref.submitCommand({ ...c, tick: c.tickExecuted ?? c.tick });
    ref.stepN(10);
    const expectedHash = stateHash(ref);

    const result = runReplay(builder(), commands, 10, expectedHash);
    expect(result.ok).toBe(true);
    expect(result.actualHash).toBe(expectedHash);
  });

  it('is deterministic: same builder twice never diverges', () => {
    expect(firstDivergentTick(builder(), builder(), 30, commands, commands)).toBeNull();
  });

  it('reports the exact first divergent tick for a mutated command stream', () => {
    // Future command queues differ immediately, before their visible component effects.
    const commandsB: Command[] = [
      {
        kind: 'command',
        seq: 0,
        source: 'local',
        tick: 4,
        tickExecuted: 4,
        type: 'bump',
        payload: { id: 'a' },
      },
    ];
    const report = firstDivergentTick(builder(), builder(), 30, commands, commandsB);
    expect(report).not.toBeNull();
    expect(report?.tick).toBe(0);
    // The continuation diff identifies the queued command.
    const d = report?.diff.find((x) => x.entity === '$world' && x.component === 'commands');
    expect(d?.kind).toBe('changed');
  });

  it('per-tick hashes are stable across runs', () => {
    const h1 = perTickHashes(builder(), commands, 12);
    const h2 = perTickHashes(builder(), commands, 12);
    expect(h1).toEqual(h2);
    expect(h1).toHaveLength(12);
  });
});
