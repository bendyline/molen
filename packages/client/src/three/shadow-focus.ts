// Sun shadows for large worlds: a single directional shadow map aimed at a host-chosen focus.
// A fixed shadow box only covers a small scene, so a view over a city either sees no shadows
// or blurry ones. Hosts name a focus each frame (an orbit target, a walker, a car) and a radius
// sized to what the camera shows; the light's shadow camera is centered there, sized to it, and
// snapped to its own texel grid so shadows do not shimmer as the focus moves.

import * as THREE from 'three';

export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';

export interface ShadowFocus {
  /** Focus point in absolute world coordinates (before any floating-origin rebase). */
  center: readonly [number, number, number];
  /** Half-width of the shadowed square around the focus, meters. */
  radius: number;
}

export const SHADOW_MAP_SIZE: Record<Exclude<ShadowQuality, 'off'>, number> = {
  low: 1024,
  medium: 2048,
  high: 4096,
};

const UP = new THREE.Vector3(0, 1, 0);
const scratchCenter = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchForward = new THREE.Vector3();

/**
 * Aim `light`'s shadow at `center` (scene coordinates, after rebasing) from `direction` (a unit
 * vector toward the sun), covering ±`radius`. The light and its target move; the direction of
 * the light is unchanged.
 */
export function focusDirectionalShadow(
  light: THREE.DirectionalLight,
  direction: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
): void {
  const toSun = scratchForward.copy(direction).normalize();
  // Snap the focus to the shadow map's texel grid in the light's own plane, so a moving focus
  // does not make every shadow edge crawl.
  const size = light.shadow.mapSize.x || 2048;
  const texel = (2 * radius) / size;
  const right = scratchRight.crossVectors(
    Math.abs(toSun.y) > 0.999 ? new THREE.Vector3(1, 0, 0) : UP,
    toSun,
  );
  right.normalize();
  const up = scratchUp.crossVectors(toSun, right).normalize();
  const snapped = scratchCenter.copy(center);
  const along = snapped.dot(toSun);
  const x = Math.round(snapped.dot(right) / texel) * texel;
  const y = Math.round(snapped.dot(up) / texel) * texel;
  snapped.copy(right).multiplyScalar(x).addScaledVector(up, y).addScaledVector(toSun, along);

  // Far enough up the sun's line that tall buildings toward the sun still cast into the box.
  const distance = radius * 2 + 1_000;
  light.target.position.copy(snapped);
  light.position.copy(snapped).addScaledVector(toSun, distance);
  light.target.updateMatrixWorld();
  light.updateMatrixWorld();

  const camera = light.shadow.camera;
  if (
    camera.left !== -radius ||
    camera.top !== radius ||
    camera.far !== distance + radius * 2 + 1_000
  ) {
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    camera.near = 1;
    camera.far = distance + radius * 2 + 1_000;
    camera.updateProjectionMatrix();
  }
  // Bias scales with texel size: a wide box has coarse texels that would otherwise self-shadow.
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = texel * 1.2;
}
