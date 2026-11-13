/** Driving-only metadata calibration for road vehicles. Never generates or changes a mesh. */
import { readFileSync } from 'node:fs';
import { initialVehicleState, stepVehicle } from '@bendyline/molen-kernel/vehicles';

export const dynamicsLedger = JSON.parse(
  readFileSync(
    new URL('../../../content/entities/source/vehicle-dynamics.json', import.meta.url),
    'utf8',
  ),
);
export const dynamicsProfiles = new Map(dynamicsLedger.vehicles.map((row) => [row.id, row]));

const G = 9.81;
const AIR_DENSITY = 1.225;
const FLAT = { groundHeight: () => 0 };
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));

function run(spec, seconds, controls, start = {}, watch = () => false) {
  let transform = { pos: [0, 0, 0], rot: [0, 0, 0, 1] };
  let state = { ...initialVehicleState(), ...start };
  for (let tick = 0; tick < seconds * 60; tick++) {
    const result = stepVehicle(transform, state, controls(state, tick / 60), spec, 1 / 60, FLAT);
    transform = result.transform;
    state = result.state;
    if (watch(state, (tick + 1) / 60, transform)) break;
  }
  return { transform, state };
}

/** Seconds from rest to 100 km/h at full throttle; Infinity if it never gets there. */
export function zeroTo100(spec) {
  let time = Infinity;
  run(
    spec,
    60,
    () => ({ throttle: 1, steering: 0, brake: false }),
    {},
    (state, t) => {
      if (state.speed < 27.78) return false;
      time = t;
      return true;
    },
  );
  return time;
}

/** Highest speed in km/h reached in two minutes at full throttle. */
export function topSpeed(spec) {
  return run(spec, 120, () => ({ throttle: 1, steering: 0, brake: false })).state.speed * 3.6;
}

/** Meters to stop from 100 km/h. */
export function stoppingDistance(spec) {
  let distance = Infinity;
  run(
    spec,
    15,
    () => ({ throttle: 0, steering: 0, brake: true }),
    { speed: 27.78 },
    (state, _t, transform) => {
      if (state.speed > 0.01) return false;
      distance = transform.pos[2];
      return true;
    },
  );
  return distance;
}

/**
 * Steady cornering in g with the wheel held over, as on a skidpad: the mean of speed × yaw
 * rate once the car has settled. The driver holds the entry speed if the engine can; a heavy
 * vehicle that cannot slows down in the turn, which leaves its cornering grip unchanged.
 */
export function skidpad(spec, speed = Math.min(20, spec.maxSpeed * 0.7)) {
  let sum = 0;
  let count = 0;
  run(
    spec,
    6,
    (state) => ({ throttle: clamp((speed - state.speed) * 0.5, 0, 1), steering: 1, brake: false }),
    { speed },
    (state, t) => {
      if (t > 3 && state.speed > 8) {
        sum += Math.abs(state.speed * (state.yawRate ?? 0));
        count++;
      }
      return false;
    },
  );
  return sum / Math.max(1, count) / G;
}

/** Bisect `knob` in [low, high] until measure(knob) reaches `target`; measure rises with knob. */
function solve(low, high, target, measure, rising = true) {
  let a = low;
  let b = high;
  for (let i = 0; i < 14; i++) {
    const mid = (a + b) / 2;
    if (measure(mid) < target === rising) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

/** Overall ratios for the row's gearbox, from where its first gear and its cruise sit. */
function gearing(row, spec) {
  const wheelRpmPerMs = 60 / (2 * Math.PI * spec.wheelRadius);
  const top = row.topSpeedKmh / 3.6;
  if (row.transmission === 'single')
    return { gears: [round(row.redlineRpm / (wheelRpmPerMs * top * 1.04))] };
  // First gear runs out between 35 and 70 km/h; the top gear is an overdrive for cruising.
  const firstSpeed = clamp(0.24 * row.topSpeedKmh, 35, 70) / 3.6;
  const first = row.redlineRpm / (wheelRpmPerMs * firstSpeed);
  const count = row.transmission === 'cvt' ? 8 : row.gears;
  const cruise = (row.engine === 'diesel' ? 0.42 : 0.34) + Math.max(0, 6 - count) * 0.05;
  const last = Math.min(
    first / 1.5,
    (cruise * row.peakPowerRpm) / (wheelRpmPerMs * Math.min(33.33, 0.85 * top)),
  );
  if (row.transmission === 'cvt') return { gears: [round(first), round(last)], continuous: true };
  return {
    gears: Array.from({ length: count }, (_, i) =>
      round(first * Math.pow(last / first, Math.pow(i / (count - 1), 0.85))),
    ),
  };
}

const CURVES = {
  gasoline: 'gasoline',
  turbo: 'turbo',
  diesel: 'diesel',
  electric: 'electric',
  // A hybrid's motor fills in below the engine's power band: it pulls like an electric car.
  hybrid: 'electric',
};

/** Engine note for a combustion car: its size sets the pitch, engine speed raises it. */
function engineSound(row, powertrain) {
  if (row.engine === 'electric') return undefined;
  const diesel = row.engine === 'diesel';
  const cylinders =
    row.powerKw > (row.engine === 'turbo' ? 300 : 260)
      ? 8
      : row.powerKw > (row.engine === 'turbo' ? 200 : 150)
        ? 6
        : 4;
  const idle = powertrain.idle ?? 800;
  const redline = powertrain.redline;
  return {
    sound: diesel ? 'vehicle.engine.diesel' : 'vehicle.engine.car',
    loop: true,
    pitch: diesel ? 0.92 : cylinders === 8 ? 0.86 : cylinders === 6 ? 0.98 : 1.1,
    gain: 1.1,
    when: { 'self.occupied': true },
    pitchFrom: {
      signal: 'vehicleState.rpm',
      curve: [
        [0, 0.7],
        [idle || 800, 0.8],
        [round(redline * 0.6, 0), 1.35],
        [redline, 1.9],
      ],
    },
    gainFrom: {
      signal: 'vehicleState.engineLoad',
      curve: [
        [0, row.engine === 'hybrid' ? 0.3 : 0.6],
        [1, 1],
      ],
    },
  };
}

/**
 * Write one vehicle's handling and performance from its ledger row: mass and weight
 * distribution, engine and gearing, tires, suspension, aids and aerodynamics. Acceleration and
 * cornering grip are then fitted with the production solver to the row's 0–100 km/h time and
 * skidpad figure, so the numbers a driver knows are the ones the car does.
 */
export function tuneVehicleDynamics(row, components) {
  const spec = components.vehicle.spec;
  // Trucks, buses and motorhomes: air brakes, long shifts and soft, slow springs.
  const heavy = row.massKg > 4500;
  spec.mass = Math.round(row.massKg + 75);
  spec.drive = row.drive;
  spec.centerOfMass = [
    spec.centerOfMass[0],
    spec.centerOfMass[1],
    round((row.frontWeight - 0.5) * spec.wheelbase),
  ];
  // Tires: stickier ones are also stiffer, so they need less slip angle and feel sharper.
  const sport = clamp((row.lateralG - 0.6) / 0.45, 0, 1);
  spec.corneringStiffness = round(12 + 16 * sport, 1);
  if (row.rearGripScale === 1) delete spec.rearGrip;
  // Suspension: sporty cars sit flatter and on stiffer springs.
  spec.rollStiffness = round(0.11 - 0.07 * sport);
  spec.pitchStiffness = round(0.055 - 0.03 * sport);
  spec.suspensionFrequency = round(heavy ? 1.2 : 1.25 + 0.7 * sport, 2);
  spec.suspensionDamping = round(0.42 + 0.2 * sport, 2);
  // Rear-heavy cars are set up with a stiff front end to keep the tail in line.
  spec.rollBalance = round(clamp(0.6 + (0.5 - row.frontWeight) * 0.5, 0.55, 0.68));
  spec.brakeBias = round(
    clamp(row.frontWeight + (0.6 * spec.centerOfMass[1]) / spec.wheelbase, 0.55, 0.8),
    2,
  );
  // Air: drag from the drag area, and a little lift (downforce on the fastest cars).
  spec.aerodynamicResistance = round((0.5 * AIR_DENSITY * row.dragArea) / spec.mass, 6);
  const liftArea = row.lateralG >= 1 ? -0.15 : row.lateralG >= 0.93 ? 0.05 : 0.25;
  spec.aerodynamicLift = round((0.5 * AIR_DENSITY * liftArea) / spec.mass, 6);
  spec.maxSpeed = round((row.topSpeedKmh / 3.6) * 1.02, 2);
  if (row.stabilityControl) delete spec.stabilityControl;
  else spec.stabilityControl = false;
  if (row.tractionControl) delete spec.tractionControl;
  else spec.tractionControl = false;
  if (row.limitedSlip > 0) spec.limitedSlip = row.limitedSlip;
  else delete spec.limitedSlip;
  if (row.offroadTires > 0) spec.looseSurfaceGrip = row.offroadTires;
  else delete spec.looseSurfaceGrip;
  const powertrain = {
    power: Math.round(row.powerKw * 1000),
    peakPowerRpm: row.peakPowerRpm,
    redline: row.redlineRpm,
    curve: CURVES[row.engine],
    ...gearing(row, spec),
    efficiency: 0.9,
    ...(row.engine === 'electric' || row.engine === 'hybrid' ? { idle: 0 } : {}),
    ...(heavy ? { shiftTime: 0.6 } : {}),
  };
  spec.powertrain = powertrain;
  const setGrip = (grip) => {
    spec.grip = round(grip, 2);
    if (row.rearGripScale !== 1) spec.rearGrip = round(grip * row.rearGripScale, 2);
    // Brakes strong enough that the tires, not the calipers, set the stopping distance.
    spec.brakeDeceleration = round(grip * (heavy ? 1 : 1.12), 1);
  };
  // Start from enough tire for the launch, fit the launch, then fit the tire to the skidpad
  // and the launch once more (wheelspin couples the two).
  setGrip((row.lateralG * G) / 0.9);
  const wheelRpmPerMs = 60 / (2 * Math.PI * spec.wheelRadius);
  const fitLaunch = () => {
    // A motor's launch is set by where its constant torque gives way to constant power.
    if (row.transmission === 'single') {
      // One ratio, fixed by the top speed: the motor speed where full power arrives moves it.
      powertrain.peakPowerRpm = Math.round(
        solve(0.08 * row.redlineRpm, 0.7 * row.redlineRpm, row.zeroTo100S, (rpm) => {
          powertrain.peakPowerRpm = rpm;
          return zeroTo100(spec);
        }),
      );
      return;
    }
    if (row.engine === 'hybrid' && row.transmission === 'cvt') {
      // A power-split hybrid: the lowest ratio sets the road speed where full power arrives.
      const lowest = (speed) =>
        Math.max(powertrain.gears[1] * 1.3, row.peakPowerRpm / (wheelRpmPerMs * speed));
      powertrain.gears[0] = round(
        lowest(
          solve(5, 30, row.zeroTo100S, (speed) => {
            powertrain.gears[0] = lowest(speed);
            return zeroTo100(spec);
          }),
        ),
      );
      return;
    }
    powertrain.efficiency = round(
      solve(
        0.75,
        0.97,
        row.zeroTo100S,
        (efficiency) => {
          powertrain.efficiency = efficiency;
          return zeroTo100(spec);
        },
        false,
      ),
    );
  };
  fitLaunch();
  setGrip(
    solve(4, 14, row.lateralG, (grip) => {
      setGrip(grip);
      return skidpad(spec);
    }),
  );
  fitLaunch();
  // The constant-force fallback for hosts without the powertrain: first gear's best pull.
  const torque = powertrain.power / ((powertrain.peakPowerRpm * 2 * Math.PI) / 60);
  const peakTorque = { gasoline: 1.25, turbo: 1.32, diesel: 1.5, electric: 1 }[powertrain.curve];
  spec.engineForce = Math.round(
    (torque * peakTorque * powertrain.gears[0] * powertrain.efficiency) / spec.wheelRadius,
  );
  const sound = engineSound(row, powertrain);
  if (sound) components.audioSource = sound;
  else delete components.audioSource;
  return spec;
}

/** What the tuned car does, beside what its ledger row says a real one does. */
export function measureVehicleDynamics(spec) {
  return {
    zeroTo100S: round(zeroTo100(spec), 2),
    topSpeedKmh: round(topSpeed(spec), 0),
    lateralG: round(skidpad(spec), 3),
    stoppingM: round(stoppingDistance(spec), 1),
  };
}
