import { applyEnvironment, createViewer } from '@bendyline/molen-client';
import { createDioramaVisual, DioramaDirector } from '@bendyline/molen-dioramas/client';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import catalog from '../../../content/dioramas/placements.json';
import { loadDiorama } from './load-diorama.js';

const selected = (() => {
  const place =
    catalog.placements.find(
      (entry) => entry.scene === new URLSearchParams(location.search).get('diorama'),
    ) ?? catalog.placements[0];
  if (!place) throw new Error('The diorama catalog is empty');
  return place;
})();
const picker = document.getElementById('scene') as HTMLSelectElement;
for (const place of catalog.placements) picker.add(new Option(place.title, place.scene));
picker.value = selected.scene;
picker.onchange = () => {
  const next = new URL(location.href);
  next.searchParams.set('diorama', picker.value);
  location.assign(next);
};
(document.querySelector('h1') as HTMLHeadingElement).textContent = selected.title;
(document.getElementById('description') as HTMLElement).textContent = selected.description;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const status = document.getElementById('status') as HTMLElement;
const pauseButton = document.getElementById('pause') as HTMLButtonElement;
const visitButton = document.getElementById('visit') as HTMLButtonElement;
const cameraButton = document.getElementById('camera') as HTMLButtonElement;
const viewer = await createViewer({
  canvas,
  backend: 'webgl',
  frameLoop: 'manual',
  clearColor: '#233e48',
});
const renderer = viewer.renderer;
const camera = renderer.camera;
camera.position.set(
  selected.overviewDistance * 0.65,
  selected.overviewDistance * 0.55,
  selected.overviewDistance * 0.75,
);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, selected.lookHeight, 0);
controls.minDistance = 14;
controls.maxDistance = 1000;
controls.maxPolarAngle = Math.PI * 0.49;
controls.enableDamping = true;
applyEnvironment(renderer, {
  ambient: { sky: '#c5dcf0', ground: '#776048', intensity: 0.9 },
  sun: { direction: [-40, 75, 50], color: '#ffe3b0', intensity: 2, castShadow: true },
  shadows: 'medium',
});

let errorMessage: string | undefined;
let loads = 0;
const director = new DioramaDirector({
  maxActive: 1,
  create: (definition, placement) =>
    createDioramaVisual(definition, placement, { root: renderer.worldRoot, camera }),
  onError(error) {
    errorMessage = String(error);
    status.textContent = errorMessage;
    console.error(error);
  },
});
director.add({
  id: selected.scene,
  position: [0, 0, 0],
  enterDistance: 350,
  exitDistance: 420,
  load: async (signal) => {
    loads++;
    return loadDiorama(selected.scene, signal);
  },
});
let paused = false;
let away = false;
let close = false;
pauseButton.onclick = () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
};
visitButton.onclick = () => {
  away = !away;
  visitButton.textContent = away ? 'Return to place' : 'Leave place';
};
cameraButton.onclick = () => {
  close = !close;
  if (close) camera.position.set(8, 7, 29);
  else
    camera.position.set(
      selected.overviewDistance * 0.65,
      selected.overviewDistance * 0.55,
      selected.overviewDistance * 0.75,
    );
  controls.target.set(0, close ? 1 : 2, 0);
  cameraButton.textContent = close ? 'Overview' : 'Close view';
};
let last = performance.now();
let request = 0;
function frame(now: number): void {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  controls.update();
  director.update(away ? [1000, 0, 0] : camera.position.toArray(), paused ? 0 : dt, Date.now());
  const state = director.status(selected.scene);
  canvas.dataset.state = state;
  canvas.dataset.loads = String(loads);
  if (!errorMessage)
    status.textContent =
      state === 'playing'
        ? paused
          ? 'Paused'
          : selected.description
        : state === 'loading'
          ? 'Setting the scene…'
          : 'Out of range · scene unloaded';
  viewer.renderFrame();
  request = requestAnimationFrame(frame);
}
request = requestAnimationFrame(frame);
function dispose(): void {
  cancelAnimationFrame(request);
  director.dispose();
  controls.dispose();
  viewer.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
