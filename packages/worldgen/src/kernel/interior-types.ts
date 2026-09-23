import type { Bounds2 } from './geometry2d';
import type { MeshBuffers, Vec2, Vec3 } from './types';

export type InteriorAlgorithm =
  | 'aisles'
  | 'dining'
  | 'rooms'
  | 'workplace'
  | 'storage'
  | 'hall'
  | 'residential';
export type InteriorFurniture =
  | 'shelf'
  | 'checkout'
  | 'table'
  | 'counter'
  | 'bed'
  | 'sofa'
  | 'desk'
  | 'rack'
  | 'bench'
  | 'wardrobe'
  | 'kitchen'
  | 'vanity'
  | 'toilet'
  | 'shower'
  | 'rug'
  | 'coffee-table'
  | 'bookcase'
  | 'plant'
  | 'dresser';

export type InteriorRoomUse = 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'stairwell';
export interface InteriorStorey {
  floor: number;
  ceiling: number;
}
export interface InteriorStair {
  /** Local rectangle, ascending along +Z. The whole run is a slab opening above. */
  bounds: Bounds2;
  lower: number;
  upper: number;
  steps: number;
}

/** JSON authoring surface. Labels are opaque; geographic adapters supply their vocabulary. */
export interface InteriorProfile {
  id: string;
  version: number;
  labels: string[];
  algorithm: InteriorAlgorithm;
  aisleWidth: number;
  moduleWidth: number;
  moduleDepth: number;
  furnishing: InteriorFurniture;
  density: number;
  palette: { floor: string; wall: string; wood: string; accent: string };
  /** Residential topology; upper floors are generated only when both envelope and stairs fit. */
  residential?: { upstairs: boolean; stairWidth: number; runPerRise: number; minRoomWidth: number };
}
export interface InteriorCatalogDoc {
  format: 'molen/interior-catalog@1';
  profiles: InteriorProfile[];
  fallback: string;
}
/** Distances along one canonical ring edge and absolute heights. */
export interface BuildingOpening {
  edge: number;
  start: number;
  end: number;
  bottom: number;
  top: number;
  kind: 'door' | 'window';
}
/** Cheap structural descriptor; contains no generated floor plan or furniture. */
export interface InteriorSite {
  identity: string;
  labels: string[];
  outline: Vec2[];
  holes: Vec2[][];
  bounds: Bounds2;
  floor: number;
  ceiling: number;
  /** Available storeys inferred from the exterior envelope; layouts may use fewer. */
  storeys?: InteriorStorey[];
  openings: BuildingOpening[];
  entrance: Vec2;
  inward: Vec2;
  /** Four ramp corners: threshold left/right, outside right/left. */
  access: Vec3[];
}
export interface InteriorFixture {
  id: string;
  kind: InteriorFurniture;
  level?: number;
  variant?: number;
  /** Interior frame: X runs along the entrance, Z runs inward. */
  bounds: Bounds2;
}
export interface InteriorRoom {
  id: string;
  bounds: Bounds2;
  use: InteriorFurniture;
  program?: InteriorRoomUse;
  level?: number;
  /** Side facing the shared hallway; distance along Z to the center of its open doorway. */
  door?: { side: 'left' | 'right'; at: number };
}
export interface InteriorPlan {
  identity: string;
  profile: string;
  seed: string;
  site: InteriorSite;
  storeys: InteriorStorey[];
  stairs: InteriorStair[];
  rooms: InteriorRoom[];
  fixtures: InteriorFixture[];
  /** Reserved routes in the entrance frame; furniture cannot occupy these cells. */
  circulation: Bounds2[];
  stats: { candidates: number; rejected: number; truncated: boolean };
}
export interface InteriorGenerateOptions {
  catalog?: InteriorCatalogDoc;
  maxFixtures?: number;
  maxCandidates?: number;
}
export interface InteriorGeometry {
  structure: MeshBuffers;
  furniture: MeshBuffers;
  glass: MeshBuffers;
  /** Visible step geometry is decorative; use this smooth solid proxy for character collision. */
  steps: MeshBuffers;
  collision: MeshBuffers;
  bytes: number;
}
