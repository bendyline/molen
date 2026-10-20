import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PUBLIC_DOMAIN_POLICY } from './imagery-policy.mjs';
import { collectReferences, prepareBatch, sourceFamily } from './prepare-batch.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qualla-reference-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const put = (p, v) => {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), typeof v === 'string' ? v : JSON.stringify(v));
  };
  const story = {
    id: 'test',
    sourcePath: '_c/art/a/b/c/d/test.json',
    url: 'https://example.test/story',
    contentHash: 'story-1',
  };
  put(story.sourcePath, {
    media: {
      images: [
        {
          path: '_m/a/b/c/d/test/old.jpg',
          filename: 'Wrong.jpg',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wrong.jpg',
        },
      ],
    },
  });
  const first = {
    filename: 'Front.jpg',
    descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Front.jpg',
    width: 1800,
    height: 1200,
  };
  put('_m/a/b/c/d/test/front.jpg', 'image-original-1');
  put('_m/a/b/c/d/test/side.jpg', 'image-original-2');
  put('_m/a/b/c/d/test/metadata.json', {
    gallery: [
      first,
      { filename: 'Side.jpg', descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Side.jpg' },
    ],
    galleryPaths: ['_m/a/b/c/d/test/front.jpg', '_m/a/b/c/d/test/side.jpg'],
  });
  const entry = {
    order: 1,
    structureId: 'QS-test',
    name: 'Test building',
    scope: 'Exterior',
    era: 'Dated reference exterior',
    references: ['_m/a/b/c/d/test/front.jpg'],
    referenceSelection: 'manual',
    modelState: 'not-started',
  };
  const structure = {
    id: 'QS-test',
    name: entry.name,
    coordinate: [0, 0],
    status: 'new',
    stories: [story],
    existing: [],
  };
  put('structures.jsonl', `${JSON.stringify(structure)}\n`);
  const batch = { id: 'test', targetCount: 1, entries: [entry] };
  put('batch.json', batch);
  put('content/worldgen/source/next-1000/candidates.json', { candidates: [] });
  put('content/worldgen/source/next-1000/collections.json', { collections: [] });
  const run = (opts = {}) =>
    prepareBatch({
      qualla: dir,
      repository: dir,
      output: dir,
      batchPath: path.join(dir, 'batch.json'),
      ...opts,
    });
  const record = () => JSON.parse(fs.readFileSync(path.join(dir, 'references/QS-test.json')));
  return { dir, put, entry, structure, batch, run, record };
}
test('authoritative gallery paths recover originals absent from merged article', (t) => {
  const f = fixture(t),
    r = collectReferences(f.dir, [f.structure], f.entry);
  assert.equal(r.candidates.length, 2);
  assert.ok(r.candidates.every((r) => r.metadataOrigin.endsWith('metadata.json')));
  assert.ok(!r.candidates.some((r) => r.path.endsWith('old.jpg')));
});
test('public-domain policy rejects uncertain manual choices before writing and selects published eligible originals', (t) => {
  const f = fixture(t);
  f.batch.policy = { imagery: { id: PUBLIC_DOMAIN_POLICY } };
  f.put('batch.json', f.batch);
  assert.throws(() => f.run(), /Public-domain Qualla references required/);
  assert.equal(fs.existsSync(path.join(f.dir, 'references/QS-test.json')), false);
  const metadata = JSON.parse(fs.readFileSync(path.join(f.dir, '_m/a/b/c/d/test/metadata.json')));
  Object.assign(metadata.gallery[0], {
    license: 'CC0',
    artist: 'Photographer',
    categories: ['CC-Zero'],
  });
  f.put('_m/a/b/c/d/test/metadata.json', metadata);
  f.put(f.structure.stories[0].sourcePath, {
    media: { images: [{ ...metadata.gallery[0], path: '_m/a/b/c/d/test/front.jpg' }] },
  });
  f.entry.references = [];
  f.put('batch.json', f.batch);
  f.run();
  assert.deepEqual(
    f.record().references.map((r) => r.path),
    ['_m/a/b/c/d/test/front.jpg'],
  );
  assert.equal(f.record().review.state, 'pending');
});
test('source families collapse Commons URL spellings and resized copies', (t) => {
  const f = fixture(t);
  assert.equal(
    sourceFamily({ sourceUrl: 'https://commons.wikimedia.org/wiki/File:A_B.jpg' }),
    sourceFamily({ sourceUrl: 'https://commons.wikimedia.org/wiki/File:A%20B.jpg' }),
  );
  f.put('_m/a/b/c/d/test/copy.jpg', 'copy');
  f.put(f.structure.stories[0].sourcePath, {
    media: {
      images: [
        {
          path: '_m/a/b/c/d/test/copy.jpg',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Front.jpg',
          width: 400,
          height: 300,
        },
      ],
    },
  });
  assert.equal(
    collectReferences(f.dir, [f.structure], f.entry).candidates.filter(
      (c) => c.filename === 'Front.jpg',
    ).length,
    1,
  );
  assert.ok(
    !collectReferences(f.dir, [f.structure], f.entry).candidates.some((c) =>
      c.path.endsWith('copy.jpg'),
    ),
  );
});
test('targeted preparation preserves unselected evidence and still rejects unknown identities', (t) => {
  const f = fixture(t);
  f.run();
  const other = {
    ...f.entry,
    structureId: 'QS-other',
    modelIdentity: 'second',
    references: ['_m/a/b/c/d/test/unavailable.jpg'],
  };
  f.entry.modelIdentity = 'first';
  f.batch.entries.push(other);
  f.batch.targetCount = 2;
  f.put(
    'structures.jsonl',
    `${JSON.stringify(f.structure)}\n${JSON.stringify({ ...f.structure, id: other.structureId })}\n`,
  );
  f.put('references/QS-other.json', { ...f.record(), structureId: other.structureId });
  f.put('batch.json', f.batch);
  const before = fs.readFileSync(path.join(f.dir, 'references/QS-other.json'));
  f.run({ ids: ['first'] });
  assert.ok(before.equals(fs.readFileSync(path.join(f.dir, 'references/QS-other.json'))));
  assert.equal(f.run({ ids: ['first'], check: true }).filesChanged, 0);
  assert.throws(() => f.run({ ids: ['not-in-batch'] }), /fixed batch/);
});
test('acceptance invalidates when selected bytes, story, scope or attribution change', (t) => {
  const f = fixture(t);
  f.run();
  const first = f.record().inputHash;
  f.put('batches/reference-reviews.json', {
    reviews: { 'QS-test': { inputHash: first, state: 'accepted' } },
  });
  f.run();
  assert.equal(f.record().review.state, 'accepted');
  f.put('_m/a/b/c/d/test/front.jpg', 'changed-image');
  f.run();
  assert.equal(f.record().review.state, 'stale');
  f.put('_m/a/b/c/d/test/front.jpg', 'image-original-1');
  f.batch.entries[0].scope = 'Another building';
  f.put('batch.json', f.batch);
  f.run();
  assert.equal(f.record().review.state, 'stale');
  f.batch.entries[0].scope = 'Exterior';
  f.put('batch.json', f.batch);
  f.structure.stories[0].contentHash = 'story-2';
  f.put('structures.jsonl', `${JSON.stringify(f.structure)}\n`);
  f.run();
  assert.equal(f.record().review.state, 'stale');
  f.structure.stories[0].contentHash = 'story-1';
  f.put('structures.jsonl', `${JSON.stringify(f.structure)}\n`);
  const p = '_m/a/b/c/d/test/metadata.json';
  const m = JSON.parse(fs.readFileSync(path.join(f.dir, p)));
  m.gallery[0].license = 'corrected-attribution';
  f.put(p, m);
  f.run();
  assert.equal(f.record().review.state, 'stale');
});
test('rejected suggestions remain empty; rerun and check are byte-stable', (t) => {
  const f = fixture(t);
  f.entry.references = [];
  f.entry.referenceSelection = 'needs-replacement';
  f.put('batch.json', f.batch);
  f.run();
  assert.equal(f.record().references.length, 0);
  f.put('batches/reference-reviews.json', {
    reviews: { 'QS-test': { inputHash: f.record().inputHash, state: 'needs-reference' } },
  });
  f.run();
  assert.equal(f.record().review.state, 'needs-reference');
  assert.equal(f.run().filesChanged, 0);
  assert.equal(f.run({ check: true }).filesChanged, 0);
});
test('missing selected image fails closed and cannot become accepted', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.dir, f.entry.references[0]));
  assert.throws(() => f.run(), /Selected reference disappeared/);
});
test('duplicate frozen identities and duplicate selected sources are rejected', (t) => {
  const f = fixture(t);
  f.batch.targetCount = 2;
  f.batch.entries.push({ ...f.entry });
  f.put('batch.json', f.batch);
  assert.throws(() => f.run(), /count\/identity/);
  f.batch.entries.pop();
  f.batch.targetCount = 1;
  f.entry.references.push(f.entry.references[0]);
  f.put('batch.json', f.batch);
  assert.throws(() => f.run(), /distinct reference/);
});

test('a new next-1,000 reservation rejects a stale local selection before writing', (t) => {
  const f = fixture(t);
  f.put('content/worldgen/source/next-1000/candidates.json', {
    candidates: [
      { id: 'N0904', title: f.entry.name, referenceCoordinate: { longitude: 0, latitude: 0 } },
    ],
  });
  assert.throws(() => f.run(), /Other-device work cannot enter the local batch/);
  assert.equal(fs.existsSync(path.join(f.dir, 'references')), false);
});

test('collection member aliases remain reserved even when a model is already ready', (t) => {
  const f = fixture(t);
  f.structure.status = 'existing-ready';
  f.structure.existing = [{ candidateId: 'N0208_MSU', basis: 'editorial-identity' }];
  f.put('structures.jsonl', `${JSON.stringify(f.structure)}\n`);
  f.put('content/worldgen/source/next-1000/collections.json', {
    collections: [{ id: 'N0208', members: [{ id: 'N0208_MSU', title: 'Different named alias' }] }],
  });
  assert.throws(() => f.run(), /Other-device work cannot enter the local batch/);
});
