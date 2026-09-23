/**
 * Public kernel surface of `@bendyline/molen-worldgen`.
 *
 * Only the contract belongs here: the generation entry points, the typed shapes of the shipped
 * JSON formats, and the types needed to name a kept signature. Internal helpers (rasterization,
 * polygon math, wall/roof/facade builders, recipe resolution, per-format schema registration)
 * stay module-level exports and are imported directly from `./kernel/<module>` by sibling
 * modules, the client half, and this package's tests.
 */

export { validateArchStyle } from './kernel/archstyle-schema';
export type {
  ArchApplicability,
  ArchFacade,
  ArchFacadeDetails,
  ArchHeightRule,
  ArchLodFeature,
  ArchLodTier,
  ArchMassing,
  ArchMaterialChoice,
  ArchMaterialSpec,
  ArchPalette,
  ArchPaletteEntry,
  ArchProp,
  ArchPropAnchor,
  ArchRoof,
  ArchRoofChoice,
  ArchRoofFeatures,
  ArchRoofType,
  ArchStyleDoc,
  NumberRange,
} from './kernel/archstyle-types';
export type { WorldgenBatchDoc, WorldgenBatchGround } from './kernel/batch-schema';
export { groundSamplerForBatch, validateWorldgenBatch } from './kernel/batch-schema';
export type { PreparedBuildingCell } from './kernel/building-cells';
export { buildingCellTransferables, prepareBuildingCells } from './kernel/building-cells';
export type { FootprintAnalysis, FootprintKind, FootprintOptions, Frame } from './kernel/footprint';
export {
  analyzeFootprint,
  DEFAULT_FOOTPRINT_OPTIONS,
  directionToWorld,
  toLocal,
  toWorld,
} from './kernel/footprint';
export type { Bounds2 } from './kernel/geometry2d';
export { clipRingToRect, pointInRing, ringArea, ringCentroid } from './kernel/geometry2d';
export { DEFAULT_INTERIOR_CATALOG, validateInteriorCatalog } from './kernel/interior-catalog';
export {
  generateInteriorGeometry,
  generateInteriorGeometrySteps,
} from './kernel/interior-geometry';
export { generateInteriorPlan, generateInteriorPlanSteps } from './kernel/interior-plan';
export { interiorToLocal, interiorToWorld } from './kernel/interior-site';
export type {
  BuildingOpening,
  InteriorAlgorithm,
  InteriorCatalogDoc,
  InteriorFixture,
  InteriorFurniture,
  InteriorGenerateOptions,
  InteriorGeometry,
  InteriorPlan,
  InteriorProfile,
  InteriorRoom,
  InteriorRoomUse,
  InteriorSite,
  InteriorStair,
  InteriorStorey,
} from './kernel/interior-types';
export { LANDMARK_CATALOG_HASH, LANDMARK_DEFINITIONS } from './kernel/landmark-catalog';
export type { SignDesign } from './kernel/landmark-models';
export { generateLandmarkModel, generateSignModel, SIGN_DESIGNS } from './kernel/landmark-models';
export { resolveLandmarkCatalogDocuments } from './kernel/landmark-schema';
export type {
  BoxLandmarkDoc,
  LandmarkBoxPart,
  LandmarkDefinitions,
  LandmarkDoc,
  SignLandmarkDoc,
} from './kernel/landmark-types';
export type { BuilderMark } from './kernel/mesh-buffers';
export { MeshBufferBuilder } from './kernel/mesh-buffers';
export type { Wing } from './kernel/rectangles';
export type { BuildingMetrics, SelectionWhen, StyleRule, StyleSelection } from './kernel/rules';
export {
  matchesWhen,
  selectStyle,
  styleRuleSchema,
  unreachableRuleIssues,
  whenIssues,
  whenSchema,
} from './kernel/rules';
export { validateScatter } from './kernel/scatter-schema';
export type {
  ScatterAltitude,
  ScatterAvoid,
  ScatterClustering,
  ScatterDoc,
  ScatterLod,
  ScatterPopulation,
  ScatterRule,
  ScatterTint,
} from './kernel/scatter-types';
export { registerWorldgenSchemas } from './kernel/schema';
export { DOTTED_ID_RE } from './kernel/schema-common';
export type { PackIdentity, VersionedId } from './kernel/seed';
export {
  aspectSeed,
  buildingSeedString,
  hashCoord,
  hashString,
  propSalt,
  quantizedIdentity,
  unit01,
  WORLDGEN_SEED_SCHEME,
} from './kernel/seed';
export { validateStylePack } from './kernel/stylepack-schema';
export type {
  StylePackAttribution,
  StylePackDefaults,
  StylePackDoc,
  StylePackImport,
} from './kernel/stylepack-types';
export type {
  BuildingAppearance,
  BuildingRecord,
  BuildingRequest,
  HeightSampler,
  MaterialSlot,
  MeshBuffers,
  MeshGroup,
  ModelPlacementRequest,
  PlacementSet,
  RGB,
  ScatterExclusion,
  ScatterFrame,
  ScatterPolygon,
  ScatterRequest,
  StorefrontRequest,
  Vec2,
  Vec3,
  WorldgenBudgets,
  WorldgenProgress,
  WorldgenStats,
} from './kernel/types';
export { emptyWorldgenStats, FLAT_GROUND, PLACEMENT_STRIDE } from './kernel/types';

import { registerWorldgenComponents } from './kernel/components';
import { registerWorldgenSchemas } from './kernel/schema';

// Register the worldgen formats and components on import so tooling can validate them.
registerWorldgenSchemas();
registerWorldgenComponents();

export type { QueuedBuilding, WorldgenBatchInput, WorldgenBatchOutput } from './kernel/batch';
export {
  generateWorldgenBatch,
  generateWorldgenBatchSteps,
  queueBuildings,
  worldgenTransferables,
} from './kernel/batch';
export { DEFAULT_WORLDGEN_BUDGETS, normalizeBudgets } from './kernel/budgets';
export type { BoxPlacement, BuildingGenerateInput, BuildingResult } from './kernel/building';
export { generateBuilding } from './kernel/building';
export type { WorldgenBuildingData } from './kernel/components';
export {
  registerWorldgenComponents,
  WORLDGEN_BUILDING_COMPONENT,
  WorldgenBuilding,
} from './kernel/components';
export type { FacadeBands, FacadeStats, FacadeWindows } from './kernel/facade';
export type { GlbMaterialMeta } from './kernel/glb';
export { encodeGlb } from './kernel/glb';
export type { HeightGrid } from './kernel/heights';
export { createHeightSampler, heightGridFromSampler } from './kernel/heights';
export type {
  BuildingHit,
  PropHit,
  WorldgenIndex,
  WorldgenIndexOptions,
} from './kernel/index-query';
export { createWorldgenIndex } from './kernel/index-query';
export type { WorldgenHandle } from './kernel/install';
export { installWorldgen, worldgenIndexOf, worldgenScriptApi } from './kernel/install';
export type { PropPlacement } from './kernel/props';
export type { BuildingRecipe, RecipePart, RecipeProp, RecipeRoof } from './kernel/recipe';
export { buildingMetrics } from './kernel/recipe';
export type { ResolvedStylePack, StylePackDocumentReader } from './kernel/stylepack';
export {
  packIdentity,
  resolveStylePackDocuments,
  stylePackAssetIndex,
  stylePackMaterialRefs,
  validateStylePackBundle,
} from './kernel/stylepack';
