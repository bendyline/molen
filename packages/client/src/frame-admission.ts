/** Shared main-thread work queue. A job is indivisible; oversize jobs run alone and are reported. */
export interface AdmissionOptions {
  bytes?: number;
  signal?: AbortSignal;
  label?: string;
  /**
   * Background jobs run only in frame budget that no normal job is waiting for. Urgent jobs run
   * before normal ones, in their own order: small work the view is visibly waiting on, such as
   * terrain ground, which otherwise queued behind every building cell's upload.
   */
  priority?: 'urgent' | 'normal' | 'background';
}
export interface AdmissionSample {
  label: string;
  queueMs: number;
  workMs: number;
  bytes: number;
  overBudget: boolean;
  /** Ran from the background lane, so its queue time was deliberately deferred. */
  background: boolean;
}
export interface SceneAdmission {
  run<T>(task: () => T, options?: AdmissionOptions): Promise<T>;
}
export interface FrameAdmissionOptions {
  maxMilliseconds?: number;
  maxBytes?: number;
  maxJobs?: number;
  now?: () => number;
  schedule?: (callback: () => void) => void;
  onSample?: (sample: AdmissionSample) => void;
}
interface Job {
  run: () => unknown;
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
  options: AdmissionOptions;
  queued: number;
  abort?: () => void;
  /** A queued background job's promise, the key `promote` finds it by. */
  promise?: Promise<unknown>;
}
export class FrameAdmissionQueue implements SceneAdmission {
  private jobs: Job[] = [];
  private background: Job[] = [];
  private readonly queuedBackground = new WeakMap<Promise<unknown>, Job>();
  private scheduled = false;
  private disposed = false;
  private readonly clock: () => number;
  private readonly schedule: (callback: () => void) => void;
  private maxMs: number;
  private maxBytes: number;
  private maxJobs: number;
  /** Recent work time per label (ms, smoothed): what the next job of that kind will likely take. */
  private readonly expected = new Map<string, number>();
  constructor(private readonly options: FrameAdmissionOptions = {}) {
    this.clock = options.now ?? (() => performance.now());
    this.schedule =
      options.schedule ??
      ((callback) => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
        else setTimeout(callback, 0);
      });
    this.maxMs = options.maxMilliseconds ?? 2;
    this.maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
    this.maxJobs = options.maxJobs ?? 32;
    this.setLimits({});
  }
  /**
   * Change the per-frame budget from the next frame on; omitted limits keep their values. A host
   * can admit more when frames have time to spare (an adaptive quality tier, say).
   */
  setLimits(limits: Pick<FrameAdmissionOptions, 'maxMilliseconds' | 'maxBytes' | 'maxJobs'>): void {
    const next = [
      limits.maxMilliseconds ?? this.maxMs,
      limits.maxBytes ?? this.maxBytes,
      limits.maxJobs ?? this.maxJobs,
    ] as const;
    if (!next.every((v) => Number.isFinite(v) && v > 0))
      throw new RangeError('Admission budgets must be finite and positive');
    [this.maxMs, this.maxBytes, this.maxJobs] = next;
  }
  run<T>(task: () => T, options: AdmissionOptions = {}): Promise<T> {
    if (this.disposed || options.signal?.aborted)
      return Promise.reject(new DOMException('Admission cancelled', 'AbortError'));
    if (!Number.isFinite(options.bytes ?? 0) || (options.bytes ?? 0) < 0)
      return Promise.reject(new RangeError('Admission bytes must be finite and nonnegative'));
    let job!: Job;
    const promise = new Promise<T>((resolve, reject) => {
      job = {
        run: task,
        resolve: (value) => resolve(value as T),
        reject,
        options,
        queued: this.clock(),
      };
      job.abort = () => {
        const lane = this.jobs.includes(job) ? this.jobs : this.background;
        const index = lane.indexOf(job);
        if (index >= 0) {
          lane.splice(index, 1);
          this.forget(job);
          reject(new DOMException('Admission cancelled', 'AbortError'));
        }
      };
      options.signal?.addEventListener('abort', job.abort, { once: true });
      if (options.priority === 'background') this.background.push(job);
      else if (options.priority === 'urgent') {
        const after = this.jobs.findIndex((queued) => queued.options.priority !== 'urgent');
        this.jobs.splice(after < 0 ? this.jobs.length : after, 0, job);
      } else this.jobs.push(job);
      this.request();
    });
    if (options.priority === 'background') {
      job.promise = promise;
      this.queuedBackground.set(promise, job);
    }
    return promise;
  }
  /**
   * Callers keep the promise (preparation caches do, keyed by long-lived resources); the job holds
   * the task and everything it captured. Only a queued job may stay reachable from its promise.
   */
  private forget(job: Job): void {
    if (job.promise === undefined) return;
    this.queuedBackground.delete(job.promise);
    job.promise = undefined;
  }
  /**
   * Move a still-queued background job to the normal lane, behind the jobs already there, or with
   * `front` ahead of them: for work a frame is waiting on, such as a material an object holds off
   * switching to until it is prepared.
   */
  promote(promise: Promise<unknown>, options: { front?: boolean } = {}): void {
    const job = this.queuedBackground.get(promise);
    const index = job === undefined ? -1 : this.background.indexOf(job);
    if (job === undefined || index < 0) return;
    this.forget(job);
    this.background.splice(index, 1);
    job.options = { ...job.options, priority: 'normal' };
    if (options.front === true) this.jobs.unshift(job);
    else this.jobs.push(job);
    this.request();
  }
  get pending(): number {
    return this.jobs.length + this.background.length;
  }
  private request(): void {
    if (this.scheduled || this.disposed || this.pending === 0) return;
    this.scheduled = true;
    this.schedule(() => {
      this.scheduled = false;
      this.flush();
    });
  }
  /** One frame's budget. Exposed for hosts with a manual frame loop and deterministic tests. */
  flush(): void {
    if (this.disposed) return;
    const start = this.clock();
    let bytes = 0,
      count = 0;
    for (;;) {
      const lane = this.jobs.length > 0 ? this.jobs : this.background;
      const next = lane[0];
      if (next === undefined) break;
      const cost = next.options.bytes ?? 0;
      const label = next.options.label ?? 'admission';
      // A frame's first job always runs, however long. After it, a job of a kind that has taken
      // longer than the budget left waits to open the next frame: a town tile's 10-25 ms request
      // or assembly behind a few small jobs held the frame past 50 ms.
      if (
        count > 0 &&
        (count >= this.maxJobs ||
          this.clock() - start + (this.expected.get(label) ?? 0) > this.maxMs ||
          bytes + cost > this.maxBytes)
      )
        break;
      lane.shift();
      this.forget(next);
      if (next.abort) next.options.signal?.removeEventListener('abort', next.abort);
      if (next.options.signal?.aborted) {
        next.reject(new DOMException('Admission cancelled', 'AbortError'));
        continue;
      }
      const began = this.clock();
      try {
        next.resolve(next.run());
      } catch (error) {
        next.reject(error);
      }
      const workMs = this.clock() - began;
      const previous = this.expected.get(label);
      this.expected.set(
        label,
        previous === undefined ? workMs : previous + (workMs - previous) * 0.25,
      );
      count++;
      bytes += cost;
      this.options.onSample?.({
        label,
        queueMs: began - next.queued,
        workMs,
        bytes: cost,
        overBudget: workMs > this.maxMs || cost > this.maxBytes,
        background: next.options.priority === 'background',
      });
    }
    this.request();
  }
  dispose(): void {
    this.disposed = true;
    for (const job of [...this.jobs, ...this.background]) {
      if (job.abort) job.options.signal?.removeEventListener('abort', job.abort);
      job.reject(new DOMException('Admission queue disposed', 'AbortError'));
    }
    this.jobs = [];
    this.background = [];
  }
}
