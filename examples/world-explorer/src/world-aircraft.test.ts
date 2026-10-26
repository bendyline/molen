import { idleNavigationInput, NavigationInputSource } from '@bendyline/molen-client/navigation';
import { EarthVehicles } from '@bendyline/molen-earth/client';
import { AircraftInput, AircraftState } from '@bendyline/molen-kernel/aircraft';
import { Transform } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ENTITY_TYPES } from './test-content';
import { aircraftBlocks, WorldAircraft } from './world-aircraft';

function controls(keys: string[] = []) {
  const input = idleNavigationInput();
  input.move.forward = Number(keys.includes('KeyW')) - Number(keys.includes('KeyS'));
  input.pilot = {
    throttle: Number(keys.includes('ShiftLeft')),
    yaw: 0,
    engine: 0,
    gear: 0,
    flaps: 0,
    recover: 0,
  };
  return input;
}

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
  it('preserves cockpit controls while keyboard or joystick axes override their movement', async () => {
    const { vehicles, flight } = await setup();
    flight.enter(flight.visitPosition('p51d'));
    const session = flight.cockpitSession();
    expect(session).toBeDefined();
    session?.change({
      control: { id: 'stick', label: 'Stick', action: 'stick', nodes: [] },
      value: 0.4,
      pitch: 0.3,
    });
    session?.change({
      control: { id: 'brake', label: 'Brake', action: 'brake', nodes: [] },
      value: 1,
    });
    flight.input(1 / 60, controls());
    expect(vehicles.world.get('aircraft-p51d', AircraftInput)).toMatchObject({
      pitch: 0.3,
      roll: 0.4,
      brake: true,
    });
    const axes = controls();
    axes.move = { forward: -0.7, right: -0.2, up: 0 };
    flight.input(1 / 60, axes);
    expect(vehicles.world.get('aircraft-p51d', AircraftInput)).toMatchObject({
      pitch: 0.7,
      roll: -0.2,
      brake: true,
    });
    session?.release();
    session?.change({
      control: { id: 'brake', label: 'Brake', action: 'brake', nodes: [] },
      value: 0,
    });
    flight.input(1 / 60, controls());
    expect(vehicles.world.get('aircraft-p51d', AircraftInput)).toMatchObject({
      pitch: 0,
      roll: 0,
      brake: false,
    });
    flight.dispose();
    vehicles.dispose();
  });
  it('uses raw joystick axes for proportional flight and an absolute throttle lever', async () => {
    const { vehicles, flight } = await setup();
    flight.enter(flight.visitPosition('p51d'));
    const pad = {
      id: 'Flight stick',
      index: 0,
      connected: true,
      mapping: '',
      axes: [0.44, 0.66, -0.44, -1],
      buttons: [],
    };
    const source = new NavigationInputSource({
      element: { addEventListener() {}, removeEventListener() {} },
      profile: 'pilot',
      getGamepads: () => (pad.connected ? [pad] : []),
    });
    const profile = source.map.getProfile();
    profile.axes = [
      { axis: 0, action: 'nav-right' },
      { axis: 1, action: 'nav-back' },
      { axis: 2, action: 'nav-yaw-right' },
      { axis: 3, action: 'nav-power', mode: 'unit', invert: true },
    ];
    source.map.defineProfile('pilot', profile);
    flight.input(1 / 60, source.read(1 / 60));
    expect(vehicles.world.get('aircraft-p51d', AircraftInput)).toMatchObject({
      roll: (0.44 - 0.12) / 0.88,
      pitch: (0.66 - 0.12) / 0.88,
      yaw: -(0.44 - 0.12) / 0.88,
      power: 1,
    });
    pad.axes[3] = 1;
    flight.input(1 / 60, source.read(1 / 60));
    expect(flight.power).toBe(0);
    pad.axes[3] = 0;
    flight.input(1 / 60, source.read(1 / 60));
    expect(flight.power).toBe(0.5);
    pad.connected = false;
    flight.input(1 / 60, source.read(1 / 60));
    expect(vehicles.world.get('aircraft-p51d', AircraftInput)).toMatchObject({
      roll: 0,
      pitch: 0,
      yaw: 0,
      power: 0.5,
    });
    source.dispose();
    flight.dispose();
    vehicles.dispose();
  });
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
    flight.input(1 / 60, controls());
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
      flight.input(1 / 60, controls([...keys]));
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
        flight.input(1 / 60, controls(keys));
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
