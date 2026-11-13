import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  AircraftState,
  aircraftFuelFlow,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  installAircraft,
  refuelAircraft,
  stepAircraft,
} from '../src/aircraft';
import type { TransformData } from '../src/component';
import { vehicleRotation } from '../src/vehicles';
import { World } from '../src/world';
import { molenAircraft } from './helpers/entities';

const mustang = molenAircraft('molen.entities.aircraft.p51d').spec;
const viper = molenAircraft('molen.entities.aircraft.f_16b').spec;
const cayuse = molenAircraft('molen.entities.aircraft.oh6').spec;
if (!mustang.airplane || !viper.airplane || !cayuse.helicopter) throw new Error('Missing physics');
const flat = { groundHeight: () => 0 };
const clean: AircraftInputData = {
  ...IDLE_AIRCRAFT_INPUT,
  engine: true,
  power: 1,
  brake: false,
  gear: false,
};
type Flight = { transform: TransformData; state: AircraftStateData };
function airborne(overrides: Partial<AircraftStateData> = {}, height = 1000): Flight {
  const state = {
    ...initialAircraftState(),
    grounded: false,
    rpm: 1,
    velocity: [0, 0, 60] as [number, number, number],
    ...overrides,
  };
  return {
    transform: { pos: [0, height, 0], rot: vehicleRotation(state.yaw, -state.pitch, state.roll) },
    state,
  };
}
function fly(
  seconds: number,
  controls: (state: AircraftStateData, seconds: number) => AircraftInputData,
  start: Flight,
  spec: AircraftSpec,
  watch: (flight: Flight, seconds: number) => void = () => {},
): Flight {
  let result = start;
  for (let i = 0; i < seconds * 60; i++) {
    result = stepAircraft(
      result.transform,
      result.state,
      controls(result.state, i / 60),
      spec,
      1 / 60,
      flat,
    );
    watch(result, (i + 1) / 60);
  }
  return result;
}
/** An airplane variant with some of its airplane tuning replaced. */
const airplaneWith = (spec: AircraftSpec, changes: Partial<AircraftSpec['airplane']>) =>
  ({ ...spec, airplane: { ...spec.airplane, ...changes } }) as AircraftSpec;

describe('landing gear', () => {
  const nosewheel = airplaneWith(mustang, { tailwheel: false, propellerEffects: 0 });
  const tailwheel = airplaneWith(mustang, { tailwheel: true, propellerEffects: 0 });
  /**
   * Gear down, power off, flared (the wing carrying most of the weight) and descending at
   * `sink` m/s onto the runway a moment later.
   */
  const arrival = (sink: number, pitch = 0.1, height = 0.4): Flight =>
    airborne(
      { velocity: [0, -sink, 48], gearPosition: 1, flapPosition: 0, pitch, rpm: 0.3 },
      height,
    );
  const landing: AircraftInputData = { ...clean, power: 0, gear: true };
  function touchdown(spec: AircraftSpec, sink: number, pitch?: number, height?: number) {
    let landed = Infinity;
    let hop = 0;
    let kick = 0;
    let before = 0;
    const end = fly(
      5,
      () => landing,
      arrival(sink, pitch, height),
      spec,
      (flight, time) => {
        // The wheels touch inside a step: the descent stops (or reverses) from one to the next.
        if (landed === Infinity && (flight.state.grounded || flight.state.velocity[1] > -0.3)) {
          landed = time;
          kick = flight.state.pitchRate - before;
        }
        before = flight.state.pitchRate;
        if (time > landed) hop = Math.max(hop, flight.state.altitudeAGL);
      },
    );
    return { end, hop, kick, landed };
  }

  it('skips back into the air after a firm touchdown and stays down after a gentle one', () => {
    const firm = touchdown(nosewheel, 3);
    expect(firm.landed).toBeLessThan(1);
    // Observed about 0.2 m: a visible skip, not a crash.
    expect(firm.hop).toBeGreaterThan(0.08);
    expect(firm.hop).toBeLessThan(2);
    expect(firm.end.state.crashed).toBe(false);
    expect(firm.end.state.grounded).toBe(true);
    // Set down from a hand's breadth at 0.4 m/s, the wheels stay on the runway.
    const gentle = touchdown(nosewheel, 0.4, undefined, 0.02);
    expect(gentle.hop).toBe(0);
    // No rebound at all without spring in the gear.
    expect(touchdown(airplaneWith(nosewheel, { gearRebound: 0 }), 3).hop).toBe(0);
    // Beyond the hard-landing speed it is damage, not a bounce.
    expect(touchdown(nosewheel, mustang.hardLandingSpeed + 1).end.state.crashed).toBe(true);
  });

  it('pitches a taildragger up off its main wheels, and a nosewheel airplane down onto its nose', () => {
    const tail = touchdown(tailwheel, 2.5);
    const nose = touchdown(nosewheel, 2.5);
    expect(tail.kick).toBeGreaterThan(0.1);
    expect(nose.kick).toBeLessThan(-0.03);
    // The taildragger's nose rises into more lift: it bounces higher.
    expect(tail.hop).toBeGreaterThan(nose.hop);
    // Three-point, tail already down, there is nothing left to pitch.
    const settled = touchdown(tailwheel, 2.5, mustang.airplane?.maxGroundPitch);
    expect(settled.kick).toBeLessThan(tail.kick);
  });

  it('brakes by the weight on the wheels, and tips forward on its struts while braking', () => {
    const rolling = (speed: number): Flight => ({
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      state: {
        ...initialAircraftState(),
        velocity: [0, 0, speed],
        gearPosition: 1,
        flapPosition: 0,
      },
    });
    const idle: AircraftInputData = { ...clean, power: 0, engine: false, gear: true };
    /** Speed the brakes alone take off in half a second. */
    const braking = (speed: number): number =>
      fly(0.5, () => idle, rolling(speed), nosewheel).state.velocity[2] -
      fly(0.5, () => ({ ...idle, brake: true }), rolling(speed), nosewheel).state.velocity[2];
    // At 80 m/s the wing carries about half the weight even at its ground attitude; at
    // 15 m/s the tires carry nearly all of it.
    expect(braking(15)).toBeGreaterThan(braking(80) * 1.3);
    const dipped = (spec: AircraftSpec): number =>
      fly(1.5, () => ({ ...idle, brake: true }), rolling(30), spec).state.pitch;
    expect(dipped(nosewheel)).toBeLessThan(-0.005);
    // A taildragger's tail comes up further.
    expect(dipped(tailwheel)).toBeLessThan(dipped(nosewheel) - 0.01);
    expect(fly(1.5, () => idle, rolling(30), nosewheel).state.pitch).toBeGreaterThan(-0.005);
  });
});

describe('helicopter autorotation', () => {
  const engineOut = (collective: number): AircraftInputData => ({
    ...clean,
    engine: false,
    power: collective,
  });
  const cruise = (): Flight => airborne({ velocity: [0, 0, 28] }, 800);

  it('keeps the rotor turning in a descent with the collective down, and loses it with the collective up', () => {
    let fastest = 0;
    const lowered = fly(
      8,
      () => engineOut(0.05),
      cruise(),
      cayuse,
      (flight) => {
        fastest = Math.max(fastest, -flight.state.verticalSpeed);
      },
    );
    // The air rising through the disc drives the rotor: still near full speed after 8 s.
    expect(lowered.state.rpm).toBeGreaterThan(0.85);
    expect(lowered.state.grounded).toBe(false);
    expect(fastest).toBeGreaterThan(6);
    // Holding cruise collective instead spends a third of the rotor's speed in a few seconds.
    const held = fly(4, () => engineOut(0.55), cruise(), cayuse);
    expect(held.state.rpm).toBeLessThan(0.7);
    expect(held.state.rpm).toBeLessThan(lowered.state.rpm - 0.25);
    // On the ground the rotor still runs down as before.
    const parked: Flight = {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      state: { ...initialAircraftState(), rpm: 1 },
    };
    expect(fly(12, () => engineOut(0), parked, cayuse).state.rpm).toBe(0);
  });

  it('trades rotor speed for a cushion when the collective is pulled at the bottom', () => {
    const descending = fly(8, () => engineOut(0.05), cruise(), cayuse);
    const sinking = descending.state.verticalSpeed;
    expect(sinking).toBeLessThan(-6);
    const flared = fly(1.2, () => engineOut(0.9), descending, cayuse);
    // The pull arrests most of the descent, and costs rotor speed.
    expect(flared.state.verticalSpeed).toBeGreaterThan(sinking + 4);
    expect(flared.state.rpm).toBeLessThan(descending.state.rpm - 0.05);
    // Left alone instead, it keeps coming down.
    expect(fly(1.2, () => engineOut(0.05), descending, cayuse).state.verticalSpeed).toBeLessThan(
      flared.state.verticalSpeed - 3,
    );
  });

  it('forgives a late pull more with a heavier rotor, and restarts under power', () => {
    const rotor = (seconds: number): AircraftSpec =>
      ({
        ...cayuse,
        helicopter: { ...cayuse.helicopter, rotorInertiaTime: seconds },
      }) as AircraftSpec;
    const after = (spec: AircraftSpec): number =>
      fly(2, () => engineOut(0.6), cruise(), spec).state.rpm;
    expect(after(rotor(4))).toBeGreaterThan(after(rotor(1)) + 0.1);
    const dropped = fly(2, () => engineOut(0.6), cruise(), cayuse);
    const restarted = fly(8, () => ({ ...clean, power: 0.4 }), dropped, cayuse);
    expect(restarted.state.rpm).toBeGreaterThan(dropped.state.rpm);
    expect(restarted.state.rpm).toBeGreaterThan(0.95);
  });
});

describe('fuel and weight', () => {
  const fueled = (spec: AircraftSpec, capacity: number): AircraftSpec => ({
    ...spec,
    fuel: { capacity },
  });

  it('burns fuel by the power in use and leaves an aircraft without tanks alone', () => {
    const tanked = fueled(mustang, 700);
    const full = fly(30, () => clean, airborne(), tanked).state.fuel ?? 0;
    const idle = fly(30, () => ({ ...clean, power: 0.2 }), airborne(), tanked).state.fuel ?? 0;
    // A Merlin at full power drinks roughly a tenth of a kilogram a second.
    expect(700 - full).toBeGreaterThan(1.5);
    expect(700 - full).toBeLessThan(8);
    expect(700 - idle).toBeLessThan((700 - full) * 0.5);
    expect(700 - idle).toBeGreaterThan(0);
    // The shipped Mustang carries about 700 kg; without tanks declared there is no fuel state.
    expect(mustang.fuel?.capacity).toBeGreaterThan(500);
    const tankless: AircraftSpec = { ...mustang };
    delete tankless.fuel;
    expect(fly(1, () => clean, airborne(), tankless).state.fuel).toBeUndefined();
  });

  it('burns several times more in reheat than at military power', () => {
    const tanked = fueled(viper, 3000);
    const used = (power: number): number =>
      3000 -
      (fly(10, () => ({ ...clean, power }), airborne({ velocity: [0, 0, 220] }, 3000), tanked).state
        .fuel ?? 0);
    expect(used(1)).toBeGreaterThan(used(0.85) * 2.5);
    const engine = viper.engine ?? viper.engines?.[0];
    if (!engine) throw new Error('Missing engine');
    // Per newton, the lit afterburner costs between two and three times dry thrust.
    const state = { rpm: 1, rotorAngle: 0, failed: false, thrust: 100_000 };
    const ratio =
      aircraftFuelFlow(engine, { ...state, afterburner: 1 }) / aircraftFuelFlow(engine, state);
    expect(ratio).toBeGreaterThan(2);
    expect(ratio).toBeLessThan(3.5);
  });

  it('flies lighter on empty tanks, and the engine stops when they run dry', () => {
    const tanked = fueled(mustang, 700);
    const once = (fuel: number): AircraftStateData =>
      stepAircraft(
        airborne({ pitch: 0.05 }).transform,
        { ...airborne({ pitch: 0.05 }).state, fuel },
        clean,
        tanked,
        1 / 60,
        flat,
      ).state;
    // The same wing and angle of attack carry a lighter airplane harder.
    expect(once(20).loadFactor ?? 0).toBeGreaterThan((once(700).loadFactor ?? 0) * 1.1);
    const dry = fly(
      8,
      () => clean,
      { ...airborne(), state: { ...airborne().state, fuel: 0.05 } },
      tanked,
    );
    expect(dry.state.fuel).toBe(0);
    expect(dry.state.engines?.main?.thrust).toBe(0);
    expect(dry.state.engines?.main?.combustion).toBe(0);
    expect(dry.state.rpm).toBeLessThan(0.5);
  });

  it('burns less in a helicopter at low collective', () => {
    const tanked = fueled(cayuse, 180);
    const used = (collective: number): number =>
      180 -
      (fly(20, () => ({ ...clean, power: collective }), airborne({ velocity: [0, 0, 20] }), tanked)
        .state.fuel ?? 0);
    expect(used(0.8)).toBeGreaterThan(used(0.2) * 1.5);
    expect(used(0.2)).toBeGreaterThan(0);
  });
});

describe('buffet and the pilot under g', () => {
  it('buffets a few degrees before the stall, fully in it, and not in cruise or on the ground', () => {
    const stall = mustang.airplane?.stallAngle ?? 0;
    const camber = mustang.airplane?.camberAngle ?? 0;
    const at = (alpha: number, extra: Partial<AircraftStateData> = {}): AircraftStateData =>
      stepAircraft(
        airborne({ pitch: alpha - camber, ...extra }).transform,
        airborne({ pitch: alpha - camber, ...extra }).state,
        clean,
        mustang,
        1 / 120,
        flat,
      ).state;
    expect(at(0.04).buffet).toBe(0);
    const warning = at(stall - 0.03);
    expect(warning.stalled).toBe(false);
    expect(warning.buffet ?? 0).toBeGreaterThan(0.2);
    expect(warning.buffet ?? 0).toBeLessThan(0.9);
    expect(at(stall + 0.1).buffet ?? 0).toBeGreaterThan(0.95);
    // Too slow for the air to shake anything.
    expect(at(stall + 0.1, { velocity: [0, 0, 6] }).buffet ?? 0).toBeLessThan(0.1);
    const parked = stepAircraft(
      { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      { ...initialAircraftState(), velocity: [0, 0, 20] },
      clean,
      mustang,
      1 / 60,
      flat,
    ).state;
    expect(parked.buffet).toBe(0);
  });

  it('dims the pilot under sustained g, later with a g-suit, and recovers when it is unloaded', () => {
    const pull = (state: AircraftStateData, seconds: number): AircraftInputData => ({
      ...clean,
      pitch: seconds < 6 ? 1 : 0,
      roll: Math.max(-1, Math.min(1, -state.roll * 2 - state.rollRate * 0.5)),
    });
    let peakG = 0;
    let strained = 0;
    const end = fly(14, pull, airborne({ velocity: [0, 0, 300] }, 3000), viper, (flight, time) => {
      peakG = Math.max(peakG, flight.state.loadFactor ?? 0);
      if (time <= 6) strained = Math.max(strained, flight.state.greyout ?? 0);
    });
    // A fighter holds 9 g, more than its pilot's 6.5 g tolerance: vision starts to dim after
    // about three seconds and is mostly gone after six (observed 0.64).
    expect(peakG).toBeGreaterThan(8.5);
    expect(strained).toBeGreaterThan(0.4);
    expect(strained).toBeLessThan(0.9);
    expect(end.state.greyout).toBe(0);
    // Without the g-suit the same pull costs more.
    let unprotected = 0;
    fly(
      6,
      pull,
      airborne({ velocity: [0, 0, 300] }, 3000),
      airplaneWith(viper, { pilotGTolerance: 4.5 }),
      (flight) => {
        unprotected = Math.max(unprotected, flight.state.greyout ?? 0);
      },
    );
    expect(unprotected).toBeGreaterThan(strained * 1.3);
    // Level flight never strains anyone.
    expect(fly(5, () => clean, airborne(), mustang).state.greyout).toBe(0);
  });

  it('reddens the view under sustained negative g', () => {
    let red = 0;
    let lowest = 0;
    fly(
      5,
      (state) => ({
        ...clean,
        pitch: -1,
        roll: Math.max(-1, Math.min(1, -state.roll * 2 - state.rollRate * 0.5)),
      }),
      airborne({ velocity: [0, 0, 220] }, 6000),
      viper,
      (flight) => {
        red = Math.max(red, flight.state.redout ?? 0);
        lowest = Math.min(lowest, flight.state.loadFactor ?? 0);
      },
    );
    expect(lowest).toBeLessThan(-2);
    expect(red).toBeGreaterThan(0.15);
  });
});

describe('refuelling', () => {
  it('fills a parked aircraft and refuses one in flight or with its engine turning', () => {
    const world = new World({ tickRate: 60 });
    installAircraft(world, flat);
    const spawn = (id: string, state: AircraftStateData, height: number) =>
      world.spawnRaw(
        {
          transform: { pos: [0, height, 0], rot: [0, 0, 0, 1] },
          aircraft: molenAircraft('molen.entities.aircraft.p51d'),
          aircraftState: state,
        },
        id,
      );
    spawn('parked', { ...initialAircraftState(), fuel: 12 }, 0);
    spawn('flying', { ...airborne().state, fuel: 12 }, 1000);
    spawn('running', { ...initialAircraftState(), rpm: 0.6, fuel: 12 }, 0);
    expect(refuelAircraft(world, 'parked')).toBe(true);
    expect(world.get('parked', AircraftState)?.fuel).toBe(mustang.fuel?.capacity);
    expect(refuelAircraft(world, 'flying')).toBe(false);
    expect(refuelAircraft(world, 'running')).toBe(false);
    expect(world.get('flying', AircraftState)?.fuel).toBe(12);
    expect(refuelAircraft(world, 'nobody')).toBe(false);
  });
});
