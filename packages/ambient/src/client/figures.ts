/**
 * Pedestrians as procedural figures, posed without the kernel figures systems (so a main-thread
 * host never loads the script host): gait comes from each agent's speed and the distance it has
 * walked, which keeps feet planted across lane changes. Meshes are pooled per body key, detail
 * tiers follow distance with hysteresis, and pose evaluation is budgeted per frame. A walker can
 * also be seated (`mode: 'sit'`, `anchor: 'eye'` for a vehicle seat) or turn its head toward a
 * point (`lookAt`), which is how a host draws its own characters with the same bodies.
 */

import {
  applyPose,
  createFigureMaterial,
  descriptorKey,
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
  worldToFigure,
} from '@bendyline/molen-figures/client';
import * as THREE from 'three';

export interface WalkerView {
  id: string;
  figure: FigureData;
  /** World position of the walker's `anchor` point (its feet unless `anchor` says otherwise). */
  pos: readonly [number, number, number];
  rot: readonly [number, number, number, number];
  /** Planar speed, m/s. */
  speed: number;
  /** Tick the current motion began. */
  since: number;
  hidden: boolean;
  /**
   * The gait: `idle` or `walk` from `speed` by default, `run` for the running gait, `sit` for a
   * seated pose (a passenger). Seated and eye-anchored walkers draw only at the animated detail
   * tiers, since a rigid stand-in cannot sit.
   */
  mode?: 'idle' | 'walk' | 'run' | 'sit';
  /**
   * Which point of the body sits at `pos`: the feet (`origin`, default) or the eye (`eye`, the
   * point a vehicle seat names).
   */
  anchor?: 'origin' | 'eye' | 'pelvis';
  /** Saddle-relative cycle contact points, shared with the kernel pose evaluator. */
  riding?: import('@bendyline/molen-figures/client').PoseEvalOptions['riding'];
  /** A world point the head turns toward (within the neck's reach). */
  lookAt?: readonly [number, number, number];
}

/** Whether a walker's pose depends on more than its gait, so a rigid stand-in would be wrong. */
function posed(walker: WalkerView): boolean {
  return walker.mode === 'sit' || (walker.anchor !== undefined && walker.anchor !== 'origin');
}

/** A body still on screen while the one replacing it builds its shaders. */
interface Outgoing {
  key: string;
  mesh: FigureMesh;
  /** The walker's figure changed: dispose the old body instead of pooling it. */
  retired: boolean;
}

interface Active {
  /** The figure object this body was built from (identity is the change signal). */
  figure: FigureData;
  descriptor: ResolvedFigureDescriptor;
  /** `descriptorKey` of the descriptor: an equal figure under a new object keeps its body. */
  body: string;
  outgoing: Outgoing | undefined;
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

/**
 * Leave a hidden body out of the scene's per-frame world-matrix walk. Pooled bodies wait hidden
 * in the group with their skeletons, and three walks hidden objects too: a pool's bones were
 * recomposed every frame. A move while hidden is applied when the body shows again.
 */
function skipWhenHidden(object: THREE.Object3D): void {
  object.updateMatrixWorld = function (this: THREE.Object3D, force?: boolean): void {
    if (!this.visible) {
      if (force === true) this.matrixWorldNeedsUpdate = true;
      return;
    }
    THREE.Object3D.prototype.updateMatrixWorld.call(this, force);
  };
}

/** Bodies built or swapped per frame (see AmbientFigures.update). */
const MAX_SWITCHES_PER_FRAME = 2;

export class AmbientFigures {
  readonly group: THREE.Group = new THREE.Group();
  private readonly cache = new FigureGeometryCache();
  private readonly material = createFigureMaterial();
  private readonly active = new Map<string, Active>();
  private readonly pool = new Map<string, FigureMesh[]>();
  private readonly descriptors = new WeakMap<FigureData, ResolvedFigureDescriptor>();
  private budget: FigureBudget = { skinned: 32, radius: 120, posesPerFrame: 20 };
  private cursor = 0;
  private frame = 0;

  /** New bodies whose shaders are still being built; they stay hidden until then. */
  private readonly preparing = new WeakSet<FigureMesh>();

  constructor(private readonly prepare?: (object: THREE.Object3D) => Promise<void> | void) {
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
      pooled.root.visible = !this.preparing.has(pooled);
      return { key: cached.key, mesh: pooled };
    }
    const mesh = figureBodyToSkinnedMesh(cached.body, cached.geometry, this.material);
    skipWhenHidden(mesh.root);
    mesh.mesh.castShadow = tier === 0;
    mesh.mesh.receiveShadow = true;
    mesh.root.traverse((object) => {
      object.userData.walkIgnore = true;
    });
    this.group.add(mesh.root);
    const prepared = this.prepare?.(mesh.root);
    if (prepared !== undefined) {
      // Hidden until its shaders are built, as detailed cars are: the first walker drawn with a
      // new skinned variant built it mid-frame, 40-220 ms on WebGL.
      mesh.root.visible = false;
      this.preparing.add(mesh);
      const show = (): void => {
        this.preparing.delete(mesh);
        if (!this.pool.get(cached.key)?.includes(mesh)) mesh.root.visible = true;
      };
      void prepared.then(show, show);
    }
    return { key: cached.key, mesh };
  }

  private pooled = 0;

  /** Figures that failed to resolve: skipped without trying again every frame. */
  private readonly unresolvable = new WeakSet<FigureData>();

  private resolve(figure: FigureData): ResolvedFigureDescriptor | undefined {
    let descriptor = this.descriptors.get(figure);
    if (descriptor !== undefined || this.unresolvable.has(figure)) return descriptor;
    try {
      descriptor = resolveFigureDescriptor(figure);
    } catch {
      this.unresolvable.add(figure);
      return undefined;
    }
    this.descriptors.set(figure, descriptor);
    return descriptor;
  }

  /** Let go of a body: a retired one (its walker changed look) is disposed, not pooled. */
  private dropOutgoing(outgoing: Outgoing | undefined): void {
    if (outgoing === undefined) return;
    if (outgoing.retired) {
      outgoing.mesh.dispose();
      this.cache.release(outgoing.key);
    } else this.releaseMesh(outgoing.key, outgoing.mesh);
  }

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
    let switches = 0;
    for (const { w, distance } of ranked) {
      const entry = this.active.get(w.id);
      let tier = this.tierFor(distance, entry?.tier);
      if (tier !== undefined && tier < 2) {
        if (skinned >= this.budget.skinned) tier = 2;
        else skinned++;
      }
      // A seated or eye-anchored body needs bones; past the animated tiers it is not drawn.
      if (tier === 2 && posed(w)) tier = undefined;
      if (tier === undefined) {
        if (entry !== undefined) {
          this.dropOutgoing(entry.outgoing);
          this.releaseMesh(entry.key, entry.mesh);
          this.active.delete(w.id);
        }
        continue;
      }
      let current = entry;
      // A host gave the walker a new figure object (a character's look changed). The same body
      // under a new object keeps its mesh; a different body is rebuilt like a tier change.
      let refigured = false;
      if (current !== undefined && current.figure !== w.figure) {
        const next = this.resolve(w.figure);
        if (next !== undefined && descriptorKey(next) !== current.body) refigured = true;
        else if (next !== undefined) current.figure = w.figure;
      }
      // A few new bodies a frame, nearest first: a larger budget (a quality step) or a crowd
      // coming into range built every body in one frame. The rest keep what they show, or wait.
      if (
        (current === undefined || current.tier !== tier || refigured) &&
        switches < MAX_SWITCHES_PER_FRAME
      ) {
        const descriptor = this.resolve(w.figure);
        if (descriptor === undefined) continue;
        switches++;
        // The body on screen stays until its replacement's shaders are built, so a change of
        // look or detail never blinks the walker out for a frame.
        let outgoing: Outgoing | undefined;
        if (current !== undefined) {
          this.dropOutgoing(current.outgoing);
          outgoing = { key: current.key, mesh: current.mesh, retired: refigured };
        }
        const { key, mesh } = this.acquire(descriptor, tier);
        current = {
          figure: w.figure,
          descriptor,
          body: descriptorKey(descriptor),
          outgoing,
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
      if (current === undefined) continue;
      current.distance = distance;
      current.seen = this.frame;
      if (current.last !== undefined)
        current.walked += Math.hypot(w.pos[0] - current.last[0], w.pos[2] - current.last[1]);
      current.last = [w.pos[0], w.pos[2]];
      current.mesh.root.position.set(w.pos[0], w.pos[1], w.pos[2]);
      current.mesh.root.quaternion.set(w.rot[0], w.rot[1], w.rot[2], w.rot[3]);
      if (current.outgoing !== undefined) {
        if (this.preparing.has(current.mesh)) {
          current.outgoing.mesh.root.position.set(w.pos[0], w.pos[1], w.pos[2]);
          current.outgoing.mesh.root.quaternion.set(w.rot[0], w.rot[1], w.rot[2], w.rot[3]);
        } else {
          this.dropOutgoing(current.outgoing);
          current.outgoing = undefined;
        }
      }
    }
    // Walkers that left the world entirely.
    for (const [id, entry] of this.active)
      if (entry.seen !== this.frame) {
        this.dropOutgoing(entry.outgoing);
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
    // A new seated or anchored body is posed at once: its bind pose would stand at the seat.
    const picked = new Set(chosen.map(([id]) => id));
    for (const pair of rest) {
      const walker = byId.get(pair[0]);
      if (
        pair[1].pose === undefined &&
        !picked.has(pair[0]) &&
        walker !== undefined &&
        posed(walker)
      )
        chosen.push(pair);
    }
    for (const [id, entry] of chosen) {
      const walker = byId.get(id);
      if (walker === undefined) continue;
      const seated = walker.mode === 'sit';
      const moving = !seated && walker.speed > 0.05 && walker.mode !== 'idle';
      const strideRate = moving ? strideRateFor(walker.speed, entry.rig.legLength) : 0;
      const stride = strideRate > 0 ? walker.speed / strideRate : 1;
      const state: FigureStateData = {
        mode: seated ? 'sit' : moving ? (walker.mode === 'run' ? 'run' : 'walk') : 'idle',
        speed: moving ? walker.speed : 0,
        strideRate,
        phaseAt: moving ? (entry.walked / stride) % 1 : 0,
        phaseAtTick: tick,
        modeAtTick: walker.since,
      };
      const lookTarget =
        walker.lookAt !== undefined
          ? worldToFigure({ pos: [...walker.pos], rot: [...walker.rot] }, [
              walker.lookAt[0],
              walker.lookAt[1],
              walker.lookAt[2],
            ])
          : undefined;
      entry.pose = evaluatePose(
        entry.rig,
        state,
        tick,
        {
          tickRate,
          seed: entry.seed,
          riding: walker.riding,
          ...(lookTarget !== undefined ? { lookTarget } : {}),
          ...(walker.anchor !== undefined && walker.anchor !== 'origin'
            ? { anchor: walker.anchor }
            : {}),
        },
        entry.pose,
      );
      applyPose(entry.pose, entry.mesh.bones);
    }
  }

  dispose(): void {
    for (const entry of this.active.values()) {
      entry.mesh.dispose();
      entry.outgoing?.mesh.dispose();
    }
    for (const list of this.pool.values()) for (const mesh of list) mesh.dispose();
    this.active.clear();
    this.pool.clear();
    this.cache.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
