import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wildlifeGeometry } from '../src/client/wildlife-geometry';
import { wildlifeSpeciesSchema } from '../src/kernel/wildlife-types';

const catalog = JSON.parse(
  readFileSync(new URL('../../../content/wildlife/regional.catalog.json', import.meta.url), 'utf8'),
);
describe('procedural wildlife geometry', () => {
  for (const raw of catalog.animals) {
    const species = wildlifeSpeciesSchema.parse(raw);
    it(`${species.title}: finite opaque geometry with valid rigid skinning at every detail tier`, () => {
      for (const tier of [0, 1, 2] as const) {
        const { geometry, joints, triangles } = wildlifeGeometry(species, tier);
        const p = geometry.getAttribute('position'),
          n = geometry.getAttribute('normal');
        const skin = geometry.getAttribute('skinIndex'),
          weights = geometry.getAttribute('skinWeight');
        expect(triangles).toBeLessThanOrEqual(tier === 0 ? 4000 : tier === 1 ? 900 : 300);
        expect(triangles).toBeGreaterThan(30);
        expect([...p.array, ...n.array].every(Number.isFinite)).toBe(true);
        expect(geometry.getAttribute('color').itemSize).toBe(3);
        for (let i = 0; i < p.count; i++) {
          expect(skin.getX(i)).toBeLessThan(joints.length);
          expect(weights.getX(i)).toBe(1);
          expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
        }
        for (let i = 0; i < p.count; i += 3) {
          const ax = p.getX(i + 1) - p.getX(i),
            ay = p.getY(i + 1) - p.getY(i),
            az = p.getZ(i + 1) - p.getZ(i);
          const bx = p.getX(i + 2) - p.getX(i),
            by = p.getY(i + 2) - p.getY(i),
            bz = p.getZ(i + 2) - p.getZ(i);
          expect(
            Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx),
          ).toBeGreaterThan(1e-14);
        }
        geometry.dispose();
      }
    });
  }
});
