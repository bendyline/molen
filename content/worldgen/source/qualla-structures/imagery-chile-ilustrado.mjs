/** Exact public-domain1872 Chile Ilustrado volume; book author is not assumed to be its engraver. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b, a = 'sha256') => createHash(a).update(b).digest('hex');
function local(dir, name, expected) {
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
    return null;
  const f = path.resolve(dir, name);
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return null;
  const real = path.relative(fs.realpathSync(dir), fs.realpathSync(f));
  if (path.isAbsolute(real) || real === '..' || real.startsWith(`..${path.sep}`)) return null;
  const bytes = fs.readFileSync(f);
  return hash(bytes) === expected?.replace(/^sha256:/, '') ? bytes : null;
}
export function inspectChileIlustradoReference(dir, r) {
  const blockers = [],
    pdf = local(dir, r.path, r.sha256),
    snapshot = local(dir, r.rightsEvidence?.path, r.rightsEvidence?.sha256);
  if (!pdf) blockers.push('supplemental-image-bytes-unbound');
  if (!snapshot) blockers.push('supplemental-rights-snapshot-unbound');
  let record;
  try {
    record = JSON.parse(snapshot);
  } catch {}
  const title = 'File:Chile Ilustrado (1872).pdf',
    p = Object.values(record?.query?.pages ?? {}).find((p) => p.title === title),
    i = p?.imageinfo?.[0],
    body = p?.revisions?.[0]?.slots?.main?.['*'] ?? '',
    review = r.originalReview;
  let source, download, native, ref;
  try {
    source = new URL(record?.source);
    download = new URL(r.downloadUrl);
    native = new URL(i?.url);
    ref = new URL(r.sourceUrl);
  } catch {}
  if (
    r.origin !== 'commons-chile-ilustrado-1872-original-volume' ||
    r.license !== 'Public domain' ||
    r.title !== 'Chile Ilustrado (1872)' ||
    r.artist !== 'Recaredo Santos Tornero (1842–1902), book author; wood engraver uncredited' ||
    source?.origin !== 'https://commons.wikimedia.org' ||
    source?.pathname !== '/w/api.php' ||
    source?.searchParams.get('action') !== 'query' ||
    !['imageinfo', 'revisions'].every((v) =>
      source?.searchParams.get('prop')?.split('|').includes(v),
    ) ||
    !source?.searchParams.get('titles')?.split('|').includes(title) ||
    r.rightsEvidence?.sourceUrl !== record?.source ||
    ref?.origin !== 'https://commons.wikimedia.org' ||
    decodeURIComponent(ref?.pathname ?? '').replaceAll('_', ' ') !== `/wiki/${title}` ||
    download?.origin !== 'https://upload.wikimedia.org' ||
    decodeURIComponent(download?.pathname ?? '') !==
      '/wikipedia/commons/c/c5/Chile_Ilustrado_(1872).pdf' ||
    download?.origin !== native?.origin ||
    download?.pathname !== native?.pathname ||
    p?.revisions?.[0]?.revid !== 1123319378 ||
    !body.includes('{{Creator:Recaredo Santos Tornero}}') ||
    !body.includes('{{PD-old-100}}') ||
    !body.includes('|Date=1872') ||
    !body.includes('http://www.memoriachilena.cl/archivos2/pdfs/MC0012105.pdf') ||
    i?.extmetadata?.LicenseShortName?.value !== 'Public domain' ||
    i?.extmetadata?.Copyrighted?.value !== 'False' ||
    i?.extmetadata?.AttributionRequired?.value !== 'false' ||
    String(i?.extmetadata?.Restrictions?.value ?? '').trim() ||
    !String(i?.extmetadata?.Artist?.value).includes('Recaredo Santos Tornero') ||
    i?.sha1 !== '92c2db0b86b9491451a1ab309cacc192650efadf' ||
    i?.size !== 57970748 ||
    i?.pagecount !== 514 ||
    !pdf ||
    pdf.subarray(0, 5).toString() !== '%PDF-' ||
    pdf.length !== i?.size ||
    hash(pdf, 'sha1') !== i?.sha1 ||
    r.visuallyReviewedForThisPolicy !== true ||
    review?.status !== 'inspected' ||
    review?.rendition !== 'native-original-pdf' ||
    review?.publicationYear !== 1872 ||
    review?.bookAuthorDied !== 1902 ||
    review?.titlePdfPage !== 3 ||
    review?.theatrePdfPage !== 39 ||
    review?.newPlanPdfPage !== 40 ||
    review?.representedPhase !== '1857–1870-original-theatre' ||
    review?.uncreditedEngraverNotAssumedAuthor !== true ||
    review?.newPlanDimensionsExcludedFromOldPhase !== true ||
    ![3, 39, 40].every((n) => review?.pagesInspected?.includes(n))
  )
    blockers.push('supplemental-chile-ilustrado-original-volume-unverified');
  return { path: r.path, sourceUrl: r.sourceUrl, blockers, eligible: !blockers.length };
}
