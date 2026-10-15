import { createPlayback, readyToPlay } from '../../shared/playback';
import values from '../data.json';
import '../../shared/accessibility.css';
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

const mounted = await mountExperience({
  link: worker,
  scene: scene.value,
  canvas,
  frameLoop: 'manual',
  clearColor: '#10131a',
});
const { client, input } = mounted;
await readyToPlay(client);
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Show the completed chart without playing its entrance animation.
  client.control({ action: 'step', ticks: 36 });
  while ((client.tick ?? 0) < 36) await new Promise((resolve) => setTimeout(resolve, 16));
}
const toolbar = document.createElement('div');
toolbar.className = 'demo-playback';
canvas.parentElement?.append(toolbar);
const playback = createPlayback({
  client,
  input,
  canvas,
  container: toolbar,
  render: (elapsed, now) => {
    client.setCamera(evaluateCameraTrack(track, (elapsed / 1000) * 30));
    client.renderFrame(now);
  },
});
function dispose(): void {
  playback.dispose();
  mounted.dispose();
  worker.terminate();
}
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);

const hint = document.createElement('div');
hint.textContent = 'data-driven bar chart · camera on a looping track';
hint.style.cssText =
  'position:fixed;left:12px;bottom:10px;font:13px system-ui;color:#9aa;pointer-events:none';
canvas.parentElement?.appendChild(hint);

const valuesPanel = document.createElement('details');
valuesPanel.className = 'data-values';
const summary = document.createElement('summary');
summary.textContent = 'Chart values';
const table = document.createElement('table');
table.innerHTML =
  '<caption>Monthly values</caption><thead><tr><th scope="col">Month</th><th scope="col">Value</th></tr></thead>';
const body = document.createElement('tbody');
for (const { label, value } of values) {
  const row = body.insertRow();
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = label;
  row.append(heading);
  row.insertCell().textContent = String(value);
}
table.append(body);
valuesPanel.append(summary, table);
canvas.parentElement?.append(valuesPanel);
