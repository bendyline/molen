import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  type AircraftEnvironment,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  mainRotorBlades,
  rotorShaftPower,
  rotorTrim,
  sampleAtmosphere,
  stepAircraft,
} from '../src/aircraft';
import type { TransformData } from '../src/component';
import {
  discTilt,
  inducedVelocityRatio,
  type RotorBlades,
  rotorLoads,
  rotorPitchFor,
} from '../src/dynamics/rotor';
import { molenAircraft } from './helpers/entities';

const cayuse = molenAircraft('molen.entities.aircraft.oh6').spec;
const raven = molenAircraft('molen.entities.aircraft.robinson_r44').spec;
const chinook = molenAircraft('molen.entities.aircraft.ch_47f').spec;
if (!cayuse.helicopter?.rotor || !raven.helicopter?.rotor) throw new Error('No rotor');
const helicopter = cayuse.helicopter;
const rotor = cayuse.helicopter.rotor;
const G = 9.81;
const blades: RotorBlades = mainRotorBlades(helicopter, rotor);
const disc = Math.PI * blades.radius ** 2;
/** Induced velocity of the hover at the OH-6's weight, m/s. */
const hoverInflow = Math.sqrt((cayuse.mass * G) / (2 * 1.225 * disc));

type Flight = { transform: TransformData; state: AircraftStateData };
const flat: AircraftEnvironment = { groundHeight: () => 0 };
const running: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT, engine: true, brake: false };
const hovering = (altitude = 60, speed = 0): Flight => ({
  transform: { pos: [0, altitude, 0], rot: [0, 0, 0, 1] },
  state: { ...initialAircraftState(), grounded: false, rpm: 1, velocity: [0, 0, speed] },
});
function fly(
  spec: AircraftSpec,
  seconds: number,
  controls: (state: AircraftStateData, time: number, transform: TransformData) => AircraftInputData,
  start: Flight = hovering(),
  watch: (flight: Flight, time: number) => void = () => {},
  env: AircraftEnvironment = flat,
  hz = 60,
): Flight {
  let flight = start;
  for (let tick = 0; tick < seconds * hz; tick++) {
    flight = stepAircraft(
      flight.transform,
      flight.state,
      controls(flight.state, tick / hz, flight.transform),
      spec,
      1 / hz,
      env,
    );
    watch(flight, (tick + 1) / hz);
  }
  return flight;
}
/** Where steady flight puts the collective lever. */
const lever = (spec: AircraftSpec, flight: Parameters<typeof rotorTrim>[1]): number =>
  rotorTrim(spec, flight)?.lever ?? 0;
/** A hand on the collective holding a height. */
const holding =
  (spec: AircraftSpec, height: number, extra: Partial<AircraftInputData> = {}) =>
  (state: AircraftStateData, _time: number, transform: TransformData): AircraftInputData => ({
    ...running,
    ...extra,
    power: Math.max(
      0,
      Math.min(
        1,
        lever(spec, { density: 1.225 }) +
          (height - transform.pos[1]) * 0.01 -
          state.verticalSpeed * 0.05,
      ),
    ),
  });

describe('a rotor', () => {
  const hover = { density: 1.225, speed: 1, axial: 0, edgewise: 0, inflow: hoverInflow };
  const pitch = rotorPitchFor(blades, hover, cayuse.mass * G);

  it('carries the weight at a blade pitch of nine or ten degrees, for about two thirds more than the ideal power', () => {
    expect(pitch).toBeGreaterThan(0.13);
    expect(pitch).toBeLessThan(0.2);
    const loads = rotorLoads(blades, { ...hover, pitch });
    expect(loads.thrust).toBeCloseTo(cayuse.mass * G, 0);
    // The ideal: the weight times the air it must move.
    const ideal = cayuse.mass * G * hoverInflow;
    expect(ideal / loads.power).toBeGreaterThan(0.55);
    expect(ideal / loads.power).toBeLessThan(0.85);
    // Left alone, the air it pulls settles at the hover value.
    expect(loads.inflowTarget).toBeCloseTo(hoverInflow, 1);
    expect(loads.stall).toBe(0);
  });

  it('makes more thrust with more pitch, less with more air coming down through it, none standing still', () => {
    const at = (change: Partial<typeof hover> & { pitch?: number }) =>
      rotorLoads(blades, { ...hover, pitch, ...change }).thrust;
    expect(at({ pitch: pitch + 0.02 })).toBeGreaterThan(1.15 * at({}));
    expect(at({ inflow: hoverInflow + 2 })).toBeLessThan(0.9 * at({}));
    // Climbing is more air through the disc; descending, less.
    expect(at({ axial: 3 })).toBeLessThan(at({}));
    expect(at({ axial: -3 })).toBeGreaterThan(at({}));
    // Thrust goes with the square of the rotor's speed.
    expect(at({ speed: 0.9, inflow: 0.9 * hoverInflow }) / at({})).toBeCloseTo(0.81, 1);
    expect(rotorLoads(blades, { ...hover, pitch, speed: 0 }).thrust).toBe(0);
  });

  it('stalls its blades at a mean lift they cannot pass, sooner in fast flight', () => {
    const most = (edgewise: number): number =>
      rotorLoads(blades, { ...hover, pitch: 0.6, edgewise, inflow: 4 }).thrust;
    const limit = (blades.solidity * blades.maxLift) / 6;
    const scale = 1.225 * disc * blades.tipSpeed ** 2;
    expect(most(0) / scale).toBeGreaterThan(0.8 * limit);
    expect(most(0) / scale).toBeLessThan(1.001 * limit);
    expect(rotorLoads(blades, { ...hover, pitch: 0.6, inflow: 4 }).stall).toBe(1);
    // At a third of tip speed the retreating blade has much less air to work in.
    expect(most(blades.tipSpeed / 3)).toBeLessThan(0.85 * most(0));
  });

  it('is turned by the air in a descent', () => {
    // Blades near flat pitch, the helicopter coming down at 9 m/s and 31 m/s forward.
    const down = rotorLoads(blades, {
      density: 1.225,
      speed: 1,
      pitch: 0.045,
      axial: -9,
      edgewise: 31,
      inflow: 2.9,
    });
    expect(down.thrust).toBeGreaterThan(0.7 * cayuse.mass * G);
    expect(down.power).toBeLessThan(0);
  });

  it('moves the air momentum theory says, and the measured curve where it has no answer', () => {
    expect(inducedVelocityRatio(0, 0)).toBeCloseTo(1, 6);
    // Climbing at the hover value: the golden ratio's smaller part.
    expect(inducedVelocityRatio(1, 0)).toBeCloseTo((Math.sqrt(5) - 1) / 2, 4);
    // Fast and level, it is one over the speed.
    expect(inducedVelocityRatio(0, 5)).toBeCloseTo(1 / 5, 2);
    // Sinking slowly into its own wake the flow through it builds up...
    expect(inducedVelocityRatio(-1, 0)).toBeGreaterThan(1.5);
    // ...and the curve meets the windmill state where momentum theory takes over again.
    expect(
      Math.abs(inducedVelocityRatio(-1.999, 0) - inducedVelocityRatio(-2.001, 0)),
    ).toBeLessThan(0.08);
    expect(inducedVelocityRatio(-3, 0)).toBeCloseTo(1.5 - Math.sqrt(1.25), 4);
  });

  it('flaps back from the air it flies into, toward its advancing side, and follows its shaft late', () => {
    const tilt = (edgewise: number) => {
      const loads = rotorLoads(blades, { ...hover, pitch, edgewise });
      return discTilt(blades, loads, pitch, hoverInflow / blades.tipSpeed, 5, 49);
    };
    expect(tilt(0).back).toBe(0);
    expect(tilt(0).aside).toBe(0);
    const slow = tilt(10);
    const fast = tilt(50);
    expect(slow.back).toBeGreaterThan(0.005);
    expect(fast.back).toBeGreaterThan(3 * slow.back);
    expect(fast.back).toBeLessThan(0.2);
    // The sideways tilt is strongest in slow flight, relative to the flapback.
    expect(slow.aside / slow.back).toBeGreaterThan(fast.aside / fast.back);
    expect(slow.aside).toBeGreaterThan(0);
    // Heavier blades (a lower Lock number) follow a turning shaft later.
    const loads = rotorLoads(blades, { ...hover, pitch });
    const lag = (lock: number): number => discTilt(blades, loads, pitch, 0.05, lock, 49).lag;
    expect(lag(5)).toBeCloseTo(16 / (5 * 49), 9);
    expect(lag(4)).toBeGreaterThan(lag(8));
    expect(tilt(0).coning).toBeGreaterThan(0.01);
  });
});

describe('steady flight on the rotor', () => {
  const sea = { density: 1.225 };
  const power = (flight: Parameters<typeof rotorTrim>[1], spec = cayuse): number =>
    rotorTrim(spec, flight)?.power ?? Number.NaN;

  it('takes most of its power to hover, least near 60 knots, and all of it flat out', () => {
    const available = rotorShaftPower(cayuse, 1.225);
    expect(power(sea)).toBeGreaterThan(0.75 * available);
    expect(power(sea)).toBeLessThan(available);
    expect(power({ ...sea, speed: 31 })).toBeLessThan(0.6 * power(sea));
    expect(power({ ...sea, speed: 31 })).toBeLessThan(power({ ...sea, speed: 15 }));
    expect(power({ ...sea, speed: 60 })).toBeGreaterThan(power({ ...sea, speed: 31 }));
    // Its top speed is where the two meet: near 130 knots.
    expect(power({ ...sea, speed: 60 })).toBeLessThan(available);
    expect(power({ ...sea, speed: 75 })).toBeGreaterThan(available);
  });

  it('hovers on less power near the ground and more in thin air', () => {
    expect(power({ ...sea, clearance: 0.75 })).toBeLessThan(0.9 * power(sea));
    expect(power({ ...sea, clearance: 2 * helicopter.rotorRadius })).toBeCloseTo(power(sea), 6);
    const thin = sampleAtmosphere({}, 2500).densityKgM3;
    expect(power({ density: thin })).toBeGreaterThan(1.05 * power(sea));
    // Heavier takes more than in proportion.
    expect(power({ ...sea, mass: 1.2 * cayuse.mass }) / power(sea)).toBeGreaterThan(1.22);
  });

  it('comes down in autorotation at about 1,600 ft/min, with the lever near the bottom', () => {
    const glide = (climb: number) => rotorTrim(cayuse, { ...sea, speed: 31, climb });
    expect(glide(-6)?.power).toBeGreaterThan(0);
    expect(glide(-10)?.power).toBeLessThan(0);
    const steady = glide(-8);
    expect(steady?.lever).toBeGreaterThan(0);
    expect(steady?.lever).toBeLessThan(0.2);
    expect(steady?.stalled).toBe(false);
  });

  it('holds the torque with more tail rotor in the hover than in cruise', () => {
    const hover = rotorTrim(cayuse, sea);
    const cruise = rotorTrim(cayuse, { ...sea, speed: 45 });
    if (!hover || !cruise) throw new Error('No trim');
    expect(hover.tailPitch).toBeGreaterThan(0.15);
    expect(hover.tailPitch).toBeGreaterThan(1.5 * cruise.tailPitch);
    expect(hover.pedals).toBe(true);
    // A tandem has no rotor block: it flies on the assisted model.
    expect(chinook.helicopter?.rotor).toBeUndefined();
    expect(rotorTrim(chinook, sea)).toBeUndefined();
  });
});

describe('a helicopter on its rotors', () => {
  it('hovers hands-off with the assist: nose up, left skid low, holding its place and its heading', () => {
    const end = fly(cayuse, 12, holding(cayuse, 60));
    expect(end.state.crashed).toBe(false);
    // A rotor turning counterclockwise twists the fuselage right; the tail rotor that holds
    // it pushes the helicopter to the right too, and it leans left against that.
    expect(end.state.roll).toBeLessThan(-0.02);
    expect(end.state.roll).toBeGreaterThan(-0.1);
    // It hangs under a shaft that is tilted forward.
    expect(end.state.pitch).toBeGreaterThan(0.03);
    expect(end.state.pitch).toBeLessThan(0.15);
    // The assist's hands hold it over the spot.
    expect(Math.hypot(end.transform.pos[0], end.transform.pos[2])).toBeLessThan(3);
    expect(Math.abs(end.transform.pos[1] - 60)).toBeLessThan(1);
    expect(Math.abs(end.state.yaw)).toBeLessThan(0.15);
    expect(end.state.rpm).toBeGreaterThan(0.98);
    // The gauge reads what the steady figures say a hover takes.
    const torque = end.state.rotor?.torque ?? 0;
    const steady =
      ((rotorTrim(cayuse, { density: sampleAtmosphere({}, 60).densityKgM3 })?.power ?? 0) *
        (rotor.transmission ?? 0.97)) /
      rotorShaftPower(cayuse, 1.225);
    expect(torque / steady).toBeGreaterThan(0.93);
    expect(torque / steady).toBeLessThan(1.07);
  });

  it('holds its hover over the ground in a wind, and keeps its speed once it is under way', () => {
    // A 6 m/s wind from the left, hands off: it leans into the wind and stays.
    const windy = fly(cayuse, 15, holding(cayuse, 60), hovering(), undefined, {
      groundHeight: () => 0,
      wind: [-6, 0, 0],
    });
    expect(Math.hypot(windy.transform.pos[0], windy.transform.pos[2])).toBeLessThan(6);
    expect(windy.state.crashed).toBe(false);
    // Nobody's hands (direct controls), it is carried off downwind and tips.
    const adrift = fly(
      cayuse,
      15,
      (state, time, transform) => ({
        ...holding(cayuse, 60)(state, time, transform),
        cyclicMode: 'direct',
      }),
      hovering(),
      undefined,
      { groundHeight: () => 0, wind: [-6, 0, 0] },
    );
    expect(Math.hypot(adrift.transform.pos[0], adrift.transform.pos[2])).toBeGreaterThan(20);
    // At 25 m/s with the stick let go it is a helicopter under way: it keeps most of its speed.
    const cruising = fly(cayuse, 8, holding(cayuse, 100), hovering(100, 25));
    expect(cruising.state.airspeed).toBeGreaterThan(17);
    // Drifting at 3 m/s it is brought to a stop.
    const creeping = fly(cayuse, 12, holding(cayuse, 60), hovering(60, 3));
    expect(Math.hypot(creeping.state.velocity[0], creeping.state.velocity[2])).toBeLessThan(0.5);
  });

  it('leans the other way with a rotor that turns the other way', () => {
    const french = {
      ...cayuse,
      helicopter: { ...helicopter, rotor: { ...rotor, rotation: 'clockwise' as const } },
    };
    const end = fly(french, 10, holding(french, 60));
    expect(end.state.roll).toBeGreaterThan(0.02);
    expect(end.state.crashed).toBe(false);
    expect(Math.abs(end.state.yaw)).toBeLessThan(0.15);
  });

  const base = lever(cayuse, { density: 1.225 });
  /** The hover the assist's hands and feet settle into. */
  const settled = (): Flight => fly(cayuse, 3, () => ({ ...running, power: base }));

  it('swings its nose when the collective moves, unless a foot goes with it', () => {
    // The assist's feet find the hover, then come off: the pedals stay where they were.
    const pull = (more: number, extra: Partial<AircraftInputData> = {}) =>
      fly(
        cayuse,
        3,
        () => ({ ...running, pedalMode: 'direct', power: base + more, ...extra }),
        settled(),
      );
    // In balance it turns slowly if at all.
    expect(Math.abs(pull(0).state.yawRate ?? 9)).toBeLessThan(0.2);
    // More power, same feet: the torque wins and the nose goes right.
    expect(pull(0.06).state.yawRate).toBeLessThan(-0.3);
    // Less power: it goes left.
    expect(pull(-0.06).state.yawRate).toBeGreaterThan(0.3);
    // The assist's feet hold it through the same pull.
    const held = fly(cayuse, 3, () => ({ ...running, power: base + 0.06 }), settled());
    expect(Math.abs(held.state.yawRate ?? 9)).toBeLessThan(0.05);
    // With the engine gone there is no torque to hold: the same pedal now turns it left.
    const out = fly(
      cayuse,
      2,
      () => ({ ...running, engine: false, pedalMode: 'direct', power: 0.1 }),
      settled(),
    );
    expect(out.state.yawRate).toBeGreaterThan(0.3);
  });

  it('hands over the stick and pedals where the assist had them', () => {
    const hover = settled();
    const before = hover.state.rotor;
    if (!before) throw new Error('No rotor state');
    // The hover is held with the swashplate off level and the tail rotor well above the middle
    // of its travel: centered controls would be a lurch and a spin.
    const [right, left] = rotor.tail?.pitch ?? [-0.14, 0.42];
    expect(before.pedal).toBeGreaterThan((right + left) / 2 + 0.03);
    const direct = (): AircraftInputData => ({ ...running, cyclicMode: 'direct', power: base });
    const taken = fly(cayuse, 1 / 60, direct, hover);
    expect(taken.state.rotor?.cyclic[0]).toBeCloseTo(before.cyclic[0], 3);
    expect(taken.state.rotor?.cyclic[1]).toBeCloseTo(before.cyclic[1], 3);
    expect(taken.state.rotor?.pedal).toBeCloseTo(before.pedal, 3);
    // A second later, hands and feet off, it has hardly moved.
    const later = fly(cayuse, 1, direct, hover);
    expect(Math.abs(later.state.yawRate ?? 9)).toBeLessThan(0.15);
    expect(Math.abs(later.state.pitch - hover.state.pitch)).toBeLessThan(0.08);
    expect(Math.abs(later.state.roll - hover.state.roll)).toBeLessThan(0.08);
    // Back with the assist, the trims are let go; the next handover finds the controls afresh.
    const back = fly(cayuse, 1 / 60, () => ({ ...running, power: base }), later);
    expect(back.state.rotor?.trim).toBeUndefined();
    expect(back.state.rotor?.pedalTrim).toBeUndefined();
  });

  it('leaves the pedals where a held foot put them', () => {
    const hover = settled();
    const rested = hover.state.rotor?.pedal ?? 0;
    const [right, left] = rotor.tail?.pitch ?? [-0.14, 0.42];
    // A second of half left pedal, then feet off.
    const pressed = fly(
      cayuse,
      1,
      () => ({ ...running, pedalMode: 'direct', yaw: -0.5, power: base }),
      hover,
    );
    const released = fly(
      cayuse,
      0.1,
      () => ({ ...running, pedalMode: 'direct', power: base }),
      pressed,
    );
    // The trim follows at a quarter of the travel a second: an eighth of it, here.
    expect((released.state.rotor?.pedal ?? 0) - rested).toBeCloseTo(
      (0.125 * (left - right)) / 2,
      2,
    );
  });

  it('turns at the pedals in the hover', () => {
    const turned = fly(cayuse, 4, (state, time, transform) => ({
      ...holding(cayuse, 60)(state, time, transform),
      yaw: 1,
    }));
    // Full right pedal: the nose goes right at about the rate the type turns at.
    expect(turned.state.yawRate).toBeLessThan(-0.6 * helicopter.yawRate);
    expect(turned.state.yawRate).toBeGreaterThan(-1.3 * helicopter.yawRate);
    expect(turned.state.crashed).toBe(false);
  });

  it('spins without its tail rotor', () => {
    const lost = hovering();
    const tail = cayuse.collisionParts?.find((part) => part.role === 'tailRotor');
    if (!tail) throw new Error('No tail rotor part');
    lost.state.damage = { [tail.id]: { integrity: 0, detached: true } };
    const end = fly(cayuse, 3, holding(cayuse, 60), lost);
    expect(end.state.yawRate).toBeLessThan(-1.5);
  });

  it('flies forward with the stick forward, the disc blown back against it', () => {
    let fastest = 0;
    const end = fly(
      cayuse,
      40,
      (state, time, transform) => ({
        ...holding(cayuse, 100)(state, time, transform),
        pitch: -0.25,
      }),
      hovering(100),
      (flight) => {
        fastest = Math.max(fastest, flight.state.airspeed);
      },
    );
    expect(end.state.airspeed).toBeGreaterThan(35);
    expect(end.state.airspeed).toBeLessThan(70);
    expect(end.state.crashed).toBe(false);
    // The swashplate is held well forward of where it sat in the hover: that is the flapback.
    const cyclic = end.state.rotor?.cyclic[0] ?? 0;
    expect(cyclic).toBeGreaterThan(0.08);
    // Cruising takes much less torque than hovering did.
    expect(end.state.rotor?.torque).toBeLessThan(0.75);
    expect(Math.abs(end.state.sideslip ?? 0)).toBeLessThan(0.2);
  });

  describe('with the stick held forward at full power', () => {
    /** The swashplate's forward stop: 1.4 times its travel the other ways. */
    const stop = 1.4 * 0.2;
    const KNOT = 0.514444;
    const push = (id: string, power: number, pitch: number, watch?: (flight: Flight) => void) => {
      const spec = molenAircraft(`molen.entities.aircraft.${id}`).spec;
      let highest = -Math.PI;
      let reached = 0;
      let most = 0;
      let low = Math.PI;
      let high = -Math.PI;
      fly(
        spec,
        60,
        (_state, time) => ({
          ...running,
          brake: false,
          gear: false,
          power,
          pitch: time < 2 ? 0 : pitch,
        }),
        hovering(1500, 60 * KNOT),
        (flight, time) => {
          most = Math.max(most, flight.state.rotor?.cyclic[0] ?? 0);
          // Ten seconds for the nose to go down and settle.
          if (time < 10) return;
          highest = Math.max(highest, flight.state.pitch);
          reached = Math.max(reached, flight.state.airspeed);
          if (time > 40) {
            low = Math.min(low, flight.state.pitch);
            high = Math.max(high, flight.state.pitch);
          }
          watch?.(flight);
        },
        { groundHeight: () => -10000 },
        30,
      );
      return { highest, reached, most, swing: high - low };
    };

    // At what they are certified to never exceed, or near their fastest level flight.
    it.each([
      ['oh6', 130],
      ['uh_1h', 110],
      ['bell_206b', 122],
      ['bell_407', 140],
      ['bell_412ep', 140],
      ['robinson_r44', 130],
      ['airbus_h125', 150],
      ['airbus_h145', 130],
      ['uh_60m', 150],
      ['aw139', 167],
    ] as const)('%s keeps its nose down and reaches %i knots', (id, knots) => {
      const flown = push(id, 1, -0.5);
      expect(flown.highest).toBeLessThan(-0.05);
      expect(flown.reached).toBeGreaterThan(knots * KNOT);
      // Without porpoising, and with swashplate in hand.
      expect(flown.swing).toBeLessThan(0.06);
      expect(flown.most).toBeLessThan(0.95 * stop);
    });

    it.each([
      [0.5, -0.5],
      [0.7, -0.5],
      [0.8, -1],
      [1, -1],
    ])('the AW139 answers it at any power (lever %d, stick %d)', (power, pitch) => {
      // It ran out of swashplate at 105 knots with as much travel forward as aft, pitched up
      // to 17 degrees, slowed, and did it again.
      const flown = push('aw139', power, pitch);
      expect(flown.highest).toBeLessThan(-0.05);
      expect(flown.reached).toBeGreaterThan(160 * KNOT);
      expect(flown.most).toBeLessThan(0.95 * stop);
    });

    it('the AW139 cruises at 160 knots with a tenth of its travel and more in hand', () => {
      const spec = molenAircraft('molen.entities.aircraft.aw139').spec;
      const speed = 160 * KNOT;
      const density = sampleAtmosphere({}, 300).densityKgM3;
      const start = lever(spec, { density, speed });
      let hold = 0;
      const end = fly(
        spec,
        40,
        (state, _time, transform) => {
          const behind = speed - state.velocity[2];
          hold = Math.max(-1, Math.min(1, hold + (behind * 0.01) / 60));
          return {
            ...running,
            gear: false,
            power: Math.max(
              0,
              Math.min(
                1,
                start + (300 - transform.pos[1]) * 0.006 - (state.velocity[1] as number) * 0.06,
              ),
            ),
            pitch: -(0.04 * behind + hold),
          };
        },
        hovering(300, speed),
      );
      expect(end.state.airspeed / KNOT).toBeGreaterThan(157);
      expect(Math.abs(end.state.verticalSpeed)).toBeLessThan(0.5);
      expect(end.state.rotor?.cyclic[0]).toBeLessThan(stop - 0.1 * (stop + 0.2));
    });
  });

  it('noses up as it gathers speed with the stick left alone (direct controls)', () => {
    // Trimmed in the hover, then pushed along at 25 m/s with nobody on the stick.
    const still = fly(cayuse, 0.6, () => ({ ...running, cyclicMode: 'direct', power: 0.5 }));
    const moving = fly(
      cayuse,
      0.6,
      () => ({ ...running, cyclicMode: 'direct', power: 0.5 }),
      hovering(60, 25),
    );
    expect(moving.state.pitchRate).toBeGreaterThan(still.state.pitchRate + 0.1);
  });

  it('slows its rotor when asked for more than the engine has, unless the assist eases the lever', () => {
    // Full collective at 3,500 m, well above where it can hover.
    const high = (): Flight => hovering(3500);
    const air = { groundHeight: () => 0 };
    let lowest = 1;
    fly(
      cayuse,
      6,
      () => ({ ...running, cyclicMode: 'direct', power: 1 }),
      high(),
      (flight) => {
        lowest = Math.min(lowest, flight.state.rpm);
      },
      air,
    );
    expect(lowest).toBeLessThan(0.9);
    const eased = fly(cayuse, 6, () => ({ ...running, power: 1 }), high(), undefined, air);
    expect(eased.state.rpm).toBeGreaterThan(0.94);
    expect(eased.state.rotor?.torque).toBeGreaterThan(0.75);
  });

  it('keeps its rotor turning in autorotation with the lever down, and loses it with the lever up', () => {
    const cut = (power: number, seconds: number, extra: Partial<AircraftInputData> = {}) =>
      fly(
        cayuse,
        seconds,
        () => ({ ...running, ...extra, engine: false, power }),
        hovering(600, 31),
      );
    // Lever left at the hover: the rotor is gone in a few seconds, assist or no assist.
    const held = lever(cayuse, { density: 1.225 });
    expect(cut(held, 3, { cyclicMode: 'direct' }).state.rpm).toBeLessThan(0.8);
    expect(cut(held, 3).state.rpm).toBeLessThan(0.8);
    // Lever down: the air through the disc keeps it turning as the helicopter comes down.
    const down = cut(0.06, 10);
    expect(down.state.rpm).toBeGreaterThan(0.9);
    expect(down.state.rpm).toBeLessThan(1.25);
    expect(down.state.verticalSpeed).toBeLessThan(-5);
    expect(down.state.verticalSpeed).toBeGreaterThan(-16);
    expect(down.state.rotor?.torque).toBe(0);
    // A pull at the bottom spends rotor speed on a last cushion.
    const flared = fly(cayuse, 1.2, () => ({ ...running, engine: false, power: 0.7 }), down);
    expect(flared.state.verticalSpeed).toBeGreaterThan(down.state.verticalSpeed + 2);
    expect(flared.state.rpm).toBeLessThan(down.state.rpm - 0.05);
  });

  it('needs thrust to answer the cyclic with a teetering rotor, and not with a hinge offset', () => {
    // Near zero g (the lever at the bottom), full right cyclic, direct.
    const rolled = (hingeOffset: number): number => {
      const spec = { ...cayuse, helicopter: { ...helicopter, rotor: { ...rotor, hingeOffset } } };
      return fly(spec, 0.5, () => ({ ...running, cyclicMode: 'direct', roll: 1, power: 0 })).state
        .rollRate;
    };
    expect(rolled(0.12)).toBeGreaterThan(0.5);
    expect(rolled(0)).toBeLessThan(0.3 * rolled(0.12));
  });
});

describe('on its skids', () => {
  const parked = (): Flight => ({
    transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
    state: initialAircraftState(),
  });

  it('runs up, lifts off when the collective comes up, and sets down again at rest', () => {
    const base = lever(cayuse, { density: 1.225, clearance: 0.5 });
    let highest = 0;
    let moved = 0;
    const end = fly(
      cayuse,
      50,
      (_state, time) => ({
        ...running,
        // Run up with the lever down, lift to a low hover, then let it down gently.
        power:
          time < 12
            ? 0
            : time < 26
              ? Math.min(base + 0.04, (time - 12) * 0.1)
              : Math.max(0, base - 0.02 - (time - 26) * 0.02),
        engine: time < 40,
      }),
      parked(),
      (flight, time) => {
        highest = Math.max(highest, flight.transform.pos[1]);
        if (time < 11.5)
          moved = Math.max(moved, Math.hypot(flight.state.velocity[0], flight.state.velocity[2]));
        if (time > 11 && time < 12) expect(flight.state.rpm).toBeGreaterThan(0.98);
      },
    );
    // Standing with the rotor turning at flat pitch it does not move.
    expect(moved).toBe(0);
    expect(highest).toBeGreaterThan(1);
    expect(end.state.crashed).toBe(false);
    expect(end.state.grounded).toBe(true);
    expect(end.state.velocity).toEqual([0, 0, 0]);
    // Shut down, the rotor stops.
    expect(end.state.rpm).toBeLessThan(0.2);
    // Its weight is on its four skid ends.
    const loads = end.state.wheels?.load ?? [];
    expect(loads.length).toBe(4);
    expect(loads.reduce((sum, load) => sum + load, 0) / (cayuse.mass * G)).toBeCloseTo(1, 1);
  });

  it('slides to a stop on its skids from a run-on landing', () => {
    // Set down at 9 m/s over the ground with the lever coming down: steel skids slide.
    let steepest = 0;
    const arriving = hovering(0.4, 9);
    arriving.state.velocity = [0, -0.5, 9];
    const end = fly(
      cayuse,
      10,
      (_state, time) => ({ ...running, power: Math.max(0, 0.3 - 0.15 * time) }),
      arriving,
      (flight) => {
        if (flight.state.grounded) steepest = Math.min(steepest, flight.state.pitch);
      },
    );
    expect(end.state.crashed).toBe(false);
    expect(end.state.grounded).toBe(true);
    // It ran on for some meters, nose a little down, and stopped.
    expect(end.transform.pos[2]).toBeGreaterThan(8);
    expect(steepest).toBeGreaterThan(-0.2);
    expect(Math.hypot(end.state.velocity[0], end.state.velocity[2])).toBeLessThan(0.1);
  });

  it('comes down too hard as a crash', () => {
    const dropped = hovering(4);
    dropped.state.velocity = [0, -(cayuse.hardLandingSpeed + 2), 0];
    expect(fly(cayuse, 2, () => ({ ...running, power: 0 }), dropped).state.crashed).toBe(true);
  });
});
