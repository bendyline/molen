import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import { buildChunkGeometry } from '../src/mesh';
import { renderedGroundSampler } from '../src/rendered-ground';

const origin: [number, number] = [1000, 2000];
const grid = new Float32Array(81);
for (let z = 0; z < 9; z++)
  for (let x = 0; x < 9; x++)
    grid[z * 9 + x] = ((x - 4) ** 2 + (z - 4) ** 2) / 40 + ((x + z) % 3) * 0.08;
const heightfield = new Heightfield(grid, 9, 9, {
  origin,
  worldSize: [100, 100],
  height: { min: 0, max: 20 },
});
const descriptor = {
  format: 'molen/terrain@2' as const,
  name: 'ground',
  origin,
  chunkSize: 100,
  tileResolution: 9,
  gridSize: [1, 1] as [number, number],
  height: { min: 0, max: 20 },
  tiles: { heightUrl: '' },
  layers: [],
  lod: { levels: 1, distanceBands: [], skirts: false },
  streaming: { loadRadius: 1, unloadRadius: 2, maxConcurrentLoads: 1, maxResidentTiles: 1 },
  collision: { enabled: false },
};

function renderedMesh(resolution: number): THREE.Mesh {
  const data = buildChunkGeometry(heightfield, descriptor, 0, 0, {
    localCoordinates: true,
    skirt: false,
    step: 8 / (resolution - 1),
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('rendered ground sampler', () => {
  it.each([3, 5, 9])('matches the rendered triangles at grid resolution %i', (resolution) => {
    const mesh = renderedMesh(resolution);
    const sample = renderedGroundSampler(heightfield, origin, 100, resolution);
    const raycaster = new THREE.Raycaster();
    for (const [x, z] of [
      [3, 7],
      [21, 64],
      [49.5, 50.5],
      [77, 12],
      [96, 91],
      [62.5, 37.5],
    ] as const) {
      raycaster.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
      const hit = raycaster.intersectObject(mesh)[0];
      expect(hit, `coverage at ${x},${z}`).toBeDefined();
      expect(sample(origin[0] + x, origin[1] + z)).toBeCloseTo(hit?.point.y ?? Number.NaN, 4);
    }
  });

  it('clamps outside the tile to its edge cells', () => {
    const sample = renderedGroundSampler(heightfield, origin, 100, 9);
    expect(sample(origin[0] - 50, origin[1] - 50)).toBeCloseTo(heightfield.sampleHeight(...origin));
  });
});
