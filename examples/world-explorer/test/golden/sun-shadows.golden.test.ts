import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { it } from 'vitest';

it('keeps detailed sun shadows visible across startup and quality changes', async () => {
  await promisify(execFile)(process.execPath, [resolve('test/visual/capture-sun-shadows.mjs')], {
    cwd: process.cwd(),
    timeout: 120000,
    maxBuffer: 2 * 1024 * 1024,
  });
});
