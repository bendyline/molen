import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  inspectImageryPolicy,
  PUBLIC_DOMAIN_POLICY,
  publicDomainLabel,
  publicDomainReviewMatches,
} from './imagery-policy.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-image-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, value) => {
    const target = path.join(root, p);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const image = {
    path: '_m/a/b/c/d/story/front.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Front.jpg',
    license: 'Public domain',
    artist: 'Original photographer',
  };
  const metadata = { gallery: [{ ...image, categories: ['PD-self'] }], galleryPaths: [image.path] };
  const story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' };
  put(image.path, 'original pixels');
  put('_m/a/b/c/d/story/metadata.json', metadata);
  put(story.sourcePath, { media: { images: [image] } });
  const reference = {
    ...image,
    sha256: createHash('sha256').update('original pixels').digest('hex'),
  };
  const run = (extra = {}) =>
    inspectImageryPolicy({ qualla: root, references: [reference], stories: [story], ...extra });
  return { root, put, image, metadata, story, reference, run };
}
test('attribution licenses and ambiguous labels do not qualify as public domain', () => {
  for (const value of ['CC BY 4.0', 'CC BY-SA 3.0', 'Public domain?', 'unknown', '', null])
    assert.equal(publicDomainLabel(value), false);
  for (const value of ['Public domain', 'CC0', 'CC0 1.0'])
    assert.equal(publicDomainLabel(value), true);
});
test('matching published Qualla metadata and original bytes qualify', (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 'passed');
  assert.deepEqual(f.run().references[0].publishedIn, [
    { storyId: 'story', articlePath: f.story.sourcePath },
  ]);
  f.put(f.image.path, 'replacement pixels');
  assert.ok(f.run().references[0].blockers.includes('original-bytes-unbound'));
});
test('gallery downloads, conflicting aliases and architecture-only tags cannot establish clearance', (t) => {
  const f = fixture(t);
  f.put(f.story.sourcePath, { media: { images: [] } });
  assert.ok(f.run().references[0].blockers.includes('not-in-matching-published-qualla-media'));
  f.put(f.story.sourcePath, { media: { images: [f.image] } });
  assert.ok(
    f
      .run({ conflicts: [{ path: f.image.path }] })
      .references[0].blockers.includes('conflicting-source-records'),
  );
  f.metadata.gallery[0].categories = ['PD-US architecture'];
  f.put('_m/a/b/c/d/story/metadata.json', f.metadata);
  assert.ok(f.run().references[0].blockers.includes('public-domain-basis-not-recorded'));
  f.metadata.gallery[0].artist = 'Different photographer';
  f.put('_m/a/b/c/d/story/metadata.json', f.metadata);
  assert.ok(f.run().references[0].blockers.includes('original-source-metadata-disagrees'));
});
test('an empty reference set remains unapproved', (t) => {
  assert.equal(fixture(t).run({ references: [] }).status, 'needs-replacement');
});
test('an identical published copy can refer to the canonical cleared original', (t) => {
  const f = fixture(t),
    copy = '_m/a/b/c/d/published-copy/front.jpg';
  f.put(copy, 'original pixels');
  f.put(f.story.sourcePath, { media: { images: [{ ...f.image, path: copy }] } });
  const result = f.run();
  assert.equal(result.status, 'passed');
  assert.deepEqual(result.references[0].publishedAliases, [
    { path: copy, sha256: f.reference.sha256 },
  ]);
  f.put(copy, 'changed published pixels');
  assert.ok(f.run().references[0].blockers.includes('not-in-matching-published-qualla-media'));
});
test('published-copy aliases cannot override different licenses, authors or conflicts', (t) => {
  const f = fixture(t),
    copy = '_m/a/b/c/d/published-copy/front.jpg';
  f.put(copy, 'original pixels');
  for (const change of [{ license: 'CC BY 4.0' }, { artist: 'Another photographer' }]) {
    f.put(f.story.sourcePath, { media: { images: [{ ...f.image, path: copy, ...change }] } });
    assert.notEqual(f.run().status, 'passed');
  }
  f.put(f.story.sourcePath, { media: { images: [{ ...f.image, path: copy }] } });
  assert.notEqual(f.run({ conflicts: [{ path: copy }] }).status, 'passed');
  f.put('_m/a/b/c/d/story/metadata.json', { gallery: [], galleryPaths: [] });
  assert.ok(f.run().references[0].blockers.includes('original-source-metadata-disagrees'));
});
test('the legacy Commons PD Old category records expired copyright; a bare mark does not', (t) => {
  const f = fixture(t);
  f.metadata.gallery[0].categories = ['CC-PD-Mark', 'PD Old'];
  f.put('_m/a/b/c/d/story/metadata.json', f.metadata);
  assert.equal(f.run().status, 'passed');
  assert.deepEqual(f.run().references[0].publicDomainBasis, ['PD Old']);
  f.metadata.gallery[0].categories = ['CC-PD-Mark'];
  f.put('_m/a/b/c/d/story/metadata.json', f.metadata);
  assert.ok(f.run().references[0].blockers.includes('public-domain-basis-not-recorded'));
});
test('the Commons PD US category records the basis but its maintenance category cannot replace it', (t) => {
  const f = fixture(t);
  f.metadata.gallery[0].categories = ['PD US', 'PD-US missing SDC copyright status'];
  f.put('_m/a/b/c/d/story/metadata.json', f.metadata);
  assert.equal(f.run().status, 'passed');
  assert.deepEqual(f.run().references[0].publicDomainBasis, ['PD US']);
  for (const categories of [
    ['PD-US missing SDC copyright status'],
    ['PD US architecture'],
    ['PD-US architecture', 'PD-US missing SDC copyright status'],
  ]) {
    f.metadata.gallery[0].categories = categories;
    f.put('_m/a/b/c/d/story/metadata.json', f.metadata);
    assert.ok(f.run().references[0].blockers.includes('public-domain-basis-not-recorded'));
  }
});
test('legacy approval cannot stand in for an all-imagery public-domain fidelity review', () => {
  const references = { inputHash: 'references-1', references: [{ path: 'front.jpg' }] };
  const review = {
    policy: PUBLIC_DOMAIN_POLICY,
    status: 'passed',
    scope: 'all-model-reference-imagery',
    inputHash: 'model-1',
    referenceInputHash: 'references-1',
    acceptedReferencePaths: ['front.jpg'],
    excludedHistoricalImagery: [],
    notes:
      'Current model views inspected against the accepted public-domain original; auxiliary imagery audited.',
  };
  assert.equal(publicDomainReviewMatches(undefined, references, 'model-1'), false);
  assert.equal(publicDomainReviewMatches(review, references, 'model-1'), true);
  assert.equal(publicDomainReviewMatches(review, references, 'changed-model'), false);
  assert.equal(
    publicDomainReviewMatches(
      review,
      { ...references, inputHash: 'changed-references' },
      'model-1',
    ),
    false,
  );
  assert.equal(
    publicDomainReviewMatches(
      { ...review, acceptedReferencePaths: ['front.jpg', 'uncleared.jpg'] },
      references,
      'model-1',
    ),
    false,
  );
  assert.equal(
    publicDomainReviewMatches({ ...review, scope: 'main-photo-only' }, references, 'model-1'),
    false,
  );
});
