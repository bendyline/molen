import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import { createAssetFileCache } from '../asset-file-cache.mjs';
import { assetInputs } from '../asset-inputs.mjs';
import { createJobCache } from '../asset-job-cache.mjs';
import { buildAssetsFromSource } from '../build-assets.mjs';

const roots = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    assert.ok(resolve(root).startsWith(`${resolve(tmpdir())}${sep}molen-build-cache-`));
    await rm(root, { recursive: true, force: true });
  }
});
async function put(root, path, text) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), text);
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'molen-build-cache-'));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await put(
    root,
    'asset-build.json',
    JSON.stringify({
      format: 'molen/asset-build@2',
      node: process.versions.node.split('.')[0],
      repository: 'bendyline/molen',
      inputs: { version: 1, data: ['inputs'], exclude: [] },
      generators: ['one', 'two'].map((id) => ({ id, command: ['node', `scripts/${id}.mjs`] })),
      masters: [],
    }),
  );
  for (const file of [
    'packages/schema/dist/index.mjs',
    'packages/worldgen/dist/kernel.mjs',
    'packages/tooling/dist/index.mjs',
    'packages/tooling/dist/cli.mjs',
    'packages/worldgen/scripts/install-deterministic-math.mjs',
  ])
    await put(root, file, '');
  await put(root, 'scripts/helper.mjs', 'export const suffix = "geometry";');
  for (const id of ['one', 'two']) {
    await put(root, `inputs/${id}.json`, JSON.stringify({ shape: id }));
    await put(
      root,
      `scripts/${id}.mjs`,
      `
      import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
      const { suffix } = await import('./helper.mjs');
      const input = JSON.parse(await readFile('inputs/${id}.json', 'utf8'));
      if (input.fail) throw new Error('deliberate failure');
      await mkdir('assets/${id}', {recursive:true});
      await writeFile('assets/${id}/model.glb', input.shape + suffix);
      await appendFile('.artifacts/runs.txt', '${id}\\n');
    `,
    );
  }
  return root;
}
const build = (root, options) =>
  buildAssetsFromSource({ root, log: () => {}, concurrency: 2, ...options });
const runIds = (report) =>
  report.generators
    .filter((job) => !job.cached)
    .map((job) => job.id)
    .sort();

test('a second local build does no generation, including after an unrelated input edit', async () => {
  const root = await fixture();
  assert.deepEqual(runIds(await build(root)), ['one', 'two']);
  const before = await stat(join(root, 'assets/one/model.glb'));
  const repeat = await build(root);
  assert.deepEqual(runIds(repeat), []);
  assert.equal(repeat.hashes.hashed, 0, 'unchanged files reuse their persisted content hashes');
  assert.ok(repeat.hashes.reused > 0);
  await put(root, 'inputs/unrelated.json', '{"new":"model work elsewhere"}');
  assert.deepEqual(runIds(await build(root)), []);
  assert.equal((await stat(join(root, 'assets/one/model.glb'))).mtimeMs, before.mtimeMs);
  assert.equal(
    (await readFile(join(root, '.artifacts/runs.txt'), 'utf8')).trim().split('\n').length,
    2,
  );
});

test('touching inputs and outputs checks their hashes once without rebuilding models', async () => {
  const root = await fixture();
  await build(root);
  for (const path of ['inputs/one.json', 'assets/two/model.glb']) {
    const file = join(root, path);
    const info = await stat(file);
    await utimes(file, info.atime, new Date(info.mtimeMs + 60_000));
  }
  const touched = await build(root);
  assert.deepEqual(runIds(touched), []);
  assert.equal(touched.hashes.hashed, 2);
  assert.equal((await build(root)).hashes.hashed, 0);
});

test('missing or malformed hash hints recheck bytes without discarding successful jobs', async () => {
  const root = await fixture();
  await build(root);
  const path = '.artifacts/asset-build/file-hashes.json';
  await put(root, path, 'invalid JSON');
  const recovered = await build(root);
  assert.deepEqual(runIds(recovered), []);
  assert.ok(recovered.hashes.hashed > 0);
  await rm(join(root, path));
  const missing = await build(root);
  assert.deepEqual(runIds(missing), []);
  assert.ok(missing.hashes.hashed > 0);
  assert.equal((await build(root)).hashes.hashed, 0);
});

test('a file edited during hashing is checked again on the next read', async () => {
  const root = await fixture();
  const file = join(root, 'inputs/one.json');
  const cache = await createAssetFileCache(root);
  const digest = () => readFile(file, 'utf8');
  const old = await digest();
  assert.equal(
    await cache.get(file, 'test', async () => {
      await writeFile(file, 'changed during the read');
      return old;
    }),
    old,
  );
  assert.equal(await cache.get(file, 'test', digest), 'changed during the read');
  await cache.save();
  const restored = await createAssetFileCache(root);
  assert.equal(
    restored.getSync(file, 'test', () => assert.fail('unchanged file must not be read')),
    'changed during the read',
  );
  const forced = await createAssetFileCache(root, { force: true });
  assert.equal(await forced.get(file, 'test', digest), 'changed during the read');
  assert.equal(forced.stats.hashed, 1);
});

test('only a changed model is regenerated, and shared dynamic recipe changes invalidate dependents', async () => {
  const root = await fixture();
  await build(root);
  await put(root, 'inputs/one.json', '{"shape":"changed"}');
  assert.deepEqual(runIds(await build(root)), ['one']);
  await put(root, 'scripts/helper.mjs', 'export const suffix = "new geometry";');
  assert.deepEqual(runIds(await build(root)), ['one', 'two']);
  assert.deepEqual(runIds(await build(root)), []);
});

test('missing or corrupted output rebuilds only its generator; force rebuilds all', async () => {
  const root = await fixture();
  await build(root);
  await rm(join(root, 'assets/one/model.glb'));
  assert.deepEqual(runIds(await build(root)), ['one']);
  const file = join(root, 'assets/two/model.glb');
  const original = await stat(file);
  const bytes = await readFile(file);
  await writeFile(file, Buffer.alloc(bytes.length, 32));
  await utimes(file, original.atime, original.mtime);
  assert.deepEqual(runIds(await build(root)), ['two']);
  assert.deepEqual(runIds(await build(root, { force: true })), ['one', 'two']);
});

test('successful jobs remain cached when a sibling fails', async () => {
  const root = await fixture();
  await put(root, 'inputs/two.json', '{"shape":"two","fail":true}');
  await assert.rejects(build(root), /deliberate failure/);
  await put(root, 'inputs/two.json', '{"shape":"fixed"}');
  assert.deepEqual(runIds(await build(root)), ['two']);
  assert.deepEqual(runIds(await build(root)), []);
});

test('directory discoveries, optional files and generated metadata remain cache-correct', async () => {
  const root = await fixture();
  await mkdir(join(root, 'inputs/parts'));
  await put(root, 'inputs/parts/a.txt', 'a');
  await put(
    root,
    'scripts/one.mjs',
    `
    import fs from 'node:fs';
    const names = fs.readdirSync('inputs/parts');
    const extra = fs.existsSync('inputs/optional.txt') ? fs.readFileSync('inputs/optional.txt', 'utf8') : '';
    try { fs.readFileSync('assets/one/generated.json'); } catch {}
    fs.mkdirSync('assets/one', {recursive:true});
    fs.writeFileSync('assets/one/model.glb', names.join(',') + extra);
    fs.writeFileSync('assets/one/generated.json', JSON.stringify({names}));
  `,
  );
  await build(root);
  assert.deepEqual(runIds(await build(root)), []);
  await put(root, 'inputs/parts/b.txt', 'b');
  assert.deepEqual(runIds(await build(root)), ['one']);
  await put(root, 'inputs/optional.txt', 'optional');
  assert.deepEqual(runIds(await build(root)), ['one']);
  await rm(join(root, 'assets/one/generated.json'));
  assert.deepEqual(runIds(await build(root)), ['one']);
});

test('imports reuse local output even when source-build metadata is restored, and repair missing runtime files', async () => {
  const root = await fixture();
  const plan = JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8'));
  plan.afterImport = [{ id: 'derived', command: ['node', 'scripts/derived.mjs'] }];
  await put(root, 'asset-build.json', JSON.stringify(plan));
  await put(
    root,
    'scripts/derived.mjs',
    `
    import {readFile, writeFile, appendFile} from 'node:fs/promises';
    import {createHash} from 'node:crypto';
    const directory = 'content/library/assets/one/';
    const metadata = JSON.parse(await readFile(directory + 'asset.json'));
    const model = await readFile(directory + 'model.glb');
    if (metadata.hash !== 'sha256:' + createHash('sha256').update(model).digest('hex')) throw Error('stale import metadata');
    await writeFile(directory + 'lod.glb',model);
    await writeFile(directory + 'asset.json',JSON.stringify({...metadata, derived:true}));
    await appendFile('.artifacts/derived-runs.txt','ran\\n');
  `,
  );
  const script = await readFile(join(root, 'scripts/one.mjs'), 'utf8');
  await put(
    root,
    'scripts/one.mjs',
    script.replaceAll('assets/one', 'content/library/source/one/models'),
  );
  await put(root, 'content/library/project.json', '{}');
  await put(
    root,
    'content/library/source/one/source.json',
    JSON.stringify({
      format: 'molen/source-bundle@1',
      files: {
        models: [{ path: 'models/model.glb', output: 'assets/one/asset.json', pipeline: 'copy' }],
      },
    }),
  );
  await put(
    root,
    'content/library/assets/one/asset.json',
    JSON.stringify(
      {
        id: 'one',
        files: { main: 'model.glb' },
        hash: `sha256:${createHash('sha256').update('old').digest('hex')}`,
        stats: { sizeBytes: 3 },
      },
      null,
      2,
    ),
  );
  assert.equal((await build(root)).imports.run, 1);
  let next = await build(root);
  assert.deepEqual(runIds(next), []);
  assert.equal(next.imports.run, 0);
  await rm(join(root, 'content/library/assets/one/lod.glb'));
  next = await build(root);
  assert.deepEqual(runIds(next), []);
  assert.equal(next.imports.run, 0);
  assert.equal(await readFile(join(root, '.artifacts/derived-runs.txt'), 'utf8'), 'ran\nran\n');
  await rm(join(root, 'content/library/assets/one/model.glb'));
  next = await build(root);
  assert.deepEqual(runIds(next), []);
  assert.equal(next.imports.run, 1);
  await put(root, 'inputs/one.json', '{"shape":"changed"}');
  next = await build(root);
  assert.deepEqual(runIds(next), ['one']);
  assert.equal(next.imports.run, 1);
  assert.equal((await build(root)).imports.run, 0);
});

test('after-import outputs survive repeat builds and only their missing files need regeneration', async () => {
  const root = await fixture();
  const plan = JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8'));
  plan.afterImport = [{ id: 'lods', command: ['node', 'scripts/lods.mjs'] }];
  await put(root, 'asset-build.json', JSON.stringify(plan));
  await put(root, 'assets/one/asset.json', '{"old":"committed metadata"}');
  await put(
    root,
    'scripts/lods.mjs',
    `
    import {readFile, writeFile, appendFile} from 'node:fs/promises';
    const sidecar = JSON.parse(await readFile('assets/one/asset.json'));
    await writeFile('assets/one/lod.glb', await readFile('assets/one/model.glb'));
    await writeFile('assets/one/asset.json', JSON.stringify({...sidecar, generated: true}));
    await appendFile('.artifacts/lods.txt', 'ran\\n');
  `,
  );
  await build(root);
  assert.deepEqual(runIds(await build(root)), []);
  assert.equal(await readFile(join(root, '.artifacts/lods.txt'), 'utf8'), 'ran\n');
  await rm(join(root, 'assets/one/lod.glb'));
  assert.deepEqual(runIds(await build(root)), []);
  assert.equal(await readFile(join(root, '.artifacts/lods.txt'), 'utf8'), 'ran\nran\n');
});

test('non-Node jobs reuse their declared output trees independently of unrelated models', async () => {
  const root = await fixture();
  const plan = JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8'));
  const job = {
    id: 'python',
    command: ['python', 'scripts/python/generate.py'],
    outputs: ['content/python/source'],
  };
  plan.generators.push(job);
  plan.inputs.data.push('content/python/source');
  await put(root, 'asset-build.json', JSON.stringify(plan));
  await put(root, job.command[1], '# deterministic generator');
  await put(root, 'content/python/source/model.json', '{"shape":"one"}');
  const open = async () => createJobCache(root, plan, { inputs: (await assetInputs(root)).inputs });
  const cache = await open();
  const trace = await cache.begin(job);
  await put(root, 'content/python/source/model.glb', 'geometry');
  await cache.complete(job, trace);
  await cache.save();
  assert.equal(await (await open()).current(job), true);
  await put(root, 'inputs/one.json', '{"shape":"unrelated edit"}');
  assert.equal(await (await open()).current(job), true);
  await put(root, 'content/python/source/model.json', '{"shape":"changed"}');
  assert.equal(await (await open()).current(job), false);
});
