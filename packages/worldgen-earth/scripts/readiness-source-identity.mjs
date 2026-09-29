/** Candidate identity selects an authored bundle; a title-derived slug is only a missing-source fallback. */
export function readinessSourceIdentity(candidate, geographic, sourceEntries) {
  const matches = sourceEntries.filter((entry) => entry.candidateId === candidate.id);
  if (matches.length > 1)
    throw new Error(`${candidate.id}: multiple source bundles declare this candidate identity`);
  const entry = matches[0];
  const asset = entry?.assetId ?? candidate.assetId ?? geographic.asset;
  if (typeof asset !== 'string' || !asset.startsWith('molen.worldgen.structure.'))
    throw new Error(`${candidate.id}: missing structure asset identity`);
  return {
    asset,
    key: entry?.key ?? asset.split('.').at(-1),
    sourcePath: entry?.sourcePath,
  };
}
