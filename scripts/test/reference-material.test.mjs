// Reference material is scratch: Git ignores exactly it, no check needs it, and none may be committed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { afterEach, test } from 'node:test';
import { checkSourceBundles } from '../check-source-bundles.mjs';
import { isReferenceMaterial, trackedReferenceMaterial } from '../reference-material.mjs';

const roots = [];
const quiet = () => {};
const seattle = 'content/worldgen/source/places/c2/c23/space_needle';
const chicago = 'content/worldgen/source/places/dp/dp3/willis_tower';
const photo = `${seattle}/references/north-elevation.jpg`;
const scan = `${chicago}/reference-originals/1974-plans.pdf`;
const notes = `${seattle}/references/provenance.json`;
const REFERENCES = [
  photo,
  scan,
  `${seattle}/reference-images/aerial.png`,
  `${seattle}/terrain-sources/usgs/tile.bin`,
  `${seattle}/terrain-sources/window.tif`,
  `${chicago}/reference-rights/license-page.pdf`,
  `${chicago}/reference-rights/original-operator-report-20110817.txt`,
  `${chicago}/reference-rights/original-tower-spec.txt`,
];
const RECORDS = [
  notes,
  `${seattle}/reference-images.json`,
  `${seattle}/references/README.md`,
  `${seattle}/terrain-sources/fetch.py`,
  `${seattle}/textures/brick.png`,
  `${seattle}/preview.png`,
  `${chicago}/reference-rights/license-page.html`,
  `${chicago}/reference-rights/original-1918-title-page.txt`,
  `${chicago}/reference-rights/primary-building.txt`,
  `${chicago}/reference-rights/original-commons.json`,
  `${chicago}/original-notes.txt`,
];

async function put(root, path, bytes) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), bytes);
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'molen-references-'));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await put(root, notes, '{"source":"text records stay in Git"}');
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    assert.ok(resolve(root).startsWith(`${resolve(tmpdir())}${sep}molen-references-`));
    await rm(root, { recursive: true, force: true });
  }
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
      files: { definitions: [], models: [], scripts: [], textures: [], sounds: [], documents },
    }),
  );
}

test('selects binary references, scans, terrain downloads and copied text, never their records', () => {
  for (const path of REFERENCES) assert.equal(isReferenceMaterial(path), true, path);
  for (const path of [
    ...RECORDS,
    `${seattle}/references/no-extension`,
    'docs/plans/brief.pdf',
    'examples/game/references/photo.jpg',
  ])
    assert.equal(isReferenceMaterial(path), false, path);
});

test('Git ignores exactly what counts as reference material', async () => {
  const root = await fixture();
  await writeFile(
    join(root, '.gitignore'),
    await readFile(new URL('../../.gitignore', import.meta.url)),
  );
  const ignored = (path) => {
    try {
      execFileSync('git', ['check-ignore', '--no-index', '--quiet', path], { cwd: root });
      return true;
    } catch {
      return false;
    }
  };
  for (const path of [...REFERENCES, ...RECORDS])
    assert.equal(ignored(path), isReferenceMaterial(path), path);
});

test('a source bundle may name its references, and no checkout has to hold them', async () => {
  const root = await fixture();
  await bundle(root, ['references/north-elevation.jpg', 'references/provenance.json']);
  await checkSourceBundles({ root, log: quiet });
  // Nor does one that has them have to name them: they are that machine's scratch.
  await put(root, photo, 'north elevation photo bytes');
  await put(root, `${seattle}/references/another.jpg`, 'scratch');
  await checkSourceBundles({ root, log: quiet });
  // Everything else is still required, and still has to be named.
  await rm(join(root, notes));
  await assert.rejects(checkSourceBundles({ root, log: quiet }), /ENOENT.*provenance\.json/);
  await put(root, notes, '{}');
  await put(root, `${seattle}/plan-controls.json`, '{}');
  await assert.rejects(
    checkSourceBundles({ root, log: quiet }),
    /source files missing from manifest: plan-controls\.json/,
  );
});

test('committed reference material fails source checks until it is removed', async () => {
  const root = await fixture();
  await put(root, photo, 'north elevation photo bytes');
  execFileSync('git', ['add', '-f', photo], { cwd: root });
  assert.deepEqual(trackedReferenceMaterial(root), [photo]);
  await assert.rejects(
    checkSourceBundles({ root, log: quiet }),
    /must stay out of Git \(1 tracked\)[\s\S]*git rm --cached/,
  );
  // Deleting it is enough: the next commit removes it.
  await rm(join(root, photo));
  assert.deepEqual(trackedReferenceMaterial(root), []);
  await checkSourceBundles({ root, log: quiet });
});

test('nothing packs, pins or publishes references or review renders any more', async () => {
  const { scripts } = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    Object.keys(scripts).filter((name) => /^(references|reviews):/.test(name)),
    [],
  );
});
