import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../../src/kernel/building';
import { buildBuildingAccess } from '../../src/kernel/building-access';
import { buildYardFence } from '../../src/kernel/building-yard';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { type BuildingYard, FLAT_GROUND } from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';

describe('simple yard fence geometry', () => {
  it('keeps paving above a ground overlay while following terrain', () => {
    const out = new MeshBufferBuilder();
    buildBuildingAccess(
      { from: [0, 0], to: [0, 10], width: 3, lift: 0.28 },
      { ...FLAT_GROUND, sampleHeight: (_x, z) => z * 0.1 },
      out,
    );
    const { positions } = out.finalize();
    for (let i = 0; i < positions.length; i += 3)
      expect((positions[i + 1] as number) - (positions[i + 2] as number) * 0.1).toBeCloseTo(
        0.28,
        5,
      );
  });
  it('retains a cheap nearby fence with a simplified house, but omits it at a distant tier', async () => {
    const pack = await createTestPack();
    const style = pack.archstyles['test.pack.house'];
    if (!style) throw new Error('missing house style');
    const build = (tier: number) => {
      const out = new MeshBufferBuilder();
      generateBuilding(
        {
          request: {
            identity: 'nearby-yard',
            labels: ['house'],
            outline: [
              [0, 0],
              [10, 0],
              [10, 12],
              [0, 12],
            ],
            yard: {
              fence: {
                kind: 'masonry',
                height: 1,
                segments: [
                  [
                    [-3, -1],
                    [-3, 12],
                  ],
                ],
              },
            },
          },
          style,
          pack: { name: pack.root.name, version: pack.root.version },
          ground: FLAT_GROUND,
          tier,
          simplified: true,
        },
        out,
      );
      return [...out.finalize().positions].filter((_, i) => i % 3 === 0);
    };
    expect(build(1).some((x) => x < -2.5)).toBe(true);
    expect(build(2).some((x) => x < -2.5)).toBe(false);
  });
  it.each([
    'timber',
    'masonry',
    'rail',
  ] as const)('%s follows sloping terrain with bounded deterministic geometry', (kind) => {
    const fence: NonNullable<BuildingYard['fence']> = {
      kind,
      height: 1,
      segments: [
        [
          [0, 0],
          [0, 12],
        ],
        [
          [0, 12],
          [8, 12],
        ],
        [
          [8, 12],
          [8, 0],
        ],
        [
          [0, 0],
          [2, 0],
        ],
        [
          [6, 0],
          [8, 0],
        ],
      ],
    };
    const ground = { ...FLAT_GROUND, sampleHeight: (_x: number, z: number) => z * 0.1 };
    const build = (tier: number) => {
      const out = new MeshBufferBuilder();
      buildYardFence(fence, 'fixed-house', [0.8, 0.7, 0.6], ground, tier, out);
      return out.finalize();
    };
    const mesh = build(0);
    expect(mesh.positions).toEqual(build(0).positions);
    expect([...mesh.positions].every(Number.isFinite)).toBe(true);
    expect(mesh.triangleCount).toBeGreaterThan(20);
    expect(mesh.triangleCount).toBeLessThan(250);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i] as number,
        y = mesh.positions[i + 1] as number,
        z = mesh.positions[i + 2] as number;
      expect(y - z * 0.1).toBeGreaterThan(-0.1);
      expect(y - z * 0.1).toBeLessThan(1.2);
      // The entrance opening at x=2..6 stays empty, including posts and caps.
      expect(z < 0.2 && x > 2.2 && x < 5.8).toBe(false);
    }
    expect(build(2).triangleCount).toBe(0);
    expect(build(1).triangleCount).toBeLessThanOrEqual(mesh.triangleCount);
  });
});
