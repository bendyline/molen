/** Small hard-surface primitives shared by reusable models and procedural facades. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import type { MeshBufferBuilder } from './mesh-buffers';
import { parseColor } from './schema-common';
import type { Vec2, Vec3 } from './types';

/** Cuboid with hard normals, metric UVs, and a rotation about +Y. */
export function modelBox(
  out: MeshBufferBuilder,
  center: Vec3,
  size: Vec3,
  color: string,
  yaw = 0,
  materialRef = 'palette:#ffffff',
): void {
  const c = dmath.cos(yaw),
    s = dmath.sin(yaw);
  const transform = (p: Vec3): Vec3 => [
    center[0] + p[0] * c + p[2] * s,
    center[1] + p[1],
    center[2] - p[0] * s + p[2] * c,
  ];
  const x = size[0] / 2,
    y = size[1] / 2,
    z = size[2] / 2;
  const faces: Array<[Vec3[], Vec3]> = [
    [
      [
        [-x, -y, z],
        [x, -y, z],
        [x, y, z],
        [-x, y, z],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x, -y, -z],
        [-x, -y, -z],
        [-x, y, -z],
        [x, y, -z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x, -y, z],
        [x, -y, -z],
        [x, y, -z],
        [x, y, z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [-x, -y, -z],
        [-x, -y, z],
        [-x, y, z],
        [-x, y, -z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [-x, y, z],
        [x, y, z],
        [x, y, -z],
        [-x, y, -z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [-x, -y, -z],
        [x, -y, -z],
        [x, -y, z],
        [-x, -y, z],
      ],
      [0, -1, 0],
    ],
  ];
  for (const [p, n] of faces)
    out.addQuad(
      'trim',
      materialRef,
      p.map(transform) as [Vec3, Vec3, Vec3, Vec3],
      [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c],
      [
        [0, 0],
        [materialRef === 'palette:#ffffff' || n[0] === 0 ? size[0] : size[2], 0],
        [
          materialRef === 'palette:#ffffff' || n[0] === 0 ? size[0] : size[2],
          materialRef !== 'palette:#ffffff' && n[1] !== 0 ? size[2] : size[1],
        ],
        [0, materialRef !== 'palette:#ffffff' && n[1] !== 0 ? size[2] : size[1]],
      ],
      parseColor(color),
    );
}

/** Raised ribbon in the XY plane, facing +Z. */
export function modelStroke(
  out: MeshBufferBuilder,
  points: readonly Vec2[],
  width: number,
  z: number,
  color: string,
): void {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Vec2,
      b = points[i] as Vec2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const nx = ((-(b[1] - a[1]) / len) * width) / 2,
      ny = (((b[0] - a[0]) / len) * width) / 2;
    out.addQuad(
      'trim',
      'palette:#ffffff',
      [
        [a[0] + nx, a[1] + ny, z],
        [b[0] + nx, b[1] + ny, z],
        [b[0] - nx, b[1] - ny, z],
        [a[0] - nx, a[1] - ny, z],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [len, 0],
        [len, width],
        [0, width],
      ],
      parseColor(color),
    );
  }
}
