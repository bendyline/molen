import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  collectionModelRefs,
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
    expect(validateStructureCollections(reused, [...catalog.candidates, existing])).toHaveLength(1);
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
});
