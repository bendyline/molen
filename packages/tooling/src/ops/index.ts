// Importing the capability packages registers their schemas (matgraph, terrain, worldgen,
// region-atlas, cameratrack) into the shared registry so validate/rasterize/export see them.
import '@bendyline/molen-materials';
import '@bendyline/molen-figures/kernel';
import '@bendyline/molen-terrain/kernel';
import '@bendyline/molen-worldgen/kernel';
import '@bendyline/molen-worldgen-earth/kernel';
import { registerCameraTrackSchema } from '@bendyline/molen-client/camera-track';
import { registerExperiencePlaySchema } from './experience-play';

registerCameraTrackSchema();
registerExperiencePlaySchema();

export type { ImportAssetInput, ImportAssetOutput } from './asset-import';
export { importAsset } from './asset-import';
export type {
  InspectAssetInput,
  InspectAssetOutput,
  ListAssetsOutput,
} from './asset-inspect';
export { inspectAsset, listAssets } from './asset-inspect';
export type {
  PackAssetInput,
  PackAssetOutput,
  PackedAsset,
  PackedTexture,
  PackTextureMode,
} from './asset-pack';
export { formatBytes, formatPacked, packAsset } from './asset-pack';
export type { AssetShotInput, AssetShotOutput } from './asset-shot';
export { screenshotAsset } from './asset-shot';
export type { StageAssetsInput, StageAssetsOutput, StagedAsset } from './asset-stage';
export { ASSET_INDEX_FILE, stageAssets } from './asset-stage';
export type { SceneBuildOptions } from './build';
export { assetFileIndex, collisionResolvers, prepareSceneBuilder } from './build';
export type { CameraSpec, CaptureCamera, OrthoSpec } from './camera';
export { cameraFromManifest } from './camera';
export type { CheckScriptsInput, CheckScriptsOutput, ScriptDiagnostic } from './check-scripts';
export { checkScripts } from './check-scripts';
export type { OpDescriptor, OpParam } from './describe';
export { describeOps, formatOp, OPS_CATALOG } from './describe';
export type { DocHit, SearchDocsInput, SearchDocsOutput } from './docs';
export { locateDocsRoot, searchDocs } from './docs';
export type { DriveAction, DriveFrame, DriveInput, DriveOutput } from './drive';
export { driveScene } from './drive';
export { guardOp, opError } from './errors';
export type {
  ExperiencePlayAction,
  ExperiencePlayDiagnostic,
  ExperiencePlayFrame,
  ExperiencePlayInput,
  ExperiencePlayOutput,
  ExperiencePlayScenario,
  ExperienceServer,
} from './experience-play';
export {
  parseExperiencePlayScenario,
  playExperience,
  registerExperiencePlaySchema,
  startExperienceServer,
} from './experience-play';
export type { ExportFramesInput, ExportFramesOutput } from './export-frames';
export { exportFrames } from './export-frames';
export type {
  FigurePresetEntry,
  FigurePresetsInput,
  FigurePresetsOutput,
} from './figure-presets';
export { listFigurePresets } from './figure-presets';
export type {
  FigureLineup,
  FigurePreviewFrame,
  FigurePreviewInput,
  FigurePreviewOutput,
  FigurePreviewStats,
} from './figure-preview';
export { previewFigure } from './figure-preview';
export type { GenerateTypesInput, GenerateTypesOutput } from './generate-types';
export { generateTypes, renderTypesModule } from './generate-types';
export type {
  BuildPackInput,
  BuildPackOutput,
  ExtractPackInput,
  ExtractPackOutput,
  FetchedPack,
  FetchPackInput,
  FetchPackOutput,
  InspectPackInput,
  InspectPackOutput,
  VerifyPackIssue,
  VerifyPackOutput,
} from './pack';
export {
  buildContentPack,
  extractContentPack,
  fetchContentPack,
  inspectContentPack,
  verifyContentPack,
} from './pack';
export type { NodePmtilesArchive } from './pmtiles-node';
export { NodeFileRangeSource, openNodePmtiles } from './pmtiles-node';
export type {
  CheckTypesOutput,
  ListTypesOutput,
  ProjectInfoInput,
  ProjectInfoOutput,
  ReserveNamespaceInput,
  ReserveNamespaceOutput,
} from './project-ops';
export {
  checkTypesOp,
  listTypes,
  projectInfo,
  reserveNamespace,
} from './project-ops';
export type { RasterizeInput, RasterizeOutput } from './rasterize';
export { rasterizeMaterial } from './rasterize';
export type {
  DiffSnapshotsInput,
  DiffSnapshotsOutput,
  RunReplayInput,
  RunReplayOutput,
} from './replay';
export { diffSnapshots, runReplayFile } from './replay';
export type { ScaffoldInput, ScaffoldOutput } from './scaffold';
export { scaffoldExperience } from './scaffold';
export type { GetComponentOutput, GetSchemaOutput } from './schema';
export { getComponentOp, getSchemaOp, listComponentsOp, listSchemasOp } from './schema';
export type {
  RenderStats,
  ScreenshotInput,
  ScreenshotOutput,
} from './screenshot';
export { screenshotScene } from './screenshot';
export type { SimulateInput, SimulateOutput } from './simulate';
export { runSimulation } from './simulate';
export type { TestTypesInput, TestTypesOutput, TypeTestResult } from './types-test';
export { testTypes } from './types-test';
export type { ApplyUvPaintInput, ApplyUvPaintOutput } from './uvpaint';
export { applyUvPaintOp } from './uvpaint';
export type { ValidateInput, ValidateOutput } from './validate';
export { validateAsset } from './validate';
export type { SimWatchHandle, SimWatchInput } from './watch';
export { simWatch } from './watch';
export type { WorldgenBakeInput, WorldgenBakeOutput } from './worldgen-bake';
export { bakeWorldgen, glbMaterialsForBuffers } from './worldgen-bake';
export type { LineupShape, LoadedStylePackFiles } from './worldgen-pack';
export {
  batchInputFromDoc,
  contentPacksFor,
  LINEUP_SHAPES,
  lineupBatchDoc,
  loadBatchDoc,
  loadRegionAtlasFromDisk,
  loadStylePackFromDisk,
  parseOutline,
} from './worldgen-pack';
export type {
  WorldgenPreviewFrame,
  WorldgenPreviewInput,
  WorldgenPreviewOutput,
  WorldgenPreviewRenderStats,
} from './worldgen-preview';
export { previewWorldgen } from './worldgen-preview';
export type { WorldgenStatsInput, WorldgenStatsOutput } from './worldgen-stats';
export { formatWorldgenStats, worldgenStats } from './worldgen-stats';
