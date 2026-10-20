/** Public-domain reference eligibility for the local structure batch.
 * Qualla's published article media and original-media metadata must agree. A
 * downloaded gallery file alone is not evidence that Qualla published it. This
 * checks provenance and bytes; photographic relevance still needs visual review.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PUBLIC_DOMAIN_POLICY = 'qualla-public-domain-imagery@1';
const read = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : null);
const inside = (root, relative) =>
  typeof relative === 'string' &&
  !path.isAbsolute(relative) &&
  !relative.split(/[\\/]/).includes('..')
    ? path.join(root, relative)
    : null;
const family = (image) => {
  let value = image?.descriptionUrl ?? image?.sourceUrl ?? '';
  try {
    value = decodeURIComponent(value);
  } catch {
    return '';
  }
  return value.replaceAll('_', ' ').normalize('NFC').toLowerCase();
};
export function publicDomainLabel(value) {
  const label = String(value ?? '')
    .trim()
    .toLowerCase();
  return label === 'public domain' || /^cc0(?:\s+1\.0)?$/.test(label);
}
export function publicDomainReviewMatches(review, references, inputHash) {
  return (
    review?.policy === PUBLIC_DOMAIN_POLICY &&
    review.status === 'passed' &&
    review.scope === 'all-model-reference-imagery' &&
    review.inputHash === inputHash &&
    review.referenceInputHash === references?.inputHash &&
    Array.isArray(review.excludedHistoricalImagery) &&
    typeof review.notes === 'string' &&
    review.notes.trim().length > 0 &&
    Array.isArray(review.acceptedReferencePaths) &&
    JSON.stringify([...review.acceptedReferencePaths].sort()) ===
      JSON.stringify((references?.references ?? []).map((r) => r.path).sort()) &&
    ((references?.references ?? []).length > 0 ||
      (references?.externalReferences?.length > 0 &&
        JSON.stringify([...(review.auxiliaryReferencePaths ?? [])].sort()) ===
          JSON.stringify(references.externalReferences.map((r) => r.path).sort())))
  );
}

/** An empty Qualla selection is valid only after the full inventory has verified
 * the prior Qualla search and every exact supplemental original/release. */
export function verifiedSupplementalSelection(references, inventory, evidence) {
  const external = references?.externalReferences;
  return (
    Array.isArray(references?.references) &&
    references.references.length === 0 &&
    Array.isArray(external) &&
    external.length > 0 &&
    inventory?.status === 'passed' &&
    inventory.qualla?.references?.length === 0 &&
    inventory.additional?.length === external.length &&
    new Set(external.map((r) => r.path)).size === external.length &&
    external.every(
      (r) =>
        inventory.additional.some((proof) => proof.path === r.path && proof.eligible === true) &&
        JSON.stringify(r) ===
          JSON.stringify(evidence?.references?.find((item) => item.path === r.path)),
    )
  );
}
const originals = (metadata, folder) => [
  ...(metadata?.hero ? [{ ...metadata.hero, path: `${folder}/hero.jpg` }] : []),
  ...(metadata?.gallery ?? []).map((image, i) => ({
    ...image,
    path: metadata.galleryPaths?.[i],
  })),
];

export function inspectImageryPolicy({
  qualla,
  references,
  stories,
  conflicts = [],
  allowUnhashed = false,
}) {
  const published = [];
  for (const story of stories ?? []) {
    const file = inside(qualla, story.sourcePath);
    if (!file || !story.sourcePath.startsWith('_c/art/')) continue;
    const article = read(file);
    for (const image of [article?.media?.hero, ...(article?.media?.images ?? [])].filter(Boolean))
      published.push({ image, storyId: story.id, articlePath: story.sourcePath });
  }
  const metadataCache = new Map();
  const mediaHashes = new Map();
  const mediaHash = (relative) => {
    if (!mediaHashes.has(relative)) {
      const p = inside(qualla, relative);
      mediaHashes.set(
        relative,
        p && relative.startsWith('_m/') && fs.existsSync(p) && fs.statSync(p).isFile()
          ? createHash('sha256').update(fs.readFileSync(p)).digest('hex')
          : null,
      );
    }
    return mediaHashes.get(relative);
  };
  const results = (references ?? []).map((reference) => {
    const blockers = [];
    if (!publicDomainLabel(reference.license)) blockers.push('not-public-domain');
    if (!reference.artist?.trim() || !family(reference))
      blockers.push('incomplete-source-attribution');
    if (conflicts.some((c) => c.path === reference.path))
      blockers.push('conflicting-source-records');
    const file = inside(qualla, reference.path);
    if (!file || !reference.path.startsWith('_m/') || !fs.existsSync(file))
      blockers.push('local-original-missing');
    const folder = typeof reference.path === 'string' ? path.posix.dirname(reference.path) : '';
    const metadataPath = `${folder}/metadata.json`;
    if (!metadataCache.has(metadataPath)) {
      const p = inside(qualla, metadataPath);
      metadataCache.set(metadataPath, p ? read(p) : null);
    }
    const metadata = metadataCache.get(metadataPath);
    const original = originals(metadata, folder).find((r) => r.path === reference.path);
    if (
      !original ||
      family(original) !== family(reference) ||
      original.license !== reference.license ||
      original.artist !== reference.artist
    )
      blockers.push('original-source-metadata-disagrees');
    const cleared = published.filter(
      ({ image }) =>
        family(image) === family(reference) &&
        image.license === reference.license &&
        image.artist === reference.artist &&
        !conflicts.some((c) => c.path === image.path) &&
        (image.path === reference.path ||
          // Qualla can publish an unchanged local copy while the media record
          // retains its original canonical path. Both actual files must agree.
          (mediaHash(reference.path) !== null &&
            mediaHash(image.path) === mediaHash(reference.path))),
    );
    if (!cleared.length) blockers.push('not-in-matching-published-qualla-media');
    const basis = (original?.categories ?? []).filter(
      (category) =>
        !/^PD[-_ ]US missing SDC copyright status$/i.test(category) &&
        (/^PD[-_ ](?!US[ _]architecture\b)/i.test(category) ||
          /^CC[-_]?0|^CC[-_]Zero$/i.test(category)),
    );
    if (publicDomainLabel(reference.license) && !/^cc0/i.test(reference.license) && !basis.length)
      blockers.push('public-domain-basis-not-recorded');
    let sha256 = null;
    if (file && fs.existsSync(file) && (reference.sha256 || !allowUnhashed)) {
      sha256 = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      if (sha256 !== reference.sha256?.replace(/^sha256:/, ''))
        blockers.push('original-bytes-unbound');
    }
    return {
      path: reference.path,
      sourceUrl: reference.sourceUrl ?? null,
      license: reference.license ?? null,
      artist: reference.artist ?? null,
      eligible: blockers.length === 0,
      blockers,
      publicDomainBasis: basis,
      publishedIn: cleared.map(({ storyId, articlePath }) => ({ storyId, articlePath })),
      ...(cleared.some(({ image }) => image.path !== reference.path)
        ? {
            publishedAliases: cleared
              .filter(({ image }) => image.path !== reference.path)
              .map(({ image }) => ({ path: image.path, sha256: mediaHash(image.path) })),
          }
        : {}),
      originalMetadata: metadataPath,
      sha256,
    };
  });
  return {
    policy: PUBLIC_DOMAIN_POLICY,
    status: results.length && results.every((r) => r.eligible) ? 'passed' : 'needs-replacement',
    references: results,
  };
}
