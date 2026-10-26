import { BoxGeometry, CylinderGeometry, Group, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { cleanGeometry, loft } from '../scripts/aircraft/mesh-kit.mjs';
import { prepareSurface, smoothSurface } from '../scripts/surface-normals.mjs';
import { detailKit } from '../scripts/vehicle-detail.mjs';

const triangles = (g) => (g.index?.count ?? g.getAttribute('position').count) / 3;
const ring = (z, n = 20) => ({
  z,
  points: Array.from({ length: n }, (_, i) => [
    Math.sin((i * 2 * Math.PI) / n),
    Math.cos((i * 2 * Math.PI) / n),
  ]),
});

describe('authored curved surface normals', () => {
  it('smooths a long round loft through batching and cleanup without changing its budget', () => {
    const root = new Group(),
      d = detailKit(root);
    const material = new MeshStandardMaterial({ flatShading: true });
    loft(d, [ring(2), ring(1.9), ring(-8)], material);
    d.finish();
    cleanGeometry(root);
    const mesh = d.root.children[0],
      g = mesh.geometry;
    expect(triangles(g)).toBe(116);
    expect(mesh.material.flatShading).toBe(false);
    const p = g.getAttribute('position'),
      n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      const normal = new Vector3().fromBufferAttribute(n, i);
      expect(normal.length()).toBeCloseTo(1, 5);
      if (Math.abs(normal.z) > 0.99) continue; // caps must stay hard
      expect(normal.dot(new Vector3(p.getX(i), p.getY(i), 0).normalize())).toBeGreaterThan(0.99999);
    }
    expect(
      Array.from(n.array)
        .filter((_, i) => i % 3 === 2)
        .some((v) => v === 1),
    ).toBe(true);
    expect(
      Array.from(n.array)
        .filter((_, i) => i % 3 === 2)
        .some((v) => v === -1),
    ).toBe(true);
  });
  it('preserves boxes and explicit faceted contours when sharing paint with round parts', () => {
    const material = new MeshStandardMaterial({ flatShading: true });
    const box = prepareSurface(new BoxGeometry(), material);
    const cylinder = prepareSurface(new CylinderGeometry(1, 1, 2, 20), material);
    expect(box.material).toBe(cylinder.material);
    expect(triangles(box.geometry)).toBe(12);
    expect(triangles(cylinder.geometry)).toBe(80);
    const n = box.geometry.getAttribute('normal');
    for (let i = 0; i < n.count; i++)
      expect([n.getX(i), n.getY(i), n.getZ(i)].filter((v) => v !== 0)).toHaveLength(1);
    const root = new Group(),
      d = detailKit(root);
    loft(d, [ring(1), ring(-1)], material, { smooth: false, caps: false });
    d.finish();
    cleanGeometry(root);
    const g = d.root.children[0].geometry,
      normals = g.getAttribute('normal');
    for (let i = 0; i < normals.count; i += 3)
      expect(
        new Vector3()
          .fromBufferAttribute(normals, i)
          .distanceTo(new Vector3().fromBufferAttribute(normals, i + 1)),
      ).toBeLessThan(1e-6);
  });
  it('keeps the cylinder cap seam hard and all attributes when smoothing a triangle soup', () => {
    const original = new CylinderGeometry(1, 1, 2, 20).toNonIndexed();
    const smooth = smoothSurface(original);
    expect(triangles(smooth)).toBe(triangles(original));
    expect(smooth.getAttribute('position').array).toEqual(original.getAttribute('position').array);
    expect(smooth.getAttribute('uv').array).toEqual(original.getAttribute('uv').array);
    const normals = smooth.getAttribute('normal');
    for (let i = 0; i < 120; i++) expect(Math.abs(normals.getY(i))).toBeLessThan(1e-6);
    for (let i = 120; i < normals.count; i++) expect(Math.abs(normals.getY(i))).toBe(1);
    expect(smoothSurface(original).getAttribute('normal').array).toEqual(normals.array);
  });
});
