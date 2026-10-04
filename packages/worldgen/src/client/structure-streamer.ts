import type { AssetBounds, AssetRuntimeLod, AssetRuntimeLods } from '@bendyline/molen-schema';
import * as THREE from 'three';
import {
  type StructureAcquireOptions,
  type StructureInstanceOptions,
  type StructureModel,
  StructureModelLibrary,
  type StructureModelLibraryOptions,
  type StructureModelSource,
} from './structure-models';

export interface StructureStreamingBudget {
  maxCpuBytes: number;
  maxGpuBytes: number;
  /** Separate shared worldgen texture footprint estimate, including GPU mipmaps. */
  maxTextureBytes: number;
  /** Raw skyline bytes: conservative even when the host does not compress HTTP responses. */
  maxInitialBytes: number;
  maxTriangles: number;
  maxDrawCalls: number;
  concurrency: number;
  frameBudgetMs: number;
  keepAliveMs: number;
  upgradeDelayMs: number;
}

export function structureStreamingBudget(mobile: boolean): StructureStreamingBudget {
  return {
    maxCpuBytes: mobile ? 64_000_000 : 192_000_000,
    maxGpuBytes: mobile ? 64_000_000 : 192_000_000,
    maxTextureBytes: mobile ? 16_000_000 : 48_000_000,
    maxInitialBytes: mobile ? 3_000_000 : 6_000_000,
    maxTriangles: mobile ? 350_000 : 1_000_000,
    maxDrawCalls: mobile ? 100 : 200,
    concurrency: mobile ? 2 : 4,
    frameBudgetMs: mobile ? 2 : 4,
    keepAliveMs: 5000,
    upgradeDelayMs: 1000,
  };
}

export interface StructureLodManifest {
  bounds: AssetBounds;
  runtimeLods: AssetRuntimeLods;
}
export interface StructureStreamingView {
  position: readonly [number, number, number];
  direction?: readonly [number, number, number];
  /** Degrees. */
  verticalFov: number;
  viewportHeight: number;
  maxPixelError?: number;
}
export interface StructureStreamingOptions extends StructureModelLibraryOptions {
  mobile?: boolean;
  budget?: Partial<StructureStreamingBudget>;
  /** Prepare replacement GPU resources before publishing; old instances remain visible. */
  prepareObject?: (
    object: THREE.Object3D,
    signal: AbortSignal,
    parent: THREE.Object3D,
  ) => Promise<void>;
  clock?: () => number;
}
export interface StructureStreamingStats {
  assets: number;
  loading: number;
  queued: number;
  cpuBytes: number;
  gpuBytes: number;
  reservedCpuBytes: number;
  reservedGpuBytes: number;
  skylineBytes: number;
  sharedTextureBytes?: number;
  triangles: number;
  drawCalls: number;
  upgrades: number;
  evicted: number;
  failed: number;
  levels: Record<string, number>;
}
interface Ready {
  model: StructureModel;
  level: number;
  key: string;
}
interface Instance {
  root: THREE.Group;
  options: StructureInstanceOptions;
  child: THREE.Object3D;
}
interface Slot {
  ref: string;
  refs: number;
  manifest?: StructureLodManifest;
  handle?: StructureModel;
  initial?: Promise<StructureModel>;
  ready: Map<number, Ready>;
  instances: Set<Instance>;
  current: number;
  desired: number;
  lastUsed: number;
  retryAt: number;
  job?: Job;
  publication?: AbortController;
  hint?: readonly [number, number, number];
}
interface Job {
  slot: Slot;
  level: number;
  controller: AbortController;
  resolve: (ready: Ready) => void;
  reject: (error: unknown) => void;
  started: boolean;
}
const aborted = () => new DOMException('Landmark request cancelled', 'AbortError');

function disposeInstance(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.InstancedMesh;
    if (mesh.isInstancedMesh) mesh.dispose();
    if (mesh.isMesh && mesh.userData.worldgenOwnedGeometry === true) mesh.geometry.dispose();
  });
}

/** Geometry accounting matches Three's actual upload keys, including mixed-type interleaving. */
export function structureGeometryBytes(roots: Iterable<THREE.Object3D>): {
  cpuBytes: number;
  gpuBytes: number;
} {
  const cpu = new Set<ArrayBufferLike>();
  const gpu = new Set<THREE.BufferAttribute | THREE.InterleavedBuffer>();
  const add = (
    attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null,
  ): void => {
    if (!attribute) return;
    const data = 'isInterleavedBufferAttribute' in attribute ? attribute.data : attribute;
    cpu.add(data.array.buffer);
    gpu.add(data);
  };
  for (const root of roots)
    root.traverse((object) => {
      const mesh = object as THREE.InstancedMesh;
      if (!mesh.isMesh) return;
      for (const attribute of Object.values(mesh.geometry.attributes)) add(attribute);
      add(mesh.geometry.index);
      if (mesh.isInstancedMesh) {
        add(mesh.instanceMatrix);
        add(mesh.instanceColor);
      }
    });
  return {
    cpuBytes: [...cpu].reduce((sum, buffer) => sum + buffer.byteLength, 0),
    gpuBytes: [...gpu].reduce((sum, attribute) => sum + attribute.array.byteLength, 0),
  };
}

/** Source-derived landmarks: skyline first, bounded residency, stable instances during upgrades. */
export class StructureLodStreamer implements StructureModelSource {
  readonly budget: StructureStreamingBudget;
  private readonly library: StructureModelLibrary;
  private readonly slots = new Map<string, Slot>();
  private readonly requests = new Map<string, Job>();
  private readonly queue: Job[] = [];
  private readonly publications: Array<{ slot: Slot; ready: Ready }> = [];
  private readonly clock: () => number;
  private view: StructureStreamingView = {
    position: [0, 0, 0],
    verticalFov: 45,
    viewportHeight: 900,
  };
  private running = 0;
  private disposed = false;
  private measured = { cpuBytes: 0, gpuBytes: 0 };
  private upgrades = 0;
  private evicted = 0;
  private failed = 0;
  private publishing = false;
  private requestId = 0;
  private lastSkylineReady = -Infinity;

  constructor(
    private readonly manifest: (ref: string) => Promise<StructureLodManifest>,
    load: (ref: string, level: AssetRuntimeLod, signal: AbortSignal) => Promise<THREE.Object3D>,
    private readonly options: StructureStreamingOptions = {},
  ) {
    const nav =
      typeof navigator === 'undefined'
        ? undefined
        : (navigator as Navigator & { deviceMemory?: number });
    this.budget = {
      ...structureStreamingBudget(
        options.mobile ?? ((nav?.maxTouchPoints ?? 0) > 0 || (nav?.deviceMemory ?? 8) <= 4),
      ),
      ...options.budget,
    };
    for (const [key, value] of Object.entries(this.budget))
      if (!Number.isFinite(value) || value <= 0)
        throw new Error(`Invalid structure streaming budget ${key}`);
    if (!Number.isInteger(this.budget.concurrency))
      throw new Error('Landmark concurrency must be an integer');
    this.clock = options.clock ?? (() => performance.now());
    this.library = new StructureModelLibrary(async (key) => {
      const job = this.requests.get(key);
      if (!job) throw new Error('Missing landmark load request');
      return load(job.slot.ref, this.level(job.slot, job.level), job.controller.signal);
    }, options);
  }

  private level(slot: Slot, index: number): AssetRuntimeLod {
    const level = slot.manifest?.runtimeLods.levels[index];
    if (!level) throw new Error(`Missing LOD ${index}: ${slot.ref}`);
    return level;
  }

  private roots(): THREE.Object3D[] {
    const roots: THREE.Object3D[] = [];
    for (const slot of this.slots.values()) {
      for (const ready of slot.ready.values()) roots.push(ready.model.scene);
      for (const instance of slot.instances) roots.push(instance.root);
    }
    return roots;
  }

  private remeasure(): void {
    this.measured = structureGeometryBytes(this.roots());
  }

  private distance(slot: Slot): number {
    let distance = Infinity;
    const points = [...slot.instances].map((instance) => instance.options.position ?? slot.hint);
    if (!points.length) points.push(slot.hint);
    for (const point of points)
      if (point)
        distance = Math.min(
          distance,
          Math.hypot(...point.map((value, axis) => value - (this.view.position[axis] ?? 0))),
        );
    return distance === Infinity ? 0 : distance;
  }

  private reservations(): { cpuBytes: number; gpuBytes: number; skylineBytes: number } {
    let cpuBytes = 0,
      gpuBytes = 0,
      skylineBytes = 0;
    for (const slot of this.slots.values()) {
      if (slot.ready.has(0)) skylineBytes += this.level(slot, 0).bytes;
      if (slot.job?.started) {
        const level = this.level(slot, slot.job.level);
        cpuBytes += level.cpuBytes;
        gpuBytes += level.gpuBytes;
        if (slot.job.level === 0) skylineBytes += level.bytes;
      }
    }
    return { cpuBytes, gpuBytes, skylineBytes };
  }

  private fits(slot: Slot, level: number): boolean {
    const cost = this.level(slot, level),
      reserved = this.reservations();
    return (
      this.measured.cpuBytes + reserved.cpuBytes + cost.cpuBytes <= this.budget.maxCpuBytes &&
      this.measured.gpuBytes + reserved.gpuBytes + cost.gpuBytes <= this.budget.maxGpuBytes &&
      (level !== 0 || reserved.skylineBytes + cost.bytes <= this.budget.maxInitialBytes)
    );
  }

  private evict(slot: Slot): void {
    slot.job?.controller.abort();
    slot.publication?.abort();
    for (const instance of slot.instances) {
      disposeInstance(instance.child);
      instance.root.clear();
    }
    slot.instances.clear();
    for (const ready of slot.ready.values()) this.library.release(ready.key);
    slot.ready.clear();
    this.slots.delete(slot.ref);
    this.evicted++;
    this.remeasure();
  }

  private pump(): void {
    if (this.disposed) return;
    this.queue.sort(
      (a, b) =>
        (a.level === 0 ? 0 : 1) - (b.level === 0 ? 0 : 1) ||
        this.distance(a.slot) - this.distance(b.slot),
    );
    while (this.running < this.budget.concurrency && this.queue.length) {
      const job = this.queue.shift() as Job;
      const { slot, level } = job;
      if (!slot.refs || job.controller.signal.aborted || slot.job !== job) {
        if (slot.job === job) delete slot.job;
        job.reject(aborted());
        continue;
      }
      for (const idle of [...this.slots.values()]
        .filter((value) => value.refs === 0)
        .sort((a, b) => a.lastUsed - b.lastUsed)) {
        if (this.fits(slot, level)) break;
        this.evict(idle);
      }
      if (!this.fits(slot, level)) {
        delete slot.job;
        job.reject(new Error('Landmark residency budget exhausted'));
        continue;
      }
      job.started = true;
      this.running++;
      const key = JSON.stringify([slot.ref, this.level(slot, level).hash, ++this.requestId]);
      this.requests.set(key, job);
      void this.library
        .acquire(key)
        .then(
          (model) => {
            if (
              this.disposed ||
              !slot.refs ||
              job.controller.signal.aborted ||
              this.slots.get(slot.ref) !== slot
            ) {
              this.library.release(key);
              throw aborted();
            }
            const ready = { model, key, level };
            slot.ready.set(level, ready);
            if (level === 0) this.lastSkylineReady = this.clock();
            this.remeasure();
            if (
              this.measured.cpuBytes > this.budget.maxCpuBytes ||
              this.measured.gpuBytes > this.budget.maxGpuBytes
            ) {
              slot.ready.delete(level);
              this.library.release(key);
              this.remeasure();
              throw new Error('Landmark decoded geometry exceeds budget');
            }
            job.resolve(ready);
          },
          (error: unknown) => {
            throw error;
          },
        )
        .catch(job.reject)
        .finally(() => {
          if (slot.job === job) delete slot.job;
          this.requests.delete(key);
          this.running--;
          this.pump();
        });
    }
  }

  private request(slot: Slot, level: number): Promise<Ready> {
    const ready = slot.ready.get(level);
    if (ready) return Promise.resolve(ready);
    slot.job?.controller.abort();
    return new Promise((resolve, reject) => {
      const job: Job = {
        slot,
        level,
        controller: new AbortController(),
        resolve,
        reject,
        started: false,
      };
      slot.job = job;
      this.queue.push(job);
      queueMicrotask(() => this.pump());
    });
  }

  async acquire(ref: string, options: StructureAcquireOptions = {}): Promise<StructureModel> {
    if (this.disposed || options.signal?.aborted) throw aborted();
    let slot = this.slots.get(ref);
    if (!slot) {
      slot = {
        ref,
        refs: 0,
        ready: new Map(),
        instances: new Set(),
        current: 0,
        desired: 0,
        lastUsed: this.clock(),
        retryAt: 0,
        ...(options.position ? { hint: options.position } : {}),
      };
      this.slots.set(ref, slot);
    }
    const entry = slot;
    entry.refs++;
    entry.lastUsed = this.clock();
    entry.initial ??= (async () => {
      const manifest = await this.manifest(ref);
      if (!entry.refs || this.disposed || this.slots.get(ref) !== entry) throw aborted();
      if (
        manifest.runtimeLods.levels.length !== 4 ||
        manifest.runtimeLods.levels.some(
          (level, i) =>
            level.name !== ['skyline', 'district', 'street', 'closeup'][i] ||
            ![level.bytes, level.cpuBytes, level.gpuBytes, level.triangles, level.drawCalls].every(
              (value) => Number.isFinite(value) && value > 0,
            ) ||
            !Number.isFinite(level.errorMeters) ||
            level.errorMeters < 0,
        )
      )
        throw new Error(`Invalid landmark LOD manifest: ${ref}`);
      entry.manifest = manifest;
      await this.request(entry, 0);
      const handle = {
        ref,
        scene: new THREE.Group(),
        bounds: new THREE.Box3(
          new THREE.Vector3(...manifest.bounds.aabb.min),
          new THREE.Vector3(...manifest.bounds.aabb.max),
        ),
      };
      entry.handle = handle;
      return handle;
    })();
    let onAbort: (() => void) | undefined;
    try {
      return await (options.signal
        ? Promise.race([
            entry.initial,
            new Promise<never>((_, reject) => {
              onAbort = () => reject(aborted());
              options.signal?.addEventListener('abort', onAbort, { once: true });
            }),
          ])
        : entry.initial);
    } catch (error) {
      if (this.slots.get(ref) === entry) this.release(ref);
      throw error;
    } finally {
      if (onAbort) options.signal?.removeEventListener('abort', onAbort);
    }
  }

  private child(ready: Ready, options: StructureInstanceOptions): THREE.Object3D {
    return this.library.instantiate(ready.model, options);
  }

  instantiate(handle: StructureModel, options: StructureInstanceOptions = {}): THREE.Object3D {
    const slot = this.slots.get(handle.ref);
    if (this.disposed || slot?.handle !== handle || !slot.refs)
      throw new Error('Landmark is not acquired');
    const ready = slot.ready.get(slot.current);
    if (!ready) throw new Error('Landmark has no resident representation');
    const root = new THREE.Group();
    const instance = { root, options, child: this.child(ready, options) };
    root.add(instance.child);
    root.userData.landmarkLod = this.level(slot, slot.current).name;
    slot.instances.add(instance);
    this.remeasure();
    const totals = this.stats();
    if (
      this.measured.cpuBytes > this.budget.maxCpuBytes ||
      this.measured.gpuBytes > this.budget.maxGpuBytes ||
      totals.triangles * 2 > this.budget.maxTriangles ||
      totals.drawCalls * 2 > this.budget.maxDrawCalls
    ) {
      slot.instances.delete(instance);
      disposeInstance(instance.child);
      this.remeasure();
      throw new Error('Landmark placement geometry exceeds budget');
    }
    root.userData.disposeTerrainSurfaces = (): void => {
      if (!slot.instances.delete(instance)) return;
      disposeInstance(instance.child);
      root.clear();
      this.remeasure();
    };
    return root;
  }

  release(ref: string): void {
    const slot = this.slots.get(ref);
    if (!slot?.refs) return;
    slot.refs--;
    if (!slot.refs) {
      slot.lastUsed = this.clock();
      slot.job?.controller.abort();
      slot.publication?.abort();
      if (!slot.ready.size) this.evict(slot);
    }
  }

  private async publish(slot: Slot, ready: Ready): Promise<void> {
    const controller = new AbortController();
    slot.publication = controller;
    const prepared: Array<{ instance: Instance; object: THREE.Object3D }> = [];
    let started = this.clock();
    try {
      if (slot.desired !== ready.level || !slot.refs || this.disposed) return;
      for (const instance of slot.instances) {
        if (controller.signal.aborted) return;
        if (
          this.clock() - started >= this.budget.frameBudgetMs &&
          typeof requestAnimationFrame !== 'undefined'
        ) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          started = this.clock();
        }
        const object = this.child(ready, instance.options);
        prepared.push({ instance, object });
        await this.options.prepareObject?.(object, controller.signal, instance.root);
      }
      if (this.disposed || !slot.refs || slot.desired !== ready.level || controller.signal.aborted)
        return;
      const totals = this.stats();
      const old = this.level(slot, slot.current),
        next = this.level(slot, ready.level);
      if (
        ready.level > slot.current &&
        ((totals.triangles + (next.triangles - old.triangles) * slot.instances.size) * 2 >
          this.budget.maxTriangles ||
          (totals.drawCalls + (next.drawCalls - old.drawCalls) * slot.instances.size) * 2 >
            this.budget.maxDrawCalls)
      )
        return;
      // Count the overlap while old and new instances coexist, including clipped geometry
      // and cloned instance matrices, with shared buffers counted exactly once.
      const overlap = structureGeometryBytes([
        ...this.roots(),
        ...prepared.map(({ object }) => object),
      ]);
      if (overlap.cpuBytes > this.budget.maxCpuBytes || overlap.gpuBytes > this.budget.maxGpuBytes)
        return;
      for (const { instance, object } of prepared) {
        if (!slot.instances.has(instance)) continue;
        const previous = instance.child;
        instance.root.add(object);
        instance.root.remove(previous);
        instance.child = object;
        instance.root.userData.landmarkLod = this.level(slot, ready.level).name;
        disposeInstance(previous);
      }
      slot.current = ready.level;
      for (const [level, value] of slot.ready)
        if (level !== 0 && level !== slot.current) {
          slot.ready.delete(level);
          this.library.release(value.key);
        }
      this.upgrades++;
    } finally {
      if (slot.publication === controller) delete slot.publication;
      for (const { instance, object } of prepared)
        if (instance.child !== object) disposeInstance(object);
      this.remeasure();
      if (
        slot.current !== ready.level &&
        ready.level !== 0 &&
        slot.ready.get(ready.level) === ready
      ) {
        slot.ready.delete(ready.level);
        this.library.release(ready.key);
        this.remeasure();
      }
    }
  }

  update(view: StructureStreamingView): void {
    if (this.disposed) return;
    this.view = view;
    const now = this.clock();
    for (const slot of this.slots.values())
      if (!slot.refs && now - slot.lastUsed > this.budget.keepAliveMs) this.evict(slot);
    // Reserve a skyline for every resident placement before spending detail budget.
    // Otherwise early upgrades consume the capacity needed by later skyline instances,
    // and rejected publications download the same unreachable level every retry.
    let triangles = 0,
      calls = 0;
    for (const slot of this.slots.values())
      if (slot.refs && slot.manifest && slot.handle) {
        const count = Math.max(1, slot.instances.size);
        triangles += this.level(slot, 0).triangles * 2 * count;
        calls += this.level(slot, 0).drawCalls * 2 * count;
      }
    const focal =
      Math.max(1, view.viewportHeight) / (2 * Math.tan((view.verticalFov * Math.PI) / 360));
    const waitingForSkyline =
      [...this.slots.values()].some((slot) => slot.refs > 0 && !slot.handle) ||
      now - this.lastSkylineReady < this.budget.upgradeDelayMs;
    for (const slot of [...this.slots.values()]
      .filter((slot) => slot.refs && slot.manifest && slot.handle)
      .sort((a, b) => this.distance(a) - this.distance(b))) {
      const count = Math.max(1, slot.instances.size);
      triangles -= this.level(slot, 0).triangles * 2 * count;
      calls -= this.level(slot, 0).drawCalls * 2 * count;
      const scale = Math.max(
        1,
        ...[...slot.instances].map((instance) => instance.options.scale ?? 1),
      );
      const distance = Math.max(
        1,
        this.distance(slot) - (slot.manifest?.bounds.sphere.radius ?? 0) * scale,
      );
      let desired = 0;
      while (
        desired < 3 &&
        (this.level(slot, desired).errorMeters * scale * focal) / distance >
          (view.maxPixelError ?? 2) * (desired < slot.current ? 1 / 1.2 : 1)
      )
        desired++;
      while (
        desired > 0 &&
        (triangles + this.level(slot, desired).triangles * 2 * count > this.budget.maxTriangles ||
          calls + this.level(slot, desired).drawCalls * 2 * count > this.budget.maxDrawCalls)
      )
        desired--;
      triangles += this.level(slot, desired).triangles * 2 * count;
      calls += this.level(slot, desired).drawCalls * 2 * count;
      if (slot.desired !== desired) {
        slot.job?.controller.abort();
        slot.publication?.abort();
        slot.desired = desired;
      }
      if (
        desired === slot.current ||
        slot.job ||
        slot.publication ||
        now < slot.retryAt ||
        this.publications.some((item) => item.slot === slot)
      )
        continue;
      if (
        desired > slot.current &&
        (waitingForSkyline || (!slot.ready.has(desired) && !this.fits(slot, desired)))
      )
        continue;
      if (desired > slot.current) {
        const totals = this.stats(),
          old = this.level(slot, slot.current),
          next = this.level(slot, desired);
        if (
          (totals.triangles + (next.triangles - old.triangles) * count) * 2 >
            this.budget.maxTriangles ||
          (totals.drawCalls + (next.drawCalls - old.drawCalls) * count) * 2 >
            this.budget.maxDrawCalls
        )
          continue;
      }
      slot.retryAt = now + 500;
      void this.request(slot, desired)
        .then((ready) => this.publications.push({ slot, ready }))
        .catch((error: unknown) => {
          if ((error as Error).name !== 'AbortError') {
            this.failed++;
            slot.retryAt = this.clock() + 5000;
          }
        });
    }
    if (!this.publishing && this.publications.length) {
      this.publications.sort(
        (a, b) =>
          (a.ready.level < a.slot.current ? 0 : 1) - (b.ready.level < b.slot.current ? 0 : 1) ||
          this.distance(a.slot) - this.distance(b.slot),
      );
      const publication = this.publications.shift();
      if (publication) {
        this.publishing = true;
        void this.publish(publication.slot, publication.ready)
          .catch(() => {
            this.failed++;
          })
          .finally(() => {
            this.publishing = false;
          });
      }
    }
    this.pump();
  }

  stats(): StructureStreamingStats {
    const reserved = this.reservations();
    const levels: Record<string, number> = {};
    let triangles = 0,
      drawCalls = 0;
    for (const slot of this.slots.values())
      if (slot.ready.has(slot.current)) {
        const level = this.level(slot, slot.current);
        levels[level.name] = (levels[level.name] ?? 0) + slot.instances.size;
        triangles += level.triangles * slot.instances.size;
        drawCalls += level.drawCalls * slot.instances.size;
      }
    return {
      assets: this.slots.size,
      loading: this.running,
      queued: this.queue.length,
      ...this.measured,
      reservedCpuBytes: reserved.cpuBytes,
      reservedGpuBytes: reserved.gpuBytes,
      skylineBytes: reserved.skylineBytes,
      triangles,
      drawCalls,
      upgrades: this.upgrades,
      evicted: this.evicted,
      failed: this.failed,
      levels,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of this.slots.values()) {
      slot.job?.controller.abort();
      slot.publication?.abort();
      for (const instance of slot.instances) {
        disposeInstance(instance.child);
        instance.root.clear();
      }
    }
    for (const job of this.queue) job.reject(aborted());
    this.queue.length = 0;
    this.slots.clear();
    this.library.dispose();
    this.remeasure();
  }
}
