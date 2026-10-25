import type { AircraftInputData, AircraftSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { IDLE_AIRCRAFT_INPUT, initialAircraftState, stepAircraft } from '../src/aircraft';
import type { TransformData } from '../src/component';
import { molenAircraft } from './helpers/entities';

const flat = { groundHeight: () => 0 };
const input: AircraftInputData = {
  ...IDLE_AIRCRAFT_INPUT,
  engine: true,
  power: 1,
  brake: false,
  thrustVector: 1,
};
function run(spec: AircraftSpec, seconds: number, controls = input, airborne = false) {
  let transform: TransformData = { pos: [0, airborne ? 100 : 0, 0], rot: [0, 0, 0, 1] };
  let state = { ...initialAircraftState(), grounded: !airborne, rpm: 1, thrustVectorPosition: 1 };
  for (let tick = 0; tick < seconds * 60; tick++) {
    const result = stepAircraft(transform, state, controls, spec, 1 / 60, flat);
    transform = result.transform;
    state = { ...result.state, thrustVectorPosition: result.state.thrustVectorPosition ?? 0 };
  }
  return { transform, state };
}

describe.each(['mv_22b', 'av_8b'])('%s powered lift', (kind) => {
  const spec = molenAircraft(`molen.entities.aircraft.${kind}`).spec;
  it('takes off vertically with no runway speed and stays finite', () => {
    const result = run(spec, 5);
    expect(result.state.crashed).toBe(false);
    expect(result.transform.pos[1]).toBeGreaterThan(5);
    expect(Math.abs(result.transform.pos[2])).toBeLessThan(0.1);
    expect(result.state.grounded).toBe(false);
    expect(
      [...result.transform.pos, ...result.transform.rot, ...result.state.velocity].every(
        Number.isFinite,
      ),
    ).toBe(true);
  });
  it('moves the actuator over time and redirects thrust during conversion', () => {
    const start = { ...initialAircraftState(), grounded: false, rpm: 1, thrustVectorPosition: 0 };
    const result = stepAircraft(
      { pos: [0, 100, 0], rot: [0, 0, 0, 1] },
      start,
      input,
      spec,
      0.1,
      flat,
    );
    expect(result.state.thrustVectorPosition).toBeCloseTo(
      0.1 / (spec.poweredLift?.transitTime ?? 1),
      7,
    );
    expect(result.state.velocity[2]).toBeGreaterThan(0);
    expect(result.state.velocity[1]).toBeLessThan(0);
  });
  it('has powered pitch, roll and yaw control at zero airspeed', () => {
    for (const axis of ['pitch', 'roll', 'yaw'] as const) {
      const result = run(spec, 0.5, { ...input, [axis]: 0.3 }, true);
      expect(Math.abs(result.state[`${axis}Rate`] ?? 0)).toBeGreaterThan(0.01);
    }
  });
  it('cannot hover or command reaction controls with the engine stopped', () => {
    const neutral = run(spec, 0.5, { ...input, engine: false, power: 0 }, true);
    const stick = run(spec, 0.5, { ...input, engine: false, power: 0, roll: 1 }, true);
    expect(stick.state.velocity[1]).toBeLessThan(-4);
    // Ordinary aerodynamic controls may act as the falling aircraft gains speed.
    expect(Math.abs(stick.state.rollRate - neutral.state.rollRate)).toBeLessThan(0.05);
  });
  it('reproduces the same transition exactly', () => {
    const controls = { ...input, thrustVector: 0.5 };
    expect(run(spec, 2, controls, true)).toEqual(run(spec, 2, controls, true));
  });
});

it('an Osprey engine failure produces roll from off-center vertical thrust', () => {
  const spec = molenAircraft('molen.entities.aircraft.mv_22b').spec;
  const state = {
    ...initialAircraftState(),
    grounded: false,
    rpm: 1,
    thrustVectorPosition: 1,
    engines: {
      'engine-1': { rpm: 1, rotorAngle: 0, failed: true, thrust: 0 },
      'engine-2': { rpm: 1, rotorAngle: 0, failed: false, thrust: 0 },
    },
  };
  const result = stepAircraft(
    { pos: [0, 100, 0], rot: [0, 0, 0, 1] },
    state,
    input,
    spec,
    0.1,
    flat,
  );
  expect(Math.abs(result.state.rollRate)).toBeGreaterThan(0.1);
  expect(result.state.engines?.['engine-1']?.thrust).toBe(0);
});

it('a fixed-undercarriage Cherokee ignores gear-up selection in flight', () => {
  const spec = molenAircraft('molen.entities.aircraft.pa_28_180').spec;
  const result = run(spec, 1, { ...input, gear: false, thrustVector: 0 }, true);
  expect(result.state.gearPosition).toBe(1);
});
