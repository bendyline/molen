// One-time first publish of 0.0.1 from the owner's machine, which the Release workflow continues
// from. Run it after `npm login`, on a clean checkout of main that matches origin/main.
//
// It verifies, packs and publishes every package, then tags the published commit v0.0.1 and pushes
// that tag. semantic-release reads the previous version from the tag, so later releases continue
// the 0.x line; after this, the Release workflow creates every tag itself.
//
// Safe to rerun after a partial publish: a package already on npm with the same tarball is
// skipped, and a v0.0.1 tag already on this commit is left as it is.
import { execFileSync } from 'node:child_process';
import {
  packRelease,
  publicationOrder,
  publishRelease,
  releasePackages,
} from './semantic-release-molen.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const packages = publicationOrder(releasePackages());
const version = packages[0].data.version;
if (version !== '0.0.1') {
  throw new Error(`Bootstrap publishing is only for the initial 0.0.1 release, found ${version}.`);
}
const tag = `v${version}`;

// The tag must name exactly the source that is published, and that source must be on origin.
if (git('status', '--porcelain') !== '') {
  throw new Error('Commit or stash local changes first: the published source must be a commit.');
}
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') {
  throw new Error('Check out main first: the first release is published from main.');
}
git('fetch', '--quiet', 'origin', 'main');
const head = git('rev-parse', 'HEAD');
if (head !== git('rev-parse', 'origin/main')) {
  throw new Error(
    'main differs from origin/main: push or pull so the published commit is on origin.',
  );
}

/** The commit a tag names on origin (peeled, for an annotated tag), or undefined. */
function remoteTag(name) {
  const lines = git('ls-remote', '--tags', 'origin', `refs/tags/${name}`, `refs/tags/${name}^{}`)
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));
  const peeled = lines.find(([, ref]) => ref.endsWith('^{}')) ?? lines[0];
  return peeled?.[0];
}
const tagged = remoteTag(tag);
if (tagged !== undefined && tagged !== head) {
  throw new Error(`${tag} already exists on origin at ${tagged}, not at this commit (${head}).`);
}
const local = git('tag', '--list', tag) === '' ? undefined : git('rev-parse', `${tag}^{commit}`);
if (local !== undefined && local !== head) {
  throw new Error(`A local ${tag} tag points at ${local}, not at this commit (${head}).`);
}

execFileSync('pnpm', ['verify'], { stdio: 'inherit' });
publishRelease(packRelease(packages, version), version);

if (tagged === undefined) {
  if (local === undefined) git('tag', tag, head);
  git('push', 'origin', `refs/tags/${tag}`);
  process.stdout.write(`Tagged ${head} as ${tag} and pushed the tag.\n`);
} else {
  process.stdout.write(`${tag} is already on origin at this commit.\n`);
}
process.stdout.write(
  'Next: add the GitHub Actions trusted publisher to each package on npmjs.com (see CONTRIBUTING.md).\n',
);
