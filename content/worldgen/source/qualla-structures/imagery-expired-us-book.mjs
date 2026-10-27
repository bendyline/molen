/** Bind a complete original US book to its explicit native expired-copyright release.
 * This is supplemental evidence after the Qualla search, never inherited clearance
 * for a separate photograph or a modern edition. Retain the exact original PDF.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b, algorithm = 'sha256') => createHash(algorithm).update(b).digest('hex');
function bytesAt(dir, relative) {
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
export function inspectExpiredUsBookReference(dir, reference) {
  const blockers = [],
    image = bytesAt(dir, reference.path),
    snapshot = bytesAt(dir, reference.rightsEvidence?.path);
  let record;
  try {
    record = JSON.parse(snapshot);
  } catch {
    /* Missing or malformed native response. */
  }
  const pages = Object.values(record?.query?.pages ?? {}),
    page = pages.length === 1 ? pages[0] : null;
  const info = page?.imageinfo?.[0],
    text = page?.revisions?.[0]?.slots?.main?.['*'] ?? '';
  const yearText = text.match(/\|publication date\s*=\s*([^\n]+)/)?.[1]?.trim();
  const year = Number(yearText?.match(/^\[?(\d{4})\??\]?$/)?.[1]);
  const review = reference.originalReview,
    nativeUrl = info?.url?.split('?')[0];
  if (!image || hash(image) !== reference.sha256?.replace(/^sha256:/, ''))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || hash(snapshot) !== reference.rightsEvidence?.sha256?.replace(/^sha256:/, ''))
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    reference.origin !== 'commons-expired-us-original-book' ||
    reference.license !== 'Public domain' ||
    page?.ns !== 6 ||
    !page?.title?.endsWith('.pdf') ||
    !text.includes('{{Book\n') ||
    !/\{\{PD-(?:US-expired|old-100-expired)\s*\}\}/.test(text) ||
    !text.includes(`{{Internet Archive link|${reference.archiveIdentifier}}}`) ||
    !/^[a-z0-9]+$/.test(reference.archiveIdentifier ?? '') ||
    !text.includes(`|title = ${reference.publicationTitle}\n`) ||
    !text.includes(`|publisher = ${reference.publicationPublisher}\n`) ||
    !/Yellowstone National Park|United States|New York|Boston|Chicago|Philadelphia|Washington|Montana|Wyoming/i.test(
      reference.publicationPublisher ?? '',
    ) ||
    reference.sourceUrl !== info?.descriptionurl ||
    reference.downloadUrl !== nativeUrl ||
    !nativeUrl?.startsWith('https://upload.wikimedia.org/wikipedia/commons/') ||
    info?.extmetadata?.Copyrighted?.value !== 'False' ||
    info?.extmetadata?.LicenseShortName?.value !== 'Public domain' ||
    /CC BY|CC-BY|all rights reserved|permission required/i.test(
      JSON.stringify(info?.extmetadata),
    ) ||
    !Number.isInteger(year) ||
    year < 1800 ||
    year > 1929 ||
    year !== review?.publicationYear ||
    !reference.artist?.trim() ||
    reference.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'native-original-pdf' ||
    !Array.isArray(review.pagesInspected) ||
    !review.pagesInspected.length ||
    review.pagesInspected.some((p) => !Number.isInteger(p) || p < 1 || p > info?.pagecount) ||
    !review?.publicationAndCreatorCreditInspected ||
    !review?.notes?.trim() ||
    !image ||
    image.subarray(0, 5).toString() !== '%PDF-' ||
    image.length !== info?.size ||
    hash(image ?? '', 'sha1') !== info?.sha1
  )
    blockers.push('supplemental-original-us-book-grant-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
  };
}
