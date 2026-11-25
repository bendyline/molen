import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import * as tar from 'tar';
import { assetInputs } from '../asset-inputs.mjs';
import {
  archivePath,
  bundleFiles,
  bundleState,
  carryArchives,
  checkAssets,
  checkPublishedSidecars,
  fetchAssets,
  fileInfo,
  githubCli,
  packAssets,
  pruneArchives,
  publishAssets,
  ReleaseMissingError,
  readStamp,
  SEED,
  SIDECAR_PATCH,
  seedAssets,
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
import { listReleases } from '../github-releases.mjs';
import { checkTrackedReviewCaptures } from '../review-captures.mjs';

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
      inputs: { version: 1, data: ['inputs'], exclude: ['*.md', '*.test.mjs'] },
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
  // Documents and the tests beside recipes are excluded; any real input names a new bundle.
  await asset(two, 'inputs/notes.md', Buffer.from('review notes'));
  await asset(two, 'inputs/recipe.test.mjs', Buffer.from('assert.ok(true);'));
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

for (const missingRuntime of [false, true]) {
  test(`restores same-size stale GLBs despite a cached install record (${missingRuntime ? 'missing runtime' : 'all files present'})`, async () => {
    const source = 'examples/lantern-dungeon/asset-src/item/longsword/models/source.glb';
    const runtime = 'examples/lantern-dungeon/public/assets/lantern/item/longsword/model.glb';
    const bytes = Buffer.from('built geometry');
    const published = await publishedFixture([
      [source, bytes],
      [runtime, bytes],
    ]);
    const fresh = await fixture();
    // Actions caches the archives and installed.json together, but the next checkout can
    // already contain different GLBs with the same sizes as the builder's outputs.
    await cp(
      join(published.source, '.artifacts/asset-packs'),
      join(fresh, '.artifacts/asset-packs'),
      { recursive: true },
    );
    await asset(fresh, source, Buffer.alloc(bytes.length, 1));
    if (!missingRuntime) await asset(fresh, runtime, bytes);
    await fetchAssets({
      root: fresh,
      offline: true,
      fetchImpl: () => {
        throw new Error('Restoration must use the cached archives');
      },
      log: quiet,
    });
    assert.deepEqual(await readFile(join(fresh, source)), bytes);
    assert.deepEqual(await readFile(join(fresh, runtime)), bytes);
    await checkAssets({ root: fresh, log: quiet });
  });
}

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

/** Write job records where a build leaves them, so packing attaches them to the bundle. */
async function recordJobs(root, records) {
  for (const [id, record] of Object.entries(records))
    await asset(
      root,
      `.artifacts/asset-build/jobs/${id}.json`,
      Buffer.from(JSON.stringify(record)),
    );
}
/** A seed.json restored from elsewhere, as an Actions cache leaves it. */
async function saveSeed(source, destination) {
  const { key, release, inputs } = await readStamp(source);
  await asset(
    destination,
    SEED,
    Buffer.from(JSON.stringify({ format: 'molen/asset-install@1', key, release, inputs })),
  );
}
/** GitHub's release list and download URLs for several published fixtures, by release name. */
function gitHubServer(published, requested = []) {
  return async (url) => {
    requested.push(url);
    if (url.startsWith('https://api.github.com/')) {
      return Response.json(
        await Promise.all(
          published.map(async ({ release, source, published_at, draft = false }) => ({
            tag_name: release,
            draft,
            published_at,
            assets: (await readdir(join(source, '.artifacts/asset-packs', release))).map(
              (name) => ({ name }),
            ),
          })),
        ),
      );
    }
    const [release, file] = url.split('/').slice(-2);
    const entry = published.find((p) => p.release === release && !p.draft);
    if (!entry) return new Response('Not Found', { status: 404 });
    if (file === 'asset-records.tar.gz')
      return new Response(
        await readFile(join(entry.source, '.artifacts/asset-packs', release, file)),
      );
    return releaseServer(entry.source)(url);
  };
}
const on = (day) => `2026-11-${String(day).padStart(2, '0')}T00:00:00Z`;

test('seeds from the bundle whose inputs differ least, with the job records that built it', async () => {
  const path = 'assets/test/model.glb';
  const bundle = async (shape, extra, record) => {
    const source = await fixture({ source: JSON.stringify({ shape }) });
    await asset(source, path, Buffer.from(shape));
    for (const name of extra) await asset(source, `inputs/${name}.json`, Buffer.from(name));
    await recordJobs(source, { made: { record } });
    const installed = await installFixture(source);
    await packAssets({ root: source, log: quiet });
    return { ...installed, source };
  };
  // This checkout is the pull request that built `mine` with one more edit. Another pull request's
  // bundle was published later, and main's earlier.
  const main = await bundle('main', ['a'], 'main');
  const mine = await bundle('mine', ['a', 'b', 'c'], 'mine');
  const other = await bundle('other', ['x', 'y', 'z'], 'other');
  const fresh = await fixture({ source: JSON.stringify({ shape: 'mine, edited' }) });
  for (const name of ['a', 'b', 'c']) await asset(fresh, `inputs/${name}.json`, Buffer.from(name));
  await recordJobs(fresh, { stale: { record: 'of some other build' } });
  const messages = [];
  const release = await seedAssets({
    root: fresh,
    keepArchives: false,
    fetchImpl: gitHubServer([
      { ...main, published_at: on(1) },
      { ...mine, published_at: on(2) },
      { ...other, published_at: on(3) },
    ]),
    log: (line) => messages.push(line),
  });
  assert.equal(release, mine.release);
  assert.equal(await readFile(join(fresh, path), 'utf8'), 'mine');
  const jobs = join(fresh, '.artifacts/asset-build/jobs');
  assert.deepEqual(await readdir(jobs), ['made.json']);
  assert.deepEqual(JSON.parse(await readFile(join(jobs, 'made.json'))), { record: 'mine' });
  const stamp = await readStamp(fresh);
  assert.equal(stamp.from, 'seed');
  assert.deepEqual(stamp.inputs, mine.inputs);
  assert.match(messages.at(-1), /Seeded with 1 GLBs of \S+ \(1 inputs differ; 1 restored\)/);
  // The seed is what a build starts from, never this checkout's bundle.
  await assert.rejects(checkAssets({ root: fresh, log: quiet }), /built from other inputs/);
  // keepArchives: false leaves the disk to the GLBs; a records archive is not one of them.
  const left = await readdir(join(fresh, '.artifacts/asset-packs'), { recursive: true });
  assert.deepEqual(
    left.filter((name) => name.endsWith('-part-001.tar.gz')),
    [],
  );
  const directories = left.filter((name) => /^[a-f0-9]{64}$/.test(name));
  assert.equal(
    directories.length,
    3,
    'the records of the three candidates, and no emptied directory',
  );
});

test('among bundles without job records, starts from the newest published one', async () => {
  const path = 'assets/test/model.glb';
  const bundle = async (shape) => {
    const { source, installed } = await publishedFixture([[path, Buffer.from(shape)]], {
      source: JSON.stringify({ shape }),
    });
    return { ...installed, source };
  };
  const older = await bundle('older main');
  const newer = await bundle('newer main');
  const draft = await bundle('unfinished draft');
  const fresh = await fixture({ source: '{"shape":"sphere"}' });
  const requested = [];
  const release = await seedAssets({
    root: fresh,
    fetchImpl: gitHubServer(
      [
        { ...older, published_at: on(1) },
        { ...newer, published_at: on(10) },
        { ...draft, published_at: on(11), draft: true },
      ],
      requested,
    ),
    log: quiet,
  });
  assert.equal(release, newer.release);
  assert.equal(await readFile(join(fresh, path), 'utf8'), 'newer main');
  assert.ok(!requested.some((url) => url.includes(`/${older.release}/`)));
  assert.deepEqual((await readStamp(fresh)).inputs, []);
});

test('job records restored from a cache name the bundle they describe, when it is published', async () => {
  const path = 'assets/test/model.glb';
  const bundle = async (shape) => {
    const { source, installed } = await publishedFixture([[path, Buffer.from(shape)]], {
      source: JSON.stringify({ shape }),
    });
    return { ...installed, source };
  };
  const cached = await bundle('cached');
  const newer = await bundle('newer');
  const server = gitHubServer([
    { ...cached, published_at: on(1) },
    { ...newer, published_at: on(2) },
  ]);
  const fresh = await fixture({ source: '{"shape":"sphere"}' });
  await recordJobs(fresh, { kept: {} });
  await saveSeed(cached.source, fresh);
  assert.equal(await seedAssets({ root: fresh, fetchImpl: server, log: quiet }), cached.release);
  assert.deepEqual(await readdir(join(fresh, '.artifacts/asset-build/jobs')), ['kept.json']);
  // Records of a bundle nobody published describe nothing a runner can download.
  const lost = await bundle('never published');
  const second = await fixture({ source: '{"shape":"sphere"}' });
  await saveSeed(lost.source, second);
  assert.equal(await seedAssets({ root: second, fetchImpl: server, log: quiet }), newer.release);
});

test('a bundle whose archives are gone is passed over; a failing network is not', async () => {
  const path = 'assets/test/model.glb';
  const bundle = async (shape) => {
    const { source, installed } = await publishedFixture([[path, Buffer.from(shape)]], {
      source: JSON.stringify({ shape }),
    });
    return { ...installed, source };
  };
  const older = await bundle('older');
  const gone = await bundle('gone');
  const serve = gitHubServer([
    { ...older, published_at: on(1) },
    { ...gone, published_at: on(2) },
  ]);
  const answering = (status) => async (url) =>
    url.includes(`/${gone.release}/`) && url.endsWith('.tar.gz')
      ? new Response('', { status })
      : serve(url);
  const fresh = await fixture({ source: '{"shape":"sphere"}' });
  const options = { root: fresh, retry: { wait: async () => {} }, log: quiet };
  await assert.rejects(seedAssets({ ...options, fetchImpl: answering(503) }), /failed 4 times/);
  assert.equal(await seedAssets({ ...options, fetchImpl: answering(404) }), older.release);
  assert.equal(await readFile(join(fresh, path), 'utf8'), 'older');
});

test('an unreadable candidate is passed over, and a records archive writes only records', async () => {
  const path = 'assets/test/model.glb';
  const source = await fixture({ source: '{"shape":"good"}' });
  await asset(source, path, Buffer.from('good'));
  await recordJobs(source, { made: {} });
  const good = { ...(await installFixture(source)), source };
  await packAssets({ root: source, log: quiet });
  const broken = await fixture({ source: '{"shape":"broken"}' });
  await asset(broken, path, Buffer.from('broken'));
  const bad = { ...(await installFixture(broken)), source: broken };
  await recordJobs(broken, { made: {} });
  await packAssets({ root: broken, log: quiet });
  const manifestPath = join(broken, '.artifacts/asset-packs', bad.release, 'asset-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  // Replace its records with an archive that also carries a file outside the records' places.
  const stray = join(broken, '.artifacts');
  await asset(broken, '.artifacts/evil.mjs', Buffer.from('process.exit(1)'));
  await asset(broken, '.artifacts/asset-build/seed.json', Buffer.from('{"format":"other"}'));
  const records = join(broken, '.artifacts/asset-packs', bad.release, 'asset-records.tar.gz');
  await tar.c({ file: records, cwd: stray, gzip: true }, ['evil.mjs', 'asset-build/seed.json']);
  manifest.records = { file: 'asset-records.tar.gz', ...(await fileInfo(records)) };
  await writeFile(manifestPath, JSON.stringify(manifest));
  const fresh = await fixture({ source: '{"shape":"sphere"}' });
  const messages = [];
  const release = await seedAssets({
    root: fresh,
    fetchImpl: gitHubServer([
      { ...good, published_at: on(1) },
      { ...bad, published_at: on(2) },
    ]),
    log: (line) => messages.push(line),
  });
  assert.equal(release, good.release);
  assert.match(messages.join('\n'), /has no usable job records: No seed in/);
  await assert.rejects(readFile(join(fresh, '.artifacts/evil.mjs')), /ENOENT/);
});

test('with nothing to start from, a seed leaves no install record and does not fail', async () => {
  const fresh = await fixture();
  await writeStamp(fresh, {
    ...(await assetInputs(fresh)),
    from: 'fetch',
    files: [{ path: 'assets/test/model.glb', size: 1, sha256: 'a'.repeat(64) }],
  });
  const messages = [];
  const release = await seedAssets({
    root: fresh,
    fetchImpl: async () => new Response('rate limited', { status: 403 }),
    log: (line) => messages.push(line),
  });
  assert.equal(release, undefined);
  assert.equal(await readStamp(fresh), undefined);
  assert.match(messages.join('\n'), /HTTP 403[\s\S]*runs every job/);
});

test('repacking reuses unchanged archives and recompresses only changed groups', async () => {
  const seattle = 'content/worldgen/assets/places/c2/c23/seattle/model.glb';
  const chicago = 'content/worldgen/assets/places/dp/dp3/chicago/model.glb';
  const { source, manifest: first } = await publishedFixture([
    [seattle, Buffer.from('seattle')],
    [chicago, Buffer.from('chicago')],
  ]);
  await asset(source, recipe, Buffer.from('{"shape":"sphere"}'));
  await asset(source, seattle, Buffer.from('seattle, rebuilt'));
  await installFixture(source);
  const messages = [];
  const second = await packAssets({ root: source, log: (line) => messages.push(line) });
  const byName = (manifest) => new Map(manifest.archives.map((a) => [a.file, a.sha256]));
  assert.equal(
    byName(second).get('worldgen-models-dp-part-001.tar.gz'),
    byName(first).get('worldgen-models-dp-part-001.tar.gz'),
  );
  assert.notEqual(
    byName(second).get('worldgen-models-c2-part-001.tar.gz'),
    byName(first).get('worldgen-models-c2-part-001.tar.gz'),
  );
  assert.deepEqual(
    messages.filter((line) => line.startsWith('Reused')),
    ['Reused worldgen-models-dp-part-001.tar.gz: 1 GLBs unchanged'],
  );
  // The reused archive restores the second bundle like any other.
  const fresh = await fixture({ source: '{"shape":"sphere"}' });
  await fetchAssets({ root: fresh, fetchImpl: releaseServer(source), log: quiet });
  assert.equal(await readFile(join(fresh, chicago), 'utf8'), 'chicago');
  assert.equal(await readFile(join(fresh, seattle), 'utf8'), 'seattle, rebuilt');
});

/** Let `root` pack against a bundle GitHub has, as a fetch, a seed or a publish leaves it. */
async function knowsPublished(root, { source, release }) {
  const published = join(root, '.artifacts/asset-packs/published');
  await mkdir(published, { recursive: true });
  await cp(
    join(source, '.artifacts/asset-packs', release, 'asset-manifest.json'),
    join(published, `${release}.json`),
  );
}

test('a new bundle uploads what changed and lists the rest where it already is', async () => {
  const place = (cell, name) => `content/worldgen/assets/places/${cell}/${cell}3/${name}/model.glb`;
  // Seattle's region holds several large places, so changing one leaves most of its archive live.
  const big = (n) => Buffer.alloc(64 * 1024, n);
  const before = [
    [place('c2', 'needle'), big(1)],
    [place('c2', 'tower'), big(2)],
    [place('c2', 'market'), big(3)],
    [place('c2', 'library'), big(4)],
    [place('dp', 'chicago'), big(5)],
  ];
  const budget = 1024 ** 2;
  const first = await fixture();
  for (const [path, bytes] of before) await asset(first, path, bytes);
  const base = { ...(await installFixture(first)), source: first };
  await packAssets({ root: first, budget, log: quiet });

  const second = await fixture({ source: '{"shape":"sphere"}' });
  for (const [path, bytes] of before) await asset(second, path, bytes);
  await asset(second, place('c2', 'market'), big(30)); // changed
  await asset(second, place('c2', 'stadium'), big(6)); // new
  await rm(join(second, place('c2', 'library'))); // gone
  await installFixture(second);
  await knowsPublished(second, base);
  const messages = [];
  const manifest = await packAssets({
    root: second,
    // Archives under a sixteenth of the budget are folded into a growing group's new one.
    budget: 64 * 1024 * 16,
    log: (line) => messages.push(line),
  });
  const archives = manifest.archives.map(({ file, release, files }) => [
    file,
    release,
    files.map((path) => path.split('/').at(-2)),
  ]);
  // Chicago is untouched. Two of Seattle's four files are dead, which is too many to carry.
  assert.deepEqual(archives, [
    ['worldgen-models-c2-part-001.tar.gz', undefined, ['market', 'needle', 'stadium', 'tower']],
    ['worldgen-models-dp-part-001.tar.gz', base.release, ['chicago']],
  ]);
  assert.match(messages.at(-1), /1 new \(\d+ MiB\), 1 in 1 earlier releases/);

  // With one of four dead, Seattle's archive stays and only the changed file is packed.
  const third = await fixture({ source: '{"shape":"torus"}' });
  for (const [path, bytes] of before) await asset(third, path, bytes);
  await asset(third, place('c2', 'market'), big(31));
  const last = await installFixture(third);
  await knowsPublished(third, base);
  const carried = await packAssets({ root: third, budget: 64 * 1024 * 16, log: quiet });
  assert.deepEqual(
    carried.archives.map(({ release, files }) => [
      release,
      files.map((path) => path.split('/').at(-2)),
    ]),
    [
      [undefined, ['market']],
      [base.release, ['library', 'needle', 'tower']],
      [base.release, ['chicago']],
    ],
  );
  assert.equal(validateManifest(carried, last), carried);

  // A restore reads each archive from its own release and never writes the dead member.
  const requested = [];
  const fresh = await fixture({ source: '{"shape":"torus"}' });
  await fetchAssets({
    root: fresh,
    fetchImpl: gitHubServer(
      [
        { ...base, published_at: on(1) },
        { ...last, source: third, published_at: on(2) },
      ],
      requested,
    ),
    log: quiet,
  });
  assert.deepEqual(await readFile(join(fresh, place('c2', 'market'))), big(31));
  assert.deepEqual(await readFile(join(fresh, place('c2', 'library'))), big(4));
  assert.ok(requested.some((url) => url.includes(`/${base.release}/worldgen-models-c2-`)));
  await checkAssets({ root: fresh, log: quiet });
});

test('carried archives chain: each names the release that first held it', () => {
  const file = (path, n) => ({ path, size: 100, sha256: String(n).repeat(64) });
  const archive = (name, files, extra = {}) => ({
    file: `${name}-part-001.tar.gz`,
    size: 10,
    sha256: name[0].repeat(64),
    files,
    ...extra,
  });
  const a = 'content/worldgen/assets/places/c2/c23/a/model.glb';
  const b = 'content/worldgen/assets/places/dp/dp3/b/model.glb';
  const c = 'content/worldgen/assets/places/ez/ezr/c/model.glb';
  const one = {
    release: `assets-${'1'.repeat(16)}`,
    files: [file(a, 1), file(b, 2)],
    archives: [archive('a', [a]), archive('b', [b])],
  };
  const two = {
    release: `assets-${'2'.repeat(16)}`,
    files: [file(a, 1), file(b, 3), file(c, 4)],
    archives: [
      archive('a', [a], { release: one.release, bytes: 100 }),
      archive('b', [b]),
      archive('c', [c]),
    ],
  };
  const options = { release: `assets-${'3'.repeat(16)}`, budget: 1600 };
  const result = carryArchives([file(a, 1), file(b, 3), file(c, 5)], [two, one], options);
  assert.deepEqual(
    result.carried.map(({ release, files, bytes }) => [release, files, bytes]),
    [
      [one.release, [a], 100],
      [two.release, [b], 100],
    ],
  );
  assert.deepEqual(result.rest, [file(c, 5)]);
  // Nothing is carried from this bundle's own release: it is not published yet.
  assert.deepEqual(
    carryArchives([file(a, 1)], [{ ...one, release: options.release }], options).rest,
    [file(a, 1)],
  );
  // A small archive joins its region's new one; in a region with nothing new it stays put.
  const small = { ...options, budget: 100 * 17 };
  const d = 'content/worldgen/assets/places/c2/c24/d/model.glb';
  assert.deepEqual(carryArchives([file(a, 1), file(b, 2)], [one], small).rest, []);
  assert.deepEqual(carryArchives([file(a, 1), file(d, 9), file(b, 2)], [one], small).rest, [
    file(a, 1),
    file(d, 9),
  ]);
});

test('a manifest may list archives of other releases only in the new format, and each once', async () => {
  const published = await publishedFixture([['assets/test/a.glb', Buffer.from('a')]]);
  const { installed, manifest } = published;
  const carried = structuredClone(manifest);
  carried.archives[0].release = `assets-${'0'.repeat(16)}`;
  carried.archives[0].bytes = carried.files[0].size + 5;
  assert.equal(validateManifest(carried, installed), carried);
  for (const change of [
    (m) => {
      m.format = 'molen/asset-bundle@1';
    },
    (m) => {
      m.archives[0].release = installed.release;
    },
    (m) => {
      m.archives[0].release = '../packs';
    },
    (m) => {
      m.archives[0].bytes = 0;
    },
    (m) => {
      m.archives.push(m.archives[0]);
    },
  ]) {
    const invalid = structuredClone(carried);
    change(invalid);
    assert.throws(() => validateManifest(invalid, installed), /Invalid archive|unexpected asset/);
  }
  const records = structuredClone(manifest);
  records.records = { file: '../seed.json', size: 1, sha256: '0'.repeat(64) };
  assert.throws(() => validateManifest(records, installed), /Invalid asset job records/);
  // Manifests published before archives were shared stay readable.
  const old = structuredClone(manifest);
  old.format = 'molen/asset-bundle@1';
  assert.equal(validateManifest(old, installed), old);
});

test('a checkout knows whether its bundle is published and whether its sidecars describe it', async () => {
  const path = 'content/worldgen/assets/places/c2/c23/tower/model.glb';
  const sidecar = 'content/worldgen/assets/places/c2/c23/tower/asset.json';
  const bytes = Buffer.from('tower');
  const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const published = await publishedFixture([[path, bytes]]);
  const fresh = await fixture();
  const fetchImpl = releaseServer(published.source);
  const state = await bundleState({ root: fresh, fetchImpl });
  assert.equal(state.release, published.installed.release);
  assert.equal(state.published, true);
  const document = (value) =>
    asset(
      fresh,
      sidecar,
      Buffer.from(
        JSON.stringify({ format: 'molen/asset@1', hash: value, files: { main: 'model.glb' } }),
      ),
    );
  await document(hash);
  await checkPublishedSidecars({ root: fresh, fetchImpl, log: quiet });
  // A manifest already in hand is used as it is.
  const offline = () => {
    throw new Error('the manifest is already here');
  };
  const known = { root: fresh, manifest: state.manifest, fetchImpl: offline, log: quiet };
  await checkPublishedSidecars(known);
  await document(`sha256:${'0'.repeat(64)}`);
  await assert.rejects(
    checkPublishedSidecars({ root: fresh, fetchImpl, log: quiet }),
    /committed sidecars do not describe[\s\S]*records other bytes than model\.glb/,
  );
  // No GLB was restored to find that out.
  await assert.rejects(readFile(join(fresh, path)), /ENOENT/);
  await asset(fresh, recipe, Buffer.from('{"shape":"sphere"}'));
  assert.equal(
    (await bundleState({ root: fresh, fetchImpl: async () => new Response('', { status: 404 }) }))
      .published,
    false,
  );
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

/** What Node's fetch throws for a connection the network dropped. */
const dropped = () =>
  new TypeError('fetch failed', {
    cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
  });

test('a dropped connection or a busy server costs a retry, not the restore', async () => {
  const seattle = 'content/worldgen/assets/places/c2/c23/seattle/model.glb';
  const chicago = 'content/worldgen/assets/places/dp/dp3/chicago/model.glb';
  const published = await publishedFixture([
    [seattle, Buffer.from('seattle geometry')],
    [chicago, Buffer.from('chicago geometry')],
  ]);
  const serve = releaseServer(published.source);
  const seen = new Map();
  const waits = [];
  const messages = [];
  const fresh = await fixture();
  await fetchAssets({
    root: fresh,
    // Each URL fails once in its own way: a busy server for the manifest, a refused connection
    // for one archive, and a body that stops halfway for the other.
    fetchImpl: async (url) => {
      const attempt = (seen.get(url) ?? 0) + 1;
      seen.set(url, attempt);
      if (attempt > 1) return serve(url);
      if (url.endsWith('asset-manifest.json')) return new Response('busy', { status: 503 });
      if (url.includes('-c2-')) throw dropped();
      const bytes = Buffer.from(await (await serve(url)).arrayBuffer());
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.subarray(0, bytes.length >> 1));
            controller.error(new TypeError('terminated'));
          },
        }),
      );
    },
    retry: { wait: async (ms) => waits.push(ms) },
    log: (line) => messages.push(line),
  });
  assert.deepEqual(waits, [2_000, 2_000, 2_000]);
  assert.deepEqual([...seen.values()], [2, 2, 2]);
  assert.equal(messages.filter((line) => line.includes('trying again in 2 seconds')).length, 3);
  assert.ok(messages.some((line) => line.includes('fetch failed: read ECONNRESET')));
  assert.equal(await readFile(join(fresh, seattle), 'utf8'), 'seattle geometry');
  assert.equal(await readFile(join(fresh, chicago), 'utf8'), 'chicago geometry');
  await checkAssets({ root: fresh, log: quiet });
  // A half-written download leaves no file a later run could mistake for an archive.
  const left = await readdir(join(fresh, '.artifacts/asset-packs'), { recursive: true });
  assert.deepEqual(
    left.filter((name) => name.endsWith('.part')),
    [],
  );
});

test('a connection that keeps dropping fails the restore after four tries, with the cause', async () => {
  const published = await publishedFixture([['assets/test/model.glb', Buffer.from('ok')]]);
  const serve = releaseServer(published.source);
  const waits = [];
  let archives = 0;
  const root = await fixture();
  await assert.rejects(
    fetchAssets({
      root,
      fetchImpl: async (url) => {
        if (url.endsWith('asset-manifest.json')) return serve(url);
        archives++;
        throw dropped();
      },
      retry: { wait: async (ms) => waits.push(ms) },
      log: quiet,
    }),
    /Download of \S+\.tar\.gz failed 4 times: fetch failed: read ECONNRESET/,
  );
  assert.equal(archives, 4);
  assert.deepEqual(waits, [2_000, 8_000, 30_000]);
  await assert.rejects(readFile(join(root, 'assets/test/model.glb')), /ENOENT/);
});

test('a seed waits out a busy release list instead of building from nothing', async () => {
  const path = 'assets/test/model.glb';
  const main = await publishedFixture([[path, Buffer.from('main as published')]]);
  const fresh = await fixture({ source: '{"shape":"sphere"}' });
  const serve = gitHubServer([
    { ...main.installed, source: main.source, published_at: '2026-11-10T00:00:00Z' },
  ]);
  const waits = [];
  let listings = 0;
  const release = await seedAssets({
    root: fresh,
    fetchImpl: async (url) => {
      if (url.startsWith('https://api.github.com/') && ++listings === 1)
        return new Response('bad gateway', { status: 502 });
      return serve(url);
    },
    retry: { wait: async (ms) => waits.push(ms) },
    log: quiet,
  });
  assert.equal(release, main.installed.release);
  assert.equal(listings, 2);
  assert.deepEqual(waits, [2_000]);
  assert.equal(await readFile(join(fresh, path), 'utf8'), 'main as published');
});

test('pruning leaves one bundle in the cache: the seed archives a build did not reuse go', async () => {
  const seattle = 'content/worldgen/assets/places/c2/c23/seattle/model.glb';
  const chicago = 'content/worldgen/assets/places/dp/dp3/chicago/model.glb';
  const { source, manifest: seed } = await publishedFixture([
    [seattle, Buffer.from('seattle')],
    [chicago, Buffer.from('chicago')],
  ]);
  const packs = join(source, '.artifacts/asset-packs');
  // Before the new bundle is packed there is no manifest to say what it uses: remove nothing.
  await asset(source, recipe, Buffer.from('{"shape":"sphere"}'));
  await asset(source, seattle, Buffer.from('seattle, rebuilt'));
  await installFixture(source);
  const early = [];
  assert.deepEqual(await pruneArchives({ root: source, log: (line) => early.push(line) }), {
    removed: 0,
    bytes: 0,
  });
  assert.match(early.join('\n'), /no archives removed/);
  const built = await packAssets({ root: source, log: quiet });
  const stale = seed.archives.find((a) => a.file === 'worldgen-models-c2-part-001.tar.gz');
  const reused = seed.archives.find((a) => a.file === 'worldgen-models-dp-part-001.tar.gz');
  assert.ok(built.archives.some((a) => a.sha256 === reused.sha256));
  await readFile(archivePath(packs, stale)); // the seed's Seattle is still cached beside the new one
  const messages = [];
  const result = await pruneArchives({ root: source, log: (line) => messages.push(line) });
  assert.deepEqual(result, { removed: 1, bytes: stale.size });
  assert.match(messages.join('\n'), /Removed 1 archives of other bundles .* uses 2\./);
  await assert.rejects(readFile(archivePath(packs, stale)), /ENOENT/);
  // What is left restores the new bundle offline, as a dependent CI job does from the cache.
  const fresh = await fixture({ source: '{"shape":"sphere"}' });
  await cp(packs, join(fresh, '.artifacts/asset-packs'), { recursive: true });
  await fetchAssets({
    root: fresh,
    offline: true,
    fetchImpl: () => {
      throw new Error('A pruned cache must still hold the whole bundle');
    },
    log: quiet,
  });
  assert.equal(await readFile(join(fresh, seattle), 'utf8'), 'seattle, rebuilt');
  assert.equal(await readFile(join(fresh, chicago), 'utf8'), 'chicago');
  assert.deepEqual(await pruneArchives({ root: source, log: quiet }), { removed: 0, bytes: 0 });
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

test('check rejects a sidecar whose runtime LODs are not its variants', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  await asset(root, 'assets/test/model.skyline.glb');
  const { files } = await installFixture(root);
  const hash = `sha256:${files.find((f) => f.path.endsWith('/model.glb')).sha256}`;
  const sidecar = {
    format: 'molen/asset@1',
    files: { main: 'model.glb', variants: {} },
    hash,
    runtimeLods: { masterHash: hash, levels: [{ name: 'skyline', file: 'model.skyline.glb' }] },
  };
  const write = () => writeFile(join(root, 'assets/test/asset.json'), JSON.stringify(sidecar));
  // What an import replay followed by an LOD reuse used to leave behind.
  await write();
  await assert.rejects(
    checkAssets({ root, log: quiet }),
    /assets\/test\/asset.json: files.variants.skyline must name model.skyline.glb\n.*generate-landmark-lods/,
  );
  sidecar.files.variants.skyline = 'model.skyline.glb';
  await write();
  await checkAssets({ root, log: quiet });
  sidecar.runtimeLods.masterHash = 'sha256:reimported';
  await write();
  await assert.rejects(checkAssets({ root, log: quiet }), /derived from another master/);
});

/** A checkout whose commit holds one sidecar, with a build that rewrites it beside its GLBs. */
async function sidecarFixture() {
  const root = await fixture();
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  git('config', 'core.autocrlf', 'false');
  const directory = 'content/worldgen/assets/places/c2/c23/test';
  const sidecar = `${directory}/asset.json`;
  const digest = (text) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
  const build = async (main, skyline = 'skyline') => {
    await asset(root, `${directory}/model.glb`, Buffer.from(main));
    await asset(root, `${directory}/model.skyline.glb`, Buffer.from(skyline));
    await installFixture(root);
    const document = {
      format: 'molen/asset@1',
      files: { main: 'model.glb', variants: { skyline: 'model.skyline.glb' } },
      hash: digest(main),
      runtimeLods: {
        masterHash: digest(main),
        levels: [{ name: 'skyline', file: 'model.skyline.glb', hash: digest(skyline) }],
      },
    };
    await asset(root, sidecar, Buffer.from(`${JSON.stringify(document, null, 2)}\n`));
  };
  const commit = () => {
    git('add', '--', sidecar);
    git('commit', '-q', '--no-verify', '-m', 'sidecar');
  };
  await build('first');
  commit();
  return { root, git, sidecar, build, commit };
}

test('check rejects a sidecar that records other bytes than the bundle holds', async () => {
  const { root, git, sidecar, build } = await sidecarFixture();
  await checkAssets({ root, log: quiet });
  // A restored bundle of rebuilt GLBs beside the committed sidecar.
  await build('second');
  git('checkout', '--', sidecar);
  await assert.rejects(
    checkAssets({ root, log: quiet }),
    /test\/asset\.json: records other bytes than model\.glb\n.*asset-sidecars artifact/,
  );
  await build('second', 'simplified again');
  git('checkout', '--', sidecar);
  await assert.rejects(checkAssets({ root, log: quiet }), /than model\.glb, model\.skyline\.glb\n/);
  // A level can change while its master does not.
  await build('first', 'simplified again');
  git('checkout', '--', sidecar);
  await assert.rejects(
    checkAssets({ root, log: quiet }),
    /^Error: content\/\S+\/asset\.json: records other bytes than model\.skyline\.glb\n/,
  );
});

test('check --committed rejects sidecars a build changed and keeps them as a patch', async () => {
  const { root, git, sidecar, build, commit } = await sidecarFixture();
  const committed = () => checkAssets({ root, committed: true, log: quiet });
  await committed();
  await build('second');
  const rewritten = await readFile(join(root, sidecar), 'utf8');
  // The build made the sidecar match its GLBs, so only the commit still disagrees.
  await checkAssets({ root, log: quiet });
  await assert.rejects(committed(), (error) => {
    assert.match(error.message, /^The build changed these committed sidecars/);
    assert.ok(error.message.includes(`\n${sidecar}\n`), error.message);
    return true;
  });
  const command = spawnSync(
    process.execPath,
    [resolve('scripts/asset-packs.mjs'), 'check', '--committed', '--root', root],
    { encoding: 'utf8' },
  );
  assert.equal(command.status, 1);
  assert.match(command.stderr, /-n asset-sidecars && git apply sidecars\.patch/);
  // The patch turns a clean checkout of the commit into the one the bundle needs.
  git('checkout', '--', sidecar);
  git('apply', SIDECAR_PATCH);
  assert.equal(await readFile(join(root, sidecar), 'utf8'), rewritten);
  commit();
  await committed();
  await assert.rejects(readFile(join(root, SIDECAR_PATCH)), { code: 'ENOENT' });
});

async function sourceBundleFixture(
  root,
  { models = [{ path: 'models/source.glb' }], documents = ['reference.json'], textures = [] } = {},
) {
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
      textures,
      sounds: [],
      documents,
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

test('a source checkout needs reports and previews but no bulk review images', async () => {
  const root = await fixture();
  const path = await sourceBundleFixture(root, {
    models: [],
    documents: [
      'reference.json',
      'preview.png',
      'shots/turntable/front.png',
      'medium-fi/street.png',
    ],
  });
  await asset(root, `${path}/reference.json`, Buffer.from('{}'));
  await assert.rejects(checkSourceBundles({ root, log: quiet }), /preview.png/);
  await asset(root, `${path}/preview.png`);
  assert.deepEqual(await checkSourceBundles({ root, log: quiet }), { verified: 1 });
  // Local iteration can produce extra captures without turning them into source dependencies.
  await asset(root, `${path}/medium-fi/another-angle.png`);
  assert.deepEqual(await checkSourceBundles({ root, log: quiet }), { verified: 1 });
  await rm(join(root, path, 'reference.json'));
  await assert.rejects(checkSourceBundles({ root, log: quiet }), /reference.json/);
});

test('a capture-looking path declared as a source texture is still required', async () => {
  const root = await fixture();
  const path = await sourceBundleFixture(root, {
    models: [],
    documents: [],
    textures: [{ id: 'source-texture', path: 'shots/source-texture.png' }],
  });
  await assert.rejects(checkSourceBundles({ root, log: quiet }), /source-texture.png/);
  await asset(root, `${path}/shots/source-texture.png`);
  assert.deepEqual(await checkSourceBundles({ root, log: quiet }), { verified: 1 });
});

test('a required file that Git ignores fails locally until it is force-added', async () => {
  const root = await fixture();
  await writeFile(join(root, '.gitignore'), 'shots/\n*.glb\n');
  const path = await sourceBundleFixture(root, {
    documents: ['reference.json', 'shots/context/report.json', 'shots/context/street.png'],
  });
  const report = `${path}/shots/context/report.json`;
  const ignored = new RegExp(
    `ignored by Git.*\\(1\\):\\n${path}/source\\.json: ${report} \\(\\.gitignore:1 shots/\\)\\n`,
  );
  // GLBs come back with assets:fetch, and capture images are optional, so neither is named.
  await asset(root, `${path}/models/source.glb`);
  await asset(root, `${path}/reference.json`, Buffer.from('{}'));
  // A checkout without the report learns why, rather than meeting an ENOENT.
  await assert.rejects(checkSourceBundles({ root, log: quiet }), ignored);
  // The machine that wrote it has it on disk, and still fails.
  await asset(root, report, Buffer.from('{}'));
  await assert.rejects(checkSourceBundles({ root, log: quiet }), ignored);
  execFileSync('git', ['add', '--force', '--', report], { cwd: root });
  assert.deepEqual(await checkSourceBundles({ root, log: quiet }), { verified: 1 });
});

test('CI rejects staged bulk captures while allowing small summary previews', async () => {
  const root = await fixture();
  await writeFile(
    join(root, '.gitignore'),
    await readFile(new URL('../../.gitignore', import.meta.url)),
  );
  const preview = 'content/worldgen/source/places/test/preview.png';
  const capture = 'content/worldgen/source/places/test/medium-fi/nested/street.png';
  await asset(root, preview);
  await asset(root, capture);
  execFileSync('git', ['add', '--', preview], { cwd: root });
  checkTrackedReviewCaptures({ root, log: quiet });
  execFileSync('git', ['check-ignore', '--quiet', '--', capture], { cwd: root });
  execFileSync('git', ['add', '--force', '--', capture], { cwd: root });
  assert.throws(
    () => checkTrackedReviewCaptures({ root, log: quiet }),
    /Generated review captures must stay local.*\n.*medium-fi\/nested\/street.png/s,
  );
});

function fakeGitHub(release, { existing, earlier = [] } = {}) {
  const uploaded = [];
  const commands = [];
  const runGh = (args) => {
    commands.push(args);
    if (args.includes('--jq') && args.at(-1).endsWith('/releases?per_page=100'))
      return [...earlier.map(({ attachments, ...item }) => item), existing]
        .filter(Boolean)
        .map((item) => `${JSON.stringify(item)}\n`)
        .join('');
    if (args.includes('POST')) return JSON.stringify({ id: 123, draft: true, tag_name: release });
    const listed = args.at(-1).match(/\/releases\/(\d+)\/assets\?per_page=100$/)?.[1];
    if (listed)
      return JSON.stringify([
        earlier.find((item) => String(item.id) === listed)?.attachments ?? uploaded,
      ]);
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

test('lists releases without their attachments, which outgrow a child process buffer', () => {
  let command;
  const releases = listReleases((args) => {
    command = args;
    // gh prints one line per release, page after page.
    return '{"id":2,"tag_name":"assets-b","draft":true}\n{"id":1,"tag_name":"packs","draft":false}\r\n';
  }, 'bendyline/molen');
  assert.deepEqual(releases, [
    { id: 2, tag_name: 'assets-b', draft: true },
    { id: 1, tag_name: 'packs', draft: false },
  ]);
  assert.ok(command.includes('--paginate'));
  assert.match(command[command.indexOf('--jq') + 1], /\{id, tag_name, draft\}/);
  assert.deepEqual(
    listReleases(() => '', 'bendyline/molen'),
    [],
  );
});

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

test('publishes only what no earlier release holds, after checking that they still do', async () => {
  const place = (cell) => `content/worldgen/assets/places/${cell}/${cell}3/tower/model.glb`;
  const first = await fixture();
  await asset(first, place('c2'), Buffer.from('seattle'));
  await asset(first, place('dp'), Buffer.from('chicago'));
  const base = { ...(await installFixture(first)), source: first };
  const { archives } = await packAssets({ root: first, log: quiet });
  const second = await fixture({ source: '{"shape":"sphere"}' });
  await asset(second, place('c2'), Buffer.from('seattle, rebuilt'));
  await asset(second, place('dp'), Buffer.from('chicago'));
  await recordJobs(second, { made: { record: 1 } });
  const { release } = await installFixture(second);
  await knowsPublished(second, base);
  const attachments = archives.map(({ file, size, sha256 }) => ({
    name: file,
    size,
    digest: `sha256:${sha256}`,
  }));
  const holding = (changes) => ({
    id: 7,
    draft: false,
    tag_name: base.release,
    attachments,
    ...changes,
  });
  const attempt = (earlier) => {
    const github = fakeGitHub(release, { earlier });
    const options = { root: second, target: 'a'.repeat(40), runGh: github.runGh, log: quiet };
    return { github, done: publishAssets({ ...options, builtFrom: 'b'.repeat(40) }) };
  };
  // Gone, still a draft, or holding other bytes: a restore would not find Chicago there.
  for (const earlier of [
    [],
    [holding({ draft: true })],
    [holding({ attachments: attachments.filter((a) => !a.name.includes('-dp-')) })],
    [holding({ attachments: attachments.map((a) => ({ ...a, digest: 'sha256:0' })) })],
  ]) {
    const { github, done } = attempt(earlier);
    await assert.rejects(done, /no longer holds worldgen-models-dp-part-001\.tar\.gz/);
    assert.ok(!github.commands.some((args) => args.includes('POST')), 'nothing was created');
  }
  const { github, done } = attempt([holding()]);
  assert.equal(await done, release);
  assert.deepEqual(github.uploaded.map((a) => a.name).sort(), [
    'ASSET-NOTICES.txt',
    'asset-manifest.json',
    'asset-records.tar.gz',
    'worldgen-models-c2-part-001.tar.gz',
  ]);
  const request = JSON.parse(
    await readFile(join(second, '.artifacts/asset-packs', release, 'release-request.json'), 'utf8'),
  );
  // The tag marks a commit of main; the notes name what was built.
  assert.equal(request.target_commitish, 'a'.repeat(40));
  assert.match(request.body, new RegExp(`built from source at ${'b'.repeat(40)}`));
  // The next bundle packed here may list this one's archives.
  const published = join(second, '.artifacts/asset-packs/published', `${release}.json`);
  assert.equal(JSON.parse(await readFile(published, 'utf8')).release, release);
});

test('a bundle whose files are all published already packs and uploads no archive', async () => {
  // A source record changed and no model did: the same GLBs under another name.
  const path = 'content/worldgen/assets/places/c2/c23/tower/model.glb';
  const first = await fixture();
  await asset(first, path, Buffer.from('tower'));
  const base = { ...(await installFixture(first)), source: first };
  const { archives } = await packAssets({ root: first, log: quiet });
  const second = await fixture({ source: '{"shape":"sphere"}' });
  await asset(second, path, Buffer.from('tower'));
  const { release } = await installFixture(second);
  await knowsPublished(second, base);
  const manifest = await packAssets({ root: second, log: quiet });
  assert.deepEqual(
    manifest.archives.map((a) => a.release),
    [base.release],
  );
  const attachments = archives.map(({ file, size, sha256 }) => ({
    name: file,
    size,
    digest: `sha256:${sha256}`,
  }));
  const github = fakeGitHub(release, {
    earlier: [{ id: 7, draft: false, tag_name: base.release, attachments }],
  });
  const target = 'a'.repeat(40);
  await publishAssets({ root: second, target, runGh: github.runGh, log: quiet });
  assert.deepEqual(github.uploaded.map((a) => a.name).sort(), [
    'ASSET-NOTICES.txt',
    'asset-manifest.json',
  ]);
  const fresh = await fixture({ source: '{"shape":"sphere"}' });
  await fetchAssets({
    root: fresh,
    fetchImpl: gitHubServer([
      { ...base, published_at: on(1) },
      { release, source: second, published_at: on(2) },
    ]),
    log: quiet,
  });
  assert.equal(await readFile(join(fresh, path), 'utf8'), 'tower');
});

test('GitHub losing sight of a draft, or being busy, costs a retry; other failures do not repeat', () => {
  const failing = (stderr) => Object.assign(new Error('gh failed'), { stderr });
  const attempt = (args, failures) => {
    const calls = [];
    const waits = [];
    const gh = githubCli({
      run: (given) => {
        calls.push(given);
        const stderr = failures[calls.length - 1];
        if (stderr) throw failing(stderr);
        return 'ok';
      },
      wait: (ms) => waits.push(ms),
    });
    let result;
    try {
      result = gh(args);
    } catch (error) {
      result = error.stderr;
    }
    return { result, calls, waits };
  };
  const upload = ['release', 'upload', 'assets-1', 'a.tar.gz', '--repo', 'o/r'];
  const lost = attempt(upload, ['release not found\n', 'HTTP 502: Bad Gateway']);
  assert.equal(lost.result, 'ok');
  assert.deepEqual(lost.waits, [10_000, 20_000]);
  // The first upload may have left a broken attachment behind.
  assert.deepEqual(lost.calls, [upload, [...upload, '--clobber'], [...upload, '--clobber']]);
  const edit = ['release', 'edit', 'assets-1', '--draft=false'];
  assert.equal(attempt(edit, ['release not found']).calls.length, 2);
  assert.equal(attempt(upload, Array(9).fill('release not found')).calls.length, 4);
  // A missing release is an answer anywhere else, and nothing that creates is repeated.
  assert.equal(attempt(['release', 'view', 'assets-1'], ['release not found']).calls.length, 1);
  assert.equal(attempt(['api', '--method', 'POST', 'x'], ['HTTP 502']).calls.length, 1);
  assert.equal(attempt(upload, ['HTTP 422: Validation Failed']).calls.length, 1);
});

test('a repacked bundle replaces the archives an interrupted publish left in its draft', async () => {
  const root = await fixture();
  await asset(root, 'assets/test/model.glb');
  const { release } = await installFixture(root);
  const github = fakeGitHub(release, { existing: { id: 123, draft: true, tag_name: release } });
  // That packing split the group differently: part 002 is not in this one.
  github.uploaded.push({ id: 5, name: 'assets-test-part-002.tar.gz', size: 1, digest: 'sha256:0' });
  await publishAssets({ root, target: 'a'.repeat(40), runGh: github.runGh, log: quiet });
  assert.deepEqual(github.uploaded.map((a) => a.name).sort(), [
    'ASSET-NOTICES.txt',
    'asset-manifest.json',
    'assets-test-part-001.tar.gz',
  ]);
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
