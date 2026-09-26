// Yaw/pitch camera math shared by the navigation controllers. Conventions match the engine:
// +X east, +Y up, +Z south; yaw 0 faces +X and grows toward +Z (so -PI/2 faces north).

export type NavigationVector = [number, number, number];

export interface CameraOrientation {
  yaw: number;
  pitch: number;
}

/** Pitch limit shared by look controls: just short of straight up/down. */
export const MAX_LOOK_PITCH = 1.5;

export function cameraForward(yaw: number, pitch: number): NavigationVector {
  return [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)];
}

export function cameraRight(yaw: number): NavigationVector {
  return [Math.cos(yaw + Math.PI / 2), 0, Math.sin(yaw + Math.PI / 2)];
}

export function cameraPlanarForward(yaw: number): NavigationVector {
  return [Math.cos(yaw), 0, Math.sin(yaw)];
}

/** Apply a pointer delta (pixels) to a yaw/pitch pair; moving right turns right. */
export function applyCameraLookDelta(
  yaw: number,
  pitch: number,
  deltaX: number,
  deltaY: number,
  sensitivity = 0.003,
): CameraOrientation {
  return {
    yaw: yaw + deltaX * sensitivity,
    pitch: Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, pitch - deltaY * sensitivity)),
  };
}

/** Yaw/pitch of a direction vector (the inverse of `cameraForward`). */
export function orientationFromDirection(direction: NavigationVector): CameraOrientation {
  const [x, y, z] = direction;
  const horizontal = Math.hypot(x, z);
  return { yaw: Math.atan2(z, x), pitch: Math.atan2(y, horizontal) };
}

/**
 * Detect camera changes that can outrun a throttled terrain-selection update. Terrain selectors
 * have a view guard band, so tiny per-frame changes can wait for their normal cadence; larger
 * turns or translations need coverage replanned before the next render.
 */
export function viewNeedsImmediateUpdate(
  previousPosition: NavigationVector,
  previousDirection: NavigationVector,
  position: NavigationVector,
  direction: NavigationVector,
  movementThreshold: number,
  turnThresholdRadians: number,
): boolean {
  const dx = position[0] - previousPosition[0];
  const dy = position[1] - previousPosition[1];
  const dz = position[2] - previousPosition[2];
  if (dx * dx + dy * dy + dz * dz >= movementThreshold * movementThreshold) return true;

  const previousLength = Math.hypot(...previousDirection);
  const directionLength = Math.hypot(...direction);
  if (previousLength === 0 || directionLength === 0) return true;
  const cosine =
    (previousDirection[0] * direction[0] +
      previousDirection[1] * direction[1] +
      previousDirection[2] * direction[2]) /
    (previousLength * directionLength);
  return cosine <= Math.cos(turnThresholdRadians);
}
