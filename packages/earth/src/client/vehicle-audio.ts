import type { AudioLayer } from '@bendyline/molen-client/audio';
import { Aircraft, AircraftState } from '@bendyline/molen-kernel/aircraft';
import {
  Mountable,
  Mounted,
  Vehicle,
  VehicleState,
  type VehicleStateData,
} from '@bendyline/molen-kernel/vehicles';
import { componentHandle, Transform, type World } from '@bendyline/molen-kernel/world';
import type {
  ActuatorPositions,
  ActuatorSpecs,
  AircraftSpec,
  AircraftStateData,
} from '@bendyline/molen-schema';

const Boat = componentHandle('boat');
const NO_CABIN_DOOR = new Set(['bicycle', 'motorcycle', 'scooter', 'light-rail']);
const PAVEMENT = new Set(['concrete', 'asphalt', 'paved']);
interface Previous {
  snapshot: AircraftStateData | VehicleStateData;
  positions: ActuatorPositions;
  directions: Record<string, number>;
  aircraft?: AircraftStateData;
  position: [number, number, number];
  at: number;
  airborneAt: number;
  landedAt: number;
}

/** Vehicle foley follows actual snapshot transitions; it never modifies the simulation. */
export class VehicleAudio {
  private readonly previous = new Map<string, Previous>();
  private readonly motors = new Map<string, { entity: string; voice: string; movedAt: number }>();
  private drivers = new Set<string>();
  constructor(
    private readonly layer: AudioLayer,
    private readonly sounds: ReadonlySet<string>,
  ) {}

  private play(sound: string, entity: string, gain = 1, pitch = 1): void {
    // Older/custom packs may omit new foley. Do not warn every time a mechanism moves.
    if (this.sounds.has(sound)) this.layer.play(sound, { entity, gain, pitch });
  }

  boarding(world: World, id: string, mounting: boolean, seat?: string): void {
    const vehicle = world.get(id, Vehicle);
    if (!vehicle || world.has(id, Aircraft) || world.has(id, Boat)) return;
    const spec = vehicle.spec;
    if (NO_CABIN_DOOR.has(spec?.bodyStyle ?? '')) return;
    // Articulated doors speak when they actually move. Legacy models retain boarding foley.
    if (!Object.keys(spec?.actuators ?? {}).some((name) => /^door/i.test(name)))
      this.play(mounting ? 'vehicle.door.close' : 'vehicle.door.open', id);
    const role = world.get(id, Mountable)?.seats.find((s) => s.id === seat)?.role;
    const source = world.get(id, componentHandle('audioSource'));
    const combustion = ['vehicle.engine.car', 'vehicle.engine.diesel'].includes(
      String(source?.sound),
    );
    const driven = this.driven(world);
    if (
      combustion &&
      (mounting
        ? role !== 'passenger' && !this.drivers.has(id)
        : this.drivers.has(id) && !driven.has(id))
    )
      this.play(mounting ? 'vehicle.engine.start' : 'vehicle.engine.stop', id, 0.65);
    this.drivers = driven;
  }

  update(
    world: World | undefined,
    nowMs: number,
    surfaceAt: (x: number, z: number) => string | undefined,
  ): void {
    if (!world) {
      this.clear();
      return;
    }
    this.drivers = this.driven(world);
    const seen = new Set<string>();
    // Aircraft also carry vehicle, but standalone hosts need not add it.
    const ids = new Set([...world.query(Vehicle), ...world.query(Aircraft)].map(([id]) => id));
    for (const id of ids) {
      const transform = world.get(id, Transform);
      if (!transform || world.has(id, Boat)) continue;
      const aircraft = world.get(id, Aircraft);
      const airState = world.get(id, AircraftState);
      const vehicle = world.get(id, Vehicle);
      const state = aircraft ? airState : world.get(id, VehicleState);
      if (!state) continue;
      seen.add(id);
      const specs = aircraft?.spec.actuators ?? vehicle?.spec.actuators ?? {};
      const positions = state.actuators ?? {};
      const prior = this.previous.get(id);
      if (prior?.snapshot === state) {
        // Parked vehicles and duplicate render frames need no new foley snapshot.
        prior.at = nowMs;
        prior.position = [...transform.pos];
        continue;
      }
      const airborneAt =
        airState && !airState.grounded
          ? prior?.aircraft && !prior.aircraft.grounded
            ? prior.airborneAt
            : nowMs
          : (prior?.airborneAt ?? nowMs);
      const next: Previous = {
        snapshot: state,
        positions: { ...positions },
        directions: { ...prior?.directions },
        position: [...transform.pos],
        at: nowMs,
        airborneAt,
        landedAt: prior?.landedAt ?? -Infinity,
        ...(airState ? { aircraft: airState } : {}),
      };
      if (
        prior &&
        nowMs > prior.at &&
        nowMs - prior.at < 500 &&
        Math.hypot(
          ...(transform.pos.map((p, i) => p - prior.position[i]!) as [number, number, number]),
        ) <
          Math.max(
            25,
            ((airState?.airspeed ?? Math.abs(world.get(id, VehicleState)?.speed ?? 0)) *
              (nowMs - prior.at)) /
              500,
          )
      ) {
        this.mechanisms(id, specs, positions, prior, next, vehicle?.spec.bodyStyle === 'van');
        const before = prior.aircraft;
        if (aircraft && airState && before)
          this.aircraftMotors(id, aircraft.spec, before, airState, nowMs);
        if (
          aircraft?.spec.model === 'airplane' &&
          airState &&
          before &&
          !before.grounded &&
          airState.grounded &&
          !before.waitingForTerrain &&
          !airState.waitingForTerrain &&
          !airState.crashed &&
          (airState.gearPosition ?? 1) >= 0.95 &&
          (nowMs - prior.airborneAt >= 100 || before.altitudeAGL > 0.4) &&
          nowMs - prior.landedAt > 900
        ) {
          const speed = Math.hypot(before.velocity[0], before.velocity[2]);
          if (speed >= 8 && PAVEMENT.has(surfaceAt(transform.pos[0], transform.pos[2]) ?? '')) {
            const load = Math.min(1, Math.max(0.2, -before.verticalSpeed / 3));
            this.play('aircraft.touchdown.tire', id, Math.min(1, speed / 45) * (0.5 + load * 0.5));
            next.landedAt = nowMs;
          }
        }
      } else {
        this.stopMotors(id);
      }
      this.previous.set(id, next);
    }
    for (const id of this.previous.keys()) if (!seen.has(id)) this.previous.delete(id);
    // Duplicate render snapshots are normal between ticks; a stalled/paused simulation is not
    // evidence of continued travel. Expire its loops without restarting them every render frame.
    for (const [key, motor] of this.motors)
      if (!seen.has(motor.entity) || nowMs - motor.movedAt > 150) {
        this.layer.stop(motor.voice, 0.08);
        this.motors.delete(key);
      }
  }

  private aircraftMotors(
    id: string,
    spec: AircraftSpec,
    before: AircraftStateData,
    state: AircraftStateData,
    nowMs: number,
  ): void {
    const gear = spec.model === 'airplane' ? spec.airplane : spec.helicopter;
    const retractable = spec.model === 'airplane' ? !gear?.fixedGear : gear?.fixedGear === false;
    const moving = (from: number | undefined, to: number | undefined, seconds = 0): boolean =>
      !state.crashed &&
      !state.waitingForTerrain &&
      seconds > 0 &&
      from !== undefined &&
      to !== undefined &&
      to > 0 &&
      to < 1 &&
      Math.abs(to - from) > 1e-6;
    this.motor(
      id,
      'aircraft.gear.motor',
      retractable && moving(before.gearPosition, state.gearPosition, gear?.gearTransitTime),
      nowMs,
    );
    this.motor(
      id,
      'aircraft.flaps.motor',
      spec.model === 'airplane' &&
        moving(before.flapPosition, state.flapPosition, spec.airplane?.flapTransitTime),
      nowMs,
    );
  }

  private motor(entity: string, sound: string, moving: boolean, nowMs: number): void {
    const key = JSON.stringify([entity, sound]);
    const active = this.motors.get(key);
    if (moving && this.sounds.has(sound)) {
      if (active) active.movedAt = nowMs;
      else
        this.motors.set(key, {
          entity,
          voice: this.layer.play(sound, { entity, loop: true }),
          movedAt: nowMs,
        });
    } else if (active) {
      this.layer.stop(active.voice, 0.08);
      this.motors.delete(key);
    }
  }

  private stopMotors(entity?: string): void {
    for (const [key, motor] of this.motors)
      if (entity === undefined || motor.entity === entity) {
        this.layer.stop(motor.voice, 0.08);
        this.motors.delete(key);
      }
  }

  private mechanisms(
    id: string,
    specs: ActuatorSpecs,
    positions: ActuatorPositions,
    prior: Previous,
    next: Previous,
    van: boolean,
  ): void {
    for (const [name, spec] of Object.entries(specs)) {
      const from = prior.positions[name] ?? spec.initial ?? 0;
      const to = positions[name] ?? spec.initial ?? 0;
      if (spec.mode === 'cycle' && /wiper/i.test(name)) {
        // One short stroke at each half-cycle. The last return parks silently at phase zero.
        if ((from === 0 && to > 0) || (from < 0.5 && to >= 0.5) || (to < from && to > 0))
          this.play('vehicle.wiper.sweep', id, 1, Math.max(0.6, Math.min(1.6, 1.4 / spec.seconds)));
        continue;
      }
      if (!/^(door|hood|trunk)/i.test(name)) continue;
      const direction = Math.sign(to - from);
      if (!direction) continue;
      next.directions[name] = to === 0 || to === 1 ? 0 : direction;
      const slide = /slide/i.test(name) || (van && /^doorRear/i.test(name));
      if (direction !== prior.directions[name]) {
        if (slide) this.play('vehicle.door.slide', id);
        else if (direction > 0) this.play('vehicle.door.open', id, /^door/i.test(name) ? 0.8 : 0.5);
      }
      if (direction < 0 && to <= 0.001 && from > 0.001)
        this.play('vehicle.door.close', id, /^door/i.test(name) ? 0.8 : 0.5);
    }
  }

  private driven(world: World): Set<string> {
    const ids = new Set<string>();
    for (const [, mounted] of world.query(Mounted)) {
      const role = world
        .get(mounted.vehicle, Mountable)
        ?.seats.find((s) => s.id === mounted.seat)?.role;
      if (role !== 'passenger') ids.add(mounted.vehicle);
    }
    return ids;
  }

  clear(): void {
    this.stopMotors();
    this.previous.clear();
    this.drivers.clear();
  }
}
