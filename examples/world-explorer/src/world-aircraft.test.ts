import { EarthVehicles } from '@bendyline/molen-earth/client';
import { AircraftState } from '@bendyline/molen-kernel/aircraft';
import { Transform } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ENTITY_TYPES } from './test-content';
import { aircraftBlocks, WorldAircraft } from './world-aircraft';

async function setup(
  loadModel: (id: string) => Promise<THREE.Object3D> = async () => new THREE.Group(),
) {
  const root = new THREE.Group();
  let flight: WorldAircraft;
  const vehicles: EarthVehicles = new EarthVehicles({
    root,
    sampleHeight: (x, z) => flight?.groundHeight(x, z) ?? 0,
    loadModel: async () => new THREE.Group(),
    types: ENTITY_TYPES,
    obstacles: (box, except) => aircraftBlocks(vehicles.world, box, except),
  });
  flight = new WorldAircraft(
    vehicles.world,
    root,
    () => 0,
    [10000, 50, 20000],
    loadModel,
    ENTITY_TYPES,
  );
  flight.sync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { root, vehicles, flight };
}
describe('world aircraft', () => {
  it('loads the selected catalog aircraft only, evicts the previous addition and boards it', async () => {
    const loads: string[] = [];
    const { vehicles, flight } = await setup(async (id) => {
      loads.push(id);
      return new THREE.Group();
    });
    expect(flight.choices).toHaveLength(53);
    expect(loads).toHaveLength(3);
    await flight.request('f_16b');
    await flight.request('f_16b');
    expect(loads).toHaveLength(4);
    expect(flight.has('f_16b')).toBe(true);
    await flight.request('av_8b');
    expect(flight.has('f_16b')).toBe(false);
    expect(vehicles.world.exists('aircraft-f_16b')).toBe(false);
    expect(vehicles.world.query({ name: 'aircraft' }).count()).toBe(4);
    expect(flight.enter(flight.visitPosition('av_8b'))).toBe(true);
    expect(flight.mountedKind).toBe('av_8b');
    flight.key('KeyJ');
    flight.input(1 / 60, new Set());
    vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: false });
    expect(flight.state?.thrustVectorPosition).toBeGreaterThan(0);
    flight.dispose();
    vehicles.dispose();
  });
  it('coalesces rapid catalog changes to one download at a time and drops stale results', async () => {
    const loads: string[] = [];
    let release: ((model: THREE.Object3D) => void) | undefined;
    const { vehicles, flight } = await setup(async (id) => {
      loads.push(id);
      if (id.endsWith('.f_16b'))
        return new Promise((resolve) => {
          release = resolve;
        });
      return new THREE.Group();
    });
    const first = flight.request('f_16b'),
      second = flight.request('c_17a'),
      last = flight.request('mv_22b');
    expect(loads).toHaveLength(4);
    release?.(new THREE.Group());
    await Promise.all([first, second, last]);
    expect(loads.map((id) => id.split('.').at(-1))).toEqual([
      'p51d',
      'oh6',
      'airliner',
      'f_16b',
      'mv_22b',
    ]);
    expect(flight.has('f_16b')).toBe(false);
    expect(flight.has('mv_22b')).toBe(true);
    expect(vehicles.world.query({ name: 'aircraft' }).count()).toBe(4);
    flight.dispose();
    vehicles.dispose();
  });
  it('boards the airliner at its ground entry and takes off within the practice runway', async () => {
    const { vehicles, flight } = await setup();
    expect(flight.enter(flight.visitPosition('airliner'))).toBe(true);
    expect(flight.mountedKind).toBe('airliner');
    flight.key('KeyI');
    flight.key('KeyF');
    const start = vehicles.world.get('aircraft-airliner', Transform)?.pos[2] ?? 0;
    for (let i = 0; i < 3600 && (flight.state?.grounded ?? true); i++) {
      const keys = new Set(['ShiftLeft']);
      if ((flight.state?.airspeed ?? 0) >= 65) keys.add('KeyS');
      flight.input(1 / 60, keys);
      vehicles.update(1 / 60, { throttle: 0, steering: 0, brake: false });
    }
    expect(flight.state?.crashed).toBe(false);
    expect(flight.state?.grounded).toBe(false);
    const end = vehicles.world.get('aircraft-airliner', Transform)?.pos[2] ?? 0;
    // At the authored 42 t operating mass, static jet thrust and the revised flap lift
    // shorten the ground roll relative to the former propeller-power approximation.
    expect(end - start).toBeGreaterThan(500);
    expect(end - start).toBeLessThan(1600);
    flight.dispose();
    vehicles.dispose();
  });
  it('creates registered aircraft once, boards, follows flight through origin shifts, and preserves residency', async () => {
    const { root, vehicles, flight } = await setup();
    expect(flight.ready).toBe(true);
    expect(vehicles.world.query({ name: 'aircraft' }).count()).toBe(3);
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
    expect(vehicles.world.query({ name: 'aircraft' }).count()).toBe(3);
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
      empty = new EarthVehicles({
        root,
        sampleHeight: () => undefined,
        loadModel: async () => new THREE.Group(),
        types: ENTITY_TYPES,
      });
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
