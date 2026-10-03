/** An independent real-terrain fixture; no model-fitting correction is applied to the DEM. */
import { MaterialResolver } from '@bendyline/molen-client';
import {
  buildChunkGeometry,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  type TerrainDescriptor,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import { createResolvedMaterialSet, StructureModelLibrary } from '@bendyline/molen-worldgen/client';
import { resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';
import { createWorldgenSemanticRenderers } from '@bendyline/molen-worldgen-earth/client';
import {
  createStructureIndex,
  type StructureCatalogDoc,
} from '@bendyline/molen-worldgen-earth/kernel';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { omitUnknownTriangles, sampleEvidenceGrid } from './terrain-evidence-sampling';

declare const __LANDMARK_CONTENT_ROOT__: string;
type Triplet = [number, number, number];
interface Evidence {
  candidateId: string;
  title: string;
  modelFolder: string;
  anchor: [number, number];
  heading: number;
  factor: number;
  worldOrigin: [number, number];
  size: number;
  resolution: number;
  heights: (number | null)[];
  heightRange: [number, number];
  anchorElevation: number | null;
  renderOriginElevation?: number;
  sourceLabel?: string;
}
const content = `/@fs/${__LANDMARK_CONTENT_ROOT__}/`;
const terrainSet = new URLSearchParams(location.search).get('terrainSet') ?? '';
const reviewRoads = new URLSearchParams(location.search).get('roads') === '1';
if (terrainSet && !['copernicus', 'ign', 'gsi', 'gugik', 'wales'].includes(terrainSet))
  throw new Error('Unknown terrain evidence set');
const terrainFolder = `earth/structures/evidence/bridge-terrain/${terrainSet ? `${terrainSet}/` : ''}`;
async function json<T>(path: string): Promise<T> {
  const response = await fetch(content + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
const pack = await resolveStylePackDocuments(await json('worldgen/stylepack.json'), (path) =>
  json(`worldgen/${path}`),
);
const catalog = await json<StructureCatalogDoc>('earth/structures/placements.json');
const surfaces = createResolvedMaterialSet(
  new MaterialResolver({
    load: async () => {
      throw new Error('Only shared material graphs are expected');
    },
    loadText: async (ref) => {
      const path = pack.root.materials[ref];
      if (!path) throw new Error(`Unknown material graph ${ref}`);
      return JSON.stringify(await json(`worldgen/${path}`));
    },
  }),
  { progressive: true },
);
const gltf = new GLTFLoader();
let liveGeometries = 0;
const models = new StructureModelLibrary(
  async (asset) => {
    const sidecarPath = pack.assets[asset];
    if (!sidecarPath) throw new Error(`Unknown model asset: ${asset}`);
    const sidecar = await json<{ files: { main: string } }>(`worldgen/${sidecarPath}`);
    const response = await fetch(
      new URL(sidecar.files.main, new URL(`${content}worldgen/${sidecarPath}`, location.href)),
    );
    if (!response.ok) throw new Error(`${asset}: HTTP ${response.status}`);
    const model = (await gltf.parseAsync(await response.arrayBuffer(), '')).scene;
    const refs = new Set<string>(),
      geometries = new Set<THREE.BufferGeometry>();
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!geometries.has(mesh.geometry)) {
        geometries.add(mesh.geometry);
        liveGeometries++;
        mesh.geometry.addEventListener('dispose', () => {
          liveGeometries--;
        });
      }
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (typeof material.userData.molenSurface?.ref === 'string')
          refs.add(material.userData.molenSurface.ref);
      }
    });
    await surfaces.prepare([...refs]);
    return model;
  },
  { resolveSurface: ({ ref, slot }) => surfaces.materialFor(slot, ref) },
);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfd1df');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  logarithmicDepthBuffer: true,
});
renderer.setSize(1440, 1080);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.append(renderer.domElement);
scene.add(new THREE.HemisphereLight('#e6f1ff', '#657364', 2.1));
const sun = new THREE.DirectionalLight('#fff3db', 3);
sun.position.set(-200, 400, 350);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(38, 1440 / 1080, 0.05, 20000);
const ray = new THREE.Raycaster();
let active: Evidence | undefined;
let terrain: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined;
let tile: THREE.Object3D | undefined;
let object: THREE.Object3D | undefined;
let renderers: ReturnType<typeof createWorldgenSemanticRenderers> | undefined;
let nativeFrame = new THREE.Matrix4();
let verticalOrigin = 0;

function unload() {
  if (tile && renderers) {
    scene.remove(tile);
    renderers.humanFeatures.disposeTile?.(tile);
    renderers.dispose();
  }
  if (terrain) {
    terrain.traverse((child) => {
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
    scene.remove(terrain);
    terrain.geometry.dispose();
    terrain.material.dispose();
  }
  tile = undefined;
  object = undefined;
  terrain = undefined;
  active = undefined;
  renderers = undefined;
  return { liveModelGeometries: liveGeometries };
}
async function mount(id: string) {
  unload();
  const evidence = await json<Evidence>(`${terrainFolder}${id}.json`);
  const entry = catalog.entries.find(
    (item) => item.asset === `molen.worldgen.structure.${evidence.modelFolder}`,
  );
  if (entry?.status !== 'preview') throw new Error(`No active placement for ${id}`);
  active = evidence;
  const { worldOrigin: origin, size, resolution, heightRange, heights, factor } = evidence;
  verticalOrigin = evidence.renderOriginElevation ?? evidence.anchorElevation ?? NaN;
  if (!Number.isFinite(verticalOrigin)) throw new Error('Missing render coordinate origin');
  const hasUnknownHeights = heights.some((h) => h === null);
  const height = { min: heightRange[0], max: heightRange[1] };
  const field = new Heightfield(
    // Null slots allocate finite buffer positions only; none of their triangles,
    // grid lines or sampling results may be used as measured terrain.
    Float32Array.from(heights, (h) => ((h ?? height.min) - height.min) / (height.max - height.min)),
    resolution,
    resolution,
    { origin, worldSize: [size, size], height },
  );
  const descriptor: TerrainDescriptor = {
    format: 'molen/terrain@2',
    name: `${id}-actual-terrain`,
    origin,
    chunkSize: size,
    tileResolution: resolution,
    gridSize: [1, 1],
    height,
    tiles: { heightUrl: 'preserved-terrain-evidence' },
    layers: [{ name: 'ground', color: '#93a185', tiling: 1 }],
    lod: { levels: 1, distanceBands: [], skirts: false },
    streaming: { loadRadius: 0, unloadRadius: 0, maxConcurrentLoads: 1, maxResidentTiles: 1 },
    collision: { enabled: false },
    metersPerUnit: factor,
  };
  const data = buildChunkGeometry(field, descriptor, 0, 0, {
    skirt: false,
    localCoordinates: true,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setIndex(
    new THREE.BufferAttribute(
      hasUnknownHeights ? omitUnknownTriangles(data.indices, heights) : data.indices,
      1,
    ),
  );
  if (hasUnknownHeights) geometry.computeVertexNormals();
  terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: '#708462',
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  // A sparse metric grid reveals the original terrain shape without constructing
  // a second surface or obscuring the bridge with an opaque overlay.
  const lines: number[] = [];
  const linePoint = (row: number, col: number) => {
    const offset = (row * resolution + col) * 3;
    lines.push(
      data.positions[offset],
      data.positions[offset + 1] + 0.08,
      data.positions[offset + 2],
    );
  };
  for (let a = 0; a < resolution; a += 4) {
    for (let b = 0; b < resolution - 1; b++) {
      if (heights[a * resolution + b] !== null && heights[a * resolution + b + 1] !== null) {
        linePoint(a, b);
        linePoint(a, b + 1);
      }
      if (heights[b * resolution + a] !== null && heights[(b + 1) * resolution + a] !== null) {
        linePoint(b, a);
        linePoint(b + 1, a);
      }
    }
  }
  const grid = new THREE.BufferGeometry();
  grid.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  terrain.add(
    new THREE.LineSegments(
      grid,
      new THREE.LineBasicMaterial({ color: '#284b38', transparent: true, opacity: 0.4 }),
    ),
  );
  terrain.position.set(-size / 2, -verticalOrigin, -size / 2);
  scene.add(terrain);
  const semantic = createEmptyTerrainSemanticTile();
  if (
    reviewRoads &&
    ((terrainSet === 'gsi' && id === 'N0021') ||
      (terrainSet === 'gugik' && id === 'N0029') ||
      (terrainSet === 'wales' && id === 'N0015'))
  ) {
    const roadEvidence = await json<{
      features: { id: string; tags: Record<string, string>; coordinates: [number, number][] }[];
    }>(`${terrainFolder}${id}-road-profile.json`);
    for (const road of roadEvidence.features) {
      // Independent mapped carriageway and both bridge sidewalks plus their adjoining
      // ground segments. Do not turn unrelated bank paths into bridge approaches.
      if (
        !(
          id === 'N0015'
            ? [
                '60781949',
                '60781969',
                '309648399',
                '855457353',
                '855457355',
                '31191717',
                '167201327',
                '167201338',
                '172233191',
                '172233201',
              ]
            : id === 'N0021'
              ? [
                  '27794392',
                  '27794399',
                  '361084556',
                  '273471558',
                  '273471562',
                  '273471569',
                  '273471585',
                  '465069395',
                  '465069396',
                ]
              : [
                  '237351914',
                  '303805844',
                  '331947900',
                  '462094677',
                  '589900396',
                  '589900405',
                  '4941144',
                  '186137543',
                  '589900403',
                  '589900406',
                  '4925775',
                  '229399399',
                  '186137533',
                  '232658141',
                  '996552885',
                  '589900438',
                  '589900439',
                  // Independent lower-bank roads must survive landmark replacement.
                  '173870821',
                  '1208164349',
                  '119695456',
                  '195284372',
                ]
        ).includes(road.id)
      )
        continue;
      const footway = ['footway', 'path', 'cycleway', 'pedestrian'].includes(road.tags.highway);
      const laneCount = Number(road.tags.lanes);
      semantic.transportation.push({
        id: road.id,
        name: road.tags['name:en'] ?? road.tags.name,
        class: footway ? 'path' : 'tertiary',
        bridge: ['yes', 'viaduct'].includes(road.tags.bridge),
        tunnel: !!road.tags.tunnel && road.tags.tunnel !== 'no',
        layer: Number(road.tags.layer ?? 0),
        width:
          Number(road.tags.width) ||
          (id === 'N0015' && road.tags.highway === 'pedestrian'
            ? 3.84
            : footway
              ? 2.8
              : id === 'N0021'
                ? 8.8
                : 7),
        lanes: !footway && Number.isSafeInteger(laneCount) && laneCount > 0 ? laneCount : undefined,
        oneway: road.tags.oneway === 'yes',
        lines: [
          road.coordinates.map((point) => {
            const [x, z] = wgs84ToWorld(factor, ...point);
            return [(x - origin[0]) / size, (z - origin[1]) / size];
          }),
        ],
      });
    }
  } else if (reviewRoads) {
    if (!['N0019', 'N0026', 'N0028'].includes(id) || terrainSet !== 'ign')
      throw new Error('No reviewed road context for this bridge');
    const roadEvidence = await json<{
      features: {
        featureId: string;
        properties: Record<string, unknown>;
        localPoints: { x: number; z: number; absoluteElevation: number }[];
      }[];
    }>(`${terrainFolder}${id}-road-profile.json`);
    const [cx, cz] = wgs84ToWorld(factor, ...entry.anchor);
    const c = Math.cos(entry.heading ?? 0),
      s = Math.sin(entry.heading ?? 0);
    for (const road of roadEvidence.features) {
      const name =
        road.properties.cpx_toponyme_route_nommee ?? road.properties.nom_collaboratif_gauche;
      if (
        typeof name !== 'string' ||
        (id === 'N0026'
          ? !name.includes('Périphérique') ||
            Number(road.properties.position_par_rapport_au_sol) <= 0
          : id === 'N0019'
            ? ![
                "PONT DE L'ARCHEVECHE",
                "QU DE L'ARCHEVECHE",
                'QUAI DE MONTEBELLO',
                'QU DE MONTEBELLO',
                'QU DE LA TOURNELLE',
                'PORT DE LA TOURNELLE',
              ].includes(name)
            : ![
                'PONT DE TOLBIAC',
                'PORT DE TOLBIAC',
                'PORT DE LA GARE',
                'PORT DE BERCY',
                'QU DE BERCY',
              ].includes(name))
      )
        continue;
      semantic.transportation.push({
        id: road.featureId,
        name,
        class: id === 'N0026' ? 'motorway' : 'primary',
        bridge: Number(road.properties.position_par_rapport_au_sol) > 0,
        layer: Number(road.properties.position_par_rapport_au_sol),
        width: Number(road.properties.largeur_de_chaussee) || 14,
        lanes: Number(road.properties.nombre_de_voies) || (id === 'N0026' ? 4 : 2),
        oneway: id === 'N0026',
        // Only the independently mapped plan is passed to the normal procedural renderer.
        // Source Z is retained in the evidence report, never used to fabricate a flat deck.
        lines: [
          road.localPoints.map(({ x, z }) => [
            (cx + c * x + s * z - origin[0]) / size,
            (cz - s * x + c * z - origin[1]) / size,
          ]),
        ],
      });
    }
  }
  renderers = createWorldgenSemanticRenderers(pack, {
    structures: createStructureIndex(catalog),
    structureObjects: models,
    metersPerUnit: factor,
    roads: { renderTransportation: reviewRoads },
    sampleStructureTerrain: (coordinate: readonly [number, number]) => {
      const [x, z] = wgs84ToWorld(factor, ...coordinate);
      return sampleEvidenceGrid(heights, resolution, size, origin, x, z);
    },
  });
  const context: TerrainPyramidTileLayerContext = {
    address: { level: 16, x: 0, z: 0 },
    origin,
    tileSize: size,
    descriptor,
    pyramid: {
      name: 'bridge-terrain-review',
      origin,
      rootSize: size,
      minLevel: 16,
      maxLevel: 16,
      tileResolution: resolution,
      height,
      layers: [],
      skirts: false,
    },
    heightfield: field,
    signal: new AbortController().signal,
  };
  tile = (await renderers.humanFeatures.createTile(semantic, context)) ?? undefined;
  object = tile?.getObjectByName(`structure:${entry.id}`);
  if (!tile || !object) throw new Error(`Production renderer did not place ${id}`);
  tile.traverse((child) => {
    if (child.name.startsWith('structure:')) child.visible = child === object;
  });
  tile.position.set(-size / 2, -verticalOrigin, -size / 2);
  scene.add(tile);
  scene.updateMatrixWorld(true);
  // Extended structures have their native transform baked into clipped tile geometry.
  // Keep the authored coordinate frame separately for identical cameras and ray stations.
  const [anchorX, anchorZ] = wgs84ToWorld(factor, ...entry.anchor);
  const elevation = object.userData.structureElevation as number;
  nativeFrame = new THREE.Matrix4().compose(
    new THREE.Vector3(
      anchorX - origin[0] - size / 2,
      elevation - verticalOrigin,
      anchorZ - origin[1] - size / 2,
    ),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.heading ?? 0),
    new THREE.Vector3(...(entry.scale ?? [1, 1, 1])),
  );
  const title = document.querySelector('#title'),
    detail = document.querySelector('#detail');
  if (title) title.textContent = `${id}: ${evidence.title}`;
  if (detail)
    detail.textContent = `Production placement over ${evidence.sourceLabel ?? 'original Terrarium elevation'} · no terrain correction`;
  const bounds = new THREE.Box3().setFromObject(object);
  return {
    placement: entry,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    anchorElevation: evidence.anchorElevation,
    ...(hasUnknownHeights
      ? {
          noDataPolicy: 'omit unknown triangles; host sampler returns undefined',
          renderOriginElevation: verticalOrigin,
        }
      : {}),
    modelOriginElevation: elevation,
    roadContext: {
      enabled: reviewRoads,
      sourceFeatureIds: semantic.transportation.map((road) => road.id),
    },
  };
}
function aim(position: Triplet, lookAt: Triplet, fov = 38) {
  if (!object || !active) throw new Error('Mount a bridge first');
  camera.position.copy(new THREE.Vector3(...position).applyMatrix4(nativeFrame));
  const requestedPosition = camera.position.toArray();
  if (terrain) {
    ray.set(
      new THREE.Vector3(camera.position.x, 10000, camera.position.z),
      new THREE.Vector3(0, -1, 0),
    );
    const cameraGround = ray.intersectObject(terrain, false)[0];
    if (cameraGround) camera.position.y = Math.max(camera.position.y, cameraGround.point.y + 2);
  }
  const target = new THREE.Vector3(...lookAt).applyMatrix4(nativeFrame);
  const distance = camera.position.distanceTo(target);
  // A 5 cm near plane loses centimetre-scale road depth at a 380 m overview.
  // Preserve paint and deck separation while keeping the entire terrain field visible.
  camera.near = Math.max(0.05, distance / 100);
  camera.far = Math.max(500, distance + active.size * 3);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  return { requestedPosition, actualPosition: camera.position.toArray(), target: target.toArray() };
}
function probe(x: number, z: number) {
  if (!object || !terrain || !active) throw new Error('Mount a bridge first');
  const origin = new THREE.Vector3(x, 10000, z).applyMatrix4(nativeFrame);
  ray.set(origin, new THREE.Vector3(0, -1, 0));
  const modelHit = ray.intersectObject(object, true)[0];
  const groundHit = ray.intersectObject(terrain, false)[0];
  return {
    x,
    z,
    modelSurfaceElevation: modelHit ? modelHit.point.y + verticalOrigin : null,
    terrainElevation: groundHit ? groundHit.point.y + verticalOrigin : null,
    clearance: modelHit && groundHit ? modelHit.point.y - groundHit.point.y : null,
  };
}
const api = { mount, aim, probe, unload };
declare global {
  interface Window {
    bridgeTerrainQA: typeof api;
  }
}
window.bridgeTerrainQA = api;
