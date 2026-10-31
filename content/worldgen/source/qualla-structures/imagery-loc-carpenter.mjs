/** Exact original Carpenter print: bind the native expired grant, LOC item and collection statement. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const plain = (value) => value?.replace(/^sha256:/, '');
const text = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
function local(dir, name) {
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
    return null;
  const file = path.resolve(dir, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const relative = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`))
    return null;
  return fs.readFileSync(file);
}
function json(bytes) {
  try {
    return JSON.parse(bytes);
  } catch {
    return null;
  }
}
export function inspectCarpenterReference(dir, reference) {
  const image = local(dir, reference.path),
    rights = local(dir, reference.rightsEvidence?.path),
    catalogBytes = local(dir, reference.catalogEvidence?.path),
    collectionBytes = local(dir, reference.collectionEvidence?.path),
    native = json(rights),
    catalog = json(catalogBytes),
    collection = json(collectionBytes),
    pages = Object.values(native?.query?.pages ?? {}),
    page = pages.length === 1 ? pages[0] : null,
    info = page?.imageinfo?.[0],
    wiki = page?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    item = catalog?.item,
    id = reference.sourceUrl?.match(/^https:\/\/www\.loc\.gov\/item\/(\d+)\/$/)?.[1],
    period = wiki.match(/\|date\s*=\s*\{\{other date\|between\|(\d{4})\|(\d{4})\}\}/),
    digitalId = wiki.match(/\{\{LOC-image\|id=(cph\.[a-z0-9]+)\}\}/)?.[1],
    files = (catalog?.resources ?? []).flatMap((r) => (r.files ?? []).flat()),
    blockers = [];
  if (!image || hash(image) !== plain(reference.sha256))
    blockers.push('supplemental-image-bytes-unbound');
  for (const [bytes, evidence] of [
    [rights, reference.rightsEvidence],
    [catalogBytes, reference.catalogEvidence],
    [collectionBytes, reference.collectionEvidence],
  ])
    if (!bytes || hash(bytes) !== plain(evidence?.sha256))
      blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.origin !== 'loc-carpenter-expired-original' ||
    reference.license !== 'Public domain' ||
    !id ||
    reference.catalogEvidence?.sourceUrl !== `${reference.sourceUrl}?fo=json` ||
    item?.id?.replace(/^http:/, 'https:') !== reference.sourceUrl ||
    item?.access_restricted !== false ||
    !item?.group?.includes('ffcarp') ||
    item?.rights_advisory !== 'No known restrictions on publication.' ||
    !item?.notes?.includes('Frank and Frances Carpenter Collection.') ||
    !period ||
    Number(period[1]) < 1855 ||
    Number(period[2]) > 1922 ||
    Number(period[1]) > Number(period[2]) ||
    !item?.created_published?.includes(`[between ca. ${period?.[1]} and ${period?.[2]}]`) ||
    !wiki.includes('|photographer = Q5486735') ||
    !wiki.includes('{{PD-Carpenter}}') ||
    !wiki.includes('{{PD-old-auto-expired|deathyear=1924}}') ||
    reference.artist !== 'Frank G. Carpenter' ||
    text(info?.extmetadata?.Artist?.value) !== reference.artist ||
    info?.extmetadata?.LicenseShortName?.value !== 'Public domain' ||
    info?.extmetadata?.Copyrighted?.value !== 'False' ||
    info?.extmetadata?.AttributionRequired?.value !== 'false' ||
    text(info?.extmetadata?.Restrictions?.value) ||
    /CC BY|CC-BY|all rights reserved|permission required/i.test(
      JSON.stringify(info?.extmetadata),
    ) ||
    reference.rightsEvidence?.sourceUrl !== info?.descriptionurl ||
    page?.ns !== 6 ||
    !page?.title?.endsWith('.tif') ||
    !page?.revisions?.[0]?.revid ||
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
    info?.size !== image?.length ||
    (image && info?.sha1 !== hash(image, 'sha1')) ||
    collection?.id !== '276_carp.html' ||
    collection?.title !== 'Frank and Frances Carpenter Collection' ||
    text(collection?.intro) !==
      'There are no known restrictions on the photographs in the Frank and Frances Carpenter Collection.' ||
    text(collection?.publication) !== 'No known restrictions.' ||
    reference.collectionEvidence?.sourceUrl !==
      'https://guides.loc.gov/p-and-p-rights-and-restrictions/rights#276_carp.html' ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'official-native-tiff' ||
    reference.visuallyReviewedForThisPolicy !== true ||
    !reference.originalReview?.notes?.trim()
  )
    blockers.push('supplemental-carpenter-native-expired-print-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
  };
}
