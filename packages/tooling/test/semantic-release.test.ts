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

describe('fixed-line semantic release', () => {
  it('stamps every package and shipped version before ordering dependencies', () => {
    const root = fixture();
    const order = release.stampVersion('0.1.0', root);
    expect(order.map((item: { data: { name: string } }) => item.data.name)).toEqual([
      '@bendyline/molen-schema',
      '@bendyline/molen-kernel',
      '@bendyline/molen-client',
    ]);
    for (const directory of ['schema', 'kernel', 'client']) {
      const manifest = JSON.parse(
        readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8'),
      );
      expect(manifest.version).toBe('0.1.0');
    }
    expect(readFileSync(join(root, 'packages/kernel/src/version.ts'), 'utf8')).toContain("'0.1.0'");
    expect(readFileSync(join(root, 'docs-src/llms.txt'), 'utf8')).toContain(
      'Engine version: 0.1.0',
    );
    expect(readFileSync(join(root, 'docs-src/guide/determinism.md'), 'utf8')).toContain(
      '| `ENGINE_VERSION` | `0.1.0` |',
    );
  });

  it('rejects versions that break the shared package line', () => {
    const root = fixture();
    const clientPath = join(root, 'packages/client/package.json');
    const client = JSON.parse(readFileSync(clientPath, 'utf8'));
    client.version = '0.0.2';
    writeFileSync(clientPath, JSON.stringify(client));
    expect(() => release.releasePackages(root)).toThrow('must share one version');
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
        '0.1.0',
        new Set(['@bendyline/molen-schema', '@bendyline/molen-kernel']),
      ),
    ).toThrow('unresolved dependencies');
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
