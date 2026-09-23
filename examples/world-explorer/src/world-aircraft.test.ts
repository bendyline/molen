import { Transform } from '@bendyline/molen-kernel';
import { AircraftState } from '@bendyline/molen-kernel/aircraft';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ENTITY_TYPES } from './test-content';
import { WorldAircraft } from './world-aircraft';
import { WorldVehicles } from './world-vehicles';

async function setup() {
  const root = new THREE.Group();
  let flight: WorldAircraft;
  const vehicles = new WorldVehicles(
    root,
    (x, z) => flight?.groundHeight(x, z) ?? 0,
    async () => new THREE.Group(),
    ENTITY_TYPES,
  );
  flight = new WorldAircraft(
    vehicles.world,
    root,
    () => 0,
    [10000, 50, 20000],
    async () => new THREE.Group(),
    ENTITY_TYPES,
  );
  flight.sync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { root, vehicles, flight };
}
describe('world aircraft', () => {
  it('creates registered aircraft once, boards, follows flight through origin shifts, and preserves residency', async () => {
    const { root, vehicles, flight } = await setup();
    expect(flight.ready).toBe(true);
    expect(vehicles.world.query({ name: 'aircraft' }).count()).toBe(2);
    expect(flight.enter(flight.visitPosition('oh6'))).toBe(true);
    flight.key('KeyI');
    const run = (keys: string[], count: number): void => {
      for (let i = 0; i < count; i++) {
        flight.input(1 / 60, new Set(keys));
        vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: false });
        flight.render();
      }
    };
    run(['ShiftLeft'], 160);
    run([], 600);
    expect(flight.state?.altitudeAGL).toBeGreaterThan(2);
    expect(flight.state?.crashed).toBe(false);
    expect(vehicles.exit()).toBeUndefined();
    const pose = flight.cameraPose('cockpit', 0, 0);
    root.position.set(-10000, 0, -20000);
    root.updateMatrixWorld(true);
    expect(flight.cameraPose('cockpit', 0, 0)).toEqual(pose);
    flight.sync();
    vehicles.sync(1000);
    expect(vehicles.world.query({ name: 'aircraft' }).count()).toBe(2);
    flight.dispose();
    vehicles.dispose();
    expect(root.children).toHaveLength(0);
  });
  it('recovers only after an impact and respects missing terrain before spawning', async () => {
    const { vehicles, flight } = await setup();
    flight.enter(flight.visitPosition('p51d'));
    const pos = vehicles.world.get('aircraft-p51d', Transform)?.pos;
    if (!pos) throw new Error('Aircraft transform disappeared');
    vehicles.world.patch('aircraft-p51d', Transform, { pos: [pos[0], pos[1] + 50, pos[2]] });
    flight.key('KeyR');
    expect(vehicles.world.get('aircraft-p51d', Transform)?.pos[1]).toBe(pos[1] + 50);
    vehicles.world.patch('aircraft-p51d', AircraftState, { crashed: true });
    flight.key('KeyR');
    expect(vehicles.world.get('aircraft-p51d', Transform)?.pos).toEqual(pos);
    expect(flight.state?.crashed).toBe(false);
    flight.dispose();
    vehicles.dispose();
    const root = new THREE.Group(),
      empty = new WorldVehicles(
        root,
        () => undefined,
        async () => new THREE.Group(),
        ENTITY_TYPES,
      );
    const delayed = new WorldAircraft(
      empty.world,
      root,
      () => undefined,
      [0, 0, 0],
      async () => new THREE.Group(),
      ENTITY_TYPES,
    );
    delayed.sync();
    expect(delayed.ready).toBe(false);
    expect(empty.world.query({ name: 'aircraft' }).count()).toBe(0);
    delayed.dispose();
    empty.dispose();
  });
});
