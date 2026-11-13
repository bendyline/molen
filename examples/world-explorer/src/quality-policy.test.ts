import type { AdaptiveQualityChange, AdaptiveQualitySample } from '@bendyline/molen-client';
import { describe, expect, it } from 'vitest';
import { createExplorerQualityController, createStreamStrainMeter } from './quality-policy.js';

function run(
  controller: ReturnType<typeof createExplorerQualityController>,
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

const flight = { loading: true, cpuFrameMs: 5, gpuFrameMs: 6, memoryPressure: 0.5 };

describe('world explorer Auto detail', () => {
  it('starts Balanced and stops at High after sustained smooth flight', () => {
    const controller = createExplorerQualityController();
    expect(controller.getStats().level).toBe(3);
    expect(run(controller, 19000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 24000, 1000 / 60, flight)).toEqual([
      { previousLevel: 3, level: 4, reason: 'headroom' },
    ]);
    expect(run(controller, 60000, 1000 / 60, flight)).toEqual([]);
  });

  it('requires measured GPU margin during streaming, including sparse timing results', () => {
    const controller = createExplorerQualityController();
    expect(run(controller, 45000, 1000 / 60, { loading: true, cpuFrameMs: 4 })).toEqual([]);
    const changes: AdaptiveQualityChange[] = [];
    for (let frame = 0; frame < 2700; frame++) {
      const change = controller.sample(1000 / 60, {
        loading: true,
        cpuFrameMs: 4,
        ...(frame % 4 === 0 ? { gpuFrameMs: 16 } : {}),
      });
      if (change) changes.push(change);
    }
    expect(changes).toEqual([]);
    expect(run(controller, 22000, 1000 / 60, flight).map((change) => change.level)).toEqual([4]);
  });

  it('can probe without GPU timing once streaming settles', () => {
    const controller = createExplorerQualityController();
    expect(
      run(controller, 43000, 1000 / 60, { cpuFrameMs: 5 }).map((change) => change.level),
    ).toEqual([4]);
  });

  it('ignores brief stalls but backs off a higher tier that cannot sustain flight', () => {
    const controller = createExplorerQualityController();
    run(controller, 22000, 1000 / 60, flight);
    const slow = { ...flight, cpuFrameMs: 25, gpuFrameMs: 28 };
    expect(run(controller, 1000, 40, slow)).toEqual([]);
    expect(run(controller, 7000, 40, slow)).toEqual([
      { previousLevel: 4, level: 3, reason: 'frame-time' },
    ]);
    expect(controller.getStats().recoveryDelayMs).toBe(40000);
    expect(run(controller, 32000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 11000, 1000 / 60, flight)).toEqual([
      { previousLevel: 3, level: 4, reason: 'headroom' },
    ]);
  });

  it('holds upgrades near the memory budget and lowers detail when it is exceeded', () => {
    const controller = createExplorerQualityController();
    expect(run(controller, 45000, 1000 / 60, { ...flight, memoryPressure: 0.9 })).toEqual([]);
    expect(run(controller, 3000, 1000 / 60, { ...flight, memoryPressure: 1.1 })).toEqual([
      { previousLevel: 3, level: 2, reason: 'memory-pressure' },
    ]);
  });

  it('discards hidden time and stale measurements when returning from manual High', () => {
    const controller = createExplorerQualityController();
    run(controller, 18000, 1000 / 60, flight);
    controller.sample(120000, { active: false });
    expect(run(controller, 10000, 1000 / 60, flight)).toEqual([]);
    controller.setLevel(5);
    expect(controller.getStats().level).toBe(4);
    expect(run(controller, 1000, 40, { cpuFrameMs: 25 })).toEqual([]);
    expect(run(controller, 6000, 40, { cpuFrameMs: 25 })).toEqual([
      { previousLevel: 4, level: 3, reason: 'frame-time' },
    ]);
  });

  it('needs real frame margin before stepping up', () => {
    const controller = createExplorerQualityController();
    // 12 of 16.7 ms is over the 0.6 share: the next level would not fit.
    expect(run(controller, 60000, 1000 / 60, { ...flight, cpuFrameMs: 12 })).toEqual([]);
    expect(run(controller, 22000, 1000 / 60, flight).map((change) => change.level)).toEqual([4]);
  });

  it('holds a step up while streaming is strained and steps down when it stays strained', () => {
    const controller = createExplorerQualityController();
    expect(run(controller, 9000, 1000 / 60, { ...flight, strained: true })).toEqual([]);
    expect(run(controller, 3000, 1000 / 60, { ...flight, strained: true })).toEqual([
      { previousLevel: 3, level: 2, reason: 'streaming' },
    ]);
  });

  it('steps down on a second long stall within a minute, not the first', () => {
    const controller = createExplorerQualityController();
    run(controller, 5000, 1000 / 60, flight);
    expect(controller.sample(1300, flight)).toBeUndefined();
    run(controller, 5000, 1000 / 60, flight);
    expect(controller.sample(1300, flight)).toEqual({
      previousLevel: 3,
      level: 2,
      reason: 'frame-time',
    });
  });
});

describe('stream strain meter', () => {
  const base = { residentBytes: 100, displayedBytes: 50, maxResidentBytes: 1000 };

  it('reports tiles rebuilt after eviction as strain', () => {
    const strained = createStreamStrainMeter();
    expect(strained({ nowMs: 0, builtTiles: 0, rebuiltTiles: 0, ...base })).toBe(false);
    expect(strained({ nowMs: 4000, builtTiles: 40, rebuiltTiles: 4, ...base })).toBe(false);
    expect(strained({ nowMs: 6000, builtTiles: 60, rebuiltTiles: 20, ...base })).toBe(false);
    expect(strained({ nowMs: 8000, builtTiles: 80, rebuiltTiles: 45, ...base })).toBe(true);
    // Ten seconds later the burst has left the window.
    expect(strained({ nowMs: 19000, builtTiles: 90, rebuiltTiles: 46, ...base })).toBe(false);
  });

  it('reports a view that crowds a full cache, but not a full warm cache', () => {
    const strained = createStreamStrainMeter();
    const counts = { builtTiles: 0, rebuiltTiles: 0, maxResidentBytes: 1000 };
    expect(strained({ nowMs: 0, ...counts, residentBytes: 990, displayedBytes: 300 })).toBe(false);
    expect(strained({ nowMs: 250, ...counts, residentBytes: 990, displayedBytes: 700 })).toBe(true);
    expect(
      strained({
        nowMs: 500,
        ...counts,
        residentBytes: 990,
        displayedBytes: 700,
        maxResidentBytes: undefined,
      }),
    ).toBe(false);
  });
});
