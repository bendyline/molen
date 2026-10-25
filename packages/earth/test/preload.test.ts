import type { TerrainPyramidView } from '@bendyline/molen-terrain/client';
import { describe, expect, it } from 'vitest';
import { createEarthTilePreloader } from '../src/client/preload';

const view = (x: number, y = 300): TerrainPyramidView => ({
  position: [x, y, 0],
  direction: [1, -0.1, 0],
  verticalFov: Math.PI / 3,
  viewportHeight: 900,
  aspect: 16 / 9,
});

describe('flight tile preparation track', () => {
  it.each([
    150, 350,
  ])('prepares the near approach at %s meters/second without a byte cache', (speed) => {
    const planner = createEarthTilePreloader();
    expect(planner.views(0, view(0), true)).toEqual([]);
    const future = planner.views(100, view(speed / 10), true);
    expect(future).toHaveLength(3);
    expect(future[0]?.position[0]).toBeGreaterThan(speed * 3);
    expect((future[2]?.position[0] ?? Infinity) - speed / 10).toBeLessThanOrEqual(4000);
    expect(future[0]?.viewportHeight).toBe(900);
  });

  it('handles turns, descent, teleports and entry animations', () => {
    const planner = createEarthTilePreloader();
    planner.views(0, view(0), true);
    const descent = planner.views(100, view(7.5, 250), true);
    expect(descent[0]?.position).toEqual([307.5, 150, 0]);
    for (let i = 2; i <= 40; i++) planner.views(i * 100, view(15 - i * 7.5), true);
    const turn = planner.views(4100, view(15 - 41 * 7.5), true);
    expect(turn[0]?.position[0]).toBeLessThan(15 - 41 * 7.5);
    expect(planner.views(4200, view(10_000), true)).toEqual([]);
    expect(planner.views(4300, view(10_005), false)).toEqual([]);
    expect(planner.views(4400, view(10_010), true)).toEqual([]);
    expect(planner.views(10_000, view(10_015), true)).toEqual([]);
    planner.reset();
    expect(planner.views(10_100, view(0), true)).toEqual([]);
  });

  it('does not build speculative geometry for walking or a stationary camera', () => {
    const planner = createEarthTilePreloader();
    planner.views(0, view(0), true);
    expect(planner.views(100, view(0.4), true)).toEqual([]);
  });
});
