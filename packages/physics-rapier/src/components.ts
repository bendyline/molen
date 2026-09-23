import { type ComponentType, defineComponent } from '@bendyline/molen-kernel';
import type { JsonObject, Vec3 } from '@bendyline/molen-schema';

// The 3D physics vocabulary (owner: physics-rapier). Split body/collider model matching
// Rapier's own: `collider3d` is shape + material + filters (a static collider needs no body);
// `rigidbody` is dynamics. The 2.5D kinematics `collider` component is a SEPARATE,
// cross-platform-deterministic contract — two names, two honest determinism classes.

export type Shape3D =
  | { type: 'ball'; radius: number }
  | { type: 'cuboid'; hx: number; hy: number; hz: number }
  | { type: 'capsule'; halfHeight: number; radius: number }
  | { type: 'convexHull'; points: number[] }
  | { type: 'trimesh'; vertices: number[]; indices: number[] }
  | { type: 'asset'; assetId: string; collision?: 'hull' | 'trimesh'; index?: number }
  | { type: 'heightfield'; ref: string };

export interface Collider3DData extends JsonObject {
  shape: Shape3D;
  /** Local offset from the entity transform. */
  offset?: Vec3;
  rotOffset?: [number, number, number, number];
  layer?: number;
  mask?: number;
  /** Sensor colliders detect overlaps without a physical response. */
  sensor?: boolean;
  /** Opt into collision start/end events for this collider. */
  events?: boolean;
  restitution?: number;
  friction?: number;
  density?: number;
}

export interface RigidBodyData extends JsonObject {
  body: 'dynamic' | 'fixed' | 'kinematicPosition';
  gravityScale?: number;
  linearDamping?: number;
  angularDamping?: number;
  /** Continuous collision detection for fast movers. */
  ccd?: boolean;
  /** Lock all rotation (upright characters, HUD-ish bodies). */
  lockRot?: boolean;
}

export interface JointData extends JsonObject {
  type: 'fixed' | 'revolute' | 'spherical' | 'prismatic';
  /** Entity id of the OTHER body (this entity is body 2). */
  other: string;
  anchor1: Vec3;
  anchor2: Vec3;
  /** revolute/prismatic axis. */
  axis?: Vec3;
  limits?: [number, number];
  motor?: { targetVel: number; maxForce: number };
}

/** Continuous force/torque applied every tick while the component is present. */
export interface ForceData extends JsonObject {
  linear?: Vec3;
  torque?: Vec3;
}

/** One-shot impulse; consumed the tick it is applied. */
export interface ImpulseData extends JsonObject {
  v?: Vec3;
  torque?: Vec3;
}

/** One-shot velocity set; consumed the tick it is applied. */
export interface SetVelocityData extends JsonObject {
  linear?: Vec3;
  angular?: Vec3;
}

/** Opt-in per-tick velocity mirror (presence = subscription; plugin-written). */
export interface VelocityData extends JsonObject {
  linear: Vec3;
  angular: Vec3;
}

export const Collider3D: ComponentType<Collider3DData> =
  defineComponent<Collider3DData>('collider3d');
export const Rigidbody: ComponentType<RigidBodyData> = defineComponent<RigidBodyData>('rigidbody');
export const Joint: ComponentType<JointData> = defineComponent<JointData>('joint');
export const Force: ComponentType<ForceData> = defineComponent<ForceData>('force');
export const Impulse: ComponentType<ImpulseData> = defineComponent<ImpulseData>('impulse');
export const SetVelocity: ComponentType<SetVelocityData> =
  defineComponent<SetVelocityData>('setVelocity');
export const Velocity: ComponentType<VelocityData> = defineComponent<VelocityData>('velocity');
