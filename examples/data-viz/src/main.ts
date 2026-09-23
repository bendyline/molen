import { mountExperience } from '@bendyline/molen-client';
import { type CameraTrackDoc, evaluateCameraTrack } from '@bendyline/molen-client/camera-track';
import { validate } from '@bendyline/molen-schema';
import trackDoc from '../camera-track.json';
import sceneDoc from '../scene.json';

// Browser entry: kernel (bar-chart animation) in a Worker, client renders, and the camera
// follows the looping track over wall-clock time — machinima playback of a data visualization.
// `frameLoop: 'manual'` keeps the per-frame camera control here.
const scene = validate('scene', sceneDoc);
if (!scene.ok) throw new Error(scene.formatted);

const canvas = document.getElementById('view') as HTMLCanvasElement;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const track = trackDoc as CameraTrackDoc;

const { client } = await mountExperience({
  link: worker,
  scene: scene.value,
  canvas,
  frameLoop: 'manual',
  clearColor: '#10131a',
});

const TICK_RATE = 30;
const start = performance.now();
function loop(now: number): void {
  const tick = ((now - start) / 1000) * TICK_RATE;
  client.setCamera(evaluateCameraTrack(track, tick));
  client.renderFrame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

const hint = document.createElement('div');
hint.textContent = 'data-driven bar chart · camera on a looping track';
hint.style.cssText =
  'position:fixed;left:12px;bottom:10px;font:13px system-ui;color:#9aa;pointer-events:none';
document.body.appendChild(hint);
