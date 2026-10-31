import type { AircraftSpec, AircraftStateData, LiveryData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createAircraftVisual } from '../src/aircraft';
import { createAircraftPropellers } from '../src/aircraft-propellers';

const engine = {
  id: 'left',
  position: [0, 0, 0] as [number, number, number],
  thrustAxis: [0, 0, 1] as [number, number, number],
  power: 100000,
  idleRpm: 0.15,
  spoolRate: 0.2,
  rotorAngularSpeed: 200,
};
const spec: AircraftSpec = {
  label: 'Propeller test',
  model: 'airplane',
  mass: 1000,
  span: 10,
  length: 8,
  height: 3,
  centerOfMass: [0, 1, 0],
  pilotEye: [0, 2, 0],
  engine,
  hardLandingSpeed: 4,
  hardLandingRoll: 0.3,
  hardLandingPitch: 0.3,
  maxSupportStep: 0.5,
  collisionProbes: [[0, 0, 0]],
  visual: {
    rotors: [{ node: 'prop', axis: 'z', multiplier: 1 }],
    gearNodes: [],
    flaps: [],
    ailerons: [],
  },
};
const state = (rpm: number): AircraftStateData => ({ rpm, rotorAngle: 0 }) as AircraftStateData;
const input = {
  power: 1,
  pitch: 0,
  roll: 0,
  yaw: 0,
  engine: true,
  gear: true,
  flaps: false,
  brake: false,
};

function fixture(name = 'prop') {
  const model = new THREE.Group();
  const rotor = new THREE.Group();
  rotor.name = name;
  rotor.position.set(0, 1.5, 3);
  model.add(rotor);
  const material = new THREE.MeshStandardMaterial({ color: '#222222' });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 0.06), material);
  blade.position.y = 0.95;
  blade.castShadow = true;
  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: '#edba38' }),
  );
  tip.position.y = 1.76;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), material);
  rotor.add(blade, tip, hub);
  // The same material on the airframe must never fade with the propeller.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 4), material);
  model.add(body);
  return { model, rotor, blade, tip, hub, body, material };
}

function disk(model: THREE.Object3D, name = 'prop') {
  return model.getObjectByName(`propeller-blur:${name}`) as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >;
}

describe('airplane propeller blur', () => {
  it('crossfades actual shaft speed, keeps hubs solid and restores exact materials on spool-down', () => {
    const f = fixture();
    const visual = createAircraftVisual(f.model, spec);
    const blur = disk(f.model);
    visual.update(state(0), input, 0);
    expect(blur.visible).toBe(false);
    expect(f.blade.material).toBe(f.material);
    visual.update(state(0.2), input, 0);
    expect(blur.visible).toBe(true);
    expect(blur.material.opacity).toBeCloseTo(0.5);
    expect(f.blade.material.opacity).toBeCloseTo(0.5);
    expect(f.blade.material.depthWrite).toBe(false);
    expect(f.body.material).toBe(f.material);
    expect(f.hub.material).toBe(f.material);
    expect(f.material.opacity).toBe(1);
    expect(f.blade.castShadow).toBe(false);
    // The switch has already been turned off, but the shaft is still at operating speed.
    visual.update(state(1), { ...input, power: 0, engine: false }, 0);
    expect(blur.material.opacity).toBe(1);
    expect(f.blade.material.visible).toBe(false);
    expect(f.tip.material.visible).toBe(false);
    expect(f.hub.material.visible).toBe(true);
    visual.update(state(0), input, 0);
    expect(f.blade.material).toBe(f.material);
    expect(f.blade.castShadow).toBe(true);
    expect(blur.visible).toBe(false);
    visual.dispose();
  });

  it('uses independent engine RPM and absolute binding speed, with a first-engine default', () => {
    const left = fixture('left'),
      right = fixture('right');
    left.model.add(right.rotor);
    const visual = createAircraftPropellers(left.model, {
      ...spec,
      engine: undefined,
      engines: [engine, { ...engine, id: 'right' }],
      visual: {
        ...spec.visual,
        rotors: [
          { node: 'left', axis: 'z', multiplier: 1 },
          { node: 'right', axis: 'z', multiplier: -2, engine: 'right' },
        ],
      },
    });
    visual.update({
      ...state(1),
      engines: {
        left: { rpm: 0, rotorAngle: 0, failed: false, thrust: 0 },
        right: { rpm: 0.1, rotorAngle: 0, failed: false, thrust: 0 },
      },
    });
    expect(disk(left.model, 'left').visible).toBe(false);
    expect(disk(left.model, 'right').material.opacity).toBeCloseTo(0.5);
    visual.dispose();
  });

  it('derives radius, blade-plane offset and tip colors under translated and tilted parents', () => {
    const f = fixture();
    f.model.position.set(20, 30, 40);
    f.model.rotation.y = 0.8;
    f.rotor.rotation.x = 1.2;
    f.blade.position.z = 0.3;
    f.tip.position.z = 0.3;
    const visual = createAircraftPropellers(f.model, spec);
    const blur = disk(f.model);
    expect(blur.parent).toBe(f.rotor);
    blur.geometry.computeBoundingBox();
    expect(blur.geometry.boundingBox?.max.x).toBeCloseTo(Math.hypot(1.82, 0.07));
    expect(blur.geometry.boundingBox?.min.z).toBeCloseTo(0.3);
    expect(blur.geometry.boundingBox?.max.z).toBeCloseTo(0.3);
    const colors = blur.geometry.getAttribute('color');
    let yellow = false;
    for (let i = 0; i < colors.count; i++) {
      expect(colors.getW(i)).toBeLessThanOrEqual(0.45);
      if (colors.getW(i) > 0 && colors.getX(i) > colors.getZ(i) * 2) yellow = true;
    }
    expect(yellow).toBe(true);
    expect(blur.castShadow).toBe(false);
    expect(blur.material.depthWrite).toBe(false);
    visual.dispose();
  });

  it('restores sharp detached debris and disposes only its own resources', () => {
    const f = fixture();
    const visual = createAircraftVisual(f.model, {
      ...spec,
      collisionParts: [
        {
          id: 'prop',
          role: 'rotor',
          center: [0, 1.5, 3],
          probes: [[0, 1.5, 3]],
          nodes: ['prop'],
          massFraction: 0.01,
          radius: 1.82,
          breakSpeed: 12,
        },
      ],
    });
    visual.update(state(1), input, 0);
    const blur = disk(f.model);
    const faded = f.blade.material;
    const fadeDispose = vi.spyOn(faded, 'dispose');
    const diskDispose = vi.spyOn(blur.geometry, 'dispose');
    visual.update(
      {
        ...state(1),
        damage: { prop: { integrity: 0, detached: true } },
        debris: [
          {
            part: 'prop',
            pos: [0, 0, 0],
            rot: [0, 0, 0, 1],
            velocity: [0, 0, 0],
            angularVelocity: [0, 0, 0],
            age: 0,
          },
        ],
      },
      input,
      0,
    );
    const debris = f.model.getObjectByName('debris:prop');
    expect(debris).toBeDefined();
    expect(disk(debris as THREE.Object3D).visible).toBe(false);
    expect(f.blade.material).toBe(f.material);
    expect(f.material.visible).toBe(true);
    visual.setLivery(undefined);
    expect(fadeDispose).toHaveBeenCalledOnce();
    expect(diskDispose).toHaveBeenCalledOnce();
    visual.update(state(1), input, 0);
    expect(disk(f.model).visible).toBe(true);
    expect(f.rotor.visible).toBe(true);
    visual.dispose();
  });

  it('leaves helicopter rotors, jet fans, and empty bindings alone', () => {
    for (const other of [
      { ...spec, model: 'helicopter' as const },
      { ...spec, engine: { ...engine, propulsion: 'jet' as const } },
      {
        ...spec,
        visual: { ...spec.visual, rotors: [{ node: 'absent', axis: 'z' as const, multiplier: 1 }] },
      },
    ]) {
      const f = fixture();
      const visual = createAircraftPropellers(f.model, other);
      visual.update(state(1));
      expect(disk(f.model)).toBeUndefined();
      expect(f.blade.material).toBe(f.material);
      visual.dispose();
    }
  });

  it('keeps the blur independent of frame cadence and rotor phase', () => {
    const f = fixture();
    const visual = createAircraftVisual(f.model, spec);
    const blur = disk(f.model);
    for (const hz of [15, 30, 60, 144]) {
      for (let frame = 0; frame < 4; frame++) {
        visual.update(
          { ...state(1), rotorAngle: (frame * engine.rotorAngularSpeed) / hz },
          input,
          0,
        );
        expect(blur.material.opacity).toBe(1);
        expect(f.blade.material.visible).toBe(false);
      }
    }
    visual.dispose();
  });

  it('fades blade decals without counting their surface twice in the disk', () => {
    const f = fixture();
    const decal = new THREE.Mesh(
      f.blade.geometry,
      new THREE.MeshBasicMaterial({ opacity: 0.7, transparent: true }),
    );
    decal.userData.liveryMarking = true;
    f.blade.add(decal);
    const original = decal.material;
    const visual = createAircraftPropellers(f.model, spec);
    visual.update(state(0.2));
    expect(decal.material.opacity).toBeCloseTo(0.35);
    visual.update(state(1));
    expect(decal.material.visible).toBe(false);
    expect(original.visible).toBe(true);
    visual.dispose();
    expect(decal.material).toBe(original);
  });

  it('rebuilds blade colors after a livery change without retaining the previous fade', () => {
    const f = fixture();
    f.material.name = 'blade-paint';
    const livery: LiveryData = {
      selected: 'red',
      slots: { blades: { materials: ['blade-paint'] } },
      variants: [
        {
          id: 'red',
          label: 'Red',
          paints: { blades: { color: '#c22b24' } },
          provenance: { kind: 'original', note: 'Test', references: [] },
        },
      ],
    };
    const visual = createAircraftVisual(f.model, spec);
    visual.update(state(1), input, 0);
    visual.setLivery(livery);
    const red = f.blade.material;
    expect(red.opacity).toBe(1);
    expect(red.color.getHexString()).toBe('c22b24');
    visual.update(state(1), input, 0);
    const colors = disk(f.model).geometry.getAttribute('color');
    expect(colors.getX(65 * 24)).toBeGreaterThan(colors.getZ(65 * 24) * 2);
    visual.setLivery(undefined);
    expect(f.blade.material).toBe(f.material);
    expect(f.material.color.getHexString()).toBe('222222');
    expect(f.material.visible).toBe(true);
    visual.dispose();
  });

  it.each([
    'x',
    'y',
    'z',
  ] as const)('aligns the disk with a %s-axis rotor and deduplicates named child hubs', (axis) => {
    const f = fixture();
    f.blade.position.set(0, 0, 0);
    f.blade.geometry.translate(0, 0.95, 0);
    if (axis === 'x') f.blade.geometry.rotateY(Math.PI / 2);
    if (axis === 'y') f.blade.geometry.rotateX(Math.PI / 2);
    f.tip.removeFromParent();
    f.hub.name = 'prop';
    const visual = createAircraftPropellers(f.model, {
      ...spec,
      visual: { ...spec.visual, rotors: [{ node: 'prop', axis, multiplier: 1 }] },
    });
    const disks: THREE.Object3D[] = [];
    f.model.traverse((node) => {
      if (node.name === 'propeller-blur:prop') disks.push(node);
    });
    expect(disks).toHaveLength(1);
    const geometry = disk(f.model).geometry;
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.getSize(new THREE.Vector3())[axis]).toBeLessThan(1e-6);
    visual.dispose();
  });
});
