import { componentHandle, World } from '@bendyline/molen-kernel/world';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAmbientRenderer, ProxyBatches } from '../src/client';
import { installAmbient } from '../src/kernel';
import { gridDocument } from './helpers';

function busyWorld(): World {
  const world = new World({ tickRate: 30, seed: 'render' });
  const ambient = installAmbient(world, {
    classes: ['car', 'pedestrian', 'train', 'aircraft'],
    policy: {
      spawnBudget: 20,
      car: { near: 0, far: 300, keep: 400, perLaneKm: 15, max: 60 },
      pedestrian: { near: 0, far: 100, keep: 200, perLaneKm: 20, max: 20 },
      train: { near: 0, far: 500, keep: 800, perLaneKm: 5, max: 1 },
      aircraft: { near: 500, far: 2000, keep: 3000, max: 1 },
    },
  });
  ambient.addDocument({ ...gridDocument(4, 90), sidewalks: true });
  ambient.addDocument({
    format: 'molen/transport-network@1',
    ways: [
      {
        class: 'rail',
        points: [
          [-400, 45],
          [400, 45],
        ],
      },
    ],
  });
  ambient.setObserver({ pos: [0, 0, 0] });
  world.stepN(120);
  return world;
}

describe('proxy batches', () => {
  it('draws one instanced mesh per shape and keeps matrices near the anchor', () => {
    const batches = new ProxyBatches();
    const far = 3_000_000;
    batches.begin([far, 0, far]);
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < 100; i++)
      batches.add({
        shape: i % 2 === 0 ? 'car' : 'bus',
        dims:
          i % 2 === 0
            ? { length: 4.6, width: 1.8, height: 1.45 }
            : { length: 12, width: 2.55, height: 3.1 },
        pos: [far + i, 0, far - i],
        rot: [0, 0, 0, 1],
        scale: 1,
        color: white,
      });
    expect(batches.end()).toBe(100);
    expect(batches.meshCount).toBe(2);
    const mesh = batches.group.children[0] as THREE.InstancedMesh;
    expect(mesh.count).toBe(50);
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(10, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    // Anchor-relative: small numbers even three thousand kilometres out.
    expect(Math.abs(p.x)).toBeLessThan(300);
    expect(batches.group.position.x).toBeCloseTo(far, -3);
    expect(mesh.userData.walkIgnore).toBe(true);
    batches.begin([far, 0, far]);
    batches.end();
    expect(mesh.visible).toBe(false);
  });
});

describe('ambient renderer', () => {
  it('renders every class of a live world and cleans up', () => {
    const world = busyWorld();
    const parent = new THREE.Group();
    const renderer = createAmbientRenderer({
      world,
      parent,
      budget: { skinnedFigures: 4, figureRadius: 150 },
    });
    renderer.update([0, 1.7, 0], 1 / 60);
    const stats = renderer.stats();
    expect(stats.cars).toBeGreaterThan(10);
    expect(stats.pedestrians).toBeGreaterThan(5);
    expect(stats.trains).toBeGreaterThan(0);
    expect(stats.aircraft).toBe(1);
    // Everything but pedestrians is a proxy here (no models supplied).
    expect(stats.proxies).toBe(stats.cars + stats.trains + stats.aircraft);
    expect(stats.figures).toBeGreaterThan(0);
    let skinned = 0;
    parent.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned++;
    });
    expect(skinned).toBeLessThanOrEqual(4);
    renderer.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('promotes the nearest cars to pooled models and returns them to the pool', async () => {
    const world = busyWorld();
    const parent = new THREE.Group();
    const loads: string[] = [];
    const renderer = createAmbientRenderer({
      world,
      parent,
      budget: { detailedCars: 3 },
      vehicles: {
        load: async (type) => {
          loads.push(type);
          const model = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ name: 'paint' }),
          );
          body.name = 'body';
          model.add(body);
          return model;
        },
        vehicle: (type) =>
          ({
            kind: type,
            color: '#ffffff',
            spec: { wheelRadius: 0.3, wheelbase: 2.7 },
            visual: { wheelNodes: [], frontWheelNodes: [], paintMaterial: 'paint' },
          }) as never,
      },
    });
    // Put the camera on a car so it is nearby.
    const [, , transform] = [
      ...world.query(componentHandle('ambientAgent'), componentHandle('transform')),
    ].find(([, a]) => (a as { kind: string }).kind === 'car') as [
      string,
      unknown,
      { pos: [number, number, number] },
    ];
    const camera: [number, number, number] = [
      transform.pos[0],
      transform.pos[1] + 2,
      transform.pos[2],
    ];
    for (let i = 0; i < 20; i++) {
      renderer.update(camera, 0.25);
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(loads.length).toBeGreaterThan(0);
    expect(renderer.stats().detailedCars).toBeGreaterThan(0);
    expect(renderer.stats().detailedCars).toBeLessThanOrEqual(3);
    renderer.update([99_999, 0, 99_999], 0.25);
    renderer.update([99_999, 0, 99_999], 0.25);
    expect(renderer.stats().detailedCars).toBe(0);
    renderer.dispose();
  });
});
