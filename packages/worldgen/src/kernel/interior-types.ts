import type { Bounds2 } from './geometry2d';
import type { MeshBuffers, Vec2, Vec3 } from './types';

export type InteriorAlgorithm =
  | 'aisles'
  | 'dining'
  | 'rooms'
  | 'workplace'
  | 'storage'
  | 'hall'
  | 'residential'
  | 'parking'
  | 'tower'
  | 'atrium'
  | 'auditorium'
  | 'court'
  | 'concourse'
  | 'gallery'
  | 'apparatus';
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
  | 'dresser'
  | 'reception'
  | 'seat-row'
  | 'pew'
  | 'altar'
  | 'screen'
  | 'plinth'
  | 'painting'
  | 'court-lines'
  | 'hoop'
  | 'bleacher'
  | 'ticket-gate'
  | 'fire-engine'
  | 'planter';

export type InteriorRoomUse = 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'stairwell';
export interface InteriorStorey {
  floor: number;
  ceiling: number;
  /** Open to the sky: a car park's roof deck, whose surface is the building's own roof. */
  open?: boolean;
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
  /** Multi-storey floor plates around a lift core. */
  tower?: InteriorTowerProgram;
}
/** How a `tower` profile fills each storey. Module width and depth size a room or a desk bay. */
export interface InteriorTowerProgram {
  /** `open` is desks in one room; the others are partitioned rooms off corridors. */
  plate: 'open' | 'guest' | 'flat' | 'ward' | 'class';
  /** Lift cars in the core. */
  elevators: number;
  /** Depth of the ground-floor lobby behind the entrance, in meters. */
  lobby: number;
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
  /** `open` is an unglazed aperture, such as the gap in a car park's perimeter wall. */
  kind: 'door' | 'window' | 'open';
}
/** One sloped drive lane between two storeys. */
export interface ParkingRamp {
  /** Interior-frame rectangle of the lane; the upper storey's slab is open over all of it. */
  bounds: Bounds2;
  /** Storey indices. */
  lower: number;
  upper: number;
  /** Interior-frame axis the lane climbs along, and toward which end of it. */
  axis: 'x' | 'z';
  climb: 1 | -1;
}
/**
 * The drive layout of a car park, decided with the exterior because the top ramp cuts the roof.
 * Rectangles are in the interior frame. Every storey shares this plate.
 */
export interface ParkingLayout {
  /** Clear width and depth of a stall, and the width of a drive aisle, in meters. */
  stallWidth: number;
  stallDepth: number;
  aisleWidth: number;
  /** Interior-frame axis the drive aisles run along. */
  axis: 'x' | 'z';
  /** Drive aisles, each lined with stalls where the footprint allows. */
  aisles: Bounds2[];
  /** Connectors between aisles. */
  crossAisles: Bounds2[];
  /** Kept free of stalls and columns on every storey: ramp lanes, their turnarounds, door lanes. */
  clear: Bounds2[];
  /** Bottom to top. Empty when no ramp fits; the upper decks then cannot be driven to. */
  ramps: ParkingRamp[];
  /** Driveway quads from each door down to the ground outside (see `InteriorSite.access`). */
  aprons: Vec3[][];
}
/** A lift car. It serves every storey of the site, which only the host can move a viewer between. */
export interface InteriorElevator {
  id: string;
  /** Interior-frame rectangle of the car. */
  bounds: Bounds2;
  /** Which wall opens: the direction from the car to the lobby in front of it. */
  facing: 'x-' | 'x+' | 'z-' | 'z+';
}
/** One partitioned room or open bay on a floor plate, repeated on each built storey. */
export interface InteriorCell {
  id: string;
  bounds: Bounds2;
  /** Which wall faces the corridor, carrying the door. */
  facing: 'x-' | 'x+' | 'z-' | 'z+';
  /** Open-plan bays have no walls of their own. */
  open: boolean;
  /** Set on cells the ground floor gives up to its lobby. */
  upperOnly?: boolean;
}
export interface InteriorTowerPlan {
  /** Site storey indices built here, ascending; `plan.storeys` holds the same storeys. */
  levels: number[];
  corridors: Bounds2[];
  cells: InteriorCell[];
  elevators: InteriorElevator[];
}
/** One shop on a galleria. */
export interface InteriorShop {
  id: string;
  bounds: Bounds2;
  facing: 'x-' | 'x+' | 'z-' | 'z+';
  /** Distinguishes shopfront colors. */
  seed: number;
  /** An end-of-mall department store: bigger, with its whole front open. */
  anchor: boolean;
}
export interface InteriorEscalator {
  /** Interior-frame rectangle of one sloped run. */
  bounds: Bounds2;
  lower: number;
  upper: number;
  axis: 'x' | 'z';
  climb: 1 | -1;
}
export interface InteriorAtriumPlan {
  /** The walkways: the whole floor except shops. */
  gallerias: Bounds2[];
  /** Open to the floors below on every upper storey, inside the walkways. */
  voids: Bounds2[];
  shops: InteriorShop[];
  escalators: InteriorEscalator[];
}
export interface ParkingStall {
  /** Center and the direction a car's nose points when parked forward, in the interior frame. */
  center: Vec2;
  nose: Vec2;
}
/** A parked car in the site's metric frame; the host chooses the vehicle from `seed`. */
export interface ParkedCarSlot {
  id: string;
  level: number;
  position: Vec3;
  /** Rotation about +Y; a vehicle's front is +Z. */
  yaw: number;
  /** Stable draw in [0, 1). */
  seed: number;
}
export interface ParkingPlan {
  /** One plate of stalls, repeated on every storey. */
  stalls: ParkingStall[];
  /** Column centers in the interior frame, repeated on every roofed storey. */
  columns: Vec2[];
  cars: ParkedCarSlot[];
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
  /** Car park drive layout; its presence selects the multi-storey generator. */
  parking?: ParkingLayout;
  /** Extra opaque quads standing in until the interior loads, such as a roof ramp opening. */
  covers?: Vec3[][];
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
  /** Stalls, columns and parked cars of a car park. */
  parking?: ParkingPlan;
  /** Floor plates and lifts of a multi-storey building. */
  tower?: InteriorTowerPlan;
  /** Walkways, shops and voids of a mall. */
  atrium?: InteriorAtriumPlan;
  stats: { candidates: number; rejected: number; truncated: boolean };
}
export interface InteriorGenerateOptions {
  /** The interior catalog, usually the style pack's `interiors`. */
  catalog: InteriorCatalogDoc;
  maxFixtures?: number;
  maxCandidates?: number;
  /** Parked cars across all storeys of one car park (default 1,500; hard ceiling 3,000). */
  maxParkedCars?: number;
  /**
   * The storey a viewer is on, for a building too tall to build at once: a `tower` plan covers
   * only the ground floor and the floors around this one (default 0).
   */
  focus?: number;
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
