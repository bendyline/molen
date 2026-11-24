import { describe, expect, it } from 'vitest';
import {
  accelerationTime,
  bestRotorClimb,
  bestSteadyClimb,
  compareScorecards,
  hoverCeiling,
  levelSpeedRoots,
  measureClimbAndTopSpeed,
  measureRoll,
  measureStallAndGlide,
  measureTakeoff,
  oscillation,
  rotorAutorotation,
  scoreTrial,
  stallSpeedEstimate,
  standingDistance,
  steadyCornering,
  steadyGlide,
  stoppingDistance,
  type TrialSample,
} from '../src/trials';
import { molenAircraft, molenVehicle } from './helpers/entities';

const mustang = molenAircraft('molen.entities.aircraft.p51d').spec;
const helicopter = molenAircraft('molen.entities.aircraft.oh6').spec;
const sedan = molenVehicle('molen.entities.vehicle.sedan').spec;

describe('reading a recorded response', () => {
  const record = (value: (t: number) => number, seconds = 60): TrialSample[] =>
    Array.from({ length: seconds * 10 }, (_, i) => [i / 10, value(i / 10)] as const);

  it('finds the period and damping of a decaying oscillation', () => {
    const damping = 0.2;
    const natural = (2 * Math.PI) / 8;
    const damped = natural * Math.sqrt(1 - damping * damping);
    const response = oscillation(
      record((t) => 5 + 3 * Math.exp(-damping * natural * t) * Math.cos(damped * t)),
    );
    expect(response.settled).toBeCloseTo(5, 1);
    expect(response.period).toBeCloseTo((2 * Math.PI) / damped, 0);
    expect(response.dampingRatio).toBeCloseTo(damping, 1);
    expect(response.crossings).toBeGreaterThan(4);
  });

  it('reports no period for a value that moves to a new level and stays', () => {
    const response = oscillation(record((t) => 100 * (1 - Math.exp(-t / 5))));
    expect(response.period).toBeUndefined();
    expect(response.dampingRatio).toBeUndefined();
    expect(response.crossings).toBeLessThan(2);
    expect(response.settled).toBeCloseTo(100, 0);
  });
});

describe('scoring', () => {
  it('passes within the tolerance, signs the error and leaves a figure without a reference unscored', () => {
    expect(scoreTrial(104, { value: 100, tolerance: 0.05 })).toEqual({
      status: 'pass',
      error: 0.04,
    });
    expect(scoreTrial(90, { value: 100, tolerance: 0.05 }).status).toBe('fail');
    expect(scoreTrial(90, { value: 100, tolerance: 0.05 }).error).toBeCloseTo(-0.1);
    expect(scoreTrial(90)).toEqual({ status: 'unscored' });
    expect(scoreTrial(undefined, { value: 100, tolerance: 0.05 })).toEqual({
      status: 'unmeasured',
    });
  });

  it('treats a scorecard as a budget: failing cards are allowed, a pass may not be lost', () => {
    const baseline = {
      a: { status: 'pass' },
      b: { status: 'fail' },
      c: { status: 'fail' },
      gone: { status: 'pass' },
    } as const;
    const current = {
      a: { status: 'fail' },
      b: { status: 'pass' },
      c: { status: 'fail' },
      fresh: { status: 'pass' },
    } as const;
    expect(compareScorecards(baseline, current)).toEqual({
      regressions: ['a'],
      improvements: ['b'],
      added: ['fresh'],
      removed: ['gone'],
      passed: 2,
      baselinePassed: 2,
    });
    expect(compareScorecards(baseline, baseline).regressions).toEqual([]);
  });
});

describe('flight trials on the production solver', () => {
  it('stalls where the wing runs out of lift and glides at the polar’s best ratio', () => {
    const measured = measureStallAndGlide(mustang, { altitude: 0 });
    const estimate = stallSpeedEstimate(mustang);
    expect(measured.stallSpeed).toBeGreaterThan(estimate * 0.97);
    expect(measured.stallSpeed).toBeLessThan(estimate * 1.03);
    const steady = steadyGlide(mustang, 0);
    expect(measured.glideRatio).toBeGreaterThan((steady?.ratio ?? 0) * 0.96);
    expect(measured.glideRatio).toBeLessThan((steady?.ratio ?? 0) * 1.04);
    // Flaps and gear lower the stall speed.
    const landing = measureStallAndGlide(mustang, { altitude: 0, flaps: 1, gear: true });
    expect(landing.stallSpeed).toBeLessThan((measured.stallSpeed ?? 0) * 0.95);
  });

  it('finds the climb and top speed of a level acceleration close to the force balance', () => {
    const measured = measureClimbAndTopSpeed(mustang, { altitude: 0 });
    const steady = bestSteadyClimb(mustang, 0);
    expect(measured.climbRate).toBeGreaterThan((steady?.rate ?? 0) * 0.92);
    expect(measured.climbRate).toBeLessThan((steady?.rate ?? 0) * 1.03);
    const root = levelSpeedRoots(mustang, 0).at(-1);
    expect(measured.topSpeed).toBeGreaterThan((root?.speed ?? 0) * 0.98);
    expect(measured.topSpeed).toBeLessThan((root?.speed ?? 0) * 1.01);
  });

  it('rolls all the way around on full aileron and reports the steady rate', () => {
    const roll = measureRoll(mustang, { speed: 130, altitude: 1000 });
    expect(roll.peakRate).toBeGreaterThan(1);
    expect(roll.timeTo60).toBeLessThan(roll.timeTo360 ?? 0);
    expect(roll.timeConstant).toBeLessThan(1);
  });

  it('takes off from a standing start and clears 15 m', () => {
    const run = measureTakeoff(mustang);
    expect(run.groundRoll).toBeGreaterThan(150);
    expect(run.groundRoll).toBeLessThan(700);
    expect(run.distanceOver15m).toBeGreaterThan(run.groundRoll ?? Infinity);
  });
});

describe('rotor trials', () => {
  it('hovers higher in ground effect than out of it', () => {
    const free = hoverCeiling(helicopter);
    expect(free).toBeGreaterThan(500);
    expect(hoverCeiling(helicopter, 1.5)).toBeGreaterThan(free);
  });

  it('climbs under power and descends with the rotor turning when the engine is out', () => {
    expect(bestRotorClimb(helicopter)?.verticalSpeed).toBeGreaterThan(3);
    const glide = rotorAutorotation(helicopter, 31);
    expect(glide.verticalSpeed).toBeLessThan(-5);
    expect(glide.rpm).toBeGreaterThan(0.8);
  });
});

describe('driving trials on the production solver', () => {
  it('measures a sedan’s standing start, braking and cornering', () => {
    const time = accelerationTime(sedan, 27.78);
    expect(time).toBeGreaterThan(7.2);
    expect(time).toBeLessThan(9.2);
    const quarter = standingDistance(sedan);
    expect(quarter?.seconds).toBeGreaterThan(14);
    expect(quarter?.seconds).toBeLessThan(18);
    expect(stoppingDistance(sedan, 27.78)).toBeGreaterThan(34);
    expect(stoppingDistance(sedan, 27.78)).toBeLessThan(42);
    expect(steadyCornering(sedan).lateralG * 9.81).toBeGreaterThan(7.5);
  });
});
