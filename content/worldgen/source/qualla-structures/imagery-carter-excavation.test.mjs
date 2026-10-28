import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectCarterExcavationReference } from './imagery-carter-excavation.mjs';

const hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-carter-original-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const id = 'tomboftutankhame00cart_1',
    pdf = Buffer.from('%PDF-1.7\noriginal1923volume'),
    record = {
      source: `https://archive.org/metadata/${id}`,
      metadata: {
        identifier: id,
        'possible-copyright-status': 'No Copyright- United States',
        collection: ['mitlibrariespublicdomain'],
        contributor: 'MIT Libraries',
        date: '1923',
        publisher: 'New York, George H. Doran Co',
        title:
          'The tomb of Tut-ankh-Amen, discovered by the late Earl of Carnarvon and Howard Carter;',
        creator: 'Carter, Howard, 1874-1939, author',
        'associated-names': 'Mace, A. C. (Arthur Cruttenden), 1874-1928, author',
      },
      files: [{ name: `${id}.pdf`, size: String(pdf.length), sha1: hash(pdf, 'sha1') }],
    },
    ref = {
      path: 'original.pdf',
      origin: 'archive-carter-1923-original-volume',
      archiveIdentifier: id,
      license: 'Public domain',
      sourceUrl: `https://archive.org/details/${id}`,
      downloadUrl: `https://archive.org/download/${id}/${id}.pdf`,
      title: record.metadata.title,
      artist: 'Howard Carter; A. C. Mace; photographs by Harry Burton',
      sha256: hash(pdf),
      rightsEvidence: { path: 'native.json', sourceUrl: record.source },
      visuallyReviewedForThisPolicy: true,
      originalReview: {
        status: 'inspected',
        rendition: 'native-original-pdf',
        publicationYear: 1923,
        scope: 'original-1923-first-volume-architecture-only',
        publicationAndCreatorCreditInspected: true,
        originalUsCopyrightPageInspected: true,
        planPdfPage: 17,
        titlePdfPage: 11,
        copyrightPdfPage: 12,
        entrancePdfPage: 152,
        staircasePdfPage: 157,
        pagesInspected: [11, 12, 17, 152, 157],
        notes:
          'Original title/US1923copyright/whole plan/entrance/steps inspected; exact native original bound.',
      },
    };
  fs.writeFileSync(path.join(dir, ref.path), pdf);
  const run = () => {
    const bytes = JSON.stringify(record);
    fs.writeFileSync(path.join(dir, 'native.json'), bytes);
    ref.rightsEvidence.sha256 = hash(bytes);
    return inspectCarterExcavationReference(dir, ref);
  };
  return { dir, record, ref, run };
}
test('exact original first-volume architecture binds native US release, edition, credits and bytes', (t) => {
  assert.equal(fixture(t).run().eligible, true);
});
for (const [name, mutate] of [
  [
    'later1933edition',
    (f) => {
      f.record.metadata.date = '1933';
    },
  ],
  [
    'different volume',
    (f) => {
      f.record.metadata.identifier = 'tomboftutankhame02cart';
    },
  ],
  [
    'London edition',
    (f) => {
      f.record.metadata.publisher = 'London, Cassell';
    },
  ],
  [
    'no explicit US release',
    (f) => {
      f.record.metadata['possible-copyright-status'] = 'Unknown';
    },
  ],
  [
    'archive custody alone',
    (f) => {
      f.record.metadata.collection = ['mitlibraries'];
    },
  ],
  [
    'different named author',
    (f) => {
      f.record.metadata.creator = 'Unknown author';
    },
  ],
  [
    'unbound coauthor',
    (f) => {
      f.record.metadata['associated-names'] = 'Another editor';
    },
  ],
  [
    'restricted item',
    (f) => {
      f.record.metadata['access-restricted-item'] = 'true';
    },
  ],
  [
    'dark item',
    (f) => {
      f.record.is_dark = true;
    },
  ],
  [
    'wrong original size',
    (f) => {
      f.record.files[0].size = '19';
    },
  ],
  [
    'wrong original SHA1',
    (f) => {
      f.record.files[0].sha1 = hash('different', 'sha1');
    },
  ],
  [
    'uninspected US copyright page',
    (f) => {
      f.ref.originalReview.originalUsCopyrightPageInspected = false;
    },
  ],
  [
    'uninspected creator credits',
    (f) => {
      f.ref.originalReview.publicationAndCreatorCreditInspected = false;
    },
  ],
  [
    'uninspected plan',
    (f) => {
      f.ref.originalReview.pagesInspected = [11, 12, 152, 157];
    },
  ],
  [
    'modern image substituted',
    (f) => {
      f.ref.originalReview.rendition = 'modern-reproduction';
    },
  ],
  [
    'unsupported entire-corpus scope',
    (f) => {
      f.ref.originalReview.scope = 'all-archive-images';
    },
  ],
  [
    'changed PDF bytes',
    (f) => {
      fs.writeFileSync(path.join(f.dir, 'original.pdf'), 'changed');
    },
  ],
  [
    'escaping image path',
    (f) => {
      f.ref.path = '../original.pdf';
    },
  ],
])
  test(`reject ${name}`, (t) => {
    const f = fixture(t);
    mutate(f);
    assert.equal(f.run().eligible, false);
  });
