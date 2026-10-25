import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateStructureModelFiles } from '../scripts/validate-structure-asset-paths.mjs';

const directories = [];
const document = {
  id: 'molen.worldgen.structure.d20_data_center',
  files: {
    main: 'model.glb',
    variants: Object.fromEntries(
      ['skyline', 'district', 'street', 'closeup'].map((level) => [level, `model.${level}.glb`]),
    ),
  },
};
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'molen-structure-files-'));
  directories.push(directory);
  return directory;
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('structure runtime model files', () => {
  it('reports every missing detail level with a targeted repair command, then accepts restored files', async () => {
    const directory = await fixture();
    await writeFile(join(directory, document.files.main), 'master');
    const failure = await validateStructureModelFiles(directory, document).catch((error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toContain(document.id);
    expect(failure.message).toContain('pnpm assets:fetch');
    expect(failure.message).toContain('pnpm assets:build');
    expect(failure.message).toContain(
      `node packages/tooling/scripts/generate-landmark-lods.mjs --ids=${document.id}`,
    );
    for (const file of Object.values(document.files.variants)) {
      expect(failure.message).toContain(file);
      await writeFile(join(directory, file), 'derived');
    }
    await expect(validateStructureModelFiles(directory, document)).resolves.toBeUndefined();
  });

  it('requires restoration of a missing master before suggesting detail-level generation', async () => {
    const directory = await fixture();
    const failure = await validateStructureModelFiles(directory, document).catch((error) => error);
    expect(failure.message).toContain('model.glb');
    expect(failure.message).toContain('pnpm assets:fetch');
    expect(failure.message).not.toContain('generate-landmark-lods');
    await writeFile(join(directory, 'model.glb'), 'master');
    await expect(
      validateStructureModelFiles(directory, { ...document, files: { main: 'model.glb' } }),
    ).resolves.toBeUndefined();
  });

  it('still rejects directories and paths outside the asset bundle', async () => {
    const directory = await fixture();
    await mkdir(join(directory, 'model.glb'));
    await expect(validateStructureModelFiles(directory, document)).rejects.toThrow(
      'Not a runtime model file',
    );
    await expect(
      validateStructureModelFiles(directory, { ...document, files: { main: '../outside.glb' } }),
    ).rejects.toThrow('Structure source paths must be relative');
  });
});
