import type {
  Command,
  ControlAction,
  KernelInbound,
  KernelOutbound,
  MessageLink,
} from '@bendyline/molen-schema';
import { Scheduler, type SchedulerClock } from './scheduler';
import { takeDelta, takeKeyframe } from './snapshot';
import type { World } from './world';

export interface KernelHostOptions {
  /** Ticks between full keyframes (default from the scene's keyframeInterval, else 60). */
  keyframeInterval?: number;
  rate?: number;
  clock?: SchedulerClock;
  /** Start paused; the client sends a resume control message to begin. Default false. */
  startPaused?: boolean;
}

/**
 * Wires a World + Scheduler to a message link (Worker, MessagePort, or test mock). Commands
 * and control messages come in; keyframes/deltas/events/diag go out. Environment-agnostic:
 * the actual Worker glue (self.onmessage) is a thin wrapper provided by the client/example.
 */
export class KernelHost {
  private readonly scheduler: Scheduler;
  private readonly keyframeInterval: number;
  private lastDeltaTick: number;
  private readonly messageHandler: (ev: { data: unknown }) => void;
  private listeningWithEventTarget = false;
  /** The last tick failure already reported as `tick-failed`, so it is not reported twice. */
  private lastTickFault: Error | undefined;

  constructor(
    private readonly world: World,
    private readonly link: MessageLink,
    opts: KernelHostOptions = {},
  ) {
    this.keyframeInterval = opts.keyframeInterval ?? 60;
    if (!Number.isSafeInteger(this.keyframeInterval) || this.keyframeInterval <= 0) {
      throw new RangeError('keyframeInterval must be a positive safe integer');
    }
    this.lastDeltaTick = world.tick;
    this.scheduler = new Scheduler(world, {
      ...(opts.rate !== undefined ? { rate: opts.rate } : {}),
      ...(opts.clock !== undefined ? { clock: opts.clock } : {}),
      onTick: () => this.afterTick(),
      onOverrun: (dropped) =>
        this.post({ type: 'diag', code: 'tick-overrun', detail: `dropped ${dropped} tick(s)` }),
      // A throwing tick used to kill the loop in silence: no further timer, no state change and
      // no message at all. The scheduler pauses and the page is told which tick died and why.
      onError: (error, tick) => {
        this.lastTickFault = error;
        this.post({ type: 'diag', code: 'tick-failed', detail: `tick ${tick}: ${error.message}` });
      },
    });
    this.messageHandler = (ev) => this.handleUnknown(ev.data);
    this.listen();
    this.post({ type: 'keyframe', keyframe: takeKeyframe(this.world), events: [] });
    this.lastDeltaTick = this.world.tick;
    this.post({ type: 'ready', tick: this.world.tick, tickRate: this.world.tickRate });
    if (opts.startPaused !== true) this.scheduler.start();
  }

  /**
   * Start or resume the scheduler. Initial state is announced by the constructor. Throws if a
   * tick has faulted the world — a `resume` control message answers with a `control-rejected`
   * diag rather than pretending to restart a dead simulation.
   */
  start(): void {
    this.scheduler.start();
  }

  pause(): void {
    this.scheduler.pause();
  }

  /** Manually advance n ticks (used while paused, e.g. by a debugger). */
  step(n = 1): void {
    this.scheduler.step(n);
  }

  dispose(): void {
    this.scheduler.pause();
    if (this.listeningWithEventTarget) {
      this.link.removeEventListener?.('message', this.messageHandler);
    } else if (this.link.onmessage === this.messageHandler) {
      this.link.onmessage = null;
    }
  }

  private afterTick(): void {
    const tick = this.world.tick;
    if (tick % this.keyframeInterval === 0) {
      // Keyframe supersedes the delta for this tick; its events ride on the same message.
      const events = this.world._internal().drainTickEvents();
      this.post({ type: 'keyframe', keyframe: takeKeyframe(this.world), events });
    } else {
      this.post({ type: 'delta', delta: takeDelta(this.world, this.lastDeltaTick) });
    }
    this.lastDeltaTick = tick;
  }

  private post(message: KernelOutbound): void {
    this.link.postMessage(message);
  }

  private listen(): void {
    if (typeof this.link.addEventListener === 'function') {
      this.link.addEventListener('message', this.messageHandler);
      this.listeningWithEventTarget = true;
    } else {
      this.link.onmessage = this.messageHandler;
    }
  }

  private handleUnknown(value: unknown): void {
    const msg = parseInbound(value);
    if (msg === undefined) {
      this.post({ type: 'diag', code: 'protocol-error', detail: 'invalid inbound message' });
      return;
    }
    this.handle(msg);
  }

  private handle(msg: KernelInbound): void {
    if (msg.type === 'command') {
      const result = this.world.submitCommand(msg.command);
      if (!result.accepted) {
        this.post({
          type: 'diag',
          code: 'command-rejected',
          detail: result.reason ?? 'rejected',
        });
      }
      return;
    }
    if (msg.type === 'control') {
      const c = msg.control;
      try {
        switch (c.action) {
          case 'pause':
            this.scheduler.pause();
            break;
          case 'resume':
            this.scheduler.start();
            break;
          case 'step':
            this.scheduler.step(c.ticks ?? 1);
            break;
          case 'request-keyframe':
            this.post({ type: 'keyframe', keyframe: takeKeyframe(this.world), events: [] });
            this.lastDeltaTick = this.world.tick;
            break;
          case 'set-rate':
            this.scheduler.setRate(c.hz);
            break;
        }
      } catch (error) {
        // A control-driven step that faulted is already on the wire as `tick-failed`; reporting
        // it again as a rejected control would misattribute the failure to the message.
        if (error === this.lastTickFault) return;
        this.post({
          type: 'diag',
          code: 'control-rejected',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInbound(value: unknown): KernelInbound | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type === 'command' && isCommand(value.command)) {
    return { type: 'command', command: value.command };
  }
  if (value.type === 'control' && isControl(value.control)) {
    return { type: 'control', control: value.control };
  }
  return undefined;
}

function isCommand(value: unknown): value is Command {
  if (!isRecord(value)) return false;
  return (
    value.kind === 'command' &&
    Number.isSafeInteger(value.seq) &&
    (value.seq as number) >= 0 &&
    typeof value.source === 'string' &&
    value.source.length > 0 &&
    Number.isSafeInteger(value.tick) &&
    (value.tick as number) >= 0 &&
    typeof value.type === 'string' &&
    value.type.length > 0 &&
    Object.hasOwn(value, 'payload')
  );
}

function isControl(value: unknown): value is ControlAction {
  if (!isRecord(value) || typeof value.action !== 'string') return false;
  switch (value.action) {
    case 'pause':
    case 'resume':
    case 'request-keyframe':
      return true;
    case 'step':
      return (
        value.ticks === undefined ||
        (Number.isSafeInteger(value.ticks) && (value.ticks as number) >= 0)
      );
    case 'set-rate':
      return typeof value.hz === 'number' && Number.isFinite(value.hz);
    default:
      return false;
  }
}
