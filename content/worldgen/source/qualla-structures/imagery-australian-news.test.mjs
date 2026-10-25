import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  inspectExpiredAustralianNewsReference,
  inspectImageryInventory,
} from './imagery-inventory.mjs';
import { PUBLIC_DOMAIN_POLICY } from './imagery-policy.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
test('an expired Australian newspaper photo binds native bytes, old publication, item grant and primary expiry guidance', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-news-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const image = Buffer.from('exact newspaper photograph'),
    sourceUrl = 'https://commons.wikimedia.org/wiki/File:Observatory_1935.JPG',
    downloadUrl = 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Observatory_1935.JPG',
    guideUrl =
      'https://www.library.gov.au/services/copyright-library-collections/rights-and-pictures-collection',
    guide = `<link rel="canonical" href="${guideUrl}" /><p>Photographs taken before 1 January 1955 are all out of copyright.</p>`,
    wiki =
      '{{Information\n|date={{taken on|1935-08-14|location=Australia}}\n|source={{cite news |url=http://nla.gov.au/nla.news-article36774169 |title=OBSERVATORY OPENED. |newspaper=The Courier-Mail |date=14 August 1935 |page=16 |publisher=National Library of Australia}}\n|author={{unknown|author}}\n}}\n{{PD-Australia}}',
    base = {
      requestUrl: 'https://commons.wikimedia.org/w/api.php?action=query',
      query: {
        pages: {
          1: {
            title: 'File:Observatory 1935.JPG',
            revisions: [{ revid: 123, slots: { main: { '*': wiki } } }],
            imageinfo: [
              {
                url: downloadUrl,
                sha1: createHash('sha1').update(image).digest('hex'),
                size: image.length,
                width: 1432,
                height: 1003,
                extmetadata: { LicenseShortName: { value: 'Public domain' } },
              },
            ],
          },
        },
      },
    };
  fs.writeFileSync(path.join(dir, 'image.jpg'), image);
  fs.writeFileSync(path.join(dir, 'terms.html'), guide);
  const ref = {
    path: 'image.jpg',
    sourceUrl,
    downloadUrl,
    origin: 'expired-australian-newspaper-photograph',
    license: 'Public domain',
    artist: 'Unidentified newspaper photographer',
    sha256: hash(image),
    nativeSha1: base.query.pages[1].imageinfo[0].sha1,
    nativeRevision: 123,
    width: 1432,
    height: 1003,
    publication: {
      title: 'The Courier-Mail',
      articleTitle: 'OBSERVATORY OPENED.',
      date: '1935-08-14',
      articleId: '36774169',
      url: 'http://nla.gov.au/nla.news-article36774169',
      page: 16,
    },
    rightsEvidence: { path: 'native.json' },
    expiryEvidence: { path: 'terms.html', sourceUrl: guideUrl, sha256: hash(guide) },
    visuallyReviewedForThisPolicy: true,
    originalReview: { status: 'inspected', rendition: 'native-original' },
  };
  const run = (record = base, change = {}) => {
    const bytes = JSON.stringify(record);
    fs.writeFileSync(path.join(dir, 'native.json'), bytes);
    return inspectExpiredAustralianNewsReference(dir, {
      ...ref,
      rightsEvidence: { path: 'native.json', sha256: hash(bytes) },
      ...change,
    });
  };
  assert.equal(run().eligible, true);
  for (const [from, to] of [
    ['{{PD-Australia}}', '{{CC-BY-4.0}}'],
    ['1935-08-14', '1955-08-14'],
    ['14 August 1935', '14 August 1955'],
    ['36774169', '99999999'],
    ['OBSERVATORY OPENED.', 'OTHER ITEM'],
    ['page=16', 'page=17'],
    ['National Library of Australia', 'Private collection'],
    ['unknown|author', 'self|author'],
  ]) {
    const x = structuredClone(base);
    x.query.pages[1].revisions[0].slots.main['*'] = wiki.replace(from, to);
    assert.equal(run(x).eligible, false, from);
  }
  for (const change of [
    { publication: { ...ref.publication, date: '1946-08-14' } },
    { publication: { ...ref.publication, title: 'Another newspaper' } },
    { artist: 'Photographer not bound' },
    { nativeRevision: 999 },
    { nativeSha1: '0'.repeat(40) },
    { width: 10 },
    { sha256: '0'.repeat(64) },
    { sourceUrl: sourceUrl.replace('commons.wikimedia.org', 'commons.wikimedia.org.example.com') },
    { expiryEvidence: { ...ref.expiryEvidence, sha256: '0'.repeat(64) } },
    { visuallyReviewedForThisPolicy: false },
  ])
    assert.equal(run(base, change).eligible, false, JSON.stringify(change));
  const wrong = structuredClone(base);
  wrong.query.pages[1].imageinfo[0].size++;
  assert.equal(run(wrong).eligible, false, 'native size');
  fs.writeFileSync(
    path.join(dir, 'terms.html'),
    guide.replace('all out of copyright', 'in copyright'),
  );
  assert.equal(
    run(base, {
      expiryEvidence: {
        ...ref.expiryEvidence,
        sha256: hash(fs.readFileSync(path.join(dir, 'terms.html'))),
      },
    }).eligible,
    false,
    'primary guidance',
  );
  fs.writeFileSync(path.join(dir, 'terms.html'), guide);
  run();
  const evidence = {
    format: 'molen/structure-imagery-evidence@1',
    policy: PUBLIC_DOMAIN_POLICY,
    references: [
      { ...ref, rightsEvidence: { path: 'native.json', sha256: hash(JSON.stringify(base)) } },
    ],
    quallaSearch: {
      source: 'published-qualla-media',
      completedBeforeSupplementalFetch: true,
      articlePaths: ['story.json'],
      notes: 'Prior published-media search found no architectural view.',
    },
  };
  assert.equal(
    inspectImageryInventory({
      dir,
      qualla: dir,
      evidence,
      selectedReferences: [],
      stories: [{ id: 'story', sourcePath: 'story.json' }],
      frame: {},
    }).status,
    'passed',
  );
});
