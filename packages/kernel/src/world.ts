import type {
  Command,
  CommandQueueState,
  ComponentMap,
  ComponentRegistry,
  ContentIdentity,
  EngineEvent,
  EntityId,
  JsonObject,
  JsonValue,
  RngState,
  ValidationIssue,
} from '@bendyline/molen-schema';
import {
  blockingIssues,
  componentMapIssues,
  createComponentRegistry,
  deepMergeJson,
  formatIssues,
} from '@bendyline/molen-schema';
import { cloneJson, deepFreeze, patchJson } from './clone';
import {
  type CommandHandler,
  CommandQueue,
  type CommandTypeDef,
  type DeclareCommandOptions,
  type LateCommandPolicy,
  type SubmitResult,
} from './commands';
import { type ComponentType, snapshotComponentDefaults } from './component';
import { freezeContent } from './content';
import { createRng, type Rng, rngFromState } from './rng';

export type Phase = 'commands' | 'update' | 'physics' | 'late';
const PHASE_ORDER: Phase[] = ['commands', 'update', 'physics', 'late'];

export interface TickContext {
  tick: number;
  dt: number;
  rng: Rng;
}

export type System = (world: World, ctx: TickContext) => void;
export type EventHandler = (event: EngineEvent, ctx: TickContext) => void;
export type Unsubscribe = () => void;

export interface SystemInfo {
  name: string;
  phase: Phase;
  order: number;
}

export interface QueryResult<T extends JsonObject[]> extends Iterable<[EntityId, ...T]> {
  ids(): readonly EntityId[];
  count(): number;
  first(): [EntityId, ...T] | undefined;
  /** The same query, excluding entities that carry ANY of the given components. */
  without(...exclude: ComponentType<JsonObject>[]): QueryResult<T>;
}

export interface WorldOptions {
  /** Isolated component vocabulary; defaults to a copy of package registrations. */
  registry?: ComponentRegistry;
  /** World-local default values override package defaults for the named components. */
  defaults?: Readonly<Record<string, JsonObject>>;
  /** Hz; dt = 1/tickRate. Immutable for the world's lifetime. */
  tickRate?: number;
  seed?: string | number;
  /**
   * Dev mode deep-freezes component data ONCE when it enters the store (freeze-on-write), so
   * reads hand back the stored object and accidental mutation throws. Default true.
   *
   * Aliasing rule (both modes): `get()` and query rows return the live stored object, never a
   * copy. Never mutate what you read — in dev worlds it throws; with `devFreeze: false` it
   * silently corrupts state and deltas. `set`/`patch`/`spawn` always install a NEW object, so a
   * reference you hold goes stale after the next write, never corrupted.
   */
  devFreeze?: boolean;
  /** Validate component shapes in `spawn()` against the schema registry. Default = devFreeze. */
  validateSpawn?: boolean;
  /** Late-command policy (command.tick <= currentTick). Default 'rewrite'. */
  lateCommands?: LateCommandPolicy;
  /**
   * Which content the world is built from (see ContentIdentity). Recorded in keyframes next to
   * the state hash, never in it; loading a keyframe with different content fails by name.
   */
  content?: ContentIdentity;
}

interface RegisteredSystem {
  priority: number;
  fn: System;
  phase: Phase;
  name: string;
  order: number;
}

// A deferred spawn publishes identity only: the components were written to the stores when
// spawnRaw ran, so a `set`/`patch` later in the same system is not overwritten at flush time.
type DeferredOp =
  | { kind: 'spawn'; id: EntityId }
  | { kind: 'destroy'; id: EntityId }
  | DeferredRemove;

interface DeferredRemove {
  kind: 'remove';
  id: EntityId;
  component: string;
  cancelled: boolean;
}

/**
 * The ECS world: component-major storage, version-stamped query cache, deferred structural
 * ops, and a fixed-timestep tick in four phases (commands → update → physics → late).
 *
 * Snapshot/delta and command machinery attach via the internal accessors at the bottom; they
 * live in sibling modules to keep this file focused on the ECS + tick.
 */
export class World {
  readonly componentRegistry: ComponentRegistry;
  /** Content this world was built from, by domain; empty when none was declared. */
  readonly content: Readonly<ContentIdentity>;
  readonly tickRate: number;
  readonly dt: number;
  private readonly devFreeze: boolean;
  private readonly validateSpawn: boolean;
  private readonly componentDefaultFactories = new Map(snapshotComponentDefaults());

  private _tick = 0;
  private nextEntitySeq = 0;
  private rng: Rng;
  private readonly seed: string | number;

  // component name -> (entity id -> data). Component-major storage; stored objects are interned
  // (cloned once on write, frozen in dev) and handed back by reference on read.
  private readonly stores = new Map<string, Map<EntityId, JsonObject>>();
  // Identity is independent of components: an entity with an empty component map still exists.
  // Its insertion order is THE iteration order for queries (creation order), which is what makes
  // query order survive keyframe save/load regardless of when components were added.
  private readonly entities = new Set<EntityId>();
  private readonly pendingSpawnIds = new Set<EntityId>();
  // structureVersion bumps on component add/remove (not value writes) to invalidate query caches.
  private structureVersion = 0;

  private readonly systems: RegisteredSystem[] = [];
  private orderedSystemCache: readonly RegisteredSystem[] | undefined;
  private systemSeq = 0;
  private _faulted: Error | undefined;

  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  // Events emitted during the current tick, surfaced in the tick's delta.
  private tickEvents: EngineEvent[] = [];

  // Plugin snapshot providers: opaque blobs captured into / restored from keyframe.plugins.
  private readonly snapshotProviders = new Map<
    string,
    { save: () => JsonValue; load: (v: JsonValue) => void }
  >();

  // Deferred structural ops, applied between systems.
  private deferred: DeferredOp[] = [];
  private readonly pendingRemovals = new Map<EntityId, Map<string, DeferredRemove>>();
  private executing = false;

  // Dirty tracking for delta production (entity -> set of changed component names).
  private dirtyChanged = new Map<EntityId, Set<string>>();
  private dirtySpawned = new Set<EntityId>();
  private dirtyDestroyed = new Set<EntityId>();
  private dirtyRemoved = new Map<EntityId, Set<string>>();

  // Query cache keyed by the sorted component-name tuple.
  private readonly queryCache = new Map<string, { version: number; ids: readonly EntityId[] }>();

  private readonly commands: CommandQueue;

  constructor(opts?: WorldOptions) {
    this.componentRegistry = createComponentRegistry({}, { base: opts?.registry }).registry;
    this.content = freezeContent(opts?.content);
    this.tickRate = opts?.tickRate ?? 30;
    if (!Number.isInteger(this.tickRate) || this.tickRate < 1) {
      throw new Error(`tickRate must be a positive integer, got ${this.tickRate}`);
    }
    this.dt = 1 / this.tickRate;
    this.seed = opts?.seed ?? 0;
    this.devFreeze = opts?.devFreeze ?? true;
    this.validateSpawn = opts?.validateSpawn ?? this.devFreeze;
    this.rng = createRng(this.seed);
    for (const [name, value] of Object.entries(opts?.defaults ?? {})) {
      const data = deepFreeze(cloneJson(value));
      this.componentDefaultFactories.set(name, () => data);
    }
    this.commands = new CommandQueue(opts?.lateCommands ?? 'rewrite');
  }

  get tick(): number {
    return this._tick;
  }

  /**
   * The error that killed a tick, or undefined for a healthy world. A faulted world refuses to
   * step again: hosts and schedulers check this to report the failure and to refuse a resume
   * until the world is rebuilt or restored from a keyframe (`applyKeyframeTo` clears it).
   */
  get faulted(): Error | undefined {
    return this._faulted;
  }

  // --- interning (freeze-on-write) ---

  /**
   * Detach from caller data (clone) and, in dev, freeze once so reads can share the object.
   * `where` names the write site for the dev finiteness check (see assertFiniteNumbers).
   */
  private intern<T extends JsonValue>(value: T, where?: string): T {
    const copy = cloneJson(value);
    if (!this.devFreeze) return copy;
    assertFiniteNumbers(copy, where ?? 'component data');
    return deepFreeze(copy);
  }

  /** Freeze an already-detached value (dev only); used where the value was just cloned. */
  private freezeIfDev<T extends JsonValue>(value: T, where?: string): T {
    if (!this.devFreeze) return value;
    assertFiniteNumbers(value, where ?? 'component data');
    return deepFreeze(value);
  }

  private internMap(components: ComponentMap, id: EntityId): ComponentMap {
    const out: ComponentMap = {};
    for (const [name, data] of Object.entries(components)) {
      out[name] = this.intern(data, writeSite(id, name));
    }
    return out;
  }

  // --- entity lifecycle ---

  private allocId(): EntityId {
    for (;;) {
      const id = `e${this.nextEntitySeq++}`;
      if (!this.entities.has(id) && !this.pendingSpawnIds.has(id)) return id;
    }
  }

  /**
   * `spawn` without the conveniences: no component defaults, no shape validation. The hot path —
   * snapshot restore and bulk spawners use it — and the terse one, so it is what most tests and
   * scripts reach for. Prefer `spawn` when the components come from data you did not author, and
   * see it for what the conveniences are. If `id` is omitted, a runtime id ("e"+seq) is allocated.
   */
  spawnRaw(components: ComponentMap, id?: EntityId): EntityId {
    const entityId = id ?? this.allocId();
    if (this.entities.has(entityId) || this.pendingSpawnIds.has(entityId)) {
      throw new Error(`cannot spawn duplicate entity id "${entityId}"`);
    }
    const interned = this.internMap(components, entityId);
    // Components land in the stores immediately, even when identity is deferred: "spawn then
    // configure" (set/patch on the id you just got back) is the common script shape, and a
    // flush that replayed the original map would silently discard those writes.
    for (const [name, data] of Object.entries(interned)) this.storeFor(name).set(entityId, data);
    if (this.executing) {
      this.pendingSpawnIds.add(entityId);
      this.deferred.push({ kind: 'spawn', id: entityId });
      return entityId;
    }
    this.applySpawn(entityId);
    return entityId;
  }

  /**
   * `spawnRaw` plus the two conveniences: component defaults (registered via `defineComponent`)
   * deep-merged UNDER the authored data, and shape validation against the schema component
   * registry (on by default in devFreeze worlds). Both apply per component PRESENT in the map —
   * spawn never adds a component you did not ask for.
   */
  spawn(components: ComponentMap, opts?: { id?: EntityId; validate?: boolean }): EntityId {
    const merged: ComponentMap = {};
    for (const [name, data] of Object.entries(components)) {
      const defaults = this.componentDefaultFactories.get(name);
      merged[name] =
        defaults !== undefined ? (deepMergeJson(defaults(), data) as JsonObject) : data;
    }
    if (opts?.validate ?? this.validateSpawn) {
      const issues: ValidationIssue[] = blockingIssues(
        componentMapIssues(merged, '', { registry: this.componentRegistry }),
      );
      if (issues.length > 0) {
        throw new Error(formatIssues('spawn', issues));
      }
    }
    return this.spawnRaw(merged, opts?.id);
  }

  /**
   * Publish a spawned entity: identity, query visibility and dirty marking. The component data
   * is already in the stores (spawnRaw writes it before deferring), so nothing is overwritten
   * here — writes made between spawnRaw and the flush survive.
   */
  private applySpawn(id: EntityId): void {
    this.pendingSpawnIds.delete(id);
    this.entities.add(id);
    this.structureVersion++;
    this.dirtySpawned.add(id);
    this.dirtyDestroyed.delete(id);
    this.dirtyChanged.delete(id);
    this.dirtyRemoved.delete(id);
  }

  destroy(id: EntityId): void {
    if (this.executing) {
      this.deferred.push({ kind: 'destroy', id });
      return;
    }
    this.applyDestroy(id);
  }

  private applyDestroy(id: EntityId): void {
    const existed = this.entities.delete(id);
    for (const store of this.stores.values()) {
      store.delete(id);
    }
    if (!existed) return;
    this.structureVersion++;
    if (this.dirtySpawned.has(id)) {
      // Spawned and destroyed within the same tick: net no-op for the delta.
      this.dirtySpawned.delete(id);
    } else {
      this.dirtyDestroyed.add(id);
    }
    this.dirtyChanged.delete(id);
    this.dirtyRemoved.delete(id);
  }

  exists(id: EntityId): boolean {
    return this.entities.has(id);
  }

  // --- component access ---

  private storeFor(name: string): Map<EntityId, JsonObject> {
    let s = this.stores.get(name);
    if (s === undefined) {
      s = new Map();
      this.stores.set(name, s);
    }
    return s;
  }

  /** Returns the stored object itself (frozen in dev). See the aliasing rule on WorldOptions. */
  get<T extends JsonObject>(id: EntityId, c: ComponentType<T>): Readonly<T> | undefined {
    return this.stores.get(c.name)?.get(id) as Readonly<T> | undefined;
  }

  has(id: EntityId, c: ComponentType<JsonObject>): boolean {
    return this.stores.get(c.name)?.has(id) ?? false;
  }

  set<T extends JsonObject>(id: EntityId, c: ComponentType<T>, data: T): void {
    if (!this.entities.has(id) && !this.pendingSpawnIds.has(id)) {
      throw new Error(`cannot set component "${c.name}" on missing entity "${id}"`);
    }
    // A later write supersedes a deferred remove from an earlier callback in this system.
    this.cancelPendingRemoval(id, c.name);
    const store = this.storeFor(c.name);
    const isNew = !store.has(id);
    store.set(id, this.intern(data, writeSite(id, c.name)));
    if (isNew) this.structureVersion++;
    this.markChanged(id, c.name);
  }

  patch<T extends JsonObject>(id: EntityId, c: ComponentType<T>, partial: Partial<T>): void {
    const store = this.storeFor(c.name);
    const current = store.get(id) as T | undefined;
    if (current === undefined) {
      throw new Error(`cannot patch missing component "${c.name}" on entity "${id}"`);
    }
    this.cancelPendingRemoval(id, c.name);
    // patchJson already deep-clones base and partial; only the dev freeze remains.
    store.set(id, this.freezeIfDev(patchJson(current, partial), writeSite(id, c.name)));
    this.markChanged(id, c.name);
  }

  remove(id: EntityId, c: ComponentType<JsonObject>): void {
    if (this.executing) {
      this.cancelPendingRemoval(id, c.name);
      let removals = this.pendingRemovals.get(id);
      if (removals === undefined) {
        removals = new Map();
        this.pendingRemovals.set(id, removals);
      }
      const op: DeferredRemove = { kind: 'remove', id, component: c.name, cancelled: false };
      removals.set(c.name, op);
      this.deferred.push(op);
      return;
    }
    this.applyRemove(id, c.name);
  }

  private cancelPendingRemoval(id: EntityId, name: string): void {
    const pending = this.pendingRemovals.get(id)?.get(name);
    if (pending !== undefined) pending.cancelled = true;
  }

  private applyRemove(id: EntityId, name: string): void {
    const store = this.stores.get(name);
    if (store?.delete(id) !== true) return;
    this.structureVersion++;
    if (!this.dirtySpawned.has(id)) {
      let set = this.dirtyRemoved.get(id);
      if (set === undefined) {
        set = new Set();
        this.dirtyRemoved.set(id, set);
      }
      set.add(name);
    }
    this.dirtyChanged.get(id)?.delete(name);
  }

  private markChanged(id: EntityId, name: string): void {
    // A write supersedes an earlier removal in the same delta window. Without this the delta
    // would carry the component in BOTH `changed` and `removedComponents`, and applyDelta —
    // which deletes after it writes — would drop it from every mirror while the world keeps it.
    const removed = this.dirtyRemoved.get(id);
    if (removed !== undefined) {
      removed.delete(name);
      if (removed.size === 0) this.dirtyRemoved.delete(id);
    }
    if (this.dirtySpawned.has(id)) return; // captured by spawned in the delta
    let set = this.dirtyChanged.get(id);
    if (set === undefined) {
      set = new Set();
      this.dirtyChanged.set(id, set);
    }
    set.add(name);
  }

  // --- queries ---

  query<A extends JsonObject>(a: ComponentType<A>): QueryResult<[A]>;
  query<A extends JsonObject, B extends JsonObject>(
    a: ComponentType<A>,
    b: ComponentType<B>,
  ): QueryResult<[A, B]>;
  query<A extends JsonObject, B extends JsonObject, C extends JsonObject>(
    a: ComponentType<A>,
    b: ComponentType<B>,
    c: ComponentType<C>,
  ): QueryResult<[A, B, C]>;
  query<A extends JsonObject, B extends JsonObject, C extends JsonObject, D extends JsonObject>(
    a: ComponentType<A>,
    b: ComponentType<B>,
    c: ComponentType<C>,
    d: ComponentType<D>,
  ): QueryResult<[A, B, C, D]>;
  query(...comps: ComponentType<JsonObject>[]): QueryResult<JsonObject[]> {
    return this.buildQuery(
      comps.map((c) => c.name),
      [],
    );
  }

  private buildQuery(names: string[], exclude: string[]): QueryResult<JsonObject[]> {
    const ids = this.matchingIds(names, exclude);
    const world = this;
    return {
      ids: () => ids,
      count: () => ids.length,
      first(): [EntityId, ...JsonObject[]] | undefined {
        for (const id of ids) {
          const row = world.row(id, names);
          if (row !== undefined) return row;
        }
        return undefined;
      },
      without: (...more: ComponentType<JsonObject>[]): QueryResult<JsonObject[]> =>
        world.buildQuery(names, [...exclude, ...more.map((c) => c.name)]),
      *[Symbol.iterator]() {
        for (const id of ids) {
          const row = world.row(id, names);
          if (row !== undefined) yield row;
        }
      },
    };
  }

  /**
   * One query row, or undefined if the id no longer matches. The id array is a snapshot but
   * rows are read lazily, so a destroy/remove during iteration (immediate outside a tick) would
   * otherwise hand back `[id, undefined]`. `ids()`/`count()` stay snapshot values by contract.
   */
  private row(id: EntityId, names: string[]): [EntityId, ...JsonObject[]] | undefined {
    if (!this.entities.has(id)) return undefined;
    const out: JsonObject[] = [];
    for (const name of names) {
      const data = this.stores.get(name)?.get(id);
      if (data === undefined) return undefined;
      out.push(data);
    }
    return [id, ...out];
  }

  private matchingIds(names: string[], exclude: string[] = []): readonly EntityId[] {
    // JSON-encoded so the two halves stay unambiguous: a plain `names + sep + exclude` string
    // lets query('a!') and query('a').without('!') collide on the same key.
    const key = JSON.stringify([[...names].sort(), [...exclude].sort()]);
    const cached = this.queryCache.get(key);
    if (cached !== undefined && cached.version === this.structureVersion) {
      return cached.ids;
    }
    let ids = this.computeMatching(names);
    if (exclude.length > 0) {
      ids = ids.filter((id) => !exclude.some((name) => this.stores.get(name)?.has(id) === true));
    }
    // Frozen: the cached array is shared with every caller (including scripts).
    const frozen: readonly EntityId[] = Object.freeze(ids);
    this.queryCache.set(key, { version: this.structureVersion, ids: frozen });
    return frozen;
  }

  private computeMatching(names: string[]): EntityId[] {
    if (names.length === 0) return [];
    const stores: Map<EntityId, JsonObject>[] = [];
    for (const name of names) {
      const s = this.stores.get(name);
      if (s === undefined) return []; // no entity can match a never-seen component
      stores.push(s);
    }
    // Iterate entities in creation order and probe every store. Creation order (not per-store
    // insertion order) is the contract: it is what a keyframe records, so queries iterate
    // identically in a continuous run and after save/load (docs/04 §5.2).
    const result: EntityId[] = [];
    for (const id of this.entities) {
      let ok = true;
      for (const s of stores) {
        if (!s.has(id)) {
          ok = false;
          break;
        }
      }
      if (ok) result.push(id);
    }
    return result;
  }

  // --- systems ---

  addSystem(system: System, opts?: { phase?: Phase; name?: string; priority?: number }): void {
    const phase = opts?.phase ?? 'update';
    this.systems.push({
      fn: system,
      priority: opts?.priority ?? 0,
      phase,
      name: opts?.name ?? system.name ?? `system_${this.systemSeq}`,
      order: this.systemSeq++,
    });
    this.orderedSystemCache = undefined;
  }

  describeSystems(): SystemInfo[] {
    return this.orderedSystems().map((s) => ({ name: s.name, phase: s.phase, order: s.order }));
  }

  /**
   * Remove a registered system by name (a capability's dispose path). A removal during a tick
   * takes effect from the next tick (the running tick iterates a snapshot). Returns whether a
   * system was removed.
   */
  removeSystem(name: string): boolean {
    const i = this.systems.findIndex((s) => s.name === name);
    if (i < 0) return false;
    this.systems.splice(i, 1);
    this.orderedSystemCache = undefined;
    return true;
  }

  private orderedSystems(): readonly RegisteredSystem[] {
    // Phase order, then registration order within a phase (§1.4, §5.2).
    if (this.orderedSystemCache !== undefined) return this.orderedSystemCache;
    this.orderedSystemCache = [...this.systems].sort((a, b) => {
      const pa = PHASE_ORDER.indexOf(a.phase);
      const pb = PHASE_ORDER.indexOf(b.phase);
      return pa !== pb ? pa - pb : a.priority - b.priority || a.order - b.order;
    });
    return this.orderedSystemCache;
  }

  // --- events ---

  on(event: string, handler: EventHandler): Unsubscribe {
    let set = this.eventHandlers.get(event);
    if (set === undefined) {
      set = new Set();
      this.eventHandlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  emit(type: string, payload: JsonValue): void {
    const event: EngineEvent = { type, payload: cloneJson(payload) };
    this.tickEvents.push(event);
    const ctx = this.ctx();
    for (const handler of this.eventHandlers.get(type) ?? []) handler(event, ctx);
    for (const handler of this.eventHandlers.get('*') ?? []) handler(event, ctx);
  }

  /**
   * Register an opaque snapshot provider (e.g. a physics plugin). `save` is captured into
   * keyframe.plugins[name]; `load` restores from it. Lets plugins persist state the legible
   * ECS mirror can't (solver warm-start, sleeping flags) for bit-exact resume.
   */
  registerSnapshotProvider(
    name: string,
    save: () => JsonValue,
    load: (v: JsonValue) => void,
  ): void {
    this.snapshotProviders.set(name, { save, load });
  }

  /** Remove a snapshot provider (a plugin's dispose path). Returns whether one was removed. */
  unregisterSnapshotProvider(name: string): boolean {
    return this.snapshotProviders.delete(name);
  }

  // --- commands ---

  /**
   * Declare a command type (optionally with a payload validator) without attaching a handler.
   * Scenes declare their `commands` this way at build time; scripts and setup modules attach
   * handlers with `onCommand`/`registerCommand`.
   */
  declareCommand(type: string, opts?: DeclareCommandOptions): void {
    this.commands.declare(type, opts);
  }

  /** Attach a handler for a command type (declaring it if needed). Returns a remover. */
  onCommand(type: string, handler: CommandHandler<World>): Unsubscribe {
    return this.commands.addHandler(type, handler);
  }

  /**
   * Register a handler (and optional payload validator) for a command type. A type may carry
   * many handlers (setup module + scripts); they run in registration order.
   */
  registerCommand(
    type: string,
    handler: CommandHandler<World>,
    opts?: Omit<CommandTypeDef<World>, 'handler'>,
  ): void {
    this.commands.declare(type, opts);
    this.commands.addHandler(type, handler);
  }

  hasCommand(type: string): boolean {
    return this.commands.hasType(type);
  }

  /** Every declared command type (registration order). */
  commandTypes(): string[] {
    return this.commands.types();
  }

  /**
   * Validate and enqueue a command. Invalid commands never queue and surface a
   * `command-rejected` event carrying (source, seq) and the formatted reason.
   */
  submitCommand(command: Command): SubmitResult {
    const result = this.commands.submit(command, this._tick);
    if (!result.accepted) {
      // Read defensively: a command that failed envelope validation may lack these fields.
      const loose = command as Partial<Command>;
      this.emit('command-rejected', {
        source: loose.source ?? null,
        seq: loose.seq ?? null,
        type: loose.type ?? null,
        reason: result.reason ?? 'rejected',
      });
    }
    return result;
  }

  // --- tick ---

  private ctx(): TickContext {
    return { tick: this._tick, dt: this.dt, rng: this.rng };
  }

  /** Advance exactly one tick, synchronously. Clock-free (no Date/performance access). */
  step(): void {
    if (this._faulted !== undefined) {
      throw new Error(`world cannot continue after a failed tick: ${this._faulted.message}`, {
        cause: this._faulted,
      });
    }
    const ctx = this.ctx();
    const systems = this.orderedSystems();
    this.executing = true;
    try {
      // Commands adjudicate at the start of the tick (the commands phase), before any
      // commands-phase systems, sorted by (source, seq).
      this.commands.execute(this, this._tick, ctx);
      this.flushDeferred();
      for (const phase of PHASE_ORDER) {
        for (const sys of systems) {
          if (sys.phase !== phase) continue;
          sys.fn(this, ctx);
          this.flushDeferred();
        }
      }
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      // Arbitrary handlers can have external side effects, so pretending the tick is safely
      // retryable would be misleading. Drop uncommitted structural work and make failure
      // explicit/fatal; callers must rebuild or restore a known keyframe.
      this.deferred = [];
      this.dropPendingSpawns();
      this.pendingRemovals.clear();
      this._faulted = cause;
      throw new Error(`world tick ${this._tick} failed: ${cause.message}`, { cause });
    } finally {
      this.executing = false;
    }
    this._tick++;
  }

  stepN(n: number): void {
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new Error(`step count must be a nonnegative safe integer, got ${n}`);
    }
    for (let i = 0; i < n; i++) this.step();
  }

  private flushDeferred(): void {
    if (this.deferred.length === 0) return;
    const ops = this.deferred;
    this.deferred = [];
    this.pendingRemovals.clear();
    for (const op of ops) {
      if (op.kind === 'spawn') this.applySpawn(op.id);
      else if (op.kind === 'destroy') this.applyDestroy(op.id);
      else if (!op.cancelled) this.applyRemove(op.id, op.component);
    }
  }

  /**
   * Abandon spawns that never reached their flush (a failed tick, a keyframe load). Their
   * component data is already in the stores, so it has to be swept with the identity.
   */
  private dropPendingSpawns(): void {
    if (this.pendingSpawnIds.size === 0) return;
    for (const id of this.pendingSpawnIds) {
      for (const store of this.stores.values()) store.delete(id);
    }
    this.pendingSpawnIds.clear();
  }

  // --- internal accessors for sibling modules (snapshot, commands) ---

  /** @internal */
  _internal(): WorldInternal {
    return {
      stores: this.stores,
      entities: this.entities,
      pendingSpawnIds: this.pendingSpawnIds,
      getRng: () => this.rng,
      setRng: (r) => {
        this.rng = r;
      },
      getTick: () => this._tick,
      setTick: (t) => {
        this._tick = t;
      },
      getNextSeq: () => this.nextEntitySeq,
      setNextSeq: (s) => {
        this.nextEntitySeq = s;
      },
      bumpStructure: () => {
        this.structureVersion++;
      },
      seed: this.seed,
      drainTickEvents: () => {
        const e = this.tickEvents;
        this.tickEvents = [];
        return e;
      },
      takeDirty: () => {
        const d = {
          changed: this.dirtyChanged,
          spawned: this.dirtySpawned,
          destroyed: this.dirtyDestroyed,
          removed: this.dirtyRemoved,
        };
        this.dirtyChanged = new Map();
        this.dirtySpawned = new Set();
        this.dirtyDestroyed = new Set();
        this.dirtyRemoved = new Map();
        return d;
      },
      clearDirty: () => {
        this.dirtyChanged.clear();
        this.dirtySpawned.clear();
        this.dirtyDestroyed.clear();
        this.dirtyRemoved.clear();
      },
      clearCommands: () => this.commands.clear(),
      saveCommands: () => this.commands.save(),
      restoreCommands: (state) => this.commands.restore(state),
      clearFault: () => {
        this._faulted = undefined;
      },
      resetTransient: () => {
        this.tickEvents = [];
        this.deferred = [];
        this.dropPendingSpawns();
        this.pendingRemovals.clear();
      },
      intern: (value) => this.intern(value),
      submitRecordedCommand: (command) => this.commands.submitRecorded(command),
      snapshotProviders: this.snapshotProviders,
    };
  }
}

export interface WorldInternal {
  stores: Map<string, Map<EntityId, JsonObject>>;
  entities: Set<EntityId>;
  pendingSpawnIds: ReadonlySet<EntityId>;
  getRng(): Rng;
  setRng(r: Rng): void;
  getTick(): number;
  setTick(t: number): void;
  getNextSeq(): number;
  setNextSeq(s: number): void;
  bumpStructure(): void;
  seed: string | number;
  drainTickEvents(): EngineEvent[];
  takeDirty(): {
    changed: Map<EntityId, Set<string>>;
    spawned: Set<EntityId>;
    destroyed: Set<EntityId>;
    removed: Map<EntityId, Set<string>>;
  };
  clearDirty(): void;
  clearCommands(): void;
  saveCommands(): CommandQueueState;
  restoreCommands(state: CommandQueueState | undefined): void;
  clearFault(): void;
  /** Drop in-flight tick state (pending events, deferred ops) — used when loading a keyframe. */
  resetTransient(): void;
  /** Detach + dev-freeze a value the way the world does for its own stores. */
  intern<T extends JsonValue>(value: T): T;
  submitRecordedCommand(command: Command): SubmitResult;
  snapshotProviders: Map<string, { save: () => JsonValue; load: (v: JsonValue) => void }>;
}

function writeSite(id: EntityId, name: string): string {
  return `component "${name}" on entity "${id}"`;
}

/**
 * Reject NaN/Infinity before they enter a store (dev worlds — the same contract script state
 * already enforces in scripting.ts). They hash as their IEEE bits but serialize to `null`, so a
 * keyframe round trip would silently change both the state and its hash.
 */
function assertFiniteNumbers(value: JsonValue, where: string, path = ''): void {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new Error(
      `${where} contains a non-finite number (${String(value)}) at ${path === '' ? '(root)' : path}: NaN/Infinity do not survive a keyframe round trip`,
    );
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertFiniteNumbers(value[i] as JsonValue, where, `${path}/${i}`);
    }
    return;
  }
  for (const key of Object.keys(value)) {
    assertFiniteNumbers(
      (value as Record<string, JsonValue>)[key] as JsonValue,
      where,
      `${path}/${key}`,
    );
  }
}

/** Restore RNG into a world (used by snapshot load). */
export function restoreRng(world: World, state: RngState): void {
  world._internal().setRng(rngFromState(state));
}
