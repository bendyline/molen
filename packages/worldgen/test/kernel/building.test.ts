import { describe, expect, it } from 'vitest';
import { type BuildingGenerateInput, generateBuilding } from '../../src/kernel/building';
import { analyzeFootprint } from '../../src/kernel/footprint';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { resolveBuildingRecipe } from '../../src/kernel/recipe';
import {
  FLAT_GROUND,
  type HeightSampler,
  type MaterialSlot,
  type MeshBuffers,
  type Vec2,
} from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';
import { ring, SHAPES } from '../helpers/shapes';

const pack = await createTestPack();
const house = pack.archstyles['test.pack.house'];
if (house === undefined) throw new Error('test pack missing house style');
const identity = { name: pack.root.name, version: pack.root.version };

const SLOPE: HeightSampler = {
  sampleHeight: (x) => x * 0.2,
  slopeAt: () => 0.2,
  normalAt: () => [-0.196, 0.98, 0],
};

function build(
  overrides: Partial<BuildingGenerateInput> = {},
): ReturnType<typeof generateBuilding> & { out: MeshBufferBuilder } {
  const out = new MeshBufferBuilder();
  const result = generateBuilding(
    {
      request: { identity: 'f:1', labels: ['house'], outline: SHAPES.L as Vec2[] },
      style: house,
      pack: identity,
      ground: FLAT_GROUND,
      tier: 0,
      ...overrides,
    },
    out,
  );
  return { ...result, out };
}

function slotVertices(buffers: MeshBuffers, slot: MaterialSlot): number[][] {
  const indices = new Set<number>();
  for (const group of buffers.groups) {
    if (group.slot !== slot) continue;
    for (let i = group.start; i < group.start + group.count; i++)
      indices.add(buffers.indices[i] as number);
  }
  return [...indices].map((i) => Array.from(buffers.positions.subarray(i * 3, i * 3 + 3)));
}

describe('building generation', () => {
  it.each([
    0, 2, 3,
  ])('keeps roof and raised-part geometry within the supplied height at tier %s', (tier) => {
    const result = build({
      tier,
      request: {
        identity: 'raised',
        labels: ['house'],
        outline: SHAPES.box as Vec2[],
        height: 10,
        minHeight: 3,
      },
    });
    expect(result.record?.height).toBe(10);
    if (result.box !== undefined) {
      expect(result.box.y).toBe(3);
      expect(result.box.y + result.box.sy).toBe(10);
    } else {
      const vertices = Array.from(result.out.finalize().positions).filter((_, i) => i % 3 === 1);
      expect(Math.max(...vertices)).toBeCloseTo(10, 5);
      expect(Math.min(...vertices)).toBeCloseTo(3, 5);
    }
  });

  it('produces walls, a roof, and a record on flat ground', () => {
    const result = build();
    expect(result.skipped).toBeUndefined();
    expect(result.box).toBeUndefined();
    const buffers = result.out.finalize();
    const slots = new Set(buffers.groups.map((group) => group.slot));
    expect(slots.has('wall')).toBe(true);
    expect(slots.has('roof')).toBe(true);
    expect(result.record?.base).toBe(0);
    expect(result.record?.height).toBeGreaterThan(2);
    expect(result.record?.footprintKind).toBe('L');
    expect(['gable', 'hip', 'flat']).toContain(result.record?.roof);
    let minY = Number.POSITIVE_INFINITY;
    for (let index = 1; index < buffers.positions.length; index += 3) {
      minY = Math.min(minY, buffers.positions[index] as number);
    }
    expect(minY).toBeGreaterThanOrEqual(-1.5);
  });

  it('is deterministic per identity and re-rolls with the identity', () => {
    const a = build().out.finalize();
    const b = build().out.finalize();
    expect(Buffer.compare(Buffer.from(a.positions.buffer), Buffer.from(b.positions.buffer))).toBe(
      0,
    );
    const analysis = analyzeFootprint(SHAPES.L as Vec2[]);
    const recipeA = resolveBuildingRecipe(
      house,
      identity,
      { identity: 'f:1', labels: ['house'], outline: SHAPES.L as Vec2[] },
      analysis,
      0,
    );
    const recipeB = resolveBuildingRecipe(
      house,
      identity,
      { identity: 'f:2', labels: ['house'], outline: SHAPES.L as Vec2[] },
      analysis,
      0,
    );
    expect(recipeA.seed).not.toBe(recipeB.seed);
    expect(recipeA.parts.wall.color).not.toEqual(recipeB.parts.wall.color);
  });

  it('uses source height and levels before the fallback', () => {
    const analysis = analyzeFootprint(SHAPES.box as Vec2[]);
    const withHeight = resolveBuildingRecipe(
      house,
      identity,
      { identity: 'x', labels: ['house'], outline: SHAPES.box as Vec2[], height: 9.5 },
      analysis,
      0,
    );
    expect(withHeight.totalHeight).toBe(9.5);
    expect(withHeight.heightSource).toBe('height');
    const withLevels = resolveBuildingRecipe(
      house,
      identity,
      { identity: 'x', labels: ['house'], outline: SHAPES.box as Vec2[], levels: 3 },
      analysis,
      0,
    );
    expect(withLevels.floors).toBe(3);
    expect(withLevels.heightSource).toBe('levels');
    const fallback = resolveBuildingRecipe(
      house,
      identity,
      { identity: 'x', labels: ['house'], outline: SHAPES.box as Vec2[] },
      analysis,
      0,
    );
    expect(fallback.heightSource).toBe('fallback');
    expect(fallback.floors).toBe(2);
  });

  it('adds a foundation skirt on sloped ground and none on flat ground', () => {
    const sloped = build({ ground: SLOPE }).out.finalize();
    expect(sloped.groups.some((group) => group.slot === 'foundation')).toBe(true);
    const flat = build().out.finalize();
    expect(flat.groups.some((group) => group.slot === 'foundation')).toBe(false);
  });

  it.each([
    { tier: 0, simplified: true, exposeOnSlope: true },
    { tier: 1, simplified: true, exposeOnSlope: true },
    { tier: 2, simplified: false, exposeOnSlope: true },
    { tier: 0, simplified: false, exposeOnSlope: false },
  ])('grounds walls without extra geometry or shifted facades: %j', (options) => {
    const style = structuredClone(house);
    style.massing.foundation.exposeOnSlope = options.exposeOnSlope;
    const result = build({ ...options, style, ground: SLOPE });
    const base = result.record?.base as number;
    const level = build({
      ...options,
      style,
      ground: { ...FLAT_GROUND, sampleHeight: () => base },
    });
    const sloped = result.out.finalize();
    const flat = level.out.finalize();
    expect(sloped.vertexCount).toBe(flat.vertexCount);
    expect(sloped.groups).toEqual(flat.groups);
    expect(slotVertices(sloped, 'roof')).toEqual(slotVertices(flat, 'roof'));
    expect(slotVertices(sloped, 'window')).toEqual(slotVertices(flat, 'window'));
    expect(result.record).toEqual(level.record);
    const walls = slotVertices(sloped, 'wall');
    for (const [x, z] of SHAPES.L as Vec2[]) {
      const ys = walls
        .filter(
          (p) => Math.abs((p[0] as number) - x) < 1e-5 && Math.abs((p[2] as number) - z) < 1e-5,
        )
        .map((p) => p[1] as number);
      expect(ys.length).toBeGreaterThan(0);
      expect(Math.min(...ys)).toBeLessThanOrEqual(SLOPE.sampleHeight(x, z));
    }
  });

  it('supports dips between footprint corners and preserves platform-min elevations', () => {
    const ground: HeightSampler = { ...FLAT_GROUND, sampleHeight: (x) => 0.08 * (x - 6) ** 2 };
    for (const groundFit of ['platform-average', 'platform-max', 'platform-min'] as const) {
      const style = structuredClone(house);
      style.massing.groundFit = groundFit;
      const result = build({ style, ground, simplified: true });
      const walls = slotVertices(result.out.finalize(), 'wall');
      // The long front edge spans a valley at x=6, even though both corners are uphill.
      for (const x of [0, 12]) {
        const ys = walls.filter((p) => p[0] === x && p[2] === 0).map((p) => p[1] as number);
        expect(Math.min(...ys)).toBeLessThanOrEqual(ground.sampleHeight(6, 0));
      }
    }
  });

  it.each([
    false,
    true,
  ])('grounds courtyard walls as well as the outer perimeter (simplified=%s)', (simplified) => {
    const ground: HeightSampler = {
      ...FLAT_GROUND,
      sampleHeight: (x, z) => (x >= 7 && x <= 13 && z >= 5 && z <= 11 ? -4 : 0),
    };
    const result = build({
      ground,
      simplified,
      request: {
        identity: 'court',
        labels: ['house'],
        outline: SHAPES.courtyardOuter as Vec2[],
        holes: [SHAPES.courtyardHole as Vec2[]],
      },
    });
    const buffers = result.out.finalize();
    const supports = slotVertices(buffers, simplified ? 'wall' : 'foundation');
    for (const [x, z] of SHAPES.courtyardHole as Vec2[]) {
      const ys = supports.filter((p) => p[0] === x && p[2] === z).map((p) => p[1] as number);
      expect(ys.length).toBeGreaterThan(0);
      expect(Math.min(...ys)).toBeLessThan(-4);
    }
  });

  it('extends distant boxes to ground under their actual rectangular footprint while keeping the top fixed', () => {
    const ground: HeightSampler = { ...FLAT_GROUND, sampleHeight: (x, z) => -x - z };
    const result = build({ ground, tier: 99 });
    expect(result.box?.y).toBeLessThan(-24);
    expect((result.box?.y as number) + (result.box?.sy as number)).toBeCloseTo(
      (result.record?.base as number) + (result.record?.height as number),
      6,
    );
    expect(result.out.isEmpty()).toBe(true);
  });

  it.each([
    { tier: 0, simplified: false },
    { tier: 0, simplified: true },
    { tier: 2, simplified: false },
    { tier: 99, simplified: false },
  ])('preserves intentionally elevated parts on slopes: %j', (options) => {
    const result = build({
      ...options,
      ground: SLOPE,
      request: {
        identity: 'raised',
        labels: ['house'],
        outline: SHAPES.box as Vec2[],
        minHeight: 4,
      },
    });
    const bottom =
      result.box?.y ??
      Math.min(...slotVertices(result.out.finalize(), 'wall').map((p) => p[1] as number));
    expect(bottom).toBeCloseTo((result.record?.base as number) + 4, 5);
    expect(result.out.finalize().groups.some((g) => g.slot === 'foundation')).toBe(false);
  });

  it('degrades to a box beyond the last detail tier', () => {
    const result = build({ tier: 3 });
    expect(result.box).toBeDefined();
    expect(result.out.isEmpty()).toBe(true);
    expect(result.box?.sx).toBeCloseTo(12, 6);
    expect(result.box?.sz).toBeCloseTo(12, 6);
    expect(result.record?.roof).toBe('box');
  });

  it('gives clipped pieces a flat roof and skips degenerate outlines', () => {
    const clipped = build({
      request: {
        identity: 'f:9',
        labels: ['house'],
        outline: SHAPES.box as Vec2[],
        clipped: true,
        seamEdges: [1],
      },
    });
    expect(clipped.record?.roof).toBe('flat');
    const degenerate = build({
      request: { identity: 'f:0', labels: ['house'], outline: SHAPES.sliver as Vec2[] },
    });
    expect(degenerate.skipped).toBe('degenerate');
  });

  it('ignores a hole outside the outline instead of building geometry beside the house', () => {
    const stray = ring([
      [20, 2],
      [26, 2],
      [26, 6],
      [20, 6],
    ]);
    const result = build({
      request: {
        identity: 'f:8',
        labels: ['house'],
        outline: SHAPES.box as Vec2[], // x 0..12, z 0..8
        holes: [stray],
      },
    });
    expect(result.analysis.holes).toHaveLength(0);
    expect(result.analysis.holeNotices?.[0]).toContain('not strictly inside');
    expect(result.record?.footprintKind).toBe('box'); // not a courtyard
    const buffers = result.out.finalize();
    let maxX = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < buffers.positions.length; index += 3) {
      maxX = Math.max(maxX, buffers.positions[index] as number);
    }
    expect(maxX).toBeLessThan(14); // footprint + eave overhang, nowhere near the stray ring
  });

  it('raises minHeight parts and caps their underside', () => {
    const result = build({
      request: { identity: 'f:5', labels: ['house'], outline: SHAPES.box as Vec2[], minHeight: 4 },
    });
    const buffers = result.out.finalize();
    let minY = Number.POSITIVE_INFINITY;
    for (let index = 1; index < buffers.positions.length; index += 3) {
      minY = Math.min(minY, buffers.positions[index] as number);
    }
    expect(minY).toBeCloseTo(4, 6);
    expect(buffers.groups.some((group) => group.slot === 'foundation')).toBe(false);
  });
});
