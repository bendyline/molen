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
  /** Minimum half-width of the shadowed square, meters. Rounded up for a stable texel grid. */
  radius: number;
}

export const SHADOW_MAP_SIZE: Record<Exclude<ShadowQuality, 'off'>, number> = {
  low: 1024,
  medium: 2048,
  high: 4096,
};

const UP = new THREE.Vector3(0, 1, 0);
const VERTICAL_UP = new THREE.Vector3(1, 0, 0);
const shadowRadii = new WeakMap<THREE.DirectionalLight, number>();
const scratchCenter = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchForward = new THREE.Vector3();

/** Keep the projection fixed through small altitude/zoom changes, including at a bucket edge. */
function stableRadius(light: THREE.DirectionalLight, requested: number): number {
  const previous = shadowRadii.get(light);
  if (previous !== undefined && requested <= previous && requested >= previous * 0.8)
    return previous;
  // Eight steps per power of two: at most 12.5% extra coverage. Shrink only after a 20% change,
  // so a camera bobbing across a step cannot alternate between two different shadow grids.
  const step = 2 ** Math.floor(Math.log2(requested)) / 8;
  const radius = Math.ceil(requested / step) * step;
  shadowRadii.set(light, radius);
  return radius;
}

/**
 * Aim `light`'s shadow at `center` (scene coordinates, after rebasing) from `direction` (a unit
 * vector toward the sun), covering at least ±`radius`. The light and its target move; the direction of
 * the light is unchanged.
 */
export function focusDirectionalShadow(
  light: THREE.DirectionalLight,
  direction: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
  /**
   * The shader adds the bias in the reversed-depth sense: true for WebGL PCF shadows with a
   * reversed depth buffer. three r184's WebGL PCF lookup adds `shadowBias` to the receiver depth
   * even when depth is reversed (its basic and VSM lookups subtract it), so the usual negative
   * bias pushes every receiver away from the light and casters shadow themselves entirely.
   */
  biasAddsTowardLight = false,
  /** Absolute world origin of scene coordinates; snapping must survive floating-origin rebases. */
  worldOrigin: readonly [number, number, number] = [0, 0, 0],
): void {
  radius = stableRadius(light, radius);
  const toSun = scratchForward.copy(direction).normalize();
  // Snap the focus to the shadow map's texel grid in the light's own plane, so a moving focus
  // does not make every shadow edge crawl.
  const size = light.shadow.mapSize.x || 2048;
  const texel = (2 * radius) / size;
  const camera = light.shadow.camera;
  // Use the same basis as the actual shadow camera, including a sun directly overhead.
  camera.up.copy(Math.abs(toSun.y) > 0.999 ? VERTICAL_UP : UP);
  const right = scratchRight.crossVectors(camera.up, toSun);
  right.normalize();
  const up = scratchUp.crossVectors(toSun, right).normalize();
  const snapped = scratchCenter.copy(center);
  snapped.x += worldOrigin[0];
  snapped.y += worldOrigin[1];
  snapped.z += worldOrigin[2];
  const along = snapped.dot(toSun);
  const x = Math.round(snapped.dot(right) / texel) * texel;
  const y = Math.round(snapped.dot(up) / texel) * texel;
  snapped.copy(right).multiplyScalar(x).addScaledVector(up, y).addScaledVector(toSun, along);
  snapped.x -= worldOrigin[0];
  snapped.y -= worldOrigin[1];
  snapped.z -= worldOrigin[2];

  // Far enough up the sun's line that tall buildings toward the sun still cast into the box.
  const distance = radius * 2 + 1_000;
  light.target.position.copy(snapped);
  light.position.copy(snapped).addScaledVector(toSun, distance);
  light.target.updateMatrixWorld();
  light.updateMatrixWorld();

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
  // Depth bias is measured in normalized depth, not meters. A fixed 0.0004 moved receivers by
  // roughly a meter in this deep box, detaching contact shadows and losing thin aircraft parts.
  const bias = (texel * 0.25) / (camera.far - camera.near);
  light.shadow.bias = biasAddsTowardLight ? bias : -bias;
  light.shadow.normalBias = texel * 1.2;
  light.shadow.radius = 0.5;
}
