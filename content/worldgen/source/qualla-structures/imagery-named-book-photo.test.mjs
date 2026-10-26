import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectNamedBookPhotographReference } from './imagery-inventory.mjs';

test('book photographs bind named expired creator, dated publication, native grant and original bytes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-named-book-')),
    relative = 'content/worldgen/source/places/gc/gcr/house',
    dir = path.join(root, relative),
    image = Buffer.from('original photographic plate'),
    hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex'),
    archive = 'historic-homes-volume-3',
    sourceUrl = 'https://commons.wikimedia.org/wiki/File:House.jpg';
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'reference-rights'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'front.jpg'), image);
  const record = {
    source:
      'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3AHouse.jpg',
    query: {
      pages: {
        1: {
          title: 'File:House.jpg',
          revisions: [
            {
              revid: 123,
              slots: {
                main: {
                  '*': `{{Information\n|description=House. From ''Historic Homes''\n|date=1909-12-31\n|source=https://archive.org/details/${archive}\n|author=Charles Photographer (1847-1912)\n}}\n{{PD-old-70-1923}}`,
                },
              },
            },
          ],
          imageinfo: [
            {
              url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/House.jpg',
              sha1: hash(image, 'sha1'),
              extmetadata: {
                Artist: { value: 'Charles Photographer (1847-1912)' },
                LicenseShortName: { value: 'Public domain' },
                Copyrighted: { value: 'False' },
                AttributionRequired: { value: 'false' },
              },
            },
          ],
        },
      },
    },
    publicationEvidence: {
      source: `https://archive.org/metadata/${archive}`,
      catalog: {
        metadata: {
          identifier: archive,
          title: 'Vol 3 Historic Homes',
          date: '1909',
          creator: ['Photographer, Charles, 1847-1912', 'Writer, John'],
          source: 'University Libraries',
          licenseurl: 'http://creativecommons.org/publicdomain/mark/1.0/',
          description:
            'Historic houses from photographs specifically taken by Charles Photographer',
        },
      },
    },
  };
  const reference = {
    path: 'front.jpg',
    sha256: hash(image),
    sourceUrl,
    artist: 'Charles Photographer',
    license: 'Public domain',
    origin: 'commons-expired-named-book-photo',
    visuallyReviewedForThisPolicy: true,
    originalReview: { status: 'inspected', rendition: 'native-original' },
    rightsEvidence: { path: 'reference-rights/book.json' },
    publicDomainEvidence: {
      kind: 'commons-native-expired-named-book-photo',
      path: `${relative}/reference-rights/book.json`,
      publicationTitle: 'Historic Homes',
      publicationYear: 1909,
      creatorBorn: 1847,
      creatorDied: 1912,
      archiveIdentifier: archive,
      archiveCreatorCitation: 'Photographer, Charles, 1847-1912',
    },
  };
  const run = (change = () => {}) => {
    const r = structuredClone(record),
      ref = structuredClone(reference);
    change(r, ref);
    const bytes = JSON.stringify(r);
    fs.writeFileSync(path.join(dir, 'reference-rights/book.json'), bytes);
    ref.rightsEvidence.sha256 = ref.publicDomainEvidence.sha256 = hash(bytes);
    return inspectNamedBookPhotographReference(dir, ref, root);
  };
  assert.equal(run().eligible, true);
  const page = (r) => r.query.pages[1],
    metadata = (r) => r.publicationEvidence.catalog.metadata;
  for (const change of [
    (r) => {
      page(r).imageinfo[0].sha1 = hash('different', 'sha1');
    },
    (r) => {
      page(r).revisions[0].slots.main['*'] = page(r).revisions[0].slots.main['*'].replace(
        'PD-old-70-1923',
        'PD-old',
      );
    },
    (r) => {
      page(r).revisions[0].slots.main['*'] += '\n{{cc-by-sa-4.0}}';
    },
    (r) => {
      page(r).revisions[0].slots.main['*'] = page(r).revisions[0].slots.main['*'].replace(
        'Charles Photographer (1847-1912)',
        'Unknown',
      );
    },
    (r) => {
      page(r).imageinfo[0].extmetadata.Restrictions = { value: 'Permission required' };
    },
    (r) => {
      metadata(r).creator = ['Different, Charles, 1847-1912'];
    },
    (r) => {
      metadata(r).description = 'Photographer unknown';
    },
    (r) => {
      metadata(r).date = '2009';
    },
    (r) => {
      metadata(r).licenseurl = 'https://creativecommons.org/licenses/by/4.0/';
    },
    (r) => {
      metadata(r).source = 'Some website';
    },
    (r) => {
      r.publicationEvidence.source += '-different';
    },
    (_r, ref) => {
      ref.publicDomainEvidence.creatorDied = 1980;
    },
    (_r, ref) => {
      ref.publicDomainEvidence.publicationYear = 1930;
    },
    (_r, ref) => {
      ref.originalReview.status = 'pending';
    },
    (_r, ref) => {
      ref.sha256 = hash('other original');
    },
    (_r, ref) => {
      ref.publicDomainEvidence.path = '../outside.json';
    },
    (_r, ref) => {
      ref.origin = 'archive-expired-named-book';
    },
  ])
    assert.equal(run(change).eligible, false);
  const valid = structuredClone(reference);
  valid.rightsEvidence.sha256 = valid.publicDomainEvidence.sha256 = hash('stale record');
  assert.equal(inspectNamedBookPhotographReference(dir, valid, root).eligible, false);
});
