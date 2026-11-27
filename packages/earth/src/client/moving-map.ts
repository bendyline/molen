/**
 * A moving map for a driven car's centre screen: the roads and water the view streams anyway,
 * drawn around the car and turned so the way it is going is up, the car a chevron in the lower
 * middle, the street it is on along the bottom and north in a corner. `EarthVehicles` paints it
 * on the screen `findVehicleCenterDisplay` finds in the mounted car's model, in place of the
 * still map printed there (`EarthVehiclesOptions.map`).
 *
 * The map observes the human-features layer, as the locator and the audio terrain do, and keeps
 * per rendered tile only references to the decoded features it draws (nothing copied): drivable
 * roads by kind, water areas and waterways, and the roads with a name or route number. A tile's
 * entry goes when the stream evicts it.
 *
 * A view (`EarthMovingMap.view`, one per screen) draws in two steps:
 * - a north-up base, a square canvas around the car at about the screen's scale, drawn from the
 *   tiles coarsest first, each clipped to its square over a cleared ground, so where the stream
 *   holds a finer tile its roads replace the coarse tile's generalized ones. A tile whose part of
 *   the base finer tiles cover is skipped. The base is redrawn into a second canvas a share of
 *   points a frame (`POINTS_PER_FRAME`) when the car nears its edge, the zoom strays from it, or
 *   tiles on it came or went (at most once a second), and swapped in when done; the old one
 *   shows meanwhile. On boarding the screen shows bare ground for the few frames the first takes.
 * - the screen: the base turned and scaled around the car, then the chevron, compass and street.
 * The zoom follows speed: about 260 m across the screen standing, widening to 1.1 km at speed.
 *
 * Related: `locator.ts` (the same street search, for `EarthView.locate`), `vehicles.ts` (which
 * screen it paints and when), molen-client's `vehicle-screen.ts` (the screen itself).
 *
 * Gotchas: world +X is east and +Z south; a vehicle's `yaw` 0 faces +Z, so it travels along
 * (sin yaw, cos yaw) and the screen turns the north-up base by `yaw - π`. Line widths are screen
 * pixels at the base's scale: between redraws they grow and shrink with the zoom by up to a
 * quarter. Point counts, not time, pace the redraw, so the same frames draw the same map. Finer
 * tiles cover a coarse one by address (a child of `level/x/z` is `level+1/2x+i/2z+j`).
 * Without a 2D canvas (Node) `view` returns undefined.
 */
import {
  createVehicleScreen,
  type VehicleDisplay,
  type VehicleScreen,
} from '@bendyline/molen-client/vehicles';
import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticLine,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
  TerrainTransportationFeature,
} from '@bendyline/molen-terrain/client';
import { isAeroway, roadWidth, transportKind } from '@bendyline/molen-terrain/kernel';
import type * as THREE from 'three';
import type { SemanticTileObserver } from './ambient-tiles';

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Canvas = HTMLCanvasElement | OffscreenCanvas;

/** Where the car is, as the screen needs it. */
export interface EarthMovingMapPose {
  /** World position, meters. */
  x: number;
  z: number;
  /** The vehicle's yaw (0 faces +Z, south). */
  yaw: number;
  /** Speed, m/s; the zoom widens with it. */
  speed: number;
}

/** How a view draws: see {@link EarthMovingMap.view}. */
export interface EarthMovingMapViewOptions {
  /**
   * How far it shows: `'road'` (default) about 260 m across standing, to 1.1 km at speed;
   * `'air'` 800 m on the ground, half a minute of flight across at speed, to 25 km.
   */
  zoom?: 'road' | 'air';
  /** Name the street along the bottom (default true). */
  street?: boolean;
}

/** One screen's drawing of the map; see {@link EarthMovingMap.view}. */
export interface EarthMovingMapView {
  readonly width: number;
  readonly height: number;
  /** Paint the map around `pose` into `context` (a `width` × `height` canvas). */
  draw(context: Canvas2D, pose: EarthMovingMapPose, timeMs: number): void;
  /** The street the last `draw` showed, as printed ("Buena Road", "WA 22"); empty for none. */
  readonly street: string;
  dispose(): void;
}

/** Drawn road kinds, in drawing order: lowest first. */
const TUNNEL = 0;
const SERVICE = 1;
const MINOR = 2;
const MAJOR = 3;
const HIGHWAY = 4;
const KINDS = 5;

/** A rendered tile's features, by what the map draws them as. */
interface MapTile {
  level: number;
  /** Its column and row at its level: a finer tile's address halves into its parent's. */
  x: number;
  z: number;
  origin: readonly [number, number];
  size: number;
  roads: TerrainSemanticLine[][];
  water: TerrainSemanticPolygon[];
  waterways: { line: TerrainSemanticLine; width: number }[];
  named: TerrainTransportationFeature[];
}

/** Ways no car drives: tracks, paths, ferries, lifts, airfield pavement. */
const NOT_DRIVEN =
  /^(rail|railway|light_rail|subway|tram|monorail|funicular|narrow_gauge|ferry|aerialway|platform|runway|taxiway|apron)$/;

/**
 * How the map draws `road`, lowest first: 0 a tunnel, 1 a service road, 2 a street, 3 a main road,
 * 4 a motorway; undefined for a way no car drives.
 */
export function movingMapRoadKind(road: TerrainTransportationFeature): number | undefined {
  if (NOT_DRIVEN.test(road.class) || NOT_DRIVEN.test(road.subclass ?? '')) return undefined;
  if (isAeroway(road)) return undefined;
  const kind = transportKind(road);
  if (kind === 'rail' || kind === 'path') return undefined;
  if (road.tunnel) return TUNNEL;
  if (kind === 'service') return SERVICE;
  if (kind === 'motorway') return HIGHWAY;
  const sub = (road.subclass ?? '').replace(/_link$/, '');
  if (road.class === 'major_road' || /^(trunk|primary|secondary)$/.test(sub)) return MAJOR;
  return MINOR;
}

function mapTile(tile: TerrainSemanticTile, context: TerrainPyramidTileLayerContext): MapTile {
  const roads: TerrainSemanticLine[][] = Array.from({ length: KINDS }, () => []);
  const named: TerrainTransportationFeature[] = [];
  for (const road of tile.transportation) {
    const kind = movingMapRoadKind(road);
    if (kind === undefined) continue;
    for (const line of road.lines) if (line.length >= 2) roads[kind]?.push(line);
    if (kind !== TUNNEL && (road.name !== undefined || road.ref !== undefined)) named.push(road);
  }
  const water: TerrainSemanticPolygon[] = [];
  const waterways: { line: TerrainSemanticLine; width: number }[] = [];
  for (const feature of tile.water) {
    for (const polygon of feature.polygons ?? [])
      if (polygon.outer.length >= 3) water.push(polygon);
    for (const line of feature.lines ?? [])
      if (line.length >= 2) waterways.push({ line, width: feature.width ?? 0 });
  }
  return {
    level: context.address.level,
    x: context.address.x,
    z: context.address.z,
    origin: context.origin,
    size: context.tileSize,
    roads,
    water,
    waterways,
    named,
  };
}

/** A world square [x0, z0, x1, z1]. */
type Square = readonly [number, number, number, number];

/** The world square a base covers. */
function baseSquare(base: Base): Square {
  const half = base.canvas.width / 2 / base.scale;
  return [base.x - half, base.z - half, base.x + half, base.z + half];
}

function overlaps(ox: number, oz: number, size: number, square: Square): boolean {
  return ox < square[2] && oz < square[3] && ox + size > square[0] && oz + size > square[1];
}

function addressKey(level: number, x: number, z: number): string {
  return `${level}/${x}/${z}`;
}

/** Each line's tile-unit bounds [u0, v0, u1, v1], measured once per (immutable) decoded line. */
const lineBounds = new WeakMap<TerrainSemanticLine, [number, number, number, number]>();
function boundsOf(line: TerrainSemanticLine): [number, number, number, number] {
  let box = lineBounds.get(line);
  if (box === undefined) {
    box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [u, v] of line) {
      if (u < box[0]) box[0] = u;
      if (v < box[1]) box[1] = v;
      if (u > box[2]) box[2] = u;
      if (v > box[3]) box[3] = v;
    }
    lineBounds.set(line, box);
  }
  return box;
}

/** The look of the map: a dark screen, light streets, warm main roads. */
const STYLE = {
  ground: '#1a272d',
  water: '#22536b',
  casing: '#0d1519',
  roads: ['#334950', '#566e78', '#9db0b8', '#e6d394', '#f29d4f'] as const,
  /** Line widths at 512 px across the screen's long side, by kind; casings 2.5 px wider. */
  widths: [2.2, 1.6, 2.8, 4.6, 6.2] as const,
  cased: [false, false, false, true, true] as const,
  car: '#5cc8ff',
  carEdge: '#f4f8fa',
  label: '#f2f5f6',
  panel: 'rgba(9, 15, 18, 0.84)',
  north: '#ff6250',
} as const;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Meters across the screen's long side standing still, per m/s of speed, and at most: a car's
 * map, and an aircraft's, which shows about half a minute of flight across.
 */
const ZOOMS: Readonly<
  Record<'road' | 'air', { standing: number; perSpeed: number; most: number }>
> = {
  road: { standing: 260, perSpeed: 14, most: 1100 },
  air: { standing: 800, perSpeed: 30, most: 25_000 },
};
/**
 * Widest span (meters across the long side) each road kind is drawn at: tunnels and service
 * roads only close in, streets to a few kilometres, main roads to a region. An aircraft's map at
 * speed was a mat of side streets.
 */
const KIND_SPAN = [900, 900, 4500, 40_000, Infinity] as const;
/** Seconds the zoom takes to follow a change of speed (first-order). */
const ZOOM_SECONDS = 2.5;
/** The base is redrawn once the zoom strays this far from its scale either way. */
const ZOOM_STRAY = 1.25;
/** Where the car sits on the screen, as shares of its width and height. */
const CAR_AT: readonly [number, number] = [0.5, 0.7];
/**
 * Points (road and water vertices) drawn into the next base per frame: a count rather than a time,
 * so the same frames draw the same map. A frame draws at least one line or water area past it.
 * Stroking ran at 1-4 µs a point on a laptop on battery (a city's level-8 tile, 7,300 points, was
 * 8-30 ms drawn whole; 1,200 points a frame made the 95th percentile painting 5 ms). A city base
 * of some 15,000 points then takes under a second of paintings, while the car has seven or more
 * seconds of base left at any speed when the redraw starts.
 */
const POINTS_PER_FRAME = 600;

/** What one pass over a tile draws, in order: ground, water, waterways, then each road kind. */
type Pass =
  | { kind: 'ground' }
  | { kind: 'water' }
  | { kind: 'waterways' }
  | { kind: 'road'; road: number; casing: boolean };
const PASSES: readonly Pass[] = [
  { kind: 'ground' },
  { kind: 'water' },
  { kind: 'waterways' },
  ...Array.from({ length: KINDS }, (_, road): Pass[] =>
    STYLE.cased[road]
      ? [
          { kind: 'road', road, casing: true },
          { kind: 'road', road, casing: false },
        ]
      : [{ kind: 'road', road, casing: false }],
  ).flat(),
];
/** Milliseconds between redraws for new tiles (the car's moving away redraws at once). */
const REFRESH_MS = 1000;
/** Tile additions and evictions remembered, for telling whether one touched a base. */
const MAX_CHANGES = 512;
/** Milliseconds between street lookups, and the reach of one past a road's edge (meters). */
const STREET_MS = 500;
const STREET_RADIUS = 25;
/** Meters a road running square to the car counts as being farther away than it is. */
const CROSSING_PENALTY = 12;

/**
 * A 2D canvas drawn on the CPU (`willReadFrequently`), where the platform has one. GPU-backed, a
 * base's drawing stalled at times on a GPU busy with the scene (a single `fillRect` took 18 ms
 * while driving); on the CPU no pass of it took over 6 ms. Stroking costs the same either way.
 */
function canvas2d(
  width: number,
  height: number,
): { canvas: Canvas; context: Canvas2D } | undefined {
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      return context ? { canvas, context } : undefined;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      return context ? { canvas, context } : undefined;
    }
  } catch {
    // No 2D canvas here.
  }
  return undefined;
}

/** The streamed roads and water, kept for moving maps; see the module comment. */
export class EarthMovingMap {
  private readonly tiles = new Map<THREE.Object3D, MapTile>();
  /** How many held tiles have each address (`level/x/z`): a tile can be rebuilt before it goes. */
  private readonly addresses = new Map<string, number>();
  /** Counts additions and evictions. */
  private revision = 0;
  /**
   * The squares of the latest additions and evictions (up to MAX_CHANGES), oldest first: a view
   * redraws only for a change on its base. The stream adds and evicts tiles all the time while the
   * car moves, mostly far from it.
   */
  private readonly changes: { revision: number; square: Square }[] = [];

  readonly observer: SemanticTileObserver = {
    added: (object, tile, context) => {
      const entry = mapTile(tile, context);
      const previous = this.tiles.get(object);
      if (previous !== undefined) this.forget(previous);
      this.tiles.set(object, entry);
      const key = addressKey(entry.level, entry.x, entry.z);
      this.addresses.set(key, (this.addresses.get(key) ?? 0) + 1);
      this.changed(entry);
    },
    removed: (object) => {
      const entry = this.tiles.get(object);
      if (entry === undefined) return;
      this.tiles.delete(object);
      this.forget(entry);
      this.changed(entry);
    },
  };

  private changed(entry: MapTile): void {
    const [ox, oz] = entry.origin;
    this.changes.push({
      revision: ++this.revision,
      square: [ox, oz, ox + entry.size, oz + entry.size],
    });
    if (this.changes.length > MAX_CHANGES) this.changes.shift();
  }

  /** Whether a tile overlapping `square` came or went after `revision`. */
  private changedSince(revision: number, square: Square): boolean {
    if (revision >= this.revision) return false;
    // The log no longer reaches back that far: assume so.
    if ((this.changes[0]?.revision ?? Infinity) > revision + 1) return true;
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const change = this.changes[i] as { revision: number; square: Square };
      if (change.revision <= revision) break;
      const [x0, z0, x1] = change.square;
      if (overlaps(x0, z0, x1 - x0, square)) return true;
    }
    return false;
  }

  private forget(entry: MapTile): void {
    const key = addressKey(entry.level, entry.x, entry.z);
    const count = (this.addresses.get(key) ?? 1) - 1;
    if (count > 0) this.addresses.set(key, count);
    else this.addresses.delete(key);
  }

  /**
   * Tiles overlapping the world square [x0, x0 + side] × [z0, z0 + side], coarsest first,
   * without those whose part of the square finer tiles cover: the stream keeps a coarse tile
   * under the fine ones that replaced it, and a city's level-8 tile alone cost 10-50 ms to draw.
   */
  private tilesIn(x0: number, z0: number, side: number): MapTile[] {
    const found: MapTile[] = [];
    let finest = -1;
    for (const tile of this.tiles.values()) if (tile.level > finest) finest = tile.level;
    const square: Square = [x0, z0, x0 + side, z0 + side];
    for (const tile of this.tiles.values()) {
      const [ox, oz] = tile.origin;
      if (!overlaps(ox, oz, tile.size, square)) continue;
      if (this.covered(tile.level, tile.x, tile.z, ox, oz, tile.size, square, finest)) continue;
      found.push(tile);
    }
    return found.sort((a, b) => a.level - b.level);
  }

  /** Whether held tiles finer than this one cover all of it that lies in `square`. */
  private covered(
    level: number,
    x: number,
    z: number,
    ox: number,
    oz: number,
    size: number,
    square: Square,
    finest: number,
  ): boolean {
    if (level >= finest) return false;
    const half = size / 2;
    for (let dz = 0; dz < 2; dz++) {
      for (let dx = 0; dx < 2; dx++) {
        const cx = ox + dx * half;
        const cz = oz + dz * half;
        if (!overlaps(cx, cz, half, square)) continue;
        const column = 2 * x + dx;
        const row = 2 * z + dz;
        if (this.addresses.has(addressKey(level + 1, column, row))) continue;
        if (!this.covered(level + 1, column, row, cx, cz, half, square, finest)) return false;
      }
    }
    return true;
  }

  /**
   * The street at world (x, z) for a car going along `yaw`, as a screen prints it (name, else
   * route number), from the finest tiles holding the place; empty where none is within reach.
   * A road running the car's way wins over a cross street at a junction.
   */
  streetAt(x: number, z: number, yaw: number): string {
    let finest = -1;
    for (const tile of this.tiles.values()) {
      const [ox, oz] = tile.origin;
      if (x >= ox && z >= oz && x <= ox + tile.size && z <= oz + tile.size && tile.level > finest)
        finest = tile.level;
    }
    if (finest < 0) return '';
    const du = Math.sin(yaw);
    const dv = Math.cos(yaw);
    let best = '';
    let bestScore = Infinity;
    for (const tile of this.tiles.values()) {
      if (tile.level !== finest) continue;
      const [ox, oz] = tile.origin;
      const reach = STREET_RADIUS + 40;
      if (
        x < ox - reach ||
        z < oz - reach ||
        x > ox + tile.size + reach ||
        z > oz + tile.size + reach
      )
        continue;
      const u = (x - ox) / tile.size;
      const v = (z - oz) / tile.size;
      for (const road of tile.named) {
        const half = (road.width ?? roadWidth(road.class)) / 2;
        for (const line of road.lines) {
          const box = boundsOf(line);
          const outside =
            Math.hypot(Math.max(box[0] - u, 0, u - box[2]), Math.max(box[1] - v, 0, v - box[3])) *
              tile.size -
            half;
          if (outside > STREET_RADIUS || outside >= bestScore) continue;
          for (let i = 1; i < line.length; i++) {
            const a = line[i - 1] as [number, number];
            const b = line[i] as [number, number];
            const su = b[0] - a[0];
            const sv = b[1] - a[1];
            const length2 = su * su + sv * sv;
            const t =
              length2 > 0
                ? Math.max(0, Math.min(1, ((u - a[0]) * su + (v - a[1]) * sv) / length2))
                : 0;
            const distance = Math.max(
              0,
              Math.hypot(u - a[0] - t * su, v - a[1] - t * sv) * tile.size - half,
            );
            if (distance > STREET_RADIUS) continue;
            const across = length2 > 0 ? Math.abs(du * sv - dv * su) / Math.sqrt(length2) : 0;
            const score = distance + CROSSING_PENALTY * across;
            if (score < bestScore) {
              bestScore = score;
              best = road.name ?? road.ref?.split(';')[0]?.trim() ?? '';
            }
          }
        }
      }
    }
    return best;
  }

  /**
   * A drawing of the map for a `width` × `height` screen; undefined without a 2D canvas.
   */
  view(
    width: number,
    height: number,
    options: EarthMovingMapViewOptions = {},
  ): EarthMovingMapView | undefined {
    const source: MapSource = {
      version: () => this.revision,
      changedSince: (revision, square) => this.changedSince(revision, square),
      tilesIn: (x0, z0, side) => this.tilesIn(x0, z0, side),
      streetAt: (x, z, yaw) => this.streetAt(x, z, yaw),
    };
    return MovingMapScreen.create(source, width, height, options);
  }

  clear(): void {
    this.tiles.clear();
    this.addresses.clear();
    this.revision++;
  }
}

/** What a screen reads of the map. */
interface MapSource {
  /** Counts the stream's additions and evictions: a base drawn at another count is out of date. */
  version(): number;
  changedSince(revision: number, square: Square): boolean;
  tilesIn(x0: number, z0: number, side: number): MapTile[];
  streetAt(x: number, z: number, yaw: number): string;
}

/** A north-up drawing of the tiles around a point, at `scale` pixels per meter. */
interface Base {
  canvas: Canvas;
  context: Canvas2D;
  /** World point at the canvas's middle. */
  x: number;
  z: number;
  scale: number;
  /** The map's revision it was drawn from, and when (ms). */
  version: number;
  at: number;
}

/** A base being drawn, a share of points a frame. */
interface Job {
  base: Base;
  tiles: MapTile[];
  /** Where it has got to: the tile, the pass over it, and the next item of that pass. */
  tile: number;
  pass: number;
  item: number;
}

class MovingMapScreen implements EarthMovingMapView {
  /** The base on show, if one is drawn yet; the other of the pair takes the next drawing. */
  private shown: Base | undefined;
  private job: Job | undefined;
  /** Pixels per meter on screen, following the speed. */
  private scale = 0;
  private lastTime: number | undefined;
  private shownStreet = '';
  private streetTime = -Infinity;
  /** Lengths in pixels at 512 px across the long side, scaled to this screen. */
  private readonly unit: number;

  static create(
    source: MapSource,
    width: number,
    height: number,
    options: EarthMovingMapViewOptions,
  ): MovingMapScreen | undefined {
    const carX = width * CAR_AT[0];
    const carY = height * CAR_AT[1];
    const reach = Math.max(
      Math.hypot(carX, carY),
      Math.hypot(width - carX, carY),
      Math.hypot(carX, height - carY),
      Math.hypot(width - carX, height - carY),
    );
    // Room for the screen to turn about the car, and about as far again to drive before a redraw.
    const side = Math.min(2048, Math.ceil((reach * 3.2) / 64) * 64);
    const one = canvas2d(side, side);
    const two = canvas2d(side, side);
    if (one === undefined || two === undefined) return undefined;
    const base = (paint: { canvas: Canvas; context: Canvas2D }): Base => ({
      ...paint,
      x: 0,
      z: 0,
      scale: 1,
      version: -1,
      at: -Infinity,
    });
    return new MovingMapScreen(source, width, height, reach, [base(one), base(two)], options);
  }

  private constructor(
    private readonly source: MapSource,
    readonly width: number,
    readonly height: number,
    /** Screen pixels from the car to the farthest screen corner. */
    private readonly reach: number,
    private readonly bases: readonly [Base, Base],
    private readonly options: EarthMovingMapViewOptions,
  ) {
    this.unit = Math.max(width, height) / 512;
  }

  get street(): string {
    return this.shownStreet;
  }

  draw(context: Canvas2D, pose: EarthMovingMapPose, timeMs: number): void {
    const long = Math.max(this.width, this.height);
    const speed = Number.isFinite(pose.speed) ? Math.abs(pose.speed) : 0;
    const zoom = ZOOMS[this.options.zoom ?? 'road'];
    const target = long / Math.min(zoom.most, zoom.standing + zoom.perSpeed * speed);
    const dt = this.lastTime === undefined ? 0 : Math.max(0, timeMs - this.lastTime) / 1000;
    this.lastTime = timeMs;
    this.scale =
      this.scale === 0
        ? target
        : this.scale + (target - this.scale) * (1 - Math.exp(-dt / ZOOM_SECONDS));
    this.advance(pose, timeMs);
    if (this.options.street !== false && timeMs - this.streetTime >= STREET_MS) {
      this.streetTime = timeMs;
      this.shownStreet = this.source.streetAt(pose.x, pose.z, pose.yaw);
    }
    this.compose(context, pose);
  }

  /** Whether `base` holds everything the screen shows around `pose`, meters to spare. */
  private spare(base: Base, pose: EarthMovingMapPose): number {
    const half = base.canvas.width / 2 / base.scale;
    return half - this.reach / this.scale - Math.hypot(pose.x - base.x, pose.z - base.z);
  }

  /** Start, continue or finish redrawing the base as the car, zoom and tiles require. */
  private advance(pose: EarthMovingMapPose, timeMs: number): void {
    const shown = this.shown;
    // The screen has left the base on show, or there is none yet (on boarding).
    const lost = shown === undefined || this.spare(shown, pose) < 0;
    // A drawing begun for a place the screen has left is no use either.
    if (lost && this.job !== undefined && this.spare(this.job.base, pose) < 0) this.job = undefined;
    if (this.job === undefined && (lost || this.stale(shown, pose, timeMs)))
      this.begin(pose, timeMs);
    const job = this.job;
    if (job === undefined) return;
    // The frame's share of points, four shares while the screen shows ground where its base ends:
    // drawn whole on boarding, a Lake Union base was a 120 ms frame.
    let budget = lost ? 4 * POINTS_PER_FRAME : POINTS_PER_FRAME;
    while (job.tile < job.tiles.length && budget > 0) {
      const tile = job.tiles[job.tile] as MapTile;
      const pass = PASSES[job.pass] as Pass;
      const { next, spent } = this.drawPass(job.base, tile, pass, job.item, budget);
      budget -= spent;
      if (next !== undefined) {
        job.item = next;
        continue;
      }
      job.item = 0;
      if (++job.pass < PASSES.length) continue;
      job.pass = 0;
      job.tile++;
    }
    if (job.tile < job.tiles.length) return;
    this.job = undefined;
    this.shown = job.base;
  }

  /** The base on show is due a redraw: the car nears its edge, the zoom left it, or tiles came. */
  private stale(base: Base | undefined, pose: EarthMovingMapPose, timeMs: number): boolean {
    if (base === undefined) return true;
    const room = base.canvas.width / 2 / base.scale - this.reach / this.scale;
    return (
      base.scale / this.scale > ZOOM_STRAY ||
      this.scale / base.scale > ZOOM_STRAY ||
      Math.hypot(pose.x - base.x, pose.z - base.z) > 0.35 * room ||
      (timeMs - base.at >= REFRESH_MS && this.source.changedSince(base.version, baseSquare(base)))
    );
  }

  /** Begin drawing the base not on show, around and a little ahead of the car. */
  private begin(pose: EarthMovingMapPose, timeMs: number): void {
    const base = this.bases[0] === this.shown ? this.bases[1] : this.bases[0];
    const side = base.canvas.width;
    // Centred ahead, so the drive away from it is long.
    const ahead = Math.max(0, side / 2 / this.scale - this.reach / this.scale) * 0.3;
    base.x = pose.x + Math.sin(pose.yaw) * ahead;
    base.z = pose.z + Math.cos(pose.yaw) * ahead;
    base.scale = this.scale;
    base.version = this.source.version();
    base.at = timeMs;
    const width = side / base.scale;
    this.job = {
      base,
      tiles: this.source.tilesIn(base.x - width / 2, base.z - width / 2, width),
      tile: 0,
      pass: 0,
      item: 0,
    };
    base.context.setTransform(1, 0, 0, 1, 0, 0);
    base.context.fillStyle = STYLE.ground;
    base.context.fillRect(0, 0, side, side);
  }

  /**
   * Draw `pass` over `tile` from its item `from` until `budget` points are spent (at least one
   * item): `next` is the item to go on from, undefined once the pass is done.
   */
  private drawPass(
    base: Base,
    tile: MapTile,
    pass: Pass,
    from: number,
    budget: number,
  ): { next?: number; spent: number } {
    const { context } = base;
    const side = base.canvas.width;
    const k = base.scale;
    const x0 = base.x - side / 2 / k;
    const z0 = base.z - side / 2 / k;
    const [ox, oz] = tile.origin;
    // Tile units to base pixels: (u, v) lands at (ax + s u, az + s v). Points are placed here
    // rather than by a context transform: stroked in tile units under a scale of thousands, a
    // street tile took 8-17 ms.
    const s = k * tile.size;
    const ax = k * (ox - x0);
    const az = k * (oz - z0);
    const place: Place = {
      s,
      ax,
      az,
      u0: -ax / s,
      v0: -az / s,
      u1: (side - ax) / s,
      v1: (side - az) / s,
    };
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.save();
    context.beginPath();
    context.rect(ax, az, s, s);
    context.clip();
    let spent = 0;
    let next: number | undefined;
    if (pass.kind === 'ground') {
      // Over whatever coarser tile was drawn here before.
      context.fillStyle = STYLE.ground;
      context.fillRect(ax, az, s, s);
    } else if (pass.kind === 'water') {
      context.beginPath();
      let i = from;
      for (; i < tile.water.length && (i === from || spent < budget); i++) {
        const polygon = tile.water[i] as TerrainSemanticPolygon;
        if (!inView(boundsOf(polygon.outer), place)) continue;
        tracePath(context, polygon.outer, place, true);
        spent += polygon.outer.length;
        for (const hole of polygon.holes ?? []) {
          tracePath(context, hole, place, true);
          spent += hole.length;
        }
      }
      if (spent > 0) {
        context.fillStyle = STYLE.water;
        context.fill('evenodd');
      }
      if (i < tile.water.length) next = i;
    } else if (pass.kind === 'waterways') {
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = STYLE.water;
      let i = from;
      for (; i < tile.waterways.length && (i === from || spent < budget); i++) {
        const { line, width } = tile.waterways[i] as (typeof tile.waterways)[number];
        // As wide as it is, to 6 px; a stream thinner than a pixel at this zoom leaves no mark.
        const px = width * k;
        if (px < 1 || !inView(boundsOf(line), place)) continue;
        context.lineWidth = Math.min(px, 6 * this.unit);
        context.beginPath();
        tracePath(context, line, place);
        context.stroke();
        spent += line.length;
      }
      if (i < tile.waterways.length) next = i;
    } else if (
      Math.max(this.width, this.height) / base.scale <=
      (KIND_SPAN[pass.road] ?? Number.POSITIVE_INFINITY)
    ) {
      const lines = tile.roads[pass.road] ?? [];
      const width = (STYLE.widths[pass.road] ?? 2) * this.unit;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = pass.casing
        ? STYLE.casing
        : (STYLE.roads[pass.road] ?? STYLE.roads[MINOR]);
      context.lineWidth = pass.casing ? width + 2.5 * this.unit : width;
      context.beginPath();
      let i = from;
      for (; i < lines.length && (i === from || spent < budget); i++) {
        const line = lines[i] as TerrainSemanticLine;
        if (!inView(boundsOf(line), place)) continue;
        tracePath(context, line, place);
        spent += line.length;
      }
      if (spent > 0) context.stroke();
      if (i < lines.length) next = i;
    }
    context.restore();
    return next === undefined ? { spent } : { next, spent };
  }

  /** The base turned about the car, then the chevron, compass and street name. */
  private compose(context: Canvas2D, pose: EarthMovingMapPose): void {
    const { width, height, unit } = this;
    const carX = width * CAR_AT[0];
    const carY = height * CAR_AT[1];
    const turn = pose.yaw - Math.PI;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = STYLE.ground;
    context.fillRect(0, 0, width, height);
    const base = this.shown;
    if (base !== undefined) {
      const k = this.scale;
      const meters = base.canvas.width / base.scale;
      context.save();
      context.translate(carX, carY);
      context.rotate(turn);
      context.scale(k, k);
      context.translate(-pose.x, -pose.z);
      context.imageSmoothingEnabled = true;
      context.drawImage(base.canvas, base.x - meters / 2, base.z - meters / 2, meters, meters);
      context.restore();
    }
    // The car: a chevron pointing up the screen.
    const size = 13 * unit;
    context.setTransform(1, 0, 0, 1, carX, carY);
    context.beginPath();
    context.moveTo(0, -size);
    context.lineTo(size * 0.72, size * 0.72);
    context.lineTo(0, size * 0.32);
    context.lineTo(-size * 0.72, size * 0.72);
    context.closePath();
    context.fillStyle = STYLE.car;
    context.fill();
    context.lineWidth = 2 * unit;
    context.strokeStyle = STYLE.carEdge;
    context.lineJoin = 'round';
    context.stroke();
    // North: the world's -Z turned with the map.
    const radius = 15 * unit;
    const cx = width - radius - 8 * unit;
    const cy = radius + 8 * unit;
    context.setTransform(1, 0, 0, 1, cx, cy);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = STYLE.panel;
    context.fill();
    context.rotate(turn);
    context.beginPath();
    context.moveTo(0, -radius * 0.78);
    context.lineTo(radius * 0.32, 0);
    context.lineTo(-radius * 0.32, 0);
    context.closePath();
    context.fillStyle = STYLE.north;
    context.fill();
    context.beginPath();
    context.moveTo(0, radius * 0.78);
    context.lineTo(radius * 0.32, 0);
    context.lineTo(-radius * 0.32, 0);
    context.closePath();
    context.fillStyle = STYLE.label;
    context.fill();
    // The street, along the bottom.
    const name = this.shownStreet;
    if (name !== '') {
      context.setTransform(1, 0, 0, 1, 0, 0);
      const font = Math.round(19 * unit);
      context.font = `600 ${font}px ${FONT}`;
      const pad = 10 * unit;
      const text = fitText(context, name, width - 2 * pad - 16 * unit);
      const measured = context.measureText(text).width;
      const panelWidth = measured + 2 * pad;
      const panelHeight = font * 1.55;
      const top = height - panelHeight - 6 * unit;
      context.fillStyle = STYLE.panel;
      roundRect(context, (width - panelWidth) / 2, top, panelWidth, panelHeight, panelHeight / 2);
      context.fill();
      context.fillStyle = STYLE.label;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, width / 2, top + panelHeight / 2 + font * 0.04);
    }
  }

  dispose(): void {
    this.job = undefined;
    this.shown = undefined;
    // A canvas's pixels stay until it is collected; a zero size lets them go now.
    for (const base of this.bases) {
      base.canvas.width = 0;
      base.canvas.height = 0;
    }
  }
}

/** Where a tile lands on a base: pixel scale and offset, and the base's extent in tile units. */
interface Place {
  s: number;
  ax: number;
  az: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

function inView(box: readonly [number, number, number, number], place: Place): boolean {
  return box[2] >= place.u0 && box[3] >= place.v0 && box[0] <= place.u1 && box[1] <= place.v1;
}

/** Add `line` (tile units) to the context's path in base pixels. */
function tracePath(
  context: Canvas2D,
  line: TerrainSemanticLine,
  place: Place,
  close = false,
): void {
  const { s, ax, az } = place;
  const first = line[0];
  if (first === undefined) return;
  context.moveTo(ax + s * first[0], az + s * first[1]);
  for (let i = 1; i < line.length; i++) {
    const point = line[i] as [number, number];
    context.lineTo(ax + s * point[0], az + s * point[1]);
  }
  if (close) context.closePath();
}

/** `text`, cut short with an ellipsis to fit `width` pixels in the context's font. */
function fitText(context: Canvas2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function roundRect(
  context: Canvas2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

/** Fewest milliseconds between two paintings of a map screen: at most 30 a second. */
const SCREEN_FRAME_MS = 1000 / 30;

/**
 * A moving map kept on the screen of whichever model a host is in: fitted when the model comes
 * (`find` chooses the screen: `findVehicleCenterDisplay` for a car, `findCockpitMapDisplay` for an
 * aircraft), painted at most 30 times a second while the host says so (from the seat), taken off
 * when the host leaves or the model goes. `EarthVehicles` and `EarthAircraft` each keep one.
 */
export class EarthMapScreen {
  private fitted:
    | { model: THREE.Object3D; screen?: VehicleScreen; view?: EarthMovingMapView }
    | undefined;
  private painted = -Infinity;

  constructor(
    private readonly map: EarthMovingMap,
    private readonly options: EarthMovingMapViewOptions = {},
  ) {}

  /** The street the screen last showed; empty for none. */
  get street(): string {
    return this.fitted?.view?.street ?? '';
  }

  /**
   * Keep the map on `model`'s screen (undefined: on none), and paint it around `pose` when `paint`
   * and due. `find` is asked once per model.
   */
  update(
    model: THREE.Object3D | undefined,
    find: (model: THREE.Object3D) => VehicleDisplay | undefined,
    pose: EarthMovingMapPose | undefined,
    paint: boolean,
  ): void {
    if (this.fitted !== undefined && this.fitted.model !== model) this.dispose();
    if (model === undefined) return;
    if (this.fitted === undefined) {
      const display = find(model);
      const screen = display === undefined ? undefined : createVehicleScreen(model, display);
      const view =
        screen === undefined ? undefined : this.map.view(screen.width, screen.height, this.options);
      if (screen !== undefined && view === undefined) screen.dispose();
      this.fitted = {
        model,
        ...(screen !== undefined && view !== undefined ? { screen, view } : {}),
      };
      this.painted = -Infinity;
    }
    const { screen, view } = this.fitted;
    if (screen === undefined || view === undefined || pose === undefined || !paint) return;
    const now = performance.now();
    if (now - this.painted < SCREEN_FRAME_MS) return;
    this.painted = now;
    view.draw(screen.context, pose, now);
    screen.refresh();
  }

  /** Take the map off the screen it is on. */
  dispose(): void {
    this.fitted?.view?.dispose();
    this.fitted?.screen?.dispose();
    this.fitted = undefined;
  }
}
