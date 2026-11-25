import { describe, expect, it } from 'vitest';
import { generateWorldgenBatch, hashWorldgenOutput } from '../../src/kernel/batch';
import { sampleScatter } from '../../src/kernel/scatter';
import type { ScatterDoc } from '../../src/kernel/scatter-types';
import { readTurfRow, sampleTurfCover, turfCoverArea } from '../../src/kernel/turf';
import {
  FLAT_GROUND,
  type ScatterRequest,
  type TurfCover,
  type TurfRequest,
  type Vec2,
} from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';

function rect(x0: number, z0: number, x1: number, z1: number): Vec2[] {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

const LAWN = { label: 'lawn', height: 0.15, density: 2 };
const MEADOW = { label: 'meadow', height: 0.45, density: 1.5 };

function request(turf: TurfRequest | undefined, size = 100): ScatterRequest {
  return {
    polygons: [{ label: 'lawn', ring: rect(0, 0, size, size) }],
    exclusions: [],
    emitBounds: [0, 0, size, size],
    frame: { originX: 0, originZ: 0, unitsPerMeter: 1 },
    keep: 1,
    ...(turf !== undefined ? { turf } : {}),
  };
}

/** The sward (0 for none, else 1 + index) of the cell holding a local point. */
function swardAt(cover: TurfCover, x: number, z: number): number {
  const out = new Uint8Array(1);
  const column = Math.floor((x - cover.originX) / cover.cell);
  readTurfRow(cover, Math.floor((z - cover.originZ) / cover.cell), column, column + 1, out);
  return out[0] as number;
}

describe('turf cover', () => {
  it('marks the ground that grows grass, by sward, a meter a cell', () => {
    const cover = sampleTurfCover(
      request({
        swards: [LAWN, MEADOW],
        ground: [
          { ring: rect(0, 0, 100, 100), sward: 0 },
          { ring: rect(50, 0, 100, 100), sward: 1 },
        ],
        clear: [],
      }),
      1_000_000,
    ) as TurfCover;
    expect(cover.cell).toBe(1);
    expect([cover.columns, cover.rows]).toEqual([100, 100]);
    expect(cover.swards).toEqual([LAWN, MEADOW]);
    expect(swardAt(cover, 10.5, 10.5)).toBe(1);
    expect(swardAt(cover, 80.5, 10.5)).toBe(2);
    expect(turfCoverArea(cover)).toBe(10_000);
    // Two runs a row: grass comes in fields, and a cover is a few bytes a row.
    expect(cover.runSward).toHaveLength(200);
    expect(cover.rowStart[100]).toBe(200);
    // Outside the cover reads as no grass, whole rows and the ends of a span alike.
    const out = new Uint8Array(6).fill(9);
    readTurfRow(cover, 5, 97, 103, out);
    expect([...out]).toEqual([2, 2, 2, 0, 0, 0]);
    readTurfRow(cover, -1, 0, 6, out);
    expect([...out]).toEqual([0, 0, 0, 0, 0, 0]);
    readTurfRow(cover, 100, 0, 6, out);
    expect([...out]).toEqual([0, 0, 0, 0, 0, 0]);
    // A span across the two swards.
    readTurfRow(cover, 40, 47, 53, out);
    expect([...out]).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('paints the ground in its own order: what grows nothing covers what lies under it', () => {
    const cover = sampleTurfCover(
      request({
        swards: [LAWN],
        ground: [
          // Under the first grass, nothing to cover.
          { ring: rect(0, 0, 100, 100) },
          { ring: rect(0, 0, 100, 100), sward: 0 },
          // A paved square over the lawn, and a bed of grass in a hole of a second one.
          { ring: rect(20, 20, 40, 40) },
          { ring: rect(60, 60, 90, 90), holes: [rect(70, 70, 80, 80)] },
        ],
        clear: [],
      }),
      1_000_000,
    ) as TurfCover;
    expect(swardAt(cover, 10.5, 10.5)).toBe(1);
    expect(swardAt(cover, 30.5, 30.5)).toBe(0);
    expect(swardAt(cover, 65.5, 65.5)).toBe(0);
    expect(swardAt(cover, 75.5, 75.5)).toBe(1);
    expect(turfCoverArea(cover)).toBe(10_000 - 400 - (900 - 100));
  });

  it('keeps clear of paving, buildings and water, each by its own margin', () => {
    const cover = sampleTurfCover(
      request({
        swards: [LAWN],
        ground: [{ ring: rect(0, 0, 100, 100), sward: 0 }],
        clear: [
          // A 6 m road with 2 m beside it, a house with half a meter, a pond with none.
          {
            polyline: [
              [0, 50],
              [100, 50],
            ],
            width: 6,
            radius: 2,
          },
          { ring: rect(20, 10, 30, 20), radius: 0.5 },
          { ring: rect(60, 70, 80, 90), holes: [rect(66, 76, 74, 84)], radius: 0 },
        ],
      }),
      1_000_000,
    ) as TurfCover;
    // The road: 3 m of carriageway and 2 m beside it, either side of z = 50.
    expect(swardAt(cover, 40.5, 50.5)).toBe(0);
    expect(swardAt(cover, 40.5, 45.6)).toBe(0);
    expect(swardAt(cover, 40.5, 43.5)).toBe(1);
    expect(swardAt(cover, 40.5, 54.4)).toBe(0);
    expect(swardAt(cover, 40.5, 56.5)).toBe(1);
    // The house and its margin (a cell's center within half a meter of the wall).
    expect(swardAt(cover, 25.5, 15.5)).toBe(0);
    expect(swardAt(cover, 19.6, 15.5)).toBe(0);
    expect(swardAt(cover, 18.5, 15.5)).toBe(1);
    // The pond, with grass on its island and to its bank.
    expect(swardAt(cover, 62.5, 80.5)).toBe(0);
    expect(swardAt(cover, 70.5, 80.5)).toBe(1);
    expect(swardAt(cover, 58.5, 80.5)).toBe(1);
  });

  it('leaves out ground a host paves over', () => {
    const turf: TurfRequest = {
      swards: [LAWN, MEADOW],
      ground: [
        { ring: rect(0, 0, 100, 100), sward: 0 },
        { ring: rect(0, 50, 100, 100), sward: 1 },
      ],
      clear: [],
    };
    // The west half of the lawn is built up; the meadow is asked about too, and stays.
    const seen = new Set<string>();
    const cover = sampleTurfCover(request(turf), 1_000_000, (x, _z, label) => {
      seen.add(label);
      return label === 'lawn' && x < 50 ? 0.4 : 1;
    }) as TurfCover;
    expect([...seen].sort()).toEqual(['lawn', 'meadow']);
    expect(swardAt(cover, 20.5, 20.5)).toBe(0);
    expect(swardAt(cover, 70.5, 20.5)).toBe(1);
    expect(swardAt(cover, 20.5, 70.5)).toBe(2);
  });

  it('coarsens to fit its budget and is absent without one, a request, or any grass', () => {
    const turf: TurfRequest = {
      swards: [LAWN],
      ground: [{ ring: rect(0, 0, 400, 400), sward: 0 }],
      clear: [],
    };
    // 100 cells a side over 400 m: 4 m cells.
    const coarse = sampleTurfCover(request(turf, 400), 10_000) as TurfCover;
    expect(coarse.cell).toBe(4);
    expect([coarse.columns, coarse.rows]).toEqual([100, 100]);
    expect(turfCoverArea(coarse)).toBe(160_000);
    // Never finer than a meter, however much room there is.
    expect((sampleTurfCover(request(turf, 400), 100_000_000) as TurfCover).cell).toBe(1);
    expect(sampleTurfCover(request(turf, 400), 0)).toBeUndefined();
    expect(sampleTurfCover(request(undefined), 10_000)).toBeUndefined();
    expect(
      sampleTurfCover(request({ swards: [LAWN], ground: [], clear: [] }), 10_000),
    ).toBeUndefined();
    expect(
      sampleTurfCover(
        request({ swards: [LAWN], ground: [{ ring: rect(0, 0, 100, 100) }], clear: [] }),
        10_000,
      ),
    ).toBeUndefined();
    // Grass wholly cleared away is no cover either.
    expect(
      sampleTurfCover(
        request({
          swards: [LAWN],
          ground: [{ ring: rect(0, 0, 100, 100), sward: 0 }],
          clear: [{ ring: rect(-10, -10, 110, 110), radius: 0 }],
        }),
        10_000,
      ),
    ).toBeUndefined();
  });

  it('comes with a scatter sample whatever its pools, and into a batch and its hash', async () => {
    const pack = await createTestPack();
    const doc = pack.scatters['test.pack.scatter.basic'] as ScatterDoc;
    const turf: TurfRequest = {
      swards: [LAWN],
      ground: [{ ring: rect(0, 0, 100, 100), sward: 0 }],
      clear: [],
    };
    const closed = { maxInstancesPerRule: 0, maxInstances: 0, maxPropModels: 0 };
    const input = {
      doc,
      pack: { name: pack.root.name, version: pack.root.version },
      ground: FLAT_GROUND,
      tier: 0,
    };
    // Every pool closed: no plants, and the grass all the same.
    const sample = sampleScatter({
      ...input,
      request: request(turf),
      budget: { ...closed, maxTurfCells: 10_000 },
    });
    expect(sample.placements).toEqual([]);
    expect(sample.turf && turfCoverArea(sample.turf)).toBe(10_000);
    // Without the budget for it, none; a host's paving applies (the crowns' `open`).
    expect(
      sampleScatter({ ...input, request: request(turf), budget: closed }).turf,
    ).toBeUndefined();
    const paved = sampleScatter({
      ...input,
      request: request(turf),
      budget: { ...closed, maxTurfCells: 10_000 },
      crowns: {
        cells: () => [0, 0, -1, -1],
        crown: () => ({ x: 0, z: 0, radius: 1, brush: 1 }),
        open: (x) => (x < 50 ? 0 : 1),
      },
    });
    expect(paved.turf && turfCoverArea(paved.turf)).toBe(5000);

    const batch = (maxTurfCells: number) =>
      generateWorldgenBatch({
        buildings: [],
        scatter: request(turf),
        scatterId: 'test.pack.scatter.basic',
        pack,
        budgets: { maxTurfCells },
      });
    const grown = batch(10_000),
      bare = batch(0);
    expect(grown.turf && turfCoverArea(grown.turf)).toBe(10_000);
    expect(grown.stats.turfArea).toBe(10_000);
    expect(bare.turf).toBeUndefined();
    expect(bare.stats.turfArea).toBe(0);
    // The same plants either way; the cover is part of what the hash covers.
    expect(grown.placements.map((set) => set.count)).toEqual(
      bare.placements.map((set) => set.count),
    );
    expect(grown.hash).not.toBe(bare.hash);
    expect(hashWorldgenOutput(undefined, grown.placements)).toBe(bare.hash);
    expect(hashWorldgenOutput(undefined, grown.placements, undefined, undefined, grown.turf)).toBe(
      grown.hash,
    );
  });
});
