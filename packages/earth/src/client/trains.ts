/**
 * Trains in an Earth view: consists of rail vehicles made up from the entity library, put on
 * the nearest suitable track of an {@link EarthRailNetwork}, which the viewer can drive from the
 * cab or ride as a passenger while an engineer drives (stopping at stations and reversing at the
 * end of the line).
 */
import type { TypeLibrary } from '@bendyline/molen-kernel/content';
import {
  Coupled,
  consistOffsets,
  driveVehicle,
  Mountable,
  Mounted,
  refreshRailHeights,
  settleRailConsist,
  type TrackPose,
  type TrackRoute,
  trailAt,
  Vehicle,
  VehicleInput,
  type VehicleInputData,
  VehicleState,
} from '@bendyline/molen-kernel/vehicles';
import { Transform } from '@bendyline/molen-kernel/world';
import type { VehicleData, VehicleSpec } from '@bendyline/molen-schema';
import { type EarthRailNetwork, isLightRailTrack, isRunningTrack } from './rail';
import type { EarthVehicles } from './vehicles';

/** One car of a consist: an entity type and an optional paint color. */
export interface EarthTrainCar {
  type: string;
  color?: string;
}

/**
 * What a train is for: which tracks it runs on and how it makes up. A `yard` train is a switcher
 * and a short cut of cars working back and forth on yard tracks.
 */
export type EarthTrainKind = 'freight' | 'passenger' | 'light-rail' | 'yard';

/** A consist in the world. */
export interface EarthTrain {
  id: string;
  kind: EarthTrainKind;
  /** Entity ids front to back; the first leads. */
  cars: string[];
  /** The engineer driving it while the viewer rides as a passenger. */
  engineer?: string;
  /** Its engineer works it whether or not anyone rides (a yard switcher). */
  autonomous?: boolean;
}

/** The train the viewer is aboard, for a HUD. */
export interface EarthTrainStatus {
  train: EarthTrain;
  /** The lead unit's name, and how the consist makes up. */
  label: string;
  consist: string;
  /** Total mass in tonnes. */
  tonnes: number;
  /** Signed speed of the train, m/s. */
  speed: number;
  /** Route the train will take at the next facing switch. */
  route: TrackRoute;
  /** The train stands at the end of its track. */
  ended: boolean;
  /** The train has just stopped against standing cars (or another train). */
  blocked: boolean;
  /** Name of the line under the lead (OSM name, or ref). */
  line?: string;
  /** The viewer rides while an engineer drives. */
  passenger: boolean;
  /** Where the engineer stops next, and how far ahead it is, meters. */
  nextStop?: { name: string; distance: number };
  /** Seconds left standing at a station or the end of the line. */
  dwell?: number;
}

const RAIL = 'molen.entities.rail.';
/** Paint by car type: weathered, unbranded colors seen on North American freight cars. */
const FREIGHT_COLORS: Readonly<Record<string, readonly string[]>> = {
  boxcar_50ft: ['#7a3326', '#8a4a2c', '#5f3a2e', '#2f4f6b', '#6b6f4a'],
  covered_hopper: ['#b9b7ad', '#a9a59a', '#8f8c86', '#c2b8a3'],
  tank_car_dot117: ['#1d1e20', '#26282a', '#d9d6cf'],
  well_car_double_stack: ['#3d3f3c', '#58402e'],
  autorack_enclosed: ['#6d4a33', '#8d8b84', '#7a7369'],
  gondola_52ft: ['#3a3633', '#5b3527', '#2f3b33'],
  centerbeam_flatcar: ['#4b4a46', '#5a3e2e'],
};
/** Blocks of cars by how common they are in a mixed manifest, out of 100. */
const MANIFEST: readonly [string, number][] = [
  ['covered_hopper', 22],
  ['tank_car_dot117', 18],
  ['boxcar_50ft', 18],
  ['well_car_double_stack', 16],
  ['gondola_52ft', 10],
  ['centerbeam_flatcar', 8],
  ['autorack_enclosed', 8],
];

/** A small, stable pseudo-random sequence for consist make-up. */
function sequence(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/** Coupled length of a vehicle spec. */
function coupledLength(spec: VehicleSpec): number {
  return spec.rail?.couplerLength ?? spec.length;
}

export interface EarthTrainsOptions {
  vehicles: EarthVehicles;
  rail: EarthRailNetwork;
  types: TypeLibrary;
}

/** Autopilot memory for a train an engineer drives. */
interface Engineer {
  /** +1 runs the lead first, -1 backs the train (after reversing at the end of a line). */
  direction: 1 | -1;
  /** Stops already made (rounded positions), so the train leaves them. */
  visited: Set<string>;
  dwellUntil?: number;
  /** The stop it is braking for. */
  target?: { x: number; z: number; name: string };
  clock: number;
  /** Switching: meters run since the last reversal, and how far this move goes. */
  moved: number;
  limit: number;
  /** Clear track ahead in the running direction (meters), and when it was last measured. */
  clear: number;
  clearAt: number;
}

/** Where a standing car or another train's car reaches along the track: its coupler ends. */
interface Obstacle {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

/** Distance from a point to an obstacle's centerline, meters. */
function obstacleDistance(x: number, z: number, o: Obstacle): number {
  const dx = o.bx - o.ax,
    dz = o.bz - o.az;
  const length2 = dx * dx + dz * dz;
  const t =
    length2 > 1e-9 ? Math.max(0, Math.min(1, ((x - o.ax) * dx + (z - o.az) * dz) / length2)) : 0;
  return Math.hypot(x - (o.ax + dx * t), z - (o.az + dz * t));
}

/** Yard switching speed, m/s (about 10 mph), and the shortest and longest move, meters. */
const SWITCHING_SPEED = 4.2;
const MOVE_MIN = 70;
const MOVE_MAX = 300;

export class EarthTrains {
  private readonly vehicles: EarthVehicles;
  private readonly rail: EarthRailNetwork;
  private readonly types: TypeLibrary;
  private readonly trains = new Map<string, EarthTrain>();
  private readonly engineers = new Map<string, Engineer>();
  private count = 0;
  private clock = 0;
  private refreshedAt = 0;
  private nextYard = 0;
  private yardSeed = 0;
  /** When each driven train last stopped against standing cars (seconds of this clock). */
  private readonly blockedAt = new Map<string, number>();
  /** A short explanation when spawning or boarding did not work. */
  message = '';

  private readonly removeFilter: () => void;

  constructor(options: EarthTrainsOptions) {
    this.vehicles = options.vehicles;
    this.rail = options.rail;
    this.types = options.types;
    // Power toward standing cars a train is up against does nothing; the brakes hold it.
    this.removeFilter = this.vehicles.addInputFilter((id, input) => {
      const train = this.trainOf(id);
      if (!train || train.cars[0] !== id || input.throttle === 0) return input;
      const end = this.runningEnd(train, input.throttle > 0 ? 1 : -1);
      if (!end || this.clearance(train, end, 1.2) > 1.2) return input;
      this.blockedAt.set(train.id, this.clock);
      return { ...input, throttle: 0, brake: true };
    });
  }

  private get world() {
    return this.vehicles.world;
  }

  /** Whether the entity library has rail vehicles to make a train of `kind` from. */
  available(kind: EarthTrainKind): boolean {
    return EarthTrains.makeUp(kind, this.types, 1).length > 0;
  }

  /**
   * A consist of `kind` from the library: a freight train is two road locomotives and a mixed
   * manifest in blocks; a passenger train a commuter locomotive and bilevel coaches (with a cab
   * car at the far end when the library has one); light rail two cars. Empty when the library
   * lacks the types.
   */
  static makeUp(kind: EarthTrainKind, types: TypeLibrary, seed: number): EarthTrainCar[] {
    const random = sequence(seed);
    const has = (id: string): boolean => types.has(id);
    if (kind === 'light-rail') {
      const id = 'molen.entities.transit.lightrail';
      return has(id) ? [{ type: id }, { type: id }] : [];
    }
    if (kind === 'yard') {
      const switcher = [`${RAIL}emd_gp38_2`, `${RAIL}ge_es44ac`].find(has);
      if (!switcher) return [];
      const pool = MANIFEST.filter(([suffix]) => has(`${RAIL}${suffix}`));
      const cars: EarthTrainCar[] = [{ type: switcher }];
      const count = pool.length ? 3 + Math.floor(random() * 6) : 0;
      const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
      for (let i = 0; i < count; i++) {
        let pick = random() * total;
        let suffix = (pool[pool.length - 1] as [string, number])[0];
        for (const [name, weight] of pool) {
          pick -= weight;
          if (pick < 0) {
            suffix = name;
            break;
          }
        }
        const colors = FREIGHT_COLORS[suffix] ?? ['#5a4a3e'];
        const color = colors[Math.floor(random() * colors.length)];
        cars.push({ type: `${RAIL}${suffix}`, ...(color !== undefined ? { color } : {}) });
      }
      return cars;
    }
    if (kind === 'passenger') {
      const loco = `${RAIL}mpi_mp36ph_3c`;
      const coach = `${RAIL}bombardier_bilevel_coach`;
      const cab = `${RAIL}bombardier_bilevel_cab_car`;
      if (!has(loco) || !has(coach)) return [];
      const coaches = 3 + Math.floor(random() * 3);
      return [
        { type: loco },
        ...Array.from({ length: coaches }, () => ({ type: coach })),
        ...(has(cab) ? [{ type: cab }] : [{ type: coach }]),
      ];
    }
    const road = `${RAIL}ge_es44ac`;
    if (!has(road)) return [];
    const cars: EarthTrainCar[] = [{ type: road }, { type: road }];
    const pool = MANIFEST.filter(([suffix]) => has(`${RAIL}${suffix}`));
    if (!pool.length) return cars;
    const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
    const length = 14 + Math.floor(random() * 10);
    while (cars.length < length + 2) {
      let pick = random() * total;
      let suffix = (pool[pool.length - 1] as [string, number])[0];
      for (const [name, weight] of pool) {
        pick -= weight;
        if (pick < 0) {
          suffix = name;
          break;
        }
      }
      const colors = FREIGHT_COLORS[suffix] ?? ['#5a4a3e'];
      const color = colors[Math.floor(random() * colors.length)];
      const block = 2 + Math.floor(random() * 4);
      for (let i = 0; i < block && cars.length < length + 2; i++)
        cars.push({ type: `${RAIL}${suffix}`, ...(color !== undefined ? { color } : {}) });
    }
    return cars;
  }

  /**
   * Put a train of `kind` on the nearest suitable track within `radius` meters of X/Z (running
   * lines preferred over yards), heading the way `yaw` faces (kernel yaw: 0 faces +Z). Returns
   * the train, or undefined (with {@link message}) when there is no track or no rolling stock.
   */
  spawn(
    kind: EarthTrainKind,
    x: number,
    z: number,
    options: {
      radius?: number;
      yaw?: number;
      cars?: readonly EarthTrainCar[];
      seed?: number;
      /** Exactly here on the track, instead of the nearest suitable track to X/Z. */
      pose?: TrackPose;
    } = {},
  ): EarthTrain | undefined {
    this.message = '';
    const cars = options.cars ?? EarthTrains.makeUp(kind, this.types, options.seed ?? ++this.count);
    if (!cars.length) {
      this.message = 'No rolling stock for this train in the entity library';
      return undefined;
    }
    const radius = options.radius ?? 2500;
    const suits = (tags: Readonly<Record<string, string>>): boolean =>
      kind === 'light-rail' ? isLightRailTrack(tags) : !isLightRailTrack(tags);
    const any = options.pose ? undefined : this.rail.network.nearest(x, z, radius, suits);
    const running = options.pose
      ? undefined
      : this.rail.network.nearest(x, z, radius, (t) => suits(t) && isRunningTrack(t));
    const found = options.pose
      ? { pose: options.pose }
      : running && (!any || running.distance < any.distance + 200)
        ? running
        : any;
    if (!found) {
      this.message =
        kind === 'light-rail'
          ? 'No light rail within reach: fly closer to a tram or light-rail line'
          : 'No railway within reach: fly closer to a railway line';
      return undefined;
    }
    let { pose } = found;
    // Face the way the viewer looks.
    if (options.yaw !== undefined && Math.cos(pose.yaw - options.yaw) < 0)
      pose = { ...pose, yaw: pose.yaw + Math.PI };
    const id = `train-${++this.count}`;
    const specs = cars.map((car) => this.spec(car.type));
    if (specs.some((spec) => spec?.rail === undefined)) {
      this.message = 'A car in this train is not a rail vehicle';
      return undefined;
    }
    const offsets = consistOffsets(specs as VehicleSpec[]);
    const train: EarthTrain = { id, kind, cars: [] };
    const ground = this.vehicles.environment.groundHeight(pose.x, pose.z) ?? 0;
    for (const [i, car] of cars.entries()) {
      const carId = `${id}-car-${i}`;
      const spawned = this.vehicles.spawn(car.type, [pose.x, ground, pose.z], pose.yaw, {
        id: carId,
        retain: true,
        onTrack: true,
        ...(car.color !== undefined ? { color: car.color } : {}),
      });
      if (spawned === undefined) {
        this.message = this.vehicles.message || 'Could not place the train';
        for (const placed of train.cars) this.vehicles.remove(placed);
        return undefined;
      }
      train.cars.push(spawned);
      if (i > 0)
        this.world.set(spawned, Coupled, {
          leader: train.cars[0] as string,
          offset: offsets[i] ?? 0,
        });
    }
    const lead = train.cars[0] as string;
    if (!this.settle(lead)) {
      this.message = 'The track here has not finished loading';
      for (const placed of train.cars) this.vehicles.remove(placed);
      return undefined;
    }
    this.trains.set(id, train);
    return train;
  }

  /**
   * Lay the consist on the track behind its leader; where the track ends too soon behind it,
   * draw the leader forward until the whole train fits.
   */
  private settle(lead: string): boolean {
    const environment = this.vehicles.environment;
    if (!settleRailConsist(this.world, lead, environment)) return false;
    const state = this.world.get(lead, VehicleState);
    if (!state?.track?.ended) return true;
    const length = this.consistLength(lead);
    const t = this.world.get(lead, Transform);
    if (!t) return true;
    const track = environment.track;
    const moved = track?.advance({ x: t.pos[0], z: t.pos[2], yaw: state.yaw }, length, 0);
    if (!moved || moved.moved < 1) return true;
    this.world.set(lead, Transform, { ...t, pos: [moved.pose.x, t.pos[1], moved.pose.z] });
    const { track: _laid, ...rest } = state;
    this.world.set(lead, VehicleState, { ...rest, yaw: moved.pose.yaw });
    return settleRailConsist(this.world, lead, environment);
  }

  private spec(type: string): VehicleSpec | undefined {
    if (!this.types.has(type)) return undefined;
    const vehicle = this.types.components(type).vehicle as unknown as VehicleData | undefined;
    return vehicle?.spec;
  }

  /** Length of a consist from its leader's centre to its rear coupler, meters. */
  private consistLength(lead: string): number {
    let length =
      coupledLength(this.world.get(lead, Vehicle)?.spec ?? ({ length: 0 } as VehicleSpec)) / 2;
    for (const [id, coupled] of this.world.query(Coupled)) {
      if (coupled.leader !== lead) continue;
      const spec = this.world.get(id, Vehicle)?.spec;
      if (spec) length = Math.max(length, coupled.offset + coupledLength(spec) / 2);
    }
    return length;
  }

  /** The train an entity belongs to. */
  trainOf(entity: string | undefined): EarthTrain | undefined {
    if (entity === undefined) return undefined;
    for (const train of this.trains.values()) if (train.cars.includes(entity)) return train;
    return undefined;
  }

  /** Trains in the world. */
  list(): EarthTrain[] {
    return [...this.trains.values()];
  }

  /**
   * Seat the viewer aboard: `driver` in the lead cab (the engineer, if any, steps out), or
   * `passenger` in a coach (a seat in the cab when the train has no coach) while an engineer
   * drives.
   */
  board(train: EarthTrain, role: 'driver' | 'passenger'): boolean {
    this.message = '';
    const lead = train.cars[0];
    if (lead === undefined) return false;
    if (role === 'driver') {
      this.dismissEngineer(train);
      if (!this.vehicles.board(lead, 'driver')) {
        this.message = this.vehicles.message || 'Could not reach the cab';
        return false;
      }
      return true;
    }
    const seated = (id: string): boolean =>
      (this.world.get(id, Mountable)?.seats ?? []).some((seat) => seat.role === 'passenger');
    const coaches = train.cars.filter(
      (id) => seated(id) && this.world.get(id, Vehicle)?.spec.bodyStyle === 'passenger-car',
    );
    const car = coaches[Math.floor(coaches.length / 2)] ?? train.cars.find(seated);
    const seat = car !== undefined ? this.passengerSeat(car) : undefined;
    if (car === undefined || seat === undefined || !this.vehicles.board(car, seat)) {
      this.message = this.vehicles.message || 'No free passenger seat on this train';
      return false;
    }
    this.ride(train);
    return true;
  }

  private passengerSeat(car: string): string | undefined {
    const taken = new Set<string>();
    for (const [, mounted] of this.world.query(Mounted))
      if (mounted.vehicle === car) taken.add(mounted.seat);
    return this.world
      .get(car, Mountable)
      ?.seats.find((seat) => seat.role === 'passenger' && !taken.has(seat.id))?.id;
  }

  /**
   * An engineer takes the lead cab's driver's seat and drives while the viewer rides elsewhere
   * in the train (call after the viewer took a passenger seat on foot). No-op when someone
   * already drives.
   */
  ride(train: EarthTrain): void {
    const lead = train.cars[0];
    if (lead === undefined || train.engineer !== undefined) return;
    const occupied = [...this.world.query(Mounted)].some(
      ([, mounted]) => mounted.vehicle === lead && mounted.seat === 'driver',
    );
    if (occupied) return;
    const engineer = `${train.id}-engineer`;
    const t = this.world.get(lead, Transform);
    if (!t) return;
    if (!this.world.exists(engineer))
      this.world.spawnRaw({ transform: { pos: [...t.pos], rot: [...t.rot] } }, engineer);
    this.world.set(engineer, Mounted, { vehicle: lead, seat: 'driver' });
    train.engineer = engineer;
    this.engineers.set(train.id, {
      direction: 1,
      visited: new Set(),
      clock: 0,
      moved: 0,
      limit: MOVE_MIN + ((this.count * 0.618) % 1) * (MOVE_MAX - MOVE_MIN),
      clear: Number.POSITIVE_INFINITY,
      clearAt: Number.NEGATIVE_INFINITY,
    });
  }

  private dismissEngineer(train: EarthTrain): void {
    if (train.engineer === undefined) return;
    if (this.world.exists(train.engineer)) this.world.destroy(train.engineer);
    delete train.engineer;
    this.engineers.delete(train.id);
  }

  /** Remove a train and everyone's seat in it. */
  remove(train: EarthTrain): void {
    this.dismissEngineer(train);
    for (const car of train.cars) this.vehicles.remove(car);
    this.trains.delete(train.id);
  }

  /**
   * Once a frame: engineers drive the trains the viewer rides as a passenger, and leave trains
   * nobody rides any more.
   */
  update(dt: number): void {
    this.clock += dt;
    // Terrain refines as finer tiles stream in: stand every train on the current heights.
    if (this.clock - this.refreshedAt > 2) {
      this.refreshedAt = this.clock;
      // Decks are only found near the collision neighbourhood; on a bridge keep the height the
      // lead measured as it crossed rather than drop to the ground beneath.
      const environment = this.vehicles.environment;
      const refresh = {
        ...environment,
        groundHeight: (x: number, z: number, y?: number) =>
          this.rail.network.nearest(x, z, 3)?.tags.bridge
            ? undefined
            : environment.groundHeight(x, z, y),
      };
      for (const train of this.trains.values())
        if (train.cars[0] !== undefined) refreshRailHeights(this.world, train.cars[0], refresh);
    }
    const riding = this.trainOf(this.vehicles.mountedId);
    for (const train of this.trains.values()) {
      if (train.engineer === undefined) {
        this.buffer(train, dt);
        continue;
      }
      if (!train.autonomous && (riding !== train || !this.vehicles.ridingAsPassenger())) {
        // Nobody aboard: bring it to a stand and leave it there.
        const speed = this.world.get(train.cars[0] ?? '', VehicleState)?.speed ?? 0;
        if (Math.abs(speed) < 0.1) this.dismissEngineer(train);
        else driveVehicle(this.world, train.engineer, { throttle: 0, steering: 0, brake: true });
        continue;
      }
      const engineer = this.engineers.get(train.id);
      if (engineer) driveVehicle(this.world, train.engineer, this.drive(train, engineer, dt));
    }
  }

  /** The engineer's control input this frame. */
  private drive(train: EarthTrain, engineer: Engineer, dt: number): VehicleInputData {
    engineer.clock += dt;
    const lead = train.cars[0] as string;
    const state = this.world.get(lead, VehicleState);
    const t = this.world.get(lead, Transform);
    const spec = this.world.get(lead, Vehicle)?.spec;
    const track = this.vehicles.environment.track;
    const hold: VehicleInputData = { throttle: 0, steering: 0, brake: true };
    if (!state?.track || !t || !spec || !track) return hold;
    const speed = state.speed * engineer.direction;
    if (engineer.dwellUntil !== undefined) {
      if (engineer.clock < engineer.dwellUntil) return hold;
      delete engineer.dwellUntil;
    }
    // Where the train runs from: its head, or its tail when backing.
    const length = this.consistLength(lead);
    const from =
      engineer.direction > 0
        ? { x: t.pos[0], z: t.pos[2], yaw: state.yaw }
        : (() => {
            const tail = trailAt(state.track.trail, length);
            return { x: tail.x, z: tail.z, yaw: tail.yaw + Math.PI };
          })();
    const light = train.kind === 'light-rail';
    const yard = train.kind === 'yard';
    const passenger = train.kind === 'passenger' || light;
    engineer.moved += Math.abs(state.speed) * dt;
    const tags = this.rail.network.tagsAt(from);
    const lineSpeed = yard
      ? SWITCHING_SPEED
      : light
        ? 15
        : tags && !isRunningTrack(tags)
          ? 4.5
          : passenger
            ? 26
            : 22;
    const cruise = Math.min(lineSpeed, engineer.direction > 0 ? spec.maxSpeed : spec.reverseSpeed);
    const braking = passenger ? 0.6 : yard ? 0.3 : 0.35;
    const lateral = passenger ? 1.0 : 0.8;
    // Look along the route: curves, the end of the track and the next stop limit the speed.
    const horizon = Math.max(250, (speed * speed) / (2 * braking) + 80);
    let allowed = cruise;
    let pose = from;
    let previousYaw = from.yaw;
    let walked = 0;
    const stops = passenger
      ? this.rail
          .stopsNear(from.x, from.z, horizon + 120)
          .filter((stop) => !engineer.visited.has(key(stop)))
      : [];
    let stopAt: { distance: number; stop: (typeof stops)[number] } | undefined;
    let endAhead = false;
    const STEP = 10;
    while (walked < horizon) {
      const next = track.advance(pose, STEP, 0);
      if (!next || next.moved < 0.5) {
        // The end of the track: stand 12 m short of it.
        allowed = Math.min(allowed, Math.sqrt(Math.max(0, 2 * braking * (walked - 12))));
        endAhead = walked < 40;
        break;
      }
      walked += next.moved;
      // A switcher keeps to the yard: the main line is the end of its track.
      if (yard && walked > 10 && isRunningTrack(this.rail.network.tagsAt(next.pose) ?? {})) {
        allowed = Math.min(allowed, Math.sqrt(Math.max(0, 2 * braking * (walked - 25))));
        endAhead ||= walked < 50;
        break;
      }
      let turn = Math.abs(next.pose.yaw - previousYaw) % (2 * Math.PI);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      if (turn > 1e-4) {
        const radius = next.moved / turn;
        const curve = Math.sqrt(lateral * radius);
        allowed = Math.min(
          allowed,
          Math.sqrt(curve * curve + 2 * braking * Math.max(0, walked - STEP)),
        );
      }
      previousYaw = next.pose.yaw;
      pose = next.pose;
      for (const stop of stops)
        if (!stopAt && Math.hypot(stop.x - pose.x, stop.z - pose.z) < 18)
          // Stop with the middle of the train at the platform.
          stopAt = { distance: walked + (engineer.direction > 0 ? length / 2 : -length / 2), stop };
    }
    if (stopAt) {
      engineer.target = { x: stopAt.stop.x, z: stopAt.stop.z, name: stopAt.stop.name };
      const to = Math.max(0, stopAt.distance - 2);
      allowed = Math.min(allowed, Math.sqrt(2 * braking * to));
      if (to < 6 && Math.abs(speed) < 0.15) {
        engineer.visited.add(key(stopAt.stop));
        engineer.dwellUntil = engineer.clock + (light ? 18 : 30);
        delete engineer.target;
        return hold;
      }
    } else delete engineer.target;
    // Standing cars and other trains ahead end the track short of them.
    if (engineer.clock - engineer.clearAt > 0.3) {
      engineer.clearAt = engineer.clock;
      engineer.clear = this.clearance(train, from, horizon);
    }
    const blocked = engineer.clear < horizon;
    if (blocked)
      allowed = Math.min(allowed, Math.sqrt(Math.max(0, 2 * braking * (engineer.clear - 8))));
    // A switching move ends after its distance.
    if (yard)
      allowed = Math.min(
        allowed,
        Math.sqrt(Math.max(0, 2 * braking * (engineer.limit - engineer.moved))),
      );
    const moveDone = yard && engineer.moved >= engineer.limit - 1;
    if (
      (state.track.ended ||
        (endAhead && allowed < 0.5) ||
        (blocked && engineer.clear < 14) ||
        moveDone) &&
      Math.abs(speed) < 0.15
    ) {
      // End of the line (or of the move): wait, then run back the other way.
      engineer.direction = engineer.direction > 0 ? -1 : 1;
      engineer.visited.clear();
      engineer.moved = 0;
      engineer.limit =
        MOVE_MIN + ((engineer.clock * 0.618 + this.count * 0.37) % 1) * (MOVE_MAX - MOVE_MIN);
      engineer.clear = Number.POSITIVE_INFINITY;
      engineer.clearAt = Number.NEGATIVE_INFINITY;
      engineer.dwellUntil = engineer.clock + (yard ? 12 + ((engineer.clock * 0.37) % 1) * 25 : 40);
      return hold;
    }
    const d = engineer.direction;
    if (speed > allowed + 0.4)
      return { throttle: -d * Math.min(1, (speed - allowed) / 2 + 0.3), steering: 0, brake: false };
    if (speed < allowed - 0.6)
      return { throttle: d * Math.min(1, (allowed - speed) / 3 + 0.25), steering: 0, brake: false };
    if (allowed < 0.2) return hold;
    return { throttle: d * 0.15, steering: 0, brake: false };
  }

  /** Standing cars and every other train's cars, as segments along their tracks. */
  private obstacles(except: EarthTrain, x: number, z: number, reach: number): Obstacle[] {
    const list: Obstacle[] = [];
    const add = (px: number, pz: number, yaw: number, length: number): void => {
      if (Math.hypot(px - x, pz - z) > reach + length) return;
      const hx = (Math.sin(yaw) * length) / 2,
        hz = (Math.cos(yaw) * length) / 2;
      list.push({ ax: px - hx, az: pz - hz, bx: px + hx, bz: pz + hz });
    };
    for (const p of this.vehicles.parkedRailCars())
      add(p.position[0], p.position[2], p.yaw, coupledLength(p.spec));
    for (const train of this.trains.values()) {
      if (train === except) continue;
      for (const car of train.cars) {
        const t = this.world.get(car, Transform);
        const state = this.world.get(car, VehicleState);
        const spec = this.world.get(car, Vehicle)?.spec;
        if (t && state && spec) add(t.pos[0], t.pos[2], state.yaw, coupledLength(spec));
      }
    }
    return list;
  }

  /**
   * Clear track from `from` (a coupler end, facing the way the train runs) up to `horizon`
   * meters: the distance to the first standing car or other train on it, or Infinity.
   */
  private clearance(train: EarthTrain, from: TrackPose, horizon: number): number {
    const track = this.vehicles.environment.track;
    const obstacles = this.obstacles(train, from.x, from.z, horizon + 30);
    if (!track || obstacles.length === 0) return Number.POSITIVE_INFINITY;
    let pose = from;
    let walked = 0;
    while (walked < horizon) {
      for (const o of obstacles) if (obstacleDistance(pose.x, pose.z, o) < 1.6) return walked;
      const next = track.advance(pose, 3, 0);
      if (!next || next.moved < 0.5) break;
      walked += next.moved;
      pose = next.pose;
    }
    return Number.POSITIVE_INFINITY;
  }

  /** The coupler end a train runs from: the lead's front, or the last car's rear when backing. */
  private runningEnd(train: EarthTrain, direction: 1 | -1): TrackPose | undefined {
    const lead = train.cars[0];
    const state = lead !== undefined ? this.world.get(lead, VehicleState) : undefined;
    const spec = lead !== undefined ? this.world.get(lead, Vehicle)?.spec : undefined;
    if (!state?.track || !spec) return undefined;
    if (direction > 0) {
      const head = trailAt(state.track.trail, 0);
      const ahead = this.vehicles.environment.track?.advance(
        { x: head.x, z: head.z, yaw: state.yaw },
        coupledLength(spec) / 2,
        0,
      );
      return ahead?.pose ?? { x: head.x, z: head.z, yaw: state.yaw };
    }
    const tail = trailAt(state.track.trail, this.consistLength(lead as string));
    return { x: tail.x, z: tail.z, yaw: tail.yaw + Math.PI };
  }

  /**
   * A train the viewer drives runs into standing cars and other trains rather than through
   * them: it stops against the first one in its way.
   */
  private buffer(train: EarthTrain, dt: number): void {
    const lead = train.cars[0];
    const state = lead !== undefined ? this.world.get(lead, VehicleState) : undefined;
    if (lead === undefined || !state) return;
    // Rolling, or about to: power held against standing cars must not creep it into them.
    const throttle = this.world.get(lead, VehicleInput)?.throttle ?? 0;
    const sense = Math.abs(state.speed) > 1e-4 ? state.speed : throttle;
    if (sense === 0) return;
    const direction = sense > 0 ? 1 : -1;
    const end = this.runningEnd(train, direction);
    if (!end) return;
    const reach = Math.abs(state.speed) * dt * 2 + 0.6;
    if (this.clearance(train, end, reach) <= reach) {
      const hit = Math.abs(state.speed);
      for (const car of train.cars)
        if (this.world.has(car, VehicleState)) this.world.patch(car, VehicleState, { speed: 0 });
      if (hit >= 1.5)
        this.world.emit(hit >= 5 ? 'vehicle-impact' : 'vehicle-bump', { entity: lead, speed: hit });
      this.message = 'Stopped against standing cars';
      this.blockedAt.set(train.id, this.clock);
    }
  }

  /**
   * Keep yard switchers working near an observer: up to `max` short cuts behind a switcher on
   * yard and siding tracks within `radius` meters, on stretches clear of standing cars, each
   * running back and forth under its own engineer. Switchers left far behind (and nobody aboard)
   * go. Call every frame; it looks for room a few times a minute.
   */
  yard(observer: readonly number[], options: { max?: number; radius?: number } = {}): void {
    const max = options.max ?? 2;
    const radius = options.radius ?? 1400;
    const x = observer[0] ?? 0,
      z = observer[2] ?? 0;
    const riding = this.trainOf(this.vehicles.mountedId);
    const switchers = [...this.trains.values()].filter((t) => t.kind === 'yard');
    for (const train of switchers) {
      const at = this.world.get(train.cars[0] ?? '', Transform)?.pos;
      if (train !== riding && (!at || Math.hypot(at[0] - x, at[2] - z) > radius * 1.8))
        this.remove(train);
    }
    if (this.clock < this.nextYard) return;
    this.nextYard = this.clock + 4;
    if ([...this.trains.values()].filter((t) => t.kind === 'yard').length >= max) return;
    if (!this.available('yard')) return;
    const random = sequence(++this.yardSeed * 7919 + Math.round(x) + Math.round(z) * 31);
    const switching = (tags: Readonly<Record<string, string>>): boolean =>
      !isLightRailTrack(tags) && /^(yard|siding)$/.test(tags.service ?? '');
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = 150 + random() * (radius - 150);
      const found = this.rail.network.nearest(
        x + Math.cos(angle) * distance,
        z + Math.sin(angle) * distance,
        120,
        switching,
      );
      if (!found) continue;
      const pose = random() < 0.5 ? found.pose : { ...found.pose, yaw: found.pose.yaw + Math.PI };
      const cars = EarthTrains.makeUp('yard', this.types, this.count + 101);
      const length = cars.reduce(
        (sum, car) => sum + coupledLength(this.spec(car.type) ?? ({ length: 18 } as VehicleSpec)),
        0,
      );
      // Room for the cut behind it and a move ahead, clear of standing cars and other trains.
      const probe: EarthTrain = { id: 'probe', kind: 'yard', cars: [] };
      const behind = { ...pose, yaw: pose.yaw + Math.PI };
      if (this.clearance(probe, pose, MOVE_MIN + 20) < MOVE_MIN + 20) continue;
      if (this.clearance(probe, behind, length + 20) < length + 20) continue;
      const train = this.spawn('yard', pose.x, pose.z, { pose, cars });
      if (!train) continue;
      train.autonomous = true;
      this.ride(train);
      return;
    }
  }

  /** The train the viewer is aboard, for a HUD. */
  status(): EarthTrainStatus | undefined {
    const train = this.trainOf(this.vehicles.mountedId);
    const lead = train?.cars[0];
    if (!train || lead === undefined) return undefined;
    const state = this.world.get(lead, VehicleState);
    const t = this.world.get(lead, Transform);
    const spec = this.world.get(lead, Vehicle)?.spec;
    if (!state || !t || !spec) return undefined;
    let tonnes = 0;
    let units = 0;
    for (const car of train.cars) {
      const s = this.world.get(car, Vehicle)?.spec;
      if (!s) continue;
      tonnes += s.mass / 1000;
      if ((s.rail?.power ?? 0) > 0) units++;
    }
    const cars = train.cars.length - units;
    const tags = this.rail.network.tagsAt({ x: t.pos[0], z: t.pos[2], yaw: state.yaw });
    const engineer = this.engineers.get(train.id);
    const line = tags?.name || tags?.ref || undefined;
    return {
      train,
      label: spec.label,
      consist: `${units} unit${units === 1 ? '' : 's'}${cars > 0 ? ` + ${cars} car${cars === 1 ? '' : 's'}` : ''}`,
      tonnes: Math.round(tonnes),
      speed: state.speed,
      route: state.track?.prefer ?? 0,
      ended: state.track?.ended === true,
      blocked: this.clock - (this.blockedAt.get(train.id) ?? Number.NEGATIVE_INFINITY) < 1,
      ...(line !== undefined ? { line } : {}),
      passenger: train.engineer !== undefined && this.vehicles.ridingAsPassenger(),
      ...(engineer?.target
        ? {
            nextStop: {
              name: engineer.target.name,
              distance: Math.hypot(engineer.target.x - t.pos[0], engineer.target.z - t.pos[2]),
            },
          }
        : {}),
      ...(engineer?.dwellUntil !== undefined
        ? { dwell: Math.max(0, engineer.dwellUntil - engineer.clock) }
        : {}),
    };
  }

  dispose(): void {
    this.removeFilter();
    for (const train of [...this.trains.values()]) this.remove(train);
  }
}

function key(stop: { x: number; z: number }): string {
  return `${Math.round(stop.x / 20)},${Math.round(stop.z / 20)}`;
}
