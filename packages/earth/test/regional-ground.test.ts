import { readFile } from 'node:fs/promises';
import { wgs84ToWorld } from '@bendyline/molen-terrain/kernel';
import {
  createRegionalEnvironment,
  type EcologyAtlasDoc,
  type RegionalCatalogDoc,
} from '@bendyline/molen-worldgen-earth/kernel';
import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { createRegionalGroundColor } from '../src/client/regional-ground';

const atlas = JSON.parse(
  await readFile(new URL('../../../content/ecology/ecoregions.json', import.meta.url), 'utf8'),
) as EcologyAtlasDoc;
const catalog = JSON.parse(
  await readFile(
    new URL('../../../content/ecology/regional.catalog.json', import.meta.url),
    'utf8',
  ),
) as RegionalCatalogDoc;
const environment = createRegionalEnvironment({ atlas, catalogs: [catalog] }, 1);

describe('regional bare terrain palette', () => {
  it('uses actual covered desert and forest palettes in linear RGB without depending on height', () => {
    const sample = createRegionalGroundColor(environment);
    const values = [];
    for (const [lon, lat] of [
      [-111.094, 32.224],
      [-122.01, 47.568],
    ]) {
      const [x, z] = wgs84ToWorld(1, lon ?? 0, lat ?? 0);
      const expected = new Color(environment.scatterAt(x, z)?.surface.default);
      const color = sample?.(x, 924, z, 0, [1, 1, 1]);
      expect(color).toEqual([expected.r, expected.g, expected.b]);
      expect(sample?.(x, 10, z, 0, [0, 0, 0])).toEqual(color);
      const slope = sample?.(x, 10, z, 2, [0, 0, 0]);
      expect(slope?.every(Number.isFinite)).toBe(true);
      expect(slope).not.toEqual(color);
      values.push(color);
    }
    expect(values[0]).not.toEqual(values[1]);
  });

  it('leaves uncovered ocean cells and hosts without ecology unchanged', () => {
    const [x, z] = wgs84ToWorld(1, -140, 0);
    expect(createRegionalGroundColor(environment)?.(x, 0, z, 0, [1, 1, 1])).toBeUndefined();
    expect(createRegionalGroundColor(undefined)).toBeUndefined();
    expect(
      createRegionalGroundColor(createRegionalEnvironment({ catalogs: [] }, 1)),
    ).toBeUndefined();
  });
});
