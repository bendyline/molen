/**
 * Grading one tile's bridges as a request that can cross to a worker: the tile's ways and those
 * around it as numbers, and what `gradeTransportSeparations` makes of them as numbers too. The
 * reference ground is read wherever the work is done, as for the earthworks
 * (`RoadEarthworksRequest`), so only the roads cross.
 *
 * A dense city is full of viaducts, and working their heights out is a relaxation over tens of
 * thousands of stations: on the main thread it took 139 ms of each second of a flight over Osaka
 * once the rest of streaming kept up, in steps too long to slice. A grading done on the main
 * thread goes through the same request and result (see road-grading.ts), so the two give the
 * same answer by construction.
 */
import { gradeSeparationEligible, gradeTransportSeparationSteps } from './grade-separation';
import type { Heightfield } from './heightfield';
import {
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from './pyramid-types';
import { roadProfileHeight, roadReferenceGround } from './road-earthworks';
import type {
  TerrainBridgeProfileSample,
  TerrainSemanticLine,
  TerrainTransportationFeature,
} from './semantic-types';

/** Meters between the stations bridge profiles are worked out at. */
export const ROAD_SEPARATION_SPACING = 6;
/** Meters two halves of a way cut at a tile edge may end apart and still be joined. */
export const ROAD_SEPARATION_END_TOLERANCE = 1.5;
/**
 * Numbers to a station of a graded way (`RoadSeparationResult.ways`): world x and z, elevation,
 * flatness, anchor, ground.
 */
export const ROAD_SEPARATION_WAY_STRIDE = 6;
/**
 * Numbers to a sample of a profile (`RoadSeparationResult.profiles`): the point's u and v,
 * elevation, flatness, ground, anchor.
 */
export const ROAD_SEPARATION_PROFILE_STRIDE = 6;
/** Meters to a cell of a result's index of segments, and how near a segment a point is on it. */
export const ROAD_SEPARATION_CELL = 32;
export const ROAD_SEPARATION_REACH = 0.5;
/** The cell of the index a world position falls in, by its column and row. */
export const roadSeparationCell = (cx: number, cz: number): number =>
  (cx + 0x200000) * 0x400000 + cz + 0x200000;

/**
 * What the grading reads of a way besides its line (see `gradeSeparationEligible`). Ways of one
 * feature share one of these.
 */
export interface RoadSeparationKind {
  class: string;
  subclass?: string;
  service?: string;
  link?: boolean;
  width?: number;
  lanes?: number;
  oneway?: boolean;
  layer?: number;
  bridge?: boolean;
}

/** What tells one road from another where two gradings are matched by position. */
export const roadSeparationSignature = (
  feature: Pick<TerrainTransportationFeature, 'class' | 'subclass' | 'bridge'>,
): string => `${feature.class}/${feature.subclass ?? ''}/${feature.bridge === true ? 1 : 0}`;

/**
 * One tile's bridge grading, to do wherever the reference ground can be read: the ways that
 * take part (`RoadSeparationPacker` leaves out those that do not), the tile's own first and then
 * those of the tiles around it, each a kind and a run of points in the tile's own normalized
 * coordinates.
 */
export interface RoadSeparationRequest {
  address: TerrainPyramidTileAddress;
  kinds: RoadSeparationKind[];
  /** The kind of each way. */
  wayKinds: Uint32Array;
  /** Where each way's points end in `points`, counted in points. */
  wayEnds: Uint32Array;
  /** u and v of every point, way after way. */
  points: Float64Array;
  /** How many of the ways are the tile's own; the rest only cross, join and carry approaches. */
  own: number;
  /** How far past its end a way's profile is carried into the way joined to it, meters. */
  extend: number;
  /** The elevation level the reference ground is read at, and how far past the tile, meters. */
  referenceLevel: number;
  reach: number;
}

/** What a `RoadSeparationRequest` comes to. Every array is its own buffer, to transfer. */
export interface RoadSeparationResult {
  /** The request's own ways that were given a profile, ascending. */
  profiled: Uint32Array;
  /** Where each of their profiles ends in `profiles`, counted in samples. */
  profileEnds: Uint32Array;
  /** `ROAD_SEPARATION_PROFILE_STRIDE` numbers a sample. */
  profiles: Float64Array;
  /** Every way that was given a profile, those around the tile among them: what road each is. */
  signatures: string[];
  /** Where each of those ways' stations end in `ways`, counted in stations. */
  wayEnds: Uint32Array;
  /** `ROAD_SEPARATION_WAY_STRIDE` numbers a station, in world meters. */
  ways: Float64Array;
  /**
   * The segments of `ways` by the cells they come near (`roadSeparationCell`): the cells in
   * ascending order, where each cell's entries end in `cells`, and the entries as way and
   * station in turn, in the order the ways were graded.
   */
  cellKeys: Float64Array;
  cellEnds: Uint32Array;
  cells: Uint32Array;
}

/** A result's buffers, to hand over with it. */
export function roadSeparationTransfer(result: RoadSeparationResult): ArrayBuffer[] {
  return [
    result.profiled.buffer,
    result.profileEnds.buffer,
    result.profiles.buffer,
    result.wayEnds.buffer,
    result.ways.buffer,
    result.cellKeys.buffer,
    result.cellEnds.buffer,
    result.cells.buffer,
  ] as ArrayBuffer[];
}

/**
 * Gathers a request's ways: the tile's own, then `endOwn`, then those around it. A way that takes
 * no part in grade separation is not added, and `add` says so.
 */
export class RoadSeparationPacker {
  private readonly kinds: RoadSeparationKind[] = [];
  private readonly kindOf = new Map<TerrainTransportationFeature, number>();
  private readonly wayKinds: number[] = [];
  private readonly wayEnds: number[] = [];
  private readonly points: number[] = [];
  private own = -1;
  private bridged = false;

  /** Whether any way added is a bridge: without one there is nothing to grade. */
  get bridges(): boolean {
    return this.bridged;
  }

  /** Ways added so far. */
  get ways(): number {
    return this.wayKinds.length;
  }

  /** One line of `feature`, in the tile's normalized coordinates. False when it takes no part. */
  add(feature: TerrainTransportationFeature, line: TerrainSemanticLine): boolean {
    let kind = this.kindOf.get(feature);
    if (kind === undefined) {
      kind = gradeSeparationEligible(feature) ? this.kinds.length : -1;
      this.kindOf.set(feature, kind);
      if (kind >= 0)
        this.kinds.push({
          class: feature.class,
          ...(feature.subclass !== undefined ? { subclass: feature.subclass } : {}),
          ...(feature.service !== undefined ? { service: feature.service } : {}),
          ...(feature.link !== undefined ? { link: feature.link } : {}),
          ...(feature.width !== undefined ? { width: feature.width } : {}),
          ...(feature.lanes !== undefined ? { lanes: feature.lanes } : {}),
          ...(feature.oneway !== undefined ? { oneway: feature.oneway } : {}),
          ...(feature.layer !== undefined ? { layer: feature.layer } : {}),
          ...(feature.bridge !== undefined ? { bridge: feature.bridge } : {}),
        });
    }
    if (kind < 0) return false;
    if (feature.bridge) this.bridged = true;
    for (const point of line) this.points.push(point[0], point[1]);
    this.wayKinds.push(kind);
    this.wayEnds.push(this.points.length / 2);
    return true;
  }

  /** The tile's own ways are in; what follows is around it. */
  endOwn(): void {
    this.own = this.wayKinds.length;
  }

  request(
    rest: Pick<RoadSeparationRequest, 'address' | 'extend' | 'referenceLevel' | 'reach'>,
  ): RoadSeparationRequest {
    return {
      ...rest,
      kinds: this.kinds,
      wayKinds: Uint32Array.from(this.wayKinds),
      wayEnds: Uint32Array.from(this.wayEnds),
      points: Float64Array.from(this.points),
      own: this.own < 0 ? this.wayKinds.length : this.own,
    };
  }
}

/** A request's buffers, to hand over with it. */
export function roadSeparationRequestTransfer(request: RoadSeparationRequest): ArrayBuffer[] {
  return [request.wayKinds.buffer, request.wayEnds.buffer, request.points.buffer] as ArrayBuffer[];
}

/**
 * Grade a request over `ground` (the reference ground, world meters), as steps of a few
 * milliseconds each (see `gradeTransportSeparationSteps`). `origin` and `tileSize` are the
 * tile's, as the pyramid gives them.
 */
export function* gradeRoadSeparationSteps(
  request: RoadSeparationRequest,
  origin: readonly [number, number],
  tileSize: number,
  ground: (x: number, z: number) => number,
): Generator<undefined, RoadSeparationResult, undefined> {
  const { kinds, wayKinds, wayEnds, points, own } = request;
  const features: TerrainTransportationFeature[] = [];
  const context: TerrainTransportationFeature[] = [];
  for (let way = 0; way < wayKinds.length; way++) {
    const from = way === 0 ? 0 : (wayEnds[way - 1] as number);
    const to = wayEnds[way] as number;
    const line: TerrainSemanticLine = new Array(to - from);
    for (let p = from; p < to; p++)
      line[p - from] = [points[p * 2] as number, points[p * 2 + 1] as number];
    (way < own ? features : context).push({
      ...(kinds[wayKinds[way] as number] as RoadSeparationKind),
      lines: [line],
    });
  }
  const signatures: string[] = [];
  const stations: Float64Array[] = [];
  const steps = gradeTransportSeparationSteps(
    features,
    tileSize,
    (x, z, dx, dz) => roadProfileHeight(ground, origin[0] + x, origin[1] + z, dx, dz),
    {
      context,
      endTolerance: ROAD_SEPARATION_END_TOLERANCE,
      spacing: ROAD_SEPARATION_SPACING,
      // Graded over the reference ground, drawn on the tile's own.
      anchored: true,
      extend: request.extend,
      profiled(feature, _line, samples) {
        if (samples.length < 2) return;
        const data = new Float64Array(samples.length * ROAD_SEPARATION_WAY_STRIDE);
        samples.forEach((sample, i) => {
          const at = i * ROAD_SEPARATION_WAY_STRIDE;
          data[at] = origin[0] + sample.point[0] * tileSize;
          data[at + 1] = origin[1] + sample.point[1] * tileSize;
          data[at + 2] = sample.elevation;
          data[at + 3] = sample.flatness;
          data[at + 4] = sample.anchor ?? 0;
          data[at + 5] = sample.ground ?? 0;
        });
        signatures.push(roadSeparationSignature(feature));
        stations.push(data);
      },
    },
  );
  let graded: readonly TerrainTransportationFeature[];
  for (;;) {
    const step = steps.next();
    if (step.done) {
      graded = step.value;
      break;
    }
    yield;
  }
  // The profiles of the tile's own ways.
  const profiled: number[] = [];
  const profileEnds: number[] = [];
  const values: number[] = [];
  if (graded !== features)
    graded.forEach((feature, i) => {
      const samples = feature.bridgeApproachProfile;
      if (!samples?.length || feature === features[i]) return;
      profiled.push(i);
      for (const sample of samples)
        values.push(
          sample.point[0],
          sample.point[1],
          sample.elevation,
          sample.flatness,
          sample.ground ?? Number.NaN,
          sample.anchor ?? Number.NaN,
        );
      profileEnds.push(values.length / ROAD_SEPARATION_PROFILE_STRIDE);
    });
  yield;
  // Every graded way's stations, end to end, and the cells their segments come near.
  const wayStations = new Uint32Array(stations.length);
  let total = 0;
  stations.forEach((data, way) => {
    total += data.length / ROAD_SEPARATION_WAY_STRIDE;
    wayStations[way] = total;
  });
  const ways = new Float64Array(total * ROAD_SEPARATION_WAY_STRIDE);
  stations.forEach((data, way) => {
    ways.set(data, (way === 0 ? 0 : (wayStations[way - 1] as number)) * ROAD_SEPARATION_WAY_STRIDE);
  });
  /** Each segment's cells, in the order an index built as it went would have met them. */
  const eachCell = (visit: (key: number, way: number, station: number) => void): void => {
    stations.forEach((data, way) => {
      const count = data.length / ROAD_SEPARATION_WAY_STRIDE;
      for (let i = 0; i + 1 < count; i++) {
        const ax = data[i * ROAD_SEPARATION_WAY_STRIDE] as number,
          az = data[i * ROAD_SEPARATION_WAY_STRIDE + 1] as number,
          bx = data[(i + 1) * ROAD_SEPARATION_WAY_STRIDE] as number,
          bz = data[(i + 1) * ROAD_SEPARATION_WAY_STRIDE + 1] as number;
        const lowX = Math.floor((Math.min(ax, bx) - ROAD_SEPARATION_REACH) / ROAD_SEPARATION_CELL),
          highX = Math.floor((Math.max(ax, bx) + ROAD_SEPARATION_REACH) / ROAD_SEPARATION_CELL),
          lowZ = Math.floor((Math.min(az, bz) - ROAD_SEPARATION_REACH) / ROAD_SEPARATION_CELL),
          highZ = Math.floor((Math.max(az, bz) + ROAD_SEPARATION_REACH) / ROAD_SEPARATION_CELL);
        for (let cx = lowX; cx <= highX; cx++)
          for (let cz = lowZ; cz <= highZ; cz++) visit(roadSeparationCell(cx, cz), way, i);
      }
    });
  };
  const sizes = new Map<number, number>();
  eachCell((key) => {
    sizes.set(key, (sizes.get(key) ?? 0) + 2);
  });
  const cellKeys = Float64Array.from(sizes.keys()).sort();
  const cellEnds = new Uint32Array(cellKeys.length);
  /** Where each cell's next entry goes. */
  const next = new Map<number, number>();
  let end = 0;
  cellKeys.forEach((key, i) => {
    next.set(key, end);
    end += sizes.get(key) as number;
    cellEnds[i] = end;
  });
  const cells = new Uint32Array(end);
  eachCell((key, way, station) => {
    const at = next.get(key) as number;
    cells[at] = way;
    cells[at + 1] = station;
    next.set(key, at + 2);
  });
  return {
    profiled: Uint32Array.from(profiled),
    profileEnds: Uint32Array.from(profileEnds),
    profiles: Float64Array.from(values),
    signatures,
    wayEnds: wayStations,
    ways,
    cellKeys,
    cellEnds,
    cells,
  };
}

/** The profile samples of the `index`th profiled way of a result, as the grading made them. */
export function roadSeparationProfile(
  result: RoadSeparationResult,
  index: number,
): TerrainBridgeProfileSample[] {
  const from = index === 0 ? 0 : (result.profileEnds[index - 1] as number);
  const to = result.profileEnds[index] as number;
  const data = result.profiles;
  const samples: TerrainBridgeProfileSample[] = new Array(to - from);
  for (let s = from; s < to; s++) {
    const at = s * ROAD_SEPARATION_PROFILE_STRIDE;
    const ground = data[at + 4] as number,
      anchor = data[at + 5] as number;
    samples[s - from] = {
      point: [data[at] as number, data[at + 1] as number],
      elevation: data[at + 2] as number,
      flatness: data[at + 3] as number,
      ...(Number.isNaN(ground) ? {} : { ground }),
      ...(Number.isNaN(anchor) ? {} : { anchor }),
    };
  }
  return samples;
}

/** Where the entries of the cell a world position falls in begin and end in a result's `cells`. */
export function roadSeparationCellRange(
  result: Pick<RoadSeparationResult, 'cellKeys' | 'cellEnds'>,
  x: number,
  z: number,
): [from: number, to: number] {
  const key = roadSeparationCell(
    Math.floor(x / ROAD_SEPARATION_CELL),
    Math.floor(z / ROAD_SEPARATION_CELL),
  );
  const keys = result.cellKeys;
  let low = 0,
    high = keys.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const at = keys[middle] as number;
    if (at === key)
      return [
        middle === 0 ? 0 : (result.cellEnds[middle - 1] as number),
        result.cellEnds[middle] as number,
      ];
    if (at < key) low = middle + 1;
    else high = middle - 1;
  }
  return [0, 0];
}

/** Yield to the event loop: a macrotask, without a timer's clamped delay where there is one. */
export function breathe(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(0);
  });
}

/**
 * Grade a request in one go, for whoever does it where a long step holds nothing up (a
 * worker): `load` reads an elevation tile for the reference ground. After each `sliceMs` of
 * work `pause` is awaited, to let whatever else waits have a turn, and the grading stops when
 * it answers false. Resolves to the result; to null where the reference ground cannot be read;
 * to undefined when stopped.
 */
export async function gradeRoadSeparationRequest(
  pyramid: TerrainPyramidDescriptor,
  load: (address: TerrainPyramidTileAddress) => Promise<Heightfield | undefined>,
  request: RoadSeparationRequest,
  options: {
    sliceMs?: number;
    pause?: () => Promise<boolean>;
    /** Told the time the grading itself took, without its pauses and the reading of the ground. */
    onWork?: (milliseconds: number) => void;
  } = {},
): Promise<RoadSeparationResult | null | undefined> {
  const origin = terrainPyramidTileOrigin(pyramid, request.address);
  const tileSize = terrainPyramidTileSize(pyramid, request.address.level);
  const { reach } = request;
  const ground = await roadReferenceGround(
    pyramid,
    load,
    [
      origin[0] - reach,
      origin[1] - reach,
      origin[0] + tileSize + reach,
      origin[1] + tileSize + reach,
    ],
    request.referenceLevel,
  );
  if (!ground) return null;
  const steps = gradeRoadSeparationSteps(request, origin, tileSize, ground);
  const sliceMs = options.sliceMs ?? 8;
  let worked = 0;
  for (let slice = performance.now(); ; ) {
    const step = steps.next();
    if (step.done) {
      options.onWork?.(worked + performance.now() - slice);
      return step.value;
    }
    if (options.pause === undefined || performance.now() - slice < sliceMs) continue;
    worked += performance.now() - slice;
    if (!(await options.pause())) return undefined;
    slice = performance.now();
  }
}
