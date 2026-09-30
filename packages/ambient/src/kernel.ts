/**
 * @bendyline/molen-ambient/kernel — ambient life: a transport network built from map tiles,
 * documents or script polylines, and lane-following NPC cars, pedestrians, trains and aircraft
 * spawned around an observer. Three-free and SES-free (only kernel subpaths); every number goes
 * through dmath.
 */

export { idmAcceleration, stoppingDistance } from './kernel/agents/idm';
export type { SignalColor, SignalTiming } from './kernel/agents/signals';
export { allRed, signalColor, signalTiming } from './kernel/agents/signals';
export type { AgentEnv, AmbientSolid } from './kernel/agents/step';
export { agentRotation, agentSample, chooseNext, stepAgents, walkBack } from './kernel/agents/step';
export type { AmbientCapabilityOptions } from './kernel/capability';
export { ambientCapability } from './kernel/capability';
export type {
  AmbientAgentData,
  AmbientAirCorridor,
  AmbientKind,
  AmbientObserverData,
  AmbientObserverState,
  AmbientRoleData,
  AmbientRoleVisual,
  AmbientStateData,
} from './kernel/components';
export {
  AMBIENT_ENTITY,
  AMBIENT_KINDS,
  AmbientAgent,
  AmbientObserver,
  AmbientRole,
  AmbientState,
} from './kernel/components';
export type {
  TransportNetworkAerodrome,
  TransportNetworkDocument,
  TransportNetworkPoint,
  TransportNetworkSignal,
  TransportNetworkStation,
  TransportNetworkWay,
} from './kernel/graph/doc';
export { TRANSPORT_NETWORK_EXAMPLE, TRANSPORT_NETWORK_FORMAT } from './kernel/graph/doc';
export type { EdgeDraft, WorldPoi } from './kernel/graph/drafts';
export { classifyFeature, clipPolyline, featureDrafts, KIND_SPEED } from './kernel/graph/drafts';
export { networkToDocument } from './kernel/graph/export';
export { pseudoAngle } from './kernel/graph/junctions';
export type {
  AmbientPolyline,
  AmbientTileInput,
  TransportNetworkOptions,
  TransportNetworkStats,
} from './kernel/graph/network';
export { TransportNetwork } from './kernel/graph/network';
export type { PlanarNode, PlanarPiece, PlanarResult } from './kernel/graph/planar';
export { planarSplit } from './kernel/graph/planar';
export {
  edgeHeight,
  laneCoordinate,
  laneEdgeDistance,
  laneSample,
  sampleConnector,
  sampleLaneBody,
} from './kernel/graph/sample';
export type { EdgeSpan } from './kernel/graph/spatial';
export { GRID_CELL, LaneGrid } from './kernel/graph/spatial';
export type {
  JunctionArm,
  JunctionControl,
  LaneMovement,
  LaneSample,
  LaneStop,
  RoadKind,
  TransportClass,
  TransportCrossing,
  TransportEdge,
  TransportJunction,
  TransportLane,
  TransportNode,
  TransportRunway,
  TurnKind,
} from './kernel/graph/types';
export { fmix32, unit01 } from './kernel/ids';
export type { AmbientBox, AmbientHandle, AmbientOptions, AmbientStats } from './kernel/install';
export { ambientOf, installAmbient } from './kernel/install';
export {
  AMBIENT_AGENT_COMPONENT,
  AMBIENT_OBSERVER_COMPONENT,
  AMBIENT_ROLE_COMPONENT,
  AMBIENT_STATE_COMPONENT,
  registerAmbientSchema,
} from './kernel/schema';
export { ambientScriptApi } from './kernel/script-api';
export type {
  AmbientBudget,
  AmbientClassPolicy,
  AmbientPolicy,
  DeepPartial,
  DriverParams,
} from './kernel/spawn/policy';
export { DEFAULT_POLICY, mergePolicy, policyForBudget } from './kernel/spawn/policy';
export type { ObserverView } from './kernel/spawn/spawner';
export type {
  AmbientPedestrianType,
  AmbientSpawnInfo,
  AmbientTemplate,
  AmbientTypes,
  AmbientVehicleType,
} from './kernel/templates';
export { CAR_COLORS, DEFAULT_TEMPLATES, DEFAULT_TYPES, pickWeighted } from './kernel/templates';

import { registerAmbientSchema } from './kernel/schema';

// Register the ambient components, renderable kind and format on import so tooling can validate
// scenes and documents that use them.
registerAmbientSchema();
