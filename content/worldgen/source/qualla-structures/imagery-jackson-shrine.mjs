import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const filename = 'From_Constantinople_to_the_home_of_Omar_Khayyam.djvu';
const book = `https://commons.wikimedia.org/wiki/File:${filename}`;
const original = `https://upload.wikimedia.org/wikipedia/commons/8/89/${filename}`;
const archive = 'https://archive.org/details/fromconstantinop00jackuoft';
const volumeSha1 = 'eb9a17975cec615ddc65a7124d5f36a1b3906f8c';
const leafHashes = new Map([
  [9, 'e8280bfd3639d2ef24c18e4eb8e80750bd42b6725ab6cc33d87db02137cbb0df'],
  [31, '54bf8df214e5571f8c37d1b54ddd5d37ea59c22aca004d59557fdb89002392c3'],
  [440, 'c7acf7c1466b20d307808d46a71d4a03f3e095b2e638b5ea0519a3d0f31642d5'],
  [449, '195bf05168541a49185fe8f420991398ff9fc402ba15afb1ac51529e76468b15'],
]);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plain = (digest) => digest?.replace(/^sha256:/, '');
const pageUrl = (leaf) => `https://en.wikisource.org/wiki/Page:${filename}/${leaf}`;
const pageImage = (leaf) =>
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/' +
  filename +
  '/page' +
  leaf +
  '-1280px-' +
  filename +
  '.jpg';

function localBytes(dir, name) {
  if (typeof name !== 'string' || isAbsolute(name) || name.split(/[\\/]/).includes('..'))
    throw Error('Invalid archive evidence path');
  const file = realpathSync(resolve(dir, name));
  const fromBundle = relative(realpathSync(dir), file);
  if (fromBundle.startsWith('..') || isAbsolute(fromBundle))
    throw Error('Archive evidence escapes the source bundle');
  return readFileSync(file);
}

export function inspectJacksonShrinePlate(dir, reference) {
  const result = { path: reference.path, sourceUrl: reference.sourceUrl };
  try {
    const leaf = reference.originalReview?.leaf;
    const file = localBytes(dir, reference.path);
    const source = localBytes(dir, reference.rightsEvidence?.path);
    const record = JSON.parse(source);
    const item = Object.values(record.commons?.query?.pages ?? {})[0];
    const info = item?.imageinfo?.[0];
    const archiveCopy = record.archive?.metadata;
    const artifactsMatch =
      (leaf === 440 || leaf === 449) &&
      file[0] === 0xff &&
      file[1] === 0xd8 &&
      sha(file) === leafHashes.get(leaf) &&
      plain(reference.sha256) === leafHashes.get(leaf) &&
      sha(source) === plain(reference.rightsEvidence?.sha256) &&
      [9, 31].every(
        (p) => sha(localBytes(dir, record.publicationLeaves?.[p])) === leafHashes.get(p),
      );
    const metadataMatches =
      item?.title === `File:${filename.replaceAll('_', ' ')}` &&
      info?.descriptionurl === book &&
      info?.url?.split('?')[0] === original &&
      info?.sha1 === volumeSha1 &&
      info?.size === 15907129 &&
      info?.extmetadata?.LicenseShortName?.value === 'Public domain' &&
      info.extmetadata?.Copyrighted?.value === 'False' &&
      info.extmetadata?.AttributionRequired?.value === 'false' &&
      info.extmetadata?.Restrictions?.value === '' &&
      archiveCopy?.identifier === 'fromconstantinop00jackuoft' &&
      archiveCopy?.date === '1911' &&
      archiveCopy?.publisher === 'New York, Macmillan' &&
      archiveCopy?.contributor === 'Robarts - University of Toronto' &&
      record.archiveUrl === archive;
    const referenceMatches =
      reference.license === 'Public domain' &&
      reference.artist === 'A. V. Williams Jackson (1911 publication)' &&
      reference.sourceUrl === pageUrl(leaf) &&
      reference.downloadUrl === pageImage(leaf) &&
      reference.rightsEvidence.sourceUrl === book &&
      reference.originalReview.status === 'inspected' &&
      reference.originalReview.rendition === 'original-print-scan' &&
      reference.originalReview.publicationYear === 1911 &&
      reference.visuallyReviewedForThisPolicy === true;
    if (artifactsMatch && metadataMatches && referenceMatches)
      return { ...result, eligible: true, blockers: [] };
  } catch {
    // Absent or malformed evidence leaves this reference ineligible.
  }
  return {
    ...result,
    eligible: false,
    blockers: ['supplemental-original-jackson-shrine-plate-unverified'],
  };
}
