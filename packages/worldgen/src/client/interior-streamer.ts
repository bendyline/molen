import * as THREE from 'three';
import { distancePointToRing, pointInPolygon } from '../kernel/geometry2d';
import { resolveInteriorProfile, validateInteriorCatalog } from '../kernel/interior-catalog';
import {
  buildInteriorDoorFrame,
  buildInteriorDoorLeaf,
  type InteriorDoor,
  interiorDoors,
} from '../kernel/interior-doors';
import { generateInteriorGeometrySteps } from '../kernel/interior-geometry';
import { generateInteriorPlanSteps } from '../kernel/interior-plan';
import { interiorToLocal } from '../kernel/interior-site';
import type {
  InteriorGenerateOptions,
  InteriorGeometry,
  InteriorPlan,
  InteriorSite,
} from '../kernel/interior-types';
import { MeshBufferBuilder } from '../kernel/mesh-buffers';
import type { Vec2, Vec3 } from '../kernel/types';
import { createInteriorMaterialSet } from './interior-materials';
import { buffersToObject3D, disposeWorldgenObject } from './upload';

export interface InteriorStreamingOptions extends InteriorGenerateOptions {
  loadDistance?: number;
  unloadDistance?: number;
  maxResident?: number;
  maxBytes?: number;
  /** Cooperative main-thread budget; one indivisible geometry operation may exceed this. */
  frameBudgetMs?: number;
  /**
   * Builds a finished interior's shaders before it is shown (a renderer's `prepareObject`),
   * given the region root it will join; the entrance covers stay until it settles. Without it
   * the first frame drawing a new interior built its programs mid-frame, 100 ms or more each.
   */
  prepare?: (object: THREE.Object3D, signal: AbortSignal, parent: THREE.Object3D) => Promise<void>;
  /**
   * Dress an interior with host content, such as a car park's cars, as it is published. Objects
   * added to `group` are disposed with it. `origin` converts site coordinates to the host's.
   */
  furnish?: (plan: InteriorPlan, group: THREE.Group, origin: Vec2) => void;
  /** Clock for door swings, in milliseconds (default `performance.now`). */
  now?: () => number;
}
/** A door near a viewer: see {@link InteriorStreamer.doorAt}. */
export interface InteriorDoorState {
  /** `<building identity>#door<n>`; pass it to {@link InteriorStreamer.setDoor}. */
  id: string;
  /** Identity of the building it opens into. */
  identity: string;
  /** Middle of the threshold, at floor height, in the frame of the position asked about. */
  position: [number, number, number];
  /** Horizontal meters from the position asked about to the nearest point of the doorway. */
  distance: number;
  /** Open, or opening; false when closed or closing. */
  open: boolean;
  /** How far open: 0 shut, 1 fully open. */
  amount: number;
  /** Asked to open, and waiting for the rooms behind it to be built before it swings. */
  waiting: boolean;
  /** Its rooms could not be built, so it stays shut. */
  locked: boolean;
}
export interface InteriorDoorQuery {
  /** Horizontal meters from the position to the doorway (default 1.8). */
  reach?: number;
  /** The viewer's forward direction; a door behind or beside them is passed over. */
  facing?: readonly [number, number, number];
}
/** The lift a viewer is standing in. */
export interface InteriorElevatorStop {
  identity: string;
  /** Site storey the viewer is on. */
  level: number;
  /** Floor height of each storey the lift serves, in the same frame as the viewer. */
  floors: number[];
}
export interface InteriorStreamingStats {
  sites: number;
  resident: number;
  pending: number;
  bytes: number;
  generated: number;
  evicted: number;
  failed: number;
  lastWorkMs: number;
}
interface Entry {
  site: InteriorSite;
  region: Region;
  range: [number, number];
  object?: THREE.Group;
  /** Set while `object` is being prepared, before it joins the region. */
  preparing?: AbortController;
  bytes: number;
  failed: boolean;
  estimatedBytes?: number;
  /** The published plan, while it has lifts to answer for. */
  plan?: InteriorPlan;
  /** A storey a lift has been asked for, built before anyone is moved to it. */
  requested?: number;
  doors: DoorEntry[];
}
interface DoorEntry {
  door: InteriorDoor;
  entry: Entry;
  /** First vertex and vertex count of each leaf in the region's door mesh. */
  leaves: Array<[first: number, count: number]>;
  /** 0 shut to 1 open. */
  amount: number;
  target: 0 | 1;
  /** 1 swings into the building, -1 out of it: away from whoever opened it. */
  sense: 1 | -1;
}
interface Region {
  root: THREE.Object3D;
  origin: Vec2;
  bounds: [number, number, number, number];
  height: [number, number];
  entries: Entry[];
  /** Opaque stand-ins for unready windows; absent when the sites have none. */
  gates?: THREE.Mesh;
  indices: Uint32Array;
  /** Every door of the region in one mesh, with its leaves' closed vertices to swing them from. */
  doors?: { mesh: THREE.Mesh; positions: Float32Array; normals: Float32Array };
}
/** Seconds a door takes to swing fully open or shut. */
const DOOR_SWING_SECONDS = 0.7;
/** Default reach of {@link InteriorStreamer.doorAt}. */
const DOOR_REACH = 1.8;
interface Candidate {
  entry: Entry;
  distance: number;
}
function nearestStorey(site: InteriorSite, y: number): number {
  const storeys = site.storeys ?? [];
  let best = 0;
  for (const [level, storey] of storeys.entries())
    if (storey.floor <= y + 0.5 || level === 0) best = level;
  return best;
}
function visible(root: THREE.Object3D): boolean {
  if (!root.parent) return false;
  for (let object: THREE.Object3D | null = root; object; object = object.parent)
    if (!object.visible) return false;
  return true;
}

/** Metric coordinates throughout: floating-origin changes do not reshuffle seeds or residency.
 * Only descriptors and opaque portal covers exist at a distance. Layout/mesh work starts near
 * the camera, yields across frames, and publishes atomically before removing solid covers.
 */
export class InteriorStreamer {
  private readonly regions = new Map<THREE.Object3D, Region>();
  private readonly active = new Set<Entry>();
  private readonly options: Required<
    Pick<
      InteriorStreamingOptions,
      'loadDistance' | 'unloadDistance' | 'maxResident' | 'maxBytes' | 'frameBudgetMs'
    >
  >;
  private readonly generation: InteriorGenerateOptions;
  private readonly prepare: InteriorStreamingOptions['prepare'];
  private readonly solids = createInteriorMaterialSet();
  // Seen from a sunlit street, a pane is darker than the day outside: a smoky film that keeps the
  // room dim behind it and a near-mirror finish that picks up the sky. A pale film read as frost.
  private readonly glass = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0x4a5a64,
    transparent: true,
    opacity: 0.38,
    roughness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private readonly cover = new THREE.MeshBasicMaterial({ color: 0x33434b, side: THREE.DoubleSide });
  // Doors stand in the street's light like the walls round them, not in a room's dimmer share.
  private readonly door = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0,
  });
  /** Doors on their way open or shut, or waiting for their rooms. */
  private readonly swinging = new Set<DoorEntry>();
  private readonly now: () => number;
  private lastUpdate: number | undefined;
  private readonly furnish: InteriorStreamingOptions['furnish'];
  private job:
    | {
        entry: Entry;
        steps: Generator<void, InteriorGeometry, void>;
        plan?: InteriorPlan;
        focus: number;
      }
    | undefined;
  private readonly counters: InteriorStreamingStats = {
    sites: 0,
    resident: 0,
    pending: 0,
    bytes: 0,
    generated: 0,
    evicted: 0,
    failed: 0,
    lastWorkMs: 0,
  };

  constructor(options: InteriorStreamingOptions) {
    this.options = {
      loadDistance: options.loadDistance ?? 65,
      unloadDistance: options.unloadDistance ?? 90,
      maxResident: options.maxResident ?? 12,
      maxBytes: options.maxBytes ?? 16 * 1024 * 1024,
      frameBudgetMs: options.frameBudgetMs ?? 3,
    };
    const o = this.options;
    if (
      Object.values(o).some((v) => !Number.isFinite(v) || v <= 0) ||
      !Number.isInteger(o.maxResident) ||
      o.unloadDistance <= o.loadDistance
    )
      throw new RangeError(
        'Interior streaming needs positive finite budgets, an integer resident cap, and unloadDistance > loadDistance',
      );
    const { prepare, furnish, now, ...generation } = options;
    this.prepare = prepare;
    this.furnish = furnish;
    this.now = now ?? (() => performance.now());
    this.generation = { ...generation, catalog: validateInteriorCatalog(generation.catalog) };
  }

  register(root: THREE.Object3D, sites: readonly InteriorSite[], origin: Vec2 = [0, 0]): void {
    this.unregister(root);
    if (!sites.length) return;
    const builder = new MeshBufferBuilder();
    const doorBuilder = new MeshBufferBuilder();
    const region = {
      root,
      origin,
      entries: [],
      bounds: [Infinity, Infinity, -Infinity, -Infinity],
      height: [Infinity, -Infinity],
    } as unknown as Region;
    for (const site of sites) {
      const start = builder.triangleCount() * 3;
      const doors = interiorDoors(site, this.generation.catalog);
      // A doorway with a door needs no stand-in: the shut door is what closes it.
      const doorways = new Set(doors.map((door) => door.opening));
      for (const [index, o] of site.openings.entries()) {
        if (doorways.has(index)) continue;
        const a = site.outline[o.edge] as Vec2,
          b = site.outline[(o.edge + 1) % site.outline.length] as Vec2;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          dx = (b[0] - a[0]) / len,
          dz = (b[1] - a[1]) / len;
        const p = (s: number, y: number): Vec3 => [a[0] + dx * s, y, a[1] + dz * s];
        builder.addQuad(
          'window',
          'palette:#ffffff',
          [p(o.start, o.bottom), p(o.end, o.bottom), p(o.end, o.top), p(o.start, o.top)],
          [dz, 0, -dx],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          [1, 1, 1],
        );
      }
      for (const cover of site.covers ?? [])
        builder.addQuad(
          'window',
          'palette:#ffffff',
          cover as [Vec3, Vec3, Vec3, Vec3],
          [0, 1, 0],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          [1, 1, 1],
        );
      const entry: Entry = {
        site,
        region,
        range: [start, builder.triangleCount() * 3],
        bytes: 0,
        failed: false,
        doors: [],
      };
      for (const door of doors) {
        const leaves = door.leaves.map((_, leaf): [number, number] => {
          const first = doorBuilder.vertexCount();
          buildInteriorDoorLeaf(door, leaf, doorBuilder);
          return [first, doorBuilder.vertexCount() - first];
        });
        buildInteriorDoorFrame(door, doorBuilder);
        entry.doors.push({ door, entry, leaves, amount: 0, target: 0, sense: 1 });
      }
      region.entries.push(entry);
      region.bounds[0] = Math.min(region.bounds[0], site.bounds[0] + origin[0]);
      region.bounds[1] = Math.min(region.bounds[1], site.bounds[1] + origin[1]);
      region.bounds[2] = Math.max(region.bounds[2], site.bounds[2] + origin[0]);
      region.bounds[3] = Math.max(region.bounds[3], site.bounds[3] + origin[1]);
      region.height[0] = Math.min(region.height[0], site.floor);
      region.height[1] = Math.max(region.height[1], site.storeys?.at(-1)?.ceiling ?? site.ceiling);
    }
    const buffers = builder.finalize();
    region.indices = buffers.indices.slice();
    if (buffers.triangleCount > 0) {
      const gates = buffersToObject3D(
        buffers,
        { materialFor: () => this.cover },
        'worldgen:interior-portals',
      );
      gates.userData.walkDoubleSided = true;
      // Covers and interior structure block the sun like the walls around them; without them in
      // the shadow pass, sunlight crossed a building through every pair of windows in line and
      // patched its shadow with bright window shapes. Rooms change little: the shell already
      // shades them, and only sun that passed through an inner wall is stopped now.
      gates.castShadow = true;
      root.add(gates);
      region.gates = gates;
    }
    if (!doorBuilder.isEmpty()) {
      const doors = doorBuilder.finalize();
      // The mesh swings leaves in place; the closed copies are what each pose is turned from.
      const positions = doors.positions.slice(),
        normals = doors.normals.slice();
      const mesh = buffersToObject3D(doors, { materialFor: () => this.door }, 'worldgen:doors');
      // An open leaf reaches past the shut doors' bounds; keep it from being culled.
      if (mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius += 1.6;
      root.add(mesh);
      region.doors = { mesh, positions, normals };
    }
    this.regions.set(root, region);
    this.counters.sites += sites.length;
  }

  unregister(root: THREE.Object3D): void {
    const region = this.regions.get(root);
    if (!region) return;
    if (this.job?.entry.region === region) this.job = undefined;
    for (const entry of region.entries) {
      this.evict(entry, false);
      for (const door of entry.doors) this.swinging.delete(door);
    }
    for (const mesh of [region.gates, region.doors?.mesh]) {
      if (mesh === undefined) continue;
      mesh.removeFromParent();
      disposeWorldgenObject(mesh);
    }
    this.regions.delete(root);
    this.counters.sites -= region.entries.length;
  }

  private gates(region: Region): void {
    if (region.gates === undefined) return;
    const index = region.gates.geometry.index as THREE.BufferAttribute;
    let count = 0;
    for (const entry of region.entries) {
      if (entry.object && entry.preparing === undefined) continue;
      const values = region.indices.subarray(entry.range[0], entry.range[1]);
      (index.array as Uint32Array).set(values, count);
      count += values.length;
    }
    index.needsUpdate = true;
    region.gates.geometry.setDrawRange(0, count);
  }
  /** Release an interior. Its doors shut with it, unless it is a tower rebuilt in place. */
  private evict(entry: Entry, updateGates = true, keepDoors = false): void {
    if (!entry.object) return;
    if (!keepDoors) for (const door of entry.doors) this.shut(door);
    entry.preparing?.abort();
    delete entry.preparing;
    entry.object.removeFromParent();
    disposeWorldgenObject(entry.object);
    delete entry.object;
    delete entry.plan;
    this.counters.bytes -= entry.bytes;
    entry.bytes = 0;
    this.active.delete(entry);
    this.counters.evicted++;
    if (updateGates) this.gates(entry.region);
  }

  update(position: readonly [number, number, number]): void {
    if (!position.every(Number.isFinite)) return;
    const started = performance.now(),
      o = this.options;
    const clock = this.now();
    // A long stall (a hidden page) finishes a swing rather than snapping through several.
    const seconds = Math.min(0.1, Math.max(0, (clock - (this.lastUpdate ?? clock)) / 1000));
    this.lastUpdate = clock;
    const candidates: Candidate[] = [];
    for (const region of this.regions.values()) {
      const [x0, z0, x1, z1] = region.bounds;
      if (
        !visible(region.root) ||
        position[1] < region.height[0] - o.unloadDistance ||
        position[1] > region.height[1] + o.unloadDistance ||
        position[0] < x0 - o.unloadDistance ||
        position[0] > x1 + o.unloadDistance ||
        position[2] < z0 - o.unloadDistance ||
        position[2] > z1 + o.unloadDistance
      )
        continue;
      const p: Vec2 = [position[0] - region.origin[0], position[2] - region.origin[1]];
      for (const entry of region.entries) {
        const site = entry.site;
        const vertical = Math.max(
          site.floor - position[1],
          position[1] - (site.storeys?.at(-1)?.ceiling ?? site.ceiling),
          0,
        );
        if (vertical > o.unloadDistance) continue;
        const horizontal = pointInPolygon(p, site.outline, site.holes)
          ? 0
          : Math.min(...[site.outline, ...site.holes].map((r) => distancePointToRing(p, r)));
        const distance = Math.hypot(horizontal, vertical);
        if (distance <= (entry.object ? o.unloadDistance : o.loadDistance) && !entry.failed)
          candidates.push({ entry, distance });
      }
    }
    candidates.sort(
      (a, b) =>
        a.distance - b.distance || a.entry.site.identity.localeCompare(b.entry.site.identity),
    );
    const identities = new Set<string>();
    const wanted: Candidate[] = [];
    let reservedBytes = 0;
    for (const candidate of candidates) {
      if (identities.has(candidate.entry.site.identity)) continue;
      const estimated = candidate.entry.estimatedBytes ?? 0;
      if (reservedBytes + estimated > o.maxBytes) continue;
      reservedBytes += estimated;
      identities.add(candidate.entry.site.identity);
      wanted.push(candidate);
      if (wanted.length >= o.maxResident) break;
    }
    const keep = new Set(wanted.map((c) => c.entry));
    for (const entry of this.active) if (!keep.has(entry)) this.evict(entry);
    if (this.job && !keep.has(this.job.entry)) this.job = undefined;
    // A tower is built around whoever is in it: a floor a lift was asked for, or the one they
    // walked to. It keeps its old floors until the new ones replace them.
    const focusFor = (entry: Entry, distance: number): number | undefined => {
      const levels = entry.plan?.tower?.levels;
      if (levels === undefined) return undefined;
      const want =
        entry.requested ?? (distance < 1 ? nearestStorey(entry.site, position[1]) : undefined);
      return want !== undefined && !levels.includes(want) ? want : undefined;
    };
    // Preempt a farther pending job if the camera approaches a different entrance.
    let next = wanted.find((c) => !c.entry.object)?.entry;
    let focus = next ? nearestStorey(next.site, position[1]) : 0;
    if (!next)
      for (const candidate of wanted) {
        const want = focusFor(candidate.entry, candidate.distance);
        if (want === undefined) continue;
        next = candidate.entry;
        focus = want;
        break;
      }
    if (next && (this.job?.entry !== next || this.job.focus !== focus))
      this.job = { entry: next, steps: this.generate(next.site, focus), focus };
    try {
      const workStarted = performance.now();
      let steps = 0;
      while (this.job && steps++ < 64 && performance.now() - workStarted < o.frameBudgetMs) {
        const step = this.job.steps.next();
        if (!step.done) continue;
        const entry = this.job.entry,
          plan = this.job.plan,
          geometry = step.value;
        entry.estimatedBytes = geometry.bytes;
        this.job = undefined;
        // A resident tower rebuilt around another floor.
        const rebuilt = entry.object !== undefined;
        if (rebuilt) this.evict(entry, false, true);
        // Keep the nearest occupied interior even when more distant furnishings exhaust memory.
        for (const candidate of [...wanted].reverse()) {
          if (this.counters.bytes + geometry.bytes <= o.maxBytes) break;
          if (candidate.entry === entry) continue;
          if (candidate.distance <= (wanted.find((c) => c.entry === entry)?.distance ?? 0))
            continue;
          this.evict(candidate.entry);
        }
        if (geometry.bytes > o.maxBytes || this.counters.bytes + geometry.bytes > o.maxBytes) {
          if (geometry.bytes > o.maxBytes) {
            entry.failed = true;
            this.counters.failed++;
          }
          break;
        }
        const root = new THREE.Group();
        root.name = `worldgen:interior:${entry.site.identity}`;
        root.userData.interiorProfile = resolveInteriorProfile(
          entry.site.labels,
          this.generation.catalog,
        ).id;
        for (const [name, buffers] of [
          ['structure', geometry.structure],
          ['furniture', geometry.furniture],
          ['glass', geometry.glass],
          ['steps', geometry.steps],
          ['collision', geometry.collision],
        ] as const) {
          if (buffers.triangleCount === 0) continue;
          const mesh = buffersToObject3D(
            buffers,
            {
              materialFor: (slot, ref) =>
                name === 'glass' ? this.glass : this.solids.materialFor(slot, ref),
            },
            `${root.name}:${name}`,
          );
          mesh.castShadow = name === 'structure';
          if (name === 'steps') mesh.userData.walkIgnore = true;
          if (name === 'collision') {
            mesh.layers.disableAll();
            mesh.userData.walkCollisionOnly = true;
          }
          if (name === 'glass') mesh.userData.walkDoubleSided = true;
          root.add(mesh);
        }
        // A host that cannot dress an interior must not cost the walker the building.
        if (plan && this.furnish)
          try {
            this.furnish(plan, root, entry.region.origin);
          } catch (error) {
            console.warn('[molen] interior furnishing:', error);
          }
        entry.object = root;
        entry.bytes = geometry.bytes;
        this.active.add(entry);
        this.counters.bytes += geometry.bytes;
        this.counters.generated++;
        // A rebuilt tower swaps in the same frame its old floors left, since a viewer stands on
        // them, and draws with the materials its first build already prepared.
        if (this.prepare === undefined || rebuilt) this.publish(entry, plan);
        else {
          const preparing = new AbortController();
          entry.preparing = preparing;
          // A failed preparation still shows the interior; its shaders build when first drawn.
          void this.prepare(root, preparing.signal, entry.region.root)
            .catch(() => {})
            .then(() => {
              if (entry.preparing !== preparing) return;
              delete entry.preparing;
              this.publish(entry, plan);
            });
        }
        break; // At most one upload per frame.
      }
    } catch (error) {
      if (this.job) this.job.entry.failed = true;
      this.job = undefined;
      this.counters.failed++;
      console.warn('[molen] interior generation:', error);
    }
    this.swing(seconds, keep);
    this.counters.lastWorkMs = performance.now() - started;
  }

  /** Whether an interior is in the scene, so its door may open onto it. */
  private published(entry: Entry): boolean {
    return entry.object !== undefined && entry.preparing === undefined;
  }

  private swing(seconds: number, wanted: ReadonlySet<Entry>): void {
    for (const door of this.swinging) {
      const entry = door.entry;
      if (door.target === 1 && !this.published(entry)) {
        // Its rooms are still being built. Give up if they never will be, or not here.
        if (!entry.failed && wanted.has(entry)) continue;
        door.target = 0;
      }
      const step = seconds / DOOR_SWING_SECONDS;
      door.amount =
        door.target === 1 ? Math.min(1, door.amount + step) : Math.max(0, door.amount - step);
      this.pose(door);
      if (door.amount === door.target) this.swinging.delete(door);
    }
  }

  /** Shut a door at once, as its interior goes. */
  private shut(door: DoorEntry): void {
    this.swinging.delete(door);
    door.target = 0;
    if (door.amount === 0) return;
    door.amount = 0;
    this.pose(door);
  }

  /** Turn a door's leaves to its current opening, from their closed vertices. */
  private pose(door: DoorEntry): void {
    const doors = door.entry.region.doors;
    if (doors === undefined) return;
    const geometry = doors.mesh.geometry;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const p = position.array as Float32Array,
      n = normal.array as Float32Array;
    // Quick off the mark and settling as it opens: a walker who opens a door and walks straight
    // on stays clear of the leaf. An ease-in start let them catch it within the first step.
    const t = door.amount,
      eased = 1 - (1 - t) * (1 - t);
    for (const [index, leaf] of door.door.leaves.entries()) {
      const [first, count] = door.leaves[index] as [number, number];
      const angle = door.sense * (door.door.swing[index] ?? 0) * eased;
      const c = Math.cos(angle),
        s = Math.sin(angle);
      const [hx, , hz] = leaf.hinge;
      for (let v = first * 3, end = (first + count) * 3; v < end; v += 3) {
        const x = (doors.positions[v] as number) - hx,
          z = (doors.positions[v + 2] as number) - hz;
        p[v] = hx + x * c + z * s;
        p[v + 1] = doors.positions[v + 1] as number;
        p[v + 2] = hz - x * s + z * c;
        const nx = doors.normals[v] as number,
          nz = doors.normals[v + 2] as number;
        n[v] = nx * c + nz * s;
        n[v + 1] = doors.normals[v + 1] as number;
        n[v + 2] = -nx * s + nz * c;
      }
      position.addUpdateRange(first * 3, count * 3);
      normal.addUpdateRange(first * 3, count * 3);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
  }

  /**
   * The nearest door within `reach` of a viewer at `position` (eyes or feet, metric), in a shown
   * region, and in front of them when `facing` is given.
   */
  doorAt(
    position: readonly [number, number, number],
    query: InteriorDoorQuery = {},
  ): InteriorDoorState | undefined {
    if (!position.every(Number.isFinite)) return undefined;
    const reach = query.reach ?? DOOR_REACH;
    const facing = query.facing;
    const facingLength = facing ? Math.hypot(facing[0], facing[2]) : 0;
    let best: { door: DoorEntry; distance: number; origin: Vec2 } | undefined;
    for (const region of this.regions.values()) {
      const [x0, z0, x1, z1] = region.bounds;
      if (
        region.doors === undefined ||
        !visible(region.root) ||
        position[0] < x0 - reach ||
        position[0] > x1 + reach ||
        position[2] < z0 - reach ||
        position[2] > z1 + reach
      )
        continue;
      const px = position[0] - region.origin[0],
        pz = position[2] - region.origin[1];
      for (const entry of region.entries)
        for (const door of entry.doors) {
          const { center, along, width, height } = door.door;
          // Eyes or feet: from below the threshold to a little over the door's head.
          if (
            position[1] < center[1] - 1.2 ||
            position[1] > center[1] + Math.max(height, 1.9) + 0.6
          )
            continue;
          const dx = px - center[0],
            dz = pz - center[2];
          const s = Math.max(-width / 2, Math.min(width / 2, dx * along[0] + dz * along[1]));
          const tx = center[0] + along[0] * s - px,
            tz = center[2] + along[1] * s - pz;
          const distance = Math.hypot(tx, tz);
          if (distance > reach || (best && distance >= best.distance)) continue;
          // Standing in the doorway, any heading reaches it.
          if (
            facing &&
            facingLength > 0 &&
            distance > 0.45 &&
            (tx * facing[0] + tz * facing[2]) / (distance * facingLength) < 0.25
          )
            continue;
          best = { door, distance, origin: region.origin };
        }
    }
    if (best === undefined) return undefined;
    const { door, distance, origin } = best;
    const center = door.door.center;
    return {
      id: door.door.id,
      identity: door.entry.site.identity,
      position: [center[0] + origin[0], center[1], center[2] + origin[1]],
      distance,
      open: door.target === 1,
      amount: door.amount,
      waiting: door.target === 1 && !this.published(door.entry),
      locked: door.entry.failed,
    };
  }

  /**
   * Open or shut a door. It opens away from `from` (where the viewer stands; into the building
   * when omitted), and only onto rooms that are built: asked earlier, it waits for them. False
   * when no shown door has this id, when it is locked, or when shutting it would close it on
   * someone standing in the doorway at `from`.
   */
  setDoor(id: string, open: boolean, from?: readonly [number, number, number]): boolean {
    let done = false;
    for (const region of this.regions.values()) {
      if (region.doors === undefined || !visible(region.root)) continue;
      for (const entry of region.entries)
        for (const door of entry.doors) {
          if (door.door.id !== id) continue;
          const { center, along, inward, width } = door.door;
          const across = from
            ? (from[0] - region.origin[0] - center[0]) * inward[0] +
              (from[2] - region.origin[1] - center[2]) * inward[1]
            : -1;
          if (open) {
            if (entry.failed) continue;
            // A door already moving keeps its direction; reversing it mid-swing would jump.
            if (door.amount === 0) door.sense = across < 0 ? 1 : -1;
            door.target = 1;
          } else {
            const sideways = from
              ? (from[0] - region.origin[0] - center[0]) * along[0] +
                (from[2] - region.origin[1] - center[2]) * along[1]
              : Number.POSITIVE_INFINITY;
            if (Math.abs(sideways) < width / 2 + 0.2 && Math.abs(across) < 0.45) continue;
            door.target = 0;
          }
          if (door.amount !== door.target || door.target === 1) this.swinging.add(door);
          done = true;
        }
    }
    return done;
  }

  private publish(entry: Entry, plan: InteriorPlan | undefined): void {
    if (entry.object === undefined) return;
    entry.region.root.add(entry.object);
    // A tower's lifts answer once its floors are in the scene, not while they are being prepared:
    // a viewer moved to a storey before then would drop through a floor that is not shown yet.
    if (plan?.tower) {
      entry.plan = plan;
      if (entry.requested !== undefined && plan.tower.levels.includes(entry.requested))
        delete entry.requested;
    }
    this.gates(entry.region);
  }

  private *generate(site: InteriorSite, focus: number): Generator<void, InteriorGeometry, void> {
    const plan = yield* generateInteriorPlanSteps(site, { ...this.generation, focus });
    if (this.job) this.job.plan = plan;
    yield;
    return yield* generateInteriorGeometrySteps(plan, this.generation.catalog);
  }
  /** The lift at a metric position, if it is standing in one of a resident building. */
  /**
   * Whether `position` is down among registered buildings: over a region that has sites, and no
   * more than `margin` above or below the storeys they span. A camera cruising well above the
   * roofs is not; a walker, or anything hovering at street level, is.
   */
  among(position: readonly [number, number, number], margin = 25): boolean {
    for (const region of this.regions.values()) {
      const [x0, z0, x1, z1] = region.bounds;
      if (
        visible(region.root) &&
        position[0] >= x0 - margin &&
        position[0] <= x1 + margin &&
        position[2] >= z0 - margin &&
        position[2] <= z1 + margin &&
        position[1] >= region.height[0] - margin &&
        position[1] <= region.height[1] + margin
      )
        return true;
    }
    return false;
  }

  /** Whether `position` is inside a published interior: within its walls, between its floors. */
  occupied(position: readonly [number, number, number]): boolean {
    for (const region of this.regions.values()) {
      const p: Vec2 = [position[0] - region.origin[0], position[2] - region.origin[1]];
      for (const entry of region.entries) {
        if (!entry.object) continue;
        const site = entry.site;
        if (
          position[1] >= site.floor - 1 &&
          position[1] <= (site.storeys?.at(-1)?.ceiling ?? site.ceiling) + 1 &&
          pointInPolygon(p, site.outline, site.holes)
        )
          return true;
      }
    }
    return false;
  }

  elevatorAt(position: readonly [number, number, number]): InteriorElevatorStop | undefined {
    for (const entry of this.active) {
      const tower = entry.plan?.tower;
      const storeys = entry.site.storeys;
      if (!tower?.elevators.length || !storeys || storeys.length < 2) continue;
      const [x, z] = interiorToLocal(entry.site, [
        position[0] - entry.region.origin[0],
        position[2] - entry.region.origin[1],
      ]);
      const inside = tower.elevators.some(
        ({ bounds: [x0, z0, x1, z1] }) => x >= x0 && x <= x1 && z >= z0 && z <= z1,
      );
      const level = nearestStorey(entry.site, position[1]);
      if (inside)
        return {
          identity: entry.site.identity,
          level,
          floors: storeys.map((storey) => storey.floor),
        };
    }
    return undefined;
  }

  /**
   * Ask a resident tower for a storey. True once it is built and a viewer can be moved there;
   * until then keep asking, because moving first would drop them through a floor that is not yet.
   */
  requestStorey(identity: string, level: number): boolean {
    for (const entry of this.active) {
      if (entry.site.identity !== identity) continue;
      if (entry.plan?.tower?.levels.includes(level)) return true;
      entry.requested = level;
      return false;
    }
    return false;
  }

  stats(): InteriorStreamingStats {
    return { ...this.counters, resident: this.active.size, pending: this.job ? 1 : 0 };
  }
  dispose(): void {
    for (const root of this.regions.keys()) this.unregister(root);
    this.solids.dispose?.();
    this.glass.dispose();
    this.cover.dispose();
    this.door.dispose();
  }
}
