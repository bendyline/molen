/** Original published excavation plans, bound to their library's exact expired edition. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b, algorithm = 'sha256') => createHash(algorithm).update(b).digest('hex');
export function inspectExcavationPlanReference(dir, r) {
  const blockers = [],
    read = (p, expected) => {
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return null;
      const target = path.resolve(dir, p);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
      const relative = path.relative(fs.realpathSync(dir), fs.realpathSync(target));
      if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
      const b = fs.readFileSync(target);
      return hash(b) === expected?.replace(/^sha256:/, '') ? b : null;
    };
  const pdf = read(r.path, r.sha256),
    snapshot = read(r.rightsEvidence?.path, r.rightsEvidence?.sha256);
  if (!pdf) blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot) blockers.push('supplemental-rights-snapshot-unbound');
  let record;
  try {
    record = JSON.parse(snapshot);
  } catch {}
  const m = record?.metadata,
    id = r.archiveIdentifier,
    review = r.originalReview,
    file = record?.files?.find((f) => f.name === `${id}.pdf`),
    creators = m?.creator,
    expired =
      Array.isArray(creators) &&
      creators.length > 1 &&
      creators.every((c) => {
        const died = Number(c.match(/(?:-|d\.\s*)(\d{4})\s*$/)?.[1]);
        return !/unknown|anonymous/i.test(c) && died >= 1800 && died <= 1955;
      });
  // The colonial government issued the 1918 guide for the head of its
  // archaeological survey. Bind the government publication to the Cornell copy.
  const taxilaGovernmentGuide =
    id === 'cu31924024121125' &&
    m?.title === 'A guide to Taxila' &&
    m?.date === '1918' &&
    m?.publisher === 'Calcutta, Superintendent government printing, India' &&
    m?.contributor === 'Cornell University Library' &&
    creators === 'Marshall, John Hubert, Sir, 1876-1958' &&
    r.artist === creators &&
    file?.sha1 === 'aaf3359ef238e7a105c16f561ca0c04b8ebd304e' &&
    review?.scope === 'original-excavation-plan-and-north-exterior' &&
    review.titlePdfPage === 9 &&
    review.planPdfPage === 57 &&
    review.exteriorPdfPage === 89 &&
    review.pagesInspected?.includes(review.exteriorPdfPage) &&
    review.planCaption === 'Plan of the Dharmarajika Stupa' &&
    review.exteriorCaption === 'View of the Dharmarajika Stupa from North' &&
    review.rightsBasis === 'expired-government-publication';
  if (
    r.origin !== 'archive-expired-excavation-plan' ||
    r.license !== 'Public domain' ||
    !/^[a-z0-9]+$/.test(id ?? '') ||
    m?.identifier !== id ||
    r.sourceUrl !== `https://archive.org/details/${id}` ||
    r.downloadUrl !== `https://archive.org/download/${id}/${id}.pdf` ||
    r.rightsEvidence?.sourceUrl !== `https://archive.org/metadata/${id}` ||
    (!taxilaGovernmentGuide && m?.['possible-copyright-status'] !== 'NOT_IN_COPYRIGHT') ||
    m?.['access-restricted-item'] === 'true' ||
    !m?.contributor?.trim() ||
    !m?.publisher?.trim() ||
    !r.title ||
    r.title !== m?.title ||
    !Number.isInteger(review?.publicationYear) ||
    review.publicationYear < 1800 ||
    review.publicationYear > 1920 ||
    m?.date !== String(review.publicationYear) ||
    (!taxilaGovernmentGuide &&
      (!expired ||
        JSON.stringify(r.catalogCreators) !== JSON.stringify(creators) ||
        r.artist !== creators?.join('; '))) ||
    review?.status !== 'inspected' ||
    review.rendition !== 'native-original-pdf' ||
    (!taxilaGovernmentGuide && review.scope !== 'original-excavation-plan-and-section-only') ||
    !Number.isInteger(review.planPdfPage) ||
    review.planPdfPage < 1 ||
    !review.pagesInspected?.includes(review.planPdfPage) ||
    !review.pagesInspected?.includes(review.titlePdfPage) ||
    !review.planCaption?.trim() ||
    !review.planCreditBasis?.trim() ||
    r.visuallyReviewedForThisPolicy !== true ||
    !pdf ||
    pdf.subarray(0, 5).toString() !== '%PDF-' ||
    Number(file?.size) !== pdf.length ||
    file?.sha1 !== hash(pdf, 'sha1')
  )
    blockers.push('supplemental-original-expired-excavation-plan-unverified');
  return { path: r.path, sourceUrl: r.sourceUrl, blockers, eligible: !blockers.length };
}
