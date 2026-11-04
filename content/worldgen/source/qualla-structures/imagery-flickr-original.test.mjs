import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { flickrPrimaryModels, inspectFlickrOriginalReference } from './imagery-flickr-original.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flickr-original-'));
  const owner = '123@N07',
    id = '456',
    sourceUrl = `https://www.flickr.com/photos/${owner}/${id}/`;
  const person = {
    '@type': 'Person',
    name: 'Photographer',
    url: `https://www.flickr.com/photos/${owner}`,
    image: `https://live.staticflickr.com/1/buddyicons/${owner}.jpg?1#${owner}`,
  };
  const record = {
    '@type': 'ImageObject',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    acquireLicensePage: sourceUrl.slice(0, -1),
    author: person,
    creator: { ...person },
  };
  const data = {
    id,
    title: 'Warehouse {north}',
    license: 9,
    owner: { data: { id: owner, realname: 'Photographer' } },
    oWidth: 1200,
    oHeight: 800,
    sizes: {
      data: {
        o: { data: { url: `//live.staticflickr.com/1/${id}_abc_o.jpg`, width: 1200, height: 800 } },
      },
    },
  };
  const image = Buffer.from('original-image-bytes');
  fs.writeFileSync(path.join(dir, 'photo.jpg'), image);
  const ref = {
    origin: 'flickr-photographer-cc0-original',
    license: 'CC0',
    sourceUrl,
    downloadUrl: `https://live.staticflickr.com/1/${id}_abc_o.jpg`,
    artist: 'Photographer',
    title: data.title,
    width: 1200,
    height: 800,
    path: 'photo.jpg',
    sha256: hash(image),
    rightsEvidence: { path: 'primary.html', sourceUrl },
    originalReview: { status: 'inspected' },
    visuallyReviewedForThisPolicy: true,
  };
  const save = () => {
    const html =
      `<script type="application/ld+json">${JSON.stringify(record)}</script>` +
      `<script>modelExport: ${JSON.stringify({ main: { 'photo-models': [{ data }] } })}, ignored: alert('never executed')</script>`;
    fs.writeFileSync(path.join(dir, 'primary.html'), html);
    ref.rightsEvidence.sha256 = hash(html);
    return html;
  };
  save();
  return {
    dir,
    ref,
    data,
    record,
    save,
    close: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('direct original binds primary creator, exact CC0 release, image bytes and original rendition', () => {
  const f = fixture();
  try {
    assert.equal(flickrPrimaryModels(f.save())['photo-models'][0].data.title, 'Warehouse {north}');
    assert.equal(inspectFlickrOriginalReference(f.dir, f.ref).eligible, true);
    assert.throws(() => flickrPrimaryModels('unrelated page'), /missing/);
  } finally {
    f.close();
  }
});

test('direct original rejects changed licenses, owners, renditions, dimensions, inspection and bytes', () => {
  for (const mutate of [
    (f) => {
      f.data.license = 4;
      f.save();
    },
    (f) => {
      f.record.license = 'https://creativecommons.org/licenses/by/4.0/';
      f.save();
    },
    (f) => {
      f.data.owner.data.id = '999@N07';
      f.save();
    },
    (f) => {
      f.ref.downloadUrl = f.ref.downloadUrl.replace('_o.jpg', '_b.jpg');
    },
    (f) => {
      f.ref.width = 1024;
    },
    (f) => {
      f.ref.visuallyReviewedForThisPolicy = false;
    },
    (f) => {
      fs.writeFileSync(path.join(f.dir, 'photo.jpg'), 'different image');
    },
  ]) {
    const f = fixture();
    try {
      mutate(f);
      assert.equal(inspectFlickrOriginalReference(f.dir, f.ref).eligible, false);
    } finally {
      f.close();
    }
  }
});
