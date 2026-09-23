import type {
  Delta,
  DiagMessage,
  EntityId,
  KernelInbound,
  KernelOutbound,
  Keyframe,
  MessageLink,
} from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { type ClientError, createClientCore } from '../src/client-core';
import type { InterpTransform } from '../src/interpolation';
import type { Renderable, SceneBackend } from '../src/sync';

/** A bidirectional mock link: the client's outbound messages collect in `sent`; tests inject
 *  kernel messages via `deliver` and worker failures via `fail`. Listeners are kept per type,
 *  like a real Worker — the client subscribes `message`, `error` and `messageerror`. */
class MockLink implements MessageLink {
  sent: KernelInbound[] = [];
  readonly listeners = new Map<string, Set<(ev: unknown) => void>>();
  postMessage(message: unknown): void {
    this.sent.push(message as KernelInbound);
  }
  addEventListener(type: string, listener: (ev: unknown) => void): void {
    let set = this.listeners.get(type);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }
  removeEventListener(type: string, listener: (ev: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  private dispatch(type: string, ev: unknown): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(ev);
  }
  deliver(msg: KernelOutbound): void {
    this.dispatch('message', { data: msg });
  }
  /** Simulate a worker that threw (`error`) or sent something undeserializable (`messageerror`). */
  fail(type: 'error' | 'messageerror', ev: unknown = { type }): void {
    this.dispatch(type, ev);
  }
  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class MockBackend implements SceneBackend {
  created: EntityId[] = [];
  destroyed: EntityId[] = [];
  transforms = new Map<EntityId, InterpTransform>();
  create(id: EntityId): void {
    this.created.push(id);
  }
  updateRenderable(): void {}
  destroy(id: EntityId): void {
    this.destroyed.push(id);
  }
  setTransform(id: EntityId, t: InterpTransform): void {
    this.transforms.set(id, t);
  }
}

const box: Renderable = { kind: 'primitive', ref: 'box' };

function keyframe(tick: number, x: number): Keyframe {
  return {
    kind: 'keyframe',
    v: 1,
    engine: '0.0.1',
    tick,
    tickRate: 10,
    seed: 's',
    nextEntitySeq: 0,
    rng: { algo: 'sfc32', state: [1, 2, 3, 4] },
    entities: { a: { transform: { pos: [x, 0, 0], rot: [0, 0, 0, 1] }, renderable: box } },
    plugins: {},
  };
}

function delta(baseTick: number, tick: number, x: number, events: Delta['events'] = []): Delta {
  return {
    kind: 'delta',
    v: 1,
    tick,
    baseTick,
    spawned: {},
    destroyed: [],
    changed: { a: { transform: { pos: [x, 0, 0], rot: [0, 0, 0, 1] } } },
    removedComponents: {},
    events,
  };
}

function setup(): {
  link: MockLink;
  backend: MockBackend;
  core: ReturnType<typeof createClientCore>;
  clock: { t: number };
} {
  const link = new MockLink();
  const backend = new MockBackend();
  const clock = { t: 0 };
  const core = createClientCore({ link, backend, now: () => clock.t });
  return { link, backend, core, clock };
}

describe('client core: periodic keyframes do not hitch', () => {
  it('a contiguous keyframe keeps the interpolation ring (no reset, no jump)', () => {
    const { link, core, clock } = setup();
    link.deliver({ type: 'ready', tick: 0, tickRate: 10 });
    link.deliver({ type: 'keyframe', keyframe: keyframe(0, 0), events: [] });
    clock.t = 100;
    link.deliver({ type: 'delta', delta: delta(0, 1, 10) });
    clock.t = 200;
    link.deliver({ type: 'delta', delta: delta(1, 2, 20) });
    clock.t = 300;
    // The kernel sends a keyframe INSTEAD of a delta at the interval boundary.
    link.deliver({ type: 'keyframe', keyframe: keyframe(3, 30), events: [] });
    expect(core.buffer?.size).toBe(4);
    expect(core.buffer?.latestTick).toBe(3);
    // Sampling between ticks 2 and 3 still interpolates (midpoint), not snaps.
    const mid = core.buffer?.sampleAt(2.5, 'a');
    expect(mid?.pos[0]).toBeCloseTo(25);
  });

  it('a non-contiguous (resync) keyframe resets the ring', () => {
    const { link, core } = setup();
    link.deliver({ type: 'keyframe', keyframe: keyframe(0, 0), events: [] });
    link.deliver({ type: 'delta', delta: delta(0, 1, 10) });
    link.deliver({ type: 'keyframe', keyframe: keyframe(10, 100), events: [] });
    expect(core.buffer?.size).toBe(1);
    expect(core.buffer?.latestTick).toBe(10);
  });

  it('the first keyframe with no buffer yet does not crash', () => {
    const { link, core } = setup();
    link.deliver({ type: 'keyframe', keyframe: keyframe(0, 0), events: [] });
    expect(core.buffer?.size).toBe(1);
  });

  it('a delta gap clears the ring and requests one keyframe', () => {
    const { link, core } = setup();
    link.deliver({ type: 'keyframe', keyframe: keyframe(0, 0), events: [] });
    link.deliver({ type: 'delta', delta: delta(5, 6, 10) }); // baseTick 5 != mirror tick 0
    link.deliver({ type: 'delta', delta: delta(6, 7, 10) });
    expect(core.buffer?.size).toBe(0);
    const controls = link.sent.filter((m) => m.type === 'control');
    expect(controls).toHaveLength(1);
    link.deliver({ type: 'keyframe', keyframe: keyframe(8, 80), events: [] });
    expect(core.buffer?.size).toBe(1);
  });
});

describe('client core: events, diagnostics, and state', () => {
  it('dispatches keyframe and delta events with their tick, exact type before wildcard', () => {
    const { link, core } = setup();
    const seen: string[] = [];
    core.onEvent('hit', (e, tick) => seen.push(`hit@${tick}:${JSON.stringify(e.payload)}`));
    core.onEvent('*', (e, tick) => seen.push(`*@${tick}:${e.type}`));
    link.deliver({
      type: 'keyframe',
      keyframe: keyframe(0, 0),
      events: [{ type: 'hit', payload: { by: 1 } }],
    });
    link.deliver({
      type: 'delta',
      delta: delta(0, 1, 10, [
        { type: 'hit', payload: { by: 2 } },
        { type: 'pickup', payload: null },
      ]),
    });
    expect(seen).toEqual(['hit@0:{"by":1}', '*@0:hit', 'hit@1:{"by":2}', '*@1:hit', '*@1:pickup']);
  });

  it('unsubscribe stops delivery; diag callbacks receive diagnostics', () => {
    const { link, core } = setup();
    let hits = 0;
    const off = core.onEvent('hit', () => {
      hits++;
    });
    const diags: string[] = [];
    core.onDiag((d) => diags.push(d.code));
    link.deliver({
      type: 'keyframe',
      keyframe: keyframe(0, 0),
      events: [{ type: 'hit', payload: null }],
    });
    off();
    link.deliver({ type: 'delta', delta: delta(0, 1, 1, [{ type: 'hit', payload: null }]) });
    link.deliver({ type: 'diag', code: 'command-rejected', detail: 'nope' });
    expect(hits).toBe(1);
    expect(diags).toEqual(['command-rejected']);
  });

  it('get() returns a detached copy; entities() tracks spawn and destroy; tick advances', () => {
    const { link, core } = setup();
    link.deliver({ type: 'keyframe', keyframe: keyframe(0, 5), events: [] });
    const t = core.get('a', 'transform') as { pos: number[] };
    expect(t.pos[0]).toBe(5);
    t.pos[0] = 99;
    expect((core.get('a', 'transform') as { pos: number[] }).pos[0]).toBe(5);
    expect(core.get('a', 'nope')).toBeUndefined();
    link.deliver({
      type: 'delta',
      delta: {
        ...delta(0, 1, 5),
        spawned: { b: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } } },
        destroyed: ['a'],
        changed: {},
      },
    });
    expect(core.entities()).toEqual(['b']);
    expect(core.tick).toBe(1);
  });

  it('command() fills the local envelope with an incrementing seq', () => {
    const { link, core } = setup();
    core.command('move', { dir: [1, 0] });
    core.command('move');
    const cmds = link.sent.filter((m) => m.type === 'command');
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toMatchObject({
      type: 'command',
      command: { seq: 0, source: 'local', tick: 0, type: 'move', payload: { dir: [1, 0] } },
    });
    expect(cmds[1]).toMatchObject({ command: { seq: 1, payload: {} } });
  });

  it('sampleTransforms feeds interpolated poses to the consumer', () => {
    const { link, core, clock } = setup();
    link.deliver({ type: 'keyframe', keyframe: keyframe(0, 0), events: [] });
    clock.t = 100;
    link.deliver({ type: 'delta', delta: delta(0, 1, 10) });
    clock.t = 200;
    link.deliver({ type: 'delta', delta: delta(1, 2, 20) });
    const out = new Map<EntityId, InterpTransform>();
    core.sampleTransforms(200, (id, t) => out.set(id, t));
    expect(out.get('a')).toBeDefined();
    expect(out.get('a')?.pos[0]).toBeGreaterThan(0);
  });
});

describe('client core: scheduler control', () => {
  it('sends each control action on the link, distinct from commands', () => {
    const { link, core } = setup();
    core.control({ action: 'resume' });
    core.control({ action: 'pause' });
    core.control({ action: 'step', ticks: 12 });
    core.control({ action: 'set-rate', hz: 15 });
    core.command('move', { dir: [1, 0] });
    expect(link.sent.filter((m) => m.type === 'control')).toEqual([
      { type: 'control', control: { action: 'resume' } },
      { type: 'control', control: { action: 'pause' } },
      { type: 'control', control: { action: 'step', ticks: 12 } },
      { type: 'control', control: { action: 'set-rate', hz: 15 } },
    ]);
    // Control messages must not consume command sequence numbers.
    expect(link.sent.filter((m) => m.type === 'command')).toMatchObject([{ command: { seq: 0 } }]);
  });
});

describe('client core: a failing link is visible to the page', () => {
  it('reports a throwing worker on onError and as a link-error diagnostic', () => {
    const { link, core } = setup();
    const errors: ClientError[] = [];
    const diags: DiagMessage[] = [];
    core.onError((e) => errors.push(e));
    core.onDiag((d) => diags.push(d));
    link.fail('error', { type: 'error', message: 'boom', filename: 'worker.js', lineno: 12 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.source).toBe('link');
    expect(errors[0]?.message).toContain('boom');
    expect(errors[0]?.message).toContain('worker.js:12');
    // A page that only wired diagnostics still learns the kernel is gone.
    expect(diags).toEqual([{ type: 'diag', code: 'link-error', detail: errors[0]?.message }]);
  });

  it('reports an undeserializable message (messageerror) the same way', () => {
    const { link, core } = setup();
    const errors: ClientError[] = [];
    core.onError((e) => errors.push(e));
    link.fail('messageerror');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ source: 'link' });
    expect(errors[0]?.message).toContain('deserialize');
  });

  it('delivers a diagnostic whose code the client does not know instead of dropping it', () => {
    const { link, core } = setup();
    const diags: DiagMessage[] = [];
    core.onDiag((d) => diags.push(d));
    // What a newer kernel posts when a script throws mid-tick.
    link.deliver({
      type: 'diag',
      code: 'tick-failed' as DiagMessage['code'],
      detail: 'script threw at tick 200',
    });
    expect(diags).toEqual([
      { type: 'diag', code: 'tick-failed', detail: 'script threw at tick 200' },
    ]);
  });

  it('dispose drops the error subscriptions with the message subscription', () => {
    const { link, core } = setup();
    expect([link.count('message'), link.count('error'), link.count('messageerror')]).toEqual([
      1, 1, 1,
    ]);
    let errors = 0;
    core.onError(() => {
      errors++;
    });
    core.dispose();
    expect([link.count('message'), link.count('error'), link.count('messageerror')]).toEqual([
      0, 0, 0,
    ]);
    link.fail('error');
    expect(errors).toBe(0);
  });
});
