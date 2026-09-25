// mountEarthView against a stand-in viewer: real three.js scene objects and the real terrain
// pyramid, navigation, markers and quality code, with only WebGL replaced. A procedural archive
// supplies flat PNG16 elevation so streaming, placement and re-anchoring run end to end.

import { encodePng16, type TerrainPackageDescriptor } from '@bendyline/molen-terrain/kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const viewerState = vi.hoisted(() => ({ disposed: 0, frames: 0 }));

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

const { mountEarthView } = await import('../src/client/earth-view');

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
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', {
    hidden: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
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
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
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
  it('streams terrain around the requested place and reports it in geographic terms', async () => {
    const { view, canvas, errors } = await mount();
    await pump(20);
    await view.whenIdle();
    await pump(5);
    const stats = view.stats();
    expect(stats.displayedTiles).toBeGreaterThan(0);
    expect(stats.failedTiles).toBe(0);
    expect(stats.frameLatitude).toBe(47.6);
    const camera = view.getCamera();
    expect(camera.mode).toBe('orbit');
    expect(camera.latitude).toBeCloseTo(47.6, 6);
    expect(camera.longitude).toBeCloseTo(-122.33, 6);
    expect(camera.range).toBeCloseTo(2_000, -1);
    // The target settled onto the 100 m plateau, so the camera sits above it.
    expect(camera.altitude).toBeGreaterThan(100 + 2_000 * Math.sin(0.6) * 0.9);
    expect(view.credits[0]?.label).toBe('© OpenStreetMap contributors');
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.style.touchAction).toBe('none');
    expect(errors).toEqual([]);
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

  it('re-anchors the metric frame after a long hop', async () => {
    const { view } = await mount();
    await pump(5);
    view.flyTo({ latitude: 40.7, longitude: -74.0, range: 3_000 }, { durationMs: 300 });
    await pump(40);
    await view.whenIdle();
    await pump(5);
    const stats = view.stats();
    expect(stats.frameLatitude).toBeCloseTo(40.7, 6);
    expect(stats.displayedTiles).toBeGreaterThan(0);
    const camera = view.getCamera();
    expect(camera.latitude).toBeCloseTo(40.7, 5);
    expect(camera.longitude).toBeCloseTo(-74.0, 5);
    view.dispose();
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
});
