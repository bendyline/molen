/**
 * The `figure` renderable kind: `renderable: { kind: 'figure', ref: 'procedural', lod? }` on an
 * entity with a `figure` component. The handle builds the body from the mirrored descriptor,
 * samples `figureState` (kept one state back until the interpolated render tick reaches the
 * tick it changed on), evaluates the shared kernel pose at every sampled frame, and swaps
 * detail tiers by distance on the live path.
 */

import type {
  KindContext,
  KindHandle,
  KindView,
  Renderable,
  RenderableKind,
} from '@bendyline/molen-client';
import { dmath, type TransformLike, type Vec3 } from '@bendyline/molen-kernel/determinism';
import type { EntityId, JsonObject } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type {
  FigureAnchor,
  FigureAttachmentData,
  FigureData,
  FigureIntentData,
  FigureStateData,
} from '../kernel/components';
import { resolveFigureDescriptor } from '../kernel/descriptor';
import { evaluatePose, type FigurePose, worldToFigure } from '../kernel/pose';
import type { FigureRig } from '../kernel/rig';
import { figureSeed } from '../kernel/seed';
import type { FigureTier } from '../kernel/skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from '../kernel/types';
import { type CachedFigureGeometry, FigureGeometryCache } from './geometry-cache';
import { applyPose, type FigureMesh, figureBodyToSkinnedMesh } from './upload';

export interface FigureKindOptions {
  /**
   * Camera distances (meters) beyond which tier 1 and tier 2 bodies are used on the live path;
   * default [0.35, 1] times the client's animation `distantDistance`.
   */
  tierDistances?: [medium: number, far: number];
  /** Fractional hysteresis around each tier boundary (default 0.1). */
  hysteresis?: number;
  /** Material for every figure (default: a vertex-colored standard material). */
  material?: THREE.Material;
}

interface FigureRenderable extends Renderable {
  lod?: 'auto' | 0 | 1 | 2;
}

function lodOf(renderable: Renderable): 'auto' | FigureTier {
  const lod = (renderable as FigureRenderable).lod;
  return lod === 0 || lod === 1 || lod === 2 ? lod : 'auto';
}

class FigureHandle implements KindHandle {
  readonly object: THREE.Group = new THREE.Group();
  private renderable: Renderable;
  private figureRef: JsonObject | undefined;
  private descriptor: ResolvedFigureDescriptor | undefined;
  private rig: FigureRig | undefined;
  private seed = 0;
  private blendTicks: number | undefined;
  private stateRef: JsonObject | undefined;
  private state: FigureStateData | undefined;
  private previousState: FigureStateData | undefined;
  private stateSince = Number.NEGATIVE_INFINITY;
  private cached: CachedFigureGeometry | undefined;
  private mesh: FigureMesh | undefined;
  private tier: FigureTier = 0;
  private pose: FigurePose | undefined;
  private warnedMissing = false;

  constructor(
    private readonly id: EntityId,
    renderable: Renderable,
    private readonly ctx: KindContext,
    private readonly cache: FigureGeometryCache,
    private readonly material: THREE.Material,
    private readonly options: FigureKindOptions,
  ) {
    this.renderable = renderable;
    this.refreshDescriptor();
    this.rebuild(this.initialTier());
  }

  private initialTier(): FigureTier {
    const lod = lodOf(this.renderable);
    return lod === 'auto' ? 0 : lod;
  }

  /** Re-read the `figure` component; true when the body must be regenerated. */
  private refreshDescriptor(): boolean {
    const figure = this.ctx.mirror?.peek(this.id, 'figure') as FigureData | undefined;
    if (figure === this.figureRef) return false;
    this.figureRef = figure;
    if (figure === undefined) {
      if (!this.warnedMissing) {
        this.warnedMissing = true;
        this.ctx.warn(`entity "${this.id}": renderable kind "figure" needs a figure component`);
      }
      this.descriptor = undefined;
      this.rig = undefined;
      return true;
    }
    try {
      const descriptor = resolveFigureDescriptor(figure);
      const changed =
        this.descriptor === undefined ||
        JSON.stringify(descriptor) !== JSON.stringify(this.descriptor);
      this.descriptor = descriptor;
      this.rig = this.cache.rigFor(descriptor);
      this.seed = figureSeed(descriptor.seed, this.id);
      this.blendTicks = figure.blendTicks;
      return changed;
    } catch (error) {
      this.ctx.warn(`entity "${this.id}": invalid figure descriptor (${(error as Error).message})`);
      this.descriptor = undefined;
      this.rig = undefined;
      return true;
    }
  }

  private rebuild(tier: FigureTier): void {
    const shadows = this.mesh?.mesh;
    const castShadow = shadows?.castShadow ?? this.renderable.shadows?.cast ?? false;
    const receiveShadow = shadows?.receiveShadow ?? this.renderable.shadows?.receive ?? false;
    if (this.mesh !== undefined) {
      this.mesh.dispose();
      this.mesh = undefined;
    }
    if (this.cached !== undefined) {
      this.cache.release(this.cached.key);
      this.cached = undefined;
    }
    this.tier = tier;
    this.pose = undefined;
    if (this.descriptor === undefined) return;
    this.cached = this.cache.acquire(this.descriptor, tier);
    this.mesh = figureBodyToSkinnedMesh(this.cached.body, this.cached.geometry, this.material);
    this.mesh.mesh.castShadow = castShadow;
    this.mesh.mesh.receiveShadow = receiveShadow;
    this.object.add(this.mesh.root);
    const renderer = this.ctx.renderer;
    if (renderer !== undefined) this.ctx.track(renderer.prepareObject(this.mesh.root));
  }

  update(renderable: Renderable): void {
    this.renderable = renderable;
    const lod = lodOf(renderable);
    if (lod !== 'auto' && lod !== this.tier) this.rebuild(lod);
  }

  private chooseTier(view: KindView | undefined): FigureTier {
    const lod = lodOf(this.renderable);
    if (lod !== 'auto') return lod;
    if (view === undefined) return 0;
    const [medium, far] = this.options.tierDistances ?? [
      0.35 * view.distantDistance,
      view.distantDistance,
    ];
    const h = this.options.hysteresis ?? 0.1;
    const d = view.distance;
    // Hysteresis: leaving a tier needs a margin beyond the boundary in the direction of travel.
    if (this.tier === 0) return d > medium * (1 + h) ? (d > far * (1 + h) ? 2 : 1) : 0;
    if (this.tier === 1) return d > far * (1 + h) ? 2 : d < medium * (1 - h) ? 0 : 1;
    return d < far * (1 - h) ? (d < medium * (1 - h) ? 0 : 1) : 2;
  }

  private refreshState(): void {
    const mirror = this.ctx.mirror;
    const ref = mirror?.peek(this.id, 'figureState') as FigureStateData | undefined;
    if (ref === this.stateRef) return;
    this.stateRef = ref;
    this.previousState = this.state;
    this.state = ref;
    this.stateSince = mirror?.tick ?? Number.NEGATIVE_INFINITY;
  }

  private anchor(): FigureAnchor | undefined {
    const mirror = this.ctx.mirror;
    if (mirror === undefined) return undefined;
    const attachment = mirror.peek(this.id, 'figureAttachment') as FigureAttachmentData | undefined;
    if (attachment !== undefined && mirror.peek(this.id, 'parent') !== undefined) {
      return attachment.anchor ?? 'origin';
    }
    const mounted = mirror.peek(this.id, 'mounted') as { vehicle?: string } | undefined;
    if (mounted?.vehicle === undefined) return undefined;
    if (mirror.peek(mounted.vehicle, 'figure') !== undefined) return 'pelvis';
    return mirror.peek(mounted.vehicle, 'vehicle') !== undefined ? 'eye' : 'pelvis';
  }

  private lookTarget(intent: FigureIntentData | undefined): Vec3 | undefined {
    const mirror = this.ctx.mirror;
    if (intent?.lookAt === undefined || mirror === undefined) return undefined;
    const transform = mirror.peek(this.id, 'transform') as TransformLike | undefined;
    if (transform === undefined) return undefined;
    let point: Vec3 | undefined;
    if ('pos' in intent.lookAt) point = intent.lookAt.pos;
    else point = (mirror.peek(intent.lookAt.entity, 'transform') as TransformLike | undefined)?.pos;
    return point === undefined ? undefined : worldToFigure(transform, point);
  }

  setTick(tick: number, tickRate: number, view: KindView | undefined): void {
    if (this.refreshDescriptor()) this.rebuild(this.chooseTier(view));
    if (this.rig === undefined || this.mesh === undefined) return;
    const tier = this.chooseTier(view);
    if (tier !== this.tier) this.rebuild(tier);
    if (this.mesh === undefined || this.mesh.bones.length === 0) return;
    this.refreshState();
    // A state written on tick T describes motion from T on; render ticks before T (the
    // interpolation delay) still see the previous state so poses and transforms agree.
    const state = tick < this.stateSince ? (this.previousState ?? this.state) : this.state;
    const intent = this.ctx.mirror?.peek(this.id, 'figureIntent') as FigureIntentData | undefined;
    const lookWeight =
      state?.lookAtTick !== undefined ? dmath.smoothstep((tick - state.lookAtTick) / 12) : 1;
    this.pose = evaluatePose(
      this.rig,
      state,
      tick,
      {
        tickRate,
        seed: this.seed,
        blendTicks: this.blendTicks,
        lookTarget: this.lookTarget(intent),
        lookWeight,
        overrides: intent?.overrides,
        ik: intent?.ik,
        anchor: this.anchor(),
      },
      this.pose,
    );
    applyPose(this.pose, this.mesh.bones);
  }

  dispose(): void {
    if (this.mesh !== undefined) {
      this.mesh.dispose();
      this.mesh = undefined;
    }
    if (this.cached !== undefined) {
      this.cache.release(this.cached.key);
      this.cached = undefined;
    }
  }
}

/** The `figure` renderable kind for `ClientOptions.kinds`. */
export function figureKind(options: FigureKindOptions = {}): RenderableKind {
  const cache = new FigureGeometryCache();
  const material =
    options.material ??
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  return {
    kind: 'figure',
    identity: (renderable) => `${renderable.ref}|${String(lodOf(renderable))}`,
    create: (id, renderable, ctx) =>
      new FigureHandle(id, renderable, ctx, cache, material, options),
    dispose: () => {
      cache.dispose();
      if (options.material === undefined) material.dispose();
    },
  };
}
