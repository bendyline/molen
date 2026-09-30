/**
 * The transport graph: nodes, edges (polylines in world metres), lanes (directed, offset from an
 * edge's centreline) and junctions. Built from streamed map tiles, transport-network documents or
 * script polylines. The graph is derived data kept outside world state; agents refer to lanes by
 * id, so the ids are deterministic for a given input.
 */

import type { TerrainLinePath } from '@bendyline/molen-terrain/kernel';

/** Which agents a lane serves. */
export type TransportClass = 'road' | 'rail' | 'walk' | 'air';

/** Finer classification used for speeds, spawn preferences and routing weights. */
export type RoadKind =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'street'
  | 'living'
  | 'service'
  | 'path'
  | 'crossing'
  | 'rail'
  | 'tram';

export type TurnKind = 'straight' | 'left' | 'right' | 'uturn' | 'merge';

/** An endpoint or split point shared by edges. */
export interface TransportNode {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly layer: number;
  readonly class: TransportClass;
  /** Incident edge ids (both directions). */
  readonly edges: string[];
  /** Owning tile key (`'*'` for documents and polylines). */
  readonly tile: string;
  /** True when the node lies on its tile's boundary (a stitching candidate). */
  readonly border: boolean;
  /** The node in a neighbouring tile this border node is stitched to, if any. */
  link?: string;
}

/** A polyline between two nodes. Lanes run along it in either direction. */
export interface TransportEdge {
  readonly id: string;
  readonly tile: string;
  readonly class: TransportClass;
  readonly kind: RoadKind;
  readonly from: string;
  readonly to: string;
  /** World metres, [x, z] per vertex, with cumulative distances. */
  readonly path: TerrainLinePath;
  /** Surface height per path vertex (same indexing as `path.points`). */
  readonly ys: Float64Array;
  readonly width: number;
  /** Design speed in m/s before per-agent variation. */
  readonly speed: number;
  readonly layer: number;
  readonly bridge: boolean;
  readonly tunnel: boolean;
  readonly link: boolean;
  readonly oneway: boolean;
  readonly lanes: string[];
  /** Source feature name, when mapped. */
  readonly name?: string;
}

/** A directed lane. `s` runs from 0 at the lane start to `length` at its end. */
export interface TransportLane {
  readonly id: string;
  readonly edge: string;
  readonly class: TransportClass;
  /** 1 travels the edge path forward (from → to), -1 backward. */
  readonly dir: 1 | -1;
  /** 0 = innermost (nearest the centreline for two-way roads, leftmost for one-way). */
  readonly index: number;
  /** Signed lateral offset from the centreline, positive to the right of travel. */
  readonly offset: number;
  /** Edge-path distance trimmed from the start and end (junction cores). */
  trimStart: number;
  trimEnd: number;
  length: number;
  /** Surface lift above the edge's baked heights (sidewalks sit on the kerb). */
  readonly lift: number;
  /** Node the lane starts from and ends at. */
  readonly start: string;
  readonly end: string;
  /** Outgoing movements at the lane end. */
  next: LaneMovement[];
  /** Stop points along the lane: stations, stops, crossings. */
  stops: LaneStop[];
}

export interface LaneStop {
  /** Edge-path distance of the stop (convert with `laneCoordinate`). */
  readonly d: number;
  readonly kind: 'station' | 'bus' | 'crossing' | 'level-crossing';
  /** Station/crossing id, used to remember a served stop. */
  readonly id: string;
  /** Stations: dwell time in seconds (default: a seeded 20–40 s). */
  readonly dwell?: number;
}

/** A way from the end of one lane onto the start of another, through a connector curve. */
export interface LaneMovement {
  readonly to: string;
  readonly turn: TurnKind;
  /** Junction whose core this movement crosses (absent at plain through nodes). */
  readonly junction?: string;
  /** Arm-pair key `inArm * armCount + outArm` within the junction. */
  readonly key: number;
  readonly weight: number;
  /** Connector: quadratic Bezier from the lane end, via a control point, to the next lane start. */
  readonly p0: readonly [number, number, number];
  readonly p1: readonly [number, number, number];
  readonly p2: readonly [number, number, number];
  readonly length: number;
  /** Walk movements: the road arms (by index) whose carriageway this connector crosses. */
  readonly crosses?: readonly number[];
}

export type JunctionControl = 'none' | 'yield' | 'signal';

export interface JunctionArm {
  readonly edge: string;
  readonly node: string;
  /** Unit direction pointing away from the junction along the edge. */
  readonly dx: number;
  readonly dz: number;
  readonly width: number;
  readonly kind: RoadKind;
  readonly link: boolean;
  /** Signal phase group this arm belongs to. */
  group: number;
  /** A stop or yield sign on this arm: its traffic gives way. */
  yields?: boolean;
}

export interface TransportJunction {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly nodes: readonly string[];
  readonly arms: readonly JunctionArm[];
  control: JunctionControl;
  /** Core radius in metres (lanes are trimmed this far back). */
  readonly radius: number;
  /** conflicts[a * n² + b] for arm-pair keys a and b. */
  readonly conflicts: Uint8Array;
  /** Number of signal phase groups (≥ 2 when signalised). */
  readonly groups: number;
}

/** A lane-level sample: position, surface height and travel direction. */
export interface LaneSample {
  x: number;
  y: number;
  z: number;
  /** Unit horizontal travel direction. */
  dx: number;
  dz: number;
  /** Grade (rise per metre travelled). */
  grade: number;
}

/** A mapped runway, kept for aircraft approach corridors. */
export interface TransportRunway {
  readonly tile: string;
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly y: number;
}

/** A point where a mapped footway crossing or a railway crosses a road edge. */
export interface TransportCrossing {
  readonly id: string;
  readonly tile: string;
  readonly kind: 'crossing' | 'level-crossing';
  readonly road: string;
  /** Distance along the road edge's path. */
  readonly roadS: number;
  /** The crossing edge (walk crossing or rail) and the distance along it. */
  readonly other: string;
  readonly otherS: number;
}
