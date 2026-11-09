/**
 * The pilot's view of a jet in cruise with the sun behind it, the way Earth aims sun shadows in
 * flight. Measures how much the cockpit changes from one frame to the next while the aircraft
 * flies straight and level: nothing in the cockpit moves, so any change is shadow flicker.
 */
import { applyEnvironment, Renderer } from '@bendyline/molen-client';
import { createAircraftVisual } from '@bendyline/molen-client/aircraft';
import type { AircraftSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../../../../content/entities/assets/molen/entities/aircraft/f_15c/model.glb?url';
import types from '../../../../content/entities/source/aircraft/f-15c/entity.types.json';
import { earthShadowFocus } from '../../../../packages/earth/src/client/look';

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
// Low sun behind the aircraft and a little to its right: flying north over Seattle in autumn.
const toSun = new THREE.Vector3(0.3, 0.55, -0.78).normalize();
applyEnvironment(renderer, {
  ambient: { intensity: 0.8 },
  sun: { direction: toSun.toArray(), intensity: 3 },
  toneMapping: 'aces',
});
renderer.setShadowQuality('high');
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40_000, 40_000),
  new THREE.MeshStandardMaterial({ color: '#6f7d62' }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
renderer.worldRoot.add(ground);

const spec = (
  Object.values(types.types)[0] as unknown as { components: { aircraft: { spec: AircraftSpec } } }
).components.aircraft.spec;
const { scene: model } = await new GLTFLoader().loadAsync(modelUrl);
const visual = createAircraftVisual(model, spec);
renderer.worldRoot.add(model);

const altitude = Number(new URLSearchParams(location.search).get('agl') ?? 772);
// 706 knots, the speed in the report, at 60 frames per second.
const STEP = (706 * 0.514444) / 60;
// The seat's view pitch when the report was captured.
const LOOK_PITCH = -0.245;
const eye = new THREE.Vector3();
const look = new THREE.Vector3();
const place = (z: number): void => {
  model.position.set(0, altitude, z);
  model.updateMatrixWorld(true);
  eye.fromArray(spec.pilotEye).applyMatrix4(model.matrixWorld);
  const direction: [number, number, number] = [0, Math.sin(LOOK_PITCH), Math.cos(LOOK_PITCH)];
  look.copy(eye).add(new THREE.Vector3(...direction).multiplyScalar(10));
  renderer.setCamera({ position: eye.toArray(), lookAt: look.toArray() });
  visual.updateView(eye.toArray() as [number, number, number]);
  // As the hosts do: last frame's shadow map decides whether the flown aircraft casts.
  if (new URLSearchParams(location.search).get('selfShadow') !== 'always')
    visual.updateShadows(renderer.shadowTexelSize);
  renderer.setShadowFocus(earthShadowFocus('fly', eye.toArray(), direction, 0, 0));
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
  /** Fly `frames` frames; report the share of pixels that jump by more than `jump` levels. */
  async fly(frames: number, jump = 24) {
    const shots: string[] = [];
    let previous: Float32Array | undefined;
    const changed: number[] = [];
    const sun = renderer.scene
      .getObjectByName('$environment')
      ?.children.find(
        (object) => object instanceof THREE.DirectionalLight,
      ) as THREE.DirectionalLight;
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
      texel: (2 * sun.shadow.camera.right) / sun.shadow.mapSize.x,
      meanChanged: changed.reduce((sum, value) => sum + value, 0) / changed.length,
      p90Changed: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
      maxChanged: sorted.at(-1) ?? 0,
      shots,
    };
  },
};
declare global {
  interface Window {
    cockpitShadowsQA: typeof api;
  }
}
window.cockpitShadowsQA = api;
