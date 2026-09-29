import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { encodeStructureGeohash } from '../../worldgen-earth/dist/kernel.mjs';
import {
  encodeSourceGeohash,
  knownSourceEntries,
  proposedStructureSourcePath,
  sourcePathWithin,
  sourceRepositoryRoot,
  structureSourceDirectory,
  structureSourcePath,
  structureSourceRoot,
} from '../scripts/structure-source-paths.mjs';

const catalog = JSON.parse(
  readFileSync(resolve(structureSourceRoot, 'next-1000/candidates.json'), 'utf8'),
);
const collections = JSON.parse(
  readFileSync(resolve(structureSourceRoot, 'next-1000/collections.json'), 'utf8'),
).collections;

describe('geographic structure source addressing', () => {
  it('pins every registered bundle to its indexed path and preserves exact source keys', () => {
    const entries = knownSourceEntries();
    expect(entries.length).toBeGreaterThan(100);
    expect(Object.isFrozen(entries)).toBe(true);
    for (const entry of entries) {
      expect(structureSourceDirectory(entry.key)).toBe(
        resolve(sourceRepositoryRoot, entry.sourcePath),
      );
      expect(structureSourcePath(entry.key, 'models', 'source.glb')).toBe(
        resolve(sourceRepositoryRoot, entry.sourcePath, 'models/source.glb'),
      );
      expect(Object.isFrozen(entry)).toBe(true);
      if (entry.anchor) expect(Object.isFrozen(entry.anchor)).toBe(true);
    }
    expect(entries.some((entry) => entry.key === 'space-needle')).toBe(true);
  });

  it('keeps reusable initial-catalog categories outside geographic cells', () => {
    const entries = knownSourceEntries();
    for (const family of ['urban', 'infrastructure']) {
      const members = entries.filter((entry) =>
        entry.sourcePath.startsWith(`content/worldgen/source/reusable/${family}/`),
      );
      expect(members.length).toBeGreaterThan(0);
      for (const member of members)
        expect(structureSourceDirectory(member.key)).toBe(
          resolve(structureSourceRoot, 'reusable', family, member.key),
        );
    }
  });

  it('matches the built Earth kernel at cell boundaries, world edges and ordinary places', () => {
    for (const [longitude, latitude] of [
      [-122.3493, 47.6205],
      [139.767, 35.681],
      [18.4241, -33.9249],
      [0, 0],
      [-180, -90],
      [-180, 90],
      [180, -90],
      [180, 90],
      [-1.40625, -1.40625],
      [1.40625, 1.40625],
      [-0.000001, 0.000001],
    ])
      for (const length of [1, 2, 3, 6, 12])
        expect(encodeSourceGeohash(longitude, latitude, length)).toBe(
          encodeStructureGeohash(longitude, latitude, length),
        );
    for (const args of [
      [NaN, 0, 3],
      [0, Infinity, 3],
      [181, 0, 3],
      [0, -91, 3],
      [0, 0, 0],
      [0, 0, 13],
      [0, 0, 2.5],
    ])
      expect(() => encodeSourceGeohash(...args)).toThrow('invalid geohash');
  });

  it('proposes an unregistered candidate folder from its reference coordinate without creating it', () => {
    const entries = knownSourceEntries();
    const candidate = catalog.candidates.find(
      (entry) =>
        entry.referenceCoordinate &&
        !collections.some((collection) => collection.id === entry.id) &&
        !entries.some((source) => source.key.startsWith(`${entry.id.toLowerCase()}_`)),
    );
    expect(candidate).toBeDefined();
    const key = `${candidate.id.toLowerCase()}_source_address_test`;
    const coordinate = candidate.referenceCoordinate;
    const hash = encodeStructureGeohash(coordinate.longitude, coordinate.latitude);
    const expected = `content/worldgen/source/places/${hash.slice(0, 2)}/${hash}/${key}`;
    expect(proposedStructureSourcePath(key)).toBe(expected);
    expect(structureSourceDirectory(key)).toBe(resolve(sourceRepositoryRoot, expected));
    expect(existsSync(structureSourceDirectory(key))).toBe(false);
  });

  it('leaves unknown identities and composite collection parents unlocated', () => {
    const key = 'n9999_unlocated_source_address_test';
    expect(structureSourceDirectory(key)).toBe(
      resolve(structureSourceRoot, 'places/unlocated', key),
    );
    expect(existsSync(structureSourceDirectory(key))).toBe(false);
    const parent = `${collections[0].id.toLowerCase()}_composite_source_address_test`;
    expect(proposedStructureSourcePath(parent)).toBe(
      `content/worldgen/source/places/unlocated/${parent}`,
    );
  });

  it('rejects unsafe keys and file paths before accessing another bundle', () => {
    for (const key of ['', '../outside', 'a/b', 'a\\b', '/outside', 'C:\\outside', 'a\0b', null])
      expect(() => structureSourceDirectory(key)).toThrow();
    const directory = resolve(structureSourceRoot, 'places/unlocated/path_test');
    for (const segments of [
      ['..', 'outside'],
      ['models/../../outside'],
      ['models\\..\\..\\outside'],
      ['/outside'],
      ['C:\\outside'],
      ['a\0b'],
      [null],
    ])
      expect(() => sourcePathWithin(directory, ...segments)).toThrow();
    expect(sourcePathWithin(directory, 'models/source.glb')).toBe(
      resolve(directory, 'models/source.glb'),
    );
  });
});
