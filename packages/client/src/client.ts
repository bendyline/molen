import type { MaterialBaker } from '@bendyline/molen-materials';
import type {
  Command,
  ControlAction,
  DiagMessage,
  EngineEvent,
  EntityId,
  JsonObject,
  Keyframe,
  MessageLink,
  SceneCamera,
  SceneManifest,
} from '@bendyline/molen-schema';
import type { Intersection, Object3D } from 'three';
import { AssetCache, type AssetProvider, createUrlAssetProvider } from './assets';
import { type ClientError, createClientCore, localCommand, type Unsubscribe } from './client-core';
import { InputMap, type InputMapOptions } from './input';
import { applyInputRules, applySceneCamera } from './scene-bindings';
import { SceneMirror } from './sync';
import {
  type SceneOptimizationOptions,
  ThreeSceneBackend,
  validateSceneOptimizationOptions,
} from './three/backend';
import type { RenderableKind } from './three/kinds';
import { createGltfLoader, type DecoderConfig } from './three/loaders';
import { MaterialResolver } from './three/materials';
import { type CameraPose, Renderer, type RendererOptions } from './three/renderer';

export { localCommand };

export interface AssetOptions {
  /** Base URL asset refs resolve against (default: the page origin). */
  baseUrl?: string;
  /** Asset id -> served URL index (from the project manifest); ids without an entry use the assets/<id>/model.glb convention. */
  index?: Record<string, string>;
  /**
   * Packed runtime variant to prefer for convention-resolved ids (e.g. "ktx2"); pair it with
   * `decoders.ktx2TranscoderPath`. Falls back to model.glb per asset when the variant is missing.
   */
  variant?: string;
  /** Bring-your-own provider (overrides baseUrl/index). */
  provider?: AssetProvider;
}

export interface ClientOptions extends RendererOptions {
  sceneOptimization?: SceneOptimizationOptions;
  /** Optional caller-owned worker pool for procedural textures. */
  materialBaker?: MaterialBaker;
  frameLoop?: 'auto' | 'manual';
  /** Declarative camera; follow targets use the same interpolation as rendered entities. */
  sceneCamera?: SceneCamera;
  interpolationDelayTicks?: number;
  /** Enable gltf renderables: where asset refs load from. */
  assets?: AssetOptions;
  /** Optional Draco/KTX2 decoder hosting (canonical imported assets need neither). */
  decoders?: DecoderConfig;
  /** Custom renderable kinds from capability client halves (e.g. figures). */
  kinds?: RenderableKind[];
  /**
   * Cancels a mount in flight (`createClient`, `createSnapshotViewer`, `createViewer`,
   * `mountExperience`): if it aborts while the GPU is initializing the
   * factory rejects with an `AbortError` and nothing is left running. A host that unmounts mid-mount
   * (React StrictMode's double-invoked effect) otherwise leaks a live client on the same canvas.
   * Every factory is asynchronous, so every mount can be cancelled.
   */
  signal?: AbortSignal;
}

export interface MolenClient {
  readonly renderer: Renderer;
  /**
   * The three.js scene backend driving this client (escape hatch: `getObject`, `threeScene`,
   * `registerKind`). Unstable, like everything else you reach through it.
   */
  readonly backend: ThreeSceneBackend;
  /** The latest kernel tick applied (undefined before the first keyframe). */
  readonly tick: number | undefined;
  /** Override the declarative camera, disabling automatic follow tracking. */
  setCamera(pose: CameraPose): void;
  sendCommand(command: Command): void;
  /**
   * Send a command by type + payload; the client fills the envelope (`seq` auto-increments,
   * `source: 'local'`, `tick: 0` — the kernel rewrites late ticks to the next tick).
   */
  command(type: string, payload?: Command['payload']): void;
  /**
   * Drive the kernel's scheduler: `{action: 'resume'}` after a `startPaused` host, `'pause'`,
   * `'step'` a fixed number of ticks, `'set-rate'`, or `'request-keyframe'`. A page that boots
   * its worker paused and resumes on `ready()` never simulates behind its own loading screen,
   * and a test that steps instead of waiting is independent of wall-clock speed.
   * No-op on a snapshot viewer, which has no kernel.
   */
  control(action: ControlAction): void;
  /**
   * Subscribe to kernel events by type, or `'*'` for all (gameplay feedback: hits, pickups,
   * win/lose, `command-rejected`). Handlers get the event and the tick it happened on.
   */
  onEvent(type: string, cb: (event: EngineEvent, tick: number) => void): Unsubscribe;
  /** Subscribe to kernel diagnostics (tick overruns, rejected commands, protocol errors). */
  onDiag(cb: (diag: DiagMessage) => void): Unsubscribe;
  /**
   * Subscribe to client-side failures the kernel cannot report: the link died (`source: 'link'` —
   * the Worker threw, failed to load, or sent an undeserializable message) or a render frame threw
   * (`source: 'frame'`). Each also arrives on `onDiag` as `link-error` / `frame-error`.
   */
  onError(cb: (error: ClientError) => void): Unsubscribe;
  /** Read a component of a mirrored entity — a HUD's data source (a detached copy). */
  get(id: EntityId, component: string): JsonObject | undefined;
  /** Every mirrored entity id. */
  entities(): EntityId[];
  renderFrame(nowMs?: number): void;
  /** Resolves when all pending asset loads have settled (capture/testing barrier). */
  ready(): Promise<void>;
  /** Number of bound scene objects (for stats/tests). */
  objectCount(): number;
  /** Resolve a Three ray hit to its entity, including static instanced meshes. */
  entityForIntersection(hit: Intersection): EntityId | undefined;
  /**
   * Escape hatch: the raw three.js object for an entity (undefined when it has none yet). Taking it
   * un-batches the entity from any static batch and marks it escaped, so edits you make stay
   * visible — `renderer.worldRoot.getObjectByName(id)` skips that and hands back a hidden original.
   */
  getObject(id: EntityId): Object3D | undefined;
  dispose(): void;
}

function buildAssetStack(
  renderer: Renderer,
  opts: ClientOptions,
): { cache: AssetCache | undefined; materials: MaterialResolver } {
  if (opts.assets === undefined) return { cache: undefined, materials: new MaterialResolver() };
  const provider =
    opts.assets.provider ??
    createUrlAssetProvider(
      opts.assets.baseUrl ??
        (typeof location !== 'undefined' ? location.href : 'http://localhost/'),
      opts.assets.index,
      { ...(opts.assets.variant !== undefined ? { variant: opts.assets.variant } : {}) },
    );
  return {
    cache: new AssetCache(provider, createGltfLoader(renderer.three, opts.decoders ?? {})),
    materials: new MaterialResolver(provider, opts.materialBaker),
  };
}

const NO_UNSUB: Unsubscribe = () => {};

/** Consecutive throwing frames before the automatic loop gives up (and says so on `onError`). */
const MAX_CONSECUTIVE_FRAME_FAILURES = 5;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Create a client bound to a kernel message link (Worker/MessagePort). The renderer-free core
 * (`createClientCore`) applies keyframes/deltas into a scene mirror + interpolation buffer and
 * dispatches events; this wraps it with the three.js backend and a frame loop.
 *
 * Asynchronous because selecting a graphics backend is: `backend` defaults to `'auto'`, which
 * probes WebGPU and falls back to WebGL. Pass `backend: 'webgl'` to skip the probe — capture and
 * golden paths do, because a pinned backend is what makes a frame byte-stable.
 */
export async function createClient(
  link: MessageLink,
  opts: ClientOptions = {},
): Promise<MolenClient> {
  throwIfAborted(opts.signal);
  const renderer = await Renderer.create(opts);
  let client: MolenClient | undefined;
  try {
    // Unmounted while the GPU initialized: nothing is wired yet, so leave nothing behind.
    throwIfAborted(opts.signal);
    client = createClientWithRenderer(link, opts, renderer);
    throwIfAborted(opts.signal);
    return client;
  } catch (error) {
    if (client !== undefined) client.dispose();
    else renderer.dispose();
    throw error;
  }
}

/** Reject an aborted mount the standard way (`AbortError`), before anything is wired. */
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal === undefined || !signal.aborted) return;
  if (typeof signal.throwIfAborted === 'function') signal.throwIfAborted();
  throw new DOMException('The client mount was aborted', 'AbortError');
}

function createClientWithRenderer(
  link: MessageLink,
  opts: ClientOptions,
  renderer: Renderer,
): MolenClient {
  validateSceneOptimizationOptions(opts.sceneOptimization);
  const { cache: assets, materials } = buildAssetStack(renderer, opts);
  const backend = new ThreeSceneBackend(
    renderer.worldRoot,
    assets,
    renderer,
    materials,
    opts.sceneOptimization,
  );
  for (const kind of opts.kinds ?? []) backend.registerKind(kind);
  let disposeCore: Unsubscribe | undefined;
  let raf: number | undefined;
  try {
    const core = createClientCore({
      link,
      backend,
      ...(opts.interpolationDelayTicks !== undefined
        ? { interpolationDelayTicks: opts.interpolationDelayTicks }
        : {}),
    });
    disposeCore = core.dispose;
    backend.bindMirror(core.mirror);

    let sceneCamera = opts.sceneCamera;
    if (sceneCamera !== undefined) applySceneCamera(sceneCamera, renderer);
    const nowMs = (): number =>
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    function renderFrame(at?: number): void {
      const t = at ?? nowMs();
      core.sampleTransforms(t, (id, transform) => {
        backend.setTransform(id, transform);
        if (sceneCamera?.mode === 'follow' && id === sceneCamera.entity) {
          applySceneCamera(sceneCamera, renderer, transform);
        }
      });
      const buffer = core.buffer;
      const tick = buffer?.estimateRenderTick(t);
      if (buffer !== undefined && tick !== undefined && buffer.latestTick !== undefined) {
        backend.updateLiveAnimations(
          Math.max(0, Math.min(tick, buffer.latestTick)),
          buffer.tickRate,
          renderer.camera,
        );
      }
      backend.prepareFrame();
      renderer.render();
    }

    let disposed = false;
    if (opts.frameLoop !== 'manual') {
      let consecutiveFailures = 0;
      const loop = (): void => {
        raf = undefined;
        // A frame that was already in flight when dispose() ran has nothing to draw into.
        if (disposed) return;
        let stop = false;
        try {
          renderFrame();
          consecutiveFailures = 0;
        } catch (error) {
          consecutiveFailures++;
          // Device loss is terminal (every later frame would throw the same way); a run of other
          // failures is stopped so a broken frame cannot spin an error storm at 60Hz.
          stop =
            renderer.deviceLost !== undefined ||
            consecutiveFailures >= MAX_CONSECUTIVE_FRAME_FAILURES;
          core.reportError({
            source: 'frame',
            message: stop
              ? `frame loop stopped after ${consecutiveFailures} failed frame(s): ${describeError(error)}`
              : `render frame failed: ${describeError(error)}`,
            cause: error,
          });
        } finally {
          // One bad frame must not kill the loop: schedule the next frame even after a throw,
          // or the page silently freezes on its last pose with nothing reported.
          if (!stop && !disposed && renderer.deviceLost === undefined) {
            raf = requestAnimationFrame(loop);
          }
        }
      };
      raf = requestAnimationFrame(loop);
    }

    // The host posts its boot keyframe from its own constructor, and a dedicated Worker drops
    // `message` events dispatched before a listener exists — any macrotask between `new Worker()`
    // and the mount loses it, and every delta is then dropped until the next periodic keyframe.
    // Asking for one is idempotent on the host, so both factories ask, always.
    link.postMessage({ type: 'control', control: { action: 'request-keyframe' } });

    return {
      renderer,
      backend,
      get tick() {
        return core.tick;
      },
      setCamera: (pose) => {
        sceneCamera = undefined;
        renderer.setCamera(pose);
      },
      sendCommand: core.sendCommand,
      command: core.command,
      control: core.control,
      onEvent: core.onEvent,
      onDiag: core.onDiag,
      onError: core.onError,
      get: core.get,
      entities: core.entities,
      renderFrame,
      ready: async () => {
        await assets?.whenIdle();
        await backend.whenReady();
      },
      objectCount: () => backend.count(),
      entityForIntersection: (hit) => backend.entityForIntersection(hit),
      getObject: (id) => backend.getObject(id),
      dispose: () => {
        if (disposed) return;
        disposed = true;
        if (raf !== undefined) cancelAnimationFrame(raf);
        core.dispose();
        backend.dispose();
        assets?.dispose();
        renderer.dispose();
      },
    };
  } catch (error) {
    if (raf !== undefined) cancelAnimationFrame(raf);
    disposeCore?.();
    backend.dispose();
    assets?.dispose();
    renderer.dispose();
    throw error;
  }
}

/**
 * Boot a client directly from a serialized keyframe with no live kernel — the capture page
 * and replay viewer use this (docs-src/guide/three-surface.md). With gltf renderables, await
 * `ready()` before the deterministic frame; clip poses derive from the keyframe tick.
 *
 * Like `createClient`, `backend` defaults to `'auto'`; pin `'webgl'` for a byte-stable frame.
 */
export async function createSnapshotViewer(
  keyframe: Keyframe,
  opts: ClientOptions = {},
): Promise<MolenClient> {
  throwIfAborted(opts.signal);
  const renderer = await Renderer.create(opts);
  let viewer: MolenClient | undefined;
  try {
    throwIfAborted(opts.signal);
    viewer = createSnapshotViewerWithRenderer(keyframe, opts, renderer);
    throwIfAborted(opts.signal);
    return viewer;
  } catch (error) {
    if (viewer !== undefined) viewer.dispose();
    else renderer.dispose();
    throw error;
  }
}

function createSnapshotViewerWithRenderer(
  keyframe: Keyframe,
  opts: ClientOptions,
  renderer: Renderer,
): MolenClient {
  validateSceneOptimizationOptions(opts.sceneOptimization);
  const { cache: assets, materials } = buildAssetStack(renderer, opts);
  const backend = new ThreeSceneBackend(
    renderer.worldRoot,
    assets,
    renderer,
    materials,
    opts.sceneOptimization,
  );
  try {
    for (const kind of opts.kinds ?? []) backend.registerKind(kind);
    const mirror = new SceneMirror();
    backend.bindMirror(mirror);
    mirror.applyKeyframe(keyframe);
    mirror.reconcile(backend);

    // Place each object at its exact (non-interpolated) transform.
    const transforms = mirror.transforms();
    if (opts.sceneCamera !== undefined)
      applySceneCamera(
        opts.sceneCamera,
        renderer,
        opts.sceneCamera.mode === 'follow' ? transforms.get(opts.sceneCamera.entity) : undefined,
      );
    for (const [id, t] of transforms) {
      backend.setTransform(id as EntityId, t);
    }

    let disposed = false;
    return {
      renderer,
      backend,
      get tick() {
        return mirror.tick;
      },
      setCamera: (pose) => renderer.setCamera(pose),
      sendCommand: () => {},
      command: () => {},
      control: () => {},
      onEvent: () => NO_UNSUB,
      onDiag: () => NO_UNSUB,
      onError: () => NO_UNSUB,
      get: (id, component) => mirror.get(id, component),
      entities: () => mirror.entities(),
      renderFrame: () => {
        backend.setAnimationTick(keyframe.tick, keyframe.tickRate);
        backend.prepareFrame();
        renderer.render();
      },
      ready: async () => {
        await assets?.whenIdle();
        await backend.whenReady();
      },
      objectCount: () => backend.count(),
      entityForIntersection: (hit) => backend.entityForIntersection(hit),
      getObject: (id) => backend.getObject(id),
      dispose: () => {
        if (disposed) return;
        disposed = true;
        backend.dispose();
        assets?.dispose();
        renderer.dispose();
      },
    };
  } catch (error) {
    backend.dispose();
    assets?.dispose();
    renderer.dispose();
    throw error;
  }
}

/**
 * Create a viewer with no kernel and no snapshot — just a renderer + camera over an empty
 * scene. For client-side capabilities (terrain, custom three.js objects via `renderer.scene`).
 */
export function createViewer(opts: ClientOptions = {}): Promise<MolenClient> {
  return createSnapshotViewer(emptyKeyframe(), opts);
}

function emptyKeyframe(): Keyframe {
  return {
    kind: 'keyframe',
    v: 1,
    engine: '',
    tick: 0,
    tickRate: 30,
    seed: '',
    nextEntitySeq: 0,
    rng: { algo: 'sfc32', state: [0, 0, 0, 0] },
    entities: {},
    plugins: {},
  };
}

export interface MountExperienceOptions extends ClientOptions {
  /** The kernel link (a Worker running KernelHost, or a MessagePort). Built by the host. */
  link: MessageLink;
  /** The validated scene manifest; its `camera` and `input` blocks are applied. */
  scene: SceneManifest;
  canvas: HTMLCanvasElement;
  /** Where key/mouse events come from (default: window). */
  inputTarget?: InputMapOptions['target'];
  /** Controller/numeric input poll interval in ms (default 50). */
  pollMs?: number;
  /** Follow the canvas's client size on window resize (default true when `window` exists). */
  autoResize?: boolean;
}

export interface MountedExperience {
  client: MolenClient;
  /** The InputMap driving the scene's emit rules (undefined when the scene has no input block). */
  input: InputMap | undefined;
  dispose(): void;
}

/**
 * The one-call browser mount: create the client on the link, apply the scene's `camera`, wire
 * its `input` bindings + emit rules to `client.command`, and keep the renderer sized to the
 * canvas. The kernel side is the host's `KernelHost` in a Worker built with `buildWorld` (which
 * installs the same scene's scripts). Returns the client plus a disposer.
 *
 * This is the one entry point a page needs. It is asynchronous because `backend` defaults to
 * `'auto'`, which probes WebGPU and falls back to WebGL; pass `backend: 'webgl'` to skip the probe.
 */
export async function mountExperience(opts: MountExperienceOptions): Promise<MountedExperience> {
  const client = await createClient(opts.link, mountClientOptions(opts));
  // Aborted between the factory's last check and here: the caller is gone, so leave nothing live.
  if (opts.signal?.aborted === true) {
    client.dispose();
    throwIfAborted(opts.signal);
  }
  return mountClient(opts, client);
}

/** The device pixel ratio a live page renders at, capped so a 3x phone does not cost 9x the fill. */
function livePixelRatio(): number {
  const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr, 2);
}

function mountClientOptions(opts: MountExperienceOptions): ClientOptions {
  const {
    link: _link,
    scene,
    canvas,
    inputTarget: _target,
    pollMs: _poll,
    autoResize: _resize,
    ...clientOpts
  } = opts;
  // clientWidth is 0 (never undefined) for a display:none or not-yet-inserted canvas, so `??`
  // would hand the renderer a zero size and a NaN aspect. `||` is the intended fallback.
  const width = clientOpts.width ?? (canvas.clientWidth || 1280);
  const height = clientOpts.height ?? (canvas.clientHeight || 720);
  return {
    // Live defaults, not capture defaults: a game page renders at the display's pixel ratio with
    // antialiasing and no preserved drawing buffer. `createSnapshotViewer` keeps the deterministic
    // capture settings (ratio 1, no AA, preserved buffer) that `molen shot` relies on.
    pixelRatio: livePixelRatio(),
    antialias: true,
    preserveDrawingBuffer: false,
    ...clientOpts,
    sceneCamera: scene.camera,
    canvas,
    width,
    height,
  };
}

function mountClient(opts: MountExperienceOptions, client: MolenClient): MountedExperience {
  const { scene, canvas, inputTarget, pollMs, autoResize } = opts;
  const disposers: Unsubscribe[] = [];
  try {
    if (scene.camera !== undefined) applySceneCamera(scene.camera, client.renderer);

    let input: InputMap | undefined;
    if (scene.input !== undefined) {
      const target = inputTarget ?? (typeof window !== 'undefined' ? window : undefined);
      input = new InputMap({ ...scene.input, ...(target ? { target } : {}) });
      const map = input;
      disposers.push(() => map.dispose());
      if (typeof document !== 'undefined') {
        let resume: Unsubscribe | undefined;
        const visibility = (): void => {
          if (document.hidden) resume ??= map.suspend();
          else {
            resume?.();
            resume = undefined;
          }
        };
        document.addEventListener('visibilitychange', visibility);
        visibility();
        disposers.push(() => {
          document.removeEventListener('visibilitychange', visibility);
          resume?.();
        });
      }
      disposers.push(
        applyInputRules(
          scene.input,
          map,
          (type, payload) => client.command(type, payload),
          pollMs !== undefined ? { pollMs } : undefined,
        ),
      );
    }

    const wantResize = autoResize ?? typeof window !== 'undefined';
    if (wantResize) {
      const onResize = (): void => {
        const width = canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 0);
        const height =
          canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 0);
        // A canvas with no layout yet (hidden tab, not inserted) reports 0: keep the mount-time
        // size rather than collapsing the drawing buffer to a pixel.
        if (width <= 0 || height <= 0) return;
        // An explicit render scale stays fixed across resizes. Otherwise, follow the display's
        // device pixel ratio when a window moves between screens.
        if (opts.pixelRatio === undefined) client.renderer.setPixelRatio(livePixelRatio());
        // Renderer.setSize refits ortho framing itself; perspective just updates aspect.
        client.renderer.setSize(width, height);
      };
      // A container that changes size without a window resize (sidebar toggle, split pane, CSS
      // reflow) never fires `resize`, and the canvas keeps a stale buffer size and aspect.
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => onResize());
        observer.observe(canvas);
        disposers.push(() => observer.disconnect());
      } else if (typeof window !== 'undefined') {
        window.addEventListener('resize', onResize);
        disposers.push(() => window.removeEventListener('resize', onResize));
      }
    }

    return {
      client,
      input,
      dispose: () => {
        for (const off of disposers) off();
        client.dispose();
      },
    };
  } catch (error) {
    for (const off of disposers) off();
    client.dispose();
    throw error;
  }
}
