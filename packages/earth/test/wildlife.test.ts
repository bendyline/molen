import type { WildlifeSpecies } from '@bendyline/molen-ambient/kernel';
import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import { createRegionalEnvironment } from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { earthPerformanceTier } from '../src/client/performance';
import { EarthWildlife } from '../src/client/wildlife';

const animal: WildlifeSpecies = {
  id: 'test.deer',
  version: 1,
  title: 'Deer silhouette',
  body: {
    family: 'ungulate',
    height: 1,
    length: 1.5,
    width: 0.4,
    color: '#887766',
    accent: '#ccbb99',
    details: [],
  },
  motion: 'walk',
  speed: 0.8,
  roam: 18,
  clearance: 0,
  rest: 0.5,
  margin: 0.4,
};
const environment = createRegionalEnvironment(
  {
    atlas: {
      format: 'molen/ecology-atlas@1',
      id: 'test.atlas',
      version: 1,
      title: 'Fixture',
      cellDegrees: 10,
      regions: [{ id: 1, name: 'Test woodland', biome: 4, realm: 'Palearctic' }],
      rows: Array.from({ length: 18 }, () => [36, 1]),
      source: {
        title: 'Fixture',
        url: 'https://example.com',
        license: 'CC0',
        citation: 'Fixture',
        sha256: `sha256:${'0'.repeat(64)}`,
        interpretation: 'Test only',
      },
    },
    catalogs: [
      {
        format: 'molen/regional-catalog@1',
        id: 'test.wildlife',
        version: 1,
        title: 'Test',
        requires: [],
        overrides: [],
        scatters: [],
        animals: [animal],
        profiles: [
          {
            id: 'test.profile',
            title: 'Test',
            priority: 0,
            match: {},
            wildlife: 'test.population',
          },
        ],
        populations: [
          {
            id: 'test.population',
            title: 'Test',
            rules: [{ animal: animal.id, density: 100, habitats: ['forest'], match: {} }],
          },
        ],
      },
    ],
  },
  1,
);

describe('streamed Earth wildlife', () => {
  it('activates after asynchronous tile arrival even in a frozen frame, shares geometry, respects budget and releases resources', () => {
    const root = new THREE.Group();
    const wildlife = new EarthWildlife(environment, root);
    wildlife.setBudget(earthPerformanceTier(5).ambient);
    wildlife.update(0, [0, 6, 0]);
    expect(wildlife.stats().animals).toBe(0);
    const context: TerrainPyramidTileLayerContext = {
      address: { level: 15, x: 0, z: 0 },
      pyramid: {} as TerrainPyramidTileLayerContext['pyramid'],
      descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
      heightfield: new Heightfield(new Float32Array(9).fill(0.5), 3, 3, {
        origin: [-400, -400],
        worldSize: [800, 800],
        height: { min: 0, max: 10 },
      }),
      origin: [-400, -400],
      tileSize: 800,
      surfaceResolution: 3,
      signal: new AbortController().signal,
    };
    const cover = new THREE.Group(),
      features = new THREE.Group();
    root.add(cover, features);
    const tile: TerrainSemanticTile = {
      format: 'molen/terrain-semantics@1',
      landcover: [
        {
          class: 'forest',
          polygons: [
            {
              outer: [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
              ],
            },
          ],
        },
      ],
      buildings: [],
      transportation: [],
      water: [],
    };
    wildlife.landcover.added(cover, tile, context);
    wildlife.features.added(features, tile, context);
    wildlife.update(0, [0, 6, 0]);
    expect(wildlife.stats().animals).toBeGreaterThan(3);
    expect(wildlife.stats().animals).toBeLessThanOrEqual(64);
    const meshes: THREE.SkinnedMesh[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) meshes.push(object);
    });
    expect(meshes).toHaveLength(wildlife.stats().animals);
    expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBeLessThanOrEqual(3);
    for (let frame = 0; frame < 40; frame++) wildlife.update(0.05, [0, 6, 0]);
    wildlife.setEnabled(false);
    expect(wildlife.stats().candidates).toBe(0);
    wildlife.setEnabled(true);
    wildlife.update(0.05, [0, 6, 0]);
    expect(wildlife.stats().animals).toBeGreaterThan(0);
    features.visible = false;
    wildlife.update(0.05, [0, 6, 0]);
    expect(wildlife.stats().animals).toBe(0);
    wildlife.dispose();
    expect(root.children).toEqual([cover, features]);
  });
});
