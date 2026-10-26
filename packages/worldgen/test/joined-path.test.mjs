import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../dist/kernel.mjs';
import { beamPath, validateAuthoredMesh } from '../scripts/authored-structure-mesh.mjs';
import { joinedBeamPath, joinedPath } from '../scripts/joined-path.mjs';
import { tubePath } from '../scripts/structure-mesh.mjs';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function manifold(mesh) {
  const edges = new Map();
  let volume = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = mesh.indices.slice(i, i + 3);
    const [a, b, c] = ids.map((j) => mesh.positions.slice(j * 3, j * 3 + 3));
    expect(Math.hypot(...cross(sub(b, a), sub(c, a)))).toBeGreaterThan(1e-10);
    volume += dot(a, cross(b, c)) / 6;
    for (let j = 0; j < 3; j++) {
      const a = ids[j],
        b = ids[(j + 1) % 3],
        key = [Math.min(a, b), Math.max(a, b)].join(':');
      const value = edges.get(key) ?? [0, 0];
      value[0]++;
      value[1] += a < b ? 1 : -1;
      edges.set(key, value);
    }
  }
  expect([...edges.values()].every(([count, winding]) => count === 2 && winding === 0)).toBe(true);
  expect(volume).toBeGreaterThan(0);
}

it('miters the Bell 407 dashboard step at constant section width with no internal caps', () => {
  const points = [
    [-0.59, 1.5, 1.78],
    [-0.24, 1.5, 1.78],
    [-0.13, 1.63, 1.78],
    [0.34, 1.63, 1.78],
  ];
  const mesh = joinedPath(points, 0.024);
  manifold(mesh);
  expect(mesh.indices.length / 3).toBe(3 * 12 + 12);
  for (let i = 1; i < points.length - 1; i++) {
    for (const p of mesh.rings[i]) {
      for (const neighbor of [points[i - 1], points[i + 1]]) {
        const axis = sub(neighbor, points[i]),
          offset = sub(p, points[i]);
        const distance = Math.hypot(...cross(axis, offset)) / Math.hypot(...axis);
        expect(distance).toBeCloseTo(0.024, 10);
      }
    }
  }
});

it.each([
  {
    points: [
      [0, 0, 0],
      [2, 0, 0],
      [2, 2, 0],
      [0, 2, 0],
    ],
  },
  {
    points: [
      [0, 0, 0],
      [2, 0, 0.2],
      [2, 2, 0],
      [0, 2, 0.4],
    ],
  },
])('closes planar and spatial frames without a seam or cap', ({ points }) => {
  for (const path of [points, [...points].reverse()]) {
    const mesh = joinedPath(path, 0.05, 8, true);
    manifold(mesh);
    expect(mesh.positions.length / 3).toBe(points.length * 8);
  }
});

it('removes repeated stations, recognizes repeated closure and bounds sharp corner spikes', () => {
  const mesh = joinedPath(
    [
      [0, 0, 0],
      [0, 0, 0],
      [2, 0, 0],
      [0, 0.2, 0],
      [0, 0, 0],
    ],
    0.01,
  );
  manifold(mesh);
  expect(mesh.closed).toBe(true);
  for (let i = 0; i < mesh.points.length; i++)
    for (const p of mesh.rings[i])
      expect(Math.hypot(...sub(p, mesh.points[i]))).toBeLessThanOrEqual(0.04000001);
});

it('rejects invalid sections and reversals rather than emitting NaN geometry', () => {
  expect(() =>
    joinedPath(
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      0,
    ),
  ).toThrow();
  expect(() =>
    joinedPath(
      [
        [0, 0, 0],
        [1, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
      ],
      0.1,
    ),
  ).toThrow(/reverse/);
});

it('joins rectangular architectural frames without caps at the corners', () => {
  const points = [
    [0, 0, 0],
    [3, 0, 0],
    [3, 2, 0],
    [0, 2, 0],
  ];
  const mesh = joinedBeamPath(points, 0.12, 0.2, true);
  manifold(mesh);
  expect(mesh.positions.length / 3).toBe(16);
  expect(mesh.indices.length / 3).toBe(32);
  // Each side of the frame retains the same depth through the 90-degree joints.
  for (const ring of mesh.rings) {
    expect(Math.max(...ring.map((p) => p[2])) - Math.min(...ring.map((p) => p[2]))).toBeCloseTo(
      0.12,
      10,
    );
  }
});

it('emits valid Float32 triangle normals for spatial beam and tube paths', () => {
  const points = [
    [0, 0, 0],
    [2, 0.3, 0.2],
    [2, 2, 0],
    [0, 2, 0.4],
  ];
  for (const closed of [false, true]) {
    const out = new MeshBufferBuilder();
    beamPath(out, 'trim', points, 0.1, 0.2, [0.3, 0.3, 0.3], closed);
    tubePath(out, 'rail', points, 0.04, [0.3, 0.3, 0.3], 6, closed);
    expect(() => validateAuthoredMesh(out.finalize(), 'spatial frame')).not.toThrow();
  }
});
