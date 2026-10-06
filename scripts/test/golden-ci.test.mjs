import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { goldenBuildPlan } from '../build-golden.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const wrapper = join(root, 'scripts/run-golden-diagnostics.mjs');

test('builds shared packs once, discovers golden examples and preserves custom build hooks', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'molen-golden-plan-'));
  try {
    for (const [name, scripts] of Object.entries({
      explorer: {
        build: 'vite build',
        prebuild: 'node scripts/build-content-packs.mjs',
        'test:golden': 'vitest run',
      },
      earth: {
        build: 'vite build',
        prebuild: 'node ../world-explorer/scripts/build-content-packs.mjs',
        'test:golden': 'vitest run',
      },
      custom: {
        build: 'vite build',
        prebuild: 'node scripts/build-content-packs.mjs && node extra.mjs',
        'test:golden': 'vitest run',
      },
      gallery: { build: 'vite build' },
      post: { build: 'vite build', postbuild: 'node verify.mjs', 'test:golden': 'vitest run' },
    })) {
      await mkdir(join(repo, 'examples', name), { recursive: true });
      await writeFile(
        join(repo, 'examples', name, 'package.json'),
        JSON.stringify({ name: `@bendyline/molen-examples-${name}`, scripts }),
      );
    }
    await mkdir(join(repo, 'examples', 'notes'));
    const plan = await goldenBuildPlan(repo);
    assert.deepEqual(plan[0].args, ['-r', '--filter', './packages/**', 'build']);
    assert.equal(plan.filter((step) => step.command === process.execPath).length, 1);
    assert.deepEqual(
      plan.slice(2).map((step) => step.args),
      [
        ['--filter', '@bendyline/molen-examples-custom', 'run', 'build'],
        ['--filter', '@bendyline/molen-examples-earth', 'exec', 'vite', 'build'],
        ['--filter', '@bendyline/molen-examples-explorer', 'exec', 'vite', 'build'],
        ['--filter', '@bendyline/molen-examples-post', 'run', 'build'],
      ],
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

function diagnosticRun(out, code) {
  const child = spawn(process.execPath, [wrapper, '--', process.execPath, '-e', code], {
    cwd: root,
    env: { ...process.env, MOLEN_GOLDEN_DIAGNOSTICS_DIR: out },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const completed = new Promise((done, reject) => {
    child.once('error', reject);
    child.once('close', (status) => done({ status, stdout, stderr }));
  });
  return { child, completed };
}

test('diagnostics retain both output streams and the original failing exit code', async () => {
  const out = await mkdtemp(join(tmpdir(), 'molen-golden-diagnostics-'));
  try {
    const { completed } = diagnosticRun(
      out,
      "console.log('test output'); console.error('test failure'); process.exitCode = 7;",
    );
    const result = await completed;
    assert.equal(result.status, 7);
    assert.match(result.stdout, /test output/);
    assert.match(result.stderr, /test failure/);
    const tests = await readFile(join(out, 'tests.log'), 'utf8');
    assert.match(tests, /test output/);
    assert.match(tests, /test failure/);
    const resources = await readFile(join(out, 'resources.log'), 'utf8');
    assert.match(resources, /"reason":"start"/);
    assert.match(resources, /"reason":"end"/);
    assert.match(resources, /"code":7/);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test('canceling diagnostics stops the command and records a cancellation exit', {
  skip: process.platform === 'win32',
  timeout: 15_000,
}, async () => {
  const out = await mkdtemp(join(tmpdir(), 'molen-golden-cancel-'));
  const { child, completed } = diagnosticRun(
    out,
    "process.on('SIGTERM', () => { console.log('child stopped'); process.exit(0); }); console.log('child ready'); setInterval(() => {}, 1000);",
  );
  try {
    await new Promise((ready) => {
      child.stdout.on('data', (chunk) => {
        if (chunk.toString().includes('child ready')) ready();
      });
    });
    child.kill('SIGTERM');
    const result = await completed;
    assert.equal(result.status, 143);
    assert.match(result.stdout, /child stopped/);
    const resources = await readFile(join(out, 'resources.log'), 'utf8');
    assert.match(resources, /\[golden:signal\].*SIGTERM/);
    assert.match(resources, /"reason":"SIGTERM"/);
    assert.match(resources, /"reason":"end"/);
  } finally {
    child.kill('SIGTERM');
    await completed;
    await rm(out, { recursive: true, force: true });
  }
});
