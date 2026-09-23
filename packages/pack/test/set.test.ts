import { describe, expect, it } from 'vitest';
import { packFromFiles } from '../src/pack';
import { createPackSet } from '../src/set';
import { encode, noise, sampleFiles } from './helpers';

async function packs() {
  const base = await packFromFiles(sampleFiles(), { id: 'example.base', version: '1.0.0' });
  const sidecar = {
    format: 'molen/asset@1',
    id: 'example.vehicle.roadster',
    kind: 'model',
    files: { main: 'model.glb', variants: {} },
  };
  const override = await packFromFiles(
    [
      { path: 'roadster/asset.json', bytes: encode(JSON.stringify(sidecar)) },
      { path: 'roadster/model.glb', bytes: noise(500, 99) },
      { path: 'NOTICE.md', bytes: encode('override notice') },
      { path: 'types/extra.types.json', bytes: encode('{"extra":true}') },
    ],
    { id: 'example.app', version: '2.0.0', provides: { types: 'types/extra.types.json' } },
  );
  return { base, override };
}

describe('createPackSet', () => {
  it('resolves ids and paths, the pack added later winning', async () => {
    const { base, override } = await packs();
    const set = createPackSet([base]);
    expect(set.resolve('example.vehicle.roadster')?.path).toBe('models/roadster/model.glb');
    set.add(override);
    expect(set.resolve('example.vehicle.roadster')).toMatchObject({
      pack: override,
      path: 'roadster/model.glb',
    });
    expect(await set.readText('NOTICE.md')).toBe('override notice');
    expect(await set.readText('pack:example.base/NOTICE.md')).toContain('Example content');
    expect(set.resolve('pack:example.base/missing')).toBeUndefined();
    await expect(set.readBytes('nothing.here')).rejects.toThrow(
      /no pack provides "nothing.here" \(loaded: example.base@1.0.0, example.app@2.0.0\)/,
    );
  });

  it('lists every pack that provides a role', async () => {
    const { base, override } = await packs();
    const set = createPackSet([base, override]);
    expect(set.provided('types').map(({ pack, path }) => `${pack.manifest.id}:${path}`)).toEqual([
      'example.app:types/extra.types.json',
    ]);
  });

  it('serves the client as an asset provider, preferring a requested variant', async () => {
    const { base } = await packs();
    const set = createPackSet([base]);
    const plain = set.assetProvider();
    expect(new Uint8Array(await plain.load('example.vehicle.roadster'))).toEqual(noise(3000, 7));
    const ktx2 = set.assetProvider({ variant: 'ktx2' });
    expect(new Uint8Array(await ktx2.load('example.vehicle.roadster'))).toEqual(noise(2000, 9));
    const other = set.assetProvider({ variant: 'webp' });
    expect(new Uint8Array(await other.load('example.vehicle.roadster'))).toEqual(noise(3000, 7));
    expect(JSON.parse(await plain.loadText('types/vehicles.types.json'))).toEqual({
      a: 1,
      list: [1, 2, 3],
    });
    const fallbackRefs: string[] = [];
    const withFallback = set.assetProvider({
      fallback: {
        load: async (ref) => {
          fallbackRefs.push(ref);
          return new ArrayBuffer(1);
        },
        loadText: async (ref) => {
          fallbackRefs.push(ref);
          return 'fallback';
        },
      },
    });
    expect(await withFallback.loadText('elsewhere.json')).toBe('fallback');
    expect((await withFallback.load('elsewhere.glb')).byteLength).toBe(1);
    expect(fallbackRefs).toEqual(['elsewhere.json', 'elsewhere.glb']);
    await expect(plain.load('elsewhere.glb')).rejects.toThrow(/no pack provides/);
  });
});
