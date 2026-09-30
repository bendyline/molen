// The Molen plugin for multi-semantic-release. Each @bendyline/molen-* package has its own version
// line: it releases when a commit touches it, or when a Molen package it depends on releases, so a
// published dependent always pins its dependencies' newest versions. Each package's prepare step
// stamps its next version (the kernel's also stamps ENGINE_VERSION). Nothing publishes here:
// scripts/publish-release.mjs packs and publishes every version npm does not have yet, dependencies
// first, once all are stamped. Existing tarballs are skipped only if their contents match, so an
// interrupted publish can be retried at the same versions.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkTarballEntries, tarballFiles } from './check-package-contents.mjs';
import { execCommand, spawnCommand } from './exec-command.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org';
const PACKAGE_PREFIX = '@bendyline/molen-';
const KERNEL = '@bendyline/molen-kernel';
const TOOLING = '@bendyline/molen-tooling';
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

function manifest(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeManifest(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function git(args, root = ROOT) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function releasePackages(root = ROOT) {
  const packages = readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((directory) => {
      const path = join(root, 'packages', directory, 'package.json');
      const data = manifest(path);
      return { directory, path, data };
    })
    .filter(({ data }) => data.private !== true && data.name?.startsWith(PACKAGE_PREFIX));

  if (packages.length === 0) throw new Error('No publishable Molen packages found.');
  return packages;
}

/** Each package's name mapped to the version its manifest carries. */
export function packageVersions(packages) {
  return new Map(packages.map(({ data }) => [data.name, data.version]));
}

/** The tag multi-semantic-release gives one package version. */
export function releaseTag(name, version) {
  return `${name}@${version}`;
}

export function publicationOrder(packages) {
  const byName = new Map(packages.map((item) => [item.data.name, item]));
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(item) {
    const name = item.data.name;
    if (visiting.has(name)) throw new Error(`Cycle in Molen package dependencies at ${name}.`);
    if (visited.has(name)) return;
    visiting.add(name);
    const dependencies = {
      ...item.data.dependencies,
      ...item.data.optionalDependencies,
      ...item.data.peerDependencies,
    };
    for (const dependency of Object.keys(dependencies).sort()) {
      const sibling = byName.get(dependency);
      if (sibling) visit(sibling);
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(item);
  }

  for (const item of packages) visit(item);
  return sorted;
}

/** Stamp the kernel's version as ENGINE_VERSION and into the shipped docs that quote it. */
export function stampEngineVersion(version, root = ROOT) {
  const kernelVersionPath = join(root, 'packages/kernel/src/version.ts');
  const source = readFileSync(kernelVersionPath, 'utf8');
  const updated = source.replace(
    /export const ENGINE_VERSION = '[^']+';/,
    `export const ENGINE_VERSION = '${version}';`,
  );
  if (updated === source && !source.includes(`export const ENGINE_VERSION = '${version}';`)) {
    throw new Error('Could not stamp ENGINE_VERSION in packages/kernel/src/version.ts.');
  }
  writeFileSync(kernelVersionPath, updated);

  const docsPath = join(root, 'docs-src/llms.txt');
  const docs = readFileSync(docsPath, 'utf8');
  const stamped = docs.replace(
    /Engine version: \d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/,
    `Engine version: ${version}`,
  );
  if (stamped === docs && !docs.includes(`Engine version: ${version}`)) {
    throw new Error('Could not stamp the engine version in docs-src/llms.txt.');
  }
  writeFileSync(docsPath, stamped);

  const guidePath = join(root, 'docs-src/guide/determinism.md');
  const guide = readFileSync(guidePath, 'utf8');
  const updatedGuide = guide.replace(
    /(\| `ENGINE_VERSION` \| `)[^`]+(` \|)/,
    (_match, before, after) => `${before}${version}${after}`,
  );
  if (updatedGuide === guide && !guide.includes(`| \`ENGINE_VERSION\` | \`${version}\` |`)) {
    throw new Error('Could not stamp the current engine version in the determinism guide.');
  }
  writeFileSync(guidePath, updatedGuide);
}

/**
 * Stamp one package's next version. multi-semantic-release has just replaced its `workspace:`
 * dependencies with concrete versions; the specifiers in `committed` (the manifest as committed)
 * go back, so the release commit keeps the workspace protocol and `pnpm pack` pins each sibling to
 * the version on disk once every package is stamped.
 */
export function stampPackage(path, version, committed, root = ROOT) {
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid release version ${version}.`);
  const data = manifest(path);
  data.version = version;
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, specifier] of Object.entries(committed[field] ?? {})) {
      if (specifier.startsWith('workspace:')) data[field] = { ...data[field], [name]: specifier };
    }
  }
  writeManifest(path, data);
  if (data.name === KERNEL) stampEngineVersion(version, root);
}

/**
 * Paths outside its own directory that a package ships. multi-semantic-release only counts
 * commits under the package directory; tooling also bundles the docs and the sample templates.
 */
export async function shippedSources(name, root = ROOT) {
  if (name !== TOOLING) return [];
  const script = pathToFileURL(join(root, 'packages/tooling/scripts/build-templates.mjs'));
  const { TEMPLATES } = await import(script.href);
  return ['docs-src', 'examples/game-shell.css', ...TEMPLATES.map((id) => `examples/${id}`)];
}

/** Commits after `since` (or in all history) touching any of `paths`, as semantic-release has them. */
function commitsTouching(paths, since) {
  const range = since ? `${since}..HEAD` : 'HEAD';
  return git(['log', '--format=%H%x1f%B%x1e', range, '--', ...paths])
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, message] = entry.split('\x1f');
      return { hash, message: message.trim() };
    });
}

/** multi-semantic-release runs semantic-release once per package, with cwd at its directory. */
function packageAt(cwd) {
  const item = releasePackages().find(({ path }) => dirname(path) === resolve(cwd));
  if (item === undefined) throw new Error(`${cwd} is not a publishable Molen package.`);
  return item;
}

/** Whether npm has any version of the package. */
function onNpm(name) {
  const result = spawnCommand('npm', ['view', name, 'name', `--registry=${REGISTRY}`], {
    encoding: 'utf8',
  });
  if (result.status === 0) return true;
  if (result.stderr.includes('E404')) return false;
  throw new Error(`Could not inspect ${name} on npm: ${result.stderr.trim()}`);
}

export function verifyConditions(_pluginConfig, { cwd }) {
  const { name } = packageAt(cwd).data;
  // Trusted publishing cannot create a package, and without a release tag semantic-release would
  // take the package for a first release at 1.0.0.
  const missing = [
    ...(onNpm(name) ? [] : ['on npm']),
    ...(git(['tag', '--merged', 'HEAD', '--list', releaseTag(name, '*')]) === ''
      ? [`tagged ${releaseTag(name, '<version>')}`]
      : []),
  ];
  if (missing.length > 0) {
    throw new Error(
      `${name} is not ${missing.join(' or ')} yet. Run \`pnpm release:bootstrap\` on main; see ` +
        'CONTRIBUTING.md.',
    );
  }
}

/** The commit analyzer's options in .releaserc.cjs, so shipped sources count by the same rules. */
function commitAnalyzerOptions() {
  const { plugins } = createRequire(import.meta.url)('../.releaserc.cjs');
  const entry = plugins.find(
    (plugin) => [plugin].flat()[0] === '@semantic-release/commit-analyzer',
  );
  return [entry].flat()[1] ?? {};
}

export async function analyzeCommits(_pluginConfig, context) {
  const paths = await shippedSources(packageAt(context.cwd).data.name);
  if (paths.length === 0) return null;
  const commits = commitsTouching(paths, context.lastRelease?.gitHead);
  if (commits.length === 0) return null;
  const { analyzeCommits: analyze } = await import('@semantic-release/commit-analyzer');
  return analyze(commitAnalyzerOptions(), { ...context, commits });
}

export function prepare(_pluginConfig, { cwd, nextRelease, logger }) {
  const { path, data } = packageAt(cwd);
  const committed = JSON.parse(git(['show', `HEAD:${relative(ROOT, path).split(sep).join('/')}`]));
  stampPackage(path, nextRelease.version, committed);
  logger.log(`Stamped ${data.name}@${nextRelease.version}.`);
}

/**
 * Every Molen dependency in a packed manifest must be pinned to exactly the version its package
 * carries in `versions`: the version this release publishes, or the one already on npm.
 */
export function checkPackedManifest(packed, versions) {
  const expected = versions.get(packed.name);
  if (packed.version !== expected) {
    throw new Error(`${packed.name} packs version ${packed.version}, expected ${expected}.`);
  }
  if (packed.private === true || packed.publishConfig?.access !== 'public') {
    throw new Error(`${packed.name} must be a public npm package.`);
  }
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, specifier] of Object.entries(packed[field] ?? {})) {
      if (specifier.startsWith('workspace:') || specifier.startsWith('catalog:')) {
        throw new Error(`${packed.name} packs unresolved ${field} ${name}: ${specifier}.`);
      }
      const pinned = versions.get(name);
      if (pinned !== undefined && specifier !== pinned) {
        throw new Error(`${packed.name} packs ${name}@${specifier}, expected ${pinned}.`);
      }
    }
  }
}

/** Tooling's templates must scaffold projects on the versions being published, not stale ones. */
export function checkTemplateVersions(files, versions) {
  const index = files.find(({ path }) => path === 'package/dist/templates/index.json');
  if (index === undefined) throw new Error(`${TOOLING} packs no dist/templates/index.json.`);
  const scaffolded = JSON.parse(index.data.toString('utf8')).versions ?? {};
  for (const [name, version] of versions) {
    if (scaffolded[name] !== version) {
      throw new Error(
        `${TOOLING} would scaffold ${name}@${scaffolded[name]}, expected ${version}. ` +
          'Rebuild tooling after the versions change.',
      );
    }
  }
}

/** Pack and check `packages` against the versions every Molen package carries on disk. */
export function packRelease(packages, versions = packageVersions(releasePackages()), root = ROOT) {
  const directory = join(root, '.artifacts/release');
  mkdirSync(directory, { recursive: true });
  return packages.map((item) => {
    const { name, version } = item.data;
    const archive = join(directory, `${name.slice(1).replace('/', '-')}-${version}.tgz`);
    try {
      execCommand('pnpm', ['pack', '--out', archive], { cwd: dirname(item.path) });
    } catch (error) {
      if (error.stdout) process.stderr.write(error.stdout);
      if (error.stderr) process.stderr.write(error.stderr);
      throw error;
    }
    const files = tarballFiles(archive);
    const packed = JSON.parse(
      files.find(({ path }) => path === 'package/package.json').data.toString('utf8'),
    );
    checkPackedManifest(packed, versions);
    if (packed.name === TOOLING) checkTemplateVersions(files, versions);
    const content = checkTarballEntries(packed.name, files, dirname(item.path));
    if (content.length > 0) {
      throw new Error(`${packed.name} would publish content:\n  ${content.join('\n  ')}`);
    }
    process.stdout.write(`Packed and validated ${packed.name}@${version}.\n`);
    return { ...item, archive };
  });
}

/** npm's integrity for name@version, or null when npm does not have that version. */
export function publishedIntegrity(name, version) {
  const result = spawnCommand(
    'npm',
    ['view', `${name}@${version}`, 'dist.integrity', '--json', `--registry=${REGISTRY}`],
    { encoding: 'utf8' },
  );
  if (result.status === 0) {
    const output = result.stdout.trim();
    return output === '' ? null : JSON.parse(output);
  }
  if (result.stderr.includes('E404')) return null;
  throw new Error(`Could not inspect ${name}@${version} on npm: ${result.stderr.trim()}`);
}

/**
 * A packed package.json with its dependency maps sorted. pnpm resolves `workspace:` specifiers
 * concurrently and writes each back as it settles, so two packs of one commit can order those
 * keys differently; the order carries no meaning.
 */
function canonicalManifest(data) {
  const manifest = JSON.parse(data.toString('utf8'));
  for (const field of DEPENDENCY_FIELDS) {
    if (manifest[field] === undefined) continue;
    const sorted = Object.keys(manifest[field]).sort();
    manifest[field] = Object.fromEntries(sorted.map((name) => [name, manifest[field][name]]));
  }
  return JSON.stringify(manifest);
}

/** Whether two tarballs hold the same files byte for byte, up to dependency key order. */
export function samePackedContent(archive, other) {
  const files = new Map(tarballFiles(archive).map(({ path, data }) => [path, data]));
  const others = tarballFiles(other);
  if (others.length !== files.size) return false;
  return others.every(({ path, data }) => {
    const mine = files.get(path);
    if (mine === undefined) return false;
    if (path !== 'package/package.json') return mine.equals(data);
    return canonicalManifest(mine) === canonicalManifest(data);
  });
}

/** Download the published tarball of name@version beside the local archive; returns its path. */
function publishedArchive(name, version, archive) {
  const directory = join(dirname(archive), 'published');
  mkdirSync(directory, { recursive: true });
  const [packed] = JSON.parse(
    execCommand(
      'npm',
      [
        'pack',
        `${name}@${version}`,
        '--json',
        `--pack-destination=${directory}`,
        `--registry=${REGISTRY}`,
      ],
      { encoding: 'utf8' },
    ),
  );
  return join(directory, packed.filename);
}

/** Publish packed `packages` in order, skipping a version npm already has with these contents. */
export function publishRelease(packages) {
  for (const item of packages) {
    const { name, version } = item.data;
    const local = `sha512-${createHash('sha512').update(readFileSync(item.archive)).digest('base64')}`;
    const remote = publishedIntegrity(name, version);
    if (remote !== null) {
      if (remote === local) {
        process.stdout.write(`Already published ${name}@${version}; integrity matches.\n`);
        continue;
      }
      // A repack of the same commit can differ in bytes only (see canonicalManifest).
      const published = publishedArchive(name, version, item.archive);
      if (!samePackedContent(item.archive, published)) {
        throw new Error(
          `${name}@${version} already exists with different contents; ` +
            `inspect the partial release (published tarball: ${published}) before retrying.`,
        );
      }
      process.stdout.write(`Already published ${name}@${version}; contents match.\n`);
      continue;
    }
    execCommand('npm', ['publish', item.archive, '--access', 'public', `--registry=${REGISTRY}`], {
      stdio: 'inherit',
    });
  }
}
