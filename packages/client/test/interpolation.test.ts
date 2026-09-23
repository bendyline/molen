import type { EntityId } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { InterpolationBuffer, type InterpTransform } from '../src/interpolation';
import { lerp3, nlerp4 } from '../src/math';

function tf(x: number, extra?: Partial<InterpTransform>): InterpTransform {
  return { pos: [x, 0, 0], rot: [0, 0, 0, 1], ...extra };
}

function snap(entries: Array<[EntityId, InterpTransform]>): Map<EntityId, InterpTransform> {
  return new Map(entries);
}

describe('math', () => {
  it('lerp3 interpolates linearly', () => {
    expect(lerp3([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });
  it('nlerp4 returns a normalized quaternion', () => {
    const q = nlerp4([0, 0, 0, 1], [0, 1, 0, 0], 0.5);
    const len = Math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2);
    expect(len).toBeCloseTo(1, 6);
  });
});

describe('InterpolationBuffer', () => {
  it('interpolates between two bracketing ticks', () => {
    const b = new InterpolationBuffer(30);
    b.push(10, snap([['a', tf(0)]]), 0);
    b.push(11, snap([['a', tf(10)]]), 0);
    const s = b.sampleAt(10.5, 'a');
    expect(s?.pos[0]).toBeCloseTo(5);
  });

  it('clamps to latest and never extrapolates when ahead of the buffer', () => {
    const b = new InterpolationBuffer(30);
    b.push(10, snap([['a', tf(0)]]), 0);
    b.push(11, snap([['a', tf(10)]]), 0);
    // renderTick beyond the latest tick -> clamp to tick 11 value, not extrapolate past it
    const s = b.sampleAt(20, 'a');
    expect(s?.pos[0]).toBe(10);
  });

  it('snaps to first known transform for an entity that appears mid-window', () => {
    const b = new InterpolationBuffer(30);
    b.push(10, snap([['a', tf(0)]]), 0); // 'b' not present yet
    b.push(
      11,
      snap([
        ['a', tf(10)],
        ['b', tf(99)],
      ]),
      0,
    );
    const s = b.sampleAt(10.5, 'b');
    expect(s?.pos[0]).toBe(99); // snapped, not lerped from origin
  });

  it('holds last transform for a despawning entity', () => {
    const b = new InterpolationBuffer(30);
    b.push(10, snap([['a', tf(5)]]), 0);
    b.push(11, snap([])); // 'a' gone at 11
    const s = b.sampleAt(10.5, 'a');
    expect(s?.pos[0]).toBe(5);
  });

  it('teleport suppresses interpolation (snaps to target)', () => {
    const b = new InterpolationBuffer(30);
    b.push(10, snap([['a', tf(0)]]), 0);
    b.push(11, snap([['a', tf(100, { teleport: true })]]), 0);
    const s = b.sampleAt(10.5, 'a');
    expect(s?.pos[0]).toBe(100); // not 50
  });

  it('interpolates scale to and from the implicit unit scale', () => {
    const b = new InterpolationBuffer(30);
    b.push(10, snap([['a', tf(0, { scale: [2, 2, 2] })]]), 0);
    b.push(11, snap([['a', tf(0)]]), 0);
    expect(b.sampleAt(10.5, 'a')?.scale).toEqual([1.5, 1.5, 1.5]);
  });

  it('returns undefined on buffer underrun (no snapshots)', () => {
    const b = new InterpolationBuffer(30);
    expect(b.sampleAt(5, 'a')).toBeUndefined();
  });

  it('snaps to earliest when renderTick precedes the buffer', () => {
    const b = new InterpolationBuffer(30);
    b.push(10, snap([['a', tf(7)]]), 0);
    b.push(11, snap([['a', tf(8)]]), 0);
    expect(b.sampleAt(5, 'a')?.pos[0]).toBe(7);
  });

  it('keeps only the most recent snapshots (capacity)', () => {
    const b = new InterpolationBuffer(30, { capacity: 2 });
    b.push(1, snap([['a', tf(1)]]), 0);
    b.push(2, snap([['a', tf(2)]]), 0);
    b.push(3, snap([['a', tf(3)]]), 0);
    expect(b.latestTick).toBe(3);
    // tick 1 evicted; sampling at 1 clamps to earliest retained (tick 2)
    expect(b.sampleAt(1, 'a')?.pos[0]).toBe(2);
  });

  it('estimateRenderTick accounts for elapsed time and the delay', () => {
    const b = new InterpolationBuffer(30, { delayTicks: 1.5 }); // tickMs ~33.33
    b.push(100, snap([['a', tf(0)]]), 1000);
    // 33.33ms after receiving tick 100 -> est ~101, minus 1.5 delay -> ~99.5
    const rt = b.estimateRenderTick(1000 + 1000 / 30);
    expect(rt).toBeCloseTo(99.5, 1);
  });

  // Re-anchoring the render clock on each arrival makes a stall a *rewind*: the late delta's
  // recvMs becomes "now" for a tick that is already 12ms old, and every moving entity reverses.
  it('a late delta does not move the render tick backwards', () => {
    const tickMs = 40; // 25Hz
    const b = new InterpolationBuffer(1000 / tickMs, { delayTicks: 1.5, capacity: 16 });
    const start = 1000;
    for (let tick = 0; tick <= 9; tick++) {
      b.push(tick, snap([['a', tf(tick)]]), start + tick * tickMs);
    }
    // Render the frame that lands just as delta 10 was due, then let delta 10 arrive 12ms late.
    const now = start + 10 * tickMs + 12;
    const beforeLate = b.estimateRenderTick(now) as number;
    b.push(10, snap([['a', tf(10)]]), now);
    const afterLate = b.estimateRenderTick(now) as number;
    expect(afterLate).toBeGreaterThanOrEqual(beforeLate);
    // The old anchoring gave 10 - 1.5 = 8.5 here, 0.3 ticks behind the previous frame.
    expect(afterLate).toBeCloseTo(8.8, 2);
    expect(b.sampleAt(afterLate, 'a')?.pos[0]).toBeGreaterThanOrEqual(
      b.sampleAt(beforeLate, 'a')?.pos[0] as number,
    );
  });

  it('keeps the render tick monotonic across a jittering stream of deltas', () => {
    const tickMs = 40; // 25Hz sim
    const frameMs = 16; // ~60Hz render
    const b = new InterpolationBuffer(1000 / tickMs, { delayTicks: 1.5, capacity: 16 });
    const jitter = [0, 3, 11, 1, 0, 25, 2, 0, 7, 0, 14, 0];
    const start = 1000;
    const arrival = (tick: number): number => start + tick * tickMs + (jitter[tick] as number);
    const seen: number[] = [];
    let next = 0;
    // A render loop: deliver whatever has arrived by this frame's time, then sample it.
    for (let now = start; now <= start + jitter.length * tickMs; now += frameMs) {
      while (next < jitter.length && arrival(next) <= now) {
        b.push(next, snap([['a', tf(next)]]), arrival(next));
        next++;
      }
      const tick = b.estimateRenderTick(now);
      if (tick !== undefined) seen.push(tick);
    }
    expect(seen.length).toBeGreaterThan(10);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i] as number).toBeGreaterThanOrEqual(seen[i - 1] as number);
    }
  });

  it('re-anchors the clock after a resync clear instead of holding the old floor', () => {
    const b = new InterpolationBuffer(25, { delayTicks: 1.5 });
    b.push(100, snap([['a', tf(0)]]), 1000);
    expect(b.estimateRenderTick(1000)).toBeCloseTo(98.5, 6);
    b.clear();
    expect(b.estimateRenderTick(1000)).toBeUndefined();
    // A resync keyframe far behind the old stream must render near its own tick, not the old one.
    b.push(5, snap([['a', tf(0)]]), 2000);
    expect(b.estimateRenderTick(2000)).toBeCloseTo(3.5, 6);
  });
});
