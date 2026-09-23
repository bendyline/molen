import { describe, expect, it } from 'vitest';
import { encodeGlb } from '../../src/kernel/glb';
import { generateLandmarkModel, SIGN_DESIGNS } from '../../src/kernel/landmark-models';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { buildStorefronts } from '../../src/kernel/storefronts';
import type { StorefrontRequest } from '../../src/kernel/types';

describe('canonical identity geometry', () => {
  it('builds deterministic finite signs with cheap distant silhouettes and exportable geometry', () => {
    for (const id of Object.keys(SIGN_DESIGNS)) {
      const a = generateLandmarkModel(`sign.${id}`);
      const b = generateLandmarkModel(`sign.${id}`);
      const distant = generateLandmarkModel(`sign.${id}`, 2);
      if (!a || !b || !distant) throw new Error(`Missing sign model: ${id}`);
      expect(a.positions).toEqual(b.positions);
      expect([...a.positions, ...a.normals].every(Number.isFinite)).toBe(true);
      expect(a.triangleCount).toBeLessThan(650);
      expect(distant.triangleCount).toBeLessThan(a.triangleCount);
      expect(a.groups).toHaveLength(1);
      expect(encodeGlb(a).byteLength).toBeGreaterThan(100);
      for (let i = 2; i < a.normals.length; i += 3)
        if ((a.positions[i] ?? 0) > 0.1) expect(a.normals[i]).toBe(1);
    }
  });
  it('keeps sign faces outward and avoids seam walls, overlapping bays and short walls', () => {
    const request: StorefrontRequest = {
      identity: 'store',
      at: [10, 10],
      accent: '#ff0000',
      signModel: 'builtin:sign.burger_restaurant',
      width: 8,
    };
    const ring: [number, number][] = [
      [0, 0],
      [20, 0],
      [20, 10],
      [0, 10],
    ];
    const out = new MeshBufferBuilder();
    const signs = buildStorefronts(
      [request, { ...request, identity: 'second' }],
      ring,
      0,
      () => 5,
      undefined,
      false,
      out,
    );
    expect(signs).toHaveLength(2);
    expect(signs[0]?.yaw).toBe(0);
    expect(signs.every((p) => p.z > 10)).toBe(true);
    const [first, second] = signs;
    if (!first || !second) throw new Error('Missing frontage');
    expect(Math.abs(first.x - second.x)).toBeGreaterThan(4 * first.scale);
    const cut = buildStorefronts(
      [request],
      ring,
      0,
      () => 5,
      new Set([2]),
      false,
      new MeshBufferBuilder(),
    );
    expect(cut.every((p) => p.z <= 10)).toBe(true);
    expect(
      buildStorefronts([request], ring, 0, () => 1, undefined, false, new MeshBufferBuilder()),
    ).toHaveLength(0);
  });
});
