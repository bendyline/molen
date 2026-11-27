import type { AircraftSpec } from './aircraft';

/** One leg of an undercarriage: where it stands under the aircraft. */
export interface AircraftGearLegLayout {
  /**
   * The tire's (or skid end's) contact point with the aircraft at rest, from the center of mass:
   * meters to the left and forward.
   */
  x: number;
  z: number;
}

/**
 * The undercarriage a spec describes, resolved: `spec.gear` where it gives a dimension, and the
 * class rule from the airframe's size where it does not.
 */
export interface AircraftGearLayout {
  /**
   * An airplane's nose or tail wheel, left main and right main; a helicopter's front left, front
   * right, rear left and rear right skid ends. The order of `aircraftState.wheels`.
   */
  legs: AircraftGearLegLayout[];
  /** Main wheels to the nose or tail wheel, or the length of skid on the ground, m. */
  wheelbase: number;
  /** Between the main wheels or the skids, m. */
  track: number;
  /** Share of the weight on the nose or tail wheel at rest; 0 on skids. */
  auxiliaryShare: number;
  /** A tailwheel airplane: the small wheel is behind the mains. */
  tailwheel: boolean;
  /** Bounce frequency on the struts, Hz, and their damping ratio. */
  frequency: number;
  damping: number;
  /**
   * How far a strut extends below where it rests before its wheel hangs clear, m: its static
   * deflection, the same for every leg since each rides at the one frequency.
   */
  reach: number;
  /** How far a strut closes above where it rests before its stop, m. */
  travel: number;
}

const G = 9.81;

/**
 * Where an aircraft's legs stand and how far their struts move. An airplane stands on two main
 * wheels and a nose wheel, or a tailwheel (`airplane.tailwheel`); a helicopter on the four ends
 * of its skids. Where `spec.gear` gives no dimensions they follow from the airframe's size: the
 * main wheels a little behind the center of mass (ahead of it for a tailwheel) so the small wheel
 * carries about a tenth of the weight, as designers place them.
 *
 * The flight model stands the aircraft on exactly these legs, and a renderer needs them to draw
 * the strut travel `aircraftState.wheels.travel` reports.
 */
export function aircraftGearLayout(spec: AircraftSpec): AircraftGearLayout {
  const gear = spec.gear ?? {};
  const helicopter = spec.model === 'helicopter';
  const frequency = gear.frequency ?? (helicopter ? 2.2 : 1.4);
  const damping = gear.damping ?? (helicopter ? 0.55 : 0.65);
  const omega = Math.PI * 2 * frequency;
  const reach = G / (omega * omega);
  const travel = gear.travel ?? (0.6 * G) / (omega * omega);
  if (helicopter) {
    const rotor = spec.helicopter?.rotorRadius ?? spec.span / 2;
    const track = gear.track ?? 0.44 * rotor;
    const wheelbase = gear.wheelbase ?? 0.22 * spec.length;
    const legs: AircraftGearLegLayout[] = [];
    for (const z of [wheelbase / 2, -wheelbase / 2])
      for (const x of [track / 2, -track / 2]) legs.push({ x, z });
    return {
      legs,
      wheelbase,
      track,
      auxiliaryShare: 0,
      tailwheel: false,
      frequency,
      damping,
      reach,
      travel,
    };
  }
  const tailwheel = spec.airplane?.tailwheel === true;
  const wheelbase = gear.wheelbase ?? (tailwheel ? 0.55 : 0.33) * spec.length;
  const track = gear.track ?? 0.2 * spec.span;
  const auxiliaryShare = gear.auxiliaryShare ?? (tailwheel ? 0.07 : 0.1);
  const mainZ = (tailwheel ? auxiliaryShare : -auxiliaryShare) * wheelbase;
  const smallZ = (tailwheel ? auxiliaryShare - 1 : 1 - auxiliaryShare) * wheelbase;
  return {
    legs: [
      { x: 0, z: smallZ },
      { x: track / 2, z: mainZ },
      { x: -track / 2, z: mainZ },
    ],
    wheelbase,
    track,
    auxiliaryShare,
    tailwheel,
    frequency,
    damping,
    reach,
    travel,
  };
}
