/** Stable authored names. Titles may change without changing an assigned identity. */
export const structureKeyPattern = /^(?=.*[a-z])(?!n\d{4}(?:_|$))[a-z0-9]+(?:_[a-z0-9]+)*$/;

export function structureKeyFromTitle(title) {
  const key = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!structureKeyPattern.test(key)) throw new Error(`Structure needs an explicit name: ${title}`);
  return key;
}

export function structurePlacementId(assetId) {
  const prefix = 'molen.worldgen.structure.';
  const key = assetId?.startsWith(prefix) ? assetId.slice(prefix.length) : '';
  if (!structureKeyPattern.test(key)) throw new Error(`Invalid named structure asset: ${assetId}`);
  return key.replaceAll('_', '.');
}

export function validateStructureCandidateIds(candidates) {
  const ids = new Set();
  for (const candidate of candidates) {
    if (!structureKeyPattern.test(candidate.id) || ids.has(candidate.id))
      throw new Error(`Duplicate or invalid named structure identity: ${candidate.id}`);
    ids.add(candidate.id);
  }
}
