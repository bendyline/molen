export type {
  BusinessCatalog,
  BusinessProfile,
  ResolvedBusiness,
} from './kernel/business-catalog';
export { createBusinessCatalog } from './kernel/business-catalog';
export type { BusinessCatalogDoc, BusinessCategory } from './kernel/business-catalog-schema';
export {
  registerBusinessCatalogSchema,
  validateBusinessCatalogDocuments,
} from './kernel/business-catalog-schema';
export { associateBusinesses } from './kernel/businesses';
export type {
  EcologyArea,
  EcologyAtlasDoc,
  EcologyCell,
  EcologyResolver,
  Ecoregion,
} from './kernel/ecology-atlas';
export { checkEcologyAtlas, createEcologyResolver } from './kernel/ecology-atlas';
export { ECOLOGY_ATLAS_EXAMPLE, registerEcologyAtlasSchema } from './kernel/ecology-atlas-schema';
export { buildingLabels, contextLabelAt, landcoverLabel } from './kernel/labels';
export { mappedPropExclusions, mappedPropRequests } from './kernel/mapped-props';
export {
  createPlacesContent,
  type PlacesContent,
  type PlacesContentDocs,
} from './kernel/places';
export type {
  ProjectedRegion,
  RegionResolver,
  RegionResolverOptions,
  WorldBounds,
} from './kernel/region';
export { createRegionResolver, regionScatterId, regionStyleRules } from './kernel/region';
export {
  REGION_ATLAS_EXAMPLE,
  registerRegionAtlasSchema,
  validateRegionAtlas,
} from './kernel/region-atlas-schema';
export type {
  AtlasRegion,
  AtlasRegionBindings,
  RegionAtlasDefaults,
  RegionAtlasDoc,
} from './kernel/region-atlas-types';
export type {
  RegionalCatalogDoc,
  RegionalContext,
  RegionalLibrary,
  RegionalMatch,
  RegionalProfile,
  RegionalSelection,
  RegionalWildlifePopulation,
} from './kernel/regional-content';
export { createRegionalLibrary, matchesRegionalProfile } from './kernel/regional-content';
export {
  regionalCatalogSchema,
  registerRegionalCatalogSchema,
} from './kernel/regional-content-schema';
export type { RegionalEnvironment, RegionalEnvironmentDocs } from './kernel/regional-environment';
export { createRegionalEnvironment } from './kernel/regional-environment';
export type {
  SemanticAdapterOptions,
  SemanticBatch,
  TileGeometry,
} from './kernel/semantic-adapter';
export {
  landcoverAreaOf,
  OPEN_GROUND_LABEL,
  scatterRequestFromTile,
  semanticTileToBatch,
} from './kernel/semantic-adapter';
export {
  type HistoricalStructureAppearance,
  isHistoricalStructureAppearance,
  isStructureViewingDate,
} from './kernel/structure-date';
export type {
  StructureCatalogDoc,
  StructureIndex,
  StructureMapRule,
  StructurePlacement,
  StructureQueryOptions,
  StyleSuggestion,
} from './kernel/structure-index';
export {
  createStructureIndex,
  encodeStructureGeohash,
  suggestStructureStyles,
} from './kernel/structure-index';
export { registerStructurePlacementsSchema } from './kernel/structure-index-schema';
export { matchMapStructures, orientMappedStructure } from './kernel/structure-matching';
export type { WorldgenQualityPreset } from './kernel/tile-budgets';
export { worldgenBuildingCellSize, worldgenTileBudgetForQuality } from './kernel/tile-budgets';
export type { EdgeDecision } from './kernel/tile-edges';
export { analyzeTileEdge, buildingClipBuffer, PROTOMAPS_TILE_BUFFER } from './kernel/tile-edges';
export type { WorldgenTileInput, WorldgenTileOutput } from './kernel/tile-generate';
export {
  generateWorldgenTile,
  generateWorldgenTileSteps,
  tileGroundSampler,
} from './kernel/tile-generate';
export type { WildlifeRangeResolver, WildlifeRangesDoc } from './kernel/wildlife-ranges';
export { createWildlifeRangeResolver, wildlifeRangesSchema } from './kernel/wildlife-ranges';
export type {
  WorldgenWorkerCancel,
  WorldgenWorkerConfigure,
  WorldgenWorkerGenerate,
  WorldgenWorkerHandler,
  WorldgenWorkerPort,
  WorldgenWorkerRequest,
  WorldgenWorkerResult,
} from './kernel/worker-protocol';
export { createWorldgenWorkerHandler } from './kernel/worker-protocol';

import { registerBusinessCatalogSchema } from './kernel/business-catalog-schema';
import { registerEcologyAtlasSchema } from './kernel/ecology-atlas-schema';
import { registerRegionAtlasSchema } from './kernel/region-atlas-schema';
import { registerRegionalCatalogSchema } from './kernel/regional-content-schema';
import { registerStructurePlacementsSchema } from './kernel/structure-index-schema';
import { registerWildlifeRangesSchema } from './kernel/wildlife-ranges';

// Register the atlas format on import so tooling can validate it.
registerRegionAtlasSchema();
registerEcologyAtlasSchema();
registerWildlifeRangesSchema();
registerRegionalCatalogSchema();
registerBusinessCatalogSchema();
registerStructurePlacementsSchema();
