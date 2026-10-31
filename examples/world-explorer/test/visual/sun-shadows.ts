/** Exercise the Earth startup and quality transitions with thin aircraft-sized casters. */
import { applyEnvironment, Renderer, type ShadowQuality } from '@bendyline/molen-client';
import * as THREE from 'three';
import { earthShadowFocus } from '../../../../packages/earth/src/client/look';

const backend =
  new URLSearchParams(location.search).get('backend') === 'webgpu' ? 'webgpu' : 'webgl';
const renderer = await Renderer.create({
  backend,
  width: 640,
  height: 480,
  antialias: true,
  reverseDepthBuffer: true,
  preserveDrawingBuffer: true,
  optimizeWebGpu: false,
});
document.body.append(renderer.three.domElement);
applyEnvironment(renderer, {
  ambient: { intensity: 1 },
  sun: { direction: [0.3, 1, 0.5], intensity: 4 },
  toneMapping: 'aces',
});
renderer.setShadowQuality('high');
renderer.setShadowQuality('off');
const sun = renderer.scene
  .getObjectByName('$environment')
  ?.children.find((object) => object instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ color: '#888888' }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
renderer.worldRoot.add(ground);
const material = new THREE.MeshStandardMaterial({ color: '#dddddd' });
for (const [width, height, depth, y, z] of [
  [12, 0.1, 1.6, 2, 0],
  [0.6, 0.6, 9, 2, 0],
  [4, 0.1, 1, 2.3, -3.5],
  [0.1, 2, 0.1, 1, -0.5],
]) {
  const caster = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  caster.position.set(0, y, z);
  caster.castShadow = true;
  caster.receiveShadow = true;
  renderer.worldRoot.add(caster);
}
renderer.setCamera({ position: [0, 10, -12], lookAt: [0, 0, 0] });
renderer.setShadowFocus(earthShadowFocus('fly', [0, 10, -12], [0, -0.64, 0.77], 0));
await renderer.prepareObject(renderer.worldRoot);
const draw = async () => {
  for (let i = 0; i < 3; i++) {
    renderer.render();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
};
await draw();
const api = {
  async quality(quality: ShadowQuality) {
    renderer.setShadowQuality(quality);
    await draw();
    return {
      backend: renderer.backend,
      mapSize: sun.shadow.map?.width,
      texel: (2 * sun.shadow.camera.right) / sun.shadow.mapSize.x,
    };
  },
  dispose() {
    renderer.dispose();
  },
};
declare global {
  interface Window {
    sunShadowsQA: typeof api;
  }
}
window.sunShadowsQA = api;
