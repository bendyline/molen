import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const release = await import(resolve(__dirname, '../../../scripts/semantic-release-molen.mjs'));
const fixtures: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'molen-semantic-release-'));
  fixtures.push(root);
  for (const [directory, name, dependencies] of [
    ['schema', '@bendyline/molen-schema', {}],
    ['kernel', '@bendyline/molen-kernel', { '@bendyline/molen-schema': 'workspace:*' }],
    ['client', '@bendyline/molen-client', { '@bendyline/molen-kernel': 'workspace:*' }],
  ] as const) {
    mkdirSync(join(root, 'packages', directory), { recursive: true });
    writeFileSync(
      join(root, 'packages', directory, 'package.json'),
      JSON.stringify({ name, version: '0.0.1', publishConfig: { access: 'public' }, dependencies }),
    );
  }
  mkdirSync(join(root, 'packages/kernel/src'));
  writeFileSync(
    join(root, 'packages/kernel/src/version.ts'),
    "export const ENGINE_VERSION = '0.0.1';\n",
  );
  mkdirSync(join(root, 'docs-src'));
  writeFileSync(join(root, 'docs-src/llms.txt'), 'Engine version: 0.0.1. three.js pin: 0.184.0.\n');
  mkdirSync(join(root, 'docs-src/guide'));
  writeFileSync(
    join(root, 'docs-src/guide/determinism.md'),
    '| `ENGINE_VERSION` | `0.0.1` | engine metadata |\n',
  );
  return root;
}

/** A gzipped tarball of `files` under `package/`, as npm packs it. */
function tarball(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'molen-semantic-release-'));
  fixtures.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, 'package', path)), { recursive: true });
    writeFileSync(join(root, 'package', path), text);
  }
  const archive = join(root, 'package.tgz');
  // COPYFILE_DISABLE keeps macOS tar from adding AppleDouble `._*` twins.
  execFileSync('tar', ['-czf', archive, '-C', root, 'package'], {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  return archive;
}

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8');
const names = (packages: { data: { name: string } }[]) => packages.map((item) => item.data.name);

describe('per-package semantic release', () => {
  it('stamps the kernel and the engine version it ships, restoring workspace dependencies', () => {
    const root = fixture();
    const kernelPath = join(root, 'packages/kernel/package.json');
    const committed = JSON.parse(read(root, 'packages/kernel/package.json'));
    // multi-semantic-release pins workspace dependencies before the plugin's prepare step.
    writeFileSync(
      kernelPath,
      JSON.stringify({ ...committed, dependencies: { '@bendyline/molen-schema': '0.0.1' } }),
    );
    release.stampPackage(kernelPath, '0.1.0', committed, root);
    const kernel = JSON.parse(read(root, 'packages/kernel/package.json'));
    expect(kernel.version).toBe('0.1.0');
    expect(kernel.dependencies).toEqual({ '@bendyline/molen-schema': 'workspace:*' });
    expect(read(root, 'packages/kernel/src/version.ts')).toContain("'0.1.0'");
    expect(read(root, 'docs-src/llms.txt')).toContain('Engine version: 0.1.0');
    expect(read(root, 'docs-src/guide/determinism.md')).toContain('| `ENGINE_VERSION` | `0.1.0` |');
  });

  it('stamps another package without touching the engine version', () => {
    const root = fixture();
    const clientPath = join(root, 'packages/client/package.json');
    release.stampPackage(
      clientPath,
      '0.0.2',
      JSON.parse(read(root, 'packages/client/package.json')),
      root,
    );
    expect(JSON.parse(read(root, 'packages/client/package.json')).version).toBe('0.0.2');
    expect(JSON.parse(read(root, 'packages/schema/package.json')).version).toBe('0.0.1');
    expect(read(root, 'packages/kernel/src/version.ts')).toContain("'0.0.1'");
  });

  it('orders packages on different versions dependencies first', () => {
    const root = fixture();
    const clientPath = join(root, 'packages/client/package.json');
    release.stampPackage(
      clientPath,
      '0.3.0',
      JSON.parse(read(root, 'packages/client/package.json')),
      root,
    );
    const packages = release.releasePackages(root);
    expect(Object.fromEntries(release.packageVersions(packages))).toEqual({
      '@bendyline/molen-client': '0.3.0',
      '@bendyline/molen-kernel': '0.0.1',
      '@bendyline/molen-schema': '0.0.1',
    });
    expect(names(release.publicationOrder(packages))).toEqual([
      '@bendyline/molen-schema',
      '@bendyline/molen-kernel',
      '@bendyline/molen-client',
    ]);
  });

  it('rejects tarballs with unresolved workspace references', () => {
    expect(() =>
      release.checkPackedManifest(
        {
          name: '@bendyline/molen-kernel',
          version: '0.1.0',
          publishConfig: { access: 'public' },
          dependencies: { '@bendyline/molen-schema': 'workspace:*' },
        },
        new Map([
          ['@bendyline/molen-schema', '0.0.4'],
          ['@bendyline/molen-kernel', '0.1.0'],
        ]),
      ),
    ).toThrow('unresolved dependencies');
  });

  it('rejects tarballs pinning a sibling other than the version it carries', () => {
    const versions = new Map([
      ['@bendyline/molen-schema', '0.0.4'],
      ['@bendyline/molen-kernel', '0.1.0'],
    ]);
    const kernel = (schema: string) => ({
      name: '@bendyline/molen-kernel',
      version: '0.1.0',
      publishConfig: { access: 'public' },
      dependencies: { '@bendyline/molen-schema': schema },
    });
    expect(() => release.checkPackedManifest(kernel('0.0.4'), versions)).not.toThrow();
    expect(() => release.checkPackedManifest(kernel('0.1.0'), versions)).toThrow(
      'packs @bendyline/molen-schema@0.1.0, expected 0.0.4',
    );
  });

  it('rejects tooling whose templates would scaffold stale versions', () => {
    const versions = new Map([
      ['@bendyline/molen-kernel', '0.1.0'],
      ['@bendyline/molen-tooling', '0.0.7'],
    ]);
    const index = (scaffolded: Record<string, string>) => [
      {
        path: 'package/dist/templates/index.json',
        data: Buffer.from(JSON.stringify({ templates: [], versions: scaffolded })),
      },
    ];
    expect(() =>
      release.checkTemplateVersions(index(Object.fromEntries(versions)), versions),
    ).not.toThrow();
    const stale = { '@bendyline/molen-kernel': '0.0.9', '@bendyline/molen-tooling': '0.0.7' };
    expect(() => release.checkTemplateVersions(index(stale), versions)).toThrow(
      'would scaffold @bendyline/molen-kernel@0.0.9, expected 0.1.0',
    );
  });

  it('matches a repack whose workspace dependencies settled in another order', () => {
    const manifest = (dependencies: Record<string, string>) =>
      JSON.stringify({ name: '@bendyline/molen-terrain', version: '0.1.0', dependencies });
    const code = { 'dist/index.mjs': 'export {};\n' };
    const published = tarball({
      'package.json': manifest({ zod: '^4.0.0', '@bendyline/molen-kernel': '0.1.0', a: '1' }),
      ...code,
    });
    const repacked = tarball({
      'package.json': manifest({ a: '1', zod: '^4.0.0', '@bendyline/molen-kernel': '0.1.0' }),
      ...code,
    });
    expect(release.samePackedContent(repacked, published)).toBe(true);

    const versions = { '@bendyline/molen-kernel': '0.1.1', a: '1', zod: '^4.0.0' };
    const bumped = tarball({ 'package.json': manifest(versions), ...code });
    expect(release.samePackedContent(bumped, published)).toBe(false);
    const same = manifest({ a: '1', zod: '^4.0.0', '@bendyline/molen-kernel': '0.1.0' });
    const edited = tarball({ 'package.json': same, 'dist/index.mjs': 'export const x = 1;\n' });
    expect(release.samePackedContent(edited, published)).toBe(false);
    const extra = tarball({ 'package.json': same, ...code, 'dist/extra.mjs': '' });
    expect(release.samePackedContent(extra, published)).toBe(false);
  });
});
