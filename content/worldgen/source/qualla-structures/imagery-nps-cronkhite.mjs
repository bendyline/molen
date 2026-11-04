/** One individually credited original NPS architectural context image. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plain = (value) => String(value ?? '').replace(/^sha256:/, '');
export const cronkhitePhotoUrl =
  'https://www.nps.gov/common/uploads/stories/images/nri/20151109/articles/44D56512-155D-9421-1FD6687671905CCF/44D56512-155D-9421-1FD6687671905CCF.jpg';
export function inspectCronkhiteNpsReference(dir, r) {
  const blockers = [];
  try {
    const bytes = (name) => {
      if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).includes('..'))
        throw Error('path');
      const full = fs.realpathSync(path.resolve(dir, name));
      const rel = path.relative(fs.realpathSync(dir), full);
      if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
        throw Error('path');
      return fs.readFileSync(full);
    };
    const image = bytes(r.path),
      page = bytes(r.rightsEvidence?.path),
      policy = bytes(r.policyEvidence?.path);
    const html = page.toString(),
      ptext = policy
        .toString()
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ');
    const source = 'https://www.nps.gov/articles/fortcronkite.htm';
    const imagePath = new URL(cronkhitePhotoUrl).pathname;
    const figure = [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)]
      .map((m) => m[0])
      .find((s) => s.includes(imagePath));
    if (
      digest(image) !== plain(r.sha256) ||
      digest(page) !== plain(r.rightsEvidence?.sha256) ||
      digest(policy) !== plain(r.policyEvidence?.sha256)
    )
      blockers.push('supplemental-nps-original-bytes-unbound');
    if (
      r.origin !== 'nps-agency-photo-public-domain' ||
      r.license !== 'Public domain' ||
      r.sourceUrl !== source ||
      r.rightsEvidence?.sourceUrl !== source ||
      !html.includes(`<meta property="og:url" content="${source}"`) ||
      r.downloadUrl !== cronkhitePhotoUrl ||
      !figure ||
      /©|copyright/i.test(figure) ||
      figure.match(/<p class="figcredit">([^<]*)<\/p>/)?.[1] !== 'NPS' ||
      r.artist !== 'NPS' ||
      plain(r.sha256) !== '82575bb63fb113b982e1443364cbbda19db2c6c2e89d1a479693d8982005ad35' ||
      !ptext.includes('Images credited to NPS without any copyright symbol are public domain.') ||
      r.policyEvidence?.sourceUrl !==
        'https://www.nps.gov/media/photo/gallery-item.htm?gid=F79A6217-155D-4519-3E9F2D18F4622FEC&id=f79a62ae-155d-4519-3e2d-049e9eafe8f3' ||
      r.originalReview?.status !== 'inspected' ||
      r.originalReview?.rendition !== 'native-original'
    )
      blockers.push('supplemental-nps-individual-credit-and-agency-release-unverified');
  } catch {
    blockers.push('supplemental-nps-evidence-unreadable');
  }
  return { path: r.path, sourceUrl: r.sourceUrl, blockers, eligible: blockers.length === 0 };
}
