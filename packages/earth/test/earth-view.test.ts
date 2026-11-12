// mountEarthView against a stand-in viewer: real three.js scene objects and the real terrain
// pyramid, navigation, markers and quality code, with only WebGL replaced. A procedural archive
// supplies flat PNG16 elevation so streaming, placement and re-anchoring run end to end.

import { createBlockCache, createMemoryByteStore } from '@bendyline/molen-pack/cache';
import {
  encodePng16,
  type TerrainPackageDescriptor,
  writePmtilesArchive,
} from '@bendyline/molen-terrain/kernel';
import { mapOverridePoint } from '@bendyline/molen-worldgen-earth/kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EarthContent } from '../src/client/content';
import type { EarthFrame } from '../src/client/earth-view';
import type { EarthOverride } from '../src/client/overrides';
import { ENTITY_TYPES } from './entity-types';
import { nextTimerTurn } from './view-harness';

const viewerState = vi.hoisted(() => ({
  disposed: 0,
  frames: 0,
  shadowQuality: undefined as string | undefined,
  cloudQuality: undefined as string | undefined,
  shadowRadius: undefined as number | undefined,
}));

vi.mock('@bendyline/molen-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bendyline/molen-client')>();
  const THREE = await import('three');
  return {
    ...actual,
    applyEnvironment: () => {},
    createViewer: async (options: { width: number; height: number }) => {
      let size: [number, number] = [options.width, options.height];
      const origin: [number, number, number] = [0, 0, 0];
      const camera = new THREE.PerspectiveCamera(60, size[0] / size[1], 1, 500_000);
      const renderer = {
        backend: 'webgl' as const,
        scene: new THREE.Scene(),
        worldRoot: new THREE.Group(),
        camera,
        admission: new actual.FrameAdmissionQueue(),
        prepareObject: async () => {},
        createRenderGroup: () => new THREE.Group(),
        setCameraClip: (near: number, far: number) => {
          camera.near = near;
          camera.far = far;
        },
        setPixelRatio: () => {},
        setSize: (width: number, height: number) => {
          size = [width, height];
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        },
        getWorldOrigin: () => [...origin],
        getViewportSize: () => size,
        stats: () => ({ drawCalls: 0, triangles: 0 }),
        setStarCatalog: () => {},
        setShadowQuality: (quality: string) => {
          viewerState.shadowQuality = quality;
        },
        setCloudQuality: (quality: string) => {
          viewerState.cloudQuality = quality;
        },
        setFarShadowCasters: () => {},
        setShadowFocus: (focus: { radius: number } | undefined) => {
          viewerState.shadowRadius = focus?.radius;
        },
      };
      renderer.scene.add(renderer.worldRoot);
      return {
        renderer,
        setCamera: (pose: { position: number[]; lookAt: number[] }) => {
          camera.position.fromArray(pose.position);
          camera.lookAt(new THREE.Vector3().fromArray(pose.lookAt));
          camera.updateMatrixWorld();
        },
        renderFrame: () => {
          viewerState.frames++;
        },
        dispose: () => {
          // Like Renderer.dispose: the admission queue stops scheduling its own frames.
          renderer.admission.dispose();
          viewerState.disposed++;
        },
      };
    },
  };
});

const { earthOrbitMaxRange, mountEarthView } = await import('../src/client/earth-view');

// A frame queue standing in for requestAnimationFrame.
let callbacks = new Map<number, (time: number) => void>();
let nextHandle = 1;
let clock = 0;

beforeEach(() => {
  callbacks = new Map();
  nextHandle = 1;
  clock = 0;
  viewerState.disposed = 0;
  viewerState.frames = 0;
  vi.stubGlobal('window', Object.assign(new EventTarget(), { devicePixelRatio: 1 }));
  vi.stubGlobal(
    'document',
    Object.assign(new EventTarget(), {
      hidden: false,
    }),
  );
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
    const handle = nextHandle++;
    callbacks.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => callbacks.delete(handle));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

async function pump(frames: number): Promise<void> {
  for (let i = 0; i < frames; i++) {
    clock += 16;
    const due = [...callbacks.values()];
    callbacks.clear();
    for (const callback of due) callback(clock);
    await nextTimerTurn();
  }
}

// Tiles are admitted to the scene only on animation frames, a few milliseconds' worth per frame,
// so a slow machine needs more frames. Keep pumping until the view is idle, as a browser would.
async function settle(view: { whenIdle(): Promise<void> }): Promise<void> {
  const idle = view.whenIdle();
  let settled = false;
  idle.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  while (!settled) await pump(1);
  return idle;
}

function fakeCanvas() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    ownerDocument: {},
    addEventListener(type: string, listener: (event: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: (event: unknown) => void) {
      listeners.get(type)?.delete(listener);
    },
    focus() {},
    tabIndex: -1,
    style: { touchAction: '' },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    emit(type: string, event: unknown) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

const HEIGHT = { min: -100, max: 900 };
const flat = encodePng16({ width: 3, height: 3, data: new Float32Array(9).fill(0.2) }); // 100 m

const earth: TerrainPackageDescriptor = {
  format: 'molen/terrain-package@1',
  name: 'unit-earth',
  version: '1',
  coordinateSpace: {
    kind: 'geospatial',
    crs: 'EPSG:3857',
    ellipsoid: 'WGS84',
    bounds: [-180, -85.0511287798066, 180, 85.0511287798066],
  },
  tileMatrix: { scheme: 'xyz', minLevel: 0, maxLevel: 10, rootTiles: [1, 1], tileResolution: 3 },
  elevation: {
    source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
    encoding: 'png16',
    height: HEIGHT,
  },
  attribution: [{ text: '© OpenStreetMap contributors; Test', license: 'ODbL-1.0' }],
  provenance: { compiler: 'test', compilerVersion: '1', sources: [{ id: 't', release: '1' }] },
  files: [],
};

const archive = {
  getHeader: async () => ({ minZoom: 0, maxZoom: 10, tileType: 2 }),
  getZxy: async () => ({ data: flat.slice().buffer }),
};

async function mount() {
  const canvas = fakeCanvas();
  const errors: unknown[] = [];
  const view = await mountEarthView({
    canvas: canvas as unknown as HTMLCanvasElement,
    terrain: earth,
    archives: { elevation: archive },
    camera: { latitude: 47.6, longitude: -122.33, range: 2_000, pitch: 0.6 },
    style: { sky: false },
    onError: (error) => errors.push(error),
  });
  return { view, canvas, errors };
}

describe('mountEarthView', () => {
  it('exposes a persistent boost mode and applies it to the walker through the T action', async () => {
    const { view } = await mount();
    const changes: boolean[] = [];
    view.on('boostchange', ({ enabled }) => changes.push(enabled));
    await pump(10);
    expect(view.boostMode).toBe(false);
    view.setBoostMode(true);
    view.setBoostMode(true);
    expect(view.setMode('walk')).toBe(true);
    await pump(30);
    view.input.map.setVirtual('test', 'nav-forward', 1);
    await pump(10);
    expect(view.walker.pose()?.speed).toBeCloseTo(6, 3);
    view.input.map.setVirtual('test', 'nav-boost', 1);
    await pump(2);
    expect(view.boostMode).toBe(false);
    expect(view.walker.pose()?.speed).toBeCloseTo(1.5, 3);
    expect(changes).toEqual([true, false]);
    view.dispose();
  });
  it('streams terrain around the requested place and reports it in geographic terms', async () => {
    const { view, canvas, errors } = await mount();
    await pump(20);
    await settle(view);
    await pump(5);
    const stats = view.stats();
    expect(stats.displayedTiles).toBeGreaterThan(0);
    expect(stats.failedTiles).toBe(0);
    expect(stats.frameLatitude).toBe(47.6);
    // Without content packs there are no styled buildings to count.
    expect(stats.worldgen).toBeUndefined();
    const camera = view.getCamera();
    expect(camera.mode).toBe('orbit');
    expect(camera.latitude).toBeCloseTo(47.6, 6);
    expect(camera.longitude).toBeCloseTo(-122.33, 6);
    expect(camera.range).toBeCloseTo(2_000, -1);
    // The target settled onto the 100 m plateau, so the camera sits above it.
    expect(camera.altitude).toBeGreaterThan(100 + 2_000 * Math.sin(0.6) * 0.9);
    expect(view.credits[0]?.label).toBe('© OpenStreetMap contributors');
    // Sun shadows cover the orbit target, sized to the 2 km view.
    expect(viewerState.shadowQuality).toBe('high');
    expect(viewerState.shadowRadius).toBeCloseTo(2_400, -1);
    // Cloud quality follows the same tier (Balanced: ray-marched, no cloud shadows).
    expect(viewerState.cloudQuality).toBe('medium');
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.style.touchAction).toBe('none');
    expect(errors).toEqual([]);
    view.dispose();
  });

  it('keeps the orbit camera within the distance the terrain draws', async () => {
    expect(earthOrbitMaxRange(60_000)).toBe(27_000);
    expect(earthOrbitMaxRange(1_000)).toBe(2_000);
    const { view } = await mount();
    view.jumpTo({ latitude: 47.6, longitude: -122.33, range: 1_900_000 });
    await pump(10);
    // The widest performance tier draws 110 km of terrain.
    expect(view.getCamera().range).toBeLessThanOrEqual(earthOrbitMaxRange(110_000));
    expect(view.getCamera().range).toBeGreaterThan(2_000);
    view.dispose();
  });

  it('places markers by latitude/longitude and emits camera changes while flying', async () => {
    const { view } = await mount();
    const changes: number[] = [];
    view.on('camerachange', (state) => changes.push(state.longitude));
    view.setMarkers([
      {
        id: 'needle',
        latitude: 47.6205,
        longitude: -122.3493,
        image: { width: 64, height: 64 } as unknown as TexImageSource,
      },
    ]);
    view.flyTo({ latitude: 47.62, longitude: -122.35, range: 800 }, { durationMs: 200 });
    await pump(40);
    expect(view.stats().markers).toBe(1);
    expect(changes.length).toBeGreaterThan(1);
    expect(view.getCamera().longitude).toBeCloseTo(-122.35, 6);
    const pin = view.markerScreenPosition('needle');
    expect(pin?.visible).toBe(true);
    view.dispose();
  });

  it('switches to walking at the view center and explains why driving is unavailable', async () => {
    const { view } = await mount();
    await pump(10);
    const modes: string[] = [];
    const messages: string[] = [];
    view.on('modechange', ({ mode }) => modes.push(mode));
    view.on('message', ({ text }) => messages.push(text));
    expect(view.setMode('walk')).toBe(true);
    expect(view.input.map.activeProfile).toBe('walk');
    await pump(30);
    const walking = view.getCamera();
    expect(walking.mode).toBe('walk');
    expect(walking.latitude).toBeCloseTo(47.6, 4);
    expect(walking.altitude).toBeCloseTo(100 + 1.7, 0);
    expect(view.setMode('drive')).toBe(false);
    expect(messages.length).toBe(1);
    expect(view.setMode('orbit')).toBe(true);
    expect(modes).toEqual(['walk', 'orbit']);
    view.dispose();
  });

  it('swims in supplied water without vehicle content and returns to walking on dry ground', async () => {
    let wet = true;
    const view = await mountEarthView({
      canvas: fakeCanvas() as unknown as HTMLCanvasElement,
      terrain: earth,
      archives: { elevation: archive },
      camera: { latitude: 47.6, longitude: -122.33, range: 2_000, pitch: 0.6 },
      style: { sky: false },
      waterAt: () => (wet ? { height: 104 } : null),
    });
    try {
      await pump(10);
      expect(view.setMode('walk')).toBe(true);
      await pump(30);
      expect(view.walker.ready).toBe(true);
      expect(view.walker.pose()?.swimming).toBe(true);
      expect(view.walker.pose()?.grounded).toBe(false);
      expect(view.getCamera().altitude).toBeCloseTo(104.45);
      expect(view.input.map.activeProfile).toBe('walk');
      view.input.map.setVirtual('test', 'nav-forward', 1);
      await pump(10);
      expect(view.walker.pose()?.speed).toBeCloseTo(1.2);
      wet = false;
      await pump(90);
      expect(view.walker.pose()?.swimming).toBe(false);
      expect(view.walker.pose()?.grounded).toBe(true);
      expect(view.getCamera().altitude).toBeCloseTo(101.7, 0);
    } finally {
      view.dispose();
    }
  });

  it('flies an aircraft out of the view, and adds a car on request', async () => {
    const canvas = fakeCanvas();
    const failedModels: unknown[] = [];
    const content = {
      packs: {
        readBytes: async () => {
          throw new Error('no models in unit tests');
        },
      },
      types: ENTITY_TYPES,
      parkedVehicles: [],
      assets: { load: async () => new Uint8Array(), loadText: async () => '' },
      stars: async () => [],
    } as unknown as EarthContent;
    const view = await mountEarthView({
      canvas: canvas as unknown as HTMLCanvasElement,
      terrain: earth,
      archives: { elevation: archive },
      content,
      audio: false,
      ambient: false,
      camera: { latitude: 47.6, longitude: -122.33, range: 2_000, heading: Math.PI / 2 },
      style: { sky: false },
      onError: (error) => failedModels.push(error),
    });
    await pump(10);
    const messages: string[] = [];
    view.on('message', ({ text }) => messages.push(text));
    expect(view.vehicleStatus()).toBeUndefined();
    expect(view.setMode('fly')).toBe(true);
    expect(view.input.map.activeProfile).toBe('pilot');
    await pump(60);
    const flight = view.vehicleStatus();
    expect(flight?.kind).toBe('aircraft');
    if (flight?.kind !== 'aircraft') throw new Error('not flying');
    expect(flight.grounded).toBe(false);
    expect(flight.altitudeAGL).toBeGreaterThan(100);
    expect(flight.heading).toBeCloseTo(Math.PI / 2, 1);
    expect(view.getCamera().mode).toBe('fly');
    // The throttle lever is settable from host controls.
    view.setThrottle(1);
    expect((view.vehicleStatus() as { power: number }).power).toBe(1);
    // Leaving in the air follows the aircraft's rules unless the host forces it.
    expect(view.setMode('orbit')).toBe(false);
    expect(messages.at(-1)).toMatch(/Land/);
    expect(view.setMode('orbit', { force: true })).toBe(true);
    expect(view.vehicleStatus()).toBeUndefined();
    // Drive with no road network around: the car starts at the view center once its ground has
    // streamed in; until then the mode is set but nobody is aboard.
    expect(view.setMode('drive', { vehicle: true, force: true })).toBe(true);
    expect(view.mode).toBe('drive');
    await pump(60);
    const car = view.vehicleStatus();
    expect(car?.kind).toBe('car');
    expect(view.getCamera().mode).toBe('drive');
    expect(view.getCamera().latitude).toBeCloseTo(47.6, 2);
    expect(view.setMode('walk', { force: true })).toBe(true);
    view.dispose();
  });

  it('re-anchors the metric frame after a long hop', async () => {
    const { view } = await mount();
    await pump(5);
    view.flyTo({ latitude: 40.7, longitude: -74.0, range: 3_000 }, { durationMs: 300 });
    await pump(40);
    await settle(view);
    await pump(5);
    const stats = view.stats();
    expect(stats.frameLatitude).toBeCloseTo(40.7, 6);
    expect(stats.displayedTiles).toBeGreaterThan(0);
    const camera = view.getCamera();
    expect(camera.latitude).toBeCloseTo(40.7, 5);
    expect(camera.longitude).toBeCloseTo(-74.0, 5);
    view.dispose();
  });

  it('asks the host for terrain after a longitude-only hop and replaces the old stream', async () => {
    const requests: number[] = [];
    const other: TerrainPackageDescriptor = {
      ...earth,
      name: 'other-region',
      attribution: [{ text: 'Other terrain provider', license: 'CC0-1.0' }],
    };
    const view = await mountEarthView({
      canvas: fakeCanvas() as unknown as HTMLCanvasElement,
      camera: { latitude: 47.6, longitude: -122.33, range: 2_000 },
      style: { sky: false },
      terrainSource: async (target) => {
        requests.push(target.longitude);
        return target.longitude < -100
          ? { key: 'seattle', terrain: earth, archives: { elevation: archive } }
          : { key: 'faraway', terrain: other, archives: { elevation: archive } };
      },
    });
    await pump(5);
    const initialChildren = [...view.viewer.renderer.worldRoot.children];
    const regions: string[] = [];
    view.on('terrainchange', ({ key }) => regions.push(key ?? 'unknown'));
    expect(view.credits[0]?.label).toBe('© OpenStreetMap contributors');
    view.jumpTo({ latitude: 47.6, longitude: -87.6, range: 2_000 });
    await pump(40);
    await settle(view);
    await pump(5);
    expect(requests).toEqual([-122.33, -87.6]);
    expect(regions).toEqual(['faraway']);
    expect(view.credits[0]?.label).toBe('Other terrain provider');
    expect(view.getCamera().longitude).toBeCloseTo(-87.6, 5);
    expect(view.stats().displayedTiles).toBeGreaterThan(0);
    expect(view.viewer.renderer.worldRoot.children).toHaveLength(initialChildren.length);
    expect(
      initialChildren.some((child) => !view.viewer.renderer.worldRoot.children.includes(child)),
    ).toBe(true);
    view.dispose();
  });

  it('uses the latest destination when another jump arrives during terrain resolution', async () => {
    const requests: number[] = [];
    const selected = (key: string) => ({ key, terrain: earth, archives: { elevation: archive } });
    let resolveMiddle!: (source: ReturnType<typeof selected>) => void;
    const middle = new Promise<ReturnType<typeof selected>>((resolve) => {
      resolveMiddle = resolve;
    });
    const view = await mountEarthView({
      canvas: fakeCanvas() as unknown as HTMLCanvasElement,
      camera: { latitude: 47.6, longitude: -122.33, range: 2_000 },
      style: { sky: false },
      terrainSource: async (target) => {
        requests.push(target.longitude);
        return target.longitude < -120
          ? selected('home')
          : target.longitude < -95
            ? middle
            : selected('destination');
      },
    });
    view.jumpTo({ latitude: 47.6, longitude: -100, range: 2_000 });
    view.jumpTo({ latitude: 47.6, longitude: -87.6, range: 2_000 });
    resolveMiddle(selected('middle'));
    await pump(40);
    await settle(view);
    expect(requests).toEqual([-122.33, -100, -87.6]);
    expect(view.getCamera().longitude).toBeCloseTo(-87.6, 5);
    expect(view.stats().displayedTiles).toBeGreaterThan(0);
    view.dispose();
  });

  it('streams elevation it opens itself through a byte cache, from disk on the next visit', async () => {
    // A real PNG16 elevation archive at levels 0-6, served over HTTP ranges.
    const tiles = [];
    for (let z = 0; z <= 6; z++) {
      for (let y = 0; y < 2 ** z; y++) {
        for (let x = 0; x < 2 ** z; x++) tiles.push({ z, x, y, data: flat });
      }
    }
    const bytes = writePmtilesArchive(tiles, { tileType: 'png', bounds: [-180, -85, 180, 85] });
    const url = 'https://terrain.example/v1/elevation.pmtiles';
    let requests = 0;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(url);
      requests++;
      const match = /^bytes=(\d+)-(\d+)$/.exec(new Headers(init?.headers).get('range') ?? '');
      if (match === null) throw new Error('expected a range request');
      const start = Number(match[1]);
      const end = Math.min(Number(match[2]), bytes.length - 1);
      return new Response(bytes.slice(start, end + 1), {
        status: 206,
        headers: {
          'content-range': `bytes ${start}-${end}/${bytes.length}`,
          'content-length': String(end - start + 1),
          etag: '"t1"',
        },
      });
    });
    const pkg: TerrainPackageDescriptor = {
      ...earth,
      tileMatrix: { ...earth.tileMatrix, maxLevel: 6 },
      files: [{ path: 'elevation.pmtiles', sha256: 'ab12', bytes: bytes.length }],
    };
    const store = createMemoryByteStore();
    const visit = async () => {
      const cache = createBlockCache(store);
      const view = await mountEarthView({
        canvas: fakeCanvas() as unknown as HTMLCanvasElement,
        terrain: pkg,
        baseUrl: 'https://terrain.example/v1/terrain-package.json',
        byteCache: cache,
        camera: { latitude: 47.6, longitude: -122.33, range: 2_000, pitch: 0.6 },
        style: { sky: false },
      });
      await pump(20);
      await settle(view);
      await cache.flush();
      const stats = { view: view.stats(), cache: view.cacheStats().cache };
      view.dispose();
      return stats;
    };
    const first = await visit();
    expect(first.view.displayedTiles).toBeGreaterThan(0);
    expect(first.view.failedTiles).toBe(0);
    expect(first.cache?.storeArchives).toBe(1);
    const firstRequests = requests;
    expect(firstRequests).toBeGreaterThan(0);

    const second = await visit();
    expect(second.view.displayedTiles).toBe(first.view.displayedTiles);
    expect(requests).toBe(firstRequests);
    expect(second.cache?.storeHits).toBeGreaterThan(0);
  });

  it('reads places a host queues into the byte cache before the camera gets there', async () => {
    const tiles = [];
    for (let z = 0; z <= 8; z++) {
      for (let y = 0; y < 2 ** z; y++) {
        for (let x = 0; x < 2 ** z; x++) tiles.push({ z, x, y, data: flat });
      }
    }
    const bytes = writePmtilesArchive(tiles, { tileType: 'png', bounds: [-180, -85, 180, 85] });
    let requests = 0;
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests++;
      const match = /^bytes=(\d+)-(\d+)$/.exec(new Headers(init?.headers).get('range') ?? '');
      if (match === null) throw new Error('expected a range request');
      const start = Number(match[1]);
      const end = Math.min(Number(match[2]), bytes.length - 1);
      return new Response(bytes.slice(start, end + 1), {
        status: 206,
        headers: {
          'content-range': `bytes ${start}-${end}/${bytes.length}`,
          'content-length': String(end - start + 1),
        },
      });
    });
    const pkg: TerrainPackageDescriptor = {
      ...earth,
      tileMatrix: { ...earth.tileMatrix, maxLevel: 8 },
      files: [{ path: 'elevation.pmtiles', sha256: 'cd34', bytes: bytes.length }],
    };
    const mountWith = (prefetch: false | undefined) =>
      mountEarthView({
        canvas: fakeCanvas() as unknown as HTMLCanvasElement,
        terrain: pkg,
        baseUrl: 'https://terrain.example/v1/terrain-package.json',
        byteCache: createBlockCache(createMemoryByteStore(), { blockBytes: 4096 }),
        ...(prefetch === false ? { prefetch } : {}),
        camera: { latitude: 47.6, longitude: -122.33, range: 2_000, pitch: 0.6 },
        style: { sky: false },
      });
    const view = await mountWith(undefined);
    await pump(20);
    await settle(view);
    const before = requests;
    // About 250 km east (this archive's finest tiles are ~100 km wide): nothing there is resident.
    const result = await view.prefetch([{ latitude: 47.6, longitude: -119, altitude: 800 }]);
    expect(result.requested).toBeGreaterThan(0);
    expect(result.warmed).toBe(result.requested);
    // Every tile here is the same image, which the archive stores once, so the reads may all be
    // served from bytes the view already fetched; prefetch.test.ts counts archive reads.
    expect(requests).toBeGreaterThanOrEqual(before);
    expect(view.cacheStats().prefetch?.warmed).toBe(result.warmed);
    view.dispose();

    const off = await mountWith(false);
    expect(await off.prefetch([{ latitude: 47.6, longitude: -121.8 }])).toEqual({
      requested: 0,
      warmed: 0,
      failed: 0,
    });
    expect(off.cacheStats().prefetch).toBeUndefined();
    off.dispose();
  });

  it('pauses rendering and releases everything on dispose', async () => {
    const { view, canvas } = await mount();
    await pump(3);
    view.setPaused(true);
    const frames = viewerState.frames;
    await pump(5);
    expect(viewerState.frames).toBe(frames);
    view.setPaused(false);
    await pump(2);
    expect(viewerState.frames).toBeGreaterThan(frames);
    view.dispose();
    expect(viewerState.disposed).toBe(1);
    const afterDispose = viewerState.frames;
    await pump(3);
    expect(viewerState.frames).toBe(afterDispose);
    expect(canvas.listenerCount()).toBe(0);
  });

  it('pauses simulation and rendering on blur/hidden, preserving a manual pause', async () => {
    const { view } = await mount();
    const onFrame = vi.fn();
    view.on('frame', onFrame);
    await pump(3);
    window.dispatchEvent(new Event('blur'));
    const frames = viewerState.frames;
    const simFrames = onFrame.mock.calls.length;
    expect(simFrames).toBeGreaterThan(0);
    await pump(10);
    expect(viewerState.frames).toBe(frames);
    expect(onFrame).toHaveBeenCalledTimes(simFrames);
    Object.assign(document, { hidden: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await pump(2);
    expect(viewerState.frames).toBe(frames);
    view.setPaused(true);
    Object.assign(document, { hidden: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await pump(2);
    expect(viewerState.frames).toBe(frames);
    view.setPaused(false);
    await pump(2);
    expect(viewerState.frames).toBe(frames + 2);
    view.dispose();
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    await pump(2);
    expect(viewerState.frames).toBe(frames + 2);
  });
});

// The hooks a game host builds on: the frame event, geographic helpers, walker placement, owned
// vehicles and the interact key.
describe('mountEarthView game hooks', () => {
  const SEDAN = 'molen.entities.vehicle.sedan';
  const MUSTANG = 'molen.entities.aircraft.p51d';

  async function mountWithContent() {
    const canvas = fakeCanvas();
    const errors: unknown[] = [];
    const content = {
      packs: {
        readBytes: async () => {
          throw new Error('no models in unit tests');
        },
      },
      types: ENTITY_TYPES,
      parkedVehicles: [],
      assets: { load: async () => new Uint8Array(), loadText: async () => '' },
      stars: async () => [],
    } as unknown as EarthContent;
    const view = await mountEarthView({
      canvas: canvas as unknown as HTMLCanvasElement,
      terrain: earth,
      archives: { elevation: archive },
      content,
      audio: false,
      ambient: false,
      camera: { latitude: 47.6, longitude: -122.33, range: 2_000, heading: 0 },
      style: { sky: false },
      onError: (error) => errors.push(error),
    });
    return { view, canvas, errors };
  }

  it('reports every frame to the host and converts between places and world meters', async () => {
    const { view } = await mount();
    await pump(2);
    const frames: EarthFrame[] = [];
    const off = view.on('frame', (frame) => frames.push(frame));
    await pump(5);
    expect(frames.length).toBe(5);
    const latest = frames.at(-1) as EarthFrame;
    expect(latest.dt).toBeCloseTo(0.016, 2);
    expect(latest.mode).toBe('orbit');
    expect(latest.viewer.latitude).toBeCloseTo(47.6, 4);
    expect(latest.viewer.longitude).toBeCloseTo(-122.33, 4);
    expect(latest.viewer.speed).toBe(0);
    off();
    await pump(2);
    expect(frames.length).toBe(5);
    const [x, z] = view.toWorld(47.61, -122.34);
    const back = view.toGeo(x, z);
    expect(back.latitude).toBeCloseTo(47.61, 9);
    expect(back.longitude).toBeCloseTo(-122.34, 9);
    await settle(view);
    expect(view.groundHeight(47.6, -122.33)).toBeCloseTo(100, 0);
    view.dispose();
  });

  it('starts walking at a given place, reports the walker, and teleports it', async () => {
    const { view } = await mount();
    await pump(10);
    expect(view.walker.pose()).toBeUndefined();
    expect(
      view.setMode('walk', {
        at: { latitude: 47.605, longitude: -122.335, heading: Math.PI / 2 },
      }),
    ).toBe(true);
    await pump(30);
    const pose = view.walker.pose();
    expect(pose?.latitude).toBeCloseTo(47.605, 5);
    expect(pose?.longitude).toBeCloseTo(-122.335, 5);
    expect(pose?.heading).toBeCloseTo(Math.PI / 2, 3);
    expect(pose?.altitude).toBeCloseTo(100, 0);
    expect(pose?.speed).toBe(0);
    expect(view.walker.ready).toBe(true);
    // Nearby: an instant move. The camera follows the feet.
    view.walker.place({ latitude: 47.61, longitude: -122.33 });
    await pump(30);
    expect(view.walker.pose()?.latitude).toBeCloseTo(47.61, 5);
    expect(view.getCamera().latitude).toBeCloseTo(47.61, 4);
    expect(view.mode).toBe('walk');
    // Far away: the frame re-anchors first, then the walker lands there.
    view.walker.place({ latitude: 40.7, longitude: -74, heading: Math.PI });
    expect(view.mode).toBe('walk');
    await pump(20);
    await settle(view);
    await pump(40);
    expect(view.stats().frameLatitude).toBeCloseTo(40.7, 6);
    const far = view.walker.pose();
    expect(far?.latitude).toBeCloseTo(40.7, 5);
    expect(far?.longitude).toBeCloseTo(-74, 5);
    expect(far?.heading).toBeCloseTo(Math.PI, 3);
    expect(view.walker.ready).toBe(true);
    view.dispose();
  });

  it('keeps owned vehicles where the host parks them, through drives and a long hop', async () => {
    const { view } = await mountWithContent();
    await pump(10);
    const changes: string[] = [];
    view.on('vehiclechange', ({ id, change }) => changes.push(`${id}:${change}`));
    expect(() =>
      view.vehicles.spawn({
        type: 'molen.entities.tree.conifer.pine',
        latitude: 0,
        longitude: 0,
        heading: 0,
      }),
    ).toThrow(/is not a .*type in the content packs/);
    const car = view.vehicles.spawn({
      id: 'car-1',
      type: SEDAN,
      latitude: 47.601,
      longitude: -122.33,
      heading: Math.PI,
      color: '#b8362d',
    });
    const plane = view.vehicles.spawn({
      id: 'plane-1',
      type: MUSTANG,
      latitude: 47.602,
      longitude: -122.33,
      heading: 0,
    });
    expect([car, plane]).toEqual(['car-1', 'plane-1']);
    expect(view.vehicles.list()).toEqual(['car-1', 'plane-1']);
    const placed = Promise.all([view.vehicles.whenPlaced(car), view.vehicles.whenPlaced(plane)]);
    await pump(60);
    await placed;
    expect(changes).toContain('car-1:placed');
    expect(changes).toContain('plane-1:placed');
    const parked = view.vehicles.pose('car-1');
    expect(parked?.placed).toBe(true);
    expect(parked?.kind).toBe('car');
    expect(parked?.latitude).toBeCloseTo(47.601, 4);
    expect(parked?.longitude).toBeCloseTo(-122.33, 4);
    expect(parked?.heading).toBeCloseTo(Math.PI, 2);
    expect(parked?.altitude).toBeCloseTo(100, 0);
    expect(parked?.occupied).toBe(false);
    expect(view.vehicles.pose('plane-1')?.kind).toBe('aircraft');
    // From the orbit camera the car is out of reach; force boards it anyway.
    const messages: string[] = [];
    view.on('message', ({ text }) => messages.push(text));
    expect(view.vehicles.board('car-1')).toBe(false);
    expect(messages.at(-1)).toMatch(/closer/);
    expect(view.vehicles.board('car-1', { force: true })).toBe(true);
    expect(view.mode).toBe('drive');
    expect(view.vehicleStatus()?.kind).toBe('car');
    expect(view.vehicles.pose('car-1')?.occupied).toBe(true);
    await pump(5);
    // Stepping out leaves an owned car where it is (a car setMode added would go).
    view.vehicles.release();
    expect(view.mode).toBe('walk');
    expect(changes).toContain('car-1:boarded');
    expect(changes).toContain('car-1:left');
    expect(view.vehicles.pose('car-1')?.placed).toBe(true);
    expect(view.vehicles.pose('car-1')?.occupied).toBe(false);
    // The aircraft boards the same way.
    expect(view.vehicles.board('plane-1', { force: true })).toBe(true);
    expect(view.mode).toBe('fly');
    expect(view.vehicleStatus()?.kind).toBe('aircraft');
    view.vehicles.release();
    expect(view.mode).toBe('walk');
    expect(view.vehicles.list()).toEqual(['car-1', 'plane-1']);
    // Paint and removal.
    view.vehicles.setColor('car-1', '#123456');
    expect(changes).toContain('car-1:painted');
    view.vehicles.remove('plane-1');
    expect(changes).toContain('plane-1:removed');
    expect(view.vehicles.list()).toEqual(['car-1']);
    // A long hop rebuilds the metric frame; the car keeps its place and comes back on return.
    view.flyTo({ latitude: 40.7, longitude: -74.0, range: 3_000 }, { durationMs: 300 });
    await pump(40);
    await settle(view);
    await pump(5);
    expect(view.stats().frameLatitude).toBeCloseTo(40.7, 6);
    expect(view.vehicles.pose('car-1')?.latitude).toBeCloseTo(47.601, 4);
    view.flyTo({ latitude: 47.6, longitude: -122.33, range: 2_000 }, { durationMs: 300 });
    await pump(40);
    await settle(view);
    await pump(30);
    const returned = view.vehicles.pose('car-1');
    expect(returned?.placed).toBe(true);
    expect(returned?.latitude).toBeCloseTo(47.601, 4);
    expect(returned?.heading).toBeCloseTo(Math.PI, 2);
    view.dispose();
  });

  it('applies a mode switch that arrives while a long jump rebuilds the frame', async () => {
    const { view } = await mount();
    await pump(10);
    // A host jumps across the world and asks to walk there at once, the way a map that opens in
    // walk mode does. The frame is being rebuilt, so the switch waits instead of being dropped.
    view.jumpTo({ latitude: 40.7, longitude: -74.0, range: 2_000 });
    expect(view.setMode('walk')).toBe(true);
    await pump(20);
    await settle(view);
    await pump(40);
    expect(view.stats().frameLatitude).toBeCloseTo(40.7, 6);
    expect(view.mode).toBe('walk');
    expect(view.walker.pose()?.latitude).toBeCloseTo(40.7, 4);
    // The newest request wins: a walk start somewhere else, asked for during the next rebuild.
    view.jumpTo({ latitude: 47.6, longitude: -122.33, range: 2_000 });
    expect(view.setMode('walk', { at: { latitude: 51.5, longitude: -0.12, heading: 0 } })).toBe(
      true,
    );
    // Until the walker lands, the view reports the destination, never feet from the old frame.
    const seen: number[] = [];
    const off = view.on('frame', ({ viewer }) => seen.push(viewer.latitude));
    for (let i = 0; i < 6; i++) {
      await pump(20);
      await settle(view);
    }
    await pump(40);
    off();
    expect(view.stats().frameLatitude).toBeCloseTo(51.5, 6);
    expect(view.walker.pose()?.latitude).toBeCloseTo(51.5, 4);
    expect(view.walker.pose()?.longitude).toBeCloseTo(-0.12, 4);
    for (const latitude of seen) expect(Math.abs(latitude)).toBeLessThan(90);
    expect(
      seen.every((latitude) => Math.abs(latitude - 47.6) < 0.5 || Math.abs(latitude - 51.5) < 0.5),
    ).toBe(true);
    // A jump cancels a switch that is still waiting.
    view.jumpTo({ latitude: 40.7, longitude: -74.0, range: 2_000 });
    view.setMode('orbit', { force: true });
    expect(view.setMode('walk')).toBe(true);
    view.jumpTo({ latitude: 40.71, longitude: -74.0, range: 2_000 });
    await pump(20);
    await settle(view);
    await pump(20);
    expect(view.mode).toBe('orbit');
    view.dispose();
  });

  it('tells the host what the interact key would do and lets it claim the press', async () => {
    const { view } = await mountWithContent();
    await pump(10);
    view.setMode('walk', { at: { latitude: 47.6, longitude: -122.33, heading: 0 } });
    await pump(30);
    expect(view.interactable()).toEqual({ kind: 'none' });
    const here = view.walker.pose();
    if (here === undefined) throw new Error('not walking');
    // A car 1.8 m ahead (north), nose north: within reach of its door.
    view.vehicles.spawn({
      id: 'car-2',
      type: SEDAN,
      latitude: here.latitude + 1.8 / 111_320,
      longitude: here.longitude,
      heading: 0,
    });
    await pump(5);
    const found = view.interactable();
    expect(found.kind).toBe('vehicle');
    expect(found.id).toBe('car-2');
    expect(found.distance ?? Infinity).toBeLessThan(3);
    // A claimed press is the host's: the view does not board.
    const seen: string[] = [];
    const off = view.on('interact', (interaction) => {
      seen.push(`${interaction.kind}:${interaction.id ?? ''}`);
      interaction.claim();
    });
    view.input.map.press('KeyE');
    view.input.map.release('KeyE');
    await pump(1);
    expect(seen).toEqual(['vehicle:car-2']);
    expect(view.mode).toBe('walk');
    off();
    // Unclaimed, the view boards the car; aboard, the key refers to the car and leaves it.
    view.input.map.press('KeyE');
    view.input.map.release('KeyE');
    await pump(1);
    expect(view.mode).toBe('drive');
    expect(view.vehicleStatus()?.kind).toBe('car');
    expect(view.interactable()).toEqual({ kind: 'vehicle', id: 'car-2', distance: 0 });
    await pump(5);
    view.input.map.press('KeyE');
    view.input.map.release('KeyE');
    await pump(1);
    expect(view.mode).toBe('walk');
    view.dispose();
  });
});

// Map overrides through the facade: the mount option, the `view.overrides` handle and its
// events, the entities an override brings, and what happens to them across a re-anchor. The flat
// package has no map layers, so there is no tile to build again here (overrides-stream.test.ts
// covers that against a real stream); what is under test is the view's own wiring.
describe('mountEarthView overrides', () => {
  const HOME = { latitude: 47.6, longitude: -122.33 };
  const SEDAN = 'molen.entities.vehicle.sedan';
  const PERSON = { preset: 'human.adult' as const, height: 1.72 };
  const lot = (extra: Partial<EarthOverride> = {}): EarthOverride => ({
    id: 'lot',
    area: { center: [HOME.longitude, HOME.latitude], size: [80, 60] },
    buildings: [{ id: 'shed', rect: { size: [48, 30] }, height: 9 }],
    ...extra,
  });
  /** A point of `lot`'s frame as a place. */
  const inLot = (x: number, z: number): { latitude: number; longitude: number } => {
    const [longitude, latitude] = mapOverridePoint(
      { center: [HOME.longitude, HOME.latitude], heading: 0 },
      [x, z],
    );
    return { latitude, longitude };
  };

  async function mountOverrides(
    options: { overrides?: readonly EarthOverride[]; types?: boolean } = {},
  ) {
    const canvas = fakeCanvas();
    const errors: Array<{ error: unknown; context: string }> = [];
    const content = {
      packs: {
        readBytes: async () => {
          throw new Error('no models in unit tests');
        },
      },
      types: ENTITY_TYPES,
      parkedVehicles: [],
      assets: { load: async () => new Uint8Array(), loadText: async () => '' },
      stars: async () => [],
    } as unknown as EarthContent;
    const view = await mountEarthView({
      canvas: canvas as unknown as HTMLCanvasElement,
      terrain: earth,
      archives: { elevation: archive },
      ...(options.types ? { content, audio: false as const, ambient: false as const } : {}),
      ...(options.overrides !== undefined ? { overrides: options.overrides } : {}),
      camera: { ...HOME, range: 2_000, heading: 0 },
      style: { sky: false },
      onError: (error, context) => errors.push({ error, context }),
    });
    const events: string[] = [];
    view.on('overridechange', ({ revision, state, ids }) =>
      events.push(`${revision}:${state}:${ids.join(',')}`),
    );
    return { view, canvas, errors, events };
  }

  /** Pump frames until `promise` settles, as a browser keeps drawing while a host awaits. */
  async function drawn<T>(promise: Promise<T>, limit = 2_000): Promise<T> {
    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    for (let i = 0; i < limit && !settled; i++) await pump(1);
    if (!settled) throw new Error('still waiting after pumping frames');
    return promise;
  }

  it('takes overrides at mount, and refuses to mount with one it cannot place', async () => {
    const first = lot();
    const { view, errors, events } = await mountOverrides({ overrides: [first] });
    // Kept as given, not copied: a host's own fields on an override stay on it.
    expect(view.overrides.list()).toEqual([first]);
    expect(view.overrides.get('lot')).toBe(first);
    expect(view.overrides.get('other')).toBeUndefined();
    expect(view.overrides.revision).toBe(0);
    expect(view.stats().overrides).toEqual({ count: 1, refreshing: 0 });
    // The first tiles are built from them: nothing to apply, nothing announced.
    await view.overrides.whenApplied();
    await pump(10);
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
    view.dispose();

    viewerState.disposed = 0;
    const canvas = fakeCanvas();
    await expect(
      mountEarthView({
        canvas: canvas as unknown as HTMLCanvasElement,
        terrain: earth,
        archives: { elevation: archive },
        overrides: [first, lot({ id: 'bad', minLevel: 99 })],
        camera: { ...HOME, range: 2_000 },
        style: { sky: false },
      }),
    ).rejects.toThrow(/map override "bad".*minLevel/);
    // Nothing is left running behind the failed mount.
    expect(viewerState.disposed).toBe(1);
    expect(canvas.listenerCount()).toBe(0);
    const frames = viewerState.frames;
    await pump(3);
    expect(viewerState.frames).toBe(frames);
  });

  it('adds, replaces and removes overrides while running, announcing each change', async () => {
    const { view, events, errors } = await mountOverrides();
    await pump(10);
    expect(view.overrides.list()).toEqual([]);
    expect(view.stats().overrides).toBeUndefined();
    // Nothing to wait for: at once, with or without a signal.
    await view.overrides.whenApplied();
    await view.overrides.whenApplied({ signal: new AbortController().signal });

    const first = lot();
    view.overrides.set(first);
    expect(view.overrides.revision).toBe(1);
    expect(view.overrides.get('lot')).toBe(first);
    // Announced once the task that made the change is over, then again when it is on screen.
    expect(events).toEqual([]);
    await view.overrides.whenApplied();
    expect(events).toEqual(['1:pending:lot', '1:applied:lot']);
    expect(view.stats().overrides).toEqual({ count: 1, refreshing: 0 });

    // One it cannot place throws and changes nothing.
    expect(() => view.overrides.set(lot({ minLevel: 99 }))).toThrow(/map override "lot"/);
    expect(() => view.overrides.set({ ...lot(), id: 'Not An Id' })).toThrow(/id must be/);
    expect(view.overrides.revision).toBe(1);
    expect(view.overrides.get('lot')).toBe(first);
    await view.overrides.whenApplied();
    expect(events).toHaveLength(2);

    // The changes of one task are announced together.
    const other = lot({
      id: 'other',
      area: { center: [HOME.longitude + 0.01, HOME.latitude], size: [40, 40] },
    });
    view.overrides.set(other);
    view.overrides.set(lot({ surface: 'paved' }));
    expect(view.overrides.revision).toBe(3);
    await view.overrides.whenApplied();
    expect(events.slice(2)).toEqual(['3:pending:other,lot', '3:applied:other,lot']);
    expect(view.overrides.list().map((override) => override.id)).toEqual(['lot', 'other']);
    expect(view.stats().overrides?.count).toBe(2);

    expect(view.overrides.remove('other')).toBe(true);
    expect(view.overrides.remove('other')).toBe(false);
    expect(view.overrides.revision).toBe(4);
    await view.overrides.whenApplied();
    expect(events.slice(4)).toEqual(['4:pending:other', '4:applied:other']);

    view.overrides.clear();
    await view.overrides.whenApplied();
    expect(events.slice(6)).toEqual(['5:pending:lot', '5:applied:lot']);
    expect(view.overrides.list()).toEqual([]);
    expect(view.stats().overrides).toBeUndefined();
    // Clearing nothing is no change.
    view.overrides.clear();
    expect(view.overrides.revision).toBe(5);
    await view.overrides.whenApplied();
    expect(events).toHaveLength(8);
    expect(errors).toEqual([]);
    // Without content packs there is no map of buildings to ask.
    expect(view.buildingAt(HOME)).toBeUndefined();
    expect(view.buildingAt({ ...HOME, radius: 500 })).toBeUndefined();
    view.dispose();
  });

  it('lets a host abandon its wait for a change to reach the screen', async () => {
    const { view } = await mountOverrides();
    await pump(10);
    const gone = new AbortController();
    gone.abort();
    await expect(view.overrides.whenApplied({ signal: gone.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    // A far jump rebuilds the frame: until it is up, changes are not on screen.
    view.jumpTo({ latitude: 40.7, longitude: -74.0, range: 2_000 });
    view.overrides.set(lot());
    const controller = new AbortController();
    let outcome = 'waiting';
    view.overrides.whenApplied({ signal: controller.signal }).then(
      () => {
        outcome = 'applied';
      },
      (error: Error) => {
        outcome = error.name;
      },
    );
    const order: string[] = [];
    view.on('terrainchange', () => order.push('frame'));
    const patient = view.overrides.whenApplied().then(() => {
      order.push('applied');
    });
    const microtasks = async (count: number): Promise<void> => {
      for (let i = 0; i < count; i++) await Promise.resolve();
    };
    await microtasks(2);
    expect(outcome).toBe('waiting');
    controller.abort();
    await microtasks(5);
    expect(outcome).toBe('AbortError');
    // The other wait goes on, and ends once the new frame stands.
    await drawn(patient);
    expect(order).toEqual(['frame', 'applied']);
    expect(view.stats().frameLatitude).toBeCloseTo(40.7, 6);
    expect(view.overrides.get('lot')).toBeDefined();
    view.dispose();
  });

  it('brings the people, vehicles and scene an override declares, and takes them away with it', async () => {
    const { view, errors } = await mountOverrides({ types: true });
    await pump(10);
    const load = vi.fn(async () => {
      throw new Error('never near enough to load in this test');
    });
    view.overrides.set(
      lot({
        actors: [
          { id: 'guard', figure: PERSON, position: [0, 20], heading: Math.PI / 2 },
          { id: 'dog', figure: { preset: 'dog' }, position: [2, 20] },
        ],
        vehicles: [
          // A type the mounted packs do not have: reported, and the rest still applies.
          { id: 'ghost', type: 'no.such.vehicle', position: [10, 0] },
          { id: 'car', type: SEDAN, position: [-30, 22], heading: Math.PI },
        ],
      }),
    );
    // People at once; vehicles once the ground they stand on has been rebuilt.
    expect(view.actors.list()).toEqual(['lot/guard', 'lot/dog']);
    expect(view.vehicles.list()).toEqual([]);
    await view.overrides.whenApplied();
    await nextTimerTurn();
    expect(view.vehicles.list()).toEqual(['lot/car']);
    expect(errors.map(({ context }) => context)).toEqual(['override vehicle lot/ghost']);
    expect(String(errors[0]?.error)).toMatch(/no\.such\.vehicle/);
    // Laid out in the override's frame: +z is south, headings are compass headings.
    await drawn(view.vehicles.whenPlaced('lot/car'));
    const car = view.vehicles.pose('lot/car');
    expect(car?.latitude).toBeCloseTo(inLot(-30, 22).latitude, 5);
    expect(car?.longitude).toBeCloseTo(inLot(-30, 22).longitude, 5);
    expect(car?.heading).toBeCloseTo(Math.PI, 2);
    for (let i = 0; i < 120 && view.actors.pose('lot/guard')?.placed !== true; i++) await pump(1);
    const guard = view.actors.pose('lot/guard');
    expect(guard?.placed).toBe(true);
    expect(guard?.latitude).toBeCloseTo(inLot(0, 20).latitude, 5);
    expect(guard?.longitude).toBeCloseTo(inLot(0, 20).longitude, 5);
    expect(guard?.heading).toBeCloseTo(Math.PI / 2, 2);
    expect(guard?.latitude).toBeLessThan(HOME.latitude);

    // A scene is a diorama on the override's rectangle; this one is 5 km off and stays unloaded.
    view.overrides.set(
      lot({
        id: 'plaza',
        area: { center: [HOME.longitude + 0.07, HOME.latitude], size: [70, 50] },
        buildings: [],
        scene: { load },
      }),
    );
    expect(view.dioramas.list()).toEqual(['plaza/scene']);
    expect(view.dioramas.status('plaza/scene')).toBe('idle');
    await view.overrides.whenApplied();
    await pump(5);
    expect(load).not.toHaveBeenCalled();

    // Set again with one actor fewer: the others stay as they are, the car where it stands.
    const before = view.actors.pose('lot/guard');
    view.overrides.set(
      lot({
        actors: [{ id: 'guard', figure: PERSON, position: [0, 20], heading: Math.PI / 2 }],
        vehicles: [{ id: 'car', type: SEDAN, position: [-30, 22], heading: Math.PI }],
      }),
    );
    await view.overrides.whenApplied();
    await nextTimerTurn();
    expect(view.actors.list()).toEqual(['lot/guard']);
    expect(view.actors.pose('lot/guard')?.placed).toBe(before?.placed);
    expect(view.vehicles.list()).toEqual(['lot/car']);
    expect(view.vehicles.pose('lot/car')?.placed).toBe(true);

    // Gone with their overrides.
    expect(view.overrides.remove('lot')).toBe(true);
    expect(view.actors.list()).toEqual([]);
    expect(view.vehicles.list()).toEqual([]);
    expect(view.dioramas.list()).toEqual(['plaza/scene']);
    view.overrides.clear();
    expect(view.dioramas.list()).toEqual([]);
    await view.overrides.whenApplied();
    expect(errors).toHaveLength(1);
    view.dispose();
  });

  it('keeps overrides and what they brought through a re-anchor of the view', async () => {
    const { view, errors } = await mountOverrides({ types: true });
    await pump(10);
    view.overrides.set(lot({ actors: [{ id: 'guard', figure: PERSON, position: [0, 20] }] }));
    await view.overrides.whenApplied();
    for (let i = 0; i < 120 && view.actors.pose('lot/guard')?.placed !== true; i++) await pump(1);
    expect(view.actors.pose('lot/guard')?.placed).toBe(true);

    // A far jump rebuilds the metric frame; a change made meanwhile lands in the new one.
    view.jumpTo({ latitude: 40.7, longitude: -74.0, range: 2_000 });
    const away = lot({
      id: 'away',
      area: { center: [-74.0, 40.7], size: [50, 50] },
      actors: [{ id: 'host', figure: PERSON, position: [0, 0] }],
    });
    view.overrides.set(away);
    await drawn(view.overrides.whenApplied());
    await settle(view);
    await pump(5);
    expect(view.stats().frameLatitude).toBeCloseTo(40.7, 6);
    expect(view.overrides.list().map((override) => override.id)).toEqual(['lot', 'away']);
    expect(view.overrides.get('away')).toBe(away);
    expect(view.stats().overrides).toEqual({ count: 2, refreshing: 0 });
    expect([...view.actors.list()].sort()).toEqual(['away/host', 'lot/guard']);
    // The one left behind keeps its place; the one here stands on the new frame's ground.
    const guard = view.actors.pose('lot/guard');
    expect(guard?.placed).toBe(false);
    expect(guard?.latitude).toBeCloseTo(inLot(0, 20).latitude, 5);
    for (let i = 0; i < 240 && view.actors.pose('away/host')?.placed !== true; i++) await pump(1);
    const host = view.actors.pose('away/host');
    expect(host?.placed).toBe(true);
    expect(host?.latitude).toBeCloseTo(40.7, 5);
    expect(host?.longitude).toBeCloseTo(-74.0, 5);

    // And back: the first override's guard is placed again where it was declared.
    view.jumpTo({ ...HOME, range: 2_000 });
    await drawn(view.overrides.whenApplied());
    await settle(view);
    for (let i = 0; i < 240 && view.actors.pose('lot/guard')?.placed !== true; i++) await pump(1);
    expect(view.actors.pose('lot/guard')?.placed).toBe(true);
    expect(view.actors.pose('lot/guard')?.latitude).toBeCloseTo(inLot(0, 20).latitude, 5);
    expect(view.overrides.list()).toHaveLength(2);
    // Removed in this frame, it takes its actor with it as before.
    view.overrides.remove('away');
    expect(view.actors.list()).toEqual(['lot/guard']);
    expect(errors).toEqual([]);
    view.dispose();
  });

  it('announces a change made while the view re-anchors, once the new frame shows it', async () => {
    const { view, events, errors } = await mountOverrides();
    // No terrain stack is bound between a far jump and the new frame standing: the view itself
    // tells of the change, and of its being applied when that frame is up.
    view.jumpTo({ latitude: 40.7, longitude: -74.0, range: 2_000 });
    view.overrides.set(lot({ id: 'away', area: { center: [-74.0, 40.7], size: [50, 50] } }));
    await Promise.resolve();
    expect(events).toEqual(['1:pending:away']);
    await drawn(view.overrides.whenApplied());
    await settle(view);
    expect(view.stats().frameLatitude).toBeCloseTo(40.7, 6);
    expect(events).toEqual(['1:pending:away', '1:applied:away']);
    // A change left pending when its frame goes is applied in the next one, and said so once.
    view.overrides.set(lot());
    view.jumpTo({ ...HOME, range: 2_000 });
    await drawn(view.overrides.whenApplied());
    await settle(view);
    expect(events).toEqual(['1:pending:away', '1:applied:away', '2:pending:lot', '2:applied:lot']);
    expect(errors).toEqual([]);
    view.dispose();
  });

  it('stands a walker outside a building that an override puts around them', async () => {
    const { view } = await mountOverrides();
    await pump(10);
    expect(view.setMode('walk', { at: { ...HOME, heading: Math.PI / 2 } })).toBe(true);
    await pump(30);
    expect(view.walker.ready).toBe(true);
    const [x0, z0] = view.toWorld(HOME.latitude, HOME.longitude);
    const feet = (): [number, number] => {
      const pose = view.walker.pose();
      if (pose === undefined) throw new Error('not walking');
      return view.toWorld(pose.latitude, pose.longitude);
    };
    // An override elsewhere leaves the walker alone.
    view.overrides.set(
      lot({ id: 'far', area: { center: [HOME.longitude + 0.01, HOME.latitude], size: [40, 40] } }),
    );
    await view.overrides.whenApplied();
    await pump(10);
    expect(view.walker.ready).toBe(true);
    expect(feet()[0]).toBeCloseTo(x0, 3);
    expect(feet()[1]).toBeCloseTo(z0, 3);
    // A hall 20 m by 12 m around the walker, whose north wall is the nearest: 4 m away.
    view.overrides.set(
      lot({ buildings: [{ id: 'hall', rect: { center: [0, 2], size: [20, 12] }, levels: 2 }] }),
    );
    await view.overrides.whenApplied();
    for (let i = 0; i < 120 && !view.walker.ready; i++) await pump(1);
    await pump(10);
    expect(view.walker.ready).toBe(true);
    const [x, z] = feet();
    // A meter and a half outside that wall, still facing the way they were.
    expect(x).toBeCloseTo(x0, 1);
    expect(z0 - z).toBeCloseTo(5.5, 1);
    expect(view.walker.pose()?.heading).toBeCloseTo(Math.PI / 2, 3);
    expect(view.walker.pose()?.altitude).toBeCloseTo(100, 0);
    expect(view.mode).toBe('walk');
    // Outside the footprint, a later change of the same override does not move them again.
    view.overrides.set(
      lot({ buildings: [{ id: 'hall', rect: { center: [0, 2], size: [20, 12] }, levels: 3 }] }),
    );
    await view.overrides.whenApplied();
    await pump(10);
    expect(feet()[1]).toBeCloseTo(z, 3);
    view.dispose();
  });
});
