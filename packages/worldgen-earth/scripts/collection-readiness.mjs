/** Aggregate already verified independent records; membership never substitutes for model QA. */
export function collectionReadiness(collection, members, manifest) {
  if (
    members.length !== collection.requiredCount ||
    collection.members.some(
      (member) =>
        members.filter(
          (record) =>
            record.candidateId === member.id &&
            record.wikidataId === member.wikidataId &&
            record.asset === member.assetId,
        ).length !== 1,
    )
  )
    throw new Error(`${collection.id}: readiness needs every distinct required member`);
  const all = (select) => members.every(select);
  const flatten = (select) => members.flatMap(select);
  const count = (select) => members.filter(select).length;
  const blockers = flatten((record) =>
    record.blockers.map((blocker) => `${record.candidateId}:${blocker}`),
  );
  if (members.some((record) => record.readiness !== 'ready') && !blockers.length)
    blockers.push('collection-members-incomplete');
  return {
    candidateId: collection.id,
    wikidataId: collection.wikidataId,
    title: collection.title,
    asset: null,
    readiness: blockers.length ? 'incomplete' : 'ready',
    blockers,
    collection: {
      requiredCount: collection.requiredCount,
      readyCount: count((record) => record.readiness === 'ready'),
      sourceCount: count((record) => record.model.source.present),
      runtimeCount: count((record) => record.model.runtime.present),
      manifest,
      membershipEvidence: collection.membershipEvidence,
      members,
    },
    sourceFacts: {
      available: true,
      path: manifest.path,
      heights: members.reduce((sum, record) => sum + record.sourceFacts.heights, 0),
      widths: members.reduce((sum, record) => sum + record.sourceFacts.widths, 0),
      lengths: members.reduce((sum, record) => sum + record.sourceFacts.lengths, 0),
    },
    model: {
      quality: 'independent-members',
      source: {
        present: all((r) => r.model.source.present),
        path: null,
        hash: null,
        matchesManifestAndImport: all((r) => r.model.source.matchesManifestAndImport),
      },
      runtime: {
        present: all((r) => r.model.runtime.present),
        path: null,
        hash: null,
        matchesSidecar: all((r) => r.model.runtime.matchesSidecar),
        triangles: members.reduce((sum, r) => sum + (r.model.runtime.triangles ?? 0), 0) || null,
      },
      assetRegistered: all((r) => r.model.assetRegistered),
    },
    geographic: {
      disposition: 'collection',
      orientationEvidence: 'per-member',
      anchor: null,
      heading: null,
      mappedFeatureIds: flatten((r) => r.geographic.mappedFeatureIds),
      verified: all((r) => r.geographic.verified),
      activePlacement: null,
      activePlacements: flatten((r) =>
        r.geographic.activePlacement ? [r.geographic.activePlacement] : [],
      ),
      catalogPlacement: null,
      placementStatus: 'independent-members',
      placementHash: null,
    },
    visualQa: {
      captureFiles: flatten((r) => r.visualQa.captureFiles),
      captureFilesExist: all((r) => r.visualQa.captureFilesExist),
      reviewedCaptureHashesMatch: all((r) => r.visualQa.reviewedCaptureHashesMatch),
      hashBoundReviewPassed: all((r) => r.visualQa.hashBoundReviewPassed),
      note: 'Every member retains its own current source, runtime and inspected image hashes.',
    },
    fidelityQa: {
      target: 'maximum',
      hashBoundReviewPassed: all((r) => r.fidelityQa.hashBoundReviewPassed),
      declaredQuality: 'independent-members',
      notes: 'All required members must pass their own detailed exterior fidelity review.',
    },
    sharedSurfaceQa: {
      required: members.some((r) => r.sharedSurfaceQa.required),
      reviewedCaptureHashesMatch: all(
        (r) =>
          r.model.source.present &&
          (!r.sharedSurfaceQa.required || r.sharedSurfaceQa.reviewedCaptureHashesMatch),
      ),
      hashBoundReviewPassed: all(
        (r) =>
          r.model.source.present &&
          (!r.sharedSurfaceQa.required || r.sharedSurfaceQa.hashBoundReviewPassed),
      ),
      captureFiles: flatten((r) => r.sharedSurfaceQa.captureFiles),
    },
  };
}
