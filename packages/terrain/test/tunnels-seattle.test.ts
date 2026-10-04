import { readFile } from 'node:fs/promises';
import { PMTiles } from 'pmtiles';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { wgs84ToWorld } from '../src/geospatial';
import { createProtomapsTerrainMvtDecoder } from '../src/mvt-semantic-decoder';
import {
  createTerrainPackagePyramidHeightSource,
  openTerrainPackageSemantics,
  terrainDescriptorFromPackage,
  terrainPyramidDescriptorFromPackage,
} from '../src/package-client';
import type { TerrainPackageDescriptor } from '../src/package-types';
import { terrainPyramidTileOrigin, terrainPyramidTileSize } from '../src/pyramid-types';
import { sampleTerrainTunnel, withTerrainTunnels } from '../src/tunnels';

const fixture = new URL(
  '../../../examples/world-explorer/public/terrain/seattle-bellevue-sammamish/',
  import.meta.url,
);
async function archive(name: string): Promise<PMTiles> {
  const bytes = await readFile(new URL(name, fixture));
  return new PMTiles({
    getKey: () => name,
    getBytes: async (offset, length) => ({
      data: bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + length),
    }),
  });
}

describe('Seattle PMTiles tunnel integration', () => {
  it('renders the Mount Baker road bore across the eastern portal tile seam with one grade', async () => {
    const pkg = JSON.parse(
      await readFile(new URL('terrain-package.json', fixture), 'utf8'),
    ) as TerrainPackageDescriptor;
    const [roads, elevation] = await Promise.all([
      archive('world.pmtiles'),
      archive('elevation.pmtiles'),
    ]);
    const semantics = await openTerrainPackageSemantics(pkg, {
      featuresArchive: roads,
      landcoverArchive: roads,
      decoder: createProtomapsTerrainMvtDecoder(),
    });
    if (!semantics.features) throw new Error('Seattle features are missing');
    const pyramid = terrainPyramidDescriptorFromPackage(pkg);
    const heights = createTerrainPackagePyramidHeightSource(pkg, pyramid, elevation);
    const renderer = withTerrainTunnels(
      { createTile: () => new THREE.Group() },
      semantics.features.source,
      heights,
      15,
    );
    const seamX = terrainPyramidTileOrigin(pyramid, { level: 15, x: 5253, z: 11446 })[0];
    const [, z] = wgs84ToWorld(pyramid.metersPerUnit ?? 1, -122.288818359375, 47.590065);
    const floors: number[] = [];
    for (const x of [5252, 5253]) {
      const address = { level: 15, x, z: 11446 },
        signal = new AbortController().signal;
      const [tile, heightfield] = await Promise.all([
        semantics.features.source.load(address, signal),
        heights.load(address, signal),
      ]);
      if (!tile || !heightfield) throw new Error('Seattle fixture is incomplete');
      expect(tile.transportation.some((f) => f.tunnel && f.subclass === 'motorway')).toBe(true);
      const origin = terrainPyramidTileOrigin(pyramid, address);
      const object = await renderer.createTile(tile, {
        address,
        pyramid,
        heightfield,
        origin,
        tileSize: terrainPyramidTileSize(pyramid, 15),
        descriptor: terrainDescriptorFromPackage(pkg, 15),
        signal,
      });
      if (!object) throw new Error('Missing tunnel tile');
      const root = new THREE.Group();
      object.position.set(origin[0], 0, origin[1]);
      root.add(object);
      expect(object.getObjectByName('semantic:tunnels')).toBeDefined();
      const clearance = sampleTerrainTunnel(root, seamX, 36, z);
      expect(clearance).toBeDefined();
      if (!clearance) throw new Error('Mount Baker bore is missing at the seam');
      expect(clearance.ceiling - clearance.floor).toBeCloseTo(6.5);
      floors.push(clearance.floor);
      expect(sampleTerrainTunnel(root, seamX, 100, z)).toBeUndefined();
      renderer.disposeTile?.(object);
    }
    expect(floors[0]).toBeCloseTo(floors[1] as number, 5);
  });
});
