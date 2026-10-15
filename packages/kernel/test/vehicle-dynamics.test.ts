import type { VehicleSpec, WeatherData } from '@bendyline/molen-schema';
import { weatherProfile } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { Transform, type TransformData } from '../src/component';
import {
  initialVehicleState,
  installVehicles,
  mountEntity,
  stepVehicle,
  type VehicleEnvironment,
  VehicleInput,
  type VehicleInputData,
  type VehicleStateData,
  vehicleMounts,
  vehicleRotation,
  weatherGrip,
} from '../src/vehicles';
import { World } from '../src/world';
import { molenVehicle } from './helpers/entities';

const sedan = molenVehicle('molen.entities.vehicle.sedan').spec;
const pickup = molenVehicle('molen.entities.vehicle.pickup').spec;
const flat: VehicleEnvironment = { groundHeight: () => 0 };
type Drive = { transform: TransformData; state: VehicleStateData; impact: number };
function rolling(speed: number): Drive {
  return {
    transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
    state: { ...initialVehicleState(), speed },
    impact: 0,
  };
}
function drive(
  seconds: number,
  controls: (state: VehicleStateData, time: number) => VehicleInputData,
  start: Drive,
  { spec = sedan, env = flat, hz = 60, watch = (_: Drive) => {} } = {},
): Drive {
  let result = start;
  for (let tick = 0; tick < Math.round(seconds * hz); tick++) {
    result = stepVehicle(
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
const hold =
  (speed: number, steering: number, extra: Partial<VehicleInputData> = {}) =>
  (state: VehicleStateData): VehicleInputData => ({
    throttle: state.speed < speed ? 0.6 : 0,
    steering,
    brake: false,
    ...extra,
  });
/** Distance to stop from 100 km/h on the service brakes. */
const stopping = (env: VehicleEnvironment) =>
  drive(10, () => ({ throttle: 0, steering: 0, brake: true }), rolling(27.8), { env }).transform
    .pos[2];

describe('car tire and chassis dynamics', () => {
  it('corners up to the grip limit, then slides wide instead of turning tighter', () => {
    let peak = 0;
    let skid = 0;
    drive(4, hold(15, 1), rolling(15), {
      watch: (r) => {
        peak = Math.max(peak, Math.abs(r.state.speed * (r.state.yawRate ?? 0)));
        skid = Math.max(skid, r.state.skid ?? 0);
      },
    });
    // The sedan's tires hold 8 m/s² of cornering; speed times yaw rate briefly overshoots it.
    expect(peak).toBeGreaterThan(6);
    expect(peak).toBeLessThan(sedan.grip * 1.2);
    expect(skid).toBeGreaterThan(0.5);
  });

  it('changes lanes on a keyboard tap at highway speed without spinning', () => {
    const result = drive(
      3,
      (state, time) => hold(30, time < 0.4 ? 1 : time < 0.8 ? -1 : 0)(state),
      rolling(30),
    );
    expect(Math.abs(result.state.yaw)).toBeLessThan(0.05);
    expect(Math.abs(result.state.lateralSpeed ?? 1)).toBeLessThan(0.05);
    expect(result.transform.pos[0]).toBeLessThan(-1);
  });

  it('swings the tail round on the handbrake', () => {
    const turn = (handbrake: boolean) =>
      drive(
        1.5,
        (_s, time) => ({
          throttle: 0,
          steering: 1,
          brake: false,
          handbrake: handbrake && time < 1,
        }),
        rolling(15),
      ).state.yaw;
    expect(Math.abs(turn(true))).toBeGreaterThan(1.2);
    expect(Math.abs(turn(true))).toBeGreaterThan(Math.abs(turn(false)) * 1.5);
  });

  it('spins a rear-drive pickup on power but not a front-drive sedan', () => {
    const spin = (spec: VehicleSpec) =>
      Math.abs(
        drive(2.5, () => ({ throttle: 1, steering: 1, brake: false }), rolling(12), { spec }).state
          .yaw,
      );
    expect(pickup.drive).toBe('rear');
    expect(spin(pickup)).toBeGreaterThan(2);
    expect(spin(sedan)).toBeLessThan(1.6);
  });

  it('loses grip in rain and much more in snow', () => {
    const weather = (data: WeatherData) => ({ ...flat, weather: data });
    expect(weatherGrip(undefined)).toBe(1);
    expect(weatherGrip(weatherProfile('sunny'))).toBe(1);
    expect(weatherGrip(weatherProfile('rain'))).toBeCloseTo(0.7, 6);
    expect(weatherGrip(weatherProfile('snow'))).toBeLessThan(0.45);
    const dry = stopping(flat);
    // About 40 m from 100 km/h, like a real sedan on dry asphalt.
    expect(dry).toBeGreaterThan(35);
    expect(dry).toBeLessThan(43);
    expect(stopping(weather(weatherProfile('rain')))).toBeGreaterThan(dry * 1.25);
    expect(stopping(weather(weatherProfile('snow')))).toBeGreaterThan(dry * 1.8);
  });

  it('dives under braking, rolls out of a turn and settles on its springs', () => {
    let dive = 0;
    const braked = drive(3, () => ({ throttle: 0, steering: 0, brake: true }), rolling(20), {
      watch: (r) => {
        dive = Math.max(dive, r.state.bodyPitch ?? 0);
      },
    });
    expect(dive).toBeGreaterThan(0.01);
    expect(Math.abs(braked.state.bodyPitch ?? 1)).toBeLessThan(0.003);
    const turning = drive(2, hold(15, 1), rolling(15));
    // Turning right leans the body out to the left: left side down is negative roll.
    expect(turning.state.bodyRoll ?? 0).toBeLessThan(-0.02);
    const leaned = vehicleRotation(
      turning.state.yaw,
      turning.state.pitch + (turning.state.bodyPitch ?? 0),
      turning.state.roll + (turning.state.bodyRoll ?? 0),
    );
    turning.transform.rot.forEach((value, i) => {
      expect(value).toBeCloseTo(leaned[i] ?? 0, 12);
    });
  });

  it('bounces off a wall at an angle and spins, but rests against it at walking pace', () => {
    // A wall across the road at 30 degrees: the near corner hits first.
    const normal = [Math.sin(-Math.PI / 6), Math.cos(-Math.PI / 6)] as const;
    const env: VehicleEnvironment = {
      ...flat,
      canOccupy: (p, yaw, spec) => {
        const f = [Math.sin(yaw), Math.cos(yaw)];
        const l = [Math.cos(yaw), -Math.sin(yaw)];
        for (const [a, b] of [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ] as const) {
          const x =
            p[0] + ((a * spec.width) / 2) * (l[0] ?? 0) + ((b * spec.length) / 2) * (f[0] ?? 0);
          const z =
            p[2] + ((a * spec.width) / 2) * (l[1] ?? 0) + ((b * spec.length) / 2) * (f[1] ?? 0);
          if (x * normal[0] + z * normal[1] > 20) return false;
        }
        return true;
      },
    };
    let impact = 0;
    let spin = 0;
    const hit = drive(2.5, () => ({ throttle: 0, steering: 0, brake: false }), rolling(15), {
      env,
      watch: (r) => {
        impact = Math.max(impact, r.impact);
        spin = Math.max(spin, Math.abs(r.state.yawRate ?? 0));
      },
    });
    expect(impact).toBeGreaterThan(10);
    expect(hit.state.speed).toBeLessThan(0);
    expect(spin).toBeGreaterThan(0.2);
    const wall: VehicleEnvironment = { ...flat, canOccupy: (p) => p[2] < 3 };
    const pressed = drive(4, () => ({ throttle: 1, steering: 0, brake: false }), rolling(0), {
      env: wall,
    });
    expect(pressed.transform.pos[2]).toBeLessThan(3);
    expect(Math.abs(pressed.state.speed)).toBeLessThan(0.5);
  });

  it('feels crosswind gusts, the same way at 30, 60 and 120 Hz', () => {
    const gusty = { ...flat, weather: weatherProfile('rain') };
    // Constant input: a controller sampled per host tick would differ between rates.
    const cruise = () => ({ throttle: 0.4, steering: 0, brake: false });
    const runs = [30, 60, 120].map((hz) => drive(8, cruise, rolling(30), { env: gusty, hz }));
    const calm = drive(8, cruise, rolling(30));
    expect(Math.abs((runs[0]?.transform.pos[0] ?? 0) - calm.transform.pos[0])).toBeGreaterThan(0.5);
    for (const run of runs.slice(1))
      expect(run.transform.pos[0]).toBeCloseTo(runs[0]?.transform.pos[0] ?? 0, 6);
  });

  it('parks exactly: braked to rest, every motion state is zero', () => {
    const parked = drive(4, () => ({ throttle: 0, steering: 0.4, brake: true }), rolling(12));
    expect(parked.state.speed).toBe(0);
    expect(parked.state.lateralSpeed).toBe(0);
    expect(parked.state.yawRate).toBe(0);
  });

  it('emits impacts for sound and goes dormant after a crash', () => {
    const w = new World({ tickRate: 60 });
    installVehicles(w, { ...flat, canOccupy: (p) => p[2] < 6 });
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        vehicle: molenVehicle('molen.entities.vehicle.sedan'),
        vehicleState: initialVehicleState(),
        mountable: vehicleMounts(sedan),
      },
      'car',
    );
    w.spawnRaw({ transform: { pos: [-1.3, 0, 0.25], rot: [0, 0, 0, 1] } }, 'driver');
    expect(mountEntity(w, 'driver', 'car')).toBe(true);
    const heard: string[] = [];
    w.on('vehicle-impact', () => heard.push('impact'));
    w.on('vehicle-bump', () => heard.push('bump'));
    w.set('car', VehicleInput, { throttle: 1, steering: 0, brake: false });
    w.stepN(120);
    expect(heard.length).toBeGreaterThan(0);
    expect(w.get('car', Transform)?.pos[2]).toBeLessThan(6);
  });
});
