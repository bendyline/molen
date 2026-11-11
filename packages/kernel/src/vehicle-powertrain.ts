import type { VehiclePowertrainSpec } from '@bendyline/molen-schema';
import { dmath as m } from './dmath';
import { approach } from './math3d';

type Curve = NonNullable<VehiclePowertrainSpec['curve']>;

/**
 * Engine torque at `x` (engine speed over the peak-power speed), relative to the torque at peak
 * power. A naturally aspirated petrol engine peaks at half that speed; turbocharged and diesel
 * engines hold a plateau low down; an electric motor holds its peak torque from rest up to
 * that speed and constant power beyond it.
 */
export function engineTorqueCurve(curve: Curve, x: number): number {
  if (x <= 0) return 1;
  switch (curve) {
    case 'electric':
      // Constant torque up to the speed where it reaches peak power, then constant power.
      return x <= 1 ? 1 : 1 / x;
    case 'turbo':
      if (x <= 0.72) return 1.32 * m.min(1, x / 0.3);
      if (x <= 1) return 1.32 - (0.32 / 0.28) * (x - 0.72);
      return m.max(0.2, 1 - 1.6 * (x - 1));
    case 'diesel':
      if (x <= 0.62) return 1.5 * m.min(1, x / 0.4);
      if (x <= 1) return 1.5 - (0.5 / 0.38) * (x - 0.62);
      return m.max(0.2, 1 - 2.5 * (x - 1));
    default:
      return m.max(0.2, 1 + x - x * x);
  }
}

/**
 * Torque at `rpm` in N m at full throttle. A motor's constant power tapers by up to 30% as it
 * nears its speed limit.
 */
function engineTorque(powertrain: VehiclePowertrainSpec, rpm: number, redline: number): number {
  const curve = powertrain.curve ?? 'gasoline';
  const peak = powertrain.peakPowerRpm;
  const torque = (powertrain.power / ((peak * m.TAU) / 60)) * engineTorqueCurve(curve, rpm / peak);
  if (curve !== 'electric' || rpm <= peak || redline <= peak) return torque;
  return torque * (1 - 0.3 * m.min(1, (rpm - peak) / (redline - peak)) ** 2);
}

/** Gearbox and engine state carried between steps; every field is in `vehicleState`. */
export interface PowertrainState {
  gear: number;
  rpm: number;
  engineLoad: number;
  shift: number;
}

export function initialPowertrainState(powertrain: VehiclePowertrainSpec): PowertrainState {
  return {
    gear: 1,
    rpm: powertrain.idle ?? (powertrain.curve === 'electric' ? 0 : 800),
    engineLoad: 0,
    shift: 0,
  };
}

/** Wheel force of each forward gear at full throttle, for tools that plot or check gearing. */
export function powertrainWheelForce(
  powertrain: VehiclePowertrainSpec,
  wheelRadius: number,
  speed: number,
  gear: number,
): number {
  const ratio = powertrain.gears[gear - 1];
  if (ratio === undefined) return 0;
  const redline = powertrain.redline ?? powertrain.peakPowerRpm * 1.1;
  const rpm = ((m.abs(speed) / wheelRadius) * ratio * 60) / m.TAU;
  if (rpm > redline) return 0;
  return (
    (engineTorque(powertrain, rpm, redline) * ratio * (powertrain.efficiency ?? 0.9)) / wheelRadius
  );
}

/**
 * One substep of the engine and gearbox. `speed` is the signed road speed in m/s, `demand` the
 * 0–1 accelerator and `direction` the way the driver wants to go (1 forward, -1 reverse). Returns
 * the signed force at the driven wheels' contact patches: drive in the direction of the selected
 * gear, less engine braking against the motion (and, given the vehicle's `mass`, less what it
 * takes to spin the engine up with the car). An automatic picks the gear: it holds low gears
 * to the rev limit under full throttle, short-shifts under a light foot, and kicks down when the
 * pedal goes down.
 */
export function stepPowertrain(
  powertrain: VehiclePowertrainSpec,
  wheelRadius: number,
  state: PowertrainState,
  speed: number,
  demand: number,
  direction: number,
  h: number,
  mass = 0,
): { force: number; state: PowertrainState; ratio: number } {
  const curve = powertrain.curve ?? 'gasoline';
  const idle = powertrain.idle ?? (curve === 'electric' ? 0 : 800);
  const peak = powertrain.peakPowerRpm;
  const redline = powertrain.redline ?? peak * 1.1;
  const efficiency = powertrain.efficiency ?? 0.9;
  const gears = powertrain.gears;
  const first = gears[0] ?? 1;
  const top = gears[gears.length - 1] ?? first;
  const wheelRpm = ((m.abs(speed) / wheelRadius) * 60) / m.TAU;
  // Delivered torque follows the pedal at the engine's own pace, and falls away faster.
  const response =
    powertrain.response ?? (curve === 'electric' ? 20 : curve === 'gasoline' ? 8 : 4);
  const engineLoad = approach(
    state.engineLoad,
    m.clamp(demand, 0, 1),
    h * response * (demand < state.engineLoad ? 2.5 : 1),
  );
  // The engine speed the driver's foot is asking for: a cruise near idle, the power band flat out.
  const floor = idle * 1.4 + (0.78 * peak - idle * 1.4) * m.pow(engineLoad, 1.2);
  let gear = state.gear;
  let shift = m.max(0, state.shift - h);
  let ratio: number;
  if (direction < 0) {
    // Reverse is selected only at rest; rolling backward it stays engaged.
    gear = -1;
    ratio = powertrain.reverse ?? first;
  } else if (powertrain.continuous) {
    gear = 1;
    const target = idle * 1.5 + (0.98 * peak - idle * 1.5) * m.pow(engineLoad, 0.8);
    ratio = m.clamp(target / m.max(wheelRpm, 1), top, first);
  } else {
    if (gear < 1) gear = 1;
    const count = gears.length;
    const rpmIn = (g: number): number => wheelRpm * (gears[g - 1] ?? top);
    if (m.abs(speed) < 1) gear = 1;
    else {
      // A car set rolling in too low a gear takes the one that fits without waiting.
      while (gear < count && rpmIn(gear) > redline) gear += 1;
      if (shift <= 0) {
        const dwell = (powertrain.shiftTime ?? 0.3) + 0.35;
        if (gear < count && (rpmIn(gear) > redline * 0.97 || rpmIn(gear + 1) > floor * 1.12)) {
          gear += 1;
          shift = dwell;
        } else if (gear > 1 && rpmIn(gear) < floor * 0.9 && rpmIn(gear - 1) < redline * 0.9) {
          gear -= 1;
          shift = dwell;
        }
      }
    }
    ratio = gears[gear - 1] ?? top;
  }
  // A clutch or torque converter slips below the launch speed: the engine never stalls.
  const launch = curve === 'electric' ? 0 : idle + (0.38 * peak - idle) * engineLoad;
  const linked = wheelRpm * ratio;
  const rpm = m.max(linked, launch);
  const torqueAtPeak = powertrain.power / ((peak * m.TAU) / 60);
  const x = rpm / peak;
  // The rev limiter cuts fuel at the redline.
  const drive = rpm >= redline ? 0 : engineTorque(powertrain, rpm, redline) * engineLoad;
  // Engine braking only through a locked driveline, and fading out at walking pace.
  const coast =
    (powertrain.engineBraking ?? 0.2) *
    torqueAtPeak *
    (curve === 'electric' ? engineTorqueCurve(curve, x) : x) *
    (1 - engineLoad) *
    m.clamp(m.abs(speed) / 2, 0, 1) *
    (curve === 'electric' ? 1 : m.clamp((linked - idle) / 300, 0, 1));
  // A gear change interrupts most of the drive for its first moments.
  const dwell = (powertrain.shiftTime ?? 0.3) + 0.35;
  const shifting = shift > dwell - (powertrain.shiftTime ?? 0.3) ? 0.25 : 1;
  // Part of the engine's torque goes into spinning itself up: in a low gear its flywheel
  // weighs on the car like a quarter more mass, in top gear hardly at all.
  const inertia =
    powertrain.inertia ?? (curve === 'electric' ? 0.06 : 0.1 + powertrain.power / 1_000_000);
  const spinning = (inertia * ratio * ratio * efficiency) / (wheelRadius * wheelRadius);
  const wheel = ((ratio * efficiency) / wheelRadius) * (mass > 0 ? mass / (mass + spinning) : 1);
  const force =
    m.sign(direction || 1) * drive * wheel * shifting - m.sign(speed) * coast * wheel * shifting;
  return {
    force,
    ratio,
    state: {
      gear,
      // Free revs rise and fall at the engine's own inertia, so a shift is heard.
      rpm: approach(state.rpm, m.max(idle, rpm), h * 9000),
      engineLoad,
      shift,
    },
  };
}
