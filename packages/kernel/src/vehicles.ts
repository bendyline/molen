import type {
  AircraftStateData,
  JsonObject,
  VehicleData,
  VehicleSpec,
} from '@bendyline/molen-schema';
import { type ComponentType, defineComponent, Transform, type TransformData } from './component';
import { dmath as m } from './dmath';
import { approach } from './math3d';
import { groundFieldOf } from './terrain';
import type { World } from './world';

export interface VehicleInputData extends JsonObject {
  throttle: number;
  steering: number;
  brake: boolean;
}
export interface VehicleStateData extends JsonObject {
  speed: number;
  steer: number;
  yaw: number;
  pitch: number;
  roll: number;
  vy: number;
  grounded: boolean;
  waitingForTerrain: boolean;
  wheelAngle: number;
}
export interface SeatData extends JsonObject {
  id: string;
  role: 'driver' | 'passenger';
  position: [number, number, number];
}
export interface MountableData extends JsonObject {
  seats: SeatData[];
  exits: [number, number, number][];
  reach: number;
}
export interface MountedData extends JsonObject {
  vehicle: string;
  seat: string;
}
export const Vehicle: ComponentType<VehicleData> = defineComponent<VehicleData>('vehicle');
export const VehicleInput: ComponentType<VehicleInputData> =
  defineComponent<VehicleInputData>('vehicleInput');
export const VehicleState: ComponentType<VehicleStateData> =
  defineComponent<VehicleStateData>('vehicleState');
export const Mountable: ComponentType<MountableData> = defineComponent<MountableData>('mountable');
export const Mounted: ComponentType<MountedData> = defineComponent<MountedData>('mounted');
export const IDLE_VEHICLE_INPUT: VehicleInputData = { throttle: 0, steering: 0, brake: true };

export function initialVehicleState(yaw = 0): VehicleStateData {
  return {
    speed: 0,
    steer: 0,
    yaw,
    pitch: 0,
    roll: 0,
    vy: 0,
    grounded: true,
    waitingForTerrain: false,
    wheelAngle: 0,
  };
}
export function vehicleMounts(spec: VehicleSpec): MountableData {
  return {
    seats: [{ id: 'driver', role: 'driver', position: [...spec.driverEye] }],
    exits: [
      [spec.width / 2 + 0.65, 0, spec.driverEye[2]],
      [-spec.width / 2 - 0.65, 0, spec.driverEye[2]],
      [0, 0, -spec.length / 2 - 0.8],
    ],
    reach: 3,
  };
}
/** Host collision adapter. All positions are absolute metric coordinates. */
export interface VehicleEnvironment {
  groundHeight(x: number, z: number): number | undefined;
  canOccupy?(
    position: [number, number, number],
    yaw: number,
    spec: VehicleSpec,
    entity: string,
  ): boolean;
  canExit?(position: [number, number, number], actor: string, vehicle: string): boolean;
}
export function vehicleRotation(
  yaw: number,
  pitch = 0,
  roll = 0,
): [number, number, number, number] {
  const c1 = m.cos(pitch / 2),
    c2 = m.cos(yaw / 2),
    c3 = m.cos(roll / 2);
  const s1 = m.sin(pitch / 2),
    s2 = m.sin(yaw / 2),
    s3 = m.sin(roll / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ];
}
export function vehicleLocalPoint(
  t: TransformData,
  point: [number, number, number],
): [number, number, number] {
  const [x, y, z] = point,
    [qx, qy, qz, qw] = t.rot;
  const tx = 2 * (qy * z - qz * y),
    ty = 2 * (qz * x - qx * z),
    tz = 2 * (qx * y - qy * x);
  return [
    t.pos[0] + x + qw * tx + qy * tz - qz * ty,
    t.pos[1] + y + qw * ty + qz * tx - qx * tz,
    t.pos[2] + z + qw * tz + qx * ty - qy * tx,
  ];
}
/** Substepped bicycle chassis, grip-limited steering and four wheel terrain support.
 * Grounded game physics; rigid-body crash deformation and rollovers are outside this solver.
 */
export function stepVehicle(
  t: TransformData,
  state: VehicleStateData,
  input: VehicleInputData,
  spec: VehicleSpec,
  dt: number,
  env: VehicleEnvironment,
  id = '',
): { transform: TransformData; state: VehicleStateData } {
  let pos: [number, number, number] = [...t.pos];
  const next = { ...state, waitingForTerrain: false };
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let step = 0; step < steps; step++) {
    const throttle = m.clamp(input.throttle, -1, 1);
    const steering =
      (m.clamp(input.steering, -1, 1) * spec.maxSteer) /
      (1 + m.abs(next.speed) / spec.steeringFadeSpeed);
    next.steer = approach(next.steer, steering, h * spec.steeringRate);
    const opposing = throttle * next.speed < -0.1;
    if (input.brake || opposing) next.speed = approach(next.speed, 0, spec.brakeDeceleration * h);
    else if (next.grounded) next.speed += ((throttle * spec.engineForce) / spec.mass) * h;
    if (next.grounded && !input.brake) next.speed += 9.81 * m.sin(next.pitch) * h;
    next.speed = approach(
      next.speed,
      0,
      (spec.rollingResistance + spec.aerodynamicResistance * next.speed * next.speed) * h,
    );
    next.speed = m.clamp(next.speed, -spec.reverseSpeed, spec.maxSpeed);
    const angular = next.grounded
      ? m.clamp(
          (-next.speed / spec.wheelbase) * m.tan(next.steer),
          -spec.grip / m.max(1, m.abs(next.speed)),
          spec.grip / m.max(1, m.abs(next.speed)),
        )
      : 0;
    const yaw = next.yaw + angular * h;
    const sx = m.sin(yaw),
      cz = m.cos(yaw);
    const candidate: [number, number, number] = [
      pos[0] + sx * next.speed * h,
      pos[1],
      pos[2] + cz * next.speed * h,
    ];
    const heights: number[] = [];
    for (const z of [spec.wheelbase / 2, -spec.wheelbase / 2]) {
      for (const x of [-spec.wheelTrack / 2, spec.wheelTrack / 2]) {
        const ground = env.groundHeight(
          candidate[0] + cz * x + sx * z,
          candidate[2] - sx * x + cz * z,
        );
        if (ground === undefined || !Number.isFinite(ground)) break;
        heights.push(ground);
      }
    }
    if (heights.length !== 4) {
      next.speed = 0;
      next.vy = 0;
      next.waitingForTerrain = true;
      break;
    }
    const [fl, fr, rl, rr] = heights as [number, number, number, number];
    const support = (fl + fr + rl + rr) / 4;
    const pitch = m.atan2((rl + rr - fl - fr) / 2, spec.wheelbase);
    const roll = m.atan2((fr + rr - fl - rl) / 2, spec.wheelTrack);
    // Curbs are climbable; abrupt steps and slopes above 35 degrees are barriers.
    if (
      support - pos[1] > spec.maxStepHeight ||
      m.abs(pitch) > spec.maxSlope ||
      m.abs(roll) > spec.maxSlope
    ) {
      next.speed = 0;
      break;
    }
    next.vy -= 9.81 * h;
    candidate[1] += next.vy * h;
    next.grounded = candidate[1] <= support + spec.supportTolerance;
    if (next.grounded) {
      candidate[1] = support;
      next.vy = 0;
    }
    if (env.canOccupy && !env.canOccupy(candidate, yaw, spec, id)) {
      next.speed = 0;
      break;
    }
    next.yaw = yaw;
    next.pitch = approach(next.pitch, pitch, h * spec.terrainAlignRate);
    next.roll = approach(next.roll, roll, h * spec.terrainAlignRate);
    next.wheelAngle = (next.wheelAngle + (next.speed * h) / spec.wheelRadius) % m.TAU;
    pos = candidate;
  }
  return {
    transform: { ...t, pos, rot: vehicleRotation(next.yaw, next.pitch, next.roll) },
    state: next,
  };
}
export function mountEntity(
  world: World,
  actor: string,
  vehicle: string,
  seatId = 'driver',
): boolean {
  if (
    actor === vehicle ||
    world.has(actor, Mounted) ||
    world.has(vehicle, Mounted) ||
    !mountStopped(world, vehicle)
  )
    return false;
  const t = world.get(vehicle, Transform),
    actorT = world.get(actor, Transform),
    mount = world.get(vehicle, Mountable);
  const seat = mount?.seats.find((s) => s.id === seatId);
  if (!t || !actorT || !mount || !seat || m.abs(world.get(vehicle, VehicleState)?.speed ?? 0) > 0.7)
    return false;
  const entry = vehicleLocalPoint(t, seat.position);
  if (
    m.hypot(actorT.pos[0] - entry[0], actorT.pos[1] - entry[1], actorT.pos[2] - entry[2]) >
    mount.reach
  )
    return false;
  for (const [, mounted] of world.query(Mounted))
    if (mounted.vehicle === vehicle && mounted.seat === seatId) return false;
  stopWalking(world, actor);
  world.set(actor, Mounted, { vehicle, seat: seatId });
  world.patch(actor, Transform, { pos: entry, rot: [...t.rot] });
  world.set(vehicle, VehicleInput, { ...IDLE_VEHICLE_INPUT });
  world.emit('vehicle-mounted', { actor, vehicle, seat: seatId });
  return true;
}
export function unmountEntity(world: World, actor: string, env: VehicleEnvironment): boolean {
  const mounted = world.get(actor, Mounted);
  if (!mounted) return false;
  if (!mountStopped(world, mounted.vehicle)) return false;
  const t = world.get(mounted.vehicle, Transform),
    mount = world.get(mounted.vehicle, Mountable);
  if (!t || !mount || m.abs(world.get(mounted.vehicle, VehicleState)?.speed ?? 0) > 0.7)
    return false;
  for (const offset of mount.exits) {
    const pos = vehicleLocalPoint(t, offset);
    const ground = env.groundHeight(pos[0], pos[2]);
    if (ground === undefined || m.abs(ground - t.pos[1]) > 0.6) continue;
    pos[1] = ground + 0.02;
    if (env.canExit && !env.canExit(pos, actor, mounted.vehicle)) continue;
    stopWalking(world, actor);
    world.remove(actor, Mounted);
    world.patch(actor, Transform, { pos });
    world.set(mounted.vehicle, VehicleInput, { ...IDLE_VEHICLE_INPUT });
    if (world.has(mounted.vehicle, { name: 'aircraftInput' }))
      world.patch(
        mounted.vehicle,
        { name: 'aircraftInput' },
        { power: 0, engine: false, brake: true, pitch: 0, roll: 0, yaw: 0 },
      );
    world.emit('vehicle-unmounted', { actor, vehicle: mounted.vehicle });
    return true;
  }
  return false;
}
export function driveVehicle(world: World, actor: string, input: VehicleInputData): boolean {
  const mounted = world.get(actor, Mounted);
  if (!mounted || !world.has(mounted.vehicle, Vehicle)) return false;
  const seat = world.get(mounted.vehicle, Mountable)?.seats.find((s) => s.id === mounted.seat);
  if (
    seat?.role !== 'driver' ||
    !Number.isFinite(input.throttle) ||
    !Number.isFinite(input.steering)
  )
    return false;
  world.set(mounted.vehicle, VehicleInput, {
    throttle: m.clamp(input.throttle, -1, 1),
    steering: m.clamp(input.steering, -1, 1),
    brake: input.brake,
  });
  return true;
}
export function installVehicles(world: World, environment?: VehicleEnvironment): void {
  const env = environment ?? {
    groundHeight: (x: number, z: number) => groundFieldOf(world)?.sampleHeight(x, z) ?? 0,
  };
  world.addSystem(
    (w, ctx) => {
      const driven = new Set<string>();
      for (const [, mounted] of w.query(Mounted)) {
        if (
          w
            .get(mounted.vehicle, Mountable)
            ?.seats.some((s) => s.id === mounted.seat && s.role === 'driver')
        )
          driven.add(mounted.vehicle);
      }
      for (const [id, t, vehicle, state] of w.query(Transform, Vehicle, VehicleState)) {
        // Dormant parked vehicles cost no physics work. Their placement already includes support.
        if (!driven.has(id) && state.speed === 0) continue;
        const input = driven.has(id)
          ? (w.get(id, VehicleInput) ?? IDLE_VEHICLE_INPUT)
          : IDLE_VEHICLE_INPUT;
        const result = stepVehicle(t, state, input, vehicle.spec, ctx.dt, env, id);
        w.set(id, Transform, result.transform);
        w.set(id, VehicleState, result.state);
      }
    },
    { phase: 'physics', name: 'vehicles' },
  );
  installMountedSeats(world);
}

const mountedWorlds = new WeakSet<World>();
/** Shared seat following, installed once by either vehicle capability. */
export function installMountedSeats(world: World): void {
  if (mountedWorlds.has(world)) return;
  mountedWorlds.add(world);
  world.addSystem(
    (w) => {
      for (const [actor, mounted] of w.query(Mounted)) {
        const t = w.get(mounted.vehicle, Transform);
        const seat = w.get(mounted.vehicle, Mountable)?.seats.find((s) => s.id === mounted.seat);
        if (!t || !seat) {
          w.remove(actor, Mounted);
          continue;
        }
        w.patch(actor, Transform, { pos: vehicleLocalPoint(t, seat.position), rot: [...t.rot] });
      }
    },
    { phase: 'late', name: 'mounted-seats', priority: 100 },
  );
}

function mountStopped(world: World, vehicle: string): boolean {
  const state = world.get<AircraftStateData>(vehicle, { name: 'aircraftState' });
  return (
    !state ||
    (state.grounded &&
      m.hypot(...state.velocity) <= 0.7 &&
      state.rpm < 0.12 &&
      Object.values(state.engines ?? {}).every((engine) => engine.rpm < 0.12))
  );
}

function stopWalking(world: World, actor: string): void {
  const body = { name: 'kinematicBody' },
    character = { name: 'character' };
  if (world.has(actor, body)) world.patch(actor, body, { vel: [0, 0, 0] });
  if (world.has(actor, character)) world.patch(actor, character, { vy: 0, grounded: true });
}
