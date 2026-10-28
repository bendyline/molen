import { dmath } from '@bendyline/molen-kernel/determinism';
import type { MeshBufferBuilder } from './mesh-buffers';
import { hashString, unit01 } from './seed';
import type { BuildingYard, HeightSampler, RGB, Vec2, Vec3 } from './types';

/** Low yard boundaries share a single palette material and follow the sampled terrain. */
export function buildYardFence(
  fence: NonNullable<BuildingYard['fence']>,
  identity: string,
  wallColor: RGB,
  ground: HeightSampler,
  tier: number,
  out: MeshBufferBuilder,
): void {
  if (tier > 1) return;
  const tint = 0.94 + unit01(hashString(`${identity}|yard-color`), 0) * 0.12;
  const base: RGB =
    fence.kind === 'masonry'
      ? wallColor
      : fence.kind === 'timber'
        ? [0.7, 0.59, 0.43]
        : [0.47, 0.51, 0.48];
  const color = base.map((c) => Math.min(1, c * tint)) as RGB;
  const uv: [Vec2, Vec2, Vec2, Vec2] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const quad = (points: [Vec3, Vec3, Vec3, Vec3], normal: Vec3): void =>
    out.addQuad('foundation', 'palette:#ffffff', points, normal, uv, color);
  const posts = new Set<string>();
  const post = (p: Vec2): void => {
    const key = `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
    if (posts.has(key)) return;
    posts.add(key);
    const y = ground.sampleHeight(...p) - 0.04,
      top = y + fence.height + 0.1;
    if (!Number.isFinite(y)) return;
    // Crossed double-sided strips keep simple posts visible from either side of a fence.
    for (const [dx, dz] of [
      [0.06, 0],
      [0, 0.06],
    ]) {
      const points: [Vec3, Vec3, Vec3, Vec3] = [
        [p[0] - (dx as number), y, p[1] - (dz as number)],
        [p[0] + (dx as number), y, p[1] + (dz as number)],
        [p[0] + (dx as number), top, p[1] + (dz as number)],
        [p[0] - (dx as number), top, p[1] - (dz as number)],
      ];
      const n: Vec3 = dx ? [0, 0, 1] : [1, 0, 0];
      quad(points, n);
      quad(points, [-n[0], 0, -n[2]]);
    }
  };
  let remaining = 64;
  for (const [a, b] of fence.segments) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = dmath.hypot(dx, dz);
    if (length < 0.2 || remaining <= 0) continue;
    const count = Math.min(remaining, Math.ceil(length / (tier === 0 ? 4 : 8)));
    remaining -= count;
    const normal: Vec3 = [-dz / length, 0, dx / length];
    const thickness = fence.kind === 'masonry' ? 0.16 : 0.07;
    for (let i = 0; i < count; i++) {
      const p: Vec2 = [a[0] + (dx * i) / count, a[1] + (dz * i) / count],
        q: Vec2 = [a[0] + (dx * (i + 1)) / count, a[1] + (dz * (i + 1)) / count];
      const py = ground.sampleHeight(...p),
        qy = ground.sampleHeight(...q);
      if (!Number.isFinite(py) || !Number.isFinite(qy)) continue;
      const bands =
        fence.kind === 'rail'
          ? [
              [fence.height * 0.32, fence.height * 0.32 + 0.09],
              [fence.height * 0.8, fence.height * 0.8 + 0.09],
            ]
          : [[-0.05, fence.height]];
      for (const [lo, hi] of bands) {
        for (const side of [-1, 1]) {
          const nx = ((normal[0] * thickness) / 2) * side,
            nz = ((normal[2] * thickness) / 2) * side;
          quad(
            [
              [p[0] + nx, py + (lo as number), p[1] + nz],
              [q[0] + nx, qy + (lo as number), q[1] + nz],
              [q[0] + nx, qy + (hi as number), q[1] + nz],
              [p[0] + nx, py + (hi as number), p[1] + nz],
            ],
            [normal[0] * side, 0, normal[2] * side],
          );
        }
        const nx = (normal[0] * thickness) / 2,
          nz = (normal[2] * thickness) / 2;
        quad(
          [
            [p[0] + nx, py + (hi as number), p[1] + nz],
            [q[0] + nx, qy + (hi as number), q[1] + nz],
            [q[0] - nx, qy + (hi as number), q[1] - nz],
            [p[0] - nx, py + (hi as number), p[1] - nz],
          ],
          [0, 1, 0],
        );
      }
      if (fence.kind === 'rail' || (fence.kind === 'timber' && tier === 0)) {
        post(p);
        post(q);
      }
    }
  }
}
