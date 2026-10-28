import { World } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { EarthNightLighting } from '../src/client/night-lighting';

const frame = { camera: [1000, 12, 2000], direction: [0, -0.2, 1], factor: 1 } as const;

it('keeps a fixed light budget, positions street spill through floating origins, and turns off at dawn', () => {
  const root = new THREE.Group();
  root.position.set(-1000, 0, -2000);
  const tile = new THREE.Group();
  tile.position.set(1000, 0, 2000);
  root.add(tile);
  let resident = true;
  const lighting = new EarthNightLighting({
    root,
    world: new World(),
    sampleHeight: () => 0,
    surface: {
      visitStreetLights: (visit) => {
        if (resident)
          for (let i = 0; i < 50; i++)
            visit({ x: i * 10, y: 8, z: 12, yaw: 0, groundLift: 0.5 }, tile);
      },
    },
  });
  lighting.update(frame);
  const points = lighting.object.children.filter(
    (o): o is THREE.PointLight => o instanceof THREE.PointLight,
  );
  expect(points).toHaveLength(16);
  expect(points.every((o) => o.intensity > 0 && !o.castShadow)).toBe(true);
  expect(points[0]?.position.toArray()).toEqual([1000, 7.8, 2012]);
  expect(points[0]?.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([0, 7.8, 12]);
  lighting.update({ ...frame, factor: 0 });
  expect(points.every((o) => o.intensity === 0)).toBe(true);
  expect(lighting.object.visible).toBe(false);
  resident = false;
  lighting.update(frame);
  expect(lighting.object.visible).toBe(true);
  expect(points.every((o) => o.intensity === 0)).toBe(true);
  lighting.dispose();
  expect(lighting.object.parent).toBeNull();
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
  const lighting = new EarthNightLighting({
    root,
    world,
    sampleHeight: () => 0,
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
  const beams = lighting.object.children.filter(
    (o): o is THREE.SpotLight => o instanceof THREE.SpotLight,
  );
  expect(beams.filter((o) => o.intensity > 0)).toHaveLength(4);
  expect(beams[0]?.target.position.x).toBeGreaterThan(beams[0]?.position.x ?? 0);
  expect(beams[0]?.target.position.y).toBeLessThan(beams[0]?.position.y ?? 0);
  world.destroy('car-5');
  lighting.update(frame);
  expect(front.count).toBe(10);
  lighting.update({ ...frame, factor: 0 });
  expect(front.count).toBe(0);
  expect(beams.every((o) => o.intensity === 0)).toBe(true);
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

it('keeps sub-metre lens placement precise at Earth-scale coordinates', () => {
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
  const lighting = new EarthNightLighting({
    root,
    world,
    sampleHeight: () => 220,
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
  lighting.dispose();
});
