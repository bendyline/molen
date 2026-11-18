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
const songbird: WildlifeSpecies = {
  ...animal,
  id: 'test.songbird',
  title: 'Songbird silhouette',
  body: { ...animal.body, family: 'bird', height: 0.15, length: 0.18, width: 0.08 },
  motion: 'fly',
  clearance: 4,
  rest: 0,
  margin: 0.2,
};
/** An 800 m tile about the origin, flat at 5 m. */
function tileContext(): TerrainPyramidTileLayerContext {
  return {
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
}
/** Wildlife over one tile of `cover` land with the given human features on it. */
function mounted(cover: string, features: Partial<TerrainSemanticTile> = {}): EarthWildlife {
  const root = new THREE.Group(),
    land = new THREE.Group(),
    built = new THREE.Group();
  root.add(land, built);
  const wildlife = new EarthWildlife(environment, root);
  const tile: TerrainSemanticTile = {
    format: 'molen/terrain-semantics@1',
    landcover: [
      {
        class: cover,
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
    ...features,
  };
  wildlife.landcover.added(land, tile, tileContext());
  wildlife.features.added(built, tile, tileContext());
  return wildlife;
}
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
        animals: [animal, songbird],
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
            rules: [
              { animal: animal.id, density: 100, habitats: ['forest'], match: {} },
              // Heard, never drawn: a density of 0 places none.
              { animal: songbird.id, density: 0, habitats: ['forest', 'yard'], match: {} },
            ],
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

  it('takes its animal count from the tier, whatever the tier allows pedestrians', () => {
    const wildlife = mounted('forest');
    const counts = [6, 8, 12, 16, 24, 32];
    for (const [level, count] of counts.entries()) {
      wildlife.setBudget({ ...earthPerformanceTier(level).ambient, pedestrians: 0 });
      wildlife.update(0, [0, 6, 0]);
      // The forest holds more candidates than any cap: the cap is what is simulated.
      expect(wildlife.stats().candidates, `level ${level}`).toBe(count);
      expect(wildlife.stats().animals).toBeLessThanOrEqual(count);
      expect(wildlife.stats().animals).toBeGreaterThan(count / 2);
    }
    // A budget that names no count draws the Balanced tier's; a host may name any, or none.
    const { animals: _, ...unnamed } = earthPerformanceTier(5).ambient;
    for (const [animals, count] of [
      [undefined, 16],
      [3, 3],
      [0, 0],
      [Number.NaN, 0],
    ] as const) {
      wildlife.setBudget({ ...unnamed, ...(animals !== undefined ? { animals } : {}) });
      wildlife.update(0, [0, 6, 0]);
      expect(wildlife.stats().candidates, `animals ${animals}`).toBe(count);
    }
    // No budget is given more than 64; this forest has fewer than that within reach (53).
    wildlife.setBudget({ ...unnamed, animals: 1000 });
    wildlife.update(0, [0, 6, 0]);
    expect(wildlife.stats().candidates).toBeGreaterThan(32);
    expect(wildlife.stats().candidates).toBeLessThanOrEqual(64);
    wildlife.dispose();
  });

  it('settles animals in a yard and reports its birds from the street, not from a building', () => {
    // A house at 80..160 m east and south of the origin, a 9 m street along z = -200 m.
    const town: Partial<TerrainSemanticTile> = {
      buildings: [
        {
          polygons: [
            {
              outer: [
                [0.6, 0.6],
                [0.7, 0.6],
                [0.7, 0.7],
                [0.6, 0.7],
              ],
            },
          ],
        },
      ],
      transportation: [
        {
          class: 'minor_road',
          lines: [
            [
              [0, 0.25],
              [1, 0.25],
            ],
          ],
        },
      ],
    };
    const yard = mounted('residential', town);
    yard.setBudget(earthPerformanceTier(3).ambient);
    yard.update(0, [0, 6, 0]);
    // Deer keep to the forest: a yard is a habitat only to the animals that name it.
    expect(yard.stats().candidates).toBe(0);
    expect(yard.ambience([0, 6, 0])).toEqual({ habitat: 'yard', birds: 1, insects: 0 });
    expect(yard.ambience([0, 6, -200])).toEqual({ habitat: 'yard', birds: 1, insects: 0 });
    expect(yard.ambience([120, 6, 120])).toEqual({ birds: 0, insects: 0 });
    yard.dispose();
    // The same block mapped as commercial land is no habitat at all.
    const shops = mounted('commercial', town);
    shops.update(0, [0, 6, 0]);
    expect(shops.ambience([0, 6, 0])).toEqual({ birds: 0, insects: 0 });
    shops.dispose();
    // In a forest the deer are there, and none stands in the house or on the street.
    const forest = mounted('forest', town);
    forest.setBudget({ ...earthPerformanceTier(5).ambient, animals: 64 });
    forest.update(0, [0, 6, 0]);
    const deer = (forest as unknown as { agents: { position: [number, number, number] }[] }).agents;
    expect(deer.length).toBeGreaterThan(20);
    for (const { position } of deer) {
      const [x, , z] = position;
      // The house and its 1 m buffer, the street's half width and its 2 m, each plus the margin.
      expect(x > 78.6 && x < 161.4 && z > 78.6 && z < 161.4, `${x}, ${z}`).toBe(false);
      expect(Math.abs(z + 200), `${x}, ${z}`).toBeGreaterThan(6.9);
    }
    forest.dispose();
  });
});
