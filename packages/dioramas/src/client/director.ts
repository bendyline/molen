import type { Vec3 } from '@bendyline/molen-schema';
import type { DioramaFactory, DioramaInstance, DioramaPlacement, DioramaStatus } from '../types';

interface Entry {
  placement: DioramaPlacement;
  status: DioramaStatus;
  request?: AbortController;
  instance?: DioramaInstance;
}

export interface DioramaDirectorOptions {
  /** Includes loading instances; default 2. */
  maxActive?: number;
  create: DioramaFactory;
  onError?: (error: unknown, id: string) => void;
}

/** Proximity/schedule selection and cancellation. No network or kernel is loaded until selected. */
export class DioramaDirector {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Set<Promise<void>>();
  private readonly maxActive: number;
  private disposed = false;

  constructor(private readonly options: DioramaDirectorOptions) {
    this.maxActive = options.maxActive ?? 2;
    if (!Number.isSafeInteger(this.maxActive) || this.maxActive < 0)
      throw new Error('Diorama maxActive must be a nonnegative integer');
  }

  add(placement: DioramaPlacement): void {
    if (this.disposed) throw new Error('Diorama director is disposed');
    if (!placement.id || this.entries.has(placement.id))
      throw new Error(`Duplicate or empty diorama id: ${placement.id}`);
    const enter = placement.enterDistance ?? 350;
    const exit = placement.exitDistance ?? enter * 1.2;
    if (
      !Number.isFinite(enter) ||
      enter < 0 ||
      !Number.isFinite(exit) ||
      exit < enter ||
      placement.position.length !== 3 ||
      placement.position.some((n) => !Number.isFinite(n)) ||
      !Number.isFinite(placement.yaw ?? 0)
    )
      throw new Error('Invalid diorama placement distances or pose');
    this.entries.set(placement.id, {
      placement: { ...placement, position: [...placement.position] },
      status: 'idle',
    });
  }

  remove(id: string): void {
    const entry = this.entries.get(id);
    if (entry) this.stop(entry);
    this.entries.delete(id);
  }

  list(): readonly string[] {
    return [...this.entries.keys()];
  }
  status(id: string): DioramaStatus | undefined {
    return this.entries.get(id)?.status;
  }
  setPosition(id: string, position: Vec3): void {
    if (position.length !== 3 || position.some((n) => !Number.isFinite(n)))
      throw new Error('Invalid diorama position');
    const entry = this.entries.get(id);
    if (!entry || position.every((n, axis) => n === entry.placement.position[axis])) return;
    entry.placement.position = [...position];
    if (entry.instance?.setPosition) entry.instance.setPosition(position);
    else if (entry.instance) this.stop(entry);
  }
  /** A failed load/script stays failed until explicitly retried, preventing fetch loops. */
  retry(id: string): void {
    const entry = this.entries.get(id);
    if (entry?.status === 'failed') entry.status = 'idle';
  }

  private stop(entry: Entry): void {
    entry.request?.abort();
    entry.request = undefined;
    entry.instance?.dispose();
    entry.instance = undefined;
    if (entry.status !== 'failed') entry.status = 'idle';
  }

  private start(entry: Entry): void {
    const request = new AbortController();
    entry.request = request;
    entry.status = 'loading';
    // Start on a microtask so synchronous loader throws take the same failure path.
    const pending = Promise.resolve()
      .then(() => {
        request.signal.throwIfAborted();
        return entry.placement.load(request.signal);
      })
      .then(async (definition) => {
        if (this.disposed || request.signal.aborted || entry.request !== request) return;
        const instance = await this.options.create(definition, entry.placement);
        if (this.disposed || request.signal.aborted || entry.request !== request) {
          instance.dispose();
          return;
        }
        entry.instance = instance;
        instance.setPosition?.(entry.placement.position);
        entry.status = 'playing';
      })
      .catch((error: unknown) => {
        if (request.signal.aborted || entry.request !== request) return;
        this.stop(entry);
        entry.status = 'failed';
        this.options.onError?.(error, entry.placement.id);
      })
      .finally(() => {
        this.pending.delete(pending);
      });
    this.pending.add(pending);
  }

  /** timeMs is a host clock for eligibility only; scripts advance on their own fixed ticks. */
  update(observer: Vec3, seconds: number, timeMs: number): void {
    if (this.disposed) return;
    if (
      observer.length !== 3 ||
      observer.some((n) => !Number.isFinite(n)) ||
      !Number.isFinite(timeMs) ||
      !Number.isFinite(seconds) ||
      seconds < 0
    )
      throw new Error('Invalid diorama observer, time or elapsed seconds');
    const eligible = [...this.entries.values()]
      .map((entry) => {
        const p = entry.placement;
        const distance = Math.hypot(...p.position.map((n, axis) => n - (observer[axis] as number)));
        const retained = entry.status === 'playing' || entry.status === 'loading';
        const radius = retained
          ? (p.exitDistance ?? (p.enterDistance ?? 350) * 1.2)
          : (p.enterDistance ?? 350);
        return {
          entry,
          distance,
          eligible: entry.status !== 'failed' && distance <= radius && (p.active?.(timeMs) ?? true),
        };
      })
      .filter((candidate) => candidate.eligible)
      // Retain existing slots within hysteresis before admitting new ones.
      .sort(
        (a, b) =>
          Number(b.entry.status !== 'idle') - Number(a.entry.status !== 'idle') ||
          a.distance - b.distance,
      );
    const selected = new Set(eligible.slice(0, this.maxActive).map(({ entry }) => entry));
    for (const entry of this.entries.values()) {
      if (!selected.has(entry)) {
        this.stop(entry);
        continue;
      }
      if (entry.status === 'idle') this.start(entry);
      if (entry.instance) {
        try {
          entry.instance.update(seconds);
        } catch (error) {
          this.stop(entry);
          entry.status = 'failed';
          this.options.onError?.(error, entry.placement.id);
        }
      }
    }
  }

  async whenIdle(): Promise<void> {
    await Promise.all([...this.pending]);
  }
  dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) this.stop(entry);
    this.entries.clear();
  }
}
