import type { LampFieldBeam, LampFieldView } from '@bendyline/molen-client';
import { Vehicle, VehicleState } from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { type EarthLampField, EarthNightLighting } from '../src/client/night-lighting';

const frame = { camera: [1000, 12, 2000], direction: [0, -0.2, 1], factor: 1 } as const;

/** A lamp field that keeps what it was last handed. */
function recordingField() {
  const record = {
    /** x, y, z, strength of each lamp, from the anchor. */
    lamps: [] as number[][],
    fadeTo: 300,
    walks: 0,
    view: undefined as LampFieldView | undefined,
    beams: [] as LampFieldBeam[],
    clears: 0,
  };
  const field: EarthLampField = {
    fadeTo: 300,
    focusWeight: 1.2,
    setLamps(lamps, count = Math.floor(lamps.length / 4), fadeTo = 300) {
      record.walks++;
      record.lamps = Array.from({ length: count }, (_, i) =>
        [0, 1, 2, 3].map((k) => lamps[i * 4 + k] as number),
      );
      record.fadeTo = fadeTo;
    },
    setView(view) {
      record.view = view;
    },
    setBeams(beams) {
      record.beams = beams.filter((beam) => beam.intensity > 0);
    },
    clear() {
      record.clears++;
      record.lamps = [];
      record.beams = [];
      record.view = undefined;
    },
  };
  return { field, record };
}

/**
 * A lamp's position in the root's frame: its offset from the view's anchor (float32, so to the
 * millimeter).
 */
const lampAt = (record: ReturnType<typeof recordingField>['record'], lamp: number[]) =>
  [0, 1, 2].map(
    (k) => Math.round(((record.view?.anchor[k] ?? 0) + (lamp[k] as number)) * 1000) / 1000,
  );

it('hands the field the lamps in reach through floating origins, and darkens it at dawn', () => {
  const root = new THREE.Group();
  root.position.set(-1000, 0, -2000);
  const tile = new THREE.Group();
  tile.position.set(1000, 0, 2000);
  root.add(tile);
  let resident = true;
  const { field, record } = recordingField();
  const lighting = new EarthNightLighting({
    root,
    world: new World(),
    sampleHeight: () => 0,
    lampField: field,
    surface: {
      visitStreetLights: (visit) => {
        if (resident)
          for (let i = 0; i < 50; i++)
            visit({ x: i * 10, y: 8, z: 12, yaw: 0, groundLift: 0.5 }, tile);
      },
    },
  });
  // No three light of its own: the field lights the world.
  expect(lighting.object.children.some((o) => (o as THREE.Light).isLight)).toBe(false);
  lighting.update(frame);
  // Lamps out to the field's fade (300 m, and the camera's 12 m above the ground) and its margin;
  // the next is farther.
  expect(lighting.streetLamps).toBe(33);
  expect(record.lamps).toHaveLength(33);
  expect(record.fadeTo).toBe(312);
  expect(record.view?.frame).toBe(root);
  expect(record.view?.anchor).toEqual([1000, 12, 2000]);
  expect(record.view?.eye).toEqual(frame.camera);
  expect(record.view?.focus).toEqual([1000, 0, 2060]);
  expect(record.view?.intensity).toBe(180);
  // Offsets from the camera, in the root's frame (absolute simulation coordinates).
  expect(lampAt(record, record.lamps[0] as number[])).toEqual([1000, 7.8, 2012]);
  expect(record.lamps[0]?.[1]).toBeCloseTo(7.8 - 12, 6);
  expect(lampAt(record, record.lamps[32] as number[])).toEqual([1320, 7.8, 2012]);
  // From the air the field reaches farther, up to three times as far.
  lighting.update({ ...frame, camera: [1000, 400, 2000] });
  expect(record.fadeTo).toBe(700);
  expect(record.lamps).toHaveLength(50);
  // (Chosen again on moving 8 m across, or a quarter second on.)
  lighting.update({ ...frame, camera: [1020, 3000, 2000] });
  expect(record.fadeTo).toBe(900);
  lighting.update({ ...frame, factor: 0.5 });
  expect(record.view?.intensity).toBe(90);
  lighting.update({ ...frame, factor: 0 });
  expect(record.clears).toBe(1);
  expect(lighting.object.visible).toBe(false);
  // Cleared once, not every daylight frame.
  lighting.update({ ...frame, factor: 0 });
  expect(record.clears).toBe(1);
  resident = false;
  lighting.update(frame);
  expect(lighting.object.visible).toBe(true);
  expect(record.lamps).toHaveLength(0);
  lighting.dispose();
  expect(lighting.object.parent).toBeNull();
  expect(record.clears).toBe(2);
});

it('chooses lamps around the camera and its focus, passes over tiles out of reach, follows the camera', () => {
  const root = new THREE.Group();
  const near = new THREE.Group();
  const far = new THREE.Group();
  far.position.set(5000, 0, 0);
  root.add(near, far);
  const lamp = (x: number, z: number) => ({ x, y: 8, z, yaw: 0, groundLift: 0.5 });
  // A row of lamps east from the camera, 30 m ahead of it; and a tile 4 km away.
  const tiles = [
    { tile: near, lights: Array.from({ length: 40 }, (_, i) => lamp(1000 + i * 12, 2030)) },
    { tile: far, lights: Array.from({ length: 40 }, (_, i) => lamp(i * 12, 2030)) },
  ];
  const visited: THREE.Object3D[] = [];
  const { field, record } = recordingField();
  const lighting = new EarthNightLighting({
    root,
    world: new World(),
    sampleHeight: () => 0,
    lampField: field,
    surface: {
      visitStreetLights: (visit, wanted) => {
        for (const { tile, lights } of tiles) {
          if (wanted !== undefined && !wanted(lights, tile)) continue;
          visited.push(tile);
          for (const light of lights) visit(light, tile);
        }
      },
    },
  });
  lighting.update(frame);
  expect(visited).toEqual([near]);
  // Every lamp of the row within 328 m (300, 12 m up, and the margin): up to x = 1324.
  expect(record.lamps.map((l) => lampAt(record, l)[0])).toEqual(
    Array.from({ length: 28 }, (_, i) => 1000 + i * 12),
  );
  // A frame later, nothing moved: the lamps stand as chosen, without another walk over them.
  lighting.update(frame);
  expect(visited).toEqual([near]);
  expect(record.walks).toBe(1);
  // The camera has travelled: chosen again, around where it is now.
  lighting.update({ ...frame, camera: [1300, 12, 2000] });
  expect(visited).toEqual([near, near]);
  expect(record.view?.anchor).toEqual([1300, 12, 2000]);
  expect(record.lamps).toHaveLength(40);
  // Over the far tile, only its lamps are walked.
  lighting.update({ ...frame, camera: [5100, 12, 2000] });
  expect(visited).toEqual([near, near, far]);
  expect(
    Math.min(...record.lamps.map((l) => Math.abs((lampAt(record, l)[0] as number) - 5100))),
  ).toBe(4);
  lighting.dispose();
});

it('keeps the nearest lamps a crowded city offers, and fades them out where it stopped', () => {
  const root = new THREE.Group();
  const tile = new THREE.Group();
  root.add(tile);
  // A lamp every 10 m over 600 m square: 3,600 lamps, a third of them in reach.
  const lights = Array.from({ length: 3600 }, (_, i) => ({
    x: 700 + (i % 60) * 10,
    y: 6,
    z: 1700 + Math.floor(i / 60) * 10,
    yaw: 0,
    groundLift: 0.5,
  }));
  const { field, record } = recordingField();
  const lighting = new EarthNightLighting({
    root,
    world: new World(),
    sampleHeight: () => 0,
    lampField: field,
    surface: {
      visitStreetLights: (visit) => {
        for (const light of lights) visit(light, tile);
      },
    },
  });
  lighting.update({ ...frame, direction: [0, 0, 1] });
  expect(record.lamps).toHaveLength(1024);
  const reach = (l: number[]) => {
    const [x, , z] = lampAt(record, l) as [number, number, number];
    return Math.min(Math.hypot(x - 1000, z - 2000), Math.hypot(x - 1000, z - 2060) * 1.2);
  };
  const farthest = Math.max(...record.lamps.map(reach));
  expect(record.fadeTo).toBeLessThan(300);
  expect(record.fadeTo).toBeGreaterThanOrEqual(farthest);
  // Nearest first: nothing left out is nearer than the farthest kept.
  const kept = new Set(record.lamps.map((l) => lampAt(record, l).join()));
  for (const light of lights) {
    const key = [light.x, Math.round((light.y - 0.2) * 1000) / 1000, light.z].join();
    if (kept.has(key)) continue;
    expect(
      Math.min(
        Math.hypot(light.x - 1000, light.z - 2000),
        Math.hypot(light.x - 1000, light.z - 2060) * 1.2,
      ),
    ).toBeGreaterThanOrEqual(farthest);
  }
  lighting.dispose();
});

it('moves head/tail lenses and beams with traffic, excludes hidden agents, and bounds beam count', () => {
  const root = new THREE.Group(),
    world = new World();
  for (let i = 0; i < 7; i++)
    world.spawnRaw(
      {
        transform: { pos: [1000 + i * 10, 0, 2000], rot: [0, Math.SQRT1_2, 0, Math.SQRT1_2] },
        ambientAgent: { kind: 'car', width: 2, length: 4, speed: 2, hidden: i === 6 },
      },
      `car-${i}`,
    );
  world.spawnRaw(
    {
      transform: { pos: [1000, 0, 2000], rot: [0, 0, 0, 1] },
      ambientAgent: { kind: 'boat', width: 2, length: 4, speed: 2 },
    },
    'boat',
  );
  const { field, record } = recordingField();
  const lighting = new EarthNightLighting({
    root,
    world,
    sampleHeight: () => 0,
    lampField: field,
    surface: { visitStreetLights: () => {} },
  });
  lighting.update({ ...frame, drivenVehicleId: 'car-5' });
  const front = lighting.object.getObjectByName('earth:headlights') as THREE.InstancedMesh;
  const rear = lighting.object.getObjectByName('earth:tail-lights') as THREE.InstancedMesh;
  expect(front.count).toBe(12);
  expect(rear.count).toBe(12);
  const matrix = new THREE.Matrix4();
  front.updateWorldMatrix(true, false);
  rear.updateWorldMatrix(true, false);
  front.getMatrixAt(0, matrix);
  matrix.premultiply(front.matrixWorld);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBeCloseTo(1052.055, 3);
  rear.getMatrixAt(0, matrix);
  matrix.premultiply(rear.matrixWorld);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBeCloseTo(1047.945, 3);
  // Four cars' pairs, the driven car's first.
  expect(record.beams).toHaveLength(8);
  const [first] = record.beams as [LampFieldBeam];
  expect(first.intensity).toBe(35);
  // Ahead of the car (facing +x) and down onto the road.
  expect(first.direction[0]).toBeGreaterThan(0.9);
  expect(first.direction[1]).toBeLessThan(0);
  expect(Math.hypot(...first.direction)).toBeCloseTo(1, 9);
  // Steering, a pitched chassis and a shifted render origin must move both beam sources
  // with their visible lenses, rather than leave illumination at the previous pose.
  world.patch('car-5', Transform, {
    pos: [1070, 3, 2015],
    rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, -0.8, 0.05)).toArray(),
  });
  root.position.set(-1060, 0, -2000);
  lighting.update({ ...frame, drivenVehicleId: 'car-5' });
  root.updateWorldMatrix(true, true);
  for (let i = 0; i < 2; i++) {
    front.getMatrixAt(i, matrix);
    const lens = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(front.matrixWorld);
    const beam = new THREE.Vector3(...(record.beams[i]?.position ?? [0, 0, 0])).applyMatrix4(
      root.matrixWorld,
    );
    expect(beam.distanceTo(lens)).toBeLessThan(0.001);
  }
  world.destroy('car-5');
  lighting.update(frame);
  expect(front.count).toBe(10);
  lighting.update({ ...frame, factor: 0 });
  expect(front.count).toBe(0);
  expect(record.beams).toHaveLength(0);
  expect(lighting.object.visible).toBe(false);
  lighting.dispose();
});

it('keeps parked lamps off but lights a stationary driven car', () => {
  const world = new World();
  world.spawnRaw(
    {
      transform: { pos: [1000, 0, 2000], rot: [0, 0, 0, 1] },
      vehicle: { spec: { length: 4, width: 2, height: 1.5 } },
      vehicleState: { speed: 0 },
    },
    'parked',
  );
  const lighting = new EarthNightLighting({
    root: new THREE.Group(),
    world,
    sampleHeight: () => 0,
    surface: { visitStreetLights: () => {} },
  });
  const lenses = lighting.object.getObjectByName('earth:headlights') as THREE.InstancedMesh;
  lighting.update(frame);
  expect(lenses.count).toBe(0);
  lighting.update({ ...frame, drivenVehicleId: 'parked' });
  expect(lenses.count).toBe(2);
  lighting.dispose();
});

it('keeps sub-metre lens and beam placement precise at Earth-scale coordinates', () => {
  const root = new THREE.Group(),
    world = new World();
  root.position.set(-7542570, 0, 2919254);
  const position: [number, number, number] = [7542570.125, 220.5, -2919254.375];
  world.spawnRaw(
    {
      transform: { pos: position, rot: [0, 0, 0, 1] },
      ambientAgent: { kind: 'car', width: 2, length: 4, speed: 1 },
    },
    'car',
  );
  const { field, record } = recordingField();
  const lighting = new EarthNightLighting({
    root,
    world,
    sampleHeight: () => 220,
    lampField: field,
    surface: { visitStreetLights: () => {} },
  });
  lighting.update({ camera: position, direction: [0, 0, 1], factor: 1 });
  const lenses = lighting.object.getObjectByName('earth:headlights') as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4();
  lenses.getMatrixAt(0, matrix);
  lenses.updateWorldMatrix(true, false);
  const actual = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(lenses.matrixWorld);
  expect(actual.x).toBeCloseTo(-0.495, 3);
  expect(actual.y).toBeCloseTo(221.16, 3);
  expect(actual.z).toBeCloseTo(1.68, 3);
  // Beams are handed over in the root's frame, in double precision, beside the anchor.
  expect(record.view?.anchor).toEqual(position);
  for (let i = 0; i < 2; i++) {
    lenses.getMatrixAt(i, matrix);
    const lens = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(lenses.matrixWorld);
    const beam = new THREE.Vector3(...(record.beams[i]?.position ?? [0, 0, 0])).applyMatrix4(
      root.matrixWorld,
    );
    expect(beam.distanceTo(lens)).toBeLessThan(0.001);
  }
  lighting.dispose();
});

it('lights a driven vehicle by its headlight switch, by day too, from its own lamp', () => {
  const world = new World();
  // One central lamp, as on an auto-rickshaw; the model draws its own lit lens.
  world.spawnRaw(
    {
      transform: { pos: [1000, 0, 2000], rot: [0, 0, 0, 1] },
      vehicle: {
        spec: {
          length: 2.6,
          width: 1.3,
          height: 1.76,
          headlamps: [[0, 0.78, 1.3]],
          actuators: { headlights: { seconds: 0 } },
        },
      },
      vehicleState: { speed: 0, actuators: { headlights: 0 } },
    },
    'auto',
  );
  const { field, record } = recordingField();
  const lighting = new EarthNightLighting({
    root: new THREE.Group(),
    world,
    sampleHeight: () => 0,
    lampField: field,
    surface: { visitStreetLights: () => {} },
  });
  const lenses = lighting.object.getObjectByName('earth:headlights') as THREE.InstancedMesh;
  const driven = { ...frame, drivenVehicleId: 'auto' };
  // Switched off: dark at night, no rig by day.
  lighting.update(driven);
  expect(record.beams).toHaveLength(0);
  lighting.update({ ...driven, factor: 0 });
  expect(lighting.object.visible).toBe(false);
  // Switched on: one beam from the lamp, full at night and still lit by day.
  world.patch('auto', VehicleState, { speed: 0, actuators: { headlights: 1 } });
  lighting.update(driven);
  expect(record.beams).toHaveLength(1);
  expect(record.beams[0]?.intensity).toBe(35);
  expect(record.beams[0]?.position).toEqual([1000, 0.78, 2001.3]);
  expect(record.beams[0]?.direction[2]).toBeGreaterThan(0.9);
  expect(lenses.count).toBe(0);
  lighting.update({ ...driven, factor: 0 });
  expect(lighting.object.visible).toBe(true);
  expect(record.beams.map((b) => b.intensity)).toEqual([35 * 0.35]);
  // By day the street lamps stay off; the beams are measured from the camera.
  expect(record.view?.intensity).toBe(0);
  expect(record.view?.anchor).toEqual(frame.camera);
  // Not driven, the same vehicle follows the dusk, and an empty lamp list lights nothing.
  world.patch('auto', VehicleState, { speed: 3, actuators: { headlights: 0 } });
  lighting.update(frame);
  expect(lenses.count).toBe(1);
  expect(record.beams).toHaveLength(1);
  world.patch('auto', Vehicle, {
    spec: { ...(world.get('auto', Vehicle)?.spec ?? {}), headlamps: [] },
  } as never);
  lighting.update(frame);
  expect(lenses.count).toBe(0);
  expect(record.beams).toHaveLength(0);
  lighting.dispose();
});
