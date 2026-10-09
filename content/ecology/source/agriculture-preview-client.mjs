// Actual runtime surface, procedural models and placement budgets in controlled field fixtures.
import * as THREE from 'three';
import {
  createTerrainGroundMaterialAsync,
  createTerrainSemanticObject,
} from '/packages/terrain/dist/client.mjs';
import { createEmptyTerrainSemanticTile, Heightfield } from '/packages/terrain/dist/kernel.mjs';
import { createPlantGeometry } from '/packages/worldgen/dist/client.mjs';
import { FLAT_GROUND, samplePlacements } from '/packages/worldgen/dist/kernel.mjs';
import {
  createRegionalEnvironment,
  prepareAgricultureTile,
  scatterRequestFromTile,
  worldgenTileBudgetForQuality,
} from '/packages/worldgen-earth/dist/kernel.mjs';

const [catalog, atlas] = await Promise.all(
  ['regional.catalog.json', 'ecoregions.json'].map((name) =>
    fetch(`/content/ecology/${name}`).then((r) => r.json()),
  ),
);
const nodes = new URLSearchParams(location.search).get('backend') === 'nodes';
const renderer = nodes
  ? new (await import('three/webgpu')).WebGPURenderer({ antialias: true, forceWebGL: true })
  : new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
if (nodes) await renderer.init();
renderer.setSize(1280, 800);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.append(renderer.domElement);
const material = await createTerrainGroundMaterialAsync(
  { agriculture: true, strength: 0.5 },
  nodes ? 'webgpu' : 'webgl',
);
let scene;
const camera = new THREE.PerspectiveCamera(45, 1280 / 800, 0.1, 15000);
const sites = {
  iowa: [-93.96, 42.01, ['maize', 'soybeans', 'maize', 'wheat', 'maize', 'pasture']],
  italy: [11.25, 43.45, ['olives', 'grapes', 'wheat', 'olives', 'sunflower', 'grapes']],
  india: [75.8, 30.89, ['rice', 'cotton', 'sugarcane', 'rice', 'wheat', 'vegetables']],
  brazil: [-47.92, -16.08, ['soybeans', 'maize', 'sugarcane', 'coffee', 'maize', 'pasture']],
  kenya: [35.25, 0.52, ['maize', 'tea', 'sorghum', 'coffee', 'vegetables', 'maize']],
  australia: [117.9, -32, ['wheat', 'canola', 'pasture', 'wheat', 'grapes', 'fallow']],
};
window.showFarm = async (name = 'iowa', month, view = 'air', quality = 'high', infer = false) => {
  if (scene)
    scene.traverse((object) => {
      object.geometry?.dispose();
      if (object.material && object.material !== material) object.material.dispose();
    });
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#c7d8de');
  scene.add(new THREE.HemisphereLight('#e4eff3', '#817b58', 1.6));
  const sun = new THREE.DirectionalLight('#fff2d9', 2.4);
  sun.position.set(-70, 120, 40);
  scene.add(sun);
  const [lon, lat, crops] = sites[name];
  const originX = ((lon * Math.PI) / 180) * 6378137,
    originZ = -6378137 * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const size = 240;
  const geom = {
    level: 15,
    x: 0,
    z: 0,
    originX,
    originZ,
    size,
    metersPerUnit: 1,
    levelBelowMax: 0,
  };
  const environment = createRegionalEnvironment(
    { catalogs: [catalog], atlas, ...(month ? { vegetationMonth: month } : {}) },
    1,
  );
  const tile = createEmptyTerrainSemanticTile();
  tile.landcover.push({
    class: 'grass',
    polygons: [
      {
        outer: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      },
    ],
  });
  crops.forEach((crop, i) => {
    const x = i % 3,
      z = Math.floor(i / 3),
      u = 0.03 + x * 0.325,
      v = 0.035 + z * 0.485;
    tile.landcover.push({
      id: `fixture:${name}:${i}`,
      class: crop === 'olives' ? 'orchard' : crop === 'grapes' ? 'vineyard' : 'farmland',
      ...(infer ? {} : { crop }),
      polygons: [
        {
          outer: [
            [u, v],
            [u + 0.29, v + (i === 4 ? 0.065 : 0)],
            [u + 0.29, v + 0.43],
            [u, v + 0.43],
          ],
          ...(i === 3
            ? {
                holes: [
                  [
                    [u + 0.1, v + 0.15],
                    [u + 0.15, v + 0.15],
                    [u + 0.15, v + 0.2],
                    [u + 0.1, v + 0.2],
                  ],
                ],
              }
            : {}),
        },
      ],
    });
  });
  const prepared = prepareAgricultureTile(tile, geom, environment);
  const heightfield = new Heightfield(new Float32Array(33 * 33), 33, 33, {
    origin: [originX, originZ],
    worldSize: [size, size],
    height: { min: 0, max: 1 },
  });
  const context = {
    address: { level: 15, x: 0, z: 0 },
    origin: [originX, originZ],
    tileSize: size,
    surfaceResolution: 33,
    heightfield,
    signal: new AbortController().signal,
    admission: { run: async (fn) => fn() },
  };
  const surface = createTerrainSemanticObject(prepared.tile, context, {
    renderBuildings: false,
    renderTransportation: false,
    renderWater: false,
    maxTreesPerTile: 0,
    materials: { landcover: material },
    landcoverColors: { grass: '#a2ad78' },
  });
  scene.add(surface);
  const scatter = environment.scatter([originX, originZ, originX + size, originZ + size]);
  const placements = samplePlacements({
    doc: { ...scatter.doc, rules: prepared.rules },
    pack: scatter.pack,
    request: scatterRequestFromTile(prepared.tile, geom, { roads: 3, buildings: 3, water: 1 }, 1),
    ground: FLAT_GROUND,
    budget: worldgenTileBudgetForQuality(quality, 0),
    tier: quality === 'economy' ? 1 : 0,
  });
  const matrix = new THREE.Matrix4(),
    rotation = new THREE.Quaternion(),
    position = new THREE.Vector3(),
    scale = new THREE.Vector3();
  for (const set of placements) {
    const plant = environment.library.plants[set.modelRef];
    const geometry = createPlantGeometry(plant, quality === 'economy');
    if (!geometry.getAttribute('position').count) {
      geometry.dispose();
      continue;
    }
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
      set.count,
    );
    for (let i = 0; i < set.count; i++) {
      const d = set.data.subarray(i * 10, i * 10 + 10);
      position.set(d[0], d[1], d[2]);
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d[3]);
      scale.set(d[4], d[5], d[6]);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(i, matrix);
    }
    scene.add(mesh);
  }
  const viewpoints = {
    air: [
      [300, 240, 360],
      [120, 0, 120],
    ],
    near: [
      [34, 5, 109],
      [45, 2, 35],
    ],
    wide: [
      [600, 850, 1050],
      [120, 0, 120],
    ],
  };
  camera.position.set(...viewpoints[view][0]);
  camera.lookAt(...viewpoints[view][1]);
  renderer.render(scene, camera);
  const data = {
    name,
    month,
    view,
    quality,
    backend: nodes ? 'TSL through WebGL' : 'WebGL',
    fields: prepared.tile.landcover.flatMap((f) => (f.cultivation ? [f.cultivation] : [])),
    instances: placements.reduce((sum, p) => sum + p.count, 0),
    draws: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
  document.querySelector('#caption').textContent =
    `${name} · ${month ? `month ${month}` : 'mature crops'} · ${quality} · ${infer ? 'regional inference' : 'explicit crop fixture'} · ${data.instances.toLocaleString()} plant patches`;
  window.farmEvidence = data;
  return data;
};
await window.showFarm();
window.farmReady = true;
