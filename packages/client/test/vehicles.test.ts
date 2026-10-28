import type { VehicleData, VehiclePlacement, VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createParkedVehicleBatch,
  createVehicleVisual,
  isParkedVehicleHidden,
  setParkedVehicleHidden,
} from '../src/vehicles';

const SPEC: VehicleSpec = {
  label: 'Test car',
  width: 1.82,
  length: 4.65,
  height: 1.45,
  centerOfMass: [0, 0.54, 0],
  wheelbase: 2.75,
  wheelTrack: 1.53,
  wheelRadius: 0.31,
  mass: 1450,
  engineForce: 6200,
  maxSpeed: 42,
  reverseSpeed: 8,
  brakeDeceleration: 9.5,
  maxSteer: 0.56,
  grip: 8,
  driverEye: [0.4, 1.14, 0.25],
  steeringRate: 1.8,
  steeringFadeSpeed: 18,
  rollingResistance: 0.15,
  aerodynamicResistance: 0.0025,
  terrainAlignRate: 1.8,
  supportTolerance: 0.08,
  maxStepHeight: 0.4,
  maxSlope: 0.61,
};
const DATA: VehicleData = {
  kind: 'test.vehicle',
  color: '#566d82',
  spec: SPEC,
  visual: {
    wheelNodes: ['rear-right', 'rear-left', 'front-right', 'front-left'],
    frontWheelNodes: ['front-right', 'front-left'],
    steeringWheelNode: 'steering-wheel',
    paintMaterial: 'body-paint',
  },
};

function model(): THREE.Group {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  paint.name = 'body-paint';
  root.add(new THREE.Mesh(new THREE.BoxGeometry(SPEC.width, SPEC.height, SPEC.length), paint));
  for (const [name, x, z] of [
    ['rear-right', -SPEC.wheelTrack / 2, -SPEC.wheelbase / 2],
    ['rear-left', SPEC.wheelTrack / 2, -SPEC.wheelbase / 2],
    ['front-right', -SPEC.wheelTrack / 2, SPEC.wheelbase / 2],
    ['front-left', SPEC.wheelTrack / 2, SPEC.wheelbase / 2],
  ] as const) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, SPEC.wheelRadius, z);
    pivot.add(new THREE.Mesh(new THREE.CylinderGeometry(SPEC.wheelRadius, SPEC.wheelRadius, 0.2)));
    root.add(pivot);
  }
  const steering = new THREE.Group();
  steering.name = 'steering-wheel';
  root.add(steering);
  return root;
}

describe('vehicle visuals', () => {
  it('takes up the body lean as suspension travel so the wheels stay on the road', () => {
    const visual = createVehicleVisual(model(), DATA);
    const bodyRoll = 0.05,
      bodyPitch = -0.03;
    // The simulation leans the whole model about its ground origin (vehicleRotation is YXZ).
    const car = new THREE.Group();
    car.add(visual.object);
    car.quaternion.setFromEuler(new THREE.Euler(bodyPitch, 0, bodyRoll, 'YXZ'));
    const heights = () => {
      car.updateMatrixWorld(true);
      return DATA.visual.wheelNodes.map(
        (name) => visual.object.getObjectByName(name)?.getWorldPosition(new THREE.Vector3()).y,
      );
    };
    visual.update(0, 0);
    // Without the lean signals the wheels lean with the body: the left ones lift, the right sink.
    expect(Math.max(...(heights() as number[])) - SPEC.wheelRadius).toBeGreaterThan(0.03);
    visual.update(0, 0, { bodyRoll, bodyPitch });
    for (const y of heights()) expect(y).toBeCloseTo(SPEC.wheelRadius, 9);
    // Back to level, the wheels return to their authored places.
    car.quaternion.identity();
    visual.update(0, 0, { bodyRoll: 0, bodyPitch: 0 });
    for (const y of heights()) expect(y).toBeCloseTo(SPEC.wheelRadius, 12);
    visual.dispose();
  });

  it('poses exterior animation bindings from the same signals as the interior', () => {
    const source = model();
    const door = new THREE.Group();
    door.name = 'door-left';
    source.add(door);
    const visual = createVehicleVisual(source, {
      ...DATA,
      visual: {
        ...DATA.visual,
        animation: {
          bindings: [
            {
              node: 'door-left',
              source: 'doorOpen',
              property: 'rotation',
              axis: 'y',
              keys: [
                [0, 0],
                [1, 1.1],
              ],
              ease: 'smooth',
            },
          ],
        },
      },
    });
    expect(visual.animation?.missingNodes).toEqual([]);
    visual.update(0, 0, { doorOpen: 1 });
    expect(door.rotation.y).toBeCloseTo(1.1);
    visual.dispose();
  });

  it('binds external paint and named wheel nodes', () => {
    const visual = createVehicleVisual(model(), DATA);
    visual.update(0.4, 1.2);
    for (const name of DATA.visual.frontWheelNodes) {
      expect(visual.object.getObjectByName(name)?.rotation.y).toBe(-0.4);
    }
    expect(visual.object.getObjectByName('rear-right')?.rotation.y).toBe(0);
    expect(visual.object.getObjectByName('steering-wheel')?.rotation.z).toBe(1);
    visual.dispose();
  });

  it('keeps single materials single so meshes without groups still draw, and paints only when colored', () => {
    const source = model();
    const singles = new Map<string, THREE.Material>();
    source.traverse((object) => {
      if (object instanceof THREE.Mesh && !Array.isArray(object.material))
        singles.set(object.uuid, object.material);
    });
    expect(singles.size).toBeGreaterThan(0);
    const visual = createVehicleVisual(source, DATA);
    visual.object.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !singles.has(object.uuid)) return;
      expect(Array.isArray(object.material)).toBe(false);
      // A clone, never the shared original.
      expect(object.material).not.toBe(singles.get(object.uuid));
    });
    visual.dispose();

    const paintOf = (root: THREE.Object3D): THREE.MeshStandardMaterial => {
      let found: THREE.MeshStandardMaterial | undefined;
      root.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          (object.material as THREE.Material).name === 'body-paint'
        )
          found = object.material as THREE.MeshStandardMaterial;
      });
      return found as THREE.MeshStandardMaterial;
    };
    const painted = createVehicleVisual(model(), DATA);
    expect(`#${paintOf(painted.object).color.getHexString()}`).toBe(
      new THREE.Color(DATA.color).getHexString().replace(/^/, '#'),
    );
    painted.dispose();
    // Without a color the authored paint (white here) stays.
    const { color: _color, ...uncolored } = DATA;
    const plain = createVehicleVisual(model(), uncolored as VehicleData);
    expect(paintOf(plain.object).color.getHexString()).toBe('ffffff');
    plain.dispose();
  });

  it('merges a tile into one mesh with stable IDs, tile-local coordinates and per-car hiding', () => {
    const placements: VehiclePlacement[] = [0, 1, 2].map((i) => ({
      id: `car${i}`,
      kind: DATA.kind,
      color: i === 1 ? '#aa2222' : DATA.color,
      spec: SPEC,
      position: [1000 + i * 3, 10, 2000],
      yaw: 0,
    }));
    const batch = createParkedVehicleBatch(placements, [1000, 2000]);
    expect(batch.children).toHaveLength(1);
    const mesh = batch.children[0] as THREE.Mesh;
    expect((mesh as THREE.InstancedMesh).isInstancedMesh).toBeUndefined();
    expect(mesh.userData.vehicleIds).toEqual(['car0', 'car1', 'car2']);
    const ranges = mesh.userData.vehicleRanges as Uint32Array;
    const position = mesh.geometry.getAttribute('position');
    const center = (index: number): number[] => {
      const box = new THREE.Box3();
      const start = ranges[index * 2] as number;
      for (let i = start; i < start + (ranges[index * 2 + 1] as number); i++)
        box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, i));
      const c = box.getCenter(new THREE.Vector3());
      return [c.x, c.z].map((value) => Math.round(value * 1000) / 1000);
    };
    expect(center(2)).toEqual([6, 0]);
    // Bounds gathered while baking match three's own.
    const exact = new THREE.Box3().setFromBufferAttribute(position as THREE.BufferAttribute);
    expect(mesh.geometry.boundingBox?.equals(exact)).toBe(true);
    expect(mesh.geometry.boundingSphere?.distanceToPoint(exact.max)).toBeLessThan(1e-5);
    const color = mesh.geometry.getAttribute('color');
    expect(new THREE.Color().fromBufferAttribute(color, ranges[2] as number).getHexString()).toBe(
      'aa2222',
    );

    const version = position.version;
    expect(setParkedVehicleHidden(mesh, 1, true)).toBe(true);
    expect(setParkedVehicleHidden(mesh, 1, true)).toBe(false);
    expect(isParkedVehicleHidden(mesh, 1)).toBe(true);
    expect(position.version).toBeGreaterThan(version);
    expect(
      new THREE.Vector3().fromBufferAttribute(position, ranges[2] as number).toArray(),
    ).toEqual([0, 0, 0]);
    expect(center(2)).toEqual([6, 0]);
    expect(setParkedVehicleHidden(mesh, 1, false)).toBe(true);
    expect(isParkedVehicleHidden(mesh, 1)).toBe(false);
    expect(center(1)).toEqual([3, 0]);
    expect(setParkedVehicleHidden(mesh, 9, true)).toBe(false);
    mesh.geometry.dispose();
  });
});
