import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createStructureIndex,
  encodeStructureGeohash,
  type StructureCatalogDoc,
  suggestStructureStyles,
} from '../src/kernel/structure-index';
import { loadDefaultAtlas } from './helpers/pack';

const catalog = JSON.parse(
  await readFile(
    resolve(import.meta.dirname, '../../../content/earth/structures/placements.json'),
    'utf8',
  ),
) as StructureCatalogDoc;
const atlas = await loadDefaultAtlas();

describe('geographic structures', () => {
  it('finds identity candidates across tile and antimeridian boundaries without moving fixed placements', () => {
    const entry = {
      id: 'nearby',
      title: 'Nearby',
      asset: 'sample.model',
      anchor: [179.9995, 0] as [number, number],
      status: 'preview' as const,
      source: 'https://example.com',
      orientation: 'mapped' as const,
      mapIdentity: { wikidata: 'Q42', maxDistance: 200 },
    };
    const index = createStructureIndex({
      format: 'molen/structure-placements@1',
      title: 'Nearby',
      entries: [entry],
    });
    expect(index.query([-180, -0.001, -179.9995, 0.001]).map((item) => item.id)).toEqual([
      'nearby',
    ]);
    expect(index.query([179.9996, -0.001, 180, 0.001]).map((item) => item.id)).toEqual(['nearby']);
    expect(index.query([179.99, -0.001, 179.995, 0.001])).toEqual([]);
    const fixed = createStructureIndex({
      format: 'molen/structure-placements@1',
      title: 'Fixed',
      entries: [{ ...entry, orientation: 'fixed' }],
    });
    expect(fixed.query([-180, -0.001, -179.9995, 0.001])).toEqual([]);
  });
  it('indexes placed Seattle assets, keeping unsurveyed drafts hidden', () => {
    const index = createStructureIndex(catalog);
    // The Needle is just west of the c22/c23 seam; nearby downtown is in c23.
    expect(encodeStructureGeohash(-122.3493, 47.62051)).toBe('c22');
    expect(encodeStructureGeohash(-122.33207, 47.60621)).toBe('c23');
    expect(index.query([-122.36, 47.615, -122.34, 47.625]).map((item) => item.id)).toContain(
      'seattle.space-needle',
    );
    expect(index.query([-122.28, 47.63, -122.24, 47.65]).map((item) => item.id)).toEqual([
      'seattle.sr-520-floating-bridge',
    ]);
    expect(index.query([-122.28, 47.63, -122.24, 47.65], true).map((item) => item.id)).toContain(
      'seattle.sr-520-floating-bridge',
    );
    expect(index.query([-123, 37, -122, 38])).toEqual([]);
    expect(
      index.entries.filter((item) => item.status === 'preview' && item.id.startsWith('seattle.')),
    ).toHaveLength(13);
    expect(new Set(index.entries.map((item) => item.id)).size).toBe(index.entries.length);
    expect(index.entries.every((item) => item.asset && item.anchor.every(Number.isFinite))).toBe(
      true,
    );
    // The west end is visible while the anchor is outside this query.
    expect(index.query([-122.275, 47.642, -122.272, 47.644]).map((item) => item.id)).toContain(
      'seattle.sr-520-floating-bridge',
    );
  });

  it('returns the actual regional style weights for unmeasured homes', () => {
    const metrics = {
      labels: ['house'],
      context: 'residential',
      areaM2: 110,
      perimeterM: 42,
      vertexCount: 4,
      hasHoles: false,
      elongation: 1.5,
      rectangularity: 1,
    };
    const pnw = suggestStructureStyles(atlas, -122.3, 47.6, metrics);
    expect(pnw?.regionId).toBe('us.pnw');
    expect(pnw?.variants.map((item) => item.weight)).toEqual([4, 1, 1, 1]);
    expect(pnw?.variants.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1);
    const japan = suggestStructureStyles(atlas, 139.7, 35.7, metrics);
    expect(japan?.regionId).toBe('jp');
    expect(japan?.variants.some((item) => item.style.includes('japan'))).toBe(true);
  });

  it('finds placements on both sides of the antimeridian', () => {
    const index = createStructureIndex({
      format: 'molen/structure-placements@1',
      title: 'Antimeridian',
      entries: [
        {
          id: 'east',
          title: 'East',
          asset: 'test.east',
          anchor: [179.9, 0],
          status: 'preview',
          source: 'https://example.com/east',
        },
        {
          id: 'west',
          title: 'West',
          asset: 'test.west',
          anchor: [-179.9, 0],
          status: 'preview',
          source: 'https://example.com/west',
        },
      ],
    });
    expect(
      index
        .query([179.5, -1, -179.5, 1])
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(['east', 'west']);
  });
});
