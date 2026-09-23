import { createViewer } from '@bendyline/molen-client';
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
const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.code));
window.addEventListener('keyup', (e) => keys.delete(e.code));
let dragging = false;
canvas.addEventListener('mousedown', () => {
  dragging = true;
});
window.addEventListener('mouseup', () => {
  dragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  cam.yaw -= e.movementX * 0.003;
  cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.003));
});
window.addEventListener('resize', () =>
  viewer.renderer.setSize(window.innerWidth, window.innerHeight),
);

let last = performance.now();
function frame(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  const speed = (keys.has('ShiftLeft') ? 220 : 90) * dt;
  const fwd: [number, number, number] = [
    Math.cos(cam.pitch) * Math.cos(cam.yaw),
    Math.sin(cam.pitch),
    Math.cos(cam.pitch) * Math.sin(cam.yaw),
  ];
  const right: [number, number, number] = [
    Math.cos(cam.yaw - Math.PI / 2),
    0,
    Math.sin(cam.yaw - Math.PI / 2),
  ];
  const move = (v: [number, number, number], s: number): void => {
    cam.pos[0] += v[0] * s;
    cam.pos[1] += v[1] * s;
    cam.pos[2] += v[2] * s;
  };
  if (keys.has('KeyW')) move(fwd, speed);
  if (keys.has('KeyS')) move(fwd, -speed);
  if (keys.has('KeyA')) move(right, -speed);
  if (keys.has('KeyD')) move(right, speed);
  // Clamp above the terrain (client-side heightfield).
  const ground = hf.sampleHeight(cam.pos[0], cam.pos[2]) + 4;
  if (cam.pos[1] < ground) cam.pos[1] = ground;

  viewer.setCamera({
    position: cam.pos,
    lookAt: [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]],
  });
  viewer.renderFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const hint = document.createElement('div');
hint.textContent = 'WASD to fly · drag to look · Shift to boost';
hint.style.cssText =
  'position:fixed;left:12px;bottom:10px;font:13px system-ui;color:#234;pointer-events:none';
document.body.appendChild(hint);
