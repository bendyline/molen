import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { it } from 'vitest';

it('keeps a sunlit cockpit steady in straight flight, low and in cruise', async () => {
  await promisify(execFile)(
    process.execPath,
    [resolve('test/visual/capture-cockpit-shadows.mjs')],
    { cwd: process.cwd(), timeout: 300000, maxBuffer: 2 * 1024 * 1024 },
  );
});
