#!/usr/bin/env node
// Stage the release metadata the Release workflow commits to main, and print the release tags for
// the commit message. A package's stamped manifest and changelog (and, for the kernel, the
// ENGINE_VERSION stamps) go in only when its release tag reached GitHub at this commit.
//
// The commit step runs even when versioning stopped partway. In run 43504403985 GitHub refused the
// tag of @bendyline/molen-input-react@0.0.14 after six packages were tagged; committing its stamp
// recorded a release that never happened, and the next run would have written a second 0.0.14
// section into its changelog. Left out, the next run versions it again from its newest tag on
// GitHub, as if this run had never reached it.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { releasePackages, releaseTag } from './semantic-release-molen.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KERNEL = '@bendyline/molen-kernel';
/** Files outside the kernel's directory that its prepare step stamps with ENGINE_VERSION. */
export const KERNEL_STAMPS = [
  'packages/kernel/src/version.ts',
  'docs-src/llms.txt',
  'docs-src/guide/determinism.md',
];

/** Tag name to commit, from `git ls-remote --tags` output; annotated tags are peeled. */
export function remoteTags(listing) {
  const tags = new Map();
  for (const line of listing.split('\n')) {
    const [object, ref] = line.trim().split(/\s+/);
    if (!ref?.startsWith('refs/tags/')) continue;
    const name = ref.slice('refs/tags/'.length);
    if (name.endsWith('^{}')) tags.set(name.slice(0, -'^{}'.length), object);
    else if (!tags.has(name)) tags.set(name, object);
  }
  return tags;
}

/**
 * What to commit for `packages`, given the release tags on GitHub (`tags`, name to commit), the
 * commit the release ran on (`head`), and each package's committed version (`committed`, name to
 * version). A package released when GitHub has the tag of its version on disk at `head`.
 * `unreleased` names the packages stamped with a version GitHub has no such tag for.
 */
export function releasedMetadata(packages, tags, head, committed) {
  const released = [];
  const unreleased = [];
  for (const item of packages) {
    const tag = releaseTag(item.data.name, item.data.version);
    if (tags.get(tag) === head) released.push(item);
    else if (committed.get(item.data.name) !== item.data.version) unreleased.push(tag);
  }
  return {
    tags: released.map(({ data }) => releaseTag(data.name, data.version)),
    paths: released.flatMap(({ directory, data }) => [
      `packages/${directory}/package.json`,
      `packages/${directory}/CHANGELOG.md`,
      ...(data.name === KERNEL ? KERNEL_STAMPS : []),
    ]),
    unreleased,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  const packages = releasePackages();
  const committed = new Map(
    packages.map(({ directory, data }) => [
      data.name,
      JSON.parse(git('show', `HEAD:packages/${directory}/package.json`)).version,
    ]),
  );
  const { tags, paths, unreleased } = releasedMetadata(
    packages,
    remoteTags(git('ls-remote', '--tags', 'origin', 'refs/tags/@bendyline/molen-*')),
    git('rev-parse', 'HEAD'),
    committed,
  );
  for (const tag of unreleased) {
    process.stderr.write(
      `::warning::${tag} was stamped, but GitHub has no such tag at this commit. It stays out of ` +
        'the release commit; the next Release run versions the package again.\n',
    );
  }
  const present = paths.filter((path) => existsSync(join(ROOT, path)));
  if (present.length > 0) git('add', '--', ...present);
  process.stdout.write(tags.map((tag) => `- ${tag}\n`).join(''));
}
