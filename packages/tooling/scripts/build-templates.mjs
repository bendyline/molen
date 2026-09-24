// Ship the small samples as `molen new <name> --template <id>` starters, so nobody has to clone
// the repository to start from one. Each examples/<id>/ becomes dist/templates/<id>/ — the files a
// user needs, turned into a standalone npm project — and dist/templates/index.json describes them
// for src/ops/templates.ts, which locates this directory at runtime the way ops/docs.ts locates
// dist/docs-src.
//
// Standalone means: no `catalog:` (resolved from pnpm-workspace.yaml here), no pnpm-only or
// repo-only scripts, no tsconfig extending ../../tsconfig.base.json, and no import reaching out of
// the sample (the shared game-shell.css is copied in). Engine dependencies stay `workspace:*` in
// the bundle and become `^ENGINE_VERSION` when a project is scaffolded, so a template always
// installs the version line of the CLI that wrote it. Content never ships: preview images, golden
// references and every other content-extension file are left behind, and each written file goes
// through the same check the release tarballs do.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_EXTENSIONS, checkPackedFile } from '../../../scripts/check-package-contents.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const EXAMPLES = join(ROOT, 'examples');
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/templates');

/**
 * The samples that ship, in listing order. Not lantern-dungeon (its runtime GLBs are content, and
 * content never ships in an npm package), world-explorer (terrain data and content packs) or home.
 */
export const TEMPLATES = [
  'cubes',
  'data-viz',
  'top-down-arena',
  'terrain-flyover',
  'figures-gallery',
  'city-courier',
  'skybound',
];

/**
 * How each sample's headless `sim run` differs from the default (scene.json for 90 ticks, with
 * commands.json / checks.json when the sample has them). `null` means the sample has no CLI run.
 */
const SIM = {
  // The cubes are seeded and moved by a setup module, not by scene data.
  cubes: 'sim run scene.json --ticks 300 --setup src/cubes.ts --hash',
  // src/viz.ts imports data.json without an import attribute: Vite and Vitest load it, plain Node
  // does not, so `--setup src/viz.ts` cannot load and the sample's loop is `npm test`.
  'data-viz': null,
  'figures-gallery': 'sim run scene.json --ticks 240 --hash',
};

/** Scripts a standalone project keeps; the rest (lint, golden, pnpm --filter hooks) are repo-only. */
const KEPT_SCRIPTS = ['dev', 'build', 'preview', 'typecheck'];

/** Dev tooling of the monorepo, not of a sample. */
const DROPPED_DEPENDENCIES = new Set(['@biomejs/biome']);

/** Emit-side options of tsconfig.base.json that mean nothing to a `noEmit` app. */
const EMIT_OPTIONS = [
  'declaration',
  'declarationMap',
  'emitDeclarationOnly',
  'isolatedDeclarations',
  'outDir',
  'rootDir',
  'stripInternal',
  'composite',
];

const SHARED_CSS = join(EXAMPLES, 'game-shell.css');
const SHARED_CSS_TARGET = 'src/game-shell.css';
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.html', '.css']);

const fail = (message) => {
  throw new Error(`build-templates: ${message}`);
};

/** `catalog:` ranges from pnpm-workspace.yaml (a flat `catalog:` map; no YAML dependency). */
function readCatalog() {
  const catalog = {};
  let inside = false;
  for (const line of readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8').split('\n')) {
    if (/^catalog:\s*$/.test(line)) {
      inside = true;
      continue;
    }
    if (!inside || line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) break;
    const match = /^\s+['"]?([^'"\s:]+)['"]?\s*:\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/.exec(line);
    if (match) catalog[match[1]] = match[2];
  }
  return catalog;
}

/** Files under `dir` minus build output, for a source copy without git. */
function walk(dir, prefix = '') {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      return ['node_modules', 'dist', '__output__', '.artifacts', 'shots'].includes(entry.name)
        ? []
        : walk(dir, path);
    }
    return entry.isFile() ? [path] : [];
  });
}

/** The sample's files: tracked plus new-but-not-ignored ones, so .gitignore decides what is junk. */
function sampleFiles(dir) {
  try {
    const listed = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return [...new Set(listed.split('\0').filter(Boolean))]
      .filter((path) => existsSync(join(dir, path)))
      .sort();
  } catch {
    return walk(dir).sort();
  }
}

/** Why a sample file stays behind, or undefined when it ships. */
function excluded(path) {
  const segments = path.split('/');
  const name = basename(path);
  if (path === 'package.json' || path === 'tsconfig.json') return 'rewritten';
  if (segments.some((s) => s === 'node_modules' || s === 'dist')) return 'build output';
  if (path.startsWith('test/golden/') || name.startsWith('vitest.golden.config.')) {
    return 'golden-image regression (repository only)';
  }
  if (segments[0] === 'public') return 'runtime content';
  if (CONTENT_EXTENSIONS.has(extname(path).toLowerCase())) return 'content file';
  if (name === '.DS_Store' || name === '.gitignore') return 'repository metadata';
  return undefined;
}

/** A self-contained tsconfig: the base's options folded in, emit-only options dropped. */
function standaloneTsconfig(dir) {
  const local = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8'));
  let compilerOptions = { ...(local.compilerOptions ?? {}) };
  if (local.extends !== undefined) {
    const basePath = resolve(dir, local.extends);
    if (basePath !== join(ROOT, 'tsconfig.base.json')) {
      fail(`${relative(ROOT, dir)}/tsconfig.json extends ${local.extends}; only the base is known`);
    }
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    compilerOptions = { ...base.compilerOptions, ...compilerOptions };
  }
  for (const option of EMIT_OPTIONS) delete compilerOptions[option];
  compilerOptions.noEmit = true;
  const { extends: _extends, compilerOptions: _options, ...rest } = local;
  return { compilerOptions, ...rest };
}

function sortedObject(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

/** The sample's manifest as a standalone project; `name` is applied at scaffold time. */
function standalonePackage(dir, catalog, hasTests) {
  const source = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (typeof source.description !== 'string' || source.description.length === 0) {
    fail(`${relative(ROOT, dir)}/package.json needs a one-line "description" (molen templates)`);
  }
  const kept = { ...source.scripts };
  // Every sample builds with Vite; `npm run preview` serves that build.
  if (kept.preview === undefined && kept.build?.startsWith('vite ')) kept.preview = 'vite preview';
  if (hasTests) kept.test = 'vitest run';
  const scripts = {};
  for (const name of [...KEPT_SCRIPTS, 'test']) {
    const script = kept[name];
    if (script === undefined) continue;
    if (/\bpnpm\b/.test(script)) fail(`${relative(ROOT, dir)} script "${name}" needs pnpm`);
    scripts[name] = script;
  }

  const range = (name, spec) => {
    if (spec === 'catalog:' || spec === 'catalog:default') {
      return catalog[name] ?? fail(`no pnpm catalog entry for ${name}`);
    }
    if (spec.startsWith('catalog:')) fail(`named catalog ${spec} for ${name} is not supported`);
    return spec;
  };
  const dependencies = [];
  const devDependencies = [];
  for (const [field, target] of [
    ['dependencies', dependencies],
    ['devDependencies', devDependencies],
  ]) {
    for (const [name, spec] of Object.entries(source[field] ?? {})) {
      if (DROPPED_DEPENDENCIES.has(name)) continue;
      if (name === 'vitest' && !hasTests) continue;
      // The CLI is a dev dependency of an app, as in the default scaffold: `npx molen` and the
      // headless tests use it; the page never imports it.
      const into = name === '@bendyline/molen-tooling' ? devDependencies : target;
      into.push([name, range(name, spec)]);
    }
  }
  return {
    description: source.description,
    manifest: {
      private: true,
      type: 'module',
      scripts,
      dependencies: sortedObject(dependencies),
      devDependencies: sortedObject(devDependencies),
    },
  };
}

/**
 * Rewrite a code file's relative specifiers: the shared game-shell.css moves into the template,
 * and anything else reaching out of the sample is a build error rather than a broken project.
 */
function localizeSpecifiers(dir, path, text) {
  let usesSharedCss = false;
  const fileDir = dirname(join(dir, path));
  const rewritten = text.replace(/(['"])(\.{1,2}\/[^'"\n]*)\1/g, (match, quote, specifier) => {
    const target = resolve(fileDir, specifier);
    if (target === SHARED_CSS) {
      usesSharedCss = true;
      let local = posix.relative(posix.dirname(path), SHARED_CSS_TARGET);
      if (!local.startsWith('.')) local = `./${local}`;
      return `${quote}${local}${quote}`;
    }
    if (target !== dir && !target.startsWith(dir + sep)) {
      fail(`${relative(ROOT, join(dir, path))} reaches outside the sample with "${specifier}"`);
    }
    return match;
  });
  return { text: rewritten, usesSharedCss };
}

/** Top-level molen documents worth a `molen validate` (not the project, checks or fixtures). */
function validateTargets(dir, files) {
  const targets = [];
  for (const path of files) {
    if (path.includes('/') || !path.endsWith('.json') || path === 'package.json') continue;
    let format;
    try {
      format = JSON.parse(readFileSync(join(dir, path), 'utf8')).format;
    } catch {
      continue;
    }
    if (typeof format !== 'string' || !format.startsWith('molen/')) continue;
    if (/^molen\/(project|assert|replay)@/.test(format)) continue;
    targets.push(path);
  }
  return targets.sort((a, b) => (a === 'scene.json' ? -1 : b === 'scene.json' ? 1 : 0));
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** Two-space JSON with short arrays of scalars kept on one line, as the samples write them. */
function json(value) {
  const text = JSON.stringify(value, null, 2).replace(
    /\[\n\s+([^[\]{}]*?)\n\s*\]/g,
    (whole, items) => {
      const line = `[${items.split(/,\n\s+/).join(', ')}]`;
      return line.length <= 80 ? line : whole;
    },
  );
  return `${text}\n`;
}

export function buildTemplates() {
  const catalog = readCatalog();
  rmSync(OUT, { recursive: true, force: true });
  const index = [];
  for (const id of TEMPLATES) {
    const dir = join(EXAMPLES, id);
    if (!existsSync(join(dir, 'package.json'))) fail(`examples/${id} is missing`);
    const shipped = sampleFiles(dir).filter((path) => excluded(path) === undefined);
    const hasTests = shipped.some((path) => /^test\/.*\.test\.[cm]?[jt]sx?$/.test(path));
    const { description, manifest } = standalonePackage(dir, catalog, hasTests);

    const outputs = new Map();
    let usesSharedCss = false;
    for (const path of shipped) {
      const bytes = readFileSync(join(dir, path));
      if (!CODE_EXTENSIONS.has(extname(path))) {
        outputs.set(path, bytes);
        continue;
      }
      const localized = localizeSpecifiers(dir, path, bytes.toString('utf8'));
      usesSharedCss ||= localized.usesSharedCss;
      outputs.set(path, localized.text);
    }
    if (usesSharedCss) {
      if (outputs.has(SHARED_CSS_TARGET)) fail(`examples/${id} already has ${SHARED_CSS_TARGET}`);
      outputs.set(SHARED_CSS_TARGET, readFileSync(SHARED_CSS));
    }
    outputs.set('package.json', json(manifest));
    outputs.set('tsconfig.json', json(standaloneTsconfig(dir)));

    const files = [...outputs.keys()].sort();
    for (const path of files) {
      const target = join(OUT, id, path);
      write(target, outputs.get(path));
      const problems = checkPackedFile(`dist/templates/${id}/${path}`, statSync(target).size);
      if (problems.length > 0) fail(problems.join('\n'));
    }

    const hasScene = files.includes('scene.json');
    const flags = [
      ...(files.includes('commands.json') ? ['--commands', 'commands.json'] : []),
      ...(files.includes('checks.json') ? ['--assert', 'checks.json'] : []),
    ];
    const sim =
      id in SIM
        ? SIM[id]
        : hasScene
          ? ['sim run scene.json --ticks 90', ...flags, '--hash'].join(' ')
          : null;
    index.push({
      id,
      description,
      files,
      project: files.includes('project.json'),
      validate: validateTargets(dir, files),
      sim,
      replays: files.filter((path) => !path.includes('/') && path.endsWith('.replay.json')),
      tests: hasTests,
    });
  }
  write(join(OUT, 'index.json'), json({ templates: index }));
  return index;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = buildTemplates();
  const count = index.reduce((sum, t) => sum + t.files.length, 0);
  console.log(`build-templates: ${index.length} templates, ${count} files -> dist/templates`);
}
