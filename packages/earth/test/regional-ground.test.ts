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

  it('resolves each palette cell once while a grid is walked row by row', () => {
    const counting = Object.create(environment) as typeof environment;
    let lookups = 0;
    counting.scatterAt = (x, z) => {
      lookups++;
      return environment.scatterAt(x, z);
    };
    const sample = createRegionalGroundColor(counting);
    const fresh = createRegionalGroundColor(environment);
    const [x0, z0] = wgs84ToWorld(1, -111.094, 32.224);
    // A 65 x 65 vertex tile, 8 m apart: 520 m across, 17 x 17 cells of 32 m.
    for (let row = 0; row < 65; row++)
      for (let col = 0; col < 65; col++) {
        const x = x0 + col * 8,
          z = z0 + row * 8;
        expect(sample?.(x, 0, z, 0, [0, 0, 0])).toEqual(fresh?.(x, 0, z, 0, [0, 0, 0]));
      }
    expect(lookups).toBeLessThanOrEqual(18 * 18);
  });

  it('colors a whole tile in one call exactly as it colors each vertex', () => {
    const sample = createRegionalGroundColor(environment);
    const [x0, z0] = wgs84ToWorld(1, -111.094, 32.224);
    const n = 33;
    const positions = new Float32Array(n * n * 3);
    const normals = new Float32Array(n * n * 3);
    for (let i = 0; i < n * n; i++) {
      positions.set([(i % n) * 12, 0, Math.floor(i / n) * 12], i * 3);
      // Some flat, some steep enough to blend in rock.
      const steep = i % 7 === 0;
      normals.set(steep ? [0.8, 0.36, 0.48] : [0, 1, 0], i * 3);
    }
    const base = new Float32Array(n * n * 3).fill(0.25);
    const tile = base.slice();
    sample?.colorTile?.(positions, normals, tile, x0, z0);
    const each = base.slice();
    for (let i = 0; i < n * n * 3; i += 3) {
      const nx = normals[i] as number,
        ny = normals[i + 1] as number,
        nz = normals[i + 2] as number;
      const color = sample?.(
        x0 + (positions[i] as number),
        0,
        z0 + (positions[i + 2] as number),
        Math.hypot(nx, nz) / Math.max(0.01, ny),
        [0.25, 0.25, 0.25],
      );
      if (color !== undefined) each.set(color, i);
    }
    expect(Array.from(tile)).toEqual(Array.from(each));
    expect(Array.from(tile)).not.toEqual(Array.from(base));
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
