import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';
import { createTerrainSurfaceObject, disposeTerrainSurfaceObject } from '../src/surface-client';
import { SurfaceNetwork } from '../src/surface-network';
import { resolveTerrainSurfaceStyle } from '../src/surface-styles';

const context = (): TerrainPyramidTileLayerContext =>
  ({
    origin: [0, 0],
    tileSize: 1000,
    address: { level: 15, x: 0, z: 0 },
    pyramid: { maxLevel: 15 },
    descriptor: {},
    signal: new AbortController().signal,
    heightfield: new Heightfield(new Float32Array(9), 3, 3, {
      origin: [0, 0],
      worldSize: [1000, 1000],
      height: { min: 0, max: 1 },
    }),
  }) as TerrainPyramidTileLayerContext;

describe('airport surfaces', () => {
  it('keeps threshold bars visible through the pavement shader distance fade', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      id: 'airport:test:14/32',
      class: 'runway',
      width: 60,
      lines: [
        [
          [0.5, 0.1],
          [0.5, 0.9],
        ],
      ],
    });
    const group = createTerrainSurfaceObject(tile, context());
    const mesh = group.getObjectByName('surfaces:airport-markings') as THREE.Mesh;
    const detail = mesh.geometry.getAttribute('surfaceDetail');
    for (let i = 0; i < detail.count; i++) expect(detail.getZ(i) % 128).toBeGreaterThan(0);
    disposeTerrainSurfaceObject(group);
  });

  it('renders a measured runway without street fixtures, parking bays or road lanes', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      id: 'airport:test:14/32',
      class: 'aeroway',
      subclass: 'runway',
      ref: '14/32',
      width: 60,
      lines: [
        [
          [0.5, -0.5],
          [0.5, 1.5],
        ],
      ],
    });
    expect(new SurfaceNetwork(tile, 1000, resolveTerrainSurfaceStyle()).roads).toHaveLength(0);
    const group = createTerrainSurfaceObject(tile, context());
    const mesh = group.getObjectByName('surfaces:airport-pavement') as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox?.min.x).toBe(470);
    expect(mesh.geometry.boundingBox?.max.x).toBe(530);
    expect(mesh.geometry.boundingBox?.min.z).toBe(0);
    expect(mesh.geometry.boundingBox?.max.z).toBe(1000);
    expect(group.getObjectByName('surfaces:airport-markings')).toBeDefined();
    expect(group.userData.surfaceStats).toMatchObject({
      roads: 0,
      streetlights: 0,
      trafficSignals: 0,
      parkingBays: 0,
      parkedCars: 0,
    });
    disposeTerrainSurfaceObject(group);
  });

  it('does not paint asphalt markings on grass runways or turn taxiways into streets', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'runway',
      surface: 'GRS',
      width: 25,
      lines: [
        [
          [0.3, 0],
          [0.3, 1],
        ],
      ],
    });
    const group = createTerrainSurfaceObject(tile, context());
    expect(group.getObjectByName('surfaces:airport-markings')).toBeUndefined();
    expect(group.getObjectByName('surfaces:airport-pavement')).toBeDefined();
    tile.transportation.push({
      class: 'taxiway',
      width: 18,
      lines: [
        [
          [0.6, 0],
          [0.6, 1],
        ],
      ],
    });
    expect(new SurfaceNetwork(tile, 1000, resolveTerrainSurfaceStyle()).roads).toHaveLength(0);
    disposeTerrainSurfaceObject(group);
  });
});
