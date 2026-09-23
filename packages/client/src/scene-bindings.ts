import type { JsonObject, SceneCamera, SceneInput, Vec3 } from '@bendyline/molen-schema';
import type { InputMap } from './input';
import type { InterpTransform } from './interpolation';
import type { CameraPose, TopDownOrtho } from './three/renderer';

// The scene's own `camera` and `input` blocks, applied by the client (docs/05 §3). Both are
// DOM-free: the camera target is the small slice of Renderer they need, the input rules poll
// an InputMap and emit through a callback, so they unit-test with fakes and fake timers.

export type Unsubscribe = () => void;

/** The renderer surface `applySceneCamera` needs (satisfied by `Renderer`). */
export interface CameraTarget {
  setCamera(pose: CameraPose): void;
  setTopDownOrtho(opts: TopDownOrtho): void;
  setFov(fovDeg: number): void;
}

/**
 * Apply a scene's `camera` block. `fixed` and `free-fly` pose the perspective camera (free-fly
 * applies its initial pose only; movement controls are the host's); `top-down-ortho` switches to
 * the orthographic framing. Re-run after a resize to keep ortho framing (the Renderer already
 * refits on setSize; callers with their own renderer may call this again).
 */
export function applySceneCamera(
  camera: SceneCamera,
  renderer: CameraTarget,
  target?: InterpTransform,
): void {
  switch (camera.mode) {
    case 'follow':
      if (target === undefined) return;
      renderer.setCamera(followCameraPose(camera, target));
      if (camera.fov !== undefined) renderer.setFov(camera.fov);
      return;
    case 'fixed':
    case 'free-fly':
      renderer.setCamera({
        position: camera.position,
        ...(camera.lookAt !== undefined ? { lookAt: camera.lookAt } : {}),
      });
      if (camera.fov !== undefined) renderer.setFov(camera.fov);
      return;
    case 'top-down-ortho':
      renderer.setTopDownOrtho({
        center: camera.center,
        viewHeight: camera.viewHeight,
        ...(camera.cameraHeight !== undefined ? { cameraHeight: camera.cameraHeight } : {}),
      });
      return;
    default:
      return;
  }
}

export interface InputRuleOptions {
  /** How often controllers and numeric rules are polled (ms). Default 50. */
  pollMs?: number;
  /** Injectable timer (setInterval/clearInterval shape) for tests. */
  timer?: {
    set(fn: () => void, ms: number): unknown;
    clear(handle: unknown): void;
  };
}

/**
 * Run a scene's `input.emit` rules against an InputMap: `press`/`release` rules emit on action
 * edges; numeric rules share one controller poller that emits a scalar or [x, y] vector only
 * when its value changes. Returns a disposer.
 */
export function applyInputRules(
  input: SceneInput,
  inputMap: InputMap,
  emit: (type: string, payload: JsonObject) => void,
  opts?: InputRuleOptions,
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const axisRules: {
    rule: Extract<SceneInput['emit'][number], { kind: 'axis' | 'axis2d' }>;
    last: string | undefined;
  }[] = [];

  for (const rule of input.emit) {
    switch (rule.kind) {
      case 'press':
        unsubs.push(inputMap.onPress(rule.action, () => emit(rule.command, rule.payload)));
        break;
      case 'release':
        unsubs.push(inputMap.onRelease(rule.action, () => emit(rule.command, rule.payload)));
        break;
      case 'axis':
      case 'axis2d':
        axisRules.push({ rule, last: undefined });
        break;
      default:
        break;
    }
  }

  const timer = opts?.timer ?? {
    set: (fn: () => void, ms: number) => setInterval(fn, ms),
    clear: (h: unknown) => clearInterval(h as ReturnType<typeof setInterval>),
  };
  const sample = (): void => {
    const clamp = (n: number): number => Math.max(-1, Math.min(1, n));
    for (const entry of axisRules) {
      const { rule } = entry;
      const value =
        rule.kind === 'axis'
          ? clamp(inputMap.value(rule.action) - (rule.negative ? inputMap.value(rule.negative) : 0))
          : [
              clamp(inputMap.value(rule.xPos) - inputMap.value(rule.xNeg)),
              clamp(inputMap.value(rule.yPos) - inputMap.value(rule.yNeg)),
            ];
      const serialized = JSON.stringify(value);
      if (entry.last === serialized) continue;
      entry.last = serialized;
      emit(rule.command, { [rule.field]: value });
    }
  };
  // Explicit resets/profile switches neutralize commands immediately, even between polls.
  unsubs.push(inputMap.onReset(sample));
  const handle = timer.set(() => {
    inputMap.update();
    sample();
  }, opts?.pollMs ?? 50);
  unsubs.push(() => timer.clear(handle));

  return () => {
    for (const off of unsubs) off();
    unsubs.length = 0;
  };
}

/** Pure camera composition shared by live interpolation and deterministic snapshot viewers. */
export function followCameraPose(
  camera: Extract<SceneCamera, { mode: 'follow' }>,
  target: InterpTransform,
): CameraPose {
  const point = (offset: Vec3): Vec3 => {
    let [x, y, z] = offset;
    if (camera.space === 'local') {
      const [qx, qy, qz, qw] = target.rot;
      const tx = 2 * (qy * z - qz * y);
      const ty = 2 * (qz * x - qx * z);
      const tz = 2 * (qx * y - qy * x);
      x += qw * tx + qy * tz - qz * ty;
      y += qw * ty + qz * tx - qx * tz;
      z += qw * tz + qx * ty - qy * tx;
    }
    return [target.pos[0] + x, target.pos[1] + y, target.pos[2] + z];
  };
  return { position: point(camera.offset), lookAt: point(camera.lookOffset) };
}
