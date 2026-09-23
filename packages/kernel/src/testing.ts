import type {
  Command,
  ComponentMap,
  EngineEvent,
  EntityId,
  JsonObject,
  Keyframe,
} from '@bendyline/molen-schema';
import { hashJson } from './hash';
import { applyKeyframeTo, stateHash, takeKeyframe } from './snapshot';
import type { World } from './world';

export type { AssertContext, AssertionResult } from './assert';
export { formatAssertionResults, runAssertions } from './assert';
export type { WorldSetup } from './scene';
export { buildWorld, createWorldFromScene, resolveEntityComponents, resolvePrefab } from './scene';
export type { ParsedSelector, SelectMatch } from './select';
export { parseSelector, select } from './select';
export { stateHash } from './snapshot';
export { World } from './world';

export interface RecordedEvent {
  tick: number;
  event: EngineEvent;
}

export interface HeadlessResult {
  world: World;
  events: RecordedEvent[];
  finalHash: string;
  ticks: number;
}

/**
 * Run a built world for `ticks`, submitting recorded commands and capturing every emitted
 * event with the tick it occurred on. The backbone of `molen sim run` and the MCP
 * run_simulation tool.
 */
export function runHeadless(
  build: WorldBuilder,
  opts: { commands?: Command[]; ticks: number },
): HeadlessResult {
  const world = build();
  const events: RecordedEvent[] = [];
  world.on('*', (event) => events.push({ tick: world.tick, event }));
  submitRecorded(world, opts.commands ?? []);
  world.stepN(opts.ticks);
  return { world, events, finalHash: stateHash(world), ticks: opts.ticks };
}

/** A factory that returns a fully-configured world (entities + systems + command handlers). */
export type WorldBuilder = () => World;

export interface ReplayResult {
  ok: boolean;
  expectedHash?: string;
  actualHash: string;
  ticks: number;
  /** Set when the result is being compared against a reference run that diverged. */
  firstDivergentTick?: number;
}

/**
 * Submit a recorded command stream and run `ticks`. Commands are queued at their recorded
 * tickExecuted, so replay is faithful regardless of original late-command rewriting.
 */
export function runReplay(
  build: WorldBuilder,
  commands: Command[],
  ticks: number,
  expectedHash?: string,
): ReplayResult {
  const world = build();
  submitRecorded(world, commands);
  world.stepN(ticks);
  const actualHash = stateHash(world);
  return {
    ok: expectedHash !== undefined && actualHash === expectedHash,
    expectedHash,
    actualHash,
    ticks,
  };
}

function submitRecorded(world: World, commands: Command[]): void {
  const seen = new Set<string>();
  const ordered = [...commands].sort((a, b) =>
    a.source === b.source ? a.seq - b.seq : a.source < b.source ? -1 : 1,
  );
  for (const command of ordered) {
    const key = `${command.source}\u0000${command.seq}`;
    if (seen.has(key))
      throw new Error(`duplicate recorded command sequence ${command.source}:${command.seq}`);
    seen.add(key);
    const result = world._internal().submitRecordedCommand(command);
    if (!result.accepted) throw new Error(result.reason ?? 'recorded command rejected');
  }
}

/** Per-tick state hashes for `ticks` steps (index i = hash after tick i). */
export function perTickHashes(build: WorldBuilder, commands: Command[], ticks: number): string[] {
  const world = build();
  submitRecorded(world, commands);
  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    world.step();
    out.push(stateHash(world));
  }
  return out;
}

export interface DivergenceReport {
  tick: number;
  diff: ComponentDiff[];
}

export interface ComponentDiff {
  entity: EntityId;
  component: string;
  kind: 'added' | 'removed' | 'changed';
  before?: ComponentMap[string];
  after?: ComponentMap[string];
}

/**
 * Step two worlds in lockstep and report the first tick at which their state hashes diverge,
 * with a component-level diff at that tick. Returns null if they agree for all `ticks`.
 * Used both for determinism tests (same builder twice) and to localize replay divergence.
 */
export function firstDivergentTick(
  buildA: WorldBuilder,
  buildB: WorldBuilder,
  ticks: number,
  commandsA: Command[] = [],
  commandsB: Command[] = [],
): DivergenceReport | null {
  const a = buildA();
  const b = buildB();
  submitRecorded(a, commandsA);
  submitRecorded(b, commandsB);
  for (let t = 0; t < ticks; t++) {
    a.step();
    b.step();
    if (stateHash(a) !== stateHash(b)) {
      return { tick: t, diff: diffKeyframes(takeKeyframe(a), takeKeyframe(b)) };
    }
  }
  return null;
}

/**
 * Scrubs a deterministic replay: seek to any tick by restoring the nearest cached keyframe and
 * re-stepping forward. Keyframes are cached at `keyframeInterval` so checkpoint-safe seeking is
 * O(interval). Scripts with untracked closures seek from the beginning — see
 * docs-src/guide/scripting.md ("State that survives save/load and replay"). Used for replay
 * scrubbing and machinima.
 */
export class ReplayPlayer {
  private readonly keyframes: Keyframe[] = [];
  readonly length: number;

  constructor(
    private readonly build: WorldBuilder,
    commands: Command[],
    opts: { totalTicks: number; keyframeInterval?: number },
  ) {
    const interval = opts.keyframeInterval ?? 60;
    if (!Number.isSafeInteger(interval) || interval < 1)
      throw new RangeError('keyframeInterval must be positive');
    if (!Number.isSafeInteger(opts.totalTicks) || opts.totalTicks < 0)
      throw new RangeError('totalTicks must be nonnegative');
    this.length = opts.totalTicks;
    // Record keyframes by running once through the timeline.
    const w = build();
    submitRecorded(w, commands);
    this.keyframes.push(takeKeyframe(w));
    while (w.tick < opts.totalTicks) {
      const next = Math.min(interval, opts.totalTicks - w.tick);
      w.stepN(next);
      this.keyframes.push(takeKeyframe(w));
    }
  }

  /** Return a world at the given tick (clamped to [0, length]). */
  seek(tick: number): World {
    if (!Number.isFinite(tick)) throw new RangeError('seek tick must be finite');
    const target = Math.floor(Math.max(0, Math.min(tick, this.length)));
    let kf = this.keyframes[0] as Keyframe;
    const scripts = kf.plugins.$scripts as JsonObject | undefined;
    for (const cand of scripts?.requiresReplay === true ? [] : this.keyframes) {
      if (cand.tick <= target && cand.tick >= kf.tick) kf = cand;
    }
    // Fresh world (with systems from setup), then overwrite state to the keyframe and re-step.
    const world = this.build();
    applyKeyframeTo(world, kf);
    world.stepN(target - kf.tick);
    return world;
  }
}

/** Component-level diff between two keyframes (a = before, b = after). */
export function diffKeyframes(a: Keyframe, b: Keyframe): ComponentDiff[] {
  const diffs: ComponentDiff[] = [];
  // Reserved pseudo-entity for continuation metadata that has no ECS component owner.
  for (const key of [
    'engine',
    'tick',
    'tickRate',
    'rng',
    'nextEntitySeq',
    'entityOrder',
    'commands',
    'plugins',
  ] as const) {
    const before = { value: a[key] ?? null } as unknown as JsonObject;
    const after = { value: b[key] ?? null } as unknown as JsonObject;
    if (hashJson(before) !== hashJson(after))
      diffs.push({ entity: '$world', component: key, kind: 'changed', before, after });
  }

  const ids = new Set<EntityId>([...Object.keys(a.entities), ...Object.keys(b.entities)]);
  for (const id of [...ids].sort()) {
    const ca = a.entities[id] ?? {};
    const cb = b.entities[id] ?? {};
    const comps = new Set<string>([...Object.keys(ca), ...Object.keys(cb)]);
    for (const comp of [...comps].sort()) {
      const va = ca[comp];
      const vb = cb[comp];
      if (va === undefined && vb !== undefined) {
        diffs.push({ entity: id, component: comp, kind: 'added', after: vb });
      } else if (va !== undefined && vb === undefined) {
        diffs.push({ entity: id, component: comp, kind: 'removed', before: va });
      } else if (JSON.stringify(va) !== JSON.stringify(vb)) {
        diffs.push({ entity: id, component: comp, kind: 'changed', before: va, after: vb });
      }
    }
  }
  return diffs;
}
