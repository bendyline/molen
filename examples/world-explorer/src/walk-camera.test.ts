import { cameraForward, WalkCollision } from '@bendyline/molen-client/navigation';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { collisionObstruction, WalkCamera } from './walk-camera';

const EYE: [number, number, number] = [10, 1.7, -4];
/** Looking north (-Z). */
const NORTH = cameraForward(-Math.PI / 2, 0);
const clear = (): undefined => undefined;

describe('the third-person walk camera', () => {
  it('stands behind the walker, a little above their eye', () => {
    const { position, distance } = new WalkCamera().update(0, EYE, NORTH, clear);
    expect(position[0]).toBeCloseTo(EYE[0], 6);
    expect(position[1]).toBeGreaterThan(EYE[1] + 0.2);
    expect(position[2]).toBeGreaterThan(EYE[2] + 4);
    expect(distance).toBeCloseTo(
      Math.hypot(position[0] - EYE[0], position[1] - EYE[1], position[2] - EYE[2]),
      6,
    );
  });

  it('rises behind a walker looking down', () => {
    const down = new WalkCamera().update(0, EYE, cameraForward(-Math.PI / 2, -0.6), clear);
    expect(down.position[1]).toBeGreaterThan(EYE[1] + 2);
  });

  it('closes in at once on a wall behind the walker and draws back gradually', () => {
    const camera = new WalkCamera();
    const open = camera.update(1 / 60, EYE, NORTH, clear).distance;
    const walled = camera.update(1 / 60, EYE, NORTH, () => 2).distance;
    expect(walled).toBeCloseTo(1.75, 6);
    const drawing = camera.update(1 / 60, EYE, NORTH, clear).distance;
    expect(drawing).toBeGreaterThan(walled);
    expect(drawing).toBeLessThan(walled + 0.2);
    for (let i = 0; i < 120; i++) camera.update(1 / 60, EYE, NORTH, clear);
    expect(camera.update(1 / 60, EYE, NORTH, clear).distance).toBeCloseTo(open, 6);
  });

  it("becomes the walker's own view where there is no room behind them", () => {
    const tight = new WalkCamera().update(1 / 60, EYE, NORTH, () => 0.9);
    expect(tight).toEqual({ position: EYE, distance: 0 });
  });

  it('stays above water for a swimmer looking up', () => {
    const up = cameraForward(-Math.PI / 2, 0.5);
    const free = new WalkCamera().update(0, EYE, up, clear);
    expect(free.position[1]).toBeLessThan(EYE[1] - 1);
    const swimming = new WalkCamera().update(0, EYE, up, clear, EYE[1] - 0.6);
    expect(swimming.distance).toBeGreaterThan(0);
    expect(swimming.position[1]).toBeGreaterThanOrEqual(EYE[1] - 0.6 - 1e-6);
  });

  it('stops at a wall whichever side of it is drawn', () => {
    const wall = (facing: number): number | undefined => {
      const scene = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial());
      mesh.rotation.y = facing;
      mesh.position.set(EYE[0], 2, EYE[2] + 2.5);
      scene.add(mesh);
      scene.updateMatrixWorld(true);
      const collision = new WalkCollision();
      collision.update(scene, EYE[0], EYE[2]);
      return collisionObstruction(collision)(EYE, [EYE[0], EYE[1], EYE[2] + 4.5]);
    };
    // Facing the walker, and facing away from them (a one-sided shell seen from inside).
    expect(wall(Math.PI)).toBeCloseTo(2.5, 2);
    expect(wall(0)).toBeCloseTo(2.5, 2);
  });

  it('stops at the surface nearest the walker of several facing away', () => {
    const scene = new THREE.Group();
    for (const z of [1.5, 3]) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial());
      mesh.position.set(EYE[0], 2, EYE[2] + z);
      scene.add(mesh);
    }
    scene.updateMatrixWorld(true);
    const collision = new WalkCollision();
    collision.update(scene, EYE[0], EYE[2]);
    const obstruction = collisionObstruction(collision);
    expect(obstruction(EYE, [EYE[0], EYE[1], EYE[2] + 4.5])).toBeCloseTo(1.5, 2);
    expect(obstruction(EYE, [EYE[0], EYE[1], EYE[2] + 1])).toBeUndefined();
  });
});
