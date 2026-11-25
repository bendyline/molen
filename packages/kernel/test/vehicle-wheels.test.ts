import type { VehicleSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { TransformData } from '../src/component';
import {
  LONGITUDINAL_GRIP,
  stepAxle,
  stepWheel,
  strutLoad,
  tireForces,
  tirePeakAngle,
  tirePeakRatio,
} from '../src/dynamics/wheel';
import {
  initialVehicleState,
  stepVehicle,
  type VehicleEnvironment,
  type VehicleInputData,
  type VehicleStateData,
} from '../src/vehicles';
import { molenVehicle } from './helpers/entities';

const sedan = molenVehicle('molen.entities.vehicle.sedan').spec;
const coupe = molenVehicle('molen.entities.vehicle.porsche_911_2017').spec;
if (!sedan.wheels || !coupe.wheels) throw new Error('The road cars stand on four wheels');

const G = 9.81;
const tire = { load: 4000, friction: 0.9, stiffness: 18 };

describe('a tire', () => {
  const peakAngle = tirePeakAngle(tire.friction, tire.stiffness);
  const peakRatio = tirePeakRatio(tire.friction, tire.stiffness);

  it('grips hardest at its peak slip and holds most of that sliding', () => {
    const side = (slipAngle: number): number =>
      Math.abs(tireForces({ ...tire, slipRatio: 0, slipAngle }).lateral);
    expect(side(peakAngle)).toBeCloseTo(tire.friction * tire.load, 3);
    expect(side(peakAngle / 2)).toBeLessThan(side(peakAngle));
    expect(side(peakAngle * 2)).toBeLessThan(side(peakAngle));
    expect(side(1)).toBeGreaterThan(0.8 * side(peakAngle));
    // The force opposes the slip, and starts out in proportion to it.
    expect(tireForces({ ...tire, slipRatio: 0, slipAngle: 0.002 }).lateral).toBeCloseTo(
      -0.002 * tire.stiffness * tire.load,
      0,
    );
  });

  it('grips a little harder lengthwise, drive forward and brake back', () => {
    const drive = tireForces({ ...tire, slipRatio: peakRatio, slipAngle: 0 });
    const brake = tireForces({ ...tire, slipRatio: -peakRatio, slipAngle: 0 });
    expect(drive.longitudinal).toBeCloseTo(LONGITUDINAL_GRIP * tire.friction * tire.load, 3);
    expect(brake.longitudinal).toBeCloseTo(-drive.longitudinal, 6);
    expect(drive.lateral).toBeCloseTo(0, 9);
  });

  it('has one grip to share between cornering and drive', () => {
    const corner = tireForces({ ...tire, slipRatio: 0, slipAngle: peakAngle });
    const both = tireForces({ ...tire, slipRatio: peakRatio, slipAngle: peakAngle });
    expect(Math.abs(both.lateral)).toBeLessThan(0.8 * Math.abs(corner.lateral));
    expect(both.over).toBeGreaterThan(corner.over);
    // A locked, sliding wheel has almost nothing left to steer with.
    const locked = tireForces({ ...tire, slipRatio: -1, slipAngle: peakAngle / 2 });
    expect(Math.abs(locked.lateral)).toBeLessThan(0.1 * Math.abs(corner.lateral));
    expect(tireForces({ ...tire, load: 0, slipRatio: 0.1, slipAngle: 0.1 })).toEqual({
      longitudinal: 0,
      lateral: 0,
      over: 0,
    });
  });
});

describe('a wheel', () => {
  const wheel = { ...tire, radius: 0.33, inertia: 1.2, slipAngle: 0, h: 1 / 120 };
  const run = (
    seconds: number,
    start: number,
    torques: { driveTorque?: number; brakeTorque?: number },
    roadSpeed = 20,
  ) => {
    let spin = start;
    let last = stepWheel({ ...wheel, spin, roadSpeed, driveTorque: 0, brakeTorque: 0 });
    for (let i = 0; i < seconds * 120; i++) {
      last = stepWheel({ ...wheel, spin, roadSpeed, driveTorque: 0, brakeTorque: 0, ...torques });
      spin = last.spin;
    }
    return last;
  };
  const grip = LONGITUDINAL_GRIP * tire.friction * tire.load * wheel.radius;

  it('rolls at the road speed when nothing turns it', () => {
    const rolling = run(1, 20 / wheel.radius, {});
    expect(rolling.spin * wheel.radius).toBeCloseTo(20, 6);
    expect(rolling.forces.longitudinal).toBeCloseTo(0, 6);
  });

  it('pushes with the torque it is given, and spins up when that is more than it can grip', () => {
    const pulling = run(1, 20 / wheel.radius, { driveTorque: 0.5 * grip });
    expect(pulling.forces.longitudinal * wheel.radius).toBeCloseTo(0.5 * grip, 0);
    expect(pulling.slipRatio).toBeGreaterThan(0);
    expect(pulling.slipRatio).toBeLessThan(0.1);
    const spinning = run(1, 20 / wheel.radius, { driveTorque: 1.5 * grip });
    expect(spinning.slipRatio).toBeGreaterThan(1);
    expect(spinning.forces.over).toBe(1);
  });

  it('locks under more brake than grip, holds, and comes back to the road speed let go', () => {
    const braked = run(1, 20 / wheel.radius, { brakeTorque: 0.5 * grip });
    expect(braked.forces.longitudinal * wheel.radius).toBeCloseTo(-0.5 * grip, 0);
    const locked = run(1, 20 / wheel.radius, { brakeTorque: 1.5 * grip });
    expect(locked.spin).toBe(0);
    expect(locked.slipRatio).toBe(-1);
    // Sliding, it stops the car with a little less than its best.
    expect(-locked.forces.longitudinal * wheel.radius).toBeLessThan(0.9 * grip);
    expect(-locked.forces.longitudinal * wheel.radius).toBeGreaterThan(0.8 * grip);
    // Released from the slide it spins back up to the road's speed and stops there.
    let spin = 0;
    let fastest = 0;
    for (let i = 0; i < 120; i++) {
      spin = stepWheel({ ...wheel, spin, roadSpeed: 20, driveTorque: 0, brakeTorque: 0 }).spin;
      fastest = Math.max(fastest, spin * wheel.radius);
    }
    expect(spin * wheel.radius).toBeCloseTo(20, 3);
    expect(fastest).toBeLessThan(20.5);
    // A brake holds a standing wheel against a push it is strong enough for.
    const held = run(1, 0, { driveTorque: 0.3 * grip, brakeTorque: 0.5 * grip }, 0);
    expect(held.spin).toBe(0);
  });
});

describe('two wheels on a differential', () => {
  const side = { ...tire, radius: 0.33, inertia: 1.2, slipAngle: 0, brakeTorque: 0 };
  const pull = (locked: number) => {
    // The left wheel stands on a quarter of the load, as the inside wheel does in a corner.
    let left = { ...side, load: 1000, spin: 10 / side.radius, roadSpeed: 10 };
    let right = { ...side, load: 4000, spin: 10 / side.radius, roadSpeed: 10 };
    let forces: [number, number] = [0, 0];
    for (let i = 0; i < 120; i++) {
      const [a, b] = stepAxle({
        left,
        right,
        driveTorque: 2500,
        carrierInertia: 20,
        locked,
        h: 1 / 120,
      });
      left = { ...left, spin: a.spin };
      right = { ...right, spin: b.spin };
      forces = [a.forces.longitudinal, b.forces.longitudinal];
    }
    return { forces, speeds: [left.spin * side.radius, right.spin * side.radius] };
  };

  it('open: the loaded wheel gets no more than the light one can hold', () => {
    const open = pull(0);
    expect(open.speeds[0]).toBeGreaterThan(15);
    expect(open.speeds[1]).toBeLessThan(11);
    // (The light wheel is still gathering speed, which the loaded one feels as torque.)
    expect(open.forces[1]).toBeLessThan(2 * open.forces[0]);
    expect(open.forces[1]).toBeLessThan(0.5 * LONGITUDINAL_GRIP * tire.friction * 4000);
  });

  it('locked: both turn together and the loaded wheel does the pulling', () => {
    const locked = pull(1);
    expect(Math.abs(locked.speeds[0] - locked.speeds[1])).toBeLessThan(1);
    expect(locked.forces[1]).toBeGreaterThan(2.5 * locked.forces[0]);
    expect(locked.forces[0] + locked.forces[1]).toBeGreaterThan(
      1.5 * (pull(0).forces[0] + pull(0).forces[1]),
    );
  });
});

describe('a strut', () => {
  const strut = { staticLoad: 4000, spring: 30000, damper: 3000, travel: 0.09, rate: 0 };

  it('carries its load at ride height, more compressed, and nothing hanging', () => {
    expect(strutLoad({ ...strut, compression: 0 })).toBe(4000);
    expect(strutLoad({ ...strut, compression: 0.05 })).toBeCloseTo(5500, 6);
    expect(strutLoad({ ...strut, compression: 0.05, rate: 0.5 })).toBeCloseTo(7000, 6);
    expect(strutLoad({ ...strut, compression: -0.5 })).toBe(0);
    // Past its travel the bump stop comes in, much stiffer.
    const gain =
      strutLoad({ ...strut, compression: 0.11 }) - strutLoad({ ...strut, compression: 0.1 });
    expect(gain).toBeCloseTo(5 * strut.spring * 0.01, 6);
  });
});

interface Drive {
  transform: TransformData;
  state: VehicleStateData;
}
const flat: VehicleEnvironment = { groundHeight: () => 0 };
const rolling = (speed: number): Drive => ({
  transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
  state: { ...initialVehicleState(), speed },
});
function drive(
  seconds: number,
  controls: (state: VehicleStateData, time: number) => VehicleInputData,
  start: Drive,
  spec: VehicleSpec = sedan,
  env: VehicleEnvironment = flat,
  watch: (result: Drive, time: number) => void = () => {},
): Drive {
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
const loads = (state: VehicleStateData): [number, number, number, number] => {
  if (!state.wheelLoad) throw new Error('No wheel loads');
  return state.wheelLoad;
};
const wheelSpeeds = (state: VehicleStateData, spec: VehicleSpec): number[] =>
  (state.wheelSpin ?? []).map((spin) => spin * spec.wheelRadius);

describe('a car on four wheels', () => {
  const weight = sedan.mass * G;
  const cruising = { throttle: 0.15, steering: 0, brake: false };

  it('stands level with its weight on its wheels, split by where its center of mass is', () => {
    const { state } = drive(2, () => ({ throttle: 0, steering: 0, brake: true }), rolling(0));
    const [fl, fr, rl, rr] = loads(state);
    expect(fl + fr + rl + rr).toBeCloseTo(weight, -1);
    expect(fl).toBeCloseTo(fr, 3);
    const front = (sedan.wheelbase / 2 + sedan.centerOfMass[2]) / sedan.wheelbase;
    expect((fl + fr) / weight).toBeCloseTo(front, 2);
    expect(Math.abs(state.bodyPitch ?? 1)).toBeLessThan(1e-4);
    expect(Math.abs(state.bodyRoll ?? 1)).toBeLessThan(1e-4);
    expect(state.wheelSpin).toEqual([0, 0, 0, 0]);
  });

  it('dives and loads its front wheels under braking, squats under power', () => {
    const before = loads(drive(1, () => cruising, rolling(25)).state);
    const braking = drive(1, () => ({ throttle: 0, steering: 0, brake: true }), rolling(25)).state;
    const [fl, fr, rl, rr] = loads(braking);
    expect(fl + fr).toBeGreaterThan(1.25 * (before[0] + before[1]));
    expect(rl + rr).toBeLessThan(0.8 * (before[2] + before[3]));
    expect(fl + fr + rl + rr).toBeCloseTo(weight, -3);
    expect(braking.bodyPitch).toBeGreaterThan(0.01);
    const launching = drive(
      1,
      () => ({ throttle: 1, steering: 0, brake: false }),
      rolling(3),
    ).state;
    expect(launching.bodyPitch).toBeLessThan(-0.003);
    expect(loads(launching)[2]).toBeGreaterThan(before[2]);
  });

  it('leans out of a corner onto its outside wheels, about as far as its roll stiffness says', () => {
    let lateral = 0;
    const turning = drive(
      4,
      (state) => ({ throttle: state.speed < 18 ? 0.5 : 0.1, steering: 0.5, brake: false }),
      rolling(18),
      sedan,
      flat,
      (r, time) => {
        if (time > 3) lateral = Math.abs(r.state.speed * (r.state.yawRate ?? 0)) / G;
      },
    ).state;
    // Steering right: the left wheels are the outside ones.
    const [fl, fr, rl, rr] = loads(turning);
    expect(lateral).toBeGreaterThan(0.3);
    expect(fl).toBeGreaterThan(1.2 * fr);
    expect(rl).toBeGreaterThan(1.2 * rr);
    const perG = Math.abs(turning.bodyRoll ?? 0) / lateral;
    expect(perG).toBeGreaterThan(0.7 * (sedan.rollStiffness ?? 0.05));
    expect(perG).toBeLessThan(1.3 * (sedan.rollStiffness ?? 0.05));
  });

  const stop = (input: Partial<VehicleInputData>, spec = sedan, env = flat) => {
    let locked = false;
    const end = drive(
      8,
      () => ({ throttle: 0, steering: 0, brake: true, ...input }),
      rolling(27.78),
      spec,
      env,
      (r) => {
        if (r.state.speed > 8 && wheelSpeeds(r.state, spec).some((s) => s < 0.2 * r.state.speed))
          locked = true;
      },
    );
    return { distance: end.transform.pos[2], side: end.transform.pos[0], end, locked };
  };

  it('stops just short of locking with anti-lock brakes, and locks and slides without them', () => {
    // Brakes strong enough to lock every wheel, as a hard stamp on the pedal is.
    const strong = { ...sedan, brakeDeceleration: 2 * sedan.grip };
    const aided = stop({}, strong);
    const bare = stop({ controlMode: 'direct' }, strong);
    expect(aided.locked).toBe(false);
    expect(aided.end.state.speed).toBe(0);
    expect(bare.locked).toBe(true);
    // Sliding tires hold a little less than tires at their peak: a slightly longer stop.
    expect(bare.distance).toBeGreaterThan(1.01 * aided.distance);
    // The pedal is the driver's: half of it stops in a longer distance.
    expect(stop({ brakePedal: 0.3 }).distance).toBeGreaterThan(1.5 * stop({}).distance);
    // Locked front wheels cannot steer the car; anti-lock leaves them some say.
    const steered = stop({ steering: 0.5 }, strong);
    const sliding = stop({ steering: 0.5, controlMode: 'direct' }, strong);
    expect(Math.abs(steered.side)).toBeGreaterThan(2 * Math.abs(sliding.side) + 0.5);
  });

  it('spins its driven wheels on too much throttle unless traction control holds them', () => {
    // A wet road: the coupe has more engine than grip.
    const wet: VehicleEnvironment = {
      groundHeight: () => 0,
      surface: () => ({ grip: 0.4, drag: 0, roughness: 0 }),
    };
    const launch = (input: Partial<VehicleInputData>) => {
      let slip = 0;
      const end = drive(
        2,
        () => ({ throttle: 1, steering: 0, brake: false, ...input }),
        rolling(0),
        coupe,
        wet,
        (r) => {
          const [, , rl] = wheelSpeeds(r.state, coupe);
          slip = Math.max(slip, (rl ?? 0) - r.state.speed);
        },
      );
      return { slip, speed: end.state.speed, assist: end.state.assist ?? 0 };
    };
    const aided = launch({});
    const bare = launch({ controlMode: 'direct' });
    expect(aided.slip).toBeLessThan(1.5);
    expect(aided.assist).toBeGreaterThan(0.2);
    expect(bare.slip).toBeGreaterThan(5);
    // Wheelspin costs the launch.
    expect(aided.speed).toBeGreaterThan(bare.speed);
  });

  it('pulls toward the grippy side braking with two wheels on ice, and spins without anti-lock', () => {
    const ice = { grip: 0.15, drag: 0, roughness: 0 };
    const road = { grip: 1, drag: 0, roughness: 0 };
    // The road to the left of the car's centerline is ice.
    const split: VehicleEnvironment = {
      groundHeight: () => 0,
      surface: (x) => (x > 0.3 ? ice : road),
    };
    const braking = (input: Partial<VehicleInputData>) => {
      let yaw = 0;
      let slowest = Infinity;
      drive(
        1.5,
        () => ({ throttle: 0, steering: 0, brake: true, ...input }),
        rolling(27.78),
        sedan,
        split,
        (r, time) => {
          yaw = Math.min(yaw, r.state.yaw);
          if (time > 0.3 && r.state.speed > 10)
            slowest = Math.min(slowest, ...wheelSpeeds(r.state, sedan));
        },
      );
      return { yaw, slowest };
    };
    // The right wheels do most of the stopping, which turns the nose to the right. Anti-lock
    // keeps every wheel turning, the one on the ice included, and holds the rear pair to
    // what the worse-placed of them can take.
    const aided = braking({});
    expect(aided.yaw).toBeLessThan(-0.05);
    expect(aided.yaw).toBeGreaterThan(-0.8);
    expect(aided.slowest).toBeGreaterThan(5);
    // Without it the wheels lock and the car comes round.
    const bare = braking({ controlMode: 'direct' });
    expect(bare.slowest).toBe(0);
    expect(bare.yaw).toBeLessThan(-1);
  });

  it('comes down onto its springs after a drop', () => {
    const start = rolling(10);
    start.transform.pos[1] = 0.6;
    start.state.grounded = false;
    let lowest = 0;
    let heaviest = 0;
    const landed = drive(
      2,
      () => ({ throttle: 0, steering: 0, brake: false }),
      start,
      sedan,
      flat,
      (r) => {
        lowest = Math.min(lowest, r.state.bodyHeave ?? 0);
        heaviest = Math.max(
          heaviest,
          loads(r.state).reduce((sum, load) => sum + load, 0),
        );
      },
    );
    expect(landed.state.grounded).toBe(true);
    expect(lowest).toBeLessThan(-0.03);
    expect(heaviest).toBeGreaterThan(1.5 * weight);
    // And settles.
    expect(Math.abs(landed.state.bodyHeave ?? 1)).toBeLessThan(0.01);
    expect(loads(landed.state).reduce((sum, load) => sum + load, 0)).toBeCloseTo(weight, -2);
  });

  it('puts the steering wheel on the wheels in direct control', () => {
    const assisted = drive(
      1,
      () => ({ throttle: 0.2, steering: 1, brake: false }),
      rolling(30),
    ).state;
    const direct = drive(
      1,
      () => ({ throttle: 0.2, steering: 1, brake: false, controlMode: 'direct' }),
      rolling(30),
    ).state;
    // At speed the assist holds the lock to what the tires can use; direct gives all of it.
    expect(Math.abs(assisted.steer)).toBeLessThan(0.5 * sedan.maxSteer);
    expect(Math.abs(direct.steer)).toBeCloseTo(sedan.maxSteer, 2);
    expect(direct.skid).toBeGreaterThan(0.9);
  });

  it('is unchanged for a car without wheels on struts', () => {
    const { wheels: _wheels, ...axles } = sedan;
    const end = drive(2, () => ({ throttle: 1, steering: 0.2, brake: false }), rolling(5), axles);
    expect(end.state.wheelSpin).toBeUndefined();
    expect(end.state.wheelLoad).toBeUndefined();
    expect(end.state.speed).toBeGreaterThan(8);
  });
});
