import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createPack, describePack } from '../src/build';
import { findZipEnd, parseCentralDirectory } from '../src/zip';
import { encode, noise, sampleFiles } from './helpers';

const OPTIONS = {
  id: 'example.vehicles',
  version: '1.0.0',
  license: 'CC0-1.0',
  notice: 'NOTICE.md',
  provides: { types: ['types/aircraft.types.json', 'types/vehicles.types.json'] },
};

describe('createPack', () => {
  it('writes a zip whose manifest describes every file', async () => {
    const { bytes, manifest } = await createPack(sampleFiles(), OPTIONS);
    const members = unzipSync(bytes);
    expect(Object.keys(members).at(-1)).toBe('molen-pack.json');
    const stored = JSON.parse(new TextDecoder().decode(members['molen-pack.json']));
    expect(stored).toEqual(manifest);
    expect(Object.keys(manifest.entries)).toEqual(
      sampleFiles()
        .map((f) => f.path)
        .sort(),
    );
    expect(manifest.entries['models/roadster/model.glb']).toMatchObject({
      size: 3000,
      mediaType: 'model/gltf-binary',
    });
  });

  it('groups small text files into solid blocks by top-level directory', async () => {
    const { bytes, manifest } = await createPack(sampleFiles(), OPTIONS);
    expect(Object.keys(manifest.blocks).sort()).toEqual(['models', 'root', 'types']);
    const members = unzipSync(bytes);
    const types = members['molen-pack/blocks/types.blk'] as Uint8Array;
    const entry = manifest.entries['types/vehicles.types.json'];
    expect(entry?.block).toBe('types');
    const slice = types.subarray(entry?.offset, (entry?.offset ?? 0) + (entry?.size ?? 0));
    expect(JSON.parse(new TextDecoder().decode(slice))).toEqual({ a: 1, list: [1, 2, 3] });
    // Binary files are their own members.
    expect(members['models/roadster/model.glb']).toEqual(noise(3000, 7));
    expect(members['types/vehicles.types.json']).toBeUndefined();
  });

  it('takes asset ids and variants from molen/asset@1 sidecars', async () => {
    const { manifest } = await createPack(sampleFiles(), OPTIONS);
    expect(manifest.ids).toEqual({ 'example.vehicle.roadster': 'models/roadster/model.glb' });
    expect(manifest.entries['models/roadster/model.glb']?.variants).toEqual({
      ktx2: 'models/roadster/model.ktx2.glb',
    });
  });

  it('is deterministic, and its contentHash ignores layout', async () => {
    const a = await createPack(sampleFiles(), OPTIONS);
    const b = await createPack([...sampleFiles()].reverse(), OPTIONS);
    expect(a.bytes).toEqual(b.bytes);
    const loose = await createPack(sampleFiles(), { ...OPTIONS, solid: false });
    expect(loose.bytes).not.toEqual(a.bytes);
    expect(loose.manifest.blocks).toEqual({});
    expect(loose.manifest.contentHash).toBe(a.manifest.contentHash);
    expect((await describePack(sampleFiles(), OPTIONS)).contentHash).toBe(a.manifest.contentHash);
    const changed = sampleFiles();
    (changed[1] as { bytes: Uint8Array }).bytes = encode('{"a":2}');
    expect((await describePack(changed, OPTIONS)).contentHash).not.toBe(a.manifest.contentHash);
  });

  it('keeps the manifest and small documents in the last bytes of the file', async () => {
    const files = [...sampleFiles(), { path: 'models/big.glb', bytes: noise(200_000, 3) }];
    const { bytes, manifest } = await createPack(files, OPTIONS);
    const end = findZipEnd(bytes, 0);
    const members = parseCentralDirectory(
      bytes.subarray(end.centralOffset, end.centralOffset + end.centralSize),
      end.entries,
    );
    const tailStart = bytes.length - 64 * 1024;
    expect((members.get('molen-pack.json')?.localOffset ?? 0) > tailStart).toBe(true);
    for (const block of Object.values(manifest.blocks)) {
      expect((members.get(block.entry)?.localOffset ?? 0) > tailStart).toBe(true);
    }
  });

  it('rejects files it cannot describe', async () => {
    await expect(
      createPack([{ path: 'molen-pack.json', bytes: encode('{}') }], OPTIONS),
    ).rejects.toThrow(/reserved/);
    await expect(
      createPack(
        [
          { path: 'a.json', bytes: encode('1') },
          { path: 'a.json', bytes: encode('2') },
        ],
        OPTIONS,
      ),
    ).rejects.toThrow(/twice/);
    await expect(
      createPack(sampleFiles(), { ...OPTIONS, provides: { types: 'missing.json' } }),
    ).rejects.toThrow(/missing\.json/);
    await expect(
      createPack([{ path: '../escape.json', bytes: encode('1') }], OPTIONS),
    ).rejects.toThrow(/invalid pack/);
  });
});
