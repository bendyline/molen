import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripScriptTypes } from '@bendyline/molen-client/vite';
import { isExperience, type ResolvedTypes, type WorldSetup } from '@bendyline/molen-kernel';
import type { PackSet } from '@bendyline/molen-pack';
import type {
  ComponentRegistry,
  ContentIdentity,
  JsonObject,
  ProjectManifest,
  SceneManifest,
  TypesDoc,
  ValidationIssue,
} from '@bendyline/molen-schema';
import {
  buildTypeIndex,
  checkTypes,
  createComponentRegistry,
  formatIssues,
  resolveAllTypes,
  sceneTypeRefIssues,
  validate,
} from '@bendyline/molen-schema';
import { openProjectPacks, packTypeDocuments } from './content';
import { parseJson } from './ops/parse';

export const PROJECT_FILENAME = 'project.json';

/** Walk from startDir up to the fs root looking for a project.json with the right envelope. */
export async function findProjectFile(startDir: string): Promise<string | undefined> {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, PROJECT_FILENAME);
    try {
      const raw = parseJson(await readFile(candidate, 'utf8'));
      if (
        raw !== null &&
        typeof raw === 'object' &&
        (raw as Record<string, unknown>).format === 'molen/project@1'
      ) {
        return candidate;
      }
    } catch {
      // missing or unreadable — keep walking
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export interface ProjectContext {
  path: string;
  dir: string;
  manifest: ProjectManifest;
  typesDocs: { doc: TypesDoc; source: string }[];
  /** File-backed scripts declared by registry types, before their paths are inlined. */
  typeScriptFiles: {
    typeId: string;
    scriptId: string;
    file: string;
    declaration: string;
    config: JsonObject;
  }[];
  /** Project-level cross-check issues (duplicates, ownership, dangling refs). */
  typeIssues: ValidationIssue[];
  /** Flattened type id -> final component map (what the kernel consumes). */
  resolvedTypes: ResolvedTypes;
  /** Content packs the project uses (project.json `packs`, then MOLEN_PACKS). */
  packs: PackSet;
  /** Which pack content the project's worlds are built from; empty without packs. */
  content: ContentIdentity;
  componentRegistry: ComponentRegistry;
  /** Resolve a scene name (from manifest.scenes) or a path into an absolute scene path. */
  resolveScenePath(nameOrPath: string): string;
}

/** Load + validate a project manifest and every types document it references. Throws on invalid. */
export async function loadProject(path: string): Promise<ProjectContext> {
  const projectPath = resolve(path);
  const raw = parseJson(await readFile(projectPath, 'utf8'));
  const parsed = validate('project', raw);
  if (!parsed.ok) throw new Error(parsed.formatted);
  const manifest = parsed.value;
  const componentRegistry = createComponentRegistry(manifest.components, {
    owner: 'project',
  }).registry;
  const dir = dirname(projectPath);

  const typesDocs: { doc: TypesDoc; source: string }[] = [];
  const typeScriptFiles: ProjectContext['typeScriptFiles'] = [];
  for (const rel of manifest.types) {
    const typesPath = join(dir, rel);
    const typesRaw = parseJson(await readFile(typesPath, 'utf8'));
    const typesParsed = validate('types', typesRaw, { registry: componentRegistry });
    if (!typesParsed.ok) throw new Error(typesParsed.formatted);
    const doc = typesParsed.value;
    for (const [typeId, def] of Object.entries(doc.types)) {
      for (const script of def.scripts) {
        if (script.path === undefined) continue;
        const file = join(dirname(typesPath), script.path);
        typeScriptFiles.push({
          typeId,
          scriptId: script.id,
          file,
          declaration: rel,
          config: script.config,
        });
        try {
          const source = await readFile(file, 'utf8');
          script.code = script.path.endsWith('.ts') ? stripScriptTypes(source, file) : source;
          delete script.path;
        } catch (error) {
          throw new Error(
            `type "${typeId}" script "${script.id}" cannot read "${script.path}": ${(error as Error).message}`,
          );
        }
      }
    }
    typesDocs.push({ doc, source: rel });
  }

  // Ownership and asset checks cover the project's own documents; pack types belong to their
  // pack. A project type with the same id as a pack type wins (it is indexed first).
  const typeIssues = checkTypes(manifest, typesDocs);
  const packs = await openProjectPacks({ dir, packs: manifest.packs });
  const fromPacks = await packTypeDocuments(
    packs,
    (raw, source) => {
      const result = validate('types', raw, { registry: componentRegistry });
      if (!result.ok) throw new Error(`${source}\n${result.formatted}`);
      return result.value;
    },
    stripScriptTypes,
  );
  const { index } = buildTypeIndex([...typesDocs, ...fromPacks.docs]);
  const resolvedTypes = resolveAllTypes(index);

  return {
    path: projectPath,
    dir,
    manifest,
    typesDocs,
    typeScriptFiles,
    typeIssues,
    resolvedTypes,
    packs,
    content: fromPacks.identity ?? {},
    componentRegistry,
    resolveScenePath: (nameOrPath: string): string => {
      const fromName = manifest.scenes[nameOrPath];
      if (fromName !== undefined) return join(dir, fromName);
      return isAbsolute(nameOrPath) ? nameOrPath : resolve(nameOrPath);
    },
  };
}

/**
 * The single write path for project.json: lockfile (O_EXCL, stale after 30s, bounded retry),
 * re-read, mutate, validate, write temp + atomic rename. Concurrent agents (asset import,
 * types reserve) serialize here instead of clobbering each other.
 */
export function updateProjectFile(
  path: string,
  mutate: (manifest: ProjectManifest) => void,
): Promise<ProjectManifest>;
export function updateProjectFile(
  path: string,
  mutate: (manifest: ProjectManifest) => ProjectManifest,
): Promise<ProjectManifest>;
export async function updateProjectFile(
  path: string,
  mutate: (manifest: ProjectManifest) => unknown,
): Promise<ProjectManifest> {
  const projectPath = resolve(path);
  const lockPath = `${projectPath}.lock`;
  const start = Date.now();
  const staleAfterMs = 30_000;
  const waitLimitMs = 5_000;
  for (;;) {
    try {
      const handle = await open(lockPath, 'wx');
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: Date.now() })}\n`);
      await handle.close();
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > staleAfterMs) {
          await rm(lockPath, { force: true });
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw statError;
      }
      if (Date.now() - start > waitLimitMs) {
        throw new Error(`project manifest is locked by another writer: ${lockPath}`);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  const tmpPath = `${projectPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const raw = parseJson(await readFile(projectPath, 'utf8'));
    const parsed = validate('project', raw);
    if (!parsed.ok) throw new Error(parsed.formatted);
    const manifest = parsed.value;
    const mutated = mutate(manifest);
    const next = (mutated ?? manifest) as ProjectManifest;
    const reparsed = validate('project', JSON.parse(JSON.stringify(next)));
    if (!reparsed.ok) {
      throw new Error(`project.json update produced an invalid manifest:\n${reparsed.formatted}`);
    }
    await mkdir(dirname(projectPath), { recursive: true });
    await writeFile(tmpPath, `${JSON.stringify(reparsed.value, null, 2)}\n`);
    await rename(tmpPath, projectPath);
    return reparsed.value;
  } finally {
    await rm(tmpPath, { force: true });
    await rm(lockPath, { force: true });
  }
}

export interface LoadSceneOptions {
  /** Explicit project.json path; otherwise discovered by walking up from the scene/cwd. */
  projectPath?: string;
  cwd?: string;
}

export interface LoadedScene {
  manifest: SceneManifest;
  scenePath: string;
  /** Non-fatal advisories from validation (e.g. deprecated_format after a v1 auto-upgrade). */
  notices: ValidationIssue[];
  project?: ProjectContext;
}

/**
 * Load a scene by path or by project scene name: validate (legacy versions auto-upgrade),
 * resolve `scripts[].path` file refs into inline `code` (scene-file-relative), and thread the
 * surrounding project (for registry types). Throws with a formatted message on invalid input.
 */
export async function loadSceneDocument(
  ref: string,
  opts?: LoadSceneOptions,
): Promise<LoadedScene> {
  const cwd = opts?.cwd ?? process.cwd();
  let project: ProjectContext | undefined;
  if (opts?.projectPath !== undefined) {
    project = await loadProject(opts.projectPath);
  } else {
    const found = await findProjectFile(ref.endsWith('.json') ? dirname(resolve(cwd, ref)) : cwd);
    if (found !== undefined) project = await loadProject(found);
  }

  const scenePath = project !== undefined ? project.resolveScenePath(ref) : resolve(cwd, ref);
  const raw = parseJson(await readFile(scenePath, 'utf8'));
  const parsed = validate('scene', raw, {
    registry: project?.componentRegistry,
    types: project?.resolvedTypes,
  });
  if (!parsed.ok) throw new Error(parsed.formatted);
  const manifest = parsed.value;
  const notices = [...(parsed.notices ?? [])];
  if (project !== undefined) {
    const typeIssues = sceneTypeRefIssues(manifest, project.resolvedTypes.keys());
    if (typeIssues.length > 0) {
      throw new Error(formatIssues(`scene "${manifest.name}"`, typeIssues));
    }
  }

  // Inline script file refs so the (fs-free) kernel only ever sees `code`. A .ts ref has its
  // types erased here (whitespace-preserving, so line numbers in script errors still match the
  // file); .js is inlined verbatim, and so is an inline `code` block.
  const sceneDir = dirname(scenePath);
  for (const script of manifest.scripts) {
    if (script.path === undefined) continue;
    try {
      const file = join(sceneDir, script.path);
      const source = await readFile(file, 'utf8');
      script.code = script.path.endsWith('.ts') ? stripScriptTypes(source, file) : source;
      delete script.path;
    } catch (e) {
      const issue: ValidationIssue = {
        path: `/scripts/${script.id}`,
        code: 'script_file_unreadable',
        message: `cannot read script file "${script.path}": ${(e as Error).message}`,
        docsRef: 'schemas/scene.md',
      };
      throw new Error(formatIssues(`scene "${manifest.name}"`, [issue]));
    }
  }

  return { manifest, scenePath, notices, ...(project !== undefined ? { project } : {}) };
}

/**
 * The setup module an op should load: an explicit path wins; otherwise the surrounding
 * project's `setup` (project-relative); otherwise none.
 */
export function resolveSetupModule(
  explicit: string | undefined,
  project: ProjectContext | undefined,
): string | undefined {
  if (explicit !== undefined) return explicit;
  if (project?.manifest.setup !== undefined) return join(project.dir, project.manifest.setup);
  return undefined;
}

/** Load a setup module: accepts `export default setup`, `export setup`, or a defineExperience result. */
export async function loadSetupLike(modulePath: string): Promise<WorldSetup> {
  const mod = (await import(pathToFileURL(resolve(modulePath)).href)) as {
    default?: unknown;
    setup?: unknown;
    experience?: unknown;
  };
  for (const candidate of [mod.experience, mod.setup, mod.default]) {
    if (isExperience(candidate)) return candidate.setup;
    if (typeof candidate === 'function') return candidate as WorldSetup;
  }
  throw new Error(
    `setup module "${modulePath}" must export a setup(world, manifest) function or a defineExperience(...) result`,
  );
}
