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
import { strutReach } from '../src/vehicle-wheels';
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

describe('each wheel on its own road', () => {
  const weight = sedan.mass * G;
  const reach = strutReach(sedan);
  const stop = sedan.wheels?.travel ?? 0.09;
  const holding = (speed: number) => (state: VehicleStateData) => ({
    throttle: state.speed < speed ? 0.3 : 0,
    steering: 0,
    brake: false,
  });
  /** A smooth hump `height` high and `length` long, centred on `at`. */
  const hump = (d: number, height: number, length: number): number =>
    Math.abs(d) < length / 2 ? height * 0.5 * (1 + Math.cos((2 * Math.PI * d) / length)) : 0;
  const travels = (state: VehicleStateData): [number, number, number, number] => {
    if (!state.wheelTravel) throw new Error('No wheel travel');
    return state.wheelTravel;
  };
  /** The most each strut closed and opened, and the most the body rose, pitched and rolled. */
  const cross = (
    env: VehicleEnvironment,
    speed: number,
    seconds: number,
    start = rolling(speed),
  ) => {
    const closed = [0, 0, 0, 0];
    const opened = [0, 0, 0, 0];
    let rise = 0;
    let pitch = 0;
    let roll = 0;
    let free = 0;
    let heaviest = 0;
    const base = start.transform.pos[1];
    const end = drive(seconds, holding(speed), start, sedan, env, (result) => {
      const state = result.state;
      if (state.freeBody) free++;
      for (const [i, travel] of travels(state).entries()) {
        closed[i] = Math.max(closed[i] ?? 0, travel);
        opened[i] = Math.min(opened[i] ?? 0, travel);
      }
      rise = Math.max(rise, Math.abs(result.transform.pos[1] - base));
      pitch = Math.max(pitch, Math.abs(state.pitch + (state.bodyPitch ?? 0)));
      roll = Math.max(roll, Math.abs(state.roll + (state.bodyRoll ?? 0)));
      heaviest = Math.max(heaviest, ...loads(state));
    });
    return { closed, opened, rise, pitch, roll, free, heaviest, end };
  };

  it('reports no travel standing level, and the dive of its nose as travel under braking', () => {
    const standing = drive(2, () => ({ throttle: 0, steering: 0, brake: true }), rolling(0)).state;
    for (const travel of travels(standing)) expect(Math.abs(travel)).toBeLessThan(1e-4);
    // A level road is left unsaid.
    expect(standing.wheelRoad).toBeUndefined();
    expect(standing.wheelRoadRate).toBeUndefined();
    const braking = drive(1, () => ({ throttle: 0, steering: 0, brake: true }), rolling(25)).state;
    const [fl, fr, rl, rr] = travels(braking);
    expect(fl).toBeGreaterThan(0.01);
    expect(fl).toBeCloseTo(fr, 6);
    expect(rl).toBeLessThan(-0.01);
    expect(rl).toBeCloseTo(rr, 6);
  });

  it('takes a bump under one wheel on that wheel: its strut closes and the body barely moves', () => {
    // Six centimeters of hump, 1.2 m long, under the left wheels only.
    const env: VehicleEnvironment = {
      groundHeight: (x, z) => (x > 0.3 ? hump(z - 20, 0.06, 1.2) : 0),
    };
    const run = cross(env, 8, 5);
    const [fl, fr, rl, rr] = run.closed as [number, number, number, number];
    // Each left strut takes most of the hump as its wheel goes over, the right ones almost none.
    expect(fl).toBeGreaterThan(0.035);
    expect(rl).toBeGreaterThan(0.035);
    expect(fr).toBeLessThan(0.02);
    expect(rr).toBeLessThan(0.02);
    // The body rises a fraction of what the wheel did and leans a degree or so.
    expect(run.rise).toBeLessThan(0.02);
    expect(run.roll).toBeGreaterThan(0.004);
    expect(run.roll).toBeLessThan(0.03);
    expect(run.free).toBe(0);
    // And it is gone again: level, at rest on its springs, its weight on its wheels.
    for (const travel of travels(run.end.state)) expect(Math.abs(travel)).toBeLessThan(0.004);
    expect(loads(run.end.state).reduce((sum, load) => sum + load, 0)).toBeCloseTo(weight, -3);
    expect(run.end.transform.pos[2]).toBeGreaterThan(35);
  });

  it('rides a speed bump on its front axle and then its rear', () => {
    const env: VehicleEnvironment = { groundHeight: (_x, z) => hump(z - 20, 0.08, 2) };
    let frontAt = 0;
    let rearAt = 0;
    let front = 0;
    let rear = 0;
    drive(5, holding(6), rolling(6), sedan, env, (result, time) => {
      const [fl, , rl] = travels(result.state);
      if (fl > front) {
        front = fl;
        frontAt = time;
      }
      if (rl > rear) {
        rear = rl;
        rearAt = time;
      }
    });
    // A bump two meters long lifts the whole car as well as closing its struts.
    expect(front).toBeGreaterThan(0.02);
    expect(rear).toBeGreaterThan(0.02);
    expect(front).toBeLessThan(0.08);
    // The rear axle meets it a wheelbase later.
    expect(rearAt - frontAt).toBeGreaterThan((0.7 * sedan.wheelbase) / 6);
    expect(rearAt - frontAt).toBeLessThan((1.4 * sedan.wheelbase) / 6);
    // The two sides are the same road, and stay the same.
    const run = cross(env, 6, 5);
    expect(run.roll).toBeLessThan(1e-6);
    // The body goes over about half the bump's height, a little late and without the jolt.
    expect(run.rise).toBeGreaterThan(0.02);
    expect(run.rise).toBeLessThan(0.08);
    expect(run.free).toBe(0);
  });

  it('drops a wheel into a pothole on its strut, and hangs it over a hole too deep to reach', () => {
    const shallow: VehicleEnvironment = {
      groundHeight: (x, z) => (x < -0.3 ? -hump(z - 20, 0.05, 1) : 0),
    };
    const run = cross(shallow, 8, 5);
    // The right wheels go down into it; the body stays up on the other three.
    expect(run.opened[1]).toBeLessThan(-0.025);
    expect(run.opened[3]).toBeLessThan(-0.025);
    expect(run.opened[0]).toBeGreaterThan(-0.02);
    expect(run.rise).toBeLessThan(0.015);
    // A hole deeper than the strut is long leaves the wheel hanging at the end of it, unloaded.
    const deep: VehicleEnvironment = {
      groundHeight: (x, z) => (x < -0.3 && Math.abs(z - 20) < 0.5 ? -0.5 : 0),
    };
    let hung = false;
    const over = drive(5, holding(12), rolling(12), sedan, deep, (result) => {
      const travel = travels(result.state);
      if (travel[1] === -reach && loads(result.state)[1] === 0) hung = true;
      for (const value of travel) expect(value).toBeGreaterThanOrEqual(-reach);
    });
    expect(hung).toBe(true);
    expect(over.state.freeBody).toBeUndefined();
    expect(over.transform.pos[2]).toBeGreaterThan(40);
  });

  it('stands on a twisted road with every wheel on it', () => {
    // The front left wheel is parked on a 6 cm block.
    const env: VehicleEnvironment = {
      groundHeight: (x, z) => (x > 0.3 && z > 0.5 ? 0.06 : 0),
    };
    const start = rolling(0);
    start.transform.pos[1] = 0.015;
    const parked = drive(4, () => ({ throttle: 0, steering: 0, brake: true }), start, sedan, env);
    const [fl, fr, rl, rr] = travels(parked.state);
    // The block closes its own strut and the one diagonally across, and opens the other two.
    expect(fl).toBeGreaterThan(0.005);
    expect(rr).toBeGreaterThan(0.005);
    expect(fr).toBeLessThan(-0.005);
    expect(rl).toBeLessThan(-0.005);
    // What the road is twisted by is all in the struts: together they make up the block.
    expect(fl - fr - rl + rr).toBeCloseTo(0.06, 2);
    expect(loads(parked.state).reduce((sum, load) => sum + load, 0)).toBeCloseTo(weight, -2);
    // The plane it stands on is tipped by the block; the road's twist is what is left over.
    const twist = parked.state.wheelRoad ?? [0, 0, 0, 0];
    expect(twist[0]).toBeCloseTo(0.015, 3);
    expect(twist[1]).toBeCloseTo(-0.015, 3);
    expect(parked.state.speed).toBe(0);
  });

  it('climbs and descends a steady grade at its ride height', () => {
    for (const grade of [0.1, -0.1]) {
      const env: VehicleEnvironment = { groundHeight: (_x, z) => z * grade };
      const level = drive(4, holding(20), rolling(20)).state;
      const start = rolling(20);
      start.state.pitch = -Math.atan(grade);
      start.transform.rot = [
        Math.sin(-Math.atan(grade) / 2),
        0,
        0,
        Math.cos(-Math.atan(grade) / 2),
      ];
      const climbing = drive(4, holding(20), start, sedan, env);
      // The road rises under it at two meters a second, and the dampers do not feel it: the
      // struts sit where they do on the level, but for the weight the slope moves aft or forward.
      const flatTravel = travels(level);
      for (const [i, travel] of travels(climbing.state).entries())
        expect(Math.abs(travel - (flatTravel[i] ?? 0))).toBeLessThan(0.012);
      expect(Math.abs(climbing.state.bodyHeave ?? 1)).toBeLessThan(0.01);
      expect(climbing.state.freeBody).toBeUndefined();
      // Its height is the road's.
      expect(climbing.transform.pos[1]).toBeCloseTo(climbing.transform.pos[2] * grade, 1);
    }
  });

  it('turns on a slope without the slope turning it over its springs', () => {
    // A circle on a hillside: the slope swings from ahead of the car to beside it and back.
    const lean = (env: VehicleEnvironment, y: number) => {
      let most = 0;
      const start = rolling(8);
      start.transform.pos[1] = y;
      drive(
        12,
        (state) => ({ throttle: state.speed < 8 ? 0.4 : 0.05, steering: 0.35, brake: false }),
        start,
        sedan,
        env,
        (result, time) => {
          if (time > 2)
            most = Math.max(
              most,
              Math.abs(result.state.bodyRoll ?? 0) + Math.abs(result.state.bodyPitch ?? 0),
            );
          expect(result.state.freeBody).toBeUndefined();
        },
      );
      return most;
    };
    const level = lean(flat, 0);
    const hillside = lean({ groundHeight: (x, z) => 0.12 * x + 0.05 * z }, 0);
    // On the hill the body leans on its springs as it does on the level, and a little more
    // where it runs faster downhill and where the slope pulls it sideways: never by the slope
    // itself (0.13 rad), which the plane it is solved in carries round with the car.
    expect(level).toBeGreaterThan(0.005);
    expect(hillside).toBeGreaterThan(level);
    expect(hillside).toBeLessThan(level + 0.04);
  });

  it('is carried by the road once a strut is closed solid, and opens it again slowly', () => {
    // The foot of a 17 degree ramp, met at 25 m/s: far more than the struts can take up.
    const env: VehicleEnvironment = {
      groundHeight: (_x, z) => (z > 30 ? (z - 30) * 0.3 : 0),
    };
    let most = 0;
    let spent = false;
    let free = 0;
    const end = drive(2.5, holding(25), rolling(25), sedan, env, (result) => {
      most = Math.max(most, ...travels(result.state));
      if (result.state.wheelSpent) spent = true;
      if (result.state.freeBody) free++;
    });
    // No strut closes past its stop, however hard the road comes up.
    expect(most).toBeGreaterThan(stop);
    expect(most).toBeLessThanOrEqual(1.5 * stop + 1e-4);
    expect(spent).toBe(true);
    // It is still a car on that road, climbing it, at its ride height again.
    expect(free).toBe(0);
    expect(end.state.wheelSpent).toBeUndefined();
    expect(end.state.speed).toBeGreaterThan(15);
    expect(end.transform.pos[1]).toBeCloseTo((end.transform.pos[2] - 30) * 0.3, 0);
    expect(Math.abs(end.state.bodyHeave ?? 1)).toBeLessThan(0.02);
    expect(end.state.pitch + (end.state.bodyPitch ?? 0)).toBeCloseTo(-Math.atan(0.3), 1);
  });

  it('hangs its wheels at the end of their struts in the air, and lands on them', () => {
    const start = rolling(10);
    start.transform.pos[1] = 0.8;
    start.state.grounded = false;
    let hanging = 0;
    let closed = 0;
    const landed = drive(
      3,
      () => ({ throttle: 0, steering: 0, brake: false }),
      start,
      sedan,
      flat,
      (r) => {
        const travel = travels(r.state);
        if (r.state.freeBody && !r.state.grounded) {
          hanging++;
          expect(travel).toEqual([-reach, -reach, -reach, -reach]);
        }
        closed = Math.max(closed, ...travel);
      },
    );
    expect(hanging).toBeGreaterThan(10);
    expect(closed).toBeGreaterThan(0.05);
    for (const travel of travels(landed.state)) expect(Math.abs(travel)).toBeLessThan(0.01);
  });

  it('comes out the same at 30, 60 and 120 steps a second', () => {
    const env: VehicleEnvironment = {
      groundHeight: (x, z) => (x > 0.3 ? hump(z - 20, 0.06, 1.2) : 0),
    };
    // Where each strut is with the front left wheel on the crest, 2.3 s in.
    const onCrest = (hz: number): [number, number, number, number] => {
      let result = rolling(8);
      for (let tick = 0; tick < Math.round(2.3 * hz); tick++)
        result = stepVehicle(
          result.transform,
          result.state,
          holding(8)(result.state),
          sedan,
          1 / hz,
          env,
        );
      return travels(result.state);
    };
    const reference = onCrest(60);
    expect(reference[0]).toBeGreaterThan(0.02);
    for (const hz of [30, 120])
      for (const [i, travel] of onCrest(hz).entries())
        expect(Math.abs(travel - (reference[i] ?? 0))).toBeLessThan(0.002);
  });
});
