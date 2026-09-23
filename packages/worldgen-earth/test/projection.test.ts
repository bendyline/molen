import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { wgs84ToWebMercator } from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import {
  MERCATOR_EARTH_RADIUS_METERS,
  MERCATOR_MAX_LATITUDE,
  projectWgs84,
} from '../src/kernel/projection';

function kernelSources(): string[] {
  const root = new URL('../src/kernel', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (!statSync(path).isDirectory() && /\.(ts|mts)$/.test(name)) out.push(path);
  }
  return out;
}

describe('kernel-half projection', () => {
  it('pins projected meters for the coordinates region bounds are built from', () => {
    // Region resolution decides which style and scatter set a building gets, and the package
    // advertises hash-stable output. These values must not move with the JS engine.
    expect(projectWgs84(0, 0)).toEqual([0, 0]);
    expect(projectWgs84(-122.2, 47.6)).toEqual([-13603241.774938028, -6040565.208780057]);
    expect(projectWgs84(13.405, 52.52)).toEqual([1492237.774083832, -6894699.801282422]);
    expect(projectWgs84(151.2093, -33.8688)).toEqual([16832542.27920734, 4011198.6473075734]);
    expect(MERCATOR_EARTH_RADIUS_METERS).toBe(6_378_137);
  });

  it('clamps to the Mercator latitude limit and refuses non-finite input', () => {
    expect(projectWgs84(0, 89)).toEqual(projectWgs84(0, MERCATOR_MAX_LATITUDE));
    expect(projectWgs84(0, -89)).toEqual(projectWgs84(0, -MERCATOR_MAX_LATITUDE));
    expect(projectWgs84(0, 89)[1]).toBeCloseTo(-20037508.342789244, 6);
    expect(() => projectWgs84(Number.NaN, 0)).toThrow(/finite/);
    expect(() => projectWgs84(0, Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it('matches the terrain package operation for operation (today dmath is a thin re-export)', () => {
    for (const [lon, lat] of [
      [0, 0],
      [-122.2, 47.6],
      [13.405, 52.52],
      [151.2093, -33.8688],
      [180, -85],
    ] as Array<[number, number]>) {
      expect(projectWgs84(lon, lat)).toEqual(wgs84ToWebMercator(lon, lat));
    }
  });

  it('never reaches geospatial math through the terrain package', () => {
    // check-dmath.mjs is lexical: it sees no `Math.tan` here even when an import hands the
    // kernel half a transcendental. This is the guard that actually holds.
    const geospatial = /\b(wgs84ToWebMercator|webMercatorToWgs84|webMercatorScaleAtLatitude)\b/;
    for (const file of kernelSources()) {
      const text = readFileSync(file, 'utf8');
      expect(geospatial.test(text), `${file} imports terrain geospatial math`).toBe(false);
    }
  });
});
