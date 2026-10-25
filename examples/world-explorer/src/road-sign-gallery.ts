import './road-sign-gallery.css';
import { type FontLibrary, vectorFontSchema } from '@bendyline/molen-materials/text';
import {
  createTerrainRoadSignObject,
  createTerrainSurfaceObject,
  disposeTerrainSurfaceObject,
  type SurfaceSign,
  TERRAIN_ROAD_SIGN_PATTERNS,
  type TerrainRoadSignPattern,
  type TerrainRoadSignProfile,
  terrainRoadSignCatalogSchema,
  terrainRouteShieldLibrarySchema,
} from '@bendyline/molen-terrain/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import licenseUrl from '../../../content/earth/fonts/Overpass-OFL.txt?url';
import highwayFont from '../../../content/earth/fonts/overpass.semibold.json';
import signCatalog from '../../../content/earth/signs/catalog.json';
import shieldData from '../../../content/earth/signs/route-shields.json';
import stateProfiles from '../../../content/earth/signs/us-states.json';
import {
  type RoadSignGalleryCase,
  roadSignGalleryCases,
  roadSignGalleryContext,
} from './road-sign-gallery-cases';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing gallery element: ${id}`);
  return found as T;
}

interface GalleryEntry {
  title: string;
  sample: RoadSignGalleryCase;
  pattern: TerrainRoadSignPattern;
  sign: SurfaceSign;
  count: number;
  object: THREE.Group;
  card: HTMLElement;
}

async function main(): Promise<void> {
  const context = roadSignGalleryContext();
  const profiles = terrainRoadSignCatalogSchema.parse({
    ...signCatalog,
    profiles: [...signCatalog.profiles, ...stateProfiles.profiles],
  }).profiles;
  const routeShields = terrainRouteShieldLibrarySchema.parse(shieldData);
  const view = element<HTMLSelectElement>('view');
  view.value =
    new URLSearchParams(location.search).get('view') === 'states' ? 'states' : 'patterns';
  const region = element<HTMLSelectElement>('region');
  const countryGroup = document.createElement('optgroup'),
    stateGroup = document.createElement('optgroup');
  countryGroup.label = 'Countries';
  stateGroup.label = 'U.S. states';
  region.append(countryGroup, stateGroup);
  for (const profile of profiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.title;
    (profile.stateNetwork ? stateGroup : countryGroup).append(option);
  }
  region.value = profiles.some((p) => p.id === new URLSearchParams(location.search).get('region'))
    ? (new URLSearchParams(location.search).get('region') as string)
    : 'us';
  const initialProfile = profiles.find((p) => p.id === region.value) ?? profiles[0];
  if (!initialProfile) throw new Error('Empty sign profile catalog');
  let profile: TerrainRoadSignProfile = initialProfile;
  const face = vectorFontSchema.parse(highwayFont);
  const fonts: FontLibrary = {
    defaultFont: face.id,
    fonts: { [face.id]: face },
    roles: { highway: face.id },
  };
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor('#e8ecdf');
  renderer.setSize(680, 400);
  renderer.domElement.setAttribute('aria-label', '3D road sign; drag to rotate and scroll to zoom');
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#f2f6ee', '#858b73', 2.4));
  const sun = new THREE.DirectionalLight('#fff3da', 2.2);
  sun.position.set(-12, 20, 24);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, 0.01, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minZoom = 0.6;
  controls.maxZoom = 6;
  controls.addEventListener('change', () => renderer.render(scene, camera));
  const entries: GalleryEntry[] = [];
  let active: GalleryEntry | undefined;
  const dialog = element<HTMLDialogElement>('detail');
  const preview = element('preview');
  const fit = (entry: GalleryEntry, width: number, height: number, thumbnail: boolean): void => {
    renderer.setSize(width, height);
    const box = new THREE.Box3().setFromObject(entry.object);
    if (thumbnail && !entry.sign.span) box.min.y = Math.max(box.min.y, 1.45);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const halfY = Math.max(size.y / 2, ((size.x / 2) * height) / width) * 1.16;
    camera.left = (-halfY * width) / height;
    camera.right = -camera.left;
    camera.top = halfY;
    camera.bottom = -halfY;
    camera.zoom = 1;
    camera.position.set(center.x + size.x * 0.1, center.y + size.y * 0.06, center.z + 30);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
    renderer.render(scene, camera);
  };
  const fact = (label: string, value: string): void => {
    const title = document.createElement('dt');
    title.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    element('facts').append(title, detail);
  };
  const reset = (): void => {
    if (active && dialog.open) fit(active, preview.clientWidth, preview.clientHeight, false);
  };
  const open = (entry: GalleryEntry): void => {
    if (active) scene.remove(active.object);
    active = entry;
    scene.add(entry.object);
    preview.append(renderer.domElement);
    element('detail-title').textContent = entry.title;
    element('detail-family').textContent = `ROAD SIGN / ${entry.pattern.family}`;
    element('detail-caption').textContent = entry.sample.caption;
    element('facts').replaceChildren();
    fact(
      'Evidence in this example',
      entry.sign.source === 'mapped'
        ? 'Mapped legend or control · hardware placement estimated'
        : 'Inferred control · hardware placement estimated',
    );
    fact(
      'Regional convention',
      `${entry.sign.appearance.title} · ${entry.sign.appearance.drivingSide}-side placement · ${entry.sign.appearance.speedUnit}`,
    );
    fact(
      'Placement',
      entry.pattern.placement.replace('driving side', `${entry.sign.appearance.drivingSide} side`),
    );
    fact(
      'When data is missing',
      entry.sign.kind === 'stop' && !entry.sign.appearance.inferStopSigns
        ? 'Only mapped stop controls are placed by this regional preset.'
        : entry.pattern.fallback,
    );
    fact(
      'Detection',
      `${entry.count} ${entry.count === 1 ? 'instance' : 'instances'} of this pattern in the example tile. Cues: ${entry.sign.evidence.join(', ')}.`,
    );
    element('record').textContent = JSON.stringify(
      { exampleTags: entry.sample.tags, detected: entry.sign },
      null,
      2,
    );
    dialog.showModal();
    reset();
  };
  const buildEntries = (): void => {
    for (const entry of entries) {
      scene.remove(entry.object);
      disposeTerrainSurfaceObject(entry.object);
    }
    active = undefined;
    entries.length = 0;
    element('gallery').replaceChildren();
    const allStates = view.value === 'states';
    region.disabled = allStates;
    element('region-note').textContent = allStates
      ? '50 state-route identities. Regulatory signs share U.S. conventions; street-name blades vary by municipality. Primary routes only; artwork is adapted for medium-fi rendering.'
      : profile.notes;
    element('region-sources').replaceChildren();
    const sources = allStates
      ? (profiles.find((p) => p.id === 'us-wa')?.sources ?? [])
      : profile.sources;
    for (const [i, url] of sources.entries()) {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = i ? ' · Reference' : 'Sources & references';
      element('region-sources').append(link);
    }
    const samples = (allStates ? profiles.filter((p) => p.stateNetwork) : [profile]).flatMap(
      (appearance) =>
        roadSignGalleryCases(appearance)
          .filter((sample) => !allStates || sample.pattern === 'route-marker')
          .map((sample) => ({ sample, appearance })),
    );
    const counter = element('filters').querySelector('span');
    if (counter) counter.textContent = String(samples.length);
    for (const [index, { sample, appearance }] of samples.entries()) {
      const pattern = TERRAIN_ROAD_SIGN_PATTERNS.find((p) => p.id === sample.pattern);
      if (!pattern) throw new Error(`Unregistered sign pattern: ${sample.pattern}`);
      const surface = createTerrainSurfaceObject(sample.tile, context, {
        details: { parkedCars: false },
        signProfile: appearance,
        routeShields,
      });
      const detected = (surface.userData.roadSigns as SurfaceSign[]).filter(
        (s) => s.pattern === sample.pattern,
      );
      disposeTerrainSurfaceObject(surface);
      const sign = detected[0];
      if (!sign) throw new Error(`The production detector did not find ${sample.pattern}`);
      const object = createTerrainRoadSignObject(
        { ...sign, x: 200, z: 200, ground: 0, dx: 0, dz: 1 },
        context,
        { fonts, routeShields },
      );
      const card = document.createElement('article');
      card.className = 'card';
      card.dataset.pattern = pattern.id;
      const entry: GalleryEntry = {
        title: allStates ? appearance.title : pattern.title,
        sample,
        pattern,
        sign,
        object,
        card,
        count: detected.length,
      };
      scene.add(object);
      fit(entry, 680, 400, true);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(object);
      const button = document.createElement('button');
      button.setAttribute('aria-label', `Inspect ${entry.title}`);
      const visual = document.createElement('div');
      visual.className = 'visual';
      const image = document.createElement('img');
      image.src = url;
      image.alt = `${entry.title}: ${sign.kind === 'stop' ? [profile.stopLabel, ...(sign.allWay ? [profile.allWayLabel] : [])].filter(Boolean).join(', ') : sign.kind === 'yield' ? profile.yieldLabel || 'Yield triangle' : sign.lines.join(', ')}`;
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(index + 1).padStart(2, '0');
      const inspect = document.createElement('span');
      inspect.className = 'inspect';
      inspect.textContent = 'Inspect in 3D ↗';
      visual.append(image, number, inspect);
      const copy = document.createElement('div');
      copy.className = 'copy';
      const badge = document.createElement('span');
      badge.className = `badge${sign.source === 'inferred' ? ' inference' : ''}`;
      badge.textContent = sign.source === 'mapped' ? '● Mapped cue' : '● Inferred control';
      const title = document.createElement('h2');
      title.textContent = entry.title;
      const caption = document.createElement('p');
      caption.textContent = sample.caption;
      const cues = document.createElement('div');
      cues.className = 'cues';
      for (const cue of Object.entries(sample.tags)) {
        const tag = document.createElement('code');
        tag.textContent =
          cue[0] === 'maxspeed'
            ? `maxspeed=${cue[1]}`
            : cue[0] === 'highway'
              ? `highway=${cue[1]}`
              : cue[0];
        cues.append(tag);
      }
      copy.append(badge, title, caption, cues);
      button.append(visual, copy);
      button.addEventListener('click', () => open(entry));
      card.append(button);
      element('gallery').append(card);
      entries.push(entry);
    }
  };
  buildEntries();
  let family = 'all';
  const search = element<HTMLInputElement>('search');
  const filter = (): void => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const entry of entries) {
      entry.card.hidden =
        (family !== 'all' && entry.pattern.family !== family) ||
        !JSON.stringify([entry.title, entry.pattern, entry.sample.tags])
          .toLowerCase()
          .includes(query);
      if (!entry.card.hidden) visible++;
    }
    element('status').textContent =
      `${visible} of ${entries.length} ${view.value === 'states' ? 'states' : 'patterns'} · Production geometry · Synthetic map examples · Preview scales vary`;
  };
  for (const button of element('filters').querySelectorAll('button'))
    button.addEventListener('click', () => {
      family = button.dataset.family ?? 'all';
      for (const sibling of element('filters').querySelectorAll('button'))
        sibling.setAttribute('aria-pressed', String(sibling === button));
      filter();
    });
  const report = (): void => {
    (window as unknown as { roadSignGalleryQA: unknown }).roadSignGalleryQA = {
      ready: true,
      profile: profile.id,
      view: view.value,
      patterns: entries.map((entry) => ({
        id: entry.pattern.id,
        title: entry.title,
        routeShield: entry.sign.routeShield,
        count: entry.count,
        source: entry.sign.source,
        evidence: entry.sign.evidence,
        appearance: entry.sign.appearance.id,
        shape: entry.sign.appearance.speedSign,
        lines: entry.sign.lines,
        x: entry.sign.x,
        z: entry.sign.z,
      })),
    };
  };
  region.addEventListener('change', () => {
    const selected = profiles.find((p) => p.id === region.value);
    if (!selected) return;
    profile = selected;
    buildEntries();
    filter();
    report();
    const url = new URL(location.href);
    url.searchParams.set('region', profile.id);
    history.replaceState(null, '', url);
  });
  view.addEventListener('change', () => {
    family = 'all';
    search.value = '';
    for (const button of element('filters').querySelectorAll('button'))
      button.setAttribute('aria-pressed', String(button.dataset.family === 'all'));
    buildEntries();
    filter();
    report();
    const url = new URL(location.href);
    url.searchParams.set('view', view.value);
    history.replaceState(null, '', url);
  });
  search.addEventListener('input', filter);
  filter();
  element('close').addEventListener('click', () => dialog.close());
  element('reset').addEventListener('click', reset);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (
        event.clientX < b.left ||
        event.clientX > b.right ||
        event.clientY < b.top ||
        event.clientY > b.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    if (active) scene.remove(active.object);
    active = undefined;
  });
  const resize = new ResizeObserver(reset);
  resize.observe(preview);
  const license = document.createElement('a');
  license.href = licenseUrl;
  license.textContent = 'Font license';
  document.querySelector('footer')?.append(license);
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    resize.disconnect();
    controls.dispose();
    for (const entry of entries) disposeTerrainSurfaceObject(entry.object);
    renderer.dispose();
  });
  await document.fonts.ready;
  report();
}

void main().catch((error: unknown) => {
  element('status').textContent =
    `The sign gallery could not load: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
});
