import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { describe, expect, it } from 'vitest';
import { HarborCruising, type HarborCruisingKind } from '../src/client/harbor-cruising';
import { HarborPolygon, type HarborRing, harborRectsOverlap } from '../src/client/harbor-geometry';
import {
  type HarborBoatKind,
  type HarborMooring,
  type HarborTileShapes,
  harborDockWidth,
  placeHarborMoorings,
} from '../src/client/harbor-moorings';
import {
  clearanceField,
  dockDecks,
  EarthHarbors,
  earthHarborKinds,
  modelParts,
  proxyBoatGeometry,
} from '../src/client/harbors';

const ring = (points: [number, number][]): HarborRing => new Float64Array(points.flat());
const rect = (x0: number, z0: number, x1: number, z1: number): HarborRing =>
  ring([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);

const KINDS: HarborBoatKind[] = [
  {
    id: 'speedboat',
    length: 6.6,
    width: 2.6,
    weights: { marina: 0.9, private: 1, commercial: 0.2 },
    paints: ['#333e3d', '#e8e4d8'],
  },
  {
    id: 'sailboat',
    length: 10.7,
    width: 3.6,
    weights: { marina: 1, private: 0.35, commercial: 0.1 },
    paints: [],
  },
];

function run(shapes: HarborTileShapes, kinds = KINDS): HarborMooring[] {
  const work = placeHarborMoorings(shapes, kinds);
  for (;;) {
    const step = work.next();
    if (step.done === true) return step.value;
  }
}

/** A 400 m square of lake with the given docks; a marina point at its middle unless `private`. */
function lake(
  docks: HarborRing[],
  options: { private?: boolean; solids?: HarborRing[] } = {},
): HarborTileShapes {
  return {
    origin: [0, 0],
    size: 400,
    water: [{ polygon: new HarborPolygon([rect(-50, -50, 450, 450)]), height: 6.65 }],
    docks: docks.map((d) => ({ polygon: new HarborPolygon([d]), width: harborDockWidth(d) })),
    dockLines: [],
    solids: (options.solids ?? []).map((s) => new HarborPolygon([s])),
    anchors: options.private ? [] : [{ x: 200, z: 200, radius: 450, occupancy: 0.85 }],
  };
}

function hullClear(m: HarborMooring, shapes: HarborTileShapes): void {
  const fx = Math.sin(m.yaw);
  const fz = Math.cos(m.yaw);
  for (const [a, b] of [
    [0.9, 0],
    [-0.9, 0],
    [0, 0.9],
    [0, -0.9],
  ] as const) {
    const x = m.x + fx * (m.length / 2) * a + fz * (m.width / 2) * b;
    const z = m.z + fz * (m.length / 2) * a - fx * (m.width / 2) * b;
    expect(shapes.water.some((w) => w.polygon.contains(x, z))).toBe(true);
    expect(shapes.docks.some((d) => d.polygon.contains(x, z))).toBe(false);
    expect(shapes.solids.some((s) => s.contains(x, z))).toBe(false);
  }
}

describe('harbor geometry', () => {
  it('answers membership with holes and overlap of turned rectangles', () => {
    const polygon = new HarborPolygon([rect(0, 0, 100, 100), rect(40, 40, 60, 60)]);
    expect(polygon.contains(10, 10)).toBe(true);
    expect(polygon.contains(50, 50)).toBe(false);
    expect(polygon.contains(150, 50)).toBe(false);
    expect(polygon.near(101, 50, 2)).toBe(true);
    expect(polygon.near(105, 50, 2)).toBe(false);
    expect(polygon.crossings(50, [])).toEqual([0, 40, 60, 100]);
    const a = { x: 0, z: 0, yaw: 0, halfLength: 5, halfWidth: 1.5 };
    expect(harborRectsOverlap(a, { ...a, x: 2.9 })).toBe(true);
    expect(harborRectsOverlap(a, { ...a, x: 3.2 })).toBe(false);
    expect(harborRectsOverlap(a, { ...a, x: 4, yaw: Math.PI / 2 })).toBe(true);
  });

  it('measures open water outward from the nearest obstacle', () => {
    const heights = new Float32Array(128 * 128).fill(5);
    heights[64 * 128 + 64] = Number.NaN;
    const field = clearanceField(heights, 2);
    expect(field[64 * 128 + 64]).toBe(0);
    expect(field[64 * 128 + 65]).toBeCloseTo(2);
    expect(field[64 * 128 + 74]).toBeCloseTo(20);
    expect(field[70 * 128 + 70]).toBeCloseTo(6 * Math.SQRT2 * 2, 3);
  });
});

describe('harbor moorings', () => {
  it('fills a long marina walk with slips, every hull on water, clear of the dock and of each other', () => {
    const shapes = lake([rect(100, 199, 220, 201.5)]);
    const moorings = run(shapes);
    expect(moorings.length).toBeGreaterThan(20);
    for (const m of moorings) {
      hullClear(m, shapes);
      // Bow- or stern-in: square to the walk (which runs along X).
      expect(Math.abs(Math.sin(m.yaw))).toBeLessThan(0.01);
      expect(m.y).toBe(6.65);
    }
    for (let i = 0; i < moorings.length; i++)
      for (let j = i + 1; j < moorings.length; j++) {
        const a = moorings[i] as HarborMooring;
        const b = moorings[j] as HarborMooring;
        expect(
          harborRectsOverlap(
            { x: a.x, z: a.z, yaw: a.yaw, halfLength: a.length / 2, halfWidth: a.width / 2 },
            { x: b.x, z: b.z, yaw: b.yaw, halfLength: b.length / 2, halfWidth: b.width / 2 },
          ),
        ).toBe(false);
      }
    // The same berths every time, and both sides of the walk used.
    expect(run(shapes)).toEqual(moorings);
    expect(moorings.some((m) => m.z < 199)).toBe(true);
    expect(moorings.some((m) => m.z > 201.5)).toBe(true);
    expect(new Set(moorings.map((m) => m.key)).size).toBe(moorings.length);
  });

  it('ties boats alongside mapped fingers and keeps a private dock sparse', () => {
    // A walk along X with five 12 m fingers reaching south (+Z), 7 m apart.
    const comb: [number, number][] = [
      [100, 196],
      [140, 196],
    ];
    for (let k = 4; k >= 0; k--) {
      const x = 102 + k * 7;
      comb.push([x + 1.2, 198]);
      comb.push([x + 1.2, 210]);
      comb.push([x, 210]);
      comb.push([x, 198]);
    }
    comb.push([100, 198]);
    const marina = lake([ring(comb)]);
    const moorings = run(marina);
    for (const m of moorings) hullClear(m, marina);
    // Boats beside the fingers lie along them (heading along Z).
    const beside = moorings.filter((m) => m.z > 199 && m.z < 212 && m.x > 101 && m.x < 132);
    expect(beside.length).toBeGreaterThan(2);
    for (const m of beside) expect(Math.abs(Math.cos(m.yaw))).toBeGreaterThan(0.99);

    const walk = [rect(100, 199, 220, 201.5)];
    const busy = run(lake(walk)).length;
    const sparse = run(lake(walk, { private: true })).length;
    expect(sparse).toBeGreaterThan(0);
    expect(sparse).toBeLessThan(busy / 2);
    // A dock with fingers is a marina's even where no marina point reaches (a big marina's far
    // end, or across a tile edge): it fills close to the anchored rate.
    const fingered = run(lake([ring(comb)], { private: true })).length;
    expect(fingered).toBeGreaterThanOrEqual(moorings.length * 0.8);
  });

  it('keeps hulls off floating homes and lets a neighboring tile own berths past its edge', () => {
    const walk = rect(100, 199, 220, 201.5);
    const home = rect(120, 202.5, 140, 214);
    const shapes = lake([walk], { solids: [home] });
    const moorings = run(shapes);
    for (const m of moorings) hullClear(m, shapes);
    expect(moorings.some((m) => m.x > 117 && m.x < 143 && m.z > 201.5)).toBe(false);
    // A tile 210 m a side ends partway down the walk: its neighbor owns the berths beyond.
    const all = run(lake([walk]));
    const owned = run({ ...lake([walk]), origin: [0, 0], size: 210 });
    expect(all.some((m) => m.x >= 210)).toBe(true);
    expect(owned.length).toBeGreaterThan(0);
    for (const m of owned) expect(m.x < 210 && m.z < 210).toBe(true);
  });

  it('moors nothing at a dock facing only land, or where no water is mapped', () => {
    const shapes: HarborTileShapes = {
      ...lake([rect(100, 100, 160, 103)]),
      water: [{ polygon: new HarborPolygon([rect(300, 300, 400, 400)]), height: 0 }],
    };
    expect(run(shapes)).toEqual([]);
    expect(run({ ...shapes, water: [] })).toEqual([]);
  });
});

describe('harbor cruising', () => {
  const kinds: HarborCruisingKind[] = [
    {
      id: 'speedboat',
      length: 6.6,
      width: 2.6,
      cruise: 12,
      turnRate: 0.4,
      clearance: 10,
      weight: 1,
      sails: false,
      planing: true,
      paints: [],
    },
    {
      id: 'sailboat',
      length: 10.7,
      width: 3.6,
      cruise: 4,
      turnRate: 0.2,
      clearance: 14,
      weight: 1,
      sails: true,
      planing: false,
      paints: [],
    },
  ];
  // A round lake 700 m across.
  const sample = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    return r < 350 ? { height: 4, clearance: 350 - r } : { height: 0, clearance: 0 };
  };

  it('keeps boats under way on open water, turning them off the shore', () => {
    const cruising = new HarborCruising(kinds, 7);
    const budget = { count: 6, near: 50, far: 300, keep: 900 };
    let turned = 0;
    for (let t = 0; t < 2400; t++) {
      cruising.step(0.1, [0, 50, 0], sample, budget);
      for (const boat of cruising.boats) {
        expect(sample(boat.x, boat.z).clearance).toBeGreaterThan(2);
        expect(boat.y).toBe(4);
        if (Math.abs(boat.turn) > 0.05) turned++;
      }
    }
    expect(cruising.boats).toHaveLength(6);
    expect(cruising.boats.every((b) => b.speed > 0.5)).toBe(true);
    expect(turned).toBeGreaterThan(0);
    cruising.step(0.1, [5000, 50, 5000], sample, budget);
    expect(cruising.boats).toHaveLength(0);
  });

  it('spawns nothing where no water is known', () => {
    const cruising = new HarborCruising(kinds, 3);
    for (let t = 0; t < 50; t++)
      cruising.step(0.1, [0, 50, 0], () => undefined, { count: 4, near: 50, far: 300, keep: 900 });
    expect(cruising.boats).toHaveLength(0);
  });
});

describe('EarthHarbors', () => {
  const context = (size = 400): TerrainPyramidTileLayerContext => ({
    address: { level: 15, x: 0, z: 0 },
    pyramid: {} as TerrainPyramidTileLayerContext['pyramid'],
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(new Float32Array(9).fill(0.2), 3, 3, {
      origin: [0, 0],
      worldSize: [size, size],
      height: { min: 0, max: 10 },
    }),
    origin: [0, 0],
    tileSize: size,
    surfaceResolution: 3,
    signal: new AbortController().signal,
  });
  const u = (meters: number): number => meters / 400;
  const tile = (): TerrainSemanticTile => ({
    format: 'molen/terrain-semantics@1',
    landcover: [
      {
        class: 'pier',
        polygons: [
          {
            outer: [
              [u(100), u(199)],
              [u(220), u(199)],
              [u(220), u(201.5)],
              [u(100), u(201.5)],
            ],
          },
        ],
      },
    ],
    water: [
      {
        class: 'water',
        polygons: [
          {
            outer: [
              [-0.1, -0.1],
              [1.1, -0.1],
              [1.1, 1.1],
              [-0.1, 1.1],
            ],
          },
        ],
      },
    ],
    transportation: [],
    buildings: [],
    pois: [{ class: 'marina', point: [0.5, 0.5], name: 'Test Marina' }],
  });
  /** A stand-in content model: hull, painted stripe, sail, and an interior helm left off. */
  const model = (): THREE.Object3D => {
    const root = new THREE.Group();
    const body = new THREE.Group();
    body.name = 'body';
    const part = (name: string, material: string, y: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 6),
        new THREE.MeshStandardMaterial({ name: material, color: '#e8e5d9' }),
      );
      mesh.name = name;
      mesh.position.y = y;
      return mesh;
    };
    body.add(
      part('body-ivory', 'ivory', 0.5),
      part('body-vehicle-paint-and-trim', 'vehicle-paint-and-trim', 0.8),
      part('body-sail-cloth', 'sail-cloth', 6),
    );
    const helm = new THREE.Group();
    helm.name = 'helm';
    helm.add(part('helm-marine-console', 'marine-console', 1.2));
    root.add(body, helm);
    return root;
  };

  it('compiles a tile over frames, moors boats, draws them and blocks a boat driven into one', async () => {
    const parent = new THREE.Group();
    const loads: string[] = [];
    const harbors = new EarthHarbors({
      parent,
      boats: [
        { id: 'speedboat', length: 6.6, width: 2.6, height: 1.45, cruise: 12, waterway: 'channel' },
        { id: 'ferry', length: 40, width: 12, height: 10, cruise: 8, waterway: 'ferry' },
      ],
      paints: (type) => (type === 'speedboat' ? ['#333e3d'] : []),
      loadModel: async (type) => {
        loads.push(type);
        return model();
      },
    });
    const object = new THREE.Group();
    harbors.added(object, tile(), context());
    for (
      let i = 0;
      i < 200 && harbors.stats().tiles > 0 && harbors.sample(150, 150) === undefined;
      i++
    )
      harbors.update(1 / 60, [160, 40, 220]);
    const stats = harbors.stats();
    expect(stats.moorings).toBeGreaterThan(10);
    expect(harbors.sample(150, 150)?.height).toBeCloseTo(2.65, 3);
    expect(harbors.sample(150, 150)?.clearance).toBeGreaterThan(30);
    // On the dock: no water.
    expect(harbors.sample(160, 200)?.clearance).toBe(0);
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    harbors.update(0.5, [160, 40, 221]);
    expect(loads).toEqual(['speedboat']);
    expect(harbors.stats().models).toBeGreaterThan(0);
    const meshes: THREE.Mesh[] = [];
    parent.traverse((node) => {
      if ((node as THREE.Mesh).isMesh && node.visible) meshes.push(node as THREE.Mesh);
    });
    expect(meshes.length).toBeGreaterThan(0);
    // The marina's walk is decked on the water.
    expect(meshes.some((mesh) => mesh.name === 'harbors:docks')).toBe(true);
    // A boat driven into the row of moored hulls is blocked; one out on the lake is not.
    expect(
      harbors.blocks(new OBB(new THREE.Vector3(150, 3, 196), new THREE.Vector3(8, 0.7, 3.3))),
    ).toBe(true);
    // Short of where boats under way appear (220 m out) and far from the docks.
    expect(
      harbors.blocks(new OBB(new THREE.Vector3(160, 3, 120), new THREE.Vector3(1.3, 0.7, 3.3))),
    ).toBe(false);
    harbors.setEnabled(false);
    expect(harbors.stats().cruising).toBe(0);
    harbors.removed(object);
    expect(harbors.stats().moorings).toBe(0);
    harbors.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('draws the hull without the interior and keeps sails and paint apart; proxies stay light', () => {
    // A quantized content mesh (normalized 16-bit positions under a node scale) bakes at size.
    const quantized = new THREE.BufferGeometry();
    const corners = new Int16Array([-32767, 0, -32767, 32767, 0, -32767, 0, 32767, 32767]);
    quantized.setAttribute('position', new THREE.BufferAttribute(corners, 3, true));
    const hull = new THREE.Mesh(quantized, new THREE.MeshStandardMaterial({ name: 'ivory' }));
    hull.name = 'body-ivory';
    hull.scale.setScalar(5.5);
    const baked = modelParts(new THREE.Group().add(hull)).rest as THREE.BufferGeometry;
    baked.computeBoundingBox();
    expect(baked.boundingBox?.max.x).toBeCloseTo(5.5, 3);
    expect(baked.boundingBox?.min.z).toBeCloseTo(-5.5, 3);
    expect(baked.boundingBox?.max.y).toBeCloseTo(5.5, 3);
    const parts = modelParts(model());
    const count = (g?: THREE.BufferGeometry): number =>
      (g?.getAttribute('position').count ?? 0) / 3;
    expect(count(parts.rest)).toBe(12);
    expect(count(parts.paint)).toBe(12);
    expect(count(parts.sail)).toBe(12);
    expect(parts.paint?.getAttribute('color').getX(0)).toBe(1);
    const proxy = proxyBoatGeometry(10.7, 3.6, 12);
    expect(proxy.getAttribute('position').count / 3).toBeLessThan(150);
    const kinds = earthHarborKinds([
      { id: 'sail', length: 10.7, width: 3.6, height: 12, cruise: 4 },
      { id: 'tug', length: 24.2, width: 9, height: 8.5, cruise: 6 },
      { id: 'ship', length: 200, width: 30, height: 40, cruise: 9 },
      { id: 'ferry', length: 40, width: 12, height: 10, cruise: 8, waterway: 'ferry' },
    ]);
    expect(kinds.moored.map((k) => k.id)).toEqual(['sail', 'tug']);
    expect(kinds.cruising.find((k) => k.id === 'sail')?.sails).toBe(true);
    expect(kinds.moored.find((k) => k.id === 'tug')?.weights.private).toBe(0);
  });

  it('decks the docks that stand on the water, facing up with their skirts facing out', () => {
    const water = [{ polygon: new HarborPolygon([rect(0, 0, 400, 400)]), height: 4 }];
    const dock = (r: HarborRing) => ({
      polygon: new HarborPolygon([r]),
      width: harborDockWidth(r),
    });
    const geometry = dockDecks([dock(rect(100, 100, 160, 103))], water, 0, 0);
    expect(geometry).toBeDefined();
    const position = geometry?.getAttribute('position') as THREE.BufferAttribute;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    let up = 0;
    let out = 0;
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const middle = a.clone().add(b).add(c).divideScalar(3);
      if (n.y > 0.99) {
        up++;
        expect(middle.y).toBeCloseTo(4.45);
      } else {
        // A skirt faces away from the dock's middle.
        expect(n.x * (middle.x - 130) + n.z * (middle.z - 101.5)).toBeGreaterThan(0);
        out++;
      }
    }
    expect(up).toBe(2);
    expect(out).toBe(8);
    // A pier wider than 10 m stands higher; a dock on land is not decked.
    const pier = dockDecks([dock(rect(100, 100, 160, 130))], water, 0, 0);
    expect(pier?.getAttribute('position').getY(0)).toBeCloseTo(5.8);
    expect(dockDecks([dock(rect(500, 500, 560, 503))], water, 0, 0)).toBeUndefined();
  });
});
