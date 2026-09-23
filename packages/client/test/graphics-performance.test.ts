import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetCache } from '../src/assets';
import { FrameAdmissionQueue } from '../src/frame-admission';
import { InterpolationBuffer, type InterpTransform } from '../src/interpolation';
import { ThreeSceneBackend } from '../src/three/backend';
import { StaticMeshBatches } from '../src/three/static-batches';

const transform = (x: number): InterpTransform => ({ pos: [x, 0, 0], rot: [0, 0, 0, 1] });

describe('sparse graphics work', () => {
  it('a 99%-static scene samples only the moving 1%, including its final pose', () => {
    const buffer = new InterpolationBuffer(10, { delayTicks: 0.5 });
    buffer.push(0, new Map(Array.from({ length: 10_000 }, (_, i) => [`e${i}`, transform(i)])), 0);
    buffer.sampleActive(100, () => {});
    expect(buffer.lastSampleVisited).toBe(10_000);
    buffer.pushDelta(
      1,
      new Map(Array.from({ length: 100 }, (_, i) => [`e${i}`, transform(i + 10)])),
      100,
    );
    const poses = new Map<string, InterpTransform>();
    buffer.sampleActive(100, (id, t) => poses.set(id, t));
    expect(buffer.lastSampleVisited).toBe(100);
    expect(poses.get('e0')?.pos[0]).toBe(5);
    buffer.sampleActive(150, (id, t) => poses.set(id, t));
    expect(poses.get('e0')?.pos[0]).toBe(10);
    buffer.sampleActive(200, () => {});
    expect(buffer.lastSampleVisited).toBe(0);
    for (let tick = 2; tick < 10; tick++) buffer.pushDelta(tick, new Map(), tick * 100);
    expect(buffer.sampleAt(8.5, 'e500')?.pos[0]).toBe(500);
    expect(buffer.sampleAt(8.5, 'e0')?.pos[0]).toBe(10);
    buffer.activate('e500');
    buffer.sampleActive(1000, () => {});
    expect(buffer.lastSampleVisited).toBe(1);
  });

  it('bounds admission by jobs, bytes and elapsed work; cancellation never publishes', async () => {
    let time = 0;
    const queue = new FrameAdmissionQueue({
      maxMilliseconds: 2,
      maxJobs: 3,
      maxBytes: 100,
      now: () => time,
      schedule: () => {},
    });
    const published: number[] = [];
    const first = queue.run(
      () => {
        time += 3;
        published.push(1);
      },
      { bytes: 20 },
    );
    const second = queue.run(() => published.push(2), { bytes: 80 });
    const third = queue.run(() => published.push(3), { bytes: 80 });
    queue.flush();
    expect(published).toEqual([1]);
    queue.flush();
    expect(published).toEqual([1, 2]);
    const abort = new AbortController();
    const cancelled = queue
      .run(() => published.push(99), { signal: abort.signal })
      .catch((e) => e.name);
    abort.abort();
    expect(await cancelled).toBe('AbortError');
    queue.flush();
    await Promise.all([first, second, third]);
    expect(published).toEqual([1, 2, 3]);
    queue.dispose();
  });

  it('batches shared geometry by spatial cell while preserving picking, movement and escape hatch', () => {
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene);
    for (let i = 0; i < 20; i++) {
      backend.create(`e${i}`, { kind: 'primitive', ref: 'box', materialRef: 'palette:#ffffff' });
      backend.setTransform(`e${i}`, transform(i));
    }
    backend.prepareFrame();
    scene.updateMatrixWorld(true);
    const batches = scene.children.filter(
      (o) => (o as THREE.InstancedMesh).isInstancedMesh,
    ) as THREE.InstancedMesh[];
    expect(batches).toHaveLength(1);
    expect(batches[0]?.count).toBe(20);
    const ray = new THREE.Raycaster(new THREE.Vector3(7, 0, 5), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(batches[0] as THREE.InstancedMesh)[0] as THREE.Intersection;
    expect(backend.entityForIntersection(hit)).toBe('e7');
    backend.setTransform('e7', transform(70));
    backend.prepareFrame();
    expect(
      scene.children
        .filter((o) => (o as THREE.InstancedMesh).isInstancedMesh)
        .map((o) => (o as THREE.InstancedMesh).count),
    ).toEqual([19]);
    expect(backend.getObject('e7')?.position.x).toBe(70);
    expect(backend.getObject('e8')?.visible).toBe(true);
    backend.destroy('e9');
    backend.prepareFrame();
    expect(backend.count()).toBe(19);
    backend.dispose();
    expect(scene.children).toHaveLength(0);
  });
});

describe('staged graphics lifecycle', () => {
  it('keeps originals visible until preparation and discards stale prepared batches', async () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(),
      material = new THREE.MeshStandardMaterial();
    const a = new THREE.Mesh(geometry, material),
      b = new THREE.Mesh(geometry, material);
    root.add(a, b);
    const releases: Array<() => void> = [];
    const batches = new StaticMeshBatches(
      root,
      {},
      () => new Promise<void>((resolve) => releases.push(resolve)),
    );
    batches.add('a', a);
    batches.add('b', b);
    batches.flush();
    expect(a.visible && b.visible).toBe(true);
    batches.remove('a');
    batches.flush();
    releases.shift()?.();
    await batches.whenIdle();
    expect(root.children).toHaveLength(2);
    expect(a.visible && b.visible).toBe(true);
    batches.add('a', a);
    batches.flush();
    releases.shift()?.();
    await batches.whenIdle();
    expect(a.visible || b.visible).toBe(false);
    expect(root.children).toHaveLength(3);
    batches.dispose();
    expect(a.visible && b.visible).toBe(true);
    geometry.dispose();
    material.dispose();
  });

  it('throttles hidden animation but immediately restores the exact visible pose, including shadow casters', async () => {
    const base = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    mesh.name = 'moving';
    base.add(mesh);
    const clip = new THREE.AnimationClip('move', 10, [
      new THREE.NumberKeyframeTrack('moving.position[x]', [0, 10], [0, 10]),
    ]);
    const cache = new AssetCache(
      { load: async () => new ArrayBuffer(1), loadText: async () => '' },
      {
        parse: (_bytes: ArrayBuffer, _path: string, done: (value: unknown) => void) =>
          done({ scene: base, animations: [clip] }),
      } as never,
    );
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene, cache);
    const renderable = { kind: 'gltf' as const, ref: 'model', animation: { clip: 'move' } };
    backend.create('actor', renderable);
    await cache.whenIdle();
    backend.setTransform('actor', { pos: [0, 0, 10], rot: [0, 0, 0, 1] });
    const instance = scene.getObjectByName('moving') as THREE.Mesh;
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    backend.updateLiveAnimations(30, 30, camera);
    expect(instance.position.x).toBeCloseTo(1);
    backend.updateLiveAnimations(31, 30, camera);
    expect(instance.position.x).toBeCloseTo(1);
    camera.lookAt(0, 0, 10);
    backend.updateLiveAnimations(32, 30, camera);
    expect(instance.position.x).toBeCloseTo(32 / 30);
    camera.lookAt(0, 0, -10);
    instance.castShadow = true;
    backend.updateLiveAnimations(33, 30, camera);
    expect(instance.position.x).toBeCloseTo(33 / 30);
    backend.setAnimationTick(15, 30);
    expect(instance.position.x).toBeCloseTo(0.5);
    backend.dispose();
    cache.dispose();
  });

  it('culls only finite lights outside the view and applies the optional cap in world coordinates', () => {
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene, undefined, undefined, undefined, {
      maxLocalLights: 1,
    });
    for (const [id, x, z] of [
      ['near', 100, -5],
      ['far', 100, -20],
      ['behind', 100, 50],
    ] as const) {
      backend.createLight(id, { type: 'point', color: '#ffffff', intensity: 2, range: 3 });
      backend.setTransform(id, { pos: [x, 0, z], rot: [0, 0, 0, 1] });
    }
    const parent = new THREE.Group();
    parent.position.x = 100;
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    parent.add(camera);
    parent.updateMatrixWorld(true);
    backend.updateLiveAnimations(1, 30, camera);
    expect(scene.getObjectByName('near$light')?.visible).toBe(true);
    expect(scene.getObjectByName('far$light')?.visible).toBe(false);
    expect(scene.getObjectByName('behind$light')?.visible).toBe(false);
    camera.lookAt(100, 0, 50);
    backend.updateLiveAnimations(2, 30, camera);
    expect(scene.getObjectByName('behind$light')?.visible).toBe(true);
    backend.dispose();
  });
});
