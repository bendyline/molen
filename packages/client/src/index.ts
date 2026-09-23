// Escape hatch: the exact pinned three.js, so consumers drop to raw three without a second,
// possibly-mismatched install. See docs-src/guide/three-surface.md.

export type {
  CustomSkyData,
  EarthObserver,
  EarthSkyData,
  ResolvedWeather,
  SkyAppearance,
  SkyBodyData,
  SkyData,
  SkyPalette,
  SkyTime,
  WeatherData,
  WeatherProfile,
} from '@bendyline/molen-schema';
export { resolveWeather, weatherProfile } from '@bendyline/molen-schema';
export * as THREE from 'three';
export type {
  AdaptiveQualityChange,
  AdaptiveQualityOptions,
  AdaptiveQualityReason,
  AdaptiveQualitySample,
  AdaptiveQualityStats,
} from './adaptive-quality';
export { AdaptiveQualityController } from './adaptive-quality';
export type { AssetProvider, LoadedGltf, UrlAssetProviderOptions } from './assets';
export { AssetCache, createUrlAssetProvider } from './assets';
export type {
  AssetOptions,
  ClientOptions,
  MolenClient,
  MountExperienceOptions,
  MountedExperience,
} from './client';
export {
  createClient,
  createSnapshotViewer,
  createViewer,
  localCommand,
  mountExperience,
} from './client';
export type {
  ClientCore,
  ClientCoreOptions,
  ClientDiagCode,
  ClientError,
  Unsubscribe,
} from './client-core';
export { createClientCore } from './client-core';
export type {
  AdmissionOptions,
  AdmissionSample,
  FrameAdmissionOptions,
  SceneAdmission,
} from './frame-admission';
export { FrameAdmissionQueue } from './frame-admission';
export type { InputBindings, InputGamepad, InputMapOptions } from './input';
export { InputMap, normalizeInputAxis, resolveAction } from './input';
export type { InterpTransform } from './interpolation';
export { InterpolationBuffer } from './interpolation';
export { lerp3, nlerp4 } from './math';
export type { ModelSignals, ModelSignalVisual } from './model-signals';
export { createModelSignalVisual, readModelSignals } from './model-signals';
export type { CameraTarget, InputRuleOptions } from './scene-bindings';
export { applyInputRules, applySceneCamera, followCameraPose } from './scene-bindings';
export type { CelestialPosition, EarthSkyState } from './sky/astronomy';
export { evaluateEarthSky, skyTimeMs, starDirection } from './sky/astronomy';
export {
  decodeStarCatalog,
  decodeStarCatalogRows,
  encodeStarCatalog,
  type StarCatalogRow,
} from './sky/star-catalog';
export type { SkyFrame, SkyStar, SkyVisualOptions } from './sky/visual';
export { defaultSkyPalette, SkyVisual } from './sky/visual';
export type { LightData, Renderable, SceneBackend } from './sync';
export { SceneMirror } from './sync';
export type { SceneOptimizationOptions } from './three/backend';
export { computeClipTime, ThreeSceneBackend } from './three/backend';
export type { EnvironmentData } from './three/environment';
export { applyEnvironment, defaultEnvironment } from './three/environment';
export type { GpuFrameTimer, GpuFrameTimerOptions } from './three/gpu-frame-timer';
export { createGpuFrameTimer } from './three/gpu-frame-timer';
export type {
  KindContext,
  KindHandle,
  KindView,
  MirrorReader,
  RenderableKind,
} from './three/kinds';
export type { DecoderConfig } from './three/loaders';
export { createGltfLoader } from './three/loaders';
export { MaterialResolver, materialFromBaked } from './three/materials';
export type {
  AutoWorldOriginOptions,
  CameraPose,
  RendererBackend,
  RendererBackendPreference,
  RendererOptions,
  ThreeRenderer,
  TopDownOrtho,
} from './three/renderer';
export { nextWorldOrigin, orthoFrustum, Renderer } from './three/renderer';
export type { StaticBatchOptions } from './three/static-batches';
export { WeatherVisual } from './weather/visual';
