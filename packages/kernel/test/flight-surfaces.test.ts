import type { AircraftInputData, AircraftSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { aircraftEngines, stepAircraft } from '../src/aircraft';
import { wingLiftCoefficient } from '../src/flight-aerodynamics';
import {
  elevatorForMoment,
  elevatorTrimFor,
  finMoment,
  tailMoment,
  tailState,
  wingPanelLoads,
} from '../src/flight-surfaces';
import {
  airborneAircraft,
  FLIGHT_TRIAL_INPUT,
  type FlightTrialPose,
  levelFlightPower,
  measureDutchRoll,
  measurePhugoid,
  measureRoll,
  measureShortPeriod,
  measureSpiral,
  steadyFlightPoint,
} from '../src/trials';
import { molenAircraft } from './helpers/entities';

type Vec3 = [number, number, number];

const skyhawk = molenAircraft('molen.entities.aircraft.cessna_172s').spec;
const baron = molenAircraft('molen.entities.aircraft.baron_g58').spec;
const viper = molenAircraft('molen.entities.aircraft.f_16b').spec;
const wing = skyhawk.airplane;
const surfaces = wing?.surfaces;
if (!wing || !surfaces) throw new Error('The Cessna 172 flies on surfaces');

const DENSITY = 1.225;
const SPEED = 50;
const still: Vec3 = [0, 0, 0];
/** Air velocity in body axes at an angle of attack and a slip (positive: slipping left). */
const flow = (alpha: number, slip = 0): Vec3 => [
  SPEED * Math.sin(slip),
  -SPEED * Math.sin(alpha) * Math.cos(slip),
  SPEED * Math.cos(alpha) * Math.cos(slip),
];
const panels = (air: Vec3, omega: Vec3 = still, aileron = 0) =>
  wingPanelLoads({
    airplane: wing,
    surfaces,
    span: skyhawk.span,
    air,
    omega,
    density: DENSITY,
    flaps: 0,
    aileron,
    induced: 0.05,
    left: 1,
    right: 1,
  });
const pressure = 0.5 * DENSITY * SPEED * SPEED;

describe('wing panels', () => {
  it('carry the whole wing in straight flight, ahead of the center of mass and with no roll or yaw', () => {
    const alpha = 0.08;
    const loads = panels(flow(alpha));
    const whole =
      pressure * wing.wingArea * wingLiftCoefficient(wing, alpha + wing.camberAngle, 0).cl;
    // Lift is square to the airflow: its share along the body's up axis is the cosine.
    expect(loads.force[1] / (whole * Math.cos(alpha))).toBeCloseTo(1, 1);
    expect(loads.force[0]).toBe(0);
    expect(loads.moment[1]).toBe(0);
    expect(loads.moment[2]).toBe(0);
    // Lift ahead of the center of mass pitches the nose up (+X is nose down).
    expect(loads.moment[0]).toBeCloseTo(-(surfaces.liftArm ?? 0) * loads.force[1], 6);
    expect(loads.moment[0]).toBeLessThan(0);
  });

  it('damp a roll, and more of one the faster it is', () => {
    const right = panels(flow(0.05), [0, 0, 0.5]);
    const faster = panels(flow(0.05), [0, 0, 1]);
    expect(right.moment[2]).toBeLessThan(0);
    expect(faster.moment[2]).toBeLessThan(right.moment[2] * 1.8);
    expect(panels(flow(0.05), [0, 0, -0.5]).moment[2]).toBeCloseTo(-right.moment[2], 6);
  });

  it('roll with the ailerons, and yaw against the roll while it lasts', () => {
    expect(panels(flow(0.05), still, 1).moment[2]).toBeGreaterThan(0);
    expect(panels(flow(0.05), still, -1).moment[2]).toBeLessThan(0);
    // Rolling right, the down-going right wing's lift leans forward and the left wing's back:
    // the nose swings left (+Y), away from the roll.
    expect(panels(flow(0.08), [0, 0, 0.5]).moment[1]).toBeGreaterThan(0);
  });

  it('roll away from a slip by their dihedral', () => {
    // Slipping to the left, the left wing meets the air at a higher angle and rises.
    expect(panels(flow(0.05, 0.1)).moment[2]).toBeGreaterThan(0);
    expect(panels(flow(0.05, -0.1)).moment[2]).toBeLessThan(0);
    const flat = wingPanelLoads({
      airplane: wing,
      surfaces: { ...surfaces, dihedral: 0 },
      span: skyhawk.span,
      air: flow(0.05, 0.1),
      omega: still,
      density: DENSITY,
      flaps: 0,
      aileron: 0,
      induced: 0.05,
      left: 1,
      right: 1,
    });
    expect(Math.abs(flat.moment[2])).toBeLessThan(1e-6);
  });

  it('drop the wing that stalls first', () => {
    // At the stall, rolling right raises the right wing's angle past it: that wing loses lift
    // instead of gaining it, and the roll is no longer damped.
    const stalled = panels(flow(wing.stallAngle - wing.camberAngle + 0.06), [0, 0, 0.3]);
    const flying = panels(flow(0.05), [0, 0, 0.3]);
    expect(stalled.separation).toBeGreaterThan(0.3);
    expect(stalled.moment[2]).toBeGreaterThan(flying.moment[2]);
  });

  it('survive a wing with no lift slope', () => {
    const loads = wingPanelLoads({
      airplane: { ...wing, liftSlope: 0, postStallLift: 0 },
      surfaces,
      span: skyhawk.span,
      air: flow(0.1),
      omega: still,
      density: DENSITY,
      flaps: 0,
      aileron: 1,
      induced: 0.05,
      left: 1,
      right: 1,
    });
    expect([...loads.force, ...loads.moment].every(Number.isFinite)).toBe(true);
  });
});

describe('tailplane and fin', () => {
  const tail = (alpha: number, omega: Vec3 = still, rate = 0) => {
    const cl = wingLiftCoefficient(wing, alpha + wing.camberAngle, 0).cl;
    return tailState(surfaces, flow(alpha), omega, DENSITY, cl / wing.liftSlope, 0, 1, rate);
  };

  it('balances the wing at the elevator position trim gives', () => {
    const alpha = 0.07;
    const cl = wingLiftCoefficient(wing, alpha + wing.camberAngle, 0).cl;
    const trim = elevatorTrimFor(wing, surfaces, alpha, cl);
    expect(Math.abs(trim)).toBeLessThan(1);
    const total = tailMoment(tail(alpha), trim) + panels(flow(alpha)).moment[0];
    expect(Math.abs(total)).toBeLessThan(0.03 * Math.abs(panels(flow(alpha)).moment[0]));
  });

  it('is stable: more angle of attack than trim pitches the nose down', () => {
    const alpha = 0.07;
    const cl = wingLiftCoefficient(wing, alpha + wing.camberAngle, 0).cl;
    const trim = elevatorTrimFor(wing, surfaces, alpha, cl);
    const net = (at: number) => tailMoment(tail(at), trim) + panels(flow(at)).moment[0];
    expect(net(alpha + 0.03)).toBeGreaterThan(0);
    expect(net(alpha - 0.03)).toBeLessThan(0);
  });

  it('damps pitching, and a growing angle of attack by the lag of the downwash', () => {
    const steady = tailMoment(tail(0.07), 0);
    // Nose pitching up: omega's X is the nose-down rate.
    expect(tailMoment(tail(0.07, [-0.3, 0, 0]), 0)).toBeGreaterThan(steady);
    expect(tailMoment(tail(0.07, still, 0.3), 0)).toBeGreaterThan(steady);
  });

  it('answers the elevator, and inverts to the deflection for a moment it can give', () => {
    const state = tail(0.07);
    expect(tailMoment(state, 0.5)).toBeLessThan(tailMoment(state, 0));
    for (const deflection of [-0.6, 0, 0.4]) {
      const moment = tailMoment(state, deflection);
      expect(elevatorForMoment(state, moment)).toBeCloseTo(deflection, 9);
    }
  });

  it('weathervanes, damps yaw and answers the rudder', () => {
    const fin = (air: Vec3, omega: Vec3 = still, rudder = 0) =>
      finMoment(surfaces, air, omega, DENSITY, rudder, 0, 1);
    // Slipping left, the nose turns left into the wind (+Y) and the fin's height rolls right.
    expect(fin(flow(0.05, 0.1))[1]).toBeGreaterThan(0);
    expect(fin(flow(0.05, -0.1))[1]).toBeLessThan(0);
    // Yawing nose left is resisted.
    expect(fin(flow(0.05), [0, 0.3, 0])[1]).toBeLessThan(0);
    // Right rudder turns the nose right.
    expect(fin(flow(0.05), still, 1)[1]).toBeLessThan(0);
    expect(fin(flow(0.05), still, -1)[1]).toBeGreaterThan(0);
  });
});

const flat = { groundHeight: () => -10000 };
function fly(
  spec: AircraftSpec,
  start: FlightTrialPose,
  seconds: number,
  controls: (seconds: number) => Partial<AircraftInputData>,
): FlightTrialPose {
  let { transform, state } = start;
  const hz = 120;
  for (let tick = 0; tick < seconds * hz; tick++)
    ({ transform, state } = stepAircraft(
      transform,
      state,
      { ...FLIGHT_TRIAL_INPUT, ...controls(tick / hz) },
      spec,
      1 / hz,
      flat,
    ));
  return { transform, state };
}

describe('an airplane flown directly on its surfaces', () => {
  const speed = 50;
  const at = { speed, altitude: 1000 };
  const power = levelFlightPower(skyhawk, speed, 1000);
  const direct = { controlMode: 'direct', pitchTrim: 0, power } as const;

  it('holds its trimmed speed hands-off, in a phugoid near the period theory gives', () => {
    const phugoid = measurePhugoid(skyhawk, { ...at, direct: true });
    expect(phugoid.period).toBeGreaterThan(0.9 * phugoid.expectedPeriod);
    expect(phugoid.period).toBeLessThan(1.3 * phugoid.expectedPeriod);
    expect(phugoid.dampingRatio).toBeGreaterThan(0.02);
    expect(phugoid.dampingRatio).toBeLessThan(0.2);
    // The assist flies the path it is left on instead: no phugoid.
    expect(measurePhugoid(skyhawk, at).period).toBeUndefined();
  });

  it('settles from a pitch disturbance in a well-damped short period', () => {
    const response = measureShortPeriod(skyhawk, { ...at, direct: true });
    expect(response.dampingRatio).toBeGreaterThan(0.35);
    expect(response.dampingRatio).toBeLessThanOrEqual(1);
    expect(response.period).toBeGreaterThan(1);
    expect(response.period).toBeLessThan(4);
  });

  it('swings out of a slip in a damped Dutch roll and keeps a released bank from winding up fast', () => {
    const dutch = measureDutchRoll(skyhawk, { ...at, direct: true });
    expect(dutch.dampingRatio).toBeGreaterThan(0.08);
    expect(dutch.dampingRatio).toBeLessThan(0.5);
    expect(dutch.period).toBeGreaterThan(1.5);
    expect(dutch.period).toBeLessThan(6);
    const spiral = measureSpiral(skyhawk, { ...at, direct: true });
    expect((spiral.final * 180) / Math.PI).toBeLessThan(20);
    expect((spiral.final * 180) / Math.PI).toBeGreaterThan(0);
  });

  it('rolls at a steady rate within a fraction of a second, slipping against the roll', () => {
    const roll = measureRoll(skyhawk, { ...at, direct: true });
    expect(roll.timeConstant).toBeGreaterThan(0.05);
    expect(roll.timeConstant).toBeLessThan(0.6);
    expect(roll.peakRate).toBeGreaterThan(0.4);
    // Adverse yaw: rolling right leaves the nose left of the flight path.
    const start = airborneAircraft(skyhawk, { ...at, power, direct: true });
    const rolled = fly(skyhawk, start, 0.8, () => ({ ...direct, roll: 1 }));
    expect(rolled.state.rollRate).toBeGreaterThan(0.3);
    // Sideslip is positive slipping left: here the flight path is to the right of the nose.
    expect(rolled.state.sideslip).toBeLessThan(-0.01);
    // The assist's rudder keeps the turn coordinated.
    const assisted = fly(skyhawk, airborneAircraft(skyhawk, { ...at, power }), 0.8, () => ({
      power,
      roll: 1,
    }));
    expect(Math.abs(assisted.state.sideslip ?? 0)).toBeLessThan(
      Math.abs(rolled.state.sideslip ?? 0),
    );
  });

  it('puts the stick on the elevator about its trim, and trims on the trim control', () => {
    const start = airborneAircraft(skyhawk, { ...at, power, direct: true });
    const trim = start.state.elevatorTrim ?? 0;
    const steady = steadyFlightPoint(skyhawk, speed, 1000, { power });
    expect(steady).toBeDefined();
    const held = fly(skyhawk, start, 1, () => ({ ...direct, pitch: 0.4 }));
    expect(held.state.surfaces?.elevator).toBeCloseTo(trim + 0.4, 2);
    expect(held.state.elevatorTrim).toBeCloseTo(trim, 9);
    expect(held.state.pitch).toBeGreaterThan(start.state.pitch + 0.05);
    const trimmed = fly(skyhawk, start, 1, () => ({ ...direct, pitchTrim: 1 }));
    expect(trimmed.state.elevatorTrim).toBeGreaterThan(trim + 0.2);
    // With no trim control the trim follows a held stick, so the pilot can let go of it.
    const followed = fly(skyhawk, start, 1, () => ({ controlMode: 'direct', power, pitch: 0.4 }));
    expect(followed.state.elevatorTrim).toBeGreaterThan(trim + 0.05);
    // Back with the assist, the surfaces are the assist's and the trim is forgotten.
    const assisted = fly(skyhawk, held, 0.5, () => ({ power }));
    expect(assisted.state.elevatorTrim).toBeUndefined();
    expect(assisted.state.surfaces).toBeDefined();
  });

  it('yaws and rolls toward a dead engine until the pilot holds it with rudder', () => {
    const twinPower = levelFlightPower(baron, 60, 1000);
    const start = airborneAircraft(baron, { speed: 60, altitude: 1000, power: 1, direct: true });
    const [left] = aircraftEngines(baron);
    if (!left) throw new Error('The Baron has two engines');
    expect(left.position[0]).toBeGreaterThan(0);
    const engines = start.state.engines;
    if (!engines?.[left.id]) throw new Error('Missing engine state');
    engines[left.id] = { ...engines[left.id], rpm: 0, failed: true, thrust: 0 } as never;
    expect(twinPower).toBeGreaterThan(0);
    const input = { controlMode: 'direct', pitchTrim: 0, power: 1 } as const;
    const free = fly(baron, start, 3, () => input);
    // The live right engine swings the nose left, toward the dead one, and the airplane
    // banks that way.
    expect(free.state.yaw).toBeGreaterThan(0.05);
    expect(free.state.roll).toBeLessThan(-0.02);
    const held = fly(baron, start, 3, () => ({ ...input, yaw: 0.25 }));
    expect(Math.abs(held.state.yaw)).toBeLessThan(Math.abs(free.state.yaw));
  });

  it('is not offered on an airplane flown only through its flight computers', () => {
    expect(viper.airplane?.surfaces?.flyByWire).toBe(true);
    const start = airborneAircraft(viper, { speed: 180, altitude: 3000, power: 0.6 });
    const controls = (seconds: number) => ({ power: 0.6, pitch: seconds < 1 ? 0.5 : 0 });
    const assisted = fly(viper, start, 3, controls);
    const asked = fly(viper, start, 3, (seconds) => ({
      ...controls(seconds),
      controlMode: 'direct' as const,
    }));
    expect(asked.state).toEqual(assisted.state);
    expect(asked.transform).toEqual(assisted.transform);
  });
});
