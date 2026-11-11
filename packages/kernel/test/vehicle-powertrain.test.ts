import type { VehicleSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { TransformData } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import {
  driveVehicle,
  engineTorqueCurve,
  initialVehicleState,
  installVehicles,
  mountEntity,
  powertrainWheelForce,
  stepVehicle,
  VEHICLE_SURFACES,
  type VehicleEnvironment,
  type VehicleInputData,
  VehicleState,
  type VehicleStateData,
  vehicleMounts,
  vehicleSurface,
} from '../src/vehicles';
import { World } from '../src/world';
import { molenVehicle } from './helpers/entities';

const sedan = molenVehicle('molen.entities.vehicle.sedan').spec;
const coupe = molenVehicle('molen.entities.vehicle.sports_coupe').spec;
const electric = molenVehicle('molen.entities.vehicle.tesla_model_3_2025').spec;
const offroad = molenVehicle('molen.entities.vehicle.offroad').spec;
const flat: VehicleEnvironment = { groundHeight: () => 0 };
type Drive = { transform: TransformData; state: VehicleStateData };
const rolling = (speed: number): Drive => ({
  transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
  state: { ...initialVehicleState(), speed },
});
function drive(
  seconds: number,
  controls: (state: VehicleStateData, time: number) => VehicleInputData,
  start: Drive,
  { spec = sedan, env = flat, hz = 60, watch = (_: Drive, _time: number) => {} } = {},
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
    watch(result, (tick + 1) / hz);
  }
  return result;
}
const floored = (): VehicleInputData => ({ throttle: 1, steering: 0, brake: false });
const coasting = (): VehicleInputData => ({ throttle: 0, steering: 0, brake: false });
/** Sideslip in degrees: how far the car points away from where it is going. */
const sideslip = (state: VehicleStateData): number =>
  Math.hypot(state.speed, state.lateralSpeed ?? 0) > 5
    ? (Math.atan2(Math.abs(state.lateralSpeed ?? 0), Math.abs(state.speed)) * 180) / Math.PI
    : 0;

describe('engine and gearbox', () => {
  it('shapes torque by the kind of engine', () => {
    // A petrol engine makes a quarter more torque at half its peak-power speed.
    expect(engineTorqueCurve('gasoline', 0.5)).toBeCloseTo(1.25, 6);
    expect(engineTorqueCurve('gasoline', 1)).toBeCloseTo(1, 6);
    // Turbo and diesel engines pull from low down; a motor holds its torque from rest.
    expect(engineTorqueCurve('turbo', 0.35)).toBeGreaterThan(engineTorqueCurve('gasoline', 0.35));
    expect(engineTorqueCurve('diesel', 0.45)).toBeCloseTo(1.5, 6);
    expect(engineTorqueCurve('electric', 0.1)).toBe(1);
    expect(engineTorqueCurve('electric', 2)).toBeCloseTo(0.5, 6);
  });

  it('pulls hardest in first, changes up near the rev limit and runs out of power, not into a wall', () => {
    const powertrain = sedan.powertrain;
    if (!powertrain) throw new Error('the sedan has a powertrain');
    const redline = powertrain.redline ?? powertrain.peakPowerRpm * 1.1;
    let to100 = Infinity;
    let early = 0;
    let late = 0;
    let highest = 0;
    const gears = new Set<number>();
    const run = drive(70, floored, rolling(0), {
      watch: (r, time) => {
        if (r.state.speed >= 27.78 && to100 === Infinity) to100 = time;
        if (time === 1) early = r.state.speed;
        if (Math.abs(time - 41) < 1e-9) late = r.state.speed;
        highest = Math.max(highest, r.state.rpm ?? 0);
        gears.add(r.state.gear ?? 0);
      },
    });
    const top = run.state;
    // About eight seconds to 100 km/h, like the midsize sedan it stands for (8.2 s).
    expect(to100).toBeGreaterThan(7.2);
    expect(to100).toBeLessThan(9.2);
    // First second from rest against a second at speed: the pull fades as the gears get taller.
    const settled = drive(1, floored, run).state;
    expect(early).toBeGreaterThan(3);
    expect(settled.speed - top.speed).toBeLessThan(0.05);
    expect(late).toBeGreaterThan(45);
    // It ends on its speed limiter or on drag, having used the gears on the way.
    expect(top.speed).toBeGreaterThan(55);
    expect(top.speed).toBeLessThanOrEqual(sedan.maxSpeed + 0.01);
    expect(gears.size).toBeGreaterThanOrEqual(5);
    expect(highest).toBeLessThanOrEqual(redline + 1);
    expect(highest).toBeGreaterThan(redline * 0.93);
    // Each gear's pull at its best is weaker than the one below it.
    const pull = (gear: number): number =>
      Math.max(
        ...Array.from({ length: 90 }, (_, v) =>
          powertrainWheelForce(powertrain, sedan.wheelRadius, v, gear),
        ),
      );
    for (let gear = 2; gear <= powertrain.gears.length; gear++)
      expect(pull(gear)).toBeLessThan(pull(gear - 1));
  });

  it('short-shifts under a light foot and kicks down when the pedal goes down', () => {
    const cruise = drive(12, () => ({ throttle: 0.2, steering: 0, brake: false }), rolling(25));
    const powertrain = sedan.powertrain;
    if (!powertrain) throw new Error('the sedan has a powertrain');
    expect(cruise.state.gear).toBeGreaterThanOrEqual(6);
    expect(cruise.state.rpm).toBeLessThan(0.45 * powertrain.peakPowerRpm);
    const kicked = drive(2, floored, cruise);
    expect(kicked.state.gear).toBeLessThanOrEqual((cruise.state.gear ?? 0) - 2);
    expect(kicked.state.rpm).toBeGreaterThan(0.6 * powertrain.peakPowerRpm);
    expect(kicked.state.speed).toBeGreaterThan(cruise.state.speed + 2);
  });

  it('brakes on the engine off the throttle, and an electric car regenerates in its one gear', () => {
    const free: VehicleSpec = { ...sedan };
    delete free.powertrain;
    const lost = (spec: VehicleSpec): number =>
      20 - drive(3, coasting, rolling(20), { spec }).state.speed;
    // Same drag and rolling resistance; the engine adds its own.
    expect(lost(sedan)).toBeGreaterThan(lost(free) + 0.15);
    const gears = new Set<number>();
    const launched = drive(8, floored, rolling(0), {
      spec: electric,
      watch: (r) => gears.add(r.state.gear ?? 0),
    });
    expect([...gears]).toEqual([1]);
    expect(launched.state.speed).toBeGreaterThan(27);
    // Lifting off at 70 km/h slows it by more than 1 m/s each second.
    expect(lost(electric)).toBeGreaterThan(3);
  });

  it('reverses in its own gear and never beyond the reverse limit', () => {
    const backed = drive(6, () => ({ throttle: -1, steering: 0, brake: false }), rolling(0));
    expect(backed.state.gear).toBe(-1);
    expect(backed.state.speed).toBeLessThan(-2);
    expect(backed.state.speed).toBeGreaterThanOrEqual(-sedan.reverseSpeed - 0.01);
    // Forward again: it brakes to a stop first, then takes first gear.
    const forward = drive(6, floored, backed);
    expect(forward.state.gear).toBeGreaterThanOrEqual(1);
    expect(forward.state.speed).toBeGreaterThan(5);
  });

  it('restores the gearbox from a keyframe and agrees at 30, 60 and 120 Hz', () => {
    const build = (): World => {
      const w = new World({ tickRate: 60 });
      installVehicles(w, flat);
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
      return w;
    };
    const a = build();
    expect(mountEntity(a, 'driver', 'car')).toBe(true);
    driveVehicle(a, 'driver', { throttle: 1, steering: 0.3, brake: false });
    a.stepN(200);
    expect(a.get('car', VehicleState)?.gear).toBeGreaterThan(1);
    const b = build();
    applyKeyframeTo(b, takeKeyframe(a));
    a.stepN(200);
    b.stepN(200);
    expect(stateHash(a)).toBe(stateHash(b));
    const runs = [30, 60, 120].map((hz) => drive(6, floored, rolling(0), { hz }).state);
    for (const run of runs.slice(1)) {
      expect(run.speed).toBeCloseTo(runs[0]?.speed ?? 0, 6);
      expect(run.gear).toBe(runs[0]?.gear);
    }
  });
});

describe('tire loads, stability aids and the driver at the wheel', () => {
  const cornering = (spec: VehicleSpec, seconds = 4, speed = 18): { slip: number; yaw: number } => {
    let slip = 0;
    const end = drive(seconds, () => ({ throttle: 1, steering: 1, brake: false }), rolling(speed), {
      spec,
      watch: (r) => {
        slip = Math.max(slip, sideslip(r.state));
      },
    });
    return { slip, yaw: Math.abs(end.state.yaw) };
  };

  it('holds a powerful rear-drive car on full throttle in a corner; without the aids it spins', () => {
    expect(coupe.drive).toBe('rear');
    const aided = cornering(coupe);
    // Observed about 6° of slip: the tail steps out a little and is caught.
    expect(aided.slip).toBeLessThan(12);
    const raw = cornering({ ...coupe, tractionControl: false, stabilityControl: false });
    expect(raw.slip).toBeGreaterThan(60);
  });

  it('reports traction and stability control at work', () => {
    let assist = 0;
    drive(3, () => ({ throttle: 1, steering: 1, brake: false }), rolling(18), {
      spec: coupe,
      watch: (r) => {
        assist = Math.max(assist, r.state.assist ?? 0);
      },
    });
    expect(assist).toBeGreaterThan(0.3);
    const gentle = drive(3, () => ({ throttle: 0.2, steering: 0, brake: false }), rolling(18), {
      spec: coupe,
    });
    expect(gentle.state.assist ?? 0).toBe(0);
  });

  it('spins only the unloaded inside wheel through an open differential', () => {
    // No aids, so only the differential decides how much drive reaches the road in a corner.
    const raw = { ...coupe, tractionControl: false, stabilityControl: false };
    const open = cornering({ ...raw, limitedSlip: 0 }, 2.5);
    const locked = cornering({ ...raw, limitedSlip: 1 }, 2.5);
    // A locked axle spins both tires and the tail comes round; an open one mostly wastes the
    // power at the inside wheel.
    expect(locked.slip).toBeGreaterThan(open.slip * 1.5);
  });

  it('stays in line when the driver lifts or brakes in the middle of a corner', () => {
    for (const spec of [sedan, coupe]) {
      let slip = 0;
      drive(
        7,
        (_s, time) => ({ throttle: time < 3 ? 0.8 : 0, steering: 1, brake: time > 5 }),
        rolling(25),
        {
          spec,
          watch: (r) => {
            slip = Math.max(slip, sideslip(r.state));
          },
        },
      );
      // Observed 5–8°: the old model spun every car here.
      expect(slip).toBeLessThan(14);
    }
  });

  it('slides the stiffer-sprung, heavier axle first', () => {
    const raw = { ...coupe, tractionControl: false, stabilityControl: false };
    // Coasting through a corner at the limit, so drive forces play no part.
    const slide = (spec: VehicleSpec): number => {
      let slip = 0;
      drive(4, () => ({ throttle: 0, steering: 1, brake: false }), rolling(28), {
        spec,
        watch: (r) => {
          slip = Math.max(slip, sideslip(r.state));
        },
      });
      return slip;
    };
    // Roll stiffness at the rear makes the tail slide; at the front, the nose runs wide.
    expect(slide({ ...raw, rollBalance: 0.3 })).toBeGreaterThan(
      slide({ ...raw, rollBalance: 0.8 }) * 1.5,
    );
    // With grip proportional to load, the split no longer matters.
    const flatTires = { ...raw, tireLoadSensitivity: 0 };
    expect(slide({ ...flatTires, rollBalance: 0.3 })).toBeCloseTo(
      slide({ ...flatTires, rollBalance: 0.8 }),
      1,
    );
  });

  it('countersteers by itself when the wheel is let go in a slide, and straightens out', () => {
    const raw = { ...sedan, stabilityControl: false };
    let opposite = 0;
    let slip = 0;
    // A handbrake turn to the right, then hands and feet off everything.
    const end = drive(
      5,
      (_s, time) => ({
        throttle: 0,
        steering: time < 0.9 ? 1 : 0,
        brake: false,
        handbrake: time < 0.9,
      }),
      rolling(22),
      {
        spec: raw,
        watch: (r, time) => {
          slip = Math.max(slip, sideslip(r.state));
          // Turning right is positive steering: opposite lock is negative.
          if (time > 0.9) opposite = Math.min(opposite, r.state.steer);
        },
      },
    );
    expect(slip).toBeGreaterThan(15);
    expect(opposite).toBeLessThan(-0.08);
    expect(sideslip(end.state)).toBeLessThan(2);
    expect(Math.abs(end.state.yawRate ?? 1)).toBeLessThan(0.05);
  });

  it('eases into a turn at speed: a tap nudges the car, a held key reaches the grip limit', () => {
    const lateral = (seconds: number): number => {
      let peak = 0;
      drive(
        3,
        (s, time) => ({
          throttle: s.speed < 30 ? 0.5 : 0,
          steering: time < seconds ? 1 : 0,
          brake: false,
        }),
        rolling(30),
        {
          watch: (r) => {
            peak = Math.max(peak, Math.abs(r.state.speed * (r.state.yawRate ?? 0)));
          },
        },
      );
      return peak;
    };
    // A fifth of a second on the key is a gentle lane nudge; holding it is the whole tire.
    expect(lateral(0.2)).toBeLessThan(3.5);
    expect(lateral(0.2)).toBeGreaterThan(0.5);
    expect(lateral(2.5)).toBeGreaterThan(7);
  });
});

describe('road surfaces', () => {
  const on = (kind: string): VehicleEnvironment => ({
    ...flat,
    surface: () => vehicleSurface(kind),
  });
  const stopping = (spec: VehicleSpec, env: VehicleEnvironment): number =>
    drive(12, () => ({ throttle: 0, steering: 0, brake: true }), rolling(25), { spec, env })
      .transform.pos[2];

  it('knows the map names for surfaces and treats the rest as pavement', () => {
    expect(vehicleSurface('asphalt')).toEqual({ grip: 1, drag: 0, roughness: 0 });
    expect(vehicleSurface('grass')).toBe(VEHICLE_SURFACES.grass);
    expect(vehicleSurface('tarmac-of-the-future')).toBeUndefined();
    expect(vehicleSurface(undefined)).toBeUndefined();
    for (const surface of Object.values(VEHICLE_SURFACES)) {
      expect(surface.grip).toBeGreaterThan(0.2);
      expect(surface.grip).toBeLessThanOrEqual(1);
    }
  });

  it('stops longer, coasts shorter and shakes on grass', () => {
    const road = stopping(sedan, flat);
    expect(stopping(sedan, on('asphalt'))).toBeCloseTo(road, 6);
    expect(stopping(sedan, on('grass'))).toBeGreaterThan(road * 1.5);
    expect(stopping(sedan, on('snow'))).toBeGreaterThan(stopping(sedan, on('grass')));
    const coast = (env: VehicleEnvironment): Drive => drive(3, coasting, rolling(15), { env });
    expect(coast(on('grass')).state.speed).toBeLessThan(coast(flat).state.speed - 1);
    expect(coast(on('grass')).state.surfaceGrip).toBeCloseTo(0.55, 6);
    expect(coast(flat).state.surfaceGrip).toBeUndefined();
    let shake = 0;
    drive(3, coasting, rolling(15), {
      env: on('grass'),
      watch: (r) => {
        shake = Math.max(shake, Math.abs(r.state.bodyRoll ?? 0));
      },
    });
    expect(shake).toBeGreaterThan(0.004);
    expect(Math.abs(coast(flat).state.bodyRoll ?? 1)).toBeLessThan(1e-6);
  });

  it('wins some of it back on off-road tires', () => {
    expect(offroad.looseSurfaceGrip).toBeGreaterThan(0.3);
    const road: VehicleSpec = { ...offroad };
    delete road.looseSurfaceGrip;
    expect(stopping(offroad, on('mud'))).toBeLessThan(stopping(road, on('mud')) * 0.9);
    // On pavement the tread makes no difference.
    expect(stopping(offroad, flat)).toBeCloseTo(stopping(road, flat), 6);
  });
});
