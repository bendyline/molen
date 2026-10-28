/** Object-specific Getty Open Content image grants; descriptive text is separately licensed. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => createHash('sha256').update(b).digest('hex');
export function inspectGettyReference(dir, r) {
  const blockers = [],
    read = (p, expected) => {
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return null;
      const target = path.resolve(dir, p);
      if (!fs.existsSync(target)) return null;
      const relative = path.relative(fs.realpathSync(dir), fs.realpathSync(target));
      if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
      const b = fs.readFileSync(target);
      return hash(b) === expected?.replace(/^sha256:/, '') ? b : null;
    };
  const image = read(r.path, r.sha256),
    html = read(r.rightsEvidence?.path, r.rightsEvidence?.sha256),
    infoBytes = read(r.catalogEvidence?.path, r.catalogEvidence?.sha256);
  if (!image) blockers.push('supplemental-image-bytes-unbound');
  if (!html || !infoBytes) blockers.push('supplemental-rights-snapshot-unbound');
  let records = [],
    info;
  try {
    records = [
      ...html
        .toString()
        .matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    ].map((m) => JSON.parse(m[1]));
    info = JSON.parse(infoBytes);
  } catch {}
  const object = records.find((o) => o.url === r.sourceUrl && o['@type'] === 'Photograph'),
    id = info?.id;
  if (
    r.origin !== 'getty-object-cc0' ||
    r.license !== 'CC0' ||
    !/^https:\/\/www\.getty\.edu\/art\/collection\/object\/[A-Z\d]+$/.test(r.sourceUrl ?? '') ||
    r.rightsEvidence?.sourceUrl !== r.sourceUrl ||
    !object ||
    object.license !== 'http://creativecommons.org/publicdomain/zero/1.0/' ||
    !object.creditText?.some(
      (t) =>
        t.includes('Images provided here') &&
        t.includes('Open Content Program') &&
        t.includes('https://creativecommons.org/publicdomain/zero/1.0/'),
    ) ||
    object.identifier?.length !== 1 ||
    object.identifier[0] !== r.accessionNumber ||
    !r.title ||
    object.name !== r.title ||
    !r.era ||
    object.temporal !== r.era ||
    !object.creator?.length ||
    JSON.stringify(object.creator.map((c) => c.name)) !== JSON.stringify(r.creators) ||
    r.artist !== r.creators?.join('; ') ||
    !/^https:\/\/media\.getty\.edu\/iiif\/image\/[a-f\d-]{36}$/.test(id ?? '') ||
    object.thumbnailUrl !== `${id}/full/!300,300/0/default.jpg` ||
    r.downloadUrl !== `${id}/full/max/0/default.jpg` ||
    r.catalogEvidence?.sourceUrl !== `${id}/info.json` ||
    info?.type !== 'ImageService3' ||
    !Number.isInteger(r.width) ||
    r.width <= 0 ||
    info.width !== r.width ||
    info.height !== r.height ||
    r.bytes !== image?.length ||
    r.originalReview?.status !== 'inspected' ||
    r.originalReview?.rendition !== 'native-original'
  )
    blockers.push('supplemental-object-specific-getty-cc0-unverified');
  return { path: r.path, sourceUrl: r.sourceUrl, blockers, eligible: !blockers.length };
}
