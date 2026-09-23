import type { Command, Delta, EngineEvent, Keyframe } from './types';

// Kernel <-> client message protocol (docs/01-architecture.md §3). Structured-clone-safe
// plain objects over postMessage. Commands/control in; keyframes/deltas/events/diag out.

export interface CommandMessage {
  type: 'command';
  command: Command;
}

export type ControlAction =
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'step'; ticks?: number }
  | { action: 'request-keyframe' }
  | { action: 'set-rate'; hz: number }; // playback rate of the scheduler, not the sim tickRate

export interface ControlMessage {
  type: 'control';
  control: ControlAction;
}

/** Messages the client sends to the kernel. */
export type KernelInbound = CommandMessage | ControlMessage;

/**
 * A full snapshot plus the events of the tick it was taken on (a keyframe replaces that tick's
 * delta, so its events ride along; deltas carry theirs in `delta.events`). One ordering rule
 * for the client: apply the state, then dispatch the message's events at its tick.
 */
export interface KeyframeMessage {
  type: 'keyframe';
  keyframe: Keyframe;
  events: EngineEvent[];
}

export interface DeltaMessage {
  type: 'delta';
  delta: Delta;
}

export interface ReadyMessage {
  type: 'ready';
  tick: number;
  tickRate: number;
}

export interface DiagMessage {
  type: 'diag';
  code:
    | 'tick-overrun'
    | 'command-rejected'
    | 'protocol-error'
    | 'control-rejected'
    /**
     * A tick threw. The kernel is paused and the world is faulted: it will not resume until it
     * is rebuilt or restored from a keyframe. `detail` carries the tick and the error message.
     */
    | 'tick-failed'
    /**
     * Client-originated, not sent by the kernel: the message link itself failed (a Worker
     * `error`/`messageerror`), or a render frame threw. The client surfaces both through the same
     * `onDiag` channel so a host has one place to watch for "the experience stopped working".
     */
    | 'link-error'
    | 'frame-error';
  detail: string;
}

/** Messages the kernel sends to the client. */
export type KernelOutbound = ReadyMessage | KeyframeMessage | DeltaMessage | DiagMessage;

/**
 * Minimal structural type satisfied by a Worker, MessagePort, or a test mock. The event
 * parameter is intentionally loose (`any`) so a DOM `Worker` (whose handlers take a full
 * MessageEvent) is structurally assignable; consumers read only `ev.data`.
 */
// biome-ignore lint/suspicious/noExplicitAny: structural transport type must accept DOM Worker handlers
type MessageEventLike = (ev: any) => void;
export interface MessageLink {
  postMessage(message: unknown): void;
  addEventListener?(type: 'message', listener: MessageEventLike): void;
  removeEventListener?(type: 'message', listener: MessageEventLike): void;
  onmessage?: MessageEventLike | null;
}
