/** Bind public-domain architectural references to an exact archive item and rendition. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');

function readBound(dir, record) {
  const name = record?.path;
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
    return null;
  const file = path.resolve(dir, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const relative = path.relative(fs.realpathSync(dir), fs.realpathSync(file));
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`))
    return null;
  const bytes = fs.readFileSync(file);
  return hash(bytes) === record.sha256?.replace(/^sha256:/, '') ? bytes : null;
}

function readRecord(dir, record) {
  try {
    return JSON.parse(readBound(dir, record));
  } catch {
    return null;
  }
}

function mccordMatches(dir, reference, image, record) {
  const page = readRecord(dir, reference.commonsEvidence);
  const info = page?.imageinfo?.[0];
  const revision = page?.revisions?.[0];
  const source = revision?.slots?.main?.['*'];
  const accession = record.accession;
  return (
    /^https:\/\/collections\.musee-mccord-stewart\.ca\/en\/objects\/\d+\/[a-z0-9-]+$/.test(
      reference.rightsEvidence?.sourceUrl ?? '',
    ) &&
    record.url === reference.rightsEvidence.sourceUrl &&
    record.label === 'Public Domain' &&
    record.permitsCommercialReuse === true &&
    /^VIEW-\d+(?:\.[\dA-Z]+)?$/.test(accession ?? '') &&
    accession === reference.accessionNumber &&
    record.artist === reference.artist &&
    info?.descriptionurl === reference.sourceUrl &&
    info?.url?.split('?')[0] === reference.downloadUrl &&
    info?.sha1 === hash(image, 'sha1') &&
    info.size === image.length &&
    info.extmetadata?.LicenseShortName?.value === 'Public domain' &&
    revision?.revid === reference.nativeRevision &&
    source?.includes(`|Source={{MM|${accession}}}`) &&
    source.includes(`|Author=${reference.artist}\n`) &&
    source.includes(`|Date=${reference.dateCreated}\n`) &&
    source.includes('{{PD-Canada}}') &&
    source.includes('{{PD-1923}}') &&
    reference.originalReview?.rendition === 'native-original'
  );
}

function banqMatches(reference, record) {
  const sheet = record.sheet;
  return (
    /^https:\/\/numerique\.banq\.qc\.ca\/patrimoine\/details\/52327\/\d+$/.test(
      reference.sourceUrl ?? '',
    ) &&
    record.url === reference.sourceUrl &&
    record.url === reference.rightsEvidence?.sourceUrl &&
    record.label === 'Domaine public au Canada' &&
    record.rightsDeclaration === 'https://creativecommons.org/publicdomain/mark/1.0/deed.fr' &&
    record.creator === reference.artist &&
    Number.isInteger(record.publicationYear) &&
    record.publicationYear < 1923 &&
    record.publicationYear === reference.publicationYear &&
    /^\d{3}$/.test(sheet?.designation ?? '') &&
    /^[\w-]{22}$/.test(sheet.id ?? '') &&
    sheet.designation === reference.sheet &&
    sheet.restriction?.accesRestriction === false &&
    record.imageService?.['@id'] === `https://img.banq.qc.ca/iiif/2/${sheet.id}` &&
    reference.downloadUrl === `${record.imageService['@id']}/full/full/0/default.jpg` &&
    record.imageService.width === reference.width &&
    record.imageService.height === reference.height &&
    record.scanSha256 === reference.sha256 &&
    reference.originalReview?.rendition === 'full-resolution-archive-scan'
  );
}

export function inspectPublicArchiveReference(dir, reference) {
  const image = readBound(dir, reference);
  const record = readRecord(dir, reference.rightsEvidence);
  const blockers = [];
  if (!image) blockers.push('supplemental-image-bytes-unbound');
  if (!record) blockers.push('supplemental-rights-snapshot-unbound');
  if (
    !image ||
    !record ||
    image.length < 2 ||
    image.readUInt16BE(0) !== 0xffd8 ||
    reference.license !== 'Public domain' ||
    reference.visuallyReviewedForThisPolicy !== true ||
    reference.originalReview?.status !== 'inspected' ||
    !(reference.origin === 'commons-mccord-public-domain'
      ? mccordMatches(dir, reference, image, record)
      : reference.origin === 'banq-public-domain-atlas' && banqMatches(reference, record))
  )
    blockers.push('supplemental-archive-item-public-domain-unverified');
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    blockers,
    eligible: blockers.length === 0,
  };
}
