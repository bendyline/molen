import 'ses';
import type {
  Command,
  EntityId,
  JsonObject,
  JsonValue,
  ResolvedTypes,
  SceneManifest,
  Vec3,
} from '@bendyline/molen-schema';
import { blockingIssues, componentIssues, formatIssues } from '@bendyline/molen-schema';
import { cloneJson, deepFreeze, patchJson } from './clone';
import { type ComponentType, componentHandle as comp } from './component';
import { dmath } from './dmath';
import {
  cancelTimer as cancelWorldTimer,
  cancelTween as cancelWorldTween,
  scheduleTimer,
  setParent,
  startTween,
  type TweenEntry,
  unparent as unparentEntity,
} from './gameplay';
import { overlapCircle, type RayHit, raycast } from './kinematics';
import { resolveEntityComponents } from './scene';
import type { QueryResult, TickContext, Unsubscribe, World } from './world';

// Script evaluation (docs/04-kernel-design.md §8). Scripts are trusted single-player logic
// evaluated in a per-script SES Compartment with an injected `molen` (the ScriptAPI verb set) and
// `config`. Synchronous, in-tick execution. We use Compartments WITHOUT process-global
// lockdown() (it would freeze a long-lived host's intrinsics). Determinism inside the Compartment
// comes from the endowments instead: a tamed Math without `random`, and `Date`/`Intl` shadowed
// to undefined (SES applies endowments with assign, so an undefined endowment hides the host
// intrinsic). The shared `molen` object and each script's `config` are frozen so one script cannot
// rewrite another's verbs or the manifest. Shared intrinsics (Object, Array, …) remain mutable
// without lockdown — scripts are trusted content, not adversarial code.
//
// So a Compartment here is a determinism harness, NOT a security boundary: without lockdown the
// host global is one expression away (`(()=>{}).constructor('return globalThis')()`) and
// `Array.prototype` is writable from a script. A host that wants the boundary calls
// `hardenScripts()` below at startup; see docs-src/guide/scripting.md ("Script trust").
// Hot reload re-evaluates a fresh Compartment, preserving world state but dropping script
// closure state.

/**
 * Taming options for {@link hardenScripts}: the slice of SES's `lockdown()` options a kernel host
 * has reason to choose. Anything omitted keeps SES's own default.
 */
export interface HardenScriptsOptions {
  /**
   * `'safe'` (SES's default) takes the `error.stack` accessor away from the whole process, host
   * code included; `'unsafe'` keeps stacks readable, which is usually what you want while
   * debugging. Script failures carry the kernel's `script "x" tick handler at tick n: …` message
   * either way — stacks only affect what the host can log around it.
   */
  errorTaming?: 'safe' | 'unsafe' | 'unsafe-debug';
  /**
   * Override-by-assignment mitigation. `'severe'` (our default) applies it to every property,
   * the most forgiving setting for ordinary JS that assigns to an inherited property; SES's own
   * default `'moderate'` covers the well-known cases and starts faster. A compatibility knob,
   * not a safety one.
   */
  overrideTaming?: 'moderate' | 'min' | 'severe';
  /** How much of a stack tamed error reports keep. */
  stackFiltering?: 'concise' | 'omit-frames' | 'shorten-paths' | 'verbose';
}

/**
 * Whether this realm's intrinsics are frozen — by {@link hardenScripts} or by a host that called
 * SES `lockdown()` itself.
 */
export function scriptsHardened(): boolean {
  const g = globalThis as { harden?: unknown };
  return typeof g.harden === 'function' && Object.isFrozen(Object.prototype);
}

/**
 * Turn script evaluation into an actual isolation boundary by running SES `lockdown()` once for
 * this process. Returns `true` if this call performed the lockdown, `false` if the realm was
 * already hardened (calling it repeatedly is safe).
 *
 * Without it, scripts are deterministic but not contained: they share the realm's mutable
 * intrinsics and can reach the host global. After it, intrinsics are frozen and
 * `Function.prototype.constructor` no longer builds a function in the host realm, so the usual
 * escape fails.
 *
 * **Call it at host startup, before building a world**, and only in a process whose job is
 * running the kernel — a Worker or a dedicated Node host. `lockdown()` is process-global and
 * irreversible: do not call it in a host that also runs bundlers, image or asset tooling, or a
 * browser-automation stack, because frozen intrinsics break libraries that patch prototypes at
 * runtime. The `molen` CLI and MCP server deliberately do not call it.
 *
 * Determinism does not depend on this: the tamed `Math`/`Date`/`Intl` endowments already give
 * that. Hardening only changes what a hostile script can reach.
 */
export function hardenScripts(options: HardenScriptsOptions = {}): boolean {
  if (scriptsHardened()) return false;
  lockdown({ overrideTaming: 'severe', ...options });
  return true;
}

/** The string-named query result scripts get (adds string-based `.without()`). */
export interface ScriptQuery extends Iterable<[EntityId, ...JsonObject[]]> {
  ids(): readonly EntityId[];
  count(): number;
  first(): [EntityId, ...JsonObject[]] | undefined;
  /** The same query, excluding entities carrying ANY of the named components. */
  without(...components: string[]): ScriptQuery;
}

/** The agent-facing verb set (string component names; scripts are text). */
export interface ScriptAPI {
  /** Spawn from a component map. */
  spawn(components: Record<string, JsonObject>, id?: EntityId): EntityId;
  /** Spawn from a manifest prefab by name, with optional components layered on top. */
  spawn(prefab: string, components?: Record<string, JsonObject>, id?: EntityId): EntityId;
  /** Spawn a project-registry type with optional component overrides. */
  spawnType(type: string, components?: Record<string, JsonObject>, id?: EntityId): EntityId;
  /** Immutable script-owned JSON state, captured in checkpoints and preserved on reload. */
  readonly state: Readonly<JsonObject>;
  setState(data: JsonObject): void;
  patchState(partial: JsonObject): void;
  destroy(id: EntityId): void;
  exists(id: EntityId): boolean;
  get(id: EntityId, component: string): JsonObject | undefined;
  set(id: EntityId, component: string, data: JsonObject): void;
  patch(id: EntityId, component: string, partial: JsonObject): void;
  remove(id: EntityId, component: string): void;
  has(id: EntityId, component: string): boolean;
  /**
   * Entities having all named components. The result is iterable (yields
   * `[id, ...componentData]` tuples) and also exposes `.ids()`, `.count()`, `.first()`,
   * `.without(...names)`.
   */
  query(...components: string[]): ScriptQuery;
  on(event: 'tick' | string, handler: (payload: JsonValue, ctx: TickContext) => void): Unsubscribe;
  /**
   * Handle a command type (player input, agent actions). The scene declares the type (and its
   * payload schema) under `commands`; the queue rejects undeclared types and bad payloads before
   * any handler runs. Handlers run in the commands phase, before every system.
   */
  onCommand(
    type: string,
    handler: (payload: JsonValue, ctx: TickContext, command: Command) => void,
  ): Unsubscribe;
  emit(type: string, payload: JsonValue): void;
  raycast(origin: Vec3, dir: Vec3, maxDist: number, mask?: number): RayHit | null;
  overlapCircle(center: Vec3, radius: number, mask?: number): EntityId[];
  /** Emit `event` after `ticks` ticks (snapshot-safe world timer). Returns the timer id. */
  after(ticks: number, event: string, payload?: JsonValue): string;
  /** Emit `event` every `ticks` ticks. Returns the timer id. */
  every(ticks: number, event: string, payload?: JsonValue): string;
  cancelTimer(timerId: string, entity?: EntityId): void;
  /** Start a data-driven tween on an entity (component + path + to + ticks [+ easing/loop]). */
  tween(entity: EntityId, spec: TweenEntry): void;
  cancelTween(entity: EntityId, tweenId?: string): void;
  /** Parent an entity (keeps its current world pose); the hierarchy system takes over. */
  parent(id: EntityId, parentId: EntityId): void;
  unparent(id: EntityId): void;
  rng(): number;
  readonly tick: number;
  readonly dt: number;
  readonly math: typeof dmath;
}

interface TickHandler {
  owner: string;
  fn: (payload: JsonValue, ctx: TickContext) => void;
}

interface StagedEventHandler {
  event: string;
  fn: (payload: JsonValue, ctx: TickContext) => void;
}

type ScriptCommandHandler = (payload: JsonValue, ctx: TickContext, command: Command) => void;

interface StagedCommandHandler {
  type: string;
  fn: ScriptCommandHandler;
}

interface StagedRegistration {
  owner: string;
  ticks: TickHandler[];
  events: StagedEventHandler[];
  commands: StagedCommandHandler[];
}

export interface LoadedScript {
  checkpoint?: 'state';
  id: string;
  source: string;
  config?: JsonObject;
}

export interface ScriptHost {
  /** Re-evaluate a script's source in a fresh Compartment (world state survives). */
  reload(id: string, source: string): void;
  /** Number of registered scripts. */
  readonly count: number;
}

// Script Math endowment. Three rules keep script bodies deterministic:
//   - no `random` (scripts must use molen.rng so the seed governs all randomness);
//   - transcendentals route through dmath (the single cross-platform swap point), so a future
//     polynomial-approximation swap covers script math too. IEEE-exact ops stay native;
//   - locale-dependent formatting is banned everywhere in sim code, not only here: never put
//     `toLocaleString`, `toLocaleDateString`, `localeCompare` or `Intl` output into component
//     state or an event payload. They depend on the host's locale and ICU build, so two machines
//     running the same tick would produce different state and a different hash. `Intl` is
//     shadowed in the Compartment below, but these live on Number/String/Array prototypes, which
//     the Compartment cannot take away — they are a review rule, not a guarded one. Format for
//     display in the client, never in the sim.
//
// The shim must cover the WHOLE dmath surface (a unit test enumerates it): a member missing here
// type-checks in a script and `molen scripts check` passes it, then throws "Math.x is not a
// function" at tick time, in front of a player.
const tamedMath = Object.freeze({
  // Constants. Engine-provided doubles; the spec calls them implementation-approximated, but
  // every shipping engine uses the same correctly-rounded values.
  PI: dmath.PI,
  TAU: dmath.TAU,
  E: Math.E,
  LN2: Math.LN2,
  LN10: Math.LN10,
  LOG2E: Math.LOG2E,
  LOG10E: Math.LOG10E,
  SQRT2: Math.SQRT2,
  SQRT1_2: Math.SQRT1_2,
  // IEEE-exact natives: exactly specified, so identical on every engine.
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  trunc: Math.trunc,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  sqrt: Math.sqrt,
  sign: Math.sign,
  fround: Math.fround,
  imul: Math.imul,
  clz32: Math.clz32,
  // Helpers and transcendentals via dmath — the whole DMath surface.
  clamp: dmath.clamp,
  lerp: dmath.lerp,
  frac: dmath.frac,
  smoothstep: dmath.smoothstep,
  wrapAngle: dmath.wrapAngle,
  hypot: dmath.hypot,
  sin: dmath.sin,
  cos: dmath.cos,
  tan: dmath.tan,
  asin: dmath.asin,
  acos: dmath.acos,
  atan: dmath.atan,
  atan2: dmath.atan2,
  pow: dmath.pow,
  exp: dmath.exp,
  log: dmath.log,
  log2: dmath.log2,
  log10: dmath.log10,
  cbrt: dmath.cbrt,
  // Deliberately absent, each for a reason:
  //   random   — seeded randomness only; use molen.rng so a replay reproduces the run.
  //   sinh/cosh/tanh/asinh/acosh/atanh/expm1/log1p — engine-approximated with no dmath route
  //              yet; add them to dmath (the single swap point) before exposing them, so a
  //              future cross-platform math swap covers scripts too. Compose from exp/log today.
});

type HostConsole = { log?: (...a: unknown[]) => void; warn?: (...a: unknown[]) => void };

function hostConsole(): HostConsole | undefined {
  return (globalThis as { console?: HostConsole }).console;
}

/** A frozen per-script console that tags every line with the script id. */
function scriptConsole(id: string): Readonly<HostConsole> {
  const tag = `[molen script "${id}"]`;
  return Object.freeze({
    log: (...a: unknown[]) => hostConsole()?.log?.(tag, ...a),
    warn: (...a: unknown[]) => hostConsole()?.warn?.(tag, ...a),
  });
}

const IMMUTABLE_READ = /read only|not extensible|frozen|cannot assign/i;

/**
 * The injected global was named `api` before the rename to `molen`. A bare ReferenceError ("api
 * is not defined") reads like a bug in the script rather than a renamed verb set, so shadow the
 * old name with a getter that names the fix. Shipping both names would split the corpus in two —
 * this throws rather than aliasing.
 */
function defineRenamedGlobal(cglobal: Record<string, unknown>, id: string): void {
  Object.defineProperty(cglobal, 'api', {
    get(): never {
      throw new Error(
        `script "${id}": the injected global \`api\` is now \`molen\` — use molen.on(...), molen.get(...), molen.patch(...).`,
      );
    },
    configurable: true,
  });
}

/** Attribute a handler failure to its script; hint at the most common cause (mutating a read). */
function attributeError(owner: string, kind: string, tick: number, error: unknown): Error {
  const msg = error instanceof Error ? error.message : String(error);
  const hint = IMMUTABLE_READ.test(msg)
    ? ' (hint: component reads are immutable snapshots — write with molen.set/molen.patch)'
    : '';
  return new Error(`script "${owner}" ${kind} handler at tick ${tick}: ${msg}${hint}`, {
    cause: error,
  });
}

export interface InstallScriptingOptions {
  /** Manifest enabling `molen.spawn(prefabName, components?)`. */
  manifest?: SceneManifest;
  types?: ResolvedTypes;
  /** Validate component shapes on spawn/set against the registry (default true). */
  validate?: boolean;
  /**
   * Extra namespaces merged onto `molen` (deep-frozen for SES hygiene) — how capability packages
   * reach a script without kernel coupling, e.g. `{ physics: rapierScriptApi(handle) }`.
   */
  extensions?: Record<string, object>;
}

/**
 * Install scripting on a world: evaluate each script in a Compartment, run tick handlers in a
 * single update-phase system (registration order), and route world events to script handlers.
 *
 * Scripts may author logic two ways: at the top level using the injected `molen`/`config`
 * globals, or by exporting a `setup(molen, config)` function (defined as a top-level
 * `function setup` in its Compartment). A script that registers no `molen.on` handlers is warned
 * about — that is the classic silent no-op (a typo'd verb leaves the script doing nothing).
 */
export function installScripting(
  world: World,
  scripts: LoadedScript[],
  opts?: InstallScriptingOptions,
): ScriptHost {
  const tickHandlers: TickHandler[] = [];
  const eventSubs: { owner: string; unsub: Unsubscribe }[] = [];
  const commandSubs: { owner: string; unsub: Unsubscribe }[] = [];
  let currentOwner = '';
  let states: Record<string, JsonObject> = Object.create(null) as Record<string, JsonObject>;
  const readState = (): JsonObject => states[currentOwner] ?? {};
  const writeState = (data: JsonObject): void => {
    if (data === null || typeof data !== 'object' || Array.isArray(data))
      throw new Error('script state must be a JSON object');
    const seen = new Set<object>();
    const check = (value: unknown): void => {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
      if (typeof value === 'number' && Number.isFinite(value)) return;
      if (typeof value !== 'object' || seen.has(value))
        throw new Error('script state must contain only finite JSON values without cycles');
      if (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]')
        throw new Error('script state must contain plain JSON objects');
      seen.add(value);
      for (const item of Object.values(value)) check(item);
      seen.delete(value);
    };
    check(data);
    states[currentOwner] = deepFreeze(cloneJson(data));
  };
  let staging: StagedRegistration | undefined;
  let currentRng = (): number => world._internal().getRng().next();
  let currentCtx: TickContext | undefined;
  const manifest = opts?.manifest;
  const validateEnabled = opts?.validate ?? true;

  function rawQuery(names: string[]): QueryResult<JsonObject[]> {
    return (world.query as (...c: ComponentType<JsonObject>[]) => QueryResult<JsonObject[]>)(
      ...names.map(comp),
    );
  }

  function wrapQuery(q: QueryResult<JsonObject[]>): ScriptQuery {
    return {
      ids: () => q.ids(),
      count: () => q.count(),
      first: () => q.first(),
      without: (...names) => wrapQuery(q.without(...names.map(comp))),
      [Symbol.iterator]: () => q[Symbol.iterator](),
    };
  }

  const molen: ScriptAPI = {
    get state() {
      return deepFreeze(readState());
    },
    setState: writeState,
    patchState: (partial) => writeState(patchJson(readState(), partial)),
    spawn: ((
      first: Record<string, JsonObject> | string,
      second?: EntityId | Record<string, JsonObject>,
      third?: EntityId,
    ): EntityId => {
      if (typeof first === 'string') {
        if (manifest === undefined) {
          throw new Error(
            `script spawn("${first}", …) by prefab needs a scene manifest; pass { manifest } to installScripting`,
          );
        }
        const layered = second !== undefined && typeof second === 'object' ? second : undefined;
        const id = third ?? (typeof second === 'string' ? second : undefined);
        const components = resolveEntityComponents(
          manifest,
          {
            prefab: first,
            ...(layered !== undefined ? { components: layered } : {}),
          },
          { types: opts?.types },
        );
        return world.spawn(components, {
          ...(id !== undefined ? { id } : {}),
          validate: validateEnabled,
        });
      }
      const id = typeof second === 'string' ? second : undefined;
      return world.spawn(first, { ...(id !== undefined ? { id } : {}), validate: validateEnabled });
    }) as ScriptAPI['spawn'],
    spawnType: (type, components, id) => {
      const resolved = resolveEntityComponents(
        manifest ?? ({ prefabs: {} } as SceneManifest),
        { type, components },
        { types: opts?.types },
      );
      return world.spawn(resolved, { id, validate: validateEnabled });
    },
    destroy: (id) => world.destroy(id),
    exists: (id) => world.exists(id),
    get: (id, c) => world.get(id, comp(c)) as JsonObject | undefined,
    set: (id, c, data) => {
      if (validateEnabled) {
        const issues = blockingIssues(
          componentIssues(c, data, `/${c}`, { registry: world.componentRegistry }),
        );
        if (issues.length > 0)
          throw new Error(formatIssues(`script set "${c}" on entity "${id}"`, issues));
      }
      world.set(id, comp(c), data);
    },
    patch: (id, c, partial) => {
      if (validateEnabled) {
        const current = world.get(id, comp(c));
        if (current === undefined)
          throw new Error(`cannot patch missing component "${c}" on entity "${id}"`);
        const issues = blockingIssues(
          componentIssues(c, patchJson(current, partial), `/${c}`, {
            registry: world.componentRegistry,
          }),
        );
        if (issues.length > 0)
          throw new Error(formatIssues(`script patch "${c}" on entity "${id}"`, issues));
      }
      world.patch(id, comp(c), partial);
    },
    remove: (id, c) => world.remove(id, comp(c)),
    has: (id, c) => world.has(id, comp(c)),
    query: (...names) => wrapQuery(rawQuery(names)),
    on(event, handler) {
      if (event === 'tick') {
        const h: TickHandler = { owner: currentOwner, fn: handler };
        const target = staging?.ticks ?? tickHandlers;
        target.push(h);
        return () => {
          const i = target.indexOf(h);
          if (i >= 0) target.splice(i, 1);
        };
      }
      if (staging !== undefined) {
        const target = staging.events;
        const staged: StagedEventHandler = { event, fn: handler };
        target.push(staged);
        return () => {
          const i = target.indexOf(staged);
          if (i >= 0) target.splice(i, 1);
        };
      }
      return subscribeEvent(currentOwner, event, handler);
    },
    onCommand(type, handler) {
      if (!world.hasCommand(type)) {
        throw new Error(
          `script "${currentOwner}" handles undeclared command "${type}"; declare it in scene.commands first`,
        );
      }
      if (staging !== undefined) {
        const target = staging.commands;
        const staged: StagedCommandHandler = { type, fn: handler };
        target.push(staged);
        return () => {
          const i = target.indexOf(staged);
          if (i >= 0) target.splice(i, 1);
        };
      }
      return subscribeCommand(currentOwner, type, handler);
    },
    emit: (type, payload) => world.emit(type, payload),
    raycast: (origin, dir, maxDist, mask) => raycast(world, origin, dir, maxDist, mask),
    overlapCircle: (center, radius, mask) => overlapCircle(world, center, radius, mask),
    after: (ticks, event, payload) =>
      scheduleTimer(world, null, {
        ticks,
        event,
        ...(payload !== undefined ? { payload } : {}),
      }),
    every: (ticks, event, payload) =>
      scheduleTimer(world, null, {
        ticks,
        event,
        repeatEvery: ticks,
        ...(payload !== undefined ? { payload } : {}),
      }),
    cancelTimer: (timerId, entity) => cancelWorldTimer(world, entity ?? null, timerId),
    tween: (entity, spec) => startTween(world, entity, spec),
    cancelTween: (entity, tweenId) => cancelWorldTween(world, entity, tweenId),
    parent: (id, parentId) => setParent(world, id, parentId),
    unparent: (id) => unparentEntity(world, id),
    rng: () => currentRng(),
    get tick() {
      return world.tick;
    },
    get dt() {
      return currentCtx?.dt ?? world.dt;
    },
    math: dmath,
  };

  // Capability extensions become frozen namespaces on the global (molen.physics.*, …).
  // defineProperty (not spread) so the tick/dt getters above stay live.
  for (const [key, value] of Object.entries(opts?.extensions ?? {})) {
    if (key in molen) throw new Error(`scripting extension "${key}" collides with a core verb`);
    // deepFreeze is typed for JsonValue; extension namespaces are plain function bags.
    Object.defineProperty(molen, key, {
      value: deepFreeze(value as unknown as never),
      enumerable: true,
    });
  }
  // One shared verb object for every script: freeze it so no script can rewrite a verb.
  Object.freeze(molen);

  /**
   * Run a script handler with owner/ctx bookkeeping so `molen.rng()`/`molen.dt` are correct in any
   * phase (tick, event, or command), and attribute any throw to the script.
   */
  function runHandler(owner: string, kind: string, ctx: TickContext, fn: () => void): void {
    const previousOwner = currentOwner;
    const previousCtx = currentCtx;
    const previousRng = currentRng;
    currentOwner = owner;
    currentCtx = ctx;
    currentRng = () => ctx.rng.next();
    try {
      fn();
    } catch (error) {
      throw attributeError(owner, kind, ctx.tick, error);
    } finally {
      currentOwner = previousOwner;
      currentCtx = previousCtx;
      currentRng = previousRng;
    }
  }

  function subscribeEvent(
    owner: string,
    event: string,
    handler: (payload: JsonValue, ctx: TickContext) => void,
  ): Unsubscribe {
    const unsub = world.on(event, (e, ctx) => {
      runHandler(owner, `event "${event}"`, ctx, () => handler(e.payload, ctx));
    });
    eventSubs.push({ owner, unsub });
    return unsub;
  }

  function subscribeCommand(owner: string, type: string, fn: ScriptCommandHandler): Unsubscribe {
    const unsub = world.onCommand(type, (_w, command, ctx) => {
      runHandler(owner, `command "${type}"`, ctx, () => fn(command.payload, ctx, command));
    });
    commandSubs.push({ owner, unsub });
    return unsub;
  }

  function prepare(id: string, source: string, config: JsonObject): StagedRegistration {
    currentOwner = id;
    const prepared: StagedRegistration = { owner: id, ticks: [], events: [], commands: [] };
    staging = prepared;
    // The script's own copy of its config, frozen: the manifest object is never exposed.
    const frozenConfig = deepFreeze(cloneJson(config));
    try {
      const compartment = new Compartment({
        molen,
        config: frozenConfig,
        Math: tamedMath,
        JSON,
        console: scriptConsole(id),
        // Denied globals: shadow the host intrinsics so wall-clock, locale and deferred work
        // never reach a script. `Promise` is a determinism hazard, not just a style one:
        // `Promise.resolve().then(() => molen.set(...))` runs AFTER world.step() returns — after
        // the tick's hash, delta and keyframe were taken — so the mutation lands in a tick
        // nobody recorded. Scripts are synchronous by contract; use molen.after/molen.every for
        // "later". Shadowing with undefined makes the reach fail loudly at the use site.
        // (SES applies endowments with assign, so an undefined endowment hides the intrinsic.)
        Date: undefined,
        Intl: undefined,
        Promise: undefined,
      });
      const cglobal = (compartment as unknown as { globalThis: Record<string, unknown> })
        .globalThis;
      // Before evaluate: top-level `api.on(...)` is the common pre-rename shape, and it must
      // report the rename rather than a bare ReferenceError.
      defineRenamedGlobal(cglobal, id);
      try {
        compartment.evaluate(source);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`script "${id}" failed to evaluate: ${msg}`, { cause: error });
      }
      // Support a `function setup(molen, config)` declaration as an alternative to top-level code.
      const setupFn = cglobal.setup;
      if (typeof setupFn === 'function') {
        try {
          (setupFn as (a: ScriptAPI, c: JsonObject) => void)(molen, frozenConfig);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          throw new Error(`script "${id}" setup() failed: ${msg}`, { cause: error });
        }
      }
      if (prepared.ticks.length + prepared.events.length + prepared.commands.length === 0) {
        hostConsole()?.warn?.(
          `[molen] script "${id}" registered no tick/event/command handlers (molen.on / molen.onCommand was never called); it will never run.`,
        );
      }
      return prepared;
    } finally {
      staging = undefined;
      currentOwner = '';
    }
  }

  function commit(registration: StagedRegistration): void {
    tickHandlers.push(...registration.ticks);
    for (const event of registration.events) {
      subscribeEvent(registration.owner, event.event, event.fn);
    }
    for (const command of registration.commands) {
      subscribeCommand(registration.owner, command.type, command.fn);
    }
  }

  function dropOwner(id: string): void {
    for (let i = tickHandlers.length - 1; i >= 0; i--) {
      if (tickHandlers[i]?.owner === id) tickHandlers.splice(i, 1);
    }
    for (const subs of [eventSubs, commandSubs]) {
      for (let i = subs.length - 1; i >= 0; i--) {
        if (subs[i]?.owner === id) {
          subs[i]?.unsub();
          subs.splice(i, 1);
        }
      }
    }
  }

  const records = new Map<string, { source: string; config: JsonObject }>();
  for (const script of scripts) {
    if (records.has(script.id)) throw new Error(`duplicate script id "${script.id}"`);
    records.set(script.id, { source: script.source, config: script.config ?? {} });
  }
  const initial = scripts.map((script) => prepare(script.id, script.source, script.config ?? {}));
  for (const registration of initial) commit(registration);
  world.registerSnapshotProvider(
    '$scripts',
    () => ({
      requiresReplay: scripts.some((script) => script.checkpoint !== 'state'),
      states: cloneJson(states),
    }),
    (data) => {
      const saved = data as JsonObject;
      states = Object.assign(
        Object.create(null) as Record<string, JsonObject>,
        deepFreeze(cloneJson(saved.states as JsonObject)),
      );
    },
  );

  // Install the system only after every initial script evaluated successfully. A failed install
  // therefore leaves neither live subscriptions nor an orphaned system behind.
  world.addSystem(
    (_w, ctx) => {
      // Snapshot: a handler may unsubscribe itself (or others) mid-tick.
      for (const h of [...tickHandlers]) {
        runHandler(h.owner, 'tick', ctx, () => h.fn(null, ctx));
      }
    },
    { phase: 'update', name: 'scripts' },
  );

  return {
    get count() {
      return records.size;
    },
    reload(id, source) {
      const config = records.get(id)?.config ?? {};
      const registration = prepare(id, source, config);
      // Only after evaluation succeeds do we remove the live behavior and swap in the new one.
      dropOwner(id);
      commit(registration);
      records.set(id, { source, config });
    },
  };
}

const NOOP_HOST: ScriptHost = { reload: () => {}, count: 0 };

/**
 * Install the scripts declared in a scene manifest's `scripts` field as scene data — no setup
 * module required. Maps the wire field `code` to the host's `source` and threads the manifest so
 * scripts can `molen.spawn(prefabName, …)`. Returns a no-op host when the manifest has no scripts.
 * Scripts still carrying an unresolved `path` (a file ref) throw — the kernel is fs-free; run
 * the manifest through the tooling scene loader (which inlines `path` into `code`) first.
 */
export function installSceneScripts(
  world: World,
  manifest: SceneManifest,
  opts?: { validate?: boolean; extensions?: Record<string, object>; types?: ResolvedTypes },
): ScriptHost {
  const scripts = manifest.scripts ?? [];
  if (scripts.length === 0) return NOOP_HOST;
  const loaded: LoadedScript[] = scripts.map((s) => {
    if (s.code === undefined) {
      throw new Error(
        `script "${s.id}" has no inline code${
          s.path !== undefined
            ? ` (unresolved path "${s.path}" — script files are resolved before the kernel sees them: the tooling scene loader in Node, the molenScripts() Vite plugin in the browser; a scene fetched at runtime must carry inline code)`
            : ''
        }`,
      );
    }
    return { id: s.id, source: s.code, config: s.config, checkpoint: s.checkpoint };
  });
  return installScripting(world, loaded, { manifest, ...opts });
}
