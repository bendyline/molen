import type { CreateProfiledTerrainPackageSemanticLayersOptions } from '@bendyline/molen-terrain/client';
import {
  type TerrainPackageDescriptor,
  webMercatorTileBounds,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import type { StructureIndex, StructurePlacement } from '@bendyline/molen-worldgen-earth/kernel';

type Point = [number, number];
type Bounds = [number, number, number, number];
type TileAddress = [level: number, x: number, z: number];

export type EarthRoadAlignments = readonly {
  tile: TileAddress;
  featureId: number;
  from: [Point, Point];
  via: Point[];
  rejoin: number;
  placement: { id: string; fallback: Point; anchor: Point; bounds: Bounds };
}[];

const finite = (value: unknown): value is number => Number.isFinite(value);
function numbers<T extends number[]>(value: unknown, length: T['length']): value is T {
  return Array.isArray(value) && value.length === length && value.every(finite);
}
function coordinate(value: unknown): value is Point {
  return numbers<Point>(value, 2) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 85;
}

export function readEarthRoadAlignments(value: unknown): EarthRoadAlignments {
  const document = value as { format?: unknown; alignments?: unknown } | null;
  if (document?.format !== 'molen/earth-road-alignments@1' || !Array.isArray(document.alignments))
    throw new Error('Invalid Earth road alignments document');
  for (const item of document.alignments) {
    const { tile, featureId, from, via, rejoin, placement } = item ?? {};
    if (
      !numbers<TileAddress>(tile, 3) ||
      !tile.every(Number.isSafeInteger) ||
      tile[0] < 0 ||
      tile[0] > 30 ||
      tile[1] < 0 ||
      tile[1] >= 2 ** tile[0] ||
      tile[2] < 0 ||
      tile[2] >= 2 ** tile[0] ||
      !Number.isSafeInteger(featureId) ||
      !Array.isArray(from) ||
      from.length !== 2 ||
      !from.every(coordinate) ||
      !Array.isArray(via) ||
      via.length < 1 ||
      via.length > 64 ||
      !via.every(coordinate) ||
      !finite(rejoin) ||
      rejoin <= 0 ||
      rejoin >= 1 ||
      typeof placement?.id !== 'string' ||
      !coordinate(placement.fallback) ||
      !coordinate(placement.anchor) ||
      !numbers<Bounds>(placement.bounds, 4) ||
      placement.bounds[0] >= placement.bounds[2] ||
      placement.bounds[1] >= placement.bounds[3]
    )
      throw new Error('Invalid Earth road alignment');
  }
  return document.alignments as EarthRoadAlignments;
}

type TransformFeatures = NonNullable<
  CreateProfiledTerrainPackageSemanticLayersOptions['transformFeatures']
>;

function overlaps(bounds: Readonly<Bounds>, other: Readonly<Bounds>): boolean {
  return (
    bounds[1] <= other[3] &&
    bounds[3] >= other[1] &&
    (bounds[0] <= bounds[2]
      ? bounds[0] <= other[2] && bounds[2] >= other[0]
      : bounds[0] <= other[2] || bounds[2] >= other[0])
  );
}

/** Pair each guarded map edit with its model origin for this terrain stack. */
export function createEarthRoadAlignments(
  alignments: EarthRoadAlignments | undefined,
  terrain: TerrainPackageDescriptor,
):
  | {
      transformFeatures: TransformFeatures;
      withStructures(index: StructureIndex): StructureIndex;
    }
  | undefined {
  if (
    !alignments?.length ||
    terrain.coordinateSpace.kind !== 'geospatial' ||
    terrain.features?.profile !== 'protomaps-basemap@1'
  )
    return undefined;

  const active = new Map<string, EarthRoadAlignments[number]['placement']>();
  const controls = alignments.map((alignment) => {
    const [level, x, z] = alignment.tile;
    const [west, north, east] = webMercatorTileBounds({ level, x, y: z });
    const size = east - west;
    const toTile = (point: Point): Point => {
      const [px, pz] = wgs84ToWebMercator(...point);
      return [(px - west) / size, (pz - north) / size];
    };
    return {
      ...alignment,
      start: toTile(alignment.from[0]),
      end: toTile(alignment.from[1]),
      points: alignment.via.map(toTile),
      tolerance: 0.45 / size,
    };
  });
  const tiles = new Map<string, typeof controls>();
  for (const control of controls) {
    const key = control.tile.join('/');
    const sameTile = tiles.get(key);
    if (sameTile) sameTile.push(control);
    else tiles.set(key, [control]);
  }
  const transformFeatures: TransformFeatures = (tile, { level, x, z }, sourceMaxLevel) => {
    // At finer archive levels the geometry may be split or differently aligned. Use the
    // matched source tile only when the closer render levels all overzoom that same tile.
    if (level !== sourceMaxLevel) return tile;
    const edits = tiles.get(`${level}/${x}/${z}`);
    if (!edits) return tile;
    for (const edit of edits) active.delete(edit.placement.id);
    let changed = false;
    const transportation = tile.transportation.map((feature) => {
      const edit = edits.find((candidate) => candidate.featureId === feature.id);
      if (!edit || feature.bridge || feature.tunnel) return feature;
      let moved = false;
      const near = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < edit.tolerance;
      const lines = feature.lines.map((line) => {
        for (const [i, b] of line.entries()) {
          const a = line[i - 1];
          if (!a) continue;
          const forward = near(a, edit.start) && near(b, edit.end);
          const reverse = near(a, edit.end) && near(b, edit.start);
          if (!forward && !reverse) continue;
          const start = forward ? a : b;
          const end = forward ? b : a;
          const rejoin: Point = [
            start[0] + (end[0] - start[0]) * edit.rejoin,
            start[1] + (end[1] - start[1]) * edit.rejoin,
          ];
          const middle = [...edit.points, rejoin];
          if (reverse) middle.reverse();
          moved = true;
          return [...line.slice(0, i), ...middle, ...line.slice(i)];
        }
        return line;
      });
      if (!moved) return feature;
      active.set(edit.placement.id, edit.placement);
      changed = true;
      return { ...feature, lines };
    });
    return changed ? { ...tile, transportation } : tile;
  };

  const adjust = (entry: StructurePlacement): StructurePlacement => {
    const edit = active.get(entry.id);
    if (
      !edit ||
      entry.status !== 'preview' ||
      entry.anchor[0] !== edit.fallback[0] ||
      entry.anchor[1] !== edit.fallback[1]
    )
      return entry;
    return {
      ...entry,
      anchor: edit.anchor,
      // A point placement stays whole and can sample its own tile after moving.
      ...(entry.bounds ? { bounds: edit.bounds } : {}),
      ...(entry.terrainReference
        ? {
            terrainReference: {
              ...entry.terrainReference,
              anchor: [
                entry.terrainReference.anchor[0] + (edit.anchor[0] - entry.anchor[0]),
                entry.terrainReference.anchor[1] + (edit.anchor[1] - entry.anchor[1]),
              ],
            },
          }
        : {}),
    };
  };
  const withStructures = (index: StructureIndex): StructureIndex => {
    const includeFallback = (bounds: Readonly<Bounds>): Bounds => {
      const expanded: Bounds = [...bounds];
      if (bounds[0] > bounds[2]) return expanded;
      for (const { fallback, bounds: shifted } of active.values()) {
        if (!overlaps(bounds, shifted)) continue;
        expanded[0] = Math.min(expanded[0], fallback[0]);
        expanded[1] = Math.min(expanded[1], fallback[1]);
        expanded[2] = Math.max(expanded[2], fallback[0]);
        expanded[3] = Math.max(expanded[3], fallback[1]);
      }
      return expanded;
    };
    const restrict = (bounds: Readonly<Bounds>, entries: StructurePlacement[]) =>
      active.size === 0
        ? entries
        : entries
            .map(adjust)
            .filter(({ anchor: [x, y], bounds: extent }) =>
              overlaps(bounds, extent ?? [x, y, x, y]),
            );
    const wrapped: StructureIndex = {
      get entries() {
        return active.size === 0 ? index.entries : index.entries.map(adjust);
      },
      get cells() {
        return index.cells;
      },
      get rules() {
        return index.rules;
      },
      query: (bounds, query) => restrict(bounds, index.query(includeFallback(bounds), query)),
    };
    if (index.queryAsync) {
      const queryAsync = index.queryAsync.bind(index);
      wrapped.queryAsync = async (bounds, query) =>
        restrict(bounds, await queryAsync(includeFallback(bounds), query));
    }
    if (index.isLoaded) {
      const isLoaded = index.isLoaded.bind(index);
      wrapped.isLoaded = (bounds) => isLoaded(includeFallback(bounds));
    }
    return wrapped;
  };

  return { transformFeatures, withStructures };
}
