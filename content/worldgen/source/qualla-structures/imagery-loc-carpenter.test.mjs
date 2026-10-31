import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectCarpenterReference } from './imagery-loc-carpenter.mjs';

const hash = (b, algorithm = 'sha256') => createHash(algorithm).update(b).digest('hex');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-carpenter-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const image = Buffer.from('II-original-tiff-fixture'),
    sourceUrl = 'https://www.loc.gov/item/91739070/',
    downloadUrl = 'https://tile.loc.gov/storage-services/master/pnp/cph/3c04096u.tif',
    wiki =
      '|photographer = Q5486735\n|date = {{other date|between|1900|1922}}\n{{LOC-image|id=cph.3c04096}}\n{{PD-Carpenter}}{{PD-old-auto-expired|deathyear=1924}}',
    page = {
      ns: 6,
      title: 'File:Original.tif',
      revisions: [{ revid: 1, slots: { main: { '*': wiki } } }],
      imageinfo: [
        {
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Original.tif',
          size: image.length,
          sha1: hash(image, 'sha1'),
          extmetadata: {
            Artist: { value: 'Frank G. Carpenter' },
            LicenseShortName: { value: 'Public domain' },
            Copyrighted: { value: 'False' },
            AttributionRequired: { value: 'false' },
            Restrictions: { value: '' },
          },
        },
      ],
    },
    native = { query: { pages: { 1: page } } },
    catalog = {
      item: {
        id: sourceUrl,
        access_restricted: false,
        group: ['ffcarp'],
        rights_advisory: 'No known restrictions on publication.',
        notes: ['Frank and Frances Carpenter Collection.'],
        created_published: ['[between ca. 1900 and 1922]'],
      },
      resources: [
        {
          url: 'https://www.loc.gov/resource/cph.3c04096/',
          files: [[{ url: downloadUrl, mimetype: 'image/tiff', size: image.length }]],
        },
      ],
    },
    collection = {
      id: '276_carp.html',
      title: 'Frank and Frances Carpenter Collection',
      intro:
        '<p>There are no known restrictions on the photographs in the Frank and Frances Carpenter Collection.</p>',
      publication: '<p>No known restrictions.</p>',
    },
    reference = {
      origin: 'loc-carpenter-expired-original',
      path: 'original.tif',
      sourceUrl,
      downloadUrl,
      artist: 'Frank G. Carpenter',
      license: 'Public domain',
      sha256: hash(image),
      visuallyReviewedForThisPolicy: true,
      originalReview: {
        status: 'inspected',
        rendition: 'official-native-tiff',
        notes: 'Exact original and full structure reviewed.',
      },
      rightsEvidence: { path: 'commons.json', sourceUrl: page.imageinfo[0].descriptionurl },
      catalogEvidence: { path: 'catalog.json', sourceUrl: `${sourceUrl}?fo=json` },
      collectionEvidence: {
        path: 'collection.json',
        sourceUrl: 'https://guides.loc.gov/p-and-p-rights-and-restrictions/rights#276_carp.html',
      },
    };
  fs.writeFileSync(path.join(dir, reference.path), image);
  const save = () => {
    for (const [key, record] of [
      ['rightsEvidence', native],
      ['catalogEvidence', catalog],
      ['collectionEvidence', collection],
    ]) {
      const b = Buffer.from(JSON.stringify(record));
      fs.writeFileSync(path.join(dir, reference[key].path), b);
      reference[key].sha256 = hash(b);
    }
  };
  save();
  return { dir, reference, page, catalog, collection, save };
}
test('exact native expired Carpenter original, LOC item and collection statement agree', (t) => {
  const f = fixture(t);
  assert.equal(inspectCarpenterReference(f.dir, f.reference).eligible, true);
});
for (const [name, change] of [
  [
    'replacement original bytes',
    (f) => fs.appendFileSync(path.join(f.dir, f.reference.path), 'replacement'),
  ],
  [
    'different LOC resource',
    (f) => {
      f.catalog.resources[0].files[0][0].url += 'other';
      f.save();
    },
  ],
  [
    'restricted item',
    (f) => {
      f.catalog.item.access_restricted = true;
      f.save();
    },
  ],
  [
    'other photographer',
    (f) => {
      f.page.revisions[0].slots.main['*'] = f.page.revisions[0].slots.main['*'].replace(
        'Q5486735',
        'Q999',
      );
      f.save();
    },
  ],
  [
    'missing expired grant',
    (f) => {
      f.page.revisions[0].slots.main['*'] = f.page.revisions[0].slots.main['*'].replace(
        '{{PD-old-auto-expired|deathyear=1924}}',
        '',
      );
      f.save();
    },
  ],
  [
    'attribution-required image',
    (f) => {
      f.page.imageinfo[0].extmetadata.AttributionRequired.value = 'true';
      f.save();
    },
  ],
  [
    'later photograph',
    (f) => {
      f.page.revisions[0].slots.main['*'] = f.page.revisions[0].slots.main['*'].replace(
        '1922',
        '1960',
      );
      f.save();
    },
  ],
  [
    'collection restriction',
    (f) => {
      f.collection.publication = 'Permission required';
      f.save();
    },
  ],
  [
    'stale native evidence hash',
    (f) => fs.appendFileSync(path.join(f.dir, f.reference.rightsEvidence.path), ' '),
  ],
  [
    'uninspected original',
    (f) => {
      f.reference.visuallyReviewedForThisPolicy = false;
    },
  ],
])
  test(`reject ${name}`, (t) => {
    const f = fixture(t);
    change(f);
    assert.equal(inspectCarpenterReference(f.dir, f.reference).eligible, false);
  });
