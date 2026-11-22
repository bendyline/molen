import { describe, expect, it } from 'vitest';
import { generateWorldgenBatch } from '../../src/kernel/batch';
import { GABLE_BOX_EAVE } from '../../src/kernel/building';
import { type DistantLook, distantBuildingLook, standInTint } from '../../src/kernel/distant-look';
import { standInPlacement } from '../../src/kernel/stand-in';
import { FLAT_GROUND, type HeightSampler, type Vec2 } from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';
import { SHAPES, translate } from '../helpers/shapes';

const pack = await createTestPack();
const flat: DistantLook = { wall: [0.6, 0.5, 0.4], roof: [0.3, 0.2, 0.1] };
const pitched: DistantLook = { ...flat, pitched: true };
/** A 20 x 8 m rectangle turned 30 degrees about its first corner, at (100, 50). */
const turned = (): Vec2[] => {
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  return (
    [
      [0, 0],
      [20, 0],
      [20, 8],
      [0, 8],
    ] as Vec2[]
  ).map(([u, v]): Vec2 => [100 + c * u - s * v, 50 + s * u + c * v]);
};
const slope: HeightSampler = { ...FLAT_GROUND, sampleHeight: (x) => 10 + x * 0.1 };

describe('stand-in placement', () => {
  it('boxes an outline along its longest edge, on the ground under it', () => {
    const box = standInPlacement(turned(), FLAT_GROUND, flat, { height: 9 });
    expect(box).toBeDefined();
    expect(box?.sx).toBeCloseTo(20, 6);
    expect(box?.sz).toBeCloseTo(8, 6);
    expect(box?.yaw).toBeCloseTo(-Math.PI / 6, 6);
    // The centre of the rectangle, not of its axis-aligned bounds.
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    expect(box?.x).toBeCloseTo(100 + c * 10 - s * 4, 6);
    expect(box?.z).toBeCloseTo(50 + s * 10 + c * 4, 6);
    // It reaches 0.6 m into the ground and 9 m above it.
    expect(box?.y).toBeCloseTo(-0.6, 6);
    expect(box?.sy).toBeCloseTo(9.6, 6);
    expect(box?.color).toEqual(standInTint(flat.wall));
    expect(box?.roof).toBeUndefined();
  });

  it('stands level with the highest ground and reaches below the lowest', () => {
    const outline: Vec2[] = [
      [0, 0],
      [10, 0],
      [10, 6],
      [0, 6],
    ];
    const box = standInPlacement(outline, slope, flat, { height: 6, foundationDepth: 1 });
    // Ground runs from 10 m to 11 m across the box.
    expect(box?.y).toBeCloseTo(9, 6);
    expect(box?.sy).toBeCloseTo(11 + 6 - 9, 6);
  });

  it('keeps a gabled roof for a pitched look, ridge along the longer side', () => {
    // Longest edge first along z: the box is turned so its long side is local x.
    const tall: Vec2[] = [
      [0, 0],
      [0, 14],
      [-6, 14],
      [-6, 0],
    ];
    const guessed = standInPlacement(tall, FLAT_GROUND, pitched, { height: 6 });
    expect(guessed?.roof).toBe('gable');
    expect(guessed?.sx).toBeCloseTo(14, 6);
    expect(guessed?.sz).toBeCloseTo(6, 6);
    expect(guessed?.color).toEqual(standInTint(pitched.roof));
    // A guessed height is to the eave: the roof rises above it. A measured one is to the ridge.
    expect(guessed?.sy).toBeCloseTo(6.6 / GABLE_BOX_EAVE, 6);
    const measured = standInPlacement(tall, FLAT_GROUND, pitched, { height: 6, measured: true });
    expect(measured?.sy).toBeCloseTo(6.6, 6);
    // A piece cut at a tile edge, and a part raised off the ground, keep a flat top.
    expect(standInPlacement(tall, FLAT_GROUND, pitched, { height: 6, clipped: true })?.roof).toBe(
      undefined,
    );
    const raised = standInPlacement(tall, FLAT_GROUND, pitched, { height: 4, minHeight: 12 });
    expect(raised?.roof).toBeUndefined();
    expect(raised?.y).toBeCloseTo(12, 6);
    expect(raised?.sy).toBeCloseTo(4, 6);
  });

  it('gives nothing for an outline with no extent or no height', () => {
    expect(
      standInPlacement(
        [
          [0, 0],
          [0.1, 0],
          [0.1, 0.1],
        ] as Vec2[],
        FLAT_GROUND,
        flat,
        { height: 5 },
      ),
    ).toBe(undefined);
    expect(standInPlacement(turned(), FLAT_GROUND, flat, { height: 0 })).toBeUndefined();
    expect(
      standInPlacement(turned().slice(0, 2), FLAT_GROUND, flat, { height: 5 }),
    ).toBeUndefined();
  });

  it('matches the stand-in a generated plain rectangle gets', () => {
    const outline = translate(SHAPES.box as Vec2[], 40, 20);
    const request = { identity: 'f:box', labels: ['building'], outline, height: 12 };
    const generated = generateWorldgenBatch({
      buildings: [request],
      pack,
      budgets: { maxBuildings: 0, maxStandIns: 1 },
    });
    const set = generated.placements[0];
    const style = pack.archstyles[generated.records[0]?.styleId ?? ''];
    if (set === undefined || style === undefined) throw new Error('no stand-in generated');
    const look = distantBuildingLook(style, { id: pack.id, version: pack.root.version }, request);
    const box = standInPlacement(outline, FLAT_GROUND, look, { height: 12, measured: true });
    // Same footprint and height; the generated one may name its axes the other way round.
    const [x, y, z, , sx, sy, sz] = Array.from(set.data);
    expect(box?.x).toBeCloseTo(x as number, 4);
    expect(box?.z).toBeCloseTo(z as number, 4);
    expect([box?.sx, box?.sz].sort()).toEqual(
      [sx, sz].sort().map((value) => expect.closeTo(value as number, 4)),
    );
    expect((box?.y ?? 0) + (box?.sy ?? 0)).toBeCloseTo((y as number) + (sy as number), 1);
  });

  it('is accepted by a batch as given, counted with its own stand-ins', () => {
    const box = standInPlacement(turned(), FLAT_GROUND, flat, { height: 9 });
    if (box === undefined) throw new Error('no box');
    const batch = generateWorldgenBatch({ buildings: [], pack, standIns: [box, box] });
    expect(batch.stats.buildingsIn).toBe(2);
    expect(batch.stats.buildingsBoxed).toBe(2);
    expect(batch.records).toHaveLength(0);
    expect(batch.placements[0]?.count).toBe(2);
    expect(batch.placements[0]?.data[4]).toBeCloseTo(20, 4);
  });
});

describe('distant looks', () => {
  it('carry the recipe height and whether its roof is pitched', () => {
    const identity = { id: pack.id, version: pack.root.version };
    const outline = translate(SHAPES.box as Vec2[], 0, 0);
    const house = distantBuildingLook(pack.archstyles['test.pack.house'] as never, identity, {
      identity: 'f:1',
      labels: ['house'],
      outline,
    });
    const box = distantBuildingLook(pack.archstyles['test.pack.box'] as never, identity, {
      identity: 'f:2',
      labels: ['building'],
      outline,
      height: 30,
    });
    expect(house.height).toBeGreaterThan(2);
    expect(box.height).toBeCloseTo(30, 1);
    expect(typeof house.pitched).toBe('boolean');
    expect(house.pitched).not.toBe(box.pitched);
  });
});
