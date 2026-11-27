import { type AircraftSpec, aircraftGearLayout } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAircraftVisual } from '../src/aircraft';
import { aircraftGearLegs, createAircraftGearVisual } from '../src/aircraft-gear';

/** A tricycle airplane: enough of a spec for the gear, which follows from its size. */
const SPEC = {
  label: 'Test airplane',
  model: 'airplane',
  mass: 1100,
  span: 11,
  length: 8.2,
  height: 2.7,
  centerOfMass: [0, 1.1, 0.2],
  pilotEye: [0, 1.5, 0.4],
  hardLandingSpeed: 4,
  hardLandingRoll: 0.3,
  hardLandingPitch: 0.35,
  maxSupportStep: 0.6,
  collisionProbes: [[0, 1, 0]],
  visual: {
    rotors: [],
    gearNodes: [],
    flaps: [],
    ailerons: [],
    interior: { nodes: ['cockpit'], bindings: [] },
    animation: {
      bindings: [
        // The nose leg swings back as it retracts, and is also carried up into its well.
        {
          node: 'nose-gear',
          source: 'gear',
          property: 'rotation',
          axis: 'x',
          scale: -1.5,
          offset: 1.5,
        },
        {
          node: 'nose-gear',
          source: 'gear',
          property: 'position',
          axis: 'y',
          scale: -0.4,
          offset: 0.4,
        },
      ],
    },
  },
} as unknown as AircraftSpec;

const WHEEL = 0.2;
/** A leg: a strut down from `top`, raked back by `rake` radians, with a wheel standing on y = 0. */
function leg(name: string, x: number, z: number, top: number, rake = 0): THREE.Group {
  const hinge = new THREE.Group();
  hinge.name = name;
  hinge.position.set(x, top, z);
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, top - WHEEL, 0.06));
  strut.position.y = -(top - WHEEL) / 2;
  const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2 * WHEEL, 2 * WHEEL));
  wheel.name = `${name}-tire`;
  wheel.position.y = -(top - WHEEL);
  hinge.add(strut, wheel);
  hinge.rotation.x = rake;
  // Raked, the wheel is brought back down onto the ground.
  hinge.updateMatrixWorld(true);
  const low = new THREE.Box3().setFromObject(wheel, true).min.y;
  hinge.position.y -= low;
  return hinge;
}

function airplane(floorWheel = false): THREE.Group {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 7));
  body.name = 'fuselage';
  body.position.y = 1.5;
  // A control wheel in the cockpit, and a wheel well: neither is a leg. `floorWheel` puts a
  // spare wheel on the cabin floor of an airplane that sits low, down where the tires are.
  const cockpit = new THREE.Group();
  cockpit.name = 'cockpit';
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05));
  yoke.name = 'control-wheel';
  yoke.position.set(0.3, floorWheel ? 0.1 : 1.6, 1);
  cockpit.add(yoke);
  const well = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.8));
  well.name = 'wheel-well';
  well.position.set(1.3, 0.9, 0);
  root.add(body, cockpit, well, leg('nose-gear', 0, 2.6, 0.9, 0.25));
  root.add(leg('main-gear-left', 1.3, -0.3, 0.9), leg('main-gear-right', -1.3, -0.3, 0.9));
  return root;
}

/** Height of a leg's tire above the ground the model stands on. */
function tire(root: THREE.Object3D, name: string): number {
  root.updateMatrixWorld(true);
  const wheel = root.getObjectByName(`${name}-tire`);
  if (!wheel) throw new Error(`No ${name}`);
  return new THREE.Box3().setFromObject(wheel, true).min.y;
}

describe('landing gear on its struts', () => {
  it('finds the legs that stand on the ground, and nothing in the cabin or the wells', () => {
    const root = airplane(true);
    const cockpit = root.getObjectByName('cockpit');
    const legs = aircraftGearLegs(root, SPEC, new Set(cockpit ? [cockpit] : []));
    expect(legs.map((found) => found.node.name).sort()).toEqual([
      'main-gear-left',
      'main-gear-right',
      'nose-gear',
    ]);
    const nose = legs.find((found) => found.node.name === 'nose-gear');
    // A raked leg stands where its tire is, behind its hinge.
    expect(nose?.x).toBeCloseTo(0, 6);
    expect(nose?.z).toBeLessThan(2.6);
    expect(nose?.z).toBeGreaterThan(2.3);
    // A model whose gear is part of its shell has no legs to move.
    const shell = new THREE.Group();
    shell.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 5)));
    expect(createAircraftGearVisual(shell, SPEC)).toBeUndefined();
  });

  it('keeps every tire on the ground the flight model stands the aircraft on', () => {
    const root = airplane();
    const visual = createAircraftGearVisual(root, SPEC);
    if (!visual) throw new Error('No gear');
    const layout = aircraftGearLayout(SPEC);
    // The airframe has sunk and tipped on its struts: nose leg closed 5 cm, left main 3 cm,
    // right main opened 2 cm. Where the ground is from the airframe is the plane through those,
    // at the flight model's own legs.
    const travel = [0.05, 0.03, -0.02];
    const [a, b, c] = (() => {
      const [n, l, r] = layout.legs.map((at, i) => ({
        x: at.x + SPEC.centerOfMass[0],
        z: at.z + SPEC.centerOfMass[2],
        t: travel[i] ?? 0,
      })) as [{ x: number; z: number; t: number }, typeof n, typeof n];
      const bx = (l.t - r.t) / (l.x - r.x);
      const cz = (n.t - (l.t + r.t) / 2) / (n.z - l.z);
      return [n.t - cz * n.z, bx, cz];
    })();
    visual.release();
    visual.update({ wheels: { spin: [0, 0, 0], load: [1, 1, 1], travel } }, 1);
    for (const found of visual.legs) {
      const expected = a + b * found.x + c * found.z;
      // Each tire is up its strut by what the ground stands above the airframe's rest plane
      // there: the model's wheels are not where the flight model's legs are.
      expect(tire(root, found.node.name)).toBeCloseTo(expected, 6);
    }
    // Taking it back out leaves the model as authored.
    visual.release();
    for (const found of visual.legs) expect(tire(root, found.node.name)).toBeCloseTo(0, 9);
  });

  it('hangs at the full reach of the struts in flight and stops at twice their travel', () => {
    const root = airplane();
    const visual = createAircraftGearVisual(root, SPEC);
    if (!visual) throw new Error('No gear');
    const layout = aircraftGearLayout(SPEC);
    const hanging = layout.legs.map(() => -layout.reach);
    visual.update({ wheels: { spin: [0, 0, 0], load: [0, 0, 0], travel: hanging } }, 1);
    for (const found of visual.legs)
      expect(tire(root, found.node.name)).toBeCloseTo(-layout.reach, 6);
    visual.release();
    // A tail pressed far past its stop (a taildragger's squat) does not swallow the wheel.
    visual.update({ wheels: { spin: [0, 0, 0], load: [9, 9, 9], travel: [1, 1, 1] } }, 1);
    for (const found of visual.legs)
      expect(tire(root, found.node.name)).toBeCloseTo(2 * layout.travel, 6);
    visual.release();
    // A host that reports no travel (ambient traffic) leaves the gear as authored.
    const plain = createAircraftGearVisual(airplane(), SPEC);
    plain?.update({}, 0.9);
    expect(plain?.legs.every((found) => found.node.position.y > 0)).toBe(true);
  });

  it('runs the struts out as the legs lock down, and has them in before they leave', () => {
    const root = airplane();
    const visual = createAircraftGearVisual(root, SPEC);
    if (!visual) throw new Error('No gear');
    const layout = aircraftGearLayout(SPEC);
    const main = (): number => tire(root, 'main-gear-left');
    visual.update(
      {
        wheels: { spin: [0, 0, 0], load: [0, 0, 0], travel: layout.legs.map(() => -layout.reach) },
      },
      1,
    );
    expect(main()).toBeCloseTo(-layout.reach, 6);
    // The gear is selected up: the state stops reporting legs, and the struts come in before
    // the legs have gone far.
    visual.release();
    visual.update({}, 0.99);
    expect(main()).toBeLessThan(-0.9 * layout.reach);
    visual.release();
    visual.update({}, 0.9);
    expect(main()).toBeCloseTo(-layout.reach / 2, 6);
    visual.release();
    visual.update({}, 0.8);
    expect(main()).toBeCloseTo(0, 9);
    visual.release();
    visual.update({}, 0);
    expect(main()).toBeCloseTo(0, 9);
  });

  it('rides on the struts through the aircraft visual, around bindings that move the same leg', () => {
    const root = airplane();
    const visual = createAircraftVisual(root, SPEC);
    expect(visual.gear?.legs).toHaveLength(3);
    const nose = root.getObjectByName('nose-gear');
    if (!nose) throw new Error('No nose leg');
    const rest = nose.position.clone();
    const input = {
      power: 0,
      pitch: 0,
      roll: 0,
      yaw: 0,
      brake: true,
      engine: true,
      gear: true,
      flaps: false,
    };
    const state = (travel: number[], gearPosition = 1) =>
      ({
        gearPosition,
        rotorAngle: 0,
        rpm: 0,
        airspeed: 0,
        ...(gearPosition >= 1 ? { wheels: { spin: [0, 0, 0], load: [1, 1, 1], travel } } : {}),
      }) as never;
    // Braking: the nose leg closes. Frame after frame it stays where the state puts it, with
    // no drift from the binding writing the same position.
    for (let frame = 0; frame < 5; frame++) visual.update(state([0.06, 0, 0]), input, 0);
    // The model's main wheels stand a little behind the flight model's: they open a touch.
    expect(Math.abs(tire(root, 'main-gear-left'))).toBeLessThan(0.01);
    expect(tire(root, 'nose-gear')).toBeGreaterThan(0.05);
    expect(tire(root, 'nose-gear')).toBeLessThan(0.065);
    for (let frame = 0; frame < 5; frame++) visual.update(state([0, 0, 0]), input, 0);
    expect(nose.position.distanceTo(rest)).toBeLessThan(1e-9);
    // Retracted, the leg is where its binding carries it and nowhere else.
    for (let frame = 0; frame < 3; frame++)
      visual.update(state([0, 0, 0], 0), { ...input, gear: false }, 500);
    expect(nose.position.y).toBeCloseTo(rest.y + 0.4, 9);
    expect(nose.position.x).toBeCloseTo(rest.x, 9);
    expect(nose.position.z).toBeCloseTo(rest.z, 9);
  });
});
