import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import * as tar from 'tar';
import {
  archivePath,
  buildAssets,
  checkAssets,
  fetchAssets,
  fileInfo,
  publishAssets,
  validateManifest,
  verifyArchive,
} from '../asset-packs.mjs';

const roots = [];
const quiet = () => {};
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'molen-assets-'));
  roots.push(root);
  await writeFile(join(root, 'LICENSE'), 'Fixture license\n');
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
function resign(manifest) {
  manifest.snapshot = createHash('sha256')
    .update(JSON.stringify({ archives: manifest.archives, notices: manifest.notices }))
    .digest('hex');
  manifest.release = `assets-${manifest.snapshot.slice(0, 16)}`;
  return manifest;
}

async function legacyManifest(root, manifest) {
  const legacy = structuredClone(manifest);
  const directory = join(root, '.artifacts/asset-packs');
  for (const archive of legacy.archives) {
    const path = archivePath(directory, archive);
    archive.file = `molen-glbs-worldgen-assets-c2-000-${archive.sha256}.tar.gz`;
    await rename(path, join(directory, archive.file));
  }
  resign(legacy);
  const text = `${JSON.stringify(legacy, null, 2)}\n`;
  await writeFile(join(root, 'asset-lock.json'), text);
  await writeFile(join(directory, 'asset-lock.json'), text);
  return legacy;
}

test('packs exact source/runtime bytes and restores a checkout offline with no model rewrites', async () => {
  const root = await fixture();
  const source = 'content/worldgen/source/places/c2/c23/test/models/source.glb';
  const runtime = 'content/worldgen/assets/places/c2/c23/test/model.glb';
  const bytes = Buffer.from(Array.from({ length: 8192 }, (_, n) => n % 251));
  await asset(root, source, bytes);
  await asset(root, runtime, Buffer.concat([bytes, bytes]));
  const first = await buildAssets({ root, log: quiet });
  assert.deepEqual(
    first.archives.map((a) => a.file),
    ['worldgen-models-c2-part-001.tar.gz', 'worldgen-sources-c2-part-001.tar.gz'],
  );
  const second = await buildAssets({ root, log: quiet });
  assert.deepEqual(first, second);
  const fresh = await fixture();
  const archiveDir = join(root, '.artifacts/asset-packs');
  assert.equal(
    await fetchAssets({ root: fresh, manifest: first, archiveDir, offline: true, log: quiet }),
    2,
  );
  assert.deepEqual(await readFile(join(fresh, source)), bytes);
  assert.deepEqual(await readFile(join(fresh, runtime)), Buffer.concat([bytes, bytes]));
  assert.equal(await checkAssets({ root: fresh, manifest: first, log: quiet }), 2);
  await fetchAssets({
    root: fresh,
    manifest: first,
    offline: true,
    fetchImpl: () => {
      throw Error('Must not fetch resident assets');
    },
    log: quiet,
  });
});

test('separates geographic groups and honors a bounded source-byte budget', async () => {
  const root = await fixture();
  for (const [cell, name] of [
    ['c2', 'one'],
    ['c2', 'two'],
    ['dp', 'three'],
  ]) {
    await asset(
      root,
      `content/worldgen/assets/places/${cell}/${cell}3/${name}/model.glb`,
      Buffer.alloc(80, 19),
    );
  }
  const manifest = await buildAssets({ root, budget: 100, log: quiet });
  assert.equal(manifest.archives.length, 3);
  assert.ok(manifest.archives.every((a) => a.files.length === 1));
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
  for (const path of [
    'content/entities/assets/tree/model.glb',
    'content/entities/source/tree/source.glb',
    'content/worldgen/assets/reusable/windmill/model.glb',
    'content/worldgen/source/reusable/windmill/source.glb',
    'examples/lantern-dungeon/asset-src/item/model.glb',
    'examples/lantern-dungeon/public/assets/item/model.glb',
  ])
    await asset(root, path);
  const manifest = await buildAssets({ root, log: quiet });
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

test('restores old flat archives and reuses their exact bytes under future readable names', async () => {
  const root = await fixture();
  const path = 'content/worldgen/assets/places/c2/c23/test/model.glb';
  await asset(root, path);
  const legacy = await legacyManifest(root, await buildAssets({ root, log: quiet }));
  const archiveDir = join(root, '.artifacts/asset-packs');
  const fresh = await fixture();
  await fetchAssets({ root: fresh, manifest: legacy, archiveDir, offline: true, log: quiet });
  assert.equal(await checkAssets({ root: fresh, manifest: legacy, log: quiet }), 1);
  const messages = [];
  const next = await buildAssets({ root, log: (message) => messages.push(message) });
  assert.equal(next.archives[0].file, 'worldgen-models-c2-part-001.tar.gz');
  assert.equal(next.archives[0].sha256, legacy.archives[0].sha256);
  assert.notEqual(next.release, legacy.release);
  assert.ok(messages.includes(`Reused ${next.archives[0].file}`));
  assert.deepEqual(
    await readFile(archivePath(archiveDir, next.archives[0])),
    await readFile(join(archiveDir, legacy.archives[0].file)),
  );
});

test('caches different releases with identical filenames and restores either version offline', async () => {
  const source = await fixture();
  const path = 'assets/test/model.glb';
  await asset(source, path, Buffer.from('version one'));
  const first = await buildAssets({ root: source, log: quiet });
  await asset(source, path, Buffer.from('version two'));
  const second = await buildAssets({ root: source, log: quiet });
  assert.equal(first.archives[0].file, second.archives[0].file);
  assert.notEqual(first.archives[0].sha256, second.archives[0].sha256);
  const root = await fixture();
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    const manifest = url.includes(first.release) ? first : second;
    return new Response(
      await readFile(archivePath(join(source, '.artifacts/asset-packs'), manifest.archives[0])),
    );
  };
  for (const manifest of [first, second]) {
    await fetchAssets({ root, manifest, fetchImpl, force: true, log: quiet });
  }
  assert.equal(requested.length, 2);
  for (const [manifest, expected] of [
    [first, 'version one'],
    [second, 'version two'],
  ]) {
    await fetchAssets({ root, manifest, offline: true, force: true, log: quiet });
    assert.equal(await readFile(join(root, path), 'utf8'), expected);
    assert.equal(await checkAssets({ root, manifest, log: quiet }), 1);
  }
});

test('accepts manual flat downloads only when they match the selected release', async () => {
  const source = await fixture();
  const path = 'assets/test/model.glb';
  await asset(source, path, Buffer.from('version one'));
  const first = await buildAssets({ root: source, log: quiet });
  await asset(source, path, Buffer.from('version two'));
  const second = await buildAssets({ root: source, log: quiet });
  const root = await fixture();
  const archiveDir = join(root, 'downloads');
  await mkdir(archiveDir);
  await copyFile(
    archivePath(join(source, '.artifacts/asset-packs'), first.archives[0]),
    join(archiveDir, first.archives[0].file),
  );
  await assert.rejects(
    fetchAssets({ root, manifest: second, archiveDir, offline: true, log: quiet }),
    /Offline archive missing or corrupt/,
  );
  await assert.rejects(readFile(join(root, path)), /ENOENT/);
  await fetchAssets({ root, manifest: first, archiveDir, offline: true, log: quiet });
  assert.equal(await readFile(join(root, path), 'utf8'), 'version one');
});

test('fetches pinned release URLs, validates bytes and reuses archives offline', async () => {
  const source = await fixture();
  await asset(source, 'assets/test/model.glb');
  const manifest = await buildAssets({ root: source, log: quiet });
  const root = await fixture();
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return new Response(
      await readFile(archivePath(join(source, '.artifacts/asset-packs'), manifest.archives[0])),
    );
  };
  await fetchAssets({ root, manifest, fetchImpl, log: quiet });
  assert.deepEqual(urls, [
    `https://github.com/bendyline/molen/releases/download/${manifest.release}/${manifest.archives[0].file}`,
  ]);
  await rm(join(root, 'assets/test/model.glb'));
  await fetchAssets({ root, manifest, offline: true, log: quiet });
  assert.equal(await checkAssets({ root, manifest, log: quiet }), 1);
});

test('refuses to overwrite local edits and requires explicit force to restore', async () => {
  const root = await fixture();
  const path = 'assets/test/model.glb';
  await asset(root, path);
  const manifest = await buildAssets({ root, log: quiet });
  await asset(root, path, Buffer.from('authored edit'));
  await assert.rejects(
    fetchAssets({ root, manifest, offline: true, log: quiet }),
    /Refusing to overwrite/,
  );
  assert.equal(await readFile(join(root, path), 'utf8'), 'authored edit');
  await fetchAssets({ root, manifest, offline: true, force: true, log: quiet });
  assert.equal(await readFile(join(root, path), 'utf8'), 'test geometry');
});

test('rejects corrupt downloads without installing any GLB', async () => {
  const source = await fixture();
  await asset(source, 'assets/test/model.glb');
  const manifest = await buildAssets({ root: source, log: quiet });
  const root = await fixture();
  await assert.rejects(
    fetchAssets({ root, manifest, fetchImpl: async () => new Response('bad archive'), log: quiet }),
    /checksum mismatch/,
  );
  await assert.rejects(readFile(join(root, 'assets/test/model.glb')), /ENOENT/);
  await assert.rejects(
    fetchAssets({ root, manifest, offline: true, log: quiet }),
    /Offline archive missing/,
  );
});

test('rejects traversal, case-colliding destinations and tampered manifests', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const original = await buildAssets({ root, log: quiet });
  for (const path of [
    '../outside.glb',
    'assets/../../outside.glb',
    'assets/C:/outside.glb',
    'assets/a\\b.glb',
    'assets/CON.glb',
  ]) {
    const m = structuredClone(original);
    m.archives[0].files[0].path = path;
    assert.throws(() => validateManifest(resign(m)), /Unsafe asset path/);
  }
  const duplicate = structuredClone(original);
  duplicate.archives[0].files.push({
    ...duplicate.archives[0].files[0],
    path: 'assets/test/MODEL.glb',
  });
  assert.throws(() => validateManifest(resign(duplicate)), /duplicate asset/);
  const changed = structuredClone(original);
  changed.archives[0].files[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateManifest(changed), /snapshot does not match/);
  for (const name of [
    '../test-part-001.tar.gz',
    'test/part-001.tar.gz',
    'C:\\test-part-001.tar.gz',
  ]) {
    const m = structuredClone(original);
    m.archives[0].file = name;
    assert.throws(() => validateManifest(resign(m)), /Invalid archive/);
  }
});

test('rejects unexpected archive members even when the archive hash is correct', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  await asset(root, 'assets/test/unlisted.glb');
  const path = join(root, 'unexpected.tar.gz');
  await tar.c({ file: path, cwd: root, gzip: true }, [
    'assets/test/model.glb',
    'assets/test/unlisted.glb',
  ]);
  const archive = {
    file: 'unexpected.tar.gz',
    ...(await fileInfo(path)),
    files: [
      { path: 'assets/test/model.glb', ...(await fileInfo(join(root, 'assets/test/model.glb'))) },
    ],
  };
  await assert.rejects(verifyArchive(path, archive), /Unexpected archive entry/);
});

test('refuses to hydrate through a symlinked parent', async () => {
  const source = await fixture();
  await asset(source, 'assets/test/model.glb');
  const manifest = await buildAssets({ root: source, log: quiet });
  const root = await fixture();
  const outside = await fixture();
  await symlink(outside, join(root, 'assets'), 'junction');
  await assert.rejects(fetchAssets({ root, manifest, offline: true, log: quiet }), /symlink/);
  await assert.rejects(readFile(join(outside, 'test/model.glb')), /ENOENT/);
});

test('detects unpublished assets and missing old assets before replacing a snapshot', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const manifest = await buildAssets({ root, log: quiet });
  await asset(root, 'assets/test/new.glb');
  await assert.rejects(checkAssets({ root, manifest, log: quiet }), /Unpublished GLB/);
  await rm(join(root, 'assets/test/model.glb'));
  await assert.rejects(buildAssets({ root, log: quiet }), /Restore 1 missing assets/);
  const pruned = await buildAssets({ root, allowRemoved: true, log: quiet });
  assert.equal(pruned.archives.flatMap((a) => a.files).length, 1);
});

test('restores only the requested prefix and makes zero requests for unrelated places', async () => {
  const source = await fixture();
  await asset(source, 'content/worldgen/assets/places/c2/c23/seattle/model.glb');
  await asset(source, 'content/worldgen/assets/places/dp/dp3/chicago/model.glb');
  const manifest = await buildAssets({ root: source, log: quiet });
  const root = await fixture();
  const requested = [];
  await fetchAssets({
    root,
    manifest,
    prefix: 'content/worldgen/assets/places/c2/',
    log: quiet,
    fetchImpl: async (url) => {
      const file = url.split('/').at(-1);
      requested.push(file);
      const archive = manifest.archives.find((a) => a.file === file);
      return new Response(
        await readFile(archivePath(join(source, '.artifacts/asset-packs'), archive)),
      );
    },
  });
  assert.equal(requested.length, 1);
  assert.match(requested[0], /-c2-/);
  await assert.rejects(
    readFile(join(root, 'content/worldgen/assets/places/dp/dp3/chicago/model.glb')),
    /ENOENT/,
  );
});

for (const legacy of [false, true])
  test(`publishes ${legacy ? 'legacy' : 'readable'} attachments only after every digest is verified`, async () => {
    const root = await fixture();
    await asset(root, 'assets/test/model.glb');
    let manifest = await buildAssets({ root, log: quiet });
    if (legacy) manifest = await legacyManifest(root, manifest);
    const archiveDir = join(root, '.artifacts/asset-packs');
    const expected = [
      ...manifest.archives,
      manifest.notices,
      { file: 'asset-lock.json', ...(await fileInfo(join(archiveDir, 'asset-lock.json'))) },
    ];
    const uploaded = [];
    const commands = [];
    const runGh = (args) => {
      commands.push(args);
      if (args.includes('--method'))
        return JSON.stringify({ id: 123, draft: true, tag_name: manifest.release });
      if (args.some((a) => a.endsWith('/releases?per_page=100'))) return '[[]]';
      if (args.some((a) => a.endsWith('/assets?per_page=100'))) return JSON.stringify([uploaded]);
      if (args[1] === 'upload') {
        const file = expected.find((f) => f.file === basename(args[3]));
        uploaded.push({ name: file.file, size: file.size, digest: `sha256:${file.sha256}` });
        return '';
      }
      if (args[1] === 'edit') {
        assert.equal(uploaded.length, expected.length);
        return '';
      }
      throw new Error(`Unexpected command: ${args}`);
    };
    assert.equal(
      await publishAssets({ root, target: 'a'.repeat(40), runGh, log: quiet }),
      manifest.release,
    );
    assert.equal(
      commands.filter((a) => a.some((v) => v.endsWith('/releases?per_page=100'))).length,
      1,
    );
    assert.ok(commands.at(-1).includes('--latest=false'));
    const upload = commands.find((args) => args[1] === 'upload');
    assert.equal(
      upload[3],
      legacy
        ? join(archiveDir, manifest.archives[0].file)
        : archivePath(archiveDir, manifest.archives[0]),
    );
  });

test('does not overwrite or publish a release attachment with a conflicting digest', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const manifest = await buildAssets({ root, log: quiet });
  const runGh = (args) => {
    if (args.some((a) => a.endsWith('/releases?per_page=100')))
      return JSON.stringify([[{ id: 123, draft: true, tag_name: manifest.release }]]);
    if (args.some((a) => a.endsWith('/assets?per_page=100')))
      return JSON.stringify([
        [
          {
            name: manifest.archives[0].file,
            size: manifest.archives[0].size,
            digest: `sha256:${'0'.repeat(64)}`,
          },
        ],
      ]);
    throw new Error('Must not upload or publish when an attachment conflicts');
  };
  await assert.rejects(
    publishAssets({ root, target: 'a'.repeat(40), runGh, log: quiet }),
    /different or unverifiable bytes/,
  );
});
