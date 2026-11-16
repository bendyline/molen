import { readFile } from 'node:fs/promises';
import type { Pack } from '@bendyline/molen-pack';
import type { TerrainPackageDescriptor } from '@bendyline/molen-terrain/kernel';
import { expect, it, vi } from 'vitest';
import { loadEarthContent } from '../src/client/content';
import { earthWaterMeshOptions, readEarthWaterFeatures } from '../src/client/water-features';

it('loads stock water settings for Protomaps without loading a style pack', async () => {
  const path = 'hydrology/water-features.json';
  const readJson = vi.fn(async (name: string) =>
    JSON.parse(await readFile(new URL(`../../../content/earth/${name}`, import.meta.url), 'utf8')),
  );
  const pack = {
    manifest: { id: 'molen.earth', version: '1.0.0', provides: { 'water-features': [path] } },
    readJson,
  } as unknown as Pack;
  const content = await loadEarthContent([pack], { stylePack: false });
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const style = earthWaterMeshOptions(content.waterFeatures, descriptor).waterFeatureStyle;
  expect(readJson).toHaveBeenCalledExactlyOnceWith(path);
  expect(style?.({ id: 115387003 })).toEqual({ elevation: 651.65 });
  expect(style?.({ id: '3421157252' })).toEqual({ elevation: 534.18 });
  expect(style?.({ id: 35184436313130 })).toEqual({ hideLines: true });
  expect(style?.({ id: 32898673 })).toEqual({ elevation: 14.29 });
  expect(style?.({ id: 12017080 })).toEqual({ elevation: 14.29 });
  expect(style?.({ id: 35184436309899 })).toBeUndefined();
  expect(
    earthWaterMeshOptions(content.waterFeatures, { ...descriptor, features: undefined }),
  ).toEqual({});
  expect((await loadEarthContent([], { stylePack: false })).waterFeatures).toBeUndefined();
});

it('rejects ambiguous or unusable entries', () => {
  const parse = (features: unknown[]) =>
    readEarthWaterFeatures({ format: 'molen/earth-water-features@1', features });
  expect(() => parse([{ id: 7, elevation: Infinity }])).toThrow(/invalid/i);
  expect(() =>
    parse([
      { id: 7, elevation: 10 },
      { id: 7, hideLines: true },
    ]),
  ).toThrow(/duplicate/i);
});
