// The whole Earth view in one call: mountEarthView over host-selected terrain packages and the
// content packs, with worker offload, a photo-pin marker, mode buttons and the required credits.
// `?mode=walk|drive|fly` starts on foot, in a car or in the air; `?lat=&lon=&range=` choose the
// first view; `?ambient=0` turns off ambient life (traffic, people, trains and aircraft).

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

// molen.dev names its hosted assets index with this tag (docs-site/scripts/stage-hosted.mjs);
// elsewhere the packs sit beside the page.
const packIndex =
  document.querySelector<HTMLMetaElement>('meta[name="molen-packs"]')?.content ||
  'packs/index.json';
const content = await openPacksFromIndex(new URL(packIndex, location.href)).then((packs) =>
  loadEarthContent(packs),
);
const manifests = new Map<string, TerrainPackageDescriptor>();

const view = await mountEarthView({
  canvas,
  terrainSource: async ({ longitude }, signal) => {
    const region = longitude < -122.15 ? 'seattle-bellevue-sammamish' : 'sammamish';
    const manifestUrl = new URL(`terrain/${region}/terrain-package.json`, location.href);
    let terrain = manifests.get(region);
    if (terrain === undefined) {
      const response = await fetch(manifestUrl, { signal });
      if (!response.ok) throw new Error(`Terrain ${region}: HTTP ${response.status}`);
      terrain = (await response.json()) as TerrainPackageDescriptor;
      manifests.set(region, terrain);
    }
    return { key: region, terrain, baseUrl: manifestUrl };
  },
  content,
  ambient: params.get('ambient') === '0' ? false : { density: 0.6 },
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

// Required, always-visible credits follow the active terrain region.
function showCredits(): void {
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
}
showCredits();
view.on('terrainchange', showCredits);

// Sound comes from the molen.sounds pack in packs/index.json; the button mutes it (remembered).
const soundButton = document.getElementById('sound') as HTMLButtonElement;
const readMuted = (): boolean => {
  try {
    return localStorage.getItem('molen.earth-view.muted') === '1';
  } catch {
    return false;
  }
};
const applySound = (muted: boolean): void => {
  view.audio?.setMuted(muted);
  soundButton.setAttribute('aria-pressed', String(!muted));
  try {
    localStorage.setItem('molen.earth-view.muted', muted ? '1' : '0');
  } catch {
    // Storage can be unavailable (private windows); the choice just is not remembered.
  }
};
soundButton.addEventListener('click', () =>
  applySound(soundButton.getAttribute('aria-pressed') === 'true'),
);
// The audio layer loads after the view mounts; apply the remembered choice once it exists.
view.on('audioready', () => applySound(readMuted()));
if (view.audio !== undefined) applySound(readMuted());

// Ambient life: NPC traffic on the mapped streets, pedestrians, trains and aircraft.
const ambientButton = document.getElementById('ambient') as HTMLButtonElement;
ambientButton.setAttribute('aria-pressed', String(view.ambientEnabled));
ambientButton.addEventListener('click', () => {
  view.setAmbientEnabled(!view.ambientEnabled);
  ambientButton.setAttribute('aria-pressed', String(view.ambientEnabled));
  const counts = view.stats().ambient;
  if (view.ambientEnabled && counts !== undefined)
    show(`${counts.cars} cars · ${counts.pedestrians} people · ${counts.trains} rail cars nearby`);
  canvas.focus();
});

document.getElementById('seattle')?.addEventListener('click', () => {
  view.flyTo({ latitude: 47.62051, longitude: -122.3493, range: 950, heading: 0.9, pitch: 0.48 });
});

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
// Buttons are host controls: they always switch (`force`), and Drive adds a car on the nearest
// road when none is parked within reach.
const enter = (mode: EarthViewMode): boolean =>
  view.setMode(mode, mode === 'drive' ? { vehicle: true, force: true } : { force: true });
for (const button of buttons) {
  button.addEventListener('click', () => {
    enter(button.dataset.mode as EarthViewMode);
    canvas.focus();
  });
}
const startMode = params.get('mode');
if (startMode === 'walk' || startMode === 'drive' || startMode === 'fly') enter(startMode);
