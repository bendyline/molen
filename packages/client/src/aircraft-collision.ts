import type { AircraftCollisionProbe, AircraftContact, VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { discSphereContact, discTriangleContact } from './aircraft-disc';

export interface AircraftObstacleScene {
  /** Collision tree origin and query, e.g. WalkCollision. */
  origin: THREE.Vector3;
  octree: {
    sphereIntersect(sphere: THREE.Sphere): false | { normal: THREE.Vector3; depth: number };
    getSphereTriangles?(sphere: THREE.Sphere, triangles: THREE.Triangle[]): unknown;
  };
  cars: ReadonlyArray<{
    transform: { pos: [number, number, number]; rot: [number, number, number, number] };
    spec: Pick<VehicleSpec, 'width' | 'height' | 'length'>;
  }>;
  /** Other aircraft body centers. The host excludes the queried aircraft. */
  aircraft: ReadonlyArray<[number, number, number]>;
}

/** Contact normals from streamed geometry and nearby parked vehicles, in absolute coordinates. */
export function aircraftObstacleContacts(
  probes: readonly AircraftCollisionProbe[],
  scene: AircraftObstacleScene,
): AircraftContact[] {
  const contacts: AircraftContact[] = [];
  if (probes.length === 0) return contacts;
  // A car has many panel probes. Cull parked bodies once for the whole query instead
  // of repeating a town-sized scan for every sphere on every physics substep.
  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;
  for (const probe of probes) {
    const radius = probe.disc ? Math.hypot(probe.radius, probe.disc.halfThickness) : probe.radius;
    minX = Math.min(minX, probe.center[0] - radius);
    maxX = Math.max(maxX, probe.center[0] + radius);
    minZ = Math.min(minZ, probe.center[2] - radius);
    maxZ = Math.max(maxZ, probe.center[2] + radius);
  }
  const near = (point: readonly number[], reach: number): boolean =>
    (point[0] ?? 0) >= minX - reach &&
    (point[0] ?? 0) <= maxX + reach &&
    (point[2] ?? 0) >= minZ - reach &&
    (point[2] ?? 0) <= maxZ + reach;
  const cars = scene.cars.filter(({ transform, spec }) =>
    near(transform.pos, Math.max(spec.width, spec.length)),
  );
  const aircraft = scene.aircraft.filter((point) => near(point, 1.2));
  for (const probe of probes) {
    const point = probe.center;
    const hit = (normal: THREE.Vector3, depth: number, at?: THREE.Vector3): void => {
      contacts.push({
        part: probe.part,
        point: (
          at ?? new THREE.Vector3().fromArray(point).addScaledVector(normal, -probe.radius)
        ).toArray(),
        normal: normal.toArray(),
        depth,
      });
    };
    const sphere = new THREE.Sphere(
      new THREE.Vector3().fromArray(point).sub(scene.origin),
      probe.disc ? Math.hypot(probe.radius, probe.disc.halfThickness) : probe.radius,
    );
    if (scene.octree.getSphereTriangles) {
      const triangles: THREE.Triangle[] = [];
      scene.octree.getSphereTriangles(sphere, triangles);
      if (probe.disc) {
        const localProbe = { ...probe, center: sphere.center.toArray() };
        const hits = triangles
          .flatMap((triangle) => {
            const contact = discTriangleContact(localProbe, triangle);
            return contact ? [contact] : [];
          })
          .sort(
            (a, b) =>
              b.depth - a.depth ||
              a.normal.x - b.normal.x ||
              a.normal.y - b.normal.y ||
              a.normal.z - b.normal.z ||
              a.point.x - b.point.x ||
              a.point.y - b.point.y ||
              a.point.z - b.point.z,
          );
        const contact = hits[0];
        if (contact) hit(contact.normal, contact.depth, contact.point.add(scene.origin));
      } else {
        // Octree.sphereIntersect accumulates corrections from both faces of a thin wall,
        // sometimes pushing a sphere through it. Keep the face approached from outside.
        const faceNormal = new THREE.Vector3(),
          nearest = new THREE.Vector3();
        const faces: Array<{ normal: THREE.Vector3; depth: number }> = [];
        for (const triangle of triangles) {
          triangle.getNormal(faceNormal);
          if (faceNormal.dot(sphere.center.clone().sub(triangle.a)) < -1e-7) continue;
          triangle.closestPointToPoint(sphere.center, nearest);
          const offset = sphere.center.clone().sub(nearest);
          const distance = offset.length();
          if (distance >= probe.radius) continue;
          const normal = distance > 1e-7 ? offset.multiplyScalar(1 / distance) : faceNormal.clone();
          const depth = probe.radius - distance;
          const same = faces.find((face) => face.normal.dot(normal) > 0.9999);
          if (same) same.depth = Math.max(same.depth, depth);
          else faces.push({ normal, depth });
        }
        // Adjacent coplanar triangles also expose their shared diagonal as an edge contact.
        // The deepest face is the actual closest surface; extra edge impulses create snags.
        faces.sort(
          (a, b) =>
            b.depth - a.depth ||
            a.normal.x - b.normal.x ||
            a.normal.y - b.normal.y ||
            a.normal.z - b.normal.z,
        );
        const nearestFace = faces[0];
        if (nearestFace) hit(nearestFace.normal, nearestFace.depth);
      }
    } else {
      const obstacle = scene.octree.sphereIntersect(sphere);
      if (obstacle) {
        // Legacy query supplies only a contact plane. Respect disc thickness instead of
        // treating the broad-phase sphere as a solid rotor-sized ball.
        if (probe.disc) {
          const axial = Math.abs(
            obstacle.normal.dot(new THREE.Vector3().fromArray(probe.disc.normal)),
          );
          const support =
            axial * probe.disc.halfThickness +
            Math.sqrt(Math.max(0, 1 - axial ** 2)) * probe.radius;
          const depth = obstacle.depth - sphere.radius + support;
          if (depth >= 0)
            hit(
              obstacle.normal,
              depth,
              new THREE.Vector3()
                .fromArray(point)
                .addScaledVector(obstacle.normal, -(sphere.radius - obstacle.depth)),
            );
        } else hit(obstacle.normal, obstacle.depth);
      }
    }
    for (const { transform, spec } of cars) {
      if (
        Math.hypot(transform.pos[0] - point[0], transform.pos[2] - point[2]) >
        Math.max(spec.width, spec.length) + sphere.radius
      )
        continue;
      const orientation = new THREE.Quaternion().fromArray(transform.rot);
      const local = new THREE.Vector3()
        .fromArray(point)
        .sub(new THREE.Vector3().fromArray(transform.pos))
        .applyQuaternion(orientation.clone().invert());
      const bounds = new THREE.Box3(
        new THREE.Vector3(-spec.width / 2, 0, -spec.length / 2),
        new THREE.Vector3(spec.width / 2, spec.height, spec.length / 2),
      );
      if (probe.disc) {
        const localProbe: AircraftCollisionProbe = {
          ...probe,
          center: local.toArray(),
          disc: {
            ...probe.disc,
            normal: new THREE.Vector3()
              .fromArray(probe.disc.normal)
              .applyQuaternion(orientation.clone().invert())
              .toArray(),
          },
        };
        const vertices = Array.from(
          { length: 8 },
          (_, i) =>
            new THREE.Vector3(
              i & 1 ? bounds.max.x : bounds.min.x,
              i & 2 ? bounds.max.y : bounds.min.y,
              i & 4 ? bounds.max.z : bounds.min.z,
            ),
        );
        let contact: ReturnType<typeof discTriangleContact>;
        for (const [a, b, c] of [
          [0, 2, 3],
          [0, 3, 1],
          [4, 5, 7],
          [4, 7, 6],
          [0, 4, 6],
          [0, 6, 2],
          [1, 3, 7],
          [1, 7, 5],
          [0, 1, 5],
          [0, 5, 4],
          [2, 6, 7],
          [2, 7, 3],
        ]) {
          const va = vertices[a ?? 0],
            vb = vertices[b ?? 0],
            vc = vertices[c ?? 0];
          if (!va || !vb || !vc) continue;
          const candidate = discTriangleContact(localProbe, new THREE.Triangle(va, vb, vc));
          if (candidate && (!contact || candidate.depth > contact.depth)) contact = candidate;
        }
        if (contact)
          hit(
            contact.normal.applyQuaternion(orientation),
            contact.depth,
            contact.point
              .applyQuaternion(orientation)
              .add(new THREE.Vector3().fromArray(transform.pos)),
          );
        // Fully contained disc: no box surface crosses it, but it is still a collision.
        else if (bounds.containsPoint(local))
          hit(
            new THREE.Vector3(0, 1, 0).applyQuaternion(orientation),
            bounds.max.y - local.y + probe.disc.halfThickness,
            new THREE.Vector3().fromArray(point),
          );
        continue;
      }
      const normal = local.clone().sub(bounds.clampPoint(local, new THREE.Vector3()));
      const distance = normal.length();
      if (distance >= probe.radius) continue;
      let depth = probe.radius - distance;
      if (distance > 0.0001) normal.multiplyScalar(1 / distance);
      else {
        const faces = (['x', 'y', 'z'] as const)
          .flatMap((axis) => [
            { axis, sign: -1, distance: local[axis] - bounds.min[axis] },
            { axis, sign: 1, distance: bounds.max[axis] - local[axis] },
          ])
          .sort((a, b) => a.distance - b.distance);
        const face = faces[0];
        if (!face) continue;
        normal.set(0, 0, 0);
        normal[face.axis] = face.sign;
        depth += face.distance;
      }
      hit(normal.applyQuaternion(orientation), depth);
    }
    for (const other of aircraft) {
      if (probe.disc) {
        const contact = discSphereContact(probe, new THREE.Vector3().fromArray(other), 1.2);
        if (contact) hit(contact.normal, contact.depth, contact.point);
        continue;
      }
      const normal = new THREE.Vector3().fromArray(point).sub(new THREE.Vector3().fromArray(other));
      const distance = normal.length();
      if (distance < 1.2 + probe.radius)
        hit(
          distance > 0.0001 ? normal.multiplyScalar(1 / distance) : new THREE.Vector3(0, 1, 0),
          1.2 + probe.radius - distance,
        );
    }
  }
  return contacts;
}
