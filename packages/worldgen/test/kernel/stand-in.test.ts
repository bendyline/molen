import { describe, expect, it } from 'vitest';
import {
  BOX_PLACEMENT_SET_ID,
  GABLE_ROOF_PLACEMENT_SET_ID,
  generateWorldgenBatch,
} from '../../src/kernel/batch';
import { generateBuilding } from '../../src/kernel/building';
import {
  type DistantLook,
  type DistantPitch,
  distantBuildingLook,
  distantRoofHeight,
  standInTint,
} from '../../src/kernel/distant-look';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
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
    // The walls keep their own color; the roof has the roof's.
    expect(guessed?.color).toEqual(standInTint(pitched.wall));
    expect(guessed?.roofColor).toEqual(standInTint(pitched.roof));
    // A look that names no slope gets about 24 degrees: 0.45 m of rise a meter, over half of 6 m.
    expect(guessed?.roofHeight).toBeCloseTo(1.35, 6);
    // A guessed height is to the eave: the roof rises above it. A measured one is to the ridge,
    // so the walls give the roof its height.
    expect(guessed?.sy).toBeCloseTo(6.6, 6);
    const measured = standInPlacement(tall, FLAT_GROUND, pitched, { height: 6, measured: true });
    expect(measured?.roofHeight).toBeCloseTo(1.35, 6);
    expect(measured?.sy).toBeCloseTo(6.6 - 1.35, 6);
    // A piece cut at a tile edge, and a part raised off the ground, keep a flat top.
    expect(standInPlacement(tall, FLAT_GROUND, pitched, { height: 6, clipped: true })?.roof).toBe(
      undefined,
    );
    const raised = standInPlacement(tall, FLAT_GROUND, pitched, { height: 4, minHeight: 12 });
    expect(raised?.roof).toBeUndefined();
    expect(raised?.y).toBeCloseTo(12, 6);
    expect(raised?.sy).toBeCloseTo(4, 6);
  });

  it('gives the roof the slope of the look, whatever the height of the walls', () => {
    const gable: DistantLook = {
      ...flat,
      pitched: true,
      pitch: {
        type: 'gable',
        rise: Math.tan((22 * Math.PI) / 180),
        lowerRise: 1.2,
        maxSpan: 12,
        deck: false,
      },
    };
    const plan = (depth: number): Vec2[] => [
      [0, 0],
      [20, 0],
      [20, depth],
      [0, depth],
    ];
    const slopeOf = (box: ReturnType<typeof standInPlacement>): number =>
      (Math.atan((box?.roofHeight ?? 0) / ((box?.sz ?? 1) / 2)) * 180) / Math.PI;
    // One storey or six, 8 m deep: 22 degrees. The single shape this replaces drew 29 and 71.
    const low = standInPlacement(plan(8), FLAT_GROUND, gable, { height: 3 });
    const high = standInPlacement(plan(8), FLAT_GROUND, gable, { height: 18 });
    expect(slopeOf(low)).toBeCloseTo(22, 6);
    expect(slopeOf(high)).toBeCloseTo(22, 6);
    expect(high?.roofHeight).toBeCloseTo(low?.roofHeight as number, 6);
    expect(high?.sy).toBeCloseTo(18.6, 6);
    // A deeper plan has a higher roof at the same slope.
    const deep = standInPlacement(plan(12), FLAT_GROUND, gable, { height: 6 });
    expect(slopeOf(deep)).toBeCloseTo(22, 6);
    expect(deep?.roofHeight).toBeGreaterThan(low?.roofHeight as number);
    // A mapped height holds the roof: at most 0.4 of it, and walls and roof together reach it.
    const squat = standInPlacement(plan(12), FLAT_GROUND, gable, { height: 4, measured: true });
    expect(squat?.roofHeight).toBeCloseTo(1.6, 6);
    expect((squat?.sy ?? 0) + (squat?.roofHeight ?? 0)).toBeCloseTo(4.6, 6);
    // Too deep for a ridge: flat where the style leaves such plans flat, slopes to a deck else.
    const wide = standInPlacement(plan(16), FLAT_GROUND, gable, { height: 6 });
    expect(wide?.roof).toBeUndefined();
    expect(wide?.color).toEqual(standInTint(flat.wall));
    const decked = standInPlacement(
      plan(16),
      FLAT_GROUND,
      { ...gable, pitch: { ...(gable.pitch as DistantPitch), rise: 1, deck: true } },
      { height: 6 },
    );
    expect(decked?.roofHeight).toBeCloseTo(4.6, 6);
  });

  it('sizes each roof form as the generator builds it', () => {
    const pitch = (type: DistantPitch['type']): DistantPitch => ({
      type,
      rise: 0.5,
      lowerRise: 2,
      maxSpan: 14,
      deck: true,
    });
    for (const type of ['gable', 'hip', 'pyramid'] as const)
      expect(distantRoofHeight(pitch(type), 10)).toBeCloseTo(2.5, 6);
    // A gambrel: the lower slope over 0.55 of the half depth, the upper over the rest.
    expect(distantRoofHeight(pitch('gambrel'), 10)).toBeCloseTo(0.55 * 5 * 2 + 0.45 * 5 * 0.5, 6);
    // A mansard: a low steep skirt, 2.2 m at most.
    expect(distantRoofHeight(pitch('mansard'), 10)).toBeCloseTo(2.2, 6);
    expect(distantRoofHeight(pitch('mansard'), 3)).toBeCloseTo(0.6 * 1.5 * 2, 6);
    expect(distantRoofHeight(pitch('mansard'), 20)).toBeCloseTo(2.4, 6);
    expect(distantRoofHeight({ ...pitch('hip'), deck: false }, 20)).toBe(0);
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
    // The pitched one names its slopes, within its style's range of 25 to 40 degrees.
    const [sloped, level] = house.pitched === true ? [house, box] : [box, house];
    expect(level.pitch).toBeUndefined();
    const degrees = (Math.atan(sloped.pitch?.rise ?? 0) * 180) / Math.PI;
    expect(degrees).toBeGreaterThanOrEqual(25);
    expect(degrees).toBeLessThanOrEqual(40);
    expect(sloped.pitch?.maxSpan).toBe(14);
    expect(sloped.pitch?.deck).toBe(false);
  });

  it('give a generated stand-in a roof at the recipe slope, in the roof color', () => {
    const outline: Vec2[] = [
      [0, 0],
      [12, 0],
      [12, 7],
      [0, 7],
    ];
    const request = { identity: 'f:house', labels: ['house'], outline, levels: 2 };
    const style = pack.archstyles['test.pack.house'];
    if (style === undefined) throw new Error('no style');
    const identity = { id: pack.id, version: pack.root.version };
    const look = distantBuildingLook(style, identity, request);
    expect(look.pitched).toBe(true);
    // The stand-in the generator makes of it: walls in the wall color, a roof in the roof's,
    // as high as the look's slope makes it on a plan 7 m deep.
    const { box } = generateBuilding(
      { request, style, pack: identity, ground: FLAT_GROUND, tier: 99 },
      new MeshBufferBuilder(),
    );
    expect(box?.roof).toBe('gable');
    expect(box?.roofHeight).toBeCloseTo((look.pitch?.rise ?? 0) * 3.5, 6);
    expect(box?.color).toEqual(standInTint(look.wall));
    expect(box?.roofColor).toEqual(standInTint(look.roof));
    // A batch draws it as two instances: the roof stands on the walls, over the same plan,
    // ridge along the 12 m side.
    const batch = generateWorldgenBatch({ buildings: [request], pack, tier: 99 });
    const walls = batch.placements.find((set) => set.setId === BOX_PLACEMENT_SET_ID);
    const roofs = batch.placements.find((set) => set.setId === GABLE_ROOF_PLACEMENT_SET_ID);
    expect(walls?.count).toBe(1);
    expect(roofs?.count).toBe(1);
    expect(roofs?.modelRef).toBe('builtin:roof.gable');
    const [wx, wy, wz, wyaw, wsx, wsy, wsz, ...wall] = Array.from(walls?.data ?? []);
    const [rx, ry, rz, ryaw, rsx, rsy, rsz, ...roof] = Array.from(roofs?.data ?? []);
    expect([rx, rz, ryaw, rsx, rsz]).toEqual([wx, wz, wyaw, wsx, wsz]);
    expect(ry).toBeCloseTo((wy as number) + (wsy as number), 5);
    expect(rsx).toBeCloseTo(12, 5);
    expect(rsz).toBeCloseTo(7, 5);
    const degrees = (Math.atan((rsy as number) / 3.5) * 180) / Math.PI;
    expect(degrees).toBeGreaterThan(24.9);
    expect(degrees).toBeLessThan(40.1);
    expect(roof).not.toEqual(wall);
  });
});
