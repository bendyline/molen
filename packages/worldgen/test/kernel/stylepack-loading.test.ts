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
    const pack = await resolveStylePackDocuments(await readJson('stylepack.json'), readJson);
    // Captured from the serial loader before reads were parallelised (sha256:5373d809…), then
    // re-pinned when the pack gained its interior catalog: the hash covers it, geometry did not
    // change.
    expect(pack.hash).toBe(
      'sha256:e60d6a93ec150d5173414413222ee4094e358aebc1a41f45287a59daa7fd0215',
    );
    expect(pack.interiors?.profiles).toHaveLength(15);
    expect(Object.keys(pack.archstyles)).toHaveLength(120);
    expect(Object.keys(pack.materials)).toHaveLength(45);
    expect(pack.warnings).toHaveLength(7);
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
