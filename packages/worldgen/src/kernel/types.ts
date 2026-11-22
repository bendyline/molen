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

/**
 * Placements a host draws only around its camera, and there every one: the plants `crowns` rules
 * stand on the shrub crowns the ground paints. Farther out the ground's paint carries them, so a
 * batch keeps them all (a few square kilometers of scrub paint tens of thousands of crowns) while
 * a host draws the few hundred within reach (`createNearPlacements` in the client half). They are
 * bucketed into square cells of `cell` meters, so the ones near a point are found without a scan.
 */
export interface NearPlacements {
  /** Model refs, indexed by `model`. */
  models: string[];
  count: number;
  /** `PLACEMENT_STRIDE` floats per instance, as `PlacementSet.data`. */
  data: Float32Array;
  /** Each instance's index into `models`. */
  model: Uint16Array;
  /**
   * Each instance's place in a host's thinning band, as a byte (0 the band's near edge, 255 its
   * far one): its crown's own value (`ScatterGroundCrowns.crown`), so a ground that paints the
   * crowns can hand each one back exactly where its plant stops. Absent, a host thins by its own.
   */
  reach?: Uint8Array;
  /** Cell edge, local meters. */
  cell: number;
  /** Local corner of cell (0, 0), and the cells across and down from it. */
  originX: number;
  originZ: number;
  columns: number;
  rows: number;
  /**
   * The instances of the cell in column `c` and row `r` are `[start[k], start[k + 1])`, with
   * `k = r * columns + c`: they are stored cell by cell, `columns * rows + 1` offsets.
   */
  start: Uint32Array;
}

export interface BuildingAppearance {
  wall?: string;
  trim?: string;
}
/**
 * A name set on a storefront's sign from a glyph atlas, in place of its sign model's own text.
 * Used only when the batch has a glyph atlas set (`WorldgenBatchInput.glyphs`) that holds every
 * character; otherwise the storefront shows `signModel` as before.
 */
export interface StorefrontSign {
  /** The name as shown; the layout may break it over two lines. */
  text: string;
  /** Plate and letter colors, `#rrggbb`. */
  plate: string;
  ink: string;
  /** Accent band along the plate's lower edge. */
  stripe?: string;
  /** Glyph atlas role or face id; default the set's default face. */
  font?: string;
  /** Extra advance between letters, em. */
  letterSpacing?: number;
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
  sign?: StorefrontSign;
}
export interface ModelPlacementRequest {
  identity: string;
  model: string;
  at: Vec2;
  yaw?: number;
  scale?: Vec3;
  /** Instance tint as sRGB-encoded red, green and blue in 0..1; default white (the model's own). */
  color?: Vec3;
}
export type YardFenceKind = 'timber' | 'masonry' | 'rail';
export interface BuildingApproach {
  from: Vec2;
  to: Vec2;
  width: number;
  /** Paving lift above sampled terrain, in meters (default 0.045); clears ground overlays. */
  lift?: number;
}
export interface BuildingYard {
  /** Separate parking approach for a home without an attached garage. */
  driveway?: BuildingApproach;
  /** Open segments: the caller reserves gaps at paths, driveways and public corridors. */
  fence?: { kind: YardFenceKind; height: number; segments: Array<[Vec2, Vec2]> };
}
/** A footprint that is a multi-storey car park rather than an occupied building. */
export interface BuildingParkingRequest {
  /** Storeys below the roof deck, which is parked on too. */
  levels: number;
  /** Mapped vehicle entrances near the footprint, in local meters, strongest first. */
  entrances?: Vec2[];
}
/**
 * A tall feature a building is known by from a distance, built in the style's own wall and roof
 * materials: a square tower under a spire (`spire`) or a low cap (`belfry`), a dome on a drum, a
 * slender round tower with a gallery (`minaret`), or a stepped, tapering tower (`shikhara`).
 */
export type BuildingCrown = 'spire' | 'belfry' | 'dome' | 'minaret' | 'shikhara';

export const BUILDING_CROWNS: readonly BuildingCrown[] = [
  'spire',
  'belfry',
  'dome',
  'minaret',
  'shikhara',
];

export interface BuildingRequest {
  /** Optional lot decoration, owned once by the main house rather than by each building part. */
  yard?: BuildingYard;
  /** Reserved approach from a public boundary to an entrance, in local meters. */
  access?: BuildingApproach & { garage?: boolean };
  /** Admission/detail priority before footprint area (default 0); inferred scenery can use -1. */
  priority?: number;
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
  /**
   * Outline edge indices shared with a neighbouring building: party walls. The wall is still
   * built, since neighbours differ in height, but it takes no windows, doors, trim or
   * storefronts, and a pitched roof turns its ridge to the row (the style's `roof.partyRidge`).
   */
  partyEdges?: number[];
  /**
   * The most storeys the style may guess where neither `height` nor `levels` is supplied: what
   * the buildings around it justify. A use says what a building is for, not how tall it is.
   */
  fallbackLevelsMax?: number;
  /** Towers and domes the building carries (a place of worship's, say), in the style's materials. */
  crown?: BuildingCrown[];
  /** Bypass style rules with an explicit style id. */
  style?: string;
  /** Optional identity palette; explicit structural measurements still win. */
  appearance?: BuildingAppearance;
  storefronts?: StorefrontRequest[];
  /** Confirmed ground-floor use, independent of the exterior building classification. */
  interiorLabels?: string[];
  /** Model decks, ramps and bays instead of rooms. */
  parking?: BuildingParkingRequest;
}

export interface ScatterPolygon {
  label: string;
  ring: Vec2[];
  holes?: Vec2[][];
  /** Density multiplier for this polygon (default 1). */
  density?: number;
  /** Optional owner seed for acceptance and appearance; the shared placement grid stays fixed. */
  seed?: number;
  /**
   * The ground's appearance class here: the key a `crowns` rule (and `surface.detail`) looks its
   * brush up by. Defaults to `label`.
   */
  appearance?: string;
  /**
   * False for a polygon scatter alone sees and the ground does not draw (an inferred yard):
   * `crowns` rules look through it to the polygon beneath, whose crowns the ground paints.
   */
  ground?: boolean;
}

export interface ScatterExclusion {
  ring?: Vec2[];
  holes?: Vec2[][];
  polyline?: Vec2[];
  /** Source category, used by habitat proximity rules (e.g. river, lake, ocean). */
  label?: string;
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
  /** Buildings a batch gives real geometry (walls and a roof at least), largest first. */
  maxBuildings: number;
  /**
   * Buildings past `maxBuildings` still drawn, as stand-ins (instanced boxes; gabled for pitched
   * roofs): default 0, which leaves them out. A stand-in costs no mesh and a few dozen bytes, so
   * a dense batch can keep every footprint visible where the count budget once cut it off.
   */
  maxStandIns?: number;
  maxBuildingVertices: number;
  /** Buildings eligible for extra detail after reserving simplified roofs and facades for the batch. */
  detailedCount: number;
  /** Instances one scatter rule may emit per batch. */
  maxInstancesPerRule: number;
  /** Non-building instances per batch: signs, mapped props, roof props, then scatter; 0 disables them. */
  maxInstances: number;
  /**
   * Named storefront signs per batch (see `StorefrontRequest.sign`); default 1,000. They count
   * against `maxInstances` first, as sign models do.
   */
  maxSigns?: number;
  /** Model varieties admitted by procedural scatter (authored identity models are separate). */
  maxPropModels: number;
  /**
   * Instances scatter rules on the `groundcover` layer may emit per batch: knee-high near detail
   * with its own budget, so it never thins the canopy. 0 disables ground cover.
   */
  maxGroundCoverInstances: number;
  /** Model varieties admitted for ground cover, on top of `maxPropModels`. */
  maxGroundCoverModels: number;
  /** Separate shoulder-height brush pool; omitted or zero disables it. */
  maxUnderstoryInstances?: number;
  maxUnderstoryModels?: number;
  maxAgricultureInstances?: number;
  maxAgricultureModels?: number;
  /** Planted ornamental vegetation (the `garden` layer); omitted or zero disables it. */
  maxGardenInstances?: number;
  maxGardenModels?: number;
  /**
   * Plants `crowns` rules may stand on the ground's painted crowns per batch, for
   * `WorldgenBatchOutput.near` (default: every one). A host bounds it to the memory a batch may
   * hold; past it, a uniform subset by acceptance draw stays.
   */
  maxNearInstances?: number;
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
  /** Bytes of every placement, `near` included. */
  instanceBytes: number;
  placementsByModel: Record<string, number>;
  /** Plants in `WorldgenBatchOutput.near`, which `placementsByModel` does not count. */
  nearPlacements: number;
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
    nearPlacements: 0,
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
