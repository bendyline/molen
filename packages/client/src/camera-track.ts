import type {
  CameraTrackDoc,
  CameraTrackKeyframe,
  SceneCameraTrack,
} from '@bendyline/molen-schema';
import { lerp3 } from './math';
import type { CameraPose } from './three/renderer';

// Camera tracks for machinima (docs/08 P3): keyframed poses over ticks, interpolated. Pure
// (no three.js) so it runs in Node (export_frames) and the browser (live playback). Exported
// from the three-free './camera-track' subpath. The schema itself is a core format in
// @bendyline/molen-schema (`molen/cameratrack@1`, and a scene's inline `cameraTrack`).

export type { CameraTrackDoc, CameraTrackKeyframe, SceneCameraTrack };

/**
 * @deprecated The camera-track schema is registered by `@bendyline/molen-schema` itself; this
 * is kept as a no-op so existing callers keep working.
 */
export function registerCameraTrackSchema(): void {}

/** A camera pose plus the field of view the track asks for at that tick, if any. */
export interface CameraTrackPose extends CameraPose {
  fov?: number;
}

export interface EvaluateCameraTrackOptions {
  /**
   * World position of an entity at the tick being evaluated, for keyframes with `relativeTo`.
   * Without it (or when it returns undefined) relative offsets are used as absolute points.
   */
  resolve?: (entity: string) => readonly number[] | undefined;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

type V3 = [number, number, number];

function absolute(
  k: CameraTrackKeyframe,
  opts: EvaluateCameraTrackOptions | undefined,
): { position: V3; lookAt: V3 } {
  const base = k.relativeTo !== undefined ? opts?.resolve?.(k.relativeTo) : undefined;
  if (base === undefined) return { position: k.position, lookAt: k.lookAt };
  const b: V3 = [base[0] ?? 0, base[1] ?? 0, base[2] ?? 0];
  return {
    position: [b[0] + k.position[0], b[1] + k.position[1], b[2] + k.position[2]],
    lookAt: [b[0] + k.lookAt[0], b[1] + k.lookAt[1], b[2] + k.lookAt[2]],
  };
}

/**
 * Interpolated camera pose at a given tick along a (validated) track: the standalone document or
 * a scene's inline `cameraTrack`. A keyframe with `cut` is jumped to at its tick rather than
 * interpolated into; `fov` carries forward from the last keyframe that set it.
 */
export function evaluateCameraTrack(
  doc: CameraTrackDoc | SceneCameraTrack,
  tick: number,
  opts?: EvaluateCameraTrackOptions,
): CameraTrackPose {
  const kfs = [...doc.keyframes].sort((a, b) => a.tick - b.tick);
  // Effective fov per keyframe: the last fov set at or before it.
  const fovs: (number | undefined)[] = [];
  let carried: number | undefined;
  for (const k of kfs) {
    if (k.fov !== undefined) carried = k.fov;
    fovs.push(carried);
  }
  const first = kfs[0] as CameraTrackKeyframe;
  const last = kfs[kfs.length - 1] as CameraTrackKeyframe;
  const span = last.tick - first.tick;
  const withFov = (pose: CameraTrackPose, fov: number | undefined): CameraTrackPose =>
    fov !== undefined ? { ...pose, fov } : pose;

  let t = tick;
  if (doc.loop && span > 0) {
    t = first.tick + ((((tick - first.tick) % span) + span) % span);
  }
  if (t <= first.tick) return withFov(absolute(first, opts), fovs[0]);
  if (t >= last.tick) return withFov(absolute(last, opts), fovs[kfs.length - 1]);

  let i = 0;
  for (; i < kfs.length - 1; i++) {
    const hi = kfs[i + 1] as CameraTrackKeyframe;
    if (t < hi.tick) break;
  }
  const a = kfs[i] as CameraTrackKeyframe;
  const b = kfs[i + 1] as CameraTrackKeyframe;
  if (b.cut === true) return withFov(absolute(a, opts), fovs[i]);
  let f = b.tick > a.tick ? (t - a.tick) / (b.tick - a.tick) : 0;
  if (doc.easing === 'smooth') f = smoothstep(f);
  const pa = absolute(a, opts);
  const pb = absolute(b, opts);
  const fa = fovs[i];
  const fb = fovs[i + 1];
  const fov = fa !== undefined && fb !== undefined ? fa + (fb - fa) * f : (fb ?? fa);
  return withFov(
    { position: lerp3(pa.position, pb.position, f), lookAt: lerp3(pa.lookAt, pb.lookAt, f) },
    fov,
  );
}
