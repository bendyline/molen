#!/usr/bin/env node
// CI is the only gate between main and a release, and everything it checks can be run locally.
//
// The Release and Site workflows repeat none of CI's checks; they require that CI passed the commit
// (scripts/require-green-ci.mjs). That is sound only while three things hold, and each is a pair of
// hand-kept lists that drift the moment someone adds a step:
//
//   - CI runs every check `pnpm verify` names, so nothing a release relied on went missing;
//   - Release and Site refuse a commit CI has not passed before they tag, publish or deploy;
//   - every root script CI, Release and Site run is reachable from `pnpm all`, so a green local
//     `pnpm all` is a promise that none of them fails on a check you could have run yourself.
//
// So instead of comparing lists this walks the script graph: it expands `all` transitively through
// the root scripts it calls (and their pre* hooks) and reads the `run:` steps of the workflows.
// It does not check that CI runs everything in `all`, which also installs and fetches.
//
// Run by the root `lint` script, which is itself inside `verify`, so CI and a local run enforce it.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = '.github/workflows';
const CI = `${WORKFLOWS}/ci.yml`;
/** Workflows that act on a commit CI passed, and the command that must come after the gate. */
const GATED = {
  [`${WORKFLOWS}/release.yml`]: 'multi-semantic-release',
  [`${WORKFLOWS}/site.yml`]: 'publish-pack-release.mjs',
};
const GATE = 'node scripts/require-green-ci.mjs';
const ENTRY = 'all';
const CHECKS = 'verify';
/** Root scripts that make or publish the GLB bundle rather than check anything. */
const ACTIONS = new Set(['assets:build', 'assets:pack', 'assets:publish']);

/** pnpm's own verbs. `pnpm install` is not a script, and `pnpm exec foo` runs a binary. */
const BUILTINS = new Set([
  'install',
  'i',
  'add',
  'remove',
  'update',
  'exec',
  'dlx',
  'publish',
  'why',
  'store',
  'link',
  'prune',
  'rebuild',
]);

const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts ?? {};

/**
 * Root script names a command line invokes. Handles `pnpm a`, `pnpm run a`, `pnpm a b c` (pnpm
 * accepts several), and ignores flags, recursive forms and anything that is not a root script.
 * `recursive` also counts `pnpm -r a`, which runs package scripts of the same name.
 */
function scriptsInvokedBy(command, { recursive = false } = {}) {
  const found = new Set();
  for (const segment of command.split(/&&|\|\||;|(?<=\s)--(?=\s+pnpm\s)/)) {
    const tokens = segment.trim().split(/\s+/);
    if (tokens[0] !== 'pnpm') continue;
    let rest = tokens.slice(1);
    if (recursive && rest[0] === '-r') rest = rest.slice(1);
    if (rest[0] === 'run') rest = rest.slice(1);
    if (rest.length > 0 && BUILTINS.has(rest[0])) continue;
    // Leading names, stopping at the first flag or unknown word: `pnpm lint typecheck` is two.
    for (const token of rest) {
      if (token.startsWith('-')) break;
      if (!(token in scripts)) break;
      found.add(token);
    }
  }
  return found;
}

/** Every root script reachable from `name`, following calls and its pre/post hooks. */
function reachableFrom(name, seen = new Set()) {
  if (seen.has(name) || !(name in scripts)) return seen;
  seen.add(name);
  for (const hook of [`pre${name}`, `post${name}`]) {
    if (hook in scripts) reachableFrom(hook, seen);
  }
  for (const called of scriptsInvokedBy(scripts[name])) reachableFrom(called, seen);
  return seen;
}

const inCI = process.env.CI && process.env.CI !== 'false';
if (!inCI && !existsSync(join(ROOT, WORKFLOWS))) {
  // Source-only copies may omit GitHub metadata entirely. There is nothing to compare there, but a
  // missing file in CI or an existing workflows directory is still an error.
  console.log('check-release-gate: skipped (this source checkout has no .github/workflows).');
  process.exit(0);
}

const problems = [];

/** A workflow's text without comments, and its `run:` commands in order (one line each). */
function readWorkflow(path) {
  let text;
  try {
    text = readFileSync(join(ROOT, path), 'utf8').replaceAll('\r\n', '\n');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.error(`check-release-gate: missing ${path}. Restore it from a complete checkout.`);
    process.exit(1);
  }
  text = text.replace(/^\s*#.*\n/gm, '');
  // Enough YAML for files we control; a real parser would be a dependency for one field. A block
  // scalar (`run: |`) is every deeper-indented line below it.
  const steps = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)(?:- )?run:\s*(.+?)\s*$/);
    if (!match) continue;
    if (!/^[|>][-+]?$/.test(match[2])) {
      steps.push(match[2]);
      continue;
    }
    const indent = match[1].length;
    while (i + 1 < lines.length && (!lines[i + 1].trim() || lines[i + 1].search(/\S/) > indent)) {
      i++;
      if (lines[i].trim()) steps.push(lines[i].trim());
    }
  }
  return { path, text, steps };
}

const gated = Object.keys(GATED).map(readWorkflow);
const ci = readWorkflow(CI);
for (const { path, steps } of [...gated, ci]) {
  if (steps.length === 0) {
    console.error(`check-release-gate: no \`run:\` steps found in ${path}.`);
    process.exit(1);
  }
}
// CI's own reusable workflows are part of it.
const called = [
  ...ci.text.matchAll(/^\s+uses: \.\/(\.github\/workflows\/[\w-]+\.ya?ml)\s*$/gm),
].map(([, path]) => readWorkflow(path));

const reachable = reachableFrom(ENTRY);
for (const { path, steps } of [...gated, ci, ...called]) {
  for (const step of steps) {
    for (const name of scriptsInvokedBy(step)) {
      if (!reachable.has(name) && !ACTIONS.has(name))
        problems.push(
          `${path} runs \`pnpm ${name}\`, which \`pnpm ${ENTRY}\` does not. Add it to \`${ENTRY}\` ` +
            'in package.json, or take the step out of the workflow.',
        );
    }
  }
}

for (const { path, steps } of gated) {
  const gate = steps.findIndex((step) => step.includes(GATE));
  const action = steps.findIndex((step) => step.includes(GATED[path]));
  if (gate < 0) problems.push(`${path} never runs \`${GATE}\`; CI would not be its gate.`);
  else if (action < 0) problems.push(`${path} does not run ${GATED[path]}; update this check.`);
  else if (action < gate) problems.push(`${path} runs ${GATED[path]} before \`${GATE}\`.`);
}

const checked = new Set();
for (const { steps } of [ci, ...called])
  for (const step of steps)
    for (const name of scriptsInvokedBy(step, { recursive: true })) checked.add(name);
const required = scriptsInvokedBy(scripts[CHECKS] ?? '');
for (const name of required) {
  if (!checked.has(name))
    problems.push(
      `\`pnpm ${CHECKS}\` runs \`pnpm ${name}\`, but no step of ${CI} does. A release would go out ` +
        'without that check: add it to CI.',
    );
}

if (problems.length > 0) {
  console.error('check-release-gate: CI is not a complete gate.\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `check-release-gate: CI runs all ${required.size} checks of \`pnpm ${CHECKS}\`, ` +
    `${gated.map(({ path }) => path.split('/').at(-1)).join(' and ')} require green CI, and every ` +
    `script they run is reachable from \`pnpm ${ENTRY}\`.`,
);
