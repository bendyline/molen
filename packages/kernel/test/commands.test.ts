import type { Command, EngineEvent, JsonValue } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../src/component';
import { type System, World } from '../src/world';

interface Counter extends Record<string, JsonValue | undefined> {
  n: number;
}
const Counter = defineComponent<Counter>('counter');

function cmd(over: Partial<Command>): Command {
  return {
    kind: 'command',
    seq: 0,
    source: 'local',
    tick: 0,
    type: 'noop',
    payload: null,
    ...over,
  };
}

function worldWithCounter(): World {
  const w = new World({ tickRate: 30 });
  w.spawnRaw({ counter: { n: 0 } }, 'c');
  w.registerCommand('inc', (world, command) => {
    const by = (command.payload as { by?: number } | null)?.by ?? 1;
    const cur = world.get('c', Counter)?.n ?? 0;
    world.set('c', Counter, { n: cur + by });
  });
  return w;
}

describe('command adjudication', () => {
  it('executes a command at its target tick', () => {
    const w = worldWithCounter();
    w.submitCommand(cmd({ type: 'inc', tick: 2, payload: { by: 5 } }));
    w.step(); // tick 0
    expect(w.get('c', Counter)?.n).toBe(0);
    w.step(); // tick 1
    expect(w.get('c', Counter)?.n).toBe(0);
    w.step(); // tick 2 executes
    expect(w.get('c', Counter)?.n).toBe(5);
  });

  it('executes same-tick commands sorted by (source, seq)', () => {
    const w = new World();
    const order: string[] = [];
    w.registerCommand('log', (_world, command) => {
      order.push(`${command.source}:${command.seq}`);
    });
    // Arrival order may differ by source, but each source's sequence must remain monotonic.
    w.submitCommand(cmd({ type: 'log', tick: 1, source: 'b', seq: 0 }));
    w.submitCommand(cmd({ type: 'log', tick: 1, source: 'a', seq: 1 }));
    w.submitCommand(cmd({ type: 'log', tick: 1, source: 'a', seq: 2 }));
    w.step(); // tick 0
    w.step(); // tick 1
    expect(order).toEqual(['a:1', 'a:2', 'b:0']);
  });

  it('rewrites late commands to the next tick (default policy)', () => {
    const w = worldWithCounter();
    w.stepN(5); // now at tick 5
    const r = w.submitCommand(cmd({ type: 'inc', tick: 2, payload: { by: 1 } }));
    expect(r.accepted).toBe(true);
    expect(r.tickExecuted).toBe(6); // currentTick(5) + 1
    w.step(); // tick 5 -> executes tick 6's commands? no: execute runs for current tick
    // After stepping tick 5, _tick is 6; the next step executes tick 6 commands.
    expect(w.get('c', Counter)?.n).toBe(0);
    w.step();
    expect(w.get('c', Counter)?.n).toBe(1);
  });

  it('rejects late commands under the reject policy', () => {
    const w = new World({ lateCommands: 'reject' });
    w.registerCommand('noop', () => {});
    w.stepN(3);
    const r = w.submitCommand(cmd({ type: 'noop', tick: 1 }));
    expect(r.accepted).toBe(false);
    expect(r.reason).toContain('policy: reject');
  });

  it('rejects invalid command envelopes and emits command-rejected', () => {
    const w = new World();
    const events: EngineEvent[] = [];
    w.on('command-rejected', (e) => events.push(e));
    // missing type field -> envelope invalid
    const bad = {
      kind: 'command',
      seq: 0,
      source: 'local',
      tick: 0,
      payload: null,
    } as unknown as Command;
    const r = w.submitCommand(bad);
    expect(r.accepted).toBe(false);
    expect(events).toHaveLength(1);
    expect((events[0]?.payload as { reason: string }).reason).toContain('failed validation');
  });

  it('rejects unknown command types', () => {
    const w = new World();
    const r = w.submitCommand(cmd({ type: 'totally-unknown', tick: 1 }));
    expect(r.accepted).toBe(false);
    expect(r.reason).toContain('unknown command type');
  });

  it('rejects duplicate and decreasing sequence numbers from the same source', () => {
    const w = worldWithCounter();
    expect(w.submitCommand(cmd({ type: 'inc', tick: 2, source: 'remote', seq: 4 })).accepted).toBe(
      true,
    );
    const duplicate = w.submitCommand(cmd({ type: 'inc', tick: 3, source: 'remote', seq: 4 }));
    const decreasing = w.submitCommand(cmd({ type: 'inc', tick: 3, source: 'remote', seq: 3 }));
    expect(duplicate).toMatchObject({ accepted: false });
    expect(duplicate.reason).toContain('non-monotonic');
    expect(decreasing.reason).toContain('non-monotonic');
  });

  it('runs payload validators after the envelope', () => {
    const w = new World();
    w.registerCommand('typed', () => {}, {
      validatePayload: (p) =>
        typeof (p as { x?: unknown })?.x === 'number'
          ? { ok: true }
          : { ok: false, message: 'payload.x must be a number' },
    });
    expect(w.submitCommand(cmd({ type: 'typed', tick: 1, payload: { x: 1 } })).accepted).toBe(true);
    const bad = w.submitCommand(cmd({ type: 'typed', tick: 1, seq: 1, payload: { x: 'no' } }));
    expect(bad.accepted).toBe(false);
    expect(bad.reason).toContain('payload.x');
  });

  it('command handlers can spawn (deferred-flushed before systems see them)', () => {
    const w = new World();
    const seen: number[] = [];
    w.registerCommand('spawn3', (world) => {
      for (let i = 0; i < 3; i++) world.spawnRaw({ counter: { n: i } });
    });
    const observe: System = (world) => seen.push(world.query(Counter).count());
    w.addSystem(observe, { phase: 'update', name: 'observe' });
    w.submitCommand(cmd({ type: 'spawn3', tick: 1 }));
    w.step(); // tick 0: no command, observe sees 0
    w.step(); // tick 1: spawn3 runs, then observe sees 3
    expect(seen).toEqual([0, 3]);
  });
});

describe('declared command types with many handlers', () => {
  it('runs every handler for a type in registration order, sharing one ctx', () => {
    const w = new World({ tickRate: 30 });
    const seen: string[] = [];
    w.declareCommand('ping');
    w.onCommand('ping', (_w, _c, ctx) => seen.push(`a@${ctx.tick}`));
    w.registerCommand('ping', (_w, _c, ctx) => seen.push(`b@${ctx.tick}`));
    w.onCommand('ping', (_w, _c, ctx) => seen.push(`c@${ctx.tick}`));
    w.submitCommand(cmd({ type: 'ping', tick: 1 }));
    w.stepN(2);
    expect(seen).toEqual(['a@1', 'b@1', 'c@1']);
    expect(w.commandTypes()).toEqual(['ping']);
  });

  it('unsubscribing a handler keeps the type declared (command still accepted)', () => {
    const w = new World({ tickRate: 30 });
    let runs = 0;
    const off = w.onCommand('ping', () => {
      runs++;
    });
    off();
    expect(w.hasCommand('ping')).toBe(true);
    expect(w.submitCommand(cmd({ type: 'ping', tick: 1 })).accepted).toBe(true);
    w.stepN(2);
    expect(runs).toBe(0);
  });

  it('a declared payload validator rejects bad payloads before any handler runs', () => {
    const w = new World({ tickRate: 30 });
    const rejected: EngineEvent[] = [];
    w.on('command-rejected', (e) => rejected.push(e));
    w.declareCommand('move', {
      validatePayload: (p) =>
        Array.isArray((p as { dir?: unknown } | null)?.dir)
          ? { ok: true }
          : { ok: false, message: 'move payload requires { dir: [x, z] }' },
    });
    expect(w.submitCommand(cmd({ type: 'move', tick: 1, payload: { dir: [1, 0] } })).accepted).toBe(
      true,
    );
    const bad = w.submitCommand(cmd({ type: 'move', tick: 1, seq: 1, payload: { dir: 'x' } }));
    expect(bad.accepted).toBe(false);
    expect(bad.reason).toMatch(/requires \{ dir/);
    expect(rejected).toHaveLength(1);
  });

  it('still rejects undeclared command types, listing the declared ones', () => {
    const w = new World({ tickRate: 30 });
    w.declareCommand('move');
    const r = w.submitCommand(cmd({ type: 'jump', tick: 1 }));
    expect(r.accepted).toBe(false);
    expect(r.reason).toMatch(/unknown command type "jump" \(declared: move\)/);
  });

  it('declaring twice with different validators throws; same validator is idempotent', () => {
    const w = new World();
    const v = (): { ok: true } => ({ ok: true });
    w.declareCommand('x', { validatePayload: v });
    expect(() => w.declareCommand('x', { validatePayload: v })).not.toThrow();
    expect(() => w.declareCommand('x', { validatePayload: () => ({ ok: true }) })).toThrow(
      /different payload validator/,
    );
  });
});
