import { loadFontLibrary } from '@bendyline/molen-materials/text';
import fontCatalog from '../../../../content/earth/fonts/catalog.json';

const fontSources = import.meta.glob('../../../../content/earth/fonts/*.json', {
  query: '?raw',
  import: 'default',
});
const fonts = await loadFontLibrary(fontCatalog, async (path) =>
  JSON.parse((await fontSources[`../../../../content/earth/fonts/${path}`]()) as string),
);

/** Production sign geometry and worker transfer, with synthetic mapped metadata. */
import { createViewer } from '@bendyline/molen-client';
import {
  createEmptyTerrainSemanticTile,
  createTerrainSurfaceObject,
  createTerrainSurfaceWorkerBridge,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';

const params = new URLSearchParams(location.search);
const viewer = await createViewer({
  canvas: document.querySelector('#view') as HTMLCanvasElement,
  backend: params.get('backend') === 'webgpu' ? 'webgpu' : 'webgl',
  width: 1200,
  height: 800,
  antialias: true,
  reflections: false,
  preserveDrawingBuffer: true,
});
const renderer = viewer.renderer;
renderer.scene.traverse((child) => {
  if ((child as THREE.Light).isLight) (child as THREE.Light).intensity = 0;
});
renderer.scene.background = new THREE.Color('#bfd6e6');
const sky = new THREE.HemisphereLight('#d4e9fa', '#7a7258', 2);
const sun = new THREE.DirectionalLight('#fff1d8', 3.5);
sun.position.set(-70, 140, 80);
renderer.scene.add(sky, sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: '#8aa065', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(200, 0, 200);
renderer.worldRoot.add(ground);
const highway = createEmptyTerrainSemanticTile();
highway.transportation = [
  {
    class: 'highway',
    subclass: 'motorway',
    oneway: true,
    ref: 'I 90',
    maxspeed: '60 mph',
    width: 11,
    lanes: 3,
    lines: [
      [
        [0.05, 0.4],
        [0.95, 0.4],
      ],
    ],
  },
  {
    class: 'highway',
    subclass: 'motorway',
    oneway: true,
    ref: 'I 90',
    width: 11,
    lanes: 3,
    lines: [
      [
        [0.95, 0.34],
        [0.05, 0.34],
      ],
    ],
  },
  {
    class: 'highway',
    subclass: 'motorway_link',
    oneway: true,
    link: true,
    width: 4.5,
    junctionRef: '17B',
    destination: 'Lake City;Downtown',
    lines: [
      [
        [0.6, 0.4],
        [0.75, 0.55],
        [0.95, 0.65],
      ],
    ],
  },
];
const local = createEmptyTerrainSemanticTile();
local.transportation = [
  {
    class: 'minor_road',
    subclass: 'residential',
    width: 8,
    lines: [
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
  },
  {
    class: 'minor_road',
    subclass: 'residential',
    width: 8,
    lines: [
      [
        [0.5, 0],
        [0.5, 1],
      ],
    ],
  },
];
const context = {
  tileSize: 400,
  origin: [0, 0],
  address: { level: 3, x: 0, z: 0 },
  pyramid: { maxLevel: 3 },
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin: [0, 0],
    worldSize: [400, 400],
    height: { min: 0, max: 1 },
  }),
  signal: new AbortController().signal,
} as TerrainPyramidTileLayerContext;
const bridge = params.has('worker')
  ? createTerrainSurfaceWorkerBridge(
      new Worker(new URL('../../src/surface-worker.ts', import.meta.url), { type: 'module' }),
    )
  : undefined;
const options = { fonts, details: { streetlights: false } };
const objects = [];
for (const tile of [highway, local]) {
  const object = bridge
    ? await bridge.generate(tile, context, options)
    : createTerrainSurfaceObject(tile, context, options);
  if (!object) throw new Error('Sign fixture cancelled');
  renderer.worldRoot.add(object);
  objects.push(object);
}
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const views = {
  overhead: { position: [150, 5, 163], lookAt: [185, 6.6, 160] },
  freeway: { position: [122, 40, 204], lookAt: [215, 1, 159] },
  speed: { position: [57, 2.6, 170], lookAt: [70, 2.8, 167.1] },
  exit: { position: [242, 3.2, 166], lookAt: [252.8, 3.2, 178.3] },
  stops: { position: [171, 3.4, 190], lookAt: [190, 2, 199] },
  junction: { position: [171, 25, 164], lookAt: [200, 1, 200] },
} as const;
const api = {
  async view(name: keyof typeof views) {
    objects[0].visible = !['stops', 'junction'].includes(name);
    objects[1].visible = !objects[0].visible;
    renderer.setCamera(views[name]);
    renderer.render();
    await frame();
    renderer.render();
    await frame();
    return {
      backend: renderer.backend,
      stats: objects[objects[1].visible ? 1 : 0].userData.surfaceStats,
      signs: objects[objects[1].visible ? 1 : 0].userData.roadSigns,
    };
  },
};
(window as unknown as { roadSignsQA: typeof api }).roadSignsQA = api;
