import type { Quat, SkyData, Vec3, WeatherData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { type FrameAdmissionOptions, FrameAdmissionQueue } from '../frame-admission';
import { type SkyStar, SkyVisual } from '../sky/visual';
import {
  type CloudShadowUniforms,
  createCloudShadowUniforms,
  installWebGlCloudShadows,
} from '../weather/cloud-shadows';
import { type CloudQuality, CloudTextures, type CloudUniforms } from '../weather/clouds';
import { cloudNoise } from '../weather/noise';
import { WeatherVisual } from '../weather/visual';
import { applyEnvironment, defaultEnvironment, findEnvironmentRig } from './environment';
import {
  createGpuFrameTimer,
  type GpuFrameTimer,
  type GpuFrameTimerOptions,
} from './gpu-frame-timer';
import {
  focusDirectionalShadow,
  SHADOW_MAP_SIZE,
  type ShadowFocus,
  type ShadowQuality,
} from './shadow-focus';
import {
  createWebGlSkyReflectionFilter,
  reflectionStateFromLights,
  type SkyReflectionFilter,
  SkyReflections,
} from './sky-reflections';
import type { AmbientOcclusionOptions, WebGpuAmbientOcclusion } from './webgpu-ambient-occlusion';
import { createWebGpuFrameTimer } from './webgpu-frame-timer';
import type { WebGpuSceneOptimizer } from './webgpu-scene-optimizer';

export type RendererBackend = 'webgl' | 'webgpu';
export type RendererBackendPreference = 'auto' | RendererBackend;
export type ThreeRenderer = THREE.WebGLRenderer | WebGPURenderer;

/** The backend's cloud deck material and lit-shader cloud shadows (WebGPU: webgpu-clouds.ts). */
interface CloudBackend {
  material(uniforms: CloudUniforms, textures: CloudTextures): THREE.Material;
  installShadows(uniforms: CloudShadowUniforms): void;
}

interface InitializedRenderer {
  three: ThreeRenderer;
  backend: RendererBackend;
  optimizer?: WebGpuSceneOptimizer;
  reflectionFilter?: SkyReflectionFilter;
  clouds?: CloudBackend;
}

export interface RendererOptions {
  /** Shared procedural sky/ground reflections for PBR materials. Default false; Earth viewers enable it. */
  reflections?: boolean;
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
  /** Better depth precision for large view ranges; WebGL uses logarithmic depth if EXT_clip_control is unavailable. */
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
   * WebGL only: `dispose()` also releases the GL context (`forceContextLoss`). Browsers cap live
   * contexts per page (Chromium keeps 16), so a single-page host that mounts and unmounts viewers
   * should enable this; each mount then needs a fresh canvas, because a lost context stays
   * attached to its canvas. Default false keeps a canvas reusable after dispose.
   */
  releaseContextOnDispose?: boolean;
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
  /** Per material, one prepared mesh of each kind it draws; see `prepareMaterialChange`. */
  private readonly materialMeshes = new WeakMap<THREE.Material, Map<string, WeakRef<THREE.Mesh>>>();
  /** The scene's visible lights for warm-up builds, gathered once between rendered frames. */
  private preparationLights: THREE.Object3D[] | undefined;
  /**
   * Per mesh, builds of the materials it swaps to itself (`null`: prepared with the mesh); see
   * `prepareVariants`.
   */
  private readonly warmedVariants = new WeakMap<
    THREE.Mesh,
    Map<THREE.Material, Promise<unknown> | null>
  >();
  private readonly variantInterests = new WeakMap<THREE.Mesh, WarmupInterest>();
  private readonly warmups = new WeakMap<Promise<unknown>, Warmup>();
  /** Deferred meshes whose preparation has not settled, with the interest that can promote it. */
  private readonly deferredMeshes = new WeakMap<THREE.Object3D, WarmupInterest>();
  private readonly guardedLods = new WeakSet<THREE.LOD>();
  /** Shared by every interest, so none captures the scope (and object tree) that created it. */
  private readonly cancel = (warmup: Warmup): void => this.cancelWarmup(warmup);
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
  private readonly releaseContextOnDispose: boolean;
  private deviceLossReason: string | undefined;
  private readonly optimizer: WebGpuSceneOptimizer | undefined;
  private activeSky: SkyVisual | undefined;
  private readonly reflections: SkyReflections | undefined;
  private occlusionOptions: AmbientOcclusionOptions | undefined;
  private occlusion: { camera: THREE.Camera; pass: WebGpuAmbientOcclusion } | undefined;
  private occlusionLoad: Promise<void> | undefined;
  private occlusionSuspended = false;
  /** Sun lights that have cast shadows: 'off' parks their maps; see setShadowQuality. */
  private readonly shadowLights = new WeakSet<THREE.DirectionalLight>();
  /** Kinds of shadow caster prepared so far (WebGL); see noteShadowCaster. */
  private readonly casterVariants = new Set<string>();
  /** Whether the shadow pass has drawn shadowCasterWarmup's casters (WebGL). */
  private shadowCastersWarmed = false;
  // WebGPU's getClearColor expects an alpha field; both backends accept this RGB scratch color.
  private readonly reflectionClearColor = Object.assign(new THREE.Color(), { a: 1 });
  private starCatalog: readonly SkyStar[] | undefined;
  private activeWeather: WeatherVisual | undefined;
  private weatherTimeOverride: number | undefined;
  /** Cloud textures and the cloud-shadow uniforms every lit shader reads, for the renderer's life. */
  private readonly cloudTextures = new CloudTextures(cloudNoise());
  private readonly cloudShadows: CloudShadowUniforms = createCloudShadowUniforms(
    this.cloudTextures.shadow,
  );
  private readonly cloudBackend: CloudBackend | undefined;
  private releaseCloudShadows: (() => void) | undefined;
  private cloudQualityLevel: CloudQuality = 'medium';
  private cloudShadowMapVersion = -1;
  private readonly weatherLightIntensities = new WeakMap<THREE.Light, number>();
  /** The hemisphere the sky reflection map stands in for, and its authored visibility. */
  private hiddenAmbient: { light: THREE.HemisphereLight; visible: boolean } | undefined;
  private environmentSeconds = 0;
  private environmentTimeOverride: number | undefined;
  private readonly lastRenderStats = { drawCalls: 0, triangles: 0 };
  private shadowFocus: ShadowFocus | undefined;
  private readonly shadowCenter = new THREE.Vector3();
  private readonly shadowDirection = new THREE.Vector3();

  /** Active clear-sky visual and sampled ephemeris, when environment.sky is configured. */
  get sky(): SkyVisual | undefined {
    return this.activeSky;
  }

  /**
   * Aim the sun's shadow at a focus (absolute world coordinates) covering at least ±`radius` meters, or
   * `undefined` for the environment's own fixed box. Call whenever what the camera frames
   * moves: an orbit target, a walker, a car. Shadows must be on (`setShadowQuality`).
   */
  setShadowFocus(focus: ShadowFocus | undefined): void {
    if (focus !== undefined && (!(focus.radius > 0) || !Number.isFinite(focus.radius)))
      throw new RangeError('Shadow focus radius must be a positive number of meters');
    this.shadowFocus =
      focus === undefined ? undefined : { center: [...focus.center], radius: focus.radius };
  }

  /**
   * Turn sun shadows on at a map resolution, or off, without rebuilding the environment. Once a
   * light has cast shadows, 'off' stops redrawing its map and fades it out, so every lit shader
   * keeps the shadow inputs it was built with: a host that turns shadows on once before its first
   * frame can then switch them freely (adaptive quality tiers do) without rebuilding a shader.
   */
  setShadowQuality(quality: ShadowQuality): void {
    const enabled = quality !== 'off';
    let parked = false;
    for (const light of this.sunLights()) {
      if (this.backend === 'webgpu' && this.shadowLights.has(light)) {
        // three r184's WebGPU shadow node does not survive being switched off and on, resized or
        // retyped: render objects cached for the earlier state keep sampling its disposed depth
        // texture, every submit fails and the frame stops updating. Once a map exists it keeps
        // its size and type; 'off' stops redrawing it and fades it out.
        light.shadow.autoUpdate = enabled;
        light.shadow.intensity = enabled ? 1 : 0;
        continue;
      }
      if (!enabled) {
        if (this.shadowLights.has(light)) {
          // WebGL builds each lit program for the shadows it receives. Clearing castShadow or the
          // renderer's shadow map rebuilt every program in view at once, synchronously, in the
          // next frame: seconds of frozen flight when adaptive quality crossed the shadowless
          // tiers. The parked map keeps the programs; its lookups cost little next to drawing it.
          light.shadow.autoUpdate = false;
          light.shadow.intensity = 0;
          parked = true;
        } else light.castShadow = false;
        continue;
      }
      if (!light.castShadow) this.shadowCastersWarmed = false;
      light.castShadow = true;
      light.shadow.autoUpdate = true;
      light.shadow.intensity = 1;
      const size = SHADOW_MAP_SIZE[quality];
      if (light.shadow.mapSize.x !== size) {
        light.shadow.mapSize.set(size, size);
        // WebGL rebuilds a missing map at the new size. WebGPU's shadow node owns its render
        // target (and is never resized once created, above).
        if (this.backend === 'webgl') {
          light.shadow.map?.dispose();
          light.shadow.map = null;
        }
      }
      this.shadowLights.add(light);
    }
    if (this.backend === 'webgpu' && this.three.shadowMap.enabled) return;
    if (parked && this.three.shadowMap.enabled) return;
    this.three.shadowMap.enabled = enabled;
    this.three.shadowMap.type = quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  }

  /** WebGL PCF shadow lookups against a reversed depth buffer; see focusDirectionalShadow. */
  private webglReversedPcfShadows(): boolean {
    const three = this.three as THREE.WebGLRenderer;
    return (
      three.state?.buffers.depth.getReversed() === true &&
      three.shadowMap.type !== THREE.BasicShadowMap &&
      three.shadowMap.type !== THREE.VSMShadowMap
    );
  }

  /** The directional lights standing for the sun: the environment rig's, and the sky's. */
  private sunLights(): THREE.DirectionalLight[] {
    const lights: THREE.DirectionalLight[] = [];
    findEnvironmentRig(this.scene)?.traverse((object) => {
      if (object instanceof THREE.DirectionalLight && object.userData.molenSun === true)
        lights.push(object);
    });
    if (this.activeSky) lights.push(this.activeSky.sunLight);
    return lights;
  }

  private applyShadowFocus(): void {
    const focus = this.shadowFocus;
    if (focus === undefined || !this.three.shadowMap.enabled) return;
    const center = this.shadowCenter.set(
      focus.center[0] - this.worldOrigin[0],
      focus.center[1] - this.worldOrigin[1],
      focus.center[2] - this.worldOrigin[2],
    );
    for (const light of this.sunLights()) {
      if (!light.castShadow) continue;
      const direction =
        light === this.activeSky?.sunLight
          ? this.shadowDirection.fromArray(this.activeSky.frame.sunDirection)
          : this.shadowDirection.copy(light.userData.molenSunDirection as THREE.Vector3);
      focusDirectionalShadow(
        light,
        direction,
        center,
        focus.radius,
        this.backend === 'webgl' && this.webglReversedPcfShadows(),
        this.worldOrigin,
      );
    }
  }

  /** Active weather effects; physical weather data is also available in the simulation component. */
  get weather(): WeatherVisual | undefined {
    return this.activeWeather;
  }

  /**
   * Per-pixel cloud work, default 'medium': ray-march steps and light samples, erosion detail
   * from 'high', and from 'high' also cloud shadows on every lit surface. Takes effect on the
   * next frame without rebuilding any shader, so adaptive quality tiers may change it freely.
   */
  setCloudQuality(quality: CloudQuality): void {
    this.cloudQualityLevel = quality;
    this.activeWeather?.setCloudQuality(quality);
  }

  get cloudQuality(): CloudQuality {
    return this.cloudQualityLevel;
  }

  /** Apply the singleton weather component without rebuilding the sky or moving the camera. */
  setWeather(data: WeatherData | undefined): void {
    if (data && this.activeWeather) this.activeWeather.setData(data);
    else {
      const next = data
        ? new WeatherVisual(data, {
            textures: this.cloudTextures,
            quality: this.cloudQualityLevel,
            backend: this.backend,
            ...(this.cloudBackend ? { createCloudMaterial: this.cloudBackend.material } : {}),
          })
        : undefined;
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
        const clouds = await import('./webgpu-clouds');
        return new Renderer(opts, {
          three,
          backend: 'webgpu',
          clouds: {
            material: clouds.createWebGpuCloudMaterial,
            installShadows: (uniforms) => clouds.installWebGpuCloudShadows(three, uniforms),
          },
          ...(optimizer ? { optimizer } : {}),
          ...(opts.reflections === true
            ? {
                reflectionFilter: (
                  await import('./webgpu-sky-reflections')
                ).createWebGpuSkyReflectionFilter(three),
              }
            : {}),
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
    this.releaseContextOnDispose = opts.releaseContextOnDispose ?? false;
    this.cameraNear = cameraNear;
    this.cameraFar = cameraFar;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.pixelRatio = pixelRatio;
    this.backend = initialized?.backend ?? 'webgl';
    this.optimizer = initialized?.optimizer;
    this.cloudBackend = initialized?.clouds;
    this.three =
      initialized?.three ??
      createWebGlRenderer({
        canvas: opts.canvas as HTMLCanvasElement | undefined,
        antialias: opts.antialias ?? false,
        preserveDrawingBuffer: opts.preserveDrawingBuffer ?? true,
        powerPreference: opts.powerPreference ?? 'default',
        reversedDepthBuffer: opts.reverseDepthBuffer ?? false,
        logarithmicDepthBuffer: opts.logarithmicDepthBuffer ?? false,
      });
    this.three.setPixelRatio(pixelRatio);
    // Before any lit shader is built: every one reads the cloud shadow, which stays off (and
    // costs a uniform test) until weather with clouds and a 'high' cloud quality turn it on.
    if (this.cloudBackend) this.cloudBackend.installShadows(this.cloudShadows);
    else
      this.releaseCloudShadows = installWebGlCloudShadows(
        this.three as THREE.WebGLRenderer,
        this.cloudShadows,
      );
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
    // The scene never moves. Left to recompose each frame, it would mark itself dirty and force
    // every descendant's world matrix to recompute, static world included.
    this.scene.matrixAutoUpdate = false;
    this.reflections =
      opts.reflections === true
        ? new SkyReflections(
            this.scene,
            initialized?.reflectionFilter ??
              createWebGlSkyReflectionFilter(this.three as THREE.WebGLRenderer),
          )
        : undefined;
    this.worldRoot = new THREE.Group();
    this.worldRoot.name = 'molen:world-root';
    // Recomposing the root every frame marks every descendant's world matrix dirty, so a large
    // static world pays for a full matrix pass per frame. It moves only when the origin rebases.
    this.worldRoot.matrixAutoUpdate = false;
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

  /** Drawing size in CSS pixels as last passed to `setSize` (before the pixel ratio). */
  getViewportSize(): [number, number] {
    return [this.viewportWidth, this.viewportHeight];
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
    this.worldRoot.updateMatrix();
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

  /**
   * Prepare shared resources once; all dependants await the same admission jobs.
   *
   * With `parent` (the object this root will be added to), LODs are evaluated for the current
   * camera as if attached: the levels they select are prepared before this resolves, and the
   * other levels afterwards in the background, so publication waits only for what can be seen.
   * Queued work is cancelled once every caller waiting for it has aborted, and background work
   * once its mesh or geometry is disposed.
   *
   * `root.userData.admissionPriority` admits the root's own work as `'urgent'` (ahead of normal
   * work) or `'background'` (only in budget normal work leaves: content nobody waits on yet).
   */
  async prepareObject(
    root: THREE.Object3D,
    signal?: AbortSignal,
    parent?: THREE.Object3D,
  ): Promise<void> {
    if (signal?.aborted) throw new DOMException('Preparation cancelled', 'AbortError');
    updateDetachedWorldMatrix(root, parent);
    const lods = parent === undefined ? undefined : unselectedLodLevels(root, this.camera);
    const deferredLevels = lods === undefined ? undefined : new Set([...lods.values()].flat());
    // The terrain stream marks its ground this way: see AdmissionOptions.priority.
    const priority = root.userData.admissionPriority;
    const foreground = createLane(priority === 'background', priority === 'urgent');
    const background = createLane(true);
    const state = this.programState();
    const interest: WarmupInterest | 'pinned' =
      signal === undefined ? 'pinned' : new WarmupInterest(this.cancel);
    const deferred: THREE.Mesh[] = [];
    const switching: THREE.Mesh[] = [];
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.noteShadowCaster(mesh);
      if (mesh.userData.materialVariants !== undefined) switching.push(mesh);
      if (deferredLevels !== undefined && withinAny(mesh, root, deferredLevels))
        deferred.push(mesh);
      else this.prepareMesh(mesh, foreground, interest, state);
    });
    this.flushWebGlBatches(foreground);
    // After the foreground, so buffers shared with a visible level upload with it.
    const deferredInterests = deferred.map((mesh) => {
      const meshInterest = new WarmupInterest(this.cancel);
      this.prepareMesh(mesh, background, meshInterest, state);
      return meshInterest;
    });
    this.flushWebGlBatches(background);
    deferred.forEach((mesh, index) => {
      const meshInterest = deferredInterests[index] as WarmupInterest;
      releaseOnDispose(mesh, meshInterest);
      this.deferredMeshes.set(mesh, meshInterest);
      void meshInterest.settled().then(() => {
        if (this.deferredMeshes.get(mesh) === meshInterest) this.deferredMeshes.delete(mesh);
      });
    });
    for (const mesh of switching) this.prepareVariants(mesh);
    for (const [lod, levels] of lods ?? []) if (levels.length > 0) this.guardLod(lod);
    // Shared resource work belongs to the renderer: one caller's cancellation cancels a queued
    // job only when no other caller still waits for it. The caller's signal decides publication.
    const release = (): void => {
      if (interest !== 'pinned') interest.release();
    };
    signal?.addEventListener('abort', release, { once: true });
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled(foreground.jobs);
    } finally {
      signal?.removeEventListener('abort', release);
    }
    if (signal?.aborted) throw new DOMException('Preparation cancelled', 'AbortError');
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }

  /**
   * Build `next`'s shaders for every kind of prepared mesh that draws `current`, before the caller
   * copies `next` into `current`: a progressive material upgrading its placeholder in place once a
   * texture bake lands. Three shares a program between materials built alike, so the upgraded
   * placeholder draws with it at once. Otherwise every mesh showing the placeholder built its new
   * shaders in the next frame, together: seconds of frozen flight shortly after loading. The work
   * runs in the background lane. Keep `next` alive while `current` uses the shared program.
   */
  async prepareMaterialChange(current: THREE.Material, next: THREE.Material): Promise<void> {
    if (this.disposed) return;
    const builds: Promise<unknown>[] = [];
    for (const ref of this.materialMeshes.get(current)?.values() ?? []) {
      const mesh = ref.deref();
      if (mesh === undefined) continue;
      const warmup = this.warmup(() => this.compileMesh(mesh, next), createLane(true), {
        label: 'shader-upgrade',
        bytes: 0,
      });
      warmup.pinned = true;
      builds.push(warmup.promise);
    }
    await Promise.allSettled(builds);
  }

  private prepareMesh(
    mesh: THREE.Mesh,
    lane: PreparationLane,
    interest: WarmupInterest | 'pinned',
    state: string,
  ): void {
    const need = (promise: Promise<unknown>): void => {
      lane.jobs.add(promise);
      const warmup = this.warmups.get(promise);
      if (warmup === undefined || warmup.settled) return;
      if (interest === 'pinned') warmup.pinned = true;
      else interest.join(warmup);
      if (!lane.background) this.admission.promote(promise);
    };
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Everything of the mesh's own a program is built for: instancing and its colors, skinning,
    // attributes and morph targets.
    const key = `${Boolean((mesh as THREE.InstancedMesh).isInstancedMesh)}/${Boolean((mesh as THREE.InstancedMesh).instanceColor)}/${Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh)}/${Object.keys(mesh.geometry.attributes).sort().join(',')}/${Object.keys(mesh.geometry.morphAttributes).sort().join(',')}`;
    const variants: Array<{ map: Map<string, Promise<unknown>>; key: string }> = [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (!(value instanceof THREE.Texture)) continue;
        const existing = this.preparedResources.get(value);
        if (existing?.version === value.version) {
          need(existing.promise);
          continue;
        }
        const upload = this.warmup(() => this.three.initTexture(value), lane, {
          label: 'texture-upload',
          bytes: textureBytes(value),
        });
        this.rememberPreparation([value], upload);
        need(upload.promise);
      }
      let meshes = this.materialMeshes.get(material);
      if (!meshes) {
        meshes = new Map();
        this.materialMeshes.set(material, meshes);
      }
      if (meshes.get(key)?.deref() === undefined) meshes.set(key, new WeakRef(mesh));
      let map = this.warmedPrograms.get(material);
      if (!map) {
        map = new Map();
        this.warmedPrograms.set(material, map);
      }
      const variantKey = `${material.version}/${key}/${state}`;
      const existing = map.get(variantKey);
      if (existing) need(existing);
      else variants.push({ map, key: variantKey });
    }
    const instanced = mesh as THREE.InstancedMesh;
    const attributes = [
      ...Object.values(mesh.geometry.attributes).map((a) =>
        a instanceof THREE.InterleavedBufferAttribute ? a.data : a,
      ),
      ...(mesh.geometry.index ? [mesh.geometry.index] : []),
      ...(instanced.isInstancedMesh
        ? [instanced.instanceMatrix, ...(instanced.instanceColor ? [instanced.instanceColor] : [])]
        : []),
    ];
    const fresh = attributes.filter((attribute) => {
      if (lane.glAttributes.has(attribute)) return false;
      const existing = this.preparedResources.get(attribute);
      if (existing?.version === attribute.version) {
        need(existing.promise);
        return false;
      }
      return true;
    });
    // Three keys instanced/skinned/morph node builders by object identity. LODs can share
    // every buffer and material while still needing their own builder before first visibility.
    const objectSpecific =
      instanced.isInstancedMesh ||
      (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
      mesh.morphTargetInfluences !== undefined;
    const previousMesh = this.warmedMeshes.get(mesh);
    if (previousMesh) need(previousMesh);
    let compilation: Warmup | undefined;
    if (
      variants.length > 0 ||
      (this.backend === 'webgpu' && (fresh.length > 0 || (objectSpecific && !previousMesh)))
    ) {
      const warmup = this.warmup(() => this.compileMesh(mesh), lane, {
        label:
          this.backend === 'webgpu' && fresh.length > 0
            ? 'geometry-upload-and-shader'
            : 'shader-warmup',
        bytes:
          this.backend === 'webgpu' ? fresh.reduce((sum, a) => sum + a.array.byteLength, 0) : 0,
      });
      compilation = warmup;
      need(warmup.promise);
      if (this.backend === 'webgpu') {
        this.warmedMeshes.set(mesh, warmup.promise);
        const forget = (): void => {
          if (this.warmedMeshes.get(mesh) === warmup.promise) this.warmedMeshes.delete(mesh);
        };
        warmup.forget.push(forget);
        void warmup.promise.catch(forget);
      }
      for (const variant of variants) {
        variant.map.set(variant.key, warmup.promise);
        const forget = (): void => {
          if (variant.map.get(variant.key) === warmup.promise) variant.map.delete(variant.key);
        };
        warmup.forget.push(forget);
        void warmup.promise.catch(forget);
      }
    }
    if (fresh.length === 0) return;
    if (this.backend === 'webgpu') {
      this.rememberPreparation(fresh, compilation as Warmup);
      return;
    }
    const bytes = fresh.reduce((sum, a) => sum + a.array.byteLength, 0);
    let batch = lane.glBatches.at(-1);
    if (!batch || batch.meshes.length >= 16 || batch.bytes + bytes > this.uploadBatchBytes) {
      batch = { meshes: [], attributes: [], bytes: 0, interests: new Set() };
      lane.glBatches.push(batch);
    }
    batch.meshes.push(mesh);
    batch.attributes.push(...fresh);
    batch.bytes += bytes;
    batch.interests.add(interest);
    for (const attribute of fresh) lane.glAttributes.add(attribute);
  }

  private flushWebGlBatches(lane: PreparationLane): void {
    for (const batch of lane.glBatches) {
      const upload = this.warmup(() => this.prepareWebGlGeometries(batch.meshes), lane, {
        label: 'geometry-upload',
        bytes: batch.bytes,
      });
      this.rememberPreparation(batch.attributes, upload);
      lane.jobs.add(upload.promise);
      for (const interest of batch.interests) {
        if (interest === 'pinned') upload.pinned = true;
        else interest.join(upload);
      }
    }
    lane.glBatches.length = 0;
  }

  /**
   * A mesh that swaps its own material, as an instanced detail switch swaps in an opaque twin for
   * its coarser levels, lists every material in `userData.materialVariants`. Each needs its own
   * shader build, which the first frame to draw it would otherwise make mid-frame: in flight a whole
   * view of trees changed level at once and built their twins in one frame, for most of a second.
   * `userData.materialReady(material)` tells the mesh's owner whether one is ready. Until it is, the
   * owner keeps what it shows; asking queues its build ahead of other work. Most batches never
   * change level, so a variant is built only once its mesh asks for it.
   */
  private prepareVariants(mesh: THREE.Mesh): void {
    let builds = this.warmedVariants.get(mesh);
    if (builds === undefined) {
      builds = new Map();
      this.warmedVariants.set(mesh, builds);
    }
    // Prepared with the mesh itself, which is published only once that is done.
    builds.set(mesh.material as THREE.Material, null);
    mesh.userData.materialReady ??= (material: THREE.Material): boolean =>
      this.variantReady(mesh, material);
  }

  /** Whether `mesh` can draw `material` without building it mid-frame; builds it first if not. */
  private variantReady(mesh: THREE.Mesh, material: THREE.Material): boolean {
    const builds = this.warmedVariants.get(mesh);
    const known = builds?.get(material);
    if (builds === undefined || known === null) return true;
    let promise = known;
    if (promise === undefined) {
      let interest = this.variantInterests.get(mesh);
      if (interest === undefined) {
        interest = new WarmupInterest(this.cancel);
        releaseOnDispose(mesh, interest);
        this.variantInterests.set(mesh, interest);
      }
      const warmup = this.warmup(() => this.compileMesh(mesh, material), createLane(true), {
        label: 'shader-variant',
        bytes: 0,
      });
      interest.join(warmup);
      builds.set(material, warmup.promise);
      const forget = (): void => {
        if (builds.get(material) === warmup.promise) builds.delete(material);
      };
      warmup.forget.push(forget);
      void warmup.promise.catch(forget);
      promise = warmup.promise;
    }
    const warmup = this.warmups.get(promise);
    if (warmup === undefined || warmup.settled) return true;
    this.admission.promote(promise, { front: true });
    return false;
  }

  /** Queue one cancellable warm-up job in the lane's admission priority. */
  private warmup(
    task: () => unknown,
    lane: PreparationLane,
    options: { label: string; bytes: number },
  ): Warmup {
    const controller = new AbortController();
    const promise = this.admission.run(task, {
      ...options,
      signal: controller.signal,
      priority: lane.background ? 'background' : lane.urgent ? 'urgent' : 'normal',
    });
    const warmup: Warmup = {
      promise,
      controller,
      waiters: 0,
      pinned: false,
      settled: false,
      forget: [],
    };
    const settled = (): void => {
      warmup.settled = true;
      warmup.forget.length = 0;
    };
    void promise.then(settled, settled);
    this.warmups.set(promise, warmup);
    return warmup;
  }

  /**
   * Until every level is prepared, an LOD keeps showing a prepared level rather than the one it
   * selects: drawing an unprepared level would build its shaders synchronously, mid-frame. The
   * wanted level's background work moves to the normal lane. Three and the scene optimizer call
   * `update` each frame for visible LODs, so the guard costs nothing elsewhere and removes itself.
   */
  private guardLod(lod: THREE.LOD): void {
    if (this.guardedLods.has(lod)) return;
    this.guardedLods.add(lod);
    const own = Object.hasOwn(lod, 'update');
    const update = lod.update;
    lod.update = (camera: THREE.Camera): void => {
      const shown = lod.levels.findIndex((level) => level.object.visible);
      update.call(lod, camera);
      if (this.holdUnpreparedLevel(lod, shown)) return;
      if (own) lod.update = update;
      else delete (lod as Partial<Pick<THREE.LOD, 'update'>>).update;
      this.guardedLods.delete(lod);
    };
  }

  /** Returns whether any level is still being prepared. */
  private holdUnpreparedLevel(lod: THREE.LOD, shown: number): boolean {
    // Geometry-switch LODs have no `levels`: their update hides a mesh altogether beyond its
    // useful range (ground cover under an aircraft, for example). Publish the tile without
    // waiting for those invisible meshes, and prepare them before a later approach reveals them.
    if (lod.levels.length === 0) {
      let pending = false;
      for (const child of lod.children) {
        if (!this.pendingWithin(child, child.visible)) continue;
        pending = true;
        child.visible = false;
      }
      return pending;
    }
    const ready = lod.levels.map((level) => !this.pendingWithin(level.object, false));
    if (ready.every(Boolean)) return false;
    const wanted = lod.getCurrentLevel();
    if (ready[wanted] === true) return true;
    this.pendingWithin(lod.levels[wanted]?.object, true);
    let fallback = shown >= 0 && ready[shown] === true ? shown : -1;
    for (let offset = 1; fallback < 0 && offset < ready.length; offset++) {
      if (ready[wanted - offset] === true) fallback = wanted - offset;
      else if (ready[wanted + offset] === true) fallback = wanted + offset;
    }
    if (fallback >= 0)
      lod.levels.forEach((level, index) => {
        level.object.visible = index === fallback;
      });
    return true;
  }

  /** Whether `object` still has deferred preparation, optionally moving it to the normal lane. */
  private pendingWithin(object: THREE.Object3D | undefined, promote: boolean): boolean {
    let pending = false;
    object?.traverse((child) => {
      const interest = this.deferredMeshes.get(child);
      if (interest === undefined) return;
      pending = true;
      if (promote) for (const promise of interest.promises()) this.admission.promote(promise);
    });
    return pending;
  }

  /** Nobody waits any longer: drop the job from every cache first, then from the queue. */
  private cancelWarmup(warmup: Warmup): void {
    if (warmup.settled || warmup.pinned || warmup.waiters > 0) return;
    for (const forget of warmup.forget.splice(0)) forget();
    warmup.controller.abort();
  }

  private rememberPreparation(resources: readonly { version: number }[], warmup: Warmup): void {
    const promise = warmup.promise;
    for (const resource of resources)
      this.preparedResources.set(resource, { version: resource.version, promise });
    const forget = (): void => {
      for (const resource of resources)
        if (this.preparedResources.get(resource)?.promise === promise)
          this.preparedResources.delete(resource);
    };
    warmup.forget.push(forget);
    void promise.catch(forget);
  }

  /**
   * While WebGL shadows are parked the shadow pass never runs, so no depth program is built for
   * the casters arriving meanwhile, and the first frame with shadows back built every one of them
   * at once (an adaptive tier change, mid-flight). A caster of a kind the map has not drawn yet
   * asks the parked map for one render, which builds its depth program as it streams in. The
   * kinds follow three's shadow pass: one depth material, cloned for alpha-tested maps,
   * displacement or clipping, built per mesh kind and side.
   */
  private noteShadowCaster(mesh: THREE.Mesh): void {
    if (this.backend !== 'webgl' || !mesh.castShadow) return;
    const instanced = mesh as THREE.InstancedMesh;
    const kind = `${Boolean(instanced.isInstancedMesh)}/${Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh)}/${Object.keys(mesh.geometry.morphAttributes).sort().join(',')}`;
    let fresh = false;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const textured = material as THREE.MeshStandardMaterial;
      const variant =
        mesh.customDepthMaterial !== undefined
          ? `custom:${mesh.customDepthMaterial.uuid}`
          : [
              kind,
              material.alphaTest > 0 && (textured.map != null || textured.alphaMap != null),
              textured.displacementMap != null && textured.displacementScale !== 0,
              material.alphaToCoverage,
              material.clipShadows && (material.clippingPlanes?.length ?? 0) > 0,
              material.shadowSide ?? material.side,
            ].join('/');
      if (this.casterVariants.has(variant)) continue;
      this.casterVariants.add(variant);
      fresh = true;
    }
    if (!fresh) return;
    for (const light of this.sunLights())
      if (this.shadowLights.has(light) && !light.shadow.autoUpdate) light.shadow.needsUpdate = true;
  }

  /** Build `mesh` for the frame's draw target, drawn with `material` when given. */
  private compileMesh(mesh: THREE.Mesh, material?: THREE.Material): Promise<unknown> {
    // With ambient occlusion every frame draws the world into its target, which writes normals
    // beside color: a build for the canvas would go unused, and the frame would build the object
    // again itself, mid-frame, creating its pipeline synchronously. Wait for the pass to load.
    const load = this.occlusionOptions !== undefined ? this.occlusionLoad : undefined;
    if (load !== undefined && this.occlusion === undefined) {
      const retry = (): Promise<unknown> => this.compileMesh(mesh, material);
      return load.then(retry, retry);
    }
    const occlusion =
      this.occlusionOptions !== undefined && this.occlusion?.camera === this.camera
        ? this.occlusion.pass
        : undefined;
    const visible = mesh.visible,
      culled = mesh.frustumCulled,
      shown = mesh.material;
    mesh.visible = true;
    mesh.frustumCulled = false;
    // The compile reads the material before its first await, so it is restored while it runs.
    if (material !== undefined) mesh.material = material;
    const traverse = this.scene.traverseVisible;
    const ownTraverse = Object.hasOwn(this.scene, 'traverseVisible');
    try {
      if (this.scene.onBeforeRender === THREE.Object3D.prototype.onBeforeRender) {
        // compileAsync traverses the target scene only to gather lights, once for EVERY mesh, on
        // both backends. Keep the real scene identity (node/render-object cache keys depend on
        // it), but gather its lights once between rendered frames instead of rescanning thousands
        // of tile meshes.
        const lights = this.sceneLights();
        this.scene.traverseVisible = (visit) => {
          for (const light of lights) visit(light);
        };
      }
      if (occlusion !== undefined) return occlusion.compile(mesh);
      if (this.backend === 'webgl') return this.compileWebGl(mesh);
      return this.three.compileAsync(mesh, this.camera, this.scene);
    } finally {
      if (ownTraverse) this.scene.traverseVisible = traverse;
      else delete (this.scene as Partial<THREE.Scene>).traverseVisible;
      mesh.visible = visible;
      mesh.frustumCulled = culled;
      mesh.material = shown;
    }
  }

  /**
   * Three's compileAsync, but waiting for the programs built for this mesh. Three polls each
   * material's current program, which the next frame resets for whatever it drew last: a
   * material shared with drawn meshes (every building's wall) reported its ready program while
   * the instanced variant was still linking, and that variant's first draw waited for the link
   * mid-frame (130 ms in flight).
   */
  private compileWebGl(mesh: THREE.Mesh): Promise<unknown> {
    type Program = { program?: unknown; isReady(): boolean };
    const renderer = this.three as THREE.WebGLRenderer;
    const all = (): Program[] => (renderer.info.programs ?? []) as unknown as Program[];
    const known = new Set(all());
    const programs = new Set<Program>();
    for (const material of renderer.compile(mesh, this.camera, this.scene)) {
      const program = (renderer.properties.get(material) as { currentProgram?: Program })
        .currentProgram;
      if (program !== undefined) programs.add(program);
    }
    // A double-sided transparent material builds a back- and a front-face program.
    for (const program of all()) if (!known.has(program)) programs.add(program);
    return new Promise<void>((resolve) => {
      const check = (): void => {
        // A disposed program (its material released meanwhile) counts as done.
        for (const program of programs)
          if (program.program === undefined || program.isReady()) programs.delete(program);
        if (programs.size === 0) resolve();
        else setTimeout(check, 10);
      };
      check();
    });
  }

  /** The scene's visible lights, gathered once between rendered frames for warm-up builds. */
  private sceneLights(): THREE.Object3D[] {
    this.preparationLights ??= (() => {
      const lights: THREE.Object3D[] = [];
      // The prototype's walk: a compile in progress replaces the scene's own with this list.
      THREE.Object3D.prototype.traverseVisible.call(this.scene, (object) => {
        if ((object as THREE.Light).isLight) lights.push(object);
      });
      return lights;
    })();
    return this.preparationLights;
  }

  /**
   * What a lit program is built for besides its material and mesh: the scene's lights and which
   * cast shadows, the shadow map, fog, environment and output. Warm-ups are remembered under it.
   * Without it a material built before the sky's sun, its shadows or its reflections existed
   * counted as prepared, and the next tile drawing it built the real program mid-frame.
   */
  private programState(): string {
    let lights = '';
    for (const light of this.sceneLights())
      lights += `${light.type}${light.castShadow ? '*' : ''},`;
    const fog = this.scene.fog;
    const environment = this.scene.environment;
    const image = environment?.image as { height?: number } | undefined;
    return [
      lights,
      this.three.shadowMap.enabled,
      this.three.shadowMap.type,
      fog === null ? '' : (fog as THREE.FogExp2).isFogExp2 ? 'exp2' : 'linear',
      environment === null ? '' : `${environment.mapping}:${image?.height ?? ''}`,
      this.three.toneMapping,
      this.three.outputColorSpace,
    ].join('/');
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
    this.preparationLights = undefined;
    if (this.disposed) throw new Error('Renderer has been disposed');
    if (this.deviceLossReason !== undefined) {
      throw new Error(
        `WebGPU device lost: ${this.deviceLossReason}. Recreate the viewer, or reload with WebGL.`,
      );
    }
    if (this.backend === 'webgpu') this.three.info.reset();
    const sky = this.activeSky;
    const weather = this.activeWeather;
    const cloudAttenuation = weather?.cloudAttenuation ?? 0;
    // Spatial cloud shadows replace the uniform dimming of direct light. Decided once for the
    // frame, so the lights and the shadow uniforms always switch over in the same frame.
    const cloudShadowed = weather?.shadowsActive ?? false;
    const directAttenuation = cloudShadowed ? 0 : cloudAttenuation;
    sky?.setCloudAttenuation(cloudAttenuation, directAttenuation);
    sky?.update(this.environmentTimeOverride ?? this.environmentSeconds);
    // Only the environment rig is weather-managed; authored lamps remain independent.
    findEnvironmentRig(this.scene)?.traverse((object) => {
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
        (object instanceof THREE.DirectionalLight
          ? 1 - directAttenuation * 0.92
          : 1 - cloudAttenuation * 0.2);
    });
    weather?.update(
      this.weatherTimeOverride ?? this.environmentSeconds,
      this.camera,
      this.worldOrigin,
      sky?.frame,
    );
    if (weather) weather.writeShadows(this.cloudShadows, cloudShadowed);
    else this.cloudShadows.molenCloudShadow.value.x = 0;
    // Every lit shader samples the shadow map, but WebGPU uploads a texture's new data only when
    // some object that binds it refreshes, which static meshes do not: upload it here.
    const shadowMap = this.cloudShadows.molenCloudMap.value;
    if (weather && shadowMap.version !== this.cloudShadowMapVersion) {
      this.cloudShadowMapVersion = shadowMap.version;
      this.three.initTexture(shadowMap);
    }
    let reflectedAmbient: THREE.HemisphereLight | undefined;
    if (this.reflections) {
      const rig = findEnvironmentRig(this.scene);
      const ambient = rig?.children.find(
        (light): light is THREE.HemisphereLight => light instanceof THREE.HemisphereLight,
      );
      const sun = rig?.children.find(
        (light): light is THREE.DirectionalLight => light instanceof THREE.DirectionalLight,
      );
      this.reflections.update(
        sky?.reflectionState ??
          reflectionStateFromLights(
            ambient,
            sun,
            this.three.getClearColor(this.reflectionClearColor),
            weather?.cloudAttenuation ?? 0,
          ),
      );
      if (this.reflections.active) reflectedAmbient = sky?.ambientLight ?? ambient;
    }
    this.hideReflectedAmbient(reflectedAmbient);
    const baseFog = this.scene.fog;
    if (weather) this.scene.fog = weather.fogFor(baseFog, sky?.frame);
    const occlusion = this.currentOcclusion();
    try {
      if (occlusion) {
        if (sky) {
          sky.update(this.environmentTimeOverride ?? this.environmentSeconds);
          sky.prepareCamera(this.camera);
        }
        this.applyShadowFocus();
        const autoReset = this.three.info.autoReset;
        this.three.info.reset();
        this.three.info.autoReset = false;
        try {
          this.optimized(() => occlusion.render(sky, !this.occlusionSuspended));
        } finally {
          this.three.info.autoReset = autoReset;
        }
      } else if (sky) {
        sky.update(this.environmentTimeOverride ?? this.environmentSeconds);
        sky.prepareCamera(this.camera);
        this.applyShadowFocus();
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
      } else {
        this.applyShadowFocus();
        this.renderScene();
      }
      if (this.backend === 'webgl') opaqueDrawingBuffer(this.three as THREE.WebGLRenderer);
      // Upload warm-ups and reflection filtering also render offscreen. Only a completed
      // visible frame may replace the stats exposed to hosts and adaptive quality policies.
      const info = this.three.info.render;
      this.lastRenderStats.drawCalls = 'drawCalls' in info ? info.drawCalls : info.calls;
      this.lastRenderStats.triangles = info.triangles;
    } finally {
      this.scene.fog = baseFog;
    }
  }

  /**
   * The PMREM supplies both diffuse sky irradiance and specular reflection, so while it is the
   * scene environment the hemisphere it was sampled from must not light surfaces as well. The
   * light is hidden, between frames too, rather than dimmed for the visible draw alone: three's
   * WebGPU renderer updates light uniforms once per frame of its own clock, and warm-up compiles
   * finish between viewer frames, so a light restored after each draw could leave its full
   * intensity in the next frame's uniforms and the whole scene flashed bright for that frame.
   * Its intensity stays the authored value for weather and hosts; it shows again when a host
   * environment takes over or the renderer is disposed.
   */
  private hideReflectedAmbient(light: THREE.HemisphereLight | undefined): void {
    const hidden = this.hiddenAmbient;
    if (hidden !== undefined && hidden.light !== light) {
      if (hidden.light.visible !== hidden.visible) this.shadowCastersWarmed = false;
      hidden.light.visible = hidden.visible;
      this.hiddenAmbient = undefined;
    }
    if (light === undefined) return;
    this.hiddenAmbient ??= { light, visible: light.visible };
    if (light.visible) this.shadowCastersWarmed = false;
    light.visible = false;
  }

  private renderScene(): void {
    const warmup = this.shadowCasterWarmup();
    if (warmup !== undefined) this.scene.add(warmup);
    try {
      this.optimized(() => this.three.render(this.scene, this.camera));
    } finally {
      if (warmup !== undefined) {
        warmup.removeFromParent();
        for (const child of warmup.children) {
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      }
    }
  }

  /**
   * Once WebGL sun shadows draw, a frame of degenerate casters (one plain and one instanced mesh
   * per side): the shadow pass builds a depth program for each kind of caster the first time it
   * draws one, and the first double-sided caster in view held a mid-flight frame 10 ms. The
   * shadow pass keeps its depth materials, so the programs stay built; three keys them by the
   * scene's light counts too, so a light the renderer shows or hides warms them again.
   */
  private shadowCasterWarmup(): THREE.Group | undefined {
    if (this.shadowCastersWarmed || this.backend !== 'webgl' || !this.three.shadowMap.enabled)
      return undefined;
    if (!this.sunLights().some((light) => light.castShadow && light.shadow.intensity > 0))
      return undefined;
    this.shadowCastersWarmed = true;
    const group = new THREE.Group();
    group.name = 'molen:shadow-caster-warmup';
    for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide])
      for (const instanced of [false, true]) {
        // One triangle with no area: nothing to draw, in either pass.
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(new Array(9).fill(0), 3),
        );
        geometry.setAttribute(
          'normal',
          new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3),
        );
        const material = new THREE.MeshBasicMaterial({
          side,
          colorWrite: false,
          depthWrite: false,
        });
        const mesh = instanced
          ? new THREE.InstancedMesh(geometry, material, 1)
          : new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        group.add(mesh);
      }
    return group;
  }

  private optimized(draw: () => void): void {
    if (this.optimizer === undefined) {
      draw();
      return;
    }
    this.optimizer.prepare(this.scene, this.camera);
    const autoUpdate = this.scene.matrixWorldAutoUpdate;
    this.scene.matrixWorldAutoUpdate = false;
    try {
      draw();
      this.optimizer.finish();
    } finally {
      this.scene.matrixWorldAutoUpdate = autoUpdate;
    }
  }

  /**
   * Screen-space ambient occlusion on the WebGPU backend (a no-op on WebGL): creases, corners and
   * the ground around buildings and trees darken a little, as indirect light cannot reach them.
   * The frame then renders through a node pipeline; frames draw directly while it compiles.
   */
  setAmbientOcclusion(enabled: boolean, options: AmbientOcclusionOptions = {}): void {
    if (this.disposed) throw new Error('Renderer has been disposed');
    const next = enabled && this.backend === 'webgpu' ? { ...options } : undefined;
    const current = this.occlusionOptions;
    if (
      next !== undefined &&
      current !== undefined &&
      next.radius === current.radius &&
      next.strength === current.strength &&
      next.reach === current.reach
    )
      return;
    this.occlusion?.pass.dispose();
    this.occlusion = undefined;
    this.occlusionOptions = next;
    // Load the pass now, so objects prepared from here on build their shaders for its target.
    this.currentOcclusion();
  }

  /**
   * Skip the occlusion computation while keeping ambient occlusion set up: the frame still draws
   * into its target, and the image is copied out unshaded. Each object's shaders are built for
   * one draw target, so turning occlusion off and on again (`setAmbientOcclusion`) built every
   * object in view again, mid-frame, when the target changed; suspending changes nothing there.
   */
  suspendAmbientOcclusion(suspended: boolean): void {
    if (this.disposed) throw new Error('Renderer has been disposed');
    this.occlusionSuspended = suspended;
  }

  /** The occlusion pass for the current camera, building one in the background when needed. */
  private currentOcclusion(): WebGpuAmbientOcclusion | undefined {
    const options = this.occlusionOptions;
    if (options === undefined) return undefined;
    if (this.occlusion !== undefined && this.occlusion.camera !== this.camera) {
      this.occlusion.pass.dispose();
      this.occlusion = undefined;
    }
    if (this.occlusion === undefined && this.occlusionLoad === undefined) {
      const camera = this.camera;
      this.occlusionLoad = import('./webgpu-ambient-occlusion')
        .then(({ createWebGpuAmbientOcclusion }) =>
          createWebGpuAmbientOcclusion(this.three as WebGPURenderer, this.scene, camera, options),
        )
        .then((pass) => {
          if (this.disposed || this.occlusionOptions !== options) pass.dispose();
          else this.occlusion = { camera, pass };
        })
        .finally(() => {
          this.occlusionLoad = undefined;
        });
    }
    return this.occlusion?.camera === this.camera ? this.occlusion.pass : undefined;
  }

  /** Use for independent terrain/content chunks. WebGPU caches eligible opaque draw commands. */
  createRenderGroup(): THREE.Group {
    return this.optimizer?.createGroup() ?? new THREE.Group();
  }

  /** Last completed visible frame, excluding offscreen resource preparation. */
  stats(): { drawCalls: number; triangles: number } {
    return { ...this.lastRenderStats };
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
    this.occlusionOptions = undefined;
    this.occlusion?.pass.dispose();
    this.occlusion = undefined;
    this.activeSky?.dispose();
    this.activeSky = undefined;
    this.activeWeather?.dispose();
    this.activeWeather = undefined;
    this.releaseCloudShadows?.();
    this.cloudTextures.dispose();
    this.reflections?.dispose();
    this.hideReflectedAmbient(undefined);
    findEnvironmentRig(this.scene)?.traverse((object) => {
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
    if (this.releaseContextOnDispose && this.backend === 'webgl') {
      (this.three as THREE.WebGLRenderer).forceContextLoss();
    }
  }
}

type Attribute = THREE.BufferAttribute | THREE.InterleavedBuffer;
type DisposeTarget = {
  addEventListener(type: 'dispose', listener: () => void): void;
  removeEventListener(type: 'dispose', listener: () => void): void;
};

/** A queued warm-up job shared by every preparation that awaits it. */
interface Warmup {
  promise: Promise<unknown>;
  controller: AbortController;
  /** Interested parties that can still withdraw; an unsignalled caller pins the job instead. */
  waiters: number;
  pinned: boolean;
  settled: boolean;
  /** Drop the job from the preparation caches, synchronously, before cancelling it. */
  forget: Array<() => void>;
}

/** One party's interest in queued warm-ups: a caller's signal, or a deferred mesh's lifetime. */
class WarmupInterest {
  private readonly joined = new Set<Warmup>();
  private released = false;
  constructor(private readonly cancel: (warmup: Warmup) => void) {}
  join(warmup: Warmup): void {
    if (this.released || this.joined.has(warmup)) return;
    this.joined.add(warmup);
    warmup.waiters++;
  }
  release(): void {
    if (this.released) return;
    this.released = true;
    for (const warmup of this.joined) {
      warmup.waiters--;
      this.cancel(warmup);
    }
    this.joined.clear();
  }
  settled(): Promise<unknown> {
    return Promise.allSettled(this.promises());
  }
  promises(): Promise<unknown>[] {
    return [...this.joined].map((warmup) => warmup.promise);
  }
}

interface PreparationLane {
  /** Background work runs after normal admission work; only a root marked background awaits it. */
  readonly background: boolean;
  /** Admitted ahead of normal work (AdmissionOptions.priority 'urgent'). */
  readonly urgent: boolean;
  readonly jobs: Set<Promise<unknown>>;
  readonly glAttributes: Set<Attribute>;
  readonly glBatches: Array<{
    meshes: THREE.Mesh[];
    attributes: Attribute[];
    bytes: number;
    interests: Set<WarmupInterest | 'pinned'>;
  }>;
}

function createLane(background: boolean, urgent = false): PreparationLane {
  return { background, urgent, jobs: new Set(), glAttributes: new Set(), glBatches: [] };
}

/** World matrices as if `root` were already a child of `parent`, without attaching it. */
function updateDetachedWorldMatrix(root: THREE.Object3D, parent: THREE.Object3D | undefined): void {
  if (parent === undefined || root.parent !== null) {
    root.updateWorldMatrix(true, true);
    return;
  }
  parent.updateWorldMatrix(true, false);
  root.parent = parent;
  try {
    root.updateWorldMatrix(false, true);
  } finally {
    root.parent = null;
  }
}

/** Per automatic LOD, the levels it would not show to `camera` now; the rest are needed first. */
function unselectedLodLevels(
  root: THREE.Object3D,
  camera: THREE.Camera,
): Map<THREE.LOD, THREE.Object3D[]> {
  const unselected = new Map<THREE.LOD, THREE.Object3D[]>();
  root.traverse((object) => {
    const lod = object as THREE.LOD;
    if (!lod.isLOD || !lod.autoUpdate) return;
    // A LOD without levels may switch its own mesh's geometry and material (an instanced detail
    // switch): choosing now prepares the material it will first draw.
    lod.update(camera);
    if (lod.levels.length === 0) {
      const hidden = lod.children.filter((child) => !child.visible);
      if (hidden.length > 0) unselected.set(lod, hidden);
      return;
    }
    if (lod.levels.length < 2) return;
    const selected = lod.getCurrentLevel();
    unselected.set(
      lod,
      lod.levels.filter((_, index) => index !== selected).map((level) => level.object),
    );
  });
  return unselected;
}

function withinAny(
  object: THREE.Object3D,
  root: THREE.Object3D,
  set: Set<THREE.Object3D>,
): boolean {
  for (let node: THREE.Object3D | null = object; node !== null; node = node.parent) {
    if (set.has(node)) return true;
    if (node === root) return false;
  }
  return false;
}

/** Deferred work stays wanted while its mesh lives; tile eviction disposes one or the other. */
function releaseOnDispose(mesh: THREE.Mesh, interest: WarmupInterest): void {
  const targets = [mesh, mesh.geometry] as unknown as DisposeTarget[];
  const release = (): void => {
    for (const target of targets) target.removeEventListener('dispose', release);
    interest.release();
  };
  for (const target of targets) target.addEventListener('dispose', release);
  void interest.settled().then(() => {
    for (const target of targets) target.removeEventListener('dispose', release);
  });
}

function createWebGlRenderer(options: THREE.WebGLRendererParameters): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer(options);
  if (options.reversedDepthBuffer && renderer.capabilities.reversedDepthBuffer === false) {
    // Three silently falls back to ordinary depth without EXT_clip_control. A world
    // viewer's 5 cm–500 km clip range would then make even nearby surfaces fight.
    // Reuse the context: replacing the renderer must not consume a second GL context.
    const canvas = renderer.domElement;
    const context = renderer.getContext();
    renderer.dispose();
    return new THREE.WebGLRenderer({
      ...options,
      canvas,
      context,
      reversedDepthBuffer: false,
      logarithmicDepthBuffer: true,
    });
  }
  return renderer;
}

/**
 * Three r184 always asks for an alpha drawing buffer and keeps the canvas opaque by having opaque
 * materials write alpha 1. Alpha-to-coverage materials (frayed pavement edges, leaf cards) write
 * their coverage as alpha instead, so pixels they only partly covered left the canvas translucent
 * and the page behind it showed through: pale speckle along curbs and in canopies, plainest at
 * night. A clear of the alpha channel alone makes the finished frame opaque again.
 */
function opaqueDrawingBuffer(renderer: THREE.WebGLRenderer): void {
  if (renderer.getRenderTarget() !== null) return;
  const gl = renderer.getContext();
  const color = renderer.state.buffers.color;
  // Mask and clear color go through three's state, which caches both and skips calls it thinks
  // redundant; the clear color it sets again before its own next clear.
  color.setMask(true);
  color.setClear(0, 0, 0, 1, false);
  gl.colorMask(false, false, false, true);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.colorMask(true, true, true, true);
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
