/**
 * The chase view of a sedan at speed with a low sun ahead of it, the way Earth aims sun shadows
 * while driving. The camera rides with the car over plain ground, so nothing in the frame moves:
 * any change from one frame to the next is the car's shadow changing shape.
 */
import { applyEnvironment, measureShadowSubject, Renderer } from '@bendyline/molen-client';
import { createVehicleVisual, vehicleCameraPose } from '@bendyline/molen-client/vehicles';
import type { VehicleData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../../../../content/entities/assets/molen/entities/vehicle/toyota_corolla_2025/model.glb?url';
import types from '../../../../content/entities/source/vehicles/toyota-corolla-2025/entity.types.json';
import { earthShadowFocus } from '../../../../packages/earth/src/client/look';

const params = new URLSearchParams(location.search);
const WIDTH = 640;
const HEIGHT = 480;
const renderer = await Renderer.create({
  backend: params.get('backend') === 'webgpu' ? 'webgpu' : 'webgl',
  width: WIDTH,
  height: HEIGHT,
  antialias: true,
  reverseDepthBuffer: true,
  preserveDrawingBuffer: true,
  optimizeWebGpu: false,
});
document.body.append(renderer.three.domElement);
// Driving south in Seattle on a November afternoon: the sun 20 degrees up, ahead and to the right.
const toSun = new THREE.Vector3(-0.34, 0.36, 0.87).normalize();
applyEnvironment(renderer, {
  ambient: { intensity: 0.8 },
  sun: { direction: toSun.toArray(), intensity: 3 },
  toneMapping: 'aces',
});
const quality = (params.get('quality') ?? 'high') as 'low' | 'medium' | 'high';
renderer.setShadowQuality(quality);
// In 8 m squares, as terrain is: across one triangle 40 km wide, a software renderer's
// interpolation put the car's shadow as much as a meter off, differently each frame.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2_000, 2_000, 250, 250),
  new THREE.MeshStandardMaterial({ color: '#8a8a86' }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
renderer.worldRoot.add(ground);

const vehicle = (
  Object.values(types.types)[0] as unknown as { components: { vehicle: VehicleData } }
).components.vehicle;
const { scene: model } = await new GLTFLoader().loadAsync(modelUrl);
createVehicleVisual(model, vehicle);
renderer.worldRoot.add(model);
// As the hosts do for the driven car: a sun map of its own. `?subject=0` leaves it in the main map.
if (params.get('subject') !== '0') renderer.setShadowSubject(measureShadowSubject(model));

const STEP = Number(params.get('kmh') ?? 100) / 3.6 / 60;
// A heading off the map's axes, so the car crosses texels both ways.
const YAW = Number(params.get('yaw') ?? 0.3);
const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), YAW);
const place = (distance: number): void => {
  model.position.set(Math.sin(YAW) * distance, 0, Math.cos(YAW) * distance);
  model.quaternion.copy(rotation);
  model.updateMatrixWorld(true);
  const pose = vehicleCameraPose(
    { pos: model.position.toArray(), rot: rotation.toArray() as [number, number, number, number] },
    vehicle.spec,
    { view: 'chase', lookYaw: 0, lookPitch: -0.12 },
  );
  renderer.setCamera({ position: pose.position, lookAt: pose.lookAt });
  const direction: [number, number, number] = [
    pose.lookAt[0] - pose.position[0],
    pose.lookAt[1] - pose.position[1],
    pose.lookAt[2] - pose.position[2],
  ];
  const focus = earthShadowFocus('drive', pose.position, direction, 0);
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
  /**
   * Drive `frames` frames. Reports the share of pixels that jump by more than `jump` levels from
   * one frame to the next, and `flicker`: a picture of each pixel's brightness range over the run.
   */
  async drive(frames: number, jump = 24) {
    const shots: string[] = [];
    let previous: Float32Array | undefined;
    const changed: number[] = [];
    const low = new Float32Array(WIDTH * HEIGHT).fill(255);
    const high = new Float32Array(WIDTH * HEIGHT);
    for (let frame = 0; frame < frames; frame++) {
      place(frame * STEP);
      renderer.render();
      const current = luma();
      if (frame < 6) shots.push(renderer.three.domElement.toDataURL('image/png'));
      for (let p = 0; p < current.length; p++) {
        const value = current[p] as number;
        if (value < (low[p] as number)) low[p] = value;
        if (value > (high[p] as number)) high[p] = value;
      }
      if (previous) {
        let count = 0;
        for (let p = 0; p < current.length; p++)
          if (Math.abs((current[p] as number) - (previous[p] as number)) > jump) count++;
        changed.push(count / current.length);
      }
      previous = current;
    }
    const image = context.createImageData(WIDTH, HEIGHT);
    let unstable = 0;
    for (let p = 0; p < low.length; p++) {
      const range = (high[p] as number) - (low[p] as number);
      if (range > jump) unstable++;
      image.data[p * 4] = image.data[p * 4 + 1] = image.data[p * 4 + 2] = Math.min(255, range * 2);
      image.data[p * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const sorted = [...changed].sort((a, b) => a - b);
    return {
      texel: renderer.shadowTexelSize,
      subjectTexel: renderer.subjectShadowInfo?.texel,
      meanChanged: changed.reduce((sum, value) => sum + value, 0) / changed.length,
      p90Changed: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
      maxChanged: sorted.at(-1) ?? 0,
      /** Share of the frame whose brightness varied by more than `jump` over the run. */
      unstable: unstable / low.length,
      shots,
      flicker: readback.toDataURL('image/png'),
    };
  },
};
declare global {
  interface Window {
    chaseShadowsQA: typeof api;
  }
}
window.chaseShadowsQA = api;
