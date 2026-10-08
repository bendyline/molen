import { readFile } from 'node:fs/promises';
import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { createEcologyResolver, type EcologyAtlasDoc } from '../src/kernel/ecology-atlas';
import {
  ECOLOGY_ATLAS_EXAMPLE,
  registerEcologyAtlasSchema,
} from '../src/kernel/ecology-atlas-schema';
import { projectWgs84 } from '../src/kernel/projection';

registerEcologyAtlasSchema();

describe('compact ecological geography', () => {
  it('validates row coverage, metadata identities, and indices before allocation', () => {
    expect(validateByKind('ecology-atlas' as never, ECOLOGY_ATLAS_EXAMPLE).ok).toBe(true);
    for (const row of [[35, 0], [37, 0], [36, 2], [36], [0, 0, 36, 1]]) {
      const doc = structuredClone(ECOLOGY_ATLAS_EXAMPLE);
      doc.rows[0] = row;
      expect(validateByKind('ecology-atlas' as never, doc).ok, String(row)).toBe(false);
      expect(() => createEcologyResolver(doc)).toThrow();
    }
    const doc = structuredClone(ECOLOGY_ATLAS_EXAMPLE);
    doc.regions.push({ id: 1, name: 'Duplicate', biome: 4, realm: 'Test' });
    expect(() => createEcologyResolver(doc)).toThrow(/duplicate/);
    doc.cellDegrees = 0;
    expect(() => createEcologyResolver(doc)).toThrow(/dimensions/);
  });

  it('wraps longitude, handles poles, and preserves uncovered cells', () => {
    const resolver = createEcologyResolver(ECOLOGY_ATLAS_EXAMPLE);
    expect(resolver.at(0, 45)?.id).toBe(1);
    expect(resolver.at(0, 55)).toBeUndefined();
    expect(resolver.cellAt(180, 45)?.column).toBe(0);
    expect(resolver.cellAt(-180, 45)?.column).toBe(0);
    expect(resolver.cellAt(540, 45)?.column).toBe(0);
    expect(resolver.cellAt(0, -90)?.row).toBe(17);
    expect(resolver.cellAt(0, 90)?.row).toBe(0);
    const invalidCoordinates: Array<[number, number]> = [
      [NaN, 0],
      [0, Infinity],
      [0, 91],
    ];
    for (const [lon, lat] of invalidCoordinates) expect(resolver.cellAt(lon, lat)).toBeUndefined();
    expect(() => createEcologyResolver(ECOLOGY_ATLAS_EXAMPLE, 0)).toThrow();
  });

  it('agrees between geographic and projected lookup across rows and world scales', () => {
    const doc = structuredClone(ECOLOGY_ATLAS_EXAMPLE);
    doc.regions = Array.from({ length: 18 }, (_, id) => ({
      id,
      name: `Region ${id}`,
      biome: 1,
      realm: 'Test',
    }));
    doc.rows = doc.rows.map((_, row) => [18, row + 1, 18, 0]);
    for (const scale of [1, 0.67, 0.1]) {
      const resolver = createEcologyResolver(doc, scale);
      for (let lat = -84.75; lat < 85; lat += 0.5) {
        for (const lon of [-179.9, -50, -0.01, 0.01, 179.9]) {
          const [x, z] = projectWgs84(lon, lat);
          expect(resolver.resolve(x * scale, z * scale)).toEqual(resolver.at(lon, lat));
        }
      }
    }
  });

  it('ships real biome distinctions on every populated continent within a small download', async () => {
    const bytes = await readFile(
      new URL('../../../content/ecology/ecoregions.json', import.meta.url),
    );
    const doc = JSON.parse(bytes.toString()) as EcologyAtlasDoc;
    const validation = validateByKind('ecology-atlas' as never, doc);
    expect(validation.ok, validation.ok ? '' : validation.formatted).toBe(true);
    const resolver = createEcologyResolver(doc);
    expect(bytes.length).toBeLessThan(1_000_000);
    const sites: Array<[string, number, number, number]> = [
      ['Sonoran desert', -111.05, 32.25, 13],
      ['Amazon rainforest', -60.1, -3.1, 1],
      ['Sahara', 12, 24, 13],
      ['Congo rainforest', 22, -1, 1],
      ['Borneo rainforest', 116, 0, 1],
      ['Australian desert', 130, -24, 13],
      ['Siberian taiga', 100, 62, 6],
      ['Mediterranean', 15, 37.5, 12],
    ];
    for (const [name, lon, lat, biome] of sites)
      expect(resolver.at(lon, lat)?.biome, `${name}: ${resolver.at(lon, lat)?.name}`).toBe(biome);
    expect(resolver.at(-140, 0)).toBeUndefined();
    const west = projectWgs84(-111.3, 32.3),
      east = projectWgs84(-110.9, 32.0);
    const areas = resolver.areas([west[0], west[1], east[0], east[1]]);
    expect(areas?.length).toBeGreaterThan(0);
    for (const area of areas ?? []) {
      const x = (area.bounds[0] + area.bounds[2]) / 2,
        z = (area.bounds[1] + area.bounds[3]) / 2;
      expect(resolver.resolve(x, z)).toEqual(area.region);
    }
    expect(resolver.areas([west[0], west[1], east[0], east[1]], 1)).toBeUndefined();
  });
});
