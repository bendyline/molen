import { hashBytes } from '@bendyline/molen-kernel/determinism';
import { describe, expect, it } from 'vitest';
import {
  deriveRig,
  FIGURE_PRESET_IDS,
  type FigureBody,
  type FigureTier,
  generateFigureBody,
  resolveFigureDescriptor,
} from '../src/kernel';

function digest(body: FigureBody): string {
  const parts = [
    body.buffers.positions,
    body.buffers.normals,
    body.buffers.colors,
    body.buffers.indices,
  ];
  if (body.buffers.joints !== undefined) parts.push(body.buffers.joints);
  if (body.buffers.weights !== undefined) parts.push(body.buffers.weights);
  const total = parts.reduce((n, a) => n + a.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const a of parts) {
    bytes.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), offset);
    offset += a.byteLength;
  }
  return hashBytes(bytes);
}

const BUDGET: Record<FigureTier, [number, number]> = {
  0: [600, 4000],
  1: [200, 1200],
  2: [200, 1200],
};

describe('procedural bodies', () => {
  for (const preset of FIGURE_PRESET_IDS) {
    describe(preset, () => {
      const descriptor = resolveFigureDescriptor({ preset });
      const rig = deriveRig(descriptor);
      for (const tier of [0, 1, 2] as const) {
        it(`tier ${tier} is valid, symmetric and within budget`, () => {
          const body = generateFigureBody(descriptor, tier, rig);
          const { buffers } = body;
          expect(buffers.tier).toBe(tier);
          expect(buffers.indices.length % 3).toBe(0);
          expect(buffers.triangleCount).toBeGreaterThanOrEqual(BUDGET[tier][0]);
          expect(buffers.triangleCount).toBeLessThanOrEqual(BUDGET[tier][1]);
          for (const index of buffers.indices) expect(index).toBeLessThan(buffers.vertexCount);
          for (const v of buffers.positions) expect(Number.isFinite(v)).toBe(true);
          for (let i = 0; i < buffers.normals.length; i += 3) {
            const l = Math.hypot(
              buffers.normals[i] as number,
              buffers.normals[i + 1] as number,
              buffers.normals[i + 2] as number,
            );
            expect(l).toBeCloseTo(1, 3);
          }
          if (tier === 2) {
            expect(buffers.joints).toBeUndefined();
          } else {
            const joints = buffers.joints as Uint8Array;
            const weights = buffers.weights as Float32Array;
            for (let v = 0; v < buffers.vertexCount; v++) {
              expect(joints[v * 4]).toBeLessThan(rig.joints.length);
              expect(joints[v * 4 + 1]).toBeLessThan(rig.joints.length);
              const sum = (weights[v * 4] as number) + (weights[v * 4 + 1] as number);
              expect(sum).toBeCloseTo(1, 4);
            }
          }
          // Left/right symmetry: the multiset of |x| positions is mirror-complete.
          const left = new Map<string, number>();
          for (let i = 0; i < buffers.positions.length; i += 3) {
            const x = buffers.positions[i] as number;
            if (Math.abs(x) < 1e-6) continue;
            const key = `${Math.abs(x).toFixed(5)}|${(buffers.positions[i + 1] as number).toFixed(5)}|${(buffers.positions[i + 2] as number).toFixed(5)}`;
            left.set(key, (left.get(key) ?? 0) + (x > 0 ? 1 : -1));
          }
          for (const [key, balance] of left) expect(balance, key).toBe(0);
          // Grounded, and as tall as the descriptor says (within the hair/ears allowance).
          expect(body.bounds.min[1]).toBeGreaterThanOrEqual(-1e-4);
          expect(body.bounds.max[1]).toBeGreaterThan(0.9 * descriptor.height);
          // Ears, hair and antlers may rise above the reference height.
          const cap = descriptor.archetype === 'biped' ? 1.15 : 1.8;
          expect(body.bounds.max[1]).toBeLessThan(cap * descriptor.height);
          expect(body.inverseBind.length).toBe(rig.joints.length * 16);
        });
      }

      it('is byte-identical across runs', () => {
        const a = generateFigureBody(descriptor, 0);
        const b = generateFigureBody(descriptor, 0);
        expect(digest(a)).toBe(digest(b));
        expect(digest(generateFigureBody(descriptor, 1))).not.toBe(digest(a));
      });
    });
  }

  it('changes with the descriptor and keeps groups ordered by region', () => {
    const base = generateFigureBody(resolveFigureDescriptor({ preset: 'human.adult' }), 0);
    const tall = generateFigureBody(
      resolveFigureDescriptor({ preset: 'human.adult', height: 2 }),
      0,
    );
    const red = generateFigureBody(
      resolveFigureDescriptor({ preset: 'human.adult', palette: { top: '#ff0000' } }),
      0,
    );
    expect(digest(tall)).not.toBe(digest(base));
    expect(digest(red)).not.toBe(digest(base));
    expect(red.buffers.positions).toEqual(base.buffers.positions);
    const regions = base.buffers.groups.map((g) => g.region);
    expect(regions).toContain('top');
    expect(regions).toContain('shoes');
    expect(regions).toContain('eyes');
    let offset = 0;
    for (const group of base.buffers.groups) {
      expect(group.start).toBe(offset);
      offset += group.count;
    }
    expect(offset).toBe(base.buffers.indices.length);
  });
});
