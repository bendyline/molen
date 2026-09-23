import { emptyWorldgenStats } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { createWorldgenTileCache, worldgenTileCacheKey } from '../src/client/cache';
import { withWorldgenTileCache } from '../src/client/generators';
import type { WorldgenGenerator } from '../src/client/worker-bridge';
import type { WorldgenTileOutput } from '../src/kernel/tile-generate';

function output(bytes: number): WorldgenTileOutput {
  const stats = emptyWorldgenStats();
  stats.meshBytes = bytes;
  return {
    buildings: {
      positions: new Float32Array(),
      normals: new Float32Array(),
      uvs: new Float32Array(),
      colors: new Uint8Array(bytes),
      indices: new Uint32Array(),
      groups: [],
      vertexCount: 0,
      triangleCount: 0,
      bytes,
    },
    placements: [],
    records: [],
    stats,
    hash: `sha256:${bytes}`,
    skippedByOwnership: 0,
    clippedPieces: 0,
  };
}

describe('worldgen tile cache', () => {
  it('rejects invalid initial limits instead of disabling eviction', () => {
    for (const maxBytes of [NaN, Infinity, -1])
      expect(() => createWorldgenTileCache({ maxBytes })).toThrow();
    for (const maxEntries of [NaN, Infinity, -1, 0, 1.5])
      expect(() => createWorldgenTileCache({ maxEntries })).toThrow();
  });
  it('counts prepared cells without retaining phantom canonical mesh bytes', () => {
    const value = output(1000);
    delete value.buildings;
    value.buildingCells = [
      {
        key: '0/0',
        positions: new Float32Array(9),
        normals: new Float32Array(9),
        uvs: new Float32Array(6),
        colors: new Uint8Array(9),
        indices: new Uint16Array([0, 1, 2]),
        structuralIndices: new Uint16Array([0, 1, 2]),
        groups: [],
        bounds: [0, 0, 0, 1, 1, 1],
      },
    ];
    const cache = createWorldgenTileCache({ maxBytes: 200 });
    cache.set('prepared', value);
    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(117);
  });

  it('keys tiles by pack, atlas, quality, features, and address', () => {
    const key = worldgenTileCacheKey({
      packHash: 'p',
      atlasHash: 'a',
      quality: 'balanced',
      level: 14,
      x: 3,
      z: 4,
      features: { buildings: true, scatter: false },
    });
    expect(key).toBe('p:a:balanced:b:14/3/4');
    expect(
      worldgenTileCacheKey({
        packHash: 'p',
        quality: 'high',
        level: 14,
        x: 3,
        z: 4,
        features: { buildings: true, scatter: true },
      }),
    ).toBe('p:-:high:bs:14/3/4');
  });

  it('evicts least recently used entries by count and bytes', () => {
    const cache = createWorldgenTileCache({ maxEntries: 3, maxBytes: 1000 });
    cache.set('a', output(300));
    cache.set('b', output(300));
    cache.set('c', output(300));
    expect(cache.size).toBe(3);
    expect(cache.bytes).toBe(900);
    expect(cache.get('a')?.hash).toBe('sha256:300');
    cache.set('d', output(300));
    expect(cache.size).toBe(3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    expect(cache.evictions).toBe(1);
    cache.set('e', output(600));
    expect(cache.bytes).toBeLessThanOrEqual(1000);
    cache.set('huge', output(5000));
    expect(cache.get('huge')).toBeUndefined();
    expect(cache.hits).toBeGreaterThan(0);
    expect(cache.misses).toBeGreaterThan(0);
    expect(cache.delete('e')).toBe(true);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });

  it('shrinks existing entries immediately in LRU order when limits change', () => {
    const cache = createWorldgenTileCache({ maxEntries: 4, maxBytes: 1000 });
    cache.set('a', output(100));
    cache.set('b', output(200));
    cache.set('c', output(300));
    cache.set('d', output(400));
    cache.get('b'); // b is newest; d must survive before the less recent a and c.
    cache.setLimits({ maxEntries: 2 });
    expect(cache.size).toBe(2);
    expect(cache.bytes).toBe(600);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBeUndefined();
    expect(cache.evictions).toBe(2);
    cache.setLimits({ maxBytes: 250 });
    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(200);
    expect(cache.get('d')).toBeUndefined();
    expect(cache.get('b')?.hash).toBe('sha256:200');
    expect(cache.evictions).toBe(3);
  });

  it('admits new entries after expansion and preserves omitted limits', () => {
    const cache = createWorldgenTileCache({ maxEntries: 1, maxBytes: 100 });
    cache.set('a', output(100));
    cache.set('too-large', output(200));
    expect(cache.size).toBe(1);
    cache.setLimits({ maxEntries: 3, maxBytes: 500 });
    cache.set('b', output(200));
    cache.set('c', output(200));
    expect(cache.size).toBe(3);
    expect(cache.bytes).toBe(500);
    cache.setLimits({ maxEntries: 2 });
    expect(cache.get('a')).toBeUndefined();
    expect(cache.bytes).toBe(400);
    cache.set('over-byte-budget', output(600));
    expect(cache.get('over-byte-budget')).toBeUndefined();
    cache.setLimits({ maxBytes: 1000 });
    cache.set('d', output(600));
    expect(cache.size).toBe(2); // Expanding bytes retained the two-entry bound.
    expect(cache.bytes).toBe(800);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('d')).toBeDefined();
  });

  it('validates the complete limit patch before mutating limits or evicting entries', () => {
    const cache = createWorldgenTileCache({ maxEntries: 3, maxBytes: 300 });
    for (const key of ['a', 'b', 'c']) cache.set(key, output(100));
    expect(() => cache.setLimits({ maxEntries: 1, maxBytes: Number.NaN })).toThrow();
    expect(cache.size).toBe(3);
    expect(cache.bytes).toBe(300);
    expect(cache.evictions).toBe(0);
    cache.set('d', output(100));
    expect(cache.size).toBe(3); // The valid part of the rejected patch was not applied.
    expect(cache.get('a')).toBeUndefined();
    expect(() => cache.setLimits({ maxEntries: 0, maxBytes: 50 })).toThrow();
    cache.set('e', output(100));
    expect(cache.size).toBe(3);
    expect(cache.bytes).toBe(300);
    expect(cache.get('b')).toBeUndefined();
    for (const limits of [
      { maxEntries: 1.5 },
      { maxEntries: Number.POSITIVE_INFINITY },
      { maxBytes: -1 },
      { maxBytes: Number.POSITIVE_INFINITY },
    ]) {
      expect(() => cache.setLimits(limits)).toThrow();
      expect(cache.bytes).toBe(300);
    }
  });

  it('can release retained buffers completely and later resume caching', () => {
    const cache = createWorldgenTileCache({ maxEntries: 2, maxBytes: 200 });
    cache.set('a', output(100));
    cache.set('b', output(100));
    cache.setLimits({ maxBytes: 0 });
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
    cache.set('c', output(100));
    expect(cache.get('c')).toBeUndefined();
    cache.setLimits({ maxBytes: 100 });
    cache.set('c', output(100));
    expect(cache.get('c')).toBeDefined();
    expect(cache.bytes).toBe(100);
  });

  it('separates effective generation variants within a named quality preset', () => {
    const parts = {
      packHash: 'p',
      atlasHash: 'a',
      quality: 'balanced',
      level: 14,
      x: 3,
      z: 4,
      features: { buildings: true, scatter: false },
    };
    const base = worldgenTileCacheKey(parts);
    const detailed = worldgenTileCacheKey({ ...parts, variant: 'detailed-budget' });
    const reduced = worldgenTileCacheKey({ ...parts, variant: 'reduced-budget' });
    expect(base).toBe('p:a:balanced:b:14/3/4');
    expect(new Set([base, detailed, reduced]).size).toBe(3);
    expect(worldgenTileCacheKey({ ...parts, variant: 'detailed-budget' })).toBe(detailed);
    const cache = createWorldgenTileCache();
    cache.set(detailed, output(100));
    cache.set(reduced, output(10));
    expect(cache.get(detailed)?.hash).toBe('sha256:100');
    expect(cache.get(reduced)?.hash).toBe('sha256:10');
  });
  it('serves repeat requests from the cache in front of a generator', async () => {
    let calls = 0;
    const inner: WorldgenGenerator = {
      generate: async () => {
        calls++;
        return output(10);
      },
      dispose: () => {},
    };
    const cache = createWorldgenTileCache();
    const generator = withWorldgenTileCache(inner, cache, (request) => `${request.geom.x}`);
    const request = {
      tile: { landcover: [], buildings: [], transportation: [], water: [] },
      geom: {
        level: 1,
        x: 1,
        z: 1,
        originX: 0,
        originZ: 0,
        size: 1,
        metersPerUnit: 1,
        levelBelowMax: 0,
      },
      ground: {
        sampleHeight: () => 0,
        slopeAt: () => 0,
        normalAt: () => [0, 1, 0] as [number, number, number],
      },
      resolution: 2,
    };
    const signal = new AbortController().signal;
    const first = await generator.generate(request, signal);
    const second = await generator.generate(request, signal);
    expect(calls).toBe(1);
    expect(second).toBe(first);
    expect(cache.hits).toBe(1);
  });
});
