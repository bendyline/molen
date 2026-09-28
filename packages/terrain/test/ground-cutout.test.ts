import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  markTerrainGroundSurface,
  setTerrainGroundCutout,
  subtractTerrainGroundGeometry,
  TerrainGroundCutoutController,
  terrainGroundSourceGeometry,
} from '../src/ground-cutout';
import { Heightfield } from '../src/heightfield';
import { createTerrainPyramidStream } from '../src/pyramid-stream';
import {
  type TerrainPyramidDescriptor,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from '../src/pyramid-types';
import { createTerrainSemanticObject, disposeTerrainSemanticObject } from '../src/semantic-client';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';

function plane(size = 10): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size, 1, 1)
    .rotateX(-Math.PI / 2)
    .translate(size / 2, 0, size / 2);
  const p = g.getAttribute('position');
  const colors = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    p.setY(i, 2 * x + 3 * z);
    colors.push(x / size, z / size, 0.5);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.clearGroups();
  g.addGroup(0, 6, 2);
  return g;
}
function area(g: THREE.BufferGeometry): number {
  const p = g.getAttribute('position'),
    idx = g.index;
  let total = 0;
  for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
    const [a, b, c] = [0, 1, 2].map((j) => (idx ? idx.getX(i + j) : i + j)) as [
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
describe('model-owned ground openings', () => {
  it('leaves regions without cutouts untouched without traversing their buildings', () => {
    const root = new THREE.Group(),
      ground = new THREE.Mesh(plane());
    markTerrainGroundSurface(ground);
    root.add(ground);
    const original = ground.geometry;
    const traversal = vi.spyOn(root, 'traverseVisible');
    const controller = new TerrainGroundCutoutController();
    expect(controller.update(root)).toBe(false);
    expect(ground.geometry).toBe(original);
    expect(traversal).not.toHaveBeenCalled();
    controller.dispose();
  });
  it('cuts a small opening from two coarse slope triangles, preserving heights, UVs, colors and groups', () => {
    const source = plane(),
      original = Array.from(source.getAttribute('position').array);
    const cut = subtractTerrainGroundGeometry(source, [square]);
    expect(area(cut)).toBeCloseTo(84, 5);
    expect(Array.from(source.getAttribute('position').array)).toEqual(original);
    const p = cut.getAttribute('position'),
      c = cut.getAttribute('color'),
      uv = cut.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      expect(p.getY(i)).toBeCloseTo(2 * p.getX(i) + 3 * p.getZ(i), 5);
      expect(c.getX(i)).toBeCloseTo(p.getX(i) / 10, 5);
      expect(c.getY(i)).toBeCloseTo(p.getZ(i) / 10, 5);
      expect(uv.getX(i)).toBeCloseTo(p.getX(i) / 10, 5);
    }
    expect(cut.groups).toEqual([{ start: 0, count: p.count, materialIndex: 2 }]);
  });
  it('subtracts concave polygons and overlapping openings as a union', () => {
    const cut = subtractTerrainGroundGeometry(plane(), [
      [
        [2, 2],
        [8, 2],
        [8, 4],
        [4, 4],
        [4, 8],
        [2, 8],
      ],
      [
        [3, 3],
        [5, 3],
        [5, 5],
        [3, 5],
      ],
    ]);
    expect(area(cut)).toBeCloseTo(79, 4);
  });
  it('retains original geometry, handles transformed owners and restores on hide, detach and external disposal', () => {
    const root = new THREE.Group(),
      ground = new THREE.Mesh(plane()),
      owner = new THREE.Group();
    markTerrainGroundSurface(ground);
    root.add(ground, owner);
    owner.position.set(5, 0, 5);
    owner.rotation.y = Math.PI / 4;
    setTerrainGroundCutout(owner, [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]);
    const source = ground.geometry,
      controller = new TerrainGroundCutoutController(),
      onSourceDispose = vi.fn();
    source.addEventListener('dispose', onSourceDispose);
    expect(controller.update(root)).toBe(true);
    expect(area(ground.geometry)).toBeCloseTo(96, 4);
    expect(terrainGroundSourceGeometry(ground)).toBe(source);
    const first = ground.geometry,
      disposed = vi.fn();
    first.addEventListener('dispose', disposed);
    expect(controller.update(root)).toBe(false);
    expect(ground.geometry).toBe(first);
    owner.visible = false;
    controller.update(root);
    expect(ground.geometry).toBe(source);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(onSourceDispose).not.toHaveBeenCalled();
    owner.visible = true;
    controller.update(root);
    owner.removeFromParent();
    controller.update(root);
    expect(ground.geometry).toBe(source);
    root.add(owner);
    controller.update(root);
    ground.geometry.dispose();
    expect(onSourceDispose).toHaveBeenCalledTimes(1);
    controller.dispose();
  });
  it('updates clipped normals from the retained grid without corrupting original topology', () => {
    const root = new THREE.Group(),
      ground = new THREE.Mesh(plane()),
      owner = new THREE.Group();
    markTerrainGroundSurface(ground);
    root.add(ground, owner);
    setTerrainGroundCutout(owner, square);
    const source = ground.geometry,
      controller = new TerrainGroundCutoutController();
    controller.update(root);
    const old = ground.geometry;
    const normals = terrainGroundSourceGeometry(ground).getAttribute('normal');
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
    normals.needsUpdate = true;
    expect(controller.update(root)).toBe(true);
    expect(ground.geometry).not.toBe(old);
    expect(ground.geometry.getAttribute('normal').getY(0)).toBe(1);
    controller.dispose();
    expect(ground.geometry).toBe(source);
  });
  it('cuts production terrain across tile boundaries and restores when its human layer is hidden', async () => {
    const d: TerrainPyramidDescriptor = {
      name: 'cutout',
      origin: [0, 0],
      rootSize: 16,
      minLevel: 1,
      maxLevel: 1,
      tileResolution: 3,
      height: { min: 0, max: 10 },
      layers: [],
      skirts: false,
    };
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (a) =>
          new Heightfield(new Float32Array(9), 3, 3, {
            origin: terrainPyramidTileOrigin(d, a),
            worldSize: [terrainPyramidTileSize(d, a.level), terrainPyramidTileSize(d, a.level)],
            height: d.height,
          }),
      },
      {
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        initialView: { position: [8, 20, 8], verticalFov: 1, viewportHeight: 500 },
        layers: [
          {
            id: 'cover',
            category: 'classification',
            createTile(context) {
              const tile = createEmptyTerrainSemanticTile();
              tile.landcover = [
                {
                  id: 'grass',
                  class: 'grass',
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
              ];
              return createTerrainSemanticObject(tile, context, {
                renderTransportation: false,
                renderBuildings: false,
                renderWater: false,
              });
            },
            disposeTile: disposeTerrainSemanticObject,
          },
          {
            id: 'stadium',
            category: 'human-feature',
            createTile: ({ address }) => {
              const o = new THREE.Group();
              if (address.x === 0 && address.z === 0)
                setTerrainGroundCutout(o, [
                  [6, 2],
                  [10, 2],
                  [10, 6],
                  [6, 6],
                ]);
              return o;
            },
          },
        ],
      },
    );
    const total = (prefix = 'surface:') => {
      let sum = 0;
      stream.object.traverseVisible((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.name.startsWith(prefix)) sum += area(m.geometry);
      });
      return sum;
    };
    try {
      await stream.whenIdle();
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(total()).toBeCloseTo(240, 5);
      expect(total('semantic:landcover')).toBeCloseTo(240, 5);
      stream.setLayerVisible('stadium', false);
      expect(total()).toBeCloseTo(256, 5);
      expect(total('semantic:landcover')).toBeCloseTo(256, 5);
      stream.setLayerVisible('stadium', true);
      await stream.whenIdle();
      expect(total()).toBeCloseTo(240, 5);
      expect(total('semantic:landcover')).toBeCloseTo(240, 5);
    } finally {
      stream.dispose();
    }
  });
});
