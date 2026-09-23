import { describe, expect, it } from 'vitest';
import { createPack } from '../src/build';
import { openPack, PackEntryNotFoundError, packFromFiles } from '../src/pack';
import { noise, recordingReader, sampleFiles } from './helpers';

const OPTIONS = { id: 'example.vehicles', version: '1.0.0', notice: 'NOTICE.md' };

async function built(extra: { path: string; bytes: Uint8Array }[] = []) {
  return createPack([...sampleFiles(), ...extra], OPTIONS);
}

async function expectSameFiles(pack: Awaited<ReturnType<typeof openPack>>): Promise<void> {
  for (const file of sampleFiles()) {
    expect(new Uint8Array(await pack.readBytes(file.path)), file.path).toEqual(file.bytes);
  }
}

describe('openPack', () => {
  it('reads every file back from bytes, a Blob, and a RangeReader', async () => {
    const { bytes, manifest } = await built();
    for (const input of [
      bytes,
      bytes.slice().buffer,
      new Blob([bytes.slice()]),
      recordingReader(bytes),
    ]) {
      const pack = await openPack(input);
      expect(pack.manifest).toEqual(manifest);
      expect(pack.paths()).toEqual(
        sampleFiles()
          .map((f) => f.path)
          .sort(),
      );
      await expectSameFiles(pack);
      expect(await pack.readJson('types/aircraft.types.json')).toEqual({ b: 'two' });
      expect(await pack.readText('NOTICE.md')).toContain('Example content');
    }
  });

  it('matches a pack of the same loose files', async () => {
    const { manifest } = await built();
    const loose = await packFromFiles(sampleFiles(), OPTIONS);
    expect(loose.manifest.contentHash).toBe(manifest.contentHash);
    expect(loose.manifest.ids).toEqual(manifest.ids);
    await expectSameFiles(loose);
  });

  it('returns standalone buffers the caller may keep or transfer', async () => {
    const pack = await openPack((await built()).bytes);
    const a = await pack.readBytes('models/roadster/model.glb');
    const b = await pack.readBytes('types/vehicles.types.json');
    expect(a.byteLength).toBe(3000);
    expect(b.byteLength).toBe(pack.manifest.entries['types/vehicles.types.json']?.size);
  });

  it('opens a small pack with a single read', async () => {
    const reader = recordingReader((await built()).bytes);
    const pack = await openPack(reader);
    await expectSameFiles(pack);
    expect(reader.reads).toHaveLength(1);
  });

  it('reads only the tail to open a large pack, then merges nearby reads', async () => {
    // Members are in path order: b and c come first, the big z last before the manifest.
    const big = [
      { path: 'models/b.glb', bytes: noise(1_000, 12) },
      { path: 'models/c.glb', bytes: noise(1_000, 13) },
      { path: 'models/z.glb', bytes: noise(150_000, 11) },
    ];
    const reader = recordingReader((await built(big)).bytes);
    const pack = await openPack(reader);
    expect(reader.reads).toHaveLength(1);
    expect(reader.reads[0]?.length).toBe(64 * 1024);
    // b and c sit next to each other; asked for in the same tick they arrive in one read.
    await Promise.all([pack.readBytes('models/b.glb'), pack.readBytes('models/c.glb')]);
    expect(reader.reads).toHaveLength(2);
    expect(new Uint8Array(await pack.readBytes('models/z.glb'))).toEqual(noise(150_000, 11));
    expect(reader.reads).toHaveLength(3);
    // Read again: served from the cache.
    await pack.readBytes('models/b.glb');
    expect(reader.reads).toHaveLength(3);
  });

  it('reports missing files, corrupt data and unexpected content', async () => {
    const { bytes, manifest } = await built();
    const pack = await openPack(bytes);
    await expect(pack.readBytes('nope.json')).rejects.toBeInstanceOf(PackEntryNotFoundError);
    await expect(
      openPack(bytes, { expect: { contentHash: `sha256:${'0'.repeat(64)}` } }),
    ).rejects.toThrow(/expected/);
    await expect(
      openPack(bytes, { expect: { contentHash: manifest.contentHash } }),
    ).resolves.toBeDefined();
    const corrupt = bytes.slice();
    // Flip a byte inside the stored model: find its first 16 bytes in the archive.
    const model = noise(3000, 7);
    const at = corrupt.findIndex((_, i) =>
      model.subarray(0, 16).every((b, j) => corrupt[i + j] === b),
    );
    expect(at).toBeGreaterThan(0);
    corrupt[at + 10] = (corrupt[at + 10] as number) ^ 0xff;
    const damaged = await openPack(corrupt);
    await expect(damaged.readBytes('models/roadster/model.glb')).rejects.toThrow(/corrupt/);
    await expect(openPack(new Uint8Array(100))).rejects.toThrow(/not a zip/);
  });

  it('checks sha256 when asked', async () => {
    const pack = await openPack((await built()).bytes, { integrity: 'sha256' });
    await expectSameFiles(pack);
  });

  it('rejects reads after close', async () => {
    const big = [{ path: 'models/a.glb', bytes: noise(150_000, 11) }];
    const pack = await openPack(recordingReader((await built(big)).bytes));
    pack.close();
    await expect(pack.readBytes('models/a.glb')).rejects.toThrow();
  });

  it('lets one caller abort without failing another reading the same file', async () => {
    const big = [{ path: 'models/a.glb', bytes: noise(150_000, 11) }];
    const pack = await openPack(recordingReader((await built(big)).bytes));
    const controller = new AbortController();
    const aborted = pack.readBytes('models/a.glb', { signal: controller.signal });
    const other = pack.readBytes('models/a.glb');
    controller.abort(new Error('user left'));
    await expect(aborted).rejects.toThrow('user left');
    expect((await other).byteLength).toBe(150_000);
  });
});
