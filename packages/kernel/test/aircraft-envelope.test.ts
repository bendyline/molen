import { describe, expect, it } from 'vitest';
import {
  aircraftEngineThrust,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  stepAircraft,
} from '../src/aircraft';
import {
  aircraftDragCoefficient,
  engineThrottle,
  freeRotationRates,
} from '../src/flight-aerodynamics';
import { vehicleRotation } from '../src/vehicles';
import { sampleAtmosphere } from '../src/weather';
import { molenAircraft } from './helpers/entities';

const f14 = molenAircraft('molen.entities.aircraft.f_14d').spec;
const f16 = molenAircraft('molen.entities.aircraft.f_16b').spec;
const cessna = molenAircraft('molen.entities.aircraft.cessna_172s').spec;
const sea = sampleAtmosphere({});

describe('physical flight envelope', () => {
  it('uses transport-scale inertia for the airliner after losing one engine', () => {
    const airliner = molenAircraft('molen.entities.aircraft.airliner').spec;
    const result = stepAircraft(
      { pos: [0, 2000, 0], rot: [0, 0, 0, 1] },
      { ...initialAircraftState(), grounded: false, rpm: 1, velocity: [0, 0, 100] },
      {
        ...IDLE_AIRCRAFT_INPUT,
        engine: true,
        power: 1,
        gear: false,
        engines: { left: { enabled: false } },
      },
      airliner,
      1,
      { groundHeight: () => 0 },
    ).state;
    expect(Math.abs(result.yawRate ?? 0)).toBeGreaterThan(0.01);
    expect(Math.abs(result.yawRate ?? 0)).toBeLessThan(0.2);
  });
  it('governs rotor RPM separately from collective and reduces blade speed margin at altitude', () => {
    const rotor = molenAircraft('molen.entities.aircraft.oh6').spec;
    const sample = (altitude: number) =>
      stepAircraft(
        { pos: [0, altitude, 0], rot: [0, 0, 0, 1] },
        { ...initialAircraftState(), grounded: false, rpm: 1, velocity: [0, 0, 60] },
        { ...IDLE_AIRCRAFT_INPUT, engine: true, power: 0.2 },
        rotor,
        1 / 120,
        { groundHeight: () => -10000 },
      ).state;
    expect(sample(0).rpm).toBe(1);
    expect(sample(0).overspeed).toBe(false);
    expect(sample(5000).overspeed).toBe(true);
  });
  it('limits rotor lift by installed power instead of allowing payload to create free power', () => {
    const rotor = molenAircraft('molen.entities.aircraft.oh6').spec;
    const sample = (mass: number, climb = 0) =>
      stepAircraft(
        { pos: [0, 1000, 0], rot: [0, 0, 0, 1] },
        { ...initialAircraftState(), grounded: false, rpm: 1, velocity: [0, climb, 0] },
        { ...IDLE_AIRCRAFT_INPUT, engine: true, power: 1 },
        { ...rotor, mass },
        1 / 60,
        { groundHeight: () => 0 },
      ).state.velocity[1];
    expect(sample(rotor.mass)).toBeGreaterThan(0);
    expect(sample(rotor.mass * 3)).toBeLessThan(0);
    expect(sample(rotor.mass, 15) - 15).toBeLessThan(sample(rotor.mass));
  });
  it('models rotor vortex-ring onset in powered slow descent and relief with forward airspeed', () => {
    const rotor = molenAircraft('molen.entities.aircraft.oh6').spec;
    const sample = (horizontal: number) =>
      stepAircraft(
        { pos: [0, 1000, 0], rot: [0, 0, 0, 1] },
        { ...initialAircraftState(), grounded: false, rpm: 1, velocity: [0, -9, horizontal] },
        { ...IDLE_AIRCRAFT_INPUT, engine: true, power: 0.7 },
        rotor,
        1 / 120,
        { groundHeight: () => 0 },
      ).state;
    expect(sample(0).vortexRing).toBeGreaterThan(0.1);
    expect(sample(40).vortexRing).toBe(0);
    expect(sample(100).overspeed).toBe(true);
  });
  it('distinguishes dry jet thrust, afterburning thrust, altitude lapse, and shaft power', () => {
    const jet = f16.engines?.[0],
      wing = f16.airplane;
    const prop = cessna.engines?.[0],
      propWing = cessna.airplane;
    if (!jet || !wing || !prop || !propWing) throw Error('Missing fleet fixture');
    expect(aircraftEngineThrust(jet, wing, sea, 0, 0.85)).toBeCloseTo(jet.dryThrust ?? 0, -1);
    expect(aircraftEngineThrust(jet, wing, sea, 0, 1)).toBeCloseTo(jet.afterburnerThrust ?? 0, -1);
    expect(aircraftEngineThrust(jet, wing, sampleAtmosphere({}, 11000), 0)).toBeLessThan(
      aircraftEngineThrust(jet, wing, sea, 0),
    );
    expect(engineThrottle(jet, 0.85).afterburner).toBe(0);
    expect(engineThrottle(jet, 1).afterburner).toBe(1);
    expect(aircraftEngineThrust(prop, propWing, sea, 100) * 100).toBeLessThanOrEqual(prop.power);
    expect(aircraftEngineThrust(prop, propWing, sampleAtmosphere({}, 3000), 60)).toBeLessThan(
      aircraftEngineThrust(prop, propWing, sea, 60),
    );
    expect(
      aircraftEngineThrust(jet, wing, sampleAtmosphere({ atmosphere: { pressurePa: 0 } }), 100),
    ).toBe(0);
  });
  it('spools reheat and removes augmented thrust on a failed engine', () => {
    let state = {
      ...initialAircraftState(),
      grounded: false,
      rpm: 1,
      velocity: [0, 0, 250] as [number, number, number],
    };
    let transform = {
      pos: [0, 3000, 0] as [number, number, number],
      rot: vehicleRotation(0, 0, 0),
    };
    const input = { ...IDLE_AIRCRAFT_INPUT, power: 1, engine: true, gear: false, brake: false };
    ({ state, transform } = stepAircraft(transform, state, input, f16, 1 / 60, {
      groundHeight: () => 0,
    }));
    const id = f16.engines?.[0]?.id;
    if (!id || !state.engines?.[id]) throw Error('Missing engine state');
    expect(state.engines[id].afterburner).toBeGreaterThan(0);
    expect(state.engines[id].afterburner).toBeLessThan(0.1);
    state.engines[id].failed = true;
    const failed = stepAircraft(transform, state, input, f16, 1 / 60, {
      groundHeight: () => 0,
    }).state;
    expect(failed.engines?.[id]?.thrust).toBe(0);
    expect(failed.engines?.[id]?.afterburner).toBe(0);
  });
  it('adds continuous wave, flap and gear drag and reduces induced drag in ground effect', () => {
    const w = f16.airplane;
    if (!w) throw Error('Missing wing');
    const drag = (mach: number, gear = 0, flaps = 0, height = 100) =>
      aircraftDragCoefficient(w, 0.7, mach, gear, flaps, 0, 0, height);
    expect(drag(1)).toBeGreaterThan(drag(0.6));
    expect(Math.abs(drag(0.85 + 1e-6) - drag(0.85 - 1e-6))).toBeLessThan(1e-8);
    expect(drag(0.6, 1)).toBeGreaterThan(drag(0.6));
    expect(drag(0.6, 0, 0.5)).toBeGreaterThan(drag(0.6));
    expect(drag(0.6, 0, 0, 0.02)).toBeLessThan(drag(0.6));
  });
  it('preserves torque-free angular energy and momentum through sustained rapid rotations', () => {
    const inertia: [number, number, number] = [40000, 100000, 12000];
    let rates: [number, number, number] = [2, 3, 0.1];
    const energy = (r: number[]) => r.reduce((sum, v, i) => sum + (inertia[i] ?? 0) * v * v, 0);
    const momentum = (r: number[]) =>
      r.reduce((sum, v, i) => sum + ((inertia[i] ?? 0) * v) ** 2, 0);
    const initialEnergy = energy(rates),
      initialMomentum = momentum(rates);
    for (let i = 0; i < 120 * 30; i++) rates = freeRotationRates(rates, inertia, 1 / 120);
    expect(energy(rates) / initialEnergy).toBeCloseTo(1, 8);
    expect(momentum(rates) / initialMomentum).toBeCloseTo(1, 8);
  });
  it.each([
    -1, 1,
  ])('sustains a finite flat spin in either direction (%s) without invented yaw', (sign) => {
    let state = {
      ...initialAircraftState(),
      grounded: false,
      velocity: [0, -60, 8] as [number, number, number],
      yawRate: sign,
    };
    let transform = {
      pos: [0, 6000, 0] as [number, number, number],
      rot: vehicleRotation(0, 0, 0),
    };
    for (let i = 0; i < 30 * 30; i++)
      ({ state, transform } = stepAircraft(
        transform,
        state,
        { ...IDLE_AIRCRAFT_INPUT, gear: false, brake: false },
        f14,
        1 / 30,
        { groundHeight: () => -10000 },
      ));
    expect(state.velocity.every(Number.isFinite)).toBe(true);
    expect((state.yawRate ?? 0) * sign).toBeGreaterThan(2);
    expect(Math.abs(state.yawRate ?? 0)).toBeLessThan(4);
    expect(state.angleOfAttack).toBeGreaterThan(1.3);
    expect(Math.abs(state.pitch)).toBeLessThan(0.2);
    expect(state.departure).toBe(1);
    expect(state.velocity[1]).toBeLessThan(-50);
  });
  it('does not force a symmetric stall to spin and preserves pilot recovery before full departure', () => {
    const start = {
      ...initialAircraftState(),
      grounded: false,
      pitch: 0.45,
      velocity: [0, 0, 100] as [number, number, number],
    };
    const transform = {
      pos: [0, 5000, 0] as [number, number, number],
      rot: vehicleRotation(0, -0.45, 0),
    };
    const result = stepAircraft(
      transform,
      start,
      { ...IDLE_AIRCRAFT_INPUT, gear: false, brake: false, pitch: -1 },
      f14,
      0.5,
      { groundHeight: () => 0 },
    );
    expect(result.state.yawRate).toBe(0);
    expect(result.state.angleOfAttack).toBeLessThan(0.45);
  });
  it('flags surface overspeed and supports partial flaps without clamping the airspeed', () => {
    const state = {
      ...initialAircraftState(),
      grounded: false,
      rpm: 1,
      velocity: [0, 0, 220] as [number, number, number],
      flapPosition: 0,
    };
    const result = stepAircraft(
      { pos: [0, 1000, 0], rot: [0, 0, 0, 1] },
      state,
      { ...IDLE_AIRCRAFT_INPUT, flaps: 0.5, gear: true },
      f16,
      0.5,
      { groundHeight: () => 0 },
    ).state;
    expect(result.flapPosition).toBeGreaterThan(0);
    expect(result.flapPosition).toBeLessThan(0.5);
    expect(result.overspeed).toBe(true);
    expect(result.airspeed).toBeGreaterThan(f16.airplane?.flapLimitSpeed ?? 0);
  });
});
