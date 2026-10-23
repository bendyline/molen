import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import { checkDevContent } from '../../../scripts/check-dev-content.mjs';

const fixtures = [];
afterEach(async () => {
  for (const directory of fixtures.splice(0)) {
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}molen-dev-content-`));
    await rm(directory, { recursive: true, force: true });
  }
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'molen-dev-content-'));
  fixtures.push(directory);
  const packs = {};
  for (const name of [
    'entities',
    'worldgen.default',
    'earth',
    'ecology',
    'wildlife',
    'sky',
    'sounds',
  ]) {
    const file = name === 'entities' ? 'entities/version/molen-pack.json' : `${name}.zip`;
    await mkdir(join(directory, file, '..'), { recursive: true });
    await writeFile(join(directory, file), 'existing content');
    packs[`molen.${name}`] = { file, size: 16 };
  }
  await writeFile(
    join(directory, 'index.json'),
    JSON.stringify({ format: 'molen/pack-index@1', packs }),
  );
  return directory;
}

test('startup reuses prepared archives and directory packs after source edits, without writing', async () => {
  const directory = await fixture();
  await writeFile(join(directory, 'asset-build.json'), '{"inputs":"unpublished local edits"}');
  const before = await stat(join(directory, 'index.json'));
  const messages = [];
  assert.equal(await checkDevContent({ directory, log: (message) => messages.push(message) }), 7);
  assert.equal((await stat(join(directory, 'index.json'))).mtimeMs, before.mtimeMs);
  assert.match(messages[0], /prepared content packs/);
});

test('missing initial content requests explicit setup without building anything', async () => {
  const directory = await fixture();
  await rm(join(directory, 'index.json'));
  await assert.rejects(checkDevContent({ directory }), /pnpm dev:prepare/);
  await assert.rejects(stat(join(directory, 'index.json')), { code: 'ENOENT' });
});

test('a missing regional archive or incomplete loose-pack manifest requests a content refresh', async () => {
  const directory = await fixture();
  const file = join(directory, 'index.json');
  const index = JSON.parse(await readFile(file, 'utf8'));
  index.packs['molen.worldgen.default.models.g_dp.p001'] = { file: 'missing-region.zip', size: 16 };
  await writeFile(file, JSON.stringify(index));
  await writeFile(join(directory, 'entities/version/molen-pack.json'), 'truncated');
  await assert.rejects(
    checkDevContent({ directory }),
    /molen.entities.*models.g_dp.p001.*dev:content/,
  );
});

test('required libraries cannot silently disappear from an otherwise readable index', async () => {
  const directory = await fixture();
  const file = join(directory, 'index.json');
  const index = JSON.parse(await readFile(file, 'utf8'));
  delete index.packs['molen.earth'];
  await writeFile(file, JSON.stringify(index));
  await assert.rejects(checkDevContent({ directory }), /molen.earth.*dev:content/);
});

test('development hooks never fetch models or build content; production hooks still package content', async () => {
  for (const file of [
    '../../../package.json',
    '../../world-explorer/package.json',
    '../../earth-view/package.json',
  ]) {
    const pkg = JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
    assert.doesNotMatch(pkg.scripts.predev, /assets:|build-assets|build-content-packs/);
    assert.match(pkg.scripts.predev, /check-dev-content/);
    assert.doesNotMatch(pkg.scripts.predev, /\bbuild\b/);
    if (pkg.scripts.prebuild) assert.match(pkg.scripts.prebuild, /build-content-packs/);
  }
});
