/**
 * Boats on the water around the camera: moored at the mapped docks of marinas and private piers
 * (harbor-moorings.ts) and under way on open water (harbor-cruising.ts).
 *
 * Reads the fine feature tiles as they stream (water polygons and their drawn surface heights,
 * `pier` outlines and paths, marina points, buildings standing in the water) and compiles each,
 * a little at a time, into its berths and a clearance field: meters of open water around each
 * cell, which steers the boats under way. Every boat is an instance: the nearest as their content
 * model's hull and deck (interior and lettering left off; a moored sailboat with its sail furled),
 * the rest as a low proxy, all in the shared vertex-colored vehicle material, in batches anchored
 * near the camera so float32 instance matrices keep their precision.
 *
 * Related: ambient.ts (ferries on mapped routes), wildlife.ts (the same tile observation pattern).
 */

import { InstanceBatch } from '@bendyline/molen-client/instancing';
import { vehicleProxyMaterial } from '@bendyline/molen-client/vehicles';
import {
  type TerrainPyramidTileLayerContext,
  type TerrainSemanticMeshOptions,
  type TerrainSemanticRing,
  type TerrainSemanticTile,
  terrainWaterSurfaceHeight,
} from '@bendyline/molen-terrain/client';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SemanticTileObserver } from './ambient-tiles';
import { isFineTile } from './fine-tiles';
import {
  HarborCruising,
  type HarborCruisingBoat,
  type HarborCruisingKind,
  type HarborWaterSample,
} from './harbor-cruising';
import { HarborPolygon, type HarborRing, harborRingArea } from './harbor-geometry';
import {
  type HarborAnchor,
  type HarborBoatKind,
  type HarborDock,
  type HarborDockLine,
  type HarborMooring,
  type HarborTileShapes,
  type HarborWater,
  harborDockWidth,
  placeHarborMoorings,
} from './harbor-moorings';

/** A boat type the harbors may draw: an ambient vessel type of the content packs. */
export interface EarthHarborBoatType {
  id: string;
  length: number;
  width: number;
  height?: number;
  /** Cruising speed, m/s. */
  cruise?: number;
  /** Ferries keep to their mapped routes and never moor here. */
  waterway?: 'ferry' | 'channel';
}

export interface EarthHarborsOptions {
  parent: THREE.Object3D;
  boats: readonly EarthHarborBoatType[];
  /** Hull paints of a type (its livery variants' body colors). */
  paints?: (type: string) => readonly string[];
  loadModel(type: string, signal?: AbortSignal): Promise<THREE.Object3D | undefined>;
  prepare?: (object: THREE.Object3D) => Promise<void> | void;
  /** The package's sea level, as the water layer draws it. */
  seaLevel?: number;
  waterFeatureStyle?: TerrainSemanticMeshOptions['waterFeatureStyle'];
}

/** Per-quality caps (see `earthPerformanceTier(level).ambient`). */
export interface EarthHarborBudget {
  /** Moored boats drawn at all (most as proxies). */
  mooredBoats?: number;
  /** Moored boats drawn as their model, the nearest first. */
  mooredBoatModels?: number;
  /** Boats under way at once. */
  cruisingBoats?: number;
}

export interface EarthHarborStats {
  /** Berths filled in the compiled tiles. */
  moorings: number;
  /** Moored boats drawn, and how many of them as models. */
  moored: number;
  models: number;
  cruising: number;
  tiles: number;
}

/** Tiles at most this size feed the harbors (or the finest level there is). */
const FINE_TILE = 1300;
/** Cells a side of a tile's clearance field. */
const GRID = 128;
/** Moored boats are drawn within this distance; models nearer than MODEL_NEAR. */
const MOORED_FAR = 1700;
const MODEL_NEAR = 320;
/** Boats under way use their model within this distance. */
const CRUISING_MODEL_NEAR = 700;
/** Main-thread time a frame gives to compiling tiles, ms. */
const COMPILE_MS = 1.5;
const ANCHOR_STEP = 250;
/** A dock wider than this (meters) is a fixed pier (harbor-moorings.ts uses the same). */
const COMMERCIAL_DOCK_WIDTH = 10;
const DEFAULT_BUDGET: Required<EarthHarborBudget> = {
  mooredBoats: 900,
  mooredBoatModels: 96,
  cruisingBoats: 8,
};
const WHITE = new THREE.Color(1, 1, 1);

interface HarborTile {
  object: THREE.Object3D;
  originX: number;
  originZ: number;
  size: number;
  moorings: HarborMooring[];
  /** Water surface height per cell (NaN off the water), and meters of open water. */
  heights?: Float32Array;
  clearance?: Float32Array;
  /** Decks of the docks mapped as outlines on the water, in tile-local meters. */
  decks?: THREE.BufferGeometry;
  deckMesh?: THREE.Mesh;
  ready: boolean;
}

interface Pending {
  tile: HarborTile;
  work: Generator<undefined, void, void>;
}

/** The parts of a boat model drawn as instances. */
interface ModelParts {
  rest?: THREE.BufferGeometry;
  paint?: THREE.BufferGeometry;
  sail?: THREE.BufferGeometry;
}

/** Whether a mapped water feature is open water boats use (not a pool or a fountain). */
function boatWater(cls: string | undefined): boolean {
  return !/pool|fountain|swimming|reflecting|spa|ditch|drain/.test(cls ?? '');
}

const MARINA = /^(marina|yacht_club|harbour|harbor)$/;
const BOATING =
  /^(boat_rental|boat|boat_sales|boat_storage|boat_repair|slipway|sailmaker|ship_chandler)$/;

/** Kinds that moor and kinds under way, from the content's ambient vessel types. */
export function earthHarborKinds(
  boats: readonly EarthHarborBoatType[],
  paints: (type: string) => readonly string[] = () => [],
): { moored: HarborBoatKind[]; cruising: HarborCruisingKind[] } {
  const moored: HarborBoatKind[] = [];
  const cruising: HarborCruisingKind[] = [];
  for (const boat of boats) {
    if (boat.waterway === 'ferry' || boat.length > 30) continue;
    const sails = (boat.height ?? 0) > boat.length * 0.8;
    const small = boat.length < 9;
    const big = boat.length >= 14;
    const colors = paints(boat.id);
    moored.push({
      id: boat.id,
      length: boat.length,
      width: boat.width,
      weights: big
        ? { marina: 0.04, private: 0, commercial: 1 }
        : {
            marina: sails ? 1.3 : small ? 0.9 : 0.55,
            private: sails ? 0.35 : small ? 1 : 0.3,
            commercial: sails ? 0.1 : small ? 0.2 : 0.8,
          },
      paints: colors,
    });
    cruising.push({
      id: boat.id,
      length: boat.length,
      width: boat.width,
      cruise: Math.max(2, Math.min(13, boat.cruise ?? 5)),
      turnRate: big ? 0.1 : sails ? 0.2 : small ? 0.4 : 0.16,
      clearance: Math.max(10, boat.length * 1.3),
      weight: big ? 0.15 : sails ? 0.9 : small ? 1 : 0.45,
      sails,
      planing: small && !sails,
      paints: colors,
    });
  }
  return { moored, cruising };
}

/** Tile ring `[u, v]` to world X/Z. */
function worldRing(ring: TerrainSemanticRing, ox: number, oz: number, size: number): HarborRing {
  let n = ring.length;
  const first = ring[0];
  const last = ring[n - 1];
  if (n > 1 && first && last && first[0] === last[0] && first[1] === last[1]) n--;
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = ring[i] as readonly [number, number];
    out[i * 2] = ox + p[0] * size;
    out[i * 2 + 1] = oz + p[1] * size;
  }
  return out;
}

export class EarthHarbors implements SemanticTileObserver {
  readonly object: THREE.Group = new THREE.Group();
  private readonly anchorGroup = new THREE.Group();
  private readonly tiles = new Map<THREE.Object3D, HarborTile>();
  private readonly pending: Pending[] = [];
  private readonly moored: HarborBoatKind[];
  private readonly cruisingKinds: HarborCruisingKind[];
  private readonly cruising: HarborCruising;
  private readonly sizes = new Map<string, { length: number; width: number; height: number }>();
  private readonly models = new Map<string, ModelParts | null>();
  private readonly proxies = new Map<string, THREE.BufferGeometry>();
  private readonly batches = new Map<string, Batch>();
  private readonly wakeMaterial: THREE.MeshBasicMaterial;
  private readonly wakeGeometry: THREE.BufferGeometry;
  private readonly anchor = new THREE.Vector3(Number.NaN, 0, Number.NaN);
  private budget: Required<EarthHarborBudget> = { ...DEFAULT_BUDGET };
  private enabled = true;
  private disposed = false;
  private time = 0;
  private selectIn = 0;
  private selectedAt: [number, number] = [Number.NaN, Number.NaN];
  private tilesChanged = true;
  /** Moorings drawn as models (bobbing every frame) and as proxies (written at selection). */
  private nearMoorings: HarborMooring[] = [];
  private farMoorings: HarborMooring[] = [];
  private lastTile: HarborTile | undefined;
  private readonly abort = new AbortController();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly color = new THREE.Color();
  private readonly drawn = { moored: 0, models: 0 };

  constructor(private readonly options: EarthHarborsOptions) {
    this.object.name = 'harbors';
    this.anchorGroup.name = 'harbors:anchor';
    this.object.add(this.anchorGroup);
    options.parent.add(this.object);
    const kinds = earthHarborKinds(options.boats, options.paints);
    this.moored = kinds.moored;
    this.cruisingKinds = kinds.cruising;
    this.cruising = new HarborCruising(this.cruisingKinds);
    for (const boat of options.boats)
      this.sizes.set(boat.id, {
        length: boat.length,
        width: boat.width,
        height: boat.height ?? Math.max(1.4, boat.length * 0.18),
      });
    this.wakeGeometry = wakeGeometry();
    this.wakeMaterial = new THREE.MeshBasicMaterial({
      map: wakeTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.wakeMaterial.name = 'harbor-wake';
  }

  /** Whether there is anything to moor or sail (no vessel types: the harbors stay empty). */
  get active(): boolean {
    return this.moored.length > 0 || this.cruisingKinds.length > 0;
  }

  // --- SemanticTileObserver ---
  added(
    object: THREE.Object3D,
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): void {
    if (this.disposed || !this.active || !isFineTile(context, FINE_TILE)) return;
    this.removed(object);
    const entry: HarborTile = {
      object,
      originX: context.origin[0],
      originZ: context.origin[1],
      size: context.tileSize,
      moorings: [],
      ready: false,
    };
    this.tiles.set(object, entry);
    this.pending.push({ tile: entry, work: this.compile(entry, tile, context) });
  }

  removed(object: THREE.Object3D): void {
    const entry = this.tiles.get(object);
    if (entry === undefined) return;
    this.tiles.delete(object);
    if (this.lastTile === entry) this.lastTile = undefined;
    const index = this.pending.findIndex((p) => p.tile === entry);
    if (index >= 0) this.pending.splice(index, 1);
    entry.deckMesh?.removeFromParent();
    entry.decks?.dispose();
    this.tilesChanged = true;
  }

  setBudget(budget: EarthHarborBudget): void {
    this.budget = {
      mooredBoats: budget.mooredBoats ?? DEFAULT_BUDGET.mooredBoats,
      mooredBoatModels: budget.mooredBoatModels ?? DEFAULT_BUDGET.mooredBoatModels,
      cruisingBoats: budget.cruisingBoats ?? DEFAULT_BUDGET.cruisingBoats,
    };
    this.tilesChanged = true;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.object.visible = enabled;
    if (!enabled) this.cruising.clear();
    this.tilesChanged = true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Water as the harbors know it at (x, z): undefined where no compiled tile covers it. */
  sample(x: number, z: number): HarborWaterSample | undefined {
    const tile = this.tileAt(x, z);
    if (tile === undefined) return undefined;
    if (tile.heights === undefined || tile.clearance === undefined)
      return { height: 0, clearance: 0 };
    const cell = tile.size / GRID;
    const i = Math.min(GRID - 1, Math.max(0, Math.floor((x - tile.originX) / cell)));
    const j = Math.min(GRID - 1, Math.max(0, Math.floor((z - tile.originZ) / cell)));
    const height = tile.heights[j * GRID + i] as number;
    if (Number.isNaN(height)) return { height: 0, clearance: 0 };
    return { height, clearance: tile.clearance[j * GRID + i] as number };
  }

  /** Whether a moored or cruising boat overlaps `box` (EarthVehicles `obstacles`). */
  blocks(box: OBB): boolean {
    if (!this.enabled) return false;
    const cx = box.center.x;
    const cz = box.center.z;
    const reach = Math.hypot(box.halfSize.x, box.halfSize.z) + 16;
    const test = (
      x: number,
      y: number,
      z: number,
      yaw: number,
      length: number,
      width: number,
      height: number,
    ): boolean => {
      if (Math.abs(x - cx) > reach || Math.abs(z - cz) > reach) return false;
      const other = new OBB(
        new THREE.Vector3(x, y + height / 2 - 0.4, z),
        new THREE.Vector3(width / 2, height / 2 + 0.4, length / 2),
        new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(yaw)),
      );
      return box.intersectsOBB(other);
    };
    for (const tile of this.tiles.values()) {
      if (
        cx < tile.originX - reach ||
        cz < tile.originZ - reach ||
        cx > tile.originX + tile.size + reach ||
        cz > tile.originZ + tile.size + reach
      )
        continue;
      for (const m of tile.moorings)
        if (test(m.x, m.y, m.z, m.yaw, m.length, m.width, Math.min(3, this.hullHeight(m.type))))
          return true;
    }
    for (const boat of this.cruising.boats)
      if (
        test(
          boat.x,
          boat.y,
          boat.z,
          boat.yaw,
          boat.kind.length,
          boat.kind.width,
          Math.min(3, this.hullHeight(boat.kind.id)),
        )
      )
        return true;
    return false;
  }

  update(dt: number, camera: readonly [number, number, number]): void {
    if (this.disposed) return;
    this.time += dt;
    this.compileSome();
    if (!this.enabled) return;
    this.cruising.step(dt, camera, (x, z) => this.sample(x, z), {
      count: this.budget.cruisingBoats,
      near: 220,
      far: 1500,
      keep: 2100,
    });
    let recenter = false;
    if (
      !Number.isFinite(this.anchor.x) ||
      Math.abs(camera[0] - this.anchor.x) > ANCHOR_STEP ||
      Math.abs(camera[2] - this.anchor.z) > ANCHOR_STEP
    ) {
      this.anchor.set(
        Math.round(camera[0] / ANCHOR_STEP) * ANCHOR_STEP,
        0,
        Math.round(camera[2] / ANCHOR_STEP) * ANCHOR_STEP,
      );
      this.anchorGroup.position.copy(this.anchor);
      recenter = true;
      for (const tile of this.tiles.values())
        tile.deckMesh?.position.set(tile.originX - this.anchor.x, 0, tile.originZ - this.anchor.z);
    }
    for (const tile of this.tiles.values()) if (tile.ready && tile.decks) this.showDecks(tile);
    this.selectIn -= dt;
    const moved = Math.hypot(camera[0] - this.selectedAt[0], camera[2] - this.selectedAt[1]);
    const reselect =
      recenter || this.tilesChanged || !(moved < 30) || (this.selectIn <= 0 && moved > 4);
    if (reselect) this.select(camera);
    this.draw(camera, reselect);
  }

  stats(): EarthHarborStats {
    let moorings = 0;
    for (const tile of this.tiles.values()) moorings += tile.moorings.length;
    return {
      moorings,
      moored: this.drawn.moored,
      models: this.drawn.models,
      cruising: this.cruising.boats.length,
      tiles: this.tiles.size,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.object.removeFromParent();
    for (const batch of this.batches.values()) batch.mesh.dispose();
    this.batches.clear();
    for (const parts of this.models.values())
      for (const geometry of [parts?.rest, parts?.paint, parts?.sail]) geometry?.dispose();
    for (const geometry of this.proxies.values()) geometry.dispose();
    for (const tile of this.tiles.values()) tile.decks?.dispose();
    this.wakeGeometry.dispose();
    this.wakeMaterial.map?.dispose();
    this.wakeMaterial.dispose();
    this.tiles.clear();
    this.pending.length = 0;
    this.cruising.clear();
  }

  // --- tiles ---

  private tileAt(x: number, z: number): HarborTile | undefined {
    const last = this.lastTile;
    const inside = (t: HarborTile): boolean =>
      x >= t.originX && z >= t.originZ && x < t.originX + t.size && z < t.originZ + t.size;
    let best: HarborTile | undefined;
    if (last?.ready && inside(last)) best = last;
    for (const tile of this.tiles.values())
      if (tile.ready && inside(tile) && (best === undefined || tile.size < best.size)) best = tile;
    this.lastTile = best;
    return best;
  }

  private compileSome(): void {
    if (this.pending.length === 0) return;
    const start = performance.now();
    while (this.pending.length > 0 && performance.now() - start < COMPILE_MS) {
      const job = this.pending[0] as Pending;
      if (job.work.next().done === true) {
        this.pending.shift();
        job.tile.ready = true;
        this.tilesChanged = true;
      }
    }
  }

  private *compile(
    entry: HarborTile,
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): Generator<undefined, void, void> {
    const ox = entry.originX;
    const oz = entry.originZ;
    const size = entry.size;
    const ring = (r: TerrainSemanticRing): HarborRing => worldRing(r, ox, oz, size);
    const water: HarborWater[] = [];
    for (const feature of tile.water) {
      if (!boatWater(feature.class)) continue;
      const style = this.options.waterFeatureStyle?.(feature);
      if (style?.hidePolygons) continue;
      for (const p of feature.polygons ?? []) {
        const outer = ring(p.outer);
        if (outer.length < 6 || Math.abs(harborRingArea(outer)) < 800) continue;
        water.push({
          polygon: new HarborPolygon([outer, ...(p.holes ?? []).map(ring)]),
          height: terrainWaterSurfaceHeight(
            p,
            context,
            0.65,
            this.options.seaLevel ?? 0,
            this.options.waterFeatureStyle?.(feature, { polygon: p, context })?.elevation,
          ),
        });
      }
    }
    // Most tiles are dry: known land, nothing to moor or steer by.
    if (water.length === 0) return;
    yield;
    const docks: HarborDock[] = [];
    for (const feature of tile.landcover) {
      if (feature.class !== 'pier' && feature.subclass !== 'pier') continue;
      for (const p of feature.polygons) {
        const outer = ring(p.outer);
        if (outer.length < 6) continue;
        docks.push({ polygon: new HarborPolygon([outer]), width: harborDockWidth(outer) });
      }
    }
    const dockLines: HarborDockLine[] = [];
    for (const road of tile.transportation) {
      if (road.subclass !== 'pier' && road.class !== 'pier') continue;
      const halfWidth = Math.max(0.8, Math.min(3, (road.width ?? 2.4) / 2));
      for (const line of road.lines)
        if (line.length >= 2) dockLines.push({ points: ring(line), halfWidth });
    }
    const inWater = (x: number, z: number): boolean => {
      for (const w of water) if (w.polygon.contains(x, z)) return true;
      return false;
    };
    const solids: HarborPolygon[] = [];
    let counted = 0;
    for (const building of tile.buildings) {
      if ((building.minHeight ?? 0) > 4) continue;
      for (const p of building.polygons) {
        const outer = ring(p.outer);
        let wet = false;
        for (let i = 0; i < outer.length && !wet; i += 2)
          wet = inWater(outer[i] as number, outer[i + 1] as number);
        if (wet) solids.push(new HarborPolygon([outer]));
      }
      if (++counted % 200 === 0) yield;
    }
    const anchors: HarborAnchor[] = [];
    for (const poi of tile.pois ?? []) {
      const cls = poi.class;
      const marina = MARINA.test(cls) || MARINA.test(poi.subclass ?? '');
      if (!marina && !BOATING.test(cls)) continue;
      anchors.push({
        x: ox + poi.point[0] * size,
        z: oz + poi.point[1] * size,
        radius: marina ? 450 : 160,
        occupancy: marina ? 0.85 : 0.55,
      });
    }
    const shapes: HarborTileShapes = {
      origin: [ox, oz],
      size,
      water,
      docks,
      dockLines,
      solids,
      anchors,
    };
    entry.moorings = yield* placeHarborMoorings(shapes, this.moored);
    yield* this.rasterize(entry, shapes);
    yield;
    entry.decks = dockDecks(docks, water, ox, oz);
  }

  /** Put a compiled tile's dock decks in the scene, once, when its shaders are built. */
  private showDecks(tile: HarborTile): void {
    if (tile.deckMesh !== undefined || tile.decks === undefined) return;
    const mesh = new THREE.Mesh(tile.decks, vehicleProxyMaterial);
    mesh.name = 'harbors:docks';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.walkIgnore = true;
    mesh.position.set(tile.originX - this.anchor.x, 0, tile.originZ - this.anchor.z);
    tile.deckMesh = mesh;
    const prepared = this.options.prepare?.(mesh);
    if (prepared === undefined) this.anchorGroup.add(mesh);
    else
      void Promise.resolve(prepared).finally(() => {
        if (this.tiles.get(tile.object) === tile && !this.disposed) this.anchorGroup.add(mesh);
      });
  }

  /** The tile's clearance field: water heights, then docks, buildings and berths as obstacles. */
  private *rasterize(
    entry: HarborTile,
    shapes: HarborTileShapes,
  ): Generator<undefined, void, void> {
    const cell = entry.size / GRID;
    const heights = new Float32Array(GRID * GRID).fill(Number.NaN);
    const crossings: number[] = [];
    const fill = (polygon: HarborPolygon, row: number, value: number, onlyUnset: boolean): void => {
      const z = entry.originZ + (row + 0.5) * cell;
      polygon.crossings(z, crossings);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const i0 = Math.max(0, Math.ceil(((crossings[k] as number) - entry.originX) / cell - 0.5));
        const i1 = Math.min(
          GRID - 1,
          Math.floor(((crossings[k + 1] as number) - entry.originX) / cell - 0.5),
        );
        for (let i = i0; i <= i1; i++) {
          const index = row * GRID + i;
          if (!onlyUnset || Number.isNaN(heights[index] as number)) heights[index] = value;
        }
      }
    };
    for (let row = 0; row < GRID; row++) {
      for (const w of shapes.water) fill(w.polygon, row, w.height, true);
      for (const d of shapes.docks) fill(d.polygon, row, Number.NaN, false);
      for (const s of shapes.solids) fill(s, row, Number.NaN, false);
      if (row % 32 === 31) yield;
    }
    const stamp = (x: number, z: number, radius: number): void => {
      const r = Math.ceil(radius / cell);
      const ci = Math.floor((x - entry.originX) / cell);
      const cj = Math.floor((z - entry.originZ) / cell);
      for (let j = cj - r; j <= cj + r; j++)
        for (let i = ci - r; i <= ci + r; i++)
          if (i >= 0 && j >= 0 && i < GRID && j < GRID) heights[j * GRID + i] = Number.NaN;
    };
    const trace = (p: HarborRing, radius: number, closed: boolean): void => {
      const n = p.length / 2;
      for (let k = closed ? 0 : 1; k < n; k++) {
        const a = (k === 0 ? n - 1 : k - 1) * 2;
        const ax = p[a] as number;
        const az = p[a + 1] as number;
        const bx = p[k * 2] as number;
        const bz = p[k * 2 + 1] as number;
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (cell * 0.5)));
        for (let s = 0; s <= steps; s++)
          stamp(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps, radius);
      }
    };
    for (const line of shapes.dockLines) trace(line.points, line.halfWidth, false);
    // A dock or a floating home narrower than a cell can fall between the rows' centers: their
    // outlines too, so a boat steering by the field never runs through one.
    for (const d of shapes.docks) for (const r of d.polygon.rings) trace(r, 0.5, true);
    for (const s of shapes.solids) for (const r of s.rings) trace(r, 0.5, true);
    for (const m of entry.moorings) {
      const fx = Math.sin(m.yaw);
      const fz = Math.cos(m.yaw);
      for (const t of [-0.35, 0, 0.35])
        stamp(m.x + fx * m.length * t, m.z + fz * m.length * t, m.width / 2);
    }
    yield;
    entry.heights = heights;
    entry.clearance = clearanceField(heights, cell);
  }

  // --- drawing ---

  private select(camera: readonly [number, number, number]): void {
    this.selectIn = 0.35;
    this.selectedAt = [camera[0], camera[2]];
    this.tilesChanged = false;
    const ready = [...this.tiles.values()].filter((t) => t.ready && t.moorings.length > 0);
    const near: { m: HarborMooring; d: number }[] = [];
    const far: { m: HarborMooring; d: number }[] = [];
    const far2 = MOORED_FAR * MOORED_FAR;
    for (const tile of ready) {
      const dx = Math.max(tile.originX - camera[0], 0, camera[0] - tile.originX - tile.size);
      const dz = Math.max(tile.originZ - camera[2], 0, camera[2] - tile.originZ - tile.size);
      if (dx * dx + dz * dz > far2) continue;
      // Where a finer tile is in, its berths stand in for this one's.
      const finer = ready.filter((t) => t.size < tile.size);
      for (const m of tile.moorings) {
        const d2 = (m.x - camera[0]) ** 2 + (m.z - camera[2]) ** 2;
        if (d2 > far2) continue;
        if (
          finer.some(
            (t) =>
              m.x >= t.originX &&
              m.z >= t.originZ &&
              m.x < t.originX + t.size &&
              m.z < t.originZ + t.size,
          )
        )
          continue;
        (d2 < MODEL_NEAR * MODEL_NEAR ? near : far).push({ m, d: d2 });
      }
    }
    near.sort((a, b) => a.d - b.d);
    const models = near.slice(0, this.budget.mooredBoatModels);
    for (const extra of near.slice(models.length)) far.push(extra);
    const room = Math.max(0, this.budget.mooredBoats - models.length);
    if (far.length > room) {
      far.sort((a, b) => a.d - b.d);
      far.length = room;
    }
    this.nearMoorings = models.map((e) => e.m);
    this.farMoorings = far.map((e) => e.m);
    for (const m of this.nearMoorings) void this.model(m.type);
  }

  private draw(camera: readonly [number, number, number], reselect: boolean): void {
    for (const [key, batch] of this.batches) if (reselect || !key.startsWith('far:')) batch.begin();
    let models = 0;
    for (const m of this.nearMoorings) {
      const t = this.time * 0.9 + m.phase * 17;
      const heave = Math.sin(t) * 0.05;
      const roll = Math.sin(t * 0.83 + 1.3) * 0.014;
      const pitch = Math.sin(t * 0.61 + 0.4) * 0.008;
      if (this.addModel(m.type, m.x, m.y + heave, m.z, m.yaw, pitch, roll, m.paint, false))
        models++;
      else this.addProxy('near', m.type, m.x, m.y, m.z, m.yaw, 0, 0, m.paint);
    }
    if (reselect)
      for (const m of this.farMoorings)
        this.addProxy('far', m.type, m.x, m.y, m.z, m.yaw, 0, 0, m.paint);
    for (const boat of this.cruising.boats) this.addCruising(boat, camera);
    for (const batch of this.batches.values()) batch.end();
    this.drawn.models = models;
    this.drawn.moored = this.nearMoorings.length + this.farMoorings.length;
  }

  private addCruising(boat: HarborCruisingBoat, camera: readonly [number, number, number]): void {
    const kind = boat.kind;
    const t = this.time * 1.1 + boat.phase * 23;
    const pace = Math.min(1, boat.speed / Math.max(0.1, kind.cruise));
    const pitch = (kind.planing ? -0.075 * pace : -0.012 * pace) + Math.sin(t * 0.7) * 0.01;
    const roll = kind.sails
      ? boat.tack * 0.13 * pace + Math.sin(t * 0.5) * 0.015
      : -Math.max(-0.2, Math.min(0.2, boat.turn * (kind.planing ? 0.5 : 0.15))) +
        Math.sin(t * 0.8) * 0.012;
    const heave = Math.sin(t) * 0.06 + (kind.planing ? 0.12 * pace : 0);
    const distance = Math.hypot(boat.x - camera[0], boat.z - camera[2]);
    const drawn =
      distance < CRUISING_MODEL_NEAR &&
      this.addModel(
        kind.id,
        boat.x,
        boat.y + heave,
        boat.z,
        boat.yaw,
        pitch,
        roll,
        boat.paint,
        true,
      );
    if (!drawn) {
      if (distance < CRUISING_MODEL_NEAR) void this.model(kind.id);
      this.addProxy('near', kind.id, boat.x, boat.y, boat.z, boat.yaw, pitch, roll, boat.paint);
    }
    if (boat.speed > 0.8 && distance < 2600) {
      // Foam spreading from the stern, longer and wider with speed.
      const length = Math.min(70, 6 + boat.speed * 4.5) * (kind.length > 14 ? 1.4 : 1);
      const spread = kind.width * (1.2 + pace * 1.6);
      const fx = Math.sin(boat.yaw);
      const fz = Math.cos(boat.yaw);
      const sx = boat.x - fx * kind.length * 0.45;
      const sz = boat.z - fz * kind.length * 0.45;
      this.euler.set(0, boat.yaw, 0);
      this.quaternion.setFromEuler(this.euler);
      this.position.set(sx - this.anchor.x, boat.y + 0.05, sz - this.anchor.z);
      this.scale.set(spread, 1, length);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.batch('wake', this.wakeGeometry, this.wakeMaterial).add(this.matrix, WHITE);
      this.scale.set(1, 1, 1);
    }
  }

  private compose(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    roll: number,
  ): THREE.Matrix4 {
    this.euler.set(pitch, yaw, roll);
    this.quaternion.setFromEuler(this.euler);
    this.position.set(x - this.anchor.x, y, z - this.anchor.z);
    return this.matrix.compose(this.position, this.quaternion, this.scale);
  }

  /** Draw a boat's model parts; false while the model is not loaded (or has none). */
  private addModel(
    type: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    roll: number,
    paint: string | undefined,
    sailing: boolean,
  ): boolean {
    const parts = this.models.get(type);
    if (parts === undefined || parts === null || parts.rest === undefined) return false;
    const matrix = this.compose(x, y, z, yaw, pitch, roll);
    this.batch(`model:${type}:rest`, parts.rest, vehicleProxyMaterial).add(matrix, WHITE);
    if (parts.paint !== undefined)
      this.batch(`model:${type}:paint`, parts.paint, vehicleProxyMaterial).add(
        matrix,
        paint !== undefined ? this.color.set(paint) : WHITE,
      );
    if (sailing && parts.sail !== undefined)
      this.batch(`model:${type}:sail`, parts.sail, vehicleProxyMaterial).add(matrix, WHITE);
    return true;
  }

  private addProxy(
    layer: 'near' | 'far',
    type: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    roll: number,
    paint: string | undefined,
  ): void {
    let geometry = this.proxies.get(type);
    if (geometry === undefined) {
      const size = this.sizes.get(type) ?? { length: 8, width: 2.8, height: 2 };
      geometry = proxyBoatGeometry(size.length, size.width, size.height);
      this.proxies.set(type, geometry);
    }
    this.batch(`${layer}:${type}:proxy`, geometry, vehicleProxyMaterial).add(
      this.compose(x, y, z, yaw, pitch, roll),
      paint !== undefined ? this.color.set(paint).lerp(WHITE, 0.55) : WHITE,
    );
  }

  private batch(key: string, geometry: THREE.BufferGeometry, material: THREE.Material): Batch {
    let batch = this.batches.get(key);
    if (batch === undefined) {
      batch = new Batch(key, geometry, material, this.anchorGroup, this.options.prepare);
      this.batches.set(key, batch);
      batch.begin();
    }
    return batch;
  }

  private hullHeight(type: string): number {
    const size = this.sizes.get(type);
    return size === undefined ? 2 : Math.min(size.height, Math.max(1.4, size.length * 0.2));
  }

  /** Load a type's model parts once (null when it has none). */
  private async model(type: string): Promise<void> {
    if (this.models.has(type)) return;
    this.models.set(type, null);
    try {
      const object = await this.options.loadModel(type, this.abort.signal);
      if (object === undefined || this.disposed) return;
      const parts = modelParts(object);
      if (this.disposed) {
        for (const geometry of [parts.rest, parts.paint, parts.sail]) geometry?.dispose();
        return;
      }
      this.models.set(type, parts);
    } catch {
      // No model: the boat stays a proxy.
    }
  }
}

/** One instanced batch, anchored with the rest; shown once its shaders are built. */
class Batch {
  mesh: InstanceBatch;
  private count = 0;
  private ready = true;
  /** Rewritten since the last upload (`begin` was called). */
  private dirty = false;
  private readonly matrixScratch = new THREE.Matrix4();

  constructor(
    private readonly key: string,
    private readonly geometry: THREE.BufferGeometry,
    private readonly material: THREE.Material,
    private readonly group: THREE.Group,
    private readonly prepare?: (object: THREE.Object3D) => Promise<void> | void,
  ) {
    this.mesh = this.create(32, true);
  }

  private create(capacity: number, first: boolean): InstanceBatch {
    const mesh = new InstanceBatch(this.geometry, this.material, capacity);
    mesh.name = `harbors:${this.key}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, WHITE);
    mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = !this.material.transparent;
    mesh.userData.walkIgnore = true;
    mesh.count = 0;
    this.group.add(mesh);
    const prepared = this.prepare?.(mesh);
    // A new batch waits for its shaders, as the ambient proxies do; a grown one shares them.
    if (prepared !== undefined && first) {
      this.ready = false;
      void Promise.resolve(prepared).finally(() => {
        this.ready = true;
      });
    }
    return mesh;
  }

  begin(): void {
    this.count = 0;
    this.dirty = true;
  }

  add(matrix: THREE.Matrix4, color: THREE.Color): void {
    if (this.count >= this.mesh.instanceMatrix.count) this.grow();
    this.mesh.setMatrixAt(this.count, matrix);
    this.mesh.setColorAt(this.count, color);
    this.count++;
  }

  end(): void {
    const mesh = this.mesh;
    mesh.visible = this.ready && this.count > 0;
    if (!this.dirty) return;
    this.dirty = false;
    mesh.count = this.count;
    if (this.count === 0) return;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, this.count * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) {
      mesh.instanceColor.clearUpdateRanges();
      mesh.instanceColor.addUpdateRange(0, this.count * 3);
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }

  private grow(): void {
    const previous = this.mesh;
    const next = this.create(previous.instanceMatrix.count * 2, false);
    const color = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      previous.getMatrixAt(i, this.matrixScratch);
      next.setMatrixAt(i, this.matrixScratch);
      previous.getColorAt(i, color);
      next.setColorAt(i, color);
    }
    previous.removeFromParent();
    previous.dispose();
    this.mesh = next;
  }
}

/**
 * Meters of open water at each cell: a two-pass chamfer distance to the nearest cell off the water
 * (NaN height). Cells past the tile's edge count as open; the neighbor's field covers them.
 */
export function clearanceField(heights: Float32Array, cell: number): Float32Array {
  const n = GRID;
  const big = 1e6;
  const d = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) d[i] = Number.isNaN(heights[i] as number) ? 0 : big;
  const diagonal = Math.SQRT2;
  const relax = (index: number, other: number, cost: number): void => {
    const v = (d[other] as number) + cost;
    if (v < (d[index] as number)) d[index] = v;
  };
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const index = j * n + i;
      if (d[index] === 0) continue;
      if (i > 0) relax(index, index - 1, 1);
      if (j > 0) {
        relax(index, index - n, 1);
        if (i > 0) relax(index, index - n - 1, diagonal);
        if (i < n - 1) relax(index, index - n + 1, diagonal);
      }
    }
  for (let j = n - 1; j >= 0; j--)
    for (let i = n - 1; i >= 0; i--) {
      const index = j * n + i;
      if (d[index] === 0) continue;
      if (i < n - 1) relax(index, index + 1, 1);
      if (j < n - 1) {
        relax(index, index + n, 1);
        if (i < n - 1) relax(index, index + n + 1, diagonal);
        if (i > 0) relax(index, index + n - 1, diagonal);
      }
    }
  for (let i = 0; i < n * n; i++) d[i] = Math.min(big, (d[i] as number) * cell);
  return d;
}

/**
 * A content boat model as instanced parts in model space: the hull, deck and fittings with their
 * materials' colors baked in (`rest`), the livery's paint in white for an instance color to tint
 * (`paint`), and the sails, shown only under way. The interior helm, close detail and lettering
 * are left off: they cost most of the triangles and are not seen from a dock or the air.
 */
export function modelParts(object: THREE.Object3D): ModelParts {
  object.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const rest: THREE.BufferGeometry[] = [];
  const paint: THREE.BufferGeometry[] = [];
  const sail: THREE.BufferGeometry[] = [];
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    let hull = false;
    for (let cursor: THREE.Object3D | null = mesh; cursor !== null; cursor = cursor.parent)
      if (cursor.name === 'body' || cursor.name.startsWith('body-')) hull = true;
    if (!hull) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
      | THREE.MeshStandardMaterial
      | undefined;
    if (material === undefined) return;
    const geometry =
      mesh.geometry.index !== null ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(geometry.attributes))
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
    // Content models are quantized (normalized 16-bit positions under a node scale): transformed
    // in place, the values would clamp to the unit cube. Read them out as floats first.
    for (const name of ['position', 'normal'])
      if (geometry.getAttribute(name) !== undefined)
        geometry.setAttribute(name, floatAttribute(geometry.getAttribute(name)));
    if (geometry.getAttribute('normal') === undefined) geometry.computeVertexNormals();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    const name = material.name ?? '';
    const painted = /vehicle-paint/.test(name);
    const color = painted ? WHITE.clone() : (material.color?.clone() ?? WHITE.clone());
    // Glazing drawn opaque: darker, as it reads against a bright hull.
    if (material.transparent) color.multiplyScalar(0.55);
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    (/sail-cloth/.test(name) ? sail : painted ? paint : rest).push(geometry);
  });
  const merge = (list: THREE.BufferGeometry[]): THREE.BufferGeometry | undefined => {
    if (list.length === 0) return undefined;
    const merged = mergeGeometries(list, false) ?? undefined;
    for (const geometry of list) geometry.dispose();
    merged?.computeBoundingSphere();
    return merged;
  };
  return {
    ...(rest.length > 0 ? { rest: merge(rest) } : {}),
    ...(paint.length > 0 ? { paint: merge(paint) } : {}),
    ...(sail.length > 0 ? { sail: merge(sail) } : {}),
  };
}

/** A three-component attribute as plain floats, normalized integers read as their values. */
function floatAttribute(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): THREE.BufferAttribute {
  const out = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i++) {
    out[i * 3] = attribute.getX(i);
    out[i * 3 + 1] = attribute.getY(i);
    out[i * 3 + 2] = attribute.getZ(i);
  }
  return new THREE.BufferAttribute(out, 3);
}

/** A floating dock's deck above the water, and a fixed pier's (wider than COMMERCIAL docks). */
const DOCK_FREEBOARD = 0.45;
const PIER_FREEBOARD = 1.8;
const DOCK_COLOR = new THREE.Color('#a79c8a');
const PIER_COLOR = new THREE.Color('#8f8b82');

/**
 * Decks for the docks a map draws as outlines on the water: Protomaps' `pier` land use lies on
 * the ground under the drawn water, so the docks of a marina such as Shilshole would otherwise be
 * invisible between its rows of boats. A deck stands at its water's surface plus a floating dock's
 * freeboard (a fixed pier's, for one wider than 10 m), with a skirt down into the water, in
 * tile-local meters from (`ox`, `oz`). Undefined when no dock lies on the water.
 */
export function dockDecks(
  docks: readonly HarborDock[],
  water: readonly HarborWater[],
  ox: number,
  oz: number,
): THREE.BufferGeometry | undefined {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const push = (x: number, y: number, z: number, n: THREE.Vector3, c: THREE.Color): void => {
    positions.push(x, y, z);
    normals.push(n.x, n.y, n.z);
    colors.push(c.r, c.g, c.b);
  };
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  for (const dock of docks) {
    const ring = dock.polygon.rings[0];
    if (ring === undefined || ring.length < 6) continue;
    const n = ring.length / 2;
    // Most of its corners on the water: a dock afloat, not a pier's landward end or a quay.
    let wet = 0;
    let level: number | undefined;
    for (let i = 0; i < n; i++)
      for (const w of water)
        if (w.polygon.contains(ring[i * 2] as number, ring[i * 2 + 1] as number)) {
          wet++;
          level ??= w.height;
          break;
        }
    if (level === undefined || wet < n * 0.6) continue;
    const pier = dock.width > COMMERCIAL_DOCK_WIDTH;
    const deck = level + (pier ? PIER_FREEBOARD : DOCK_FREEBOARD);
    const bottom = level - 0.3;
    const color = pier ? PIER_COLOR : DOCK_COLOR;
    const contour: THREE.Vector2[] = [];
    for (let i = 0; i < n; i++)
      contour.push(
        new THREE.Vector2((ring[i * 2] as number) - ox, (ring[i * 2 + 1] as number) - oz),
      );
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      // Counterclockwise in X/Y is clockwise seen from +Y once Y becomes Z: wind a, c, b to face up.
      for (const k of [a, c, b] as number[]) {
        const p = contour[k] as THREE.Vector2;
        push(p.x, deck, p.y, up, color);
      }
    }
    const shade = color.clone().multiplyScalar(0.8);
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i] as THREE.Vector2;
      const b = contour[(i + 1) % contour.length] as THREE.Vector2;
      const length = a.distanceTo(b);
      if (length < 1e-4) continue;
      // Counterclockwise in X/Y: the outside lies to the right, (dy, -dx).
      side.set((b.y - a.y) / length, 0, -(b.x - a.x) / length);
      // Wound to face outward: (B - A) x (down) points out of the deck.
      push(a.x, deck, a.y, side, shade);
      push(b.x, bottom, b.y, side, shade);
      push(a.x, bottom, a.y, side, shade);
      push(a.x, deck, a.y, side, shade);
      push(b.x, deck, b.y, side, shade);
      push(b.x, bottom, b.y, side, shade);
    }
  }
  if (positions.length === 0) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** A colored box (position, normal, color), flat shaded, bow +Z; `taper` narrows its +Z face. */
function box(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  l: number,
  color: string,
  taper = 1,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w, h, l).toNonIndexed();
  geometry.deleteAttribute('uv');
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++)
    if (position.getZ(i) > 0) position.setX(i, position.getX(i) * taper);
  geometry.translate(x, y, z);
  geometry.computeVertexNormals();
  const c = new THREE.Color(color);
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * A far boat: hull with a pointed bow, cabin with a band of glass, and a mast for a sailboat (a
 * type taller than it is long). About a hundred triangles. Waterline at y = 0.
 */
export function proxyBoatGeometry(
  length: number,
  width: number,
  height: number,
): THREE.BufferGeometry {
  const sails = height > length * 0.8;
  const freeboard = Math.min(2.4, Math.max(0.9, length * 0.11));
  const big = length >= 14;
  const hull = '#e6e4dc';
  const parts = [
    box(0, freeboard * 0.3, -length * 0.16, width, freeboard * 1.2, length * 0.68, hull),
    box(0, freeboard * 0.3, length * 0.34, width, freeboard * 1.2, length * 0.32, hull, 0.12),
    box(
      0,
      freeboard * (big ? 1.5 : 1.15),
      sails ? -length * 0.08 : -length * 0.05,
      width * 0.62,
      freeboard * (big ? 1.4 : 0.7),
      length * (sails ? 0.3 : 0.36),
      '#dedbd0',
    ),
    box(
      0,
      freeboard * (big ? 1.75 : 1.28),
      sails ? -length * 0.08 : -length * 0.05,
      width * 0.64,
      freeboard * (big ? 0.35 : 0.22),
      length * (sails ? 0.28 : 0.34),
      '#2b3943',
    ),
  ];
  if (sails) {
    parts.push(box(0, height / 2, length * 0.06, 0.16, height, 0.16, '#a4adb2'));
    parts.push(box(0, freeboard * 1.6, -length * 0.14, 0.12, 0.12, length * 0.4, '#a4adb2'));
  }
  const merged = mergeGeometries(parts, false) as THREE.BufferGeometry;
  for (const part of parts) part.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/** A wedge of foam on the water, stern at the origin, trailing one unit down -Z, one unit wide. */
function wakeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -0.5);
  // Narrow at the stern, full width at the far end.
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++)
    if (position.getZ(i) > -0.5) position.setX(i, position.getX(i) * 0.3);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Foam: bright along the two arms and behind the stern, fading toward the far end. */
function wakeTexture(): THREE.DataTexture {
  const w = 32;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w;
      // Texture v is 0 at the stern on the rotated plane; `v` here is 1 at the stern.
      const v = 1 - (j + 0.5) / h;
      const along = v ** 1.6;
      const arm = Math.exp(-(((Math.abs(u - 0.5) - 0.42) / 0.07) ** 2));
      const trail = Math.exp(-(((u - 0.5) / 0.16) ** 2)) * v ** 3;
      const k = (j * w + i) * 4;
      data[k] = 255;
      data[k + 1] = 255;
      data[k + 2] = 255;
      data[k + 3] = Math.round(255 * Math.min(1, along * (arm * 0.85 + trail * 0.9)));
    }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
