import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import { checkSourceBundles } from '../check-source-bundles.mjs';
import { isReferenceMaterial } from '../reference-material.mjs';
import {
  checkReferences,
  fetchReferences,
  packReferences,
  publishReferences,
  readReferenceLock,
  referenceGroup,
  untrackReferences,
  validateReferenceLock,
} from '../reference-packs.mjs';

const roots = [];
const quiet = () => {};
const seattle = 'content/worldgen/source/places/c2/c23/space_needle';
const chicago = 'content/worldgen/source/places/dp/dp3/willis_tower';
const photo = `${seattle}/references/north-elevation.jpg`;
const scan = `${chicago}/reference-originals/1974-plans.pdf`;
const notes = `${seattle}/references/provenance.json`;
async function put(root, path, bytes) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), bytes);
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'molen-references-'));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await put(root, 'asset-build.json', JSON.stringify({ repository: 'bendyline/molen' }));
  await put(root, photo, 'north elevation photo bytes');
  await put(root, scan, 'scanned plans');
  await put(root, notes, '{"source":"text records stay in Git"}');
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    assert.ok(resolve(root).startsWith(`${resolve(tmpdir())}${sep}molen-references-`));
    await rm(root, { recursive: true, force: true });
  }
});
/** Serves each archive from the release directory it was packed into, as GitHub would. */
function releaseServer(root, requested = []) {
  return async (url) => {
    const [release, file] = url.split('/').slice(-2);
    requested.push(`${release}/${file}`);
    try {
      return new Response(await readFile(join(root, '.artifacts/reference-packs', release, file)));
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  };
}

test('selects binary references, scans and terrain downloads, never their text records', () => {
  for (const path of [
    photo,
    scan,
    `${seattle}/reference-images/aerial.png`,
    `${seattle}/terrain-sources/usgs/tile.bin`,
    `${seattle}/terrain-sources/window.tif`,
    `${chicago}/reference-rights/license-page.pdf`,
  ])
    assert.equal(isReferenceMaterial(path), true, path);
  for (const path of [
    notes,
    `${seattle}/reference-images.json`,
    `${seattle}/references/README.md`,
    `${seattle}/terrain-sources/fetch.py`,
    `${seattle}/references/no-extension`,
    `${seattle}/textures/brick.png`,
    `${seattle}/preview.png`,
    'docs/plans/brief.pdf',
    'examples/game/references/photo.jpg',
  ])
    assert.equal(isReferenceMaterial(path), false, path);
  assert.equal(referenceGroup(photo), 'places-c2');
  assert.equal(
    referenceGroup('content/entities/source/aircraft/p51/references/a.jpg'),
    'entities-source',
  );
});

test('packs by place, restores exact bytes into a fresh checkout and keeps local edits', async () => {
  const root = await fixture();
  const lock = await packReferences({ root, log: quiet });
  assert.deepEqual(
    lock.files.map((f) => f.path),
    [photo, scan],
  );
  assert.deepEqual(
    lock.archives.map((a) => [a.file, a.release]),
    [
      ['references-places-c2-part-001.tar', lock.release],
      ['references-places-dp-part-001.tar', lock.release],
    ],
  );
  await checkReferences({ root, log: quiet });
  // A fresh checkout has the lock and the text records, but no reference material.
  const fresh = await fixture();
  await rm(join(fresh, photo));
  await rm(join(fresh, scan));
  await writeFile(
    join(fresh, 'reference-lock.json'),
    await readFile(join(root, 'reference-lock.json')),
  );
  const requested = [];
  await fetchReferences({
    root: fresh,
    prefix: `${seattle}/`,
    fetchImpl: releaseServer(root, requested),
    log: quiet,
  });
  assert.deepEqual(requested, [`${lock.release}/references-places-c2-part-001.tar`]);
  assert.equal(await readFile(join(fresh, photo), 'utf8'), 'north elevation photo bytes');
  await assert.rejects(readFile(join(fresh, scan)), /ENOENT/);
  await put(fresh, photo, 'my newer crop');
  const result = await fetchReferences({ root: fresh, fetchImpl: releaseServer(root), log: quiet });
  assert.deepEqual(result, { restored: 1, preserved: 1 });
  assert.equal(await readFile(join(fresh, photo), 'utf8'), 'my newer crop');
  await assert.rejects(checkReferences({ root: fresh, log: quiet }), /Changed .*north-elevation/);
});

test('a new place packs only its own archive; unchanged archives keep their release', async () => {
  const root = await fixture();
  const first = await packReferences({ root, log: quiet });
  const added = 'content/worldgen/source/places/u3/u35/ksiaz/references/gate.jpg';
  await put(root, added, 'gate photo');
  const messages = [];
  const second = await packReferences({ root, log: (line) => messages.push(line) });
  assert.notEqual(second.release, first.release);
  const releases = Object.fromEntries(second.archives.map((a) => [a.file, a.release]));
  assert.deepEqual(releases, {
    'references-places-c2-part-001.tar': first.release,
    'references-places-dp-part-001.tar': first.release,
    'references-places-u3-part-001.tar': second.release,
  });
  assert.match(messages.join('\n'), /1 new for references-[a-f0-9]{16}, 2 unchanged/);
  validateReferenceLock(second);
  // A restore pulls each archive from the release that holds it.
  const fresh = await fixture();
  await rm(join(fresh, photo));
  await writeFile(join(fresh, 'reference-lock.json'), JSON.stringify(second));
  const requested = [];
  await fetchReferences({ root: fresh, fetchImpl: releaseServer(root, requested), log: quiet });
  assert.deepEqual(requested.sort(), [
    `${first.release}/references-places-c2-part-001.tar`,
    `${second.release}/references-places-u3-part-001.tar`,
  ]);
  assert.equal(await readFile(join(fresh, added), 'utf8'), 'gate photo');
});

test('never drops a pinned reference that is merely missing unless asked to prune', async () => {
  const root = await fixture();
  await packReferences({ root, log: quiet });
  await rm(join(root, scan));
  await assert.rejects(
    packReferences({ root, log: quiet }),
    /1 pinned reference files are not on disk/,
  );
  const pruned = await packReferences({ root, prune: true, log: quiet });
  assert.deepEqual(
    pruned.files.map((f) => f.path),
    [photo],
  );
});

test('rejects locks whose archives miss files or whose release does not match them', async () => {
  const root = await fixture();
  const lock = await packReferences({ root, log: quiet });
  assert.throws(
    () => validateReferenceLock({ ...lock, archives: lock.archives.slice(1) }),
    /do not cover every file/,
  );
  assert.throws(
    () => validateReferenceLock({ ...lock, release: 'references-0000000000000000' }),
    /does not match files/,
  );
  assert.throws(
    () =>
      validateReferenceLock({
        ...lock,
        files: [
          { ...lock.files[0], path: `${seattle}/references/../../escape.jpg` },
          lock.files[1],
        ],
      }),
    /Unsafe reference path|Invalid/,
  );
});

/** A fake `gh` over in-memory releases; records every call. */
function fakeGitHub(releases, calls = []) {
  let nextId = 100 + releases.length;
  return (args) => {
    calls.push(args);
    const [command, ...rest] = args;
    if (command === 'api' && rest[0] === '--method' && rest[1] === 'POST') {
      const { tag_name } = JSON.parse(readFileSync(rest.at(-1), 'utf8'));
      const release = { id: nextId++, tag_name, draft: true, assets: [] };
      releases.push(release);
      return JSON.stringify(release);
    }
    if (command === 'api') {
      const assets = rest.at(-1).match(/releases\/(\d+)\/assets/);
      if (assets) return JSON.stringify([releases.find((r) => r.id === Number(assets[1])).assets]);
      return JSON.stringify([releases]);
    }
    if (command === 'release' && rest[0] === 'upload') {
      const bytes = readFileSync(rest[2]);
      releases
        .find((r) => r.tag_name === rest[1])
        .assets.push({
          name: rest[2].split(/[\\/]/).at(-1),
          size: bytes.length,
          digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
        });
      return '';
    }
    if (command === 'release' && rest[0] === 'edit') {
      releases.find((r) => r.tag_name === rest[1]).draft = false;
      return '';
    }
    throw new Error(`Unexpected gh ${args.join(' ')}`);
  };
}

test('publishes only the archives a lock added, after checking older releases are live', async () => {
  const root = await fixture();
  const target = 'a'.repeat(40);
  const releases = [];
  await packReferences({ root, log: quiet });
  await publishReferences({ root, target, runGh: fakeGitHub(releases), log: quiet });
  assert.equal(releases.length, 1);
  assert.equal(releases[0].draft, false);
  assert.deepEqual(releases[0].assets.map((a) => a.name).sort(), [
    'reference-lock.json',
    'references-places-c2-part-001.tar',
    'references-places-dp-part-001.tar',
  ]);
  await put(root, 'content/worldgen/source/places/u3/u35/ksiaz/references/gate.jpg', 'gate');
  const second = await packReferences({ root, log: quiet });
  const calls = [];
  await publishReferences({ root, target, runGh: fakeGitHub(releases, calls), log: quiet });
  const uploaded = calls.filter((c) => c[0] === 'release' && c[1] === 'upload').map((c) => c[3]);
  assert.deepEqual(uploaded.map((path) => path.split(/[\\/]/).at(-1)).sort(), [
    'reference-lock.json',
    'references-places-u3-part-001.tar',
  ]);
  assert.equal(releases.find((r) => r.tag_name === second.release).draft, false);
  // A lock that points at an unpublished release is refused before anything is uploaded.
  await put(root, `${chicago}/references/lobby.jpg`, 'lobby');
  await packReferences({ root, log: quiet });
  await assert.rejects(
    publishReferences({ root, target, runGh: fakeGitHub([]), log: quiet }),
    /is not published; publish the lock that created it first/,
  );
});

async function bundle(root, documents) {
  await put(
    root,
    `${seattle}/source.json`,
    JSON.stringify({
      format: 'molen/source-bundle@1',
      id: 'molen.test',
      kind: 'entity',
      title: 'Space Needle',
      files: {
        definitions: [],
        models: [],
        scripts: [],
        textures: [],
        sounds: [],
        documents,
      },
    }),
  );
}

test('source checks accept a pinned reference anywhere it was not fetched', async () => {
  const root = await fixture();
  await rm(join(root, scan));
  await bundle(root, ['references/north-elevation.jpg', 'references/provenance.json']);
  // Present locally but unpinned: committing it would leave every other checkout without it.
  await assert.rejects(
    checkSourceBundles({ root, log: quiet }),
    /not pinned in reference-lock\.json/,
  );
  await packReferences({ root, log: quiet });
  await rm(join(root, photo));
  await checkSourceBundles({ root, log: quiet });
  await rm(join(root, 'reference-lock.json'));
  await assert.rejects(checkSourceBundles({ root, log: quiet }), /neither on disk nor pinned/);
});

test('tracked reference material fails source checks until untracked; untrack needs a pin', async () => {
  const root = await fixture();
  execFileSync('git', ['add', '-f', photo], { cwd: root });
  await assert.rejects(
    checkSourceBundles({ root, log: quiet }),
    /must stay out of Git \(1 tracked\)/,
  );
  await assert.rejects(untrackReferences({ root, log: quiet }), /run pnpm references:pack first/);
  await packReferences({ root, log: quiet });
  const messages = [];
  assert.deepEqual(await untrackReferences({ root, log: (line) => messages.push(line) }), [photo]);
  assert.match(
    messages.join('\n'),
    /git rm --cached --quiet --pathspec-from-file=\.artifacts\/reference-packs\/untrack\.txt/,
  );
  execFileSync(
    'git',
    ['rm', '--cached', '--quiet', '--pathspec-from-file=.artifacts/reference-packs/untrack.txt'],
    { cwd: root },
  );
  assert.equal(await readFile(join(root, photo), 'utf8'), 'north elevation photo bytes');
  assert.deepEqual(await untrackReferences({ root, log: quiet }), []);
  assert.ok(await readReferenceLock(root));
});
