/** Check all imagery used by a model, including independently cleared gap-filling sources. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { inspectArchivedAuthorReference } from './imagery-archived-author.mjs';
import { inspectCarterExcavationReference } from './imagery-carter-excavation.mjs';
import { inspectChileIlustradoReference } from './imagery-chile-ilustrado.mjs';
import { inspectCommonsCreatorOriginal } from './imagery-commons-creator.mjs';
import { inspectDanishFortDrawingReference } from './imagery-danish-fort-drawings.mjs';
import {
  inspectDhakaEmbassyReference,
  inspectNewZealandEmbassyReference,
} from './imagery-embassy-flickr.mjs';
import { inspectEsplanadeArchive } from './imagery-esplanade-archive.mjs';
import { inspectExcavationPlanReference } from './imagery-excavation-plan.mjs';
import { inspectExpiredUsBookReference } from './imagery-expired-us-book.mjs';
import { inspectFlickrOriginalReference } from './imagery-flickr-original.mjs';
import { inspectGettyReference } from './imagery-getty.mjs';
import { inspectJacksonShrinePlate } from './imagery-jackson-shrine.mjs';
import { inspectCarpenterReference } from './imagery-loc-carpenter.mjs';
import { inspectMoranCartagenaReference } from './imagery-moran-cartagena.mjs';
import { inspectNdlTannaReference } from './imagery-ndl-tanna.mjs';
import { inspectNpsAgencyReference } from './imagery-nps-agency.mjs';
import { inspectImageryPolicy, PUBLIC_DOMAIN_POLICY } from './imagery-policy.mjs';
import { inspectQuallaPrimaryRights, modelRightsRoot } from './imagery-primary-rights.mjs';
import {
  inspectPublicArchiveReference,
  inspectYaleDuraBaptisteryPlan,
} from './imagery-public-archives.mjs';
import { inspectSilesianPeriodicalReference } from './imagery-silesian-periodical.mjs';
import { inspectTaganrogArchiveReference } from './imagery-taganrog-archive.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plainHash = (value) => (typeof value === 'string' ? value.replace(/^sha256:/, '') : null);
const plainText = (value) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim();
function snapshotJson(bytes) {
  try {
    return JSON.parse(bytes);
  } catch {
    return null;
  }
}

function inspectCanadianaOttawaEngraving(dir, reference) {
  const page = 'https://www.canadiana.ca/view/oocihm.8_06230_382/2';
  const imageUrl =
    'https://image-tor.canadiana.ca/iiif/2/69429%2Fc0hm52h8hb05/full/max/0/default.jpg';
  const archive = localBytes(dir, reference.rightsEvidence?.path);
  const image = localBytes(dir, reference.path);
  const expectedHash = 'a012c802445f49a551740e8191604d0f03c6ab47db28e8568482247b44f2d052';
  const review = reference.originalReview;
  const text = archive?.toString();
  const bound =
    image &&
    digest(image) === expectedHash &&
    plainHash(reference.sha256) === expectedHash &&
    archive &&
    digest(archive) === plainHash(reference.rightsEvidence?.sha256);
  const documented =
    reference.origin === 'canadiana-1877-library-engraving' &&
    reference.sourceUrl === page &&
    reference.rightsEvidence?.sourceUrl === page &&
    reference.downloadUrl === imageUrl &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    review?.status === 'inspected' &&
    review?.publicationDate === '1877-03-10' &&
    review?.printedPage === 145 &&
    text?.includes('[Vol. 15, no. 10 (Mar. 10, 1877)]') &&
    text.includes(`href="${imageUrl}" target="_blank">p. 145</a>`);
  const blockers = [];
  if (!bound) blockers.push('supplemental-image-or-archive-bytes-unbound');
  if (!documented) blockers.push('supplemental-canadiana-original-publication-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}
function localBytes(dir, relative) {
  if (
    typeof relative !== 'string' ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).includes('..')
  )
    return null;
  const file = path.resolve(dir, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const actual = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  if (path.isAbsolute(actual) || actual === '..' || actual.startsWith(`..${path.sep}`)) return null;
  return fs.readFileSync(file);
}

/** State Library of NSW's catalogued scan of James Barnet's 1885 sheet. */
function inspectBarnetLighthousePlan(dir, reference) {
  const page = 'https://www.sl.nsw.gov.au/collection-items/macquarie-lighthouse-south-head-1885';
  const scanPath =
    '/sites/default/files/styles/max_2600x2600/public/6.3_a2151019.jpg?itok=TYnlYo3R';
  const expectedHash = '005b0c0e3aacfd63e85ddb45a8724a1a05e2983b58445ee503a22e78a5bb3dc6';
  const image = localBytes(dir, reference.path);
  const snapshot = localBytes(dir, reference.rightsEvidence?.path);
  const record = snapshot?.toString('utf8');
  const rightsLabel = record?.match(
    /Copyright information:\s*<\/div>\s*<div[^>]*>\s*<p>([^<]+)<\/p>/i,
  )?.[1];
  const blockers = [];
  if (
    !image ||
    digest(image) !== expectedHash ||
    plainHash(reference.sha256) !== expectedHash ||
    !snapshot ||
    digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256)
  )
    blockers.push('supplemental-image-or-archive-bytes-unbound');
  if (
    reference.sourceUrl !== page ||
    reference.rightsEvidence?.sourceUrl !== page ||
    reference.downloadUrl !== `https://www.sl.nsw.gov.au${scanPath}` ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'James Johnstone Barnet' ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'library-published-2597px-scan' ||
    reference.visuallyReviewedForThisPolicy !== true ||
    !record?.includes(`<link rel="canonical" href="${page}"`) ||
    !record.includes(`${scanPath} 2x`) ||
    !record.includes('Plan section and elevation of Macquarie Lighthouse South Head, 1885') ||
    !record.includes('Barnet, James Johnstone, 1827-1904') ||
    !record.includes('/Details/archive/110312182" target="_blank"> PXD 784 / 1 </a>') ||
    rightsLabel?.trim() !== 'Out of copyright.&nbsp;'
  )
    blockers.push('supplemental-barnet-lighthouse-plan-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** FHWA gallery releases corroborated against the original NARA transfer. */
function inspectFhwaBywaysReference(dir, reference) {
  const image = localBytes(dir, reference.path);
  const rights = localBytes(dir, reference.rightsEvidence?.path);
  const proof = snapshotJson(rights);
  const native = proof?.native;
  const info = native?.imageinfo?.[0];
  const revision = native?.revisions?.[0];
  const originalText = revision?.slots?.main?.content ?? '';
  const byway = reference.sourceUrl?.match(
    /^https:\/\/fhwaapps\.fhwa\.dot\.gov\/bywaysp\/Photos\?bywayId=(\d+)$/,
  )?.[1];
  const filename = reference.downloadUrl?.match(
    /^https:\/\/fhwaapps\.fhwa\.dot\.gov\/bywaysp\/uploads\/asset_files\/(\d+)\/([\w.-]+\.jpe?g)$/i,
  );
  const archive = native?.title?.match(/ - NARA - (\d+)\.jpe?g$/i)?.[1];
  const credit = `Public Domain. Photo by ${reference.artist}`;
  const card = [...String(proof?.record ?? '').matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map(([html]) => html)
    .find((html) => html.includes(`href="${reference.downloadUrl}"`));
  const copyright = card?.match(/<div class="copyright">([\s\S]*?)<\/div>/i)?.[1];
  const blockers = [];
  if (
    !image ||
    digest(image) !== plainHash(reference.sha256) ||
    !rights ||
    digest(rights) !== plainHash(reference.rightsEvidence?.sha256) ||
    proof?.sha256 !== reference.sha256 ||
    image.length !== info?.size ||
    createHash('sha1').update(image).digest('hex') !== info.sha1
  )
    blockers.push('supplemental-fhwa-original-bytes-unbound');
  if (
    !byway ||
    filename?.[1] !== byway ||
    proof?.file !== reference.downloadUrl ||
    proof?.listing !== reference.sourceUrl ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    reference.license !== 'Public domain' ||
    !reference.artist ||
    plainText(copyright) !== credit ||
    !archive ||
    info?.user !== 'US National Archives bot' ||
    revision?.user !== 'US National Archives bot' ||
    revision.parentid !== 0 ||
    info.extmetadata?.LicenseShortName?.value !== 'Public domain' ||
    !new RegExp(`\\|\\s*NAID\\s*=\\s*${archive}(?:\\s|$)`).test(originalText) ||
    !originalText.includes('{{PD-USGov}}') ||
    !originalText.includes(`Status: Public domain. Photo by ${reference.artist}`) ||
    reference.visuallyReviewedForThisPolicy !== true ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'agency-published-image'
  )
    blockers.push('supplemental-fhwa-individual-release-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** The Museum of Gothenburg's individually marked archive image from the 1923 exhibition. */
function inspectGothenburgKarnellPhoto(dir, reference) {
  const archive = 'https://carlotta.goteborgsstadsmuseum.se/carlotta/web';
  const source = `${archive}/object/353930`;
  const download = `${archive}/image/zoom/1719974/GhmE:5165.jpg`;
  const expected = 'd1bf17e22d26af0884b9b75e841a66381f369eddf5685c389fd0a7fa569aa047';
  const image = localBytes(dir, reference.path);
  const catalog = localBytes(dir, reference.rightsEvidence?.path);
  const html = catalog?.toString() ?? '';
  const eligible =
    !!image &&
    digest(image) === expected &&
    plainHash(reference.sha256) === expected &&
    !!catalog &&
    digest(catalog) === plainHash(reference.rightsEvidence?.sha256) &&
    html.includes(`property="og:image" content="${download}"`) &&
    html.includes(`property="og:url" content="${source}"`) &&
    html.includes('Karnell, Anders Wilhelm, 1871-1934') &&
    html.includes('Jubileumsutställningen 1923 med  Götaplatsen och Konstmuseet') &&
    html.includes('>Public Domain Mark</a>') &&
    html.includes('creativecommons.org/publicdomain/mark/1.0/') &&
    reference.sourceUrl === source &&
    reference.rightsEvidence?.sourceUrl === source &&
    reference.downloadUrl === download &&
    reference.artist === 'Anders Wilhelm Karnell' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'museum-catalogue-image';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-gothenburg-karnell-photo-unverified'],
  };
}

/** Art in Flanders' individually released digitization of the museum's postcard. */
function inspectAntwerpMuseumPostcard(dir, reference) {
  const source = 'https://artinflanders.be/en/artwork/postcard-view-museum';
  const file =
    '5c27139fdd6347dfa9dc58014be140eb6f83831bb2a44ede8d88ad74c1c3e6d677ef5a1b257f4befae74ac16c9dae6af.jpg';
  const expected = '9876df1d67f8eeec463061bb612626d508944408c06eaa3a71e758c0f90085d6';
  const image = localBytes(dir, reference.path);
  const catalog = localBytes(dir, reference.rightsEvidence?.path);
  const html = catalog?.toString() ?? '';
  const caption =
    'postcard view from the museum, by unknown, collection KMSKA, artinflanders.be, photo: Hugo Maertens, public domain.';
  const eligible =
    !!image &&
    digest(image) === expected &&
    plainHash(reference.sha256) === expected &&
    !!catalog &&
    digest(catalog) === plainHash(reference.rightsEvidence?.sha256) &&
    html.includes(`/styles/artwork_cover_image_detail/public/artwork/${file}?`) &&
    html.includes('photo_number=0030979000&amp;licence_number=public%20domain') &&
    html.includes('8911n9pc2r') &&
    html.includes(caption) &&
    reference.sourceUrl === source &&
    reference.rightsEvidence?.sourceUrl === source &&
    reference.downloadUrl === `https://artinflanders.be/sites/default/files/artwork/${file}` &&
    reference.artist === 'Hugo Maertens (digitization), KMSKA' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'institutional-postcard-scan';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-antwerp-museum-postcard-unverified'],
  };
}

/** Two individually marked public-domain postcards from the National Museum of Taiwan History. */
function inspectKaohsiungCityHallPostcard(dir, reference) {
  const records = {
    '2001.008.0597': {
      member: '20010080597_P001.jpg',
      image: 'cddc142cfc1d6579ecdd64a80e10d1e68227c28efbce4c1ac55f25a9101b7529',
      metadata: 'adfccabb9131e5748c542cc195280901c40dcb33ba5af2952266f48a4e1e7f4c',
      archive: '582c261d0f3aa223e16d9066984629ff1ef77bd5e97b8bb089a591db65f5418a',
      imprint: '昭和十五年二月十三日',
    },
    '2002.007.0274': {
      member: '20020070274_I001.jpg',
      image: '367735c1a97510f957fee1fa8ae1eb17380bbeca9cd1ba3c5ea96ca1d31d06e8',
      metadata: '2560a16e6048f1a082948bb7db9050ec36ff68201c3d8cc052a0ea0293021621',
      archive: '203259e3c1d2555fdfdfae501637544c6a474846635f8ddd2463a8c3d4de8cf2',
      imprint: '昭和十四年五月十二日',
    },
  };
  const accession = reference.accession;
  const known = Object.hasOwn(records, accession) ? records[accession] : null;
  const source = `https://collections.nmth.gov.tw/CollectionContent.aspx?a=132&rno=${accession}`;
  const image = localBytes(dir, reference.path);
  const proof = localBytes(dir, reference.rightsEvidence?.path);
  const record = snapshotJson(proof);
  const eligible =
    !!known &&
    !!image &&
    digest(image) === known.image &&
    plainHash(reference.sha256) === known.image &&
    !!proof &&
    digest(proof) === plainHash(reference.rightsEvidence?.sha256) &&
    record?.accession === accession &&
    record.catalogue === source &&
    record.member === known.member &&
    plainHash(record.archiveSha256) === known.archive &&
    typeof record.nativeMetadata === 'string' &&
    digest(record.nativeMetadata) === known.metadata &&
    record.nativeMetadata.includes('高雄市役所') &&
    record.nativeMetadata.includes(known.imprint) &&
    typeof record.release === 'string' &&
    record.release.includes('images/cc-licensed/PDM.png') &&
    record.release.includes('因著作年代久遠或超過著作權法保護時效，已進入公眾領域。') &&
    reference.sourceUrl === source &&
    reference.rightsEvidence?.sourceUrl === source &&
    reference.downloadUrl === `${source}#ctl00_ContentPlaceHolder1_aOpenDataZip` &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'institutional-postcard-scan';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-kaohsiung-museum-postcard-unverified'],
  };
}

/** Plate I in the museum's own 1925 catalogue, marked PDM by the National Diet Library. */
function inspectLushunMuseumPlate(dir, reference) {
  const archive = 'https://dl.ndl.go.jp/api/iiif/925883';
  const source = 'https://ndlsearch.ndl.go.jp/books/R100000002-I000000547112';
  const download = `${archive}/R0000004/full/full/0/default.jpg`;
  const expected = 'd6ffebead3cc52386ebc0732e11774b341faafe68bc4fcc689f63c13c5025e85';
  const image = localBytes(dir, reference.path);
  const manifest = localBytes(dir, reference.rightsEvidence?.path);
  const catalog = localBytes(dir, reference.catalogEvidence?.path);
  const facing = localBytes(dir, reference.captionEvidence?.path);
  const record = snapshotJson(manifest);
  const metadata = new Map((record?.metadata ?? []).map((field) => [field.label, field.value]));
  const canvas = record?.sequences?.[0]?.canvases?.[3];
  const eligible =
    !!image &&
    digest(image) === expected &&
    plainHash(reference.sha256) === expected &&
    !!manifest &&
    digest(manifest) === plainHash(reference.rightsEvidence?.sha256) &&
    !!catalog &&
    digest(catalog) === plainHash(reference.catalogEvidence?.sha256) &&
    catalog.toString().includes('"pdm"') &&
    catalog.toString().includes('10.11501/925883') &&
    !!facing &&
    digest(facing) === 'f5d546761be6a825f3222b12ce9d3f39c4f06e9f77e7d17e90ad7e42352399ba' &&
    digest(facing) === plainHash(reference.captionEvidence?.sha256) &&
    metadata.get('Persistent ID') === 'info:ndljp/pid/925883' &&
    metadata.get('Title') === '[関東庁]博物館陳列品図譜' &&
    metadata.get('Publisher') === '関東庁博物館' &&
    metadata.get('Publication Date (W3CDTF fortmat)') === '1925' &&
    metadata.get('Access Restrictions') === 'PDM' &&
    canvas?.['@id'] === `${archive}/canvas/4` &&
    canvas.images?.[0]?.resource?.['@id'] === download &&
    reference.sourceUrl === source &&
    reference.downloadUrl === download &&
    reference.rightsEvidence?.sourceUrl === `${archive}/manifest.json` &&
    reference.catalogEvidence?.sourceUrl === source &&
    reference.captionEvidence?.sourceUrl === `${archive}/R0000003/full/full/0/default.jpg` &&
    reference.artist === 'Kwantung Government Museum (publisher)' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'original-print-scan' &&
    reference.originalReview?.printedPlate === 'I';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-lushun-museum-plate-unverified'],
  };
}

/** The University of Hawaiʻi's two-sided scan of the original Japanese hotel postcard. */
function inspectNaraHotelPostcard(dir, reference) {
  const archive = 'https://digital.library.manoa.hawaii.edu';
  const itemUrl = `${archive}/api/items/43772`;
  const filesUrl = `${archive}/api/files?item=43772`;
  const source = `${archive}/items/show/43772`;
  const download = `${archive}/files/original/c04edf499e4d7915ec983cfdf918a164.jpg`;
  const image = localBytes(dir, reference.path);
  const imageHash = '3c7a494db4a3490bb1d1a9da0599a217fd1708520aed487d56384d068edacaaa';
  const bound = (record) => {
    const bytes = localBytes(dir, record?.path);
    return bytes && digest(bytes) === plainHash(record?.sha256) ? bytes : undefined;
  };
  const item = snapshotJson(bound(reference.rightsEvidence));
  const files = snapshotJson(bound(reference.catalogEvidence));
  const reverse = bound(reference.reverseEvidence);
  const japan = plainText(bound(reference.japanEvidence)?.toString() ?? '');
  const restoration = plainText(bound(reference.restorationEvidence)?.toString() ?? '');
  const field = (key) => item?.element_texts?.find((v) => v.element?.name === key)?.text;
  const eligible =
    !!image &&
    digest(image) === imageHash &&
    plainHash(reference.sha256) === imageHash &&
    !!reverse &&
    digest(reverse) === 'a05e8e0cb1ba71ab19f9b79328f5e0ecdb1e1b56274c6bd42b9abf2c4ad0cc2e' &&
    item?.id === 43772 &&
    item.public === true &&
    item.item_type?.name === 'Postcard' &&
    item.files?.url === filesUrl &&
    field('Identifier') === 'PS731' &&
    field('Title') === 'Nara Hotel' &&
    field('Date') === 'c. 1918-1932' &&
    field('Description')?.includes('Nara Hotel, The Ancient Capital. Nara. The Best in Japan.') &&
    Array.isArray(files) &&
    files.some(
      (file) =>
        file.item?.url === itemUrl &&
        file.original_filename === 'ps731a.jpg' &&
        file.file_urls?.original === download &&
        file.size === image.length,
    ) &&
    files.some(
      (file) =>
        file.item?.url === itemUrl &&
        file.original_filename === 'ps731b.jpg' &&
        file.file_urls?.original === reference.reverseEvidence?.sourceUrl &&
        file.size === reverse.length,
    ) &&
    japan.includes(
      'The term of protection for photographs published no later than 1957 is considered to have expired',
    ) &&
    restoration.includes(
      'were protected by copyright or neighboring rights in the source country',
    ) &&
    reference.sourceUrl === source &&
    reference.downloadUrl === download &&
    reference.rightsEvidence?.sourceUrl === itemUrl &&
    reference.catalogEvidence?.sourceUrl === filesUrl &&
    reference.japanEvidence?.sourceUrl === 'https://www.ndl.go.jp/en/help/utilizing' &&
    reference.restorationEvidence?.sourceUrl === 'https://www.copyright.gov/gatt.html' &&
    reference.artist === 'Nara Hotel (postcard imprint)' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'original-postcard-scan';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-nara-hotel-postcard-unverified'],
  };
}

/** Library of Congress service scan of the Detroit Publishing panorama registered in 1901. */
function inspectDetroitMackinacPanorama(dir, reference) {
  const itemId = '2016800770';
  const panel = '4a06088';
  const source = `https://www.loc.gov/item/${itemId}/`;
  const download = `https://tile.loc.gov/storage-services/service/pnp/det/4a00000/4a06000/4a06000/${panel}v.jpg`;
  const rightsUrl = 'https://wwws.loc.gov/rr/print/res/102_det.html';
  const expected = '9cee1fb083b8e64bae8facfe691ecfc10b82602020ecd96eca8798c61ce33c58';
  const image = localBytes(dir, reference.path);
  const rights = localBytes(dir, reference.rightsEvidence?.path);
  const catalog = localBytes(dir, reference.catalogEvidence?.path);
  const record = snapshotJson(catalog);
  const item = record?.item;
  const creators = item?.item?.creators ?? [];
  const resources = (record?.resources ?? []).flatMap((r) => (r.files ?? []).flat());
  const eligible =
    !!image &&
    digest(image) === expected &&
    plainHash(reference.sha256) === expected &&
    !!rights &&
    digest(rights) === plainHash(reference.rightsEvidence?.sha256) &&
    plainText(rights.toString()).includes(
      'Those published more than 95 years ago are in the public domain.',
    ) &&
    !!catalog &&
    digest(catalog) === plainHash(reference.catalogEvidence?.sha256) &&
    item?.item?.id === itemId &&
    item.item.created_published === 'c1901.' &&
    item.item.rights_advisory === 'No known restrictions on publication.' &&
    item.item.digital_id?.includes(`det ${panel} https://hdl.loc.gov/loc.pnp/det.${panel}`) &&
    creators.some((c) => c.role === 'publisher' && c.title === 'Detroit Publishing Co.') &&
    creators.some((c) => c.role === 'copyright claimant' && c.title === 'Detroit Publishing Co.') &&
    resources.some(
      (f) => f.url === download && f.mimetype === 'image/jpeg' && f.size === image.length,
    ) &&
    reference.sourceUrl === source &&
    reference.downloadUrl === download &&
    reference.rightsEvidence?.sourceUrl === rightsUrl &&
    reference.catalogEvidence?.sourceUrl === `${source}?fo=json` &&
    reference.artist === 'Detroit Publishing Company' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'library-service-scan-from-negative';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-detroit-mackinac-panorama-unverified'],
  };
}

/** Richard Hanitsch's signed photograph in the National Library Board's 1908 guide. */
function inspectRafflesLibraryPlate(dir, reference) {
  const archive = 'Guidezoological00Nati';
  const page = 'https://www.biodiversitylibrary.org/page/47142049';
  const metadataUrl = `https://archive.org/metadata/${archive}`;
  const fileUrl = `https://archive.org/download/${archive}/page/n5.jpg`;
  const expected = 'c1f98399148ee9ce85d85a0ff35adc0fe66eb9fa330a1989c982058478050f9d';
  const photo = localBytes(dir, reference.path);
  const catalogue = localBytes(dir, reference.rightsEvidence?.path);
  const index = localBytes(dir, reference.pageIndexEvidence?.path);
  const metadata = snapshotJson(catalogue)?.metadata;
  const indexText = index?.toString('utf8') ?? '';
  const eligible =
    !!photo &&
    digest(photo) === expected &&
    plainHash(reference.sha256) === expected &&
    !!catalogue &&
    digest(catalogue) === plainHash(reference.rightsEvidence?.sha256) &&
    !!index &&
    digest(index) === plainHash(reference.pageIndexEvidence?.sha256) &&
    /<mets:div TYPE="page" ORDER="6" LABEL="PLATE I">\s*<mets:fptr FILEID="pageImg47142049"\s*\/>/.test(
      indexText,
    ) &&
    indexText.includes(`xlink:href="${page}"`) &&
    metadata?.identifier === archive &&
    metadata.title === 'Guide to the zoological collections of the Raffles Museum, Singapore' &&
    metadata.date === '1908' &&
    metadata.publisher === 'Singapore : Printed by the Straits Times Press' &&
    metadata.contributor === 'National Library Board, Singapore' &&
    Array.isArray(metadata.creator) &&
    metadata.creator.includes('Hanitsch, R') &&
    metadata['possible-copyright-status'] ===
      'Public domain. The BHL considers that this work is no longer under copyright protection.' &&
    reference.sourceUrl === page &&
    reference.downloadUrl === fileUrl &&
    reference.rightsEvidence?.sourceUrl === metadataUrl &&
    reference.pageIndexEvidence?.sourceUrl ===
      `https://archive.org/download/${archive}/${archive}_bhlmets.xml` &&
    reference.license === 'Public domain' &&
    reference.artist === 'Richard Hanitsch' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'original-print-scan' &&
    reference.originalReview?.printedPlate === 'I';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-raffles-library-plate-unverified'],
  };
}

/** Edmund Körner's measured drawings as printed in the 1914 Berlin monograph. */
function inspectEssenSynagogueDrawings(dir, reference) {
  const id = 'dieneuesynagogei00klap';
  const download = `https://archive.org/download/${id}/${id}.pdf`;
  const pdf = localBytes(dir, reference.path);
  const rights = localBytes(dir, reference.rightsEvidence?.path);
  const { metadata, files } = snapshotJson(rights) ?? {};
  const original = files?.find((file) => file.name === `${id}.pdf`);
  const review = reference.originalReview;
  const hash = '2a6df2515738803d6b99bb4c30d326d2504e62f1a37f338485ed2411a411d2dd';
  const eligible =
    !!pdf &&
    pdf.subarray(0, 5).toString() === '%PDF-' &&
    digest(pdf) === hash &&
    plainHash(reference.sha256) === hash &&
    Number(original?.size) === pdf.length &&
    original.sha1 === createHash('sha1').update(pdf).digest('hex') &&
    !!rights &&
    digest(rights) === plainHash(reference.rightsEvidence?.sha256) &&
    metadata?.identifier === id &&
    metadata?.date === '1914' &&
    metadata?.publisher === 'Berlin : E. Wasmuth' &&
    metadata?.contributor === 'United States Holocaust Memorial Museum, Rare Book Collection' &&
    Array.isArray(metadata?.creator) &&
    metadata.creator.some(
      (creator) => typeof creator === 'string' && creator.normalize('NFC') === 'Körner, Edmund',
    ) &&
    metadata?.['possible-copyright-status'] ===
      'The USHMM is unaware of any copyright restrictions for this item.' &&
    reference.sourceUrl === `https://archive.org/details/${id}` &&
    reference.downloadUrl === download &&
    reference.rightsEvidence?.sourceUrl === `https://archive.org/metadata/${id}` &&
    reference.artist === 'Edmund Körner (1874–1940)' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    review?.status === 'inspected' &&
    review?.rendition === 'native-original-pdf' &&
    review?.publicationYear === 1914 &&
    review?.creatorDied === 1940 &&
    [13, 42, 112, 119, 125, 128, 133].every((page) => review.pagesInspected?.includes(page));
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-essen-synagogue-drawings-unverified'],
  };
}

/** The contemporary published Wardenclyffe tower photograph on page 23760. */
function inspectWardenclyffeScientificAmerican(dir, reference) {
  const id = 'sim_scientific-american-supplement_1904-06-04_57_1483';
  const pdf = localBytes(dir, reference.path);
  const record = localBytes(dir, reference.rightsEvidence?.path);
  const { metadata, files } = snapshotJson(record) ?? {};
  const original = files?.find((file) => file.name === `${id}.pdf`);
  const review = reference.originalReview;
  const hash = 'a436dbef745e3d26edb249931ba10d527e7d22df80d85c4884966b5867c2e43e';
  const eligible =
    !!pdf &&
    pdf.subarray(0, 5).toString() === '%PDF-' &&
    digest(pdf) === hash &&
    plainHash(reference.sha256) === hash &&
    Number(original?.size) === pdf.length &&
    original.sha1 === createHash('sha1').update(pdf).digest('hex') &&
    !!record &&
    digest(record) === plainHash(reference.rightsEvidence?.sha256) &&
    metadata?.identifier === id &&
    metadata?.date === '1904-06-04' &&
    metadata?.volume === '57' &&
    metadata?.issue === '1483' &&
    reference.sourceUrl === `https://archive.org/details/${id}/page/n3/mode/1up` &&
    reference.downloadUrl === `https://archive.org/download/${id}/${id}.pdf` &&
    reference.rightsEvidence?.sourceUrl === `https://archive.org/metadata/${id}` &&
    reference.artist === 'Uncredited photographer, Scientific American Supplement' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    review?.status === 'inspected' &&
    review?.rendition === 'native-original-pdf' &&
    review?.publicationYear === 1904 &&
    review?.printedPage === 23760 &&
    review?.figureNumber === 2;
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-wardenclyffe-1904-photograph-unverified'],
  };
}

const naipCrops = {
  'usda-naip-gainesville-2023-stadium': {
    id: 'fl_m_2908222_sw_17_030_20230126_20230511',
    datetime: '2023-01-26T16:00:00Z',
    resolution: 0.3,
    directory: 'fl/2023/fl_030cm_2023/29082',
    file: 'm_2908222_sw_17_030_20230126_20230511.tif',
    export: '-82.3513,29.6484,-82.3469,29.6516/1150x960.png',
    sha256: '4335c4b6e56d1b5bcca7e2d56360c962bbcb460939ac349b45d0b8535a4a77a2',
    blocker: 'supplemental-gainesville-naip-crop-unverified',
  },
  'usda-naip-thomasville-2023-house': {
    id: 'ga_m_3008309_nw_17_060_20231018_20240103',
    datetime: '2023-10-18T16:00:00Z',
    resolution: 0.6,
    directory: 'ga/2023/ga_060cm_2023/30083',
    file: 'm_3008309_nw_17_060_20231018_20240103.tif',
    export: '-83.9835,30.84518,-83.9823,30.8462.png',
    sha256: '1894308fa8b1f3ceb36a791d6de7f212e23f04a9ca06e68fc98883924eb99c8b',
    blocker: 'supplemental-thomasville-naip-crop-unverified',
  },
  'usda-naip-fort-hays-2023': {
    id: 'ks_m_3809914_nw_14_030_20230814_20231113',
    datetime: '2023-08-14T16:00:00Z',
    resolution: 0.3,
    directory: 'ks/2023/ks_030cm_2023/38099',
    file: 'm_3809914_nw_14_030_20230814_20231113.tif',
    export: '-99.34460,38.86140,-99.34197,38.86296.png',
    sha256: 'b730cffc1aafe33ce5ce171ce3ba4da5444c35db44758fcf0d246ea000ad0d4a',
    blocker: 'supplemental-fort-hays-naip-crop-unverified',
  },
  'usda-naip-swiftsure-2023': {
    id: 'wa_m_4712222_sw_10_060_20231007_20240209',
    datetime: '2023-10-07T16:00:00Z',
    resolution: 0.6,
    directory: 'wa/2023/wa_060cm_2023/47122',
    file: 'm_4712222_sw_10_060_20231007_20240209.tif',
    export: '-122.33732,47.62775,-122.33615,47.62858.png',
    sha256: '19b4ba71d38d813bb7ff19f2f3a69cce794f9669d7c6c9e569f0ea5375c6ff92',
    blocker: 'supplemental-swiftsure-naip-crop-unverified',
  },
  'usda-naip-ponce-casino-2022': {
    id: 'pr_m_1806660_sw_19_030_20221016_20230329',
    datetime: '2022-10-16T16:00:00Z',
    resolution: 0.3,
    directory: 'pr/2022/pr_030cm_2022/18066/60',
    file: 'm_1806660_sw_19_030_20221016_20230329.tif',
    export: '-66.61357,18.00972,-66.61237,18.01062.png',
    sha256: '811b1b0ab462b2cb0a89ac8a2c3f1d78ba8ddc3678d7afa4330f144008b4684e',
    blocker: 'supplemental-ponce-casino-naip-crop-unverified',
  },
};

/** Verify the published US Department of Agriculture item and the exact inspected crop. */
function inspectNaipReference(dir, reference) {
  const crop = naipCrops[reference.origin];
  const itemUrl = `https://planetarycomputer.microsoft.com/api/stac/v1/collections/naip/items/${crop.id}`;
  const exportUrl =
    `https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/${crop.export}` +
    `?collection=naip&item=${crop.id}&assets=image&bidx=1&bidx=2&bidx=3`;
  const image = localBytes(dir, reference.path);
  const snapshot = localBytes(dir, reference.rightsEvidence?.path);
  const item = snapshotJson(snapshot);
  const eligible =
    !!image &&
    digest(image) === crop.sha256 &&
    plainHash(reference.sha256) === crop.sha256 &&
    !!snapshot &&
    digest(snapshot) === plainHash(reference.rightsEvidence?.sha256) &&
    item?.id === crop.id &&
    item?.collection === 'naip' &&
    item?.properties?.datetime === crop.datetime &&
    item.properties.gsd === crop.resolution &&
    item.properties.providers?.some(
      ({ name, roles }) => name === 'USDA Farm Service Agency' && roles?.includes('licensor'),
    ) &&
    item.assets?.image?.href ===
      `https://naipeuwest.blob.core.windows.net/naip/v002/${crop.directory}/${crop.file}` &&
    reference.artist === 'USDA Farm Service Agency' &&
    reference.license === 'Public domain' &&
    reference.sourceUrl === itemUrl &&
    reference.rightsEvidence?.sourceUrl === itemUrl &&
    reference.downloadUrl === exportUrl &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'native-item-natural-color-crop';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : [crop.blocker],
  };
}

const swiftsureSurveyImages = {
  'sheet/00001v.jpg': {
    resource: 'sheet/?sp=1',
    creator: 'U.S. Office of the Light-House Board',
    credit: 'U.S. Office of the Light-House Board',
    sha256: 'da3893bb4fc8c2778a500199f168938de6b18e66317252d741c2266034ef890d',
  },
  'sheet/00004v.jpg': {
    resource: 'sheet/?sp=4',
    creator: 'U.S. Office of the Light-House Board',
    credit: 'U.S. Office of the Light-House Board',
    sha256: '48bbddc0cf81aa592f1159d32473588ed3ef913d68a2f368a4ee3aeb28ed552a',
  },
  'photos/204356pv.jpg': {
    resource: 'photos/?sp=1',
    creator: 'Lowe, Jet, photographer',
    credit: 'Jet Lowe, Historic American Engineering Record',
    sha256: '199e243dc39fdf3ae3b674fdbc5400f694279185c8b3905837cddbbede74a7c0',
  },
};

/** Match the reviewed federal drawings or the specifically credited staff photograph. */
function inspectSwiftsureSurveyImage(dir, reference) {
  const imageRoot = 'https://tile.loc.gov/storage-services/service/pnp/habshaer/wa/wa0700/wa0747/';
  const archive = 'https://www.loc.gov/resource/hhh.wa0747.';
  const file = reference.downloadUrl?.startsWith(imageRoot)
    ? reference.downloadUrl.slice(imageRoot.length)
    : '';
  const expected = Object.hasOwn(swiftsureSurveyImages, file) && swiftsureSurveyImages[file];
  const image = localBytes(dir, reference.path);
  const rights = localBytes(dir, reference.rightsEvidence?.path);
  const catalogBytes = localBytes(dir, reference.catalogEvidence?.path);
  const catalog = snapshotJson(catalogBytes);
  const eligible =
    !!expected &&
    !!image &&
    digest(image) === expected.sha256 &&
    plainHash(reference.sha256) === expected.sha256 &&
    !!rights &&
    digest(rights) === plainHash(reference.rightsEvidence?.sha256) &&
    reference.rightsEvidence?.sourceUrl === 'https://wwws.loc.gov/rr/print/res/114_habs.html' &&
    plainText(rights.toString()).includes(
      'created for the U.S. Government and are considered to be in the public domain',
    ) &&
    !!catalogBytes &&
    digest(catalogBytes) === plainHash(reference.catalogEvidence?.sha256) &&
    catalog?.item?.contributor_names?.includes(expected.creator) &&
    catalog.item.rights_advisory?.includes(
      'No known restrictions on images made by the U.S. Government',
    ) &&
    reference.sourceUrl === archive + expected.resource &&
    catalog.segments?.some(
      (segment) =>
        segment.url === reference.sourceUrl &&
        segment.title.includes('Lightship No. 83') &&
        segment.image_url?.some((url) => url.split('#')[0] === reference.downloadUrl),
    ) &&
    reference.artist === expected.credit &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-swiftsure-federal-survey-image-unverified'],
  };
}

const tobolskPrints = {
  'https://www.loc.gov/item/2018689690/': {
    download:
      'https://tile.loc.gov/image-services/iiif/public:gdc:2018689690:npc00214/full/pct:100.0/0/default.jpg',
    record: 'https://www.loc.gov/item/2018689690/?fo=json',
    credit: 'A. V. Januszkiewicz (publisher)',
    hash: '18ae36135adfce5dca93a440c2c8b9262eb124c2149e0466d90dfb0139941d78',
    check: (doc) =>
      doc?.item?.number_lccn?.includes('2018689690') &&
      doc.item.created_published?.some((row) => row.endsWith('1904-1917.')) &&
      doc.item.notes?.includes('Original image at: National Library of Russia'),
  },
  'https://www.loc.gov/item/2007683265/': {
    download: 'https://cdn.loc.gov/service/pnp/ppmsca/15700/15749v.jpg',
    record: 'https://www.loc.gov/item/2007683265/?fo=json',
    credit: 'Underwood & Underwood',
    hash: '70411c11d7dd50b59f95ef9c608d2987d03be7d3a306f8bb81864dffb2aee89c',
    check: (doc) =>
      doc?.item?.number_lccn?.includes('2007683265') &&
      doc.item.notes?.includes('Copyright deposit; 1921.') &&
      doc.item.rights_advisory === 'No known restrictions on publication.',
  },
  'https://archive.org/details/lifetragedyofale00sofi/page/n348/mode/1up': {
    download: 'https://archive.org/download/lifetragedyofale00sofi/page/n348.jpg',
    record: 'https://archive.org/metadata/lifetragedyofale00sofi',
    credit: 'Longmans, Green and Co. (publisher)',
    hash: 'e2e58fcd3dba7b67aeccf7689bc76300f437c621f7337130de547c0ab6384102',
    check: (doc) =>
      doc?.metadata?.identifier === 'lifetragedyofale00sofi' &&
      doc.metadata.contributor === 'UCLA Library, Preservation Department' &&
      doc.metadata.publisher?.includes('Longmans, Green and co.'),
  },
};

/** Tie the three individually dated mansion views to their original print editions. */
function inspectTobolskPrint(dir, reference) {
  const expected =
    Object.hasOwn(tobolskPrints, reference.sourceUrl) && tobolskPrints[reference.sourceUrl];
  const image = localBytes(dir, reference.path);
  const record = localBytes(dir, reference.rightsEvidence?.path);
  const titleLeaf = reference.sourceUrl?.startsWith('https://archive.org/')
    ? localBytes(dir, reference.catalogEvidence?.path)
    : undefined;
  const eligible =
    !!expected &&
    !!image &&
    !!record &&
    digest(image) === expected.hash &&
    plainHash(reference.sha256) === expected.hash &&
    digest(record) === plainHash(reference.rightsEvidence?.sha256) &&
    reference.rightsEvidence?.sourceUrl === expected.record &&
    expected.check(snapshotJson(record)) &&
    reference.downloadUrl === expected.download &&
    reference.artist === expected.credit &&
    reference.license === 'Public domain' &&
    (!reference.sourceUrl.startsWith('https://archive.org/') ||
      (!!titleLeaf &&
        digest(titleLeaf) === 'c2cbe67c51dd7e8665c7b7b8cb5df761dc0a656e8fcca1d2132fbe9457276d02' &&
        digest(titleLeaf) === plainHash(reference.catalogEvidence?.sha256) &&
        reference.catalogEvidence?.sourceUrl ===
          'https://archive.org/download/lifetragedyofale00sofi/page/n10.jpg')) &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-tobolsk-original-print-unverified'],
  };
}

/** Bind the individually cleared 1984 Ponce photograph to the nomination and permission record. */
function inspectPonceCasinoPhotograph(dir, reference) {
  const native = 'https://commons.wikimedia.org/wiki/File:Casino_de_Ponce.JPG';
  const archival = 'https://npgallery.nps.gov/GetAsset/2d0ae558-93fa-410d-8690-1e3cba31faec';
  const image = localBytes(dir, reference.path);
  const grant = localBytes(dir, reference.rightsEvidence?.path);
  const nomination = localBytes(dir, reference.catalogEvidence?.path);
  const grantText = plainText(grant?.toString());
  const eligible =
    !!image &&
    !!grant &&
    !!nomination &&
    digest(image) === 'fb121f10271d1ca7d63ee1e52463cbfd9fcb372ef046a9a5f87ebe126a200d93' &&
    digest(image) === plainHash(reference.sha256) &&
    digest(grant) === plainHash(reference.rightsEvidence?.sha256) &&
    digest(nomination) === plainHash(reference.catalogEvidence?.sha256) &&
    digest(nomination) === 'f9b759124e0d541979d8c98736f4e3ae7127bd36db1f571629a0162cc1595357' &&
    reference.artist === 'Pablo Ojeda for the Puerto Rico State Historic Preservation Office' &&
    reference.license === 'Public domain' &&
    reference.sourceUrl === native &&
    reference.downloadUrl ===
      'https://upload.wikimedia.org/wikipedia/commons/7/73/Casino_de_Ponce.JPG' &&
    reference.rightsEvidence?.sourceUrl === native &&
    reference.catalogEvidence?.sourceUrl === archival &&
    grantText.includes('considered of the Public Domain') &&
    grantText.includes(
      'copyright holder has approved publication under the terms mentioned on this page',
    ) &&
    grantText.includes('2010062610023503') &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.pdfObject === 144 &&
    reference.originalReview?.matchedLuminanceCorrelation > 0.995 &&
    reference.visuallyReviewedForThisPolicy === true;
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-ponce-casino-vrt-public-domain-unverified'],
  };
}

/** The Broadway facade photograph from the Library of Congress copy of Greater Oakland. */
function inspectKeyRouteInnHistoricalPhoto(dir, reference) {
  const id = 'greateroakland1901blak';
  const leaf = localBytes(dir, reference.path);
  const record = localBytes(dir, reference.rightsEvidence?.path);
  const index = localBytes(dir, reference.catalogEvidence?.path);
  const { metadata } = snapshotJson(record) ?? {};
  const review = reference.originalReview;
  const hash = '61aa87f7ded8ca3202c0ad6f3bf501ec89be4239912e0a3f11dfc406e53f5563';
  const eligible =
    !!leaf &&
    digest(leaf) === hash &&
    plainHash(reference.sha256) === hash &&
    !!record &&
    digest(record) === plainHash(reference.rightsEvidence?.sha256) &&
    !!index &&
    digest(index) === plainHash(reference.catalogEvidence?.sha256) &&
    index.toString().includes('<page leafNum="306">') &&
    metadata?.identifier === id &&
    metadata?.date === '1911' &&
    metadata?.contributor === 'The Library of Congress' &&
    metadata?.collection?.includes('library_of_congress') &&
    reference.sourceUrl === `https://archive.org/details/${id}/page/n306/mode/1up` &&
    reference.downloadUrl === `https://archive.org/download/${id}/page/n306/mode/1up.jpg` &&
    reference.rightsEvidence?.sourceUrl === `https://archive.org/metadata/${id}` &&
    reference.catalogEvidence?.sourceUrl ===
      `https://archive.org/download/${id}/${id}_scandata.xml` &&
    reference.artist === 'Uncredited photographer, Greater Oakland' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    review?.status === 'inspected' &&
    review?.rendition === 'native-archive-leaf' &&
    review?.publicationYear === 1911 &&
    review?.printedPage === 291 &&
    review?.archiveLeaf === 306;
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-key-route-inn-1911-photograph-unverified'],
  };
}

/** The three contemporary photographs of the unfinished works in the 1903 Strand. */
function inspectJezreelStrandPhotographs(dir, reference) {
  const id = 'sim_strand-magazine_1903-08_26_152';
  const issue = localBytes(dir, reference.path);
  const record = localBytes(dir, reference.rightsEvidence?.path);
  const { metadata, files } = snapshotJson(record) ?? {};
  const original = files?.find((file) => file.name === `${id}.pdf`);
  const review = reference.originalReview;
  const hash = 'b60ed5d0938dcc7eb48af66fae3dd6db87c5947beb6b323d4f7f4dd088335ccb';
  const eligible =
    !!issue &&
    issue.subarray(0, 5).toString() === '%PDF-' &&
    digest(issue) === hash &&
    plainHash(reference.sha256) === hash &&
    Number(original?.size) === issue.length &&
    original.sha1 === createHash('sha1').update(issue).digest('hex') &&
    !!record &&
    digest(record) === plainHash(reference.rightsEvidence?.sha256) &&
    metadata?.identifier === id &&
    metadata?.date === '1903-08' &&
    metadata?.volume === '26' &&
    metadata?.issue === '152' &&
    reference.sourceUrl === `https://archive.org/details/${id}/page/233/mode/1up` &&
    reference.downloadUrl === `https://archive.org/download/${id}/${id}.pdf` &&
    reference.rightsEvidence?.sourceUrl === `https://archive.org/metadata/${id}` &&
    reference.artist === 'Uncredited photographer, The Strand Magazine' &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    review?.status === 'inspected' &&
    review?.rendition === 'native-original-pdf' &&
    review?.publicationYear === 1903 &&
    [233, 234, 235].every((page) => review?.pagesInspected?.includes(page));
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-jezreel-1903-photographs-unverified'],
  };
}

/** The uncredited 1928 pavilion view printed in the December 19 Architects' Journal. */
function inspectTowerHillArchitectsJournal(dir, reference) {
  const source = 'https://www.usmodernist.org/AJUK/AJUK-1928-12-19.pdf';
  const issue = localBytes(dir, reference.path);
  const record = localBytes(dir, reference.rightsEvidence?.path);
  const catalog = snapshotJson(record);
  const review = reference.originalReview;
  const hash = 'af385c03cd84a934e287c8077e8ae20cb7d456c7b4e6afdaf176597c46bf649f';
  const eligible =
    !!issue &&
    issue.subarray(0, 5).toString() === '%PDF-' &&
    digest(issue) === hash &&
    plainHash(reference.sha256) === hash &&
    !!record &&
    digest(record) === plainHash(reference.rightsEvidence?.sha256) &&
    catalog?.issue === source &&
    catalog?.date === '1928-12-19' &&
    catalog?.printedPage === 872 &&
    catalog?.pdfPage === 4 &&
    catalog?.photographer === 'Uncredited' &&
    catalog?.photoCaption?.endsWith('from the design of Sir Edwin Lutyens.') &&
    reference.sourceUrl === `${source}#page=4` &&
    reference.downloadUrl === source &&
    reference.artist === "Uncredited photographer, The Architects' Journal" &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    review?.status === 'inspected' &&
    review?.rendition === 'native-original-pdf' &&
    review?.publicationYear === 1928 &&
    review?.printedPage === 872;
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-tower-hill-1928-photograph-unverified'],
  };
}

/** Original archive scans identified in the North Holland Archives' De Boer catalog export. */
function inspectDeBoerHaarlemPhotograph(dir, reference) {
  const expected = {
    'NL-HlmNHA_1478_00659K00_28':
      'fc7a41fa7b589eab8ce0e997601f2997ab21a43eddb6d06735e0d8a873346d1f',
    'NL-HlmNHA_1478_00837K00_13':
      '686301bc58a78f3fbeabb9d3adb2c92326645ba803c89d639ef72d1d455e0de6',
    'NL-HlmNHA_1478_00837K00_16':
      '5596869b3440614c91d93dc3f315c3a62a0f5cb3666d6d0342411641059ce7c4',
    'NL-HlmNHA_1478_32352K00_27':
      '7840ec3f473a38b2ef87f227aae80aeaae67ad0545fcfdc98009ad83e404b510',
  }[reference.archiveIdentifier];
  const original = localBytes(dir, reference.path);
  const rights = localBytes(dir, reference.rightsEvidence?.path);
  const proof = snapshotJson(rights);
  const published = localBytes(dir, proof?.releasePath);
  const item = proof?.item;
  const thumbnail = item?.photograph_thumbnail ?? '';
  const eligible =
    /^[a-f0-9]{64}$/.test(expected ?? '') &&
    !!original &&
    digest(original) === expected &&
    plainHash(reference.sha256) === expected &&
    !!rights &&
    digest(rights) === plainHash(reference.rightsEvidence?.sha256) &&
    reference.rightsEvidence?.sourceUrl === 'https://doi.org/10.5334/johd.271' &&
    !!published &&
    digest(published) === 'cef243258dcf254f52a6081c0541343563037351c0970046f5a7429af0d2d792' &&
    proof.catalog === 'https://ssh.datastations.nl/api/access/datafile/210171' &&
    proof.collectionOwner === 'Noord-Hollands Archief' &&
    item?.photograph_identifier === reference.archiveIdentifier &&
    /^https:\/\/hdl\.handle\.net\/21\.12102\/[0-9a-f-]{36}$/.test(item.photograph_uri ?? '') &&
    item.photograph_uri === reference.sourceUrl &&
    /^https:\/\/maior-images\.memorix\.nl\/ranh\/iiif\/[0-9a-f-]{36}\/full\/,250\/0\/default\.jpg$/.test(
      thumbnail,
    ) &&
    thumbnail.replace('/,250/', '/max/') === reference.downloadUrl &&
    reference.artist === 'Fotopersbureau De Boer' &&
    reference.license === 'CC0' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'archive-full-negative-scan';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-de-boer-haarlem-archive-unverified'],
  };
}

/** University of Victoria's scan of the September 1912 Grant Street school illustration. */
function inspectVictoriaDailyTimesPage(dir, reference) {
  const identifier = 'victoriadailytimes19120916';
  const expected = '8733ebe1b5e80ace8967f91f5d8c35afd2a30de7425b23d5c483ca3a315ffba7';
  const leaf = localBytes(dir, reference.path);
  const bytes = localBytes(dir, reference.rightsEvidence?.path);
  const record = snapshotJson(bytes);
  const page = Object.values(record?.query?.pages ?? {})[0];
  const wiki = page?.revisions?.[0]?.slots?.main?.content ?? '';
  const eligible =
    !!leaf &&
    digest(leaf) === expected &&
    plainHash(reference.sha256) === expected &&
    !!bytes &&
    digest(bytes) === plainHash(reference.rightsEvidence?.sha256) &&
    record?.archive?.identifier === identifier &&
    record.archive.title === 'Victoria Daily Times (1912-09-16)' &&
    record.archive.publisher === 'University of Victoria' &&
    page?.title === 'File:Victoria Daily Times (1912-09-16) (IA victoriadailytimes19120916).pdf' &&
    page.imageinfo?.[0]?.sha1 === '895c884ac183c7181e8cd02996055c4f447af0c0' &&
    page.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value === 'Public domain' &&
    wiki.includes('{{PD-Canada}}') &&
    wiki.includes(`{{Internet Archive link|${identifier}}}`) &&
    reference.sourceUrl === `https://archive.org/details/${identifier}/page/n11/mode/1up` &&
    reference.downloadUrl === `https://archive.org/download/${identifier}/page/n11.jpg` &&
    reference.license === 'Public domain' &&
    reference.visuallyReviewedForThisPolicy === true &&
    reference.originalReview?.status === 'inspected' &&
    reference.originalReview?.rendition === 'original-print-scan' &&
    reference.originalReview?.publicationDate === '1912-09-16' &&
    reference.originalReview?.printedPage === 12;
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-victoria-daily-times-page-unverified'],
  };
}

/** The two leaves of Schultz's signed plate published in London on 24 November 1915. */
function inspectKhartoumCathedralPlate(dir, reference) {
  const identifier = 'buildingnewseng109londuoft';
  const leaf = reference.originalReview?.leaf;
  const expected = new Map([
    [601, '0e6da0704670d5662708522a75ed922591507671e747881ab171e702f0c28efc'],
    [602, 'e85570ea456d761cd466f1a4b27a018ba0922a547ef652de1f3bb1370da1160a'],
  ]).get(leaf);
  const archive = `https://archive.org/details/${identifier}/page/n${leaf}/mode/2up`;
  const original = `https://archive.org/download/${identifier}/page/n${leaf}.jpg`;
  const catalog = `https://archive.org/metadata/${identifier}`;
  const image = localBytes(dir, reference.path);
  const record = localBytes(dir, reference.rightsEvidence?.path);
  const metadata = snapshotJson(record)?.metadata;
  const review = reference.originalReview;
  const blockers = [];
  if (
    !expected ||
    !image ||
    image.subarray(0, 3).toString('hex') !== 'ffd8ff' ||
    plainHash(reference.sha256) !== expected ||
    digest(image) !== expected
  )
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !record ||
    digest(record) !== plainHash(reference.rightsEvidence?.sha256) ||
    reference.rightsEvidence?.sourceUrl !== catalog ||
    metadata?.identifier !== identifier ||
    metadata.title !== 'Building News and Engineering Journal' ||
    metadata.volume !== '109' ||
    metadata.publisher !== 'London' ||
    metadata.contributor !== 'Gerstein - University of Toronto' ||
    reference.sourceUrl !== archive ||
    reference.downloadUrl !== original ||
    reference.artist !== 'Robert Weir Schultz' ||
    reference.license !== 'Public domain' ||
    reference.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'original-print-scan' ||
    review.publicationDate !== '1915-11-24' ||
    review.issue !== 3177
  )
    blockers.push('supplemental-khartoum-cathedral-plate-provenance-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
  };
}

/** Exact original plate as published in the 1859 New York edition. */
function inspectComayaguaHarpersPlate(dir, reference) {
  const blockers = [];
  const source = 'https://archive.org/details/harpersnew19harper/page/603/mode/1up';
  const download = 'https://archive.org/download/harpersnew19harper/page/603/mode/1up';
  const catalog = 'https://colenda.library.upenn.edu/catalog/81431-p3736mc0v';
  const plateHash = 'ed44cc50617b8260568581cc6c274802e4dfe495aee2ac9959b9d5e73f1c19f3';
  const image = localBytes(dir, reference.path);
  const record = localBytes(dir, reference.rightsEvidence?.path);
  const description = plainText(record?.toString()).toLowerCase();
  const review = reference.originalReview;
  if (
    image?.subarray(0, 3).toString('hex') !== 'ffd8ff' ||
    plainHash(reference.sha256) !== plateHash ||
    digest(image) !== plateHash
  ) {
    blockers.push('supplemental-image-bytes-unbound');
  }
  if (
    !record ||
    digest(record) !== plainHash(reference.rightsEvidence?.sha256) ||
    reference.rightsEvidence?.sourceUrl !== catalog ||
    !description.includes(
      "a visit to the guajiquero indians (f. 9-18), as published in harper's",
    ) ||
    !description.includes('vol. 19, no. 113 (october 1859), p. 602-619') ||
    !description.includes('http://rightsstatements.org/vocab/noc-us/1.0/') ||
    reference.sourceUrl !== source ||
    reference.downloadUrl !== download ||
    reference.license !== 'Public domain' ||
    reference.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'original-print-scan' ||
    review?.printedPage !== 603 ||
    review?.publicationYear !== 1859 ||
    review?.caption !== 'Cathedral of Comayagua.'
  ) {
    blockers.push('supplemental-comayagua-plate-provenance-unverified');
  }
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
  };
}

const birminghamTerminalArchives = {
  'reference-originals/sanborn-birmingham-1911-sheet-21.jpg': {
    url: 'https://www.loc.gov/resource/g3974bm.g3974bm_g00015191101/?sp=37',
    sha256: '7860d53ad43fa377f013ec461a636271826b2b75a677fd5443bcb1b382a36cda',
    year: 1911,
    credit: 'Sanborn Map Company',
  },
  'reference-originals/american-architect-1909-07-14.pdf': {
    url: 'https://www.usmodernist.org/AMAR/AMAR-1909-07-14.pdf',
    sha256: '50fd5bc665604a5b3c09bad1ce171e148e5c044b96a804a5f92042cc8885c5d8',
    year: 1909,
    credit: 'P. Thornton Marye',
  },
};

/** Bind the two inspected, pre-1923 US publications of the terminal plans and dimensions. */
function inspectBirminghamTerminalArchive(dir, reference) {
  const expected = Object.hasOwn(birminghamTerminalArchives, reference.path)
    ? birminghamTerminalArchives[reference.path]
    : null;
  const bytes = localBytes(dir, reference.path);
  const review = reference.originalReview;
  const eligible = Boolean(
    path.basename(dir) === 'birmingham_terminal_station' &&
      expected &&
      bytes &&
      reference.license === 'Public domain' &&
      reference.sourceUrl === expected.url &&
      plainHash(reference.sha256) === expected.sha256 &&
      digest(bytes) === expected.sha256 &&
      reference.artist === expected.credit &&
      review?.status === 'inspected' &&
      review.rendition === 'original-archive-publication' &&
      review.publicationYear === expected.year,
  );
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-birmingham-terminal-publication-unverified'],
  };
}

function field(html, name) {
  return (
    html.match(new RegExp(`<label[^>]*>${name}:</label>\\s*<div[^>]*>([\\s\\S]*?)</div>`))?.[1] ??
    ''
  )
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Original Republic-era edition published before 1930, with NLC credit and native PD-China rights. */
export function inspectNlcRepublicEraReference(dir, reference) {
  const blockers = [];
  const pdf = localBytes(dir, reference.path);
  const snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!pdf || digest(pdf) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const pages = Object.values(snapshotJson(snapshot)?.query?.pages ?? {});
  const page = pages.length === 1 ? pages[0] : null;
  const info = page?.imageinfo?.[0];
  const nativeUrl = info?.url?.split('?')[0];
  const metadata = info?.extmetadata;
  const wiki = page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
  const catalog = /^File:NLC(\d+)-(\w+)-(\d+) .+\.pdf$/u.exec(page?.title ?? '');
  const fields = new Map(
    Array.from(wiki.matchAll(/^\s*\|([^=\n]+)=([^\n]+)$/gm), ([, key, value]) => [
      key.trim(),
      value.trim(),
    ]),
  );
  const year = Number(fields.get('出版時間')?.match(/\[(\d{4})\]/)?.[1]);
  const review = reference.originalReview;
  if (
    reference.origin !== 'commons-nlc-republic-era-original-book' ||
    reference.license !== 'Public domain' ||
    page?.ns !== 6 ||
    !catalog ||
    !wiki.includes('{{Republic Era Book in the National Library of China\n') ||
    fields.get('dbid') !== catalog[1] ||
    fields.get('bookid') !== catalog[2] ||
    fields.get('volumeid') !== catalog[3] ||
    reference.archiveIdentifier !== catalog.slice(1).join(':') ||
    !reference.publicationTitle?.trim() ||
    fields.get('title') !== reference.publicationTitle ||
    !reference.publicationPublisher?.trim() ||
    fields.get('出版者') !== reference.publicationPublisher ||
    !reference.artist?.trim() ||
    fields.get('責任者') !== reference.artist ||
    reference.sourceUrl !== info?.descriptionurl ||
    reference.downloadUrl !== nativeUrl ||
    !nativeUrl?.startsWith('https://upload.wikimedia.org/wikipedia/commons/') ||
    plainText(metadata?.Credit?.value) !== 'National Library of China' ||
    metadata?.Copyrighted?.value !== 'False' ||
    metadata?.LicenseShortName?.value !== 'Public domain' ||
    metadata?.UsageTerms?.value !== 'Public domain' ||
    !metadata?.Categories?.value?.split('|').includes('PD-scan (PD-China)') ||
    !Number.isInteger(year) ||
    year < 1912 ||
    year > 1929 ||
    year !== review?.publicationYear ||
    reference.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'native-original-pdf' ||
    !Array.isArray(review.pagesInspected) ||
    review.platePage === review.publicationPage ||
    ![review.platePage, review.publicationPage].every(
      (p) =>
        Number.isInteger(p) && p >= 1 && p <= info?.pagecount && review.pagesInspected.includes(p),
    ) ||
    !review.notes?.trim() ||
    !pdf ||
    pdf.subarray(0, 5).toString() !== '%PDF-' ||
    pdf.length !== info?.size ||
    createHash('sha1').update(pdf).digest('hex') !== info?.sha1
  )
    blockers.push('supplemental-nlc-original-book-grant-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
  };
}

/** Original nineteenth-century library book, with named deceased creator and native PDF hash. */
export function inspectExpiredNamedBookReference(dir, reference) {
  const blockers = [],
    bytes = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    record = snapshotJson(snapshot),
    metadata = record?.metadata,
    review = reference.originalReview,
    id = reference.archiveIdentifier,
    year = review?.publicationYear,
    died = review?.creatorDied,
    file = record?.files?.find((f) => f.name === `${id}.pdf`);
  if (!bytes || digest(bytes) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.origin !== 'archive-expired-named-book' ||
    reference.license !== 'Public domain' ||
    !/^[a-z0-9]+$/.test(id ?? '') ||
    reference.sourceUrl !== `https://archive.org/details/${id}` ||
    reference.rightsEvidence?.sourceUrl !== `https://archive.org/metadata/${id}` ||
    reference.downloadUrl !== `https://archive.org/download/${id}/${id}.pdf` ||
    metadata?.identifier !== id ||
    metadata?.['possible-copyright-status'] !== 'NOT_IN_COPYRIGHT' ||
    metadata?.creator !== reference.artist ||
    /unknown|anonymous/i.test(reference.artist ?? '') ||
    !metadata?.contributor?.trim() ||
    !metadata?.publisher?.trim() ||
    !Number.isInteger(year) ||
    year < 1800 ||
    year > 1875 ||
    metadata?.date !== String(year) ||
    !Number.isInteger(died) ||
    died < 1800 ||
    died > 1915 ||
    !reference.artist?.endsWith(`-${died}`) ||
    reference.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'native-original-pdf' ||
    !review?.pagesInspected?.length ||
    !bytes ||
    bytes.subarray(0, 5).toString() !== '%PDF-' ||
    Number(file?.size) !== bytes.length ||
    file?.sha1 !==
      createHash('sha1')
        .update(bytes ?? '')
        .digest('hex')
  )
    blockers.push('supplemental-expired-named-book-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Named nineteenth-century print: bind the original bytes and explicit native grant. */
export function inspectHistoricalPrintReference(dir, reference, root = modelRightsRoot) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    proof = reference.publicDomainEvidence;
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !snapshot ||
    digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256) ||
    proof?.sha256 !== plainHash(reference.rightsEvidence?.sha256) ||
    path.resolve(root, proof?.path ?? '') !==
      path.resolve(dir, reference.rightsEvidence?.path ?? '')
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.origin !== 'commons-expired-historical-print' ||
    proof?.kind !== 'commons-native-expired-historical-print' ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'native-original' ||
    reference.visuallyReviewedForThisPolicy !== true ||
    !image ||
    !inspectQuallaPrimaryRights(reference, image, root)?.eligible
  )
    blockers.push('supplemental-historical-print-grant-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Supplemental dated book photo; never substitutes for missing published-media clearance. */
export function inspectNamedBookPhotographReference(dir, reference, root = modelRightsRoot) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    proof = reference.publicDomainEvidence;
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !snapshot ||
    digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256) ||
    proof?.sha256 !== plainHash(reference.rightsEvidence?.sha256) ||
    path.resolve(root, proof?.path ?? '') !==
      path.resolve(dir, reference.rightsEvidence?.path ?? '')
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.origin !== 'commons-expired-named-book-photo' ||
    proof?.kind !== 'commons-native-expired-named-book-photo' ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'native-original' ||
    reference.visuallyReviewedForThisPolicy !== true ||
    !image ||
    !inspectQuallaPrimaryRights(reference, image, root)?.eligible
  )
    blockers.push('supplemental-named-book-photo-grant-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Explicit named federal staff credit and reviewed official State Department original. */
export function inspectStateDepartmentReference(dir, reference, root = modelRightsRoot) {
  const image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    proof = reference.publicDomainEvidence,
    blockers = [];
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !snapshot ||
    digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256) ||
    proof?.sha256 !== plainHash(reference.rightsEvidence?.sha256) ||
    path.resolve(root, proof?.path ?? '') !==
      path.resolve(dir, reference.rightsEvidence?.path ?? '')
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.origin !== 'commons-state-department-government-photo' ||
    proof?.kind !== 'commons-native-state-department-staff-photo' ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'native-original' ||
    reference.visuallyReviewedForThisPolicy !== true ||
    !image ||
    !inspectQuallaPrimaryRights(reference, image, root)?.eligible
  )
    blockers.push('supplemental-state-department-staff-photo-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** The cultural archive distinguishes the digital object's licence from its description.
 * Require the selected object, named creator, offered image and object-specific CC0 grant. */
export function inspectTaiwanCultureReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const html = snapshot?.toString('utf8') ?? '',
    id = reference.sourceUrl?.match(
      /^https:\/\/tcmb\.culture\.tw\/zh-tw\/detail\?id=(\d+)&indexCode=Culture_Object$/,
    )?.[1],
    records = [
      ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    ].map((m) => snapshotJson(m[1])),
    work = records.find((r) => r?.identifier === `Culture_Object-${id}`),
    citation = plainText(
      html.match(
        /<textarea\b[^>]*aria-label="數位物件授權引用資訊"[^>]*>([\s\S]*?)<\/textarea>/,
      )?.[1],
    ),
    linkedImage = [...html.matchAll(/<img\b[^>]*>/g)].some(
      (m) =>
        m[0].includes(`src="${reference.downloadUrl}"`) &&
        m[0].includes(`alt="${reference.title}"`),
    ),
    review = reference.originalReview;
  if (
    reference.origin !== 'taiwan-culture-object-cc0' ||
    reference.license !== 'CC0' ||
    !id ||
    !reference.artist?.trim() ||
    !reference.title?.trim() ||
    !reference.catalogInstitution?.trim() ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    work?.['@type'] !== 'CreativeWork' ||
    work.name !== reference.title ||
    work.url?.replace(/^http:/, 'https:') !== reference.sourceUrl ||
    citation !==
      `${reference.title} / 創作者：${reference.artist} / 數位物件授權：CC0 / 建檔單位：${reference.catalogInstitution} @ 國家文化記憶庫 http://tcmb.culture.tw/zh-tw/detail?indexCode=Culture_Object&id=${id}` ||
    !/<a\b[^>]*title="數位物件授權：公眾領域貢獻宣告\(CC0\)\[另開新視窗\]"/.test(html) ||
    !/^https:\/\/dcm\.s3\.hicloud\.net\.tw\/new\/excel\/object\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\/collection\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(
      reference.downloadUrl ?? '',
    ) ||
    !linkedImage ||
    !html.includes(`href="${reference.downloadUrl}"`) ||
    review?.status !== 'inspected' ||
    review.rendition !== 'published-cc0-digital-object' ||
    review.photographicContent !== true ||
    review.includesThirdPartyArtwork !== false
  )
    blockers.push('supplemental-cultural-object-cc0-release-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Faithful scans of dated, published postcards whose maximum US term has expired.
 * A library's creation date or collection-wide rights label is insufficient. */
export function inspectCaliforniaPostcardReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const html = snapshot?.toString('utf8') ?? '',
    review = reference.originalReview ?? {},
    year = review.publicationYear,
    id = String(reference.catalogNumber ?? ''),
    catalogField = (name) =>
      plainText(
        html.match(
          new RegExp(`<b>${name}:</b></font><br\\s*/><font[^>]*>([\\s\\S]*?)</font>`),
        )?.[1],
      ),
    imprint = catalogField('Published'),
    compact = (s) => plainText(s).replace(/\s+/g, '').toLowerCase();
  let catalogUrl = false;
  try {
    const u = new URL(reference.sourceUrl);
    catalogUrl =
      u.origin === 'https://dbs.library.ca.gov' &&
      u.pathname === '/dbtw-wpd/exec/dbtwpub.dll' &&
      u.searchParams.get('QY') === `find (NO ct (${id}))` &&
      u.searchParams.get('TN') === 'CALINFO';
  } catch {}
  if (
    reference.origin !== 'california-library-expired-postcard' ||
    reference.license !== 'Public domain' ||
    !catalogUrl ||
    !/^\d+$/.test(id) ||
    !html.includes(`System Number: <b>${id}</b>`) ||
    catalogField('Title') !== reference.title ||
    !reference.artist?.trim() ||
    !compact(imprint).includes(compact(reference.artist)) ||
    !Number.isInteger(year) ||
    year < 1800 ||
    year > 1930 ||
    !new RegExp(`, c${year}\\. \\(1 photomechanical print \\(postcard\\)`).test(imprint) ||
    !/^https:\/\/dbs\.library\.ca\.gov\/CalInfoImages\/CIFII_Scan\d+\.jpg$/.test(
      reference.downloadUrl ?? '',
    ) ||
    !html.includes(`src="${reference.downloadUrl}"`) ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    review.status !== 'inspected' ||
    review.rendition !== 'faithful-published-postcard-scan' ||
    review.publisherImprintInspected !== true ||
    review.postmarkYear !== year ||
    review.usMaximumExpiryYear !== year + 95 ||
    review.modernAlteration !== false
  )
    blockers.push('supplemental-dated-published-postcard-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Pre-1945 Australian newspaper photograph, with native expiry tag and NLA guidance. */
export function inspectExpiredAustralianNewsReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    guidance = localBytes(dir, reference.expiryEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  if (!guidance || digest(guidance) !== plainHash(reference.expiryEvidence?.sha256))
    blockers.push('supplemental-expiry-guidance-unbound');
  const json = snapshotJson(snapshot),
    publication = reference.publication ?? {},
    parts = publication.date?.match(/^(18\d\d|19[0-3]\d|194[0-4])-(\d\d)-(\d\d)$/),
    months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    label = parts ? `${Number(parts[3])} ${months[Number(parts[2]) - 1]} ${parts[1]}` : '',
    title = reference.sourceUrl?.match(
      /^https:\/\/commons\.wikimedia\.org\/wiki\/(File:[^?#]+)$/,
    )?.[1],
    page = Object.values(json?.query?.pages ?? {}).find(
      (p) => p.title === decodeURIComponent(title ?? '').replaceAll('_', ' '),
    ),
    info = page?.imageinfo?.[0],
    wiki = page?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    source = wiki.match(/\|\s*source\s*=([^\r\n]+)/i)?.[1] ?? '',
    guideUrl =
      'https://www.library.gov.au/services/copyright-library-collections/rights-and-pictures-collection',
    nativeRequest = json?.requestUrl ?? json?.sourceUrl ?? '';
  // The cutoff predates both the Australian term extension and the 1996 URAA date.
  // An anonymous modern image, a transfer label or a bare Commons footer cannot qualify.
  if (
    reference.origin !== 'expired-australian-newspaper-photograph' ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'Unidentified newspaper photographer' ||
    !/^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?/.test(nativeRequest) ||
    !title ||
    !info ||
    info.url !== reference.downloadUrl ||
    !/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[a-f0-9]\/\w{2}\/[^?#]+\.jpe?g(?:\?[^#]*)?$/i.test(
      reference.downloadUrl ?? '',
    ) ||
    !image ||
    createHash('sha1').update(image).digest('hex') !== info.sha1 ||
    info.sha1 !== reference.nativeSha1 ||
    page?.revisions?.[0]?.revid !== reference.nativeRevision ||
    info.size !== image?.length ||
    info.width !== reference.width ||
    info.height !== reference.height ||
    info.extmetadata?.LicenseShortName?.value !== 'Public domain' ||
    !/\{\{\s*PD-Australia\s*\}\}/i.test(wiki) ||
    !/\|\s*author\s*=\s*\{\{unknown\|author\}\}/i.test(wiki) ||
    !parts ||
    !label ||
    !wiki.includes(`{{taken on|${publication.date}|location=Australia}}`) ||
    !source.startsWith('{{cite news ') ||
    !/^\d{6,12}$/.test(publication.articleId ?? '') ||
    publication.url !== `http://nla.gov.au/nla.news-article${publication.articleId}` ||
    !source.includes(`|url=${publication.url}`) ||
    !publication.title?.trim() ||
    !source.includes(publication.title) ||
    !publication.articleTitle?.trim() ||
    !source.includes(`|title=${publication.articleTitle}`) ||
    !source.includes(`|date=${label}`) ||
    !Number.isInteger(publication.page) ||
    publication.page < 1 ||
    !source.includes(`|page=${publication.page} `) ||
    !source.includes('|publisher=National Library of Australia') ||
    reference.expiryEvidence?.sourceUrl !== guideUrl ||
    !guidance?.toString().includes(`<link rel="canonical" href="${guideUrl}"`) ||
    !plainText(guidance).includes(
      'Photographs taken before 1 January 1955 are all out of copyright.',
    ) ||
    reference.visuallyReviewedForThisPolicy !== true ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'native-original'
  )
    blockers.push('supplemental-expired-australian-newspaper-photo-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** AWM's own dated photograph, explicitly marked expired at the selected accession. */
export function inspectAwmArchiveReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const html = snapshot?.toString('utf8') ?? '',
    row = (label) =>
      html.match(
        new RegExp(`<th\\b[^>]*>\\s*${label}\\s*</th>\\s*<td\\b[^>]*>([\\s\\S]*?)</td>`, 'i'),
      )?.[1] ?? '',
    maker = plainText(row('Maker')),
    makerParts = maker.split(',').map((s) => s.trim()),
    artist = makerParts.length === 2 ? `${makerParts[1]} ${makerParts[0]}` : maker,
    copyright = row('Copyright'),
    title = plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]),
    date = plainText(row('Date made')) || title,
    source = reference.sourceUrl?.match(/^https:\/\/www\.awm\.gov\.au\/collection\/C\d+$/),
    offered = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1],
    rendition = reference.downloadUrl?.match(
      /^https:\/\/s3-ap-southeast-2\.amazonaws\.com\/awm-media\/collection\/([A-Z0-9.]+)\/screen\/\d+\.JPG$/,
    );
  if (
    reference.origin !== 'awm-expired-archive-photograph' ||
    reference.license !== 'Public domain' ||
    !source ||
    !html.includes(`<link rel="canonical" href="${reference.sourceUrl}"`) ||
    !/^[A-Z0-9.]+$/.test(reference.catalogNumber ?? '') ||
    plainText(row('Accession Number')) !== reference.catalogNumber ||
    plainText(row('Collection type')) !== 'Photograph' ||
    !artist ||
    artist.split(' ').length < 2 ||
    /unknown|unidentified|unrecorded|not stated|courtesy|contractor/i.test(maker) ||
    reference.artist !== artist ||
    !Number.isInteger(reference.photoYear) ||
    reference.photoYear < 1800 ||
    reference.photoYear > 1955 ||
    !new RegExp(`\\b${reference.photoYear}\\b`).test(date) ||
    !plainText(copyright).includes('Item copyright: Copyright expired - public domain') ||
    !plainText(copyright).includes('This item is in the Public Domain') ||
    !/href="https?:\/\/creativecommons\.org\/publicdomain\/mark\/1\.0\/"/.test(copyright) ||
    offered !== reference.downloadUrl ||
    rendition?.[1] !== reference.catalogNumber ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    reference.originalReview?.rendition !== 'archive-published-jpeg'
  )
    blockers.push('supplemental-awm-expired-archive-grant-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

export function inspectNpsReference(dir, reference) {
  const blockers = [];
  const image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const source = reference.sourceUrl?.match(
    /^https:\/\/npgallery\.nps\.gov\/AssetDetail\/([\da-f-]{36})$/i,
  );
  const html = snapshot?.toString('utf8') ?? '',
    id = source?.[1];
  const agencyRelease =
    ['NPS', 'NPS Photo', 'National Park Service', 'Cape Hatteras National Seashore'].includes(
      field(html, 'PhotoCredit'),
    ) && field(html, 'Constraints Information') === 'Public domain:Full Granting Rights';
  // Some agency records use Photographer and Publisher instead of PhotoCredit.
  // Require an exact staff or office credit and the corresponding agency publisher.
  const photographer = field(html, 'Photographer');
  const publisher = field(html, 'Publisher');
  const legacyStaffRelease =
    !field(html, 'PhotoCredit') &&
    ((photographer === 'NPS staff' && publisher === 'National Park Service') ||
      (photographer === 'National Trails Office US National Park Service' &&
        publisher === 'U.S. National Park Service')) &&
    field(html, 'Constraints Information') === 'Public domain';
  if (
    reference.origin !== 'nps-gallery-public-domain' ||
    !id ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'NPS' ||
    field(html, 'Asset ID').toLowerCase() !== id.toLowerCase() ||
    !(agencyRelease || legacyStaffRelease) ||
    reference.downloadUrl !== `https://npgallery.nps.gov/GetAsset/${id}/original.jpg` ||
    !html.includes(`/GetAsset/${id}/original.jpg`)
  )
    blockers.push('supplemental-primary-public-domain-grant-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** The dated Fidanza album plate showing the Palacete Provincial. */
function inspectFidanzaManausPlate(dir, reference) {
  const source = 'https://idd.org.br/iconografia/as-dependencias-do-quartel-da-policia/';
  const catalog = 'https://bdlb.bn.gov.br/acervo/handle/20.500.12156.3/45809';
  const download =
    'https://idd.org.br/wp-content/uploads/2020/12/Quartel-de-policia.-Album-do-Amazonas-1901-1902.-p.-52-scaled.jpg';
  const expected = 'c6b3f195eaed757761363c6e60bf13fdfc2410d24b528d3465334a96b7550502';
  const image = localBytes(dir, reference.path);
  const snapshot = localBytes(dir, reference.rightsEvidence?.path);
  const review = reference.originalReview;
  const eligible = Boolean(
    image &&
      digest(image) === expected &&
      plainHash(reference.sha256) === expected &&
      snapshot &&
      digest(snapshot) === plainHash(reference.rightsEvidence?.sha256) &&
      snapshot.includes(`<meta property="og:url" content="${source}"`) &&
      snapshot.includes(`<meta property="og:image" content="${download}"`) &&
      snapshot.includes('<p><strong>Foto: </strong>F. A. Fidanza</p>') &&
      reference.sourceUrl === source &&
      reference.rightsEvidence?.sourceUrl === source &&
      reference.downloadUrl === download &&
      reference.artist === 'Filipe Augusto Fidanza' &&
      reference.license === 'Public domain' &&
      reference.width === 2560 &&
      reference.height === 1945 &&
      review?.status === 'inspected' &&
      review.rendition === 'archive-published-complete-plate' &&
      review.nativeCatalogue === catalog &&
      review.publicationYear === 1902 &&
      review.printedPage === 52,
  );
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers: eligible ? [] : ['supplemental-fidanza-album-plate-unverified'],
    eligible,
  };
}

/** The Hamburg State Library's public-domain scan of the original 1914 printed photograph. */
function inspectHamburgLomePalacePlate(dir, reference) {
  const source = 'https://resolver.sub.uni-hamburg.de/kitodo/PPN1026639638_1914';
  const pdf = 'https://img.sub.uni-hamburg.de/kitodo/PPN1026639638_1914/PDF/PPN1026639638_1914.pdf';
  const archiveHash = '2c0877a677331a587520dc6cb2c944fbe489d64fa52d0ae22d75c96e3ededd91';
  const archive = localBytes(dir, reference.rightsEvidence?.path);
  const image = localBytes(dir, reference.path);
  const review = reference.originalReview;
  const eligible = Boolean(
    archive &&
      digest(archive) === archiveHash &&
      plainHash(reference.rightsEvidence?.sha256) === archiveHash &&
      image?.equals(archive.subarray(2851142, 3413359)) &&
      digest(image) === plainHash(reference.sha256) &&
      reference.width === 1693 &&
      reference.height === 2112 &&
      reference.sourceUrl === source &&
      reference.rightsEvidence?.sourceUrl === pdf &&
      reference.downloadUrl === `${pdf}#page=7` &&
      reference.artist === 'Uncredited photographer' &&
      reference.license === 'Public domain' &&
      review?.status === 'inspected' &&
      review.rendition === 'exact-native-pdf-image-stream' &&
      review.publicationYear === 1914 &&
      review.printedPage === 2,
  );
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers: eligible ? [] : ['supplemental-hamburg-public-domain-plate-unverified'],
    eligible,
  };
}

/** The captioned NPS staff photographs of the standing Fort Frederik. */
function inspectFortFrederikPhotos(dir, reference) {
  const source = 'https://npgallery.nps.gov/GetAsset/7d69ecde-7b56-489d-8a91-448c0c8a7378';
  const archiveHash = '39fb6635d4bb029f0264eec0986bd56753e5521361d764d16810e5e0521d30a2';
  const photos = new Map([
    [1, { start: 7690, length: 175249, width: 1506, height: 944 }],
    [2, { start: 208441, length: 150605, width: 1482, height: 933 }],
  ]);
  const image = localBytes(dir, reference.path);
  const archive = localBytes(dir, reference.rightsEvidence?.path);
  const review = reference.originalReview;
  const photo = photos.get(review?.printedPage);
  const eligible = Boolean(
    archive &&
      digest(archive) === archiveHash &&
      plainHash(reference.rightsEvidence?.sha256) === archiveHash &&
      image &&
      photo &&
      image.equals(archive.subarray(photo.start, photo.start + photo.length)) &&
      digest(image) === plainHash(reference.sha256) &&
      reference.width === photo.width &&
      reference.height === photo.height &&
      reference.sourceUrl === source &&
      reference.rightsEvidence?.sourceUrl === source &&
      reference.downloadUrl === `${source}#page=${review.printedPage}` &&
      reference.artist === 'Mark Barnes, National Park Service' &&
      reference.license === 'Public domain' &&
      review.status === 'inspected' &&
      review.rendition === 'exact-native-pdf-image-stream',
  );
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers: eligible ? [] : ['supplemental-nps-captioned-photo-unverified'],
    eligible,
  };
}

/** A dated historical postcard explicitly released in its own NPS image caption. */
export function inspectNpsHistoricalReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const html = snapshot?.toString('utf8') ?? '',
    year = reference.originalReview?.publicationYear,
    figures = [...html.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/g)],
    selected = figures.find((f) => {
      const src = f[1].match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1];
      return src && `https://www.nps.gov${src}` === reference.downloadUrl;
    })?.[1],
    caption = selected?.match(/<figcaption>([\s\S]*?)<\/figcaption>/)?.[1] ?? '',
    credit = caption.match(/<p class="figcredit">([\s\S]*?)<\/p>/)?.[1] ?? '';
  if (
    reference.origin !== 'nps-historical-public-domain' ||
    reference.license !== 'Public domain' ||
    !/^https:\/\/www\.nps\.gov\/places\/[a-z0-9-]+\.htm$/.test(reference.sourceUrl ?? '') ||
    !html.includes(`<meta property="og:url" content="${reference.sourceUrl}"`) ||
    !/^https:\/\/www\.nps\.gov\/common\/uploads\/place\/nri\/\d{8}\/places\/([A-F0-9-]+)\/\1\.jpg$/.test(
      reference.downloadUrl ?? '',
    ) ||
    !Number.isInteger(year) ||
    year < 1800 ||
    year > 1930 ||
    !new RegExp(`\\b${year} postcard\\b`, 'i').test(plainText(caption)) ||
    !/\bPublic domain\./.test(plainText(caption)) ||
    plainText(credit) ||
    plainText(caption) !== reference.originalReview?.primaryCaption
  )
    blockers.push('supplemental-primary-historical-public-domain-grant-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Dated South African photographic postcards whose source and US terms expired.
 * The publication witness is reviewed evidence, not an archive-wide image licence.
 * Modern article text and undated neighboring illustrations never qualify. */
export function inspectExpiredPostcardReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    proof = snapshotJson(snapshot),
    review = reference.originalReview,
    year = proof?.publicationNoLaterThan,
    crop = proof?.reproduction;
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.origin !== 'expired-south-african-photographic-postcard' ||
    reference.license !== 'Public domain' ||
    proof?.format !== 'molen/historical-postcard-rights@1' ||
    proof.originalType !== 'photographic-postcard' ||
    proof.country !== 'ZA' ||
    !Number.isInteger(year) ||
    year < 1800 ||
    year > 1930 ||
    proof.sourceCountryTerm !== 'photographs-50-years-publication' ||
    proof.sourceCountryExpiryYear !== year + 50 ||
    proof.usExpiryYear !== year + 95 ||
    proof.photographerImprint !== reference.artist ||
    !proof.photographerImprint?.trim() ||
    !proof.datingExcerpt?.includes(proof.photographerImprint) ||
    !new RegExp(`postally used[^.]*\\b${year}\\b`, 'i').test(proof.datingExcerpt ?? '') ||
    proof.sourceUrl !== reference.sourceUrl ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    !/^https:\/\/.+\.pdf$/.test(reference.sourceUrl ?? '') ||
    crop?.kind !== 'faithful-grayscale-print-crop' ||
    !/^[a-f0-9]{64}$/.test(crop.pageImageSha256 ?? '') ||
    plainHash(crop.imageSha256) !== plainHash(reference.sha256) ||
    !Array.isArray(crop.bounds) ||
    crop.bounds.length !== 4 ||
    !crop.bounds.every((n) => Number.isInteger(n) && n >= 0) ||
    crop.bounds[2] - crop.bounds[0] !== reference.width ||
    crop.bounds[3] - crop.bounds[1] !== reference.height ||
    crop.modernImageAlteration !== false ||
    crop.includesModernArticle !== false ||
    review?.status !== 'inspected' ||
    review.rendition !== 'published-historical-reproduction' ||
    review.publicationNoLaterThan !== year
  )
    blockers.push('supplemental-expired-postcard-publication-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Original illustrations in a Gutenberg PD book by an author dead for over100years.
 * Bind the selected published illustration, book and creator record separately;
 * Gutenberg also hosts permission-based books, so its domain alone is no grant. */
export function inspectGutenbergReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    catalog = localBytes(dir, reference.rightsEvidence?.path),
    book = localBytes(dir, reference.bookEvidence?.path),
    review = reference.originalReview,
    source = reference.sourceUrl?.match(
      /^https:\/\/www\.gutenberg\.org\/files\/(\d+)\/\1-h\/\1-h\.htm$/,
    ),
    id = source?.[1],
    html = catalog?.toString('utf8') ?? '',
    content = book?.toString('utf8') ?? '',
    creator = plainText(html.match(/<a\b[^>]*itemprop="creator"[^>]*>([\s\S]*?)<\/a>/)?.[1]),
    death = Number(creator.match(/\b\d{4}-(\d{4})\b/)?.[1]),
    relative = reference.downloadUrl?.split(`/${id}-h/`)[1],
    title = plainText(html.match(/<td\b[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/td>/)?.[1]),
    publicationYear = review?.publicationYear;
  const linkedOriginal =
    /^images\/[a-z0-9_-]+_lg\.jpg$/.test(relative ?? '') &&
    content.includes(`href="${relative}"`) &&
    content.includes(`PROJECT GUTENBERG EBOOK ${id}`);
  // Bind these separately captioned plates to the dated London edition.
  const anemasPlateHashes = {
    'images/fig_fp138-large.jpg':
      'e63635f2e45bf543438a297fa9d1010013c86ba7a6aefb53c2303dec3f8eb3f9',
    'images/fig_fp144-large.jpg':
      'd8eb67571dcadcf4422ae6da64fe69ab9a54bac8082b52898b7ba2568f96cd6c',
  };
  const anemasOriginal =
    id === '61475' &&
    publicationYear === 1899 &&
    creator === 'Van Millingen, Alexander, 1840-1915' &&
    anemasPlateHashes[relative] === plainHash(reference.sha256) &&
    content.includes('JOHN MURRAY, ALBEMARLE STREET</div>') &&
    content.includes('<div>1899</div>') &&
    content.includes(`href='${relative}'`) &&
    content.includes('PROJECT GUTENBERG EBOOK 61475');
  // Some original editions bind the only scan directly to the book illustration
  // rather than linking to a larger image. Match the edition and its exact image.
  const embeddedCanadianOriginal =
    /^images\/[a-z0-9_-]+\.jpg$/.test(relative ?? '') &&
    Number.isInteger(publicationYear) &&
    publicationYear >= 1800 &&
    publicationYear <= 1922 &&
    html.includes(`about="[ebook:${id}]"`) &&
    title &&
    content.includes(`*** START OF THIS PROJECT GUTENBERG EBOOK ${title.toUpperCase()} ***`) &&
    content.includes(`Copyright, Canada, ${publicationYear}, by`) &&
    typeof review?.primaryCaption === 'string' &&
    review.primaryCaption.startsWith('[Illustration: ') &&
    [...content.matchAll(/<img\b[^>]+>/g)].some(
      ([tag]) =>
        tag.includes(`src="${relative}"`) && tag.includes(`alt="${review.primaryCaption}"`),
    );
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !catalog ||
    digest(catalog) !== plainHash(reference.rightsEvidence?.sha256) ||
    !book ||
    digest(book) !== plainHash(reference.bookEvidence?.sha256)
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.origin !== 'gutenberg-original-public-domain-illustration' ||
    reference.license !== 'Public domain' ||
    !id ||
    reference.rightsEvidence?.sourceUrl !== `https://www.gutenberg.org/ebooks/${id}` ||
    reference.bookEvidence?.sourceUrl !== reference.sourceUrl ||
    !/<td\b[^>]*property="dcterms:rights"[^>]*>Public domain in the USA\.<\/td>/.test(html) ||
    !creator ||
    creator !== review?.catalogCreator ||
    !Number.isInteger(death) ||
    death < 1500 ||
    death > 1925 ||
    review.creatorDeathYear !== death ||
    !Array.isArray(review.creatorNameParts) ||
    review.creatorNameParts.length < 2 ||
    !review.creatorNameParts.every(
      (p) => p && creator.includes(p) && reference.artist?.includes(p),
    ) ||
    (!linkedOriginal && !embeddedCanadianOriginal && !anemasOriginal) ||
    reference.downloadUrl !== reference.sourceUrl.replace(/[^/]+$/, relative ?? '') ||
    review.status !== 'inspected' ||
    review.rendition !== 'published-book-illustration' ||
    review.illustrationIsOriginalBookContent !== true ||
    review.modernAlteration !== false
  )
    blockers.push('supplemental-gutenberg-original-public-domain-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** An explicitly public-domain Coast Guard staff photo in its primary DVIDS record. */
/** Selected official Navy originals in the archived NHHC photographic library.
 * The institutional mirror preserves the individual federal credit and exact image link. */
export function inspectHistoricalNavyReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const html = snapshot?.toString('utf8') ?? '',
    serial = reference.catalogNumber?.match(/^80-G-(\d+)$/)?.[1],
    rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)],
    row =
      rows.find((r) => plainText(r[1]).includes(`Photo #: ${reference.catalogNumber}`))?.[1] ?? '',
    credit = 'Official U.S. Navy Photograph, now in the collections of the National Archives.',
    links = [...row.matchAll(/href="([^"]+)"/gi)].map((m) => {
      try {
        return new URL(m[1], reference.sourceUrl).href;
      } catch {
        return null;
      }
    });
  if (
    reference.origin !== 'nhhc-official-navy-public-domain' ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'U.S. Navy' ||
    !serial ||
    !/^https:\/\/www\.ibiblio\.org\/hyperwar\/OnlineLibrary\/photos\/[^?#]+\.htm$/.test(
      reference.sourceUrl ?? '',
    ) ||
    !plainText(row).includes(credit) ||
    /courtesy|copyright|contractor|provided by/i.test(plainText(row)) ||
    !plainText(html).includes('pictures referenced here are all in the Public Domain') ||
    !/^https:\/\/www\.ibiblio\.org\/hyperwar\/OnlineLibrary\/photos\/images\/g\d+\/g\d+\.jpg$/.test(
      reference.downloadUrl ?? '',
    ) ||
    !reference.downloadUrl?.endsWith(`/g${serial}.jpg`) ||
    !links.includes(reference.downloadUrl) ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'published-nhhc-archive-jpeg' ||
    reference.originalReview?.primaryCredit !== credit
  )
    blockers.push('supplemental-official-navy-archive-credit-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** A NASA URL alone is insufficient: bind the named civil servant, field-work credit,
 * exact offered photograph, agency copyright policy and independently read staff report. */
export function inspectNasaStaffReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    gallery = localBytes(dir, reference.rightsEvidence?.path),
    policy = localBytes(dir, reference.copyrightEvidence?.path),
    role = localBytes(dir, reference.governmentRoleEvidence?.path),
    extraction = localBytes(dir, reference.governmentRoleEvidence?.extractionPath);
  for (const [bytes, expected, label] of [
    [image, reference.sha256, 'image'],
    [gallery, reference.rightsEvidence?.sha256, 'rights-snapshot'],
    [policy, reference.copyrightEvidence?.sha256, 'copyright-policy'],
    [role, reference.governmentRoleEvidence?.sha256, 'government-role'],
    [extraction, reference.governmentRoleEvidence?.extractionSha256, 'role-extraction'],
  ])
    if (!bytes || digest(bytes) !== plainHash(expected))
      blockers.push(`supplemental-${label}-unbound`);
  const html = gallery?.toString('utf8') ?? '',
    text = plainText(html),
    creator = reference.artist?.match(/^([A-Za-z][A-Za-z .'-]+)\/NASA GSFC$/)?.[1],
    roleDoc = extraction && snapshotJson(extraction),
    roleText = String(roleDoc?.text ?? '')
      .replace(/-\s*\n/g, '')
      .replace(/\s+/g, ' '),
    tags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]),
    offered = tags.some((tag) => {
      const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
      if (!src) return false;
      try {
        return (
          new URL(src, reference.sourceUrl).href === reference.downloadUrl &&
          Number(tag.match(/\bwidth="(\d+)"/)?.[1]) === reference.width &&
          Number(tag.match(/\bheight="(\d+)"/)?.[1]) === reference.height &&
          tag.includes(`alt="${reference.originalReview?.imageAlt}"`)
        );
      } catch {
        return false;
      }
    });
  if (
    reference.origin !== 'nasa-gsfc-civil-servant-photograph' ||
    reference.license !== 'Public domain' ||
    !creator ||
    !/^https:\/\/earth\.gsfc\.nasa\.gov\/geo\/networks\/sgp\/multimedia\/[a-z0-9-]+$/.test(
      reference.sourceUrl ?? '',
    ) ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    !text.includes(`Photos courtesy of ${reference.artist} taken during`) ||
    !text.includes(reference.originalReview?.captureDateEvidence ?? '\u0000') ||
    !offered ||
    !/^https:\/\/earth\.gsfc\.nasa\.gov\/sites\/default\/files\/styles\/carousel\/public\/gallery\/[^?#]+\.jpg\?itok=[A-Za-z0-9_-]+$/.test(
      reference.downloadUrl ?? '',
    ) ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'published-gallery-jpeg'
  )
    blockers.push('supplemental-nasa-staff-photo-unverified');
  const policyText = plainText(policy?.toString('utf8'));
  if (
    reference.copyrightEvidence?.sourceUrl !==
      'https://www.nasa.gov/nasa-brand-center/images-and-media/' ||
    !/NASA content[\s\S]{0,350}generally are not subject to copyright in the United States/.test(
      policyText,
    )
  )
    blockers.push('supplemental-nasa-government-work-policy-unverified');
  if (
    !/^https:\/\/ivscc\.gsfc\.nasa\.gov\/publications\/br\d{4}(?:%2B|\+)\d{4}\/(?:acgsfc|NASA-TP-\d+)\.pdf$/.test(
      reference.governmentRoleEvidence?.sourceUrl ?? '',
    ) ||
    !role?.subarray(0, 5).equals(Buffer.from('%PDF-')) ||
    roleDoc?.sourcePdfSha256 !== digest(role ?? Buffer.alloc(0)) ||
    !creator ||
    !roleText.includes(`civil servant, Dr. ${creator},`)
  )
    blockers.push('supplemental-nasa-civil-servant-role-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

export function inspectDvidsReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const html = snapshot?.toString('utf8') ?? '',
    id = reference.sourceUrl?.match(
      /^https:\/\/www\.dvidshub\.net\/image\/(\d+)\/[a-z0-9-]+$/,
    )?.[1],
    tableField = (name) =>
      plainText(html.match(new RegExp(`<td>${name}:</td>\\s*<td>([^<]+)</td>`))?.[1]),
    caption = html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1] ?? '',
    navy = reference.origin === 'dvids-usnavy-public-domain',
    army = reference.origin === 'dvids-usarmy-public-domain',
    captionCredit = navy
      ? caption.match(
          /\(U\.S\. Navy photo by ((?:Seaman|Petty Officer (?:1st|2nd|3rd) Class|Mass Communication Specialist (?:1st|2nd|3rd) Class) [A-Za-z'. -]+)(?:\/Released)?\)$/,
        )?.[1]
      : caption.match(/\(U\.S\. Coast Guard photo by (Chief Petty Officer [A-Za-z'. -]+)\)$/)?.[1],
    portfolioCredit = caption.match(
      /Photo by (Petty Officer (?:1st|2nd|3rd) Class [A-Za-z'. -]+)$/,
    )?.[1],
    portfolioByline = plainText(
      html.match(/<h3>Photo by <a href="\/portfolio\/\d+\/[a-z-]+">([^<]+)<\/a>/)?.[1],
    ),
    unitStaffCredit =
      reference.originalReview?.creditFormat === 'coast-guard-unit-and-staff-byline' &&
      /<h3 class="the_unit"><a href="\/unit\/USCGEast">U\.S\. Coast Guard East<\/a>/.test(html) &&
      portfolioCredit === portfolioByline,
    armyStaffCredit =
      army &&
      reference.originalReview?.creditFormat === 'army-unit-and-staff-byline' &&
      /^<h3 class="the_unit"><a href="\/unit\/(?:CJTF101|101SB-101ABN)">/.test(
        html.match(/<h3 class="the_unit">[^\n]+/)?.[0] ?? '',
      ) &&
      /^(?:Spc\.|Sgt\.) [A-Za-z'. -]+$/.test(portfolioByline),
    credit = army
      ? armyStaffCredit
        ? portfolioByline
        : undefined
      : (captionCredit ?? (!navy && unitStaffCredit ? portfolioCredit : undefined)),
    rendition = reference.downloadUrl?.match(
      /^https:\/\/d1ldvf68ux039x\.cloudfront\.net\/thumbs\/photos\/\d{4}\/(\d+)\/(1000|2000)w_q95\.jpg$/,
    );
  // A published rendition is useful photographic evidence; never call it the
  // native original. Courtesy labels alone do not establish a government author.
  if (
    ![
      'dvids-uscg-public-domain',
      'dvids-usnavy-public-domain',
      'dvids-usarmy-public-domain',
    ].includes(reference.origin) ||
    reference.license !== 'Public domain' ||
    !id ||
    tableField('Photo ID') !== id ||
    !(
      army
        ? /^\d{6}-A-[A-Z0-9]{5}-\d{3,4}$/
        : navy
          ? /^\d{6}-N-[A-Z0-9]{5}-\d{3,4}$/
          : /^\d{6}-G-[A-Z0-9]{5}-\d{3,4}$/
    ).test(tableField('VIRIN')) ||
    !credit ||
    reference.artist !== credit ||
    /copyright|contractor|courtesy|provided by/i.test(caption) ||
    !/<h4 class="public-domain">\s*PUBLIC DOMAIN\b/.test(html) ||
    !html.includes(`<meta property="og:url" content="${reference.sourceUrl}"`) ||
    rendition?.[1] !== id ||
    !html.includes(`content="${reference.downloadUrl}"`) ||
    reference.originalReview?.rendition !== 'published-jpeg-rendition' ||
    reference.width !== Number(rendition?.[2])
  )
    blockers.push('supplemental-primary-government-photo-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** NYPL's Abbott/Federal Art Project photographs, explicitly catalogued as WPA works.
 * This is institutional authorship, not a transfer uploader's self-release.
 */
export function inspectCommonsWpaReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const json = snapshotJson(snapshot);
  let title;
  try {
    const url = new URL(reference.sourceUrl);
    if (url.origin === 'https://commons.wikimedia.org' && url.pathname.startsWith('/wiki/File:'))
      title = decodeURIComponent(url.pathname.slice(6)).replaceAll('_', ' ');
  } catch {}
  const page = Object.values(json?.query?.pages ?? {}).find(
      (p) => p.title?.replaceAll('_', ' ') === title,
    ),
    revision = page?.revisions?.[0],
    body = revision?.slots?.main?.['*'] ?? '',
    value = (name) => page?.imageinfo?.[0]?.extmetadata?.[name]?.value,
    fieldValue = (name) => body.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n|]+)`))?.[1]?.trim(),
    native = page?.imageinfo?.find((i) => {
      try {
        const a = new URL(i.url),
          b = new URL(reference.downloadUrl);
        return a.origin === b.origin && a.pathname === b.pathname;
      } catch {
        return false;
      }
    });
  if (
    reference.origin !== 'commons-nypl-wpa-public-domain' ||
    !title ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'Berenice Abbott' ||
    !/\{\{\s*Nypl\s*\n/i.test(body) ||
    !/\{\{\s*Creator:Berenice Abbott\s*\}\}/i.test(body) ||
    !/\{\{\s*PD-USGov-WPA\s*\}\}/i.test(body) ||
    !/^193[5-9]-\d\d-\d\d$|^194[0-3]-\d\d-\d\d$/.test(fieldValue('date') ?? '') ||
    !/^https:\/\/digitalcollections\.nypl\.org\/items\/[a-f0-9-]{36}$/.test(
      reference.institutionUrl ?? '',
    ) ||
    fieldValue('source') !== reference.institutionUrl ||
    !/^\d+$/.test(String(reference.institutionImageId ?? '')) ||
    fieldValue('imageID') !== String(reference.institutionImageId) ||
    fieldValue('collection') !== 'Changing New York' ||
    revision?.revid !== reference.originalReview?.revision ||
    value('LicenseShortName') !== 'Public domain' ||
    value('AttributionRequired') !== 'false' ||
    plainText(value('Restrictions')) ||
    !String(value('Categories')).split('|').includes('PD US WPA') ||
    !native ||
    !/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(reference.downloadUrl ?? '') ||
    native.size !== image?.length ||
    native.width !== reference.width ||
    native.height !== reference.height ||
    native.sha1 !== reference.originalReview?.nativeSha1 ||
    (image && createHash('sha1').update(image).digest('hex') !== native?.sha1)
  )
    blockers.push('supplemental-nypl-wpa-native-provenance-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Embassy originals require the explicit DOS grant and named agency credit, not a bare PDM. */
export function inspectCommonsEmbassyReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    json = snapshotJson(snapshot);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  let title, api, download;
  try {
    const source = new URL(reference.sourceUrl);
    if (
      source.origin === 'https://commons.wikimedia.org' &&
      source.pathname.startsWith('/wiki/File:')
    )
      title = decodeURIComponent(source.pathname.slice(6)).replaceAll('_', ' ');
    api = new URL(json?.source);
    download = new URL(reference.downloadUrl);
  } catch {}
  const page = Object.values(json?.query?.pages ?? {}).find((p) => p.title === title),
    native = page?.imageinfo?.[0],
    body = page?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    value = (name) => native?.extmetadata?.[name]?.value,
    id = reference.flickrId;
  let nativeUrl;
  try {
    nativeUrl = new URL(native?.url);
  } catch {}
  if (
    reference.origin !== 'commons-us-embassy-government-photo' ||
    !/^\d{11}$/.test(id ?? '') ||
    title !== `File:Emb. George visita UPM (${id}).jpg` ||
    api?.origin !== 'https://commons.wikimedia.org' ||
    api?.pathname !== '/w/api.php' ||
    api?.searchParams.get('action') !== 'query' ||
    !['imageinfo', 'revisions'].every((p) =>
      api?.searchParams.get('prop')?.split('|').includes(p),
    ) ||
    !api?.searchParams.get('titles')?.split('|').includes(title) ||
    !page?.revisions?.[0]?.revid ||
    !/\{\{\s*PD-USGov-DOS\s*\}\}/.test(body) ||
    reference.photographer !== 'Juan Francisco Casal' ||
    !body.includes('[U.S. Embassy photo: Juan Francisco Casal /') ||
    !body.includes(
      `[https://www.flickr.com/photos/usembassy_montevideo/${id}/ Emb. George visita UPM]`,
    ) ||
    !body.includes(
      '[https://www.flickr.com/people/41243200@N08 Embajada de los Estados Unidos en Uruguay]',
    ) ||
    !new RegExp(
      `\\{\\{FlickreviewR\\|status=passed\\|author=U.S. Embassy Montevideo\\|sourceurl=https://flickr.com/photos/41243200@N08/${id}\\|[^}]*\\|reviewlicense=Public Domain Mark\\|`,
    ).test(body) ||
    reference.artist !== 'Embajada de los Estados Unidos en Uruguay from Montevideo, Uruguay' ||
    plainText(value('Artist')) !== reference.artist ||
    reference.license !== 'Public domain' ||
    value('LicenseShortName') !== 'Public domain' ||
    value('AttributionRequired') !== 'false' ||
    plainText(value('Restrictions')) ||
    nativeUrl?.origin !== 'https://upload.wikimedia.org' ||
    nativeUrl?.pathname.includes('/thumb/') ||
    nativeUrl?.pathname !== download?.pathname ||
    download?.origin !== nativeUrl?.origin ||
    native?.width !== reference.width ||
    native?.height !== reference.height ||
    native?.size !== image?.length ||
    (image && createHash('sha1').update(image).digest('hex') !== native?.sha1) ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'native-original'
  )
    blockers.push('supplemental-embassy-native-provenance-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

export function inspectCommonsSelfReference(dir, reference) {
  if (
    [
      'english-wikipedia-archived-author-original',
      'chinese-wikipedia-archived-author-original',
      'commons-archived-own-camera-photograph',
      'commons-archived-confirmed-self-release',
    ].includes(reference.creatorDedication?.kind)
  )
    return inspectArchivedAuthorReference(dir, reference);
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const json = snapshotJson(snapshot);
  let title = null;
  try {
    const u = new URL(reference.sourceUrl);
    if (
      u.protocol === 'https:' &&
      u.hostname === 'commons.wikimedia.org' &&
      u.pathname.startsWith('/wiki/File:')
    )
      title = decodeURIComponent(u.pathname.slice(6)).replaceAll('_', ' ');
  } catch {}
  const page = Object.values(json?.query?.pages ?? {}).find(
      (p) => p.title?.replaceAll('_', ' ') === title,
    ),
    info = page?.imageinfo?.[0],
    meta = info?.extmetadata,
    value = (k) => meta?.[k]?.value;
  const revisionText = page?.revisions?.[0]?.slots?.main;
  const body = revisionText?.['*'] ?? revisionText?.content ?? '';
  const dedication = reference.creatorDedication;
  // Some early Commons originals predate the Information template. Their
  // uploader's first revision can itself contain the explicit copyright-holder
  // release; bind that same account, original upload, time and sole file version.
  const first = page?.revisions?.[0];
  // An old untemplated upload can explicitly name its photographer even when
  // later metadata falls back to an "author assumed" label. Use the original
  // signed declaration only when every native version is from that same account.
  const originalNamedPhotographerRelease =
    reference.origin === 'commons-self-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.kind === 'original-named-photographer-native-history' &&
    /^[A-Za-z0-9_-]+$/.test(dedication.username ?? '') &&
    dedication.username === reference.artist &&
    dedication.username === first?.user &&
    dedication.revision === first?.revid &&
    first?.parentid === 0 &&
    page.imageinfo.length > 0 &&
    !json?.continue?.iicontinue &&
    page.imageinfo.every((i) => i.user === dedication.username) &&
    Number.isFinite(Date.parse(first.timestamp)) &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(page.imageinfo.at(-1).timestamp)) < 300000 &&
    new RegExp(`^Author ${dedication.username}\\.`, 'im').test(body) &&
    /\{\{\s*PD-self\s*(?:\||\}\})/i.test(body);
  const contemporaneousUploaderRelease =
    reference.origin === 'commons-self-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.kind === 'contemporaneous-original-uploader-release' &&
    dedication.username === reference.artist &&
    dedication.username === first?.user &&
    dedication.username === info?.user &&
    dedication.revision === first?.revid &&
    first?.parentid === 0 &&
    page.imageinfo.length === 1 &&
    !json?.continue?.iicontinue &&
    Number.isFinite(Date.parse(first.timestamp)) &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
    ((!plainText(value('Artist')) && !plainText(value('Credit'))) ||
      (/^Own work\s*$/im.test(body) &&
        plainText(value('Artist')) ===
          `No machine-readable author provided. ${dedication.username} assumed (based on copyright claims).` &&
        plainText(value('Credit')) ===
          'No machine-readable source provided. Own work assumed (based on copyright claims).')) &&
    /\{\{\s*PD-self\s*(?:\||\}\})/i.test(body);
  // Early untemplated uploads can sign a personal photograph with a real name.
  // The original signature must resolve exactly to the uploading account; a
  // later automatically assumed author label alone never establishes authorship.
  const signedPersonalPhotographRelease =
    reference.origin === 'commons-self-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.kind === 'contemporaneous-signed-personal-photograph' &&
    /^[A-Za-z]+(?: [A-Za-z]+)+$/.test(dedication.realName ?? '') &&
    dedication.realName.replaceAll(' ', '').toLowerCase() === dedication.username?.toLowerCase() &&
    dedication.username === reference.artist &&
    dedication.username === first?.user &&
    dedication.username === info?.user &&
    dedication.revision === first?.revid &&
    first?.parentid === 0 &&
    page.imageinfo.length === 1 &&
    !json?.continue?.iicontinue &&
    Number.isFinite(Date.parse(first.timestamp)) &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
    Number.isInteger(dedication.photographedYear) &&
    dedication.photographedYear >= 1990 &&
    dedication.photographedYear <= Number(first.timestamp.slice(0, 4)) &&
    body
      .split('\n')
      .some((line) =>
        line.startsWith(`${dedication.realName}, personal file, ${dedication.photographedYear}.`),
      ) &&
    plainText(value('Artist')) ===
      `No machine-readable author provided. ${dedication.username} assumed (based on copyright claims).` &&
    plainText(value('Credit')) ===
      'No machine-readable source provided. Own work assumed (based on copyright claims).' &&
    /\{\{\s*PD-self\s*\}\}/i.test(body) &&
    !/\{\{\s*(?:PD-user|copyright)/i.test(body);
  // Match the original Japanese photographer credit and its rendered metadata.
  // The first upload must carry the release and identify that same photographer.
  const formerJapaneseAccount = dedication?.originalAccount;
  const signedJapanesePhotographerRelease =
    typeof formerJapaneseAccount === 'string' &&
    formerJapaneseAccount.length > 0 &&
    formerJapaneseAccount !== dedication.username &&
    body.includes(`|Source=[[User:${formerJapaneseAccount}|${formerJapaneseAccount}]]`) &&
    /^\|Author=投稿者が撮影\s*$/m.test(body) &&
    plainText(value('Artist')) === '投稿者が撮影' &&
    plainText(value('Credit')).startsWith(`${formerJapaneseAccount} (talk)`) &&
    json?.authorAccountHistory?.renameRecord?.query?.logevents?.some(
      (event) =>
        event.title === `User:${formerJapaneseAccount}` &&
        Number.isInteger(event.logid) &&
        event.logid > 0 &&
        event.params?.olduser === formerJapaneseAccount &&
        event.params?.newuser === dedication.username &&
        Date.parse(event.timestamp) > Date.parse(first?.timestamp),
    );
  const japanesePhotographerRelease =
    reference.origin === 'commons-self-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.kind === 'contemporaneous-japanese-photographer-release' &&
    dedication.username === reference.artist &&
    dedication.username === first?.user &&
    dedication.username === info?.user &&
    dedication.revision === first?.revid &&
    first?.parentid === 0 &&
    page.imageinfo.length === 1 &&
    !json?.continue?.iicontinue &&
    Number.isFinite(Date.parse(first.timestamp)) &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
    /\{\{\s*PD-self\s*\}\}/i.test(body) &&
    ((/^\|\s*Source\s*=\s*自身で撮影\s*$/m.test(body) &&
      body.split(/\r?\n/).includes(`|Author=${dedication.username}`) &&
      plainText(value('Credit')) === '自身で撮影' &&
      plainText(value('Artist')) === dedication.username) ||
      (/\|\s*Source\s*=\s*現地で撮影\s*(?:\n|\|)/.test(body) &&
        body.includes(`[[利用者:${dedication.username}|${dedication.username}]]`) &&
        plainText(value('Credit')) === '現地で撮影' &&
        plainText(value('Artist')) === `${dedication.username}（会話）`) ||
      signedJapanesePhotographerRelease);
  // A migrated author's explicit grant remains usable, but the granting account,
  // linked author and original file must all agree. A generic PD-user tag cannot qualify.
  const migratedNamedRelease =
    reference.origin === 'commons-author-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.wiki === 'en' &&
    dedication.project === 'English Wikipedia' &&
    /^[A-Za-z0-9_-]+$/.test(dedication.username ?? '') &&
    dedication.profileUrl === `https://en.wikipedia.org/wiki/User:${dedication.username}` &&
    /^https:\/\/en\.wikipedia\.org\/wiki\/(?:Image|File):[^?#]+$/.test(
      dedication.originalFileUrl ?? '',
    ) &&
    body
      .replace(/\s*\|\s*/g, '|')
      .includes(`{{PD-user-w|en|English Wikipedia|${dedication.username}}}`) &&
    body.includes(`:en:User:${dedication.username}|${reference.artist}`) &&
    String(value('Artist')).includes(`href="${dedication.profileUrl}"`) &&
    String(value('Credit')).includes(`href="${dedication.originalFileUrl}"`) &&
    value('Permission') === 'PD' &&
    value('Copyrighted') === 'False';
  // PD-user-en is the English-Wikipedia form of the same creator dedication.
  // Require its exact named original upload log as well as the transfer credit,
  // explicit author release, original filename, dimensions and native byte size.
  const originalFileName = dedication?.originalFileUrl?.split('/wiki/File:')[1],
    originalUpload = dedication?.originalUpload,
    compactBody = body.replace(/\s*\|\s*/g, '|');
  const originalUploadRow = `${originalUpload?.timestamp} [[:en:User:${dedication?.username}|${dedication?.username}]] ${originalUpload?.width}×${originalUpload?.height}× (${originalUpload?.bytes} bytes)`,
    digitalPhotoDate = originalUpload?.photographedDateText?.replace(
      /^(\d{1,2})(?:st|nd|rd|th) /,
      '$1 ',
    ),
    digitalPhotoTime = Date.parse(`${digitalPhotoDate} UTC`),
    digitalPhotographerDeclaration =
      dedication?.kind === 'english-wikipedia-original-digital-photograph' &&
      /^[A-Za-z][A-Za-z -]{1,100}$/.test(dedication.photographSubject ?? '') &&
      /^\d{1,2}(?:st|nd|rd|th) [A-Za-z]+ \d{4}$/.test(originalUpload?.photographedDateText ?? '') &&
      Number.isFinite(digitalPhotoTime) &&
      !/\{\{\s*(?:cc-by|gfdl|copyright)/i.test(body) &&
      new Date(digitalPhotoTime).toISOString().slice(0, 10) ===
        originalUpload?.timestamp?.slice(0, 10) &&
      originalFileName?.startsWith(`${dedication.photographSubject.replaceAll(' ', '_')}_`) &&
      body
        .split('\n')
        .some(
          (line) =>
            line.includes(originalUploadRow) &&
            line.includes(
              `<nowiki>A Digital Photograph of ${dedication.photographSubject} taken on the ${originalUpload.photographedDateText} by [[${dedication.username?.toLowerCase()}]]</nowiki>`,
            ),
        );
  // Some transfers credit the photographer in the description rather than the upload comment.
  // The existing exact account/grant/upload-row/byte checks still apply.
  const describedPhotographerDeclaration =
    dedication?.kind === 'english-wikipedia-photographer-described-upload' &&
    body.includes(`Photo taken by [[:en:User:${dedication.username}|${dedication.username}]]`);
  // A transferred original may name the photographer in its original caption.
  // The granting account must still be the native Author and original uploader;
  // no inference from a public profile or similarity of names is needed.
  const originalCaptionPhotographerDeclaration =
    dedication?.kind === 'english-wikipedia-original-photographer-caption' &&
    /^[A-Za-z][A-Za-z .'-]{2,100}$/.test(dedication.photographerName ?? '') &&
    page.imageinfo.length === 1 &&
    !json?.continue?.iicontinue &&
    compactBody.includes(`|Author={{user at project|${dedication.username}|wikipedia|en}}`) &&
    compactBody.includes(`|Description={{en|Taken by ${dedication.photographerName}}}`) &&
    body
      .split('\n')
      .some(
        (line) =>
          line.includes(originalUploadRow) &&
          line.includes(`<nowiki>Taken by ${dedication.photographerName}</nowiki>`),
      ) &&
    ['File Upload Bot (Magnus Manske)', 'OgreBot'].includes(info?.user) &&
    Number.isFinite(Date.parse(info?.timestamp)) &&
    Date.parse(info.timestamp) >
      Date.parse(`${originalUpload?.timestamp?.replace(' ', 'T')}:00Z`) &&
    !meta?.Permission;
  const migratedOriginalUploadRelease =
    reference.origin === 'commons-author-public-domain' &&
    reference.license === 'Public domain' &&
    [
      'english-wikipedia-original-upload',
      'english-wikipedia-original-digital-photograph',
      'english-wikipedia-photographer-described-upload',
      'english-wikipedia-original-photographer-caption',
    ].includes(dedication?.kind) &&
    dedication.wiki === 'en' &&
    dedication.project === 'English Wikipedia' &&
    /^[A-Za-z0-9_-]+$/.test(dedication.username ?? '') &&
    dedication.profileUrl === `https://en.wikipedia.org/wiki/User:${dedication.username}` &&
    /^https:\/\/en\.wikipedia\.org\/wiki\/File:[A-Za-z0-9_.-]+$/.test(
      dedication.originalFileUrl ?? '',
    ) &&
    compactBody.includes(`{{PD-user-en|${dedication.username}}}`) &&
    compactBody.includes(`{{user at project|${dedication.username}|wikipedia|en}}`) &&
    compactBody.includes(`{{original description page|en.wikipedia|${originalFileName}}}`) &&
    plainText(value('Artist')) === `${dedication.username} at English Wikipedia` &&
    String(value('Artist')).includes(`href="${dedication.profileUrl}"`) &&
    /Transferred from/.test(plainText(value('Credit'))) &&
    String(value('Credit')).includes('href="https://en.wikipedia.org"') &&
    (value('Permission') === 'Released into the public domain (by the author)' ||
      (digitalPhotographerDeclaration && !meta?.Permission) ||
      originalCaptionPhotographerDeclaration) &&
    value('Copyrighted') === 'False' &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(originalUpload?.timestamp ?? '') &&
    originalUpload.width === info?.width &&
    originalUpload.height === info?.height &&
    originalUpload.bytes === info?.size &&
    image?.length === info?.size &&
    body.includes(originalUploadRow) &&
    ((dedication.kind === 'english-wikipedia-original-upload' &&
      body
        .toLowerCase()
        .includes(`contributor (${dedication.username.toLowerCase()}), self taken`)) ||
      digitalPhotographerDeclaration ||
      describedPhotographerDeclaration ||
      originalCaptionPhotographerDeclaration);
  // For-the-Common-Good transfers preserve a different original-upload table:
  // the granting account is an `uv` link and the photographer can use a real
  // display name. Bind that complete row to the native file and named author.
  const namedUploadRows = [
    ...body.matchAll(
      /\|\s*(\d{2}:\d{2}, \d{1,2} [A-Za-z]+ \d{4})\s*\|\|\s*([\d,]+)\s*×\s*([\d,]+)\s*\(([\d,]+) bytes\)\s*\|\|\s*\{\{uv\|([^|}]+)\|w:en:\}\}\s*\|\|\s*<nowiki>([^<]+)<\/nowiki>/g,
    ),
  ];
  const migratedNamedPhotographerRelease =
    reference.origin === 'commons-author-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.kind === 'english-wikipedia-original-named-photographer' &&
    dedication.wiki === 'en' &&
    dedication.project === 'English Wikipedia' &&
    /^[A-Za-z0-9_-]+$/.test(dedication.username ?? '') &&
    dedication.profileUrl === `https://en.wikipedia.org/wiki/User:${dedication.username}` &&
    /^https:\/\/en\.wikipedia\.org\/wiki\/File:[A-Za-z0-9_.-]+$/.test(
      dedication.originalFileUrl ?? '',
    ) &&
    compactBody.includes(`{{PD-user-en|${dedication.username}}}`) &&
    compactBody.includes('{{own work by original uploader}}') &&
    compactBody.includes('{{transferred from|en.wikipedia||ftcg}}') &&
    compactBody.includes(`{{original description page|en.wikipedia|${originalFileName}}}`) &&
    body.includes(`:en:User:${dedication.username}|${reference.artist}`) &&
    String(value('Artist')).includes(`href="${dedication.profileUrl}"`) &&
    plainText(value('Artist')) === reference.artist &&
    plainText(value('Credit')) === 'Own work by the original uploader' &&
    value('Copyrighted') === 'False' &&
    namedUploadRows.some(
      (row) =>
        row[1] === originalUpload?.timestamp &&
        Number.isFinite(Date.parse(row[1].replace(/^(\d{2}:\d{2}), (.+)$/, '$2 $1 UTC'))) &&
        row[5] === dedication.username &&
        row[6].startsWith(`${reference.artist},`) &&
        Number(row[2].replaceAll(',', '')) === info?.width &&
        Number(row[3].replaceAll(',', '')) === info?.height &&
        Number(row[4].replaceAll(',', '')) === info?.size &&
        image?.length === info?.size,
    );
  // Earlier English-Wikipedia transfers use a bit-depth upload log, with the
  // photographer's explicit first-person source preserved as "Image taken by".
  // Bind the named author grant, original filename, account and exact native dimensions.
  const migratedSelfPhotographedRelease =
    reference.origin === 'commons-author-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.kind === 'english-wikipedia-self-photographed-upload' &&
    dedication.wiki === 'en' &&
    dedication.project === 'English Wikipedia' &&
    /^[A-Za-z0-9_-]+$/.test(dedication.username ?? '') &&
    /^[A-Za-z][A-Za-z .'-]+$/.test(dedication.realName ?? '') &&
    reference.artist === `${dedication.username} (${dedication.realName})` &&
    dedication.profileUrl === `https://en.wikipedia.org/wiki/User:${dedication.username}` &&
    /^https:\/\/en\.wikipedia\.org\/wiki\/File:[A-Za-z0-9_.-]+$/.test(
      dedication.originalFileUrl ?? '',
    ) &&
    compactBody.includes(`{{PD-user-en|${dedication.username}}}`) &&
    compactBody.includes(`{{original description page|en.wikipedia|${originalFileName}}}`) &&
    body.includes(
      `Author=[[:en:User:${dedication.username}|${dedication.username}]] (${dedication.realName})`,
    ) &&
    String(value('Artist')).includes(`href="${dedication.profileUrl}"`) &&
    plainText(value('Artist')) === reference.artist &&
    /Transferred from/.test(plainText(value('Credit'))) &&
    String(value('Credit')).includes('href="https://en.wikipedia.org"') &&
    value('Copyrighted') === 'False' &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(originalUpload?.timestamp ?? '') &&
    Number.isFinite(Date.parse(`${originalUpload.timestamp.replace(' ', 'T')}:00Z`)) &&
    originalUpload.width === info?.width &&
    originalUpload.height === info?.height &&
    Number.isInteger(originalUpload.bitDepth) &&
    originalUpload.bitDepth > 0 &&
    /^\d{4}$/.test(String(originalUpload.photographedYear)) &&
    body.includes(
      `${originalUpload.timestamp} [[:en:User:${dedication.username}|${dedication.username}]] ${originalUpload.width}×${originalUpload.height}×${originalUpload.bitDepth}`,
    ) &&
    body.includes(`Image taken by ${dedication.realName} ${originalUpload.photographedYear}.`);
  // German transfers preserve either a dated own-photograph credit or the
  // original Information template. Bind the named creator, explicit grant and
  // complete original upload declaration to the same native image bytes.
  let germanOriginalName;
  try {
    const u = new URL(dedication?.originalFileUrl);
    if (
      u.origin === 'https://de.wikipedia.org' &&
      /^\/wiki\/(?:Image|File):[^?#]+$/.test(u.pathname)
    )
      germanOriginalName = decodeURIComponent(
        u.pathname.replace(/^\/wiki\/(?:Image|File):/, ''),
      ).replaceAll('_', ' ');
  } catch {}
  const germanOwnCredit =
    dedication?.kind === 'german-wikipedia-original-own-photograph' &&
    body
      .split('\n')
      .some(
        (line) =>
          line.includes(
            `${originalUpload?.timestamp} . . ${dedication?.username} (Diskussion) . . ${originalUpload?.width} x ${originalUpload?.height} (${originalUpload?.bytes} Byte)`,
          ) &&
          line.includes(
            `* eigene Aufnahme * ${dedication?.realName} (${dedication?.username}) * ${originalUpload?.photographedDateText}`,
          ),
      );
  const germanOwnTemplate =
    dedication?.kind === 'german-wikipedia-original-own-template' &&
    body
      .split('\n')
      .some(
        (line) =>
          line.includes(
            `${originalUpload?.timestamp} [[:de:User:${dedication?.username}|${dedication?.username}]] ${originalUpload?.width}×${originalUpload?.height}× (${originalUpload?.bytes} bytes)`,
          ) &&
          line.includes(
            '|Quelle = selbst fotografiert |Urheber = ~~~ |Datum = ' +
              originalUpload?.photographedDateText +
              ' |',
          ),
      );
  const migratedGermanPhotographerRelease =
    reference.origin === 'commons-author-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.wiki === 'de' &&
    dedication.project === 'German Wikipedia' &&
    /^[A-Za-z0-9_-]+$/.test(dedication.username ?? '') &&
    /^[A-Za-z][A-Za-z .'-]+$/.test(dedication.realName ?? '') &&
    ['User', 'Benutzer'].some(
      (ns) =>
        dedication.profileUrl === `https://de.wikipedia.org/wiki/${ns}:${dedication.username}`,
    ) &&
    String(value('Artist')).includes(`href="${dedication.profileUrl}"`) &&
    plainText(value('Artist')) === reference.artist &&
    value('Copyrighted') === 'False' &&
    !/\{\{\s*(?:cc-by|gfdl|copyright)/i.test(body) &&
    germanOriginalName &&
    originalUpload.width === info?.width &&
    originalUpload.height === info?.height &&
    originalUpload.bytes === info?.size &&
    image?.length === info?.size &&
    ((germanOwnCredit &&
      /^\d{2}:\d{2}, \d{1,2}\. [A-Za-zÄÖÜäöü]+ \d{4}$/.test(originalUpload.timestamp ?? '') &&
      /^\d{2}\/\d{4}$/.test(originalUpload.photographedDateText ?? '') &&
      compactBody.includes(`{{PD-user-de|${dedication.username}}}`) &&
      body.includes(
        `Author= ${dedication.realName} ([[:de:User:${dedication.username}|${dedication.realName}]])`,
      ) &&
      body.includes(`:de:Image:${germanOriginalName}|de.wikipedia.org`) &&
      String(value('Credit')).includes(`href="${dedication.originalFileUrl}"`) &&
      /released into the public domain.*by its author/i.test(plainText(value('Permission'))) &&
      plainText(value('Permission')).includes(
        `${dedication.username} grants anyone the right to use this work`,
      ) &&
      reference.artist === `${dedication.realName} (${dedication.realName})`) ||
      (germanOwnTemplate &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(originalUpload.timestamp ?? '') &&
        /^\d{2}\.\d{2}\.\d{4}$/.test(originalUpload.photographedDateText ?? '') &&
        compactBody.includes('{{PD-release}}') &&
        compactBody.includes(`{{original description page|de.wikipedia|${germanOriginalName}}}`) &&
        /\|\s*Source\s*=\s*\{\{own\}\}/.test(body) &&
        body.includes(`|Author=[[:de:Benutzer:${dedication.username}|${dedication.username}]]`) &&
        plainText(value('Credit')) === 'Own work' &&
        value('Permission') === 'Released into the public domain (by the author).' &&
        reference.artist === dedication.username &&
        dedication.realName === dedication.username));
  const migratedAirknightPavilion =
    reference.origin === 'commons-author-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.kind === 'airknight-naulakha-original-upload' &&
    title === 'File:Naulakha 3.jpg' &&
    reference.artist === 'Airknight at English Wikipedia' &&
    compactBody.includes('{{PD-user-w|en|wikipedia|Airknight}}') &&
    body.includes('Picture by Kaiser Tufail, 25 Sep 2006') &&
    body.includes('|Permission=Released into the public domain (by the author).') &&
    body.includes(
      '2006-09-26 10:03 [[:en:User:Airknight|Airknight]] 1024&times;768&times;8 (153114 bytes)',
    ) &&
    body.includes('Image%3ANaulakha_3.jpg') &&
    first?.parentid === 0 &&
    first.user === 'File Upload Bot (Magnus Manske)' &&
    info?.user === first.user &&
    info.sha1 === '34aec304d4f524b6e9d8446b926255f4fe31b131' &&
    info.size === 153114 &&
    String(value('Artist')).includes('href="https://en.wikipedia.org/wiki/User:Airknight"') &&
    value('Copyrighted') === 'False';
  const migratedCreatorRelease =
    migratedNamedRelease ||
    migratedOriginalUploadRelease ||
    migratedNamedPhotographerRelease ||
    migratedSelfPhotographedRelease ||
    migratedGermanPhotographerRelease ||
    migratedAirknightPavilion;
  // A direct upload can name the creator's other-wiki account in its grant.
  // Require that same creator to have authored the first Commons revision at
  // the sole native upload, rather than trusting a later transfer template.
  const contemporaneousNamedUploaderRelease =
    reference.origin === 'commons-self-public-domain' &&
    reference.license === 'Public domain' &&
    dedication?.kind === 'contemporaneous-named-uploader-release' &&
    dedication.wiki === 'zh' &&
    dedication.project === 'Chinese Wikipedia' &&
    dedication.username === reference.artist &&
    dedication.username === first?.user &&
    dedication.username === info?.user &&
    dedication.revision === first?.revid &&
    first?.parentid === 0 &&
    page.imageinfo.length === 1 &&
    Number.isFinite(Date.parse(first.timestamp)) &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
    dedication.profileUrl ===
      `https://zh.wikipedia.org/wiki/User:${dedication.username.replaceAll(' ', '_')}` &&
    compactBody.includes(`{{PD-user-w|zh|Chinese Wikipedia|${dedication.username}}}`) &&
    body.includes(`:zh:User:${dedication.username}|${dedication.username}`) &&
    /Own work|Self-photographed/i.test(body) &&
    plainText(value('Artist')) === dedication.username &&
    String(value('Artist')).includes(`href="${dedication.profileUrl}"`);
  // Commons also renders an empty self declaration followed by a standalone
  // CC0 template as the photographer's first-person copyright-holder release.
  // A standalone CC0 tag alone does not establish that creator relationship.
  const selfCc0 =
    /\{\{\s*self\s*\|[^}]*\bcc-zero\s*(?:\||\}\})/i.test(body) ||
    (/\{\{\s*self\s*\}\}/i.test(body) && /\{\{\s*cczero\s*\}\}/i.test(body)) ||
    (reference.license === 'CC0' &&
      /^[A-Za-z0-9_-]+$/.test(reference.artist ?? '') &&
      /\|\s*source\s*=\s*\{\{\s*own\s*\}\}/i.test(body) &&
      body.includes(`|Author=[[User:${reference.artist}|${reference.artist}]]`) &&
      /\|\s*permission\s*=\s*\{\{\s*cc0\s*\}\}/i.test(body) &&
      /\{\{\s*cc0\s*\}\}/i.test(body));
  const originalUploaderCc0 =
    reference.origin === 'commons-self-public-domain' &&
    reference.license === 'CC0' &&
    dedication?.kind === 'contemporaneous-cc0-uploader-release' &&
    /^[A-Za-z0-9_.-]+$/.test(dedication.username ?? '') &&
    dedication.username === reference.artist &&
    dedication.username === first?.user &&
    dedication.username === info?.user &&
    dedication.revision === first?.revid &&
    first?.parentid === 0 &&
    page.imageinfo.length === 1 &&
    !json?.continue?.iicontinue &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
    info.size === image?.length &&
    /^\|\s*source\s*=\s*(?:\{\{\s*own\s*\}\}|self-made)\s*$/im.test(body) &&
    body.split('\n').some((line) => {
      const author = line.match(/^\|\s*author\s*=\s*(.+?)\s*$/i)?.[1];
      return author === `[[User:${dedication.username}|${dedication.username}]]`;
    }) &&
    /^\{\{\s*cc-zero\s*\}\}\s*$/im.test(body) &&
    plainText(value('Credit')) === 'Own work';
  const release =
    originalNamedPhotographerRelease ||
    migratedCreatorRelease ||
    contemporaneousNamedUploaderRelease ||
    originalUploaderCc0 ||
    (reference.license === 'Public domain'
      ? /\{\{\s*PD-self\s*(?:\||\}\})/i.test(body) || selfCc0
      : /^CC0(?: 1\.0)?$/.test(reference.license ?? '') && selfCc0);
  const ukrainianOriginal = json?.originalUkrainianRevision;
  const ukrainianAuthor = ukrainianOriginal?.slots?.main?.['*']
    ?.match(/^\|Автор=([^\r\n]+)$/m)?.[1]
    ?.trim();
  const ownPhotograph =
    /Own work|Self-photographed/i.test(plainText(value('Credit'))) ||
    (plainText(value('Credit')) === 'taken by author' &&
      /\|\s*source\s*=\s*taken by author\s*(?:\n|\|)/i.test(body)) ||
    (plainText(value('Credit')) === 'I took it' &&
      /\|\s*source\s*=\s*I took it\s*(?:\n|\|)/i.test(body)) ||
    (reference.license === 'Public domain' &&
      dedication?.kind === 'contemporaneous-photographers-own-files' &&
      dedication.username === first?.user &&
      dedication.username === info?.user &&
      dedication.revision === first?.revid &&
      first?.parentid === 0 &&
      page.imageinfo.length === 1 &&
      !json?.continue?.iicontinue &&
      Date.parse(first.timestamp) === Date.parse(info.timestamp) &&
      info.size === image?.length &&
      plainText(value('Credit')) === "Photographer's own files" &&
      /^\|Source=Photographer's own files$/m.test(body) &&
      body.split('\n').includes(`|Author=${reference.artist}`) &&
      /^\{\{PD-self\}\}$/m.test(body)) ||
    (reference.license === 'Public domain' &&
      plainText(value('Credit')) === "uploader's creation" &&
      /^[A-Za-z0-9_-]+$/.test(info?.user ?? '') &&
      info.user === reference.artist &&
      /\|\s*source\s*=\s*uploader's creation\s*(?:\n|\|)/i.test(body) &&
      body.includes(`[[User:${info.user}|${info.user}]]`) &&
      /\{\{\s*PD-self\s*\}\}/i.test(body)) ||
    (plainText(value('Credit')) === 'власна' &&
      /\|\s*Source\s*=\s*власна\s*(?:\n|\|)/u.test(body) &&
      body.includes('https://uk.wikipedia.org/wiki/') &&
      ukrainianOriginal?.parentid === 0 &&
      ukrainianOriginal.user === info?.user &&
      ukrainianAuthor === reference.artist &&
      ukrainianAuthor?.toLowerCase() === info?.user?.toLowerCase() &&
      Math.abs(Date.parse(ukrainianOriginal.timestamp) - Date.parse(info?.timestamp)) < 300000 &&
      /\{\{\s*PD-self\s*\}\}/i.test(ukrainianOriginal.slots.main['*']));
  let sameDownload = false;
  try {
    const a = new URL(reference.downloadUrl),
      b = new URL(info?.url);
    sameDownload =
      a.protocol === 'https:' &&
      a.hostname === 'upload.wikimedia.org' &&
      a.origin + a.pathname === b.origin + b.pathname;
  } catch {}
  if (
    !['commons-self-public-domain', 'commons-author-public-domain'].includes(reference.origin) ||
    (reference.origin === 'commons-author-public-domain' && !migratedCreatorRelease) ||
    !page?.revisions?.[0]?.revid ||
    !release ||
    !sameDownload ||
    value('LicenseShortName') !== reference.license ||
    value('AttributionRequired') !== 'false' ||
    plainText(value('Restrictions')) ||
    (!migratedCreatorRelease &&
      !contemporaneousUploaderRelease &&
      !signedPersonalPhotographRelease &&
      !japanesePhotographerRelease &&
      !originalNamedPhotographerRelease &&
      !ownPhotograph) ||
    !reference.artist?.trim() ||
    (!contemporaneousUploaderRelease &&
      !signedPersonalPhotographRelease &&
      !japanesePhotographerRelease &&
      !originalNamedPhotographerRelease &&
      plainText(value('Artist')) !== reference.artist) ||
    !image ||
    createHash('sha1').update(image).digest('hex') !== info?.sha1
  )
    blockers.push('supplemental-creator-public-domain-release-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

// Commons publishes the photographer's grant for a verified uploader through
// this template. Bind the exact native bytes and the file's permission record.
function inspectCommonsVrtCc0Reference(dir, reference) {
  const blockers = [];
  const image = localBytes(dir, reference.path);
  const snapshot = localBytes(dir, reference.rightsEvidence?.path);
  const pages = Object.values(snapshotJson(snapshot)?.query?.pages ?? {});
  const template = pages.find((page) => page.title === 'Template:MSW permission');
  const page = pages.find((item) => item.title === `File:${reference.filename}`);
  const info = page?.imageinfo?.[0];
  const body = page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
  const templateBody = template?.revisions?.[0]?.slots?.main?.['*'] ?? '';
  const artist = reference.artist ?? '';
  const ticket = reference.creatorDedication?.ticket ?? '';
  const uploader = 'Ms Sarah Welch';
  const metadata = (key) => info?.extmetadata?.[key]?.value;
  if (
    !image ||
    digest(image) !== plainHash(reference.sha256) ||
    image.length !== info?.size ||
    createHash('sha1').update(image).digest('hex') !== info?.sha1
  )
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.sourceUrl !== info?.descriptionurl ||
    reference.downloadUrl !== info?.url ||
    !info?.url?.startsWith('https://upload.wikimedia.org/') ||
    !page?.revisions?.[0]?.revid ||
    !template?.revisions?.[0]?.revid ||
    !/^[A-Za-z][A-Za-z .'-]+$/.test(artist) ||
    !/^\d{16}$/.test(ticket) ||
    info.user !== uploader ||
    !body.includes(`|source=${artist} (OTRS ${ticket})`) ||
    !body.includes(`|author=${artist}\n`) ||
    !body.includes(`{{MSW permission|${artist}}}`) ||
    !templateBody.includes(
      `|${artist} = ''Photographs created by ${artist}, India uploaded by [[User:${uploader}]] are released as CC-0.''`,
    ) ||
    reference.license !== 'CC0' ||
    metadata('LicenseShortName') !== 'CC0' ||
    metadata('AttributionRequired') !== 'false' ||
    plainText(metadata('Restrictions'))
  )
    blockers.push('supplemental-commons-vrt-cc0-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** A photographer's primary CC0 dedication, with the exact Commons transfer pinned. */
export function inspectFlickrCc0Reference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    catalog = localBytes(dir, reference.catalogEvidence?.path),
    primary = localBytes(dir, reference.rightsEvidence?.path),
    dedication = reference.creatorDedication;
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !catalog ||
    digest(catalog) !== plainHash(reference.catalogEvidence?.sha256) ||
    !primary ||
    digest(primary) !== plainHash(reference.rightsEvidence?.sha256)
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  const page = Object.values(snapshotJson(catalog)?.query?.pages ?? {}).find(
      (p) =>
        reference.sourceUrl ===
        `https://commons.wikimedia.org/wiki/${p.title.replaceAll(' ', '_')}`,
    ),
    info = page?.imageinfo?.[0],
    meta = info?.extmetadata,
    body = page?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    html = primary?.toString('utf8') ?? '',
    objects = [
      ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
    ].flatMap((m) => {
      const j = snapshotJson(m[1]);
      return j?.['@graph'] ?? (j ? [j] : []);
    }),
    photo = objects.find((o) => o['@type'] === 'ImageObject'),
    id = dedication?.photoId,
    account = dedication?.account,
    nsid = dedication?.nsid,
    name = dedication?.name,
    photoUrl = `https://www.flickr.com/photos/${account}/${id}/`,
    ownerUrl = `https://www.flickr.com/photos/${account}`,
    ownerUrls = [ownerUrl, `https://www.flickr.com/photos/${nsid}`],
    photoUrls = ownerUrls.map((url) => `${url}/${id}/`);
  // Flickr display names can change. Both primary creator objects must independently
  // bind the same immutable NSID already credited by the Commons transfer.
  const stableCreator = [photo?.author, photo?.creator].every((p) => {
      try {
        const u = new URL(p?.image);
        return (
          u.protocol === 'https:' &&
          /^(?:farm\d+|live)\.staticflickr\.com$/.test(u.hostname) &&
          u.pathname.endsWith(`/buddyicons/${nsid}.jpg`) &&
          u.hash === `#${nsid}`
        );
      } catch {
        return false;
      }
    }),
    displayNameBound =
      reference.artist === name ||
      reference.artist.startsWith(`${name} from `) ||
      (dedication?.catalogName === reference.artist && stableCreator),
    creatorLinkBound =
      String(meta?.Artist?.value).includes(`https://www.flickr.com/people/${nsid}`) ||
      (stableCreator &&
        [ownerUrl, `${ownerUrl}/`].some((url) =>
          String(meta?.Artist?.value).includes(`href="${url}"`),
        )) ||
      // Transfers may credit the photographer's Commons account. Bind that
      // explicit author declaration to the same reviewed Flickr original; the
      // primary creator objects must still independently identify its NSID.
      (stableCreator &&
        dedication?.catalogName === reference.artist &&
        body.includes(`|author=[[User:${reference.artist}|${reference.artist}]]`) &&
        String(meta?.Artist?.value).includes(`/wiki/User:${encodeURIComponent(reference.artist)}`)),
    creditBound =
      String(meta?.Credit?.value).includes(photoUrl) ||
      (stableCreator &&
        [...String(meta?.Credit?.value).matchAll(/href="([^"]+)"/g)].some((m) =>
          [
            `https://www.flickr.com/photos/${nsid}/${id}`,
            `https://www.flickr.com/photos/${nsid}/${id}/`,
          ].includes(m[1]),
        )),
    modernReview = [...body.matchAll(/\{\{FlickreviewR\|([^{}]+)\}\}/g)].some((m) => {
      const fields = m[1].split('|').map((s) => {
          const i = s.indexOf('=');
          return i < 0 ? ['', ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
        }),
        review = Object.fromEntries(fields);
      return (
        new Set(fields.map(([k]) => k)).size === fields.length &&
        review.status === 'passed' &&
        // The bot can record the photographer's display name instead of their
        // account slug. Accept that only when both primary creator objects also
        // bind the immutable NSID credited by this exact transfer.
        (review.author === account || (review.author === name && stableCreator)) &&
        review.sourceurl === `https://flickr.com/photos/${nsid}/${id}` &&
        review.reviewlicense === 'cc-zero' &&
        review.reviewer === 'FlickreviewR 2' &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(review.reviewdate ?? '')
      );
    });
  let downloadBound = false;
  try {
    const a = new URL(reference.downloadUrl),
      b = new URL(info?.url);
    downloadBound =
      a.protocol === 'https:' &&
      a.hostname === 'upload.wikimedia.org' &&
      a.origin + a.pathname === b.origin + b.pathname;
  } catch {}
  if (
    reference.origin !== 'commons-flickr-cc0' ||
    reference.license !== 'CC0' ||
    !/^\d+$/.test(id ?? '') ||
    !(/^[\w-]+$/.test(account ?? '') || (account === nsid && stableCreator)) ||
    !/^\d+@N\d+$/.test(nsid ?? '') ||
    !name?.trim() ||
    !page?.revisions?.[0]?.revid ||
    !downloadBound ||
    meta?.LicenseShortName?.value !== 'CC0' ||
    meta?.AttributionRequired?.value !== 'false' ||
    plainText(meta?.Restrictions?.value) ||
    plainText(meta?.Artist?.value) !== reference.artist ||
    !creatorLinkBound ||
    !creditBound ||
    !/\{\{\s*cc-zero\s*\}\}/i.test(body) ||
    !body.includes(`https://flickr.com/photos/${nsid}/${id}`) ||
    !(/\{\{User:FlickreviewR\/reviewed-pass\|[^}]*\|cc-zero\|\}\}/.test(body) || modernReview) ||
    !photoUrls.includes(reference.rightsEvidence?.sourceUrl) ||
    photo?.license !== 'https://creativecommons.org/publicdomain/zero/1.0/' ||
    !photoUrls.includes(`${photo?.acquireLicensePage}/`) ||
    photo?.author?.name !== name ||
    photo?.creator?.name !== name ||
    !ownerUrls.includes(photo?.author?.url) ||
    !ownerUrls.includes(photo?.creator?.url) ||
    !String(photo?.contentUrl).startsWith('https://live.staticflickr.com/') ||
    !String(photo?.contentUrl).includes(`/${id}_`) ||
    !displayNameBound ||
    !image ||
    createHash('sha1').update(image).digest('hex') !== info?.sha1
  )
    blockers.push('supplemental-primary-photographer-cc0-dedication-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Named photographers' own CC0 uploads; the offered rendition and creator must agree. */
export function inspectCreatorCc0Reference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    creator = localBytes(dir, reference.creatorEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !snapshot ||
    digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256) ||
    !creator ||
    digest(creator) !== plainHash(reference.creatorEvidence?.sha256)
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  const html = snapshot?.toString('utf8') ?? '',
    profile = creator?.toString('utf8') ?? '',
    records = [
      ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    ]
      .map((m) => snapshotJson(m[1]))
      .flatMap((j) => j?.['@graph'] ?? (j ? [j] : [])),
    imageRecord = records.find((r) => r['@type'] === 'ImageObject'),
    cc0 = 'https://creativecommons.org/publicdomain/zero/1.0/',
    meta = (name) =>
      plainText(html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`))?.[1]),
    review = reference.originalReview ?? {};
  let verified = false;
  if (reference.origin === 'publicdomainpictures-creator-cc0') {
    const id = reference.sourceUrl?.match(
        /^https:\/\/www\.publicdomainpictures\.net\/en\/view-image\.php\?image=(\d+)&picture=([a-z0-9-]+)$/,
      )?.[1],
      creatorUrl = imageRecord?.creator?.url,
      authorId = creatorUrl?.match(
        /^https:\/\/www\.publicdomainpictures\.net\/en\/browse-author\.php\?a=(\d+)$/,
      )?.[1],
      licenseCard = html.match(/<div class="view-license-card">([\s\S]*?)<\/div>/)?.[1] ?? '';
    verified =
      !!id &&
      !!authorId &&
      imageRecord?.['@id'] === `${reference.sourceUrl}#primaryimage` &&
      imageRecord.acquireLicensePage === reference.sourceUrl &&
      imageRecord.name === reference.title &&
      imageRecord.creator?.['@type'] === 'Person' &&
      imageRecord.creator.name === reference.artist &&
      reference.creatorEvidence?.sourceUrl === creatorUrl &&
      plainText(profile).includes(`Free Public Domain Pictures by ${reference.artist}`) &&
      html.includes(`href="/en/browse-author.php?a=${authorId}">${reference.artist}</a>`) &&
      imageRecord.license === cc0 &&
      imageRecord.copyrightNotice === 'Public domain (CC0). Attribution is not required.' &&
      imageRecord.creditText === `${reference.artist} @ PublicDomainPictures.net` &&
      /<dt>Status<\/dt><dd>Created by a human<\/dd>/.test(html) &&
      plainText(licenseCard).includes(`${reference.artist} @ PublicDomainPictures.net`) &&
      !/all rights reserved|permission required|courtesy|provided by/i.test(
        plainText(licenseCard),
      ) &&
      licenseCard.includes(`href="${cc0}"`) &&
      imageRecord.contentUrl === reference.downloadUrl &&
      /^https:\/\/www\.publicdomainpictures\.net\/pictures\/\d+\/velka\/[a-z0-9-]+\.jpg$/.test(
        reference.downloadUrl ?? '',
      ) &&
      meta('og:url') === reference.sourceUrl &&
      meta('og:image') === reference.downloadUrl &&
      reference.width === imageRecord.width &&
      reference.height === imageRecord.height &&
      review.rendition === 'published-free-jpeg-rendition';
  } else if (reference.origin === 'pxhere-creator-cc0') {
    const id = reference.sourceUrl?.match(/^https:\/\/pxhere\.com\/en\/photo\/(\d+)$/)?.[1],
      authorId = reference.creatorEvidence?.sourceUrl?.match(
        /^https:\/\/pxhere\.com\/en\/photographer\/(\d+)$/,
      )?.[1],
      description = html.match(/class="photo-descriptioninfo-main">([\s\S]*?)<\/div>/)?.[1] ?? '';
    verified =
      !!id &&
      !!authorId &&
      imageRecord?.acquireLicensePage === reference.sourceUrl &&
      imageRecord.author?.name === reference.artist &&
      imageRecord.license === 'https://creativecommons.org/licenses/publicdomain/' &&
      imageRecord.thumbnail?.url === reference.downloadUrl &&
      /^https:\/\/c\.pxhere\.com\/images\/[a-f0-9/]+-[0-9]+\.jpg!d$/.test(
        reference.downloadUrl ?? '',
      ) &&
      reference.downloadUrl.endsWith(`-${id}.jpg!d`) &&
      meta('og:image') === reference.downloadUrl &&
      html.includes(`<link rel="canonical" href="${reference.sourceUrl}">`) &&
      html.includes(
        `href="/en/photographer/${authorId}" class="profile-link">${reference.artist} /`,
      ) &&
      plainText(profile.match(/<title>([\s\S]*?)<\/title>/)?.[1]) ===
        `${reference.artist} - Free Images & Free stock photos - PxHere` &&
      plainText(description).includes(reference.title) &&
      plainText(description).includes(
        'The image is released free of copyrights under Creative Commons CC0.',
      ) &&
      !/courtesy|provided by|all rights reserved|permission required/i.test(
        plainText(description),
      ) &&
      html.includes(`href="${cc0}"`) &&
      reference.width === Number(meta('twitter:image:width')) &&
      reference.height === Number(meta('twitter:image:height')) &&
      review.rendition === 'published-preview-jpeg-rendition';
  }
  if (
    reference.license !== 'CC0' ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    !reference.artist?.trim() ||
    !reference.title?.trim() ||
    !verified
  )
    blockers.push('supplemental-named-creator-cc0-release-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Old Abdullah Frères prints with collection rights and the exact Library of Congress TIFF. */
export function inspectAbdulHamidReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path),
    catalogBytes = localBytes(dir, reference.catalogEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !snapshot ||
    digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256) ||
    !catalogBytes ||
    digest(catalogBytes) !== plainHash(reference.catalogEvidence?.sha256)
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  const pages = Object.values(snapshotJson(snapshot)?.query?.pages ?? {}),
    page = pages.length === 1 ? pages[0] : undefined,
    body = page?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    metadata = page?.imageinfo?.[0]?.extmetadata,
    catalog = snapshotJson(catalogBytes),
    item = catalog?.item,
    id = reference.sourceUrl?.match(/^https:\/\/www\.loc\.gov\/item\/(\d+)\/$/)?.[1],
    collectionRightsUrl = 'https://wwws.loc.gov/rr/print/res/374_abdu.html',
    nativeCollectionRights = reference.rightsEvidence?.sourceUrl === collectionRightsUrl,
    period = nativeCollectionRights
      ? item?.created_published?.[0]?.match(/^\[between (\d{4}) and (\d{4})\]$/)
      : body.match(/\|date=\{\{between\|(\d{4})\|(\d{4})\}\}/),
    digitalId = nativeCollectionRights
      ? (reference.downloadUrl?.match(/\/(3[a-z][a-z0-9]+)u\.tif$/)?.[1] ?? '')
      : body.match(/\|source=\{\{LOC-image\|id=cph\.([a-z0-9]+)\}\}/)?.[1],
    files = (catalog?.resources ?? []).flatMap((r) => (r.files ?? []).flat());
  const rights = snapshot?.toString('utf8') ?? '';
  const collectionRightsVerified = nativeCollectionRights
    ? Array.isArray(item?.rights) &&
      item.rights.some(
        (value) =>
          typeof value === 'string' && value.includes('www.loc.gov/rr/print/res/374_abdu.html'),
      ) &&
      rights.includes('<title>Abdul Hamid II Collection - Rights and Restrictions Information') &&
      rights.includes('There are no known restrictions on this collection.') &&
      /Publication and other forms of distribution:<\/strong>\s*Permitted\./i.test(rights)
    : body.includes('{{PD-Abdul Hamid}}') &&
      body.includes('|author={{Creator:Abdullah frères}}') &&
      plainText(metadata?.Artist?.value) === reference.artist &&
      metadata?.LicenseShortName?.value === 'Public domain' &&
      metadata?.UsageTerms?.value === 'Public domain' &&
      page?.imageinfo?.[0]?.descriptionurl === reference.rightsEvidence?.sourceUrl;
  if (
    reference.origin !== 'loc-abdul-hamid-public-domain' ||
    reference.license !== 'Public domain' ||
    !id ||
    item?.id?.replace(/^http:/, 'https:') !== reference.sourceUrl ||
    reference.catalogEvidence?.sourceUrl !== `${reference.sourceUrl}?fo=json` ||
    item?.access_restricted !== false ||
    !item?.group?.includes('abdul-hamid-ii') ||
    item?.rights_advisory !== 'No known restrictions on publication.' ||
    item?.contributor_names?.length !== 1 ||
    !/^Abdullah Fr[éeè]res, photographer$/iu.test(item.contributor_names[0]) ||
    !period ||
    Number(period[1]) < 1850 ||
    Number(period[2]) > 1893 ||
    Number(period[1]) > Number(period[2]) ||
    !item?.created_published?.includes(`[between ${period?.[1]} and ${period?.[2]}]`) ||
    !collectionRightsVerified ||
    reference.artist !== 'Abdullah frères' ||
    !digitalId ||
    !(catalog?.resources ?? []).some(
      (r) => r.url === `https://www.loc.gov/resource/cph.${digitalId}/`,
    ) ||
    !files.some(
      (f) =>
        f.url === reference.downloadUrl && f.mimetype === 'image/tiff' && f.size === image?.length,
    ) ||
    !/^https:\/\/tile\.loc\.gov\/storage-services\/master\/pnp\//.test(
      reference.downloadUrl ?? '',
    ) ||
    reference.originalReview?.rendition !== 'official-native-tiff'
  )
    blockers.push('supplemental-old-abdullah-print-public-domain-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

export function inspectHighsmithReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    rights = localBytes(dir, reference.rightsEvidence?.path),
    catalog = localBytes(dir, reference.catalogEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !rights ||
    digest(rights) !== plainHash(reference.rightsEvidence?.sha256) ||
    !catalog ||
    digest(catalog) !== plainHash(reference.catalogEvidence?.sha256)
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  const json = snapshotJson(catalog),
    item = json?.item,
    source = reference.sourceUrl?.match(/^https:\/\/www\.loc\.gov\/(pictures\/)?item\/(\d+)\/$/),
    id = source?.[2],
    files = (json?.resources ?? []).flatMap((r) => (r.files ?? []).flat());
  const modernRecord =
    !source?.[1] &&
    item?.item?.id === id &&
    item?.access_restricted === false &&
    item?.group?.includes('highsm') &&
    item?.contributor_names?.some((n) => /^Highsmith, Carol M\.,.*photographer/.test(n)) &&
    item?.rights_advisory === 'No known restrictions on publication.' &&
    files.some((f) => f.url === reference.downloadUrl && /^https:\/\/tile\.loc\.gov\//.test(f.url));
  const picturesRecord =
    source?.[1] === 'pictures/' &&
    reference.catalogEvidence?.sourceUrl === `${reference.sourceUrl}?fo=json` &&
    item?.id === id &&
    item?.display_offsite === true &&
    item?.raw_collections?.includes('highsm') &&
    item?.creators?.some(
      (creator) => creator.role === 'photographer' && /^Highsmith, Carol M\.,/.test(creator.title),
    ) &&
    item?.rights_information === 'No known restrictions on publication.' &&
    /^https:\/\/cdn\.loc\.gov\/service\/pnp\/highsm\/\d+\/\d+[rv]\.jpg$/.test(
      reference.downloadUrl,
    ) &&
    (json?.resources ?? []).some((resource) =>
      ['large', 'medium'].some(
        (size) =>
          resource[size] === reference.downloadUrl && resource[`${size}_s`] === image?.length,
      ),
    );
  if (
    reference.origin !== 'loc-highsmith-public-domain' ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'Carol M. Highsmith' ||
    !id ||
    !(modernRecord || picturesRecord) ||
    !/^https:\/\/wwws?\.loc\.gov\/rr\/print\/res\/482_high\.html$/.test(
      reference.rightsEvidence?.sourceUrl ?? '',
    ) ||
    !plainText(rights?.toString()).includes(
      'Highsmith has stipulated that her photographs are in the public domain',
    )
  )
    blockers.push('supplemental-photographer-public-domain-dedication-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Archive-owned CC0 photographs mirrored on Commons, with both primary records pinned. */
export function inspectNationaalArchiefReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    rights = localBytes(dir, reference.rightsEvidence?.path),
    commons = localBytes(dir, reference.catalogEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !rights ||
    digest(rights) !== plainHash(reference.rightsEvidence?.sha256) ||
    !commons ||
    digest(commons) !== plainHash(reference.catalogEvidence?.sha256)
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  const source = reference.sourceUrl?.match(
    /^https:\/\/www\.nationaalarchief\.nl\/onderzoeken\/fotocollectie\/([\da-f-]{36})$/,
  );
  const id = source?.[1];
  const settings = snapshotJson(
    rights
      ?.toString()
      .match(
        /<script type="application\/json" data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/,
      )?.[1],
  );
  const response = snapshotJson(settings?.na_viewer?.generic_response);
  const files = response?.viewResponse?.files ?? [];
  const file = files.length === 1 ? files[0] : null;
  const value = (k) => file?.metaData?.[k]?.text;
  const json = snapshotJson(commons);
  const page = Object.values(json?.query?.pages ?? {}).find(
    (p) => p.title === reference.commonsTitle,
  );
  const info = page?.imageinfo?.[0],
    meta = info?.extmetadata;
  const body = page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
  let sameDownload = false;
  try {
    const a = new URL(reference.downloadUrl),
      b = new URL(info?.url);
    sameDownload =
      a.protocol === 'https:' &&
      a.hostname === 'upload.wikimedia.org' &&
      a.origin + a.pathname === b.origin + b.pathname;
  } catch {}
  if (
    reference.origin !== 'nationaal-archief-cc0' ||
    reference.license !== 'CC0' ||
    !id ||
    file?.filename !== id ||
    value('dc_identifier')?.[0] !== id ||
    value('dcterms_rightsHolder')?.length !== 1 ||
    value('dcterms_rightsHolder')?.[0] !== 'Nationaal Archief, CC0' ||
    !reference.archiveNumber ||
    value('nao_bestanddeelnummer')?.[0] !== reference.archiveNumber ||
    !reference.artist ||
    value('dcterms_creator')?.[0] !== reference.artist ||
    !reference.dateCreated ||
    value('dcterms_date')?.[0] !== reference.dateCreated ||
    !page?.revisions?.[0]?.revid ||
    !/\{\{\s*CC-zero\s*\}\}/i.test(body) ||
    !body.includes(`/10648/${id}`) ||
    !body.includes(reference.archiveNumber) ||
    !plainText(meta?.Credit?.value).includes(`/10648/${id}`) ||
    meta?.LicenseShortName?.value !== 'CC0' ||
    meta?.AttributionRequired?.value !== 'false' ||
    plainText(meta?.Restrictions?.value) ||
    !sameDownload ||
    !image ||
    createHash('sha1').update(image).digest('hex') !== info?.sha1
  )
    blockers.push('supplemental-archive-cc0-dedication-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** HABS originals only: the collection's grant does not cover privately sourced copies. */
export function inspectHabsReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    rights = localBytes(dir, reference.rightsEvidence?.path),
    catalog = localBytes(dir, reference.catalogEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (
    !rights ||
    digest(rights) !== plainHash(reference.rightsEvidence?.sha256) ||
    !catalog ||
    digest(catalog) !== plainHash(reference.catalogEvidence?.sha256)
  )
    blockers.push('supplemental-rights-snapshot-unbound');
  const json = snapshotJson(catalog),
    item = json?.item,
    id = reference.sourceUrl?.match(/^https:\/\/www\.loc\.gov\/item\/([a-z]{2}\d+)\/$/)?.[1],
    groups = (json?.resources ?? []).flatMap((r) => r.files ?? []),
    group = groups.find((g) => g.some((f) => f.url === reference.downloadUrl)),
    original = group?.find((f) => f.url === reference.downloadUrl),
    caption = group?.find((f) => f.use === 'caption'),
    review = reference.originalReview,
    creators = item?.item?.creators ?? [],
    rightsText = plainText(rights?.toString());
  const common =
    reference.origin === 'loc-habs-original-public-domain' &&
    reference.license === 'Public domain' &&
    !!id &&
    item?.item?.id === id &&
    item?.access_restricted === false &&
    item?.group?.some((g) => /^hh(?:-\d+)?$/.test(g)) &&
    creators.some(
      (c) => c.role === 'creator' && c.title === 'Historic American Buildings Survey',
    ) &&
    typeof reference.habsSurveyNumber === 'string' &&
    item?.notes?.some((n) => n.trim() === `Survey number: ${reference.habsSurveyNumber}`) &&
    /^https:\/\/wwws?\.loc\.gov\/rr\/print\/res\/114_habs\.html$/.test(
      reference.rightsEvidence?.sourceUrl ?? '',
    ) &&
    rightsText.includes(
      'The original measured drawings and most of the photographs and data pages',
    ) &&
    rightsText.includes(
      'created for the U.S. Government and are considered to be in the public domain',
    ) &&
    rightsText.includes(
      'These materials are noted by the presence of a line crediting the original source',
    ) &&
    original?.mimetype === 'image/tiff' &&
    original?.size === image?.length &&
    /^(?:49492a00|4d4d002a)$/.test(image?.subarray(0, 4).toString('hex') ?? '') &&
    new RegExp(
      `^https://tile\\.loc\\.gov/storage-services/master/pnp/habshaer/[a-z]{2}/[a-z]{2}\\d+/${id}/(?:photos|color|sheet)/[a-z0-9]+\\.tif$`,
    ).test(reference.downloadUrl ?? '') &&
    caption?.aka === reference.resourceUrl &&
    caption?.title === review?.caption &&
    review?.inspectedNativeSha256 === reference.sha256 &&
    review?.noPrivateSourceCredit === true &&
    reference.visuallyReviewedForThisPolicy === true;
  let originalCreation = false;
  if (review?.kind === 'government-photograph') {
    const role = localBytes(dir, reference.governmentRoleEvidence?.path),
      photographers = creators.filter((c) => c.role === 'photographer'),
      boucher = (name) => ['Boucher, Jack E.', 'Boucher, Jack E'].includes(name),
      individualBytes = localBytes(dir, reference.individualCreatorEvidence?.path),
      individual = snapshotJson(individualBytes),
      key = reference.resourceUrl?.match(
        /^https:\/\/www\.loc\.gov\/resource\/hhh\.([a-z]{2}\d+\.(?:photos|color)\.[a-z0-9]+)$/,
      )?.[1],
      individualCreator = individual?.item?.creators,
      individualResource = individual?.resources?.length === 1 ? individual.resources[0] : null;
    // A survey can contain work by several photographers. Its individual photo
    // record must identify Boucher alone and bind the same original file. The
    // survey's collective creator list cannot establish a particular image's author.
    const individualBoucher =
      !!individualBytes &&
      digest(individualBytes) === plainHash(reference.individualCreatorEvidence?.sha256) &&
      key?.startsWith(`${id}.`) &&
      reference.individualCreatorEvidence?.sourceUrl ===
        `https://www.loc.gov/pictures/item/${key}/?fo=json` &&
      individual?.unrestricted === true &&
      individual.item?.id === key &&
      individual.item.link === `https://www.loc.gov/pictures/item/${key}/` &&
      individual.item.part_of_group === `Photograph ${id}` &&
      individual.item.raw_collections?.includes('hh') &&
      !individual.item.restriction &&
      individual.item.title === caption?.title &&
      !/photocopy|copied from|courtesy|copyright/i.test(individual.item.title) &&
      individual.item.notes?.length === 0 &&
      individualCreator?.length === 1 &&
      individualCreator[0].role === 'creator' &&
      boucher(individualCreator[0].title) &&
      individualResource?.item === key &&
      individualResource.id === `hhh.${key}` &&
      individualResource.larger ===
        reference.downloadUrl?.replace(
          'https://tile.loc.gov/storage-services/',
          'https://cdn.loc.gov/',
        ) &&
      individualResource.larger_s === original?.size;
    originalCreation =
      (original?.type === 'bw_photos' || (original?.type === 'colorphoto' && individualBoucher)) &&
      photographers.some((p) => boucher(p.title)) &&
      ((photographers.length === 1 && !reference.individualCreatorEvidence) || individualBoucher) &&
      reference.artist === 'Jack E. Boucher' &&
      reference.governmentRoleEvidence?.sourceUrl ===
        'https://npgallery.nps.gov/MUSEUM/AssetDetail/53bc45f1-8676-4876-9c5b-841d4e1615fc' &&
      !!role &&
      digest(role) === plainHash(reference.governmentRoleEvidence?.sha256) &&
      plainText(role.toString()).includes(
        'Jack E. Boucher was the Chief Photographer for the Historic American Buildings Survey (HABS).',
      );
  } else if (review?.kind === 'original-measured-drawing') {
    originalCreation =
      original?.type === 'drawing' &&
      [
        'Historic American Buildings Survey',
        'National Park Service',
        'U.S. Department of the Interior',
      ].every((s) => review.titleBlock?.includes(s)) &&
      Array.isArray(review.delineators) &&
      review.delineators.length > 0 &&
      reference.artist === review.delineators.join('; ') &&
      // Older surveys catalog the named drawing team by its field/manager role.
      // Require an explicit, ordered match to the inspected drawing credits;
      // unrelated contributors, architects and transmitters cannot qualify.
      (review.delineatorCatalogRoles === undefined ||
        (Array.isArray(review.delineatorCatalogRoles) &&
          review.delineatorCatalogRoles.length === review.delineators.length)) &&
      review.delineators.every((name, i) => {
        const credit = review.delineatorCatalogRoles?.[i],
          role = credit?.role ?? 'delineator';
        return (
          (review.delineatorCatalogRoles === undefined || credit?.name === name) &&
          ['delineator', 'field team', 'project manager'].includes(role) &&
          creators.some((c) => c.role === role && c.title === name)
        );
      });
  }
  if (!common || !originalCreation)
    blockers.push('supplemental-habs-original-public-domain-creation-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** Wien Museum labels each offered image separately; a site-wide CC0 footer is insufficient. */
export function inspectWienMuseumReference(dir, reference) {
  const blockers = [],
    image = localBytes(dir, reference.path),
    snapshot = localBytes(dir, reference.rightsEvidence?.path);
  if (!image || digest(image) !== plainHash(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const html = snapshot?.toString('utf8') ?? '',
    id = reference.sourceUrl?.match(
      /^https:\/\/sammlung\.wienmuseum\.at\/objekt\/(\d+)(?:-[a-z0-9-]+)?\/$/,
    )?.[1],
    attr = (tag, name) =>
      tag
        ?.match(new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`))
        ?.slice(1)
        .find((v) => v !== undefined),
    canonical = [...html.matchAll(/<meta\b[^>]*>/g)].find(
      (m) => attr(m[0], 'property') === 'og:url',
    ),
    figures = [...html.matchAll(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/g)],
    figure = figures.find((m) =>
      [...m[2].matchAll(/<img\b[^>]*>/g)].some(
        (i) => attr(i[0], 'data-src') === reference.downloadUrl,
      ),
    ),
    citation = attr(figure?.[1], 'data-copy-text'),
    img =
      figure &&
      [...figure[2].matchAll(/<img\b[^>]*>/g)].find(
        (i) => attr(i[0], 'data-src') === reference.downloadUrl,
      )?.[0];
  if (
    reference.origin !== 'wien-museum-cc0' ||
    reference.license !== 'CC0' ||
    !id ||
    reference.rightsEvidence?.sourceUrl !== reference.sourceUrl ||
    attr(canonical?.[0], 'content') !== reference.sourceUrl ||
    !reference.artist?.trim() ||
    !reference.title?.trim() ||
    !reference.inventoryNumber?.trim() ||
    !citation?.startsWith(`${reference.artist} (Fotograf), ${reference.title}, `) ||
    !citation?.endsWith(
      `Wien Museum Inv.-Nr. ${reference.inventoryNumber}, CC0 (https://sammlung.wienmuseum.at/objekt/${id}/)`,
    ) ||
    !new RegExp(`^https://sammlung\\.wienmuseum\\.at/images/objects/${id}/[0-9]+_full\\.jpg$`).test(
      reference.downloadUrl ?? '',
    ) ||
    Number(attr(img, 'data-width')) !== reference.width ||
    Number(attr(img, 'data-height')) !== reference.height ||
    !html.includes('https://creativecommons.org/publicdomain/zero/1.0/deed.de') ||
    !plainText(html).includes(
      'Sie können diese Objektabbildung unter den Bedingungen von CC0 herunterladen und verwenden',
    )
  )
    blockers.push('supplemental-image-specific-museum-cc0-release-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

/** The museum releases its own archive reproductions; State Archive consultation-only items do not qualify. */
export function inspectMuseoEgizioArchiveReference(dir, reference) {
  const image = localBytes(dir, reference.path),
    native = localBytes(dir, reference.catalogEvidence?.path),
    policy = localBytes(dir, reference.rightsEvidence?.path),
    catalog = localBytes(dir, reference.museumCatalogEvidence?.path),
    blockers = [],
    accession = reference.accessionNumber,
    policyUrl =
      'https://archiviofotografico.museoegizio.it/en/section/How-to-use-the-Archive/Policy-on-access-and-use/',
    page = Object.values(snapshotJson(native)?.query?.pages ?? {}).find((p) => {
      try {
        const source = new URL(reference.sourceUrl);
        return (
          source.origin === 'https://commons.wikimedia.org' &&
          source.pathname.startsWith('/wiki/File:') &&
          decodeURIComponent(source.pathname.slice(6)).replaceAll('_', ' ') === p.title
        );
      } catch {
        return false;
      }
    }),
    info = page?.imageinfo?.[0],
    value = (k) => info?.extmetadata?.[k]?.value,
    body = page?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    html = policy?.toString('utf8') ?? '',
    catalogHtml = catalog?.toString('utf8') ?? '',
    slide =
      catalogHtml
        .split(/<div class="row swiper-slide">/)
        .find((s) => s.includes(`id="${accession}"`)) ?? '';
  let sameOriginal = false,
    knownCatalog = false;
  try {
    const a = new URL(reference.downloadUrl),
      b = new URL(info?.url),
      c = new URL(reference.museumCatalogEvidence?.sourceUrl);
    sameOriginal =
      a.origin === 'https://upload.wikimedia.org' &&
      !a.pathname.includes('/thumb/') &&
      a.origin + a.pathname === b.origin + b.pathname;
    knownCatalog =
      c.origin === 'https://archiviofotografico.museoegizio.it' &&
      c.pathname.startsWith('/en/archive/') &&
      body.includes(c.href.replaceAll('&', '&amp;'));
  } catch {}
  if (
    reference.origin !== 'museo-egizio-archive-cc0' ||
    reference.license !== 'CC0' ||
    reference.institution !== 'Museo Egizio (Turin)' ||
    !/^C\d{5}$/.test(accession ?? '') ||
    !reference.artist?.trim() ||
    reference.rightsEvidence?.sourceUrl !== policyUrl ||
    !knownCatalog ||
    !page?.revisions?.[0]?.revid ||
    !sameOriginal ||
    !image ||
    !native ||
    !policy ||
    !catalog ||
    digest(image) !== plainHash(reference.sha256) ||
    digest(native) !== plainHash(reference.catalogEvidence?.sha256) ||
    digest(policy) !== plainHash(reference.rightsEvidence?.sha256) ||
    digest(catalog) !== plainHash(reference.museumCatalogEvidence?.sha256) ||
    createHash('sha1').update(image).digest('hex') !== info?.sha1 ||
    reference.width !== info?.width ||
    reference.height !== info?.height ||
    image.length !== info?.size ||
    value('LicenseShortName') !== 'CC0' ||
    value('AttributionRequired') !== 'false' ||
    plainText(value('Restrictions')) ||
    !/\{\{\s*Cc-zero\s*\}\}/i.test(body) ||
    !body.includes('{{Institution:Museo Egizio (Turin)}}') ||
    !new RegExp(`accession number\\s*=\\s*${accession}(?:\\s|$)`).test(body) ||
    /State Archive|Archivio di Stato/i.test(body) ||
    !plainText(html).includes(
      'The Museo Egizio is pleased to release the digital reproductions in the public domain of the Photographic Archive in CC0',
    ) ||
    !plainText(html).includes(
      'including commercial, completely free of charge and without further permission',
    ) ||
    !html.includes('creativecommons.org/publicdomain/zero/1.0') ||
    !slide.includes(`${accession}.std_full.jpg`) ||
    !/fa-copyright[^>]*><\/i>\s*CC0/.test(slide) ||
    /State Archive|Archivio di Stato/i.test(slide) ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'native-original'
  )
    blockers.push('supplemental-egizio-item-and-institution-cc0-release-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

function inspectHistoryTrustGlassNegative(dir, reference) {
  const image = localBytes(dir, reference.path);
  const snapshot = localBytes(dir, reference.rightsEvidence?.path);
  const record = snapshotJson(snapshot);
  const page = Object.values(record?.query?.pages ?? {}).find(
    (item) => item.title === `File:${reference.filename}`,
  );
  const info = page?.imageinfo?.[0];
  const first = page?.revisions?.[0];
  const body = first?.slots?.main?.content ?? '';
  const metadata = (key) => info?.extmetadata?.[key]?.value;
  const accession = reference.accession ?? '';
  const blockers = [];
  if (
    !image ||
    digest(image) !== plainHash(reference.sha256) ||
    image.length !== info?.size ||
    createHash('sha1').update(image).digest('hex') !== info?.sha1 ||
    !snapshot ||
    digest(snapshot) !== plainHash(reference.rightsEvidence?.sha256)
  )
    blockers.push('supplemental-history-trust-original-unbound');
  if (
    !/^GN\d{5}$/.test(accession) ||
    !reference.filename?.endsWith(`(${accession}).jpg`) ||
    first?.parentid !== 0 ||
    first.user !== 'Htsa' ||
    info?.user !== 'Htsa' ||
    page.imageinfo.length !== 1 ||
    record?.continue?.iicontinue ||
    !(Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000) ||
    !body.includes(`|accession number   = ${accession}\n`) ||
    !/\|institution\s*=\s*The History Trust of South Australia\s*\n/.test(body) ||
    !/\|medium\s*=\s*Glass Negatives\s*\n/.test(body) ||
    !/\|permission\s*=\s*\{\{cc-zero\}\}/.test(body) ||
    !/data\.history\.sa\.gov\.au\//.test(body) ||
    reference.sourceUrl !== info.descriptionurl ||
    reference.downloadUrl !== info.url ||
    !info.url.startsWith('https://upload.wikimedia.org/') ||
    reference.artist !== 'South Australian government photographer' ||
    plainText(metadata('Artist')) !== reference.artist ||
    reference.license !== 'CC0' ||
    metadata('LicenseShortName') !== 'CC0' ||
    metadata('AttributionRequired') !== 'false' ||
    plainText(metadata('Restrictions'))
  )
    blockers.push('supplemental-history-trust-item-cc0-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: !blockers.length,
  };
}

export function inspectImageryInventory({
  dir,
  qualla,
  evidence,
  selectedReferences,
  stories,
  conflicts = [],
  frame,
}) {
  const blockers = [];
  if (
    evidence?.format !== 'molen/structure-imagery-evidence@1' ||
    evidence.policy !== PUBLIC_DOMAIN_POLICY ||
    !Array.isArray(evidence.references) ||
    !evidence.references.length ||
    !evidence.references.every((r) => r && typeof r.path === 'string')
  )
    return { status: 'needs-review', blockers: ['all-imagery-inventory-missing'] };
  const references = evidence.references,
    local = references.filter((r) => r.path?.startsWith('_m/')),
    additional = references.filter((r) => !r.path?.startsWith('_m/'));
  if (new Set(references.map((r) => r.path)).size !== references.length)
    blockers.push('imagery-inventory-duplicate-path');
  for (const selected of selectedReferences ?? [])
    if (
      !local.some(
        (r) => r.path === selected.path && plainHash(r.sha256) === plainHash(selected.sha256),
      )
    )
      blockers.push(`selected-image-missing-from-inventory:${selected.path}`);
  if (references.some((r) => r.visuallyReviewedForThisPolicy !== true))
    blockers.push('imagery-original-inspection-missing');
  const quallaProof = inspectImageryPolicy({ qualla, references: local, stories, conflicts });
  if (local.length && quallaProof.status !== 'passed')
    blockers.push('inventory-qualla-provenance-failed');
  if (additional.length) {
    const search = evidence.quallaSearch;
    if (
      search?.source !== 'published-qualla-media' ||
      search.completedBeforeSupplementalFetch !== true ||
      !search.notes?.trim() ||
      !stories?.length ||
      !stories.every((s) => search.articlePaths?.includes(s.sourcePath))
    )
      blockers.push('qualla-first-search-evidence-missing');
  }
  const additionalProof = additional
    .filter(
      (r) =>
        ![
          'birmingham-terminal-original-archive',
          'hamburg-lome-palace-print-public-domain',
          'fidanza-manaus-album-public-domain',
          'nps-fort-frederik-captioned-photo',
          'archive-comayagua-harpers-1859',
          'archive-khartoum-cathedral-building-news-1915',
          'archive-victoria-daily-times-1912',
          'bhl-1908-raffles-library-plate',
          'ushmm-essen-synagogue-1914-drawings',
          'sa-supplement-wardenclyffe-1904-photograph',
          'architects-journal-tower-hill-1928-photograph',
          'library-of-congress-key-route-inn-1911-photo',
          'strand-jezreel-tower-1903-photographs',
          ...Object.keys(naipCrops),
          'loc-haer-swiftsure-public-domain',
          'tobolsk-mansion-historical-print',
          'ponce-casino-vrt-public-domain',
          'nha-de-boer-haarlem-cc0-photograph',
          'loc-1901-detroit-mackinac-panorama',
          'manoa-hiraoka-nara-hotel-postcard',
          'ndl-lushun-museum-1925-plate',
          'aif-antwerp-fine-arts-museum-postcard',
          'nmth-kaohsiung-city-hall-postcard',
          'gothenburg-karnell-collection-photo',
          'efeo-cambodia-museum-1930-plate',
          'archives-ontario-hammond-expired-photograph',
          'eth-gau-dendur-1822-survey',
          'met-teynard-dendur-1851-original',
          'met-al-hakim-1842-daguerreotype',
          'commons-ottawa-war-museum-original-construction',
          'dlg-macon-terminal-public-domain-postcard',
          'loc-carpenter-expired-original',
          'silesian-library-public-domain-periodical',
          'canadiana-1877-library-engraving',
          'slnsw-barnet-lighthouse-plan',
          'expired-danish-svedstrup-fort-drawings',
          'expired-rgada-1704-taganrog-plan',
          'amon-carter-moran1870-public-domain',
          'ndl-tanna1936-public-domain-plates',
          'commons-mccord-public-domain',
          'commons-rietberg-sepahsalar-public-domain',
          'rijksmuseum-public-domain',
          'loc-cordoba-photochrom-public-domain',
          'loc-matson-winter-palace-public-domain',
          'cornell-tughlaqabad-1902-plate',
          'slq-cooktown-expired-original',
          'banq-public-domain-atlas',
          'te-papa-expired-postcard',
          'commons-museu-paulista-expired-postcard',
          'archive-jackson-shrine-1911',
          'berlin-esplanade-historical-archive',
          'commons-native-creator-cc0',
          'usgs-national-map-pr-naip',
          'usgs-national-map-amos-naip',
          'usda-naip-california-2009',
          'usda-naip-encina-2018',
          'commons-nara-bureau-of-public-roads',
          'commons-presidencia-sv-cc0',
          'commons-vrt-cc0',
          'commons-history-trust-glass-negative-cc0',
          'yale-dura-archive-cc0-plan',
          'commons-nlc-republic-era-original-book',
          'commons-dhaka-embassy-government-photo',
        ].includes(r.origin),
    )
    .map((r) =>
      ['nps-agency-photo-public-domain', 'fhwa-byways-photo-public-domain'].includes(r.origin)
        ? r.origin === 'fhwa-byways-photo-public-domain'
          ? inspectFhwaBywaysReference(dir, r)
          : inspectNpsAgencyReference(dir, r)
        : r.origin === 'commons-chile-ilustrado-1872-original-volume'
          ? inspectChileIlustradoReference(dir, r)
          : r.origin === 'archive-carter-1923-original-volume'
            ? inspectCarterExcavationReference(dir, r)
            : r.origin === 'commons-expired-us-original-book'
              ? inspectExpiredUsBookReference(dir, r)
              : r.origin === 'archive-expired-excavation-plan'
                ? inspectExcavationPlanReference(dir, r)
                : r.origin === 'getty-object-cc0'
                  ? inspectGettyReference(dir, r)
                  : r.origin === 'archive-expired-named-book'
                    ? inspectExpiredNamedBookReference(dir, r)
                    : r.origin === 'commons-expired-named-book-photo'
                      ? inspectNamedBookPhotographReference(dir, r)
                      : r.origin === 'commons-expired-historical-print'
                        ? inspectHistoricalPrintReference(dir, r)
                        : r.origin === 'commons-state-department-government-photo'
                          ? inspectStateDepartmentReference(dir, r)
                          : r.origin === 'commons-whitehouse-government-photo'
                            ? (() => {
                                const bytes = localBytes(dir, r.path),
                                  proof =
                                    bytes && inspectQuallaPrimaryRights(r, bytes, modelRightsRoot);
                                return {
                                  path: r.path,
                                  sourceUrl: r.sourceUrl,
                                  eligible: proof?.eligible === true,
                                  blockers:
                                    proof?.eligible === true
                                      ? []
                                      : ['supplemental-whitehouse-government-photo-unverified'],
                                };
                              })()
                            : r.origin === 'commons-new-zealand-embassy-government-photo'
                              ? inspectNewZealandEmbassyReference(dir, r)
                              : r.origin === 'commons-us-embassy-government-photo'
                                ? inspectCommonsEmbassyReference(dir, r)
                                : r.origin === 'nhhc-official-navy-public-domain'
                                  ? inspectHistoricalNavyReference(dir, r)
                                  : r.origin === 'california-library-expired-postcard'
                                    ? inspectCaliforniaPostcardReference(dir, r)
                                    : r.origin === 'taiwan-culture-object-cc0'
                                      ? inspectTaiwanCultureReference(dir, r)
                                      : r.origin === 'gutenberg-original-public-domain-illustration'
                                        ? inspectGutenbergReference(dir, r)
                                        : r.origin === 'expired-south-african-photographic-postcard'
                                          ? inspectExpiredPostcardReference(dir, r)
                                          : r.origin === 'commons-nypl-wpa-public-domain'
                                            ? inspectCommonsWpaReference(dir, r)
                                            : r.origin === 'wien-museum-cc0'
                                              ? inspectWienMuseumReference(dir, r)
                                              : r.origin === 'museo-egizio-archive-cc0'
                                                ? inspectMuseoEgizioArchiveReference(dir, r)
                                                : r.origin === 'nps-historical-public-domain'
                                                  ? inspectNpsHistoricalReference(dir, r)
                                                  : r.origin ===
                                                      'nasa-gsfc-civil-servant-photograph'
                                                    ? inspectNasaStaffReference(dir, r)
                                                    : [
                                                          'dvids-uscg-public-domain',
                                                          'dvids-usnavy-public-domain',
                                                          'dvids-usarmy-public-domain',
                                                        ].includes(r.origin)
                                                      ? inspectDvidsReference(dir, r)
                                                      : r.origin ===
                                                          'flickr-photographer-cc0-original'
                                                        ? inspectFlickrOriginalReference(dir, r)
                                                        : r.origin === 'commons-flickr-cc0'
                                                          ? inspectFlickrCc0Reference(dir, r)
                                                          : [
                                                                'commons-self-public-domain',
                                                                'commons-author-public-domain',
                                                              ].includes(r.origin)
                                                            ? inspectCommonsSelfReference(dir, r)
                                                            : [
                                                                  'publicdomainpictures-creator-cc0',
                                                                  'pxhere-creator-cc0',
                                                                ].includes(r.origin)
                                                              ? inspectCreatorCc0Reference(dir, r)
                                                              : r.origin ===
                                                                  'loc-abdul-hamid-public-domain'
                                                                ? inspectAbdulHamidReference(dir, r)
                                                                : r.origin ===
                                                                    'loc-highsmith-public-domain'
                                                                  ? inspectHighsmithReference(
                                                                      dir,
                                                                      r,
                                                                    )
                                                                  : r.origin ===
                                                                      'nationaal-archief-cc0'
                                                                    ? inspectNationaalArchiefReference(
                                                                        dir,
                                                                        r,
                                                                      )
                                                                    : r.origin ===
                                                                        'loc-habs-original-public-domain'
                                                                      ? inspectHabsReference(dir, r)
                                                                      : r.origin ===
                                                                          'expired-australian-newspaper-photograph'
                                                                        ? inspectExpiredAustralianNewsReference(
                                                                            dir,
                                                                            r,
                                                                          )
                                                                        : r.origin ===
                                                                            'awm-expired-archive-photograph'
                                                                          ? inspectAwmArchiveReference(
                                                                              dir,
                                                                              r,
                                                                            )
                                                                          : inspectNpsReference(
                                                                              dir,
                                                                              r,
                                                                            ),
    );
  additionalProof.push(
    ...additional
      .filter((r) => r.origin === 'fidanza-manaus-album-public-domain')
      .map((r) => inspectFidanzaManausPlate(dir, r)),
    ...additional
      .filter((r) => r.origin === 'hamburg-lome-palace-print-public-domain')
      .map((r) => inspectHamburgLomePalacePlate(dir, r)),
    ...additional
      .filter((r) => r.origin === 'nps-fort-frederik-captioned-photo')
      .map((r) => inspectFortFrederikPhotos(dir, r)),
    ...additional
      .filter((r) => r.origin === 'yale-dura-archive-cc0-plan')
      .map((r) => inspectYaleDuraBaptisteryPlan(dir, r)),
    ...additional
      .filter((r) => r.origin === 'commons-history-trust-glass-negative-cc0')
      .map((r) => inspectHistoryTrustGlassNegative(dir, r)),
    ...additional
      .filter((r) => r.origin === 'commons-dhaka-embassy-government-photo')
      .map((r) => inspectDhakaEmbassyReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'archive-comayagua-harpers-1859')
      .map((r) => inspectComayaguaHarpersPlate(dir, r)),
    ...additional
      .filter((r) => r.origin === 'archive-khartoum-cathedral-building-news-1915')
      .map((r) => inspectKhartoumCathedralPlate(dir, r)),
    ...additional
      .filter((r) => r.origin === 'archive-victoria-daily-times-1912')
      .map((r) => inspectVictoriaDailyTimesPage(dir, r)),
    ...additional
      .filter((r) => r.origin === 'bhl-1908-raffles-library-plate')
      .map((r) => inspectRafflesLibraryPlate(dir, r)),
    ...additional
      .filter((r) => r.origin === 'ushmm-essen-synagogue-1914-drawings')
      .map((r) => inspectEssenSynagogueDrawings(dir, r)),
    ...additional
      .filter((r) => r.origin === 'sa-supplement-wardenclyffe-1904-photograph')
      .map((r) => inspectWardenclyffeScientificAmerican(dir, r)),
    ...additional
      .filter((r) => r.origin === 'architects-journal-tower-hill-1928-photograph')
      .map((r) => inspectTowerHillArchitectsJournal(dir, r)),
    ...additional
      .filter((r) => r.origin === 'library-of-congress-key-route-inn-1911-photo')
      .map((r) => inspectKeyRouteInnHistoricalPhoto(dir, r)),
    ...additional
      .filter((r) => r.origin === 'strand-jezreel-tower-1903-photographs')
      .map((r) => inspectJezreelStrandPhotographs(dir, r)),
    ...additional
      .filter((r) => Object.hasOwn(naipCrops, r.origin))
      .map((r) => inspectNaipReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'loc-haer-swiftsure-public-domain')
      .map((r) => inspectSwiftsureSurveyImage(dir, r)),
    ...additional
      .filter((r) => r.origin === 'tobolsk-mansion-historical-print')
      .map((r) => inspectTobolskPrint(dir, r)),
    ...additional
      .filter((r) => r.origin === 'ponce-casino-vrt-public-domain')
      .map((r) => inspectPonceCasinoPhotograph(dir, r)),
    ...additional
      .filter((r) => r.origin === 'nha-de-boer-haarlem-cc0-photograph')
      .map((r) => inspectDeBoerHaarlemPhotograph(dir, r)),
    ...additional
      .filter((r) => r.origin === 'loc-1901-detroit-mackinac-panorama')
      .map((r) => inspectDetroitMackinacPanorama(dir, r)),
    ...additional
      .filter((r) => r.origin === 'manoa-hiraoka-nara-hotel-postcard')
      .map((r) => inspectNaraHotelPostcard(dir, r)),
    ...additional
      .filter((r) => r.origin === 'ndl-lushun-museum-1925-plate')
      .map((r) => inspectLushunMuseumPlate(dir, r)),
    ...additional
      .filter((r) => r.origin === 'aif-antwerp-fine-arts-museum-postcard')
      .map((r) => inspectAntwerpMuseumPostcard(dir, r)),
    ...additional
      .filter((r) => r.origin === 'nmth-kaohsiung-city-hall-postcard')
      .map((r) => inspectKaohsiungCityHallPostcard(dir, r)),
    ...additional
      .filter((r) => r.origin === 'gothenburg-karnell-collection-photo')
      .map((r) => inspectGothenburgKarnellPhoto(dir, r)),
    ...additional
      .filter((r) => r.origin === 'slnsw-barnet-lighthouse-plan')
      .map((r) => inspectBarnetLighthousePlan(dir, r)),
    ...additional
      .filter((r) => r.origin === 'birmingham-terminal-original-archive')
      .map((r) => inspectBirminghamTerminalArchive(dir, r)),
    ...additional
      .filter((r) => r.origin === 'commons-nlc-republic-era-original-book')
      .map((r) => inspectNlcRepublicEraReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'commons-vrt-cc0')
      .map((r) => inspectCommonsVrtCc0Reference(dir, r)),
    ...additional
      .filter((r) =>
        [
          'commons-mccord-public-domain',
          'commons-rietberg-sepahsalar-public-domain',
          'rijksmuseum-public-domain',
          'loc-cordoba-photochrom-public-domain',
          'loc-matson-winter-palace-public-domain',
          'cornell-tughlaqabad-1902-plate',
          'slq-cooktown-expired-original',
          'banq-public-domain-atlas',
          'te-papa-expired-postcard',
          'commons-museu-paulista-expired-postcard',
          'usgs-national-map-pr-naip',
          'usgs-national-map-amos-naip',
          'usda-naip-california-2009',
          'usda-naip-encina-2018',
          'commons-nara-bureau-of-public-roads',
          'commons-presidencia-sv-cc0',
          'efeo-cambodia-museum-1930-plate',
          'archives-ontario-hammond-expired-photograph',
          'eth-gau-dendur-1822-survey',
          'met-teynard-dendur-1851-original',
          'met-al-hakim-1842-daguerreotype',
          'commons-ottawa-war-museum-original-construction',
          'dlg-macon-terminal-public-domain-postcard',
        ].includes(r.origin),
      )
      .map((r) => inspectPublicArchiveReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'commons-native-creator-cc0')
      .map((r) => inspectCommonsCreatorOriginal(dir, r)),
    ...additional
      .filter((r) => r.origin === 'berlin-esplanade-historical-archive')
      .map((r) => inspectEsplanadeArchive(dir, r)),
    ...additional
      .filter((r) => r.origin === 'archive-jackson-shrine-1911')
      .map((r) => inspectJacksonShrinePlate(dir, r)),
    ...additional
      .filter((r) => r.origin === 'ndl-tanna1936-public-domain-plates')
      .map((r) => inspectNdlTannaReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'amon-carter-moran1870-public-domain')
      .map((r) => inspectMoranCartagenaReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'expired-danish-svedstrup-fort-drawings')
      .map((r) => inspectDanishFortDrawingReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'expired-rgada-1704-taganrog-plan')
      .map((r) => inspectTaganrogArchiveReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'silesian-library-public-domain-periodical')
      .map((r) => inspectSilesianPeriodicalReference(dir, r)),
    ...additional
      .filter((r) => r.origin === 'canadiana-1877-library-engraving')
      .map((r) => inspectCanadianaOttawaEngraving(dir, r)),
    ...additional
      .filter((r) => r.origin === 'loc-carpenter-expired-original')
      .map((r) => inspectCarpenterReference(dir, r)),
  );
  if (additionalProof.some((r) => !r.eligible))
    blockers.push('supplemental-public-domain-source-unverified');
  for (const auxiliary of frame?.supplementalReferences ?? []) {
    const relative = auxiliary.path?.replace(/^\.\.\/qualla-internal\//, '');
    if (
      !references.some(
        (r) =>
          (relative && r.path === relative) || (auxiliary.url && r.sourceUrl === auxiliary.url),
      )
    )
      blockers.push(`auxiliary-imagery-unaccounted:${auxiliary.path ?? auxiliary.url}`);
  }
  for (const excluded of evidence.excludedHistoricalImagery ?? [])
    if (
      references.some(
        (r) => r.path === excluded.path || (excluded.url && r.sourceUrl === excluded.url),
      )
    )
      blockers.push('accepted-imagery-also-marked-excluded');
  return {
    status: blockers.length ? 'needs-review' : 'passed',
    blockers,
    qualla: quallaProof,
    additional: additionalProof,
  };
}
