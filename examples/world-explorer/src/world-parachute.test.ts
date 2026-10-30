import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type ParachuteControls, WorldParachute } from './world-parachute';

const HANDS_UP: ParachuteControls = { forward: 0, right: 0, flare: false };
const LEVEL: [number, number, number, number] = [0, 0, 0, 1];

/** World bounds of what is drawn: hidden parts (the pilot, a landed seat) left out. */
function shown(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const visit = (o: THREE.Object3D): void => {
    if (!o.visible) return;
    if (o instanceof THREE.Mesh) box.union(new THREE.Box3().setFromObject(o, true));
    for (const child of o.children) visit(child);
  };
  visit(object);
  return box;
}

function fly(
  chute: WorldParachute,
  seconds: number,
  controls: ParachuteControls = HANDS_UP,
): [number, number, number] | undefined {
  for (let i = 0; i < seconds * 60; i++) {
    const landing = chute.update(1 / 60, controls);
    if (landing) return landing;
  }
  return undefined;
}

describe('world parachute', () => {
  it('fires the seat clear, opens the canopy and glides down to the terrain', () => {
    const root = new THREE.Group();
    const chute = new WorldParachute(root, { groundHeight: () => 12 });
    // Level flight north at 80 m/s, 300 m up.
    chute.eject({ position: [0, 300, 0], velocity: [0, 0, 80], rotation: LEVEL });
    expect(chute.phase).toBe('seat');
    expect(chute.object.visible).toBe(true);
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      chute.update(1 / 60, HANDS_UP);
      peak = Math.max(peak, chute.position.y);
    }
    // The rocket clears the airframe by tens of meters, and the airstream slows the seat.
    expect(peak).toBeGreaterThan(320);
    expect(chute.phase).toBe('canopy');
    expect(chute.velocity.z).toBeLessThan(50);
    expect(fly(chute, 15)).toBeUndefined();
    // Settled into the canopy's hands-up glide.
    expect(chute.velocity.z).toBeCloseTo(8.5, 0);
    expect(chute.velocity.y).toBeCloseTo(-4.5, 0);
    expect(chute.status()).toMatch(/^Parachute · \d+ ft AGL · 17 kt · 886 ft\/min$/);
    const landing = fly(chute, 120);
    expect(landing?.[1]).toBeCloseTo(12.02, 5);
    expect(chute.phase).toBe('landed');
    expect(chute.active).toBe(false);
    expect(chute.status()).toBe('Landed at 15 ft/s');
    // Unclipped, the canopy settles onto the ground ahead.
    fly(chute, 3);
    const lying = shown(chute.object);
    expect(lying.max.y).toBeLessThan(12 + 1);
    expect(lying.min.z).toBeGreaterThan(chute.position.z);
    chute.dispose();
    expect(root.children).toHaveLength(0);
  });

  it('turns on the toggles, slows on the brakes and floats briefly in a flare', () => {
    const chute = new WorldParachute(new THREE.Group(), { groundHeight: () => 0 });
    chute.eject({ position: [0, 1500, 0], velocity: [0, 0, 0], rotation: LEVEL });
    fly(chute, 10);
    const heading = chute.heading;
    fly(chute, 2, { forward: 0, right: 1, flare: false });
    // Right is a falling heading (0 faces +Z), and a turn costs height.
    expect(chute.heading).toBeLessThan(heading - 0.5);
    expect(chute.velocity.y).toBeLessThan(-5);
    fly(chute, 6, { forward: -1, right: 0, flare: false });
    expect(Math.hypot(chute.velocity.x, chute.velocity.z)).toBeCloseTo(4, 0);
    fly(chute, 6);
    fly(chute, 1.5, { forward: 0, right: 0, flare: true });
    const flaring = chute.velocity.y;
    expect(flaring).toBeGreaterThan(-2.5);
    // A flare spends itself: held on, the canopy sinks again.
    fly(chute, 4, { forward: 0, right: 0, flare: true });
    expect(chute.velocity.y).toBeLessThan(flaring - 1);
    chute.dispose();
  });

  it('lands on a roof below and holds still while terrain streams', () => {
    const root = new THREE.Group();
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(1000, 30, 1000),
      new THREE.MeshBasicMaterial(),
    );
    building.position.y = 15;
    root.add(building);
    root.updateMatrixWorld(true);
    let terrain: number | undefined;
    const chute = new WorldParachute(root, { groundHeight: () => terrain });
    chute.eject({ position: [0, 120, 0], velocity: [0, 0, 0], rotation: LEVEL });
    const start = chute.position.clone();
    fly(chute, 1);
    expect(chute.position).toEqual(start);
    expect(chute.status()).toContain('Waiting for terrain');
    terrain = 0;
    const landing = fly(chute, 120);
    expect(landing?.[1]).toBeCloseTo(30.02, 1);
    chute.dispose();
    building.geometry.dispose();
    (building.material as THREE.Material).dispose();
  });

  it('chases from behind and above, or looks out from the pilot’s eyes', () => {
    const chute = new WorldParachute(new THREE.Group(), { groundHeight: () => 0 });
    expect(chute.cameraPose('chase', 0, 0)).toBeUndefined();
    chute.eject({ position: [0, 800, 0], velocity: [0, 0, 0], rotation: LEVEL });
    fly(chute, 6);
    const feet = chute.position.toArray();
    const chase = chute.cameraPose('chase', 0, 0);
    if (!chase) throw new Error('No chase pose');
    expect(chase.position[2]).toBeLessThan(feet[2] - 10);
    expect(chase.position[1]).toBeGreaterThan(feet[1] + 2.5);
    expect(chase.lookAt[1]).toBeCloseTo(feet[1] + 3.5, 5);
    // Looking right (positive look yaw) faces -X from a heading of +Z.
    const right = chute.cameraPose('chase', Math.PI / 2, 0);
    expect(right?.position[0]).toBeGreaterThan(feet[0] + 10);
    const eyes = chute.cameraPose('cockpit', 0, 0);
    expect(eyes?.position).toEqual([feet[0], feet[1] + 1.65, feet[2]]);
    expect(eyes?.pitch).toBeCloseTo(-0.3, 5);
    chute.stop();
    expect(chute.object.visible).toBe(false);
    expect(chute.active).toBe(false);
    chute.dispose();
  });
});
