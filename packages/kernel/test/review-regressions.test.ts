import { type SceneManifest, validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { Character, installCharacterController } from '../src/character';
import { componentHandle, Transform } from '../src/component';
import {
  cancelTimer,
  installGameplay,
  scheduleTimer,
  startTween,
  Timer,
  Tween,
} from '../src/gameplay';
import { installKinematics } from '../src/kinematics';
import { buildWorld } from '../src/scene';
import { installScripting } from '../src/scripting';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { installTerrain } from '../src/terrain';
import { ReplayPlayer } from '../src/testing';
import { World } from '../src/world';

function scene(over: Record<string, unknown> = {}): SceneManifest {
  const result = validate('scene', { format: 'molen/scene@3', name: 'review', ...over });
  if (!result.ok) throw new Error(result.formatted);
  return result.value;
}
const Counter = componentHandle('reviewCounter');

describe('review F02: reentrant timers and tweens', () => {
  it.each(['tick', 'command'])('creates the first singleton from a %s handler', (phase) => {
    const w = new World();
    installGameplay(w);
    const seen: string[] = [];
    w.on('done', () => seen.push('done'));
    const schedule = (): void => {
      scheduleTimer(w, null, { ticks: 1, event: 'done' });
      scheduleTimer(w, null, { ticks: 1, event: 'done' });
    };
    if (phase === 'tick')
      w.addSystem(() => {
        if (w.tick === 0) schedule();
      });
    else {
      w.registerCommand('start', schedule);
      w._internal().submitRecordedCommand({
        kind: 'command',
        type: 'start',
        payload: {},
        source: 'test',
        seq: 0,
        tick: 0,
      });
    }
    w.stepN(3);
    expect(seen).toEqual(['done', 'done']);
  });
  it('preserves chained timers and lets a repeating timer cancel itself', () => {
    const w = new World();
    installGameplay(w);
    const seen: string[] = [];
    const id = scheduleTimer(w, null, { ticks: 1, repeatEvery: 1, event: 'first' });
    w.on('first', () => {
      seen.push('first');
      cancelTimer(w, null, id);
      scheduleTimer(w, null, { ticks: 1, event: 'second' });
    });
    w.on('second', () => seen.push('second'));
    w.stepN(4);
    expect(seen).toEqual(['first', 'second']);
    expect(w.get('$timers', Timer)).toBeUndefined();
  });
  it('preserves a tween started by its completion callback', () => {
    const w = new World();
    installGameplay(w);
    w.spawnRaw({ reviewCounter: { n: 0 } }, 'c');
    startTween(w, 'c', { id: 'first', component: 'reviewCounter', path: 'n', to: 1, ticks: 1 });
    w.on('tween-complete', (e) => {
      if ((e.payload as { id: string }).id === 'first')
        startTween(w, 'c', {
          id: 'second',
          component: 'reviewCounter',
          path: 'n',
          to: 2,
          ticks: 1,
        });
    });
    w.stepN(2);
    expect(w.get('c', Counter)?.n).toBe(2);
    expect(w.get('c', Tween)).toBeUndefined();
  });
});

describe('review F03/F04: continuation state', () => {
  it('restores script-owned state into both fresh and already-running worlds', () => {
    const manifest = scene({
      scripts: [
        {
          id: 'counter',
          checkpoint: 'state',
          code: "molen.on('tick', () => molen.patchState({ n: (molen.state.n ?? 0) + 1 }));",
        },
      ],
    });
    const a = buildWorld(manifest);
    a.stepN(5);
    const saved = takeKeyframe(a);
    a.stepN(4);
    const b = buildWorld(manifest);
    b.stepN(20);
    applyKeyframeTo(b, saved);
    b.stepN(4);
    expect(stateHash(b)).toBe(stateHash(a));
    const replay = new ReplayPlayer(() => buildWorld(manifest), [], {
      totalTicks: 10,
      keyframeInterval: 5,
    });
    expect(stateHash(replay.seek(9))).toBe(stateHash(a));
  });
  it('replays legacy mutable closures from origin and rejects unsafe checkpoint restoration', () => {
    const manifest = scene({
      entities: [{ id: 'c', components: { reviewCounter: { n: 0 } } }],
      scripts: [
        {
          id: 'legacy',
          code: "let n = 0; molen.on('tick', () => molen.patch('c', 'reviewCounter', { n: ++n }));",
        },
      ],
    });
    const replay = new ReplayPlayer(() => buildWorld(manifest), [], {
      totalTicks: 10,
      keyframeInterval: 5,
    });
    expect(replay.seek(7).get('c', Counter)?.n).toBe(7);
    const running = buildWorld(manifest);
    running.stepN(5);
    expect(() => applyKeyframeTo(buildWorld(manifest), takeKeyframe(running))).toThrow(
      'require replay',
    );
  });
  it('retains future commands and live-source sequence cursors without double-enqueuing replay commands', () => {
    const build = (): World => {
      const w = new World();
      w.spawnRaw({ reviewCounter: { n: 0 } }, 'c');
      w.registerCommand('inc', () =>
        w.patch('c', Counter, { n: Number(w.get('c', Counter)?.n) + 1 }),
      );
      return w;
    };
    const cmd = {
      kind: 'command' as const,
      type: 'inc',
      payload: {},
      source: 'test',
      seq: 4,
      tick: 8,
    };
    const a = build();
    expect(a.submitCommand(cmd).accepted).toBe(true);
    a.stepN(4);
    const b = build();
    applyKeyframeTo(b, takeKeyframe(a));
    expect(b.submitCommand({ ...cmd, tick: 9 }).accepted).toBe(false);
    a.stepN(6);
    b.stepN(6);
    expect(b.get('c', Counter)?.n).toBe(1);
    expect(stateHash(b)).toBe(stateHash(a));
    const replay = new ReplayPlayer(build, [cmd], { totalTicks: 10, keyframeInterval: 5 });
    expect(replay.seek(10).get('c', Counter)?.n).toBe(1);
  });
  it('hashes entity iteration order, tick rate, commands and plugin continuation state', () => {
    const a = new World();
    const b = new World();
    a.spawnRaw({}, '9');
    a.spawnRaw({}, '2');
    b.spawnRaw({}, '2');
    b.spawnRaw({}, '9');
    expect(stateHash(a)).not.toBe(stateHash(b));
    const restored = new World();
    applyKeyframeTo(restored, JSON.parse(JSON.stringify(takeKeyframe(a))));
    expect([...restored._internal().entities]).toEqual(['9', '2']);
    expect(stateHash(restored)).toBe(stateHash(a));
    expect(stateHash(new World({ tickRate: 30 }))).not.toBe(stateHash(new World({ tickRate: 60 })));
    const x = new World();
    const y = new World();
    x.registerSnapshotProvider(
      'test',
      () => ({ velocity: 1 }),
      () => {},
    );
    y.registerSnapshotProvider(
      'test',
      () => ({ velocity: 2 }),
      () => {},
    );
    expect(stateHash(x)).not.toBe(stateHash(y));
    const before = stateHash(a);
    a.registerCommand('go', () => {});
    a.submitCommand({ kind: 'command', type: 'go', payload: {}, source: 'test', seq: 1, tick: 5 });
    expect(stateHash(a)).not.toBe(before);
  });
});

describe('review F05/F06/F07/F11/F15: script boundary', () => {
  it('isolates world-local defaults and detaches them from caller data', () => {
    const defaults = { health: { hp: 10 } };
    const a = new World({ defaults });
    const b = new World({ defaults: { health: { hp: 20 } } });
    defaults.health.hp = 99;
    const first = a.spawn({ health: {} });
    const second = b.spawn({ health: {} });
    expect(a.get(first, componentHandle('health'))?.hp).toBe(10);
    expect(b.get(second, componentHandle('health'))?.hp).toBe(20);
  });
  it('keeps component vocabularies isolated between live worlds', () => {
    const make = (type: string): World =>
      buildWorld(
        scene({
          components: {
            customScore: {
              description: 'Score',
              examples: [{}],
              schema: { type: 'object', properties: { value: { type } }, required: ['value'] },
            },
          },
          scripts: [
            {
              id: 'write',
              code: "molen.on('tick', () => molen.set('c', 'customScore', { value: 42 }));",
            },
          ],
          entities: [{ id: 'c' }],
        }),
      );
    const numeric = make('number');
    const string = make('string');
    expect(() => numeric.step()).not.toThrow();
    expect(() => string.step()).toThrow('customScore');
  });
  it('validates full type merges and patch results and applies defaults before script spawn checks', () => {
    const types = new Map([
      ['demo.hero', { components: { transform: { pos: [0, 0, 0] } }, scripts: [] }],
    ]);
    const malformed = scene({
      entities: [{ type: 'demo.hero', components: { transform: { pos: 'bad' } } }],
    });
    expect(() => buildWorld(malformed, undefined, { types })).toThrow('pos');
    const w = buildWorld(
      scene({
        entities: [{ id: 'hero', components: { transform: { pos: [0, 0, 0] } } }],
        scripts: [
          {
            id: 'bad',
            code: "molen.on('tick', () => molen.patch('hero', 'transform', { pos: 'bad' }));",
          },
        ],
      }),
    );
    expect(() => w.step()).toThrow('pos');
    expect(w.get('hero', Transform)?.pos).toEqual([0, 0, 0]);
    const valid = new World();
    installScripting(valid, [
      { id: 'defaults', source: "molen.spawn({ transform: { rot: [0,0,0,1] } }, 'hero');" },
    ]);
    expect(valid.get('hero', Transform)?.pos).toEqual([0, 0, 0]);
  });
  it('spawns registry types directly and through a type-backed prefab', () => {
    const types = new Map([
      [
        'demo.hero',
        {
          components: { transform: { pos: [1, 2, 3] }, health: { hp: 10 } },
          scripts: [],
        },
      ],
    ]);
    const w = buildWorld(
      scene({
        prefabs: { hero: { type: 'demo.hero', components: {} } },
        scripts: [
          {
            id: 'spawn',
            code: "molen.spawn('hero', {}, 'a'); molen.spawnType('demo.hero', { health: { hp: 20 } }, 'b');",
          },
        ],
      }),
      undefined,
      { types },
    );
    expect(w.get('a', Transform)?.pos).toEqual([1, 2, 3]);
    expect(w.get('b', componentHandle('health'))?.hp).toBe(20);
  });
  it('rejects undeclared script commands before registering any behavior', () => {
    const w = new World();
    expect(() =>
      installScripting(w, [{ id: 'typo', source: "molen.onCommand('mvoe', () => {});" }]),
    ).toThrow('undeclared command');
    expect(w.hasCommand('mvoe')).toBe(false);
  });
  it('uses the seeded world RNG during initialization and ticks', () => {
    const build = (): World => {
      const w = new World({ seed: 'init' });
      installScripting(w, [
        {
          id: 'rng',
          source:
            "molen.spawn({ reviewCounter: { n: molen.rng() } }, 'c'); molen.on('tick', () => molen.patch('c', 'reviewCounter', { next: molen.rng() }));",
        },
      ]);
      return w;
    };
    const a = build();
    const b = build();
    expect(a.get('c', Counter)?.n).not.toBe(0);
    expect(stateHash(a)).toBe(stateHash(b));
    a.step();
    b.step();
    expect(stateHash(a)).toBe(stateHash(b));
    expect(a.get('c', Counter)?.next).not.toBe(a.get('c', Counter)?.n);
  });
});

describe('review F13/F16: motion and terrain', () => {
  it('collides, slides and jumps with either character/kinematics install order', () => {
    for (const reverse of [false, true]) {
      const w = new World();
      if (reverse) {
        installKinematics(w);
        installCharacterController(w);
      } else {
        installCharacterController(w);
        installKinematics(w);
      }
      w.spawn(
        {
          transform: { pos: [0, 0, 0] },
          collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
          kinematicBody: { vel: [0, 0, 0], slide: true },
          character: { speed: 6, jumpSpeed: 5, gravity: 10, vy: 0, grounded: true },
          moveIntent: { dir: [1, 0.2], jump: false },
        },
        { id: 'hero' },
      );
      w.spawn({
        transform: { pos: [1, 0, 0] },
        collider: { shape: 'aabb', halfExtents: [0.1, 20], isStatic: true, layer: 1, mask: 1 },
      });
      w.stepN(30);
      const pos = w.get('hero', Transform)?.pos;
      expect(pos?.[0]).toBeCloseTo(0.4);
      expect(pos?.[2]).toBeGreaterThan(0.5);
      expect(w.get('hero', Character)?.grounded).toBe(true);
      w.patch('hero', componentHandle('moveIntent'), { jump: true });
      w.step();
      expect(w.get('hero', Transform)?.pos[1]).toBeGreaterThan(0);
    }
  });
  it('bisects short and final partial segments and reports exhausted query budgets', () => {
    const field = { sampleHeight: () => 0, normalAt: (): [number, number, number] => [0, 1, 0] };
    const terrain = installTerrain(new World(), field);
    for (const height of [0.1, 1.1]) {
      const hit = terrain.raycast([0, height, 0], [0, -1, 0], height + 0.1);
      expect(hit?.distance).toBeCloseTo(height, 6);
      expect(hit?.point[1]).toBeCloseTo(height - (hit?.distance ?? Number.NaN), 8);
    }
    const limited = installTerrain(new World(), field, { maxRaySteps: 1 });
    expect(() => limited.raycast([0, 3, 0], [0, -1, 0], 4)).toThrow('maxRaySteps');
    expect(() => terrain.raycast([Number.NaN, 1, 0], [0, -1, 0], 2)).toThrow('finite');
    expect(() => installTerrain(new World(), field, { maxRaySteps: 0 })).toThrow('positive');
  });
});
