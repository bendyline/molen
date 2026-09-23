import { describe, expect, it } from 'vitest';
import type { Frame } from '../../src/kernel/footprint';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import type { Wing } from '../../src/kernel/rectangles';
import {
  buildFlatRoof,
  buildSkillionRoof,
  buildWingRoof,
  type RoofSurfaces,
  type WingRoofKind,
} from '../../src/kernel/roofs';
import type { MeshBuffers, Vec2 } from '../../src/kernel/types';
import { SHAPES } from '../helpers/shapes';

const FRAME: Frame = { ox: 100, oz: 50, c: Math.cos(0.4), s: Math.sin(0.4) };
const WING: Wing = {
  u0: 0,
  v0: 0,
  u1: 12,
  v1: 8,
  longAxis: 'u',
  priority: 0,
  endOnOutline: [true, true],
};
const SURFACES: RoofSurfaces = {
  roof: { slot: 'roof', ref: 'palette:#444444', color: [0.3, 0.3, 0.3] },
  trim: { slot: 'trim', ref: 'palette:#eeeeee', color: [0.9, 0.9, 0.9] },
  wall: { slot: 'wall', ref: 'palette:#cccccc', color: [0.8, 0.8, 0.8] },
};
const KINDS: WingRoofKind[] = ['gable', 'hip', 'pyramid', 'shed', 'mansard', 'gambrel'];

function expectSane(buffers: MeshBuffers): void {
  for (const value of buffers.positions) expect(Number.isFinite(value)).toBe(true);
  for (let index = 0; index < buffers.normals.length; index += 3) {
    const length = Math.hypot(
      buffers.normals[index] as number,
      buffers.normals[index + 1] as number,
      buffers.normals[index + 2] as number,
    );
    expect(length).toBeCloseTo(1, 5);
  }
  for (const index of buffers.indices) expect(index).toBeLessThan(buffers.vertexCount);
}

function roofNormalsUp(buffers: MeshBuffers): void {
  for (const group of buffers.groups) {
    if (group.slot !== 'roof') continue;
    const seen = new Set<number>();
    for (let index = group.start; index < group.start + group.count; index++) {
      const vertex = buffers.indices[index] as number;
      if (seen.has(vertex)) continue;
      seen.add(vertex);
      expect(buffers.normals[vertex * 3 + 1]).toBeGreaterThan(0);
    }
  }
}

describe('wing roofs', () => {
  it.each(KINDS)('%s builds finite, unit-normal geometry facing up', (kind) => {
    for (const tier of [0, 1, 2]) {
      const out = new MeshBufferBuilder();
      buildWingRoof(
        kind,
        {
          wing: WING,
          frame: FRAME,
          eave: 10,
          rise: 0.7,
          lowerRise: 2.4,
          overhang: 0.6,
          tier,
          surfaces: SURFACES,
          shedDirection: 1,
        },
        out,
      );
      const buffers = out.finalize();
      expect(buffers.triangleCount).toBeGreaterThan(0);
      expectSane(buffers);
      roofNormalsUp(buffers);
      let maxY = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      for (let index = 1; index < buffers.positions.length; index += 3) {
        maxY = Math.max(maxY, buffers.positions[index] as number);
        minY = Math.min(minY, buffers.positions[index] as number);
      }
      expect(maxY).toBeGreaterThan(10);
      expect(minY).toBeGreaterThanOrEqual(10 - 0.6 * 2.4 - 0.15 - 1e-6);
    }
  });

  it('gable ridge height and eave are exact', () => {
    const out = new MeshBufferBuilder();
    buildWingRoof(
      'gable',
      {
        wing: WING,
        frame: FRAME,
        eave: 10,
        rise: 0.5,
        lowerRise: 1,
        overhang: 0,
        tier: 2,
        surfaces: SURFACES,
        shedDirection: 1,
      },
      out,
    );
    const buffers = out.finalize();
    const ys = new Set<number>();
    for (let index = 1; index < buffers.positions.length; index += 3) {
      ys.add(Math.round((buffers.positions[index] as number) * 1e6) / 1e6);
    }
    expect(ys.has(10)).toBe(true);
    expect(ys.has(12)).toBe(true);
    expect(buffers.groups.map((group) => group.slot)).toEqual(['wall', 'roof']);
  });

  it('tiers strictly reduce vertex counts', () => {
    const counts = [0, 1, 2].map((tier) => {
      const out = new MeshBufferBuilder();
      buildWingRoof(
        'hip',
        {
          wing: WING,
          frame: FRAME,
          eave: 10,
          rise: 0.6,
          lowerRise: 2,
          overhang: 0.5,
          tier,
          surfaces: SURFACES,
          shedDirection: 1,
        },
        out,
      );
      return out.vertexCount();
    });
    expect(counts[0]).toBeGreaterThan(counts[1] as number);
    expect(counts[1]).toBeGreaterThanOrEqual(counts[2] as number);
  });
});

describe('flat and skillion roofs', () => {
  it('caps an outline with holes and adds a parapet ring', () => {
    const out = new MeshBufferBuilder();
    const ok = buildFlatRoof(
      SHAPES.courtyardOuter as Vec2[],
      [SHAPES.courtyardHole as Vec2[]],
      6,
      { height: 0.8, thickness: 0.3 },
      SURFACES,
      0,
      out,
    );
    expect(ok).toBe(true);
    const buffers = out.finalize();
    expectSane(buffers);
    expect(buffers.groups.map((group) => group.slot)).toEqual(['roof', 'trim']);
    const withoutParapet = new MeshBufferBuilder();
    buildFlatRoof(
      SHAPES.courtyardOuter as Vec2[],
      [SHAPES.courtyardHole as Vec2[]],
      6,
      undefined,
      SURFACES,
      0,
      withoutParapet,
    );
    expect(withoutParapet.finalize().groups).toHaveLength(1);
    expect(
      buildFlatRoof(
        SHAPES.bowtie as Vec2[],
        [],
        6,
        undefined,
        SURFACES,
        0,
        new MeshBufferBuilder(),
      ),
    ).toBe(false);
  });

  it('skillion top follows a plane the walls can use', () => {
    const out = new MeshBufferBuilder();
    const frame: Frame = { ox: 0, oz: 0, c: 1, s: 0 };
    const topAt = buildSkillionRoof(
      SHAPES.box as Vec2[],
      [],
      frame,
      { eave: 5, rise: 0.25, direction: 1 },
      SURFACES,
      out,
    );
    expect(topAt).toBeDefined();
    expect(topAt?.([0, 0])).toBeCloseTo(5, 6);
    expect(topAt?.([0, 8])).toBeCloseTo(7, 6);
    expectSane(out.finalize());
  });
});
