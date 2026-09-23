import type { Keyframe, MessageLink, SceneManifest } from '@bendyline/molen-schema';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, createSnapshotViewer, mountExperience } from '../src/client';
import type { ClientError } from '../src/client-core';
import { ThreeSceneBackend } from '../src/three/backend';

// The browser mount, driven with a fake WebGL driver and a fake canvas: sizing, live render
// settings, the frame loop's error handling, cancellation and container resizing.

const constructors = vi.hoisted(() => ({ webgl: vi.fn() }));
vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: constructors.webgl,
}));

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
  get subscriptions(): number {
    return [...this.listeners.values()].reduce((total, set) => total + set.size, 0);
  }
  deliver(message: unknown): void {
    for (const listener of [...(this.listeners.get('message') ?? [])]) listener({ data: message });
  }
}

interface FakeCanvas {
  clientWidth: number;
  clientHeight: number;
}

function fakeCanvas(clientWidth = 0, clientHeight = 0): FakeCanvas {
  return { clientWidth, clientHeight };
}

function asCanvas(canvas: FakeCanvas): HTMLCanvasElement {
  return canvas as unknown as HTMLCanvasElement;
}

function fakeDriver() {
  return {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
  };
}

const emptyScene = {} as SceneManifest;

function keyframe(): Keyframe {
  return {
    kind: 'keyframe',
    v: 1,
    engine: '0.0.1',
    tick: 0,
    tickRate: 30,
    seed: 'mount',
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

let driver: ReturnType<typeof fakeDriver>;
let frames: Array<() => void>;

beforeEach(() => {
  driver = fakeDriver();
  constructors.webgl.mockReset();
  constructors.webgl.mockImplementation(function MockWebGlRenderer() {
    return driver as unknown as THREE.WebGLRenderer;
  });
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mounting on a canvas with no layout', () => {
  it('falls back to 1280x720 instead of a zero size and a NaN aspect', async () => {
    // clientWidth is 0 (never undefined) before layout, so `?? 1280` never fired.
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(fakeCanvas(0, 0)),
      backend: 'webgl',
      frameLoop: 'manual',
    });
    expect(driver.setSize).toHaveBeenCalledWith(1280, 720, false);
    const camera = mounted.client.renderer.camera as THREE.PerspectiveCamera;
    expect(Number.isFinite(camera.aspect)).toBe(true);
    mounted.dispose();
  });

  it('mounts a top-down-ortho scene that used to throw on a non-finite aspect', async () => {
    const scene = {
      camera: { mode: 'top-down-ortho', center: [0, 0], viewHeight: 40 },
    } as unknown as SceneManifest;
    const mounted = await mountExperience({
      link: new Link(),
      scene,
      canvas: asCanvas(fakeCanvas(0, 0)),
      backend: 'webgl',
      frameLoop: 'manual',
    });
    const camera = mounted.client.renderer.camera as THREE.OrthographicCamera;
    expect(Number.isFinite(camera.right)).toBe(true);
    expect(camera.right).toBeGreaterThan(0);
    mounted.dispose();
  });

  it('setSize clamps a zero height rather than producing a NaN aspect', async () => {
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(fakeCanvas(800, 600)),
      backend: 'webgl',
      frameLoop: 'manual',
    });
    mounted.client.renderer.setSize(800, 0);
    const camera = mounted.client.renderer.camera as THREE.PerspectiveCamera;
    expect(Number.isFinite(camera.aspect)).toBe(true);
    mounted.dispose();
  });
});

describe('live vs capture render settings', () => {
  it('a live mount antialiases, drops the preserved buffer and caps the pixel ratio at 2', async () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(fakeCanvas(800, 600)),
      backend: 'webgl',
      frameLoop: 'manual',
    });
    expect(constructors.webgl).toHaveBeenCalledWith(
      expect.objectContaining({ antialias: true, preserveDrawingBuffer: false }),
    );
    expect(driver.setPixelRatio).toHaveBeenCalledWith(2);
    mounted.dispose();
  });

  it('the snapshot viewer keeps the deterministic capture defaults', async () => {
    const viewer = await createSnapshotViewer(keyframe(), { backend: 'webgl' });
    expect(constructors.webgl).toHaveBeenCalledWith(
      expect.objectContaining({ antialias: false, preserveDrawingBuffer: true }),
    );
    expect(driver.setPixelRatio).toHaveBeenCalledWith(1);
    viewer.dispose();
  });

  it('explicit options still win over the live defaults', async () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(fakeCanvas(800, 600)),
      backend: 'webgl',
      frameLoop: 'manual',
      antialias: false,
      preserveDrawingBuffer: true,
      pixelRatio: 1,
    });
    expect(constructors.webgl).toHaveBeenCalledWith(
      expect.objectContaining({ antialias: false, preserveDrawingBuffer: true }),
    );
    expect(driver.setPixelRatio).toHaveBeenCalledWith(1);
    mounted.dispose();
  });
});

describe('boot keyframe', () => {
  it('the synchronous client asks for a keyframe (a Worker drops messages posted pre-mount)', async () => {
    const link = new Link();
    const client = await createClient(link, { backend: 'webgl', frameLoop: 'manual' });
    expect(link.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'control',
      control: { action: 'request-keyframe' },
    });
    client.dispose();
  });
});

describe('the automatic frame loop', () => {
  it('survives a throwing frame, reports it, and stops only after a run of failures', async () => {
    const client = await createClient(new Link(), { backend: 'webgl' });
    const errors: ClientError[] = [];
    client.onError((e) => errors.push(e));
    expect(frames).toHaveLength(1);

    driver.render.mockImplementationOnce(() => {
      throw new Error('one bad frame');
    });
    (frames.pop() as () => void)();
    // The next frame is still scheduled: one exception must not freeze the page forever.
    expect(frames).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ source: 'frame' });
    expect(errors[0]?.message).toContain('one bad frame');

    (frames.pop() as () => void)(); // a good frame clears the streak
    expect(frames).toHaveLength(1);

    driver.render.mockImplementation(() => {
      throw new Error('device gone');
    });
    for (let i = 0; i < 20 && frames.length > 0; i++) (frames.pop() as () => void)();
    expect(frames).toHaveLength(0); // stopped instead of erroring at 60Hz forever
    const last = errors[errors.length - 1] as ClientError;
    expect(last.message).toContain('frame loop stopped');
    expect(last.message).toContain('device gone');
    client.dispose();
  });

  it('routes a frame failure to onDiag as well', async () => {
    const client = await createClient(new Link(), { backend: 'webgl' });
    const codes: string[] = [];
    client.onDiag((d) => codes.push(d.code));
    driver.render.mockImplementationOnce(() => {
      throw new Error('bad frame');
    });
    (frames.pop() as () => void)();
    expect(codes).toEqual(['frame-error']);
    client.dispose();
  });

  it('stops scheduling after dispose, without reporting the cancelled frame', async () => {
    const client = await createClient(new Link(), { backend: 'webgl' });
    const errors: ClientError[] = [];
    client.onError((e) => errors.push(e));
    client.dispose();
    (frames.pop() as () => void)();
    expect(frames).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});

describe('cancelling an asynchronous mount', () => {
  it('aborting mid-mount disposes everything and rejects with an AbortError', async () => {
    const link = new Link();
    const controller = new AbortController();
    const mounting = mountExperience({
      link,
      scene: emptyScene,
      canvas: asCanvas(fakeCanvas(800, 600)),
      backend: 'webgl',
      signal: controller.signal,
    });
    controller.abort();
    await expect(mounting).rejects.toMatchObject({ name: 'AbortError' });
    // Nothing left running on the canvas the host already unmounted.
    expect(link.subscriptions).toBe(0);
    expect(frames).toHaveLength(0);
    expect(driver.dispose).toHaveBeenCalledOnce();
  });

  it('an already-aborted signal never touches the link', async () => {
    const link = new Link();
    await expect(
      mountExperience({
        link,
        scene: emptyScene,
        canvas: asCanvas(fakeCanvas(800, 600)),
        backend: 'webgl',
        signal: AbortSignal.abort(),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(link.postMessage).not.toHaveBeenCalled();
    expect(constructors.webgl).not.toHaveBeenCalled();
  });

  it('mounts normally when the signal never aborts', async () => {
    const controller = new AbortController();
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(fakeCanvas(800, 600)),
      backend: 'webgl',
      frameLoop: 'manual',
      signal: controller.signal,
    });
    expect(mounted.client.renderer).toBeDefined();
    mounted.dispose();
  });
});

describe('auto-resize', () => {
  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    observed: unknown[] = [];
    disconnected = 0;
    constructor(readonly cb: () => void) {
      FakeResizeObserver.instances.push(this);
    }
    observe(target: unknown): void {
      this.observed.push(target);
    }
    disconnect(): void {
      this.disconnected++;
    }
  }

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('window', { innerWidth: 1024, innerHeight: 768 });
  });

  it('follows a container resize and re-reads the device pixel ratio', async () => {
    const canvas = fakeCanvas(800, 600);
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(canvas),
      backend: 'webgl',
      frameLoop: 'manual',
    });
    const observer = FakeResizeObserver.instances[0] as FakeResizeObserver;
    expect(observer.observed).toEqual([canvas]);

    // A sidebar toggle: the container shrinks with no window resize event at all.
    canvas.clientWidth = 400;
    canvas.clientHeight = 300;
    vi.stubGlobal('devicePixelRatio', 3);
    observer.cb();
    expect(driver.setPixelRatio).toHaveBeenLastCalledWith(2);
    expect(driver.setSize).toHaveBeenLastCalledWith(400, 300, false);

    mounted.dispose();
    expect(observer.disconnected).toBe(1);
  });

  it('keeps an explicit pixel ratio when the canvas resizes', async () => {
    const canvas = fakeCanvas(800, 600);
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(canvas),
      backend: 'webgl',
      frameLoop: 'manual',
      pixelRatio: 1.5,
    });
    expect(driver.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    driver.setPixelRatio.mockClear();
    canvas.clientWidth = 400;
    canvas.clientHeight = 300;
    vi.stubGlobal('devicePixelRatio', 3);
    (FakeResizeObserver.instances[0] as FakeResizeObserver).cb();
    expect(driver.setPixelRatio).not.toHaveBeenCalled();
    expect(driver.setSize).toHaveBeenLastCalledWith(400, 300, false);
    mounted.dispose();
  });

  it('uses the window size when the canvas has no layout of its own', async () => {
    const canvas = fakeCanvas(0, 0);
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(canvas),
      backend: 'webgl',
      frameLoop: 'manual',
      width: 640,
      height: 480,
    });
    driver.setSize.mockClear();
    (FakeResizeObserver.instances[0] as FakeResizeObserver).cb();
    expect(driver.setSize).toHaveBeenLastCalledWith(1024, 768, false);
    mounted.dispose();
  });

  it('keeps the mount-time size when nothing has a measurable size yet', async () => {
    vi.stubGlobal('window', { innerWidth: 0, innerHeight: 0 });
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(fakeCanvas(0, 0)),
      backend: 'webgl',
      frameLoop: 'manual',
      width: 640,
      height: 480,
    });
    driver.setSize.mockClear();
    // The observer fires once on observe(): it must not collapse the buffer to a pixel.
    (FakeResizeObserver.instances[0] as FakeResizeObserver).cb();
    expect(driver.setSize).not.toHaveBeenCalled();
    mounted.dispose();
  });

  it('falls back to the window resize event where ResizeObserver is missing', async () => {
    const handlers = new Map<string, () => void>();
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('window', {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: (type: string, cb: () => void) => handlers.set(type, cb),
      removeEventListener: (type: string) => handlers.delete(type),
    });
    const canvas = fakeCanvas(800, 600);
    const mounted = await mountExperience({
      link: new Link(),
      scene: emptyScene,
      canvas: asCanvas(canvas),
      backend: 'webgl',
      frameLoop: 'manual',
    });
    canvas.clientWidth = 500;
    canvas.clientHeight = 400;
    (handlers.get('resize') as () => void)();
    expect(driver.setSize).toHaveBeenLastCalledWith(500, 400, false);
    mounted.dispose();
    expect(handlers.has('resize')).toBe(false);
  });
});

describe('the three.js escape hatch', () => {
  it('exposes the backend and getObject on a mounted client', async () => {
    const link = new Link();
    const mounted = await mountExperience({
      link,
      scene: emptyScene,
      canvas: asCanvas(fakeCanvas(800, 600)),
      backend: 'webgl',
      frameLoop: 'manual',
    });
    const { client } = mounted;
    expect(client.backend).toBeInstanceOf(ThreeSceneBackend);
    expect(client.getObject('box')).toBeUndefined();
    link.deliver({ type: 'keyframe', keyframe: keyframe(), events: [] });
    const object = client.getObject('box');
    expect(object).toBeDefined();
    // The same object the backend hands out, with its escape bookkeeping done.
    expect(object).toBe(client.backend.getObject('box'));
    expect(object?.matrixAutoUpdate).toBe(true);
    mounted.dispose();
  });
});
