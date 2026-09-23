/**
 * Plain-data contracts of the world-agnostic worldgen core.
 *
 * Everything is local-space meters (+x right, +z down/south, +y up), opaque labels, and typed
 * arrays. Nothing here knows about map projections or any particular map vocabulary: a
 * geographic adapter and a dungeon generator hand the same shapes to the same functions.
 */

import type { InteriorSite } from './interior-types';

export type Vec2 = [x: number, z: number];
export type Vec3 = [x: number, y: number, z: number];
/** Linear RGB, each channel 0..1. */
export type RGB = [r: number, g: number, b: number];

/** Ground queries in local meters. A terrain `Heightfield` satisfies it structurally. */
export interface HeightSampler {
  sampleHeight(x: number, z: number): number;
  /** Slope 0..1 (0 = flat, 1 = vertical). */
  slopeAt(x: number, z: number): number;
  normalAt(x: number, z: number): Vec3;
}

/** A perfectly flat ground plane at y = 0. */
export const FLAT_GROUND: HeightSampler = Object.freeze({
  sampleHeight: (): number => 0,
  slopeAt: (): number => 0,
  normalAt: (): Vec3 => [0, 1, 0],
});

export type MaterialSlot = 'wall' | 'roof' | 'trim' | 'foundation' | 'window' | 'door';

/** Fixed slot order used when concatenating mesh groups. */
export const MATERIAL_SLOTS: readonly MaterialSlot[] = [
  'wall',
  'roof',
  'trim',
  'foundation',
  'window',
  'door',
];

export interface MeshGroup {
  /** Offset into `indices` of the group's first index. */
  start: number;
  /** Number of indices in the group. */
  count: number;
  slot: MaterialSlot;
  /** materialRef string (`palette:#rrggbb`, `matgraph:<id>`, `pixelgrid:<id>`). */
  materialRef: string;
}

export interface MeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  /** Per-slot UV convention: walls in meters or (bay, floor) cells, roofs in meters. */
  uvs: Float32Array;
  /** 8-bit linear RGB triplets. */
  colors: Uint8Array;
  indices: Uint32Array;
  groups: MeshGroup[];
  vertexCount: number;
  triangleCount: number;
  bytes: number;
}

/** Floats per instance in `PlacementSet.data`: x, y, z, yaw, sx, sy, sz, r, g, b. */
export const PLACEMENT_STRIDE: number = 10;

export interface PlacementSet {
  setId: string;
  /** Asset id or `builtin:<name>`. */
  modelRef: string;
  count: number;
  /** `PLACEMENT_STRIDE` floats per instance; x/z local meters, y absolute, yaw in radians. */
  data: Float32Array;
}

export interface BuildingAppearance {
  wall?: string;
  trim?: string;
}
export interface StorefrontRequest {
  identity: string;
  /** Desired frontage anchor in local meters, projected onto an exterior edge. */
  at: Vec2;
  signModel: string;
  /** Native sign width/height; default 4 x 1.35 meters, base Y=0, front +Z. */
  signSize?: Vec2;
  accent: string;
  width?: number;
}
export interface ModelPlacementRequest {
  identity: string;
  model: string;
  at: Vec2;
  yaw?: number;
  scale?: Vec3;
}
export interface BuildingRequest {
  /** Caller-owned stable identity, e.g. `f:123456` or `room:hall-1`; seeds every look choice. */
  identity: string;
  /** Opaque category labels, most specific first (e.g. `['house', 'building']`). */
  labels: string[];
  /** Opaque surrounding label (e.g. the land class the outline sits in). */
  context?: string;
  /** Local meters, any orientation; the analysis canonicalizes it. */
  outline: Vec2[];
  holes?: Vec2[][];
  /** Shared ground-fitting footprint for related parts, in local meters. */
  groundOutline?: Vec2[];
  /** Known total height above the base, in meters. */
  height?: number;
  /** Known floor count. */
  levels?: number;
  /** Height of the lowest floor above the base (skyways, cantilevers). */
  minHeight?: number;
  /** The outline is a cut piece of a larger shape: flat roof, seam walls, no ownership choices. */
  clipped?: boolean;
  /** Outline edge indices that lie on a cut boundary. */
  seamEdges?: number[];
  /** Bypass style rules with an explicit style id. */
  style?: string;
  /** Optional identity palette; explicit structural measurements still win. */
  appearance?: BuildingAppearance;
  storefronts?: StorefrontRequest[];
  /** Confirmed ground-floor use, independent of the exterior building classification. */
  interiorLabels?: string[];
}

export interface ScatterPolygon {
  label: string;
  ring: Vec2[];
  holes?: Vec2[][];
  /** Density multiplier for this polygon (default 1). */
  density?: number;
  /** Optional owner seed for acceptance and appearance; the shared placement grid stays fixed. */
  seed?: number;
}

export interface ScatterExclusion {
  ring?: Vec2[];
  polyline?: Vec2[];
  /** Polyline width in meters (the exclusion covers `width / 2 + radius` on each side). */
  width?: number;
  /** Extra clearance in meters around the ring or polyline. */
  radius: number;
  /** Which avoidance radius from the scatter rules applies (`roads`, `buildings`, `water`). */
  kind?: 'roads' | 'buildings' | 'water';
}

export interface ScatterFrame {
  /** Local coordinate of the global anchor origin; cells are laid out relative to it. */
  originX: number;
  originZ: number;
  /** Frame units per meter (1 for metric frames). */
  unitsPerMeter: number;
}

export interface ScatterRequest {
  polygons: ScatterPolygon[];
  exclusions: ScatterExclusion[];
  /** Only candidates inside this local rectangle are emitted. */
  emitBounds: [minX: number, minZ: number, maxX: number, maxZ: number];
  frame: ScatterFrame;
  /** Detail keep fraction in (0, 1]; smaller values yield nested subsets. */
  keep: number;
}

export interface WorldgenBudgets {
  maxBuildings: number;
  maxBuildingVertices: number;
  /** Buildings eligible for extra detail after reserving simplified roofs and facades for the batch. */
  detailedCount: number;
  /** Instances one scatter rule may emit per batch. */
  maxInstancesPerRule: number;
  /** Non-building instances per batch: signs, mapped props, roof props, then scatter; 0 disables them. */
  maxInstances: number;
  /** Model varieties admitted by procedural scatter (authored identity models are separate). */
  maxPropModels: number;
  maxMaterialGroups: number;
}

export interface BuildingRecord {
  identity: string;
  styleId: string;
  footprintKind: string;
  roof: string;
  base: number;
  height: number;
  area: number;
  centroid: Vec2;
  bounds: [minX: number, minZ: number, maxX: number, maxZ: number];
  tier: number;
  /** Structural access metadata only; plans and furnishings are generated on demand. */
  interior?: InteriorSite;
}

export interface WorldgenStats {
  buildingsIn: number;
  buildingsRendered: number;
  buildingsBoxed: number;
  buildingsSkipped: number;
  buildingsDropped: number;
  vertices: number;
  triangles: number;
  meshBytes: number;
  instanceBytes: number;
  placementsByModel: Record<string, number>;
  styles: Record<string, number>;
  footprintKinds: Record<string, number>;
  roofs: Record<string, number>;
  capFailures: number;
  /** Buildings using vertex colors to satisfy geometry or material budgets. */
  materialsCollapsed: number;
}

export interface WorldgenProgress {
  done: number;
  total: number;
}

export function emptyWorldgenStats(): WorldgenStats {
  return {
    buildingsIn: 0,
    buildingsRendered: 0,
    buildingsBoxed: 0,
    buildingsSkipped: 0,
    buildingsDropped: 0,
    vertices: 0,
    triangles: 0,
    meshBytes: 0,
    instanceBytes: 0,
    placementsByModel: {},
    styles: {},
    footprintKinds: {},
    roofs: {},
    capFailures: 0,
    materialsCollapsed: 0,
  };
}

export function countKey(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}
