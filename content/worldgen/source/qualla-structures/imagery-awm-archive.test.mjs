import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectAwmArchiveReference, inspectImageryInventory } from './imagery-inventory.mjs';
import { PUBLIC_DOMAIN_POLICY } from './imagery-policy.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
test('AWM requires the exact expired photograph accession, named maker, date, offered image and bound bytes', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-awm-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = 'https://www.awm.gov.au/collection/C308739',
    download =
      'https://s3-ap-southeast-2.amazonaws.com/awm-media/collection/P02325.011/screen/7497987.JPG',
    image = Buffer.from('fixture photograph bytes');
  const row = (k, v) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`,
    base = `<link rel="canonical" href="${source}" /><meta property="og:image" content="${download}" /><h1>Memorial from north-west</h1><table>${row('Accession Number', 'P02325.011')}${row('Collection type', 'Photograph')}${row('Maker', 'Davis, Keith Benjamin<br/>')}${row('Date made', 'May - June 1946')}${row('Copyright', '<p>Item copyright: Copyright expired - public domain</p><p>This item is in the Public Domain <a rel="license" href="http://creativecommons.org/publicdomain/mark/1.0/">Public Domain</a></p>')}</table>`;
  fs.writeFileSync(path.join(dir, 'image.jpg'), image);
  const ref = {
    path: 'image.jpg',
    sourceUrl: source,
    downloadUrl: download,
    origin: 'awm-expired-archive-photograph',
    license: 'Public domain',
    artist: 'Keith Benjamin Davis',
    catalogNumber: 'P02325.011',
    photoYear: 1946,
    sha256: hash(image),
    visuallyReviewedForThisPolicy: true,
    originalReview: { status: 'inspected', rendition: 'archive-published-jpeg' },
    rightsEvidence: { path: 'record.html', sourceUrl: source },
  };
  const run = (html = base, change = {}) => {
    fs.writeFileSync(path.join(dir, 'record.html'), html);
    const r = { ...ref, rightsEvidence: { ...ref.rightsEvidence, sha256: hash(html) }, ...change };
    return inspectAwmArchiveReference(dir, r);
  };
  assert.equal(run().eligible, true);
  for (const [from, to] of [
    ['C308739', 'C237217'],
    ['<td>P02325.011</td>', '<td>129529</td>'],
    ['<td>Photograph</td>', '<td>Artwork</td>'],
    ['Davis, Keith Benjamin', 'Unknown photographer'],
    ['May - June 1946', 'May - June 1966'],
    ['Item copyright: Copyright expired - public domain', 'Item copyright: Copyright held'],
    ['This item is in the Public Domain', 'All rights reserved'],
    [
      'http://creativecommons.org/publicdomain/mark/1.0/',
      'https://creativecommons.org/licenses/by/4.0/',
    ],
    ['/7497987.JPG', '/9999999.JPG'],
  ])
    assert.equal(run(base.replace(from, to)).eligible, false, from);
  for (const change of [
    { artist: 'Another Photographer' },
    { photoYear: 1966 },
    { photoYear: 1945 },
    { catalogNumber: '129529' },
    { downloadUrl: download.replace('P02325.011', '129529') },
    { sourceUrl: source.replace('www.awm.gov.au', 'www.awm.gov.au.example.com') },
    { sha256: '0'.repeat(64) },
    { rightsEvidence: { ...ref.rightsEvidence, sha256: '0'.repeat(64) } },
    { originalReview: { rendition: 'native-original' } },
    { license: 'CC BY 4.0' },
  ])
    assert.equal(run(base, change).eligible, false, JSON.stringify(change));
  assert.equal(
    run(
      base.replace(
        row(
          'Copyright',
          '<p>Item copyright: Copyright expired - public domain</p><p>This item is in the Public Domain <a rel="license" href="http://creativecommons.org/publicdomain/mark/1.0/">Public Domain</a></p>',
        ),
        '<footer>Item copyright: Copyright expired - public domain; This item is in the Public Domain <a href="http://creativecommons.org/publicdomain/mark/1.0/">mark</a></footer>',
      ),
    ).eligible,
    false,
    'footer is not an item grant',
  );
  run();
  const evidence = {
    format: 'molen/structure-imagery-evidence@1',
    policy: PUBLIC_DOMAIN_POLICY,
    references: [{ ...ref, rightsEvidence: { ...ref.rightsEvidence, sha256: hash(base) } }],
    quallaSearch: {
      source: 'published-qualla-media',
      completedBeforeSupplementalFetch: true,
      articlePaths: ['story.json'],
      notes: 'Published collection searched first; no clear exterior.',
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
