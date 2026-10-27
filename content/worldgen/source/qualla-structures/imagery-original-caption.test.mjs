import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectCommonsSelfReference } from './imagery-inventory.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
test('an original photographer caption binds the same native author, named release and original uploader without inventing a profile alias', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'original-caption-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const image = Buffer.from('original camera pixels');
  fs.writeFileSync(path.join(dir, 'photo.jpg'), image);
  const body = `{{Information\n|Description={{en|Taken by Jane Photographer}}\n|Source={{transferred from|en.wikipedia|TransferBot}}\n|Author={{user at project|CameraUser|wikipedia|en}}\n}}\n{{PD-user-en|CameraUser}}\n{{original description page|en.wikipedia|Photo.jpg}}\n* 2007-04-29 16:52 [[:en:User:CameraUser|CameraUser]] 20×10× (${image.length} bytes) ''<nowiki>Taken by Jane Photographer</nowiki>''`;
  const p = {
    title: 'File:Photo.jpg',
    revisions: [{ revid: 123, slots: { main: { '*': body } } }],
    imageinfo: [
      {
        user: 'File Upload Bot (Magnus Manske)',
        timestamp: '2010-06-06T05:11:48Z',
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
        sha1: createHash('sha1').update(image).digest('hex'),
        width: 20,
        height: 10,
        size: image.length,
        extmetadata: Object.fromEntries(
          Object.entries({
            LicenseShortName: 'Public domain',
            Copyrighted: 'False',
            AttributionRequired: 'false',
            Artist:
              '<a href="https://en.wikipedia.org/wiki/User:CameraUser">CameraUser</a> at English Wikipedia',
            Credit: 'Transferred from <a href="https://en.wikipedia.org">en.wikipedia</a>',
          }).map(([k, value]) => [k, { value }]),
        ),
      },
    ],
  };
  const ref = {
    origin: 'commons-author-public-domain',
    path: 'photo.jpg',
    sha256: hash(image),
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
    downloadUrl: p.imageinfo[0].url,
    artist: 'CameraUser at English Wikipedia',
    license: 'Public domain',
    creatorDedication: {
      kind: 'english-wikipedia-original-photographer-caption',
      wiki: 'en',
      project: 'English Wikipedia',
      username: 'CameraUser',
      profileUrl: 'https://en.wikipedia.org/wiki/User:CameraUser',
      originalFileUrl: 'https://en.wikipedia.org/wiki/File:Photo.jpg',
      photographerName: 'Jane Photographer',
      originalUpload: { timestamp: '2007-04-29 16:52', width: 20, height: 10, bytes: image.length },
    },
  };
  const check = (change, refChange = {}) => {
    const page = structuredClone(p);
    change?.(page);
    const b = JSON.stringify({ query: { pages: { 1: page } } });
    fs.writeFileSync(path.join(dir, 'native.json'), b);
    return inspectCommonsSelfReference(dir, {
      ...ref,
      ...refChange,
      rightsEvidence: { path: 'native.json', sha256: hash(b) },
    }).eligible;
  };
  assert.equal(check(), true);
  for (const [from, to] of [
    ['{{PD-user-en|CameraUser}}', '{{PD-user-en|Other}}'],
    ['|Author={{user at project|CameraUser', '|Author={{user at project|Other'],
    ['[[:en:User:CameraUser|CameraUser]]', '[[:en:User:Other|Other]]'],
    ['<nowiki>Taken by Jane Photographer', '<nowiki>Uploaded by Jane Photographer'],
    ['|Description={{en|Taken by Jane Photographer', '|Description={{en|Taken by Somebody Else'],
    [`(${image.length} bytes)`, '(1 bytes)'],
  ])
    assert.equal(
      check((q) => {
        q.revisions[0].slots.main['*'] = body.replace(from, to);
      }),
      false,
    );
  for (const change of [
    (q) => {
      q.imageinfo[0].sha1 = '0'.repeat(40);
    },
    (q) => {
      q.imageinfo.push({ ...q.imageinfo[0] });
    },
    (q) => {
      q.imageinfo[0].extmetadata.Copyrighted.value = 'True';
    },
    (q) => {
      q.imageinfo[0].extmetadata.Permission = { value: 'All rights reserved' };
    },
    (q) => {
      q.imageinfo[0].extmetadata.Artist.value = 'Other';
    },
    (q) => {
      q.imageinfo[0].extmetadata.Restrictions = { value: 'No commercial use' };
    },
    (q) => {
      q.imageinfo[0].timestamp = '2000-01-01T00:00:00Z';
    },
  ])
    assert.equal(check(change), false);
});
