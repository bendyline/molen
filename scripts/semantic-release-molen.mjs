// One semantic-release version and Git tag for the fixed @bendyline/molen-* line.
// Publish in prepare, before semantic-release pushes the tag: an interrupted publish can then
// be retried at the same version. Existing tarballs are skipped only if their integrity matches.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org';
const PACKAGE_PREFIX = '@bendyline/molen-';
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function manifest(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeManifest(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
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
  const versions = new Set(packages.map(({ data }) => data.version));
  if (versions.size !== 1) {
    throw new Error(`Molen packages must share one version; found ${[...versions].join(', ')}.`);
  }
  return packages;
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

export function stampVersion(version, root = ROOT) {
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid release version ${version}.`);
  const packages = releasePackages(root);
  for (const item of packages) {
    item.data.version = version;
    writeManifest(item.path, item.data);
  }

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
  return publicationOrder(packages);
}

export function checkPackedManifest(packed, version, names) {
  if (packed.version !== version) {
    throw new Error(`${packed.name} packs version ${packed.version}, expected ${version}.`);
  }
  if (packed.private === true || packed.publishConfig?.access !== 'public') {
    throw new Error(`${packed.name} must be a public npm package.`);
  }
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, specifier] of Object.entries(packed[field] ?? {})) {
      if (specifier.startsWith('workspace:') || specifier.startsWith('catalog:')) {
        throw new Error(`${packed.name} packs unresolved ${field} ${name}: ${specifier}.`);
      }
      if (names.has(name) && specifier !== version) {
        throw new Error(`${packed.name} packs ${name}@${specifier}, expected ${version}.`);
      }
    }
  }
}

export function packRelease(packages, version, root = ROOT) {
  const directory = join(root, '.artifacts/release');
  mkdirSync(directory, { recursive: true });
  const names = new Set(packages.map(({ data }) => data.name));
  return packages.map((item) => {
    const archive = join(directory, `${item.data.name.slice(1).replace('/', '-')}-${version}.tgz`);
    try {
      execFileSync('pnpm', ['pack', '--out', archive], { cwd: dirname(item.path) });
    } catch (error) {
      if (error.stdout) process.stderr.write(error.stdout);
      if (error.stderr) process.stderr.write(error.stderr);
      throw error;
    }
    const packed = JSON.parse(
      execFileSync('tar', ['-xOf', archive, 'package/package.json'], {
        encoding: 'utf8',
      }),
    );
    checkPackedManifest(packed, version, names);
    process.stdout.write(`Packed and validated ${packed.name}@${version}.\n`);
    return { ...item, archive };
  });
}

function publishedIntegrity(name, version) {
  const result = spawnSync(
    'npm',
    ['view', `${name}@${version}`, 'dist.integrity', '--json', `--registry=${REGISTRY}`],
    { encoding: 'utf8' },
  );
  if (result.status === 0) return JSON.parse(result.stdout.trim());
  if (result.stderr.includes('E404')) return null;
  throw new Error(`Could not inspect ${name}@${version} on npm: ${result.stderr.trim()}`);
}

export function publishRelease(packages, version) {
  for (const item of packages) {
    const local = `sha512-${createHash('sha512').update(readFileSync(item.archive)).digest('base64')}`;
    const remote = publishedIntegrity(item.data.name, version);
    if (remote !== null) {
      if (remote !== local) {
        throw new Error(
          `${item.data.name}@${version} already exists with different tarball integrity; ` +
            'inspect the partial release before retrying.',
        );
      }
      process.stdout.write(`Already published ${item.data.name}@${version}; integrity matches.\n`);
      continue;
    }
    execFileSync('npm', ['publish', item.archive, '--access', 'public', `--registry=${REGISTRY}`], {
      stdio: 'inherit',
    });
  }
}

export function verifyConditions() {
  const packages = releasePackages();
  const current = packages[0].data.version;
  const tag = `v${current}`;
  const tags = execFileSync('git', ['tag', '--merged', 'HEAD', '--list', tag], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (!tags) {
    throw new Error(
      `Molen needs a reachable ${tag} release tag before semantic-release can run. ` +
        'Bootstrap the current package versions, register their npm trusted publishers, and ' +
        `tag the published source commit ${tag}. See CONTRIBUTING.md.`,
    );
  }
  for (const item of packages) {
    if (publishedIntegrity(item.data.name, current) === null) {
      throw new Error(
        `${item.data.name}@${current} is not on npm. Publish the complete bootstrap version ` +
          'before using trusted publishing; see CONTRIBUTING.md.',
      );
    }
  }
}

export function prepare(_pluginConfig, { nextRelease }) {
  const version = nextRelease.version;
  process.stdout.write(`Preparing the fixed Molen release ${version}.\n`);
  const packages = stampVersion(version);
  execFileSync('pnpm', ['verify'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('pnpm', ['docs:site:build'], { cwd: ROOT, stdio: 'inherit' });
  const artifacts = packRelease(packages, version);
  publishRelease(artifacts, version);
}
