/** Bake the intended surface shading into glTF normals before batching/export. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { Float32BufferAttribute, Vector3 } from 'three';

const materials = new WeakMap();

/** Share one vertex-normal material for flat and round parts, without extra draw calls. */
export function surfaceMaterial(material) {
  if (!material.flatShading) return material;
  if (!materials.has(material)) {
    const result = material.clone();
    result.flatShading = false;
    materials.set(material, result);
  }
  return materials.get(material);
}

export function prepareSurface(geometry, material) {
  // Authored normals already encode the distinction: boxes/caps have split hard normals,
  // cylinders/tires have radial normals, and custom sheets supply their face normals.
  // Preserve them instead of flattening every part which happens to share a paint material.
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  return { geometry, material: surfaceMaterial(material) };
}

/**
 * Angle-weighted normals within one authored surface. Position seams can share shading,
 * but angles above the crease limit stay hard. Never run over a whole assembled model:
 * touching parts, caps and separate panels must not contribute to each other's normals.
 * Triangle positions, winding, UVs and count remain unchanged.
 */
export function smoothSurface(geometry, creaseDegrees = 40) {
  const result = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const p = result.getAttribute('position');
  const buckets = new Map();
  const faces = [];
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  const ab = new Vector3(),
    ac = new Vector3();
  const key = (i) => [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e6)).join(',');
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    const normal = ab.subVectors(b, a).cross(ac.subVectors(c, a)).normalize().clone();
    faces.push(normal);
    const points = [a, b, c];
    for (let j = 0; j < 3; j++) {
      const angle = ab
        .subVectors(points[(j + 1) % 3], points[j])
        .angleTo(ac.subVectors(points[(j + 2) % 3], points[j]));
      const k = key(i + j);
      const bucket = buckets.get(k) ?? [];
      bucket.push({ normal, angle });
      buckets.set(k, bucket);
    }
  }
  const normals = new Float32Array(p.count * 3);
  const cosine = Math.cos((creaseDegrees * Math.PI) / 180);
  for (let i = 0; i < p.count; i++) {
    const face = faces[Math.floor(i / 3)];
    a.set(0, 0, 0);
    for (const { normal, angle } of buckets.get(key(i)))
      if (face.dot(normal) >= cosine) a.addScaledVector(normal, angle);
    if (a.lengthSq() < 1e-20) a.copy(face.lengthSq() > 0 ? face : b.set(0, 1, 0));
    a.normalize().toArray(normals, i * 3);
  }
  result.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return result;
}
