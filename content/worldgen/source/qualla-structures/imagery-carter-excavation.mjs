/** Exact original 1923 US excavation volume, not later editions or inherited archive rights. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex');
function local(dir, name, expected) {
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
    return null;
  const file = path.resolve(dir, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const real = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  if (path.isAbsolute(real) || real === '..' || real.startsWith(`..${path.sep}`)) return null;
  const bytes = fs.readFileSync(file);
  return hash(bytes) === expected?.replace(/^sha256:/, '') ? bytes : null;
}
export function inspectCarterExcavationReference(dir, r) {
  const blockers = [],
    pdf = local(dir, r.path, r.sha256),
    snapshot = local(dir, r.rightsEvidence?.path, r.rightsEvidence?.sha256);
  if (!pdf) blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot) blockers.push('supplemental-rights-snapshot-unbound');
  let record;
  try {
    record = JSON.parse(snapshot);
  } catch {
    /* An absent native record cannot confer rights. */
  }
  const id = 'tomboftutankhame00cart_1',
    m = record?.metadata,
    file = record?.files?.find((f) => f.name === `${id}.pdf`),
    review = r.originalReview;
  if (
    r.origin !== 'archive-carter-1923-original-volume' ||
    r.license !== 'Public domain' ||
    r.archiveIdentifier !== id ||
    m?.identifier !== id ||
    r.sourceUrl !== `https://archive.org/details/${id}` ||
    r.downloadUrl !== `https://archive.org/download/${id}/${id}.pdf` ||
    r.rightsEvidence?.sourceUrl !== `https://archive.org/metadata/${id}` ||
    record?.source !== r.rightsEvidence?.sourceUrl ||
    m?.['possible-copyright-status'] !== 'No Copyright- United States' ||
    m?.['access-restricted-item'] === 'true' ||
    record?.is_dark === true ||
    !m?.collection?.includes('mitlibrariespublicdomain') ||
    m?.contributor !== 'MIT Libraries' ||
    m?.date !== '1923' ||
    m?.publisher !== 'New York, George H. Doran Co' ||
    m?.title !==
      'The tomb of Tut-ankh-Amen, discovered by the late Earl of Carnarvon and Howard Carter;' ||
    m?.creator !== 'Carter, Howard, 1874-1939, author' ||
    m?.['associated-names'] !== 'Mace, A. C. (Arthur Cruttenden), 1874-1928, author' ||
    r.title !== m?.title ||
    r.artist !== 'Howard Carter; A. C. Mace; photographs by Harry Burton' ||
    r.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'native-original-pdf' ||
    review.publicationYear !== 1923 ||
    review.scope !== 'original-1923-first-volume-architecture-only' ||
    review.publicationAndCreatorCreditInspected !== true ||
    review.originalUsCopyrightPageInspected !== true ||
    review.planPdfPage !== 17 ||
    review.titlePdfPage !== 11 ||
    review.copyrightPdfPage !== 12 ||
    review.entrancePdfPage !== 152 ||
    review.staircasePdfPage !== 157 ||
    ![11, 12, 17, 152, 157].every((p) => review.pagesInspected?.includes(p)) ||
    !review.notes?.trim() ||
    !pdf ||
    pdf.subarray(0, 5).toString() !== '%PDF-' ||
    Number(file?.size) !== pdf.length ||
    file?.sha1 !== hash(pdf ?? '', 'sha1')
  )
    blockers.push('supplemental-original-carter-us-volume-unverified');
  return { path: r.path, sourceUrl: r.sourceUrl, blockers, eligible: !blockers.length };
}
