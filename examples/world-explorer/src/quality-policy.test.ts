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
  it('keeps its starting guess through smooth flight: nothing raises it', () => {
    const controller = createExplorerQualityController();
    expect(controller.getStats().level).toBe(3);
    expect(run(controller, 180_000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 60_000, 1000 / 60, { cpuFrameMs: 4 })).toEqual([]);
    expect(createExplorerQualityController(1).getStats().level).toBe(1);
  });

  it('keeps it through frames a busy place costs, however long they last', () => {
    const controller = createExplorerQualityController();
    // A piloted takeoff from a large airport at Balanced measured 19-26 ms a frame with 15-18 ms
    // of work, which the old policy answered within ten seconds. So did 28 ms (36 a second).
    const takeoff = { loading: true, cpuFrameMs: 17, gpuFrameMs: 9, memoryPressure: 0.3 };
    expect(run(controller, 120_000, 22, takeoff)).toEqual([]);
    expect(run(controller, 120_000, 28, { ...takeoff, loading: false })).toEqual([]);
  });

  it('gives a level up once when the device cannot hold 30 frames a second, and stays down', () => {
    const controller = createExplorerQualityController();
    const slow = { cpuFrameMs: 40, gpuFrameMs: 30, memoryPressure: 0.3 };
    // Under the floor (20 a second), but not for long enough.
    expect(run(controller, 8000, 50, slow)).toEqual([]);
    expect(run(controller, 5000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 13_000, 50, slow)).toEqual([
      { previousLevel: 3, level: 2, reason: 'frame-time' },
    ]);
    // The lower level gets time to load before it is judged, then is judged the same way.
    expect(run(controller, 15_000, 50, slow)).toEqual([]);
    expect(run(controller, 20_000, 50, slow)).toEqual([
      { previousLevel: 2, level: 1, reason: 'frame-time' },
    ]);
    // Smooth again: the level it gave up is not tried again.
    expect(run(controller, 300_000, 1000 / 60, flight)).toEqual([]);
    expect(controller.getStats().level).toBe(1);
  });

  it('does not take slow frames while loading for the device, unless frame work is heavy', () => {
    const controller = createExplorerQualityController();
    expect(
      run(controller, 60_000, 50, { loading: true, cpuFrameMs: 12, memoryPressure: 0.3 }),
    ).toEqual([]);
  });

  it('lowers detail for good when the view outgrows the memory budget', () => {
    const controller = createExplorerQualityController();
    expect(run(controller, 45_000, 1000 / 60, { ...flight, memoryPressure: 0.9 })).toEqual([]);
    expect(run(controller, 3000, 1000 / 60, { ...flight, memoryPressure: 1.1 })).toEqual([
      { previousLevel: 3, level: 2, reason: 'memory-pressure' },
    ]);
    expect(run(controller, 180_000, 1000 / 60, flight)).toEqual([]);
  });

  it('lowers detail for good when streaming stays strained', () => {
    const controller = createExplorerQualityController();
    expect(run(controller, 9000, 1000 / 60, { ...flight, strained: true })).toEqual([]);
    expect(run(controller, 3000, 1000 / 60, { ...flight, strained: true })).toEqual([
      { previousLevel: 3, level: 2, reason: 'streaming' },
    ]);
    expect(run(controller, 180_000, 1000 / 60, flight)).toEqual([]);
  });

  it('ignores long stalls, however often they come', () => {
    const controller = createExplorerQualityController();
    for (let i = 0; i < 6; i++) {
      run(controller, 5000, 1000 / 60, flight);
      expect(controller.sample(1300, flight)).toBeUndefined();
    }
    expect(controller.getStats().level).toBe(3);
  });

  it('makes its guess afresh on restart, and discards hidden time', () => {
    const controller = createExplorerQualityController();
    const slow = { cpuFrameMs: 40, gpuFrameMs: 30, memoryPressure: 0.3 };
    expect(run(controller, 13_000, 50, slow).map((change) => change.level)).toEqual([2]);
    controller.restart();
    expect(controller.getStats().level).toBe(3);
    // Measured from the restart: what was slow before it does not count.
    expect(run(controller, 8000, 50, slow)).toEqual([]);
    controller.sample(120_000, { active: false });
    expect(run(controller, 8000, 50, slow)).toEqual([]);
    expect(run(controller, 5000, 50, slow).map((change) => change.level)).toEqual([2]);
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
