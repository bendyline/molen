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
  it('keeps its starting guess through smooth flight: nothing raises it past the guess', () => {
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

  const slow = { cpuFrameMs: 40, gpuFrameMs: 30, memoryPressure: 0.3 };

  it('gives a level up when the device cannot hold 30 frames a second, and stays down while it cannot', () => {
    const controller = createExplorerQualityController();
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
    // Still under the floor: each level is judged in turn, and none comes back.
    expect(run(controller, 300_000, 50, slow)).toEqual([
      { previousLevel: 1, level: 0, reason: 'frame-time' },
    ]);
    expect(controller.getStats()).toMatchObject({ level: 0, reason: 'frame-time' });
  });

  it('brings a lowered level back one step at a time once the view has been calm for a minute', () => {
    const controller = createExplorerQualityController();
    run(controller, 13_000, 50, slow);
    run(controller, 35_000, 50, slow);
    expect(controller.getStats().level).toBe(1);
    // A 10-minute circle over Seattle lost a level over downtown and kept it at 50 frames a
    // second for the rest of the flight; a longer session ran down to Minimum the same way.
    // Smoothed measures take a few seconds to come down from the slow frames.
    expect(run(controller, 55_000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 10_000, 1000 / 60, flight)).toEqual([
      { previousLevel: 1, level: 2, reason: 'headroom' },
    ]);
    expect(controller.getStats()).toMatchObject({ level: 2, reason: 'frame-time' });
    // The next minute counts from the step.
    expect(run(controller, 50_000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 15_000, 1000 / 60, flight)).toEqual([
      { previousLevel: 2, level: 3, reason: 'headroom' },
    ]);
    expect(controller.getStats()).toMatchObject({ level: 3, reason: undefined });
    // Never past the guess.
    expect(run(controller, 300_000, 1000 / 60, flight)).toEqual([]);
  });

  it('counts frames merely above the floor as no calm, nor a hitch as the end of it', () => {
    const controller = createExplorerQualityController();
    run(controller, 13_000, 50, slow);
    // 30 a second with 20 ms of work: holds the level, but a step up would not hold.
    expect(run(controller, 300_000, 33, { cpuFrameMs: 20, memoryPressure: 0.3 })).toEqual([]);
    // Nor 60 a second with more than 20 ms of work (a GPU or a main thread queueing frames).
    expect(run(controller, 120_000, 1000 / 60, { ...flight, cpuFrameMs: 24 })).toEqual([]);
    // A streaming hitch in a minute of calm costs a fraction of a second of it, not the minute.
    expect(run(controller, 40_000, 1000 / 60, flight)).toEqual([]);
    expect(controller.sample(120, flight)).toBeUndefined();
    expect(run(controller, 19_000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 6000, 1000 / 60, flight).map((change) => change.level)).toEqual([3]);
  });

  it('takes a stall in a minute of calm as a few seconds lost, not the minute', () => {
    const controller = createExplorerQualityController();
    run(controller, 13_000, 50, slow);
    // A held view over Bellevue stalled for a second or more about once a minute; restarting the
    // minute at each one meant a level never came back.
    for (let i = 0; i < 2; i++) {
      expect(run(controller, 30_000, 1000 / 60, flight)).toEqual([]);
      expect(controller.sample(1400, flight)).toBeUndefined();
    }
    expect(run(controller, 10_000, 1000 / 60, flight).map((change) => change.level)).toEqual([3]);
  });

  it('waits twice as long to bring back a level that did not hold', () => {
    const controller = createExplorerQualityController();
    run(controller, 13_000, 50, slow);
    expect(run(controller, 65_000, 1000 / 60, flight).map((change) => change.level)).toEqual([3]);
    // Lost again within a few minutes of coming back.
    expect(run(controller, 30_000, 50, slow).map((change) => change.level)).toEqual([2]);
    expect(run(controller, 110_000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 20_000, 1000 / 60, flight).map((change) => change.level)).toEqual([3]);
    // Held long enough this time: a later loss is a new busy moment, and the wait stays as it was.
    expect(run(controller, 200_000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 20_000, 50, slow).map((change) => change.level)).toEqual([2]);
    expect(run(controller, 110_000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 20_000, 1000 / 60, flight).map((change) => change.level)).toEqual([3]);
    expect(controller.getStats().recoveryDelayMs).toBe(120_000);
  });

  it('brings a level back no further than its guess', () => {
    const controller = createExplorerQualityController(2);
    run(controller, 13_000, 50, slow);
    expect(controller.getStats().level).toBe(1);
    expect(run(controller, 300_000, 1000 / 60, flight).map((change) => change.level)).toEqual([2]);
  });

  it('does not take slow frames while loading for the device, unless frame work is heavy', () => {
    const controller = createExplorerQualityController();
    expect(
      run(controller, 60_000, 50, { loading: true, cpuFrameMs: 12, memoryPressure: 0.3 }),
    ).toEqual([]);
  });

  it('lowers detail when the view outgrows the memory budget, until it has room again', () => {
    const controller = createExplorerQualityController();
    expect(run(controller, 45_000, 1000 / 60, { ...flight, memoryPressure: 0.9 })).toEqual([]);
    expect(run(controller, 3000, 1000 / 60, { ...flight, memoryPressure: 1.1 })).toEqual([
      { previousLevel: 3, level: 2, reason: 'memory-pressure' },
    ]);
    expect(run(controller, 180_000, 1000 / 60, { ...flight, memoryPressure: 0.8 })).toEqual([]);
    expect(run(controller, 61_000, 1000 / 60, flight)).toEqual([
      { previousLevel: 2, level: 3, reason: 'headroom' },
    ]);
  });

  it('lowers detail when streaming stays strained, until it no longer is', () => {
    const controller = createExplorerQualityController();
    expect(run(controller, 9000, 1000 / 60, { ...flight, strained: true })).toEqual([]);
    expect(run(controller, 3000, 1000 / 60, { ...flight, strained: true })).toEqual([
      { previousLevel: 3, level: 2, reason: 'streaming' },
    ]);
    // Strain on and off, never ten seconds running: no lower, and no calm to come back on.
    for (let i = 0; i < 22; i++) {
      expect(run(controller, 5000, 1000 / 60, { ...flight, strained: true })).toEqual([]);
      expect(run(controller, 3000, 1000 / 60, flight)).toEqual([]);
    }
    expect(run(controller, 61_000, 1000 / 60, flight)).toEqual([
      { previousLevel: 2, level: 3, reason: 'headroom' },
    ]);
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

  it('reports tiles rebuilt soon after their eviction as strain', () => {
    const strained = createStreamStrainMeter();
    expect(strained({ nowMs: 0, builtTiles: 0, thrashedTiles: 0, ...base })).toBe(false);
    expect(strained({ nowMs: 4000, builtTiles: 40, thrashedTiles: 4, ...base })).toBe(false);
    expect(strained({ nowMs: 6000, builtTiles: 60, thrashedTiles: 20, ...base })).toBe(false);
    expect(strained({ nowMs: 8000, builtTiles: 80, thrashedTiles: 45, ...base })).toBe(true);
    // Ten seconds later the burst has left the window.
    expect(strained({ nowMs: 19000, builtTiles: 90, thrashedTiles: 46, ...base })).toBe(false);
  });

  it('reports a view that crowds a full cache, but not a full warm cache', () => {
    const strained = createStreamStrainMeter();
    const counts = { builtTiles: 0, thrashedTiles: 0, maxResidentBytes: 1000 };
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
