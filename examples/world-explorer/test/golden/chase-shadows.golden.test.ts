import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { it } from 'vitest';

it('keeps the driven car’s shadow on the road the same shape at speed, on High and Medium', async () => {
  await promisify(execFile)(process.execPath, [resolve('test/visual/capture-chase-shadows.mjs')], {
    cwd: process.cwd(),
    timeout: 300000,
    maxBuffer: 2 * 1024 * 1024,
  });
});
