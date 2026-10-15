import { BoatState } from '@bendyline/molen-kernel/boats';
// Actors for an Earth view: companions and NPCs a host adds by latitude/longitude, drawn as
// procedural figures and steered on foot by simple behaviours (stand, wander the footways, follow
// someone, walk to a place, board and leave a vehicle). Each actor is an entity in the view's
// shared ECS world (a `figure`, its `transform` and a private `earthActor` marker, plus the
// kernel's `mounted` while it sits in a vehicle), so seats, sound and ambient traffic see it like
// the viewer. Like owned vehicles, actors live in a geographic registry outside the terrain
// stack: a re-anchor syncs and removes their entities and places them again in the next frame.
//
// Steering is client-side, after the world step: the few actors near the viewer walk with the
// walker's own capsule controller against the streamed scene (one small collision neighbourhood
// each), the rest move kinematically over the terrain. There is no pathfinding: an actor walks
// straight at its goal and reports `stuck` when that does not get it there.

import { AmbientFigures, type WalkerView } from '@bendyline/molen-ambient/client';
import type { AmbientHandle } from '@bendyline/molen-ambient/kernel';
import {
  RUN_SPEED,
  WALK_SPEED,
  WalkCollision,
  WalkController,
  type WalkInput,
} from '@bendyline/molen-client/navigation';
import {
  cycleRiderPose,
  type FigureData,
  resolveFigureDescriptor,
} from '@bendyline/molen-figures/client';
import { AircraftState } from '@bendyline/molen-kernel/aircraft';
import type { TypeLibrary } from '@bendyline/molen-kernel/content';
import {
  Mountable,
  type MountableData,
  Mounted,
  mountEntity,
  type SeatData,
  unmountEntity,
  Vehicle,
  VehicleState,
  vehicleLocalPoint,
} from '@bendyline/molen-kernel/vehicles';
import { componentHandle, Transform, type World } from '@bendyline/molen-kernel/world';
import type * as THREE from 'three';
import type { EarthPlace } from './airfields';
import type { EarthVehicles } from './vehicles';

/** What an actor does. Set it with {@link EarthActors.setBehaviour}; distances are meters. */
export type EarthActorBehaviour =
  /** Stand still (turning toward its `lookAt` target when that is behind it). */
  | { kind: 'idle' }
  /**
   * Stroll the mapped footways within `radius` (default 20) of a place, pausing between walks.
   * Footways come from ambient life's walk network; without one nearby the actor stands.
   */
  | { kind: 'wander'; around: EarthPlace; radius?: number }
  /**
   * Keep `distance` (default 2.5) behind the viewer (on foot) or another actor: walk, jog past
   * `jogBeyond` (default 8), and teleport behind the target past `teleportBeyond` (default 60;
   * `Infinity` never teleports). When the target rides in a vehicle the follower stands still and
   * reports `stuck` with reason `target-mounted`, once, so the host can have it board.
   */
  | {
      kind: 'follow';
      target: 'viewer' | { actor: string };
      distance?: number;
      jogBeyond?: number;
      teleportBeyond?: number;
    }
  /** Walk to a place; `arrived` within `arriveWithin` (default 1), then idle facing its heading. */
  | { kind: 'goTo'; to: EarthPlace; arriveWithin?: number }
  /**
   * Walk to the door nearest the seat and sit: `seat` names one, otherwise the first free
   * `passenger` seat. `force` seats the actor at once from anywhere, moving or not; the host
   * decides when the vehicle leaves.
   */
  | { kind: 'board'; vehicle: string; seat?: string; force?: boolean }
  /** Step out of the vehicle by its exits once it has stopped, then idle. On foot: just idle. */
  | { kind: 'alight' };

/** An actor to add: see {@link EarthActors.add}. */
export interface EarthActorSpec {
  /** Stable id (default `actor-<n>`); also its entity id, so it must be unique. */
  id?: string;
  /**
   * The body: a figure descriptor (`{ preset: 'human.adult', height, palette, … }`, see the
   * Figures guide) or `{ type }`, an entity type from the content packs with a `figure` component.
   */
  figure: FigureData | { type: string };
  latitude: number;
  longitude: number;
  /** Compass heading it faces, radians (0 north, PI/2 east). */
  heading?: number;
  /** Default `idle`. */
  behaviour?: EarthActorBehaviour;
  /** Offered to the interact key (E) within reach (default false). */
  interactable?: boolean;
}

/** Where an actor is and what it is doing. Positions are geographic; angles radians. */
export interface EarthActorPose {
  latitude: number;
  longitude: number;
  /** Meters above sea level of its feet, or of its eyes while seated. */
  altitude: number;
  /** Compass heading it faces. */
  heading: number;
  /** m/s (its vehicle's speed while seated). */
  speed: number;
  mode: 'idle' | 'walk' | 'run' | 'sit';
  behaviour: EarthActorBehaviour['kind'];
  /** The vehicle and seat it sits in. */
  mounted?: { vehicle: string; seat: string };
  /** Its entity exists in the current terrain frame (false until its ground has streamed). */
  placed: boolean;
}

/** What an actor's head turns toward: a place, the viewer, another actor, or nothing. */
export type EarthActorLookTarget = EarthPlace | 'viewer' | { actor: string } | null;

/** An `actorchange` event. */
export interface EarthActorChange {
  id: string;
  change: 'added' | 'arrived' | 'boarded' | 'alighted' | 'stuck' | 'teleported' | 'removed';
  /**
   * `stuck`: `blocked` (no progress for 3 s), `target-mounted`, `no-vehicle`, `no-seat`,
   * `moving` (the vehicle has not stopped) or `unreachable` (the seat is out of reach of the
   * door). `alighted`: `vehicle-gone` when the vehicle it sat in was removed.
   */
  reason?: string;
}

/** Companions and NPCs: see the "Actors" section of the Earth view guide. */
export interface EarthActors {
  /** Add an actor. Throws when the id is taken or the figure is invalid (or its type unknown). */
  add(spec: EarthActorSpec): string;
  remove(id: string): void;
  list(): readonly string[];
  pose(id: string): EarthActorPose | undefined;
  setBehaviour(id: string, behaviour: EarthActorBehaviour): void;
  /** Turn its head toward a target (within the neck's reach), or stop with `null`. */
  lookAt(id: string, target: EarthActorLookTarget): void;
  setInteractable(id: string, on: boolean): void;
  /**
   * Turn an ambient pedestrian (an id from interaction, or `kind: 'pedestrian'`) into an actor
   * with the same body, where it stands: it stops, leaves ambient life for good, looks at the
   * viewer and is interactable unless `spec` says otherwise. Undefined when that pedestrian is
   * gone. One-way.
   */
  adopt(
    pedestrianId: string,
    spec?: { id?: string; behaviour?: EarthActorBehaviour; interactable?: boolean },
  ): string | undefined;
}

/** `mountEarthView({ actors })`: how many actors walk with full collision. */
export interface EarthActorSettings {
  /** Actors within this distance of the viewer walk against the scene (default 60 m). */
  activeRadius?: number;
  /** At most this many at once, nearest first (default 4); the rest move over bare terrain. */
  maxActive?: number;
}

/** The view's side of the director: coordinates, events and content. */
export interface EarthActorHost {
  toWorld(latitude: number, longitude: number): [number, number];
  toGeo(x: number, z: number): { latitude: number; longitude: number };
  groundHeight(x: number, z: number): number | undefined;
  types?: TypeLibrary;
  prepare?: (object: THREE.Object3D) => void;
  emit(change: EarthActorChange): void;
  /** Whether the host keeps this vehicle (it comes back after a re-anchor, so seats wait for it). */
  ownsVehicle?(id: string): boolean;
}

/** The pieces of one terrain stack the director works in. */
export interface EarthActorStack {
  world: World;
  /** The streamed scene: collision for walking actors, and the parent of their figures. */
  root: THREE.Object3D;
  ambient?: AmbientHandle;
  vehicles?: EarthVehicles;
}

/** The viewer as follow and look targets see it, in world meters. */
export interface EarthActorViewer {
  /** Feet (on foot) or the vehicle's place (aboard); undefined in orbit. */
  position: readonly [number, number, number] | undefined;
  /** Compass heading it faces. */
  heading: number;
  /** The vehicle it rides in. */
  vehicle: string | undefined;
  /** Where its eyes are. */
  eye: readonly [number, number, number] | undefined;
}

/** The viewer's own figure this frame (see `EarthWalker.setAvatar`). */
export interface EarthAvatarFrame {
  visible: boolean;
  /** On foot: the walker's feet, horizontal velocity [x, z] and look heading. */
  feet?: readonly [number, number, number];
  velocity?: readonly [number, number];
  heading?: number;
}

const PLAYER = 'world-player';
const FigureComponent = componentHandle('figure');
const ActorMarker = componentHandle('earthActor');
const AmbientAgent = componentHandle('ambientAgent');
const TAU = 2 * Math.PI;
const IDLE: EarthActorBehaviour = { kind: 'idle' };
const NO_VIEWER: EarthActorViewer = {
  position: undefined,
  heading: 0,
  vehicle: undefined,
  eye: undefined,
};
/** Heads turn toward targets nearer than this, m. */
const LOOK_RANGE = 30;
/** No progress toward a goal for this long reports `stuck`, ms. */
const STUCK_MS = 3_000;
const STUCK_PROGRESS = 0.3;

const compass = (heading: number): number => ((heading % TAU) + TAU) % TAU;

/** Rotation about +Y turning a figure's front (+Z) to a compass heading (north -Z, east +X). */
function headingRotation(heading: number): [number, number, number, number] {
  const yaw = Math.PI - heading;
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

/** The compass heading a rotation turns +Z to. */
function rotationHeading(rot: readonly number[]): number {
  const [x = 0, y = 0, z = 0, w = 1] = rot;
  return compass(Math.atan2(2 * (x * z + w * y), -(1 - 2 * (x * x + y * y))));
}

function turnToward(current: number, target: number, step: number): number {
  let delta = (target - current) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return compass(current + Math.max(-step, Math.min(step, delta)));
}

/** A small seeded generator per actor (client-side variety, not simulation state). */
function seededRandom(text: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function checkBehaviour(behaviour: EarthActorBehaviour): EarthActorBehaviour {
  const kinds = ['idle', 'wander', 'follow', 'goTo', 'board', 'alight'];
  if (behaviour === null || typeof behaviour !== 'object' || !kinds.includes(behaviour.kind))
    throw new Error(`Unknown actor behaviour ${JSON.stringify(behaviour)}`);
  return behaviour;
}

/** Whether a vehicle is moving (or an aircraft is not shut down on the ground). */
function vehicleMoving(world: World, vehicle: string): boolean {
  const boat = world.get(vehicle, BoatState);
  if (boat)
    return (
      Math.hypot(...boat.velocity) > 0.7 || Math.abs(boat.yawRate) > 0.1 || boat.waitingForWater
    );
  const state = world.get(vehicle, VehicleState);
  if (state !== undefined && Math.hypot(state.speed, state.lateralSpeed ?? 0) > 0.7) return true;
  const air = world.get(vehicle, AircraftState);
  return (
    air !== undefined &&
    (!air.grounded ||
      Math.hypot(...air.velocity) > 0.7 ||
      air.rpm >= 0.12 ||
      Object.values(air.engines ?? {}).some((engine) => engine.rpm >= 0.12))
  );
}

function vehicleSpeed(world: World, vehicle: string): number {
  const boat = world.get(vehicle, BoatState);
  if (boat) return Math.hypot(...boat.velocity);
  const state = world.get(vehicle, VehicleState);
  if (state !== undefined) return Math.abs(state.speed);
  const air = world.get(vehicle, AircraftState);
  return air !== undefined ? Math.hypot(...air.velocity) : 0;
}

interface Steer {
  /** World X/Z to walk toward. */
  goal?: [number, number];
  /** m/s. */
  speed: number;
  run: boolean;
  /** Compass heading to turn toward while standing. */
  face?: number;
}
const STAND: Steer = { speed: 0, run: false };

interface Actor {
  id: string;
  figure: FigureData;
  /** Eye height above the feet, m (a look target's head). */
  eyeHeight: number;
  behaviour: EarthActorBehaviour;
  interactable: boolean;
  look: EarthActorLookTarget;
  /** The geographic record, refreshed from the entity a few times a second. */
  geo: { latitude: number; longitude: number; altitude: number | undefined; heading: number };
  /** The seat it holds, also while unplaced (a re-anchor seats it again). */
  seat: { vehicle: string; seat: string } | undefined;
  placed: boolean;
  /** World feet (on foot) or eye point (seated) while placed. */
  pos: [number, number, number];
  heading: number;
  speed: number;
  mode: EarthActorPose['mode'];
  /** World tick the current mode began. */
  modeSince: number;
  /** Heading to turn to while standing (a goTo place's heading). */
  face: number | undefined;
  walker: WalkController | undefined;
  collision: WalkCollision | undefined;
  /** Meters walked, for follow progress. */
  travelled: number;
  progress: { key: unknown; best: number; at: number } | undefined;
  /** `stuck` reasons raised last frame (each is reported once when it appears). */
  raised: Set<string>;
  /** Why the last board or alight attempt failed, raised until one works. */
  failure: string | undefined;
  wander: { goal: [number, number] | undefined; until: number };
  /** Clock before which a board or alight attempt is not retried, ms. */
  retryAt: number;
  random: () => number;
}

/**
 * Runs the actors of one Earth view across its terrain stacks: the public {@link EarthActors}
 * facade, placement, steering, seats, the viewer's avatar and the figures that draw them all.
 * Internal to `mountEarthView`.
 */
export class EarthActorDirector {
  readonly api: EarthActors;
  private readonly actors = new Map<string, Actor>();
  private readonly activeRadius: number;
  private readonly maxActive: number;
  private stack: EarthActorStack | undefined;
  private figures: AmbientFigures | undefined;
  private avatar: FigureData | undefined;
  private avatarVisible = false;
  private avatarHeading = 0;
  private avatarSpeed = 0;
  private avatarSince = 0;
  private avatarMoving = false;
  private sequence = 0;
  private syncedAt = Number.NEGATIVE_INFINITY;
  private now = 0;
  private viewer: EarthActorViewer = NO_VIEWER;
  private raising = new Set<string>();
  /** Events raised during `update`, delivered after it so handlers never run mid-step. */
  private queue: EarthActorChange[] | undefined;
  private readonly ground = (x: number, z: number): number | undefined =>
    this.host.groundHeight(x, z);

  constructor(
    private readonly host: EarthActorHost,
    settings: EarthActorSettings = {},
  ) {
    this.activeRadius = Math.max(0, settings.activeRadius ?? 60);
    this.maxActive = Math.max(0, Math.floor(settings.maxActive ?? 4));
    this.api = {
      add: (spec) => this.add(spec),
      remove: (id) => this.remove(id),
      list: () => [...this.actors.keys()],
      pose: (id) => this.pose(id),
      setBehaviour: (id, behaviour) => this.setBehaviour(id, behaviour),
      lookAt: (id, target) => {
        const actor = this.actors.get(id);
        if (actor !== undefined) actor.look = target ?? null;
      },
      setInteractable: (id, on) => {
        const actor = this.actors.get(id);
        if (actor !== undefined) actor.interactable = on;
      },
      adopt: (pedestrianId, spec) => this.adopt(pedestrianId, spec ?? {}),
    };
  }

  // --- Stacks ---------------------------------------------------------------------------------

  /** Start working in a new terrain stack (actors are placed as their ground streams in). */
  attach(stack: EarthActorStack): void {
    this.detach();
    this.stack = stack;
    const figures = new AmbientFigures(this.host.prepare);
    // Few figures, all near the viewer: animate every one, every frame.
    figures.setBudget({ skinned: 32, radius: 300, posesPerFrame: 64 });
    stack.root.add(figures.group);
    this.figures = figures;
    this.applyAvatar();
  }

  /** Before a stack goes away: remember where everyone is; they are placed again in the next. */
  detach(): void {
    if (this.stack === undefined) return;
    this.sync(true);
    for (const actor of this.actors.values()) {
      actor.placed = false;
      this.deactivate(actor);
      actor.progress = undefined;
    }
    this.figures?.dispose();
    this.figures = undefined;
    this.stack = undefined;
  }

  dispose(): void {
    this.detach();
    this.actors.clear();
  }

  // --- Avatar ---------------------------------------------------------------------------------

  /** The viewer's own figure (drawn on foot in third person and seated in a chase view). */
  setAvatar(avatar: FigureData | { type: string } | undefined): void {
    this.avatar = avatar === undefined ? undefined : this.resolveFigure(avatar).figure;
    this.applyAvatar();
  }

  get hasAvatar(): boolean {
    return this.avatar !== undefined;
  }

  private applyAvatar(): void {
    const world = this.stack?.world;
    if (world === undefined) return;
    if (!world.exists(PLAYER))
      world.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, PLAYER);
    if (this.avatar !== undefined) world.set(PLAYER, FigureComponent, this.avatar);
    else if (world.has(PLAYER, FigureComponent)) world.remove(PLAYER, FigureComponent);
  }

  // --- Frame ----------------------------------------------------------------------------------

  /**
   * One frame, after the world step: place actors whose ground has streamed, steer them, pose the
   * avatar, and draw every figure that is not ambient life.
   */
  update(
    dt: number,
    now: number,
    camera: readonly [number, number, number],
    viewer: EarthActorViewer,
    avatar: EarthAvatarFrame,
  ): void {
    this.now = now;
    this.viewer = viewer;
    const stack = this.stack;
    if (stack === undefined) return;
    const queue: EarthActorChange[] = [];
    this.queue = queue;
    try {
      this.frame(stack, dt, camera, avatar);
    } finally {
      this.queue = undefined;
    }
    for (const change of queue) this.host.emit(change);
  }

  private frame(
    stack: EarthActorStack,
    dt: number,
    camera: readonly [number, number, number],
    avatar: EarthAvatarFrame,
  ): void {
    const viewer = this.viewer;
    for (const actor of this.actors.values()) if (!actor.placed) this.place(actor);
    this.chooseActive(viewer.position ?? camera);
    for (const actor of this.actors.values()) {
      if (!actor.placed) continue;
      this.raising = new Set();
      if (!stack.world.exists(actor.id)) {
        // Destroyed from under us (a host reaching into the world): place it again.
        actor.placed = false;
        this.deactivate(actor);
        continue;
      }
      this.step(actor, dt);
      for (const reason of this.raising)
        if (!actor.raised.has(reason)) this.emit(actor.id, 'stuck', reason);
      actor.raised = this.raising;
    }
    this.updateAvatar(stack.world, avatar, dt);
    if (this.now - this.syncedAt >= 200) this.sync();
    this.render(stack.world, camera);
  }

  /** Actors standing or walking in the current frame, as circles ambient traffic stops for. */
  solids(): { x: number; z: number; radius: number }[] {
    const out: { x: number; z: number; radius: number }[] = [];
    for (const actor of this.actors.values())
      if (actor.placed && actor.seat === undefined)
        out.push({ x: actor.pos[0], z: actor.pos[2], radius: 0.5 });
    return out;
  }

  /** The nearest interactable actor within reach of an eye point, seen by `clear`. */
  nearestActor(
    eye: readonly [number, number, number],
    reach: number,
    clear: (from: readonly [number, number, number], to: [number, number, number]) => boolean,
  ): { id: string; distance: number } | undefined {
    let best: { id: string; distance: number } | undefined;
    for (const actor of this.actors.values()) {
      if (!actor.placed || !actor.interactable) continue;
      const point: [number, number, number] =
        actor.seat !== undefined
          ? [actor.pos[0], actor.pos[1] - 0.2, actor.pos[2]]
          : [actor.pos[0], actor.pos[1] + 1.1, actor.pos[2]];
      const distance = Math.hypot(point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]);
      if (distance > reach || distance >= (best?.distance ?? Number.POSITIVE_INFINITY)) continue;
      if (!clear(eye, point)) continue;
      best = { id: actor.id, distance };
    }
    return best;
  }

  /** The nearest visible ambient pedestrian within reach of an eye point, seen by `clear`. */
  nearestPedestrian(
    eye: readonly [number, number, number],
    reach: number,
    clear: (from: readonly [number, number, number], to: [number, number, number]) => boolean,
  ): { id: string; distance: number } | undefined {
    const stack = this.stack;
    if (stack?.ambient === undefined) return undefined;
    let best: { id: string; distance: number } | undefined;
    for (const id of stack.ambient.agentsNear(eye[0], eye[2], reach + 0.5, 'pedestrian')) {
      const agent = stack.world.get(id, AmbientAgent) as { hidden?: boolean } | undefined;
      const t = stack.world.get(id, Transform);
      if (agent === undefined || agent.hidden === true || t === undefined) continue;
      const point: [number, number, number] = [t.pos[0], t.pos[1] + 1.1, t.pos[2]];
      const distance = Math.hypot(point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]);
      if (distance > reach || distance >= (best?.distance ?? Number.POSITIVE_INFINITY)) continue;
      if (!clear(eye, point)) continue;
      best = { id, distance };
    }
    return best;
  }

  // --- The facade -----------------------------------------------------------------------------

  private add(spec: EarthActorSpec): string {
    const id = spec.id ?? this.nextId();
    if (this.actors.has(id)) throw new Error(`Actor ${id} already exists`);
    if (id === PLAYER || this.stack?.world.exists(id) === true)
      throw new Error(`Entity id ${id} is already taken`);
    const { figure, eyeHeight } = this.resolveFigure(spec.figure);
    const actor = this.create(
      id,
      figure,
      eyeHeight,
      {
        latitude: spec.latitude,
        longitude: spec.longitude,
        altitude: undefined,
        heading: compass(spec.heading ?? 0),
      },
      checkBehaviour(spec.behaviour ?? IDLE),
      spec.interactable ?? false,
    );
    this.actors.set(id, actor);
    this.emit(id, 'added');
    this.place(actor);
    return id;
  }

  private adopt(
    pedestrianId: string,
    spec: { id?: string; behaviour?: EarthActorBehaviour; interactable?: boolean },
  ): string | undefined {
    const world = this.stack?.world;
    if (world === undefined) return undefined;
    const agent = world.get(pedestrianId, AmbientAgent) as { kind?: string } | undefined;
    const figure = world.get(pedestrianId, FigureComponent) as FigureData | undefined;
    const t = world.get(pedestrianId, Transform);
    if (agent?.kind !== 'pedestrian' || figure === undefined || t === undefined) return undefined;
    const id = spec.id ?? pedestrianId;
    if (this.actors.has(id)) throw new Error(`Actor ${id} already exists`);
    if (id !== pedestrianId && (id === PLAYER || world.exists(id)))
      throw new Error(`Entity id ${id} is already taken`);
    const behaviour = checkBehaviour(spec.behaviour ?? IDLE);
    const { eyeHeight } = this.resolveFigure(figure);
    const heading = rotationHeading(t.rot);
    const pos: [number, number, number] = [t.pos[0], t.pos[1], t.pos[2]];
    // Out of ambient life for good: its stepping, despawning and drawing all key on the
    // ambientAgent component, so without it the pedestrian stops and its mesh is released.
    if (id === pedestrianId) {
      world.remove(id, AmbientAgent);
      world.set(id, ActorMarker, {});
      world.patch(id, Transform, { pos, rot: headingRotation(heading) });
    } else {
      world.destroy(pedestrianId);
      world.spawnRaw(
        { transform: { pos, rot: headingRotation(heading) }, figure, earthActor: {} },
        id,
      );
    }
    const geo = this.host.toGeo(pos[0], pos[2]);
    const actor = this.create(
      id,
      figure,
      eyeHeight,
      { ...geo, altitude: pos[1], heading },
      behaviour,
      spec.interactable ?? true,
    );
    actor.look = 'viewer';
    actor.placed = true;
    actor.pos = pos;
    actor.modeSince = world.tick;
    this.actors.set(id, actor);
    this.emit(id, 'added');
    return id;
  }

  private remove(id: string): void {
    const actor = this.actors.get(id);
    if (actor === undefined) return;
    const world = this.stack?.world;
    if (actor.placed && world?.exists(id) === true) world.destroy(id);
    this.deactivate(actor);
    this.actors.delete(id);
    this.emit(id, 'removed');
  }

  private pose(id: string): EarthActorPose | undefined {
    const actor = this.actors.get(id);
    if (actor === undefined) return undefined;
    const placed = actor.placed && this.stack !== undefined;
    const geo = placed ? this.host.toGeo(actor.pos[0], actor.pos[2]) : actor.geo;
    return {
      latitude: geo.latitude,
      longitude: geo.longitude,
      altitude: placed ? actor.pos[1] : (actor.geo.altitude ?? 0),
      heading: placed ? actor.heading : actor.geo.heading,
      speed: placed ? actor.speed : 0,
      mode: actor.seat !== undefined ? 'sit' : placed ? actor.mode : 'idle',
      behaviour: actor.behaviour.kind,
      ...(actor.seat !== undefined ? { mounted: { ...actor.seat } } : {}),
      placed,
    };
  }

  private setBehaviour(id: string, behaviour: EarthActorBehaviour): void {
    const actor = this.actors.get(id);
    if (actor === undefined) return;
    actor.behaviour = checkBehaviour(behaviour);
    actor.progress = undefined;
    actor.raised = new Set();
    actor.failure = undefined;
    actor.face = undefined;
    actor.retryAt = 0;
    actor.wander = { goal: undefined, until: 0 };
    // A forced boarding is immediate, so the host can drive off in the same breath.
    if (behaviour.kind === 'board' && behaviour.force === true && actor.placed && !actor.seat) {
      const outer = this.raising;
      this.raising = new Set();
      this.board(actor, behaviour);
      actor.raised = this.raising;
      this.raising = outer;
      for (const reason of actor.raised) this.emit(actor.id, 'stuck', reason);
    }
  }

  // --- Internals ------------------------------------------------------------------------------

  private nextId(): string {
    let id: string;
    do id = `actor-${++this.sequence}`;
    while (this.actors.has(id) || this.stack?.world.exists(id) === true);
    return id;
  }

  private resolveFigure(figure: FigureData | { type: string }): {
    figure: FigureData;
    eyeHeight: number;
  } {
    let data: FigureData;
    if ('type' in figure && typeof figure.type === 'string') {
      const types = this.host.types;
      if (types === undefined || !types.has(figure.type))
        throw new Error(`No entity type ${figure.type} in the content packs`);
      try {
        data = types.component<FigureData>(figure.type, 'figure');
      } catch {
        throw new Error(`Entity type ${figure.type} has no figure component`);
      }
    } else data = figure as FigureData;
    const resolved = resolveFigureDescriptor(data);
    return {
      figure: data,
      eyeHeight: resolved.height * (resolved.archetype === 'biped' ? 0.93 : 1),
    };
  }

  private create(
    id: string,
    figure: FigureData,
    eyeHeight: number,
    geo: Actor['geo'],
    behaviour: EarthActorBehaviour,
    interactable: boolean,
  ): Actor {
    return {
      id,
      figure,
      eyeHeight,
      behaviour,
      interactable,
      look: null,
      geo,
      seat: undefined,
      placed: false,
      pos: [0, 0, 0],
      heading: geo.heading,
      speed: 0,
      mode: 'idle',
      modeSince: 0,
      face: undefined,
      walker: undefined,
      collision: undefined,
      travelled: 0,
      progress: undefined,
      raised: new Set(),
      failure: undefined,
      wander: { goal: undefined, until: 0 },
      retryAt: 0,
      random: seededRandom(id),
    };
  }

  private emit(id: string, change: EarthActorChange['change'], reason?: string): void {
    const event: EarthActorChange = { id, change, ...(reason !== undefined ? { reason } : {}) };
    if (this.queue !== undefined) this.queue.push(event);
    else this.host.emit(event);
  }

  private raise(reason: string): void {
    this.raising.add(reason);
  }

  /** Put an actor's entity in the current world once its ground (or its vehicle) is there. */
  private place(actor: Actor): void {
    const world = this.stack?.world;
    if (world === undefined || world.exists(actor.id)) return;
    const [x, z] = this.host.toWorld(actor.geo.latitude, actor.geo.longitude);
    if (actor.seat !== undefined) {
      const { vehicle, seat } = actor.seat;
      const mount = world.get(vehicle, Mountable);
      if (mount !== undefined && world.has(vehicle, Transform)) {
        // Back in its seat, unless someone took it meanwhile (then it stands where it was).
        const free = this.seatFor(world, actor.id, vehicle, mount, seat);
        if (free !== undefined) {
          this.spawnEntity(world, actor, [x, actor.geo.altitude ?? 0, z]);
          this.seatNow(world, actor, vehicle, free);
          actor.placed = true;
          this.readSeat(world, actor);
          return;
        }
      } else if (this.host.ownsVehicle?.(vehicle) === true) return;
      actor.seat = undefined;
    }
    const ground = this.host.groundHeight(x, z);
    if (ground === undefined) return;
    actor.pos = [x, ground, z];
    actor.heading = actor.geo.heading;
    this.spawnEntity(world, actor, actor.pos);
    actor.placed = true;
    actor.speed = 0;
    this.setMode(world, actor, 'idle');
  }

  private spawnEntity(world: World, actor: Actor, pos: [number, number, number]): void {
    world.spawnRaw(
      {
        transform: { pos: [...pos], rot: headingRotation(actor.heading) },
        figure: actor.figure,
        earthActor: {},
      },
      actor.id,
    );
  }

  /** Refresh the geographic record from the entities (every 200 ms, and before a re-anchor). */
  private sync(force = false): void {
    if (!force && this.now - this.syncedAt < 200) return;
    this.syncedAt = this.now;
    for (const actor of this.actors.values()) {
      if (!actor.placed) continue;
      const geo = this.host.toGeo(actor.pos[0], actor.pos[2]);
      actor.geo = { ...geo, altitude: actor.pos[1], heading: actor.heading };
    }
  }

  private chooseActive(center: readonly [number, number, number]): void {
    const ranked: { actor: Actor; distance: number }[] = [];
    for (const actor of this.actors.values()) {
      if (!actor.placed || actor.seat !== undefined) {
        this.deactivate(actor);
        continue;
      }
      const distance = Math.hypot(actor.pos[0] - center[0], actor.pos[2] - center[2]);
      // A little hysteresis keeps an actor at the edge from flickering in and out.
      const radius = this.activeRadius * (actor.walker !== undefined ? 1.1 : 1);
      if (distance <= radius) ranked.push({ actor, distance });
      else this.deactivate(actor);
    }
    ranked.sort((a, b) => a.distance - b.distance || (a.actor.id < b.actor.id ? -1 : 1));
    ranked.forEach(({ actor }, index) => {
      if (index < this.maxActive) this.activate(actor);
      else this.deactivate(actor);
    });
  }

  private activate(actor: Actor): void {
    if (actor.walker !== undefined) return;
    const walker = new WalkController();
    walker.feet.set(actor.pos[0], actor.pos[1], actor.pos[2]);
    walker.ready = true;
    walker.grounded = true;
    walker.waitingForTerrain = false;
    actor.walker = walker;
    actor.collision = new WalkCollision({ radius: 12, rebuildDistance: 4, rescanIntervalMs: 250 });
  }

  private deactivate(actor: Actor): void {
    actor.walker = undefined;
    actor.collision?.clear();
    actor.collision = undefined;
  }

  private setMode(world: World, actor: Actor, mode: EarthActorPose['mode']): void {
    if (actor.mode === mode) return;
    actor.mode = mode;
    actor.modeSince = world.tick;
  }

  /** Move an actor on foot to a world point at once (a teleport). */
  private moveTo(world: World, actor: Actor, pos: [number, number, number]): void {
    actor.pos = pos;
    if (actor.walker !== undefined) {
      actor.walker.feet.set(pos[0], pos[1], pos[2]);
      actor.walker.velocity.set(0, 0, 0);
      actor.collision?.clear();
    }
    actor.progress = undefined;
    world.patch(actor.id, Transform, { pos: [...pos], rot: headingRotation(actor.heading) });
  }

  private step(actor: Actor, dt: number): void {
    const world = (this.stack as EarthActorStack).world;
    if (actor.seat !== undefined) {
      this.stepSeated(world, actor);
      return;
    }
    const steer = this.steer(world, actor);
    if (actor.seat !== undefined) return; // boarded this frame
    this.move(world, actor, steer, dt);
    this.watchProgress(actor, steer);
  }

  private stepSeated(world: World, actor: Actor): void {
    const seat = actor.seat as { vehicle: string; seat: string };
    const mounted = world.get(actor.id, Mounted);
    if (mounted === undefined || !world.exists(mounted.vehicle)) {
      // The vehicle was removed (or the seat dropped): stand where it was.
      if (mounted !== undefined) world.remove(actor.id, Mounted);
      actor.seat = undefined;
      const t = world.get(actor.id, Transform);
      const x = t?.pos[0] ?? actor.pos[0];
      const z = t?.pos[2] ?? actor.pos[2];
      const ground = this.host.groundHeight(x, z) ?? actor.pos[1] - 1.1;
      this.standUp(world, actor, [x, ground, z]);
      this.emit(actor.id, 'alighted', 'vehicle-gone');
      return;
    }
    if (mounted.vehicle !== seat.vehicle || mounted.seat !== seat.seat)
      actor.seat = { vehicle: mounted.vehicle, seat: mounted.seat };
    this.readSeat(world, actor);
    const behaviour = actor.behaviour;
    if (behaviour.kind === 'alight') this.alight(world, actor);
    else if (behaviour.kind === 'board' && behaviour.vehicle === mounted.vehicle)
      actor.behaviour = IDLE;
  }

  private readSeat(world: World, actor: Actor): void {
    const t = world.get(actor.id, Transform);
    if (t !== undefined) {
      actor.pos = [t.pos[0], t.pos[1], t.pos[2]];
      actor.heading = rotationHeading(t.rot);
    }
    actor.speed = actor.seat !== undefined ? vehicleSpeed(world, actor.seat.vehicle) : 0;
    this.setMode(world, actor, 'sit');
  }

  private standUp(world: World, actor: Actor, feet: [number, number, number]): void {
    actor.pos = feet;
    actor.speed = 0;
    actor.progress = undefined;
    actor.failure = undefined;
    this.setMode(world, actor, 'idle');
    world.patch(actor.id, Transform, { pos: [...feet], rot: headingRotation(actor.heading) });
  }

  private steer(world: World, actor: Actor): Steer {
    const behaviour = actor.behaviour;
    switch (behaviour.kind) {
      case 'follow':
        return this.follow(world, actor, behaviour);
      case 'goTo':
        return this.goTo(actor, behaviour);
      case 'wander':
        return this.wanderStep(actor, behaviour);
      case 'board':
        return this.board(actor, behaviour);
      case 'alight':
        actor.behaviour = IDLE;
        return this.standing(actor);
      default:
        return this.standing(actor);
    }
  }

  private standing(actor: Actor): Steer {
    return actor.face !== undefined ? { speed: 0, run: false, face: actor.face } : STAND;
  }

  private target(
    self: Actor,
    target: 'viewer' | { actor: string },
  ): { pos: readonly [number, number, number]; heading: number; mounted: boolean } | undefined {
    if (target === 'viewer') {
      const viewer = this.viewer;
      if (viewer.position === undefined) return undefined;
      return {
        pos: viewer.position,
        heading: viewer.heading,
        mounted: viewer.vehicle !== undefined,
      };
    }
    const other = this.actors.get(target.actor);
    if (other === undefined || other === self || !other.placed) return undefined;
    return { pos: other.pos, heading: other.heading, mounted: other.seat !== undefined };
  }

  private follow(
    world: World,
    actor: Actor,
    behaviour: Extract<EarthActorBehaviour, { kind: 'follow' }>,
  ): Steer {
    const target = this.target(actor, behaviour.target);
    if (target === undefined) return STAND;
    if (target.mounted) {
      this.raise('target-mounted');
      return STAND;
    }
    const distance = Math.max(0, behaviour.distance ?? 2.5);
    const dx = actor.pos[0] - target.pos[0];
    const dz = actor.pos[2] - target.pos[2];
    const gap = Math.hypot(dx, dz);
    if (gap > (behaviour.teleportBeyond ?? 60)) {
      // Behind the target, opposite the way it faces.
      const x = target.pos[0] - Math.sin(target.heading) * distance;
      const z = target.pos[2] + Math.cos(target.heading) * distance;
      actor.heading = target.heading;
      this.moveTo(world, actor, [x, this.host.groundHeight(x, z) ?? target.pos[1], z]);
      this.emit(actor.id, 'teleported');
      return STAND;
    }
    const face = compass(Math.atan2(-dx, dz));
    if (Math.abs(gap - distance) <= 0.6) return { speed: 0, run: false, face };
    const ux = gap > 1e-3 ? dx / gap : -Math.sin(target.heading);
    const uz = gap > 1e-3 ? dz / gap : Math.cos(target.heading);
    const goal: [number, number] = [target.pos[0] + ux * distance, target.pos[2] + uz * distance];
    const jog = behaviour.jogBeyond ?? 8;
    const run = gap > jog || (actor.mode === 'run' && gap > Math.max(distance + 1.5, jog * 0.6));
    const remaining = Math.abs(gap - distance);
    return {
      goal,
      speed: run ? RUN_SPEED : Math.min(WALK_SPEED, Math.max(0.5, remaining * 1.2)),
      run,
    };
  }

  private goTo(actor: Actor, behaviour: Extract<EarthActorBehaviour, { kind: 'goTo' }>): Steer {
    const [x, z] = this.host.toWorld(behaviour.to.latitude, behaviour.to.longitude);
    const distance = Math.hypot(x - actor.pos[0], z - actor.pos[2]);
    if (distance <= Math.max(0.05, behaviour.arriveWithin ?? 1)) {
      actor.behaviour = IDLE;
      actor.progress = undefined;
      if (behaviour.to.heading !== undefined) actor.face = compass(behaviour.to.heading);
      this.emit(actor.id, 'arrived');
      return this.standing(actor);
    }
    return { goal: [x, z], speed: Math.min(WALK_SPEED, Math.max(0.6, distance * 1.2)), run: false };
  }

  private wanderStep(
    actor: Actor,
    behaviour: Extract<EarthActorBehaviour, { kind: 'wander' }>,
  ): Steer {
    const wander = actor.wander;
    if (wander.goal === undefined) {
      if (this.now < wander.until) return this.standing(actor);
      wander.goal = this.wanderGoal(actor, behaviour.around, Math.max(1, behaviour.radius ?? 20));
      if (wander.goal === undefined) {
        wander.until = this.now + 4_000;
        return this.standing(actor);
      }
    }
    const distance = Math.hypot(wander.goal[0] - actor.pos[0], wander.goal[1] - actor.pos[2]);
    if (distance < 0.6) {
      wander.goal = undefined;
      wander.until = this.now + 2_000 + actor.random() * 6_000;
      return this.standing(actor);
    }
    return {
      goal: wander.goal,
      speed: Math.min(1.1, Math.max(0.5, distance * 1.2)),
      run: false,
    };
  }

  /** A point on a mapped footway within `radius` of a place, or undefined when none is near. */
  private wanderGoal(
    actor: Actor,
    around: EarthPlace,
    radius: number,
  ): [number, number] | undefined {
    const ambient = this.stack?.ambient;
    if (ambient === undefined) return undefined;
    const [cx, cz] = this.host.toWorld(around.latitude, around.longitude);
    for (let attempt = 0; attempt < 4; attempt++) {
      const angle = actor.random() * TAU;
      const r = radius * Math.sqrt(actor.random());
      const hit = ambient.laneAt(cx + Math.cos(angle) * r, cz + Math.sin(angle) * r, {
        class: 'walk',
        radius,
      });
      if (hit === undefined) continue;
      const length = ambient.network.lane(hit.lane)?.length ?? hit.s;
      const s = Math.max(0, Math.min(length, hit.s + (actor.random() - 0.5) * 12));
      const sample = ambient.laneSample(hit.lane, s);
      if (sample === undefined || Math.hypot(sample.x - cx, sample.z - cz) > radius * 1.25)
        continue;
      return [sample.x, sample.z];
    }
    return undefined;
  }

  /** Seats taken by someone else, then the wanted seat or the first free passenger seat. */
  private seatFor(
    world: World,
    actorId: string,
    vehicle: string,
    mount: MountableData,
    wanted: string | undefined,
  ): SeatData | undefined {
    const taken = new Set<string>();
    for (const [other, mounted] of world.query(Mounted))
      if (other !== actorId && mounted.vehicle === vehicle) taken.add(mounted.seat);
    if (wanted !== undefined) {
      const seat = mount.seats.find((s) => s.id === wanted);
      return seat !== undefined && !taken.has(seat.id) ? seat : undefined;
    }
    return mount.seats.find((s) => s.role === 'passenger' && !taken.has(s.id));
  }

  /** Seat an actor at once, whatever the reach or the vehicle's motion. */
  private seatNow(world: World, actor: Actor, vehicle: string, seat: SeatData): boolean {
    const t = world.get(vehicle, Transform);
    if (t === undefined || world.has(actor.id, Mounted)) return false;
    world.patch(actor.id, Transform, {
      pos: vehicleLocalPoint(t, seat.position),
      rot: [t.rot[0], t.rot[1], t.rot[2], t.rot[3]],
    });
    world.set(actor.id, Mounted, { vehicle, seat: seat.id });
    world.emit('vehicle-mounted', { actor: actor.id, vehicle, seat: seat.id });
    return true;
  }

  private boarded(world: World, actor: Actor, vehicle: string, seat: string): void {
    actor.seat = { vehicle, seat };
    actor.behaviour = IDLE;
    actor.progress = undefined;
    actor.failure = undefined;
    actor.face = undefined;
    this.deactivate(actor);
    this.readSeat(world, actor);
    this.emit(actor.id, 'boarded');
  }

  private board(actor: Actor, behaviour: Extract<EarthActorBehaviour, { kind: 'board' }>): Steer {
    const world = (this.stack as EarthActorStack).world;
    const { vehicle } = behaviour;
    const t = world.get(vehicle, Transform);
    const mount = world.get(vehicle, Mountable);
    if (t === undefined || mount === undefined) {
      this.raise('no-vehicle');
      return STAND;
    }
    const seat = this.seatFor(world, actor.id, vehicle, mount, behaviour.seat);
    if (seat === undefined) {
      this.raise('no-seat');
      return STAND;
    }
    if (behaviour.force === true) {
      if (this.seatNow(world, actor, vehicle, seat)) this.boarded(world, actor, vehicle, seat.id);
      else this.raise('no-seat');
      return STAND;
    }
    if (vehicleMoving(world, vehicle)) {
      this.raise('moving');
      return STAND;
    }
    // The door nearest the seat (an exit point), on the ground beside the vehicle.
    let door: [number, number, number] | undefined;
    let nearest = Number.POSITIVE_INFINITY;
    for (const exit of mount.exits) {
      const d = Math.hypot(exit[0] - seat.position[0], exit[2] - seat.position[2]);
      if (d < nearest) {
        nearest = d;
        door = vehicleLocalPoint(t, exit);
      }
    }
    const seatPoint = vehicleLocalPoint(t, seat.position);
    const goal = door ?? seatPoint;
    const distance = Math.hypot(goal[0] - actor.pos[0], goal[2] - actor.pos[2]);
    const reach = Math.hypot(
      seatPoint[0] - actor.pos[0],
      seatPoint[1] - actor.pos[1],
      seatPoint[2] - actor.pos[2],
    );
    if (distance < 0.7 || (reach <= mount.reach - 0.2 && distance < 2)) {
      if (this.now >= actor.retryAt) {
        actor.retryAt = this.now + 400;
        world.patch(actor.id, Transform, { pos: [...actor.pos] });
        if (mountEntity(world, actor.id, vehicle, seat.id)) {
          this.boarded(world, actor, vehicle, seat.id);
          return STAND;
        }
        actor.failure = 'unreachable';
      }
      if (actor.failure !== undefined) this.raise(actor.failure);
      return {
        speed: 0,
        run: false,
        face: compass(Math.atan2(t.pos[0] - actor.pos[0], -(t.pos[2] - actor.pos[2]))),
      };
    }
    const far = distance > 20;
    return {
      goal: [goal[0], goal[2]],
      speed: far ? RUN_SPEED : Math.min(WALK_SPEED, Math.max(0.6, distance * 1.2)),
      run: far,
    };
  }

  private alight(world: World, actor: Actor): void {
    const vehicle = (actor.seat as { vehicle: string }).vehicle;
    if (this.now >= actor.retryAt) {
      actor.retryAt = this.now + 250;
      const vehicles = this.stack?.vehicles;
      const feet =
        vehicles !== undefined
          ? vehicles.unmount(actor.id)
          : unmountEntity(world, actor.id, { groundHeight: this.ground })
            ? world.get(actor.id, Transform)?.pos
            : undefined;
      if (feet !== undefined) {
        actor.seat = undefined;
        actor.behaviour = IDLE;
        this.standUp(world, actor, [feet[0], feet[1], feet[2]]);
        this.emit(actor.id, 'alighted');
        return;
      }
      actor.failure = vehicleMoving(world, vehicle) ? 'moving' : 'blocked';
    }
    if (actor.failure !== undefined) this.raise(actor.failure);
  }

  /** Walk (near the viewer, with collision) or glide over the terrain toward the steer goal. */
  private move(world: World, actor: Actor, steer: Steer, dt: number): void {
    const before = actor.pos;
    let vx = 0;
    let vz = 0;
    const walker = actor.walker;
    const collision = actor.collision;
    const root = this.stack?.root;
    if (walker !== undefined && collision !== undefined && root !== undefined) {
      collision.update(root, walker.feet.x, walker.feet.z);
      const input: WalkInput =
        steer.goal !== undefined && steer.speed > 0
          ? {
              forward: Math.min(1, steer.speed / (steer.run ? RUN_SPEED : WALK_SPEED)),
              right: 0,
              yaw: Math.atan2(steer.goal[1] - walker.feet.z, steer.goal[0] - walker.feet.x),
              sprint: steer.run,
              jump: false,
            }
          : { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
      walker.update(dt, input, collision, this.ground);
      actor.pos = [walker.feet.x, walker.feet.y, walker.feet.z];
      vx = walker.velocity.x;
      vz = walker.velocity.z;
    } else if (steer.goal !== undefined && steer.speed > 0 && dt > 0) {
      const dx = steer.goal[0] - actor.pos[0];
      const dz = steer.goal[1] - actor.pos[2];
      const distance = Math.hypot(dx, dz);
      const step = Math.min(distance, steer.speed * dt);
      const x = actor.pos[0] + (dx / distance) * step;
      const z = actor.pos[2] + (dz / distance) * step;
      const ground = this.host.groundHeight(x, z);
      // Unstreamed ground is not walked onto, as the walker never steps off the loaded terrain.
      if (ground !== undefined && distance > 1e-6) {
        actor.pos = [x, ground, z];
        vx = (dx / distance) * (step / dt);
        vz = (dz / distance) * (step / dt);
      }
    }
    actor.travelled += Math.hypot(actor.pos[0] - before[0], actor.pos[2] - before[2]);
    actor.speed = Math.hypot(vx, vz);
    const turn = Math.max(0, dt);
    if (actor.speed > 0.15) {
      actor.face = undefined;
      actor.heading = turnToward(actor.heading, compass(Math.atan2(vx, -vz)), 10 * turn);
    } else if (steer.face !== undefined) {
      actor.heading = turnToward(actor.heading, steer.face, 4 * turn);
    } else {
      // Standing with something to look at behind it: turn the body, the head does the rest.
      const look = this.lookPoint(actor);
      if (look !== undefined) {
        const toward = compass(Math.atan2(look[0] - actor.pos[0], -(look[2] - actor.pos[2])));
        let delta = Math.abs(toward - actor.heading) % TAU;
        if (delta > Math.PI) delta = TAU - delta;
        if (delta > 1.6) actor.heading = turnToward(actor.heading, toward, 3 * turn);
      }
    }
    this.setMode(
      world,
      actor,
      actor.speed > 0.15 ? (steer.run && actor.speed > 2.2 ? 'run' : 'walk') : 'idle',
    );
    world.patch(actor.id, Transform, {
      pos: [...actor.pos],
      rot: headingRotation(actor.heading),
    });
  }

  /** Report `stuck` after STUCK_MS without STUCK_PROGRESS meters of progress toward a goal. */
  private watchProgress(actor: Actor, steer: Steer): void {
    if (steer.goal === undefined || steer.speed <= 0) {
      actor.progress = undefined;
      return;
    }
    const behaviour = actor.behaviour;
    // A follower's goal moves with its target, so its progress is the ground it covers.
    const metric =
      behaviour.kind === 'follow'
        ? -actor.travelled
        : Math.hypot(steer.goal[0] - actor.pos[0], steer.goal[1] - actor.pos[2]);
    const key = behaviour.kind === 'wander' ? actor.wander.goal : behaviour;
    const progress = actor.progress;
    if (progress === undefined || progress.key !== key) {
      actor.progress = { key, best: metric, at: this.now };
      return;
    }
    if (metric < progress.best - STUCK_PROGRESS) {
      progress.best = metric;
      progress.at = this.now;
      return;
    }
    if (this.now - progress.at < STUCK_MS) return;
    if (behaviour.kind === 'wander') {
      // A stroll that runs into a wall picks another spot.
      actor.wander = { goal: undefined, until: this.now + 1_000 };
      actor.progress = undefined;
      return;
    }
    this.raise('blocked');
  }

  /** The world point an actor's head turns toward, when in range. */
  private lookPoint(actor: Actor): [number, number, number] | undefined {
    const target = actor.look;
    let point: readonly [number, number, number] | undefined;
    if (target === null) return undefined;
    if (target === 'viewer') point = this.viewer.eye;
    else if ('actor' in target) {
      const other = this.actors.get(target.actor);
      if (other === undefined || other === actor || !other.placed) return undefined;
      point =
        other.seat !== undefined
          ? other.pos
          : [other.pos[0], other.pos[1] + other.eyeHeight, other.pos[2]];
    } else {
      const [x, z] = this.host.toWorld(target.latitude, target.longitude);
      point = [x, (this.host.groundHeight(x, z) ?? actor.pos[1]) + 1.6, z];
    }
    if (point === undefined) return undefined;
    if (Math.hypot(point[0] - actor.pos[0], point[2] - actor.pos[2]) > LOOK_RANGE) return undefined;
    return [point[0], point[1], point[2]];
  }

  private updateAvatar(world: World, frame: EarthAvatarFrame, dt: number): void {
    this.avatarVisible = frame.visible && this.avatar !== undefined;
    if (this.avatar === undefined || !world.exists(PLAYER)) return;
    if (frame.feet === undefined || world.has(PLAYER, Mounted)) {
      this.avatarSpeed = 0;
      return;
    }
    const [vx, vz] = frame.velocity ?? [0, 0];
    const speed = Math.hypot(vx, vz);
    // Face where the walker goes; standing, face where the camera looks.
    const target =
      speed > 0.3 ? compass(Math.atan2(vx, -vz)) : (frame.heading ?? this.avatarHeading);
    this.avatarHeading = turnToward(this.avatarHeading, target, 12 * Math.max(0, dt));
    const moving = speed > 0.15;
    if (moving !== this.avatarMoving) {
      this.avatarMoving = moving;
      this.avatarSince = world.tick;
    }
    this.avatarSpeed = speed;
    world.patch(PLAYER, Transform, {
      pos: [frame.feet[0], frame.feet[1], frame.feet[2]],
      rot: headingRotation(this.avatarHeading),
    });
  }

  /** Draw every figure in the world that ambient life does not draw: actors and the avatar. */
  private render(world: World, camera: readonly [number, number, number]): void {
    const figures = this.figures;
    if (figures === undefined) return;
    // Nobody to draw (the common case): skip walking the world's figures every frame.
    if (this.actors.size === 0 && !this.avatarVisible) {
      if (figures.count > 0) figures.update([], camera, world.tick, world.tickRate);
      return;
    }
    const walkers: WalkerView[] = [];
    for (const [id, figure, t] of world.query(FigureComponent, Transform).without(AmbientAgent)) {
      const mounted = world.get(id, Mounted);
      const seated = mounted !== undefined;
      const riding =
        mounted === undefined
          ? undefined
          : cycleRiderPose(
              world.get(mounted.vehicle, Vehicle),
              world.get(mounted.vehicle, VehicleState),
              world.get(mounted.vehicle, Mountable)?.seats.find((seat) => seat.id === mounted.seat),
            );
      const seating = seated
        ? { mode: 'sit' as const, anchor: riding ? ('pelvis' as const) : ('eye' as const), riding }
        : {};
      if (id === PLAYER) {
        if (!this.avatarVisible) continue;
        walkers.push({
          id,
          figure: figure as FigureData,
          pos: t.pos,
          rot: t.rot,
          speed: seated ? 0 : this.avatarSpeed,
          since: this.avatarSince,
          hidden: false,
          ...(seated ? seating : this.avatarSpeed > 2.2 ? { mode: 'run' as const } : {}),
        });
        continue;
      }
      const actor = this.actors.get(id);
      const look = actor !== undefined ? this.lookPoint(actor) : undefined;
      walkers.push({
        id,
        figure: figure as FigureData,
        pos: t.pos,
        rot: t.rot,
        speed: seated ? 0 : (actor?.speed ?? 0),
        since: actor?.modeSince ?? 0,
        hidden: false,
        ...seating,
        ...(!seated && actor !== undefined ? { mode: actor.mode } : {}),
        ...(look !== undefined ? { lookAt: look } : {}),
      });
    }
    figures.update(walkers, camera, world.tick, world.tickRate);
  }
}
