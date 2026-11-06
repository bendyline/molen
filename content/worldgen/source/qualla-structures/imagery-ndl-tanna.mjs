/** Exact1936RailwayMinistry construction plates explicitly PDM in the owning NDL record. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
function bytes(d, p) {
  if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..')) return null;
  const f = path.resolve(d, p);
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return null;
  const r = path.relative(fs.realpathSync(d), fs.realpathSync(f));
  return path.isAbsolute(r) || r === '..' || r.startsWith(`..${path.sep}`)
    ? null
    : fs.readFileSync(f);
}
export function inspectNdlTannaReference(dir, reference) {
  const blockers = [],
    image = bytes(dir, reference.path),
    snapshot = bytes(dir, reference.rightsEvidence?.path);
  let p;
  try {
    p = JSON.parse(snapshot);
  } catch {}
  const manifest = bytes(dir, p?.manifest?.path),
    title = bytes(dir, p?.titlePage?.path);
  let j;
  try {
    j = JSON.parse(manifest);
  } catch {}
  const plate = p?.plates?.find((p) => p.path === reference.path),
    canvas = plate && j?.sequences?.[0]?.canvases?.[plate.canvas - 1],
    resource = canvas?.images?.[0]?.resource,
    service = resource?.service?.['@id'];
  const expected =
    plate &&
    (plate.region ? `${service}/${plate.region.join(',')}/full/0/default.jpg` : resource?.['@id']);
  if (
    !image ||
    hash(image) !== reference.sha256 ||
    image[0] !== 255 ||
    image[1] !== 216 ||
    image.length !== plate?.bytes
  )
    blockers.push('ndl1936-native-selected-photograph-bytes-unbound');
  if (
    !snapshot ||
    hash(snapshot) !== reference.rightsEvidence?.sha256 ||
    !manifest ||
    hash(manifest) !== p?.manifest?.sha256 ||
    !title ||
    hash(title) !== p?.titlePage?.sha256
  )
    blockers.push('ndl1936-primary-PDM-record-or-dated-title-unbound');
  const meta = new Map((j?.metadata ?? []).map((m) => [m.label, m.value]));
  if (
    reference.origin !== 'ndl-tanna1936-public-domain-plates' ||
    reference.license !== 'Public domain' ||
    reference.artist !== 'Railway Ministry Atami Construction Office (1936)' ||
    reference.sourceUrl !== 'https://ndlsearch.ndl.go.jp/books/R100000002-I000001008956' ||
    p?.bookTitle !== '丹那隧道工事誌' ||
    p?.publisher !== '鉄道省熱海建設事務所' ||
    p?.publicationYear !== 1936 ||
    p?.libraryRights !== 'PDM' ||
    p?.titlePage?.canvas !== 4 ||
    meta.get('Access Restrictions') !== 'PDM' ||
    meta.get('Publication Date') !== '1936' ||
    meta.get('Publisher') !== '鉄道省熱海建設事務所' ||
    meta.get('Persistent ID') !== 'info:ndljp/pid/1877593' ||
    p?.manifest?.source !== 'https://dl.ndl.go.jp/api/iiif/1877593/manifest.json' ||
    ![9, 10, 11].includes(plate?.canvas) ||
    expected !== reference.downloadUrl ||
    plate?.sha256 !== reference.sha256 ||
    reference.visuallyReviewedForThisPolicy !== true ||
    reference.originalReview?.status !== 'inspected' ||
    reference.originalReview?.canvas !== plate?.canvas ||
    reference.originalReview?.unrelatedArtAndThirdPartyAerialUnused !== true ||
    !reference.originalReview?.notes?.trim()
  )
    blockers.push('ndl1936-exact-dated-PDM-tunnel-plate-unverified');
  if (plate?.canvas === 9 && JSON.stringify(plate.region) !== '[4995,200,1320,1960]')
    blockers.push('ndl-east-portal-only-region-required');
  if (plate?.canvas === 11 && JSON.stringify(plate.region) !== '[2500,700,1050,1730]')
    blockers.push('ndl-west-portal-only-region-required');
  if (plate?.canvas === 10 && plate.region !== null)
    blockers.push('ndl-constructed-liner-original-page-required');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible: !blockers.length,
    blockers,
    licenseScope:
      'Only selected1936Ministry tunnel photographs/constructed-liner plate; unrelated memorial relief, third-party aerial, foreign/proposed diagrams and1952book images unused.',
  };
}
