import { WalkCollision, WalkController } from '@bendyline/molen-client/navigation';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { describe, expect, it, vi } from 'vitest';
import { markTerrainGroundSurface, TerrainGroundCutoutController } from '../src/ground-cutout';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import {
  createEmptyTerrainSemanticTile,
  type TerrainTransportationFeature,
} from '../src/semantic-types';
import {
  createTerrainTunnelObject,
  sampleTerrainTunnel,
  setTerrainSurfacePassages,
  withTerrainTunnels,
} from '../src/tunnels';

/**
 * Level ground at `low`, and a hill 70 m higher from `from` to `to` meters across the tile, with
 * cliffs 5 m wide: a bore between the cliffs' feet runs under the hill on its straight grade.
 */
function plateau(low: number, from = 10, to = 190): (x: number) => number {
  return (x) => low + 70 * Math.max(0, Math.min(1, Math.min(x - from, to - x) / 5));
}
/** A tile's ground, from its height across the tile (`x` in tile meters) on a 5 m grid. */
function field(origin: [number, number], ground: (x: number) => number): Heightfield {
  const side = 41;
  const samples = new Float32Array(side * side);
  for (let row = 0; row < side; row++)
    for (let column = 0; column < side; column++)
      samples[row * side + column] = ground(column * 5) / 100;
  return new Heightfield(samples, side, side, {
    origin,
    worldSize: [200, 200],
    height: { min: 0, max: 100 },
  });
}
function context(
  x = 0,
  height = 10,
  ground: (x: number) => number = plateau(height),
): TerrainPyramidTileLayerContext {
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
    heightfield: field(origin, ground),
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
/** The road continuing above ground from a portal: ordinary lines along v = 0.5. */
function surfacing(result: ReturnType<typeof tile>, ...spans: Array<[number, number]>) {
  result.transportation.push({
    class: 'highway',
    width: 12,
    lines: spans.map(([from, to]) => [
      [from, 0.5],
      [to, 0.5],
    ]),
  });
  return result;
}
function ground(shape: (x: number) => number = plateau(10)) {
  const geometry = new THREE.PlaneGeometry(200, 200, 40, 40)
    .rotateX(-Math.PI / 2)
    .translate(100, 0, 100);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, shape(p.getX(i)));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  markTerrainGroundSurface(mesh);
  return mesh;
}

describe('mapped tunnels', () => {
  it.each([
    false,
    true,
  ])('walks through a hill and out both portals (covered terrain=%s)', (covered) => {
    const root = new THREE.Group(),
      surface = ground();
    root.add(surface, createTerrainTunnelObject(tile(), context()));
    // The above-ground road meets each portal at the same pavement lift as the bore.
    for (const x of [5, 195]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 12).rotateX(-Math.PI / 2));
      road.position.set(x, 10.32, 100);
      root.add(road);
    }
    if (covered) {
      // Full landcover replaces the DEM visually. Only the cover receives portal cuts;
      // the hidden original grid must not remain an invisible collision wall.
      surface.layers.disableAll();
      const cover = ground();
      cover.name = 'semantic:landcover';
      root.add(cover);
    }
    const cuts = new TerrainGroundCutoutController();
    cuts.update(root);
    const collision = new WalkCollision(),
      walker = new WalkController();
    const surfaceHeight = plateau(10);
    const supportHeight = (x: number, z: number): number =>
      sampleTerrainTunnel(root, x, walker.feet.y, z)?.floor ?? surfaceHeight(x);
    walker.reset(5, 100);
    collision.update(root, walker.feet.x, walker.feet.z);
    expect(walker.place(collision, surfaceHeight)).toBe(true);
    const move = (target: number, forward: number): void => {
      for (let frame = 0; frame < 3200 && (target - walker.feet.x) * forward > 0; frame++) {
        collision.update(root, walker.feet.x, walker.feet.z);
        walker.update(
          1 / 60,
          { forward, right: 0, yaw: 0, sprint: true, jump: false },
          collision,
          supportHeight,
        );
        expect(walker.feet.y).toBeGreaterThan(9.9);
        expect(walker.feet.y).toBeLessThan(10.5);
        expect(walker.waitingForTerrain).toBe(false);
      }
      expect(walker.feet.x).toBeCloseTo(target, 0);
    };
    move(195, 1);
    move(5, -1);
    // Above-ground placement must still land on the hill, not in the bore below it.
    walker.reset(100, 100);
    collision.update(root, walker.feet.x, walker.feet.z);
    expect(walker.place(collision, surfaceHeight)).toBe(true);
    expect(walker.feet.y).toBeCloseTo(80.02);
    walker.update(
      1 / 60,
      { forward: 0, right: 0, yaw: 0, sprint: false, jump: false },
      collision,
      supportHeight,
    );
    expect(walker.feet.y).toBeCloseTo(80, 1);
    collision.clear();
    cuts.dispose();
  });

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
    // Under a translated tile group, as in a stream; and under a turned one, via its matrices.
    const placed = new THREE.Group(),
      tileGroup = new THREE.Group(),
      inner = createTerrainTunnelObject(tile(), context());
    tileGroup.position.set(500, 2, 300);
    tileGroup.add(inner);
    placed.add(tileGroup);
    expect(sampleTerrainTunnel(placed, 600, 15, 400)?.floor).toBeCloseTo(12.32);
    expect(sampleTerrainTunnel(placed, 100, 13, 100)).toBeUndefined();
    const turned = new THREE.Group(),
      spun = new THREE.Group(),
      other = createTerrainTunnelObject(tile(), context());
    spun.rotation.y = Math.PI;
    spun.add(other);
    turned.add(spun);
    expect(sampleTerrainTunnel(turned, -100, 13, -100)?.floor).toBeCloseTo(10.32);
  });

  it('answers the same for a root asked thousands of times while bores come, move out and go', () => {
    // A stream as an aircraft's ground probes see it: tiles at fixed translations under one root.
    const root = new THREE.Group();
    const place = (x: number): { layer: THREE.Group; bore: THREE.Group } => {
      const layer = new THREE.Group(),
        bore = createTerrainTunnelObject(tile(), context());
      layer.position.set(x, 0, 0);
      layer.add(bore);
      return { layer, bore };
    };
    const first = place(0);
    root.add(first.layer);
    expect(sampleTerrainTunnel(root, 100, 13, 100)?.floor).toBeCloseTo(10.32);
    // Elsewhere: its place is known now, and the answer does not depend on having looked.
    for (let i = 0; i < 2000; i++)
      expect(sampleTerrainTunnel(root, 900 + i, 13, 100)).toBeUndefined();
    expect(sampleTerrainTunnel(root, 100, 13, 100)?.floor).toBeCloseTo(10.32);
    // A bore prepared before the root was first asked, attached after: found at once.
    const second = place(400);
    expect(sampleTerrainTunnel(root, 500, 13, 100)).toBeUndefined();
    root.add(second.layer);
    expect(sampleTerrainTunnel(root, 500, 13, 100)?.floor).toBeCloseTo(10.32);
    expect(sampleTerrainTunnel(root, 100, 13, 100)?.floor).toBeCloseTo(10.32);
    // One made after many questions is found too.
    const third = place(800);
    root.add(third.layer);
    expect(sampleTerrainTunnel(root, 900, 13, 100)?.floor).toBeCloseTo(10.32);
    // An evicted tile keeps its known place but no longer answers; nor does a hidden one.
    root.remove(first.layer);
    expect(sampleTerrainTunnel(root, 100, 13, 100)).toBeUndefined();
    second.layer.visible = false;
    expect(sampleTerrainTunnel(root, 500, 13, 100)).toBeUndefined();
    second.layer.visible = true;
    expect(sampleTerrainTunnel(root, 500, 13, 100)?.floor).toBeCloseTo(10.32);
    // Another root sees none of them where this one placed them.
    const other = new THREE.Group();
    expect(sampleTerrainTunnel(other, 900, 13, 100)).toBeUndefined();
    expect(sampleTerrainTunnel(root, 900, 13, 100)?.floor).toBeCloseTo(10.32);
  });

  it('joins buffered neighboring fragments before grading; the same seam has the same floor', async () => {
    const left = surfacing(tile(0.1, 1.015625), [0, 0.1]),
      right = surfacing(tile(-0.015625, 0.9), [0.9, 1]);
    const source = {
      load: vi.fn(async (address: { x: number; z: number }) =>
        address.z ? undefined : address.x === 0 ? left : address.x === 1 ? right : undefined,
      ),
    };
    // A ridge over the seam: the bore rises from its western portal to its eastern one under it.
    const ridge = (x: number) =>
      x
        ? (lx: number) => 20 + 70 * Math.max(0, Math.min(1, (180 - lx) / 5))
        : (lx: number) => 10 + 70 * Math.max(0, Math.min(1, (lx - 20) / 5));
    const heights = {
      load: vi.fn(
        async (address: { x: number }) =>
          context(address.x, address.x ? 20 : 10, ridge(address.x)).heightfield,
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
      const ctx = context(x, x ? 20 : 10, ridge(x)),
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

  it('grades only between portals where the route surfaces, not at gaps between buried fragments', async () => {
    const inner = { createTile: vi.fn(() => new THREE.Group()) };
    const heights = { load: vi.fn(async () => undefined) };
    const renderer = withTerrainTunnels(inner, { load: vi.fn(async () => undefined) }, heights, 2);
    // Both ends lie inside the tile, but no ordinary road continues from them.
    const hill = context(0, 10, plateau(10, 20, 180));
    const buried = await renderer.createTile(tile(0.1, 0.9), hill);
    expect(buried?.getObjectByName('terrain:tunnels')?.children).toHaveLength(0);
    // The same bore whose road surfaces at each end is graded between those portals.
    const portals = await renderer.createTile(surfacing(tile(0.1, 0.9), [0, 0.1], [0.9, 1]), hill);
    const root = new THREE.Group();
    if (portals) root.add(portals);
    expect(sampleTerrainTunnel(root, 100, 13, 100)?.floor).toBeCloseTo(10.32);
  });

  it('omits an authored surface passage only when the renderer supplies its exact map ID', async () => {
    const id = 35185020923307;
    const input = surfacing(tile(0.1, 0.9), [0, 0.1], [0.9, 1]);
    const [passage] = input.transportation;
    if (!passage) throw new Error('missing test passage');
    passage.id = id;
    const adjacent: TerrainTransportationFeature = {
      ...passage,
      id: id + 1,
      lines: [
        [
          [0.1, 0.8],
          [0.9, 0.8],
        ],
      ],
    };
    input.transportation.push(adjacent);
    for (const line of [
      [
        [0, 0.8],
        [0.1, 0.8],
      ],
      [
        [0.9, 0.8],
        [1, 0.8],
      ],
    ] as typeof adjacent.lines)
      input.transportation.push({ ...adjacent, id: id + 2, tunnel: false, lines: [line] });
    let loaded = true;
    const inner = {
      createTile: () => {
        const group = new THREE.Group();
        if (loaded) setTerrainSurfacePassages(group, new Set([id]));
        return group;
      },
    };
    const blank = { load: vi.fn(async () => undefined) };
    const renderer = withTerrainTunnels(inner, blank, blank, 2);
    for (const modelLoaded of [true, false]) {
      loaded = modelLoaded;
      const root = new THREE.Group();
      const object = await renderer.createTile(input, context(0, 10, plateau(10, 20, 180)));
      if (!object) throw new Error('missing tile');
      root.add(object);
      const supported = sampleTerrainTunnel(root, 100, 13, 100);
      if (modelLoaded) expect(supported).toBeUndefined();
      else expect(supported?.floor).toBeCloseTo(10.32);
      expect(sampleTerrainTunnel(root, 100, 13, 160)?.floor).toBeCloseTo(10.32);
      expect(input.transportation[0]?.tunnel).toBe(true);
      renderer.disposeTile?.(object);
    }
  });

  it('takes a bore under level ground down at its grade, open to the sky until it is covered', () => {
    // No cutting at its portals: the bore starts on the ground and falls at 8% from each.
    const root = new THREE.Group();
    root.add(
      createTerrainTunnelObject(
        tile(),
        context(0, 10, () => 10),
      ),
    );
    root.updateMatrixWorld(true);
    const near = sampleTerrainTunnel(root, 20, 10, 100);
    expect(near?.floor).toBeCloseTo(10.32 - 0.8, 2);
    // An open cutting: retaining walls to the ground and a 0.9 m parapet, and no roof.
    expect(near?.ceiling).toBeGreaterThanOrEqual(10.9 - 0.01);
    expect(near?.ceiling).toBeLessThan(11.1);
    const up = new THREE.Raycaster(new THREE.Vector3(20, 10.5, 100), new THREE.Vector3(0, 1, 0));
    expect(up.intersectObject(root, true)).toHaveLength(0);
    // Its middle is as deep as its grade takes it from both portals.
    expect(sampleTerrainTunnel(root, 100, 4, 100)?.floor).toBeCloseTo(10.32 - 0.08 * 90, 1);
    // A hill keeps the straight grade of old.
    const hill = new THREE.Group();
    hill.add(createTerrainTunnelObject(tile(), context()));
    expect(sampleTerrainTunnel(hill, 100, 13, 100)?.floor).toBeCloseTo(10.32);
  });

  it('begins a bore at the floor of the cuttings its approaches were cut down to', () => {
    // A grading cut each approach 8.32 m: the clear height, cover and pavement under the ground.
    const root = new THREE.Group();
    const portalGround = vi.fn((x: number) => (x < 100 ? 10 - 8.32 : 10 - 8.32));
    root.add(
      createTerrainTunnelObject(
        tile(),
        context(0, 10, () => 10),
        undefined,
        { portalGround },
      ),
    );
    root.updateMatrixWorld(true);
    expect(portalGround).toHaveBeenCalledWith(10, 100);
    for (const x of [12, 100, 188]) {
      const inside = sampleTerrainTunnel(root, x, 3, 100);
      expect(inside?.floor).toBeCloseTo(2, 2);
      expect(inside?.ceiling).toBeCloseTo(8.5, 2);
    }
    // Under cover from its portal on: the roof under the ground, and a face over the opening.
    const up = new THREE.Raycaster(new THREE.Vector3(12, 3, 100), new THREE.Vector3(0, 1, 0));
    expect(up.intersectObject(root, true)[0]?.point.y).toBeCloseTo(8.5, 2);
    const ahead = new THREE.Raycaster(new THREE.Vector3(5, 9.5, 100), new THREE.Vector3(1, 0, 0));
    expect(ahead.intersectObject(root, true)[0]?.distance).toBeCloseTo(5, 2);
  });

  it('keeps a lid under a road that crosses an open stretch at grade', () => {
    const input = surfacing(tile(0.3, 0.7), [0, 0.3], [0.7, 1]);
    // A motorway across the bore's middle, on the ground.
    const motorway: TerrainTransportationFeature = {
      class: 'highway',
      subclass: 'motorway',
      width: 10,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    };
    input.transportation.push(motorway);
    const root = new THREE.Group();
    root.add(
      createTerrainTunnelObject(
        input,
        context(0, 10, () => 10),
        undefined,
        {
          crossings: input.transportation,
        },
      ),
    );
    root.updateMatrixWorld(true);
    // Under the motorway: a lid just under its road.
    const under = sampleTerrainTunnel(root, 100, 8, 100);
    // As deep as its grade takes it from both portals (the floor read between 6 m stations).
    expect(Math.abs((under?.floor ?? 0) - (10.32 - 0.08 * 40))).toBeLessThan(0.3);
    const lid = new THREE.Raycaster(new THREE.Vector3(100, 8, 100), new THREE.Vector3(0, 1, 0));
    expect(lid.intersectObject(root, true)[0]?.point.y).toBeCloseTo(10 - 0.4, 1);
    // Away from it the stretch is open.
    const open = new THREE.Raycaster(new THREE.Vector3(70, 10.5, 100), new THREE.Vector3(0, 1, 0));
    expect(open.intersectObject(root, true)).toHaveLength(0);
  });

  it('never stands over the road a short underpass with no cutting passes under', () => {
    // 20 m under a motorway on level ground, its approaches not cut: it cannot get under.
    const input = surfacing(tile(0.45, 0.55), [0, 0.45], [0.55, 1]);
    input.transportation.push({
      class: 'highway',
      subclass: 'motorway',
      width: 10,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    });
    const root = new THREE.Group();
    root.add(
      createTerrainTunnelObject(
        input,
        context(0, 10, () => 10),
        undefined,
        {
          crossings: input.transportation,
        },
      ),
    );
    root.updateMatrixWorld(true);
    // From above, nothing of it stands higher than a parapet over the ground; under the
    // motorway, nothing over its pavement (0.32 m over the ground).
    for (let x = 90; x <= 110; x += 2) {
      const down = new THREE.Raycaster(new THREE.Vector3(x, 50, 100), new THREE.Vector3(0, -1, 0));
      const top = down.intersectObject(root, true)[0]?.point.y ?? 0;
      expect(top).toBeLessThanOrEqual(10 + 0.9 + 0.01);
      if (x >= 96 && x <= 104) expect(top).toBeLessThan(10 + 0.32);
    }
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
