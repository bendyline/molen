// The public package/entry-point manifest every generator shares.
//
// Entry points are read from each package's `exports` map rather than hand-listed, so adding a
// subpath export (or a whole package) shows up in the API reference, the sidebar, and the
// package index on the next `pnpm docs:site:gen` with no edit here.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const siteDir = dirname(dirname(fileURLToPath(import.meta.url)));
export const repoRoot = dirname(siteDir);

/** Entry points whose target is a `.d.mts` are code; `./packs/*`, `./assets/*` etc. are data. */
function codeEntries(exportsMap) {
  const out = [];
  for (const [subpath, target] of Object.entries(exportsMap ?? {})) {
    const types = typeof target === 'string' ? undefined : target?.types;
    if (typeof types !== 'string' || !types.endsWith('.d.mts')) continue;
    out.push({ subpath, types });
  }
  return out;
}

/** Curated ordering: the packages an author meets first come first. */
const ORDER = [
  '@bendyline/molen-kernel',
  '@bendyline/molen-client',
  '@bendyline/molen-schema',
  '@bendyline/molen-tooling',
  '@bendyline/molen-terrain',
  '@bendyline/molen-worldgen',
  '@bendyline/molen-worldgen-earth',
  '@bendyline/molen-earth',
  '@bendyline/molen-figures',
  '@bendyline/molen-materials',
  '@bendyline/molen-pack',
  '@bendyline/molen-pathfinding',
  '@bendyline/molen-physics-rapier',
  '@bendyline/molen-entities',
];

/**
 * Every publishable package with at least one typed entry point, in curated order
 * (unlisted packages sort last, alphabetically).
 */
export async function publicPackages() {
  const dir = join(repoRoot, 'packages');
  const names = await readdir(dir);
  const pkgs = [];
  for (const name of names) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(dir, name, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    if (manifest.private === true) continue;
    const entries = codeEntries(manifest.exports);
    if (entries.length === 0) continue;
    pkgs.push({
      dir: join(dir, name),
      folder: name,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description ?? '',
      /** URL-safe short name: `@bendyline/molen-kernel` -> `kernel`. */
      slug: manifest.name.replace('@bendyline/molen-', ''),
      entries,
    });
  }
  const rank = (n) => (ORDER.indexOf(n) === -1 ? ORDER.length : ORDER.indexOf(n));
  pkgs.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  return pkgs;
}

/** Doc slug for one entry point: `.` -> `index`, `./kernel` -> `kernel`. */
export function entrySlug(subpath) {
  return subpath === '.' ? 'index' : subpath.replace(/^\.\//, '').replace(/\//g, '-');
}

/** Human label for one entry point: `@bendyline/molen-kernel` + `./testing`. */
export function entryLabel(pkgName, subpath) {
  return subpath === '.' ? pkgName : `${pkgName}/${subpath.replace(/^\.\//, '')}`;
}

/**
 * Quote a value for a YAML frontmatter scalar. Titles routinely start with `@` or contain `:`,
 * both of which are reserved YAML indicators that break the frontmatter parser unquoted.
 */
export function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Escape angle brackets in prose so VitePress (which compiles markdown as a Vue template) does
 * not read `<variant>` or `<outDir>` as an unclosed component tag. Text already inside a backtick
 * code span is left alone — markdown escapes that itself.
 */
export function mdText(value) {
  return String(value)
    .split(/(`[^`]*`)/)
    .map((part) => (part.startsWith('`') ? part : part.replace(/</g, '&lt;').replace(/>/g, '&gt;')))
    .join('');
}

/**
 * Apply {@link mdText} to prose only: lines inside fenced code blocks are left untouched, and so
 * are backtick spans. VitePress compiles every page as a Vue template, so an unescaped `<id>` in
 * a doc comment or a guide paragraph is read as an unclosed component tag and fails the build.
 */
export function escapeProse(markdown) {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : mdText(line);
    })
    .join('\n');
}
