import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectImageryPolicy } from './imagery-policy.mjs';

test('QSA Crown plans bind exact archival items, native grants, originals and Qualla publication', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-qsa-plans-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (p, v) => {
      const f = path.join(root, p);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, v);
    },
    sha = (v, algo = 'sha256') => createHash(algo).update(v).digest('hex'),
    bytes = Buffer.from('exact Crown architectural drawing'),
    rightsPath = 'content/worldgen/source/places/r7/r7h/house/reference-rights/native.json',
    story = { id: 'house', sourcePath: '_c/art/r/7/h/g/house.json' };
  for (const [floor, item, date] of [
    ['Ground', '35295240095', '{{circa|1940}}'],
    ['First', '35254984396', '2012-04-15 00:55:02'],
  ]) {
    const title = `${floor} Floor Plan of Government House, Brisbane, c 1940`,
      image = {
        path: '_m/r/7/h/g/house/plan.jpg',
        sourceUrl: `https://commons.wikimedia.org/wiki/File:${title.replaceAll(' ', '_')}.jpg`,
        artist: 'Unknown author',
        license: 'Public domain',
      },
      body = `{{Information\n|description={{en|1=${title}}}\n|date=${date}\n|source=[https://www.flickr.com/photos/queenslandstatearchives/${item} ${title}] published by Queensland State Archives\n|author={{unknown|author}}\n}}\n{{PD-AustraliaGov}}\n{{PDreview|1=Reviewer|2=2020-02-16|3=}}`,
      page = {
        title: `File:${title}.jpg`,
        revisions: [{ revid: 42, slots: { main: { '*': body } } }],
        imageinfo: [
          {
            url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Plan.jpg',
            sha1: sha(bytes, 'sha1'),
            extmetadata: {
              Artist: { value: 'Unknown author' },
              LicenseShortName: { value: 'Public domain' },
              Copyrighted: { value: 'False' },
              AttributionRequired: { value: 'false' },
            },
          },
        ],
      },
      record = {
        source: `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'imageinfo|revisions', titles: page.title })}`,
        query: { pages: { 1: page } },
      },
      reference = {
        ...image,
        sha256: sha(bytes),
        publicDomainEvidence: {
          kind: 'commons-native-qsa-government-plan',
          path: rightsPath,
          archive: 'queensland-state-archives',
          archiveItem: item,
          creationYear: 1940,
        },
      },
      save = () => {
        const s = JSON.stringify(record);
        put(rightsPath, s);
        reference.publicDomainEvidence.sha256 = sha(s);
      },
      run = () =>
        inspectImageryPolicy({
          qualla: root,
          rightsRoot: root,
          references: [reference],
          stories: [story],
        });
    put(image.path, bytes);
    put(story.sourcePath, JSON.stringify({ media: { images: [image] } }));
    put(
      '_m/r/7/h/g/house/metadata.json',
      JSON.stringify({ gallery: [image], galleryPaths: [image.path] }),
    );
    save();
    assert.equal(run().status, 'passed');
    for (const changed of [
      body.replace('{{PD-AustraliaGov}}', '{{PD-Australia}}'),
      body.replace(item, '12345'),
      body.replace('published by Queensland State Archives', 'from a private collection'),
      body.replace(date, '2020-01-01'),
      `${body}\n{{CC-by-4.0}}`,
    ]) {
      page.revisions[0].slots.main['*'] = changed;
      save();
      assert.equal(run().status, 'needs-replacement');
    }
    page.revisions[0].slots.main['*'] = body;
    reference.publicDomainEvidence.creationYear = 1980;
    save();
    assert.equal(run().status, 'needs-replacement');
    reference.publicDomainEvidence.creationYear = 1940;
    page.imageinfo[0].sha1 = sha('other drawing', 'sha1');
    save();
    assert.equal(run().status, 'needs-replacement');
    page.imageinfo[0].sha1 = sha(bytes, 'sha1');
    save();
    put(rightsPath, 'changed snapshot');
    assert.equal(run().status, 'needs-replacement');
    save();
    put(story.sourcePath, JSON.stringify({ media: { images: [] } }));
    assert.equal(run().status, 'needs-replacement');
    put(story.sourcePath, JSON.stringify({ media: { images: [image] } }));
    put(
      '_m/r/7/h/g/house/metadata.json',
      JSON.stringify({ gallery: [{ ...image, license: 'CC BY 4.0' }], galleryPaths: [image.path] }),
    );
    assert.equal(run().status, 'needs-replacement');
  }
});
