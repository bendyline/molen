import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectExpiredUsBookReference } from './imagery-expired-us-book.mjs';

const digest = (b) => createHash('sha256').update(b).digest('hex');
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-usbook-')),
    bytes = Buffer.from('%PDF-original-test'),
    title = 'File:An original US book.pdf',
    url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/book.pdf',
    text =
      '{{Book\n|title = Original historic book\n|publisher = New York : Original Publisher\n|publication date = [1911?]\n|source = {{Internet Archive link|original1911}}\n}}\n{{PD-US-expired}}',
    page = {
      ns: 6,
      title,
      imageinfo: [
        {
          url,
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:An_original_US_book.pdf',
          size: bytes.length,
          sha1: createHash('sha1').update(bytes).digest('hex'),
          pagecount: 32,
          extmetadata: {
            Copyrighted: { value: 'False' },
            LicenseShortName: { value: 'Public domain' },
          },
        },
      ],
      revisions: [{ slots: { main: { '*': text } } }],
    },
    native = { query: { pages: { 1: page } } };
  fs.writeFileSync(`${dir}/book.pdf`, bytes);
  const ref = {
    path: 'book.pdf',
    origin: 'commons-expired-us-original-book',
    license: 'Public domain',
    sourceUrl: page.imageinfo[0].descriptionurl,
    downloadUrl: url,
    archiveIdentifier: 'original1911',
    publicationTitle: 'Original historic book',
    publicationPublisher: 'New York : Original Publisher',
    artist: 'Named original author',
    sha256: digest(bytes),
    rightsEvidence: { path: 'native.json' },
    visuallyReviewedForThisPolicy: true,
    originalReview: {
      status: 'inspected',
      rendition: 'native-original-pdf',
      publicationYear: 1911,
      pagesInspected: [7, 9],
      publicationAndCreatorCreditInspected: true,
      notes: 'Original publication and architectural page inspected.',
    },
  };
  return {
    dir,
    ref,
    native,
    page,
    save() {
      const b = Buffer.from(JSON.stringify(native));
      fs.writeFileSync(`${dir}/native.json`, b);
      ref.rightsEvidence.sha256 = digest(b);
    },
    close() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
test('exact native original expired US book passes', () => {
  const f = fixture();
  try {
    f.save();
    assert(inspectExpiredUsBookReference(f.dir, f.ref).eligible);
  } finally {
    f.close();
  }
});
test('the combined native old-100-expired grant also binds an original US publication', () => {
  const f = fixture();
  try {
    for (const [grant, eligible] of [
      ['PD-old-100-expired', true],
      ['PD-old-100', false],
      ['PD-old', false],
    ]) {
      f.page.revisions[0].slots.main['*'] = f.page.revisions[0].slots.main['*'].replace(
        /\{\{PD-[^}]+\}\}/,
        `{{${grant}}}`,
      );
      f.save();
      assert.equal(inspectExpiredUsBookReference(f.dir, f.ref).eligible, eligible);
    }
  } finally {
    f.close();
  }
});
for (const [title, mutate] of Object.entries({
  'wrong original bytes': (f) => fs.appendFileSync(`${f.dir}/book.pdf`, 'x'),
  'stale snapshot hash': (f) => fs.appendFileSync(`${f.dir}/native.json`, ' '),
  'wrong native SHA1': (f) => {
    f.page.imageinfo[0].sha1 = '0'.repeat(40);
    f.save();
  },
  'wrong native size': (f) => {
    f.page.imageinfo[0].size++;
    f.save();
  },
  'missing native grant': (f) => {
    f.page.revisions[0].slots.main['*'] = f.page.revisions[0].slots.main['*'].replace(
      '{{PD-US-expired}}',
      '',
    );
    f.save();
  },
  'modern date': (f) => {
    f.page.revisions[0].slots.main['*'] = f.page.revisions[0].slots.main['*'].replace(
      '1911',
      '1991',
    );
    f.ref.originalReview.publicationYear = 1991;
    f.save();
  },
  'different publication': (f) => {
    f.ref.publicationTitle = 'A different work';
  },
  'different archive': (f) => {
    f.ref.archiveIdentifier = 'differentbook';
  },
  'different publisher': (f) => {
    f.ref.publicationPublisher = 'London : Modern Editor';
  },
  'unreviewed original': (f) => {
    f.ref.visuallyReviewedForThisPolicy = false;
  },
  'no creator publication inspection': (f) => {
    f.ref.originalReview.publicationAndCreatorCreditInspected = false;
  },
  'page out of range': (f) => {
    f.ref.originalReview.pagesInspected = [33];
  },
  'attribution licence conflict': (f) => {
    f.page.imageinfo[0].extmetadata.UsageTerms = { value: 'CC BY 2.0' };
    f.save();
  },
  'different download': (f) => {
    f.ref.downloadUrl = 'https://example.com/different.pdf';
  },
  'different origin': (f) => {
    f.ref.origin = 'archive-expired-named-book';
  },
  'path escape': (f) => {
    f.ref.path = '../book.pdf';
  },
}))
  test(`rejects ${title}`, () => {
    const f = fixture();
    try {
      f.save();
      mutate(f);
      assert.equal(inspectExpiredUsBookReference(f.dir, f.ref).eligible, false);
    } finally {
      f.close();
    }
  });
