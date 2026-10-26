import type { BoatEnvironment } from '@bendyline/molen-kernel/boats';
import type { LiveryData, LiveryVariant, WaterSettings } from '@bendyline/molen-schema';
import { selectLivery } from './liveries';
import { EARTH_WATER_CONDITIONS } from './water';
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
import { bindAircraftCockpitPointer } from '@bendyline/molen-client/aircraft';
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
  FollowController,
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
import type { FigureData } from '@bendyline/molen-figures/client';
import { Mountable, Mounted, vehicleLocalPoint } from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
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
  createTerrainPavementMaterialAsync,
  createTerrainSurfaceRenderer,
  createTerrainSurfaceWorkerPool,
  createTerrainWaterMaterialAsync,
  sampleTerrainTunnel,
  setTerrainGroundOrigin,
  setTerrainWaterTime,
  type TerrainPyramidBudget,
  type TerrainPyramidHeightSource,
  type TerrainPyramidStream,
  type TerrainPyramidTileLayer,
  type TerrainPyramidView,
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
import {
  createScatterMaterialAsync,
  type ScreenSpaceLodPolicy,
  type StructureStreamingOptions,
  type StructureStreamingStats,
} from '@bendyline/molen-worldgen/client';
import type { StructureTerrainSampler } from '@bendyline/molen-worldgen-earth/client';
import { isStructureViewingDate } from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  type EarthActorChange,
  EarthActorDirector,
  type EarthActorSettings,
  type EarthActors,
  type EarthActorViewer,
  type EarthAvatarFrame,
} from './actors';
import { EarthAircraft, type EarthFlightStatus } from './aircraft';
import { EarthAirfields, type EarthPlace } from './airfields';
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
import { EarthAudioTerrain, type EarthAudioTerrainSample } from './audio-terrain';
import type { EarthContent } from './content';
import { EarthDioramaDirector, type EarthDioramaOptions, type EarthDioramas } from './dioramas';
import { createEarthFleet, type EarthFleetOptions } from './fleet';
import {
  EARTH_EXPOSURE,
  EARTH_LIGHTING,
  EARTH_SHADOW_CASTER_HEIGHT,
  EARTH_SKY_PALETTE,
  EARTH_TONE_MAPPING,
  EARTH_WATER_COLOR,
  earthShadowFocus,
} from './look';
import {
  createEarthAdmissionGovernor,
  EARTH_CALIBRATION_QUALITY,
  EARTH_QUALITY_CALIBRATION_MS,
  EARTH_STICKY_QUALITY,
  earthAdmission,
  earthInitialQualityLevel,
  earthMemoryBudget,
  earthPerformanceTier,
  earthPixelRatio,
  earthQualityLevel,
  earthTerrainCacheBudget,
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
import { createEarthTilePreloader } from './preload';
import { createRegionalGroundColor } from './regional-ground';
import { createEarthRoadSigns } from './road-signs';
import { EarthVehicles } from './vehicles';
import { EarthWildlife, type EarthWildlifeStats } from './wildlife';
import {
  type CreateEarthWorldgenOptions,
  createEarthWorldgen,
  type EarthViewWorkers,
  type EarthWorldgen,
  generationWorkers,
} from './worldgen';

export type EarthViewMode = 'orbit' | 'walk' | 'drive' | 'fly';

/** How {@link EarthView.setMode} enters or leaves a vehicle. */
export interface EarthModeOptions {
  /**
   * Walk: start on foot at this place (facing `heading`) instead of the view center. A place far
   * from the metric frame re-anchors first and lands once that terrain has streamed in.
   */
  at?: EarthPlace;
  /**
   * Drive or fly: board this owned vehicle (see {@link EarthView.vehicles}). Within reach of its
   * door, or from anywhere with `force`.
   */
  board?: string;
  /**
   * Drive: add a car on a mapped road, or a boat type on nearby mapped water
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
      kind: 'car' | 'boat';
      anchored?: boolean;
      grounded?: boolean;
      label: string;
      /** The spec's name-free label ('Full-size pickup'), for a HUD that must not show the real name. */
      genericLabel?: string;
      /** The spec's generic body style ('pickup', 'suv', …), when it declares one. */
      bodyStyle?: string;
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

/** What the interact key (E) reaches on foot. */
export interface EarthInteractionSettings {
  /** Meters from the walker's eyes to an actor or pedestrian it can act on (default 2.5). */
  reach?: number;
  /** Offer ambient pedestrians too (`kind: 'pedestrian'`; default false). */
  pedestrians?: boolean;
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
  /** Regional road model diversity. Omitted uses the content pack's profiles, at most 16 types. */
  fleet?: EarthFleetOptions;
  /** Actors (see {@link EarthView.actors}): how many near the viewer walk with full collision. */
  actors?: EarthActorSettings;
  /** Bounded scripted set pieces. Content loads only while nearby and scheduled active. */
  dioramas?: EarthDioramaOptions;
  /** What the interact key (E) reaches on foot; change it later with {@link EarthView.setInteraction}. */
  interaction?: EarthInteractionSettings;
  /** The first view. */
  camera: EarthCameraTarget;
  /** `'auto'` adapts to measured frame times (default). */
  quality?: 'auto' | TerrainQualityPreset;
  /** Worker factories; each piece of work runs in-thread without its worker. */
  workers?: EarthViewWorkers;
  /** Seeded synthetic homes where street density suggests missing outlines (default true). */
  buildingInfill?: CreateEarthWorldgenOptions['buildingInfill'];
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
  /** Authored swell/current. Defaults to mild coastal chop; waves: [] gives calm water. */
  water?: WaterSettings;
  /** Optional measured water coverage/depth in absolute metric coordinates of the current frame. */
  waterAt?: BoatEnvironment['waterAt'];
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

/** One rendered frame, for hosts that run their own logic against the view. */
export interface EarthFrame {
  /** Seconds since the previous frame (capped at 0.1). */
  dt: number;
  /** The frame clock, ms (`performance.now()` based). */
  now: number;
  mode: EarthViewMode;
  /**
   * Where the viewer is: the walker's feet, the car, the aircraft, or the orbit target. Altitude
   * is meters above sea level of that point (the aircraft itself while flying); heading is a
   * compass bearing in radians; speed in m/s (0 in orbit).
   */
  viewer: { latitude: number; longitude: number; altitude: number; heading: number; speed: number };
}

/** The walker as {@link EarthWalker.pose} reports it. */
export interface EarthWalkerPose {
  latitude: number;
  longitude: number;
  /** Feet height above sea level, meters. */
  altitude: number;
  /** Compass heading the walker faces, radians. */
  heading: number;
  /** Horizontal speed, m/s. */
  speed: number;
  grounded: boolean;
}

/** On-foot control beyond `setMode('walk')`. */
export interface EarthWalker {
  /** Teleport the walker to a place (entering walk mode if needed); far places re-anchor first. */
  place(at: EarthPlace): void;
  /** The walker's pose, or undefined when not walking. */
  pose(): EarthWalkerPose | undefined;
  /** Standing on streamed ground (false while the walk start is still loading). */
  readonly ready: boolean;
  /**
   * Give the viewer a body: a figure descriptor, or `{ type }` naming an entity type with a
   * `figure` component. It is drawn on foot in the third-person view and seated in a vehicle's
   * chase view; never in first person or a cockpit. `undefined` removes it (the default).
   */
  setAvatar(avatar: { figure: FigureData } | { type: string } | undefined): void;
  /**
   * First person (the default) or a camera behind the walker's feet. V toggles between them while
   * walking with an avatar. Movement stays relative to the camera either way.
   */
  setView(view: 'first' | 'third'): void;
  readonly view: 'first' | 'third';
}

/** A vehicle a host adds and keeps: see {@link EarthView.vehicles}. */
export interface EarthVehicleSpec {
  /** Stable id (default `owned-<kind>-<n>`); also the entity id, so it must be unique. */
  id?: string;
  /** Entity type: a car (`vehicle`), boat (`boat`) or aircraft (`aircraft`) from the content packs. */
  type: string;
  latitude: number;
  longitude: number;
  /** Compass heading of the nose, radians. */
  heading: number;
  /** Paint for a car's `paintMaterial` (CSS color). */
  color?: string;
  /** A variant from the type's livery component. */
  livery?: string;
  /** Aircraft: start flying at `altitude` meters above the ground (default 300) and `speed` m/s. */
  airborne?: boolean | { altitude?: number; speed?: number };
}

/** Where an owned vehicle is, from its entity while placed or from its last known place. */
export interface EarthVehiclePose {
  kind: 'car' | 'boat' | 'aircraft';
  type: string;
  latitude: number;
  longitude: number;
  /** Meters above sea level (the ground it stands on while parked). */
  altitude: number;
  /** Compass heading, radians. */
  heading: number;
  /** m/s. */
  speed: number;
  /** The viewer is aboard. */
  occupied: boolean;
  /** Its entity exists in the current terrain frame (false while its ground has not streamed). */
  placed: boolean;
}

/**
 * Vehicles the host owns: added at a place, kept through drives, flights and re-anchors until
 * removed, and never removed by stepping out. Placement waits for the ground under them to stream.
 */
export interface EarthOwnedVehicles {
  /** Add a car, boat or aircraft. Throws for unsupported types or an occupied id. */
  spawn(spec: EarthVehicleSpec): string;
  list(): readonly string[];
  pose(id: string): EarthVehiclePose | undefined;
  /** Board (drive or fly) an owned vehicle: within reach of it, or from anywhere with `force`. */
  board(id: string, options?: { force?: boolean }): boolean;
  /** Step out of whatever the viewer is in, at once; owned vehicles stay where they are. */
  release(): void;
  remove(id: string): void;
  /** Available livery recipes for this owned vehicle. */
  liveries(id: string): readonly LiveryVariant[];
  /** Select a livery for a car, boat or aircraft; retained across terrain re-anchors. */
  setLivery(id: string, selected: string): void;
  /** Repaint a car's base paint. */
  setColor(id: string, color: string): void;
  /** Resolves once the vehicle's entity is placed; rejects on abort, removal or when it cannot be placed. */
  whenPlaced(id: string, options?: { signal?: AbortSignal }): Promise<void>;
}

/** What the interact key (E) would act on: see {@link EarthView.interactable}. */
export interface EarthInteractable {
  /**
   * `vehicle`: a parked car or aircraft within reach on foot, or the one the viewer is in.
   * `actor`: an interactable actor within reach and in sight. `pedestrian`: an ambient
   * pedestrian (with `interaction.pedestrians`; `view.actors.adopt(id)` makes it an actor).
   */
  kind: 'actor' | 'vehicle' | 'pedestrian' | 'none';
  id?: string;
  /** Meters from the viewer, on foot. */
  distance?: number;
}

/** The interact key was pressed. A handler that `claim()`s it keeps the view's own action from running. */
export interface EarthInteraction extends EarthInteractable {
  claim(): void;
}

export interface EarthViewEvents {
  /** Every rendered frame, before the camera is set, for host logic (markers, HUD, game rules). */
  frame: EarthFrame;
  /** The interact key (E) was pressed; see {@link EarthInteraction.claim}. */
  interact: EarthInteraction;
  /** An actor was added or removed, arrived, boarded, alighted, got stuck or teleported. */
  actorchange: EarthActorChange;
  /** An owned vehicle was placed, boarded, left, painted, removed, or could not be placed. */
  vehiclechange: {
    id: string;
    change: 'placed' | 'boarded' | 'left' | 'painted' | 'removed' | 'blocked';
    reason?: string;
  };
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
  /** Future-view tiles selected for preparation, and those ready for arrival. */
  preloadingTiles: number;
  preloadedTiles: number;
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
  /** Register geographic set pieces; no content is fetched until one is nearby. */
  readonly dioramas: EarthDioramas;
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
  /** World meters (X/Z) of a place in the current metric frame; valid until the next `terrainchange`. */
  toWorld(latitude: number, longitude: number): [x: number, z: number];
  /** The place at world X/Z in the current metric frame. */
  toGeo(x: number, z: number): { latitude: number; longitude: number };
  /** Ground height at a place, meters above sea level, or undefined until that terrain has streamed. */
  groundHeight(latitude: number, longitude: number): number | undefined;
  /** On-foot control: teleport and pose. */
  readonly walker: EarthWalker;
  /** Vehicles the host owns. */
  readonly vehicles: EarthOwnedVehicles;
  /** Companions and NPCs: figures the host adds, steered by simple behaviours. */
  readonly actors: EarthActors;
  /** Runways and aerodromes from the streamed map around the viewer (see the Airfields guide). */
  readonly airfields: EarthAirfields;
  /** What the interact key would act on right now (for a "Press E" prompt). */
  interactable(): EarthInteractable;
  /**
   * Change what the interact key reaches on foot, e.g. offer pedestrians only while a game that
   * talks to them is running (unclaimed, a pedestrian press does nothing, so a nearer pedestrian
   * would otherwise keep E from boarding a car). Unset fields keep their current value.
   */
  setInteraction(settings: EarthInteractionSettings): void;
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
/** The entity that stands for the viewer in the shared world (seats, avatar). */
const PLAYER_ID = 'world-player';
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
  /** The ECS world vehicles, aircraft and ambient life share; stepped once per frame. */
  world: World;
  stepWorld(dt: number): void;
  stream: TerrainPyramidStream;
  prefetcher: EarthPrefetcher | undefined;
  surface: TerrainSurfaceRenderer;
  worldgen: EarthWorldgen | undefined;
  vehicles: EarthVehicles | undefined;
  aircraft: EarthAircraft | undefined;
  ambient: EarthAmbient | undefined;
  wildlife: EarthWildlife | undefined;
  audioTerrain: EarthAudioTerrain;
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
      ...earthTerrainCacheBudget(base, memoryBudget),
      peripheralDegrees: PERIPHERAL_DEGREES,
      peripheralDetail: PERIPHERAL_DETAIL,
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
    admission: earthAdmission(options.backend ?? 'webgl', false),
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
    // Shadows on once before anything is built: lit shaders are then built for them, and a tier
    // without shadows parks the map instead of rebuilding every shader in view mid-flight.
    if (shadowsOn) {
      renderer.setShadowQuality('medium');
      renderer.setShadowQuality('off');
    }
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
        swells: (options.water ?? EARTH_WATER_CONDITIONS).waves ?? [],
        waveScale: 0.028,
        waveStrength: 0.045,
        waveSpeed: 0.5,
      },
      renderer.backend,
    );
    disposers.push(() => water.dispose());
    // Both surfaces use world-space variation; only landcover carries crop-row attributes.
    const groundMaterial = await createTerrainGroundMaterialAsync({}, renderer.backend);
    disposers.push(() => groundMaterial.dispose());
    const fieldMaterial = await createTerrainGroundMaterialAsync(
      { agriculture: true },
      renderer.backend,
    );
    disposers.push(() => fieldMaterial.dispose());
    // Roads, sidewalks, markings and lots: asphalt, concrete slabs and worn paint.
    const pavementMaterial = await createTerrainPavementMaterialAsync({}, renderer.backend);
    disposers.push(() => pavementMaterial.dispose());
    // Trees, shrubs and props: leaf speckle and crown occlusion.
    const scatterMaterial = await createScatterMaterialAsync(renderer.backend);
    disposers.push(() => scatterMaterial.dispose());
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
      joystick = createTouchJoystick(options.touchJoystickContainer, input.map, {
        focusTarget: canvas,
      });
      joystick.setVisible(false);
      disposers.push(() => joystick?.dispose());
    }

    const lodPolicy: ScreenSpaceLodPolicy = {
      viewportHeight: height,
      maxPixelError: tier.objectPixelError,
    };
    const loadModel = async (id: string, signal?: AbortSignal): Promise<THREE.Object3D> => {
      if (content === undefined) throw new Error('no content packs');
      return (
        await new GLTFLoader().parseAsync(
          await content.packs.readBytes(id, signal ? { signal } : undefined),
          '',
        )
      ).scene;
    };

    let stack: EarthStack | undefined;
    const cockpitPointer = bindAircraftCockpitPointer({
      element: canvas,
      camera: renderer.camera,
      session: () => (mode === 'fly' ? stack?.aircraft?.cockpitSession() : undefined),
    });
    disposers.push(() => cockpitPointer.dispose());
    // One map-tile decoder for every stack the view anchors, started with the first.
    let semanticWorker: Worker | undefined;
    const semanticDecoderWorker = (): Worker | undefined =>
      (semanticWorker ??= options.workers?.semantic?.());
    disposers.push(() => semanticWorker?.terminate());
    const groundHeight = (x: number, z: number): number | undefined =>
      stack?.stream.sampleHeight(x, z);
    const ambientSettings = options.ambient === false ? undefined : (options.ambient ?? {});
    let ambientOn = ambientSettings !== undefined;
    const ambientContent =
      content?.types !== undefined
        ? ambientContentFromTypes(content.types, async (id, signal) => {
            try {
              return await loadModel(id, signal);
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
      const fleet =
        content?.fleet && ambientContent
          ? createEarthFleet(
              content.fleet,
              ambientContent.types.car ?? [],
              content.parkedVehicles,
              metersPerUnit,
              options.fleet,
            )
          : undefined;
      const roadSigns = content?.roadSigns
        ? createEarthRoadSigns(content.roadSigns, metersPerUnit)
        : undefined;
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
            ? createTerrainSurfaceWorkerPool(
                Array.from({ length: generationWorkers() }, options.workers.surface),
              )
            : undefined;
        const surface = createTerrainSurfaceRenderer(
          {
            style: 'modern',
            ...(ambientSettings?.drivingSide ? { drivingSide: ambientSettings.drivingSide } : {}),
            fonts: content?.fonts,
            routeShields: content?.roadSigns?.shields,
            details: {
              preferMappedProps: content?.worldgen !== undefined,
              parkedVehicles: content?.parkedVehicles ?? [],
              ...surfaceBudgets(quality(), automatic ? tier.surfaceScale : 1),
            },
          },
          surfaceWorker,
          fleet?.parkedAt,
          roadSigns?.profileAt,
        );
        surface.setMaterial(pavementMaterial);
        parts.push(() => surface.dispose());
        const worldgen =
          content?.worldgen !== undefined
            ? createEarthWorldgen({
                ...(options.buildingInfill !== undefined
                  ? { buildingInfill: options.buildingInfill }
                  : {}),
                ...(options.viewingDate !== undefined ? { viewingDate: options.viewingDate } : {}),
                ...(options.vegetationMonth !== undefined
                  ? { vegetationMonth: options.vegetationMonth }
                  : {}),
                ...(options.style?.landcover !== undefined
                  ? { landcoverColors: options.style.landcover }
                  : {}),
                groundMaterial: fieldMaterial,
                modelMaterial: scatterMaterial,
                ...(options.sampleStructureTerrain
                  ? { sampleStructureTerrain: options.sampleStructureTerrain }
                  : {}),
                content: content.worldgen,
                assets: content.assets,
                surfaceRenderer: surface,
                metersPerUnit,
                quality: quality(),
                // WebGL pays full price for every building and plant draw; the WebGPU path
                // affords High's full scene, WebGL keeps a compact one.
                compact: renderer.backend === 'webgl',
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
                prepareMaterialChange: (current, next) =>
                  renderer.prepareMaterialChange(current, next),
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
        const audioTerrain = new EarthAudioTerrain();
        parts.push(() => audioTerrain.clear());
        const wildlifeWanted =
          ambientSettings !== undefined &&
          ambientSettings.wildlife !== false &&
          (worldgen?.environment?.library.animals.size ?? 0) > 0;
        const wildlifeCover = wildlifeWanted ? new SemanticTileBuffer() : undefined;
        const wildlifeFeatures = wildlifeWanted ? new SemanticTileBuffer() : undefined;
        if (pkg.landcover !== undefined || pkg.features !== undefined) {
          try {
            const decoderWorker = semanticDecoderWorker();
            const semantic = await createProfiledTerrainPackageSemanticLayers(pkg, {
              admission: renderer.admission,
              ...(decoderWorker !== undefined ? { decoderWorker } : {}),
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
                renderer: observeSemanticTiles(
                  createDefaultTerrainSemanticRenderer({
                    renderLandcover: false,
                    renderTransportation: false,
                    renderBuildings: false,
                    materials: { water },
                    waterOffset: 0.65,
                    // Earth packages have a sea: harbors and coasts draw at one flat level.
                    ...(pkg.coordinateSpace.kind === 'geospatial' ||
                    pkg.surface?.seaLevel !== undefined
                      ? { seaLevel: pkg.surface?.seaLevel ?? 0 }
                      : {}),
                  }),
                  audioTerrain.observer,
                ),
              },
              landcoverLayer:
                worldgen !== undefined
                  ? {
                      visible: true,
                      renderer:
                        wildlifeCover !== undefined
                          ? observeSemanticTiles(
                              observeSemanticTiles(worldgen.classification, wildlifeCover),
                              audioTerrain.observer,
                            )
                          : observeSemanticTiles(worldgen.classification, audioTerrain.observer),
                    }
                  : {
                      visible: true,
                      renderer: observeSemanticTiles(
                        createDefaultTerrainSemanticRenderer({
                          renderWater: false,
                          renderTransportation: false,
                          renderBuildings: false,
                        }),
                        audioTerrain.observer,
                      ),
                    },
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
                  renderer: observeSemanticTiles(
                    ambientTiles !== undefined ? observeSemanticTiles(inner, ambientTiles) : inner,
                    audioTerrain.observer,
                  ),
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
            shadowCasterHeight: EARTH_SHADOW_CASTER_HEIGHT,
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
        // One world for everything that moves: cars, aircraft and ambient life. The frame loop
        // steps it once (stepWorld); each piece applies its inputs before and poses models after.
        const world = new World({ tickRate: 60, seed: 'earth', devFreeze: false });
        let accumulator = 0;
        const stepWorld = (dt: number): void => {
          accumulator = Math.min(accumulator + Math.min(0.1, Math.max(0, dt)), world.dt * 3);
          while (accumulator >= world.dt) {
            world.step();
            accumulator -= world.dt;
          }
        };
        let ambient: EarthAmbient | undefined;
        let wildlife: EarthWildlife | undefined;
        let aircraft: EarthAircraft | undefined;
        const vehicles =
          content?.types !== undefined
            ? new EarthVehicles({
                world,
                root: stream.object,
                sampleHeight: (x, z) => stream.sampleHeight(x, z),
                loadModel,
                types: content.types,
                water: options.water ?? EARTH_WATER_CONDITIONS,
                ...(options.waterAt ? { waterAt: options.waterAt } : {}),
                obstacles: (box, except) =>
                  (ambient?.blocks(box, except) ?? false) ||
                  (aircraft?.blocks(box, except) ?? false),
              })
            : undefined;
        if (vehicles !== undefined) parts.push(() => vehicles.dispose());
        if (vehicles !== undefined && content?.types !== undefined) {
          const flyable = new EarthAircraft({
            world,
            root: stream.object,
            sampleHeight: (x, z, y) =>
              y === undefined
                ? stream.sampleHeight(x, z)
                : (sampleTerrainTunnel(stream.object, x, y, z)?.floor ?? stream.sampleHeight(x, z)),
            loadModel,
            types: content.types,
            vehicleEnvironment: vehicles.environment,
            prepare: (object) => renderer.prepareObject(object),
          });
          aircraft = flyable;
          parts.push(() => flyable.dispose());
        }
        if (ambientSettings !== undefined && ambientTiles !== undefined) {
          const created = new EarthAmbient({
            world,
            parent: stream.object,
            settings: ambientSettings,
            ...(roadSigns ? { drivingSideAt: roadSigns.drivingSideAt } : {}),
            ...(fleet ? { carsAt: fleet.carsAt } : {}),
            ...(ambientContent !== undefined ? { content: ambientContent } : {}),
            prepare: (object) => renderer.prepareObject(object),
            admission: renderer.admission,
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
          world,
          stepWorld,
          stream,
          prefetcher,
          surface,
          worldgen,
          vehicles,
          aircraft,
          ambient,
          wildlife,
          audioTerrain,
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
      frame: new Set(),
      interact: new Set(),
      actorchange: new Set(),
      vehiclechange: new Set(),
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
    // Third person: a chase camera behind the walker's feet (see EarthWalker.setView).
    let walkView: 'first' | 'third' = 'first';
    const follow = new FollowController({ distance: 4.5, height: 1.9, lookHeight: 1.4 });

    const applyProfile = (): void => {
      input.setProfile(mode === 'fly' ? 'pilot' : mode);
      joystick?.setVisible(mode !== 'orbit');
      renderer.setCameraClip(mode === 'orbit' ? 1 : 0.05, 500_000);
    };
    const enterWalk = (x: number, z: number, yaw: number): void => {
      walker.reset(x, z);
      collision.clear();
      follow.reset();
      look.yaw = yaw;
      look.pitch = 0;
    };
    const aircraftTypes = content?.types !== undefined ? EarthAircraft.typeIds(content.types) : [];
    /**
     * A car or aircraft `setMode` is waiting to board until its starting ground streams in, or a
     * far walk start is waiting for its frame to re-anchor.
     */
    /** A `setMode` that arrived while the frame was being rebuilt; applied once it is up. */
    let deferredMode: { next: EarthViewMode; options: EarthModeOptions } | undefined;
    let pending:
      | {
          mode: 'drive' | 'fly' | 'walk';
          x: number;
          z: number;
          heading: number;
          height: number;
          options: EarthModeOptions;
          since: number;
          /** Walk: the geographic start, re-projected once the frame has moved. */
          at?: EarthPlace;
        }
      | undefined;
    const carTypes = content?.types !== undefined ? EarthVehicles.typeIds(content.types) : [];
    const boatTypes = content?.types !== undefined ? EarthVehicles.boatTypeIds(content.types) : [];
    const defaultCar = carTypes.find((id) => /sedan/.test(id)) ?? carTypes[0];
    const compass = (heading: number): number =>
      ((heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Owned vehicles: a geographic registry outside the stack. Entities are placed when the ground
    // under them is known and re-placed from their last known place after a re-anchor, so a host
    // can leave its car at the airport, fly across a continent, and find it there on return.
    interface OwnedEntry {
      id: string;
      type: string;
      kind: 'car' | 'boat' | 'aircraft';
      geo: { latitude: number; longitude: number; heading: number; altitude: number | undefined };
      color: string | undefined;
      livery: string | undefined;
      airborne: EarthVehicleSpec['airborne'];
      placed: boolean;
      blocked: boolean;
      /** Frame clock of the first placement attempt in this frame anchor. */
      since: number;
      /** Frame clock before which placement is not retried (after a blocked spot). */
      nextAttempt: number;
      waiters: Array<{ resolve: () => void; reject: (error: Error) => void }>;
    }
    const owned = new Map<string, OwnedEntry>();
    let ownedSequence = 0;
    let ownedSyncAt = Number.NEGATIVE_INFINITY;
    let airfieldsTickAt = Number.NEGATIVE_INFINITY;
    const ownedKind = (type: string): 'car' | 'boat' | 'aircraft' | undefined =>
      aircraftTypes.includes(type)
        ? 'aircraft'
        : boatTypes.includes(type)
          ? 'boat'
          : carTypes.includes(type)
            ? 'car'
            : undefined;
    const settleOwned = (entry: OwnedEntry, error?: Error): void => {
      const waiters = entry.waiters.splice(0);
      for (const waiter of waiters) error === undefined ? waiter.resolve() : waiter.reject(error);
    };
    /** Refresh an owned entry's place from its entity (while placed). */
    const syncOwnedEntry = (current: EarthStack, entry: OwnedEntry): void => {
      if (!entry.placed) return;
      const pose =
        entry.kind !== 'aircraft'
          ? current.vehicles?.pose(entry.id)
          : current.aircraft?.pose(entry.id);
      if (pose === undefined) {
        // Removed from under us (e.g. a host called into the stack directly): place it again.
        entry.placed = false;
        entry.since = last;
        return;
      }
      const geo = toLatLon(pose.position[0], pose.position[2]);
      entry.geo = {
        latitude: geo.latitude,
        longitude: geo.longitude,
        heading: 'heading' in pose ? pose.heading : compass(Math.PI - pose.yaw),
        altitude: pose.position[1],
      };
    };
    const syncOwned = (current: EarthStack, now: number, force = false): void => {
      if (!force && now - ownedSyncAt < 200) return;
      ownedSyncAt = now;
      for (const entry of owned.values()) syncOwnedEntry(current, entry);
    };
    /** Before a stack goes away: remember where everything is, and place it again in the next. */
    const unplaceOwned = (previous: EarthStack): void => {
      syncOwned(previous, last, true);
      for (const entry of owned.values()) {
        entry.placed = false;
        entry.blocked = false;
        entry.nextAttempt = 0;
        entry.since = last;
      }
    };
    const blockOwned = (entry: OwnedEntry, now: number, reason: string): void => {
      entry.nextAttempt = now + 5_000;
      if (entry.blocked) return;
      entry.blocked = true;
      emit('vehiclechange', { id: entry.id, change: 'blocked', reason });
      settleOwned(entry, new Error(`Vehicle ${entry.id} could not be placed: ${reason}`));
    };
    /** Place owned vehicles whose ground has streamed in (every frame; cheap when all are placed). */
    const placeOwned = (current: EarthStack, now: number): void => {
      for (const entry of owned.values()) {
        if (entry.placed || now < entry.nextAttempt) continue;
        const [x, z] = toWorld(entry.geo.latitude, entry.geo.longitude);
        const water =
          entry.kind === 'boat' ? current.vehicles?.boatEnvironment.waterAt(x, z) : undefined;
        const ground = entry.kind === 'boat' ? water?.height : groundHeight(x, z);
        // Unknown coverage waits for streaming; known dry ground must eventually reject placement.
        if (ground === undefined) {
          if (water === null && now - entry.since > 12_000)
            blockOwned(entry, now, 'No mapped water at this place');
          continue;
        }
        const spot: [number, number, number] = [x, ground, z];
        if (entry.kind !== 'aircraft') {
          const vehicles = current.vehicles;
          if (vehicles === undefined) {
            blockOwned(entry, now, 'driving needs the entities content pack');
            continue;
          }
          const spawnOptions = {
            id: entry.id,
            retain: true,
            ...(entry.color !== undefined ? { color: entry.color } : {}),
            ...(entry.livery !== undefined ? { livery: entry.livery } : {}),
          };
          const yaw = Math.PI - entry.geo.heading;
          const placed =
            vehicles.spawn(entry.type, spot, yaw, spawnOptions) ??
            vehicles.spawnNear(entry.type, x, z, yaw, {
              radius: 30,
              avoid: nearLandmark,
              ...spawnOptions,
            });
          if (placed === undefined) {
            blockOwned(entry, now, vehicles.message || 'no room');
            continue;
          }
        } else {
          const aircraft = current.aircraft;
          if (aircraft === undefined) {
            blockOwned(entry, now, 'flying needs the entities content pack');
            continue;
          }
          const airborne = entry.airborne ?? false;
          const choice = typeof airborne === 'object' ? airborne : {};
          const altitude = airborne === false ? 0 : Math.max(60, choice.altitude ?? 300);
          aircraft.spawn(
            entry.type,
            {
              position: [x, ground + altitude, z],
              heading: entry.geo.heading,
              ...(airborne !== false
                ? { airborne: choice.speed !== undefined ? { speed: choice.speed } : {} }
                : {}),
            },
            {
              id: entry.id,
              retain: true,
              ...(entry.livery !== undefined ? { livery: entry.livery } : {}),
            },
          );
          // A flight placed once is parked after that: nobody flies it while the host is away.
          entry.airborne = undefined;
        }
        entry.placed = true;
        entry.blocked = false;
        settleOwned(entry);
        emit('vehiclechange', { id: entry.id, change: 'placed' });
      }
    };

    /** Where the viewer is: the ground point it stands on or looks at, and its heading. */
    const whereabouts = (
      current: EarthStack,
    ): { point: [number, number, number]; heading: number; height: number } => {
      // A walk start waiting for its frame has no feet yet (they are still in the old frame): the
      // orbit camera holds over the destination, so report that below.
      if (mode === 'walk' && pending === undefined)
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
      const wasIn =
        mode === 'drive'
          ? current.vehicles?.mountedId
          : mode === 'fly'
            ? current.aircraft?.mountedId
            : undefined;
      const result = stepOut(current, force);
      const entry = wasIn !== undefined ? owned.get(wasIn) : undefined;
      if (result !== false && entry !== undefined) {
        syncOwnedEntry(current, entry);
        emit('vehiclechange', { id: entry.id, change: 'left' });
      }
      return result;
    };
    const stepOut = (
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

    /** Whether a place lies outside the current metric frame (or the host's terrain region). */
    const farFromFrame = (at: { latitude: number; longitude: number }): boolean =>
      Math.abs(at.latitude - frameLatitude) > REANCHOR_DEGREES ||
      (options.terrainSource !== undefined &&
        (Math.abs(at.latitude - sourceCheckedLatitude) > SOURCE_CHECK_DEGREES ||
          Math.abs(at.longitude - sourceCheckedLongitude) > SOURCE_CHECK_DEGREES));

    const setMode = (next: EarthViewMode, modeOptions: EarthModeOptions = {}): boolean => {
      if (
        next === mode &&
        modeOptions.board === undefined &&
        modeOptions.at === undefined &&
        modeOptions.vehicle === undefined
      ) {
        // Asking for the mode the view is in cancels a switch still waiting on a re-anchor.
        deferredMode = undefined;
        return true;
      }
      const current = stack;
      if (current === undefined) {
        // The metric frame is being rebuilt after a long jump: there is no ground or walker to
        // switch onto yet. Keep the newest request and apply it once the new frame is up, instead
        // of dropping it (a host that jumps far and then walks there would otherwise stay in orbit).
        if (anchoring === undefined) return false;
        deferredMode = { next, options: { ...modeOptions } };
        return true;
      }
      deferredMode = undefined;
      pending = undefined;
      if (modeOptions.board !== undefined && (next === 'drive' || next === 'fly'))
        return boardOwned(current, next, modeOptions.board, modeOptions.force === true);
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
        if (mode === 'walk' && typeof modeOptions.vehicle !== 'string') {
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
        const at = modeOptions.at;
        if (at !== undefined) {
          const facing = at.heading ?? here.heading;
          if (farFromFrame(at)) {
            // Keep the orbit camera over the destination while its frame rebuilds, then land.
            orbit.set(orbitTarget({ ...at, range: 400, heading: facing, pitch: 0.5 }));
            pending = {
              mode: 'walk',
              x: 0,
              z: 0,
              heading: facing,
              height: 0,
              options: modeOptions,
              since: last,
              at,
            };
            reanchor(at);
          } else {
            const [x, z] = toWorld(at.latitude, at.longitude);
            enterWalk(x, z, facing - Math.PI / 2);
          }
        } else if (left !== undefined && mode === 'drive') {
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
      follow.reset();
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
      const bounds: [number, number, number, number] = [
        longitude - dLon,
        latitude - dLat,
        longitude + dLon,
        latitude + dLat,
      ];
      // Until regional placement coverage arrives, do not park on a possible landmark.
      // Nearby terrain creation owns the async read; this synchronous check never starts I/O.
      if (structures.isLoaded && !structures.isLoaded(bounds)) return true;
      for (const entry of structures.query(bounds)) {
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

    /** The viewer's eye on foot (reach and line-of-sight tests start here). */
    const walkerEye = (): [number, number, number] => [
      walker.feet.x,
      walker.feet.y + WALK_EYE_HEIGHT,
      walker.feet.z,
    ];

    /** `setMode(..., { board })`: step out of anything, then take an owned vehicle's seat. */
    const boardOwned = (
      current: EarthStack,
      next: 'drive' | 'fly',
      id: string,
      force: boolean,
    ): boolean => {
      const entry = owned.get(id);
      if (entry === undefined) {
        emit('message', { text: 'No such vehicle' });
        return false;
      }
      if (!entry.placed) {
        emit('message', { text: 'That vehicle is not here yet' });
        return false;
      }
      if ((entry.kind !== 'aircraft') !== (next === 'drive')) {
        emit('message', {
          text: `That is a ${entry.kind}`,
        });
        return false;
      }
      const pose =
        entry.kind !== 'aircraft' ? current.vehicles?.pose(id) : current.aircraft?.pose(id);
      if (pose === undefined) return false;
      if (!force) {
        const from = mode === 'walk' ? walkerEye() : whereabouts(current).point;
        const reach = entry.kind !== 'aircraft' ? 4.5 : 8;
        const mount = current.world.get(id, Mountable);
        const transform = current.world.get(id, Transform);
        const points =
          entry.kind === 'boat' && mount && transform
            ? [...mount.seats.map((seat) => seat.position), ...(mount.entries ?? [])].map((point) =>
                vehicleLocalPoint(transform, point),
              )
            : [pose.position];
        if (
          !points.some(
            (point) =>
              Math.hypot(from[0] - point[0], from[1] - point[1], from[2] - point[2]) <=
              (entry.kind === 'boat' ? (mount?.reach ?? 3) : reach),
          )
        ) {
          emit('message', { text: 'Move closer to the door' });
          return false;
        }
      }
      if (leaveVehicle(current, force) === false) return false;
      const boarded =
        entry.kind !== 'aircraft'
          ? (current.vehicles as EarthVehicles).board(id)
          : (current.aircraft as EarthAircraft).board(id);
      if (!boarded) {
        emit('message', {
          text:
            (entry.kind !== 'aircraft' ? current.vehicles?.message : current.aircraft?.message) ||
            'Could not board',
        });
        if (mode === 'drive' || mode === 'fly') finishMode('walk');
        return false;
      }
      if (entry.kind !== 'aircraft') (current.vehicles as EarthVehicles).view = 'chase';
      else (current.aircraft as EarthAircraft).view = 'chase';
      emit('vehiclechange', { id, change: 'boarded' });
      return finishMode(next);
    };

    let boatSearchAt = -Infinity;
    /** Board the car or aircraft a `setMode` asked for, once its starting ground has streamed. */
    const completeEntry = (current: EarthStack, now: number): void => {
      const entry = pending;
      if (entry === undefined) return;
      const waited = now - entry.since;
      const giveUp = (text: string): void => {
        pending = undefined;
        emit('message', { text });
        finishMode('orbit');
      };
      if (entry.mode === 'walk') {
        // The frame has moved to the destination: project the start there and drop the walker.
        if (anchoring !== undefined) return;
        const at = entry.at as EarthPlace;
        pending = undefined;
        const [x, z] = toWorld(at.latitude, at.longitude);
        enterWalk(x, z, entry.heading - Math.PI / 2);
        return;
      }
      const ground = groundHeight(entry.x, entry.z);
      if (entry.mode === 'drive') {
        const vehicles = current.vehicles;
        const requested = entry.options.vehicle;
        if (typeof requested === 'string' && boatTypes.includes(requested) && vehicles) {
          if (last < boatSearchAt) return;
          boatSearchAt = last + 1000;
          const id = vehicles.spawnNear(requested, entry.x, entry.z, Math.PI - entry.heading, {
            radius: 160,
          });
          if (!id) {
            if (waited > (vehicles.message === 'Water is still loading' ? 60_000 : 12_000))
              giveUp(vehicles.message || 'No open water nearby');
            return;
          }
          pending = undefined;
          if (!vehicles.board(id)) {
            vehicles.remove(id);
            giveUp('Could not board the boat');
            return;
          }
          vehicles.view = 'chase';
          finishMode('drive');
          return;
        }
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

    /** What the interact key would act on now. */
    let interaction: EarthInteractionSettings = { ...options.interaction };
    const interactable = (): EarthInteractable => {
      const current = stack;
      if (current === undefined || pending !== undefined) return { kind: 'none' };
      if (mode === 'drive') {
        const id = current.vehicles?.mountedId;
        return id !== undefined ? { kind: 'vehicle', id, distance: 0 } : { kind: 'none' };
      }
      if (mode === 'fly') {
        const id = current.aircraft?.mountedId;
        return id !== undefined ? { kind: 'vehicle', id, distance: 0 } : { kind: 'none' };
      }
      if (mode !== 'walk') return { kind: 'none' };
      const eye = walkerEye();
      const distanceTo = (position: [number, number, number] | undefined): number =>
        position === undefined
          ? Number.POSITIVE_INFINITY
          : Math.hypot(position[0] - eye[0], position[1] - eye[1], position[2] - eye[2]);
      const car = current.vehicles?.nearest(eye);
      const plane = current.aircraft?.nearest(eye);
      // Nearest wins; on a tie the earlier kind (car, aircraft, actor, pedestrian).
      const candidates: EarthInteractable[] = [];
      if (car !== undefined)
        candidates.push({
          kind: 'vehicle',
          id: car,
          distance: distanceTo(current.vehicles?.pose(car)?.position),
        });
      if (plane !== undefined)
        candidates.push({
          kind: 'vehicle',
          id: plane,
          distance: distanceTo(current.aircraft?.pose(plane)?.position),
        });
      const reach = interaction.reach ?? 2.5;
      const actor = actorDirector.nearestActor(eye, reach, lineOfSight);
      if (actor !== undefined) candidates.push({ kind: 'actor', ...actor });
      if (interaction.pedestrians === true) {
        const pedestrian = actorDirector.nearestPedestrian(eye, reach, lineOfSight);
        if (pedestrian !== undefined) candidates.push({ kind: 'pedestrian', ...pedestrian });
      }
      let best: EarthInteractable = { kind: 'none' };
      for (const candidate of candidates)
        if ((candidate.distance ?? Infinity) < (best.distance ?? Infinity)) best = candidate;
      return best;
    };

    /**
     * The interact key: tell the host what it would act on, and unless a handler claims it, do
     * what the view always did (enter a car or aircraft on foot; leave one when aboard).
     */
    const handleInteract = (current: EarthStack): void => {
      const found = interactable();
      let claimed = false;
      emit('interact', {
        ...found,
        claim: () => {
          claimed = true;
        },
      });
      if (claimed) return;
      // Talking to someone is the host's business: unclaimed, nothing happens.
      if (found.kind === 'actor' || found.kind === 'pedestrian') return;
      if (mode === 'drive' || mode === 'fly') {
        setMode('walk');
        return;
      }
      if (mode !== 'walk') return;
      const aircraft = current.aircraft;
      if (found.kind === 'vehicle' && found.id !== undefined && aircraft?.pose(found.id)) {
        if (!aircraft.enter(walkerEye())) {
          emit('message', { text: aircraft.message || 'Cannot board that aircraft' });
          return;
        }
        aircraft.view = 'cockpit';
        if (owned.has(found.id)) emit('vehiclechange', { id: found.id, change: 'boarded' });
        finishMode('fly');
        return;
      }
      // A car in reach boards it; with nothing in reach this explains why (the old behaviour).
      const before = current.vehicles?.mountedId;
      if (setMode('drive')) {
        const id = current.vehicles?.mountedId;
        if (id !== undefined && id !== before && owned.has(id))
          emit('vehiclechange', { id, change: 'boarded' });
      }
    };

    // Actors: companions and NPCs in a geographic registry outside the stack, like owned vehicles.
    const actorStack = (current: EarthStack) => ({
      world: current.world,
      root: current.stream.object,
      ...(current.ambient !== undefined ? { ambient: current.ambient.handle } : {}),
      ...(current.vehicles !== undefined ? { vehicles: current.vehicles } : {}),
    });
    const actorDirector = new EarthActorDirector(
      {
        toWorld: (latitude, longitude) => toWorld(latitude, longitude),
        toGeo: (x, z) => toLatLon(x, z),
        groundHeight: (x, z) => groundHeight(x, z),
        ...(content?.types !== undefined ? { types: content.types } : {}),
        prepare: (object) => {
          void renderer.prepareObject(object);
        },
        emit: (change) => emit('actorchange', change),
        ownsVehicle: (id) => owned.has(id),
      },
      options.actors,
    );
    actorDirector.attach(actorStack(stack));
    disposers.push(() => actorDirector.dispose());
    const dioramaDirector = new EarthDioramaDirector(options.dioramas ?? {}, (error, id) =>
      report(error, `diorama ${id}`),
    );
    disposers.push(() => dioramaDirector.dispose());
    const NO_VIEWER: EarthActorViewer = {
      position: undefined,
      heading: 0,
      vehicle: undefined,
      eye: undefined,
    };
    /** The viewer as actors follow and look at it. */
    const actorViewer = (current: EarthStack): EarthActorViewer => {
      if (pending !== undefined) return NO_VIEWER;
      if (mode === 'walk') {
        if (!walker.ready) return NO_VIEWER;
        const feet: [number, number, number] = [walker.feet.x, walker.feet.y, walker.feet.z];
        return {
          position: feet,
          heading: compass(look.yaw + Math.PI / 2),
          vehicle: undefined,
          eye: [feet[0], feet[1] + WALK_EYE_HEIGHT - 0.1, feet[2]],
        };
      }
      if (mode === 'drive' || mode === 'fly') {
        const here = whereabouts(current);
        return {
          position: here.point,
          heading: here.heading,
          vehicle: current.world.get(PLAYER_ID, Mounted)?.vehicle,
          eye: current.world.get(PLAYER_ID, Transform)?.pos,
        };
      }
      return NO_VIEWER;
    };
    /** The viewer's own figure: on foot in third person, seated in a chase view. */
    const avatarFrame = (current: EarthStack): EarthAvatarFrame => {
      if (pending !== undefined) return { visible: false };
      if (mode === 'walk')
        return walker.ready
          ? {
              visible: walkView === 'third',
              feet: [walker.feet.x, walker.feet.y, walker.feet.z],
              velocity: [walker.velocity.x, walker.velocity.z],
              heading: compass(look.yaw + Math.PI / 2),
            }
          : { visible: false };
      if (mode === 'drive') return { visible: current.vehicles?.view === 'chase' };
      if (mode === 'fly') return { visible: current.aircraft?.view === 'chase' };
      return { visible: false };
    };
    /** Nothing in the walker's collision neighbourhood between two points. */
    const lineOfSight = (
      from: readonly [number, number, number],
      to: readonly [number, number, number],
    ): boolean => {
      const a = new THREE.Vector3(
        from[0] - collision.origin.x,
        from[1],
        from[2] - collision.origin.z,
      );
      const b = new THREE.Vector3(to[0] - collision.origin.x, to[1], to[2] - collision.origin.z);
      const distance = a.distanceTo(b);
      if (distance < 1e-6) return true;
      const hit = collision.octree.rayIntersect(new THREE.Ray(a, b.sub(a).normalize()));
      return !hit || hit.distance >= distance - 0.15;
    };

    const walkerApi: EarthWalker = {
      place(at) {
        if (mode !== 'walk' || pending !== undefined || farFromFrame(at)) {
          setMode('walk', { at, force: true });
          return;
        }
        const [x, z] = toWorld(at.latitude, at.longitude);
        enterWalk(x, z, (at.heading ?? compass(look.yaw + Math.PI / 2)) - Math.PI / 2);
      },
      pose() {
        if (mode !== 'walk' || pending !== undefined) return undefined;
        const geo = toLatLon(walker.feet.x, walker.feet.z);
        return {
          latitude: geo.latitude,
          longitude: geo.longitude,
          altitude: walker.feet.y,
          heading: compass(look.yaw + Math.PI / 2),
          speed: Math.hypot(walker.velocity.x, walker.velocity.z),
          grounded: walker.grounded,
        };
      },
      get ready() {
        return mode === 'walk' && pending === undefined && walker.ready;
      },
      setAvatar(avatar) {
        actorDirector.setAvatar(
          avatar === undefined ? undefined : 'figure' in avatar ? avatar.figure : avatar,
        );
      },
      setView(next) {
        if (next === walkView) return;
        walkView = next;
        follow.reset();
      },
      get view() {
        return walkView;
      },
    };

    const ownedApi: EarthOwnedVehicles = {
      spawn(spec) {
        const kind = ownedKind(spec.type);
        if (kind === undefined)
          throw new Error(`${spec.type} is not a car, boat or aircraft type in the content packs`);
        const id = spec.id ?? `owned-${kind}-${++ownedSequence}`;
        if (owned.has(id)) throw new Error(`Owned vehicle ${id} already exists`);
        if (spec.livery !== undefined)
          selectLivery(
            content?.types?.components(spec.type).livery as LiveryData | undefined,
            spec.livery,
          );
        owned.set(id, {
          id,
          type: spec.type,
          kind,
          geo: {
            latitude: spec.latitude,
            longitude: spec.longitude,
            heading: compass(spec.heading),
            altitude: undefined,
          },
          color: spec.color,
          livery: spec.livery,
          airborne: spec.airborne,
          placed: false,
          blocked: false,
          since: last,
          nextAttempt: 0,
          waiters: [],
        });
        if (stack !== undefined) placeOwned(stack, last);
        return id;
      },
      list() {
        return [...owned.keys()];
      },
      pose(id) {
        const entry = owned.get(id);
        if (entry === undefined) return undefined;
        const current = stack;
        if (entry.placed && current !== undefined) syncOwnedEntry(current, entry);
        const live =
          entry.placed && current !== undefined
            ? entry.kind !== 'aircraft'
              ? current.vehicles?.pose(id)
              : current.aircraft?.pose(id)
            : undefined;
        return {
          kind: entry.kind,
          type: entry.type,
          latitude: entry.geo.latitude,
          longitude: entry.geo.longitude,
          altitude: entry.geo.altitude ?? 0,
          heading: entry.geo.heading,
          speed: live === undefined ? 0 : Math.abs(live.speed),
          occupied: live?.occupied ?? false,
          placed: entry.placed,
        };
      },
      board(id, boardOptions = {}) {
        const entry = owned.get(id);
        if (entry === undefined) return false;
        return setMode(entry.kind !== 'aircraft' ? 'drive' : 'fly', {
          board: id,
          ...(boardOptions.force === true ? { force: true } : {}),
        });
      },
      release() {
        if (mode === 'drive' || mode === 'fly') setMode('walk', { force: true });
      },
      remove(id) {
        const entry = owned.get(id);
        if (entry === undefined) return;
        const current = stack;
        if (current !== undefined && entry.placed) {
          const aboard =
            (mode === 'drive' && current.vehicles?.mountedId === id) ||
            (mode === 'fly' && current.aircraft?.mountedId === id);
          if (aboard) setMode('walk', { force: true });
          if (entry.kind !== 'aircraft') current.vehicles?.remove(id);
          else current.aircraft?.remove(id);
        }
        owned.delete(id);
        settleOwned(entry, new Error(`Vehicle ${id} was removed`));
        emit('vehiclechange', { id, change: 'removed' });
      },
      liveries(id) {
        const entry = owned.get(id);
        return entry === undefined
          ? []
          : ((content?.types?.components(entry.type).livery as LiveryData | undefined)?.variants ??
              []);
      },
      setLivery(id, selected) {
        const entry = owned.get(id);
        if (entry === undefined) return;
        selectLivery(
          content?.types?.components(entry.type).livery as LiveryData | undefined,
          selected,
        );
        entry.livery = selected;
        entry.color = undefined;
        if (entry.placed) {
          if (entry.kind === 'aircraft') stack?.aircraft?.setLivery(id, selected);
          else stack?.vehicles?.setLivery(id, selected);
        }
        emit('vehiclechange', { id, change: 'painted' });
      },
      setColor(id, color) {
        const entry = owned.get(id);
        if (entry === undefined) return;
        entry.color = color;
        if (entry.kind !== 'aircraft' && entry.placed) stack?.vehicles?.setColor(id, color);
        emit('vehiclechange', { id, change: 'painted' });
      },
      whenPlaced(id, placeOptions = {}) {
        const entry = owned.get(id);
        if (entry === undefined) return Promise.reject(new Error(`No owned vehicle ${id}`));
        if (entry.placed) return Promise.resolve();
        if (entry.blocked) return Promise.reject(new Error(`Vehicle ${id} could not be placed`));
        return new Promise<void>((resolve, reject) => {
          const waiter = { resolve, reject };
          entry.waiters.push(waiter);
          placeOptions.signal?.addEventListener(
            'abort',
            () => {
              const index = entry.waiters.indexOf(waiter);
              if (index >= 0) entry.waiters.splice(index, 1);
              reject(new DOMException('whenPlaced aborted', 'AbortError'));
            },
            { once: true },
          );
        });
      },
    };

    /** The frame event's view of the viewer. */
    const frameState = (current: EarthStack, dt: number, now: number): EarthFrame => {
      const here = whereabouts(current);
      const geo = toLatLon(here.point[0], here.point[2]);
      const speed =
        mode === 'walk'
          ? Math.hypot(walker.velocity.x, walker.velocity.z)
          : mode === 'drive'
            ? Math.abs(current.vehicles?.speed ?? 0)
            : mode === 'fly'
              ? (current.aircraft?.status()?.airspeed ?? 0)
              : 0;
      return {
        dt,
        now,
        mode,
        viewer: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          altitude: mode === 'fly' ? here.point[1] + here.height : here.point[1],
          heading: here.heading,
          speed,
        },
      };
    };

    // Airfields read the current stack's traffic network; a re-anchor moves the version on so
    // waiters re-check against the new stack.
    let stackGeneration = 0;
    const airfields = new EarthAirfields({
      runways: () => stack?.ambient?.handle.network.runways() ?? [],
      aerodromes: () => stack?.ambient?.handle.network.aerodromes() ?? [],
      version: () => stackGeneration * 1_000_000 + (stack?.ambient?.handle.network.version ?? 0),
      toGeo: toLatLon,
      toWorld,
      toElevation: (x, z, y) => groundHeight(x, z) ?? y,
    });
    disposers.push(() => airfields.dispose());

    // Adaptive quality. The view first calibrates with the controller's quick recovery and cooldown
    // (EARTH_CALIBRATION_QUALITY), so a slow device settles on a level it can hold within seconds. Once a level has held for
    // EARTH_QUALITY_CALIBRATION_MS it turns sticky: every change swaps resolution and detail across the
    // whole view, so later ones need sustained overload (not one burst of streaming while the
    // camera turns) or a long spell of headroom.
    const maxQualityLevel = Math.max(0, Math.min(5, Math.floor(options.maxQualityLevel ?? 3)));
    if (automatic) level = Math.min(level, maxQualityLevel);
    let controller = new AdaptiveQualityController({
      initialLevel: level,
      maxLevel: maxQualityLevel,
      ...EARTH_CALIBRATION_QUALITY,
    });
    let calibrated = false;
    let levelSince = performance.now();
    let qualityReason: AdaptiveQualityReason | undefined;
    // A level change swaps resolution, terrain detail, building quality, surfaces, ambient life
    // and shadows. Applied together mid-flight, their one-off costs (a canvas reallocation, a
    // terrain visibility pass, surface rebuilds, a shadow map) stacked into one long frame; the
    // frame loop applies them a frame apart (`staged`). Surfaces rebuild only when their budgets
    // change: every surface tile is regenerated.
    const tierSteps: Array<() => void> = [];
    const appliedSurface = new WeakMap<object, string>();
    const applyTier = (staged = false): void => {
      tier = earthPerformanceTier(level);
      const current = stack;
      const live = (): boolean => current !== undefined && current === stack;
      const steps: Array<() => void> = [
        () => {
          lodPolicy.maxPixelError = automatic ? tier.objectPixelError : 2;
          resize();
        },
        () => {
          if (!live() || current === undefined) return;
          const budget = terrainBudget();
          current.stream.setBudget(budget);
          current.viewDistance = budget.viewDistance;
          orbit.setRangeLimits({ maxRange: earthOrbitMaxRange(budget.viewDistance) });
        },
        () => {
          if (!live()) return;
          current?.worldgen?.setQuality(quality());
          current?.worldgen?.setCacheBudget(worldgenCacheBytes());
        },
        () => {
          if (!live() || current === undefined) return;
          const budgets = surfaceBudgets(quality(), automatic ? tier.surfaceScale : 1);
          const key = JSON.stringify(budgets);
          if (appliedSurface.get(current.surface) === key) return;
          appliedSurface.set(current.surface, key);
          void current.surface
            .setOptions({
              style: 'modern',
              ...(ambientSettings?.drivingSide ? { drivingSide: ambientSettings.drivingSide } : {}),
              fonts: content?.fonts,
              routeShields: content?.roadSigns?.shields,
              details: {
                preferMappedProps: current.worldgen !== undefined,
                parkedVehicles: content?.parkedVehicles ?? [],
                ...budgets,
              },
            })
            .catch((error: unknown) => report(error, 'surface detail'));
        },
        () => {
          if (!live()) return;
          current?.ambient?.setBudget(ambientBudget());
          current?.wildlife?.setBudget(ambientBudget());
        },
        () => {
          if (live()) renderer.setShadowQuality(shadowQuality());
        },
      ];
      tierSteps.length = 0;
      if (staged) tierSteps.push(...steps);
      else for (const step of steps) step();
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
          unplaceOwned(previous);
          actorDirector.detach();
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
            stackGeneration++;
            actorDirector.attach(actorStack(next));
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
        mode === 'orbit' || stack === undefined || pending !== undefined
          ? orbit.state.target
          : mode === 'walk'
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
    const tilePreloader = createEarthTilePreloader();
    let preloadStack: EarthStack | undefined;
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
    const admissionGovernor = createEarthAdmissionGovernor(renderer.backend);
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
      // V switches first and third person (with an avatar to look at).
      if (frameInput.view > 0 && actorDirector.hasAvatar) {
        walkView = walkView === 'first' ? 'third' : 'first';
        follow.reset();
      }
      if (walkView === 'third') return thirdPersonPose(dt, frameInput, current, eyeY);
      const position: [number, number, number] = [walker.feet.x, eyeY, walker.feet.z];
      current.worldgen?.updateInteriors(position);
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

    /**
     * The third-person walk camera: behind the feet along the look heading, pulled in front of
     * anything solid between it and the walker. Look input turns the walker's heading (and so the
     * camera); vertical look tilts the chase camera, easing back when it stops.
     */
    const thirdPersonPose = (
      dt: number,
      frameInput: NavigationInput,
      current: EarthStack,
      eyeY: number,
    ): NavigationPose => {
      const feet: [number, number, number] = [walker.feet.x, eyeY - WALK_EYE_HEIGHT, walker.feet.z];
      const view = follow.update(
        dt,
        { position: feet, heading: compass(look.yaw + Math.PI / 2) },
        { ...frameInput, look: [0, frameInput.look[1]] },
        environment,
      );
      let position = view.position;
      const from = new THREE.Vector3(
        view.lookAt[0] - collision.origin.x,
        view.lookAt[1],
        view.lookAt[2] - collision.origin.z,
      );
      const to = new THREE.Vector3(
        view.position[0] - collision.origin.x,
        view.position[1],
        view.position[2] - collision.origin.z,
      );
      const length = from.distanceTo(to);
      if (length > 1e-3) {
        const ray = to.sub(from).normalize();
        const hit = collision.octree.rayIntersect(new THREE.Ray(from, ray));
        if (hit && hit.distance < length) {
          const reach = Math.max(0.3, hit.distance - 0.25);
          position = [
            view.lookAt[0] + ray.x * reach,
            view.lookAt[1] + ray.y * reach,
            view.lookAt[2] + ray.z * reach,
          ];
        }
      }
      current.worldgen?.updateInteriors(position);
      const dx = view.lookAt[0] - position[0];
      const dy = view.lookAt[1] - position[1];
      const dz = view.lookAt[2] - position[2];
      const span = Math.hypot(dx, dy, dz) || 1;
      return { position, lookAt: view.lookAt, direction: [dx / span, dy / span, dz / span] };
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
        // Sprint (Shift) doubles as the handbrake while driving.
        handbrake: frameInput.sprint,
      });
      current.stepWorld(dt);
      vehicles.render();
      current.aircraft?.render(pose.position);
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
          ? { engine: pilot.engine, gear: pilot.gear, flaps: pilot.flaps, vector: pilot.vector }
          : {}),
      });
      // Cars hold still; the shared world step runs the flight model.
      current.vehicles?.update(dt, { throttle: 0, steering: 0, brake: true });
      current.stepWorld(dt);
      current.vehicles?.render();
      aircraft.render(pose.position);
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
    let audioTerrainSample: EarthAudioTerrainSample | undefined;
    let audioTerrainAt = -Infinity;
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
          applyTier(true);
        } else if (
          !calibrated &&
          heldLevel === undefined &&
          now - levelSince >= EARTH_QUALITY_CALIBRATION_MS
        ) {
          controller = new AdaptiveQualityController({
            initialLevel: level,
            maxLevel: maxQualityLevel,
            ...EARTH_STICKY_QUALITY,
          });
          calibrated = true;
        }
      }
      // One step of a level change per frame (see applyTier).
      tierSteps.shift()?.();
      if (deferredMode !== undefined && current !== undefined && anchoring === undefined) {
        const deferred = deferredMode;
        deferredMode = undefined;
        setMode(deferred.next, deferred.options);
      }
      if (pending !== undefined && current !== undefined) completeEntry(current, now);
      if (current !== undefined && anchoring === undefined) {
        placeOwned(current, now);
        syncOwned(current, now);
        if (now - airfieldsTickAt >= 200) {
          airfieldsTickAt = now;
          airfields.tick();
        }
      }
      if (frameInput.interact > 0 && current !== undefined && pending === undefined)
        handleInteract(current);
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
          const streamView: TerrainPyramidView = {
            position: pose.position,
            verticalFov: VERTICAL_FOV,
            viewportHeight: canvas.height || h,
            direction: pose.direction,
            aspect: w / h,
          };
          if (preloadStack !== current) {
            tilePreloader.reset();
            preloadStack = current;
          }
          const steady =
            anchoring === undefined && pending === undefined && !(mode === 'orbit' && orbit.flying);
          current.stream.update(streamView, tilePreloader.views(now, streamView, steady));
          streamed = { position: pose.position, direction: pose.direction };
        }
        if (anchoring === undefined) {
          // A fly-to or a vehicle entry moves the camera fast for a moment; that is not travel.
          const steady = pending === undefined && !(mode === 'orbit' && orbit.flying);
          current.prefetcher?.frame(now, pose.position, pose.direction, steady);
        }
        current.vehicles?.sync(now, pose.position);
        // Ambient cars stop for the walker and for actors on foot.
        current.ambient?.sync(now, pose, [
          ...(mode === 'walk' ? [{ x: walker.feet.x, z: walker.feet.z, radius: 0.5 }] : []),
          ...actorDirector.solids(),
        ]);
        if (pending !== undefined || (mode !== 'drive' && mode !== 'fly')) {
          current.vehicles?.update(dt, { throttle: 0, steering: 0, brake: true });
          current.stepWorld(dt);
          current.vehicles?.render();
          current.aircraft?.render(pose.position);
        }
        actorDirector.update(dt, now, pose.position, actorViewer(current), avatarFrame(current));
        cockpitPointer.update();
        current.ambient?.update(dt);
        current.ambient?.render(pose.position, dt);
        current.wildlife?.update(dt, pose.position);
        dioramaDirector.update({
          root: current.stream.object,
          camera: renderer.camera,
          position: pose.position,
          dt,
          timeMs: Date.now(),
          toWorld,
          groundHeight,
        });
        if (listeners.frame.size > 0) emit('frame', frameState(current, dt, now));
        current.surface.updateSignals(
          current.ambient
            ? current.ambient.world.tick / current.ambient.world.tickRate
            : now / 1000,
          current.ambient?.surfaceSignalColor,
        );
        current.surface.updateDetail(renderer.camera.position);
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
          audio.attachWorld(current?.world);
          audioTerrainAt = -Infinity;
        }
        if (now - audioTerrainAt >= 250) {
          audioTerrainSample = current?.audioTerrain.sample(pose.position[0], pose.position[2]);
          audioTerrainAt = now;
        }
        const ground = groundHeight(pose.position[0], pose.position[2]);
        const audioSky = renderer.sky?.frame.earth;
        const audioLocation = toLatLon(pose.position[0], pose.position[2]);
        const skyUtc = renderer.sky?.frame?.earth?.utcMs;
        audio.update({
          nowMs: now,
          location: {
            ...audioLocation,
            ...(audioSky
              ? {
                  utcMs: audioSky.utcMs,
                  sunAltitudeDeg: audioSky.sun.altitudeDeg,
                }
              : {}),
          },
          position: pose.position,
          forward: pose.direction,
          // The sound rules call flying an aircraft 'pilot'.
          mode: mode === 'fly' ? 'pilot' : mode,
          inVehicle:
            (mode === 'drive' &&
              current?.vehicles?.view === 'cockpit' &&
              !current.vehicles.isBoat(current.vehicles.mountedId ?? '')) ||
            (mode === 'fly' && current?.aircraft?.view === 'cockpit'),
          ...(audioTerrainSample ? { terrain: audioTerrainSample } : {}),
          ...(skyUtc !== undefined
            ? { solarHour: (((skyUtc / 3600000 + audioLocation.longitude / 15) % 24) + 24) % 24 }
            : {}),
          ...(current?.wildlife !== undefined
            ? { regionalAmbience: current.wildlife.ambience(pose.position) }
            : {}),
          ...(ground !== undefined ? { heightAboveGround: pose.position[1] - ground } : {}),
          ...(mode === 'walk' ? { grounded: walker.grounded } : {}),
        });
      }
      const origin = renderer.getWorldOrigin();
      setTerrainWaterTime(water, current ? current.world.tick * current.world.dt : 0, [
        origin[0],
        origin[2],
      ]);
      setTerrainGroundOrigin(groundMaterial, [origin[0], origin[2]]);
      setTerrainGroundOrigin(fieldMaterial, [origin[0], origin[2]]);
      setTerrainGroundOrigin(pavementMaterial, [origin[0], origin[2]]);
      const timing = gpuTimer?.begin() === true;
      viewer.renderFrame();
      if (timing) gpuTimer?.end();
      frames++;
      workMs = performance.now() - workStart;
      const admission = admissionGovernor.sample(workMs, frameMs);
      if (admission !== undefined) renderer.admission.setLimits(admission);
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
            kind: vehicles.isBoat(vehicles.mountedId as string) ? 'boat' : 'car',
            ...(vehicles.boatStatus(vehicles.mountedId as string)
              ? {
                  anchored: vehicles.boatStatus(vehicles.mountedId as string)?.anchored,
                  grounded: vehicles.boatStatus(vehicles.mountedId as string)?.grounded,
                }
              : {}),
            label: vehicles.label(vehicles.mountedId as string),
            ...vehicles.genericIdentity(vehicles.mountedId as string),
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
        deferredMode = undefined;
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
        deferredMode = undefined;
        if (mode !== 'orbit') setMode('orbit', { force: true });
        orbit.set(orbitTarget(target));
        if (
          Math.abs(target.latitude - frameLatitude) > REANCHOR_DEGREES ||
          options.terrainSource !== undefined
        )
          reanchor(target);
      },
      getCamera: camera,
      toWorld,
      toGeo: toLatLon,
      groundHeight(latitude, longitude) {
        const [x, z] = toWorld(latitude, longitude);
        return groundHeight(x, z);
      },
      walker: walkerApi,
      vehicles: ownedApi,
      actors: actorDirector.api,
      dioramas: dioramaDirector,
      airfields,
      interactable,
      setInteraction(settings) {
        interaction = {
          ...interaction,
          ...(settings.reach !== undefined ? { reach: settings.reach } : {}),
          ...(settings.pedestrians !== undefined ? { pedestrians: settings.pedestrians } : {}),
        };
      },
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
          preloadingTiles: streamStats?.preloading ?? 0,
          preloadedTiles: streamStats?.preloaded ?? 0,
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
