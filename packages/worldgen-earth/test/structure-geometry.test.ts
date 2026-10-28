import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  packTerrainSemanticTile,
  rememberTerrainSemanticTilePacket,
  terrainSemanticTileFromPacket,
  terrainSemanticTilePacket,
} from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { assert, describe, expect, it, vi } from 'vitest';
import {
  clipStructureGeometry,
  clipStructureGroundOutlines,
  clipStructureObject,
  footprintCovers,
  structureFootprint,
  withoutStructureRoads,
} from '../src/client/structure-geometry';
import type { StructurePlacement } from '../src/kernel/structure-index';

const entry: StructurePlacement = {
  id: 'bridge',
  title: 'Bridge',
  asset: 'bridge',
  anchor: [0, 0],
  heading: 0,
  replaceRoads: { length: 100, width: 20 },
  status: 'preview',
  source: 'test',
};

it('clips a concave ground opening into separate resident pieces without filling its gap', () => {
  const result = clipStructureGroundOutlines(
    [
      [
        [10, 20],
        [30, 20],
        [30, 110],
        [70, 110],
        [70, 20],
        [90, 20],
        [90, 120],
        [10, 120],
      ],
    ],
    new THREE.Matrix4(),
    100,
  );
  expect(result).toHaveLength(2);
  expect(
    result.every((ring) => ring.every(([x, z]) => x >= 0 && x <= 100 && z >= 0 && z <= 100)),
  ).toBe(true);
  const areas = result.map(
    (ring) =>
      Math.abs(
        ring.reduce((sum, p, i) => {
          const q = ring[(i + 1) % ring.length] as [number, number];
          return sum + p[0] * q[1] - p[1] * q[0];
        }, 0),
      ) / 2,
  );
  expect(areas).toEqual([1600, 1600]);
  expect(
    clipStructureGroundOutlines(
      [
        [
          [110, 10],
          [120, 10],
          [120, 20],
          [110, 20],
        ],
      ],
      new THREE.Matrix4(),
      100,
    ),
  ).toEqual([]);
});
const context = {
  origin: [-100, -100],
  tileSize: 200,
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin: [-100, -100],
    worldSize: [200, 200],
    height: { min: 0, max: 1 },
  }),
} as TerrainPyramidTileLayerContext;
describe('curved bridge road ends', () => {
  it('joins carriageway branches at an existing interior bridge node, preserving unrelated roads', () => {
    const tile = createEmptyTerrainSemanticTile();
    const junction = [0.25, 0.5] as [number, number];
    const loop = [[0.05, 0.45], junction, [0.05, 0.55]] as [number, number][];
    tile.transportation.push(
      { id: 'bridge', class: 'major_road', bridge: true, lines: [[junction, [0.75, 0.5]]] },
      { id: 'loop', class: 'major_road', lines: [loop] },
      { id: 'other-layer', class: 'major_road', layer: 1, lines: [loop] },
      { id: 'tunnel', class: 'major_road', tunnel: true, lines: [loop] },
      {
        id: 'nearby',
        class: 'major_road',
        lines: [
          [
            [0.03, 0.4],
            [0.25, 0.51],
            [0.03, 0.6],
          ],
        ],
      },
      { id: 'crossing', class: 'major_road', lines: [[[0.25, 0.1], junction, [0.25, 0.9]]] },
      { id: 'rail', class: 'rail', lines: [loop] },
      { id: 'endpoint-other-layer', class: 'major_road', layer: 1, lines: [[junction, [0, 0.5]]] },
    );
    const original = JSON.stringify(tile);
    const model: StructurePlacement = {
      ...entry,
      replaceRoads: {
        length: 100,
        width: 20,
        deckHeights: [8, 10],
        includeConnectedApproaches: true,
      },
    };
    const result = withoutStructureRoads(tile, context, [model], 1);
    const branches = result.transportation.filter((feature) => feature.id === 'loop');
    expect(branches).toHaveLength(2);
    expect(branches.map((feature) => feature.lines[0])).toEqual([loop.slice(0, 2), loop.slice(1)]);
    for (const branch of branches)
      expect(branch.bridgeConnections).toEqual([{ point: junction, elevation: 8, radius: 20 }]);
    for (const source of tile.transportation
      .slice(2)
      .filter((feature) => feature.id !== 'crossing'))
      expect(result.transportation.find((feature) => feature.id === source.id)).toBe(source);
    const crossing = result.transportation.find((feature) => feature.id === 'crossing');
    expect(crossing?.lines).toEqual(tile.transportation[5]?.lines);
    expect(crossing?.bridgeConnections).toBeUndefined();
    expect(JSON.stringify(tile)).toBe(original);
    const noApproaches: StructurePlacement = {
      ...model,
      replaceRoads: { length: 100, width: 20, deckHeights: [8, 10] },
    };
    expect(
      withoutStructureRoads(tile, context, [noApproaches], 1).transportation.find(
        (feature) => feature.id === 'loop',
      ),
    ).toBe(tile.transportation[1]);
  });
  it('splits a bank way at an existing interior bridge junction without changing source vertices', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'bridge',
        class: 'path',
        bridge: true,
        lines: [
          [
            [0.25, 0.53],
            [0.73, 0.53],
          ],
        ],
      },
      {
        id: 'bank',
        class: 'path',
        lines: [
          [
            [0.73, 0.4],
            [0.73, 0.53],
            [0.73, 0.7],
          ],
        ],
      },
      {
        id: 'other-layer',
        class: 'path',
        layer: 1,
        lines: [
          [
            [0.73, 0.4],
            [0.73, 0.53],
            [0.73, 0.7],
          ],
        ],
      },
    );
    const model: StructurePlacement = {
      ...entry,
      replaceRoads: {
        length: 100,
        width: 20,
        deckHeights: [8, 10],
        deckProfile: [
          [-50, 8, 0],
          [50, 10, 0],
        ],
        outline: [
          [-50, -10],
          [50, -10],
          [50, 10],
          [-50, 10],
        ],
        includeConnectedApproaches: true,
      },
    };
    const original = JSON.stringify(tile),
      result = withoutStructureRoads(tile, context, [model], 1);
    const banks = result.transportation.filter((f) => f.id === 'bank');
    expect(banks).toHaveLength(2);
    expect(banks[0]?.lines[0]?.at(-1)).toEqual([0.73, 0.45]);
    expect(banks[1]?.lines[0]?.[0]).toEqual([0.73, 0.55]);
    for (const bank of banks) expect(bank.bridgeConnections?.[0]?.elevation).toBeCloseTo(9.92);
    expect(result.transportation.find((f) => f.id === 'other-layer')).toBe(tile.transportation[2]);
    expect(JSON.stringify(tile)).toBe(original);
  });
  it('restores a generalized bank T-junction and carries a covered footway crossing to its exit', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'bridge',
        class: 'path',
        bridge: true,
        lines: [
          [
            [0.25, 0.53],
            [0.73, 0.53],
          ],
        ],
      },
      {
        id: 'crossing',
        class: 'path',
        subclass: 'crossing',
        lines: [
          [
            [0.73, 0.5],
            [0.73, 0.54],
          ],
        ],
      },
      {
        id: 'bank',
        class: 'path',
        lines: [
          [
            [0.73, 0.54],
            [0.9, 0.54],
          ],
        ],
      },
      {
        id: 'other-layer',
        class: 'path',
        layer: 1,
        lines: [
          [
            [0.73, 0.5],
            [0.73, 0.54],
          ],
        ],
      },
      {
        id: 'nearby',
        class: 'path',
        lines: [
          [
            [0.72, 0.5],
            [0.72, 0.7],
          ],
        ],
      },
    );
    const model: StructurePlacement = {
      ...entry,
      replaceRoads: {
        length: 100,
        width: 20,
        deckHeights: [8, 10],
        deckProfile: [
          [-50, 8, 0],
          [50, 10, 0],
        ],
        outline: [
          [-50, -10],
          [50, -10],
          [50, 10],
          [-50, 10],
        ],
        includeConnectedApproaches: true,
      },
    };
    const before = JSON.stringify(tile),
      result = withoutStructureRoads(tile, context, [model], 1);
    expect(result.transportation.find((f) => f.id === 'bank')?.lines[0]?.[0]).toEqual([0.75, 0.54]);
    expect(
      result.transportation.find((f) => f.id === 'bank')?.bridgeApproachProfile?.[0]?.elevation,
    ).toBeCloseTo(10);
    expect(result.transportation.find((f) => f.id === 'crossing')).toBeUndefined();
    expect(result.transportation.find((f) => f.id === 'other-layer')).toBe(tile.transportation[3]);
    expect(result.transportation.find((f) => f.id === 'nearby')).toBe(tile.transportation[4]);
    expect(JSON.stringify(tile)).toBe(before);
  });
  it('joins a bridge sidewalk that turns along the bank, preserving nearby unconnected walks and steps', () => {
    const tile = createEmptyTerrainSemanticTile();
    const point: [number, number] = [0.73, 0.53];
    tile.transportation.push(
      { id: 'bridge-walk', class: 'path', bridge: true, lines: [[[0.25, 0.53], point]] },
      { id: 'bank-walk', class: 'path', lines: [[point, [0.73, 0.8]]] },
      {
        id: 'independent',
        class: 'path',
        lines: [
          [
            [0.72, 0.53],
            [0.72, 0.8],
          ],
        ],
      },
      { id: 'steps', class: 'path', subclass: 'steps', lines: [[point, [0.8, 0.6]]] },
    );
    const model: StructurePlacement = {
      ...entry,
      replaceRoads: {
        length: 100,
        width: 20,
        deckHeights: [8, 10],
        deckProfile: [
          [-50, 8, 0],
          [50, 10, 0],
        ],
        outline: [
          [-50, -10],
          [50, -10],
          [50, 10],
          [-50, 10],
        ],
        includeConnectedApproaches: true,
      },
    };
    rememberTerrainSemanticTilePacket(tile, packTerrainSemanticTile(tile));
    const result = withoutStructureRoads(tile, context, [model], 1),
      bank = result.transportation.find((f) => f.id === 'bank-walk');
    expect(bank?.lines[0]?.[0]).toEqual([0.73, 0.55]);
    expect(bank?.bridgeConnections?.[0]?.elevation).toBeCloseTo(9.92);
    expect(bank?.bridgeApproachProfile?.[0]?.elevation).toBeCloseTo(9.92);
    expect(result.transportation.find((f) => f.id === 'independent')).toBe(tile.transportation[2]);
    expect(result.transportation.find((f) => f.id === 'steps')).toBe(tile.transportation[3]);
    expect(tile.transportation[1]?.lines[0]?.[0]).toEqual(point);
    const packet = terrainSemanticTilePacket(result);
    assert(packet);
    expect(packet.edits).toHaveLength(1);
    // Workers must receive the final approach grades as well as the clipped geometry.
    expect(terrainSemanticTileFromPacket(structuredClone(packet))).toEqual(result);
  });
  it.each([
    false,
    true,
  ])('clips owned side connectors only when opted in (%s)', (includeTransverseBridges) => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'side',
        bridge: true,
        lines: [
          [
            [0.5, 0.5],
            [0.5, 0.8],
          ],
        ],
      },
      {
        id: 'ground',
        lines: [
          [
            [0.5, 0.2],
            [0.5, 0.8],
          ],
        ],
      },
      {
        id: 'parallel-road',
        bridge: true,
        lines: [
          [
            [0.2, 0.7],
            [0.8, 0.7],
          ],
        ],
      },
      {
        id: 'tunnel',
        tunnel: true,
        lines: [
          [
            [0.5, 0.2],
            [0.5, 0.8],
          ],
        ],
      },
    );
    tile.transportation.push({
      id: 'crossing-bridge',
      bridge: true,
      lines: [
        [
          [0.5, 0.2],
          [0.5, 0.8],
        ],
      ],
    });
    const original = JSON.stringify(tile);
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          scale: [1, 2, 1],
          replaceRoads: {
            length: 100,
            width: 20,
            outline: [
              [-50, -10],
              [50, -10],
              [50, 10],
              [-50, 10],
            ],
            deckHeights: [3, 3],
            deckProfile: [
              [-50, 3, 0],
              [0, 8, 0],
              [50, 3, 0],
            ],
            includeTransverseBridges,
          },
        },
      ],
      1,
      () => 20,
    );
    const side = result.transportation.find((f) => f.id === 'side');
    if (includeTransverseBridges) {
      expect(side?.lines).toEqual([
        [
          [0.5, 0.55],
          [0.5, 0.8],
        ],
      ]);
      expect(side?.bridgeConnections?.[0]).toMatchObject({ point: [0.5, 0.55], elevation: 36 });
    } else expect(side).toBe(tile.transportation[0]);
    for (const [id, index] of [
      ['ground', 1],
      ['parallel-road', 2],
      ['tunnel', 3],
    ] as const)
      expect(result.transportation.find((f) => f.id === id)).toBe(tile.transportation[index]);
    expect(result.transportation.find((f) => f.id === 'crossing-bridge')).toBe(
      tile.transportation[4],
    );
    expect(JSON.stringify(tile)).toBe(original);
  });
  it.each([0, 0.7])('joins curved ends with heading %s and nonuniform scale', (heading) => {
    const scale: [number, number, number] = [2, 1.5, 3];
    const tile = createEmptyTerrainSemanticTile();
    const large = {
      ...context,
      origin: [-500, -500],
      tileSize: 1000,
    } as TerrainPyramidTileLayerContext;
    const project = ([x, z]: [number, number]): [number, number] => [
      (500 + Math.cos(heading) * x * scale[0] + Math.sin(heading) * z * scale[2]) / 1000,
      (500 - Math.sin(heading) * x * scale[0] + Math.cos(heading) * z * scale[2]) / 1000,
    ];
    const west = project([-50, 40]),
      east = project([50, 40]);
    tile.transportation.push(
      { id: 'curved', bridge: true, lines: [[west, project([-30, 0]), project([30, 0]), east]] },
      { id: 'west', lines: [[project([-90, 40]), west]] },
      { id: 'east', lines: [[east, project([90, 40])]] },
      { id: 'nearby', lines: [[project([-90, 43]), project([-50, 43])]] },
    );
    const before = JSON.stringify(tile);
    const result = withoutStructureRoads(
      tile,
      large,
      [
        {
          ...entry,
          heading,
          scale,
          replaceRoads: {
            length: 100,
            width: 20,
            outline: [
              [-50, 35],
              [-30, -5],
              [30, -5],
              [50, 35],
              [50, 45],
              [30, 5],
              [-30, 5],
              [-50, 45],
            ],
            deckHeights: [8, 10],
            deckEndpoints: [
              [-50, 40],
              [50, 40],
            ],
            includeConnectedApproaches: true,
          },
        },
      ],
      1,
      () => 20,
    );
    const byId = (id: string) => result.transportation.find((f) => f.id === id);
    expect(byId('curved')).toBeUndefined();
    expect(byId('west')?.bridgeConnections?.[0]).toMatchObject({ point: west, elevation: 32 });
    expect(byId('east')?.bridgeConnections?.[0]).toMatchObject({ point: east, elevation: 35 });
    expect(byId('west')?.lines).toEqual(tile.transportation[1]?.lines);
    expect(byId('nearby')).toBe(tile.transportation[3]);
    expect(JSON.stringify(tile)).toBe(before);
  });
});

describe('short retained bridge tails', () => {
  it('clips bends belonging to the modeled bridge while retaining a separate crossing', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'bent',
        class: 'path',
        bridge: true,
        lines: [
          [
            [0.15, 0.7],
            [0.3, 0.5],
            [0.7, 0.5],
            [0.85, 0.3],
          ],
        ],
      },
      {
        id: 'crossing',
        class: 'path',
        bridge: true,
        lines: [
          [
            [0.5, 0.2],
            [0.5, 0.8],
          ],
        ],
      },
    );
    const result = withoutStructureRoads(tile, context, [entry], 1);
    const bent = result.transportation.find((f) => f.id === 'bent');
    expect(bent?.lines).toHaveLength(2);
    for (const p of bent?.lines.flat() ?? []) {
      const x = p[0] * 200 - 100,
        z = p[1] * 200 - 100;
      expect(Math.abs(x) >= 50 - 1e-6 || Math.abs(z) >= 10 - 1e-6).toBe(true);
    }
    expect(result.transportation.find((f) => f.id === 'crossing')).toBe(tile.transportation[1]);
  });
  const fixture = () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'bridge',
        class: 'path',
        bridge: true,
        lines: [
          [
            [0.175, 0.515],
            [0.25, 0.5],
            [0.75, 0.5],
            [0.825, 0.52],
          ],
        ],
      },
      {
        id: 'east',
        class: 'path',
        lines: [
          [
            [0.825, 0.52],
            [0.95, 0.6],
          ],
        ],
      },
      {
        id: 'gateway',
        class: 'path',
        tunnel: true,
        lines: [
          [
            [0.175, 0.515],
            [0.15, 0.53],
          ],
        ],
      },
      {
        id: 'west',
        class: 'path',
        lines: [
          [
            [0.15, 0.53],
            [0.02, 0.57],
          ],
        ],
      },
      {
        id: 'crossing',
        class: 'path',
        lines: [
          [
            [0.825, 0.52],
            [0.825, 0.8],
          ],
        ],
      },
      {
        id: 'neighbour',
        class: 'path',
        lines: [
          [
            [0.825, 0.53],
            [0.95, 0.61],
          ],
        ],
      },
    );
    return tile;
  };
  it('carries distinct deck heights through short bridge tails and a covered gateway', () => {
    const tile = fixture(),
      before = JSON.stringify(tile),
      result = withoutStructureRoads(
        tile,
        context,
        [
          {
            ...entry,
            replaceRoads: {
              length: 100,
              width: 20,
              deckHeights: [8, 10],
              includeConnectedApproaches: true,
            },
          },
        ],
        1,
        () => 20,
      );
    const byId = (id: string) => result.transportation.find((f) => f.id === id);
    expect(byId('east')?.bridgeConnections?.[0]?.elevation).toBe(30);
    expect(byId('west')?.bridgeConnections?.[0]?.elevation).toBe(28);
    expect(byId('east')?.bridgeConnections?.[0]?.point).toEqual([0.825, 0.52]);
    expect(byId('west')?.bridgeConnections?.[0]?.point).toEqual([0.15, 0.53]);
    expect(byId('east')?.lines).toEqual(tile.transportation[1]?.lines);
    expect(byId('gateway')).toBe(tile.transportation[2]);
    for (const id of ['crossing', 'neighbour']) expect(byId(id)?.bridgeConnections).toBeUndefined();
    const hints = byId('bridge')?.bridgeConnections ?? [];
    expect(hints.some((h) => h.point[0] === 0.175 && h.elevation === 28)).toBe(true);
    expect(hints.some((h) => h.point[0] === 0.825 && h.elevation === 30)).toBe(true);
    expect(JSON.stringify(tile)).toBe(before);
  });
  it('does not transfer through retained tails unless the placement opts in', () => {
    const result = withoutStructureRoads(
      fixture(),
      context,
      [{ ...entry, replaceRoads: { length: 100, width: 20, deckHeights: [8, 10] } }],
      1,
      () => 20,
    );
    for (const id of ['east', 'west', 'gateway'])
      expect(result.transportation.find((f) => f.id === id)?.bridgeConnections).toBeUndefined();
  });
  it('does not carry a model height through a long unrelated remainder', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'long-bridge',
        class: 'path',
        bridge: true,
        lines: [
          [
            [-0.25, 0.5],
            [1.25, 0.5],
          ],
        ],
      },
      {
        id: 'far-road',
        class: 'path',
        lines: [
          [
            [1.25, 0.5],
            [1.5, 0.5],
          ],
        ],
      },
    );
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          replaceRoads: {
            length: 100,
            width: 20,
            deckHeight: 10,
            includeConnectedApproaches: true,
          },
        },
      ],
      1,
      () => 20,
    );
    expect(
      result.transportation.find((f) => f.id === 'far-road')?.bridgeConnections,
    ).toBeUndefined();
  });
  it('does not relay a bank height through a chain of tunnel ways', () => {
    const tile = fixture();
    tile.transportation.push(
      {
        id: 'second-gateway',
        class: 'path',
        tunnel: true,
        lines: [
          [
            [0.15, 0.53],
            [0.125, 0.545],
          ],
        ],
      },
      {
        id: 'remote-street',
        class: 'path',
        lines: [
          [
            [0.125, 0.545],
            [0.02, 0.57],
          ],
        ],
      },
    );
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          replaceRoads: {
            length: 100,
            width: 20,
            deckHeights: [8, 10],
            includeConnectedApproaches: true,
          },
        },
      ],
      1,
      () => 20,
    );
    expect(
      result.transportation.find((f) => f.id === 'west')?.bridgeConnections?.[0]?.elevation,
    ).toBe(28);
    expect(
      result.transportation.find((f) => f.id === 'remote-street')?.bridgeConnections,
    ).toBeUndefined();
  });
});
describe('landmark ground coverage', () => {
  const box = (minX: number, minZ: number, maxX: number, maxZ: number) => ({
    outer: [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ].map(
      ([x, z]) => [((x as number) + 100) / 200, ((z as number) + 100) / 200] as [number, number],
    ),
  });
  it('keeps empty ground beside a broad roof triangle', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 100, 0, 0, 0, 0, 100], 3),
    );
    const material = new THREE.MeshBasicMaterial();
    const object = new THREE.Mesh(geometry, material),
      frame = new THREE.Group().add(object);
    const footprint = structureFootprint(object, frame, [0, 0]);
    assert(footprint);
    expect(footprintCovers(footprint, box(10, 10, 20, 20), context)).toBe(true);
    expect(footprintCovers(footprint, box(75, 75, 85, 85), context)).toBe(false);
    geometry.dispose();
    material.dispose();
  });
  it('preserves a neighbour inside the bounding box of a rotated narrow building', () => {
    const geometry = new THREE.BoxGeometry(100, 20, 8),
      material = new THREE.MeshBasicMaterial();
    const object = new THREE.Mesh(geometry, material);
    object.rotation.y = Math.PI / 4;
    const frame = new THREE.Group().add(object),
      footprint = structureFootprint(object, frame, [0, 0]);
    assert(footprint);
    expect(footprintCovers(footprint, box(18, -22, 22, -18), context)).toBe(true);
    expect(footprintCovers(footprint, box(18, 18, 22, 22), context)).toBe(false);
    geometry.dispose();
    material.dispose();
  });
  it('retains a wall whose projected triangle has no area', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-50, 0, 0, 50, 0, 0, 50, 20, 0], 3),
    );
    const material = new THREE.MeshBasicMaterial(),
      object = new THREE.Mesh(geometry, material),
      frame = new THREE.Group().add(object),
      footprint = structureFootprint(object, frame, [0, 0]);
    assert(footprint);
    expect(footprintCovers(footprint, box(-4, -0.1, 4, 0.1), context)).toBe(true);
    expect(footprintCovers(footprint, box(-4, 10, 4, 12), context)).toBe(false);
    geometry.dispose();
    material.dispose();
  });
});
describe('extended structure geometry', () => {
  it('clips an opted-in authored approach only through its shared bridge endpoint', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'bridge',
        class: 'path',
        bridge: true,
        lines: [
          [
            [0.3, 0.5],
            [0.7, 0.5],
          ],
        ],
      },
      {
        id: 'west',
        class: 'path',
        lines: [
          [
            [0.3, 0.5],
            [0, 0.5],
          ],
        ],
      },
      {
        id: 'east',
        class: 'path',
        lines: [
          [
            [0.7, 0.5],
            [1, 0.5],
          ],
        ],
      },
      {
        id: 'crossing',
        class: 'path',
        lines: [
          [
            [0.3, 0.5],
            [0.3, 0.8],
          ],
        ],
      },
      {
        id: 'nearby',
        class: 'path',
        lines: [
          [
            [0.3, 0.51],
            [0, 0.51],
          ],
        ],
      },
      {
        id: 'tunnel',
        class: 'path',
        tunnel: true,
        lines: [
          [
            [0.3, 0.5],
            [0, 0.5],
          ],
        ],
      },
    );
    const model: StructurePlacement = {
      ...entry,
      replaceRoads: {
        length: 100,
        width: 20,
        deckHeights: [8, 10],
        includeConnectedApproaches: true,
      },
    };
    const result = withoutStructureRoads(tile, context, [model], 1);
    expect(result.transportation.map((road) => road.id)).toEqual([
      'west',
      'east',
      'crossing',
      'nearby',
      'tunnel',
    ]);
    expect(result.transportation[0]?.lines).toEqual([
      [
        [0.25, 0.5],
        [0, 0.5],
      ],
    ]);
    expect(result.transportation[1]?.lines).toEqual([
      [
        [0.75, 0.5],
        [1, 0.5],
      ],
    ]);
    expect(result.transportation[0]?.bridgeConnections?.[0]).toEqual({
      point: [0.25, 0.5],
      elevation: 8,
      radius: 20,
    });
    expect(result.transportation.slice(2)).toEqual(tile.transportation.slice(3));
    expect(tile.transportation[1]?.lines[0]?.[0]).toEqual([0.3, 0.5]);
    if (model.replaceRoads) model.replaceRoads.includeConnectedApproaches = false;
    expect(withoutStructureRoads(tile, context, [model], 1).transportation[0]).toBe(
      tile.transportation[1],
    );
  });
  it('pins outlined ground approaches at their own offset lane endpoints', () => {
    const tile = createEmptyTerrainSemanticTile();
    const node: [number, number] = [0.3, 0.53];
    tile.transportation.push(
      { id: 'bridge', class: 'highway', bridge: true, lines: [[node, [0.75, 0.53]]] },
      { id: 'approach', class: 'highway', lines: [[[0, 0.53], node]] },
      {
        id: 'independent',
        class: 'path',
        lines: [
          [
            [0.2, 0.7],
            [0.2, 0.3],
          ],
        ],
      },
    );
    const model: StructurePlacement = {
      ...entry,
      replaceRoads: {
        length: 100,
        width: 20,
        deckHeights: [8, 10],
        deckProfile: [
          [-50, 8, 0],
          [50, 10, 0],
        ],
        outline: [
          [-50, -10],
          [50, -10],
          [50, 10],
          [-50, 10],
        ],
        includeConnectedApproaches: true,
      },
    };
    const result = withoutStructureRoads(tile, context, [model], 1);
    const approach = result.transportation.find((f) => f.id === 'approach');
    expect(approach?.lines[0]?.at(-1)).toEqual([0.25, 0.53]);
    expect(approach?.bridgeConnections).toEqual([
      { point: [0.25, 0.53], elevation: 8, radius: 20 },
    ]);
    expect(result.transportation.find((f) => f.id === 'independent')).toBe(tile.transportation[2]);
    expect(tile.transportation[1]?.lines[0]?.at(-1)).toEqual(node);
  });

  it('positions endpoint heights at the actual asymmetric outline centerline', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'path',
      bridge: true,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    });
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          replaceRoads: {
            length: 100,
            width: 20,
            deckHeights: [3, 7],
            outline: [
              [-60, -10],
              [30, -10],
              [50, 10],
              [-40, 10],
            ],
          },
        },
      ],
      1,
    );
    expect(result.transportation[0]?.bridgeConnections?.map((hint) => hint.point)).toEqual([
      [0.25, 0.5],
      [0.7, 0.5],
    ]);
  });
  it('transfers a removed bridge endpoint only to its connected outward approach', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        id: 'bridge',
        class: 'path',
        bridge: true,
        lines: [
          [
            [0.25, 0.5],
            [0.75, 0.5],
          ],
        ],
      },
      {
        id: 'west',
        class: 'path',
        lines: [
          [
            [0.25, 0.5],
            [0, 0.5],
          ],
        ],
      },
      {
        id: 'crossing',
        class: 'path',
        lines: [
          [
            [0.25, 0.5],
            [0.25, 0.1],
          ],
        ],
      },
      {
        id: 'nearby',
        class: 'path',
        lines: [
          [
            [0.25, 0.51],
            [0, 0.51],
          ],
        ],
      },
      {
        id: 'tunnel',
        class: 'path',
        tunnel: true,
        lines: [
          [
            [0.25, 0.5],
            [0, 0.5],
          ],
        ],
      },
    );
    const result = withoutStructureRoads(
      tile,
      context,
      [{ ...entry, replaceRoads: { length: 100, width: 20, deckHeights: [8, 10] } }],
      1,
      () => 20,
    );
    expect(result.transportation.some((f) => f.id === 'bridge')).toBe(false);
    expect(result.transportation.find((f) => f.id === 'west')?.bridgeConnections).toEqual([
      { point: [0.25, 0.5], elevation: 28, radius: 20 },
    ]);
    for (const id of ['crossing', 'nearby', 'tunnel'])
      expect(result.transportation.find((f) => f.id === id)?.bridgeConnections).toBeUndefined();
    expect(tile.transportation.every((f) => !f.bridgeConnections)).toBe(true);
  });
  it('retains texture coordinates and material groups across a tile seam', () => {
    const source = new THREE.BoxGeometry(400, 8, 20);
    const matrix = new THREE.Matrix4().makeTranslation(200, 12, 100);
    const clipped = clipStructureGeometry(source, matrix, 200);
    const positions = clipped.getAttribute('position');
    const uv = clipped.getAttribute('uv');
    expect(uv.count).toBe(positions.count);
    expect(clipped.groups.map((group) => group.materialIndex)).toContain(2);
    expect(clipped.groups.reduce((sum, group) => sum + group.count, 0)).toBe(positions.count);
    // The +Y face's source u spans the entire 400m model. Clipping retains half its texture,
    // rather than stretching the whole texture onto every tile.
    const top = clipped.groups.find((group) => group.materialIndex === 2);
    if (!top) throw new Error('Missing top material group');
    const us = Array.from({ length: top.count }, (_, i) => uv.getX(top.start + i));
    expect(Math.min(...us)).toBeCloseTo(0);
    expect(Math.max(...us)).toBeCloseTo(0.5);
    source.dispose();
    clipped.dispose();
  });

  it('expands quantized attributes before applying kilometer-scale node transforms', () => {
    const source = new THREE.BufferGeometry();
    source.setAttribute(
      'position',
      new THREE.Int16BufferAttribute([0, 0, 0, 32767, 0, 0, 0, 32767, 32767], 3, true),
    );
    source.setAttribute('uv', new THREE.Uint16BufferAttribute([0, 0, 65535, 0, 0, 65535], 2, true));
    const geometry = clipStructureGeometry(
      source,
      new THREE.Matrix4().makeScale(1000, 1000, 1000),
      500,
    );
    expect(geometry.boundingBox?.max.x).toBe(500);
    expect(geometry.boundingBox?.max.y).toBe(500);
    expect(geometry.getAttribute('uv').getX(1)).toBeCloseTo(0.5);
    expect(source.getAttribute('position').array).toBeInstanceOf(Int16Array);
    geometry.dispose();
    source.dispose();
  });

  it('clips nested meshes independently while retaining their exact PBR materials', () => {
    const scene = new THREE.Group();
    const texture = new THREE.Texture();
    const material = new THREE.MeshPhysicalMaterial({ map: texture, clearcoat: 0.5 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(400, 20, 20), material);
    mesh.position.set(200, 10, 100);
    scene.add(mesh);
    const object = clipStructureObject(scene, 200);
    const part = object.children[0] as THREE.Mesh;
    expect(part.material).toBe(material);
    expect(part.geometry).not.toBe(mesh.geometry);
    expect(part.geometry.getAttribute('uv')).toBeDefined();
    expect(part.geometry.boundingBox?.max.y).toBe(20);
    expect(part.position.toArray()).toEqual([0, 0, 0]);
    expect(part.userData.worldgenOwnedGeometry).toBe(true);
    part.geometry.dispose();
    mesh.geometry.dispose();
    material.dispose();
    texture.dispose();
  });
  it('clips a rotated long model into adjacent tiles with matching cut edges', () => {
    const source = new THREE.BoxGeometry(400, 8, 20).toNonIndexed();
    const colors = new Float32Array(source.getAttribute('position').count * 3).fill(0.5);
    source.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const matrix = new THREE.Matrix4().makeRotationY(-0.2).setPosition(200, 12, 100);
    const a = clipStructureGeometry(source, matrix, 200);
    const b = clipStructureGeometry(
      source,
      new THREE.Matrix4().makeTranslation(-200, 0, 0).multiply(matrix),
      200,
    );
    for (const geometry of [a, b]) {
      expect(geometry.boundingBox?.min.x).toBeGreaterThanOrEqual(0);
      expect(geometry.boundingBox?.max.x).toBeLessThanOrEqual(200);
      expect(geometry.boundingBox?.min.y).toBe(8);
    }
    const edge = (g: THREE.BufferGeometry, x: number) => {
      const p = g.getAttribute('position');
      const out = new Set<string>();
      for (let i = 0; i < p.count; i++)
        if (Math.abs(p.getX(i) - x) < 0.001)
          out.add(`${p.getY(i).toFixed(4)}/${p.getZ(i).toFixed(4)}`);
      return [...out].sort();
    };
    expect(edge(a, 200)).toEqual(edge(b, 0));
    expect(source.boundingBox).toBeNull();
    a.dispose();
    b.dispose();
    source.dispose();
  });
  it('removes only the covered span, retaining both approach fragments and ground roads', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        class: 'highway',
        bridge: true,
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
      {
        class: 'minor_road',
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    );
    const result = withoutStructureRoads(tile, context, [entry], 1);
    expect(result.transportation[0]?.lines).toEqual([
      [
        [0, 0.5],
        [0.25, 0.5],
      ],
      [
        [0.75, 0.5],
        [1, 0.5],
      ],
    ]);
    expect(result.transportation[1]).toBe(tile.transportation[1]);
    expect(tile.transportation[0]?.lines).toEqual([
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ]);
  });
  it('uses the model heading for replacement and keeps perpendicular crossings outside its width', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    });
    const result = withoutStructureRoads(tile, context, [{ ...entry, heading: Math.PI / 2 }], 1);
    expect(result.transportation[0]?.lines[0]?.[1]?.[1]).toBeCloseTo(0.25);
    expect(result.transportation[0]?.lines[1]?.[0]?.[1]).toBeCloseTo(0.75);
    expect(withoutStructureRoads(tile, context, [entry], 1).transportation[0]?.lines).toEqual(
      tile.transportation[0]?.lines,
    );
  });
  it('connects approaches to the resolved bank reference without resampling the riverbed', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    });
    const sample = vi.spyOn(context.heightfield, 'sampleHeight');
    try {
      const result = withoutStructureRoads(
        tile,
        context,
        [
          {
            ...entry,
            elevation: 1.5,
            scale: [1, 2, 1],
            replaceRoads: { length: 100, width: 20, deckHeight: 8 },
          },
        ],
        1,
        () => 38.5,
      );
      expect(result.transportation[0]?.bridgeConnections?.map((item) => item.elevation)).toEqual([
        54.5, 54.5,
      ]);
      expect(sample).not.toHaveBeenCalled();
    } finally {
      sample.mockRestore();
    }
  });
  it('does not alter elevation hints on unrelated perpendicular or exterior bridge roads', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        class: 'highway',
        bridge: true,
        lines: [
          [
            [0.5, 0],
            [0.5, 1],
          ],
        ],
      },
      {
        class: 'highway',
        bridge: true,
        lines: [
          [
            [0, 0.8],
            [1, 0.8],
          ],
        ],
      },
    );
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          replaceRoads: { length: 100, width: 20, deckHeights: [5, 8] },
        },
      ],
      1,
    );
    expect(result.transportation[0]).toBe(tile.transportation[0]);
    expect(result.transportation[1]).toBe(tile.transportation[1]);
    expect(result.transportation.every((road) => road.bridgeConnections === undefined)).toBe(true);
  });
  it('keeps distinct scaled endpoint heights after the bridge turns north', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    });
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          datum: 'sea-level',
          elevation: 26.34,
          heading: Math.PI / 2,
          scale: [1, 2, 1],
          replaceRoads: { length: 100, width: 20, deckHeights: [12.86, 16.41] },
        },
      ],
      1,
    );
    const connections = result.transportation[0]?.bridgeConnections;
    expect(connections?.[0]?.point).toEqual([0.5, 0.75]);
    expect(connections?.[1]?.point).toEqual([0.5, 0.25]);
    expect(connections?.[0]?.elevation).toBeCloseTo(52.06);
    expect(connections?.[1]?.elevation).toBeCloseTo(59.16);
  });
  it('subtracts skewed ends without removing parallel roads outside the actual footprint', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
        [
          [0.24, 0.55],
          [0.28, 0.55],
        ],
      ],
    });
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          replaceRoads: {
            length: 100,
            width: 20,
            outline: [
              [-50, -10],
              [40, -10],
              [50, 10],
              [-40, 10],
            ],
          },
        },
      ],
      1,
    );
    expect(result.transportation[0]?.lines).toEqual([
      [
        [0, 0.5],
        [expect.closeTo(0.275), 0.5],
      ],
      [
        [expect.closeTo(0.725), 0.5],
        [1, 0.5],
      ],
      [
        [0.24, 0.55],
        [0.28, 0.55],
      ],
    ]);
  });
  it('preserves the gap in a concave footprint and applies native scale and heading', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    });
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          heading: Math.PI / 2,
          scale: [2, 1, 3],
          replaceRoads: {
            length: 50,
            width: 10,
            outline: [
              [-25, -5],
              [25, -5],
              [25, 5],
              [5, 5],
              [5, -1],
              [-5, -1],
              [-5, 5],
              [-25, 5],
            ],
          },
        },
      ],
      1,
    );
    expect(result.transportation[0]?.lines).toEqual([
      [
        [0.5, 0],
        [0.5, 0.25],
      ],
      [
        [0.5, 0.45],
        [0.5, 0.55],
      ],
      [
        [0.5, 0.75],
        [0.5, 1],
      ],
    ]);
  });
});
