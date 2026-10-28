import type { AircraftInputData, AircraftSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  aircraftEngineRpm,
  aircraftEngineThrust,
  aircraftMixtureEfficiency,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  sampleAtmosphere,
  stepAircraft,
} from '../src/aircraft';
import { molenAircraft } from './helpers/entities';

const requireValue = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('Missing engine fixture or reading');
  return value;
};
const spec = molenAircraft('molen.entities.aircraft.baron_g58').spec;
const engine = {
  ...requireValue(spec.engines?.[0]),
  mixtureControl: true,
  propellerControl: { minRpm: 0.6 },
  ratedDensityRatio: 1,
};
const wing = requireValue(spec.airplane);
const sea = sampleAtmosphere({}, 0);
const high = sampleAtmosphere({}, 4000);
const throttle: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT, engine: true, power: 0.8 };
function fly(input: AircraftInputData, aircraft: AircraftSpec = spec, ticks = 240) {
  let result = {
    transform: {
      pos: [0, 0, 0] as [number, number, number],
      rot: [0, 0, 0, 1] as [number, number, number, number],
    },
    state: initialAircraftState(),
  };
  for (let i = 0; i < ticks; i++)
    result = stepAircraft(result.transform, result.state, input, aircraft, 1 / 60, {
      groundHeight: () => 0,
    });
  return result;
}

describe('piston mixture and propeller governing', () => {
  it('leans for reduced air density, loses power on either side and cuts fuel at zero', () => {
    expect(aircraftMixtureEfficiency(engine, sea, 1)).toBe(1);
    const leaned = aircraftEngineThrust(engine, wing, high, 60, 0.8, 0, 0.72);
    expect(leaned).toBeGreaterThan(aircraftEngineThrust(engine, wing, high, 60, 0.8, 0, 1));
    expect(leaned).toBeGreaterThan(aircraftEngineThrust(engine, wing, high, 60, 0.8, 0, 0.2));
    expect(aircraftEngineThrust(engine, wing, sea, 0, 1, 0, 0)).toBe(0);
    expect(aircraftMixtureEfficiency({ ...engine, mixtureControl: false }, high, 0)).toBe(1);
  });
  it('holds selected RPM with enough power, reaches the fine-pitch stop at idle and changes thrust', () => {
    expect(aircraftEngineRpm(engine, 0.8, 1, 0)).toBeCloseTo(0.6);
    expect(aircraftEngineRpm(engine, 0.6, 1, 0)).toBeCloseTo(0.6);
    expect(aircraftEngineRpm(engine, 0, 1, 1)).toBeCloseTo(engine.idleRpm);
    expect(aircraftEngineThrust(engine, wing, sea, 0, 1, 0, 1, 0)).toBeLessThan(
      aircraftEngineThrust(engine, wing, sea, 0, 1, 0, 1, 1),
    );
    expect(aircraftEngineThrust(engine, wing, sea, 80, 1, 0, 1, 0)).toBeLessThan(
      aircraftEngineThrust(engine, wing, sea, 80, 1, 0, 1, 1),
    );
  });
  it('cuts only one engine, preserves the other engine and restarts without clearing failures', () => {
    const left = requireValue(spec.engines?.[0]),
      right = requireValue(spec.engines?.[1]);
    const cut = fly({ ...throttle, engines: { [left.id]: { mixture: 0 } } });
    expect(requireValue(cut.state.engines?.[left.id]).thrust).toBe(0);
    expect(requireValue(cut.state.engines?.[left.id]).rpm).toBe(0);
    expect(requireValue(cut.state.engines?.[right.id]).thrust).toBeGreaterThan(0);
    const restart = stepAircraft(cut.transform, cut.state, throttle, spec, 1, {
      groundHeight: () => 0,
    });
    expect(requireValue(restart.state.engines?.[left.id]).thrust).toBeGreaterThan(0);
    const failed = {
      ...cut.state,
      engines: {
        ...cut.state.engines,
        [left.id]: { ...requireValue(cut.state.engines?.[left.id]), failed: true },
      },
    };
    expect(
      stepAircraft(cut.transform, failed, throttle, spec, 1, { groundHeight: () => 0 }).state
        .engines?.[left.id]?.thrust,
    ).toBe(0);
  });
  it('updates per-engine RPM, shaft power and rotor phase deterministically', () => {
    const left = requireValue(spec.engines?.[0]),
      right = requireValue(spec.engines?.[1]);
    const input = {
      ...throttle,
      engines: { [left.id]: { propeller: 0 }, [right.id]: { propeller: 1 } },
    };
    const result = fly(input);
    const a = requireValue(result.state.engines?.[left.id]);
    const b = requireValue(result.state.engines?.[right.id]);
    expect(a.rpm).toBeCloseTo(0.6);
    expect(a.rpm).toBeLessThan(b.rpm);
    expect(a.shaftPower).toBeLessThan(requireValue(b.shaftPower));
    expect(a.rotorAngle).not.toBe(b.rotorAngle);
    expect(result).toEqual(fly(input));
  });
  it('does not invent propeller or mixture controls on jets and fixed-pitch aircraft', () => {
    const fixed = { ...engine, propellerControl: undefined };
    expect(aircraftEngineThrust(fixed, wing, sea, 40, 1, 0, 1, 0)).toBe(
      aircraftEngineThrust(fixed, wing, sea, 40, 1, 0, 1, 1),
    );
    const jet = { ...engine, propulsion: 'jet' as const, dryThrust: 20000 };
    expect(aircraftEngineThrust(jet, wing, sea, 40, 1, 0, 0, 0)).toBe(20000);
  });
  it('cuts the piston helicopter shaft without applying propeller controls to its collective', () => {
    const helicopter = molenAircraft('molen.entities.aircraft.robinson_r44').spec;
    const off = fly({ ...throttle, mixture: 0 }, helicopter);
    expect(off.state.engines?.main?.shaftPower).toBe(0);
    expect(off.state.rpm).toBe(0);
    expect(fly(throttle, helicopter, 480).state.rpm).toBeGreaterThan(0.9);
  });
});
