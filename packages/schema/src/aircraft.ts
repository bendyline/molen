import type { ActuatorInputs, ActuatorPositions, ActuatorSpecs } from './actuators';
import type { JsonObject } from './json';
import type { ModelSignalSpec } from './model-signals';
import type { VehicleInteriorSpec } from './vehicle-interior';

/** Stable external entity/type id for an aircraft. */
export type AircraftKind = string;
export type FlightModel = 'airplane' | 'helicopter';

/** World-space sphere, or a finite rotor disc when `disc` is present. */
export interface AircraftCollisionProbe {
  part: string;
  center: [number, number, number];
  radius: number;
  /** Radius is radial, not a bounding sphere. Normal is unit length in world space. */
  disc?: { normal: [number, number, number]; halfThickness: number; angularSpeed: number };
}
/** Normal points out of the obstacle. Point and depth are in world meters. */
export interface AircraftContact {
  part: string;
  point: [number, number, number];
  normal: [number, number, number];
  depth: number;
}

export interface AircraftEngineSpec extends JsonObject {
  /** Manually metered piston fuel mixture; omitted/false leaves fuel scheduling automatic. */
  mixtureControl?: boolean;
  /** Constant-speed propeller governor. Lever selects normalized RPM, not blade angle directly. */
  propellerControl?: { minRpm: number };
  /** Omitted retains legacy constant-power propulsion. Jets produce thrust, not shaft power. */
  propulsion?: 'propeller' | 'jet';
  /** Sea-level static dry jet thrust, N. */
  dryThrust?: number;
  /** Sea-level static thrust at full reheat, N (total, not an increment). */
  afterburnerThrust?: number;
  /** Common throttle detent; above it reheat increases from 0 to 1. Default 0.85. */
  afterburnerDetent?: number;
  /** Density exponent for installed power/thrust lapse. Default 1 with explicit propulsion. */
  densityExponent?: number;
  /** Density-ratio knee for the upper-altitude installed-engine lapse. Optional. */
  highAltitudeDensityRatio?: number;
  /** Lapse exponent below that density ratio, continuous at the knee. */
  highAltitudeExponent?: number;
  /** Flat-rated shaft engine holds power to this density ratio; default 1. */
  ratedDensityRatio?: number;
  /** Jet net-thrust multiplier per Mach squared, representing inlet ram recovery. Default 0. */
  ramRise?: number;
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
  /**
   * Specific fuel consumption, used when the aircraft declares `fuel`: kg per joule of shaft
   * work for a propeller or rotor engine (default 7.5e-8 with a manual mixture, about 0.27
   * kg/kWh; 9.5e-8 otherwise), kg per newton-second of thrust for a jet (default 2e-5).
   */
  fuelConsumption?: number;
  /** A jet's consumption per newton-second of total thrust at full reheat; default 5.4e-5. */
  afterburnerFuelConsumption?: number;
}

/** A named installation in an airplane's engine bank. Positions use aircraft-local meters. */
export interface AircraftNamedEngineSpec extends AircraftEngineSpec {
  id: string;
}

export interface AircraftEngineInputData extends JsonObject {
  /** Fuel mixture: 0 idle cutoff, 1 full rich; omitted inherits common mixture. */
  mixture?: number;
  /** Propeller RPM lever: 0 minimum governed RPM, 1 maximum; inherits common propeller. */
  propeller?: number;
  /** Absolute throttle override, 0–1. Omitted inherits the common throttle. */
  power?: number;
  /** Individual engine switch. The common engine switch remains a master cutoff. */
  enabled?: boolean;
}

export interface AircraftEngineStateData extends JsonObject {
  /** Available delivered shaft power in watts; zero for jet engines. */
  shaftPower?: number;
  /** Mixture-dependent combustion effectiveness, 0..1; zero when switched off or failed. */
  combustion?: number;
  rpm: number;
  rotorAngle: number;
  /** Latched failure; pilot throttle/switch changes cannot clear it. */
  failed: boolean;
  /** Current engine thrust in newtons (zero for the helicopter's shaft engine). */
  thrust: number;
  /** Actual reheat fraction, 0..1, after spool/ignition delay. */
  afterburner?: number;
}

export interface AirplanePhysicsSpec extends JsonObject {
  /** Mach at which wave drag starts rising. Omitted disables compressibility drag. */
  criticalMach?: number;
  /** Added wave-drag coefficient at criticalMach + 0.25. Default 0. */
  waveDrag?: number;
  /** Operating limits flag overspeed; they do not clamp velocity. Speeds in m/s EAS. */
  maxEquivalentAirspeed?: number;
  maxMach?: number;
  gearLimitSpeed?: number;
  flapLimitSpeed?: number;
  /** Wing ground effect: reduction of induced drag close to the surface. Default false. */
  groundEffect?: boolean;
  /** Optional nonlinear high-alpha departure model; coefficients are empirical estimates. */
  departure?: {
    onsetAngle: number;
    fullAngle: number;
    yawInstability: number;
    yawSaturationRate: number;
    rudderBlanking: number;
    pitchBlanking: number;
    aileronReversal: number;
  };
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
  /** Additional drag coefficient at full speed-brake actuator extension. */
  speedBrakeDrag?: number;
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
  /**
   * Main wheels ahead of the center of mass with a tailwheel behind: a firm touchdown on the
   * mains pitches the nose up (and the airplane back into the air), and hard braking lifts the
   * tail. Default false: a nosewheel, which a touchdown pitches down onto.
   */
  tailwheel?: boolean;
  /**
   * Share of the sink speed beyond a gentle 0.6 m/s that the struts and tires give back at
   * touchdown; default 0.45. A firm landing skips, a greased one stays down.
   */
  gearRebound?: number;
  /**
   * Sustained positive g the pilot holds before vision starts to dim; default 4.5, or 6.5 (a
   * g-suit) when `maxLoadFactor` is 7.5 or more.
   */
  pilotGTolerance?: number;
}

export interface HelicopterPhysicsSpec extends JsonObject {
  /** Fixed skids/wheels by default; false enables retractable gear. */
  fixedGear?: boolean;
  gearTransitTime?: number;
  /** Govern rotor RPM independently of collective and limit lift to available shaft power. */
  powerLimitedRotor?: boolean;
  /** Induced-power efficiency, 0..1; default 0.75. */
  rotorEfficiency?: number;
  /** Shaft-power fraction used by rotor profile drag at governed RPM; default 0.12. */
  profilePowerFraction?: number;
  /** Optional rotor aerodynamic penalties; assisted rotor model, not blade-element dynamics. */
  vortexRing?: boolean;
  /** Sea-level TAS for retreating-blade stall onset, m/s; decreases with density and rotor RPM. */
  retreatingBladeSpeed?: number;
  /** Effective lifting disc count (e.g. 2 for tandem rotors), default 1. */
  rotorDiscs?: number;
  /**
   * Seconds of hover power stored in the turning rotor at full speed; default 2. With the
   * engine out in flight the rotor lives on this and on the air it descends through
   * (autorotation): a heavy rotor forgives a late flare, a light one does not. Needs
   * `powerLimitedRotor`.
   */
  rotorInertiaTime?: number;
  /**
   * Tail-fin weathervaning in forward flight, default 1; 0 disables it. The nose turns into
   * the relative wind at `directionalStability × airspeed / length` rad/s per radian of
   * sideslip, fading out below about a fifth of `translationalLiftSpeed`, so a banked
   * helicopter's nose follows its turning track.
   */
  directionalStability?: number;
  /**
   * Direct-cyclic pitch and roll rate at full stick with the rotor carrying the weight, rad/s.
   * Default `cyclicResponse / 4`.
   */
  cyclicRate?: number;
  /**
   * Share of direct-cyclic control power that does not depend on rotor thrust, 0..1, default
   * 0.25. The rest fades as the rotor unloads: near 0 for a teetering rotor, which has no
   * control at zero g, higher for articulated and most for hingeless rotors.
   */
  hubStiffness?: number;
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
  /** Legacy unrigged gear hides when fully up; position/rotation-bound nodes keep their pose. */
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

/** A rigid airframe section; +X is the aircraft's left side. */
export interface AircraftCollisionPart extends JsonObject {
  id: string;
  role: 'body' | 'leftWing' | 'rightWing' | 'tail' | 'rotor' | 'tailRotor' | 'gear' | 'engine';
  /** Collision sphere centers in model coordinates, meters. */
  probes: [number, number, number][];
  radius: number;
  /** Finite swept rotor volume, replacing this section's sphere probes. Active even at rest. */
  disc?: {
    center: [number, number, number];
    normal: [number, number, number];
    radius: number;
    halfThickness: number;
    /** Node in visual.rotors, supplying the engine and signed speed multiplier. */
    rotor: string;
    /** Rotate the disc about this model-space hinge with thrustVectorPosition (0..1). */
    tilt?: { pivot: [number, number, number]; axis: [number, number, number]; angle: number };
  };
  /** Supporting section. Its separation also releases this part, once, with its own debris. */
  parent?: string;
  /** Center of the detached section in model coordinates. */
  center: [number, number, number];
  /** Fraction of the original aircraft mass carried away on separation. */
  massFraction: number;
  /** Normal impact speed in m/s that exhausts an undamaged joint. Omit for an unbreakable body. */
  breakSpeed?: number;
  /** Exact GLB node names, including attached controls, markings and gear. */
  nodes: string[];
  /** Split shared static detail meshes by triangle centroid in model coordinates. */
  fragments?: { nodes: string[]; min: [number, number, number]; max: [number, number, number] };
  /** Engines disabled when this section separates. */
  engines?: string[];
}

export interface AircraftPartDamage extends JsonObject {
  integrity: number;
  detached: boolean;
}

export interface AircraftDebris extends JsonObject {
  part: string;
  /** World-space section center and orientation; meters and quaternion. */
  pos: [number, number, number];
  rot: [number, number, number, number];
  velocity: [number, number, number];
  /** Local angular velocity about +X, +Y and +Z, rad/s. */
  angularVelocity: [number, number, number];
  age: number;
}

/** Complete data-driven tuning consumed by the generic aircraft solver and client. */
export interface AircraftSpec extends JsonObject {
  actuators?: ActuatorSpecs;
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
  /**
   * Fuel on board. `mass` is the aircraft with full tanks: it lightens as fuel burns, and the
   * engines stop when the tanks are dry. Without it fuel is unlimited and the mass constant.
   */
  fuel?: {
    /** Usable fuel in kg with full tanks. */
    capacity: number;
  };
  hardLandingSpeed: number;
  hardLandingRoll: number;
  hardLandingPitch: number;
  maxSupportStep: number;
  collisionProbes: [number, number, number][];
  /** Optional authored breakable sections. Replaces collisionProbes when present. */
  collisionParts?: AircraftCollisionPart[];
  visual: AircraftVisualSpec;
}

export interface AircraftData extends JsonObject {
  /** Stable external entity/type id. */
  kind: AircraftKind;
  spec: AircraftSpec;
}
export interface AircraftInputData extends JsonObject {
  actuators?: ActuatorInputs;
  /** Common fuel mixture: 0 idle cutoff, 1 full rich (default). Only manually metered pistons. */
  mixture?: number;
  /** Common propeller governor lever: 0 minimum RPM, 1 maximum (default). */
  propeller?: number;
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
  flaps: boolean | number;
  /** Powered-lift lever: 0 forward, 1 vertical. Omitted selects forward thrust. */
  thrustVector?: number;
  /**
   * Helicopter cyclic. `assisted` (the default) commands a bounded tilt that levels itself when
   * the stick is released. `direct` commands pitch and roll rates with full authority, so the
   * helicopter can loop, roll or point straight down, and holds its attitude when released.
   * On the ground both behave as assisted.
   */
  cyclicMode?: 'assisted' | 'direct';
}
export interface AircraftStateData extends JsonObject {
  actuators?: ActuatorPositions;
  /** Persistent joint damage. Recovery starts with a fresh aircraft state. */
  damage?: Record<string, AircraftPartDamage>;
  /** Detached sections, simulated for 20 seconds; damage remains after debris expires. */
  debris?: AircraftDebris[];
  /** Kernel-owned: velocity and speed telemetry include the 4× travel boost. */
  boosted?: boolean;
  /** Air-relative speed divided by local speed of sound. */
  mach?: number;
  /** Equivalent airspeed (density-corrected TAS), m/s; not compressible calibrated IAS. */
  equivalentAirspeed?: number;
  /** Exceeding an authored airframe or deployed-surface limit. */
  overspeed?: boolean;
  /** Nonlinear departure intensity, 0..1; diagnostic, not a scripted spin switch. */
  departure?: number;
  /** Rotor vortex-ring lift-loss fraction, 0..1. */
  vortexRing?: number;
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
   * The solver starts it at the commanded position; fixed undercarriages stay down.
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
  /** Fuel remaining in kg when the aircraft declares `fuel`; absent is full tanks. */
  fuel?: number;
  /**
   * Pre-stall and stalled-wing buffet, 0..1: a cue for hosts to shake the view and sound a
   * warning. It starts a few degrees before the stall. Airplanes only.
   */
  buffet?: number;
  /**
   * The pilot's accumulated strain under positive g, 0..1: vision starts to dim near 0.3 and is
   * gone at 1. It builds above the tolerance and recovers below it. Airplanes only.
   */
  greyout?: number;
  /** The same for negative g (blood to the head), 0..1. Airplanes only. */
  redout?: number;
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
