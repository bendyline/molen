import type {
  Command,
  KernelInbound,
  KernelOutbound,
  Keyframe,
  MessageLink,
} from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../src/component';
import { KernelHost } from '../src/host';
import { Scheduler, type SchedulerClock } from '../src/scheduler';
import { applyKeyframeTo, takeKeyframe } from '../src/snapshot';
import { World } from '../src/world';

const Counter = defineComponent<{ n: number }>('counter');

/** A bidirectional mock link: the host's outbound messages collect in `sent`; tests inject
 *  inbound messages via `send`. */
class MockLink implements MessageLink {
  sent: KernelOutbound[] = [];
  private listener: ((ev: { data: unknown }) => void) | null = null;
  postMessage(message: unknown): void {
    this.sent.push(message as KernelOutbound);
  }
  addEventListener(_type: 'message', listener: (ev: { data: unknown }) => void): void {
    this.listener = listener;
  }
  removeEventListener(_type: 'message', listener: (ev: { data: unknown }) => void): void {
    if (this.listener === listener) this.listener = null;
  }
  send(msg: KernelInbound): void {
    this.listener?.({ data: msg });
  }
  sendUnknown(msg: unknown): void {
    this.listener?.({ data: msg });
  }
  ofType<T extends KernelOutbound['type']>(type: T): Extract<KernelOutbound, { type: T }>[] {
    return this.sent.filter((m) => m.type === type) as Extract<KernelOutbound, { type: T }>[];
  }
}

function counterWorld(): World {
  const w = new World({ tickRate: 30 });
  w.spawnRaw({ counter: { n: 0 } }, 'c');
  w.addSystem(
    (world) => {
      const cur = world.get('c', Counter)?.n ?? 0;
      world.set('c', Counter, { n: cur + 1 });
    },
    { name: 'inc' },
  );
  w.registerCommand('add', (world, cmd) => {
    const by = (cmd.payload as { by: number }).by;
    const cur = world.get('c', Counter)?.n ?? 0;
    world.set('c', Counter, { n: cur + by });
  });
  return w;
}

/** A world whose system throws once, at `failAtTick`, then behaves for the rest of the run. */
function explodingWorld(failAtTick: number): World {
  const w = counterWorld();
  let armed = true;
  w.addSystem(
    (world) => {
      if (!armed || world.tick !== failAtTick) return;
      armed = false;
      throw new Error('boom');
    },
    { name: 'explode' },
  );
  return w;
}

/** A manual clock: tests advance time and flush due timers explicitly. */
class ManualClock implements SchedulerClock {
  t = 0;
  private timers: { at: number; cb: () => void; id: number }[] = [];
  private nextId = 1;
  now(): number {
    return this.t;
  }
  setTimer(cb: () => void, ms: number): number {
    const id = this.nextId++;
    this.timers.push({ at: this.t + ms, cb, id });
    return id as unknown as number;
  }
  clearTimer(h: number): void {
    this.timers = this.timers.filter((x) => x.id !== (h as unknown as number));
  }
  /** Advance time, firing each intermediate timer at its scheduled instant (steady realtime). */
  advance(ms: number): void {
    const target = this.t + ms;
    for (let guard = 0; guard < 100000; guard++) {
      const due = this.timers.filter((x) => x.at <= target).sort((a, b) => a.at - b.at)[0];
      if (due === undefined) break;
      this.timers = this.timers.filter((x) => x.id !== due.id);
      this.t = due.at;
      due.cb();
    }
    this.t = target;
  }
  /** Jump the clock forward and fire exactly one (earliest) timer — simulates a stalled tab. */
  jumpAndFireOnce(ms: number): void {
    this.t += ms;
    const due = this.timers.sort((a, b) => a.at - b.at)[0];
    if (due === undefined) return;
    this.timers = this.timers.filter((x) => x.id !== due.id);
    due.cb();
  }
}

describe('KernelHost protocol', () => {
  it('posts an initial keyframe and ready even when the scheduler starts paused', () => {
    const link = new MockLink();
    new KernelHost(counterWorld(), link, { startPaused: true });
    expect(link.ofType('keyframe')).toHaveLength(1);
    expect(link.ofType('ready')).toHaveLength(1);
    expect(link.ofType('ready')[0]?.tickRate).toBe(30);
  });

  it('streams one delta per manual tick', () => {
    const link = new MockLink();
    const host = new KernelHost(counterWorld(), link, {
      startPaused: true,
      keyframeInterval: 1000,
    });
    host.step(3);
    const deltas = link.ofType('delta');
    expect(deltas).toHaveLength(3);
    expect(deltas[0]?.delta.tick).toBe(1);
    expect(deltas[2]?.delta.tick).toBe(3);
    // delta carries the counter change
    expect(deltas[2]?.delta.changed.c?.counter).toEqual({ n: 3 });
  });

  it('emits a keyframe (not a delta) on keyframe-interval ticks', () => {
    const link = new MockLink();
    const host = new KernelHost(counterWorld(), link, { startPaused: true, keyframeInterval: 5 });
    link.sent = []; // ignore the initial keyframe/ready
    host.step(5);
    expect(link.ofType('delta')).toHaveLength(4); // ticks 1..4
    expect(link.ofType('keyframe')).toHaveLength(1); // tick 5
  });

  it('accepts inbound commands and applies them', () => {
    const link = new MockLink();
    const host = new KernelHost(counterWorld(), link, {
      startPaused: true,
      keyframeInterval: 1000,
    });
    const command: Command = {
      kind: 'command',
      seq: 0,
      source: 'remote',
      tick: 2,
      type: 'add',
      payload: { by: 100 },
    };
    link.send({ type: 'command', command });
    host.step(3);
    const deltas = link.ofType('delta');
    // command executes at tick 2: base 1 + add 100 at tick2 then +1 = ... check final
    const last = deltas[deltas.length - 1];
    expect(last?.delta.changed.c?.counter).toEqual({ n: 103 });
  });

  it('reports rejected commands as a diag', () => {
    const link = new MockLink();
    new KernelHost(counterWorld(), link, { startPaused: true });
    link.send({
      type: 'command',
      command: { kind: 'command', seq: 0, source: 'x', tick: 1, type: 'unknown', payload: null },
    });
    expect(link.ofType('diag').some((d) => d.code === 'command-rejected')).toBe(true);
  });

  it('responds to request-keyframe control', () => {
    const link = new MockLink();
    new KernelHost(counterWorld(), link, {
      startPaused: true,
      keyframeInterval: 1000,
    });
    link.sent = [];
    link.send({ type: 'control', control: { action: 'request-keyframe' } });
    expect(link.ofType('keyframe')).toHaveLength(1);
  });

  it('rejects malformed and unbounded control messages without executing them', () => {
    const world = counterWorld();
    const link = new MockLink();
    new KernelHost(world, link, { startPaused: true });
    link.sendUnknown({
      type: 'control',
      control: { action: 'step', ticks: Number.POSITIVE_INFINITY },
    });
    link.sendUnknown({ type: 'control', control: { action: 'step', ticks: 100_001 } });
    expect(world.tick).toBe(0);
    expect(link.ofType('diag').map((d) => d.code)).toEqual(['protocol-error', 'control-rejected']);
  });

  it('posts a tick-failed diag and refuses to resume a faulted world', () => {
    const clock = new ManualClock();
    const world = explodingWorld(2);
    const link = new MockLink();
    const host = new KernelHost(world, link, { clock, keyframeInterval: 1000 });
    const origin = link.ofType('keyframe')[0]?.keyframe;
    clock.advance(1000);

    const failed = link.ofType('diag').filter((d) => d.code === 'tick-failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.detail).toMatch(/^tick 2: .*boom/);
    expect(world.tick).toBe(2);
    // Ticks 0 and 1 completed and streamed; the failing tick produced no delta at all.
    expect(link.ofType('delta').map((d) => d.delta.tick)).toEqual([1, 2]);

    link.sent = [];
    link.send({ type: 'control', control: { action: 'resume' } });
    expect(link.ofType('diag').map((d) => d.code)).toEqual(['control-rejected']);
    clock.advance(1000);
    expect(world.tick).toBe(2);

    applyKeyframeTo(world, origin as Keyframe);
    host.start();
    clock.advance(1000);
    expect(world.tick).toBeGreaterThan(2);
  });

  it('reports a control-driven step that throws as tick-failed, not as a rejected control', () => {
    const world = explodingWorld(0);
    const link = new MockLink();
    new KernelHost(world, link, { startPaused: true });
    link.sent = [];
    link.send({ type: 'control', control: { action: 'step', ticks: 1 } });
    const diags = link.ofType('diag');
    expect(diags.map((d) => d.code)).toEqual(['tick-failed']);
    expect(diags[0]?.detail).toMatch(/^tick 0: .*boom/);
  });

  it('removes its inbound listener on dispose', () => {
    const world = counterWorld();
    const link = new MockLink();
    const host = new KernelHost(world, link, { startPaused: true });
    host.dispose();
    link.send({ type: 'control', control: { action: 'step', ticks: 1 } });
    expect(world.tick).toBe(0);
  });
});

describe('Scheduler (injected clock)', () => {
  it('advances ticks at the world tick rate in realtime', () => {
    const clock = new ManualClock();
    const world = counterWorld();
    const ticks: number[] = [];
    const sched = new Scheduler(world, { clock, onTick: (t) => ticks.push(t) });
    sched.start();
    clock.advance(1000); // 1 second @ 30 Hz => ~30 ticks
    expect(world.tick).toBeGreaterThanOrEqual(29);
    expect(world.tick).toBeLessThanOrEqual(31);
  });

  it('caps catch-up to avoid spiral of death', () => {
    const clock = new ManualClock();
    const world = counterWorld();
    let overran = 0;
    const sched = new Scheduler(world, {
      clock,
      maxCatchUpTicks: 5,
      onOverrun: () => overran++,
    });
    sched.start();
    // One wake observes 10s of elapsed time (a stalled/backgrounded tab).
    clock.jumpAndFireOnce(10000);
    // catches up at most maxCatchUpTicks(5) then drops the rest
    expect(world.tick).toBeLessThanOrEqual(5);
    expect(overran).toBeGreaterThan(0);
  });

  it('pause stops advancing', () => {
    const clock = new ManualClock();
    const world = counterWorld();
    const sched = new Scheduler(world, { clock });
    sched.start();
    clock.advance(100);
    const afterFirst = world.tick;
    sched.pause();
    clock.advance(1000);
    expect(world.tick).toBe(afterFirst);
  });

  it('pauses and reports a throwing tick instead of dying inside the timer', () => {
    const clock = new ManualClock();
    const world = explodingWorld(2);
    const failures: [string, number][] = [];
    const sched = new Scheduler(world, {
      clock,
      onError: (error, tick) => failures.push([error.message, tick]),
    });
    sched.start();
    clock.advance(1000); // would be ~30 ticks; tick 2 throws

    expect(failures).toHaveLength(1);
    expect(failures[0]?.[0]).toMatch(/tick 2 failed: boom/);
    expect(failures[0]?.[1]).toBe(2);
    expect(sched.state).toBe('paused');
    expect(world.tick).toBe(2);
    expect(world.faulted?.message).toMatch(/boom/);

    // No timer was rescheduled, so time passing changes nothing...
    clock.advance(5000);
    expect(world.tick).toBe(2);
    // ...and resuming is refused until the world is recovered.
    expect(() => sched.start()).toThrow(/cannot resume a faulted world/);
    expect(sched.state).toBe('paused');
    expect(failures).toHaveLength(1);
  });

  it('resumes only after an explicit recovery (keyframe restore clears the fault)', () => {
    const clock = new ManualClock();
    const world = explodingWorld(2);
    const origin = takeKeyframe(world);
    const sched = new Scheduler(world, { clock });
    sched.start();
    clock.advance(1000);
    expect(world.tick).toBe(2);

    applyKeyframeTo(world, origin); // the documented recovery: restore a known-good state
    expect(world.faulted).toBeUndefined();
    sched.start();
    clock.advance(1000);
    expect(world.tick).toBeGreaterThan(2); // the throwing system disarmed itself
  });

  it('reports a failing manual step through onError and rethrows to the caller', () => {
    const world = explodingWorld(0);
    const failures: Error[] = [];
    const sched = new Scheduler(world, { onError: (error) => failures.push(error) });
    sched.start();
    expect(() => sched.step(3)).toThrow(/tick 0 failed: boom/);
    expect(failures).toHaveLength(1);
    expect(sched.state).toBe('paused');
  });

  it('rejects invalid rates, catch-up caps, and manual step counts', () => {
    const world = counterWorld();
    expect(() => new Scheduler(world, { rate: Number.NaN })).toThrow(/rate/);
    expect(() => new Scheduler(world, { maxCatchUpTicks: 0 })).toThrow(/maxCatchUpTicks/);
    const sched = new Scheduler(world);
    expect(() => sched.setRate(Number.POSITIVE_INFINITY)).toThrow(/rate/);
    expect(() => sched.step(Number.POSITIVE_INFINITY)).toThrow(/step count/);
  });
});
