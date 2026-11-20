/**
 * The pilot's view of an aircraft in straight and level flight, the way Earth aims sun shadows in
 * flight. Measures how much the cockpit changes from one frame to the next: nothing in the cockpit
 * moves, so any change is shadow flicker.
 *
 * `?aircraft=f15c` (the default): a jet in cruise with a low sun behind it. `?aircraft=oh6`: the
 * helicopter at 30 knots 32 m up with its main rotor turning at full speed and the sun high
 * behind it; `?spin=0` holds the rotor still.
 */
import { applyEnvironment, measureShadowSubject, Renderer } from '@bendyline/molen-client';
import { createAircraftVisual } from '@bendyline/molen-client/aircraft';
import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import f15cUrl from '../../../../content/entities/assets/molen/entities/aircraft/f_15c/model.glb?url';
import oh6Url from '../../../../content/entities/assets/molen/entities/aircraft/oh6/model.glb?url';
import f15cTypes from '../../../../content/entities/source/aircraft/f-15c/entity.types.json';
import oh6Types from '../../../../content/entities/source/aircraft/oh-6/entity.types.json';
import { earthShadowFocus } from '../../../../packages/earth/src/client/look';

const params = new URLSearchParams(location.search);
const CASES = {
  f15c: {
    url: f15cUrl,
    types: f15cTypes,
    // Low sun behind the aircraft and a little to its right: flying north over Seattle in autumn.
    toSun: [0.3, 0.55, -0.78],
    agl: 772,
    // 706 knots, the speed in the report.
    speed: 706 * 0.514444,
    // The seat's view pitch when the report was captured.
    lookPitch: -0.245,
    rotor: false,
  },
  oh6: {
    url: oh6Url,
    types: oh6Types,
    // The sun 50 degrees up, behind and to the right: the rotor's shadow falls across the cabin.
    toSun: [0.3, 0.77, -0.56],
    // 105 feet over the ground at 30 knots, as in the report.
    agl: 32,
    speed: 30 * 0.514444,
    lookPitch: -0.29,
    rotor: true,
  },
} as const;
const flown = CASES[(params.get('aircraft') ?? 'f15c') as keyof typeof CASES];
if (flown === undefined) throw new Error(`Unknown aircraft ${params.get('aircraft')}`);

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
const toSun = new THREE.Vector3(...flown.toSun).normalize();
applyEnvironment(renderer, {
  ambient: { intensity: 0.8 },
  sun: { direction: toSun.toArray(), intensity: 3 },
  toneMapping: 'aces',
});
renderer.setShadowQuality((params.get('quality') ?? 'high') as 'medium' | 'high');
// Low and slow, in 8 m squares as terrain is: across one triangle kilometers wide, a software
// renderer's interpolation moves shadows on it differently each frame (see chase-shadows.ts).
const ground = new THREE.Mesh(
  flown.rotor
    ? new THREE.PlaneGeometry(2_000, 2_000, 250, 250)
    : new THREE.PlaneGeometry(40_000, 40_000),
  new THREE.MeshStandardMaterial({ color: '#6f7d62' }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
renderer.worldRoot.add(ground);

const spec = (
  Object.values(flown.types.types)[0] as unknown as {
    components: { aircraft: { spec: AircraftSpec } };
  }
).components.aircraft.spec;
const { scene: model } = await new GLTFLoader().loadAsync(flown.url);
const visual = createAircraftVisual(model, spec);
renderer.worldRoot.add(model);
// As the hosts do for the flown aircraft: a sun map of its own. `?subject=0` leaves it to the
// main map, as on WebGPU; `?selfShadow=always` also keeps it there at any texel size.
const ownShadow =
  params.get('subject') !== '0' && renderer.setShadowSubject(measureShadowSubject(model));

const altitude = Number(params.get('agl') ?? flown.agl);
const FRAME = 1 / 60;
const STEP = flown.speed * FRAME;
const rotorSpeed = params.get('spin') === '0' ? 0 : (spec.engine?.rotorAngularSpeed ?? 0);
const input: AircraftInputData = {
  power: 0.6,
  pitch: 0,
  roll: 0,
  yaw: 0,
  brake: false,
  engine: true,
  gear: true,
  flaps: false,
};
const stateAt = (frame: number): AircraftStateData =>
  ({
    velocity: [0, 0, flown.speed],
    airspeed: flown.speed,
    yaw: 0,
    pitch: 0,
    roll: 0,
    pitchRate: 0,
    rollRate: 0,
    rpm: 1,
    rotorAngle: frame * FRAME * rotorSpeed,
    grounded: false,
    stalled: false,
    crashed: false,
  }) as unknown as AircraftStateData;
const eye = new THREE.Vector3();
const look = new THREE.Vector3();
const place = (frame: number): void => {
  model.position.set(0, altitude, frame * STEP);
  model.updateMatrixWorld(true);
  eye.fromArray(spec.pilotEye).applyMatrix4(model.matrixWorld);
  const direction: [number, number, number] = [
    0,
    Math.sin(flown.lookPitch),
    Math.cos(flown.lookPitch),
  ];
  look.copy(eye).add(new THREE.Vector3(...direction).multiplyScalar(10));
  renderer.setCamera({ position: eye.toArray(), lookAt: look.toArray() });
  visual.updateView(eye.toArray() as [number, number, number]);
  // As the hosts do without a map of the aircraft's own: last frame's shadow map decides whether
  // the flown aircraft casts.
  if (!ownShadow && params.get('selfShadow') !== 'always')
    visual.updateShadows(renderer.shadowTexelSize);
  if (flown.rotor) visual.update(stateAt(frame), input, altitude);
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
      place(frame);
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
      subjectTexel: renderer.subjectShadowInfo?.texel,
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
