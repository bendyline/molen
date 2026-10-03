import { expect, test } from 'vitest';
import { compactAuthoredMesh } from '../scripts/compact-authored-mesh.mjs';

test('exact sharing preserves every indexed attribute, seam, hard normal and group', () => {
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, -0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const normals = new Float32Array(Array.from({ length: 8 }, () => [0, 0, 1]).flat());
  normals[6 * 3 + 2] = -1;
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  const colors = new Uint8Array(24).fill(127);
  colors[21] = 128;
  const mesh = {
    positions,
    normals,
    uvs,
    colors,
    indices: new Uint32Array([0, 1, 2, 3, 1, 2, 4, 1, 2, 5, 1, 2, 6, 1, 2, 7, 1, 2]),
    groups: [
      { start: 0, count: 9, slot: 'wall', materialRef: 'a' },
      { start: 9, count: 9, slot: 'trim', materialRef: 'b' },
    ],
    vertexCount: 8,
    triangleCount: 6,
    bytes: 0,
  };
  const expanded = (m) =>
    Object.fromEntries(
      [
        ['positions', 3],
        ['normals', 3],
        ['uvs', 2],
        ['colors', 3],
      ].map(([key, stride]) => [
        key,
        Array.from(m.indices).flatMap((i) =>
          Array.from(m[key].subarray(i * stride, (i + 1) * stride)),
        ),
      ]),
    );
  const before = expanded(mesh),
    groups = structuredClone(mesh.groups);
  compactAuthoredMesh(mesh);
  expect(mesh.vertexCount).toBe(7);
  expect(expanded(mesh)).toEqual(before);
  expect(mesh.groups).toEqual(groups);
  expect(mesh.triangleCount).toBe(6);
  expect(Object.is(mesh.positions[mesh.indices[9] * 3], -0)).toBe(true);
  const once = structuredClone(mesh);
  compactAuthoredMesh(mesh);
  expect(mesh).toEqual(once);
});

test('empty authored buffers remain valid and empty', () => {
  const mesh = {
    positions: new Float32Array(),
    normals: new Float32Array(),
    uvs: new Float32Array(),
    colors: new Uint8Array(),
    indices: new Uint32Array(),
    groups: [],
    vertexCount: 0,
    triangleCount: 0,
    bytes: 0,
  };
  compactAuthoredMesh(mesh);
  expect(mesh.bytes).toBe(0);
  expect(mesh.vertexCount).toBe(0);
});
