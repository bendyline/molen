export { createBuildingCellLod, createBuildingDetailLod } from './client/building-lod';
export type { BuildingObjectOptions } from './client/building-object';
export { createBuildingObject } from './client/building-object';
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
  unitBoxGeometry,
} from './client/instanced-box';
export {
  createInstancedPlacementLod,
  type InstancedPlacementLodOptions,
} from './client/instanced-lod';
export type { ModelLoader, PreparedModel } from './client/instanced-models';
export { ModelLibrary, mergeSceneGeometry } from './client/instanced-models';
export {
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
export { createPlantGeometry } from './client/plant-geometry';
export { ScreenSpaceLod, type ScreenSpaceLodPolicy } from './client/screen-space-lod';
export {
  type StructureAcquireOptions,
  type StructureInstanceOptions,
  type StructureModel,
  StructureModelLibrary,
  type StructureModelLibraryOptions,
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
} from './client/structure-streamer';
export type { LoadedStylePack, LoadStylePackOptions } from './client/stylepack-loader';
export { loadStylePack, withStylePackDocuments } from './client/stylepack-loader';
export type { WorldgenMaterialSet } from './client/upload';
export { buffersToObject3D, disposeWorldgenObject } from './client/upload';
