/**
 * `installAmbient(world)`: the capability entry point. Registers the transport network on the
 * world (outside world state), the `ambient-spawn` and `ambient-agents` physics systems, the
 * `ambient.observer` and `ambient.policy` commands, and returns the handle hosts and scripts use.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  componentHandle,
  type JsonObject,
  Transform,
  type World,
} from '@bendyline/molen-kernel/world';
import type { EntityId, JsonValue, PayloadCheck } from '@bendyline/molen-schema';
import { type AmbientSolid, agentSample, stepAgents } from './agents/step';
import {
  AMBIENT_ENTITY,
  AMBIENT_KINDS,
  AmbientAgent,
  type AmbientKind,
  AmbientState,
  type AmbientStateData,
} from './components';
import type { TransportNetworkDocument } from './graph/doc';
import {
  type AmbientPolyline,
  type AmbientTileInput,
  TransportNetwork,
  type TransportNetworkStats,
} from './graph/network';
import { laneSample } from './graph/sample';
import type { LaneSample, TransportClass } from './graph/types';
import {
  type AmbientBudget,
  type AmbientPolicy,
  DEFAULT_POLICY,
  type DeepPartial,
  mergePolicy,
  policyForBudget,
} from './spawn/policy';
import {
  ambientSeed,
  despawnAgents,
  observerPolicy,
  resolveObserver,
  spawnAgents,
} from './spawn/spawner';
import {
  type AmbientTemplate,
  type AmbientTypes,
  DEFAULT_TEMPLATES,
  DEFAULT_TYPES,
} from './templates';

export interface AmbientOptions {
  /** Which side of the road traffic keeps to (default 'right'). */
  traffic?: 'right' | 'left';
  /** Tunnels: keep them with hidden agents (default) or drop them. */
  tunnels?: 'hidden' | 'skip';
  /** Ground height for documents, aircraft and tiles without their own sampler (default 0). */
  ground?: (x: number, z: number) => number;
  /** Which classes run (default ['car']). */
  classes?: readonly AmbientKind[];
  /** Policy overrides (rings, densities, caps, driver parameters). */
  policy?: DeepPartial<AmbientPolicy>;
  /** Vehicle and pedestrian types per class (default: proxy dimensions). */
  types?: Partial<AmbientTypes>;
  /** Extra components per class; `null` spawns bare agents (ambientAgent + transform only). */
  templates?: Partial<Record<AmbientKind, AmbientTemplate | null>>;
  /** Seed for spawn draws (default: 'ambient'). */
  seed?: string | number;
  /** Cars yield to vehicles someone is driving (`mounted` riders); default true. */
  yieldToDriven?: boolean;
}

export interface AmbientStats {
  network: TransportNetworkStats;
  agents: Record<AmbientKind, number>;
  waiting: number;
  spawned: number;
  despawned: number;
  pendingTiles: number;
}

/** An oriented box on the ground (for host collision queries). */
export interface AmbientBox {
  center: readonly [number, number, number];
  /** Half extents: x across, y up, z along. */
  halfSize: readonly [number, number, number];
  /** Yaw about +Y (0 = +Z forward). */
  yaw: number;
}

export interface AmbientHandle {
  readonly world: World;
  readonly network: TransportNetwork;
  /** Queue a streamed tile (applied at the next tick, or by `flush()`). */
  registerTile(tile: AmbientTileInput): void;
  unregisterTile(key: string): void;
  /** Apply queued tile changes now (outside a tick). */
  flush(): void;
  addDocument(doc: TransportNetworkDocument): void;
  addPolyline(line: AmbientPolyline): void;
  setObserver(
    observer:
      | { pos: readonly [number, number, number]; forward?: readonly [number, number] }
      | { entity: EntityId }
      | null,
  ): void;
  /** Persistent policy overrides (recorded in world state). */
  setPolicy(policy: DeepPartial<AmbientPolicy>): void;
  /** Host budget: caps and ring size (not recorded; hosts reapply after a restore). */
  setBudget(budget: AmbientBudget): void;
  /** Extra solids cars yield to (e.g. the walking player). */
  setSolids(solids: readonly AmbientSolid[]): void;
  policy(): AmbientPolicy;
  stats(): AmbientStats;
  laneAt(
    x: number,
    z: number,
    opts?: { class?: TransportClass; radius?: number },
  ): { lane: string; s: number; distance: number } | undefined;
  laneSample(lane: string, s: number): LaneSample | undefined;
  agentsNear(x: number, z: number, radius: number, kind?: AmbientKind): EntityId[];
  /** Whether an ambient car overlaps a box (for a host vehicle solver's `canOccupy`). */
  blocks(box: AmbientBox, except?: EntityId): boolean;
  despawnAll(kind?: AmbientKind): void;
  dispose(): void;
}

const handles = new WeakMap<World, AmbientHandle>();
const Mounted = componentHandle('mounted');
const Collider = componentHandle('collider');

function checkObserverPayload(payload: JsonValue): PayloadCheck {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
    return { ok: false, message: 'ambient.observer payload must be an object' };
  const p = payload as JsonObject;
  if (p.clear === true) return { ok: true };
  if (typeof p.entity === 'string' && p.entity.length > 0) return { ok: true };
  const pos = p.pos;
  if (
    !Array.isArray(pos) ||
    pos.length !== 3 ||
    !pos.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
    return {
      ok: false,
      message: 'ambient.observer needs pos: [x, y, z], entity: "<id>", or clear: true',
    };
  const forward = p.forward;
  if (
    forward !== undefined &&
    (!Array.isArray(forward) ||
      forward.length !== 2 ||
      !forward.every((v) => typeof v === 'number' && Number.isFinite(v)))
  )
    return { ok: false, message: 'ambient.observer forward must be [x, z]' };
  return { ok: true };
}

function checkPolicyPayload(payload: JsonValue): PayloadCheck {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? { ok: true }
    : { ok: false, message: 'ambient.policy payload must be an object of policy overrides' };
}

/** Install the ambient systems (idempotent per world) and return the handle. */
export function installAmbient(world: World, options: AmbientOptions = {}): AmbientHandle {
  const existing = handles.get(world);
  if (existing !== undefined) return existing;
  const ground = options.ground ?? (() => 0);
  const network = new TransportNetwork({
    traffic: options.traffic ?? 'right',
    tunnels: options.tunnels ?? 'hidden',
    ground,
  });
  const classes = new Set<AmbientKind>(options.classes ?? ['car']);
  network.setClasses([
    ...(classes.has('car') ? (['road'] as const) : []),
    ...(classes.has('pedestrian') ? (['walk'] as const) : []),
    ...(classes.has('train') ? (['rail'] as const) : []),
  ]);
  const base = mergePolicy(
    DEFAULT_POLICY,
    {
      car: { enabled: classes.has('car') },
      pedestrian: { enabled: classes.has('pedestrian') },
      train: { enabled: classes.has('train') },
      aircraft: { enabled: classes.has('aircraft') },
    },
    options.policy,
  );
  const types: AmbientTypes = { ...DEFAULT_TYPES, ...options.types };
  for (const kind of ['car', 'train', 'aircraft', 'pedestrian'] as const)
    if ((types[kind] as unknown[]).length === 0)
      (types as unknown as Record<string, unknown>)[kind] = DEFAULT_TYPES[kind];
  const templates = {} as Record<AmbientKind, AmbientTemplate | null>;
  for (const kind of AMBIENT_KINDS)
    templates[kind] =
      options.templates?.[kind] !== undefined
        ? (options.templates[kind] ?? null)
        : DEFAULT_TEMPLATES[kind];
  const seed = ambientSeed(options.seed ?? 'ambient');
  const yieldToDriven = options.yieldToDriven ?? true;
  let budget: AmbientBudget = {};
  let solids: readonly AmbientSolid[] = [];
  const pending: ({ op: 'add'; tile: AmbientTileInput } | { op: 'remove'; key: string })[] = [];

  if (!world.exists(AMBIENT_ENTITY))
    world.spawnRaw({ ambientState: { nextSeq: 0, spawned: 0, despawned: 0 } }, AMBIENT_ENTITY);

  let cachedFor: unknown;
  let cachedBudget: AmbientBudget | undefined;
  let cached: AmbientPolicy = base;
  const effectivePolicy = (): AmbientPolicy => {
    const overrides = world.get(AMBIENT_ENTITY, AmbientState)?.policy;
    if (overrides !== cachedFor || budget !== cachedBudget) {
      cached = policyForBudget(mergePolicy(base, overrides), budget);
      cachedFor = overrides;
      cachedBudget = budget;
    }
    return cached;
  };

  const flush = (): void => {
    for (const change of pending.splice(0)) {
      if (change.op === 'add') network.registerTile(change.tile);
      else network.unregisterTile(change.key);
    }
  };

  const writeState = (patch: Partial<AmbientStateData>): void => {
    const current = world.get(AMBIENT_ENTITY, AmbientState) ?? {
      nextSeq: 0,
      spawned: 0,
      despawned: 0,
    };
    const next: AmbientStateData = { ...current, ...patch };
    for (const key of Object.keys(patch) as (keyof AmbientStateData)[])
      if (patch[key] === undefined) delete next[key];
    world.set(AMBIENT_ENTITY, AmbientState, next);
  };

  world.addSystem(
    (w, ctx) => {
      flush();
      const state = w.get(AMBIENT_ENTITY, AmbientState);
      const observer = resolveObserver(w, state);
      const policy = observerPolicy(effectivePolicy(), observer);
      const env = {
        net: network,
        policy,
        tick: ctx.tick,
        tickRate: w.tickRate,
        types,
        templates,
        seed,
        ground,
      };
      const removed = despawnAgents(w, env, observer);
      const counters = { nextSeq: state?.nextSeq ?? 0, spawned: state?.spawned ?? 0 };
      if (observer !== undefined && ctx.tick % dmath.max(1, policy.spawnEveryTicks) === 0)
        spawnAgents(w, env, observer, counters);
      if (removed > 0 || counters.nextSeq !== (state?.nextSeq ?? 0))
        writeState({
          nextSeq: counters.nextSeq,
          spawned: counters.spawned,
          despawned: (state?.despawned ?? 0) + removed,
        });
    },
    { phase: 'physics', name: 'ambient-spawn', priority: -10 },
  );

  world.addSystem(
    (w, ctx) => {
      const driven: AmbientSolid[] = [...solids];
      // A scene's observer entity (the player) is something traffic stops for.
      const watcher = w.get(AMBIENT_ENTITY, AmbientState)?.observer?.entity;
      const watched = watcher !== undefined ? w.get(watcher, Transform) : undefined;
      if (watcher !== undefined && watched !== undefined) {
        const radius = w.get(watcher, Collider)?.radius;
        driven.push({
          x: watched.pos[0],
          z: watched.pos[2],
          radius: typeof radius === 'number' ? radius : 1,
        });
      }
      if (yieldToDriven)
        for (const [, mounted] of w.query(Mounted)) {
          const vehicle = typeof mounted.vehicle === 'string' ? mounted.vehicle : undefined;
          const t = vehicle !== undefined ? w.get(vehicle, Transform) : undefined;
          if (t !== undefined) driven.push({ x: t.pos[0], z: t.pos[2], radius: 2.6 });
        }
      stepAgents(w, {
        net: network,
        policy: effectivePolicy(),
        tick: ctx.tick,
        tickRate: w.tickRate,
        dt: ctx.dt,
        solids: driven,
      });
    },
    { phase: 'physics', name: 'ambient-agents', priority: 0 },
  );

  world.registerCommand(
    'ambient.observer',
    (w, command) => {
      const p = command.payload as JsonObject;
      const tick = w.tick;
      if (p.clear === true) writeState({ observer: undefined });
      else if (typeof p.entity === 'string')
        writeState({ observer: { entity: p.entity, setAtTick: tick } });
      else
        writeState({
          observer: {
            pos: p.pos as [number, number, number],
            ...(Array.isArray(p.forward) ? { forward: p.forward as [number, number] } : {}),
            setAtTick: tick,
          },
        });
    },
    { validatePayload: checkObserverPayload },
  );
  world.registerCommand(
    'ambient.policy',
    (w, command) => {
      const current = w.get(AMBIENT_ENTITY, AmbientState)?.policy ?? {};
      writeState({
        policy: mergePolicy(
          current as unknown as AmbientPolicy,
          command.payload as JsonObject,
        ) as unknown as JsonObject,
      });
    },
    { validatePayload: checkPolicyPayload },
  );

  const sample = laneSample();
  const handle: AmbientHandle = {
    world,
    network,
    registerTile(tile) {
      pending.push({ op: 'add', tile });
    },
    unregisterTile(key) {
      pending.push({ op: 'remove', key });
    },
    flush,
    addDocument(doc) {
      network.addDocument(doc);
    },
    addPolyline(line) {
      network.addPolyline(line);
    },
    setObserver(observer) {
      if (observer === null) writeState({ observer: undefined });
      else if ('entity' in observer)
        writeState({ observer: { entity: observer.entity, setAtTick: world.tick } });
      else
        writeState({
          observer: {
            pos: [observer.pos[0], observer.pos[1], observer.pos[2]],
            ...(observer.forward !== undefined
              ? { forward: [observer.forward[0], observer.forward[1]] as [number, number] }
              : {}),
            setAtTick: world.tick,
          },
        });
    },
    setPolicy(policy) {
      const current = world.get(AMBIENT_ENTITY, AmbientState)?.policy ?? {};
      writeState({
        policy: mergePolicy(current as unknown as AmbientPolicy, policy) as unknown as JsonObject,
      });
    },
    setBudget(next) {
      budget = { ...next };
    },
    setSolids(next) {
      solids = [...next];
    },
    policy: effectivePolicy,
    stats() {
      const agents: Record<AmbientKind, number> = { car: 0, pedestrian: 0, train: 0, aircraft: 0 };
      let waiting = 0;
      for (const [, a] of world.query(AmbientAgent)) {
        agents[a.kind]++;
        if (a.state === 'wait') waiting++;
      }
      const state = world.get(AMBIENT_ENTITY, AmbientState);
      return {
        network: network.stats(),
        agents,
        waiting,
        spawned: state?.spawned ?? 0,
        despawned: state?.despawned ?? 0,
        pendingTiles: pending.length,
      };
    },
    laneAt: (x, z, opts) => network.laneAt(x, z, opts),
    laneSample: (lane, s) => network.sampleLane(lane, s, laneSample()),
    agentsNear(x, z, radius, kind) {
      const out: EntityId[] = [];
      for (const [id, a, t] of world.query(AmbientAgent, Transform)) {
        if (kind !== undefined && a.kind !== kind) continue;
        if (dmath.hypot(t.pos[0] - x, t.pos[2] - z) <= radius) out.push(id);
      }
      return out;
    },
    blocks(box, except) {
      const cos = dmath.cos(box.yaw);
      const sin = dmath.sin(box.yaw);
      for (const [id, a] of world.query(AmbientAgent)) {
        if (id === except || (a.kind !== 'car' && a.kind !== 'train')) continue;
        const at = agentSample(network, a, sample);
        if (at === undefined) continue;
        const reach = dmath.hypot(box.halfSize[0], box.halfSize[2]) + a.length / 2 + 1;
        if (dmath.hypot(at.x - box.center[0], at.z - box.center[2]) > reach) continue;
        if (dmath.abs(at.y + 0.8 - box.center[1]) > box.halfSize[1] + 0.8) continue;
        // Separating axes of two oriented rectangles in XZ.
        const ax: [number, number][] = [
          [sin, cos],
          [cos, -sin],
          [at.dx, at.dz],
          [at.dz, -at.dx],
        ];
        const ox = at.x - box.center[0];
        const oz = at.z - box.center[2];
        let separated = false;
        for (const [nx, nz] of ax) {
          const distance = dmath.abs(ox * nx + oz * nz);
          const r1 =
            box.halfSize[2] * dmath.abs(sin * nx + cos * nz) +
            box.halfSize[0] * dmath.abs(cos * nx - sin * nz);
          const r2 =
            (a.length / 2) * dmath.abs(at.dx * nx + at.dz * nz) +
            (a.width / 2) * dmath.abs(at.dz * nx - at.dx * nz);
          if (distance > r1 + r2) {
            separated = true;
            break;
          }
        }
        if (!separated) return true;
      }
      return false;
    },
    despawnAll(kind) {
      for (const [id, a] of world.query(AmbientAgent))
        if (kind === undefined || a.kind === kind) world.destroy(id);
    },
    dispose() {
      world.removeSystem('ambient-spawn');
      world.removeSystem('ambient-agents');
      for (const [id] of world.query(AmbientAgent)) world.destroy(id);
      if (world.exists(AMBIENT_ENTITY)) world.destroy(AMBIENT_ENTITY);
      network.clear();
      handles.delete(world);
    },
  };
  handles.set(world, handle);
  return handle;
}

/** The ambient handle installed on a world, if any. */
export function ambientOf(world: World): AmbientHandle | undefined {
  return handles.get(world);
}
