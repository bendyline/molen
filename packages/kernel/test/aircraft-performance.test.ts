import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { IDLE_AIRCRAFT_INPUT, initialAircraftState, stepAircraft } from '../src/aircraft';
import type { TransformData } from '../src/component';
import { vehicleLocalPoint, vehicleRotation } from '../src/vehicles';
import { molenAircraft } from './helpers/entities';

const mustang = molenAircraft('molen.entities.aircraft.p51d').spec;
const mustangEngine = mustang.engine;
if (!mustangEngine) throw new Error('Missing Mustang engine');
const helicopter = molenAircraft('molen.entities.aircraft.oh6').spec;
const flat = { groundHeight: () => 0 };
const clean: AircraftInputData = {
  ...IDLE_AIRCRAFT_INPUT,
  engine: true,
  power: 1,
  brake: false,
  gear: false,
};
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
function airborne(overrides: Partial<AircraftStateData> = {}) {
  const state = {
    ...initialAircraftState(),
    grounded: false,
    rpm: 1,
    velocity: [0, 0, 60] as [number, number, number],
    ...overrides,
  };
  const transform: TransformData = {
    pos: [0, 1000, 0],
    rot: vehicleRotation(state.yaw, -state.pitch, state.roll),
  };
  return { transform, state };
}
function fly(
  seconds: number,
  controls: (state: AircraftStateData, seconds: number) => AircraftInputData,
  start = airborne(),
  hz = 60,
  spec = mustang,
) {
  let result = start;
  for (let i = 0; i < seconds * hz; i++) {
    result = stepAircraft(
      result.transform,
      result.state,
      controls(result.state, i / hz),
      spec,
      1 / hz,
      flat,
    );
  }
  return result;
}
const level = (state: AircraftStateData): AircraftInputData => ({
  ...clean,
  pitch: clamp(-state.verticalSpeed * 0.08 - state.pitchRate * 0.8),
});
function sideslip(result: ReturnType<typeof airborne>) {
  const left = vehicleLocalPoint({ ...result.transform, pos: [0, 0, 0] }, [1, 0, 0]);
  return Math.asin(
    left.reduce((sum, value, i) => sum + value * (result.state.velocity[i] ?? 0), 0) /
      Math.hypot(...result.state.velocity),
  );
}

describe('aircraft performance and recovery envelope', () => {
  it('rotates with a held pitch key and climbs without an immediate stall on key release', () => {
    let stalled = false;
    const result = fly(
      35,
      (state) => {
        stalled ||= state.stalled;
        return {
          ...clean,
          gear: true,
          flaps: true,
          pitch: state.grounded && state.airspeed >= 42 ? 1 : 0,
        };
      },
      { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, state: initialAircraftState() },
    );
    expect(stalled).toBe(false);
    expect(result.state.crashed).toBe(false);
    expect(result.state.grounded).toBe(false);
    expect(result.transform.pos[1]).toBeGreaterThan(20);
    expect(result.state.airspeed).toBeGreaterThan(55);
  });

  it('accelerates the clean Mustang past 300 kt while maintaining altitude, with useful cruise throttle', () => {
    const full = fly(120, level);
    const cruise = fly(120, (state) => ({ ...level(state), power: 0.65 }));
    const dirty = fly(120, (state) => ({ ...level(state), gear: true, flaps: true }));
    expect(full.state.airspeed * 1.94384).toBeGreaterThan(300);
    expect(full.state.airspeed * 1.94384).toBeLessThan(335);
    expect(cruise.state.airspeed * 1.94384).toBeGreaterThan(250);
    expect(cruise.state.airspeed).toBeLessThan(full.state.airspeed);
    expect(dirty.state.airspeed).toBeLessThan(full.state.airspeed * 0.75);
    for (const result of [full, cruise, dirty]) {
      expect(Math.abs(result.transform.pos[1] - 1000)).toBeLessThan(10);
      expect(Math.abs(result.state.verticalSpeed)).toBeLessThan(0.1);
      expect(result.state.stalled).toBe(false);
      expect(result.state.crashed).toBe(false);
    }
  });

  it('delivers proportional steady throttle power while retaining engine spool-up', () => {
    const advance = (power: number, rpm: number) => {
      const start = airborne({ rpm });
      return stepAircraft(start.transform, start.state, { ...clean, power }, mustang, 1 / 120, flat)
        .state.velocity[2];
    };
    const idle = advance(0, mustangEngine.idleRpm);
    const half = advance(0.5, mustangEngine.idleRpm + 0.5 * (1 - mustangEngine.idleRpm));
    const full = advance(1, 1);
    expect((half - idle) / (full - idle)).toBeCloseTo(0.5, 6);
    expect(advance(1, 0) - idle).toBeLessThan((full - idle) * 0.01);
  });

  it('crosses the stall angle without a drag discontinuity and does not stall solely on low airspeed', () => {
    const wing = mustang.airplane;
    if (!wing) throw new Error('Missing wing');
    const sample = (pitch: number, speed = 60) => {
      const start = airborne({ pitch, velocity: [0, 0, speed] });
      return stepAircraft(
        start.transform,
        start.state,
        { ...clean, engine: false },
        mustang,
        1 / 120,
        flat,
      );
    };
    const before = sample(wing.stallAngle - wing.camberAngle - 0.00001);
    const after = sample(wing.stallAngle - wing.camberAngle + 0.00001);
    expect(before.state.stalled).toBe(false);
    expect(after.state.stalled).toBe(true);
    expect(Math.abs(after.state.velocity[2] - before.state.velocity[2]) * 120).toBeLessThan(0.01);
    expect(sample(0, 20).state.stalled).toBe(false);
    expect(sample(0.5, 100).state.stalled).toBe(true);
  });

  it('applies authored thrust direction without exceeding available propeller power', () => {
    const spec: AircraftSpec = { ...mustang, engine: { ...mustangEngine, thrustAxis: [2, 0, 0] } };
    const start = airborne({ velocity: [100, 0, 0] });
    const on = stepAircraft(start.transform, start.state, clean, spec, 1 / 120, flat);
    const off = stepAircraft(
      start.transform,
      start.state,
      { ...clean, engine: false },
      spec,
      1 / 120,
      flat,
    );
    const thrust = (on.state.velocity[0] - off.state.velocity[0]) * 120 * spec.mass;
    expect(thrust).toBeGreaterThan(0);
    expect(thrust * 100).toBeCloseTo(
      mustangEngine.power * (spec.airplane?.propellerEfficiency ?? 0),
      5,
    );
    expect(on.state.velocity[2]).toBeCloseTo(off.state.velocity[2], 10);
  });

  it('does not force a banked heading turn when the wing produces no lift', () => {
    if (!mustang.airplane) throw new Error('Missing wing');
    const spec: AircraftSpec = {
      ...mustang,
      airplane: {
        ...mustang.airplane,
        liftSlope: 0,
        postStallLift: 0,
        stallPitchRate: 0,
        yawStability: 0,
        lateralDamping: 0,
      },
    };
    const result = fly(
      1,
      () => ({ ...clean, engine: false }),
      airborne({ roll: 1, pitch: 0.5 }),
      60,
      spec,
    );
    expect(result.state.yaw).toBe(0);
    expect(result.state.velocity[0]).toBe(0);
  });

  it.each([
    -0.7, 0, 0.7, 1.2,
  ])('recovers a stall at %s radians bank by unloading, leveling wings, then gently pulling out', (roll) => {
    const start = airborne({ roll, pitch: 0.55, velocity: [4, 0, 38] });
    const initial = stepAircraft(start.transform, start.state, clean, mustang, 1 / 60, flat);
    expect(initial.state.stalled).toBe(true);
    const recovery = (state: AircraftStateData, seconds: number): AircraftInputData => ({
      ...clean,
      pitch: clamp(((seconds < 5 ? -0.18 : 0.04) - state.pitch) * 2 - state.pitchRate),
      roll: clamp(-state.roll * 3 - state.rollRate),
    });
    const unloaded = fly(5, recovery, start);
    expect(unloaded.state.stalled).toBe(false);
    expect(unloaded.state.airspeed).toBeGreaterThan(55);
    const result = fly(20, recovery, start);
    expect(result.state.stalled).toBe(false);
    expect(result.state.crashed).toBe(false);
    expect(result.state.verticalSpeed).toBeGreaterThan(0);
    expect(result.transform.pos[1]).toBeGreaterThan(840);
    expect(Math.abs(result.state.roll)).toBeLessThan(0.01);
    expect(Math.abs(sideslip(result))).toBeLessThan(0.01);
  });

  it.each([-1, 1])('unloads a %s-sign stall toward attached flow with neutral elevator', (sign) => {
    const result = fly(0.25, () => ({ ...clean, engine: false }), airborne({ pitch: sign * 0.6 }));
    expect(result.state.pitchRate * sign).toBeLessThan(0);
    expect(Math.abs(result.state.pitch)).toBeLessThan(0.6);
  });

  it('makes symmetric coordinated banked turns without accumulating sideslip', () => {
    const turns = [-0.45, 0.45].map((roll) =>
      fly(15, level, airborne({ roll, velocity: [0, 0, 100] })),
    );
    const [left, right] = turns;
    if (!left || !right) throw new Error('Missing turn result');
    expect(left.state.yaw).toBeGreaterThan(0.4);
    expect(right.state.yaw).toBeLessThan(-0.4);
    expect(left.state.yaw).toBeCloseTo(-right.state.yaw, 8);
    for (const result of turns) {
      expect(Math.abs(sideslip(result))).toBeLessThan(0.02);
      expect(Math.abs(result.transform.pos[1] - 1000)).toBeLessThan(10);
    }
  });

  it('dissipates energy in an unpowered slipping descent', () => {
    const start = airborne({ pitch: 0.3, roll: 0.5, velocity: [15, -5, 80] });
    const energy = (result: ReturnType<typeof airborne>) =>
      9.81 * result.transform.pos[1] + 0.5 * Math.hypot(...result.state.velocity) ** 2;
    const result = fly(5, () => ({ ...clean, engine: false }), start);
    expect(energy(result)).toBeLessThan(energy(start));
  });

  it('preserves the flight path across 30, 60, and 120 Hz hosts', () => {
    const controls = (): AircraftInputData => ({ ...clean, pitch: 0.02, roll: 0.03 });
    const runs = [30, 60, 120].map((hz) =>
      fly(10, controls, airborne({ velocity: [0, 0, 100] }), hz),
    );
    const reference = runs[0];
    if (!reference) throw new Error('Missing reference flight');
    for (const result of runs.slice(1)) {
      for (const axis of [0, 1, 2] as const) {
        expect(result.transform.pos[axis]).toBeCloseTo(reference.transform.pos[axis], 2);
      }
      expect(result.state.yaw).toBeCloseTo(reference.state.yaw, 4);
    }
  });

  it.each([mustang, helicopter])('uses air-relative forces in moving air for $label', (spec) => {
    const calm = airborne({ velocity: [0, 0, 10] });
    const wind = airborne({ velocity: [0, 0, 0] });
    const a = stepAircraft(calm.transform, calm.state, clean, spec, 1 / 60, flat);
    const b = stepAircraft(wind.transform, wind.state, clean, spec, 1 / 60, {
      ...flat,
      wind: [0, 0, -10],
    });
    expect(a.state.velocity[0]).toBeCloseTo(b.state.velocity[0], 10);
    expect(a.state.velocity[1]).toBeCloseTo(b.state.velocity[1], 10);
    expect(a.state.velocity[2] - 10).toBeCloseTo(b.state.velocity[2], 10);
  });
});
