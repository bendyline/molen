import { quatRotateVec3, Transform, type TransformData, type World } from '@bendyline/molen-kernel';
import {
  Character,
  type CharacterData,
  MoveIntent,
  type MoveIntentData,
} from '@bendyline/molen-kernel/character';
import type { EntityId, JsonValue, SceneManifest, Vec3 } from '@bendyline/molen-schema';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  Collider3D,
  type Collider3DData,
  Force,
  Impulse,
  Joint,
  type JointData,
  type RigidBodyData,
  Rigidbody,
  SetVelocity,
  type Shape3D,
  Velocity,
  type VelocityData,
} from './components';

// Opt-in Rapier rigid-body physics. rapier3d-compat (inlined WASM) loads identically in Node,
// Workers, and the browser. Colliders/bodies are authored as components; the plugin mirrors
// body transforms back into the ECS each tick, so deltas, interpolation, and snapshots see
// physics motion with no special cases. Snapshots are hybrid: the legible transform mirror
// lives in components, plus an opaque Rapier blob (with the id->handle maps) for bit-exact
// resume. Determinism: same-build/same-platform only (measured in tests) — the 2.5D kinematics
// layer remains the cross-platform-deterministic option.
//
// Change detection relies on the kernel's freeze-on-write reads: `world.get` returns the STORED
// component reference, which only changes when set/patch/spawn writes that component. So
// `w.get(id, X) !== last.get(id)` is an exact "changed since I last looked" signal with no
// per-tick serialization.

export type {
  Collider3DData,
  ForceData,
  ImpulseData,
  JointData,
  RigidBodyData,
  SetVelocityData,
  Shape3D,
  VelocityData,
} from './components';
export { Collider3D, Force, Impulse, Joint, Rigidbody, SetVelocity, Velocity } from './components';

let initPromise: Promise<void> | undefined;
// `RAPIER.World` is an ordinary class binding that exists before `RAPIER.init()` resolves, so
// its presence is not a readiness signal — only the WASM glue behind it is missing. Track the
// resolved init instead, and use it to explain a raw WASM failure when the world can't be built.
let wasmReady = false;
/** Initialize the Rapier WASM runtime once. Must be awaited before installRapier. */
export async function initRapier(): Promise<void> {
  if (initPromise === undefined) {
    initPromise = RAPIER.init().then(() => {
      wasmReady = true;
    });
  }
  return initPromise;
}

/** Message for the most common integration mistake: installing before the WASM runtime is up. */
const NOT_INITIALIZED = 'Rapier is not initialized — await initRapier() before installRapier()';

/**
 * Build the physics world, translating the opaque WASM failure of an uninitialized runtime
 * (`Cannot read properties of undefined (reading 'rawintegrationparameters_new')`) into the
 * message that names the missing step. A direct `RAPIER.init()` (no `initRapier()`) still works:
 * the world constructs and nothing is rewritten.
 */
function newRapierWorld(gravity: Vec3): RAPIER.World {
  try {
    return new RAPIER.World({ x: gravity[0], y: gravity[1], z: gravity[2] });
  } catch (cause) {
    if (wasmReady) throw cause;
    throw new Error(NOT_INITIALIZED, { cause });
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin);
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Heightfield geometry: `heights` is an nrows x ncols SAMPLE matrix (nrows*ncols entries) in
 * column-major order (`heights[col * nrows + row]`). Columns run along local +x (column j sits
 * at `(-0.5 + j/(ncols-1)) * scale.x`), rows along local +z; `scale` is the local x/z extent
 * and the y multiplier. The shape is centered on its local origin unless `center` is given,
 * which becomes the collider's local translation when the authored collider has no `offset`
 * of its own. (Rapier's own API counts cells; the plugin converts.)
 */
export interface HeightfieldGeometry {
  nrows: number;
  ncols: number;
  heights: Float32Array;
  scale: Vec3;
  center?: Vec3;
}

/** How `asset`/`heightfield` shapes resolve to geometry (wired by tooling/apps; fs-free here). */
export interface ShapeResolvers {
  asset?(
    assetId: string,
    kind: 'hull' | 'trimesh',
    index?: number,
  ): { points: Float32Array } | { vertices: Float32Array; indices: Uint32Array } | undefined;
  heightfield?(ref: string): HeightfieldGeometry | undefined;
}

export interface RapierCharacterOptions {
  /** Controller skin offset (default 0.02). */
  offset?: number;
  maxSlopeClimbAngle?: number;
  autostep?: { maxHeight: number; minWidth: number };
  snapToGround?: number;
}

export interface RapierOptions {
  gravity?: Vec3;
  resolvers?: ShapeResolvers;
  character?: RapierCharacterOptions;
}

/** Collider filter shared by the spatial queries. */
export interface QueryFilter {
  /** Only colliders whose `layer` bits intersect this mask are considered. */
  mask?: number;
  /** Entities whose colliders are skipped. */
  exclude?: EntityId[];
}

export interface RaycastOptions extends QueryFilter {
  /** `false` treats shapes as hollow (a ray starting inside still hits the boundary). Default true. */
  solid?: boolean;
}

export interface RayHit3D {
  id: EntityId;
  distance: number;
  point: Vec3;
  /** Surface normal at the hit point. */
  normal: Vec3;
}

export interface RapierHandle {
  /** The live Rapier world (escape hatch). */
  readonly world: RAPIER.World;
  /** A boolean `opts` keeps the older `solid` meaning. */
  raycast(
    origin: Vec3,
    dir: Vec3,
    maxDist: number,
    opts?: boolean | RaycastOptions,
  ): RayHit3D | null;
  overlapSphere(center: Vec3, radius: number, opts?: QueryFilter): EntityId[];
  /** Live velocity read (not serialized; use the `velocity` component for mirrored state). */
  velocityOf(id: EntityId): { linear: Vec3; angular: Vec3 } | undefined;
  /**
   * Free the Rapier world, event queue, and character-controller WASM resources, and detach
   * the system + snapshot provider from the world. Queries throw afterwards.
   */
  dispose(): void;
}

const RAPIER_SNAPSHOT_VERSION = '0.19.3';
const SYSTEM_NAME = 'rapier';
const PROVIDER_NAME = 'rapier';

interface RapierState {
  world: RAPIER.World;
  bodies: Map<EntityId, number>;
  colliders: Map<EntityId, number[]>;
  colliderOwner: Map<number, EntityId>;
  joints: Map<EntityId, number>;
  /** Stored component references as of the last reconcile (identity = change signal). */
  lastRigidbody: Map<EntityId, Readonly<RigidBodyData> | undefined>;
  lastCollider: Map<EntityId, Readonly<Collider3DData> | undefined>;
  lastTransform: Map<EntityId, Readonly<TransformData> | undefined>;
  lastJoint: Map<EntityId, Readonly<JointData>>;
  /** Bodies that had a `force` applied last tick (so its removal can reset the latched force). */
  forced: Set<EntityId>;
  characters: Map<EntityId, RAPIER.KinematicCharacterController>;
  queue: RAPIER.EventQueue;
  disposed: boolean;
}

function shapeToDesc(shape: Shape3D, resolvers?: ShapeResolvers, scale = 1): RAPIER.ColliderDesc {
  const points = (values: ArrayLike<number>): Float32Array =>
    Float32Array.from(values, (v) => v * scale);
  switch (shape.type) {
    case 'ball':
      return RAPIER.ColliderDesc.ball(shape.radius * scale);
    case 'cuboid':
      return RAPIER.ColliderDesc.cuboid(shape.hx * scale, shape.hy * scale, shape.hz * scale);
    case 'capsule':
      return RAPIER.ColliderDesc.capsule(shape.halfHeight * scale, shape.radius * scale);
    case 'convexHull': {
      const desc = RAPIER.ColliderDesc.convexHull(points(shape.points));
      if (desc === null) throw new Error('degenerate convexHull points');
      return desc;
    }
    case 'trimesh':
      return RAPIER.ColliderDesc.trimesh(points(shape.vertices), new Uint32Array(shape.indices));
    case 'asset': {
      const kind = shape.collision ?? 'hull';
      const geom = resolvers?.asset?.(shape.assetId, kind, shape.index);
      if (geom === undefined) {
        throw new Error(
          `collider3d asset "${shape.assetId}" (${kind}) is unresolved — pass RapierOptions.resolvers.asset`,
        );
      }
      if ('points' in geom) {
        const desc = RAPIER.ColliderDesc.convexHull(points(geom.points));
        if (desc === null) throw new Error(`degenerate hull for asset "${shape.assetId}"`);
        return desc;
      }
      return RAPIER.ColliderDesc.trimesh(points(geom.vertices), geom.indices);
    }
    case 'heightfield': {
      const hf = resolvers?.heightfield?.(shape.ref);
      if (hf === undefined) {
        throw new Error(
          `collider3d heightfield "${shape.ref}" is unresolved — pass RapierOptions.resolvers.heightfield`,
        );
      }
      if (
        !Number.isSafeInteger(hf.nrows) ||
        !Number.isSafeInteger(hf.ncols) ||
        hf.nrows < 2 ||
        hf.ncols < 2 ||
        hf.heights.length !== hf.nrows * hf.ncols
      ) {
        throw new Error(
          `collider3d heightfield "${shape.ref}": heights must hold nrows*ncols samples (nrows, ncols >= 2), got ${hf.heights.length} for ${hf.nrows}x${hf.ncols}`,
        );
      }
      // rapier.js takes CELL subdivisions and reads (nrows+1)*(ncols+1) samples; the resolver
      // contract (and @bendyline/molen-terrain) speaks in sample counts.
      const desc = RAPIER.ColliderDesc.heightfield(hf.nrows - 1, hf.ncols - 1, hf.heights, {
        x: hf.scale[0] * scale,
        y: hf.scale[1] * scale,
        z: hf.scale[2] * scale,
      });
      // Resolver-provided center; an authored `offset` (applied later) overrides it.
      if (hf.center !== undefined)
        desc.setTranslation(hf.center[0] * scale, hf.center[1] * scale, hf.center[2] * scale);
      return desc;
    }
    default:
      throw new Error(`unknown collider3d shape "${(shape as { type: string }).type}"`);
  }
}

// Rapier packs interaction groups as (membership << 16) | filter.
function collisionGroupsOf(data: Readonly<Collider3DData>): number {
  const layer = data.layer ?? 1;
  const mask = data.mask ?? 0xffff;
  return ((layer & 0xffff) << 16) | (mask & 0xffff);
}

function activeEventsOf(data: Readonly<Collider3DData>): RAPIER.ActiveEvents {
  return data.sensor === true || data.events === true
    ? RAPIER.ActiveEvents.COLLISION_EVENTS
    : RAPIER.ActiveEvents.NONE;
}

/** Shape + local pose decide whether a collider can be edited in place or must be rebuilt. */
function geometryKey(data: Readonly<Collider3DData>): string {
  return JSON.stringify([data.shape, data.offset ?? null, data.rotOffset ?? null]);
}

function colliderDesc(
  data: Collider3DData,
  resolvers?: ShapeResolvers,
  scale = 1,
): RAPIER.ColliderDesc {
  const desc = shapeToDesc(data.shape, resolvers, scale);
  if (data.offset !== undefined) {
    desc.setTranslation(data.offset[0] * scale, data.offset[1] * scale, data.offset[2] * scale);
  }
  if (data.rotOffset !== undefined) {
    desc.setRotation({
      x: data.rotOffset[0],
      y: data.rotOffset[1],
      z: data.rotOffset[2],
      w: data.rotOffset[3],
    });
  }
  desc.setCollisionGroups(collisionGroupsOf(data));
  if (data.sensor === true) desc.setSensor(true);
  const events = activeEventsOf(data);
  if (events !== RAPIER.ActiveEvents.NONE) desc.setActiveEvents(events);
  if (data.restitution !== undefined) desc.setRestitution(data.restitution);
  if (data.friction !== undefined) desc.setFriction(data.friction);
  if (data.density !== undefined) desc.setDensity(data.density);
  return desc;
}

/** Apply a rigidbody edit that kept the body kind (velocity and contacts survive). */
function applyBodyInPlace(
  body: RAPIER.RigidBody,
  prev: Readonly<RigidBodyData>,
  next: Readonly<RigidBodyData>,
): void {
  if (next.gravityScale !== prev.gravityScale) body.setGravityScale(next.gravityScale ?? 1, true);
  if (next.linearDamping !== prev.linearDamping) body.setLinearDamping(next.linearDamping ?? 0);
  if (next.angularDamping !== prev.angularDamping) {
    body.setAngularDamping(next.angularDamping ?? 0);
  }
  if ((next.ccd === true) !== (prev.ccd === true)) body.enableCcd(next.ccd === true);
  if ((next.lockRot === true) !== (prev.lockRot === true)) {
    body.lockRotations(next.lockRot === true, true);
  }
}

/** Apply a collider edit that kept shape/offset (Rapier defaults fill removed fields). */
function applyColliderInPlace(
  collider: RAPIER.Collider,
  prev: Readonly<Collider3DData>,
  next: Readonly<Collider3DData>,
): void {
  if ((next.sensor === true) !== (prev.sensor === true)) collider.setSensor(next.sensor === true);
  const events = activeEventsOf(next);
  if (events !== activeEventsOf(prev)) collider.setActiveEvents(events);
  const groups = collisionGroupsOf(next);
  if (groups !== collisionGroupsOf(prev)) collider.setCollisionGroups(groups);
  if (next.restitution !== prev.restitution) collider.setRestitution(next.restitution ?? 0);
  if (next.friction !== prev.friction) collider.setFriction(next.friction ?? 0.5);
  if (next.density !== prev.density) collider.setDensity(next.density ?? 1);
}

/** Does a live Rapier joint's reported type correspond to the authored joint type? */
function jointTypeMatches(authored: JointData['type'], reported: RAPIER.JointType): boolean {
  switch (authored) {
    case 'fixed':
      return reported === RAPIER.JointType.Fixed;
    case 'prismatic':
      return reported === RAPIER.JointType.Prismatic;
    case 'spherical':
      // rapier 0.19 builds JointData.spherical as a generic joint and reports it as such.
      return reported === RAPIER.JointType.Spherical || reported === RAPIER.JointType.Generic;
    default:
      return reported === RAPIER.JointType.Revolute;
  }
}

/** Uniform scale keeps every primitive and rotated collider faithful to its visual transform. */
function physicsScale(t: Readonly<TransformData> | undefined): number {
  const scale = t?.scale ?? [1, 1, 1];
  if (
    !scale.every((v) => Number.isFinite(v) && v > 0) ||
    scale[0] !== scale[1] ||
    scale[0] !== scale[2]
  ) {
    throw new Error(
      'collider3d requires positive uniform transform.scale; bake nonuniform or mirrored scale into collision geometry',
    );
  }
  return scale[0];
}

/**
 * Exact pose compare against the Transform the mirror last stored. Rapier holds a sleeping (or
 * undriven kinematic) body's translation/rotation bit-stable, so plain equality is the change
 * signal — no epsilon, which would let real sub-millimetre motion go unmirrored.
 */
function poseMatches(
  prev: Readonly<TransformData> | undefined,
  tr: { x: number; y: number; z: number },
  rot: { x: number; y: number; z: number; w: number },
): boolean {
  if (prev === undefined || prev.rot === undefined) return false;
  const p = prev.pos;
  const r = prev.rot;
  return (
    p[0] === tr.x &&
    p[1] === tr.y &&
    p[2] === tr.z &&
    r[0] === rot.x &&
    r[1] === rot.y &&
    r[2] === rot.z &&
    r[3] === rot.w
  );
}

/** Same idea for the opt-in velocity mirror: a body at rest re-reports the same zeros forever. */
function velocityMatches(
  prev: Readonly<VelocityData> | undefined,
  lv: { x: number; y: number; z: number },
  av: { x: number; y: number; z: number },
): boolean {
  if (prev === undefined) return false;
  const l = prev.linear;
  const a = prev.angular;
  return (
    l[0] === lv.x &&
    l[1] === lv.y &&
    l[2] === lv.z &&
    a[0] === av.x &&
    a[1] === av.y &&
    a[2] === av.z
  );
}

/** Install the Rapier physics system + snapshot provider. Requires initRapier() first. */
export function installRapier(world: World, opts: RapierOptions = {}): RapierHandle {
  const g = opts.gravity ?? [0, -9.81, 0];
  const state: RapierState = {
    world: newRapierWorld(g),
    bodies: new Map(),
    colliders: new Map(),
    colliderOwner: new Map(),
    joints: new Map(),
    lastRigidbody: new Map(),
    lastCollider: new Map(),
    lastTransform: new Map(),
    lastJoint: new Map(),
    forced: new Set(),
    characters: new Map(),
    queue: new RAPIER.EventQueue(true),
    disposed: false,
  };

  const assertLive = (): void => {
    if (state.disposed) throw new Error('rapier handle is disposed');
  };

  const rebuildColliderOwner = (): void => {
    state.colliderOwner.clear();
    for (const [id, handles] of state.colliders) {
      for (const h of handles) state.colliderOwner.set(h, id);
    }
  };

  const createCollider = (
    id: EntityId,
    data: Readonly<Collider3DData>,
    body: RAPIER.RigidBody,
  ): void => {
    const c = state.world.createCollider(
      colliderDesc(data, opts.resolvers, physicsScale(world.get(id, Transform))),
      body,
    );
    state.colliders.set(id, [c.handle]);
    state.colliderOwner.set(c.handle, id);
  };

  const removeColliders = (id: EntityId): void => {
    for (const h of state.colliders.get(id) ?? []) {
      const c = state.world.getCollider(h);
      if (c !== null) state.world.removeCollider(c, true);
      state.colliderOwner.delete(h);
    }
    state.colliders.delete(id);
  };

  const createEntity = (id: EntityId, w: World): void => {
    const t = w.get(id, Transform);
    if (t === undefined) return;
    const collider = w.get(id, Collider3D);
    const rb = w.get(id, Rigidbody);
    const bodyDesc = (
      rb === undefined || rb.body === 'fixed'
        ? RAPIER.RigidBodyDesc.fixed()
        : rb.body === 'kinematicPosition'
          ? RAPIER.RigidBodyDesc.kinematicPositionBased()
          : RAPIER.RigidBodyDesc.dynamic()
    )
      .setTranslation(t.pos[0], t.pos[1], t.pos[2])
      .setRotation({ x: t.rot[0], y: t.rot[1], z: t.rot[2], w: t.rot[3] });
    if (rb?.gravityScale !== undefined) bodyDesc.setGravityScale(rb.gravityScale);
    if (rb?.linearDamping !== undefined) bodyDesc.setLinearDamping(rb.linearDamping);
    if (rb?.angularDamping !== undefined) bodyDesc.setAngularDamping(rb.angularDamping);
    if (rb?.ccd === true) bodyDesc.setCcdEnabled(true);
    const body = state.world.createRigidBody(bodyDesc);
    if (rb?.lockRot === true) body.lockRotations(true, false);
    state.bodies.set(id, body.handle);
    state.lastRigidbody.set(id, rb);
    state.lastCollider.set(id, collider);
    state.lastTransform.set(id, t);
    if (collider !== undefined) createCollider(id, collider, body);
  };

  const removeEntity = (id: EntityId): void => {
    const joint = state.joints.get(id);
    if (joint !== undefined) {
      const j = state.world.impulseJoints.get(joint);
      if (j !== null) state.world.removeImpulseJoint(j, true);
      state.joints.delete(id);
      state.lastJoint.delete(id);
    }
    const handle = state.bodies.get(id);
    if (handle !== undefined) {
      const body = state.world.getRigidBody(handle);
      if (body !== null) state.world.removeRigidBody(body);
      state.bodies.delete(id);
    }
    // Removing the body already freed its colliders; this only clears the maps.
    removeColliders(id);
    state.lastRigidbody.delete(id);
    state.lastCollider.delete(id);
    state.lastTransform.delete(id);
    state.forced.delete(id);
    const controller = state.characters.get(id);
    if (controller !== undefined) state.world.removeCharacterController(controller);
    state.characters.delete(id);
  };

  /** Reconcile one authored entity: edits apply in place where Rapier allows, else rebuild. */
  const reconcileEntity = (id: EntityId, w: World): void => {
    const rb = w.get(id, Rigidbody);
    const collider = w.get(id, Collider3D);
    if (state.bodies.has(id)) {
      const prevRb = state.lastRigidbody.get(id);
      if (rb !== prevRb) {
        if (prevRb === undefined || rb === undefined || rb.body !== prevRb.body) {
          removeEntity(id); // body kind changed (or rigidbody added/removed): rebuild
        } else {
          const body = bodyOf(state, id);
          if (body !== null) applyBodyInPlace(body, prevRb, rb);
          state.lastRigidbody.set(id, rb);
        }
      }
    }
    if (state.bodies.has(id)) {
      const prevCollider = state.lastCollider.get(id);
      const scaleChanged =
        physicsScale(w.get(id, Transform)) !== physicsScale(state.lastTransform.get(id));
      if (collider !== prevCollider || scaleChanged) {
        const body = bodyOf(state, id);
        const handle = state.colliders.get(id)?.[0];
        const existing = handle !== undefined ? state.world.getCollider(handle) : null;
        if (
          prevCollider !== undefined &&
          collider !== undefined &&
          existing !== null &&
          !scaleChanged &&
          geometryKey(collider) === geometryKey(prevCollider)
        ) {
          applyColliderInPlace(existing, prevCollider, collider);
        } else {
          removeColliders(id); // shape/offset changed: rebuild the collider, keep the body
          if (collider !== undefined && body !== null) createCollider(id, collider, body);
        }
        state.lastCollider.set(id, collider);
      }
    }
    if (!state.bodies.has(id)) createEntity(id, w);

    const t = w.get(id, Transform);
    if (t !== state.lastTransform.get(id)) {
      const body = bodyOf(state, id);
      if (t !== undefined && body !== null) {
        const rotation = t.rot ?? [0, 0, 0, 1];
        body.setTranslation({ x: t.pos[0], y: t.pos[1], z: t.pos[2] }, true);
        body.setRotation({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] }, true);
      }
      state.lastTransform.set(id, t);
    }
  };

  const characterOf = (id: EntityId): RAPIER.KinematicCharacterController => {
    let controller = state.characters.get(id);
    if (controller === undefined) {
      controller = state.world.createCharacterController(opts.character?.offset ?? 0.02);
      if (opts.character?.maxSlopeClimbAngle !== undefined) {
        controller.setMaxSlopeClimbAngle(opts.character.maxSlopeClimbAngle);
      }
      if (opts.character?.autostep !== undefined) {
        controller.enableAutostep(
          opts.character.autostep.maxHeight,
          opts.character.autostep.minWidth,
          true,
        );
      }
      if (opts.character?.snapToGround !== undefined) {
        controller.enableSnapToGround(opts.character.snapToGround);
      }
      state.characters.set(id, controller);
    }
    return controller;
  };

  /** Predicate for the spatial queries (undefined when nothing filters). */
  const queryPredicate = (
    filter: QueryFilter | undefined,
  ): ((collider: RAPIER.Collider) => boolean) | undefined => {
    const mask = filter?.mask === undefined ? undefined : filter.mask & 0xffff;
    const excluded = new Set(filter?.exclude ?? []);
    if (mask === undefined && excluded.size === 0) return undefined;
    return (collider) => {
      if (mask !== undefined && ((collider.collisionGroups() >>> 16) & mask) === 0) return false;
      if (excluded.size > 0) {
        const id = state.colliderOwner.get(collider.handle);
        if (id !== undefined && excluded.has(id)) return false;
      }
      return true;
    };
  };

  world.addSystem(
    (w, ctx) => {
      if (state.disposed) return;
      // 1. Reconcile ECS-authored bodies/colliders. Component removal, a body-kind change, or a
      //    shape change rebuild the Rapier object; other edits apply in place; authored
      //    Transform edits teleport the existing body.
      const present = new Set<EntityId>();
      for (const [id] of w.query(Collider3D)) {
        present.add(id);
      }
      for (const [id] of w.query(Rigidbody)) {
        present.add(id);
      }
      for (const id of [...state.bodies.keys()]) {
        if (!present.has(id)) removeEntity(id);
      }
      for (const id of present) reconcileEntity(id, w);

      // 2. Joints: remove stale/changed handles before creating replacements. Removing a body
      //    implicitly removes attached Rapier joints, so map validity must also be checked.
      for (const id of [...state.joints.keys()]) {
        const joint = w.get(id, Joint);
        const handle = state.joints.get(id) as number;
        if (
          joint === undefined ||
          joint !== state.lastJoint.get(id) ||
          !state.world.impulseJoints.contains(handle)
        ) {
          const j = state.world.impulseJoints.get(handle);
          if (j !== null) state.world.removeImpulseJoint(j, true);
          state.joints.delete(id);
          state.lastJoint.delete(id);
        }
      }
      for (const [id, joint] of w.query(Joint)) {
        if (state.joints.has(id)) continue;
        const b1Handle = state.bodies.get(joint.other);
        const b2Handle = state.bodies.get(id);
        if (b1Handle === undefined || b2Handle === undefined) continue;
        const b1 = state.world.getRigidBody(b1Handle);
        const b2 = state.world.getRigidBody(b2Handle);
        if (b1 === null || b2 === null) continue;
        const created = createJoint(state.world, joint, b1, b2);
        if (created !== undefined) {
          state.joints.set(id, created.handle);
          state.lastJoint.set(id, joint);
        }
      }

      // 3. Character controllers: kinematicPosition bodies driven by character + moveIntent
      //    (the SAME components the kernel's flat-ground controller consumes).
      for (const [id, character, intent] of w.query(Character, MoveIntent)) {
        const bodyHandle = state.bodies.get(id);
        const colliderHandles = state.colliders.get(id);
        if (bodyHandle === undefined || colliderHandles?.[0] === undefined) continue;
        const body = state.world.getRigidBody(bodyHandle);
        const collider = state.world.getCollider(colliderHandles[0]);
        if (body === null || collider === null || !body.isKinematic()) continue;
        stepCharacter(w, ctx.dt, id, character, intent, body, collider, characterOf(id), state);
      }

      // 4. Forces (continuous while present; reset once the component goes away), impulses +
      //    velocity sets (one-shot, consumed).
      const forcedNow = new Set<EntityId>();
      for (const [id, force] of w.query(Force)) {
        const body = bodyOf(state, id);
        if (body === null) continue;
        body.resetForces(true);
        body.resetTorques(true);
        if (force.linear !== undefined) {
          body.addForce({ x: force.linear[0], y: force.linear[1], z: force.linear[2] }, true);
        }
        if (force.torque !== undefined) {
          body.addTorque({ x: force.torque[0], y: force.torque[1], z: force.torque[2] }, true);
        }
        forcedNow.add(id);
      }
      for (const id of state.forced) {
        if (forcedNow.has(id)) continue;
        const body = bodyOf(state, id);
        if (body === null) continue;
        body.resetForces(true);
        body.resetTorques(true);
      }
      state.forced = forcedNow;
      for (const [id, imp] of w.query(Impulse)) {
        const body = bodyOf(state, id);
        if (body !== null) {
          if (imp.v !== undefined) {
            body.applyImpulse({ x: imp.v[0], y: imp.v[1], z: imp.v[2] }, true);
          }
          if (imp.torque !== undefined) {
            body.applyTorqueImpulse({ x: imp.torque[0], y: imp.torque[1], z: imp.torque[2] }, true);
          }
        }
        w.remove(id, Impulse);
      }
      for (const [id, vel] of w.query(SetVelocity)) {
        const body = bodyOf(state, id);
        if (body !== null) {
          if (vel.linear !== undefined) {
            body.setLinvel({ x: vel.linear[0], y: vel.linear[1], z: vel.linear[2] }, true);
          }
          if (vel.angular !== undefined) {
            body.setAngvel({ x: vel.angular[0], y: vel.angular[1], z: vel.angular[2] }, true);
          }
        }
        w.remove(id, SetVelocity);
      }

      // 5. Step, collecting collision events.
      state.world.step(state.queue);

      // 6. Mirror moving-body poses into the ECS (+ the opt-in velocity component). The freshly
      //    stored Transform becomes the baseline so the next tick does not re-teleport.
      //    Only a body whose pose actually moved is written: `patch`/`set` always mark the
      //    component changed and `takeDelta` clones every dirty component without comparing, so
      //    an unconditional mirror streams a settled scene (sleeping crates, an undriven
      //    kinematic body) forever. A sleeping body's translation is bit-stable, so the compare
      //    catches it; waking up moves the pose and mirrors again on that very tick.
      for (const [id, handle] of state.bodies) {
        const body = state.world.getRigidBody(handle);
        if (body === null || body.isFixed()) continue;
        const tr = body.translation();
        const rot = body.rotation();
        if (!poseMatches(state.lastTransform.get(id), tr, rot)) {
          w.patch(id, Transform, {
            pos: [tr.x, tr.y, tr.z],
            rot: [rot.x, rot.y, rot.z, rot.w],
          });
          state.lastTransform.set(id, w.get(id, Transform));
        }
        if (w.has(id, Velocity)) {
          const lv = body.linvel();
          const av = body.angvel();
          if (!velocityMatches(w.get(id, Velocity), lv, av)) {
            w.set(id, Velocity, {
              linear: [lv.x, lv.y, lv.z],
              angular: [av.x, av.y, av.z],
            });
          }
        }
      }

      // 7. Emit collision events (same 'collision' name the kinematics layer uses). Solid
      //    contacts carry the manifold normal (pointing from `a` toward `b`) and a contact point.
      state.queue.drainCollisionEvents((h1, h2, started) => {
        const a = state.colliderOwner.get(h1);
        const b = state.colliderOwner.get(h2);
        if (a === undefined || b === undefined) return;
        const c1 = state.world.getCollider(h1);
        const c2 = state.world.getCollider(h2);
        const sensor = c1?.isSensor() === true || c2?.isSensor() === true;
        const payload: Record<string, JsonValue> = { a, b, sensor };
        if (started && !sensor && c1 !== null && c2 !== null) {
          const contact = contactOf(state.world, c1, c2);
          if (contact !== undefined) {
            payload.normal = contact.normal;
            if (contact.point !== undefined) payload.point = contact.point;
          }
        }
        w.emit(started ? 'collision' : 'collisionEnd', payload);
      });
    },
    { phase: 'physics', name: SYSTEM_NAME },
  );

  // Hybrid snapshot: opaque blob + the id->handle maps (no component-data leakage).
  world.registerSnapshotProvider(
    PROVIDER_NAME,
    (): JsonValue => {
      if (state.disposed) return null;
      return {
        version: RAPIER_SNAPSHOT_VERSION,
        blob: bytesToBase64(state.world.takeSnapshot()),
        bodies: Object.fromEntries(state.bodies),
        colliders: Object.fromEntries(
          [...state.colliders.entries()].map(([id, hs]) => [id, [...hs]]),
        ),
        joints: Object.fromEntries(state.joints),
      };
    },
    (v: JsonValue): void => {
      if (state.disposed) return;
      const snap = v as {
        version?: string;
        blob?: string;
        bodies?: Record<string, number>;
        colliders?: Record<string, number[]>;
        joints?: Record<string, number>;
      } | null;
      if (snap === null || typeof snap !== 'object' || typeof snap.blob !== 'string') return;
      if (snap.version !== RAPIER_SNAPSHOT_VERSION) {
        throw new Error(
          `Rapier snapshot version ${String(snap.version)} is incompatible with ${RAPIER_SNAPSHOT_VERSION}`,
        );
      }
      state.world.free();
      state.world = RAPIER.World.restoreSnapshot(base64ToBytes(snap.blob));
      state.bodies = new Map(Object.entries(snap.bodies ?? {}));
      state.colliders = new Map(Object.entries(snap.colliders ?? {}));
      rebuildColliderOwner();
      state.characters.clear();
      state.forced.clear();
      state.queue.clear();
      state.joints = new Map(
        Object.entries(snap.joints ?? {}).filter(([, handle]) =>
          state.world.impulseJoints.contains(handle),
        ),
      );

      // Recover handle mappings for older/incomplete plugin maps without creating duplicates:
      // match by ordered body pair AND joint type, in Rapier's creation order, so two joints on
      // the same pair restore deterministically.
      const claimed = new Set(state.joints.values());
      const candidates = state.world.impulseJoints.getAll();
      for (const [id, joint] of world.query(Joint)) {
        if (state.joints.has(id)) continue;
        const body = state.bodies.get(id);
        const other = state.bodies.get(joint.other);
        if (body === undefined || other === undefined) continue;
        const match = candidates.find(
          (candidate) =>
            !claimed.has(candidate.handle) &&
            candidate.body1().handle === other &&
            candidate.body2().handle === body &&
            jointTypeMatches(joint.type, candidate.type()),
        );
        if (match !== undefined) {
          state.joints.set(id, match.handle);
          claimed.add(match.handle);
        }
      }

      // The restored objects mirror the current component data by construction.
      state.lastRigidbody.clear();
      state.lastCollider.clear();
      state.lastTransform.clear();
      for (const id of state.bodies.keys()) {
        state.lastRigidbody.set(id, world.get(id, Rigidbody));
        state.lastCollider.set(id, world.get(id, Collider3D));
        state.lastTransform.set(id, world.get(id, Transform));
      }
      state.lastJoint.clear();
      for (const [id, joint] of world.query(Joint)) {
        if (state.joints.has(id)) state.lastJoint.set(id, joint);
      }
    },
  );

  return {
    get world() {
      return state.world;
    },
    raycast: (origin, dir, maxDist, opts) => {
      assertLive();
      const options: RaycastOptions = typeof opts === 'boolean' ? { solid: opts } : (opts ?? {});
      if (!Number.isFinite(maxDist) || maxDist < 0) {
        throw new RangeError('raycast maxDist must be finite and nonnegative');
      }
      const length = Math.hypot(dir[0], dir[1], dir[2]);
      if (!Number.isFinite(length) || length === 0) {
        throw new RangeError('raycast direction must be finite and nonzero');
      }
      const ray = new RAPIER.Ray(
        { x: origin[0], y: origin[1], z: origin[2] },
        { x: dir[0] / length, y: dir[1] / length, z: dir[2] / length },
      );
      const hit = state.world.castRayAndGetNormal(
        ray,
        maxDist,
        options.solid ?? true,
        undefined,
        undefined,
        undefined,
        undefined,
        queryPredicate(options),
      );
      if (hit === null) return null;
      const id = state.colliderOwner.get(hit.collider.handle);
      if (id === undefined) return null;
      const p = ray.pointAt(hit.timeOfImpact);
      return {
        id,
        distance: hit.timeOfImpact,
        point: [p.x, p.y, p.z],
        normal: [hit.normal.x, hit.normal.y, hit.normal.z],
      };
    },
    overlapSphere: (center, radius, opts) => {
      assertLive();
      if (!Number.isFinite(radius) || radius <= 0) {
        throw new RangeError('overlap radius must be finite and greater than 0');
      }
      const out: EntityId[] = [];
      const shape = new RAPIER.Ball(radius);
      state.world.intersectionsWithShape(
        { x: center[0], y: center[1], z: center[2] },
        { x: 0, y: 0, z: 0, w: 1 },
        shape,
        (collider) => {
          const id = state.colliderOwner.get(collider.handle);
          if (id !== undefined) out.push(id);
          return true;
        },
        undefined,
        undefined,
        undefined,
        undefined,
        queryPredicate(opts),
      );
      return out;
    },
    velocityOf: (id) => {
      assertLive();
      const body = bodyOf(state, id);
      if (body === null) return undefined;
      const lv = body.linvel();
      const av = body.angvel();
      return { linear: [lv.x, lv.y, lv.z], angular: [av.x, av.y, av.z] };
    },
    dispose: () => {
      if (state.disposed) return;
      state.disposed = true;
      world.removeSystem(SYSTEM_NAME);
      world.unregisterSnapshotProvider(PROVIDER_NAME);
      state.characters.clear();
      state.queue.free();
      state.world.free();
      state.bodies.clear();
      state.colliders.clear();
      state.colliderOwner.clear();
      state.joints.clear();
      state.lastRigidbody.clear();
      state.lastCollider.clear();
      state.lastTransform.clear();
      state.lastJoint.clear();
      state.forced.clear();
    },
  };
}

function bodyOf(state: RapierState, id: EntityId): RAPIER.RigidBody | null {
  const handle = state.bodies.get(id);
  return handle !== undefined ? state.world.getRigidBody(handle) : null;
}

/**
 * First contact manifold between two colliders: world-space normal pointing from `c1` toward
 * `c2` and (when a contact exists) a world-space contact point.
 */
function contactOf(
  world: RAPIER.World,
  c1: RAPIER.Collider,
  c2: RAPIER.Collider,
): { normal: Vec3; point?: Vec3 } | undefined {
  let out: { normal: Vec3; point?: Vec3 } | undefined;
  world.contactPair(c1, c2, (manifold, flipped) => {
    if (out !== undefined) return;
    const n = manifold.normal();
    const sign = flipped ? -1 : 1;
    const result: { normal: Vec3; point?: Vec3 } = {
      normal: [n.x * sign, n.y * sign, n.z * sign],
    };
    if (manifold.numSolverContacts() > 0) {
      const p = manifold.solverContactPoint(0);
      result.point = [p.x, p.y, p.z];
    } else if (manifold.numContacts() > 0) {
      // Local point in the frame of the manifold's first collider (c2 when flipped).
      const local = manifold.localContactPoint1(0);
      if (local !== null) {
        const first = flipped ? c2 : c1;
        const tr = first.translation();
        const rot = first.rotation();
        const r = quatRotateVec3([rot.x, rot.y, rot.z, rot.w], [local.x, local.y, local.z]);
        result.point = [r[0] + tr.x, r[1] + tr.y, r[2] + tr.z];
      }
    }
    out = result;
  });
  return out;
}

function createJoint(
  world: RAPIER.World,
  joint: JointData,
  b1: RAPIER.RigidBody,
  b2: RAPIER.RigidBody,
): RAPIER.ImpulseJoint | undefined {
  const a1 = { x: joint.anchor1[0], y: joint.anchor1[1], z: joint.anchor1[2] };
  const a2 = { x: joint.anchor2[0], y: joint.anchor2[1], z: joint.anchor2[2] };
  const axis =
    joint.axis !== undefined
      ? { x: joint.axis[0], y: joint.axis[1], z: joint.axis[2] }
      : { x: 0, y: 1, z: 0 };
  let params: RAPIER.JointData;
  switch (joint.type) {
    case 'fixed':
      params = RAPIER.JointData.fixed(a1, { x: 0, y: 0, z: 0, w: 1 }, a2, {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
      });
      break;
    case 'spherical':
      params = RAPIER.JointData.spherical(a1, a2);
      break;
    case 'prismatic':
      params = RAPIER.JointData.prismatic(a1, a2, axis);
      break;
    default:
      params = RAPIER.JointData.revolute(a1, a2, axis);
      break;
  }
  const created = world.createImpulseJoint(params, b1, b2, true);
  if (joint.type === 'revolute' || joint.type === 'prismatic') {
    const unit = created as RAPIER.UnitImpulseJoint;
    if (joint.limits !== undefined) unit.setLimits(joint.limits[0], joint.limits[1]);
    if (joint.motor !== undefined) {
      (
        unit as RAPIER.UnitImpulseJoint & {
          configureMotorVelocity(v: number, f: number): void;
        }
      ).configureMotorVelocity(joint.motor.targetVel, joint.motor.maxForce);
    }
  }
  return created;
}

function stepCharacter(
  w: World,
  dt: number,
  id: EntityId,
  character: Readonly<CharacterData>,
  intent: Readonly<MoveIntentData>,
  body: RAPIER.RigidBody,
  collider: RAPIER.Collider,
  controller: RAPIER.KinematicCharacterController,
  state: RapierState,
): void {
  // Same vy/gravity math as the kernel's flat-ground controller (see kernel/src/character.ts).
  let vy = character.vy;
  if (intent.jump && character.grounded) vy = character.jumpSpeed;
  vy -= character.gravity * dt;
  const len = Math.sqrt(intent.dir[0] * intent.dir[0] + intent.dir[1] * intent.dir[1]) || 1;
  const divisor = len < 1 ? 1 : len;
  const desired = {
    x: (intent.dir[0] / divisor) * character.speed * dt,
    y: vy * dt,
    z: (intent.dir[1] / divisor) * character.speed * dt,
  };
  controller.computeColliderMovement(collider, desired);
  const movement = controller.computedMovement();
  const grounded = controller.computedGrounded();
  const pos = body.translation();
  body.setNextKinematicTranslation({
    x: pos.x + movement.x,
    y: pos.y + movement.y,
    z: pos.z + movement.z,
  });
  w.patch(id, Character, { vy: grounded && vy < 0 ? 0 : vy, grounded });
  void state;
}

/** The script-sandbox extension namespace: pass as `extensions: { physics: rapierScriptApi(h) }`. */
export function rapierScriptApi(handle: RapierHandle): object {
  return {
    raycast: (
      origin: Vec3,
      dir: Vec3,
      maxDist: number,
      opts?: boolean | RaycastOptions,
    ): RayHit3D | null => handle.raycast(origin, dir, maxDist, opts),
    overlapSphere: (center: Vec3, radius: number, opts?: QueryFilter): EntityId[] =>
      handle.overlapSphere(center, radius, opts),
    velocityOf: (id: EntityId): { linear: Vec3; angular: Vec3 } | undefined =>
      handle.velocityOf(id),
  };
}

/**
 * Install physics per the scene's `physics` block (engine "rapier"). Returns the handle, or
 * undefined when the scene doesn't ask for rapier. Requires initRapier() first.
 */
export function installScenePhysics(
  world: World,
  manifest: SceneManifest,
  resolvers?: ShapeResolvers,
): RapierHandle | undefined {
  if (manifest.physics?.engine !== 'rapier') return undefined;
  return installRapier(world, {
    ...(manifest.physics.gravity !== undefined ? { gravity: manifest.physics.gravity } : {}),
    ...(resolvers !== undefined ? { resolvers } : {}),
  });
}
