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
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-416, 416, 416, -416]);
    // The target sits on the focus to within a shadow texel, and the light up the sun's line.
    const texel = 832 / 1024;
    expect(light.target.position.distanceTo(new THREE.Vector3(1_000, 20, -2_000))).toBeLessThan(
      texel * 1.5,
    );
    const toLight = light.position.clone().sub(light.target.position).normalize();
    expect(toLight.dot(toSun)).toBeCloseTo(1, 6);
    expect(camera.far).toBeGreaterThan(light.position.distanceTo(light.target.position));
    expect(light.shadow.normalBias).toBeCloseTo(texel * 1.2, 6);
    expect(light.shadow.bias).toBeLessThan(0);
  });

  it('flips the depth bias where the shader adds it in the reversed-depth sense', () => {
    // WebGL PCF with a reversed depth buffer adds the bias to the receiver depth unflipped, so a
    // negative bias would push every receiver away from the light and casters would shadow
    // themselves; the bias must point toward the light (positive) there instead.
    const light = sun();
    const toSun = new THREE.Vector3(-0.5, 1, 0.3).normalize();
    focusDirectionalShadow(light, toSun, new THREE.Vector3(0, 0, 0), 400, true);
    expect(light.shadow.bias).toBeGreaterThan(0);
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

  it('holds the projection through altitude noise and uses hysteresis at a size boundary', () => {
    const light = sun();
    const direction = new THREE.Vector3(0.3, 1, -0.4).normalize();
    const center = new THREE.Vector3(120, 0, -60);
    focusDirectionalShadow(light, direction, center, 68);
    light.shadow.updateMatrices(light);
    const matrix = light.shadow.matrix.clone();
    for (const radius of [68.01, 67.99, 69, 71.99, 68]) {
      focusDirectionalShadow(light, direction, center, radius);
      light.shadow.updateMatrices(light);
      expect(light.shadow.matrix.elements).toEqual(matrix.elements);
    }
    // Grow immediately to preserve requested coverage; do not shrink on the next tiny dip.
    focusDirectionalShadow(light, direction, center, 72.01);
    const grown = light.shadow.camera.right;
    expect(grown).toBeGreaterThanOrEqual(72.01);
    focusDirectionalShadow(light, direction, center, 71.99);
    expect(light.shadow.camera.right).toBe(grown);
    // A real descent/zoom-in recovers detail.
    focusDirectionalShadow(light, direction, center, 48);
    expect(light.shadow.camera.right).toBe(48);
  });

  it.each([
    [0.3, 1, -0.4],
    [0, 1, 0],
    [0.001, 1, -0.001],
  ])('keeps world points on the same shadow texels through rebases (sun %s, %s, %s)', (x, y, z) => {
    const light = sun();
    const direction = new THREE.Vector3(x, y, z).normalize();
    const center = new THREE.Vector3(10_000_012, 25, -5_000_024);
    const point = center.clone().add(new THREE.Vector3(3, 0, -4));
    const project = (origin: [number, number, number]): THREE.Vector3 => {
      const offset = new THREE.Vector3().fromArray(origin);
      focusDirectionalShadow(light, direction, center.clone().sub(offset), 68, false, origin);
      light.shadow.updateMatrices(light);
      return point.clone().sub(offset).applyMatrix4(light.shadow.matrix);
    };
    const before = project([10_000_000, 0, -5_000_000]);
    const after = project([10_000_137, 14.3, -4_999_931]);
    expect(after.distanceTo(before) * light.shadow.mapSize.x).toBeLessThan(1e-5);

    // The snapping basis must also match the camera when the sun is at/near its zenith.
    const first = light.shadow.matrix.clone();
    const right = new THREE.Vector3().setFromMatrixColumn(light.shadow.camera.matrixWorld, 0);
    const drifted = center.clone().addScaledVector(right, 0.001);
    const origin: [number, number, number] = [10_000_137, 14.3, -4_999_931];
    focusDirectionalShadow(
      light,
      direction,
      drifted.sub(new THREE.Vector3().fromArray(origin)),
      68,
      false,
      origin,
    );
    light.shadow.updateMatrices(light);
    expect(
      new THREE.Vector3()
        .applyMatrix4(light.shadow.matrix)
        .distanceTo(new THREE.Vector3().applyMatrix4(first)) * light.shadow.mapSize.x,
    ).toBeLessThan(1e-5);
  });

  it('keeps the receiver depth offset below one shadow texel at every quality and extent', () => {
    for (const size of [1024, 2048, 4096]) {
      for (const radius of [48, 180, 300, 5_000]) {
        const light = sun();
        light.shadow.mapSize.set(size, size);
        focusDirectionalShadow(light, new THREE.Vector3(0.3, 1, -0.4), new THREE.Vector3(), radius);
        const camera = light.shadow.camera;
        const texel = (camera.right - camera.left) / size;
        expect(Math.abs(light.shadow.bias) * (camera.far - camera.near)).toBeLessThan(texel);
      }
    }
  });
});
