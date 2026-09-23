import type { EntityId, JsonObject, JsonValue } from '@bendyline/molen-schema';
import { cloneJson } from './clone';
import {
  componentHandle,
  defineComponent,
  Lifetime,
  Transform,
  type TransformData,
} from './component';
import {
  composeTransforms,
  type Quat,
  quatMul,
  quatNormalize,
  quatRotateVec3,
  type TransformLike,
  type Vec3,
} from './math3d';
import type { World } from './world';

// The gameplay layer: hierarchy, lifetime, timers, tweens, FSM — all component data, all
// snapshot/replay-safe (no callbacks, no closure state). installGameplay wires the systems;
// createWorldFromScene installs it by default.
//
// Delta note: `lifetime` and `timer` are countdowns, so every entity carrying one appears in
// every delta while it is active (whole-component replacement). That is the price of keeping
// them legible component data rather than a kernel-private side store; keep long-lived
// counters on few entities, not thousands.

// --- components ---

export interface ParentData extends JsonObject {
  id: string;
  onParentDestroyed?: 'destroy' | 'detach';
}
export const Parent: import('./component').ComponentType<ParentData> =
  defineComponent<ParentData>('parent');

export const LocalTransform: import('./component').ComponentType<TransformData> =
  defineComponent<TransformData>('localTransform');

export interface TimerEntry extends JsonObject {
  id: string;
  ticksLeft: number;
  event: string;
  payload?: JsonValue;
  repeatEvery?: number;
}
export interface TimerData extends JsonObject {
  timers: TimerEntry[];
}
export const Timer: import('./component').ComponentType<TimerData> =
  defineComponent<TimerData>('timer');

interface TimerSequenceData extends JsonObject {
  next: number;
}
const TimerSequence: import('./component').ComponentType<TimerSequenceData> =
  defineComponent<TimerSequenceData>('timerSequence');

export type Easing =
  | 'linear'
  | 'quadIn'
  | 'quadOut'
  | 'quadInOut'
  | 'cubicIn'
  | 'cubicOut'
  | 'cubicInOut';

export interface TweenEntry extends JsonObject {
  id?: string;
  component: string;
  /** Select-style value path within the component, e.g. "pos", "pos[1]", "primitive.size". */
  path: string;
  from?: number | number[];
  to: number | number[];
  ticks: number;
  /** Kernel-owned progress (snapshot-safe). */
  elapsed?: number;
  easing?: Easing;
  loop?: 'none' | 'loop' | 'pingpong';
  emitOnComplete?: string;
}
export interface TweenData extends JsonObject {
  tweens: TweenEntry[];
}
export const Tween: import('./component').ComponentType<TweenData> =
  defineComponent<TweenData>('tween');

export interface FsmTransition extends JsonObject {
  from: string;
  event: string;
  to: string;
}
export interface FsmData extends JsonObject {
  state: string;
  transitions: FsmTransition[];
}
export const Fsm: import('./component').ComponentType<FsmData> = defineComponent<FsmData>('fsm');

/** Kernel-owned singleton entity id for world-scoped timers ("$" prefix is reserved). */
export const TIMERS_SINGLETON = '$timers';

// --- hierarchy (late phase, after physics: parents moved by physics propagate same-tick) ---

export function installHierarchy(world: World): void {
  world.addSystem(
    (w) => {
      const rows: { id: EntityId; parent: ParentData }[] = [];
      for (const [id, parent] of w.query(Parent)) rows.push({ id, parent });

      // Dangling parents: apply the death policy (cascade destroy is depth-first via re-runs).
      const alive = new Set<EntityId>();
      for (const { id } of rows) alive.add(id);
      for (const { id, parent } of rows) {
        if (w.exists(parent.id)) continue;
        if ((parent.onParentDestroyed ?? 'destroy') === 'destroy') {
          w.destroy(id);
        } else {
          w.remove(id, Parent);
        }
        alive.delete(id);
      }

      // Resolve world transforms depth-first from roots; skip cycles (emit once per entity).
      const byId = new Map<EntityId, ParentData>();
      for (const { id, parent } of rows) {
        if (alive.has(id)) byId.set(id, parent);
      }
      const resolved = new Map<EntityId, TransformLike>();
      const visiting = new Set<EntityId>();
      const worldTransform = (id: EntityId): TransformLike | undefined => {
        const cached = resolved.get(id);
        if (cached !== undefined) return cached;
        const t = w.get(id, Transform);
        const parent = byId.get(id);
        if (parent === undefined) {
          if (t === undefined) return undefined;
          const root: TransformLike = {
            pos: t.pos as Vec3,
            rot: (t.rot ?? [0, 0, 0, 1]) as Quat,
            ...(t.scale !== undefined ? { scale: t.scale as Vec3 } : {}),
          };
          resolved.set(id, root);
          return root;
        }
        if (visiting.has(id)) {
          w.emit('hierarchy-error', { entity: id, code: 'cycle' });
          return undefined;
        }
        visiting.add(id);
        const parentWorld = worldTransform(parent.id);
        visiting.delete(id);
        if (parentWorld === undefined) return undefined;
        const local = w.get(id, LocalTransform);
        const localLike: TransformLike =
          local !== undefined
            ? {
                pos: local.pos as Vec3,
                rot: (local.rot ?? [0, 0, 0, 1]) as Quat,
                ...(local.scale !== undefined ? { scale: local.scale as Vec3 } : {}),
              }
            : { pos: [0, 0, 0], rot: [0, 0, 0, 1] };
        const composed = composeTransforms(parentWorld, localLike);
        resolved.set(id, composed);
        return composed;
      };

      for (const { id } of rows) {
        if (!alive.has(id) || !byId.has(id)) continue;
        const composed = worldTransform(id);
        if (composed === undefined) continue;
        const current = w.get(id, Transform);
        const next: TransformData = {
          pos: composed.pos,
          rot: (composed.rot ?? [0, 0, 0, 1]) as Quat,
          ...(composed.scale !== undefined ? { scale: composed.scale } : {}),
        };
        // Patch only when numerically different to avoid per-tick delta noise.
        if (current === undefined || JSON.stringify(current) !== JSON.stringify(next)) {
          w.set(id, Transform, next);
        }
      }
    },
    { phase: 'late', name: 'hierarchy' },
  );
}

/** Set a parent, initializing localTransform so the child keeps its current world pose. */
export function setParent(world: World, id: EntityId, parentId: EntityId): void {
  const child = world.get(id, Transform);
  const parent = world.get(parentId, Transform);
  world.set(id, Parent, { id: parentId });
  if (child === undefined || parent === undefined) return;
  // local = parent⁻¹ ∘ child (ignoring parent scale for the keep-world approximation).
  const pr: Quat = (parent.rot ?? [0, 0, 0, 1]) as Quat;
  const inv: Quat = [-pr[0], -pr[1], -pr[2], pr[3]];
  const dp: Vec3 = [
    child.pos[0] - parent.pos[0],
    child.pos[1] - parent.pos[1],
    child.pos[2] - parent.pos[2],
  ];
  const localPos = quatRotateVec3(inv, dp);
  const localRot = quatNormalize(quatMul(inv, (child.rot ?? [0, 0, 0, 1]) as Quat));
  world.set(id, LocalTransform, { pos: localPos, rot: localRot });
}

export function unparent(world: World, id: EntityId): void {
  world.remove(id, Parent);
  world.remove(id, LocalTransform);
}

// --- lifetime (late phase, after hierarchy) ---

export function installLifetime(world: World): void {
  world.addSystem(
    (w) => {
      for (const [id, lifetime] of w.query(Lifetime)) {
        const left = lifetime.ticksLeft - 1;
        if (left <= 0) {
          w.emit('lifetime-expired', { entity: id });
          w.destroy(id);
        } else {
          w.patch(id, Lifetime, { ticksLeft: left });
        }
      }
    },
    { phase: 'late', name: 'lifetime' },
  );
}

// --- timers (update phase, before scene scripts) ---

export function installTimers(world: World): void {
  world.addSystem(
    (w) => {
      for (const [id, data] of w.query(Timer)) {
        const kept: TimerEntry[] = [];
        const due: TimerEntry[] = [];
        for (const entry of data.timers) {
          const left = entry.ticksLeft - 1;
          if (left > 0) {
            kept.push({ ...entry, ticksLeft: left });
            continue;
          }
          due.push(entry);
          if (entry.repeatEvery !== undefined) {
            kept.push({ ...entry, ticksLeft: entry.repeatEvery });
          }
        }
        // Publish the next state before callbacks: handlers may chain or cancel timers.
        w.set(id, Timer, { timers: kept });
        for (const entry of due) {
          w.emit(entry.event, {
            entity: id,
            timerId: entry.id,
            ...(entry.payload !== undefined && entry.payload !== null
              ? { payload: entry.payload }
              : {}),
          });
        }
        if (w.get(id, Timer)?.timers.length === 0) w.remove(id, Timer);
      }
    },
    { phase: 'update', name: 'timers' },
  );
}

export interface TimerSpec {
  ticks: number;
  event: string;
  payload?: JsonValue;
  repeatEvery?: number;
  id?: string;
}

/** Schedule a timer on an entity (null -> the kernel-owned $timers singleton). Returns its id. */
export function scheduleTimer(world: World, entity: EntityId | null, spec: TimerSpec): string {
  const target = entity ?? TIMERS_SINGLETON;
  if (!world.exists(target) && !world._internal().pendingSpawnIds.has(target))
    world.spawnRaw({}, target);
  const existing = world.get(target, Timer);
  let timerId = spec.id;
  if (timerId === undefined) {
    if (!world.exists(TIMERS_SINGLETON) && !world._internal().pendingSpawnIds.has(TIMERS_SINGLETON))
      world.spawnRaw({}, TIMERS_SINGLETON);
    const sequence = world.get(TIMERS_SINGLETON, TimerSequence)?.next ?? 0;
    timerId = `t${sequence}_${world.tick}`;
    world.set(TIMERS_SINGLETON, TimerSequence, { next: sequence + 1 });
  }
  const entry: TimerEntry = {
    id: timerId,
    ticksLeft: Math.max(1, spec.ticks),
    event: spec.event,
    ...(spec.payload !== undefined ? { payload: spec.payload } : {}),
    ...(spec.repeatEvery !== undefined ? { repeatEvery: spec.repeatEvery } : {}),
  };
  world.set(target, Timer, { timers: [...(existing?.timers ?? []), entry] });
  return timerId;
}

export function cancelTimer(world: World, entity: EntityId | null, timerId: string): void {
  const target = entity ?? TIMERS_SINGLETON;
  const existing = world.get(target, Timer);
  if (existing === undefined) return;
  const timers = existing.timers.filter((t) => t.id !== timerId);
  world.set(target, Timer, { timers });
  if (timers.length === 0) world.remove(target, Timer);
}

// --- tweens (update phase, before scene scripts) ---

const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - (1 - t) * (1 - t) * (1 - t),
  cubicInOut: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2) * (-2 * t + 2)) / 2,
};

type PathSeg = { key: string } | { index: number };

function parsePath(path: string): PathSeg[] {
  const segs: PathSeg[] = [];
  for (const part of path.split('.')) {
    const m = /^([A-Za-z_$][\w$]*)?((?:\[\d+\])*)$/.exec(part);
    if (m === null) throw new Error(`bad tween path "${path}"`);
    if (m[1] !== undefined) segs.push({ key: m[1] });
    const idxs = m[2] ?? '';
    for (const im of idxs.matchAll(/\[(\d+)\]/g)) {
      segs.push({ index: Number(im[1]) });
    }
  }
  return segs;
}

function getAtPath(root: JsonValue, segs: PathSeg[]): JsonValue | undefined {
  let cur: JsonValue | undefined = root;
  for (const seg of segs) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = 'key' in seg ? (cur as JsonObject)[seg.key] : (cur as JsonValue[])[seg.index];
  }
  return cur;
}

function setAtPath(root: JsonValue, segs: PathSeg[], value: JsonValue): void {
  let cur: JsonValue = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i] as PathSeg;
    cur = (
      'key' in seg ? (cur as JsonObject)[seg.key] : (cur as JsonValue[])[seg.index]
    ) as JsonValue;
  }
  const last = segs[segs.length - 1] as PathSeg;
  if ('key' in last) (cur as JsonObject)[last.key] = value;
  else (cur as JsonValue[])[last.index] = value;
}

function lerpValue(from: number | number[], to: number | number[], t: number): JsonValue {
  if (typeof from === 'number' && typeof to === 'number') return from + (to - from) * t;
  const a = from as number[];
  const b = to as number[];
  return a.map((v, i) => v + ((b[i] ?? v) - v) * t);
}

export function installTweens(world: World): void {
  world.addSystem(
    (w) => {
      for (const [id, data] of w.query(Tween)) {
        const kept: TweenEntry[] = [];
        const events: { type: string; payload: JsonObject }[] = [];
        const emit = (type: string, payload: JsonObject): void => {
          events.push({ type, payload });
        };
        for (const tween of data.tweens) {
          const store = w.get(id, componentHandle(tween.component));
          if (store === undefined) {
            emit('tween-error', { entity: id, component: tween.component, code: 'missing' });
            continue;
          }
          let segs: PathSeg[];
          try {
            segs = parsePath(tween.path);
          } catch {
            emit('tween-error', { entity: id, component: tween.component, code: 'bad-path' });
            continue;
          }
          const from =
            tween.from ?? (getAtPath(store as JsonValue, segs) as number | number[] | undefined);
          if (from === undefined) {
            emit('tween-error', { entity: id, component: tween.component, code: 'bad-path' });
            continue;
          }
          const elapsed = (tween.elapsed ?? 0) + 1;
          const t = Math.min(1, elapsed / tween.ticks);
          const eased = EASINGS[tween.easing ?? 'linear'](t);
          const next = cloneJson(store) as JsonObject;
          setAtPath(next, segs, lerpValue(from, tween.to, eased));
          w.set(id, componentHandle(tween.component), next);

          if (t < 1) {
            kept.push({ ...tween, from, elapsed });
            continue;
          }
          emit('tween-complete', {
            entity: id,
            ...(tween.id !== undefined ? { id: tween.id } : {}),
          });
          if (tween.emitOnComplete !== undefined) emit(tween.emitOnComplete, { entity: id });
          if (tween.loop === 'loop') {
            kept.push({ ...tween, from, elapsed: 0 });
          } else if (tween.loop === 'pingpong') {
            kept.push({ ...tween, from: tween.to, to: from, elapsed: 0 });
          }
        }
        w.set(id, Tween, { tweens: kept });
        for (const event of events) w.emit(event.type, event.payload);
        if (w.get(id, Tween)?.tweens.length === 0) w.remove(id, Tween);
      }
    },
    { phase: 'update', name: 'tweens' },
  );
}

/** Start a tween on an entity (appends to its tween component). */
export function startTween(world: World, entity: EntityId, spec: TweenEntry): void {
  const existing = world.get(entity, Tween);
  world.set(entity, Tween, { tweens: [...(existing?.tweens ?? []), spec] });
}

export function cancelTween(world: World, entity: EntityId, tweenId?: string): void {
  const existing = world.get(entity, Tween);
  if (existing === undefined) return;
  const tweens = tweenId === undefined ? [] : existing.tweens.filter((t) => t.id !== tweenId);
  world.set(entity, Tween, { tweens });
  if (tweens.length === 0) world.remove(entity, Tween);
}

// --- FSM (event-driven; no per-tick system) ---

const FSM_MAX_CASCADE = 16;

export function installFsm(world: World): void {
  let depth = 0;
  world.on('*', (event) => {
    if (depth >= FSM_MAX_CASCADE) {
      // This diagnostic is delivered through the same wildcard listener. Emitting another one
      // while handling it would recurse forever at the cascade limit.
      if (event.type !== 'fsm-error') {
        world.emit('fsm-error', { code: 'cascade-limit', event: event.type });
      }
      return;
    }
    const target = (event.payload as { entity?: EntityId } | null)?.entity;
    depth++;
    try {
      for (const [id, fsm] of world.query(Fsm)) {
        if (target !== undefined && target !== id) continue;
        const transition = fsm.transitions.find(
          (tr) => tr.event === event.type && (tr.from === '*' || tr.from === fsm.state),
        );
        if (transition === undefined || transition.to === fsm.state) continue;
        w0Patch(world, id, fsm.state, transition.to);
      }
    } finally {
      depth--;
    }
  });
}

function w0Patch(world: World, id: EntityId, from: string, to: string): void {
  world.patch(id, Fsm, { state: to });
  world.emit('fsm-transition', { entity: id, from, to });
}

// --- the installer ---

export interface GameplayOptions {
  hierarchy?: boolean;
  lifetime?: boolean;
  timers?: boolean;
  tweens?: boolean;
  fsm?: boolean;
}

/** Install the gameplay systems (all on by default). createWorldFromScene calls this. */
export function installGameplay(world: World, opts?: GameplayOptions): void {
  if (opts?.timers !== false) installTimers(world);
  if (opts?.tweens !== false) installTweens(world);
  if (opts?.hierarchy !== false) installHierarchy(world);
  if (opts?.lifetime !== false) installLifetime(world);
  if (opts?.fsm !== false) installFsm(world);
}
