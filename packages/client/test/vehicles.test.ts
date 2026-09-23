import type { VehicleData, VehiclePlacement, VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createParkedVehicleBatch, createVehicleVisual } from '../src/vehicles';

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

  it('batches by entity/paint and retains stable IDs in tile-local coordinates', () => {
    const placements: VehiclePlacement[] = [0, 1, 2].map((i) => ({
      id: `car${i}`,
      kind: DATA.kind,
      color: DATA.color,
      spec: SPEC,
      position: [1000 + i * 3, 10, 2000],
      yaw: 0,
    }));
    const batch = createParkedVehicleBatch(placements, [1000, 2000]);
    expect(batch.children).toHaveLength(1);
    const mesh = batch.children[0] as THREE.InstancedMesh;
    expect(mesh.count).toBe(3);
    expect(mesh.userData.vehicleIds).toEqual(['car0', 'car1', 'car2']);
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(2, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([6, 10, 0]);
  });
});
