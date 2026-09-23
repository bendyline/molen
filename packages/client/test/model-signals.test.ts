import type { ModelSignalSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { AssetCache } from '../src/assets';
import { createModelSignalVisual, readModelSignals } from '../src/model-signals';
import { ThreeSceneBackend } from '../src/three/backend';

const spec: ModelSignalSpec = {
  sources: { rpm: { component: 'my.avionics', path: ['engines', 1, 'rpm'] } },
  bindings: [{ node: 'pointer', source: 'rpm', property: 'rotation', axis: 'z', scale: 2 }],
};

it('reads explicit component paths, arrays and booleans without coercion or inherited fields', () => {
  const sources = {
    ...spec.sources,
    on: { component: 'engine', path: ['running'] },
    inherited: { component: 'engine', path: ['rpm'] },
    text: { component: 'engine', path: ['text'] },
    bad: { component: 'engine', path: ['bad'] },
    absent: { component: 'absent', path: ['value'] },
  };
  const components: Record<string, unknown> = {
    'my.avionics': { engines: [{ rpm: 0.2 }, { rpm: 0.8 }] },
    engine: Object.assign(Object.create({ rpm: 17 }), { running: true, text: '12', bad: Infinity }),
  };
  expect(readModelSignals(sources, (name) => components[name])).toEqual({ rpm: 0.8, on: 1 });
});

it('reset restores the authored pose and new bindings do not compound previous offsets', () => {
  const node = new THREE.Group();
  node.name = 'pointer';
  node.rotation.z = 0.3;
  const visual = createModelSignalVisual(node, spec);
  visual.update({ rpm: 0.8 });
  expect(node.rotation.z).toBeCloseTo(1.9);
  visual.reset();
  expect(node.rotation.z).toBeCloseTo(0.3);
  createModelSignalVisual(node, spec).update({ rpm: 0.8 });
  expect(node.rotation.z).toBeCloseTo(1.9);
});

function fixture() {
  const base = new THREE.Group();
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  pointer.name = 'pointer';
  pointer.rotation.z = 0.3;
  base.add(pointer);
  const clip = new THREE.AnimationClip('test', 2, [
    new THREE.NumberKeyframeTrack('pointer.rotation[z]', [0, 2], [0.3, 2.3]),
  ]);
  const cache = new AssetCache({ load: async () => new ArrayBuffer(1), loadText: async () => '' }, {
    parse: (_bytes: ArrayBuffer, _path: string, done: (gltf: unknown) => void) =>
      done({ scene: base, animations: [clip] }),
  } as never);
  const scene = new THREE.Scene();
  const backend = new ThreeSceneBackend(scene, cache);
  const needle = (id: string) =>
    scene.getObjectByName(id)?.getObjectByName('pointer') as THREE.Mesh;
  return { scene, backend, cache, needle, base };
}

it('applies latest values after async load, isolates instances and keeps instrument nodes dynamic', async () => {
  const { backend, cache, needle, base } = fixture();
  for (const id of ['a', 'b']) backend.create(id, { kind: 'gltf', ref: 'panel' });
  backend.setModelSignals('a', spec, { rpm: 0.2 });
  backend.setModelSignals('a', spec, { rpm: 0.7 });
  backend.setModelSignals('b', spec, { rpm: 0.1 });
  await cache.whenIdle();
  backend.prepareFrame();
  expect(needle('a').rotation.z).toBeCloseTo(1.7);
  expect(needle('b').rotation.z).toBeCloseTo(0.5);
  expect(base.getObjectByName('pointer')?.rotation.z).toBeCloseTo(0.3);
  expect(needle('a').matrixAutoUpdate).toBe(true);
  expect(needle('a').visible).toBe(true);
  backend.setModelSignals(
    'a',
    { ...spec, bindings: [{ ...spec.bindings[0], scale: 4 }] },
    { rpm: 0.5 },
  );
  expect(needle('a').rotation.z).toBeCloseTo(2.3);
  backend.setModelSignals('a', undefined, {});
  expect(needle('a').rotation.z).toBeCloseTo(0.3);
  backend.destroy('a');
  backend.destroy('b');
  cache.dispose();
});

it('signal channels win over animation clips in exact capture and live sampling', async () => {
  const { backend, cache, needle } = fixture();
  backend.create('a', { kind: 'gltf', ref: 'panel', animation: { clip: 'test' } });
  backend.setModelSignals('a', spec, { rpm: 0.5 });
  await cache.whenIdle();
  backend.setAnimationTick(30, 30);
  expect(needle('a').rotation.z).toBeCloseTo(1.3);
  backend.updateLiveAnimations(45, 30, new THREE.PerspectiveCamera());
  expect(needle('a').rotation.z).toBeCloseTo(1.3);
  backend.destroy('a');
  cache.dispose();
});

it('destroy during loading cannot resurrect a model or its bindings', async () => {
  const { backend, cache, scene } = fixture();
  backend.create('a', { kind: 'gltf', ref: 'panel' });
  backend.setModelSignals('a', spec, { rpm: 1 });
  backend.destroy('a');
  await cache.whenIdle();
  expect(scene.children).toHaveLength(0);
  backend.create('a', { kind: 'gltf', ref: 'panel' });
  await cache.whenIdle();
  expect(scene.getObjectByName('pointer')?.rotation.z).toBeCloseTo(0.3);
  backend.destroy('a');
  cache.dispose();
});

it('adding and removing bindings during clip playback uses the authored rest pose', async () => {
  const { backend, cache, needle } = fixture();
  backend.create('a', { kind: 'gltf', ref: 'panel', animation: { clip: 'test' } });
  await cache.whenIdle();
  backend.setAnimationTick(30, 30);
  expect(needle('a').rotation.z).toBeCloseTo(1.3);
  backend.setModelSignals('a', spec, { rpm: 0.2 });
  expect(needle('a').rotation.z).toBeCloseTo(0.7);
  backend.setModelSignals('a', undefined, {});
  expect(needle('a').rotation.z).toBeCloseTo(1.3);
  backend.destroy('a');
  cache.dispose();
});
