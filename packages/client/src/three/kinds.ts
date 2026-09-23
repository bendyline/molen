import type { EntityId, JsonObject } from '@bendyline/molen-schema';
import type * as THREE from 'three';
import type { AssetCache } from '../assets';
import type { Renderable } from '../sync';
import type { MaterialResolver } from './materials';
import type { Renderer } from './renderer';

/**
 * Custom renderable kinds: a capability client half (figures, ...) registers how entities with
 * `renderable.kind === '<kind>'` become three.js objects. The backend keeps ownership of the
 * entity object (naming, world-root placement, interpolated transforms, visibility, shadows,
 * capture barriers) and hands the kind a handle per entity for everything else.
 */

/** Read-only view of the client's mirrored components, without per-frame cloning. */
export interface MirrorReader {
  readonly tick: number | undefined;
  /**
   * The stored component object, not a copy: treat it as frozen. Its identity changes exactly
   * when a delta or keyframe replaced it, so `peek(...) !== last` is a free change test.
   */
  peek(id: EntityId, component: string): JsonObject | undefined;
}

/** What the live frame loop knows about an entity when it samples its pose. */
export interface KindView {
  /** Distance from the camera to the entity origin, meters. */
  distance: number;
  inView: boolean;
  /** Whether any mesh of the entity casts shadows (never throttled). */
  shadows: boolean;
  /** The configured near/far animation distance. */
  distantDistance: number;
}

export interface KindContext {
  /** The world root the entity object lives under (floating origin included). */
  readonly scene: THREE.Object3D;
  readonly renderer: Renderer | undefined;
  readonly assets: AssetCache | undefined;
  readonly materials: MaterialResolver;
  /** Mirrored components (bound once the client connects; undefined in bare viewers). */
  readonly mirror: MirrorReader | undefined;
  /** Register async work the capture barrier (`client.ready()`) must wait for. */
  track<T>(promise: Promise<T>): Promise<T>;
  warn(message: string): void;
}

export interface KindHandle {
  /** The entity's root object; the backend names it, adds it to the scene and drives its transform. */
  readonly object: THREE.Object3D;
  /** The renderable changed without changing identity. */
  update(renderable: Renderable): void;
  /**
   * Sample the entity's pose at a simulation tick (fractional on the live path). `view` is
   * undefined on the capture path: exact tick, full detail, no throttling.
   */
  setTick?(tick: number, tickRate: number, view: KindView | undefined): void;
  dispose(): void;
}

export interface RenderableKind {
  readonly kind: string;
  /** The identity part of a renderable: a change rebuilds the object, otherwise `update` runs. */
  identity(renderable: Renderable): string;
  create(id: EntityId, renderable: Renderable, ctx: KindContext): KindHandle;
  /** Release kind-level shared resources (geometry caches, materials). */
  dispose?(): void;
}
