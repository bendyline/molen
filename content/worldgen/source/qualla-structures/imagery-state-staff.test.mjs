import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectStateDepartmentReference } from './imagery-inventory.mjs';

test('State staff references require the official account, named staff caption, reviewed government grant and original bytes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-state-staff-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const rel = 'content/worldgen/source/places/tj/tj4/assembly',
    dir = path.join(root, rel);
  fs.mkdirSync(path.join(dir, 'reference-rights'), { recursive: true });
  const hash = (b, alg = 'sha256') => createHash(alg).update(b).digest('hex');
  const original = Buffer.from('exact original federal staff photograph');
  fs.writeFileSync(path.join(dir, 'photo.jpg'), original);
  const title = 'File:Staff visit (51345149997).jpg';
  const wiki = `{{Information
|Description=Staff visit. [State Department photo by Ron Przysucha/ Public Domain]
|Source=[https://www.flickr.com/photos/statephotos/51345149997/ Staff visit]
|Author=[https://www.flickr.com/people/9364837@N06 U.S. Department of State] from United States
}}
{{PD-USGov-DOS}}
{{FlickreviewR|status=passed|author=U.S. Department of State|sourceurl=https://flickr.com/photos/9364837@N06/51345149997|archive=|reviewdate=2021-08-01|reviewlicense=United States Government Work|reviewer=FlickreviewR 2}}`;
  const page = {
    title,
    revisions: [{ revid: 123, slots: { main: { '*': wiki } } }],
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Staff_visit.jpg',
        sha1: hash(original, 'sha1'),
        size: original.length,
        extmetadata: Object.fromEntries(
          Object.entries({
            Artist: 'U.S. Department of State from United States',
            LicenseShortName: 'Public domain',
            Copyrighted: 'False',
            AttributionRequired: 'false',
            Restrictions: '',
          }).map(([k, value]) => [k, { value }]),
        ),
      },
    ],
  };
  const check = (change, fields = {}) => {
    const p = structuredClone(page);
    change?.(p);
    const record = JSON.stringify({
      source: `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'imageinfo|revisions', titles: title })}`,
      query: { pages: { 1: p } },
    });
    fs.writeFileSync(path.join(dir, 'reference-rights/native.json'), record);
    return inspectStateDepartmentReference(
      dir,
      {
        path: 'photo.jpg',
        sha256: hash(original),
        sourceUrl: `https://commons.wikimedia.org/wiki/${title.replaceAll(' ', '_')}`,
        artist: 'U.S. Department of State from United States',
        license: 'Public domain',
        origin: 'commons-state-department-government-photo',
        publicDomainEvidence: {
          kind: 'commons-native-state-department-staff-photo',
          path: `${rel}/reference-rights/native.json`,
          sha256: hash(record),
          flickrId: '51345149997',
          flickrAccountId: '9364837@N06',
          photographer: 'Ron Przysucha',
        },
        rightsEvidence: { path: 'reference-rights/native.json', sha256: hash(record) },
        originalReview: { status: 'inspected', rendition: 'native-original' },
        visuallyReviewedForThisPolicy: true,
        ...fields,
      },
      root,
    ).eligible;
  };
  assert.equal(check(), true);
  for (const [from, to] of [
    ['people/9364837@N06', 'people/9999999@N06'],
    ['photo by Ron Przysucha', 'photo by Different Person'],
    ['photos/statephotos/', 'photos/private-person/'],
    ['status=passed', 'status=failed'],
    ['United States Government Work', 'Attribution License'],
    ['{{PD-USGov-DOS}}', ''],
    ['Staff visit.', 'Courtesy staff visit.'],
  ])
    assert.equal(
      check((p) => {
        p.revisions[0].slots.main['*'] = p.revisions[0].slots.main['*'].replace(from, to);
      }),
      false,
      from,
    );
  assert.equal(check(null, { sha256: '0'.repeat(64) }), false);
  assert.equal(
    check(null, { originalReview: { status: 'inspected', rendition: 'published-jpeg-rendition' } }),
    false,
  );
  assert.equal(
    check((p) => {
      p.imageinfo[0].extmetadata.Restrictions.value = 'Permission required';
    }),
    false,
  );
  assert.equal(
    check((p) => {
      p.imageinfo[0].sha1 = '0'.repeat(40);
    }),
    false,
  );
});
