/** Flight-only metadata calibration. Never generates or changes a mesh. */
import { readFileSync } from 'node:fs';
import {
  aircraftEngineThrust,
  rotorShaftPower,
  rotorTrim,
  sampleAtmosphere,
  waveDragCoefficient,
} from '@bendyline/molen-kernel/aircraft';
import {
  atMass,
  bestRotorClimb,
  bestSteadyClimb,
  hoverCeiling,
  rotorClimb,
  steadyGlide,
} from '@bendyline/molen-kernel/trials';
import { configureEngineControls } from './aircraft-engine-controls.mjs';
import { trimPoint } from './flight-bench.mjs';
import { aircraftFitCards, aircraftTrialData, anchorThrottle } from './trial-ledgers.mjs';

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
/**
 * The throttle the anchor is flown at: a quoted share of rated power becomes a lever position,
 * given how the tuned engine (`spec`) loses power with altitude.
 */
export function referenceThrottle(profile, spec) {
  const engine = spec?.engines?.[0] ?? spec?.engine;
  return anchorThrottle(
    profile.reference,
    sampleAtmosphere({}, profile.reference.altitudeM).densityKgM3 / 1.225,
    profile.ratedDensityRatio,
    engine?.densityExponent,
  );
}

/**
 * How an unsupercharged piston engine loses power with density, as an exponent: it falls
 * faster than the air thins, because friction and pumping losses do not (Gagg and Farrar's
 * relation, 1.132 x density ratio - 0.132, is close to density ratio ^ 1.17 up to 15,000 ft).
 */
const PISTON_DENSITY_EXPONENT = 1.17;

const G = 9.81;
const SEA_LEVEL_DENSITY = 1.225;
const KNOT = 1852 / 3600;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const round = (value, digits = 4) => Number(value.toFixed(digits));

/** Bisect `knob` in [low, high] until measure(knob) reaches `target`; measure rises with knob. */
function solve(low, high, target, measure, steps = 40) {
  let a = low;
  let b = high;
  for (let i = 0; i < steps; i++) {
    const mid = (a + b) / 2;
    if (measure(mid) < target) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

// Main wheels ahead of the center of mass, a tailwheel behind.
const TAILWHEEL = ['p51d', 'dhc_2', 'pc_6', 'beech_18', 'dc_3'];
// Seconds of hover power stored in the rotor: light rotors forgive an engine failure least.
const ROTOR_INERTIA_TIME = {
  oh6: 1.5,
  robinson_r44: 1.6,
  bell_206b: 3,
  uh_1h: 3.5,
  bell_412ep: 2.5,
  uh_60m: 2.5,
  ch_47f: 3,
  aw139: 2.2,
};

/**
 * Landing gear layout, usable fuel and rotor inertia: estimates by class, not flight-manual
 * figures. Fuel is a share of the authored mass (which is the aircraft with full tanks).
 */
function configureFlightRealism(id, spec, p) {
  const name = id.slice(id.lastIndexOf('.') + 1);
  const share =
    p.propulsion === 'helicopter'
      ? 0.14
      : p.propulsion === 'jet'
        ? p.afterburnerThrustN || spec.mass < 12000
          ? 0.28
          : 0.22
        : spec.mass < 2500
          ? 0.13
          : 0.17;
  spec.fuel = { capacity: Math.round(spec.mass * share) };
  if (spec.helicopter) spec.helicopter.rotorInertiaTime = ROTOR_INERTIA_TIME[name] ?? 2;
  if (spec.airplane) {
    if (TAILWHEEL.includes(name)) spec.airplane.tailwheel = true;
    else delete spec.airplane.tailwheel;
  }
}

/**
 * Greatest lift coefficient without a published stall speed, by class: estimates. Clean, and the
 * increment of the landing flaps.
 */
const CLASS_LIFT = {
  fighter: { clean: 1.6, flaps: 0.5 },
  transport: { clean: 1.45, flaps: 1.1 },
  light: { clean: 1.5, flaps: 0.6 },
};

/**
 * The wing's lift curve. Its slope follows from the aspect ratio (Helmbold's formula for a
 * finite wing); its greatest lift from the published stall speeds, which involve no thrust or
 * drag: at the stall the lift is the weight.
 */
function configureLiftCurve(spec, w, fit, kind) {
  const aspect = spec.span ** 2 / w.wingArea;
  w.liftSlope = round((2 * Math.PI * aspect) / (2 + Math.sqrt(4 + aspect * aspect)), 3);
  const liftAt = (card) =>
    (2 * (card.massKg ?? spec.mass) * G) /
    (SEA_LEVEL_DENSITY * w.wingArea * (card.value * KNOT) ** 2);
  const clean = fit['stall-clean']
    ? clamp(liftAt(fit['stall-clean']), 0.8, 2.4)
    : CLASS_LIFT[kind].clean;
  w.stallAngle = round(clean / w.liftSlope);
  w.flapLift = round(
    fit['stall-landing']
      ? clamp(liftAt(fit['stall-landing']) - clean, 0.1, 1.8)
      : CLASS_LIFT[kind].flaps,
    3,
  );
}

/** Steady roll as a helix angle, wingtip speed over airspeed, at full aileron: by class. */
const CLASS_ROLL_HELIX = { fighter: 0.09, transport: 0.05, light: 0.08 };

/**
 * Roll rate and roll damping. The steady rate is a published one where there is one; otherwise
 * the helix angle a wing of this class holds at full aileron, which makes a long wing roll
 * slowly. The damping is the wing's own: lift on the down-going half against the roll inertia.
 */
function configureRoll(spec, w, fit, kind) {
  const reference = w.controlAuthoritySpeed;
  const measured = fit['roll-rate'];
  w.rollAuthority = round(
    measured
      ? (measured.value * Math.PI) /
          180 /
          Math.min((measured.speedKt * KNOT) / reference, w.maxControlAuthority)
      : (CLASS_ROLL_HELIX[kind] * 2 * reference) / spec.span,
    3,
  );
  const inertia = w.rollInertia ?? spec.mass * (0.14 * spec.span) ** 2;
  w.rollResponse = round(
    (SEA_LEVEL_DENSITY * reference * w.wingArea * spec.span ** 2 * (w.liftSlope / 10)) /
      (4 * inertia),
    3,
  );
}

/**
 * Tail and fin sizes by class, as the volume coefficients of conceptual design, and the wing's
 * effective dihedral: estimates, not measurements of each type.
 *
 * margin: how far the center of mass sits ahead of the neutral point, in mean chords (a
 * fly-by-wire fighter is flown close to neutral). tail: tailplane area times its arm over wing
 * area times mean chord; the wing's lift then acts as far ahead of the center of mass as leaves
 * that margin. fin: fin area times its arm over wing area times span. body: the yaw moment
 * coefficient per radian of slip with which the fuselage works against the fin. side: the
 * whole airframe's side force coefficient per radian of slip. dihedral in radians, sweep's
 * share included.
 *
 * The fin and body are set so the net weathercock stability lands near what the Dutch roll
 * frequencies of NASA CR-2144 imply (C-5A 0.11, B-747 0.17, F-4C 0.12 per radian) and Nelson's
 * Navion has (0.07).
 */
const CLASS_TAIL = {
  fighter: { margin: 0.06, tail: 0.3, fin: 0.07, body: 0.05, side: 0.8, dihedral: 0.03, arm: 0.38 },
  transport: { margin: 0.2, tail: 1, fin: 0.085, body: 0.1, side: 0.85, dihedral: 0.1, arm: 0.47 },
  light: {
    margin: 0.15,
    tail: 0.6,
    fin: 0.045,
    body: 0.055,
    side: 0.45,
    dihedral: 0.09,
    arm: 0.47,
  },
};
/**
 * Roll radius of gyration as a share of the span, by class: 0.166 for the C-5A and 0.155 for
 * the B-747 of NASA CR-2144, 0.12 for its F-4C and F-104A, 0.105 for Nelson's Navion.
 */
const CLASS_ROLL_GYRATION = { fighter: 0.12, transport: 0.16, light: 0.1 };
/** Types whose pilots fly only through flight computers: direct control is not offered. */
const FLY_BY_WIRE = [
  'f_16b',
  'fa_18c',
  'f_22a',
  'f_35a',
  'typhoon',
  'rafale_c',
  'gripen_c',
  'airbus_a320neo',
  'a220_300',
  'embraer_e175',
  'c_17a',
  'a400m',
  'gulfstream_g650er',
];
/** Lift-curve slopes of a tailplane and a fin: low aspect ratio, per radian. */
const TAIL_LIFT_SLOPE = 3.3;
const FIN_LIFT_SLOPE = 2.8;

/**
 * The airplane's tailplane, fin and control surfaces, from which its handling in flight
 * follows. Sized by class from the wing and fuselage it has; the tailplane is set to trim the
 * anchor's cruise with the elevator neutral, and the ailerons to roll at the rate the roll
 * stage fixed.
 */
function configureSurfaces(id, spec, w, kind, engines, fit, cruise) {
  const name = id.slice(id.lastIndexOf('.') + 1);
  // Powered lift keeps its hover controls and the F-14 its empirical departure model.
  if (spec.poweredLift || name === 'f_14d') {
    delete w.surfaces;
    return;
  }
  const wire = FLY_BY_WIRE.includes(name);
  const tail = CLASS_TAIL[kind];
  const chord = w.wingArea / spec.span;
  const aspect = spec.span ** 2 / w.wingArea;
  const downwash = clamp((2 * w.liftSlope) / (Math.PI * aspect), 0.15, 0.6);
  const arm = tail.arm * spec.length;
  const margin = wire && kind === 'fighter' ? 0.03 : tail.margin;
  // Full aileron holds a steady roll where the outer panels' extra lift balances the damping
  // of all four: rate = 3 x lift x speed / (lift slope x span), at the true airspeed.
  const measured = fit['roll-rate'];
  let aileron;
  if (measured) {
    const sigma = sampleAtmosphere({}, measured.altitudeM ?? 0).densityKgM3 / 1.225;
    const equivalent = measured.speedKt * KNOT;
    const travel = Math.min(1, w.maxControlAuthority / (equivalent / w.controlAuthoritySpeed));
    aileron =
      (((measured.value * Math.PI) / 180) * w.liftSlope * spec.span) /
      (3 * (equivalent / Math.sqrt(sigma)) * travel);
  } else aileron = (w.rollAuthority * w.liftSlope * spec.span) / (3 * w.controlAuthoritySpeed);
  const propellers = engines.filter((e) => e.propellerDiameter !== undefined).length;
  // The tailplane moves the neutral point back by its volume times its share of the wing's
  // lift slope. A tail of the class's size leaves the wing's lift this far ahead of the center
  // of mass; a wing that needs more tail than that for its margin gets it, with its lift at
  // the center of mass.
  const perVolume = (TAIL_LIFT_SLOPE * (1 - downwash)) / w.liftSlope;
  const volume = Math.max(tail.tail, margin / perVolume);
  const liftArm = round((volume * perVolume - margin) * chord, 3);
  const tailArea = round((volume * w.wingArea * chord) / arm, 3);
  w.surfaces = {
    dihedral: tail.dihedral,
    aileron: round(aileron),
    liftArm,
    tailArm: round(arm, 3),
    tailArea,
    tailLiftSlope: TAIL_LIFT_SLOPE,
    // Set so the anchor's cruise trims with the elevator neutral.
    tailIncidence: round(
      (cruise.cl * w.wingArea * liftArm) / (TAIL_LIFT_SLOPE * tailArea * arm) +
        (downwash * cruise.cl) / w.liftSlope -
        cruise.alpha,
    ),
    downwash: round(downwash),
    elevator: 0.35,
    finArm: round(arm, 3),
    finHeight: round(0.08 * spec.length, 3),
    finArea: round((tail.fin * w.wingArea * spec.span) / arm, 3),
    finLiftSlope: FIN_LIFT_SLOPE,
    rudder: 0.35,
    bodyYaw: tail.body,
    sideForce: tail.side,
    ...(propellers > 0 ? { slipstream: propellers === 1 ? 0.7 : 0.25 } : {}),
    ...(wire ? { flyByWire: true } : {}),
  };
}

/** Height of the skids above the ground in a published in-ground-effect hover, m. */
export const SKID_HEIGHT = 0.75;

/** Blade loading (thrust coefficient over solidity) an unpublished tail rotor is sized to. */
const TAIL_LOADING = 0.13;

/** Flap hinge offset by the kind of hub, as a share of the radius, where none is published. */
const HUB_HINGE = { teetering: 0, articulated: 0.04, bearingless: 0.06, hingeless: 0.12 };

/**
 * Blade area of a tail rotor over its disc where the blades' chord is not published: a class
 * figure, and at least what holds the main rotor's torque at full power in the thinnest air the
 * engines still make it in, with the blades loaded as far as published tail rotors are there
 * (0.09 to 0.15 of thrust coefficient over solidity; a duct carries half).
 */
function tailSolidity(spec, fan, radius, tipSpeed, { torque, arm }) {
  const density = 1.225 * (spec.engine.ratedDensityRatio ?? 1);
  const coefficient =
    ((fan ? 0.5 : 1) * torque) / arm / (density * Math.PI * radius ** 2 * tipSpeed ** 2);
  return Math.max(fan ? 0.5 : 0.16, coefficient / TAIL_LOADING);
}

/**
 * A helicopter's rotors as built, from the geometry the trial ledger records for the type
 * (`data.rotor`), with class figures where a dimension is not published, and four figures
 * fitted to the type's own cards: the induced power factor to its hover ceiling, the ground's
 * cushion to its ceiling in ground effect, the fuselage's drag area to its cruise anchor, and
 * the blades' stall to its service ceiling. The tandem has no rotor block: its two rotors need
 * a mixer of their own, and it keeps the assisted model.
 */
function configureRotor(spec, fit, data, speed, ref) {
  const h = spec.helicopter;
  const published = data.rotor;
  if (!published || (h.rotorDiscs ?? 1) !== 1) return;
  const radius = h.rotorRadius;
  const disc = Math.PI * radius * radius;
  const tailRadius = published.tail.diameterM / 2;
  // Ten blades in a duct is a fan, not a tail rotor: most of its disc is blade.
  const fan = published.tail.blades >= 8;
  const turns = (rpm, at) => (rpm * Math.PI * at) / 30;
  const tailSpeed = published.tail.rpm ? turns(published.tail.rpm, tailRadius) : fan ? 180 : 200;
  const tailArm = published.tail.armM ?? radius + tailRadius + 0.15;
  const rotor = {
    blades: published.blades,
    chord: round(published.chordM ?? (0.075 * Math.PI * radius) / published.blades, 3),
    tipSpeed: round(turns(published.rpm, radius), 1),
    ...(published.rotation ? { rotation: published.rotation } : {}),
    shaftTilt: round(((published.shaftTiltDeg ?? 3) * Math.PI) / 180, 4),
    lock: round(published.lockNumber ?? 7, 2),
    hingeOffset: published.hingeOffset ?? HUB_HINGE[published.hub] ?? 0.04,
    collective: [0.02, 0.6],
    inducedFactor: 1.15,
    groundEffect: 0.12,
    maxLift: 1.2,
    dragArea: round(0.009 * disc, 3),
    tail: {
      radius: round(tailRadius, 4),
      blades: published.tail.blades,
      chord: round(
        published.tail.chordM ??
          (tailSolidity(spec, fan, tailRadius, tailSpeed, {
            torque: (spec.engine.power * radius) / turns(published.rpm, radius),
            arm: tailArm,
          }) *
            Math.PI *
            tailRadius) /
            published.tail.blades,
        4,
      ),
      tipSpeed: round(tailSpeed, 1),
      arm: round(tailArm, 3),
      height: round(published.tail.heightM ?? -0.4, 3),
    },
    ...(published.finAreaM2 ? { finArea: published.finAreaM2 } : {}),
    ...(published.stabilizerAreaM2 ? { stabilizerArea: published.stabilizerAreaM2 } : {}),
    ...(published.inertia
      ? {
          // Published at one weight; taken to scale with the mass.
          inertia: Object.fromEntries(
            ['roll', 'pitch', 'yaw'].map((axis) => [
              axis,
              round((published.inertia[axis] * spec.mass) / published.inertia.massKg, 0),
            ]),
          ),
        }
      : {}),
  };
  h.rotor = rotor;
  const variant = (card, change = {}) => ({
    ...spec,
    mass: card?.massKg ?? spec.mass,
    helicopter: { ...h, ...change.helicopter, rotor: { ...rotor, ...change.rotor } },
  });
  const free = fit['hover-ceiling-oge'];
  const near = fit['hover-ceiling-ige'];
  const hover = free ?? near;
  const skids = (card) => card.skidHeightM ?? SKID_HEIGHT;
  if (hover)
    // The hover ceiling is where the power to hold the weight meets the power there is: it
    // fixes how much more than the ideal the rotor's induced power is.
    rotor.inducedFactor = round(
      solve(
        1,
        1.8,
        -hover.value * 0.3048,
        (inducedFactor) =>
          -hoverCeiling(
            variant(hover, { rotor: { inducedFactor } }),
            free ? undefined : skids(hover),
          ),
        14,
      ),
      3,
    );
  if (free && near)
    rotor.groundEffect = round(
      solve(
        0,
        0.8,
        near.value * 0.3048,
        (groundEffect) => hoverCeiling(variant(near, { rotor: { groundEffect } }), skids(near)),
        12,
      ),
      3,
    );
  // The cruise anchor is flown at its share of the power: the drag area is what that pushes.
  const density = sampleAtmosphere({}, ref.altitudeM).densityKgM3;
  const cruise = rotorShaftPower(spec, density) * ref.throttle;
  rotor.dragArea = round(
    solve(
      0.05,
      0.05 * disc,
      cruise,
      (dragArea) =>
        rotorTrim(variant(undefined, { rotor: { dragArea } }), { density, speed })?.power ?? 0,
      24,
    ),
    3,
  );
  // The service ceiling, where the best climb is down to 100 ft/min, is the blades' limit
  // where the engines still have power to spare.
  const top = fit['service-ceiling'];
  if (top) {
    const ceiling = (maxLift) => {
      const flown = variant(top, { rotor: { maxLift } });
      const best = bestRotorClimb(flown, 0)?.speed ?? 30;
      let low = 0;
      let high = 9000;
      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2;
        if (rotorClimb(flown, best, mid).verticalSpeed >= 0.508) low = mid;
        else high = mid;
      }
      return (low + high) / 2;
    };
    const target = top.value * 0.3048;
    // Only where the blades are what stops it: with them unstallable it would climb higher.
    if (ceiling(2.2) > target * 1.01)
      rotor.maxLift = round(solve(0.5, 2.2, target, ceiling, 12), 3);
  }
  // The lever: bottomed at near flat pitch, hovering at half travel at sea level, with enough
  // above that for the highest hover and the best climb.
  const pitchAt = (flight, card) => rotorTrim(variant(card), flight)?.pitch ?? 0;
  const hoverPitch = pitchAt({ density: 1.225 });
  const climb = bestRotorClimb(spec, 0);
  const most = Math.max(
    hoverPitch,
    hover ? pitchAt({ density: sampleAtmosphere({}, hover.value * 0.3048).densityKgM3 }, hover) : 0,
    climb ? pitchAt({ density: 1.225, speed: climb.speed, climb: climb.verticalSpeed }) : 0,
  );
  rotor.collective = [0.02, round(Math.max(2 * hoverPitch - 0.02, 1.1 * most), 4)];
}

/** Propeller diameter in meters for a shaft power, where none is published (Raymer). */
const propellerDiameter = (powerW, blades = 3) =>
  (blades <= 2 ? 0.56 : blades === 3 ? 0.52 : 0.49) * Math.pow(powerW / 1000, 0.25);

/** Coefficients fit declared anchors in stages; the other trial cards check the result. */
export function tuneAircraftPerformance(id, spec) {
  configureEngineControls(id, spec);
  // Tailwheel layout does not imply fixed mains: both of these transports retract them.
  if (id.endsWith('.beech_18') || id.endsWith('.dc_3')) {
    delete spec.airplane.fixedGear;
    spec.airplane.gearTransitTime = 8;
    spec.airplane.gearDrag = 0.025;
  }
  const p = performanceProfiles.get(id);
  if (!p) throw Error(`Missing performance profile: ${id}`);
  configureFlightRealism(id, spec, p);
  const fit = aircraftFitCards(id);
  const data = aircraftTrialData(id);
  const speed = referenceSpeed(p),
    ref = p.reference;
  if (p.propulsion === 'helicopter') {
    const h = spec.helicopter;
    // The assisted model is fitted by itself first: its trials must not fly the rotor block a
    // previous calibration left in the document.
    delete h.rotor;
    h.vortexRing = true;
    // Its published never-exceed speed, or 1.13 times the cruise anchor.
    h.retreatingBladeSpeed = data.neverExceedKt
      ? round(data.neverExceedKt * KNOT, 3)
      : p.retreatingBladeSpeed;
    h.rotorDiscs = p.rotorDiscs;
    h.powerLimitedRotor = true;
    // Class estimates, replaced below where the type's hover ceilings are published. Set here
    // so a regenerated model does not inherit another helicopter's fitted figures.
    h.rotorEfficiency = 0.75;
    h.groundEffect = 0.12;
    h.profilePowerFraction = 0.12;
    // The blades' limit. A published service ceiling is where the rotor, at its best climb
    // speed, can no longer lift the weight the figure is quoted at with a little to spare:
    // thin air, not power, stops most helicopters there. Without one the type keeps the class
    // figure.
    h.liftMass = spec.mass;
    const top = fit['service-ceiling'];
    h.liftLimit = top
      ? round(
          clamp(
            (1.03 * ((top.massKg ?? spec.mass) / spec.mass)) /
              ((sampleAtmosphere({}, top.value * 0.3048).densityKgM3 / 1.225) *
                (1 + h.translationalLift)),
            1.15,
            h.liftMultiplier,
          ),
          3,
        )
      : h.liftMultiplier;
    // What reaches the rotor is the transmission's limit where that is below the engines'.
    spec.engine.power = data.rotorPowerW ?? p.shaftPowerW;
    // An engine that can make more than the transmission takes holds that limit as the air
    // thins, down to the density at which it has no more to give.
    spec.engine.ratedDensityRatio = data.enginePowerW
      ? round(clamp(spec.engine.power / data.enginePowerW, 0.5, 1), 3)
      : (p.ratedDensityRatio ?? (spec.engine.mixtureControl ? 1 : 0.7));
    spec.engine.densityExponent = 1;
    const free = fit['hover-ceiling-oge'];
    const near = fit['hover-ceiling-ige'];
    const hover = free ?? near;
    // Hover ceiling with a trial value of one rotor figure, at the weight the card states.
    const ceilingWith = (card, change, clearance) =>
      hoverCeiling(
        { ...spec, mass: card.massKg ?? spec.mass, helicopter: { ...h, ...change } },
        clearance,
      );
    if (hover) {
      // The hover ceiling is where the power to hold the weight meets the power there is: it
      // fixes how much of the shaft power the rotor turns into lift.
      h.rotorEfficiency = round(
        solve(
          0.45,
          0.95,
          hover.value * 0.3048,
          (rotorEfficiency) =>
            ceilingWith(
              hover,
              { rotorEfficiency },
              free ? undefined : (hover.skidHeightM ?? SKID_HEIGHT),
            ),
          10,
        ),
        3,
      );
    }
    if (free && near) {
      // Close to the ground the rotor needs less power; how much less is what separates the
      // two published hover ceilings.
      h.groundEffect = round(
        solve(
          0,
          0.8,
          near.value * 0.3048,
          (groundEffect) => ceilingWith(near, { groundEffect }, near.skidHeightM ?? SKID_HEIGHT),
          10,
        ),
        3,
      );
    }
    // At cruise the rotor's lift carries the weight and its forward tilt balances the drag.
    // The drag is what the power left over at the reference speed can push: the published
    // cruise is flown at the anchor's share of the power, not at an assumed attitude. The disc
    // tilt that goes with it is kept between 3 and 12 degrees.
    const sigma = sampleAtmosphere({}, ref.altitudeM).densityKgM3 / 1.225;
    const weight = spec.mass * 9.81;
    const disc = Math.PI * h.rotorRadius ** 2 * (h.rotorDiscs ?? 1);
    const hover2 = weight / (2 * 1.225 * sigma * disc);
    const half = speed ** 2 / 2;
    const induced = Math.sqrt(hover2 ** 2 / (Math.sqrt(half ** 2 + hover2 ** 2) + half));
    const available =
      spec.engine.power * Math.min(1, sigma / spec.engine.ratedDensityRatio) * ref.throttle;
    const spare =
      available -
      (weight * induced) / h.rotorEfficiency -
      spec.engine.power * h.profilePowerFraction * sigma;
    const degrees = Math.PI / 180;
    const drag = clamp(
      spare / speed,
      weight * Math.tan(3 * degrees),
      weight * Math.tan(12 * degrees),
    );
    h.horizontalDrag = (spec.mass * 0.016) / sigma;
    h.quadraticDrag = Math.max(0, (drag / (speed * sigma) - h.horizontalDrag) / speed);
    configureRotor(spec, fit, data, speed, ref);
    return spec;
  }
  const w = spec.airplane,
    engines = spec.engines ?? [spec.engine],
    fighter = !!p.afterburnerThrustN;
  const kind = fighter ? 'fighter' : spec.mass > 12000 ? 'transport' : 'light';
  // A fan engine with a published bypass ratio: thrust falls with speed, and the drag polar is
  // fixed by a lift-to-drag figure instead of being left to absorb the thrust's error.
  const fan = !fighter && p.propulsion === 'jet' && data.bypassRatio !== undefined;
  // With a lift-to-drag figure too, that figure fixes the drag polar and the anchor the thrust.
  const polar = fan && fit['glide-ratio'] !== undefined;
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
  // Stage 1: lift, from the stall speeds.
  configureLiftCurve(spec, w, fit, kind);
  w.flapDrag = fighter ? 0.065 : 0.075;
  if (id.endsWith('p51d')) w.flapDrag = 0.035;
  for (const e of engines) {
    e.propulsion = p.propulsion;
    e.densityExponent =
      p.propulsion === 'jet' ? 0.85 : e.mixtureControl ? PISTON_DENSITY_EXPONENT : 1;
    if (p.propulsion === 'jet') {
      e.dryThrust = p.dryThrustN;
      // Estimated upper-altitude engine deck: retain reference calibration, then lose net
      // thrust at least as fast as density. A multi-altitude engine deck can replace this fit.
      e.highAltitudeDensityRatio = sampleAtmosphere({}, ref.altitudeM).densityKgM3 / 1.225;
      e.highAltitudeExponent = 1.2;
      if (fan) {
        e.bypassRatio = data.bypassRatio;
        delete e.ramRise;
      } else {
        e.ramRise = fighter ? 0.2 : 0.15;
        delete e.bypassRatio;
      }
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
      // Thrust from the disc the propeller sweeps (momentum theory), which is what makes a
      // propeller pull less at climb speed than at cruise. The tiltrotor's proprotors keep the
      // constant-efficiency model: they are sized to hover.
      if (spec.poweredLift) {
        delete e.propellerDiameter;
        delete e.lowSpeedThrust;
        delete e.windmillDrag;
      } else {
        e.propellerDiameter = round(
          data.propellerDiameterM ?? propellerDiameter(p.shaftPowerW, data.propellerBlades),
          3,
        );
        // What the real blades lose when slow, by kind of propeller: estimates, replaced below
        // where a climb rate is published. All of it is back by the anchor's indicated speed.
        const turbine = p.ratedDensityRatio < 1 && !e.mixtureControl;
        e.lowSpeedThrust = {
          atRest: data.propeller === 'fixed-pitch' ? 0.6 : turbine ? 0.9 : 0.85,
          fullSpeed: round(
            speed * Math.sqrt(sampleAtmosphere({}, ref.altitudeM).densityKgM3 / 1.225),
            2,
          ),
        };
        e.windmillDrag = e.propellerControl || p.ratedDensityRatio < 1 ? 0.04 : 0.1;
      }
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
  if (id.endsWith('.ov_10')) {
    // A light-attack airframe, not a utility transport: estimated limits, not the T.O. chart.
    w.maxLoadFactor = 6;
    w.minLoadFactor = -3;
  }
  if (id.endsWith('.airliner')) {
    // This original template copied the Mustang's explicit inertias. Use the kernel's
    // mass-and-dimension estimates instead of a 4-ton fighter's values for a 42-ton twin.
    delete w.rollInertia;
    delete w.pitchInertia;
    delete w.yawInertia;
  }
  // The Mustang's inertias are authored; every other airframe gets its class's roll inertia,
  // and the kernel's estimates in pitch and yaw.
  if (!id.endsWith('.p51d'))
    w.rollInertia = round(spec.mass * (CLASS_ROLL_GYRATION[kind] * spec.span) ** 2, 0);
  configureRoll(spec, w, fit, kind);
  const throttle = referenceThrottle(p, spec);
  // Stage 2 and 3: drag and thrust, from the speed anchor.
  const point = trimPoint(spec, speed, ref.altitudeM, { power: throttle });
  if (!point) throw Error(`${id}: cannot trim reference condition`);
  const qS = 0.5 * sampleAtmosphere({}, ref.altitudeM).densityKgM3 * speed ** 2 * w.wingArea;
  if (fighter) {
    const shape = waveDragCoefficient({ ...w, waveDrag: 1 }, point.mach);
    const fitWave = () => {
      const at = trimPoint(spec, speed, ref.altitudeM, { power: throttle });
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
  } else if (polar) {
    // The best lift-to-drag ratio fixes the profile drag (induced drag is the wing's span),
    // with the drag rise starting just below the cruise Mach number. The anchor then fixes
    // how much thrust is left at altitude, which is the only thing still free.
    const best = fit['glide-ratio'].value;
    w.criticalMach = round(point.mach - 0.02, 3);
    w.profileDrag = round(1 / (4 * w.inducedDrag * best * best), 5);
    const excess = (exponent) => {
      for (const e of engines) e.densityExponent = exponent;
      return trimPoint(spec, speed, ref.altitudeM, { power: throttle }).excessThrust;
    };
    if (excess(0.4) < 0) throw Error(`${id}: too little thrust for the reference at any lapse`);
    if (excess(1.8) > 0) throw Error(`${id}: too much thrust for the reference at any lapse`);
    // Excess thrust falls as the exponent grows; solve for none.
    const exponent = round(
      solve(0.4, 1.8, 0, (x) => -excess(x)),
      4,
    );
    for (const e of engines) e.densityExponent = exponent;
  } else {
    w.profileDrag += point.excessThrust / qS;
    if (w.profileDrag < 0.004) {
      // A slower subsonic wing begins compressibility rise later than the class default.
      w.criticalMach = Math.max(w.criticalMach, point.mach - 0.015);
      const at = trimPoint(spec, speed, ref.altitudeM, { power: throttle });
      w.profileDrag += at.excessThrust / qS;
    }
    if (w.profileDrag < 0.004 || w.profileDrag > (spec.poweredLift ? 0.3 : 0.15))
      throw Error(`${id}: implausible fitted CD0 ${w.profileDrag}`);
    const climb = fit['climb-rate'];
    if (climb && engines[0].lowSpeedThrust) {
      // Stage 3: the published rate of climb fixes how much of its thrust the propeller keeps
      // when slow. The anchor is flown at or above the speed where all of it is back, so the
      // drag just fitted stands.
      const loaded = atMass(spec, climb.massKg);
      const atRest = round(
        solve(
          0.45,
          1,
          climb.value / 196.8504,
          (share) => {
            for (const e of engines) e.lowSpeedThrust = { ...e.lowSpeedThrust, atRest: share };
            return bestSteadyClimb(loaded, climb.altitudeM ?? 0)?.rate ?? 0;
          },
          10,
        ),
        3,
      );
      for (const e of engines) e.lowSpeedThrust = { ...e.lowSpeedThrust, atRest };
    }
    const glide = fit['glide-ratio'];
    if (glide && engines[0].propellerDiameter !== undefined) {
      // A published power-off glide is steeper than the airframe's own by the drag of the
      // idling propellers: that difference is theirs.
      const loaded = atMass(spec, glide.massKg);
      const windmill = round(
        solve(
          0,
          0.6,
          -glide.value,
          (drag) => {
            for (const e of engines) e.windmillDrag = drag;
            return -(steadyGlide(loaded, 0)?.ratio ?? 0);
          },
          12,
        ),
        3,
      );
      for (const e of engines) e.windmillDrag = windmill;
    }
  }
  configureSurfaces(
    id,
    spec,
    w,
    kind,
    engines,
    fit,
    trimPoint(spec, speed, ref.altitudeM, { power: throttle }),
  );
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
