import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectCommonsSelfReference } from './imagery-inventory.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
test('archived original binds the named grant, original upload row and archival bot history; later recolors are rejected', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archived-author-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const image = Buffer.from('author original pixels'),
    recolored = Buffer.from('later recolored pixels');
  fs.writeFileSync(path.join(dir, 'photo.jpg'), image);
  const body = `{{Information\n|Author=[[:en:User:Photographer|User:Photographer]].\n{{user at project|Photographer|wikipedia|en}}\n}}\n{{PD-user-en|Photographer}}\n{{original description|en.wikipedia|Photo.jpg}}\n* 2009-11-13 08:04 [[:en:User:Photographer|Photographer]] 20×10× (${image.length} bytes)`;
  const page = {
    title: 'File:Photo.jpg',
    revisions: [{ revid: 123, slots: { main: { '*': body } } }],
    imageinfo: [
      {
        timestamp: '2013-01-15T02:55:37Z',
        sha1: createHash('sha1').update(recolored).digest('hex'),
        extmetadata: Object.fromEntries(
          Object.entries({
            LicenseShortName: 'Public domain',
            Copyrighted: 'False',
            AttributionRequired: 'false',
            Artist: 'https://en.wikipedia.org/wiki/User:Photographer',
          }).map(([k, value]) => [k, { value }]),
        ),
      },
      {
        timestamp: '2013-01-15T02:55:32Z',
        user: 'OgreBot',
        size: image.length,
        width: 20,
        height: 10,
        sha1: createHash('sha1').update(image).digest('hex'),
        archivename: '20130115025532!Photo.jpg',
        url: 'https://upload.wikimedia.org/wikipedia/commons/archive/d/d8/20130115025532%21Photo.jpg',
        comment:
          '(BOT): Uploading old version of file from en.wikipedia; originally uploaded on 2009-11-13 08:04:50 by [[en:User:Photographer|Photographer]]',
      },
    ],
  };
  const reference = {
    origin: 'commons-author-public-domain',
    path: 'photo.jpg',
    sha256: hash(image),
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
    downloadUrl: page.imageinfo[1].url,
    artist: 'Photographer',
    license: 'Public domain',
    originalReview: { status: 'inspected', rendition: 'native-original' },
    creatorDedication: {
      kind: 'english-wikipedia-archived-author-original',
      username: 'Photographer',
      revision: 123,
      archiveName: '20130115025532!Photo.jpg',
      originalUpload: {
        timestamp: '2009-11-13 08:04:50',
        width: 20,
        height: 10,
        bytes: image.length,
      },
    },
  };
  const check = (change, ref = {}) => {
    const p = structuredClone(page);
    change?.(p);
    const bytes = JSON.stringify({ query: { pages: { 1: p } } });
    fs.writeFileSync(path.join(dir, 'native.json'), bytes);
    return inspectCommonsSelfReference(dir, {
      ...reference,
      ...ref,
      rightsEvidence: { path: 'native.json', sha256: hash(bytes) },
    }).eligible;
  };
  assert.equal(check(), true);
  for (const alter of [
    (p) => {
      p.revisions[0].slots.main['*'] = body.replace('PD-user-en|Photographer', 'PD-user-en|Other');
    },
    (p) => {
      p.revisions[0].slots.main['*'] = body.replace('* 2009', '* 2010');
    },
    (p) => {
      p.imageinfo[1].comment = 'Unbound original';
    },
    (p) => {
      p.imageinfo[1].size++;
    },
    (p) => {
      p.imageinfo[1].sha1 = '0'.repeat(40);
    },
    (p) => {
      p.imageinfo[1].sha1 = p.imageinfo[0].sha1;
    },
    (p) => {
      p.imageinfo[0].extmetadata.Copyrighted.value = 'True';
    },
    (p) => {
      p.imageinfo[1].user = 'Other';
    },
    (p) => {
      p.imageinfo[1].url = p.imageinfo[1].url.replace('/archive/', '/thumb/');
    },
  ])
    assert.equal(check(alter), false);
  assert.equal(
    check(null, { downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Photo.jpg' }),
    false,
  );
  assert.equal(check(null, { path: '../photo.jpg' }), false);
  fs.writeFileSync(path.join(dir, 'native.json'), 'broken');
  assert.equal(
    inspectCommonsSelfReference(dir, {
      ...reference,
      rightsEvidence: { path: 'native.json', sha256: hash('broken') },
    }).eligible,
    false,
  );
});
