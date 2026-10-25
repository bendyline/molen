import type { ModelSignalSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { AssetCache } from '../src/assets';
import {
  createModelSignalVisual,
  modelSignalDisplacement,
  readModelSignals,
} from '../src/model-signals';
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
  expect(readModelSignals(sources, (name) => components[name])).toEqual({
    rpm: 0.8,
    on: 1,
    inherited: undefined,
    text: undefined,
    bad: undefined,
    absent: undefined,
  });
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

it('advances response time on models without animation clips and holds missing readings over clips', async () => {
  const { backend, cache, needle } = fixture();
  backend.create('a', { kind: 'gltf', ref: 'panel' });
  backend.setModelSignals(
    'a',
    {
      bindings: [
        {
          node: 'pointer',
          source: 'rpm',
          property: 'rotation',
          axis: 'z',
          scale: 1,
          responseSeconds: 1,
        },
      ],
    },
    { rpm: 0 },
  );
  await cache.whenIdle();
  backend.setModelSignals(
    'a',
    {
      bindings: [
        {
          node: 'pointer',
          source: 'rpm',
          property: 'rotation',
          axis: 'z',
          scale: 1,
          responseSeconds: 1,
        },
      ],
    },
    { rpm: 1 },
  );
  backend.setAnimationTick(30, 30);
  expect(needle('a').rotation.z).toBeCloseTo(0.3 + 1 - 1 / Math.E);
  backend.updateLiveAnimations(60, 30, new THREE.PerspectiveCamera());
  expect(needle('a').rotation.z).toBeCloseTo(0.3 + 1 - Math.exp(-2));
  backend.create('b', { kind: 'gltf', ref: 'panel', animation: { clip: 'test' } });
  backend.setModelSignals('b', spec, { rpm: 0.5 });
  await cache.whenIdle();
  backend.setModelSignals('b', spec, {});
  backend.setAnimationTick(45, 30);
  expect(needle('b').rotation.z).toBeCloseTo(1.3);
  backend.destroy('a');
  backend.destroy('b');
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

it('follows keyframed curves, holding their end values and easing between keys', () => {
  const door = {
    node: 'door',
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    keys: [
      [0, 0],
      [0.12, 1.5],
      [0.88, 1.5],
      [1, 0],
    ],
  } as const satisfies ModelSignalSpec['bindings'][number];
  expect(modelSignalDisplacement(door, -1)).toBe(0);
  expect(modelSignalDisplacement(door, 0.06)).toBeCloseTo(0.75);
  expect(modelSignalDisplacement(door, 0.5)).toBe(1.5);
  expect(modelSignalDisplacement(door, 0.94)).toBeCloseTo(0.75);
  expect(modelSignalDisplacement(door, 2)).toBe(0);
  const smooth = { ...door, ease: 'smooth' as const };
  // Halfway between keys is the same; a quarter of the way the eased door has moved less.
  expect(modelSignalDisplacement(smooth, 0.06)).toBeCloseTo(0.75);
  expect(modelSignalDisplacement(smooth, 0.03)).toBeCloseTo(1.5 * 0.15625);
  expect(modelSignalDisplacement({ ...door, keys: undefined, scale: 2, offset: 1 }, 0.5)).toBe(2);

  const node = new THREE.Group();
  node.name = 'door';
  node.rotation.x = 0.2;
  const visual = createModelSignalVisual(node, { bindings: [smooth] });
  visual.update({ gear: 0.5 });
  expect(node.rotation.x).toBeCloseTo(1.7);
  visual.update({ gear: 1 });
  expect(node.rotation.x).toBeCloseTo(0.2);
});
