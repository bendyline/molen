import type { JsonObject } from './json';
import type { ModelSignalSpec } from './model-signals';
import type { VehicleInteriorSpec } from './vehicle-interior';

/** Stable external entity/type id for a wheeled vehicle. */
export type VehicleKind = string;

/** Data-driven tuning consumed by the generic wheeled-vehicle solver. */
export interface VehicleSpec extends JsonObject {
  label: string;
  width: number;
  length: number;
  height: number;
  centerOfMass: [number, number, number];
  wheelbase: number;
  wheelTrack: number;
  wheelRadius: number;
  mass: number;
  engineForce: number;
  maxSpeed: number;
  reverseSpeed: number;
  brakeDeceleration: number;
  maxSteer: number;
  /** Peak tire friction on dry pavement as an acceleration in m/s² (grip / 9.81 is the friction coefficient). */
  grip: number;
  driverEye: [number, number, number];
  steeringRate: number;
  steeringFadeSpeed: number;
  rollingResistance: number;
  aerodynamicResistance: number;
  terrainAlignRate: number;
  supportTolerance: number;
  maxStepHeight: number;
  maxSlope: number;
  /** Driven wheels; default front. */
  drive?: 'front' | 'rear' | 'all';
  /** Tire cornering stiffness: side force per unit load per radian of slip before it saturates; default 18. */
  corneringStiffness?: number;
  /** Share of braking on the front wheels; default 0.65. */
  brakeBias?: number;
  /** Yaw moment of inertia in kg m²; defaults to mass * (length² + width²) / 12. */
  yawInertia?: number;
  /** Body roll in radians per g of cornering; default 0.05. */
  rollStiffness?: number;
  /** Body pitch in radians per g of braking or acceleration; default 0.03. Weight shifts between the axles through this pitch; 0 keeps the axle loads fixed. */
  pitchStiffness?: number;
  /** Suspension natural frequency in Hz; default 1.5. */
  suspensionFrequency?: number;
  /** Suspension damping ratio; default 0.5. */
  suspensionDamping?: number;
}

/** Named-node bindings for a GLB-backed wheeled vehicle. */
export interface VehicleVisualSpec extends JsonObject {
  wheelNodes: string[];
  frontWheelNodes: string[];
  /** Legacy explicit steering binding. Prefer interior.bindings for new models. */
  steeringWheelNode?: string;
  paintMaterial: string;
  interior?: VehicleInteriorSpec;
  /** Exterior moving parts posed from the same signals as the interior. */
  animation?: ModelSignalSpec;
}

/** Complete external configuration consumed by the generic vehicle solver and client. */
export interface VehicleData extends JsonObject {
  kind: VehicleKind;
  color: string;
  spec: VehicleSpec;
  visual: VehicleVisualSpec;
}

/** Serializable spawn record, independent of terrain tile identity and render resources. */
export interface VehiclePlacement {
  id: string;
  /** External entity/type id, for example `molen.entities.vehicle.sedan`. */
  kind: VehicleKind;
  color: string;
  /** Resolved external physics/dimension data used by terrain-owned low-detail rendering. */
  spec: VehicleSpec;
  position: [number, number, number];
  yaw: number;
  pitch?: number;
  roll?: number;
}
