import { createViewer } from '@bendyline/molen-client';
import { vehicleProxyGeometry } from '@bendyline/molen-client/vehicles';
import { EarthNightLighting, earthNightFactor } from '@bendyline/molen-earth/client';
import { World } from '@bendyline/molen-kernel/world';
import {
  createEmptyTerrainSemanticTile,
  createTerrainSurfaceRenderer,
  createTerrainSurfaceWorkerBridge,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import {
  createBuildingDetailLod,
  createVertexColorMaterialSet,
  NightWindowLighting,
} from '@bendyline/molen-worldgen/client';
import { FLAT_GROUND, generateBuilding, MeshBufferBuilder } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTestPack } from '../../../../packages/worldgen/test/helpers/pack';

const params = new URLSearchParams(location.search);
const viewer = await createViewer({
  canvas: document.querySelector('#view') as HTMLCanvasElement,
  backend: params.get('backend') === 'webgpu' ? 'webgpu' : 'webgl',
  width: 960,
  height: 700,
  reflections: false,
  reverseDepthBuffer: true,
  preserveDrawingBuffer: true,
});
const renderer = viewer.renderer;
renderer.scene.traverse((object) => {
  if ((object as THREE.Light).isLight) (object as THREE.Light).intensity = 0;
});
const sky = new THREE.HemisphereLight('#ccd9ee', '#514b41', 1.4);
const sun = new THREE.DirectionalLight('#fff5df', 3);
sun.position.set(0, 80, 80);
renderer.scene.add(sky, sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: '#6b7661' }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(100, 0, 100);
renderer.worldRoot.add(ground);
const tile = createEmptyTerrainSemanticTile();
tile.transportation.push(
  {
    class: 'minor_road',
    subclass: 'residential',
    width: 10,
    lines: [
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
  },
  {
    class: 'major_road',
    subclass: 'primary',
    width: 12,
    lines: [
      [
        [0.5, 0],
        [0.5, 1],
      ],
    ],
  },
);
tile.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
const ctx = {
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
const bridge = params.has('worker')
  ? createTerrainSurfaceWorkerBridge(
      new Worker(new URL('../../src/surface-worker.ts', import.meta.url), { type: 'module' }),
    )
  : undefined;
const surfaces = createTerrainSurfaceRenderer({}, bridge);
const surface = await surfaces.createTileAsync(tile, ctx);
if (!surface) throw new Error('Night-lighting surface was cancelled');
renderer.worldRoot.add(surface);
surfaces.updateSignals(0);
const pack = await createTestPack();
const style = pack.archstyles['test.pack.box'];
if (!style) throw new Error('Missing test building style');
const builder = new MeshBufferBuilder();
for (const [i, [x, z, w, d, levels]] of (
  [
    [40, 55, 30, 28, 4],
    [112, 55, 28, 28, 5],
    [40, 112, 30, 22, 3],
    [115, 118, 25, 22, 3],
    [74, 30, 16, 30, 6],
  ] as const
).entries()) {
  generateBuilding(
    {
      request: {
        identity: `night-${i}`,
        labels: ['building'],
        outline: [
          [x, z],
          [x + w, z],
          [x + w, z + d],
          [x, z + d],
        ],
        levels: levels,
      },
      style,
      pack: { name: pack.root.name, version: pack.root.version },
      ground: FLAT_GROUND,
      tier: 0,
    },
    builder,
  );
}
const night = new NightWindowLighting();
const materials = createVertexColorMaterialSet();
materials.nightWindows = night;
const buildings = createBuildingDetailLod(
  builder.finalize(),
  materials,
  materials.materialFor('wall', ''),
  { viewportHeight: 700, maxPixelError: 2 },
);
renderer.worldRoot.add(buildings);
renderer.setCamera({ position: [158, 55, 172], lookAt: [90, 4, 87] });
const world = new World();
const sedan = (
  await new GLTFLoader().loadAsync(
    new URL(
      '../../../../content/entities/assets/molen/entities/vehicle/sedan/model.glb',
      import.meta.url,
    ).href,
  )
).scene;
const carMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  color: '#708c9b',
  roughness: 0.48,
});
const carGeometry = vehicleProxyGeometry({
  width: 1.82,
  length: 4.65,
  height: 1.45,
  wheelbase: 2.7,
  wheelTrack: 1.5,
  wheelRadius: 0.32,
});
for (const [i, position] of (
  [
    [97, 0.5, 145],
    [103, 0.5, 76],
    [91, 0.5, 128],
  ] as [number, number, number][]
).entries()) {
  const car = i === 0 ? sedan : new THREE.Mesh(carGeometry, carMaterial);
  car.position.fromArray(position);
  if (i === 1) car.rotation.y = Math.PI;
  renderer.worldRoot.add(car);
  if (i < 2)
    world.spawnRaw(
      {
        transform: { pos: position, rot: i === 1 ? [0, 1, 0, 0] : [0, 0, 0, 1] },
        ambientAgent: { kind: 'car', type: 'sedan', length: 4.65, width: 1.82, speed: 5 },
      },
      `traffic-${i}`,
    );
}
const spill = new EarthNightLighting({
  root: renderer.worldRoot,
  world,
  surface: surfaces,
  vehicleHeights: { sedan: 1.45 },
  sampleHeight: () => 0,
});
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const api = {
  async view(
    altitude: number,
    enabled = true,
    far = false,
    realLights = true,
    beams = true,
    close = false,
  ) {
    const factor = earthNightFactor(altitude);
    sky.intensity = altitude > 2 ? 1.4 : 0.08;
    sun.intensity = altitude > 2 ? 3 : 0;
    renderer.scene.background = new THREE.Color(altitude > 2 ? '#a6bfd9' : '#050a14');
    night.setNightFactor(enabled ? factor : 0);
    surfaces.setNightFactor(enabled ? factor : 0);
    renderer.setCamera(
      close
        ? { position: [104, 4, 156], lookAt: [97, 1, 143] }
        : far
          ? { position: [250, 240, 300], lookAt: [100, 0, 100] }
          : { position: [158, 55, 172], lookAt: [90, 4, 87] },
    );
    spill.update({
      camera: far ? [250, 240, 300] : [158, 55, 172],
      direction: [-0.58, -0.43, -0.7],
      factor: enabled && realLights ? factor : 0,
    });
    if (!beams)
      spill.object.traverse((o) => {
        if (o instanceof THREE.SpotLight) o.intensity = 0;
      });
    renderer.render();
    await frame();
    renderer.render();
    await frame();
    const probes = [
      [70.02, 3, 124],
      [91, 1.9, 128],
      [97, 0.51, 157],
    ].map((p) => {
      const v = new THREE.Vector3(...p).project(renderer.camera);
      return [(v.x + 1) * 480, (1 - v.y) * 350];
    });
    return { backend: renderer.backend, lamps: surfaces.stats().streetlights, factor, probes };
  },
};
(window as unknown as { nightLightingQA: typeof api }).nightLightingQA = api;
