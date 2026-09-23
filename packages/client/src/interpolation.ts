import type { EntityId, Quat, Vec3 } from '@bendyline/molen-schema';
import { lerp3, nlerp4 } from './math';

export interface InterpTransform {
  pos: Vec3;
  rot: Quat;
  scale?: Vec3;
  /** When true, the renderer snaps to this transform instead of interpolating into it. */
  teleport?: boolean;
}

interface TickSnapshot {
  tick: number;
  recvMs: number;
  transforms: Map<EntityId, InterpTransform | undefined>;
}

const DEFAULT_BUFFER = 4;
const DEFAULT_DELAY_TICKS = 1.5;
/**
 * How fast the clock offset follows a *later* arrival. Lateness is one-sided noise (a tick is
 * never delivered early by the network, only late by a stall), so the offset drops to a new
 * earliest arrival at once and drifts toward a persistently later one slowly: one 12 ms hitch
 * moves the render clock by a quarter of a millisecond instead of re-anchoring on it.
 */
const CLOCK_DRIFT = 0.02;

/**
 * Holds a small ring of recent per-tick transform snapshots and samples interpolated
 * transforms ~delayTicks behind the latest tick. Never extrapolates: clamps to the latest
 * known transform when ahead of the buffer.
 */
export class InterpolationBuffer {
  private snaps: TickSnapshot[] = [];
  private readonly baseline = new Map<EntityId, InterpTransform>();
  private readonly current = new Map<EntityId, InterpTransform>();
  private readonly active = new Map<EntityId, number>();
  private visited = 0;
  private readonly capacity: number;
  readonly delayTicks: number;
  private readonly tickMs: number;
  /** Smoothed local time (ms) that tick 0 would have arrived at — the render clock's anchor. */
  private clockOffsetMs: number | undefined;
  /** The last tick handed out, so a frame sequence never steps backwards. */
  private lastRenderTick: number | undefined;

  constructor(
    readonly tickRate: number,
    opts?: { capacity?: number; delayTicks?: number },
  ) {
    this.tickMs = 1000 / tickRate;
    this.capacity = opts?.capacity ?? DEFAULT_BUFFER;
    this.delayTicks = opts?.delayTicks ?? DEFAULT_DELAY_TICKS;
  }

  /** Record the transforms present at a kernel tick. recvMs is the local receive time. */
  push(tick: number, transforms: Map<EntityId, InterpTransform>, recvMs: number): void {
    const changes = new Map<EntityId, InterpTransform | undefined>();
    for (const [id, transform] of transforms) {
      if (!sameTransform(this.current.get(id), transform)) changes.set(id, transform);
    }
    for (const id of this.current.keys()) if (!transforms.has(id)) changes.set(id, undefined);
    this.pushDelta(tick, changes, recvMs);
  }

  /** Record a contiguous sparse update. Unmentioned entities keep their previous transform. */
  pushDelta(
    tick: number,
    changes: Map<EntityId, InterpTransform | undefined>,
    recvMs: number,
  ): void {
    if (this.latestTick !== undefined && tick <= this.latestTick)
      throw new RangeError('Interpolation ticks must increase; clear the buffer on resync');
    const owned = new Map<EntityId, InterpTransform | undefined>();
    for (const [id, transform] of changes) {
      if (sameTransform(this.current.get(id), transform)) continue;
      const copy = transform === undefined ? undefined : structuredClone(transform);
      owned.set(id, copy);
      if (copy === undefined) {
        this.current.delete(id);
        this.active.delete(id);
      } else {
        this.current.set(id, copy);
        this.active.set(id, tick);
      }
    }
    this.trackClock(tick, recvMs);
    this.snaps.push({ tick, recvMs, transforms: owned });
    while (this.snaps.length > this.capacity) {
      const retired = this.snaps.shift() as TickSnapshot;
      for (const [id, transform] of retired.transforms) {
        if (transform === undefined) this.baseline.delete(id);
        else this.baseline.set(id, transform);
      }
    }
  }

  private at(tick: number, id: EntityId): InterpTransform | undefined {
    for (let i = this.snaps.length - 1; i >= 0; i--) {
      const snapshot = this.snaps[i] as TickSnapshot;
      if (snapshot.tick <= tick && snapshot.transforms.has(id)) return snapshot.transforms.get(id);
    }
    return this.baseline.get(id);
  }

  /** Visit only changed/interpolating entities; send the final pose once before retiring it. */
  sampleActive(nowMs: number, apply: (id: EntityId, transform: InterpTransform) => void): void {
    this.visited = 0;
    const tick = this.estimateRenderTick(nowMs);
    if (tick === undefined) return;
    for (const [id, changedTick] of this.active) {
      this.visited++;
      const transform = this.sampleAt(tick, id);
      if (transform !== undefined) apply(id, transform);
      if (tick >= changedTick) this.active.delete(id);
    }
  }

  /** Reapply a static pose after a render/light binding changes without a transform delta. */
  activate(id: EntityId): void {
    if (this.current.has(id)) this.active.set(id, this.latestTick ?? 0);
  }

  get lastSampleVisited(): number {
    return this.visited;
  }

  get latestTick(): number | undefined {
    return this.snaps.length === 0
      ? undefined
      : (this.snaps[this.snaps.length - 1] as TickSnapshot).tick;
  }

  /** Number of snapshots currently held (≤ capacity). */
  get size(): number {
    return this.snaps.length;
  }

  /**
   * Fold one arrival into the smoothed clock offset. Anchoring on the newest arrival instead (the
   * old `latest.tick + (now - latest.recvMs)`) makes every stall a visible rewind: a delta that
   * lands 12 ms late moves the render tick ~0.3 ticks *backwards* and every moving entity reverses.
   */
  private trackClock(tick: number, recvMs: number): void {
    const sample = recvMs - tick * this.tickMs;
    if (!Number.isFinite(sample)) return;
    if (this.clockOffsetMs === undefined || sample < this.clockOffsetMs) {
      this.clockOffsetMs = sample;
      return;
    }
    this.clockOffsetMs += (sample - this.clockOffsetMs) * CLOCK_DRIFT;
  }

  /**
   * Estimate the render tick for a wall-clock time from the smoothed clock, minus the delay.
   * Never runs ahead of the newest tick held (sampling clamps there anyway) and never steps
   * backwards between calls, so a late delta cannot reverse motion mid-flight.
   */
  estimateRenderTick(nowMs: number): number | undefined {
    const latest = this.snaps[this.snaps.length - 1];
    if (latest === undefined) return undefined;
    const anchor = this.clockOffsetMs ?? latest.recvMs - latest.tick * this.tickMs;
    const est = (nowMs - anchor) / this.tickMs - this.delayTicks;
    // Cap at the newest tick so a stalled kernel cannot park the monotonic floor in the future:
    // when deltas resume the floor is at most the tick the buffer already holds.
    const capped = Math.min(est, latest.tick);
    const floor =
      this.lastRenderTick === undefined
        ? capped
        : Math.max(capped, Math.min(this.lastRenderTick, latest.tick));
    if (Number.isFinite(floor)) this.lastRenderTick = floor;
    return floor;
  }

  /** Sample an entity's interpolated transform at an explicit render tick (the tested core). */
  sampleAt(renderTick: number, id: EntityId): InterpTransform | undefined {
    if (this.snaps.length === 0) return undefined;

    let a: TickSnapshot | undefined;
    let b: TickSnapshot | undefined;
    for (const s of this.snaps) {
      if (s.tick <= renderTick) a = s;
      if (s.tick >= renderTick && b === undefined) b = s;
    }

    // Ahead of the buffer (renderTick beyond latest): clamp to latest. Never extrapolate.
    if (a === undefined) {
      // renderTick is before the earliest snapshot: snap to earliest known.
      const earliest = this.snaps[0] as TickSnapshot;
      return this.at(earliest.tick, id);
    }
    if (b === undefined || a.tick === b.tick) {
      return this.at(a.tick, id);
    }

    const ta = this.at(a.tick, id);
    const tb = this.at(b.tick, id);
    // Entity appeared between a and b: snap to its first known transform (no lerp-from-origin).
    if (ta === undefined) return tb;
    // Entity is despawning (gone at b): hold its last transform.
    if (tb === undefined) return ta;
    // Teleport suppresses interpolation for this entity at this tick.
    if (tb.teleport === true) return tb;
    if (ta === tb) return ta;

    const t = (renderTick - a.tick) / (b.tick - a.tick);
    const scaleA: Vec3 = ta.scale ?? [1, 1, 1];
    const scaleB: Vec3 = tb.scale ?? [1, 1, 1];
    return {
      pos: lerp3(ta.pos, tb.pos, t),
      rot: nlerp4(ta.rot, tb.rot, t),
      scale: lerp3(scaleA, scaleB, t),
    };
  }

  /** Sample for a wall-clock time using the estimated render tick. */
  sample(nowMs: number, id: EntityId): InterpTransform | undefined {
    const renderTick = this.estimateRenderTick(nowMs);
    if (renderTick === undefined) return undefined;
    return this.sampleAt(renderTick, id);
  }

  /** Ids present in the most recent snapshot. */
  latestIds(): EntityId[] {
    return [...this.current.keys()];
  }

  clear(): void {
    this.snaps = [];
    this.baseline.clear();
    this.current.clear();
    this.active.clear();
    // A resync restarts the stream (the next tick may be anywhere): re-anchor from its first push.
    this.clockOffsetMs = undefined;
    this.lastRenderTick = undefined;
  }
}

function sameTransform(a: InterpTransform | undefined, b: InterpTransform | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined || a.teleport !== b.teleport) return false;
  return (
    a.pos.every((v, i) => v === b.pos[i]) &&
    a.rot.every((v, i) => v === b.rot[i]) &&
    [0, 1, 2].every((i) => (a.scale?.[i] ?? 1) === (b.scale?.[i] ?? 1))
  );
}
