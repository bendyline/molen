/** Shared main-thread work queue. A job is indivisible; oversize jobs run alone and are reported. */
export interface AdmissionOptions {
  bytes?: number;
  signal?: AbortSignal;
  label?: string;
}
export interface AdmissionSample {
  label: string;
  queueMs: number;
  workMs: number;
  bytes: number;
  overBudget: boolean;
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
}
export class FrameAdmissionQueue implements SceneAdmission {
  private jobs: Job[] = [];
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
    return new Promise<T>((resolve, reject) => {
      const job: Job = {
        run: task,
        resolve: (value) => resolve(value as T),
        reject,
        options,
        queued: this.clock(),
      };
      job.abort = () => {
        const index = this.jobs.indexOf(job);
        if (index >= 0) {
          this.jobs.splice(index, 1);
          reject(new DOMException('Admission cancelled', 'AbortError'));
        }
      };
      options.signal?.addEventListener('abort', job.abort, { once: true });
      this.jobs.push(job);
      this.request();
    });
  }
  get pending(): number {
    return this.jobs.length;
  }
  private request(): void {
    if (this.scheduled || this.disposed || this.jobs.length === 0) return;
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
    while (this.jobs.length > 0) {
      const next = this.jobs[0] as Job;
      const cost = next.options.bytes ?? 0;
      if (
        count > 0 &&
        (count >= this.maxJobs ||
          this.clock() - start >= this.maxMs ||
          bytes + cost > this.maxBytes)
      )
        break;
      this.jobs.shift();
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
      });
    }
    this.request();
  }
  dispose(): void {
    this.disposed = true;
    for (const job of this.jobs) {
      if (job.abort) job.options.signal?.removeEventListener('abort', job.abort);
      job.reject(new DOMException('Admission queue disposed', 'AbortError'));
    }
    this.jobs = [];
  }
}
