import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectCommonsEmbassyReference } from './imagery-inventory.mjs';

test('Embassy photographs bind the explicit DOS release, official account, staff credit and exact original', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-embassy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pixels = Buffer.from('native embassy photo fixture'),
    digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex'),
    id = '50408664051',
    title = `File:Emb. George visita UPM (${id}).jpg`,
    artist = 'Embajada de los Estados Unidos en Uruguay from Montevideo, Uruguay',
    url = `https://upload.wikimedia.org/wikipedia/commons/e/e9/Emb._George_visita_UPM_%28${id}%29.jpg`,
    body = `[U.S. Embassy photo: Juan Francisco Casal / Copyright info]
| Source = [https://www.flickr.com/photos/usembassy_montevideo/${id}/ Emb. George visita UPM]
| Author = [https://www.flickr.com/people/41243200@N08 Embajada de los Estados Unidos en Uruguay]
{{PD-USGov-DOS}}
{{FlickreviewR|status=passed|author=U.S. Embassy Montevideo|sourceurl=https://flickr.com/photos/41243200@N08/${id}|archive=|reviewlicense=Public Domain Mark|reviewer=FlickreviewR 2}}`,
    record = {
      source: `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'imageinfo|revisions', titles: title })}`,
      query: {
        pages: {
          1: {
            title,
            revisions: [{ revid: 123, slots: { main: { '*': body } } }],
            imageinfo: [
              {
                url,
                sha1: digest(pixels, 'sha1'),
                size: pixels.length,
                width: 2126,
                height: 1417,
                extmetadata: {
                  Artist: { value: artist },
                  LicenseShortName: { value: 'Public domain' },
                  AttributionRequired: { value: 'false' },
                  Restrictions: { value: '' },
                },
              },
            ],
          },
        },
      },
    },
    reference = {
      path: 'photo.jpg',
      origin: 'commons-us-embassy-government-photo',
      sourceUrl: `https://commons.wikimedia.org/wiki/${title.replaceAll(' ', '_')}`,
      downloadUrl: url,
      flickrId: id,
      artist,
      photographer: 'Juan Francisco Casal',
      license: 'Public domain',
      width: 2126,
      height: 1417,
      sha256: digest(pixels),
      originalReview: { status: 'inspected', rendition: 'native-original' },
    },
    check = (change = () => {}, r = reference) => {
      const copy = structuredClone(record);
      change(copy.query.pages[1], copy);
      const bytes = JSON.stringify(copy);
      fs.writeFileSync(path.join(dir, 'rights.json'), bytes);
      return inspectCommonsEmbassyReference(dir, {
        ...r,
        rightsEvidence: { path: 'rights.json', sha256: digest(bytes) },
      }).eligible;
    };
  fs.writeFileSync(path.join(dir, 'photo.jpg'), pixels);
  assert.equal(check(), true);
  for (const [before, after] of [
    ['{{PD-USGov-DOS}}', '{{Public domain mark}}'],
    ['Juan Francisco Casal /', 'Private contributor /'],
    ['status=passed', 'status=failed'],
    ['author=U.S. Embassy Montevideo', 'author=Private account'],
    [
      'sourceurl=https://flickr.com/photos/41243200@N08/',
      'sourceurl=https://flickr.com/photos/99999999@N00/',
    ],
    ['/usembassy_montevideo/50408664051/', '/usembassy_montevideo/50408664052/'],
  ])
    assert.equal(
      check((p) => {
        p.revisions[0].slots.main['*'] = body.replace(before, after);
      }),
      false,
    );
  assert.equal(
    check((p) => {
      p.imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY 4.0';
    }),
    false,
  );
  assert.equal(
    check((p) => {
      p.imageinfo[0].extmetadata.Restrictions.value = 'Restricted';
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
    check((_p, j) => {
      j.source = 'https://example.com/rights';
    }),
    false,
  );
  assert.equal(
    check(() => {}, { ...reference, downloadUrl: url.replace('/commons/', '/commons/thumb/') }),
    false,
  );
  assert.equal(
    check(() => {}, { ...reference, photographer: 'Another photographer' }),
    false,
  );
  assert.equal(
    check(() => {}, { ...reference, originalReview: { status: 'pending' } }),
    false,
  );
  fs.writeFileSync(path.join(dir, 'photo.jpg'), 'different pixels');
  assert.equal(check(), false);
});
