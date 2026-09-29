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
  load(type: string): Promise<THREE.Object3D | undefined>;
  /** The vehicle data (wheel nodes, paint material, spec) of a type, if it is a vehicle type. */
  vehicle(type: string): VehicleData | undefined;
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

export class VehicleDetail {
  readonly group: THREE.Group = new THREE.Group();
  private readonly active = new Map<string, Active>();
  private readonly idle = new Map<string, VehicleVisual[]>();
  private readonly loading = new Set<string>();
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
    for (const [id, entry] of this.active)
      if (!keep.has(id) || !exists(id)) {
        entry.visual.object.visible = false;
        this.active.delete(id);
        const pool = this.idle.get(entry.type) ?? [];
        pool.push(entry.visual);
        this.idle.set(entry.type, pool);
      }
    let started = 0;
    for (const candidate of wanted) {
      if (this.active.has(candidate.id)) continue;
      const pooled = this.idle.get(candidate.type)?.pop();
      if (pooled !== undefined) {
        this.activate(candidate, pooled);
        continue;
      }
      if (this.loading.has(candidate.type) || started >= 1) continue;
      started++;
      void this.load(candidate.type);
    }
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
    this.loading.add(type);
    try {
      const model = await this.options.models.load(type);
      if (model === undefined) {
        this.missing.add(type);
        return;
      }
      if (this.disposed) return;
      const visual = createVehicleVisual(model, data);
      visual.object.visible = false;
      visual.object.traverse((object) => {
        object.userData.walkIgnore = true;
      });
      this.group.add(visual.object);
      await this.options.prepare?.(visual.object);
      if (this.disposed) {
        visual.dispose();
        return;
      }
      const pool = this.idle.get(type) ?? [];
      pool.push(visual);
      this.idle.set(type, pool);
    } catch {
      this.missing.add(type);
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
    for (const entry of this.active.values()) entry.visual.dispose();
    for (const pool of this.idle.values()) for (const visual of pool) visual.dispose();
    this.active.clear();
    this.idle.clear();
    this.group.removeFromParent();
  }
}
