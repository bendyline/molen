import {
  createTerrainPackageSemanticLayers,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  type TerrainPackageDescriptor,
  type TerrainSemanticPoint,
  webMercatorTileBounds,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import {
  createStructureIndex,
  type StructurePlacement,
} from '@bendyline/molen-worldgen-earth/kernel';
import { describe, expect, it } from 'vitest';
import catalogEntry from '../../../content/earth/source/placements/s1/s17/osun.grove.road.gate.json';
import alignmentCatalog from '../../../content/earth/terrain/road-alignments.json';
import { createEarthRoadAlignments, readEarthRoadAlignments } from '../src/client/road-alignments';

const alignments = readEarthRoadAlignments(alignmentCatalog);
const edit = alignments[0];
const [level, x, z] = edit.tile;
const address = { level, x, z };
const [west, north, east] = webMercatorTileBounds({ level, x, y: z });
const size = east - west;
const toTile = (point: [number, number]): TerrainSemanticPoint => {
  const [px, pz] = wgs84ToWebMercator(...point);
  return [(px - west) / size, (pz - north) / size];
};
const [start, end] = edit.from.map(toTile);
const entry = catalogEntry as StructurePlacement;
const descriptor: TerrainPackageDescriptor = {
  format: 'molen/terrain-package@1',
  name: 'Grove road alignment fixture',
  version: '1',
  coordinateSpace: {
    kind: 'geospatial',
    crs: 'EPSG:3857',
    ellipsoid: 'WGS84',
    bounds: [-180, -85, 180, 85],
  },
  tileMatrix: { scheme: 'xyz', minLevel: 15, maxLevel: 16, rootTiles: [1, 1], tileResolution: 33 },
  elevation: {
    source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
    encoding: 'png16',
    height: { min: 0, max: 1000 },
  },
  features: {
    source: { kind: 'pmtiles', path: 'world.pmtiles' },
    encoding: 'mvt',
    profile: 'protomaps-basemap@1',
    layers: ['transportation'],
  },
  attribution: [],
  provenance: { compiler: 'fixture', compilerVersion: '1', sources: [] },
  files: [],
};

function fixtureTile() {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation = [
    { id: edit.featureId, class: 'minor_road', lanes: 2, lines: [[start, end]] },
    { id: 11, class: 'minor_road', lines: [[start, [0.4, 0.5]]] },
  ];
  return tile;
}

function fixtureIndex() {
  return createStructureIndex({
    format: 'molen/structure-placements@1',
    title: 'Grove',
    entries: [entry],
  });
}

describe('Earth road alignments', () => {
  it('keeps the junction, road direction and neighboring feature when moving the gate', () => {
    const alignment = createEarthRoadAlignments(alignments, descriptor);
    assert(alignment);
    const structures = alignment.withStructures(fixtureIndex());
    const source = fixtureTile();
    source.transportation[0].lines = [[end, start]];
    const corrected = alignment.transformFeatures(source, address, level);
    const road = corrected.transportation[0];
    expect(road.lines[0][0]).toBe(end);
    expect(road.lines[0].at(-1)).toBe(start);
    expect(road.lines[0].slice(2, -1)).toEqual(edit.via.map(toTile).reverse());
    expect(road.lanes).toBe(2);
    expect(corrected.transportation[1]).toBe(source.transportation[1]);
    expect(source.transportation[0].lines[0]).toEqual([end, start]);
    const gate = structures.query(edit.placement.bounds)[0];
    expect(gate).toMatchObject({
      id: entry.id,
      anchor: edit.placement.anchor,
      heading: entry.heading,
      terrainReference: { anchor: edit.placement.anchor, modelHeight: 0 },
    });
    expect(gate.bounds).toBeUndefined();
  });

  it('moves the clipping bounds of an extended placement along with its anchor', () => {
    const alignment = createEarthRoadAlignments(alignments, descriptor);
    assert(alignment);
    const [longitude, latitude] = entry.anchor;
    const structures = alignment.withStructures(
      createStructureIndex({
        format: 'molen/structure-placements@1',
        entries: [
          {
            ...entry,
            bounds: [longitude - 0.0001, latitude - 0.0001, longitude + 0.0001, latitude + 0.0001],
          },
        ],
      }),
    );
    alignment.transformFeatures(fixtureTile(), address, level);
    expect(structures.query(edit.placement.bounds)[0].bounds).toEqual(edit.placement.bounds);
  });

  it('keeps the fallback when the source geometry differs or the archive has finer tiles', () => {
    const alignment = createEarthRoadAlignments(alignments, descriptor);
    assert(alignment);
    const structures = alignment.withStructures(fixtureIndex());
    const source = fixtureTile();
    expect(alignment.transformFeatures(source, address, level + 1)).toBe(source);
    expect(structures.query(edit.placement.bounds)[0].anchor).toEqual(entry.anchor);
    expect(alignment.transformFeatures(source, address, level)).not.toBe(source);
    source.transportation[0].lines = [[start, [end[0] + 0.005, end[1]]]];
    expect(alignment.transformFeatures(source, address, level)).toBe(source);
    expect(structures.query(edit.placement.bounds)[0].anchor).toEqual(entry.anchor);
  });

  it('uses the corrected road and model together when a real layer overzooms its source tile', async () => {
    const alignment = createEarthRoadAlignments(alignments, descriptor);
    assert(alignment);
    const structures = alignment.withStructures(fixtureIndex());
    const source = fixtureTile();
    const rendered: { road: TerrainSemanticPoint[][]; anchor: [number, number] }[] = [];
    const loaded = await createTerrainPackageSemanticLayers(descriptor, {
      featuresArchive: {
        async getHeader() {
          return { minZoom: level, maxZoom: level, tileType: 1 };
        },
        async getZxy() {
          return { data: new Uint8Array([1]).buffer };
        },
      },
      decoder: { decode: () => source },
      transformFeatures: alignment.transformFeatures,
      featuresLayer: {
        renderer: {
          createTile(tile) {
            const road = tile.transportation.find((feature) => feature.id === edit.featureId);
            assert(road);
            rendered.push({
              road: road.lines,
              anchor: structures.query(edit.placement.bounds)[0].anchor,
            });
            return undefined;
          },
        },
      },
    });
    const [u, v] = toTile(edit.placement.anchor);
    const dx = Math.floor(u * 2);
    const dz = Math.floor(v * 2);
    const context = {
      address: { level: level + 1, x: x * 2 + dx, z: z * 2 + dz },
      signal: new AbortController().signal,
    } as TerrainPyramidTileLayerContext;
    const features = loaded.layers.find((layer) => layer.category === 'human-feature');
    assert(features);
    await features.createTile(context);
    expect(rendered[0].anchor).toEqual(edit.placement.anchor);
    expect(
      rendered[0].road
        .flat()
        .some((p) => Math.hypot(p[0] - (u * 2 - dx), p[1] - (v * 2 - dz)) < 1e-7),
    ).toBe(true);
  });
});

import assert from 'node:assert/strict';
