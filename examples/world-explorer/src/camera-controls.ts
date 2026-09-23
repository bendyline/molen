export type CameraDirection = [number, number, number];

export interface CameraOrientation {
  yaw: number;
  pitch: number;
}

const MAX_PITCH = 1.5;

export function cameraForward(yaw: number, pitch: number): CameraDirection {
  return [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)];
}

export function cameraRight(yaw: number): CameraDirection {
  return [Math.cos(yaw + Math.PI / 2), 0, Math.sin(yaw + Math.PI / 2)];
}

export function cameraPlanarForward(yaw: number): CameraDirection {
  return [Math.cos(yaw), 0, Math.sin(yaw)];
}

export function applyCameraLookDelta(
  yaw: number,
  pitch: number,
  deltaX: number,
  deltaY: number,
  sensitivity = 0.003,
): CameraOrientation {
  return {
    yaw: yaw + deltaX * sensitivity,
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch - deltaY * sensitivity)),
  };
}

/**
 * Detect camera changes that can outrun a throttled terrain-selection update. The terrain
 * selector has a view guard band, so tiny per-frame changes can wait for its normal cadence;
 * larger turns or translations need coverage replanned before the next render.
 */
export function terrainViewNeedsImmediateUpdate(
  previousPosition: CameraDirection,
  previousDirection: CameraDirection,
  position: CameraDirection,
  direction: CameraDirection,
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
