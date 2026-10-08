// mountEarthView: one call that turns a canvas into an explorable real-world 3D view. It composes
// the viewer, the streamed terrain pyramid (in a metric frame at the viewed latitude), semantic
// layers with worldgen buildings, street surfaces and parked cars, orbit/walk/drive/fly
// navigation, world markers, sky and haze, and adaptive quality — and owns its frame loop, events
// and full teardown. Hosts speak latitude/longitude; world meters stay inside.

import {
  AdaptiveQualityController,
  type AdaptiveQualityReason,
  applyEnvironment,
  createViewer,
  type EnvironmentData,
  type MolenClient,
  type RendererBackendPreference,
} from '@bendyline/molen-client';
import type { AudioLayer } from '@bendyline/molen-client/audio';
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
  WALK_PLACEMENT_RADIUS,
  WalkCollision,
  WalkController,
} from '@bendyline/molen-client/navigation';
import type { BakedMaterialStore } from '@bendyline/molen-materials';
import {
  type BlockCache,
  type BlockCacheStats,
  cachingDocumentFetch,
} from '@bendyline/molen-pack/cache';
import {
  cachingArchiveOpener,
  createDefaultTerrainSemanticRenderer,
  createProfiledTerrainPackageSemanticLayers,
  createTerrainGroundMaterialAsync,
  createTerrainPackagePyramidStream,
  createTerrainSurfaceRenderer,
  createTerrainSurfaceWorkerBridge,
  createTerrainWaterMaterialAsync,
  sampleTerrainTunnel,
  setTerrainGroundOrigin,
  setTerrainWaterTime,
  type TerrainPyramidBudget,
  type TerrainPyramidHeightSource,
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
  terrainPyramidTileKey,
  wgs84ToWorld,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import type {
  ScreenSpaceLodPolicy,
  StructureStreamingOptions,
  StructureStreamingStats,
} from '@bendyline/molen-worldgen/client';
import type { StructureTerrainSampler } from '@bendyline/molen-worldgen-earth/client';
import { isStructureViewingDate } from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EarthAircraft, type EarthFlightStatus } from './aircraft';
import {
  ambientContentFromTypes,
  EarthAmbient,
  type EarthAmbientSettings,
  type EarthAmbientStats,
} from './ambient';
import { observeSemanticTiles, SemanticTileBuffer } from './ambient-tiles';
import {
  createEarthFog,
  createEarthSky,
  EARTH_SUN_AZIMUTH,
  EARTH_SUN_ELEVATION,
  type EarthSkyStyle,
  earthSunDirection,
  updateEarthFog,
} from './atmosphere';
import { type EarthCredit, earthCredits, regionalEarthAttribution } from './attribution';
import { createEarthAudio, type EarthAudio, type EarthAudioOptions } from './audio';
import type { EarthContent } from './content';
import {
  EARTH_EXPOSURE,
  EARTH_LIGHTING,
  EARTH_SKY_PALETTE,
  EARTH_TONE_MAPPING,
  EARTH_WATER_COLOR,
  earthShadowFocus,
} from './look';
import {
  earthInitialQualityLevel,
  earthMemoryBudget,
  earthPerformanceTier,
  earthPixelRatio,
  earthQualityLevel,
} from './performance';
import {
  createEarthPrefetcher,
  type EarthPrefetchArchives,
  type EarthPrefetcher,
  type EarthPrefetchOptions,
  type EarthPrefetchPoint,
  type EarthPrefetchResult,
  type EarthPrefetchStats,
} from './prefetch';
import { createRegionalGroundColor } from './regional-ground';
import { EarthVehicles } from './vehicles';
import { EarthWildlife, type EarthWildlifeStats } from './wildlife';
import { createEarthWorldgen, type EarthViewWorkers, type EarthWorldgen } from './worldgen';

export type EarthViewMode = 'orbit' | 'walk' | 'drive' | 'fly';

/** How {@link EarthView.setMode} enters or leaves a vehicle. */
export interface EarthModeOptions {
  /**
   * Drive: without a parked car in reach, add a car on the nearest mapped road around the view
   * (`true` picks a sedan-like type from the entities pack; a string names the entity type).
   */
  vehicle?: string | true;
  /** Fly: the aircraft entity type (default the first flyable type, the P-51D in the stock pack). */
  aircraft?: string;
  /**
   * Fly: start in the air (default) or parked on the ground with the engine off. `altitude` is
   * meters above the ground (default from the orbit camera, 150-1500 m), `speed` m/s.
   */
  airborne?: boolean | { altitude?: number; speed?: number };
  /**
   * Switch even when the vehicle rules would refuse (moving, airborne, engine running): the
   * viewer steps out at once and a vehicle added by `setMode` is removed. For host controls such
   * as a mode menu; in-scene keys (E) keep the rules.
   */
  force?: boolean;
}

/** The vehicle the viewer is in, for a HUD. SI units; headings are compass radians. */
export type EarthVehicleStatus =
  | {
      kind: 'car';
      label: string;
      /** m/s, reversing negative. */
      speed: number;
      heading: number;
      view: 'cockpit' | 'chase';
      waitingForTerrain: boolean;
    }
  | ({ kind: 'aircraft' } & EarthFlightStatus);

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
  /**
   * Bare-ground colors by the terrain package's surface layer name (for example `soil`,
   * `lowland`, `alpine`, `snow`), replacing the package's own.
   */
  ground?: Readonly<Record<string, string>>;
  /** Landcover class colors (forest, grass, park, urban_area…) over the style pack's palette. */
  landcover?: Readonly<Record<string, string>>;
}

/** A host-selected geographic data package for the current camera region. */
export interface EarthTerrainSource {
  terrain: TerrainPackageDescriptor;
  /** Stable region key; changing it replaces the active terrain stream. */
  key?: string;
  baseUrl?: string | URL;
  archives?: {
    elevation?: TerrainTileArchive;
    landcover?: TerrainTileArchive;
    features?: TerrainTileArchive;
    /** Serves the package's `features.buildingDetail` level (finer building footprints). */
    buildingDetail?: TerrainTileArchive;
  };
}

export interface EarthViewOptions {
  /** Explicit archival landmark date (YYYY-MM-DD), independent of sky time. Remount to change it. */
  viewingDate?: string;
  /** Explicit month (1..12) for regional foliage; remount to change. Omitted means leaf-on. */
  vegetationMonth?: number;
  /** Fine/cross-tile landmark ground heights in the active terrain's vertical reference. */
  sampleStructureTerrain?: StructureTerrainSampler;
  /** Shared sky/ground reflections for metal and glass. Defaults to true. */
  reflections?: boolean;
  /**
   * Sun shadows from buildings, trees and landmarks around what the camera frames (default
   * true). Adaptive quality turns them off at its two lowest levels.
   */
  shadows?: boolean;
  canvas: HTMLCanvasElement;
  /** A fixed `molen/terrain-package@1` manifest. Omit when using `terrainSource`. */
  terrain?: TerrainPackageDescriptor;
  /** Resolve PMTiles and terrain for each geographic region. Called on mount and after travel. */
  terrainSource?: (
    target: Readonly<{ latitude: number; longitude: number }>,
    signal: AbortSignal,
  ) => Promise<EarthTerrainSource>;
  /** URL of the manifest (resolves package-relative archives). */
  baseUrl?: string | URL;
  /** Host transports for the package's archives, e.g. archive sets with offline packs. */
  archives?: {
    elevation?: TerrainTileArchive;
    landcover?: TerrainTileArchive;
    features?: TerrainTileArchive;
    /** Serves the package's `features.buildingDetail` level (finer building footprints). */
    buildingDetail?: TerrainTileArchive;
  };
  /** Content packs; without them buildings are plain extrusions and there are no cars. */
  content?: EarthContent;
  /**
   * Sound from the content packs' sound banks (the `molen.sounds` pack): weather and nature
   * ambience, footsteps, traffic and engines. Starts silent until the first click or key press.
   * false turns it off; without a sound bank the view is silent.
   */
  audio?: EarthAudioOptions | false;
  /**
   * Ambient life: NPC cars on the mapped roads, pedestrians on footways, trains on railways and
   * aircraft overhead, spawned around the viewer and removed behind it. On by default; false
   * turns it off. Vehicle and aircraft models come from the entities pack (simple shapes without
   * it).
   */
  ambient?: EarthAmbientSettings | false;
  /** The first view. */
  camera: EarthCameraTarget;
  /** `'auto'` adapts to measured frame times (default). */
  quality?: 'auto' | TerrainQualityPreset;
  /** Worker factories; each piece of work runs in-thread without its worker. */
  workers?: EarthViewWorkers;
  /**
   * Keep baked building materials across visits, e.g. `createIndexedDbMaterialStore()` from
   * `@bendyline/molen-client`; a later visit reads them instead of baking.
   */
  materialStore?: BakedMaterialStore;
  /**
   * Keep terrain bytes across visits: elevation, landcover, feature and building tiles read
   * through this cache (`createBlockCache` over `createIndexedDbByteStore`, both from
   * `@bendyline/molen-pack/cache`), so ground seen before streams from disk. Archives passed in
   * `archives` are used as given. Pass the same cache to `openPacksFromIndex` for content packs.
   */
  byteCache?: BlockCache;
  /**
   * With `byteCache`: read terrain ahead of the camera into the cache, along its track (on by
   * default; false turns it off). Only bytes are read, two at a time, when the stream has a free
   * load slot. Hosts that know the route queue places with `EarthView.prefetch`.
   */
  prefetch?: EarthPrefetchOptions | false;
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
  /**
   * Terrain and layer geometry this device can keep on screen, bytes (default
   * `earthMemoryBudget()`, from the browser's memory report). Memory pressure is measured
   * against it, and the terrain cache keeps at least this much.
   */
  memoryBudget?: number;
  /** Source-derived landmark streaming budgets; false explicitly loads full legacy models. */
  landmarkStreaming?: StructureStreamingOptions | false;
  /**
   * Highest level `quality: 'auto'` climbs to (0-5, default 3, Balanced). Above it buildings
   * switch to the high preset, which rebuilds them across the view for little visible gain.
   */
  maxQualityLevel?: number;
  /** Cancels the mount while it is still starting. */
  signal?: AbortSignal;
  /** Tile, layer and content failures (the view keeps running on what loaded). */
  onError?: (error: unknown, context: string) => void;
}

export interface EarthViewEvents {
  camerachange: EarthCameraState;
  /** A host-provided terrain region became active; update visible attribution. */
  terrainchange: { key?: string; credits: EarthCredit[] };
  markerclick: { id: string };
  modechange: { mode: EarthViewMode };
  /** A short explanation for the user, e.g. why a vehicle could not be entered. */
  message: { text: string };
  /** Sound loaded: `view.audio` is now set (volume, mute, bus gains). */
  audioready: Record<string, never>;
}

export interface EarthViewStats {
  mode: EarthViewMode;
  frames: number;
  /** Adaptive performance level (0-5). */
  qualityLevel: number;
  /** Why adaptive quality last changed level, once it has. */
  qualityReason?: AdaptiveQualityReason;
  /** Displayed terrain and layer bytes over the level's resident budget; above 1 lowers quality. */
  memoryPressure: number;
  displayedTiles: number;
  loadingTiles: number;
  failedTiles: number;
  maxDisplayedLevel: number | undefined;
  markers: number;
  drawCalls: number;
  triangles: number;
  frameLatitude: number;
  /** Ambient life counts, when it is on. */
  ambient?: EarthAmbientStats;
  wildlife?: EarthWildlifeStats;
  /**
   * Building generation since the current terrain stream started, when content packs are
   * loaded: tiles generated, buildings drawn as geometry, and instanced stand-ins.
   */
  worldgen?: { tiles: number; buildings: number; standIns: number };
  structures?: StructureStreamingStats;
}

/** What {@link EarthView.cacheStats} reports. */
export interface EarthCacheStats {
  /** The byte cache, when the view was mounted with one. */
  cache?: BlockCacheStats;
  /** Look-ahead reads into the cache, when prefetching is on. */
  prefetch?: EarthPrefetchStats;
}

export interface EarthView {
  readonly viewer: MolenClient;
  readonly input: NavigationInputSource;
  /** Required data credits; keep them visible whenever the view is. */
  readonly credits: EarthCredit[];
  readonly mode: EarthViewMode;
  /**
   * Switch navigation. Drive takes a parked car within reach, or adds one on the nearest road
   * with `{ vehicle: true }`; fly adds an aircraft (airborne by default) over the view. Returns
   * false when unavailable, with a `message` event explaining why.
   */
  setMode(mode: EarthViewMode, options?: EarthModeOptions): boolean;
  /** The car or aircraft the viewer is in, or undefined on foot and in orbit. */
  vehicleStatus(): EarthVehicleStatus | undefined;
  /** Set the mounted aircraft's throttle or collective directly, 0..1 (e.g. an on-screen lever). */
  setThrottle(power: number): void;
  /** After an impact, put the aircraft back in the air above the crash site (the R key). */
  recover(): boolean;
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
  /** Byte cache counters (hits, network requests, stored bytes) and prefetch progress. */
  cacheStats(): EarthCacheStats;
  /**
   * Read the terrain around places the viewer is expected to reach into the byte cache (a
   * simulator's flight plan, the next stop of a tour), ahead of the camera's own look-ahead.
   * Resolves when they are read; resolves with nothing requested without a byte cache.
   */
  prefetch(
    points: readonly EarthPrefetchPoint[],
    options?: { signal?: AbortSignal },
  ): Promise<EarthPrefetchResult>;
  /** The sound layer (volume, mute, bus gains) once it has loaded; undefined when silent. */
  readonly audio: AudioLayer | undefined;
  /** Stop rendering (e.g. while hidden); input and streaming pause with it. */
  setPaused(paused: boolean): void;
  /** Show or hide ambient life (no-op when mounted with `ambient: false`). */
  setAmbientEnabled(enabled: boolean): void;
  readonly ambientEnabled: boolean;
  dispose(): void;
}

const VERTICAL_FOV = THREE.MathUtils.degToRad(60);
/** Degrees past the view where ground stays built at reduced detail, covering a quick turn. */
const PERIPHERAL_DEGREES = 20;
/** Error weight of that band: roughly a level coarser than the view beside it. */
const PERIPHERAL_DETAIL = 0.4;
/** The package with its bare-ground surface layers recolored by name (others untouched). */
function withGroundColors(
  pkg: TerrainPackageDescriptor,
  ground: Readonly<Record<string, string>> | undefined,
): TerrainPackageDescriptor {
  const layers = pkg.surface?.layers;
  if (ground === undefined || layers === undefined) return pkg;
  return {
    ...pkg,
    surface: {
      ...pkg.surface,
      layers: layers.map((layer) =>
        ground[layer.name] !== undefined
          ? { ...layer, color: ground[layer.name] as string }
          : layer,
      ),
    },
  };
}

/** How long a level must hold before adaptive quality turns sticky, ms. */
const QUALITY_CALIBRATION_MS = 12_000;
/** After calibration: down after sustained overload, up after long headroom, changes far apart. */
const STICKY_QUALITY = { decreaseDelayMs: 2_500, increaseDelayMs: 20_000, cooldownMs: 6_000 };
/** A quality level change waits until the camera has been still this long, ms... */
const QUALITY_SETTLE_MS = 600;
/** ...or has waited this long, ms. */
const QUALITY_HOLD_MAX_MS = 4_000;
/** Memory pressure at which a level change applies at once, moving or not. */
const URGENT_MEMORY_PRESSURE = 1.25;
/** Re-anchor the metric frame once the view is this far (degrees latitude) from it. */
const REANCHOR_DEGREES = 1;
/** Recheck a host's regional source after roughly five kilometers of manual panning. */
const SOURCE_CHECK_DEGREES = 0.05;

/**
 * How far back the orbit camera may pull for a terrain view distance, meters. Much past half the
 * view distance the ground it looks at sinks into haze, and past the view distance nothing draws.
 */
export function earthOrbitMaxRange(viewDistance: number): number {
  return Math.max(2_000, viewDistance * 0.45);
}
/**
 * The shared medium-fi light rig (see look.ts) as a fixed environment. Its sky reflections are
 * built from the background (zenith), the ambient sky (horizon) and ground colors, so it lights
 * the scene the way the clock-driven sky does at midday.
 */
const DEFAULT_ENVIRONMENT: EnvironmentData = {
  ambient: {
    sky: EARTH_SKY_PALETTE.dayHorizon,
    ground: EARTH_SKY_PALETTE.ground,
    intensity: EARTH_LIGHTING.dayAmbient,
  },
  sun: {
    direction: [-6, 10, 4],
    color: EARTH_SKY_PALETTE.sun,
    intensity: EARTH_LIGHTING.sunIntensity,
  },
  background: EARTH_SKY_PALETTE.dayZenith,
  toneMapping: EARTH_TONE_MAPPING,
  exposure: EARTH_EXPOSURE,
};

/**
 * The light rig for a style. When the host places the sky's sun (`sky.sunElevation` or
 * `sky.sunAzimuth`) and leaves `environment.sun.direction` unset, the sunlight comes from that
 * same point in the sky, so lit faces and shadows agree with the visible sun.
 */
export function earthEnvironment(style: EarthViewStyle | undefined): EnvironmentData {
  const sky = style?.sky || undefined;
  const custom = style?.environment;
  const placedSun =
    sky !== undefined && (sky.sunElevation !== undefined || sky.sunAzimuth !== undefined);
  const sun = { ...DEFAULT_ENVIRONMENT.sun, ...custom?.sun };
  if (placedSun && custom?.sun?.direction === undefined) {
    sun.direction = earthSunDirection(
      sky.sunElevation ?? EARTH_SUN_ELEVATION,
      sky.sunAzimuth ?? EARTH_SUN_AZIMUTH,
    );
  }
  return { ...DEFAULT_ENVIRONMENT, ...custom, sun };
}

interface EarthStack {
  frameLatitude: number;
  metersPerUnit: number;
  stream: TerrainPyramidStream;
  prefetcher: EarthPrefetcher | undefined;
  surface: TerrainSurfaceRenderer;
  worldgen: EarthWorldgen | undefined;
  vehicles: EarthVehicles | undefined;
  aircraft: EarthAircraft | undefined;
  ambient: EarthAmbient | undefined;
  wildlife: EarthWildlife | undefined;
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
  if (options.viewingDate !== undefined && !isStructureViewingDate(options.viewingDate))
    throw new Error('viewingDate must be a valid YYYY-MM-DD calendar date');
  if (
    options.vegetationMonth !== undefined &&
    (!Number.isInteger(options.vegetationMonth) ||
      options.vegetationMonth < 1 ||
      options.vegetationMonth > 12)
  )
    throw new Error('vegetationMonth must be an integer from 1 through 12');
  const { canvas, content, signal } = options;
  const sourceAbort = new AbortController();
  const forwardAbort = (): void => sourceAbort.abort();
  if (signal?.aborted) sourceAbort.abort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });
  if (options.terrain === undefined && options.terrainSource === undefined)
    throw new Error('Earth view needs terrain or terrainSource');
  let source: EarthTerrainSource =
    options.terrainSource !== undefined
      ? await options.terrainSource(options.camera, sourceAbort.signal)
      : {
          terrain: options.terrain as TerrainPackageDescriptor,
          ...(options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {}),
          ...(options.archives !== undefined ? { archives: options.archives } : {}),
        };
  let pkg = source.terrain;
  const report =
    options.onError ?? ((error, context) => console.warn(`[molen-earth] ${context}`, error));
  const automatic = (options.quality ?? 'auto') === 'auto';
  let level = automatic
    ? earthInitialQualityLevel()
    : earthQualityLevel(options.quality as TerrainQualityPreset);
  let tier = earthPerformanceTier(level);
  const quality = (): TerrainQualityPreset =>
    automatic ? tier.quality : (options.quality as TerrainQualityPreset);
  const maxPixelRatio = options.maxPixelRatio ?? 2;
  const memoryBudget = options.memoryBudget ?? earthMemoryBudget();
  if (!(memoryBudget > 0) || !Number.isFinite(memoryBudget))
    throw new RangeError('memoryBudget must be a positive number of bytes');
  // Archives the view opens itself read through the byte cache. A set's base archive (the
  // coarse levels every view starts from) outlives detail; building detail goes first.
  const cacheTransport =
    options.byteCache !== undefined
      ? (() => {
          const cache = options.byteCache;
          const fetchDocument = cachingDocumentFetch(cache.store);
          return {
            normal: {
              openArchive: cachingArchiveOpener(cache, {
                priority: (_url, id) => (id === 'base' ? 'high' : 'normal'),
              }),
              fetch: fetchDocument,
            },
            low: {
              openArchive: cachingArchiveOpener(cache, { priority: 'low' }),
              fetch: fetchDocument,
            },
          };
        })()
      : undefined;
  // Ground just left must stay warm up to the device budget, whatever the level: a smaller cache
  // re-streams it on every pan, and loses the intermediate levels that bridge a refinement.
  // Ground a little past the view stays loaded as bare terrain, so turning the camera reveals
  // ground that is already there; its buildings and trees follow once it is in view.
  const terrainBudget = (): TerrainPyramidBudget => {
    const base = automatic ? tier.terrain : terrainPyramidBudgetForQuality(quality());
    return {
      ...base,
      peripheralDegrees: PERIPHERAL_DEGREES,
      peripheralDetail: PERIPHERAL_DETAIL,
      maxResidentBytes: Math.max(base.maxResidentBytes ?? 0, memoryBudget),
      maxResidentTiles: Math.max(
        base.maxResidentTiles,
        Math.min(512, Math.round(memoryBudget / (2 * 1024 * 1024))),
      ),
    };
  };
  // Sun shadows follow the performance tier (see EarthPerformanceTier.shadows).
  const shadowsOn = options.shadows ?? true;
  const shadowQuality = (): 'off' | 'medium' | 'high' =>
    !shadowsOn ? 'off' : earthPerformanceTier(level).shadows;
  const worldgenCacheBytes = (): number =>
    Math.max(automatic ? tier.cacheBytes : 192 * 1024 * 1024, memoryBudget / 4);
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
    reflections: options.reflections ?? true,
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
  disposers.push(() => {
    sourceAbort.abort();
    signal?.removeEventListener('abort', forwardAbort);
  });
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
    applyEnvironment(renderer, earthEnvironment(options.style));
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
        color: options.style?.water ?? EARTH_WATER_COLOR,
        waveScale: 0.028,
        waveStrength: 0.045,
        waveSpeed: 0.5,
      },
      renderer.backend,
    );
    disposers.push(() => water.dispose());
    // Terrain and landcover share one ground material with world-space variation.
    const groundMaterial = await createTerrainGroundMaterialAsync({}, renderer.backend);
    disposers.push(() => groundMaterial.dispose());
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
    const ambientSettings = options.ambient === false ? undefined : (options.ambient ?? {});
    let ambientOn = ambientSettings !== undefined;
    const ambientContent =
      content?.types !== undefined
        ? ambientContentFromTypes(content.types, async (id) => {
            try {
              return await loadModel(id);
            } catch {
              return undefined;
            }
          })
        : undefined;
    const ambientBudget = () =>
      (automatic ? tier : earthPerformanceTier(earthQualityLevel(quality()))).ambient;
    const environment = { groundHeight };

    const createStack = async (
      frameLatitude: number,
      view: NavigationPose,
      selected: EarthTerrainSource = source,
    ): Promise<EarthStack> => {
      const pkg = selected.terrain;
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
                ...(options.viewingDate !== undefined ? { viewingDate: options.viewingDate } : {}),
                ...(options.vegetationMonth !== undefined
                  ? { vegetationMonth: options.vegetationMonth }
                  : {}),
                ...(options.style?.landcover !== undefined
                  ? { landcoverColors: options.style.landcover }
                  : {}),
                groundMaterial,
                ...(options.sampleStructureTerrain
                  ? { sampleStructureTerrain: options.sampleStructureTerrain }
                  : {}),
                content: content.worldgen,
                assets: content.assets,
                surfaceRenderer: surface,
                metersPerUnit,
                quality: quality(),
                lodPolicy,
                ...(options.landmarkStreaming !== undefined
                  ? { landmarkStreaming: options.landmarkStreaming }
                  : {}),
                ...(options.workers !== undefined ? { workers: options.workers } : {}),
                ...(options.materialStore !== undefined
                  ? { materialStore: options.materialStore }
                  : {}),
                prepareObject: (object, prepareSignal, parent) =>
                  renderer.prepareObject(object, prepareSignal, parent),
                onMaterialFailures: (failures) =>
                  report(new Error([...failures.keys()].join(', ')), 'worldgen materials'),
              })
            : undefined;
        if (worldgen !== undefined) parts.push(() => worldgen.dispose());
        let layers: TerrainPyramidTileLayer[] = [];
        let provideTunnelHeights!: (source: TerrainPyramidHeightSource) => void;
        const tunnelHeightsReady = new Promise<TerrainPyramidHeightSource>((resolve) => {
          provideTunnelHeights = resolve;
        });
        let sidecars: Omit<EarthPrefetchArchives, 'elevation'> = {};
        // Ambient life reads the decoded road tiles as the features layer builds them.
        const ambientTiles = ambientSettings !== undefined ? new SemanticTileBuffer() : undefined;
        const wildlifeWanted =
          ambientSettings !== undefined &&
          ambientSettings.wildlife !== false &&
          (worldgen?.environment?.library.animals.size ?? 0) > 0;
        const wildlifeCover = wildlifeWanted ? new SemanticTileBuffer() : undefined;
        const wildlifeFeatures = wildlifeWanted ? new SemanticTileBuffer() : undefined;
        if (pkg.landcover !== undefined || pkg.features !== undefined) {
          try {
            const semantic = await createProfiledTerrainPackageSemanticLayers(pkg, {
              tunnels: {
                heights: {
                  load: async (address, signal) => (await tunnelHeightsReady).load(address, signal),
                },
              },
              ...(selected.baseUrl !== undefined ? { baseUrl: selected.baseUrl } : {}),
              ...(cacheTransport !== undefined
                ? { transport: cacheTransport.normal, buildingDetailTransport: cacheTransport.low }
                : {}),
              ...(selected.archives?.landcover !== undefined
                ? { landcoverArchive: selected.archives.landcover }
                : {}),
              ...(selected.archives?.features !== undefined
                ? { featuresArchive: selected.archives.features }
                : {}),
              ...(selected.archives?.buildingDetail !== undefined
                ? { buildingDetailArchive: selected.archives.buildingDetail }
                : {}),
              waterLayer: {
                visible: true,
                mesh: {
                  materials: { water },
                  waterOffset: 0.65,
                  // Earth packages have a sea: harbors and coasts draw at one flat level.
                  ...(pkg.coordinateSpace.kind === 'geospatial' ||
                  pkg.surface?.seaLevel !== undefined
                    ? { seaLevel: pkg.surface?.seaLevel ?? 0 }
                    : {}),
                },
              },
              landcoverLayer:
                worldgen !== undefined
                  ? {
                      visible: true,
                      renderer:
                        wildlifeCover !== undefined
                          ? observeSemanticTiles(worldgen.classification, wildlifeCover)
                          : worldgen.classification,
                    }
                  : { visible: true },
              featuresLayer: (() => {
                const sourceRenderer =
                  worldgen !== undefined
                    ? worldgen.humanFeatures
                    : createDefaultTerrainSemanticRenderer({
                        surfaceRenderer: surface,
                        renderLandcover: false,
                        renderWater: false,
                      });
                const inner =
                  wildlifeFeatures === undefined
                    ? sourceRenderer
                    : observeSemanticTiles(sourceRenderer, wildlifeFeatures);
                return {
                  visible: true,
                  renderer:
                    ambientTiles !== undefined ? observeSemanticTiles(inner, ambientTiles) : inner,
                };
              })(),
            });
            layers = semantic.layers;
            const { landcover, features, buildingDetail } = semantic.semantics;
            sidecars = {
              ...(landcover !== undefined ? { landcover } : {}),
              ...(features !== undefined ? { features } : {}),
              // The detail source reads its level under tiles up to two levels coarser.
              ...(buildingDetail !== undefined
                ? {
                    buildingDetail: {
                      archive: buildingDetail.archive,
                      level: buildingDetail.level,
                      maxDepth: 2,
                    },
                  }
                : {}),
            };
            // Finer building footprints are optional: without them the feature tiles' own stay.
            if (semantic.semantics.buildingDetailError !== undefined)
              report(semantic.semantics.buildingDetailError, 'building detail');
          } catch (error) {
            // Bare terrain still renders; semantic sidecars are optional by contract.
            report(error, 'semantic layers');
          }
        }
        const elevationWorker = options.workers?.elevation?.();
        if (elevationWorker !== undefined) parts.push(() => elevationWorker.terminate());
        const budget = terrainBudget();
        const [viewWidth, viewHeight] = viewport();
        const regionalGroundColor =
          options.style?.ground === undefined
            ? createRegionalGroundColor(worldgen?.environment)
            : undefined;
        const opened = await createTerrainPackagePyramidStream(
          withGroundColors(pkg, options.style?.ground),
          {
            ...(selected.baseUrl !== undefined ? { baseUrl: selected.baseUrl } : {}),
            ...(selected.archives?.elevation !== undefined
              ? { archive: selected.archives.elevation }
              : {}),
            ...(cacheTransport !== undefined ? { transport: cacheTransport.normal } : {}),
            material: groundMaterial,
            ...(regionalGroundColor !== undefined ? { surfaceColor: regionalGroundColor } : {}),
            frame,
            ...budget,
            ...(elevationWorker !== undefined ? { elevationWorker } : {}),
            admission: renderer.admission,
            prepareObject: (object, prepareSignal, parent) =>
              renderer.prepareObject(object, prepareSignal, parent),
            createTileGroup: () => renderer.createRenderGroup(),
            morphMilliseconds: 180,
            shadows: shadowsOn,
            layers,
            initialView: {
              position: view.position,
              verticalFov: VERTICAL_FOV,
              viewportHeight: viewHeight,
              direction: view.direction,
              aspect: viewWidth / viewHeight,
            },
            onError: (error, context) => report(error, `${context.layerId ?? 'elevation'} tile`),
          },
        );
        const stream = opened.stream;
        provideTunnelHeights(opened.source);
        parts.push(() => {
          stream.object.removeFromParent();
          stream.dispose();
        });
        renderer.worldRoot.add(stream.object);
        // Look ahead along the camera's track into the byte cache (bytes only, spare slots only).
        let prefetcher: EarthPrefetcher | undefined;
        if (options.byteCache !== undefined && options.prefetch !== false) {
          const header = await opened.archive.getHeader?.();
          const created = createEarthPrefetcher({
            descriptor: opened.descriptor,
            scheme: pkg.tileMatrix.scheme,
            archives: {
              elevation: {
                archive: opened.archive,
                maxLevel: Math.min(header?.maxZoom ?? Infinity, opened.descriptor.maxLevel),
              },
              ...sidecars,
            },
            metersPerUnit,
            budget: () => stream.getBudget(),
            resident: () => new Set(stream.residentTiles().map(terrainPyramidTileKey)),
            busy: () => {
              const loading = stream.loading();
              const limits = stream.getBudget();
              return (
                loading.tiles >= limits.maxConcurrentLoads ||
                loading.layers >= limits.maxConcurrentLayerLoads
              );
            },
            groundHeight: (x, z) => stream.sampleHeight(x, z),
            viewShape: () => {
              const [w, h] = viewport();
              return {
                verticalFov: VERTICAL_FOV,
                viewportHeight: canvas.height || h,
                aspect: w / h,
              };
            },
            ...(options.prefetch !== undefined ? { options: options.prefetch } : {}),
          });
          prefetcher = created;
          parts.push(() => created.dispose());
        }
        let ambient: EarthAmbient | undefined;
        let wildlife: EarthWildlife | undefined;
        let aircraft: EarthAircraft | undefined;
        const vehicles =
          content?.types !== undefined
            ? new EarthVehicles({
                root: stream.object,
                sampleHeight: (x, z) => stream.sampleHeight(x, z),
                loadModel,
                types: content.types,
                obstacles: (box, except) =>
                  (ambient?.blocks(box, except) ?? false) ||
                  (aircraft?.blocks(box, except) ?? false),
              })
            : undefined;
        if (vehicles !== undefined) parts.push(() => vehicles.dispose());
        if (vehicles !== undefined && content?.types !== undefined) {
          const flyable = new EarthAircraft({
            world: vehicles.world,
            root: stream.object,
            sampleHeight: (x, z, y) =>
              y === undefined
                ? stream.sampleHeight(x, z)
                : (sampleTerrainTunnel(stream.object, x, y, z)?.floor ?? stream.sampleHeight(x, z)),
            loadModel,
            types: content.types,
            vehicleEnvironment: vehicles.environment,
          });
          aircraft = flyable;
          parts.push(() => flyable.dispose());
        }
        if (ambientSettings !== undefined && ambientTiles !== undefined) {
          const created = new EarthAmbient({
            ...(vehicles !== undefined ? { world: vehicles.world } : {}),
            parent: stream.object,
            settings: ambientSettings,
            ...(ambientContent !== undefined ? { content: ambientContent } : {}),
            prepare: (object) => renderer.prepareObject(object),
            ground: (x, z) => stream.sampleHeight(x, z),
          });
          ambient = created;
          created.setBudget(ambientBudget());
          if (!ambientOn) created.setEnabled(false);
          ambientTiles.attach(created);
          parts.push(() => {
            ambientTiles.detach();
            created.dispose();
          });
        }
        if (
          wildlifeCover !== undefined &&
          wildlifeFeatures !== undefined &&
          worldgen?.environment !== undefined
        ) {
          const created = new EarthWildlife(
            worldgen.environment,
            stream.object,
            (object) => {
              void renderer.prepareObject(object);
            },
            pkg.surface?.seaLevel ?? 0,
          );
          wildlife = created;
          created.setBudget(ambientBudget());
          if (!ambientOn) created.setEnabled(false);
          wildlifeCover.attach(created.landcover);
          wildlifeFeatures.attach(created.features);
          parts.push(() => {
            wildlifeCover.detach();
            wildlifeFeatures.detach();
            created.dispose();
          });
        }
        return {
          frameLatitude,
          metersPerUnit,
          stream,
          prefetcher,
          surface,
          worldgen,
          vehicles,
          aircraft,
          ambient,
          wildlife,
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
    let sourceCheckedLatitude = frameLatitude;
    let sourceCheckedLongitude = options.camera.longitude;
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
    const orbit = new OrbitController(
      {
        ...orbitTarget(options.camera),
        range: options.camera.range ?? 3_000,
        heading: options.camera.heading ?? 0,
        pitch: options.camera.pitch ?? 0.6,
      },
      {
        maxRange: earthOrbitMaxRange(
          (automatic ? tier.terrain : terrainPyramidBudgetForQuality(quality())).viewDistance,
        ),
      },
    );
    let pose = orbit.update(0, input.read(0), environment);
    stack = await createStack(frameLatitude, pose);
    disposers.push(() => stack?.dispose());
    if (signal?.aborted) throw new DOMException('Earth view mount aborted', 'AbortError');

    const markers: MarkerLayer = createMarkerLayer(renderer, {
      groundHeight,
      fade: { near: 25_000, far: 60_000 },
      maxVisible: 256,
      // A city of photo pins would otherwise stack into an unreadable wall toward the horizon.
      declutter: true,
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
      terrainchange: new Set(),
      markerclick: new Set(),
      modechange: new Set(),
      message: new Set(),
      audioready: new Set(),
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
    // Scanning every visible mesh each frame is the walk mode's largest fixed cost; 5 Hz rescans
    // still catch streamed changes, and placement below forces a scan.
    const collision = new WalkCollision({ rescanIntervalMs: 200 });
    const look = { yaw: 0, pitch: 0 };

    const applyProfile = (): void => {
      input.setProfile(mode === 'fly' ? 'pilot' : mode);
      joystick?.setVisible(mode !== 'orbit');
      renderer.setCameraClip(mode === 'orbit' ? 1 : 0.05, 500_000);
    };
    const enterWalk = (x: number, z: number, yaw: number): void => {
      walker.reset(x, z);
      collision.clear();
      look.yaw = yaw;
      look.pitch = 0;
    };
    const aircraftTypes = content?.types !== undefined ? EarthAircraft.typeIds(content.types) : [];
    /** A car or aircraft `setMode` is waiting to board until its starting ground streams in. */
    let pending:
      | {
          mode: 'drive' | 'fly';
          x: number;
          z: number;
          heading: number;
          height: number;
          options: EarthModeOptions;
          since: number;
        }
      | undefined;
    const carTypes = content?.types !== undefined ? EarthVehicles.typeIds(content.types) : [];
    const defaultCar = carTypes.find((id) => /sedan/.test(id)) ?? carTypes[0];
    const compass = (heading: number): number =>
      ((heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    /** Where the viewer is: the ground point it stands on or looks at, and its heading. */
    const whereabouts = (
      current: EarthStack,
    ): { point: [number, number, number]; heading: number; height: number } => {
      if (mode === 'walk')
        return {
          point: [walker.feet.x, walker.feet.y, walker.feet.z],
          heading: compass(look.yaw + Math.PI / 2),
          height: WALK_EYE_HEIGHT,
        };
      if (mode === 'drive') {
        const position = current.vehicles?.position;
        if (position !== undefined)
          return { point: position, heading: current.vehicles?.heading ?? 0, height: 2 };
      }
      if (mode === 'fly') {
        const flight = current.aircraft?.status();
        const position = current.aircraft?.position;
        if (flight !== undefined && position !== undefined)
          return {
            point: [position[0], position[1] - flight.altitudeAGL, position[2]],
            heading: flight.heading,
            height: flight.altitudeAGL,
          };
      }
      const { target, heading } = orbit.state;
      return {
        point: [...target],
        heading,
        height: Math.max(0, pose.position[1] - target[1]),
      };
    };

    /**
     * Step out of the car or aircraft by its rules, or at once with `force`. Returns where the
     * viewer's feet are (undefined when not in a vehicle), or false when leaving was refused.
     */
    const leaveVehicle = (
      current: EarthStack,
      force: boolean,
    ): [number, number, number] | undefined | false => {
      if (mode === 'drive' && current.vehicles?.mountedId !== undefined) {
        const feet = current.vehicles.exit();
        if (feet !== undefined) return feet;
        if (!force) {
          emit('message', { text: current.vehicles?.message || 'Cannot leave the car here' });
          return false;
        }
        const at = current.vehicles?.release();
        return at === undefined ? undefined : [at[0], groundHeight(at[0], at[2]) ?? at[1], at[2]];
      }
      if (mode === 'fly' && current.aircraft?.mountedId !== undefined) {
        const feet = current.aircraft.exit();
        if (feet !== undefined) return feet;
        if (!force) {
          emit('message', { text: current.aircraft?.message || 'Cannot leave the aircraft here' });
          return false;
        }
        return current.aircraft?.release();
      }
      return undefined;
    };

    const setMode = (next: EarthViewMode, modeOptions: EarthModeOptions = {}): boolean => {
      if (next === mode) return true;
      const current = stack;
      if (current === undefined) return false;
      pending = undefined;
      const vehicles = current.vehicles;
      if ((next === 'drive' || next === 'fly') && vehicles === undefined) {
        emit('message', { text: 'Driving and flying need the entities content pack' });
        return false;
      }
      if (next === 'fly' && (current.aircraft === undefined || aircraftTypes.length === 0)) {
        emit('message', { text: 'No aircraft in the content packs' });
        return false;
      }
      const here = whereabouts(current);
      if (next === 'drive' && vehicles !== undefined) {
        // A parked car within reach of the walker comes first.
        if (mode === 'walk') {
          const eye: [number, number, number] = [
            walker.feet.x,
            walker.feet.y + WALK_EYE_HEIGHT,
            walker.feet.z,
          ];
          if (vehicles.enter(eye)) {
            vehicles.view = 'chase';
            return finishMode(next);
          }
        }
        if (modeOptions.vehicle === undefined) {
          emit('message', {
            text:
              vehicles.message ||
              (mode === 'walk' ? 'No car within reach' : 'Walk up to a parked car to drive it'),
          });
          return false;
        }
      }
      const left = leaveVehicle(current, modeOptions.force === true);
      if (left === false) return false;
      const feet: [number, number, number] = left ?? here.point;
      if (next === 'orbit') {
        orbit.set({
          target: [...feet],
          range: mode === 'fly' ? Math.max(600, Math.min(4_000, here.height * 2.5)) : 400,
          heading: here.heading,
          pitch: 0.5,
        });
        collision.clear();
      } else if (next === 'walk') {
        const yaw = here.heading - Math.PI / 2;
        if (left !== undefined && mode === 'drive') {
          walker.feet.fromArray(feet);
          walker.velocity.set(0, 0, 0);
          walker.ready = true;
          walker.grounded = true;
          walker.waitingForTerrain = false;
          look.yaw = yaw;
          look.pitch = 0;
        } else {
          enterWalk(feet[0], feet[2], yaw);
        }
      } else if (next === 'drive' || next === 'fly') {
        // A car needs the ground and the roads where it starts, an aircraft the ground below it.
        // Switch now, keep the orbit camera on the spot, and board once that has streamed in.
        let [x, z] = [feet[0], feet[2]];
        if (next === 'fly' && mode === 'orbit') {
          // Start a little way back along the heading, flying toward what the viewer looked at.
          const back = Math.min(900, here.height * 0.8);
          x -= Math.sin(here.heading) * back;
          z += Math.cos(here.heading) * back;
        }
        pending = {
          mode: next,
          x,
          z,
          heading: here.heading,
          height: here.height,
          options: modeOptions,
          // The frame clock, which completeEntry compares against.
          since: last,
        };
        if (mode !== 'orbit')
          orbit.set({
            target: [x, groundHeight(x, z) ?? feet[1], z],
            range: next === 'drive' ? 220 : 600,
            heading: here.heading,
            pitch: 0.5,
          });
      }
      return finishMode(next);
    };
    function finishMode(next: EarthViewMode): boolean {
      mode = next;
      applyProfile();
      emit('modechange', { mode });
      return true;
    }

    /**
     * Whether world X/Z lies on or beside a catalogued landmark: its model may still be streaming,
     * so the ground there is no place to leave a car.
     */
    const nearLandmark = (x: number, z: number): boolean => {
      const structures = content?.worldgen?.structures;
      if (structures === undefined) return false;
      const { latitude, longitude } = toLatLon(x, z);
      const dLat = 0.0015;
      const dLon = dLat / Math.max(0.1, Math.cos((latitude * Math.PI) / 180));
      for (const entry of structures.query([
        longitude - dLon,
        latitude - dLat,
        longitude + dLon,
        latitude + dLat,
      ])) {
        const box = entry.bounds;
        if (
          box !== undefined &&
          longitude >= box[0] &&
          longitude <= box[2] &&
          latitude >= box[1] &&
          latitude <= box[3]
        )
          return true;
        const [ax, az] = toWorld(entry.anchor[1], entry.anchor[0]);
        if (Math.hypot(ax - x, az - z) < 70) return true;
      }
      return false;
    };

    /** Board the car or aircraft a `setMode` asked for, once its starting ground has streamed. */
    const completeEntry = (current: EarthStack, now: number): void => {
      const entry = pending;
      if (entry === undefined) return;
      const waited = now - entry.since;
      const ground = groundHeight(entry.x, entry.z);
      const giveUp = (text: string): void => {
        pending = undefined;
        emit('message', { text });
        finishMode('orbit');
      };
      if (entry.mode === 'drive') {
        const vehicles = current.vehicles;
        if (vehicles === undefined) {
          giveUp('Driving needs the entities content pack');
          return;
        }
        // A mapped lane with known ground is enough; full detail can stream in while driving.
        // Lanes come from the ambient network: without one, or after a few seconds of waiting,
        // the car starts on open ground at the spot instead.
        const road =
          ground !== undefined ? current.ambient?.nearestRoad(entry.x, entry.z, 250) : undefined;
        const patience = current.ambient !== undefined ? 12_000 : 0;
        if (road === undefined && !(ground !== undefined && waited >= patience)) {
          if (waited > 30_000) giveUp('The streets here have not loaded yet');
          return;
        }
        pending = undefined;
        const kind = typeof entry.options.vehicle === 'string' ? entry.options.vehicle : defaultCar;
        const yaw = road?.yaw ?? Math.PI - entry.heading;
        const avoid = { avoid: nearLandmark };
        const id =
          kind === undefined
            ? undefined
            : road !== undefined
              ? (vehicles.spawn(kind, road.position, yaw) ??
                vehicles.spawnNear(kind, road.position[0], road.position[2], yaw, avoid))
              : vehicles.spawnNear(kind, entry.x, entry.z, yaw, avoid);
        if (id === undefined || !vehicles.board(id)) {
          giveUp(vehicles.message || 'No room for a car here');
          return;
        }
        vehicles.view = 'chase';
        return;
      }
      const aircraft = current.aircraft;
      if (aircraft === undefined) {
        giveUp('No aircraft in the content packs');
        return;
      }
      if (ground === undefined) {
        if (waited > 20_000) giveUp('The ground here has not loaded yet');
        return;
      }
      pending = undefined;
      const typeId =
        entry.options.aircraft !== undefined && aircraftTypes.includes(entry.options.aircraft)
          ? entry.options.aircraft
          : (aircraftTypes[0] as string);
      const airborne = entry.options.airborne ?? true;
      const choice = typeof airborne === 'object' ? airborne : {};
      const altitude =
        airborne === false
          ? 0
          : Math.max(60, choice.altitude ?? Math.max(150, Math.min(1_500, entry.height)));
      const id = aircraft.spawn(typeId, {
        position: [entry.x, ground + altitude, entry.z],
        heading: entry.heading,
        ...(airborne !== false
          ? { airborne: choice.speed !== undefined ? { speed: choice.speed } : {} }
          : {}),
      });
      if (!aircraft.board(id)) {
        aircraft.remove(id);
        giveUp(aircraft.message || 'Could not board the aircraft');
        return;
      }
      aircraft.view = 'chase';
    };

    // Adaptive quality. The view first calibrates with the controller's quick defaults, so a slow
    // device settles on a level it can hold within seconds. Once a level has held for
    // QUALITY_CALIBRATION_MS it turns sticky: every change swaps resolution and detail across the
    // whole view, so later ones need sustained overload (not one burst of streaming while the
    // camera turns) or a long spell of headroom.
    const maxQualityLevel = Math.max(0, Math.min(5, Math.floor(options.maxQualityLevel ?? 3)));
    if (automatic) level = Math.min(level, maxQualityLevel);
    let controller = new AdaptiveQualityController({
      initialLevel: level,
      maxLevel: maxQualityLevel,
    });
    let calibrated = false;
    let levelSince = performance.now();
    let qualityReason: AdaptiveQualityReason | undefined;
    const applyTier = (): void => {
      tier = earthPerformanceTier(level);
      lodPolicy.maxPixelError = automatic ? tier.objectPixelError : 2;
      const current = stack;
      if (current !== undefined) {
        const budget = terrainBudget();
        current.stream.setBudget(budget);
        current.viewDistance = budget.viewDistance;
        renderer.setShadowQuality(shadowQuality());
        orbit.setRangeLimits({ maxRange: earthOrbitMaxRange(budget.viewDistance) });
        current.worldgen?.setQuality(quality());
        current.ambient?.setBudget(ambientBudget());
        current.wildlife?.setBudget(ambientBudget());
        current.worldgen?.setCacheBudget(worldgenCacheBytes());
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
    let queuedAnchor: Readonly<{ latitude: number; longitude: number }> | undefined;
    const reanchor = (target: Readonly<{ latitude: number; longitude: number }>): void => {
      if (anchoring !== undefined || stack === undefined) {
        queuedAnchor = target;
        return;
      }
      const previous = stack;
      anchoring = (async () => {
        try {
          const selected =
            options.terrainSource !== undefined
              ? await options.terrainSource(target, sourceAbort.signal)
              : source;
          if (disposed || sourceAbort.signal.aborted) return;
          sourceCheckedLatitude = target.latitude;
          sourceCheckedLongitude = target.longitude;
          const sameSource =
            selected.key !== undefined && source.key !== undefined
              ? selected.key === source.key
              : selected.terrain === source.terrain &&
                selected.baseUrl === source.baseUrl &&
                selected.archives === source.archives;
          if (sameSource && Math.abs(target.latitude - frameLatitude) <= REANCHOR_DEGREES) return;
          // A newer jump may have moved the orbit during the host request. Rebase its latest
          // position, then process the queued destination after this stack is ready.
          const center = orbit.state;
          const ground = toLatLon(center.target[0], center.target[2]);
          previous.dispose();
          stack = undefined;
          source = selected;
          pkg = selected.terrain;
          frameLatitude = target.latitude;
          metersPerUnit = terrainPackageMetersPerUnit(pkg, { latitude: frameLatitude });
          const [x, z] = toWorld(ground.latitude, ground.longitude);
          orbit.set({ target: [x, center.target[1], z] });
          placeMarkers();
          pose = orbit.update(0, input.read(0), environment);
          const next = await createStack(frameLatitude, pose, selected);
          if (disposed) next.dispose();
          else {
            stack = next;
            emit('terrainchange', {
              ...(source.key !== undefined ? { key: source.key } : {}),
              credits: earthCredits([
                ...pkg.attribution,
                ...regionalEarthAttribution(content?.worldgen?.environment),
              ]),
            });
          }
        } catch (error) {
          report(error, 're-anchor');
        } finally {
          anchoring = undefined;
          if (queuedAnchor !== undefined && stack !== undefined && !disposed) {
            const next = queuedAnchor;
            queuedAnchor = undefined;
            reanchor(next);
          }
        }
      })();
    };

    let pendingAnchor: { latitude: number; longitude: number } | undefined;
    const camera = (): EarthCameraState => {
      const target =
        mode === 'orbit'
          ? orbit.state.target
          : mode === 'walk' || stack === undefined
            ? ([walker.feet.x, walker.feet.y, walker.feet.z] as [number, number, number])
            : whereabouts(stack).point;
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
    // A level change is held while the camera moves, since applying one rebuilds detail across
    // the view.
    // Frame work, where the browser can time the GPU: with both GPU and CPU work known, slow
    // frames while tiles stream in lower quality only when rendering itself is the cost. Without
    // GPU timing, CPU work alone would hide a GPU-bound device's overload, so neither is sent.
    const gpuTimer = automatic ? renderer.createGpuTimer?.() : undefined;
    disposers.push(() => gpuTimer?.dispose());
    let workMs = 0;
    let heldLevel: number | undefined;
    let heldReason: AdaptiveQualityReason | undefined;
    let heldSince = 0;
    let movedAt = Number.NEGATIVE_INFINITY;
    let lastPose = pose;

    const orbitFrame = (dt: number, frameInput: NavigationInput): NavigationPose => {
      const wasFlying = orbit.flying;
      const next = orbit.update(dt, frameInput, environment);
      if (wasFlying && !orbit.flying && pendingAnchor !== undefined) {
        reanchor(pendingAnchor);
        pendingAnchor = undefined;
      } else if (!orbit.flying && anchoring === undefined) {
        const ground = toLatLon(next.lookAt[0], next.lookAt[2]);
        if (
          Math.abs(ground.latitude - frameLatitude) > REANCHOR_DEGREES * 1.5 ||
          (options.terrainSource !== undefined &&
            (Math.abs(ground.latitude - sourceCheckedLatitude) > SOURCE_CHECK_DEGREES ||
              Math.abs(ground.longitude - sourceCheckedLongitude) > SOURCE_CHECK_DEGREES))
        )
          reanchor(ground);
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
      // Land once ground-level detail around the landing spot is on screen, not the whole view.
      // Placement must see everything that has streamed in there, not a tree up to 200 ms old.
      if (
        !walker.ready &&
        current.stream.isAreaReady(walker.feet.x, walker.feet.z, WALK_PLACEMENT_RADIUS)
      ) {
        collision.invalidate();
        collision.update(current.stream.object, walker.feet.x, walker.feet.z);
        walker.place(collision, groundHeight);
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
      // Auto hold: a car at rest with no throttle stays put, even parked on a slope.
      const holding = frameInput.move.forward === 0 && Math.abs(vehicles.speed) < 0.6;
      vehicles.update(dt, {
        throttle: frameInput.move.forward,
        steering: frameInput.move.right,
        brake: frameInput.jump || holding,
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

    const flyFrame = (
      dt: number,
      frameInput: NavigationInput,
      current: EarthStack,
    ): NavigationPose => {
      const aircraft = current.aircraft as EarthAircraft;
      const pilot = frameInput.pilot;
      if (frameInput.view > 0) aircraft.view = aircraft.view === 'cockpit' ? 'chase' : 'cockpit';
      const reach = aircraft.view === 'chase' ? Math.PI : 1.45;
      aircraft.lookYaw = Math.max(
        -reach,
        Math.min(reach, aircraft.lookYaw + frameInput.look[0] * 0.003),
      );
      aircraft.lookPitch = Math.max(
        -0.8,
        Math.min(0.8, aircraft.lookPitch - frameInput.look[1] * 0.003),
      );
      if ((pilot?.recover ?? 0) > 0 && !aircraft.recover())
        emit('message', { text: 'Recover (R) works after an impact' });
      aircraft.input(dt, {
        pitch: -frameInput.move.forward,
        roll: frameInput.move.right,
        yaw: pilot?.yaw ?? 0,
        throttle: pilot?.throttle ?? 0,
        brake: frameInput.jump,
        ...(pilot !== undefined
          ? { engine: pilot.engine, gear: pilot.gear, flaps: pilot.flaps }
          : {}),
      });
      // The aircraft shares the vehicles' world: this steps its flight model.
      current.vehicles?.update(dt, { throttle: 0, steering: 0, brake: true });
      aircraft.render();
      if (frameInput.interact > 0 && setMode('walk')) return walkFrame(0, frameInput, current);
      const view = aircraft.cameraPose();
      if (view === undefined) return pose;
      const direction = new THREE.Vector3()
        .fromArray(view.lookAt)
        .sub(new THREE.Vector3().fromArray(view.position))
        .normalize()
        .toArray() as [number, number, number];
      return { position: view.position, lookAt: view.lookAt, direction };
    };

    let audio: EarthAudio | undefined;
    let audioStack: EarthStack | undefined;
    if (options.audio !== false && content !== undefined) {
      void createEarthAudio(content.packs, renderer, options.audio ?? {})
        .then((started) => {
          if (disposed) started?.dispose();
          else if (started !== undefined) {
            audio = started;
            emit('audioready', {});
          }
        })
        .catch((error: unknown) => report(error, 'audio'));
      disposers.push(() => audio?.dispose());
    }

    // The square the sun's shadow covers: around the orbit target and sized to the view, or a
    // little ahead of the walker, car or aircraft, where most of the frame is.
    const shadowFocus = (
      current: NavigationPose,
    ): { center: [number, number, number]; radius: number } => {
      if (mode === 'orbit' || pending !== undefined) {
        const state = orbit.state;
        return {
          center: [state.target[0], state.target[1], state.target[2]],
          radius: Math.min(2_500, Math.max(150, state.range * 1.2)),
        };
      }
      const [x, y, z] = current.position;
      return earthShadowFocus(
        mode === 'walk' ? 'walk' : mode === 'drive' ? 'drive' : 'fly',
        current.position,
        current.direction,
        groundHeight(x, z) ?? y,
      );
    };

    const frame = (now: number): void => {
      frameHandle = requestAnimationFrame(frame);
      const frameMs = now - last;
      const dt = Math.min(0.1, Math.max(0, frameMs / 1000));
      last = now;
      const current = stack;
      const frameInput = input.read(dt);
      const workStart = performance.now();
      const gpuMs = gpuTimer?.poll();
      if (automatic && current !== undefined) {
        // stream.stats() walks every tile's objects; per frame, only the constant-time reads.
        const loading = current.stream.loading();
        const memoryPressure = current.stream.pressure().displayedBytes / memoryBudget;
        const change = controller.sample(frameMs, {
          active: !document.hidden,
          loading: loading.tiles > 0 || loading.layers > 0,
          memoryPressure,
          ...(gpuTimer !== undefined && workMs > 0 ? { cpuFrameMs: workMs } : {}),
          ...(gpuMs !== undefined ? { gpuFrameMs: gpuMs } : {}),
        });
        if (change !== undefined) {
          if (heldLevel === undefined) heldSince = now;
          heldLevel = change.level;
          heldReason = change.reason;
        }
        if (
          heldLevel !== undefined &&
          (now - movedAt >= QUALITY_SETTLE_MS ||
            now - heldSince >= QUALITY_HOLD_MAX_MS ||
            memoryPressure > URGENT_MEMORY_PRESSURE)
        ) {
          level = heldLevel;
          qualityReason = heldReason;
          heldLevel = undefined;
          levelSince = now;
          applyTier();
        } else if (
          !calibrated &&
          heldLevel === undefined &&
          now - levelSince >= QUALITY_CALIBRATION_MS
        ) {
          controller = new AdaptiveQualityController({
            initialLevel: level,
            maxLevel: maxQualityLevel,
            ...STICKY_QUALITY,
          });
          calibrated = true;
        }
      }
      if (pending !== undefined && current !== undefined) completeEntry(current, now);
      if (mode === 'orbit' || current === undefined || pending !== undefined)
        pose = orbitFrame(dt, frameInput);
      else if (mode === 'walk') pose = walkFrame(dt, frameInput, current);
      else if (mode === 'fly') pose = flyFrame(dt, frameInput, current);
      else pose = driveFrame(dt, frameInput, current);

      if (current !== undefined) {
        current.stream.updateTransitions(now);
        current.worldgen?.updateStructures({
          position: pose.position,
          direction: pose.direction,
          verticalFov: VERTICAL_FOV,
          viewportHeight: canvas.height,
          maxPixelError: automatic ? tier.objectPixelError : 2,
        });
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
        if (anchoring === undefined) {
          // A fly-to or a vehicle entry moves the camera fast for a moment; that is not travel.
          const steady = pending === undefined && !(mode === 'orbit' && orbit.flying);
          current.prefetcher?.frame(now, pose.position, pose.direction, steady);
        }
        current.vehicles?.sync(now, pose.position);
        current.ambient?.sync(
          now,
          pose,
          mode === 'walk' ? [{ x: pose.position[0], z: pose.position[2], radius: 0.5 }] : [],
        );
        if (pending !== undefined || (mode !== 'drive' && mode !== 'fly')) {
          current.vehicles?.update(dt, { throttle: 0, steering: 0, brake: true });
          current.aircraft?.render();
        }
        current.ambient?.update(dt);
        current.ambient?.render(pose.position, dt);
        current.wildlife?.update(dt, pose.position);
        current.surface.updateSignals(
          current.ambient
            ? current.ambient.world.tick / current.ambient.world.tickRate
            : now / 1000,
          current.ambient?.surfaceSignalColor,
        );
        updateEarthFog(fog, current.viewDistance, pose.position[1]);
      }
      for (const tap of frameInput.taps) {
        const id = markers.pick(tap.x, tap.y);
        if (id !== undefined) emit('markerclick', { id });
      }
      markers.update(pose.position);
      if (shadowsOn) renderer.setShadowFocus(shadowFocus(pose));
      viewer.setCamera({ position: pose.position, lookAt: pose.lookAt });
      if (audio !== undefined) {
        if (audioStack !== current) {
          audioStack = current;
          audio.attachWorld(current?.vehicles?.world);
        }
        const ground = groundHeight(pose.position[0], pose.position[2]);
        audio.update({
          nowMs: now,
          position: pose.position,
          forward: pose.direction,
          // The sound rules call flying an aircraft 'pilot'.
          mode: mode === 'fly' ? 'pilot' : mode,
          ...(current?.wildlife !== undefined
            ? { regionalAmbience: current.wildlife.ambience(pose.position) }
            : {}),
          ...(ground !== undefined ? { heightAboveGround: pose.position[1] - ground } : {}),
          ...(mode === 'walk' ? { grounded: walker.grounded } : {}),
        });
      }
      const origin = renderer.getWorldOrigin();
      setTerrainWaterTime(water, now / 1000, [origin[0], origin[2]]);
      setTerrainGroundOrigin(groundMaterial, [origin[0], origin[2]]);
      const timing = gpuTimer?.begin() === true;
      viewer.renderFrame();
      if (timing) gpuTimer?.end();
      frames++;
      workMs = performance.now() - workStart;
      if (
        Math.hypot(
          pose.position[0] - lastPose.position[0],
          pose.position[1] - lastPose.position[1],
          pose.position[2] - lastPose.position[2],
        ) > 0.05 ||
        pose.direction[0] * lastPose.direction[0] +
          pose.direction[1] * lastPose.direction[1] +
          pose.direction[2] * lastPose.direction[2] <
          0.99999
      )
        movedAt = now;
      lastPose = pose;
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

    /** Queue geographic points with the current stack's prefetcher (nothing without one). */
    const prefetchPoints = (
      points: readonly EarthPrefetchPoint[],
      prefetchSignal?: AbortSignal,
    ): Promise<EarthPrefetchResult> => {
      const current = stack;
      if (current?.prefetcher === undefined) {
        return Promise.resolve({ requested: 0, warmed: 0, failed: 0 });
      }
      const positions = points.map((point) => {
        const [x, z] = wgs84ToWorld(current.metersPerUnit, point.longitude, point.latitude);
        const y =
          point.altitude !== undefined ? point.altitude / current.metersPerUnit : pose.position[1];
        return [x, y, z];
      });
      return current.prefetcher.enqueue(positions, prefetchSignal);
    };
    return {
      viewer,
      input,
      get credits() {
        return earthCredits([
          ...pkg.attribution,
          ...regionalEarthAttribution(content?.worldgen?.environment),
        ]);
      },
      get mode() {
        return mode;
      },
      get audio() {
        return audio?.layer;
      },
      setMode,
      vehicleStatus() {
        const current = stack;
        if (current === undefined) return undefined;
        if (mode === 'fly') {
          const flight = current.aircraft?.status();
          return flight !== undefined ? { kind: 'aircraft', ...flight } : undefined;
        }
        if (mode === 'drive' && current.vehicles?.mountedId !== undefined) {
          const vehicles = current.vehicles;
          return {
            kind: 'car',
            label: vehicles.label(vehicles.mountedId as string),
            speed: vehicles.speed,
            heading: vehicles.heading ?? 0,
            view: vehicles.view,
            waitingForTerrain: vehicles.waiting,
          };
        }
        return undefined;
      },
      setThrottle(power) {
        stack?.aircraft?.setPower(power);
      },
      recover() {
        return mode === 'fly' && (stack?.aircraft?.recover() ?? false);
      },
      flyTo(target, flyOptions = {}) {
        if (mode !== 'orbit') setMode('orbit', { force: true });
        const far = Math.abs(target.latitude - frameLatitude) > REANCHOR_DEGREES;
        // Read the destination's terrain while the camera travels: same frame only (a far hop
        // re-anchors, and the new stack streams it), and only past what the view already holds.
        if (!far) {
          const from = camera();
          const [fx, fz] = toWorld(from.latitude, from.longitude);
          const [tx, tz] = toWorld(target.latitude, target.longitude);
          if (Math.hypot(tx - fx, tz - fz) * metersPerUnit > 1_000)
            void prefetchPoints([target]).catch(() => undefined);
        }
        pendingAnchor = far || options.terrainSource !== undefined ? target : undefined;
        orbit.flyTo(orbitTarget(target), flyOptions);
      },
      jumpTo(target) {
        if (mode !== 'orbit') setMode('orbit', { force: true });
        orbit.set(orbitTarget(target));
        if (
          Math.abs(target.latitude - frameLatitude) > REANCHOR_DEGREES ||
          options.terrainSource !== undefined
        )
          reanchor(target);
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
        while (anchoring !== undefined) await anchoring;
        await stack?.stream.whenIdle();
      },
      stats() {
        const streamStats = stack?.stream.stats();
        const renderStats = renderer.stats();
        return {
          mode,
          frames,
          qualityLevel: level,
          ...(qualityReason !== undefined ? { qualityReason } : {}),
          memoryPressure: (stack?.stream.pressure().displayedBytes ?? 0) / memoryBudget,
          displayedTiles: streamStats?.displayed ?? 0,
          loadingTiles: (streamStats?.loading ?? 0) + (streamStats?.loadingLayers ?? 0),
          failedTiles: (streamStats?.failed ?? 0) + (streamStats?.failedLayers ?? 0),
          maxDisplayedLevel: streamStats?.maxDisplayedLevel,
          markers: markers.ids().length,
          drawCalls: renderStats.drawCalls,
          triangles: renderStats.triangles,
          frameLatitude,
          ...(stack?.ambient !== undefined ? { ambient: stack.ambient.stats() } : {}),
          ...(stack?.wildlife !== undefined ? { wildlife: stack.wildlife.stats() } : {}),
          ...(stack?.worldgen?.structureStats()
            ? { structures: stack.worldgen.structureStats() }
            : {}),
          ...(stack?.worldgen !== undefined
            ? (() => {
                const generated = (stack.worldgen as EarthWorldgen).stats();
                return {
                  worldgen: {
                    tiles: generated.tiles,
                    buildings: generated.buildings,
                    standIns: generated.boxes,
                  },
                };
              })()
            : {}),
        };
      },
      cacheStats() {
        const prefetch = stack?.prefetcher?.stats();
        return {
          ...(options.byteCache !== undefined ? { cache: options.byteCache.stats() } : {}),
          ...(prefetch !== undefined ? { prefetch } : {}),
        };
      },
      prefetch: (points, prefetchOptions = {}) => prefetchPoints(points, prefetchOptions.signal),
      get ambientEnabled() {
        return ambientOn;
      },
      setAmbientEnabled(enabled) {
        if (ambientSettings === undefined) return;
        ambientOn = enabled;
        stack?.ambient?.setEnabled(enabled);
        stack?.wildlife?.setEnabled(enabled);
      },
      setPaused(next) {
        if (next === paused || disposed) return;
        paused = next;
        audio?.layer.setSuspended(paused);
        stack?.prefetcher?.setPaused(paused);
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
