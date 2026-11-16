import {
  createTerrainSemanticObject,
  disposeTerrainSemanticObject,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  type TerrainPackageDescriptor,
  type TerrainSemanticPolygon,
} from '@bendyline/molen-terrain/kernel';
import type { Mesh } from 'three';
import { expect, it } from 'vitest';
import { earthWaterMeshOptions, readEarthWaterFeatures } from '../src/client/water-features';

it('renders separate mapped stages for one relation and omits a dry spillway', () => {
  const stages = readEarthWaterFeatures({
    format: 'molen/earth-water-features@1',
    features: [
      { id: 1, split: { anchor: [0, 0], heading: 0, negativeZ: 315.43, positiveZ: 370.65 } },
      { id: 2, hidePolygons: true },
    ],
  });
  const ring = (
    west: number,
    north: number,
    east: number,
    south: number,
  ): TerrainSemanticPolygon => ({
    outer: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
  });
  const north = ring(0.1, 0.15, 0.3, 0.3);
  const south = ring(0.65, 0.7, 0.8, 0.85);
  const tile = createEmptyTerrainSemanticTile();
  tile.water = [
    { id: 1, polygons: [north, south] },
    { id: 2, polygons: [ring(0.4, 0.4, 0.6, 0.6)] },
  ];
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const origin: [number, number] = [-50, -50];
  const context = {
    address: { level: 15, x: 0, z: 0 },
    tileSize: 100,
    origin,
    pyramid: { metersPerUnit: 0.78 },
    heightfield: new Heightfield(new Float32Array(4).fill(0.6), 2, 2, {
      origin,
      worldSize: [100, 100],
      height: { min: 0, max: 500 },
    }),
  } as TerrainPyramidTileLayerContext;
  const group = createTerrainSemanticObject(
    tile,
    context,
    earthWaterMeshOptions(stages, descriptor),
  );
  const mesh = group.getObjectByName('semantic:water') as Mesh;
  const position = mesh.geometry.getAttribute('position');
  const renderedStages = new Set<number>();
  for (let i = 0; i < position.count; i++) renderedStages.add(Number(position.getY(i).toFixed(2)));
  expect(renderedStages).toEqual(new Set([315.43, 370.65]));
  expect(position.count).toBe(8);
  disposeTerrainSemanticObject(group);
});
