/** Small GPU regression fixture; independent of landmark authoring capture hashes. */
import { applyEnvironment, createViewer } from '@bendyline/molen-client';
import * as THREE from 'three';

const backend =
  new URLSearchParams(location.search).get('backend') === 'webgpu' ? 'webgpu' : 'webgl';
const viewer = await createViewer({
  canvas: document.querySelector<HTMLCanvasElement>('#view') as HTMLCanvasElement,
  backend,
  reflections: true,
  optimizeWebGpu: false,
  width: 640,
  height: 480,
  antialias: true,
  preserveDrawingBuffer: true,
});
const renderer = viewer.renderer;
renderer.three.toneMapping = THREE.ACESFilmicToneMapping;
renderer.three.toneMappingExposure = 1;
renderer.setCamera({ position: [0, 0.5, 5], lookAt: [0, 0, 0] });
const geometry = new THREE.SphereGeometry(1.35, 80, 40);
const material = new THREE.MeshStandardMaterial({
  color: '#f4f3ef',
  metalness: 1,
  roughness: 0.28,
});
const sphere = new THREE.Mesh(geometry, material);
renderer.worldRoot.add(sphere);
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const draw = async () => {
  renderer.render();
  await frame();
  renderer.render();
  await frame();
};

const api = {
  async view(mode: string) {
    if (mode !== 'moved') {
      applyEnvironment(renderer, {
        toneMapping: 'aces',
        sky: {
          mode: 'custom',
          sunBody: { direction: mode === 'night' ? [0, -1, 0] : [0.3, 0.8, 0.4] },
          lighting: { sunIntensity: 0, moonIntensity: 0 },
        },
      });
      renderer.setWeather(mode === 'cloudy' ? { clouds: { coverage: 1 } } : undefined);
    }
    renderer.scene.environmentIntensity = mode === 'unlit' ? 0 : 1;
    if (mode === 'moved') renderer.setCamera({ position: [0.2, 0.6, 5], lookAt: [0, 0, 0] });
    await draw();
    const texture = renderer.scene.environment;
    return {
      backend: renderer.backend,
      uuid: texture?.uuid,
      textures: renderer.three.info.memory.textures,
      mapping: texture?.mapping,
      width: texture?.image.width,
      height: texture?.image.height,
    };
  },
  async stable() {
    const before = renderer.three.info.memory.textures;
    const uuid = renderer.scene.environment?.uuid;
    for (let i = 0; i < 12; i++) await draw();
    return {
      before,
      after: renderer.three.info.memory.textures,
      uuid,
      afterUuid: renderer.scene.environment?.uuid,
    };
  },
  dispose() {
    viewer.dispose();
    geometry.dispose();
    material.dispose();
    return { environmentCleared: renderer.scene.environment === null };
  },
};
(window as unknown as { skyReflectionsQA: typeof api }).skyReflectionsQA = api;
