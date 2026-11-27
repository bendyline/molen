import type { AdaptiveQualityChange, AdaptiveQualitySample } from '@bendyline/molen-client';
import { describe, expect, it } from 'vitest';
import { createExplorerQualityController } from './quality-policy.js';

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
const slow = { cpuFrameMs: 40, gpuFrameMs: 30, memoryPressure: 0.3 };

describe('world explorer Auto detail', () => {
  it('starts at its guess and keeps it through smooth flight: nothing raises it', () => {
    const controller = createExplorerQualityController();
    expect(controller.getStats().level).toBe(3);
    expect(run(controller, 180_000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 300_000, 1000 / 120, { cpuFrameMs: 2, gpuFrameMs: 2 })).toEqual([]);
    expect(controller.getStats()).toMatchObject({ level: 3, reason: undefined });
    expect(createExplorerQualityController(1).getStats().level).toBe(1);
  });

  it('keeps it through slow frames, however slow and however long', () => {
    const controller = createExplorerQualityController();
    // A P-51 over Seattle with other work on the machine: 20 frames a second for half a minute
    // took two levels, and at Low the ground beneath the aircraft was the box shells of a tile
    // four times too coarse, until a minute of calm had it all built again.
    expect(run(controller, 300_000, 50, slow)).toEqual([]);
    expect(run(controller, 120_000, 120, { ...slow, loading: true })).toEqual([]);
    // Nor do long stalls count, however often they come.
    for (let i = 0; i < 6; i++) {
      run(controller, 5000, 1000 / 60, flight);
      expect(controller.sample(1300, flight)).toBeUndefined();
    }
    expect(controller.getStats()).toMatchObject({ level: 3, reason: undefined });
  });

  it('keeps it whatever the stream is doing', () => {
    const controller = createExplorerQualityController();
    // Three full turns over downtown Seattle built two fifths of their tiles again within a
    // minute of evicting them. That was called strain and cost a level, which came back, and went.
    expect(run(controller, 300_000, 1000 / 60, { ...flight, strained: true })).toEqual([]);
    expect(controller.getStats().level).toBe(3);
  });

  it('gives a level up, for good, when what is on show stays over the memory budget', () => {
    const controller = createExplorerQualityController();
    const over = { ...flight, memoryPressure: 1.1 };
    // Near the budget is not over it, and nine seconds over it is a handover.
    expect(run(controller, 120_000, 1000 / 60, { ...flight, memoryPressure: 0.98 })).toEqual([]);
    expect(run(controller, 9000, 1000 / 60, over)).toEqual([]);
    expect(run(controller, 5000, 1000 / 60, flight)).toEqual([]);
    expect(run(controller, 9000, 1000 / 60, over)).toEqual([]);
    expect(run(controller, 2000, 1000 / 60, over)).toEqual([
      { previousLevel: 3, level: 2, reason: 'memory-pressure' },
    ]);
    expect(controller.getStats()).toMatchObject({ level: 2, reason: 'memory-pressure' });
    // The lower level's tiles get half a minute to take over before the budget is judged again.
    expect(run(controller, 29_000, 1000 / 60, over)).toEqual([]);
    expect(run(controller, 12_000, 1000 / 60, over)).toEqual([
      { previousLevel: 2, level: 1, reason: 'memory-pressure' },
    ]);
    // Room again brings nothing back: over the same place it would only be lost again.
    expect(run(controller, 600_000, 1000 / 60, { ...flight, memoryPressure: 0.2 })).toEqual([]);
    expect(controller.getStats()).toMatchObject({ level: 1, reason: 'memory-pressure' });
  });

  it('gives it up sooner a quarter past the budget, and not below the lowest level', () => {
    const controller = createExplorerQualityController(1);
    const far = { ...flight, memoryPressure: 1.4 };
    expect(run(controller, 1500, 1000 / 60, far)).toEqual([]);
    expect(run(controller, 1000, 1000 / 60, far)).toEqual([
      { previousLevel: 1, level: 0, reason: 'memory-pressure' },
    ]);
    expect(run(controller, 300_000, 1000 / 60, far)).toEqual([]);
    expect(controller.getStats().level).toBe(0);
  });

  it('does not count a hidden page or a stall toward the memory budget', () => {
    const controller = createExplorerQualityController();
    const over = { ...flight, memoryPressure: 1.1 };
    expect(run(controller, 60_000, 1000 / 60, { ...over, active: false })).toEqual([]);
    // Ten frames of two seconds each are ten frames, not twenty seconds over the budget.
    expect(run(controller, 20_000, 2000, over)).toEqual([]);
    expect(controller.getStats().level).toBe(3);
  });

  it('makes its guess afresh on restart', () => {
    const controller = createExplorerQualityController();
    const over = { ...flight, memoryPressure: 1.1 };
    expect(run(controller, 11_000, 1000 / 60, over).map((change) => change.level)).toEqual([2]);
    controller.restart();
    expect(controller.getStats()).toMatchObject({ level: 3, reason: undefined });
    // Counted from the restart: the rest after the last step is forgotten with it.
    expect(run(controller, 9000, 1000 / 60, over)).toEqual([]);
    expect(run(controller, 2000, 1000 / 60, over).map((change) => change.level)).toEqual([2]);
  });

  it('does not move a level that is held, even for memory', () => {
    const held = createExplorerQualityController(2, true);
    expect(run(held, 60_000, 50, { ...slow, memoryPressure: 1.5 })).toEqual([]);
    expect(held.getStats().level).toBe(2);
  });
});
