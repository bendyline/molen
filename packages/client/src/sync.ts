import type {
  ComponentMap,
  Delta,
  EntityId,
  JsonObject,
  Keyframe,
  ModelSignalSpec,
  Quat,
  Vec3,
} from '@bendyline/molen-schema';
import type { InterpTransform } from './interpolation';
import { type ModelSignals, readModelSignals } from './model-signals';

/** The render contract component (docs-src/schemas/components.md, `renderable`). */
export interface Renderable {
  kind: 'primitive' | 'gltf' | (string & {});
  ref: string; // primitive name ("box"/"sphere"/...) or gltf asset id / URL-ish path
  materialRef?: string; // e.g. "palette:#rrggbb"
  primitive?: { size?: Vec3 };
  /** gltf: named sub-node to instance (default: the whole scene). */
  node?: string;
  visible?: boolean;
  shadows?: { cast?: boolean; receive?: boolean };
  /** gltf clip playback; clip time derives deterministically from startTick in captures. */
  animation?: {
    clip: string;
    speed?: number;
    loop?: 'repeat' | 'once' | 'pingpong';
    paused?: boolean;
    /** Simulation tick held while paused (default startTick). */
    pausedAtTick?: number;
    startTick?: number;
  };
}

/** A light source component at the entity transform (mirrors the schema `light` component). */
export interface LightData {
  type: 'directional' | 'point' | 'spot';
  color?: string;
  intensity?: number;
  range?: number;
  angleDeg?: number;
  penumbra?: number;
  castShadow?: boolean;
}

/** A backend that owns actual scene-graph objects (three.js, or a mock in tests). */
export interface SceneBackend {
  create(id: EntityId, renderable: Renderable): void;
  updateRenderable(id: EntityId, renderable: Renderable): void;
  destroy(id: EntityId): void;
  setTransform(id: EntityId, transform: InterpTransform): void;
  setModelSignals?(id: EntityId, spec: ModelSignalSpec | undefined, signals: ModelSignals): void;
  /** Optional light surface (per-entity `light` components). */
  createLight?(id: EntityId, light: LightData): void;
  updateLight?(id: EntityId, light: LightData): void;
  destroyLight?(id: EntityId): void;
  /** Optional environment surface (the singleton `environment` component, or undefined). */
  setEnvironment?(env: Record<string, unknown> | undefined): void;
  /** Physical and visual weather singleton; independent of environment/sky configuration. */
  setWeather?(weather: Record<string, unknown> | undefined): void;
}

function applyDeltaToMirror(mirror: Map<EntityId, ComponentMap>, delta: Delta): void {
  for (const [id, comps] of Object.entries(delta.spawned)) mirror.set(id, structuredClone(comps));
  for (const [id, comps] of Object.entries(delta.changed)) {
    const bucket = mirror.get(id) ?? {};
    for (const [name, data] of Object.entries(comps)) if (data !== undefined) bucket[name] = data;
    mirror.set(id, bucket);
  }
  for (const [id, names] of Object.entries(delta.removedComponents)) {
    const bucket = mirror.get(id);
    if (bucket !== undefined) for (const n of names) delete bucket[n];
  }
  for (const id of delta.destroyed) mirror.delete(id);
}

function readTransform(components: ComponentMap): InterpTransform | undefined {
  const t = components.transform as
    | { pos?: Vec3; rot?: Quat; scale?: Vec3; teleport?: boolean }
    | undefined;
  if (t?.pos === undefined) return undefined;
  return {
    pos: t.pos,
    rot: t.rot ?? [0, 0, 0, 1],
    ...(t.scale ? { scale: t.scale } : {}),
    ...(t.teleport === true ? { teleport: true } : {}),
  };
}

function readRenderable(components: ComponentMap): Renderable | undefined {
  const r = components.renderable as Renderable | undefined;
  if (r?.kind === undefined || r.ref === undefined) return undefined;
  return r;
}

/**
 * Maintains a client-side mirror of kernel entities and reconciles renderable bindings against
 * a SceneBackend (create / updateRenderable / destroy). Pure aside from the backend calls, so
 * it is unit-testable with a mock backend.
 *
 * Reconciliation is incremental: a delta marks the ids it touched dirty and `reconcile` visits
 * only those (a keyframe forces a full pass), so a 1000-entity scene with one moving entity
 * serializes one renderable per message, not a thousand.
 */
export class SceneMirror {
  private readonly mirror = new Map<EntityId, ComponentMap>();
  private readonly bound = new Map<EntityId, string>(); // id -> serialized renderable
  private readonly boundLights = new Map<EntityId, string>(); // id -> serialized light
  private boundEnvironment: string | undefined;
  private environmentOwner: EntityId | undefined;
  private boundWeather: string | undefined;
  private weatherOwner: EntityId | undefined;
  private currentTick: number | undefined;
  /** Ids touched since the last reconcile (spawned/changed/removedComponents/destroyed). */
  private readonly dirty = new Set<EntityId>();
  /** Set by a keyframe: the next reconcile must visit everything. */
  private full = false;
  private visited = 0;

  applyKeyframe(keyframe: Keyframe): void {
    this.mirror.clear();
    for (const [id, comps] of Object.entries(keyframe.entities)) {
      this.mirror.set(id, structuredClone(comps));
    }
    this.currentTick = keyframe.tick;
    this.full = true;
    this.dirty.clear();
  }

  /** Apply only a contiguous delta; false means the caller must request a fresh keyframe. */
  applyDelta(delta: Delta): boolean {
    if (this.currentTick === undefined || delta.baseTick !== this.currentTick) return false;
    applyDeltaToMirror(this.mirror, delta);
    for (const id of Object.keys(delta.spawned)) this.dirty.add(id);
    for (const id of Object.keys(delta.changed)) this.dirty.add(id);
    for (const id of Object.keys(delta.removedComponents)) this.dirty.add(id);
    for (const id of delta.destroyed) this.dirty.add(id);
    this.currentTick = delta.tick;
    return true;
  }

  /** Extract the transforms present in the mirror (for the interpolation buffer). */
  transforms(): Map<EntityId, InterpTransform> {
    const out = new Map<EntityId, InterpTransform>();
    for (const [id, comps] of this.mirror) {
      const t = readTransform(comps);
      if (t !== undefined) out.set(id, t);
    }
    return out;
  }

  /** Extract only transform changes (including removals), before reconciliation clears dirty ids. */
  transformChanges(delta: Delta): Map<EntityId, InterpTransform | undefined> {
    const ids = new Set(Object.keys(delta.spawned));
    for (const [id, components] of Object.entries(delta.changed))
      if (components.transform !== undefined) ids.add(id);
    for (const [id, names] of Object.entries(delta.removedComponents))
      if (names.includes('transform')) ids.add(id);
    for (const id of delta.destroyed) ids.add(id);
    return new Map([...ids].map((id) => [id, readTransform(this.mirror.get(id) ?? {})]));
  }

  /** How many entity ids the last `reconcile` examined (all of them after a keyframe). */
  get lastReconcileVisited(): number {
    return this.visited;
  }

  /** Create/update/destroy backend objects so they match the mirror's renderables. */
  reconcile(backend: SceneBackend): void {
    const full = this.full;
    if (full) {
      this.visited = this.mirror.size;
      for (const id of this.mirror.keys()) this.reconcileRenderable(backend, id);
      // Destroy bindings whose entity is gone.
      for (const id of [...this.bound.keys()]) {
        if (!this.mirror.has(id)) this.reconcileRenderable(backend, id);
      }
    } else {
      this.visited = this.dirty.size;
      for (const id of this.dirty) this.reconcileRenderable(backend, id);
    }

    this.reconcileLights(backend, full);
    this.reconcileEnvironment(backend, full);
    this.reconcileWeather(backend, full);
    this.dirty.clear();
    this.full = false;
  }

  /** Bring one id's renderable binding in line with the mirror (absent entity -> destroy). */
  private reconcileRenderable(backend: SceneBackend, id: EntityId): void {
    const comps = this.mirror.get(id);
    const renderable = comps === undefined ? undefined : readRenderable(comps);
    if (renderable === undefined) {
      if (this.bound.has(id)) {
        backend.destroy(id);
        this.bound.delete(id);
      }
      return;
    }
    const key = JSON.stringify(renderable);
    const prev = this.bound.get(id);
    if (prev === undefined) {
      backend.create(id, renderable);
      this.bound.set(id, key);
    } else if (prev !== key) {
      backend.updateRenderable(id, renderable);
      this.bound.set(id, key);
    }
    if (backend.setModelSignals) {
      const spec = comps?.['model.signals'] as ModelSignalSpec | undefined;
      backend.setModelSignals(
        id,
        spec,
        readModelSignals(spec?.sources, (name) => comps?.[name]),
      );
    }
  }

  private reconcileLights(backend: SceneBackend, full: boolean): void {
    if (backend.createLight === undefined) return;
    if (full) {
      for (const id of this.mirror.keys()) this.reconcileLight(backend, id);
      for (const id of [...this.boundLights.keys()]) {
        if (!this.mirror.has(id)) this.reconcileLight(backend, id);
      }
    } else {
      for (const id of this.dirty) this.reconcileLight(backend, id);
    }
  }

  private reconcileLight(backend: SceneBackend, id: EntityId): void {
    const light = this.mirror.get(id)?.light as LightData | undefined;
    if (light?.type === undefined) {
      if (this.boundLights.has(id)) {
        backend.destroyLight?.(id);
        this.boundLights.delete(id);
      }
      return;
    }
    const key = JSON.stringify(light);
    const prev = this.boundLights.get(id);
    if (prev === undefined) {
      backend.createLight?.(id, light);
      this.boundLights.set(id, key);
    } else if (prev !== key) {
      backend.updateLight?.(id, light);
      this.boundLights.set(id, key);
    }
  }

  private reconcileEnvironment(backend: SceneBackend, full: boolean): void {
    if (backend.setEnvironment === undefined) return;
    if (!full && !this.environmentTouched()) return;
    // Singleton by convention: the first entity (in mirror order) carrying `environment`.
    let env: Record<string, unknown> | undefined;
    let owner: EntityId | undefined;
    for (const [id, comps] of this.mirror) {
      if (comps.environment !== undefined) {
        env = comps.environment as Record<string, unknown>;
        owner = id;
        break;
      }
    }
    this.environmentOwner = owner;
    const key = env !== undefined ? JSON.stringify(env) : undefined;
    if (key !== this.boundEnvironment) {
      backend.setEnvironment(env);
      this.boundEnvironment = key;
    }
  }

  private reconcileWeather(backend: SceneBackend, full: boolean): void {
    if (!backend.setWeather) return;
    if (
      !full &&
      !(this.weatherOwner !== undefined && this.dirty.has(this.weatherOwner)) &&
      ![...this.dirty].some((id) => this.mirror.get(id)?.weather !== undefined)
    )
      return;
    let weather: Record<string, unknown> | undefined;
    this.weatherOwner = undefined;
    for (const [id, components] of this.mirror) {
      if (components.weather === undefined) continue;
      weather = components.weather as Record<string, unknown>;
      this.weatherOwner = id;
      break;
    }
    const key = weather === undefined ? undefined : JSON.stringify(weather);
    if (key !== this.boundWeather) {
      backend.setWeather(weather);
      this.boundWeather = key;
    }
  }

  /** Did this batch of dirty ids touch the current owner, or introduce another `environment`? */
  private environmentTouched(): boolean {
    if (this.environmentOwner !== undefined && this.dirty.has(this.environmentOwner)) return true;
    for (const id of this.dirty) {
      if (this.mirror.get(id)?.environment !== undefined) return true;
    }
    return false;
  }

  boundIds(): EntityId[] {
    return [...this.bound.keys()];
  }

  get tick(): number | undefined {
    return this.currentTick;
  }

  has(id: EntityId): boolean {
    return this.mirror.has(id);
  }

  /** A detached copy of one component of a mirrored entity (undefined when absent). */
  get(id: EntityId, component: string): JsonObject | undefined {
    const data = this.mirror.get(id)?.[component];
    return data === undefined ? undefined : structuredClone(data);
  }

  /**
   * The stored component object (no copy) for renderers that sample every frame: treat it as
   * frozen. Its identity changes exactly when a delta or keyframe replaced it.
   */
  peek(id: EntityId, component: string): JsonObject | undefined {
    return this.mirror.get(id)?.[component];
  }

  /** Every mirrored entity id, in creation order. */
  entities(): EntityId[] {
    return [...this.mirror.keys()];
  }

  /** The component names an entity currently carries. */
  components(id: EntityId): string[] {
    const bucket = this.mirror.get(id);
    return bucket === undefined ? [] : Object.keys(bucket);
  }
}
