import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { currentLandmarkLods } from '../scripts/current-landmark-lods.mjs';

const roots = [];
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
afterEach(async () => {
  for (const directory of roots.splice(0)) {
    expect(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}molen-lod-current-`)).toBe(
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'molen-lod-current-'));
  roots.push(directory);
  const master = Buffer.from('master bytes');
  await writeFile(join(directory, 'model.glb'), master);
  const levels = [];
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const bytes = Buffer.from(`${name} bytes`),
      file = `model.${name}.glb`;
    await writeFile(join(directory, file), bytes);
    levels.push({ name, file, hash: hash(bytes) });
  }
  const data = {
    hash: hash(master),
    files: { main: 'model.glb' },
    runtimeLods: {
      recipeHash: 'current recipe',
      masterHash: hash(master),
      levels,
    },
  };
  const path = join(directory, 'asset.json');
  await writeFile(path, JSON.stringify(data));
  return { directory, path, data };
}
it('reuses only exact current master and four derivative byte pins without changing metadata', async () => {
  const { path, data } = await fixture(),
    before = await readFile(path);
  expect(await currentLandmarkLods(path, 'current recipe')).toEqual(data.runtimeLods);
  expect(await readFile(path)).toEqual(before);
  expect(await currentLandmarkLods(path, 'changed recipe')).toBeUndefined();
});
it.each(['model.glb', 'model.street.glb'])('rejects changed bytes in %s', async (file) => {
  const { directory, path } = await fixture();
  await writeFile(join(directory, file), 'changed');
  expect(await currentLandmarkLods(path, 'current recipe')).toBeUndefined();
});
it('rejects missing derivatives and duplicate level names', async () => {
  const { directory, path, data } = await fixture();
  await unlink(join(directory, 'model.district.glb'));
  expect(await currentLandmarkLods(path, 'current recipe')).toBeUndefined();
  data.runtimeLods.levels[1] = data.runtimeLods.levels[0];
  await writeFile(path, JSON.stringify(data));
  expect(await currentLandmarkLods(path, 'current recipe')).toBeUndefined();
});
it('recovers import-replayed metadata only from a fully verified previous build', async () => {
  const { path, data } = await fixture();
  const previous = data.runtimeLods;
  delete data.runtimeLods;
  await writeFile(path, JSON.stringify(data));
  expect(await currentLandmarkLods(path, 'current recipe')).toBeUndefined();
  expect(await currentLandmarkLods(path, 'current recipe', previous)).toEqual(previous);
  expect(await currentLandmarkLods(path, 'changed recipe', previous)).toBeUndefined();
  expect(
    await currentLandmarkLods(path, 'current recipe', { ...previous, masterHash: 'stale' }),
  ).toBeUndefined();
});
it('cannot recover missing or changed derivative bytes from report metadata', async () => {
  const { directory, path, data } = await fixture();
  const previous = data.runtimeLods;
  delete data.runtimeLods;
  await writeFile(path, JSON.stringify(data));
  await writeFile(join(directory, 'model.street.glb'), 'changed');
  expect(await currentLandmarkLods(path, 'current recipe', previous)).toBeUndefined();
});
