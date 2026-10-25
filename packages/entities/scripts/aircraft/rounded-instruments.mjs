/** Smooth shallow mechanical instrument faces, pointing toward the pilot (local -Z). */
import { BufferGeometry, Float32BufferAttribute } from 'three';

export function domeDepth(x, y, radius, depth) {
  const sphereRadius = (radius * radius + depth * depth) / (2 * depth);
  return sphereRadius - Math.sqrt(Math.max(0, sphereRadius * sphereRadius - x * x - y * y)) - depth;
}

export function instrumentDome(radius, depth, start = 0, sweep = Math.PI * 2) {
  const positions = [],
    normals = [],
    indices = [];
  const segments = Math.round((64 * sweep) / (Math.PI * 2)),
    rings = 8;
  const sphereRadius = (radius * radius + depth * depth) / (2 * depth);
  positions.push(0, 0, -depth);
  normals.push(0, 0, -1);
  for (let ring = 1; ring <= rings; ring++)
    for (let j = 0; j <= segments; j++) {
      const a = start + (sweep * j) / segments,
        rho = (radius * ring) / rings;
      const x = Math.cos(a) * rho,
        y = Math.sin(a) * rho,
        z = domeDepth(x, y, radius, depth);
      positions.push(x, y, z);
      normals.push(x / sphereRadius, y / sphereRadius, (z - sphereRadius + depth) / sphereRadius);
    }
  for (let j = 0; j < segments; j++) indices.push(0, 2 + j, 1 + j);
  for (let ring = 1; ring < rings; ring++)
    for (let j = 0; j < segments; j++) {
      const a = 1 + (ring - 1) * (segments + 1) + j,
        b = a + segments + 1;
      indices.push(a, b + 1, b, a, a + 1, b + 1);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}
