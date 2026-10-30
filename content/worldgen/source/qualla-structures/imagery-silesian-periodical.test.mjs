import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectSilesianPeriodicalReference } from './imagery-silesian-periodical.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-library-periodical-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pdf = Buffer.from('%PDF-original periodical fixture');
  const sourceUrl = 'https://sbc.org.pl/dlibra/publication/2/edition/1/original';
  const downloadUrl = 'https://sbc.org.pl/Content/1/PDF/original.pdf';
  const metadata = Object.entries({
    date: ['1891'],
    rights: ['Domena publiczna (public domain)'],
    identifier: [downloadUrl],
    title: ['Original periodical'],
    publisher: ['Original publisher'],
    contributor: ['Named editor'],
  }).map(([roleId, values]) => ({ roleId, values }));
  const page = {
    edition: { id: '1' },
    publication: { id: '2' },
    canonicalUrl: sourceUrl,
    editionAccessType: 'AVAILABLE',
    allowDownload: true,
    externalContent: null,
  };
  const pp = {
    editionId: '1',
    publicationId: '2',
    dCTagsData: { elementId: '1', metadata },
    data: { components: { publicationPage: page, contentAccess: { accessLimited: false } } },
  };
  const r = {
    origin: 'silesian-library-public-domain-periodical',
    path: 'original.pdf',
    sourceUrl,
    downloadUrl,
    license: 'Public domain',
    artist: 'Named editor',
    publicationTitle: 'Original periodical',
    publicationPublisher: 'Original publisher',
    sha256: hash(pdf),
    rightsEvidence: { path: 'native.html', sourceUrl },
    visuallyReviewedForThisPolicy: true,
    originalReview: {
      status: 'inspected',
      rendition: 'native-original-pdf',
      publicationYear: 1891,
      pageCount: 16,
      pagesInspected: [1, 7, 8],
      publicationAndCreatorCreditInspected: true,
      notes: 'Original imprint, actual dam section and exterior inspected.',
    },
  };
  fs.writeFileSync(path.join(dir, r.path), pdf);
  const save = () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: pp } })}</script>`;
    fs.writeFileSync(path.join(dir, r.rightsEvidence.path), html);
    r.rightsEvidence.sha256 = hash(html);
  };
  save();
  return { dir, r, pp, page, metadata, save };
}
test('original periodical bound to explicit item-specific public-domain library statement', (t) => {
  const f = fixture(t);
  assert.equal(inspectSilesianPeriodicalReference(f.dir, f.r).eligible, true);
});
for (const [name, change] of [
  ['changed original', (f) => fs.appendFileSync(path.join(f.dir, f.r.path), 'replacement')],
  [
    'stale library evidence',
    (f) => fs.appendFileSync(path.join(f.dir, f.r.rightsEvidence.path), 'changed'),
  ],
  [
    'attribution-required grant',
    (f) => {
      f.metadata.find((m) => m.roleId === 'rights').values = ['CC BY-SA 4.0'];
      f.save();
    },
  ],
  [
    'different PDF resource',
    (f) => {
      f.r.downloadUrl = f.r.downloadUrl.replace('original', 'other');
    },
  ],
  [
    'different edition',
    (f) => {
      f.page.edition.id = '99';
      f.save();
    },
  ],
  [
    'restricted item',
    (f) => {
      f.pp.data.components.contentAccess.accessLimited = true;
      f.save();
    },
  ],
  [
    'later edition',
    (f) => {
      f.metadata.find((m) => m.roleId === 'date').values = ['1981'];
      f.save();
    },
  ],
  [
    'uninspected original',
    (f) => {
      f.r.visuallyReviewedForThisPolicy = false;
    },
  ],
])
  test(`reject ${name}`, (t) => {
    const f = fixture(t);
    change(f);
    assert.equal(inspectSilesianPeriodicalReference(f.dir, f.r).eligible, false);
  });
