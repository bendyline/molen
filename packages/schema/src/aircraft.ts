import type { JsonObject } from './json';
import type { ModelSignalSpec } from './model-signals';
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
  /** Turning direction seen from the cockpit; default clockwise (the nose swings left). */
  propellerRotation?: 'clockwise' | 'counterclockwise';
  /** Propeller polar moment of inertia in kg m², for gyroscopic precession; default 0. */
  propellerInertia?: number;
  /** Rotate this engine's thrust from +Z toward +Y with the common vector lever. */
  vectored?: boolean;
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
  /** Reference equivalent airspeed in m/s for the control and stability rates below. */
  controlAuthoritySpeed: number;
  /** Cap on control-surface power relative to the reference speed. */
  maxControlAuthority: number;
  /** Angle of attack in radians that full elevator adds to the trim angle. */
  pitchAuthority: number;
  /** Elevator travel per second, in full deflections. */
  pitchResponse: number;
  /** Nose-down pitch rate in rad/s at full flow separation (the stall break). */
  stallPitchRate: number;
  /** Roll rate in rad/s at full aileron and reference speed; grows with speed to the cap. */
  rollAuthority: number;
  /** Roll damping in 1/s at reference speed; grows with speed. */
  rollResponse: number;
  /** Yaw acceleration in rad/s² at full rudder and reference speed; propwash keeps some at rest. */
  rudderAuthority: number;
  groundSteerSpeed: number;
  groundLevelRate: number;
  maxGroundPitch: number;
  camberAngle: number;
  flapLift: number;
  postStallFlapEffect: number;
  stallAngle: number;
  /** Radians beyond stallAngle over which flow separates smoothly; default 0.12. */
  stallTransitionAngle?: number;
  /** Short-period natural frequency in rad/s at reference speed; default 3.5. */
  pitchFrequency?: number;
  /** Short-period damping ratio; default 0.7. */
  pitchDamping?: number;
  /** Positive load-factor limit in g that full back stick will pull; default 6. */
  maxLoadFactor?: number;
  /** Negative load-factor limit in g that full forward stick will push; default -3. */
  minLoadFactor?: number;
  /** Rate in 1/s at which trim follows the angle of attack that holds the flight path; default 1. */
  autoTrim?: number;
  /** Weathercock stiffness: yaw acceleration in rad/s² per radian of sideslip at reference speed; default 4. */
  directionalStability?: number;
  /** Yaw damping in 1/s at reference speed; default 1.2. */
  yawDamping?: number;
  /** Roll acceleration in rad/s² per radian of sideslip at reference speed; default 3. */
  dihedralEffect?: number;
  /** Roll moment of inertia in kg m²; defaults to mass * (0.14 span)². */
  rollInertia?: number;
  /** Pitch moment of inertia in kg m²; defaults to mass * (0.18 length)². */
  pitchInertia?: number;
  /** Yaw moment of inertia in kg m²; defaults to mass * (span² + length²) / 12. */
  yawInertia?: number;
  /** Scale 0–1 of propeller torque, P-factor, slipstream and gyroscopic effects; default 0. */
  propellerEffects?: number;
  /** Legacy tuning reference in m/s; stall detection uses angle of attack. */
  stallSpeed: number;
  liftSlope: number;
  postStallLift: number;
  postStallDecay: number;
  profileDrag: number;
  inducedDrag: number;
  /** Drag coefficient of the landing gear fully down; scales with the gear position. */
  gearDrag: number;
  /** Drag coefficient of the flaps fully down; scales with the flap position. */
  flapDrag: number;
  /**
   * Seconds for a full landing-gear cycle, doors included, either way; default 0 (instant). The
   * gear holds still while the wheels carry weight, and only a locked-down gear can land.
   */
  gearTransitTime?: number;
  /** Fixed undercarriage stays down even if the pilot selects gear up. Default false. */
  fixedGear?: boolean;
  /** Seconds for the flaps to travel fully up to fully down; default 0 (instant). */
  flapTransitTime?: number;
  /** Broadside separated-flow drag coefficient, blended by separation and sin(alpha)^2. */
  stallDrag: number;
  propellerEfficiency: number;
  maxThrust: number;
  minPropellerSpeed: number;
  lateralDamping: number;
  brakeDeceleration: number;
  rollingDeceleration: number;
  /** Tire side grip: lateral deceleration in m/s² and yaw grip in 1/s with full weight on the wheels. */
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
  /** Nodes hidden while the gear is fully up. */
  gearNodes: string[];
  /** Turn by `multiplier` radians at full flap travel, in proportion to the flap position. */
  flaps: AircraftVisualBinding[];
  ailerons: AircraftVisualBinding[];
  /** Legacy explicit control binding. Prefer interior.bindings for new models. */
  controlStick?: { node: string; pitchAxis: 'x' | 'y' | 'z'; rollAxis: 'x' | 'y' | 'z' };
  collective?: AircraftVisualBinding;
  /** Legacy metadata; gauge calibration is owned by interior.bindings. */
  airspeedGaugeMax?: number;
  interior?: VehicleInteriorSpec;
  /**
   * Exterior moving parts posed from the same signals as the interior: landing-gear legs and
   * doors sequenced by keyframes over the gear position, flaps, control surfaces.
   */
  animation?: ModelSignalSpec;
}

/** Complete data-driven tuning consumed by the generic aircraft solver and client. */
export interface AircraftSpec extends JsonObject {
  label: string;
  /** Name-free display label such as 'Light helicopter', for hosts that must not show the type name. */
  genericLabel?: string;
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
  /** Assisted powered-lift controls for tiltrotors and vectored jets, blended into wing flight. */
  poweredLift?: {
    /** Seconds to travel from forward thrust to vertical thrust (90 degrees). */
    transitTime: number;
    /** Hover control fades to zero at this airspeed in m/s. */
    controlFadeSpeed: number;
    /** Body angular accelerations at full hover stick/pedal, rad/s². */
    pitchAuthority: number;
    rollAuthority: number;
    yawAuthority: number;
    /** Angular rate damping in 1/s. Requires running engine thrust. */
    damping: number;
  };
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
  /** Powered-lift lever: 0 forward, 1 vertical. Omitted selects forward thrust. */
  thrustVector?: number;
}
export interface AircraftStateData extends JsonObject {
  velocity: [number, number, number];
  yaw: number;
  pitch: number;
  roll: number;
  /** Body pitch rate, nose up, rad/s. */
  pitchRate: number;
  /** Body roll rate, right wing down, rad/s. */
  rollRate: number;
  /** Body yaw rate about local +Y (nose left), rad/s. Airplanes only. */
  yawRate?: number;
  /** Elevator position -1..1 after its travel limit. Airplanes only. */
  elevator?: number;
  /**
   * Landing-gear position: 0 up and locked, 1 down and locked, between them in transit.
   * Airplanes only; the solver starts it at the commanded position.
   */
  gearPosition?: number;
  /** Flap position as a fraction of full travel, 0..1. Airplanes only; starts as commanded. */
  flapPosition?: number;
  /** Actual powered-lift lever position, 0 forward to 1 vertical, after actuator travel. */
  thrustVectorPosition?: number;
  /** Trimmed angle of attack in radians that the airframe flies with the stick centered. */
  pitchTrim?: number;
  /** Sideslip angle in radians, positive with the relative wind from the left. */
  sideslip?: number;
  /** Aerodynamic and thrust load along the airframe's up axis, in g. */
  loadFactor?: number;
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
