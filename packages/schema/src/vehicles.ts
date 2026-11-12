import type { ActuatorSpecs } from './actuators';
import type { AircraftDebris, AircraftPartDamage } from './aircraft';
import type { JsonObject } from './json';
import type { ModelSignalSpec } from './model-signals';
import type { VehicleInteriorSpec } from './vehicle-interior';

/** Stable external entity/type id for a wheeled vehicle. */
export type VehicleKind = string;

/** Authored rigid sections for road-vehicle impacts. The chassis remains the support body. */
export interface VehicleCollisionPart extends JsonObject {
  id: string;
  role: 'frontWheel' | 'rearWheel' | 'panel' | 'engine';
  center: [number, number, number];
  probes: [number, number, number][];
  radius: number;
  massFraction: number;
  breakSpeed: number;
  nodes: string[];
  /** Optional articulated panel hinge, driven by a named actuator. */
  hinge?: {
    pivot: [number, number, number];
    axis: [number, number, number];
    angle: number;
    actuator: string;
  };
}

/** Persistent section integrity and independently moving debris, shared with aircraft. */
export interface VehicleDamageState extends JsonObject {
  damage?: Record<string, AircraftPartDamage>;
  debris?: AircraftDebris[];
}

/** Generic body styles, independent of any make or model name. */
export type VehicleBodyStyle =
  | 'city'
  | 'hatchback'
  | 'sedan'
  | 'fastback'
  | 'coupe'
  | 'roadster'
  | 'wagon'
  | 'crossover'
  | 'suv'
  | 'offroad'
  | 'pickup'
  | 'van'
  | 'cargo-van'
  | 'box-truck'
  | 'motorhome'
  | 'bus'
  | 'light-rail'
  | 'locomotive'
  | 'freight-car'
  | 'passenger-car'
  | 'bicycle'
  | 'motorcycle'
  | 'scooter'
  | 'moped'
  | 'kick-scooter'
  | 'skateboard'
  | 'auto-rickshaw'
  | 'skis'
  | 'snowboard'
  | 'snowmobile';

/**
 * Where a rider's hands and feet go, in model space, for a vehicle steered by handlebars rather
 * than a wheel. The driver seat is the pelvis anchor.
 */
export interface HandlebarSpec extends JsonObject {
  /** Forward torso lean in radians. */
  riderLean: number;
  handlebarPivot: [number, number, number];
  /**
   * Left, then right hand grips; they turn with the bars about `handlebarPivot`. A `sideways`
   * rider has no bars: these are free hand positions for an adult, which do not turn and move
   * with the hips of a shorter or taller body.
   */
  grips: [[number, number, number], [number, number, number]];
  /** Left, then right ankle targets on the footrests or deck (used without pedals). */
  footrests: [[number, number, number], [number, number, number]];
}

/**
 * How a cycle's rider stands: on a saddle (`seated`, the default), upright on a deck facing the
 * bars (`standing`), or across a board with the left foot forward (`sideways`). A standing or
 * sideways rider's seat is where an adult's hips go; the pose lowers or raises the hips to the
 * body's own leg length, keeping the hands and feet on their targets.
 */
export type CycleStance = 'seated' | 'standing' | 'sideways';

/** Self-balancing two-wheel handling and metric rider contact points, in model space. */
export interface CycleSpec extends HandlebarSpec {
  maxLean: number;
  stance?: CycleStance;
  pedals?: {
    center: [number, number, number];
    radius: number;
    halfWidth: number;
    /** Wheel revolutions per crank revolution. */
    ratio: number;
  };
  /**
   * Push-powered (a skateboard): under power the rider turns forward and pushes off the ground
   * with the rear foot, one push per `stride` meters travelled, then rides sideways again.
   */
  kick?: {
    /** Meters travelled per push. */
    stride: number;
  };
}

/**
 * Runners in place of tires: skis, a snowboard, a sled, or a snowmobile's skis and track. On the
 * weather's lying snow the vehicle slides with little friction, its edges or paddles hold the
 * full `grip`, and it floats over any depth; off the snow it scrapes to a stop. Gravity along a
 * slope moves it, and at rest only a brake or a slope too gentle to beat the friction holds it.
 */
export interface RunnerSpec extends JsonObject {
  /**
   * Sliding friction coefficient on snow: it resists as `friction` × g. About 0.05 for waxed
   * skis, 0.12 for a snowmobile's track.
   */
  friction: number;
  /** Resistance in m/s² off the snow, where runners scrape bare ground; default 3. */
  bareDrag?: number;
  /**
   * Fastest the rider's own pushing (poling, skating) drives it, in m/s; gravity may take it
   * on to `maxSpeed`. Absent, `engineForce` works up to `maxSpeed`, as an engine does.
   */
  pushSpeed?: number;
  /**
   * A cycle whose runners stay flat on the snow in a turn (a pair of skis side by side) rather
   * than banking as one plank (a snowboard). The lean into the turn stays in
   * `vehicleState.bodyRoll`, where the rider's pose reads it. Default false.
   */
  flat?: boolean;
}

/**
 * Engine, gearbox and driveline. Wheel force is engine torque through the selected gear, so a
 * car pulls hardest in first and runs out of power, not into a wall, at speed. Without a
 * powertrain a vehicle keeps the constant `engineForce` up to `maxSpeed`.
 */
export interface VehiclePowertrainSpec extends JsonObject {
  /** Peak power at the engine or motor shaft, in watts. */
  power: number;
  /** Engine speed at peak power, rev/min. */
  peakPowerRpm: number;
  /** Rev limit, rev/min; default 1.1 × peakPowerRpm. */
  redline?: number;
  /** Idle speed, rev/min; default 800, or 0 for an electric motor. */
  idle?: number;
  /**
   * Shape of the torque curve; default `gasoline` (torque peaks at half the peak-power speed).
   * `turbo` and `diesel` hold a torque plateau low down; `electric` holds its peak torque from
   * rest up to `peakPowerRpm`, then constant power.
   */
  curve?: 'gasoline' | 'turbo' | 'diesel' | 'electric';
  /** Overall ratios (gearbox × final drive: engine revs per wheel rev), lowest gear first. */
  gears: number[];
  /** A continuously variable transmission ranging between the first and last `gears` ratios. */
  continuous?: boolean;
  /** Overall reverse ratio; default the first gear. */
  reverse?: number;
  /** Share of engine torque that reaches the wheels; default 0.9. */
  efficiency?: number;
  /** Seconds of reduced drive during a gear change; default 0.3. */
  shiftTime?: number;
  /**
   * Engine braking off the throttle (regeneration for an electric motor), as a share of the
   * torque at peak power; default 0.2.
   */
  engineBraking?: number;
  /** How fast delivered torque follows the pedal, 1/s; default 8 (turbo and diesel 4, electric 20). */
  response?: number;
  /**
   * Rotating inertia of the engine, flywheel and gearbox input in kg m², which the car has to
   * spin up as it accelerates (most in the low gears); default 0.1 + power / 1 MW, or 0.06 for
   * an electric motor.
   */
  inertia?: number;
}

/** Data-driven tuning consumed by the generic wheeled-vehicle solver. */
export interface VehicleSpec extends JsonObject {
  collisionParts?: VehicleCollisionPart[];
  actuators?: ActuatorSpecs;
  label: string;
  /** Generic body style, so a host can classify or relabel the vehicle without its real name. */
  bodyStyle?: VehicleBodyStyle;
  /** Name-free display label such as 'Full-size pickup', for hosts that must not show the real name. */
  genericLabel?: string;
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
  /** Maximum steering angle in radians; zero locks the wheels for straight-track vehicles. */
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
  /** Engine, gears and driveline; without one the constant `engineForce` drives the car. */
  powertrain?: VehiclePowertrainSpec;
  /** Rear tire grip in m/s² where it differs from the front's `grip` (wider rear tires); default `grip`. */
  rearGrip?: number;
  /**
   * How much friction a tire loses as it is loaded: the share lost when its load doubles from
   * a quarter of the weight; default 0.25. Makes the heavier and the stiffer-sprung axle slide
   * first. 0 keeps grip proportional to load.
   */
  tireLoadSensitivity?: number;
  /**
   * Front axle's share of the roll stiffness, 0–1; default 0.6. The stiffer axle carries more
   * of the cornering weight transfer and gives up grip first: more is understeer.
   */
  rollBalance?: number;
  /**
   * Aerodynamic lift as an acceleration per (m/s)² of airspeed, in 1/m; negative is downforce.
   * Default 0.
   */
  aerodynamicLift?: number;
  /** Traction control: holds wheelspin at the grip limit; default true. */
  tractionControl?: boolean;
  /** Stability control: brakes one wheel to catch a slide; default true. */
  stabilityControl?: boolean;
  /**
   * How far the driven axle's differential resists one-wheel spin, 0 (open, the unloaded
   * inside wheel spins first) to 1 (locked); default 0.
   */
  limitedSlip?: number;
  /** Share 0–1 of the grip loose surfaces take away that the tires win back (off-road tread); default 0. */
  looseSurfaceGrip?: number;
  /** Slides on snow instead of rolling on tires (skis, a board, a snowmobile). */
  runners?: RunnerSpec;
  /** Two contact patches on the centreline; balances upright at rest and leans into turns. */
  cycle?: CycleSpec;
  /**
   * Handlebar steering on a vehicle that does not lean (a three-wheeler): the driver's hands and
   * feet, with the seat as the pelvis anchor. Ignored when `cycle` is present.
   */
  handlebar?: HandlebarSpec;
  /**
   * Headlamp lens centres in model space, at most two. Hosts that light vehicles at night place
   * their beams and lit lenses here; empty means no headlamps (a skateboard). Absent, they guess
   * a pair from the body's width, height and length.
   */
  headlamps?: [number, number, number][];
  /** Track-guided running gear: follows a host track guide instead of steering. */
  rail?: RailVehicleSpec;
}

/**
 * Running gear of a track-guided vehicle. `engineForce` is its starting tractive effort, held up
 * to `power / speed`; `brakeDeceleration` its full-service brake; `rollingResistance` and
 * `aerodynamicResistance` the Davis terms (N per kg, and per kg per (m/s)²).
 */
export interface RailVehicleSpec extends JsonObject {
  /** Distance between the two truck (bogie) pivots, meters. */
  truckCenters: number;
  /** Length over the coupler pulling faces, meters (spacing in a consist); default `length`. */
  couplerLength?: number;
  /** Power at the rail in watts; 0 or absent is an unpowered car that only brakes. */
  power?: number;
  /** Track gauge between rail heads, meters; default 1.435. */
  gauge?: number;
  /** Silhouette of the low-detail stand-in drawn at a distance; default `box`. */
  profile?: RailVehicleProfile;
}

/** Distant silhouettes of rail vehicles, by kind of car. */
export type RailVehicleProfile =
  | 'box'
  | 'hopper'
  | 'tank'
  | 'gondola'
  | 'flat'
  | 'well'
  | 'autorack'
  | 'locomotive'
  | 'coach'
  | 'railcar';

/** Named-node bindings for a GLB-backed wheeled vehicle. */
export interface VehicleVisualSpec extends JsonObject {
  wheelNodes: string[];
  /** Wheel nodes turned by the steering; empty when animation bindings pose the steering. */
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
