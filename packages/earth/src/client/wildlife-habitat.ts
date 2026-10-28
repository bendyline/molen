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
/** Habitat kinds by code (see Tile.kinds), added to as tiles name new ones. */
const KINDS: string[] = [];
const kindCodes = new Map<string, number>();
function kindCode(kind: string): number {
  let code = kindCodes.get(kind);
  if (code === undefined) {
    code = KINDS.length;
    KINDS.push(kind);
    kindCodes.set(kind, code);
  }
  return code;
}
/** Main-thread time (ms) a sync spends compiling tiles (see sync). */
const HABITAT_COMPILE_MS = 2;

/** An added tile, and its habitat once compiled (when the decoded tile is let go). */
interface Pending {
  object: THREE.Object3D;
  tile?: TerrainSemanticTile;
  context: TerrainPyramidTileLayerContext;
  compiled?: Tile;
}

interface Tile {
  object: THREE.Object3D;
  context: TerrainPyramidTileLayerContext;
  /**
   * The tile's shapes as columns, a handful of arrays however many shapes: shapes as objects
   * holding the decoded tile's rings kept every point of every tile within reach alive, and
   * objects of their own were a city's hundreds of thousands, for each collection to walk.
   * A shape is its position (a sample weighs candidates in this order); `points` holds every
   * shape's points as x, z pairs; shape s's [start, end) point runs are `runs` from `runStart[s]`
   * to `runStart[s + 1]`, a polygon's outer ring first, then its holes.
   */
  points: Float64Array;
  runs: Uint32Array;
  runStart: Uint32Array;
  /** Each shape's kind (see KINDS). */
  kinds: Uint16Array;
  /** 1 for a polygon (its runs are rings), 0 for a line. */
  closed: Uint8Array;
  widths: Float64Array;
  /** Four a shape: a polygon's outer ring's bounds, or a line's. */
  bounds: Float64Array;
  /** Each water polygon's surface height, where `watered` is 1. */
  waterHeights: Float64Array;
  watered: Uint8Array;
  /** Water shapes, searched 500 m out, so always checked. */
  water: Uint32Array;
  /**
   * Every other shape by grid cell (GRID x GRID over the tile, edges clamped): cell c's are
   * `cells` from `cellStart[c]` to `cellStart[c + 1]`.
   */
  cells: Uint32Array;
  cellStart: Uint32Array;
  /** The widest non-water shape, which widens a sample's grid search. */
  widest: number;
  height: (x: number, z: number) => number;
  /** Kept samples (see sample's `keep`) by the features tile they were taken with, by point. */
  kept: WeakMap<Tile, Map<string, WildlifeLocalHabitat>>;
}

/** Kept samples a tile pair holds before it starts over. */
const KEPT_SAMPLES = 8192;
/**
 * Cells across a tile's shape grid. Each sample scanned every shape in its tile, thousands of
 * buildings and roads in a dense town, about a hundred samples per resample: 10 ms and more.
 */
const GRID = 32;
const gridCell = (value: number): number =>
  Math.max(0, Math.min(GRID - 1, Math.floor(value * GRID)));
export interface WildlifeLocalHabitat extends WildlifeHabitat {
  waterDistance: number;
  protected: boolean;
}

/** The bounds of points [start, end), into `out` at `at`. */
function boundsInto(
  out: Float64Array,
  at: number,
  points: Float64Array,
  start: number,
  end: number,
): void {
  let x0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    z1 = -Infinity;
  for (let i = start; i < end; i++) {
    const x = points[i * 2] as number,
      z = points[i * 2 + 1] as number;
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  out[at] = x0;
  out[at + 1] = z0;
  out[at + 2] = x1;
  out[at + 3] = z1;
}
function distanceToLine(
  x: number,
  z: number,
  points: Float64Array,
  start: number,
  end: number,
  closed: boolean,
): number {
  const count = end - start;
  let distance = Infinity;
  for (let i = 1; i < count + (closed ? 1 : 0); i++) {
    const a = (start + i - 1) * 2,
      b = (start + (i % count)) * 2;
    const ax = points[a] as number,
      az = points[a + 1] as number;
    const dx = (points[b] as number) - ax,
      dz = (points[b + 1] as number) - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return distance;
}
function insideRing(x: number, z: number, points: Float64Array, start: number, end: number) {
  let inside = false;
  for (let i = start, j = end - 1; i < end; j = i++) {
    const ax = points[i * 2] as number,
      az = points[i * 2 + 1] as number,
      bx = points[j * 2] as number,
      bz = points[j * 2 + 1] as number;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
function distanceToShape(x: number, z: number, tile: Tile, shape: number): number {
  const { points, runs } = tile;
  const first = tile.runStart[shape] as number,
    last = tile.runStart[shape + 1] as number;
  if (tile.closed[shape] === 1) {
    let inside = insideRing(x, z, points, runs[first] as number, runs[first + 1] as number);
    for (let r = first + 2; inside && r < last; r += 2)
      if (insideRing(x, z, points, runs[r] as number, runs[r + 1] as number)) inside = false;
    if (inside) return 0;
    let distance = Infinity;
    for (let r = first; r < last; r += 2)
      distance = Math.min(
        distance,
        distanceToLine(x, z, points, runs[r] as number, runs[r + 1] as number, true),
      );
    return distance;
  }
  return Math.max(
    0,
    distanceToLine(x, z, points, runs[first] as number, runs[first + 1] as number, false) -
      (tile.widths[shape] as number) / 2,
  );
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
  /**
   * Added tiles, compiled into habitat shapes a couple of milliseconds a sync, those within reach
   * first (see sync), and the decoded tile let go: compiling every streamed tile as it arrived was
   * a city's every footprint, road and land use made into shapes at once.
   */
  private readonly cover = new Map<THREE.Object3D, Pending>();
  private readonly features = new Map<THREE.Object3D, Pending>();
  private activeCover: Tile[] = [];
  private activeFeatures: Tile[] = [];
  private revision = 0;
  private losses = 0;
  get version(): number {
    return this.revision;
  }
  /** Bumped when a tile leaves the active set: animals placed on it may now stand nowhere. */
  get lostVersion(): number {
    return this.losses;
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
        target.set(object, { object, tile, context });
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
    // The shapes' rings and lines as the tile holds them, copied into one array below.
    const sources: {
      kind: string;
      rings: readonly (readonly Point[])[];
      closed: boolean;
      width: number;
      waterHeight?: number;
    }[] = [];
    const polygon = (kind: string, p: TerrainSemanticPolygon, waterHeight?: number): void => {
      sources.push({
        kind,
        rings: [p.outer, ...(p.holes ?? [])],
        closed: true,
        width: 0,
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
        sources.push({
          kind,
          rings: [line],
          closed: false,
          width: (feature.width ?? 3) / context.tileSize,
        });
    }
    for (const road of tile.transportation) {
      if (road.tunnel || road.bridge || (road.layer ?? 0) !== 0) continue;
      for (const line of road.lines)
        sources.push({
          kind: 'road',
          rings: [line],
          closed: false,
          width:
            (road.width ?? (['path', 'footway', 'track'].includes(road.class) ? 3 : 9)) /
            context.tileSize,
        });
    }
    const n = sources.length;
    let count = 0,
      runCount = 0;
    for (const source of sources) {
      runCount += source.rings.length * 2;
      for (const ring of source.rings) count += ring.length;
    }
    const points = new Float64Array(count * 2),
      runs = new Uint32Array(runCount),
      runStart = new Uint32Array(n + 1),
      kinds = new Uint16Array(n),
      closed = new Uint8Array(n),
      widths = new Float64Array(n),
      bounds = new Float64Array(n * 4),
      waterHeights = new Float64Array(n),
      watered = new Uint8Array(n);
    const water: number[] = [];
    const cellCounts = new Uint32Array(GRID * GRID + 1);
    let at = 0,
      run = 0,
      widest = 0;
    sources.forEach(({ kind, rings, closed: polygon, width, waterHeight }, shape) => {
      runStart[shape] = run;
      for (const ring of rings) {
        runs[run++] = at;
        for (const [x, z] of ring) {
          points[at * 2] = x;
          points[at * 2 + 1] = z;
          at++;
        }
        runs[run++] = at;
      }
      kinds[shape] = kindCode(kind);
      closed[shape] = polygon ? 1 : 0;
      widths[shape] = width;
      if (waterHeight !== undefined) {
        waterHeights[shape] = waterHeight;
        watered[shape] = 1;
      }
      // A polygon's bounds are its outer ring's; a line's, the line's.
      const first = runStart[shape] as number;
      boundsInto(bounds, shape * 4, points, runs[first] as number, runs[first + 1] as number);
      if (kind === 'water' || kind === 'freshwater') {
        water.push(shape);
        return;
      }
      widest = Math.max(widest, width);
      for (
        let row = gridCell(bounds[shape * 4 + 1] as number);
        row <= gridCell(bounds[shape * 4 + 3] as number);
        row++
      )
        for (
          let col = gridCell(bounds[shape * 4] as number);
          col <= gridCell(bounds[shape * 4 + 2] as number);
          col++
        )
          (cellCounts[row * GRID + col + 1] as number)++;
    });
    runStart[n] = run;
    // Cell starts, then each cell's shapes in shape order.
    for (let c = 1; c <= GRID * GRID; c++)
      cellCounts[c] = (cellCounts[c] as number) + (cellCounts[c - 1] as number);
    const cellStart = cellCounts;
    const cells = new Uint32Array(cellStart[GRID * GRID] as number);
    const fill = cellStart.slice(0, GRID * GRID);
    for (let shape = 0; shape < n; shape++) {
      const kind = sources[shape]?.kind;
      if (kind === 'water' || kind === 'freshwater') continue;
      for (
        let row = gridCell(bounds[shape * 4 + 1] as number);
        row <= gridCell(bounds[shape * 4 + 3] as number);
        row++
      )
        for (
          let col = gridCell(bounds[shape * 4] as number);
          col <= gridCell(bounds[shape * 4 + 2] as number);
          col++
        )
          cells[(fill[row * GRID + col] as number)++] = shape;
    }
    return {
      object,
      context,
      points,
      runs,
      runStart,
      kinds,
      closed,
      widths,
      bounds,
      waterHeights,
      watered,
      water: Uint32Array.from(water),
      cells,
      cellStart,
      widest,
      height: renderedGroundSampler(
        context.heightfield,
        context.origin,
        context.tileSize,
        context.surfaceResolution,
      ),
      kept: new WeakMap(),
    };
  }

  sync(position: readonly [number, number, number], radius: number): void {
    const started = performance.now();
    const compile = (pending: Pending): void => {
      const tile = pending.tile as TerrainSemanticTile;
      pending.compiled = this.compile(pending.object, tile, pending.context);
      delete pending.tile;
    };
    const active = (tiles: Map<THREE.Object3D, Pending>): Tile[] => {
      // At least one of each kind a sync: a sample needs land cover and features both.
      let compiled = false;
      return [...tiles.values()]
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
        )
        .flatMap((pending) => {
          // A couple of milliseconds of compiling a sync (at least one tile): a turn that brought
          // a city's tiles within reach compiled them all in one frame. The rest join at the next
          // syncs.
          if (
            pending.tile !== undefined &&
            (!compiled || performance.now() - started < HABITAT_COMPILE_MS)
          ) {
            compile(pending);
            compiled = true;
          }
          return pending.compiled === undefined ? [] : [pending.compiled];
        });
    };
    const cover = active(this.cover),
      features = active(this.features);
    // The rest of the time, tiles out of reach: none is kept decoded until it comes near.
    for (const tiles of [this.cover, this.features])
      for (const pending of tiles.values()) {
        if (performance.now() - started >= HABITAT_COMPILE_MS) break;
        if (pending.tile !== undefined) compile(pending);
      }
    if (
      cover.length !== this.activeCover.length ||
      features.length !== this.activeFeatures.length ||
      cover.some((tile, i) => tile !== this.activeCover[i]) ||
      features.some((tile, i) => tile !== this.activeFeatures[i])
    ) {
      this.revision++;
      const kept = new Set([...cover, ...features]);
      if ([...this.activeCover, ...this.activeFeatures].some((tile) => !kept.has(tile)))
        this.losses++;
    }
    this.activeCover = cover;
    this.activeFeatures = features;
  }

  /**
   * The habitat at a point. A kept sample is answered again, the same object, for as long as the
   * same land cover and features tiles hold the point: wildlife resamples fixed grid points every
   * time a tile comes or goes, and sampling them all again held a flight's frame 7 ms. Moving
   * animals' points are not kept.
   */
  sample(x: number, z: number, margin: number, keep = false): WildlifeLocalHabitat | undefined {
    const find = (tiles: Tile[]): Tile | undefined =>
      tiles.find(
        ({ context: { origin, tileSize } }) =>
          x >= origin[0] && z >= origin[1] && x < origin[0] + tileSize && z < origin[1] + tileSize,
      );
    const cover = find(this.activeCover),
      features = find(this.activeFeatures);
    if (cover === undefined || features === undefined) return undefined;
    let kept: Map<string, WildlifeLocalHabitat> | undefined;
    let key = '';
    if (keep) {
      key = `${x},${z},${margin}`;
      kept = cover.kept.get(features);
      if (kept === undefined || kept.size > KEPT_SAMPLES) {
        kept = new Map();
        cover.kept.set(features, kept);
      }
      const known = kept.get(key);
      if (known !== undefined) return known;
    }
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
      // Candidates: the water shapes and the grid cells within any land shape's reach, in the
      // tile's own order, so overlapping classes resolve exactly as a full scan did.
      const reach = (margin + 4) / tileSize + tile.widest / 2;
      const candidates = new Set<number>(tile.water);
      for (let row = gridCell(v - reach); row <= gridCell(v + reach); row++)
        for (let col = gridCell(u - reach); col <= gridCell(u + reach); col++)
          for (
            let k = tile.cellStart[row * GRID + col] as number;
            k < (tile.cellStart[row * GRID + col + 1] as number);
            k++
          )
            candidates.add(tile.cells[k] as number);
      const ordered = [...candidates].sort((a, b) => a - b);
      for (const shape of ordered) {
        const shapeKind = KINDS[tile.kinds[shape] as number] as string;
        const waterShape = shapeKind === 'water' || shapeKind === 'freshwater';
        const search =
          (waterShape ? 500 : margin + 4) / tileSize + (tile.widths[shape] as number) / 2;
        const b = shape * 4;
        if (
          u < (tile.bounds[b] as number) - search ||
          v < (tile.bounds[b + 1] as number) - search ||
          u > (tile.bounds[b + 2] as number) + search ||
          v > (tile.bounds[b + 3] as number) + search
        )
          continue;
        const distance = distanceToShape(u, v, tile, shape) * tileSize;
        if (waterShape) {
          waterDistance = Math.min(waterDistance, distance);
          if (distance === 0) {
            kind = shapeKind;
            water = true;
            height =
              tile.watered[shape] === 1
                ? (tile.waterHeights[shape] as number)
                : tile.height(x, z) + 0.65;
          }
        } else if (shapeKind === 'building' || shapeKind === 'road' || shapeKind === 'built') {
          if (distance <= margin + (shapeKind === 'road' ? 2 : 1)) safe = false;
        } else if (distance === 0 && shapeKind === 'protected') protectedArea = true;
        else if (distance === 0 && !water && shapeKind !== 'unknown') kind = shapeKind;
      }
    }
    const delta = Math.max(1, margin);
    const slope =
      Math.max(
        Math.abs(cover.height(x + delta, z) - cover.height(x - delta, z)),
        Math.abs(cover.height(x, z + delta) - cover.height(x, z - delta)),
      ) /
      (2 * delta);
    const habitat = {
      kind,
      height,
      safe: safe && kind !== 'unknown' && Number.isFinite(height) && (water || slope < 0.65),
      water,
      waterDistance,
      protected: protectedArea,
    };
    kept?.set(key, habitat);
    return habitat;
  }

  clear(): void {
    this.cover.clear();
    this.features.clear();
    this.activeCover = [];
    this.activeFeatures = [];
  }
}
