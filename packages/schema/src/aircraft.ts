import type { JsonObject } from './json';
import type { VehicleInteriorSpec } from './vehicle-interior';

/** Stable external entity/type id for an aircraft. */
export type AircraftKind = string;
export type FlightModel = 'airplane' | 'helicopter';

export interface AircraftEngineSpec extends JsonObject {
  position: [number, number, number];
  thrustAxis: [number, number, number];
  power: number;
  idleRpm: number;
  spoolRate: number;
  rotorAngularSpeed: number;
  /** Optional per-engine propeller tuning; defaults to the airplane's values. */
  propellerEfficiency?: number;
  maxThrust?: number;
  minPropellerSpeed?: number;
}

/** A named installation in an airplane's engine bank. Positions use aircraft-local meters. */
export interface AircraftNamedEngineSpec extends AircraftEngineSpec {
  id: string;
}

export interface AircraftEngineInputData extends JsonObject {
  /** Absolute throttle override, 0–1. Omitted inherits the common throttle. */
  power?: number;
  /** Individual engine switch. The common engine switch remains a master cutoff. */
  enabled?: boolean;
}

export interface AircraftEngineStateData extends JsonObject {
  rpm: number;
  rotorAngle: number;
  /** Latched failure; pilot throttle/switch changes cannot clear it. */
  failed: boolean;
  /** Current propeller thrust in newtons (zero for the helicopter's shaft engine). */
  thrust: number;
}

export interface AirplanePhysicsSpec extends JsonObject {
  wingPosition: [number, number, number];
  wingArea: number;
  controlAuthoritySpeed: number;
  maxControlAuthority: number;
  pitchAuthority: number;
  pitchResponse: number;
  stallPitchRate: number;
  rollAuthority: number;
  rollResponse: number;
  rudderAuthority: number;
  groundSteerSpeed: number;
  coordinatedTurnMinSpeed: number;
  groundLevelRate: number;
  maxPitch: number;
  maxGroundPitch: number;
  maxRoll: number;
  camberAngle: number;
  flapLift: number;
  postStallFlapEffect: number;
  stallAngle: number;
  /** Radians beyond stallAngle over which flow separates smoothly; default 0.12. */
  stallTransitionAngle?: number;
  /** Sideslip restoring yaw rate per radian at reference airspeed (1/s); default 1. */
  yawStability?: number;
  /** Yaw moment of inertia in kg m²; defaults to mass * (span² + length²) / 12. */
  yawInertia?: number;
  /** Damping of thrust-induced yaw rate in 1/s at reference airspeed; default 1.2. */
  thrustYawDamping?: number;
  /** Legacy tuning reference in m/s; stall detection uses angle of attack. */
  stallSpeed: number;
  liftSlope: number;
  postStallLift: number;
  postStallDecay: number;
  profileDrag: number;
  inducedDrag: number;
  gearDrag: number;
  flapDrag: number;
  /** Broadside separated-flow drag coefficient, blended by separation and sin(alpha)^2. */
  stallDrag: number;
  propellerEfficiency: number;
  maxThrust: number;
  minPropellerSpeed: number;
  lateralDamping: number;
  brakeDeceleration: number;
  rollingDeceleration: number;
  groundTrackRate: number;
}

export interface HelicopterPhysicsSpec extends JsonObject {
  rotorPosition: [number, number, number];
  rotorRadius: number;
  cyclicTilt: number;
  cyclicResponse: number;
  cyclicDamping: number;
  groundLevelRate: number;
  maxTilt: number;
  yawRate: number;
  liftMultiplier: number;
  groundEffect: number;
  translationalLift: number;
  translationalLiftSpeed: number;
  verticalDrag: number;
  horizontalDrag: number;
  quadraticDrag: number;
  groundDeceleration: number;
}

export interface AircraftVisualBinding extends JsonObject {
  node: string;
  axis: 'x' | 'y' | 'z';
  multiplier: number;
}

export interface AircraftRotorBinding extends AircraftVisualBinding {
  /** Engine id for an independent propeller. Omitted follows the first engine. */
  engine?: string;
}

export interface AircraftVisualSpec extends JsonObject {
  rotors: AircraftRotorBinding[];
  gearNodes: string[];
  flaps: AircraftVisualBinding[];
  ailerons: AircraftVisualBinding[];
  /** Legacy explicit control binding. Prefer interior.bindings for new models. */
  controlStick?: { node: string; pitchAxis: 'x' | 'y' | 'z'; rollAxis: 'x' | 'y' | 'z' };
  collective?: AircraftVisualBinding;
  /** Legacy metadata; gauge calibration is owned by interior.bindings. */
  airspeedGaugeMax?: number;
  interior?: VehicleInteriorSpec;
}

/** Complete data-driven tuning consumed by the generic aircraft solver and client. */
export interface AircraftSpec extends JsonObject {
  label: string;
  model: FlightModel;
  mass: number;
  span: number;
  length: number;
  height: number;
  centerOfMass: [number, number, number];
  pilotEye: [number, number, number];
  /** Single-engine form, identified as "main". Supply this or engines, never both. */
  engine?: AircraftEngineSpec;
  /** Named independent propeller engines. Currently supported by the airplane model. */
  engines?: AircraftNamedEngineSpec[];
  airplane?: AirplanePhysicsSpec;
  helicopter?: HelicopterPhysicsSpec;
  hardLandingSpeed: number;
  hardLandingRoll: number;
  hardLandingPitch: number;
  maxSupportStep: number;
  collisionProbes: [number, number, number][];
  visual: AircraftVisualSpec;
}

export interface AircraftData extends JsonObject {
  /** Stable external entity/type id. */
  kind: AircraftKind;
  spec: AircraftSpec;
}
export interface AircraftInputData extends JsonObject {
  /** Absolute engine throttle (airplane) or collective (helicopter), retained when keys release. */
  power: number;
  pitch: number;
  roll: number;
  yaw: number;
  brake: boolean;
  engine: boolean;
  /** Optional per-engine switch/throttle overrides, keyed by engine id. */
  engines?: Record<string, AircraftEngineInputData>;
  gear: boolean;
  flaps: boolean;
}
export interface AircraftStateData extends JsonObject {
  velocity: [number, number, number];
  yaw: number;
  pitch: number;
  roll: number;
  pitchRate: number;
  rollRate: number;
  /** Additional yaw rate caused by engine thrust moments, rad/s about local +Y. */
  thrustYawRate?: number;
  /** Per-engine state, initialized by the solver and authoritative once present. */
  engines?: Record<string, AircraftEngineStateData>;
  /** Maximum engine RPM, retained for HUDs and safe boarding/exit checks. */
  rpm: number;
  /** First engine's rotor phase; independent visuals bind to engines by id. */
  rotorAngle: number;
  airspeed: number;
  altitudeAGL: number;
  verticalSpeed: number;
  angleOfAttack: number;
  stalled: boolean;
  grounded: boolean;
  crashed: boolean;
  waitingForTerrain: boolean;
}
