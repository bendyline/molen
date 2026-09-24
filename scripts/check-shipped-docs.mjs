#!/usr/bin/env node
// The shipped docs are read by someone who installed Molen from npm and never cloned this
// repository: `docs-src/` travels inside @bendyline/molen-tooling (`dist/docs-src/`) and is
// mirrored to molen.dev. A relative link that climbs out of the bundle is dead in the tarball and
// dropped on the site, and a clone-only CLI invocation does not run in a user's project. The
// samples that ship as `molen new --template` copies carry their README into the copy, where a
// link out of the sample, or to a file the template leaves out (a preview image), is broken.
// This gate keeps all of that out. See "Shipped docs are written for npm users" in CONVENTIONS.md.
//
// Run by the root `lint` script.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from '../packages/tooling/scripts/build-templates.mjs';
import { CONTENT_EXTENSIONS } from './check-package-contents.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Markdown link targets: `[text](target)` and `[text](target "title")`. */
const LINK_RE = /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

/** The CLI as only a clone of this repository can run it. */
const CLONE_CLI_RE = /node\s+(?:\S*\/)?packages\/tooling\/dist\/cli\.mjs/;

/** Relative link targets in `text`, with their 1-based line numbers. */
function relativeLinks(text) {
  const links = [];
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(LINK_RE)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/')) {
        continue;
      }
      if (target.split('#')[0] !== '') links.push({ target, line: index + 1 });
    }
  });
  return links;
}

/**
 * Problems in one shipped document. `file` is its path, `bundleDir` the directory its relative
 * links must stay inside, and `text` its contents.
 */
export function checkShippedDoc(file, bundleDir, text) {
  const problems = [];
  const where = relative(ROOT, file).split(sep).join('/');
  for (const { target, line } of relativeLinks(text)) {
    const resolved = resolve(dirname(file), target.split('#')[0]);
    if (resolved !== bundleDir && !resolved.startsWith(bundleDir + sep)) {
      problems.push(
        `${where}:${line}: links to ${target}, outside the shipped bundle; use an absolute https://github.com/bendyline/molen/… or https://molen.dev/… URL`,
      );
    }
  }
  text.split('\n').forEach((line, index) => {
    if (CLONE_CLI_RE.test(line)) {
      problems.push(
        `${where}:${index + 1}: runs the CLI from a clone; write \`npx molen …\` (run in the user's project)`,
      );
    }
  });
  return problems;
}

/**
 * Problems in a template sample's README (`file`, inside `sampleDir`): it is copied into every
 * `molen new --template` project, so a relative link must stay inside the sample and must not
 * point at a file the template build leaves out (content such as preview images, golden tests).
 */
export function checkTemplateReadme(file, sampleDir, text) {
  const where = relative(ROOT, file).split(sep).join('/');
  const problems = [];
  text.split('\n').forEach((line, index) => {
    if (CLONE_CLI_RE.test(line)) {
      problems.push(
        `${where}:${index + 1}: runs the CLI from a clone; write \`npx molen …\` (run from the sample's directory)`,
      );
    }
  });
  for (const { target, line } of relativeLinks(text)) {
    const resolved = resolve(dirname(file), target.split('#')[0]);
    const inside = relative(sampleDir, resolved).split(sep).join('/');
    if (inside.startsWith('..')) {
      problems.push(
        `${where}:${line}: links to ${target}, outside the sample; a template copy has no such file, so use an absolute URL`,
      );
    } else if (
      CONTENT_EXTENSIONS.has(extname(resolved).toLowerCase()) ||
      inside.startsWith('test/golden')
    ) {
      problems.push(
        `${where}:${line}: links to ${target}, which template copies leave out; use an absolute https://raw.githubusercontent.com/bendyline/molen/main/… URL`,
      );
    }
  }
  return problems;
}

/** Markdown and text files under `dir`. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(md|txt)$/.test(entry.name) ? [path] : [];
  });
}

/** Every problem across the shipped docs bundle and the template samples' READMEs. */
export function checkShippedDocs(root = ROOT) {
  const problems = [];
  const bundle = join(root, 'docs-src');
  if (existsSync(bundle) && statSync(bundle).isDirectory()) {
    for (const file of walk(bundle)) {
      problems.push(...checkShippedDoc(file, bundle, readFileSync(file, 'utf8')));
    }
  }
  for (const id of TEMPLATES) {
    const sampleDir = join(root, 'examples', id);
    const readme = join(sampleDir, 'README.md');
    if (!existsSync(readme)) continue;
    problems.push(...checkTemplateReadme(readme, sampleDir, readFileSync(readme, 'utf8')));
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkShippedDocs();
  if (problems.length > 0) {
    console.error('check-shipped-docs: the shipped docs assume a clone of the repository.\n');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log('check-shipped-docs: docs-src and the template READMEs stand on their own.');
}
