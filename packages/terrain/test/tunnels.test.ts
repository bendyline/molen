import { WalkCollision } from '@bendyline/molen-client/navigation';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { describe, expect, it, vi } from 'vitest';
import { markTerrainGroundSurface, TerrainGroundCutoutController } from '../src/ground-cutout';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';
import { createTerrainTunnelObject, sampleTerrainTunnel, withTerrainTunnels } from '../src/tunnels';

function context(x = 0, height = 10): TerrainPyramidTileLayerContext {
  const origin: [number, number] = [x * 200, 0];
  const layers = [{ name: 'ground', color: '#778855', tiling: 1 }];
  return {
    address: { level: 2, x, z: 0 },
    pyramid: {
      name: 'tunnels',
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
      name: 'tunnels',
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
    heightfield: new Heightfield(new Float32Array(25).fill(height / 100), 5, 5, {
      origin,
      worldSize: [200, 200],
      height: { min: 0, max: 100 },
    }),
  };
}
function tile(start = 0.05, end = 0.95) {
  const result = createEmptyTerrainSemanticTile();
  result.transportation.push({
    class: 'highway',
    tunnel: true,
    width: 12,
    lines: [
      [
        [start, 0.5],
        [end, 0.5],
      ],
    ],
  });
  return result;
}
function ground() {
  const geometry = new THREE.PlaneGeometry(200, 200, 4, 4)
    .rotateX(-Math.PI / 2)
    .translate(100, 0, 100);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, p.getX(i) === 100 ? 80 : 10);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  markTerrainGroundSurface(mesh);
  return mesh;
}

describe('mapped tunnels', () => {
  it('opens portals through slope triangles while retaining the hill and solid lining', () => {
    const ctx = context(),
      root = new THREE.Group(),
      surface = ground();
    root.add(surface, createTerrainTunnelObject(tile(), ctx));
    const original = surface.geometry;
    const cuts = new TerrainGroundCutoutController();
    cuts.update(root);
    root.updateMatrixWorld(true);
    // The original DEM blocks this horizontal flight. The opened bore does not.
    const ray = new THREE.Raycaster(
      new THREE.Vector3(5, 13, 100),
      new THREE.Vector3(1, 0, 0),
      0,
      190,
    );
    expect(ray.intersectObject(root, true)).toHaveLength(0);
    const down = new THREE.Raycaster(new THREE.Vector3(100, 200, 100), new THREE.Vector3(0, -1, 0));
    expect(down.intersectObject(surface)[0]?.point.y).toBeCloseTo(80);
    const wall = new THREE.Raycaster(new THREE.Vector3(100, 13, 100), new THREE.Vector3(0, 0, 1));
    expect(wall.intersectObject(root, true)[0]?.distance).toBeCloseTo(6);
    const roof = new THREE.Raycaster(new THREE.Vector3(100, 13, 100), new THREE.Vector3(0, 1, 0));
    expect(roof.intersectObject(root, true)[0]?.point.y).toBeCloseTo(16.82);
    const collision = new WalkCollision();
    collision.update(root, 100, 100, 13);
    const support = collision.octree.rayIntersect(
      new THREE.Ray(
        new THREE.Vector3(100 - collision.origin.x, 13, 100 - collision.origin.z),
        new THREE.Vector3(0, -1, 0),
      ),
    );
    if (!support) throw new Error('Tunnel floor must support a walker');
    expect(support.position.y).toBeCloseTo(10.32);
    const contact = collision.octree.capsuleIntersect(
      new Capsule(
        new THREE.Vector3(100 - collision.origin.x, 11, 94.1 - collision.origin.z),
        new THREE.Vector3(100 - collision.origin.x, 12, 94.1 - collision.origin.z),
        0.3,
      ),
    );
    if (!contact) throw new Error('Tunnel wall must collide with a walker');
    expect(contact.normal.z).toBeGreaterThan(0.9);
    collision.clear();
    cuts.dispose();
    expect(surface.geometry).toBe(original);
  });

  it('queries only visible interiors, preserves the surface above a bore and follows origin rebasing', () => {
    const root = new THREE.Group(),
      bore = createTerrainTunnelObject(tile(), context());
    root.add(bore);
    expect(sampleTerrainTunnel(root, 100, 13, 100)?.floor).toBeCloseTo(10.32);
    expect(sampleTerrainTunnel(root, 100, 13, 100)?.ceiling).toBeCloseTo(16.82);
    expect(sampleTerrainTunnel(root, 100, 90, 100)).toBeUndefined();
    expect(sampleTerrainTunnel(root, 100, 13, 108)).toBeUndefined();
    root.position.set(-1_000_000, -40, 2_000_000);
    expect(sampleTerrainTunnel(root, 100, 13, 100)?.floor).toBeCloseTo(10.32);
    bore.visible = false;
    expect(sampleTerrainTunnel(root, 100, 13, 100)).toBeUndefined();
  });

  it('joins buffered neighboring fragments before grading; the same seam has the same floor', async () => {
    const left = tile(0.1, 1.015625),
      right = tile(-0.015625, 0.9);
    const source = {
      load: vi.fn(async (address: { x: number; z: number }) =>
        address.z ? undefined : address.x === 0 ? left : address.x === 1 ? right : undefined,
      ),
    };
    const heights = {
      load: vi.fn(
        async (address: { x: number }) => context(address.x, address.x ? 20 : 10).heightfield,
      ),
    };
    const dispose = vi.fn();
    const renderer = withTerrainTunnels(
      { createTile: () => new THREE.Group(), disposeTile: dispose },
      source,
      heights,
      2,
    );
    const roots: THREE.Group[] = [];
    for (const x of [0, 1]) {
      const ctx = context(x, x ? 20 : 10),
        root = new THREE.Group();
      const object = await renderer.createTile(x ? right : left, ctx);
      if (!object) throw new Error('missing tunnel');
      object.position.set(ctx.origin[0], 0, ctx.origin[1]);
      root.add(object);
      roots.push(root);
      expect(sampleTerrainTunnel(root, 200, 17, 100)?.floor).toBeCloseTo(15.32);
      expect(sampleTerrainTunnel(root, 200, 17, 100)?.ceiling).toBeCloseTo(21.82);
      renderer.disposeTile?.(object);
      expect(sampleTerrainTunnel(root, 200, 17, 100)).toBeUndefined();
    }
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(left.transportation[0]?.lines[0]?.at(-1)?.[0]).toBe(1.015625);
  });

  it('omits incomplete clipped routes and leaves non-tunnel tiles on the ordinary renderer', async () => {
    const inner = { createTile: vi.fn(() => new THREE.Group()) };
    const source = { load: vi.fn(async () => undefined) };
    const heights = { load: vi.fn(async () => undefined) };
    const renderer = withTerrainTunnels(inner, source, heights, 2);
    const ordinary = createEmptyTerrainSemanticTile();
    await renderer.createTile(ordinary, context());
    expect(source.load).not.toHaveBeenCalled();
    const incomplete = await renderer.createTile(tile(0.1, 1.015625), context());
    expect(incomplete?.getObjectByName('semantic:tunnels')).toBeUndefined();
    expect(heights.load).not.toHaveBeenCalled();
  });

  it('uses authored floor and clearance measurements instead of inferring them from the DEM', () => {
    const measured = tile();
    Object.assign(measured.transportation[0] as object, {
      tunnelFloorElevation: -12,
      tunnelClearance: 4.5,
    });
    const root = new THREE.Group();
    root.add(createTerrainTunnelObject(measured, context()));
    expect(sampleTerrainTunnel(root, 100, -10, 100)).toEqual({ floor: -12, ceiling: -7.5 });
  });
});
