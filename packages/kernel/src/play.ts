import type {
  ComponentMap,
  ControllerData,
  CuesData,
  EngineEvent,
  EntityId,
  JsonObject,
  JsonValue,
  MoverData,
  PathData,
  PlayAction,
  PlayCondition,
  PlayTrigger,
  PlayVec3,
  RuleEntry,
  RulesData,
  SceneManifest,
  TriggerData,
  VarsData,
} from '@bendyline/molen-schema';
import { compareValues } from './assert';
import { AUDIO_PLAY } from './audio';
import { MoveIntent } from './character';
import { cloneJson } from './clone';
import { type ComponentType, componentHandle, defineComponent, Transform } from './component';
import { dmath } from './dmath';
import { scheduleTimer, startTween } from './gameplay';
import { KinematicBody } from './kinematics';
import { PlatformBody, PlatformIntent } from './platformer';
import { type ParsedSelector, parseSelector } from './select';
import type { TickContext, World } from './world';

// Choreography and rules of play as data (specs/authoring-layer.md). Six systems over seven
// components, every one of them snapshot-safe: all continuation state (path progress, wander
// headings, fired/was flags) lives in the components, so it reaches the state hash, keyframes
// and replays. Cross-platform determinism: only + - * /, dmath.sqrt/abs/min/max and the world
// RNG reach state; wander headings are eight fixed compass directions.
//
//   update  cues (priority -10)  timed actions
//   update  path, mover          motion (after tweens)
//   late    triggers (900)       touch { a, b } for overlapping trigger zones
//   late    rules (1000)         drains the tick's events, then time and edge triggers
//
// A failing rule emits `rule-error` and is disabled; nothing here ever throws out of a system.

export const Rules: ComponentType<RulesData> = defineComponent<RulesData>('rules');
export const Cues: ComponentType<CuesData> = defineComponent<CuesData>('cues');
export const Path: ComponentType<PathData> = defineComponent<PathData>('path');
export const Mover: ComponentType<MoverData> = defineComponent<MoverData>('mover');
export const Trigger: ComponentType<TriggerData> = defineComponent<TriggerData>('trigger');
export const Controller: ComponentType<ControllerData> =
  defineComponent<ControllerData>('controller');
export const Vars: ComponentType<VarsData & JsonObject> = defineComponent<VarsData & JsonObject>(
  'vars',
);

const TAG = componentHandle('tag');
const FIGURE_INTENT = componentHandle('figureIntent');
const CHARACTER = componentHandle('character');

/** Events the rules system emits about itself. */
export const RULE_ERROR = 'rule-error';
export const TOUCH = 'touch';
export const PATH_COMPLETE = 'path-complete';
const TELEPORT_CLEAR = 'teleport-clear';
const CASCADE_LIMIT = 16;

/** The eight wander headings: unit vectors without a transcendental. */
const S = dmath.sqrt(0.5);
const HEADINGS: readonly [number, number][] = [
  [1, 0],
  [S, S],
  [0, 1],
  [-S, S],
  [-1, 0],
  [-S, -S],
  [0, -1],
  [S, -S],
];

interface Bindings {
  self: EntityId;
  a?: EntityId;
  b?: EntityId;
  entity?: EntityId;
  payload?: JsonValue;
}

// --- selectors ---

const parsedCache = new Map<string, ParsedSelector>();
function parsed(selector: string): ParsedSelector {
  let p = parsedCache.get(selector);
  if (p === undefined) {
    p = parseSelector(selector);
    if (parsedCache.size > 4096) parsedCache.clear();
    parsedCache.set(selector, p);
  }
  return p;
}

/** Replace $self/$a/$b/$entity with #id; null when a named binding is absent. */
function bindSelector(selector: string, bind: Bindings): string | null {
  let missing = false;
  const out = selector.replace(
    /\$(self|a|b|entity)\b/g,
    (_m, key: 'self' | 'a' | 'b' | 'entity') => {
      const id = bind[key];
      if (id === undefined) {
        missing = true;
        return '#';
      }
      return `#${id}`;
    },
  );
  return missing ? null : out;
}

function matchesPredicates(w: World, id: EntityId, p: ParsedSelector): boolean {
  if (!w.exists(id)) return false;
  for (const pred of p.predicates) {
    if (pred.kind === 'id' && id !== pred.id) return false;
    if (
      pred.kind === 'tag' &&
      (w.get(id, TAG) as { name?: unknown } | undefined)?.name !== pred.name
    )
      return false;
    if (pred.kind === 'has' && !w.has(id, componentHandle(pred.component))) return false;
  }
  return true;
}

/** Entity ids matching a selector, in creation order. */
function selectIds(w: World, selector: string, bind: Bindings): EntityId[] {
  const bound = bindSelector(selector, bind);
  if (bound === null) return [];
  const p = parsed(bound);
  const byId = p.predicates.find((x) => x.kind === 'id');
  if (byId !== undefined && byId.kind === 'id') {
    return matchesPredicates(w, byId.id, p) ? [byId.id] : [];
  }
  const out: EntityId[] = [];
  for (const id of w._internal().entities) if (matchesPredicates(w, id, p)) out.push(id);
  return out;
}

function matchesSelector(w: World, id: EntityId, selector: string, bind: Bindings): boolean {
  const bound = bindSelector(selector, bind);
  if (bound === null) return false;
  return matchesPredicates(w, id, parsed(bound));
}

function valueAt(w: World, id: EntityId, path: Array<string | number>): JsonValue | undefined {
  const [component, ...rest] = path;
  if (typeof component !== 'string') return undefined;
  let cur: JsonValue | undefined = w.get(id, componentHandle(component)) as JsonValue | undefined;
  for (const seg of rest) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur =
      typeof seg === 'number'
        ? Array.isArray(cur)
          ? cur[seg]
          : undefined
        : (cur as { [k: string]: JsonValue | undefined })[seg];
  }
  return cur ?? undefined;
}

// --- conditions ---

function conditionHolds(w: World, cond: PlayCondition, bind: Bindings): boolean {
  const bound = bindSelector(cond.select, bind);
  if (bound === null) return false;
  const p = parsed(bound);
  const ids = selectIds(w, bound, bind);
  const n = ids.length;
  const expected = cond.value;
  switch (cond.op) {
    case 'count':
      return n === expected;
    case 'count_lt':
      return typeof expected === 'number' && n < expected;
    case 'count_lte':
      return typeof expected === 'number' && n <= expected;
    case 'count_gt':
      return typeof expected === 'number' && n > expected;
    case 'count_gte':
      return typeof expected === 'number' && n >= expected;
    case 'exists':
      return n > 0;
  }
  if (n === 0) return false;
  const base = cond.op.replace(/^(all_|any_)/, '');
  const checks = ids.map((id) =>
    compareValues(base, valueAt(w, id, p.valuePath), expected, cond.tol),
  );
  return cond.op.startsWith('any_') ? checks.some(Boolean) : checks.every(Boolean);
}

// --- actions ---

type PathSeg = string | number;
function pathSegs(path: string): PathSeg[] {
  const segs: PathSeg[] = [];
  for (const part of path.split('.')) {
    const m = /^([A-Za-z_$][\w$-]*)?((?:\[\d+\])*)$/.exec(part);
    if (m === null) throw new Error(`bad value path "${path}"`);
    if (m[1] !== undefined) segs.push(m[1]);
    for (const im of (m[2] ?? '').matchAll(/\[(\d+)\]/g)) segs.push(Number(im[1]));
  }
  return segs;
}

function writeAt(root: JsonObject, path: string, value: JsonValue): JsonObject {
  const next = cloneJson(root) as JsonObject;
  const segs = pathSegs(path);
  let cur: JsonValue = next;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i] as PathSeg;
    const container = cur as { [k: string]: JsonValue } & JsonValue[];
    let child = container[seg as never] as JsonValue | undefined;
    if (child === undefined || child === null || typeof child !== 'object') {
      child = typeof segs[i + 1] === 'number' ? [] : {};
      container[seg as never] = child as never;
    }
    cur = child;
  }
  (cur as { [k: string]: JsonValue } & JsonValue[])[segs[segs.length - 1] as never] =
    value as never;
  return next;
}

function readAt(root: JsonValue | undefined, path: string): JsonValue | undefined {
  let cur = root;
  for (const seg of pathSegs(path)) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as { [k: string]: JsonValue } & JsonValue[])[seg as never];
  }
  return cur;
}

function firstId(w: World, selector: string | undefined, bind: Bindings): EntityId | undefined {
  return selectIds(w, selector ?? '$self', bind)[0];
}

function dist2(a: readonly number[], b: readonly number[]): number {
  const dx = (a[0] ?? 0) - (b[0] ?? 0);
  const dy = (a[1] ?? 0) - (b[1] ?? 0);
  const dz = (a[2] ?? 0) - (b[2] ?? 0);
  return dx * dx + dy * dy + dz * dz;
}

interface ActionContext {
  ctx: TickContext;
  spawnFromPrefab: (prefab: string) => ComponentMap;
  nextSoundHandle: (sound: string) => string;
}

function stopBody(w: World, id: EntityId): void {
  const kb = w.get(id, KinematicBody);
  if (kb !== undefined) w.patch(id, KinematicBody, { vel: [0, 0, 0] });
  if (w.has(id, PlatformBody)) w.patch(id, PlatformBody, { vel: [0, 0], grounded: false });
  if (w.has(id, PlatformIntent)) w.patch(id, PlatformIntent, { move: 0, jump: false });
  if (w.has(id, CHARACTER)) w.patch(id, CHARACTER, { vy: 0 });
}

function runAction(w: World, action: PlayAction, bind: Bindings, ac: ActionContext): void {
  if ('set' in action) {
    const a = action.set;
    const handle = componentHandle(a.component);
    for (const id of selectIds(w, a.target ?? '$self', bind)) {
      if (a.path === undefined) {
        if (a.value === null || typeof a.value !== 'object' || Array.isArray(a.value)) {
          throw new Error(`set ${a.component} without a path needs an object value`);
        }
        w.set(id, handle, a.value as JsonObject);
      } else {
        w.set(id, handle, writeAt((w.get(id, handle) ?? {}) as JsonObject, a.path, a.value));
      }
    }
    return;
  }
  if ('add' in action) {
    const a = action.add;
    const handle = componentHandle(a.component);
    let amount = a.value ?? 1;
    if (a.from !== undefined) {
      const bound = bindSelector(a.from, bind);
      const source = bound !== null ? selectIds(w, bound, bind)[0] : undefined;
      const found =
        source !== undefined && bound !== null
          ? valueAt(w, source, parsed(bound).valuePath)
          : undefined;
      if (typeof found === 'number') amount = found;
    }
    for (const id of selectIds(w, a.target ?? '$self', bind)) {
      const current = (w.get(id, handle) ?? {}) as JsonObject;
      const before = readAt(current, a.path);
      const n = typeof before === 'number' ? before : 0;
      w.set(id, handle, writeAt(current, a.path, n + amount));
    }
    return;
  }
  if ('spawn' in action) {
    const a = action.spawn;
    const components = ac.spawnFromPrefab(a.prefab);
    let at: PlayVec3 | undefined = a.at;
    if (a.pick !== undefined && a.pick.length > 0) {
      let pool = a.pick;
      const away = a.awayFrom !== undefined ? firstId(w, a.awayFrom, bind) : undefined;
      const from = away !== undefined ? w.get(away, Transform)?.pos : undefined;
      if (from !== undefined) {
        const min = (a.minDistance ?? 0) * (a.minDistance ?? 0);
        const far = pool.filter((p) => dist2(p, from) >= min);
        if (far.length > 0) pool = far;
      }
      at = pool[ac.ctx.rng.int(pool.length)];
    }
    if (at !== undefined) {
      const t = (components.transform ?? {}) as JsonObject;
      components.transform = { ...t, pos: [at[0], at[1], at[2]] };
    }
    w.spawn(components);
    return;
  }
  if ('destroy' in action) {
    for (const id of selectIds(w, action.destroy, bind)) w.destroy(id);
    return;
  }
  if ('emit' in action) {
    w.emit(action.emit.event, action.emit.payload ?? {});
    return;
  }
  if ('tween' in action) {
    const { target, ...entry } = action.tween;
    for (const id of selectIds(w, target ?? '$self', bind)) startTween(w, id, { ...entry });
    return;
  }
  if ('path' in action) {
    const { target, ...data } = action.path;
    for (const id of selectIds(w, target ?? '$self', bind)) w.set(id, Path, { ...data });
    return;
  }
  if ('figure' in action) {
    const a = action.figure;
    for (const id of selectIds(w, a.target ?? '$self', bind)) {
      const next = { ...((w.get(id, FIGURE_INTENT) ?? {}) as JsonObject) };
      if (a.mode === null) delete next.mode;
      else if (a.mode !== undefined) next.mode = a.mode;
      if (a.lookAt === null) delete next.lookAt;
      else if (typeof a.lookAt === 'string') {
        const look = firstId(w, a.lookAt, bind);
        if (look !== undefined) next.lookAt = { entity: look };
      } else if (a.lookAt !== undefined) next.lookAt = { pos: [...a.lookAt] };
      w.set(id, FIGURE_INTENT, next);
    }
    return;
  }
  if ('place' in action) {
    const a = action.place;
    for (const id of selectIds(w, a.target ?? '$self', bind)) {
      w.patch(id, Transform, { pos: [a.at[0], a.at[1], a.at[2]], teleport: true });
      stopBody(w, id);
      // The client snaps to this update only; clear the hint on the next tick (snapshot-safe:
      // the countdown is an ordinary timer in the entity's own component).
      scheduleTimer(w, id, { ticks: 1, event: TELEPORT_CLEAR, id: TELEPORT_CLEAR });
    }
    return;
  }
  if ('timer' in action) {
    const a = action.timer;
    const id = firstId(w, a.target, bind);
    scheduleTimer(w, id ?? null, {
      ticks: a.ticks,
      event: a.event,
      ...(a.payload !== undefined ? { payload: a.payload } : {}),
    });
    return;
  }
  if ('sound' in action) {
    const a = action.sound;
    const at = a.at !== undefined ? firstId(w, a.at, bind) : undefined;
    w.emit(AUDIO_PLAY, {
      handle: ac.nextSoundHandle(a.sound),
      sound: a.sound,
      ...(at !== undefined ? { entity: at } : {}),
      ...(a.gain !== undefined ? { gain: a.gain } : {}),
    });
    return;
  }
  throw new Error(`unknown action ${Object.keys(action as object).join(', ')}`);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// --- motion ---

function polylinePoint(points: readonly PlayVec3[], d: number): PlayVec3 {
  let left = d;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as PlayVec3;
    const b = points[i + 1] as PlayVec3;
    const len = dmath.sqrt(dist2(a, b));
    if (left <= len || i === points.length - 2) {
      const f = len > 0 ? dmath.min(1, left / len) : 1;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
    left -= len;
  }
  return points[points.length - 1] as PlayVec3;
}

function installPath(world: World): void {
  world.addSystem(
    (w, ctx) => {
      for (const [id, t, path] of w.query(Transform, Path)) {
        if ((path.delay ?? 0) > 0) {
          w.patch(id, Path, { delay: (path.delay ?? 0) - 1 });
          continue;
        }
        const origin = (path.origin ?? [t.pos[0], t.pos[1], t.pos[2]]) as PlayVec3;
        const forward: PlayVec3[] = [origin, ...path.points];
        if (path.loop === 'loop') forward.push(origin);
        const poly = path.back === true ? [...forward].reverse() : forward;
        let length = 0;
        for (let i = 0; i < poly.length - 1; i++) {
          length += dmath.sqrt(dist2(poly[i] as PlayVec3, poly[i + 1] as PlayVec3));
        }
        const elapsed = (path.elapsed ?? 0) + 1;
        let d: number;
        let done: boolean;
        if (path.ticks !== undefined) {
          let f = dmath.min(1, elapsed / path.ticks);
          if (path.easing === 'smooth') f = f * f * (3 - 2 * f);
          d = length * f;
          done = elapsed >= path.ticks;
        } else {
          d = (path.speed ?? 1) * elapsed * ctx.dt;
          done = d >= length;
        }
        const pos = polylinePoint(poly, dmath.min(d, length));
        w.patch(id, Transform, { pos });
        if (!done) {
          w.patch(id, Path, { origin, elapsed });
          continue;
        }
        w.emit(PATH_COMPLETE, { entity: id, ...(path.id !== undefined ? { id: path.id } : {}) });
        if (path.emitOnComplete !== undefined) w.emit(path.emitOnComplete, { entity: id });
        if (path.loop === 'loop') w.patch(id, Path, { origin, elapsed: 0 });
        else if (path.loop === 'pingpong')
          w.patch(id, Path, { origin, elapsed: 0, back: path.back !== true });
        else w.remove(id, Path);
      }
    },
    { phase: 'update', name: 'path' },
  );
}

function installMover(world: World): void {
  world.addSystem(
    (w, ctx) => {
      for (const [id, t, m] of w.query(Transform, Mover)) {
        let vx = 0;
        let vz = 0;
        if (m.mode === 'wander') {
          let heading = m.heading;
          let turnIn = m.turnIn ?? 0;
          if (heading === undefined || turnIn <= 0) {
            heading = HEADINGS[ctx.rng.int(HEADINGS.length)] as [number, number];
            turnIn = m.turnTicks ?? 60;
          } else turnIn--;
          w.patch(id, Mover, { heading: [heading[0], heading[1]], turnIn });
          vx = heading[0];
          vz = heading[1];
        } else {
          const target = m.target !== undefined ? firstId(w, m.target, { self: id }) : undefined;
          const tp = target !== undefined ? w.get(target, Transform)?.pos : undefined;
          if (tp !== undefined) {
            const dx = tp[0] - t.pos[0];
            const dz = tp[2] - t.pos[2];
            const d = dmath.sqrt(dx * dx + dz * dz);
            if (d > 1e-6 && (m.range === undefined || d <= m.range)) {
              const sign = m.mode === 'flee' ? -1 : 1;
              vx = (sign * dx) / d;
              vz = (sign * dz) / d;
            }
          }
        }
        const body = w.get(id, KinematicBody);
        if (body !== undefined) {
          w.patch(id, KinematicBody, { vel: [vx * m.speed, body.vel[1], vz * m.speed] });
        } else if (vx !== 0 || vz !== 0) {
          w.patch(id, Transform, {
            pos: [t.pos[0] + vx * m.speed * ctx.dt, t.pos[1], t.pos[2] + vz * m.speed * ctx.dt],
          });
        }
      }
    },
    { phase: 'update', name: 'mover' },
  );
}

// --- triggers ---

interface Zone {
  id: EntityId;
  u: number;
  v: number;
  circle: boolean;
  r: number;
  hu: number;
  hv: number;
  plane: 'xz' | 'xy';
  layer: number;
  mask: number;
}

function overlaps(a: Zone, b: Zone): boolean {
  const du = a.u - b.u;
  const dv = a.v - b.v;
  if (a.circle && b.circle) return du * du + dv * dv < (a.r + b.r) * (a.r + b.r);
  if (!a.circle && !b.circle) {
    return dmath.abs(du) < a.hu + b.hu && dmath.abs(dv) < a.hv + b.hv;
  }
  const c = a.circle ? a : b;
  const box = a.circle ? b : a;
  const cu = dmath.clamp(c.u, box.u - box.hu, box.u + box.hu);
  const cv = dmath.clamp(c.v, box.v - box.hv, box.v + box.hv);
  const eu = c.u - cu;
  const ev = c.v - cv;
  return eu * eu + ev * ev < c.r * c.r;
}

function installTriggers(world: World): void {
  world.addSystem(
    (w) => {
      const zones: Zone[] = [];
      for (const [id, t, z] of w.query(Transform, Trigger)) {
        const plane = z.plane ?? 'xz';
        zones.push({
          id,
          u: t.pos[0],
          v: plane === 'xz' ? t.pos[2] : t.pos[1],
          circle: (z.shape ?? 'circle') === 'circle',
          r: z.radius ?? 0.5,
          hu: z.halfExtents?.[0] ?? 0.5,
          hv: z.halfExtents?.[1] ?? 0.5,
          plane,
          layer: z.layer ?? 1,
          mask: z.mask ?? 1,
        });
      }
      for (let i = 0; i < zones.length; i++) {
        const a = zones[i] as Zone;
        for (let j = i + 1; j < zones.length; j++) {
          const b = zones[j] as Zone;
          if (a.plane !== b.plane) continue;
          if ((a.mask & b.layer) === 0 && (b.mask & a.layer) === 0) continue;
          if (overlaps(a, b)) w.emit(TOUCH, { a: a.id, b: b.id });
        }
      }
    },
    { phase: 'late', name: 'triggers', priority: 900 },
  );
}

// --- controller ---

function readDir(payload: JsonValue | undefined): [number, number] | undefined {
  const dir = (payload as { dir?: unknown } | undefined)?.dir;
  if (!Array.isArray(dir) || dir.length !== 2) return undefined;
  let x = typeof dir[0] === 'number' && Number.isFinite(dir[0]) ? dir[0] : 0;
  let y = typeof dir[1] === 'number' && Number.isFinite(dir[1]) ? dir[1] : 0;
  const len = dmath.sqrt(x * x + y * y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return [x, y];
}

function applyMove(w: World, id: EntityId, c: ControllerData, dir: [number, number]): void {
  if (w.has(id, PlatformIntent) || w.has(id, PlatformBody)) {
    const intent = w.get(id, PlatformIntent);
    w.set(id, PlatformIntent, { ...(intent ?? {}), move: dir[0] });
    return;
  }
  const body = w.get(id, KinematicBody);
  if (body !== undefined) {
    const speed = c.speed ?? 5;
    w.patch(id, KinematicBody, { vel: [dir[0] * speed, body.vel[1], dir[1] * speed] });
    return;
  }
  if (w.has(id, MoveIntent)) {
    const intent = w.get(id, MoveIntent);
    w.set(id, MoveIntent, { jump: intent?.jump ?? false, dir: [dir[0], dir[1]] });
  }
}

function applyJump(w: World, id: EntityId, held: boolean): void {
  if (w.has(id, PlatformIntent) || w.has(id, PlatformBody)) {
    const intent = w.get(id, PlatformIntent) ?? { move: 0 };
    w.set(
      id,
      PlatformIntent,
      held ? { ...intent, jump: true, jumpHeld: true } : { ...intent, jumpHeld: false },
    );
    return;
  }
  if (w.has(id, MoveIntent)) {
    const intent = w.get(id, MoveIntent);
    w.set(id, MoveIntent, { dir: intent?.dir ?? [0, 0], jump: held });
  }
}

// --- the installer ---

export interface PlayOptions {
  /** Components for a scene prefab (the `spawn` action). Default: the action fails. */
  spawnFromPrefab?: (prefab: string) => ComponentMap;
}

function manifestComponentMaps(manifest: SceneManifest): ComponentMap[] {
  return [
    // Hosts may pass a manifest without schema defaults applied (no prefabs, say).
    ...(manifest.entities ?? []).map((e) => (e.components ?? {}) as ComponentMap),
    ...Object.values(manifest.prefabs ?? {}).map((p) => (p.components ?? {}) as ComponentMap),
  ];
}

/** Commands named by controllers and rules anywhere in the manifest (entities and prefabs). */
function playCommands(manifest: SceneManifest): Set<string> {
  const out = new Set<string>();
  for (const map of manifestComponentMaps(manifest)) {
    const c = map.controller as ControllerData | undefined;
    if (c !== undefined) {
      out.add(c.move ?? 'move');
      if (c.jump !== undefined) out.add(c.jump);
    }
    for (const rule of ((map.rules as RulesData | undefined)?.rules ?? []) as RuleEntry[]) {
      if ('command' in rule.when) out.add(rule.when.command);
    }
  }
  return out;
}

/**
 * Install choreography and rules of play: the cues, path, mover, triggers and rules systems,
 * and a command handler for every command a controller or rule in `manifest` names.
 * createWorldFromScene calls this; it costs nothing for a scene that uses none of it.
 */
export function installPlay(world: World, manifest?: SceneManifest, opts: PlayOptions = {}): void {
  const queue: EngineEvent[] = [];
  let buffering = true;
  world.on('*', (event) => {
    if (buffering && world.query(Rules).count() > 0) queue.push(event);
  });
  world.on(TELEPORT_CLEAR, (event) => {
    const id = (event.payload as { entity?: EntityId } | null)?.entity;
    if (id === undefined) return;
    const t = world.get(id, Transform);
    if (t?.teleport !== true) return;
    const { teleport: _teleport, ...rest } = t;
    world.set(id, Transform, rest as typeof t);
  });

  let soundTick = -1;
  let soundCount = 0;
  const actionContext = (ctx: TickContext): ActionContext => ({
    ctx,
    spawnFromPrefab: (prefab) => {
      if (opts.spawnFromPrefab === undefined) throw new Error('this world has no prefabs to spawn');
      return opts.spawnFromPrefab(prefab);
    },
    nextSoundHandle: (sound) => {
      if (ctx.tick !== soundTick) {
        soundTick = ctx.tick;
        soundCount = 0;
      }
      return `${sound}@${ctx.tick}#${soundCount++}`;
    },
  });

  // cues: timed actions, before tweens and paths so a cue's path moves the same tick
  world.addSystem(
    (w, ctx) => {
      const ac = actionContext(ctx);
      for (const [id, data] of w.query(Cues)) {
        const at = data.loop !== undefined ? ctx.tick % data.loop : ctx.tick;
        data.cues.forEach((cue, index) => {
          if (cue.tick !== at) return;
          try {
            for (const action of cue.do) runAction(w, action, { self: id }, ac);
          } catch (error) {
            w.emit(RULE_ERROR, {
              entity: id,
              cue: cue.id ?? index,
              code: 'action-failed',
              message: message(error),
            });
          }
        });
      }
    },
    { phase: 'update', name: 'cues', priority: -10 },
  );
  installPath(world);
  installMover(world);
  installTriggers(world);

  // rules: drain this tick's events, then time and edge triggers, then what those emitted
  const touched = new Set<string>();
  const markRule = (w: World, id: EntityId, index: number, patch: Partial<RuleEntry>): void => {
    const data = w.get(id, Rules);
    if (data === undefined) return;
    const rules = data.rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    w.set(id, Rules, { rules });
  };
  const fire = (
    w: World,
    id: EntityId,
    index: number,
    rule: RuleEntry,
    bind: Bindings,
    ac: ActionContext,
  ): void => {
    try {
      for (const cond of rule.if ?? []) if (!conditionHolds(w, cond, bind)) return;
    } catch (error) {
      w.emit(RULE_ERROR, {
        entity: id,
        rule: rule.id ?? index,
        code: 'condition-failed',
        message: message(error),
      });
      markRule(w, id, index, { disabled: 'condition-failed' });
      return;
    }
    if (rule.once === true) markRule(w, id, index, { fired: true });
    try {
      for (const action of rule.do) runAction(w, action, bind, ac);
    } catch (error) {
      w.emit(RULE_ERROR, {
        entity: id,
        rule: rule.id ?? index,
        code: 'action-failed',
        message: message(error),
      });
      markRule(w, id, index, { disabled: 'action-failed' });
    }
  };
  const live = (rule: RuleEntry): boolean =>
    rule.disabled === undefined && !(rule.once === true && rule.fired === true);

  const onEvent = (w: World, event: EngineEvent, ac: ActionContext): void => {
    const payload = (event.payload ?? {}) as { entity?: unknown; a?: unknown; b?: unknown };
    for (const [id, data] of w.query(Rules)) {
      data.rules.forEach((rule, index) => {
        // Re-read: an earlier rule this event may have fired or disabled this one.
        const current = w.get(id, Rules)?.rules[index] ?? rule;
        if (!live(current)) return;
        const when = current.when as PlayTrigger;
        if ('touch' in when) {
          if (event.type !== TOUCH) return;
          const a = payload.a;
          const b = payload.b;
          if (typeof a !== 'string' || typeof b !== 'string') return;
          const self: Bindings = { self: id };
          let pair: [EntityId, EntityId] | undefined;
          if (
            matchesSelector(w, a, when.touch[0], self) &&
            matchesSelector(w, b, when.touch[1], self)
          )
            pair = [a, b];
          else if (
            matchesSelector(w, b, when.touch[0], self) &&
            matchesSelector(w, a, when.touch[1], self)
          )
            pair = [b, a];
          if (pair === undefined) return;
          const key = `${id}|${index}|${pair[0]}|${pair[1]}`;
          if (touched.has(key)) return;
          touched.add(key);
          fire(w, id, index, current, { self: id, a: pair[0], b: pair[1] }, ac);
          return;
        }
        if ('command' in when) {
          if (event.type !== '$command') return;
          const cmd = event.payload as { type?: string; payload?: JsonValue };
          if (cmd.type !== when.command) return;
          fire(
            w,
            id,
            index,
            current,
            { self: id, ...(cmd.payload !== undefined ? { payload: cmd.payload } : {}) },
            ac,
          );
          return;
        }
        if ('event' in when) {
          if (event.type !== when.event) return;
          const entity = typeof payload.entity === 'string' ? payload.entity : undefined;
          if (when.from !== undefined) {
            if (entity === undefined || !matchesSelector(w, entity, when.from, { self: id }))
              return;
          }
          fire(
            w,
            id,
            index,
            current,
            { self: id, ...(entity !== undefined ? { entity } : {}) },
            ac,
          );
        }
      });
    }
  };

  const drain = (w: World, ac: ActionContext): void => {
    for (let round = 0; queue.length > 0; round++) {
      if (round >= CASCADE_LIMIT) {
        queue.length = 0;
        buffering = false;
        try {
          w.emit(RULE_ERROR, { code: 'cascade-limit', message: 'rules kept emitting events' });
        } finally {
          buffering = true;
        }
        return;
      }
      const batch = queue.splice(0, queue.length);
      for (const event of batch) onEvent(w, event, ac);
    }
  };

  world.addSystem(
    (w, ctx) => {
      touched.clear();
      const ac = actionContext(ctx);
      drain(w, ac);
      for (const [id, data] of w.query(Rules)) {
        data.rules.forEach((rule, index) => {
          const current = w.get(id, Rules)?.rules[index] ?? rule;
          if (!live(current)) return;
          const when = current.when as PlayTrigger;
          if ('every' in when) {
            const offset = when.offset ?? when.every;
            if (ctx.tick >= offset && (ctx.tick - offset) % when.every === 0) {
              fire(w, id, index, current, { self: id }, ac);
            }
          } else if ('tick' in when) {
            if (ctx.tick === when.tick) fire(w, id, index, current, { self: id }, ac);
          } else if ('becomes' in when) {
            let now: boolean;
            try {
              now = conditionHolds(w, when.becomes, { self: id });
            } catch (error) {
              w.emit(RULE_ERROR, {
                entity: id,
                rule: current.id ?? index,
                code: 'condition-failed',
                message: message(error),
              });
              markRule(w, id, index, { disabled: 'condition-failed' });
              return;
            }
            const was = current.was === true;
            if (now !== was) markRule(w, id, index, { was: now });
            if (now && !was) fire(w, id, index, current, { self: id }, ac);
          }
        });
      }
      drain(w, ac);
    },
    { phase: 'late', name: 'rules', priority: 1000 },
  );

  // controllers and command-triggered rules
  if (manifest === undefined) return;
  for (const type of playCommands(manifest)) {
    world.onCommand(type, (w, command) => {
      for (const [id, c] of w.query(Controller)) {
        if (c.enabled === false) continue;
        if ((c.move ?? 'move') === type) {
          const dir = readDir(command.payload);
          if (dir !== undefined) applyMove(w, id, c, dir);
        }
        if (c.jump === type) {
          const held = (command.payload as { held?: unknown } | undefined)?.held === true;
          applyJump(w, id, held);
        }
      }
      if (w.query(Rules).count() > 0) {
        queue.push({ type: '$command', payload: { type, payload: command.payload ?? null } });
      }
    });
  }
}
