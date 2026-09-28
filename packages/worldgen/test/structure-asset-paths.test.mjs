import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  structureAssetDirectory,
  structureAssetPackRoot,
  structureAssetPathFromSource,
  structureAssetSidecarPath,
} from '../scripts/structure-asset-paths.mjs';
import {
  knownSourceEntries,
  proposedStructureSourcePath,
} from '../scripts/structure-source-paths.mjs';
import { inspectStructureAssetPaths } from '../scripts/validate-structure-asset-paths.mjs';

describe('geographic runtime structure asset paths', () => {
  it('mirrors every registered source and retains source keys that differ from asset ID suffixes', () => {
    for (const entry of knownSourceEntries().filter((entry) => entry.assetId)) {
      const expected = structureAssetPathFromSource(entry.sourcePath);
      expect(structureAssetSidecarPath(entry.assetId)).toBe(expected);
      expect(structureAssetDirectory(entry.assetId)).toBe(
        resolve(structureAssetPackRoot, expected, '..'),
      );
    }
    expect(
      structureAssetSidecarPath('molen.worldgen.structure.n0148_edificio_altino_arantes'),
    ).toBe('assets/places/6g/6gy/n0148_edificio_altino_arantes/asset.json');
    expect(structureAssetSidecarPath('molen.worldgen.structure.space_needle')).toBe(
      'assets/places/c2/c22/space-needle/asset.json',
    );
    expect(structureAssetSidecarPath('molen.worldgen.structure.map_smock_windmill')).toBe(
      'assets/reusable/map-structures/map_smock_windmill/asset.json',
    );
  });

  it('uses proposed source geography for forthcoming IDs, without changing the filesystem', () => {
    for (const key of [
      'n0031_asset_path_test',
      'n9999_unknown_asset_path_test',
      'n0208_collection_parent_test',
    ])
      expect(structureAssetSidecarPath(`molen.worldgen.structure.${key}`)).toBe(
        structureAssetPathFromSource(proposedStructureSourcePath(key)),
      );
  });

  it('rejects traversal, absolute paths, nonstructure IDs and mismatched geohash prefixes', () => {
    for (const id of [
      null,
      '',
      'molen.worldgen.prop.canale',
      'molen.worldgen.structure.',
      'molen.worldgen.structure../outside',
      'molen.worldgen.structure.a/b',
      'molen.worldgen.structure.a\\b',
      'molen.worldgen.structure.C:\\outside',
    ])
      expect(() => structureAssetSidecarPath(id)).toThrow();
    for (const sourcePath of [
      'content/worldgen/source/places/../outside',
      'content/worldgen/source/places/c2/u09/wrong',
      'content/worldgen/source/map-structures/../../outside',
      'C:\\outside',
      'content/worldgen/source/reusable/unknown/a',
    ])
      expect(() => structureAssetPathFromSource(sourcePath)).toThrow();
  });

  it('requires matching source/project/style/runtime registrations and rejects old duplicate bundles', () => {
    const id = 'molen.worldgen.structure.test';
    const entry = {
      assetId: id,
      hasModel: true,
      sourcePath: 'content/worldgen/source/places/c2/c23/test',
    };
    const expected = 'assets/places/c2/c23/test/asset.json';
    const map = { [id]: expected };
    const bundle = { id, path: expected };
    expect(inspectStructureAssetPaths([entry], map, map, [bundle])).toEqual([]);
    const issues = inspectStructureAssetPaths([entry], { [id]: 'assets/old/asset.json' }, map, [
      bundle,
      { id, path: 'assets/molen/worldgen/structure/test/asset.json' },
    ]);
    expect(issues.some((issue) => issue.includes('project path'))).toBe(true);
    expect(issues.some((issue) => issue.includes('canonical folder'))).toBe(true);
    expect(issues.some((issue) => issue.includes('found 2'))).toBe(true);
    expect(
      inspectStructureAssetPaths([entry], map, map, []).some((issue) => issue.includes('found 0')),
    ).toBe(true);
    expect(
      inspectStructureAssetPaths([], map, map, [bundle]).filter((issue) =>
        issue.includes('no authored source'),
      ),
    ).toHaveLength(3);
  });
});
