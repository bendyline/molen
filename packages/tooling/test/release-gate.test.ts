import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const CHECKER = resolve(__dirname, '../../../scripts/check-release-gate.mjs');
const fixtures: string[] = [];

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(workflow?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'molen-release-gate-'));
  fixtures.push(root);
  mkdirSync(join(root, 'scripts'));
  copyFileSync(CHECKER, join(root, 'scripts/check-release-gate.mjs'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      scripts: {
        all: 'pnpm verify',
        verify: 'pnpm lint && pnpm typecheck',
        lint: 'biome check .',
        pretypecheck: 'pnpm build',
        typecheck: 'tsc',
        build: 'tsdown',
        'test:unit': 'vitest run',
      },
    }),
  );
  if (workflow !== undefined) {
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    writeFileSync(join(root, '.github/workflows/release.yml'), workflow);
  }
  return root;
}

function run(root: string, ci = ''): string {
  return execFileSync(process.execPath, [join(root, 'scripts/check-release-gate.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, CI: ci },
    stdio: 'pipe',
  });
}

describe('release gate script', () => {
  it('allows a local source copy without GitHub workflows', () => {
    const root = fixture();
    expect(run(root)).toContain('skipped (this source checkout has no .github/workflows)');
    expect(run(root, 'false')).toContain('skipped');
  });

  it('requires the release workflow in CI', () => {
    expect(() => run(fixture(), 'true')).toThrow('missing .github/workflows/release.yml');
  });

  it('rejects a missing release file when other workflow metadata is present', () => {
    const root = fixture();
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    expect(() => run(root)).toThrow('missing .github/workflows/release.yml');
  });

  it('checks the workflow against transitive scripts and lifecycle hooks', () => {
    const root = fixture('- run: pnpm verify\n- run: pnpm build\n');
    expect(run(root, 'true')).toContain('all reachable from `pnpm all`');
  });

  it('still rejects a release check missing from pnpm all', () => {
    const root = fixture('- run: pnpm verify\n- run: pnpm test:unit\n');
    expect(() => run(root)).toThrow('runs checks that `pnpm all` does not');
  });

  it('still rejects a workflow without run steps', () => {
    expect(() => run(fixture('name: Release\n'))).toThrow('no `run:` steps found');
  });
});
