import {
  type AudioCondition,
  type AudioScalar,
  type AudioWhen,
  type EntityId,
  type JsonObject,
  type JsonValue,
  resolveWeather,
} from '@bendyline/molen-schema';
import type { AudioEntitySource, AudioEnvironmentSignals, AudioListenerState } from './types';

export type SignalValue = AudioScalar | undefined;

/** Per-entity motion the director measures from transforms (the `self.*` signals). */
export interface EntityMotion {
  pos: [number, number, number];
  speed: number;
  distance: number;
  /** Smoothed world velocity (m/s), for Doppler and `self.approach`. */
  vel?: [number, number, number];
}

export interface SignalContext {
  listener: AudioListenerState & { speed: number; distance: number };
  signals: AudioEnvironmentSignals;
  source: AudioEntitySource | undefined;
  /** The entity `<component>.<field>` and `self.*` paths resolve on. */
  entity: EntityId | undefined;
  motion: ReadonlyMap<EntityId, EntityMotion>;
  /** Entities someone is mounted in (a `mounted` component names them): `self.occupied`. */
  occupied: ReadonlySet<EntityId>;
  seconds: number;
  /** Smoothed listener velocity (m/s). */
  listenerVelocity?: [number, number, number];
}

/**
 * Follow a dotted path into component data. A number indexes an array, or picks the nth entry of
 * a record keyed by ids that has no such key: `aircraftState.engines.0` is the first engine
 * whether it is called main, left or engine-1, so one profile serves a whole fleet.
 */
function walk(value: JsonValue | undefined, path: readonly string[]): JsonValue | undefined {
  let cur = value;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    if (Array.isArray(cur)) cur = cur[Number(key)];
    else if (Object.hasOwn(cur, key) || !/^\d+$/.test(key)) cur = (cur as JsonObject)[key];
    else cur = Object.values(cur)[Number(key)];
  }
  return cur;
}

function scalar(v: JsonValue | undefined): SignalValue {
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : undefined;
}

const RAD_TO_DEG = 180 / Math.PI;

/** Resolve a signal path to a scalar, or undefined when it has no value here. */
export function resolveSignal(path: string, ctx: SignalContext): SignalValue {
  const dot = path.indexOf('.');
  const head = dot < 0 ? path : path.slice(0, dot);
  const rest = dot < 0 ? '' : path.slice(dot + 1);
  const l = ctx.listener;
  switch (head) {
    case 'listener':
      switch (rest) {
        case 'x':
          return l.position[0];
        case 'y':
        case 'altitude':
          return l.position[1];
        case 'z':
          return l.position[2];
        case 'speed':
          return l.speed;
        case 'distance':
          return l.distance;
        case 'mode':
          return l.mode;
        case 'grounded':
          return l.grounded ?? true;
        case 'surface':
          return l.surface;
        case 'heightAboveGround':
          return l.heightAboveGround ?? 0;
        case 'indoors':
          return l.indoors ?? false;
        case 'space':
          return l.space ?? (l.indoors ? 'building' : 'open');
        case 'vehicle':
          return l.vehicle;
        default:
          return undefined;
      }
    case 'weather': {
      const w = resolveWeather(ctx.signals.weather ?? weatherFromSource(ctx.source));
      if (rest === 'windSpeed') {
        const [x, y, z] = w.atmosphere.windVelocity;
        return Math.hypot(x, y, z);
      }
      return scalar(walk(w as unknown as JsonValue, rest.split('.')));
    }
    case 'sky': {
      const sky = ctx.signals.sky;
      // No sky (most game scenes): read as an ordinary day so daytime rules still play.
      if (rest === 'daylight') return sky?.daylight ?? 1;
      if (rest === 'starVisibility') return sky?.starVisibility ?? 0;
      if (rest === 'sunElevation') {
        const d = sky?.sunDirection;
        if (!d) return 45;
        const len = Math.hypot(d[0], d[1], d[2]) || 1;
        return Math.asin(Math.max(-1, Math.min(1, d[1] / len))) * RAD_TO_DEG;
      }
      return undefined;
    }
    case 'time':
      return rest === 'seconds' ? ctx.seconds : undefined;
    case 'host':
      return ctx.signals.host?.[rest];
    case 'self': {
      if (rest === 'occupied') return ctx.entity !== undefined && ctx.occupied.has(ctx.entity);
      if (rest === 'listener') return ctx.entity !== undefined && l.vehicle === ctx.entity;
      const m = ctx.entity !== undefined ? ctx.motion.get(ctx.entity) : undefined;
      if (!m) return undefined;
      if (rest === 'listenerDistance')
        return Math.hypot(
          l.position[0] - m.pos[0],
          l.position[1] - m.pos[1],
          l.position[2] - m.pos[2],
        );
      if (rest === 'listenerAngle') return listenerAngle(ctx, m.pos);
      if (rest === 'approach') return approach(m, l.position, ctx.listenerVelocity);
      if (rest === 'speed') return m.speed;
      if (rest === 'distance') return m.distance;
      if (rest === 'x') return m.pos[0];
      if (rest === 'y') return m.pos[1];
      if (rest === 'z') return m.pos[2];
      return undefined;
    }
    default: {
      if (ctx.entity === undefined || ctx.source === undefined || rest === '') return undefined;
      const data = ctx.source.get(ctx.entity, head);
      return data === undefined ? undefined : scalar(walk(data, rest.split('.')));
    }
  }
}

/** Degrees between the entity's nose (+Z of its transform rotation) and the listener. */
function listenerAngle(ctx: SignalContext, pos: readonly number[]): number {
  const d = ctx.listener.position.map((v, i) => v - (pos[i] ?? 0));
  const len = Math.hypot(d[0] ?? 0, d[1] ?? 0, d[2] ?? 0);
  if (len < 1e-6) return 90;
  const rot = ctx.entity !== undefined ? ctx.source?.get(ctx.entity, 'transform')?.rot : undefined;
  const q =
    Array.isArray(rot) && rot.length === 4 && rot.every((n) => typeof n === 'number')
      ? (rot as number[])
      : [0, 0, 0, 1];
  const [x, y, z, w] = q as [number, number, number, number];
  // The rotated +Z axis.
  const fx = 2 * (x * z + w * y);
  const fy = 2 * (y * z - w * x);
  const fz = 1 - 2 * (x * x + y * y);
  const cos = ((d[0] ?? 0) * fx + (d[1] ?? 0) * fy + (d[2] ?? 0) * fz) / len;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Closing speed between an entity and the listener (m/s, positive while they approach). */
export function approach(
  m: EntityMotion,
  listener: readonly number[],
  listenerVelocity: readonly number[] | undefined,
): number {
  const d = [0, 1, 2].map((i) => (listener[i] ?? 0) - (m.pos[i] ?? 0));
  const len = Math.hypot(d[0] ?? 0, d[1] ?? 0, d[2] ?? 0);
  if (len < 1e-3) return 0;
  const vs = m.vel ?? [0, 0, 0];
  const vl = listenerVelocity ?? [0, 0, 0];
  let closing = 0;
  for (let i = 0; i < 3; i++) closing += (((vs[i] ?? 0) - (vl[i] ?? 0)) * (d[i] ?? 0)) / len;
  return closing;
}

function weatherFromSource(source: AudioEntitySource | undefined) {
  if (!source) return undefined;
  for (const [, data] of source.each('weather')) return data as never;
  return undefined;
}

/** Margin (fraction of a range's span) that keeps an active rule active near its edges. */
const HYSTERESIS_MARGIN = 0.05;

function holds(cond: AudioCondition, v: SignalValue, active: boolean): boolean {
  if (Array.isArray(cond)) return v !== undefined && cond.includes(v);
  if (cond !== null && typeof cond === 'object') {
    if ('exists' in cond) return (v !== undefined) === cond.exists;
    if (typeof v !== 'number') return false;
    const { min, max } = cond as { min?: number; max?: number };
    let m = 0;
    if (active) {
      const span =
        min !== undefined && max !== undefined
          ? max - min
          : Math.max(Math.abs(min ?? max ?? 0), 1e-6);
      m = span * HYSTERESIS_MARGIN;
    }
    return (min === undefined || v >= min - m) && (max === undefined || v <= max + m);
  }
  return v === cond;
}

/** Every condition must hold (AND). `active` widens numeric ranges (hysteresis). */
export function evalWhen(when: AudioWhen | undefined, ctx: SignalContext, active = false): boolean {
  if (!when) return true;
  for (const [signal, cond] of Object.entries(when)) {
    if (!holds(cond, resolveSignal(signal, ctx), active)) return false;
  }
  return true;
}

/** Piecewise-linear lookup over [input, output] points, clamped at both ends. */
export function curve(points: readonly (readonly [number, number])[], x: number): number {
  if (points.length === 0) return 1;
  const sorted = points.length > 1 ? [...points].sort((a, b) => a[0] - b[0]) : points;
  const first = sorted[0] as readonly [number, number];
  const last = sorted[sorted.length - 1] as readonly [number, number];
  if (!(x > first[0])) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i] as readonly [number, number];
    if (x <= b[0]) {
      const a = sorted[i - 1] as readonly [number, number];
      const t = b[0] === a[0] ? 1 : (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return last[1];
}

/** Rising/falling edge gate: a rule turns on after `enterMs` true and off after `exitMs` false. */
export class Gate {
  active = false;
  private started = false;
  private since: number | undefined;
  constructor(
    private readonly enterMs = 250,
    private readonly exitMs = 1000,
  ) {}
  update(raw: boolean, nowMs: number): boolean {
    if (!this.started) {
      this.started = true;
      this.active = raw;
      return raw;
    }
    if (raw === this.active) {
      this.since = undefined;
      return this.active;
    }
    this.since ??= nowMs;
    if (nowMs - this.since >= (raw ? this.enterMs : this.exitMs)) {
      this.active = raw;
      this.since = undefined;
    }
    return this.active;
  }
}
