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

/** Keep planning identities available to authoring while selecting the reviewed release roster. */
export function structureReleaseCandidates(catalog) {
  const candidates = new Map(catalog.candidates.map((candidate) => [candidate.id, candidate]));
  const identities = new Set(catalog.candidates.map((candidate) => candidate.wikidataId));
  const assets = new Set(
    catalog.candidates.flatMap((candidate) => [
      candidate.modelRef,
      ...(candidate.modelRefs ?? []).map((member) => member.asset),
    ]),
  );
  const replacements = new Map();
  for (const replacement of catalog.releaseReplacements ?? []) {
    const original = candidates.get(replacement.replaces);
    if (
      !original ||
      replacements.has(original.id) ||
      candidates.has(replacement.id) ||
      !/^Q[1-9]\d*$/.test(replacement.wikidataId) ||
      identities.has(replacement.wikidataId) ||
      assets.has(replacement.modelRef) ||
      replacement.modelRef !== `molen.worldgen.structure.${replacement.id}` ||
      original.category !== replacement.category ||
      !replacement.reason?.trim()
    )
      throw new Error(`Invalid structure release replacement ${replacement.id}`);
    replacements.set(original.id, replacement);
    identities.add(replacement.wikidataId);
    assets.add(replacement.modelRef);
  }
  const release = catalog.candidates.map(
    (candidate) => replacements.get(candidate.id) ?? candidate,
  );
  validateStructureCandidateIds(release);
  return release;
}
