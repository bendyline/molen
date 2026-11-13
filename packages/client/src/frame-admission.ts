/** Shared main-thread work queue. A job is indivisible; oversize jobs run alone and are reported. */
export interface AdmissionOptions {
  bytes?: number;
  signal?: AbortSignal;
  label?: string;
  /**
   * Background jobs run in frame budget that no normal job is waiting for, and once one has waited
   * `backgroundWaitMs` it takes a turn after every `backgroundShare` other jobs. Urgent jobs run
   * before normal ones, in their own order: small work the view is visibly waiting on, such as
   * terrain ground. Sustained urgent traffic shares service with waiting normal work.
   */
  priority?: 'urgent' | 'normal' | 'background';
  /** Live order within normal work, lower first. Unordered work still receives regular service. */
  order?: () => number;
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
  /** Jobs waiting, where the queue can say, so optional work can hold off behind a backlog. */
  readonly pending?: number;
}
export interface FrameAdmissionOptions {
  maxMilliseconds?: number;
  maxBytes?: number;
  maxJobs?: number;
  /**
   * How long a background job waits (ms, default 750) before the lane takes turns with the others,
   * and how many other jobs run between its turns (default 8). In flight normal work never runs
   * out, and what waited behind it (texture upgrades, the levels an object is not showing yet)
   * arrived seconds late: a second on average over a town, five at worst.
   */
  backgroundWaitMs?: number;
  backgroundShare?: number;
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
/** The frame length per-frame budgets are set for: 60 frames a second. */
const NOMINAL_FRAME_MS = 1000 / 60;
export class FrameAdmissionQueue implements SceneAdmission {
  private jobs: Job[] = [];
  private background: Job[] = [];
  private readonly queuedBackground = new WeakMap<Promise<unknown>, Job>();
  private scheduled = false;
  private disposed = false;
  private paused = false;
  /** Milliseconds past its budget the last flush ran, repaid from the frames after it. */
  private overrunMs = 0;
  /** When the last flush finished, so a repaying frame knows how long it was. */
  private lastFlushEnd: number | undefined;
  private readonly clock: () => number;
  private readonly schedule: (callback: () => void) => void;
  private maxMs: number;
  private maxBytes: number;
  private maxJobs: number;
  private urgentStreak = 0;
  private orderedStreak = 0;
  /** Jobs from the other lanes since the background lane last ran one. */
  private foregroundStreak = 0;
  private readonly backgroundWaitMs: number;
  private readonly backgroundShare: number;
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
    this.backgroundWaitMs = options.backgroundWaitMs ?? 750;
    this.backgroundShare = options.backgroundShare ?? 8;
    if (!(this.backgroundWaitMs >= 0) || !(this.backgroundShare >= 1))
      throw new RangeError(
        'Background admission needs a nonnegative wait and a share of 1 or more',
      );
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
  /** Hold queued uploads/preparation while the view is inactive; keep resources for resume. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.request();
  }
  private request(): void {
    if (this.scheduled || this.disposed || this.paused || this.pending === 0) return;
    this.scheduled = true;
    this.schedule(() => {
      this.scheduled = false;
      this.flush();
    });
  }
  /**
   * One frame's budget. Exposed for hosts with a manual frame loop and deterministic tests.
   *
   * A job cannot be split, so one can take several frames' budget by itself, and a queue of them
   * would hold every frame at that length however small the budget. A frame that overruns repays
   * the excess from the frames after it, so the budget holds on average: a 20 ms shader build
   * every third frame, rather than every frame at half the frame rate, for the same throughput.
   *
   * The budget is a share of a frame at 60 a second. A frame that comes later than that repays
   * the same share of its own length: under software rendering a frame takes 200 ms or more, and
   * a job that waits on the GPU once is charged for a whole such frame, so repaying 2 ms a frame
   * left the queue idle for minutes. At 60 frames a second and faster nothing changes.
   */
  flush(): void {
    if (this.disposed || this.paused) return;
    if (this.overrunMs > 0) {
      const sinceLast = this.lastFlushEnd === undefined ? 0 : this.clock() - this.lastFlushEnd;
      const repaid = Math.max(this.maxMs, (sinceLast * this.maxMs) / NOMINAL_FRAME_MS);
      this.overrunMs = Math.max(0, this.overrunMs - repaid);
      this.lastFlushEnd = this.clock();
      this.request();
      return;
    }
    const start = this.clock();
    let bytes = 0,
      count = 0;
    for (;;) {
      // A background job that has waited its time out takes a turn among the others.
      const overdue =
        this.jobs.length > 0 &&
        this.foregroundStreak >= this.backgroundShare &&
        this.background.length > 0 &&
        this.clock() - (this.background[0] as Job).queued >= this.backgroundWaitMs;
      const lane = this.jobs.length > 0 && !overdue ? this.jobs : this.background;
      // A flying camera continuously produces urgent terrain. Strict priority left semantic
      // decode/publication waiting tens of seconds, even with idle geometry workers. After
      // two urgent jobs, serve one normal job that has waited at least 50 ms. Keep the streak
      // across frames: an indivisible terrain job may consume a whole frame's allowance.
      const waitingNormal =
        lane === this.jobs && this.urgentStreak >= 2
          ? lane.findIndex((job) => job.options.priority !== 'urgent')
          : -1;
      let index =
        waitingNormal >= 0 && this.clock() - (lane[waitingNormal] as Job).queued >= 50
          ? waitingNormal
          : 0;
      // Re-read distance/deadline at dispatch, after camera motion. Three ordered jobs may
      // overtake the FIFO head, then the head gets a turn (shared decodes/assets must progress).
      if (
        lane === this.jobs &&
        lane[index]?.options.priority !== 'urgent' &&
        this.orderedStreak < 3
      ) {
        let best = Number.POSITIVE_INFINITY;
        for (let i = index; i < lane.length; i++) {
          const order = lane[i]?.options.order?.() ?? Number.POSITIVE_INFINITY;
          if (order < best) {
            best = order;
            index = i;
          }
        }
      }
      const next = lane[index];
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
      lane.splice(index, 1);
      this.forget(next);
      if (next.abort) next.options.signal?.removeEventListener('abort', next.abort);
      if (next.options.signal?.aborted) {
        next.reject(new DOMException('Admission cancelled', 'AbortError'));
        continue;
      }
      this.foregroundStreak = lane === this.background ? 0 : this.foregroundStreak + 1;
      this.urgentStreak = next.options.priority === 'urgent' ? this.urgentStreak + 1 : 0;
      if (next.options.priority !== 'urgent')
        this.orderedStreak =
          next.options.order !== undefined && this.orderedStreak < 3 ? this.orderedStreak + 1 : 0;
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
    // With nothing waiting there is nothing to pace.
    this.overrunMs = this.pending > 0 ? Math.max(0, this.clock() - start - this.maxMs) : 0;
    this.lastFlushEnd = this.clock();
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
