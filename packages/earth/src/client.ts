// @bendyline/molen-earth/client — an embeddable real-world 3D view. `mountEarthView` is the whole
// thing behind one call; the pieces it is built from (content loading, worldgen setup, drivable
// cars, sky and haze, performance tiers, credits) are exported for hosts that compose their own.

export {
  createEarthFog,
  createEarthSky,
  type EarthSkyStyle,
  updateEarthFog,
} from './client/atmosphere';
export { type EarthCredit, earthCredits, formatEarthCredits } from './client/attribution';
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
  type EarthView,
  type EarthViewEvents,
  type EarthViewMode,
  type EarthViewOptions,
  type EarthViewStats,
  type EarthViewStyle,
  mountEarthView,
} from './client/earth-view';
export {
  type EarthPerformanceTier,
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
