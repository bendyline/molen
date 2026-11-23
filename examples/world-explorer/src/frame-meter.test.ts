import { describe, expect, it } from 'vitest';
import { FrameMeter, frameRateHealth } from './frame-meter.js';

describe('frame meter', () => {
  it('reports nothing before the first frame and ignores intervals that are not frames', () => {
    const meter = new FrameMeter();
    expect(meter.stats()).toEqual({
      fps: 0,
      lowFps: 0,
      meanMs: 0,
      maxMs: 0,
      longFrames: 0,
      frames: 0,
    });
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) meter.add(bad);
    expect(meter.stats().frames).toBe(0);
    expect(() => new FrameMeter(0)).toThrow(RangeError);
  });

  it('measures the rate over the last second and the slowest frames over all it remembers', () => {
    const meter = new FrameMeter();
    // Five seconds at 60 a second, with one 120 ms hitch three seconds ago.
    for (let i = 0; i < 300; i++) meter.add(i === 120 ? 120 : 1000 / 60);
    const stats = meter.stats();
    expect(stats.fps).toBeCloseTo(60, 1);
    expect(stats.meanMs).toBeCloseTo(1000 / 60, 3);
    expect(stats.maxMs).toBeCloseTo(1000 / 60, 3);
    expect(stats.frames).toBe(300);
    expect(stats.longFrames).toBe(1);
    // One hitch in three hundred frames is under a hundredth of them, and the low rate holds.
    expect(stats.lowFps).toBeCloseTo(60, 1);
    // Four are over a hundredth: the low rate is theirs, though the last second's mean is not.
    for (let i = 0; i < 3; i++) meter.add(120);
    expect(meter.stats().lowFps).toBeCloseTo(1000 / 120, 3);
    expect(meter.stats().longFrames).toBe(4);
    expect(meter.recent(0)).toBe(120);
    expect(meter.recent(3)).toBeCloseTo(1000 / 60, 3);
    expect(meter.recent(303)).toBeUndefined();
  });

  it('keeps only its newest frames and forgets them all on reset', () => {
    const meter = new FrameMeter(4);
    for (const ms of [100, 100, 10, 10, 10, 10]) meter.add(ms);
    const stats = meter.stats();
    expect(stats.frames).toBe(4);
    expect(stats.fps).toBeCloseTo(100, 5);
    expect(stats.lowFps).toBeCloseTo(100, 5);
    expect(stats.longFrames).toBe(0);
    meter.reset();
    expect(meter.stats().frames).toBe(0);
    expect(meter.recent(0)).toBeUndefined();
  });

  it('grades a rate as a viewer would', () => {
    expect(frameRateHealth(60)).toBe('good');
    expect(frameRateHealth(50)).toBe('good');
    expect(frameRateHealth(49.9)).toBe('fair');
    expect(frameRateHealth(30)).toBe('fair');
    expect(frameRateHealth(17)).toBe('poor');
  });
});
