import type { JsonObject } from './json';
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
}

/** Named-node bindings for a GLB-backed wheeled vehicle. */
export interface VehicleVisualSpec extends JsonObject {
  wheelNodes: string[];
  frontWheelNodes: string[];
  /** Legacy explicit steering binding. Prefer interior.bindings for new models. */
  steeringWheelNode?: string;
  paintMaterial: string;
  interior?: VehicleInteriorSpec;
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
