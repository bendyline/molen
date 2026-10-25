import { describe, expect, it } from 'vitest';
import { deriveRig, resolveFigureDescriptor } from '../src/kernel';
import { animalContext, tube } from '../src/kernel/body-animal-shape';
import { SkinnedMeshBuilder, skin } from '../src/kernel/skinned-mesh-builder';

type V = [number, number, number];
const at = (a: Float32Array, i: number): V => [
  a[i * 3] as number,
  a[i * 3 + 1] as number,
  a[i * 3 + 2] as number,
];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe('figure surface winding', () => {
  it('keeps a hanging tail outward-facing as its curve passes through vertical', () => {
    const d = resolveFigureDescriptor({ preset: 'horse' });
    const builder = new SkinnedMeshBuilder();
    const c = animalContext(d, deriveRig(d), 0, builder);
    const points: V[] = [
      [0, 1, 0],
      [0, 0.9, -0.2],
      [0, 0.7, -0.3],
      [0, 0.45, -0.35],
      [0, 0.2, -0.34],
    ];
    tube(
      c,
      'hair',
      points,
      points.map(() => 0.05),
      points.map(() => skin(0)),
      [0.1, 0.1, 0.1],
      12,
    );
    const { positions, normals } = builder.finalize(0);
    let sides = 0;
    for (let v = 0; v < positions.length / 3; v++) {
      const x = positions[v * 3] as number;
      if (Math.abs(x) < 0.049) continue;
      expect((normals[v * 3] as number) * Math.sign(x)).toBeGreaterThan(0.85);
      sides++;
    }
    expect(sides).toBe(points.length * 2);
  });

  it('points sphere normals and triangle faces outwards, including both pole caps', () => {
    const b = new SkinnedMeshBuilder();
    b.ellipsoid('skin', [0, 0, 0], [0, 1, 0], [1, 1, 1], 16, 12, skin(0), [1, 1, 1]);
    const { positions: p, normals: n, indices } = b.finalize(0);
    for (let i = 0; i < p.length / 3; i++) expect(dot(at(p, i), at(n, i))).toBeGreaterThan(0.95);
    for (let i = 0; i < indices.length; i += 3) {
      const a = at(p, indices[i] as number);
      const u = sub(at(p, indices[i + 1] as number), a);
      const v = sub(at(p, indices[i + 2] as number), a);
      const normal: V = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      expect(dot(normal, a)).toBeGreaterThan(0);
    }
  });
});
