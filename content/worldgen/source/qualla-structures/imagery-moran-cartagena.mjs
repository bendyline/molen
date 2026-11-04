/** Exact museum-released1870JohnMoran photograph; no modern gallery/UI imagery. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
function bytes(d, p) {
  if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..')) return null;
  const file = path.resolve(d, p);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const rel = path.relative(fs.realpathSync(d), fs.realpathSync(file));
  return path.isAbsolute(rel) || rel === '..' || rel.startsWith(`..${path.sep}`)
    ? null
    : fs.readFileSync(file);
}
export function inspectMoranCartagenaReference(dir, reference) {
  const blockers = [],
    image = bytes(dir, reference.path),
    snapshot = bytes(dir, reference.rightsEvidence?.path);
  let p;
  try {
    p = JSON.parse(snapshot);
  } catch {}
  const record = bytes(dir, p?.primaryRecord?.path);
  const url = 'https://www.cartermuseum.org/collection/old-cathedral-cartagena-p198334';
  const download =
    'https://d2ujpqfu85jxzw.cloudfront.net/website/panth-live/artwork/P1983-3-4/carter_p1983-3-4_o2_11.jpg';
  if (
    !image ||
    digest(image) !== reference.sha256 ||
    image[0] !== 255 ||
    image[1] !== 216 ||
    image.length !== 556722
  )
    blockers.push('moran-original-photograph-bytes-unbound');
  if (
    !snapshot ||
    digest(snapshot) !== reference.rightsEvidence?.sha256 ||
    !record ||
    digest(record) !== p?.primaryRecord?.sha256
  )
    blockers.push('moran-original-museum-rights-record-unbound');
  if (
    reference.origin !== 'amon-carter-moran1870-public-domain' ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'John Moran (1831-1902)' ||
    reference.sourceUrl !== url ||
    reference.downloadUrl !== download ||
    p?.source !== url ||
    p?.accession !== 'P1983.3.4' ||
    p?.creator !== 'John Moran' ||
    p?.creatorBorn !== 1831 ||
    p?.creatorDied !== 1902 ||
    p?.photographYear !== 1870 ||
    p?.copyright !== 'Public domain' ||
    p?.originalImageHash !== reference.sha256 ||
    p?.originalDownloadUrl !== download ||
    p?.primaryRecord?.source !== url ||
    !record ||
    ![
      'John Moran',
      '1831-1902',
      '1870',
      'Public domain',
      'P1983.3.4',
      '/artwork/P1983-3-4/carter_p1983-3-4_o2_11.jpg',
    ].every((s) => record.toString().includes(s)) ||
    reference.visuallyReviewedForThisPolicy !== true ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.rendition !== 'native-original' ||
    reference.originalReview?.representedYear !== 1870 ||
    reference.originalReview?.entireStereographInspected !== true ||
    !reference.originalReview?.notes?.trim()
  )
    blockers.push('moran-specific-dated-museum-public-domain-release-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
    licenseScope:
      'Exact1870Moran historical stereograph from museum accessionP1983.3.4; no modern gallery UI or other images.',
  };
}
