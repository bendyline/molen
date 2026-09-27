import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

// An actual-asset rendering smoke check, with geometry/placement assertions in the driver.
// Unlike the pixel goldens, it tolerates harmless lighting variation between GPU drivers.
it('renders mapped windmill and turbine GLBs and retains buildings without map evidence', async () => {
  // Regression runs must not overwrite the hash-bound authoring review captures.
  const out = resolve('.artifacts/map-structures-golden');
  await promisify(execFile)(
    process.execPath,
    [resolve('test/visual/capture-map-structures.mjs'), '--out-dir', out],
    {
      cwd: process.cwd(),
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  const result = JSON.parse(await readFile(resolve(out, 'capture.json'), 'utf8'));
  expect(result.ok).toBe(true);
  expect(result.errors).toEqual([]);
  expect(result.frames.map((frame: { name: string }) => frame.name)).toEqual([
    'overview',
    'windmill',
    'mill-materials',
    'mill-gallery',
    'turbine',
    'turbine-base',
    'turbine-nacelle',
    'missing-tags',
  ]);
});
