/**
 * Which layer of a body shows along a straight ray: cast at the bind pose along an axis
 * (from in front, behind, a side or above) and report the color of the nearest triangle. Tests
 * paint each layer a pure channel color so a hit names its layer whatever tint was applied.
 */
import { generateFigureBody } from '../../src/kernel/body';
import { resolveFigureDescriptor } from '../../src/kernel/descriptor';
import type { FigureDescriptor } from '../../src/kernel/types';

/** Where a ray comes from; it travels along the axis toward the body. */
export type RayFrom = 'front' | 'back' | 'left' | 'right' | 'above';

const PLANES: Readonly<Record<RayFrom, { a: number; b: number; depth: number; sign: number }>> = {
  front: { a: 0, b: 1, depth: 2, sign: 1 },
  back: { a: 0, b: 1, depth: 2, sign: -1 },
  // The figure's left is +x.
  left: { a: 2, b: 1, depth: 0, sign: 1 },
  right: { a: 2, b: 1, depth: 0, sign: -1 },
  above: { a: 0, b: 2, depth: 1, sign: 1 },
};

/**
 * The color ("r,g,b") of the first surface a ray meets, or 'none'. `u, v` are the ray's
 * coordinates across the axis: (x, y) from the front or back, (z, y) from a side, (x, z) from
 * above. `below` ignores surfaces above a height (to look past the torso at the feet).
 */
export function firstHit(
  d: FigureDescriptor,
  tier: 0 | 1 | 2,
  from: RayFrom,
  u: number,
  v: number,
  below = Infinity,
): string {
  const { buffers } = generateFigureBody(resolveFigureDescriptor(d), tier);
  const p = buffers.positions;
  const idx = buffers.indices;
  const { a: A, b: B, depth: D, sign } = PLANES[from];
  let best = -Infinity;
  let hit = -1;
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t] as number,
      i1 = idx[t + 1] as number,
      i2 = idx[t + 2] as number;
    const ax = p[i0 * 3 + A] as number,
      ay = p[i0 * 3 + B] as number,
      bx = p[i1 * 3 + A] as number,
      by = p[i1 * 3 + B] as number,
      cx = p[i2 * 3 + A] as number,
      cy = p[i2 * 3 + B] as number;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-12) continue;
    const l1 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / det;
    const l2 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / det;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    const along =
      l1 * (p[i0 * 3 + D] as number) +
      l2 * (p[i1 * 3 + D] as number) +
      l3 * (p[i2 * 3 + D] as number);
    if (from === 'above' && along > below) continue;
    const z = sign * along;
    if (z > best) {
      best = z;
      hit = l1 >= l2 && l1 >= l3 ? i0 : l2 >= l3 ? i1 : i2;
    }
  }
  const col = buffers.colors;
  return hit < 0 ? 'none' : `${col[hit * 3]},${col[hit * 3 + 1]},${col[hit * 3 + 2]}`;
}
