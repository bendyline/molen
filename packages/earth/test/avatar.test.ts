import { FigureGeometryCache, resolveFigureDescriptor } from '@bendyline/molen-figures/client';
import { Mounted } from '@bendyline/molen-kernel/vehicles';
import { Transform } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EarthAvatar, type EarthAvatarFrame } from '../src/client';
import { EarthAircraft } from '../src/client/aircraft';
import { EarthVehicles } from '../src/client/vehicles';
import { ENTITY_TYPES } from './entity-types';

const PLAYER = 'world-player';
const P51 = 'molen.entities.aircraft.p51d';
const SEDAN = 'molen.entities.vehicle.sedan';
const PERSON = { preset: 'human.adult', height: 1.9 } as const;
const CAMERA: [number, number, number] = [0, 14, 6];
const GROUND = 12;
const RIG = new FigureGeometryCache().rigFor(resolveFigureDescriptor(PERSON));

function setup(cockpitFloor?: (id: string) => number | undefined) {
  const root = new THREE.Group();
  const vehicles = new EarthVehicles({
    root,
    sampleHeight: () => GROUND,
    loadModel: async () => new THREE.Group(),
    types: ENTITY_TYPES,
  });
  const avatar = new EarthAvatar({
    world: vehicles.world,
    parent: root,
    ...(cockpitFloor ? { cockpitFloor } : {}),
  });
  const body = (): THREE.SkinnedMesh | undefined => {
    root.updateMatrixWorld(true);
    let found: THREE.SkinnedMesh | undefined;
    root.traverseVisible((object) => {
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) found = object as THREE.SkinnedMesh;
    });
    return found;
  };
  /** Every joint of the body but the root, which stays at the figure's own origin. */
  const bones = (): THREE.Vector3[] =>
    RIG.joints
      .filter((joint) => joint.parent >= 0)
      .map((joint) =>
        (body()?.skeleton.bones[RIG.index[joint.name] as number] as THREE.Bone).getWorldPosition(
          new THREE.Vector3(),
        ),
      );
  const frame = (over: Partial<EarthAvatarFrame> = {}): void =>
    avatar.update(1 / 30, { visible: true, ...over }, CAMERA);
  return { root, vehicles, avatar, body, bones, frame };
}

describe('EarthAvatar', () => {
  it('stands at the walker, faces the way they go, and hides in first person', () => {
    const { avatar, body, bones, frame, vehicles } = setup();
    const feet: [number, number, number] = [3, GROUND, -5];
    frame({ feet });
    // No figure yet.
    expect(avatar.shown).toBe(false);
    avatar.setFigure(PERSON);
    frame({ feet, heading: 0 });
    expect(avatar.shown).toBe(true);
    const height = Math.max(...bones().map((p) => p.y)) - GROUND;
    expect(height).toBeGreaterThan(1.5);
    expect(height).toBeLessThan(2);
    expect(Math.min(...bones().map((p) => p.y))).toBeGreaterThan(GROUND - 0.05);
    const root = (): THREE.Object3D => {
      let object = body() as THREE.Object3D;
      while (object.parent?.name !== 'ambient:figures') object = object.parent as THREE.Object3D;
      return object;
    };
    const facing = (): THREE.Vector3 =>
      new THREE.Vector3(0, 0, 1).applyQuaternion(root().quaternion);
    // Standing it faces where the walker looks (north, -Z), walking where they go (east, +X).
    for (let i = 0; i < 60; i++) frame({ feet, heading: 0 });
    expect(facing().z).toBeCloseTo(-1, 3);
    for (let i = 0; i < 60; i++) frame({ feet, heading: 0, velocity: [1.5, 0] });
    expect(facing().x).toBeCloseTo(1, 3);
    frame({ feet, visible: false });
    expect(avatar.shown).toBe(false);
    avatar.dispose();
    vehicles.dispose();
  });

  it('takes another body, refuses an invalid one, and goes away with its parent group', () => {
    const { root, avatar, body, frame, vehicles } = setup();
    const feet: [number, number, number] = [0, GROUND, 0];
    avatar.setFigure(PERSON);
    frame({ feet });
    const before = body();
    avatar.setFigure({ preset: 'human.adult', height: 1.6 });
    frame({ feet });
    expect(body()).not.toBe(before);
    expect(() => avatar.setFigure({ preset: 'no.such.person' as never })).toThrow();
    expect(avatar.figure).toMatchObject({ height: 1.6 });
    avatar.setFigure(undefined);
    frame({ feet });
    expect(avatar.shown).toBe(false);
    avatar.dispose();
    expect(root.getObjectByName('ambient:figures')).toBeUndefined();
    vehicles.dispose();
  });

  it("sits in the pilot's seat with its feet on the cockpit floor", () => {
    const { root, vehicles, avatar, bones, frame } = setup(() => 1.46);
    const aircraft = new EarthAircraft({
      world: vehicles.world,
      root,
      sampleHeight: () => GROUND,
      loadModel: async () => new THREE.Group(),
      types: ENTITY_TYPES,
      vehicleEnvironment: vehicles.environment,
    });
    aircraft.spawn(P51, { position: [0, GROUND, 0], heading: 0 }, { id: 'p51' });
    const eye = ENTITY_TYPES.component<{ spec: { pilotEye: [number, number, number] } }>(
      P51,
      'aircraft',
    ).spec.pilotEye;
    const at = new THREE.Vector3(...eye).add(new THREE.Vector3(0, GROUND, 0));
    vehicles.world.set(PLAYER, Mounted, { vehicle: 'p51', seat: 'driver' });
    vehicles.world.set(PLAYER, Transform, { pos: at.toArray(), rot: [0, 0, 0, 1] });
    avatar.setFigure(PERSON);
    // From outside the cockpit; the walker's feet are ignored while seated.
    frame({ feet: [50, GROUND, 50] });
    expect(avatar.shown).toBe(true);
    // The whole body is in the seat: head about the eye, nothing below the floor.
    for (const bone of bones()) expect(Math.hypot(bone.x - at.x, bone.z - at.z)).toBeLessThan(1.4);
    expect(Math.max(...bones().map((p) => p.y))).toBeGreaterThan(at.y - 0.2);
    expect(Math.min(...bones().map((p) => p.y))).toBeGreaterThan(GROUND + 1.46 - 0.05);
    frame({ visible: false });
    expect(avatar.shown).toBe(false);
    avatar.dispose();
    aircraft.dispose();
    vehicles.dispose();
  });

  it("keeps a tall driver's feet above the road", () => {
    const { vehicles, avatar, bones, frame } = setup();
    const id = vehicles.spawn(SEDAN, [0, GROUND, 0], 0, { id: 'car' });
    expect(id).toBe('car');
    expect(vehicles.board('car')).toBe(true);
    vehicles.update(1 / 30, { throttle: 0, steering: 0, brake: true });
    avatar.setFigure(PERSON);
    frame();
    expect(avatar.shown).toBe(true);
    expect(Math.min(...bones().map((p) => p.y))).toBeGreaterThan(GROUND + 0.1);
    avatar.dispose();
    vehicles.dispose();
  });
});
