import { describe, expect, it } from 'vitest';
import { Transform, type TransformData } from '../src/component';
import { quatRotateVec3 } from '../src/math3d';
import {
  initialVehicleState,
  installVehicles,
  Mounted,
  mountEntity,
  rightVehicle,
  stepVehicle,
  unmountEntity,
  type VehicleEnvironment,
  type VehicleInputData,
  VehicleState,
  type VehicleStateData,
  vehicleMounts,
  vehicleRotation,
} from '../src/vehicles';
import { World } from '../src/world';
import { molenVehicle } from './helpers/entities';

const sedan = molenVehicle('molen.entities.vehicle.sedan');
const coupe = molenVehicle('molen.entities.vehicle.porsche_911_2017');
const motorhome = molenVehicle('molen.entities.vehicle.bendy_class_c_family');
const G = 9.81;

type Drive = { transform: TransformData; state: VehicleStateData; impact: number };
type Ground = VehicleEnvironment['groundHeight'];
const flat: Ground = () => 0;
const standing = (at: [number, number, number] = [0, 0, 0], yaw = 0): Drive => ({
  transform: { pos: at, rot: vehicleRotation(yaw) },
  state: initialVehicleState(yaw),
  impact: 0,
});
/** Which way the car's roof points, as the height of its up axis: 1 upright, -1 on its roof. */
const upright = (drive: Drive): number => quatRotateVec3(drive.transform.rot, [0, 1, 0])[1];

function run(
  spec: typeof sedan.spec,
  seconds: number,
  controls: (time: number, state: VehicleStateData) => VehicleInputData,
  env: VehicleEnvironment,
  start = standing(),
  watch: (drive: Drive, time: number) => void = () => {},
  hz = 60,
): Drive {
  let drive = start;
  let hardest = start.impact;
  for (let tick = 0; tick < seconds * hz; tick++) {
    const time = tick / hz;
    const result = stepVehicle(
      drive.transform,
      drive.state,
      controls(time, drive.state),
      spec,
      1 / hz,
      env,
    );
    hardest = Math.max(hardest, result.impact);
    drive = { transform: result.transform, state: result.state, impact: hardest };
    watch(drive, time + 1 / hz);
  }
  return drive;
}
const braked = (): VehicleInputData => ({ throttle: 0, steering: 0, brake: true });
const pull = (throttle: number, steering = 0): VehicleInputData => ({
  throttle,
  steering,
  brake: false,
});

describe('a car off the plane of its road', () => {
  it('falls as a free body, lands on its springs and is a car on the road again', () => {
    const dropped = standing([0, 1.2, 0]);
    dropped.state.grounded = false;
    let fell = 0;
    let heaviest = 0;
    let lowest = Infinity;
    const end = run(sedan.spec, 3, braked, { groundHeight: flat }, dropped, (drive, time) => {
      if (time < 0.3) {
        // In the air it is its own body, falling as anything does.
        expect(drive.state.freeBody).toBeDefined();
        expect(drive.state.grounded).toBe(false);
        fell = drive.state.vy;
      }
      heaviest = Math.max(heaviest, drive.state.wheelLoad?.[0] ?? 0);
      lowest = Math.min(lowest, drive.transform.pos[1]);
    });
    expect(fell).toBeCloseTo(-G * 0.3, 0);
    // The struts take the landing: several times the standing load, the body down on them
    // by more than a hand's width, and nothing but the tires touching.
    const resting =
      (sedan.spec.mass * G * (sedan.spec.wheelbase / 2 + sedan.spec.centerOfMass[2])) /
      sedan.spec.wheelbase /
      2;
    expect(heaviest).toBeGreaterThan(3 * resting);
    expect(lowest).toBeLessThan(-0.08);
    expect(lowest).toBeGreaterThan(-0.25);
    expect(end.impact).toBe(0);
    expect(end.state.freeBody).toBeUndefined();
    expect(end.state.grounded).toBe(true);
    expect(end.state.speed).toBe(0);
    expect(Math.abs(end.transform.pos[1])).toBeLessThan(0.005);
    expect(upright(end)).toBeGreaterThan(0.9999);
  });

  it('drives off a ledge nose first: the rear wheels are still on it as the front falls', () => {
    const ledge: Ground = (_x, z) => (z < 60 ? 3 : 0);
    let steepest = 0;
    let rolled = 0;
    let rearOnly = false;
    let flew = 0;
    const end = run(
      sedan.spec,
      10,
      (time) => (time < 6 ? pull(0.6) : time > 7 ? braked() : pull(0)),
      { groundHeight: ledge },
      standing([0, 3, 0]),
      (drive) => {
        if (!drive.state.freeBody) return;
        const load = drive.state.wheelLoad ?? [0, 0, 0, 0];
        if (load[0] === 0 && load[1] === 0 && load[2] > 1000 && load[3] > 1000) rearOnly = true;
        if (!drive.state.grounded) flew += 1 / 60;
        steepest = Math.max(steepest, drive.state.pitch);
        rolled = Math.max(rolled, Math.abs(drive.state.roll));
      },
    );
    expect(rearOnly).toBe(true);
    // Nose down by 20 degrees or more by the time it lands, and never a degree of roll: the
    // ledge is square to it.
    expect(steepest).toBeGreaterThan(0.35);
    expect(steepest).toBeLessThan(0.7);
    expect(rolled).toBeLessThan(0.001);
    // Three meters takes about three quarters of a second to fall.
    expect(flew).toBeGreaterThan(0.5);
    expect(flew).toBeLessThan(1);
    // The nose comes down first, and hard.
    expect(end.impact).toBeGreaterThan(3);
    expect(end.state.freeBody).toBeUndefined();
    expect(end.state.speed).toBe(0);
    expect(end.transform.pos[2]).toBeGreaterThan(65);
    expect(Math.abs(end.transform.pos[1])).toBeLessThan(0.01);
  });

  it('leaves a ramp with the climb the ramp gave it', () => {
    // Twelve meters of ramp at 17 degrees, then nothing.
    const ramp: Ground = (_x, z) => (z > 150 && z < 162 ? (z - 150) * 0.3 : 0);
    let lip: Drive | undefined;
    let apex = 0;
    let landed: Drive | undefined;
    run(
      coupe.spec,
      14,
      (time) => pull(time < 9 ? 1 : 0),
      { groundHeight: ramp },
      standing(),
      (drive) => {
        // The lip: the last of its wheels has left the ramp.
        if (drive.state.freeBody && !drive.state.grounded && !lip) lip = drive;
        if (lip && !landed) apex = Math.max(apex, drive.transform.pos[1]);
        if (lip && !landed && !drive.state.freeBody) landed = drive;
      },
    );
    if (!lip || !landed) throw new Error('The car did not fly');
    const speed = lip.state.speed;
    // It left climbing at about the ramp's own slope.
    expect(lip.state.vy / speed).toBeGreaterThan(0.24);
    expect(lip.state.vy / speed).toBeLessThan(0.32);
    // From there it is a thrown stone, less a little to the air.
    const rise = lip.state.vy ** 2 / (2 * G);
    expect(apex - lip.transform.pos[1]).toBeGreaterThan(0.85 * rise);
    expect(apex - lip.transform.pos[1]).toBeLessThan(1.02 * rise);
    const flight = (2 * lip.state.vy) / G;
    expect(landed.transform.pos[2] - lip.transform.pos[2]).toBeGreaterThan(0.8 * speed * flight);
    // It comes down on its wheels and keeps going.
    expect(upright(landed)).toBeGreaterThan(0.95);
    expect(landed.state.speed).toBeGreaterThan(20);
  });

  it('carries the travel boost through the air: four times as far in the same time', () => {
    // Thrown level at 10 m/s from two meters up, with and without the boost.
    const fly = (boostMode: boolean) => {
      const thrown = standing([0, 2, 0]);
      thrown.state.grounded = false;
      thrown.state.freeBody = { velocity: [0, 0, boostMode ? 40 : 10], omega: [0, 0, 0] };
      if (boostMode) thrown.state.boosted = true;
      let down = 0;
      let to = 0;
      let reported = 0;
      run(
        sedan.spec,
        2,
        () => pull(0),
        { groundHeight: flat, boostMode },
        thrown,
        (drive, time) => {
          if (down > 0) return;
          if (drive.state.grounded) {
            down = time;
            to = drive.transform.pos[2];
          } else reported = drive.state.speed;
        },
      );
      return { airtime: down, distance: to, reported };
    };
    const plain = fly(false);
    const boosted = fly(true);
    // The fall takes what a fall takes, boosted or not.
    expect(plain.airtime).toBeGreaterThan(0.5);
    expect(plain.airtime).toBeLessThan(0.75);
    expect(boosted.airtime).toBeCloseTo(plain.airtime, 1);
    expect(plain.distance).toBeGreaterThan(5);
    expect(boosted.distance / plain.distance).toBeGreaterThan(3.8);
    expect(boosted.distance / plain.distance).toBeLessThan(4.2);
    // And its speed reads four times as high, as on the road.
    expect(boosted.reported / plain.reported).toBeCloseTo(4, 1);
  });

  it('stays where it is where the ground under it is not there to ask', () => {
    const hole: Ground = (_x, z) => (z > 5 ? undefined : 0);
    const falling = standing([0, 2, 4.5]);
    falling.state.freeBody = { velocity: [0, 0, 6], omega: [0, 0, 0] };
    falling.state.grounded = false;
    const end = run(sedan.spec, 0.5, braked, { groundHeight: hole }, falling);
    expect(end.state.waitingForTerrain).toBe(true);
    expect(end.state.freeBody).toBeDefined();
    // It waits just short of the edge of what is loaded.
    expect(end.transform.pos[2]).toBeLessThan(5);
    expect(end.transform.pos[1]).toBeGreaterThan(1);
  });
});

describe('rolling over', () => {
  // Hard one way, then hard the other: the manoeuvre that finds a rollover if there is one.
  const fishhook =
    (at: number) =>
    (time: number): VehicleInputData =>
      pull(time < at ? 1 : 0.2, time < at ? 0 : time < at + 1 ? -1 : 1);

  it('does not happen to a sedan: it is wider than it is tall, and slides first', () => {
    let free = 0;
    let most = 0;
    const end = run(sedan.spec, 18, fishhook(10), { groundHeight: flat }, standing(), (drive) => {
      if (drive.state.freeBody) free++;
      most = Math.max(most, Math.abs(drive.state.roll + (drive.state.bodyRoll ?? 0)));
    });
    expect(sedan.spec.wheelTrack / 2 / sedan.spec.centerOfMass[1]).toBeGreaterThan(1.3);
    expect(free).toBe(0);
    expect(most).toBeLessThan(0.1);
    expect(upright(end)).toBeGreaterThan(0.99);
  });

  it('happens to a tall, narrow motorhome on tires that grip harder than it can stand', () => {
    // On its own tires this one slides before it tips; on stickier ones it does not.
    const spec = { ...motorhome.spec, grip: 1.0 * G };
    // Half its track over the height of its mass, against the grip of its tires.
    expect(spec.wheelTrack / 2 / spec.centerOfMass[1]).toBeLessThan(0.75);
    expect(motorhome.spec.grip / G).toBeLessThan(0.75);
    let twoWheels = false;
    const end = run(spec, 26, fishhook(14), { groundHeight: flat }, standing(), (drive) => {
      const load = drive.state.wheelLoad ?? [1, 1, 1, 1];
      // On the way over it balances on one side's wheels.
      if (
        drive.state.freeBody &&
        ((load[0] === 0 && load[2] === 0 && load[1] > 0 && load[3] > 0) ||
          (load[1] === 0 && load[3] === 0 && load[0] > 0 && load[2] > 0))
      )
        twoWheels = true;
    });
    expect(twoWheels).toBe(true);
    // It ends on its side, slid to a stop, and stays there.
    expect(Math.abs(upright(end))).toBeLessThan(0.2);
    expect(end.state.freeBody?.still).toBeGreaterThan(0.5);
    expect(end.state.speed).toBe(0);
    expect(end.state.lateralSpeed).toBe(0);
    expect(end.state.yawRate).toBe(0);
    expect(end.state.grounded).toBe(false);
    // Lying on its side its middle is half its width off the road.
    expect(end.transform.pos[1]).toBeGreaterThan(0.4 * spec.width);
    expect(end.transform.pos[1]).toBeLessThan(0.6 * spec.width);
    expect(end.impact).toBeGreaterThan(2);
  });

  it('tips on a tilting table near the angle its track and the height of its mass give', () => {
    // A table tilted slowly about the car's long axis, with a surface it cannot slide on.
    const tipAngle = (spec: typeof sedan.spec): number => {
      let degrees = 12;
      const env: VehicleEnvironment = {
        groundHeight: (x) => -x * Math.tan((degrees * Math.PI) / 180),
        surface: () => ({ grip: 4, drag: 0, roughness: 0 }),
      };
      const angle = (degrees * Math.PI) / 180;
      const start: Drive = {
        transform: { pos: [0, 0, 0], rot: vehicleRotation(0, 0, -angle) },
        state: {
          ...initialVehicleState(),
          roll: -angle,
          freeBody: { velocity: [0, 0, 0], omega: [0, 0, 0] },
        },
        impact: 0,
      };
      let tipped = 0;
      // On a table this steep it stays its own body: there is no road here to hand it to.
      run({ ...spec, maxSlope: 0 }, 55, braked, env, start, (drive, time) => {
        degrees = 12 + time;
        const normal = [Math.sin((degrees * Math.PI) / 180), Math.cos((degrees * Math.PI) / 180)];
        const top = quatRotateVec3(drive.transform.rot, [0, 1, 0]);
        if (tipped === 0 && top[0] * (normal[0] ?? 0) + top[1] * (normal[1] ?? 1) < 0.9)
          tipped = degrees;
      });
      return Math.tan((tipped * Math.PI) / 180);
    };
    for (const spec of [sedan.spec, motorhome.spec]) {
      const factor = spec.wheelTrack / 2 / spec.centerOfMass[1];
      const ratio = tipAngle(spec) / factor;
      // A sprung body leans downhill and tips sooner than a rigid block would: by a tenth
      // or so, as measured cars do.
      expect(ratio).toBeGreaterThan(0.8);
      expect(ratio).toBeLessThan(1);
    }
  });

  it('tumbles down a bank without gaining energy', () => {
    // A 35 degree bank falling away to the right of a road.
    const bank: Ground = (x) => (x < -3 ? (x + 3) * 0.7 : 0);
    const spec = sedan.spec;
    const energy = (drive: Drive): number => {
      const body = drive.state.freeBody;
      if (!body) return 0;
      const center =
        drive.transform.pos[1] + quatRotateVec3(drive.transform.rot, spec.centerOfMass)[1];
      const linear =
        0.5 * spec.mass * (body.velocity[0] ** 2 + body.velocity[1] ** 2 + body.velocity[2] ** 2);
      const inertia = [
        (spec.mass * (spec.height ** 2 + spec.length ** 2)) / 12,
        spec.yawInertia ?? (spec.mass * (spec.length ** 2 + spec.width ** 2)) / 12,
        (spec.mass * (spec.width ** 2 + spec.height ** 2)) / 12,
      ];
      const turning =
        0.5 *
        (inertia[0] * body.omega[0] ** 2 +
          inertia[1] * body.omega[1] ** 2 +
          inertia[2] * body.omega[2] ** 2);
      return linear + turning + spec.mass * G * center;
    };
    // Sideways onto the bank at 12 m/s.
    const start: Drive = {
      transform: { pos: [0, 0.3, 0], rot: vehicleRotation(0) },
      state: {
        ...initialVehicleState(),
        grounded: false,
        freeBody: { velocity: [-12, 0, 0], omega: [0, 0, 0] },
      },
      impact: 0,
    };
    const first = energy(start);
    let most = first;
    let turnedOver = false;
    const end = run(spec, 14, braked, { groundHeight: bank }, start, (drive) => {
      if (!drive.state.freeBody) return;
      most = Math.max(most, energy(drive));
      if (upright(drive) < 0) turnedOver = true;
    });
    expect(turnedOver).toBe(true);
    // It only ever loses energy, to its tires, its dampers and the ground: never more than it
    // began with, give or take what moving a corner back out of the ground adds.
    expect(most - first).toBeLessThan(0.02 * 0.5 * spec.mass * 12 ** 2);
    expect(end.transform.pos[0]).toBeLessThan(-8);
    expect(end.transform.pos[1]).toBeLessThan(-2);
  });

  it('comes out the same at 30, 60 and 120 steps a second', () => {
    const ledge: Ground = (_x, z) => (z < 60 ? 3 : 0);
    const landing = (hz: number): number => {
      let at = 0;
      run(
        sedan.spec,
        9,
        (time) => (time < 6 ? pull(0.6) : pull(0)),
        { groundHeight: ledge },
        standing([0, 3, 0]),
        (drive) => {
          if (at === 0 && drive.transform.pos[2] > 62 && drive.state.grounded)
            at = drive.transform.pos[2];
        },
        hz,
      );
      return at;
    };
    const reference = landing(60);
    expect(reference).toBeGreaterThan(64);
    expect(Math.abs(landing(30) - reference)).toBeLessThan(1.5);
    expect(Math.abs(landing(120) - reference)).toBeLessThan(1.5);
  });
});

describe('a car lying off its wheels', () => {
  function overturned(): World {
    const world = new World({ tickRate: 60 });
    const env: VehicleEnvironment = { groundHeight: flat };
    installVehicles(world, env);
    world.spawnRaw(
      {
        // On its roof, a little above the road.
        transform: { pos: [0, 1.7, 0], rot: vehicleRotation(0.4, 0, Math.PI) },
        vehicle: sedan,
        vehicleState: {
          ...initialVehicleState(0.4),
          grounded: false,
          freeBody: { velocity: [0, 0, 0], omega: [0, 0, 0] },
        },
        mountable: vehicleMounts(sedan.spec),
      },
      'car',
    );
    world.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'driver');
    world.set('driver', Mounted, { vehicle: 'car', seat: 'driver' });
    return world;
  }

  it('rests on its roof, lets its driver out beside it, and can be set back on its wheels', () => {
    const world = overturned();
    const env: VehicleEnvironment = { groundHeight: flat };
    for (let tick = 0; tick < 180; tick++) world.step();
    const lying = world.get('car', VehicleState);
    const pose = world.get('car', Transform);
    if (!lying || !pose) throw new Error('No car');
    expect(lying.freeBody?.still).toBeGreaterThan(0.5);
    expect(lying.speed).toBe(0);
    expect(quatRotateVec3(pose.rot, [0, 1, 0])[1]).toBeLessThan(-0.95);
    // Its floor is uppermost, a roof's height above the road.
    expect(pose.pos[1]).toBeGreaterThan(0.85 * sedan.spec.height);
    expect(pose.pos[1]).toBeLessThan(1.1 * sedan.spec.height);

    // The driver gets out onto the road beside it, standing up.
    expect(unmountEntity(world, 'driver', env)).toBe(true);
    const out = world.get('driver', Transform);
    expect(out?.pos[1]).toBeCloseTo(0.02, 6);
    expect(
      Math.hypot((out?.pos[0] ?? 0) - pose.pos[0], (out?.pos[2] ?? 0) - pose.pos[2]),
    ).toBeGreaterThan(1);
    expect(quatRotateVec3(out?.rot ?? [0, 0, 0, 1], [0, 1, 0])[1]).toBeCloseTo(1, 6);

    expect(rightVehicle(world, 'car', env)).toBe(true);
    const righted = world.get('car', VehicleState);
    const stood = world.get('car', Transform);
    expect(righted?.freeBody).toBeUndefined();
    expect(righted?.yaw).toBeCloseTo(lying.yaw, 6);
    expect(stood?.pos[1]).toBe(0);
    expect(quatRotateVec3(stood?.rot ?? [0, 0, 0, 1], [0, 1, 0])[1]).toBeCloseTo(1, 6);
    // It stands over where it lay.
    expect(
      Math.hypot((stood?.pos[0] ?? 9) - pose.pos[0], (stood?.pos[2] ?? 9) - pose.pos[2]),
    ).toBeLessThan(1.5);
    // On its wheels there is nothing to right, and it can be driven away.
    expect(rightVehicle(world, 'car', env)).toBe(false);
    expect(mountEntity(world, 'driver', 'car')).toBe(true);
  });

  it('is not righted while it is still moving', () => {
    const world = overturned();
    world.patch('car', VehicleState, { freeBody: { velocity: [0, -3, 4], omega: [0, 0, 2] } });
    expect(rightVehicle(world, 'car', { groundHeight: flat })).toBe(false);
  });

  it('is climbed out of where its doors are blocked, and left beside it with nowhere clear', () => {
    const world = overturned();
    for (let tick = 0; tick < 180; tick++) world.step();
    const pose = world.get('car', Transform) as TransformData;
    const away = (pos: readonly number[]): number =>
      Math.hypot((pos[0] ?? 0) - pose.pos[0], (pos[2] ?? 0) - pose.pos[2]);
    // A hedge 2.4 m round it: both doors and the near ground are in it.
    const hedge: VehicleEnvironment = { groundHeight: flat, canExit: (pos) => away(pos) > 2.4 };
    expect(unmountEntity(world, 'driver', hedge)).toBe(true);
    const out = world.get('driver', Transform);
    expect(away(out?.pos ?? [])).toBeGreaterThan(2.4);
    expect(away(out?.pos ?? [])).toBeLessThan(4);
    expect(out?.pos[1]).toBeCloseTo(0.02, 6);

    // Nowhere the host calls clear: a wreck is still left, on the ground beside it.
    world.set('driver', Mounted, { vehicle: 'car', seat: 'driver' });
    expect(unmountEntity(world, 'driver', { groundHeight: flat, canExit: () => false })).toBe(true);
    const beside = world.get('driver', Transform);
    expect(away(beside?.pos ?? [])).toBeGreaterThan(sedan.spec.width / 2);
    expect(away(beside?.pos ?? [])).toBeLessThan(2);
    expect(beside?.pos[1]).toBeCloseTo(0.02, 6);
  });

  it('hangs where the host blocks it without gathering speed it is not moving at', () => {
    // Caught nose up in a tree three meters over the road, where every pose it could fall to is
    // taken: the body stays put, and so must what it reports.
    const world = new World({ tickRate: 60 });
    installVehicles(world, { groundHeight: flat, canOccupy: () => false });
    world.spawnRaw(
      {
        transform: { pos: [0, 3, 0], rot: vehicleRotation(0, -1.1, 0) },
        vehicle: sedan,
        vehicleState: {
          ...initialVehicleState(0),
          grounded: false,
          freeBody: { velocity: [0, 0, 0], omega: [0, 0, 0] },
        },
        mountable: vehicleMounts(sedan.spec),
      },
      'car',
    );
    world.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'driver');
    world.set('driver', Mounted, { vehicle: 'car', seat: 'driver' });
    for (let tick = 0; tick < 120; tick++) world.step();
    const hung = world.get('car', VehicleState);
    expect(world.get('car', Transform)?.pos[1]).toBeCloseTo(3, 6);
    expect(Math.hypot(...(hung?.freeBody?.velocity ?? [9, 9, 9]))).toBeLessThan(0.2);
    expect(Math.hypot(hung?.speed ?? 9, hung?.lateralSpeed ?? 9)).toBeLessThan(0.2);
    // So its driver can get out, onto the road under it.
    expect(unmountEntity(world, 'driver', { groundHeight: flat })).toBe(true);
    expect(world.get('driver', Transform)?.pos[1]).toBeCloseTo(0.02, 6);
  });
});
