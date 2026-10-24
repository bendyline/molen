import { describe, expect, it, vi } from 'vitest';
import { createStructureStream } from '../src/client/structure-stream';
import type { StructureDirectory } from '../src/kernel/structure-directory';
import {
  createStructureIndex,
  encodeStructureGeohash,
  type StructureCatalogDoc,
  type StructurePlacement,
} from '../src/kernel/structure-index';

const entry = (id: string, anchor: [number, number]): StructurePlacement => ({
  id,
  anchor,
  title: id,
  asset: `test.${id}`,
  status: 'preview',
  source: 'https://example.com',
  minLevel: 11,
});
const west: [number, number, number, number] = [-123, 47, -122, 48];
const east: [number, number, number, number] = [-1, 51, 1, 52];

function fixture(entries = [entry('seattle', [-122.35, 47.62]), entry('london', [0, 51.5])]) {
  const directory: StructureDirectory = {
    format: 'molen/structure-placement-index@1',
    shards: {},
    cells: {},
  };
  const documents = new Map<string, StructureCatalogDoc>();
  for (const record of entries) {
    const cell = encodeStructureGeohash(...record.anchor, 2);
    const doc = documents.get(cell) ?? {
      format: 'molen/structure-placement-data@1',
      title: cell,
      entries: [],
    };
    doc.entries.push(record);
    documents.set(cell, doc);
  }
  for (const [id, doc] of documents) {
    directory.shards[id] = {
      path: `${id}.json`,
      bytes: JSON.stringify(doc).length,
      count: doc.entries.length,
      minLevel: 11,
    };
    for (const cell of createStructureIndex(doc).cells.keys()) {
      const key = cell.slice(0, 2);
      directory.cells[key] = [...new Set([...(directory.cells[key] ?? []), id])];
    }
  }
  const read = vi.fn(async (path: string) => documents.get(path.replace('.json', '')));
  return { directory, documents, read };
}

describe('regional placement streaming', () => {
  it('reads only needed regions, preserves full query results, and skips coarse tiles', async () => {
    const f = fixture(),
      stream = createStructureStream(f.directory, f.read);
    expect(f.read).not.toHaveBeenCalled();
    expect(stream.query(west)).toEqual([]);
    expect(stream.isLoaded(west)).toBe(false);
    expect(await stream.queryAsync(west, { level: 10 })).toEqual([]);
    expect(f.read).not.toHaveBeenCalled();
    expect((await stream.queryAsync(west)).map((e) => e.id)).toEqual(['seattle']);
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(stream.isLoaded(west)).toBe(true);
    expect(stream.isLoaded(east)).toBe(false);
    expect(stream.query(west)).toEqual(await stream.queryAsync(west));
    expect(f.read).toHaveBeenCalledTimes(1);
    expect((await stream.queryAsync([-181, -91, 181, 91])).map((e) => e.id)).toEqual([
      'london',
      'seattle',
    ]);
    stream.dispose();
  });

  it('shares reads without letting one cancelled tile cancel another', async () => {
    const f = fixture();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const read = vi.fn(async (path: string, signal: AbortSignal) => {
      await gate;
      expect(signal.aborted).toBe(false);
      return f.read(path);
    });
    const stream = createStructureStream(f.directory, read);
    const controller = new AbortController();
    const cancelled = stream.queryAsync(west, { signal: controller.signal });
    const rejection = expect(cancelled).rejects.toThrow('cancelled tile');
    const survivor = stream.queryAsync(west);
    controller.abort(new Error('cancelled tile'));
    await rejection;
    release();
    expect((await survivor).map((e) => e.id)).toEqual(['seattle']);
    expect(read).toHaveBeenCalledTimes(1);
    stream.dispose();
  });

  it('bounds concurrency and retention without losing results during eviction', async () => {
    const f = fixture();
    let active = 0,
      peak = 0;
    const read = async (path: string): Promise<unknown> => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return f.read(path);
    };
    const stream = createStructureStream(f.directory, read, undefined, {
      maxShards: 1,
      concurrency: 1,
    });
    expect((await stream.queryAsync([-180, -90, 180, 90])).map((e) => e.id)).toEqual([
      'london',
      'seattle',
    ]);
    expect(peak).toBe(1);
    expect(stream.stats().cachedShards).toBe(1);
    expect(stream.isLoaded([-180, -90, 180, 90])).toBe(false);
    stream.dispose();
    expect(stream.stats().cachedBytes).toBe(0);
    await expect(stream.queryAsync(west)).rejects.toThrow();
  });

  it('finds extents across region boundaries and mapped identities across the antimeridian', async () => {
    const bridge = {
      ...entry('bridge', [-0.01, 51]),
      bounds: [-0.02, 50.99, 0.02, 51.01] as [number, number, number, number],
      datum: 'sea-level' as const,
    };
    const mapped = {
      ...entry('mapped', [179.9995, 0]),
      orientation: 'mapped' as const,
      mapIdentity: { wikidata: 'Q42', maxDistance: 200 },
    };
    const f = fixture([bridge, mapped]);
    const stream = createStructureStream(f.directory, f.read);
    expect((await stream.queryAsync([0.005, 50.99, 0.015, 51.01])).map((e) => e.id)).toEqual([
      'bridge',
    ]);
    expect((await stream.queryAsync([-180, -0.001, -179.9995, 0.001])).map((e) => e.id)).toEqual([
      'mapped',
    ]);
    expect((await stream.queryAsync([179.99, -0.001, -179.99, 0.001])).map((e) => e.id)).toEqual([
      'mapped',
    ]);
    stream.dispose();
  });

  it('retries failed reads and returns oversized regions without retaining them', async () => {
    const f = fixture();
    const read = vi.fn(f.read).mockRejectedValueOnce(new Error('offline'));
    const stream = createStructureStream(f.directory, read, undefined, { maxCacheBytes: 1 });
    await expect(stream.queryAsync(west)).rejects.toThrow('offline');
    expect(stream.stats().pending).toBe(0);
    expect((await stream.queryAsync(west)).map((e) => e.id)).toEqual(['seattle']);
    expect(stream.stats().cachedBytes).toBe(0);
    expect(stream.isLoaded(west)).toBe(false);
    expect(read).toHaveBeenCalledTimes(2);
    stream.dispose();
  });

  it('disposes active and queued reads even when a reader ignores cancellation', async () => {
    const f = fixture();
    const read = vi.fn(async () => new Promise<unknown>(() => {}));
    const stream = createStructureStream(f.directory, read, undefined, { concurrency: 1 });
    const query = stream.queryAsync([-180, -90, 180, 90]);
    const rejection = expect(query).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
    stream.dispose();
    await rejection;
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    expect(stream.stats()).toEqual({ cachedBytes: 0, cachedShards: 0, pending: 0 });
  });

  it('preserves draft and historical filtering and rejects malformed responses', async () => {
    const draft = { ...entry('draft', [-122.35, 47.62]), status: 'draft' as const };
    const history = {
      ...entry('history', [-122.35, 47.62]),
      status: 'historical' as const,
      appearance: {
        kind: 'historical' as const,
        currentWorldEligible: false as const,
        validFrom: '1900-01-01',
        validUntil: '1950-01-01',
      },
    };
    const f = fixture([draft, history]),
      stream = createStructureStream(f.directory, f.read);
    expect(await stream.queryAsync(west)).toEqual([]);
    expect((await stream.queryAsync(west, { viewingDate: '1920-01-01' })).map((e) => e.id)).toEqual(
      ['history'],
    );
    expect(await stream.queryAsync(west, { viewingDate: '1950-01-01' })).toEqual([]);
    expect(await stream.queryAsync(west, { includeDraft: true })).toHaveLength(2);
    stream.dispose();
    const bad = createStructureStream(f.directory, async () => ({
      format: 'molen/structure-placement-data@1',
      title: 'bad',
      entries: [],
    }));
    await expect(bad.queryAsync(west)).rejects.toThrow('count');
    expect(bad.stats().cachedShards).toBe(0);
    bad.dispose();
  });
});
