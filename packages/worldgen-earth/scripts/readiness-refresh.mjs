/** Explicitly scoped authoring refreshes retain the last checked records for other models. */
export function readinessRefresh(candidates, previous, ids, collectionManifest) {
  const selected = new Set(ids.map((id) => id.trim().toLowerCase()));
  const catalog = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  if (!selected.size || selected.has('')) throw new Error('Readiness --ids must not be empty.');
  for (const id of selected)
    if (!catalog.has(id)) throw new Error(`Unknown readiness candidate ${id}.`);
  if (previous?.format !== 'molen/structure-readiness@1' || !Array.isArray(previous.candidates))
    throw new Error('Selected readiness refresh requires an existing full readiness ledger.');
  const records = new Map(previous.candidates.map((record) => [record.candidateId, record]));
  if (records.size !== previous.candidates.length || records.size !== candidates.length)
    throw new Error('Readiness catalog membership changed; run a full readiness refresh.');
  for (const candidate of candidates) {
    const record = records.get(candidate.id);
    if (!record || record.wikidataId !== candidate.wikidataId || record.title !== candidate.title)
      throw new Error(`Readiness identity changed for ${candidate.id}; run a full refresh.`);
    if (collectionManifest) {
      const isCollection = collectionManifest.collections.some(
        (collection) => collection.id === candidate.id,
      );
      if (
        Boolean(record.collection) !== isCollection ||
        (isCollection && record.collection.manifest?.hash !== collectionManifest.hash)
      )
        throw new Error('Readiness collection membership changed; run a full refresh.');
    }
  }
  return { selected, records };
}
