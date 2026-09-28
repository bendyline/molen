import type { AudioListenerState, AudioVec3 } from './types';

/** Anything with a three.js-style world matrix (column-major 4×4 `elements`). */
export interface AudioCameraLike {
  readonly matrixWorld: { readonly elements: ArrayLike<number> };
}

function unit(x: number, y: number, z: number, fallback: AudioVec3): AudioVec3 {
  const len = Math.hypot(x, y, z);
  return len > 1e-9 ? [x / len, y / len, z / len] : fallback;
}

/**
 * Listener pose from a render camera. The renderer keeps the camera near the origin (floating
 * origin); pass `renderer.getWorldOrigin()` so the listener sits in the same world space as
 * entity transforms. Reads the matrix only, so it needs no three.js import.
 */
export function listenerFromCamera(
  camera: AudioCameraLike,
  worldOrigin: ArrayLike<number> = [0, 0, 0],
): Pick<AudioListenerState, 'position' | 'forward' | 'up'> {
  const e = camera.matrixWorld.elements;
  const at = (i: number): number => e[i] ?? 0;
  return {
    position: [
      at(12) + (worldOrigin[0] ?? 0),
      at(13) + (worldOrigin[1] ?? 0),
      at(14) + (worldOrigin[2] ?? 0),
    ],
    forward: unit(-at(8), -at(9), -at(10), [0, 0, -1]),
    up: unit(at(4), at(5), at(6), [0, 1, 0]),
  };
}
