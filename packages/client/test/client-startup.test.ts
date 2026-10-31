import type { Keyframe, MessageLink } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetCache } from '../src/assets';
import { createClient, createSnapshotViewer } from '../src/client';
import { ThreeSceneBackend } from '../src/three/backend';
import { MaterialResolver } from '../src/three/materials';
import { Renderer } from '../src/three/renderer';

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

  it('stops automatic GPU frames and suspends the worker on blur, then resumes once', async () => {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { hidden: false, defaultView: win });
    vi.stubGlobal('document', doc);
    const frames = new Map<number, () => void>();
    let id = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      frames.set(++id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle));
    const render = vi.spyOn(Renderer.prototype, 'render').mockImplementation(() => {});
    const link = new Link();
    const client = await createClient(link, { backend: 'webgl' });
    const stale = [...frames.values()][0];
    win.dispatchEvent(new Event('blur'));
    expect(frames.size).toBe(0);
    stale?.();
    expect(render).not.toHaveBeenCalled();
    expect(link.postMessage).toHaveBeenLastCalledWith({
      type: 'control',
      control: { action: 'set-active', active: false },
    });
    const prepare = vi.fn();
    const prepared = client.renderer.admission.run(prepare);
    client.renderer.admission.flush();
    expect(prepare).not.toHaveBeenCalled();
    expect(driver.dispose).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('focus'));
    win.dispatchEvent(new Event('focus'));
    expect(link.postMessage).toHaveBeenLastCalledWith({
      type: 'control',
      control: { action: 'set-active', active: true },
    });
    const due = [...frames.values()];
    frames.clear();
    for (const cb of due) cb();
    await prepared;
    expect(render).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledOnce();
    expect(frames.size).toBe(1);
    client.dispose();
    const count = link.postMessage.mock.calls.length;
    win.dispatchEvent(new Event('blur'));
    win.dispatchEvent(new Event('focus'));
    expect(link.postMessage).toHaveBeenCalledTimes(count);
    expect(frames.size).toBe(0);
  });

  it('starts inactive without rendering and leaves manual capture loops alone', async () => {
    const win = new EventTarget();
    vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: true, defaultView: win }));
    const schedule = vi.fn();
    vi.stubGlobal('requestAnimationFrame', schedule);
    const link = new Link();
    const client = await createClient(link, { backend: 'webgl' });
    expect(schedule).not.toHaveBeenCalled();
    expect(link.postMessage).toHaveBeenCalledWith({
      type: 'control',
      control: { action: 'set-active', active: false },
    });
    client.dispose();
    link.postMessage.mockClear();
    const manual = await createClient(link, { backend: 'webgl', frameLoop: 'manual' });
    expect(link.postMessage).toHaveBeenCalledTimes(1); // request-keyframe only
    manual.dispose();
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
