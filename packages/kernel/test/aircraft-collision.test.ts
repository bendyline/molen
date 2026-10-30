import type { AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  type AircraftEnvironment,
  AircraftState,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  installAircraft,
  stepAircraft,
} from '../src/aircraft';
import {
  aircraftCollisionProbes,
  resolveAircraftContacts,
  stepAircraftDebris,
} from '../src/aircraft-collision';
import { Transform, type TransformData } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { vehicleRotation } from '../src/vehicles';
import { World } from '../src/world';
import { molenAircraft } from './helpers/entities';

const spec = molenAircraft('molen.entities.aircraft.p51d').spec;
const flat = { groundHeight: () => 0 };
const input = { ...IDLE_AIRCRAFT_INPUT, gear: false, brake: false };
const airborne = (): AircraftStateData => ({
  ...initialAircraftState(),
  grounded: false,
  velocity: [0, 0, 70],
  gearPosition: 0,
});
const pose = (): TransformData => ({ pos: [0, 30, 0], rot: [0, 0, 0, 1] });
const wall: AircraftEnvironment = {
  ...flat,
  contacts: (probes) =>
    probes
      .filter(
        (probe) => probe.center[0] > 2 && probe.center[2] + probe.radius > 5 && probe.center[2] < 6,
      )
      .map((probe) => ({
        part: probe.part,
        point: [probe.center[0], probe.center[1], 5],
        normal: [0, 0, -1],
        depth: probe.center[2] + probe.radius - 5,
      })),
};

describe('aircraft section collisions', () => {
  it('detached pieces inherit boosted travel velocity independently of later boost toggles', () => {
    const a = airborne(),
      b = airborne();
    const env: AircraftEnvironment = {
      ...flat,
      contacts: () => [{ part: 'left-wing', point: [4, 31.4, 0], normal: [0, 0, -1], depth: 0.1 }],
    };
    resolveAircraftContacts(pose(), a, spec, env, '', 1);
    resolveAircraftContacts(pose(), b, spec, env, '', 4);
    expect(b.debris?.[0]?.velocity).toEqual(a.debris?.[0]?.velocity.map((v) => v * 4));
    expect(a.velocity).toEqual(b.velocity);
  });
  it('shears the struck wing, keeps momentum and gives debris its own trajectory', () => {
    let result = { transform: pose(), state: airborne() };
    for (let i = 0; i < 12; i++)
      result = stepAircraft(result.transform, result.state, input, spec, 1 / 60, wall);
    expect(result.state.damage?.['left-wing']?.detached).toBe(true);
    expect(result.state.damage?.['right-wing']?.detached).not.toBe(true);
    expect(result.state.debris).toHaveLength(1);
    expect(result.state.velocity[2]).toBeGreaterThan(30);
    expect(Math.abs(result.state.yawRate ?? 0) + Math.abs(result.state.rollRate)).toBeGreaterThan(
      0.1,
    );
    const piece = result.state.debris?.[0];
    expect(piece?.pos).not.toEqual(result.transform.pos);
    expect(
      aircraftCollisionProbes(result.transform, spec, result.state).some(
        (p) => p.part === 'left-wing',
      ),
    ).toBe(false);
  });

  it('a banked wing strikes the terrain while the fuselage origin is still clear', () => {
    const transform = { pos: [0, 0.5, 0], rot: vehicleRotation(0, 0, -0.45) } as TransformData;
    const state = { ...airborne(), velocity: [0, -10, 60] as [number, number, number] };
    expect(resolveAircraftContacts(transform, state, spec, flat, '')).toBe(true);
    expect(state.damage?.['left-wing']?.detached).toBe(true);
    expect(state.velocity[2]).toBeGreaterThan(40);
    expect(state.damage?.body).toBeUndefined();
  });

  it('a light glancing contact deflects without breaking and never adds linear energy', () => {
    const transform = pose();
    const state = { ...airborne(), velocity: [0, 0, 1] as [number, number, number] };
    const env: AircraftEnvironment = {
      ...flat,
      contacts: () => [{ part: 'left-wing', point: [4, 31.4, 0], normal: [0, 0, -1], depth: 0.01 }],
    };
    resolveAircraftContacts(transform, state, spec, env, '');
    expect(state.crashed).toBe(false);
    expect(state.debris).toBeUndefined();
    expect(Math.hypot(...state.velocity)).toBeLessThanOrEqual(1);
    expect(state.yawRate).not.toBe(0);
  });

  it('hard belly landings slide and fall instead of freezing', () => {
    let result = stepAircraft(
      { pos: [0, 0.01, 0], rot: [0, 0, 0, 1] },
      { ...airborne(), velocity: [0, -8, 60] },
      input,
      spec,
      1 / 60,
      flat,
    );
    expect(result.state.crashed).toBe(true);
    expect(result.state.velocity[2]).toBeGreaterThan(30);
    const before = result.transform.pos[2];
    for (let i = 0; i < 120; i++)
      result = stepAircraft(result.transform, result.state, input, spec, 1 / 60, flat);
    expect(result.transform.pos[2]).toBeGreaterThan(before + 5);
    expect([...result.transform.pos, ...result.transform.rot, ...result.state.velocity]).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(
      [...result.transform.pos, ...result.transform.rot, ...result.state.velocity].every(
        Number.isFinite,
      ),
    ).toBe(true);
  });

  it('losing a wing removes lift and rolls toward the lost side even without further contact', () => {
    const state = airborne();
    const healthy = stepAircraft(pose(), state, input, spec, 0.15, flat);
    const damaged = stepAircraft(
      pose(),
      { ...state, crashed: true, damage: { 'left-wing': { integrity: 0, detached: true } } },
      input,
      spec,
      0.15,
      flat,
    );
    expect(damaged.state.rollRate).toBeLessThan(healthy.state.rollRate - 0.1);
    expect(damaged.state.velocity[1]).toBeLessThan(healthy.state.velocity[1]);
  });

  it('losing both wings makes the fuselage fall ballistically despite throttle and stick input', () => {
    const state: AircraftStateData = {
      ...airborne(),
      velocity: [0, 0, 0],
      rpm: 1,
      pitchRate: 0.2,
      rollRate: 0.5,
      yawRate: -0.1,
      crashed: true,
      damage: {
        'left-wing': { integrity: 0, detached: true },
        'right-wing': { integrity: 0, detached: true },
      },
    };
    const transform: TransformData = { pos: [0, 100, 0], rot: vehicleRotation(0, -1.4, 0) };
    const idle = stepAircraft(transform, state, input, spec, 1, flat);
    const powered = stepAircraft(
      transform,
      state,
      { ...input, engine: true, power: 1, pitch: 1, roll: 1, yaw: 1 },
      spec,
      1,
      flat,
    );
    expect(powered.transform).toEqual(idle.transform);
    expect(powered.state.velocity).toEqual(idle.state.velocity);
    expect(powered.state.velocity[1]).toBeLessThan(-9);
    expect(powered.state.engines?.main?.thrust).toBe(0);
    expect(powered.state.grounded).toBe(false);
    // No contact means no contact damping: the falling wreck must still tumble.
    expect(powered.state.pitchRate).toBe(state.pitchRate);
    expect(powered.state.rollRate).toBe(state.rollRate);
    expect(powered.state.yawRate).toBe(state.yawRate);
  });

  it.each([30, 60, 120])('a tumbling wingless wreck settles on the runway at %i Hz', (hz) => {
    let result = {
      transform: { pos: [0, 5, 0], rot: vehicleRotation(0, -1.4, 0.15) } as TransformData,
      state: {
        ...airborne(),
        velocity: [0, -8, 0],
        pitchRate: 0.1,
        yawRate: 0.3,
        rollRate: 2,
        crashed: true,
        damage: {
          body: { integrity: 0, detached: false },
          'left-wing': { integrity: 0, detached: true },
          'right-wing': { integrity: 0, detached: true },
        },
      } as AircraftStateData,
    };
    for (let i = 0; i < 8 * hz; i++) {
      result = stepAircraft(result.transform, result.state, input, spec, 1 / hz, flat);
      if (i < 7 * hz) continue;
      // Check a whole second: a rocking body passes through zero speed at each turning point.
      expect(Math.hypot(...result.state.velocity)).toBeLessThan(0.1);
      expect(
        Math.hypot(result.state.pitchRate, result.state.yawRate ?? 0, result.state.rollRate),
      ).toBeLessThan(0.08);
      const clearance = Math.min(
        ...aircraftCollisionProbes(result.transform, spec, result.state).map(
          (probe) => probe.center[1] - probe.radius,
        ),
      );
      expect(clearance).toBeGreaterThanOrEqual(-0.000001);
      expect(clearance).toBeLessThan(0.01);
    }
  });

  it('does not mutate input state, rolls back at terrain gaps, and is invariant to contact order', () => {
    const start = airborne();
    const frozen = JSON.stringify(start);
    const contacts = [
      {
        part: 'left-wing',
        point: [4, 31.4, 0] as [number, number, number],
        normal: [0, 0, -1] as [number, number, number],
        depth: 0.1,
      },
      {
        part: 'right-wing',
        point: [-4, 31.4, 0] as [number, number, number],
        normal: [0, 0, -1] as [number, number, number],
        depth: 0.1,
      },
    ];
    const a = stepAircraft(pose(), start, input, spec, 1 / 60, {
      ...flat,
      contacts: () => contacts,
    });
    const b = stepAircraft(pose(), start, input, spec, 1 / 60, {
      ...flat,
      contacts: () => [...contacts].reverse(),
    });
    expect(a).toEqual(b);
    expect(JSON.stringify(start)).toBe(frozen);
    const waiting = stepAircraft(pose(), start, input, spec, 1 / 60, {
      groundHeight: (x) => (x > 2 ? undefined : 0),
    });
    expect(waiting.transform).toEqual(pose());
    expect(waiting.state.waitingForTerrain).toBe(true);
    expect(waiting.state.velocity).toEqual(start.velocity);
    expect(waiting.state.damage).toBeUndefined();
  });

  it('restores damage and moving debris through a keyframe with identical future hashes', () => {
    const create = (): World => {
      const world = new World({ seed: 'collision', tickRate: 60 });
      installAircraft(world, wall);
      world.spawnRaw(
        {
          transform: pose(),
          aircraft: { kind: 'test', spec },
          aircraftState: airborne(),
          aircraftInput: input,
        },
        'plane',
      );
      return world;
    };
    const a = create();
    a.stepN(10);
    expect(a.get('plane', AircraftState)?.debris?.length).toBe(1);
    const b = create();
    applyKeyframeTo(b, takeKeyframe(a));
    a.stepN(90);
    b.stepN(90);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(a.get('plane', Transform)).toEqual(b.get('plane', Transform));
  });

  it('debris bounces, slows on the ground and expires without restoring its wing', () => {
    const state = {
      ...airborne(),
      damage: { 'left-wing': { integrity: 0, detached: true } },
      debris: [
        {
          part: 'left-wing',
          pos: [0, 1, 0] as [number, number, number],
          rot: [0, 0, 0, 1] as [number, number, number, number],
          velocity: [5, -5, 0] as [number, number, number],
          angularVelocity: [1, 1, 1] as [number, number, number],
          age: 0,
        },
      ],
    };
    for (let i = 0; i < 600; i++) stepAircraftDebris(state, spec, flat, '', 1 / 120);
    expect(state.debris[0]?.pos[1]).toBeGreaterThanOrEqual(0.299);
    expect(Math.hypot(...(state.debris[0]?.velocity ?? [0, 0, 0]))).toBeLessThan(1);
    for (let i = 0; i < 1900; i++) stepAircraftDebris(state, spec, flat, '', 1 / 120);
    expect(state.debris).toHaveLength(0);
    expect(state.damage['left-wing'].detached).toBe(true);
  });

  it('a separated engine latches failure while the remaining engine stays available', () => {
    const twin: AircraftSpec = molenAircraft('molen.entities.aircraft.airliner').spec;
    const state: AircraftStateData = {
      ...airborne(),
      engines: {
        left: { rpm: 1, rotorAngle: 0, failed: false, thrust: 100 },
        right: { rpm: 1, rotorAngle: 0, failed: false, thrust: 100 },
      },
    };
    resolveAircraftContacts(
      pose(),
      state,
      twin,
      {
        ...flat,
        contacts: () => [{ part: 'left-wing', point: [10, 33, 0], normal: [0, 0, -1], depth: 0.1 }],
      },
      '',
    );
    expect(state.engines?.left?.failed).toBe(true);
    expect(state.engines?.left?.thrust).toBe(0);
    expect(state.engines?.right?.failed).toBe(false);
  });
});
