import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectImageryPolicy } from './imagery-policy.mjs';

test('exact published USAF aerial requires its native employee grant and inspected original government volume', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-usaf-reference-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, b) => {
      const f = path.join(root, p);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, typeof b === 'string' || Buffer.isBuffer(b) ? b : JSON.stringify(b));
    },
    sha = (b, a = 'sha256') => createHash(a).update(b).digest('hex'),
    image = Buffer.from('exact published aerial'),
    pdf = Buffer.from('%PDF-original government publication'),
    dir = 'content/worldgen/source/places/9q/9qd/base',
    file = dir + '/reference-rights/native.json',
    book = dir + '/reference-plans/usaf-reference-series-1989.pdf';
  const citation =
      'Active Air Force Bases Within the United States of America on 17 September 1982 USAF Reference Series, OFFICE OF AIR FORCE HISTORY UNITED STATES AIR FORCE WASHINGTON, D.C., 1989',
    ref = {
      path: '_m/a/b/c/d/base/aerial.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Castleafb-1982.jpg',
      artist: 'USAF',
      license: 'Public domain',
      sha256: sha(image),
      publicDomainEvidence: { kind: 'commons-native-usaf-reference-series-photo', path: file },
    },
    story = { id: 'base', sourcePath: '_c/art/a/b/c/d/base.json' },
    page = {
      title: 'File:Castleafb-1982.jpg',
      revisions: [
        {
          revid: 42,
          slots: {
            main: {
              '*': `{{Information\n|Author=USAF\n|Date=1982\n|Source=${citation}\n|Permission={{PD-USGov-Military-Air Force}}\n}}`,
            },
          },
        },
      ],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Castleafb-1982.jpg',
          sha1: sha(image, 'sha1'),
          size: image.length,
          extmetadata: {
            Artist: { value: 'USAF' },
            LicenseShortName: { value: 'Public domain' },
            Copyrighted: { value: 'False' },
            AttributionRequired: { value: 'false' },
            Restrictions: { value: '' },
          },
        },
      ],
    },
    record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3ACastleafb-1982.jpg',
      query: { pages: { 1: page } },
      publication: {
        source: 'https://media.defense.gov/2010/Sep/21/2001330255/-1/-1/0/AFD-100921-026.pdf',
        title: 'Air Force Bases, Volume I',
        publisher: 'Office of Air Force History, United States Air Force',
        author: 'Robert Mueller, United States Air Force Historical Research Center',
        publicationYear: 1989,
        titlePdfPage: 1,
        authorPdfPage: 7,
        photoPdfPage: 90,
        photoPrintedPage: 72,
        photoCaption: 'Castle AFB, 1982',
        scope: 'lower-1982-parade-ground-aerial-only',
        originalImageMatched: true,
        personallyInspected: true,
        bytes: pdf.length,
        sha256: sha(pdf),
      },
    };
  put(ref.path, image);
  put(book, pdf);
  put(story.sourcePath, { media: { images: [ref] } });
  put('_m/a/b/c/d/base/metadata.json', { gallery: [ref], galleryPaths: [ref.path] });
  const save = () => {
      const s = JSON.stringify(record);
      put(file, s);
      ref.publicDomainEvidence.sha256 = sha(s);
    },
    run = () =>
      inspectImageryPolicy({ qualla: root, rightsRoot: root, references: [ref], stories: [story] });
  save();
  assert.equal(run().status, 'passed');
  const original = page.revisions[0].slots.main['*'];
  for (const [from, to] of [
    ['USAF', 'Private contractor'],
    ['1982', '1942'],
    ['PD-USGov-Military-Air Force', 'PD-USGov'],
    [citation, 'Government contract report'],
  ]) {
    page.revisions[0].slots.main['*'] = original.replace(from, to);
    save();
    assert.equal(run().status, 'needs-replacement');
  }
  page.revisions[0].slots.main['*'] = original;
  for (const [key, bad] of [
    ['source', 'https://example.org/reprint.pdf'],
    ['author', 'Unrecorded contractor'],
    ['photoPdfPage', 89],
    ['scope', 'all-photographs-in-volume'],
    ['originalImageMatched', false],
    ['personallyInspected', false],
    ['sha256', '0'.repeat(64)],
  ]) {
    const old = record.publication[key];
    record.publication[key] = bad;
    save();
    assert.equal(run().status, 'needs-replacement');
    record.publication[key] = old;
  }
  const old = page.title;
  page.title = 'File:Other.jpg';
  save();
  assert.equal(run().status, 'needs-replacement');
  page.title = old;
  save();
  put(book, Buffer.from('%PDF-changed'));
  assert.equal(run().status, 'needs-replacement');
  put(book, pdf);
  assert.equal(run().status, 'passed');
  put(ref.path, 'changed image');
  assert.equal(run().status, 'needs-replacement');
});
