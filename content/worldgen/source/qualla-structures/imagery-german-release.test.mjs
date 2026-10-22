import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectCommonsSelfReference } from './imagery-inventory.mjs';

const hash = (b) => createHash('sha256').update(b).digest('hex');
for (const form of ['credit', 'template'])
  test(`German photographer ${form} release requires the named original grant, upload and native bytes`, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-german-proof-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'photo.jpg'), 'original pixels');
    const credit = form === 'credit',
      username = credit ? 'OriginalUser' : 'OtherUser',
      realName = credit ? 'Named Photographer' : username,
      dedication = {
        kind: credit
          ? 'german-wikipedia-original-own-photograph'
          : 'german-wikipedia-original-own-template',
        wiki: 'de',
        project: 'German Wikipedia',
        username,
        realName,
        profileUrl: `https://de.wikipedia.org/wiki/${credit ? 'User' : 'Benutzer'}:${username}`,
        originalFileUrl: `https://de.wikipedia.org/wiki/${credit ? 'Image' : 'File'}:Original.jpg`,
        originalUpload: {
          timestamp: credit ? '18:00, 25. Mär 2006' : '2010-10-17 18:33',
          width: 20,
          height: 10,
          bytes: 15,
          photographedDateText: credit ? '03/2006' : '19.01.2009',
        },
      },
      ref = {
        origin: 'commons-author-public-domain',
        path: 'photo.jpg',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
        downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
        artist: credit ? `${realName} (${realName})` : username,
        license: 'Public domain',
        sha256: hash('original pixels'),
        creatorDedication: dedication,
      },
      body = credit
        ? `|Author= ${realName} ([[:de:User:${username}|${realName}]])\n|Permission={{PD-user-de|${username}}}\n|Source= [[:de:Image:Original.jpg|de.wikipedia.org]] <nowiki>18:00, 25. Mär 2006 . . ${username} (Diskussion) . . 20 x 10 (15 Byte) (* Place * eigene Aufnahme * ${realName} (${username}) * 03/2006)</nowiki>`
        : `|Source={{own}}\n|Author=[[:de:Benutzer:${username}|${username}]]\n{{PD-release}}\n{{original description page|de.wikipedia|Original.jpg}}\n* 2010-10-17 18:33 [[:de:User:${username}|${username}]] 20×10× (15 bytes) <nowiki>{{Information |Quelle = selbst fotografiert |Urheber = ~~~ |Datum = 19.01.2009 |Genehmigung = }}</nowiki>`,
      meta = {
        LicenseShortName: { value: 'Public domain' },
        AttributionRequired: { value: 'false' },
        Copyrighted: { value: 'False' },
        Artist: {
          value: `<a href="${dedication.profileUrl}">${credit ? realName : username}</a>${credit ? ` (${realName})` : ''}`,
        },
        Credit: {
          value: credit
            ? `Transferred <a href="${dedication.originalFileUrl}">original</a>`
            : 'Own work',
        },
        Permission: {
          value: credit
            ? `This work has been released into the public domain by its author. ${username} grants anyone the right to use this work for any purpose.`
            : 'Released into the public domain (by the author).',
        },
      },
      page = {
        title: 'File:Photo.jpg',
        revisions: [{ revid: 123, slots: { main: { '*': body } } }],
        imageinfo: [
          {
            url: ref.downloadUrl,
            width: 20,
            height: 10,
            size: 15,
            sha1: createHash('sha1').update('original pixels').digest('hex'),
            extmetadata: meta,
          },
        ],
      },
      inspect = () => {
        const bytes = JSON.stringify({ query: { pages: { 1: page } } });
        fs.writeFileSync(path.join(dir, 'rights.json'), bytes);
        ref.rightsEvidence = { path: 'rights.json', sha256: hash(bytes) };
        return inspectCommonsSelfReference(dir, ref).eligible;
      };
    assert.equal(inspect(), true);
    for (const [from, to] of credit
      ? [
          [`PD-user-de|${username}`, 'PD-user-de|SomeoneElse'],
          ['Original.jpg', 'Unrelated.jpg'],
          ['20 x 10 (15 Byte)', '20 x 10 (16 Byte)'],
          [`eigene Aufnahme * ${realName}`, 'eigene Aufnahme * Someone Else'],
          ['03/2006', '04/2006'],
        ]
      : [
          ['PD-release', 'PD-user'],
          ['Original.jpg', 'Unrelated.jpg'],
          ['20×10× (15 bytes)', '20×10× (16 bytes)'],
          ['selbst fotografiert', 'found online'],
          ['Urheber = ~~~', 'Urheber = Unknown'],
          ['19.01.2009', '20.01.2009'],
        ]) {
      page.revisions[0].slots.main['*'] = body.replace(from, to);
      assert.equal(inspect(), false, from);
    }
    page.revisions[0].slots.main['*'] = `${body}\n{{cc-by-sa-4.0}}`;
    assert.equal(inspect(), false);
    page.revisions[0].slots.main['*'] = body;
    const permission = meta.Permission;
    delete meta.Permission;
    assert.equal(inspect(), false);
    meta.Permission = permission;
    ref.creatorDedication.username = 'OtherCreator';
    assert.equal(inspect(), false);
    ref.creatorDedication.username = username;
    const old = meta.Artist.value;
    meta.Artist.value = old.replace('https://de.wikipedia.org', 'https://example.org');
    assert.equal(inspect(), false);
    meta.Artist.value = old;
    page.imageinfo[0].size = 16;
    assert.equal(inspect(), false);
    page.imageinfo[0].size = 15;
    meta.Restrictions = { value: 'Permission required' };
    assert.equal(inspect(), false);
    delete meta.Restrictions;
    fs.writeFileSync(path.join(dir, 'photo.jpg'), 'different bytes');
    ref.sha256 = hash('different bytes');
    assert.equal(inspect(), false);
  });
