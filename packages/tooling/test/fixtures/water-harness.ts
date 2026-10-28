import { applyEnvironment, createViewer } from '@bendyline/molen-client';
import * as THREE from 'three';
import { EARTH_EXPOSURE, EARTH_LIGHTING, EARTH_SKY_PALETTE } from '../../../earth/src/client/look';
import { EARTH_WATER_CONDITIONS } from '../../../earth/src/client/water';
import {
  createTerrainWaterMaterialAsync,
  setTerrainWaterTime,
} from '../../../terrain/src/semantic-client';

const params = new URLSearchParams(location.search);
const backend = params.get('backend') === 'webgpu' ? 'webgpu' : 'webgl';
const viewer = await createViewer({
  canvas: document.querySelector('canvas') as HTMLCanvasElement,
  backend,
  reflections: true,
  optimizeWebGpu: false,
  width: 960,
  height: 640,
  antialias: true,
  preserveDrawingBuffer: true,
});
const renderer = viewer.renderer;
applyEnvironment(renderer, {
  toneMapping: 'aces',
  exposure: EARTH_EXPOSURE,
  sky: {
    mode: 'custom',
    palette: EARTH_SKY_PALETTE,
    lighting: EARTH_LIGHTING,
    sunBody: { direction: [-0.5, 0.45, -0.75] },
  },
});
const water = await createTerrainWaterMaterialAsync(
  {
    swells: params.has('noSwells') ? [] : EARTH_WATER_CONDITIONS.waves,
    ...(params.has('still') ? { waveSpeed: 0 } : {}),
    ...(params.has('flat') ? { waveStrength: 0 } : {}),
  },
  backend,
);
const plane = new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2);
renderer.worldRoot.add(new THREE.Mesh(plane, water));
const api = {
  async frame(time: number, far = false, origin: [number, number] = [0, 0]) {
    renderer.setCamera({
      position: [0, far ? 180 : 7, far ? 300 : 25],
      lookAt: [0, 0, far ? -250 : -30],
    });
    renderer.setWorldOrigin([origin[0], 0, origin[1]]);
    setTerrainWaterTime(water, time, origin);
    renderer.render();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    renderer.render();
    return { backend: renderer.backend, textures: renderer.three.info.memory.textures };
  },
};
declare global {
  interface Window {
    waterQA: typeof api;
  }
}
window.waterQA = api;
