import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildTriangleIndex,
  forEachIndexedTriangle,
  TRIANGLE_INDEX_MIN_TRIANGLES,
  triangleIndexFor,
} from '../src/navigation/triangle-index';

function triangleFootprint(
  geometry: THREE.BufferGeometry,
  triangle: number,
): [number, number, number, number] {
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const xs: number[] = [];
  const zs: number[] = [];
  for (let k = 0; k < 3; k++) {
    const vertex = triangle * 3 + k;
    const i = index ? index.getX(vertex) : vertex;
    xs.push(position.getX(i));
    zs.push(position.getZ(i));
  }
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}

function bruteForce(
  geometry: THREE.BufferGeometry,
  box: [number, number, number, number],
): Set<number> {
  const count = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  const hits = new Set<number>();
  for (let t = 0; t < count; t++) {
    const [minX, maxX, minZ, maxZ] = triangleFootprint(geometry, t);
    if (minX <= box[1] && maxX >= box[0] && minZ <= box[3] && maxZ >= box[2]) hits.add(t);
  }
  return hits;
}

describe('triangle index', () => {
  it('returns every triangle whose footprint can overlap a box, each once', () => {
    // A terrain-like grid, lying flat, plus long triangles that span many cells.
    const grid = new THREE.PlaneGeometry(1000, 1000, 100, 100).rotateX(-Math.PI / 2);
    const position = grid.getAttribute('position') as THREE.BufferAttribute;
    const index = grid.index as THREE.BufferAttribute;
    const built = buildTriangleIndex(position, index, index.count / 3);
    const boxes: Array<[number, number, number, number]> = [
      [-24, 24, -24, 24],
      [400, 460, -510, -420],
      [-600, -480, 0, 30],
      [-2000, 2000, -2000, 2000],
      [3000, 3100, 0, 10],
    ];
    for (const box of boxes) {
      const seen: number[] = [];
      forEachIndexedTriangle(built, box[0], box[1], box[2], box[3], (t) => seen.push(t));
      expect(new Set(seen).size, `box ${box.join(',')}`).toBe(seen.length);
      const expected = bruteForce(grid, box);
      for (const t of expected) expect(seen, `box ${box.join(',')} triangle ${t}`).toContain(t);
    }
    // Spanning triangles are listed in every cell they cross but reported once per query.
    const long = new THREE.BufferGeometry();
    const vertices = new Float32Array(64 * 9);
    for (let i = 0; i < 64; i++) {
      vertices.set([-500, 0, i * 4 - 128, 500, 0, i * 4 - 128, 500, 0, i * 4 - 126], i * 9);
    }
    long.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const spanning = buildTriangleIndex(long.getAttribute('position'), null, 64);
    expect(spanning.triangles.length).toBeGreaterThan(64);
    const reported: number[] = [];
    forEachIndexedTriangle(spanning, -10, 10, -1000, 1000, (t) => reported.push(t));
    expect(reported.sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i));
  });

  it('keeps one index per geometry version and skips small geometries', () => {
    const small = new THREE.BoxGeometry(1, 1, 1);
    expect(triangleIndexFor(small)).toBeUndefined();
    const segments = Math.ceil(Math.sqrt(TRIANGLE_INDEX_MIN_TRIANGLES / 2)) + 1;
    const large = new THREE.PlaneGeometry(100, 100, segments, segments);
    const first = triangleIndexFor(large);
    expect(first).toBeDefined();
    expect(triangleIndexFor(large)).toBe(first);
    (large.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    const rebuilt = triangleIndexFor(large);
    expect(rebuilt).toBeDefined();
    expect(rebuilt).not.toBe(first);
  });
});
