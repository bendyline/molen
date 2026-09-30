#!/usr/bin/env node
// Publish every Molen package version npm does not have yet, dependencies first. The Release
// workflow runs this after multi-semantic-release has stamped and tagged the new versions (see
// semantic-release-molen.mjs). If publishing stops partway, rerun the Release workflow: there is
// nothing new to version, and this publishes the versions still missing from npm.
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
  // The versions were stamped after the workflow's first build: rebuild, verify, and rebuild the
  // docs site that quotes the engine version.
  execCommand('pnpm', ['verify'], { cwd: ROOT, stdio: 'inherit' });
  execCommand('pnpm', ['docs:site:build'], { cwd: ROOT, stdio: 'inherit' });
  publishRelease(packRelease(pending));
}
