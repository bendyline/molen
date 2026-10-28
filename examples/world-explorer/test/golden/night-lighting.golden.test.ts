import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { it } from 'vitest';

it('renders dusk window and road lighting with daytime restoration on both backends and worker paths', async () => {
  await promisify(execFile)(process.execPath, [resolve('test/visual/capture-night-lighting.mjs')], {
    cwd: process.cwd(),
    env: process.env,
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
  });
});
