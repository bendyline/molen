import type { JsonObject } from '@bendyline/molen-schema';

/**
 * A typed handle over a wire-string component name. Strings on the wire, types in code.
 * `defineComponent` is metadata only — there is no class instantiation anywhere; components
 * are pure JSON data (the shipped vocabulary is docs-src/schemas/components.md).
 */
export interface ComponentType<T extends JsonObject> {
  readonly name: string;
  readonly defaults?: () => T;
  /** Phantom marker for the component's value type; never present at runtime. */
  readonly __type?: T;
}

// Module-level defaults registry: `world.spawn` merges a component's defaults under authored
// data. defineComponent without defaults never conflicts (script bridges create bare handles);
// two packages claiming the same name WITH different defaults would be a silent data hazard.
const defaultsRegistry = new Map<string, () => JsonObject>();

export function defineComponent<T extends JsonObject>(
  name: string,
  opts?: { defaults?: () => T },
): ComponentType<T> {
  if (name.length === 0) throw new Error('component name must be non-empty');
  if (opts?.defaults !== undefined) {
    const existing = defaultsRegistry.get(name);
    if (existing !== undefined && existing !== (opts.defaults as () => JsonObject)) {
      throw new Error(`component "${name}" already has registered defaults`);
    }
    defaultsRegistry.set(name, opts.defaults as () => JsonObject);
  }
  return { name, ...(opts?.defaults ? { defaults: opts.defaults } : {}) };
}

/** The registered defaults factory for a component name (from any defineComponent call). */
export function componentDefaults(name: string): (() => JsonObject) | undefined {
  return defaultsRegistry.get(name);
}

/** @internal Copy package defaults when a world is constructed. */
export function snapshotComponentDefaults(): ReadonlyMap<string, () => JsonObject> {
  return new Map(defaultsRegistry);
}

const handleCache = new Map<string, ComponentType<JsonObject>>();

/**
 * A memoized bare handle for a wire-string component name (no defaults). The string-based
 * surfaces (scripts, tweens, data-driven systems) use this so they never allocate a handle per
 * call.
 */
export function componentHandle(name: string): ComponentType<JsonObject> {
  let c = handleCache.get(name);
  if (c === undefined) {
    c = defineComponent<JsonObject>(name);
    handleCache.set(name, c);
  }
  return c;
}

// Core components shipped by the kernel. Everything else comes from plugins or user content.

export interface TransformData extends JsonObject {
  pos: [number, number, number];
  rot: [number, number, number, number];
  scale?: [number, number, number];
}

export interface LifetimeData extends JsonObject {
  ticksLeft: number;
}

export const Transform: ComponentType<TransformData> = defineComponent<TransformData>('transform', {
  defaults: () => ({ pos: [0, 0, 0], rot: [0, 0, 0, 1] }),
});

export const Lifetime: ComponentType<LifetimeData> = defineComponent<LifetimeData>('lifetime');
