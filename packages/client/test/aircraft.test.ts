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

it('publishes individual shaft RPM without confusing normalized RPM with revolutions per minute', () => {
  const model = new THREE.Group(),
    needle = new THREE.Group();
  needle.name = 'tach';
  model.add(needle);
  const spec: AircraftSpec = {
    ...SPEC,
    engine: undefined,
    engines: [
      { ...SPEC.engine!, id: 'left', rotorAngularSpeed: 100 },
      { ...SPEC.engine!, id: 'right', rotorAngularSpeed: 200 },
    ],
    visual: {
      ...SPEC.visual,
      rotors: [],
      interior: {
        nodes: ['tach'],
        derived: {
          difference: { op: 'subtract', args: ['engines.right.rotorRpm', 'engines.left.rotorRpm'] },
        },
        bindings: [
          { node: 'tach', source: 'difference', property: 'rotation', axis: 'z', scale: 0.01 },
        ],
      },
    },
  };
  const visual = createAircraftVisual(model, spec);
  const state = {
    rpm: 0.8,
    engines: {
      left: { rpm: 0.5, failed: false, thrust: 100, rotorAngle: 0 },
      right: { rpm: 0.8, failed: false, thrust: 200, rotorAngle: 0 },
    },
  } as unknown as AircraftStateData;
  visual.update(
    state,
    { power: 1, pitch: 0, roll: 0, yaw: 0, engine: true, gear: true, flaps: false, brake: false },
    0,
  );
  expect(needle.rotation.z).toBeCloseTo((((160 - 50) * 60) / (2 * Math.PI)) * 0.01);
  expect(visual.interior?.missingSignals).toEqual([]);
  visual.dispose();
});

it('poses rigged gear and mechanisms from their positions without hiding exposed stowed wheels', () => {
  const model = new THREE.Group();
  const gear = new THREE.Group();
  const canopy = new THREE.Group();
  gear.name = 'gear';
  canopy.name = 'canopy';
  model.add(gear, canopy);
  const spec: AircraftSpec = {
    ...SPEC,
    visual: {
      ...SPEC.visual,
      rotors: [],
      interior: undefined,
      gearNodes: ['gear'],
      animation: {
        bindings: [
          {
            node: 'gear',
            source: 'gear',
            property: 'rotation',
            axis: 'z',
            scale: -1.5,
            offset: 1.5,
          },
          { node: 'canopy', source: 'canopy', property: 'position', axis: 'z', scale: -1 },
        ],
      },
    },
  };
  const visual = createAircraftVisual(model, spec);
  const input = {
    power: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    engine: false,
    gear: false,
    flaps: false,
    brake: false,
    actuators: { canopy: 0 },
  };
  visual.update({ gearPosition: 0.3, actuators: { canopy: 0.4 } } as AircraftStateData, input, 0);
  expect(gear.rotation.z).toBeCloseTo(1.05);
  expect(canopy.position.z).toBeCloseTo(-0.4);
  visual.update({ gearPosition: 0, actuators: { canopy: 0.2 } } as AircraftStateData, input, 0);
  expect(gear.visible).toBe(true);
  expect(gear.rotation.z).toBeCloseTo(1.5);
  expect(canopy.position.z).toBeCloseTo(-0.2);
  visual.dispose();
});

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

it('keeps the chase view upright and defined through the vertical of a loop', () => {
  const pose = (pitch: number) => {
    const rot = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch)
      .toArray() as [number, number, number, number];
    const camera = aircraftCameraPose({ pos: [0, 500, 0], rot }, SPEC, { view: 'chase' });
    return new THREE.Vector3(0, 1, 0).applyQuaternion(
      new THREE.Quaternion().fromArray(camera.rotation),
    );
  };
  // Level flight keeps the horizon level (the camera only tilts down at the airplane);
  // straight up, the camera's up is the airframe's (its back).
  expect(Math.abs(pose(0).x)).toBeLessThan(1e-9);
  expect(pose(0).y).toBeGreaterThan(0.8);
  const vertical = pose(Math.PI / 2);
  expect(Number.isFinite(vertical.length())).toBe(true);
  expect(vertical.z).toBeLessThan(-0.9);
});

it('poses thrust-vector geometry from actuator state instead of the requested lever', () => {
  const model = new THREE.Group(),
    nozzle = new THREE.Group();
  nozzle.name = 'nozzle';
  model.add(nozzle);
  const spec = {
    ...SPEC,
    visual: {
      ...SPEC.visual,
      rotors: [],
      interior: undefined,
      animation: {
        bindings: [
          {
            node: 'nozzle',
            source: 'thrustVector',
            property: 'rotation' as const,
            axis: 'x' as const,
            scale: -Math.PI / 2,
          },
        ],
      },
    },
  };
  const visual = createAircraftVisual(model, spec);
  visual.update(
    { rotorAngle: 0, rpm: 1, thrustVectorPosition: 0.5 } as AircraftStateData,
    {
      power: 1,
      pitch: 0,
      roll: 0,
      yaw: 0,
      engine: true,
      gear: true,
      flaps: false,
      brake: false,
      thrustVector: 1,
    },
    100,
  );
  expect(nozzle.rotation.x).toBeCloseTo(-Math.PI / 4);
  visual.dispose();
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
  // A declared sensor that is missing must not silently reuse the host's normalized RPM.
  visual.update(
    state,
    { power: 0.5, pitch: 0, roll: 0, yaw: 0, engine: true, gear: true, flaps: false, brake: false },
    100,
    { rpm: undefined },
  );
  expect(visual.interior?.missingSignals).toEqual(['rpm']);
  expect(needle.rotation.z).toBeCloseTo(-2.3 + 0.3 * 4.6);
  visual.dispose();
});

it('moves the gear, its doors and the flaps with their positions, not the selection', () => {
  const airplane: AircraftSpec = {
    ...SPEC,
    visual: {
      rotors: [],
      gearNodes: ['gear-leg'],
      flaps: [{ node: 'flap', axis: 'x', multiplier: -0.8 }],
      ailerons: [],
      animation: {
        bindings: [
          {
            node: 'gear',
            source: 'gear',
            property: 'rotation',
            axis: 'x',
            keys: [
              [0.1, 1.6],
              [0.9, 0],
            ],
          },
          { node: 'rudder', source: 'yawInput', property: 'rotation', axis: 'y', scale: 0.4 },
        ],
      },
    },
  };
  const model = new THREE.Group();
  const gear = new THREE.Group();
  const leg = new THREE.Group();
  const flap = new THREE.Group();
  const rudder = new THREE.Group();
  gear.name = 'gear';
  leg.name = 'gear-leg';
  flap.name = 'flap';
  rudder.name = 'rudder';
  gear.add(leg);
  model.add(gear, flap, rudder);
  const visual = createAircraftVisual(model, airplane);
  expect(visual.animation?.missingNodes).toEqual([]);
  const input = {
    power: 0.5,
    pitch: 0,
    roll: 0,
    yaw: 1,
    engine: true,
    gear: false,
    flaps: true,
    brake: false,
  };
  const state = (gearPosition: number, flapPosition: number) =>
    ({ rotorAngle: 0, rpm: 1, gearPosition, flapPosition }) as AircraftStateData;
  // Selected up and flaps down, but still travelling: the parts follow the positions.
  visual.update(state(0.5, 0.25), input, 100);
  expect(gear.rotation.x).toBeCloseTo(0.8);
  expect(leg.visible).toBe(true);
  expect(flap.rotation.x).toBeCloseTo(-0.2);
  expect(rudder.rotation.y).toBeCloseTo(0.4);
  visual.update(state(0, 1), input, 100);
  expect(gear.rotation.x).toBeCloseTo(1.6);
  expect(leg.visible).toBe(false);
  expect(flap.rotation.x).toBeCloseTo(-0.8);
  // Without positions (a host that only animates), the selection still poses the model.
  visual.update({ rotorAngle: 0, rpm: 1 } as AircraftStateData, { ...input, gear: true }, 100);
  expect(gear.rotation.x).toBeCloseTo(0);
  expect(leg.visible).toBe(true);
  visual.dispose();
});
