import { createViewer } from '@bendyline/molen-client';
import {
  applyCameraLookDelta,
  cameraForward,
  cameraRight,
  createTouchJoystick,
  NavigationInputSource,
} from '@bendyline/molen-client/navigation';
import { createTerrainObject } from '@bendyline/molen-terrain/client';
import { generateHeightmapPng, heightfieldFromPng } from '@bendyline/molen-terrain/kernel';
import { FLYOVER_CAMERA, HEIGHTMAP_SEED, HEIGHTMAP_SIZE, TERRAIN } from './flyover';

// Browser entry: generate the island heightmap, build the terrain, and fly a free camera over
// it (WASD + mouse drag). No kernel needed — terrain is a client-side capability here.
const canvas = document.getElementById('view') as HTMLCanvasElement;

const png = generateHeightmapPng({
  size: HEIGHTMAP_SIZE,
  seed: HEIGHTMAP_SEED,
  octaves: 6,
  island: true,
});
const hf = heightfieldFromPng(TERRAIN, png);

// A kernel-less viewer: just a renderer + scene to add the terrain meshes to.
const viewer = await createViewer({
  canvas,
  width: window.innerWidth,
  height: window.innerHeight,
  clearColor: '#adc8e6',
});
viewer.renderer.worldRoot.add(createTerrainObject(hf, TERRAIN));

// --- free-fly camera ---
const cam = {
  pos: [...FLYOVER_CAMERA.position] as [number, number, number],
  yaw: -Math.PI / 2,
  pitch: -0.35,
};
const input = new NavigationInputSource({ element: canvas, profile: 'fly' });
const joystick = matchMedia('(any-pointer: coarse)').matches
  ? createTouchJoystick(document.body, input.map, { focusTarget: canvas })
  : undefined;
const resize = (): void => viewer.renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', resize);

let last = performance.now();
let frameHandle = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  const controls = input.read(dt);
  const orientation = applyCameraLookDelta(cam.yaw, cam.pitch, ...controls.look);
  cam.yaw = orientation.yaw;
  cam.pitch = orientation.pitch;
  const speed = (controls.sprint ? 220 : 90) * dt;
  const fwd = cameraForward(cam.yaw, cam.pitch);
  const right = cameraRight(cam.yaw);
  const move = (v: [number, number, number], s: number): void => {
    cam.pos[0] += v[0] * s;
    cam.pos[1] += v[1] * s;
    cam.pos[2] += v[2] * s;
  };
  move(fwd, speed * controls.move.forward);
  move(right, speed * controls.move.right);
  cam.pos[1] += speed * controls.move.up;
  // Clamp above the terrain (client-side heightfield).
  const ground = hf.sampleHeight(cam.pos[0], cam.pos[2]) + 4;
  if (cam.pos[1] < ground) cam.pos[1] = ground;

  viewer.setCamera({
    position: cam.pos,
    lookAt: [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]],
  });
  viewer.renderFrame();
  frameHandle = requestAnimationFrame(frame);
}
frameHandle = requestAnimationFrame(frame);

const hint = document.createElement('div');
hint.id = 'help';
hint.textContent =
  'Click view or Tab to begin · WASD / arrows to fly · Q/E altitude · drag to look · Shift to boost';
hint.style.cssText =
  'position:fixed;left:12px;right:12px;top:10px;font:13px system-ui;color:white;background:#173141e8;padding:8px;border-radius:6px;pointer-events:none';
document.querySelector('main')?.appendChild(hint);
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  cancelAnimationFrame(frameHandle);
  window.removeEventListener('resize', resize);
  input.dispose();
  joystick?.dispose();
  viewer.dispose();
});
