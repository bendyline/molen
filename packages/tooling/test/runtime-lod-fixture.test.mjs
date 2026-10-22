import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

it('isolates rebuilt sidecars and GLBs from the installation and other test fixtures', async () => {
  const installed = await mkdtemp(join(tmpdir(), 'molen-installed-lod-'));
  try {
    await writeFile(join(installed, 'asset.json'), '{"original":true}');
    await writeFile(join(installed, 'model.glb'), 'master');
    await writeFile(join(installed, 'model.skyline.glb'), 'installed skyline');
    const first = await runtimeLodFixture(installed);
    const sidecar = await runtimeLodFixture(join(installed, 'asset.json'));
    expect(first).not.toBe(installed);
    expect(dirname(sidecar)).not.toBe(first);
    // A generator truncates existing files, creates derivatives, and rewrites the sidecar.
    await writeFile(join(first, 'model.skyline.glb'), 'rebuilt skyline');
    await writeFile(join(first, 'model.district.glb'), 'new derivative');
    await writeFile(join(first, 'asset.json'), '{"rebuilt":true}');
    for (const directory of [installed, dirname(sidecar)]) {
      expect(await readFile(join(directory, 'model.skyline.glb'), 'utf8')).toBe(
        'installed skyline',
      );
      expect(await readFile(join(directory, 'asset.json'), 'utf8')).toBe('{"original":true}');
      expect(await readFile(join(directory, 'model.glb'), 'utf8')).toBe('master');
      await expect(readFile(join(directory, 'model.district.glb'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  } finally {
    await rm(installed, { recursive: true, force: true });
  }
});
