import type { Delta, Keyframe, SceneManifest, Vec3 } from '@bendyline/molen-schema';

/** Local meters, Y up. Bounds constrain entity origins, not mesh extents. */
export interface DioramaBounds {
  min: Vec3;
  max: Vec3;
}

/** Ordinary scene data; resolve script paths to code before handing it to playback. */
export interface DioramaDefinition {
  scene: SceneManifest;
  bounds: DioramaBounds;
  /** Per-instance entity budget, including scenery (default 512). */
  maxEntities?: number;
}

/** Small synchronous bridge, usable in Node and by the browser visual. */
export interface DioramaPlayback {
  readonly tick: number;
  readonly tickRate: number;
  keyframe(): Keyframe;
  /** Fixed ticks, with at most 0.2 seconds of catch-up per call. */
  advance(seconds: number): Delta | undefined;
  dispose(): void;
}

/** A loader is invoked only when a placement is selected for playback. */
export type DioramaLoader = (signal: AbortSignal) => Promise<DioramaDefinition>;

export interface DioramaPlacement {
  id: string;
  load: DioramaLoader;
  position: Vec3;
  /** Rotation about Y, radians. The authored local +Z turns toward +X. */
  yaw?: number;
  /** Meters from the placement origin, including altitude (default 350). */
  enterDistance?: number;
  /** Hysteresis: retain a loaded/loading scene until this distance (default enter * 1.2). */
  exitDistance?: number;
  /** Host clock policy; omitted means always eligible. Never passed into script state. */
  active?: (timeMs: number) => boolean;
}

export type DioramaStatus = 'idle' | 'loading' | 'playing' | 'failed';

export interface DioramaInstance {
  update(seconds: number): void;
  /** Re-anchor scenery without restarting local simulation (e.g. terrain LOD refinement). */
  setPosition?(position: Vec3): void;
  dispose(): void;
}

/** Injectable lifecycle boundary; the standard client creates a local world and a Three visual. */
export type DioramaFactory = (
  definition: DioramaDefinition,
  placement: DioramaPlacement,
) => DioramaInstance | Promise<DioramaInstance>;
