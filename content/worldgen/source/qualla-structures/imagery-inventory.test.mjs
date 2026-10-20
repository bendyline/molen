import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  inspectAbdulHamidReference,
  inspectCaliforniaPostcardReference,
  inspectCommonsSelfReference,
  inspectCommonsWpaReference,
  inspectCreatorCc0Reference,
  inspectDvidsReference,
  inspectExpiredPostcardReference,
  inspectFlickrCc0Reference,
  inspectGutenbergReference,
  inspectHabsReference,
  inspectHighsmithReference,
  inspectHistoricalNavyReference,
  inspectImageryInventory,
  inspectNationaalArchiefReference,
  inspectNpsHistoricalReference,
  inspectNpsReference,
  inspectTaiwanCultureReference,
  inspectWienMuseumReference,
} from './imagery-inventory.mjs';
import {
  PUBLIC_DOMAIN_POLICY,
  publicDomainReviewMatches,
  verifiedSupplementalSelection,
} from './imagery-policy.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

test('archived Navy originals need the individual federal credit, record and exact linked rendition', (t) => {
  const f = fixture(t),
    sourceUrl =
      'https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/events/wwii-pac/pearlhbr/ph-frd.htm',
    downloadUrl = 'https://www.ibiblio.org/hyperwar/OnlineLibrary/photos/images/g30000/g32480.jpg',
    credit = 'Official U.S. Navy Photograph, now in the collections of the National Archives.',
    reference = {
      ...f.reference,
      origin: 'nhhc-official-navy-public-domain',
      sourceUrl,
      downloadUrl,
      catalogNumber: '80-G-32480',
      artist: 'U.S. Navy',
      originalReview: {
        status: 'inspected',
        rendition: 'published-nhhc-archive-jpeg',
        primaryCredit: credit,
      },
    },
    html = `<table><tr><td>Photo #: 80-G-32480 ${credit}</td><td><a href="../../../images/g30000/g32480.jpg">Image</a></td></tr></table><p>The pictures referenced here are all in the Public Domain</p>`,
    check = (s = html, r = reference) => {
      fs.writeFileSync(path.join(f.dir, 'source.html'), s);
      return inspectHistoricalNavyReference(f.dir, {
        ...r,
        rightsEvidence: { path: 'source.html', sourceUrl: r.sourceUrl, sha256: hash(s) },
      }).eligible;
    };
  assert.equal(check(), true);
  for (const s of [
    html.replace(credit, 'Courtesy of a private photographer.'),
    html.replace('80-G-32480', '80-G-32481'),
    html.replace('g32480.jpg', 'g32481.jpg'),
    html.replace('Public Domain', 'Copyright protected'),
  ])
    assert.equal(check(s), false);
  assert.equal(check(html, { ...reference, artist: 'Private photographer' }), false);
  fs.writeFileSync(path.join(f.dir, reference.path), 'changed image');
  assert.equal(check(), false);
});

test('Navy DVIDS releases bind the enlisted staff credit, naval VIRIN and offered public rendition', (t) => {
  const f = fixture(t),
    sourceUrl =
      'https://www.dvidshub.net/image/2127423/biggest-little-airshow-pacific-aviation-museum',
    downloadUrl = 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1508/2127423/2000w_q95.jpg',
    reference = {
      ...f.reference,
      origin: 'dvids-usnavy-public-domain',
      sourceUrl,
      downloadUrl,
      artist: 'Seaman Michael Ray',
      width: 2000,
      originalReview: { rendition: 'published-jpeg-rendition' },
    },
    html = `<meta property="og:url" content="${sourceUrl}"><meta name="twitter:image" content="${downloadUrl}"><meta property="og:description" content="Airshow. (U.S. Navy photo by Seaman Michael Ray/Released)"><td>Photo ID:</td><td>2127423</td><td>VIRIN:</td><td>150815-N-ZQ784-040</td><h4 class="public-domain">PUBLIC DOMAIN</h4>`,
    check = (s = html, r = reference) => {
      fs.writeFileSync(path.join(f.dir, 'source.html'), s);
      return inspectDvidsReference(f.dir, {
        ...r,
        rightsEvidence: { path: 'source.html', sha256: hash(s) },
      }).eligible;
    };
  assert.equal(check(), true);
  for (const s of [
    html.replace('Seaman Michael Ray', 'Private contributor'),
    html.replace('-N-ZQ784-', '-G-ZQ784-'),
    html.replace('/Released)', ')'),
    html.replace('PUBLIC DOMAIN', 'COPYRIGHT'),
    html.replace('Airshow.', 'Photo courtesy of the museum.'),
  ])
    assert.equal(check(s), false);
  assert.equal(check(html, { ...reference, artist: 'Another photographer' }), false);
  assert.equal(check(html, { ...reference, origin: 'dvids-uscg-public-domain' }), false);
  fs.writeFileSync(path.join(f.dir, reference.path), 'changed pixels');
  assert.equal(check(), false);
});

test('published California postcard needs the exact dated library record, imprint and inspected period scan', (t) => {
  const f = fixture(t),
    sourceUrl =
      'https://dbs.library.ca.gov/dbtw-wpd/exec/dbtwpub.dll?QY=find%20(NO%20ct%20(102548))&TN=CALINFO',
    downloadUrl = 'https://dbs.library.ca.gov/CalInfoImages/CIFII_Scan877.jpg',
    reference = {
      ...f.reference,
      origin: 'california-library-expired-postcard',
      sourceUrl,
      downloadUrl,
      catalogNumber: '102548',
      title: 'Winchester Place, San Jose, California',
      artist: 'E. P. Charlton & Co.',
      originalReview: {
        status: 'inspected',
        rendition: 'faithful-published-postcard-scan',
        publicationYear: 1908,
        postmarkYear: 1908,
        usMaximumExpiryYear: 2003,
        publisherImprintInspected: true,
        modernAlteration: false,
      },
    },
    html = `System Number: <b>102548</b><b>Title:</b></font><br /><font>Winchester Place, San Jose, California</font><b>Published:</b></font><br /><font>N.L. : E. P. Charlton &amp; Co. , c1908. (1 photomechanical print (postcard): ill., col.)</font><img src="${downloadUrl}">`,
    check = (s = html, r = reference) => {
      fs.writeFileSync(path.join(f.dir, 'source.html'), s);
      return inspectCaliforniaPostcardReference(f.dir, {
        ...r,
        rightsEvidence: { path: 'source.html', sourceUrl: r.sourceUrl, sha256: hash(s) },
      }).eligible;
    };
  assert.equal(check(), true);
  for (const s of [
    html.replace('Published:', 'Created:'),
    html.replace('c1908.', 'c1948.'),
    html.replace('Charlton', 'Another publisher'),
    html.replace('Scan877', 'Scan878'),
    html.replace('<b>102548</b>', '<b>102549</b>'),
  ])
    assert.equal(check(s), false);
  for (const originalReview of [
    { ...reference.originalReview, modernAlteration: true },
    { ...reference.originalReview, postmarkYear: null },
    { ...reference.originalReview, usMaximumExpiryYear: 2000 },
    { ...reference.originalReview, publicationYear: 1948 },
  ])
    assert.equal(check(html, { ...reference, originalReview }), false);
  assert.equal(
    check(html, { ...reference, sourceUrl: sourceUrl.replace('102548', '102549') }),
    false,
  );
  fs.writeFileSync(path.join(f.dir, reference.path), 'different pixels');
  assert.equal(check(), false);
});

test('Taiwan cultural CC0 binds the digital object, creator and exact image, not description rights', (t) => {
  const f = fixture(t),
    sourceUrl = 'https://tcmb.culture.tw/zh-tw/detail?id=292378&indexCode=Culture_Object',
    downloadUrl =
      'https://dcm.s3.hicloud.net.tw/new/excel/object/2020-05-13/a03b8723-05e3-4965-8ef8-4bbc0b108844/collection/54d06a31-9b24-444c-a776-a711fcf90bb9/108542a5-b9fc-466b-b998-65b76c1a28e5.jpg',
    reference = {
      ...f.reference,
      origin: 'taiwan-culture-object-cc0',
      license: 'CC0',
      sourceUrl,
      downloadUrl,
      title: '臺北孔子廟',
      artist: '吳宇凡',
      catalogInstitution: '國立臺北科技大學文化事業發展學系',
      originalReview: {
        status: 'inspected',
        rendition: 'published-cc0-digital-object',
        photographicContent: true,
        includesThirdPartyArtwork: false,
      },
    },
    html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'CreativeWork', identifier: 'Culture_Object-292378', url: sourceUrl.replace('https:', 'http:'), name: reference.title })}</script><a href="${downloadUrl}"><img src="${downloadUrl}" alt="臺北孔子廟"></a><a title="數位物件授權：公眾領域貢獻宣告(CC0)[另開新視窗]">CC0</a><textarea aria-label="數位物件授權引用資訊">臺北孔子廟 / 創作者：吳宇凡 / 數位物件授權：CC0 / 建檔單位：國立臺北科技大學文化事業發展學系 @ 國家文化記憶庫 http://tcmb.culture.tw/zh-tw/detail?indexCode=Culture_Object&amp;id=292378</textarea>`,
    check = (value = html, r = reference) => {
      fs.writeFileSync(path.join(f.dir, 'source.html'), value);
      return inspectTaiwanCultureReference(f.dir, {
        ...r,
        rightsEvidence: { path: 'source.html', sourceUrl, sha256: hash(value) },
      }).eligible;
    };
  assert.equal(check(), true);
  for (const value of [
    html.replace('數位物件授權：CC0', '數位物件授權：CC BY 4.0'),
    html.replace('數位物件授權引用資訊', '描述文字授權引用資訊'),
    html.replace('創作者：吳宇凡', '創作者：Unknown'),
    html.replace('Culture_Object-292378', 'Culture_Object-123456'),
    html.replace(
      'title="數位物件授權：公眾領域貢獻宣告(CC0)',
      'title="描述文字授權：公眾領域貢獻宣告(CC0)',
    ),
    html.replace(`src="${downloadUrl}"`, 'src="https://example.com/other.jpg"'),
  ])
    assert.equal(check(value), false);
  assert.equal(check(html, { ...reference, artist: 'Another creator' }), false);
  assert.equal(
    check(html, {
      ...reference,
      originalReview: { ...reference.originalReview, includesThirdPartyArtwork: true },
    }),
    false,
  );
  fs.writeFileSync(path.join(f.dir, reference.path), 'changed pixels');
  assert.equal(check(), false);
});

test('Gutenberg illustration proof requires the book-specific PD status, old creator and exact linked image', (t) => {
  const f = fixture(t),
    sourceUrl = 'https://www.gutenberg.org/files/60759/60759-h/60759-h.htm',
    catalog =
      '<a itemprop="creator">Richardson, C. J. (Charles James), 1806-1871</a><td property="dcterms:rights">Public domain in the USA.</td>',
    book =
      'PROJECT GUTENBERG EBOOK 60759 <a href="images/ill_pg_476_lg.jpg">Perspective view of exterior.</a>',
    reference = {
      ...f.reference,
      origin: 'gutenberg-original-public-domain-illustration',
      artist: 'C. J. Richardson',
      sourceUrl,
      downloadUrl: 'https://www.gutenberg.org/files/60759/60759-h/images/ill_pg_476_lg.jpg',
      rightsEvidence: { path: 'source.html', sourceUrl: 'https://www.gutenberg.org/ebooks/60759' },
      bookEvidence: { path: 'book.html', sourceUrl },
      originalReview: {
        status: 'inspected',
        rendition: 'published-book-illustration',
        catalogCreator: 'Richardson, C. J. (Charles James), 1806-1871',
        creatorDeathYear: 1871,
        creatorNameParts: ['Richardson', 'C. J.'],
        illustrationIsOriginalBookContent: true,
        modernAlteration: false,
      },
    },
    check = (c = catalog, b = book, r = reference) => {
      fs.writeFileSync(path.join(f.dir, 'source.html'), c);
      fs.writeFileSync(path.join(f.dir, 'book.html'), b);
      return inspectGutenbergReference(f.dir, {
        ...r,
        rightsEvidence: { ...r.rightsEvidence, sha256: hash(c) },
        bookEvidence: { ...r.bookEvidence, sha256: hash(b) },
      }).eligible;
    };
  assert.equal(check(), true);
  assert.equal(
    check(catalog.replace('Public domain in the USA.', 'Copyright. Used by permission.')),
    false,
  );
  assert.equal(check(catalog.replace('Richardson', 'Another author')), false);
  assert.equal(check(catalog.replace('1806-1871', '1906-1971')), false);
  assert.equal(check(catalog, book.replace('476_lg', '477_lg')), false);
  assert.equal(check(catalog, book.replace('60759', '12345')), false);
  assert.equal(
    check(catalog, book, {
      ...reference,
      downloadUrl: reference.downloadUrl.replace('476_lg', '476_sml'),
    }),
    false,
  );
  assert.equal(
    check(catalog, book, {
      ...reference,
      originalReview: { ...reference.originalReview, modernAlteration: true },
    }),
    false,
  );
  fs.writeFileSync(path.join(f.dir, reference.path), 'different pixels');
  assert.equal(check(), false);
});

test('expired postcards bind the dated original, exact reproduction and country-specific term', (t) => {
  const f = fixture(t),
    sourceUrl = 'https://archive.example/periodical.pdf',
    reference = {
      ...f.reference,
      origin: 'expired-south-african-photographic-postcard',
      sourceUrl,
      artist: 'Walsh Photo.',
      width: 1318,
      height: 852,
      rightsEvidence: { path: 'source.html', sourceUrl },
      originalReview: {
        status: 'inspected',
        rendition: 'published-historical-reproduction',
        publicationNoLaterThan: 1911,
      },
    },
    proof = {
      format: 'molen/historical-postcard-rights@1',
      originalType: 'photographic-postcard',
      country: 'ZA',
      publicationNoLaterThan: 1911,
      photographerImprint: 'Walsh Photo.',
      datingExcerpt:
        'An imprint reads Walsh Photo. The card was postally used (to a lightkeeper) in 1911.',
      sourceUrl,
      sourceCountryTerm: 'photographs-50-years-publication',
      sourceCountryExpiryYear: 1961,
      usExpiryYear: 2006,
      reproduction: {
        kind: 'faithful-grayscale-print-crop',
        pageImageSha256: 'a'.repeat(64),
        imageSha256: reference.sha256,
        bounds: [1707, 2286, 3025, 3138],
        modernImageAlteration: false,
        includesModernArticle: false,
      },
    },
    check = (p = proof, r = reference) => {
      const bytes = JSON.stringify(p);
      fs.writeFileSync(path.join(f.dir, r.rightsEvidence.path), bytes);
      return inspectExpiredPostcardReference(f.dir, {
        ...r,
        rightsEvidence: { ...r.rightsEvidence, sha256: hash(bytes) },
      }).eligible;
    };
  assert.equal(check(), true);
  for (const change of [
    (p) => {
      p.publicationNoLaterThan = 1987;
    },
    (p) => {
      p.datingExcerpt = 'An undated postcard by Walsh Photo.';
    },
    (p) => {
      p.originalType = 'painting';
    },
    (p) => {
      p.country = 'GB';
    },
    (p) => {
      p.sourceCountryTerm = 'life-plus-70';
    },
    (p) => {
      p.photographerImprint = 'Someone else';
    },
    (p) => {
      p.reproduction.imageSha256 = 'b'.repeat(64);
    },
    (p) => {
      p.reproduction.includesModernArticle = true;
    },
    (p) => {
      p.reproduction.modernImageAlteration = true;
    },
    (p) => {
      p.reproduction.bounds[3] += 1;
    },
  ]) {
    const p = structuredClone(proof);
    change(p);
    assert.equal(check(p), false);
  }
  assert.equal(check(proof, { ...reference, width: 3307, height: 4677 }), false);
  assert.equal(
    check(proof, {
      ...reference,
      originalReview: { ...reference.originalReview, rendition: 'native-original' },
    }),
    false,
  );
  fs.writeFileSync(path.join(f.dir, reference.path), 'changed image');
  assert.equal(check(), false);
});

test('NYPL WPA evidence binds institutional authorship and the exact original or archived native', (t) => {
  const f = fixture(t),
    institutionUrl =
      'https://digitalcollections.nypl.org/items/510d47d9-4f29-a3d9-e040-e00a18064a99',
    downloadUrl =
      'https://upload.wikimedia.org/wikipedia/commons/archive/a/ab/20220611235807%21Hotel.jpg',
    nativeSha1 = createHash('sha1').update('original pixels').digest('hex'),
    reference = {
      ...f.reference,
      origin: 'commons-nypl-wpa-public-domain',
      artist: 'Berenice Abbott',
      institutionUrl,
      institutionImageId: '482725',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hotel.jpg',
      downloadUrl,
      width: 2991,
      height: 2217,
      originalReview: { revision: 17, nativeSha1 },
    },
    page = {
      title: 'File:Hotel.jpg',
      revisions: [
        {
          revid: 17,
          slots: {
            main: {
              '*': `{{Nypl\n|source=${institutionUrl}\n|author={{Creator:Berenice Abbott}}\n|date=1936-08-12\n|imageID=482725\n|collection=Changing New York\n}}\n{{PD-USGov-WPA}}`,
            },
          },
        },
      ],
      imageinfo: [
        {
          url: downloadUrl,
          size: 15,
          width: 2991,
          height: 2217,
          sha1: nativeSha1,
          extmetadata: {
            LicenseShortName: { value: 'Public domain' },
            AttributionRequired: { value: 'false' },
            Restrictions: { value: '' },
            Categories: { value: 'Images from the New York Public Library|PD US WPA' },
          },
        },
      ],
    },
    original = JSON.stringify({ query: { pages: { 1: page } } }),
    check = (value, r = reference) => {
      fs.writeFileSync(path.join(f.dir, r.rightsEvidence.path), value);
      return inspectCommonsWpaReference(f.dir, {
        ...r,
        rightsEvidence: { ...r.rightsEvidence, sha256: hash(value) },
      }).eligible;
    };
  assert.equal(check(original), true);
  for (const value of [
    original.replace('PD-USGov-WPA', 'PD-self'),
    original.replace('Creator:Berenice Abbott', 'Creator:Unknown'),
    original.replace('imageID=482725', 'imageID=12345'),
    original.replace('date=1936-08-12', 'date=1986-08-12'),
    original.replace(nativeSha1, '0'.repeat(40)),
    original.replace('"width":2991', '"width":2344'),
    original.replace(institutionUrl, institutionUrl.replace('510d47d9', '610d47d9')),
    original.replace('"value":""', '"value":"Restricted"'),
  ])
    assert.equal(check(value), false);
  assert.equal(
    check(original, { ...reference, downloadUrl: downloadUrl.replace('Hotel.jpg', 'Other.jpg') }),
    false,
  );
  assert.equal(check(original, { ...reference, artist: 'Transfer uploader' }), false);
  fs.writeFileSync(path.join(f.dir, reference.path), 'different pixels');
  assert.equal(check(original), false);
});

test('museum CC0 must bind the particular original, photographer, inventory and image-specific grant', (t) => {
  const f = fixture(t),
    sourceUrl = 'https://sammlung.wienmuseum.at/objekt/425250-birthplace/',
    downloadUrl = 'https://sammlung.wienmuseum.at/images/objects/425250/3243833_full.jpg',
    reference = {
      ...f.reference,
      origin: 'wien-museum-cc0',
      license: 'CC0',
      sourceUrl,
      downloadUrl,
      artist: 'Emil Koch',
      title: 'Birthplace',
      inventoryNumber: '58411/1',
      width: 3500,
      height: 4230,
    },
    html = `<meta property="og:url" content="${sourceUrl}"><figure data-copy-text="Emil Koch (Fotograf), Birthplace, um 1890, Wien Museum Inv.-Nr. 58411/1, CC0 (https://sammlung.wienmuseum.at/objekt/425250/)"><img data-src=${downloadUrl} data-width=3500 data-height=4230></figure><a href="https://creativecommons.org/publicdomain/zero/1.0/deed.de">CC0</a><p>Sie können diese Objektabbildung unter den Bedingungen von CC0 herunterladen und verwenden</p>`,
    check = (value) => {
      fs.writeFileSync(path.join(f.dir, reference.rightsEvidence.path), value);
      reference.rightsEvidence.sha256 = hash(value);
      reference.rightsEvidence.sourceUrl = sourceUrl;
      return inspectWienMuseumReference(f.dir, reference).eligible;
    };
  assert.equal(check(html), true);
  for (const value of [
    html.replace(', CC0 (', ', CC BY 4.0 ('),
    html.replace('Emil Koch', 'Unknown'),
    html.replace('58411/1', '58411/2'),
    html.replace(downloadUrl, downloadUrl.replace('3243833', '3243838')),
    html.replace('data-width=3500', 'data-width=992'),
    html.replace('Objektabbildung unter', 'Sammlung unter'),
    html.replace('425250-birthplace/', '425253-courtyard/'),
  ])
    assert.equal(check(value), false);
  assert.equal(check(html), true);
  reference.downloadUrl = downloadUrl.replace('425250', '425253');
  assert.equal(check(html), false);
  reference.downloadUrl = downloadUrl;
  fs.writeFileSync(path.join(f.dir, reference.path), 'different image');
  assert.equal(check(html), false);
});

test('an NPS historical postcard needs an image-specific dated public-domain caption and bound bytes', (t) => {
  const f = fixture(t),
    asset = '0E74924F-C392-D16D-59C26720FA07C05B',
    relative = `/common/uploads/place/nri/20180808/places/${asset}/${asset}.jpg`,
    caption = 'A 1909 postcard view of the New York Stock Exchange, New York City. Public domain.',
    html = `<meta property="og:url" content="https://www.nps.gov/places/new-york-stock-exchange.htm"><figure><img src="${relative}"><figcaption>${caption}<p class="figcredit"></p></figcaption></figure>`,
    reference = {
      ...f.reference,
      origin: 'nps-historical-public-domain',
      sourceUrl: 'https://www.nps.gov/places/new-york-stock-exchange.htm',
      downloadUrl: `https://www.nps.gov${relative}`,
      originalReview: { publicationYear: 1909, primaryCaption: caption },
    },
    check = (value) => {
      fs.writeFileSync(path.join(f.dir, reference.rightsEvidence.path), value);
      reference.rightsEvidence.sha256 = hash(value);
      return inspectNpsHistoricalReference(f.dir, reference).eligible;
    };
  assert.equal(check(html), true);
  for (const value of [
    html.replace('Public domain.', 'Permission required.'),
    html.replace('1909 postcard', '2025 photograph'),
    html.replace('<p class="figcredit"></p>', '<p class="figcredit">Private photographer</p>'),
    html.replace(relative, relative.replace(asset, 'DIFFERENT')),
    html.replace(`<figcaption>${caption}`, '<figcaption>Another image'),
  ])
    assert.equal(check(value), false);
  assert.equal(check(html), true);
  reference.originalReview.publicationYear = 1908;
  assert.equal(check(html), false);
  reference.originalReview.publicationYear = 1909;
  reference.sourceUrl = 'https://www.nps.gov/places/different-building.htm';
  assert.equal(check(html), false);
  reference.sourceUrl = 'https://example.test/places/new-york-stock-exchange.htm';
  assert.equal(check(html), false);
  reference.sourceUrl = 'https://www.nps.gov/places/new-york-stock-exchange.htm';
  fs.writeFileSync(path.join(f.dir, reference.path), 'different pixels');
  assert.equal(check(html), false);
});

test('DVIDS needs the explicit Coast Guard staff credit, public-domain grant and exact published rendition', (t) => {
  const f = fixture(t),
    sourceUrl = 'https://www.dvidshub.net/image/2347416/alcatraz-lighthouse',
    downloadUrl = 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1601/2347416/2000w_q95.jpg',
    html = `<meta property="og:url" content="${sourceUrl}"><meta name="twitter:image" content="${downloadUrl}">
<meta property="og:description" content="Alcatraz Lighthouse. (U.S. Coast Guard photo by Chief Petty Officer Robert Sevon)">
<td>Photo ID:</td><td>2347416</td><td>VIRIN:</td><td>151022-G-ZZ999-001</td>
<h4 class="public-domain">PUBLIC DOMAIN &nbsp;</h4>`,
    reference = {
      ...f.reference,
      origin: 'dvids-uscg-public-domain',
      sourceUrl,
      downloadUrl,
      artist: 'Chief Petty Officer Robert Sevon',
      width: 2000,
      originalReview: { rendition: 'published-jpeg-rendition' },
    },
    check = (value) => {
      fs.writeFileSync(path.join(f.dir, reference.rightsEvidence.path), value);
      reference.rightsEvidence.sha256 = hash(value);
      return inspectDvidsReference(f.dir, reference).eligible;
    };
  assert.equal(check(html), true);
  for (const value of [
    html.replace('PUBLIC DOMAIN', 'PERMISSION REQUIRED'),
    html.replace('Chief Petty Officer Robert Sevon', 'Private contractor'),
    html.replace('Coast Guard photo by', 'Courtesy photo by'),
    html.replace('<td>2347416</td>', '<td>2347419</td>'),
    html.replace('151022-G-ZZ999-001', '151022-A-ZZ999-001'),
    html
      .replace('name="twitter:image"', 'name="other"')
      .replace(downloadUrl, 'https://example.test/photo.jpg'),
  ])
    assert.equal(check(value), false);
  assert.equal(check(html), true);
  reference.originalReview.rendition = 'native-original';
  assert.equal(check(html), false);
  reference.originalReview.rendition = 'published-jpeg-rendition';
  reference.artist = 'Different photographer';
  assert.equal(check(html), false);
  reference.artist = 'Chief Petty Officer Robert Sevon';
  fs.writeFileSync(path.join(f.dir, reference.path), 'different pixels');
  assert.equal(check(html), false);
});

test('a DVIDS portfolio credit needs the exact Coast Guard unit, named staff byline and government photo identifier', (t) => {
  const f = fixture(t),
    sourceUrl = 'https://www.dvidshub.net/image/5154899/coast-guard-members-lay-wreaths',
    downloadUrl = 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1903/5154899/2000w_q95.jpg',
    credit = 'Petty Officer 1st Class Seth Johnson',
    html = `<meta property="og:url" content="${sourceUrl}"><meta name="twitter:image" content="${downloadUrl}">
<meta property="og:description" content="Memorial service at the Absecon Lighthouse. Photo by ${credit}">
<h3>Photo by <a href="/portfolio/1045320/seth-johnson">${credit}</a></h3>
<h3 class="the_unit"><a href="/unit/USCGEast">U.S. Coast Guard East</a></h3>
<td>Photo ID:</td><td>5154899</td><td>VIRIN:</td><td>190306-G-SQ620-0001</td>
<h4 class="public-domain">PUBLIC DOMAIN &nbsp;</h4>`,
    reference = {
      ...f.reference,
      origin: 'dvids-uscg-public-domain',
      sourceUrl,
      downloadUrl,
      artist: credit,
      width: 2000,
      originalReview: {
        rendition: 'published-jpeg-rendition',
        creditFormat: 'coast-guard-unit-and-staff-byline',
      },
    },
    check = (value) => {
      fs.writeFileSync(path.join(f.dir, reference.rightsEvidence.path), value);
      reference.rightsEvidence.sha256 = hash(value);
      return inspectDvidsReference(f.dir, reference).eligible;
    };
  assert.equal(check(html), true);
  for (const value of [
    html.replace('/unit/USCGEast', '/unit/private'),
    html.replace('>U.S. Coast Guard East<', '>Private photographer<'),
    html.replace(`>${credit}</a>`, '>Different photographer</a>'),
    html.replace(`Photo by ${credit}">`, 'Courtesy of a private photographer">'),
    html.replace('190306-G-SQ620-0001', '190306-A-SQ620-0001'),
    html.replace('PUBLIC DOMAIN', 'PERMISSION REQUIRED'),
  ])
    assert.equal(check(value), false);
  assert.equal(check(html), true);
  delete reference.originalReview.creditFormat;
  assert.equal(check(html), false);
});

test('Flickr CC0 needs the same creator/photo in the primary dedication, exact bytes and reviewed transfer', (t) => {
  const f = fixture(t),
    id = '123456789',
    account = 'photographer',
    nsid = '123456@N01',
    name = 'Photo Author';
  const reference = {
    origin: 'commons-flickr-cc0',
    license: 'CC0',
    artist: name,
    path: 'image.jpg',
    sha256: hash('original pixels'),
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tower.jpg',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Tower.jpg',
    creatorDedication: { photoId: id, account, nsid, name },
  };
  const meta = {
    LicenseShortName: { value: 'CC0' },
    AttributionRequired: { value: 'false' },
    Artist: { value: `<a href="https://www.flickr.com/people/${nsid}">${name}</a>` },
    Credit: { value: `https://www.flickr.com/photos/${account}/${id}/` },
  };
  const photo = {
    '@type': 'ImageObject',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    acquireLicensePage: `https://www.flickr.com/photos/${account}/${id}`,
    contentUrl: `https://live.staticflickr.com/1/${id}_photo_b.jpg`,
    author: { name, url: `https://www.flickr.com/photos/${account}` },
    creator: { name, url: `https://www.flickr.com/photos/${account}` },
  };
  const page = {
    title: 'File:Tower.jpg',
    revisions: [
      {
        revid: 1,
        slots: {
          main: {
            '*': `{{cc-zero}}\n{{User:FlickreviewR/reviewed-pass|${name}|https://flickr.com/photos/${nsid}/${id}|2026-01-01|cc-zero|}}`,
          },
        },
      },
    ],
    imageinfo: [
      {
        url: reference.downloadUrl,
        sha1: createHash('sha1').update('original pixels').digest('hex'),
        extmetadata: meta,
      },
    ],
  };
  const save = () => {
    const catalog = JSON.stringify({ query: { pages: { 1: page } } }),
      primary = `<script type="application/ld+json">${JSON.stringify({ '@graph': [photo] })}</script>`;
    fs.writeFileSync(path.join(f.dir, 'catalog.json'), catalog);
    fs.writeFileSync(path.join(f.dir, 'primary.html'), primary);
    reference.catalogEvidence = { path: 'catalog.json', sha256: hash(catalog) };
    reference.rightsEvidence = {
      path: 'primary.html',
      sha256: hash(primary),
      sourceUrl: `https://www.flickr.com/photos/${account}/${id}/`,
    };
  };
  const inspect = () => {
    save();
    return inspectFlickrCc0Reference(f.dir, reference).eligible;
  };
  assert.equal(inspect(), true);
  photo.license = 'https://creativecommons.org/licenses/by/4.0/';
  assert.equal(inspect(), false);
  photo.license = 'https://creativecommons.org/publicdomain/zero/1.0/';
  photo.creator.name = 'Unrelated creator';
  assert.equal(inspect(), false);
  photo.creator.name = name;
  photo.acquireLicensePage = 'https://www.flickr.com/photos/photographer/999';
  assert.equal(inspect(), false);
  photo.acquireLicensePage = `https://www.flickr.com/photos/${account}/${id}`;
  meta.Restrictions = { value: 'Permission needed' };
  assert.equal(inspect(), false);
  delete meta.Restrictions;
  page.revisions[0].slots.main['*'] = '{{cc-zero}}';
  assert.equal(inspect(), false);
  const review = `{{cc-zero}}\n{{FlickreviewR|status=passed|author=${account}|sourceurl=https://flickr.com/photos/${nsid}/${id}|archive=|reviewdate=2024-10-24 23:37:04|reviewlicense=cc-zero|reviewer=FlickreviewR 2}}`;
  page.revisions[0].slots.main['*'] = review;
  assert.equal(inspect(), true);
  for (const [from, to] of [
    ['status=passed', 'status=failed'],
    [`author=${account}`, 'author=unrelated'],
    [`/${nsid}/${id}`, `/${nsid}/999`],
    ['reviewlicense=cc-zero', 'reviewlicense=cc-by'],
    ['reviewer=FlickreviewR 2', 'reviewer=Other'],
    ['status=passed', 'status=failed|status=passed'],
  ]) {
    page.revisions[0].slots.main['*'] = review.replace(from, to);
    assert.equal(inspect(), false);
  }
  const displayNameReview = review.replace(`author=${account}`, `author=${name}`);
  page.revisions[0].slots.main['*'] = displayNameReview;
  assert.equal(inspect(), false);
  photo.author.image =
    photo.creator.image = `https://farm66.staticflickr.com/65535/buddyicons/${nsid}.jpg?123#${nsid}`;
  assert.equal(inspect(), true);
  photo.creator.image = 'https://farm66.staticflickr.com/65535/buddyicons/999@N01.jpg#999@N01';
  assert.equal(inspect(), false);
  photo.creator.image = photo.author.image;
  page.revisions[0].slots.main['*'] = displayNameReview.replace(`/${nsid}/${id}`, `/999@N01/${id}`);
  assert.equal(inspect(), false);
  delete photo.author.image;
  delete photo.creator.image;
  page.revisions[0].slots.main['*'] = review;
  photo.author.name = photo.creator.name = 'New display name';
  reference.creatorDedication.name = 'New display name';
  assert.equal(inspect(), false);
  reference.creatorDedication.catalogName = name;
  photo.author.image =
    photo.creator.image = `https://farm66.staticflickr.com/65535/buddyicons/${nsid}.jpg?123#${nsid}`;
  assert.equal(inspect(), true);
  photo.creator.image = 'https://farm66.staticflickr.com/65535/buddyicons/999@N01.jpg#999@N01';
  assert.equal(inspect(), false);
  photo.creator.image = photo.author.image;
  reference.creatorDedication.catalogName = 'Another author';
  assert.equal(inspect(), false);
});

function habsFixture(t, kind = 'government-photograph') {
  const f = fixture(t),
    id = 'pa2187',
    drawing = kind === 'original-measured-drawing';
  const bytes = Buffer.concat([Buffer.from('49492a00', 'hex'), Buffer.from('native original')]);
  fs.writeFileSync(path.join(f.dir, 'original.tif'), bytes);
  const rights =
    'The original measured drawings and most of the photographs and data pages in HABS/HAER/HALS were created for the U.S. Government and are considered to be in the public domain. These materials are noted by the presence of a line crediting the original source';
  fs.writeFileSync(path.join(f.dir, 'rights.html'), rights);
  const role =
    'Jack E. Boucher was the Chief Photographer for the Historic American Buildings Survey (HABS).';
  fs.writeFileSync(path.join(f.dir, 'role.html'), role);
  const reference = {
    origin: 'loc-habs-original-public-domain',
    license: 'Public domain',
    artist: drawing ? 'Vandenbark, Sara' : 'Jack E. Boucher',
    path: 'original.tif',
    sha256: hash(bytes),
    sourceUrl: `https://www.loc.gov/item/${id}/`,
    habsSurveyNumber: 'HABS PA-5346-A',
    downloadUrl: `https://tile.loc.gov/storage-services/master/pnp/habshaer/pa/pa2100/${id}/${drawing ? 'sheet/00001a' : 'photos/134224pu'}.tif`,
    resourceUrl: `https://www.loc.gov/resource/hhh.${id}.${drawing ? 'sheet.00001a' : 'photos.134224p'}`,
    rightsEvidence: {
      path: 'rights.html',
      sha256: hash(rights),
      sourceUrl: 'https://wwws.loc.gov/rr/print/res/114_habs.html',
    },
    governmentRoleEvidence: {
      path: 'role.html',
      sha256: hash(role),
      sourceUrl:
        'https://npgallery.nps.gov/MUSEUM/AssetDetail/53bc45f1-8676-4876-9c5b-841d4e1615fc',
    },
    visuallyReviewedForThisPolicy: true,
    originalReview: {
      kind,
      caption: '1. Guest house original',
      inspectedNativeSha256: hash(bytes),
      noPrivateSourceCredit: true,
      titleBlock: [
        'Historic American Buildings Survey',
        'National Park Service',
        'U.S. Department of the Interior',
      ],
      delineators: ['Vandenbark, Sara'],
    },
  };
  const catalog = {
    item: {
      item: {
        id,
        creators: [
          { role: 'creator', title: 'Historic American Buildings Survey' },
          { role: 'photographer', title: 'Boucher, Jack E.' },
          { role: 'delineator', title: 'Vandenbark, Sara' },
        ],
      },
      group: ['hh-6', 'habshaer-group-6'],
      access_restricted: false,
      notes: ['Survey number: HABS PA-5346-A '],
    },
    resources: [
      {
        files: [
          [
            {
              mimetype: 'image/tiff',
              size: bytes.length,
              type: drawing ? 'drawing' : 'bw_photos',
              url: reference.downloadUrl,
            },
            { use: 'caption', aka: reference.resourceUrl, title: reference.originalReview.caption },
          ],
        ],
      },
    ],
  };
  const write = () => {
    const text = JSON.stringify(catalog);
    fs.writeFileSync(path.join(f.dir, 'catalog.json'), text);
    reference.catalogEvidence = { path: 'catalog.json', sha256: hash(text) };
  };
  write();
  return {
    ...f,
    reference,
    catalog,
    write,
    inspectHabs: () => inspectHabsReference(f.dir, reference),
  };
}

test('HABS original government photos need a matching native catalog file, creator and inspected source credit', (t) => {
  const f = habsFixture(t);
  assert.equal(f.inspectHabs().eligible, true);
  f.reference.originalReview.noPrivateSourceCredit = false;
  assert.equal(f.inspectHabs().eligible, false);
  f.reference.originalReview.noPrivateSourceCredit = true;
  f.catalog.item.item.creators.push({ role: 'photographer', title: 'Private donor' });
  f.write();
  assert.equal(f.inspectHabs().eligible, false);
  f.catalog.item.item.creators.pop();
  f.write();
  f.reference.governmentRoleEvidence.sha256 = 'unmatched';
  assert.equal(f.inspectHabs().eligible, false);
});

test('HABS Boucher catalogs may omit the final initial period but cannot name a different photographer', (t) => {
  const f = habsFixture(t),
    photographer = f.catalog.item.item.creators.find((c) => c.role === 'photographer');
  photographer.title = 'Boucher, Jack E';
  f.write();
  assert.equal(f.inspectHabs().eligible, true);
  for (const title of ['Boucher, Jack', 'Boucher, John E', 'Unknown photographer']) {
    photographer.title = title;
    f.write();
    assert.equal(f.inspectHabs().eligible, false);
  }
});

test('mixed HABS surveys need a bound individual government-photographer record', (t) => {
  const f = habsFixture(t),
    key = 'pa2187.photos.134224p';
  f.catalog.item.item.creators.push({ role: 'photographer', title: 'Other photographer' });
  f.write();
  assert.equal(f.inspectHabs().eligible, false);
  const detail = {
    unrestricted: true,
    item: {
      id: key,
      link: `https://www.loc.gov/pictures/item/${key}/`,
      part_of_group: 'Photograph pa2187',
      raw_collections: ['hh'],
      restriction: null,
      title: f.reference.originalReview.caption,
      notes: [],
      creators: [{ role: 'creator', title: 'Boucher, Jack E.' }],
    },
    resources: [
      {
        item: key,
        id: `hhh.${key}`,
        larger: f.reference.downloadUrl.replace(
          'https://tile.loc.gov/storage-services/',
          'https://cdn.loc.gov/',
        ),
        larger_s: f.catalog.resources[0].files[0][0].size,
      },
    ],
  };
  const check = () => {
    const bytes = JSON.stringify(detail);
    fs.writeFileSync(path.join(f.dir, 'individual.json'), bytes);
    f.reference.individualCreatorEvidence = {
      path: 'individual.json',
      sha256: hash(bytes),
      sourceUrl: `https://www.loc.gov/pictures/item/${key}/?fo=json`,
    };
    return f.inspectHabs().eligible;
  };
  assert.equal(check(), true);
  const original = JSON.parse(JSON.stringify(detail));
  for (const change of [
    (d) => {
      d.unrestricted = false;
    },
    (d) => {
      d.item.id = 'pa2187.photos.different';
    },
    (d) => {
      d.item.title = 'Another original';
    },
    (d) => {
      d.item.creators[0].title = 'Other photographer';
    },
    (d) => {
      d.item.creators[0].role = 'donor';
    },
    (d) => {
      d.item.notes = ['Copied from a private photograph'];
    },
    (d) => {
      d.item.restriction = 'Permission required';
    },
    (d) => {
      d.resources[0].larger = d.resources[0].larger.replace('134224p', 'different');
    },
    (d) => {
      d.resources[0].larger_s++;
    },
    (d) => {
      delete d.item;
    },
  ]) {
    Object.assign(detail, JSON.parse(JSON.stringify(original)));
    change(detail);
    assert.equal(check(), false);
  }
  Object.assign(detail, original);
  assert.equal(check(), true);
  f.reference.individualCreatorEvidence.sha256 = 'changed';
  assert.equal(f.inspectHabs().eligible, false);
});

test('a HABS color original requires the same individual government creator and exact native file', (t) => {
  const f = habsFixture(t),
    key = 'pa2187.color.134224c';
  f.reference.downloadUrl = f.reference.downloadUrl.replace('/photos/134224pu', '/color/134224cu');
  f.reference.resourceUrl = `https://www.loc.gov/resource/hhh.${key}`;
  const group = f.catalog.resources[0].files[0];
  group[0].url = f.reference.downloadUrl;
  group[0].type = 'colorphoto';
  group[1].aka = f.reference.resourceUrl;
  f.write();
  assert.equal(f.inspectHabs().eligible, false);
  const detail = {
    unrestricted: true,
    item: {
      id: key,
      link: `https://www.loc.gov/pictures/item/${key}/`,
      part_of_group: 'Photograph pa2187',
      raw_collections: ['hh'],
      title: f.reference.originalReview.caption,
      notes: [],
      creators: [{ role: 'creator', title: 'Boucher, Jack E.' }],
    },
    resources: [
      {
        item: key,
        id: `hhh.${key}`,
        larger: f.reference.downloadUrl.replace(
          'https://tile.loc.gov/storage-services/',
          'https://cdn.loc.gov/',
        ),
        larger_s: group[0].size,
      },
    ],
  };
  const write = () => {
    const bytes = JSON.stringify(detail);
    fs.writeFileSync(path.join(f.dir, 'individual.json'), bytes);
    f.reference.individualCreatorEvidence = {
      path: 'individual.json',
      sha256: hash(bytes),
      sourceUrl: `https://www.loc.gov/pictures/item/${key}/?fo=json`,
    };
  };
  write();
  assert.equal(f.inspectHabs().eligible, true);
  detail.resources[0].larger = detail.resources[0].larger.replace('/color/', '/photos/');
  write();
  assert.equal(f.inspectHabs().eligible, false);
});

test('HABS drawing approval cannot use a copied plan, unrelated title block or catalog file', (t) => {
  const f = habsFixture(t, 'original-measured-drawing');
  assert.equal(f.inspectHabs().eligible, true);
  f.reference.originalReview.kind = 'historical-copied-plan';
  assert.equal(f.inspectHabs().eligible, false);
  f.reference.originalReview.kind = 'original-measured-drawing';
  f.reference.originalReview.delineators = ['Wright, Frank Lloyd'];
  assert.equal(f.inspectHabs().eligible, false);
  f.reference.originalReview.delineators = ['Vandenbark, Sara'];
  f.reference.originalReview.titleBlock = ['Private architectural office'];
  assert.equal(f.inspectHabs().eligible, false);
  f.reference.originalReview.titleBlock = [
    'Historic American Buildings Survey',
    'National Park Service',
    'U.S. Department of the Interior',
  ];
  f.catalog.resources[0].files[0][0].size++;
  f.write();
  assert.equal(f.inspectHabs().eligible, false);
});

test('a HABS collection label or bare no-known-restrictions advisory cannot replace the explicit grant', (t) => {
  const f = habsFixture(t);
  const text = 'No known restrictions. HABS collection. Public domain.';
  fs.writeFileSync(path.join(f.dir, 'rights.html'), text);
  f.reference.rightsEvidence.sha256 = hash(text);
  assert.equal(f.inspectHabs().eligible, false);
});

test('older HABS drawing-team roles must explicitly match every inspected delineator credit', (t) => {
  const f = habsFixture(t, 'original-measured-drawing');
  f.catalog.item.item.creators[2].role = 'field team';
  f.catalog.item.item.creators.push({ role: 'project manager', title: 'Schara, Mark' });
  f.reference.originalReview.delineators.push('Schara, Mark');
  f.reference.artist = f.reference.originalReview.delineators.join('; ');
  f.write();
  assert.equal(f.inspectHabs().eligible, false);
  f.reference.originalReview.delineatorCatalogRoles = [
    { name: 'Vandenbark, Sara', role: 'field team' },
    { name: 'Schara, Mark', role: 'project manager' },
  ];
  assert.equal(f.inspectHabs().eligible, true);
  f.reference.originalReview.delineatorCatalogRoles[1] = null;
  assert.equal(f.inspectHabs().eligible, false);
  f.reference.originalReview.delineatorCatalogRoles[1] = {
    name: 'Schara, Mark',
    role: 'project manager',
  };
  f.reference.originalReview.delineatorCatalogRoles.pop();
  assert.equal(f.inspectHabs().eligible, false);
  f.reference.originalReview.delineatorCatalogRoles.push({
    name: 'Schara, Mark',
    role: 'transmitter',
  });
  f.catalog.item.item.creators.push({ role: 'transmitter', title: 'Schara, Mark' });
  f.write();
  assert.equal(f.inspectHabs().eligible, false);
  f.reference.originalReview.delineatorCatalogRoles[1] = {
    name: 'Schara, Mark',
    role: 'project manager',
  };
  f.reference.originalReview.noPrivateSourceCredit = false;
  assert.equal(f.inspectHabs().eligible, false);
});
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-imagery-inventory-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const id = '7907aec0-1882-4044-ba22-51404ddbb060';
  const html = `<label>Asset ID:</label><div>${id}</div>
<label>PhotoCredit:</label><div>NPS</div>
<label>Constraints Information:</label><div>Public domain:Full Granting Rights</div>
<a href="/GetAsset/${id}/original.jpg">Original</a>`;
  fs.writeFileSync(path.join(dir, 'image.jpg'), 'original pixels');
  fs.writeFileSync(path.join(dir, 'source.html'), html);
  const reference = {
    origin: 'nps-gallery-public-domain',
    path: 'image.jpg',
    sha256: hash('original pixels'),
    sourceUrl: `https://npgallery.nps.gov/AssetDetail/${id}`,
    downloadUrl: `https://npgallery.nps.gov/GetAsset/${id}/original.jpg`,
    artist: 'NPS',
    license: 'Public domain',
    visuallyReviewedForThisPolicy: true,
    rightsEvidence: { path: 'source.html', sha256: hash(html) },
  };
  const story = { id: 'story', sourcePath: '_c/art/a/b/c/d/story.json' };
  const evidence = {
    format: 'molen/structure-imagery-evidence@1',
    policy: PUBLIC_DOMAIN_POLICY,
    references: [reference],
    quallaSearch: {
      source: 'published-qualla-media',
      completedBeforeSupplementalFetch: true,
      articlePaths: [story.sourcePath],
      notes: 'Inspected cleared originals first; their modern roof coverage is incomplete.',
    },
    excludedHistoricalImagery: [],
  };
  const inspect = () =>
    inspectImageryInventory({
      dir,
      qualla: dir,
      evidence,
      selectedReferences: [],
      stories: [story],
      frame: {},
    });
  return { dir, html, reference, story, evidence, inspect };
}

test('a supplemental-only model still needs the prior Qualla search, exact original and bound visual review', (t) => {
  const f = fixture(t),
    refs = {
      references: [],
      externalReferences: [f.reference],
      inputHash: 'reference-input',
    };
  const check = () => verifiedSupplementalSelection(refs, f.inspect(), f.evidence);
  assert.equal(check(), true);
  f.evidence.quallaSearch.completedBeforeSupplementalFetch = false;
  assert.equal(check(), false);
  f.evidence.quallaSearch.completedBeforeSupplementalFetch = true;
  fs.writeFileSync(path.join(f.dir, 'image.jpg'), 'changed original');
  assert.equal(check(), false);
  fs.writeFileSync(path.join(f.dir, 'image.jpg'), 'original pixels');
  refs.externalReferences = [{ ...f.reference, sha256: hash('different bytes') }];
  assert.equal(check(), false);
  refs.externalReferences = [f.reference];
  const review = {
    policy: PUBLIC_DOMAIN_POLICY,
    status: 'passed',
    scope: 'all-model-reference-imagery',
    inputHash: 'model-input',
    referenceInputHash: refs.inputHash,
    notes: 'Original inspected.',
    excludedHistoricalImagery: [],
    acceptedReferencePaths: [],
    auxiliaryReferencePaths: ['image.jpg'],
  };
  assert.equal(publicDomainReviewMatches(review, refs, 'model-input'), true);
  assert.equal(
    publicDomainReviewMatches({ ...review, auxiliaryReferencePaths: [] }, refs, 'model-input'),
    false,
  );
  assert.equal(
    publicDomainReviewMatches(review, { ...refs, externalReferences: [] }, 'model-input'),
    false,
  );
});

test('a supplemental NPS image needs its exact original bytes and explicit primary grant', (t) => {
  const f = fixture(t);
  assert.equal(inspectNpsReference(f.dir, f.reference).eligible, true);
  fs.writeFileSync(path.join(f.dir, 'image.jpg'), 'different pixels');
  assert.ok(
    inspectNpsReference(f.dir, f.reference).blockers.includes('supplemental-image-bytes-unbound'),
  );
});

test('the agency credit NPS Photo still needs an explicit public-domain grant and cannot include a private credit', (t) => {
  const f = fixture(t);
  for (const [credit, eligible] of [
    ['NPS Photo', true],
    ['NPS Photo / Private donor', false],
    ['Private photographer', false],
  ]) {
    const html = f.html.replace('<div>NPS</div>', `<div>${credit}</div>`);
    fs.writeFileSync(path.join(f.dir, f.reference.rightsEvidence.path), html);
    f.reference.rightsEvidence.sha256 = hash(html);
    assert.equal(inspectNpsReference(f.dir, f.reference).eligible, eligible);
  }
});

test('legacy NPS records require an explicit staff photographer, agency publisher and public-domain grant', (t) => {
  const f = fixture(t);
  const html = f.html
    .replace(
      '<label>PhotoCredit:</label><div>NPS</div>',
      '<label>Photographer:</label><div>NPS staff</div><label>Publisher:</label><div>National Park Service</div>',
    )
    .replace('Public domain:Full Granting Rights', 'Public domain');
  const check = (value) => {
    fs.writeFileSync(path.join(f.dir, f.reference.rightsEvidence.path), value);
    f.reference.rightsEvidence.sha256 = hash(value);
    return inspectNpsReference(f.dir, f.reference).eligible;
  };
  assert.equal(check(html), true);
  for (const value of [
    html.replace('NPS staff', 'Private donor'),
    html.replace('NPS staff', 'NPS staff / Private donor'),
    html.replace('National Park Service', 'Private collection'),
    html.replace('Public domain', 'Permission required'),
    `${html}<label>PhotoCredit:</label><div>Private donor</div>`,
    html.replace('Asset ID:', 'Unrelated ID:'),
  ])
    assert.equal(check(value), false);
  assert.equal(check(html), true);
  f.reference.downloadUrl += '?different-original';
  assert.equal(check(html), false);
});

test('an archive mirror needs the exact owner CC0 record, object identity and native bytes', (t) => {
  const f = fixture(t),
    id = 'a95aff58-d0b4-102d-bcf8-003048976d84';
  const reference = {
    ...f.reference,
    origin: 'nationaal-archief-cc0',
    license: 'CC0',
    sourceUrl: `https://www.nationaalarchief.nl/onderzoeken/fotocollectie/${id}`,
    artist: 'Rossem, Wim van / Anefo',
    dateCreated: '1957-03-25',
    archiveNumber: '908-4334',
    commonsTitle: 'File:Rear, Bestanddeelnr 908-4334.jpg',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Rear.jpg',
  };
  const file = {
    filename: id,
    metaData: Object.fromEntries(
      Object.entries({
        dc_identifier: id,
        dcterms_rightsHolder: 'Nationaal Archief, CC0',
        dcterms_creator: reference.artist,
        dcterms_date: reference.dateCreated,
        nao_bestanddeelnummer: reference.archiveNumber,
      }).map(([k, v]) => [k, { text: [v] }]),
    ),
  };
  const page = {
    title: reference.commonsTitle,
    revisions: [
      {
        revid: 123,
        slots: {
          main: {
            '*': `{{CC-zero}} Source=http://proxy.handle.net/10648/${id} Bestanddeelnummer: 908-4334`,
          },
        },
      },
    ],
    imageinfo: [
      {
        url: reference.downloadUrl,
        sha1: createHash('sha1').update('original pixels').digest('hex'),
        extmetadata: {
          Credit: { value: `http://proxy.handle.net/10648/${id}` },
          LicenseShortName: { value: 'CC0' },
          AttributionRequired: { value: 'false' },
        },
      },
    ],
  };
  const write = () => {
    const html =
      '<script type="application/json" data-drupal-selector="drupal-settings-json">' +
      JSON.stringify({
        na_viewer: { generic_response: JSON.stringify({ viewResponse: { files: [file] } }) },
      }) +
      '</script>';
    const catalog = JSON.stringify({ query: { pages: { 1: page } } });
    fs.writeFileSync(path.join(f.dir, 'archive.html'), html);
    fs.writeFileSync(path.join(f.dir, 'archive-commons.json'), catalog);
    reference.rightsEvidence = { path: 'archive.html', sha256: hash(html) };
    reference.catalogEvidence = { path: 'archive-commons.json', sha256: hash(catalog) };
  };
  write();
  assert.equal(inspectNationaalArchiefReference(f.dir, reference).eligible, true);
  file.metaData.dcterms_rightsHolder.text = ['Nationaal Archief'];
  write();
  assert.equal(inspectNationaalArchiefReference(f.dir, reference).eligible, false);
  file.metaData.dcterms_rightsHolder.text = ['Nationaal Archief, CC0'];
  file.metaData.nao_bestanddeelnummer.text = ['different photo'];
  write();
  assert.equal(inspectNationaalArchiefReference(f.dir, reference).eligible, false);
  file.metaData.nao_bestanddeelnummer.text = ['908-4334'];
  page.imageinfo[0].sha1 = 'unmatched original';
  write();
  assert.equal(inspectNationaalArchiefReference(f.dir, reference).eligible, false);
});
test('a public-domain label, third-party credit or unmatched asset cannot substitute for a grant', (t) => {
  const f = fixture(t);
  for (const html of [
    f.html.replace('Public domain:Full Granting Rights', 'Permission required'),
    f.html.replace('<div>NPS</div>', '<div>Private photographer</div>'),
    f.html.replace('Asset ID:', 'Different ID:'),
  ]) {
    fs.writeFileSync(path.join(f.dir, 'source.html'), html);
    f.reference.rightsEvidence.sha256 = hash(html);
    assert.equal(inspectNpsReference(f.dir, f.reference).eligible, false);
  }
  f.reference.rightsEvidence.path = '../source.html';
  assert.ok(
    inspectNpsReference(f.dir, f.reference).blockers.includes(
      'supplemental-rights-snapshot-unbound',
    ),
  );
});
test('supplemental imagery requires a prior Qualla search and actual original inspection', (t) => {
  const f = fixture(t);
  assert.equal(f.inspect().status, 'passed');
  f.evidence.quallaSearch.completedBeforeSupplementalFetch = false;
  assert.ok(f.inspect().blockers.includes('qualla-first-search-evidence-missing'));
  f.evidence.quallaSearch.completedBeforeSupplementalFetch = true;
  f.reference.visuallyReviewedForThisPolicy = false;
  assert.ok(f.inspect().blockers.includes('imagery-original-inspection-missing'));
});
test('the inventory must account for selected and auxiliary imagery and reject conflicting exclusions', (t) => {
  const f = fixture(t);
  let result = inspectImageryInventory({
    dir: f.dir,
    qualla: f.dir,
    evidence: f.evidence,
    selectedReferences: [{ path: '_m/missing.jpg', sha256: 'missing' }],
    stories: [f.story],
    frame: { supplementalReferences: [{ url: 'https://example.test/uncleared-plan.pdf' }] },
  });
  assert.ok(result.blockers.includes('selected-image-missing-from-inventory:_m/missing.jpg'));
  assert.ok(
    result.blockers.includes(
      'auxiliary-imagery-unaccounted:https://example.test/uncleared-plan.pdf',
    ),
  );
  f.evidence.excludedHistoricalImagery.push({ path: f.reference.path });
  result = f.inspect();
  assert.ok(result.blockers.includes('accepted-imagery-also-marked-excluded'));
});

test('a Commons original needs its creator release, matching author and exact native-file digest', (t) => {
  const f = fixture(t),
    reference = {
      ...f.reference,
      origin: 'commons-self-public-domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
      artist: 'Photographer',
    };
  const page = {
    title: 'File:Photo.jpg',
    revisions: [
      { revid: 123, slots: { main: { '*': '{{Information|Source={{own}}}}\n{{PD-self}}' } } },
    ],
    imageinfo: [
      {
        url: reference.downloadUrl,
        sha1: createHash('sha1').update('original pixels').digest('hex'),
        extmetadata: {
          LicenseShortName: { value: 'Public domain' },
          AttributionRequired: { value: 'false' },
          Artist: { value: 'Photographer' },
          Credit: { value: 'Own work' },
        },
      },
    ],
  };
  const write = () => {
    const bytes = JSON.stringify({ query: { pages: { 1: page } } });
    fs.writeFileSync(path.join(f.dir, 'commons.json'), bytes);
    reference.rightsEvidence = { path: 'commons.json', sha256: hash(bytes) };
  };
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, true);
  page.imageinfo[0].extmetadata.Credit.value = 'I took it';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
  page.revisions[0].slots.main['*'] = '{{Information\n|source=I took it\n}}\n{{PD-self}}';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, true);
  page.imageinfo[0].extmetadata.Credit.value = 'taken by author';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
  page.revisions[0].slots.main['*'] = '{{Information\n|Source=taken by author\n}}\n{{PD-self}}';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, true);
  page.imageinfo[0].extmetadata.Restrictions = { value: 'Permission required' };
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
  delete page.imageinfo[0].extmetadata.Restrictions;
  page.imageinfo[0].extmetadata.Credit.value = 'Own work';
  page.revisions[0].slots.main['*'] = '{{PD-US}}';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
  page.revisions[0].slots.main['*'] = '{{self|cc-zero}}';
  // Commons may report the old depicted architecture as PD while the
  // photographer separately dedicates the exact own-work photograph to CC0.
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, true);
  page.revisions[0].slots.main['*'] = '{{PD-old-100}}';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
  page.revisions[0].slots.main['*'] = '{{self|cc-zero}}';
  page.imageinfo[0].extmetadata.LicenseShortName.value = 'CC0';
  reference.license = 'CC0';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, true);
  page.revisions[0].slots.main['*'] = '{{self}}\n{{cczero}}';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, true);
  page.revisions[0].slots.main['*'] = '{{cczero}}';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
  page.revisions[0].slots.main['*'] = '{{self}}\n{{cczero}}';
  write();
  reference.artist = 'Different photographer';
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
  reference.artist = 'Photographer';
  page.imageinfo[0].sha1 = 'wrong-original';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
});

test('a migrated creator grant must bind the named granting account, author and original file', (t) => {
  const f = fixture(t),
    reference = {
      ...f.reference,
      origin: 'commons-author-public-domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
      artist: 'Ian Kehoe',
      creatorDedication: {
        wiki: 'en',
        project: 'English Wikipedia',
        username: 'MWD',
        profileUrl: 'https://en.wikipedia.org/wiki/User:MWD',
        originalFileUrl: 'https://en.wikipedia.org/wiki/Image:Original.jpg',
      },
    };
  const page = {
    title: 'File:Photo.jpg',
    revisions: [
      {
        revid: 123,
        slots: {
          main: { '*': '{{PD-user-w|en|English Wikipedia|MWD}} Author=[[:en:User:MWD|Ian Kehoe]]' },
        },
      },
    ],
    imageinfo: [
      {
        url: reference.downloadUrl,
        sha1: createHash('sha1').update('original pixels').digest('hex'),
        extmetadata: {
          LicenseShortName: { value: 'Public domain' },
          AttributionRequired: { value: 'false' },
          Permission: { value: 'PD' },
          Copyrighted: { value: 'False' },
          Artist: { value: '<a href="https://en.wikipedia.org/wiki/User:MWD">Ian Kehoe</a>' },
          Credit: {
            value:
              'Uploaded as <a href="https://en.wikipedia.org/wiki/Image:Original.jpg">Original</a>',
          },
        },
      },
    ],
  };
  const write = () => {
    const bytes = JSON.stringify({ query: { pages: { 1: page } } });
    fs.writeFileSync(path.join(f.dir, 'migrated.json'), bytes);
    reference.rightsEvidence = { path: 'migrated.json', sha256: hash(bytes) };
  };
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, true);
  reference.creatorDedication.username = 'DifferentAccount';
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
  reference.creatorDedication.username = 'MWD';
  page.revisions[0].slots.main['*'] = '{{PD-user}} Author=[[:en:User:MWD|Ian Kehoe]]';
  write();
  assert.equal(inspectCommonsSelfReference(f.dir, reference).eligible, false);
});

test('an English Wikipedia original-upload release binds creator, file, dimensions, bytes and explicit dedication', (t) => {
  const f = fixture(t),
    name = 'Creator1',
    reference = {
      ...f.reference,
      origin: 'commons-author-public-domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
      artist: `${name} at English Wikipedia`,
      creatorDedication: {
        kind: 'english-wikipedia-original-upload',
        wiki: 'en',
        project: 'English Wikipedia',
        username: name,
        profileUrl: `https://en.wikipedia.org/wiki/User:${name}`,
        originalFileUrl: 'https://en.wikipedia.org/wiki/File:Original.jpg',
        originalUpload: { timestamp: '2009-05-31 00:54', width: 20, height: 10, bytes: 15 },
      },
    },
    body = `{{PD-user-en|${name}}} {{user at project|${name}|wikipedia|en}} {{original description page|en.wikipedia|Original.jpg}}\n2009-05-31 00:54 [[:en:User:${name}|${name}]] 20×10× (15 bytes) Contributor (${name.toLowerCase()}), Self taken in May 2009`,
    page = {
      title: 'File:Photo.jpg',
      revisions: [{ revid: 123, slots: { main: { '*': body } } }],
      imageinfo: [
        {
          url: reference.downloadUrl,
          width: 20,
          height: 10,
          size: 15,
          sha1: createHash('sha1').update('original pixels').digest('hex'),
          extmetadata: {
            LicenseShortName: { value: 'Public domain' },
            AttributionRequired: { value: 'false' },
            Permission: { value: 'Released into the public domain (by the author)' },
            Copyrighted: { value: 'False' },
            Artist: {
              value: `<a href="${reference.creatorDedication.profileUrl}">${name}</a> at English Wikipedia`,
            },
            Credit: {
              value:
                'Transferred from <a href="https://en.wikipedia.org">en.wikipedia</a> to Commons.',
            },
          },
        },
      ],
    },
    inspect = () => {
      const bytes = JSON.stringify({ query: { pages: { 1: page } } });
      fs.writeFileSync(path.join(f.dir, 'migrated.json'), bytes);
      reference.rightsEvidence = { path: 'migrated.json', sha256: hash(bytes) };
      return inspectCommonsSelfReference(f.dir, reference).eligible;
    };
  assert.equal(inspect(), true);
  for (const [from, to] of [
    ['PD-user-en|Creator1', 'PD-user-en|Other'],
    ['Original.jpg', 'Unrelated.jpg'],
    ['20×10× (15 bytes)', '20×10× (16 bytes)'],
    ['contributor (creator1)', 'contributor (other)'],
  ]) {
    page.revisions[0].slots.main['*'] = from.startsWith('contributor')
      ? body.replace(/Contributor \(creator1\)/, to)
      : body.replace(from, to);
    assert.equal(inspect(), false);
  }
  page.revisions[0].slots.main['*'] = body;
  page.imageinfo[0].extmetadata.Permission.value = 'Public domain according to uploader';
  assert.equal(inspect(), false);
  page.imageinfo[0].extmetadata.Permission.value =
    'Released into the public domain (by the author)';
  page.imageinfo[0].extmetadata.Restrictions = { value: 'Permission required' };
  assert.equal(inspect(), false);
});

test('an early uploader release needs the first same-account revision, sole original and contemporaneous upload', (t) => {
  const f = fixture(t),
    reference = {
      ...f.reference,
      origin: 'commons-self-public-domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Early.jpg',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Early.jpg',
      artist: 'Photographer',
      creatorDedication: {
        kind: 'contemporaneous-original-uploader-release',
        username: 'Photographer',
        revision: 123,
      },
    },
    page = {
      title: 'File:Early.jpg',
      revisions: [
        {
          revid: 123,
          parentid: 0,
          user: 'Photographer',
          timestamp: '2006-04-19T01:11:58Z',
          slots: { main: { '*': '{{GFDL-self}}\n{{PD-self}}' } },
        },
      ],
      imageinfo: [
        {
          user: 'Photographer',
          timestamp: '2006-04-19T01:11:57Z',
          url: reference.downloadUrl,
          sha1: createHash('sha1').update('original pixels').digest('hex'),
          extmetadata: {
            LicenseShortName: { value: 'Public domain' },
            AttributionRequired: { value: 'false' },
          },
        },
      ],
    };
  const check = () => {
    const bytes = JSON.stringify({ query: { pages: { 1: page } } });
    fs.writeFileSync(path.join(f.dir, 'early.json'), bytes);
    reference.rightsEvidence = { path: 'early.json', sha256: hash(bytes) };
    return inspectCommonsSelfReference(f.dir, reference).eligible;
  };
  assert.equal(check(), true);
  page.revisions[0].user = 'Third party';
  assert.equal(check(), false);
  page.revisions[0].user = 'Photographer';
  page.revisions[0].parentid = 122;
  assert.equal(check(), false);
  page.revisions[0].parentid = 0;
  page.imageinfo.push({ ...page.imageinfo[0] });
  assert.equal(check(), false);
  page.imageinfo.pop();
  page.imageinfo[0].timestamp = '2007-04-19T01:11:57Z';
  assert.equal(check(), false);
  page.imageinfo[0].timestamp = '2006-04-19T01:11:57Z';
  page.imageinfo[0].extmetadata.Artist = { value: 'Different photographer' };
  assert.equal(check(), false);
  delete page.imageinfo[0].extmetadata.Artist;
  page.revisions[0].slots.main['*'] = '{{GFDL-self}}';
  assert.equal(check(), false);
});

test('Highsmith needs the explicit photographer dedication as well as the specific primary catalog record', (t) => {
  const f = fixture(t),
    rights = 'Carol M. Highsmith has stipulated that her photographs are in the public domain.',
    url = 'https://tile.loc.gov/storage-services/service/pnp/highsm/04600/04695.jp2',
    reference = {
      ...f.reference,
      origin: 'loc-highsmith-public-domain',
      sourceUrl: 'https://www.loc.gov/item/2010630679/',
      downloadUrl: url,
      artist: 'Carol M. Highsmith',
      rightsEvidence: {
        path: 'highsmith.html',
        sha256: hash(rights),
        sourceUrl: 'https://wwws.loc.gov/rr/print/res/482_high.html',
      },
    };
  const catalog = {
    item: {
      item: { id: '2010630679' },
      access_restricted: false,
      group: ['highsm'],
      contributor_names: ['Highsmith, Carol M., 1946-, photographer'],
      rights_advisory: 'No known restrictions on publication.',
    },
    resources: [{ files: [[{ url }]] }],
  };
  const write = () => {
    const bytes = JSON.stringify(catalog);
    fs.writeFileSync(path.join(f.dir, 'catalog.json'), bytes);
    reference.catalogEvidence = { path: 'catalog.json', sha256: hash(bytes) };
  };
  fs.writeFileSync(path.join(f.dir, 'highsmith.html'), rights);
  write();
  assert.equal(inspectHighsmithReference(f.dir, reference).eligible, true);
  const vague = 'No known restrictions on publication.';
  fs.writeFileSync(path.join(f.dir, 'highsmith.html'), vague);
  reference.rightsEvidence.sha256 = hash(vague);
  assert.equal(inspectHighsmithReference(f.dir, reference).eligible, false);
  fs.writeFileSync(path.join(f.dir, 'highsmith.html'), rights);
  reference.rightsEvidence.sha256 = hash(rights);
  catalog.item.contributor_names = ['Unidentified photographer'];
  write();
  assert.equal(inspectHighsmithReference(f.dir, reference).eligible, false);
});

test('a direct named other-wiki grant needs the same creator first revision and sole contemporaneous upload', (t) => {
  const f = fixture(t),
    reference = {
      ...f.reference,
      origin: 'commons-self-public-domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
      artist: 'Chong Fat',
      creatorDedication: {
        kind: 'contemporaneous-named-uploader-release',
        username: 'Chong Fat',
        wiki: 'zh',
        project: 'Chinese Wikipedia',
        profileUrl: 'https://zh.wikipedia.org/wiki/User:Chong_Fat',
        revision: 123,
      },
    },
    page = {
      title: 'File:Photo.jpg',
      revisions: [
        {
          revid: 123,
          parentid: 0,
          user: 'Chong Fat',
          timestamp: '2007-12-08T09:51:56Z',
          slots: {
            main: {
              '*': '{{Information|Source=Self took photo (Own work)|Author=[[:zh:User:Chong Fat|Chong Fat]]|Permission={{PD-user-w|zh|Chinese Wikipedia|Chong Fat}}}}',
            },
          },
        },
      ],
      imageinfo: [
        {
          user: 'Chong Fat',
          timestamp: '2007-12-08T09:51:56Z',
          url: reference.downloadUrl,
          sha1: createHash('sha1').update('original pixels').digest('hex'),
          extmetadata: {
            LicenseShortName: { value: 'Public domain' },
            AttributionRequired: { value: 'false' },
            Artist: {
              value: '<a href="https://zh.wikipedia.org/wiki/User:Chong_Fat">Chong Fat</a>',
            },
            Credit: { value: 'Self-photographed' },
          },
        },
      ],
    },
    inspect = () => {
      const bytes = JSON.stringify({ query: { pages: { 1: page } } });
      fs.writeFileSync(path.join(f.dir, 'commons.json'), bytes);
      reference.rightsEvidence = { path: 'commons.json', sha256: hash(bytes) };
      return inspectCommonsSelfReference(f.dir, reference).eligible;
    };
  assert.equal(inspect(), true);
  page.revisions[0].user = 'Transfer account';
  assert.equal(inspect(), false);
  page.revisions[0].user = 'Chong Fat';
  page.imageinfo[0].user = 'Other uploader';
  assert.equal(inspect(), false);
  page.imageinfo[0].user = 'Chong Fat';
  page.revisions[0].parentid = 122;
  assert.equal(inspect(), false);
  page.revisions[0].parentid = 0;
  page.revisions[0].timestamp = '2008-12-08T09:51:56Z';
  assert.equal(inspect(), false);
  page.revisions[0].timestamp = '2007-12-08T09:51:56Z';
  page.imageinfo.push({ ...page.imageinfo[0] });
  assert.equal(inspect(), false);
  page.imageinfo.pop();
  page.revisions[0].slots.main['*'] = '{{PD-old-100}}';
  assert.equal(inspect(), false);
});

test('a Japanese on-site photograph needs the same creator first self-release and sole native upload', (t) => {
  const f = fixture(t),
    reference = {
      ...f.reference,
      origin: 'commons-self-public-domain',
      license: 'Public domain',
      artist: 'Photographer',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Japanese.jpg',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Japanese.jpg',
      creatorDedication: {
        kind: 'contemporaneous-japanese-photographer-release',
        username: 'Photographer',
        revision: 123,
      },
    },
    body =
      '{{Information\n|Source=現地で撮影\n|Author=[[利用者:Photographer|Photographer]]（[[利用者‐会話:Photographer|会話]]）\n|Permission={{PD-self}}\n}}',
    page = {
      title: 'File:Japanese.jpg',
      revisions: [
        {
          revid: 123,
          parentid: 0,
          user: 'Photographer',
          timestamp: '2017-11-25T12:49:38Z',
          slots: { main: { '*': body } },
        },
      ],
      imageinfo: [
        {
          user: 'Photographer',
          timestamp: '2017-11-25T12:49:38Z',
          url: reference.downloadUrl,
          sha1: createHash('sha1').update('original pixels').digest('hex'),
          extmetadata: {
            LicenseShortName: { value: 'Public domain' },
            AttributionRequired: { value: 'false' },
            Restrictions: { value: '' },
            Credit: { value: '現地で撮影' },
            Artist: { value: 'Photographer（会話）' },
          },
        },
      ],
    };
  const check = () => {
    const bytes = JSON.stringify({ query: { pages: { 1: page } } });
    fs.writeFileSync(path.join(f.dir, 'japanese.json'), bytes);
    reference.rightsEvidence = { path: 'japanese.json', sha256: hash(bytes) };
    return inspectCommonsSelfReference(f.dir, reference).eligible;
  };
  assert.equal(check(), true);
  page.revisions[0].user = 'Third party';
  assert.equal(check(), false);
  page.revisions[0].user = 'Photographer';
  page.imageinfo[0].user = 'Different uploader';
  assert.equal(check(), false);
  page.imageinfo[0].user = 'Photographer';
  page.revisions[0].parentid = 122;
  assert.equal(check(), false);
  page.revisions[0].parentid = 0;
  reference.creatorDedication.revision = 122;
  assert.equal(check(), false);
  reference.creatorDedication.revision = 123;
  page.imageinfo.push({ ...page.imageinfo[0] });
  assert.equal(check(), false);
  page.imageinfo.pop();
  page.imageinfo[0].timestamp = '2018-11-25T12:49:38Z';
  assert.equal(check(), false);
  page.imageinfo[0].timestamp = page.revisions[0].timestamp;
  page.revisions[0].slots.main['*'] = body.replace('現地で撮影', 'Third-party archive');
  assert.equal(check(), false);
  page.revisions[0].slots.main['*'] = body.replace(
    '[[利用者:Photographer|Photographer]]',
    '[[利用者:Other|Other]]',
  );
  assert.equal(check(), false);
  page.revisions[0].slots.main['*'] = body.replace('{{PD-self}}', '{{PD-old-100}}');
  assert.equal(check(), false);
  page.revisions[0].slots.main['*'] = body;
  page.imageinfo[0].extmetadata.Artist.value = 'Different photographer（会話）';
  assert.equal(check(), false);
});

test('an original named photographer release needs the signed first revision and every native upload by that creator', (t) => {
  const f = fixture(t),
    reference = {
      ...f.reference,
      origin: 'commons-self-public-domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tower.jpg',
      downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Tower.jpg',
      artist: 'Photographer',
      creatorDedication: {
        kind: 'original-named-photographer-native-history',
        username: 'Photographer',
        revision: 123,
      },
    },
    page = {
      title: 'File:Tower.jpg',
      revisions: [
        {
          revid: 123,
          parentid: 0,
          user: 'Photographer',
          timestamp: '2005-12-07T09:01:30Z',
          slots: { main: { '*': '== Summary ==\nAuthor photographer. A tower.\n{{PD-self}}' } },
        },
      ],
      imageinfo: [
        {
          url: reference.downloadUrl,
          user: 'Photographer',
          timestamp: '2006-03-04T12:46:14Z',
          sha1: createHash('sha1').update('original pixels').digest('hex'),
          extmetadata: {
            LicenseShortName: { value: 'Public domain' },
            AttributionRequired: { value: 'false' },
            Artist: {
              value:
                'No machine-readable author provided. Photographer assumed (based on copyright claims).',
            },
            Credit: {
              value:
                'No machine-readable source provided. Own work assumed (based on copyright claims).',
            },
          },
        },
        { user: 'Photographer', timestamp: '2005-12-07T09:01:30Z' },
      ],
    },
    write = () => {
      const bytes = JSON.stringify({ query: { pages: { 1: page } } });
      fs.writeFileSync(path.join(f.dir, 'commons.json'), bytes);
      reference.rightsEvidence = { path: 'commons.json', sha256: hash(bytes) };
    },
    check = () => {
      write();
      return inspectCommonsSelfReference(f.dir, reference).eligible;
    };
  assert.equal(check(), true);
  page.imageinfo[0].user = 'SomeoneElse';
  assert.equal(check(), false);
  page.imageinfo[0].user = 'Photographer';
  page.revisions[0].slots.main['*'] = 'An unattributed tower.\n{{PD-self}}';
  assert.equal(check(), false);
  page.revisions[0].slots.main['*'] = 'Author someoneelse.\n{{PD-self}}';
  assert.equal(check(), false);
  page.revisions[0].slots.main['*'] = 'Author photographer.\n{{PD-self}}';
  assert.equal(check(), true);
  page.revisions[0].parentid = 99;
  assert.equal(check(), false);
  page.revisions[0].parentid = 0;
  page.imageinfo[1].timestamp = '2004-01-01T00:00:00Z';
  assert.equal(check(), false);
  page.imageinfo[1].timestamp = '2005-12-07T09:01:30Z';
  page.imageinfo[0].sha1 = 'different-native';
  assert.equal(check(), false);
});

for (const site of ['publicdomainpictures', 'pxhere']) {
  test(`${site} CC0 requires the exact named creator, image-specific release and offered rendition`, (t) => {
    const f = fixture(t),
      artist = 'Example Photographer',
      title = 'Historic house exterior';
    const pdp = site === 'publicdomainpictures';
    const sourceUrl = pdp
      ? 'https://www.publicdomainpictures.net/en/view-image.php?image=123&picture=historic-house'
      : 'https://pxhere.com/en/photo/123';
    const downloadUrl = pdp
      ? 'https://www.publicdomainpictures.net/pictures/1000/velka/historic-house.jpg'
      : 'https://c.pxhere.com/images/aa/bb/abcdef-123.jpg!d';
    const creatorUrl = pdp
      ? 'https://www.publicdomainpictures.net/en/browse-author.php?a=456'
      : 'https://pxhere.com/en/photographer/456';
    const image = pdp
      ? {
          '@type': 'ImageObject',
          '@id': `${sourceUrl}#primaryimage`,
          name: title,
          creator: { '@type': 'Person', name: artist, url: creatorUrl },
          acquireLicensePage: sourceUrl,
          contentUrl: downloadUrl,
          width: 1200,
          height: 675,
          license: 'https://creativecommons.org/publicdomain/zero/1.0/',
          copyrightNotice: 'Public domain (CC0). Attribution is not required.',
          creditText: `${artist} @ PublicDomainPictures.net`,
        }
      : {
          '@type': 'ImageObject',
          author: { '@type': 'Person', name: artist },
          acquireLicensePage: sourceUrl,
          thumbnail: { url: downloadUrl },
          license: 'https://creativecommons.org/licenses/publicdomain/',
        };
    const html = `<script type="application/ld+json">${JSON.stringify(image)}</script>
<meta property="og:url" content="${sourceUrl.replaceAll('&', '&amp;')}"><meta property="og:image" content="${downloadUrl}">
<meta name="twitter:image:width" content="1200"><meta name="twitter:image:height" content="675">
<link rel="canonical" href="${sourceUrl}">
<a href="${pdp ? '/en/browse-author.php?a=456' : '/en/photographer/456'}"${pdp ? '' : ' class="profile-link"'}>${artist}${pdp ? '' : ' / 15 Images'}</a>
<dt>Status</dt><dd>Created by a human</dd>
<div class="view-license-card"><a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 Public Domain</a>${artist} @ PublicDomainPictures.net</div>
<div class="photo-descriptioninfo-main">${title}. The image is released free of copyrights under Creative Commons CC0.</div>`;
    const profile = `<title>${pdp ? `Free Public Domain Pictures by ${artist}` : `${artist} - Free Images & Free stock photos - PxHere`}</title>`;
    fs.writeFileSync(path.join(f.dir, 'creator.html'), profile);
    const reference = {
      ...f.reference,
      origin: `${site}-creator-cc0`,
      artist,
      title,
      license: 'CC0',
      sourceUrl,
      downloadUrl,
      width: 1200,
      height: 675,
      rightsEvidence: { path: 'source.html', sourceUrl },
      creatorEvidence: { path: 'creator.html', sourceUrl: creatorUrl, sha256: hash(profile) },
      originalReview: {
        rendition: pdp ? 'published-free-jpeg-rendition' : 'published-preview-jpeg-rendition',
      },
    };
    const check = (value) => {
      fs.writeFileSync(path.join(f.dir, 'source.html'), value);
      reference.rightsEvidence.sha256 = hash(value);
      return inspectCreatorCc0Reference(f.dir, reference).eligible;
    };
    assert.equal(check(html), true);
    for (const value of [
      html.replaceAll(artist, 'Another Photographer'),
      ...(pdp ? [html.replace('Created by a human', 'Generated with AI')] : []),
      html.replaceAll('publicdomain/zero/1.0/', 'licenses/by/4.0/'),
      html.replaceAll(
        downloadUrl,
        downloadUrl.replace('house.jpg', 'other.jpg').replace('abcdef', '111111'),
      ),
      html.replace(
        pdp
          ? 'Attribution is not required.'
          : 'released free of copyrights under Creative Commons CC0.',
        'Permission required.',
      ),
      html.replace(
        pdp ? '"width":1200' : 'content="1200"',
        pdp ? '"width":4032' : 'content="4032"',
      ),
      html.replaceAll(pdp ? '?a=456' : '/photographer/456', pdp ? '?a=999' : '/photographer/999'),
    ])
      assert.equal(check(value), false);
    assert.equal(check(html), true);
    reference.originalReview.rendition = 'native-original';
    assert.equal(check(html), false);
    reference.originalReview.rendition = pdp
      ? 'published-free-jpeg-rendition'
      : 'published-preview-jpeg-rendition';
    reference.creatorEvidence.sourceUrl = creatorUrl.replace('456', '999');
    assert.equal(check(html), false);
    reference.creatorEvidence.sourceUrl = creatorUrl;
    fs.writeFileSync(path.join(f.dir, 'creator.html'), `${profile} changed`);
    assert.equal(check(html), false);
    fs.writeFileSync(path.join(f.dir, 'creator.html'), profile);
    fs.writeFileSync(path.join(f.dir, reference.path), 'different pixels');
    assert.equal(check(html), false);
  });
}

test('an old Abdullah print needs the collection PD tag, matching period, creator and exact official native', (t) => {
  const f = fixture(t),
    sourceUrl = 'https://www.loc.gov/item/2003672034/',
    downloadUrl = 'https://tile.loc.gov/storage-services/master/pnp/cph/old-print.tif',
    commonsUrl = 'https://commons.wikimedia.org/wiki/File:Old_tower.jpg';
  const body =
    '|date={{between|1880|1893}}\n|source={{LOC-image|id=cph.3b46533}}\n|author={{Creator:Abdullah frères}}\n{{PD-Abdul Hamid}}';
  const rights = {
    query: {
      pages: {
        1: {
          revisions: [{ slots: { main: { '*': body } } }],
          imageinfo: [
            {
              descriptionurl: commonsUrl,
              extmetadata: {
                Artist: { value: 'Abdullah frères' },
                LicenseShortName: { value: 'Public domain' },
                UsageTerms: { value: 'Public domain' },
              },
            },
          ],
        },
      },
    },
  };
  const catalog = {
    item: {
      id: sourceUrl,
      access_restricted: false,
      group: ['abdul-hamid-ii'],
      rights_advisory: 'No known restrictions on publication.',
      contributor_names: ['Abdullah Fréres, photographer'],
      created_published: ['[between 1880 and 1893]'],
    },
    resources: [
      {
        url: 'https://www.loc.gov/resource/cph.3b46533/',
        files: [
          [
            {
              url: downloadUrl,
              mimetype: 'image/tiff',
              size: Buffer.byteLength('original pixels'),
            },
          ],
        ],
      },
    ],
  };
  const reference = {
    ...f.reference,
    origin: 'loc-abdul-hamid-public-domain',
    sourceUrl,
    downloadUrl,
    artist: 'Abdullah frères',
    rightsEvidence: { path: 'source.html', sourceUrl: commonsUrl },
    catalogEvidence: { path: 'catalog.json', sourceUrl: `${sourceUrl}?fo=json` },
    originalReview: { rendition: 'official-native-tiff' },
  };
  const check = (r = rights, c = catalog) => {
    const a = JSON.stringify(r),
      b = JSON.stringify(c);
    fs.writeFileSync(path.join(f.dir, 'source.html'), a);
    fs.writeFileSync(path.join(f.dir, 'catalog.json'), b);
    reference.rightsEvidence.sha256 = hash(a);
    reference.catalogEvidence.sha256 = hash(b);
    return inspectAbdulHamidReference(f.dir, reference).eligible;
  };
  assert.equal(check(), true);
  for (const [from, to] of [
    ['{{PD-Abdul Hamid}}', '{{PD-mark}}'],
    ['cph.3b46533', 'cph.other'],
    ['1880|1893', '1880|1993'],
    ['Creator:Abdullah frères', 'Creator:Someone else'],
    ['Public domain', 'CC BY 4.0'],
  ])
    assert.equal(check(JSON.parse(JSON.stringify(rights).replaceAll(from, to))), false);
  for (const change of [
    (c) => {
      c.item.created_published = ['[between 1920 and 1930]'];
    },
    (c) => {
      c.item.contributor_names.push('Private photographer');
    },
    (c) => {
      c.item.rights_advisory = 'Permission required.';
    },
    (c) => {
      c.resources[0].files[0][0].url += '?other';
    },
    (c) => {
      c.item.id = 'https://www.loc.gov/item/other/';
    },
  ]) {
    const c = structuredClone(catalog);
    change(c);
    assert.equal(check(rights, c), false);
  }
  assert.equal(check(), true);
  fs.writeFileSync(path.join(f.dir, reference.path), 'different bytes');
  assert.equal(check(), false);
});
