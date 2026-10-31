/** Bind an original periodical PDF to its holding library's item-specific PD statement. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => createHash('sha256').update(b).digest('hex');
function local(dir, name) {
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
    return null;
  const file = path.resolve(dir, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const rel = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  if (path.isAbsolute(rel) || rel === '..' || rel.startsWith(`..${path.sep}`)) return null;
  return fs.readFileSync(file);
}
export function inspectSilesianPeriodicalReference(dir, r) {
  const pdf = local(dir, r.path),
    snapshot = local(dir, r.rightsEvidence?.path),
    blockers = [];
  let pp;
  try {
    const raw = snapshot
      .toString()
      .match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    pp = JSON.parse(raw).props.pageProps;
  } catch {
    /* Missing or malformed original library response. */
  }
  const page = pp?.data?.components?.publicationPage,
    access = pp?.data?.components?.contentAccess;
  const values = (key) => pp?.dCTagsData?.metadata?.find((m) => m.roleId === key)?.values ?? [];
  const year = Number(values('date')[0]),
    review = r.originalReview;
  const edition = pp?.editionId,
    publication = page?.publication?.id;
  const original = values('identifier').filter((s) =>
    /^https?:\/\/sbc\.org\.pl\/Content\/\d+\/PDF\/[a-zA-Z0-9_-]+\.pdf$/.test(s),
  );
  if (pdf?.subarray(0, 5).toString() !== '%PDF-' || hash(pdf) !== r.sha256?.replace(/^sha256:/, ''))
    blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot || hash(snapshot) !== r.rightsEvidence?.sha256?.replace(/^sha256:/, ''))
    blockers.push('supplemental-rights-snapshot-unbound');
  if (
    r.origin !== 'silesian-library-public-domain-periodical' ||
    r.license !== 'Public domain' ||
    !/^\d+$/.test(String(edition ?? '')) ||
    !/^\d+$/.test(String(publication ?? '')) ||
    pp?.dCTagsData?.elementId !== String(edition) ||
    page?.edition?.id !== String(edition) ||
    page?.publication?.id !== String(publication) ||
    page?.canonicalUrl !== r.sourceUrl ||
    r.rightsEvidence?.sourceUrl !== r.sourceUrl ||
    !r.sourceUrl?.startsWith(
      `https://sbc.org.pl/dlibra/publication/${publication}/edition/${edition}/`,
    ) ||
    page?.editionAccessType !== 'AVAILABLE' ||
    page?.allowDownload !== true ||
    access?.accessLimited !== false ||
    page?.externalContent !== null ||
    values('rights').length !== 1 ||
    values('rights')[0] !== 'Domena publiczna (public domain)' ||
    original.length !== 1 ||
    original[0].replace(/^http:/, 'https:') !== r.downloadUrl ||
    !r.downloadUrl?.includes(`/Content/${edition}/PDF/`) ||
    !Number.isInteger(year) ||
    year < 1800 ||
    year > 1929 ||
    year !== review?.publicationYear ||
    values('title')[0] !== r.publicationTitle ||
    values('publisher')[0] !== r.publicationPublisher ||
    !values('contributor').includes(r.artist) ||
    !r.artist?.trim() ||
    r.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'native-original-pdf' ||
    !review?.publicationAndCreatorCreditInspected ||
    !Number.isInteger(review.pageCount) ||
    review.pageCount < 1 ||
    !Array.isArray(review.pagesInspected) ||
    !review.pagesInspected.includes(1) ||
    review.pagesInspected.some((p) => !Number.isInteger(p) || p < 1 || p > review.pageCount) ||
    !review?.notes?.trim()
  )
    blockers.push('supplemental-library-periodical-grant-unverified');
  return { path: r.path, sourceUrl: r.sourceUrl, eligible: blockers.length === 0, blockers };
}
