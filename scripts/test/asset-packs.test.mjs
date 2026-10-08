import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import * as tar from 'tar';
import { assetInputs } from '../asset-inputs.mjs';
import {
  archivePath,
  bundleFiles,
  checkAssets,
  fetchAssets,
  fileInfo,
  packAssets,
  publishAssets,
  ReleaseMissingError,
  readStamp,
  validateManifest,
  verifyArchive,
  writeStamp,
} from '../asset-packs.mjs';
import {
  buildAssetsFromSource,
  checkPython,
  importPlan,
  preparePython,
  pythonProblems,
  validatePlan,
} from '../build-assets.mjs';
import { checkSourceBundles } from '../check-source-bundles.mjs';

const roots = [];
const quiet = () => {};
const recipe = 'inputs/recipe.json';
/** A git checkout whose asset inputs are one recipe file, so equal recipes name equal bundles. */
async function fixture({ masters = [], source = '{"shape":"cube"}' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'molen-assets-'));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await writeFile(join(root, 'LICENSE'), 'Fixture license\n');
  await writeFile(
    join(root, 'asset-build.json'),
    JSON.stringify({
      format: 'molen/asset-build@2',
      node: process.versions.node.split('.')[0],
      repository: 'bendyline/molen',
      inputs: { version: 1, data: ['inputs'], exclude: ['*.md'] },
      generators: [],
      masters,
    }),
  );
  await asset(root, recipe, Buffer.from(source));
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    assert.ok(resolve(root).startsWith(`${resolve(tmpdir())}${sep}molen-assets-`));
    await rm(root, { recursive: true, force: true });
  }
});
async function asset(root, path, bytes = Buffer.from('test geometry')) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), bytes);
}
/** Stamp whatever GLBs a fixture holds as its installed bundle, as a build would. */
async function installFixture(root) {
  const current = await assetInputs(root);
  const files = await bundleFiles(root);
  await writeStamp(root, { ...current, from: 'build', files });
  return { ...current, files };
}
/** Serve a packed bundle from `source` the way GitHub's download URLs would. */
function releaseServer(source, requested = []) {
  return async (url) => {
    const file = url.split('/').at(-1);
    requested.push(file);
    const { release } = await assetInputs(source);
    const dir = join(source, '.artifacts/asset-packs');
    if (file === 'asset-manifest.json') {
      try {
        return new Response(await readFile(join(dir, release, file)));
      } catch {
        return new Response('Not Found', { status: 404 });
      }
    }
    const manifest = JSON.parse(await readFile(join(dir, release, 'asset-manifest.json')));
    return new Response(
      await readFile(
        archivePath(
          dir,
          manifest.archives.find((a) => a.file === file),
        ),
      ),
    );
  };
}
async function publishedFixture(paths, options) {
  const source = await fixture(options);
  for (const [path, bytes] of paths) await asset(source, path, bytes);
  const installed = await installFixture(source);
  const manifest = await packAssets({ root: source, log: quiet });
  return { source, installed, manifest };
}

test('the bundle is named by its inputs, never by the bytes a build produced', async () => {
  const one = await fixture();
  const two = await fixture();
  await asset(one, 'assets/test/model.glb', Buffer.from('built on one machine'));
  await asset(two, 'assets/test/model.glb', Buffer.from('built on another'));
  const a = await installFixture(one);
  const b = await installFixture(two);
  assert.match(a.release, /^assets-[a-f0-9]{16}$/);
  assert.equal(a.key, b.key);
  // Documents are excluded; any real input names a new bundle.
  await asset(two, 'inputs/notes.md', Buffer.from('review notes'));
  assert.equal((await assetInputs(two)).key, a.key);
  await asset(two, recipe, Buffer.from('{"shape":"sphere"}'));
  assert.notEqual((await assetInputs(two)).key, a.key);
  assert.equal((await checkAssets({ root: one, log: quiet })).stamp.release, a.release);
});

test('packs, then restores exact bytes into a fresh checkout and reuses the archives offline', async () => {
  const bytes = Buffer.from(Array.from({ length: 8192 }, (_, n) => n % 251));
  const source = 'content/worldgen/source/places/c2/c23/test/models/source.glb';
  const runtime = 'content/worldgen/assets/places/c2/c23/test/model.glb';
  const published = await publishedFixture([
    [source, bytes],
    [runtime, Buffer.concat([bytes, bytes])],
  ]);
  assert.deepEqual(
    published.manifest.archives.map((a) => a.file),
    ['worldgen-models-c2-part-001.tar.gz', 'worldgen-sources-c2-part-001.tar.gz'],
  );
  const fresh = await fixture();
  const requested = [];
  await fetchAssets({
    root: fresh,
    fetchImpl: releaseServer(published.source, requested),
    log: quiet,
  });
  assert.deepEqual(requested.sort(), [
    'asset-manifest.json',
    'worldgen-models-c2-part-001.tar.gz',
    'worldgen-sources-c2-part-001.tar.gz',
  ]);
  assert.deepEqual(await readFile(join(fresh, source)), bytes);
  assert.equal((await readStamp(fresh)).from, 'fetch');
  await checkAssets({ root: fresh, log: quiet });
  await rm(join(fresh, runtime));
  const fail = () => {
    throw Error('Must not download cached archives');
  };
  await fetchAssets({ root: fresh, offline: true, fetchImpl: fail, log: quiet });
  await fetchAssets({ root: fresh, fetchImpl: fail, log: quiet });
  await checkAssets({ root: fresh, log: quiet });
});

test('restores a cached source build into a fresh checkout before its release is published', async () => {
  const source = await fixture();
  const path = 'content/entities/assets/tree/model.glb';
  const bytes = Buffer.from('source-built geometry');
  await asset(source, path, bytes);
  await installFixture(source);
  await packAssets({ root: source, log: quiet });
  const fresh = await fixture();
  await cp(join(source, '.artifacts/asset-packs'), join(fresh, '.artifacts/asset-packs'), {
    recursive: true,
  });
  await fetchAssets({
    root: fresh,
    offline: true,
    fetchImpl: () => {
      throw new Error('A cached source build must not fetch an unpublished release');
    },
    log: quiet,
  });
  assert.deepEqual(await readFile(join(fresh, path), 'utf8'), bytes.toString());
  await checkAssets({ root: fresh, log: quiet });
});

test('reports an unpublished bundle distinctly so callers can build from source', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  await installFixture(root);
  const fresh = await fixture();
  await assert.rejects(
    fetchAssets({ root: fresh, fetchImpl: releaseServer(root), log: quiet }),
    (error) => error instanceof ReleaseMissingError && /not published yet/.test(error.message),
  );
  await assert.rejects(
    fetchAssets({ root: fresh, offline: true, log: quiet }),
    ReleaseMissingError,
  );
});

test('separates geographic groups and honors a bounded source-byte budget', async () => {
  const root = await fixture();
  const paths = ['c2/c23/one', 'c2/c23/two', 'dp/dp3/three'].map(
    (p) => `content/worldgen/assets/places/${p}/model.glb`,
  );
  for (const path of paths) await asset(root, path, Buffer.alloc(80, 19));
  await installFixture(root);
  const manifest = await packAssets({ root, budget: 100, log: quiet });
  assert.deepEqual(
    manifest.archives.map((a) => a.file),
    [
      'worldgen-models-c2-part-001.tar.gz',
      'worldgen-models-c2-part-002.tar.gz',
      'worldgen-models-dp-part-001.tar.gz',
    ],
  );
});

test('names reusable models, content roles and example sources without geographic labels', async () => {
  const root = await fixture();
  const paths = [
    'content/entities/assets/tree/model.glb',
    'content/entities/source/tree/source.glb',
    'content/worldgen/assets/reusable/windmill/model.glb',
    'content/worldgen/source/reusable/windmill/source.glb',
    'examples/lantern-dungeon/asset-src/item/model.glb',
    'examples/lantern-dungeon/public/assets/item/model.glb',
  ];
  for (const path of paths) await asset(root, path);
  await installFixture(root);
  const manifest = await packAssets({ root, log: quiet });
  assert.deepEqual(
    manifest.archives.map((a) => a.file),
    [
      'entities-models-part-001.tar.gz',
      'entities-sources-part-001.tar.gz',
      'lantern-dungeon-models-part-001.tar.gz',
      'lantern-dungeon-sources-part-001.tar.gz',
      'worldgen-reusable-models-part-001.tar.gz',
      'worldgen-reusable-sources-part-001.tar.gz',
    ],
  );
});

test('restores only the requested prefix and downloads nothing for unrelated places', async () => {
  const seattle = 'content/worldgen/assets/places/c2/c23/seattle/model.glb';
  const chicago = 'content/worldgen/assets/places/dp/dp3/chicago/model.glb';
  const published = await publishedFixture([
    [seattle, Buffer.from('seattle')],
    [chicago, Buffer.from('chicago')],
  ]);
  const root = await fixture();
  const requested = [];
  const prefix = 'content/worldgen/assets/places/c2/';
  await fetchAssets({
    root,
    prefix,
    fetchImpl: releaseServer(published.source, requested),
    log: quiet,
  });
  assert.deepEqual(requested, ['asset-manifest.json', 'worldgen-models-c2-part-001.tar.gz']);
  await assert.rejects(readFile(join(root, chicago)), /ENOENT/);
  await checkAssets({ root, prefix, log: quiet });
  await assert.rejects(checkAssets({ root, log: quiet }), /Only .* is installed/);
  await assert.rejects(packAssets({ root, log: quiet }), /Only .* is installed/);
});

test('a new bundle replaces the old one and removes its stale outputs, but not local work', async () => {
  const kept = 'assets/test/model.glb';
  const dropped = 'assets/test/retired.glb';
  const local = 'assets/test/local.glb';
  const first = await publishedFixture([
    [kept, Buffer.from('version one')],
    [dropped, Buffer.from('retired')],
  ]);
  const second = await publishedFixture([[kept, Buffer.from('version two')]], {
    source: '{"shape":"sphere"}',
  });
  const root = await fixture();
  await fetchAssets({ root, fetchImpl: releaseServer(first.source), log: quiet });
  await asset(root, local, Buffer.from('my work in progress'));
  // The recipe changes, so the checkout now names the second bundle.
  await asset(root, recipe, Buffer.from('{"shape":"sphere"}'));
  await fetchAssets({ root, fetchImpl: releaseServer(second.source), log: quiet });
  assert.equal(await readFile(join(root, kept), 'utf8'), 'version two');
  await assert.rejects(readFile(join(root, dropped)), /ENOENT/);
  assert.equal(await readFile(join(root, local), 'utf8'), 'my work in progress');
  // A same-size edit to an installed file is caught by check and undone by --force.
  await asset(root, kept, Buffer.from('version 2!!'));
  await assert.rejects(checkAssets({ root, log: quiet }), /Changed assets\/test\/model.glb/);
  await fetchAssets({ root, force: true, fetchImpl: releaseServer(second.source), log: quiet });
  assert.equal(await readFile(join(root, kept), 'utf8'), 'version two');
});

test('rejects corrupt downloads without installing any GLB', async () => {
  const published = await publishedFixture([['assets/test/model.glb', Buffer.from('ok')]]);
  const root = await fixture();
  const serve = releaseServer(published.source);
  await assert.rejects(
    fetchAssets({
      root,
      fetchImpl: async (url) =>
        url.endsWith('asset-manifest.json') ? serve(url) : new Response('bad archive'),
      log: quiet,
    }),
    /checksum mismatch/,
  );
  await assert.rejects(readFile(join(root, 'assets/test/model.glb')), /ENOENT/);
});

test('rejects a manifest that does not cover exactly its files or names other inputs', async () => {
  const published = await publishedFixture([
    ['assets/test/a.glb', Buffer.from('a')],
    ['assets/test/b.glb', Buffer.from('b')],
  ]);
  const { installed, manifest } = published;
  const missing = structuredClone(manifest);
  missing.archives[0].files.pop();
  assert.throws(() => validateManifest(missing, installed), /missing 1 assets/);
  const extra = structuredClone(manifest);
  extra.archives[0].files.push('assets/test/c.glb');
  assert.throws(() => validateManifest(extra, installed), /unexpected asset/);
  assert.throws(
    () => validateManifest(manifest, { ...installed, key: '0'.repeat(64) }),
    /does not describe/,
  );
  for (const name of ['../x-part-001.tar.gz', 'x/part-001.tar.gz', 'C:\\x-part-001.tar.gz']) {
    const renamed = structuredClone(manifest);
    renamed.archives[0].file = name;
    assert.throws(() => validateManifest(renamed, installed), /Invalid archive/);
  }
});

test('rejects traversal and case-colliding destinations in a manifest', async () => {
  const { installed, manifest } = await publishedFixture([
    ['assets/test/model.glb', Buffer.from('ok')],
  ]);
  for (const path of [
    '../outside.glb',
    'assets/../../outside.glb',
    'assets/C:/outside.glb',
    'assets/a\\b.glb',
    'assets/CON.glb',
  ]) {
    const unsafe = structuredClone(manifest);
    unsafe.files[0].path = path;
    assert.throws(() => validateManifest(unsafe, installed), /Unsafe asset path/);
  }
  const duplicate = structuredClone(manifest);
  duplicate.files.unshift({ ...duplicate.files[0], path: 'assets/test/MODEL.glb' });
  assert.throws(() => validateManifest(duplicate, installed), /duplicate asset/);
});

test('rejects unexpected archive members even when the archive hash is correct', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  await asset(root, 'assets/test/unlisted.glb');
  const path = join(root, 'unexpected-part-001.tar.gz');
  await tar.c({ file: path, cwd: root, gzip: true }, [
    'assets/test/model.glb',
    'assets/test/unlisted.glb',
  ]);
  const model = {
    path: 'assets/test/model.glb',
    ...(await fileInfo(join(root, 'assets/test/model.glb'))),
  };
  const archive = {
    file: 'unexpected-part-001.tar.gz',
    ...(await fileInfo(path)),
    files: [model.path],
  };
  await assert.rejects(
    verifyArchive(path, archive, new Map([[model.path, model]])),
    /Unexpected archive entry/,
  );
});

test('refuses to hydrate through a symlinked parent', async () => {
  const published = await publishedFixture([['assets/test/model.glb', Buffer.from('ok')]]);
  const root = await fixture();
  const outside = await fixture();
  await symlink(outside, join(root, 'assets'), 'junction');
  await assert.rejects(
    fetchAssets({ root, fetchImpl: releaseServer(published.source), log: quiet }),
    /symlink/,
  );
  await assert.rejects(readFile(join(outside, 'test/model.glb')), /ENOENT/);
});

test('check explains changed inputs, reports missing files and notes local work', async () => {
  const master = 'content/entities/source/vehicles/van/models/source.glb';
  const root = await fixture({ masters: [master] });
  await assert.rejects(checkAssets({ root, log: quiet }), /No asset bundle is installed/);
  await asset(root, 'assets/test/model.glb');
  await asset(root, master);
  await installFixture(root);
  await asset(root, 'assets/test/new.glb');
  const messages = [];
  await checkAssets({ root, log: (message) => messages.push(message) });
  assert.match(messages[0], /1 GLBs on disk are local work/);
  const command = resolve('scripts/asset-packs.mjs');
  const key = spawnSync(process.execPath, [command, 'key', '--root', root], { encoding: 'utf8' });
  assert.equal(key.stdout.trim(), (await assetInputs(root)).release);
  await asset(root, recipe, Buffer.from('{"shape":"torus"}'));
  await assert.rejects(checkAssets({ root, log: quiet }), /other inputs.*\n.*inputs\/recipe.json/s);
  const checked = spawnSync(process.execPath, [command, 'check', '--root', root], {
    encoding: 'utf8',
  });
  assert.equal(checked.status, 1);
  await installFixture(root);
  await rm(join(root, 'assets/test/model.glb'));
  await assert.rejects(checkAssets({ root, log: quiet }), /Missing assets\/test\/model.glb/);
});

async function sourceBundleFixture(root, { models = [{ path: 'models/source.glb' }] } = {}) {
  const path = 'content/entities/source/test';
  const bundle = {
    format: 'molen/source-bundle@1',
    id: 'molen.test',
    kind: 'entity',
    title: 'Test bundle',
    files: {
      definitions: [],
      models,
      scripts: [],
      textures: [],
      sounds: [],
      documents: ['reference.json'],
    },
  };
  await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, path, 'source.json'), JSON.stringify(bundle));
  return path;
}

test('source checks require every bundle to be complete', async () => {
  const root = await fixture();
  const path = await sourceBundleFixture(root);
  await assert.rejects(checkSourceBundles({ root, log: quiet }), /ENOENT/);
  await asset(root, `${path}/models/source.glb`);
  await assert.rejects(checkSourceBundles({ root, log: quiet }), /reference.json/);
  await writeFile(join(root, path, 'reference.json'), '{}');
  assert.deepEqual(await checkSourceBundles({ root, log: quiet }), { verified: 1 });
  await writeFile(join(root, path, 'omitted.json'), '{}');
  await assert.rejects(
    checkSourceBundles({ root, log: quiet }),
    /source files missing from manifest: omitted.json/,
  );
  const dataRoot = await fixture();
  await sourceBundleFixture(dataRoot, { models: [] });
  await assert.rejects(checkSourceBundles({ root: dataRoot, log: quiet }), /reference.json/);
});

function fakeGitHub(release, { existing } = {}) {
  const uploaded = [];
  const commands = [];
  const runGh = (args) => {
    commands.push(args);
    if (args.some((a) => a.endsWith('/releases?per_page=100')))
      return JSON.stringify([existing ? [existing] : []]);
    if (args.includes('POST')) return JSON.stringify({ id: 123, draft: true, tag_name: release });
    if (args.some((a) => a.endsWith('/assets?per_page=100'))) return JSON.stringify([uploaded]);
    if (args.includes('DELETE')) {
      const id = Number(args.at(-1).split('/').at(-1));
      uploaded.splice(
        uploaded.findIndex((a) => a.id === id),
        1,
      );
      return '';
    }
    if (args[1] === 'upload') {
      // GitHub reports each attachment's size and SHA-256 digest.
      const bytes = readFileSync(args[3]);
      uploaded.push({
        id: uploaded.length + 100,
        name: basename(args[3]),
        size: bytes.length,
        digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      });
      return '';
    }
    if (args[1] === 'edit') return '';
    throw new Error(`Unexpected command: ${args}`);
  };
  return { runGh, commands, uploaded };
}

test('packs and publishes a bundle only after every attachment digest is verified', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const { release } = await installFixture(root);
  const github = fakeGitHub(release);
  assert.equal(
    await publishAssets({ root, target: 'a'.repeat(40), runGh: github.runGh, log: quiet }),
    release,
  );
  assert.deepEqual(github.uploaded.map((a) => a.name).sort(), [
    'ASSET-NOTICES.txt',
    'asset-manifest.json',
    'assets-test-part-001.tar.gz',
  ]);
  assert.ok(github.commands.at(-1).includes('--draft=false'));
  assert.ok(github.commands.at(-1).includes('--latest=false'));
});

test('replaces a draft attachment from an interrupted run and rejects stray attachments', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const { release } = await installFixture(root);
  const github = fakeGitHub(release, {
    existing: { id: 123, draft: true, tag_name: release },
  });
  github.uploaded.push({ id: 1, name: 'assets-test-part-001.tar.gz', size: 1, digest: 'sha256:0' });
  await publishAssets({ root, target: 'a'.repeat(40), runGh: github.runGh, log: quiet });
  assert.ok(github.commands.some((args) => args.includes('DELETE')));
  assert.equal(github.uploaded.length, 3);
  const stray = fakeGitHub(release, {
    existing: { id: 123, draft: true, tag_name: release },
  });
  stray.uploaded.push({ id: 2, name: 'other.tar.gz', size: 1, digest: 'sha256:0' });
  await assert.rejects(
    publishAssets({ root, target: 'a'.repeat(40), runGh: stray.runGh, log: quiet }),
    /unexpected attachments/,
  );
});

test('leaves an already published bundle untouched', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const { release } = await installFixture(root);
  const github = fakeGitHub(release, {
    existing: { id: 9, draft: false, tag_name: release },
  });
  assert.equal(
    await publishAssets({ root, target: 'a'.repeat(40), runGh: github.runGh, log: quiet }),
    release,
  );
  assert.equal(github.commands.length, 1);
});

test('derives imports from source bundles and validates generator commands', async () => {
  const root = await fixture();
  const bundle = join(root, 'content/entities/source/nature/oak');
  await mkdir(join(bundle, 'models'), { recursive: true });
  await writeFile(join(root, 'content/entities/project.json'), '{}');
  await writeFile(
    join(bundle, 'source.json'),
    JSON.stringify({
      format: 'molen/source-bundle@1',
      id: 'oak',
      kind: 'nature',
      title: 'Oak',
      files: {
        models: [
          {
            path: 'models/source.glb',
            assetId: 'oak',
            output: 'assets/oak/asset.json',
            pipeline: 'copy',
          },
          { path: 'models/model.json' },
        ],
      },
    }),
  );
  await writeFile(
    join(bundle, 'spec.json'),
    JSON.stringify({ importOptions: { optimize: false } }),
  );
  await mkdir(join(root, 'content/entities/assets/oak'), { recursive: true });
  await writeFile(
    join(root, 'content/entities/assets/oak/asset.json'),
    JSON.stringify({ id: 'oak', files: { main: 'model.glb' } }),
  );
  assert.deepEqual(await importPlan(root), [
    {
      id: 'oak',
      pipeline: 'copy',
      optimize: false,
      source: 'content/entities/source/nature/oak/models/source.glb',
      sidecar: 'content/entities/assets/oak/asset.json',
      output: 'content/entities/assets/oak/model.glb',
      project: 'content/entities/project.json',
    },
  ]);
  const plan = { format: 'molen/asset-build@2', node: '24', generators: [], masters: [] };
  assert.equal(validatePlan(plan), plan);
  for (const command of [
    ['bash', 'scripts/x.sh'],
    ['node', '../outside.mjs'],
    ['node', 'packages/../../x.mjs'],
    ['node', '/abs/x.mjs'],
  ])
    assert.throws(
      () => validatePlan({ ...plan, generators: [{ id: 'x', command }] }),
      /repository script/,
    );
  assert.throws(
    () =>
      validatePlan({
        ...plan,
        generators: [
          { id: 'x', command: ['node', 'scripts/a.mjs'] },
          { id: 'x', command: ['node', 'scripts/b.mjs'] },
        ],
      }),
    /duplicate generator/,
  );
});

test('checks the Python interpreter and its pinned packages before any generator runs', async () => {
  const root = await fixture();
  const pins = new Map([
    ['Pillow', { version: '12.2.0', file: 'examples/game/tools/requirements.txt' }],
  ]);
  assert.deepEqual(
    pythonProblems('py', { python: [3, 12, 1], packages: { Pillow: '12.2.0' } }, pins),
    [],
  );
  assert.deepEqual(pythonProblems('py', { python: [3, 9, 6], packages: { Pillow: null } }, pins), [
    'py is Python 3.9.6; the Python generators need 3.10+. Set PYTHON to a Python 3.10+ interpreter.',
    'examples/game/tools/requirements.txt pins Pillow==12.2.0; py has none. Run: py -m pip install -r examples/game/tools/requirements.txt',
  ]);
  const missing = join(root, 'no-python');
  const python = [{ id: 'game', command: ['python', 'examples/game/tools/generate.py'] }];
  await assert.rejects(checkPython(root, python, missing), /Set PYTHON/);
  // A build with no Python jobs never looks for an interpreter.
  await checkPython(root, [{ id: 'oak', command: ['node', 'scripts/oak.mjs'] }], missing);
});

async function pythonFixture() {
  const root = await fixture();
  await mkdir(join(root, 'examples/game/tools'), { recursive: true });
  await writeFile(join(root, 'examples/game/tools/requirements.txt'), 'Pillow==12.2.0\n');
  const jobs = [{ id: 'game', command: ['python', 'examples/game/tools/generate.py'] }];
  const local = join(
    root,
    '.artifacts/asset-build/python',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  return { root, jobs, local };
}

function pythonProbe(interpreters, calls = []) {
  return (executable) => {
    calls.push(executable);
    const found = interpreters.get(executable);
    return found ? { status: 0, stdout: JSON.stringify(found) } : { error: { code: 'ENOENT' } };
  };
}

test('uses a newer installed Python and installs pins only in the local environment', async () => {
  const { root, jobs, local } = await pythonFixture();
  const interpreters = new Map([
    ['python3', { python: [3, 9, 6], packages: { Pillow: null } }],
    ['python3.12', { python: [3, 12, 13], packages: { Pillow: null } }],
  ]);
  const setupCalls = [];
  const selected = await preparePython(root, jobs, {
    executable: null,
    candidates: [local, 'python3', 'python3.12'],
    probe: pythonProbe(interpreters),
    setup: async (executable, args) => {
      setupCalls.push([executable, ...args]);
      if (args.includes('install'))
        interpreters.set(local, { python: [3, 12, 13], packages: { Pillow: '12.2.0' } });
    },
    log: quiet,
  });
  assert.equal(selected, local);
  assert.deepEqual(setupCalls, [
    ['python3.12', '-m', 'venv', join(root, '.artifacts/asset-build/python')],
    [
      local,
      '-m',
      'pip',
      '--disable-pip-version-check',
      'install',
      '--no-input',
      '-r',
      'examples/game/tools/requirements.txt',
    ],
  ]);
});

test('reuses an environment with all pins, without setup or network access', async () => {
  const { root, jobs, local } = await pythonFixture();
  const ready = { python: [3, 12, 13], packages: { Pillow: '12.2.0' } };
  for (const executable of [local, 'python3.12']) {
    const selected = await preparePython(root, jobs, {
      executable: null,
      candidates: [local, 'python3', 'python3.12'],
      probe: pythonProbe(
        new Map([
          ['python3', { python: [3, 10, 1], packages: { Pillow: null } }],
          [executable, ready],
        ]),
      ),
      setup: async () => assert.fail('No setup needed'),
      log: quiet,
    });
    assert.equal(selected, executable);
  }
});

test('honors explicit Python overrides and fails before setup for incompatible Python', async () => {
  const { root, jobs } = await pythonFixture();
  const calls = [];
  const options = {
    probe: pythonProbe(
      new Map([['chosen-python', { python: [3, 9, 6], packages: { Pillow: null } }]]),
      calls,
    ),
    setup: async () => assert.fail('Incompatible Python must not run setup'),
    log: quiet,
  };
  await assert.rejects(
    preparePython(root, jobs, { ...options, executable: 'chosen-python' }),
    /chosen-python is Python 3.9.6/,
  );
  assert.deepEqual(calls, ['chosen-python']);
  await assert.rejects(
    preparePython(root, jobs, {
      ...options,
      executable: null,
      candidates: ['chosen-python', 'missing-python'],
    }),
    /No usable Python 3.10\+ found/,
  );
  assert.equal(
    await preparePython(root, [{ command: ['node', 'scripts/oak.mjs'] }], {
      ...options,
      probe: () => assert.fail('Node-only builds must not probe Python'),
    }),
    undefined,
  );
});

test('does not accept an environment whose dependency installation left pins missing', async () => {
  const { root, jobs, local } = await pythonFixture();
  await assert.rejects(
    preparePython(root, jobs, {
      executable: null,
      candidates: ['python3.12'],
      probe: pythonProbe(
        new Map([
          ['python3.12', { python: [3, 12, 13], packages: { Pillow: null } }],
          [local, { python: [3, 12, 13], packages: { Pillow: '11.0.0' } }],
        ]),
      ),
      setup: async () => {},
      log: quiet,
    }),
    /pins Pillow==12.2.0/,
  );
});

test('a build stamps the inputs it started from, drops stale outputs and keeps local work', async () => {
  const root = await fixture();
  // No jobs load packages in this fixture; satisfy the build preflight without compiling.
  for (const path of [
    'packages/schema/dist/index.mjs',
    'packages/worldgen/dist/kernel.mjs',
    'packages/tooling/dist/index.mjs',
    'packages/tooling/dist/cli.mjs',
  ]) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), '');
  }
  const stale = 'assets/retired/model.glb';
  const local = 'assets/in-progress/model.glb';
  await asset(root, stale, Buffer.from('previous bundle'));
  await installFixture(root);
  await asset(root, local, Buffer.from('unfinished geometry'));
  const messages = [];
  const report = await buildAssetsFromSource({ root, log: (message) => messages.push(message) });
  const { release } = await assetInputs(root);
  assert.equal(report.bundle.release, release);
  // No generator rebuilt the previous bundle's output, so it is gone; local work is untouched.
  await assert.rejects(readFile(join(root, stale)), /ENOENT/);
  assert.equal(await readFile(join(root, local), 'utf8'), 'unfinished geometry');
  const stamp = await readStamp(root);
  assert.equal(stamp.from, 'build');
  assert.deepEqual(
    stamp.files.map((f) => f.path),
    [local],
  );
  assert.ok(messages.at(-1).endsWith(`as ${release}.`));
  await checkAssets({ root, log: quiet });
});
