import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('lights pure metal from a reused sky environment on each available test backend', async () => {
  await promisify(execFile)(
    process.execPath,
    [resolve('test/visual/capture-sky-reflections.mjs')],
    {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  const report = JSON.parse(
    await readFile(resolve('../../.artifacts/sky-reflections-smoke/capture.json'), 'utf8'),
  );
  expect(report.ok).toBe(true);
  expect(report.results.length).toBe(process.env.MOLEN_SKIP_WEBGPU === '1' ? 1 : 2);
});
