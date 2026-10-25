import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPack } from '../src/build';
import { hostPacks, openPackAt, recordInPackIndex } from '../src/node';
import { openDirectoryPack } from '../src/pack';

it('rehosts a directory index and downloads only selected vehicle files on a no-Range server', async () => {
  const root = await mkdtemp(join(tmpdir(), 'molen-fleet-'));
  try {
    const files = ['china', 'japan', 'usa'].map((name) => ({
      path: `${name}.glb`,
      bytes: new Uint8Array(1024).fill(name.length),
    }));
    const built = await createPack(files, { id: 'example.fleet', version: '1.0.0' });
    await writeFile(join(root, 'fleet.zip'), built.bytes);
    const index = await recordInPackIndex(root, 'example.fleet', {
      file: 'fleet.zip',
      version: '1.0.0',
      size: built.bytes.length,
      contentHash: built.manifest.contentHash,
    });
    const first = await hostPacks(index, { outDir: join(root, 'first') });
    const second = await hostPacks(first.indexPath, { outDir: join(root, 'second') });
    const entry = second.index.packs['example.fleet']!;
    const local = await openPackAt(join(root, 'second', entry.file));
    expect(new Uint8Array(await local.readBytes('china.glb'))).toEqual(files[0]!.bytes);
    local.close();
    const requests: string[] = [];
    const pack = await openDirectoryPack(`https://fleet.test/${entry.file}`, {
      maxCacheBytes: 1024,
      fetch: async (input) => {
        const path = new URL(String(input)).pathname;
        requests.push(path);
        return new Response(await readFile(join(root, 'second', path)));
      },
    });
    expect(requests).toHaveLength(1);
    await pack.readBytes('china.glb');
    await pack.readBytes('china.glb');
    expect(requests).toHaveLength(2);
    expect(requests.some((p) => p.endsWith('usa.glb'))).toBe(false);
    await pack.readBytes('japan.glb');
    await pack.readBytes('china.glb');
    expect(requests.filter((p) => p.endsWith('china.glb'))).toHaveLength(2);
    pack.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

describe('shared directory downloads', () => {
  it('keeps a shared request until the last reader aborts, then retries cleanly', async () => {
    const built = await createPack([{ path: 'car.glb', bytes: new Uint8Array(8) }], {
      id: 'example.fleet',
      version: '1.0.0',
      solid: false,
    });
    const signals: AbortSignal[] = [];
    const pack = await openDirectoryPack('https://fleet.test/molen-pack.json', {
      fetch: async () => Response.json(built.manifest),
      retry: { attempts: 1 },
      fileReader: () => ({
        size: 8,
        read: (_offset, _length, signal) =>
          new Promise((_resolve, reject) => {
            signals.push(signal!);
            signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
          }),
      }),
    });
    const a = new AbortController(),
      b = new AbortController();
    const one = pack.readBytes('car.glb', { signal: a.signal }).catch(() => undefined);
    const two = pack.readBytes('car.glb', { signal: b.signal }).catch(() => undefined);
    a.abort();
    await one;
    expect(signals).toHaveLength(1);
    expect(signals[0]!.aborted).toBe(false);
    b.abort();
    await two;
    expect(signals[0]!.aborted).toBe(true);
    const three = pack.readBytes('car.glb').catch(() => undefined);
    expect(signals).toHaveLength(2);
    pack.close();
    await three;
  });
});
