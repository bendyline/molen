import { dmath } from '@bendyline/molen-kernel/determinism';
import type { MeshBufferBuilder } from './mesh-buffers';
import type { BuildingRequest, HeightSampler, Vec2, Vec3 } from './types';

/** A narrow, ground-following approach makes the reserved connection visible. */
export function buildBuildingAccess(
  access: NonNullable<BuildingRequest['access']>,
  ground: HeightSampler,
  out: MeshBufferBuilder,
): void {
  const dx = access.to[0] - access.from[0],
    dz = access.to[1] - access.from[1];
  const length = dmath.hypot(dx, dz);
  if (length < 0.1) return;
  const nx = ((-dz / length) * access.width) / 2,
    nz = ((dx / length) * access.width) / 2;
  const count = Math.min(16, Math.ceil(length / 2));
  const p = (t: number, side: number): Vec3 => {
    const x = access.from[0] + dx * t + nx * side,
      z = access.from[1] + dz * t + nz * side;
    return [x, ground.sampleHeight(x, z) + (access.lift ?? 0.045), z];
  };
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count;
    const uv: [Vec2, Vec2, Vec2, Vec2] = [
      [0, a * length],
      [access.width, a * length],
      [access.width, b * length],
      [0, b * length],
    ];
    out.addQuad(
      'foundation',
      'palette:#ffffff',
      [p(a, -1), p(a, 1), p(b, 1), p(b, -1)],
      [0, 1, 0],
      uv,
      access.width >= 2 ? [0.72, 0.73, 0.71] : [0.66, 0.65, 0.6],
    );
  }
}
