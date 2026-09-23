import {
  createClient,
  createSnapshotViewer,
  type MolenClient,
  Renderer,
  THREE,
} from '@bendyline/molen-client';
import type { Keyframe, MessageLink } from '@bendyline/molen-schema';
import {
  createTerrainWaterMaterialAsync,
  setTerrainWaterTime,
} from '@bendyline/molen-terrain/client';
import { buffersToObject3D, createBuildingDetailLod } from '@bendyline/molen-worldgen/client';
import type { MeshBuffers } from '@bendyline/molen-worldgen/kernel';
import { createExplorerSky } from '../../../../examples/world-explorer/src/atmosphere';

export interface BackendCaptureOptions {
  backend?: 'auto' | 'webgl' | 'webgpu';
  mode?: 'perspective' | 'ortho' | 'world';
}

export interface BackendCaptureStats {
  backend: string;
  fallbackReason?: string;
  drawCalls: number;
  triangles: number;
  entities: number;
  width: number;
  height: number;
  pixelRatio: number;
  worldOrigin: number[];
  timerAvailable: boolean;
  sameCanvas: boolean;
  skinnedMeshes: number;
  instancedMeshes: number;
  shadowCasters: number;
  shadowsEnabled: boolean;
  fogFar: number | undefined;
  toneMapping: number;
  gpuValidationErrors: string[];
}

declare global {
  interface Window {
    __backendCapture: {
      create(options: BackendCaptureOptions): Promise<BackendCaptureStats>;
      resizeAndRebase(): Promise<BackendCaptureStats>;
      measureGpu(): Promise<{ supported: boolean; advertised: boolean; samples: number[] }>;
      startLive(): Promise<{
        earlyDelivered: boolean;
        resyncRequests: number;
        subscribedAtResync: boolean;
        tick: number | undefined;
        entities: number;
        commandSent: boolean;
        unhookedAfterDispose: boolean;
      }>;
      renderNodeWebGL(time: number): Promise<{ backend: string; drawCalls: number }>;
      renderWaterOverTerrain(backend: 'webgl' | 'webgpu', reversed: boolean): Promise<void>;
      optimizationStep(
        enabled: boolean,
        step: string,
      ): Promise<{
        drawCalls: number;
        triangles: number;
        cached: boolean;
        storage: boolean;
        errors: string[];
      }>;
      dispose(): void;
    };
  }
}

let viewer: MolenClient | undefined;
let gpuValidationErrors: string[] = [];
let cleanup: (() => void)[] = [];
let disposeNode: (() => void) | undefined;
let renderNode: ((time: number) => Promise<{ backend: string; drawCalls: number }>) | undefined;
let optimizationStep:
  | ((step: string) => Promise<{
      drawCalls: number;
      triangles: number;
      cached: boolean;
      storage: boolean;
      errors: string[];
    }>)
  | undefined;

function canvas(): HTMLCanvasElement {
  return document.querySelector('canvas') as HTMLCanvasElement;
}

function own<T extends { dispose(): void }>(value: T): T {
  cleanup.push(() => value.dispose());
  return value;
}

function dispose(): void {
  disposeNode?.();
  disposeNode = undefined;
  renderNode = undefined;
  optimizationStep = undefined;
  for (const release of cleanup) release();
  cleanup = [];
  viewer?.dispose();
  viewer = undefined;
}

async function presented(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function addMeshFeatures(root: THREE.Object3D): void {
  // Exercise the real worldgen upload paths, including their normalized packed RGB buffers.
  // Float32-only meshes cannot reveal WebGPU's stricter vertex-stride alignment requirements.
  const generatedBox = own(new THREE.BoxGeometry(1, 1, 1));
  const vertexCount = generatedBox.getAttribute('position').count;
  const colors = new Uint8Array(vertexCount * 3);
  for (let vertex = 0; vertex < vertexCount; vertex++) colors.set([30, 190, 215], vertex * 3);
  const buffers: MeshBuffers = {
    positions: generatedBox.getAttribute('position').array as Float32Array,
    normals: generatedBox.getAttribute('normal').array as Float32Array,
    uvs: generatedBox.getAttribute('uv').array as Float32Array,
    colors,
    indices: new Uint32Array(generatedBox.index?.array),
    groups: [{ start: 0, count: 36, slot: 'wall', materialRef: 'palette:#ffffff' }],
    vertexCount,
    triangleCount: 12,
    bytes: 0,
  };
  const generatedMaterial = own(new THREE.MeshStandardMaterial({ vertexColors: true }));
  const materials = { materialFor: () => generatedMaterial };
  const generated = buffersToObject3D(buffers, materials);
  own(generated.geometry);
  generated.position.set(-3, 0.5, 1);
  root.add(generated);
  const detail = createBuildingDetailLod(buffers, materials, generatedMaterial, {
    viewportHeight: 240,
    maxPixelError: 1,
  });
  detail.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) own((object as THREE.Mesh).geometry);
  });
  detail.position.set(-3, 0.5, 3);
  root.add(detail);
  const texture = own(
    new THREE.DataTexture(
      new Uint8Array([255, 245, 50, 255, 10, 70, 170, 255, 10, 70, 170, 255, 255, 245, 50, 255]),
      2,
      2,
    ),
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  const pbr = own(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4, metalness: 0.2 }));
  const box = own(new THREE.BoxGeometry(1.3, 1.3, 1.3));
  const instances = own(new THREE.InstancedMesh(box, pbr, 4));
  instances.castShadow = true;
  instances.receiveShadow = true;
  for (let i = 0; i < 4; i++) {
    instances.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-3 + i * 2, 0.7, -2));
  }
  root.add(instances);

  const geometry = own(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 12, 4));
  const positions = geometry.getAttribute('position');
  const joints: number[] = [];
  const weights: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const weight = THREE.MathUtils.clamp((positions.getY(i) + 1.2) / 2.4, 0, 1);
    joints.push(0, 1, 0, 0);
    weights.push(1 - weight, weight, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const skinMaterial = own(new THREE.MeshStandardMaterial({ color: '#e75d78', roughness: 0.65 }));
  const skin = new THREE.SkinnedMesh(geometry, skinMaterial);
  skin.castShadow = true;
  skin.receiveShadow = true;
  const base = new THREE.Bone();
  const tip = new THREE.Bone();
  tip.position.y = 1.2;
  base.add(tip);
  skin.add(base);
  const skeleton = own(new THREE.Skeleton([base, tip]));
  skin.bind(skeleton);
  tip.rotation.z = -0.5;
  skin.position.set(2, 1.3, 1);
  root.add(skin);

  const floor = new THREE.Mesh(
    own(new THREE.PlaneGeometry(12, 10)),
    own(new THREE.MeshStandardMaterial({ color: '#53644e', roughness: 0.95 })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  root.add(floor);
}

function stats(): BackendCaptureStats {
  if (!viewer) throw new Error('viewer not created');
  const renderer = viewer.renderer;
  let skinnedMeshes = 0;
  let instancedMeshes = 0;
  let shadowCasters = 0;
  renderer.worldRoot.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes++;
    if ((object as THREE.InstancedMesh).isInstancedMesh) instancedMeshes++;
    if ((object as THREE.Mesh).isMesh && object.castShadow) shadowCasters++;
  });
  const timer = renderer.createGpuTimer();
  const timerAvailable = timer !== undefined;
  timer?.dispose();
  return {
    backend: renderer.backend,
    fallbackReason: renderer.fallbackReason,
    ...renderer.stats(),
    entities: viewer.objectCount(),
    width: canvas().width,
    height: canvas().height,
    pixelRatio: renderer.three.getPixelRatio(),
    worldOrigin: renderer.getWorldOrigin(),
    timerAvailable,
    sameCanvas: renderer.three.domElement === canvas(),
    skinnedMeshes,
    instancedMeshes,
    shadowCasters,
    shadowsEnabled: renderer.three.shadowMap.enabled,
    fogFar: renderer.scene.fog instanceof THREE.Fog ? renderer.scene.fog.far : undefined,
    toneMapping: renderer.three.toneMapping,
    gpuValidationErrors: [...gpuValidationErrors],
  };
}

window.__backendCapture = {
  async create(options) {
    dispose();
    const keyframe: Keyframe = {
      kind: 'keyframe',
      v: 1,
      engine: '',
      tick: 15,
      tickRate: 30,
      seed: 'backend-capture',
      nextEntitySeq: 1,
      rng: { algo: 'sfc32', state: [0, 0, 0, 0] },
      plugins: {},
      entities: {
        crate: {
          transform: { pos: [-1, 0, 1], rot: [0, 0, 0, 1], scale: [2, 2, 2] },
          renderable: {
            kind: 'gltf',
            ref: 'crate',
            animation: { clip: 'spin', loop: 'repeat' },
            shadows: { cast: true, receive: true },
          },
          environment: {
            ambient: { sky: '#d3e7ff', ground: '#526043', intensity: 1.5 },
            sun: { direction: [3, 8, 2], intensity: 2.5, castShadow: true },
            fog: { color: '#b4c8d8', near: 15, far: 60 },
            toneMapping: 'aces',
            exposure: 0.9,
            shadows: 'low',
          },
        },
      },
    };
    viewer = await createSnapshotViewer(keyframe, {
      backend: options.backend,
      canvas: canvas(),
      width: 320,
      height: 240,
      pixelRatio: 1,
      antialias: false,
      clearColor: '#101822',
      frameLoop: 'manual',
      assets: { baseUrl: location.href, index: { crate: './crate.glb' } },
      cameraFar: options.mode === 'world' ? 1_000_000 : 5000,
      reverseDepthBuffer: options.mode === 'world',
    });
    gpuValidationErrors = [];
    if (viewer.renderer.backend === 'webgpu') {
      const backend = viewer.renderer.three as unknown as {
        backend: { device: GPUDevice };
      };
      backend.backend.device.addEventListener('uncapturederror', (event) => {
        gpuValidationErrors.push(event.error.message);
      });
    }
    addMeshFeatures(viewer.renderer.worldRoot);
    if (options.mode === 'ortho') {
      viewer.renderer.setTopDownOrtho({ center: [0, 0], viewHeight: 10, cameraHeight: 12 });
    } else {
      viewer.setCamera({ position: [7, 6, 10], lookAt: [0, 0, 0] });
    }
    if (options.mode === 'world') {
      const water = own(
        await createTerrainWaterMaterialAsync(
          { waveScale: 0.4, waveStrength: 0.12 },
          viewer.renderer.backend,
        ),
      );
      setTerrainWaterTime(water, 8);
      const waterMesh = new THREE.Mesh(own(new THREE.PlaneGeometry(100, 100)), water);
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.y = -0.1;
      viewer.renderer.worldRoot.add(waterMesh);
      const sky = await createExplorerSky(viewer.renderer.backend);
      own(sky.material);
      own(sky.geometry);
      viewer.renderer.scene.add(sky);
    }
    await viewer.ready();
    viewer.renderFrame();
    await presented();
    return stats();
  },
  async resizeAndRebase() {
    if (!viewer) throw new Error('viewer not created');
    viewer.renderer.three.setPixelRatio(1.5);
    viewer.renderer.setSize(400, 240);
    // Put both the scene and camera at distant world coordinates, then bring the rendering
    // origin near them. Moving only the origin away from a scene at zero defeats rebasing
    // and introduces artificial GPU precision loss (especially in WebGL skinning).
    const offset = new THREE.Vector3(1_000_000, 0, -1_000_000);
    for (const object of viewer.renderer.worldRoot.children) object.position.add(offset);
    const ortho = viewer.renderer.camera instanceof THREE.OrthographicCamera;
    viewer.renderer.setWorldOrigin([offset.x, 0, offset.z]);
    if (ortho) {
      viewer.renderer.setTopDownOrtho({
        center: [offset.x, offset.z],
        viewHeight: 10,
        cameraHeight: 12,
      });
    } else {
      viewer.setCamera({
        position: [offset.x + 7, 6, offset.z + 10],
        lookAt: [offset.x, 0, offset.z],
      });
    }
    viewer.renderFrame();
    await presented();
    return stats();
  },
  async measureGpu() {
    if (!viewer) throw new Error('viewer not created');
    const renderer = viewer.renderer;
    const advertised =
      'hasFeature' in renderer.three && renderer.three.hasFeature('timestamp-query');
    const timer = renderer.createGpuTimer({ sampleEveryFrames: 1 });
    if (!timer) return { supported: false, advertised, samples: [] };
    const samples: number[] = [];
    try {
      for (let frame = 0; frame < 20 && samples.length < 2; frame++) {
        timer.begin();
        viewer.renderFrame();
        timer.end();
        await presented();
        const sample = timer.poll();
        if (sample !== undefined) samples.push(sample);
      }
    } finally {
      timer.dispose();
    }
    return { supported: true, advertised, samples };
  },
  async startLive() {
    dispose();
    const keyframe: Keyframe = {
      kind: 'keyframe',
      v: 1,
      engine: '',
      tick: 42,
      tickRate: 30,
      seed: 'live-startup',
      nextEntitySeq: 1,
      rng: { algo: 'sfc32', state: [0, 0, 0, 0] },
      plugins: {},
      entities: {
        ball: {
          transform: { pos: [-1, 1, 1], rot: [0, 0, 0, 1] },
          renderable: { kind: 'primitive', ref: 'sphere', materialRef: 'palette:#46cfa9' },
        },
      },
    };
    let resyncRequests = 0;
    let subscribedAtResync = false;
    let commandSent = false;
    const link: MessageLink = {
      onmessage: null,
      postMessage(value) {
        const message = value as {
          type?: string;
          control?: { action?: string };
          command?: { type?: string };
        };
        if (message.type === 'control' && message.control?.action === 'request-keyframe') {
          resyncRequests++;
          subscribedAtResync = typeof link.onmessage === 'function';
          link.onmessage?.({ data: { type: 'keyframe', keyframe } });
        }
        if (message.type === 'command' && message.command?.type === 'move') commandSent = true;
      },
    };
    const pending = createClient(link, {
      backend: 'auto',
      canvas: canvas(),
      width: 320,
      height: 240,
      pixelRatio: 1,
      frameLoop: 'manual',
    });
    // The kernel emits immediately while the renderer factory still awaits its backend.
    const earlyDelivered = typeof link.onmessage === 'function';
    link.onmessage?.({ data: { type: 'keyframe', keyframe } });
    viewer = await pending;
    addMeshFeatures(viewer.renderer.worldRoot);
    viewer.setCamera({ position: [7, 6, 10], lookAt: [0, 0, 0] });
    viewer.command('move', { direction: [1, 0] });
    viewer.renderFrame();
    await presented();
    const result = {
      earlyDelivered,
      resyncRequests,
      subscribedAtResync,
      tick: viewer.tick,
      entities: viewer.objectCount(),
      commandSent,
    };
    // Disposal must remove the live transport subscription; the rendered canvas persists.
    viewer.dispose();
    viewer = undefined;
    return { ...result, unhookedAfterDispose: link.onmessage == null };
  },
  async renderNodeWebGL(time) {
    if (renderNode) return renderNode(time);
    dispose();
    // Supplemental TSL execution coverage: WebGPURenderer's WebGL backend is NOT WebGPU.
    const { WebGPURenderer } = await import('three/webgpu');
    const renderer = new WebGPURenderer({ canvas: canvas(), forceWebGL: true, antialias: false });
    await renderer.init();
    renderer.info.autoReset = false;
    renderer.setSize(320, 240, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#d3e7ff', '#526043', 2));
    const light = new THREE.DirectionalLight('#ffffff', 3);
    light.position.set(3, 8, 2);
    scene.add(light);
    const sky = await createExplorerSky('webgpu');
    scene.add(sky);
    const water = await createTerrainWaterMaterialAsync(
      { waveScale: 0.4, waveStrength: 0.2 },
      'webgpu',
    );
    const geometry = new THREE.PlaneGeometry(100, 100);
    const mesh = new THREE.Mesh(geometry, water);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(60, 4 / 3, 0.1, 1_000_000);
    camera.position.set(4, 5, 12);
    camera.lookAt(0, 2, -12);
    disposeNode = () => {
      sky.material.dispose();
      sky.geometry.dispose();
      water.dispose();
      geometry.dispose();
      renderer.dispose();
    };
    renderNode = async (seconds) => {
      setTerrainWaterTime(water, seconds);
      renderer.info.reset();
      renderer.render(scene, camera);
      await presented();
      return {
        backend: renderer.backend.isWebGLBackend ? 'node-webgl' : 'unexpected',
        drawCalls: renderer.info.render.drawCalls,
      };
    };
    return renderNode(time);
  },
  async renderWaterOverTerrain(backend, reversed) {
    dispose();
    const renderer = own(
      await Renderer.create({
        backend,
        canvas: canvas(),
        width: 320,
        height: 240,
        pixelRatio: 1,
        cameraNear: 1,
        cameraFar: 500_000,
        reverseDepthBuffer: reversed,
      }),
    );
    const ground = new THREE.Mesh(
      own(new THREE.PlaneGeometry(6000, 6000)),
      own(new THREE.MeshStandardMaterial({ color: '#69804c' })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 10;
    ground.renderOrder = 15;
    const water = own(await createTerrainWaterMaterialAsync({}, backend));
    const lake = new THREE.Mesh(own(new THREE.PlaneGeometry(3000, 3000)), water);
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = 10.65;
    lake.renderOrder = 2;
    const island = new THREE.Mesh(
      own(new THREE.BoxGeometry(120, 150, 120)),
      own(new THREE.MeshStandardMaterial({ color: '#b34826' })),
    );
    island.position.set(0, 85, 0);
    renderer.worldRoot.add(ground, lake, island);
    renderer.setCamera({ position: [0, 190, 1500], lookAt: [0, 10, 0] });
    // Exercise async shader preparation as well as subsequent ordinary draws.
    await renderer.prepareObject(lake);
    renderer.render();
    await presented();
  },
  async optimizationStep(enabled, step) {
    if (optimizationStep) return optimizationStep(step);
    dispose();
    const renderer = own(
      await Renderer.create({
        backend: 'webgpu',
        optimizeWebGpu: enabled,
        canvas: canvas(),
        width: 320,
        height: 240,
        reverseDepthBuffer: true,
        cameraFar: 500,
      }),
    );
    const errors: string[] = [];
    const driver = renderer.three as unknown as { backend: { device: GPUDevice } };
    driver.backend.device.addEventListener('uncapturederror', (event) =>
      errors.push(event.error.message),
    );
    const group = renderer.createRenderGroup();
    renderer.worldRoot.add(group);
    const geometry = own(new THREE.BoxGeometry(1, 1, 1));
    const material = own(new THREE.MeshStandardMaterial({ color: '#60b6ce' }));
    const instances = own(new THREE.InstancedMesh(geometry, material, 3));
    for (let i = 0; i < 3; i++)
      instances.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 2 - 2, 0, 0));
    instances.instanceMatrix.needsUpdate = true;
    const original = instances.instanceMatrix;
    const lod = new THREE.LOD();
    lod.addLevel(instances, 0);
    const far = own(new THREE.InstancedMesh(own(new THREE.OctahedronGeometry(0.7)), material, 0));
    far.count = 3;
    far.instanceMatrix = original;
    lod.addLevel(far, 20);
    group.add(lod);
    const water = own(
      await createTerrainWaterMaterialAsync({ waveScale: 0.7, waveStrength: 0.35 }, 'webgpu'),
    );
    const waterMesh = new THREE.Mesh(own(new THREE.PlaneGeometry(12, 12)), water);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -2;
    group.add(waterMesh);
    const extra = new THREE.Mesh(geometry, material);
    extra.position.set(0, 2, 0);
    const pose = () => renderer.setCamera({ position: [7, 6, 10], lookAt: [0, 0, 0] });
    pose();
    optimizationStep = async (action) => {
      if (action === 'instances') {
        original.array[13] = 2;
        original.needsUpdate = true;
      } else if (action === 'far') renderer.setCamera({ position: [0, 12, 28], lookAt: [0, 0, 0] });
      else if (action === 'near' || action === 'return') pose();
      else if (action === 'hide') lod.visible = false;
      else if (action === 'show') lod.visible = true;
      else if (action === 'count') instances.count = 2;
      else if (action === 'material') material.color.set('#da773a');
      else if (action === 'pipeline') {
        material.wireframe = true;
        material.needsUpdate = true;
      } else if (action === 'geometry') geometry.scale(1, 1.6, 1);
      else if (action === 'add') group.add(extra);
      else if (action === 'remove') group.remove(extra);
      else if (action === 'away') renderer.setCamera({ position: [0, 0, 10], lookAt: [0, 0, 20] });
      else if (action === 'rebase') {
        group.position.set(1_000_000, 0, -1_000_000);
        renderer.setWorldOrigin([1_000_000, 0, -1_000_000]);
        renderer.setCamera({
          position: [1_000_007, 6, -999_990],
          lookAt: [1_000_000, 0, -1_000_000],
        });
      } else if (action === 'resize') renderer.setSize(400, 240);
      else if (action === 'pixel-ratio') renderer.three.setPixelRatio(1.5);
      else if (action === 'animation') setTerrainWaterTime(water, 6);
      // Exercise cached execution after every mutation, not just command recording. Camera and
      // projection changes intentionally remain on ordinary draws through the optimizer's
      // fixed-step hysteresis window before recording a new bundle.
      const frames = ['far', 'near', 'away', 'return', 'rebase', 'resize'].includes(action) ? 9 : 2;
      for (let frame = 0; frame < frames; frame++) {
        renderer.render();
        await presented();
      }
      return {
        ...renderer.stats(),
        cached: 'isBundleGroup' in group && group.isBundleGroup === true,
        storage: 'isStorageInstancedBufferAttribute' in instances.instanceMatrix,
        errors: [...errors],
      };
    };
    return optimizationStep(step);
  },
  dispose,
};
