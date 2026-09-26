// mountEarthView: one call that turns a canvas into an explorable real-world 3D view. It composes
// the viewer, the streamed terrain pyramid (in a metric frame at the viewed latitude), semantic
// layers with worldgen buildings, street surfaces and parked cars, orbit/walk/drive navigation,
// world markers, sky and haze, and adaptive quality — and owns its frame loop, events and full
// teardown. Hosts speak latitude/longitude; world meters stay inside.

import {
  AdaptiveQualityController,
  applyEnvironment,
  createViewer,
  type EnvironmentData,
  type MolenClient,
  type RendererBackendPreference,
} from '@bendyline/molen-client';
import {
  createMarkerLayer,
  type MarkerLayer,
  type MarkerScreenPosition,
  type MarkerSpec,
} from '@bendyline/molen-client/markers';
import {
  applyCameraLookDelta,
  cameraForward,
  createTouchJoystick,
  type NavigationInput,
  NavigationInputSource,
  type NavigationKeyTarget,
  type NavigationPose,
  OrbitController,
  type TouchJoystick,
  viewNeedsImmediateUpdate,
  WALK_EYE_HEIGHT,
  WalkCollision,
  WalkController,
} from '@bendyline/molen-client/navigation';
import {
  createProfiledTerrainPackageSemanticLayers,
  createTerrainPackagePyramidStream,
  createTerrainSurfaceRenderer,
  createTerrainSurfaceWorkerBridge,
  createTerrainWaterMaterialAsync,
  setTerrainWaterTime,
  type TerrainPyramidStream,
  type TerrainPyramidTileLayer,
  type TerrainQualityPreset,
  type TerrainSurfaceRenderer,
  type TerrainTileArchive,
  type TerrainWaterMaterial,
  terrainPyramidBudgetForQuality,
} from '@bendyline/molen-terrain/client';
import {
  type TerrainPackageDescriptor,
  terrainPackageMetersPerUnit,
  wgs84ToWorld,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import type { ScreenSpaceLodPolicy } from '@bendyline/molen-worldgen/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createEarthFog, createEarthSky, type EarthSkyStyle, updateEarthFog } from './atmosphere';
import { type EarthCredit, earthCredits } from './attribution';
import type { EarthContent } from './content';
import { earthPerformanceTier, earthPixelRatio, earthQualityLevel } from './performance';
import { EarthVehicles } from './vehicles';
import { createEarthWorldgen, type EarthViewWorkers, type EarthWorldgen } from './worldgen';

export type EarthViewMode = 'orbit' | 'walk' | 'drive';

/** Where to look, in geographic terms. Angles are radians. */
export interface EarthCameraTarget {
  latitude: number;
  longitude: number;
  /** Distance from the camera to the ground point, meters (orbit mode; default 3000). */
  range?: number;
  /** Compass bearing of the view: 0 north, PI/2 east (default 0). */
  heading?: number;
  /** Tilt below the horizon: small is oblique, PI/2 straight down (default 0.6). */
  pitch?: number;
}

/** The camera as a host sees it. Angles are radians. */
export interface EarthCameraState {
  mode: EarthViewMode;
  /** The ground point at the center of the view (the orbit target, or the walker's feet). */
  latitude: number;
  longitude: number;
  /** Camera height above sea level in meters. */
  altitude: number;
  /** Camera distance to the ground point in meters. */
  range: number;
  heading: number;
  pitch: number;
}

/** A marker placed by latitude/longitude instead of world meters. */
export interface EarthMarker extends Omit<MarkerSpec, 'x' | 'z'> {
  latitude: number;
  longitude: number;
}

export interface EarthViewStyle {
  /** Clear color behind the sky (default a pale blue-grey). */
  background?: string;
  /** Haze color (default the sky's horizon). */
  fog?: string;
  /** Physical sky parameters, or false for a flat background. */
  sky?: EarthSkyStyle | false;
  /** Light and tone-mapping overrides merged over the defaults. */
  environment?: Partial<EnvironmentData>;
  /** Water color (default a muted teal). */
  water?: string;
}

export interface EarthViewOptions {
  canvas: HTMLCanvasElement;
  /** A `molen/terrain-package@1` manifest. */
  terrain: TerrainPackageDescriptor;
  /** URL of the manifest (resolves package-relative archives). */
  baseUrl?: string | URL;
  /** Host transports for the package's archives, e.g. archive sets with offline packs. */
  archives?: {
    elevation?: TerrainTileArchive;
    landcover?: TerrainTileArchive;
    features?: TerrainTileArchive;
  };
  /** Content packs; without them buildings are plain extrusions and there are no cars. */
  content?: EarthContent;
  /** The first view. */
  camera: EarthCameraTarget;
  /** `'auto'` adapts to measured frame times (default). */
  quality?: 'auto' | TerrainQualityPreset;
  /** Worker factories; each piece of work runs in-thread without its worker. */
  workers?: EarthViewWorkers;
  style?: EarthViewStyle;
  /** Keyboard target (default the canvas, which should have `tabindex="0"`). */
  keyTarget?: NavigationKeyTarget;
  /** Container for an on-screen movement stick, shown while walking or driving. */
  touchJoystickContainer?: HTMLElement;
  /** When the stick shows: on touch devices (`'auto'`, the default) or on every device. */
  touchJoystick?: 'auto' | 'always';
  /** Graphics backend (default `'webgl'`, which skips the WebGPU probe). */
  backend?: RendererBackendPreference;
  /** Highest device pixel ratio rendered (default 2). */
  maxPixelRatio?: number;
  /** Cancels the mount while it is still starting. */
  signal?: AbortSignal;
  /** Tile, layer and content failures (the view keeps running on what loaded). */
  onError?: (error: unknown, context: string) => void;
}

export interface EarthViewEvents {
  camerachange: EarthCameraState;
  markerclick: { id: string };
  modechange: { mode: EarthViewMode };
  /** A short explanation for the user, e.g. why a vehicle could not be entered. */
  message: { text: string };
}

export interface EarthViewStats {
  mode: EarthViewMode;
  frames: number;
  /** Adaptive performance level (0-5). */
  qualityLevel: number;
  displayedTiles: number;
  loadingTiles: number;
  failedTiles: number;
  maxDisplayedLevel: number | undefined;
  markers: number;
  drawCalls: number;
  triangles: number;
  frameLatitude: number;
}

export interface EarthView {
  readonly viewer: MolenClient;
  readonly input: NavigationInputSource;
  /** Required data credits; keep them visible whenever the view is. */
  readonly credits: EarthCredit[];
  readonly mode: EarthViewMode;
  /** Switch navigation. Drive needs a parked car within reach; returns false when unavailable. */
  setMode(mode: EarthViewMode): boolean;
  /** Animate to a view (orbit mode). Long hops re-anchor the metric frame on arrival. */
  flyTo(target: EarthCameraTarget, options?: { durationMs?: number }): void;
  /** Move immediately (orbit mode). */
  jumpTo(target: EarthCameraTarget): void;
  getCamera(): EarthCameraState;
  setMarkers(markers: readonly EarthMarker[]): void;
  /** Where a marker's pin point is on screen, for DOM callouts. */
  markerScreenPosition(id: string): MarkerScreenPosition | undefined;
  on<K extends keyof EarthViewEvents>(
    event: K,
    handler: (payload: EarthViewEvents[K]) => void,
  ): () => void;
  /** Resolves when the terrain for the current view has streamed in. */
  whenIdle(): Promise<void>;
  stats(): EarthViewStats;
  /** Stop rendering (e.g. while hidden); input and streaming pause with it. */
  setPaused(paused: boolean): void;
  dispose(): void;
}

const VERTICAL_FOV = THREE.MathUtils.degToRad(60);
/** Re-anchor the metric frame once the view is this far (degrees latitude) from it. */
const REANCHOR_DEGREES = 1;
const DEFAULT_ENVIRONMENT: EnvironmentData = {
  ambient: { sky: '#d7eaf2', ground: '#283b32', intensity: 0.48 },
  sun: { direction: [-6, 10, 4], color: '#fff0ce', intensity: 2.05 },
  background: '#8fbed3',
  toneMapping: 'agx',
  exposure: 0.9,
};

interface EarthStack {
  frameLatitude: number;
  metersPerUnit: number;
  stream: TerrainPyramidStream;
  surface: TerrainSurfaceRenderer;
  worldgen: EarthWorldgen | undefined;
  vehicles: EarthVehicles | undefined;
  viewDistance: number;
  dispose(): void;
}

type Listeners = { [K in keyof EarthViewEvents]: Set<(payload: EarthViewEvents[K]) => void> };

function surfaceBudgets(quality: TerrainQualityPreset, scale: number) {
  const fixtures = quality === 'high' ? 300 : quality === 'balanced' ? 160 : 60;
  const detail = quality === 'high' ? 28_000 : quality === 'balanced' ? 16_000 : 6_000;
  return {
    maxFixturesPerTile: Math.round(fixtures * scale),
    maxDetailElements: Math.round(detail * scale),
  };
}

/** Mount an Earth view into a canvas. Dispose it (or abort `signal`) to release everything. */
export async function mountEarthView(options: EarthViewOptions): Promise<EarthView> {
  const { canvas, terrain: pkg, content, signal } = options;
  const report =
    options.onError ?? ((error, context) => console.warn(`[molen-earth] ${context}`, error));
  const automatic = (options.quality ?? 'auto') === 'auto';
  let level = automatic ? 3 : earthQualityLevel(options.quality as TerrainQualityPreset);
  let tier = earthPerformanceTier(level);
  const quality = (): TerrainQualityPreset =>
    automatic ? tier.quality : (options.quality as TerrainQualityPreset);
  const maxPixelRatio = options.maxPixelRatio ?? 2;
  const viewport = (): [number, number] => [
    Math.max(1, canvas.clientWidth),
    Math.max(1, canvas.clientHeight),
  ];

  // Keyboard navigation needs a focusable canvas, and touch gestures must not scroll the page.
  if (canvas.tabIndex < 0) canvas.tabIndex = 0;
  if (canvas.style.touchAction === '') canvas.style.touchAction = 'none';
  const [width, height] = viewport();
  const viewer = await createViewer({
    canvas,
    width,
    height,
    backend: options.backend ?? 'webgl',
    antialias: true,
    preserveDrawingBuffer: false,
    pixelRatio: Math.min(window.devicePixelRatio || 1, maxPixelRatio),
    powerPreference: 'high-performance',
    clearColor: options.style?.background ?? '#9fc4df',
    cameraNear: 1,
    cameraFar: 500_000,
    reverseDepthBuffer: true,
    releaseContextOnDispose: true,
    autoWorldOrigin: { threshold: 1_000, gridSize: 250 },
    ...(signal !== undefined ? { signal } : {}),
  });
  const renderer = viewer.renderer;
  const disposers: Array<() => void> = [() => viewer.dispose()];
  let disposed = false;
  const disposeAll = (): void => {
    disposed = true;
    while (disposers.length > 0) {
      try {
        disposers.pop()?.();
      } catch (error) {
        report(error, 'dispose');
      }
    }
  };

  try {
    applyEnvironment(renderer, { ...DEFAULT_ENVIRONMENT, ...options.style?.environment });
    const fog = createEarthFog(renderer.backend, options.style?.fog);
    renderer.scene.fog = fog;
    if (options.style?.sky !== false) {
      const sky = await createEarthSky(renderer.backend, options.style?.sky || {});
      renderer.scene.add(sky);
      disposers.push(() => {
        sky.removeFromParent();
        sky.geometry.dispose();
        sky.material.dispose();
      });
    }
    const water: TerrainWaterMaterial = await createTerrainWaterMaterialAsync(
      {
        color: options.style?.water ?? '#3f7d8f',
        waveScale: 0.028,
        waveStrength: 0.045,
        waveSpeed: 0.5,
      },
      renderer.backend,
    );
    disposers.push(() => water.dispose());
    void content?.stars().then(
      (stars) => {
        if (!disposed) renderer.setStarCatalog(stars);
      },
      (error: unknown) => report(error, 'star catalog'),
    );

    const input = new NavigationInputSource({
      element: canvas,
      ...(options.keyTarget !== undefined ? { keyTarget: options.keyTarget } : {}),
      profile: 'orbit',
    });
    disposers.push(() => input.dispose());
    let joystick: TouchJoystick | undefined;
    const touchDevice =
      typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches;
    if (
      options.touchJoystickContainer !== undefined &&
      (options.touchJoystick === 'always' || touchDevice)
    ) {
      joystick = createTouchJoystick(options.touchJoystickContainer, input.map);
      joystick.setVisible(false);
      disposers.push(() => joystick?.dispose());
    }

    const lodPolicy: ScreenSpaceLodPolicy = {
      viewportHeight: height,
      maxPixelError: tier.objectPixelError,
    };
    const loadModel = async (id: string): Promise<THREE.Object3D> => {
      if (content === undefined) throw new Error('no content packs');
      return (await new GLTFLoader().parseAsync(await content.packs.readBytes(id), '')).scene;
    };

    let stack: EarthStack | undefined;
    const groundHeight = (x: number, z: number): number | undefined =>
      stack?.stream.sampleHeight(x, z);
    const environment = { groundHeight };

    const createStack = async (
      frameLatitude: number,
      view: NavigationPose,
    ): Promise<EarthStack> => {
      const frame = { latitude: frameLatitude };
      const metersPerUnit = terrainPackageMetersPerUnit(pkg, frame);
      const parts: Array<() => void> = [];
      const cleanup = (): void => {
        while (parts.length > 0) {
          try {
            parts.pop()?.();
          } catch (error) {
            report(error, 'dispose');
          }
        }
      };
      try {
        const surfaceWorker =
          options.workers?.surface !== undefined
            ? createTerrainSurfaceWorkerBridge(options.workers.surface())
            : undefined;
        const surface = createTerrainSurfaceRenderer(
          {
            style: 'modern',
            details: {
              preferMappedProps: content?.worldgen !== undefined,
              parkedVehicles: content?.parkedVehicles ?? [],
              ...surfaceBudgets(quality(), automatic ? tier.surfaceScale : 1),
            },
          },
          surfaceWorker,
        );
        parts.push(() => surface.dispose());
        const worldgen =
          content?.worldgen !== undefined
            ? createEarthWorldgen({
                content: content.worldgen,
                assets: content.assets,
                surfaceRenderer: surface,
                metersPerUnit,
                quality: quality(),
                lodPolicy,
                ...(options.workers !== undefined ? { workers: options.workers } : {}),
                prepareObject: (object, prepareSignal) =>
                  renderer.prepareObject(object, prepareSignal),
                onMaterialFailures: (failures) =>
                  report(new Error([...failures.keys()].join(', ')), 'worldgen materials'),
              })
            : undefined;
        if (worldgen !== undefined) parts.push(() => worldgen.dispose());
        let layers: TerrainPyramidTileLayer[] = [];
        if (pkg.landcover !== undefined || pkg.features !== undefined) {
          try {
            const semantic = await createProfiledTerrainPackageSemanticLayers(pkg, {
              ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
              ...(options.archives?.landcover !== undefined
                ? { landcoverArchive: options.archives.landcover }
                : {}),
              ...(options.archives?.features !== undefined
                ? { featuresArchive: options.archives.features }
                : {}),
              waterLayer: { visible: true, mesh: { materials: { water }, waterOffset: 0.65 } },
              landcoverLayer:
                worldgen !== undefined
                  ? { visible: true, renderer: worldgen.classification }
                  : { visible: true },
              featuresLayer:
                worldgen !== undefined
                  ? { visible: true, renderer: worldgen.humanFeatures }
                  : { visible: true, mesh: { surfaceRenderer: surface } },
            });
            layers = semantic.layers;
          } catch (error) {
            // Bare terrain still renders; semantic sidecars are optional by contract.
            report(error, 'semantic layers');
          }
        }
        const elevationWorker = options.workers?.elevation?.();
        if (elevationWorker !== undefined) parts.push(() => elevationWorker.terminate());
        const budget = automatic ? tier.terrain : terrainPyramidBudgetForQuality(quality());
        const [viewWidth, viewHeight] = viewport();
        const opened = await createTerrainPackagePyramidStream(pkg, {
          ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
          ...(options.archives?.elevation !== undefined
            ? { archive: options.archives.elevation }
            : {}),
          frame,
          ...budget,
          ...(elevationWorker !== undefined ? { elevationWorker } : {}),
          admission: renderer.admission,
          prepareObject: (object, prepareSignal) => renderer.prepareObject(object, prepareSignal),
          createTileGroup: () => renderer.createRenderGroup(),
          morphMilliseconds: 180,
          layers,
          initialView: {
            position: view.position,
            verticalFov: VERTICAL_FOV,
            viewportHeight: viewHeight,
            direction: view.direction,
            aspect: viewWidth / viewHeight,
          },
          onError: (error, context) => report(error, `${context.layerId ?? 'elevation'} tile`),
        });
        const stream = opened.stream;
        parts.push(() => {
          stream.object.removeFromParent();
          stream.dispose();
        });
        renderer.worldRoot.add(stream.object);
        const vehicles =
          content?.types !== undefined
            ? new EarthVehicles({
                root: stream.object,
                sampleHeight: (x, z) => stream.sampleHeight(x, z),
                loadModel,
                types: content.types,
              })
            : undefined;
        if (vehicles !== undefined) parts.push(() => vehicles.dispose());
        return {
          frameLatitude,
          metersPerUnit,
          stream,
          surface,
          worldgen,
          vehicles,
          viewDistance: budget.viewDistance,
          dispose: cleanup,
        };
      } catch (error) {
        cleanup();
        throw error;
      }
    };

    // Initial frame, camera and stack.
    let frameLatitude = options.camera.latitude;
    let metersPerUnit = terrainPackageMetersPerUnit(pkg, { latitude: frameLatitude });
    const toWorld = (latitude: number, longitude: number): [number, number] =>
      wgs84ToWorld(metersPerUnit, longitude, latitude);
    const toLatLon = (x: number, z: number): { latitude: number; longitude: number } => {
      const [longitude, latitude] = worldToWgs84(metersPerUnit, x, z);
      return { latitude, longitude };
    };
    const orbitTarget = (target: EarthCameraTarget) => {
      const [x, z] = toWorld(target.latitude, target.longitude);
      return {
        target: [x, groundHeight(x, z) ?? 0, z] as [number, number, number],
        ...(target.range !== undefined ? { range: target.range } : {}),
        ...(target.heading !== undefined ? { heading: target.heading } : {}),
        ...(target.pitch !== undefined ? { pitch: target.pitch } : {}),
      };
    };
    const orbit = new OrbitController({
      ...orbitTarget(options.camera),
      range: options.camera.range ?? 3_000,
      heading: options.camera.heading ?? 0,
      pitch: options.camera.pitch ?? 0.6,
    });
    let pose = orbit.update(0, input.read(0), environment);
    stack = await createStack(frameLatitude, pose);
    disposers.push(() => stack?.dispose());
    if (signal?.aborted) throw new DOMException('Earth view mount aborted', 'AbortError');

    const markers: MarkerLayer = createMarkerLayer(renderer, {
      groundHeight,
      fade: { near: 25_000, far: 60_000 },
      maxVisible: 256,
    });
    disposers.push(() => markers.dispose());
    let markerSpecs: EarthMarker[] = [];
    const placeMarkers = (): void => {
      markers.set(
        markerSpecs.map(({ latitude, longitude, ...rest }) => {
          const [x, z] = toWorld(latitude, longitude);
          return { ...rest, x, z };
        }),
      );
    };

    const listeners: Listeners = {
      camerachange: new Set(),
      markerclick: new Set(),
      modechange: new Set(),
      message: new Set(),
    };
    const emit = <K extends keyof EarthViewEvents>(event: K, payload: EarthViewEvents[K]): void => {
      for (const handler of listeners[event]) {
        try {
          handler(payload);
        } catch (error) {
          report(error, `${event} handler`);
        }
      }
    };

    // Navigation state.
    let mode: EarthViewMode = 'orbit';
    const walker = new WalkController();
    const collision = new WalkCollision();
    const look = { yaw: 0, pitch: 0 };

    const applyProfile = (): void => {
      input.setProfile(mode);
      joystick?.setVisible(mode !== 'orbit');
      renderer.setCameraClip(mode === 'orbit' ? 1 : 0.05, 500_000);
    };
    const enterWalk = (x: number, z: number, yaw: number): void => {
      walker.reset(x, z);
      collision.clear();
      look.yaw = yaw;
      look.pitch = 0;
    };

    const setMode = (next: EarthViewMode): boolean => {
      if (next === mode) return true;
      const current = stack;
      if (current === undefined) return false;
      if (next === 'drive') {
        if (mode !== 'walk' || current.vehicles === undefined) {
          emit('message', { text: 'Walk up to a parked car to drive it' });
          return false;
        }
        const eye: [number, number, number] = [
          walker.feet.x,
          walker.feet.y + WALK_EYE_HEIGHT,
          walker.feet.z,
        ];
        if (!current.vehicles.enter(eye)) {
          emit('message', { text: current.vehicles.message || 'No car within reach' });
          return false;
        }
        current.vehicles.view = 'chase';
      } else if (mode === 'drive') {
        const feet = current.vehicles?.exit();
        if (feet === undefined) {
          emit('message', { text: current.vehicles?.message || 'Cannot leave the car here' });
          return false;
        }
        walker.feet.fromArray(feet);
        walker.velocity.set(0, 0, 0);
        walker.ready = true;
        walker.grounded = true;
        walker.waitingForTerrain = false;
        if (next === 'orbit') {
          orbit.set({ target: [...feet], range: 400, heading: look.yaw + Math.PI / 2, pitch: 0.5 });
        }
      } else if (next === 'walk') {
        const { target, heading } = orbit.state;
        enterWalk(target[0], target[2], heading - Math.PI / 2);
      } else {
        const feet = walker.feet;
        orbit.set({
          target: [feet.x, feet.y, feet.z],
          range: 400,
          heading: look.yaw + Math.PI / 2,
          pitch: 0.5,
        });
        collision.clear();
      }
      mode = next;
      applyProfile();
      emit('modechange', { mode });
      return true;
    };

    // Adaptive quality.
    const controller = new AdaptiveQualityController({ initialLevel: level });
    const applyTier = (): void => {
      tier = earthPerformanceTier(level);
      lodPolicy.maxPixelError = automatic ? tier.objectPixelError : 2;
      const current = stack;
      if (current !== undefined) {
        const budget = automatic ? tier.terrain : terrainPyramidBudgetForQuality(quality());
        current.stream.setBudget({ ...budget, maxResidentBytes: budget.maxResidentBytes });
        current.viewDistance = budget.viewDistance;
        current.worldgen?.setQuality(quality());
        current.worldgen?.setCacheBudget(automatic ? tier.cacheBytes : 192 * 1024 * 1024);
        void current.surface
          .setOptions({
            style: 'modern',
            details: {
              preferMappedProps: current.worldgen !== undefined,
              parkedVehicles: content?.parkedVehicles ?? [],
              ...surfaceBudgets(quality(), automatic ? tier.surfaceScale : 1),
            },
          })
          .catch((error: unknown) => report(error, 'surface detail'));
      }
      resize();
    };
    const resize = (): void => {
      const [w, h] = viewport();
      const device = window.devicePixelRatio || 1;
      const ratio = automatic
        ? Math.min(maxPixelRatio, earthPixelRatio(level, w, h, device))
        : Math.min(maxPixelRatio, device);
      renderer.setPixelRatio(ratio);
      renderer.setSize(w, h);
      lodPolicy.viewportHeight = canvas.height;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    disposers.push(() => observer.disconnect());
    applyTier();

    // Re-anchoring rebuilds the terrain stack in a frame at the new latitude.
    let anchoring: Promise<void> | undefined;
    const reanchor = (latitude: number): void => {
      if (anchoring !== undefined || stack === undefined) return;
      const previous = stack;
      const center = orbit.state;
      const ground = toLatLon(center.target[0], center.target[2]);
      anchoring = (async () => {
        previous.dispose();
        stack = undefined;
        frameLatitude = latitude;
        metersPerUnit = terrainPackageMetersPerUnit(pkg, { latitude });
        const [x, z] = toWorld(ground.latitude, ground.longitude);
        orbit.set({ target: [x, center.target[1], z] });
        placeMarkers();
        pose = orbit.update(0, input.read(0), environment);
        try {
          const next = await createStack(latitude, pose);
          if (disposed) next.dispose();
          else stack = next;
        } catch (error) {
          report(error, 're-anchor');
        } finally {
          anchoring = undefined;
        }
      })();
    };

    let pendingAnchor: number | undefined;
    const camera = (): EarthCameraState => {
      const target =
        mode === 'orbit'
          ? orbit.state.target
          : ([walker.feet.x, walker.feet.y, walker.feet.z] as [number, number, number]);
      const ground = toLatLon(target[0], target[2]);
      const orbitState = orbit.state;
      const dx = pose.position[0] - target[0];
      const dy = pose.position[1] - target[1];
      const dz = pose.position[2] - target[2];
      return {
        mode,
        latitude: ground.latitude,
        longitude: ground.longitude,
        altitude: pose.position[1],
        range: Math.hypot(dx, dy, dz),
        heading:
          mode === 'orbit' ? orbitState.heading : Math.atan2(pose.direction[0], -pose.direction[2]),
        pitch: mode === 'orbit' ? orbitState.pitch : -Math.asin(pose.direction[1]),
      };
    };

    // The frame loop.
    let paused = false;
    let frames = 0;
    let last = performance.now();
    let streamTime = -Infinity;
    let streamed = { position: pose.position, direction: pose.direction };
    let lastEmit = 0;
    let lastEmitted = '';
    let bakingFor: EarthWorldgen | undefined;
    let frameHandle = 0;

    const orbitFrame = (dt: number, frameInput: NavigationInput): NavigationPose => {
      const wasFlying = orbit.flying;
      const next = orbit.update(dt, frameInput, environment);
      if (wasFlying && !orbit.flying && pendingAnchor !== undefined) {
        reanchor(pendingAnchor);
        pendingAnchor = undefined;
      } else if (!orbit.flying && anchoring === undefined) {
        const { latitude } = toLatLon(next.lookAt[0], next.lookAt[2]);
        if (Math.abs(latitude - frameLatitude) > REANCHOR_DEGREES * 1.5) reanchor(latitude);
      }
      return next;
    };

    const walkFrame = (
      dt: number,
      frameInput: NavigationInput,
      current: EarthStack,
    ): NavigationPose => {
      const turned = applyCameraLookDelta(
        look.yaw,
        look.pitch,
        frameInput.look[0],
        frameInput.look[1],
      );
      look.yaw = turned.yaw;
      look.pitch = turned.pitch;
      collision.update(current.stream.object, walker.feet.x, walker.feet.z);
      if (!walker.ready) {
        const stats = current.stream.stats();
        if (stats.loading === 0 && stats.loadingLayers === 0) walker.place(collision, groundHeight);
      }
      walker.update(
        dt,
        {
          forward: frameInput.move.forward,
          right: frameInput.move.right,
          yaw: look.yaw,
          sprint: frameInput.sprint,
          jump: frameInput.jump,
        },
        collision,
        groundHeight,
      );
      const eyeY = walker.ready
        ? walker.feet.y + WALK_EYE_HEIGHT
        : (groundHeight(walker.feet.x, walker.feet.z) ?? 0) + WALK_EYE_HEIGHT;
      const position: [number, number, number] = [walker.feet.x, eyeY, walker.feet.z];
      current.worldgen?.updateInteriors(position);
      if (frameInput.interact > 0) setMode('drive');
      const direction = cameraForward(look.yaw, look.pitch);
      return {
        position,
        lookAt: [
          position[0] + direction[0],
          position[1] + direction[1],
          position[2] + direction[2],
        ],
        direction,
      };
    };

    const driveFrame = (
      dt: number,
      frameInput: NavigationInput,
      current: EarthStack,
    ): NavigationPose => {
      const vehicles = current.vehicles as EarthVehicles;
      if (frameInput.view > 0) vehicles.view = vehicles.view === 'cockpit' ? 'chase' : 'cockpit';
      vehicles.lookYaw = Math.max(
        -1.45,
        Math.min(1.45, vehicles.lookYaw + frameInput.look[0] * 0.003),
      );
      vehicles.lookPitch = Math.max(
        -0.8,
        Math.min(0.8, vehicles.lookPitch - frameInput.look[1] * 0.003),
      );
      vehicles.update(dt, {
        throttle: frameInput.move.forward,
        steering: frameInput.move.right,
        brake: frameInput.jump,
      });
      if (frameInput.interact > 0 && setMode('walk')) return walkFrame(0, frameInput, current);
      const view = vehicles.cameraPose();
      if (view === undefined) return pose;
      const direction = new THREE.Vector3()
        .fromArray(view.lookAt)
        .sub(new THREE.Vector3().fromArray(view.position))
        .normalize()
        .toArray() as [number, number, number];
      look.yaw = Math.atan2(direction[2], direction[0]);
      return { position: view.position, lookAt: view.lookAt, direction };
    };

    const frame = (now: number): void => {
      frameHandle = requestAnimationFrame(frame);
      const frameMs = now - last;
      const dt = Math.min(0.1, Math.max(0, frameMs / 1000));
      last = now;
      const current = stack;
      const frameInput = input.read(dt);
      if (automatic && current !== undefined) {
        const stats = current.stream.stats();
        const change = controller.sample(frameMs, {
          active: !document.hidden,
          loading: stats.loading > 0 || stats.loadingLayers > 0,
          memoryPressure: current.stream.pressure().displayedByteRatio,
        });
        if (change !== undefined) {
          level = change.level;
          applyTier();
        }
      }
      if (mode === 'orbit' || current === undefined) pose = orbitFrame(dt, frameInput);
      else if (mode === 'walk') pose = walkFrame(dt, frameInput, current);
      else pose = driveFrame(dt, frameInput, current);

      if (current !== undefined) {
        current.stream.updateTransitions(now);
        if (
          now - streamTime >= 100 ||
          viewNeedsImmediateUpdate(
            streamed.position,
            streamed.direction,
            pose.position,
            pose.direction,
            16,
            0.035,
          )
        ) {
          streamTime = now;
          const [w, h] = viewport();
          current.stream.update({
            position: pose.position,
            verticalFov: VERTICAL_FOV,
            viewportHeight: canvas.height || h,
            direction: pose.direction,
            aspect: w / h,
          });
          streamed = { position: pose.position, direction: pose.direction };
        }
        current.vehicles?.sync(now, pose.position);
        if (mode !== 'drive')
          current.vehicles?.update(dt, { throttle: 0, steering: 0, brake: true });
        updateEarthFog(fog, current.viewDistance, pose.position[1]);
      }
      for (const tap of frameInput.taps) {
        const id = markers.pick(tap.x, tap.y);
        if (id !== undefined) emit('markerclick', { id });
      }
      markers.update(pose.position);
      viewer.setCamera({ position: pose.position, lookAt: pose.lookAt });
      const origin = renderer.getWorldOrigin();
      setTerrainWaterTime(water, now / 1000, [origin[0], origin[2]]);
      viewer.renderFrame();
      frames++;
      const worldgen = current?.worldgen;
      if (worldgen !== undefined && worldgen !== bakingFor) {
        bakingFor = worldgen;
        // Let the first frame (of each frame anchor) paint before CPU-heavy material baking.
        setTimeout(() => {
          void worldgen
            .prepareMaterials()
            .catch((error: unknown) => report(error, 'worldgen materials'));
        }, 0);
      }
      if (now - lastEmit > 100 && listeners.camerachange.size > 0) {
        const state = camera();
        const key = `${mode}:${state.latitude.toFixed(6)}:${state.longitude.toFixed(6)}:${state.range.toFixed(1)}:${state.heading.toFixed(3)}:${state.pitch.toFixed(3)}`;
        if (key !== lastEmitted) {
          lastEmitted = key;
          lastEmit = now;
          emit('camerachange', state);
        }
      }
    };
    frameHandle = requestAnimationFrame(frame);
    disposers.push(() => cancelAnimationFrame(frameHandle));
    const onVisibility = (): void => {
      controller.sample(0, { active: false });
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    disposers.push(() => document.removeEventListener('visibilitychange', onVisibility));

    const credits = earthCredits(pkg.attribution);
    return {
      viewer,
      input,
      credits,
      get mode() {
        return mode;
      },
      setMode,
      flyTo(target, flyOptions = {}) {
        if (mode !== 'orbit') setMode('orbit');
        const far = Math.abs(target.latitude - frameLatitude) > REANCHOR_DEGREES;
        pendingAnchor = far ? target.latitude : undefined;
        orbit.flyTo(orbitTarget(target), flyOptions);
      },
      jumpTo(target) {
        if (mode !== 'orbit') setMode('orbit');
        orbit.set(orbitTarget(target));
        if (Math.abs(target.latitude - frameLatitude) > REANCHOR_DEGREES) reanchor(target.latitude);
      },
      getCamera: camera,
      setMarkers(next) {
        markerSpecs = next.map((spec) => ({ ...spec }));
        placeMarkers();
      },
      markerScreenPosition: (id) => markers.screenPosition(id),
      on(event, handler) {
        const set = listeners[event] as Set<typeof handler>;
        set.add(handler);
        return () => {
          set.delete(handler);
        };
      },
      async whenIdle() {
        await anchoring;
        await stack?.stream.whenIdle();
      },
      stats() {
        const streamStats = stack?.stream.stats();
        const renderStats = renderer.stats();
        return {
          mode,
          frames,
          qualityLevel: level,
          displayedTiles: streamStats?.displayed ?? 0,
          loadingTiles: (streamStats?.loading ?? 0) + (streamStats?.loadingLayers ?? 0),
          failedTiles: (streamStats?.failed ?? 0) + (streamStats?.failedLayers ?? 0),
          maxDisplayedLevel: streamStats?.maxDisplayedLevel,
          markers: markers.ids().length,
          drawCalls: renderStats.drawCalls,
          triangles: renderStats.triangles,
          frameLatitude,
        };
      },
      setPaused(next) {
        if (next === paused || disposed) return;
        paused = next;
        if (paused) {
          cancelAnimationFrame(frameHandle);
          input.map.reset();
          controller.sample(0, { active: false });
        } else {
          last = performance.now();
          frameHandle = requestAnimationFrame(frame);
        }
      },
      dispose: disposeAll,
    };
  } catch (error) {
    disposeAll();
    throw error;
  }
}
