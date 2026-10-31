/** Local sound context from displayed map tiles, independent of the wildlife graphics budget. */
import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
  TerrainTrafficSignal,
} from '@bendyline/molen-terrain/client';
import { roadWidth } from '@bendyline/molen-terrain/kernel';
import type * as THREE from 'three';
import type { SemanticTileObserver } from './ambient-tiles';

type Point = [number, number];
interface Tile {
  object: THREE.Object3D;
  /**
   * What a sample reads: never a features tile's buildings, and of a tile too coarse to choose
   * the surface underfoot (see sample) only its water.
   */
  tile: Pick<TerrainSemanticTile, 'water' | 'landcover' | 'transportation' | 'pois'>;
  context: TerrainPyramidTileLayerContext;
}
export interface EarthAudioTerrainSample {
  /** Meters to a mapped ocean shore; Infinity when unknown or out of range. */
  coastDistance: number;
  riverDistance: number;
  streetDistance: number;
  /** Meters to a mapped or rendered traffic signal; absent/Infinity means unknown. */
  intersectionDistance?: number;
  surface?: string;
  habitat?: string;
}

function inRing(x: number, z: number, ring: Point[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      result = !result;
  }
  return result;
}
function inside(x: number, z: number, p: TerrainSemanticPolygon): boolean {
  return inRing(x, z, p.outer) && !(p.holes ?? []).some((h) => inRing(x, z, h));
}
function lineDistance(
  x: number,
  z: number,
  points: Point[],
  closed = false,
  shore = false,
): number {
  let best = Infinity;
  for (let i = 1; i < points.length + (closed ? 1 : 0); i++) {
    const a = points[i - 1]!,
      b = points[i % points.length]!;
    // Water polygons include tile clipping edges (sometimes buffered beyond 0..1). Those
    // seams are not beaches; real shoreline beyond this tile belongs to its neighbor.
    if (
      shore &&
      ((a[0] <= 1e-5 && b[0] <= 1e-5) ||
        (a[0] >= 1 - 1e-5 && b[0] >= 1 - 1e-5) ||
        (a[1] <= 1e-5 && b[1] <= 1e-5) ||
        (a[1] >= 1 - 1e-5 && b[1] >= 1 - 1e-5))
    )
      continue;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
    );
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  return best;
}
/** Each line's or ring's tile-normalized bounds, computed once per (immutable) feature. */
const featureBounds = new WeakMap<Point[], [number, number, number, number]>();
/**
 * Distance from (x, z) to the bounds of `points`, a lower bound on the distance to any of them.
 * A sample skips every feature that cannot come nearer than the nearest found so far: measuring
 * every road and shore of a dense town tile, a sample once took 20 ms of a frame.
 */
function boundsDistance(x: number, z: number, points: Point[]): number {
  let box = featureBounds.get(points);
  if (box === undefined) {
    box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [px, pz] of points) {
      if (px < box[0]) box[0] = px;
      if (pz < box[1]) box[1] = pz;
      if (px > box[2]) box[2] = px;
      if (pz > box[3]) box[3] = pz;
    }
    featureBounds.set(points, box);
  }
  return Math.hypot(Math.max(box[0] - x, 0, x - box[2]), Math.max(box[1] - z, 0, z - box[3]));
}
const OCEAN = new Set(['ocean', 'sea']);
const RIVER_AREAS = new Set(['river', 'stream', 'canal']);
const RIVER_LINES = new Set(['river', 'stream', 'canal', 'waterway', 'ditch']);
const NOT_STREETS = new Set([
  'path',
  'footway',
  'cycleway',
  'steps',
  'track',
  'rail',
  'railway',
  'aeroway',
  'runway',
  'taxiway',
]);
function surfaceOf(value: string): string | undefined {
  return (
    {
      asphalt: 'concrete',
      paved: 'concrete',
      concrete: 'concrete',
      paving_stones: 'stone',
      cobblestone: 'stone',
      gravel: 'gravel',
      fine_gravel: 'gravel',
      pebblestone: 'gravel',
      dirt: 'dirt',
      earth: 'dirt',
      ground: 'dirt',
      unpaved: 'dirt',
      mud: 'mud',
      sand: 'sand',
      beach: 'sand',
      wood: 'wood',
      grass: 'grass',
      grassland: 'grass',
      meadow: 'grass',
      park: 'grass',
      forest: 'leaves',
      woodland: 'leaves',
      rock: 'stone',
      bare_rock: 'stone',
      snow: 'snow',
      ice: 'snow',
      glacier: 'snow',
      metal: 'metal',
      wetland: 'mud',
    } as Record<string, string>
  )[value];
}

/** The coarsest tile (m) whose land cover and roads choose the surface underfoot. */
const FINE_TILE_SIZE = 2048;

export class EarthAudioTerrain {
  private readonly tiles = new Map<THREE.Object3D, Tile>();
  readonly observer: SemanticTileObserver = {
    added: (object, tile, context) => {
      const coarse = context.tileSize > FINE_TILE_SIZE;
      this.tiles.set(object, {
        object,
        tile: {
          water: tile.water,
          landcover: coarse ? [] : tile.landcover,
          transportation: coarse ? [] : tile.transportation,
          pois: coarse
            ? []
            : (tile.pois ?? []).filter((p) => (p.subclass ?? p.class) === 'traffic_signals'),
        },
        context,
      });
    },
    removed: (object) => {
      this.tiles.delete(object);
    },
  };
  sample(x: number, z: number): EarthAudioTerrainSample {
    const result: EarthAudioTerrainSample = {
      coastDistance: Infinity,
      riverDistance: Infinity,
      streetDistance: Infinity,
      intersectionDistance: Infinity,
    };
    let surfaceLevel = Infinity,
      roadLevel = Infinity;
    let roadSurface: string | undefined;
    for (const {
      object,
      tile,
      context: { origin, tileSize },
    } of this.tiles.values()) {
      let visible = object.parent !== null;
      for (let p: THREE.Object3D | null = object; p !== null; p = p.parent)
        if (!p.visible) visible = false;
      if (
        !visible ||
        Math.hypot(
          Math.max(origin[0] - x, 0, x - origin[0] - tileSize),
          Math.max(origin[1] - z, 0, z - origin[1] - tileSize),
        ) > 600
      )
        continue;
      const u = (x - origin[0]) / tileSize,
        v = (z - origin[1]) / tileSize;
      for (const water of tile.water) {
        const ocean = OCEAN.has(water.class ?? '');
        // Lakes are quiet; flowing-water beds require a mapped river/stream.
        const river = !ocean && RIVER_AREAS.has(water.class ?? '');
        if (ocean || river)
          for (const p of water.polygons ?? []) {
            let near = boundsDistance(u, v, p.outer);
            for (const hole of p.holes ?? []) near = Math.min(near, boundsDistance(u, v, hole));
            near *= tileSize;
            if (near >= (ocean ? result.coastDistance : result.riverDistance)) continue;
            if (river && inside(u, v, p)) {
              result.riverDistance = 0;
              continue;
            }
            let d = lineDistance(u, v, p.outer, true, ocean);
            for (const hole of p.holes ?? [])
              d = Math.min(d, lineDistance(u, v, hole, true, ocean));
            if (ocean) result.coastDistance = Math.min(result.coastDistance, d * tileSize);
            else result.riverDistance = Math.min(result.riverDistance, d * tileSize);
          }
        if (RIVER_LINES.has(water.class ?? '')) {
          const half = (water.width ?? 3) / 2;
          for (const line of water.lines ?? []) {
            if (boundsDistance(u, v, line) * tileSize - half >= result.riverDistance) continue;
            result.riverDistance = Math.min(
              result.riverDistance,
              Math.max(0, lineDistance(u, v, line) * tileSize - half),
            );
          }
        }
      }
      // Fine geometry is needed to choose the surface under a foot.
      if (tileSize > FINE_TILE_SIZE) continue;
      for (const poi of tile.pois ?? []) {
        // A tunnel/overpass signal must not become a crossing on the street below.
        if (poi.tunnel || poi.bridge || (poi.layer ?? 0) !== 0) continue;
        result.intersectionDistance = Math.min(
          result.intersectionDistance!,
          Math.hypot((poi.point[0] - u) * tileSize, (poi.point[1] - v) * tileSize),
        );
      }
      // Surface workers may install inferred signal heads after the tile was observed. Read
      // their metadata live, only on tiles within audible range; no second junction solver.
      if (Math.hypot(Math.max(-u, 0, u - 1), Math.max(-v, 0, v - 1)) * tileSize < 80) {
        const visit = (node: THREE.Object3D): void => {
          if (!node.visible) return;
          const heads = node.userData.trafficSignalHeads as TerrainTrafficSignal[] | undefined;
          for (const head of heads ?? [])
            result.intersectionDistance = Math.min(
              result.intersectionDistance!,
              Math.max(0, Math.hypot(x - head.junction[0], z - head.junction[1]) - head.radius),
            );
          // Mesh geometry cannot contain a surface tile; skip the building/model subtrees.
          for (const child of node.children)
            if (child.type === 'Group' || child.type === 'Object3D') visit(child);
        };
        visit(object);
      }
      for (const land of tile.landcover)
        if (
          tileSize <= surfaceLevel &&
          land.polygons.some((p) => boundsDistance(u, v, p.outer) === 0 && inside(u, v, p))
        ) {
          const kind = land.subclass ?? land.class;
          const surface = surfaceOf(kind) ?? surfaceOf(land.class);
          if (surface) {
            result.surface = surface;
            surfaceLevel = tileSize;
          }
          result.habitat = kind;
        }
      for (const road of tile.transportation) {
        if (road.tunnel) continue;
        const half = (road.width ?? roadWidth(road.class)) / 2;
        const street = !NOT_STREETS.has(road.class);
        const underfoot = tileSize <= roadLevel;
        let d = Infinity;
        for (const line of road.lines) {
          const near = boundsDistance(u, v, line) * tileSize - half;
          // Measured only if it could be the nearest street or the road underfoot.
          if (near >= d) continue;
          if ((!street || near >= result.streetDistance) && (!underfoot || near > 0.6)) continue;
          d = Math.min(d, lineDistance(u, v, line) * tileSize - half);
        }
        if (street) result.streetDistance = Math.min(result.streetDistance, Math.max(0, d));
        if (d <= 0.6 && underfoot) {
          roadSurface =
            surfaceOf(road.surface ?? '') ??
            (['path', 'track'].includes(road.class) ? 'dirt' : 'concrete');
          roadLevel = tileSize;
        }
      }
    }
    if (roadSurface) result.surface = roadSurface;
    return result;
  }
  clear(): void {
    this.tiles.clear();
  }
}
