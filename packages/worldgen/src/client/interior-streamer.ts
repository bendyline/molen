import * as THREE from 'three';
import { distancePointToRing, pointInPolygon } from '../kernel/geometry2d';
import { resolveInteriorProfile, validateInteriorCatalog } from '../kernel/interior-catalog';
import { generateInteriorGeometrySteps } from '../kernel/interior-geometry';
import { generateInteriorPlanSteps } from '../kernel/interior-plan';
import type {
  InteriorGenerateOptions,
  InteriorGeometry,
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
  bytes: number;
  failed: boolean;
  estimatedBytes?: number;
}
interface Region {
  root: THREE.Object3D;
  origin: Vec2;
  bounds: [number, number, number, number];
  height: [number, number];
  entries: Entry[];
  gates: THREE.Mesh;
  indices: Uint32Array;
}
interface Candidate {
  entry: Entry;
  distance: number;
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
  private readonly solids = createInteriorMaterialSet();
  private readonly glass = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    roughness: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private readonly cover = new THREE.MeshBasicMaterial({ color: 0x33434b, side: THREE.DoubleSide });
  private job: { entry: Entry; steps: Generator<void, InteriorGeometry, void> } | undefined;
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

  constructor(options: InteriorStreamingOptions = {}) {
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
    this.generation = {
      ...options,
      ...(options.catalog ? { catalog: validateInteriorCatalog(options.catalog) } : {}),
    };
  }

  register(root: THREE.Object3D, sites: readonly InteriorSite[], origin: Vec2 = [0, 0]): void {
    this.unregister(root);
    if (!sites.length) return;
    const builder = new MeshBufferBuilder();
    const region = {
      root,
      origin,
      entries: [],
      bounds: [Infinity, Infinity, -Infinity, -Infinity],
      height: [Infinity, -Infinity],
    } as unknown as Region;
    for (const site of sites) {
      const start = builder.triangleCount() * 3;
      for (const o of site.openings) {
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
      region.entries.push({
        site,
        region,
        range: [start, builder.triangleCount() * 3],
        bytes: 0,
        failed: false,
      });
      region.bounds[0] = Math.min(region.bounds[0], site.bounds[0] + origin[0]);
      region.bounds[1] = Math.min(region.bounds[1], site.bounds[1] + origin[1]);
      region.bounds[2] = Math.max(region.bounds[2], site.bounds[2] + origin[0]);
      region.bounds[3] = Math.max(region.bounds[3], site.bounds[3] + origin[1]);
      region.height[0] = Math.min(region.height[0], site.floor);
      region.height[1] = Math.max(region.height[1], site.storeys?.at(-1)?.ceiling ?? site.ceiling);
    }
    const buffers = builder.finalize();
    region.indices = buffers.indices.slice();
    region.gates = buffersToObject3D(
      buffers,
      { materialFor: () => this.cover },
      'worldgen:interior-portals',
    );
    region.gates.userData.walkDoubleSided = true;
    region.gates.castShadow = false;
    root.add(region.gates);
    this.regions.set(root, region);
    this.counters.sites += sites.length;
  }

  unregister(root: THREE.Object3D): void {
    const region = this.regions.get(root);
    if (!region) return;
    if (this.job?.entry.region === region) this.job = undefined;
    for (const entry of region.entries) this.evict(entry, false);
    region.gates.removeFromParent();
    disposeWorldgenObject(region.gates);
    this.regions.delete(root);
    this.counters.sites -= region.entries.length;
  }

  private gates(region: Region): void {
    const index = region.gates.geometry.index as THREE.BufferAttribute;
    let count = 0;
    for (const entry of region.entries) {
      if (entry.object) continue;
      const values = region.indices.subarray(entry.range[0], entry.range[1]);
      (index.array as Uint32Array).set(values, count);
      count += values.length;
    }
    index.needsUpdate = true;
    region.gates.geometry.setDrawRange(0, count);
  }
  private evict(entry: Entry, updateGates = true): void {
    if (!entry.object) return;
    entry.object.removeFromParent();
    disposeWorldgenObject(entry.object);
    delete entry.object;
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
    // Preempt a farther pending job if the camera approaches a different entrance.
    const next = wanted.find((c) => !c.entry.object)?.entry;
    if (next && this.job?.entry !== next)
      this.job = { entry: next, steps: this.generate(next.site) };
    try {
      const workStarted = performance.now();
      let steps = 0;
      while (this.job && steps++ < 64 && performance.now() - workStarted < o.frameBudgetMs) {
        const step = this.job.steps.next();
        if (!step.done) continue;
        const entry = this.job.entry,
          geometry = step.value;
        entry.estimatedBytes = geometry.bytes;
        this.job = undefined;
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
          mesh.castShadow = false;
          if (name === 'steps') mesh.userData.walkIgnore = true;
          if (name === 'collision') {
            mesh.layers.disableAll();
            mesh.userData.walkCollisionOnly = true;
          }
          if (name === 'glass') mesh.userData.walkDoubleSided = true;
          root.add(mesh);
        }
        entry.object = root;
        entry.bytes = geometry.bytes;
        entry.region.root.add(root);
        this.active.add(entry);
        this.counters.bytes += geometry.bytes;
        this.counters.generated++;
        this.gates(entry.region);
        break; // At most one upload per frame.
      }
    } catch (error) {
      if (this.job) this.job.entry.failed = true;
      this.job = undefined;
      this.counters.failed++;
      console.warn('[molen] interior generation:', error);
    }
    this.counters.lastWorkMs = performance.now() - started;
  }

  private *generate(site: InteriorSite): Generator<void, InteriorGeometry, void> {
    const plan = yield* generateInteriorPlanSteps(site, this.generation);
    yield;
    return yield* generateInteriorGeometrySteps(plan, this.generation.catalog);
  }
  stats(): InteriorStreamingStats {
    return { ...this.counters, resident: this.active.size, pending: this.job ? 1 : 0 };
  }
  dispose(): void {
    for (const root of this.regions.keys()) this.unregister(root);
    this.solids.dispose?.();
    this.glass.dispose();
    this.cover.dispose();
  }
}
