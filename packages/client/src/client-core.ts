import type {
  Command,
  ControlAction,
  DiagMessage,
  EngineEvent,
  EntityId,
  JsonObject,
  JsonValue,
  KernelOutbound,
  MessageLink,
} from '@bendyline/molen-schema';
import { InterpolationBuffer, type InterpTransform } from './interpolation';
import { type SceneBackend, SceneMirror } from './sync';

// The renderer-free heart of a live client: a message link in, a scene mirror + interpolation
// buffer maintained from keyframes/deltas, events and diagnostics dispatched to subscribers,
// commands out. `createClient` composes this with a three.js backend; tests drive it with a mock
// link and a mock backend (no WebGL needed).

export type Unsubscribe = () => void;

/**
 * A failure the page has to see. `link` is the kernel side going away or misbehaving (an uncaught
 * throw in the Worker, a script that fails to load, an undeserializable message); `frame` is an
 * exception out of the client's own render frame. Both also reach `onDiag` as a `ClientDiagCode`
 * diagnostic, so a page that only wired diagnostics still learns its kernel is dead.
 */
export interface ClientError {
  source: 'link' | 'frame';
  /** Human-readable summary, already including the underlying message where one was available. */
  message: string;
  /** The `ErrorEvent`/`MessageEvent` or thrown value behind it, when there was one. */
  cause?: unknown;
}

/** Diag codes the client synthesizes for failures the kernel cannot report (it is the casualty). */
export type ClientDiagCode = 'link-error' | 'frame-error';

export interface ClientCoreOptions {
  link: MessageLink;
  backend: SceneBackend;
  interpolationDelayTicks?: number;
  /** Wall clock in ms (default performance.now / Date.now); injectable for tests. */
  now?: () => number;
}

export interface ClientCore {
  readonly mirror: SceneMirror;
  /** The interpolation buffer, once the first keyframe/ready message fixed the tick rate. */
  readonly buffer: InterpolationBuffer | undefined;
  /** The latest kernel tick applied to the mirror. */
  readonly tick: number | undefined;
  /** Subscribe to kernel events by type, or `'*'` for all. Exact-type handlers run first. */
  onEvent(type: string, cb: (event: EngineEvent, tick: number) => void): Unsubscribe;
  /**
   * Subscribe to kernel diagnostics (tick overruns, rejected commands, protocol errors). Codes the
   * client does not know are delivered as they arrive rather than dropped, so a newer kernel's
   * diagnostics reach an older page.
   */
  onDiag(cb: (diag: DiagMessage) => void): Unsubscribe;
  /**
   * Subscribe to client-side failures: a dead or throwing kernel link, and frame-loop exceptions.
   * Without this a crashed Worker is invisible — the page keeps rendering its last pose while
   * every `command()` posts into nothing.
   */
  onError(cb: (error: ClientError) => void): Unsubscribe;
  /** Push a failure through the error + diag channels (the frame loop and custom backends use it). */
  reportError(error: ClientError): void;
  /** Read a component of a mirrored entity (a detached copy). */
  get(id: EntityId, component: string): JsonObject | undefined;
  /** Every mirrored entity id (creation order). */
  entities(): EntityId[];
  /** Sample every interpolated transform for `nowMs` into the backend (or any consumer). */
  sampleTransforms(nowMs: number, apply: (id: EntityId, t: InterpTransform) => void): void;
  sendCommand(command: Command): void;
  /** Send a command by type + payload; the envelope is filled (`seq`, `source: 'local'`). */
  command(type: string, payload?: JsonValue): void;
  /**
   * Drive the kernel's scheduler: `pause`, `resume`, `step` a fixed number of ticks, `set-rate`,
   * or `request-keyframe`. Pairs with the host's `startPaused` option — a page that boots paused
   * resumes once its assets are in, so nothing simulates behind a loading screen.
   */
  control(action: ControlAction): void;
  /** Unhook the link and clear the buffer. */
  dispose(): void;
}

/** The envelope `command()` fills: local source, kernel re-stamps tick 0 to next tick. */
export function localCommand(seq: number, type: string, payload: Command['payload']): Command {
  return { kind: 'command', seq, source: 'local', tick: 0, type, payload };
}

export function createClientCore(opts: ClientCoreOptions): ClientCore {
  const { link, backend } = opts;
  const mirror = new SceneMirror();
  let buffer: InterpolationBuffer | undefined;
  let bufferTickRate: number | undefined;
  let awaitingKeyframe = false;
  const delayTicks = opts.interpolationDelayTicks;
  const nowMs =
    opts.now ??
    ((): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

  const eventHandlers = new Map<string, Set<(event: EngineEvent, tick: number) => void>>();
  const diagHandlers = new Set<(diag: DiagMessage) => void>();
  const errorHandlers = new Set<(error: ClientError) => void>();

  function dispatchDiag(diag: DiagMessage): void {
    for (const handler of [...diagHandlers]) handler(diag);
  }

  function reportError(error: ClientError): void {
    for (const handler of [...errorHandlers]) handler(error);
    // `link-error`/`frame-error` are client-originated codes the kernel cannot send (it is the
    // casualty), declared in the shared diag union so a page that only wired diagnostics still
    // learns its worker died.
    const code: ClientDiagCode = error.source === 'link' ? 'link-error' : 'frame-error';
    dispatchDiag({
      type: 'diag',
      code,
      detail: error.message,
    });
  }

  function ensureBuffer(tickRate: number): InterpolationBuffer {
    if (buffer === undefined || bufferTickRate !== tickRate) {
      buffer = new InterpolationBuffer(
        tickRate,
        delayTicks !== undefined ? { delayTicks } : undefined,
      );
      bufferTickRate = tickRate;
    }
    return buffer;
  }

  function dispatchEvents(events: EngineEvent[], tick: number): void {
    for (const event of events) {
      // Exact type first, then the wildcard — the kernel's own World.emit order.
      for (const handler of [...(eventHandlers.get(event.type) ?? [])]) handler(event, tick);
      for (const handler of [...(eventHandlers.get('*') ?? [])]) handler(event, tick);
    }
  }

  function onMessage(msg: KernelOutbound): void {
    switch (msg.type) {
      case 'ready':
        ensureBuffer(msg.tickRate);
        break;
      case 'keyframe': {
        const buf = ensureBuffer(msg.keyframe.tickRate);
        // A periodic keyframe (the kernel sends one INSTEAD of a delta every keyframeInterval)
        // continues the stream: keep the ring so interpolation never collapses to one sample.
        // Only a resync keyframe (boot, or after a delta gap) resets the buffer.
        const contiguous = buf.latestTick !== undefined && msg.keyframe.tick === buf.latestTick + 1;
        if (!contiguous) buf.clear();
        awaitingKeyframe = false;
        mirror.applyKeyframe(msg.keyframe);
        mirror.reconcile(backend);
        buf.push(msg.keyframe.tick, mirror.transforms(), nowMs());
        // A keyframe may replace a binding while its transform stays unchanged.
        for (const id of mirror.entities()) buf.activate(id);
        dispatchEvents(msg.events ?? [], msg.keyframe.tick);
        break;
      }
      case 'delta': {
        if (buffer === undefined) break; // wait for first keyframe
        if (!mirror.applyDelta(msg.delta)) {
          buffer.clear();
          if (!awaitingKeyframe) {
            awaitingKeyframe = true;
            link.postMessage({ type: 'control', control: { action: 'request-keyframe' } });
          }
          break;
        }
        buffer.pushDelta(msg.delta.tick, mirror.transformChanges(msg.delta), nowMs());
        mirror.reconcile(backend);
        for (const [id, components] of Object.entries(msg.delta.changed))
          if (components.renderable !== undefined || components.light !== undefined)
            buffer.activate(id);
        dispatchEvents(msg.delta.events ?? [], msg.delta.tick);
        break;
      }
      case 'diag':
        // Any code, known or not: an unrecognized diagnostic is still the kernel telling the page
        // something (a newer kernel's `tick-failed`, say), and dropping it hides the failure.
        dispatchDiag(msg);
        break;
      default:
        break;
    }
  }

  // Wire the link. A Worker/MessagePort also emits `error` (an uncaught throw or a script that
  // failed to load) and `messageerror` (an undeserializable message); MessageLink only types the
  // `message` subscription, so the extra listeners go on through a structural view of the link.
  const handler = (ev: { data: unknown }): void => onMessage(ev.data as KernelOutbound);
  const listeningWithEventTarget = typeof link.addEventListener === 'function';
  const linkEvents = link as unknown as {
    addEventListener(type: string, listener: (ev: unknown) => void): void;
    removeEventListener(type: string, listener: (ev: unknown) => void): void;
  };
  const onLinkError = (ev: unknown): void =>
    reportError({ source: 'link', message: describeLinkFailure('error', ev), cause: ev });
  const onLinkMessageError = (ev: unknown): void =>
    reportError({ source: 'link', message: describeLinkFailure('messageerror', ev), cause: ev });
  if (listeningWithEventTarget) {
    link.addEventListener?.('message', handler);
    linkEvents.addEventListener('error', onLinkError);
    linkEvents.addEventListener('messageerror', onLinkMessageError);
  } else link.onmessage = handler;

  const sendCommand = (command: Command): void => link.postMessage({ type: 'command', command });
  let seq = 0;

  return {
    mirror,
    get buffer() {
      return buffer;
    },
    get tick() {
      return mirror.tick;
    },
    onEvent(type, cb) {
      let set = eventHandlers.get(type);
      if (set === undefined) {
        set = new Set();
        eventHandlers.set(type, set);
      }
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },
    onDiag(cb) {
      diagHandlers.add(cb);
      return () => {
        diagHandlers.delete(cb);
      };
    },
    onError(cb) {
      errorHandlers.add(cb);
      return () => {
        errorHandlers.delete(cb);
      };
    },
    reportError,
    get: (id, component) => mirror.get(id, component),
    entities: () => mirror.entities(),
    sampleTransforms(t, apply) {
      if (buffer === undefined) return;
      buffer.sampleActive(t, apply);
    },
    sendCommand,
    command: (type, payload = {}) => sendCommand(localCommand(seq++, type, payload)),
    control: (action) => link.postMessage({ type: 'control', control: action }),
    dispose: () => {
      if (listeningWithEventTarget) {
        link.removeEventListener?.('message', handler);
        linkEvents.removeEventListener('error', onLinkError);
        linkEvents.removeEventListener('messageerror', onLinkMessageError);
      } else if (link.onmessage === handler) link.onmessage = null;
      buffer?.clear();
      eventHandlers.clear();
      diagHandlers.clear();
      errorHandlers.clear();
    },
  };
}

/** Readable summary of a link failure event; a bare `error` event carries no detail at all. */
function describeLinkFailure(kind: 'error' | 'messageerror', ev: unknown): string {
  if (kind === 'messageerror') return 'kernel link could not deserialize a message';
  const detail = ev as { message?: unknown; filename?: unknown; lineno?: unknown } | null;
  if (detail !== null && typeof detail === 'object' && typeof detail.message === 'string') {
    const where =
      typeof detail.filename === 'string' && detail.filename !== ''
        ? ` (${detail.filename}${typeof detail.lineno === 'number' ? `:${detail.lineno}` : ''})`
        : '';
    return `kernel link error: ${detail.message}${where}`;
  }
  return 'kernel link error (no detail; the worker may have failed to load)';
}
