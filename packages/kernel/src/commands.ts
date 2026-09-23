import type { Command, CommandQueueState, JsonValue, PayloadCheck } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { cloneJson } from './clone';
import type { TickContext, World } from './world';

export type CommandHandler<W> = (world: W, command: Command, ctx: TickContext) => void;

export type { PayloadCheck };

/** Per-type declaration: an optional payload validator (runs after envelope validation). */
export interface CommandTypeDef<W> {
  handler: CommandHandler<W>;
  /** Optional payload validator (a scene's declared JSON Schema, or hand-written). */
  validatePayload?: (payload: JsonValue) => PayloadCheck;
}

export interface DeclareCommandOptions {
  validatePayload?: (payload: JsonValue) => PayloadCheck;
}

export type LateCommandPolicy = 'rewrite' | 'reject';

export interface SubmitResult {
  accepted: boolean;
  /** Set when accepted: the tick the command will actually execute on. */
  tickExecuted?: number;
  /** Set when rejected: human/agent-facing reason. */
  reason?: string;
}

interface CommandDef<W> {
  validatePayload?: (payload: JsonValue) => PayloadCheck;
  handlers: CommandHandler<W>[];
}

/**
 * Per-tick command queue + adjudication (docs/04-kernel-design.md §3).
 * Validates on receipt (invalid commands never queue, so replay logs contain only valid
 * commands), queues by execution tick, and executes sorted by (source, seq).
 *
 * A command TYPE is declared once (optionally with a payload validator) and may carry any
 * number of handlers, run in registration order: a scene declares `move`, a setup module and
 * three scripts can all handle it. Unknown types are still rejected on receipt.
 */
export class CommandQueue<W extends World = World> {
  private readonly defs = new Map<string, CommandDef<W>>();
  private readonly queued = new Map<number, Command[]>();
  private readonly highestSeq = new Map<string, number>();

  constructor(private latePolicy: LateCommandPolicy) {}

  /**
   * Declare a command type. Idempotent for the same validator; declaring an already-declared
   * type with a DIFFERENT validator throws (two definitions silently fighting is a hazard).
   */
  declare(type: string, opts?: DeclareCommandOptions): void {
    const existing = this.defs.get(type);
    if (existing === undefined) {
      this.defs.set(type, {
        ...(opts?.validatePayload !== undefined ? { validatePayload: opts.validatePayload } : {}),
        handlers: [],
      });
      return;
    }
    if (opts?.validatePayload === undefined) return;
    if (existing.validatePayload === undefined) {
      existing.validatePayload = opts.validatePayload;
      return;
    }
    if (existing.validatePayload !== opts.validatePayload) {
      throw new Error(`command type "${type}" already declared with a different payload validator`);
    }
  }

  /** Attach a handler (declaring the type if needed). Returns a remover. */
  addHandler(type: string, handler: CommandHandler<W>): () => void {
    this.declare(type);
    const def = this.defs.get(type) as CommandDef<W>;
    def.handlers.push(handler);
    return () => {
      const i = def.handlers.indexOf(handler);
      if (i >= 0) def.handlers.splice(i, 1);
    };
  }

  hasType(type: string): boolean {
    return this.defs.has(type);
  }

  types(): string[] {
    return [...this.defs.keys()];
  }

  /**
   * Validate and enqueue a command. `currentTick` is the world's current tick. Returns whether
   * it was accepted and the tick it will execute on (after late-command adjudication).
   */
  submit(command: Command, currentTick: number): SubmitResult {
    const checked = this.check(command);
    if ('reason' in checked) return { accepted: false, reason: checked.reason };
    const { cmd } = checked;

    const previous = this.highestSeq.get(cmd.source);
    if (previous !== undefined && cmd.seq <= previous) {
      return {
        accepted: false,
        reason: `non-monotonic command sequence for "${cmd.source}": ${cmd.seq} <= ${previous}`,
      };
    }

    let execTick = cmd.tick;
    if (execTick <= currentTick) {
      if (this.latePolicy === 'reject') {
        return {
          accepted: false,
          reason: `late command: tick ${cmd.tick} <= current ${currentTick} (policy: reject)`,
        };
      }
      execTick = currentTick + 1; // rewrite-to-next
    }

    this.enqueue(cmd, execTick);
    this.highestSeq.set(cmd.source, cmd.seq);
    return { accepted: true, tickExecuted: execTick };
  }

  /** Enqueue a replay command at its already-adjudicated tick, bypassing live late-command rules. */
  submitRecorded(command: Command): SubmitResult {
    const checked = this.check(command);
    if ('reason' in checked) return { accepted: false, reason: checked.reason };
    const execTick = checked.cmd.tickExecuted ?? checked.cmd.tick;
    this.enqueue(checked.cmd, execTick);
    this.highestSeq.set(
      checked.cmd.source,
      Math.max(this.highestSeq.get(checked.cmd.source) ?? -1, checked.cmd.seq),
    );
    return { accepted: true, tickExecuted: execTick };
  }

  private check(command: Command): { cmd: Command; def: CommandDef<W> } | { reason: string } {
    const envelope = validate('command', command);
    if (!envelope.ok) return { reason: envelope.formatted };
    const cmd = envelope.value;
    const def = this.defs.get(cmd.type);
    if (def === undefined) {
      const known = this.types();
      return {
        reason: `unknown command type "${cmd.type}"${
          known.length > 0 ? ` (declared: ${known.join(', ')})` : ' (no commands declared)'
        }`,
      };
    }
    if (def.validatePayload !== undefined) {
      const result = def.validatePayload(cmd.payload);
      if (!result.ok) return { reason: result.message };
    }
    return { cmd, def };
  }

  private enqueue(cmd: Command, execTick: number): void {
    const stored: Command = {
      kind: 'command',
      seq: cmd.seq,
      source: cmd.source,
      tick: cmd.tick,
      tickExecuted: execTick,
      type: cmd.type,
      payload: cloneJson(cmd.payload),
    };
    const bucket = this.queued.get(execTick);
    if (bucket === undefined) this.queued.set(execTick, [stored]);
    else bucket.push(stored);
  }

  /**
   * Execute all commands queued for `tick`, sorted by (source, seq), via their handlers in
   * registration order. Called by the world at the start of the commands phase.
   */
  execute(world: W, tick: number, ctx: TickContext): void {
    const bucket = this.queued.get(tick);
    if (bucket === undefined) return;
    this.queued.delete(tick);
    bucket.sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : a.seq - b.seq));
    for (const cmd of bucket) {
      const def = this.defs.get(cmd.type);
      if (def === undefined) continue;
      // Snapshot: a handler may add/remove handlers for this type mid-execution.
      for (const handler of [...def.handlers]) handler(world, cmd, ctx);
    }
  }

  /** Detached checkpoint state; handlers and payload validators remain host-owned. */
  save(): CommandQueueState {
    return {
      pending: [...this.queued.entries()]
        .sort(([a], [b]) => a - b)
        .flatMap(([, commands]) =>
          [...commands]
            .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : a.seq - b.seq))
            .map((command) => ({ ...command, payload: cloneJson(command.payload) })),
        ),
      highestSeq: Object.fromEntries(this.highestSeq),
      latePolicy: this.latePolicy,
    };
  }

  restore(state: CommandQueueState | undefined): void {
    this.clear();
    if (state === undefined) return;
    this.latePolicy = state.latePolicy;
    for (const command of state.pending)
      this.enqueue(command, command.tickExecuted ?? command.tick);
    for (const [source, seq] of Object.entries(state.highestSeq)) this.highestSeq.set(source, seq);
  }

  /** Drop all queued commands (used on keyframe load). */
  clear(): void {
    this.queued.clear();
    this.highestSeq.clear();
  }
}
