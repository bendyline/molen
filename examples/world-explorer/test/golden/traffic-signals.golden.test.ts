import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { it } from 'vitest';

it('renders overhead traffic lights and changing luminous lenses through both surface paths', async () => {
  await promisify(execFile)(
    process.execPath,
    [resolve('test/visual/capture-traffic-signals.mjs')],
    {
      cwd: process.cwd(),
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
});
