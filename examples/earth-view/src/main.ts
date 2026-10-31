// The whole Earth view in one call: mountEarthView over host-selected terrain packages and the
// content packs, with worker offload, a photo-pin marker, mode buttons and the required credits.
// `?mode=walk|drive|fly` starts on foot, in a car or in the air; `?lat=&lon=&range=` choose the
// first view; `?ambient=0` turns off ambient life (traffic, people, trains and aircraft);
// `?package=<manifest>|qualla` replaces the regional packages with one terrain package;
// `?companion=1` gives the walker a body (V for third person) and a companion who follows it,
// rides along in the passenger seat and steps out again.

import { composeMarkerImage } from '@bendyline/molen-client/markers';
import { createNavigationControls } from '@bendyline/molen-client/navigation';
import {
  type EarthView,
  type EarthViewMode,
  loadEarthContent,
  mountEarthView,
  openPacksFromIndex,
} from '@bendyline/molen-earth/client';
import type { TerrainPackageDescriptor } from '@bendyline/molen-terrain/kernel';
import dioramaCatalog from '../../../content/dioramas/placements.json';
import { loadDiorama } from './load-diorama.js';

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
const controls = document.getElementById('modes') as HTMLFieldSetElement;
const help = document.getElementById('help') as HTMLParagraphElement;
const retry = document.getElementById('retry') as HTMLButtonElement;
retry.addEventListener('click', () => location.reload());

let hideTimer = 0;
function show(text: string): void {
  message.textContent = text;
  message.hidden = false;
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    message.hidden = true;
  }, 5000);
}

async function main(): Promise<void> {
  // molen.dev names its hosted assets index with this tag (docs-site/scripts/stage-hosted.mjs);
  // elsewhere the packs sit beside the page.
  const packIndex =
    document.querySelector<HTMLMetaElement>('meta[name="molen-packs"]')?.content ||
    'packs/index.json';
  const content = await openPacksFromIndex(new URL(packIndex, location.href)).then((packs) =>
    loadEarthContent(packs),
  );
  const manifests = new Map<string, TerrainPackageDescriptor>();
  // `?package=<manifest>` serves one package everywhere; `?package=qualla` follows qualla.com's
  // current release through the examples dev server's proxy (examples/home/qualla-proxy.mjs).
  const packageParam = params.get('package');
  const fixedManifest =
    packageParam === null
      ? undefined
      : packageParam === 'qualla'
        ? await fetch('/qualla/_data/terrain/current.json')
            .then((response) => response.json() as Promise<{ package: string }>)
            .then(
              (pointer) =>
                new URL(pointer.package, new URL('/qualla/_data/terrain/', location.href)),
            )
        : new URL(packageParam, location.href);

  const view = await mountEarthView({
    canvas,
    terrainSource: async ({ longitude }, signal) => {
      const region =
        fixedManifest !== undefined
          ? 'package'
          : longitude < -122.15
            ? 'seattle-bellevue-sammamish'
            : 'sammamish';
      const manifestUrl =
        fixedManifest ?? new URL(`terrain/${region}/terrain-package.json`, location.href);
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
    dioramas: {
      placements:
        params.get('dioramas') === '0'
          ? []
          : dioramaCatalog.placements.map((place) => ({
              ...place,
              groundFootprint: place.groundFootprint as [number, number],
              load: async (signal) => {
                return loadDiorama(place.scene, signal);
              },
            })),
    },
    ambient: params.get('ambient') === '0' ? false : { density: 0.6 },
    camera: {
      latitude: Number(
        params.get('lat') ??
          dioramaCatalog.placements.find((place) => place.scene === params.get('diorama'))
            ?.latitude ??
          47.6163,
      ),
      longitude: Number(
        params.get('lon') ??
          dioramaCatalog.placements.find((place) => place.scene === params.get('diorama'))
            ?.longitude ??
          -122.0356,
      ),
      range: Number(params.get('range') ?? (params.has('diorama') ? 180 : 1_800)),
      heading: 0.9,
      pitch: 0.42,
    },
    // Vite bundles a worker only from the literal `new Worker(new URL(...))` pattern.
    workers: {
      elevation: () =>
        new Worker(new URL('./elevation.worker.ts', import.meta.url), { type: 'module' }),
      landcover: () =>
        new Worker(new URL('./landcover.worker.ts', import.meta.url), { type: 'module' }),
      surface: () =>
        new Worker(new URL('./surface.worker.ts', import.meta.url), { type: 'module' }),
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
      show(
        `${counts.cars} cars · ${counts.pedestrians} people · ${counts.trains} rail cars nearby`,
      );
    canvas.focus();
  });

  document.getElementById('seattle')?.addEventListener('click', () => {
    view.flyTo({ latitude: 47.62051, longitude: -122.3493, range: 950, heading: 0.9, pitch: 0.48 });
  });

  view.on('message', ({ text }) => show(text));

  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const syncButtons = (mode: EarthViewMode): void => {
    for (const button of buttons)
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    help.textContent = {
      orbit:
        'Drag to orbit · scroll to zoom · WASD or arrows to move · Q/E altitude · Tab to controls',
      walk: 'WASD or arrows to walk · drag to look · Shift to run · Space to jump · E to interact · Esc releases mouse',
      drive:
        'W/S or ↑/↓ accelerate / brake · A/D or ←/→ steer · Space brake · E exit · V change view',
      fly: 'W/S pitch · A/D bank · Z/C rudder · =/− power · I engine · G gear · F flaps · E exit · V view',
    }[mode];
    if (mode === 'drive' && view.vehicleStatus()?.kind === 'boat')
      help.textContent =
        'W/S thrust / reverse · A/D helm · Space opposing thrust · hold Shift to anchor slowly · E dockside exit · V view';
  };
  view.on('modechange', ({ mode }) => syncButtons(mode));
  // Buttons are host controls: they always switch (`force`), and Drive adds a car on the nearest
  // road when none is parked within reach.
  const ride = document.getElementById('ride') as HTMLSelectElement;
  view.walker.setAvatar({ figure: { preset: 'human.adult', palette: { top: '#2f5a3b' } } });
  const requestedRide = params.get('vehicle');
  if (requestedRide !== null && [...ride.options].some((option) => option.value === requestedRide))
    ride.value = requestedRide;
  const enter = (mode: EarthViewMode): boolean =>
    view.setMode(mode, mode === 'drive' ? { vehicle: ride.value, force: true } : { force: true });
  for (const button of buttons) {
    button.addEventListener('click', () => {
      enter(button.dataset.mode as EarthViewMode);
      canvas.focus();
    });
  }
  const enterBoat = (): void => {
    view.setMode('drive', { vehicle: 'molen.entities.watercraft.speedboat', force: true });
    help.textContent =
      'W/S thrust / reverse · A/D helm · Space reverse thrust · hold Shift to anchor below walking speed · E dockside exit · V view';
    canvas.focus();
  };
  document.getElementById('boat')?.addEventListener('click', enterBoat);
  if (params.has('boat')) enterBoat();
  if (params.get('companion') === '1') followMe(view);
  const startMode = params.get('mode');
  message.hidden = true;
  if (startMode === 'walk' || startMode === 'drive' || startMode === 'fly') enter(startMode);
  controls.disabled = false;
  const controllerControls = createNavigationControls(view.input, {
    container: controls,
    focusTarget: canvas,
    storageKey: 'molen:navigation-controls:v1',
  });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    clearTimeout(hideTimer);
    controllerControls.dispose();
    view.dispose();
  });
}

/**
 * A companion on foot: it appears beside the walker, follows it, climbs into whatever the viewer
 * drives off in (the follower reports `target-mounted`), and steps out and follows again once the
 * viewer is back on foot. The walker gets a body for the third-person view (V).
 */
function followMe(view: EarthView): void {
  view.walker.setAvatar({ figure: { preset: 'human.adult', palette: { top: '#2f5a3b' } } });
  let companion: string | undefined;
  view.on('frame', ({ mode, viewer }) => {
    if (companion !== undefined || mode !== 'walk' || !view.walker.ready) return;
    const [x, z] = view.toWorld(viewer.latitude, viewer.longitude);
    companion = view.actors.add({
      figure: { preset: 'human.adult', height: 1.66, palette: { top: '#b0553a' } },
      ...view.toGeo(x + Math.cos(viewer.heading) * 2, z + Math.sin(viewer.heading) * 2),
      heading: viewer.heading,
      behaviour: { kind: 'follow', target: 'viewer' },
      interactable: true,
    });
    view.actors.lookAt(companion, 'viewer');
  });
  view.on('actorchange', ({ id, change, reason }) => {
    if (id !== companion) return;
    const vehicle = view.interactable().id;
    if (change === 'stuck' && reason === 'target-mounted' && vehicle !== undefined)
      view.actors.setBehaviour(id, { kind: 'board', vehicle, force: true });
    else if (change === 'alighted')
      view.actors.setBehaviour(id, { kind: 'follow', target: 'viewer' });
  });
  view.on('modechange', ({ mode }) => {
    if (mode === 'walk' && companion !== undefined && view.actors.pose(companion)?.mounted)
      view.actors.setBehaviour(companion, { kind: 'alight' });
  });
}

void main().catch((error: unknown) => {
  console.error('Earth view could not load:', error);
  clearTimeout(hideTimer);
  message.textContent = 'Earth view could not load. Check your connection and try again.';
  message.hidden = false;
  retry.hidden = false;
});
