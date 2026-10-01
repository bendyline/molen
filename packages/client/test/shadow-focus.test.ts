import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { focusDirectionalShadow } from '../src/three/shadow-focus';

function sun(): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight();
  light.shadow.mapSize.set(1024, 1024);
  return light;
}

describe('focused sun shadows', () => {
  it('centers the shadow box on the focus, sized to it, along the sun direction', () => {
    const light = sun();
    const toSun = new THREE.Vector3(-0.5, 1, 0.3).normalize();
    focusDirectionalShadow(light, toSun, new THREE.Vector3(1_000, 20, -2_000), 400);
    const camera = light.shadow.camera;
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-400, 400, 400, -400]);
    // The target sits on the focus to within a shadow texel, and the light up the sun's line.
    const texel = 800 / 1024;
    expect(light.target.position.distanceTo(new THREE.Vector3(1_000, 20, -2_000))).toBeLessThan(
      texel * 1.5,
    );
    const toLight = light.position.clone().sub(light.target.position).normalize();
    expect(toLight.dot(toSun)).toBeCloseTo(1, 6);
    expect(camera.far).toBeGreaterThan(light.position.distanceTo(light.target.position));
    expect(light.shadow.normalBias).toBeCloseTo(texel * 1.2, 6);
  });

  it('moves in whole texels, so shadow edges hold still while the focus drifts', () => {
    const light = sun();
    const toSun = new THREE.Vector3(0.3, 1, -0.4).normalize();
    focusDirectionalShadow(light, toSun, new THREE.Vector3(0, 0, 0), 512);
    const first = light.target.position.clone();
    // A drift far smaller than a texel (1 m here) leaves the box where it was across the light's
    // plane; only the depth along the sun's line, which the map does not see, follows the focus.
    focusDirectionalShadow(light, toSun, new THREE.Vector3(0.05, 0, 0.05), 512);
    const drift = light.target.position.clone().sub(first);
    expect(drift.clone().cross(toSun).length()).toBeLessThan(1e-9);
    // A move of several texels shifts it by whole texels.
    focusDirectionalShadow(light, toSun, new THREE.Vector3(5, 0, 0), 512);
    const moved = light.target.position.clone().sub(first);
    const across = moved
      .clone()
      .sub(toSun.clone().multiplyScalar(moved.dot(toSun)))
      .length();
    expect(across).toBeGreaterThan(3);
  });
});
