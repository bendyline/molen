/**
 * Ambient life in an Earth view: NPC cars, pedestrians, trains and aircraft on the streamed map.
 * Road data comes from the human-features tiles as the stream builds them (displayed tiles
 * only, one per sync so a busy tile never stalls a frame); agents live in
 * the vehicle world when there is one, so parked-car driving and audio see them.
 */

import {
  type AmbientRenderBudget,
  type AmbientRenderer,
  createAmbientRenderer,
} from '@bendyline/molen-ambient/client';
import {
  type AmbientBox,
  type AmbientHandle,
  type AmbientKind,
  type AmbientRoleData,
  type AmbientTypes,
  type AmbientVehicleType,
  installAmbient,
} from '@bendyline/molen-ambient/kernel';
import { World } from '@bendyline/molen-kernel/world';
import type { AircraftSpec, VehicleData } from '@bendyline/molen-schema';
import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/client';
import { renderedGroundSampler, terrainPyramidTileKey } from '@bendyline/molen-terrain/kernel';
import type * as THREE from 'three';
import type { OBB } from 'three/addons/math/OBB.js';
import type { SemanticTileObserver } from './ambient-tiles';

/** What `mountEarthView({ ambient })` accepts. */
export interface EarthAmbientSettings {
  /** 0..1 scale of how busy streets are (default 0.6). */
  density?: number;
  cars?: boolean;
  pedestrians?: boolean;
  rail?: boolean;
  aircraft?: boolean;
  drivingSide?: 'right' | 'left';
}

/** Per-quality-tier caps (see `earthPerformanceTier(level).ambient`). */
export interface EarthAmbientBudget {
  cars: number;
  pedestrians: number;
  trains: number;
  aircraft: number;
  detailedCars: number;
  skinnedFigures: number;
  figureRadius: number;
  activityRadius: number;
  posesPerFrame: number;
}

export interface EarthAmbientStats {
  cars: number;
  pedestrians: number;
  trains: number;
  aircraft: number;
  detailedCars: number;
  figures: number;
  tiles: number;
  lanes: number;
}

/** Content the ambient layer draws from (types and models from the entities pack). */
export interface EarthAmbientContent {
  types: Partial<AmbientTypes>;
  heights: Readonly<Record<string, number>>;
  vehicle(type: string): VehicleData | undefined;
  aircraft(type: string): AircraftSpec | undefined;
  loadModel(type: string): Promise<THREE.Object3D | undefined>;
}

export interface EarthAmbientOptions {
  /** A world to share (the Earth vehicles world); a private one is stepped otherwise. */
  world?: World;
  parent: THREE.Object3D;
  settings: EarthAmbientSettings;
  content?: EarthAmbientContent;
  prepare?: (object: THREE.Object3D) => Promise<void> | void;
  /** Ground height for aircraft altitudes (the stream's finest displayed heights). */
  ground?: (x: number, z: number) => number | undefined;
}

interface Entry {
  key: string;
  tile: TerrainSemanticTile;
  context: TerrainPyramidTileLayerContext;
  registered: boolean;
  /** When the object was first seen detached from the stream (for forgetting stale tiles). */
  detachedAt?: number;
}

const BASE_DENSITY = { car: 20, pedestrian: 40, train: 0.8 };

/** Whether two tiles' areas overlap (an ancestor and its descendant do). */
function overlaps(a: TerrainPyramidTileLayerContext, b: TerrainPyramidTileLayerContext): boolean {
  const eps = 0.01;
  return (
    a.origin[0] < b.origin[0] + b.tileSize - eps &&
    b.origin[0] < a.origin[0] + a.tileSize - eps &&
    a.origin[1] < b.origin[1] + b.tileSize - eps &&
    b.origin[1] < a.origin[1] + a.tileSize - eps
  );
}

/** Visible all the way up to `root` (a detached or hidden tile is not displayed). */
function displayed(object: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o !== null; o = o.parent) {
    if (!o.visible) return false;
    if (o === root) return true;
  }
  return false;
}

/** Distance from a point to a tile's square. */
function tileDistance(context: TerrainPyramidTileLayerContext, x: number, z: number): number {
  const dx = Math.max(context.origin[0] - x, 0, x - (context.origin[0] + context.tileSize));
  const dz = Math.max(context.origin[1] - z, 0, z - (context.origin[1] + context.tileSize));
  return Math.hypot(dx, dz);
}

/** A tile object detached this long (ms) without a dispose is forgotten. */
const DETACHED_MS = 30_000;

export class EarthAmbient implements SemanticTileObserver {
  readonly world: World;
  readonly handle: AmbientHandle;
  readonly renderer: AmbientRenderer;
  private readonly ownsWorld: boolean;
  private readonly root: THREE.Object3D;
  private readonly entries = new Map<THREE.Object3D, Entry>();
  private accumulator = 0;
  private lastSync = Number.NEGATIVE_INFINITY;
  private enabled = true;
  private budget: EarthAmbientBudget | undefined;
  private disposed = false;

  constructor(options: EarthAmbientOptions) {
    this.ownsWorld = options.world === undefined;
    this.root = options.parent;
    this.world = options.world ?? new World({ tickRate: 60, seed: 'earth-ambient' });
    const settings = options.settings;
    const density = Math.max(0, Math.min(1, settings.density ?? 0.6));
    const classes: AmbientKind[] = [];
    if (settings.cars !== false) classes.push('car');
    if (settings.pedestrians !== false) classes.push('pedestrian');
    if (settings.rail !== false) classes.push('train');
    if (settings.aircraft !== false) classes.push('aircraft');
    const ground = options.ground;
    this.handle = installAmbient(this.world, {
      traffic: settings.drivingSide ?? 'right',
      classes,
      ...(ground !== undefined ? { ground: (x: number, z: number) => ground(x, z) ?? 0 } : {}),
      ...(options.content !== undefined ? { types: options.content.types } : {}),
      policy: {
        car: { perLaneKm: BASE_DENSITY.car * density },
        pedestrian: { perLaneKm: BASE_DENSITY.pedestrian * density },
        train: { perLaneKm: BASE_DENSITY.train * density },
      },
      seed: 'earth-ambient',
    });
    const content = options.content;
    this.renderer = createAmbientRenderer({
      world: this.world,
      parent: options.parent,
      ...(options.prepare !== undefined ? { prepare: options.prepare } : {}),
      ...(content !== undefined
        ? {
            heights: content.heights,
            vehicles: {
              load: (type) => content.loadModel(type),
              vehicle: (type) => content.vehicle(type),
            },
            aircraft: {
              load: (type) => content.loadModel(type),
              aircraft: (type) => content.aircraft(type),
            },
          }
        : {}),
    });
  }

  // --- SemanticTileObserver ---
  added(
    object: THREE.Object3D,
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
  ): void {
    if (this.disposed) return;
    this.entries.set(object, {
      key: terrainPyramidTileKey(context.address),
      tile,
      context,
      registered: false,
    });
  }

  removed(object: THREE.Object3D): void {
    const entry = this.entries.get(object);
    if (entry === undefined) return;
    this.entries.delete(object);
    if (entry.registered) this.handle.unregisterTile(entry.key);
  }

  /**
   * A few times a second: drop hidden tiles, register one newly displayed tile (nearest first)
   * and move the observer.
   */
  sync(
    now: number,
    observer: {
      position: readonly [number, number, number];
      direction: readonly [number, number, number];
    },
    solids: readonly { x: number; z: number; radius: number }[] = [],
  ): void {
    if (this.disposed || now - this.lastSync < 200) return;
    this.lastSync = now;
    const [x, , z] = observer.position;
    // Roads only matter within reach of the spawn rings (the activity radius plus a margin).
    const reach = Math.max(600, this.budget?.activityRadius ?? 600) + 250;
    for (const [object, entry] of this.entries) {
      if (object.parent !== null) delete entry.detachedAt;
      else if (entry.detachedAt === undefined) entry.detachedAt = now;
      else if (now - entry.detachedAt > DETACHED_MS) {
        this.removed(object);
        continue;
      }
      // Hidden, detached or out-of-reach tiles leave first, so a parent/child LOD swap can
      // register its replacement.
      if (
        entry.registered &&
        (!this.enabled ||
          !displayed(object, this.root) ||
          tileDistance(entry.context, x, z) > reach * 1.5)
      ) {
        entry.registered = false;
        this.handle.unregisterTile(entry.key);
      }
    }
    // One new tile per call keeps a busy tile from stalling a frame. A tile overlapping one still
    // registered (its parent or child mid-transition) waits its turn.
    const registered = [...this.entries.values()].filter((e) => e.registered);
    let nearest: Entry | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const [object, entry] of this.entries) {
      if (entry.registered || !this.enabled || !displayed(object, this.root)) continue;
      const distance = tileDistance(entry.context, x, z);
      if (distance > reach || distance >= nearestDistance) continue;
      if (registered.some((other) => overlaps(other.context, entry.context))) continue;
      nearestDistance = distance;
      nearest = entry;
    }
    if (nearest !== undefined) {
      const { context, tile } = nearest;
      nearest.registered = true;
      this.handle.registerTile({
        key: nearest.key,
        origin: context.origin,
        tileSize: context.tileSize,
        features: tile.transportation,
        ...(tile.pois !== undefined ? { pois: tile.pois } : {}),
        heightAt: renderedGroundSampler(
          context.heightfield,
          context.origin,
          context.tileSize,
          context.surfaceResolution,
        ),
      });
    }
    const [dx, , dz] = observer.direction;
    const flat = Math.hypot(dx, dz);
    this.handle.setObserver({
      pos: observer.position,
      ...(flat > 1e-6 ? { forward: [dx / flat, dz / flat] as const } : {}),
    });
    this.handle.setSolids(solids);
  }

  /** Step a private world (a shared world is stepped by its owner). */
  update(dt: number): void {
    if (!this.ownsWorld || this.disposed) return;
    const step = 1 / this.world.tickRate;
    this.accumulator = Math.min(this.accumulator + dt, step * 6);
    while (this.accumulator >= step) {
      this.world.step();
      this.accumulator -= step;
    }
  }

  render(camera: readonly [number, number, number], dt: number): void {
    if (!this.disposed) this.renderer.update(camera, dt);
  }

  setBudget(budget: EarthAmbientBudget): void {
    this.budget = budget;
    this.applyBudget();
  }

  private applyBudget(): void {
    const b = this.budget;
    if (b === undefined) return;
    const on = this.enabled;
    this.handle.setBudget({
      cars: on ? b.cars : 0,
      pedestrians: on ? b.pedestrians : 0,
      trains: on ? b.trains : 0,
      aircraft: on ? b.aircraft : 0,
      radius: b.activityRadius,
      pedestrianRadius: b.figureRadius,
    });
    const render: Partial<AmbientRenderBudget> = {
      detailedCars: b.detailedCars,
      skinnedFigures: b.skinnedFigures,
      figureRadius: b.figureRadius,
      posesPerFrame: b.posesPerFrame,
    };
    this.renderer.setBudget(render);
  }

  /** Turn ambient life on or off without tearing anything down. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.renderer.setVisible(enabled);
    if (!enabled) this.handle.despawnAll();
    this.lastSync = Number.NEGATIVE_INFINITY;
    this.applyBudget();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Whether an ambient car or train overlaps a box (EarthVehicles `obstacles`). */
  blocks(box: OBB, except?: string): boolean {
    if (!this.enabled) return false;
    const e = box.rotation.elements;
    // Column 2 of the rotation is the box's +Z (forward) axis.
    const yaw = Math.atan2(e[6] ?? 0, e[8] ?? 1);
    const ambientBox: AmbientBox = {
      center: [box.center.x, box.center.y, box.center.z],
      halfSize: [box.halfSize.x, box.halfSize.y, box.halfSize.z],
      yaw,
    };
    return this.handle.blocks(ambientBox, except);
  }

  stats(): EarthAmbientStats {
    const s = this.renderer.stats();
    const network = this.handle.network.stats();
    return {
      cars: s.cars,
      pedestrians: s.pedestrians,
      trains: s.trains,
      aircraft: s.aircraft,
      detailedCars: s.detailedCars,
      figures: s.figures,
      tiles: network.tiles,
      lanes: network.lanes,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.dispose();
    this.handle.dispose();
    this.entries.clear();
  }
}

/** Ambient types and models from an entity type library (content packs). */
export function ambientContentFromTypes(
  types: {
    idsWith(component: string): string[];
    component<T>(id: string, component: string): T;
  },
  loadModel: (type: string) => Promise<THREE.Object3D | undefined>,
): EarthAmbientContent {
  const cars: AmbientVehicleType[] = [];
  const trains: AmbientVehicleType[] = [];
  const aircraft: AmbientVehicleType[] = [];
  const heights: Record<string, number> = {};
  const vehicles = new Set(types.idsWith('vehicle'));
  const planes = new Set(types.idsWith('aircraft'));
  const roleIds = new Set(types.idsWith('ambientRole'));
  const roleOf = (id: string): AmbientRoleData | undefined =>
    roleIds.has(id) ? types.component<AmbientRoleData>(id, 'ambientRole') : undefined;
  // Types without a vehicle or aircraft component animate from their role's visual bindings.
  const vehicleOf = (id: string): VehicleData | undefined => {
    if (vehicles.has(id)) return types.component<VehicleData>(id, 'vehicle');
    const role = roleOf(id);
    if (role === undefined || role.role === 'aircraft') return undefined;
    const visual = role.visual ?? {};
    return {
      kind: id,
      color: role.colors?.[0] ?? '#ffffff',
      spec: {
        length: role.length ?? 4.5,
        width: role.width ?? 1.8,
        height: role.height ?? 1.5,
        wheelRadius: visual.wheelRadius ?? 0.45,
        wheelbase: visual.wheelbase ?? (role.length ?? 4.5) * 0.55,
      },
      visual: {
        wheelNodes: visual.wheelNodes ?? [],
        frontWheelNodes: visual.frontWheelNodes ?? [],
        paintMaterial: visual.paintMaterial ?? '',
      },
    } as unknown as VehicleData;
  };
  const aircraftOf = (id: string): AircraftSpec | undefined => {
    if (planes.has(id)) return types.component<{ spec: AircraftSpec }>(id, 'aircraft').spec;
    const role = roleOf(id);
    if (role?.role !== 'aircraft') return undefined;
    return {
      visual: {
        rotors: (role.visual?.rotors ?? []).map((node) => ({ node, axis: 'z', multiplier: 1 })),
        gearNodes: role.visual?.gearNodes ?? [],
        flaps: [],
        ailerons: [],
      },
    } as unknown as AircraftSpec;
  };
  const ids = roleIds.size > 0 ? [...roleIds] : [...vehicles];
  for (const id of ids) {
    const role: AmbientRoleData = roleOf(id) ?? { role: 'car' };
    const spec = vehicles.has(id) ? types.component<VehicleData>(id, 'vehicle').spec : undefined;
    const length = role.length ?? spec?.length;
    const width = role.width ?? spec?.width;
    if (length === undefined || width === undefined) continue;
    const height = role.height ?? spec?.height;
    if (height !== undefined) heights[id] = height;
    const type: AmbientVehicleType = {
      id,
      length,
      width,
      ...(height !== undefined ? { height } : {}),
      ...(role.cruise !== undefined ? { cruise: role.cruise } : {}),
      ...(role.max !== undefined ? { max: role.max } : {}),
      weight: role.weight ?? (role.role === 'bus' ? 0.12 : 1),
      ...(role.cars !== undefined ? { cars: role.cars } : {}),
      ...(role.colors !== undefined ? { colors: role.colors } : {}),
    };
    if (role.role === 'car' || role.role === 'bus') cars.push(type);
    else if (role.role === 'rail') trains.push(type);
    else if (role.role === 'aircraft') aircraft.push(type);
  }
  return {
    types: {
      ...(cars.length > 0 ? { car: cars } : {}),
      ...(trains.length > 0 ? { train: trains } : {}),
      ...(aircraft.length > 0 ? { aircraft } : {}),
    },
    heights,
    vehicle: vehicleOf,
    aircraft: aircraftOf,
    loadModel,
  };
}
