import type { ComponentMap, Delta, EntityId, JsonValue, Keyframe } from '@bendyline/molen-schema';
import { cloneJson } from './clone';
import { CONTENT_KEY, contentDrift, contentPlugin, keyframeContent } from './content';
import { hashJson } from './hash';
import { rngFromState } from './rng';
import { ENGINE_VERSION, STATE_FORMAT, STATE_FORMAT_KEY } from './version';
import { World, type WorldOptions } from './world';

function emptyRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

/** Capture entity/component data without changing dirty tracking. */
export function captureEntities(world: World): Record<EntityId, ComponentMap> {
  const entities = emptyRecord<ComponentMap>();
  const internal = world._internal();
  for (const id of internal.entities) entities[id] = emptyRecord<JsonValue>() as ComponentMap;
  for (const [name, store] of internal.stores) {
    for (const [id, data] of store) {
      let bucket = Object.hasOwn(entities, id) ? entities[id] : undefined;
      if (bucket === undefined) {
        bucket = emptyRecord<JsonValue>() as ComponentMap;
        entities[id] = bucket;
      }
      bucket[name] = cloneJson(data);
    }
  }
  return entities;
}

/**
 * Produce a complete keyframe of the world's current state (also the save-file format).
 * A keyframe is a complete baseline, so it resets delta dirty-tracking: the next takeDelta
 * reports only changes that happen after this keyframe.
 */
export function takeKeyframe(world: World): Keyframe {
  const internal = world._internal();
  const entities = captureEntities(world);
  const plugins = emptyRecord<JsonValue>();
  for (const [name, provider] of internal.snapshotProviders) plugins[name] = provider.save();
  // Reserved keys, written last so a plugin can never shadow them: the state format is what load
  // compares, while `engine` below is metadata for humans and bug reports. Content identity is
  // recorded the same way; neither enters stateHash, which reads only snapshot providers.
  const content = contentPlugin(world.content);
  if (content !== undefined) plugins[CONTENT_KEY] = content;
  plugins[STATE_FORMAT_KEY] = STATE_FORMAT;
  const keyframe: Keyframe = {
    kind: 'keyframe',
    v: 1,
    engine: ENGINE_VERSION,
    tick: internal.getTick(),
    tickRate: world.tickRate,
    seed: internal.seed,
    nextEntitySeq: internal.getNextSeq(),
    entityOrder: [...internal.entities],
    commands: internal.saveCommands(),
    rng: internal.getRng().save(),
    entities,
    plugins,
  };
  internal.clearDirty();
  return keyframe;
}

/**
 * The state format a keyframe was written in. Keyframes from before the format key existed
 * carry the layout it was introduced at (1), so they keep loading.
 */
export function keyframeStateFormat(keyframe: Keyframe): number {
  const value = keyframe.plugins?.[STATE_FORMAT_KEY];
  return typeof value === 'number' ? value : 1;
}

export interface ApplyKeyframeOptions {
  /**
   * Load even when the keyframe recorded different content than the world was built from
   * (default false: that is an error naming the domain and both hashes).
   */
  allowContentDrift?: boolean;
}

/**
 * Load a keyframe's state into an existing world in place (replacing entities, RNG, tick, and
 * counter), keeping its registered systems/commands. The replay scrubber uses this to seek.
 * Acceptance is gated on the STATE_FORMAT generation, never on the engine version, and on the
 * content both sides recorded.
 */
export function applyKeyframeTo(
  world: World,
  keyframe: Keyframe,
  options: ApplyKeyframeOptions = {},
): void {
  const internal = world._internal();
  // Gate on the state format, not the package version: a patch release that changes nothing
  // about the simulation must not invalidate every save file and recorded replay.
  const format = keyframeStateFormat(keyframe);
  if (format !== STATE_FORMAT) {
    throw new Error(
      `keyframe state format ${format} does not match ${STATE_FORMAT} (written by engine ${keyframe.engine ?? 'unknown'})`,
    );
  }
  if (keyframe.tickRate !== world.tickRate)
    throw new Error('keyframe tickRate does not match the target world');
  const recorded = keyframeContent(keyframe);
  if (recorded !== undefined && options.allowContentDrift !== true) {
    const drift = contentDrift(recorded, world.content);
    if (drift.length > 0) {
      throw new Error(
        `keyframe was saved with different content: ${drift.join('; ')}. Load the same packs, or pass allowContentDrift to load anyway.`,
      );
    }
  }
  const order = keyframe.entityOrder ?? Object.keys(keyframe.entities);
  if (
    new Set(order).size !== order.length ||
    order.length !== Object.keys(keyframe.entities).length ||
    order.some((id) => !Object.hasOwn(keyframe.entities, id))
  ) {
    throw new Error('keyframe entityOrder must contain every entity exactly once');
  }
  const scriptState = keyframe.plugins.$scripts;
  if (
    keyframe.tick > 0 &&
    scriptState !== null &&
    typeof scriptState === 'object' &&
    !Array.isArray(scriptState) &&
    scriptState.requiresReplay === true &&
    internal.snapshotProviders.has('$scripts')
  ) {
    throw new Error(
      'scripts require replay from the beginning; use molen.state and declare checkpoint: "state" to enable checkpoint restore',
    );
  }
  internal.restoreCommands(keyframe.commands);
  internal.clearFault();
  internal.resetTransient();
  for (const store of internal.stores.values()) store.clear();
  internal.entities.clear();
  // Entity key order == captureEntities order == the live creation order, so query iteration
  // (which walks `entities`) is identical before and after a round-trip.
  for (const id of order) {
    const components = keyframe.entities[id] as ComponentMap;
    internal.entities.add(id);
    for (const [name, data] of Object.entries(components)) {
      if (data === undefined) continue;
      let store = internal.stores.get(name);
      if (store === undefined) {
        store = new Map();
        internal.stores.set(name, store);
      }
      store.set(id, internal.intern(data));
    }
  }
  internal.bumpStructure();
  internal.setTick(keyframe.tick);
  internal.setNextSeq(keyframe.nextEntitySeq);
  internal.setRng(rngFromState(keyframe.rng));
  for (const [name, provider] of internal.snapshotProviders) {
    const blob = keyframe.plugins[name];
    if (blob !== undefined) provider.load(blob);
  }
  internal.clearDirty();
}

/**
 * Reconstruct a world from a keyframe. Restores entities, RNG, tick, and entity counter. Without
 * `opts.content`, the world takes the content identity the keyframe recorded.
 */
export function worldFromKeyframe(
  keyframe: Keyframe,
  opts?: WorldOptions & ApplyKeyframeOptions,
): World {
  const content = opts?.content ?? keyframeContent(keyframe);
  const world = new World({
    tickRate: keyframe.tickRate,
    seed: keyframe.seed,
    ...opts,
    ...(content !== undefined ? { content } : {}),
  });
  applyKeyframeTo(world, keyframe, {
    ...(opts?.allowContentDrift !== undefined ? { allowContentDrift: opts.allowContentDrift } : {}),
  });
  return world;
}

/**
 * Produce a delta capturing changes since the last takeDelta/keyframe boundary, then reset
 * dirty tracking. Whole-component replacement granularity (docs-src/schemas/delta.md).
 */
export function takeDelta(world: World, baseTick: number): Delta {
  const internal = world._internal();
  const dirty = internal.takeDirty();
  const tick = internal.getTick();

  const spawned = emptyRecord<ComponentMap>();
  for (const id of dirty.spawned) {
    spawned[id] = collectEntity(world, id);
  }
  const changed = emptyRecord<ComponentMap>();
  for (const [id, names] of dirty.changed) {
    const bucket = emptyRecord<JsonValue>() as ComponentMap;
    for (const name of names) {
      const data = internal.stores.get(name)?.get(id);
      if (data !== undefined) bucket[name] = cloneJson(data);
    }
    if (Object.keys(bucket).length > 0) changed[id] = bucket;
  }
  const removedComponents = emptyRecord<string[]>();
  for (const [id, names] of dirty.removed) {
    // applyDelta deletes removals AFTER it writes changes, so a name in both halves would be
    // dropped from every mirror while the world keeps it. The world already drops the removal
    // when a write supersedes it; this is the second belt, cheap and local to the wire format.
    const rewritten = Object.hasOwn(changed, id) ? changed[id] : undefined;
    const removed = [...names].filter(
      (name) => rewritten === undefined || !Object.hasOwn(rewritten, name),
    );
    if (removed.length > 0) removedComponents[id] = removed;
  }

  return {
    kind: 'delta',
    v: 1,
    tick,
    baseTick,
    spawned,
    destroyed: [...dirty.destroyed],
    changed,
    removedComponents,
    events: internal.drainTickEvents(),
  };
}

function collectEntity(world: World, id: EntityId): ComponentMap {
  const internal = world._internal();
  const out = emptyRecord<JsonValue>() as ComponentMap;
  for (const [name, store] of internal.stores) {
    const data = store.get(id);
    if (data !== undefined) out[name] = cloneJson(data);
  }
  return out;
}

/**
 * Apply a delta to a passive entity-major store (the client mirror / replay scrubber).
 * Mutates and returns the store. Shared by client interpolation and tests.
 */
export function applyDelta(
  store: Record<EntityId, ComponentMap>,
  delta: Delta,
): Record<EntityId, ComponentMap> {
  for (const [id, components] of Object.entries(delta.spawned)) {
    Object.defineProperty(store, id, {
      value: cloneJson(components),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  for (const [id, components] of Object.entries(delta.changed)) {
    let bucket = Object.hasOwn(store, id) ? store[id] : undefined;
    if (bucket === undefined) {
      bucket = emptyRecord<JsonValue>() as ComponentMap;
      Object.defineProperty(store, id, {
        value: bucket,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    for (const [name, data] of Object.entries(components)) {
      if (data !== undefined) bucket[name] = cloneJson(data);
    }
  }
  for (const [id, names] of Object.entries(delta.removedComponents)) {
    const bucket = store[id];
    if (bucket !== undefined) {
      for (const name of names) delete bucket[name];
    }
  }
  for (const id of delta.destroyed) {
    delete store[id];
  }
  return store;
}

/**
 * Hash of serialized continuation state, including query order, commands, and plugin blobs.
 * Equality assumes identical systems, script sources, and snapshot-safe host configuration.
 * Mutable host/script closure state is outside this contract.
 */
export function stateHash(world: World): string {
  const internal = world._internal();
  const entities = captureEntities(world);
  const plugins = emptyRecord<JsonValue>();
  for (const [name, provider] of internal.snapshotProviders) plugins[name] = provider.save();
  return hashJson({
    hashVersion: 2,
    // The state format, not the package version: two builds that simulate identically must hash
    // identically, so a release alone never invalidates a pinned hash or a recorded replay.
    stateFormat: STATE_FORMAT,
    tickRate: world.tickRate,
    plugins,
    tick: internal.getTick(),
    rng: internal.getRng().save(),
    nextEntitySeq: internal.getNextSeq(),
    entityOrder: [...internal.entities],
    commands: internal.saveCommands(),
    entities,
  } as unknown as JsonValue);
}
