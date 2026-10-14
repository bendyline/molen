import type {
  AircraftInputData,
  AircraftSpec,
  AircraftStateData,
  WeatherData,
} from '@bendyline/molen-schema';
import { weatherProfile } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  type AircraftEnvironment,
  AircraftState,
  aircraftMounts,
  flyAircraft,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  installAircraft,
  levelFlightAngleOfAttack,
  stepAircraft,
} from '../src/aircraft';
import { Transform, type TransformData } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { mountEntity, vehicleLocalPoint, vehicleRotation } from '../src/vehicles';
import { Weather } from '../src/weather';
import { World } from '../src/world';
import { molenAircraft } from './helpers/entities';

const mustang = molenAircraft('molen.entities.aircraft.p51d').spec;
if (!mustang.airplane) throw new Error('Missing Mustang fixture');
const still: AircraftSpec = { ...mustang, airplane: { ...mustang.airplane, propellerEffects: 0 } };
const flat = { groundHeight: () => 0 };
const clean: AircraftInputData = {
  ...IDLE_AIRCRAFT_INPUT,
  engine: true,
  power: 1,
  brake: false,
  gear: false,
};
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
type Flight = { transform: TransformData; state: AircraftStateData };
function airborne(speed: number, overrides: Partial<AircraftStateData> = {}): Flight {
  const state = {
    ...initialAircraftState(),
    grounded: false,
    rpm: 1,
    velocity: [0, 0, speed] as [number, number, number],
    ...overrides,
  };
  return {
    transform: { pos: [0, 1500, 0], rot: vehicleRotation(state.yaw, -state.pitch, state.roll) },
    state,
  };
}
function parked(): Flight {
  return {
    transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
    state: { ...initialAircraftState(), rpm: 1 },
  };
}
/** Fly at `hz`, handing the host clock to the solver like installAircraft does. */
function fly(
  seconds: number,
  controls: (state: AircraftStateData, time: number) => AircraftInputData,
  start: Flight,
  { spec = still, env = flat as AircraftEnvironment, hz = 60, watch = (_: Flight) => {} } = {},
): Flight {
  let result = start;
  for (let tick = 0; tick < Math.round(seconds * hz); tick++) {
    result = stepAircraft(
      result.transform,
      result.state,
      controls(result.state, tick / hz),
      spec,
      1 / hz,
      { ...env, time: tick / hz },
    );
    watch(result);
  }
  return result;
}
const axes = (t: TransformData) => ({
  forward: vehicleLocalPoint({ pos: [0, 0, 0], rot: t.rot }, [0, 0, 1]),
  up: vehicleLocalPoint({ pos: [0, 0, 0], rot: t.rot }, [0, 1, 0]),
});

describe('rigid-body airplane dynamics', () => {
  it('rolls through inverted on full aileron with no bank limit', () => {
    let rolled = 0;
    let inverted = false;
    fly(5, () => ({ ...clean, roll: 1 }), airborne(120), {
      watch: (r) => {
        rolled += r.state.rollRate / 60;
        inverted ||= axes(r.transform).up[1] < -0.95;
      },
    });
    expect(inverted).toBe(true);
    // A P-51 rolls at roughly 90 degrees a second at this speed.
    expect(rolled).toBeGreaterThan(2 * Math.PI);
  });

  it('pulls a loop over the top on sustained back stick', () => {
    let vertical = false;
    let invertedAtTop = false;
    let peakLoad = 0;
    const result = fly(12, () => ({ ...clean, pitch: 1 }), airborne(150), {
      watch: (r) => {
        const { forward, up } = axes(r.transform);
        vertical ||= forward[1] > 0.97;
        invertedAtTop ||= vertical && up[1] < -0.95;
        peakLoad = Math.max(peakLoad, r.state.loadFactor ?? 0);
      },
    });
    expect(vertical).toBe(true);
    expect(invertedAtTop).toBe(true);
    expect(result.state.crashed).toBe(false);
    // The elevator stops at the authored load factor instead of over-stressing the airframe.
    expect(peakLoad).toBeGreaterThan(5);
    expect(peakLoad).toBeLessThan((mustang.airplane?.maxLoadFactor ?? 6) + 0.5);
  });

  it('holds the flight path hands-off after a brief pull', () => {
    const angle = (r: Flight) => Math.atan2(r.state.velocity[1], r.state.velocity[2]);
    const pulled = fly(
      3,
      (_s, time) => ({ ...clean, power: 0.7, pitch: time < 0.6 ? 1 : 0 }),
      airborne(100),
    );
    const later = fly(5, () => ({ ...clean, power: 0.7 }), pulled);
    expect(angle(pulled)).toBeGreaterThan(0.04);
    expect(Math.abs(angle(later) - angle(pulled))).toBeLessThan(0.02);
  });

  it('launches trimmed for level flight at the level-flight angle of attack', () => {
    const alpha = levelFlightAngleOfAttack(still, 80);
    const start = airborne(80, { pitch: alpha, pitchTrim: alpha });
    const result = fly(5, () => ({ ...clean, power: 0.6 }), start);
    expect(alpha).toBeGreaterThan(0);
    expect(Math.abs(result.transform.pos[1] - 1500)).toBeLessThan(5);
  });

  it('swings left on the takeoff roll with propeller effects, and right rudder holds it', () => {
    const roll = (rudder: number, spec = mustang) =>
      fly(14, (s) => ({ ...clean, gear: true, yaw: clamp(s.yaw * rudder) }), parked(), { spec })
        .state.yaw;
    const swing = roll(0);
    expect(swing).toBeGreaterThan(0.02);
    expect(Math.abs(roll(0, still))).toBeLessThan(1e-9);
    // Right pedal in proportion to the swing keeps the nose near the centerline.
    expect(Math.abs(roll(5))).toBeLessThan(swing / 2);
  });

  it('weathervanes into a crosswind on the ground and crabs into it once flying', () => {
    // At heading zero +X is the pilot's left: this wind blows from the left.
    const env = { ...flat, weather: { atmosphere: { windVelocity: [-6, 0, 0] } } as WeatherData };
    const takeoff = (state: AircraftStateData): AircraftInputData => ({
      ...clean,
      gear: true,
      flaps: true,
      pitch: state.grounded && state.airspeed > 42 ? 1 : 0,
      roll: clamp(-state.roll * 2 - state.rollRate * 0.5),
    });
    let rollingHeading = 0;
    const result = fly(25, takeoff, parked(), {
      env,
      watch: (r) => {
        if (r.state.grounded) rollingHeading = r.state.yaw;
      },
    });
    expect(rollingHeading).toBeGreaterThan(0.05);
    expect(result.state.grounded).toBe(false);
    expect(result.state.yaw).toBeGreaterThan(0.05);
    expect(Math.abs(result.state.sideslip ?? 1)).toBeLessThan(0.05);
  });

  it('bumps through turbulence identically at 30, 60 and 120 Hz', () => {
    const env = { ...flat, weather: weatherProfile('rain') };
    const loads: number[] = [];
    const runs = [30, 60, 120].map((hz) =>
      // Below 120 m/s every host rate substeps at 1/120 s, on the same clock.
      fly(10, () => ({ ...clean, power: 0.7 }), airborne(90), {
        env,
        hz,
        watch: (r) => {
          if (hz === 60) loads.push(r.state.loadFactor ?? 1);
        },
      }),
    );
    const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const spread = Math.sqrt(
      loads.reduce((sum, load) => sum + (load - mean) ** 2, 0) / loads.length,
    );
    expect(spread).toBeGreaterThan(0.03);
    for (const result of runs.slice(1))
      for (const axis of [0, 1, 2] as const)
        expect(result.transform.pos[axis]).toBeCloseTo(runs[0]?.transform.pos[axis] ?? 0, 6);
  });

  it('replays turbulence from a keyframe using the world clock', () => {
    const world = () => {
      const w = new World({ tickRate: 60, seed: 'gusty' });
      installAircraft(w, flat);
      w.spawnRaw({ weather: weatherProfile('rain') }, 'weather');
      w.spawnRaw(
        {
          transform: { pos: [0, 800, 0], rot: [0, 0, 0, 1] },
          aircraft: { kind: 'molen.entities.aircraft.p51d', spec: mustang },
          aircraftState: {
            ...initialAircraftState(),
            grounded: false,
            rpm: 1,
            velocity: [0, 0, 100],
          },
          aircraftInput: { ...clean, power: 0.7 },
          mountable: aircraftMounts(mustang),
        },
        'craft',
      );
      w.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'pilot');
      return w;
    };
    const a = world();
    expect(a.has('weather', Weather)).toBe(true);
    a.stepN(90);
    const b = world();
    applyKeyframeTo(b, takeKeyframe(a));
    a.stepN(120);
    b.stepN(120);
    expect(stateHash(a)).toBe(stateHash(b));
    const calm = world();
    calm.destroy('weather');
    calm.stepN(210);
    expect(calm.get('craft', Transform)?.pos).not.toEqual(a.get('craft', Transform)?.pos);
    expect(mountEntity(a, 'pilot', 'craft')).toBe(false);
    expect(flyAircraft(a, 'pilot', clean)).toBe(false);
    expect(a.get('craft', AircraftState)?.crashed).toBe(false);
  });

  it('feels gusts across the span as roll', () => {
    const env = { ...flat, weather: weatherProfile('rain') };
    let maxRoll = 0;
    fly(20, () => ({ ...clean, power: 0.7 }), airborne(110), {
      env,
      watch: (r) => {
        maxRoll = Math.max(maxRoll, Math.abs(r.state.roll));
      },
    });
    expect(maxRoll).toBeGreaterThan(0.02);
  });
});
