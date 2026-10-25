import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../../src/kernel/building';
import { buildBuildingAccess } from '../../src/kernel/building-access';
import { buildFacade } from '../../src/kernel/facade';
import { distancePointToSegment, pointInRing } from '../../src/kernel/geometry2d';
import { createLotBuildingPlan, LOT_PLAN_KINDS } from '../../src/kernel/lot-plans';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { FLAT_GROUND, type Vec2 } from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';

const pack = await createTestPack();
const style = pack.archstyles['test.pack.house'];
if (!style) throw new Error('Missing house fixture');

describe('procedural lot plans', () => {
  it('keeps a narrow garage door on the driveway frontage instead of moving it to a side wall', () => {
    const out = new MeshBufferBuilder();
    buildFacade(
      {
        rings: [
          [
            [-1.6, 0],
            [1.6, 0],
            [1.6, 7],
            [-1.6, 7],
          ],
        ],
        base: 0,
        topAt: () => 3,
        floorHeight: 3,
        groundFloorHeight: 3,
        bayWidth: 3,
        cornerMargin: 0.55,
        salt: 1,
        entranceAt: [0, 0],
        details: { entrance: { width: 2.8, height: 2.3, style: 'service' } },
        window: { slot: 'window', ref: 'palette:#ffffff', color: [1, 1, 1] },
        trim: { slot: 'trim', ref: 'palette:#ffffff', color: [1, 1, 1] },
      },
      out,
    );
    const mesh = out.finalize();
    expect(mesh.triangleCount).toBeGreaterThan(12);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      expect(Math.abs(mesh.positions[i] as number)).toBeLessThan(1.4);
      expect(Math.abs(mesh.positions[i + 2] as number)).toBeLessThan(0.2);
    }
  });
  it.each(
    LOT_PLAN_KINDS,
  )('%s has an accessible entrance and generates finite reproducible geometry', (shape) => {
    for (const width of [10, 14, 20]) {
      const plan = createLotBuildingPlan(shape, width, 16);
      const parts = [plan, ...(plan.garage ? [plan.garage] : [])];
      for (const part of parts) {
        expect(
          Math.min(
            ...part.outline.map((p, i) =>
              distancePointToSegment(
                part.entrance,
                p,
                part.outline[(i + 1) % part.outline.length] as Vec2,
              ),
            ),
          ),
        ).toBeLessThan(1e-8);
        for (let step = 0; step < 20; step++) {
          const point: Vec2 = [part.entrance[0], -4 + ((part.entrance[1] + 4) * step) / 20];
          expect(parts.some((p) => pointInRing(point, p.outline))).toBe(false);
        }
        const build = () => {
          const out = new MeshBufferBuilder();
          const result = generateBuilding(
            {
              request: {
                identity: `plan:${shape}`,
                labels: ['house'],
                outline: part.outline,
                levels: 1,
                access: {
                  from: [part.entrance[0], -4],
                  to: part.entrance,
                  width: part === plan.garage ? 3 : 1.2,
                  garage: part === plan.garage,
                },
              },
              style,
              pack: { name: pack.id, version: pack.version },
              ground: FLAT_GROUND,
              tier: 1,
            },
            out,
          );
          expect(result.skipped).toBeUndefined();
          return out.finalize();
        };
        const mesh = build();
        expect([...mesh.positions].every(Number.isFinite)).toBe(true);
        expect(mesh.triangleCount).toBeGreaterThan(20);
        expect(mesh.positions).toEqual(build().positions);
      }
    }
  });

  it('follows the ground along the whole driveway, including intermediate slope changes', () => {
    const out = new MeshBufferBuilder();
    buildBuildingAccess(
      { from: [0, 0], to: [0, 12], width: 3 },
      { ...FLAT_GROUND, sampleHeight: (_x, z) => (z < 6 ? z * 0.1 : 0.6) },
      out,
    );
    const mesh = out.finalize();
    expect(mesh.triangleCount).toBe(12);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i] as number,
        y = mesh.positions[i + 1] as number,
        z = mesh.positions[i + 2] as number;
      expect(Math.abs(x)).toBe(1.5);
      expect(y).toBeCloseTo((z < 6 ? z * 0.1 : 0.6) + 0.045, 5);
    }
  });
});
