/** Render the production surface fixtures in a small intersection, including the worker path. */
import { createViewer } from '@bendyline/molen-client';
import {
  createEmptyTerrainSemanticTile,
  createTerrainSurfaceObject,
  createTerrainSurfaceWorkerBridge,
  type TerrainPyramidTileLayerContext,
  updateTerrainSurfaceSignals,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';

const params = new URLSearchParams(location.search);
const backend = params.get('backend') === 'webgpu' ? 'webgpu' : 'webgl';
const viewer = await createViewer({
  canvas: document.querySelector<HTMLCanvasElement>('#view') as HTMLCanvasElement,
  backend,
  reflections: false,
  width: 960,
  height: 700,
  antialias: true,
  preserveDrawingBuffer: true,
});
const renderer = viewer.renderer;
renderer.scene.traverse((child) => {
  if ((child as THREE.Light).isLight) (child as THREE.Light).intensity = 0;
});
const sky = new THREE.HemisphereLight('#d4e9fa', '#394535', 2);
const sun = new THREE.DirectionalLight('#fff5de', 3);
sun.position.set(80, 120, 40);
renderer.scene.add(sky, sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: '#748d76', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(100, 0, 100);
renderer.worldRoot.add(ground);
const tile = createEmptyTerrainSemanticTile();
tile.transportation.push(
  {
    class: 'major_road',
    width: 12,
    lanes: 4,
    lines: [
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
  },
  {
    class: 'minor_road',
    width: 8,
    lanes: 2,
    lines: [
      [
        [0.5, 0],
        [0.5, 1],
      ],
    ],
  },
);
const context = {
  address: { level: 3, x: 0, z: 0 },
  tileSize: 200,
  origin: [0, 0],
  pyramid: { maxLevel: 3 },
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin: [0, 0],
    worldSize: [200, 200],
    height: { min: 0, max: 1 },
  }),
  signal: new AbortController().signal,
} as TerrainPyramidTileLayerContext;
const options = { details: { streetlights: false } };
const bridge = params.has('worker')
  ? createTerrainSurfaceWorkerBridge(
      new Worker(new URL('../../src/surface-worker.ts', import.meta.url), { type: 'module' }),
    )
  : undefined;
const object = bridge
  ? await bridge.generate(tile, context, options)
  : createTerrainSurfaceObject(tile, context, options);
if (!object) throw new Error('Signal fixture was cancelled');
renderer.worldRoot.add(object);
const heads = object.userData.trafficSignalHeads as {
  x: number;
  y: number;
  z: number;
  offset: number;
  direction: [number, number];
}[];
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const api = {
  async view(time: number, night: boolean, close = false) {
    sky.intensity = night ? 0.06 : 2;
    sun.intensity = night ? 0 : 3;
    renderer.scene.background = new THREE.Color(night ? '#080f1e' : '#b7ccdf');
    const head = heads.find((head) => head.direction[1] > 0.9) as (typeof heads)[number];
    renderer.setCamera(
      close
        ? { position: [head.x + 3, head.y + 1.3, head.z + 9], lookAt: [head.x, head.y, head.z] }
        : { position: [132, 19, 142], lookAt: [100, 3, 100] },
    );
    updateTerrainSurfaceSignals(object, time - (heads[0]?.offset ?? 0));
    renderer.render();
    await frame();
    renderer.render();
    await frame();
    return { backend: renderer.backend, heads: heads.length };
  },
};
(window as unknown as { trafficSignalsQA: typeof api }).trafficSignalsQA = api;
