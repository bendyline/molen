import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { it } from 'vitest';

it('detects and renders the road-sign catalog and supports gallery inspection', async () => {
  await promisify(execFile)(
    process.execPath,
    [resolve('test/visual/capture-road-sign-gallery.mjs')],
    {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
});
