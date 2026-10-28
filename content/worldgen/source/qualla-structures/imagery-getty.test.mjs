import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectGettyReference } from './imagery-getty.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
test('Getty requires the exact object image grant, all creators, native image service and reviewed bytes', (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-getty-'));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const id = 'https://media.getty.edu/iiif/image/8fc58166-ca13-43ba-8e42-2710725beede',
    url = 'https://www.getty.edu/art/collection/object/109A7W',
    image = Buffer.from('native test image'),
    obj = {
      url,
      '@type': 'Photograph',
      name: 'Palace',
      temporal: '1860s–1870s',
      identifier: ['84.XA.889.4.27'],
      creator: [{ name: 'John Burke' }, { name: 'William H. Baker' }],
      license: 'http://creativecommons.org/publicdomain/zero/1.0/',
      thumbnailUrl: id + '/full/!300,300/0/default.jpg',
      creditText: [
        'Images provided here are available under https://creativecommons.org/publicdomain/zero/1.0/ through Open Content Program. Text CC BY.',
      ],
    },
    info = { id, type: 'ImageService3', width: 6633, height: 5088 };
  const save = (p, b) => {
      fs.writeFileSync(path.join(d, p), b);
      return hash(b);
    },
    r = {
      origin: 'getty-object-cc0',
      license: 'CC0',
      path: 'original.jpg',
      sha256: save('original.jpg', image),
      sourceUrl: url,
      title: obj.name,
      accessionNumber: obj.identifier[0],
      creators: obj.creator.map((c) => c.name),
      artist: 'John Burke; William H. Baker',
      era: obj.temporal,
      downloadUrl: id + '/full/max/0/default.jpg',
      width: 6633,
      height: 5088,
      bytes: image.length,
      originalReview: { status: 'inspected', rendition: 'native-original' },
      rightsEvidence: { path: 'object.html', sourceUrl: url },
      catalogEvidence: { path: 'info.json', sourceUrl: id + '/info.json' },
    };
  const snap = (o) => {
    r.rightsEvidence.sha256 = save(
      'object.html',
      '<script type="application/ld+json">' + JSON.stringify(o) + '</script>',
    );
    r.catalogEvidence.sha256 = save('info.json', JSON.stringify(info));
  };
  snap(obj);
  assert(inspectGettyReference(d, r).eligible);
  for (const patch of [
    { license: 'https://creativecommons.org/licenses/by/4.0/' },
    { creator: [{ name: 'John Burke' }] },
    { url: url + 'X' },
    { thumbnailUrl: id + '/other.jpg' },
    { identifier: ['different-accession'] },
  ]) {
    snap({ ...obj, ...patch });
    assert(!inspectGettyReference(d, r).eligible);
  }
  snap(obj);
  for (const patch of [
    { downloadUrl: id + '/full/!1000,1000/0/default.jpg' },
    { sha256: hash('unrelated') },
    { originalReview: { status: 'pending' } },
    { width: 300 },
    { artist: 'John Burke' },
    { creators: ['John Burke'] },
  ])
    assert(!inspectGettyReference(d, { ...r, ...patch }).eligible);
  fs.writeFileSync(path.join(d, 'object.html'), 'unrelated CC0 footer');
  assert(!inspectGettyReference(d, r).eligible);
});
