import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  authoredMapMatchRadius,
  collectionModelRefs,
  distinctMappedCollectionPlacement,
  selectedStructureIds,
  structureImportArgs,
  validateCollectionSpec,
  validateStructureCollections,
} from '../scripts/structure-collections.mjs';

const document = JSON.parse(
  await readFile(
    new URL('../../../content/worldgen/source/next-1000/collections.json', import.meta.url),
  ),
);
const catalog = JSON.parse(
  await readFile(
    new URL('../../../content/worldgen/source/next-1000/candidates.json', import.meta.url),
  ),
);
const collections = validateStructureCollections(document, catalog.candidates);
const collection = collections.find((entry) => entry.id === 'N0208');

describe('independent landmark collections', () => {
  it('keeps node-mapped memorials independent from campus building members', () => {
    const site = collections.find((entry) => entry.id === 'N0748');
    expect(site.requiredCount).toBe(10);
    const memorial = site.members.find((member) => member.id === 'N0748_CHILDREN');
    expect(memorial.featureId).toBe('node/13197000158');
    expect(memorial.assetId).not.toBe(site.members[0].assetId);
    const spec = { ...memorial, collectionId: site.id, mapFeatureId: memorial.featureId };
    expect(validateCollectionSpec(spec, collections)).toEqual(memorial);
    for (const invalid of ['node/0', 'node/-1', 'node/../1', 'point/13197000158']) {
      const changed = structuredClone(document);
      const c = changed.collections.find((entry) => entry.id === 'N0748');
      c.members.find((member) => member.id === memorial.id).featureId = invalid;
      c.membershipEvidence.featureIds = c.members.map((member) => member.featureId);
      expect(() => validateStructureCollections(changed, catalog.candidates)).toThrow();
    }
  });
  it('keeps serialized imports bounded while accepting member IDs and check mode', () => {
    expect(structureImportArgs(['--check', '--ids=N0207,N0208_MSU'])).toEqual([
      '--ids=N0207,N0208_MSU',
      '--check',
    ]);
    expect(structureImportArgs(['--ids=N0207'])).toEqual(['--ids=N0207']);
    for (const args of [
      [],
      ['--ids=../N0207'],
      ['--ids=N0207', '--force'],
      ['--ids=N0207', '--ids=N0208'],
      ['--ids=N0207', '--check', '--check'],
    ])
      expect(() => structureImportArgs(args)).toThrow('Usage');
  });
  it('expands a collection into its complete distinct member set and deduplicates explicit selection', () => {
    expect(collection.members).toHaveLength(7);
    expect(selectedStructureIds(['N0208', collection.members[0].id, 'N0207'], collections)).toEqual(
      [...collection.members.map((member) => member.id), 'N0207'],
    );
    expect(selectedStructureIds(undefined, collections)).toBeUndefined();
    expect(collection.members.some((member) => member.wikidataId === 'Q2387534')).toBe(true);
    expect(collection.members.some((member) => member.wikidataId === 'Q13164')).toBe(false);
  });

  it('rejects omitted, repeated, nested or mismatched identities and unsafe source paths', () => {
    for (const mutate of [
      (entry) => {
        entry.members.pop();
      },
      (entry) => {
        entry.members[1] = entry.members[0];
      },
      (entry) => {
        entry.members[0].wikidataId = entry.wikidataId;
      },
      (entry) => {
        entry.members[0].sourceKey = '../outside';
      },
      (entry) => {
        entry.members[0].id = entry.id;
      },
    ]) {
      const changed = structuredClone(document);
      mutate(changed.collections[0]);
      expect(() => validateStructureCollections(changed, catalog.candidates)).toThrow();
    }
  });

  it('requires reuse when a building identity already has a catalog asset', () => {
    const member = collection.members[0];
    const existing = {
      id: 'N0999',
      wikidataId: member.wikidataId,
      modelRef: 'molen.worldgen.structure.existing',
    };
    expect(() => validateStructureCollections(document, [...catalog.candidates, existing])).toThrow(
      'reuse existing identity',
    );
    const reused = structuredClone(document);
    Object.assign(reused.collections[0].members[0], {
      id: existing.id,
      assetId: existing.modelRef,
      sourceKey: 'existing',
    });
    expect(validateStructureCollections(reused, [...catalog.candidates, existing])).toHaveLength(
      document.collections.length,
    );
  });

  it('cannot import a composite or unknown member, and only lists actually registered member assets', () => {
    const member = collection.members[0];
    expect(validateCollectionSpec({ ...member, collectionId: 'N0208' }, collections)).toEqual(
      member,
    );
    expect(() => validateCollectionSpec({ id: 'N0208' }, collections)).toThrow('composite');
    expect(() => validateCollectionSpec({ ...member, wikidataId: 'Q42' }, collections)).toThrow(
      'identity',
    );
    expect(() => validateCollectionSpec({ id: 'N0208_UNKNOWN' }, collections)).toThrow(
      'undeclared',
    );
    expect(collectionModelRefs(collection, {})).toEqual([]);
    expect(collectionModelRefs(collection, { [member.assetId]: 'asset.json' })).toEqual([
      { id: member.id, wikidataId: member.wikidataId, asset: member.assetId },
    ]);
  });

  it('uses distinct attributed map members when a site has no separate member QIDs', () => {
    const site = collections.find((entry) => entry.id === 'N0633');
    expect(site.identityKind).toBe('osm-members');
    expect(selectedStructureIds(['N0633'], collections)).toEqual(['N0633_EAST', 'N0633_WEST']);
    expect(new Set(site.members.map((entry) => entry.featureId)).size).toBe(2);
    for (const member of site.members) {
      const spec = { ...member, mapFeatureId: member.featureId, collectionId: site.id };
      expect(validateCollectionSpec(spec, collections)).toEqual(member);
      expect(() => validateCollectionSpec({ ...spec, mapFeatureId: 'way/1' }, collections)).toThrow(
        'identity',
      );
    }
    for (const mutate of [
      (entry) => {
        entry.members[1].featureId = entry.members[0].featureId;
      },
      (entry) => {
        delete entry.members[0].featureId;
      },
      (entry) => {
        entry.members[0].wikidataId = 'Q42';
      },
      (entry) => {
        entry.membershipEvidence.featureIds.pop();
      },
    ]) {
      const changed = structuredClone(document);
      mutate(changed.collections.find((entry) => entry.id === site.id));
      expect(() => validateStructureCollections(changed, catalog.candidates)).toThrow();
    }
  });

  it('never permits overlapping site-QID matching radii, repeated members or moved anchors', () => {
    const site = collections.find((entry) => entry.id === 'N0633');
    const [east, west] = site.members;
    const anchor = (member) => [
      member.referenceCoordinate.longitude,
      member.referenceCoordinate.latitude,
    ];
    const spec = { ...east, mapFeatureId: east.featureId, collectionId: site.id };
    const proposal = { anchor: anchor(east) };
    const existing = {
      asset: west.assetId,
      anchor: anchor(west),
      mapIdentity: { wikidata: site.wikidataId, maxDistance: 80 },
    };
    expect(distinctMappedCollectionPlacement(spec, proposal, existing, collections)).toBe(true);
    expect(
      distinctMappedCollectionPlacement(
        spec,
        proposal,
        { ...existing, asset: east.assetId },
        collections,
      ),
    ).toBe(false);
    expect(
      distinctMappedCollectionPlacement(
        spec,
        proposal,
        { ...existing, anchor: proposal.anchor },
        collections,
      ),
    ).toBe(false);
    expect(
      distinctMappedCollectionPlacement(
        spec,
        proposal,
        { ...existing, mapIdentity: { ...existing.mapIdentity, maxDistance: 300 } },
        collections,
      ),
    ).toBe(false);
    expect(
      distinctMappedCollectionPlacement(spec, { anchor: anchor(west) }, existing, collections),
    ).toBe(false);
    expect(
      distinctMappedCollectionPlacement(
        { ...spec, collectionId: 'N0208' },
        proposal,
        existing,
        collections,
      ),
    ).toBe(false);
  });

  it('retains a mapped member own identity only with an explicit identity source', () => {
    const changed = structuredClone(document);
    const member = changed.collections.find((entry) => entry.id === 'N0633').members[0];
    member.wikidataId = 'Q42';
    expect(() => validateStructureCollections(changed, catalog.candidates)).toThrow();
    member.identitySource = 'https://www.wikidata.org/wiki/Q42';
    expect(() => validateStructureCollections(changed, catalog.candidates)).not.toThrow();
  });

  it('permits dense mapped members only when explicit identity radii remain disjoint', () => {
    const site = structuredClone(collections.find((entry) => entry.id === 'N0633'));
    site.members[1].referenceCoordinate = {
      longitude: site.members[0].referenceCoordinate.longitude + 0.0003,
      latitude: site.members[0].referenceCoordinate.latitude,
    };
    const [a, b] = site.members;
    const anchor = (member) => [
      member.referenceCoordinate.longitude,
      member.referenceCoordinate.latitude,
    ];
    const spec = { ...a, mapFeatureId: a.featureId, collectionId: site.id };
    const proposal = { anchor: anchor(a), mapIdentity: { maxDistance: 8 } };
    const existing = {
      asset: b.assetId,
      anchor: anchor(b),
      mapIdentity: { wikidata: site.wikidataId, maxDistance: 8 },
    };
    expect(distinctMappedCollectionPlacement(spec, proposal, existing, [site])).toBe(true);
    expect(
      distinctMappedCollectionPlacement(
        spec,
        { ...proposal, mapIdentity: { maxDistance: 24 } },
        existing,
        [site],
      ),
    ).toBe(false);
    expect(
      distinctMappedCollectionPlacement(
        { ...spec, mapFeatureId: b.featureId },
        proposal,
        existing,
        [site],
      ),
    ).toBe(false);
    expect(authoredMapMatchRadius({})).toBe(80);
    for (const radius of [0, -1, 81, NaN, Infinity, '8', null])
      expect(() => authoredMapMatchRadius({ mapIdentity: { maxDistance: radius } })).toThrow();
    expect(
      distinctMappedCollectionPlacement(
        spec,
        proposal,
        { ...existing, mapIdentity: { ...existing.mapIdentity, maxDistance: -1 } },
        [site],
      ),
    ).toBe(false);
  });

  it('keeps the declared dense Topkapi shared-site member radii disjoint', () => {
    const site = collections.find((entry) => entry.id === 'N0742');
    const members = site.members.filter((m) => m.wikidataId === site.wikidataId);
    const anchor = (m) => [m.referenceCoordinate.longitude, m.referenceCoordinate.latitude];
    for (const a of members)
      for (const b of members.filter((m) => m.id !== a.id)) {
        const spec = { ...a, mapFeatureId: a.featureId, collectionId: site.id };
        const proposal = {
          anchor: anchor(a),
          mapIdentity: { maxDistance: a.mapMatchRadiusMeters },
        };
        const existing = {
          asset: b.assetId,
          anchor: anchor(b),
          mapIdentity: { wikidata: site.wikidataId, maxDistance: b.mapMatchRadiusMeters },
        };
        expect(distinctMappedCollectionPlacement(spec, proposal, existing, collections)).toBe(true);
      }
  });
});
