import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  markTerrainGroundSurface,
  setTerrainGroundCutout,
  TerrainGroundCutoutController,
} from '../src/ground-cutout';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { retireTerrainObjects } from '../src/retire';
import { disposeTerrainSemanticObject } from '../src/semantic-client';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';
import { taggedTerrainObjects, tagTerrainObject } from '../src/tagged-objects';
import { createTerrainTunnelObject, sampleTerrainTunnel } from '../src/tunnels';

function plane(size = 10): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(size, size, 1, 1)
    .rotateX(-Math.PI / 2)
    .translate(size / 2, 0, size / 2);
}
function area(geometry: THREE.BufferGeometry): number {
  const p = geometry.getAttribute('position'),
    index = geometry.index;
  let total = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const [a, b, c] = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j)) as [
      number,
      number,
      number,
    ];
    total +=
      Math.abs(
        (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) -
          (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)),
      ) / 2;
  }
  return total;
}
const square: [[number, number], [number, number], [number, number], [number, number]] = [
  [3, 3],
  [7, 3],
  [7, 7],
  [3, 7],
];

// The lists these tests read hold their objects weakly and are walked while a view runs. A walk
// dereferences every entry, and a browser does not collect in a frame what that frame has
// dereferenced, so content that is disposed has to leave them by name (retireTerrainObjects):
// what these tests check is that it is gone from each list at once, not when it is collected.
describe('retiring disposed terrain content from the lists a view walks', () => {
  it('drops every tag of everything under the root, and nothing else', () => {
    const tile = new THREE.Group(),
      water = new THREE.Mesh(),
      cars = new THREE.Group(),
      elsewhere = new THREE.Mesh();
    tile.add(water);
    water.add(cars);
    tagTerrainObject('retire:water', water);
    tagTerrainObject('retire:water', elsewhere);
    tagTerrainObject('retire:cars', cars);
    tagTerrainObject('retire:water', cars);
    expect([...taggedTerrainObjects('retire:water')]).toEqual([water, elsewhere, cars]);
    retireTerrainObjects(tile);
    expect([...taggedTerrainObjects('retire:water')]).toEqual([elsewhere]);
    expect([...taggedTerrainObjects('retire:cars')]).toEqual([]);
    // Tagged again, it is listed again, once.
    tagTerrainObject('retire:cars', cars);
    expect([...taggedTerrainObjects('retire:cars')]).toEqual([cars]);
    // Retiring twice, or something never listed, is harmless.
    retireTerrainObjects(tile);
    retireTerrainObjects(new THREE.Group());
    expect([...taggedTerrainObjects('retire:water')]).toEqual([elsewhere]);
  });

  it('stops a retired opening cutting, and retired ground being cut', () => {
    const scene = new THREE.Group(),
      kept = new THREE.Mesh(plane()),
      tile = new THREE.Group(),
      ground = new THREE.Mesh(plane()),
      opening = new THREE.Group();
    markTerrainGroundSurface(kept);
    markTerrainGroundSurface(ground);
    tile.add(ground, opening);
    scene.add(kept, tile);
    setTerrainGroundCutout(opening, square);
    const whole = kept.geometry,
      wholeTile = ground.geometry;
    const controller = new TerrainGroundCutoutController();
    try {
      controller.update(scene);
      expect(area(kept.geometry)).toBeCloseTo(84, 5);
      expect(area(ground.geometry)).toBeCloseTo(84, 5);
      // As the stream evicts a tile: its cuts are given back, then it leaves the lists. It is
      // still attached and visible here, so only its absence from them can stop it cutting.
      controller.restore(tile);
      retireTerrainObjects(tile);
      controller.update(scene);
      expect(kept.geometry).toBe(whole);
      expect(ground.geometry).toBe(wholeTile);
      // Another opening still cuts the ground that stayed, and not the ground that went.
      const other = new THREE.Group();
      scene.add(other);
      setTerrainGroundCutout(other, square);
      controller.update(scene);
      expect(area(kept.geometry)).toBeCloseTo(84, 5);
      expect(ground.geometry).toBe(wholeTile);
      // A semantic object's own disposal retires it too.
      disposeTerrainSemanticObject(other);
      controller.update(scene);
      expect(kept.geometry).toBe(whole);
    } finally {
      controller.dispose();
      kept.geometry.dispose();
      ground.geometry.dispose();
    }
  });

  it('takes a retired bore out of tunnel queries', () => {
    const origin: [number, number] = [0, 0];
    const layers = [{ name: 'ground', color: '#778855', tiling: 1 }];
    const context: TerrainPyramidTileLayerContext = {
      address: { level: 2, x: 0, z: 0 },
      pyramid: {
        name: 'retire',
        origin: [0, 0],
        rootSize: 800,
        minLevel: 0,
        maxLevel: 2,
        tileResolution: 5,
        height: { min: 0, max: 100 },
        layers,
        skirts: false,
      },
      descriptor: {
        format: 'molen/terrain@2',
        name: 'retire',
        origin,
        chunkSize: 200,
        gridSize: [1, 1],
        tileResolution: 5,
        height: { min: 0, max: 100 },
        layers,
      },
      origin,
      tileSize: 200,
      signal: new AbortController().signal,
      heightfield: new Heightfield(new Float32Array(25).fill(0.1), 5, 5, {
        origin,
        worldSize: [200, 200],
        height: { min: 0, max: 100 },
      }),
    };
    const road = createEmptyTerrainSemanticTile();
    road.transportation.push({
      class: 'highway',
      tunnel: true,
      width: 12,
      lines: [
        [
          [0.05, 0.5],
          [0.95, 0.5],
        ],
      ],
    });
    const root = new THREE.Group(),
      layer = new THREE.Group(),
      bore = createTerrainTunnelObject(road, context);
    layer.add(bore);
    root.add(layer);
    expect(sampleTerrainTunnel(root, 100, 13, 100)).toBeDefined();
    // Still attached and visible: only leaving the list stops it answering.
    retireTerrainObjects(layer);
    expect(sampleTerrainTunnel(root, 100, 13, 100)).toBeUndefined();
  });
});
