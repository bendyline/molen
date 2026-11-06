import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectQuallaPrimaryRights } from './imagery-primary-rights.mjs';

test('Japanese uploader-self release requires the original named upload and explicit same-time grant', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-japanese-self-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('original personally photographed terrace'),
    sha = (b, a = 'sha256') => createHash(a).update(b).digest('hex'),
    rights = 'content/worldgen/source/places/xn/xn0/terrace/reference-rights/native.json',
    p = path.join(root, rights);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const page = {
      title: 'File:Terrace.jpg',
      revisions: [
        {
          revid: 12,
          parentid: 0,
          user: 'Photographer',
          timestamp: '2009-10-15T00:20:40Z',
          slots: {
            main: { '*': '{{Information\n|Source=投稿者本人\n|Author=投稿者本人\n}}\n{{PD-self}}' },
          },
        },
      ],
      imageinfo: [
        {
          user: 'Photographer',
          timestamp: '2009-10-15T00:20:40Z',
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Terrace.jpg',
          size: bytes.length,
          sha1: sha(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: '投稿者本人' },
            Credit: { value: '投稿者本人' },
            LicenseShortName: { value: 'Public domain' },
            Copyrighted: { value: 'False' },
            AttributionRequired: { value: 'false' },
            Restrictions: { value: '' },
          },
        },
      ],
    },
    record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3ATerrace.jpg',
      query: { pages: { 1: page } },
    },
    reference = {
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Terrace.jpg',
      artist: '投稿者本人',
      license: 'Public domain',
      publicDomainEvidence: {
        kind: 'commons-native-self-released-photo',
        path: rights,
        photographer: '投稿者本人',
        nativeCreatorRelease: {
          kind: 'contemporaneous-japanese-uploader-self-release',
          username: 'Photographer',
          revision: 12,
        },
      },
    };
  const check = (rec = record, ref = structuredClone(reference)) => {
    const data = JSON.stringify(rec);
    fs.writeFileSync(p, data);
    ref.publicDomainEvidence.sha256 = sha(data);
    return inspectQuallaPrimaryRights(ref, bytes, root);
  };
  assert.equal(check().eligible, true);
  const mutations = [
    (r) => (r.query.pages[1].revisions[0].parentid = 11),
    (r) => (r.query.pages[1].revisions[0].user = 'Other'),
    (r) => (r.query.pages[1].imageinfo[0].user = 'Other'),
    (r) => (r.query.pages[1].imageinfo[0].timestamp = '2009-10-14T00:00:00Z'),
    (r) =>
      (r.query.pages[1].revisions[0].slots.main['*'] = r.query.pages[1].revisions[0].slots.main[
        '*'
      ].replace('Source=投稿者本人', 'Source=Another photographer')),
    (r) =>
      (r.query.pages[1].revisions[0].slots.main['*'] = r.query.pages[1].revisions[0].slots.main[
        '*'
      ].replace('{{PD-self}}', '{{PD-old}}')),
    (r) => r.query.pages[1].imageinfo.push({ ...r.query.pages[1].imageinfo[0] }),
    (r) => (r.query.pages[1].imageinfo[0].sha1 = '0'.repeat(40)),
    (r) => (r.query.pages[1].imageinfo[0].extmetadata.Restrictions.value = 'permission required'),
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(record);
    mutate(changed);
    assert.equal(check(changed).eligible, false);
  }
  const changed = structuredClone(reference);
  changed.publicDomainEvidence.nativeCreatorRelease.revision = 13;
  assert.equal(check(record, changed).eligible, false);
});

test('Japanese signed photographs bind the first self-release, native alias and original upload', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-japanese-signed-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('original signed earthwork photograph'),
    sha = (b, a = 'sha256') => createHash(a).update(b).digest('hex'),
    rights = 'content/worldgen/source/places/xn/xn0/terrace/reference-rights/native.json',
    p = path.join(root, rights);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const signature =
      '[[User:撮影者|撮影者]] ([[User talk:撮影者|talk]]) 12:17, 3 February 2010 (UTC)',
    body = `{{Information\n|Source=${signature}\n|Author=投稿者が撮影\n}}\n{{PD-self}}`,
    page = {
      title: 'File:Terrace.jpg',
      revisions: [
        {
          revid: 12,
          parentid: 0,
          user: '撮影者~commonswiki',
          timestamp: '2010-02-03T12:17:58Z',
          slots: { main: { '*': body } },
        },
      ],
      imageinfo: [
        {
          user: '撮影者~commonswiki',
          timestamp: '2010-02-03T12:17:58Z',
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Terrace.jpg',
          size: bytes.length,
          sha1: sha(bytes, 'sha1'),
          extmetadata: {
            Artist: { value: '投稿者が撮影' },
            Credit: { value: '撮影者 (talk) 12:17, 3 February 2010 (UTC)' },
            LicenseShortName: { value: 'Public domain' },
            Copyrighted: { value: 'False' },
            AttributionRequired: { value: 'false' },
            Restrictions: { value: '' },
          },
        },
      ],
    },
    record = {
      source:
        'https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo%7Crevisions&titles=File%3ATerrace.jpg',
      query: { pages: { 1: page } },
    },
    reference = {
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Terrace.jpg',
      artist: '投稿者が撮影',
      license: 'Public domain',
      publicDomainEvidence: {
        kind: 'commons-native-self-released-photo',
        path: rights,
        photographer: '投稿者が撮影',
        nativeCreatorRelease: {
          kind: 'contemporaneous-japanese-signed-photographer-release',
          username: '撮影者~commonswiki',
          signatureUsername: '撮影者',
          revision: 12,
        },
      },
    };
  const check = (rec = record, ref = structuredClone(reference)) => {
    const data = JSON.stringify(rec);
    fs.writeFileSync(p, data);
    ref.publicDomainEvidence.sha256 = sha(data);
    return inspectQuallaPrimaryRights(ref, bytes, root);
  };
  assert.equal(check().eligible, true);
  const mutations = [
    (r) => (r.query.pages[1].revisions[0].parentid = 11),
    (r) => (r.query.pages[1].revisions[0].user = 'Other'),
    (r) => (r.query.pages[1].imageinfo[0].user = 'Other'),
    (r) => (r.query.pages[1].imageinfo[0].timestamp = '2010-02-02T12:17:58Z'),
    (r) =>
      (r.query.pages[1].revisions[0].slots.main['*'] = body.replaceAll('User:撮影者', 'User:別人')),
    (r) => (r.query.pages[1].revisions[0].slots.main['*'] = body.replace('12:17', '12:18')),
    (r) =>
      (r.query.pages[1].revisions[0].slots.main['*'] = body.replace('{{PD-self}}', '{{PD-old}}')),
    (r) => r.query.pages[1].imageinfo.push({ ...r.query.pages[1].imageinfo[0] }),
    (r) => (r.query.pages[1].imageinfo[0].sha1 = '0'.repeat(40)),
    (r) => (r.query.pages[1].imageinfo[0].extmetadata.Restrictions.value = 'permission required'),
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(record);
    mutate(changed);
    assert.equal(check(changed).eligible, false);
  }
  const changed = structuredClone(reference);
  changed.publicDomainEvidence.nativeCreatorRelease.signatureUsername = '別人';
  assert.equal(check(record, changed).eligible, false);
});
