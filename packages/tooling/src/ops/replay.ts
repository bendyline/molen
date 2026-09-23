import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  applyKeyframeTo,
  keyframeStateFormat,
  STATE_FORMAT,
  type World,
  worldFromKeyframe,
} from '@bendyline/molen-kernel';
import {
  type ComponentDiff,
  diffKeyframes,
  firstDivergentTick,
  perTickHashes,
  runHeadless,
  type WorldSetup,
} from '@bendyline/molen-kernel/testing';
import type { Keyframe, ReplayFixture } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { loadSceneDocument, loadSetupLike, resolveSetupModule } from '../project';
import {
  parseJson,
  prepareSceneBuilder,
  type SceneBuildOptions,
  sceneBuildOptionsFor,
} from './build';

export interface RunReplayInput {
  /** Path to a *.replay.json fixture. */
  path: string;
  /** Module providing systems + command handlers (default/named `setup`). */
  setupModule?: string;
  /** Explicit project.json for the fixture's scene (default: discovered from the scene path). */
  projectPath?: string;
  /**
   * Regenerate `expected.stateHash` + `expected.tickHashes` from the current build and write
   * them back to the fixture (run after an intentional engine/content change).
   */
  record?: boolean;
}

export interface RunReplayOutput {
  ok: boolean;
  expectedHash?: string;
  actualHash?: string;
  expectedEventCount?: number;
  actualEventCount?: number;
  ticks?: number;
  /** True when the build reproduces itself run-to-run (only checked on a hash mismatch). */
  deterministic?: boolean;
  /** Classifies a mismatch so the fix is obvious. */
  divergence?: 'non-deterministic' | 'behavior-drift';
  /** First tick at which state diverged (from the self-determinism check or tickHashes). */
  firstDivergentTick?: number;
  /** Component-level diff at the divergent tick (available for non-deterministic builds). */
  diff?: ComponentDiff[];
  /** Agent-facing summary of what happened and what to do. */
  report?: string;
  /** Set when something failed before running (bad fixture/scene). */
  error?: string;
}

async function resolveFixture(
  path: string,
  setupModule?: string,
  projectPath?: string,
): Promise<
  | { error: string }
  | {
      fixture: ReplayFixture;
      build: () => World;
    }
> {
  let raw: unknown;
  try {
    raw = parseJson(await readFile(path, 'utf8'));
  } catch (e) {
    return { error: `${path}: not valid JSON — ${(e as Error).message}` };
  }
  const fixtureResult = validate('replay', raw);
  if (!fixtureResult.ok) return { error: fixtureResult.formatted };
  const fixture = fixtureResult.value;
  // `engine` is recorded metadata, not a compatibility gate: a fixture stays replayable across
  // releases that did not change simulation semantics. What must match is the state format.
  if (fixture.initialKeyframe !== undefined) {
    const recorded = keyframeStateFormat(fixture.initialKeyframe);
    if (recorded !== STATE_FORMAT) {
      return {
        error:
          `replay was recorded with state format ${recorded}; this build reads ${STATE_FORMAT}. ` +
          `Re-record it with: molen replay ${path} --record`,
      };
    }
  }
  if (
    fixture.initialKeyframe !== undefined &&
    fixture.seed !== undefined &&
    fixture.seed !== fixture.initialKeyframe.seed
  ) {
    return { error: 'replay seed conflicts with initialKeyframe.seed' };
  }

  if (fixture.scene === undefined) {
    if (fixture.initialKeyframe === undefined) {
      return { error: 'replay fixture must provide scene or initialKeyframe' };
    }
    if (setupModule !== undefined) {
      return { error: 'setupModule requires a replay scene so it can receive a manifest' };
    }
    const initial = fixture.initialKeyframe;
    return { fixture, build: () => worldFromKeyframe(initial) };
  }
  const scenePath = resolve(dirname(path), fixture.scene);
  let loaded: Awaited<ReturnType<typeof loadSceneDocument>>;
  try {
    loaded = await loadSceneDocument(
      scenePath,
      projectPath !== undefined ? { projectPath } : undefined,
    );
  } catch (e) {
    return { error: `${scenePath}: ${(e as Error).message}` };
  }

  let setup: WorldSetup | undefined;
  setupModule = resolveSetupModule(setupModule, loaded.project);
  if (setupModule !== undefined) {
    try {
      setup = await loadSetupLike(setupModule);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  const manifest =
    fixture.seed !== undefined ? { ...loaded.manifest, seed: fixture.seed } : loaded.manifest;
  const types = loaded.project?.resolvedTypes;
  const buildOpts: SceneBuildOptions = await sceneBuildOptionsFor(loaded);
  let baseBuild: () => World;
  try {
    baseBuild = await prepareSceneBuilder(manifest, setup, {
      ...buildOpts,
      ...(types !== undefined ? { types } : {}),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const initial = fixture.initialKeyframe;
  return {
    fixture,
    build:
      initial === undefined
        ? baseBuild
        : () => {
            const world = baseBuild();
            applyKeyframeTo(world, initial);
            return world;
          },
  };
}

/**
 * Replay a recorded fixture and compare the final state hash. On a mismatch, localize the
 * divergence instead of just reporting "hash differs":
 *   1. re-run the build against itself — if it diverges from itself, the build is
 *      NON-DETERMINISTIC; report the first divergent tick + a component-level diff.
 *   2. otherwise the build is deterministic but its result drifted from the recording (an
 *      intentional engine/content change, or a regression). If the fixture stored per-tick
 *      hashes, report the first tick that differs from the recording.
 */
export async function runReplayFile(input: RunReplayInput): Promise<RunReplayOutput> {
  const resolved = await resolveFixture(input.path, input.setupModule, input.projectPath);
  if ('error' in resolved) return { ok: false, error: resolved.error };
  const { fixture, build } = resolved;
  const commands = fixture.commands;
  const ticks = fixture.ticks;

  if (input.record === true) {
    const tickHashes = perTickHashes(build, commands, ticks);
    const stateHash = tickHashes[tickHashes.length - 1] ?? '';
    const eventCount = runHeadless(build, { commands, ticks }).events.length;
    const updated: ReplayFixture = {
      ...fixture,
      expected: { ...fixture.expected, stateHash, eventCount, tickHashes },
    };
    await writeFile(input.path, `${JSON.stringify(updated, null, 2)}\n`);
    return {
      ok: true,
      actualHash: stateHash,
      expectedHash: stateHash,
      actualEventCount: eventCount,
      expectedEventCount: eventCount,
      ticks,
      report: `recorded expected.stateHash + ${tickHashes.length} per-tick hashes to ${input.path}`,
    };
  }

  const expected = fixture.expected;
  const actual = runHeadless(build, { commands, ticks });
  if (expected === undefined) {
    return {
      ok: false,
      actualHash: actual.finalHash,
      actualEventCount: actual.events.length,
      ticks,
      error: 'replay has no expected result; run with --record before treating it as a test',
    };
  }
  const hashMatches = actual.finalHash === expected.stateHash;
  const eventCountMatches =
    expected.eventCount === undefined || actual.events.length === expected.eventCount;
  if (hashMatches && eventCountMatches) {
    return {
      ok: true,
      expectedHash: expected.stateHash,
      actualHash: actual.finalHash,
      expectedEventCount: expected.eventCount,
      actualEventCount: actual.events.length,
      ticks,
      report: `✓ replay matches (${ticks} ticks, hash ${actual.finalHash}, ${actual.events.length} events)`,
    };
  }

  // Mismatch (or no expected hash to compare): localize.
  const selfDiverge = firstDivergentTick(build, build, ticks, commands, commands);
  if (selfDiverge !== null) {
    return {
      ok: false,
      expectedHash: expected.stateHash,
      actualHash: actual.finalHash,
      expectedEventCount: expected.eventCount,
      actualEventCount: actual.events.length,
      ticks,
      deterministic: false,
      divergence: 'non-deterministic',
      firstDivergentTick: selfDiverge.tick,
      diff: selfDiverge.diff,
      report: formatDivergence('non-deterministic', selfDiverge.tick, selfDiverge.diff),
    };
  }

  // Deterministic build, but differs from the recording.
  let firstTick: number | undefined;
  const refHashes = fixture.expected?.tickHashes;
  if (refHashes !== undefined && refHashes.length > 0) {
    const actual = perTickHashes(build, commands, ticks);
    for (let i = 0; i < Math.min(actual.length, refHashes.length); i++) {
      if (actual[i] !== refHashes[i]) {
        firstTick = i;
        break;
      }
    }
  }
  return {
    ok: false,
    expectedHash: expected.stateHash,
    actualHash: actual.finalHash,
    expectedEventCount: expected.eventCount,
    actualEventCount: actual.events.length,
    ticks,
    deterministic: true,
    divergence: 'behavior-drift',
    firstDivergentTick: firstTick,
    report:
      !eventCountMatches && hashMatches
        ? `✖ replay event count differs: expected ${expected.eventCount}, actual ${actual.events.length}`
        : formatBehaviorDrift(expected.stateHash, actual.finalHash, firstTick),
  };
}

function formatDivergence(kind: string, tick: number, diff: ComponentDiff[]): string {
  const lines = [`✖ replay ${kind}: state first diverges at tick ${tick}`];
  for (const d of diff.slice(0, 10)) {
    lines.push(
      `  ${d.kind} ${d.entity}.${d.component}` +
        (d.kind === 'changed' ? `: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}` : ''),
    );
  }
  if (diff.length > 10) lines.push(`  …and ${diff.length - 10} more`);
  lines.push('  → the build is non-deterministic (likely Math.random, Date/perf, or set/map');
  lines.push(
    '    iteration order). Route randomness through molen.rng / world rng and math via dmath.',
  );
  return lines.join('\n');
}

function formatBehaviorDrift(
  expected: string | undefined,
  actual: string | undefined,
  firstTick: number | undefined,
): string {
  const lines = ['✖ replay diverged from the recording (the build is deterministic):'];
  lines.push(`  expected: ${expected}`);
  lines.push(`  actual:   ${actual}`);
  if (firstTick !== undefined) lines.push(`  first differs at tick ${firstTick}`);
  else lines.push('  (record per-tick hashes with --record to localize the first divergent tick)');
  lines.push('  → if the change was intentional, re-record with: molen replay <fixture> --record');
  return lines.join('\n');
}

export interface DiffSnapshotsInput {
  /** Two keyframe JSON file paths (before, after). */
  a: string;
  b: string;
}

export interface DiffSnapshotsOutput {
  ok: boolean;
  diffs?: ComponentDiff[];
  error?: string;
}

async function loadKeyframe(path: string): Promise<Keyframe | string> {
  const r = validate('keyframe', parseJson(await readFile(path, 'utf8')));
  return r.ok ? r.value : r.formatted;
}

/** Diff two keyframe snapshots at the component level. */
export async function diffSnapshots(input: DiffSnapshotsInput): Promise<DiffSnapshotsOutput> {
  const a = await loadKeyframe(input.a);
  if (typeof a === 'string') return { ok: false, error: `${input.a}: ${a}` };
  const b = await loadKeyframe(input.b);
  if (typeof b === 'string') return { ok: false, error: `${input.b}: ${b}` };
  return { ok: true, diffs: diffKeyframes(a, b) };
}
