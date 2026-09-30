// Get every Molen package ready for the Release workflow, from the owner's machine. Run it after
// `npm login`, on a clean checkout of main that matches origin/main.
//
// The workflow needs each package on npm (trusted publishing cannot create a package) and tagged
// `<name>@<version>` (semantic-release counts the next version from that tag; without one a
// package would start over at 1.0.0). For each package whose tag is not on origin yet, this:
//
//   - tags a version npm already has at the commit that released it: the `v<version>` tag from
//     when every package shared one version line;
//   - verifies, packs and publishes a version npm does not have (a new package), and tags this
//     commit.
//
// It then pushes the tags. Safe to rerun: a tag already on origin is left alone, and a version npm
// already has with the same tarball contents is not published again.
import { execFileSync } from 'node:child_process';
import { execCommand } from './exec-command.mjs';
import {
  packRelease,
  publicationOrder,
  publishedIntegrity,
  publishRelease,
  releasePackages,
  releaseTag,
} from './semantic-release-molen.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

// A tag must name exactly the source that is published, and that source must be on origin.
if (git('status', '--porcelain') !== '') {
  throw new Error('Commit or stash local changes first: the published source must be a commit.');
}
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') {
  throw new Error('Check out main first: packages are published from main.');
}
git('fetch', '--quiet', '--tags', 'origin', 'main');
const head = git('rev-parse', 'HEAD');
if (head !== git('rev-parse', 'origin/main')) {
  throw new Error(
    'main differs from origin/main: push or pull so the published commit is on origin.',
  );
}

const onOrigin = new Set(
  git('ls-remote', '--tags', '--refs', 'origin')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[1].slice('refs/tags/'.length)),
);

const tags = [];
const fresh = [];
for (const item of publicationOrder(releasePackages())) {
  const { name, version } = item.data;
  const tag = releaseTag(name, version);
  if (onOrigin.has(tag)) continue;
  if (publishedIntegrity(name, version) === null) {
    fresh.push(item);
    tags.push({ tag, commit: head });
    continue;
  }
  const legacy = `v${version}`;
  if (git('tag', '--list', legacy) === '') {
    throw new Error(
      `${name}@${version} is on npm, but neither ${tag} nor ${legacy} is tagged. ` +
        `Tag the commit that published it as ${tag}, then rerun.`,
    );
  }
  tags.push({ tag, commit: git('rev-parse', `${legacy}^{commit}`) });
}

for (const { tag, commit } of tags) {
  const local = git('tag', '--list', tag) === '' ? undefined : git('rev-parse', `${tag}^{commit}`);
  if (local !== undefined && local !== commit) {
    throw new Error(`A local ${tag} tag points at ${local}, not at ${commit}.`);
  }
}

if (tags.length === 0) {
  process.stdout.write('Every Molen package is tagged at its version on origin.\n');
} else {
  if (fresh.length > 0) {
    execCommand('pnpm', ['verify'], { stdio: 'inherit' });
    publishRelease(packRelease(fresh));
  }
  for (const { tag, commit } of tags) {
    if (git('tag', '--list', tag) === '') git('tag', tag, commit);
  }
  git('push', 'origin', ...tags.map(({ tag }) => `refs/tags/${tag}`));
  for (const { tag, commit } of tags) {
    process.stdout.write(`Tagged ${commit.slice(0, 12)} as ${tag} and pushed the tag.\n`);
  }
  if (fresh.length > 0) {
    const names = fresh.map(({ data }) => data.name).join(', ');
    process.stdout.write(
      `Next: add the GitHub Actions trusted publisher to ${names} on npmjs.com (see CONTRIBUTING.md).\n`,
    );
  }
}
