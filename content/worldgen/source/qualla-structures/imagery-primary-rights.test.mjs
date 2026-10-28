import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectImageryPolicy } from './imagery-policy.mjs';
import { inspectQuallaPrimaryRights } from './imagery-primary-rights.mjs';

test('an omitted category needs a bound native government release and still requires published Qualla clearance', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-usace-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, value) => {
    const f = path.join(root, p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, value);
  };
  const bytes = Buffer.from('native photograph'),
    sha = (b, a = 'sha256') => createHash(a).update(b).digest('hex');
  const image = {
      path: '_m/a/b/c/d/story/front.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Dam.jpg',
      artist: 'U.S. Army Corps of Engineers Sacramento District',
      license: 'Public domain',
    },
    story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' };
  const rightsPath = 'content/worldgen/source/places/ab/abc/dam/reference-rights/native.json';
  const page = {
    title: 'File:Dam.jpg',
    revisions: [
      {
        revid: 12,
        slots: {
          main: {
            '*': '{{Information|Author=U.S. Army Corps of Engineers Sacramento District|Description=(U.S. Army Photo/ Michael J. Nevins)}}\n{{PD-USGov-Military-Army-USACE}}',
          },
        },
      },
    ],
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Dam.jpg',
        sha1: sha(bytes, 'sha1'),
        extmetadata: {
          Artist: { value: image.artist },
          LicenseShortName: { value: 'Public domain' },
        },
      },
    ],
  };
  const record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3ADam.jpg',
      query: { pages: { 1: page } },
    },
    reference = {
      ...image,
      sha256: sha(bytes),
      publicDomainEvidence: {
        kind: 'commons-native-usace-photo',
        path: rightsPath,
        photographer: 'Michael J. Nevins',
      },
    };
  put(image.path, bytes);
  put(story.sourcePath, JSON.stringify({ media: { images: [image] } }));
  put(
    '_m/a/b/c/d/story/metadata.json',
    JSON.stringify({ gallery: [image], galleryPaths: [image.path] }),
  );
  const save = () => {
    const s = JSON.stringify(record);
    put(rightsPath, s);
    reference.publicDomainEvidence.sha256 = sha(s);
  };
  const run = () =>
    inspectImageryPolicy({
      qualla: root,
      rightsRoot: root,
      references: [reference],
      stories: [story],
    });
  save();
  assert.equal(run().status, 'passed');
  assert.equal(run().references[0].primaryRights.nativeSha1, sha(bytes, 'sha1'));
  put(rightsPath, 'changed');
  assert.equal(run().status, 'needs-replacement');
  save();
  page.imageinfo[0].sha1 = sha('different', 'sha1');
  save();
  assert.equal(run().status, 'needs-replacement');
  page.imageinfo[0].sha1 = sha(bytes, 'sha1');
  const wiki = page.revisions[0].slots.main['*'];
  page.revisions[0].slots.main['*'] = wiki.replace(
    '{{PD-USGov-Military-Army-USACE}}',
    '{{CC-by-2.0}}',
  );
  save();
  assert.equal(run().status, 'needs-replacement');
  page.revisions[0].slots.main['*'] = wiki;
  reference.publicDomainEvidence.photographer = 'Someone Else';
  save();
  assert.equal(run().status, 'needs-replacement');
  reference.publicDomainEvidence.photographer = 'Michael J. Nevins';
  page.imageinfo[0].extmetadata.Artist.value = 'Private contractor';
  save();
  assert.equal(run().status, 'needs-replacement');
  page.imageinfo[0].extmetadata.Artist.value = image.artist;
  save();
  put(story.sourcePath, JSON.stringify({ media: { images: [] } }));
  assert.equal(run().status, 'needs-replacement');
  put(story.sourcePath, JSON.stringify({ media: { images: [image] } }));
  put(
    '_m/a/b/c/d/story/metadata.json',
    JSON.stringify({ gallery: [{ ...image, license: 'CC BY 4.0' }], galleryPaths: [image.path] }),
  );
  assert.equal(run().status, 'needs-replacement');
});

test('an expired journal proof binds publication date, publisher, archival plate and exact native scan', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-journal-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, v) => {
      const f = path.join(root, p);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, v);
    },
    bytes = Buffer.from('native journal plate'),
    sha = (v, a = 'sha256') => createHash(a).update(v).digest('hex'),
    image = {
      path: '_m/a/b/c/d/story/plan.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plan.jpg',
      artist: 'The Building Review, San Francisco',
      license: 'Public domain',
    },
    story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' },
    rightsPath = 'content/worldgen/source/places/ab/abc/hotel/reference-rights/native.json';
  const wiki =
      '{{Information\n|Source=[http://hdl.handle.net/2027/mdp.39015086651190 The Building Review plate 63]\n|Date=November 1921\n|Author=The Building Review, San Francisco\n|Permission=Pre-1923\n}}\nThis journal is a US publication published before 1923.\n{{PD-US}}',
    page = {
      title: 'File:Plan.jpg',
      revisions: [{ revid: 11, slots: { main: { '*': wiki } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Plan.jpg',
          sha1: sha(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: image.artist },
            LicenseShortName: { value: 'Public domain' },
          },
        },
      ],
    },
    record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3APlan.jpg',
      query: { pages: { 1: page } },
    },
    proof = {
      kind: 'commons-native-expired-publication',
      path: rightsPath,
      publicationTitle: 'The Building Review',
      sourceCitation: 'The Building Review plate 63',
      publicationDate: 'November 1921',
      publicationYear: 1921,
    },
    reference = { ...image, sha256: sha(bytes), publicDomainEvidence: proof };
  put(image.path, bytes);
  put(story.sourcePath, JSON.stringify({ media: { images: [image] } }));
  put(
    '_m/a/b/c/d/story/metadata.json',
    JSON.stringify({ gallery: [image], galleryPaths: [image.path] }),
  );
  const save = () => {
      const v = JSON.stringify(record);
      put(rightsPath, v);
      proof.sha256 = sha(v);
    },
    run = () =>
      inspectImageryPolicy({
        qualla: root,
        rightsRoot: root,
        references: [reference],
        stories: [story],
      });
  save();
  assert.equal(run().status, 'passed');
  for (const [from, to] of [
    ['|Date=November 1921', '|Date=November 1951'],
    ['|Permission=Pre-1923', '|Permission=Unknown'],
    ['{{PD-US}}', '{{PD-US architecture}}'],
    ['The Building Review plate 63', 'Another journal plate 63'],
    ['http://hdl.handle.net/2027/mdp.39015086651190', 'https://example.com/copy'],
    ['|Author=The Building Review, San Francisco', '|Author=Unknown'],
  ]) {
    page.revisions[0].slots.main['*'] = wiki.replace(from, to);
    save();
    assert.equal(run().status, 'needs-replacement');
  }
  page.revisions[0].slots.main['*'] = wiki;
  save();
  proof.publicationYear = 1951;
  assert.equal(run().status, 'needs-replacement');
  proof.publicationYear = 1921;
  page.imageinfo[0].sha1 = sha('replacement', 'sha1');
  save();
  assert.equal(run().status, 'needs-replacement');
});

test('DOE recovery requires the agency original and reviewed government-work grant', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-doe-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, v) => {
    const f = path.join(root, p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, v);
  };
  const bytes = Buffer.from('native DOE photograph');
  const sha = (v, a = 'sha256') => createHash(a).update(v).digest('hex');
  const image = {
    path: '_m/a/b/c/d/story/front.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plant.jpg',
    artist: 'ENERGY.GOV',
    license: 'Public domain',
  };
  const rightsPath = 'content/worldgen/source/places/ab/abc/plant/reference-rights/native.json';
  const wiki =
    '{{Information\n| Source = [https://www.flickr.com/photos/departmentofenergy/123/ Original]\n}}\n{{PD-USGov-DOE}}\n{{User:FlickreviewR/reviewed-pass|ENERGY.GOV|https://www.flickr.com/photos/37916456@N02/123|2014-10-06|United States Government Work|}}';
  const page = {
    title: 'File:Plant.jpg',
    revisions: [{ revid: 12, slots: { main: { '*': wiki } } }],
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Plant.jpg',
        sha1: sha(bytes, 'sha1'),
        extmetadata: {
          Artist: { value: image.artist },
          LicenseShortName: { value: image.license },
        },
      },
    ],
  };
  const record = {
    source:
      'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3APlant.jpg',
    query: { pages: { 1: page } },
  };
  const reference = {
    ...image,
    sha256: sha(bytes),
    publicDomainEvidence: { kind: 'commons-native-doe-photo', path: rightsPath },
  };
  const article = { media: { images: [image] } };
  const story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' };
  put(image.path, bytes);
  put(story.sourcePath, JSON.stringify(article));
  put(
    '_m/a/b/c/d/story/metadata.json',
    JSON.stringify({ gallery: [image], galleryPaths: [image.path] }),
  );
  const save = () => {
    const v = JSON.stringify(record);
    put(rightsPath, v);
    reference.publicDomainEvidence.sha256 = sha(v);
  };
  const run = () => {
    save();
    return inspectImageryPolicy({
      qualla: root,
      rightsRoot: root,
      references: [reference],
      stories: [story],
    }).status;
  };
  assert.equal(run(), 'passed');
  for (const [from, to] of [
    ['{{PD-USGov-DOE}}', '{{Cc-by-2.0}}'],
    ['United States Government Work', 'CC BY 2.0'],
    ['photos/departmentofenergy/', 'photos/private/'],
    ['reviewed-pass', 'reviewed-fail'],
  ]) {
    page.revisions[0].slots.main['*'] = wiki.replace(from, to);
    assert.equal(run(), 'needs-replacement');
  }
  page.revisions[0].slots.main['*'] = wiki;
  page.imageinfo[0].sha1 = sha('another original', 'sha1');
  assert.equal(run(), 'needs-replacement');
  page.imageinfo[0].sha1 = sha(bytes, 'sha1');
  put(story.sourcePath, JSON.stringify({ media: { images: [] } }));
  assert.equal(run(), 'needs-replacement');
});

test('NPS recovery binds the agency photographer, publisher, NPGallery accession and exact original', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-nps-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, v) => {
    const f = path.join(root, p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, v);
  };
  const bytes = Buffer.from('native NPS photograph'),
    sha = (v, a = 'sha256') => createHash(a).update(v).digest('hex');
  const image = {
    path: '_m/a/b/c/d/story/front.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mansion.jpg',
    artist: 'NPS',
    license: 'Public domain',
  };
  const rightsPath = 'content/worldgen/source/places/ab/abc/mansion/reference-rights/native.json',
    asset = 'ff39d9f9-9a88-1491-8ddf-2435c6b36807';
  const wiki = `{{Photograph\n|photographer={{en|1=NPS}}\n|publisher={{en|1=U.S. National Park Service}}\n|accession number={{NPGallery-accession|${asset}}}\n|source={{NPGallery-source}}\n|permission={{PD-USGov-NPS}}\n}}`;
  const page = {
    title: 'File:Mansion.jpg',
    revisions: [{ revid: 12, slots: { main: { '*': wiki } } }],
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Mansion.jpg',
        sha1: sha(bytes, 'sha1'),
        extmetadata: { Artist: { value: 'NPS' }, LicenseShortName: { value: 'Public domain' } },
      },
    ],
  };
  const record = {
    source:
      'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3AMansion.jpg',
    query: { pages: { 1: page } },
  };
  const reference = {
      ...image,
      sha256: sha(bytes),
      publicDomainEvidence: {
        kind: 'commons-native-nps-photo',
        path: rightsPath,
        npgalleryAssetId: asset,
      },
    },
    story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' };
  put(image.path, bytes);
  put(story.sourcePath, JSON.stringify({ media: { images: [image] } }));
  put(
    '_m/a/b/c/d/story/metadata.json',
    JSON.stringify({ gallery: [image], galleryPaths: [image.path] }),
  );
  const run = () => {
    const v = JSON.stringify(record);
    put(rightsPath, v);
    reference.publicDomainEvidence.sha256 = sha(v);
    return inspectImageryPolicy({
      qualla: root,
      rightsRoot: root,
      references: [reference],
      stories: [story],
    }).status;
  };
  assert.equal(run(), 'passed');
  for (const [from, to] of [
    ['PD-USGov-NPS', 'CC-by-2.0'],
    ['photographer={{en|1=NPS}}', 'photographer={{en|1=Private contributor}}'],
    ['U.S. National Park Service', 'Private publisher'],
    ['NPGallery-source', 'Unknown-source'],
    [asset, '00000000-0000-0000-0000-000000000000'],
  ]) {
    page.revisions[0].slots.main['*'] = wiki.replace(from, to);
    assert.equal(run(), 'needs-replacement');
  }
  page.revisions[0].slots.main['*'] = wiki;
  page.imageinfo[0].sha1 = sha('other image', 'sha1');
  assert.equal(run(), 'needs-replacement');
  page.imageinfo[0].sha1 = sha(bytes, 'sha1');
  put(story.sourcePath, JSON.stringify({ media: { images: [] } }));
  assert.equal(run(), 'needs-replacement');
});

test('unrecorded SLQ photographers need exact item releases and cannot override named credits', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-slq-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, v) => {
    const f = path.join(root, p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v));
  };
  const bytes = Buffer.from('exact archival photograph'),
    sha = (v, a = 'sha256') => createHash(a).update(v).digest('hex');
  const image = {
    path: '_m/a/b/c/d/story/front.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Archive.jpg',
    license: 'Public domain',
  };
  const story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' };
  const metadata = {
    gallery: [{ ...image, categories: ['PD-Australia'] }],
    galleryPaths: [image.path],
  };
  const page = {
    title: 'File:Archive.jpg',
    revisions: [
      {
        revid: 42,
        slots: {
          main: {
            '*': '{{Information\n|source={{handle|id=10462/deriv/1234|text=Item is held by John Oxley Library, State Library of Queensland.}}\n|author=\n|permission=\n}}\n{{PD-Australia}}\n{{StateLibQld-License}}',
          },
        },
      },
    ],
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Archive.jpg',
        sha1: sha(bytes, 'sha1'),
        extmetadata: { LicenseShortName: { value: 'Public domain' } },
      },
    ],
  };
  const record = {
    source:
      'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3AArchive.jpg',
    query: { pages: { 1: page } },
  };
  const rightsPath = 'content/worldgen/source/places/ab/abc/house/reference-rights/native.json';
  const reference = { ...image, artist: null, sha256: sha(bytes) };
  const run = () =>
    inspectImageryPolicy({
      qualla: root,
      rightsRoot: root,
      references: [reference],
      stories: [story],
    });
  put(image.path, bytes);
  put('_m/a/b/c/d/story/metadata.json', metadata);
  put(story.sourcePath, { media: { images: [image] } });
  assert.equal(run().status, 'needs-replacement');
  reference.publicDomainEvidence = {
    kind: 'commons-native-slq-archival-photo',
    archive: 'state-library-queensland',
    archiveItem: '10462/deriv/1234',
    path: rightsPath,
  };
  const save = () => {
    const s = JSON.stringify(record);
    put(rightsPath, s);
    reference.publicDomainEvidence.sha256 = sha(s);
  };
  save();
  assert.equal(run().status, 'passed');
  assert.equal(run().references[0].primaryRights.creatorAttribution, 'unrecorded-archival');
  metadata.gallery[0].artist = 'Named photographer';
  put('_m/a/b/c/d/story/metadata.json', metadata);
  assert.equal(run().status, 'needs-replacement');
  delete metadata.gallery[0].artist;
  put('_m/a/b/c/d/story/metadata.json', metadata);
  put(story.sourcePath, {
    media: { images: [{ ...image, artist: 'Conflicting published photographer' }] },
  });
  assert.equal(run().status, 'needs-replacement');
  put(story.sourcePath, { media: { images: [image] } });
  reference.artist = 'Unknown author';
  assert.equal(run().status, 'needs-replacement');
  reference.artist = null;
  page.imageinfo[0].extmetadata.Artist = { value: 'Native named photographer' };
  save();
  assert.equal(run().status, 'needs-replacement');
  delete page.imageinfo[0].extmetadata.Artist;
  const wiki = page.revisions[0].slots.main['*'];
  page.revisions[0].slots.main['*'] = wiki.replace('|author=\n', '|author=Native photographer\n');
  save();
  assert.equal(run().status, 'needs-replacement');
  page.revisions[0].slots.main['*'] = wiki.replace('{{StateLibQld-License}}', '{{CC-by-4.0}}');
  save();
  assert.equal(run().status, 'needs-replacement');
  page.revisions[0].slots.main['*'] = wiki;
  save();
  reference.publicDomainEvidence.archiveItem = '10462/deriv/9999';
  assert.equal(run().status, 'needs-replacement');
  reference.publicDomainEvidence.archiveItem = '10462/deriv/1234';
  put(image.path, Buffer.from('different photograph'));
  assert.equal(run().status, 'needs-replacement');
  put(image.path, bytes);
  assert.equal(run().status, 'passed');
});

test('a creator release recovers an omitted category only for the exact published own photograph', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-creator-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, v) => {
    const f = path.join(root, p);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.isBuffer(v) || typeof v === 'string' ? v : JSON.stringify(v));
  };
  const bytes = Buffer.from('exact creator photograph'),
    sha = (v, a = 'sha256') => createHash(a).update(v).digest('hex'),
    image = {
      path: '_m/a/b/c/d/story/front.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Portal.jpg',
      license: 'Public domain',
      artist: 'Photographer',
    },
    story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' },
    rightsPath = 'content/worldgen/source/places/ab/abc/tunnel/reference-rights/native.json',
    wiki = '{{Information\n|Source={{own photo}}\n|Author=Photographer\n}}\n{{PD-self}}',
    page = {
      title: 'File:Portal.jpg',
      revisions: [{ revid: 43, slots: { main: { '*': wiki } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Portal.jpg',
          sha1: sha(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: 'Photographer' },
            LicenseShortName: { value: 'Public domain' },
          },
        },
      ],
    },
    record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3APortal.jpg',
      query: { pages: { 1: page } },
    },
    reference = { ...image, sha256: sha(bytes) };
  put(image.path, bytes);
  put('_m/a/b/c/d/story/metadata.json', { gallery: [image], galleryPaths: [image.path] });
  const publish = (images = [image]) => put(story.sourcePath, { media: { images } });
  publish();
  const run = () =>
    inspectImageryPolicy({
      qualla: root,
      rightsRoot: root,
      references: [reference],
      stories: [story],
    });
  assert.equal(run().status, 'needs-replacement');
  reference.publicDomainEvidence = {
    kind: 'commons-native-self-released-photo',
    path: rightsPath,
    photographer: 'Photographer',
  };
  const save = () => {
    const s = JSON.stringify(record);
    put(rightsPath, s);
    reference.publicDomainEvidence.sha256 = sha(s);
  };
  save();
  assert.equal(run().status, 'passed');
  for (const replacement of [
    wiki.replace('{{PD-self}}', '{{CC-by-4.0}}'),
    wiki.replace('{{own photo}}', 'Some website'),
    wiki.replace('|Author=Photographer', '|Author=Someone Else'),
  ]) {
    page.revisions[0].slots.main['*'] = replacement;
    save();
    assert.equal(run().status, 'needs-replacement');
  }
  page.revisions[0].slots.main['*'] = wiki;
  page.imageinfo[0].extmetadata.Artist.value = 'Someone Else';
  save();
  assert.equal(run().status, 'needs-replacement');
  page.imageinfo[0].extmetadata.Artist.value = 'Photographer';
  page.imageinfo[0].sha1 = sha('other photo', 'sha1');
  save();
  assert.equal(run().status, 'needs-replacement');
  page.imageinfo[0].sha1 = sha(bytes, 'sha1');
  save();
  put(rightsPath, 'changed release');
  assert.equal(run().status, 'needs-replacement');
  save();
  publish([]);
  assert.equal(run().status, 'needs-replacement');
  publish([{ ...image, artist: 'Conflicting published creator' }]);
  assert.equal(run().status, 'needs-replacement');
  publish();
  assert.equal(run().status, 'passed');
  page.revisions[0].slots.main['*'] = wiki.replace('Author=Photographer', 'Author=Unknown author');
  page.imageinfo[0].extmetadata.Artist.value = 'Unknown author';
  save();
  assert.equal(
    inspectQuallaPrimaryRights(
      {
        ...reference,
        artist: 'Unknown author',
        publicDomainEvidence: { ...reference.publicDomainEvidence, photographer: 'Unknown author' },
      },
      bytes,
      root,
    ).eligible,
    false,
  );
});

test('dated Argentine periodical photos require an exact issue, BNE citation and both expired-work grants', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-periodical-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('original printed photograph'),
    sha = (v, a = 'sha256') => createHash(a).update(v).digest('hex'),
    rp = 'content/worldgen/source/places/ab/abc/hotel/reference-rights/periodical.json';
  fs.mkdirSync(path.dirname(path.join(root, rp)), { recursive: true });
  const wiki =
      "{{Information\n|Source=[http://hemerotecadigital.bne.es/issue.vm?id=123 ''Caras y Caretas'' n 21]\n|Date=1899-02\n|Author=Credited Photographer\n}}\n{{PD-AR-Photo}}\n{{PD-US-expired}}",
    p = {
      title: 'File:Plate.jpg',
      revisions: [{ revid: 1, slots: { main: { '*': wiki } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Plate.jpg',
          sha1: sha(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: 'Credited Photographer' },
            LicenseShortName: { value: 'Public domain' },
          },
        },
      ],
    },
    record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3APlate.jpg',
      query: { pages: { 1: p } },
    },
    reference = {
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plate.jpg',
      artist: 'Credited Photographer',
      license: 'Public domain',
      publicDomainEvidence: {
        kind: 'commons-native-expired-periodical-photo',
        path: rp,
        publicationTitle: 'Caras y Caretas',
        publicationYear: 1899,
        publicationCountry: 'AR',
        issueNumber: 21,
        publicationRecord: 'https://hemerotecadigital.bne.es/issue.vm?id=123',
      },
    };
  const save = () => {
      const s = JSON.stringify(record);
      fs.writeFileSync(path.join(root, rp), s);
      reference.publicDomainEvidence.sha256 = sha(s);
    },
    run = () => inspectQuallaPrimaryRights(reference, bytes, root);
  save();
  assert.equal(run().eligible, true);
  for (const bad of [
    wiki.replace('1899-02', '1939-02'),
    wiki.replace('n 21', 'n 22'),
    wiki.replace('id=123', 'id=456'),
    wiki.replace('PD-US-expired', 'CC-by-4.0'),
    wiki.replace('PD-AR-Photo', 'PD-1996'),
    wiki.replace('Credited Photographer', 'Unknown'),
  ]) {
    p.revisions[0].slots.main['*'] = bad;
    save();
    assert.equal(run().eligible, false);
  }
  p.revisions[0].slots.main['*'] = wiki;
  save();
  p.imageinfo[0].sha1 = sha('different original', 'sha1');
  save();
  assert.equal(run().eligible, false);
  p.imageinfo[0].sha1 = sha(bytes, 'sha1');
  save();
  assert.equal(run().eligible, true);
  fs.writeFileSync(path.join(root, rp), 'changed');
  assert.equal(run().eligible, false);
});

test('an uncredited book plate needs the exact dated US library publication and caption rather than an old-photo guess', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-book-plate-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('published book photograph'),
    sha = (v, a = 'sha256') => createHash(a).update(v).digest('hex'),
    rp = 'content/worldgen/source/places/ab/abc/hotel/reference-rights/book.json';
  fs.mkdirSync(path.dirname(path.join(root, rp)), { recursive: true });
  const wiki =
      "{{Information\n|Source=''To the River Plate and back'' by W. J. Holland - New York\n|Date=1913\n|Author=Unknown\n}}\n{{PD-US-expired|country=US}}",
    p = {
      title: 'File:Plate.jpg',
      revisions: [{ revid: 1, slots: { main: { '*': wiki } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Plate.jpg',
          sha1: sha(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: 'Unknown' },
            LicenseShortName: { value: 'Public domain' },
          },
        },
      ],
    },
    metadata = {
      identifier: 'book1913',
      title: 'To the River Plate and back; the narrative',
      creator: 'Holland, W. J.',
      publisher: "New York : G.P. Putnam's sons",
      date: '1913',
      contributor: 'University Library',
      'possible-copyright-status': 'NOT_IN_COPYRIGHT',
      'copyright-region': 'US',
    },
    record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3APlate.jpg',
      query: { pages: { 1: p } },
      publicationEvidence: {
        source: 'https://archive.org/metadata/book1913',
        catalog: { metadata },
        plateCaption: 'Lodging House of the Hotel Bristol, Mar del Plata.',
        plateCaptionSource: 'https://archive.org/download/book1913/book1913_djvu.txt',
      },
    },
    reference = {
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plate.jpg',
      artist: 'Unknown',
      license: 'Public domain',
      publicDomainEvidence: {
        kind: 'commons-native-expired-us-book-photo',
        path: rp,
        publicationTitle: 'To the River Plate and back',
        publicationYear: 1913,
        archiveIdentifier: 'book1913',
        bookAuthor: 'W. J. Holland',
      },
    };
  const save = () => {
      const s = JSON.stringify(record);
      fs.writeFileSync(path.join(root, rp), s);
      reference.publicDomainEvidence.sha256 = sha(s);
    },
    run = () => inspectQuallaPrimaryRights(reference, bytes, root);
  save();
  assert.equal(run().eligible, true);
  assert.equal(run().creatorAttribution, 'unrecorded-published-plate');
  for (const [k, v] of [
    ['date', '2013'],
    ['identifier', 'otherbook'],
    ['publisher', 'London only'],
    ['possible-copyright-status', 'IN_COPYRIGHT'],
    ['copyright-region', 'UK'],
    ['creator', 'Different, Author'],
  ]) {
    const old = metadata[k];
    metadata[k] = v;
    save();
    assert.equal(run().eligible, false, k);
    metadata[k] = old;
  }
  save();
  const old = record.publicationEvidence.plateCaption;
  record.publicationEvidence.plateCaption = 'Different photograph';
  save();
  assert.equal(run().eligible, false);
  record.publicationEvidence.plateCaption = old;
  p.revisions[0].slots.main['*'] = wiki.replace('1913', '2013');
  save();
  assert.equal(run().eligible, false);
  p.revisions[0].slots.main['*'] = wiki;
  reference.artist = 'Invented Photographer';
  save();
  assert.equal(run().eligible, false);
  reference.artist = 'Unknown';
  p.imageinfo[0].sha1 = sha('different', 'sha1');
  save();
  assert.equal(run().eligible, false);
  p.imageinfo[0].sha1 = sha(bytes, 'sha1');
  save();
  assert.equal(run().eligible, true);
});

test('historical prints require exact named creators, dated citations, native grants and original bytes', async (t) => {
  const { inspectHistoricalPrintReference } = await import('./imagery-inventory.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-old-print-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'content/worldgen/source/places/ab/abc/fort');
  fs.mkdirSync(path.join(dir, 'reference-rights'), { recursive: true });
  const bytes = Buffer.from('native period drawing'),
    hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex');
  fs.writeFileSync(path.join(dir, 'plan.jpg'), bytes);
  for (const fixture of [
    {
      recordClass: 'brazilian-periodical',
      artist: 'Angelo Agostini',
      author: '{{Creator:Angelo Agostini}}',
      date: '1868-03-21',
      publicationYear: 1868,
      sourceCitation: 'A Vida Fluminense, nº 12',
      publicationTitle: 'A Vida Fluminense',
      issueNumber: 12,
      grant: 'PD-Brazil-media',
    },
    {
      recordClass: 'named-old-map',
      artist: 'Chodasiewicz, Roberto Adolfo (1832-1891)',
      date: '1868',
      publicationYear: 1868,
      sourceCitation: 'National Library of Brazil',
      creatorDied: 1891,
      grant: 'PD-old-70-1923',
    },
    {
      recordClass: 'brazilian-library-map',
      artist: 'Everad & Hodasiewicz',
      date: '1869',
      publicationYear: 1869,
      sourceCitation:
        'Rio de Janeiro, RJ: Semana Ilustrada, 1869. <http://objdigital.bn.br/objdigital2/acervo_digital/div_cartografia/cart517186/cart517186.jpg>',
      archiveOriginal:
        'https://objdigital.bn.br/objdigital2/acervo_digital/div_cartografia/cart517186/cart517186.jpg',
      grant: 'PD-Brazil-media',
    },
  ]) {
    const wiki = `{{Information\n|description=Engineering plan of the fort\n|author=${fixture.author ?? fixture.artist}\n|date=${fixture.date}\n|source=${fixture.sourceCitation}\n}}\n{{${fixture.grant}}}`;
    const page = {
      title: 'File:Plan.jpg',
      revisions: [{ revid: 17, slots: { main: { '*': wiki } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Plan.jpg',
          sha1: hash(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: fixture.artist },
            LicenseShortName: { value: 'Public domain' },
          },
        },
      ],
    };
    const record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3APlan.jpg',
      query: { pages: { 1: page } },
    };
    const proof = {
      kind: 'commons-native-expired-historical-print',
      path: 'content/worldgen/source/places/ab/abc/fort/reference-rights/native.json',
      ...fixture,
    };
    const ref = {
      path: 'plan.jpg',
      origin: 'commons-expired-historical-print',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Plan.jpg',
      artist: fixture.artist,
      license: 'Public domain',
      sha256: hash(bytes),
      publicDomainEvidence: proof,
      rightsEvidence: { path: 'reference-rights/native.json' },
      visuallyReviewedForThisPolicy: true,
      originalReview: { status: 'inspected', rendition: 'native-original' },
    };
    const save = () => {
      const b = JSON.stringify(record);
      fs.writeFileSync(path.join(root, proof.path), b);
      proof.sha256 = hash(b);
      ref.rightsEvidence.sha256 = hash(b);
    };
    const run = () => inspectHistoricalPrintReference(dir, ref, root);
    save();
    assert.equal(run().eligible, true, fixture.recordClass);
    for (const [from, to] of [
      [`{{${fixture.grant}}}`, '{{CC-by-sa-4.0}}'],
      [`|author=${fixture.author ?? fixture.artist}`, '|author=Unknown'],
      [`|date=${fixture.date}`, '|date=1968'],
      [`|source=${fixture.sourceCitation}`, '|source=Another map'],
    ]) {
      page.revisions[0].slots.main['*'] = wiki.replace(from, to);
      save();
      assert.equal(run().eligible, false, from);
    }
    page.revisions[0].slots.main['*'] = wiki;
    save();
    page.imageinfo[0].sha1 = hash('wrong', 'sha1');
    save();
    assert.equal(run().eligible, false);
    page.imageinfo[0].sha1 = hash(bytes, 'sha1');
    save();
    ref.visuallyReviewedForThisPolicy = false;
    assert.equal(run().eligible, false);
    ref.visuallyReviewedForThisPolicy = true;
    fs.writeFileSync(path.join(dir, 'plan.jpg'), 'changed');
    assert.equal(run().eligible, false);
    fs.writeFileSync(path.join(dir, 'plan.jpg'), bytes);
    proof.publicationYear = 1968;
    assert.equal(run().eligible, false);
    proof.publicationYear = fixture.publicationYear;
    if (fixture.creatorDied) {
      proof.creatorDied = 1900;
      assert.equal(run().eligible, false);
      proof.creatorDied = fixture.creatorDied;
    }
    assert.equal(run().eligible, true);
  }
});

test('the original Arnaud map requires both native grants and its exact named BnF object', async (t) => {
  const { inspectHistoricalPrintReference } = await import('./imagery-inventory.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-arnaud-map-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'content/worldgen/source/places/t4/t48/marib_dam');
  fs.mkdirSync(path.join(dir, 'reference-rights'), { recursive: true });
  const bytes = Buffer.from('exact original nineteenth century map'),
    hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex'),
    title = 'File:Plan de la digue - Fait par Mr. Th. Joseph Arnaud en 1843 (2 of 4).jpg',
    artist = 'Arnaud, Thomas-Joseph (1812-1884). Auteur du texte',
    citation = '{{fr|1=Bibliothèque nationale de France, département Cartes et plans, GE D-14364}}',
    wiki = `{{Artwork\n|author=${artist}\nMohl, J. (18..-19..?). Auteur du texte\n|title=Plan de la digue / Fait par Mr. Th. Joseph Arnaud en 1843\n|date=1873\n|source=${citation}\n{{ARK-BNF|ark:/12148/btv1b84924810}} (2/4)\n}}\n{{PD-France}}\n{{PD-US-expired}}`,
    page = {
      title,
      revisions: [{ revid: 21, slots: { main: { '*': wiki } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Arnaud.jpg',
          sha1: hash(bytes, 'sha1'),
          extmetadata: { Artist: { value: artist }, LicenseShortName: { value: 'Public domain' } },
        },
      ],
    },
    record = {
      source: `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=${encodeURIComponent(title)}`,
      query: { pages: { 1: page } },
    },
    proof = {
      kind: 'commons-native-expired-historical-print',
      path: 'content/worldgen/source/places/t4/t48/marib_dam/reference-rights/native.json',
      recordClass: 'bnf-arnaud-1843-map',
      publicationYear: 1873,
      creatorDied: 1884,
      archiveItem: 'btv1b84924810',
      sourceCitation: citation,
    },
    ref = {
      path: 'plan.jpg',
      origin: 'commons-expired-historical-print',
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      artist,
      license: 'Public domain',
      sha256: hash(bytes),
      publicDomainEvidence: proof,
      rightsEvidence: { path: 'reference-rights/native.json' },
      visuallyReviewedForThisPolicy: true,
      originalReview: { status: 'inspected', rendition: 'native-original' },
    };
  fs.writeFileSync(path.join(dir, 'plan.jpg'), bytes);
  const save = () => {
      const b = JSON.stringify(record);
      fs.writeFileSync(path.join(root, proof.path), b);
      proof.sha256 = hash(b);
      ref.rightsEvidence.sha256 = hash(b);
    },
    run = () => {
      save();
      return inspectHistoricalPrintReference(dir, ref, root).eligible;
    };
  assert.equal(run(), true);
  for (const [from, to] of [
    ['{{PD-France}}', ''],
    ['{{PD-US-expired}}', ''],
    ['{{PD-France}}', '{{PD-old-assumed}}'],
    [artist, 'Unknown author'],
    ['|date=1873', '|date=1973'],
    ['GE D-14364', 'GE D-99999'],
    ['btv1b84924810', 'btv1b99999999'],
    [wiki, `${wiki}\n{{CC-by-sa-4.0}}`],
  ]) {
    page.revisions[0].slots.main['*'] = wiki.replace(from, to);
    assert.equal(run(), false, from);
  }
  page.revisions[0].slots.main['*'] = wiki;
  for (const [field, value] of [
    ['creatorDied', 1934],
    ['publicationYear', 1934],
    ['archiveItem', 'other'],
  ]) {
    const old = proof[field];
    proof[field] = value;
    assert.equal(run(), false, field);
    proof[field] = old;
  }
  page.imageinfo[0].sha1 = hash('other original', 'sha1');
  assert.equal(run(), false);
  page.imageinfo[0].sha1 = hash(bytes, 'sha1');
  ref.visuallyReviewedForThisPolicy = false;
  assert.equal(run(), false);
  ref.visuallyReviewedForThisPolicy = true;
  fs.writeFileSync(path.join(dir, 'plan.jpg'), 'different pixels');
  assert.equal(run(), false);
  fs.writeFileSync(path.join(dir, 'plan.jpg'), bytes);
  assert.equal(run(), true);
});

test('an expired named library photograph can recover an omitted category without changing published media', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-library-photo-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, b) => {
      const f = path.join(root, p);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, b);
    },
    sha = (b, a = 'sha256') => createHash(a).update(b).digest('hex'),
    bytes = Buffer.from('exact old library photograph'),
    rightsPath = 'content/worldgen/source/places/ab/abc/bridge/reference-rights/native.json',
    image = {
      path: '_m/a/b/c/d/story/bridge.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bridge.jpg',
      artist: 'Named Photographer',
      license: 'Public domain',
    },
    story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' },
    sourceCitation =
      '{{Institution:Biblioteca Nacional de España}} [http://bdh.bne.es/bnesearch/detalle/bdh0000012345]',
    wiki = `{{Information\n|description=Bridge photographed in the nineteenth century\n|date={{other date|~|1870}}\n|source=${sourceCitation}\n|author={{Creator:Named Photographer}}\n}}\n{{PD-old}}`,
    page = {
      title: 'File:Bridge.jpg',
      revisions: [{ revid: 12, slots: { main: { '*': wiki } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bridge.jpg',
          sha1: sha(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: '<span title="Photographer (1816-1886)">Named Photographer</span>' },
            LicenseShortName: { value: 'Public domain' },
          },
        },
      ],
    },
    record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3ABridge.jpg',
      query: { pages: { 1: page } },
    },
    reference = {
      ...image,
      sha256: sha(bytes),
      publicDomainEvidence: {
        kind: 'commons-native-expired-library-photo',
        path: rightsPath,
        photoYear: 1870,
        creatorDied: 1886,
        archiveItem: 'bdh0000012345',
        sourceCitation,
      },
    };
  put(image.path, bytes);
  put(story.sourcePath, JSON.stringify({ media: { images: [image] } }));
  put(
    '_m/a/b/c/d/story/metadata.json',
    JSON.stringify({ gallery: [image], galleryPaths: [image.path] }),
  );
  const save = () => {
      const b = JSON.stringify(record);
      put(rightsPath, b);
      reference.publicDomainEvidence.sha256 = sha(b);
    },
    run = () =>
      inspectImageryPolicy({
        qualla: root,
        rightsRoot: root,
        references: [reference],
        stories: [story],
      });
  save();
  assert.equal(run().status, 'passed');
  // A generic public-domain label cannot replace the pinned library/date/creator evidence.
  for (const bad of [
    wiki.replace('PD-old', 'CC-by-4.0'),
    `${wiki}\n{{CC BY 4.0}}`,
    wiki.replace('1870', '1970'),
    wiki.replace('Named Photographer}}', 'Unknown}}'),
    wiki.replace('bdh0000012345', 'bdh0000099999'),
    wiki.replace('Biblioteca Nacional de España', 'Unverified archive'),
  ]) {
    page.revisions[0].slots.main['*'] = bad;
    save();
    assert.equal(run().status, 'needs-replacement');
  }
  page.revisions[0].slots.main['*'] = wiki;
  const originalArtist = page.imageinfo[0].extmetadata.Artist.value;
  for (const bad of [
    'Named Photographer',
    originalArtist.replace('1886', '1956'),
    originalArtist.replace('1886', '1871'),
  ]) {
    page.imageinfo[0].extmetadata.Artist.value = bad;
    save();
    assert.equal(run().status, 'needs-replacement');
  }
  page.imageinfo[0].extmetadata.Artist.value = originalArtist;
  page.imageinfo[0].sha1 = sha('other photograph', 'sha1');
  save();
  assert.equal(run().status, 'needs-replacement');
  page.imageinfo[0].sha1 = sha(bytes, 'sha1');
  save();
  put(rightsPath, 'changed snapshot');
  assert.equal(run().status, 'needs-replacement');
  save();
  put(story.sourcePath, JSON.stringify({ media: { images: [] } }));
  assert.equal(run().status, 'needs-replacement');
});

test('official White House photos bind the federal grant, named staff credit, official source and exact original', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-whitehouse-rights-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('native photograph'),
    hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex'),
    rightsPath = 'content/worldgen/source/places/dq/dqc/residence/reference-rights/native.json',
    file = path.join(root, rightsPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body =
      '{{Information\n|Source=[https://www.flickr.com/photos/whitehouse/123/ Official]\n|Description=(Official White House Photo by Named Photographer)\n}}\n{{PD-USGov-POTUS}}',
    page = {
      title: 'File:Residence.jpg',
      revisions: [{ revid: 123, slots: { main: { '*': body } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Residence.jpg',
          sha1: hash(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: 'The White House from Washington, DC' },
            LicenseShortName: { value: 'Public domain' },
            Copyrighted: { value: 'False' },
            AttributionRequired: { value: 'false' },
          },
        },
      ],
    },
    reference = {
      path: '_m/a/b/c/d/story/front.jpg',
      sha256: hash(bytes),
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Residence.jpg',
      artist: 'The White House from Washington, DC',
      license: 'Public domain',
      publicDomainEvidence: {
        kind: 'commons-native-whitehouse-photo',
        path: rightsPath,
        photographer: 'Named Photographer',
      },
    };
  const check = (change, ref = reference) => {
    const p = structuredClone(page);
    change?.(p);
    const record = {
        source:
          'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3AResidence.jpg',
        query: { pages: { 1: p } },
      },
      text = JSON.stringify(record);
    fs.writeFileSync(file, text);
    return inspectQuallaPrimaryRights(
      { ...ref, publicDomainEvidence: { ...ref.publicDomainEvidence, sha256: hash(text) } },
      bytes,
      root,
    ).eligible;
  };
  assert.equal(check(), true);
  for (const [from, to] of [
    ['PD-USGov-POTUS', 'PD-user'],
    ['Official White House Photo by Named Photographer', 'Courtesy of a private photographer'],
    ['/photos/whitehouse/', '/photos/privateagency/'],
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
      p.imageinfo[0].extmetadata.Copyrighted.value = 'True';
    }),
    false,
  );
  assert.equal(
    check((p) => {
      p.imageinfo[0].extmetadata.Restrictions = { value: 'Special permission required' };
    }),
    false,
  );
  assert.equal(
    check(undefined, {
      ...reference,
      publicDomainEvidence: { ...reference.publicDomainEvidence, photographer: 'Someone Else' },
    }),
    false,
  );
});

test('a native self-photographed release requires the exact named author, PD-self grant and original', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-self-photographed-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('native bridge photograph'),
    hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex'),
    rightsPath = 'content/worldgen/source/places/rc/rck/bridge/reference-rights/native.json',
    file = path.join(root, rightsPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body =
      '{{Information\n|Source={{self-photographed}}\n|Author=[[User:BridgePhotographer|BridgePhotographer]]\n}}\n{{PD-self}}',
    page = {
      title: 'File:Bridge.jpg',
      revisions: [{ revid: 123, slots: { main: { '*': body } } }],
      imageinfo: [
        {
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Bridge.jpg',
          sha1: hash(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: 'BridgePhotographer' },
            LicenseShortName: { value: 'Public domain' },
            Copyrighted: { value: 'False' },
            AttributionRequired: { value: 'false' },
          },
        },
      ],
    },
    reference = {
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bridge.jpg',
      artist: 'BridgePhotographer',
      license: 'Public domain',
      publicDomainEvidence: {
        kind: 'commons-native-self-released-photo',
        path: rightsPath,
        photographer: 'BridgePhotographer',
      },
    };
  const check = (change) => {
    const p = structuredClone(page);
    change?.(p);
    const text = JSON.stringify({
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3ABridge.jpg',
      query: { pages: { 1: p } },
    });
    fs.writeFileSync(file, text);
    return inspectQuallaPrimaryRights(
      {
        ...reference,
        publicDomainEvidence: { ...reference.publicDomainEvidence, sha256: hash(text) },
      },
      bytes,
      root,
    ).eligible;
  };
  assert.equal(check(), true);
  for (const [from, to] of [
    ['[[User:BridgePhotographer|BridgePhotographer]]', '[[User:SomeoneElse|SomeoneElse]]'],
    ['{{self-photographed}}', 'Courtesy of another photographer'],
    ['{{PD-self}}', '{{CC-by-sa-4.0}}'],
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
      p.imageinfo[0].extmetadata.Copyrighted.value = 'True';
    }),
    false,
  );
  assert.equal(
    check((p) => {
      p.imageinfo[0].extmetadata.Restrictions = { value: 'permission required' };
    }),
    false,
  );
});
