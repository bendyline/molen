/** Flight-only metadata calibration. Never generates or changes a mesh. */
import { readFileSync } from 'node:fs';
import {
  aircraftEngineThrust,
  sampleAtmosphere,
  waveDragCoefficient,
} from '@bendyline/molen-kernel/aircraft';
import { configureEngineControls } from './aircraft-engine-controls.mjs';
import { trimPoint } from './flight-bench.mjs';

export const performanceLedger = JSON.parse(
  readFileSync(
    new URL('../../../content/entities/source/aircraft-performance.json', import.meta.url),
    'utf8',
  ),
);
export const performanceProfiles = new Map(performanceLedger.aircraft.map((p) => [p.id, p]));
export function referenceSpeed(profile) {
  return profile.reference.ktas === undefined
    ? profile.reference.mach * sampleAtmosphere({}, profile.reference.altitudeM).speedOfSound
    : (profile.reference.ktas * 1852) / 3600;
}

/** Coefficients fit one declared anchor; independent conditions must be tested separately. */
export function tuneAircraftPerformance(id, spec) {
  configureEngineControls(id, spec);
  const p = performanceProfiles.get(id);
  if (!p) throw Error(`Missing performance profile: ${id}`);
  const speed = referenceSpeed(p),
    ref = p.reference;
  if (p.propulsion === 'helicopter') {
    const h = spec.helicopter;
    h.vortexRing = true;
    h.retreatingBladeSpeed = p.retreatingBladeSpeed;
    h.rotorDiscs = p.rotorDiscs;
    h.powerLimitedRotor = true;
    h.rotorEfficiency = 0.75;
    h.profilePowerFraction = 0.12;
    spec.engine.power = p.shaftPowerW;
    spec.engine.ratedDensityRatio = spec.engine.mixtureControl ? 1 : 0.7;
    spec.engine.densityExponent = 1;
    // At cruise, the rotor's vertical force equals weight and horizontal force balances drag.
    // Preserve the assisted collective model; fit parasitic drag at a modest 12 degree tilt.
    const sigma = sampleAtmosphere({}, ref.altitudeM).densityKgM3 / 1.225;
    h.horizontalDrag = (spec.mass * 0.016) / sigma;
    h.quadraticDrag =
      ((spec.mass * 9.81 * Math.tan((12 * Math.PI) / 180)) / (speed * sigma) - h.horizontalDrag) /
      speed;
    return spec;
  }
  const w = spec.airplane,
    engines = spec.engines ?? [spec.engine],
    fighter = !!p.afterburnerThrustN;
  w.wingArea = p.wingAreaM2;
  w.groundEffect = true;
  w.inducedDrag = 1 / (Math.PI * (spec.span ** 2 / w.wingArea) * (fighter ? 0.72 : 0.82));
  w.criticalMach = fighter
    ? 0.85
    : p.propulsion === 'jet'
      ? id.endsWith('g650er')
        ? 0.86
        : 0.72
      : 0.62;
  w.waveDrag = fighter ? 0.025 : 0.22;
  if (id.endsWith('av_8b')) w.criticalMach = 0.78;
  w.maxMach = fighter
    ? (p.maxMach ?? ref.mach)
    : p.propulsion === 'jet'
      ? id.endsWith('g650er')
        ? 0.925
        : id.endsWith('citation_cj4')
          ? 0.77
          : 0.82
      : 0.72;
  w.maxEquivalentAirspeed = fighter ? 410 : p.propulsion === 'jet' ? 175 : speed * 1.2;
  w.gearLimitSpeed = fighter ? 130 : Math.max(60, Math.min(130, speed * 0.65));
  w.flapLimitSpeed = fighter ? 125 : Math.max(45, Math.min(115, speed * 0.6));
  if (w.fixedGear) {
    w.gearDrag = 0.004;
    delete w.gearLimitSpeed;
  }
  // Typical estimated extension increments. Fixed gear still contributes in clean flight.
  w.flapLift = fighter ? 0.6 : 0.8;
  w.flapDrag = fighter ? 0.065 : 0.075;
  if (id.endsWith('p51d')) {
    w.flapLift = 0.33;
    w.flapDrag = 0.035;
  }
  for (const e of engines) {
    e.propulsion = p.propulsion;
    e.densityExponent = p.propulsion === 'jet' ? 0.85 : 1;
    if (p.propulsion === 'jet') {
      e.dryThrust = p.dryThrustN;
      // Estimated upper-altitude engine deck: retain reference calibration, then lose net
      // thrust at least as fast as density. A multi-altitude engine deck can replace this fit.
      e.highAltitudeDensityRatio = sampleAtmosphere({}, ref.altitudeM).densityKgM3 / 1.225;
      e.highAltitudeExponent = 1.2;
      e.ramRise = fighter ? 0.2 : 0.15;
      e.maxThrust = p.afterburnerThrustN ?? p.dryThrustN;
      if (fighter) {
        e.afterburnerThrust = p.afterburnerThrustN;
        e.afterburnerDetent = 0.85;
      } else {
        delete e.afterburnerThrust;
        delete e.afterburnerDetent;
      }
      // power is retained for backward-compatible schema/visual telemetry, not jet thrust.
      w.propellerEffects = 0;
    } else {
      e.power = p.shaftPowerW;
      e.ratedDensityRatio = p.ratedDensityRatio;
      e.propellerEfficiency = w.propellerEfficiency;
      e.maxThrust = id.endsWith('mv_22b')
        ? (spec.mass * 12.5) / engines.length
        : Math.max((spec.mass * 3.8) / engines.length, (p.shaftPowerW * 0.85) / 40);
    }
  }
  if (fighter) {
    w.maxLoadFactor = id.endsWith('f_14d') || id.endsWith('fa_18c') ? 7.5 : 9;
    w.profileDrag = 0.018;
  } else w.profileDrag = 0.02;
  if (!fighter && spec.mass > 12000) {
    w.maxLoadFactor = 2.5;
    w.minLoadFactor = -1;
  }
  if (id.endsWith('.airliner')) {
    // This original template copied the Mustang's explicit inertias. Use the kernel's
    // mass-and-dimension estimates instead of a 4-ton fighter's values for a 42-ton twin.
    delete w.rollInertia;
    delete w.pitchInertia;
    delete w.yawInertia;
  }
  const point = trimPoint(spec, speed, ref.altitudeM, { power: ref.throttle });
  if (!point) throw Error(`${id}: cannot trim reference condition`);
  const qS = 0.5 * sampleAtmosphere({}, ref.altitudeM).densityKgM3 * speed ** 2 * w.wingArea;
  if (fighter) {
    const shape = waveDragCoefficient({ ...w, waveDrag: 1 }, point.mach);
    const fitWave = () => {
      const at = trimPoint(spec, speed, ref.altitudeM, { power: ref.throttle });
      w.waveDrag += at.excessThrust / qS / shape;
    };
    if (p.seaLevelMach) {
      // A second anchor determines the altitude lapse, rather than allowing the high-altitude
      // maximum to imply the same TAS near sea level. Low-altitude anchors are explicitly estimated.
      let lo = 0,
        hi = 1.5;
      for (let i = 0; i < 45; i++) {
        const exponent = (lo + hi) / 2;
        for (const e of engines) e.densityExponent = exponent;
        fitWave();
        const sea = trimPoint(spec, p.seaLevelMach * sampleAtmosphere({}).speedOfSound, 0);
        if (sea.excessThrust > 0) hi = exponent;
        else lo = exponent;
      }
      w.maxEquivalentAirspeed = p.seaLevelMach * sampleAtmosphere({}).speedOfSound;
    } else fitWave();
    if (w.waveDrag < 0) throw Error(`${id}: reference requires negative wave drag`);
  } else {
    w.profileDrag += point.excessThrust / qS;
    if (w.profileDrag < 0.004) {
      // A slower subsonic wing begins compressibility rise later than the class default.
      w.criticalMach = Math.max(w.criticalMach, point.mach - 0.015);
      const at = trimPoint(spec, speed, ref.altitudeM, { power: ref.throttle });
      w.profileDrag += at.excessThrust / qS;
    }
    if (w.profileDrag < 0.004 || w.profileDrag > (spec.poweredLift ? 0.3 : 0.15))
      throw Error(`${id}: implausible fitted CD0 ${w.profileDrag}`);
  }
  if (id.endsWith('f_14d')) {
    w.departure = {
      onsetAngle: 0.4,
      fullAngle: 1.05,
      yawInstability: 4.5,
      yawSaturationRate: 3.14,
      rudderBlanking: 0.97,
      pitchBlanking: 0.98,
      aileronReversal: 0.9,
    };
    w.stallPitchRate = 0.08;
  }
  // Assert static ratings remain finite before writing a source document.
  for (const e of engines)
    if (!Number.isFinite(aircraftEngineThrust(e, w, sampleAtmosphere({}), 0)))
      throw Error(`${id}: invalid thrust`);
  return spec;
}
