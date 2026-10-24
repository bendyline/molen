/**
 * Full models for the nearest ambient cars. A few cars near the camera swap their proxy for the
 * content model (wheels turning and steering), from a pool per type so a spawn never builds new
 * GPU objects once the pool is warm. Farther cars stay instanced proxies.
 */

import { createVehicleVisual, type VehicleVisual } from '@bendyline/molen-client/vehicles';
import type { VehicleData } from '@bendyline/molen-schema';
import * as THREE from 'three';

/** Where full vehicle models come from (absent: every car stays a proxy). */
export interface AmbientVehicleModels {
  /** A fresh model instance for a type, or undefined when the type has no model. */
  load(type: string, signal?: AbortSignal): Promise<THREE.Object3D | undefined>;
  /** The vehicle data (wheel nodes, paint material, spec) of a type, if it is a vehicle type. */
  vehicle(type: string): VehicleData | undefined;
}

/**
 * Authored glazing is often nearly clear (about 16% opaque), so from the street a passing car
 * reads as an open frame of pillars and seats. Traffic glass is tinted and glossy instead:
 * darker, at least 60% opaque and smooth enough to pick up the sky. Only traffic: a car the
 * player sits in keeps its authored glass. The visual's materials are its own clones.
 */
function tintGlass(object: THREE.Object3D): void {
  const mesh = object as THREE.Mesh;
  if (!mesh.isMesh) return;
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    if (!material.transparent || !/glass|glazing/i.test(material.name)) continue;
    if (!(material instanceof THREE.MeshStandardMaterial)) continue;
    material.color.multiplyScalar(0.3);
    material.opacity = Math.max(material.opacity, 0.62);
    material.roughness = Math.min(material.roughness, 0.08);
  }
}

export interface DetailCandidate {
  id: string;
  type: string;
  color: string;
  distance: number;
}

interface Active {
  type: string;
  visual: VehicleVisual;
  wheelAngle: number;
  yaw: number;
  steer: number;
  wheelRadius: number;
  wheelbase: number;
}

export interface DetailOptions {
  models: AmbientVehicleModels;
  parent: THREE.Object3D;
  prepare?: (object: THREE.Object3D) => Promise<void> | void;
  /** Promote within this distance (m). */
  near?: number;
  /** Demote beyond this distance (m). */
  far?: number;
}

/** Buffer residency estimate; textures add their decoded base level plus mip overhead. */
function modelBytes(object: THREE.Object3D): number {
  const buffers = new Set<ArrayBufferLike>();
  const textures = new Set<THREE.Texture>();
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const attr of Object.values(mesh.geometry.attributes)) {
      buffers.add(attr.array.buffer);
    }
    if (mesh.geometry.index) buffers.add(mesh.geometry.index.array.buffer);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
  });
  let bytes = [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
  for (const texture of textures) {
    const image = texture.image as { width?: number; height?: number } | undefined;
    bytes += ((image?.width ?? 1) * (image?.height ?? 1) * 4 * 4) / 3;
  }
  return bytes;
}

function disposeUnbound(model: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const item of [...geometries, ...materials, ...textures]) item.dispose();
  model.removeFromParent();
}

export class VehicleDetail {
  readonly group: THREE.Group = new THREE.Group();
  private readonly active = new Map<string, Active>();
  private readonly idle = new Map<string, VehicleVisual[]>();
  private readonly loading = new Map<string, AbortController>();
  private readonly resident = new Map<VehicleVisual, { bytes: number; used: number }>();
  private wanted = new Set<string>();
  private candidates: readonly DetailCandidate[] = [];
  private clock = 0;
  private idleLimit = 4;
  private byteLimit = 32 * 1024 * 1024;
  private concurrentLimit = 2;
  private readonly missing = new Set<string>();
  private max = 8;
  private disposed = false;

  constructor(private readonly options: DetailOptions) {
    this.group.name = 'ambient:detail';
    options.parent.add(this.group);
  }

  setMax(max: number): void {
    this.max = Math.max(0, max);
  }

  setCacheBudget(options: {
    idleModels?: number;
    modelBytes?: number;
    concurrentLoads?: number;
  }): void {
    for (const value of Object.values(options))
      if (value !== undefined && !Number.isFinite(value))
        throw new RangeError('Vehicle cache budgets must be finite');
    if (options.modelBytes !== undefined && options.modelBytes > this.byteLimit)
      this.missing.clear();
    if (options.idleModels !== undefined)
      this.idleLimit = Math.max(0, Math.floor(options.idleModels));
    if (options.modelBytes !== undefined) this.byteLimit = Math.max(0, options.modelBytes);
    if (options.concurrentLoads !== undefined)
      this.concurrentLimit = Math.max(1, Math.floor(options.concurrentLoads));
    this.prune();
    for (const [id, entry] of [...this.active].reverse()) {
      if (this.cacheStats().bytes <= this.byteLimit) break;
      this.active.delete(id);
      this.release(entry.visual);
    }
  }

  cacheStats(): { active: number; idle: number; bytes: number; pending: number } {
    return {
      active: this.active.size,
      idle: this.resident.size - this.active.size,
      bytes: [...this.resident.values()].reduce((sum, entry) => sum + entry.bytes, 0),
      pending: this.loading.size,
    };
  }

  private release(visual: VehicleVisual): void {
    if (!this.resident.delete(visual)) return;
    // Fresh model ownership belongs to this pool, including texture objects.
    const textures = new Set<THREE.Texture>();
    visual.object.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh)
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.add(value);
    });
    for (const texture of textures) texture.dispose();
    visual.dispose();
  }

  private prune(reserve = 0): void {
    const idle = [...this.idle.entries()]
      .flatMap(([type, pool]) => pool.map((visual) => ({ type, visual })))
      .sort(
        (a, b) =>
          (this.resident.get(a.visual)?.used ?? 0) - (this.resident.get(b.visual)?.used ?? 0),
      );
    while (
      idle.length &&
      (idle.length > this.idleLimit || this.cacheStats().bytes + reserve > this.byteLimit)
    ) {
      const oldest = idle.shift();
      if (!oldest) break;
      const pool = this.idle.get(oldest.type);
      pool?.splice(pool.indexOf(oldest.visual), 1);
      if (!pool?.length) this.idle.delete(oldest.type);
      this.release(oldest.visual);
    }
  }

  has(id: string): boolean {
    return this.active.has(id);
  }

  get count(): number {
    return this.active.size;
  }

  /** Choose which cars get full models (call a few times a second). */
  select(candidates: readonly DetailCandidate[], exists: (id: string) => boolean): void {
    const near = this.options.near ?? 45;
    const far = this.options.far ?? 65;
    const wanted = candidates
      .filter((c) => c.distance < (this.active.has(c.id) ? far : near) && !this.missing.has(c.type))
      .sort((a, b) => a.distance - b.distance || (a.id < b.id ? -1 : 1))
      .slice(0, this.max);
    const keep = new Set(wanted.map((c) => c.id));
    this.candidates = wanted;
    this.wanted = new Set(wanted.map((c) => c.type));
    for (const [type, controller] of this.loading) if (!this.wanted.has(type)) controller.abort();
    for (const [id, entry] of this.active)
      if (!keep.has(id) || !exists(id)) {
        entry.visual.object.visible = false;
        this.active.delete(id);
        const pool = this.idle.get(entry.type) ?? [];
        pool.push(entry.visual);
        this.idle.set(entry.type, pool);
        const resident = this.resident.get(entry.visual);
        if (resident) resident.used = ++this.clock;
      }
    let started = 0;
    for (const candidate of wanted) {
      if (this.active.has(candidate.id)) continue;
      const pooled = this.idle.get(candidate.type)?.pop();
      if (pooled !== undefined) {
        this.activate(candidate, pooled);
        continue;
      }
      if (
        this.loading.has(candidate.type) ||
        this.loading.size >= this.concurrentLimit ||
        started >= 1
      )
        continue;
      started++;
      void this.load(candidate.type);
    }
    this.prune();
  }

  private activate(candidate: DetailCandidate, visual: VehicleVisual): void {
    const data = this.options.models.vehicle(candidate.type);
    if (data === undefined) return;
    const paint = new THREE.Color(candidate.color);
    visual.object.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        if (material.name === data.visual.paintMaterial && 'color' in material)
          (material as THREE.MeshStandardMaterial).color.copy(paint);
    });
    visual.object.visible = true;
    this.active.set(candidate.id, {
      type: candidate.type,
      visual,
      wheelAngle: 0,
      yaw: Number.NaN,
      steer: 0,
      wheelRadius: data.spec.wheelRadius,
      wheelbase: data.spec.wheelbase,
    });
  }

  private async load(type: string): Promise<void> {
    const data = this.options.models.vehicle(type);
    if (data === undefined) {
      this.missing.add(type);
      return;
    }
    const controller = new AbortController();
    this.loading.set(type, controller);
    let bound: VehicleVisual | undefined;
    try {
      const model = await this.options.models.load(type, controller.signal);
      if (model === undefined) {
        if (!controller.signal.aborted) this.missing.add(type);
        return;
      }
      if (this.disposed || controller.signal.aborted || !this.wanted.has(type)) {
        disposeUnbound(model);
        return;
      }
      const bytes = modelBytes(model);
      this.prune(bytes);
      if (this.cacheStats().bytes + bytes > this.byteLimit) {
        disposeUnbound(model);
        if (bytes > this.byteLimit) this.missing.add(type);
        return;
      }
      const originalMaterials = new Set<THREE.Material>();
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh)
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            originalMaterials.add(material);
      });
      const visual = createVehicleVisual(model, data);
      bound = visual;
      for (const material of originalMaterials) material.dispose();
      this.resident.set(visual, { bytes, used: ++this.clock });
      visual.object.visible = false;
      visual.object.traverse((object) => {
        object.userData.walkIgnore = true;
        tintGlass(object);
      });
      this.group.add(visual.object);
      await this.options.prepare?.(visual.object);
      if (
        this.disposed ||
        controller.signal.aborted ||
        !this.wanted.has(type) ||
        this.cacheStats().bytes > this.byteLimit
      ) {
        this.release(visual);
        return;
      }
      const candidate = this.candidates.find((c) => c.type === type && !this.active.has(c.id));
      if (candidate && this.active.size < this.max) this.activate(candidate, visual);
      else {
        const pool = this.idle.get(type) ?? [];
        pool.push(visual);
        this.idle.set(type, pool);
      }
      this.prune();
    } catch {
      if (bound) this.release(bound);
      if (!controller.signal.aborted) this.missing.add(type);
    } finally {
      this.loading.delete(type);
    }
  }

  /** Place promoted cars and turn their wheels (every frame). */
  update(
    id: string,
    pos: readonly [number, number, number],
    rot: readonly [number, number, number, number],
    speed: number,
    dt: number,
  ): void {
    const entry = this.active.get(id);
    if (entry === undefined) return;
    const object = entry.visual.object;
    object.position.set(pos[0], pos[1], pos[2]);
    object.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
    // Heading change → steering angle (the solver's bicycle model: yawRate = -v·tan(steer)/L).
    const yaw = Math.atan2(
      2 * (rot[3] * rot[1] + rot[0] * rot[2]),
      1 - 2 * (rot[1] * rot[1] + rot[0] * rot[0]),
    );
    if (Number.isFinite(entry.yaw) && dt > 0 && speed > 0.3) {
      let delta = yaw - entry.yaw;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      const target = Math.max(
        -0.5,
        Math.min(0.5, Math.atan((-(delta / dt) * entry.wheelbase) / speed)),
      );
      entry.steer += (target - entry.steer) * Math.min(1, dt * 8);
    } else entry.steer *= 0.9;
    entry.yaw = yaw;
    entry.wheelAngle =
      (entry.wheelAngle + (speed * dt) / Math.max(0.2, entry.wheelRadius)) % (Math.PI * 2);
    entry.visual.update(entry.steer, entry.wheelAngle);
  }

  dispose(): void {
    this.disposed = true;
    for (const controller of this.loading.values()) controller.abort();
    for (const visual of this.resident.keys()) this.release(visual);
    this.active.clear();
    this.idle.clear();
    this.group.removeFromParent();
  }
}
