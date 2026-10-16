/** Next-1,000 production belongs to the other device, independently of readiness. */
import { normalize } from './classify.mjs';

export function next1000Entries(candidates, collections) {
  return [
    ...candidates.candidates.map((c) => ({ ...c, assetId: c.modelRef })),
    ...collections.collections.flatMap((c) => c.members),
  ];
}

export function next1000Matches(structure, entries, modelIdentity) {
  const identities = new Set(
    [
      modelIdentity,
      ...(structure.existing ?? []).flatMap((m) => [m.candidateId, m.assetId, m.collectionId]),
    ].filter(Boolean),
  );
  return entries.filter((entry) => {
    if (identities.has(entry.id) || (entry.assetId && identities.has(entry.assetId))) return true;
    // Also catch an exact-name addition to the list since the last full story scan.
    if (normalize(entry.title) !== normalize(structure.name) || !structure.coordinate) return false;
    const [lon, lat] = structure.coordinate;
    const p = entry.referenceCoordinate;
    return (
      p &&
      Math.hypot((p.longitude - lon) * Math.cos((lat * Math.PI) / 180), p.latitude - lat) * 111.32 <
        3
    );
  });
}

export function workAssignment(structure, entries) {
  const matches = next1000Matches(structure, entries);
  return {
    owner: matches.length ? 'next-1000-other-device' : 'qualla-local',
    localAuthoringAllowed: matches.length === 0,
    next1000Ids: [...new Set(matches.map((m) => m.id))].sort(),
    ...(matches.length
      ? {
          reason:
            'User reserves all next-1,000 candidates and collection members for a separate device. Possible identity matches also stay out of local production until reconciled.',
        }
      : {}),
  };
}
