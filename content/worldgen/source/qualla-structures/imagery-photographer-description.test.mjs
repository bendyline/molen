import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectCommonsSelfReference } from './imagery-inventory.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
test('a migrated named photographer declaration binds the exact release, author and original upload', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'named-photo-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const image = Buffer.from('original pixels');
  fs.writeFileSync(path.join(dir, 'photo.jpg'), image);
  const username = 'Photographer',
    profile = 'https://en.wikipedia.org/wiki/User:Photographer',
    body = `{{Information\n|Description=Photo taken by [[:en:User:Photographer|Photographer]] in October 2006.\n|Source={{transferred from|en.wikipedia|TransferBot}}\n|Author={{user at project|Photographer|wikipedia|en}}\n}}\n{{PD-user-en|Photographer}}\n{{original description page|en.wikipedia|Photo.jpg}}\n* 2007-02-07 18:00 [[:en:User:Photographer|Photographer]] 20×10× (15 bytes)`,
    page = {
      title: 'File:Photo.jpg',
      revisions: [{ revid: 123, slots: { main: { '*': body } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
          sha1: createHash('sha1').update(image).digest('hex'),
          width: 20,
          height: 10,
          size: 15,
          extmetadata: {
            LicenseShortName: { value: 'Public domain' },
            AttributionRequired: { value: 'false' },
            Copyrighted: { value: 'False' },
            Permission: { value: 'Released into the public domain (by the author)' },
            Artist: { value: `<a href="${profile}">Photographer</a> at English Wikipedia` },
            Credit: {
              value: 'Transferred from <a href="https://en.wikipedia.org">en.wikipedia</a>',
            },
          },
        },
      ],
    },
    reference = {
      origin: 'commons-author-public-domain',
      path: 'photo.jpg',
      sha256: hash(image),
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
      downloadUrl: page.imageinfo[0].url,
      artist: 'Photographer at English Wikipedia',
      license: 'Public domain',
      creatorDedication: {
        kind: 'english-wikipedia-photographer-described-upload',
        wiki: 'en',
        project: 'English Wikipedia',
        username,
        profileUrl: profile,
        originalFileUrl: 'https://en.wikipedia.org/wiki/File:Photo.jpg',
        originalUpload: { timestamp: '2007-02-07 18:00', width: 20, height: 10, bytes: 15 },
      },
    };
  const check = (change) => {
    const p = structuredClone(page);
    change?.(p);
    const bytes = JSON.stringify({ query: { pages: { 1: p } } });
    fs.writeFileSync(path.join(dir, 'native.json'), bytes);
    return inspectCommonsSelfReference(dir, {
      ...reference,
      rightsEvidence: { path: 'native.json', sha256: hash(bytes) },
    }).eligible;
  };
  assert.equal(check(), true);
  for (const [from, to] of [
    [
      'Photo taken by [[:en:User:Photographer|Photographer]]',
      'Uploaded by [[:en:User:Photographer|Photographer]]',
    ],
    ['{{PD-user-en|Photographer}}', '{{PD-user-en|SomeoneElse}}'],
    [
      'Photo taken by [[:en:User:Photographer|Photographer]]',
      'Photo taken by [[:en:User:SomeoneElse|SomeoneElse]]',
    ],
    ['(15 bytes)', '(16 bytes)'],
  ])
    assert.equal(
      check((p) => {
        p.revisions[0].slots.main['*'] = body.replace(from, to);
      }),
      false,
    );
  assert.equal(
    check((p) => {
      p.imageinfo[0].sha1 = '0'.repeat(40);
    }),
    false,
  );
  assert.equal(
    check((p) => {
      p.imageinfo[0].extmetadata.Artist.value = 'Another photographer';
    }),
    false,
  );
});
