import type { Keyframe, MessageLink } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetCache } from '../src/assets';
import { createClient, createSnapshotViewer } from '../src/client';
import { ThreeSceneBackend } from '../src/three/backend';
import { MaterialResolver } from '../src/three/materials';

const constructors = vi.hoisted(() => ({ webgl: vi.fn() }));
vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: constructors.webgl,
}));

/** Listeners are kept per type, like a real Worker: the client subscribes `message` for state and
 *  `error`/`messageerror` so a crashed worker is not invisible. */
class Link implements MessageLink {
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  postMessage = vi.fn((_message: unknown): void => {});
  addEventListener(type: string, listener: (event: unknown) => void): void {
    let set = this.listeners.get(type);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }
  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  /** Every live subscription, across types. */
  get subscriptions(): number {
    return [...this.listeners.values()].reduce((total, set) => total + set.size, 0);
  }
}

const provider = {
  load: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
  loadText: async (): Promise<string> => '',
};

describe('async client startup cleanup', () => {
  let driver: ReturnType<typeof fakeDriver>;

  beforeEach(() => {
    driver = fakeDriver();
    constructors.webgl.mockReset();
    constructors.webgl.mockImplementation(function MockWebGlRenderer() {
      return driver as unknown as THREE.WebGLRenderer;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('removes the live subscription and disposes assets/materials when camera setup rejects', async () => {
    const link = new Link();
    const disposeBackend = vi.spyOn(ThreeSceneBackend.prototype, 'dispose');
    const disposeAssets = vi.spyOn(AssetCache.prototype, 'dispose');
    const disposeMaterials = vi.spyOn(MaterialResolver.prototype, 'dispose');
    await expect(
      createClient(link, {
        backend: 'webgl',
        frameLoop: 'manual',
        assets: { provider },
        sceneCamera: { mode: 'fixed', position: [0, 0, 10], fov: 0 },
      }),
    ).rejects.toThrow('fov must be');
    expect(link.subscriptions).toBe(0);
    expect(link.postMessage).not.toHaveBeenCalled();
    expect(disposeBackend).toHaveBeenCalledOnce();
    expect(disposeAssets).toHaveBeenCalledOnce();
    expect(disposeMaterials).toHaveBeenCalledOnce();
    expect(driver.dispose).toHaveBeenCalledOnce();
  });

  it('releases already-created snapshot geometry on a later initialization failure', async () => {
    const disposeGeometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const disposeBackend = vi.spyOn(ThreeSceneBackend.prototype, 'dispose');
    await expect(
      createSnapshotViewer(snapshot(), {
        backend: 'webgl',
        sceneCamera: { mode: 'fixed', position: [0, 0, 10], fov: 0 },
      }),
    ).rejects.toThrow('fov must be');
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeBackend).toHaveBeenCalledOnce();
    expect(driver.dispose).toHaveBeenCalledOnce();
  });

  it('cancels the scheduled frame and releases the link if keyframe resynchronization fails', async () => {
    const link = new Link();
    link.postMessage.mockImplementation(() => {
      throw new Error('Worker terminated');
    });
    const schedule = vi.fn(() => 17);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', schedule);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    await expect(createClient(link, { backend: 'webgl' })).rejects.toThrow('Worker terminated');
    expect(schedule).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledExactlyOnceWith(17);
    expect(link.subscriptions).toBe(0);
    expect(driver.dispose).toHaveBeenCalledOnce();
  });

  it('installs the live listener before requesting state lost during asynchronous initialization', async () => {
    const link = new Link();
    const disposeBackend = vi.spyOn(ThreeSceneBackend.prototype, 'dispose');
    link.postMessage.mockImplementation(() => {
      expect(link.listeners.get('message')?.size).toBe(1);
    });
    const client = await createClient(link, { backend: 'webgl', frameLoop: 'manual' });
    expect(link.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'control',
      control: { action: 'request-keyframe' },
    });
    client.dispose();
    client.dispose();
    expect(link.subscriptions).toBe(0);
    expect(disposeBackend).toHaveBeenCalledOnce();
  });

  it('makes successful snapshot viewer disposal idempotent', async () => {
    const disposeGeometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const disposeBackend = vi.spyOn(ThreeSceneBackend.prototype, 'dispose');
    const client = await createSnapshotViewer(snapshot(), { backend: 'webgl' });
    client.dispose();
    client.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeBackend).toHaveBeenCalledOnce();
    expect(driver.dispose).toHaveBeenCalledOnce();
  });
});

function fakeDriver() {
  return {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    dispose: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
  };
}

function snapshot(): Keyframe {
  return {
    kind: 'keyframe',
    v: 1,
    engine: '0.0.1',
    tick: 0,
    tickRate: 30,
    seed: 'startup',
    nextEntitySeq: 0,
    rng: { algo: 'sfc32', state: [1, 2, 3, 4] },
    entities: {
      box: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'primitive', ref: 'box' },
      },
    },
    plugins: {},
  };
}
