import type { SceneManifest, Vec3 } from '@bendyline/molen-schema';

export interface CameraSpec {
  position: Vec3;
  lookAt?: Vec3;
}

/** Top-down orthographic framing (mirrors the client's TopDownOrtho). */
export interface OrthoSpec {
  center: [number, number];
  viewHeight: number;
  cameraHeight?: number;
}

/** What the capture harness poses: one of a perspective camera or a top-down ortho framing. */
export interface CaptureCamera {
  camera: CameraSpec | null;
  ortho: OrthoSpec | null;
}

/**
 * The camera a capture uses: an explicit override wins; otherwise the scene's own `camera`
 * block (fixed / free-fly → perspective pose, top-down-ortho → ortho framing); else neither,
 * and the harness keeps its default perspective pose.
 */
export function cameraFromManifest(manifest: SceneManifest, override?: CameraSpec): CaptureCamera {
  if (override !== undefined) return { camera: override, ortho: null };
  const c = manifest.camera;
  if (c === undefined) return { camera: null, ortho: null };
  if (c.mode === 'top-down-ortho') {
    return {
      camera: null,
      ortho: {
        center: c.center,
        viewHeight: c.viewHeight,
        ...(c.cameraHeight !== undefined ? { cameraHeight: c.cameraHeight } : {}),
      },
    };
  }
  if (c.mode === 'follow') return { camera: null, ortho: null };
  return {
    camera: { position: c.position, ...(c.lookAt !== undefined ? { lookAt: c.lookAt } : {}) },
    ortho: null,
  };
}
