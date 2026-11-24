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

const steps = (...commands: string[]) => commands.map((command) => `- run: ${command}\n`).join('');
const RELEASE = steps('node scripts/require-green-ci.mjs', 'pnpm exec multi-semantic-release');
const SITE = steps(
  'node scripts/require-green-ci.mjs',
  'pnpm build',
  'node scripts/publish-pack-release.mjs',
);
const CI = steps('pnpm lint', 'pnpm -r typecheck');

/** A repository with the checker and the given workflows; `undefined` leaves the directory out. */
function fixture(workflows?: Record<string, string>): string {
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
  if (workflows !== undefined) {
    const dir = join(root, '.github/workflows');
    mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(workflows)) writeFileSync(join(dir, name), text);
  }
  return root;
}

const complete = (changes: Record<string, string> = {}) =>
  fixture({ 'release.yml': RELEASE, 'site.yml': SITE, 'ci.yml': CI, ...changes });

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

  it('requires the workflows in CI, and wherever any workflow metadata is present', () => {
    expect(() => run(fixture(), 'true')).toThrow('missing .github/workflows/release.yml');
    expect(() => run(fixture({}))).toThrow('missing .github/workflows/release.yml');
    const noCi = fixture({ 'release.yml': RELEASE, 'site.yml': SITE });
    expect(() => run(noCi)).toThrow('missing .github/workflows/ci.yml');
  });

  it('accepts a gated release whose checks CI runs, through scripts and lifecycle hooks', () => {
    expect(run(complete(), 'true')).toContain('CI runs all 2 checks of `pnpm verify`');
  });

  it('rejects a workflow script missing from pnpm all', () => {
    const ci = complete({ 'ci.yml': CI + steps('pnpm test:unit') });
    expect(() => run(ci)).toThrow('ci.yml runs `pnpm test:unit`, which `pnpm all` does not');
    const site = complete({ 'site.yml': SITE + steps('pnpm test:unit') });
    expect(() => run(site)).toThrow('site.yml runs `pnpm test:unit`');
    // A wrapper does not hide the script it runs.
    const wrapped = complete({ 'ci.yml': CI + steps('node scripts/wrap.mjs -- pnpm test:unit') });
    expect(() => run(wrapped)).toThrow('ci.yml runs `pnpm test:unit`');
  });

  it('rejects a check of pnpm verify that CI does not run', () => {
    const missing = complete({ 'ci.yml': steps('pnpm lint') });
    expect(() => run(missing)).toThrow('`pnpm verify` runs `pnpm typecheck`, but no step of');
    // A commented-out step is not a step.
    const commented = complete({ 'ci.yml': `${steps('pnpm lint')}# - run: pnpm -r typecheck\n` });
    expect(() => run(commented)).toThrow('`pnpm verify` runs `pnpm typecheck`');
  });

  it('counts checks inside block scalars and the reusable workflows CI calls', () => {
    const block = complete({
      'ci.yml': `${steps('pnpm lint')}- run: |\n    echo first\n    pnpm -r typecheck\n- id: last\n`,
    });
    expect(run(block)).toContain('CI runs all 2 checks');
    const called = complete({
      'ci.yml': `${steps('pnpm lint')}types:\n  uses: ./.github/workflows/types.yml\n`,
      'types.yml': steps('pnpm -r typecheck'),
    });
    expect(run(called)).toContain('CI runs all 2 checks');
  });

  it('rejects a release or site that does not require green CI first', () => {
    const ungated = complete({ 'release.yml': steps('pnpm exec multi-semantic-release') });
    expect(() => run(ungated)).toThrow(
      'release.yml never runs `node scripts/require-green-ci.mjs`',
    );
    const late = complete({
      'site.yml': steps(
        'node scripts/publish-pack-release.mjs',
        'node scripts/require-green-ci.mjs',
      ),
    });
    expect(() => run(late)).toThrow('site.yml runs publish-pack-release.mjs before');
  });

  it('still rejects a workflow without run steps', () => {
    expect(() => run(complete({ 'release.yml': 'name: Release\n' }))).toThrow(
      'no `run:` steps found',
    );
  });
});
