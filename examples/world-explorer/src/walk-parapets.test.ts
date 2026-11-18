import { WalkCollision, WalkController } from '@bendyline/molen-client/navigation';
import { validateByKind } from '@bendyline/molen-schema';
import { buffersToObject3D, createVertexColorMaterialSet } from '@bendyline/molen-worldgen/client';
import {
  type ArchStyleDoc,
  FLAT_GROUND,
  generateBuilding,
  MAX_PARAPET_HEIGHT,
  MeshBufferBuilder,
  type Vec2,
} from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import skyscraperRaw from '../../../content/worldgen/styles/use/skyscraper.archstyle.json?raw';

/** The roof is 20 m square; the walker heads for its +X edge. */
const EDGE = 20;
/** The thickest parapet any shipped style draws. */
const THICKNESS = 0.5;

/** A two-storey flat-roofed block whose style asks for the skyscraper's 3 m plant crown. */
function crowned(): THREE.Group {
  const doc = JSON.parse(skyscraperRaw);
  const result = validateByKind('archstyle', doc);
  if (!result.ok) throw new Error(result.formatted);
  const outline: Vec2[] = [
    [0, 0],
    [EDGE, 0],
    [EDGE, EDGE],
    [0, EDGE],
  ];
  const builder = new MeshBufferBuilder();
  generateBuilding(
    {
      request: { identity: 'roof', labels: ['skyscraper', 'building'], outline, levels: 2 },
      style: result.value as ArchStyleDoc,
      pack: { name: 'test', version: '1' },
      ground: FLAT_GROUND,
      tier: 0,
    },
    builder,
  );
  const scene = new THREE.Group();
  scene.add(buffersToObject3D(builder.finalize(), createVertexColorMaterialSet()));
  scene.updateMatrixWorld(true);
  return scene;
}

/** A bare roof slab with a solid wall of `height` around it, for checking the margin. */
function walled(height: number): THREE.Group {
  const scene = new THREE.Group();
  const material = new THREE.MeshBasicMaterial();
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
  };
  box(EDGE, 1, EDGE, EDGE / 2, 9.5, EDGE / 2);
  box(THICKNESS, height, EDGE, EDGE - THICKNESS / 2, 10 + height / 2, EDGE / 2);
  box(THICKNESS, height, EDGE, THICKNESS / 2, 10 + height / 2, EDGE / 2);
  box(EDGE, height, THICKNESS, EDGE / 2, 10 + height / 2, THICKNESS / 2);
  box(EDGE, height, THICKNESS, EDGE / 2, 10 + height / 2, EDGE - THICKNESS / 2);
  scene.updateMatrixWorld(true);
  return scene;
}

function heightAt(scene: THREE.Group, x: number, z: number): number {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(scene, true)[0];
  if (!hit) throw new Error(`Nothing under ${x}, ${z}`);
  return hit.point.y;
}

/**
 * Walk toward the +X edge from `startX` on the roof, jumping once on reaching `jumpAtX`. True when
 * the walker ends up past the outside of the parapet within four seconds.
 */
function escapes(scene: THREE.Group, startX: number, jumpAtX: number, sprint: boolean): boolean {
  const collision = new WalkCollision();
  const walker = new WalkController();
  walker.reset(startX, EDGE / 2);
  walker.feet.set(startX, heightAt(scene, startX, EDGE / 2) + 0.02, EDGE / 2);
  walker.ready = true;
  walker.grounded = true;
  walker.waitingForTerrain = false;
  let jumped = false;
  for (let frame = 0; frame < 240; frame++) {
    collision.update(scene, walker.feet.x, walker.feet.z);
    const jump: boolean = !jumped && walker.feet.x >= jumpAtX;
    jumped ||= jump;
    walker.update(1 / 60, { forward: 1, right: 0, yaw: 0, sprint, jump }, collision, () => 0);
    if (walker.feet.x > EDGE + 0.3) return true;
  }
  return false;
}

/** Up against the inner face, then a standing jump; and a run-up jumping a meter short of it. */
function bothWays(scene: THREE.Group, thickness: number): [boolean, boolean] {
  const inner = EDGE - thickness;
  return [escapes(scene, inner - 0.31, 0, false), escapes(scene, inner - 6, inner - 1, true)];
}

describe('jumping off a flat roof', () => {
  it('draws no parapet taller than a walker can jump, whatever the style asks for', () => {
    const scene = crowned();
    const roof = heightAt(scene, EDGE / 2, EDGE / 2);
    const top = heightAt(scene, EDGE - 0.25, EDGE / 2);
    expect(top - roof).toBeGreaterThan(0.5);
    expect(top - roof).toBeLessThanOrEqual(MAX_PARAPET_HEIGHT + 1e-6);
    expect(bothWays(scene, 0.5)).toEqual([true, true]);
  });

  it('keeps a margin between the tallest parapet and the jump', () => {
    expect(bothWays(walled(MAX_PARAPET_HEIGHT + 0.15), THICKNESS)).toEqual([true, true]);
    // The check itself can fail: a wall well past the jump keeps the walker on the roof.
    expect(bothWays(walled(1.4), THICKNESS)).toEqual([false, false]);
  });
});
