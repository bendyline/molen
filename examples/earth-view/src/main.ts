// The whole Earth view in one call: mountEarthView over the Sammamish terrain package and the
// content packs, with worker offload, a photo-pin marker, mode buttons and the required credits.
// `?mode=walk` starts on foot; `?lat=&lon=&range=` choose the first view.

import { composeMarkerImage } from '@bendyline/molen-client/markers';
import {
  type EarthView,
  type EarthViewMode,
  loadEarthContent,
  mountEarthView,
  openPacksFromIndex,
} from '@bendyline/molen-earth/client';
import type { TerrainPackageDescriptor } from '@bendyline/molen-terrain/kernel';

declare global {
  interface Window {
    /** For tests and the console. */
    __earthView?: EarthView;
  }
}

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('view') as HTMLCanvasElement;
const stage = document.getElementById('stage') as HTMLDivElement;
const message = document.getElementById('message') as HTMLParagraphElement;
const credit = document.getElementById('credit') as HTMLParagraphElement;

const manifestUrl = new URL('terrain/sammamish/terrain-package.json', location.href);
const [terrain, content] = await Promise.all([
  fetch(manifestUrl).then((response) => response.json() as Promise<TerrainPackageDescriptor>),
  openPacksFromIndex(new URL('packs/index.json', location.href)).then((packs) =>
    loadEarthContent(packs),
  ),
]);

const view = await mountEarthView({
  canvas,
  terrain,
  baseUrl: manifestUrl,
  content,
  camera: {
    latitude: Number(params.get('lat') ?? 47.6163),
    longitude: Number(params.get('lon') ?? -122.0356),
    range: Number(params.get('range') ?? 1_800),
    heading: 0.9,
    pitch: 0.42,
  },
  // Vite bundles a worker only from the literal `new Worker(new URL(...))` pattern.
  workers: {
    elevation: () =>
      new Worker(new URL('./elevation.worker.ts', import.meta.url), { type: 'module' }),
    landcover: () =>
      new Worker(new URL('./landcover.worker.ts', import.meta.url), { type: 'module' }),
    surface: () => new Worker(new URL('./surface.worker.ts', import.meta.url), { type: 'module' }),
    worldgen: () =>
      new Worker(new URL('./worldgen.worker.ts', import.meta.url), { type: 'module' }),
    material: () =>
      new Worker(new URL('./material.worker.ts', import.meta.url), { type: 'module' }),
  },
  touchJoystickContainer: stage,
});
window.__earthView = view;

// A photo pin: any image works; this one is drawn so the sample has no image assets.
const photo = document.createElement('canvas');
photo.width = photo.height = 96;
const paint = photo.getContext('2d') as CanvasRenderingContext2D;
const sky = paint.createLinearGradient(0, 0, 0, 96);
sky.addColorStop(0, '#9fd0ee');
sky.addColorStop(1, '#2f6f8f');
paint.fillStyle = sky;
paint.fillRect(0, 0, 96, 96);
paint.fillStyle = '#2d5a36';
paint.beginPath();
paint.moveTo(0, 96);
paint.lineTo(34, 44);
paint.lineTo(58, 70);
paint.lineTo(78, 50);
paint.lineTo(96, 96);
paint.fill();
view.setMarkers([
  {
    id: 'lake-sammamish',
    latitude: 47.5935,
    longitude: -122.0971,
    elevation: 2,
    size: 64,
    image: composeMarkerImage(photo, { borderColor: '#c4a265' }),
  },
]);
view.on('markerclick', ({ id }) => show(`Marker ${id}`));

// Required, always-visible credits.
credit.replaceChildren();
for (const [index, entry] of view.credits.entries()) {
  if (index > 0) credit.append(' · ');
  if (entry.url === undefined) credit.append(entry.label);
  else {
    const link = document.createElement('a');
    link.href = entry.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = entry.label;
    credit.append(link);
  }
}

let hideTimer = 0;
function show(text: string): void {
  message.textContent = text;
  message.hidden = false;
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    message.hidden = true;
  }, 3000);
}
view.on('message', ({ text }) => show(text));

const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')];
const syncButtons = (mode: EarthViewMode): void => {
  for (const button of buttons)
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
};
view.on('modechange', ({ mode }) => syncButtons(mode));
for (const button of buttons) {
  button.addEventListener('click', () => {
    view.setMode(button.dataset.mode as EarthViewMode);
    canvas.focus();
  });
}
if (params.get('mode') === 'walk') view.setMode('walk');
