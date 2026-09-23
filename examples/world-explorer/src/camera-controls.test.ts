import { describe, expect, it } from 'vitest';
import {
  applyCameraLookDelta,
  cameraForward,
  cameraPlanarForward,
  cameraRight,
  terrainViewNeedsImmediateUpdate,
} from './camera-controls.js';

const NORTH_YAW = -Math.PI / 2;

describe('world explorer camera controls', () => {
  it('maps D east and A west while facing north', () => {
    const forward = cameraForward(NORTH_YAW, 0);
    const right = cameraRight(NORTH_YAW);

    expect(forward[0]).toBeCloseTo(0);
    expect(forward[2]).toBeCloseTo(-1);
    expect(right[0]).toBeCloseTo(1);
    expect(right[2]).toBeCloseTo(0);
  });

  it('turns right when the pointer moves right', () => {
    const turned = applyCameraLookDelta(NORTH_YAW, 0, 100, 0);
    const forward = cameraForward(turned.yaw, turned.pitch);

    expect(turned.yaw).toBeGreaterThan(NORTH_YAW);
    expect(forward[0]).toBeGreaterThan(0);
  });

  it('turns left when the pointer moves left', () => {
    const turned = applyCameraLookDelta(NORTH_YAW, 0, -100, 0);
    const forward = cameraForward(turned.yaw, turned.pitch);

    expect(turned.yaw).toBeLessThan(NORTH_YAW);
    expect(forward[0]).toBeLessThan(0);
  });

  it('keeps travel level while look pitch changes', () => {
    const travel = cameraPlanarForward(NORTH_YAW);

    expect(travel[0]).toBeCloseTo(0);
    expect(travel[1]).toBe(0);
    expect(travel[2]).toBeCloseTo(-1);
  });

  it('refreshes terrain immediately when movement or panning outruns the idle cadence', () => {
    const position: [number, number, number] = [100, 400, 200];
    const direction = cameraForward(NORTH_YAW, 0);

    expect(
      terrainViewNeedsImmediateUpdate(
        position,
        direction,
        [107, 400, 200],
        cameraForward(NORTH_YAW + 0.01, 0),
        16,
        0.04,
      ),
    ).toBe(false);
    expect(
      terrainViewNeedsImmediateUpdate(position, direction, [116, 400, 200], direction, 16, 0.04),
    ).toBe(true);
    expect(
      terrainViewNeedsImmediateUpdate(
        position,
        direction,
        position,
        cameraForward(NORTH_YAW + 0.05, 0),
        16,
        0.04,
      ),
    ).toBe(true);
  });
});
