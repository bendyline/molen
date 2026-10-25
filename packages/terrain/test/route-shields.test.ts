import { readFileSync } from 'node:fs';
import { loadFontLibrary } from '@bendyline/molen-materials/text';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { DEFAULT_ROAD_SIGN_PROFILE, terrainRoadSignProfilesSchema } from '../src/road-sign-styles';
import { resolveTerrainRouteMarker, terrainRouteShieldLibrarySchema } from '../src/route-shields';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';
import { createTerrainSurfaceObject, disposeTerrainSurfaceObject } from '../src/surface-client';
import type { SurfaceSign } from '../src/surface-sign-mesh';

const json = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../../content/earth/${path}`, import.meta.url), 'utf8'));
const library = terrainRouteShieldLibrarySchema.parse(json('signs/route-shields.json'));
const profiles = terrainRoadSignProfilesSchema.parse(json('signs/us-states.json')).profiles;
const fonts = await loadFontLibrary(json('fonts/catalog.json'), async (path) =>
  json(`fonts/${path}`),
);
const wa = profiles.find((p) => p.id === 'us-wa') ?? DEFAULT_ROAD_SIGN_PROFILE;
const context = {
  tileSize: 400,
  origin: [0, 0],
  address: { level: 3, x: 0, z: 0 },
  pyramid: { maxLevel: 3 },
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin: [0, 0],
    worldSize: [400, 400],
    height: { min: 0, max: 1 },
  }),
  signal: new AbortController().signal,
} as TerrainPyramidTileLayerContext;

describe('state route shields', () => {
  it('covers all 50 states with renderable, bounded geometry and source numbers', () => {
    expect(profiles).toHaveLength(50);
    expect(new Set(Object.values(library.shields).map((s) => s.subdivision)).size).toBe(50);
    for (const profile of profiles)
      for (const ref of ['28', '520']) {
        const tile = createEmptyTerrainSemanticTile();
        tile.transportation = [
          {
            class: 'major_road',
            subclass: 'primary',
            network: profile.stateNetwork,
            shieldText: ref,
            lines: [
              [
                [0, 0.5],
                [1, 0.5],
              ],
            ],
          },
        ];
        const options = {
          signProfile: profile,
          routeShields: library,
          details: { parkedCars: false },
        };
        const object = createTerrainSurfaceObject(tile, context, { ...options, fonts });
        const unlettered = createTerrainSurfaceObject(tile, context, options);
        const signs = object.userData.roadSigns as SurfaceSign[];
        expect(signs.filter((s) => s.pattern === 'route-marker')).toHaveLength(2);
        expect(signs[0]?.routeShield).toEqual({ network: profile.stateNetwork, ref });
        const face = object.getObjectByName('surface:road-signs') as THREE.Mesh;
        const blank = unlettered.getObjectByName('surface:road-signs') as THREE.Mesh;
        const positions = face.geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(blank.geometry.getAttribute('position').count);
        expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
        disposeTerrainSurfaceObject(object);
        disposeTerrainSurfaceObject(unlettered);
      }
  }, 30_000); // Builds 200 surface objects across all 50 states; exceeds 5 s on CI.
  it.each([
    'US:I',
    'US:US',
    'US:WA:King',
    'US:TX:FM',
    'US:TN:secondary',
    'US:CA:Business',
    'US:WA:Toll',
    'US:WA;US:OR',
    'ZZ:WA',
  ])('does not substitute a primary shield for %s', (network) => {
    expect(
      resolveTerrainRouteMarker({ network, shieldText: '28', ref: 'WA 28' }, wa, library),
    ).toBeUndefined();
  });
  it('uses exact source networks before geographic defaults, and never guesses bare numbers', () => {
    expect(
      resolveTerrainRouteMarker({ network: 'US:CA', shieldText: '28' }, wa, library)?.marker,
    ).toEqual({ network: 'US:CA', ref: '28' });
    expect(
      resolveTerrainRouteMarker({ ref: 'WA-520' }, DEFAULT_ROAD_SIGN_PROFILE, library)?.marker,
    ).toEqual({ network: 'US:WA', ref: '520' });
    expect(
      resolveTerrainRouteMarker({ ref: 'WA 520', shieldText: '520' }, wa, library)?.marker.ref,
    ).toBe('520');
    expect(
      resolveTerrainRouteMarker({ ref: 'WA 520', shieldText: '28' }, wa, library),
    ).toBeUndefined();
    expect(resolveTerrainRouteMarker({ ref: 'TN 28' }, wa, library)).toBeUndefined();
    expect(resolveTerrainRouteMarker({ ref: 'SR 520' }, wa, library)?.evidence).toContain(
      'subdivision=US-WA',
    );
    for (const ref of ['520', 'I 90', 'US 2', 'SR 28;SR 29', '28/29', 'SR unknown'])
      expect(resolveTerrainRouteMarker({ ref }, wa, library)).toBeUndefined();
    expect(
      resolveTerrainRouteMarker({ ref: 'SR 520' }, DEFAULT_ROAD_SIGN_PROFILE, library),
    ).toBeUndefined();
    expect(
      resolveTerrainRouteMarker({ network: 'US:CA', ref: 'WA 28' }, wa, library),
    ).toBeUndefined();
    expect(resolveTerrainRouteMarker({ network: 'US:WA', ref: '28' }, wa)).toBeUndefined();
  });
  it('rejects malformed triangles before content reaches rendering', () => {
    const broken = structuredClone(library);
    const layer = broken.shields['US:WA']?.variants[0]?.layers[0];
    if (!layer) throw Error('Missing WA artwork');
    layer.indices[0] = layer.positions.length;
    expect(() => terrainRouteShieldLibrarySchema.parse(broken)).toThrow(
      'Invalid route shield triangles',
    );
  });
});
