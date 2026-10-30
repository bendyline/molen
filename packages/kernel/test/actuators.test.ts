import { describe, expect, it } from 'vitest';
import { actuatorsSettled, stepActuators } from '../src/actuators';

describe('snapshot-owned actuators', () => {
  it('reverses a ten-second mechanism from its current fractional position', () => {
    const specs = { gear: { seconds: 10 } };
    const extended = stepActuators(specs, undefined, { gear: true }, 3);
    expect(extended.gear).toBeCloseTo(0.3);
    const reversed = stepActuators(specs, extended, { gear: false }, 2);
    expect(reversed.gear).toBeCloseTo(0.1);
    expect(stepActuators(specs, reversed, { gear: false }, 2).gear).toBe(0);
    expect(extended.gear).toBeCloseTo(0.3);
    expect(actuatorsSettled(specs, reversed, { gear: false })).toBe(false);
    expect(actuatorsSettled(specs, { gear: 0 }, { gear: false })).toBe(true);
  });
  it('supports partial targets, paused steps and snapshot restoration', () => {
    const specs = { canopy: { seconds: 3 } };
    const half = stepActuators(specs, undefined, { canopy: 0.5 }, 2);
    expect(half.canopy).toBe(0.5);
    expect(stepActuators(specs, half, { canopy: 1 }, 0)).toEqual(half);
    expect(stepActuators(specs, JSON.parse(JSON.stringify(half)), { canopy: 0 }, 0.75).canopy).toBe(
      0.25,
    );
  });
  it('finishes the current wiper cycle and parks when switched off', () => {
    const specs = { wipers: { seconds: 2, mode: 'cycle' as const } };
    const running = stepActuators(specs, undefined, { wipers: true }, 0.6);
    expect(running.wipers).toBeCloseTo(0.3);
    expect(stepActuators(specs, running, { wipers: false }, 0.6).wipers).toBeCloseTo(0.6);
    expect(stepActuators(specs, running, { wipers: false }, 2).wipers).toBe(0);
    expect(actuatorsSettled(specs, { wipers: 0 }, { wipers: true })).toBe(false);
  });
  it('latches emergency release and switches lights immediately', () => {
    const specs = { eject: { seconds: 1, mode: 'latch' as const }, headlights: { seconds: 0 } };
    const fired = stepActuators(specs, undefined, { eject: true, headlights: true }, 0.2);
    expect(fired).toEqual({ eject: 0.2, headlights: 1 });
    expect(stepActuators(specs, fired, {}, 1)).toEqual({ eject: 1, headlights: 0 });
  });
});
