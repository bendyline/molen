export { createBuildingCellLod, createBuildingDetailLod } from './client/building-lod';
export type { BuildingObjectOptions } from './client/building-object';
export { createBuildingObject } from './client/building-object';
export {
  type BuildingMaterialDecorator,
  createBuildingWeathering,
  createBuildingWeatheringAsync,
} from './client/building-weathering';
export type {
  WorldgenEntityClient,
  WorldgenEntityLayer,
  WorldgenEntityLayerOptions,
} from './client/entity-layer';
export { createWorldgenEntityLayer } from './client/entity-layer';
export {
  buildingBoxGeometry,
  createInstancedPlacements,
  gableBoxGeometry,
  gableRoofGeometry,
  unitBoxGeometry,
} from './client/instanced-box';
export {
  createInstancedPlacementLod,
  type InstancedPlacementLodOptions,
  PlacementSetGroup,
} from './client/instanced-lod';
export type { ModelDetail, ModelLoader, PreparedModel } from './client/instanced-models';
export { ModelLibrary, mergeSceneGeometry } from './client/instanced-models';
export {
  type InteriorDoorQuery,
  type InteriorDoorState,
  type InteriorElevatorStop,
  InteriorStreamer,
  type InteriorStreamingOptions,
  type InteriorStreamingStats,
} from './client/interior-streamer';
export type { ResolvedMaterialSet, ResolvedMaterialSetOptions } from './client/materials';
export {
  createResolvedMaterialSet,
  createVertexColorMaterialSet,
  TEXTURED_SURFACE_MEAN,
} from './client/materials';
export {
  createNearPlacements,
  isNearPlacementObject,
  type NearPlacementModel,
  NearPlacementObject,
  type NearPlacementOptions,
  nearPlacementReach,
} from './client/near-placements';
export {
  type ModelNightLight,
  NightWindowLighting,
  type NightWindowRange,
} from './client/night-windows';
export { createPlantGeometry } from './client/plant-geometry';
export {
  createScatterMaterial,
  createScatterMaterialAsync,
  SCATTER_CANOPY_ATTRIBUTE,
  type ScatterMaterial,
  setScatterCanopy,
} from './client/scatter-material';
export { ScreenSpaceLod, type ScreenSpaceLodPolicy } from './client/screen-space-lod';
export {
  createSignAtlasTexture,
  createSignMaterial,
  createSignMaterialAsync,
  SIGN_INK_ATTRIBUTE,
  SIGN_PLATE_ATTRIBUTE,
  type SignAtlasPixels,
  type SignMaterial,
  signLettersMaterial,
} from './client/sign-material';
export {
  createSignMeshObject,
  SIGN_LETTER_PIXELS,
  SIGN_PLATE_PIXELS,
} from './client/sign-object';
export {
  routeStructureModels,
  type StructureAcquireOptions,
  type StructureInstanceOptions,
  type StructureModel,
  StructureModelLibrary,
  type StructureModelLibraryOptions,
  type StructureModelRouteOptions,
  type StructureModelSource,
} from './client/structure-models';
export {
  type StructureLodManifest,
  StructureLodStreamer,
  type StructureStreamingBudget,
  type StructureStreamingOptions,
  type StructureStreamingStats,
  type StructureStreamingView,
  structureGeometryBytes,
  structureStreamingBudget,
  structureStreamingMobile,
} from './client/structure-streamer';
export type { LoadedStylePack, LoadStylePackOptions } from './client/stylepack-loader';
export { loadStylePack, withStylePackDocuments } from './client/stylepack-loader';
export {
  createTurf,
  isTurfObject,
  TurfObject,
  type TurfOptions,
  type TurfSource,
  turfReach,
} from './client/turf';
export { createTuftGeometry } from './client/turf-geometry';
export type { WorldgenMaterialSet } from './client/upload';
export { buffersToObject3D, disposeWorldgenObject } from './client/upload';
export { TURF_TUFT_MODEL } from './client/vegetation';
