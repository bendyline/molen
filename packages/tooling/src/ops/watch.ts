import { type FSWatcher, watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { findProjectFile } from '../project';
import { parseJson } from './parse';
import { runSimulation, type SimulateInput, type SimulateOutput } from './simulate';

// `molen sim watch`: rerun the simulation + assertions whenever any transitive file input
// changes, and report what MOVED instead of a wall of output. Parent-directory watches survive
// atomic editor renames and also observe files that do not exist yet.

export interface SimWatchInput extends SimulateInput {
  /** Extra files/directories to watch (transitive project/scene inputs are automatic). */
  watchPaths?: string[];
  /** Called after every completed run with the result + a diff line against the previous run. */
  onRun(result: SimulateOutput, diff: string): void;
}

export interface SimWatchHandle {
  close(): void;
}

function diffLine(prev: SimulateOutput | undefined, next: SimulateOutput): string {
  if (prev === undefined) return 'first run';
  const parts: string[] = [];
  parts.push(prev.stateHash === next.stateHash ? 'hash: unchanged' : 'hash: CHANGED');
  if (prev.eventCount !== next.eventCount) {
    parts.push(`events: ${prev.eventCount} -> ${next.eventCount}`);
  }
  const prevPass = new Map(prev.assertionResults.map((r, i) => [i, r.pass]));
  next.assertionResults.forEach((r, i) => {
    const before = prevPass.get(i);
    if (before !== undefined && before !== r.pass) {
      parts.push(`assertion ${i + 1}: ${before ? 'pass -> FAIL' : 'FAIL -> pass'}`);
    }
  });
  return parts.join('  ·  ');
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  try {
    return record(parseJson(await readFile(path, 'utf8')));
  } catch {
    return {};
  }
}

/** Resolve every currently discoverable simulation dependency, including missing target paths. */
export async function discoverSimulationWatchPaths(
  input: SimulateInput & { watchPaths?: string[] },
): Promise<Set<string>> {
  const cwd = process.cwd();
  const paths = new Set<string>();
  const add = (path: string | undefined, base = cwd): void => {
    if (path !== undefined) paths.add(isAbsolute(path) ? path : resolve(base, path));
  };
  add(input.commandsPath);
  add(input.assertPath);
  add(input.setupModule);
  for (const path of input.watchPaths ?? []) add(path);

  let projectPath = input.projectPath !== undefined ? resolve(input.projectPath) : undefined;
  if (projectPath === undefined && input.scenePath !== undefined) {
    const sceneCandidate = resolve(cwd, input.scenePath);
    projectPath = await findProjectFile(
      input.scenePath.endsWith('.json') ? dirname(sceneCandidate) : cwd,
    );
  }

  let project: Record<string, unknown> = {};
  let projectDir = cwd;
  if (projectPath !== undefined) {
    add(projectPath);
    projectDir = dirname(projectPath);
    project = await readJson(projectPath);
    for (const path of strings(project.types)) add(path, projectDir);
    for (const sidecarRel of Object.values(record(project.assets))) {
      if (typeof sidecarRel !== 'string') continue;
      const sidecarPath = resolve(projectDir, sidecarRel);
      add(sidecarPath);
      const sidecar = await readJson(sidecarPath);
      const files = record(sidecar.files);
      const sidecarDir = dirname(sidecarPath);
      if (typeof files.main === 'string') add(files.main, sidecarDir);
      if (typeof files.collision === 'string') add(files.collision, sidecarDir);
      for (const variant of Object.values(record(files.variants))) {
        if (typeof variant === 'string') add(variant, sidecarDir);
      }
      const trimesh = record(record(sidecar.collision).trimesh);
      if (typeof trimesh.bin === 'string') add(trimesh.bin, sidecarDir);
    }
  }

  if (input.scenePath !== undefined) {
    const mapped = record(project.scenes)[input.scenePath];
    const scenePath =
      typeof mapped === 'string'
        ? resolve(projectDir, mapped)
        : isAbsolute(input.scenePath)
          ? input.scenePath
          : resolve(cwd, input.scenePath);
    add(scenePath);
    const scene = await readJson(scenePath);
    const sceneDir = dirname(scenePath);
    if (Array.isArray(scene.scripts)) {
      for (const rawScript of scene.scripts) {
        const script = record(rawScript);
        if (typeof script.path === 'string') add(script.path, sceneDir);
      }
    }
    const terrain = record(scene.terrain);
    if (typeof terrain.descriptor === 'string') add(terrain.descriptor, sceneDir);
    if (typeof terrain.heightmap === 'string') add(terrain.heightmap, sceneDir);
  }
  return paths;
}

interface WatchSpec {
  dir: string;
  /** Missing means every entry in the directory is relevant. */
  name?: string;
}

async function watchSpec(target: string): Promise<WatchSpec> {
  try {
    const info = await stat(target);
    if (info.isDirectory()) return { dir: target };
    return { dir: dirname(target), name: basename(target) };
  } catch {
    // Watch the closest existing ancestor. If intermediate directories are missing, the first
    // new path segment is what that ancestor's fs.watch callback will report.
    let candidate = dirname(target);
    for (;;) {
      try {
        if ((await stat(candidate)).isDirectory()) {
          const firstSegment = relative(candidate, target).split(sep)[0] as string;
          return { dir: candidate, name: firstSegment };
        }
      } catch {
        // Keep walking toward the filesystem root.
      }
      const parent = dirname(candidate);
      if (parent === candidate) return { dir: candidate };
      candidate = parent;
    }
  }
}

/** Run once, then rerun (debounced) on every change to any transitive input. */
export async function simWatch(input: SimWatchInput): Promise<SimWatchHandle> {
  const watchers = new Map<string, { signature: string; watcher: FSWatcher }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let prev: SimulateOutput | undefined;
  let running = false;
  let queued = false;
  let closed = false;

  const closeWatchers = (): void => {
    for (const entry of watchers.values()) entry.watcher.close();
    watchers.clear();
  };

  const schedule = (): void => {
    if (closed) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void run();
    }, 100);
  };

  const refreshWatchers = async (): Promise<void> => {
    if (closed) return;
    const paths = await discoverSimulationWatchPaths(input);
    const groups = new Map<string, Set<string> | undefined>();
    for (const path of paths) {
      const spec = await watchSpec(path);
      const existing = groups.get(spec.dir);
      if (spec.name === undefined || (existing === undefined && groups.has(spec.dir))) {
        groups.set(spec.dir, undefined);
      } else if (existing !== undefined) {
        existing.add(spec.name);
      } else {
        groups.set(spec.dir, new Set([spec.name]));
      }
    }

    for (const [dir, entry] of watchers) {
      if (!groups.has(dir)) {
        entry.watcher.close();
        watchers.delete(dir);
      }
    }
    for (const [dir, names] of groups) {
      const signature = names === undefined ? '*' : [...names].sort().join('\u0000');
      if (watchers.get(dir)?.signature === signature) continue;
      watchers.get(dir)?.watcher.close();
      try {
        const watcher = watch(dir, (_event, filename) => {
          const changed = filename === null ? undefined : String(filename);
          if (names === undefined || changed === undefined || names.has(changed)) schedule();
        });
        watcher.on('error', schedule);
        watchers.set(dir, { signature, watcher });
      } catch {
        // A directory can disappear between stat and watch. Its ancestor will trigger another
        // discovery pass when recreated; the next simulation run also refreshes all watchers.
      }
    }
  };

  const run = async (): Promise<void> => {
    if (closed) return;
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      const result = await runSimulation(input);
      if (!closed) {
        input.onRun(result, diffLine(prev, result));
        prev = result;
      }
    } finally {
      running = false;
      if (!closed) await refreshWatchers();
      if (!closed && queued) {
        queued = false;
        void run();
      }
    }
  };

  try {
    await refreshWatchers();
    await run();
  } catch (error) {
    closed = true;
    if (timer !== undefined) clearTimeout(timer);
    closeWatchers();
    throw error;
  }

  return {
    close: () => {
      if (closed) return;
      closed = true;
      queued = false;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      closeWatchers();
    },
  };
}
