import type { SnowCoverData, VehicleSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { TransformData } from '../src/component';
import { figureEight, leanResponse } from '../src/trials';
import {
  initialVehicleState,
  stepVehicle,
  type VehicleEnvironment,
  type VehicleInputData,
  type VehicleStateData,
} from '../src/vehicles';
import { molenVehicle } from './helpers/entities';

const cycle = (name: string): VehicleSpec => molenVehicle(`molen.entities.cycle.${name}`).spec;
const motorcycle = cycle('standard_motorcycle');
const bicycle = cycle('road_bicycle');
const scooter = cycle('motor_scooter');
const moped = cycle('electric_moped');
const skis = cycle('skis');
const snowboard = cycle('snowboard');

const G = 9.81;
interface Ride {
  transform: TransformData;
  state: VehicleStateData;
}
const flat: VehicleEnvironment = { groundHeight: () => 0 };
/** Snow exactly `depth` meters deep everywhere, whatever the height. */
const snow = (depth: number): SnowCoverData => ({ level: -100_000, transition: 0, depth });
// A snowfield falling gently away ahead (toward +Z), enough to keep a slider moving.
const slope: VehicleEnvironment = {
  groundHeight: (_x, z) => -0.07 * z,
  weather: { snowCover: snow(0.3) },
};
const rolling = (speed: number): Ride => ({
  transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
  state: { ...initialVehicleState(), speed },
});
function ride(
  seconds: number,
  controls: (state: VehicleStateData, time: number) => VehicleInputData,
  start: Ride,
  spec: VehicleSpec = motorcycle,
  env: VehicleEnvironment = flat,
  watch: (result: Ride, time: number) => void = () => {},
): Ride {
  let result = start;
  for (let tick = 0; tick < Math.round(seconds * 60); tick++) {
    result = stepVehicle(
      result.transform,
      result.state,
      controls(result.state, tick / 60),
      spec,
      1 / 60,
      env,
    );
    watch(result, (tick + 1) / 60);
  }
  return result;
}
const sideslip = (state: VehicleStateData): number =>
  Math.abs(Math.atan2(state.lateralSpeed ?? 0, Math.max(1, Math.abs(state.speed))));
const holding = (speed: number, steering: number) => (state: VehicleStateData) => ({
  throttle: Math.max(0, Math.min(1, (speed - state.speed) * 0.5)),
  steering,
  brake: false,
});

describe('a ridden two-wheeler', () => {
  it('leans into a turn by steering out of it first, then holds the lean the turn needs', () => {
    const steers: number[] = [];
    const end = ride(4, holding(15, 1), rolling(15), motorcycle, flat, (r, time) => {
      if (time < 0.5) steers.push(r.state.steer);
    }).state;
    // Steering asked to the right: the bar goes left first, and the machine falls right.
    expect(Math.min(...steers)).toBeLessThan(-0.002);
    expect(end.bodyRoll).toBeGreaterThan(0.4);
    expect(end.steer).toBeGreaterThan(0);
    // Turning right, at the lean gravity and the turn agree on.
    expect(end.yawRate).toBeLessThan(0);
    const needed = Math.atan((end.speed * Math.abs(end.yawRate ?? 0)) / G);
    expect(end.bodyRoll).toBeGreaterThan(0.9 * needed);
    expect(end.bodyRoll).toBeLessThan(1.1 * needed);
    const response = leanResponse(motorcycle, 15);
    expect(response.countersteer).toBeGreaterThan(0.002);
    expect(response.time).toBeGreaterThan(0.3);
    expect(response.time).toBeLessThan(2);
  });

  it('never slides out or spins with the steering held hard over, at any speed', () => {
    for (const speed of [8, 20, 35]) {
      let worst = 0;
      let slowest = Infinity;
      let leaned = 0;
      const end = ride(8, holding(speed, 1), rolling(speed), motorcycle, flat, (r) => {
        worst = Math.max(worst, sideslip(r.state));
        slowest = Math.min(slowest, r.state.speed);
        leaned = Math.max(leaned, Math.abs(r.state.bodyRoll ?? 0));
      }).state;
      expect(worst).toBeLessThan(0.15);
      expect(slowest).toBeGreaterThan(0.6 * speed);
      expect(leaned).toBeLessThanOrEqual((motorcycle.cycle?.maxLean ?? 0) + 0.041);
      expect(Math.abs(end.yawRate ?? 9)).toBeLessThan(2);
    }
  });

  it('stands up again when the steering is let go', () => {
    const turned = ride(3, holding(15, 1), rolling(15));
    const released = ride(2.5, holding(15, 0), turned).state;
    expect(Math.abs(released.bodyRoll ?? 1)).toBeLessThan(0.03);
    expect(Math.abs(released.yawRate ?? 1)).toBeLessThan(0.03);
  });

  it('rounds a corner on the push of its leaned tires, hardly slipping', () => {
    const plain = { ...motorcycle, cycle: { ...motorcycle.cycle, camber: 0 } } as VehicleSpec;
    const slip = (spec: VehicleSpec): number => {
      const { state } = ride(4, holding(15, 0.7), rolling(15), spec);
      // The rear tire's slip angle: how far the tail runs wide of the path.
      return Math.abs(
        Math.atan2((state.lateralSpeed ?? 0) - 0.75 * (state.yawRate ?? 0), state.speed),
      );
    };
    expect(slip(motorcycle)).toBeLessThan(0.02);
    expect(slip(plain)).toBeGreaterThan(2 * slip(motorcycle));
  });

  it('leans only as far as a wet road will hold', () => {
    const wet: VehicleEnvironment = {
      groundHeight: () => 0,
      surface: () => ({ grip: 0.4, drag: 0, roughness: 0 }),
    };
    let worst = 0;
    const dry = ride(4, holding(15, 1), rolling(15)).state;
    const end = ride(4, holding(15, 1), rolling(15), motorcycle, wet, (r) => {
      worst = Math.max(worst, sideslip(r.state));
    }).state;
    expect(end.bodyRoll).toBeGreaterThan(0.1);
    expect(end.bodyRoll).toBeLessThan(0.7 * (dry.bodyRoll ?? 0));
    expect(worst).toBeLessThan(0.15);
  });

  it('points its wheel with the bar at a walking pace, feet down', () => {
    const start = rolling(0.8);
    const end = ride(1, () => ({ throttle: 0, steering: 1, brake: false }), start).state;
    expect(end.steer).toBeGreaterThan(0.1);
    expect(Math.abs(end.bodyRoll ?? 1)).toBeLessThan(0.05);
  });

  it('keeps its lean through the air and rides on after landing', () => {
    const turned = ride(2, holding(15, 0.5), rolling(15));
    const lean = turned.state.bodyRoll ?? 0;
    const jump: Ride = {
      transform: {
        ...turned.transform,
        pos: [turned.transform.pos[0], 0.8, turned.transform.pos[2]],
      },
      state: { ...turned.state, grounded: false },
    };
    const air = ride(0.3, holding(15, 0.5), jump).state;
    expect(air.grounded).toBe(false);
    expect(Math.abs((air.bodyRoll ?? 0) - lean)).toBeLessThan(0.08);
    const landed = ride(3, holding(15, 0.5), jump).state;
    expect(landed.grounded).toBe(true);
    expect(landed.bodyRoll).toBeGreaterThan(0.5 * lean);
    expect(landed.speed).toBeGreaterThan(10);
  });

  it('rides a figure-eight on every machine without sliding out', () => {
    for (const name of [
      'standard_motorcycle',
      'cruiser_motorcycle',
      'motor_scooter',
      'underbone_moped',
      'electric_moped',
      'city_bicycle',
      'road_bicycle',
      'cargo_bicycle',
      'kick_scooter',
      'skateboard',
      'electric_skateboard',
    ]) {
      const lap = figureEight(cycle(name));
      expect([name, lap.completed, lap.maxSideslip < 0.35]).toEqual([name, true, true]);
      expect(lap.maxLean).toBeGreaterThan(0.1);
    }
    // A bicycle leans less than a motorcycle at its own pace, and turns as surely.
    expect(figureEight(bicycle).maxLean).toBeLessThanOrEqual((bicycle.cycle?.maxLean ?? 0) + 0.041);
  });
});

describe('engines for the motor cycles', () => {
  const launch = (spec: VehicleSpec) => {
    let to100 = Infinity;
    let top = 0;
    const end = ride(
      20,
      () => ({ throttle: 1, steering: 0, brake: false }),
      rolling(0),
      spec,
      flat,
      (r, time) => {
        if (r.state.speed >= 27.78) to100 = Math.min(to100, time);
        top = Math.max(top, r.state.gear ?? 0);
      },
    ).state;
    return { to100, top, end };
  };

  it('pulls a motorcycle through its gears to 100 km/h in a few seconds', () => {
    const { to100, top, end } = launch(motorcycle);
    expect(motorcycle.powertrain?.gears).toHaveLength(6);
    expect(to100).toBeGreaterThan(3);
    expect(to100).toBeLessThan(6);
    expect(top).toBeGreaterThanOrEqual(4);
    expect(end.rpm).toBeGreaterThan(3000);
    expect(end.speed).toBeGreaterThan(0.9 * motorcycle.maxSpeed);
  });

  it('gives the scooter a variator and the electric moped one gear', () => {
    expect(scooter.powertrain?.continuous).toBe(true);
    const scoot = launch(scooter);
    expect(scoot.end.speed).toBeGreaterThan(0.9 * scooter.maxSpeed);
    expect(scoot.to100).toBe(Infinity);
    expect(moped.powertrain?.curve).toBe('electric');
    const quiet = launch(moped);
    expect(quiet.top).toBe(1);
    expect(quiet.end.speed).toBeGreaterThan(0.9 * moped.maxSpeed);
  });
});

describe('skis and a snowboard on edge', () => {
  it('carve the arc their sidecut and edge angle give', () => {
    for (const spec of [skis, snowboard]) {
      const sidecut = spec.runners?.sidecut ?? 0;
      expect(sidecut).toBeGreaterThan(5);
      const end = ride(2.5, holding(7, 0.8), rolling(7), spec, slope).state;
      const lean = Math.abs(end.bodyRoll ?? 0);
      expect(lean).toBeGreaterThan(0.2);
      const radius = end.speed / Math.abs(end.yawRate ?? 1e-9);
      // On edge and within what the snow holds: the sidecut's radius, shortened by the lean.
      expect(radius).toBeGreaterThan(0.75 * sidecut * Math.cos(lean));
      expect(radius).toBeLessThan(1.35 * sidecut * Math.cos(lean));
    }
  });

  it('turn tighter the harder they are edged, and run straight flat', () => {
    const radius = (steering: number): number => {
      const end = ride(2.5, holding(7, steering), rolling(7), snowboard, slope).state;
      return end.speed / Math.max(1e-9, Math.abs(end.yawRate ?? 0));
    };
    expect(radius(1)).toBeLessThan(radius(0.5));
    expect(radius(0)).toBeGreaterThan(500);
  });

  it('cannot carve tighter than the snow holds at speed', () => {
    let worst = 0;
    const end = ride(4, holding(25, 1), rolling(25), skis, slope, (r) => {
      worst = Math.max(worst, sideslip(r.state));
    }).state;
    const lateral = (end.speed * Math.abs(end.yawRate ?? 0)) / G;
    expect(lateral).toBeLessThan((skis.grip / G) * 1.05);
    expect(worst).toBeLessThan(0.3);
  });
});
