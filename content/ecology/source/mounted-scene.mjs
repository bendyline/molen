/** Browser acceptance harness for the public Earth mount, including real driving and flying. */
import {
  loadEarthContent,
  mountEarthView,
  openPacksFromIndex,
} from '../../../packages/earth/dist/client.mjs';

const params = new URLSearchParams(location.search);
document.body.style.margin = '0';
const canvas = document.createElement('canvas');
canvas.tabIndex = 0;
canvas.style.cssText = 'display:block;width:100vw;height:100vh';
document.body.append(canvas);
const credit = document.createElement('div');
credit.style.cssText =
  'position:fixed;bottom:8px;right:8px;max-width:70%;padding:6px;background:#172c38dd;color:white;font:12px sans-serif';
document.body.append(credit);
const manifestUrl = new URL(params.get('package'), location.href);
const terrain = await fetch(manifestUrl).then((response) => response.json());
const packs = await openPacksFromIndex(
  new URL('/examples/world-explorer/public/packs/index.json', location.href),
);
window.regionalMountErrors = [];
const view = await mountEarthView({
  canvas,
  terrain,
  baseUrl: manifestUrl,
  content: await loadEarthContent(packs),
  quality: params.get('quality') ?? 'balanced',
  backend: 'webgl',
  vegetationMonth: 7,
  audio: false,
  camera: {
    latitude: Number(params.get('lat')),
    longitude: Number(params.get('lon')),
    range: 280,
    heading: 0.9,
    pitch: 0.5,
  },
  workers: {
    elevation: () =>
      new Worker(new URL('../../../examples/earth-view/src/elevation.worker.ts', import.meta.url), {
        type: 'module',
      }),
    landcover: () =>
      new Worker(new URL('../../../examples/earth-view/src/landcover.worker.ts', import.meta.url), {
        type: 'module',
      }),
    surface: () =>
      new Worker(new URL('../../../examples/earth-view/src/surface.worker.ts', import.meta.url), {
        type: 'module',
      }),
    worldgen: () =>
      new Worker(new URL('../../../examples/earth-view/src/worldgen.worker.ts', import.meta.url), {
        type: 'module',
      }),
  },
  onError: (error, context) =>
    window.regionalMountErrors.push(`${context}: ${error.message ?? error}`),
});
credit.textContent = view.credits.map((entry) => entry.label).join(' · ');
window.regionalMount = view;
window.regionalMountMessages = [];
view.on('message', ({ text }) => window.regionalMountMessages.push(text));
