import {
  type AircraftInputData,
  type AircraftSpec,
  type AircraftStateData,
  aircraftGearLayout,
} from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  type AircraftEnvironment,
  aircraftGear,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  stepAircraft,
} from '../src/aircraft';
import type { TransformData } from '../src/component';
import { molenAircraft } from './helpers/entities';

const cessna = molenAircraft('molen.entities.aircraft.cessna_172s').spec;
const mustang = molenAircraft('molen.entities.aircraft.p51d').spec;
const viper = molenAircraft('molen.entities.aircraft.f_16b').spec;
const airliner = molenAircraft('molen.entities.aircraft.boeing_737_800').spec;
const hughes = molenAircraft('molen.entities.aircraft.oh6').spec;
if (!cessna.airplane || !mustang.airplane || !viper.airplane || !airliner.airplane)
  throw new Error('Missing airplane physics');

const G = 9.81;
type Flight = { transform: TransformData; state: AircraftStateData };
const flat: AircraftEnvironment = { groundHeight: () => 0 };
const running: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT, engine: true, brake: false };
const off: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT, brake: false };
/** Standing on the runway, or rolling along it at `speed`. */
const onRunway = (speed = 0, fields: Partial<AircraftStateData> = {}): Flight => ({
  transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
  state: { ...initialAircraftState(), velocity: [0, 0, speed], gearPosition: 1, ...fields },
});
function fly(
  spec: AircraftSpec,
  seconds: number,
  controls: (state: AircraftStateData, time: number) => AircraftInputData,
  start: Flight = onRunway(),
  env: AircraftEnvironment = flat,
  watch: (flight: Flight, time: number) => void = () => {},
  hz = 60,
): Flight {
  let flight = start;
  for (let tick = 0; tick < seconds * hz; tick++) {
    flight = stepAircraft(
      flight.transform,
      flight.state,
      controls(flight.state, tick / hz),
      spec,
      1 / hz,
      env,
    );
    watch(flight, (tick + 1) / hz);
  }
  return flight;
}
const loads = (flight: Flight): number[] => flight.state.wheels?.load ?? [];
const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

describe('standing on its landing gear', () => {
  it('puts the main wheels just behind the center of mass and a tenth of the weight on the nose wheel', () => {
    const gear = aircraftGear(cessna);
    const [nose, left, right] = gear.legs;
    if (!nose || !left || !right) throw new Error('Three legs');
    expect(gear.tail).toBeUndefined();
    expect(nose.arm[2]).toBeGreaterThan(1.5);
    expect(left.arm[2]).toBeLessThan(0);
    expect(left.arm[2]).toBeGreaterThan(-0.6);
    expect(left.arm[0]).toBeCloseTo(-right.arm[0], 9);
    expect(nose.staticLoad / (cessna.mass * G)).toBeCloseTo(0.1, 6);
    expect(nose.staticLoad + left.staticLoad + right.staticLoad).toBeCloseTo(cessna.mass * G, 6);
    // A taildragger's are ahead of it, with the small wheel far behind.
    const tail = aircraftGear(mustang);
    expect(tail.tail).toBe(0);
    expect(tail.legs[0]?.arm[2]).toBeLessThan(-3);
    expect(tail.legs[1]?.arm[2]).toBeGreaterThan(0);
    // An authored wheelbase and track are taken as given.
    const wide = aircraftGear({ ...cessna, gear: { wheelbase: 1.65, track: 2.53 } });
    expect(wide.wheelbase).toBe(1.65);
    expect(wide.legs[1]?.arm[0]).toBeCloseTo(1.265, 9);
  });

  it('stands exactly still where it is put, each leg carrying its share', () => {
    for (const spec of [cessna, mustang, airliner]) {
      const stood = fly(spec, 5, () => IDLE_AIRCRAFT_INPUT);
      expect(stood.state.velocity).toEqual([0, 0, 0]);
      expect(stood.transform.pos).toEqual([0, 0, 0]);
      expect(stood.state.grounded).toBe(true);
      expect(stood.state.pitch).toBeCloseTo(0, 9);
      expect(stood.state.roll).toBeCloseTo(0, 9);
      expect(sum(loads(stood))).toBeCloseTo(spec.mass * G, 3);
      expect(loads(stood)[1]).toBeCloseTo(loads(stood)[2] ?? 0, 6);
    }
  });

  it('rides higher on its struts with the tanks half empty', () => {
    const tank = cessna.fuel?.capacity ?? 0;
    expect(tank).toBeGreaterThan(50);
    const light = fly(cessna, 5, () => IDLE_AIRCRAFT_INPUT, onRunway(0, { fuel: tank / 2 }));
    // A few millimeters: the struts stand off the weight that is no longer there.
    expect(light.transform.pos[1]).toBeGreaterThan(0.001);
    expect(light.transform.pos[1]).toBeLessThan(0.02);
    expect(light.state.velocity).toEqual([0, 0, 0]);
    expect(sum(loads(light)) / ((cessna.mass - tank / 2) * G)).toBeCloseTo(1, 2);
  });

  it('holds on its brakes against full power, unless the engine out-pushes them', () => {
    const held = fly(cessna, 6, () => ({ ...running, brake: true, power: 1 }));
    expect(held.state.rpm).toBeGreaterThan(0.9);
    expect(held.state.velocity).toEqual([0, 0, 0]);
    // It leans on its nose strut; it does not roll.
    expect(Math.abs(held.transform.pos[2])).toBeLessThan(0.1);
    expect(loads(held)[0]).toBeGreaterThan(1.3 * (aircraftGear(cessna).legs[0]?.staticLoad ?? 0));
    // Off the brakes it rolls.
    expect(fly(cessna, 6, () => ({ ...running, power: 1 })).transform.pos[2]).toBeGreaterThan(15);
    // An afterburner is more than a fighter's brakes hold.
    const dragged = fly(viper, 8, () => ({ ...running, brake: true, power: 1 }));
    expect(dragged.transform.pos[2]).toBeGreaterThan(20);
  });

  it('rolls away down a slope unless it is braked', () => {
    const slope: AircraftEnvironment = { groundHeight: (_x, z) => -0.05 * z };
    const start = (): Flight => onRunway();
    const braked = fly(cessna, 8, () => IDLE_AIRCRAFT_INPUT, start(), slope);
    expect(Math.hypot(...braked.state.velocity)).toBeLessThan(0.01);
    expect(braked.transform.pos[2]).toBeLessThan(0.2);
    const loose = fly(cessna, 8, () => off, start(), slope);
    // Three degrees, less what the tires take to roll: about a quarter of a m/s² downhill.
    expect(loose.state.velocity[2]).toBeGreaterThan(1);
    expect(loose.state.velocity[2]).toBeLessThan(4);
    expect(loose.state.grounded).toBe(true);
    expect(loose.transform.pos[1]).toBeCloseTo(-0.05 * loose.transform.pos[2], 1);
  });
});

describe('the takeoff roll', () => {
  /** Full power, stick held back from standing: when the nose wheel leaves, and when the mains do. */
  function rotation(spec: AircraftSpec) {
    let nose: number | undefined;
    let mains: number | undefined;
    let steepest = 0;
    const end = fly(
      spec,
      50,
      (state) => ({ ...running, power: 1, pitch: state.grounded ? 1 : 0, yaw: state.yaw * 4 }),
      onRunway(),
      flat,
      (flight) => {
        const [small = 0, left = 0] = loads(flight);
        const speed = flight.state.equivalentAirspeed ?? 0;
        if (nose === undefined && small === 0 && speed > 5) nose = speed;
        if (mains === undefined && nose !== undefined && left === 0) mains = speed;
        if (flight.state.grounded) steepest = Math.max(steepest, flight.state.pitch);
      },
    );
    return { nose, mains, steepest, end };
  }

  it('lifts the nose wheel when the tailplane can, and flies off the main wheels later', () => {
    // A jet: no propeller blowing on its tail, so the elevator has only the airplane's own
    // speed to work with.
    const run = rotation(airliner);
    if (run.nose === undefined || run.mains === undefined) throw new Error('It did not rotate');
    // The nose comes up at about two thirds of flying speed: the stick is all the way back.
    expect(run.nose).toBeGreaterThan(35);
    expect(run.nose).toBeLessThan(62);
    expect(run.mains).toBeGreaterThan(run.nose + 15);
    // It leaves the runway nose-high, short of where its tail would touch.
    expect(run.steepest).toBeGreaterThan(0.1);
    expect(run.steepest).toBeLessThan(0.181);
    expect(run.end.state.crashed).toBe(false);
    expect(run.end.state.grounded).toBe(false);
  });

  it('needs more speed to lift a nose wheel that carries more of the weight', () => {
    const forward: AircraftSpec = { ...airliner, gear: { auxiliaryShare: 0.25 } };
    const heavy = rotation(forward);
    const usual = rotation(airliner);
    expect(heavy.nose).toBeGreaterThan((usual.nose ?? Infinity) + 10);
    expect(heavy.end.state.crashed).toBe(false);
  });

  it('comes out the same at 30, 60 and 120 steps a second', () => {
    const roll = (hz: number): number => {
      let off = 0;
      fly(
        cessna,
        40,
        (state) => ({
          ...running,
          power: 1,
          pitch: state.grounded && state.airspeed > 28 ? 1 : 0,
          yaw: state.yaw * 4,
        }),
        onRunway(),
        flat,
        (flight) => {
          if (off === 0 && !flight.state.grounded) off = flight.transform.pos[2];
        },
        hz,
      );
      return off;
    };
    const reference = roll(60);
    expect(reference).toBeGreaterThan(150);
    expect(Math.abs(roll(30) - reference) / reference).toBeLessThan(0.05);
    expect(Math.abs(roll(120) - reference) / reference).toBeLessThan(0.05);
  });

  /** Full power from standing with nobody on the pedals, for as long as it is on its wheels. */
  function unsteered(spec: AircraftSpec, wind: [number, number, number], seconds = 8) {
    let swung = 0;
    let lowest = 0;
    const end = fly(
      spec,
      seconds,
      () => ({ ...running, power: 1 }),
      onRunway(),
      { groundHeight: () => 0, wind },
      (flight) => {
        if (!flight.state.grounded) return;
        swung = Math.max(swung, Math.abs(flight.state.yaw));
        lowest = Math.min(lowest, flight.state.pitch);
      },
    );
    return { swung, lowest, end };
  }

  it('starts its roll across a wind without swinging round into it', () => {
    // Standing at full power, the tail is in the propeller's wash: the air over the fin comes
    // from ahead at 40 m/s with the wind's 6 m/s across it, not from the side.
    for (const spec of [cessna, mustang]) {
      const calm = unsteered(spec, [0, 0, 0]);
      const across = unsteered(spec, [6, 0, 0]);
      // The wind turns it, by degrees (it went right round, with the wash's pressure on a
      // fin taken to be broadside); the assist's feet and the tires hold the rest.
      expect(across.swung).toBeGreaterThan(calm.swung);
      expect(across.swung).toBeLessThan(0.35);
      expect(across.end.state.crashed).toBe(false);
      expect(across.end.transform.pos[2]).toBeGreaterThan(30);
    }
  });

  it('starts its roll with the wind behind it without being tipped onto its nose', () => {
    for (const spec of [cessna, mustang]) {
      const calm = unsteered(spec, [0, 0, 0]);
      const behind = unsteered(spec, [0, 0, 5]);
      // The tail meets the propeller's wash from ahead, as it does in still air: the nose
      // dips a degree or two further, not the five of a tailplane flying backwards.
      expect(behind.lowest).toBeGreaterThan(calm.lowest - 0.04);
      expect(behind.swung).toBeLessThan(0.2);
      expect(behind.end.state.crashed).toBe(false);
    }
  });
});

describe('tires on the runway', () => {
  it('steers by the nose wheel at a taxi, the way the pedals point', () => {
    const turn = (pedal: number): Flight =>
      fly(cessna, 6, (state) => ({
        ...running,
        power: state.airspeed < 5 ? 0.5 : 0.15,
        yaw: pedal,
      }));
    const right = turn(1);
    const left = turn(-1);
    // Heading is positive to the left: right pedal turns it negative.
    expect(right.state.yaw).toBeLessThan(-0.5);
    expect(left.state.yaw).toBeGreaterThan(0.5);
    expect(right.state.yaw).toBeCloseTo(-left.state.yaw, 1);
    expect(right.state.crashed).toBe(false);
    // And it goes where it points: no sideways slide to speak of.
    expect(Math.abs(right.state.sideslip ?? 0)).toBeLessThan(0.1);
  });

  it('weathervanes into a crosswind as far as its tires let it', () => {
    // A 12 m/s wind from the left, across an airplane rolling at 12 m/s with nobody steering.
    const env: AircraftEnvironment = { groundHeight: () => 0, wind: [-12, 0, 0] };
    const hands: AircraftInputData = { ...off, controlMode: 'direct' };
    const blown = fly(cessna, 4, () => hands, onRunway(12), env);
    // The fin turns the nose toward the wind (to the left), and the tires hold its track.
    expect(blown.state.yaw).toBeGreaterThan(0.03);
    expect(Math.abs(blown.transform.pos[0])).toBeLessThan(8);
    expect(blown.state.crashed).toBe(false);
    // The upwind wheel is the lighter one: the wind is under that wing.
    expect(loads(blown)[1]).toBeLessThan(loads(blown)[2] ?? 0);
    // On packed snow the tires hold less, and it is blown further off its line.
    const icy = fly(cessna, 4, () => hands, onRunway(12), {
      ...env,
      weather: { precipitation: { kind: 'snow', intensity: 1 } },
    });
    expect(Math.abs(icy.transform.pos[0])).toBeGreaterThan(Math.abs(blown.transform.pos[0]));
  });

  it('swings round on its main wheels alone, unless feet on the pedals hold it', () => {
    const quiet = {
      ...mustang,
      airplane: { ...mustang.airplane, propellerEffects: 0 },
    } as AircraftSpec;
    const nosewheel = {
      ...quiet,
      airplane: { ...quiet.airplane, tailwheel: false },
    } as AircraftSpec;
    /** Rolling out with the engine off, nudged a few degrees a second off its line. */
    const swing = (spec: AircraftSpec, speed: number, stick: number, direct: boolean) => {
      let widest = 0;
      const end = fly(
        spec,
        8,
        () => ({ ...off, pitch: stick, ...(direct ? { controlMode: 'direct' as const } : {}) }),
        onRunway(speed, { yawRate: 0.06 }),
        flat,
        (flight) => {
          widest = Math.max(widest, Math.abs(flight.state.yaw));
        },
      );
      return { widest, rate: Math.abs(end.state.yawRate ?? 0) };
    };
    // All three wheels down, either kind runs straight by itself: a tailwheel that does not
    // caster is a keel at the back.
    expect(swing(quiet, 25, 0, true).widest).toBeLessThan(0.15);
    expect(swing(nosewheel, 25, 0, true).widest).toBeLessThan(0.15);
    // Tail up, a taildragger is on two wheels ahead of its center of mass: the swing feeds
    // itself and it goes right round.
    expect(swing(quiet, 35, -0.5, true).widest).toBeGreaterThan(1);
    // So does a nosewheel airplane held down onto its nose wheel alone.
    expect(swing(nosewheel, 35, -1, true).widest).toBeGreaterThan(1);
    // The assist's feet hold both.
    const tail = swing(quiet, 35, -0.5, false);
    expect(tail.widest).toBeLessThan(0.3);
    expect(tail.rate).toBeLessThan(0.1);
    const nose = swing(nosewheel, 35, -1, false);
    expect(nose.widest).toBeLessThan(0.2);
    expect(nose.rate).toBeLessThan(0.02);
  });

  it('stops in a longer distance on a wet runway', () => {
    const stop = (weather?: AircraftEnvironment['weather']): number =>
      fly(airliner, 45, () => IDLE_AIRCRAFT_INPUT, onRunway(60), {
        groundHeight: () => 0,
        ...(weather ? { weather } : {}),
      }).transform.pos[2];
    const dry = stop();
    const snow = stop({ precipitation: { kind: 'snow', intensity: 1 } });
    // 60 m/s at the brakes' 4 m/s²: about 450 m dry.
    expect(dry).toBeGreaterThan(350);
    expect(dry).toBeLessThan(650);
    expect(snow).toBeGreaterThan(1.25 * dry);
  });

  it('lands one wheel first and comes level on both', () => {
    const banked: Flight = {
      transform: { pos: [0, 0.6, 0], rot: [0, 0, Math.sin(0.04), Math.cos(0.04)] },
      state: {
        ...initialAircraftState(),
        grounded: false,
        velocity: [0, -0.8, 32],
        roll: 0.08,
        gearPosition: 1,
      },
    };
    let first: number[] | undefined;
    const end = fly(
      cessna,
      14,
      () => IDLE_AIRCRAFT_INPUT,
      banked,
      flat,
      (flight) => {
        if (!first && flight.state.grounded) first = loads(flight);
      },
    );
    if (!first) throw new Error('It did not land');
    // Right wing low: the right main wheel is the first to carry anything.
    expect(first[2]).toBeGreaterThan(0);
    expect(first[1]).toBe(0);
    expect(end.state.crashed).toBe(false);
    expect(Math.abs(end.state.roll)).toBeLessThan(0.01);
    expect(end.state.velocity).toEqual([0, 0, 0]);
    // Stopped, it stands as it stood before it flew.
    expect(end.state.pitch).toBeCloseTo(0, 2);
    expect(loads(end)[0]).toBeCloseTo(aircraftGear(cessna).legs[0]?.staticLoad ?? 0, -2);
  });

  it('is tipped by a touchdown with drift on, unless hands on the ailerons hold the wings', () => {
    // Down on its wheels at 27 m/s in an 8 m/s crosswind, still crabbed into it: the tires
    // pull it straight at their height, under the center of mass, and the wind is under the
    // upwind wing.
    const env: AircraftEnvironment = { groundHeight: () => 0, wind: [8, 0, 0] };
    const crab = Math.atan2(8, 27);
    const arrive = (controls: AircraftInputData) => {
      let steepest = 0;
      const end = fly(
        cessna,
        4,
        () => controls,
        {
          transform: { pos: [0, 0, 0], rot: [0, Math.sin(-crab / 2), 0, Math.cos(-crab / 2)] },
          state: {
            ...initialAircraftState(-crab),
            velocity: [0, 0, 27],
            gearPosition: 1,
          },
        },
        env,
        (flight) => {
          steepest = Math.max(steepest, Math.abs(flight.state.roll));
        },
      );
      return { steepest, crashed: end.state.crashed };
    };
    // Nobody on the controls, it goes over onto a wingtip.
    const bare = arrive({ ...off, controlMode: 'direct' });
    expect(bare.steepest).toBeGreaterThan(0.12);
    // The assist's hands put the aileron into the wind and it stays on its wheels.
    const held = arrive(off);
    expect(held.steepest).toBeLessThan(0.08);
    expect(held.crashed).toBe(false);
  });
});

describe('strut travel', () => {
  const travel = (flight: Flight): number[] => {
    const read = flight.state.wheels?.travel;
    if (!read) throw new Error('No strut travel');
    return read;
  };

  it('stands where the schema says its legs are, and reports no travel at rest', () => {
    for (const spec of [cessna, mustang, viper, airliner, hughes]) {
      const layout = aircraftGearLayout(spec);
      const gear = aircraftGear(spec);
      // One definition of the undercarriage: the flight model's legs are the layout's.
      expect(gear.legs.map((leg) => [leg.arm[0], leg.arm[2]])).toEqual(
        layout.legs.map((leg) => [leg.x, leg.z]),
      );
      for (const leg of gear.legs) {
        expect(leg.travel).toBe(layout.travel);
        expect(leg.staticLoad / leg.spring).toBeCloseTo(layout.reach, 12);
      }
      expect(gear.wheelbase).toBe(layout.wheelbase);
      const parked = fly(spec, 3, () => IDLE_AIRCRAFT_INPUT);
      for (const closed of travel(parked)) expect(Math.abs(closed)).toBeLessThan(0.002);
    }
  });

  it('hangs its legs at their full reach in flight and closes them at touchdown', () => {
    const layout = aircraftGearLayout(cessna);
    // Let go half a meter up: the struts hang, meet the runway, close to their stops and
    // come back to rest.
    let hanging = false;
    const closed = [0, 0, 0];
    const dropped = fly(
      cessna,
      4,
      () => IDLE_AIRCRAFT_INPUT,
      {
        transform: { pos: [0, 0.5, 0], rot: [0, 0, 0, 1] },
        state: { ...initialAircraftState(), gearPosition: 1, grounded: false },
      },
      flat,
      (flight) => {
        const read = travel(flight);
        if (read.every((leg) => Math.abs(leg + layout.reach) < 1e-9)) hanging = true;
        for (const [i, leg] of read.entries()) {
          closed[i] = Math.max(closed[i] ?? 0, leg);
          // A strut is never longer than its reach.
          expect(leg).toBeGreaterThanOrEqual(-layout.reach - 1e-9);
        }
      },
    );
    expect(hanging).toBe(true);
    for (const leg of closed) {
      expect(leg).toBeGreaterThan(0.6 * layout.travel);
      expect(leg).toBeLessThan(2 * layout.travel);
    }
    expect(dropped.state.crashed).toBe(false);
    for (const leg of travel(dropped)) expect(Math.abs(leg)).toBeLessThan(0.003);
  });

  it('dips its nose leg under braking and lifts it off first on the takeoff roll', () => {
    const layout = aircraftGearLayout(cessna);
    // Rolling at 15 m/s, then hard on the brakes: the weight goes forward onto the nose leg.
    let nose = 0;
    let mains = 0;
    fly(
      cessna,
      4,
      () => ({ ...off, brake: true }),
      onRunway(15),
      flat,
      (flight) => {
        const [front, left, right] = travel(flight) as [number, number, number];
        nose = Math.max(nose, front);
        mains = Math.max(mains, left, right);
      },
    );
    expect(nose).toBeGreaterThan(0.03);
    expect(mains).toBeLessThan(0.02);
    // Full power and the stick back: the nose leg runs out to its reach while the mains still
    // carry the airplane, and all three hang once it is flying.
    let rotated = false;
    let flying: number[] | undefined;
    fly(
      cessna,
      40,
      (state) => ({ ...running, power: 1, pitch: state.airspeed > 25 ? 0.7 : 0 }),
      onRunway(),
      flat,
      (flight) => {
        const read = flight.state.wheels?.travel;
        if (!read) return;
        const [front, left, right] = read as [number, number, number];
        if (front <= -layout.reach + 1e-9 && left > -layout.reach && right > -layout.reach)
          rotated = true;
        if (flight.state.altitudeAGL > 3) flying ??= [...read];
      },
    );
    expect(rotated).toBe(true);
    expect(flying).toHaveLength(3);
    for (const leg of flying ?? []) expect(leg).toBeCloseTo(-layout.reach, 9);
  });

  it('reports the four ends of a helicopter on skids as it does wheels', () => {
    const layout = aircraftGearLayout(hughes);
    expect(layout.legs).toHaveLength(4);
    const parked = fly(hughes, 2, () => IDLE_AIRCRAFT_INPUT);
    expect(travel(parked)).toHaveLength(4);
    for (const leg of travel(parked)) expect(Math.abs(leg)).toBeLessThan(0.002);
  });
});
