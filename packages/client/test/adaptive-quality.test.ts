import { describe, expect, it } from 'vitest';
import {
  type AdaptiveQualityChange,
  AdaptiveQualityController,
  type AdaptiveQualitySample,
} from '../src/adaptive-quality';

function run(
  controller: AdaptiveQualityController,
  durationMs: number,
  frameMs = 1000 / 60,
  sample: AdaptiveQualitySample = {},
): AdaptiveQualityChange[] {
  const changes: AdaptiveQualityChange[] = [];
  for (let elapsed = 0; elapsed < durationMs; elapsed += frameMs) {
    const change = controller.sample(frameMs, sample);
    if (change) changes.push(change);
  }
  return changes;
}

describe('AdaptiveQualityController', () => {
  it('reduces detail after sustained slow frames and respects its lower bound', () => {
    const controller = new AdaptiveQualityController({ minLevel: 1, maxLevel: 5, initialLevel: 5 });
    expect(run(controller, 1000, 40)).toEqual([]);
    const changes = run(controller, 20000, 40);
    expect(changes.map((change) => change.level)).toEqual([4, 3, 2, 1]);
    expect(changes.every((change) => change.reason === 'frame-time')).toBe(true);
    expect(controller.getStats().smoothedFrameMs).toBeCloseTo(40);
  });

  it('remains stable around the target and ignores isolated streaming hitches', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 5 });
    const changes: AdaptiveQualityChange[] = [];
    for (let frame = 0; frame < 1800; frame++) {
      const change = controller.sample(frame % 100 === 0 ? 200 : 1000 / 60);
      if (change) changes.push(change);
    }
    expect(changes).toEqual([]);
    expect(controller.getStats().smoothedFrameMs).toBeLessThan(18);
  });

  it('reacts to frequent hitches and genuine sustained very slow rendering', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 3 });
    for (let frame = 0; frame < 200; frame++) {
      controller.sample(frame % 3 === 0 ? 90 : 1000 / 60);
    }
    expect(controller.getStats().level).toBe(0);
    controller.setLevel(3);
    run(controller, 15000, 200);
    expect(controller.getStats().level).toBe(0);
  });

  it('excludes suspension and isolated tab-resume pauses from quality decisions', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 3 });
    run(controller, 800, 40);
    controller.sample(10000, { active: false });
    controller.sample(20000);
    expect(controller.getStats().smoothedFrameMs).toBeUndefined();
    expect(run(controller, 2000)).toEqual([]);
    expect(controller.getStats().level).toBe(3);
  });

  it('does not ignore consecutive extreme frame times forever', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 2 });
    run(controller, 50000, 2000);
    expect(controller.getStats().level).toBe(0);
  });

  it('probes higher detail slowly at display-limited cadence and respects its ceiling', () => {
    const controller = new AdaptiveQualityController({ minLevel: 0, maxLevel: 2, initialLevel: 0 });
    expect(run(controller, 7000)).toEqual([]);
    const changes = run(controller, 25000);
    expect(changes.map((change) => change.level)).toEqual([1, 2]);
    expect(changes.every((change) => change.reason === 'headroom')).toBe(true);
  });

  it('holds promotions during loading, but can still reduce an overloaded scene', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 2 });
    expect(run(controller, 20000, 1000 / 60, { loading: true })).toEqual([]);
    const changes = run(controller, 9000, 50, { loading: true });
    expect(changes.map((change) => change.level)).toEqual([1, 0]);
  });

  it('requires spare measured CPU/GPU time before increasing detail', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 1, maxLevel: 2 });
    expect(run(controller, 15000, 1000 / 60, { cpuFrameMs: 16 })).toEqual([]);
    expect(run(controller, 15000, 1000 / 60, { cpuFrameMs: 4, gpuFrameMs: 16 })).toEqual([]);
    expect(run(controller, 15000, 1000 / 60, { cpuFrameMs: 4, gpuFrameMs: 6 })).toEqual([
      { previousLevel: 1, level: 2, reason: 'headroom' },
    ]);
  });

  it('does not dilute sparse asynchronous GPU timings with CPU-only frames', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 1, maxLevel: 2 });
    const changes: AdaptiveQualityChange[] = [];
    for (let frame = 0; frame < 1200; frame++) {
      const change = controller.sample(1000 / 60, {
        cpuFrameMs: 3,
        gpuFrameMs: frame % 4 === 0 ? 16 : undefined,
      });
      if (change) changes.push(change);
    }
    expect(changes).toEqual([]);
    expect(controller.getStats().level).toBe(1);
  });
  it('lowers quality for memory pressure independently of frame rate and blocks early recovery', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 3, cooldownMs: 10000 });
    const changes = run(controller, 4500, 1000 / 60, { memoryPressure: 1.2 });
    expect(changes.map((change) => change.level)).toEqual([2, 1, 0]);
    expect(changes.every((change) => change.reason === 'memory-pressure')).toBe(true);
    expect(run(controller, 20000, 1000 / 60, { memoryPressure: 0.9 })).toEqual([]);
    expect(run(controller, 12000, 1000 / 60, { memoryPressure: 0.5 })).toHaveLength(1);
  });

  it('backs off failed upgrades instead of repeatedly bouncing between neighboring levels', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 1, maxLevel: 2 });
    run(controller, 11000);
    expect(controller.getStats().level).toBe(2);
    run(controller, 2200, 40);
    expect(controller.getStats().level).toBe(1);
    expect(controller.getStats().recoveryDelayMs).toBe(20000);
    expect(run(controller, 14000)).toEqual([]);
    expect(run(controller, 9000)).toEqual([{ previousLevel: 1, level: 2, reason: 'headroom' }]);
  });

  it('clears stale samples when switching modes and clamps newly changed bounds', () => {
    const controller = new AdaptiveQualityController({ initialLevel: 3 });
    run(controller, 1000, 100);
    controller.setLevel(3);
    expect(run(controller, 2000)).toEqual([]);
    expect(controller.setBounds(0, 1)).toEqual({ previousLevel: 3, level: 1, reason: 'manual' });
    expect(controller.setLevel(99)).toBeUndefined();
    expect(controller.setBounds(2, 4)).toEqual({ previousLevel: 1, level: 2, reason: 'manual' });
    expect(controller.getStats().smoothedFrameMs).toBeUndefined();
  });

  it('supports other target frame rates without changing the simulation rate', () => {
    const controller = new AdaptiveQualityController({ targetFrameMs: 1000 / 30, initialLevel: 5 });
    expect(run(controller, 10000, 1000 / 30)).toEqual([]);
    expect(run(controller, 3000, 60).some((change) => change.reason === 'frame-time')).toBe(true);
  });

  it('rejects invalid settings and safely ignores invalid measurements', () => {
    expect(() => new AdaptiveQualityController({ minLevel: 2, maxLevel: 1 })).toThrow(RangeError);
    expect(() => new AdaptiveQualityController({ maxLevel: 1.5 })).toThrow(RangeError);
    expect(() => new AdaptiveQualityController({ targetFrameMs: 0 })).toThrow(RangeError);
    const controller = new AdaptiveQualityController();
    for (const frameMs of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(controller.sample(frameMs)).toBeUndefined();
    }
    expect(controller.getStats().samples).toBe(0);
    expect(() => controller.setLevel(Number.NaN)).toThrow(RangeError);
    expect(() => controller.setBounds(4, 2)).toThrow(RangeError);
  });
});
