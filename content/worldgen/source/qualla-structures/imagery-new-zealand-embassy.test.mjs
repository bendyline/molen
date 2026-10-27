import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectNewZealandEmbassyReference } from './imagery-new-zealand-embassy.mjs';

const hash = (s, a = 'sha256') => createHash(a).update(s).digest('hex');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-dos-photo-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const id = '50967988731',
    account = 'us_embassy_newzealand',
    title = `File:Christchurch Earthquake 10th Anniversary, 22nd February 2021 (${id}).jpg`,
    url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
    image = Buffer.from('specific original pixels'),
    person = {
      name: 'US Embassy',
      url: `https://www.flickr.com/photos/${account}`,
      image: 'https://farm66.staticflickr.com/65535/buddyicons/46907600@N02.jpg?123#46907600@N02',
    },
    photo = {
      '@type': 'ImageObject',
      acquireLicensePage: `https://www.flickr.com/photos/${account}/${id}`,
      license: 'https://creativecommons.org/publicdomain/mark/1.0/',
      contentUrl: `https://live.staticflickr.com/65535/${id}_original_b.jpg`,
      author: structuredClone(person),
      creator: structuredClone(person),
    },
    page = {
      title,
      revisions: [
        {
          revid: 123,
          slots: {
            main: {
              '*': `{{PD-USGov-DOS}}\n{{Flickrreview|Reviewer|2023-04-01}}\n[https://www.flickr.com/photos/${account}/${id}/ Photo]\n[https://www.flickr.com/people/46907600@N02 US Embassy] from New Zealand`,
            },
          },
        },
      ],
      imageinfo: [
        {
          url,
          width: 20,
          height: 10,
          size: image.length,
          sha1: hash(image, 'sha1'),
          extmetadata: {
            Artist: { value: 'US Embassy from New Zealand' },
            LicenseShortName: { value: 'Public domain' },
            AttributionRequired: { value: 'false' },
          },
        },
      ],
    },
    native = {
      source:
        'https://commons.wikimedia.org/w/api.php?' +
        new URLSearchParams({ action: 'query', titles: title, prop: 'imageinfo|revisions' }),
      query: { pages: { 1: page } },
    },
    reference = {
      origin: 'commons-new-zealand-embassy-government-photo',
      path: 'image.jpg',
      sha256: hash(image),
      artist: 'US Embassy from New Zealand',
      license: 'Public domain',
      sourceUrl: `https://commons.wikimedia.org/wiki/${title.replaceAll(' ', '_')}`,
      downloadUrl: url,
      flickrId: id,
      width: 20,
      height: 10,
      originalReview: { status: 'inspected', rendition: 'native-original' },
    };
  fs.writeFileSync(path.join(dir, 'image.jpg'), image);
  const check = (mutate = () => {}, ref = {}) => {
    const n = structuredClone(native),
      p = structuredClone(photo);
    mutate(n.query.pages[1], p, n);
    const a = JSON.stringify(n),
      b = `<script type="application/ld+json">${JSON.stringify(p)}</script>`;
    fs.writeFileSync(path.join(dir, 'native.json'), a);
    fs.writeFileSync(path.join(dir, 'primary.html'), b);
    return inspectNewZealandEmbassyReference(dir, {
      ...reference,
      catalogEvidence: { path: 'native.json', sha256: hash(a) },
      rightsEvidence: {
        path: 'primary.html',
        sha256: hash(b),
        sourceUrl: `https://www.flickr.com/photos/${account}/${id}/`,
      },
      ...ref,
    });
  };
  return { dir, check };
}
test('specific agency original requires both explicit DOS grant and same-agency primary release', (t) => {
  assert.equal(fixture(t).check().eligible, true);
});
for (const [name, mutate] of [
  [
    'missing DOS grant',
    (p) => {
      p.revisions[0].slots.main['*'] = p.revisions[0].slots.main['*'].replace(
        '{{PD-USGov-DOS}}',
        '',
      );
    },
  ],
  [
    'missing transfer review',
    (p) => {
      p.revisions[0].slots.main['*'] = p.revisions[0].slots.main['*'].replace(
        '{{Flickrreview|Reviewer|2023-04-01}}',
        '',
      );
    },
  ],
  [
    'different credited agency',
    (p) => {
      p.imageinfo[0].extmetadata.Artist.value = 'Private photographer';
    },
  ],
  [
    'attribution-only image',
    (p) => {
      p.imageinfo[0].extmetadata.LicenseShortName.value = 'CC BY 4.0';
    },
  ],
  [
    'attribution required',
    (p) => {
      p.imageinfo[0].extmetadata.AttributionRequired.value = 'true';
    },
  ],
  [
    'restrictions',
    (p) => {
      p.imageinfo[0].extmetadata.Restrictions = { value: 'Permission required' };
    },
  ],
  [
    'wrong native original',
    (p) => {
      p.imageinfo[0].sha1 = '0'.repeat(40);
    },
  ],
  [
    'thumbnail substituted',
    (p) => {
      p.imageinfo[0].url = p.imageinfo[0].url.replace('/a/ab/', '/thumb/a/ab/');
    },
  ],
  [
    'different primary license',
    (_p, o) => {
      o.license = 'https://creativecommons.org/licenses/by/4.0/';
    },
  ],
  [
    'different primary photo',
    (_p, o) => {
      o.acquireLicensePage = o.acquireLicensePage.replace('50967988731', '99999999999');
    },
  ],
  [
    'different primary agency NSID',
    (_p, o) => {
      o.creator.image = o.creator.image.replaceAll('46907600@N02', '99999999@N01');
    },
  ],
  [
    'different primary creator',
    (_p, o) => {
      o.author.name = 'Unknown';
    },
  ],
  [
    'untrusted native API',
    (_p, _o, n) => {
      n.source = n.source.replace('commons.wikimedia.org', 'example.org');
    },
  ],
  [
    'different requested file',
    (_p, _o, n) => {
      n.source = n.source.replace('Christchurch', 'Another');
    },
  ],
])
  test(`rejects ${name}`, (t) => {
    assert.equal(fixture(t).check(mutate).eligible, false);
  });
test('does not accept uninspected files or paths outside bundle', (t) => {
  const f = fixture(t);
  assert.equal(
    f.check(() => {}, { originalReview: { status: 'pending', rendition: 'native-original' } })
      .eligible,
    false,
  );
  assert.equal(f.check(() => {}, { path: '../image.jpg' }).eligible, false);
});
