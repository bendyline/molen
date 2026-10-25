import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { it } from 'vitest';

it.each([
  'right',
  'left',
])('renders %s-driving traffic lights and luminous lenses through both surface paths', async (drivingSide) => {
  await promisify(execFile)(
    process.execPath,
    [resolve('test/visual/capture-traffic-signals.mjs')],
    {
      cwd: process.cwd(),
      env: { ...process.env, MOLEN_TRAFFIC_SIDE: drivingSide },
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
});
