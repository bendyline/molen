#!/usr/bin/env node
// Every check the Release workflow runs must also be reachable from `pnpm all`.
//
// The point is that a green local `pnpm all` is a promise: the release will not fail on a check
// you could have run yourself. That promise holds only while the two agree, and two hand-kept
// lists in two files drift the moment someone adds a step to the workflow. So instead of
// comparing lists, this walks the script graph: it expands `all` transitively through the root
// scripts it calls (and their pre* hooks), then asserts every script the workflow invokes is
// somewhere in that set.
//
// It does not check the reverse. `pnpm all` is deliberately the larger set — golden renders need
// a browser and stay out of the release path — so extra work in `all` is the design, not drift.
//
// Run by the root `lint` script, which is itself inside `verify`, so CI, the release gate and a
// local run all enforce it.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = '.github/workflows/release.yml';
const ENTRY = 'all';

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
 */
function scriptsInvokedBy(command) {
  const found = new Set();
  for (const segment of command.split(/&&|\|\||;/)) {
    const tokens = segment.trim().split(/\s+/);
    if (tokens[0] !== 'pnpm') continue;
    let rest = tokens.slice(1);
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

const reachable = reachableFrom(ENTRY);

// `run:` steps in the workflow. Enough YAML for a file we control; a real parser would be a
// dependency for one field.
let workflow;
try {
  workflow = readFileSync(join(ROOT, WORKFLOW), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  // Source-only copies may omit GitHub metadata entirely. There is no release workflow to
  // compare there, but a missing file in CI or an existing workflows directory is still an error.
  const inCI = process.env.CI && process.env.CI !== 'false';
  if (!inCI && !existsSync(join(ROOT, '.github/workflows'))) {
    console.log('check-release-gate: skipped (this source checkout has no .github/workflows).');
    process.exit(0);
  }
  console.error(`check-release-gate: missing ${WORKFLOW}. Restore it from a complete checkout.`);
  process.exit(1);
}
const steps = [...workflow.matchAll(/^\s*-?\s*run:\s*(.+?)\s*$/gm)].map((m) => m[1]);
if (steps.length === 0) {
  console.error(`check-release-gate: no \`run:\` steps found in ${WORKFLOW}.`);
  process.exit(1);
}

const missing = [];
for (const step of steps) {
  for (const name of scriptsInvokedBy(step)) {
    if (!reachable.has(name)) missing.push({ name, step });
  }
}

if (missing.length > 0) {
  console.error(`check-release-gate: ${WORKFLOW} runs checks that \`pnpm ${ENTRY}\` does not.\n`);
  for (const { name, step } of missing) {
    console.error(`  pnpm ${name}   (from \`${step}\`)`);
  }
  console.error(
    `\nA local \`pnpm ${ENTRY}\` is supposed to be enough to know a release will pass. Either add` +
      ` the script to \`${ENTRY}\` in package.json, or take the step out of the workflow.`,
  );
  process.exit(1);
}

const gate = steps.flatMap((step) => [...scriptsInvokedBy(step)]);
console.log(
  `check-release-gate: ${WORKFLOW} runs ${gate.map((n) => `\`${n}\``).join(', ') || 'no scripts'}` +
    `, all reachable from \`pnpm ${ENTRY}\`.`,
);
