/** Shared main-thread work queue. A job is indivisible; oversize jobs run alone and are reported. */
export interface AdmissionOptions {
  bytes?: number;
  signal?: AbortSignal;
  label?: string;
  /** Background jobs run only in frame budget that no normal job is waiting for. */
  priority?: 'normal' | 'background';
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
  private readonly maxMs: number;
  private readonly maxBytes: number;
  private readonly maxJobs: number;
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
    if (![this.maxMs, this.maxBytes, this.maxJobs].every((v) => Number.isFinite(v) && v > 0))
      throw new RangeError('Admission budgets must be finite and positive');
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
      (options.priority === 'background' ? this.background : this.jobs).push(job);
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
  /** Move a still-queued background job to the normal lane, behind the jobs already there. */
  promote(promise: Promise<unknown>): void {
    const job = this.queuedBackground.get(promise);
    const index = job === undefined ? -1 : this.background.indexOf(job);
    if (job === undefined || index < 0) return;
    this.forget(job);
    this.background.splice(index, 1);
    job.options = { ...job.options, priority: 'normal' };
    this.jobs.push(job);
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
      if (
        count > 0 &&
        (count >= this.maxJobs ||
          this.clock() - start >= this.maxMs ||
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
      count++;
      bytes += cost;
      this.options.onSample?.({
        label: next.options.label ?? 'admission',
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
