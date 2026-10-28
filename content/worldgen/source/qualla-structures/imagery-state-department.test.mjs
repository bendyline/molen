import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectQuallaPrimaryRights } from './imagery-primary-rights.mjs';

test('published Embassy imagery requires matching agency, original bytes and reviewed government release', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-dos-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = Buffer.from('exact original agency image');
  const hash = (b, alg = 'sha256') => createHash(alg).update(b).digest('hex');
  const file = 'content/worldgen/source/places/ke/ke7/old_market/reference-rights/native.json';
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  const title = 'File:Market Theatre (47101207021).jpg';
  const wiki =
    '{{Information\n| Source = [https://www.flickr.com/photos/usembassysa/47101207021/ Agency image]\n| Author = [https://www.flickr.com/people/101005855@N06 US Embassy  South Africa]\n}}\n{{PD-USGov-DOS}}\n{{FlickreviewR|status=passed|author=USEmbassySA|sourceurl=https://flickr.com/photos/101005855@N06/47101207021|archive=|reviewdate=2020-07-22|reviewlicense=United States Government Work|reviewer=FlickreviewR 2}}';
  const page = {
    title,
    revisions: [{ revid: 123, slots: { main: { '*': wiki } } }],
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Market_Theatre.jpg',
        sha1: hash(original, 'sha1'),
        size: original.length,
        extmetadata: Object.fromEntries(
          Object.entries({
            Artist: 'US Embassy  South Africa',
            LicenseShortName: 'Public domain',
            Copyrighted: 'False',
            AttributionRequired: 'false',
            Restrictions: '',
          }).map(([k, value]) => [k, { value }]),
        ),
      },
    ],
  };
  const reference = {
    artist: 'US Embassy  South Africa',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Market_Theatre_(47101207021).jpg',
  };
  const check = (change, proofChange = {}, image = original) => {
    const p = structuredClone(page);
    change?.(p);
    const bytes = JSON.stringify({
      source:
        'https://commons.wikimedia.org/w/api.php?' +
        new URLSearchParams({ action: 'query', prop: 'imageinfo|revisions', titles: title }),
      query: { pages: { 1: p } },
    });
    fs.writeFileSync(path.join(root, file), bytes);
    return inspectQuallaPrimaryRights(
      {
        ...reference,
        publicDomainEvidence: {
          kind: 'commons-native-reviewed-state-department-photo',
          path: file,
          sha256: hash(bytes),
          flickrId: '47101207021',
          flickrAccountId: '101005855@N06',
          ...proofChange,
        },
      },
      image,
      root,
    ).eligible;
  };
  assert.equal(
    check(),
    true,
    'native whitespace is normalized without changing published attribution',
  );
  assert.equal(check(null, {}, Buffer.from('different image')), false);
  assert.equal(check(null, { flickrAccountId: 'foreign-account' }), false);
  assert.equal(check(null, { flickrId: '11111111111' }), false);
  assert.equal(check(null, { sha256: '0'.repeat(64) }), false);
  for (const [from, to] of [
    ['{{PD-USGov-DOS}}', ''],
    ['status=passed', 'status=failed'],
    ['United States Government Work', 'Attribution License'],
    ['people/101005855@N06', 'people/999999999@N06'],
    ['photos/usembassysa/', 'photos/private-person/'],
  ]) {
    assert.equal(
      check((p) => {
        p.revisions[0].slots.main['*'] = p.revisions[0].slots.main['*'].replace(from, to);
      }),
      false,
      from,
    );
  }
  assert.equal(
    check((p) => {
      p.imageinfo[0].extmetadata.Copyrighted.value = 'True';
    }),
    false,
  );
  assert.equal(
    check((p) => {
      p.imageinfo[0].extmetadata.Restrictions.value = 'Permission required';
    }),
    false,
  );
});
