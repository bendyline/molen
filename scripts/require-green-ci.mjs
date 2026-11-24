#!/usr/bin/env node
// Refuse to release or deploy a commit that CI has not passed on main. CI is the only gate: Release
// and Site do not repeat its checks, so they must never run on a commit it has not checked.
//
// The commit a release records (stamped versions and changelogs) carries [skip ci], so CI never
// runs on it. It inherits the result of the commit below it, but only when its whole diff is that
// metadata: anything else in it would reach npm or molen.dev unchecked.
//
// Usage: node scripts/require-green-ci.mjs [--commit <sha>] [--repo owner/name]
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { KERNEL_STAMPS } from './stage-release-metadata.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = 'ci.yml';
const BRANCH = 'main';
const VERSION = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g;

const masked = (text) => text.replaceAll('\r\n', '\n').replace(VERSION, 'VERSION');

/** Whether one file's change is release metadata: its changelog, or nothing but a version. */
export function isReleaseMetadata(path, before, after) {
  if (/^packages\/[^/]+\/CHANGELOG\.md$/.test(path)) return after !== undefined;
  if (before === undefined || after === undefined) return false;
  if (KERNEL_STAMPS.includes(path)) return masked(before) === masked(after);
  if (!/^packages\/[^/]+\/package\.json$/.test(path)) return false;
  try {
    const { version: was, ...old } = JSON.parse(before);
    const { version: now, ...current } = JSON.parse(after);
    return was !== now && JSON.stringify(old) === JSON.stringify(current);
  } catch {
    return false;
  }
}

/** The commit CI must have passed for `commit`: itself, or the one its release metadata records. */
export function checkedCommit(git, commit) {
  const show = (revision, path) => {
    try {
      return git('show', `${revision}:${path}`);
    } catch {
      return undefined; // The file is new or removed in this commit.
    }
  };
  let current = commit;
  for (;;) {
    const parents = git('rev-list', '--parents', '-n', '1', current).trim().split(/\s+/).slice(1);
    if (parents.length !== 1) return current;
    const [parent] = parents;
    const paths = git('diff', '--name-only', '-z', '--no-renames', parent, current)
      .split('\0')
      .filter(Boolean);
    if (
      paths.length === 0 ||
      !paths.every((path) => isReleaseMetadata(path, show(parent, path), show(current, path)))
    )
      return current;
    current = parent;
  }
}

/** Why `runs` (newest first) do not clear a commit, or undefined when they do. */
export function objection(runs) {
  const [latest] = runs;
  if (!latest) return 'CI has not run on it';
  if (latest.status !== 'completed') return `CI is still running: ${latest.html_url}`;
  if (latest.conclusion !== 'success')
    return `CI finished with "${latest.conclusion}": ${latest.html_url}`;
}

/** The CI runs of a commit pushed to main, newest first. `gh` takes one call's arguments. */
export function ciRuns(gh, repository, commit) {
  return gh([
    'api',
    '--jq',
    '.workflow_runs[] | {id, status, conclusion, html_url, head_branch, created_at} | tojson',
    `repos/${repository}/actions/workflows/${WORKFLOW}/runs?head_sha=${commit}&event=push&per_page=50`,
  ])
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .filter((run) => run.head_branch === BRANCH)
    .sort((a, b) =>
      a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id,
    );
}

/** Throw unless CI passed `commit`; returns the commit CI ran on. */
export function requireGreenCi({ git, gh, repository, commit }) {
  const checked = checkedCommit(git, commit);
  const problem = objection(ciRuns(gh, repository, checked));
  if (problem) {
    const what = checked === commit ? commit : `${commit} (CI runs on ${checked})`;
    throw new Error(`Refusing ${what}: ${problem}. Start this again once CI passes on ${BRANCH}.`);
  }
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: { commit: { type: 'string' }, repo: { type: 'string' } },
  });
  const run = (file) => (args) =>
    execFileSync(file, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 ** 2,
    });
  const git = (...args) => run('git')(args);
  try {
    const commit = git('rev-parse', '--verify', `${values.commit ?? 'HEAD'}^{commit}`).trim();
    const checked = requireGreenCi({
      git,
      gh: run('gh'),
      repository: values.repo ?? process.env.GITHUB_REPOSITORY ?? 'bendyline/molen',
      commit,
    });
    process.stdout.write(
      `CI passed ${checked}${checked === commit ? '' : `, which ${commit} only adds release metadata to`}.\n`,
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
