import type { Quat, SkyData, Vec3, WeatherData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { type FrameAdmissionOptions, FrameAdmissionQueue } from '../frame-admission';
import { type SkyStar, SkyVisual } from '../sky/visual';
import { WeatherVisual } from '../weather/visual';
import { applyEnvironment, defaultEnvironment } from './environment';
import {
  createGpuFrameTimer,
  type GpuFrameTimer,
  type GpuFrameTimerOptions,
} from './gpu-frame-timer';
import { createWebGpuFrameTimer } from './webgpu-frame-timer';
import type { WebGpuSceneOptimizer } from './webgpu-scene-optimizer';

export type RendererBackend = 'webgl' | 'webgpu';
export type RendererBackendPreference = 'auto' | RendererBackend;
export type ThreeRenderer = THREE.WebGLRenderer | WebGPURenderer;

interface InitializedRenderer {
  three: ThreeRenderer;
  backend: RendererBackend;
  optimizer?: WebGpuSceneOptimizer;
}

export interface RendererOptions {
  admission?: FrameAdmissionOptions;
  /**
   * Which graphics backend to use. Defaults to `'auto'`: probe WebGPU, fall back to WebGL.
   * `'webgl'` skips the probe entirely — pin it when the pixels must be reproducible.
   * `'webgpu'` is strict and never silently falls back.
   */
  backend?: RendererBackendPreference;
  /**
   * How long the WebGPU probe may take before `'auto'` gives up and uses WebGL (default 5000ms;
   * 0 or Infinity waits forever). A context can advertise `navigator.gpu` and then never settle
   * its initialization — headless software rendering does exactly this — and without a bound the
   * page hangs with no error rather than falling back. `'webgpu'` rejects on timeout instead.
   */
  backendProbeTimeoutMs?: number;
  /** Persistent instance buffers and managed tile command caches. Defaults to true on WebGPU. */
  optimizeWebGpu?: boolean;
  /** Device loss requires a new viewer/canvas. Auto fallback applies during initialization. */
  onDeviceLost?: (reason: string) => void;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  width?: number;
  height?: number;
  pixelRatio?: number;
  antialias?: boolean;
  /** WebGL only. WebGPU presentation does not preserve the drawing buffer between frames. */
  preserveDrawingBuffer?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  /** Better depth precision for large view ranges; WebGL requires EXT_clip_control. */
  reverseDepthBuffer?: boolean;
  /** Compatibility fallback for large view ranges; costs early-fragment performance. */
  logarithmicDepthBuffer?: boolean;
  cameraNear?: number;
  cameraFar?: number;
  /** Optional automatic large-world origin rebasing driven by camera movement. */
  autoWorldOrigin?: AutoWorldOriginOptions;
  /** Background clear color, default a mid grey. */
  clearColor?: string;
  /**
   * Stars for every sky, e.g. `decodeStarCatalog` of the `molen.sky` content pack's `stars.bin`.
   * Without a catalog, skies show no stars; `setStarCatalog` supplies one later.
   */
  stars?: readonly SkyStar[];
}

export interface AutoWorldOriginOptions {
  /** Rebase after the camera moves farther than this world-space distance from the current origin. */
  threshold: number;
  /** Snap the new origin to this grid size; omitted means use the exact camera position. */
  gridSize?: number;
  /** Include vertical movement in the threshold and new origin. Defaults to horizontal XZ only. */
  includeY?: boolean;
}

export interface CameraPose {
  position: Vec3;
  /** Either a look-at target or an explicit rotation quaternion. */
  lookAt?: Vec3;
  rotation?: Quat;
}

/** The framing for the orthographic top-down camera: where it looks and how much it covers. */
export interface TopDownOrtho {
  /** World XZ the camera centers on. */
  center: [number, number];
  /** Vertical world extent the viewport covers. */
  viewHeight: number;
  /** Camera height above the ground (for depth ordering). */
  cameraHeight?: number;
  rotationDeg?: number;
}

/** Orthographic half-extents for a vertical view extent at an aspect ratio (pure; testable). */
export function orthoFrustum(viewHeight: number, aspect: number): { halfW: number; halfH: number } {
  if (!Number.isFinite(viewHeight) || viewHeight <= 0) {
    throw new Error('viewHeight must be finite and positive');
  }
  if (!Number.isFinite(aspect) || aspect <= 0)
    throw new Error('aspect must be finite and positive');
  const halfH = viewHeight / 2;
  return { halfW: halfH * aspect, halfH };
}

/** Pure automatic-origin policy, exported so hosts can predict and test rebases without WebGL. */
export function nextWorldOrigin(
  current: Vec3,
  cameraPosition: Vec3,
  options: AutoWorldOriginOptions,
): Vec3 | undefined {
  if (!Number.isFinite(options.threshold) || options.threshold <= 0) {
    throw new Error('automatic world-origin threshold must be finite and positive');
  }
  if (
    options.gridSize !== undefined &&
    (!Number.isFinite(options.gridSize) || options.gridSize <= 0)
  ) {
    throw new Error('automatic world-origin gridSize must be finite and positive');
  }
  if (!current.every(Number.isFinite) || !cameraPosition.every(Number.isFinite)) {
    throw new Error('automatic world-origin positions must contain finite numbers');
  }
  const dx = cameraPosition[0] - current[0];
  const dy = options.includeY === true ? cameraPosition[1] - current[1] : 0;
  const dz = cameraPosition[2] - current[2];
  if (Math.hypot(dx, dy, dz) <= options.threshold) return undefined;
  const snap = (value: number): number =>
    options.gridSize === undefined
      ? value
      : Math.round(value / options.gridSize) * options.gridSize;
  return [
    snap(cameraPosition[0]),
    options.includeY === true ? snap(cameraPosition[1]) : current[1],
    snap(cameraPosition[2]),
  ];
}

/**
 * Bound one step of the WebGPU probe. A step that never settles is not hypothetical: a headless
 * context can advertise `navigator.gpu`, hand back no adapter, and leave three's init pending
 * forever, which shows up as a page that renders nothing and reports nothing. `disposeLate`
 * releases a result that arrives after we gave up, so a slow success cannot leak a GPU device.
 */
async function withProbeTimeout<T>(
  pending: Promise<T>,
  ms: number,
  step: string,
  disposeLate?: (value: T) => void,
): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return pending;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`WebGPU ${step} did not settle within ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([pending, expiry]);
  } catch (error) {
    // Whatever the race outcome, the original promise still owns its result; adopt it so a late
    // rejection is not unhandled and a late success is disposed rather than orphaned.
    void pending.then(
      (value) => disposeLate?.(value),
      () => {},
    );
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Thin wrapper over the three.js renderer + scene + camera. The engine owns the single
 * construction path so capture settings (pixel ratio, AA, tone mapping) are deterministic.
 * The `backend` option selects WebGPU or WebGL — see docs-src/guide/rendering-backends.md.
 */
export class Renderer {
  readonly admission: FrameAdmissionQueue;
  private readonly preparedResources = new WeakMap<
    object,
    { version: number; promise: Promise<unknown> }
  >();
  private warmupTarget: THREE.WebGLRenderTarget | undefined;
  private warmupMaterial: THREE.MeshBasicMaterial | undefined;
  private readonly warmedPrograms = new WeakMap<THREE.Material, Map<string, Promise<unknown>>>();
  private readonly warmedMeshes = new WeakMap<THREE.Mesh, Promise<unknown>>();
  readonly three: ThreeRenderer;
  readonly backend: RendererBackend;
  private fallback: string | undefined;
  get fallbackReason(): string | undefined {
    return this.fallback;
  }
  readonly scene: THREE.Scene;
  /** World-space objects live here so the renderer can rebase them near the camera. */
  readonly worldRoot: THREE.Group;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly defaultClearColor: THREE.Color;
  private aspect: number;
  private viewportWidth: number;
  private viewportHeight: number;
  private pixelRatio: number;
  private readonly uploadBatchBytes: number;
  private worldOrigin: Vec3 = [0, 0, 0];
  private cameraPose: CameraPose | undefined;
  /** The active top-down framing, so a resize can refit the orthographic bounds. */
  private ortho: TopDownOrtho | undefined;
  private readonly cameraNear: number;
  private readonly cameraFar: number;
  private readonly autoWorldOrigin: AutoWorldOriginOptions | undefined;
  private readonly timers = new Set<GpuFrameTimer>();
  private disposed = false;
  private deviceLossReason: string | undefined;
  private readonly optimizer: WebGpuSceneOptimizer | undefined;
  private activeSky: SkyVisual | undefined;
  private starCatalog: readonly SkyStar[] | undefined;
  private activeWeather: WeatherVisual | undefined;
  private weatherTimeOverride: number | undefined;
  private readonly weatherLightIntensities = new WeakMap<THREE.Light, number>();
  private environmentSeconds = 0;
  private environmentTimeOverride: number | undefined;

  /** Active clear-sky visual and sampled ephemeris, when environment.sky is configured. */
  get sky(): SkyVisual | undefined {
    return this.activeSky;
  }

  /** Active weather effects; physical weather data is also available in the simulation component. */
  get weather(): WeatherVisual | undefined {
    return this.activeWeather;
  }

  /** Apply the singleton weather component without rebuilding the sky or moving the camera. */
  setWeather(data: WeatherData | undefined): void {
    if (data && this.activeWeather) this.activeWeather.setData(data);
    else {
      const next = data ? new WeatherVisual(data) : undefined;
      this.activeWeather?.dispose();
      this.activeWeather = next;
      if (next) this.scene.add(next.object);
    }
  }

  /** Standalone weather preview clock. Undefined follows simulation time, independently of sky seeks. */
  setWeatherTimeOverride(seconds: number | undefined): void {
    if (seconds !== undefined && !Number.isFinite(seconds))
      throw new Error('Weather time must be finite');
    this.weatherTimeOverride = seconds;
  }

  /** @internal Environment binding hook; hosts use applyEnvironment to replace the complete lighting rig. */
  setSky(data: SkyData | undefined, shadows: 'off' | 'low' | 'medium' | 'high' = 'off'): void {
    const next = data
      ? new SkyVisual(data, {
          shadows,
          ...(this.starCatalog !== undefined ? { stars: this.starCatalog } : {}),
        })
      : undefined;
    try {
      next?.update(this.environmentTimeOverride ?? this.environmentSeconds);
    } catch (error) {
      next?.dispose();
      throw error;
    }
    this.activeSky?.dispose();
    this.activeSky = next;
    if (next) this.scene.add(next.lights);
  }

  /**
   * Stars for every sky this renderer shows, e.g. `decodeStarCatalog` of a content pack's
   * molen/stars@1 file. Applies to the current sky at once and survives sky changes;
   * `undefined` removes the stars.
   */
  setStarCatalog(stars: readonly SkyStar[] | undefined): void {
    this.starCatalog = stars;
    this.activeSky?.setStars(stars);
  }

  /** Absolute simulation seconds, shared by live playback, paused snapshots and captures. */
  setEnvironmentTime(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new Error('Environment time must be finite');
    this.environmentSeconds = seconds;
  }

  /** Preview a sky at absolute simulation seconds without seeking the world; undefined resumes its clock. */
  setEnvironmentTimeOverride(seconds: number | undefined): void {
    if (seconds !== undefined && !Number.isFinite(seconds))
      throw new Error('Environment time override must be finite');
    this.environmentTimeOverride = seconds;
  }

  /** Prefer WebGPU when available; explicit webgpu is strict and never silently falls back. */
  static async create(opts: RendererOptions = {}): Promise<Renderer> {
    validateRendererOptions(opts);
    const preference = opts.backend ?? 'auto';
    if (preference === 'webgl') return new Renderer(opts);
    const probeMs = opts.backendProbeTimeoutMs ?? 5000;
    try {
      if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
        throw new Error('WebGPU is unavailable in this browser or context');
      }
      // Ask for an adapter before loading the driver. A context that advertises `navigator.gpu`
      // but has no adapter is the common case (headless software rendering, a blocklisted GPU),
      // and three's init does not reliably settle there — so this is both the fast path and the
      // one that keeps `'auto'` from hanging.
      const adapter = await withProbeTimeout(
        navigator.gpu.requestAdapter(),
        probeMs,
        'adapter request',
      );
      if (adapter === null) throw new Error('WebGPU reported no adapter for this device');
      const { createWebGpuDriver } = await import('./webgpu-driver');
      const three = await withProbeTimeout(
        createWebGpuDriver(opts),
        probeMs,
        'initialization',
        (late) => {
          late.dispose();
        },
      );
      try {
        const optimizer =
          opts.optimizeWebGpu === false
            ? undefined
            : new (await import('./webgpu-scene-optimizer')).WebGpuSceneOptimizer(three);
        return new Renderer(opts, {
          three,
          backend: 'webgpu',
          ...(optimizer ? { optimizer } : {}),
        });
      } catch (error) {
        three.dispose();
        throw error;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (preference === 'webgpu')
        throw new Error(`WebGPU initialization failed: ${reason}`, { cause: error });
      const renderer = new Renderer({ ...opts, backend: 'webgl' });
      renderer.fallback = reason;
      return renderer;
    }
  }

  constructor(opts: RendererOptions = {}, initialized?: InitializedRenderer) {
    validateRendererOptions(opts);
    this.starCatalog = opts.stars;
    this.admission = new FrameAdmissionQueue({
      // Three's WebGPU node preparation is indivisible and commonly takes 3–5 ms per mesh.
      // A 2 ms budget admits only one such mesh per frame and delays large worlds for minutes.
      maxMilliseconds: initialized?.backend === 'webgpu' ? 8 : 2,
      ...opts.admission,
    });
    this.uploadBatchBytes = opts.admission?.maxBytes ?? 2 * 1024 * 1024;
    if (initialized === undefined && opts.backend !== undefined && opts.backend !== 'webgl') {
      throw new Error('Use await Renderer.create() for auto or webgpu backends');
    }
    const width = opts.width ?? 1280;
    const height = opts.height ?? 720;
    const pixelRatio = opts.pixelRatio ?? 1;
    const cameraNear = opts.cameraNear ?? 0.1;
    const cameraFar = opts.cameraFar ?? 5000;
    this.autoWorldOrigin = opts.autoWorldOrigin;
    this.cameraNear = cameraNear;
    this.cameraFar = cameraFar;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.pixelRatio = pixelRatio;
    this.backend = initialized?.backend ?? 'webgl';
    this.optimizer = initialized?.optimizer;
    this.three =
      initialized?.three ??
      new THREE.WebGLRenderer({
        canvas: opts.canvas as HTMLCanvasElement | undefined,
        antialias: opts.antialias ?? false,
        preserveDrawingBuffer: opts.preserveDrawingBuffer ?? true,
        powerPreference: opts.powerPreference ?? 'default',
        reversedDepthBuffer: opts.reverseDepthBuffer ?? false,
        logarithmicDepthBuffer: opts.logarithmicDepthBuffer ?? false,
      });
    this.three.setPixelRatio(pixelRatio);
    if (this.backend === 'webgpu') {
      (this.three as WebGPURenderer).onDeviceLost = (info): void => {
        if (this.disposed) return;
        this.deviceLossReason = info.message;
        for (const timer of this.timers) timer.dispose();
        this.timers.clear();
        opts.onDeviceLost?.(info.message);
      };
    }
    this.three.setSize(width, height, false);
    this.defaultClearColor = new THREE.Color(opts.clearColor ?? '#1a1a20');
    this.three.setClearColor(this.defaultClearColor, 1);

    this.scene = new THREE.Scene();
    this.worldRoot = new THREE.Group();
    this.worldRoot.name = 'molen:world-root';
    this.scene.add(this.worldRoot);
    this.aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(60, this.aspect, cameraNear, cameraFar);
    this.camera.position.set(0, 0, 10);

    // Default lighting rig so primitives are visible without an authored environment.
    // A scene's `environment` component (or applyEnvironment) replaces it.
    applyEnvironment(this, defaultEnvironment);
  }

  /** Pose the perspective camera (leaving top-down ortho mode if it was active). */
  setCamera(pose: CameraPose): void {
    if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera = new THREE.PerspectiveCamera(60, this.aspect, this.cameraNear, this.cameraFar);
      this.ortho = undefined;
    }
    this.cameraPose = {
      position: [...pose.position],
      ...(pose.lookAt !== undefined ? { lookAt: [...pose.lookAt] } : {}),
      ...(pose.rotation !== undefined ? { rotation: [...pose.rotation] } : {}),
    };
    this.maybeRebase(pose.position);
    this.applyCameraPose(this.cameraPose);
  }

  /** Vertical field of view in degrees (perspective camera only; a no-op for ortho). */
  setFov(fovDeg: number): void {
    if (!Number.isFinite(fovDeg) || fovDeg <= 0 || fovDeg >= 180) {
      throw new Error('fov must be in (0, 180) degrees');
    }
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = fovDeg;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Shift all engine-owned world objects near the local origin without changing world poses. */
  setWorldOrigin(origin: Vec3): void {
    if (!origin.every(Number.isFinite)) throw new Error('world origin must contain finite numbers');
    this.applyWorldOrigin(origin);
    if (this.cameraPose !== undefined) this.applyCameraPose(this.cameraPose);
    else if (this.ortho !== undefined) this.setTopDownOrtho(this.ortho);
  }

  getWorldOrigin(): Vec3 {
    return [...this.worldOrigin];
  }

  setCameraClip(near: number, far: number): void {
    if (!Number.isFinite(near) || near <= 0 || !Number.isFinite(far) || far <= near) {
      throw new Error('camera clip range requires finite 0 < near < far');
    }
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }

  private applyCameraPose(pose: CameraPose): void {
    this.camera.position.set(
      pose.position[0] - this.worldOrigin[0],
      pose.position[1] - this.worldOrigin[1],
      pose.position[2] - this.worldOrigin[2],
    );
    if (pose.lookAt !== undefined) {
      this.camera.lookAt(
        pose.lookAt[0] - this.worldOrigin[0],
        pose.lookAt[1] - this.worldOrigin[1],
        pose.lookAt[2] - this.worldOrigin[2],
      );
    } else if (pose.rotation !== undefined) {
      const r = pose.rotation;
      this.camera.quaternion.set(r[0], r[1], r[2], r[3]);
    }
  }

  private maybeRebase(position: Vec3): void {
    if (this.autoWorldOrigin === undefined) return;
    const next = nextWorldOrigin(this.worldOrigin, position, this.autoWorldOrigin);
    if (next !== undefined) this.applyWorldOrigin(next);
  }

  private applyWorldOrigin(origin: Vec3): void {
    this.worldOrigin = [...origin];
    this.worldRoot.position.set(-origin[0], -origin[1], -origin[2]);
  }

  /** Switch to a top-down orthographic camera looking straight down at a world point. */
  setTopDownOrtho(opts: TopDownOrtho): void {
    const { halfW, halfH } = orthoFrustum(opts.viewHeight, this.aspect);
    const camH = opts.cameraHeight ?? 200;
    this.ortho = { ...opts, center: [opts.center[0], opts.center[1]] };
    this.cameraPose = undefined;
    this.maybeRebase([opts.center[0], camH, opts.center[1]]);
    let ortho: THREE.OrthographicCamera;
    if (this.camera instanceof THREE.OrthographicCamera) {
      ortho = this.camera;
      ortho.left = -halfW;
      ortho.right = halfW;
      ortho.top = halfH;
      ortho.bottom = -halfH;
    } else {
      ortho = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, camH * 4);
      this.camera = ortho;
    }
    const centerX = opts.center[0] - this.worldOrigin[0];
    const centerZ = opts.center[1] - this.worldOrigin[2];
    ortho.position.set(centerX, camH - this.worldOrigin[1], centerZ);
    ortho.up.set(0, 0, -1); // so +x is right, +z is down on screen
    ortho.lookAt(centerX, -this.worldOrigin[1], centerZ);
    if (opts.rotationDeg !== undefined) ortho.rotateZ((opts.rotationDeg * Math.PI) / 180);
    ortho.updateProjectionMatrix();
  }

  /**
   * The WebGPU device-loss reason once the device is gone (undefined while it is live). Every
   * later `render()` throws, so a frame loop stops here instead of failing once per frame.
   */
  get deviceLost(): string | undefined {
    return this.deviceLossReason;
  }

  /**
   * Update the device pixel ratio after a display change. Three applies the ratio on the next
   * `setSize`, so callers pair the two (the mount's resize handler does).
   */
  setPixelRatio(ratio: number): void {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      throw new Error('pixelRatio must be finite and positive');
    }
    if (ratio === this.pixelRatio) return;
    this.pixelRatio = ratio;
    this.three.setPixelRatio(ratio);
  }

  setSize(width: number, height: number): void {
    // A canvas with no layout reports 0: a zero height makes the aspect NaN (perspective renders
    // nothing) and throws out of orthoFrustum. Clamp to one pixel and keep a usable aspect.
    const w = Number.isFinite(width) && width > 0 ? width : 1;
    const h = Number.isFinite(height) && height > 0 ? height : 1;
    const sizeChanged = w !== this.viewportWidth || h !== this.viewportHeight;
    this.viewportWidth = w;
    this.viewportHeight = h;
    if (sizeChanged) this.three.setSize(w, h, false);
    this.aspect = w / h;
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = this.aspect;
      this.camera.updateProjectionMatrix();
      return;
    }
    // Ortho: refit the frustum to the new aspect so the authored viewHeight is preserved.
    if (this.ortho !== undefined) this.setTopDownOrtho(this.ortho);
    else this.camera.updateProjectionMatrix();
  }

  /** Prepare shared resources once; all dependants await the same admission jobs. */
  async prepareObject(root: THREE.Object3D, signal?: AbortSignal): Promise<void> {
    const jobs = new Set<Promise<unknown>>();
    type Attribute = THREE.BufferAttribute | THREE.InterleavedBuffer;
    const glAttributes = new Set<Attribute>();
    const glBatches: Array<{ meshes: THREE.Mesh[]; attributes: Attribute[]; bytes: number }> = [];
    root.updateWorldMatrix(true, true);
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const key = `${Boolean((mesh as THREE.InstancedMesh).isInstancedMesh)}/${Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh)}/${Object.keys(mesh.geometry.attributes).sort().join(',')}`;
      const variants: Array<{ map: Map<string, Promise<unknown>>; key: string }> = [];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (!(value instanceof THREE.Texture)) continue;
          const existing = this.preparedResources.get(value);
          if (existing?.version === value.version) {
            jobs.add(existing.promise);
            continue;
          }
          const promise = this.admission.run(() => this.three.initTexture(value), {
            label: 'texture-upload',
            bytes: textureBytes(value),
          });
          this.rememberPreparation([value], promise);
          jobs.add(promise);
        }
        let map = this.warmedPrograms.get(material);
        if (!map) {
          map = new Map();
          this.warmedPrograms.set(material, map);
        }
        const variantKey = `${material.version}/${key}`;
        const existing = map.get(variantKey);
        if (existing) jobs.add(existing);
        else variants.push({ map, key: variantKey });
      }
      const instanced = mesh as THREE.InstancedMesh;
      const attributes = [
        ...Object.values(mesh.geometry.attributes).map((a) =>
          a instanceof THREE.InterleavedBufferAttribute ? a.data : a,
        ),
        ...(mesh.geometry.index ? [mesh.geometry.index] : []),
        ...(instanced.isInstancedMesh
          ? [
              instanced.instanceMatrix,
              ...(instanced.instanceColor ? [instanced.instanceColor] : []),
            ]
          : []),
      ];
      const fresh = attributes.filter((attribute) => {
        if (glAttributes.has(attribute)) return false;
        const existing = this.preparedResources.get(attribute);
        if (existing?.version === attribute.version) {
          jobs.add(existing.promise);
          return false;
        }
        return true;
      });
      let compilation: Promise<unknown> | undefined;
      // Three keys instanced/skinned/morph node builders by object identity. LODs can share
      // every buffer and material while still needing their own builder before first visibility.
      const objectSpecific =
        instanced.isInstancedMesh ||
        (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
        mesh.morphTargetInfluences !== undefined;
      const previousMesh = this.warmedMeshes.get(mesh);
      if (previousMesh) jobs.add(previousMesh);
      if (
        variants.length > 0 ||
        (this.backend === 'webgpu' && (fresh.length > 0 || (objectSpecific && !previousMesh)))
      ) {
        compilation = this.admission.run(() => this.compileMesh(mesh), {
          label:
            this.backend === 'webgpu' && fresh.length > 0
              ? 'geometry-upload-and-shader'
              : 'shader-warmup',
          bytes:
            this.backend === 'webgpu' ? fresh.reduce((sum, a) => sum + a.array.byteLength, 0) : 0,
        });
        jobs.add(compilation);
        if (this.backend === 'webgpu') {
          this.warmedMeshes.set(mesh, compilation);
          void compilation.catch(() => {
            if (this.warmedMeshes.get(mesh) === compilation) this.warmedMeshes.delete(mesh);
          });
        }
        for (const variant of variants) {
          variant.map.set(variant.key, compilation);
          void compilation.catch(() => {
            if (variant.map.get(variant.key) === compilation) variant.map.delete(variant.key);
          });
        }
      }
      if (fresh.length > 0) {
        if (this.backend === 'webgpu') {
          const upload = compilation as Promise<unknown>;
          this.rememberPreparation(fresh, upload);
          jobs.add(upload);
        } else {
          const bytes = fresh.reduce((sum, a) => sum + a.array.byteLength, 0);
          let batch = glBatches.at(-1);
          if (!batch || batch.meshes.length >= 16 || batch.bytes + bytes > this.uploadBatchBytes) {
            batch = { meshes: [], attributes: [], bytes: 0 };
            glBatches.push(batch);
          }
          batch.meshes.push(mesh);
          batch.attributes.push(...fresh);
          batch.bytes += bytes;
          for (const attribute of fresh) glAttributes.add(attribute);
        }
      }
    });
    for (const batch of glBatches) {
      const upload = this.admission.run(() => this.prepareWebGlGeometries(batch.meshes), {
        label: 'geometry-upload',
        bytes: batch.bytes,
      });
      this.rememberPreparation(batch.attributes, upload);
      jobs.add(upload);
    }
    // Shared resource work belongs to the renderer. Cancelling one tile must not cancel another
    // tile awaiting the same shader/texture. The caller checks its signal before publication.
    const results = await Promise.allSettled(jobs);
    if (signal?.aborted) throw new DOMException('Preparation cancelled', 'AbortError');
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }

  private rememberPreparation(
    resources: readonly { version: number }[],
    promise: Promise<unknown>,
  ): void {
    for (const resource of resources)
      this.preparedResources.set(resource, { version: resource.version, promise });
    void promise.catch(() => {
      for (const resource of resources)
        if (this.preparedResources.get(resource)?.promise === promise)
          this.preparedResources.delete(resource);
    });
  }

  private compileMesh(mesh: THREE.Mesh): Promise<unknown> {
    const visible = mesh.visible,
      culled = mesh.frustumCulled;
    mesh.visible = true;
    mesh.frustumCulled = false;
    try {
      return this.three.compileAsync(mesh, this.camera, this.scene);
    } finally {
      mesh.visible = visible;
      mesh.frustumCulled = culled;
    }
  }

  private prepareWebGlGeometries(meshes: readonly THREE.Mesh[]): void {
    const renderer = this.three as THREE.WebGLRenderer;
    this.warmupTarget ??= new THREE.WebGLRenderTarget(1, 1);
    this.warmupMaterial ??= new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const scene = new THREE.Scene();
    const ranges = new Map<THREE.BufferGeometry, { start: number; count: number }>();
    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      if (!ranges.has(geometry)) ranges.set(geometry, { ...geometry.drawRange });
      const instanced = mesh as THREE.InstancedMesh;
      const proxy = instanced.isInstancedMesh
        ? new THREE.InstancedMesh(geometry, this.warmupMaterial, 0)
        : new THREE.Mesh(geometry, this.warmupMaterial);
      if (proxy instanceof THREE.InstancedMesh) {
        proxy.instanceMatrix = instanced.instanceMatrix;
        proxy.instanceColor = instanced.instanceColor;
      }
      proxy.frustumCulled = false;
      scene.add(proxy);
    }
    const target = renderer.getRenderTarget();
    try {
      for (const geometry of ranges.keys()) geometry.setDrawRange(0, 0);
      renderer.setRenderTarget(this.warmupTarget);
      renderer.render(scene, this.camera);
    } finally {
      for (const [geometry, range] of ranges) geometry.setDrawRange(range.start, range.count);
      renderer.setRenderTarget(target);
      // Proxies share the real attributes; disposing an instanced proxy would delete those buffers.
      scene.clear();
    }
  }

  render(): void {
    if (this.disposed) throw new Error('Renderer has been disposed');
    if (this.deviceLossReason !== undefined) {
      throw new Error(
        `WebGPU device lost: ${this.deviceLossReason}. Recreate the viewer, or reload with WebGL.`,
      );
    }
    if (this.backend === 'webgpu') this.three.info.reset();
    const sky = this.activeSky;
    const weather = this.activeWeather;
    sky?.setCloudAttenuation(weather?.cloudAttenuation ?? 0);
    sky?.update(this.environmentTimeOverride ?? this.environmentSeconds);
    // Only the environment rig is weather-managed; authored lamps remain independent.
    this.scene.getObjectByName('$environment')?.traverse((object) => {
      if (!(object instanceof THREE.Light)) return;
      let base = this.weatherLightIntensities.get(object);
      if (!weather) {
        if (base !== undefined) {
          object.intensity = base;
          this.weatherLightIntensities.delete(object);
        }
        return;
      }
      if (base === undefined) {
        base = object.intensity;
        this.weatherLightIntensities.set(object, base);
      }
      object.intensity =
        base *
        (1 -
          (weather?.cloudAttenuation ?? 0) *
            (object instanceof THREE.DirectionalLight ? 0.92 : 0.2));
    });
    weather?.update(
      this.weatherTimeOverride ?? this.environmentSeconds,
      this.camera,
      this.worldOrigin,
      sky?.frame,
    );
    const baseFog = this.scene.fog;
    if (weather) this.scene.fog = weather.fogFor(baseFog, sky?.frame);
    try {
      if (sky) {
        sky.update(this.environmentTimeOverride ?? this.environmentSeconds);
        sky.prepareCamera(this.camera);
        const autoClear = this.three.autoClear;
        const autoReset = this.three.info.autoReset;
        this.three.info.reset();
        this.three.info.autoReset = false;
        try {
          this.three.render(sky.scene, sky.camera);
          this.three.autoClear = false;
          this.renderScene();
        } finally {
          this.three.autoClear = autoClear;
          this.three.info.autoReset = autoReset;
        }
        return;
      }
      this.renderScene();
    } finally {
      this.scene.fog = baseFog;
    }
  }

  private renderScene(): void {
    if (this.optimizer === undefined) {
      this.three.render(this.scene, this.camera);
      return;
    }
    this.optimizer.prepare(this.scene, this.camera);
    const autoUpdate = this.scene.matrixWorldAutoUpdate;
    this.scene.matrixWorldAutoUpdate = false;
    try {
      this.three.render(this.scene, this.camera);
      this.optimizer.finish();
    } finally {
      this.scene.matrixWorldAutoUpdate = autoUpdate;
    }
  }

  /** Use for independent terrain/content chunks. WebGPU caches eligible opaque draw commands. */
  createRenderGroup(): THREE.Group {
    return this.optimizer?.createGroup() ?? new THREE.Group();
  }

  /** Render stats for the screenshot stats block. */
  stats(): { drawCalls: number; triangles: number } {
    const info = this.three.info.render;
    return {
      drawCalls: 'drawCalls' in info ? info.drawCalls : info.calls,
      triangles: info.triangles,
    };
  }

  /** Optional backend-specific GPU timing with the same nonblocking polling interface. */
  createGpuTimer(options: GpuFrameTimerOptions = {}): GpuFrameTimer | undefined {
    if (this.disposed) throw new Error('Renderer has been disposed');
    const timer =
      this.backend === 'webgpu'
        ? createWebGpuFrameTimer(this.three as WebGPURenderer, options)
        : createGpuFrameTimer((this.three as THREE.WebGLRenderer).getContext(), options);
    if (timer !== undefined) {
      const dispose = timer.dispose.bind(timer);
      timer.dispose = () => {
        this.timers.delete(timer);
        dispose();
      };
      this.timers.add(timer);
    }
    return timer;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.activeSky?.dispose();
    this.activeSky = undefined;
    this.activeWeather?.dispose();
    this.activeWeather = undefined;
    this.scene.getObjectByName('$environment')?.traverse((object) => {
      if (object instanceof THREE.Light) object.dispose();
    });
    this.admission.dispose();
    this.warmupTarget?.dispose();
    this.warmupMaterial?.dispose();
    for (const timer of this.timers) timer.dispose();
    this.timers.clear();
    this.optimizer?.dispose();
    this.worldRoot.clear();
    this.three.dispose();
  }
}

function textureBytes(texture: THREE.Texture): number {
  const image = texture.image as
    | { width?: number; height?: number; data?: ArrayBufferView }
    | undefined;
  return (
    image?.data?.byteLength ?? Math.ceil(((image?.width ?? 1) * (image?.height ?? 1) * 4 * 4) / 3)
  );
}

function validateRendererOptions(opts: RendererOptions): void {
  if (opts.backend !== undefined && !['auto', 'webgl', 'webgpu'].includes(opts.backend)) {
    throw new Error('backend must be auto, webgl, or webgpu');
  }
  const near = opts.cameraNear ?? 0.1;
  const far = opts.cameraFar ?? 5000;
  if (!Number.isFinite(near) || near <= 0)
    throw new Error('cameraNear must be finite and positive');
  if (!Number.isFinite(far) || far <= near)
    throw new Error('cameraFar must be finite and greater than cameraNear');
  if (opts.reverseDepthBuffer && opts.logarithmicDepthBuffer) {
    throw new Error('reverseDepthBuffer and logarithmicDepthBuffer are mutually exclusive');
  }
  if (opts.autoWorldOrigin !== undefined)
    nextWorldOrigin([0, 0, 0], [0, 0, 0], opts.autoWorldOrigin);
}
