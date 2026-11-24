#!/usr/bin/env node
// Push the Release workflow's metadata commit to main and print the commit that reached it.
//
// By now the release's tags are on GitHub, so this commit must land: without it the next run finds
// tags newer than the manifests and cannot publish them. When main moved while the release ran,
// the metadata is replayed onto its new tip. Only that commit moves: the checkout stays at the
// tagged source with its stamps, which is what gets published.
//
// Usage: node scripts/push-release-commit.mjs   (after committing the metadata; HEAD is the commit)
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** The metadata of `commit` (a child of `parent`) as a commit on top of `tip`. */
function replay(git, commit, parent, tip) {
  const tree = git('merge-tree', '--write-tree', `--merge-base=${parent}`, tip, commit);
  return git('commit-tree', tree, '-p', tip, '-m', git('log', '-1', '--format=%B', commit));
}

/** Push `commit` to the branch, onto its newest tip if it moved; returns the commit pushed. */
export function pushReleaseCommit({
  git,
  commit,
  branch = 'main',
  attempts = 5,
  delay = 5_000,
  log = (line) => process.stderr.write(`${line}\n`),
}) {
  const parent = git('rev-parse', `${commit}^`);
  let candidate = commit;
  for (let attempt = 1; ; attempt++) {
    try {
      git('push', 'origin', `${candidate}:refs/heads/${branch}`);
      return candidate;
    } catch (error) {
      if (attempt >= attempts) throw error;
      log(`Push ${attempt} of ${attempts} failed: ${String(error.stderr ?? error.message).trim()}`);
    }
    pause(delay * attempt);
    git('fetch', '--quiet', 'origin', branch);
    const tip = git('rev-parse', 'FETCH_HEAD');
    // The push can arrive even though its connection broke.
    if (git('merge-base', candidate, tip) === candidate) return candidate;
    candidate = tip === parent ? commit : replay(git, commit, parent, tip);
    if (candidate !== commit) log(`${branch} moved to ${tip}; replayed the metadata onto it.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    process.stdout.write(`${pushReleaseCommit({ git, commit: git('rev-parse', 'HEAD') })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
