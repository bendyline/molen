import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WalkCollision } from '../src/navigation/walk-collision';
import {
  RUN_SPEED,
  WALK_SPEED,
  WalkController,
  type WalkInput,
} from '../src/navigation/walk-controller';

const STILL: WalkInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
const flat = (): number => 0;

function box(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));
  mesh.position.set(x, y, z);
  return mesh;
}

function scene(): { root: THREE.Group; collision: WalkCollision; walker: WalkController } {
  const root = new THREE.Group();
  root.add(box(200, 1, 200, 0, -0.5, 0));
  const collision = new WalkCollision();
  collision.update(root, 0, 0);
  const walker = new WalkController();
  walker.reset(0, 0);
  expect(walker.place(collision, flat)).toBe(true);
  return { root, collision, walker };
}

function advance(
  walker: WalkController,
  collision: WalkCollision,
  seconds: number,
  input: Partial<WalkInput> = {},
  hz = 60,
): void {
  for (let i = 0; i < seconds * hz; i++)
    walker.update(1 / hz, { ...STILL, ...input }, collision, flat);
}

describe('walk physics', () => {
  it('walks at human speed with equal cardinal and diagonal distance', () => {
    const a = scene();
    const b = scene();
    advance(a.walker, a.collision, 2, { forward: 1 });
    advance(b.walker, b.collision, 2, { forward: 1, right: 1 });
    expect(a.walker.feet.x).toBeCloseTo(WALK_SPEED * 2, 2);
    expect(Math.hypot(b.walker.feet.x, b.walker.feet.z)).toBeCloseTo(WALK_SPEED * 2, 2);
    expect(a.walker.feet.y).toBeCloseTo(0, 3);
    expect(a.walker.grounded).toBe(true);
  });

  it('runs at a bounded speed and agrees across rendering frame rates', () => {
    const a = scene();
    const b = scene();
    advance(a.walker, a.collision, 2, { forward: 1, sprint: true }, 30);
    advance(b.walker, b.collision, 2, { forward: 1, sprint: true }, 120);
    expect(a.walker.feet.x).toBeCloseTo(RUN_SPEED * 2, 2);
    expect(a.walker.feet.distanceTo(b.walker.feet)).toBeLessThan(0.001);
  });

  it('jumps, falls under gravity, lands, and requires another press to jump again', () => {
    const { walker, collision } = scene();
    advance(walker, collision, 0.3, { jump: true });
    expect(walker.feet.y).toBeGreaterThan(0.8);
    expect(walker.grounded).toBe(false);
    advance(walker, collision, 2, { jump: true });
    expect(walker.feet.y).toBeCloseTo(0, 3);
    expect(walker.grounded).toBe(true);
    advance(walker, collision, 0.1);
    advance(walker, collision, 0.1, { jump: true });
    expect(walker.feet.y).toBeGreaterThan(0.3);
  });

  it('cannot run through a thin building wall and slides along it', () => {
    const { root, walker, collision } = scene();
    root.add(box(0.1, 10, 40, 2, 5, 0));
    collision.update(root, 0, 0);
    advance(walker, collision, 2, { forward: 1, right: 1, sprint: true }, 10);
    expect(walker.feet.x).toBeLessThanOrEqual(1.651);
    expect(walker.feet.x).toBeGreaterThan(1.6);
    expect(walker.feet.z).toBeGreaterThan(5);
    expect(walker.feet.y).toBeLessThan(0.01);
  });

  it('does not climb an almost vertical slope by holding forward', () => {
    const { root, walker, collision } = scene();
    const ramp = new THREE.Mesh(new THREE.PlaneGeometry(30, 30));
    ramp.rotation.set(-Math.PI / 2, -Math.PI / 2.4, 0);
    ramp.position.x = 3;
    root.add(ramp);
    collision.update(root, 0, 0);
    advance(walker, collision, 3, { forward: 1, sprint: true });
    expect(walker.feet.y).toBeLessThan(0.1);
    expect(walker.feet.x).toBeLessThan(3);
  });

  it('waits for missing terrain and resumes when it arrives', () => {
    const { walker, collision } = scene();
    const before = walker.feet.clone();
    walker.update(0.1, { ...STILL, forward: 1 }, collision, () => undefined);
    expect(walker.waitingForTerrain).toBe(true);
    expect(walker.feet.equals(before)).toBe(true);
    advance(walker, collision, 1, { forward: 1 });
    expect(walker.waitingForTerrain).toBe(false);
    expect(walker.feet.x).toBeGreaterThan(1);
  });

  it('places on visible ground and finds open space beside a building', () => {
    const { root, walker, collision } = scene();
    root.add(box(6, 9, 6, 0, 4.5, 0));
    collision.update(root, 0, 0);
    walker.reset(0, 0);
    expect(walker.place(collision, flat)).toBe(true);
    expect(Math.max(Math.abs(walker.feet.x), Math.abs(walker.feet.z))).toBeGreaterThan(3.29);
    expect(walker.feet.y).toBeLessThan(0.1);
  });

  it('recovers when refined terrain arrives above the old surface', () => {
    const { root, walker, collision } = scene();
    (root.children[0] as THREE.Object3D).position.y += 5;
    collision.update(root, 0, 0);
    for (let i = 0; i < 60; i++) walker.update(1 / 60, STILL, collision, () => 5);
    expect(walker.feet.y).toBeCloseTo(5, 3);
    expect(walker.grounded).toBe(true);
  });

  it('falls and lands when a surface below the player drops away', () => {
    const { root, walker, collision } = scene();
    (root.children[0] as THREE.Object3D).position.y -= 3;
    collision.update(root, 0, 0);
    for (let i = 0; i < 12; i++) walker.update(1 / 60, STILL, collision, () => -3);
    expect(walker.feet.y).toBeLessThan(-0.1);
    expect(walker.feet.y).toBeGreaterThan(-1);
    expect(walker.grounded).toBe(false);
    for (let i = 0; i < 120; i++) walker.update(1 / 60, STILL, collision, () => -3);
    expect(walker.feet.y).toBeCloseTo(-3, 3);
  });

  it('does not drift its spawn search when no open ground exists', () => {
    const { root, walker, collision } = scene();
    root.add(box(100, 9, 100, 0, 4.5, 0));
    collision.update(root, 0, 0);
    walker.reset(0, 0);
    expect(walker.place(collision, flat)).toBe(false);
    expect(walker.feet.toArray()).toEqual([0, 0, 0]);
    expect(walker.ready).toBe(false);
  });
});

describe('streamed walk collision', () => {
  it('collides with instances and releases hidden or evicted tiles', () => {
    const { root, walker, collision } = scene();
    const tile = new THREE.Group();
    const wall = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, 10, 40),
      new THREE.MeshBasicMaterial(),
      1,
    );
    wall.setMatrixAt(0, new THREE.Matrix4().makeTranslation(2, 5, 0));
    tile.add(wall);
    root.add(tile);
    collision.update(root, 0, 0);
    advance(walker, collision, 2, { forward: 1 });
    expect(walker.feet.x).toBeLessThan(1.651);
    tile.visible = false;
    collision.update(root, walker.feet.x, walker.feet.z);
    advance(walker, collision, 1, { forward: 1 });
    expect(walker.feet.x).toBeGreaterThan(3);
    tile.visible = true;
    root.remove(tile);
    collision.update(root, walker.feet.x, walker.feet.z);
    advance(walker, collision, 1, { forward: -1 });
    expect(walker.feet.x).toBeLessThan(2);
  });

  it('keeps meter-scale precision through floating-origin rebases', () => {
    const { root, walker, collision } = scene();
    const worldRoot = new THREE.Group();
    worldRoot.add(root);
    for (const child of root.children) child.position.x += 9_000_000;
    collision.update(root, 9_000_000, 0);
    walker.reset(9_000_000, 0);
    expect(walker.place(collision, flat)).toBe(true);
    worldRoot.position.set(-9_000_000, 0, 4_000_000);
    collision.update(root, 9_000_000, 0);
    advance(walker, collision, 1, { forward: 1 });
    expect(walker.feet.x - 9_000_000).toBeCloseTo(WALK_SPEED, 2);
    expect(walker.feet.y).toBeCloseTo(0, 3);
  });
});

it('keeps walking collision stable as distant regions stream, but refreshes nearby obstacles', () => {
  const { root, collision } = scene();
  const build = vi.spyOn(collision.octree, 'build');
  const distant = box(10, 20, 10, 4000, 10, 4000);
  root.add(distant);
  collision.update(root, 0, 0);
  expect(build).not.toHaveBeenCalled();
  distant.visible = false;
  collision.update(root, 0, 0);
  expect(build).not.toHaveBeenCalled();
  const wall = box(1, 5, 10, 4, 2.5, 0);
  root.add(wall);
  collision.update(root, 0, 0);
  expect(build).toHaveBeenCalledTimes(1);
  wall.visible = false;
  collision.update(root, 0, 0);
  expect(build).toHaveBeenCalledTimes(2);
  // A distant-to-near teleport must build the destination neighborhood immediately.
  distant.visible = true;
  collision.update(root, 4000, 4000);
  expect(build).toHaveBeenCalledTimes(3);
  expect(collision.origin.x).toBe(4000);
});

describe('collision neighborhood options', () => {
  it('rescans on the interval, on movement, or when invalidated', () => {
    let clock = 0;
    const root = new THREE.Group();
    root.add(box(200, 1, 200, 0, -0.5, 0));
    const collision = new WalkCollision({ rescanIntervalMs: 200, now: () => clock });
    collision.update(root, 0, 0);
    const build = vi.spyOn(collision.octree, 'build');
    const wall = box(1, 5, 10, 4, 2.5, 0);
    root.add(wall);
    collision.update(root, 0, 0);
    expect(build).not.toHaveBeenCalled();
    clock = 199;
    collision.update(root, 0, 0);
    expect(build).not.toHaveBeenCalled();
    clock = 200;
    collision.update(root, 0, 0);
    expect(build).toHaveBeenCalledTimes(1);
    wall.visible = false;
    collision.update(root, 0, 0);
    expect(build).toHaveBeenCalledTimes(1);
    collision.invalidate();
    collision.update(root, 0, 0);
    expect(build).toHaveBeenCalledTimes(2);
    wall.visible = true;
    collision.update(root, 6, 0);
    expect(build).toHaveBeenCalledTimes(3);
    expect(collision.origin.x).toBe(6);
  });

  it('bounds the neighborhood vertically for airborne subjects', () => {
    const root = new THREE.Group();
    root.add(box(200, 1, 200, 0, -0.5, 0));
    const collision = new WalkCollision({ verticalRadius: 20 });
    const down = new THREE.Vector3(0, -1, 0);
    collision.update(root, 0, 0, 100);
    expect(
      collision.octree.rayIntersect(new THREE.Ray(new THREE.Vector3(0, 105, 0), down)),
    ).toBeFalsy();
    // Descending by more than the rebuild distance recenters the band onto the ground.
    collision.update(root, 0, 0, 10);
    const hit = collision.octree.rayIntersect(new THREE.Ray(new THREE.Vector3(0, 15, 0), down));
    expect(hit ? hit.distance : undefined).toBe(15);
    // Without a y the same tree spans the whole column, as a walker's placement ray needs.
    const column = new WalkCollision({ verticalRadius: 20 });
    column.update(root, 0, 0);
    const far = column.octree.rayIntersect(new THREE.Ray(new THREE.Vector3(0, 10_000, 0), down));
    expect(far ? far.distance : undefined).toBe(10_000);
  });

  it('honors a wider radius and rebuild distance', () => {
    const root = new THREE.Group();
    // Finely tessellated ground: triangles are kept whole, so coarse ones would reach past the radius.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 100, 100));
    ground.rotation.x = -Math.PI / 2;
    root.add(ground);
    const collision = new WalkCollision({ radius: 48, rebuildDistance: 24 });
    collision.update(root, 0, 0);
    const build = vi.spyOn(collision.octree, 'build');
    const down = new THREE.Vector3(0, -1, 0);
    const at = (x: number): number | undefined => {
      const hit = collision.octree.rayIntersect(new THREE.Ray(new THREE.Vector3(x, 5, 0), down));
      return hit ? hit.distance : undefined;
    };
    expect(at(40)).toBe(5);
    expect(at(60)).toBeUndefined();
    collision.update(root, 20, 0);
    expect(build).not.toHaveBeenCalled();
    collision.update(root, 24, 0);
    expect(build).toHaveBeenCalledTimes(1);
    expect(() => new WalkCollision({ radius: 10, rebuildDistance: 10 })).toThrow(RangeError);
  });

  it('walks large geometries through their spatial index with the same result', () => {
    const root = new THREE.Group();
    // 80,000 triangles: well above the indexing threshold, like a terrain tile.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800, 200, 200));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 3;
    root.add(ground);
    const collision = new WalkCollision();
    collision.update(root, 100, -50);
    const down = new THREE.Vector3(0, -1, 0);
    const heightAt = (x: number, z: number): number | undefined => {
      const hit = collision.octree.rayIntersect(
        new THREE.Ray(new THREE.Vector3(x - collision.origin.x, 20, z - collision.origin.z), down),
      );
      return hit ? hit.position.y : undefined;
    };
    expect(heightAt(100, -50)).toBeCloseTo(3, 6);
    expect(heightAt(120, -30)).toBeCloseTo(3, 6);
    expect(heightAt(77, -73)).toBeCloseTo(3, 6);
    expect(heightAt(130, -50)).toBeUndefined();
    const walker = new WalkController();
    walker.reset(100, -50);
    expect(walker.place(collision, () => 3)).toBe(true);
    for (let i = 0; i < 60; i++)
      walker.update(1 / 60, { ...STILL, forward: 1 }, collision, () => 3);
    expect(walker.feet.y).toBeCloseTo(3, 3);
    expect(walker.grounded).toBe(true);
  });
});
