import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  AircraftInput,
  AircraftState,
  aircraftMounts,
  flyAircraft,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  installAircraft,
  stepAircraft,
} from '../src/aircraft';
import { Transform, type TransformData } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { Mounted, mountEntity, unmountEntity, vehicleRotation } from '../src/vehicles';
import { World } from '../src/world';
import { molenAircraft } from './helpers/entities';

const flat = { groundHeight: () => 0 };
const running: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT, engine: true, power: 1, brake: false };
type TestAircraft = 'p51d' | 'oh6';
const specFor = (kind: TestAircraft): AircraftSpec =>
  molenAircraft(`molen.entities.aircraft.${kind}`).spec;
function setup(kind: TestAircraft) {
  const spec = specFor(kind);
  const w = new World({ tickRate: 60, seed: 'flight' });
  installAircraft(w, flat);
  w.spawnRaw(
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      aircraft: { kind: `molen.entities.aircraft.${kind}`, spec },
      aircraftState: initialAircraftState(),
      aircraftInput: { ...IDLE_AIRCRAFT_INPUT },
      mountable: aircraftMounts(spec),
    },
    'craft',
  );
  w.spawnRaw({ transform: { pos: [1.6, 1.7, 0], rot: [0, 0, 0, 1] } }, 'pilot');
  return w;
}
describe('aircraft flight and mounting', () => {
  it('uses shared weather wind and pressure for airspeed and aerodynamic forces', () => {
    const transform: TransformData = { pos: [0, 1000, 0], rot: [0, 0, 0, 1] };
    const state = {
      ...initialAircraftState(),
      grounded: false,
      velocity: [0, 0, 60] as [number, number, number],
      rpm: 1,
    };
    const spec = specFor('p51d');
    const calm = stepAircraft(transform, state, running, spec, 1 / 60, { ...flat, weather: {} });
    const tailwind = stepAircraft(transform, state, running, spec, 1 / 60, {
      ...flat,
      weather: { atmosphere: { windVelocity: [0, 0, 20] } },
    });
    const thin = stepAircraft(transform, state, running, spec, 1 / 60, {
      ...flat,
      weather: { atmosphere: { pressurePa: 20000 } },
    });
    expect(tailwind.state.airspeed).toBeLessThan(calm.state.airspeed - 15);
    expect(thin.state.velocity).not.toEqual(calm.state.velocity);
  });
  it('requires a takeoff roll, then climbs with rotation and flaps', () => {
    const w = setup('p51d');
    expect(mountEntity(w, 'pilot', 'craft')).toBe(true);
    flyAircraft(w, 'pilot', running);
    w.stepN(300);
    expect(w.get('craft', AircraftState)?.grounded).toBe(true);
    expect(w.get('craft', Transform)?.pos[2]).toBeGreaterThan(5);
    let lifted = false;
    for (let i = 0; i < 2400; i++) {
      const s = w.get('craft', AircraftState);
      if (!s) throw new Error('Aircraft state disappeared');
      flyAircraft(w, 'pilot', {
        ...running,
        flaps: true,
        pitch: s.airspeed > 42 && s.pitch < 0.16 ? 0.4 : 0,
      });
      w.step();
      if ((w.get('craft', Transform)?.pos[1] ?? 0) > 4) {
        lifted = true;
        break;
      }
    }
    expect(lifted).toBe(true);
    expect(w.get('craft', AircraftState)?.crashed).toBe(false);
  });
  it('spools the helicopter before lifting and cyclic produces horizontal flight', () => {
    const w = setup('oh6');
    mountEntity(w, 'pilot', 'craft');
    flyAircraft(w, 'pilot', { ...running, power: 0.56 });
    w.stepN(120);
    expect(w.get('craft', AircraftState)?.grounded).toBe(true);
    w.stepN(600);
    expect(w.get('craft', Transform)?.pos[1]).toBeGreaterThan(5);
    expect(unmountEntity(w, 'pilot', flat)).toBe(false);
    flyAircraft(w, 'pilot', { ...running, power: 0.56, pitch: -0.3 });
    w.stepN(180);
    expect(w.get('craft', Transform)?.pos[2]).toBeGreaterThan(2);
    expect(w.get('craft', AircraftState)?.crashed).toBe(false);
  });
  it('stalls at high incidence and loses lift without engine power', () => {
    const t: TransformData = { pos: [0, 200, 0], rot: vehicleRotation(0, -0.5, 0) };
    const s = {
      ...initialAircraftState(),
      grounded: false,
      pitch: 0.5,
      velocity: [0, 0, 38] as [number, number, number],
    };
    const spec = specFor('p51d');
    expect(stepAircraft(t, s, IDLE_AIRCRAFT_INPUT, spec, 1 / 60, flat).state.stalled).toBe(true);
    // With the stick released the nose drops and the wing unstalls, still sinking.
    const result = stepAircraft(t, s, IDLE_AIRCRAFT_INPUT, spec, 1, flat);
    expect(result.state.velocity[1]).toBeLessThan(0);
    expect(s.velocity).toEqual([0, 0, 38]);
    expect(t.pos[1]).toBe(200);
  });
  it('can hold a near-stationary helicopter hover with trimmed collective', () => {
    let result = {
      transform: { pos: [0, 20, 0], rot: [0, 0, 0, 1] } as TransformData,
      state: { ...initialAircraftState(), grounded: false, rpm: 1 },
    };
    for (let i = 0; i < 600; i++)
      result = stepAircraft(
        result.transform,
        result.state,
        { ...running, power: 0.49 },
        specFor('oh6'),
        1 / 60,
        flat,
      );
    expect(result.state.crashed).toBe(false);
    expect(result.state.grounded).toBe(false);
    expect(Math.abs(result.state.verticalSpeed)).toBeLessThan(0.5);
    expect(Math.abs(result.transform.pos[1] - 20)).toBeLessThan(2);
    expect(result.transform.pos[0]).toBe(0);
    expect(result.transform.pos[2]).toBe(0);
  });
  it('flaps add lift without spuriously reducing the stall angle during rotation', () => {
    const t: TransformData = { pos: [0, 100, 0], rot: vehicleRotation(0, -0.2, 0) };
    const s = {
      ...initialAircraftState(),
      grounded: false,
      pitch: 0.2,
      velocity: [0, 0, 50] as [number, number, number],
    };
    const clean = stepAircraft(t, s, running, specFor('p51d'), 1 / 120, flat);
    const flaps = stepAircraft(t, s, { ...running, flaps: true }, specFor('p51d'), 1 / 120, flat);
    expect(clean.state.stalled).toBe(false);
    expect(flaps.state.stalled).toBe(false);
    expect(flaps.state.velocity[1]).toBeGreaterThan(clean.state.velocity[1]);
  });
  it('pauses at terrain gaps, catches impacts, and rejects dangerous exits', () => {
    const t: TransformData = { pos: [0, 30, 0], rot: [0, 0, 0, 1] };
    const s = {
      ...initialAircraftState(),
      grounded: false,
      velocity: [0, -7, 50] as [number, number, number],
    };
    const gap = stepAircraft(t, s, running, specFor('p51d'), 1 / 60, {
      groundHeight: () => undefined,
    });
    expect(gap.transform).toEqual(t);
    expect(gap.state.velocity).toEqual(s.velocity);
    expect(gap.state.waitingForTerrain).toBe(true);
    const hit = stepAircraft(t, s, running, specFor('p51d'), 1 / 60, {
      ...flat,
      canOccupy: () => false,
    });
    expect(hit.state.crashed).toBe(true);
    expect(hit.state.velocity).toEqual([0, 0, 0]);
    const landing = stepAircraft(
      { ...t, pos: [0, 0.02, 0] },
      s,
      running,
      specFor('p51d'),
      1 / 60,
      flat,
    );
    expect(landing.state.crashed).toBe(true);
    const w = setup('oh6');
    mountEntity(w, 'pilot', 'craft');
    w.patch('craft', AircraftState, { rpm: 0.8 });
    expect(unmountEntity(w, 'pilot', flat)).toBe(false);
    w.patch('craft', AircraftState, { rpm: 0 });
    expect(unmountEntity(w, 'pilot', { ...flat, canExit: () => false })).toBe(false);
    expect(unmountEntity(w, 'pilot', flat)).toBe(true);
    expect(w.has('pilot', Mounted)).toBe(false);
  });
  it.each([
    'p51d',
    'oh6',
  ] as const)('restores %s flight, control, rotor phase, and pilot state exactly', (kind) => {
    const a = setup(kind);
    mountEntity(a, 'pilot', 'craft');
    a.patch('craft', Transform, { pos: [0, 1000, 0] });
    a.patch('craft', AircraftState, { grounded: false, velocity: [0, 0, 60], rpm: 1 });
    flyAircraft(a, 'pilot', { ...running, power: 0.58 });
    a.stepN(450);
    const b = setup(kind);
    applyKeyframeTo(b, takeKeyframe(a));
    a.stepN(120);
    b.stepN(120);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(flyAircraft(a, 'nobody', running)).toBe(false);
    expect(flyAircraft(a, 'pilot', { ...running, power: Number.NaN })).toBe(false);
    expect(a.get('craft', AircraftInput)?.power).toBe(0.58);
  });
  it('lands gently without damage and brakes the Mustang to a stop', () => {
    let result = {
      transform: { pos: [0, 0.01, 0], rot: [0, 0, 0, 1] } as TransformData,
      state: {
        ...initialAircraftState(),
        grounded: false,
        velocity: [0, -0.8, 35] as [number, number, number],
      },
    };
    for (let i = 0; i < 600; i++)
      result = stepAircraft(
        result.transform,
        result.state,
        IDLE_AIRCRAFT_INPUT,
        specFor('p51d'),
        1 / 60,
        flat,
      );
    expect(result.state.grounded).toBe(true);
    expect(result.state.crashed).toBe(false);
    expect(result.state.velocity).toEqual([0, 0, 0]);
    expect(result.transform.pos[1]).toBe(0);
  });
});
describe('landing gear and flap travel', () => {
  const p51 = specFor('p51d');
  const level: TransformData = { pos: [0, 800, 0], rot: [0, 0, 0, 1] };
  const cruising = (fields: Partial<AircraftStateData> = {}): AircraftStateData => ({
    ...initialAircraftState(),
    grounded: false,
    velocity: [0, 0, 70],
    airspeed: 70,
    rpm: 1,
    ...fields,
  });
  function fly(
    seconds: number,
    input: AircraftInputData,
    transform: TransformData,
    state: AircraftStateData,
  ) {
    let result = { transform, state };
    for (let i = 0; i < seconds * 60; i++)
      result = stepAircraft(result.transform, result.state, input, p51, 1 / 60, flat);
    return result;
  }

  it('moves the gear over gearTransitTime and the flaps over flapTransitTime', () => {
    const gearTime = p51.airplane?.gearTransitTime ?? 0;
    const flapTime = p51.airplane?.flapTransitTime ?? 0;
    expect(gearTime).toBeGreaterThan(0);
    const input = { ...running, power: 0.7, gear: false, flaps: true };
    const start = cruising({ gearPosition: 1, flapPosition: 0 });
    const second = fly(1, input, level, start);
    expect(second.state.gearPosition).toBeCloseTo(1 - 1 / gearTime, 9);
    expect(second.state.flapPosition).toBeCloseTo(1 / flapTime, 9);
    const done = fly(Math.max(gearTime, flapTime), input, second.transform, second.state);
    expect(done.state.gearPosition).toBe(0);
    expect(done.state.flapPosition).toBe(1);
  });

  it('starts a state without positions at the selection, as the instant gear did', () => {
    const result = stepAircraft(
      level,
      cruising(),
      { ...running, gear: false, flaps: true },
      p51,
      1 / 60,
      flat,
    );
    expect(result.state.gearPosition).toBe(0);
    expect(result.state.flapPosition).toBe(1);
  });

  it('scales gear drag with the gear position', () => {
    const speedWith = (gearPosition: number) =>
      stepAircraft(level, cruising({ gearPosition }), { ...running, power: 0 }, p51, 1 / 60, flat)
        .state.velocity[2];
    const up = speedWith(0),
      half = speedWith(0.5),
      down = speedWith(1);
    expect(up).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(down);
    expect(half - down).toBeCloseTo(up - half, 3);
  });

  it('holds the gear down while the wheels carry weight, then raises it after liftoff', () => {
    const parked = { ...initialAircraftState(), gearPosition: 1 };
    const onGround = fly(
      1,
      { ...running, brake: true, gear: false },
      { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      parked,
    );
    expect(onGround.state.grounded).toBe(true);
    expect(onGround.state.crashed).toBe(false);
    expect(onGround.state.gearPosition).toBe(1);
    const airborne = fly(
      1,
      { ...running, power: 0.7, gear: false },
      level,
      cruising({ gearPosition: 1 }),
    );
    expect(airborne.state.gearPosition).toBeLessThan(1);
  });

  it('belly-lands when the wheels touch before the gear locks down', () => {
    const touchdown = (gearPosition: number) =>
      fly(
        0.5,
        { ...running, power: 0.3, gear: true },
        { pos: [0, 0.2, 0], rot: [0, 0, 0, 1] },
        cruising({ gearPosition, velocity: [0, -1, 40], airspeed: 40 }),
      ).state;
    expect(touchdown(1).crashed).toBe(false);
    expect(touchdown(0.5).crashed).toBe(true);
  });

  it('keeps stepping a parked airplane until its flaps reach the selection', () => {
    const w = setup('p51d');
    w.stepN(2);
    expect(w.get('craft', AircraftState)?.gearPosition).toBe(1);
    expect(w.get('craft', AircraftState)?.flapPosition).toBe(0);
    w.patch('craft', AircraftInput, { flaps: true });
    w.stepN(60);
    const flapTime = p51.airplane?.flapTransitTime ?? 0;
    expect(w.get('craft', AircraftState)?.flapPosition).toBeCloseTo(1 / flapTime, 9);
    w.stepN(60 * flapTime);
    const settled = w.get('craft', AircraftState);
    expect(settled?.flapPosition).toBe(1);
    w.stepN(10);
    // Engine off, stopped and settled: the solver no longer touches the state.
    expect(w.get('craft', AircraftState)).toBe(settled);
  });
});
