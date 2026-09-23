import {
  AssetCache,
  createGltfLoader,
  createUrlAssetProvider,
  createViewer,
  MaterialResolver,
} from '@bendyline/molen-client';
import {
  buffersToObject3D,
  createInstancedPlacements,
  createResolvedMaterialSet,
  createVertexColorMaterialSet,
  ModelLibrary,
  unitBoxGeometry,
} from '@bendyline/molen-worldgen/client';
import {
  type LandmarkDefinitions,
  MeshBufferBuilder,
  type MeshBuffers,
  type MeshGroup,
  PLACEMENT_STRIDE,
  type PlacementSet,
} from '@bendyline/molen-worldgen/kernel';

// Browser-side worldgen preview harness. Bundled by scripts/build-capture.mjs into
// dist/capture/worldgen-preview.js and loaded by worldgen-preview.html. Node generates the
// buffers; the page uploads exactly those buffers (plus instanced props and scatter) and
// renders one deterministic frame per camera request. The first request carries the scene;
// later requests only move the camera.

interface ScenePayload {
  buffers?: {
    positions: string;
    normals: string;
    uvs: string;
    colors: string;
    indices: string;
    groups: MeshGroup[];
  };
  placements: Array<Omit<PlacementSet, 'data'> & { data: string }>;
  filesBaseUrl: string;
  assetIndex: Record<string, string>;
  materialRefs: string[];
  landmarks: LandmarkDefinitions;
  ground: { y: number; minX: number; minZ: number; maxX: number; maxZ: number };
  clearColor: string;
}

interface PreviewRequest {
  scene?: ScenePayload;
  camera: { position: [number, number, number]; lookAt: [number, number, number] };
  size: [number, number];
}

interface PreviewResponse {
  drawCalls: number;
  triangles: number;
  instances: number;
  materialFailures: string[];
}

declare global {
  interface Window {
    __molenWorldgenPreview(req: PreviewRequest): Promise<PreviewResponse>;
  }
}

function bytesOf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let index = 0; index < bin.length; index++) out[index] = bin.charCodeAt(index);
  return out;
}

function float32(b64: string): Float32Array {
  const bytes = bytesOf(b64);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

function uint32(b64: string): Uint32Array {
  const bytes = bytesOf(b64);
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

function meshBuffers(payload: NonNullable<ScenePayload['buffers']>): MeshBuffers {
  const positions = float32(payload.positions);
  const indices = uint32(payload.indices);
  const colors = bytesOf(payload.colors);
  return {
    positions,
    normals: float32(payload.normals),
    uvs: float32(payload.uvs),
    colors,
    indices,
    groups: payload.groups,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    bytes: positions.byteLength * 2 + colors.byteLength + indices.byteLength,
  };
}

function groundBuffers(ground: ScenePayload['ground']): MeshBuffers {
  const out = new MeshBufferBuilder();
  out.addQuad(
    'foundation',
    'palette:#ffffff',
    [
      [ground.minX, ground.y, ground.minZ],
      [ground.maxX, ground.y, ground.minZ],
      [ground.maxX, ground.y, ground.maxZ],
      [ground.minX, ground.y, ground.maxZ],
    ],
    [0, 1, 0],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    [0.53, 0.58, 0.45],
  );
  return out.finalize();
}

interface Session {
  viewer: Awaited<ReturnType<typeof createViewer>>;
  instances: number;
  materialFailures: string[];
  dispose(): void;
}

let session: Session | undefined;

async function buildSession(scene: ScenePayload, size: [number, number]): Promise<Session> {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  canvas.style.width = `${size[0]}px`;
  canvas.style.height = `${size[1]}px`;
  const viewer = await createViewer({
    // Pinned for the same reason as the capture harness: reproducible pixels.
    backend: 'webgl',
    canvas,
    width: size[0],
    height: size[1],
    pixelRatio: 1,
    antialias: false,
    clearColor: scene.clearColor,
    cameraNear: 0.5,
    cameraFar: 5000,
  });
  const provider = createUrlAssetProvider(scene.filesBaseUrl, scene.assetIndex);
  const resolver = new MaterialResolver(provider);
  const materials = createResolvedMaterialSet(resolver);
  await materials.prepare(scene.materialRefs);
  const flat = createVertexColorMaterialSet();
  const root = viewer.renderer.worldRoot;
  root.add(buffersToObject3D(groundBuffers(scene.ground), flat, 'preview:ground'));
  if (scene.buffers !== undefined) {
    root.add(buffersToObject3D(meshBuffers(scene.buffers), materials, 'preview:buildings'));
  }
  const assets = new AssetCache(provider, createGltfLoader());
  const models = new ModelLibrary(
    async (ref) => (await assets.instance(ref)).scene,
    scene.landmarks,
  );
  let instances = 0;
  for (const entry of scene.placements) {
    const data = float32(entry.data);
    const set: PlacementSet = {
      setId: entry.setId,
      modelRef: entry.modelRef,
      count: entry.count,
      data,
    };
    if (data.length < set.count * PLACEMENT_STRIDE) continue;
    if (set.modelRef === 'builtin:box') {
      root.add(
        createInstancedPlacements(
          set,
          unitBoxGeometry(),
          flat.materialFor('wall', 'palette:#ffffff'),
          `preview:${set.setId}`,
        ),
      );
    } else {
      const prepared = await models.prepare(set.modelRef);
      root.add(
        createInstancedPlacements(
          set,
          prepared.geometry,
          prepared.material,
          `preview:${set.setId}`,
        ),
      );
    }
    instances += set.count;
  }
  await viewer.ready();
  return {
    viewer,
    instances,
    materialFailures: [...materials.failures.keys()],
    dispose(): void {
      viewer.dispose();
      materials.dispose();
      flat.dispose?.();
      models.dispose();
    },
  };
}

window.__molenWorldgenPreview = async (req: PreviewRequest): Promise<PreviewResponse> => {
  if (req.scene !== undefined) {
    session?.dispose();
    session = await buildSession(req.scene, req.size);
  }
  if (session === undefined) throw new Error('the first preview request must carry a scene');
  session.viewer.setCamera({ position: req.camera.position, lookAt: req.camera.lookAt });
  session.viewer.renderFrame();
  const stats = session.viewer.renderer.stats();
  return {
    drawCalls: stats.drawCalls,
    triangles: stats.triangles,
    instances: session.instances,
    materialFailures: session.materialFailures,
  };
};
