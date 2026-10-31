/** Synthetic interchange: production pavement, bridge structures and worker geometry. */
import { createViewer } from '@bendyline/molen-client';
import {
  createEmptyTerrainSemanticTile,
  createTerrainSurfaceObject,
  createTerrainSurfaceWorkerBridge,
  type TerrainPyramidTileLayerContext,
  type TerrainSemanticPoint,
  type TerrainTransportationFeature,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';

const viewer = await createViewer({
  canvas: document.querySelector('#view') as HTMLCanvasElement,
  backend: 'webgl',
  width: 1400,
  height: 900,
  antialias: true,
  reflections: false,
  preserveDrawingBuffer: true,
});
const { renderer } = viewer;
renderer.scene.traverse((o) => {
  if ((o as THREE.Light).isLight) (o as THREE.Light).intensity = 0;
});
renderer.scene.background = new THREE.Color('#b8d3e7');
const sun = new THREE.DirectionalLight('#fff8f0', 6.1);
sun.position.set(-200, 400, 100);
renderer.scene.add(new THREE.HemisphereLight('#d4e9fa', '#9a8f70', 1.25), sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshStandardMaterial({ color: '#8e9c77' }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(300, 0, 300);
renderer.worldRoot.add(ground);
const tile = createEmptyTerrainSemanticTile();
const road = (
  points: TerrainSemanticPoint[],
  extra: Partial<TerrainTransportationFeature> = {},
) => {
  tile.transportation.push({
    class: 'highway',
    subclass: 'motorway',
    lanes: 3,
    oneway: true,
    width: 11,
    lines: [points.map(([x, z]) => [x / 600, z / 600])],
    ...extra,
  });
};
// Short structural spans retain smooth approaches across a separate 20m map fragment.
for (const z of [280, 305]) {
  road([
    [0, z],
    [235, z],
  ]);
  road(
    [
      [235, z],
      [255, z],
    ],
    { name: 'Short approach fragment' },
  );
  road(
    [
      [255, z],
      [345, z],
    ],
    { bridge: true, layer: 1 },
  );
  road([
    [345, z],
    [600, z],
  ]);
}
for (const x of [285, 315])
  road([
    [x, 0],
    [x, 315],
    [x, 600],
  ]);
// A ground loop descends from the bridge end, then joins the lower highway.
const loop: TerrainSemanticPoint[] = [
  [345, 305],
  [385, 305],
];
for (let i = 0; i <= 24; i++) {
  const a = -Math.PI / 2 + (i / 24) * Math.PI * 1.5;
  loop.push([385 + Math.cos(a) * 85, 390 + Math.sin(a) * 85]);
}
loop.push([315, 340], [315, 315]);
road(loop, { subclass: 'motorway_link', link: true, width: 4.5, lanes: 1 });
// Elevated merging ramp: its barrier must open into the main deck.
road(
  [
    [160, 120],
    [200, 135],
    [235, 170],
    [265, 220],
    [305, 260],
    [345, 280],
  ],
  {
    bridge: true,
    layer: 1,
    subclass: 'motorway_link',
    link: true,
    width: 4.5,
    lanes: 1,
  },
);
const context = {
  tileSize: 600,
  origin: [0, 0],
  address: { level: 3, x: 0, z: 0 },
  pyramid: { maxLevel: 3 },
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin: [0, 0],
    worldSize: [600, 600],
    height: { min: 0, max: 1 },
  }),
  signal: new AbortController().signal,
} as TerrainPyramidTileLayerContext;
const worker = new URLSearchParams(location.search).has('worker')
  ? createTerrainSurfaceWorkerBridge(
      new Worker(new URL('../../src/surface-worker.ts', import.meta.url), { type: 'module' }),
    )
  : undefined;
const options = { details: { streetlights: false, roadSigns: false, trafficSignals: false } };
const object = worker
  ? await worker.generate(tile, context, options)
  : createTerrainSurfaceObject(tile, context, options);
if (!object) throw new Error('Highway fixture cancelled');
// Use the same material batching in both paths; otherwise coplanar join faces can swap
// draw order because direct meshes own distinct materials and worker meshes share one.
const pavement = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.96,
  side: THREE.DoubleSide,
});
object.traverse((o) => {
  if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = pavement;
});
renderer.worldRoot.add(object);
const views = {
  overview: { position: [650, 360, 700], lookAt: [300, 0, 310] },
  approach: { position: [430, 24, 390], lookAt: [275, 3, 295] },
  merge: { position: [365, 38, 240], lookAt: [307, 6, 270] },
} as const;
const api = {
  async view(name: keyof typeof views) {
    renderer.setCamera(views[name]);
    renderer.render();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    renderer.render();
    return object.userData.surfaceStats;
  },
};
(window as unknown as { highwayQA: typeof api }).highwayQA = api;
