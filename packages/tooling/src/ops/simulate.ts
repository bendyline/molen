import { readFile } from 'node:fs/promises';
import type { ResolvedTypes, WorldSetup } from '@bendyline/molen-kernel';
import {
  type AssertionResult,
  formatAssertionResults,
  type RecordedEvent,
  runAssertions,
  runHeadless,
} from '@bendyline/molen-kernel/testing';
import type {
  AssertionDoc,
  Command,
  SceneManifest,
  ValidationIssue,
} from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import {
  loadSceneDocument,
  loadSetupLike,
  type ProjectContext,
  resolveSetupModule,
} from '../project';
import {
  parseJson,
  prepareSceneBuilder,
  type SceneBuildOptions,
  sceneBuildOptionsFor,
} from './build';
import { guardOp } from './errors';

export interface SimulateInput {
  /** Scene file path, or a scene NAME from the surrounding project.json. */
  scenePath?: string;
  scene?: SceneManifest;
  ticks: number;
  commandsPath?: string;
  commands?: Command[];
  assertPath?: string;
  assertDoc?: AssertionDoc;
  /** Explicit project.json (default: discovered by walking up from the scene). */
  projectPath?: string;
  /** Path to a module exporting setup(world, manifest) or a defineExperience(...) result. */
  setupModule?: string;
  /** Programmatic setup (systems + command handlers); takes precedence over setupModule. */
  setup?: WorldSetup;
}

export interface SimulateOutput {
  ok: boolean;
  tick: number;
  stateHash: string;
  eventCount: number;
  events: RecordedEvent[];
  assertionResults: AssertionResult[];
  assertionsFormatted?: string;
  /** The scene's physics engine, when declared (kinematics = cross-platform deterministic). */
  physics?: NonNullable<SceneManifest['physics']>['engine'];
  /** Non-fatal advisories (e.g. deprecated scene format). */
  notices?: ValidationIssue[];
  /** Set when something failed before running (bad scene, etc.). */
  error?: string;
}

async function loadJson<T>(path: string): Promise<T> {
  return parseJson(await readFile(path, 'utf8')) as T;
}

/** Run a scene headlessly for N ticks, applying commands and evaluating assertions. */
export function runSimulation(input: SimulateInput): Promise<SimulateOutput> {
  return guardOp(fail, () => runSimulationImpl(input));
}

async function runSimulationImpl(input: SimulateInput): Promise<SimulateOutput> {
  // Resolve + validate the scene (always validated so defaults apply and errors are caught,
  // whether the manifest came from a file, a project scene name, or inline).
  let manifest: SceneManifest;
  let types: ResolvedTypes | undefined;
  let notices: ValidationIssue[] = [];
  let project: ProjectContext | undefined;
  let buildOpts: SceneBuildOptions = {};
  if (input.scene !== undefined) {
    const sceneResult = validate('scene', input.scene);
    if (!sceneResult.ok) return fail(sceneResult.formatted);
    manifest = sceneResult.value;
    notices = sceneResult.notices ?? [];
  } else {
    if (input.scenePath === undefined) {
      return fail('runSimulation: provide scenePath or scene');
    }
    try {
      const loaded = await loadSceneDocument(input.scenePath, {
        ...(input.projectPath !== undefined ? { projectPath: input.projectPath } : {}),
      });
      manifest = loaded.manifest;
      types = loaded.project?.resolvedTypes;
      project = loaded.project;
      notices = loaded.notices;
      buildOpts = await sceneBuildOptionsFor(loaded);
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  // Optional command stream.
  let commands = input.commands ?? [];
  if (input.commandsPath !== undefined) {
    const raw = await loadJson<unknown>(input.commandsPath);
    const list = Array.isArray(raw) ? raw : (raw as { commands?: unknown }).commands;
    if (!Array.isArray(list)) return fail(`${input.commandsPath}: expected an array of commands`);
    const validated: Command[] = [];
    for (const [i, c] of list.entries()) {
      const v = validate('command', c);
      if (!v.ok) return fail(`command[${i}] invalid:\n${v.formatted}`);
      validated.push(v.value);
    }
    commands = validated;
  }

  // Optional assertion doc.
  let assertDoc = input.assertDoc;
  if (input.assertPath !== undefined) {
    const raw = await loadJson<unknown>(input.assertPath);
    const v = validate('assert', raw);
    if (!v.ok) return fail(v.formatted);
    assertDoc = v.value;
  }

  // Optional code setup (systems + command handlers). Programmatic setup wins over a module.
  let setup: WorldSetup | undefined = input.setup;
  const setupModule = resolveSetupModule(input.setupModule, project);
  if (setup === undefined && setupModule !== undefined) {
    try {
      setup = await loadSetupLike(setupModule);
    } catch (e) {
      return fail((e as Error).message);
    }
  }

  let build: Awaited<ReturnType<typeof prepareSceneBuilder>>;
  try {
    build = await prepareSceneBuilder(manifest, setup, {
      ...buildOpts,
      ...(types !== undefined ? { types } : {}),
    });
  } catch (e) {
    return fail((e as Error).message);
  }
  const headless = runHeadless(build, { commands, ticks: input.ticks });

  const assertionResults = assertDoc
    ? runAssertions(headless.world, assertDoc, { events: headless.events })
    : [];
  const allPass = assertionResults.every((r) => r.pass);

  return {
    ok: allPass,
    tick: headless.world.tick,
    stateHash: headless.finalHash,
    eventCount: headless.events.length,
    events: headless.events,
    assertionResults,
    assertionsFormatted:
      assertionResults.length > 0 ? formatAssertionResults(assertionResults) : undefined,
    ...(manifest.physics !== undefined ? { physics: manifest.physics.engine } : {}),
    ...(notices.length > 0 ? { notices } : {}),
  };
}

function fail(error: string): SimulateOutput {
  return {
    ok: false,
    tick: 0,
    stateHash: '',
    eventCount: 0,
    events: [],
    assertionResults: [],
    error,
  };
}
