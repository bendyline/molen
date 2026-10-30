import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';

/** Render-only blade loading estimate; angles in radians, independent of engine RPM. */
export interface RotorAcoustics {
  collective: number;
  cyclicPitch: number;
  cyclicRoll: number;
  gain: number;
  lowpassHz: number;
  /** Once-per-revolution loading envelope; blade-passage chop is already in the recording. */
  pulseHz: number;
  pulseDepth: number;
}

const clamp = (n: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, n));
const finite = (n: number | undefined, fallback = 0): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;

/**
 * An authored acoustic approximation, not a blade-element solver or measured noise prediction.
 * Collective sets mean feathering; cyclic varies it by rotor azimuth. Bank/rate and descending
 * inflow strengthen the loading envelope without changing governed RPM. NASA's maneuver study
 * motivates these dependencies: https://ntrs.nasa.gov/citations/20160005979 .
 */
export function rotorAcoustics(
  spec: AircraftSpec,
  state: AircraftStateData,
  input: AircraftInputData | undefined,
  listenerLocal: readonly number[],
): RotorAcoustics {
  const radians = Math.PI / 180;
  const collective = (2 + 12 * clamp(finite(input?.power, 0.5))) * radians;
  const cyclicPitch = clamp(finite(input?.pitch), -1, 1) * 6 * radians;
  const cyclicRoll = clamp(finite(input?.roll), -1, 1) * 6 * radians;
  const cyclic = clamp(Math.hypot(cyclicPitch, cyclicRoll) / (6 * radians));
  const x = finite(listenerLocal[0]),
    z = finite(listenerLocal[2]);
  const radius = Math.max(1, Math.hypot(x, z));
  const sectorPitch = collective + (cyclicRoll * x) / radius + (cyclicPitch * z) / radius;
  const loading = clamp((sectorPitch / radians - 2) / 12);
  const maneuver = clamp(
    Math.abs(finite(state.rollRate)) +
      Math.abs(finite(state.pitchRate)) +
      (1 / Math.max(0.45, Math.cos(finite(state.roll))) - 1) * 0.7,
  );
  const descent = clamp(-finite(state.verticalSpeed) / 7);
  const forward = clamp(finite(state.airspeed) / 15) * clamp((90 - finite(state.airspeed)) / 40);
  const interaction = state.grounded ? 0 : clamp(descent * forward + finite(state.vortexRing));
  const rpm = clamp(finite(state.rpm), 0, 1.2);
  return {
    collective,
    cyclicPitch,
    cyclicRoll,
    gain: rpm < 0.01 ? 0 : 0.65 + 0.45 * loading + 0.15 * cyclic + 0.15 * maneuver,
    lowpassHz: 1200 + 4000 * loading + 1600 * cyclic + 2200 * interaction + 1000 * maneuver,
    pulseHz: clamp((finite(spec.engine?.rotorAngularSpeed, 45) * rpm) / (2 * Math.PI), 0.1, 30),
    pulseDepth: clamp(
      0.05 + 0.14 * loading + 0.2 * cyclic + 0.18 * maneuver + 0.25 * interaction,
      0,
      0.65,
    ),
  };
}
