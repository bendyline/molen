import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveStylePackDocuments } from '../../src/kernel/stylepack';
import '../../src/kernel';

const packDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../content/worldgen');

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(packDir, path), 'utf8'));
}

const delay = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

describe('style pack document loading', () => {
  it('resolves the default pack to the same hash as the one-at-a-time loader', async () => {
    const manifest = await readJson('stylepack.json');
    // Serialize the underlying reads, even when the resolver schedules them concurrently.
    // Compare actual results so adding a catalog entry does not require a new hash pin.
    let queue: Promise<void> = Promise.resolve();
    const serialReader = (path: string): Promise<unknown> => {
      const result = queue.then(() => readJson(path));
      queue = result.then(() => undefined);
      return result;
    };
    const sequential = await resolveStylePackDocuments(manifest, serialReader);
    const concurrent = await resolveStylePackDocuments(manifest, readJson);
    expect(concurrent.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(concurrent).toStrictEqual(sequential);
    expect(Object.keys(concurrent.archstyles)).toEqual(Object.keys(concurrent.root.styles));
    expect(Object.keys(concurrent.materials)).toEqual(Object.keys(concurrent.root.materials));
    expect(concurrent.assets).toEqual(concurrent.root.assets);
  });

  it('reads documents concurrently, at most 16 at a time, and each only once', async () => {
    let inFlight = 0;
    let peak = 0;
    const reads = new Map<string, number>();
    const reader = async (path: string): Promise<unknown> => {
      reads.set(path, (reads.get(path) ?? 0) + 1);
      inFlight++;
      peak = Math.max(peak, inFlight);
      await delay(2);
      inFlight--;
      return readJson(path);
    };
    await resolveStylePackDocuments(await readJson('stylepack.json'), reader);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(16);
    expect([...reads.values()].every((count) => count === 1)).toBe(true);
  });

  it('reports the first failure in manifest order, not the first to finish', async () => {
    const root = (await readJson('stylepack.json')) as { styles: Record<string, string> };
    const [first, second] = Object.values(root.styles) as [string, string];
    const reader = async (path: string): Promise<unknown> => {
      // The later document fails first; the error must still name the earlier one.
      if (path === first) {
        await delay(20);
        throw new Error(`cannot read ${path}`);
      }
      if (path === second) throw new Error(`cannot read ${path}`);
      return readJson(path);
    };
    await expect(resolveStylePackDocuments(root, reader)).rejects.toThrow(`cannot read ${first}`);
  });
});
