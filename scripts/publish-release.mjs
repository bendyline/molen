#!/usr/bin/env node
// Publish every Molen package version npm does not have yet, dependencies first. The Release
// workflow runs this after multi-semantic-release has stamped and tagged the new versions (see
// semantic-release-molen.mjs) and the metadata commit recorded them on main. If publishing stops
// partway, rerun the Release workflow: there is nothing new to version, and this publishes the
// versions still missing from npm.
//
// CI already checked this source (scripts/require-green-ci.mjs), and the tarballs hold only what
// tsdown writes, so this compiles the stamped packages and reads no content: no GLBs, no content
// packs, no site. packRelease checks every tarball before anything is published.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execCommand } from './exec-command.mjs';
import {
  packRelease,
  publicationOrder,
  publishedIntegrity,
  publishRelease,
  releasePackages,
  releaseTag,
} from './semantic-release-molen.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const packages = publicationOrder(releasePackages());

// A checkout from before the release commit carries the previous versions: it would find them all
// on npm and publish nothing while the tagged versions stay missing.
for (const { data } of packages) {
  const tags = git(
    'tag',
    '--merged',
    'HEAD',
    '--list',
    releaseTag(data.name, '*'),
    '--sort=-v:refname',
  );
  const newest = tags.split('\n')[0];
  if (newest !== releaseTag(data.name, data.version)) {
    throw new Error(
      `${data.name} is at ${data.version}, but its newest release tag is ${newest || 'missing'}. ` +
        'Publish from the commit that records the release.',
    );
  }
}

const pending = packages.filter(({ data }) => publishedIntegrity(data.name, data.version) === null);
if (pending.length === 0) {
  process.stdout.write('Every Molen package version is already on npm.\n');
} else {
  const names = pending.map(({ data }) => `${data.name}@${data.version}`);
  process.stdout.write(`Publishing ${names.join(', ')}.\n`);
  // The versions were stamped after any earlier compile: ENGINE_VERSION, the shipped docs and the
  // sample templates all quote them.
  execCommand('pnpm', ['-r', '--filter', './packages/**', 'exec', 'tsdown'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  publishRelease(packRelease(pending));
}
