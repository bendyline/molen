/**
 * Pedestrians as procedural figures, posed without the kernel figures systems (so a main-thread
 * host never loads the script host): gait comes from each agent's speed and the distance it has
 * walked, which keeps feet planted across lane changes. Meshes are pooled per body key, detail
 * tiers follow distance with hysteresis, and pose evaluation is budgeted per frame.
 */

import {
  applyPose,
  evaluatePose,
  type FigureData,
  FigureGeometryCache,
  type FigureMesh,
  type FigurePose,
  type FigureRig,
  type FigureStateData,
  type FigureTier,
  figureBodyToSkinnedMesh,
  figureSeed,
  type ResolvedFigureDescriptor,
  resolveFigureDescriptor,
  strideRateFor,
} from '@bendyline/molen-figures/client';
import * as THREE from 'three';

export interface WalkerView {
  id: string;
  figure: FigureData;
  pos: readonly [number, number, number];
  rot: readonly [number, number, number, number];
  speed: number;
  since: number;
  hidden: boolean;
}

interface Active {
  descriptor: ResolvedFigureDescriptor;
  rig: FigureRig;
  seed: number;
  tier: FigureTier;
  key: string;
  mesh: FigureMesh;
  pose: FigurePose | undefined;
  walked: number;
  last: [number, number] | undefined;
  distance: number;
  seen: number;
}

export interface FigureBudget {
  /** Skinned (animated) figures at most. */
  skinned: number;
  /** Figures beyond this radius (m) are not drawn. */
  radius: number;
  /** Pose evaluations per frame (nearest first, the rest round-robin). */
  posesPerFrame: number;
}

export class AmbientFigures {
  readonly group: THREE.Group = new THREE.Group();
  private readonly cache = new FigureGeometryCache();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.75,
    metalness: 0,
  });
  private readonly active = new Map<string, Active>();
  private readonly pool = new Map<string, FigureMesh[]>();
  private readonly descriptors = new WeakMap<FigureData, ResolvedFigureDescriptor>();
  private budget: FigureBudget = { skinned: 32, radius: 120, posesPerFrame: 20 };
  private cursor = 0;
  private frame = 0;

  constructor(private readonly prepare?: (object: THREE.Object3D) => void) {
    this.group.name = 'ambient:figures';
  }

  setBudget(budget: Partial<FigureBudget>): void {
    this.budget = { ...this.budget, ...budget };
  }

  get count(): number {
    return this.active.size;
  }

  private tierFor(distance: number, current: FigureTier | undefined): FigureTier | undefined {
    const r = this.budget.radius;
    const h = current === undefined ? 1 : 1.1;
    if (distance > r * 1.25 * h) return undefined;
    const medium = r * 0.35;
    if (current === 0) return distance > medium * 1.1 ? (distance > r * 1.1 ? 2 : 1) : 0;
    if (current === 1) return distance > r * 1.1 ? 2 : distance < medium * 0.9 ? 0 : 1;
    if (current === 2) return distance < r * 0.9 ? (distance < medium * 0.9 ? 0 : 1) : 2;
    return distance < medium ? 0 : distance < r ? 1 : 2;
  }

  private acquire(
    descriptor: ResolvedFigureDescriptor,
    tier: FigureTier,
  ): { key: string; mesh: FigureMesh } {
    const cached = this.cache.acquire(descriptor, tier);
    const pooled = this.pool.get(cached.key)?.pop();
    if (pooled !== undefined) {
      this.pooled--;
      this.cache.release(cached.key);
      pooled.root.visible = true;
      return { key: cached.key, mesh: pooled };
    }
    const mesh = figureBodyToSkinnedMesh(cached.body, cached.geometry, this.material);
    mesh.mesh.castShadow = tier === 0;
    mesh.mesh.receiveShadow = true;
    mesh.root.traverse((object) => {
      object.userData.walkIgnore = true;
    });
    this.group.add(mesh.root);
    this.prepare?.(mesh.root);
    return { key: cached.key, mesh };
  }

  private pooled = 0;

  private releaseMesh(key: string, mesh: FigureMesh): void {
    mesh.root.visible = false;
    const list = this.pool.get(key) ?? [];
    if (list.length >= 4 || this.pooled >= 96) {
      mesh.dispose();
      this.cache.release(key);
      return;
    }
    list.push(mesh);
    this.pool.set(key, list);
    this.pooled++;
  }

  /** Update every walker for this frame. */
  update(
    walkers: readonly WalkerView[],
    camera: readonly [number, number, number],
    tick: number,
    tickRate: number,
  ): void {
    this.frame++;
    const ranked = walkers
      .filter((w) => !w.hidden)
      .map((w) => ({
        w,
        distance: Math.hypot(w.pos[0] - camera[0], w.pos[1] - camera[1], w.pos[2] - camera[2]),
      }))
      .sort((a, b) => a.distance - b.distance || (a.w.id < b.w.id ? -1 : 1));
    let skinned = 0;
    for (const { w, distance } of ranked) {
      const entry = this.active.get(w.id);
      let tier = this.tierFor(distance, entry?.tier);
      if (tier !== undefined && tier < 2) {
        if (skinned >= this.budget.skinned) tier = 2;
        else skinned++;
      }
      if (tier === undefined) {
        if (entry !== undefined) {
          this.releaseMesh(entry.key, entry.mesh);
          this.active.delete(w.id);
        }
        continue;
      }
      let current = entry;
      if (current === undefined || current.tier !== tier) {
        let descriptor = this.descriptors.get(w.figure);
        if (descriptor === undefined) {
          try {
            descriptor = resolveFigureDescriptor(w.figure);
          } catch {
            continue;
          }
          this.descriptors.set(w.figure, descriptor);
        }
        if (current !== undefined) this.releaseMesh(current.key, current.mesh);
        const { key, mesh } = this.acquire(descriptor, tier);
        current = {
          descriptor,
          rig: this.cache.rigFor(descriptor),
          seed: figureSeed(descriptor.seed, w.id),
          tier,
          key,
          mesh,
          pose: undefined,
          walked: current?.walked ?? 0,
          last: current?.last,
          distance,
          seen: this.frame,
        };
        this.active.set(w.id, current);
      }
      current.distance = distance;
      current.seen = this.frame;
      if (current.last !== undefined)
        current.walked += Math.hypot(w.pos[0] - current.last[0], w.pos[2] - current.last[1]);
      current.last = [w.pos[0], w.pos[2]];
      current.mesh.root.position.set(w.pos[0], w.pos[1], w.pos[2]);
      current.mesh.root.quaternion.set(w.rot[0], w.rot[1], w.rot[2], w.rot[3]);
    }
    // Walkers that left the world entirely.
    for (const [id, entry] of this.active)
      if (entry.seen !== this.frame) {
        this.releaseMesh(entry.key, entry.mesh);
        this.active.delete(id);
      }
    this.pose(walkers, tick, tickRate);
  }

  private pose(walkers: readonly WalkerView[], tick: number, tickRate: number): void {
    const byId = new Map(walkers.map((w) => [w.id, w]));
    const animated = [...this.active.entries()]
      .filter(([, e]) => e.mesh.bones.length > 0)
      .sort((a, b) => a[1].distance - b[1].distance);
    const budget = this.budget.posesPerFrame;
    const nearest = Math.min(animated.length, Math.ceil(budget / 2));
    const chosen = animated.slice(0, nearest);
    const rest = animated.slice(nearest);
    for (let i = 0; i < budget - nearest && rest.length > 0 && i < rest.length; i++) {
      chosen.push(rest[(this.cursor + i) % rest.length] as [string, Active]);
    }
    if (rest.length > 0) this.cursor = (this.cursor + budget - nearest) % rest.length;
    for (const [id, entry] of chosen) {
      const walker = byId.get(id);
      if (walker === undefined) continue;
      const moving = walker.speed > 0.05;
      const strideRate = moving ? strideRateFor(walker.speed, entry.rig.legLength) : 0;
      const stride = strideRate > 0 ? walker.speed / strideRate : 1;
      const state: FigureStateData = {
        mode: moving ? 'walk' : 'idle',
        speed: walker.speed,
        strideRate,
        phaseAt: moving ? (entry.walked / stride) % 1 : 0,
        phaseAtTick: tick,
        modeAtTick: walker.since,
      };
      entry.pose = evaluatePose(entry.rig, state, tick, { tickRate, seed: entry.seed }, entry.pose);
      applyPose(entry.pose, entry.mesh.bones);
    }
  }

  dispose(): void {
    for (const entry of this.active.values()) entry.mesh.dispose();
    for (const list of this.pool.values()) for (const mesh of list) mesh.dispose();
    this.active.clear();
    this.pool.clear();
    this.cache.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
