import './pack';
import './source-bundle';

export * from './aircraft';
export type {
  AssetBounds,
  AssetCollision,
  AssetHull,
  AssetSidecar,
  AssetStats,
  AssetTrimeshHeader,
} from './assets';
export { decodeCollisionTrimesh, encodeCollisionTrimesh } from './assets';
export type { PayloadCheck } from './commands';
export { commandPayloadValidator, compileCommandPayload } from './commands';
export type {
  ComponentEntry,
  ComponentMeta,
  ComponentRegistry,
  ComponentSummary,
  ComponentValidateOptions,
  DeclaredComponent,
  RegisterComponentOptions,
  RenderableKindMeta,
} from './components';
export {
  componentIssues,
  componentMapIssues,
  componentNames,
  createComponentRegistry,
  getComponent,
  listComponents,
  listRenderableKinds,
  registerComponent,
  registerDeclaredComponents,
  registerRenderableKind,
  unregisterComponent,
} from './components';
export type { SchemaKind, SchemaKindMap, ValidateOptions } from './formats';
export { detectKind, validate, validateByKind } from './formats';
export type { GamepadAxisBinding, GamepadButtonBinding, InputDevice, InputProfile } from './input';
export { inputProfileIssues, inputProfileSchema } from './input';
export type {
  ValidationFailure,
  ValidationIssue,
  ValidationResult,
  ValidationSuccess,
} from './issues';
export { blockingIssues, formatIssues, noticeIssues } from './issues';
export type { JsonObject, JsonPrimitive, JsonValue } from './json';
export { deepMergeJson } from './merge';
export type { ModelSignalBinding, ModelSignalSource, ModelSignalSpec } from './model-signals';
export { modelSignalsSchema } from './model-signals';
export type {
  PackBlock,
  PackEntry,
  PackIndex,
  PackIndexEntry,
  PackManifest,
  PackSourceConfig,
} from './pack';
export { PACK_MANIFEST_ENTRY, PACK_RESERVED_PREFIX } from './pack';
export type {
  CommandMessage,
  ControlAction,
  ControlMessage,
  DeltaMessage,
  DiagMessage,
  KernelInbound,
  KernelOutbound,
  KeyframeMessage,
  MessageLink,
  ReadyMessage,
} from './protocol';
export type { LegacySchemaVersion, SchemaEntry, SchemaMeta, SchemaSummary } from './registry';
export {
  getLegacySchema,
  getSchema,
  jsonSchemaId,
  listSchemas,
  registerLegacySchema,
  registerSchema,
  SCHEMA_ID_BASE,
  schemaKinds,
} from './registry';
export type { ResolvedEntityType, ResolvedTypes, SceneResolveOptions } from './scene-resolve';
export { resolveEntityComponents, resolvePrefab } from './scene-resolve';
export type {
  CustomSkyData,
  EarthObserver,
  EarthSkyData,
  SkyAppearance,
  SkyBodyData,
  SkyData,
  SkyPalette,
  SkyTime,
} from './sky';
export { skySchema } from './sky';
export type {
  SourceBundle,
  SourceBundleModel,
  SourceBundleNamedFile,
} from './source-bundle';
export type { TypeIndex, TypeIndexEntry } from './type-registry';
export {
  buildTypeIndex,
  checkTypes,
  findReservation,
  namespaceCovers,
  resolveAllTypes,
  resolveType,
  sceneTypeRefIssues,
} from './type-registry';
export type {
  Assertion,
  AssertionDoc,
  Command,
  CommandQueueState,
  ComponentMap,
  ContentIdentity,
  ContentIdentityEntry,
  CustomComponentDecl,
  Delta,
  EngineEvent,
  EntityId,
  EntityTypeDef,
  EventAssertion,
  InputEmitRule,
  Keyframe,
  NamespaceReservation,
  Prefab,
  ProjectManifest,
  ProjectPackRef,
  Quat,
  ReplayFixture,
  RngState,
  SceneCamera,
  SceneCommandDef,
  SceneEntity,
  SceneInput,
  SceneManifest,
  ScenePhysics,
  SceneTerrainRef,
  ScriptRef,
  SelectAssertion,
  SelectOp,
  TypesDoc,
  Vec3,
} from './types';
export type { VehicleInteriorBinding, VehicleInteriorSpec } from './vehicle-interior';
export { vehicleInteriorSchema } from './vehicle-interior';
export type {
  VehicleData,
  VehicleKind,
  VehiclePlacement,
  VehicleSpec,
  VehicleVisualSpec,
} from './vehicles';
export type { ResolvedWeather, WeatherData, WeatherProfile } from './weather';
export { resolveWeather, weatherProfile, weatherSchema } from './weather';
export { nearest, nearestWithDistance } from './zod-issues';
