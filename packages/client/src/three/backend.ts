import type { EntityId, ModelSignalSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { AssetCache } from '../assets';
import type { InterpTransform } from '../interpolation';
import {
  createModelSignalVisual,
  type ModelSignals,
  type ModelSignalVisual,
} from '../model-signals';
import type { LightData, Renderable, SceneBackend } from '../sync';
import { applyEnvironment, defaultEnvironment, type EnvironmentData } from './environment';
import type { KindContext, KindHandle, MirrorReader, RenderableKind } from './kinds';
import { MaterialResolver } from './materials';
import type { Renderer } from './renderer';
import { type StaticBatchOptions, StaticMeshBatches } from './static-batches';

export interface SceneOptimizationOptions {
  shaderWarmup?: boolean;
  staticInstancing?: boolean | StaticBatchOptions;
  /** Live-only pose throttling. Captures continue to sample exact simulation ticks. */
  animation?: { distantDistance?: number; distantHz?: number; hiddenHz?: number } | false;
  /** Local lights beyond this count are ranked by influence; unlimited by default. */
  maxLocalLights?: number;
}

/** Validate before allocating client resources. */
export function validateSceneOptimizationOptions(
  optimization: SceneOptimizationOptions = {},
): void {
  const animation = optimization.animation;
  if (
    animation &&
    [animation.distantHz, animation.hiddenHz].some(
      (value) => value !== undefined && (!Number.isFinite(value) || value <= 0),
    )
  )
    throw new RangeError('Animation sample rates must be finite and positive');
  if (
    animation &&
    animation.distantDistance !== undefined &&
    (!Number.isFinite(animation.distantDistance) || animation.distantDistance < 0)
  )
    throw new RangeError('Animation distance must be finite and nonnegative');
  if (
    optimization.maxLocalLights !== undefined &&
    (!Number.isSafeInteger(optimization.maxLocalLights) || optimization.maxLocalLights < 0)
  )
    throw new RangeError('Local light limit must be a nonnegative integer');
}

/** Cache key of a primitive's geometry: every entity with the same key shares one buffer. */
function geometryKey(r: Renderable): string {
  return `${r.ref}|${JSON.stringify(r.primitive?.size ?? null)}`;
}

/** Cache-miss factory for primitive geometry (see `ThreeSceneBackend.acquireGeometry`). */
function buildGeometry(renderable: Renderable): THREE.BufferGeometry {
  const size = renderable.primitive?.size ?? [1, 1, 1];
  switch (renderable.ref) {
    case 'box':
      return new THREE.BoxGeometry(size[0], size[1], size[2]);
    case 'sphere':
      return new THREE.SphereGeometry(size[0] / 2, 24, 16);
    case 'plane':
      return new THREE.PlaneGeometry(size[0], size[2]);
    case 'cylinder':
      return new THREE.CylinderGeometry(size[0] / 2, size[0] / 2, size[1], 24);
    default:
      return new THREE.BoxGeometry(size[0], size[1], size[2]);
  }
}

/** Deterministic clip time from kernel tick (the capture path's animation contract). */
export function computeClipTime(
  anim: NonNullable<Renderable['animation']>,
  tick: number,
  tickRate: number,
  durationSec: number,
): number {
  const speed = anim.speed ?? 1;
  const at = anim.paused === true ? (anim.pausedAtTick ?? anim.startTick ?? 0) : tick;
  const raw = Math.max(0, (at - (anim.startTick ?? 0)) / tickRate) * speed;
  if (durationSec <= 0) return 0;
  switch (anim.loop ?? 'repeat') {
    case 'once':
      return Math.max(0, Math.min(raw, durationSec));
    case 'pingpong': {
      const phase = ((raw % (durationSec * 2)) + durationSec * 2) % (durationSec * 2);
      return phase <= durationSec ? phase : durationSec * 2 - phase;
    }
    default:
      return ((raw % durationSec) + durationSec) % durationSec;
  }
}

/**
 * The identity part of a renderable: same identity -> in-place update, no reload. A primitive's
 * material is NOT part of its identity (it swaps in place); a glTF's is, because the instance's
 * original materials cannot be restored once dressed.
 */
function renderableIdentity(r: Renderable): string {
  if (r.kind === 'gltf') return `gltf|${r.ref}|${r.node ?? ''}|${r.materialRef ?? ''}`;
  return `primitive|${geometryKey(r)}`;
}

interface GltfBinding {
  /** Staleness token: bumps on destroy/replace so a late async load attaches nothing. */
  token: number;
  mixer?: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  action?: THREE.AnimationAction;
  clipDuration: number;
  animation?: Renderable['animation'];
}

interface GeometryEntry {
  geometry: THREE.BufferGeometry;
  refs: number;
}

function buildLight(light: LightData): THREE.Light {
  const color = new THREE.Color(light.color ?? '#ffffff');
  const intensity = light.intensity ?? 1;
  switch (light.type) {
    case 'point':
      return new THREE.PointLight(color, intensity, light.range ?? 0);
    case 'spot': {
      const spot = new THREE.SpotLight(
        color,
        intensity,
        light.range ?? 0,
        ((light.angleDeg ?? 45) * Math.PI) / 180,
        light.penumbra ?? 0,
      );
      return spot;
    }
    default:
      return new THREE.DirectionalLight(color, intensity);
  }
}

/** three.js implementation of the SceneBackend: primitives + async glTF instances + lights. */
export class ThreeSceneBackend implements SceneBackend {
  private readonly batches: StaticMeshBatches | undefined;
  private readonly batchDirty = new Set<EntityId>();
  private readonly dynamic = new Set<EntityId>();
  private readonly escaped = new Set<EntityId>();
  private readonly transformed = new Set<EntityId>();
  private readonly animations = new Set<EntityId>();
  private readonly lastPoseTick = new Map<EntityId, number>();
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  private animationTick = 0;
  private animationTickRate = 30;
  private readonly objects = new Map<EntityId, THREE.Object3D>();
  private readonly gltf = new Map<EntityId, GltfBinding>();
  private readonly modelSignals = new Map<
    EntityId,
    {
      key: string;
      spec: ModelSignalSpec;
      signals: ModelSignals;
      visual?: ModelSignalVisual;
    }
  >();
  private readonly identities = new Map<EntityId, string>();
  private readonly lights = new Map<EntityId, THREE.Light>();
  /** Refcounted primitive geometry, keyed by `geometryKey`; disposed when the count hits 0. */
  private readonly geometries = new Map<string, GeometryEntry>();
  private readonly entityGeometry = new Map<EntityId, string>();
  /** The one resolver-owned material each entity currently holds a reference on. */
  private readonly entityMaterial = new Map<EntityId, THREE.Material>();
  private readonly entityMaterialRef = new Map<EntityId, string | undefined>();
  /** Bumps on every material assignment/destroy so a late bake never overwrites a newer one. */
  private readonly materialEpoch = new Map<EntityId, number>();
  private epochSeq = 0;
  private warnedNoAssets = false;
  /** Custom renderable kinds and the per-entity handles they created. */
  private readonly kinds = new Map<string, RenderableKind>();
  private readonly handles = new Map<EntityId, KindHandle>();
  private readonly warnedKinds = new Set<string>();
  private mirror: MirrorReader | undefined;
  /** Async work registered by kinds that the capture barrier waits for. */
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly assets: AssetCache | undefined = undefined,
    private readonly renderer: Renderer | undefined = undefined,
    private readonly materials: MaterialResolver = new MaterialResolver(),
    private readonly optimization: SceneOptimizationOptions = {},
  ) {
    validateSceneOptimizationOptions(optimization);
    if (optimization.staticInstancing !== false)
      this.batches = new StaticMeshBatches(
        scene,
        typeof optimization.staticInstancing === 'object' ? optimization.staticInstancing : {},
        renderer && optimization.shaderWarmup !== false
          ? (object) => renderer.prepareObject(object)
          : undefined,
      );
  }

  /** Register a custom renderable kind (capability client halves). Core kinds cannot be replaced. */
  registerKind(kind: RenderableKind): void {
    if (kind.kind === 'primitive' || kind.kind === 'gltf') {
      throw new Error(`renderable kind "${kind.kind}" is built in`);
    }
    if (this.kinds.has(kind.kind))
      throw new Error(`renderable kind "${kind.kind}" is already registered`);
    this.kinds.set(kind.kind, kind);
  }

  /** Give custom kinds read access to the mirrored components (no per-frame cloning). */
  bindMirror(reader: MirrorReader): void {
    this.mirror = reader;
  }

  private identityOf(r: Renderable): string {
    const kind = this.kinds.get(r.kind);
    if (kind !== undefined) return `${r.kind}|${kind.identity(r)}`;
    return renderableIdentity(r);
  }

  private kindContext(): KindContext {
    const backend = this;
    return {
      scene: this.scene,
      renderer: this.renderer,
      assets: this.assets,
      materials: this.materials,
      get mirror() {
        return backend.mirror;
      },
      track: <T>(promise: Promise<T>): Promise<T> => {
        const tracked: Promise<T> = promise.then(
          (value) => {
            this.pending.delete(tracked);
            return value;
          },
          (error: unknown) => {
            this.pending.delete(tracked);
            throw error;
          },
        );
        this.pending.add(tracked);
        this.assets?.track(tracked);
        return tracked;
      },
      warn: (message) => console.warn(`[molen] ${message}`),
    };
  }

  private createKind(id: EntityId, renderable: Renderable): void {
    const kind = this.kinds.get(renderable.kind);
    if (kind === undefined) {
      if (!this.warnedKinds.has(renderable.kind)) {
        this.warnedKinds.add(renderable.kind);
        console.warn(
          `[molen] renderable kind "${renderable.kind}" has no registered renderer (ClientOptions.kinds); entities of this kind render nothing`,
        );
      }
      const group = new THREE.Group();
      group.name = id;
      group.visible = renderable.visible !== false;
      this.scene.add(group);
      this.objects.set(id, group);
      return;
    }
    const handle = kind.create(id, renderable, this.kindContext());
    const object = handle.object;
    object.name = id;
    object.visible = renderable.visible !== false;
    ThreeSceneBackend.applyShadows(object, renderable);
    this.scene.add(object);
    this.objects.set(id, object);
    this.handles.set(id, handle);
  }

  /** Apply a resolved material to every mesh under an object. */
  private static dressMeshes(root: THREE.Object3D, material: THREE.Material): void {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) (obj as THREE.Mesh).material = material;
    });
  }

  private acquireGeometry(id: EntityId, renderable: Renderable): THREE.BufferGeometry {
    const key = geometryKey(renderable);
    let entry = this.geometries.get(key);
    if (entry === undefined) {
      entry = { geometry: buildGeometry(renderable), refs: 0 };
      this.geometries.set(key, entry);
    }
    entry.refs++;
    this.entityGeometry.set(id, key);
    return entry.geometry;
  }

  private releaseGeometry(id: EntityId): void {
    const key = this.entityGeometry.get(id);
    if (key === undefined) return;
    this.entityGeometry.delete(id);
    const entry = this.geometries.get(key);
    if (entry === undefined) return;
    entry.refs--;
    if (entry.refs <= 0) {
      entry.geometry.dispose();
      this.geometries.delete(key);
    }
  }

  /** Hand an already-acquired material to an entity, releasing whatever it held before. */
  private assignMaterial(id: EntityId, target: THREE.Object3D, material: THREE.Material): void {
    this.batches?.remove(id);
    const previous = this.entityMaterial.get(id);
    if (previous !== undefined) this.materials.release(previous);
    this.entityMaterial.set(id, material);
    this.materialEpoch.set(id, ++this.epochSeq);
    ThreeSceneBackend.dressMeshes(target, material);
    this.batchDirty.add(id);
  }

  private releaseMaterial(id: EntityId): void {
    const material = this.entityMaterial.get(id);
    if (material !== undefined) this.materials.release(material);
    this.entityMaterial.delete(id);
    this.entityMaterialRef.delete(id);
    this.materialEpoch.delete(id);
  }

  /**
   * Resolve `materialRef` onto `target`: the sync material (palette, or the shared grey
   * placeholder) immediately, then the baked one once an async ref finishes. Refcounts are
   * balanced at every step so shared placeholders are never disposed out from under others.
   */
  private bindMaterial(
    id: EntityId,
    target: THREE.Object3D,
    materialRef: string | undefined,
  ): void {
    this.entityMaterialRef.set(id, materialRef);
    this.assignMaterial(id, target, this.materials.acquireSync(materialRef));
    if (!this.materials.isAsync(materialRef)) return;
    const epoch = this.materialEpoch.get(id);
    const swap = this.materials.acquire(materialRef as string).then((material) => {
      // A destroy/replace/swap moves the epoch; only dress if ours is still the current one.
      if (this.materialEpoch.get(id) === epoch) this.assignMaterial(id, target, material);
      else this.materials.release(material);
    });
    this.assets?.track(swap);
  }

  private static applyShadows(root: THREE.Object3D, renderable: Renderable): void {
    const cast = renderable.shadows?.cast;
    const receive = renderable.shadows?.receive;
    root.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      obj.castShadow = cast ?? false;
      obj.receiveShadow = receive ?? false;
    });
  }

  create(id: EntityId, renderable: Renderable): void {
    this.identities.set(id, this.identityOf(renderable));
    if (renderable.kind !== 'gltf' && renderable.kind !== 'primitive') {
      this.createKind(id, renderable);
      return;
    }
    if (renderable.kind === 'gltf') {
      this.createGltf(id, renderable);
      return;
    }
    const mesh = new THREE.Mesh(this.acquireGeometry(id, renderable));
    this.bindMaterial(id, mesh, renderable.materialRef);
    mesh.visible = renderable.visible !== false;
    mesh.name = id;
    ThreeSceneBackend.applyShadows(mesh, renderable);
    this.scene.add(mesh);
    this.objects.set(id, mesh);
    this.batchDirty.add(id);
  }

  private createGltf(id: EntityId, renderable: Renderable): void {
    // Placeholder immediately (transforms keep applying); real subtree swaps in on load.
    const group = new THREE.Group();
    group.name = id;
    group.visible = renderable.visible !== false;
    this.scene.add(group);
    this.objects.set(id, group);

    if (this.assets === undefined) {
      if (!this.warnedNoAssets) {
        this.warnedNoAssets = true;
        console.warn(
          `[molen] renderable kind "gltf" needs an asset provider (ClientOptions.assets) — "${renderable.ref}" renders nothing`,
        );
      }
      return;
    }
    const binding: GltfBinding = {
      token: 0,
      clips: [],
      clipDuration: 0,
      animation: renderable.animation,
    };
    this.gltf.set(id, binding);
    const token = binding.token;
    const attach = this.assets
      .instance(renderable.ref, renderable.node)
      .then(async ({ scene: instance, clips }) => {
        const current = this.gltf.get(id);
        const disposeSkeletons = (): void =>
          instance.traverse((child) => {
            if ((child as THREE.SkinnedMesh).isSkinnedMesh)
              (child as THREE.SkinnedMesh).skeleton.dispose();
          });
        if (current !== binding || binding.token !== token) {
          disposeSkeletons();
          return;
        }
        if (renderable.materialRef !== undefined) {
          this.bindMaterial(id, instance, renderable.materialRef);
        }
        ThreeSceneBackend.applyShadows(instance, renderable);
        if (this.renderer && this.optimization.shaderWarmup !== false) {
          try {
            await this.renderer.prepareObject(instance);
          } catch (error) {
            disposeSkeletons();
            throw error;
          }
        }
        if (this.gltf.get(id) !== binding || binding.token !== token) {
          disposeSkeletons();
          return;
        }
        group.add(instance);
        binding.clips = clips;
        this.bindModelSignals(id, instance);
        this.applyAnimation(id, binding, instance);
        this.applyModelSignals(id);
        this.batchDirty.add(id);
      })
      .catch((e: unknown) => {
        console.warn(`[molen] gltf "${renderable.ref}" failed to load: ${(e as Error).message}`);
      });
    // Captures wait for the entity instance to be attached, not merely for the shared glTF to
    // finish parsing. Without tracking this continuation, a one-frame render can observe the
    // placeholder group and report zero triangles.
    this.assets.track(attach);
  }

  private applyAnimation(id: EntityId, binding: GltfBinding, instance: THREE.Object3D): void {
    this.batches?.remove(id);
    this.animations.delete(id);
    this.lastPoseTick.delete(id);
    instance.traverse((object) => {
      object.matrixAutoUpdate = true;
    });
    const anim = binding.animation;
    binding.action?.stop();
    binding.action = undefined;
    binding.mixer = undefined;
    binding.clipDuration = 0;
    if (anim === undefined) return;
    const clip = binding.clips.find((c) => c.name === anim.clip);
    if (clip === undefined) {
      console.warn(`[molen] entity "${id}": gltf has no clip "${anim.clip}"`);
      return;
    }
    const mixer = new THREE.AnimationMixer(instance);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = 1;
    action.play();
    binding.mixer = mixer;
    binding.action = action;
    binding.clipDuration = clip.duration;
    this.animations.add(id);
    this.poseAnimation(binding);
  }

  updateRenderable(id: EntityId, renderable: Renderable): void {
    this.batches?.remove(id);
    this.batchDirty.add(id);
    const identity = this.identityOf(renderable);
    if (this.identities.get(id) === identity) {
      // Same geometry identity — in-place update (no destroy/recreate churn).
      const obj = this.objects.get(id);
      if (obj !== undefined) {
        obj.visible = renderable.visible !== false;
        ThreeSceneBackend.applyShadows(obj, renderable);
        this.handles.get(id)?.update(renderable);
        if (
          renderable.kind === 'primitive' &&
          this.entityMaterialRef.get(id) !== renderable.materialRef
        ) {
          this.bindMaterial(id, obj, renderable.materialRef);
        }
      }
      const binding = this.gltf.get(id);
      if (
        binding !== undefined &&
        JSON.stringify(binding.animation) !== JSON.stringify(renderable.animation)
      ) {
        binding.animation = renderable.animation;
        const instance = this.objects.get(id)?.children[0];
        if (instance !== undefined) {
          this.modelSignals.get(id)?.visual?.reset();
          this.applyAnimation(id, binding, instance);
          this.applyModelSignals(id);
        }
      }
      return;
    }
    this.destroy(id);
    this.create(id, renderable);
  }

  /** Latest mirrored values are retained while the model loads. No simulation state is changed. */
  setModelSignals(id: EntityId, spec: ModelSignalSpec | undefined, signals: ModelSignals): void {
    const previous = this.modelSignals.get(id);
    const key = spec === undefined ? undefined : JSON.stringify(spec);
    if (previous?.key === key) {
      if (previous) {
        previous.signals = signals;
        this.applyModelSignals(id);
      }
      return;
    }
    previous?.visual?.reset();
    this.modelSignals.delete(id);
    this.batches?.remove(id);
    this.batchDirty.add(id);
    if (spec !== undefined) {
      this.modelSignals.set(id, { key: key as string, spec, signals });
      const instance = this.gltf.has(id) ? this.objects.get(id)?.children[0] : undefined;
      if (instance) this.bindModelSignals(id, instance);
    } else {
      const animation = this.gltf.get(id);
      if (animation) {
        animation.action?.stop();
        this.poseAnimation(animation);
      }
    }
    this.applyModelSignals(id);
  }

  private bindModelSignals(id: EntityId, instance: THREE.Object3D): void {
    const state = this.modelSignals.get(id);
    if (!state) return;
    // Stopping restores the clip's original property values. A binding added during playback
    // must measure from the authored pose, not from whichever frame happened to be visible.
    const animation = this.gltf.get(id);
    animation?.action?.stop();
    state.visual = createModelSignalVisual(instance, state.spec);
    if (animation) this.poseAnimation(animation);
    if (state.visual.missingNodes.length)
      console.warn(
        `[molen] entity "${id}": model.signals missing nodes: ${state.visual.missingNodes.join(', ')}`,
      );
  }

  private applyModelSignals(id: EntityId): void {
    const state = this.modelSignals.get(id);
    state?.visual?.update(state.signals);
  }

  destroy(id: EntityId): void {
    this.modelSignals.delete(id);
    this.batches?.remove(id);
    this.batchDirty.delete(id);
    this.dynamic.delete(id);
    this.escaped.delete(id);
    this.transformed.delete(id);
    this.animations.delete(id);
    this.lastPoseTick.delete(id);
    const obj = this.objects.get(id);
    if (obj === undefined) return;
    this.scene.remove(obj);
    const handle = this.handles.get(id);
    if (handle !== undefined) {
      handle.dispose();
      this.handles.delete(id);
    }
    this.releaseGeometry(id);
    this.releaseMaterial(id);
    const binding = this.gltf.get(id);
    if (binding !== undefined) {
      binding.token++;
      binding.action?.stop();
      binding.mixer?.stopAllAction();
      obj.traverse((child) => {
        if ((child as THREE.SkinnedMesh).isSkinnedMesh)
          (child as THREE.SkinnedMesh).skeleton.dispose();
      });
    }
    this.gltf.delete(id);
    this.objects.delete(id);
    this.identities.delete(id);
  }

  setTransform(id: EntityId, t: InterpTransform): void {
    const obj = this.objects.get(id);
    if (obj !== undefined) {
      const scale = t.scale ?? [1, 1, 1];
      const changed =
        !obj.position.equals(new THREE.Vector3(...t.pos)) ||
        !obj.quaternion.equals(new THREE.Quaternion(...t.rot)) ||
        !obj.scale.equals(new THREE.Vector3(...scale));
      if (changed && this.transformed.has(id)) {
        this.dynamic.add(id);
        this.batches?.remove(id);
      }
      if (!this.transformed.has(id)) this.batchDirty.add(id);
      this.transformed.add(id);
      obj.position.set(t.pos[0], t.pos[1], t.pos[2]);
      obj.quaternion.set(t.rot[0], t.rot[1], t.rot[2], t.rot[3]);
      if (t.scale !== undefined) obj.scale.set(t.scale[0], t.scale[1], t.scale[2]);
      else obj.scale.set(1, 1, 1);
      if (changed || obj.matrixAutoUpdate) obj.updateMatrix();
      obj.matrixAutoUpdate = this.escaped.has(id);
    }
    const light = this.lights.get(id);
    if (light !== undefined) {
      light.position.set(t.pos[0], t.pos[1], t.pos[2]);
      light.updateMatrix();
      light.matrixAutoUpdate = false;
    }
  }

  /** Per-entity `light` components (directional/spot aim at the origin by default). */
  createLight(id: EntityId, data: LightData): void {
    const light = buildLight(data);
    light.name = `${id}$light`;
    light.castShadow = data.castShadow === true;
    this.scene.add(light);
    this.lights.set(id, light);
  }

  updateLight(id: EntityId, data: LightData): void {
    this.destroyLight(id);
    this.createLight(id, data);
  }

  destroyLight(id: EntityId): void {
    const light = this.lights.get(id);
    if (light === undefined) return;
    this.scene.remove(light);
    light.dispose();
    this.lights.delete(id);
  }

  /** The singleton `environment` component; undefined restores the default rig. */
  setEnvironment(env: Record<string, unknown> | undefined): void {
    if (this.renderer === undefined) return;
    applyEnvironment(this.renderer, (env as EnvironmentData | undefined) ?? defaultEnvironment);
  }

  setWeather(weather: Record<string, unknown> | undefined): void {
    this.renderer?.setWeather(weather as import('@bendyline/molen-schema').WeatherData | undefined);
  }

  /** Standalone preview clock; connected clients use setAnimationTick with the kernel clock. */
  tickAnimations(dtSec: number): void {
    this.setAnimationTick(
      this.animationTick + dtSec * this.animationTickRate,
      this.animationTickRate,
    );
  }

  private poseAnimation(binding: GltfBinding): void {
    if (
      binding.mixer === undefined ||
      binding.action === undefined ||
      binding.animation === undefined
    )
      return;
    binding.action.reset().play();
    binding.action.time = computeClipTime(
      binding.animation,
      this.animationTick,
      this.animationTickRate,
      binding.clipDuration,
    );
    binding.mixer.update(0);
  }

  /** Live and capture poses use the same simulation tick and no wall-clock accumulation. */
  setAnimationTick(tick: number, tickRate: number): void {
    this.renderer?.setEnvironmentTime(tick / tickRate);
    this.animationTick = tick;
    this.animationTickRate = tickRate;
    for (const id of this.animations) {
      const binding = this.gltf.get(id);
      if (binding) this.poseAnimation(binding);
      this.applyModelSignals(id);
    }
    for (const handle of this.handles.values()) handle.setTick?.(tick, tickRate, undefined);
  }

  /** Flush static membership only when bindings change; world-origin shifts move the common root. */
  prepareFrame(): void {
    for (const id of this.batchDirty) {
      const object = this.objects.get(id);
      if (!object || this.escaped.has(id) || this.handles.has(id)) continue;
      if (!this.animations.has(id) && !this.modelSignals.has(id))
        object.traverse((child) => {
          child.updateMatrix();
          child.matrixAutoUpdate = false;
        });
      if (!this.dynamic.has(id) && !this.animations.has(id) && !this.modelSignals.has(id))
        this.batches?.add(id, object);
    }
    this.batchDirty.clear();
    this.batches?.flush();
  }
  async whenReady(): Promise<void> {
    this.prepareFrame();
    await this.batches?.whenIdle();
    await Promise.all([...this.pending]);
  }

  /** Exact tick-derived poses on return to view; invisible shadow casters are never skipped. */
  updateLiveAnimations(tick: number, tickRate: number, camera: THREE.Camera): void {
    this.renderer?.setEnvironmentTime(tick / tickRate);
    this.animationTick = tick;
    this.animationTickRate = tickRate;
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(
      this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      camera.coordinateSystem,
      camera.reversedDepth,
    );
    const config = this.optimization.animation;
    for (const id of this.animations) {
      const binding = this.gltf.get(id),
        object = this.objects.get(id);
      if (!binding || !object) continue;
      let inView = false,
        shadows = false;
      object.updateWorldMatrix(true, true);
      object.traverseVisible((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          shadows ||= mesh.castShadow;
          inView ||= this.frustum.intersectsObject(mesh);
        }
      });
      const distance = object
        .getWorldPosition(new THREE.Vector3())
        .distanceTo(camera.getWorldPosition(new THREE.Vector3()));
      const hz =
        config === false || shadows || (inView && distance < (config?.distantDistance ?? 80))
          ? Infinity
          : inView
            ? (config?.distantHz ?? 15)
            : (config?.hiddenHz ?? 5);
      const previous = this.lastPoseTick.get(id);
      if (previous !== undefined && tick >= previous && (tick - previous) / tickRate < 1 / hz)
        continue;
      this.poseAnimation(binding);
      this.applyModelSignals(id);
      this.lastPoseTick.set(id, tick);
    }
    for (const [id, handle] of this.handles) {
      if (handle.setTick === undefined) continue;
      const object = handle.object;
      let inView = false;
      let shadows = false;
      object.updateWorldMatrix(true, true);
      object.traverseVisible((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          shadows ||= mesh.castShadow;
          inView ||= this.frustum.intersectsObject(mesh);
        }
      });
      const distance = object
        .getWorldPosition(new THREE.Vector3())
        .distanceTo(camera.getWorldPosition(new THREE.Vector3()));
      const distantDistance = config === false ? Infinity : (config?.distantDistance ?? 80);
      const hz =
        config === false || shadows || (inView && distance < distantDistance)
          ? Infinity
          : inView
            ? (config?.distantHz ?? 15)
            : (config?.hiddenHz ?? 5);
      const previous = this.lastPoseTick.get(id);
      if (previous !== undefined && tick >= previous && (tick - previous) / tickRate < 1 / hz)
        continue;
      handle.setTick(tick, tickRate, { distance, inView, shadows, distantDistance });
      this.lastPoseTick.set(id, tick);
    }
    this.updateLocalLights(camera);
  }

  private updateLocalLights(camera: THREE.Camera): void {
    const local: Array<{ light: THREE.PointLight | THREE.SpotLight; score: number }> = [];
    const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
    for (const light of this.lights.values()) {
      if (!(light instanceof THREE.PointLight || light instanceof THREE.SpotLight)) continue;
      light.updateWorldMatrix(true, false);
      const center = light.getWorldPosition(new THREE.Vector3());
      // A finite light outside the view cannot illuminate visible receivers in its sphere.
      const overlaps =
        light.distance === 0 ||
        this.frustum.intersectsSphere(new THREE.Sphere(center, light.distance));
      light.visible = overlaps;
      if (overlaps)
        local.push({
          light,
          score: light.intensity / Math.max(1, center.distanceToSquared(cameraPosition)),
        });
    }
    const cap = this.optimization.maxLocalLights;
    if (cap !== undefined) {
      local.sort((a, b) => b.score - a.score || a.light.id - b.light.id);
      for (let i = Math.max(0, Math.floor(cap)); i < local.length; i++)
        (local[i] as { light: THREE.Light }).light.visible = false;
    }
  }

  entityForIntersection(hit: THREE.Intersection): EntityId | undefined {
    const ids = hit.object.userData.molenEntityIds as EntityId[] | undefined;
    if (hit.instanceId !== undefined && ids) return ids[hit.instanceId];
    for (
      let object: THREE.Object3D | null = hit.object;
      object && object !== this.scene;
      object = object.parent
    )
      if (this.objects.get(object.name) === object) return object.name;
    return undefined;
  }

  count(): number {
    return this.objects.size;
  }

  dispose(): void {
    this.batches?.dispose();
    for (const id of [...this.objects.keys()]) this.destroy(id);
    for (const id of [...this.lights.keys()]) this.destroyLight(id);
    for (const kind of this.kinds.values()) kind.dispose?.();
    this.kinds.clear();
    // Every entity released above, so the caches are empty unless a count was unbalanced.
    for (const entry of this.geometries.values()) entry.geometry.dispose();
    this.geometries.clear();
    this.entityGeometry.clear();
    this.materials.dispose();
  }

  /**
   * Escape hatch: the raw three.js object for an entity (undefined if not created), for advanced
   * effects the wrapper doesn't cover. Unstable — you own whatever you mutate, and the backend may
   * recreate the object when the renderable changes.
   */
  getObject(id: EntityId): THREE.Object3D | undefined {
    this.escaped.add(id);
    this.batches?.remove(id);
    this.batches?.flush();
    const object = this.objects.get(id);
    object?.traverse((child) => {
      child.matrixAutoUpdate = true;
    });
    return object;
  }

  /** The three.js world root this backend writes into (escape hatch for custom objects/lights). */
  get threeScene(): THREE.Object3D {
    return this.scene;
  }
}
