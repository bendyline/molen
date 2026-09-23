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
  SemanticAdapterOptions,
  SemanticBatch,
  TileGeometry,
} from './kernel/semantic-adapter';
export {
  landcoverAreaOf,
  scatterRequestFromTile,
  semanticTileToBatch,
} from './kernel/semantic-adapter';
export type { WorldgenQualityPreset } from './kernel/tile-budgets';
export { worldgenTileBudgetForQuality } from './kernel/tile-budgets';
export type { EdgeDecision } from './kernel/tile-edges';
export { analyzeTileEdge, PROTOMAPS_TILE_BUFFER } from './kernel/tile-edges';
export type { WorldgenTileInput, WorldgenTileOutput } from './kernel/tile-generate';
export {
  generateWorldgenTile,
  generateWorldgenTileSteps,
  tileGroundSampler,
} from './kernel/tile-generate';
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
import { registerRegionAtlasSchema } from './kernel/region-atlas-schema';

// Register the atlas format on import so tooling can validate it.
registerRegionAtlasSchema();
registerBusinessCatalogSchema();
