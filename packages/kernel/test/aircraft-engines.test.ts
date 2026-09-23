import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  AircraftInput,
  AircraftState,
  aircraftEngines,
  aircraftMounts,
  flyAircraft,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  installAircraft,
  setAircraftEngineFailed,
  stepAircraft,
} from '../src/aircraft';
import { Transform, type TransformData } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { mountEntity, unmountEntity } from '../src/vehicles';
import { World } from '../src/world';
import { molenAircraft } from './helpers/entities';

const single = molenAircraft('molen.entities.aircraft.p51d').spec;
const engine = single.engine;
if (!engine || !single.airplane) throw new Error('Missing Mustang fixture');
const { engine: _singleEngine, ...airframe } = single;
// Synthetic twin with the same total shaft power as the Mustang: isolates engine layout.
const twin: AircraftSpec = {
  ...airframe,
  label: 'Test twin',
  engines: [
    {
      ...engine,
      id: 'left',
      position: [2.5, 1, 1],
      power: engine.power / 2,
      maxThrust: single.airplane.maxThrust / 2,
    },
    {
      ...engine,
      id: 'right',
      position: [-2.5, 1, 1],
      power: engine.power / 2,
      maxThrust: single.airplane.maxThrust / 2,
    },
  ],
};
const flat = { groundHeight: () => 0 };
const power: AircraftInputData = {
  ...IDLE_AIRCRAFT_INPUT,
  engine: true,
  power: 1,
  brake: false,
  gear: false,
};
function airborne(): { transform: TransformData; state: AircraftStateData } {
  return {
    transform: { pos: [0, 1000, 0], rot: [0, 0, 0, 1] },
    state: { ...initialAircraftState(), grounded: false, rpm: 1, velocity: [0, 0, 70] },
  };
}
function fly(seconds: number, input = power, spec = twin, start = airborne(), hz = 60) {
  let result = start;
  for (let tick = 0; tick < seconds * hz; tick++)
    result = stepAircraft(result.transform, result.state, input, spec, 1 / hz, flat);
  return result;
}
function failed(id: string) {
  const result = airborne();
  result.state.engines = Object.fromEntries(
    aircraftEngines(twin).map((e) => [
      e.id,
      { rpm: 1, rotorAngle: 0, failed: e.id === id, thrust: 0 },
    ]),
  );
  return result;
}
function world() {
  const w = new World({ tickRate: 60, seed: 'twin' });
  installAircraft(w, flat);
  w.spawnRaw(
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      aircraft: { kind: 'test.twin', spec: twin },
      aircraftState: initialAircraftState(),
      aircraftInput: IDLE_AIRCRAFT_INPUT,
      mountable: aircraftMounts(twin),
    },
    'craft',
  );
  w.spawnRaw({ transform: { pos: [1.6, 1.7, 0], rot: [0, 0, 0, 1] } }, 'pilot');
  expect(mountEntity(w, 'pilot', 'craft')).toBe(true);
  return w;
}

describe('independent aircraft engines', () => {
  it('adds symmetric thrust without yaw, retaining the original single-engine performance', () => {
    const result = fly(3);
    const original = fly(3, power, single);
    expect(result.state.yaw).toBe(0);
    expect(result.state.thrustYawRate).toBe(0);
    expect(result.state.velocity[2]).toBeCloseTo(original.state.velocity[2], 9);
    expect(result.state.engines?.left?.thrust).toBeGreaterThan(1000);
    expect(result.state.engines?.left?.thrust).toBe(result.state.engines?.right?.thrust);
  });

  it('yaws toward either failed engine, loses thrust and accepts opposite rudder', () => {
    const left = fly(3, power, twin, failed('left'));
    const right = fly(3, power, twin, failed('right'));
    const corrected = fly(3, { ...power, yaw: 0.3 }, twin, failed('left'));
    expect(left.state.yaw).toBeGreaterThan(0.04);
    expect(right.state.yaw).toBeCloseTo(-left.state.yaw, 10);
    expect(right.state.velocity[0]).toBeCloseTo(-left.state.velocity[0], 10);
    expect(Math.abs(corrected.state.yaw)).toBeLessThan(Math.abs(left.state.yaw));
    expect(left.state.velocity[2]).toBeLessThan(fly(3).state.velocity[2]);
    expect(left.state.engines?.left?.thrust).toBe(0);
    expect(left.state.engines?.left?.rpm).toBeLessThan(0.01);
    expect(left.state.engines?.right?.rpm).toBe(1);
    expect(left.state.rpm).toBe(1);
    expect(left.state.crashed).toBe(false);
  });

  it('uses the thrust line about the center of mass and the authored yaw inertia', () => {
    const start = failed('left');
    const tick = (spec: AircraftSpec) =>
      stepAircraft(start.transform, start.state, power, spec, 1 / 120, flat).state;
    const wing = twin.airplane;
    if (!wing) throw new Error('Missing wing');
    const calibrated = { ...twin, airplane: { ...wing, yawInertia: 60000 } };
    const base = tick(calibrated).thrustYawRate ?? 0;
    const light = tick({ ...calibrated, airplane: { ...wing, yawInertia: 30000 } });
    expect(base).toBeGreaterThan(0);
    expect(light.thrustYawRate).toBeCloseTo(base * 2, 10);
    const centered = tick({ ...calibrated, centerOfMass: [-2.5, 1, 0] });
    expect(centered.thrustYawRate).toBe(0);
    const wider = tick({
      ...calibrated,
      engines: aircraftEngines(twin).map((e) => ({ ...e, position: [e.position[0] * 2, 1, 1] })),
    });
    expect(wider.thrustYawRate).toBeCloseTo(base * 2, 10);
    const canted = tick({
      ...calibrated,
      centerOfMass: [0, 1, 0],
      engines: aircraftEngines(twin).map((e) => ({
        ...e,
        position: [0, 1, 2],
        thrustAxis: [1, 0, 1],
      })),
    });
    expect(canted.thrustYawRate).toBeGreaterThan(0);
  });

  it('supports more than two engines and per-engine propeller tuning', () => {
    const four: AircraftSpec = {
      ...twin,
      engines: [-3, -1, 1, 3].map((x, i) => ({
        ...engine,
        id: `engine${i}`,
        position: [x, 1, 1],
        power: engine.power / 4,
        maxThrust: 500,
        propellerEfficiency: 0.8,
        minPropellerSpeed: 30,
      })),
    };
    const result = fly(1 / 60, power, four);
    expect(Object.keys(result.state.engines ?? {})).toHaveLength(4);
    expect(Object.values(result.state.engines ?? {}).map((e) => e.thrust)).toEqual([
      500, 500, 500, 500,
    ]);
    expect(result.state.thrustYawRate).toBe(0);
    const coast = airborne();
    coast.state.rpm = 0;
    coast.state.engines = Object.fromEntries(
      aircraftEngines(four).map((e, i) => [
        e.id,
        { rpm: i === 3 ? 0.9 : 0, rotorAngle: 0, failed: false, thrust: 0 },
      ]),
    );
    const stopping = fly(1 / 60, { ...power, engine: false }, four, coast);
    expect(stopping.state.rpm).toBe(stopping.state.engines?.engine3?.rpm);
    expect(stopping.state.rpm).toBeGreaterThan(0.8);
  });

  it('spools, throttles and switches engines independently, with a master cutoff', () => {
    const start = airborne();
    start.state.rpm = 0;
    const controls = { ...power, engines: { left: { power: 0.25 }, right: { enabled: false } } };
    const result = fly(2, controls, twin, start);
    expect(result.state.engines?.left?.rpm).toBeCloseTo(
      engine.idleRpm + 0.25 * (1 - engine.idleRpm),
    );
    expect(result.state.engines?.left?.thrust).toBeGreaterThan(0);
    expect(result.state.engines?.right?.rpm).toBe(0);
    expect(result.state.engines?.right?.rotorAngle).toBe(0);
    expect(result.state.engines?.right?.thrust).toBe(0);
    const off = fly(3, { ...controls, engine: false }, twin, result);
    expect(off.state.rpm).toBe(0);
    expect(off.state.engines?.left?.thrust).toBe(0);
  });

  it('latches failures independently of pilot input, allows explicit repair and validates overrides', () => {
    const w = world();
    expect(setAircraftEngineFailed(w, 'craft', 'left')).toBe(true);
    const saved = w.get('craft', AircraftState);
    expect(setAircraftEngineFailed(w, 'craft', 'missing')).toBe(false);
    expect(setAircraftEngineFailed(w, 'missing', 'left')).toBe(false);
    expect(
      flyAircraft(w, 'pilot', {
        ...power,
        gear: true,
        engines: { left: { power: 2, enabled: true } },
      }),
    ).toBe(true);
    w.stepN(120);
    expect(w.get('craft', AircraftInput)?.engines?.left?.power).toBe(1);
    expect(w.get('craft', AircraftState)?.engines?.left?.failed).toBe(true);
    expect(w.get('craft', AircraftState)?.engines?.left?.rpm).toBe(0);
    expect(flyAircraft(w, 'pilot', { ...power, engines: { right: { power: Number.NaN } } })).toBe(
      false,
    );
    expect(flyAircraft(w, 'pilot', { ...power, engines: { typo: { enabled: false } } })).toBe(
      false,
    );
    expect(flyAircraft(w, 'nobody', power)).toBe(false);
    expect(setAircraftEngineFailed(w, 'craft', 'left', false)).toBe(true);
    w.stepN(120);
    expect(w.get('craft', AircraftState)?.engines?.left?.rpm).toBeGreaterThan(0.8);
    expect(saved?.engines?.left?.failed).toBe(true);
    expect(saved?.engines?.right?.rpm).toBe(0);
  });

  it('rolls back every engine and yaw rate when crossing into unknown terrain, without mutating input', () => {
    for (const start of [airborne(), failed('left')]) {
      const before = structuredClone(start);
      const result = stepAircraft(start.transform, start.state, power, twin, 1 / 60, {
        groundHeight: (_x, z) => (z === 0 ? 0 : undefined),
      });
      expect(result.transform).toEqual(before.transform);
      expect(result.state).toEqual({ ...before.state, waitingForTerrain: true });
      expect(start).toEqual(before);
    }
  });

  it('restores engine failures, propeller phases, individual controls and yaw momentum exactly', () => {
    const a = world();
    a.set('craft', Transform, airborne().transform);
    a.set('craft', AircraftState, airborne().state);
    flyAircraft(a, 'pilot', { ...power, engines: { right: { power: 0.8 } } });
    setAircraftEngineFailed(a, 'craft', 'left');
    a.stepN(120);
    const b = world();
    applyKeyframeTo(b, takeKeyframe(a));
    a.stepN(180);
    b.stepN(180);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(b.get('craft', AircraftState)?.engines?.left?.failed).toBe(true);
    expect(b.get('craft', AircraftState)?.thrustYawRate).toBeGreaterThan(0);
  });

  it('keeps exits locked and the solver active while any engine is spinning', () => {
    const w = world();
    w.patch('craft', AircraftState, {
      engines: {
        left: { rpm: 0, rotorAngle: 0, failed: true, thrust: 0 },
        right: { rpm: 0.9, rotorAngle: 0, failed: false, thrust: 0 },
      },
    });
    expect(unmountEntity(w, 'pilot', flat)).toBe(false);
    w.step();
    expect(w.get('craft', AircraftState)?.rpm).toBeGreaterThan(0.8);
    w.stepN(240);
    expect(unmountEntity(w, 'pilot', flat)).toBe(true);
  });

  it('retains engine-out handling at 30, 60 and 120 Hz', () => {
    const results = [30, 60, 120].map((hz) => fly(5, power, twin, failed('left'), hz));
    for (const result of results) {
      expect(result.state.yaw).toBeCloseTo(results[0]?.state.yaw ?? 0, 8);
      expect(result.transform.pos[0]).toBeCloseTo(results[0]?.transform.pos[0] ?? 0, 8);
    }
  });
});
