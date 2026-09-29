import { describe, expect, it, vi } from 'vitest';
import {
  type BakedMaterial,
  type BakedMaterialStore,
  bakeMatGraph,
  type MaterialBaker,
  type MatGraphDoc,
  materialBakerFingerprint,
  withBakedMaterialStore,
} from '../src/index';

const DOC: MatGraphDoc = {
  format: 'molen/matgraph@1',
  size: [4, 4],
  seed: 3,
  nodes: [{ id: 'c', type: 'checker', params: { scale: 2 } }],
  outputs: { baseColor: 'c' },
};

function memoryStore(): BakedMaterialStore & { entries: Map<string, BakedMaterial> } {
  const entries = new Map<string, BakedMaterial>();
  return {
    entries,
    get: async (key) => entries.get(key),
    set: async (key, material) => {
      entries.set(key, structuredClone(material));
    },
    prune: async (keep) => {
      for (const key of [...entries.keys()]) if (!keep(key)) entries.delete(key);
    },
  };
}

function countingBaker(): MaterialBaker & { calls: number } {
  const baker = {
    calls: 0,
    async bake(_format: 'matgraph' | 'pixelgrid', doc: MatGraphDoc) {
      baker.calls++;
      return bakeMatGraph(doc);
    },
  };
  return baker as MaterialBaker & { calls: number };
}

describe('baked material store', () => {
  it('fingerprints every rasterizer deterministically', () => {
    expect(materialBakerFingerprint()).toMatch(/^v1-[0-9a-z]+$/);
    expect(materialBakerFingerprint()).toBe(materialBakerFingerprint());
  });

  it('bakes once per document and serves identical pixels afterwards', async () => {
    const store = memoryStore();
    const first = countingBaker();
    const baked = await withBakedMaterialStore(first, store).bake('matgraph', DOC);
    await Promise.resolve();
    expect(first.calls).toBe(1);
    expect(store.entries.size).toBe(1);
    const [key] = store.entries.keys();
    expect(key?.startsWith(`${materialBakerFingerprint()}/matgraph/`)).toBe(true);

    // A later visit: a new baker over the same store never rasterizes.
    const later = countingBaker();
    const cached = await withBakedMaterialStore(later, store).bake('matgraph', DOC);
    expect(later.calls).toBe(0);
    expect(cached.slots.baseColor?.data).toEqual(baked.slots.baseColor?.data);
    const other = await withBakedMaterialStore(later, store).bake('matgraph', { ...DOC, seed: 4 });
    expect(later.calls).toBe(1);
    expect(other.slots.baseColor?.width).toBe(4);
  });

  it('prunes other bakers’ entries and ignores store failures and corrupt records', async () => {
    const store = memoryStore();
    store.entries.set('v0-stale/matgraph/x', bakeMatGraph(DOC));
    const baker = countingBaker();
    await withBakedMaterialStore(baker, store).bake('matgraph', DOC);
    await Promise.resolve();
    expect([...store.entries.keys()].some((key) => key.startsWith('v0-stale'))).toBe(false);

    const [key] = store.entries.keys();
    store.entries.set(key as string, { slots: { baseColor: { width: 4 } } } as BakedMaterial);
    await withBakedMaterialStore(baker, store).bake('matgraph', DOC);
    expect(baker.calls).toBe(2);

    const broken: BakedMaterialStore = {
      get: vi.fn(async () => {
        throw new Error('quota');
      }),
      set: vi.fn(async () => {
        throw new Error('quota');
      }),
    };
    const material = await withBakedMaterialStore(baker, broken).bake('matgraph', DOC);
    expect(material.slots.baseColor?.width).toBe(4);
    expect(baker.calls).toBe(3);
  });
});
