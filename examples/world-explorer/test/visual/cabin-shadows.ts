/**
 * The driver's view of a pickup on a straight road with a low sun behind it, the way Earth aims sun
 * shadows while driving. Measures how much the cabin changes from one frame to the next: nothing
 * in it moves, so any change is shadow flicker.
 */
import { applyEnvironment, measureShadowSubject, Renderer } from '@bendyline/molen-client';
import { createVehicleVisual } from '@bendyline/molen-client/vehicles';
import type { VehicleData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../../../../content/entities/assets/molen/entities/vehicle/chevrolet_silverado_1500_2025/model.glb?url';
import types from '../../../../content/entities/source/vehicles/chevrolet-silverado-1500-2025/entity.types.json';
import { earthShadowFocus } from '../../../../packages/earth/src/client/look';

const params = new URLSearchParams(location.search);
const WIDTH = 640;
const HEIGHT = 480;
const renderer = await Renderer.create({
  backend: 'webgl',
  width: WIDTH,
  height: HEIGHT,
  antialias: true,
  reverseDepthBuffer: true,
  preserveDrawingBuffer: true,
  optimizeWebGpu: false,
});
document.body.append(renderer.three.domElement);
// Driving north at noon in November: the sun 24 degrees up, behind the truck and a little left.
const toSun = new THREE.Vector3(0.25, 0.42, -0.87).normalize();
applyEnvironment(renderer, {
  ambient: { intensity: 0.8 },
  sun: { direction: toSun.toArray(), intensity: 3 },
  toneMapping: 'aces',
});
const quality = (params.get('quality') ?? 'high') as 'medium' | 'high';
renderer.setShadowQuality(quality);
// In 8 m squares, as terrain is: across one triangle 40 km wide, a software renderer's
// interpolation put the car's shadow as much as a meter off, differently each frame.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2_000, 2_000, 250, 250),
  new THREE.MeshStandardMaterial({ color: '#6f6f6a' }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
renderer.worldRoot.add(ground);

const vehicle = (
  Object.values(types.types)[0] as unknown as { components: { vehicle: VehicleData } }
).components.vehicle;
const { scene: model } = await new GLTFLoader().loadAsync(modelUrl);
const visual = createVehicleVisual(model, vehicle);
renderer.worldRoot.add(model);
// As the hosts do for the driven car: a sun map of its own, which the cabin's shade comes from.
// `?subject=0` leaves the truck to the main map, as on WebGPU.
const ownShadow =
  params.get('subject') !== '0' && renderer.setShadowSubject(measureShadowSubject(model));

// 28 km/h, the speed in the report, at 60 frames per second.
const STEP = Number(params.get('kmh') ?? 28) / 3.6 / 60;
// The driver's view pitch when the report was captured.
const LOOK_PITCH = -0.188;
const eye = new THREE.Vector3();
const look = new THREE.Vector3();
const place = (z: number): void => {
  model.position.set(0, 0, z);
  model.updateMatrixWorld(true);
  eye.fromArray(vehicle.spec.driverEye).applyMatrix4(model.matrixWorld);
  const direction: [number, number, number] = [0, Math.sin(LOOK_PITCH), Math.cos(LOOK_PITCH)];
  look.copy(eye).add(new THREE.Vector3(...direction).multiplyScalar(10));
  renderer.setCamera({ position: eye.toArray(), lookAt: look.toArray() });
  // As EarthVehicles does in the cockpit view without a map of the truck's own: last frame's
  // shadow map decides whether it casts.
  if (!ownShadow && params.get('selfShadow') !== 'always')
    visual.updateShadows(renderer.shadowTexelSize);
  const focus = earthShadowFocus('drive', eye.toArray(), direction, 0);
  // `radius` overrides the driving map's half-width, to measure flicker against texel size.
  if (params.has('radius')) focus.radius = Number(params.get('radius'));
  renderer.setShadowFocus(focus);
};
place(0);
renderer.setFov(70);
await renderer.prepareObject(renderer.worldRoot);
for (let i = 0; i < 3; i++) {
  renderer.render();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

const readback = document.createElement('canvas');
readback.width = WIDTH;
readback.height = HEIGHT;
const context = readback.getContext('2d', { willReadFrequently: true });
if (!context) throw new Error('No 2D context for readback');
const luma = (): Float32Array => {
  context.drawImage(renderer.three.domElement, 0, 0, WIDTH, HEIGHT);
  const { data } = context.getImageData(0, 0, WIDTH, HEIGHT);
  const out = new Float32Array(WIDTH * HEIGHT);
  for (let p = 0; p < out.length; p++)
    out[p] =
      0.2126 * (data[p * 4] as number) +
      0.7152 * (data[p * 4 + 1] as number) +
      0.0722 * (data[p * 4 + 2] as number);
  return out;
};

const api = {
  /** Main-thread milliseconds per frame, posing and rendering only, over `frames` frames. */
  time(frames: number): number {
    const started = performance.now();
    for (let frame = 0; frame < frames; frame++) {
      place(frame * STEP);
      renderer.render();
    }
    return (performance.now() - started) / frames;
  },
  /** Drive `frames` frames; report the share of pixels that jump by more than `jump` levels. */
  async drive(frames: number, jump = 24) {
    const shots: string[] = [];
    let previous: Float32Array | undefined;
    const changed: number[] = [];
    for (let frame = 0; frame < frames; frame++) {
      place(frame * STEP);
      renderer.render();
      const current = luma();
      if (frame < 4) shots.push(renderer.three.domElement.toDataURL('image/png'));
      if (previous) {
        let count = 0;
        for (let p = 0; p < current.length; p++)
          if (Math.abs((current[p] as number) - (previous[p] as number)) > jump) count++;
        changed.push(count / current.length);
      }
      previous = current;
    }
    const sorted = [...changed].sort((a, b) => a - b);
    return {
      texel: renderer.shadowTexelSize,
      meanChanged: changed.reduce((sum, value) => sum + value, 0) / changed.length,
      p90Changed: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
      maxChanged: sorted.at(-1) ?? 0,
      shots,
    };
  },
};
declare global {
  interface Window {
    cabinShadowsQA: typeof api;
  }
}
window.cabinShadowsQA = api;
