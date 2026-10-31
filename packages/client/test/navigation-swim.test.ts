import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WalkCollision } from '../src/navigation/walk-collision';
import {
  SWIM_SPEED,
  WALK_EYE_HEIGHT,
  WalkController,
  type WalkInput,
} from '../src/navigation/walk-controller';

const STILL: WalkInput = { forward: 0, right: 0, yaw: 0, sprint: false, jump: false };
const ground = (x: number): number => -x / 2;

function beach() {
  const root = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(60, 40).rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) positions.setY(i, ground(positions.getX(i)));
  root.add(new THREE.Mesh(geometry));
  const collision = new WalkCollision();
  collision.update(root, 0, 0);
  const walker = new WalkController();
  walker.sampleWaterHeight = (x) => (x > 0 ? 0 : null);
  walker.reset(-2, 0);
  expect(walker.place(collision, ground)).toBe(true);
  return { walker, collision, root };
}

function advance(
  walker: WalkController,
  collision: WalkCollision,
  seconds: number,
  input: Partial<WalkInput> = {},
  hz = 60,
  sampleHeight: (x: number, z: number) => number | undefined = ground,
): void {
  for (let i = 0; i < seconds * hz; i++)
    walker.update(1 / hz, { ...STILL, ...input }, collision, sampleHeight);
}

describe('walking and swimming transitions', () => {
  it('wades into a sloping beach, swims with its head above water, and walks back out', () => {
    const { walker, collision } = beach();
    advance(walker, collision, 2, { forward: 1 });
    expect(walker.feet.x).toBeGreaterThan(0);
    expect(walker.grounded).toBe(true);
    expect(walker.swimming).toBe(false);
    advance(walker, collision, 4, { forward: 1 });
    expect(walker.swimming).toBe(true);
    expect(walker.grounded).toBe(false);
    expect(walker.feet.y + WALK_EYE_HEIGHT).toBeCloseTo(0.45);
    expect(walker.velocity.x).toBeCloseTo(SWIM_SPEED);
    advance(walker, collision, 8, { forward: -1 });
    expect(walker.feet.x).toBeLessThan(0);
    expect(walker.grounded).toBe(true);
    expect(walker.swimming).toBe(false);
    expect(walker.feet.y).toBeGreaterThan(0);
    advance(walker, collision, 0.1, { jump: true });
    expect(walker.grounded).toBe(false);
    expect(walker.velocity.y).toBeGreaterThan(0);
  });

  it('places and stays afloat without rendered ground, including lakes above sea level', () => {
    const collision = new WalkCollision();
    collision.update(new THREE.Group(), 0, 0);
    const walker = new WalkController();
    walker.sampleWaterHeight = () => 48;
    walker.reset(0, 0);
    expect(walker.place(collision, () => undefined)).toBe(true);
    expect(walker.swimming).toBe(true);
    advance(walker, collision, 5, { forward: 1, jump: true }, 60, () => undefined);
    expect(walker.feet.y + WALK_EYE_HEIGHT).toBeCloseTo(48.45);
    expect(walker.feet.x).toBeCloseTo(SWIM_SPEED * 5);
    expect(walker.velocity.y).toBe(0);
    expect(walker.waitingForTerrain).toBe(false);
    walker.reset(0, 0);
    expect(walker.swimming).toBe(false);
  });

  it('catches a fall into water and recovers a walker already below the surface', () => {
    const { walker, collision } = beach();
    walker.feet.set(10, 6, 0);
    walker.grounded = false;
    advance(walker, collision, 0.1);
    expect(walker.swimming).toBe(false);
    expect(walker.feet.y).toBeGreaterThan(5);
    advance(walker, collision, 3);
    expect(walker.swimming).toBe(true);
    expect(walker.feet.y + WALK_EYE_HEIGHT).toBeCloseTo(0.45);
    walker.feet.y = -123;
    walker.velocity.y = -35;
    advance(walker, collision, 0.1);
    expect(walker.swimming).toBe(true);
    expect(walker.feet.y + WALK_EYE_HEIGHT).toBeCloseTo(0.45);
    expect(walker.velocity.y).toBe(0);
  });

  it('retains wall collision while swimming and allows walking on a bridge above water', () => {
    const { walker, collision, root } = beach();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 10, 20));
    wall.position.set(7, 0, 0);
    root.add(wall);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 20));
    bridge.position.set(12, 1, 0);
    root.add(bridge);
    collision.update(root, 0, 0);
    advance(walker, collision, 6, { forward: 1, sprint: true });
    expect(walker.swimming).toBe(true);
    expect(walker.feet.x).toBeLessThan(6.651);
    expect(walker.feet.x).toBeGreaterThan(6.6);
    walker.feet.set(12, 1.12, 0);
    advance(walker, collision, 1);
    expect(walker.swimming).toBe(false);
    expect(walker.grounded).toBe(true);
    expect(walker.feet.y).toBeCloseTo(1.1);
  });

  it('pauses when swimming coverage unloads and resumes when it returns', () => {
    const { walker, collision } = beach();
    advance(walker, collision, 6, { forward: 1 });
    const before = walker.feet.clone();
    walker.sampleWaterHeight = () => undefined;
    advance(walker, collision, 1, { forward: 1 });
    expect(walker.feet.equals(before)).toBe(true);
    expect(walker.waitingForTerrain).toBe(true);
    walker.sampleWaterHeight = () => 0;
    advance(walker, collision, 1, { forward: 1 });
    expect(walker.waitingForTerrain).toBe(false);
    expect(walker.feet.x - before.x).toBeCloseTo(SWIM_SPEED);
    expect(walker.swimming).toBe(true);
  });

  it('agrees across frame rates while crossing the shoreline in both directions', () => {
    const a = beach();
    const b = beach();
    for (const forward of [1, -1]) {
      advance(a.walker, a.collision, 4, { forward, sprint: true }, 30);
      advance(b.walker, b.collision, 4, { forward, sprint: true }, 120);
      expect(a.walker.feet.distanceTo(b.walker.feet)).toBeLessThan(0.001);
      expect(a.walker.swimming).toBe(b.walker.swimming);
    }
  });
});
