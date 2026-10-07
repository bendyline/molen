import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { after, test } from 'node:test';
import { publishPackRelease } from '../publish-pack-release.mjs';

const quiet = () => {};
const TARGET = 'a'.repeat(40);
const temps = [];
after(async () => {
  for (const dir of temps) await rm(dir, { recursive: true, force: true });
});

/** A built pack directory: zips named by content plus their index. */
async function packsDir(packs) {
  const dir = await mkdtemp(join(tmpdir(), 'molen-pack-release-'));
  temps.push(dir);
  const index = { format: 'molen/pack-index@1', packs: {} };
  for (const [id, text] of Object.entries(packs)) {
    const bytes = Buffer.from(text);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const file = `${id}-${hash.slice(0, 12)}.zip`;
    await writeFile(join(dir, file), bytes);
    index.packs[id] = { version: '1.0.0', file, contentHash: `sha256:${hash}`, size: bytes.length };
  }
  await writeFile(join(dir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  return join(dir, 'index.json');
}

/** GitHub's release API over an in-memory release, recording every command. */
function fakeGitHub() {
  let release;
  const assets = [];
  const commands = [];
  let nextId = 100;
  const runGh = (args) => {
    commands.push(args);
    if (args.some((a) => a.endsWith('/releases?per_page=100')))
      return JSON.stringify([release ? [release] : []]);
    if (args.includes('POST')) {
      release = { id: 7, draft: true, tag_name: 'packs' };
      return JSON.stringify(release);
    }
    if (args.some((a) => a.endsWith('/assets?per_page=100'))) return JSON.stringify([assets]);
    if (args.includes('DELETE')) {
      const id = Number(args.at(-1).split('/').at(-1));
      assets.splice(
        assets.findIndex((a) => a.id === id),
        1,
      );
      return '';
    }
    if (args[0] === 'release' && args[1] === 'upload') {
      const bytes = readFileSync(args[3]);
      const name = basename(args[3]);
      const clash = assets.findIndex((a) => a.name === name);
      if (clash >= 0) {
        if (!args.includes('--clobber')) throw new Error(`asset ${name} already exists`);
        assets.splice(clash, 1);
      }
      assets.push({
        id: nextId++,
        name,
        size: bytes.length,
        digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      });
      return '';
    }
    if (args[0] === 'release' && args[1] === 'edit') {
      release.draft = !args.includes('--draft=false');
      return '';
    }
    throw new Error(`Unexpected command: ${args}`);
  };
  return { runGh, commands, assets, release: () => release };
}

const publish = (github, indexPath, extra = {}) =>
  publishPackRelease({
    indexPath,
    repo: 'bendyline/molen',
    target: TARGET,
    runGh: github.runGh,
    log: quiet,
    ...extra,
  });

const uploadOrder = (github) =>
  github.commands.filter((c) => c[1] === 'upload').map((c) => basename(c[3]));

test('creates the release, uploads every pack before the index, then publishes it', async () => {
  const indexPath = await packsDir({ 'molen.sky': 'stars', 'molen.earth': 'atlas' });
  const github = fakeGitHub();
  const result = await publish(github, indexPath);
  assert.equal(result.created, true);
  assert.equal(result.uploaded.length, 2);
  assert.equal(uploadOrder(github).at(-1), 'index.json');
  assert.deepEqual(
    github.assets.map((a) => a.name).sort(),
    [...result.uploaded, 'index.json'].sort(),
  );
  assert.equal(github.release().draft, false);
  const edit = github.commands.find((c) => c[1] === 'edit');
  assert.ok(edit.includes('--latest=false'));
  assert.match(edit.at(-1), /releases\/download\/packs\/index\.json/);
});

test('uploads nothing again when the packs have not changed', async () => {
  const indexPath = await packsDir({ 'molen.sky': 'stars' });
  const github = fakeGitHub();
  await publish(github, indexPath);
  github.commands.length = 0;
  const again = await publish(github, indexPath);
  assert.deepEqual(again.uploaded, []);
  assert.deepEqual(again.deleted, []);
  assert.deepEqual(uploadOrder(github), []);
});

test('replaces a changed pack: new file, then the index, then the stale file goes', async () => {
  const github = fakeGitHub();
  await publish(github, await packsDir({ 'molen.sky': 'stars', 'molen.earth': 'atlas' }));
  const oldSky = github.assets.find((a) => a.name.startsWith('molen.sky-')).name;
  github.commands.length = 0;
  const next = await publish(
    github,
    await packsDir({ 'molen.sky': 'more stars', 'molen.earth': 'atlas' }),
  );
  assert.equal(next.uploaded.length, 1);
  assert.deepEqual(next.deleted, [oldSky]);
  assert.deepEqual(uploadOrder(github), [next.uploaded[0], 'index.json']);
  // The stale pack is deleted only after the new index is up.
  const indexAt = github.commands.findIndex(
    (c) => c[1] === 'upload' && c[3].endsWith('index.json'),
  );
  const deleteAt = github.commands.findIndex((c) => c.includes('DELETE'));
  assert.ok(deleteAt > indexAt);
  assert.equal(
    github.assets.some((a) => a.name === oldSky),
    false,
  );
});

test('a dry run changes nothing', async () => {
  const github = fakeGitHub();
  const result = await publish(github, await packsDir({ 'molen.sky': 'stars' }), { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(
    github.commands.some((c) => c.includes('POST') || c[1] === 'upload' || c[1] === 'edit'),
    false,
  );
});

test('refuses a file that does not match its index entry, or a nested path', async () => {
  const indexPath = await packsDir({ 'molen.sky': 'stars' });
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  index.packs['molen.sky'].size += 1;
  await writeFile(indexPath, JSON.stringify(index));
  await assert.rejects(publish(fakeGitHub(), indexPath), /the index says/);
  index.packs['molen.sky'].file = 'nested/molen.sky.zip';
  await writeFile(indexPath, JSON.stringify(index));
  await assert.rejects(publish(fakeGitHub(), indexPath), /plain file name/);
  await assert.rejects(
    publishPackRelease({ indexPath, repo: 'bendyline/molen', target: 'main', log: quiet }),
    /40-character commit SHA/,
  );
});
