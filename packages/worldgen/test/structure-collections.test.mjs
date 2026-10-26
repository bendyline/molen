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
    new URL('../../../content/worldgen/source/structure-catalog/collections.json', import.meta.url),
  ),
);
const catalog = JSON.parse(
  await readFile(
    new URL('../../../content/worldgen/source/structure-catalog/candidates.json', import.meta.url),
  ),
);
const collections = validateStructureCollections(document, catalog.candidates);
const collection = collections.find((entry) => entry.id === 'seven_sisters');

describe('independent landmark collections', () => {
  it('reuses the same mapped asset across site and OSM collection identity modes', () => {
    const changed = structuredClone(document);
    const original = changed.collections.find((entry) => entry.id === 'towers_of_silence_in_yazd');
    const reused = structuredClone(original);
    reused.id = 'shared_landmark_pair';
    reused.wikidataId = 'Q42';
    reused.identityKind = 'site-members';
    reused.membershipEvidence.memberIds = reused.members.map((member) => member.id);
    for (const member of reused.members)
      member.identitySource = `https://www.wikidata.org/wiki/${member.wikidataId}`;
    changed.collections.push(reused);
    expect(validateStructureCollections(changed)).toHaveLength(document.collections.length + 1);
    reused.members[0].assetId = 'molen.worldgen.structure.copied_tower';
    reused.members[0].sourceKey = 'copied_tower';
    expect(() => validateStructureCollections(changed)).toThrow('conflicting collection identity');
  });
  it('allows an attributed unmapped site member without inventing an OSM feature', () => {
    const changed = structuredClone(document);
    const site = changed.collections.find((entry) => entry.id === 'towers_of_silence_in_yazd');
    site.identityKind = 'site-members';
    const manual = {
      id: 'unmapped_service_building',
      sourceKey: 'unmapped_service_building',
      title: 'Unmapped service building',
      wikidataId: site.wikidataId,
      assetId: 'molen.worldgen.structure.unmapped_service_building',
      referenceCoordinate: { longitude: 54.4, latitude: 31.9 },
      positionReference: {
        source: 'https://example.org/site-photo',
        basis:
          'Approximate roof center from an ordinary aerial photo; no native footprint ownership.',
      },
    };
    site.members.push(manual);
    site.requiredCount = site.members.length;
    site.membershipEvidence.memberIds = site.members.map((member) => member.id);
    const accepted = validateStructureCollections(changed, catalog.candidates);
    expect(validateCollectionSpec({ ...manual, collectionId: site.id }, accepted)).toEqual(manual);
    expect(collectionModelRefs(site, { [manual.assetId]: 'asset.json' })).toEqual([
      { id: manual.id, wikidataId: manual.wikidataId, asset: manual.assetId },
    ]);
    const anchor = [manual.referenceCoordinate.longitude, manual.referenceCoordinate.latitude];
    const other = site.members[0];
    expect(
      distinctMappedCollectionPlacement(
        { ...manual, collectionId: site.id },
        { anchor, mapIdentity: { maxDistance: 8 } },
        {
          asset: other.assetId,
          anchor: [other.referenceCoordinate.longitude, other.referenceCoordinate.latitude],
          mapIdentity: { wikidata: site.wikidataId, maxDistance: 8 },
        },
        accepted,
      ),
    ).toBe(true);
    for (const mutate of [
      (c) => {
        delete c.members.at(-1).positionReference;
      },
      (c) => {
        c.members.at(-1).positionReference.basis = ' ';
      },
      (c) => {
        c.members.at(-1).featureId = 'photo/1';
      },
      (c) => {
        c.membershipEvidence.memberIds.pop();
      },
      (c) => {
        c.members[1].featureId = c.members[0].featureId;
      },
    ]) {
      const invalid = structuredClone(changed);
      mutate(invalid.collections.find((c) => c.id === site.id));
      expect(() => validateStructureCollections(invalid, catalog.candidates)).toThrow();
    }
  });
  it('keeps node-mapped memorials independent from campus building members', () => {
    const site = collections.find((entry) => entry.id === 'yad_vashem');
    expect(site.requiredCount).toBe(10);
    const memorial = site.members.find((member) => member.id === 'childrens_memorial_yad_vashem');
    expect(memorial.featureId).toBe('node/13197000158');
    expect(memorial.assetId).not.toBe(site.members[0].assetId);
    const spec = { ...memorial, collectionId: site.id, mapFeatureId: memorial.featureId };
    expect(validateCollectionSpec(spec, collections)).toEqual(memorial);
    for (const invalid of ['node/0', 'node/-1', 'node/../1', 'point/13197000158']) {
      const changed = structuredClone(document);
      const c = changed.collections.find((entry) => entry.id === 'yad_vashem');
      c.members.find((member) => member.id === memorial.id).featureId = invalid;
      c.membershipEvidence.featureIds = c.members.map((member) => member.featureId);
      expect(() => validateStructureCollections(changed, catalog.candidates)).toThrow();
    }
  });
  it('keeps serialized imports bounded while accepting member IDs and check mode', () => {
    expect(
      structureImportArgs(['--check', '--ids=bank_of_america_plaza,msu_main_building']),
    ).toEqual(['--ids=bank_of_america_plaza,msu_main_building', '--check']);
    expect(structureImportArgs(['--ids=bank_of_america_plaza'])).toEqual([
      '--ids=bank_of_america_plaza',
    ]);
    for (const args of [
      [],
      ['--ids=../bank_of_america_plaza'],
      ['--ids=bank_of_america_plaza', '--force'],
      ['--ids=bank_of_america_plaza', '--ids=seven_sisters'],
      ['--ids=bank_of_america_plaza', '--check', '--check'],
    ])
      expect(() => structureImportArgs(args)).toThrow('Usage');
  });
  it('expands a collection into its complete distinct member set and deduplicates explicit selection', () => {
    expect(collection.members).toHaveLength(7);
    expect(
      selectedStructureIds(
        ['seven_sisters', collection.members[0].id, 'bank_of_america_plaza'],
        collections,
      ),
    ).toEqual([...collection.members.map((member) => member.id), 'bank_of_america_plaza']);
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
      id: 'existing_registered_building',
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
    expect(
      validateCollectionSpec({ ...member, collectionId: 'seven_sisters' }, collections),
    ).toEqual(member);
    expect(() => validateCollectionSpec({ id: 'seven_sisters' }, collections)).toThrow('composite');
    expect(() => validateCollectionSpec({ ...member, wikidataId: 'Q42' }, collections)).toThrow(
      'identity',
    );
    expect(() =>
      validateCollectionSpec({ id: 'unknown_building', collectionId: collection.id }, collections),
    ).toThrow('undeclared');
    expect(collectionModelRefs(collection, {})).toEqual([]);
    expect(collectionModelRefs(collection, { [member.assetId]: 'asset.json' })).toEqual([
      { id: member.id, wikidataId: member.wikidataId, asset: member.assetId },
    ]);
  });

  it('uses distinct attributed map members when a site has no separate member QIDs', () => {
    const site = collections.find((entry) => entry.id === 'towers_of_silence_in_yazd');
    expect(site.identityKind).toBe('osm-members');
    expect(selectedStructureIds(['towers_of_silence_in_yazd'], collections)).toEqual([
      'east_maneckji_tower_of_silence',
      'west_golestan_tower_of_silence',
    ]);
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
    const site = collections.find((entry) => entry.id === 'towers_of_silence_in_yazd');
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
        { ...spec, collectionId: 'seven_sisters' },
        proposal,
        existing,
        collections,
      ),
    ).toBe(false);
  });

  it('retains a mapped member own identity only with an explicit identity source', () => {
    const changed = structuredClone(document);
    const member = changed.collections.find((entry) => entry.id === 'towers_of_silence_in_yazd')
      .members[0];
    member.wikidataId = 'Q42';
    expect(() => validateStructureCollections(changed, catalog.candidates)).toThrow();
    member.identitySource = 'https://www.wikidata.org/wiki/Q42';
    expect(() => validateStructureCollections(changed, catalog.candidates)).not.toThrow();
  });

  it('permits dense mapped members only when explicit identity radii remain disjoint', () => {
    const site = structuredClone(
      collections.find((entry) => entry.id === 'towers_of_silence_in_yazd'),
    );
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
    const site = collections.find((entry) => entry.id === 'topkap_palace');
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
