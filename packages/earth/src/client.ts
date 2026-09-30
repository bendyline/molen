// @bendyline/molen-earth/client — an embeddable real-world 3D view. `mountEarthView` is the whole
// thing behind one call; the pieces it is built from (content loading, worldgen setup, drivable
// cars, flyable aircraft, sky and haze, performance tiers, credits) are exported for hosts that
// compose their own.

export {
  EarthAircraft,
  type EarthAircraftOptions,
  type EarthAircraftPlacement,
  type EarthFlightStatus,
  type EarthPilotControls,
} from './client/aircraft';
export {
  ambientContentFromTypes,
  EarthAmbient,
  type EarthAmbientBudget,
  type EarthAmbientContent,
  type EarthAmbientOptions,
  type EarthAmbientSettings,
  type EarthAmbientStats,
} from './client/ambient';
export {
  observeSemanticTiles,
  SemanticTileBuffer,
  type SemanticTileObserver,
} from './client/ambient-tiles';
export {
  createEarthFog,
  createEarthSky,
  type EarthSkyStyle,
  updateEarthFog,
} from './client/atmosphere';
export { type EarthCredit, earthCredits, formatEarthCredits } from './client/attribution';
export {
  createEarthAudio,
  EARTH_AUDIO_ENVIRONMENT,
  type EarthAudio,
  type EarthAudioFrame,
  type EarthAudioOptions,
} from './client/audio';
export {
  EARTH_PACK_IDS,
  type EarthContent,
  type EarthWorldgenContent,
  type LoadEarthContentOptions,
  loadEarthContent,
  openPacksFromIndex,
} from './client/content';
export { afterPreparation } from './client/deferred';
export {
  type EarthCameraState,
  type EarthCameraTarget,
  type EarthMarker,
  type EarthModeOptions,
  type EarthTerrainSource,
  type EarthVehicleStatus,
  type EarthView,
  type EarthViewEvents,
  type EarthViewMode,
  type EarthViewOptions,
  type EarthViewStats,
  type EarthViewStyle,
  earthOrbitMaxRange,
  mountEarthView,
} from './client/earth-view';
export {
  type ModelArchiveOptions,
  type ModelArchivesDoc,
  type OpenModelArchive,
  withModelArchives,
} from './client/model-archives';
export {
  type EarthDeviceMemory,
  type EarthPerformanceTier,
  earthMemoryBudget,
  earthPerformanceTier,
  earthPixelRatio,
  earthQualityLevel,
} from './client/performance';
export { EarthVehicles, type EarthVehiclesOptions } from './client/vehicles';
export {
  type CreateEarthWorldgenOptions,
  createEarthWorldgen,
  type EarthViewWorkers,
  type EarthWorldgen,
} from './client/worldgen';
