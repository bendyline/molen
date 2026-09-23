import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ScreenSpaceLod, type ScreenSpaceLodPolicy } from '../../src/client/screen-space-lod';

function fixture(
  policy: ScreenSpaceLodPolicy = { viewportHeight: 1_000, maxPixelError: 1 },
  radius = 10,
) {
  const lod = new ScreenSpaceLod(policy, radius);
  lod.addDetail(new THREE.Group(), 0);
  lod.addDetail(new THREE.Group(), 0.35);
  lod.addDetail(new THREE.Group(), 0.9);
  const root = new THREE.Group();
  root.add(lod);
  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 10_000);
  function at(distance: number): number {
    root.updateMatrixWorld(true);
    lod.getWorldPosition(camera.position);
    camera.position.z += distance;
    camera.updateMatrixWorld(true);
    lod.update(camera);
    const visible = lod.levels.filter((level) => level.object.visible);
    expect(visible).toHaveLength(1);
    return lod.levels.findIndex((level) => level.object.visible);
  }
  return { lod, root, camera, at, policy };
}

describe('projected screen-space detail', () => {
  it('responds to real pixel count, quality error, camera magnification and field of view', () => {
    const { at, policy, camera } = fixture(undefined, 20);
    expect(at(300)).toBe(1);
    policy.viewportHeight = 2_000;
    at(0);
    expect(at(300)).toBe(0);
    policy.viewportHeight = 1_000;
    policy.maxPixelError = 2;
    at(0);
    expect(at(300)).toBe(2);
    policy.maxPixelError = 1;
    camera.zoom = 2;
    camera.updateProjectionMatrix();
    at(0);
    expect(at(300)).toBe(0);
    camera.zoom = 1;
    camera.fov = 60;
    camera.updateProjectionMatrix();
    at(0);
    expect(at(300)).toBe(0);
  });

  it('keeps conservative near bounds, applies hysteresis, and is invariant under rebasing', () => {
    const { at, lod, root } = fixture();
    expect(at(186)).toBe(1);
    expect(at(180)).toBe(1);
    expect(at(150)).toBe(0);
    expect(at(600)).toBe(2);
    root.position.set(-9_000_000, -400, 4_000_000);
    expect(at(600)).toBe(2);
    expect(lod.getCurrentLevel()).toBe(2);
    expect(at(9)).toBe(0);
  });

  it('scales both object bounds and geometric errors with parent transforms', () => {
    const { at, root } = fixture();
    expect(at(400)).toBe(1);
    root.scale.set(3, 2, 1);
    at(0);
    expect(at(400)).toBe(0);
    expect(at(600)).toBe(1);
  });

  it('uses orthographic magnification independently of distance and reports the visible level', () => {
    const { lod, root } = fixture();
    const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 100_000);
    function update(zoom: number, distance: number): number {
      camera.zoom = zoom;
      camera.position.z = distance;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      root.updateMatrixWorld(true);
      lod.update(camera);
      const index = lod.levels.findIndex((level) => level.object.visible);
      expect(lod.levels.filter((level) => level.object.visible)).toHaveLength(1);
      expect(lod.getCurrentLevel()).toBe(index);
      return index;
    }
    expect(update(1, 10)).toBe(0);
    expect(update(0.5, 10)).toBe(1);
    expect(update(0.2, 10)).toBe(2);
    expect(update(0.2, 10_000)).toBe(2);
    expect(update(0.24, 10_000)).toBe(2);
    expect(update(0.3, 10_000)).toBe(1);
  });

  it('rejects invalid detail ordering before it can disagree with THREE.LOD sorting', () => {
    const lod = new ScreenSpaceLod({ viewportHeight: 1_000, maxPixelError: 1 }, 10);
    lod.addDetail(new THREE.Group(), 0);
    lod.addDetail(new THREE.Group(), 1);
    expect(() => lod.addDetail(new THREE.Group(), 0.5)).toThrow();
    expect(() => lod.addDetail(new THREE.Group(), 1)).toThrow();
    expect(() => lod.addDetail(new THREE.Group(), Number.NaN)).toThrow();
    expect(lod.levels).toHaveLength(2);
  });
});
