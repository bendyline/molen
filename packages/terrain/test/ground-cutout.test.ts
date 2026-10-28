import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  markTerrainGroundSurface,
  markTerrainPavementSurface,
  markTerrainWaterSurface,
  setTerrainGroundCutout,
  setTerrainGroundCutouts,
  setTerrainWaterCutout,
  subtractTerrainGroundGeometry,
  TerrainGroundCutoutController,
  terrainGroundSourceGeometry,
} from '../src/ground-cutout';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext, TerrainPyramidView } from '../src/pyramid-stream';
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
  it('lowers an explicit underpass ribbon while retaining paving outside it', () => {
    const scene = new THREE.Group(),
      ground = new THREE.Mesh(plane()),
      paving = new THREE.Mesh(plane());
    markTerrainGroundSurface(ground);
    markTerrainPavementSurface(paving);
    const originalGround = ground.geometry,
      originalPaving = paving.geometry;
    const owner = new THREE.Group();
    setTerrainGroundCutout(owner, square, undefined, {
      minHeight: 5,
      preservePaving: true,
      pavingOutlines: [
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
        ],
      ],
    });
    scene.add(ground, paving, owner);
    const cuts = new TerrainGroundCutoutController();
    cuts.update(scene);
    const hit = (x: number, z: number) =>
      new THREE.Raycaster(
        new THREE.Vector3(x, 100, z),
        new THREE.Vector3(0, -1, 0),
      ).intersectObject(paving)[0]?.point.y;
    expect(hit(5, 5)).toBeCloseTo(5, 5);
    expect(hit(3.5, 3.5)).toBeCloseTo(17.5, 5);
    owner.visible = false;
    cuts.update(scene);
    expect(ground.geometry).toBe(originalGround);
    expect(paving.geometry).toBe(originalPaving);
    cuts.dispose();
    originalGround.dispose();
    originalPaving.dispose();
  });

  it('clips only above a bridge floor and interpolates sloping dry banks', () => {
    const original = plane();
    const cut = subtractTerrainGroundGeometry(original, [square], [], [25]);
    // The square crosses Y25 diagonally: half its area remains below the bridge.
    expect(area(cut)).toBeCloseTo(100, 5);
    const mesh = new THREE.Mesh(cut, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const hit = (x: number, z: number) =>
      new THREE.Raycaster(
        new THREE.Vector3(x, 100, z),
        new THREE.Vector3(0, -1, 0),
      ).intersectObject(mesh)[0]?.point.y;
    expect(hit(4, 4)).toBeCloseTo(20, 5);
    expect(hit(6, 6)).toBeCloseTo(25, 5);
    cut.dispose();
    original.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('transforms a bridge floor, restores lower banks, and invalidates cached openings', () => {
    const scene = new THREE.Group();
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2));
    const upper = new THREE.Mesh(lower.geometry.clone());
    upper.position.y = 8;
    markTerrainGroundSurface(lower);
    markTerrainGroundSurface(upper);
    const originalLower = lower.geometry,
      originalUpper = upper.geometry;
    const owner = new THREE.Group();
    owner.position.y = 2;
    owner.rotation.y = Math.PI / 4;
    const outline = [
      [-2, -2],
      [2, -2],
      [2, 2],
      [-2, 2],
    ] as const;
    setTerrainGroundCutout(owner, outline, undefined, { minHeight: 3 });
    scene.add(lower, upper, owner);
    const cuts = new TerrainGroundCutoutController();
    cuts.update(scene);
    expect(lower.geometry).toBe(originalLower);
    expect(area(upper.geometry)).toBeCloseTo(100, 5);
    // The bridge cap lies below the source grid and must remain inside culling/raycast bounds.
    expect(upper.geometry.boundingBox?.min.y).toBeCloseTo(-3, 5);
    expect(upper.geometry.boundingSphere?.containsPoint(new THREE.Vector3(0, -3, 0))).toBe(true);
    // Cutting reads local placements only; a raycast needs world matrices, as a frame makes.
    scene.updateMatrixWorld(true);
    const hit = new THREE.Raycaster(
      new THREE.Vector3(0, 20, 0),
      new THREE.Vector3(0, -1, 0),
    ).intersectObject(upper)[0];
    expect(hit?.point.y).toBeCloseTo(5, 5);
    setTerrainGroundCutout(owner, outline, undefined, { minHeight: 10 });
    cuts.update(scene);
    expect(upper.geometry).toBe(originalUpper);
    setTerrainGroundCutout(owner, outline);
    cuts.update(scene);
    expect(area(lower.geometry)).toBeCloseTo(84, 5);
    expect(() => setTerrainGroundCutout(owner, outline, undefined, { minHeight: NaN })).toThrow();
    expect(() => setTerrainGroundCutout(owner, outline, 2, { minHeight: 3 })).toThrow();
    owner.visible = false;
    cuts.update(scene);
    expect(lower.geometry).toBe(originalLower);
    expect(upper.geometry).toBe(originalUpper);
    cuts.dispose();
    originalLower.dispose();
    originalUpper.dispose();
  });

  it('can open land and shore walls while preserving approach paving, then restore all surfaces', () => {
    const scene = new THREE.Group();
    const ground = new THREE.Mesh(plane()),
      bank = new THREE.Mesh(plane()),
      paving = new THREE.Mesh(plane());
    markTerrainGroundSurface(ground);
    markTerrainGroundSurface(bank, false);
    markTerrainPavementSurface(paving);
    scene.add(ground, bank, paving);
    const originals = [ground.geometry, bank.geometry, paving.geometry];
    const owner = new THREE.Object3D();
    const opening = [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
    ] as const;
    setTerrainGroundCutout(owner, opening, undefined, { preservePaving: true });
    scene.add(owner);
    const cuts = new TerrainGroundCutoutController();
    expect(cuts.update(scene)).toBe(true);
    expect(area(ground.geometry)).toBeLessThan(area(originals[0] as THREE.BufferGeometry));
    expect(area(bank.geometry)).toBeLessThan(area(originals[1] as THREE.BufferGeometry));
    expect(paving.geometry).toBe(originals[2]);
    setTerrainGroundCutout(owner, opening);
    expect(cuts.update(scene)).toBe(true);
    expect(paving.geometry).not.toBe(originals[2]);
    owner.visible = false;
    expect(cuts.update(scene)).toBe(true);
    [ground, bank, paving].forEach((mesh, i) => {
      expect(mesh.geometry).toBe(originals[i]);
    });
    cuts.dispose();
    for (const geometry of originals) geometry.dispose();
  });

  it('exposes mapped lakes independently of landmarks, retaining islands, roads and source grids', () => {
    const scene = new THREE.Group();
    const ground = new THREE.Mesh(plane());
    const cover = new THREE.Mesh(plane());
    const road = new THREE.Mesh(plane());
    const submerged = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2));
    markTerrainGroundSurface(submerged);
    const submergedOriginal = submerged.geometry;
    markTerrainGroundSurface(ground);
    markTerrainGroundSurface(cover);
    markTerrainGroundSurface(road, false);
    const originals = [ground.geometry, cover.geometry, road.geometry];
    scene.add(ground, cover, road, submerged);
    const field = new Heightfield(new Float32Array(4).fill(0.25), 2, 2, {
      origin: [0, 0],
      worldSize: [10, 10],
      height: { min: 0, max: 20 },
    });
    const samples = field.copySamples();
    const context = {
      address: { level: 16, x: 0, z: 0 },
      origin: [0, 0],
      tileSize: 10,
      heightfield: field,
    } as TerrainPyramidTileLayerContext;
    const tile = createEmptyTerrainSemanticTile();
    tile.water = [
      {
        polygons: [
          {
            outer: [
              [0.2, 0.2],
              [0.8, 0.2],
              [0.8, 0.8],
              [0.2, 0.8],
            ],
            holes: [
              [
                [0.4, 0.4],
                [0.6, 0.4],
                [0.6, 0.6],
                [0.4, 0.6],
              ],
            ],
          },
        ],
      },
    ];
    const native = createTerrainSemanticObject(tile, context, {
      renderBuildings: false,
      renderLandcover: false,
      renderTransportation: false,
    });
    scene.add(native);
    const water = native.getObjectByName('semantic:water') as THREE.Mesh;
    const originalWater = water.geometry;
    const controller = new TerrainGroundCutoutController();
    try {
      expect(controller.update(scene)).toBe(true);
      expect(area(ground.geometry)).toBeCloseTo(68, 5);
      expect(area(cover.geometry)).toBeCloseTo(68, 5);
      expect(road.geometry).toBe(originals[2]);
      expect(submerged.geometry).toBe(submergedOriginal);
      expect(water.geometry).toBe(originalWater);
      expect(area(water.geometry)).toBeCloseTo(32, 5);
      expect(field.copySamples()).toEqual(samples);
      expect(controller.update(scene)).toBe(false);
      native.visible = false;
      controller.update(scene);
      expect(ground.geometry).toBe(originals[0]);
      expect(cover.geometry).toBe(originals[1]);
      native.visible = true;
      controller.update(scene);
      native.removeFromParent();
      controller.update(scene);
      expect(ground.geometry).toBe(originals[0]);
      expect(cover.geometry).toBe(originals[1]);
    } finally {
      controller.dispose();
      disposeTerrainSemanticObject(native);
      for (const geometry of originals) geometry?.dispose();
      submerged.geometry.dispose();
    }
  });
  it('keeps ground and native-water openings independent and restores each visible owner', () => {
    const scene = new THREE.Group(),
      ground = new THREE.Mesh(plane()),
      water = new THREE.Mesh(plane());
    markTerrainGroundSurface(ground);
    markTerrainWaterSurface(water);
    scene.add(ground, water);
    const originalGround = ground.geometry,
      originalWater = water.geometry,
      groundOwner = new THREE.Group(),
      waterOwner = new THREE.Group();
    scene.add(groundOwner, waterOwner);
    setTerrainGroundCutout(groundOwner, square);
    const controller = new TerrainGroundCutoutController();
    try {
      controller.update(scene);
      expect(area(ground.geometry)).toBeCloseTo(84, 5);
      expect(water.geometry).toBe(originalWater);
      setTerrainWaterCutout(waterOwner, [
        [1, 1],
        [3, 1],
        [3, 3],
        [1, 3],
      ]);
      controller.update(scene);
      expect(area(ground.geometry)).toBeCloseTo(84, 5);
      expect(area(water.geometry)).toBeCloseTo(96, 5);
      waterOwner.visible = false;
      controller.update(scene);
      expect(water.geometry).toBe(originalWater);
      expect(area(ground.geometry)).toBeCloseTo(84, 5);
      groundOwner.removeFromParent();
      waterOwner.visible = true;
      controller.update(scene);
      expect(ground.geometry).toBe(originalGround);
      expect(area(water.geometry)).toBeCloseTo(96, 5);
      waterOwner.removeFromParent();
      controller.update(scene);
      expect(water.geometry).toBe(originalWater);
    } finally {
      controller.dispose();
      ground.geometry.dispose();
      water.geometry.dispose();
    }
  });
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
    expect(cut.groups).toEqual([{ start: 0, count: cut.index?.count, materialIndex: 2 }]);
  });
  it('retains an indexed elevation grid within a bounded memory overhead for small openings', () => {
    const source = new THREE.PlaneGeometry(200, 200, 40, 40)
      .rotateX(-Math.PI / 2)
      .translate(100, 0, 100);
    const bytes = (g: THREE.BufferGeometry) =>
      Object.values(g.attributes).reduce((sum, a) => sum + a.array.byteLength, 0) +
      (g.index?.array.byteLength ?? 0);
    const cut = subtractTerrainGroundGeometry(source, [square]);
    expect(area(cut)).toBeCloseTo(40000 - 16, 4);
    expect(cut.index).not.toBeNull();
    expect(bytes(cut)).toBeLessThan(bytes(source) * 1.5);
    source.dispose();
    cut.dispose();
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
  it('spends at most its budget on cuts after the first, finishing in later updates', () => {
    const root = new THREE.Group(),
      first = new THREE.Mesh(plane()),
      second = new THREE.Mesh(plane()),
      owner = new THREE.Group();
    second.position.x = 20;
    for (const mesh of [first, second]) markTerrainGroundSurface(mesh);
    root.add(first, second, owner);
    setTerrainGroundCutouts(owner, [
      square,
      square.map(([x, z]) => [x + 20, z] as [number, number]),
    ]);
    const sources = [first.geometry, second.geometry];
    const controller = new TerrainGroundCutoutController();
    expect(controller.update(root, 0)).toBe(true);
    expect(controller.pending).toBe(true);
    expect([first.geometry !== sources[0], second.geometry !== sources[1]]).toEqual([true, false]);
    expect(controller.update(root, 0)).toBe(true);
    expect(controller.pending).toBe(false);
    expect(second.geometry).not.toBe(sources[1]);
    expect(controller.update(root, 0)).toBe(false);
    controller.dispose();
  });
  it('keeps a cut through floating-origin rebases', () => {
    const world = new THREE.Group(),
      ground = new THREE.Mesh(plane()),
      owner = new THREE.Group();
    markTerrainGroundSurface(ground);
    world.add(ground, owner);
    ground.position.set(0.1, 0, 0.3);
    ground.rotation.y = 0.3;
    owner.position.set(5.123, 0, 4.987);
    owner.rotation.y = 0.7;
    setTerrainGroundCutout(
      owner,
      square.map(([x, z]) => [(x - 5) / 3, (z - 5) / 3]),
    );
    const scene = new THREE.Group();
    scene.add(world);
    const controller = new TerrainGroundCutoutController();
    expect(controller.update(scene)).toBe(true);
    const cut = ground.geometry;
    // Moves both through world space; the round trip into the ground's frame differs in its last
    // digits, which must not make the same cut again.
    for (const [x, z] of [
      [1234.567, -891.011],
      [-31415.9265, 27182.818],
      [0.1, 0.2],
    ] as const) {
      world.position.set(x, 0, z);
      expect(controller.update(scene)).toBe(false);
      expect(ground.geometry).toBe(cut);
    }
    controller.dispose();
  });
  it('keeps the ground between separate openings and replaces all openings atomically', () => {
    const root = new THREE.Group(),
      ground = new THREE.Mesh(plane()),
      owner = new THREE.Group(),
      controller = new TerrainGroundCutoutController();
    root.add(ground, owner);
    markTerrainGroundSurface(ground);
    const source = ground.geometry,
      positions = Array.from(source.getAttribute('position').array),
      left: [number, number][] = [
        [1, 1],
        [3, 1],
        [3, 3],
        [1, 3],
      ],
      right: [number, number][] = [
        [7, 1],
        [9, 1],
        [9, 3],
        [7, 3],
      ];
    setTerrainGroundCutouts(owner, [left, right]);
    controller.update(root);
    expect(area(ground.geometry)).toBeCloseTo(92, 4);
    const ray = new THREE.Raycaster(new THREE.Vector3(5, 100, 2), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(ground).length).toBeGreaterThan(0);
    expect(Array.from(source.getAttribute('position').array)).toEqual(positions);
    expect(() => setTerrainGroundCutouts(owner, [left, []])).toThrow('vertices');
    expect(controller.update(root)).toBe(false);
    setTerrainGroundCutout(owner, left);
    controller.update(root);
    expect(area(ground.geometry)).toBeCloseTo(96, 4);
    owner.visible = false;
    controller.update(root);
    expect(ground.geometry).toBe(source);
    controller.dispose();
  });
  it('applies a ceiling per outline (tunnel segments in one owner)', () => {
    // The plane rises as y = 2x + 3z: the first square's ground is 5-10 m, the second's 30-35 m.
    const ring = (x: number): [number, number][] => [
      [x, x],
      [x + 1, x],
      [x + 1, x + 1],
      [x, x + 1],
    ];
    const removed = (ceilings: number[]): number => {
      const root = new THREE.Group(),
        ground = new THREE.Mesh(plane()),
        owner = new THREE.Group();
      markTerrainGroundSurface(ground);
      root.add(ground, owner);
      setTerrainGroundCutouts(owner, [ring(1), ring(6)], undefined, { ceilings });
      const controller = new TerrainGroundCutoutController();
      controller.update(root);
      const left = area(ground.geometry);
      controller.dispose();
      return 100 - left;
    };
    expect(removed([4, 4])).toBeCloseTo(0, 5);
    expect(removed([4, 100])).toBeCloseTo(1, 5);
    expect(removed([100, 100])).toBeCloseTo(2, 5);
    expect(() =>
      setTerrainGroundCutouts(new THREE.Group(), [ring(1)], undefined, { ceilings: [1, 2] }),
    ).toThrow('one finite height per outline');
  });
  it('keeps its cuts while the world above the root moves (a floating origin)', () => {
    const world = new THREE.Group(),
      root = new THREE.Group(),
      tile = new THREE.Group(),
      ground = new THREE.Mesh(plane()),
      owner = new THREE.Group();
    markTerrainGroundSurface(ground);
    world.add(root);
    root.add(tile);
    tile.add(ground, owner);
    tile.position.set(100, 0, 50);
    setTerrainGroundCutout(owner, square);
    const controller = new TerrainGroundCutoutController();
    world.updateMatrixWorld(true);
    expect(controller.update(root)).toBe(true);
    const cut = ground.geometry;
    for (let step = 1; step <= 3; step++) {
      world.position.set(step * 1234.567, 0, -step * 89.01);
      world.updateMatrixWorld(true);
      expect(controller.update(root)).toBe(false);
      expect(ground.geometry).toBe(cut);
    }
    // A placement within the root still re-cuts.
    owner.position.x = 1;
    world.updateMatrixWorld(true);
    expect(controller.update(root)).toBe(true);
    expect(ground.geometry).not.toBe(cut);
    controller.dispose();
  });
  it('copies refreshed normals from the retained grid onto its cut without cutting again', () => {
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
    // Neighbors refresh border normals as they load: the cut stands and takes the new normals.
    expect(controller.update(root)).toBe(false);
    expect(ground.geometry).toBe(old);
    expect(ground.geometry.getAttribute('normal').getY(0)).toBe(1);
    expect(ground.geometry.getAttribute('normal').getY(normals.count - 1)).toBe(1);
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
    const view: TerrainPyramidView = { position: [8, 20, 8], verticalFov: 1, viewportHeight: 500 };
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
        initialView: view,
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
    // Cuts after the first in a pass share a time budget, and each stream update (a host's
    // frame) makes another pass. Eight cover every tile's surface and land cover on a slow CPU.
    const settle = async () => {
      await stream.whenIdle();
      for (let frame = 0; frame < 8; frame++) stream.update(view);
    };
    try {
      await settle();
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(total()).toBeCloseTo(240, 5);
      expect(total('semantic:landcover')).toBeCloseTo(240, 5);
      stream.setLayerVisible('stadium', false);
      await settle();
      expect(total()).toBeCloseTo(256, 5);
      expect(total('semantic:landcover')).toBeCloseTo(256, 5);
      stream.setLayerVisible('stadium', true);
      await settle();
      expect(total()).toBeCloseTo(240, 5);
      expect(total('semantic:landcover')).toBeCloseTo(240, 5);
    } finally {
      stream.dispose();
    }
  });
});
