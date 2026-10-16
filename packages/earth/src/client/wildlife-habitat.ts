/** Observed terrain constraints for fauna. Finest displayed landcover and feature tiles win. */
import type { WildlifeHabitat } from '@bendyline/molen-ambient/kernel';
import {
  type TerrainPyramidTileLayerContext,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  terrainWaterSurfaceHeight,
} from '@bendyline/molen-terrain/client';
import { renderedGroundSampler } from '@bendyline/molen-terrain/kernel';
import type * as THREE from 'three';
import type { SemanticTileObserver } from './ambient-tiles';

type Point = [number, number];
type Bounds = [number, number, number, number];
interface Shape {
  kind: string;
  polygon?: TerrainSemanticPolygon;
  line?: Point[];
  width: number;
  bounds: Bounds;
  waterHeight?: number;
}
interface Tile {
  object: THREE.Object3D;
  context: TerrainPyramidTileLayerContext;
  shapes: Shape[];
  height: (x: number, z: number) => number;
}
export interface WildlifeLocalHabitat extends WildlifeHabitat {
  waterDistance: number;
  protected: boolean;
}

function bounds(points: readonly Point[]): Bounds {
  let x0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    z1 = -Infinity;
  for (const [x, z] of points) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  return [x0, z0, x1, z1];
}
function distanceToLine(x: number, z: number, points: readonly Point[], closed: boolean): number {
  let distance = Infinity;
  for (let i = 1; i < points.length + (closed ? 1 : 0); i++) {
    const a = points[i - 1],
      b = points[i % points.length];
    if (a === undefined || b === undefined) continue;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
    );
    distance = Math.min(distance, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  return distance;
}
function insideRing(x: number, z: number, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a !== undefined &&
      b !== undefined &&
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function inside(x: number, z: number, polygon: TerrainSemanticPolygon): boolean {
  return (
    insideRing(x, z, polygon.outer) && !(polygon.holes ?? []).some((hole) => insideRing(x, z, hole))
  );
}
function distanceToShape(x: number, z: number, shape: Shape): number {
  if (shape.polygon !== undefined) {
    if (inside(x, z, shape.polygon)) return 0;
    return Math.min(
      distanceToLine(x, z, shape.polygon.outer, true),
      ...(shape.polygon.holes ?? []).map((hole) => distanceToLine(x, z, hole, true)),
    );
  }
  return Math.max(0, distanceToLine(x, z, shape.line ?? [], false) - shape.width / 2);
}
function kindOf(value: string): string {
  const kind = value.toLowerCase().replaceAll('-', '_');
  if (['nature_reserve', 'national_park', 'protected_area'].includes(kind)) return 'protected';
  if (
    [
      'urban_area',
      'residential',
      'commercial',
      'industrial',
      'retail',
      'construction',
      'landfill',
      'quarry',
      'airport',
      'aerodrome',
    ].includes(kind)
  )
    return 'built';
  if (['wood', 'forest', 'woodland'].includes(kind)) return 'forest';
  if (
    [
      'grassland',
      'grass',
      'heath',
      'scrub',
      'shrub',
      'shrubland',
      'meadow',
      'tundra',
      'park',
      'wetland',
      'beach',
      'sand',
      'rock',
      'bare_rock',
    ].includes(kind)
  )
    return (
      (
        {
          grassland: 'grass',
          heath: 'scrub',
          shrub: 'scrub',
          shrubland: 'scrub',
          bare_rock: 'rock',
        } as Record<string, string>
      )[kind] ?? kind
    );
  return 'unknown';
}

export class WildlifeHabitatTiles {
  private readonly cover = new Map<THREE.Object3D, Tile>();
  private readonly features = new Map<THREE.Object3D, Tile>();
  private activeCover: Tile[] = [];
  private activeFeatures: Tile[] = [];
  private revision = 0;
  get version(): number {
    return this.revision;
  }
  constructor(
    private readonly root: THREE.Object3D,
    private readonly seaLevel?: number,
  ) {}

  observer(channel: 'landcover' | 'features'): SemanticTileObserver {
    const target = channel === 'landcover' ? this.cover : this.features;
    return {
      added: (object, tile, context) => {
        // Far/coarse tiles cannot locate roads and habitat closely enough to spawn small animals.
        if (context.tileSize > 2048) return;
        target.set(object, this.compile(object, tile, context));
      },
      removed: (object) => {
        target.delete(object);
      },
    };
  }

  private compile(
    object: THREE.Object3D,
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): Tile {
    const shapes: Shape[] = [];
    const polygon = (kind: string, p: TerrainSemanticPolygon, waterHeight?: number): void => {
      shapes.push({
        kind,
        polygon: p,
        width: 0,
        bounds: bounds(p.outer),
        ...(waterHeight !== undefined ? { waterHeight } : {}),
      });
    };
    for (const feature of tile.landcover)
      for (const p of feature.polygons) {
        const subtype = kindOf(feature.subclass ?? '');
        polygon(subtype === 'unknown' ? kindOf(feature.class) : subtype, p);
      }
    for (const feature of tile.buildings)
      if ((feature.minHeight ?? 0) < 3) for (const p of feature.polygons) polygon('building', p);
    for (const feature of tile.water) {
      const kind = ['ocean', 'sea'].includes(feature.class ?? '') ? 'water' : 'freshwater';
      for (const p of feature.polygons ?? [])
        polygon(kind, p, terrainWaterSurfaceHeight(p, context, 0.65, this.seaLevel));
      for (const line of feature.lines ?? [])
        shapes.push({
          kind,
          line,
          width: (feature.width ?? 3) / context.tileSize,
          bounds: bounds(line),
        });
    }
    for (const road of tile.transportation) {
      if (road.tunnel || road.bridge || (road.layer ?? 0) !== 0) continue;
      for (const line of road.lines)
        shapes.push({
          kind: 'road',
          line,
          width:
            (road.width ?? (['path', 'footway', 'track'].includes(road.class) ? 3 : 9)) /
            context.tileSize,
          bounds: bounds(line),
        });
    }
    return {
      object,
      context,
      shapes,
      height: renderedGroundSampler(
        context.heightfield,
        context.origin,
        context.tileSize,
        context.surfaceResolution,
      ),
    };
  }

  sync(position: readonly [number, number, number], radius: number): void {
    const active = (tiles: Map<THREE.Object3D, Tile>): Tile[] =>
      [...tiles.values()]
        .filter((tile) => {
          for (
            let object: THREE.Object3D | null = tile.object;
            object !== null;
            object = object.parent
          ) {
            if (!object.visible) return false;
            if (object === this.root) {
              const { origin, tileSize } = tile.context;
              return (
                Math.hypot(
                  Math.max(origin[0] - position[0], 0, position[0] - origin[0] - tileSize),
                  Math.max(origin[1] - position[2], 0, position[2] - origin[1] - tileSize),
                ) <=
                radius + 500
              );
            }
          }
          return false;
        })
        .sort(
          (a, b) =>
            a.context.tileSize - b.context.tileSize ||
            a.context.origin[0] - b.context.origin[0] ||
            a.context.origin[1] - b.context.origin[1],
        );
    const cover = active(this.cover),
      features = active(this.features);
    if (
      cover.length !== this.activeCover.length ||
      features.length !== this.activeFeatures.length ||
      cover.some((tile, i) => tile !== this.activeCover[i]) ||
      features.some((tile, i) => tile !== this.activeFeatures[i])
    )
      this.revision++;
    this.activeCover = cover;
    this.activeFeatures = features;
  }

  sample(x: number, z: number, margin: number): WildlifeLocalHabitat | undefined {
    const find = (tiles: Tile[]): Tile | undefined =>
      tiles.find(
        ({ context: { origin, tileSize } }) =>
          x >= origin[0] && z >= origin[1] && x < origin[0] + tileSize && z < origin[1] + tileSize,
      );
    const cover = find(this.activeCover),
      features = find(this.activeFeatures);
    if (cover === undefined || features === undefined) return undefined;
    let kind = 'unknown',
      safe = true,
      water = false,
      waterDistance = Infinity,
      protectedArea = false;
    let height = cover.height(x, z);
    for (const tile of [cover, features]) {
      const { origin, tileSize } = tile.context;
      const u = (x - origin[0]) / tileSize,
        v = (z - origin[1]) / tileSize;
      for (const shape of tile.shapes) {
        const waterShape = shape.kind === 'water' || shape.kind === 'freshwater';
        const search = (waterShape ? 500 : margin + 4) / tileSize + shape.width / 2;
        if (
          u < shape.bounds[0] - search ||
          v < shape.bounds[1] - search ||
          u > shape.bounds[2] + search ||
          v > shape.bounds[3] + search
        )
          continue;
        const distance = distanceToShape(u, v, shape) * tileSize;
        if (waterShape) {
          waterDistance = Math.min(waterDistance, distance);
          if (distance === 0) {
            kind = shape.kind;
            water = true;
            height = shape.waterHeight ?? tile.height(x, z) + 0.65;
          }
        } else if (shape.kind === 'building' || shape.kind === 'road' || shape.kind === 'built') {
          if (distance <= margin + (shape.kind === 'road' ? 2 : 1)) safe = false;
        } else if (distance === 0 && shape.kind === 'protected') protectedArea = true;
        else if (distance === 0 && !water && shape.kind !== 'unknown') kind = shape.kind;
      }
    }
    const delta = Math.max(1, margin);
    const slope =
      Math.max(
        Math.abs(cover.height(x + delta, z) - cover.height(x - delta, z)),
        Math.abs(cover.height(x, z + delta) - cover.height(x, z - delta)),
      ) /
      (2 * delta);
    return {
      kind,
      height,
      safe: safe && kind !== 'unknown' && Number.isFinite(height) && (water || slope < 0.65),
      water,
      waterDistance,
      protected: protectedArea,
    };
  }

  clear(): void {
    this.cover.clear();
    this.features.clear();
    this.activeCover = [];
    this.activeFeatures = [];
  }
}
