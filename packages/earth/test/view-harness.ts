// Tests only: mountEarthView against a stand-in viewer (real three.js scene objects, no WebGL), a
// frame queue for requestAnimationFrame, and a procedural flat-terrain package at 100 m. A test
// file mocks `@bendyline/molen-client` with `stubCreateViewer` and calls `stubFrameGlobals` in a
// `beforeEach` (vi.mock itself must stay in the test file).

import type * as Client from '@bendyline/molen-client';
import { encodePng16, type TerrainPackageDescriptor } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { vi } from 'vitest';

/** A `createViewer` stand-in: the real scene graph and camera, with only rendering replaced. */
export function stubCreateViewer(actual: typeof Client) {
  return async (options: { width: number; height: number }) => {
    let size: [number, number] = [options.width, options.height];
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
      getWorldOrigin: () => [0, 0, 0],
      getViewportSize: () => size,
      stats: () => ({ drawCalls: 0, triangles: 0 }),
      setStarCatalog: () => {},
      setShadowQuality: () => {},
      setCloudQuality: () => {},
      setShadowFocus: () => {},
    };
    renderer.scene.add(renderer.worldRoot);
    return {
      renderer,
      setCamera: (pose: { position: number[]; lookAt: number[] }) => {
        camera.position.fromArray(pose.position);
        camera.lookAt(new THREE.Vector3().fromArray(pose.lookAt));
        camera.updateMatrixWorld();
      },
      renderFrame: () => {},
      dispose: () => renderer.admission.dispose(),
    };
  };
}

let callbacks = new Map<number, (time: number) => void>();
let nextHandle = 1;
let clock = 0;

/** Stub the browser globals the view touches and reset the frame clock (call in beforeEach). */
export function stubFrameGlobals(): void {
  callbacks = new Map();
  nextHandle = 1;
  clock = 0;
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
}

/**
 * Resolve on a `setTimeout(0)`, so promises and any `setTimeout(0)` work the view queued first
 * (terrain's layer pump, for one) have run. Pending immediates keep the event loop from sleeping
 * until the timer is due: an idle loop on Windows sleeps a whole ~15.6 ms timer tick instead of
 * 1 ms, which made a thousand-frame test take 15 s there and 1 s on Linux.
 */
export function nextTimerTurn(): Promise<void> {
  return new Promise((resolve) => {
    let due = false;
    setTimeout(() => {
      due = true;
      resolve();
    }, 0);
    const spin = (): void => {
      if (!due) setImmediate(spin);
    };
    setImmediate(spin);
  });
}

/** Run `frames` animation frames, 16 ms apart, letting promises settle between them. */
export async function pump(frames: number): Promise<void> {
  for (let i = 0; i < frames; i++) {
    clock += 16;
    const due = [...callbacks.values()];
    callbacks.clear();
    for (const callback of due) callback(clock);
    await nextTimerTurn();
  }
}

/** Pump frames until the view's terrain is idle, as a browser keeps drawing. */
export async function settle(view: { whenIdle(): Promise<void> }): Promise<void> {
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

export function fakeCanvas() {
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
  };
}

const flat = encodePng16({ width: 3, height: 3, data: new Float32Array(9).fill(0.2) }); // 100 m

/** A world-wide package whose elevation is a flat 100 m everywhere. */
export const FLAT_EARTH: TerrainPackageDescriptor = {
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
    height: { min: -100, max: 900 },
  },
  attribution: [{ text: '© OpenStreetMap contributors; Test', license: 'ODbL-1.0' }],
  provenance: { compiler: 'test', compilerVersion: '1', sources: [{ id: 't', release: '1' }] },
  files: [],
};

export const FLAT_ARCHIVE = {
  getHeader: async () => ({ minZoom: 0, maxZoom: 10, tileType: 2 }),
  getZxy: async () => ({ data: flat.slice().buffer }),
};
