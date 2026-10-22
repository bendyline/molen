/** Check all imagery used by a model, including independently cleared gap-filling sources. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { inspectImageryPolicy, PUBLIC_DOMAIN_POLICY } from './imagery-policy.mjs';
import { inspectQuallaPrimaryRights, modelRightsRoot } from './imagery-primary-rights.mjs';

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
function field(html, name) {
  return (
    html.match(new RegExp(`<label[^>]*>${name}:</label>\\s*<div[^>]*>([\\s\\S]*?)</div>`))?.[1] ??
    ''
  )
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  // Older agency records use Photographer and Publisher instead of PhotoCredit.
  // Accept only the explicit staff/public-domain combination, with no competing credit.
  const legacyStaffRelease =
    !field(html, 'PhotoCredit') &&
    field(html, 'Photographer') === 'NPS staff' &&
    field(html, 'Publisher') === 'National Park Service' &&
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
    relative = reference.downloadUrl?.split(`/${id}-h/`)[1];
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
    !/^images\/[a-z0-9_-]+_lg\.jpg$/.test(relative ?? '') ||
    reference.downloadUrl !== reference.sourceUrl.replace(/[^/]+$/, relative ?? '') ||
    !content.includes(`href="${relative}"`) ||
    !content.includes(`PROJECT GUTENBERG EBOOK ${id}`) ||
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
    captionCredit = navy
      ? caption.match(
          /\(U\.S\. Navy photo by ((?:Seaman|Petty Officer (?:1st|2nd|3rd) Class|Mass Communication Specialist (?:1st|2nd|3rd) Class) [A-Za-z'. -]+)\/Released\)$/,
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
    credit = captionCredit ?? (!navy && unitStaffCredit ? portfolioCredit : undefined),
    rendition = reference.downloadUrl?.match(
      /^https:\/\/d1ldvf68ux039x\.cloudfront\.net\/thumbs\/photos\/\d{4}\/(\d+)\/(1000|2000)w_q95\.jpg$/,
    );
  // A published rendition is useful photographic evidence; never call it the
  // native original. Courtesy labels alone do not establish a government author.
  if (
    !['dvids-uscg-public-domain', 'dvids-usnavy-public-domain'].includes(reference.origin) ||
    reference.license !== 'Public domain' ||
    !id ||
    tableField('Photo ID') !== id ||
    !(navy ? /^\d{6}-N-[A-Z0-9]{5}-\d{3,4}$/ : /^\d{6}-G-[A-Z0-9]{5}-\d{3,4}$/).test(
      tableField('VIRIN'),
    ) ||
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
  const body = page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
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
    Number.isFinite(Date.parse(first.timestamp)) &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
    !plainText(value('Artist')) &&
    !plainText(value('Credit')) &&
    /\{\{\s*PD-self\s*(?:\||\}\})/i.test(body);
  // This Japanese first-person source means "photographed on site". Bind the
  // named photographer's original self-release and native upload before allowing
  // the rendered author label's Japanese talk-link suffix.
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
    Number.isFinite(Date.parse(first.timestamp)) &&
    Math.abs(Date.parse(first.timestamp) - Date.parse(info.timestamp)) < 300000 &&
    /\{\{\s*PD-self\s*\}\}/i.test(body) &&
    /\|\s*Source\s*=\s*現地で撮影\s*(?:\n|\|)/.test(body) &&
    body.includes(`[[利用者:${dedication.username}|${dedication.username}]]`) &&
    plainText(value('Credit')) === '現地で撮影' &&
    plainText(value('Artist')) === `${dedication.username}（会話）`;
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
  const migratedOriginalUploadRelease =
    reference.origin === 'commons-author-public-domain' &&
    reference.license === 'Public domain' &&
    [
      'english-wikipedia-original-upload',
      'english-wikipedia-original-digital-photograph',
      'english-wikipedia-photographer-described-upload',
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
      (digitalPhotographerDeclaration && !meta?.Permission)) &&
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
      describedPhotographerDeclaration);
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
  const migratedCreatorRelease =
    migratedNamedRelease ||
    migratedOriginalUploadRelease ||
    migratedNamedPhotographerRelease ||
    migratedSelfPhotographedRelease ||
    migratedGermanPhotographerRelease;
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
  const release =
    originalNamedPhotographerRelease ||
    migratedCreatorRelease ||
    contemporaneousNamedUploaderRelease ||
    (reference.license === 'Public domain'
      ? /\{\{\s*PD-self\s*(?:\||\}\})/i.test(body) || selfCc0
      : /^CC0(?: 1\.0)?$/.test(reference.license ?? '') && selfCc0);
  const ownPhotograph =
    /Own work|Self-photographed/i.test(plainText(value('Credit'))) ||
    (plainText(value('Credit')) === 'taken by author' &&
      /\|\s*source\s*=\s*taken by author\s*(?:\n|\|)/i.test(body)) ||
    (plainText(value('Credit')) === 'I took it' &&
      /\|\s*source\s*=\s*I took it\s*(?:\n|\|)/i.test(body));
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
      !japanesePhotographerRelease &&
      !originalNamedPhotographerRelease &&
      !ownPhotograph) ||
    !reference.artist?.trim() ||
    (!contemporaneousUploaderRelease &&
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
    ownerUrl = `https://www.flickr.com/photos/${account}`;
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
        )),
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
    !/^[\w-]+$/.test(account ?? '') ||
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
    reference.rightsEvidence?.sourceUrl !== photoUrl ||
    photo?.license !== 'https://creativecommons.org/publicdomain/zero/1.0/' ||
    `${photo?.acquireLicensePage}/` !== photoUrl ||
    photo?.author?.name !== name ||
    photo?.creator?.name !== name ||
    photo?.author?.url !== ownerUrl ||
    photo?.creator?.url !== ownerUrl ||
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

/** Old Abdullah Frères prints: Commons' collection PD record plus the exact LOC native. */
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
    period = body.match(/\|date=\{\{between\|(\d{4})\|(\d{4})\}\}/),
    digitalId = body.match(/\|source=\{\{LOC-image\|id=(cph\.[a-z0-9]+)\}\}/)?.[1],
    files = (catalog?.resources ?? []).flatMap((r) => (r.files ?? []).flat());
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
    !body.includes('{{PD-Abdul Hamid}}') ||
    !body.includes('|author={{Creator:Abdullah frères}}') ||
    plainText(metadata?.Artist?.value) !== reference.artist ||
    reference.artist !== 'Abdullah frères' ||
    metadata?.LicenseShortName?.value !== 'Public domain' ||
    metadata?.UsageTerms?.value !== 'Public domain' ||
    page?.imageinfo?.[0]?.descriptionurl !== reference.rightsEvidence?.sourceUrl ||
    !digitalId ||
    !(catalog?.resources ?? []).some(
      (r) => r.url === `https://www.loc.gov/resource/${digitalId}/`,
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
    source = reference.sourceUrl?.match(/^https:\/\/www\.loc\.gov\/item\/(\d+)\/$/),
    id = source?.[1],
    files = (json?.resources ?? []).flatMap((r) => (r.files ?? []).flat());
  if (
    reference.origin !== 'loc-highsmith-public-domain' ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'Carol M. Highsmith' ||
    !id ||
    item?.item?.id !== id ||
    item?.access_restricted !== false ||
    !item?.group?.includes('highsm') ||
    !item?.contributor_names?.some((n) => /^Highsmith, Carol M\.,.*photographer/.test(n)) ||
    item?.rights_advisory !== 'No known restrictions on publication.' ||
    !/^https:\/\/wwws?\.loc\.gov\/rr\/print\/res\/482_high\.html$/.test(
      reference.rightsEvidence?.sourceUrl ?? '',
    ) ||
    !plainText(rights?.toString()).includes(
      'Highsmith has stipulated that her photographs are in the public domain',
    ) ||
    !files.some((f) => f.url === reference.downloadUrl && /^https:\/\/tile\.loc\.gov\//.test(f.url))
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
  const additionalProof = additional.map((r) =>
    r.origin === 'archive-expired-named-book'
      ? inspectExpiredNamedBookReference(dir, r)
      : r.origin === 'commons-expired-historical-print'
        ? inspectHistoricalPrintReference(dir, r)
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
                            : r.origin === 'nasa-gsfc-civil-servant-photograph'
                              ? inspectNasaStaffReference(dir, r)
                              : ['dvids-uscg-public-domain', 'dvids-usnavy-public-domain'].includes(
                                    r.origin,
                                  )
                                ? inspectDvidsReference(dir, r)
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
                                      : r.origin === 'loc-abdul-hamid-public-domain'
                                        ? inspectAbdulHamidReference(dir, r)
                                        : r.origin === 'loc-highsmith-public-domain'
                                          ? inspectHighsmithReference(dir, r)
                                          : r.origin === 'nationaal-archief-cc0'
                                            ? inspectNationaalArchiefReference(dir, r)
                                            : r.origin === 'loc-habs-original-public-domain'
                                              ? inspectHabsReference(dir, r)
                                              : inspectNpsReference(dir, r),
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
