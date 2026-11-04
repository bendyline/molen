/** Exact 1847 fort drawings by Svedstrup, reproduced in the inspected 1918 volume.
 * Clearance covers those historical plates, not the library's modern wrapper/logo.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = (b) => createHash('sha256').update(b).digest('hex'),
  plain = (s) => String(s ?? '').replace(/^sha256:/, '');
function bytes(d, p) {
  if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..')) return null;
  const f = path.resolve(d, p);
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return null;
  const r = path.relative(fs.realpathSync(d), fs.realpathSync(f));
  return path.isAbsolute(r) || r === '..' || r.startsWith(`..${path.sep}`)
    ? null
    : fs.readFileSync(f);
}
export function inspectDanishFortDrawingReference(dir, reference) {
  const blockers = [],
    pdf = bytes(dir, reference.path),
    snapshot = bytes(dir, reference.rightsEvidence?.path);
  let p;
  try {
    p = JSON.parse(snapshot);
  } catch {}
  if (!pdf || digest(pdf) !== plain(reference.sha256) || pdf.subarray(0, 5).toString() !== '%PDF-')
    blockers.push('supplemental-original-book-bytes-unbound');
  if (!snapshot || digest(snapshot) !== plain(reference.rightsEvidence?.sha256))
    blockers.push('supplemental-rights-snapshot-unbound');
  const museum =
      'https://natmus.dk/historisk-viden/forskning/forskningsprojekter/ghana-initiativet/frederiksgaves-historie/svedstrup/',
    review = reference.originalReview;
  const credit = bytes(dir, p?.bookCredit?.path),
    title = bytes(dir, p?.bookTitlePage?.path),
    bio = bytes(dir, p?.creatorFacts?.path);
  if (
    reference.origin !== 'expired-danish-svedstrup-fort-drawings' ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'Johan Wilhelm Svedstrup (1819-1893)' ||
    reference.sourceUrl !== 'https://slaegtsbibliotek.dk/937166.pdf' ||
    reference.downloadUrl !== reference.sourceUrl ||
    p?.source !== reference.sourceUrl ||
    p?.originalPdfHash !== reference.sha256 ||
    p?.originalPdfBytes !== pdf?.length ||
    p?.drawingYear !== 1847 ||
    p?.creatorBorn !== 1819 ||
    p?.creatorDied !== 1893 ||
    p?.publicationYear !== 1918 ||
    p?.copyrightScope !==
      'Only the historical Svedstrup1847 exterior and ground-plan plates on PDFpages120and124; modern librarywrapper/logo and all other images unused.' ||
    p?.creatorFacts?.source !== museum ||
    p?.creatorFacts?.retrieval !==
      'actually-read-primary-museum-text-via-web-cache-direct-small-placeholder-excluded' ||
    !title ||
    digest(title) !== plain(p?.bookTitlePage?.sha256) ||
    !title.toString().includes('MCMXVIII') ||
    !title.toString().includes('KAY LARSEN') ||
    !credit ||
    digest(credit) !== plain(p?.bookCredit?.sha256) ||
    !credit.toString().includes('Grundtegning af Fortet Prinsensten') ||
    !credit.toString().includes('Ljnt. V. Svedstrups Tegning') ||
    !credit.toString().includes('Museet for Handel og Søfart') ||
    !bio ||
    digest(bio) !== plain(p?.creatorFacts?.sha256) ||
    !bio.toString().includes('1819-1893') ||
    !bio.toString().includes('1847') ||
    !bio.toString().includes(museum) ||
    reference.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'native-original-pdf' ||
    JSON.stringify(review?.pagesInspected) !== '[4,120,124,145]' ||
    review?.publicationAndCreatorCreditInspected !== true ||
    review?.historicalPlatesOnly !== true ||
    !review?.notes?.trim()
  )
    blockers.push('supplemental-dated-svedstrup-original-plates-or-creator-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
    licenseScope: 'Two1847historicalfortplatesonly; no modernwrapper/logo/otherphotography.',
  };
}
