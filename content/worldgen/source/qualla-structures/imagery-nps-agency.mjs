/** Individually credited NPS originals, bound to their original page and agency release. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cronkhitePhotoUrl, inspectCronkhiteNpsReference } from './imagery-nps-cronkhite.mjs';

const digest = (b) => createHash('sha256').update(b).digest('hex');
const plain = (h) => String(h ?? '').replace(/^sha256:/, '');
const originals = {
  'Battery_Commander_Station_Nov2025_LElze.jpg': [
    'NPS',
    '924dc6d590adcc0e5b58c0a367819831b07a3c0583d043a8434ed84a47ca6251',
  ],
  'MAHE_130210_Frank-Schmidt_003.jpg': [
    'Frank Schmidt NPS',
    '0515de05c74474ec00cc141f9ec39f4aa545964ef376b538b2dcfa8f32dd6096',
  ],
  'Hawk_Hill_Phase3_Path_March2025.jpeg': [
    'NPS',
    '6db2cbde8ba55bcb1d8e064006fd1f090586ffed6de1870dd8740a94aa6cd482',
  ],
};
export function inspectNpsAgencyReference(dir, r) {
  if (r.downloadUrl === cronkhitePhotoUrl) return inspectCronkhiteNpsReference(dir, r);
  const blockers = [];
  try {
    const bytes = (p) => {
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        throw Error('path');
      const full = fs.realpathSync(path.resolve(dir, p)),
        rel = path.relative(fs.realpathSync(dir), full);
      if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
        throw Error('path');
      return fs.readFileSync(full);
    };
    const image = bytes(r.path),
      page = bytes(r.rightsEvidence?.path),
      policy = bytes(r.policyEvidence?.path),
      html = page.toString(),
      ptext = policy
        .toString()
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' '),
      source = 'https://www.nps.gov/goga/learn/nature/hawk-hill-visitor-improvement-project.htm',
      file = r.downloadUrl?.split('/').at(-1),
      original = originals[file];
    const figure = [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)]
        .map((m) => m[0])
        .find((s) => s.includes(`/images/${file}?`)),
      credit = figure?.match(/<p class="figcredit">([^<]*)<\/p>/)?.[1];
    if (
      digest(image) !== plain(r.sha256) ||
      digest(page) !== plain(r.rightsEvidence?.sha256) ||
      digest(policy) !== plain(r.policyEvidence?.sha256)
    )
      blockers.push('supplemental-nps-original-bytes-unbound');
    if (
      !original ||
      r.origin !== 'nps-agency-photo-public-domain' ||
      r.license !== 'Public domain' ||
      r.sourceUrl !== source ||
      r.rightsEvidence?.sourceUrl !== source ||
      !html.includes(`<meta property="og:url" content="${source}"`) ||
      r.downloadUrl !== `https://www.nps.gov/goga/learn/nature/images/${file}` ||
      !figure ||
      /©|copyright/i.test(figure) ||
      credit !== original[0] ||
      r.artist !== credit ||
      (original[1] && plain(r.sha256) !== original[1]) ||
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
