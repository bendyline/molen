import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The samples that `molen new <name> --template <id>` copies. scripts/build-templates.mjs turns
// the repository's small examples into standalone npm projects under dist/templates/ and writes
// dist/templates/index.json; this module finds that bundle next to the running code, the way
// ops/docs.ts finds dist/docs-src.

export interface TemplateEntry {
  /** Template id: the sample's directory name in the engine repository (e.g. `cubes`). */
  id: string;
  /** One line on what the sample shows. */
  description: string;
}

export interface ListTemplatesOutput {
  ok: boolean;
  templates: TemplateEntry[];
  error?: string;
}

/** One template as dist/templates/index.json describes it. */
export interface TemplateManifest extends TemplateEntry {
  /** Files under the template directory, `/`-separated (includes package.json). */
  files: string[];
  /** The sample binds a project.json, so its generated types are refreshed on scaffold. */
  project: boolean;
  /** Top-level documents worth a `molen validate`. */
  validate: string[];
  /** The sample's `molen sim run …` arguments, or null when it has no CLI run. */
  sim: string | null;
  /** Top-level `*.replay.json` fixtures. */
  replays: string[];
  /** Headless tests ship (`npm test`). */
  tests: boolean;
}

export interface TemplateBundle {
  /** The directory holding `<id>/` folders and index.json. */
  root: string;
  templates: TemplateManifest[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk up from this module to the template bundle: `templates/` beside the built entry points
 * (dist/), or `dist/templates/` above the sources (a workspace build, as the tests run it).
 */
async function locateTemplates(): Promise<string | undefined> {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    for (const candidate of [join(dir, 'templates'), join(dir, 'dist', 'templates')]) {
      if (await exists(join(candidate, 'index.json'))) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Read the shipped template bundle; throws when it is missing. */
export async function loadTemplateBundle(): Promise<TemplateBundle> {
  const root = await locateTemplates();
  if (root === undefined) {
    throw new Error(
      'Molen template bundle is missing; reinstall @bendyline/molen-tooling (in the engine repository, build the tooling package)',
    );
  }
  const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8')) as {
    templates: TemplateManifest[];
  };
  return { root, templates: index.templates };
}

/** The sample templates `molen new --template <id>` can scaffold. */
export async function listTemplates(): Promise<ListTemplatesOutput> {
  try {
    const { templates } = await loadTemplateBundle();
    return {
      ok: true,
      templates: templates.map(({ id, description }) => ({ id, description })),
    };
  } catch (error) {
    return { ok: false, templates: [], error: (error as Error).message };
  }
}
