import type { AircraftCollisionProbe } from '@bendyline/molen-schema';
import * as THREE from 'three';

export interface DiscHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  depth: number;
}

/** Finite cylinder against a triangle: clip to the axial slab, then test the full disc.
 * No angular samples, bounding-sphere hits or holes between blade-tip probes.
 */
export function discTriangleContact(
  probe: AircraftCollisionProbe,
  triangle: THREE.Triangle,
): DiscHit | undefined {
  const disc = probe.disc;
  if (!disc) return undefined;
  const center = new THREE.Vector3().fromArray(probe.center);
  const axis = new THREE.Vector3().fromArray(disc.normal);
  let polygon = [triangle.a, triangle.b, triangle.c].map((p) => p.clone().sub(center));
  for (const sign of [-1, 1]) {
    const clipped: THREE.Vector3[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      if (!a || !b) continue;
      const da = sign * a.dot(axis) - disc.halfThickness;
      const db = sign * b.dot(axis) - disc.halfThickness;
      if (da <= 0) clipped.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) clipped.push(a.clone().lerp(b, da / (da - db)));
    }
    polygon = clipped;
    if (polygon.length === 0) return undefined;
  }
  const projected = polygon.map((p) => p.clone().addScaledVector(axis, -p.dot(axis)));
  const zero = new THREE.Vector3();
  let distanceSq = Infinity;
  let nearest = new THREE.Vector3();
  // Projected edges also cover degenerate (edge-on) triangles.
  for (let i = 0; i < polygon.length; i++) {
    const a = projected[i],
      b = projected[(i + 1) % polygon.length];
    const pa = polygon[i],
      pb = polygon[(i + 1) % polygon.length];
    if (!a || !b || !pa || !pb) continue;
    const edge = b.clone().sub(a);
    const t = THREE.MathUtils.clamp(-a.dot(edge) / (edge.lengthSq() || 1), 0, 1);
    const d = a.clone().addScaledVector(edge, t).lengthSq();
    if (d < distanceSq) {
      distanceSq = d;
      nearest = pa.clone().lerp(pb, t);
    }
  }
  // A large horizontal roof can contain the entire disc, with every edge outside it.
  for (let i = 1; i + 1 < polygon.length; i++) {
    const a = projected[0],
      b = projected[i],
      c = projected[i + 1];
    const pa = polygon[0],
      pb = polygon[i],
      pc = polygon[i + 1];
    if (!a || !b || !c || !pa || !pb || !pc) continue;
    const face = new THREE.Triangle(a, b, c);
    if (face.getArea() < 1e-12 || !face.containsPoint(zero)) continue;
    const weights = face.getBarycoord(zero, new THREE.Vector3());
    if (!weights) continue;
    distanceSq = 0;
    nearest = pa
      .clone()
      .multiplyScalar(weights.x)
      .addScaledVector(pb, weights.y)
      .addScaledVector(pc, weights.z);
    break;
  }
  if (distanceSq > probe.radius ** 2) return undefined;
  const normal = triangle.getNormal(new THREE.Vector3());
  if (normal.lengthSq() < 0.5) return undefined;
  let signed = normal.dot(center.clone().sub(triangle.a));
  if (signed < 0) {
    normal.negate();
    signed = -signed;
  }
  const axial = Math.abs(normal.dot(axis));
  const support =
    disc.halfThickness * axial + probe.radius * Math.sqrt(Math.max(0, 1 - axial ** 2));
  return { point: nearest.add(center), normal, depth: Math.max(0, support - signed) };
}

/** Sphere against the actual finite cylinder, including its rim and flat end caps. */
export function discSphereContact(
  probe: AircraftCollisionProbe,
  center: THREE.Vector3,
  radius: number,
): DiscHit | undefined {
  const disc = probe.disc;
  if (!disc) return undefined;
  const hub = new THREE.Vector3().fromArray(probe.center);
  const axis = new THREE.Vector3().fromArray(disc.normal);
  const offset = center.clone().sub(hub);
  const height = offset.dot(axis);
  const radial = offset.clone().addScaledVector(axis, -height);
  const length = radial.length();
  const point = hub
    .clone()
    .addScaledVector(axis, THREE.MathUtils.clamp(height, -disc.halfThickness, disc.halfThickness))
    .addScaledVector(radial, Math.min(1, probe.radius / (length || 1)));
  const normal = point.clone().sub(center);
  const distance = normal.length();
  if (distance > radius) return undefined;
  if (distance > 1e-8) normal.multiplyScalar(1 / distance);
  else normal.copy(axis).multiplyScalar(height >= 0 ? -1 : 1);
  return { point, normal, depth: radius - distance };
}
