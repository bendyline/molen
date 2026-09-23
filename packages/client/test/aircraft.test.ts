import type { AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { aircraftCameraPose, createAircraftVisual } from '../src/aircraft';

const SPEC: AircraftSpec = {
  label: 'Test helicopter',
  model: 'helicopter',
  mass: 1150,
  span: 8.05,
  length: 7.01,
  height: 2.65,
  centerOfMass: [0, 1.25, -0.45],
  pilotEye: [-0.38, 1.7, 0.6],
  engine: {
    position: [0, 2.05, -1.25],
    thrustAxis: [0, 1, 0],
    power: 235000,
    idleRpm: 1,
    spoolRate: 0.16,
    rotorAngularSpeed: 50,
  },
  helicopter: {
    rotorPosition: [0, 2.64, -0.25],
    rotorRadius: 4.025,
    cyclicTilt: 0.5,
    cyclicResponse: 4,
    cyclicDamping: 2.4,
    groundLevelRate: 1,
    maxTilt: 0.65,
    yawRate: 0.85,
    liftMultiplier: 2.05,
    groundEffect: 0.12,
    translationalLift: 0.1,
    translationalLiftSpeed: 18,
    verticalDrag: 210,
    horizontalDrag: 18,
    quadraticDrag: 2.5,
    groundDeceleration: 9,
  },
  hardLandingSpeed: 4.5,
  hardLandingRoll: 0.3,
  hardLandingPitch: 0.35,
  maxSupportStep: 0.65,
  collisionProbes: [[0, 1.4, 0]],
  visual: {
    rotors: [{ node: 'main-rotor', axis: 'y', multiplier: 1 }],
    gearNodes: [],
    flaps: [],
    ailerons: [],
    interior: {
      nodes: ['bespoke-panel'],
      bindings: [
        {
          node: 'custom-tachometer',
          source: 'rpm',
          property: 'rotation',
          axis: 'z',
          scale: 4.6,
          offset: -2.3,
        },
      ],
    },
  },
};

it('retains bank in the cockpit quaternion and shortens obstructed chase views', () => {
  const transform = {
    pos: [100000, 200, 300000] as [number, number, number],
    rot: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.5).toArray(),
  };
  const pose = aircraftCameraPose(transform, SPEC, { view: 'cockpit' });
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
    new THREE.Quaternion().fromArray(pose.rotation),
  );
  expect(up.x).toBeCloseTo(-Math.sin(0.5));
  const seat = new THREE.Vector3()
    .fromArray(SPEC.pilotEye)
    .applyQuaternion(new THREE.Quaternion().fromArray(transform.rot))
    .add(new THREE.Vector3().fromArray(transform.pos));
  expect(pose.position).toEqual(seat.toArray());
  const chase = aircraftCameraPose(transform, SPEC, {
    view: 'chase',
    obstructionDistance: () => 2,
  });
  expect(
    new THREE.Vector3()
      .fromArray(chase.position)
      .distanceTo(new THREE.Vector3().fromArray(chase.lookAt)),
  ).toBeCloseTo(1.7);
});

it('drives externally named rotor and instrument nodes without moving their pivots', () => {
  const model = new THREE.Group();
  const rotor = new THREE.Group();
  const needle = new THREE.Group();
  rotor.name = 'main-rotor';
  rotor.position.set(0, 2.64, -0.25);
  needle.name = 'custom-tachometer';
  const panel = new THREE.Group();
  panel.name = 'bespoke-panel';
  model.add(panel);
  model.add(rotor, needle);
  const visual = createAircraftVisual(model, SPEC);
  const state = {
    rotorAngle: 1.5,
    rpm: 0.8,
    airspeed: 10,
    yaw: 0,
    roll: 0.2,
    pitch: 0.1,
    verticalSpeed: 2,
  } as AircraftStateData;
  visual.update(
    state,
    { power: 0.5, pitch: 0, roll: 0, yaw: 0, engine: true, gear: true, flaps: false, brake: false },
    100,
  );
  expect(rotor.rotation.y).toBe(1.5);
  expect(rotor.position.toArray()).toEqual([0, 2.64, -0.25]);
  expect(needle.rotation.z).toBeCloseTo(-2.3 + 0.8 * 4.6);
  expect(visual.interior?.missingNodes).toEqual([]);
  visual.update(
    state,
    { power: 0.5, pitch: 0, roll: 0, yaw: 0, engine: true, gear: true, flaps: false, brake: false },
    100,
    { rpm: 0.3 },
  );
  expect(needle.rotation.z).toBeCloseTo(-2.3 + 0.3 * 4.6);
  expect(state.rpm).toBe(0.8);
  visual.dispose();
});
