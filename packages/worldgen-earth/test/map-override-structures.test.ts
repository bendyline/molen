import { describe, expect, it, vi } from 'vitest';
import { withMapOverrideStructures } from '../src/kernel/map-override-structures';
import { createMapOverrideSet, type MapOverride } from '../src/kernel/map-overrides';
import {
  createStructureIndex,
  type StructureIndex,
  type StructurePlacement,
} from '../src/kernel/structure-index';

const NEEDLE: [number, number] = [-122.3493, 47.62051];
const AROUND: [number, number, number, number] = [-122.36, 47.61, -122.34, 47.63];
const placement = (extra: Partial<StructurePlacement> & { id: string }): StructurePlacement => ({
  title: extra.id,
  asset: 'sample.structure.tower',
  anchor: NEEDLE,
  status: 'preview',
  source: 'https://example.com',
  ...extra,
});
const catalog = (entries: StructurePlacement[]): StructureIndex =>
  createStructureIndex({ format: 'molen/structure-placement-data@1', title: 'Test', entries });
const lot = (extra: Partial<MapOverride> = {}): MapOverride => ({
  id: 'lot',
  area: { center: NEEDLE, size: [80, 60] },
  ...extra,
});
const ids = (entries: readonly StructurePlacement[]): string[] => entries.map((entry) => entry.id);

describe('map overrides over the landmark catalog', () => {
  it('hides the catalogued landmarks anchored in a rectangle that clears them', () => {
    const base = catalog([
      placement({ id: 'needle' }),
      // 100 m east: outside the 80 m wide rectangle.
      placement({ id: 'neighbor', anchor: [NEEDLE[0] + 0.00133, NEEDLE[1]] }),
    ]);
    const set = createMapOverrideSet<MapOverride>();
    const index = withMapOverrideStructures(base, set);
    expect(ids(index.query(AROUND))).toEqual(['needle', 'neighbor']);
    expect(index.entries).toBe(base.entries);
    // The set is read on each query: no new index is needed when it changes.
    set.set(lot());
    expect(ids(index.query(AROUND))).toEqual(['neighbor']);
    expect(ids(index.entries)).toEqual(['neighbor']);
    set.set(lot({ clear: { landmarks: false } }));
    expect(ids(index.query(AROUND))).toEqual(['needle', 'neighbor']);
    // Landmarks hide at every level, whatever level the map edit starts at.
    set.set(lot({ minLevel: 15 }));
    expect(ids(index.query(AROUND))).toEqual(['neighbor']);
    set.delete('lot');
    expect(ids(index.query(AROUND))).toEqual(['needle', 'neighbor']);
  });

  it('hides an extended model by its middle, not because the rectangle takes in one end', () => {
    const bridge = (id: string, west: number): StructurePlacement =>
      placement({
        id,
        // Anchored off to the side; the extent decides.
        anchor: [west - 0.01, NEEDLE[1]],
        bounds: [west, NEEDLE[1] - 0.0005, west + 0.004, NEEDLE[1] + 0.0005],
        datum: 'sea-level',
      });
    const base = catalog([
      bridge('centered', NEEDLE[0] - 0.002),
      // Its west end is in the rectangle; its middle is 150 m east of it.
      bridge('clipped', NEEDLE[0] - 0.0002),
    ]);
    const index = withMapOverrideStructures(base, createMapOverrideSet([lot()]));
    expect(ids(index.query([-122.4, 47.6, -122.3, 47.64]))).toEqual(['clipped']);
  });

  it('offers the host models first, placed as the override lays them out', () => {
    const base = catalog([placement({ id: 'far', anchor: [NEEDLE[0] + 0.005, NEEDLE[1]] })]);
    const set = createMapOverrideSet([
      lot({
        area: { center: NEEDLE, size: [80, 60], heading: Math.PI / 2 },
        models: [
          { id: 'tower', asset: 'molen.worldgen.structure.space_needle', position: [0, 0] },
          {
            id: 'tank',
            asset: 'host.tank',
            position: [10, 0],
            heading: 0.25,
            scale: 2,
            elevation: 1.5,
          },
          { id: 'near', asset: 'host.kiosk', position: [0, 10], minLevel: 15 },
        ],
      }),
    ]);
    const index = withMapOverrideStructures(base, set, {
      isCatalogAsset: (asset) => asset.startsWith('molen.'),
    });
    const found = index.query(AROUND);
    expect(ids(found)).toEqual([
      'override.lot.tower',
      'override.lot.tank',
      'override.lot.near',
      'far',
    ]);
    const [tower, tank, near] = found;
    expect(tower).toMatchObject({
      asset: 'molen.worldgen.structure.space_needle',
      datum: 'terrain',
      status: 'preview',
      // A catalog asset streams with detail levels: drawn from as far as the override is.
      minLevel: 11,
    });
    expect(tower?.anchor[0]).toBeCloseTo(NEEDLE[0], 9);
    expect(tower?.anchor[1]).toBeCloseTo(NEEDLE[1], 9);
    expect(tower?.heading).toBeCloseTo(-Math.PI / 2);
    // A host's own model has one detail level: from nearer by default.
    expect(tank).toMatchObject({ minLevel: 13, scale: [2, 2, 2], elevation: 1.5 });
    expect(tank?.heading).toBeCloseTo(-(Math.PI / 2 + 0.25));
    // Frame +x at heading east is south: 10 m lower in latitude, the same longitude.
    expect(tank?.anchor[0]).toBeCloseTo(NEEDLE[0], 6);
    expect(tank?.anchor[1]).toBeLessThan(NEEDLE[1]);
    expect(near?.minLevel).toBe(15);
    // Only the models anchored in the rectangle asked for.
    expect(ids(index.query([0, 0, 1, 1]))).toEqual([]);
    expect(ids(index.entries)).toEqual([
      'override.lot.tower',
      'override.lot.tank',
      'override.lot.near',
      'far',
    ]);
    expect(index.rules).toBe(base.rules);
    expect(index.cells).toBe(base.cells);
  });

  it('is asynchronous only where the catalog is, and never disposes it', async () => {
    const base = catalog([placement({ id: 'needle' })]);
    const plain = withMapOverrideStructures(base, createMapOverrideSet([lot()]));
    expect(plain.queryAsync).toBeUndefined();
    expect(plain.isLoaded).toBeUndefined();
    expect(plain.dispose).toBeUndefined();
    const dispose = vi.fn();
    const isLoaded = vi.fn(() => false);
    const lazy = withMapOverrideStructures(
      {
        ...base,
        entries: base.entries,
        cells: base.cells,
        rules: base.rules,
        dispose,
        isLoaded,
        queryAsync: async (bounds, options) => base.query(bounds, options),
      },
      createMapOverrideSet([
        lot({ models: [{ id: 'tank', asset: 'host.tank', position: [0, 0] }] }),
      ]),
    );
    expect(ids((await lazy.queryAsync?.(AROUND, { level: 15 })) ?? [])).toEqual([
      'override.lot.tank',
    ]);
    expect(lazy.isLoaded?.(AROUND)).toBe(false);
    expect(isLoaded).toHaveBeenCalledWith(AROUND);
    expect(lazy.dispose).toBeUndefined();
    expect(dispose).not.toHaveBeenCalled();
  });
});
