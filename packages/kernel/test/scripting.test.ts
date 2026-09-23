import type { Command } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../src/component';
import { dmath } from '../src/dmath';
import { buildWorld, inlineScriptSources } from '../src/scene';
import { installScripting } from '../src/scripting';
import { stateHash } from '../src/snapshot';
import { World } from '../src/world';

const Counter = defineComponent<{ n: number }>('counter');

describe('script evaluation (per-script Compartment)', () => {
  it('runs a tick handler each tick', () => {
    const w = new World({ tickRate: 30, seed: 's' });
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    installScripting(w, [
      {
        id: 'inc',
        source: `molen.on('tick', () => { const c = molen.get('c', 'counter'); molen.set('c', 'counter', { n: c.n + 1 }); });`,
      },
    ]);
    w.stepN(5);
    expect(w.get('c', Counter)?.n).toBe(5);
  });

  it('spawns entities from a script using config + rng', () => {
    const w = new World({ tickRate: 30, seed: 'spawn' });
    installScripting(w, [
      {
        id: 'spawner',
        config: { every: 2 },
        source: `
          let t = 0;
          molen.on('tick', () => {
            t++;
            if (t % config.every === 0) {
              molen.spawn({ tag: { name: 'enemy' }, transform: { pos: [molen.rng() * 10, 0, 0], rot: [0,0,0,1] } });
            }
          });
        `,
      },
    ]);
    w.stepN(6); // ticks 1..6, spawns at t=2,4,6 -> 3 enemies
    const Tag = defineComponent<{ name: string }>('tag');
    expect(w.query(Tag).count()).toBe(3);
  });

  it('is deterministic (script + rng) across runs', () => {
    const build = (): World => {
      const w = new World({ tickRate: 30, seed: 'det' });
      installScripting(w, [
        {
          id: 's',
          source: `molen.on('tick', () => { molen.spawn({ v: { x: molen.rng() } }); });`,
        },
      ]);
      return w;
    };
    const a = build();
    a.stepN(10);
    const b = build();
    b.stepN(10);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('reacts to world events via molen.on', () => {
    const w = new World({ tickRate: 30, seed: 'e' });
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    installScripting(w, [
      {
        id: 'reactor',
        source: `molen.on('ping', (payload) => { molen.patch('c', 'counter', { n: payload.by }); });`,
      },
    ]);
    w.addSystem((world) => world.emit('ping', { by: 42 }), { name: 'pinger' });
    w.step();
    expect(w.get('c', Counter)?.n).toBe(42);
  });

  it('hot reload swaps behavior but preserves world state', () => {
    const w = new World({ tickRate: 30, seed: 'hot' });
    w.spawnRaw({ counter: { n: 10 } }, 'c');
    const host = installScripting(w, [
      {
        id: 's',
        source: `molen.on('tick', () => { const c = molen.get('c','counter'); molen.set('c','counter',{ n: c.n + 1 }); });`,
      },
    ]);
    w.stepN(3); // 10 -> 13
    expect(w.get('c', Counter)?.n).toBe(13);
    // reload: now decrement by 5 each tick
    host.reload(
      's',
      `molen.on('tick', () => { const c = molen.get('c','counter'); molen.set('c','counter',{ n: c.n - 5 }); });`,
    );
    w.stepN(2); // 13 -> 3
    expect(w.get('c', Counter)?.n).toBe(3); // world state (counter) survived the reload
  });

  it('keeps the previous behavior when reload evaluation fails', () => {
    const w = new World();
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    const host = installScripting(w, [
      {
        id: 's',
        source: `molen.on('tick', () => { const c=molen.get('c','counter'); molen.set('c','counter',{n:c.n+1}); });`,
      },
    ]);
    expect(() =>
      host.reload('s', `molen.on('tick', () => {}); throw new Error('bad reload');`),
    ).toThrow(/bad reload/);
    w.step();
    expect(w.get('c', Counter)?.n).toBe(1);
    expect(host.count).toBe(1);
  });

  it('rejects duplicate ids and counts scripts added by reload', () => {
    const w = new World();
    expect(() =>
      installScripting(w, [
        { id: 'same', source: `molen.on('tick', () => {});` },
        { id: 'same', source: `molen.on('tick', () => {});` },
      ]),
    ).toThrow(/duplicate script id/);

    const host = installScripting(w, []);
    host.reload('added', `molen.on('tick', () => {});`);
    expect(host.count).toBe(1);
  });

  it('denies Date, Intl, Promise, and Math.random inside scripts', () => {
    const w = new World({ tickRate: 30, seed: 'tame' });
    w.spawnRaw({ counter: { n: -1 } }, 'c');
    installScripting(w, [
      {
        id: 'probe',
        source: `
          const n = (typeof Date === 'undefined' ? 1 : 0)
            + (typeof Math.random === 'undefined' ? 10 : 0)
            + (typeof Intl === 'undefined' ? 100 : 0)
            + (typeof Promise === 'undefined' ? 1000 : 0);
          molen.on('tick', () => molen.set('c', 'counter', { n }));
        `,
      },
    ]);
    w.step();
    expect(w.get('c', Counter)?.n).toBe(1111);
  });

  it('fails loudly on Promise rather than letting a write land after the tick', () => {
    // Top level: the script never installs.
    expect(() =>
      installScripting(new World(), [
        { id: 'deferred', source: `Promise.resolve().then(() => molen.destroy('c'));` },
      ]),
    ).toThrow(/script "deferred" failed to evaluate/);

    // Inside a handler: the tick throws, attributed to the script, and nothing is queued for
    // after world.step() returns (which is after the hash, delta and keyframe were taken).
    const w = new World({ tickRate: 30, seed: 'defer' });
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    installScripting(w, [
      {
        id: 'later',
        source: `molen.on('tick', () => { Promise.resolve().then(() => molen.set('c', 'counter', { n: 99 })); });`,
      },
    ]);
    expect(() => w.step()).toThrow(/script "later" tick handler/);
    expect(w.get('c', Counter)?.n).toBe(0);
  });

  it('exposes the whole dmath surface on the script Math (no runtime-only gaps)', () => {
    const w = new World({ tickRate: 30, seed: 'math' });
    let keys: string[] = [];
    w.on('math-keys', (e) => {
      keys = e.payload as string[];
    });
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    installScripting(w, [
      {
        id: 'probe',
        source: `
          molen.on('tick', () => {
            molen.emit('math-keys', Object.keys(Math));
            molen.set('c', 'counter', { n: Math.asin(0.5) + Math.acos(0.5) + Math.atan(1)
              + Math.log2(8) + Math.log10(100) + Math.cbrt(27) + Math.fround(1.5)
              + Math.lerp(0, 10, 0.5) + Math.frac(1.25) + Math.smoothstep(0.5)
              + Math.wrapAngle(0) + Math.clamp(5, 0, 1) });
          });
        `,
      },
    ]);
    w.step();
    // Every dmath verb a script can type must exist at tick time: `molen scripts check` types
    // scripts against this surface, so a gap is a green check that throws in front of a player.
    for (const name of Object.keys(dmath)) expect(keys).toContain(name);
    expect(keys).not.toContain('random');
    expect(w.get('c', Counter)?.n).toBe(
      dmath.asin(0.5) +
        dmath.acos(0.5) +
        dmath.atan(1) +
        dmath.log2(8) +
        dmath.log10(100) +
        dmath.cbrt(27) +
        Math.fround(1.5) +
        dmath.lerp(0, 10, 0.5) +
        dmath.frac(1.25) +
        dmath.smoothstep(0.5) +
        dmath.wrapAngle(0) +
        dmath.clamp(5, 0, 1),
    );
  });

  it('freezes config and the shared molen global so scripts cannot rewrite them', () => {
    const w = new World({ tickRate: 30, seed: 'frozen' });
    expect(() =>
      installScripting(w, [
        { id: 'cfg', config: { x: 0 }, source: `config.x = 1; molen.on('tick', () => {});` },
      ]),
    ).toThrow(/script "cfg" failed to evaluate/);
    expect(() =>
      installScripting(w, [
        { id: 'verb', source: `molen.spawn = null; molen.on('tick', () => {});` },
      ]),
    ).toThrow(/script "verb" failed to evaluate/);
  });

  // The trust boundary, pinned so the docs and the code cannot drift apart: WITHOUT
  // hardenScripts() a Compartment is determinism tooling, not containment. If SES ever closes
  // this by itself, this test fails and docs-src/guide/scripting.md ("Script trust") needs the
  // opposite claim. hardenScripts() is what makes it fail on purpose — see harden-scripts.test.ts
  // (its own process, because lockdown() is process-global).
  it('is NOT an isolation boundary un-hardened: a script reaches the host global', () => {
    const w = new World({ tickRate: 30, seed: 'trust' });
    w.spawnRaw({ counter: { n: -1 } }, 'c');
    installScripting(w, [
      {
        id: 'reach',
        source: `
          const g = (() => {}).constructor('return globalThis')();
          g.__molenTrustProbe = 7;
          molen.on('tick', () => molen.set('c', 'counter', { n: g.__molenTrustProbe }));
        `,
      },
    ]);
    w.step();
    expect(w.get('c', Counter)?.n).toBe(7);
    const host = globalThis as unknown as Record<string, unknown>;
    // The write landed in the HOST realm, not in some copy of it.
    expect(host.__molenTrustProbe).toBe(7);
    delete host.__molenTrustProbe;
  });

  it('reports the api -> molen rename instead of a bare ReferenceError', () => {
    const w = new World({ tickRate: 30, seed: 'renamed' });
    // Top-level use (the pre-rename shape) fails at evaluation...
    expect(() => installScripting(w, [{ id: 'old', source: `api.on('tick', () => {});` }])).toThrow(
      /the injected global `api` is now `molen`/,
    );
    // ...and so does a deferred reference inside a handler.
    const w2 = new World({ tickRate: 30, seed: 'renamed2' });
    installScripting(w2, [
      { id: 'late', source: `molen.on('tick', () => { api.destroy('x'); });` },
    ]);
    expect(() => w2.step()).toThrow(/the injected global `api` is now `molen`/);
  });

  it('attributes evaluation errors to the script', () => {
    const w = new World();
    expect(() => installScripting(w, [{ id: 'bad', source: `molen.on(` }])).toThrow(
      /script "bad" failed to evaluate/,
    );
  });

  it('attributes handler errors to the script, event, and tick, with a mutation hint', () => {
    const w = new World({ tickRate: 30, seed: 'attr' });
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    installScripting(w, [
      {
        id: 'mut',
        source: `molen.on('tick', () => { const c = molen.get('c', 'counter'); c.n = 5; });`,
      },
    ]);
    expect(() => w.step()).toThrow(/script "mut" tick handler at tick 0: .*molen\.patch/);

    const w2 = new World({ tickRate: 30, seed: 'attr2' });
    installScripting(w2, [
      { id: 'thrower', source: `molen.on('ping', () => { throw new Error('nope'); });` },
    ]);
    w2.addSystem((world) => world.emit('ping', null), { name: 'pinger' });
    expect(() => w2.step()).toThrow(/script "thrower" event "ping" handler at tick 0: nope/);
  });

  it('gives molen.dt and molen.rng inside event handlers, not only tick handlers', () => {
    const w = new World({ tickRate: 10, seed: 'ctx' });
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    installScripting(w, [
      {
        id: 'ev',
        source: `molen.on('ping', () => { molen.set('c', 'counter', { n: molen.dt > 0 && molen.rng() < 1 ? 1 : 0 }); });`,
      },
    ]);
    w.addSystem((world) => world.emit('ping', null), { name: 'pinger' });
    w.step();
    expect(w.get('c', Counter)?.n).toBe(1);
  });
});

describe('scripts handle commands', () => {
  const cmd = (over: Partial<Command>): Command => ({
    kind: 'command',
    seq: 0,
    source: 'local',
    tick: 1,
    type: 'bump',
    payload: null,
    ...over,
  });

  it('molen.onCommand runs in the commands phase with a real ctx (dt, rng)', () => {
    const w = new World({ tickRate: 10, seed: 'cmd' });
    w.declareCommand('bump');
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    installScripting(w, [
      {
        id: 'ctl',
        source: `molen.onCommand('bump', (p, ctx) => {
          molen.set('c', 'counter', { n: p.by + (ctx.dt > 0 ? 1 : 0) + (molen.rng() < 1 ? 0 : 100) });
        });`,
      },
    ]);
    expect(w.submitCommand(cmd({ payload: { by: 41 } })).accepted).toBe(true);
    w.stepN(2);
    expect(w.get('c', Counter)?.n).toBe(42);
  });

  it('molen.rng() inside a command handler is deterministic across runs', () => {
    const build = (): World => {
      const w = new World({ tickRate: 10, seed: 'cmd-rng' });
      w.declareCommand('bump');
      installScripting(w, [
        {
          id: 's',
          source: `molen.onCommand('bump', () => molen.spawn({ v: { x: molen.rng() } }));`,
        },
      ]);
      w.submitCommand(cmd({}));
      return w;
    };
    const a = build();
    a.stepN(3);
    const b = build();
    b.stepN(3);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('hot reload replaces the command handler', () => {
    const w = new World({ tickRate: 10, seed: 'reload-cmd' });
    w.declareCommand('bump');
    w.spawnRaw({ counter: { n: 0 } }, 'c');
    const host = installScripting(w, [
      { id: 's', source: `molen.onCommand('bump', () => molen.set('c', 'counter', { n: 1 }));` },
    ]);
    host.reload('s', `molen.onCommand('bump', () => molen.set('c', 'counter', { n: 2 }));`);
    w.submitCommand(cmd({}));
    w.stepN(2);
    expect(w.get('c', Counter)?.n).toBe(2);
  });

  it('a command-only script is not warned about as a no-op', () => {
    const warnings: unknown[] = [];
    const orig = console.warn;
    console.warn = (...a: unknown[]) => {
      warnings.push(a);
    };
    try {
      const w = new World();
      w.declareCommand('bump');
      installScripting(w, [{ id: 's', source: `molen.onCommand('bump', () => {});` }]);
    } finally {
      console.warn = orig;
    }
    expect(warnings).toHaveLength(0);
  });

  it('buildWorld declares scene commands (with payload schemas) and installs scene scripts', () => {
    const parsed = validate('scene', {
      format: 'molen/scene@3',
      name: 'cmd-scene',
      seed: 'x',
      tickRate: 10,
      entities: [{ id: 'c', components: { counter: { n: 0 } } }],
      commands: {
        move: {
          payload: {
            type: 'object',
            properties: {
              dir: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
            },
            required: ['dir'],
            additionalProperties: false,
          },
        },
      },
      scripts: [
        {
          id: 'ctl',
          code: `molen.onCommand('move', (p) => molen.set('c', 'counter', { n: p.dir[0] }));`,
        },
      ],
    });
    if (!parsed.ok) throw new Error(parsed.formatted);
    const w = buildWorld(parsed.value);
    expect(w.submitCommand(cmd({ type: 'move', payload: { dir: [7, 0] } })).accepted).toBe(true);
    const bad = w.submitCommand(cmd({ type: 'move', seq: 1, payload: { dir: 'x' } }));
    expect(bad.accepted).toBe(false);
    expect(bad.reason).toMatch(/\/dir/);
    w.stepN(2);
    expect(w.get('c', Counter)?.n).toBe(7);

    // scripts: false leaves the manifest's scripts uninstalled
    const silent = buildWorld(parsed.value, undefined, { scripts: false });
    silent.submitCommand(cmd({ type: 'move', payload: { dir: [7, 0] } }));
    silent.stepN(2);
    expect(silent.get('c', Counter)?.n).toBe(0);
  });

  it('inlineScriptSources replaces path refs with code and rejects missing sources', () => {
    const parsed = validate('scene', {
      format: 'molen/scene@3',
      name: 'paths',
      scripts: [
        { id: 'a', path: 'scripts/a.js' },
        { id: 'b', code: 'molen.on("tick", () => {});' },
      ],
    });
    if (!parsed.ok) throw new Error(parsed.formatted);
    const inlined = inlineScriptSources(parsed.value, {
      'scripts/a.js': 'molen.on("tick", () => {});',
    });
    expect(inlined.scripts.map((s) => [s.id, s.code !== undefined, s.path])).toEqual([
      ['a', true, undefined],
      ['b', true, undefined],
    ]);
    expect(() => inlineScriptSources(parsed.value, {})).toThrow(
      /no source for path "scripts\/a.js"/,
    );
  });

  it('forwards extension namespaces to scene scripts', () => {
    const parsed = validate('scene', {
      format: 'molen/scene@3',
      name: 'ext',
      entities: [{ id: 'c', components: { counter: { n: 0 } } }],
      scripts: [
        {
          id: 's',
          code: `molen.on('tick', () => molen.set('c', 'counter', { n: molen.probe.value() }));`,
        },
      ],
    });
    if (!parsed.ok) throw new Error(parsed.formatted);
    const w = buildWorld(parsed.value, undefined, {
      scriptExtensions: { probe: { value: () => 9 } },
    });
    w.step();
    expect(w.get('c', Counter)?.n).toBe(9);
  });
});
