/**
 * Spatial index over generated output for gameplay and scripts: which building stands at a
 * point, which buildings and props lie within a radius. Records and placements are bucketed on
 * a grid once; queries touch only the buckets a radius covers. Pure data, no world state.
 */

import { pointInRing } from './geometry2d';
import type { BuildingRecord } from './types';
import { PLACEMENT_STRIDE, type PlacementSet, type Vec2 } from './types';

export interface PropHit {
  modelRef: string;
  setId: string;
  index: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  distance: number;
}

export interface BuildingHit {
  record: BuildingRecord;
  /** Distance from the query point to the record centroid. */
  distance: number;
}

export interface WorldgenIndex {
  readonly cellSize: number;
  readonly buildingCount: number;
  readonly propCount: number;
  /** The building whose bounds contain the point and whose outline (when known) contains it. */
  buildingAt(x: number, z: number): BuildingRecord | undefined;
  /** Buildings whose centroid lies within `radius`, nearest first. */
  buildingsNear(x: number, z: number, radius: number): BuildingHit[];
  /** Prop and scatter instances within `radius`, nearest first. */
  propsNear(x: number, z: number, radius: number): PropHit[];
  /** Merge another batch into this index (e.g. a neighbouring batch). */
  add(records: readonly BuildingRecord[], placements: readonly PlacementSet[]): void;
}

export interface WorldgenIndexOptions {
  /** Bucket size in meters (default 64). */
  cellSize?: number;
  /** Outlines by identity so `buildingAt` can test the footprint, not only the bounds. */
  outlines?: ReadonlyMap<string, readonly Vec2[]>;
}

interface PropEntry {
  set: PlacementSet;
  index: number;
}

function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function createWorldgenIndex(
  records: readonly BuildingRecord[] = [],
  placements: readonly PlacementSet[] = [],
  options: WorldgenIndexOptions = {},
): WorldgenIndex {
  const cellSize = Math.max(1, options.cellSize ?? 64);
  const outlines = options.outlines;
  const buildingCells = new Map<string, BuildingRecord[]>();
  const propCells = new Map<string, PropEntry[]>();
  let buildingCount = 0;
  let propCount = 0;

  const cellOf = (value: number): number => Math.floor(value / cellSize);

  function add(newRecords: readonly BuildingRecord[], newPlacements: readonly PlacementSet[]) {
    for (const record of newRecords) {
      const [minX, minZ, maxX, maxZ] = record.bounds;
      for (let cz = cellOf(minZ); cz <= cellOf(maxZ); cz++) {
        for (let cx = cellOf(minX); cx <= cellOf(maxX); cx++) {
          const key = cellKey(cx, cz);
          let bucket = buildingCells.get(key);
          if (bucket === undefined) {
            bucket = [];
            buildingCells.set(key, bucket);
          }
          bucket.push(record);
        }
      }
      buildingCount++;
    }
    for (const set of newPlacements) {
      for (let index = 0; index < set.count; index++) {
        const offset = index * PLACEMENT_STRIDE;
        const key = cellKey(
          cellOf(set.data[offset] as number),
          cellOf(set.data[offset + 2] as number),
        );
        let bucket = propCells.get(key);
        if (bucket === undefined) {
          bucket = [];
          propCells.set(key, bucket);
        }
        bucket.push({ set, index });
        propCount++;
      }
    }
  }
  add(records, placements);

  function buildingAt(x: number, z: number): BuildingRecord | undefined {
    const bucket = buildingCells.get(cellKey(cellOf(x), cellOf(z)));
    if (bucket === undefined) return undefined;
    let best: BuildingRecord | undefined;
    for (const record of bucket) {
      const [minX, minZ, maxX, maxZ] = record.bounds;
      if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
      const outline = outlines?.get(record.identity);
      if (outline !== undefined && !pointInRing([x, z], outline)) continue;
      // Prefer the smaller footprint when bounds overlap (an outbuilding inside a block).
      if (best === undefined || record.area < best.area) best = record;
    }
    return best;
  }

  function buildingsNear(x: number, z: number, radius: number): BuildingHit[] {
    const hits: BuildingHit[] = [];
    const seen = new Set<BuildingRecord>();
    for (let cz = cellOf(z - radius); cz <= cellOf(z + radius); cz++) {
      for (let cx = cellOf(x - radius); cx <= cellOf(x + radius); cx++) {
        const bucket = buildingCells.get(cellKey(cx, cz));
        if (bucket === undefined) continue;
        for (const record of bucket) {
          if (seen.has(record)) continue;
          seen.add(record);
          const distance = Math.hypot(record.centroid[0] - x, record.centroid[1] - z);
          if (distance <= radius) hits.push({ record, distance });
        }
      }
    }
    return hits.sort(
      (a, b) => a.distance - b.distance || (a.record.identity < b.record.identity ? -1 : 1),
    );
  }

  function propsNear(x: number, z: number, radius: number): PropHit[] {
    const hits: PropHit[] = [];
    for (let cz = cellOf(z - radius); cz <= cellOf(z + radius); cz++) {
      for (let cx = cellOf(x - radius); cx <= cellOf(x + radius); cx++) {
        const bucket = propCells.get(cellKey(cx, cz));
        if (bucket === undefined) continue;
        for (const { set, index } of bucket) {
          const offset = index * PLACEMENT_STRIDE;
          const px = set.data[offset] as number;
          const pz = set.data[offset + 2] as number;
          const distance = Math.hypot(px - x, pz - z);
          if (distance > radius) continue;
          hits.push({
            modelRef: set.modelRef,
            setId: set.setId,
            index,
            x: px,
            y: set.data[offset + 1] as number,
            z: pz,
            yaw: set.data[offset + 3] as number,
            scale: set.data[offset + 4] as number,
            distance,
          });
        }
      }
    }
    return hits.sort(
      (a, b) =>
        a.distance - b.distance ||
        (a.setId < b.setId ? -1 : a.setId > b.setId ? 1 : a.index - b.index),
    );
  }

  return {
    cellSize,
    get buildingCount() {
      return buildingCount;
    },
    get propCount() {
      return propCount;
    },
    buildingAt,
    buildingsNear,
    propsNear,
    add,
  };
}
