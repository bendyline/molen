import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import * as tar from 'tar';
import {
  archivePath,
  checkAssets,
  createLock,
  fetchAssets,
  fileInfo,
  packAssets,
  publishAssets,
  ReleaseMissingError,
  readLock,
  recordBuilt,
  validateLock,
  validateReleaseManifest,
  verifyArchive,
  writeLock,
} from '../asset-packs.mjs';
import {
  buildAssetsFromSource,
  checkPython,
  importPlan,
  LOCK_HOST,
  pythonProblems,
  validatePlan,
} from '../build-assets.mjs';

const roots = [];
const quiet = () => {};
async function fixture({ masters = [] } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'molen-assets-'));
  roots.push(root);
  await writeFile(join(root, 'LICENSE'), 'Fixture license\n');
  await writeFile(
    join(root, 'asset-build.json'),
    JSON.stringify({ format: 'molen/asset-build@2', generators: [], masters }),
  );
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
/** Lock whatever GLBs a fixture holds, as the Update asset lock workflow would. */
async function lockFixture(root, paths) {
  const files = [];
  for (const path of paths) files.push({ path, ...(await fileInfo(join(root, path))) });
  const lock = createLock(files);
  await writeLock(root, lock);
  return lock;
}
/** Serve a packed release from `source` the way GitHub's download URLs would. */
function releaseServer(source, requested = []) {
  return async (url) => {
    const file = url.split('/').at(-1);
    requested.push(file);
    const lock = await readLock(source);
    const dir = join(source, '.artifacts/asset-packs');
    if (file === 'asset-manifest.json') {
      try {
        return new Response(await readFile(join(dir, lock.release, file)));
      } catch {
        return new Response('Not Found', { status: 404 });
      }
    }
    const manifest = JSON.parse(await readFile(join(dir, lock.release, 'asset-manifest.json')));
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
async function publishedFixture(paths) {
  const source = await fixture();
  for (const [path, bytes] of paths) await asset(source, path, bytes);
  const lock = await lockFixture(
    source,
    paths.map(([path]) => path),
  );
  const manifest = await packAssets({ root: source, log: quiet });
  return { source, lock, manifest };
}

test('the lock pins file bytes only, so its release name is known before anything is packed', async () => {
  const root = await fixture();
  await asset(root, 'content/entities/assets/tree/model.glb', Buffer.from('b'));
  await asset(root, 'assets/test/model.glb', Buffer.from('a'));
  const lock = await lockFixture(root, [
    'content/entities/assets/tree/model.glb',
    'assets/test/model.glb',
  ]);
  assert.deepEqual(
    lock.files.map((f) => f.path),
    ['assets/test/model.glb', 'content/entities/assets/tree/model.glb'],
  );
  assert.match(lock.release, /^assets-[a-f0-9]{16}$/);
  assert.deepEqual(createLock([...lock.files].reverse()), lock);
  assert.equal(await checkAssets({ root, log: quiet }), 2);
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
  await writeLock(fresh, published.lock);
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
  assert.equal(await checkAssets({ root: fresh, log: quiet }), 2);
  await rm(join(fresh, runtime));
  const fail = () => {
    throw Error('Must not download cached archives');
  };
  await fetchAssets({ root: fresh, offline: true, fetchImpl: fail, log: quiet });
  await fetchAssets({ root: fresh, fetchImpl: fail, log: quiet });
  assert.equal(await checkAssets({ root: fresh, log: quiet }), 2);
});

test('reports an unpublished snapshot distinctly so callers can build from source', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const lock = await lockFixture(root, ['assets/test/model.glb']);
  const fresh = await fixture();
  await writeLock(fresh, lock);
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
  await lockFixture(root, paths);
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
  await lockFixture(root, paths);
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
  await writeLock(root, published.lock);
  const requested = [];
  await fetchAssets({
    root,
    prefix: 'content/worldgen/assets/places/c2/',
    fetchImpl: releaseServer(published.source, requested),
    log: quiet,
  });
  assert.deepEqual(requested, ['asset-manifest.json', 'worldgen-models-c2-part-001.tar.gz']);
  await assert.rejects(readFile(join(root, chicago)), /ENOENT/);
});

test('replaces its own stale outputs but refuses to overwrite a locally built GLB', async () => {
  const path = 'assets/test/model.glb';
  const first = await publishedFixture([[path, Buffer.from('version one')]]);
  const second = await publishedFixture([[path, Buffer.from('version two')]]);
  const root = await fixture();
  await writeLock(root, first.lock);
  await fetchAssets({ root, fetchImpl: releaseServer(first.source), log: quiet });
  // A newer lock: the installed file is a stale download and is replaced without --force.
  await writeLock(root, second.lock);
  await fetchAssets({ root, fetchImpl: releaseServer(second.source), log: quiet });
  assert.equal(await readFile(join(root, path), 'utf8'), 'version two');
  // A GLB this tooling did not install is local work.
  await asset(root, path, Buffer.from('local build'));
  await assert.rejects(
    fetchAssets({ root, fetchImpl: releaseServer(second.source), log: quiet }),
    /Refusing to overwrite locally built GLBs/,
  );
  assert.equal(await readFile(join(root, path), 'utf8'), 'local build');
  await fetchAssets({ root, force: true, fetchImpl: releaseServer(second.source), log: quiet });
  assert.equal(await readFile(join(root, path), 'utf8'), 'version two');
});

test("keeps this machine's build of the current lock and replaces it once the lock moves on", async () => {
  const path = 'assets/test/model.glb';
  const first = await publishedFixture([[path, Buffer.from('version one')]]);
  const second = await publishedFixture([[path, Buffer.from('version two')]]);
  const root = await fixture();
  await writeLock(root, first.lock);
  // A source build on a host that rounds differently wrote other bytes for this lock.
  await asset(root, path, Buffer.from('host build'));
  await recordBuilt(root, first.lock.release, [{ path, ...(await fileInfo(join(root, path))) }]);
  const requested = [];
  await fetchAssets({ root, fetchImpl: releaseServer(first.source, requested), log: quiet });
  assert.equal(await readFile(join(root, path), 'utf8'), 'host build');
  assert.deepEqual(requested, []);
  // Edited after the build, it is local work again.
  await asset(root, path, Buffer.from('hand edit'));
  await assert.rejects(
    fetchAssets({ root, fetchImpl: releaseServer(first.source), log: quiet }),
    /Refusing to overwrite locally built GLBs/,
  );
  // Under a newer lock the build is a stale output, replaced without --force.
  await asset(root, path, Buffer.from('host build'));
  await writeLock(root, second.lock);
  await fetchAssets({ root, fetchImpl: releaseServer(second.source), log: quiet });
  assert.equal(await readFile(join(root, path), 'utf8'), 'version two');
});

test('rejects corrupt downloads without installing any GLB', async () => {
  const published = await publishedFixture([['assets/test/model.glb', Buffer.from('ok')]]);
  const root = await fixture();
  await writeLock(root, published.lock);
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

test('rejects a release manifest that does not cover exactly the locked files', async () => {
  const published = await publishedFixture([
    ['assets/test/a.glb', Buffer.from('a')],
    ['assets/test/b.glb', Buffer.from('b')],
  ]);
  const { lock, manifest } = published;
  const missing = structuredClone(manifest);
  missing.archives[0].files.pop();
  assert.throws(() => validateReleaseManifest(missing, lock), /missing 1 assets/);
  const extra = structuredClone(manifest);
  extra.archives[0].files.push('assets/test/c.glb');
  assert.throws(() => validateReleaseManifest(extra, lock), /unexpected asset/);
  const other = structuredClone(manifest);
  other.release = 'assets-0000000000000000';
  assert.throws(() => validateReleaseManifest(other, lock), /does not describe/);
  for (const name of ['../x-part-001.tar.gz', 'x/part-001.tar.gz', 'C:\\x-part-001.tar.gz']) {
    const renamed = structuredClone(manifest);
    renamed.archives[0].file = name;
    assert.throws(() => validateReleaseManifest(renamed, lock), /Invalid archive/);
  }
});

test('rejects traversal, case-colliding destinations and tampered locks', async () => {
  const lock = createLock([{ path: 'assets/test/model.glb', size: 4, sha256: 'a'.repeat(64) }]);
  for (const path of [
    '../outside.glb',
    'assets/../../outside.glb',
    'assets/C:/outside.glb',
    'assets/a\\b.glb',
    'assets/CON.glb',
  ])
    assert.throws(() => createLock([{ ...lock.files[0], path }]), /Unsafe asset path/);
  assert.throws(
    () => createLock([lock.files[0], { ...lock.files[0], path: 'assets/test/MODEL.glb' }]),
    /duplicate asset/,
  );
  const changed = structuredClone(lock);
  changed.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateLock(changed), /snapshot does not match/);
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
  await writeLock(root, published.lock);
  const outside = await fixture();
  await symlink(outside, join(root, 'assets'), 'junction');
  await assert.rejects(
    fetchAssets({ root, fetchImpl: releaseServer(published.source), log: quiet }),
    /symlink/,
  );
  await assert.rejects(readFile(join(outside, 'test/model.glb')), /ENOENT/);
});

test('flags GLBs that are neither locked nor declared masters', async () => {
  const master = 'content/entities/source/vehicles/van/models/source.glb';
  const root = await fixture({ masters: [master] });
  await asset(root, 'assets/test/model.glb');
  await asset(root, master);
  await lockFixture(root, ['assets/test/model.glb']);
  assert.equal(await checkAssets({ root, log: quiet }), 1);
  await asset(root, 'assets/test/new.glb');
  await assert.rejects(checkAssets({ root, log: quiet }), /Unlocked GLB: assets\/test\/new.glb/);
  await rm(join(root, 'assets/test/model.glb'));
  await assert.rejects(checkAssets({ root, log: quiet }), /Missing assets\/test\/model.glb/);
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

test('packs and publishes a snapshot only after every attachment digest is verified', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const lock = await lockFixture(root, ['assets/test/model.glb']);
  const github = fakeGitHub(lock.release);
  assert.equal(
    await publishAssets({ root, target: 'a'.repeat(40), runGh: github.runGh, log: quiet }),
    lock.release,
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
  const lock = await lockFixture(root, ['assets/test/model.glb']);
  const github = fakeGitHub(lock.release, {
    existing: { id: 123, draft: true, tag_name: lock.release },
  });
  github.uploaded.push({ id: 1, name: 'assets-test-part-001.tar.gz', size: 1, digest: 'sha256:0' });
  await publishAssets({ root, target: 'a'.repeat(40), runGh: github.runGh, log: quiet });
  assert.ok(github.commands.some((args) => args.includes('DELETE')));
  assert.equal(github.uploaded.length, 3);
  const stray = fakeGitHub(lock.release, {
    existing: { id: 123, draft: true, tag_name: lock.release },
  });
  stray.uploaded.push({ id: 2, name: 'other.tar.gz', size: 1, digest: 'sha256:0' });
  await assert.rejects(
    publishAssets({ root, target: 'a'.repeat(40), runGh: stray.runGh, log: quiet }),
    /unexpected attachments/,
  );
});

test('leaves an already published snapshot untouched', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const lock = await lockFixture(root, ['assets/test/model.glb']);
  const github = fakeGitHub(lock.release, {
    existing: { id: 9, draft: false, tag_name: lock.release },
  });
  assert.equal(
    await publishAssets({ root, target: 'a'.repeat(40), runGh: github.runGh, log: quiet }),
    lock.release,
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

test('writes the lock only on the lock host', async () => {
  const root = await fixture();
  const plan = { format: 'molen/asset-build@2', node: '24', generators: [], masters: [] };
  await writeFile(join(root, 'asset-build.json'), JSON.stringify(plan));
  assert.equal(LOCK_HOST, 'linux-x64');
  await assert.rejects(
    buildAssetsFromSource({ root, updateLock: true, host: 'darwin-arm64', log: quiet }),
    /written on linux-x64; this is darwin-arm64.*Update asset lock workflow/,
  );
});
