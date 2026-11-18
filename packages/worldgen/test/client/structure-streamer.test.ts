import type { AssetRuntimeLods } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  type StructureLodManifest,
  StructureLodStreamer,
  structureGeometryBytes,
  structureStreamingMobile,
} from '../../src/client/structure-streamer';

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const view = { position: [0, 0, 0] as const, verticalFov: 45, viewportHeight: 900 };
function manifest(): StructureLodManifest {
  return {
    bounds: {
      aabb: { min: [-1, 0, -1], max: [1, 2, 1] },
      sphere: { center: [0, 1, 0], radius: 2 },
    },
    runtimeLods: {
      recipe: 1,
      masterHash: `sha256:${'0'.repeat(64)}`,
      levels: ['skyline', 'district', 'street', 'closeup'].map((name, i) => ({
        name,
        file: `model.${name}.glb`,
        hash: `sha256:${String(i).repeat(64)}`,
        bytes: 1000,
        gzipBytes: 500,
        cpuBytes: 2000,
        gpuBytes: 2000,
        triangles: 12,
        drawCalls: 1,
        errorMeters: [100, 10, 1, 0][i],
      })) as AssetRuntimeLods['levels'],
    },
  };
}
function model(name = '') {
  const root = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial());
  root.name = name;
  return root;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

describe('bounded landmark LOD streaming', () => {
  it('reserves all skylines before upgrades and stays stable around an LOD threshold', async () => {
    let now = 0;
    const doc = manifest();
    for (const [index, level] of doc.runtimeLods.levels.entries()) {
      level.errorMeters = index === 0 ? 0.1 : 0;
      if (index > 0) level.drawCalls = 4;
    }
    const load = vi.fn(async () => model());
    const streamer = new StructureLodStreamer(async () => doc, load, {
      clock: () => now,
      budget: { maxDrawCalls: 14 },
    });
    for (let i = 0; i < 4; i++)
      streamer.instantiate(await streamer.acquire(String(i)), { position: [0, 0, 50] });
    // Skyline error is about 2.26 pixels: must not oscillate between thresholds after loading.
    now = 2000;
    for (let i = 0; i < 40; i++) {
      streamer.update(view);
      await flush();
      now += 100;
    }
    expect(load).toHaveBeenCalledTimes(5);
    expect(streamer.stats().drawCalls).toBe(7);
    streamer.dispose();
  });
  it('shares skyline loads and retains the visible instance while preparing an upgrade', async () => {
    let now = 0;
    const preparation = deferred<void>();
    const load = vi.fn(async (_ref, level) => model(level.name));
    const streamer = new StructureLodStreamer(async () => manifest(), load, {
      clock: () => now,
      prepareObject: () => preparation.promise,
    });
    const [a, b] = await Promise.all([streamer.acquire('tower'), streamer.acquire('tower')]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
    const root = streamer.instantiate(a, {
      position: [0, 0, 0],
      prepare: (object) => {
        object.position.x = 37;
        return object;
      },
    });
    const original = root.children[0];
    now = 2000;
    streamer.update(view);
    await flush();
    streamer.update(view);
    await flush();
    expect(load.mock.calls.map((call) => call[1].name)).toEqual(['skyline', 'closeup']);
    expect(root.children).toEqual([original]);
    preparation.resolve();
    await flush();
    expect(root.userData.landmarkLod).toBe('closeup');
    expect(root.children[0]?.position.x).toBe(37);
    expect(root.children[0]).not.toBe(original);
    streamer.update({ ...view, direction: [0.342, 0, -0.94] });
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    root.userData.disposeTerrainSurfaces();
    streamer.release('tower');
    streamer.release('tower');
    streamer.dispose();
  });

  it('falls back to the skyline instead of dropping a placement over the draw-call budget', async () => {
    let now = 0;
    const doc = manifest();
    for (const [index, level] of doc.runtimeLods.levels.entries())
      if (index > 0) level.drawCalls = 5;
    const streamer = new StructureLodStreamer(
      async () => doc,
      async (_ref, level) => model(level.name),
      {
        clock: () => now,
        budget: { maxDrawCalls: 16 },
      },
    );
    const handle = await streamer.acquire('tower', { position: [0, 0, 0] });
    const first = streamer.instantiate(handle, { position: [0, 0, 0] });
    now = 2000;
    for (let i = 0; i < 6; i++) {
      streamer.update(view);
      await flush();
      now += 100;
    }
    expect(first.userData.landmarkLod).toBe('closeup');
    // A second tile places the same landmark (a parent and child during a level change): five
    // more detailed draws would overrun the budget, so both drop to the resident skyline.
    const second = streamer.instantiate(handle, { position: [0, 0, 0] });
    expect(second.userData.landmarkLod).toBe('skyline');
    expect(first.userData.landmarkLod).toBe('skyline');
    expect(second.children).toHaveLength(1);
    expect(streamer.stats().drawCalls * 2).toBeLessThanOrEqual(16);
    streamer.dispose();
  });

  it('places a landmark on its skyline while others hold the detail budget', async () => {
    let now = 0;
    const doc = manifest();
    for (const [index, level] of doc.runtimeLods.levels.entries())
      if (index > 0) level.drawCalls = 5;
    const streamer = new StructureLodStreamer(
      async () => doc,
      async (_ref, level) => model(level.name),
      { clock: () => now, budget: { maxDrawCalls: 12 } },
    );
    const near = streamer.instantiate(await streamer.acquire('near', { position: [0, 0, 0] }), {
      position: [0, 0, 0],
    });
    const far = await streamer.acquire('far', { position: [0, 0, 40] });
    streamer.instantiate(far, { position: [0, 0, 40] });
    const settle = async () => {
      for (let i = 0; i < 6; i++) {
        streamer.update(view);
        await flush();
        now += 100;
      }
    };
    now = 2000;
    await settle();
    expect(near.userData.landmarkLod).toBe('closeup');
    // A child tile places the far landmark again while its parent is still resident (a flight
    // towards it). The far one is already on its skyline, yet its extra draw overruns the budget
    // the near one fills. Refusing it dropped the landmark for as long as the child tile stayed.
    await streamer.acquire('far', { position: [0, 0, 40] });
    const child = streamer.instantiate(far, { position: [0, 0, 40] });
    expect(child.userData.landmarkLod).toBe('skyline');
    expect(child.children).toHaveLength(1);
    // The next passes reserve both skylines first and move the detailed one down to fit.
    await settle();
    expect(near.userData.landmarkLod).toBe('skyline');
    expect(streamer.stats().drawCalls * 2).toBeLessThanOrEqual(12);
    streamer.dispose();
  });

  it('charges only drawn instances, not those hidden in the warm cache', async () => {
    let now = 0;
    const doc = manifest();
    for (const [index, level] of doc.runtimeLods.levels.entries())
      if (index > 0) level.drawCalls = 5;
    const streamer = new StructureLodStreamer(
      async () => doc,
      async (_ref, level) => model(level.name),
      { clock: () => now, budget: { maxDrawCalls: 12 } },
    );
    // A flight towards the landmark: the coarser tile that placed it first has left the view
    // and waits, hidden, in the warm cache; the finer tile now drawing it holds a second instance.
    const cached = new THREE.Group();
    const shown = new THREE.Group();
    const handle = await streamer.acquire('tower', { position: [0, 0, 0] });
    cached.add(streamer.instantiate(handle, { position: [0, 0, 0] }));
    await streamer.acquire('tower', { position: [0, 0, 0] });
    const drawn = streamer.instantiate(handle, { position: [0, 0, 0] });
    shown.add(drawn);
    cached.visible = false;
    const settle = async () => {
      for (let i = 0; i < 6; i++) {
        streamer.update(view);
        await flush();
        now += 100;
      }
    };
    now = 2000;
    await settle();
    // Counted twice, five closeup draws (ten with shadows) per instance would not fit in twelve.
    expect(drawn.userData.landmarkLod).toBe('closeup');
    expect(streamer.stats().drawCalls).toBe(5);
    // Back on screen, both draw: the next passes move it down to fit.
    cached.visible = true;
    await settle();
    expect(drawn.userData.landmarkLod).toBe('skyline');
    expect(streamer.stats().drawCalls * 2).toBeLessThanOrEqual(12);
    streamer.dispose();
  });

  it('gives a touch-screen laptop the desktop budget and a coarse pointer the phone one', () => {
    const media = (coarse: boolean) => (query: string) =>
      ({ matches: coarse && query === '(pointer: coarse)' }) as MediaQueryList;
    try {
      vi.stubGlobal('navigator', { maxTouchPoints: 10, deviceMemory: 8 });
      vi.stubGlobal('matchMedia', media(false));
      expect(structureStreamingMobile()).toBe(false);
      vi.stubGlobal('matchMedia', media(true));
      expect(structureStreamingMobile()).toBe(true);
      vi.stubGlobal('navigator', { maxTouchPoints: 0, deviceMemory: 4 });
      vi.stubGlobal('matchMedia', media(false));
      expect(structureStreamingMobile()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('gives instances placed during a publication the published level', async () => {
    let now = 0;
    const preparation = deferred<void>();
    const streamer = new StructureLodStreamer(
      async () => manifest(),
      async (_ref, level) => model(level.name),
      { clock: () => now, prepareObject: () => preparation.promise },
    );
    const handle = await streamer.acquire('tower');
    const first = streamer.instantiate(handle, { position: [0, 0, 0] });
    now = 2000;
    streamer.update(view);
    await flush();
    streamer.update(view);
    await flush();
    // The closeup is being prepared for `first`; another tile places the landmark meanwhile.
    const second = streamer.instantiate(handle, { position: [0, 0, 0] });
    expect(second.userData.landmarkLod).toBe('skyline');
    preparation.resolve();
    await flush();
    expect(first.userData.landmarkLod).toBe('closeup');
    expect(second.userData.landmarkLod).toBe('closeup');
    expect(second.getObjectByName('closeup')).toBeDefined();
    expect(second.getObjectByName('skyline')).toBeUndefined();
    streamer.dispose();
  });

  it('reserves initial bytes, limits concurrency, and starts nearest queued landmarks first', async () => {
    const pending = deferred<THREE.Object3D>();
    const load = vi.fn(async () => pending.promise);
    const streamer = new StructureLodStreamer(async () => manifest(), load, {
      budget: { concurrency: 1, maxInitialBytes: 1500 },
    });
    const far = streamer.acquire('far', { position: [900, 0, 0] });
    const farError = far.catch((error) => error);
    const near = streamer.acquire('near', { position: [2, 0, 0] });
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0]).toBe('near');
    expect(streamer.stats().reservedCpuBytes).toBe(2000);
    pending.resolve(model());
    await near;
    expect((await farError).message).toContain('budget');
    expect(load).toHaveBeenCalledTimes(1);
    streamer.dispose();
  });

  it('keeps warm assets for revisits, then evicts without loading another city', async () => {
    let now = 0;
    const load = vi.fn(async () => model());
    const streamer = new StructureLodStreamer(async () => manifest(), load, { clock: () => now });
    await streamer.acquire('seattle');
    streamer.release('seattle');
    now = 4000;
    await streamer.acquire('seattle');
    expect(load).toHaveBeenCalledTimes(1);
    streamer.release('seattle');
    now = 10000;
    streamer.update(view);
    expect(streamer.stats().assets).toBe(0);
    expect(streamer.stats().gpuBytes).toBe(0);
    expect(load).toHaveBeenCalledTimes(1);
    streamer.dispose();
  });

  it('cancels a shared request only after its final user leaves and disposes a late result', async () => {
    const pending = deferred<THREE.Object3D>();
    let signal!: AbortSignal;
    const streamer = new StructureLodStreamer(
      async () => manifest(),
      async (_ref, _level, next) => {
        signal = next;
        return pending.promise;
      },
    );
    const one = new AbortController(),
      two = new AbortController();
    const a = streamer.acquire('tower', { signal: one.signal }).catch((error) => error);
    const b = streamer.acquire('tower', { signal: two.signal }).catch((error) => error);
    await flush();
    one.abort();
    await a;
    expect(signal.aborted).toBe(false);
    two.abort();
    await b;
    expect(signal.aborted).toBe(true);
    const late = model();
    const disposed = vi.spyOn(late.geometry, 'dispose');
    pending.resolve(late);
    await flush();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(streamer.stats().assets).toBe(0);
    streamer.dispose();
  });

  it('rejects underreported decoded memory and keeps skyline after an upgrade fails', async () => {
    const huge = model();
    huge.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(30000), 3),
    );
    const bounded = new StructureLodStreamer(
      async () => manifest(),
      async () => huge,
      { budget: { maxCpuBytes: 4000, maxGpuBytes: 4000 } },
    );
    await expect(bounded.acquire('huge')).rejects.toThrow('decoded geometry');
    expect(bounded.stats().gpuBytes).toBe(0);
    bounded.dispose();
    let now = 0;
    const streamer = new StructureLodStreamer(
      async () => manifest(),
      async (_ref, level) => {
        if (level.name !== 'skyline') throw new Error('offline');
        return model();
      },
      { clock: () => now },
    );
    const root = streamer.instantiate(await streamer.acquire('tower'));
    now = 2000;
    streamer.update(view);
    await flush();
    expect(root.children).toHaveLength(1);
    expect(root.userData.landmarkLod).toBe('skyline');
    expect(streamer.stats().failed).toBe(1);
    streamer.dispose();
  });

  it('counts overlapping mixed-type GPU uploads separately but shared CPU storage once', () => {
    const buffer = new ArrayBuffer(96);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.InterleavedBufferAttribute(
        new THREE.InterleavedBuffer(new Float32Array(buffer), 4),
        3,
        0,
      ),
    );
    geometry.setAttribute(
      'color',
      new THREE.InterleavedBufferAttribute(
        new THREE.InterleavedBuffer(new Uint8Array(buffer), 16),
        3,
        12,
        true,
      ),
    );
    const root = new THREE.Mesh(geometry);
    expect(structureGeometryBytes([root, root.clone()])).toEqual({ cpuBytes: 96, gpuBytes: 192 });
    geometry.dispose();
    (root.material as THREE.Material).dispose();
  });
});
