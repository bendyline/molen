/** Local sound context from displayed map tiles, independent of the wildlife graphics budget. */
import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/client';
import { roadWidth } from '@bendyline/molen-terrain/kernel';
import type * as THREE from 'three';
import type { SemanticTileObserver } from './ambient-tiles';

type Point = [number, number];
interface Tile {
  object: THREE.Object3D;
  tile: TerrainSemanticTile;
  context: TerrainPyramidTileLayerContext;
}
export interface EarthAudioTerrainSample {
  /** Meters to a mapped ocean shore; Infinity when unknown or out of range. */
  coastDistance: number;
  riverDistance: number;
  streetDistance: number;
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
      ([0, 1] as const).some(
        (axis) =>
          (a[axis] <= 1e-5 && b[axis] <= 1e-5) || (a[axis] >= 1 - 1e-5 && b[axis] >= 1 - 1e-5),
      )
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

export class EarthAudioTerrain {
  private readonly tiles = new Map<THREE.Object3D, Tile>();
  readonly observer: SemanticTileObserver = {
    added: (object, tile, context) => {
      this.tiles.set(object, { object, tile, context });
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
        const ocean = ['ocean', 'sea'].includes(water.class ?? '');
        for (const p of water.polygons ?? []) {
          const d =
            Math.min(
              lineDistance(u, v, p.outer, true, ocean),
              ...(p.holes ?? []).map((h) => lineDistance(u, v, h, true, ocean)),
            ) * tileSize;
          if (ocean) result.coastDistance = Math.min(result.coastDistance, d);
          // Lakes are quiet; flowing-water beds require a mapped river/stream.
          else if (['river', 'stream', 'canal'].includes(water.class ?? ''))
            result.riverDistance = Math.min(result.riverDistance, inside(u, v, p) ? 0 : d);
        }
        if (['river', 'stream', 'canal', 'waterway', 'ditch'].includes(water.class ?? ''))
          for (const line of water.lines ?? [])
            result.riverDistance = Math.min(
              result.riverDistance,
              Math.max(0, lineDistance(u, v, line) * tileSize - (water.width ?? 3) / 2),
            );
      }
      if (tileSize > 2048) continue; // Fine geometry is needed to choose the surface under a foot.
      for (const land of tile.landcover)
        if (tileSize <= surfaceLevel && land.polygons.some((p) => inside(u, v, p))) {
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
        const d =
          Math.min(...road.lines.map((line) => lineDistance(u, v, line) * tileSize)) -
          (road.width ?? roadWidth(road.class)) / 2;
        if (
          !['path', 'footway', 'cycleway', 'steps', 'track', 'rail', 'railway'].includes(road.class)
        )
          result.streetDistance = Math.min(result.streetDistance, Math.max(0, d));
        if (d <= 0.6 && tileSize <= roadLevel) {
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
