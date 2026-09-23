import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetCache, createUrlAssetProvider } from '../src/assets';

// The URL provider's variant preference: model.<variant>.glb first, model.glb on a 404 only.

const BASE = 'http://host/app/';

function stubFetch(served: Record<string, string>): string[] {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const body = served[url];
      if (body === undefined) return new Response('nope', { status: 404 });
      return new Response(body, { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createUrlAssetProvider', () => {
  it('resolves convention ids to assets/<id>/model.glb without a variant', async () => {
    const calls = stubFetch({ [`${BASE}assets/props/crate/model.glb`]: 'main' });
    const provider = createUrlAssetProvider(BASE);
    expect(await provider.loadText('props.crate')).toBe('main');
    expect(calls).toEqual([`${BASE}assets/props/crate/model.glb`]);
  });

  it('prefers the packed variant and falls back to main only on 404', async () => {
    const calls = stubFetch({
      [`${BASE}assets/props/crate/model.glb`]: 'main',
      [`${BASE}assets/props/lamp/model.ktx2.glb`]: 'packed',
    });
    const provider = createUrlAssetProvider(BASE, undefined, { variant: 'ktx2' });
    expect(await provider.loadText('props.lamp')).toBe('packed');
    expect(await provider.loadText('props.crate')).toBe('main');
    expect(calls).toEqual([
      `${BASE}assets/props/lamp/model.ktx2.glb`,
      `${BASE}assets/props/crate/model.ktx2.glb`,
      `${BASE}assets/props/crate/model.glb`,
    ]);
  });

  it('uses index-mapped and URL-ish refs as given (no variant probing)', async () => {
    const calls = stubFetch({
      [`${BASE}static/crate.glb`]: 'indexed',
      [`${BASE}models/x.glb`]: 'direct',
    });
    const provider = createUrlAssetProvider(
      BASE,
      { 'props.crate': 'static/crate.glb' },
      { variant: 'ktx2' },
    );
    expect(await provider.loadText('props.crate')).toBe('indexed');
    expect(await provider.loadText('models/x.glb')).toBe('direct');
    expect(calls).toEqual([`${BASE}static/crate.glb`, `${BASE}models/x.glb`]);
  });

  it('surfaces non-404 failures instead of falling back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    const provider = createUrlAssetProvider(BASE, undefined, { variant: 'ktx2' });
    await expect(provider.load('props.crate')).rejects.toThrow('HTTP 500');
  });
});

describe('AssetCache owns the loader lifetime', () => {
  it('disposes the Draco and KTX2 worker pools with the cache', () => {
    const dracoLoader = { dispose: vi.fn() };
    const ktx2Loader = { dispose: vi.fn() };
    const loader = { dracoLoader, ktx2Loader } as unknown as GLTFLoader;
    const cache = new AssetCache(
      { load: async () => new ArrayBuffer(0), loadText: async () => '' },
      loader,
    );
    cache.dispose();
    // Each pool spawns Workers on first decode; an HMR remount loop leaks them otherwise.
    expect(dracoLoader.dispose).toHaveBeenCalledOnce();
    expect(ktx2Loader.dispose).toHaveBeenCalledOnce();
    cache.dispose();
    expect(dracoLoader.dispose).toHaveBeenCalledOnce();
  });

  it('is a no-op when no decoders were configured', () => {
    const cache = new AssetCache(
      { load: async () => new ArrayBuffer(0), loadText: async () => '' },
      { dracoLoader: null, ktx2Loader: null } as unknown as GLTFLoader,
    );
    expect(() => cache.dispose()).not.toThrow();
  });
});
