import { readFileSync } from 'node:fs';
import { applyKeyframeTo, stateHash, takeKeyframe } from '@bendyline/molen-kernel';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import {
  driveVehicle,
  installVehicles,
  Mounted,
  mountEntity,
  stepVehicle,
  unmountEntity,
  VehicleState,
  type VehicleStateData,
} from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
import { describe, expect, it } from 'vitest';
import { MOLEN_CYCLE_ENTITY_IDS, molenVehicle } from '../src/index';

const types = createTypeLibrary([
  JSON.parse(
    readFileSync(
      new URL('../../../content/entities/types/cycle.types.json', import.meta.url),
      'utf8',
    ),
  ),
]);
const flat = { groundHeight: () => 0 };
function setup(id: (typeof MOLEN_CYCLE_ENTITY_IDS)[number]) {
  const w = new World({ tickRate: 60, seed: 'riding' });
  installVehicles(w, flat);
  w.spawnRaw(types.components(id), 'cycle');
  w.spawnRaw({ transform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] } }, 'rider');
  return w;
}

describe('rideable cycle content', () => {
  it('limits fast turns by balance, leans symmetrically and samples only its tire line', () => {
    const spec = molenVehicle(types, 'molen.entities.cycle.standard_motorcycle').spec;
    const cycle = spec.cycle;
    if (!cycle) throw new Error('Missing cycle tuning');
    const turn = (steering: number, maxLean: number) => {
      let transform = {
        pos: [0, 0, 0] as [number, number, number],
        rot: [0, 0, 0, 1] as [number, number, number, number],
      };
      let state = {
        speed: 15,
        steer: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        vy: 0,
        wheelAngle: 0,
        grounded: true,
        waitingForTerrain: false,
      } as VehicleStateData;
      for (let i = 0; i < 120; i++) {
        const next = stepVehicle(
          transform,
          state,
          { throttle: 0.2, steering, brake: false },
          { ...spec, cycle: { ...cycle, maxLean } },
          1 / 60,
          flat,
        );
        transform = next.transform;
        state = next.state;
      }
      return { transform, state };
    };
    const right = turn(1, 0.65),
      left = turn(-1, 0.65),
      limited = turn(1, 0.15);
    expect(right.state.bodyRoll).toBeGreaterThan(0.25);
    expect(left.state.bodyRoll).toBeCloseTo(-(right.state.bodyRoll ?? 0), 8);
    expect(Math.abs(limited.state.yaw)).toBeLessThan(Math.abs(right.state.yaw));
    expect(Math.abs(limited.state.bodyRoll ?? 0)).toBeLessThan(0.17);
    expect(right.transform.rot[2]).not.toBe(0);
    const stopped = stepVehicle(
      { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      { ...right.state, speed: 0, yaw: 0, steer: 0, yawRate: 0, lateralSpeed: 0 },
      { throttle: 0, steering: 0, brake: true },
      spec,
      1 / 60,
      { groundHeight: (x) => (x === 0 ? 0 : undefined) },
    );
    expect(stopped.state.waitingForTerrain).toBe(false);
    const missing = stepVehicle(
      stopped.transform,
      stopped.state,
      { throttle: 1, steering: 0, brake: false },
      spec,
      1 / 60,
      { groundHeight: () => undefined },
    );
    expect(missing.state.waitingForTerrain).toBe(true);
    expect(missing.transform.pos).toEqual(stopped.transform.pos);
  });
  it.each(MOLEN_CYCLE_ENTITY_IDS)('%s mounts, powers, turns, brakes and dismounts', (id) => {
    const w = setup(id);
    const spec = molenVehicle(types, id).spec;
    expect(spec.cycle).toBeDefined();
    expect(types.components(id).ambientRole).toBeUndefined();
    expect(mountEntity(w, 'rider', 'cycle')).toBe(true);
    driveVehicle(w, 'rider', { throttle: 1, steering: 0, brake: false });
    w.stepN(180);
    expect(w.get('cycle', Transform)?.pos[2]).toBeGreaterThan(3);
    expect(unmountEntity(w, 'rider', flat)).toBe(false);
    driveVehicle(w, 'rider', { throttle: 0, steering: 0.3, brake: false });
    w.stepN(60);
    const turning = w.get('cycle', VehicleState) as VehicleStateData;
    expect(turning.yaw).toBeLessThan(0);
    expect(turning.bodyRoll).toBeGreaterThan(0);
    expect(turning.speed).toBeGreaterThan(0);
    expect(Math.abs(turning.bodyRoll ?? 0)).toBeLessThan((spec.cycle?.maxLean ?? 0) + 0.03);
    driveVehicle(w, 'rider', { throttle: -1, steering: 0, brake: false });
    w.stepN(360);
    expect(w.get('cycle', VehicleState)?.speed).toBe(0);
    expect(Math.abs(w.get('cycle', VehicleState)?.bodyRoll ?? 1)).toBeLessThan(0.001);
    expect(unmountEntity(w, 'rider', { ...flat, canExit: () => false })).toBe(false);
    expect(unmountEntity(w, 'rider', flat)).toBe(true);
    expect(w.has('rider', Mounted)).toBe(false);
    expect(w.get('rider', Transform)?.pos[1]).toBeCloseTo(0.02);
  });

  it('freewheels without moving the pedals and restores the exact riding state', () => {
    const w = setup('molen.entities.cycle.city_bicycle');
    mountEntity(w, 'rider', 'cycle');
    driveVehicle(w, 'rider', { throttle: 1, steering: 0.1, brake: false });
    w.stepN(120);
    const powered = w.get('cycle', VehicleState) as VehicleStateData;
    expect(powered.pedalAngle).toBeGreaterThan(0);
    driveVehicle(w, 'rider', { throttle: 0, steering: 0, brake: false });
    const snapshot = takeKeyframe(w);
    w.stepN(120);
    expect(w.get('cycle', VehicleState)?.pedalAngle).toBe(powered.pedalAngle);
    expect(w.get('cycle', VehicleState)?.wheelAngle).not.toBe(powered.wheelAngle);
    const restored = setup('molen.entities.cycle.city_bicycle');
    applyKeyframeTo(restored, snapshot);
    restored.stepN(120);
    expect(stateHash(restored)).toBe(stateHash(w));
  });

  it('stands the rider upright on exit and finishes balancing an unoccupied cycle', () => {
    const w = setup('molen.entities.cycle.city_bicycle');
    mountEntity(w, 'rider', 'cycle');
    w.patch('cycle', VehicleState, { bodyRoll: 0.3, bodyRollRate: -0.1 });
    w.step();
    expect(unmountEntity(w, 'rider', flat)).toBe(true);
    const rot = w.get('rider', Transform)?.rot;
    expect(rot?.[0]).toBe(0);
    expect(rot?.[2]).toBe(0);
    w.stepN(180);
    expect(Math.abs(w.get('cycle', VehicleState)?.bodyRoll ?? 1)).toBeLessThan(0.00001);
  });
});
