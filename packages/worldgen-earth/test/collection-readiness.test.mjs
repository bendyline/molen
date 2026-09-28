import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { collectionReadiness } from '../scripts/collection-readiness.mjs';
import { createStructureIndex } from '../src/kernel/structure-index';

const collection = JSON.parse(
  await readFile(
    new URL('../../../content/worldgen/source/next-1000/collections.json', import.meta.url),
  ),
).collections[0];
const complete = (member) => ({
  candidateId: member.id,
  wikidataId: member.wikidataId,
  asset: member.assetId,
  readiness: 'ready',
  blockers: [],
  sourceFacts: { heights: 1, widths: 0, lengths: 0 },
  model: {
    source: { present: true, matchesManifestAndImport: true },
    runtime: { present: true, matchesSidecar: true, triangles: 100 },
    assetRegistered: true,
  },
  geographic: {
    verified: true,
    activePlacement: `next1000.${member.id.toLowerCase()}`,
    mappedFeatureIds: [],
  },
  visualQa: {
    captureFiles: ['preview.png'],
    captureFilesExist: true,
    reviewedCaptureHashesMatch: true,
    hashBoundReviewPassed: true,
  },
  fidelityQa: { hashBoundReviewPassed: true },
  sharedSurfaceQa: {
    required: true,
    reviewedCaptureHashesMatch: true,
    hashBoundReviewPassed: true,
    captureFiles: ['shared.png'],
  },
});

describe('collection readiness and spatial routing', () => {
  it('requires all seven current member reviews, not a successful first import', () => {
    const records = collection.members.map(complete);
    expect(collectionReadiness(collection, records, {}).readiness).toBe('ready');
    const changed = structuredClone(records);
    changed[6].readiness = 'incomplete';
    changed[6].blockers = ['source-hash-unverified'];
    changed[6].model.source.matchesManifestAndImport = false;
    const aggregate = collectionReadiness(collection, changed, {});
    expect(aggregate.readiness).toBe('incomplete');
    expect(aggregate.collection.readyCount).toBe(6);
    expect(aggregate.model.source.matchesManifestAndImport).toBe(false);
    expect(aggregate.blockers).toEqual([`${changed[6].candidateId}:source-hash-unverified`]);
    expect(aggregate.asset).toBeNull();
    expect(aggregate.geographic.anchor).toBeNull();
  });
  it('rejects missing or duplicated member results rather than vacuously passing', () => {
    const records = collection.members.map(complete);
    expect(() => collectionReadiness(collection, records.slice(1), {})).toThrow('every distinct');
    expect(() => collectionReadiness(collection, [...records.slice(1), records[1]], {})).toThrow(
      'every distinct',
    );
  });
  it('does not count unmodeled members as passed shared-material reviews', () => {
    const records = collection.members.map(complete);
    for (const record of records) {
      record.readiness = 'incomplete';
      record.blockers = ['source-model-missing'];
      record.model.source.present = false;
      record.sharedSurfaceQa.required = false;
      record.sharedSurfaceQa.hashBoundReviewPassed = false;
    }
    expect(collectionReadiness(collection, records, {}).sharedSurfaceQa.hashBoundReviewPassed).toBe(
      false,
    );
  });
  it('queries only nearby independent assets and never pulls the other collection members', () => {
    const index = createStructureIndex({
      format: 'molen/structure-placements@1',
      title: 'Seven independent research-point fixtures',
      entries: collection.members.map((member) => ({
        id: member.id,
        title: member.title,
        asset: member.assetId,
        anchor: [member.referenceCoordinate.longitude, member.referenceCoordinate.latitude],
        status: 'preview',
        orientation: 'fixed',
        source: collection.membershipEvidence.source,
        mapIdentity: { wikidata: member.wikidataId },
      })),
    });
    for (const member of collection.members) {
      const { longitude: x, latitude: y } = member.referenceCoordinate;
      expect(
        index.query([x - 0.0002, y - 0.0002, x + 0.0002, y + 0.0002]).map((entry) => entry.asset),
      ).toEqual([member.assetId]);
    }
    expect(index.query([-122.4, 47.5, -122.2, 47.7])).toEqual([]);
  });
});
